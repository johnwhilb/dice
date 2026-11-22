import { smc } from "../../common/SingletonModuleComp";
import { ShopEvent, ShopRoleKind } from "../ShopEvent";
import type { IShopRoleData } from "../ShopEvent";
import { oops } from "db://oops-framework/core/Oops";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ShopBll } from "../bll/ShopBll";
import { _decorator, Color, Button, EventMouse, EventTouch, Label, Node, Sprite, UITransform } from "cc";
import { TableRole } from "../../common/table/TableRole";
import { TableShopContent } from "../../common/table/TableShopContent";
import { ColorConst } from "../../common/config/ColorConst";
import { UICommon } from "../../ui/UICommon";

const { ccclass } = _decorator;

@ccclass("ShopRoleItem")
export class ShopRoleItem extends GameComponent {
    private data: IShopRoleData;

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
        // 原版右键出售由 ShopBll 处理；鼠标按下由 Cocos 转为触摸，统一记录排序起点。
        this.getNode("btnRole").on(Node.EventType.MOUSE_UP, this.sellRole, this);
        this.getNode("btnRole").on(Node.EventType.TOUCH_START, this.prepareTouchDrag, this);
    }

    setData(data: IShopRoleData, width?: number) {
        if (!this.nodes) {
            this.nodeTreeInfoLite();
        }
        this.data = data;
        const content = TableShopContent.getRole(data.roleId);
        const preview = data.kind === ShopRoleKind.Preview;
        if (width) {
            this.node.getComponent(UITransform).width = width;
            for (const name of ["btnRole", "background", "shadow"]) {
                this.getNode(name).getComponent(UITransform).width = width;
            }
        }
        this.getNode("btnRole").getComponent(Button).interactable = !preview;
        const backgroundColor = preview ? ColorConst.shopTick : new Color(content.color);
        this.getNode("background").getComponent(Sprite).color = backgroundColor;
        const label = this.getNode("lbtValue").getComponent(Label);
        label.color = data.kind === ShopRoleKind.Offer ? ColorConst.shopText : ColorConst.getShopDarkAccentColor(backgroundColor);
        label.string = `${data.kind === ShopRoleKind.Offer ? TableRole.getConfigById<TableRole>(data.roleId).price : data.level}`;
    }

    private sellRole(event: EventMouse) {
        if (event.getButton() !== EventMouse.BUTTON_RIGHT || this.blocked) {
            return;
        }
        event.propagationStopped = true;
        if (this.data.kind === ShopRoleKind.Team) {
            this.business.sell(this.data.index);
        } else if (this.data.kind === ShopRoleKind.Reserve) {
            this.business.sellReserve(this.data.index, this.data.level);
        }
    }

    private prepareTouchDrag(event: EventTouch) {
        if (this.data.kind === ShopRoleKind.Team) {
            this.dispatchEvent(ShopEvent.StartTeamDrag, this.data.index, event.getUILocation());
        }
    }

    btnRole() {
        if (this.clickBlocked || this.data.kind === ShopRoleKind.Preview) {
            return;
        }
        const data = this.data;
        const role = TableRole.getConfigById<TableRole>(data.roleId);
        const content = TableShopContent.getRole(data.roleId);
        const price =
            data.kind === ShopRoleKind.Team
                ? this.business.getSalePrice(data.index)
                : role.price * (data.level === 2 ? 2 : 1);
        const classes = role
            .getClasses()
            .map((item) => {
                return item.name;
            })
            .join("、");
        const effect =
            data.level === 3 ? content.effectDescription : UICommon.toText(content.effectDescription);
        const text = `<color=${content.color}>${role.name}</color>[fg] · 等级 [yellow]${data.level}[fg]，阶级 [yellow]${role.tier}[fg]，售价 [yellow]${price}[fg] 金币\n职业：${classes}\n\n${content.getDescription(data.level)}\n\n[${data.level === 3 ? "yellow" : "light_bg"}]三级效果 · ${content.effectName}\n${data.level === 3 ? "[fg]" : "[light_bg]"}${effect}`;
        oops.gui.open(TooltipPanelView, { data: text });
    }
}
