import { Label, Node, instantiate, _decorator } from 'cc';
import { gui } from 'db://oops-framework/core/gui/Gui';
import { LayerType } from 'db://oops-framework/core/gui/layer/LayerEnum';
import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { CCView } from 'db://oops-framework/module/common/CCView';
import { nodeCard } from '../../card/nodeCard';
import { smc } from '../../common/SingletonModuleComp';
import { TableCard } from '../../common/table/TableCard';
import { Shop } from '../Shop';

const { ccclass } = _decorator;

@ccclass('ShopView')
@ecs.register('ShopView', false)
@gui.register('ShopView', { layer: LayerType.UI, prefab: 'gui/shop/ShopView' })
export class ShopView extends CCView<Shop> {
    private cardTemplate: Node = null!;

    start() {
        this.nodeTreeInfoLite();
        this.setButton();
        this.cardTemplate = instantiate(this.getNode('nodeShopCard')!);
        this.refresh();
    }

    refresh() {
        const player = smc.player.PlayerModel;
        this.getNode('lbtCurrentHp')!.getComponent(Label)!.string = `当前血量：${player.hp}/${player.maxHp}`;
        this.refreshCards();
    }

    btnClose() {
        this.ent.closeShopView();
        smc.gameFlow.advanceLevel();
    }

    private refreshCards() {
        const cardLayout = this.getNode('nodeShopCardLayout')!;
        cardLayout.destroyAllChildren();
        this.ent.getCardIds().forEach((cardId) => {
            const card = TableCard.getConfigById(cardId);
            if (!card) {
                return;
            }

            const cardNode = instantiate(this.cardTemplate);
            cardNode.active = true;
            cardNode.parent = cardLayout;
            const cardView = cardNode.getComponentInChildren(nodeCard)!;
            cardView.setData(card);
            cardView.getNode('lbtKind')!.getComponent(Label)!.string = `售价：${card.price}`;
        });
    }

    reset() {
        this.cardTemplate = null!;
    }
}
