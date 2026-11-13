import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * RoleClass 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface RoleClassConfigData {
    key: string;
    luaKey: string;
    name: string;
    hpMultiplier: number;
    damageMultiplier: number;
    attackSpeedMultiplier: number;
    areaDamageMultiplier: number;
    areaSizeMultiplier: number;
    defenseMultiplier: number;
    moveSpeedMultiplier: number;
    activationCount1: number;
    activationCount2: number;
    activationCount3: number;
    scalesWithActiveClasses: boolean;
}

/**
 * BaseRoleClass 派生类构造类型。
 */
interface BaseRoleClassConstructor<T extends BaseRoleClass> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * RoleClass 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseRoleClass {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "2_RoleClass";
    static readonly TableId: number = 2;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: RoleClassConfigData = null!;

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
                "RoleClass 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseRoleClass>(
        this: BaseRoleClassConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleClassConfigData> | null;

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
    static getConfigById<T extends BaseRoleClass>(
        this: BaseRoleClassConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, RoleClassConfigData> | null;

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
        data: RoleClassConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 职业枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 原版职业标识 */
    get luaKey(): string {
        return this.data.luaKey;
    }

    /** 原版名称 */
    get name(): string {
        return this.data.name;
    }

    /** 生命倍率 */
    get hpMultiplier(): number {
        return this.data.hpMultiplier;
    }

    /** 伤害倍率 */
    get damageMultiplier(): number {
        return this.data.damageMultiplier;
    }

    /** 攻速倍率（冷却取倒数） */
    get attackSpeedMultiplier(): number {
        return this.data.attackSpeedMultiplier;
    }

    /** 范围伤害倍率 */
    get areaDamageMultiplier(): number {
        return this.data.areaDamageMultiplier;
    }

    /** 范围大小倍率 */
    get areaSizeMultiplier(): number {
        return this.data.areaSizeMultiplier;
    }

    /** 防御倍率 */
    get defenseMultiplier(): number {
        return this.data.defenseMultiplier;
    }

    /** 移速倍率 */
    get moveSpeedMultiplier(): number {
        return this.data.moveSpeedMultiplier;
    }

    /** 羁绊第一档人数 */
    get activationCount1(): number {
        return this.data.activationCount1;
    }

    /** 羁绊第二档人数 */
    get activationCount2(): number {
        return this.data.activationCount2;
    }

    /** 羁绊第三档人数（0为无） */
    get activationCount3(): number {
        return this.data.activationCount3;
    }

    /** 效果随激活职业数增长 */
    get scalesWithActiveClasses(): boolean {
        return this.data.scalesWithActiveClasses;
    }
}
