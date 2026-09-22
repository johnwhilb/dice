import { _decorator, EventTouch, Label, Node } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { TableEvent } from '../../common/table/TableEvent';
import { TableRealms } from '../../common/table/TableRealms';
import { RouteSelect } from '../RouteSelect';
import { RealmLevelState } from '../model/RouteSelectModel';

const { ccclass } = _decorator;

@ccclass('MapView')
@ecs.register('MapView', false)
@gui.register('MapView', { layer: LayerType.UI, prefab: 'gui/map/ui/MapViewView' })
export class MapView extends CCView<RouteSelect> {

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.node.on(Node.EventType.TOUCH_END, this.btnClose, this);
        this.refresh();
    }

    async refresh() {
        const realmLayout = this.getNode('realmLayout')!;
        realmLayout.removeAllChildren();

        for (const level of this.ent.getRealmLevels()) {
            const realmNode = await this.createPrefabNode('gui/map/item/nodeRealm', 'bundle');
            if (!realmNode) {
                continue;
            }

            realmNode.parent = realmLayout;
            this.updateRealmNode(realmNode, level);
            realmNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                this.selectRealm(level.realmId);
            }, this);
        }
    }

    btnClose() {
        this.ent.closeMapView();
    }

    reset(): void {
    }

    private updateRealmNode(node: Node, level: RealmLevelState) {
        const realm = TableRealms.getConfigById(level.realmId);
        const eventId = level.eventIds[level.currentEventIndex] ?? 0;
        const event = TableEvent.getConfigById(eventId);
        const isCurrent = level.realmId === this.ent.RouteSelectModel.currentRealmId;
        const canTravel = this.ent.canTravelToRealm(level.realmId);
        const stateText = isCurrent ? '当前世界' : canTravel ? '可前往' : '未解锁';
        const progress = Math.min(level.currentEventIndex, level.eventIds.length);
        const eventName = level.completed ? '世界已完成' : event?.name ?? '未知事件';

        node.getChildByName('lbtRealmName')!.getComponent(Label)!.string = realm?.name ?? '未知世界';
        node.getChildByName('lbtCurrentEvent')!.getComponent(Label)!.string = `${stateText} · ${eventName}`;
        node.getChildByName('lbtCurrentProgress')!.getComponent(Label)!.string = `${progress}/${level.eventIds.length}`;
    }

    private selectRealm(realmId: number) {
        if (!this.ent.canTravelToRealm(realmId)) {
            return;
        }

        if (this.ent.selectRealmRoute(realmId)) {
            this.ent.closeMapView();
            this.ent.closeRouteSelectView();
        }
    }
}
