import { BaseShopRule } from './BaseShopRule';
import { ShopRuleKeyEnum } from './ShopRuleKeyEnum';
import { TableShopLevel } from './TableShopLevel';

/**
 * ShopRule 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableShopRule extends BaseShopRule {
    static getInitial() {
        return this.getConfigById<TableShopRule>(ShopRuleKeyEnum.Initial);
    }

    getInitialShopLevel() {
        return TableShopLevel.getConfigById(this.initialShopLevelId);
    }
}
