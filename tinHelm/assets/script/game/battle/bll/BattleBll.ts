import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleEvent } from '../BattleEvent';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide } from '../model/BattleTypes';
import { smc } from '../../common/SingletonModuleComp';
import { PlayerEvent } from '../../player/PlayerEvent';

export class BattleBll extends CCBusiness<Battle> {
    // 等待装备初始化、战斗开始触发与首回合准备完成后开放操作。
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
            await this.ent.BattleEquipmentBll.initialize();
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fire('ON_COMBAT_START', BattleSide.Enemy);
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
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.isFinished()) {
            return;
        }
        model.busy = true;
        model.message = '';
        const runId = model.runId;
        try {
            this.setPhase(BattlePhase.PlayerEnd);
            await this.ent.BattleCardBll.endTurn();
            await this.endEffects(BattleSide.Player, runId);
            this.ent.BattlePlayerModel.energy = 0;
            this.ent.BattlePlayerModel.diceUsed = [];
            this.ent.BattlePlayerModel.diceLocked = [];
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
            await this.ent.BattleEnemyBll.act();
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

    // 等待回合开始状态、正常补手牌和装备额外抽牌结算完成。
    private async playerStart(runId: number) {
        if (this.checkResult(runId)) {
            return;
        }
        const player = this.ent.BattlePlayerModel;
        this.setPhase(BattlePhase.PlayerStart);
        this.ent.BattleModel.turnVariables = {};
        player.turn = this.ent.BattleModel.turn;
        this.ent.BattleEquipmentBll.beginTurn();
        player.energy = Math.min(player.baseEnergy, player.maxEnergy);
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
        await this.ent.BattleTriggerBll.fire('ON_HAND_READY', BattleSide.Player);
        if (this.checkResult(runId)) {
            return;
        }
        player.diceLocked = [];
        player.diceUsed = [];
        await this.ent.BattleEnemyMechanicBll.updatePhases();
        if (this.checkResult(runId)) {
            return;
        }
        this.ent.BattleEnemyBll.planAction();
        this.ent.BattleDiceBll.resetDice();
        this.setPhase(BattlePhase.PlayerAction);
    }

    reroll() {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        const selected = player.diceLocked[0];
        if (model.busy || model.phase !== BattlePhase.PlayerAction || player.energy < 2
            || player.diceLocked.length !== 1 || this.isFinished()) {
            return false;
        }
        if (player.diceUsed.includes(selected)) {
            return this.activateUsedDie(selected);
        }
        if (!this.ent.BattleDiceBll.rollOne(selected)) {
            return false;
        }
        player.diceLocked = [];
        model.message = '';
        this.setPhase(BattlePhase.PlayerAction);
        return this.payForDice();
    }

    activateUsedDie(index: number) {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || player.energy < 2
            || !player.diceUsed.includes(index) || this.isFinished()
            || !this.ent.BattleDiceBll.rollOne(index)) {
            if (model.phase === BattlePhase.PlayerAction && player.diceUsed.includes(index) && player.energy < 2) {
                model.message = '激活失活骰子需要2点能量';
                this.refresh();
            }
            return false;
        }
        player.diceLocked = [];
        player.diceUsed = player.diceUsed.filter(usedIndex => usedIndex !== index);
        model.message = '';
        this.setPhase(BattlePhase.PlayerAction);
        return this.payForDice();
    }

    // 等待重投或激活的能量触发效果与胜负结算，期间锁定操作避免重复扣费。
    private async payForDice() {
        const model = this.ent.BattleModel;
        const runId = model.runId;
        model.busy = true;
        try {
            await this.ent.BattleEquipmentBll.changeEnergy(-2, 'DICE');
            await this.finishResult();
            return true;
        } catch (error) {
            if (model.runId === runId) {
                this.fail(error);
            }
            return false;
        } finally {
            if (model.runId === runId) {
                model.busy = false;
                this.refresh();
            }
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
        const runId = model.runId;
        model.resultHandled = true;
        model.busy = true;
        try {
            this.cancelChoice();
            if (model.phase === BattlePhase.Victory) {
                await this.ent.BattleTriggerBll.fire('ON_ENEMY_DIED', BattleSide.Player);
            }
            await this.ent.BattleTriggerBll.fire('ON_COMBAT_END', BattleSide.Player);
            await this.ent.BattleTriggerBll.fire('ON_COMBAT_END', BattleSide.Enemy);
            if (model.closed || model.runId !== runId) {
                return;
            }
            smc.player.PlayerModel.hp = this.ent.BattlePlayerModel.hp;
            smc.player.PlayerModel.gold = model.gold;
            this.dispatchEvent(PlayerEvent.statsChanged);
            model.triggers = [];
            if (model.phase === BattlePhase.Victory) {
                this.ent.BattleRewardBll.prepare();
                await this.ent.openBattleCleadupDialog();
            }
        }
        finally {
            if (model.runId === runId) {
                model.busy = false;
                this.refresh();
            }
        }
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
        if (model.phase === BattlePhase.Victory && !model.rewardsDismissed) {
            this.ent.BattleRewardBll.prepare();
            this.ent.openBattleCleadupDialog();
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
