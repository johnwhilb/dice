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

export class RouteSelectBll extends CCBusiness<RouteSelect> {

    getCurrentRealm() {
        return TableRealms.getConfigById(this.ent.RouteSelectModel.currentRealmId);
    }

    getCurrentEvent() {
        const level = this.getCurrentRealmLevel();
        const eventId = level?.eventIds[level.currentEventIndex] ?? 0;
        return TableEvent.getConfigById(eventId);
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
        const eventCount = this.getUniversalValue(UniversalNameEnum.REALM_EVENT_NUM, 10);
        const enemyCount = this.getUniversalValue(UniversalNameEnum.REALM_ENEMY_EVENT_NUM, 5);
        const otherCount = this.getUniversalValue(UniversalNameEnum.REALM_OTHER_EVENT_NUM, 5);
        const originRealmId = this.getUniversalValue(UniversalNameEnum.ORIGIN_REALM, RealmsRealmsEnum.MIDGARD);

        this.ent.RouteSelectModel.realmLevels = TableRealms.getAllConfig().map((realm) => {
            return this.createRealmLevel(realm.id, realm.eventPool, realm.bossEventId, eventCount, enemyCount, otherCount);
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
        if (!currentEvent) {
            return false;
        }

        smc.gameFlow.advanceDay();
        smc.gameFlow.GameFlowBll.setGameFlowState(GameFlowState.Event);
        smc.save.saveGame();
        return this.openCurrentEvent();
    }

    /** 恢复事件时只打开界面，不重复计时或生成关卡。 */
    openCurrentEvent() {
        const currentEvent = this.getCurrentEvent();
        if (!currentEvent) {
            return false;
        }
        switch (currentEvent.id) {
            case EventTypeEnum.STORY:
                smc.storyEvent.openStoryEventView();
                break;
            case EventTypeEnum.ENEMY:
            case EventTypeEnum.ELETE_ENEMY:
                smc.battle.openBattleView();
                break;
            case EventTypeEnum.SHOP:
            case EventTypeEnum.TREASURE:
                smc.storyEvent.openStoryEventView();
                break;
            default:
                break;
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
        level.completed = level.currentEventIndex >= level.eventIds.length;
        if (level.completed && level.realmId !== RealmsRealmsEnum.ASGARD) {
            this.ent.RouteSelectModel.anchorCount += 1;
        }
        this.updateTravelRoute();
    }

    private createRealmLevel(
        realmId: number,
        rawEventPool: unknown[],
        bossEventId: number,
        eventCount: number,
        enemyCount: number,
        otherCount: number,
    ): RealmLevelState {
        if (realmId === RealmsRealmsEnum.ASGARD) {
            return {
                realmId,
                eventIds: [bossEventId],
                currentEventIndex: 0,
                completed: false,
                visited: false,
            };
        }

        const eventPool = rawEventPool.filter((eventId): eventId is number => {
            return typeof eventId === 'number' && !!TableEvent.getConfigById(eventId);
        });
        const enemyPool = eventPool.filter((eventId) => {
            return eventId === EventTypeEnum.ENEMY || eventId === EventTypeEnum.ELETE_ENEMY;
        });
        const otherPool = eventPool.filter((eventId) => {
            return !enemyPool.includes(eventId);
        });
        const normalEventCount = Math.max(eventCount - 1, 0);
        const enemyEventCount = Math.min(Math.max(enemyCount - 1, 0), normalEventCount);
        const otherEventCount = Math.min(otherCount, normalEventCount - enemyEventCount);
        const events = [
            ...this.pickEvents(enemyPool, enemyEventCount),
            ...this.pickEvents(otherPool, otherEventCount),
        ];

        while (events.length < normalEventCount && eventPool.length) {
            events.push(this.pickEvents(eventPool, 1)[0]);
        }

        return {
            realmId,
            eventIds: [...this.shuffle(events), bossEventId],
            currentEventIndex: 0,
            completed: false,
            visited: false,
        };
    }

    private pickEvents(pool: number[], count: number) {
        if (!pool.length) {
            return [];
        }

        return Array.from({ length: count }, () => {
            return pool[Math.floor(Math.random() * pool.length)];
        });
    }

    private shuffle(events: number[]) {
        const result = [...events];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const targetIndex = Math.floor(Math.random() * (index + 1));
            const current = result[index];
            result[index] = result[targetIndex];
            result[targetIndex] = current;
        }
        return result;
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
