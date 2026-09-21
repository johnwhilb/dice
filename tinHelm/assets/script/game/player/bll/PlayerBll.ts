import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Player } from '../Player';
import { PlayerEvent } from '../PlayerEvent';
import { TableRole } from '../../common/table/TableRole';

export class PlayerBll extends CCBusiness<Player> {

    selectRole(roleId: number) {
        if (!TableRole.isOwnId(roleId) || !TableRole.getConfigById(roleId)) {
            return;
        }

        this.ent.PlayerModel.roleId = roleId;
        this.dispatchEvent(PlayerEvent.currentSelectedRoleIdChanged, roleId);
    }

    initPlayer() {
        const playerInfo= TableRole.getConfigById(this.ent.PlayerModel.roleId);
        this.ent.PlayerModel.hp = playerInfo!.originHp;
        this.ent.PlayerModel.maxHp = playerInfo!.maxHp;
        this.ent.PlayerModel.handCard = playerInfo!.originCards;
    }


}
