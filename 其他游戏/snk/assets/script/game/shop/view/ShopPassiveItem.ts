import { _decorator, instantiate, Label, Layout, Sprite } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import { ResPath } from "../../common/config/ResPath";
import { smc } from "../../common/SingletonModuleComp";
import { TableShopContent } from "../../common/table/TableShopContent";
import { ShopBll } from "../bll/ShopBll";
import type { IShopItem } from "../model/ShopModel";
import { ShopTooltipSaleKind } from "../ShopEvent";
import type { IShopTooltipData } from "../ShopEvent";
import { TooltipPanelView } from "./TooltipPanelView";

const { ccclass } = _decorator;

@ccclass("ShopPassiveItem")
export class ShopPassiveItem extends GameComponent {
    private index: number = -1;
    private item?: IShopItem;
    private popLife: number = 0;

    private get business() {
        return smc.game.shop.getBusiness<ShopBll>(ShopBll);
    }

    private get blocked() {
        const model = smc.game.shop.ShopModel;
        return model.guideOpen || model.grabbedIndex >= 0 || smc.game.GameModel.transitioning;
    }

    private get clickBlocked() {
        return this.blocked || smc.game.shop.ShopModel.rightButtonDown;
    }

    setData(index: number, item: IShopItem) {
        this.index = index;
        this.item = item;
        const content = TableShopContent.getConfigById<TableShopContent>(item.contentId);
        this.setSprite(this.getNode("icon"), ResPath.getItemSpriteIcon(item.contentId), "bundle");
        const nameLabel = this.getNode("lbtName").getComponent(Label);
        nameLabel.string = content.name;
        nameLabel.color =
            item.level >= 3
                ? ColorConst.shopMergeButton
                : item.level === 2
                  ? ColorConst.WHITE
                  : ColorConst.shopText;
        const required = this.business.getItemXpNeeded(index);
        this.updateXpMarks(required, item.xp);
    }

    playPulse() {
        this.popLife = 0.24;
    }

    update(deltaTime: number) {
        if (this.popLife > 0) {
            this.popLife = Math.max(0, this.popLife - deltaTime);
            const t = this.popLife / 0.24;
            const scale = 1 + 0.22 * Math.sin(t * Math.PI);
            this.node.setScale(scale, scale, 1);
            if (this.popLife === 0) {
                this.node.setScale(1, 1, 1);
            }
        }
    }

    private updateXpMarks(required: number, xp: number) {
        const box = this.getNode("xpBox");
        const length = Math.max(box.children.length, required);
        for (let index = 0; index < length; index++) {
            if (index < required && index >= box.children.length) {
                const child = instantiate(box.children[0]);
                child.parent = box;
            }
            const node = box.children[index];
            node.active = index < required;
            node.getComponent(Sprite).color = index < xp ? ColorConst.shopMergeButton : ColorConst.shopItemXpEmpty;
        }
        box.getComponent(Layout).updateLayout();
    }

    protected btnItem() {
        if (this.clickBlocked || !this.item) {
            return;
        }
        const text = this.business.getItemTooltipText(this.index);
        if (!text) {
            return;
        }
        const icon = this.getNode("icon");
        const tooltip: IShopTooltipData = {
            text,
            upgradeItemIndex: this.index,
            sale: {
                kind: ShopTooltipSaleKind.Item,
                index: this.index,
                level: this.item.level,
                effectOrigin: {
                    position: icon.worldPosition.clone(),
                    color: ColorConst.shopMergeButton.clone(),
                },
            },
        };
        TooltipPanelView.show(tooltip);
    }
}
