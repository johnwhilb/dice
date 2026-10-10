import { BaseEquipment } from "./BaseEquipment";
import { BattleEffectTypeEnum } from "./BattleEffectTypeEnum";
import { BattleEffect } from "../../battle/model/BattleTypes";

/**
 * Equipment 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableEquipment extends BaseEquipment {
    get battleEffects(): BattleEffect[] {
        return this.effect;
    }

    /** 固定生命上限在穿戴时计入冒险属性，战斗初始化不重复叠加。 */
    get maxHpBonus(): number {
        return this.battleEffects.reduce((sum, effect) => {
            const amount = effect.params?.amount;
            return sum + (effect.type === BattleEffectTypeEnum.MODIFY_STAT && effect.target === 'SELF'
                && effect.params?.stat === 'MAX_HP' && !effect.condition && !effect.trigger
                && typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
        }, 0);
    }
}
