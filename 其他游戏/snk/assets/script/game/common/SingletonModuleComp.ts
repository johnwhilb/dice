import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { Initialize } from "../initialize/Initialize";
import type { MainMenu } from "../mainManue/MainMenu";
import type { Game } from "../game/Game";
import type { Setting } from "../setting/Setting";

/** 游戏单例业务模块 */
@ecs.register("SingletonModule")
export class SingletonModuleComp extends ecs.Comp {
    /** 游戏初始化模块 */
    initialize: Initialize = null;
    /** 游戏主界面模块 */
    mainMenu: MainMenu = null;
    /** 玩家设置模块。 */
    setting: Setting = null;
    game: Game = null;
    reset() {
    }
}

export const smc: SingletonModuleComp = ecs.getSingleton(SingletonModuleComp);
