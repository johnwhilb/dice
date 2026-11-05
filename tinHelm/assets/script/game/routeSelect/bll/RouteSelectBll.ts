import { smc } from '../../common/SingletonModuleComp';
import { EventTypeEnum } from '../../common/table/EventTypeEnum';
import { RouteSelect } from '../RouteSelect';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { RealmsRealmsEnum } from '../../common/table/RealmsRealmsEnum';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';
import { TableEnemy } from '../../common/table/TableEnemy';
import { TableMap } from '../../common/table/TableMap';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { MapGenerateBll } from './MapGenerateBll';

export class RouteSelectBll extends CCBusiness<RouteSelect> {
    /** 获取当前进度所属的地图配置。 */
    getCurrentMap() {
        return TableMap.getConfigById(this.getCurrentRealmLevel()?.mapId ?? 0);
    }

    /** 获取最后选择的地图节点，完成状态由 visitedNodeIds 表示。 */
    getCurrentNode() {
        const level = this.getCurrentRealmLevel();
        return level?.mapNodes.find((node) => {
            return node.id === level.currentNodeId;
        });
    }

    /** 获取当前世界地图进度。 */
    getCurrentRealmLevel() {
        return this.ent.RouteSelectModel.realmLevels.find((level) => {
            return level.realmId === this.ent.RouteSelectModel.currentRealmId;
        });
    }

    /** 本局首次进入时生成地图，事件返回与读档不重新随机。 */
    generateRoutes() {
        if (!this.getCurrentRealmLevel()) {
            this.generateRealmLevels();
        }
    }

    /** 根据始源世界和配表生成一张完整节点地图。 */
    generateRealmLevels() {
        const realmId = TableUniversal.getConfigById(UniversalNameEnum.ORIGIN_REALM)?.value
            ?? RealmsRealmsEnum.MIDGARD;
        const model = this.ent.RouteSelectModel;
        model.realmLevels = [MapGenerateBll.generate(realmId)];
        model.currentRealmId = realmId;
    }

    /** 判断 nodeId 是否为首列入口或当前已完成节点的直接后继。 */
    canSelectMapNode(nodeId: number) {
        if (smc.gameFlow.GameFlowModel.currentGameFlowState !== GameFlowState.RouteSelect) {
            return false;
        }
        const level = this.getCurrentRealmLevel();
        const node = level?.mapNodes.find((item) => {
            return item.id === nodeId;
        });
        if (!level || !node || level.completed || level.visitedNodeIds.includes(nodeId)) {
            return false;
        }
        if (!level.currentNodeId) {
            return node.column === 0;
        }
        const current = this.getCurrentNode();
        return !!current && level.visitedNodeIds.includes(current.id)
            && current.nextNodeIds.includes(nodeId);
    }

    /** 选择可达节点并进入事件；nodeId 为本张地图内的节点 ID。 */
    selectMapNode(nodeId: number) {
        if (!this.canSelectMapNode(nodeId)) {
            return false;
        }
        const level = this.getCurrentRealmLevel()!;
        const node = level.mapNodes.find((item) => {
            return item.id === nodeId;
        })!;
        const valid = node.eventId === EventTypeEnum.SHOP
            ? !!TableShopEvent.getConfigById(node.detailId)
            : !!TableEnemy.getConfigById(node.detailId);
        if (!valid) {
            return false;
        }
        level.currentNodeId = nodeId;
        smc.shop.clear();
        smc.unknownEvent.clear();
        if (node.eventId === EventTypeEnum.SHOP) {
            smc.shop.prepare(smc.player.getSelectedRoleId(), node.detailId);
        }
        smc.gameFlow.GameFlowBll.setGameFlowState(GameFlowState.Event);
        smc.save.saveGame();
        return this.openCurrentEvent();
    }

    /** 恢复已选事件，使用存档节点详情，不改变地图或完成进度。 */
    openCurrentEvent() {
        const node = this.getCurrentNode();
        if (!node || this.getCurrentRealmLevel()?.visitedNodeIds.includes(node.id)) {
            return false;
        }
        if (node.eventId === EventTypeEnum.SHOP) {
            if (!TableShopEvent.getConfigById(node.detailId)) {
                return false;
            }
            smc.shop.prepare(smc.player.getSelectedRoleId(), node.detailId);
            smc.shop.openShopView();
        } else {
            if (!TableEnemy.getConfigById(node.detailId)) {
                return false;
            }
            smc.battle.setEnemy(node.detailId);
            smc.battle.openBattleView();
        }
        return true;
    }

    /** 结算后记录路线，完成末列事件后封闭本局地图。 */
    completeCurrentEvent() {
        const level = this.getCurrentRealmLevel();
        const current = this.getCurrentNode();
        if (!level || !current || level.completed || level.visitedNodeIds.includes(current.id)) {
            return;
        }
        level.visitedNodeIds.push(current.id);
        level.completed = current.nextNodeIds.length === 0;
        smc.shop.clear();
        smc.unknownEvent.clear();
    }
}
