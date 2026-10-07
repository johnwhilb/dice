import { _decorator } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Save } from '../Save';
import { smc } from '../../common/SingletonModuleComp';
import { CommonStorageConfig } from '../../common/config/GameStorageConfig';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { RealmLevelState } from '../../routeSelect/model/RouteSelectModel';
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

    saveGame() {
        const flow = smc.gameFlow.GameFlowModel;
        if (flow.currentGameFlowState === GameFlowState.RoleSelect) {
            return;
        }
        const route = smc.routeSelect.RouteSelectModel;
        const player = smc.player.PlayerModel;
        const data: RunSaveData = {
            version: 2,
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

    restoreGame() {
        const data = this.readSave();
        if (!data) {
            return false;
        }
        const flow = smc.gameFlow.GameFlowModel;
        const route = smc.routeSelect.RouteSelectModel;
        const player = smc.player.PlayerModel;
        const needsMigration = data.version === 1 || data.realmLevels.some((level) => {
            return level.eventDetailIds?.length !== level.eventIds.length;
        });
        flow.currentGameFlowState = needsMigration ? GameFlowState.RouteSelect : data.state;
        flow.currentDay = data.currentDay;
        if (needsMigration) {
            smc.routeSelect.RouteSelectBll.generateRealmLevels();
            route.realmLevels.forEach((level) => {
                const savedLevel = data.realmLevels.find((item) => {
                    return item.realmId === level.realmId;
                });
                if (!savedLevel) {
                    return;
                }
                level.currentEventIndex = savedLevel.completed
                    ? level.eventIds.length
                    : Math.min(savedLevel.currentEventIndex, level.eventIds.length - 1);
                level.completed = savedLevel.completed;
                level.visited = savedLevel.visited;
            });
        } else {
            route.realmLevels = data.realmLevels;
        }
        route.currentRealmId = data.currentRealmId;
        route.originRealmId = data.originRealmId;
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

    private isSaveData(value: unknown): value is RunSaveData {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const data: Partial<RunSaveData> = value;
        return (data.version === 1 || data.version === 2)
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

}


