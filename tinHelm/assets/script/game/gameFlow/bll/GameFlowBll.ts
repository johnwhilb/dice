import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { GameFlow } from '../GameFlow';
import { GameFlowState } from '../model/GameFlowModel';
import { smc } from '../../common/SingletonModuleComp';

export class GameFlowBll extends CCBusiness<GameFlow> {

    entryGameSceneByGameFlowState() {
        switch (this.ent.GameFlowModel.currentGameFlowState) {
            case GameFlowState.RoleSelect:
                this.ent.openRoleSelectView();
                break;
            case GameFlowState.RouteSelect:
                smc.routeSelect.openRouteSelectView();
                break;
            default:
                this.ent.openRoleSelectView();
                break;
        }
    }

    AdvanceGameFlowState() {
        switch (this.ent.GameFlowModel.currentGameFlowState) {
            case GameFlowState.RoleSelect:
                smc.routeSelect.generateRoutes();
                smc.player.initPlayer();
                this.setGameFlowState(GameFlowState.RouteSelect);
                this.entryGameSceneByGameFlowState();
                break;
            default:
                break;
        }
    }

    setGameFlowState(state: GameFlowState) {
        this.ent.GameFlowModel.currentGameFlowState = state;
    }
}