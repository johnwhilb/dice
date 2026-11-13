import { BaseRoleLevel } from './BaseRoleLevel';

/**
 * RoleLevel 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableRoleLevel extends BaseRoleLevel {
    static getConfigByLevel(level: number) {
        return this.getAllConfig<TableRoleLevel>().find((config) => {
            return config.level === level;
        }) || null;
    }
}
