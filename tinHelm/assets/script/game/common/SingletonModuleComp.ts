import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import type { Initialize } from '../initialize/Initialize';
import { MainMenu } from '../mainManue/MainMenu';
import { Save } from '../save/Save';
import { Profile } from '../profile/Profile';
import { Player } from '../player/Player';
import { GameFlow } from '../gameFlow/GameFlow';

/** 游戏单例业务模块 */
@ecs.register('SingletonModule')
export class SingletonModuleComp extends ecs.Comp {
    /** 游戏初始化模块 */
    initialize: Initialize = null!;
    /** 游戏主界面模块 */
    mainMenu: MainMenu = null!;
    /** 游戏用户配置模块 */
    profile: Profile = null!;
    /** 游戏存档模块 */
    save: Save = null!;
    /** 游戏玩家模块 */
    player: Player = null!;
    /** 游戏流程模块 */
    gameFlow: GameFlow = null!;

    reset() { }
}

export const smc: SingletonModuleComp = ecs.getSingleton(SingletonModuleComp);
