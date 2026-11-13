import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ShopRule 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ShopRuleConfigData {
    key: string;
    startingGold: number;
    cardSlots: number;
    refreshCost: number;
    initialShopLevelId: number;
    initialShopXp: number;
    initialBattleLevel: number;
    initialLoop: number;
    baseTeamSize: number;
    maxTeamSize: number;
    teamSizePerNewGamePlus: number;
    requireAttacker: boolean;
    allowDuplicates: boolean;
    lockCost: number;
    xpPurchaseCost: number;
    copiesPerUpgrade: number;
}

/**
 * BaseShopRule 派生类构造类型。
 */
interface BaseShopRuleConstructor<T extends BaseShopRule> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * ShopRule 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseShopRule {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "4_ShopRule";
    static readonly TableId: number = 4;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ShopRuleConfigData = null!;

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
                "ShopRule 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseShopRule>(
        this: BaseShopRuleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopRuleConfigData> | null;

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
    static getConfigById<T extends BaseShopRule>(
        this: BaseShopRuleConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ShopRuleConfigData> | null;

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
        data: ShopRuleConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 规则枚举 */
    get key(): string {
        return this.data.key;
    }

    /** 初始金币 */
    get startingGold(): number {
        return this.data.startingGold;
    }

    /** 商店商品槽位 */
    get cardSlots(): number {
        return this.data.cardSlots;
    }

    /** 角色商店刷新花费 */
    get refreshCost(): number {
        return this.data.refreshCost;
    }

    /** 初始商店等级ID */
    get initialShopLevelId(): number {
        return this.data.initialShopLevelId;
    }

    /** 初始商店经验 */
    get initialShopXp(): number {
        return this.data.initialShopXp;
    }

    /** 初始关卡 */
    get initialBattleLevel(): number {
        return this.data.initialBattleLevel;
    }

    /** 初始轮回 */
    get initialLoop(): number {
        return this.data.initialLoop;
    }

    /** 基础队伍上限 */
    get baseTeamSize(): number {
        return this.data.baseTeamSize;
    }

    /** 队伍最大上限 */
    get maxTeamSize(): number {
        return this.data.maxTeamSize;
    }

    /** 每周目增加队伍上限 */
    get teamSizePerNewGamePlus(): number {
        return this.data.teamSizePerNewGamePlus;
    }

    /** 每批商品至少一个攻击角色 */
    get requireAttacker(): boolean {
        return this.data.requireAttacker;
    }

    /** 同批商品可重复 */
    get allowDuplicates(): boolean {
        return this.data.allowDuplicates;
    }

    /** 锁定商店花费 */
    get lockCost(): number {
        return this.data.lockCost;
    }

    /** 购买1点商店经验花费 */
    get xpPurchaseCost(): number {
        return this.data.xpPurchaseCost;
    }

    /** ???????? */
    get copiesPerUpgrade(): number {
        return this.data.copiesPerUpgrade;
    }
}
