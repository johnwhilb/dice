import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ShopHexRule 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ShopHexRuleConfigData {
    key: string;
    triggerRounds: any[];
    candidateCount: number;
    ownedLimit: number;
    rerollCost: number;
    freeRerollStage: number;
    merchantFreeRerollLevel: number;
}

/**
 * BaseShopHexRule 派生类构造类型。
 */
interface BaseShopHexRuleConstructor<T extends BaseShopHexRule> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * ShopHexRule 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseShopHexRule {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "18_ShopHexRule";
    static readonly TableId: number = 18;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ShopHexRuleConfigData = null!;

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
                "ShopHexRule 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseShopHexRule>(
        this: BaseShopHexRuleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopHexRuleConfigData> | null;

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
    static getConfigById<T extends BaseShopHexRule>(
        this: BaseShopHexRuleConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopHexRuleConfigData> | null;

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
        data: ShopHexRuleConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 规则枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 每轮触发关卡 */
    get triggerRounds(): any[] {
        return this.data.triggerRounds;
    }

    /** 候选卡数量 */
    get candidateCount(): number {
        return this.data.candidateCount;
    }

    /** 持有上限 */
    get ownedLimit(): number {
        return this.data.ownedLimit;
    }

    /** 刷新金币 */
    get rerollCost(): number {
        return this.data.rerollCost;
    }

    /** 首次免费刷新总关卡 */
    get freeRerollStage(): number {
        return this.data.freeRerollStage;
    }

    /** 商人免费刷新等级 */
    get merchantFreeRerollLevel(): number {
        return this.data.merchantFreeRerollLevel;
    }
}
