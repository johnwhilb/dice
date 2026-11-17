import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { BuffBll } from "./bll/BuffBll";
import { BuffModel } from "./model/BuffModel";

@ecs.register("Buff")
export class Buff extends CCEntity {
    game: Game;
    BuffModel: BuffModel;

    init() {
        this.add(BuffModel);
        this.addBusinesss(BuffBll);
    }
}
