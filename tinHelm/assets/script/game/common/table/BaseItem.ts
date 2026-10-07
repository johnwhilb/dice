import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Item 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ItemConfigData {
    name: string;
    des: string;
    effect: any[];
    target: string;
    type: string;
    price: number;
}

/**
 * BaseItem 派生类构造类型。
 */
interface BaseItemConstructor<T extends BaseItem> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * Item 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseItem {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "17_Item";
    static readonly TableId: number = 17;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ItemConfigData = null!;

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
                "Item 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseItem>(
        this: BaseItemConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ItemConfigData> | null;

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
    static getConfigById<T extends BaseItem>(
        this: BaseItemConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ItemConfigData> | null;

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
        data: ItemConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 道具名字 */
    get name(): string {
        return this.data.name;
    }

    /** 道具描述 */
    get des(): string {
        return this.data.des;
    }

    /** 道具效果 */
    get effect(): any[] {
        return this.data.effect;
    }

    /** 道具目标 */
    get target(): string {
        return this.data.target;
    }

    /** 道具类型 */
    get type(): string {
        return this.data.type;
    }

    /** 价格（金币） */
    get price(): number {
        return this.data.price;
    }
}
