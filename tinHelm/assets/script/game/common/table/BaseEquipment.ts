import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * Equipment 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface EquipmentConfigData {
    name: string;
    effectDes: string;
    des: string;
    effect: any[];
    type: string;
    price: number;
    combine: any[];
}

/**
 * BaseEquipment 派生类构造类型。
 */
interface BaseEquipmentConstructor<T extends BaseEquipment> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * Equipment 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseEquipment {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "19_Equipment";
    static readonly TableId: number = 19;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: EquipmentConfigData = null!;

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
                "Equipment 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseEquipment>(
        this: BaseEquipmentConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EquipmentConfigData> | null;

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
    static getConfigById<T extends BaseEquipment>(
        this: BaseEquipmentConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EquipmentConfigData> | null;

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
        data: EquipmentConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 装备名字 */
    get name(): string {
        return this.data.name;
    }

    /** 装备效果描述 */
    get effectDes(): string {
        return this.data.effectDes;
    }

    /** 装备描述 */
    get des(): string {
        return this.data.des;
    }

    /** 装备效果 */
    get effect(): any[] {
        return this.data.effect;
    }

    /** 道具类型 */
    get type(): string {
        return this.data.type;
    }

    /** 价格（金币） */
    get price(): number {
        return this.data.price;
    }

    /** 是否可以合成(可以合成的话 放入两个id) */
    get combine(): any[] {
        return this.data.combine;
    }
}
