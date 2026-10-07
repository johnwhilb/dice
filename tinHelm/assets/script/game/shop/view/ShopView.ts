import { _decorator, Button, Label } from 'cc';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { smc } from '../../common/SingletonModuleComp';
import { Shop } from '../Shop';
import { ShopEvent } from '../ShopEvent';

const { ccclass } = _decorator;

@ccclass('ShopView')
@ecs.register('ShopView', false)
@gui.register('ShopView', { layer: LayerType.UI, prefab: 'gui/shop/ShopView' })
export class ShopView extends CCView<Shop> {
    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.on(ShopEvent.goodsChanged, this.refresh, this);
        this.refresh();
    }

    refresh() {
        this.getNode('lbtGold')!.getComponent(Label)!.string = '金币 ' + smc.player.PlayerModel.gold;
        this.getNode('lbtMessage')!.getComponent(Label)!.string =
            this.ent.ShopModel.message || this.ent.getCurrentEvent()?.name || '商店';
        for (const name of ['btnCardShop', 'btnItemShop', 'btnContinue']) {
            this.getNode(name)!.getComponent(Button)!.interactable =
                !this.ent.ShopModel.opening && !this.ent.ShopModel.leaving && !this.ent.isSubShopOpen();
        }
    }

    btnCardShop() {
        return this.ent.openCardShopView();
    }

    btnItemShop() {
        return this.ent.openItemShopView();
    }

    btnContinue() {
        const model = this.ent.ShopModel;
        if (model.opening || model.leaving || this.ent.isSubShopOpen()) {
            return;
        }
        model.leaving = true;
        smc.gameFlow.advanceLevel();
    }

    reset() {
        // ECS 先解除实体引用，再调用 reset，必须立即取消刷新监听。
        this.off(ShopEvent.goodsChanged, this.refresh, this);
    }
}
