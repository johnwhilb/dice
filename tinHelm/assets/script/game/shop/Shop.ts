import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCEntity } from 'db://oops-framework/module/common/CCEntity';
import { ShopBll } from './bll/ShopBll';
import { ShopModel } from './model/ShopModel';
import { ShopView } from './view/ShopView';

@ecs.register('Shop')
export class Shop extends CCEntity {
    ShopBll!: ShopBll;
    ShopModel!: ShopModel;
    ShopView!: ShopView;

    static create(): Shop {
        return ecs.getEntity<Shop>(Shop);
    }

    init() {
        this.addComponents(ShopModel);
        this.ShopBll = this.addBusiness<ShopBll>(ShopBll);
    }

    prepare(day: number, roleId: number, eventId = 0) {
        return this.ShopBll.prepare(day, roleId, eventId);
    }

    restore(eventId: number, roleId: number, cardIds: number[]) {
        this.ShopBll.restore(eventId, roleId, cardIds);
    }

    clear() {
        this.ShopModel.reset();
    }

    getCurrentEvent() {
        return this.ShopBll.getCurrentEvent();
    }

    getCardIds() {
        return this.ShopModel.cardIds;
    }

    async openShopView() {
        if (this.has(ShopView)) {
            return Promise.resolve(this.ShopView.node);
        }

        const node = await this.addUi(ShopView);
        if (!node) {
            return null;
        }

        const shopView = node.getComponent(ShopView) || node.addComponent(ShopView);
        if (!this.has(ShopView)) {
            this.add(shopView);
        }
        return node;
    }

    closeShopView() {
        if (this.has(ShopView)) {
            this.removeUi(ShopView);
        }
    }
}
