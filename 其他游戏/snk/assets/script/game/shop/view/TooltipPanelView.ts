import { _decorator, EventMouse, Label, Layout, Node, RichText, Sprite, Tween, UIOpacity, Vec3, tween } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { oops } from "db://oops-framework/core/Oops";
import { ColorConst } from "../../common/config/ColorConst";
import { smc } from "../../common/SingletonModuleComp";
import { TableShopRule } from "../../common/table/TableShopRule";
import { UICommon } from "../../ui/UICommon";
import { ShopBll } from "../bll/ShopBll";
import { ShopEvent, ShopTooltipSaleKind } from "../ShopEvent";
import type { IShopTooltipData, IShopTooltipSale } from "../ShopEvent";

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
    private upgradeItemIndex: number = -1;
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
        for (const name of ["btnSellTooltip", "btnUpgradeTooltip"]) {
            const button = this.getNode(name);
            // Cocos 会把右键模拟为触摸，记录鼠标按键以拦截误触发的操作。
            button.on(Node.EventType.TOUCH_START, this.resetMouseButton, this);
            button.on(Node.EventType.MOUSE_DOWN, this.trackMouseButton, this);
        }
        this.on(ShopEvent.UpdateShopContent, this.refreshItemTooltip, this);
    }

    onAdded(data: IShopTooltipData) {
        this.sale = data.sale;
        this.upgradeItemIndex = data.upgradeItemIndex ?? -1;
        this.renderContent(data.text);
    }

    private renderContent(text: string) {
        const formatted = UICommon.toText(`[fg]${text}`, true);
        this.getNode("lbtTooltip").getComponent(RichText).string = formatted;
        this.refreshActionButtons();
        this.node.getComponent(Layout).updateLayout();
    }

    private refreshActionButtons() {
        const upgradeBtn = this.getNode("btnUpgradeTooltip");
        const sellBtn = this.getNode("btnSellTooltip");
        const actions = this.getNode("tooltipActions");
        const hasSale = !!this.sale;
        let showUpgrade = false;
        if (this.upgradeItemIndex >= 0) {
            const shop = smc.game.shop;
            const business = shop.getBusiness<ShopBll>(ShopBll);
            const required = business.getItemXpNeeded(this.upgradeItemIndex);
            showUpgrade = required > 0;
            if (showUpgrade) {
                const cost = TableShopRule.getInitial().itemXpCost;
                const canAfford = shop.ShopModel.gold >= cost;
                this.getNode("btnUpgradeTooltipBackground").getComponent(Sprite).color = canAfford
                    ? ColorConst.shopBuyButton
                    : ColorConst.shopButton;
                const upgradeLabel = this.getNode("lbtUpgradeTooltip").getComponent(Label);
                upgradeLabel.string = `升级 · ${cost}`;
                upgradeLabel.color = canAfford ? ColorConst.WHITE : ColorConst.shopMuted;
            }
        }
        upgradeBtn.active = showUpgrade;
        sellBtn.active = hasSale;
        actions.active = showUpgrade || hasSale;
        if (actions.active) {
            actions.getComponent(Layout).updateLayout();
        }
    }

    private refreshItemTooltip() {
        if (this.upgradeItemIndex < 0) {
            return;
        }
        const shop = smc.game.shop;
        const item = shop.ShopModel.items[this.upgradeItemIndex];
        if (!item) {
            return;
        }
        if (this.sale && this.sale.kind === ShopTooltipSaleKind.Item) {
            this.sale.level = item.level;
        }
        const text = shop.getBusiness<ShopBll>(ShopBll).getItemTooltipText(this.upgradeItemIndex);
        this.renderContent(text);
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
        this.upgradeItemIndex = -1;
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
        this.off(ShopEvent.UpdateShopContent, this.refreshItemTooltip, this);
        Tween.stopAllByTarget(this.panelMotion);
        super.onDestroy();
    }

    protected btnUpgradeTooltip() {
        const model = smc.game.shop.ShopModel;
        if (
            this.upgradeItemIndex < 0 ||
            model.guideOpen ||
            model.grabbedIndex >= 0 ||
            this.rightButtonDown ||
            smc.game.GameModel.transitioning
        ) {
            return;
        }
        smc.game.shop.getBusiness<ShopBll>(ShopBll).buyItemXp(this.upgradeItemIndex);
    }

    protected btnSellTooltip() {
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
        this.upgradeItemIndex = -1;
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
