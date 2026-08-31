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

const { ccclass } = _decorator;

const HP_EVERY_HEART = 20;

@ccclass("RoleSelectView")
@ecs.register("RoleSelectView", false)
@gui.register('RoleSelectView', { layer: LayerType.PopUp, prefab: 'gui/roleSelect/RoleSelectView' })
export class RoleSelectView extends CCView<GameFlow> {
    private roleList: TableRole[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.roleList = TableRole.getAllConfig();
        this.refresh();
        this.on(PlayerEvent.currentSelectedRoleIdChanged, this.refresh, this);
    }

    refresh() {
        this.updateRoleList();
        this.updateSpRole();
        this.updateRoleHp();
    }

    updateSpRole() {
        const spRole = this.getNode('spRole')!.getComponent(Sprite);
        const currentSelectRoleId = smc.player.getSelectedRoleId();
        this.setSprite(spRole, ResPath.getSpriteRoleBody(currentSelectRoleId));
    }

    updateRoleHp() {
        const currentSelectRoleId = smc.player.getSelectedRoleId();
        const tableRole = TableRole.getConfigById(currentSelectRoleId);
        const originHp = tableRole!.originHp;
        const maxHp = tableRole!.maxHp;
        const hpLayout = this.getNode('hpLayout')!;
        const fullHeartCount = Math.floor(maxHp / HP_EVERY_HEART);
        for (let i = 0; i < Math.max(fullHeartCount, hpLayout.children.length); i++) {
            let hpNode = hpLayout.children[i];
            if (i >= fullHeartCount) {
                hpNode.active = false;
                continue;
            }
            if (!hpNode) {
                hpNode = instantiate(hpLayout.children[0]);
                hpNode.parent = hpLayout;
            }
            hpNode.active = true;
        }
        const lbtHp = this.getNode('lbtHp')!;
        lbtHp.getComponent(Label).string = `${originHp}/${maxHp}`;
        // const leftOverHeart = maxHp % HP_EVERY_HEART;
        // if (leftOverHeart > 0) {
        //     const hpNode = instantiate(hpLayout.children[0]);
        //     hpNode.parent = hpLayout;
        //     const scale=leftOverHeart / HP_EVERY_HEART
        //     hpNode.setScale(scale ,scale,scale);
        //     hpNode.active = true;
        // }
    }

    updateRoleList() {
        this.getNode('roleList')!.getComponent(List).numItems = this.roleList.length;
    }

    updateRoleItem(node: Node, index: number) {
        const item = this.roleList[index];
        const currentSelectedRoleId = smc.player.getSelectedRoleId();
        node.getComponent(nodeRoleCard).setData({ tableRole: item, currentSelectedRoleId });
    }
    btnClose() {
        this.ent.closeRoleSelectView();
    }

    reset(): void {
    }




}
