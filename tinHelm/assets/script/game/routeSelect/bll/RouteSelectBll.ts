import { smc } from '../../common/SingletonModuleComp';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { RouteSelect } from '../RouteSelect';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { TableEvent } from '../../common/table/TableEvent';
import { TableRealms } from '../../common/table/TableRealms';
import { RealmsRealmsEnum } from '../../common/table/RealmsRealmsEnum';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { RealmLevelState, TravelRouteType } from '../model/RouteSelectModel';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { TableFightEvent } from '../../common/table/TableFightEvent';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { TableRelmEvent } from '../../common/table/TableRelmEvent';
import { RouteSelectEvent } from '../RouteSelectEvent';

export class RouteSelectBll extends CCBusiness<RouteSelect> {

    getCurrentRealm() {
        return TableRealms.getConfigById(this.ent.RouteSelectModel.currentRealmId);
    }

    getCurrentEvent() {
        const level = this.getCurrentRealmLevel();
        const eventId = level?.eventIds[level.currentEventIndex] ?? 0;
        return TableEvent.getConfigById(eventId);
    }

    getCurrentEventDetail() {
        const currentEvent = this.getCurrentEvent();
        const level = this.getCurrentRealmLevel();
        const detailId = level?.eventDetailIds?.[level.currentEventIndex]
            ?? this.ent.RouteSelectModel.currentEventDetailId;
        if (currentEvent?.id === EventTypeEnum.SHOP) {
            const shopEvent = smc.shop.prepare(
                smc.player.getSelectedRoleId(),
                detailId,
            );
            this.ent.RouteSelectModel.currentEventDetailId = shopEvent?.id ?? 0;
            return shopEvent;
        }
        if (currentEvent?.id === EventTypeEnum.FIGHT) {
            const fightEvent = TableFightEvent.getConfigById(detailId);
            this.ent.RouteSelectModel.currentEventDetailId = fightEvent?.id ?? 0;
            return fightEvent;
        }

        this.ent.RouteSelectModel.currentEventDetailId = 0;
        smc.shop.clear();
        return null;
    }

    getTravelRoute() {
        return this.ent.RouteSelectModel.travelRoute;
    }

    getRealmLevels() {
        return this.ent.RouteSelectModel.realmLevels;
    }

    getCurrentRealmLevel() {
        return this.ent.RouteSelectModel.realmLevels.find((level) => {
            return level.realmId === this.ent.RouteSelectModel.currentRealmId;
        });
    }

    generateRoutes() {
        if (!this.ent.RouteSelectModel.realmLevels.length) {
            this.generateRealmLevels();
        }
        this.updateTravelRoute();
    }

    generateRealmLevels() {
        const originRealmId = this.getUniversalValue(UniversalNameEnum.ORIGIN_REALM, RealmsRealmsEnum.MIDGARD);

        this.ent.RouteSelectModel.realmLevels = TableRealms.getAllConfig().map((realm) => {
            return this.createRealmLevel(realm.id);
        });
        this.ent.RouteSelectModel.originRealmId = originRealmId;
        this.ent.RouteSelectModel.currentRealmId = originRealmId;

        const originLevel = this.getCurrentRealmLevel();
        if (originLevel) {
            originLevel.visited = true;
        }
    }

    selectCurrentEvent() {
        if (smc.gameFlow.GameFlowModel.currentGameFlowState === GameFlowState.Event) {
            return false;
        }
        const currentEvent = this.getCurrentEvent();
        const eventDetail = this.getCurrentEventDetail();
        if (!currentEvent || !eventDetail) {
            return false;
        }

        smc.gameFlow.GameFlowBll.setGameFlowState(GameFlowState.Event);
        smc.save.saveGame();
        return this.openCurrentEvent();
    }

    /** 恢复事件时只打开界面，不重复计时或生成关卡。 */
    openCurrentEvent() {
        const currentEvent = this.getCurrentEvent();
        const eventDetail = this.getCurrentEventDetail();
        if (!currentEvent || !eventDetail) {
            return false;
        }
        switch (currentEvent.id) {
            case EventTypeEnum.FIGHT: {
                const fightEvent = TableFightEvent.getConfigById(eventDetail.id);
                if (!fightEvent) {
                    return false;
                }
                smc.battle.setEnemy(fightEvent.enemyId);
                smc.battle.openBattleView();
                break;
            }
            case EventTypeEnum.SHOP:
                smc.shop.openShopView();
                break;
            default:
                return false;
        }
        return true;
    }

    selectTravelRoute() {
        if (smc.gameFlow.GameFlowModel.currentGameFlowState === GameFlowState.Event) {
            return false;
        }
        const candidates = this.ent.RouteSelectModel.realmLevels.filter((level) => {
            return level.realmId !== this.ent.RouteSelectModel.currentRealmId
                && level.realmId !== RealmsRealmsEnum.ASGARD
                && !level.completed;
        });
        if (!candidates.length) {
            return false;
        }

        const target = candidates[Math.floor(Math.random() * candidates.length)];
        this.enterRealm(target.realmId);
        return this.selectCurrentEvent();
    }

    canTravelToRealm(realmId: number) {
        if (smc.gameFlow.GameFlowModel.currentGameFlowState === GameFlowState.Event) {
            return false;
        }
        if (realmId === this.ent.RouteSelectModel.currentRealmId) {
            return false;
        }
        const level = this.ent.RouteSelectModel.realmLevels.find((item) => {
            return item.realmId === realmId;
        });
        if (!level || level.completed) {
            return false;
        }
        if (realmId === this.ent.RouteSelectModel.originRealmId) {
            return true;
        }

        const anchorCount = this.ent.RouteSelectModel.anchorCount;
        const finalNeed = this.getUniversalValue(UniversalNameEnum.FINAL_TELEPORT, 3);
        const directionNeed = this.getUniversalValue(UniversalNameEnum.DIRECTION_TELEPORT, 2);
        const recordNeed = this.getUniversalValue(UniversalNameEnum.RECORD_TELEPORT, 1);

        if (realmId === RealmsRealmsEnum.ASGARD) {
            return anchorCount >= finalNeed;
        }
        if (anchorCount >= directionNeed) {
            return true;
        }
        if (anchorCount >= recordNeed) {
            return this.ent.RouteSelectModel.recordedRealmId === realmId;
        }
        return false;
    }

    selectRealmRoute(realmId: number) {
        if (!this.canTravelToRealm(realmId)) {
            return false;
        }
        if (!this.enterRealm(realmId)) {
            return false;
        }
        return this.selectCurrentEvent();
    }

    private enterRealm(realmId: number) {
        if (!TableRealms.getConfigById(realmId)) {
            return false;
        }

        this.ent.RouteSelectModel.currentRealmId = realmId;
        this.ent.RouteSelectModel.currentEventDetailId = 0;
        smc.shop.clear();
        const level = this.getCurrentRealmLevel();
        if (level) {
            level.visited = true;
        }
        const recordNeed = this.getUniversalValue(UniversalNameEnum.RECORD_TELEPORT, 1);
        if (this.ent.RouteSelectModel.anchorCount === recordNeed
            && realmId !== this.ent.RouteSelectModel.originRealmId) {
            this.ent.RouteSelectModel.recordedRealmId = realmId;
        }
        this.updateTravelRoute();
        return true;
    }

    completeCurrentEvent() {
        const level = this.getCurrentRealmLevel();
        if (!level || level.completed) {
            return;
        }

        level.currentEventIndex += 1;
        this.ent.RouteSelectModel.currentEventDetailId = 0;
        smc.shop.clear();
        level.completed = level.currentEventIndex >= level.eventIds.length;
        if (level.completed && level.realmId !== RealmsRealmsEnum.ASGARD) {
            this.ent.RouteSelectModel.anchorCount += 1;
            this.dispatchEvent(RouteSelectEvent.anchorCountChanged);
        }
        this.updateTravelRoute();
    }

    private createRealmLevel(realmId: number): RealmLevelState {
        const floorCount = this.getUniversalValue(UniversalNameEnum.REALM_EVENT_NUM, 10);
        const floorConfigs = TableRelmEvent.getAllConfig().filter((item) => {
            return item.realms === realmId;
        });
        const eventIds: number[] = [];
        const eventDetailIds: number[] = [];

        for (const floor of Array.from({ length: floorCount }, (_, index) => index + 1)) {
            const config = floorConfigs.find((item) => {
                return item.level === floor;
            });
            if (!config) {
                throw new Error(`世界 ${realmId} 缺少第 ${floor} 层事件配置`);
            }

            const fightPool = config.fightPool.filter((id): id is number => {
                return typeof id === 'number'
                    && !!TableEnemy.getConfigById(TableFightEvent.getConfigById(id)?.enemyId ?? 0);
            });
            const shopPool = config.shopPool.filter((id): id is number => {
                return typeof id === 'number' && !!TableShopEvent.getConfigById(id);
            });
            const candidates = config.maybeEvent.filter((id): id is number => {
                return (id === EventTypeEnum.FIGHT && !!fightPool.length)
                    || (id === EventTypeEnum.SHOP && !!shopPool.length);
            });
            if (!candidates.length) {
                throw new Error(`世界 ${realmId} 第 ${floor} 层没有可用事件`);
            }

            const eventId = candidates[Math.floor(Math.random() * candidates.length)];
            const pool = eventId === EventTypeEnum.FIGHT ? fightPool : shopPool;
            eventIds.push(eventId);
            eventDetailIds.push(pool[Math.floor(Math.random() * pool.length)]);
        }

        return {
            realmId,
            eventIds,
            eventDetailIds,
            currentEventIndex: 0,
            completed: false,
            visited: false,
        };
    }

    private updateTravelRoute() {
        const anchorCount = this.ent.RouteSelectModel.anchorCount;
        const finalNeed = this.getUniversalValue(UniversalNameEnum.FINAL_TELEPORT, 3);
        const directionNeed = this.getUniversalValue(UniversalNameEnum.DIRECTION_TELEPORT, 2);
        const recordNeed = this.getUniversalValue(UniversalNameEnum.RECORD_TELEPORT, 1);
        let type = TravelRouteType.RANDOM;
        let des = '随机探索其他世界；可返回始源世界';

        if (anchorCount >= finalNeed) {
            type = TravelRouteType.ASGARD;
            des = '可随机探索、八界指定传送，或前往阿斯加德';
        } else if (anchorCount >= directionNeed) {
            type = TravelRouteType.DIRECTIONAL;
            des = '可随机探索、返回始源世界，或在八界中指定传送';
        } else if (anchorCount >= recordNeed) {
            type = TravelRouteType.ANCHOR;
            des = '可随机探索、返回始源世界，或前往界锚记录世界';
        }

        this.ent.RouteSelectModel.travelRoute = {
            type,
            name: '跨界移动',
            des,
        };
    }

    private getUniversalValue(id: UniversalNameEnum, fallback: number) {
        return TableUniversal.getConfigById(id)?.value ?? fallback;
    }
}
