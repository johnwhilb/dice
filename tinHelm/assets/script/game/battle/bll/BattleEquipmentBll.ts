import { BattleTriggerEvent } from './BattleCardBll';
import { BattleEffectTypeEnum } from '../../common/table/BattleEffectTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleEnergyEvent, BattleSide } from '../model/BattleTypes';
import { TableEquipment } from '../../common/table/TableEquipment';
import { smc } from '../../common/SingletonModuleComp';
/** 装备配置在战斗开始时注册，不硬编码装备编号或独立招式。 */
export class BattleEquipmentBll extends CCBusiness<Battle> {
    // 等待每件装备初始化与触发器注册完成，确保首回合能量和抽牌效果已经可用。
    async initializeEquipment(): Promise<void> {
        const equipmentIds = smc.player.PlayerModel.equipmentIds;
        const slots = equipmentIds.map((id, index) => {
            return { id, index };
        });
        for (const { id, index } of slots) {
            const equipment = TableEquipment.getConfigById(id)!;
            const effects = equipment.battleEffects;
            this.ent.BattleEffectBll.validateEffects(effects);
            const context = this.ent.BattleValueResolver.createContext(BattleSide.Player);
            context.equipmentKey = 'equipment' + id + 'Slot' + index;
            // 生命上限已由穿戴接口写入冒险属性，避免每场战斗再次增长。
            await this.ent.BattleEffectBll.executeEffects(effects.filter(effect => {
                return !(effect.type === BattleEffectTypeEnum.MODIFY_STAT && effect.target === 'SELF'
                    && effect.params.stat === 'MAX_HP' && !effect.condition && !effect.trigger);
            }), context);
            if (this.ent.BattleBll.isBattleFinished(context.runId)) {
                return;
            }
        }
    }
    // 初始化本回合的装备次数和卡牌计数。
    beginTurn(): void {
        const player = this.ent.BattlePlayerModel;
        player.cardsPlayed = 0;
        player.attacksPlayed = 0;
        player.handLimit = player.baseHandLimit;
        if (player.freeDiceExpiresTurn < this.ent.BattleModel.turn) {
            player.freeDiceCards = player.combatFreeDiceCards;
        }
    }
    // 修改卡牌基础加成或下一张卡牌的数值。
    modifyCardValue(kind: string, amount: number, timing: string): void {
        const player = this.ent.BattlePlayerModel;
        if (kind === 'DAMAGE') {
            if (timing === 'NEXT_CARD') {
                player.nextCardDamageBonus += amount;
            }
            else {
                player.cardDamageBonus += amount;
            }
        }
        else if (kind === 'BLOCK') {
            if (timing === 'NEXT_CARD') {
                player.nextCardBlockBonus += amount;
            }
            else {
                player.cardBlockBonus += amount;
            }
        }
        else {
            throw new Error('不支持的卡牌数值：' + kind);
        }
    }
    // 增加本回合或战斗期间的免骰次数。
    grantFreeDice(count: number, scope: string): void {
        const player = this.ent.BattlePlayerModel;
        const charges = Math.max(0, Math.floor(count));
        player.freeDiceCards += charges;
        if (scope === 'COMBAT') {
            player.combatFreeDiceCards += charges;
        }
        else {
            player.freeDiceExpiresTurn = this.ent.BattleModel.turn;
        }
    }
    // 等待能量变化和实际消耗事件完成，装备造成的伤害、护盾与回能依次结算。
    async changeEnergy(amount: number, reason: string): Promise<number> {
        const player = this.ent.BattlePlayerModel;
        const previous = player.energy;
        player.energy = Math.max(0, Math.min(player.maxEnergy, previous + Math.trunc(amount)));
        const change = player.energy - previous;
        if (!change) {
            return 0;
        }
        const context = this.ent.BattleValueResolver.createContext(BattleSide.Player);
        const event: BattleEnergyEvent = { previous, current: player.energy, amount: change, spent: Math.max(0, -change), reason };
        await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.EnergyChanged, BattleSide.Player, event);
        if (change < 0 && !this.ent.BattleBll.isBattleFinished(context.runId)) {
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.EnergySpent, BattleSide.Player, event);
        }
        this.ent.BattleBll.refreshBattleView();
        return change;
    }
}
