import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { TableRole, IRoleBaseStats } from "../../common/table/TableRole";
import type { IPlayerPose, IPlayerUnit } from "../PlayerEvent";

/** 战场角色快照，包含招募数据、配置、等级职业属性、当前血量和实时位置。 */
export interface IPlayerData extends IPlayerUnit {
    config: TableRole;
    /** 等级及职业计算后的属性，hp 为最大血量。 */
    stats: IRoleBaseStats;
    /** 当前血量，每场战斗创建角色时按 stats.hp 初始化为满血。 */
    hp: number;
    pose: IPlayerPose;
}

@ecs.register("PlayerModel")
export class PlayerModel extends ecs.Comp {
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
