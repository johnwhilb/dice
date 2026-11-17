import { ecs } from "db://oops-framework/libs/ecs/ECS";

export enum GamePhase {
    Shop,
    Battle,
}

@ecs.register("GameModel")
export class GameModel extends ecs.Comp {
    phase: GamePhase = GamePhase.Shop;
    transitioning: boolean = false;

    /** 恢复商店阶段并清除界面切换状态。 */
    reset() {
        this.phase = GamePhase.Shop;
        this.transitioning = false;
    }
}
