import { BattleTriggerEvent } from './BattleCardBll';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattlePhase } from '../model/BattleModel';
import { BattleEvent } from '../BattleEvent';
import { BattleSide } from '../model/BattleTypes';
import { smc } from '../../common/SingletonModuleComp';
import { PlayerEvent } from '../../player/PlayerEvent';
export class BattleBll extends CCBusiness<Battle> {
    // 等待装备初始化、战斗开始触发与首回合准备完成后开放操作。
    startBattle(): Promise<void> {
        const model = this.ent.BattleModel;
        const enemyId = model.enemyId;
        model.reset();
        const runId = ++model.runId;
        model.enemyId = enemyId;
        model.gold = smc.player.PlayerModel.gold;
        model.busy = true;
        return (async () => {
            this.ent.initBattleSceneInfo();
            await this.ent.BattleEquipmentBll.initializeEquipment();
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CombatStart, BattleSide.Enemy);
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CombatStart, BattleSide.Player);
            await this.startPlayerTurn(runId);
        })().catch((error: Error) => {
            if (runId === model.runId) {
                this.handleBattleError(error);
            }
        }).finally(async () => {
            if (runId === model.runId) {
                model.busy = false;
                await this.finishResult();
                this.refreshBattleView();
            }
        });
    }
    // 转交玩家结束回合的结算任务。
    changePhase(): Promise<void> {
        return this.endPlayerTurn();
    }
    // 等待手牌、状态、敌人行动和下一回合准备依次完成。
    endPlayerTurn(): Promise<void> {
        const model = this.ent.BattleModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.isBattleFinished()) {
            return Promise.resolve();
        }
        model.busy = true;
        model.message = '';
        const runId = model.runId;
        return (async () => {
            this.setPhase(BattlePhase.PlayerEnd);
            await this.ent.BattleCardBll.settleHandAtTurnEnd();
            await this.settleTurnEndEffects(BattleSide.Player, runId);
            this.ent.BattlePlayerModel.energy = 0;
            this.ent.BattlePlayerModel.diceUsed = [];
            this.ent.BattlePlayerModel.diceLocked = [];
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyStart);
            await this.ent.BattleBuffBll.settleTurnStartBuffs(BattleSide.Enemy);
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.TurnStart, BattleSide.Enemy);
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyAction);
            await this.ent.BattleEnemyBll.executePlannedActions();
            if (this.checkResult(runId)) {
                return;
            }
            this.setPhase(BattlePhase.EnemyEnd);
            await this.settleTurnEndEffects(BattleSide.Enemy, runId);
            if (this.checkResult(runId)) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.AfterEnemyTurn, BattleSide.Player);
            if (this.checkResult(runId)) {
                return;
            }
            model.turn++;
            await this.startPlayerTurn(runId);
        })().catch((error: Error) => {
            if (runId === model.runId) {
                this.handleBattleError(error);
            }
        }).finally(async () => {
            if (runId === model.runId) {
                model.busy = false;
                await this.finishResult();
                this.refreshBattleView();
            }
        });
    }
    // 等待回合末事件和状态效果结算后清理临时触发器。
    private async settleTurnEndEffects(side: BattleSide, runId: number): Promise<void> {
        if (!this.isBattleFinished(runId)) {
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.TurnEnd, side);
            if (this.isBattleFinished(runId)) {
                return;
            }
            await this.ent.BattleBuffBll.settleTurnEndBuffs(side);
            this.ent.BattleTriggerBll.expireTriggers(side);
        }
    }
    // 等待回合开始状态、正常补手牌和装备额外抽牌结算完成。
    private async startPlayerTurn(runId: number): Promise<void> {
        if (this.checkResult(runId)) {
            return;
        }
        const player = this.ent.BattlePlayerModel;
        this.setPhase(BattlePhase.PlayerStart);
        this.ent.BattleModel.turnVariables = {};
        player.turn = this.ent.BattleModel.turn;
        this.ent.BattleEquipmentBll.beginTurn();
        player.energy = Math.min(player.baseEnergy, player.maxEnergy);
        await this.ent.BattleBuffBll.settleTurnStartBuffs(BattleSide.Player);
        if (this.checkResult(runId)) {
            return;
        }
        await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.TurnStart, BattleSide.Player);
        if (this.checkResult(runId)) {
            return;
        }
        await this.ent.BattleCardBll.fillHand();
        if (this.checkResult(runId)) {
            return;
        }
        await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.HandReady, BattleSide.Player);
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
    // 重投当前选择的骰子并支付能量。
    rerollSelectedDice(): false | Promise<boolean> {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        const selected = player.diceLocked[0];
        if (model.busy || model.phase !== BattlePhase.PlayerAction || player.energy < 2
            || player.diceLocked.length !== 1 || this.isBattleFinished()) {
            return false;
        }
        if (player.diceUsed.includes(selected)) {
            return this.activateUsedDie(selected);
        }
        if (!this.ent.BattleDiceBll.rollOneDie(selected)) {
            return false;
        }
        player.diceLocked = [];
        model.message = '';
        this.setPhase(BattlePhase.PlayerAction);
        return this.payDiceEnergy();
    }
    // 激活指定失活骰子并支付能量。
    activateUsedDie(index: number): false | Promise<boolean> {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || player.energy < 2
            || !player.diceUsed.includes(index) || this.isBattleFinished()
            || !this.ent.BattleDiceBll.rollOneDie(index)) {
            if (model.phase === BattlePhase.PlayerAction && player.diceUsed.includes(index) && player.energy < 2) {
                model.message = '激活失活骰子需要2点能量';
                this.refreshBattleView();
            }
            return false;
        }
        player.diceLocked = [];
        player.diceUsed = player.diceUsed.filter(usedIndex => {
            return usedIndex !== index;
        });
        model.message = '';
        this.setPhase(BattlePhase.PlayerAction);
        return this.payDiceEnergy();
    }
    // 等待重投或激活的能量触发效果与胜负结算，期间锁定操作避免重复扣费。
    private payDiceEnergy(): Promise<boolean> {
        const model = this.ent.BattleModel;
        const runId = model.runId;
        model.busy = true;
        return (async () => {
            await this.ent.BattleEquipmentBll.changeEnergy(-2, 'DICE');
            await this.finishResult();
            return true;
        })().catch((error: Error) => {
            if (model.runId === runId) {
                this.handleBattleError(error);
            }
            return false;
        }).finally(() => {
            if (model.runId === runId) {
                model.busy = false;
                this.refreshBattleView();
            }
        });
    }
    // 检查战斗关闭、胜负和结算批次是否已失效。
    isBattleFinished(runId = this.ent.BattleModel.runId): boolean {
        const model = this.ent.BattleModel;
        return runId !== model.runId || model.closed || model.phase === BattlePhase.Victory || model.phase === BattlePhase.Defeat;
    }
    // 检查双方生命并切换胜负状态。
    checkResult(runId = this.ent.BattleModel.runId): boolean {
        if (this.isBattleFinished(runId)) {
            return true;
        }
        if (this.ent.BattlePlayerModel.hp <= 0) {
            this.setPhase(BattlePhase.Defeat);
        }
        else if (this.ent.BattleEnemyModel.hp <= 0) {
            this.setPhase(BattlePhase.Victory);
        }
        return this.isBattleFinished();
    }
    // 等待战斗结束事件与奖励界面打开后完成结算。
    finishResult(): Promise<void> {
        const model = this.ent.BattleModel;
        if (model.closed || !this.isBattleFinished() || model.resultHandled) {
            return Promise.resolve();
        }
        const runId = model.runId;
        model.resultHandled = true;
        model.busy = true;
        return (async () => {
            this.cancelChoice();
            if (model.phase === BattlePhase.Victory) {
                await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.EnemyDied, BattleSide.Player);
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CombatEnd, BattleSide.Player);
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CombatEnd, BattleSide.Enemy);
            if (model.closed || model.runId !== runId) {
                return;
            }
            smc.player.PlayerModel.hp = this.ent.BattlePlayerModel.hp;
            smc.player.PlayerModel.gold = model.gold;
            this.dispatchEvent(PlayerEvent.statsChanged);
            model.triggers = [];
            if (model.phase === BattlePhase.Victory) {
                this.ent.BattleRewardBll.prepareRewards();
                await this.ent.openBattleCleadupDialog();
            }
        })().finally(() => {
            if (model.runId === runId) {
                model.busy = false;
                this.refreshBattleView();
            }
        });
    }
    // 关闭战斗并取消尚未完成的效果选择。
    closeBattle(): void {
        this.ent.BattleModel.closed = true;
        this.cancelChoice();
    }
    // 离开战斗结果界面并推进冒险流程。
    leaveResult(): void {
        const model = this.ent.BattleModel;
        if (model.busy || !this.isBattleFinished()) {
            return;
        }
        if (model.phase === BattlePhase.Victory && !model.rewardsDismissed) {
            this.ent.BattleRewardBll.prepareRewards();
            this.ent.openBattleCleadupDialog();
            return;
        }
        const phase = model.phase;
        this.ent.closeBattleView();
        if (phase === BattlePhase.Victory) {
            smc.gameFlow.advanceLevel();
        }
        else if (phase === BattlePhase.Defeat) {
            smc.gameFlow.GameFlowBll.startNewGame();
        }
    }
    // 取消待确认的效果选择并解除等待。
    private cancelChoice(): void {
        const choice = this.ent.BattleModel.choice;
        this.ent.BattleModel.choice = null;
        choice?.resolve(-1);
    }
    // 报告结算错误并停止当前战斗。
    handleBattleError(error: Error): void {
        this.ent.BattleModel.message = error.message;
        this.ent.BattleModel.closed = true;
        this.cancelChoice();
        console.error('战斗结算失败', error);
    }
    // 通知战斗界面刷新数据。
    refreshBattleView(): void {
        this.dispatchEvent(BattleEvent.refreshBattlePhase);
    }
    // 执行setPhase对应的战斗处理。
    private setPhase(phase: BattlePhase): void {
        this.ent.BattleModel.phase = phase;
        this.refreshBattleView();
    }
    // 设置当前战斗的敌人配置编号。
    generateEnemy(): void {
        const enemyId = this.ent.BattleModel.enemyId;
        this.ent.BattleEnemyModel.enemyId = enemyId;
    }
}
