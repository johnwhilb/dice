import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * DiceRule 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface DiceRuleConfigData {
    numNeed: string;
    numNeedDes: string;
}

/**
 * BaseDiceRule 派生类构造类型。
 */
interface BaseDiceRuleConstructor<T extends BaseDiceRule> {
    new (): T;
    TableName: string;
}

/**
 * DiceRule 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseDiceRule {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "DiceRule";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: DiceRuleConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseDiceRule>(
        this: BaseDiceRuleConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, DiceRuleConfigData> | null;

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
    static getConfigById<T extends BaseDiceRule>(
        this: BaseDiceRuleConstructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, DiceRuleConfigData> | null;

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
        data: DiceRuleConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 骰子点数触发条件 */
    get numNeed(): string {
        return this.data.numNeed;
    }

    /** 骰子点数触发条件描述 */
    get numNeedDes(): string {
        return this.data.numNeedDes;
    }
}
