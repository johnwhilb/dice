import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ShopContent 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ShopContentConfigData {
    key: string;
    roleId: number;
    classId: number;
    luaKey: string;
    name: string;
    description1: string;
    description2: string;
    description3: string;
    effectName: string;
    effectDescription: string;
    color: string;
    canLevel: boolean;
    enabled: boolean;
}

/**
 * BaseShopContent 派生类构造类型。
 */
interface BaseShopContentConstructor<T extends BaseShopContent> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * ShopContent 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseShopContent {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "6_ShopContent";
    static readonly TableId: number = 6;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ShopContentConfigData = null!;

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
                "ShopContent 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseShopContent>(
        this: BaseShopContentConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopContentConfigData> | null;

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
    static getConfigById<T extends BaseShopContent>(
        this: BaseShopContentConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopContentConfigData> | null;

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
        data: ShopContentConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 内容枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 角色ID */
    get roleId(): number {
        return this.data.roleId;
    }

    /** 职业ID */
    get classId(): number {
        return this.data.classId;
    }

    /** 原版标识 */
    get luaKey(): string {
        return this.data.luaKey;
    }

    /** 名称 */
    get name(): string {
        return this.data.name;
    }

    /** 一级说明 */
    get description1(): string {
        return this.data.description1;
    }

    /** 二级说明 */
    get description2(): string {
        return this.data.description2;
    }

    /** 三级说明 */
    get description3(): string {
        return this.data.description3;
    }

    /** 三级效果名称 */
    get effectName(): string {
        return this.data.effectName;
    }

    /** 三级效果说明 */
    get effectDescription(): string {
        return this.data.effectDescription;
    }

    /** 原版颜色 */
    get color(): string {
        return this.data.color;
    }

    /** 可升级 */
    get canLevel(): boolean {
        return this.data.canLevel;
    }

    /** 启用 */
    get enabled(): boolean {
        return this.data.enabled;
    }
}
