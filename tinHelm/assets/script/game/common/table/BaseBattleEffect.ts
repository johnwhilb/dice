import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * BattleEffect 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface BattleEffectConfigData {
    type: string;
    name: string;
    category: string;
    description: string;
    defaultTarget: string;
    defaultParams: Record<string, any>;
    fields: any[];
    cardEnabled: boolean;
    enemyEnabled: boolean;
    container: string;
}

/**
 * BaseBattleEffect 派生类构造类型。
 */
interface BaseBattleEffectConstructor<T extends BaseBattleEffect> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * BattleEffect 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseBattleEffect {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "21_BattleEffect";
    static readonly TableId: number = 21;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: BattleEffectConfigData = null!;

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
                "BattleEffect 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseBattleEffect>(
        this: BaseBattleEffectConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, BattleEffectConfigData> | null;

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
    static getConfigById<T extends BaseBattleEffect>(
        this: BaseBattleEffectConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, BattleEffectConfigData> | null;

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
        data: BattleEffectConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 效果枚举 */
    get type(): string {
        return this.data.type;
    }

    /** 效果名称 */
    get name(): string {
        return this.data.name;
    }

    /** 效果分类 */
    get category(): string {
        return this.data.category;
    }

    /** 效果说明 */
    get description(): string {
        return this.data.description;
    }

    /** 默认目标 */
    get defaultTarget(): string {
        return this.data.defaultTarget;
    }

    /** 默认参数 */
    get defaultParams(): Record<string, any> {
        return this.data.defaultParams;
    }

    /** 参数编辑字段 */
    get fields(): any[] {
        return this.data.fields;
    }

    /** 卡牌可用 */
    get cardEnabled(): boolean {
        return this.data.cardEnabled;
    }

    /** 敌人可用 */
    get enemyEnabled(): boolean {
        return this.data.enemyEnabled;
    }

    /** 子效果容器 */
    get container(): string {
        return this.data.container;
    }
}
