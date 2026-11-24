import { _decorator, EventMouse, Layout, Node, RichText } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { oops } from "db://oops-framework/core/Oops";
import { smc } from "../../common/SingletonModuleComp";
import { UICommon } from "../../ui/UICommon";
import { ShopEvent, ShopTooltipSaleKind } from "../ShopEvent";
import type { IShopTooltipData, IShopTooltipSale } from "../ShopEvent";
import { ShopBll } from "../bll/ShopBll";

const { ccclass } = _decorator;

@ccclass("TooltipPanelView")
@gui.register("TooltipPanelView", {
    layer: LayerType.PopUp,
    prefab: "gui/shop/ui/TooltipPanelView",
    mask: true,
    vacancy: true,
})
export class TooltipPanelView extends GameComponent {
    private sale?: IShopTooltipSale;
    private rightButtonDown = false;

    start() {
        const button = this.getNode("btnSellTooltip");
        // Cocos 会把右键模拟为触摸，记录鼠标按键以拦截误触发的出售。
        button.on(Node.EventType.TOUCH_START, this.resetMouseButton, this);
        button.on(Node.EventType.MOUSE_DOWN, this.trackMouseButton, this);
    }

    onAdded(data: IShopTooltipData) {
        this.sale = data.sale;
        this.getNode("btnSellTooltip").active = !!this.sale;
        const formatted = UICommon.toText(`[fg]${data.text}`, true);
        this.getNode("lbtTooltip").getComponent(RichText).string = formatted;
        this.node.getComponent(Layout).updateLayout();
    }

    private resetMouseButton() {
        this.rightButtonDown = false;
    }

    private trackMouseButton(event: EventMouse) {
        this.rightButtonDown = event.getButton() === EventMouse.BUTTON_RIGHT;
    }

    btnSellTooltip() {
        const sale = this.sale;
        const model = smc.game.shop.ShopModel;
        if (
            !sale ||
            model.guideOpen ||
            model.grabbedIndex >= 0 ||
            this.rightButtonDown ||
            smc.game.GameModel.transitioning
        ) {
            return;
        }

        this.sale = undefined;
        const business = smc.game.shop.getBusiness<ShopBll>(ShopBll);
        let roleSold = false;
        if (sale.kind === ShopTooltipSaleKind.Team) {
            roleSold = business.sell(sale.index);
        } else if (sale.kind === ShopTooltipSaleKind.Reserve) {
            roleSold = business.sellReserve(sale.index, sale.level);
        } else {
            business.sellItem(sale.index);
        }
        if (roleSold && sale.effectOrigin) {
            this.dispatchEvent(ShopEvent.ShowRoleSaleEffect, sale.effectOrigin);
        }
        oops.gui.remove(TooltipPanelView);
    }
}
