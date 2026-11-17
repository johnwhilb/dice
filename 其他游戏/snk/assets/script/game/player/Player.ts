import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { PlayerMoveBll } from "./bll/PlayerMoveBll";
import { PlayerBll } from "./bll/PlayerBll";
import { PlayerModel } from "./model/PlayerModel";
import type { Game } from "../game/Game";
import { PlayerActionBll } from "./bll/PlayerActionBll";
import { PlayerBattleBll } from "./bll/PlayerBattleBll";
import { PlayerPassiveBll } from "./bll/PlayerPassiveBll";

@ecs.register("Player")
export class Player extends CCEntity {
    game: Game;
    PlayerModel: PlayerModel;

    init() {
        this.add(PlayerModel);
        this.addBusinesss(PlayerBll);
        this.addBusinesss(PlayerMoveBll);
        this.addBusinesss(PlayerActionBll);
        this.addBusinesss(PlayerBattleBll);
        this.addBusinesss(PlayerPassiveBll);
    }
}
