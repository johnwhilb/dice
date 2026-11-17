import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Enemy 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface EnemyConfigData {
    key: string;
    luaKey: string;
    name: string;
    boss: boolean;
    critter: boolean;
    color: string;
    width: number;
    height: number;
    hpMultiplier: number;
    speedMultiplier: number;
    defense: number;
    skillMin: number;
    skillMax: number;
    skillRange: number;
    skillTargets: number;
    skillDelay: number;
    skillDuration: number;
    skillSpeed: number;
    forceRange: number;
    projectileCount: number;
    projectileSpeed: number;
    projectileGrowth: number;
    projectileMaxSpeed: number;
    projectileDamage: number;
    spawnMin: number;
    spawnMax: number;
    hpBaseMultiplier: number;
    hpLevelMultiplier: number;
    hpNgMultiplier: number;
    moveMultiplier: number;
    selfDestructMin: number;
    selfDestructMax: number;
    wanderFactor: number;
    initialSkillMin: number;
    initialSkillMax: number;
}

/**
 * BaseEnemy 派生类构造类型。
 */
interface BaseEnemyConstructor<T extends BaseEnemy> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * Enemy 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseEnemy {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "8_Enemy";
    static readonly TableId: number = 8;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: EnemyConfigData = null!;

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
                "Enemy 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseEnemy>(
        this: BaseEnemyConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EnemyConfigData> | null;

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
    static getConfigById<T extends BaseEnemy>(
        this: BaseEnemyConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EnemyConfigData> | null;

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
        data: EnemyConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 配置枚举 */
    get key(): string {
        return this.data.key;
    }

    /** Lua标识 */
    get luaKey(): string {
        return this.data.luaKey;
    }

    /** 名称 */
    get name(): string {
        return this.data.name;
    }

    /** 是否首领 */
    get boss(): boolean {
        return this.data.boss;
    }

    /** 是否小虫 */
    get critter(): boolean {
        return this.data.critter;
    }

    /** 角色颜色 */
    get color(): string {
        return this.data.color;
    }

    /** 宽度 */
    get width(): number {
        return this.data.width;
    }

    /** 高度 */
    get height(): number {
        return this.data.height;
    }

    /** 生命职业倍率 */
    get hpMultiplier(): number {
        return this.data.hpMultiplier;
    }

    /** 移速职业倍率 */
    get speedMultiplier(): number {
        return this.data.speedMultiplier;
    }

    /** 防御 */
    get defense(): number {
        return this.data.defense;
    }

    /** skillMin */
    get skillMin(): number {
        return this.data.skillMin;
    }

    /** skillMax */
    get skillMax(): number {
        return this.data.skillMax;
    }

    /** skillRange */
    get skillRange(): number {
        return this.data.skillRange;
    }

    /** skillTargets */
    get skillTargets(): number {
        return this.data.skillTargets;
    }

    /** skillDelay */
    get skillDelay(): number {
        return this.data.skillDelay;
    }

    /** skillDuration */
    get skillDuration(): number {
        return this.data.skillDuration;
    }

    /** skillSpeed */
    get skillSpeed(): number {
        return this.data.skillSpeed;
    }

    /** forceRange */
    get forceRange(): number {
        return this.data.forceRange;
    }

    /** projectileCount */
    get projectileCount(): number {
        return this.data.projectileCount;
    }

    /** projectileSpeed */
    get projectileSpeed(): number {
        return this.data.projectileSpeed;
    }

    /** projectileGrowth */
    get projectileGrowth(): number {
        return this.data.projectileGrowth;
    }

    /** projectileMaxSpeed */
    get projectileMaxSpeed(): number {
        return this.data.projectileMaxSpeed;
    }

    /** projectileDamage */
    get projectileDamage(): number {
        return this.data.projectileDamage;
    }

    /** spawnMin */
    get spawnMin(): number {
        return this.data.spawnMin;
    }

    /** spawnMax */
    get spawnMax(): number {
        return this.data.spawnMax;
    }

    /** hpBaseMultiplier */
    get hpBaseMultiplier(): number {
        return this.data.hpBaseMultiplier;
    }

    /** hpLevelMultiplier */
    get hpLevelMultiplier(): number {
        return this.data.hpLevelMultiplier;
    }

    /** hpNgMultiplier */
    get hpNgMultiplier(): number {
        return this.data.hpNgMultiplier;
    }

    /** moveMultiplier */
    get moveMultiplier(): number {
        return this.data.moveMultiplier;
    }

    /** selfDestructMin */
    get selfDestructMin(): number {
        return this.data.selfDestructMin;
    }

    /** selfDestructMax */
    get selfDestructMax(): number {
        return this.data.selfDestructMax;
    }

    /** wanderFactor */
    get wanderFactor(): number {
        return this.data.wanderFactor;
    }

    /** initialSkillMin */
    get initialSkillMin(): number {
        return this.data.initialSkillMin;
    }

    /** initialSkillMax */
    get initialSkillMax(): number {
        return this.data.initialSkillMax;
    }
}
