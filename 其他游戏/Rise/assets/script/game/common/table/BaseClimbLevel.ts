import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";

/**
 * ClimbLevel 配置原始数据。
 *
 * 自动生成，请勿手动修改。
 */
interface ClimbLevelConfigData {
    name: string;
    displayName: string;
    width: number;
    height: number;
    viewHeight: number;
    snapRange: number;
    bodyX: number;
    bodyY: number;
    startHeight: number;
    finishHeight: number;
    leftHandStart: number;
    rightHandStart: number;
    leftFootStart: number;
    rightFootStart: number;
    arm: number;
    leg: number;
    brittle: number;
    drain0: number;
    drain1: number;
    drain2: number;
    drain3: number;
    drain4: number;
    scaleMin: number;
    scaleMax: number;
    level: number;
    description: string;
}

/**
 * BaseClimbLevel 派生类构造类型。
 */
interface BaseClimbLevelConstructor<T extends BaseClimbLevel> {
    new (): T;
    TableName: string;
    TableId: number;
    isOwnId(id: number): boolean;
}

/**
 * ClimbLevel 配置基类。
 *
 * 自动生成文件，请勿手动修改。
 */
export class BaseClimbLevel {

    /** JsonUtil 中的配置表名称 */
    static TableName: string = "1_ClimbLevel";
    static readonly TableId: number = 1;
    static readonly LocalIdBase: number = 10000;

    /** 配置主键 */
    id: number = 0;

    /** 当前配置原始数据 */
    private data: ClimbLevelConfigData = null!;

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
                "ClimbLevel 表内ID必须在0001到9999之间，当前值：" + localId
            );
        }

        return this.TableId * this.LocalIdBase + localId;
    }

    /**
     * 获取全部配置。
     */
    static getAllConfig<T extends BaseClimbLevel>(
        this: BaseClimbLevelConstructor<T>
    ): T[] {
        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ClimbLevelConfigData> | null;

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
    static getConfigById<T extends BaseClimbLevel>(
        this: BaseClimbLevelConstructor<T>,
        id: number
    ): T | null {
        if (!this.isOwnId(id)) {
            return null;
        }

        const table = JsonUtil.get(
            this.TableName
        ) as Record<string, ClimbLevelConfigData> | null;

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
        data: ClimbLevelConfigData
    ) {
        this.id = id;
        this.data = data;
    }

    /** 关卡枚举 */
    get name(): string {
        return this.data.name;
    }

    /** 关卡名称 */
    get displayName(): string {
        return this.data.displayName;
    }

    /** 场景宽度 */
    get width(): number {
        return this.data.width;
    }

    /** 场景高度 */
    get height(): number {
        return this.data.height;
    }

    /** 可视区域高度 */
    get viewHeight(): number {
        return this.data.viewHeight;
    }

    /** 抓点吸附距离 */
    get snapRange(): number {
        return this.data.snapRange;
    }

    /** 人物出生X */
    get bodyX(): number {
        return this.data.bodyX;
    }

    /** 人物出生Y（向下为正） */
    get bodyY(): number {
        return this.data.bodyY;
    }

    /** 起始高度 */
    get startHeight(): number {
        return this.data.startHeight;
    }

    /** 通关高度 */
    get finishHeight(): number {
        return this.data.finishHeight;
    }

    /** 左手初始岩点ID */
    get leftHandStart(): number {
        return this.data.leftHandStart;
    }

    /** 右手初始岩点ID */
    get rightHandStart(): number {
        return this.data.rightHandStart;
    }

    /** 左脚初始岩点ID */
    get leftFootStart(): number {
        return this.data.leftFootStart;
    }

    /** 右脚初始岩点ID */
    get rightFootStart(): number {
        return this.data.rightFootStart;
    }

    /** 手臂最大距离 */
    get arm(): number {
        return this.data.arm;
    }

    /** 腿部最大距离 */
    get leg(): number {
        return this.data.leg;
    }

    /** 危险岩点寿命（秒） */
    get brittle(): number {
        return this.data.brittle;
    }

    /** 0点支撑体力消耗 */
    get drain0(): number {
        return this.data.drain0;
    }

    /** 1点支撑体力消耗 */
    get drain1(): number {
        return this.data.drain1;
    }

    /** 2点支撑体力消耗 */
    get drain2(): number {
        return this.data.drain2;
    }

    /** 3点支撑体力消耗 */
    get drain3(): number {
        return this.data.drain3;
    }

    /** 4点支撑体力消耗 */
    get drain4(): number {
        return this.data.drain4;
    }

    /** 岩点最小缩放 */
    get scaleMin(): number {
        return this.data.scaleMin;
    }

    /** 岩点最大缩放 */
    get scaleMax(): number {
        return this.data.scaleMax;
    }

    /** 关卡等级 */
    get level(): number {
        return this.data.level;
    }

    /** 关卡说明 */
    get description(): string {
        return this.data.description;
    }
}
