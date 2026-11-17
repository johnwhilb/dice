import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Effect } from "../Effect";
import { EffectKind } from "../EffectEvent";
import { TableCombatRule } from "../../common/table/TableCombatRule";

export class EffectBll extends CCBusiness<Effect> {
    /** 记录位置 x、y 的 kind 表现，amount 为飘字数值，roleId 决定动态颜色。 */
    show(kind: EffectKind, x: number, y: number, radius: number, amount: number, roleId: number, endX: number = x, endY: number = y) {
        const rule = TableCombatRule.getCurrent();
        const life = kind === EffectKind.Damage || kind === EffectKind.Heal ? rule.textLife : rule.effectLife;
        this.ent.EffectModel.effects.push({ kind, x, y, endX, endY, radius, amount, roleId, life });
    }

    /** 推进 delta 秒表现时间，删除过期效果。 */
    update(delta: number) {
        this.ent.EffectModel.effects.forEach((effect) => {
            effect.life -= delta;
        });
        this.ent.EffectModel.effects = this.ent.EffectModel.effects.filter((effect) => {
            return effect.life > 0;
        });
    }
}
