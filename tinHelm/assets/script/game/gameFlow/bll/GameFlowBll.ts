import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { GameFlow } from '../GameFlow';
import { GameFlowState } from '../model/GameFlowModel';
import { smc } from '../../common/SingletonModuleComp';

export class GameFlowBll extends CCBusiness<GameFlow> {

    startNewGame() {
        this.ent.closeRoleSelectView();
        smc.routeSelect.closeMapView();
        smc.shop.closeShopView();
        smc.routeSelect.closeRouteSelectView();
        smc.storyEvent.closeStoryDialog();
        smc.storyEvent.closeStoryEventView();
        smc.battle.closeBattleView();
        this.ent.GameFlowModel.reset();
        smc.routeSelect.RouteSelectModel.reset();
        smc.shop.ShopModel.reset();
        smc.player.PlayerModel.reset();
        smc.storyEvent.StoryEventModel.reset();
        smc.battle.BattleModel.reset();
        smc.battle.BattlePlayerModel.reset();
        smc.battle.BattleEnemyModel.reset();
        this.entryGameSceneByGameFlowState();
    }

    entryGameSceneByGameFlowState() {
        switch (this.ent.GameFlowModel.currentGameFlowState) {
            case GameFlowState.RoleSelect:
                this.ent.openRoleSelectView();
                break;
            case GameFlowState.RouteSelect:
                smc.routeSelect.openRouteSelectView();
                break;
            case GameFlowState.Event:
                smc.routeSelect.RouteSelectBll.openCurrentEvent();
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
                smc.save.saveGame();
                this.entryGameSceneByGameFlowState();
                break;
            default:
                break;
        }
    }

    setGameFlowState(state: GameFlowState) {
        this.ent.GameFlowModel.currentGameFlowState = state;
    }

    advanceLevel() {
        if (this.ent.GameFlowModel.currentGameFlowState !== GameFlowState.Event) {
            return;
        }
        smc.routeSelect.completeCurrentEvent();
        this.advanceDay();
        this.setGameFlowState(GameFlowState.RouteSelect);
        smc.routeSelect.generateRoutes();
        smc.save.saveGame();
        smc.routeSelect.openRouteSelectView();
    }

    advanceDay() {
        this.ent.GameFlowModel.currentDay += 1;
    }
}
