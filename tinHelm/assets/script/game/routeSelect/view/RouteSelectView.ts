import { CCView } from 'db://oops-framework/module/common/CCView';
import { RouteSelect } from '../RouteSelect';
import { _decorator } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { TableEvent } from '../../common/table/TableEvent';
import { Label } from 'cc';

const { ccclass } = _decorator;


@ccclass("RouteSelectView")
@ecs.register("RouteSelectView", false)
@gui.register('RouteSelectView', { layer: LayerType.PopUp, prefab: 'gui/routeSelect/RouteSelectView' })
export class RouteSelectView extends CCView<RouteSelect> {


    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.refresh();
    }

    refresh() {
        this.updateCurrentRoute();
    }

    updateCurrentRoute() {
        const currentRoute1 = this.ent.getCurrentRoutes()[0];
        const currentRoute2 = this.ent.getCurrentRoutes()[1];
        const routeInfo1 = TableEvent.getConfigById(currentRoute1);
        const routeInfo2 = TableEvent.getConfigById(currentRoute2);
        const nodeRoute1 = this.getNode('nodeRoute1')!;
        const nodeRoute2 = this.getNode('nodeRoute2')!;
        const lbtName1 = nodeRoute1.getChildByName('lbtName')!;
        const lbtName2 = nodeRoute2.getChildByName('lbtName')!;
        const lbtDes1 = nodeRoute1.getChildByName('lbtDes')!;
        const lbtDes2 = nodeRoute2.getChildByName('lbtDes')!;
        lbtName1.getComponent(Label).string = routeInfo1!.name;
        lbtName2.getComponent(Label).string = routeInfo2!.name;
        lbtDes1.getComponent(Label).string = routeInfo1!.des;
        lbtDes2.getComponent(Label).string = routeInfo2!.des;
    }

    reset(): void {
    }


}
