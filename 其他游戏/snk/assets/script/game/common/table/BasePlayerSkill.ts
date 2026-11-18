import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * PlayerSkill 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface PlayerSkillConfigData {
    roleId: number;
    level: number;
    kind: number;
    interval: number;
    range: number;
    radius: number;
    damage: number;
    projectileSpeed: number;
    pierce: number;
    chains: number;
    bounces: number;
    homing: boolean;
    shots: number;
    spread: number;
    burstDelay: number;
    duration: number;
    tick: number;
    slow: number;
    stun: number;
    silence: number;
    dot: number;
    knockback: number;
    pull: number;
    targets: number;
    power: number;
    perTarget: number;
    killSummons: number;
    hitSummons: number;
    critSummons: number;
    critChance: number;
    summonId: number;
    summonChance: number;
    targetCenter: boolean;
    allTargets: boolean;
    parallel: boolean;
    follow: boolean;
    orb: boolean;
    angularSpeed: number;
    extraEvery: number;
    extraShots: number;
    extraDelay: number;
    extraPower: number;
    deathShots: number;
    zoneRadius: number;
    zoneDuration: number;
    angularSpeedEnd: number;
}

/**
 * BasePlayerSkill 派生类构造类型。
 */
interface BasePlayerSkillConstructor<T extends BasePlayerSkill> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * PlayerSkill 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BasePlayerSkill {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "12_PlayerSkill";
    static readonly TableId: number = 12;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: PlayerSkillConfigData = null!;

    /** 判断 ID 是否属于当前配置表。 */
    static isOwnId(id: number): boolean {
        return Number.isInteger(id)
            && Math.floor(id / this.LocalIdBase) === this.TableId
            && id % this.LocalIdBase > 0;
    }

    /** 获取 ID 后四位的表内编号，不属于当前表时返回 0。 */
    static getLocalId(id: number): number {
        if (!this.isOwnId(id)) {
            return 0;
        }

        return id % this.LocalIdBase;
    }

    /** 根据表内编号生成完整配置 ID。 */
    static createId(localId: number): number {
        if (!Number.isInteger(localId) || localId <= 0 || localId >= this.LocalIdBase) {
            throw new Error(
                "PlayerSkill 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BasePlayerSkill>(
        this: BasePlayerSkillConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, PlayerSkillConfigData> | null;

        if (table == null) {
            return [];
        }

        const result: T[] = [];

        for (const key of Object.keys(table)) {
            const id = Number(key);

            if (!this.isOwnId(id)) {
                continue;
            }

            const configData = table[key];

            if (configData == null) {
                continue;
            }

            const item = new this();

            item.setConfig(
                id,
                configData
            );

            result.push(item);
        }

        return result;
    }

    /**
     * 根据 ID 获取配置。
     *
     * 不存在时返回 null。
     */
    static getConfigById<T extends BasePlayerSkill>(
        this: BasePlayerSkillConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, PlayerSkillConfigData> | null;

        if (table == null) {
            return null;
        }

        const configData = table[String(id)];

        if (configData == null) {
            return null;
        }

        const item = new this();

        item.setConfig(
            id,
            configData
        );

        return item;
    }

    /**
     * Base 内部初始化配置对象。
     */
    protected setConfig(
        id: number,
        data: PlayerSkillConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 角色配置ID */
    get roleId(): number {
        return this.data.roleId;
    }

    /** 等级 */
    get level(): number {
        return this.data.level;
    }

    /** 技能类型ID */
    get kind(): number {
        return this.data.kind;
    }

    /** 施放间隔秒 */
    get interval(): number {
        return this.data.interval;
    }

    /** 索敌范围 */
    get range(): number {
        return this.data.range;
    }

    /** 作用半径 */
    get radius(): number {
        return this.data.radius;
    }

    /** 伤害倍率 */
    get damage(): number {
        return this.data.damage;
    }

    /** projectileSpeed */
    get projectileSpeed(): number {
        return this.data.projectileSpeed;
    }

    /** pierce */
    get pierce(): number {
        return this.data.pierce;
    }

    /** chains */
    get chains(): number {
        return this.data.chains;
    }

    /** bounces */
    get bounces(): number {
        return this.data.bounces;
    }

    /** homing */
    get homing(): boolean {
        return this.data.homing;
    }

    /** shots */
    get shots(): number {
        return this.data.shots;
    }

    /** spread */
    get spread(): number {
        return this.data.spread;
    }

    /** burstDelay */
    get burstDelay(): number {
        return this.data.burstDelay;
    }

    /** duration */
    get duration(): number {
        return this.data.duration;
    }

    /** tick */
    get tick(): number {
        return this.data.tick;
    }

    /** slow */
    get slow(): number {
        return this.data.slow;
    }

    /** stun */
    get stun(): number {
        return this.data.stun;
    }

    /** silence */
    get silence(): number {
        return this.data.silence;
    }

    /** dot */
    get dot(): number {
        return this.data.dot;
    }

    /** knockback */
    get knockback(): number {
        return this.data.knockback;
    }

    /** pull */
    get pull(): number {
        return this.data.pull;
    }

    /** targets */
    get targets(): number {
        return this.data.targets;
    }

    /** power */
    get power(): number {
        return this.data.power;
    }

    /** perTarget */
    get perTarget(): number {
        return this.data.perTarget;
    }

    /** killSummons */
    get killSummons(): number {
        return this.data.killSummons;
    }

    /** hitSummons */
    get hitSummons(): number {
        return this.data.hitSummons;
    }

    /** critSummons */
    get critSummons(): number {
        return this.data.critSummons;
    }

    /** critChance */
    get critChance(): number {
        return this.data.critChance;
    }

    /** summonId */
    get summonId(): number {
        return this.data.summonId;
    }

    /** summonChance */
    get summonChance(): number {
        return this.data.summonChance;
    }

    /** targetCenter */
    get targetCenter(): boolean {
        return this.data.targetCenter;
    }

    /** allTargets */
    get allTargets(): boolean {
        return this.data.allTargets;
    }

    /** parallel */
    get parallel(): boolean {
        return this.data.parallel;
    }

    /** follow */
    get follow(): boolean {
        return this.data.follow;
    }

    /** orb */
    get orb(): boolean {
        return this.data.orb;
    }

    /** angularSpeed */
    get angularSpeed(): number {
        return this.data.angularSpeed;
    }

    /** extraEvery */
    get extraEvery(): number {
        return this.data.extraEvery;
    }

    /** extraShots */
    get extraShots(): number {
        return this.data.extraShots;
    }

    /** extraDelay */
    get extraDelay(): number {
        return this.data.extraDelay;
    }

    /** extraPower */
    get extraPower(): number {
        return this.data.extraPower;
    }

    /** deathShots */
    get deathShots(): number {
        return this.data.deathShots;
    }

    /** zoneRadius */
    get zoneRadius(): number {
        return this.data.zoneRadius;
    }

    /** zoneDuration */
    get zoneDuration(): number {
        return this.data.zoneDuration;
    }

    /** 螺旋后段角速度 */
    get angularSpeedEnd(): number {
        return this.data.angularSpeedEnd;
    }
}
