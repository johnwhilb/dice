import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * CombatRule 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface CombatRuleConfigData {
    key: string;
    projectileLife: number;
    projectileRadius: number;
    projectileSpeed: number;
    projectileMuzzle: number;
    homingTurn: number;
    chainRange: number;
    critMultiplier: number;
    rogueCritMultiplier: number;
    healRatio: number;
    orbRadius: number;
    orbAttract: number;
    orbSpeed: number;
    effectLife: number;
    textLife: number;
    pushDuration: number;
    shieldRadius: number;
    shieldLife: number;
    dotInterval: number;
    defaultDotDuration: number;
    barrageCount: number;
    barrageSpread: number;
    barrageInterval: number;
    repeatDelay: number;
    curseTargets: number;
    critSummonDamage: number;
    areaOpacity: number;
    effectLineWidth: number;
    textWidth: number;
    textFontSize: number;
    textRise: number;
    statusDuration: number;
    poisonDamageRatio: number;
    stanceInterval: number;
    turnInterval: number;
    turnThreshold: number;
    divinePunishmentInterval: number;
    deathPosition: number;
    deathInterval: number;
    shootPosition: number;
    lastingPosition: number;
    attackSpeedPosition: number;
    damagePosition: number;
    edgeFactor: number;
    hardeningDuration: number;
    hasteDuration: number;
    lightningBase: number;
    lightningStep: number;
    infestingCount: number;
    lightningCount: number;
    chainInfusionCount: number;
    fieldRadius: number;
    fieldDuration: number;
    doomBase: number;
    petChance: number;
    tauntDuration: number;
    orbLimit: number;
    insuranceGold: number;
    projectileChainRange: number;
    projectileHomingRange: number;
    lightningRange: number;
    magnetAttract: number;
    healPickupRadius: number;
}

/**
 * BaseCombatRule 派生类构造类型。
 */
interface BaseCombatRuleConstructor<T extends BaseCombatRule> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * CombatRule 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseCombatRule {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "16_CombatRule";
    static readonly TableId: number = 16;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: CombatRuleConfigData = null!;

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
                "CombatRule 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseCombatRule>(
        this: BaseCombatRuleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, CombatRuleConfigData> | null;

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
    static getConfigById<T extends BaseCombatRule>(
        this: BaseCombatRuleConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, CombatRuleConfigData> | null;

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
        data: CombatRuleConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 枚举标识 */
    get key(): string {
        return this.data.key;
    }

    /** projectileLife */
    get projectileLife(): number {
        return this.data.projectileLife;
    }

    /** projectileRadius */
    get projectileRadius(): number {
        return this.data.projectileRadius;
    }

    /** projectileSpeed */
    get projectileSpeed(): number {
        return this.data.projectileSpeed;
    }

    /** projectileMuzzle */
    get projectileMuzzle(): number {
        return this.data.projectileMuzzle;
    }

    /** homingTurn */
    get homingTurn(): number {
        return this.data.homingTurn;
    }

    /** chainRange */
    get chainRange(): number {
        return this.data.chainRange;
    }

    /** critMultiplier */
    get critMultiplier(): number {
        return this.data.critMultiplier;
    }

    /** rogueCritMultiplier */
    get rogueCritMultiplier(): number {
        return this.data.rogueCritMultiplier;
    }

    /** healRatio */
    get healRatio(): number {
        return this.data.healRatio;
    }

    /** orbRadius */
    get orbRadius(): number {
        return this.data.orbRadius;
    }

    /** orbAttract */
    get orbAttract(): number {
        return this.data.orbAttract;
    }

    /** orbSpeed */
    get orbSpeed(): number {
        return this.data.orbSpeed;
    }

    /** effectLife */
    get effectLife(): number {
        return this.data.effectLife;
    }

    /** textLife */
    get textLife(): number {
        return this.data.textLife;
    }

    /** pushDuration */
    get pushDuration(): number {
        return this.data.pushDuration;
    }

    /** shieldRadius */
    get shieldRadius(): number {
        return this.data.shieldRadius;
    }

    /** shieldLife */
    get shieldLife(): number {
        return this.data.shieldLife;
    }

    /** dotInterval */
    get dotInterval(): number {
        return this.data.dotInterval;
    }

    /** defaultDotDuration */
    get defaultDotDuration(): number {
        return this.data.defaultDotDuration;
    }

    /** barrageCount */
    get barrageCount(): number {
        return this.data.barrageCount;
    }

    /** barrageSpread */
    get barrageSpread(): number {
        return this.data.barrageSpread;
    }

    /** barrageInterval */
    get barrageInterval(): number {
        return this.data.barrageInterval;
    }

    /** repeatDelay */
    get repeatDelay(): number {
        return this.data.repeatDelay;
    }

    /** curseTargets */
    get curseTargets(): number {
        return this.data.curseTargets;
    }

    /** critSummonDamage */
    get critSummonDamage(): number {
        return this.data.critSummonDamage;
    }

    /** areaOpacity */
    get areaOpacity(): number {
        return this.data.areaOpacity;
    }

    /** effectLineWidth */
    get effectLineWidth(): number {
        return this.data.effectLineWidth;
    }

    /** textWidth */
    get textWidth(): number {
        return this.data.textWidth;
    }

    /** textFontSize */
    get textFontSize(): number {
        return this.data.textFontSize;
    }

    /** textRise */
    get textRise(): number {
        return this.data.textRise;
    }

    /** statusDuration */
    get statusDuration(): number {
        return this.data.statusDuration;
    }

    /** poisonDamageRatio */
    get poisonDamageRatio(): number {
        return this.data.poisonDamageRatio;
    }

    /** stanceInterval */
    get stanceInterval(): number {
        return this.data.stanceInterval;
    }

    /** turnInterval */
    get turnInterval(): number {
        return this.data.turnInterval;
    }

    /** turnThreshold */
    get turnThreshold(): number {
        return this.data.turnThreshold;
    }

    /** divinePunishmentInterval */
    get divinePunishmentInterval(): number {
        return this.data.divinePunishmentInterval;
    }

    /** deathPosition */
    get deathPosition(): number {
        return this.data.deathPosition;
    }

    /** deathInterval */
    get deathInterval(): number {
        return this.data.deathInterval;
    }

    /** shootPosition */
    get shootPosition(): number {
        return this.data.shootPosition;
    }

    /** lastingPosition */
    get lastingPosition(): number {
        return this.data.lastingPosition;
    }

    /** attackSpeedPosition */
    get attackSpeedPosition(): number {
        return this.data.attackSpeedPosition;
    }

    /** damagePosition */
    get damagePosition(): number {
        return this.data.damagePosition;
    }

    /** edgeFactor */
    get edgeFactor(): number {
        return this.data.edgeFactor;
    }

    /** hardeningDuration */
    get hardeningDuration(): number {
        return this.data.hardeningDuration;
    }

    /** hasteDuration */
    get hasteDuration(): number {
        return this.data.hasteDuration;
    }

    /** lightningBase */
    get lightningBase(): number {
        return this.data.lightningBase;
    }

    /** lightningStep */
    get lightningStep(): number {
        return this.data.lightningStep;
    }

    /** infestingCount */
    get infestingCount(): number {
        return this.data.infestingCount;
    }

    /** lightningCount */
    get lightningCount(): number {
        return this.data.lightningCount;
    }

    /** chainInfusionCount */
    get chainInfusionCount(): number {
        return this.data.chainInfusionCount;
    }

    /** fieldRadius */
    get fieldRadius(): number {
        return this.data.fieldRadius;
    }

    /** fieldDuration */
    get fieldDuration(): number {
        return this.data.fieldDuration;
    }

    /** doomBase */
    get doomBase(): number {
        return this.data.doomBase;
    }

    /** petChance */
    get petChance(): number {
        return this.data.petChance;
    }

    /** tauntDuration */
    get tauntDuration(): number {
        return this.data.tauntDuration;
    }

    /** orbLimit */
    get orbLimit(): number {
        return this.data.orbLimit;
    }

    /** insuranceGold */
    get insuranceGold(): number {
        return this.data.insuranceGold;
    }

    /** 弹射距离 */
    get projectileChainRange(): number {
        return this.data.projectileChainRange;
    }

    /** 追踪距离 */
    get projectileHomingRange(): number {
        return this.data.projectileHomingRange;
    }

    /** 闪电距离 */
    get lightningRange(): number {
        return this.data.lightningRange;
    }

    /** 磁吸距离 */
    get magnetAttract(): number {
        return this.data.magnetAttract;
    }

    /** 治疗球拾取距离 */
    get healPickupRadius(): number {
        return this.data.healPickupRadius;
    }
}
