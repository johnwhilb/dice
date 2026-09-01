import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * RoleCard 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface RoleCardConfigData {
    roleId: number;
    cardId: number;
}

/**
 * BaseRoleCard 派生类构造类型。
 */
interface BaseRoleCardConstructor<T extends BaseRoleCard> {
    new (): T;
    TableName: string;
}

/**
 * RoleCard 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRoleCard {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "RoleCard";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleCardConfigData = null!;

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
    static getConfigById<T extends BaseRoleCard>(
        this: BaseRoleCardConstructor<T>,
        id: number
    ): T | null {
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
}
