import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IBuffData } from "../BuffEvent";

@ecs.register("BuffModel")
export class BuffModel extends ecs.Comp {
    buffs: IBuffData[] = [];

    /** 清空本场所有临时状态。 */
    reset() {
        this.buffs = [];
    }
}
