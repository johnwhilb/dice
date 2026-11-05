import { _decorator, Color, EventTouch, Graphics, instantiate, Label, Node, Prefab, ScrollView, Sprite, UITransform, Vec2 } from 'cc';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { RouteSelect } from '../RouteSelect';
import { MapNodeData, MapNodeType } from '../model/RouteSelectModel';
import { GraphPathData, GraphView } from '../../ui/GraphView';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { smc } from '../../common/SingletonModuleComp';

const { ccclass, property } = _decorator;

@ccclass('MapView')
@ecs.register('MapView', false)
@gui.register('MapView', { layer: LayerType.UI, prefab: 'gui/map/ui/MapView' })
export class MapView extends CCView<RouteSelect> {
    @property(Prefab)
    nodePrefab: Prefab = null!;

    private positions = new Map<number, Vec2>();
    private touchStart = new Vec2();
    private dragging = false;
    private columnWidth = 210;
    private padding = 100;
    private iconScale = 1;

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        const background = this.getNode('mapBackground')!.getComponent(Graphics)!;
        const size = this.node.getComponent(UITransform)!.contentSize;
        background.fillColor = new Color(232, 224, 204, 255);
        background.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        background.fill();
        const viewport = this.getNode('mapViewport')!;
        viewport.on(Node.EventType.TOUCH_START, this.onTouchStart, this, true);
        viewport.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this, true);
        this.refresh();
    }

    refresh() {
        const level = this.ent.RouteSelectBll.getCurrentRealmLevel();
        const nodes = level?.mapNodes ?? [];
        const content = this.getNode('mapContent')!;
        const nodeLayer = this.getNode('mapNodes')!;
        for (const child of [...nodeLayer.children]) {
            child.destroy();
        }
        this.positions.clear();
        const columns = Math.max(1, ...nodes.map((node) => {
            return node.column + 1;
        }));
        const lanes = Math.max(2, Math.min(9, TableUniversal.getConfigById(UniversalNameEnum.MAP_LANE_COUNT)?.value ?? 7));
        const height = this.getNode('mapViewport')!.getComponent(UITransform)!.height;
        const laneHeight = Math.min(78, (height - 100) / (lanes - 1));
        this.iconScale = Math.min(1, laneHeight / 82);
        const width = this.padding * 2 + (columns - 1) * this.columnWidth;
        content.getComponent(UITransform)!.setContentSize(width, height);
        nodeLayer.getComponent(UITransform)!.setContentSize(width, height);
        this.getNode('mapLines')!.getComponent(UITransform)!.setContentSize(width, height);
        for (const data of nodes) {
            const position = new Vec2(this.padding + data.column * this.columnWidth,
                ((lanes - 1) / 2 - data.lane + data.offsetY) * laneHeight);
            this.positions.set(data.id, position);
            const node = instantiate(this.nodePrefab);
            node.parent = nodeLayer;
            node.setPosition(position.x, position.y);
            node.setScale(this.iconScale, this.iconScale, 1);
            this.updateMapNode(node, data);
            node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                if (!this.dragging && this.ent.selectMapNode(data.id)) {
                    this.ent.closeRouteSelectView();
                    this.ent.closeMapView();
                }
            }, this);
        }
        this.drawConnections(nodes);
        const visitedCount = level?.visitedNodeIds?.length ?? 0;
        this.getNode('lbtMapTitle')!.getComponent(Label)!.string = `${this.ent.getCurrentRealm()?.name ?? '探索地图'} · 路线选择`;
        this.getNode('lbtMapProgress')!.getComponent(Label)!.string = level?.completed
            ? '精英已击败 · 本次探索完成' : `已完成 ${visitedCount} / ${columns} 关 · 选择金色节点继续前进`;
        this.getNode('lbtMapHint')!.getComponent(Label)!.string = '向左滑动查看后续路线    普通战斗 / 商店 / 终点精英';
        this.getNode('txtExit')!.getComponent(Label)!.string = level?.completed ? '完成' : '返回';
        this.scheduleOnce(() => {
            const scroll = this.getNode('mapScroll')!.getComponent(ScrollView)!;
            const current = this.positions.get(level?.currentNodeId ?? 0);
            const viewportWidth = this.getNode('mapViewport')!.getComponent(UITransform)!.width;
            const offset = Math.max(0, Math.min(width - viewportWidth, (current?.x ?? 0) - viewportWidth * 0.3));
            scroll.scrollToOffset(new Vec2(offset, 0), 0);
        });
    }

    btnClose() {
        smc.save.saveGame();
        this.ent.closeMapView();
        smc.mainMenu.open();
    }

    reset(): void {
        this.positions.clear();
        this.unscheduleAllCallbacks();
    }

    private updateMapNode(node: Node, data: MapNodeData) {
        const level = this.ent.RouteSelectBll.getCurrentRealmLevel();
        const visited = level?.visitedNodeIds?.includes(data.id) ?? false;
        const available = this.ent.canSelectMapNode(data.id);
        const current = level?.currentNodeId === data.id;
        const color = current ? new Color(150, 91, 22) : available ? new Color(174, 111, 25)
            : visited ? new Color(73, 115, 79) : new Color(127, 122, 108);
        node.getChildByName('enemy')!.active = data.type === MapNodeType.Fight;
        node.getChildByName('shop')!.active = data.type === MapNodeType.Shop;
        node.getChildByName('eliteEnemy')!.active = data.type === MapNodeType.Elite;
        for (const name of ['enemy', 'shop', 'eliteEnemy']) {
            node.getChildByName(name)!.getComponent(Sprite)!.color = new Color(255, 255, 255, available || current || visited ? 255 : 130);
        }
        const ring = node.getChildByName('nodeRing')!.getComponent(Graphics)!;
        ring.clear();
        ring.fillColor = available ? new Color(255, 237, 182, 255) : new Color(243, 236, 218, 255);
        ring.circle(0, 0, 24);
        ring.fill();
        ring.strokeColor = color;
        ring.lineWidth = available || current ? 3 : 1;
        ring.circle(0, 0, 26);
        ring.stroke();
        const label = node.getChildByName('lbtNode')!.getComponent(Label)!;
        label.color = color;
        const name = data.type === MapNodeType.Elite ? '精英' : data.type === MapNodeType.Shop ? '商店' : '战斗';
        label.string = visited ? `${name} · 已完成` : `${data.column + 1} · ${name}`;
    }

    private drawConnections(nodes: MapNodeData[]) {
        const level = this.ent.RouteSelectBll.getCurrentRealmLevel();
        const visited = level?.visitedNodeIds ?? [];
        const paths: GraphPathData[] = [];
        for (const source of nodes) {
            for (const targetId of source.nextNodeIds) {
                const start = this.positions.get(source.id)!;
                const end = this.positions.get(targetId)!;
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.hypot(dx, dy);
                const sourceIndex = visited.indexOf(source.id);
                const traveled = sourceIndex >= 0 && visited[sourceIndex + 1] === targetId;
                const available = source.id === level?.currentNodeId && this.ent.canSelectMapNode(targetId);
                paths.push({
                    start: new Vec2(start.x + dx / length * 32 * this.iconScale, start.y + dy / length * 32 * this.iconScale),
                    end: new Vec2(end.x - dx / length * 32 * this.iconScale, end.y - dy / length * 32 * this.iconScale),
                    color: available ? new Color(174, 111, 25) : traveled ? new Color(73, 115, 79) : new Color(162, 155, 137),
                    animated: true,
                });
            }
        }
        const graph = this.getNode('mapLines')!.getComponent(GraphView)!;
        graph.lineWidth = 3;
        graph.setMarchingPaths(paths);
    }

    private onTouchStart(event: EventTouch) {
        this.touchStart.set(event.getUILocation());
        this.dragging = false;
    }

    private onTouchMove(event: EventTouch) {
        if (Vec2.distance(this.touchStart, event.getUILocation()) > 10) {
            this.dragging = true;
        }
    }
}
