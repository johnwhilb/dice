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
}

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
