import { ecs } from "db://oops-framework/libs/ecs/ECS";

@ecs.register("MainMenuModel")
export class MainMenuModel extends ecs.Comp {
    musicEnabled: boolean = true;
    effectEnabled: boolean = true;

    /** 重置主菜单音频展示状态，实际设置由框架音频管理器保存。 */
    reset() {
        this.musicEnabled = true;
        this.effectEnabled = true;
    }
}
