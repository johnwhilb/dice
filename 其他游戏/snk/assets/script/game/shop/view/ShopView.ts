import {
    _decorator,
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
import { ShopEvent } from "../ShopEvent";
import type { IShopSaleEffectOrigin } from "../ShopEvent";
import { TooltipPanelView } from "./TooltipPanelView";
import { TableShopRule } from "../../common/table/TableShopRule";
import { TableShopLevel } from "../../common/table/TableShopLevel";
import { TableRole } from "../../common/table/TableRole";
import { ColorConst } from "../../common/config/ColorConst";
import List from "../../ui/List";
import type { IShopClassProgress } from "../model/ShopModel";
import { ShopCardItem } from "./ShopCardItem";
import { ShopTeamRole } from "./ShopTeamRole";
import { ShopOfferEffect } from "../../effect/view/ShopOfferEffect";
import { ShopClassItem } from "./ShopClassItem";
import { ShopPassiveItem } from "./ShopPassiveItem";
import { UICommon } from "../../ui/UICommon";

const { ccclass, property } = _decorator;
const classFadeDuration = 0.3;

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
    private dragStartPoint: Vec2 = new Vec2();
    private classProgress: IShopClassProgress[] = [];
    private classFocus?: IShopClassFocus;
    private teamList: List;
    private offerEffect: ShopOfferEffect;
    private classList: List;
    private passiveList: List;
    private readonly preventContextMenu: (event: Event) => void = (event: Event) => {
        event.preventDefault();
    };

    get model() {
        return this.ent.ShopModel;
    }

    get business() {
        return this.ent.getBusiness<ShopBll>(ShopBll);
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
        this.on(ShopEvent.UpdateShopContent, this.refresh, this);
        this.on(ShopEvent.ShowOfferRemoval, this.showOfferRemoval, this);
        this.on(ShopEvent.ShowRoleSaleEffect, this.showRoleSaleEffect, this);
        this.on(ShopEvent.UpdateTeamOrder, this.refreshTeamOrder, this);
        this.on(ShopEvent.StartTeamDrag, this.startDrag, this);
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
        this.getNode("guidePanel").active = false;
        this.refresh();
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
        this.getNode("lbtShopTitle").getComponent(RichText).string = UICommon.toText(
            `[fg]商店 · 金币：[yellow]${model.gold}`,
            true
        );
        this.getNode("lbtTeamTitle").getComponent(Label).string =
            `队伍 ${model.team.length}/${this.business.getTeamCapacity()}`;
        this.getNode("lbtRefresh").getComponent(Label).string = `刷新：${rule.refreshCost}`;
        this.getNode("lbtLock").getComponent(Label).string = model.locked ? "解锁" : "锁定";
        this.getNode("btnLock").getComponent(UITransform).width = model.locked ? 122 : 89;
        this.getNode("lbtShopLevel").getComponent(Label).string = `${model.shopLevel}`;
        this.getNode("lbtRound").getComponent(Label).string =
            `第${model.battleLevel}关${model.battleLevel % 25 === 0 || (model.battleLevel - 25 * model.loop) % 6 === 0 ? "（精英）" : (model.battleLevel - 25 * model.loop) % 3 === 0 ? "（困难）" : ""}`;
        this.getNode("lbtNewGamePlus").getComponent(Label).string = `周目加成 ${model.newGamePlus}`;
        this.getNode("lbtNewGamePlus").active = model.newGamePlus > 0;
        this.classProgress = this.business.getClassProgress();
        const columns = this.classProgress.length <= 6 ? 2 : 3;
        // 按原版职业数量切换两列或三列，列表单元格位置由 List 计算。
        this.getNode("classList").setPosition(columns === 2 ? 247 : 245, 300, 0);
        this.getNode("classList").getComponent(UITransform).width = columns * 56;
        this.getNode("classViewport").getComponent(UITransform).width = columns * 56;
        this.classList.content.getComponent(UITransform).width = columns * 56;
        this.classList.setGridColumns(columns);
        this.refreshCards();
        this.refreshTeamList();
        this.classList.numItems = this.classProgress.length;
        this.passiveList.numItems = model.items.length;
        const required = TableShopLevel.getConfigByLevel(model.shopLevel).xpToNextLevel;
        this.updateShopXpMarks(required);
        for (const name of ["btnLockBackground", "btnLockShadow"]) {
            this.getNode(name).getComponent(UITransform).width = model.locked ? 122 : 89;
        }
        this.getNode("btnLockBackground").getComponent(Sprite).color = model.locked
            ? ColorConst.shopText
            : ColorConst.shopButton;
        this.getNode("lbtLock").getComponent(Label).color = model.locked ? ColorConst.shopMuted : ColorConst.shopTick;
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
            node.getComponent(Sprite).color = index < this.model.shopXp ? ColorConst.shopText : ColorConst.shopButton;
        }
        box.getComponent(Layout).updateLayout();
    }

    private startDrag(event: string, index: number, point: Vec2, touchId: number | null) {
        const unit = this.model.team[index];
        if (this.blocked || !unit) {
            return;
        }
        this.pendingDragIndex = index;
        this.dragStartPoint.set(point);
        const classIds = TableRole.getConfigById<TableRole>(unit.roleId).getClasses().map((roleClass) => {
            return roleClass.id;
        });
        this.classFocus = { classIds: new Set(classIds), touchId, opacity: 1, released: false };
        this.updateClassHighlights();
    }

    update(dt: number) {
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

    private updateClassHighlights() {
        const focus = this.classFocus;
        this.classList.content.children.forEach((node) => {
            node.getComponent(ShopClassItem).setHighlight(focus?.classIds, focus?.opacity ?? 0);
        });
    }

    private moveGrabbed(event: EventTouch) {
        const point = event.getUILocation();
        if (this.pendingDragIndex >= 0 && Vec2.distance(point, this.dragStartPoint) >= 6) {
            this.model.grabbedIndex = this.pendingDragIndex;
            this.pendingDragIndex = -1;
            this.teamList.scrollView.stopAutoScroll();
            this.teamList.scrollView.enabled = false;
            this.teamList.updateAll();
        }
        if (this.model.grabbedIndex >= 0) {
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
            this.pendingDragIndex = -1;
            if (this.classFocus?.touchId === 0) {
                this.classFocus = undefined;
                this.updateClassHighlights();
            }
        }
    }

    private moveDrag(point: Vec2) {
        const content = this.teamList.content.getComponent(UITransform);
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
        const ghost = this.getNode("dragGhostBox");
        ghost.setPosition(this.getNode("content").getComponent(UITransform).convertToNodeSpaceAR(world));
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
    }

    private releaseGrabbed() {
        this.model.rightButtonDown = false;
        this.pendingDragIndex = -1;
        if (this.model.grabbedIndex >= 0) {
            this.model.grabbedIndex = -1;
            this.teamList.scrollView.enabled = true;
            this.getNode("dragGhostBox").active = false;
            this.refresh();
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
        this.pendingDragIndex = -1;
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
        this.off(ShopEvent.ShowRoleSaleEffect, this.showRoleSaleEffect, this);
        this.off(ShopEvent.StartTeamDrag, this.startDrag, this);
        input.off(Input.EventType.MOUSE_UP, this.releaseGrabbed, this);
        input.off(Input.EventType.TOUCH_MOVE, this.moveGrabbed, this);
        input.off(Input.EventType.TOUCH_END, this.releaseTeamTouch, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.releaseTeamTouch, this);
        game.canvas.removeEventListener("contextmenu", this.preventContextMenu);
        super.onDestroy();
    }

    reset() {
        this.pendingDragIndex = -1;
        this.classFocus = undefined;
    }

    btnRefresh() {
        if (!this.clickBlocked) {
            this.business.refreshOffers();
        }
    }

    btnLock() {
        if (!this.clickBlocked) {
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
            const text = `[yellow]${model.shopLevel}[fg]级商店，经验 [yellow]${model.shopXp}/${level.xpToNextLevel}[fg]，每点经验 [yellow]${rule.xpPurchaseCost}[fg] 金币\n\n[fg]各阶角色的招募概率\n当前等级 → 下一等级\n${weights
                .map((weight, index) => {
                    return `${index + 1}阶：${weight}% → ${next ? `${next.getTierWeights()[index]}%` : "已满级"}`;
                })
                .join("\n")}\n\n[light_bg]右键降低一级（花费${rule.downgradeCost}金币，经验清零）`;
            TooltipPanelView.show({ text });
        }
    }

    btnBattle() {
        if (!this.clickBlocked) {
            this.ent.game.openBattle(this.getNode("btnBattle").worldPosition.clone());
        }
    }

    btnGuide() {
        if (!this.clickBlocked) {
            this.model.guideOpen = true;
            this.getNode("guidePanel").active = true;
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
            this.business.saveRun();
            this.ent.game.returnMenu();
        }
    }

    btnCloseGuide() {
        if (this.model.rightButtonDown) {
            return;
        }
        this.model.guideOpen = false;
        this.getNode("guidePanel").active = false;
    }
}
