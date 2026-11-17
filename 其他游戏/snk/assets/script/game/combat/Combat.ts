import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { CombatBll } from "./bll/CombatBll";
import { CombatModel } from "./model/CombatModel";

@ecs.register("Combat")
export class Combat extends CCEntity {
    game: Game;
    CombatModel: CombatModel;

    init() {
        this.add(CombatModel);
        this.addBusinesss(CombatBll);
    }
}
