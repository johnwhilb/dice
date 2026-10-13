import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import type { Initialize } from '../initialize/Initialize';
import { MainMenu } from '../mainManue/MainMenu';
import type { Climb } from '../game/Climb';

/** 游戏单例业务模块 */
@ecs.register('SingletonModule')
export class SingletonModuleComp extends ecs.Comp {
    /** 游戏初始化模块 */
    initialize: Initialize = null!;
    /** 游戏主界面模块 */
    mainMenu: MainMenu = null!;
    /** 攀岩玩法模块 */
    climb: Climb = null!;

    reset() { }
}

export const smc: SingletonModuleComp = ecs.getSingleton(SingletonModuleComp);
