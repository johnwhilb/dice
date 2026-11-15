import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { oops } from "db://oops-framework/core/Oops";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { TableRoleClass } from "../../common/table/TableRoleClass";
import { _decorator, Color, Label, Prefab, instantiate, Layout } from "cc";
import { TableRole } from "../../common/table/TableRole";
import { TableShopContent } from "../../common/table/TableShopContent";
import { TableShopRule } from "../../common/table/TableShopRule";
import { ShopClassItem } from "./ShopClassItem";
import { UICommon } from "../../ui/UICommon";
import { ShopRoleItem } from "./ShopRoleItem";
import { ShopRoleKind } from "../ShopEvent";

const { ccclass, property } = _decorator;

@ccclass("ShopCardItem")
export class ShopCardItem extends GameComponent {
    @property(Prefab)
    private classPrefab: Prefab;
    @property(Prefab)
    private markPrefab: Prefab;
    private index: number = 0;
    private roleId: number = 0;

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

    setData(index: number, roleId: number) {
        this.index = index;
        this.roleId = roleId;
        const name = this.getNode("lbtName").getComponent(Label);
        const role = TableRole.getConfigById<TableRole>(roleId);
        const content = TableShopContent.getRole(roleId);
        name.string = role.name;
        name.color = new Color(content.color);
        this.getNode("ShopRoleItem")
            .getComponent(ShopRoleItem)
            .setData({ roleId, index, level: 1, kind: ShopRoleKind.Offer });
        const owned = smc.game.shop.ShopModel.team.find((item) => {
            return item.roleId === roleId;
        });
        this.updateClasses(role.getClasses());
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

    private updateClasses(items?: TableRoleClass[]) {
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
                    buyIndex: this.index,
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
            oops.gui.open(TooltipPanelView, { data: text });
        }
    }
}
