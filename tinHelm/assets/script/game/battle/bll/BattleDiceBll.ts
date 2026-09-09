import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { EnumDiceRule } from '../../common/table/EnumDiceRule';
import { TableRole } from '../../common/table/TableRole';
import { Battle } from '../Battle';

export class BattleDiceBll extends CCBusiness<Battle> {
    lockDice(diceIndex: number): boolean {
        if (!this.isValidDiceIndex(diceIndex)) {
            return false;
        }

        this.ensureLockState();
        this.ent.BattlePlayerModel.diceLocked[diceIndex] = true;
        return true;
    }

    unlockDice(diceIndex: number): boolean {
        if (!this.isValidDiceIndex(diceIndex)) {
            return false;
        }

        this.ensureLockState();
        this.ent.BattlePlayerModel.diceLocked[diceIndex] = false;
        return true;
    }

    unlockAllDice(): void {
        this.ent.BattlePlayerModel.diceLocked = this.ent.BattlePlayerModel.dice.map(() => false);
    }

    isDiceLocked(diceIndex: number): boolean {
        return this.ent.BattlePlayerModel.diceLocked[diceIndex] === true;
    }

    getLockedDiceIndexes(): number[] {
        const result: number[] = [];
        this.ent.BattlePlayerModel.diceLocked.forEach((locked, index) => {
            if (locked) {
                result.push(index);
            }
        });
        return result;
    }

    /**
     * 重掷所有未锁定骰子，并返回当前全部骰子的点数。
     * 每颗骰子的可用面值来自角色配置 originDice。
     */
    resetDice(random: () => number = Math.random): number[] {
        const playerModel = this.ent.BattlePlayerModel;
        const role = TableRole.getConfigById(playerModel.playerId);
        const diceFaces = role?.originDice as number[][] | undefined;

        if (!diceFaces || diceFaces.length === 0) {
            return playerModel.dice.slice();
        }

        const currentDice = playerModel.dice;
        const currentLocked = playerModel.diceLocked;
        const nextDice = new Array<number>(diceFaces.length);
        const nextLocked = diceFaces.map((_, index) =>
            currentLocked[index] === true && currentDice[index] !== undefined
        );

        for (let diceIndex = 0; diceIndex < diceFaces.length; diceIndex++) {
            if (nextLocked[diceIndex]) {
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
    checkDiceRule(rule: EnumDiceRule): number[] {
        switch (rule) {
            case EnumDiceRule.DOUBLE:
                return this.findSameValueGroup(2);
            case EnumDiceRule.TRIPLE:
                return this.findSameValueGroup(3);
            case EnumDiceRule.QUADRA:
                return this.findSameValueGroup(4);
            case EnumDiceRule.PENTA:
                return this.findSameValueGroup(5);
            default:
                return [];
        }
    }

    private findSameValueGroup(requiredCount: number): number[] {
        const dice = this.ent.BattlePlayerModel.dice;
        const indexesByValue = new Map<number, number[]>();

        dice.forEach((value, index) => {
            const indexes = indexesByValue.get(value) ?? [];
            indexes.push(index);
            indexesByValue.set(value, indexes);
        });

        const candidates = Array.from(indexesByValue.values())
            .filter(indexes => indexes.length >= requiredCount)
            .map(indexes => indexes.slice(0, requiredCount));

        candidates.sort((a, b) => {
            const indexTotalDifference = this.sumIndexes(a) - this.sumIndexes(b);
            if (indexTotalDifference !== 0) {
                return indexTotalDifference;
            }

            for (let index = 0; index < requiredCount; index++) {
                if (a[index] !== b[index]) {
                    return a[index] - b[index];
                }
            }
            return 0;
        });

        return candidates[0] ?? [];
    }

    private isValidDiceIndex(diceIndex: number): boolean {
        return Number.isInteger(diceIndex)
            && diceIndex >= 0
            && diceIndex < this.ent.BattlePlayerModel.dice.length;
    }

    private ensureLockState(): void {
        const playerModel = this.ent.BattlePlayerModel;
        if (playerModel.diceLocked.length !== playerModel.dice.length) {
            playerModel.diceLocked = playerModel.dice.map((_, index) =>
                playerModel.diceLocked[index] === true
            );
        }
    }

    private sumIndexes(indexes: readonly number[]): number {
        return indexes.reduce((total, index) => total + index, 0);
    }
}
