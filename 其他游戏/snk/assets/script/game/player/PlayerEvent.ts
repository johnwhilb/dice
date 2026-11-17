/** 角色模块事件。 */
export enum PlayerEvent {
    /** 战场角色阵容已重建，无参数。 */
    UpdatePlayers = "player_update_players",
    /** 角色移动完成，无参数。 */
    UpdatePose = "player_update_pose",
    /** 角色当前血量变化，参数 index 为零起始队伍下标。 */
    UpdateHp = "player_update_hp",
}

/** 招募角色数据：配置主键、等级及累计合成份数，存档结构保持兼容。 */
export interface IPlayerUnit {
    roleId: number;
    level: number;
    copies: number;
}

/** 战场局部坐标与朝向，角度单位为度。 */
export interface IPlayerPose {
    x: number;
    y: number;
    angle: number;
}

/** 延迟战斗指令类型。 */
export enum PlayerActionKind {
    /** 再次施放技能，禁止递归触发重复施法。 */
    Repeat,
    /** 延迟范围攻击。 */
    Area,
    /** 延迟弹丸。 */
    Shot,
    /** 延迟死亡到期。 */
    Death,
}

/** 战斗内延迟指令，统一随战场重置，不使用异步定时器。 */
export interface IPlayerAction {
    source: number;
    kind: PlayerActionKind;
    remaining: number;
    x: number;
    y: number;
    damage: number;
    proc: boolean;
}
