import { CCView } from 'db://oops-framework/module/common/CCView';
import { Node, _decorator } from 'cc';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Profile } from '../Profile';
import { TableRole } from '../../common/table/TableRole';
import List from '../../ui/List';
import { smc } from '../../common/SingletonModuleComp';
import { ProfileEvent } from '../ProfileEvent';
import { nodeRoleItem } from './item/nodeRoleItem';
import { Sprite } from 'cc';
import { ResPath } from '../../common/config/ResPath';
const { ccclass } = _decorator;

@ccclass("ProfileDialog")
@ecs.register("ProfileDialog", false)
@gui.register('ProfileDialog', { layer: LayerType.PopUp, prefab: 'gui/profile/ProfileDialog' })
export class ProfileDialog extends CCView<Profile> {

    private roleList: TableRole[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.roleList = TableRole.getAllConfig();
        this.refresh();
        this.on(ProfileEvent.currentSelectAvatarIdChanged, this.refresh, this);
        this.on(ProfileEvent.currentSelectedAvatarIdChanged, this.refresh, this);
    }

    refresh() {
        this.updateRoleList();
        this.updateSpRole();
    }

    updateSpRole() {
        const spRole = this.getNode('spRole')!.getComponent(Sprite);
        const currentSelectAvatarId = smc.profile.getCurrentSelectAvatarId();
        this.setSprite(spRole, ResPath.getSpriteRoleBody(currentSelectAvatarId));
    }

    updateRoleList() {
        this.getNode('roleList')!.getComponent(List).numItems = this.roleList.length;
    }

    updateRoleItem(node: Node, index: number) {
        const item = this.roleList[index];
        const currentSelectedAvatarId = this.ent.getCurrentSelectedAvatarId();
        const currentSelectAvatarId = this.ent.getCurrentSelectAvatarId();
        node.getComponent(nodeRoleItem).setData({ tableRole: item, currentSelectedAvatarId, currentSelectAvatarId });
    }

    btnSave() {
        this.ent.changeCurrentSelectedAvatarId();
    }

    reset() {
    }

    btnClose() {
        this.ent.close();
    }


}
