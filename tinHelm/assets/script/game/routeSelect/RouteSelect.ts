import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { RouteSelectBll } from './bll/RouteSelectBll';
import { RouteSelectModel } from './model/RouteSelectModel';
import { RouteSelectView } from './view/RouteSelectView';

@ecs.register('RouteSelect')
export class RouteSelect extends CCEntity {
    RouteSelectBll!: RouteSelectBll
    RouteSelectModel!: RouteSelectModel
    RouteSelectView!: RouteSelectView

    static create(): RouteSelect {
        return ecs.getEntity<RouteSelect>(RouteSelect);
    }

    init(): void {
        this.addBusinesss(RouteSelectBll);
        this.addComponents(RouteSelectModel);
    }

    selectDefaultRoute() {
        this.getBusiness<RouteSelectBll>(RouteSelectBll).selectDefaultRoute();
    }

    selectUnknownRoute() {
        this.getBusiness<RouteSelectBll>(RouteSelectBll).selectUnknownRoute();
    }

    openRouteSelectView() {
        if (this.has(RouteSelectView)) {
            return Promise.resolve(this.RouteSelectView.node);
        }
        this.addUi(RouteSelectView);
    }

    closeRouteSelectView() {
        if (this.has(RouteSelectView)) {
            this.removeUi(RouteSelectView);
        }
    }

    getCurrentRoutes() {
        return this.getBusiness<RouteSelectBll>(RouteSelectBll).getCurrentRoutes();
    }

    generateRoutes() {
        this.getBusiness<RouteSelectBll>(RouteSelectBll).generateRoutes();
    }

}