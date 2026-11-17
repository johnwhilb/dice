import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register("CombatModel")
export class CombatModel extends ecs.Comp {
    elapsed: number = 0;

    /** 清空本场通用战斗时间。 */
    reset() {
        this.elapsed = 0;
    }
}
