import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ShopLevel 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ShopLevelConfigData {
    key: string;
    level: number;
    tier1Weight: number;
    tier2Weight: number;
    tier3Weight: number;
    tier4Weight: number;
    xpToNextLevel: number;
}

/**
 * BaseShopLevel 派生类构造类型。
 */
interface BaseShopLevelConstructor<T extends BaseShopLevel> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * ShopLevel 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseShopLevel {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "5_ShopLevel";
    static readonly TableId: number = 5;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ShopLevelConfigData = null!;

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
                "ShopLevel 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseShopLevel>(
        this: BaseShopLevelConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopLevelConfigData> | null;

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
    static getConfigById<T extends BaseShopLevel>(
        this: BaseShopLevelConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopLevelConfigData> | null;

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
        data: ShopLevelConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 商店等级枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 商店等级 */
    get level(): number {
        return this.data.level;
    }

    /** 一阶角色权重 */
    get tier1Weight(): number {
        return this.data.tier1Weight;
    }

    /** 二阶角色权重 */
    get tier2Weight(): number {
        return this.data.tier2Weight;
    }

    /** 三阶角色权重 */
    get tier3Weight(): number {
        return this.data.tier3Weight;
    }

    /** 四阶角色权重 */
    get tier4Weight(): number {
        return this.data.tier4Weight;
    }

    /** 升至下一级经验（0为满级） */
    get xpToNextLevel(): number {
        return this.data.xpToNextLevel;
    }
}
