import { BaseDice } from "./BaseDice";

/**
 * Dice 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableDice extends BaseDice {
    /** 判断指定角色是否在当前花色的授权角色列表中。 */
    canUseBy(roleId: number) {
        return Array.isArray(this.role) && this.role.includes(roleId);
    }
}
