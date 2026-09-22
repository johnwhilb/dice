import { CCView } from 'db://oops-framework/module/common/CCView';
import { RouteSelect } from '../RouteSelect';
import { _decorator } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { Label } from 'cc';
import { smc } from '../../common/SingletonModuleComp';

const { ccclass } = _decorator;


@ccclass("RouteSelectView")
@ecs.register("RouteSelectView", false)
@gui.register('RouteSelectView', { layer: LayerType.UI, prefab: 'gui/routeSelect/RouteSelectView' })
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
        const currentRealm = this.ent.getCurrentRealm();
        const currentEvent = this.ent.getCurrentEvent();
        const travelRoute = this.ent.getTravelRoute();
        const nodeRoute1 = this.getNode('nodeRoute1')!;
        const nodeRoute2 = this.getNode('nodeRoute2')!;
        const lbtName1 = nodeRoute1.getChildByName('lbtName')!;
        const lbtName2 = nodeRoute2.getChildByName('lbtName')!;
        const lbtDes1 = nodeRoute1.getChildByName('lbtDes')!;
        const lbtDes2 = nodeRoute2.getChildByName('lbtDes')!;
        lbtName1.getComponent(Label)!.string = currentEvent?.name ?? '世界已完成';
        lbtName2.getComponent(Label)!.string = travelRoute.name;
        lbtDes1.getComponent(Label)!.string = currentEvent?.des ?? '该世界的事件已经全部完成';
        lbtDes2.getComponent(Label)!.string = travelRoute.des;
        this.getNode('lbtCurrentWorld')!.getComponent(Label)!.string = currentRealm?.name ?? '未知世界';
        this.getNode('lbtCurrentDay')!.getComponent(Label)!.string = `Day ${smc.gameFlow.getCurrentDay()}`;
    }


    btnClose() {
        this.ent.closeRouteSelectView();
    }

    nodeRoute1() {
        if (this.ent.selectDefaultRoute()) {
            this.ent.closeRouteSelectView();
        }
    }
    nodeRoute2() {
        if (this.ent.selectUnknownRoute()) {
            this.ent.closeRouteSelectView();
        }
    }

    btnMap() {
        this.ent.openMapView();
    }

    reset(): void {
    }


}
