import { _decorator } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Save } from '../Save';
import { smc } from '../../common/SingletonModuleComp';
import { CommonStorageConfig } from '../../common/config/GameStorageConfig';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { MapNodeData, MapNodeType, RealmLevelState } from '../../routeSelect/model/RouteSelectModel';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { PlayerEvent } from '../../player/PlayerEvent';
import { RouteSelectEvent } from '../../routeSelect/RouteSelectEvent';
const { ccclass } = _decorator;

interface RunSaveData {
    version: number;
    state: GameFlowState;
    currentDay: number;
    currentRealmId: number;
    originRealmId: number;
    realmLevels: RealmLevelState[];
    anchorCount: number;
    recordedRealmId: number;
    currentEventDetailId?: number;
    shopCardIds?: number[];
    shopItemIds?: number[];
    shopBoughtCardIds?: number[];
    shopBoughtItemIds?: number[];
    roleId: number;
    hp: number;
    maxHp: number;
    handCard: number[];
    gold?: number;
    items?: Record<number, number>;
    resources?: Record<number, number>;
    equipmentIds?: number[];
}

@ccclass('B_Save')
export class SaveBll extends CCBusiness<Save> {
    hasSave() {
        return !!this.readSave();
    }

    /** 保存玩家状态和完整节点图，地图坐标、事件详情及已走路线均不再重抽。 */
    saveGame() {
        const flow = smc.gameFlow.GameFlowModel;
        if (flow.currentGameFlowState === GameFlowState.RoleSelect) {
            return;
        }
        const route = smc.routeSelect.RouteSelectModel;
        const player = smc.player.PlayerModel;
        const data: RunSaveData = {
            version: 3,
            state: flow.currentGameFlowState,
            currentDay: flow.currentDay,
            currentRealmId: route.currentRealmId,
            originRealmId: route.originRealmId,
            realmLevels: route.realmLevels,
            anchorCount: route.anchorCount,
            recordedRealmId: route.recordedRealmId,
            currentEventDetailId: route.currentEventDetailId,
            shopCardIds: smc.shop.ShopModel.cardIds,
            shopItemIds: smc.shop.ShopModel.itemIds,
            shopBoughtCardIds: smc.shop.ShopModel.boughtCardIds,
            shopBoughtItemIds: smc.shop.ShopModel.boughtItemIds,
            roleId: player.roleId,
            hp: player.hp,
            maxHp: player.maxHp,
            handCard: player.handCard,
            gold: player.gold,
            items: player.items,
            resources: player.resources,
            equipmentIds: player.equipmentIds,
        };
        const saved = oops.storage.set(CommonStorageConfig.CurrentRun, JSON.stringify(data));
        this.ent.SaveModel.hasSave = saved;
        if (!saved) {
            console.error('游戏存档写入失败');
        }
    }

    /** 恢复节点存档；旧线性存档迁移合法路径并保留玩家数据。 */
    restoreGame() {
        const data = this.readSave();
        if (!data) {
            return false;
        }
        const flow = smc.gameFlow.GameFlowModel;
        const route = smc.routeSelect.RouteSelectModel;
        const player = smc.player.PlayerModel;
        const needsMigration = data.version < 3;
        flow.currentGameFlowState = needsMigration ? GameFlowState.RouteSelect : data.state;
        flow.currentDay = data.currentDay;
        if (needsMigration) {
            smc.routeSelect.RouteSelectBll.generateRealmLevels();
            const savedLevel = data.realmLevels.find((item) => {
                return item.realmId === data.currentRealmId;
            });
            smc.routeSelect.RouteSelectBll.migrateLegacyProgress(savedLevel?.currentEventIndex ?? 0);
        } else {
            route.realmLevels = data.realmLevels;
            route.currentRealmId = data.currentRealmId;
            route.originRealmId = data.originRealmId;
        }
        route.anchorCount = data.anchorCount;
        route.recordedRealmId = data.recordedRealmId;
        route.currentEventDetailId = needsMigration ? 0 : (data.currentEventDetailId ?? 0);
        if (needsMigration) {
            smc.shop.clear();
        } else {
            smc.shop.restore(data.currentEventDetailId ?? 0, data.roleId, data.shopCardIds ?? [],
                data.shopItemIds, data.shopBoughtCardIds ?? [], data.shopBoughtItemIds ?? []);
        }
        player.roleId = data.roleId;
        player.hp = data.hp;
        player.maxHp = data.maxHp;
        player.handCard = data.handCard;
        player.gold = data.gold ?? 0;
        player.items = data.items ?? {};
        player.resources = data.resources ?? {};
        player.equipmentIds = data.equipmentIds ?? [];
        this.dispatchEvent(PlayerEvent.statsChanged);
        this.dispatchEvent(RouteSelectEvent.anchorCountChanged);
        smc.routeSelect.generateRoutes();
        if (needsMigration) {
            this.saveGame();
        }
        this.ent.SaveModel.hasSave = true;
        return true;
    }

    private readSave() {
        try {
            const raw: unknown = JSON.parse(oops.storage.get(CommonStorageConfig.CurrentRun) || 'null');
            if (this.isSaveData(raw)) {
                return raw;
            }
        } catch (error) {
            console.warn('读取游戏存档失败', error);
        }
        return null;
    }

    /** 校验存档版本、玩家数据及对应版本的地图结构，value 为原始存档对象。 */
    private isSaveData(value: unknown): value is RunSaveData {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const data: Partial<RunSaveData> = value;
        return (data.version === 1 || data.version === 2 || data.version === 3)
            && (data.state === GameFlowState.RouteSelect || data.state === GameFlowState.Event)
            && typeof data.currentDay === 'number' && data.currentDay >= 1
            && typeof data.currentRealmId === 'number'
            && typeof data.originRealmId === 'number'
            && typeof data.anchorCount === 'number'
            && typeof data.recordedRealmId === 'number'
            && (data.currentEventDetailId === undefined || typeof data.currentEventDetailId === 'number')
            && (data.shopCardIds === undefined || (Array.isArray(data.shopCardIds)
                && data.shopCardIds.every((id: unknown) => {
                    return typeof id === 'number';
                })))
            && this.isIdList(data.equipmentIds)
            && this.isIdList(data.shopItemIds)
            && this.isIdList(data.shopBoughtCardIds)
            && this.isIdList(data.shopBoughtItemIds)
            && typeof data.roleId === 'number'
            && typeof data.hp === 'number'
            && typeof data.maxHp === 'number'
            && (data.gold === undefined || (typeof data.gold === 'number' && Number.isFinite(data.gold) && data.gold >= 0))
            && (data.items === undefined || this.isCountMap(data.items))
            && (data.resources === undefined || this.isCountMap(data.resources))
            && Array.isArray(data.handCard)
            && data.handCard.every((id: unknown) => {
                return typeof id === 'number';
            })
            && Array.isArray(data.realmLevels)
            && data.realmLevels.length > 0
            && data.realmLevels.every((level: unknown) => {
                return this.isRealmLevel(level);
            })
            && (data.version === 1 || data.realmLevels.every((level) => {
                return level.eventDetailIds?.length === level.eventIds.length;
            }))
            && (data.version !== 3 || data.realmLevels.every((level) => {
                return this.isMapLevel(level, data.state ?? GameFlowState.RouteSelect);
            }))
            && data.realmLevels.some((level) => {
                return level.realmId === data.currentRealmId
                    && (data.state !== GameFlowState.Event || !!level.eventIds[level.currentEventIndex]);
            });
    }

    private isIdList(value: unknown) {
        return value === undefined || (Array.isArray(value) && value.every((id: unknown) => {
            return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
        }));
    }

    private isCountMap(value: unknown) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }
        return Object.entries(value).every(([key, count]) => {
            return Number.isSafeInteger(Number(key)) && Number(key) > 0
                && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
        });
    }

    /** 校验新旧存档共用的事件数组和世界进度字段，value 为原始世界记录。 */
    private isRealmLevel(value: unknown): value is RealmLevelState {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const level: Partial<RealmLevelState> = value;
        return typeof level.realmId === 'number'
            && typeof level.currentEventIndex === 'number'
            && Number.isInteger(level.currentEventIndex)
            && level.currentEventIndex >= 0
            && typeof level.completed === 'boolean'
            && typeof level.visited === 'boolean'
            && Array.isArray(level.eventIds)
            && level.currentEventIndex <= level.eventIds.length
            && level.eventIds.every((id: unknown) => {
                return typeof id === 'number';
            })
            && (level.eventDetailIds === undefined || (Array.isArray(level.eventDetailIds)
                && level.eventDetailIds.length === level.eventIds.length
                && level.eventDetailIds.every((id: unknown) => {
                    return typeof id === 'number';
                })));
    }

    /** 校验节点字段和事件类型，value 为反序列化得到的未知节点。 */
    private isMapNode(value: unknown): value is MapNodeData {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const node: Partial<MapNodeData> = value;
        return typeof node.id === 'number' && Number.isSafeInteger(node.id) && node.id > 0
            && typeof node.column === 'number' && Number.isSafeInteger(node.column) && node.column >= 0
            && typeof node.lane === 'number' && Number.isFinite(node.lane) && node.lane >= 0 && node.lane <= 8
            && typeof node.offsetY === 'number' && Number.isFinite(node.offsetY) && Math.abs(node.offsetY) <= 0.15
            && (node.type === MapNodeType.Fight || node.type === MapNodeType.Shop || node.type === MapNodeType.Elite)
            && node.eventId === (node.type === MapNodeType.Shop ? EventTypeEnum.SHOP : EventTypeEnum.FIGHT)
            && typeof node.detailId === 'number' && Number.isSafeInteger(node.detailId) && node.detailId > 0
            && Array.isArray(node.nextNodeIds) && this.isIdList(node.nextNodeIds);
    }

    /** 校验地图拓扑、已走路线与流程状态，拒绝断链、重复节点及重复结算存档。 */
    private isMapLevel(level: RealmLevelState, state: GameFlowState) {
        const nodes = level.mapNodes;
        const visited = level.visitedNodeIds;
        if (!Array.isArray(nodes) || !nodes.length || nodes.length > 1000
            || !nodes.every((node: unknown) => {
                return this.isMapNode(node);
            }) || !Array.isArray(visited) || !this.isIdList(visited)
            || new Set(visited).size !== visited.length || nodes.length !== level.eventIds.length) {
            return false;
        }
        const byId = new Map(nodes.map((node) => {
            return [node.id, node];
        }));
        const finalColumn = Math.max(...nodes.map((node) => {
            return node.column;
        }));
        const finalNodes = nodes.filter((node) => {
            return node.column === finalColumn;
        });
        if (finalColumn < 1 || finalNodes.length !== 1 || byId.size !== nodes.length) {
            return false;
        }
        const validNodes = nodes.every((node, index) => {
            const terminal = node.column === finalColumn;
            return node.id === index + 1 && node.eventId === level.eventIds[index]
                && node.detailId === level.eventDetailIds?.[index]
                && (terminal ? node.type === MapNodeType.Elite && !node.nextNodeIds.length
                    : node.type !== MapNodeType.Elite && node.nextNodeIds.length > 0)
                && new Set(node.nextNodeIds).size === node.nextNodeIds.length
                && node.nextNodeIds.every((id) => {
                    return byId.get(id)?.column === node.column + 1;
                }) && (node.column === 0 || nodes.some((parent) => {
                    return parent.nextNodeIds.includes(node.id);
                }));
        });
        if (!validNodes || !visited.every((id, index) => {
            return index === 0 ? byId.get(id)?.column === 0
                : !!byId.get(visited[index - 1])?.nextNodeIds.includes(id);
        })) {
            return false;
        }
        const lastId = visited[visited.length - 1] ?? 0;
        if (level.completed !== (lastId === finalNodes[0].id)) {
            return false;
        }
        if (state === GameFlowState.RouteSelect) {
            return level.currentNodeId === lastId;
        }
        const current = byId.get(level.currentNodeId ?? 0);
        return !!current && !visited.includes(current.id) && level.currentEventIndex === current.id - 1
            && (lastId ? !!byId.get(lastId)?.nextNodeIds.includes(current.id) : current.column === 0);
    }

}


