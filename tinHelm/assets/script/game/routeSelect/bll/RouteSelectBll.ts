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

}