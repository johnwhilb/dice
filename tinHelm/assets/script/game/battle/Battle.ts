import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { BattleModel } from './model/BattleModel';
import { BattleBll } from './bll/BattleBll';
import { BattleView } from './view/BattleView';

@ecs.register('Battle')
export class Battle extends CCEntity {

    BattleModel!: BattleModel
    BattleBll!: BattleBll
    BattleView!: BattleView

    static create(): Battle {
        return ecs.getEntity<Battle>(Battle);
    }

    init(): void {
        this.addBusinesss(BattleBll);
        this.addComponents(BattleModel);
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

}