import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { PlayerModel } from './model/PlayerModel';
import { PlayerBll } from './bll/PlayerBll';
import { RoleSelectView } from './view/RoleSelectView';


@ecs.register('Player')
export class Player extends CCEntity {

    playerModel!: PlayerModel
    playerBll!: PlayerBll
    roleSelectView!: RoleSelectView


    static create(): Player {
        return ecs.getEntity<Player>(Player);
    }

    init(): void {
        this.addComponents(PlayerModel);
        this.addBusinesss(PlayerBll);
    }

    selectPlayer(roleId: number) {
        this.playerBll.selectPlayer(roleId);
    }


}