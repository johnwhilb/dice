import {
    _decorator,
    Color,
    instantiate,
    EventMouse,
    EventTouch,
    game,
    Input,
    input,
    Label,
    Layout,
    Node,
    RichText,
    Sprite,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    Prefab,
} from "cc";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import type { Shop } from "../Shop";
import { ShopBll } from "../bll/ShopBll";
import { ShopAudioBll } from "../bll/ShopAudioBll";
import { ShopDeniedReason, ShopEvent, ShopSound } from "../ShopEvent";
import type { IShopItemUpgrade, IShopLevelChange, IShopSaleEffectOrigin, IShopUnitBought } from "../ShopEvent";
import { TooltipPanelView } from "./TooltipPanelView";
import { TableShopRule } from "../../common/table/TableShopRule";
import { TableShopLevel } from "../../common/table/TableShopLevel";
import { TableRole } from "../../common/table/TableRole";
import { TableRoleClass } from "../../common/table/TableRoleClass";
import { TableShopContent } from "../../common/table/TableShopContent";
import { ColorConst } from "../../common/config/ColorConst";
import List from "../../ui/List";
import type { IShopClassProgress } from "../model/ShopModel";
import { ShopCardItem } from "./ShopCardItem";
import { ShopTeamRole } from "./ShopTeamRole";
import { ShopOfferEffect } from "../../effect/view/ShopOfferEffect";
import { ShopClassItem } from "./ShopClassItem";
import { ShopPassiveItem } from "./ShopPassiveItem";
import { UICommon } from "../../ui/UICommon";
import { lang } from "../../common/Language";

const { ccclass, property } = _decorator;
const classFadeDuration = 0.3;
const dragHoldDuration = 0.3;
const dragCancelDistance = 12;
const dragEdgeScrollZone = 90;
const dragEdgeScrollMinSpeed = 95;
const dragEdgeScrollMaxSpeed = 240;

interface IShopClassFocus {
    classIds: ReadonlySet<number>;
    touchId: number | null;
    opacity: number;
    released: boolean;
}

@ccclass("ShopView")
@ecs.register("ShopView", false)
@gui.register("ShopView", { layer: LayerType.UI, prefab: "gui/shop/ui/ShopView" })
export class ShopView extends CCView<Shop> {
    @property(Prefab)
    private cardPrefab: Prefab;
    @property(Prefab)
    private teamPrefab: Prefab;

    private pendingDragIndex: number = -1;
    private pendingDragElapsed: number = 0;
    private pendingDragTouchId: number | null = null;
    private dragStartPoint: Vec2 = new Vec2();
    private dragCurrentPoint: Vec2 = new Vec2();
    private classProgress: IShopClassProgress[] = [];
    private activeSynergyLevels: Map<number, number> = new Map<number, number>();
    private synergyInitialized: boolean = false;
    private classFocus?: IShopClassFocus;
    private teamList: List;
    private offerEffect: ShopOfferEffect;
    private classList: List;
    private passiveList: List;
    private goldTitleBasePos: Vec3 = new Vec3();
    private teamTitleBasePos: Vec3 = new Vec3();
    private goldPopLife: number = 0;
    private goldShakeLife: number = 0;
    private teamShakeLife: number = 0;
    private shopLevelPopLife: number = 0;
    private refreshPopLife: number = 0;
    private lockPopLife: number = 0;
    private battlePulseElapsed: number = 0;
    private guideProgress: number = 0;
    private guideOpening: boolean = false;
    private guideOpacity?: UIOpacity;
    private readonly preventContextMenu: (event: Event) => void = (event: Event) => {
        event.preventDefault();
    };

    get model() {
        return this.ent.ShopModel;
    }

    get business() {
        return this.ent.getBusiness<ShopBll>(ShopBll);
    }

    get audio() {
        return this.ent.getBusiness<ShopAudioBll>(ShopAudioBll);
    }

    get blocked() {
        return this.model.guideOpen || this.ent.game.GameModel.transitioning || this.model.grabbedIndex >= 0;
    }

    get clickBlocked() {
        return this.blocked || this.model.rightButtonDown;
    }

    start() {
        const effects = new Node("shopOfferEffects");
        effects.layer = this.node.layer;
        effects.parent = this.node;
        effects.addComponent(UITransform);
        this.offerEffect = effects.addComponent(ShopOfferEffect);

        this.goldTitleBasePos.set(this.getNode("lbtShopTitle").position);
        this.teamTitleBasePos.set(this.getNode("lbtTeamTitle").position);

        this.on(ShopEvent.UpdateShopContent, this.refresh, this);
        this.on(ShopEvent.ShowOfferRemoval, this.showOfferRemoval, this);
        this.on(ShopEvent.ShowRoleSaleEffect, this.showRoleSaleEffect, this);
        this.on(ShopEvent.UpdateTeamOrder, this.refreshTeamOrder, this);
        this.on(ShopEvent.StartTeamDrag, this.startDrag, this);
        this.on(ShopEvent.GoldChanged, this.onGoldChanged, this);
        this.on(ShopEvent.UnitBought, this.onUnitBought, this);
        this.on(ShopEvent.OffersRefreshed, this.onOffersRefreshed, this);
        this.on(ShopEvent.ShopLevelChanged, this.onShopLevelChanged, this);
        this.on(ShopEvent.ItemUpgraded, this.onItemUpgraded, this);
        this.on(ShopEvent.ActionDenied, this.onActionDenied, this);
        this.on(ShopEvent.HighlightClasses, this.onHighlightClasses, this);

        this.teamList = this.getNode("teamList").getComponent(List);
        this.classList = this.getNode("classList").getComponent(List);
        this.passiveList = this.getNode("passiveList").getComponent(List);
        // 原版右键降低商店等级，扣费与等级校验由 ShopBll.downgradeShop 处理。
        this.getNode("btnShopLevel").on(Node.EventType.MOUSE_UP, this.downgradeShop, this);
        // Cocos 会将右键也模拟为触摸，记录按键以防自动绑定误执行左键购买。
        this.node.on(Node.EventType.MOUSE_DOWN, this.trackMouseButton, this, true);
        // 队员排序需要持续接收移动和松开事件；捕获 UI 事件避免拖动中途被按钮吞掉。
        input.on(Input.EventType.MOUSE_UP, this.releaseGrabbed, this);
        input.on(Input.EventType.TOUCH_MOVE, this.moveGrabbed, this);
        input.on(Input.EventType.TOUCH_END, this.releaseTeamTouch, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.releaseTeamTouch, this);
        this.node.on(Node.EventType.MOUSE_UP, this.finishDrag, this, true);
        this.node.on(Node.EventType.TOUCH_MOVE, this.moveGrabbed, this, true);
        this.node.on(Node.EventType.TOUCH_END, this.finishDrag, this, true);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.finishDrag, this, true);
        // 屏蔽浏览器菜单，保留商店原版右键降级操作。
        game.canvas.addEventListener("contextmenu", this.preventContextMenu);
        this.model.guideOpen = false;
        const guidePanel = this.getNode("guidePanel");
        this.guideOpacity = guidePanel.getComponent(UIOpacity) ?? guidePanel.addComponent(UIOpacity);
        guidePanel.active = false;
        this.synergyInitialized = false;
        this.activeSynergyLevels.clear();
        this.refresh();
        this.playCardsAppear();
    }

    updateTeamItem(node: Node, index: number, isCalculateSize?: boolean) {
        if (isCalculateSize) {
            // 由条目自身的 Layout 测量每个角色分组的高度。
            return node.getComponent(ShopTeamRole).measure(index, this.model.team[index].level);
        }
        node.getComponent(ShopTeamRole).setData(index, this.model.team[index]);
    }

    updateClassItem(node: Node, index: number) {
        const item = node.getComponent(ShopClassItem);
        const focus = this.classFocus;
        item.setData(this.classProgress[index]);
        item.setHighlight(focus?.classIds, focus?.opacity ?? 0);
    }

    updatePassiveItem(node: Node, index: number) {
        node.getComponent(ShopPassiveItem).setData(index, this.model.items[index]);
    }

    refresh() {
        const model = this.model;
        const rule = TableShopRule.getInitial();
        const interest = this.business.getInterest();
        const interestText = interest > 0 ? ` [green]+${interest}息` : "";
        this.getNode("lbtShopTitle").getComponent(RichText).string = UICommon.toText(
            `[fg]商店 · 金币：[yellow]${model.gold}${interestText}`,
            true
        );
        this.getNode("lbtTeamTitle").getComponent(Label).string =
            `队伍 ${model.team.length}/${this.business.getTeamCapacity()}`;
        this.getNode("lbtRefresh").getComponent(Label).string = `刷新：${rule.refreshCost}`;
        this.getNode("lbtRefresh").getComponent(Label).color =
            model.gold >= rule.refreshCost ? ColorConst.WHITE : ColorConst.shopMuted;
        this.getNode("lbtLock").getComponent(Label).string = model.locked ? "解锁" : "锁定";
        this.getNode("btnLock").getComponent(UITransform).width = model.locked ? 122 : 89;

        const levelConfig = TableShopLevel.getConfigByLevel(model.shopLevel);
        const canLevelShop = !!levelConfig.getNextLevel();
        const levelLabel = this.getNode("lbtShopLevel").getComponent(Label);
        levelLabel.string = `${model.shopLevel}`;
        levelLabel.color = !canLevelShop
            ? ColorConst.shopMergeButton
            : model.gold >= rule.xpPurchaseCost
              ? ColorConst.WHITE
              : ColorConst.shopMuted;

        this.getNode("lbtRound").getComponent(Label).string =
            `第${model.battleLevel}关${model.battleLevel % 25 === 0 || (model.battleLevel - 25 * model.loop) % 6 === 0 ? "（精英）" : (model.battleLevel - 25 * model.loop) % 3 === 0 ? "（困难）" : ""}`;
        this.getNode("lbtNewGamePlus").getComponent(Label).string = `周目加成 ${model.newGamePlus}`;
        this.getNode("lbtNewGamePlus").active = model.newGamePlus > 0;

        const hasTeam = model.team.length > 0;
        this.getNode("btnBattleBackground").getComponent(Sprite).color = hasTeam
            ? ColorConst.shopGreen
            : ColorConst.shopGreenMuted;
        this.getNode("txtBattle").getComponent(Label).color = hasTeam
            ? ColorConst.shopBattleTextActive
            : ColorConst.shopBattleTextMuted;

        this.classProgress = this.business.getClassProgress();
        const columns = this.classProgress.length <= 6 ? 2 : 3;
        // 按原版职业数量切换两列或三列，列表单元格位置由 List 计算。
        this.getNode("classList").getComponent(UITransform).width = columns * 56;
        this.getNode("classViewport").getComponent(UITransform).width = columns * 56;
        this.classList.content.getComponent(UITransform).width = columns * 56;
        this.classList.setGridColumns(columns);
        this.refreshCards();
        this.refreshTeamList();
        this.classList.numItems = this.classProgress.length;
        this.passiveList.numItems = model.items.length;
        this.checkSynergyUpgrades();
        const required = levelConfig.xpToNextLevel;
        this.updateShopXpMarks(required);
        for (const name of ["btnLockBackground", "btnLockShadow"]) {
            this.getNode(name).getComponent(UITransform).width = model.locked ? 122 : 89;
        }
        this.getNode("btnLockBackground").getComponent(Sprite).color = model.locked
            ? ColorConst.shopText
            : ColorConst.shopButton;
        this.getNode("lbtLock").getComponent(Label).color = model.locked ? ColorConst.shopMuted : ColorConst.shopTick;
    }

    private checkSynergyUpgrades() {
        const nextLevels = new Map<number, number>();
        const upgradedIndices: number[] = [];
        this.classProgress.forEach((progress, index) => {
            nextLevels.set(progress.classId, progress.activeLevel);
            if (this.synergyInitialized) {
                const previous = this.activeSynergyLevels.get(progress.classId) ?? 0;
                if (progress.activeLevel > previous) {
                    upgradedIndices.push(index);
                }
            }
        });
        this.activeSynergyLevels = nextLevels;
        this.synergyInitialized = true;
        if (!upgradedIndices.length) {
            return;
        }
        for (const index of upgradedIndices) {
            const progress = this.classProgress[index];
            const itemNode = this.classList.getItemByListId(index);
            if (!itemNode) {
                continue;
            }
            const content = TableShopContent.getRoleClass(progress.classId);
            const roleClass = TableRoleClass.getConfigById<TableRoleClass>(progress.classId);
            const color = new Color(content.color);
            itemNode.getComponent(ShopClassItem).playActivatePop();
            this.offerEffect.playCelebrationFromWorld(itemNode.worldPosition, color, progress.activeLevel >= 2);
            this.offerEffect.playFloatingTextFromWorld(
                itemNode.worldPosition,
                `${roleClass.name} 激活!`,
                color,
                progress.activeLevel >= 2
            );
        }
    }

    private playCardsAppear() {
        const box = this.getNode("cardsBox");
        box.children.forEach((card, slot) => {
            if (card.active) {
                card.getComponent(ShopCardItem).playAppear(slot * 0.045);
            }
        });
    }

    private onOffersRefreshed() {
        this.refreshPopLife = 0.22;
        this.playCardsAppear();
    }

    private onGoldChanged(event: string, delta: number) {
        if (!delta) {
            return;
        }
        this.goldPopLife = 0.24;
        const title = this.getNode("lbtShopTitle");
        const origin = title.worldPosition.clone();
        origin.x += 120;
        origin.y -= 10;
        const text = delta > 0 ? `+${delta}G` : `${delta}G`;
        const color = delta > 0 ? ColorConst.shopGoldGain : ColorConst.shopGoldSpend;
        this.offerEffect.playFloatingTextFromWorld(origin, text, color, Math.abs(delta) >= 4);
    }

    private onUnitBought(event: string, data: IShopUnitBought) {
        const role = TableRole.getConfigById<TableRole>(data.roleId);
        const color = ColorConst.getPlayerColor(data.roleId);
        const rowNode = this.teamList.getItemByListId(data.teamIndex);
        if (rowNode) {
            rowNode.getComponent(ShopTeamRole).playPop(data.upgraded ? 0.22 : 0.12);
            if (data.upgraded) {
                const major = data.level >= 3;
                this.offerEffect.playCelebrationFromWorld(rowNode.worldPosition, color, major);
                this.offerEffect.playFloatingTextFromWorld(
                    rowNode.worldPosition,
                    major ? `${role.name} 满级 Lv.3!!` : `${role.name} 升至 Lv.${data.level}!`,
                    major ? ColorConst.shopMergeButton : color,
                    major
                );
            }
        } else if (data.upgraded) {
            const teamTitle = this.getNode("lbtTeamTitle");
            const major = data.level >= 3;
            this.offerEffect.playCelebrationFromWorld(teamTitle.worldPosition, color, major);
            this.offerEffect.playFloatingTextFromWorld(
                teamTitle.worldPosition,
                major ? `${role.name} 满级 Lv.3!!` : `${role.name} 升至 Lv.${data.level}!`,
                major ? ColorConst.shopMergeButton : color,
                major
            );
        }
    }

    private onShopLevelChanged(event: string, data: IShopLevelChange) {
        this.shopLevelPopLife = 0.26;
        const levelNode = this.getNode("btnShopLevel");
        if (data.leveledUp) {
            this.offerEffect.playCelebrationFromWorld(levelNode.worldPosition, ColorConst.shopMergeButton, true);
            this.offerEffect.playFloatingTextFromWorld(
                levelNode.worldPosition,
                `商店 Lv.${data.level}!`,
                ColorConst.shopMergeButton,
                true
            );
        } else if (data.downgraded) {
            this.offerEffect.playFromWorldPosition(levelNode.worldPosition, ColorConst.shopMuted);
            this.offerEffect.playFloatingTextFromWorld(
                levelNode.worldPosition,
                `商店 Lv.${data.level}`,
                ColorConst.shopText,
                false
            );
        } else {
            this.offerEffect.playFloatingTextFromWorld(levelNode.worldPosition, "+1 XP", ColorConst.shopText, false);
        }
    }

    private onItemUpgraded(event: string, data: IShopItemUpgrade) {
        const itemNode = this.passiveList.getItemByListId(data.index);
        if (!itemNode) {
            return;
        }
        itemNode.getComponent(ShopPassiveItem).playPulse();
        if (data.leveledUp) {
            const major = data.level >= 3;
            this.offerEffect.playCelebrationFromWorld(itemNode.worldPosition, ColorConst.shopMergeButton, major);
            this.offerEffect.playFloatingTextFromWorld(
                itemNode.worldPosition,
                `道具 Lv.${data.level}!`,
                ColorConst.shopMergeButton,
                major
            );
        }
    }

    private onActionDenied(event: string, reason: ShopDeniedReason) {
        if (reason === ShopDeniedReason.GoldMissing) {
            this.goldShakeLife = 0.26;
        } else if (reason === ShopDeniedReason.TeamFull) {
            this.teamShakeLife = 0.26;
        }
    }

    private onHighlightClasses(event: string, classIds: number[], touchId: number | null) {
        if (this.blocked) {
            return;
        }
        this.classFocus = { classIds: new Set(classIds), touchId, opacity: 1, released: false };
        this.updateClassHighlights();
    }

    private refreshCards() {
        const box = this.getNode("cardsBox");
        const offers = this.model.offers;
        const length = Math.max(box.children.length, offers.length);
        for (let index = 0; index < length; index++) {
            if (index < offers.length && index >= box.children.length) {
                const card = instantiate(this.cardPrefab);
                card.parent = box;
            }
            const card = box.children[index];
            card.active = index < offers.length;
            if (card.active) {
                card.getComponent(ShopCardItem).setData(index, this.model.offers[index]);
            }
        }
        box.getComponent(Layout).updateLayout();
    }

    private showOfferRemoval(event: string, index?: number) {
        this.getNode("cardsBox").children.forEach((card, slot) => {
            if (card.active && (index === undefined || slot === index)) {
                const targets = card.getComponent(ShopCardItem).getRemovalEffectTargets();
                for (const target of targets) {
                    this.offerEffect.play(target);
                }
            }
        });
    }

    private showRoleSaleEffect(event: string, origin: IShopSaleEffectOrigin) {
        this.offerEffect.playFromWorldPosition(origin.position, origin.color);
    }

    private updateShopXpMarks(required: number) {
        const box = this.getNode("shopXpBox");
        const length = Math.max(box.children.length, required);
        for (let index = 0; index < length; index++) {
            if (index < required && index >= box.children.length) {
                const child = instantiate(box.children[0]);
                child.parent = box;
            }
            const node = box.children[index];
            node.active = index < required;
            node.getComponent(Sprite).color =
                index < this.model.shopXp ? ColorConst.shopMergeButton : ColorConst.shopButton;
        }
        box.getComponent(Layout).updateLayout();
    }

    private startDrag(event: string, index: number, point: Vec2, touchId: number | null) {
        const unit = this.model.team[index];
        if (this.blocked || !unit) {
            return;
        }
        this.cancelPendingDrag();
        this.pendingDragIndex = index;
        this.pendingDragElapsed = 0;
        this.pendingDragTouchId = touchId;
        this.dragStartPoint.set(point);
        this.dragCurrentPoint.set(point);
        const classIds = TableRole.getConfigById<TableRole>(unit.roleId)
            .getClasses()
            .map((roleClass) => {
                return roleClass.id;
            });
        this.classFocus = { classIds: new Set(classIds), touchId, opacity: 1, released: false };
        this.updateClassHighlights();
    }

    update(dt: number) {
        this.updateClassFade(dt);
        this.updatePendingDrag(dt);
        this.updateDragEdgeScroll(dt);
        this.updateJuiceAnimations(dt);
        this.updateGuidePanelAnimation(dt);
    }

    private cancelPendingDrag() {
        if (this.pendingDragIndex >= 0) {
            const rowNode = this.teamList.getItemByListId(this.pendingDragIndex);
            if (rowNode) {
                rowNode.setScale(1, 1, 1);
            }
        }
        this.pendingDragIndex = -1;
        this.pendingDragElapsed = 0;
        this.pendingDragTouchId = null;
    }

    private updatePendingDrag(dt: number) {
        if (this.pendingDragIndex < 0) {
            return;
        }
        if (this.blocked || this.model.rightButtonDown || !this.model.team[this.pendingDragIndex]) {
            this.cancelPendingDrag();
            return;
        }
        this.pendingDragElapsed += dt;
        if (this.pendingDragElapsed >= dragHoldDuration) {
            this.activateDrag(this.pendingDragIndex, this.dragCurrentPoint);
            return;
        }
        if (this.pendingDragElapsed > 0.15) {
            const rowNode = this.teamList.getItemByListId(this.pendingDragIndex);
            if (rowNode) {
                const charge = Math.min(1, (this.pendingDragElapsed - 0.15) / (dragHoldDuration - 0.15));
                const scale = 1 + 0.045 * charge;
                rowNode.setScale(scale, scale, 1);
            }
        }
    }

    private activateDrag(index: number, point: Vec2) {
        const rowNode = this.teamList.getItemByListId(index);
        if (rowNode) {
            rowNode.setScale(1, 1, 1);
        }
        this.pendingDragIndex = -1;
        this.pendingDragElapsed = 0;
        this.model.grabbedIndex = index;
        this.teamList.scrollView.stopAutoScroll();
        this.teamList.scrollView.enabled = false;
        this.teamList.updateAll();
        this.moveDrag(point);
    }

    private updateDragEdgeScroll(dt: number) {
        if (this.model.grabbedIndex < 0) {
            return;
        }
        const scrollView = this.teamList.scrollView;
        const maxOffset = scrollView.getMaxScrollOffset();
        if (maxOffset.y <= 0) {
            return;
        }
        const viewport = this.getNode("teamListViewport").getComponent(UITransform);
        const local = viewport.convertToNodeSpaceAR(new Vec3(this.dragCurrentPoint.x, this.dragCurrentPoint.y, 0));
        const topY = (1 - viewport.anchorY) * viewport.height;
        const bottomY = -viewport.anchorY * viewport.height;
        const distTop = topY - local.y;
        const distBottom = local.y - bottomY;
        const offset = scrollView.getScrollOffset();
        let nextY = offset.y;
        if (distTop < dragEdgeScrollZone && offset.y > 0) {
            const ratio = Math.max(0, Math.min(1, 1 - distTop / dragEdgeScrollZone));
            const speed = dragEdgeScrollMinSpeed + (dragEdgeScrollMaxSpeed - dragEdgeScrollMinSpeed) * ratio;
            nextY = Math.max(0, offset.y - speed * dt);
        } else if (distBottom < dragEdgeScrollZone && offset.y < maxOffset.y) {
            const ratio = Math.max(0, Math.min(1, 1 - distBottom / dragEdgeScrollZone));
            const speed = dragEdgeScrollMinSpeed + (dragEdgeScrollMaxSpeed - dragEdgeScrollMinSpeed) * ratio;
            nextY = Math.min(maxOffset.y, offset.y + speed * dt);
        }
        if (nextY !== offset.y) {
            scrollView.scrollToOffset(new Vec2(offset.x, nextY), 0);
            this.teamList._onScrolling();
            this.moveDrag(this.dragCurrentPoint);
        }
    }

    private updateClassFade(dt: number) {
        const focus = this.classFocus;
        if (!focus?.released) {
            return;
        }
        focus.opacity = Math.max(0, focus.opacity - dt / classFadeDuration);
        if (focus.opacity === 0) {
            this.classFocus = undefined;
        }
        this.updateClassHighlights();
    }

    private updateJuiceAnimations(dt: number) {
        if (this.goldPopLife > 0) {
            this.goldPopLife = Math.max(0, this.goldPopLife - dt);
            const t = this.goldPopLife / 0.24;
            const scale = 1 + 0.14 * Math.sin(t * Math.PI);
            this.getNode("lbtShopTitle").setScale(scale, scale, 1);
        }
        if (this.goldShakeLife > 0) {
            this.goldShakeLife = Math.max(0, this.goldShakeLife - dt);
            const t = this.goldShakeLife / 0.26;
            const offsetX = Math.sin(t * Math.PI * 5) * 9 * t;
            this.getNode("lbtShopTitle").setPosition(this.goldTitleBasePos.x + offsetX, this.goldTitleBasePos.y, 0);
        }
        if (this.teamShakeLife > 0) {
            this.teamShakeLife = Math.max(0, this.teamShakeLife - dt);
            const t = this.teamShakeLife / 0.26;
            const offsetX = Math.sin(t * Math.PI * 5) * 9 * t;
            this.getNode("lbtTeamTitle").setPosition(this.teamTitleBasePos.x + offsetX, this.teamTitleBasePos.y, 0);
        }
        if (this.shopLevelPopLife > 0) {
            this.shopLevelPopLife = Math.max(0, this.shopLevelPopLife - dt);
            const t = this.shopLevelPopLife / 0.26;
            const scale = 1 + 0.22 * Math.sin(t * Math.PI);
            this.getNode("btnShopLevel").setScale(scale, scale, 1);
        }
        if (this.refreshPopLife > 0) {
            this.refreshPopLife = Math.max(0, this.refreshPopLife - dt);
            const t = this.refreshPopLife / 0.22;
            const scale = 1 + 0.1 * Math.sin(t * Math.PI);
            this.getNode("btnRefresh").setScale(scale, scale, 1);
        }
        if (this.lockPopLife > 0) {
            this.lockPopLife = Math.max(0, this.lockPopLife - dt);
            const t = this.lockPopLife / 0.2;
            const scale = 1 + 0.12 * Math.sin(t * Math.PI);
            this.getNode("btnLock").setScale(scale, scale, 1);
        }
        const battleBtn = this.getNode("btnBattle");
        if (this.model.team.length > 0 && !this.blocked) {
            this.battlePulseElapsed += dt;
            const pulse = 1 + 0.032 * (0.5 + 0.5 * Math.sin(this.battlePulseElapsed * 3.8));
            battleBtn.setScale(pulse, pulse, 1);
        } else if (this.battlePulseElapsed > 0) {
            this.battlePulseElapsed = 0;
            battleBtn.setScale(1, 1, 1);
        }
    }

    private updateGuidePanelAnimation(dt: number) {
        const panel = this.getNode("guidePanel");
        if (!panel.active) {
            return;
        }
        const target = this.guideOpening ? 1 : 0;
        if (this.guideProgress === target) {
            return;
        }
        const speed = this.guideOpening ? 1 / 0.18 : 1 / 0.12;
        if (this.guideOpening) {
            this.guideProgress = Math.min(1, this.guideProgress + dt * speed);
        } else {
            this.guideProgress = Math.max(0, this.guideProgress - dt * speed);
        }
        const scale = 0.94 + 0.06 * this.guideProgress;
        panel.setScale(scale, scale, 1);
        if (this.guideOpacity) {
            this.guideOpacity.opacity = Math.round(255 * this.guideProgress);
        }
        if (!this.guideOpening && this.guideProgress === 0) {
            panel.active = false;
        }
    }

    private updateClassHighlights() {
        const focus = this.classFocus;
        this.classList.content.children.forEach((node) => {
            node.getComponent(ShopClassItem).setHighlight(focus?.classIds, focus?.opacity ?? 0);
        });
    }

    private moveGrabbed(event: EventTouch) {
        const point = event.getUILocation();
        if (this.pendingDragIndex >= 0) {
            if (this.pendingDragTouchId !== null && event.getID() !== this.pendingDragTouchId) {
                return;
            }
            this.dragCurrentPoint.set(point);
            if (Vec2.distance(point, this.dragStartPoint) >= dragCancelDistance) {
                this.cancelPendingDrag();
            }
            return;
        }
        if (this.model.grabbedIndex >= 0) {
            this.dragCurrentPoint.set(point);
            this.moveDrag(point);
        }
    }

    private downgradeShop(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_RIGHT && !this.blocked) {
            event.propagationStopped = true;
            this.business.downgradeShop();
        }
    }

    private trackMouseButton(event: EventMouse) {
        this.model.rightButtonDown = event.getButton() === EventMouse.BUTTON_RIGHT;
        if (this.model.rightButtonDown) {
            this.cancelPendingDrag();
            if (this.classFocus?.touchId === 0) {
                this.classFocus = undefined;
                this.updateClassHighlights();
            }
        }
    }

    private moveDrag(point: Vec2) {
        const content = this.teamList.content.getComponent(UITransform);
        const viewport = this.getNode("teamListViewport").getComponent(UITransform);
        const local = content.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        const grabbed = this.model.grabbedIndex;
        const last = this.model.team.length - 1;
        const direction = local.y < this.teamList.getItemPos(grabbed).y ? 1 : -1;
        let target = grabbed;
        for (let index = grabbed + direction; index >= 0 && index <= last; index += direction) {
            if (direction * (this.teamList.getItemPos(index).y - local.y) <= 0) {
                break;
            }
            target = index;
        }
        if (target !== grabbed) {
            this.business.moveUnit(grabbed, target);
        }
        const y = Math.max(this.teamList.getItemPos(last).y, Math.min(this.teamList.getItemPos(0).y, local.y));
        const world = content.convertToWorldSpaceAR(new Vec3(0, y, 0));
        const viewLocal = viewport.convertToNodeSpaceAR(world);
        const minViewY = -viewport.anchorY * viewport.height + 24;
        const maxViewY = (1 - viewport.anchorY) * viewport.height - 24;
        viewLocal.y = Math.max(minViewY, Math.min(maxViewY, viewLocal.y));
        const ghost = this.getNode("dragGhostBox");
        ghost.setPosition(viewLocal);
        ghost.setScale(1.06, 1.06, 1);
        ghost.active = true;
        if (!ghost.children.length) {
            const preview = instantiate(this.teamPrefab);
            preview.parent = ghost;
        }
        ghost.children.forEach((node, index) => {
            node.active = index === 0;
            if (node.active) {
                node.getComponent(ShopTeamRole).setData(
                    this.model.grabbedIndex,
                    this.model.team[this.model.grabbedIndex],
                    true
                );
            }
        });
        ghost.getComponent(Layout).updateLayout();
    }

    private refreshTeamList() {
        const count = this.model.team.length;
        this.teamList.calcCustomSize(count);
        this.teamList.numItems = count;
    }

    private refreshTeamOrder(event: string, from: number, to: number) {
        if (this.model.grabbedIndex === from) {
            this.model.grabbedIndex = to;
        }
        this.refreshTeamList();
        const swappedNode = this.teamList.getItemByListId(from);
        if (swappedNode) {
            swappedNode.getComponent(ShopTeamRole).playPop(0.12);
        }
    }

    private releaseGrabbed() {
        this.model.rightButtonDown = false;
        this.cancelPendingDrag();
        if (this.model.grabbedIndex >= 0) {
            const landedIndex = this.model.grabbedIndex;
            this.model.grabbedIndex = -1;
            this.teamList.scrollView.enabled = true;
            const ghost = this.getNode("dragGhostBox");
            ghost.setScale(1, 1, 1);
            ghost.active = false;
            this.refresh();
            const landedNode = this.teamList.getItemByListId(landedIndex);
            if (landedNode) {
                landedNode.getComponent(ShopTeamRole).playPop(0.14);
            }
        }
    }

    private releaseClassFocus(event: EventTouch) {
        const focus = this.classFocus;
        if (focus && focus.touchId === event.getID()) {
            focus.released = true;
        }
    }

    private releaseTeamTouch(event: EventTouch) {
        this.releaseClassFocus(event);
        this.releaseGrabbed();
    }

    private finishDrag(event: EventMouse | EventTouch) {
        if (event instanceof EventTouch) {
            this.releaseClassFocus(event);
        }
        this.cancelPendingDrag();
        if (this.model.grabbedIndex >= 0) {
            event.propagationStopped = true;
            this.releaseGrabbed();
        }
        if (event instanceof EventMouse) {
            this.model.rightButtonDown = false;
        }
    }

    onDestroy() {
        this.off(ShopEvent.UpdateShopContent, this.refresh, this);
        this.off(ShopEvent.ShowOfferRemoval, this.showOfferRemoval, this);
        this.off(ShopEvent.ShowRoleSaleEffect, this.showRoleSaleEffect, this);
        this.off(ShopEvent.UpdateTeamOrder, this.refreshTeamOrder, this);
        this.off(ShopEvent.StartTeamDrag, this.startDrag, this);
        this.off(ShopEvent.GoldChanged, this.onGoldChanged, this);
        this.off(ShopEvent.UnitBought, this.onUnitBought, this);
        this.off(ShopEvent.OffersRefreshed, this.onOffersRefreshed, this);
        this.off(ShopEvent.ShopLevelChanged, this.onShopLevelChanged, this);
        this.off(ShopEvent.ItemUpgraded, this.onItemUpgraded, this);
        this.off(ShopEvent.ActionDenied, this.onActionDenied, this);
        this.off(ShopEvent.HighlightClasses, this.onHighlightClasses, this);
        input.off(Input.EventType.MOUSE_UP, this.releaseGrabbed, this);
        input.off(Input.EventType.TOUCH_MOVE, this.moveGrabbed, this);
        input.off(Input.EventType.TOUCH_END, this.releaseTeamTouch, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.releaseTeamTouch, this);
        game.canvas.removeEventListener("contextmenu", this.preventContextMenu);
        super.onDestroy();
    }

    reset() {
        this.pendingDragIndex = -1;
        this.pendingDragElapsed = 0;
        this.pendingDragTouchId = null;
        this.classFocus = undefined;
        this.synergyInitialized = false;
        this.activeSynergyLevels.clear();
        this.goldPopLife = 0;
        this.goldShakeLife = 0;
        this.teamShakeLife = 0;
        this.shopLevelPopLife = 0;
        this.refreshPopLife = 0;
        this.lockPopLife = 0;
    }

    btnRefresh() {
        if (!this.clickBlocked) {
            this.business.refreshOffers();
        }
    }

    btnLock() {
        if (!this.clickBlocked) {
            this.lockPopLife = 0.2;
            this.business.toggleLock();
        }
    }

    btnShopLevel() {
        if (!this.clickBlocked) {
            this.business.buyShopXp();
        }
    }

    btnShopInfo() {
        if (!this.clickBlocked) {
            const model = this.model;
            const level = TableShopLevel.getConfigByLevel(model.shopLevel);
            const next = level.getNextLevel();
            const rule = TableShopRule.getInitial();
            const weights = level.getTierWeights();
            const interest = this.business.getInterest();
            const text = `[yellow]${model.shopLevel}[fg]级商店，经验 [yellow]${model.shopXp}/${level.xpToNextLevel}[fg]，每点经验 [yellow]${rule.xpPurchaseCost}[fg] 金币\n当前回合利息：[green]+${interest}[fg] 金币（每满 ${rule.interestGoldStep} 金币得 1 息，上限 ${rule.interestCap}）\n\n[fg]各阶角色的招募概率\n当前等级 → 下一等级\n${weights
                .map((weight, index) => {
                    return `${index + 1}阶：${weight}% → ${next ? `${next.getTierWeights()[index]}%` : "已满级"}`;
                })
                .join("\n")}\n\n[light_bg]右键降低一级（花费${rule.downgradeCost}金币，经验清零）`;
            TooltipPanelView.show({ text });
        }
    }

    btnBattle() {
        if (!this.clickBlocked) {
            if (!this.model.team.length) {
                this.audio.play(ShopSound.Error);
                this.teamShakeLife = 0.26;
                this.ent.game.openBattle(this.getNode("btnBattle").worldPosition.clone());
                return;
            }
            this.audio.play(ShopSound.StartBattle);
            this.ent.game.openBattle(this.getNode("btnBattle").worldPosition.clone());
        }
    }

    btnGuide() {
        if (!this.clickBlocked) {
            this.getNode("txtGuideContent").getComponent(RichText).string = lang("shop_guide_content");
            this.model.guideOpen = true;
            this.guideOpening = true;
            this.guideProgress = 0;
            const panel = this.getNode("guidePanel");
            panel.active = true;
            panel.setScale(0.94, 0.94, 1);
            if (this.guideOpacity) {
                this.guideOpacity.opacity = 0;
            }
        }
    }

    btnRestart() {
        if (!this.clickBlocked) {
            this.teamList.scrollView.scrollToTop(0);
            this.classList.scrollView.scrollToTop(0);
            this.passiveList.scrollView.scrollToTop(0);
            this.ent.game.restartShop();
        }
    }

    btnMenu() {
        if (!this.clickBlocked) {
            this.ent.game.returnMenu();
        }
    }

    btnCloseGuide() {
        if (this.model.rightButtonDown) {
            return;
        }
        this.model.guideOpen = false;
        this.guideOpening = false;
    }
}
