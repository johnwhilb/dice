import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Role 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface RoleConfigData {
    name: string;
    title: string;
    info: string;
}

/**
 * BaseRole 派生类构造类型。
 */
interface BaseRoleConstructor<T extends BaseRole> {
    new (): T;
    TableName: string;
}

/**
 * Role 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRole {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "Role";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseRole>(
        this: BaseRoleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleConfigData> | null;

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
    static getConfigById<T extends BaseRole>(
        this: BaseRoleConstructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleConfigData> | null;

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
        data: RoleConfigData
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
}
