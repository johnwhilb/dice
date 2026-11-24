import type { IProjectileData } from "../projectile/ProjectileEvent";

/** 战斗表现类型。 */
export enum EffectKind {
    /** 范围攻击。 */
    Area,
    /** 伤害飘字。 */
    Damage,
    /** 治疗飘字。 */
    Heal,
    /** 连锁电弧与诅咒连线。 */
    Chain,
    /** 弹丸继续飞行时的命中短闪。 */
    ProjectileHit,
    /** 弹丸终止时收缩的命中亮斑。 */
    ProjectileEnd,
    /** 弹丸发射位置的方向性短闪。 */
    Muzzle,
    /** 敌人死亡时收束的色环。 */
    EnemyDeath,
    /** 刷怪队列中的敌人实际出现时向外扩散的圆环。 */
    SpawnArrival,
    /** 首领死亡的双重冲击波。 */
    BossDeath,
    /** 箭矢在墙面短暂停留。 */
    WallArrow,
    /** 飞刀撞墙后向场内翻落。 */
    WallKnife,
    /** 暴击位置的亮环。 */
    Critical,
    /** 队员退场的角色色收束环。 */
    PlayerDeath,
    /** 撞墙冲击波与墙面闪光。 */
    WallImpact,
    /** 拾取金币或治疗球时的涟漪。 */
    PickupRipple,
    /** 护盾格挡时的爆发脉冲。 */
    ShieldBlock,
    /** 特殊状态提示飘字（如金币、格挡、免死）。 */
    TagText,
    /** 召唤物或治疗球落点汇聚光环。 */
    SpawnRing,
    /** 角色施放充能、加速、献祭、护盾时的扩散光环。 */
    BuffPulse,
    /** 赌徒金币攻击的金色连线与砸落闪爆。 */
    CoinStrike,
}

/** 范围伤害结算时使用的表现。 */
export enum AreaFeedback {
    /** 绘制瞬发爆发轮廓和受击反馈。 */
    Burst,
    /** 仅绘制目标上的受击反馈，场地轮廓由现有光环负责。 */
    Targets,
}

/** 竞技场墙面边标识，用于定向点亮撞击边界。 */
export enum ArenaWallSide {
    /** 左墙。 */
    Left,
    /** 右墙。 */
    Right,
    /** 上墙。 */
    Top,
    /** 下墙。 */
    Bottom,
}

/** 战斗音效标识。 */
export enum BattleSound {
    /** 暴击命中。 */
    Crit = "sfxCrit",
    /** 连锁闪电。 */
    Chain = "sfxChain",
    /** 敌人刷出。 */
    Spawn = "sfxSpawn",
    /** 队员受伤。 */
    PlayerHurt = "sfxPlayerHurt",
    /** 拾取金币。 */
    Gold = "sfxGold",
    /** 金币掉落。 */
    GoldDrop = "goldDrop",
    /** 拾取治疗球。 */
    HealPickup = "healPickup",
    /** 治疗技能。 */
    Heal = "sfxHeal",
    /** 倒计时滴答。 */
    Countdown = "sfxCountdown",
    /** 倒计时结束。 */
    BattleStart = "sfxBattleStart",
    /** 神圣惩罚的雷鸣。 */
    Thunder = "thunder",
}

/** 首领死亡慢放时长使用现实秒，其余效果时长使用战斗秒。 */
export const bossSlowDuration = 0.65;
export const bossSlowScale = 0.35;
export const bossDeathDuration = 0.66;
export const chainDuration = 0.24;
export const spawnArrivalDuration = 0.22;

/** 发射短闪、出手回弹与镜头反馈的持续时间，单位为秒。 */
export const muzzleDuration = 0.09;
export const recoilDuration = 0.16;
export const impactShakeDuration = 0.18;
export const playerHurtDuration = 0.22;
export const playerDeathDuration = 0.3;
export const playerDeathSlowDuration = 0.42;
export const criticalDuration = 0.26;
export const arrowResidueDuration = 1.75;
export const knifeResidueDuration = 1.55;
export const wallResidueBlinkDuration = 0.35;
export const wallImpactDuration = 0.24;
export const pickupRippleDuration = 0.28;
export const shieldBlockDuration = 0.22;
export const tagTextDuration = 0.62;
export const screenHurtFlashDuration = 0.28;
export const hitstopCooldownDuration = 0.09;
export const spawnRingDuration = 0.28;
export const buffPulseDuration = 0.34;
export const coinStrikeDuration = 0.26;
export const summonBlinkDuration = 0.35;

/** 普通敌人死亡色环的持续时间，单位为秒。 */
export const enemyDeathDuration = 0.24;

/** 弹丸终止亮斑的收缩时长，单位为秒。 */
export const projectileEndDuration = 0.05;

/** 原版弹丸碎片尺寸和速度换算到 Cocos 战场坐标的倍率。 */
export const projectileParticleScale = 3;

/** 碎片收缩结束时的尺寸，单位为 Cocos 战场坐标。 */
export const projectileParticleEndSize = 2 * projectileParticleScale;

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
    /** 效果总持续时间，便于精确计算插值进度。 */
    duration?: number;
    /** 方形范围的旋转角，未设置时使用通用爆发。 */
    squareAngle?: number;
    /** 暴击伤害飘字标记。 */
    critical?: boolean;
    /** 玩家受击飘字标记。 */
    playerHurt?: boolean;
    /** 飘字水平初速度与垂直初速度。 */
    vx?: number;
    vy?: number;
    /** 特殊状态或拾取文案。 */
    tag?: string;
    /** 撞墙表现对应的边界方向。 */
    wallSide?: ArenaWallSide;
    /** 电浆闪电标记，启用亮蓝辉光与分叉电弧。 */
    plasma?: boolean;
    /** 闪电抖动随机种子。 */
    seed?: number;
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
    /** 碎片的额外显示倍率，默认使用原版换算尺寸。 */
    sizeScale?: number;
    roleId: number;
    enemyConfigId?: number;
    parentShot?: IProjectileData;
}
