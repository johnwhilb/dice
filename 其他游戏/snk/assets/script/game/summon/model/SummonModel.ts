import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { ICombatArea, IHealingOrb, ISummonData } from "../SummonEvent";

@ecs.register("SummonModel")
export class SummonModel extends ecs.Comp {
    nextId: number = 1;
    summons: ISummonData[] = [];
    areas: ICombatArea[] = [];
    orbs: IHealingOrb[] = [];

    /** 清空本场造物、持续区域和治疗球。 */
    reset() {
        this.summons = [];
        this.nextId = 1;
        this.areas = [];
        this.orbs = [];
    }
}
