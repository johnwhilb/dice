import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleSide } from '../model/BattleTypes';

export class BattleDamageBll extends CCBusiness<Battle> {
    // 等待受伤、装备触发和反击完成，保证同一次伤害不会与下一段结算交错。
    async damage(source: BattleSide, target: BattleSide, amount: number, kind = 'ATTACK', ignoreBlock = false, context?: BattleContext) {
        const runId = this.ent.BattleModel.runId;
        if (this.ent.BattleBll.isFinished()) {
            return 0;
        }
        const resolver = this.ent.BattleValueResolver;
        const actor = resolver.actor(target);
        let damage = Math.max(0, amount);
        if (kind === 'ATTACK') {
            damage = Math.max(0, damage + resolver.stacks(source, 'STRENGTH'));
            damage *= resolver.stacks(source, 'WEAK') > 0 ? 0.75 : 1;
            damage *= resolver.stacks(target, 'VULNERABLE') > 0 ? 1.5 : 1;
        }
        damage = this.ent.BattleBuffBll.incomingDamage(target, damage, kind);
        if (kind !== 'HP_LOSS' && resolver.stacks(target, 'INTANGIBLE') > 0) {
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
        this.ent.BattleBll.refresh();
        // 致死伤害立即确定结果，不允许受伤触发器将死亡单位复活。
        if (this.ent.BattleBll.checkResult()) {
            return hpLoss;
        }
        if (hpLoss > 0) {
            if (kind === 'ATTACK') {
                this.ent.BattleBuffBll.attackHpLoss(target);
            }
            if (target === BattleSide.Enemy) {
                if (kind === 'ATTACK') {
                    this.ent.BattleEnemyModel.hitsTaken++;
                }
                await this.ent.BattleEnemyMechanicBll.updatePhases();
                if (this.ent.BattleBll.isFinished(runId)) {
                    return hpLoss;
                }
            }
            const event = { amount: hpLoss, damage: hpLoss, source, target, damageKind: kind };
            await this.ent.BattleTriggerBll.fire('ON_DAMAGE_DEALT', source, event);
            if (this.ent.BattleBll.isFinished(runId)) {
                return hpLoss;
            }
            await this.ent.BattleTriggerBll.fire('ON_DAMAGE_TAKEN', target, event);
            if (this.ent.BattleBll.isFinished(runId)) {
                return hpLoss;
            }
            await this.ent.BattleTriggerBll.fire('ON_HP_LOSS', target, event);
        }
        if (context?.cardPlay && kind === 'ATTACK' && !this.ent.BattleBll.isFinished(runId)) {
            await this.ent.BattleTriggerBll.fire('ON_CARD_DAMAGE_DEALT', source,
                { cardId: context.cardId, amount: hpLoss, damage: attackDamage, source, target, damageKind: kind });
        }
        const thorns = resolver.stacks(target, 'THORNS');
        if (!this.ent.BattleBll.isFinished(runId) && kind === 'ATTACK' && thorns > 0 && source !== target) {
            await this.damage(target, source, thorns, 'THORNS');
        }
        return hpLoss;
    }

    block(side: BattleSide, amount: number, scale = true) {
        const resolver = this.ent.BattleValueResolver;
        let value = Math.max(0, amount + (scale ? resolver.stacks(side, 'DEXTERITY') : 0));
        if (scale && resolver.stacks(side, 'FRAIL') > 0) {
            value *= 0.75;
        }
        const gained = Math.floor(value);
        resolver.actor(side).block += gained;
        return gained;
    }

    heal(side: BattleSide, amount: number) {
        const actor = this.ent.BattleValueResolver.actor(side);
        if (actor.hp > 0) {
            actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(0, Math.floor(amount)));
        }
    }
}
