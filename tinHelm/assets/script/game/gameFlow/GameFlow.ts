import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { GameFlowModel } from './model/GameFlowModel';
import { GameFlowBll } from './bll/GameFlowBll';
import { RoleSelectView } from '../player/view/RoleSelectView';
import { RouteSelectView } from '../routeSelect/view/RouteSelectView';


@ecs.register('GameFlow')
export class GameFlow extends CCEntity {
    GameFlowModel!: GameFlowModel
    GameFlowBll!: GameFlowBll
    RoleSelectView!: RoleSelectView
    RouteSelectView!: RouteSelectView

    static create(): GameFlow {
        return ecs.getEntity<GameFlow>(GameFlow);
    }

    init(): void {
        this.addComponents(GameFlowModel);
        this.addBusinesss(GameFlowBll);
    }

    openRoleSelectView() {
        if (this.has(RoleSelectView)) {
            return Promise.resolve(this.RoleSelectView.node);
        }
        this.addUi(RoleSelectView);
    }


    closeRoleSelectView() {
        if (this.has(RoleSelectView)) {
            this.removeUi(RoleSelectView);
        }
    }

    // entryGameSceneByGameFlowState() {
    //     this.GameFlowBll.entryGameSceneByGameFlowState();
    // }


}