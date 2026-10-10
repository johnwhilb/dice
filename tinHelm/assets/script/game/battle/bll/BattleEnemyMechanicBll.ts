import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide, EnemyPhaseCondition } from '../model/BattleTypes';
/** 所有敌人共用机制执行器，具体状态、触发器和阶段均由配置表提供。 */
export class BattleEnemyMechanicBll extends CCBusiness<Battle> {
    // 根据敌人配置注册初始状态与特殊事件。
    initializeMechanics(): void {
        const model = this.ent.BattleEnemyModel;
        const enemy = TableEnemy.getConfigById(model.enemyId)!;
        const mechanics = enemy.getMechanics();
        for (const initial of mechanics.initialStatuses) {
            this.ent.BattleBuffBll.addBuff(BattleSide.Enemy, initial.status, initial.stacks, initial.duration);
        }
        const context = this.ent.BattleValueResolver.createContext(BattleSide.Enemy, 0, BattleSide.Player);
        for (const trigger of mechanics.triggers) {
            this.ent.BattleEffectBll.validateEffects(trigger.effects);
            this.ent.BattleTriggerBll.registerTrigger(trigger.event, trigger.effects, context, 'COMBAT', trigger.limit, trigger.filter, 0, trigger.listenSide);
        }
    }
    // 等待满足阈值的阶段效果依次结算。
    updatePhases(): Promise<void> {
        const model = this.ent.BattleEnemyModel;
        const battle = this.ent.BattleModel;
        if (model.changingPhase || this.ent.BattleBll.isBattleFinished()) {
            return Promise.resolve();
        }
        const enemy = TableEnemy.getConfigById(model.enemyId)!;
        const phases = enemy.getMechanics().phases;
        const runId = battle.runId;
        model.changingPhase = true;
        return (async () => {
            // 配置顺序决定阶段优先级；大伤害跨过多个阈值时依次进入各阶段。
            for (const phase of phases) {
                if (model.enteredPhases.includes(phase.id)) {
                    continue;
                }
                const reached = phase.condition === EnemyPhaseCondition.HpBelow
                    ? model.hp / Math.max(1, model.maxHp) * 100 <= phase.value
                    : phase.condition === EnemyPhaseCondition.TurnAtLeast
                        ? battle.turn >= phase.value : model.hitsTaken >= phase.value;
                if (!reached) {
                    continue;
                }
                model.enteredPhases.push(phase.id);
                model.phaseName = phase.name;
                model.phaseStartTurn = battle.turn;
                model.repeatCount = 0;
                model.lastMoveId = '';
                if (phase.behavior) {
                    model.phaseBehavior = phase.behavior;
                }
                this.ent.BattleEffectBll.validateEffects(phase.effects);
                await this.ent.BattleEffectBll.executeEffects(phase.effects, this.ent.BattleValueResolver.createContext(BattleSide.Enemy, 0, BattleSide.Player));
                if (this.ent.BattleBll.isBattleFinished(runId)) {
                    return;
                }
                this.ent.BattleEnemyBll.planAction();
                this.ent.BattleBll.refreshBattleView();
            }
        })().finally(() => {
            if (runId === battle.runId) {
                model.changingPhase = false;
            }
        });
    }
}
