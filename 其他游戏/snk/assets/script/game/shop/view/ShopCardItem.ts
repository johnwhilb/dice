import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { ShopAudioBll } from "../bll/ShopAudioBll";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { TableRoleClass } from "../../common/table/TableRoleClass";
import { _decorator, Color, EventTouch, Graphics, Label, Node, Prefab, Sprite, UITransform, instantiate, Layout, UIOpacity } from "cc";
import { TableRole } from "../../common/table/TableRole";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableShopRule } from "../../common/table/TableShopRule";
import { ShopClassItem } from "./ShopClassItem";
import { UICommon } from "../../ui/UICommon";
import { ShopRoleItem } from "./ShopRoleItem";
import { ShopEvent, ShopRoleKind, ShopSound } from "../ShopEvent";
import { ColorConst } from "../../common/config/ColorConst";

const { ccclass, property } = _decorator;

@ccclass("ShopCardItem")
export class ShopCardItem extends GameComponent {
    @property(Prefab)
    private classPrefab: Prefab;
    @property(Prefab)
    private markPrefab: Prefab;
    private index: number = 0;
    private roleId: number = 0;
    private roleColor: Color = ColorConst.shopText;
    private mergeHighlight: boolean = false;
    private mergeGraphics?: Graphics;
    private mergeElapsed: number = 0;
    private appearDelay: number = 0;
    private appearElapsed: number = 1;
    private readonly appearDuration: number = 0.22;

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
        const infoNode = this.getNode("btnRoleInfo");
        const glowNode = new Node("mergeGlow");
        glowNode.layer = infoNode.layer;
        glowNode.parent = infoNode;
        glowNode.addComponent(UITransform).setContentSize(infoNode.getComponent(UITransform).contentSize);
        this.mergeGraphics = glowNode.addComponent(Graphics);
        infoNode.on(Node.EventType.TOUCH_START, this.previewCardClasses, this);
        this.getNode("btnBuy").on(Node.EventType.TOUCH_START, this.previewCardClasses, this);
    }

    setData(index: number, roleId: number) {
        this.index = index;
        this.roleId = roleId;
        const opacity = this.getComponent(UIOpacity) ?? this.addComponent(UIOpacity);
        if (!roleId) {
            opacity.opacity = 0;
            this.mergeHighlight = false;
            this.mergeGraphics?.clear();
            this.node.pauseSystemEvents(true);
            return;
        }
        this.node.resumeSystemEvents(true);
        const name = this.getNode("lbtName").getComponent(Label);
        const role = TableRole.getConfigById<TableRole>(roleId);
        const content = TableShopContent.getRole(roleId);
        this.roleColor = new Color(content.color);
        name.string = role.name;
        name.color = this.roleColor;
        this.getNode("ShopRoleItem")
            .getComponent(ShopRoleItem)
            .setData({ roleId, index, level: 1, kind: ShopRoleKind.Offer });
        const owned = smc.game.shop.ShopModel.team.find((item) => {
            return item.roleId === roleId;
        });
        const offerState = this.business.getOfferState(roleId);
        const canBuy = offerState.canAfford && !offerState.teamFull && !offerState.isMaxLevel;
        opacity.opacity = canBuy ? 255 : 212;
        this.mergeHighlight = offerState.willUpgrade && canBuy;
        if (!this.mergeHighlight) {
            this.mergeGraphics?.clear();
            this.getNode("btnBuy").setScale(1, 1, 1);
        }
        this.updateBuyButton(offerState.willUpgrade, offerState.nextLevel, offerState.isMaxLevel, offerState.teamFull, offerState.canAfford);
        this.updateClasses(role.getClasses(), !owned);
        if (!owned) {
            this.updateOwnedMarks(0);
            return;
        }
        const copies = owned.copies;
        const upgrade = TableShopRule.getInitial().copiesPerUpgrade;
        const upgraded = Math.floor(copies / upgrade);
        const count = copies >= upgrade * upgrade ? 0 : upgraded + (copies % upgrade);
        this.updateOwnedMarks(count);
    }

    playAppear(delay: number) {
        if (!this.roleId) {
            return;
        }
        this.appearDelay = delay;
        this.appearElapsed = 0;
        this.node.setScale(0.84, 0.84, 1);
    }

    update(deltaTime: number) {
        if (this.appearElapsed < this.appearDuration) {
            if (this.appearDelay > 0) {
                this.appearDelay = Math.max(0, this.appearDelay - deltaTime);
            } else {
                this.appearElapsed = Math.min(this.appearDuration, this.appearElapsed + deltaTime);
                const progress = this.appearElapsed / this.appearDuration;
                const scale = progress < 0.72
                    ? 0.84 + 0.21 * (progress / 0.72)
                    : 1.05 - 0.05 * ((progress - 0.72) / 0.28);
                this.node.setScale(scale, scale, 1);
            }
        }
        if (this.mergeHighlight && this.mergeGraphics && this.roleId) {
            this.mergeElapsed += deltaTime;
            const pulse = 0.5 + 0.5 * Math.sin(this.mergeElapsed * 6.5);
            const btnScale = 1 + 0.045 * pulse;
            this.getNode("btnBuy").setScale(btnScale, btnScale, 1);
            this.drawMergeGlow(pulse);
        }
    }

    private drawMergeGlow(pulse: number) {
        const graphics = this.mergeGraphics;
        if (!graphics) {
            return;
        }
        const size = this.getNode("btnRoleInfo").getComponent(UITransform).contentSize;
        const halfW = size.width / 2 - 2;
        const halfH = size.height / 2 - 2;
        const arm = 24;
        graphics.clear();
        const glow = ColorConst.shopMergeGlow.clone();
        glow.a = Math.round(135 + 110 * pulse);
        graphics.strokeColor = glow;
        graphics.lineWidth = 3 + 1.5 * pulse;
        const corners = [
            [-halfW, -halfH, 1, 1],
            [halfW, -halfH, -1, 1],
            [halfW, halfH, -1, -1],
            [-halfW, halfH, 1, -1],
        ];
        for (const [cx, cy, sx, sy] of corners) {
            graphics.moveTo(cx, cy + sy * arm);
            graphics.lineTo(cx, cy);
            graphics.lineTo(cx + sx * arm, cy);
        }
        graphics.stroke();
    }

    private updateBuyButton(willUpgrade: boolean, nextLevel: number, isMaxLevel: boolean, teamFull: boolean, canAfford: boolean) {
        const buySprite = this.getNode("btnBuy").getComponent(Sprite);
        const buyLabel = this.getNode("txtBuy").getComponent(Label);
        if (isMaxLevel) {
            buySprite.color = ColorConst.shopButton;
            buyLabel.color = ColorConst.shopMuted;
            buyLabel.string = "已满级";
        } else if (teamFull) {
            buySprite.color = ColorConst.shopButton;
            buyLabel.color = ColorConst.shopMuted;
            buyLabel.string = "队伍满";
        } else if (!canAfford) {
            buySprite.color = ColorConst.shopButton;
            buyLabel.color = ColorConst.shopMuted;
            buyLabel.string = "购买";
        } else if (willUpgrade) {
            buySprite.color = ColorConst.shopMergeButton;
            buyLabel.color = ColorConst.shopHover;
            buyLabel.string = `升${nextLevel}级`;
        } else {
            buySprite.color = ColorConst.shopBuyButton;
            buyLabel.color = ColorConst.WHITE;
            buyLabel.string = "购买";
        }
    }

    private previewCardClasses(event: EventTouch) {
        if (!this.blocked && this.roleId) {
            const classIds = TableRole.getConfigById<TableRole>(this.roleId)
                .getClasses()
                .map((roleClass) => {
                    return roleClass.id;
                });
            this.dispatchEvent(ShopEvent.HighlightClasses, classIds, event.getID());
        }
    }

    getRemovalEffectTargets() {
        if (!this.roleId) {
            return [];
        }
        const role = this.getNode("ShopRoleItem").getComponent(ShopRoleItem);
        const targets = [role.getNode("background").getComponent(Sprite)];
        for (const node of this.getNode("classesBox").children) {
            if (node.active) {
                targets.push(node.getComponent(ShopClassItem).getNode("background").getComponent(Sprite));
            }
        }
        return targets;
    }

    private updateClasses(items: TableRoleClass[], previewNext: boolean) {
        const box = this.getNode("classesBox");
        const progress = this.business.getClassProgress();
        const length = Math.max(box.children.length, items.length);
        for (let index = 0; index < length; index++) {
            const item = items[index];
            if (item && index >= box.children.length) {
                const child = instantiate(this.classPrefab);
                child.parent = box;
            }
            const node = box.children[index];
            node.active = !!item;
            if (item) {
                const classProgress = progress.find((entry) => {
                    return entry.classId === item.id;
                });
                node.getComponent(ShopClassItem).setData({
                    classId: item.id,
                    count: classProgress ? classProgress.count : 0,
                    previewNext,
                });
            }
        }
        box.getComponent(Layout).updateLayout();
    }

    private updateOwnedMarks(count: number) {
        const content = this.getNode("ownedBox");
        const length = Math.max(content.children.length, count);
        for (let index = 0; index < length; index++) {
            if (index < count && index >= content.children.length) {
                const child = instantiate(this.markPrefab);
                child.parent = content;
            }
            const node = content.children[index];
            node.active = index < count;
            if (node.active) {
                const sprite = node.getComponent(Sprite) ?? node.getComponentInChildren(Sprite);
                if (sprite) {
                    sprite.color = this.mergeHighlight ? ColorConst.shopMergeButton : this.roleColor;
                }
            }
        }
        content.getComponent(Layout).updateLayout();
    }

    protected btnBuy() {
        if (!this.clickBlocked && this.roleId) {
            this.business.buy(this.index);
        }
    }

    protected btnRoleInfo() {
        if (!this.clickBlocked && this.roleId) {
            smc.game.shop.getBusiness<ShopAudioBll>(ShopAudioBll).play(ShopSound.Click);
            const role = TableRole.getConfigById<TableRole>(this.roleId);
            const content = TableShopContent.getRole(this.roleId);
            const classes = role
                .getClasses()
                .map((item) => {
                    return item.name;
                })
                .join("、");
            const effect = UICommon.toText(content.effectDescription);
            const text = `<color=${content.color}>${role.name}</color>[fg] · 价格：[yellow]${role.price}[fg] 金币\n职业：${classes}\n\n${content.getDescription(1)}\n\n[light_bg]三级效果 · ${content.effectName}\n${effect}`;
            TooltipPanelView.show({ text });
        }
    }
}
