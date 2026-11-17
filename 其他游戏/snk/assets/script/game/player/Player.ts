import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { PlayerBll } from "./bll/PlayerBll";
import { PlayerModel } from "./model/PlayerModel";

@ecs.register("Player")
export class Player extends CCEntity {
    PlayerModel: PlayerModel;

    init() {
        this.add(PlayerModel);
        this.addBusinesss(PlayerBll);
    }
}
