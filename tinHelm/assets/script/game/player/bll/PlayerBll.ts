import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Player } from '../Player';
import { PlayerEvent } from '../PlayerEvent';

export class PlayerBll extends CCBusiness<Player> {

    selectRole(roleId: number) {
        this.ent.PlayerModel.roleId = roleId;
        this.dispatchEvent(PlayerEvent.currentSelectedRoleIdChanged, roleId);
    }


}