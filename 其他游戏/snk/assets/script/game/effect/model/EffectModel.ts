import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IEffectData } from "../EffectEvent";

@ecs.register("EffectModel")
export class EffectModel extends ecs.Comp {
    effects: IEffectData[] = [];

    /** 清空本场短时表现数据。 */
    reset() {
        this.effects = [];
    }
}
