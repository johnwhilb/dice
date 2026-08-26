import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Player } from '../Player';

export class PlayerBll extends CCBusiness<Player> {

    selectPlayer(roleId: number) {
        this.ent.playerModel.roleId = roleId;
    }


}