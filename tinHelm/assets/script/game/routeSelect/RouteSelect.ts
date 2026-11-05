import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { RouteSelectBll } from './bll/RouteSelectBll';
import { RouteSelectModel } from './model/RouteSelectModel';
import { RouteSelectView } from './view/RouteSelectView';
import { MapView } from './view/MapView';

@ecs.register('RouteSelect')
export class RouteSelect extends CCEntity {
    RouteSelectBll!: RouteSelectBll
    RouteSelectModel!: RouteSelectModel
    RouteSelectView!: RouteSelectView
    MapView!: MapView

    static create(): RouteSelect {
        return ecs.getEntity<RouteSelect>(RouteSelect);
    }

    init(): void {
        this.RouteSelectBll = this.addBusiness<RouteSelectBll>(RouteSelectBll);
        this.addComponents(RouteSelectModel);
    }

    selectDefaultRoute() {
        return this.RouteSelectBll.selectCurrentEvent();
    }

    triggerCurrentEvent() {
        return this.RouteSelectBll.selectCurrentEvent();
    }

    selectUnknownRoute() {
        return this.RouteSelectBll.selectTravelRoute();
    }

    openRouteSelectView() {
        return this.openMapView();
    }

    closeRouteSelectView() {
        if (this.has(RouteSelectView)) {
            this.removeUi(RouteSelectView);
        }
    }

    generateRoutes() {
        this.RouteSelectBll.generateRoutes();
    }

    completeCurrentEvent() {
        this.RouteSelectBll.completeCurrentEvent();
    }

    getCurrentRealm() {
        return this.RouteSelectBll.getCurrentRealm();
    }

    getCurrentEvent() {
        return this.RouteSelectBll.getCurrentEvent();
    }

    getCurrentEventDetail() {
        return this.RouteSelectBll.getCurrentEventDetail();
    }

    getTravelRoute() {
        return this.RouteSelectBll.getTravelRoute();
    }

    getRealmLevels() {
        return this.RouteSelectBll.getRealmLevels();
    }

    openMapView() {
        this.generateRoutes();
        if (this.has(MapView)) {
            return Promise.resolve(this.MapView.node);
        }
        return this.addUi(MapView);
    }

    closeMapView() {
        if (this.has(MapView)) {
            this.removeUi(MapView);
        }
    }

    canSelectMapNode(nodeId: number) {
        return this.RouteSelectBll.canSelectMapNode(nodeId);
    }

    selectMapNode(nodeId: number) {
        return this.RouteSelectBll.selectMapNode(nodeId);
    }

}
