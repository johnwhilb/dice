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
}

/** 治疗球位置，拾取后按最大生命比例治疗。 */
export interface IHealingOrb {
    x: number;
    y: number;
    dead: boolean;
}
