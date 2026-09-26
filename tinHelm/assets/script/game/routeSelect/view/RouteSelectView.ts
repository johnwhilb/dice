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
        const currentEventDetail = this.ent.getCurrentEventDetail();
        const lbtCurrentEventName = this.getNode('lbtCurrentEventName')!;
        const lbtCurrentEventDes = this.getNode('lbtCurrentEventDes')!;
        lbtCurrentEventName.getComponent(Label)!.string = currentEventDetail?.name ?? currentEvent?.name ?? '世界已完成';
        lbtCurrentEventDes.getComponent(Label)!.string = currentEventDetail?.des ?? '该世界的事件已经全部完成';
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

    nodeTriggerEvent() {
        if (this.ent.triggerCurrentEvent()) {
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
