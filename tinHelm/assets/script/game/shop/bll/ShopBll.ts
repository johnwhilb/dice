import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { TableCard } from '../../common/table/TableCard';
import { TableShopEvent } from '../../common/table/TableShopEvent';
import { Shop } from '../Shop';
import { TableItem } from '../../common/table/TableItem';
import { TableUniversal } from '../../common/table/TableUniversal';
import { UniversalNameEnum } from '../../common/table/UniversalNameEnum';
import { smc } from '../../common/SingletonModuleComp';
import { PlayerEvent } from '../../player/PlayerEvent';
import { ShopEvent } from '../ShopEvent';

export class ShopBll extends CCBusiness<Shop> {
    prepare(roleId: number, eventId: number) {
        const shopEvent = TableShopEvent.getConfigById(eventId);
        if (!shopEvent) {
            this.ent.ShopModel.reset();
            return null;
        }
        const model = this.ent.ShopModel;
        if (model.eventId !== shopEvent.id || model.roleId !== roleId || !model.initialized) {
            model.reset();
            model.eventId = shopEvent.id;
            model.roleId = roleId;
            model.cardIds = this.generateCards(roleId, shopEvent.cardCounts);
            model.itemIds = this.generateItems();
            model.initialized = true;
        }
        return shopEvent;
    }

    restore(eventId: number, roleId: number, cardIds: number[], itemIds?: number[],
        boughtCardIds: number[] = [], boughtItemIds: number[] = []) {
        const model = this.ent.ShopModel;
        model.reset();
        if (!TableShopEvent.getConfigById(eventId)) {
            return;
        }
        model.eventId = eventId;
        model.roleId = roleId;
        model.cardIds = [...new Set(cardIds)].filter((id) => {
            return TableCard.getConfigById(id)?.role === roleId;
        }).sort((left, right) => {
            return TableCard.getConfigById(left)!.level - TableCard.getConfigById(right)!.level;
        });
        // 旧存档缺少道具商品时补生成一次，已保存的空列表不会重新刷新。
        model.itemIds = itemIds ? [...new Set(itemIds)].filter((id) => {
            return !!TableItem.getConfigById(id);
        }) : this.generateItems();
        model.boughtCardIds = boughtCardIds.filter((id) => {
            return model.cardIds.includes(id);
        });
        model.boughtItemIds = boughtItemIds.filter((id) => {
            return model.itemIds.includes(id);
        });
        model.initialized = true;
    }

    getCurrentEvent() {
        return TableShopEvent.getConfigById(this.ent.ShopModel.eventId);
    }

    setMessage(message: string) {
        this.ent.ShopModel.message = message;
        this.dispatchEvent(ShopEvent.goodsChanged);
    }

    buyCard(cardId: number) {
        const model = this.ent.ShopModel;
        const card = TableCard.getConfigById(cardId);
        if (model.leaving || !model.initialized || !card || !model.cardIds.includes(cardId)
            || model.boughtCardIds.includes(cardId) || card.role !== smc.player.PlayerModel.roleId) {
            return false;
        }
        if (!this.canPay(card.price)) {
            return false;
        }
        smc.player.PlayerModel.gold -= card.price;
        smc.player.PlayerModel.handCard.push(cardId);
        model.boughtCardIds.push(cardId);
        this.completePurchase('已购买' + card.name);
        return true;
    }

    buyItem(itemId: number) {
        const model = this.ent.ShopModel;
        const item = TableItem.getConfigById(itemId);
        if (model.leaving || !model.initialized || !item || !model.itemIds.includes(itemId)
            || model.boughtItemIds.includes(itemId)) {
            return false;
        }
        if (!this.canPay(item.price)) {
            return false;
        }
        if (!smc.player.PlayerBll.addItem(itemId, 1)) {
            this.setMessage('道具已满，请在战斗中使用后再购买');
            return false;
        }
        smc.player.PlayerModel.gold -= item.price;
        model.boughtItemIds.push(itemId);
        this.completePurchase('已购买' + item.name);
        return true;
    }

    private canPay(price: number) {
        if (!Number.isSafeInteger(price) || price <= 0) {
            this.setMessage('商品价格配置无效');
            return false;
        }
        if (smc.player.PlayerModel.gold < price) {
            this.setMessage('金币不足');
            return false;
        }
        return true;
    }

    private completePurchase(message: string) {
        this.dispatchEvent(PlayerEvent.statsChanged);
        this.setMessage(message);
        smc.save.saveGame();
    }

    private generateCards(roleId: number, rawCardCounts: unknown[]) {
        const cardIds: number[] = [];
        rawCardCounts.slice(0, 3).forEach((rawCount, index) => {
            // cardCounts 的三项依次对应1、2、3级数量，生成结果自然按等级升序。
            const count = typeof rawCount === 'number' && Number.isFinite(rawCount)
                ? Math.max(Math.floor(rawCount), 0) : 0;
            const ids = TableCard.getAllConfig().filter((card) => {
                return card.role === roleId && card.level === index + 1;
            }).map((card) => {
                return card.id;
            });
            cardIds.push(...this.shuffle(ids).slice(0, count));
        });
        return cardIds;
    }

    private generateItems() {
        const count = TableUniversal.getConfigById(UniversalNameEnum.SHOP_ITEM_COUNT)?.value || 0;
        const ids = TableItem.getAllConfig().filter((item) => {
            return Number.isSafeInteger(item.price) && item.price > 0;
        }).map((item) => {
            return item.id;
        });
        return this.shuffle(ids).slice(0, Math.max(0, Math.floor(count)));
    }

    private shuffle(ids: number[]) {
        const result = [...ids];
        for (let index = result.length - 1; index > 0; index--) {
            const target = Math.floor(Math.random() * (index + 1));
            [result[index], result[target]] = [result[target], result[index]];
        }
        return result;
    }
}
