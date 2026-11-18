/** 计时以秒为单位，scale 和 velocity 用于弹体的阻尼回弹。 */
export interface IProjectileVisual {
    age: number;
    trailTime: number;
    flashTime: number;
    scale: number;
    velocity: number;
    spin: number;
}

/** 玩家弹丸实例，与角色技能配置关联。 */
export interface IProjectileData {
    source: number;
    skillId: number;
    x: number;
    y: number;
    angle: number;
    speed: number;
    damage: number;
    life: number;
    delay: number;
    pierce: number;
    chains: number;
    bounces: number;
    warps: number;
    homing: boolean;
    hitIds: Set<number>;
    dead: boolean;
    timer: number;
    proc: boolean;
    generic: boolean;
    visual?: IProjectileVisual;
}
