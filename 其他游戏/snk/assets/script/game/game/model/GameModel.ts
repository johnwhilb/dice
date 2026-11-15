import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IShopUnit } from "../../shop/model/ShopModel";

export enum GamePhase {
    Shop,
    Arena,
}

export interface ISnakePose {
    x: number;
    y: number;
    angle: number;
}

@ecs.register("GameModel")
export class GameModel extends ecs.Comp {
    battleTeam: IShopUnit[] = [];
    poses: ISnakePose[] = [];
    history: ISnakePose[] = [];
    phase: GamePhase = GamePhase.Shop;
    transitioning: boolean = false;
    heading: number = 0;
    targetHeading: number = 0;
    arenaWidth: number = 1000;
    arenaHeight: number = 460;
    readonly spacing: 34 = 34;
    readonly speed: 130 = 130;
    readonly turnSpeed: 3.5 = 3.5;

    /** 清空竞技场队伍快照和蛇队轨迹，恢复战斗初始状态。 */
    reset() {
        this.battleTeam = [];
        this.poses = [];
        this.history = [];
        this.phase = GamePhase.Shop;
        this.transitioning = false;
        this.heading = 0;
        this.targetHeading = 0;
    }
}
