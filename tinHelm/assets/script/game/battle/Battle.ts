import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { BattleModel } from './model/BattleModel';
import { BattleBll } from './bll/BattleBll';
import { BattleView } from './view/BattleView';
import { BattlePlayerModel } from './model/BattlePlayerModel';
import { BattleEnemyModel } from './model/BattleEnemyModel';
import { BattleEnemyBll } from './bll/BattleEnemyBll';
import { BattlePlayerBll } from './bll/BattlePlayerBll';
import { BattleDiceBll } from './bll/BattleDiceBll';
import { BattleCardBll } from './bll/BattleCardBll';
import { BattleEffectBll } from './bll/BattleEffectBll';
import { BattleValueResolver } from './bll/BattleValueResolver';
import { BattleDamageBll } from './bll/BattleDamageBll';
import { BattleBuffBll } from './bll/BattleBuffBll';
import { BattleTriggerBll } from './bll/BattleTriggerBll';
import { CardShowDialog } from './view/CardShowDialog';
import { BattleCardPile } from './model/BattleTypes';
import { BattleRewardBll } from './bll/BattleRewardBll';
import { BattleCleadupDialog } from './view/BattleCleadupDialog';
import { CardRewardDialog } from './view/CardRewardDialog';
import { BattleEnemyMechanicBll } from './bll/BattleEnemyMechanicBll';
import { BattleItemBll } from './bll/BattleItemBll';
import { BattleEquipmentBll } from './bll/BattleEquipmentBll';
@ecs.register('Battle')
export class Battle extends CCEntity {
    BattleModel!: BattleModel;
    BattleBll!: BattleBll;
    BattleView!: BattleView;
    CardShowDialog!: CardShowDialog;
    BattlePlayerModel!: BattlePlayerModel;
    BattleEnemyModel!: BattleEnemyModel;
    BattleEnemyBll!: BattleEnemyBll;
    BattlePlayerBll!: BattlePlayerBll;
    BattleDiceBll!: BattleDiceBll;
    BattleCardBll!: BattleCardBll;
    BattleEffectBll!: BattleEffectBll;
    BattleValueResolver!: BattleValueResolver;
    BattleDamageBll!: BattleDamageBll;
    BattleBuffBll!: BattleBuffBll;
    BattleTriggerBll!: BattleTriggerBll;
    BattleRewardBll!: BattleRewardBll;
    BattleCleadupDialog!: BattleCleadupDialog;
    CardRewardDialog!: CardRewardDialog;
    BattleEnemyMechanicBll!: BattleEnemyMechanicBll;
    BattleItemBll!: BattleItemBll;
    BattleEquipmentBll!: BattleEquipmentBll;
    static createBattle(): Battle {
        return ecs.getEntity<Battle>(Battle);
    }
    init(): void {
        this.BattleBll = this.addBusiness<BattleBll>(BattleBll);
        this.addComponents(BattleModel);
        this.addComponents(BattlePlayerModel);
        this.addComponents(BattleEnemyModel);
        this.BattleEnemyBll = this.addBusiness<BattleEnemyBll>(BattleEnemyBll);
        this.BattlePlayerBll = this.addBusiness<BattlePlayerBll>(BattlePlayerBll);
        this.BattleDiceBll = this.addBusiness<BattleDiceBll>(BattleDiceBll);
        this.BattleCardBll = this.addBusiness<BattleCardBll>(BattleCardBll);
        this.BattleEffectBll = this.addBusiness<BattleEffectBll>(BattleEffectBll);
        this.BattleValueResolver = this.addBusiness<BattleValueResolver>(BattleValueResolver);
        this.BattleDamageBll = this.addBusiness<BattleDamageBll>(BattleDamageBll);
        this.BattleBuffBll = this.addBusiness<BattleBuffBll>(BattleBuffBll);
        this.BattleTriggerBll = this.addBusiness<BattleTriggerBll>(BattleTriggerBll);
        this.BattleRewardBll = this.addBusiness<BattleRewardBll>(BattleRewardBll);
        this.BattleEnemyMechanicBll = this.addBusiness<BattleEnemyMechanicBll>(BattleEnemyMechanicBll);
        this.BattleItemBll = this.addBusiness<BattleItemBll>(BattleItemBll);
        this.BattleEquipmentBll = this.addBusiness<BattleEquipmentBll>(BattleEquipmentBll);
    }
    openBattleView(): Promise<import("cc").Node> | undefined {
        if (this.has(BattleView)) {
            return Promise.resolve(this.BattleView.node);
        }
        this.addUi(BattleView);
    }
    closeBattleView(): void {
        this.closeCardRewardDialog();
        if (this.has(BattleCleadupDialog)) {
            this.removeUi(BattleCleadupDialog);
        }
        this.closeCardShowDialog();
        this.BattleBll.closeBattle();
        if (this.has(BattleView)) {
            this.removeUi(BattleView);
        }
    }
    openCardShowDialog(pile: BattleCardPile): Promise<import("cc").Node | null> | undefined {
        const model = this.BattleModel;
        if (model.busy || model.closed || this.has(CardShowDialog)) {
            return;
        }
        model.shownCardPile = pile;
        return this.addUi(CardShowDialog);
    }
    closeCardShowDialog(): void {
        if (this.has(CardShowDialog)) {
            this.removeUi(CardShowDialog);
        }
    }
    changePhase(): void {
        this.BattleBll.changePhase();
    }
    // 等待界面资源加载和交互结果完成后更新状态。
    openBattleCleadupDialog(): Promise<void> {
        const model = this.BattleModel;
        if (model.closed || model.rewardsDismissed || model.rewardDialogOpening || this.has(BattleCleadupDialog)) {
            return Promise.resolve();
        }
        const runId = model.runId;
        model.rewardDialogOpening = true;
        this.closeCardShowDialog();
        return (async () => {
            await this.addUi(BattleCleadupDialog);
            if (model.closed || model.runId !== runId) {
                if (this.has(BattleCleadupDialog)) {
                    this.removeUi(BattleCleadupDialog);
                }
            }
        })().catch((error: Error) => {
            console.error('战斗奖励界面打开失败', error);
        }).finally(() => {
            if (model.runId === runId) {
                model.rewardDialogOpening = false;
            }
        });
    }
    // 等待界面资源加载和交互结果完成后更新状态。
    openCardRewardDialog(): Promise<void> {
        const model = this.BattleModel;
        if (model.closed || model.selectedRewardIndex < 0 || model.cardRewardDialogOpening || this.has(CardRewardDialog)) {
            return Promise.resolve();
        }
        const runId = model.runId;
        model.cardRewardDialogOpening = true;
        return (async () => {
            await this.addUi(CardRewardDialog);
            if (model.closed || model.runId !== runId) {
                if (this.has(CardRewardDialog)) {
                    this.removeUi(CardRewardDialog);
                }
            }
            else if (!this.has(CardRewardDialog)) {
                this.closeCardRewardDialog();
            }
        })().catch((error: Error) => {
            if (model.runId === runId) {
                this.closeCardRewardDialog();
            }
            console.error('卡牌奖励界面打开失败', error);
        }).finally(() => {
            if (model.runId === runId) {
                model.cardRewardDialogOpening = false;
            }
        });
    }
    closeCardRewardDialog(): void {
        this.BattleModel.selectedRewardIndex = -1;
        if (this.has(CardRewardDialog)) {
            this.removeUi(CardRewardDialog);
        }
        this.BattleRewardBll.refreshRewards();
    }
    setEnemy(enemyId: number): void {
        this.BattleModel.enemyId = enemyId;
    }
    initBattleSceneInfo(): void {
        this.BattleBll.generateEnemy();
        this.BattleEnemyBll.initEnemy();
        this.BattlePlayerBll.initPlayer();
        this.BattleEnemyMechanicBll.initializeMechanics();
    }
}
