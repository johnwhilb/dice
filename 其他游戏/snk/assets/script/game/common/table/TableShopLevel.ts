import { BaseShopLevel } from './BaseShopLevel';

/**
 * ShopLevel 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableShopLevel extends BaseShopLevel {
    static getConfigByLevel(level: number) {
        return this.getAllConfig<TableShopLevel>().find((config) => {
            return config.level === level;
        }) || null;
    }

    getTierWeights() {
        return [this.tier1Weight, this.tier2Weight, this.tier3Weight, this.tier4Weight];
    }

    getNextLevel() {
        return TableShopLevel.getConfigByLevel(this.level + 1);
    }
}
