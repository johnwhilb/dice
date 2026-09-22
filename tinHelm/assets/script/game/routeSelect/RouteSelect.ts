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

    selectUnknownRoute() {
        return this.RouteSelectBll.selectTravelRoute();
    }

    openRouteSelectView() {
        if (this.has(RouteSelectView)) {
            return Promise.resolve(this.RouteSelectView.node);
        }
        return this.addUi(RouteSelectView);
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

    getTravelRoute() {
        return this.RouteSelectBll.getTravelRoute();
    }

    getRealmLevels() {
        return this.RouteSelectBll.getRealmLevels();
    }

    canTravelToRealm(realmId: number) {
        return this.RouteSelectBll.canTravelToRealm(realmId);
    }

    selectRealmRoute(realmId: number) {
        return this.RouteSelectBll.selectRealmRoute(realmId);
    }

    async openMapView() {
        if (this.has(MapView)) {
            return Promise.resolve(this.MapView.node);
        }

        const node = await this.addUi(MapView);
        if (!node) {
            return null;
        }

        const mapView = node.getComponent(MapView) || node.addComponent(MapView);
        if (!this.has(MapView)) {
            this.add(mapView);
        }
        return node;
    }

    closeMapView() {
        if (this.has(MapView)) {
            this.removeUi(MapView);
        }
    }

}
