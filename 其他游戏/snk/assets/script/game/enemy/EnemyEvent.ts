import type { TableEnemy } from "../common/table/TableEnemy";

/** 敌人模块事件。 */
export enum EnemyEvent {
    /** 敌人、弹丸、地雷和金币数据完成更新，无参数。 */
    UpdateFrame = "enemy_update_frame",
    /** 刷怪队列中的敌人实际出场，参数为战场局部坐标 x、y。 */
    SpawnArrival = "enemy_spawn_arrival",
}

/** 战场内的非敌人对象类型。 */
export enum EnemyObjectKind {
    /** 直线移动并在命中后消失的敌方弹丸。 */
    Projectile,
    /** 倒计时后发射环形弹幕的地雷。 */
    Mine,
    /** 可由存活队员拾取、结算时计入收入的金币。 */
    Gold,
    /** 敌人生成前的无伤害预警标记。 */
    SpawnMarker,
}

/** 敌人独立运行数据，位置和速度使用战场局部坐标，时间使用秒。 */
export interface IEnemySource {
    id: number;
    config: TableEnemy;
    x: number;
    y: number;
    damage: number;
}

/** 存活敌人的属性、技能计时和碰撞状态。 */
export interface IEnemyData extends IEnemySource {
    angle: number;
    hp: number;
    maxHp: number;
    hitTime?: number;
    /** 最近一次实际开火的战斗时间。 */
    fireTime?: number;
    speed: number;
    dead: boolean;
    skillTimer: number;
    life: number;
    boostRemaining: number;
    boostDuration: number;
    chargeRemaining: number;
    chargeX: number;
    chargeY: number;
    knockbackRemaining: number;
    knockbackX: number;
    knockbackY: number;
    contacts: Set<number>;
    shooting: boolean;
    forceRemaining: number;
    forceX: number;
    forceY: number;
    wallDamage: number;
    wallSource: number;
    deathResolved: boolean;
    bonusGold: boolean;
    doom: number;
}

/** 待生成敌人，at 为本场开始后的绝对秒数。 */
export interface IEnemySpawn {
    at: number;
    configId: number;
    x: number;
    y: number;
}

/** 敌方弹丸、地雷或掉落金币的独立运行数据。 */
export interface IEnemyObject {
    id: number;
    kind: EnemyObjectKind;
    configId: number;
    sourceId: number;
    x: number;
    y: number;
    angle: number;
    width: number;
    height: number;
    speed: number;
    damage: number;
    life: number;
    dead: boolean;
    delay: number;
    /** 已启动飞行，延迟弹丸只触发一次发射反馈。 */
    launched?: boolean;
}

/** 配置中的分布刷怪模式，groups 为每组数量，times 为每组的延迟。 */
export interface IDistributedSpawn {
    groups: number[];
    times: number[];
    samePoint: boolean;
    weight: number;
}
