import { CCView } from 'db://oops-framework/module/common/CCView';
import { Node, _decorator } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { TableRole } from '../../common/table/TableRole';
import { Sprite } from 'cc';
import List from '../../ui/List';
import { smc } from '../../common/SingletonModuleComp';
import { ResPath } from '../../common/config/ResPath';
import { nodeRoleCard } from './item/nodeRoleCard';
import { PlayerEvent } from '../PlayerEvent';
import { GameFlow } from '../../gameFlow/GameFlow';
import { instantiate } from 'cc';
import { Label } from 'cc';
import { tween } from 'cc';
import { Vec3 } from 'cc';
import { UITransform } from 'cc';
import { nodeCard } from '../../card/nodeCard';
import { TableCard } from '../../common/table/TableCard';
import { GameFlowState } from '../../gameFlow/model/GameFlowModel';

const { ccclass } = _decorator;

const HP_EVERY_HEART = 20;
const TABS = {
    ROLE: 1,
    CARD: 2,
}

@ccclass("RoleSelectView")
@ecs.register("RoleSelectView", false)
@gui.register('RoleSelectView', { layer: LayerType.UI, prefab: 'gui/roleSelect/RoleSelectView' })
export class RoleSelectView extends CCView<GameFlow> {
    private roleList: TableRole[] = [];
    private currentTab = TABS.ROLE;

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.roleList = TableRole.getAllConfig();
        this.refresh();
        this.on(PlayerEvent.currentSelectedRoleIdChanged, this.refresh, this);
    }

    refresh() {
        this.updateTab();
    }

    updateTab() {
        const btnRole = this.getNode('btnRole')!;
        const btnCard = this.getNode('btnCard')!;
        const spSelect = this.getNode('spSelect')!;
        const roleList = this.getNode('roleList')!;
        const cardList = this.getNode('cardList')!;
        roleList.active = this.currentTab === TABS.ROLE;
        cardList.active = this.currentTab === TABS.CARD;
        if (this.currentTab === TABS.ROLE) {
            tween(spSelect)
                .to(0.1, { position: new Vec3(0, btnRole.position.y, 0) })
                .start();
            this.updateRoleList();
        } else if (this.currentTab === TABS.CARD) {
            tween(spSelect)
                .to(0.1, { position: new Vec3(0, btnCard.position.y, 0) })
                .start();
            this.updateCardList();
        }

    }

    updateRoleList() {
        this.getNode('roleList')!.getComponent(List).numItems = this.roleList.length;
    }

    updateCardList() {
        const currentSelectRoleId = smc.player.getSelectedRoleId();
        const tableRole = TableRole.getConfigById(currentSelectRoleId);
        const cardList = tableRole!.originCards;
        this.getNode('cardList')!.getComponent(List).numItems = cardList.length;
    }

    updateRoleItem(node: Node, index: number) {
        const item = this.roleList[index];
        const currentSelectedRoleId = smc.player.getSelectedRoleId();
        node.getComponent(nodeRoleCard).setData({ tableRole: item, currentSelectedRoleId });
    }

    updateCardItem(node: Node, index: number) {
        const currentSelectRoleId = smc.player.getSelectedRoleId();
        const tableRole = TableRole.getConfigById(currentSelectRoleId);
        const cardList = tableRole!.originCards;
        const item = TableCard.getConfigById(cardList[index]);
        node.getComponent(nodeCard).setData(item!);
    }

    btnNext() {
        this.ent.GameFlowBll.AdvanceGameFlowState();
        this.ent.closeRoleSelectView();
    }

    btnClose() {
        this.ent.closeRoleSelectView();
    }

    btnRole() {
        this.currentTab = TABS.ROLE;
        this.updateTab();
    }

    btnCard() {
        this.currentTab = TABS.CARD;
        this.updateTab();
    }

    reset(): void {
    }
}
