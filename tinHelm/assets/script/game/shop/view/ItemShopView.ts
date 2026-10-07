import { _decorator, Button, instantiate, Label, Layout, Node, Prefab, UITransform } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Shop } from '../Shop';
import { ShopEvent } from '../ShopEvent';
import { TableItem } from '../../common/table/TableItem';
import { smc } from '../../common/SingletonModuleComp';

const { ccclass, property } = _decorator;

@ccclass('ItemShopView')
@ecs.register('ItemShopView', false)
@gui.register('ItemShopView', { layer: LayerType.PopUp, prefab: 'gui/shop/ItemShopView' })
export class ItemShopView extends CCView<Shop> {
    @property(Prefab)
    prefabGoods: Prefab = null!;
    private goodsNodes: Node[] = [];

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        const content = this.getNode('content')!;
        for (const child of [...content.children]) {
            child.removeFromParent();
            child.destroy();
        }
        for (const itemId of this.ent.ShopModel.itemIds) {
            const item = TableItem.getConfigById(itemId)!;
            const node = instantiate(this.prefabGoods);
            node.parent = content;
            const name = node.children[0].getChildByName('lbtName')!;
            name.getComponent(UITransform)!.setContentSize(140, 140);
            const label = name.getComponent(Label)!;
            label.fontSize = 20;
            label.lineHeight = 24;
            label.overflow = Label.Overflow.SHRINK;
            label.enableWrapText = true;
            label.string = item.name + '\n' + item.des;
            node.getChildByName('lbtPrice')!.getComponent(Label)!.string = '价格：' + item.price;
            node.getChildByName('btnBuy')!.on(Button.EventType.CLICK, () => {
                this.ent.ShopBll.buyItem(itemId);
            }, this);
            this.goodsNodes.push(node);
        }
        content.getComponent(Layout)!.updateLayout();
        this.refresh();
    }

    refresh() {
        this.getNode('lbtGold')!.getComponent(Label)!.string = '金币 ' + smc.player.PlayerModel.gold
            + '　道具 ' + smc.player.PlayerBll.getItemCount() + '/' + smc.player.PlayerBll.getItemLimit();
        this.getNode('lbtMessage')!.getComponent(Label)!.string = this.ent.ShopModel.message || '每种道具限购一次';
        const full = smc.player.PlayerBll.getItemCount() >= smc.player.PlayerBll.getItemLimit();
        this.goodsNodes.forEach((node, index) => {
            const id = this.ent.ShopModel.itemIds[index];
            const item = TableItem.getConfigById(id)!;
            const bought = this.ent.ShopModel.boughtItemIds.includes(id);
            const button = node.getChildByName('btnBuy')!;
            button.getComponentInChildren(Label)!.string = bought ? '已售出' : full ? '道具已满'
                : smc.player.PlayerModel.gold < item.price ? '金币不足' : '购买';
            button.getComponent(Button)!.interactable = !bought && !full && smc.player.PlayerModel.gold >= item.price;
        });
    }

    BtnClose() {
        this.ent.closeItemShopView();
    }

    reset() {
        // ECS 先解除实体引用，再调用 reset，必须立即取消刷新监听。
        this.off(ShopEvent.goodsChanged, this.refresh, this);
        this.goodsNodes = [];
    }
}
