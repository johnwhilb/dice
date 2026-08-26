import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { GameFlow } from '../GameFlow';
import { GameFlowState } from '../model/GameFlowModel';

export class GameFlowBll extends CCBusiness<GameFlow> {

    entryGameSceneByGameFlowState() {
        switch (this.ent.gameFlowModel.currentGameFlowState) {
            case GameFlowState.RoleSelect:
                this.ent.openRoleSelectView();
                break;
            default:
                this.ent.openRoleSelectView();
                break;
        }
    }
}