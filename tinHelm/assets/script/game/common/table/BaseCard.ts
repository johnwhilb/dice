import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Card 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface CardConfigData {
    name: string;
    des: string;
}

/**
 * BaseCard 派生类构造类型。
 */
interface BaseCardConstructor<T extends BaseCard> {
    new (): T;
    TableName: string;
}

/**
 * Card 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseCard {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "Card";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: CardConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseCard>(
        this: BaseCardConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, CardConfigData> | null;

        if (table == null) {
            return [];
        }

        const result: T[] = [];

        for (const key of Object.keys(table)) {
            const id = Number(key);

            if (Number.isNaN(id)) {
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
    static getConfigById<T extends BaseCard>(
        this: BaseCardConstructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, CardConfigData> | null;

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
        data: CardConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 卡牌名字 */
    get name(): string {
        return this.data.name;
    }

    /** 卡牌描述 */
    get des(): string {
        return this.data.des;
    }
}
