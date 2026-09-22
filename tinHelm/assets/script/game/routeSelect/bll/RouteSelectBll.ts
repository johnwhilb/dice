import { smc } from '../../common/SingletonModuleComp';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { RouteSelect } from '../RouteSelect';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';

export class RouteSelectBll extends CCBusiness<RouteSelect> {

    getCurrentRoutes() {
        return this.ent.RouteSelectModel.currentRoutes;
    }

    generateRoutes() {
        this.ent.RouteSelectModel.currentRoutes = [EventTypeEnum.STORY, EventTypeEnum.ENEMY];
    }

    selectDefaultRoute() {
        switch (this.ent.RouteSelectModel.currentRoutes[0]) {
            case EventTypeEnum.STORY:
                smc.storyEvent.openStoryEventView();
                break;
            case EventTypeEnum.ENEMY:
                smc.battle.openBattleView();
                break;
            default:
                break;
        }
    }
    selectUnknownRoute() {
        switch (this.ent.RouteSelectModel.currentRoutes[1]) {
            case EventTypeEnum.TREASURE:
                smc.battle.openBattleView();
                break;
            case EventTypeEnum.ENEMY:
                smc.battle.openBattleView();
                break;
            default:
                break;
        }
    }
}
