import { BaseCombatRule } from "./BaseCombatRule";
import { CombatRuleKeyEnum } from "./CombatRuleKeyEnum";

export class TableCombatRule extends BaseCombatRule {
    static getCurrent() {
        return this.getConfigById<TableCombatRule>(CombatRuleKeyEnum.Default);
    }
}
