import { smc } from "../../common/SingletonModuleComp";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ShopBll } from "../bll/ShopBll";
import { ShopAudioBll } from "../bll/ShopAudioBll";
import { _decorator, Sprite, instantiate, Layout } from "cc";
import { ShopSound, ShopTooltipSaleKind } from "../ShopEvent";
import type { IShopTooltipData } from "../ShopEvent";
import type { IShopItem } from "../model/ShopModel";
import { ColorConst } from "../../common/config/ColorConst";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableShopRule } from "../../common/table/TableShopRule";
import { ResPath } from "../../common/config/ResPath";

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
        this.setSprite(this.getNode("icon"), ResPath.getItemSpriteIcon(item.contentId), "bundle");
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
            node.getComponentInChildren(Sprite).color = index < xp ? ColorConst.shopMergeButton : ColorConst.shopItemXpEmpty;
        }
        box.getComponent(Layout).updateLayout();
    }

    btnItem() {
        if (!this.clickBlocked) {
            this.business.buyItemXp(this.index);
        }
    }

    btnItemInfo() {
        if (!this.clickBlocked) {
            smc.game.shop.getBusiness<ShopAudioBll>(ShopAudioBll).play(ShopSound.Click);
            const item = this.item;
            const content = TableShopContent.getConfigById<TableShopContent>(item.contentId);
            const required = this.business.getItemXpNeeded(this.index);
            const rule = TableShopRule.getInitial();
            const text = `${content.name} · [yellow]${item.level}[fg]级${required ? `，经验 [yellow]${item.xp}/${required}[fg]，每点经验 [yellow]${rule.itemXpCost}[fg] 金币` : ""}\n${content.getDescription(item.level)}\n[fg]售价：[yellow]${item.level * rule.itemSalePerLevel}[fg] 金币`;
            const icon = this.getNode("icon");
            const tooltip: IShopTooltipData = {
                text,
                sale: {
                    kind: ShopTooltipSaleKind.Item,
                    index: this.index,
                    level: item.level,
                    effectOrigin: {
                        position: icon.worldPosition.clone(),
                        color: ColorConst.shopMergeButton.clone(),
                    },
                },
            };
            TooltipPanelView.show(tooltip);
        }
    }
}
