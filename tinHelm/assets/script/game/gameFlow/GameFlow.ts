import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { GameFlowModel } from './model/GameFlowModel';
import { GameFlowBll } from './bll/GameFlowBll';
import { RoleSelectView } from '../player/view/RoleSelectView';


@ecs.register('GameFlow')
export class GameFlow extends CCEntity {
    gameFlowModel!: GameFlowModel
    gameFlowBll!: GameFlowBll
    roleSelectView!: RoleSelectView

    static create(): GameFlow {
        return ecs.getEntity<GameFlow>(GameFlow);
    }

    init(): void {
        this.addComponents(GameFlowModel);
        this.addBusinesss(GameFlowBll);
    }

    openRoleSelectView() {
        if (this.has(RoleSelectView)) {
            return Promise.resolve(this.roleSelectView.node);
        }
        this.addUi(RoleSelectView);
    }

    entryGameSceneByGameFlowState() {
        this.gameFlowBll.entryGameSceneByGameFlowState();
    }

}