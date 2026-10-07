import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide, EnemyPhaseCondition } from '../model/BattleTypes';

/** 所有敌人共用机制执行器，具体状态、触发器和阶段均由配置表提供。 */
export class BattleEnemyMechanicBll extends CCBusiness<Battle> {
    initialize() {
        const model = this.ent.BattleEnemyModel;
        const mechanics = TableEnemy.getConfigById(model.enemyId)?.getMechanics();
        if (!mechanics) {
            return;
        }
        for (const initial of mechanics.initialStatuses) {
            this.ent.BattleBuffBll.add(BattleSide.Enemy, initial.status, initial.stacks, initial.duration || 'COMBAT');
        }
        const context = this.ent.BattleValueResolver.context(BattleSide.Enemy, 0, BattleSide.Player);
        for (const trigger of mechanics.triggers) {
            this.ent.BattleEffectBll.validate(trigger.effects);
            this.ent.BattleTriggerBll.register(trigger.event, trigger.effects, context, 'COMBAT',
                trigger.limit || 0, trigger.filter || {}, 0, trigger.listenSide || BattleSide.Enemy);
        }
    }

    async updatePhases() {
        const model = this.ent.BattleEnemyModel;
        const battle = this.ent.BattleModel;
        if (model.changingPhase || this.ent.BattleBll.isFinished()) {
            return;
        }
        const phases = TableEnemy.getConfigById(model.enemyId)?.getMechanics().phases || [];
        const runId = battle.runId;
        model.changingPhase = true;
        try {
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
                this.ent.BattleEffectBll.validate(phase.effects);
                await this.ent.BattleEffectBll.execute(phase.effects,
                    this.ent.BattleValueResolver.context(BattleSide.Enemy, 0, BattleSide.Player));
                if (this.ent.BattleBll.isFinished(runId)) {
                    return;
                }
                this.ent.BattleEnemyBll.planAction();
                this.ent.BattleBll.refresh();
            }
        }
        finally {
            if (runId === battle.runId) {
                model.changingPhase = false;
            }
        }
    }
}
