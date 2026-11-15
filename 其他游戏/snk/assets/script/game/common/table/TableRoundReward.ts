import { BaseRoundReward } from "./BaseRoundReward";

/**
 * RoundReward 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableRoundReward extends BaseRoundReward {
    static getByLevel(level: number) {
        return this.getAllConfig<TableRoundReward>().find((config) => {
            return config.level === level;
        });
    }
}
