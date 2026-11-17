import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register("GoldFingerModel")
export class GoldFingerModel extends ecs.Comp {
    visible: boolean = false;
    opening: boolean = false;
    panelOpen: boolean = false;
    message: string = "";

    /** 清空金手指入口可见状态、资源加载状态、面板状态和操作结果。 */
    reset() {
        this.visible = false;
        this.opening = false;
        this.panelOpen = false;
        this.message = "";
    }
}
