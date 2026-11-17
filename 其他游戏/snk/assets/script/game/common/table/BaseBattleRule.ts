import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * BattleRule 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface BattleRuleConfigData {
    key: string;
    maxLevel: number;
    scale: number;
    countdown: number;
    waveDelay: number;
    spawnWarning: number;
    spawnInterval: number;
    waveEnemyBase: number;
    waveEnemyGrowth: number;
    loopWaveGrowth: number;
    loopWaveCap: number;
    distributedLoopGrowth: number;
    distributedLoopCap: number;
    bossReinforcementBase: number;
    spawnInset: number;
    spawnOffset: number;
    spawnOffsets: any[];
    distributedPatterns: any[];
    simulationStep: number;
    maxFrameTime: number;
    resultDelay: number;
    distributedGroupBudget: number;
    distributedRepeatInterval: number;
    separationRadius: number;
    separationStrength: number;
    wanderStrength: number;
    wanderRate: number;
    knockbackMin: number;
    knockbackMax: number;
    knockbackDuration: number;
    defenseBase: number;
    doubleContactRoles: any[];
    doubleContactMultiplier: number;
    boostBase: number;
    boostLevelStep: number;
    boostNgStep: number;
    boostEndRatio: number;
    projectileWidth: number;
    projectileHeight: number;
    projectileLife: number;
    shooterBurstInterval: number;
    shooterBurstMinScale: number;
    shooterBurstLevelStep: number;
    shooterCooldownLevelStep: number;
    shooterCooldownMax: number;
    shooterNgDamageStep: number;
    chargeDamageBase: number;
    chargeDamageLevelDivisor: number;
    headbuttNgMin: number;
    headbuttNgMax: number;
    tankNgMin: number;
    mineInterval: number;
    mineNgIntervalStep: number;
    mineMinInterval: number;
    minePulses: number;
    mineNgCountStep: number;
    bossNgCountStep: number;
    bossNgDamageStep: number;
    critterDeathDamageMultiplier: number;
    mercenaryLowChance: number;
    mercenaryHighChance: number;
    mercenaryThresholds: any[];
    mercenaryClassId: number;
    goldPickupRadius: number;
    goldAmount: number;
    projectileMuzzleFactor: number;
    shooterNgSpeedStep: number;
    shooterFriendlyFireMultiplier: number;
    randomBossSkills: any[];
}

/**
 * BaseBattleRule 派生类构造类型。
 */
interface BaseBattleRuleConstructor<T extends BaseBattleRule> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * BattleRule 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseBattleRule {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "11_BattleRule";
    static readonly TableId: number = 11;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: BattleRuleConfigData = null!;

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
                "BattleRule 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseBattleRule>(
        this: BaseBattleRuleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, BattleRuleConfigData> | null;

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
    static getConfigById<T extends BaseBattleRule>(
        this: BaseBattleRuleConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, BattleRuleConfigData> | null;

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
        data: BattleRuleConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 配置枚举 */
    get key(): string {
        return this.data.key;
    }

    /** maxLevel */
    get maxLevel(): number {
        return this.data.maxLevel;
    }

    /** scale */
    get scale(): number {
        return this.data.scale;
    }

    /** countdown */
    get countdown(): number {
        return this.data.countdown;
    }

    /** waveDelay */
    get waveDelay(): number {
        return this.data.waveDelay;
    }

    /** spawnWarning */
    get spawnWarning(): number {
        return this.data.spawnWarning;
    }

    /** spawnInterval */
    get spawnInterval(): number {
        return this.data.spawnInterval;
    }

    /** waveEnemyBase */
    get waveEnemyBase(): number {
        return this.data.waveEnemyBase;
    }

    /** waveEnemyGrowth */
    get waveEnemyGrowth(): number {
        return this.data.waveEnemyGrowth;
    }

    /** loopWaveGrowth */
    get loopWaveGrowth(): number {
        return this.data.loopWaveGrowth;
    }

    /** loopWaveCap */
    get loopWaveCap(): number {
        return this.data.loopWaveCap;
    }

    /** distributedLoopGrowth */
    get distributedLoopGrowth(): number {
        return this.data.distributedLoopGrowth;
    }

    /** distributedLoopCap */
    get distributedLoopCap(): number {
        return this.data.distributedLoopCap;
    }

    /** bossReinforcementBase */
    get bossReinforcementBase(): number {
        return this.data.bossReinforcementBase;
    }

    /** spawnInset */
    get spawnInset(): number {
        return this.data.spawnInset;
    }

    /** spawnOffset */
    get spawnOffset(): number {
        return this.data.spawnOffset;
    }

    /** spawnOffsets */
    get spawnOffsets(): any[] {
        return this.data.spawnOffsets;
    }

    /** distributedPatterns */
    get distributedPatterns(): any[] {
        return this.data.distributedPatterns;
    }

    /** simulationStep */
    get simulationStep(): number {
        return this.data.simulationStep;
    }

    /** maxFrameTime */
    get maxFrameTime(): number {
        return this.data.maxFrameTime;
    }

    /** resultDelay */
    get resultDelay(): number {
        return this.data.resultDelay;
    }

    /** distributedGroupBudget */
    get distributedGroupBudget(): number {
        return this.data.distributedGroupBudget;
    }

    /** distributedRepeatInterval */
    get distributedRepeatInterval(): number {
        return this.data.distributedRepeatInterval;
    }

    /** separationRadius */
    get separationRadius(): number {
        return this.data.separationRadius;
    }

    /** separationStrength */
    get separationStrength(): number {
        return this.data.separationStrength;
    }

    /** wanderStrength */
    get wanderStrength(): number {
        return this.data.wanderStrength;
    }

    /** wanderRate */
    get wanderRate(): number {
        return this.data.wanderRate;
    }

    /** knockbackMin */
    get knockbackMin(): number {
        return this.data.knockbackMin;
    }

    /** knockbackMax */
    get knockbackMax(): number {
        return this.data.knockbackMax;
    }

    /** knockbackDuration */
    get knockbackDuration(): number {
        return this.data.knockbackDuration;
    }

    /** defenseBase */
    get defenseBase(): number {
        return this.data.defenseBase;
    }

    /** doubleContactRoles */
    get doubleContactRoles(): any[] {
        return this.data.doubleContactRoles;
    }

    /** doubleContactMultiplier */
    get doubleContactMultiplier(): number {
        return this.data.doubleContactMultiplier;
    }

    /** boostBase */
    get boostBase(): number {
        return this.data.boostBase;
    }

    /** boostLevelStep */
    get boostLevelStep(): number {
        return this.data.boostLevelStep;
    }

    /** boostNgStep */
    get boostNgStep(): number {
        return this.data.boostNgStep;
    }

    /** boostEndRatio */
    get boostEndRatio(): number {
        return this.data.boostEndRatio;
    }

    /** projectileWidth */
    get projectileWidth(): number {
        return this.data.projectileWidth;
    }

    /** projectileHeight */
    get projectileHeight(): number {
        return this.data.projectileHeight;
    }

    /** projectileLife */
    get projectileLife(): number {
        return this.data.projectileLife;
    }

    /** shooterBurstInterval */
    get shooterBurstInterval(): number {
        return this.data.shooterBurstInterval;
    }

    /** shooterBurstMinScale */
    get shooterBurstMinScale(): number {
        return this.data.shooterBurstMinScale;
    }

    /** shooterBurstLevelStep */
    get shooterBurstLevelStep(): number {
        return this.data.shooterBurstLevelStep;
    }

    /** shooterCooldownLevelStep */
    get shooterCooldownLevelStep(): number {
        return this.data.shooterCooldownLevelStep;
    }

    /** shooterCooldownMax */
    get shooterCooldownMax(): number {
        return this.data.shooterCooldownMax;
    }

    /** shooterNgDamageStep */
    get shooterNgDamageStep(): number {
        return this.data.shooterNgDamageStep;
    }

    /** chargeDamageBase */
    get chargeDamageBase(): number {
        return this.data.chargeDamageBase;
    }

    /** chargeDamageLevelDivisor */
    get chargeDamageLevelDivisor(): number {
        return this.data.chargeDamageLevelDivisor;
    }

    /** headbuttNgMin */
    get headbuttNgMin(): number {
        return this.data.headbuttNgMin;
    }

    /** headbuttNgMax */
    get headbuttNgMax(): number {
        return this.data.headbuttNgMax;
    }

    /** tankNgMin */
    get tankNgMin(): number {
        return this.data.tankNgMin;
    }

    /** mineInterval */
    get mineInterval(): number {
        return this.data.mineInterval;
    }

    /** mineNgIntervalStep */
    get mineNgIntervalStep(): number {
        return this.data.mineNgIntervalStep;
    }

    /** mineMinInterval */
    get mineMinInterval(): number {
        return this.data.mineMinInterval;
    }

    /** minePulses */
    get minePulses(): number {
        return this.data.minePulses;
    }

    /** mineNgCountStep */
    get mineNgCountStep(): number {
        return this.data.mineNgCountStep;
    }

    /** bossNgCountStep */
    get bossNgCountStep(): number {
        return this.data.bossNgCountStep;
    }

    /** bossNgDamageStep */
    get bossNgDamageStep(): number {
        return this.data.bossNgDamageStep;
    }

    /** critterDeathDamageMultiplier */
    get critterDeathDamageMultiplier(): number {
        return this.data.critterDeathDamageMultiplier;
    }

    /** mercenaryLowChance */
    get mercenaryLowChance(): number {
        return this.data.mercenaryLowChance;
    }

    /** mercenaryHighChance */
    get mercenaryHighChance(): number {
        return this.data.mercenaryHighChance;
    }

    /** mercenaryThresholds */
    get mercenaryThresholds(): any[] {
        return this.data.mercenaryThresholds;
    }

    /** mercenaryClassId */
    get mercenaryClassId(): number {
        return this.data.mercenaryClassId;
    }

    /** goldPickupRadius */
    get goldPickupRadius(): number {
        return this.data.goldPickupRadius;
    }

    /** goldAmount */
    get goldAmount(): number {
        return this.data.goldAmount;
    }

    /** projectileMuzzleFactor */
    get projectileMuzzleFactor(): number {
        return this.data.projectileMuzzleFactor;
    }

    /** shooterNgSpeedStep */
    get shooterNgSpeedStep(): number {
        return this.data.shooterNgSpeedStep;
    }

    /** shooterFriendlyFireMultiplier */
    get shooterFriendlyFireMultiplier(): number {
        return this.data.shooterFriendlyFireMultiplier;
    }

    /** randomBossSkills */
    get randomBossSkills(): any[] {
        return this.data.randomBossSkills;
    }
}
