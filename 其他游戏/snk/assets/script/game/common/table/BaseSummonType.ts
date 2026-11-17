import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * SummonType 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface SummonTypeConfigData {
    key: string;
    life: number;
    interval: number;
    range: number;
    speed: number;
    radius: number;
    shots: number;
    damage: number;
    hp: number;
    explode: boolean;
    heal: boolean;
    orbit: boolean;
}

/**
 * BaseSummonType 派生类构造类型。
 */
interface BaseSummonTypeConstructor<T extends BaseSummonType> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * SummonType 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseSummonType {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "15_SummonType";
    static readonly TableId: number = 15;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: SummonTypeConfigData = null!;

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
                "SummonType 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseSummonType>(
        this: BaseSummonTypeConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, SummonTypeConfigData> | null;

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
    static getConfigById<T extends BaseSummonType>(
        this: BaseSummonTypeConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, SummonTypeConfigData> | null;

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
        data: SummonTypeConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 枚举标识 */
    get key(): string {
        return this.data.key;
    }

    /** life */
    get life(): number {
        return this.data.life;
    }

    /** 施放间隔秒 */
    get interval(): number {
        return this.data.interval;
    }

    /** 索敌范围 */
    get range(): number {
        return this.data.range;
    }

    /** speed */
    get speed(): number {
        return this.data.speed;
    }

    /** 作用半径 */
    get radius(): number {
        return this.data.radius;
    }

    /** shots */
    get shots(): number {
        return this.data.shots;
    }

    /** 伤害倍率 */
    get damage(): number {
        return this.data.damage;
    }

    /** hp */
    get hp(): number {
        return this.data.hp;
    }

    /** explode */
    get explode(): boolean {
        return this.data.explode;
    }

    /** heal */
    get heal(): boolean {
        return this.data.heal;
    }

    /** orbit */
    get orbit(): boolean {
        return this.data.orbit;
    }
}
