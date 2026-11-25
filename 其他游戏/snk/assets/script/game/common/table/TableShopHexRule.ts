import { BaseShopHexRule } from "./BaseShopHexRule";
import { ShopHexRuleKeyEnum } from "./ShopHexRuleKeyEnum";

export class TableShopHexRule extends BaseShopHexRule {
    static getCurrent() {
        const rule = this.getConfigById<TableShopHexRule>(ShopHexRuleKeyEnum.Default);
        if (!rule) {
            throw new Error("ShopHexRule 缺少默认海克斯规则");
        }
        if (
            !Array.isArray(rule.triggerRounds) ||
            !rule.triggerRounds.every((round) => {
                return Number.isInteger(round) && round > 0;
            }) ||
            !Number.isInteger(rule.candidateCount) ||
            rule.candidateCount < 1 ||
            rule.candidateCount > 4 ||
            !Number.isInteger(rule.ownedLimit) ||
            rule.ownedLimit < 1 ||
            ![rule.rerollCost, rule.freeRerollStage, rule.merchantFreeRerollLevel].every((value) => {
                return Number.isInteger(value) && value >= 0;
            })
        ) {
            throw new Error("ShopHexRule 海克斯规则配置无效");
        }
        return rule;
    }
}
