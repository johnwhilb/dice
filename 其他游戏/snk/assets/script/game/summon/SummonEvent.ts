/** 召唤物实例，source 为主人队伍下标，typeId 为召唤物配置。 */
export interface ISummonData {
    id: number;
    source: number;
    typeId: number;
    x: number;
    y: number;
    angle: number;
    hp: number;
    life: number;
    timer: number;
    damage: number;
    dead: boolean;
    /** 生成与上次实际攻击的战斗时间，以及区别于运动角度的攻击朝向。 */
    createdAt: number;
    attackAt?: number;
    attackAngle?: number;
}

/** 持续区域，follow 表示跟随主人，force 表示聚拢而非持续伤害。 */
export interface ICombatArea {
    shotTimer: number;
    source: number;
    skillId: number;
    x: number;
    y: number;
    radius: number;
    damage: number;
    life: number;
    timer: number;
    interval: number;
    follow: boolean;
    force: boolean;
    speed: number;
    angle: number;
    /** 生成时的战斗时间，用于场地展开动画。 */
    createdAt: number;
    /** 场地外圈的初始角速度，单位为弧度每秒。 */
    arcSpeed: number;
}

/** 治疗球位置，拾取后按最大生命比例治疗。 */
export interface IHealingOrb {
    x: number;
    y: number;
    dead: boolean;
}
