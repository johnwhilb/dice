import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { DiceRuleNumNeedEnum } from '../../common/table/DiceRuleNumNeedEnum';
import { TableRole } from '../../common/table/TableRole';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';

export class BattleDiceBll extends CCBusiness<Battle> {
    lockDice(diceIndex: number) {
        if (this.ent.BattleModel.busy || this.ent.BattleModel.phase !== BattlePhase.PlayerAction
            || diceIndex < 0 || diceIndex >= this.ent.BattlePlayerModel.dice.length
            || this.ent.BattlePlayerModel.diceUsed.includes(diceIndex)) {
            return;
        }
        const diceLocked = this.ent.BattlePlayerModel.diceLocked;
        if (!diceLocked.includes(diceIndex)) {
            diceLocked.push(diceIndex);
        }
        this.ent.BattleBll.refresh();
    }

    unlockDice(diceIndex: number) {
        if (this.ent.BattleModel.busy || this.ent.BattleModel.phase !== BattlePhase.PlayerAction) {
            return;
        }
        this.ent.BattlePlayerModel.diceLocked = this.ent.BattlePlayerModel.diceLocked.filter(index => index !== diceIndex);
        this.ent.BattleBll.refresh();
    }

    isDiceLocked(diceIndex: number): boolean {
        return this.ent.BattlePlayerModel.diceLocked.includes(diceIndex);
    }

    getLockedDiceIndexes(): number[] {
        return this.ent.BattlePlayerModel.diceLocked.slice();
    }

    /**
     * 重掷所有未锁定骰子，并返回当前全部骰子的点数。
     * 每颗骰子的可用面值来自角色配置 originDice。
     */
    resetDice(random: () => number = Math.random): number[] {
        const playerModel = this.ent.BattlePlayerModel;
        const role = TableRole.getConfigById(playerModel.playerId);
        const diceFaces: number[][] = role?.originDice || [];

        if (!diceFaces || diceFaces.length === 0) {
            return playerModel.dice.slice();
        }

        const currentDice = playerModel.dice;
        const currentLocked = playerModel.diceLocked;
        const currentUsed = playerModel.diceUsed;
        const nextDice = new Array<number>(diceFaces.length);
        const nextLocked = currentLocked.filter(index =>
            Number.isInteger(index)
            && index >= 0
            && index < diceFaces.length
            && currentDice[index] !== undefined
        );
        const nextLockedSet = new Set(nextLocked);
        const usedSet = new Set(currentUsed);

        for (let diceIndex = 0; diceIndex < diceFaces.length; diceIndex++) {
            if (nextLockedSet.has(diceIndex) || usedSet.has(diceIndex)) {
                nextDice[diceIndex] = currentDice[diceIndex];
                continue;
            }

            const faces = diceFaces[diceIndex];
            if (!faces || faces.length === 0) {
                nextDice[diceIndex] = currentDice[diceIndex] ?? 0;
                continue;
            }

            const faceIndex = Math.min(Math.floor(random() * faces.length), faces.length - 1);
            nextDice[diceIndex] = faces[Math.max(faceIndex, 0)];
        }

        playerModel.dice = nextDice;
        playerModel.diceLocked = nextLocked;
        return nextDice.slice();
    }

    /** Returns the earliest matching dice indexes for the requested rule. */
    checkDiceRule(rule: DiceRuleNumNeedEnum): number[] {
        switch (rule) {
            case DiceRuleNumNeedEnum.DOUBLE:
                return this.findSameValueGroup(2);
            case DiceRuleNumNeedEnum.TRIPLE:
                return this.findSameValueGroup(3);
            case DiceRuleNumNeedEnum.QUADRA:
                return this.findSameValueGroup(4);
            case DiceRuleNumNeedEnum.PENTA:
                return this.findSameValueGroup(5);
            default:
                return [];
        }
    }

    private findSameValueGroup(requiredCount: number): number[] {
        const player = this.ent.BattlePlayerModel;
        const dice = player.dice;
        const indexesByValue = new Map<number, number[]>();

        dice.forEach((value, index) => {
            if (player.diceLocked.includes(index) || player.diceUsed.includes(index)) {
                return;
            }
            const indexes = indexesByValue.get(value) ?? [];
            indexes.push(index);
            indexesByValue.set(value, indexes);
        });

        const candidates = Array.from(indexesByValue.entries())
            .filter(([, indexes]) => indexes.length >= requiredCount)
            .map(([value, indexes]) => ({ value, indexes: indexes.slice(0, requiredCount) }));

        candidates.sort((a, b) => {
            const valueDifference = b.value - a.value;
            if (valueDifference !== 0) {
                return valueDifference;
            }
            const indexTotalDifference = this.sumIndexes(a.indexes) - this.sumIndexes(b.indexes);
            if (indexTotalDifference !== 0) {
                return indexTotalDifference;
            }

            for (let index = 0; index < requiredCount; index++) {
                if (a.indexes[index] !== b.indexes[index]) {
                    return a.indexes[index] - b.indexes[index];
                }
            }
            return 0;
        });

        return candidates[0]?.indexes ?? [];
    }



    private sumIndexes(indexes: readonly number[]): number {
        return indexes.reduce((total, index) => total + index, 0);
    }
}
