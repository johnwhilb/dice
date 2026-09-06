import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Dice 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface DiceConfigData {
    name: string;
    des: string;
    role: number;
    diceNum: any[];
}

/**
 * BaseDice 派生类构造类型。
 */
interface BaseDiceConstructor<T extends BaseDice> {
    new (): T;
    TableName: string;
}

/**
 * Dice 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseDice {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "Dice";

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: DiceConfigData = null!;

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseDice>(
        this: BaseDiceConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, DiceConfigData> | null;

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
    static getConfigById<T extends BaseDice>(
        this: BaseDiceConstructor<T>,
        id: number
    ): T | null {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, DiceConfigData> | null;

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
        data: DiceConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 骰子名字 */
    get name(): string {
        return this.data.name;
    }

    /** 骰子描述 */
    get des(): string {
        return this.data.des;
    }

    /** 所属角色 */
    get role(): number {
        return this.data.role;
    }

    /** 骰子数 */
    get diceNum(): any[] {
        return this.data.diceNum;
    }
}
