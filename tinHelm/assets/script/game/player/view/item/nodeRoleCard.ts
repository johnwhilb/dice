import { Sprite, _decorator } from 'cc';
import { ResPath } from '../../../common/config/ResPath';
import { TableRole } from '../../../common/table/TableRole';
import { GameComponent } from 'db://oops-framework/module/common/GameComponent';
import { smc } from '../../../common/SingletonModuleComp';
const { ccclass } = _decorator;

@ccclass('nodeRoleCard')
export class nodeRoleCard extends GameComponent {
    private currentRoleId: number = 0;

    onLoad() {
        this.nodeTreeInfoLite();
        this.setButton();
    }

    setData(data: { tableRole: TableRole, currentSelectedRoleId: number }) {
        this.currentRoleId = data.tableRole.id;
        this.setSprite(this.getNode("spRoleCard")!.getComponent(Sprite)!, ResPath.getSpriteRoleCard(data.tableRole.id));
        this.getNode('spSelected')!.active = data.tableRole.id === data.currentSelectedRoleId;
    }

    btnSelect() {
        smc.player.selectRole(this.currentRoleId);
    }

}
