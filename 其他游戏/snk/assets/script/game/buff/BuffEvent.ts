import type { CombatCamp } from "../combat/CombatEvent";

/** 状态模块事件。 */
export enum BuffEvent {
    /** 状态添加、移除或过期，无参数。 */
    Changed = "buff_changed",
}

/** 通用战斗状态类型，效果数值读取配置。 */
export enum BuffKind {
    /** 伤害加成。 */
    Damage,
    /** 攻速加成。 */
    AttackSpeed,
    /** 防御加成。 */
    Defense,
    /** 移速加成。 */
    MoveSpeed,
    /** 护盾。 */
    Shield,
    /** 一次免死。 */
    Revive,
    /** 眩晕。 */
    Stun,
    /** 减速比例。 */
    Slow,
    /** 沉默。 */
    Silence,
    /** 持续伤害。 */
    Dot,
    /** 角色诅咒。 */
    Curse,
    /** 无敌。 */
    Invulnerable,
    /** 承伤加成。 */
    DamageTaken,
    /** 闪电灌注。 */
    Chain,
    /** 召唤物嘲讽。 */
    Taunt,
}

/** 状态记录；source 为角色下标，remaining 为秒，skillId 确定来源技能。 */
export interface IBuffData {
    camp: CombatCamp;
    target: number;
    source: number;
    kind: BuffKind;
    power: number;
    remaining: number;
    duration: number;
    tick: number;
    skillId: number;
}
