import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import { BattleBll } from "./bll/BattleBll";
import { BattleModel } from "./model/BattleModel";
import type { BattleView } from "./view/BattleView";
import type { Game } from "../game/Game";

@ecs.register("Battle")
export class Battle extends CCEntity {
    game: Game;
    BattleModel: BattleModel;
    BattleView: BattleView;

    init() {
        this.add(BattleModel);
        this.addBusinesss(BattleBll);
    }
}
