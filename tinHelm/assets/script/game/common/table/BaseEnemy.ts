import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Enemy 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface EnemyConfigData {
    name: string;
    title: string;
    info: string;
    originHp: number;
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
    static TableName: string = "5_Enemy";
    static readonly TableId: number = 5;
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

    /** 角色名 */
    get name(): string {
        return this.data.name;
    }

    /** 角色称号 */
    get title(): string {
        return this.data.title;
    }

    /** 角色信息 */
    get info(): string {
        return this.data.info;
    }

    /** 初始血量 */
    get originHp(): number {
        return this.data.originHp;
    }
}
