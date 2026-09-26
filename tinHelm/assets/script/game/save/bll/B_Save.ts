import { _decorator } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Save } from '../Save';
import { smc } from '../../common/SingletonModuleComp';
import { CommonStorageConfig } from '../../common/config/GameStorageConfig';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { RealmLevelState } from '../../routeSelect/model/RouteSelectModel';
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
    roleId: number;
    hp: number;
    maxHp: number;
    handCard: number[];
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
            version: 1,
            state: flow.currentGameFlowState,
            currentDay: flow.currentDay,
            currentRealmId: route.currentRealmId,
            originRealmId: route.originRealmId,
            realmLevels: route.realmLevels,
            anchorCount: route.anchorCount,
            recordedRealmId: route.recordedRealmId,
            currentEventDetailId: route.currentEventDetailId,
            shopCardIds: smc.shop.ShopModel.cardIds,
            roleId: player.roleId,
            hp: player.hp,
            maxHp: player.maxHp,
            handCard: player.handCard,
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
        flow.currentGameFlowState = data.state;
        flow.currentDay = data.currentDay;
        route.currentRealmId = data.currentRealmId;
        route.originRealmId = data.originRealmId;
        route.realmLevels = data.realmLevels;
        route.anchorCount = data.anchorCount;
        route.recordedRealmId = data.recordedRealmId;
        route.currentEventDetailId = data.currentEventDetailId ?? 0;
        smc.shop.restore(data.currentEventDetailId ?? 0, data.roleId, data.shopCardIds ?? []);
        player.roleId = data.roleId;
        player.hp = data.hp;
        player.maxHp = data.maxHp;
        player.handCard = data.handCard;
        smc.routeSelect.generateRoutes();
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
        return data.version === 1
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
            && typeof data.roleId === 'number'
            && typeof data.hp === 'number'
            && typeof data.maxHp === 'number'
            && Array.isArray(data.handCard)
            && data.handCard.every((id: unknown) => {
                return typeof id === 'number';
            })
            && Array.isArray(data.realmLevels)
            && data.realmLevels.length > 0
            && data.realmLevels.every((level: unknown) => {
                return this.isRealmLevel(level);
            })
            && data.realmLevels.some((level) => {
                return level.realmId === data.currentRealmId
                    && (data.state !== GameFlowState.Event || !!level.eventIds[level.currentEventIndex]);
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
            });
    }

}


