import { smc } from "../../common/SingletonModuleComp";
import { ShopEvent, ShopRoleKind, ShopSound, ShopTooltipSaleKind } from "../ShopEvent";
import type { IShopRoleData, IShopTooltipData } from "../ShopEvent";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { ShopBll } from "../bll/ShopBll";
import { ShopAudioBll } from "../bll/ShopAudioBll";
import { _decorator, Color, Button, EventTouch, Label, Node, Sprite, UITransform } from "cc";
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
        this.getNode("btnRole").on(Node.EventType.TOUCH_START, this.prepareTouchDrag, this);
    }

    setData(data: IShopRoleData, width?: number) {
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

    private prepareTouchDrag(event: EventTouch) {
        if (this.data.kind === ShopRoleKind.Team || this.data.kind === ShopRoleKind.Reserve) {
            this.dispatchEvent(ShopEvent.StartTeamDrag, this.data.index, event.getUILocation(), event.getID());
        }
    }

    btnRole() {
        if (this.clickBlocked || this.data.kind === ShopRoleKind.Preview) {
            return;
        }
        smc.game.shop.getBusiness<ShopAudioBll>(ShopAudioBll).play(ShopSound.Click);
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
        const tooltip: IShopTooltipData = { text };
        if (data.kind === ShopRoleKind.Team || data.kind === ShopRoleKind.Reserve) {
            const background = this.getNode("background");
            tooltip.sale = {
                kind: data.kind === ShopRoleKind.Team ? ShopTooltipSaleKind.Team : ShopTooltipSaleKind.Reserve,
                index: data.index,
                level: data.level,
                effectOrigin: {
                    position: background.worldPosition.clone(),
                    color: background.getComponent(Sprite).color.clone(),
                },
            };
        }
        TooltipPanelView.show(tooltip);
    }
}
