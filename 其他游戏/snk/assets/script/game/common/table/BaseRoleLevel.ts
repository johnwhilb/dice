import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * RoleLevel 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface RoleLevelConfigData {
    key: string;
    level: number;
    hp: number;
    damage: number;
    defense: number;
    moveSpeed: number;
    attackSpeedMultiplier: number;
    areaDamageMultiplier: number;
    areaSizeMultiplier: number;
    saleValueMultiplier: number;
}

/**
 * BaseRoleLevel 派生类构造类型。
 */
interface BaseRoleLevelConstructor<T extends BaseRoleLevel> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * RoleLevel 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRoleLevel {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "3_RoleLevel";
    static readonly TableId: number = 3;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleLevelConfigData = null!;

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
                "RoleLevel 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseRoleLevel>(
        this: BaseRoleLevelConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleLevelConfigData> | null;

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
    static getConfigById<T extends BaseRoleLevel>(
        this: BaseRoleLevelConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleLevelConfigData> | null;

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
        data: RoleLevelConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 等级枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 角色等级 */
    get level(): number {
        return this.data.level;
    }

    /** 职业加成前生命 */
    get hp(): number {
        return this.data.hp;
    }

    /** 职业加成前伤害 */
    get damage(): number {
        return this.data.damage;
    }

    /** 职业加成前防御 */
    get defense(): number {
        return this.data.defense;
    }

    /** 职业加成前移速 */
    get moveSpeed(): number {
        return this.data.moveSpeed;
    }

    /** 基础攻速倍率（非每秒攻击数） */
    get attackSpeedMultiplier(): number {
        return this.data.attackSpeedMultiplier;
    }

    /** 基础范围伤害倍率 */
    get areaDamageMultiplier(): number {
        return this.data.areaDamageMultiplier;
    }

    /** 基础范围大小倍率 */
    get areaSizeMultiplier(): number {
        return this.data.areaSizeMultiplier;
    }

    /** ???????? */
    get saleValueMultiplier(): number {
        return this.data.saleValueMultiplier;
    }
}
