import { smc } from '../../common/SingletonModuleComp';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { RouteSelect } from '../RouteSelect';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { TableEvent } from '../../common/table/TableEvent';
import { TableRealms } from '../../common/table/TableRealms';
import { RealmsRealmsEnum } from '../../common/table/RealmsRealmsEnum';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { TableFightEvent } from '../../common/table/TableFightEvent';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { MapGenerateBll } from './MapGenerateBll';

export class RouteSelectBll extends CCBusiness<RouteSelect> {
    /** 获取当前地图所属的世界配置。 */
    getCurrentRealm() {
        return TableRealms.getConfigById(this.ent.RouteSelectModel.currentRealmId);
    }

    /** 获取最后选择的地图节点，完成状态由 visitedNodeIds 表示。 */
    getCurrentNode() {
        const level = this.getCurrentRealmLevel();
        return level?.mapNodes?.find((node) => {
            return node.id === level.currentNodeId;
        });
    }

    /** 获取当前节点的事件类型，未选节点时返回空配置。 */
    getCurrentEvent() {
        return TableEvent.getConfigById(this.getCurrentNode()?.eventId ?? 0);
    }

    /** 读取生成时固定的事件详情，商店库存由商店模块保留。 */
    getCurrentEventDetail() {
        const node = this.getCurrentNode();
        if (!node) {
            return null;
        }
        if (node.eventId === EventTypeEnum.SHOP) {
            return smc.shop.prepare(smc.player.getSelectedRoleId(), node.detailId);
        }
        return TableFightEvent.getConfigById(node.detailId);
    }

    /** 保留旧界面描述接口，地图选点统一通过 selectMapNode 执行。 */
    getTravelRoute() {
        return this.ent.RouteSelectModel.travelRoute;
    }

    /** 返回本局地图数据，包含节点、连线和已完成路线。 */
    getRealmLevels() {
        return this.ent.RouteSelectModel.realmLevels;
    }

    /** 获取当前世界地图进度。 */
    getCurrentRealmLevel() {
        return this.getRealmLevels().find((level) => {
            return level.realmId === this.ent.RouteSelectModel.currentRealmId;
        });
    }

    /** 本局首次进入时生成地图，事件返回与读档不重新随机。 */
    generateRoutes() {
        if (!this.getCurrentRealmLevel()?.mapNodes?.length) {
            this.generateRealmLevels();
        }
    }

    /** 根据始源世界和配表生成一张完整节点地图。 */
    generateRealmLevels() {
        const realmId = TableUniversal.getConfigById(UniversalNameEnum.ORIGIN_REALM)?.value
            ?? RealmsRealmsEnum.MIDGARD;
        const model = this.ent.RouteSelectModel;
        model.realmLevels = [MapGenerateBll.generate(realmId)];
        model.originRealmId = realmId;
        model.currentRealmId = realmId;
        model.currentEventDetailId = 0;
    }

    /** 将旧线性进度映射到一条合法路径，completedCount 为已完成关数，终点保留实战挑战。 */
    migrateLegacyProgress(completedCount: number) {
        const level = this.getCurrentRealmLevel()!;
        const nodes = level.mapNodes ?? [];
        let next = nodes.find((node) => {
            return node.column === 0;
        });
        const visited: number[] = [];
        while (next && next.nextNodeIds.length && visited.length < completedCount) {
            visited.push(next.id);
            level.currentNodeId = next.id;
            level.currentEventIndex = next.id - 1;
            const nextId = next.nextNodeIds[0];
            next = nodes.find((node) => {
                return node.id === nextId;
            });
        }
        level.visitedNodeIds = visited;
    }

    /** 判断 nodeId 是否为首列入口或当前已完成节点的直接后继。 */
    canSelectMapNode(nodeId: number) {
        if (smc.gameFlow.GameFlowModel.currentGameFlowState !== GameFlowState.RouteSelect) {
            return false;
        }
        const level = this.getCurrentRealmLevel();
        const node = level?.mapNodes?.find((item) => {
            return item.id === nodeId;
        });
        if (!level || !node || level.completed || level.visitedNodeIds?.includes(nodeId)) {
            return false;
        }
        if (!level.currentNodeId) {
            return node.column === 0;
        }
        const current = this.getCurrentNode();
        return !!current && !!level.visitedNodeIds?.includes(current.id)
            && current.nextNodeIds.includes(nodeId);
    }

    /** 选择可达节点并进入事件；nodeId 为本张地图内的节点 ID。 */
    selectMapNode(nodeId: number) {
        if (!this.canSelectMapNode(nodeId)) {
            return false;
        }
        const level = this.getCurrentRealmLevel()!;
        const node = level.mapNodes!.find((item) => {
            return item.id === nodeId;
        })!;
        const valid = node.eventId === EventTypeEnum.SHOP
            ? !!TableShopEvent.getConfigById(node.detailId)
            : !!TableFightEvent.getConfigById(node.detailId);
        if (!valid) {
            return false;
        }
        level.currentNodeId = nodeId;
        level.currentEventIndex = nodeId - 1;
        this.ent.RouteSelectModel.currentEventDetailId = node.detailId;
        smc.shop.clear();
        smc.unknownEvent.clear();
        this.getCurrentEventDetail();
        smc.gameFlow.GameFlowBll.setGameFlowState(GameFlowState.Event);
        smc.save.saveGame();
        return this.openCurrentEvent();
    }

    /** 兼容旧按钮入口，要求玩家在地图上明确选择节点。 */
    selectCurrentEvent() {
        this.ent.openMapView();
        return false;
    }

    /** 恢复已选事件，使用存档节点详情，不改变地图或完成进度。 */
    openCurrentEvent() {
        const node = this.getCurrentNode();
        if (!node || this.getCurrentRealmLevel()?.visitedNodeIds?.includes(node.id)) {
            return false;
        }
        const detail = this.getCurrentEventDetail();
        if (!detail) {
            return false;
        }
        if (node.eventId === EventTypeEnum.SHOP) {
            smc.shop.openShopView();
        } else {
            const fight = TableFightEvent.getConfigById(node.detailId);
            if (!fight) {
                return false;
            }
            smc.battle.setEnemy(fight.enemyId);
            smc.battle.openBattleView();
        }
        return true;
    }

    /** 旧随机传送入口转为打开地图，避免绕过连线选点规则。 */
    selectTravelRoute() {
        return this.selectCurrentEvent();
    }

    /** 结算后记录路线，终点精英结算完成后封闭本局地图。 */
    completeCurrentEvent() {
        const level = this.getCurrentRealmLevel();
        const current = this.getCurrentNode();
        if (!level || !current || level.completed) {
            return;
        }
        const visited = level.visitedNodeIds ?? [];
        if (visited.includes(current.id)) {
            return;
        }
        visited.push(current.id);
        level.visitedNodeIds = visited;
        level.completed = current.nextNodeIds.length === 0;
        this.ent.RouteSelectModel.currentEventDetailId = 0;
        smc.shop.clear();
        smc.unknownEvent.clear();
    }
}
