import { CardEvent, BattleTriggerEvent } from './BattleCardBll';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleEffect, BattleSide, BattleTrigger, BattleEventData } from '../model/BattleTypes';
export class BattleTriggerBll extends CCBusiness<Battle> {
    // 注册事件监听、使用次数和生效范围。
    registerTrigger(event: BattleTriggerEvent, effects: BattleEffect[], context: BattleContext, scope = 'COMBAT', limit = 0, filter: BattleEventData = {}, dueTurn = 0, listenSide = context.source): void {
        if (!Object.values(BattleTriggerEvent).includes(event)) {
            throw new Error(`战斗触发事件无效：${event}`);
        }
        const trigger: BattleTrigger = {
            owner: listenSide, event, effects,
            context: { ...context, cardPlay: false, variables: { ...context.variables }, event: {} },
            filter, remaining: limit > 0 ? limit : -1, scope,
            expiresTurn: this.ent.BattleModel.turn + (scope === 'NEXT_TURN' ? 1 : 0),
            dueTurn, active: false
        };
        this.ent.BattleModel.triggers.push(trigger);
    }
    // 注册指定时机执行的延迟效果。
    scheduleEffects(when: string, times: number, effects: BattleEffect[], context: BattleContext): void {
        const events: Record<string, BattleTriggerEvent> = {
            NEXT_TURN_START: BattleTriggerEvent.TurnStart, NEXT_TURN_END: BattleTriggerEvent.TurnEnd,
            TURN_END: BattleTriggerEvent.TurnEnd, COMBAT_END: BattleTriggerEvent.CombatEnd, AFTER_ENEMY_TURN: BattleTriggerEvent.AfterEnemyTurn
        };
        const event = events[when];
        if (!event) {
            throw new Error(`未知延迟时机：${when}`);
        }
        this.registerTrigger(event, effects, context, 'COMBAT', Math.max(1, times), {}, this.ent.BattleModel.turn + (when.startsWith('NEXT_') ? 1 : 0));
    }
    // 等待事件监听与卡牌响应按顺序结算。
    async fireEvent(event: BattleTriggerEvent, owner: BattleSide, data: BattleEventData = {}): Promise<void> {
        const model = this.ent.BattleModel;
        const runId = model.runId;
        // 快照避免本次事件中新注册的监听器立即触发；active 防止反击互相递归。
        for (const trigger of [...model.triggers]) {
            if (runId !== model.runId) {
                return;
            }
            if (this.ent.BattleBll.isBattleFinished() && event !== BattleTriggerEvent.CombatEnd && event !== BattleTriggerEvent.EnemyDied) {
                break;
            }
            if (trigger.event !== event || trigger.owner !== owner || trigger.active
                || trigger.remaining === 0 || trigger.dueTurn > model.turn) {
                continue;
            }
            if (!Object.entries(trigger.filter).every(([key, value]) => {
                return data[key] === value;
            })) {
                continue;
            }
            trigger.active = true;
            if (trigger.remaining > 0) {
                trigger.remaining--;
            }
            await (async () => {
                await this.ent.BattleEffectBll.executeEffects(trigger.effects, {
                    ...trigger.context, variables: { ...trigger.context.variables }, event: data
                }, event === BattleTriggerEvent.CombatEnd || event === BattleTriggerEvent.EnemyDied);
            })().finally(() => {
                trigger.active = false;
            });
        }
        if (runId !== model.runId) {
            return;
        }
        model.triggers = model.triggers.filter(trigger => {
            return trigger.remaining !== 0;
        });
        if (event === BattleTriggerEvent.CombatStart) {
            await this.ent.BattleCardBll.triggerCards(CardEvent.CombatStart, owner);
        }
    }
    // 移除当前回合到期的临时事件监听。
    expireTriggers(owner: BattleSide): void {
        const model = this.ent.BattleModel;
        model.triggers = model.triggers.filter(trigger => {
            return trigger.owner !== owner
                || !(['TURN', 'NEXT_TURN'].includes(trigger.scope) && trigger.expiresTurn <= model.turn);
        });
    }
}
