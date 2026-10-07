import { _decorator, Button, instantiate, Label, Layout, Node, Prefab } from 'cc';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { Shop } from '../Shop';
import { ShopEvent } from '../ShopEvent';
import { TableCard } from '../../common/table/TableCard';
import { smc } from '../../common/SingletonModuleComp';
import { nodeCard } from '../../card/nodeCard';

const { ccclass, property } = _decorator;

@ccclass('CardShopView')
@ecs.register('CardShopView', false)
@gui.register('CardShopView', { layer: LayerType.PopUp, prefab: 'gui/shop/CardShopView' })
export class CardShopView extends CCView<Shop> {
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
        for (const cardId of this.ent.ShopModel.cardIds) {
            const card = TableCard.getConfigById(cardId)!;
            const node = instantiate(this.prefabGoods);
            node.parent = content;
            const view = node.getComponentInChildren(nodeCard)!;
            view.setData(card);
            view.getNode('lbtKind')!.getComponent(Label)!.string = card.level + '级 · ' + card.type;
            node.getChildByName('lbtPrice')!.getComponent(Label)!.string = '价格：' + card.price;
            node.getChildByName('btnBuy')!.on(Button.EventType.CLICK, () => {
                this.ent.ShopBll.buyCard(cardId);
            }, this);
            this.goodsNodes.push(node);
        }
        content.getComponent(Layout)!.updateLayout();
        this.refresh();
    }

    refresh() {
        this.getNode('lbtGold')!.getComponent(Label)!.string = '金币 ' + smc.player.PlayerModel.gold;
        this.getNode('lbtMessage')!.getComponent(Label)!.string = this.ent.ShopModel.message || '卡牌按等级从低到高排列';
        this.goodsNodes.forEach((node, index) => {
            const id = this.ent.ShopModel.cardIds[index];
            const card = TableCard.getConfigById(id)!;
            const bought = this.ent.ShopModel.boughtCardIds.includes(id);
            const button = node.getChildByName('btnBuy')!;
            button.getComponentInChildren(Label)!.string = bought ? '已售出'
                : smc.player.PlayerModel.gold < card.price ? '金币不足' : '购买';
            button.getComponent(Button)!.interactable = !bought && smc.player.PlayerModel.gold >= card.price;
        });
    }

    BtnClose() {
        this.ent.closeCardShopView();
    }

    reset() {
        // ECS 先解除实体引用，再调用 reset，必须立即取消刷新监听。
        this.off(ShopEvent.goodsChanged, this.refresh, this);
        this.goodsNodes = [];
    }
}
