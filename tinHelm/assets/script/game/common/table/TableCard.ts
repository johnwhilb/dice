import { BaseCard } from "./BaseCard";

/**
 * Card 配置扩展类。
 *
 * 此文件只会自动创建一次。
 * 可以在这里安全编写项目自己的方法。
 */
export class TableCard extends BaseCard {
    baseId: number = 0;

    /** 创建战斗副本，独立保存本张牌的变化，不修改配表。 */
    createInstance(id: number, diceNeed = this.DiceNeed, description = this.des): TableCard {
        const card = new TableCard();
        card.baseId = this.baseId || this.id;
        card.setConfig(id, {
            name: this.name, des: description, DiceNeed: [...diceNeed], level: this.level,
            price: this.price, role: this.role, effect: this.effect, target: this.target,
            type: this.type, flags: { ...this.flags }
        });
        return card;
    }

    /** 普通商店、奖励和随机生成共用的投放条件。 */
    isNormalReward(): boolean {
        return !this.flags.generated && !this.flags.special && !this.flags.starterOnly
            && !this.flags.unplayable && ['ATTACK', 'SKILL', 'POWER'].includes(this.type);
    }
}
