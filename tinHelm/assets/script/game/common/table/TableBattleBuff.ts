import { BaseBattleBuff } from "./BaseBattleBuff";
import { BattleBuffTypeEnum } from "./BattleBuffTypeEnum";
export enum BattleBuffCategory {
    Buff = 'BUFF',
    Debuff = 'DEBUFF'
}
export enum BattleBuffStackMode {
    Add = 'ADD',
    Max = 'MAX',
    Replace = 'REPLACE'
}

/**
 * BattleBuff 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableBattleBuff extends BaseBattleBuff {
    static isBuffId(value: number): value is BattleBuffTypeEnum {
        return !!this.getConfigById(value);
    }

    static requireBuffId(value: number | string | boolean | null | undefined): BattleBuffTypeEnum {
        if (typeof value !== 'number' || !this.isBuffId(value)) {
            throw new Error(`Buff编号不存在或类型错误：${value}`);
        }
        return value;
    }

    static requireBuffConfig(id: BattleBuffTypeEnum): TableBattleBuff {
        const config = this.getConfigById(id);
        if (!config) {
            throw new Error(`Buff配置不存在：${id}`);
        }
        if (![BattleBuffCategory.Buff, BattleBuffCategory.Debuff].some(category => {
            return config.category === category;
        }) || ![BattleBuffStackMode.Add, BattleBuffStackMode.Max, BattleBuffStackMode.Replace].some(mode => {
            return config.stackMode === mode;
        }) || !Number.isSafeInteger(config.maxStacks) || config.maxStacks < 1) {
            throw new Error(`Buff分类、叠加方式或层数上限无效：${id}`);
        }
        return config;
    }
}
