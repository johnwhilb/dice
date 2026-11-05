import { ecs } from 'db://oops-framework/libs/ecs/ECS';

export interface RealmLevelState {
    realmId: number;
    mapId: number;
    completed: boolean;
    mapNodes: MapNodeData[];
    currentNodeId: number;
    visitedNodeIds: number[];
}

export enum MapNodeType {
    Fight,
    Shop,
    Elite,
}

export interface MapNodeData {
    id: number;
    column: number;
    lane: number;
    offsetY: number;
    type: MapNodeType;
    eventId: number;
    detailId: number;
    nextNodeIds: number[];
}

@ecs.register('RouteSelectModel')
export class RouteSelectModel extends ecs.Comp {

    currentRealmId = 0;
    realmLevels: RealmLevelState[] = [];
    anchorCount = 0;

    /** 清空本局世界、地图节点及路线进度；节点 ID 仅在所属地图内有效。 */
    reset(): void {
        this.currentRealmId = 0;
        this.realmLevels = [];
        this.anchorCount = 0;
    }

}
