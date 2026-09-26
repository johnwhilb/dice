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

@ecs.register('Battle')
export class Battle extends CCEntity {

    BattleModel!: BattleModel
    BattleBll!: BattleBll
    BattleView!: BattleView
    BattlePlayerModel!: BattlePlayerModel
    BattleEnemyModel!: BattleEnemyModel
    BattleEnemyBll!: BattleEnemyBll
    BattlePlayerBll!: BattlePlayerBll
    BattleDiceBll!: BattleDiceBll

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
    }

    openBattleView() {
        if (this.has(BattleView)) {
            return Promise.resolve(this.BattleView.node);
        }
        this.addUi(BattleView);
    }

    closeBattleView() {
        if (this.has(BattleView)) {
            this.removeUi(BattleView);
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
