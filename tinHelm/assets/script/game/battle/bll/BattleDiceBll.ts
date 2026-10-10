import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { DiceRuleNumNeedEnum } from '../../common/table/DiceRuleNumNeedEnum';
import { TableRole } from '../../common/table/TableRole';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
export class BattleDiceBll extends CCBusiness<Battle> {
    // 选中本回合允许操作的骰子。
    lockDice(diceIndex: number): void {
        if (this.ent.BattleModel.busy || this.ent.BattleModel.phase !== BattlePhase.PlayerAction
            || diceIndex < 0 || diceIndex >= this.ent.BattlePlayerModel.dice.length) {
            return;
        }
        const diceLocked = this.ent.BattlePlayerModel.diceLocked;
        if (!diceLocked.includes(diceIndex)) {
            this.ent.BattlePlayerModel.diceLocked = [diceIndex];
        }
        this.ent.BattleBll.refreshBattleView();
    }
    // 取消指定骰子的选中状态。
    unlockDice(diceIndex: number): void {
        if (this.ent.BattleModel.busy || this.ent.BattleModel.phase !== BattlePhase.PlayerAction) {
            return;
        }
        this.ent.BattlePlayerModel.diceLocked = this.ent.BattlePlayerModel.diceLocked.filter(index => {
            return index !== diceIndex;
        });
        this.ent.BattleBll.refreshBattleView();
    }
    // 检查指定骰子是否被选中。
    isDiceLocked(diceIndex: number): boolean {
        return this.ent.BattlePlayerModel.diceLocked.includes(diceIndex);
    }
    // 读取当前选中的骰子索引副本。
    getLockedDiceIndexes(): number[] {
        return this.ent.BattlePlayerModel.diceLocked.slice();
    }
    /** 从角色配置的六个骰面中，只随机指定的一颗骰子。 */
    // 根据角色配置随机指定骰子的骰面。
    rollOneDie(diceIndex: number, random: () => number = Math.random): boolean {
        const player = this.ent.BattlePlayerModel;
        const role = TableRole.getConfigById(player.playerId)!;
        if (!Number.isInteger(diceIndex) || diceIndex < 0 || diceIndex >= player.dice.length) {
            return false;
        }
        const faces: number[] = role.originDice[diceIndex];
        if (!Array.isArray(faces) || !faces.length) {
            throw new Error(`骰子配置缺少骰面：${diceIndex}`);
        }
        const rawIndex = Math.floor(random() * faces.length);
        const faceIndex = Math.max(0, Math.min(rawIndex, faces.length - 1));
        player.dice[diceIndex] = faces[faceIndex];
        return true;
    }
    /** 每回合开始重新随机全部骰子，结束回合仅恢复状态而不改变骰面。 */
    // 根据角色配置重新随机全部骰子并恢复可用状态。
    resetDice(random: () => number = Math.random): number[] {
        const playerModel = this.ent.BattlePlayerModel;
        const role = TableRole.getConfigById(playerModel.playerId)!;
        if (!role.originDice.length) {
            throw new Error(`角色骰子配置不能为空：${playerModel.playerId}`);
        }
        const nextDice = role.originDice.map((faces: number[], diceIndex: number): number => {
            if (!Array.isArray(faces) || faces.length === 0) {
                throw new Error(`骰子配置缺少骰面：${diceIndex}`);
            }
            const faceIndex = Math.min(Math.floor(random() * faces.length), faces.length - 1);
            return faces[Math.max(faceIndex, 0)];
        });
        playerModel.dice = nextDice;
        playerModel.diceLocked = [];
        playerModel.diceUsed = [];
        return nextDice.slice();
    }
    /** 按规则读取最先匹配的可用骰子索引。 */
    // 查找满足配表规则的可用骰子索引。
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
    // 按骰面与索引优先级选择同值骰子组。
    private findSameValueGroup(requiredCount: number): number[] {
        const player = this.ent.BattlePlayerModel;
        const dice = player.dice;
        const indexesByValue = new Map<number, number[]>();
        dice.forEach((value, index) => {
            if (player.diceUsed.includes(index)) {
                return;
            }
            if (!indexesByValue.has(value)) {
                indexesByValue.set(value, []);
            }
            const indexes = indexesByValue.get(value)!;
            indexes.push(index);
            indexesByValue.set(value, indexes);
        });
        const candidates = Array.from(indexesByValue.entries())
            .filter(([, indexes]) => {
            return indexes.length >= requiredCount;
        })
            .map(([value, indexes]) => {
            return ({ value, indexes: indexes.slice(0, requiredCount) });
        });
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
        if (!candidates.length) {
            return [];
        }
        return candidates[0].indexes;
    }
    // 计算骰子索引之和用于稳定排序。
    private sumIndexes(indexes: readonly number[]): number {
        return indexes.reduce((total, index) => {
            return total + index;
        }, 0);
    }
}
