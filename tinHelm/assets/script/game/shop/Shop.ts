import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { ShopBll } from './bll/ShopBll';
import { ShopModel } from './model/ShopModel';
import { ShopView } from './view/ShopView';
import { CardShopView } from './view/CardShopView';
import { ItemShopView } from './view/ItemShopView';

@ecs.register('Shop')
export class Shop extends CCEntity {
    ShopBll!: ShopBll;
    ShopModel!: ShopModel;
    ShopView!: ShopView;
    CardShopView!: CardShopView;
    ItemShopView!: ItemShopView;

    static create(): Shop {
        return ecs.getEntity<Shop>(Shop);
    }

    init() {
        this.addComponents(ShopModel);
        this.ShopBll = this.addBusiness<ShopBll>(ShopBll);
    }

    prepare(roleId: number, eventId: number) {
        return this.ShopBll.prepare(roleId, eventId);
    }

    restore(eventId: number, roleId: number, cardIds: number[], itemIds?: number[],
        boughtCardIds: number[] = [], boughtItemIds: number[] = []) {
        this.ShopBll.restore(eventId, roleId, cardIds, itemIds, boughtCardIds, boughtItemIds);
    }

    clear() {
        this.closeShopView();
        this.ShopModel.reset();
    }

    getCurrentEvent() {
        return this.ShopBll.getCurrentEvent();
    }

    getCardIds() {
        return this.ShopModel.cardIds;
    }

    openShopView() {
        if (this.has(ShopView)) {
            return Promise.resolve(this.ShopView.node);
        }
        return this.addUi(ShopView);
    }

    isSubShopOpen() {
        return this.has(CardShopView) || this.has(ItemShopView);
    }

    openCardShopView() {
        return this.openSubShop(true);
    }

    openItemShopView() {
        return this.openSubShop(false);
    }

    // 等待子商店预制体加载结束后核对当前事件，并在成功或失败时解除打开锁。
    private async openSubShop(cardShop: boolean) {
        const model = this.ShopModel;
        if (model.opening || model.leaving || this.has(CardShopView) || this.has(ItemShopView)) {
            return;
        }
        model.opening = true;
        this.ShopBll.setMessage('');
        const eventId = model.eventId;
        try {
            const node = cardShop ? await this.addUi(CardShopView) : await this.addUi(ItemShopView);
            if (model.leaving || !model.initialized || eventId !== model.eventId) {
                if (cardShop) {
                    this.closeCardShopView();
                }
                else {
                    this.closeItemShopView();
                }
                return null;
            }
            return node;
        }
        catch (error) {
            console.error('商店界面打开失败', error);
            this.ShopBll.setMessage('商店界面打开失败，请重试');
            return null;
        }
        finally {
            model.opening = false;
            this.ShopBll.setMessage(model.message);
        }
    }

    closeCardShopView() {
        if (this.has(CardShopView)) {
            this.removeUi(CardShopView);
        }
        this.ShopBll.setMessage('');
    }

    closeItemShopView() {
        if (this.has(ItemShopView)) {
            this.removeUi(ItemShopView);
        }
        this.ShopBll.setMessage('');
    }

    closeShopView() {
        // 整个商店退出时只关闭界面，不再发送刷新消息。
        if (this.has(CardShopView)) {
            this.removeUi(CardShopView);
        }
        if (this.has(ItemShopView)) {
            this.removeUi(ItemShopView);
        }
        if (this.has(ShopView)) {
            this.removeUi(ShopView);
        }
        this.ShopModel.message = "";
    }
}
