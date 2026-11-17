import { BaseEnemyLevel } from "./BaseEnemyLevel";

/**
 * EnemyLevel 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableEnemyLevel extends BaseEnemyLevel {
    static getByLevel(level: number) {
        return this.getConfigById<TableEnemyLevel>(this.createId(level));
    }
}
