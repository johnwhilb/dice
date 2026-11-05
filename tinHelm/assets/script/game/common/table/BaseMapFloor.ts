import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * MapFloor 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface MapFloorConfigData {
    minCount: number;
    maxCount: number;
    enemyPool: any[];
    shopPool: any[];
    maybeEvent: any[];
}

/**
 * BaseMapFloor 派生类构造类型。
 */
interface BaseMapFloorConstructor<T extends BaseMapFloor> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * MapFloor 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseMapFloor {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "25_MapFloor";
    static readonly TableId: number = 25;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: MapFloorConfigData = null!;

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
                "MapFloor 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseMapFloor>(
        this: BaseMapFloorConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, MapFloorConfigData> | null;

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
    static getConfigById<T extends BaseMapFloor>(
        this: BaseMapFloorConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, MapFloorConfigData> | null;

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
        data: MapFloorConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 最小数量 */
    get minCount(): number {
        return this.data.minCount;
    }

    /** 最大数量 */
    get maxCount(): number {
        return this.data.maxCount;
    }

    /** 敌人池 （对应5_Enemy表） */
    get enemyPool(): any[] {
        return this.data.enemyPool;
    }

    /** 商店事件池 */
    get shopPool(): any[] {
        return this.data.shopPool;
    }

    /** 可能发生的事件(本层可能发生的事件 对应6Event表，第二个元素 对应该事件在本层的生成权重 ，相加需要为1) */
    get maybeEvent(): any[] {
        return this.data.maybeEvent;
    }
}
