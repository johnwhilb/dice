import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * RoleCard 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface RoleCardConfigData {
    roleId: number;
    cardId: number;
    unlockLevel: number;
}

/**
 * BaseRoleCard 派生类构造类型。
 */
interface BaseRoleCardConstructor<T extends BaseRoleCard> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * RoleCard 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRoleCard {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "7_RoleCard";
    static readonly TableId: number = 7;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleCardConfigData = null!;

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
                "RoleCard 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseRoleCard>(
        this: BaseRoleCardConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleCardConfigData> | null;

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
    static getConfigById<T extends BaseRoleCard>(
        this: BaseRoleCardConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleCardConfigData> | null;

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
        data: RoleCardConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 角色编号 */
    get roleId(): number {
        return this.data.roleId;
    }

    /** 卡牌编号 */
    get cardId(): number {
        return this.data.cardId;
    }

    /** 解锁关卡 （0为初始卡牌） */
    get unlockLevel(): number {
        return this.data.unlockLevel;
    }
}
