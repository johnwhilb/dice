import type { ISummonData } from "../summon/SummonEvent";

/** 魔刃刀片的可见尺寸与碰撞尺寸，使用 Cocos 战场单位。 */
export const spellbladeLength = 30;
export const spellbladeThickness = 12;

/** 计时以秒为单位，scale 和 velocity 用于弹体的阻尼回弹。 */
export interface IProjectileVisual {
    age: number;
    trailTime: number;
    flashTime: number;
    scale: number;
    velocity: number;
    spin: number;
}

/** 直接发射弹丸的枪口坐标。 */
export interface IProjectileMuzzle {
    x: number;
    y: number;
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
    /** 角色直接发射的弹丸记录预先计算的枪口位置。 */
    muzzle?: IProjectileMuzzle;
    /** 启动飞行后只生成一次发射表现。 */
    launched?: boolean;
    /** 发射时需要更新表现的召唤物。 */
    summon?: ISummonData;
    /** 魔刃上一步结束时接触的敌人，离开后可再次命中。 */
    bladeContacts?: Set<number>;
    /** 通用弹幕发出的箭矢，撞墙表现独立于角色的默认武器。 */
    arrow?: boolean;
    visual?: IProjectileVisual;
}
