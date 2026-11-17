import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { GoldFingerBll } from "./bll/GoldFingerBll";
import { GoldFingerModel } from "./model/GoldFingerModel";
import type { GoldFingerView } from "./view/GoldFingerView";

@ecs.register("GoldFinger")
export class GoldFinger extends CCEntity {
    game: Game;
    GoldFingerModel: GoldFingerModel;
    GoldFingerView: GoldFingerView;

    init() {
        this.add(GoldFingerModel);
        this.addBusinesss(GoldFingerBll);
    }
}
