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

@ecs.register('Battle')
export class Battle extends CCEntity {

    BattleModel!: BattleModel
    BattleBll!: BattleBll
    BattleView!: BattleView
    CardShowDialog!: CardShowDialog;
    BattlePlayerModel!: BattlePlayerModel
    BattleEnemyModel!: BattleEnemyModel
    BattleEnemyBll!: BattleEnemyBll
    BattlePlayerBll!: BattlePlayerBll
    BattleDiceBll!: BattleDiceBll
    BattleCardBll!: BattleCardBll;
    BattleEffectBll!: BattleEffectBll;
    BattleValueResolver!: BattleValueResolver;
    BattleDamageBll!: BattleDamageBll;
    BattleBuffBll!: BattleBuffBll;
    BattleTriggerBll!: BattleTriggerBll;

    static create(): Battle {
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
    }

    openBattleView() {
        if (this.has(BattleView)) {
            return Promise.resolve(this.BattleView.node);
        }
        this.addUi(BattleView);
    }

    closeBattleView() {
        this.closeCardShowDialog();
        this.BattleBll.close();
        if (this.has(BattleView)) {
            this.removeUi(BattleView);
        }
    }

    async openCardShowDialog(pile: BattleCardPile) {
        const model = this.BattleModel;
        if (model.busy || model.closed || model.shownCardPile) {
            return;
        }
        const runId = model.runId;
        model.shownCardPile = pile;
        this.BattleBll.refresh();
        try {
            const node = await this.addUi(CardShowDialog);
            if (!node || model.closed || model.runId !== runId || !model.shownCardPile) {
                this.closeCardShowDialog();
            }
        } catch (error) {
            model.shownCardPile = null;
            model.message = '牌堆界面加载失败，请重试';
            this.BattleBll.refresh();
            console.error('牌堆界面加载失败', error);
        }
    }

    closeCardShowDialog() {
        this.BattleModel.shownCardPile = null;
        if (this.has(CardShowDialog)) {
            this.removeUi(CardShowDialog);
        }
        if (this.has(BattleView)) {
            this.BattleBll.refresh();
        }
    }

    changePhase() {
        this.BattleBll.changePhase();
    }

    setEnemy(enemyId: number) {
        this.BattleModel.enemyId = enemyId;
    }

    initBattleSceneInfo() {
        this.BattleBll.generateEnemy();
        this.BattleEnemyBll.initEnemy();
        this.BattlePlayerBll.initPlayer();
    }

}
