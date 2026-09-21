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
    originHp: number;
    maxHp: number;
    originCards: any[];
    originDice: any;
}

/**
 * BaseRole 派生类构造类型。
 */
interface BaseRoleConstructor<T extends BaseRole> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * Role 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRole {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "1_Role";
    static readonly TableId: number = 1;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleConfigData = null!;

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
                "Role 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

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
    static getConfigById<T extends BaseRole>(
        this: BaseRoleConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

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

    /** 初始血量 */
    get originHp(): number {
        return this.data.originHp;
    }

    /** 血量上限 */
    get maxHp(): number {
        return this.data.maxHp;
    }

    /** 初始卡牌 */
    get originCards(): any[] {
        return this.data.originCards;
    }

    /** 初始骰子数 */
    get originDice(): any {
        return this.data.originDice;
    }
}
