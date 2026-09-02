import { smc } from '../../common/SingletonModuleComp';
import { EnumEvent } from '../../common/table/EnumEvent';
import { RouteSelect } from '../RouteSelect';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';

export class RouteSelectBll extends CCBusiness<RouteSelect> {

    getCurrentRoutes() {
        return this.ent.RouteSelectModel.currentRoutes;
    }

    generateRoutes() {
        this.ent.RouteSelectModel.currentRoutes = [EnumEvent.TREASURE, EnumEvent.ENEMY];
    }

    selectDefaultRoute() {
        switch (this.ent.RouteSelectModel.currentRoutes[0]) {
            case EnumEvent.TREASURE:
                smc.battle.openBattleView();
                break;
            case EnumEvent.ENEMY:
                smc.battle.openBattleView();
                break;
            default:
                break;
        }
    }
    selectUnknownRoute() {
        switch (this.ent.RouteSelectModel.currentRoutes[1]) {
            case EnumEvent.TREASURE:
                smc.battle.openBattleView();
                break;
            case EnumEvent.ENEMY:
                smc.battle.openBattleView();
                break;
            default:
                break;
        }
    }
}