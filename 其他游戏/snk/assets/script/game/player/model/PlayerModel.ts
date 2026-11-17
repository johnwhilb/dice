import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { TableRole, IRoleBaseStats } from "../../common/table/TableRole";
import type { IPlayerPose, IPlayerUnit } from "../PlayerEvent";
import type { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import type { IPlayerAction } from "../PlayerEvent";

/** 战场角色快照，包含招募数据、配置、等级职业属性、当前血量和实时位置。 */
export interface IPlayerData extends IPlayerUnit {
    config: TableRole;
    /** 等级及职业计算后的属性，hp 为最大血量。 */
    stats: IRoleBaseStats;
    /** 当前血量，每场战斗创建角色时按 stats.hp 初始化为满血。 */
    hp: number;
    pose: IPlayerPose;
    skill: TablePlayerSkill;
    attackTimer: number;
    castCount: number;
    repeatCount: number;
    auxiliaryTimer: number;
    storedDamage: number;
    initialized: boolean;
    lastStand: boolean;
    lasting: boolean;
}

@ecs.register("PlayerModel")
export class PlayerModel extends ecs.Comp {
    actions: IPlayerAction[] = [];
    passiveTimers: Map<number, number> = new Map();
    turnElapsed: number = 0;
    turnAmount: number = 0;
    lastHeading: number = 0;
    turnDirection: number = 0;
    players: IPlayerData[] = [];
    history: IPlayerPose[] = [];
    heading: number = 0;
    targetHeading: number = 0;
    speed: number = 0;
    spacing: number = 0;
    turnSpeed: number = 0;
    radius: number = 0;

    /** 清空角色战场快照、跟随轨迹与移动状态，不修改商店及存档数据。 */
    reset() {
        this.actions = [];
        this.passiveTimers.clear();
        this.turnElapsed = 0;
        this.turnAmount = 0;
        this.lastHeading = 0;
        this.turnDirection = 0;
        this.players = [];
        this.history = [];
        this.heading = 0;
        this.targetHeading = 0;
        this.speed = 0;
        this.spacing = 0;
        this.turnSpeed = 0;
        this.radius = 0;
    }
}
