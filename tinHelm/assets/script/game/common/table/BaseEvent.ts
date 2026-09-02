import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Event 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface EventConfigData {
    name: string;
    des: string;
}

/**
 * BaseEvent 派生类构造类型。
 */
interface BaseEventConstructor<T extends BaseEvent> {
    new (): T;
    TableName: string;
}

/**
 * Event 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseEvent {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "Event";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: EventConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseEvent>(
        this: BaseEventConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EventConfigData> | null;

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
    static getConfigById<T extends BaseEvent>(
        this: BaseEventConstructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EventConfigData> | null;

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
        data: EventConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 事件 */
    get name(): string {
        return this.data.name;
    }

    /** 卡牌描述 */
    get des(): string {
        return this.data.des;
    }
}
