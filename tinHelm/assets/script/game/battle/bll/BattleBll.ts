import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleEvent } from '../BattleEvent';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide } from '../model/BattleTypes';
import { smc } from '../../common/SingletonModuleComp';

export class BattleBll extends CCBusiness<Battle> {
    async start() {
        const model = this.ent.BattleModel;
        const enemyId = model.enemyId;
        model.reset();
        const runId = ++model.runId;
        model.enemyId = enemyId;
        model.gold = smc.player.PlayerModel.gold;
        model.busy = true;
        try {
            this.ent.initBattleSceneInfo();
            await this.ent.BattleTriggerBll.fire('ON_COMBAT_START', BattleSide.Player);
            await this.playerStart(runId);
        } catch (error) {
            if (runId === model.runId) {
                this.fail(error);
            }
        } finally {
            if (runId === model.runId) {
                model.busy = false;
                await this.finishResult();
                this.refresh();
            }
        }
    }

    async changePhase() {
        await this.endTurn();
    }

    async endTurn() {
        const model = this.ent.BattleModel;
        if (model.busy || model.shownCardPile || model.phase !== BattlePhase.PlayerAction || this.isFinished()) {
            return;
        }
        model.busy = true;
        model.message = '';
        const runId = model.runId;
        try {
            this.setPhase(BattlePhase.PlayerEnd);
            await this.ent.BattleCardBll.endTurn();
            await this.endEffects(BattleSide.Player, runId);
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyStart);
            await this.ent.BattleBuffBll.startTurn(BattleSide.Enemy);
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fire('ON_TURN_START', BattleSide.Enemy);
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyAction);
            await this.ent.BattleEnemyBll.attack();
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyEnd);
            await this.endEffects(BattleSide.Enemy, runId);
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fire('AFTER_ENEMY_TURN', BattleSide.Player);
            if (this.checkResult(runId)) {
                return;
            }
            model.turn++;
            await this.playerStart(runId);
        } catch (error) {
            if (runId === model.runId) {
                this.fail(error);
            }
        } finally {
            if (runId === model.runId) {
                model.busy = false;
                await this.finishResult();
                this.refresh();
            }
        }
    }

    private async endEffects(side: BattleSide, runId: number) {
        if (!this.isFinished(runId)) {
            await this.ent.BattleTriggerBll.fire('ON_TURN_END', side);
            if (this.isFinished(runId)) {
                return;
            }
            await this.ent.BattleBuffBll.endTurn(side);
            this.ent.BattleTriggerBll.expire(side);
        }
    }

    private async playerStart(runId: number) {
        if (this.checkResult(runId)) {
            return;
        }
        const player = this.ent.BattlePlayerModel;
        this.setPhase(BattlePhase.PlayerStart);
        this.ent.BattleModel.turnVariables = {};
        player.turn = this.ent.BattleModel.turn;
        player.energy = player.maxEnergy;
        await this.ent.BattleBuffBll.startTurn(BattleSide.Player);
        if (this.checkResult(runId)) {
            return;
        }
        await this.ent.BattleTriggerBll.fire('ON_TURN_START', BattleSide.Player);
        if (this.checkResult(runId)) {
            return;
        }
        await this.ent.BattleCardBll.fillHand();
        if (this.checkResult(runId)) {
            return;
        }
        player.diceLocked = [];
        player.rerolls = 2;
        this.ent.BattleDiceBll.resetDice();
        this.setPhase(BattlePhase.PlayerRollDice);
    }

    reroll() {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        if (model.busy || model.shownCardPile || model.phase !== BattlePhase.PlayerAction || player.rerolls <= 0
            || player.diceLocked.length >= player.dice.length || this.isFinished()) {
            return false;
        }
        player.rerolls--;
        model.message = '';
        this.ent.BattleDiceBll.resetDice();
        this.setPhase(BattlePhase.PlayerRollDice);
        return true;
    }

    finishRoll() {
        if (this.ent.BattleModel.phase === BattlePhase.PlayerRollDice && !this.isFinished()) {
            this.setPhase(BattlePhase.PlayerAction);
        }
    }

    isFinished(runId = this.ent.BattleModel.runId) {
        const model = this.ent.BattleModel;
        return runId !== model.runId || model.closed || model.phase === BattlePhase.Victory || model.phase === BattlePhase.Defeat;
    }

    checkResult(runId = this.ent.BattleModel.runId) {
        if (this.isFinished(runId)) {
            return true;
        }
        if (this.ent.BattlePlayerModel.hp <= 0) {
            this.setPhase(BattlePhase.Defeat);
        } else if (this.ent.BattleEnemyModel.hp <= 0) {
            this.setPhase(BattlePhase.Victory);
        }
        return this.isFinished();
    }

    async finishResult() {
        const model = this.ent.BattleModel;
        if (model.closed || !this.isFinished() || model.resultHandled) {
            return;
        }
        model.resultHandled = true;
        this.cancelChoice();
        if (model.phase === BattlePhase.Victory) {
            await this.ent.BattleTriggerBll.fire('ON_ENEMY_DIED', BattleSide.Player);
        }
        await this.ent.BattleTriggerBll.fire('ON_COMBAT_END', BattleSide.Player);
        await this.ent.BattleTriggerBll.fire('ON_COMBAT_END', BattleSide.Enemy);
        smc.player.PlayerModel.hp = this.ent.BattlePlayerModel.hp;
        smc.player.PlayerModel.gold = model.gold;
        model.triggers = [];
        this.refresh();
    }

    close() {
        this.ent.BattleModel.closed = true;
        this.cancelChoice();
    }

    leaveResult() {
        const model = this.ent.BattleModel;
        if (model.busy || !this.isFinished()) {
            return;
        }
        const phase = model.phase;
        this.ent.closeBattleView();
        if (phase === BattlePhase.Victory) {
            smc.gameFlow.advanceLevel();
        } else if (phase === BattlePhase.Defeat) {
            smc.gameFlow.GameFlowBll.startNewGame();
        }
    }

    private cancelChoice() {
        const choice = this.ent.BattleModel.choice;
        this.ent.BattleModel.choice = null;
        choice?.resolve(-1);
    }

    fail(error: unknown) {
        this.ent.BattleModel.message = error instanceof Error ? error.message : String(error);
        this.ent.BattleModel.closed = true;
        this.cancelChoice();
        console.error('战斗结算失败', error);
    }

    refresh() {
        this.dispatchEvent(BattleEvent.refreshBattlePhase);
    }

    private setPhase(phase: BattlePhase) {
        this.ent.BattleModel.phase = phase;
        this.refresh();
    }

    generateEnemy() {
        const enemyId = this.ent.BattleModel.enemyId;
        this.ent.BattleEnemyModel.enemyId = TableEnemy.getConfigById(enemyId) ? enemyId : TableEnemy.createId(1);
    }
}
