import { BaseRoleClass } from './BaseRoleClass';

/**
 * RoleClass 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableRoleClass extends BaseRoleClass {
    getActivationCounts() {
        return Array.from(new Set([this.activationCount1, this.activationCount2, this.activationCount3])).filter((count) => {
            return count > 0;
        });
    }
}
