import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { TableCard } from '../../common/table/TableCard';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { Shop } from '../Shop';

export class ShopBll extends CCBusiness<Shop> {
    prepare(day: number, roleId: number, eventId: number) {
        const configuredEvent = TableShopEvent.getConfigById(eventId);
        const shopEvent = configuredEvent?.day === day
            ? configuredEvent
            : TableShopEvent.getAllConfig().find((item) => {
                return item.day === day;
            }) ?? null;
        if (!shopEvent) {
            this.ent.ShopModel.reset();
            return null;
        }

        const model = this.ent.ShopModel;
        if (model.eventId !== shopEvent.id || model.roleId !== roleId || !model.cardIds.length) {
            model.eventId = shopEvent.id;
            model.roleId = roleId;
            model.cardIds = this.generateCards(roleId, shopEvent.cardCounts);
        }
        return shopEvent;
    }

    restore(eventId: number, roleId: number, cardIds: number[]) {
        if (!TableShopEvent.getConfigById(eventId)) {
            this.ent.ShopModel.reset();
            return;
        }

        this.ent.ShopModel.eventId = eventId;
        this.ent.ShopModel.roleId = roleId;
        this.ent.ShopModel.cardIds = cardIds.filter((cardId) => {
            const card = TableCard.getConfigById(cardId);
            return card?.role === roleId;
        });
    }

    getCurrentEvent() {
        return TableShopEvent.getConfigById(this.ent.ShopModel.eventId);
    }

    private generateCards(roleId: number, rawCardCounts: unknown[]) {
        const cardIds: number[] = [];
        rawCardCounts.forEach((rawCount, index) => {
            // cardCounts 的索引依次对应 1、2、3级卡牌，例如 [1,1,1] 表示每级随机1张。
            const level = index + 1;
            const count = typeof rawCount === 'number' ? Math.max(Math.floor(rawCount), 0) : 0;
            const levelCardIds = TableCard.getAllConfig().filter((card) => {
                return card.role === roleId && card.level === level;
            }).map((card) => {
                return card.id;
            });
            cardIds.push(...this.shuffle(levelCardIds).slice(0, count));
        });
        return cardIds;
    }

    private shuffle(cardIds: number[]) {
        const result = [...cardIds];
        for (let index = result.length - 1; index > 0; index -= 1) {
            const targetIndex = Math.floor(Math.random() * (index + 1));
            const current = result[index];
            result[index] = result[targetIndex];
            result[targetIndex] = current;
        }
        return result;
    }
}
