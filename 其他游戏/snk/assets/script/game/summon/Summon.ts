import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { SummonBll } from "./bll/SummonBll";
import { SummonModel } from "./model/SummonModel";

@ecs.register("Summon")
export class Summon extends CCEntity {
    game: Game;
    SummonModel: SummonModel;

    init() {
        this.add(SummonModel);
        this.addBusinesss(SummonBll);
    }
}
