import { _decorator } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Save } from '../Save';
import { smc } from '../../common/SingletonModuleComp';
import { CommonStorageConfig } from '../../common/config/GameStorageConfig';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { MapNodeData, MapNodeType, RealmLevelState } from '../../routeSelect/model/RouteSelectModel';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { TableMap } from '../../common/table/TableMap';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { PlayerEvent } from '../../player/PlayerEvent';
import { RouteSelectEvent } from '../../routeSelect/RouteSelectEvent';
const { ccclass } = _decorator;

interface RunSaveData {
    version: number;
    state: GameFlowState;
    currentDay: number;
    currentRealmId: number;
    realmLevels: RealmLevelState[];
    anchorCount: number;
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
            version: 4,
            state: flow.currentGameFlowState,
            currentDay: flow.currentDay,
            currentRealmId: route.currentRealmId,
            realmLevels: route.realmLevels,
            anchorCount: route.anchorCount,
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

    /** 恢复当前版本的地图、路线和玩家数据，不重新生成节点。 */
    restoreGame() {
        const data = this.readSave();
        if (!data) {
            return false;
        }
        const flow = smc.gameFlow.GameFlowModel;
        const route = smc.routeSelect.RouteSelectModel;
        const player = smc.player.PlayerModel;
        flow.currentGameFlowState = data.state;
        flow.currentDay = data.currentDay;
        route.realmLevels = data.realmLevels;
        route.currentRealmId = data.currentRealmId;
        route.anchorCount = data.anchorCount;
        const currentNode = smc.routeSelect.RouteSelectBll.getCurrentNode();
        const shopId = data.state === GameFlowState.Event && currentNode?.eventId === EventTypeEnum.SHOP
            ? currentNode.detailId : 0;
        smc.shop.restore(shopId, data.roleId, data.shopCardIds ?? [],
            data.shopItemIds, data.shopBoughtCardIds ?? [], data.shopBoughtItemIds ?? []);
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

    /** 校验当前存档版本、玩家数据和节点地图，value 为原始存档对象。 */
    private isSaveData(value: unknown): value is RunSaveData {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const data: Partial<RunSaveData> = value;
        return data.version === 4
            && (data.state === GameFlowState.RouteSelect || data.state === GameFlowState.Event)
            && typeof data.currentDay === 'number' && data.currentDay >= 1
            && typeof data.currentRealmId === 'number'
            && typeof data.anchorCount === 'number'
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
            && data.realmLevels.every((level) => {
                return this.isMapLevel(level, data.state ?? GameFlowState.RouteSelect);
            })
            && data.realmLevels.some((level) => {
                return level.realmId === data.currentRealmId;
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

    /** 校验地图归属和完成状态，value 为原始地图记录。 */
    private isRealmLevel(value: unknown): value is RealmLevelState {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const level: Partial<RealmLevelState> = value;
        return typeof level.realmId === 'number'
            && typeof level.mapId === 'number' && !!TableMap.getConfigById(level.mapId)
            && typeof level.completed === 'boolean'
            && typeof level.currentNodeId === 'number' && Number.isSafeInteger(level.currentNodeId)
            && level.currentNodeId >= 0;
    }

    /** 校验节点字段和事件类型，value 为反序列化得到的未知节点。 */
    private isMapNode(value: unknown): value is MapNodeData {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const node: Partial<MapNodeData> = value;
        return typeof node.id === 'number' && Number.isSafeInteger(node.id) && node.id > 0
            && typeof node.column === 'number' && Number.isSafeInteger(node.column) && node.column >= 0
            && typeof node.lane === 'number' && Number.isSafeInteger(node.lane) && node.lane >= 0
            && typeof node.offsetY === 'number' && Number.isFinite(node.offsetY) && Math.abs(node.offsetY) <= 0.15
            && (node.type === MapNodeType.Fight || node.type === MapNodeType.Shop || node.type === MapNodeType.Elite)
            && node.eventId === (node.type === MapNodeType.Shop ? EventTypeEnum.SHOP : EventTypeEnum.FIGHT)
            && typeof node.detailId === 'number' && Number.isSafeInteger(node.detailId) && node.detailId > 0
            && (node.eventId === EventTypeEnum.SHOP ? !!TableShopEvent.getConfigById(node.detailId)
                : !!TableEnemy.getConfigById(node.detailId))
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
            || new Set(visited).size !== visited.length) {
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
        if (finalColumn < 0 || !finalNodes.length || byId.size !== nodes.length) {
            return false;
        }
        const validNodes = nodes.every((node, index) => {
            const terminal = node.column === finalColumn;
            return node.id === index + 1
                && (terminal ? !node.nextNodeIds.length
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
        if (level.completed !== finalNodes.some((node) => {
            return node.id === lastId;
        })) {
            return false;
        }
        if (state === GameFlowState.RouteSelect) {
            return level.currentNodeId === lastId;
        }
        const current = byId.get(level.currentNodeId);
        return !!current && !visited.includes(current.id)
            && (lastId ? !!byId.get(lastId)?.nextNodeIds.includes(current.id) : current.column === 0);
    }

}


