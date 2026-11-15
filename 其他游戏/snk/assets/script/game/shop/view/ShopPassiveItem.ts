import { smc } from "../../common/SingletonModuleComp";
import { oops } from "db://oops-framework/core/Oops";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ShopBll } from "../bll/ShopBll";
import { _decorator, EventMouse, Node, Sprite, instantiate, Layout } from "cc";
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

    start() {
        // 原版道具通过右键出售，价格与状态校验由 ShopBll.sellItem 处理。
        this.getNode("btnItem").on(Node.EventType.MOUSE_UP, this.sellItem, this);
    }

    setData(index: number, item: IShopItem) {
        this.index = index;
        this.item = item;
        this.setSprite(this.getNode("icon"), ResPath.getItemSpriteIcon(item.contentId), "bundle");
        const required = this.business.getItemXpNeeded(index);
        this.updateXpMarks(required, item.xp);
    }

    private sellItem(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_RIGHT && !this.blocked) {
            event.propagationStopped = true;
            this.business.sellItem(this.index);
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
            node.getComponentInChildren(Sprite).color = index < xp ? ColorConst.shopText : ColorConst.shopItemXpEmpty;
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
            const item = this.item;
            const content = TableShopContent.getConfigById<TableShopContent>(item.contentId);
            const required = this.business.getItemXpNeeded(this.index);
            const rule = TableShopRule.getInitial();
            const text = `${content.name} · [yellow]${item.level}[fg]级${required ? `，经验 [yellow]${item.xp}/${required}[fg]，每点经验 [yellow]${rule.itemXpCost}[fg] 金币` : ""}\n${content.getDescription(item.level)}\n[fg]售价：[yellow]${item.level * rule.itemSalePerLevel}[fg] 金币`;
            oops.gui.open(TooltipPanelView, { data: text });
        }
    }
}
