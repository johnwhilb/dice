import { Sprite, _decorator } from 'cc';
import { ResPath } from '../../../common/config/ResPath';
import { TableRole } from '../../../common/table/TableRole';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { smc } from '../../../common/SingletonModuleComp';
const { ccclass } = _decorator;

@ccclass('nodeRoleItem')
export class nodeRoleItem extends GameComponent {
    private currentRoleId: number = 0;

    onLoad() {
        this.nodeTreeInfoLite();
        this.setButton();
    }

    setData(data: { tableRole: TableRole, currentSelectedAvatarId: number, currentSelectAvatarId: number }) {
        this.currentRoleId = data.tableRole.id;
        const spRoleHead = this.getNode("spRoleHead")!.getComponent(Sprite)!;
        this.setSprite(spRoleHead, ResPath.getSpriteRoleHead(data.tableRole.id));
        this.getNode('spSelected')!.active = data.tableRole.id === data.currentSelectedAvatarId;
        this.getNode('spSelect')!.active = data.tableRole.id === data.currentSelectAvatarId;
    }

    btnSelect() {
        smc.profile.changeCurrentSelectAvatarId(this.currentRoleId);
    }

}
