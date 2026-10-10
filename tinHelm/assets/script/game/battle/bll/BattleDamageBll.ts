import { BattleTriggerEvent } from './BattleCardBll';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleSide } from '../model/BattleTypes';
export class BattleDamageBll extends CCBusiness<Battle> {
    // 等待受伤、装备触发和反击完成，保证同一次伤害不会与下一段结算交错。
    async applyDamage(source: BattleSide, target: BattleSide, amount: number, kind = 'ATTACK', ignoreBlock = false, context?: BattleContext): Promise<number> {
        const runId = this.ent.BattleModel.runId;
        if (this.ent.BattleBll.isBattleFinished()) {
            return 0;
        }
        const resolver = this.ent.BattleValueResolver;
        const actor = resolver.getActor(target);
        let damage = Math.max(0, amount);
        if (kind === 'ATTACK') {
            damage = Math.max(0, damage + resolver.getBuffStacks(source, BattleBuffTypeEnum.STRENGTH));
            damage *= resolver.getBuffStacks(source, BattleBuffTypeEnum.WEAK) > 0 ? 0.75 : 1;
            damage *= resolver.getBuffStacks(target, BattleBuffTypeEnum.VULNERABLE) > 0 ? 1.5 : 1;
        }
        damage = this.ent.BattleBuffBll.calculateIncomingDamage(target, damage, kind);
        if (kind !== 'HP_LOSS' && resolver.getBuffStacks(target, BattleBuffTypeEnum.INTANGIBLE) > 0) {
            damage = Math.min(damage, 1);
        }
        damage = Math.max(0, Math.floor(damage));
        const attackDamage = damage;
        if (!ignoreBlock && kind !== 'HP_LOSS') {
            const blocked = Math.min(actor.block, damage);
            actor.block -= blocked;
            damage -= blocked;
        }
        const hpLoss = Math.min(actor.hp, damage);
        actor.hp -= hpLoss;
        this.ent.BattleBll.refreshBattleView();
        // 致死伤害立即确定结果，不允许受伤触发器将死亡单位复活。
        if (this.ent.BattleBll.checkResult()) {
            return hpLoss;
        }
        if (hpLoss > 0) {
            if (kind === 'ATTACK') {
                this.ent.BattleBuffBll.applyAttackHpLoss(target);
            }
            if (target === BattleSide.Enemy) {
                if (kind === 'ATTACK') {
                    this.ent.BattleEnemyModel.hitsTaken++;
                }
                await this.ent.BattleEnemyMechanicBll.updatePhases();
                if (this.ent.BattleBll.isBattleFinished(runId)) {
                    return hpLoss;
                }
            }
            const event = { amount: hpLoss, damage: hpLoss, source, target, damageKind: kind };
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.DamageDealt, source, event);
            if (this.ent.BattleBll.isBattleFinished(runId)) {
                return hpLoss;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.DamageTaken, target, event);
            if (this.ent.BattleBll.isBattleFinished(runId)) {
                return hpLoss;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.HpLoss, target, event);
        }
        if (context?.cardPlay && kind === 'ATTACK' && !this.ent.BattleBll.isBattleFinished(runId)) {
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CardDamageDealt, source, { cardId: context.cardId, amount: hpLoss, damage: attackDamage, source, target, damageKind: kind });
        }
        const thorns = resolver.getBuffStacks(target, BattleBuffTypeEnum.THORNS);
        if (!this.ent.BattleBll.isBattleFinished(runId) && kind === 'ATTACK' && thorns > 0 && source !== target) {
            await this.applyDamage(target, source, thorns, 'THORNS');
        }
        return hpLoss;
    }
    // 结算敏捷与脆弱后增加格挡。
    addBlock(side: BattleSide, amount: number, scale = true): number {
        const resolver = this.ent.BattleValueResolver;
        let value = Math.max(0, amount + (scale ? resolver.getBuffStacks(side, BattleBuffTypeEnum.DEXTERITY) : 0));
        if (scale && resolver.getBuffStacks(side, BattleBuffTypeEnum.FRAIL) > 0) {
            value *= 0.75;
        }
        const gained = Math.floor(value);
        resolver.getActor(side).block += gained;
        return gained;
    }
    // 为存活角色回复生命且不超过上限。
    restoreHp(side: BattleSide, amount: number): void {
        const actor = this.ent.BattleValueResolver.getActor(side);
        if (actor.hp > 0) {
            actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(0, Math.floor(amount)));
        }
    }
}
