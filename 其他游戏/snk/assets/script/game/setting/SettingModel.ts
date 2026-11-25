import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { ControlMode } from "./SettingEvent";

@ecs.register("SettingModel")
export class SettingModel extends ecs.Comp {
    musicEnabled: boolean = true;
    effectEnabled: boolean = true;
    controlMode: ControlMode = ControlMode.Follow;

    /** 恢复音频开关与战斗控制的默认模型值。 */
    reset() {
        this.musicEnabled = true;
        this.effectEnabled = true;
        this.controlMode = ControlMode.Follow;
    }
}
