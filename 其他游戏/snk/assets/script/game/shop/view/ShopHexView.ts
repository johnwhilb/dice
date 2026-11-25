import {
    _decorator,
    Button,
    Label,
    Layout,
    Node,
    Prefab,
    Sprite,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    instantiate,
    tween,
} from "cc";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ColorConst } from "../../common/config/ColorConst";
import { lang } from "../../common/Language";
import { smc } from "../../common/SingletonModuleComp";
import { TableShopContent } from "../../common/table/TableShopContent";
import { ShopOfferEffect } from "../../effect/view/ShopOfferEffect";
import { ShopAudioBll } from "../bll/ShopAudioBll";
import { ShopBll } from "../bll/ShopBll";
import { ShopEvent, ShopSound } from "../ShopEvent";
import { ShopHexCard } from "./ShopHexCard";

const { ccclass, property } = _decorator;

@ccclass("ShopHexView")
@gui.register("ShopHexView", { layer: LayerType.PopUp, prefab: "gui/shop/ui/ShopHexView", mask: true })
export class ShopHexView extends GameComponent {
    @property(Prefab)
    private cardPrefab: Prefab;
    private selectedIndex: number = -1;
    private selectedContentId: number = 0;
    private confirming: boolean = false;
    private effects: ShopOfferEffect;

    start() {
        this.getNode("txtHexTitle").getComponent(Label).string = lang("shop_hex_title");
        this.getNode("txtHexConfirm").getComponent(Label).string = lang("shop_hex_confirm");
        this.createEffectsLayer();
        this.on(ShopEvent.UpdateHexReward, this.refresh, this);
        this.on(ShopEvent.SelectHexCandidate, this.onSelectCandidate, this);
        this.on(ShopEvent.HexCardFlipped, this.onCardFlipped, this);
        this.on(ShopEvent.GoldChanged, this.onGoldChanged, this);
        this.refresh();
    }

    private createEffectsLayer() {
        const effectNode = new Node("hexEffects");
        effectNode.layer = this.node.layer;
        effectNode.parent = this.node;
        effectNode.addComponent(UITransform).setContentSize(this.node.getComponent(UITransform).contentSize);
        this.effects = effectNode.addComponent(ShopOfferEffect);
    }

    private refresh(event?: string, rerolledIndex?: number) {
        if (this.confirming) {
            return;
        }
        const shop = smc.game.shop;
        const model = shop.ShopModel;
        const reward = model.hexReward;
        if (!reward) {
            return;
        }
        const selectionCleared =
            (rerolledIndex !== undefined && rerolledIndex === this.selectedIndex) ||
            (this.selectedIndex >= 0 && reward.candidates[this.selectedIndex] !== this.selectedContentId);
        if (selectionCleared) {
            this.selectedIndex = -1;
            this.selectedContentId = 0;
        }

        const business = shop.getBusiness<ShopBll>(ShopBll);
        const hasReplacement = business.hasHexRerollCandidate();
        const cards = this.getNode("hexCards");
        while (cards.children.length < reward.candidates.length) {
            const cardNode = instantiate(this.cardPrefab);
            cardNode.parent = cards;
        }
        if (rerolledIndex !== undefined && cards.children[rerolledIndex]) {
            const oldCard = cards.children[rerolledIndex].getComponent(ShopHexCard);
            this.effects.playFromWorldPosition(oldCard.getCardWorldPosition(), ColorConst.shopText);
        }

        const hasSelection = this.selectedIndex >= 0;
        const animateState = rerolledIndex !== undefined;
        cards.children.forEach((node, index) => {
            const contentId = reward.candidates[index] ?? 0;
            node.active = contentId > 0;
            if (contentId > 0) {
                const cost = business.getHexRerollCost(index);
                const card = node.getComponent(ShopHexCard);
                card.setData(index, contentId, cost, hasReplacement, model.gold >= cost);
                card.setSelected(index === this.selectedIndex, hasSelection, animateState);
            }
        });
        cards.getComponent(Layout).updateLayout();
        this.getNode("lbtHexGold").getComponent(Label).string = `${lang("shop_gold")}  ${model.gold}`;
        this.refreshConfirmButton(false);
    }

    private onSelectCandidate(event: string, index: number, contentId: number) {
        if (this.confirming) {
            return;
        }
        const reward = smc.game.shop.ShopModel.hexReward;
        if (!reward || reward.candidates[index] !== contentId) {
            return;
        }
        if (this.selectedIndex === index && this.selectedContentId === contentId) {
            return;
        }
        const firstSelection = this.selectedIndex < 0;
        this.selectedIndex = index;
        this.selectedContentId = contentId;
        smc.game.shop.getBusiness<ShopAudioBll>(ShopAudioBll).play(ShopSound.Select);

        const cards = this.getNode("hexCards");
        cards.children.forEach((node, cardIndex) => {
            if (node.active) {
                const card = node.getComponent(ShopHexCard);
                card.setSelected(cardIndex === index, true, true);
                if (cardIndex === index) {
                    this.effects.playCelebrationFromWorld(
                        card.getIconWorldPosition(),
                        ColorConst.shopMergeButton,
                        false
                    );
                }
            }
        });
        this.refreshConfirmButton(true);
        if (firstSelection) {
            this.effects.playCelebrationFromWorld(
                this.getNode("btnHexConfirm").worldPosition,
                ColorConst.shopGreen,
                false
            );
        }
    }

    private onCardFlipped(event: string, index: number) {
        const cards = this.getNode("hexCards");
        const target = cards.children[index];
        if (target && target.active) {
            const card = target.getComponent(ShopHexCard);
            this.effects.playCelebrationFromWorld(card.getIconWorldPosition(), ColorConst.shopText, false);
        }
    }

    private onGoldChanged(event: string, delta: number) {
        if (!delta || this.confirming) {
            return;
        }
        const goldNode = this.getNode("lbtHexGold");
        const color = delta > 0 ? ColorConst.shopGoldGain : ColorConst.shopGoldSpend;
        const text = delta > 0 ? `+${delta}` : `${delta}`;
        this.effects.playFloatingTextFromWorld(goldNode.worldPosition, text, color, false);
        Tween.stopAllByTarget(goldNode);
        goldNode.setScale(1.18, 1.18, 1);
        tween(goldNode)
            .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: "quadOut" })
            .start();
    }

    private refreshConfirmButton(animate: boolean) {
        const hasSelection = !this.confirming && this.selectedIndex >= 0 && this.selectedContentId > 0;
        const confirmBtn = this.getNode("btnHexConfirm");
        const confirmBg = this.getNode("btnHexConfirmBg").getComponent(Sprite);
        const confirmLabel = this.getNode("txtHexConfirm").getComponent(Label);
        confirmBtn.getComponent(Button).interactable = hasSelection;
        confirmBg.color = hasSelection ? ColorConst.shopGreen : ColorConst.shopGreenMuted;
        confirmLabel.color = hasSelection ? ColorConst.shopBattleTextActive : ColorConst.shopBattleTextMuted;

        Tween.stopAllByTarget(confirmBtn);
        if (hasSelection && animate) {
            confirmBtn.setScale(0.9, 0.9, 1);
            tween(confirmBtn)
                .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
                .start();
        } else {
            confirmBtn.setScale(1, 1, 1);
        }
    }

    private fadeOutNode(node: Node, duration: number) {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(duration, { opacity: 0 }, { easing: "quadOut" }).start();
    }

    private playConfirmSequence(selectedIndex: number, contentId: number) {
        this.confirming = true;
        const confirmBtn = this.getNode("btnHexConfirm");
        confirmBtn.getComponent(Button).interactable = false;

        this.fadeOutNode(this.getNode("txtHexTitle"), 0.16);
        this.fadeOutNode(this.getNode("lbtHexGold"), 0.16);
        this.fadeOutNode(confirmBtn, 0.16);

        const cards = this.getNode("hexCards");
        cards.getComponent(Layout).enabled = false;
        let chosenCard: ShopHexCard | undefined;
        cards.children.forEach((node, index) => {
            if (!node.active) {
                return;
            }
            const card = node.getComponent(ShopHexCard);
            card.setLocked(true);
            if (index === selectedIndex) {
                chosenCard = card;
                card.playConfirmShowcase();
            } else {
                card.playConfirmDismiss();
            }
        });

        if (chosenCard) {
            chosenCard.node.setSiblingIndex(cards.children.length - 1);
        }

        const content = TableShopContent.getConfigById<TableShopContent>(contentId);
        const audio = smc.game.shop.getBusiness<ShopAudioBll>(ShopAudioBll);

        this.scheduleOnce(() => {
            audio.play(ShopSound.MaxUpgrade);
            const focusPos = chosenCard ? chosenCard.getIconWorldPosition() : cards.worldPosition;
            this.effects.playCelebrationFromWorld(focusPos, ColorConst.shopMergeButton, true);
            const textPos = chosenCard ? chosenCard.getCardTopWorldPosition() : cards.worldPosition;
            this.effects.playFloatingTextFromWorld(
                textPos,
                `${lang("shop_hex_acquired")} · ${content.name}`,
                ColorConst.shopMergeButton,
                true
            );
        }, 0.2);

        this.scheduleOnce(() => {
            const centerPos = chosenCard ? chosenCard.getCardWorldPosition() : cards.worldPosition;
            this.effects.playFromWorldPosition(centerPos, ColorConst.shopMergeButton);
        }, 0.62);

        this.scheduleOnce(() => {
            smc.game.shop.getBusiness<ShopBll>(ShopBll).selectHexReward(contentId);
        }, 0.85);
    }

    protected btnHexConfirm() {
        if (this.confirming || this.selectedIndex < 0 || !this.selectedContentId) {
            return;
        }
        this.playConfirmSequence(this.selectedIndex, this.selectedContentId);
    }
}
