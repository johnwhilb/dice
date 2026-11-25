import { _decorator, Button, Label, Layout, RichText, Sprite, Tween, UIOpacity, UITransform, Vec3, tween } from "cc";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import { ResPath } from "../../common/config/ResPath";
import { smc } from "../../common/SingletonModuleComp";
import { TableShopContent } from "../../common/table/TableShopContent";
import { UICommon } from "../../ui/UICommon";
import { ShopBll } from "../bll/ShopBll";
import { ShopEvent } from "../ShopEvent";

const { ccclass } = _decorator;

@ccclass("ShopHexCard")
export class ShopHexCard extends GameComponent {
    private index: number = -1;
    private contentId: number = 0;
    private selected: boolean = false;
    private locked: boolean = false;
    private flipping: boolean = false;
    private lifting: boolean = false;
    private hoverElapsed: number = 0;
    private targetScale: number = 1;
    private targetBodyY: number = 34;
    private readonly baseCardY: number = 34;

    setData(index: number, contentId: number, cost: number, hasReplacement: boolean, canAfford: boolean) {
        this.index = index;
        const reroll = this.getNode("btnHexReroll");
        const rerollBg = this.getNode("hexRerollBg").getComponent(Sprite);
        const rerollIcon = this.getNode("hexRerollIcon").getComponent(Sprite);
        const rerollCostNode = this.getNode("lbtHexRerollCost");
        const rerollCostLabel = rerollCostNode.getComponent(Label);
        const canReroll = !this.locked && hasReplacement && canAfford;
        const isFree = hasReplacement && cost === 0;
        const showCost = hasReplacement && cost > 0;

        reroll.getComponent(Button).interactable = canReroll;
        reroll.getComponent(UIOpacity).opacity = canReroll ? 255 : 115;
        rerollBg.color = isFree ? ColorConst.shopPanel : ColorConst.shopButton;
        rerollIcon.color = isFree ? ColorConst.shopMergeButton : canReroll ? ColorConst.shopText : ColorConst.shopMuted;
        rerollCostNode.active = showCost;
        if (showCost) {
            rerollCostLabel.string = `${cost}`;
            rerollCostLabel.color = canAfford ? ColorConst.shopMergeButton : ColorConst.shopMuted;
        }
        this.getNode("hexRerollContent").getComponent(Layout).updateLayout();

        if (this.contentId === contentId) {
            return;
        }

        const entering = this.contentId === 0;
        this.contentId = contentId;
        if (entering) {
            this.applyContent(contentId);
            const opacity = this.node.getComponent(UIOpacity);
            const delay = index * 0.075;
            Tween.stopAllByTarget(this.node);
            Tween.stopAllByTarget(opacity);
            this.node.setScale(0.92, 0.92, 1);
            opacity.opacity = 0;
            tween(opacity).delay(delay).to(0.24, { opacity: 255 }, { easing: "quadOut" }).start();
            tween(this.node).delay(delay).to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" }).start();
            return;
        }

        this.playRerollFlip(contentId);
    }

    setSelected(selected: boolean, hasSelection: boolean, animate: boolean) {
        const becameSelected = selected && !this.selected;
        this.selected = selected;
        this.targetScale = selected ? 1.055 : hasSelection ? 0.96 : 1;
        this.targetBodyY = selected ? this.baseCardY + 14 : hasSelection ? this.baseCardY - 4 : this.baseCardY;
        const targetShadowX = selected ? 6 : 4;
        const targetShadowY = selected ? -14 : -6;
        const targetOpacity = selected || !hasSelection ? 255 : 165;

        const bodyNode = this.getNode("hexCardBody");
        const shadowNode = this.getNode("hexCardShadow");
        const iconNode = this.getNode("hexIcon");

        this.getNode("btnHexPick").getComponent(Sprite).color = selected
            ? ColorConst.shopMergeButton
            : ColorConst.shopHexCardBorder;
        this.getNode("hexCardSurface").getComponent(Sprite).color = selected
            ? ColorConst.shopHexCardSurfaceSelected
            : ColorConst.shopHexCardSurface;
        iconNode.getComponent(Sprite).color = selected ? ColorConst.WHITE : ColorConst.shopText;
        this.getNode("lbtHexName").getComponent(Label).color = selected
            ? ColorConst.shopMergeButton
            : ColorConst.shopText;

        if (becameSelected) {
            this.hoverElapsed = 0;
            Tween.stopAllByTarget(iconNode);
            iconNode.setScale(1, 1, 1);
            tween(iconNode)
                .to(0.1, { scale: new Vec3(1.14, 1.14, 1) }, { easing: "quadOut" })
                .to(0.12, { scale: new Vec3(1.04, 1.04, 1) }, { easing: "quadOut" })
                .start();
        } else if (!selected) {
            Tween.stopAllByTarget(iconNode);
            if (animate) {
                tween(iconNode).to(0.14, { scale: new Vec3(1, 1, 1) }, { easing: "quadOut" }).start();
            } else {
                iconNode.setScale(1, 1, 1);
            }
        }

        if (this.flipping) {
            const rootOpacity = this.node.getComponent(UIOpacity);
            Tween.stopAllByTarget(rootOpacity);
            tween(rootOpacity).to(0.16, { opacity: targetOpacity }, { easing: "quadOut" }).start();
            return;
        }

        Tween.stopAllByTarget(bodyNode);
        Tween.stopAllByTarget(shadowNode);
        if (animate) {
            this.lifting = true;
            tween(bodyNode)
                .to(
                    0.22,
                    { position: new Vec3(0, this.targetBodyY, 0), scale: new Vec3(this.targetScale, this.targetScale, 1) },
                    { easing: selected ? "backOut" : "cubicOut" },
                )
                .call(() => {
                    this.lifting = false;
                })
                .start();
            tween(shadowNode)
                .to(0.2, { position: new Vec3(targetShadowX, targetShadowY, 0) }, { easing: "cubicOut" })
                .start();
            const rootOpacity = this.node.getComponent(UIOpacity);
            Tween.stopAllByTarget(rootOpacity);
            tween(rootOpacity).to(0.16, { opacity: targetOpacity }, { easing: "quadOut" }).start();
        } else {
            this.lifting = false;
            bodyNode.setPosition(0, this.targetBodyY, 0);
            bodyNode.setScale(this.targetScale, this.targetScale, 1);
            shadowNode.setPosition(targetShadowX, targetShadowY, 0);
            if (hasSelection) {
                const rootOpacity = this.node.getComponent(UIOpacity);
                Tween.stopAllByTarget(rootOpacity);
                rootOpacity.opacity = targetOpacity;
            }
        }
    }

    setLocked(locked: boolean) {
        this.locked = locked;
        if (locked) {
            this.getNode("btnHexPick").getComponent(Button).interactable = false;
            this.getNode("btnHexReroll").getComponent(Button).interactable = false;
        }
    }

    playConfirmDismiss() {
        this.selected = false;
        this.lifting = false;
        const opacity = this.node.getComponent(UIOpacity);
        const startPos = this.node.position;
        Tween.stopAllByTarget(this.node);
        Tween.stopAllByTarget(opacity);
        tween(this.node)
            .to(
                0.2,
                {
                    position: new Vec3(startPos.x, startPos.y - 36, 0),
                    scale: new Vec3(0.86, 0.86, 1),
                },
                { easing: "quadIn" },
            )
            .start();
        tween(opacity).to(0.18, { opacity: 0 }, { easing: "quadIn" }).start();
    }

    playConfirmShowcase() {
        this.selected = false;
        this.lifting = false;
        const bodyNode = this.getNode("hexCardBody");
        const reroll = this.getNode("btnHexReroll");
        const rerollOpacity = reroll.getComponent(UIOpacity);
        const rootOpacity = this.node.getComponent(UIOpacity);

        Tween.stopAllByTarget(rerollOpacity);
        tween(rerollOpacity).to(0.14, { opacity: 0 }, { easing: "quadOut" }).start();

        Tween.stopAllByTarget(bodyNode);
        tween(bodyNode)
            .to(0.2, { position: new Vec3(0, 12, 0), scale: new Vec3(1, 1, 1) }, { easing: "cubicOut" })
            .start();

        Tween.stopAllByTarget(this.node);
        Tween.stopAllByTarget(rootOpacity);
        rootOpacity.opacity = 255;
        tween(this.node)
            .to(0.2, { position: new Vec3(0, 8, 0), scale: new Vec3(1.16, 1.16, 1) }, { easing: "cubicOut" })
            .to(0.09, { scale: new Vec3(1.23, 1.23, 1) }, { easing: "quadOut" })
            .to(0.11, { scale: new Vec3(1.16, 1.16, 1) }, { easing: "quadOut" })
            .delay(0.22)
            .to(0.22, { position: new Vec3(0, 36, 0), scale: new Vec3(1.04, 1.04, 1) }, { easing: "quadIn" })
            .start();
        tween(rootOpacity).delay(0.62).to(0.22, { opacity: 0 }, { easing: "quadIn" }).start();
    }

    getIconWorldPosition() {
        return this.getNode("hexIcon").worldPosition;
    }

    getCardWorldPosition() {
        return this.getNode("btnHexPick").worldPosition;
    }

    getCardTopWorldPosition() {
        return this.getNode("btnHexPick").getComponent(UITransform).convertToWorldSpaceAR(new Vec3(0, 188, 0));
    }

    update(deltaTime: number) {
        if (this.selected && !this.locked && !this.flipping && !this.lifting) {
            this.hoverElapsed += deltaTime;
            const offset = Math.sin(this.hoverElapsed * 3.1) * 2.8;
            this.getNode("hexCardBody").setPosition(0, this.targetBodyY + offset, 0);
        }
    }

    private applyContent(contentId: number) {
        const content = TableShopContent.getConfigById<TableShopContent>(contentId);
        this.setSprite(this.getNode("hexIcon"), ResPath.getItemSpriteIcon(contentId), "bundle");
        this.getNode("lbtHexName").getComponent(Label).string = content.name;
        this.getNode("lbtHexDescription").getComponent(RichText).string = UICommon.toText(content.getDescription(1), true);
    }

    private playRerollFlip(contentId: number) {
        this.flipping = true;
        this.lifting = false;
        const bodyNode = this.getNode("hexCardBody");
        const iconNode = this.getNode("hexRerollIcon");

        Tween.stopAllByTarget(iconNode);
        iconNode.angle = 0;
        tween(iconNode)
            .to(0.34, { angle: -360 }, { easing: "cubicOut" })
            .call(() => {
                iconNode.angle = 0;
            })
            .start();

        Tween.stopAllByTarget(bodyNode);
        tween(bodyNode)
            .to(0.11, { scale: new Vec3(0.02, this.targetScale, 1) }, { easing: "quadIn" })
            .call(() => {
                this.applyContent(contentId);
                this.dispatchEvent(ShopEvent.HexCardFlipped, this.index);
            })
            .to(
                0.15,
                {
                    position: new Vec3(0, this.targetBodyY, 0),
                    scale: new Vec3(this.targetScale * 1.06, this.targetScale, 1),
                },
                { easing: "quadOut" },
            )
            .to(0.08, { scale: new Vec3(this.targetScale, this.targetScale, 1) }, { easing: "quadOut" })
            .call(() => {
                this.flipping = false;
            })
            .start();
    }

    protected btnHexPick() {
        if (!this.locked && this.contentId > 0) {
            this.dispatchEvent(ShopEvent.SelectHexCandidate, this.index, this.contentId);
        }
    }

    protected btnHexReroll() {
        if (!this.locked && this.getNode("btnHexReroll").getComponent(Button).interactable) {
            smc.game.shop.getBusiness<ShopBll>(ShopBll).rerollHexReward(this.index, this.contentId);
        }
    }
}
