import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { RouteSelectBll } from './bll/RouteSelectBll';
import { RouteSelectModel } from './model/RouteSelectModel';
import { MapView } from './view/MapView';

@ecs.register('RouteSelect')
export class RouteSelect extends CCEntity {
    RouteSelectBll!: RouteSelectBll
    RouteSelectModel!: RouteSelectModel
    MapView!: MapView

    static create(): RouteSelect {
        return ecs.getEntity<RouteSelect>(RouteSelect);
    }

    init(): void {
        this.RouteSelectBll = this.addBusiness<RouteSelectBll>(RouteSelectBll);
        this.addComponents(RouteSelectModel);
    }

    generateRoutes() {
        this.RouteSelectBll.generateRoutes();
    }

    completeCurrentEvent() {
        this.RouteSelectBll.completeCurrentEvent();
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
