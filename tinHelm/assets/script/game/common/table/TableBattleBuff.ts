import { BaseBattleBuff } from "./BaseBattleBuff";
import { BattleBuffTypeEnum } from "./BattleBuffTypeEnum";
import type { BattleEffect } from '../../battle/model/BattleTypes';
export enum BattleBuffRuleKind {
    SkillFreeExhaust = 'SKILL_FREE_EXHAUST',
    FirstBlockDouble = 'FIRST_BLOCK_DOUBLE',
    VulnerableBonus = 'VULNERABLE_BONUS',
    ShivDamage = 'SHIV_DAMAGE',
    ShivRetain = 'SHIV_RETAIN',
    FirstShivDamage = 'FIRST_SHIV_DAMAGE',
    PoisonRepeats = 'POISON_REPEATS',
    SlySkills = 'SLY_SKILLS',
    WeakAttackDouble = 'WEAK_ATTACK_DOUBLE',
    BladeRepeat = 'BLADE_REPEAT',
    BladeBlock = 'BLADE_BLOCK',
    FreeCardsPerTurn = 'FREE_CARDS_PER_TURN'
}
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
    /** 读取能力获得时执行的效果；事件监听随所属Buff一起移除。 */
    getEffects(): BattleEffect[] {
        return this.effects || [];
    }

    /** 读取持续生效的结算规则，每层按配置数值累计。 */
    getRules(): Partial<Record<BattleBuffRuleKind, number>> {
        return this.rules || {};
    }

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
        if (!Array.isArray(config.effects) || !config.rules || typeof config.rules !== 'object'
            || Array.isArray(config.rules) || Object.entries(config.rules).some(([key, value]) => {
                return !Object.values(BattleBuffRuleKind).some(kind => {
                    return kind === key;
                }) || typeof value !== 'number' || !Number.isFinite(value) || value < 0;
            })) {
            throw new Error(`Buff能力效果或规则无效：${id}`);
        }
        return config;
    }
}
