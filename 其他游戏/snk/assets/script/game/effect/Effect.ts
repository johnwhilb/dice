import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCEntity } from "db://oops-framework/module/common/CCEntity";
import type { Game } from "../game/Game";
import { EffectBll } from "./bll/EffectBll";
import { BattleAudioBll } from "./bll/BattleAudioBll";
import { EffectModel } from "./model/EffectModel";

@ecs.register("Effect")
export class Effect extends CCEntity {
    game: Game;
    EffectModel: EffectModel;

    init() {
        this.add(EffectModel);
        this.addBusinesss(EffectBll, BattleAudioBll);
    }
}
