import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleEffect, BattleSide, BattleTrigger } from '../model/BattleTypes';

export class BattleTriggerBll extends CCBusiness<Battle> {
    register(event: string, effects: BattleEffect[], context: BattleContext, scope = 'COMBAT', limit = 0,
        filter: Record<string, unknown> = {}, dueTurn = 0) {
        const trigger: BattleTrigger = {
            owner: context.source, event, effects,
            context: { ...context, variables: { ...context.variables }, event: {} },
            filter, remaining: limit > 0 ? limit : -1, scope,
            expiresTurn: this.ent.BattleModel.turn + (scope === 'NEXT_TURN' ? 1 : 0),
            dueTurn, active: false
        };
        this.ent.BattleModel.triggers.push(trigger);
    }

    schedule(when: string, times: number, effects: BattleEffect[], context: BattleContext) {
        const events: Record<string, string> = {
            NEXT_TURN_START: 'ON_TURN_START', NEXT_TURN_END: 'ON_TURN_END',
            TURN_END: 'ON_TURN_END', COMBAT_END: 'ON_COMBAT_END', AFTER_ENEMY_TURN: 'AFTER_ENEMY_TURN'
        };
        const event = events[when];
        if (!event) {
            throw new Error(`未知延迟时机：${when}`);
        }
        this.register(event, effects, context, 'COMBAT', Math.max(1, times), {},
            this.ent.BattleModel.turn + (when.startsWith('NEXT_') ? 1 : 0));
    }

    async fire(event: string, owner: BattleSide, data: Record<string, unknown> = {}) {
        const model = this.ent.BattleModel;
        const runId = model.runId;
        // 快照避免本次事件中新注册的监听器立即触发；active 防止反击互相递归。
        for (const trigger of [...model.triggers]) {
            if (runId !== model.runId) {
                return;
            }
            if (this.ent.BattleBll.isFinished() && event !== 'ON_COMBAT_END' && event !== 'ON_ENEMY_DIED') {
                break;
            }
            if (trigger.event !== event || trigger.owner !== owner || trigger.active
                || trigger.remaining === 0 || trigger.dueTurn > model.turn) {
                continue;
            }
            if (!Object.entries(trigger.filter).every(([key, value]) => data[key] === value)) {
                continue;
            }
            trigger.active = true;
            if (trigger.remaining > 0) {
                trigger.remaining--;
            }
            try {
                await this.ent.BattleEffectBll.execute(trigger.effects, {
                    ...trigger.context, variables: { ...trigger.context.variables }, event: data
                }, event === 'ON_COMBAT_END' || event === 'ON_ENEMY_DIED');
            } finally {
                trigger.active = false;
            }
        }
        if (runId !== model.runId) {
            return;
        }
        model.triggers = model.triggers.filter(trigger => trigger.remaining !== 0);
        await this.ent.BattleCardBll.triggerCards(event, owner);
    }

    expire(owner: BattleSide) {
        const model = this.ent.BattleModel;
        model.triggers = model.triggers.filter(trigger => trigger.owner !== owner
            || !(['TURN', 'NEXT_TURN'].includes(trigger.scope) && trigger.expiresTurn <= model.turn));
    }
}
