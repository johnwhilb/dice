import type { IProjectileData } from "../projectile/ProjectileEvent";

/** 战斗表现类型。 */
export enum EffectKind {
    /** 范围攻击。 */
    Area,
    /** 伤害飘字。 */
    Damage,
    /** 治疗飘字。 */
    Heal,
    /** 连锁连线。 */
    Chain,
    /** 弹丸继续飞行时的命中短闪。 */
    ProjectileHit,
    /** 弹丸终止时收缩的命中亮斑。 */
    ProjectileEnd,
}

/** 弹丸终止亮斑的收缩时长，单位为秒。 */
export const projectileEndDuration = 0.05;

/** 表现快照，与伤害计算分离，life 为剩余秒数。 */
export interface IEffectData {
    kind: EffectKind;
    x: number;
    y: number;
    endX: number;
    endY: number;
    radius: number;
    amount: number;
    roleId: number;
    life: number;
}

/** 弹丸碎片的运动和绘制数据，duration 和 life 以秒计。 */
export interface IProjectileHitParticle {
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    speed: number;
    width: number;
    duration: number;
    life: number;
    sizeFactor: number;
    roleId: number;
    enemyConfigId?: number;
    parentShot?: IProjectileData;
}
