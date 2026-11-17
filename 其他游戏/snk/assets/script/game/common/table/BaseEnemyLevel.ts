import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * EnemyLevel 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface EnemyLevelConfigData {
    level: number;
    hp: number;
    damage: number;
    speed: number;
    ngHp: number;
    ngHpStep: number;
    ngDamage: number;
    ngDamageStep: number;
    bossHp: number;
    bossHpStep: number;
    bossDamage: number;
    bossNgDamage: number;
    bossNgDamageStep: number;
    bossSpeed: number;
    bossNgSpeed: number;
    critterHp: number;
    critterDamage: number;
    critterSpeed: number;
}

/**
 * BaseEnemyLevel 派生类构造类型。
 */
interface BaseEnemyLevelConstructor<T extends BaseEnemyLevel> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * EnemyLevel 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseEnemyLevel {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "9_EnemyLevel";
    static readonly TableId: number = 9;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: EnemyLevelConfigData = null!;

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
                "EnemyLevel 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseEnemyLevel>(
        this: BaseEnemyLevelConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EnemyLevelConfigData> | null;

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
    static getConfigById<T extends BaseEnemyLevel>(
        this: BaseEnemyLevelConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, EnemyLevelConfigData> | null;

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
        data: EnemyLevelConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 关卡 */
    get level(): number {
        return this.data.level;
    }

    /** hp */
    get hp(): number {
        return this.data.hp;
    }

    /** damage */
    get damage(): number {
        return this.data.damage;
    }

    /** speed */
    get speed(): number {
        return this.data.speed;
    }

    /** ngHp */
    get ngHp(): number {
        return this.data.ngHp;
    }

    /** ngHpStep */
    get ngHpStep(): number {
        return this.data.ngHpStep;
    }

    /** ngDamage */
    get ngDamage(): number {
        return this.data.ngDamage;
    }

    /** ngDamageStep */
    get ngDamageStep(): number {
        return this.data.ngDamageStep;
    }

    /** bossHp */
    get bossHp(): number {
        return this.data.bossHp;
    }

    /** bossHpStep */
    get bossHpStep(): number {
        return this.data.bossHpStep;
    }

    /** bossDamage */
    get bossDamage(): number {
        return this.data.bossDamage;
    }

    /** bossNgDamage */
    get bossNgDamage(): number {
        return this.data.bossNgDamage;
    }

    /** bossNgDamageStep */
    get bossNgDamageStep(): number {
        return this.data.bossNgDamageStep;
    }

    /** bossSpeed */
    get bossSpeed(): number {
        return this.data.bossSpeed;
    }

    /** bossNgSpeed */
    get bossNgSpeed(): number {
        return this.data.bossNgSpeed;
    }

    /** critterHp */
    get critterHp(): number {
        return this.data.critterHp;
    }

    /** critterDamage */
    get critterDamage(): number {
        return this.data.critterDamage;
    }

    /** critterSpeed */
    get critterSpeed(): number {
        return this.data.critterSpeed;
    }
}
