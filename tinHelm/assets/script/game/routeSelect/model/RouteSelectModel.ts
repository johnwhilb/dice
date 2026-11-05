import { ecs } from 'db://oops-framework/libs/ecs/ECS';

export enum TravelRouteType {
    RANDOM,
    ORIGIN,
    ANCHOR,
    DIRECTIONAL,
    ASGARD,
}

export interface RealmLevelState {
    realmId: number;
    eventIds: number[];
    eventDetailIds?: number[];
    currentEventIndex: number;
    completed: boolean;
    visited: boolean;
    mapNodes?: MapNodeData[];
    currentNodeId?: number;
    visitedNodeIds?: number[];
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

export interface TravelRouteData {
    type: TravelRouteType;
    name: string;
    des: string;
}

@ecs.register('RouteSelectModel')
export class RouteSelectModel extends ecs.Comp {

    currentRealmId = 0;
    originRealmId = 0;
    realmLevels: RealmLevelState[] = [];
    anchorCount = 0;
    recordedRealmId = 0;
    currentEventDetailId = 0;
    travelRoute: TravelRouteData = {
        type: TravelRouteType.RANDOM,
        name: '跨界移动',
        des: '随机探索其他世界',
    };

    /** 清空本局世界、地图节点及路线进度；节点 ID 仅在所属地图内有效。 */
    reset(): void {
        this.currentRealmId = 0;
        this.originRealmId = 0;
        this.realmLevels = [];
        this.anchorCount = 0;
        this.recordedRealmId = 0;
        this.currentEventDetailId = 0;
        this.travelRoute = {
            type: TravelRouteType.RANDOM,
            name: '跨界移动',
            des: '随机探索其他世界',
        };
    }

}
