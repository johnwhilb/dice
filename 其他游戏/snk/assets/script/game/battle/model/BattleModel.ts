import { ecs } from 'db://oops-framework/libs/ecs/ECS';

export enum BattlePhase {
    Shop,
    Arena
}

export interface ShopUnit {
    roleId: number;
    level: number;
    copies: number;
}

export interface SnakePose {
    x: number;
    y: number;
    angle: number;
}

@ecs.register('BattleModel')
export class BattleModel extends ecs.Comp {
    gold = 0;
    offers: number[] = [];
    team: ShopUnit[] = [];
    battleTeam: ShopUnit[] = [];
    poses: SnakePose[] = [];
    history: SnakePose[] = [];
    phase = BattlePhase.Shop;
    transitioning = false;
    heading = 0;
    targetHeading = 0;
    arenaWidth = 1000;
    arenaHeight = 460;
    readonly spacing = 34;
    readonly speed = 130;
    readonly turnSpeed = 3.5;

    /** 清空本局金币、商品、队伍快照及蛇队轨迹；不保存跨局数据。 */
    reset() {
        this.gold = 0;
        this.offers = [];
        this.team = [];
        this.battleTeam = [];
        this.poses = [];
        this.history = [];
        this.phase = BattlePhase.Shop;
        this.transitioning = false;
        this.heading = 0;
        this.targetHeading = 0;
    }
}
