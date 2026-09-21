import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * StoryEvent 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface StoryEventConfigData {
    flowId: any[];
}

/**
 * BaseStoryEvent 派生类构造类型。
 */
interface BaseStoryEventConstructor<T extends BaseStoryEvent> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * StoryEvent 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseStoryEvent {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "9_StoryEvent";
    static readonly TableId: number = 9;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: StoryEventConfigData = null!;

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
                "StoryEvent 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseStoryEvent>(
        this: BaseStoryEventConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, StoryEventConfigData> | null;

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
    static getConfigById<T extends BaseStoryEvent>(
        this: BaseStoryEventConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, StoryEventConfigData> | null;

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
        data: StoryEventConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 选项（StoryFlow） */
    get flowId(): any[] {
        return this.data.flowId;
    }
}
