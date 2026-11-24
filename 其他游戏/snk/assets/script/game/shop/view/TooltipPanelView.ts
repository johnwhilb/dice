import { _decorator, EventMouse, Layout, Node, RichText, Tween, UIOpacity, Vec3, tween } from "cc";
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
    private readonly panelMotion = { progress: 0 };
    private readonly shownScale = new Vec3();
    private panelOpacity: UIOpacity;

    static show(data: IShopTooltipData) {
        return oops.gui.open(TooltipPanelView, {
            data,
            onAdded: (node) => {
                node.getComponent(TooltipPanelView).playOpenAnimation();
            },
            onBeforeRemove: (node, next) => {
                node.getComponent(TooltipPanelView).playCloseAnimation(() => {
                    next();
                });
            },
        });
    }

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

    private playOpenAnimation() {
        this.shownScale.set(this.node.scale);
        this.panelOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.panelMotion.progress = 0;
        this.updatePanelMotion();
        this.playPanelAnimation(true);
    }

    private playCloseAnimation(next: () => void) {
        this.sale = undefined;
        if (!this.node.activeInHierarchy || this.panelMotion.progress === 0) {
            Tween.stopAllByTarget(this.panelMotion);
            next();
            return;
        }
        this.playPanelAnimation(false, next);
    }

    private playPanelAnimation(opening: boolean, next?: () => void) {
        Tween.stopAllByTarget(this.panelMotion);
        tween(this.panelMotion)
            .to(
                opening ? 0.18 : 0.12,
                { progress: opening ? 1 : 0 },
                {
                    easing: opening ? "cubicOut" : "quadIn",
                    onUpdate: () => {
                        this.updatePanelMotion();
                    },
                },
            )
            .call(() => {
                next?.();
            })
            .start();
    }

    private updatePanelMotion() {
        const progress = this.panelMotion.progress;
        const scale = 0.96 + 0.04 * progress;
        this.node.setScale(this.shownScale.x * scale, this.shownScale.y * scale, this.shownScale.z);
        this.panelOpacity.opacity = Math.round(255 * progress);
    }

    private resetMouseButton() {
        this.rightButtonDown = false;
    }

    private trackMouseButton(event: EventMouse) {
        this.rightButtonDown = event.getButton() === EventMouse.BUTTON_RIGHT;
    }

    protected onDestroy() {
        Tween.stopAllByTarget(this.panelMotion);
        super.onDestroy();
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
        let sold = false;
        if (sale.kind === ShopTooltipSaleKind.Team) {
            sold = business.sell(sale.index);
        } else if (sale.kind === ShopTooltipSaleKind.Reserve) {
            sold = business.sellReserve(sale.index, sale.level);
        } else {
            sold = business.sellItem(sale.index);
        }
        if (sold && sale.effectOrigin) {
            this.dispatchEvent(ShopEvent.ShowRoleSaleEffect, sale.effectOrigin);
        }
        oops.gui.remove(TooltipPanelView);
    }
}
