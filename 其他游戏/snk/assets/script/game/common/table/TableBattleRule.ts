import { BaseBattleRule } from "./BaseBattleRule";
import { BattleRuleKeyEnum } from "./BattleRuleKeyEnum";

/**
 * BattleRule 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableBattleRule extends BaseBattleRule {
    static getCurrent() {
        return this.getConfigById<TableBattleRule>(BattleRuleKeyEnum.Default);
    }
}
