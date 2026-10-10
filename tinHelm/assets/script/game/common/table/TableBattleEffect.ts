import { BaseBattleEffect } from "./BaseBattleEffect";
import { BattleEffectTypeEnum } from "./BattleEffectTypeEnum";

/**
 * BattleEffect 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableBattleEffect extends BaseBattleEffect {
    static isEffectId(value: number): value is BattleEffectTypeEnum {
        return !!this.getConfigById(value);
    }

    static requireEffectId(value: number | string | boolean | null | undefined): BattleEffectTypeEnum {
        if (typeof value !== 'number' || !this.isEffectId(value)) {
            throw new Error(`效果编号不存在或类型错误：${value}`);
        }
        return value;
    }

    static requireEffectConfig(id: BattleEffectTypeEnum): TableBattleEffect {
        const config = this.getConfigById(id);
        if (!config) {
            throw new Error(`效果配置不存在：${id}`);
        }
        return config;
    }
}
