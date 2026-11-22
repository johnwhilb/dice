import { smc } from "../../common/SingletonModuleComp";
import { oops } from "db://oops-framework/core/Oops";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { _decorator, Color, Layout, Node, Sprite, instantiate } from "cc";
import { TableRoleClass } from "../../common/table/TableRoleClass";
import { TableShopContent } from "../../common/table/TableShopContent";
import { ColorConst } from "../../common/config/ColorConst";
import { ResPath } from "../../common/config/ResPath";

export interface IShopClassData {
    classId: number;
    count: number;
    previewNext?: boolean;
}

interface IClassPreview {
    mark: Sprite;
    color: Color;
    lit: boolean;
}

const { ccclass } = _decorator;

@ccclass("ShopClassItem")
export class ShopClassItem extends GameComponent {
    private data: IShopClassData;
    private preview?: IClassPreview;

    private get blocked() {
        const model = smc.game.shop.ShopModel;
        return model.guideOpen || model.grabbedIndex >= 0 || smc.game.GameModel.transitioning;
    }

    private get clickBlocked() {
        return this.blocked || smc.game.shop.ShopModel.rightButtonDown;
    }

    setData(data: IShopClassData) {
        if (this.preview) {
            this.unschedule(this.togglePreview);
            this.preview.mark.color = ColorConst.shopTick;
            this.preview = undefined;
        }
        this.data = data;
        const content = TableShopContent.getRoleClass(data.classId);
        const thresholds = TableRoleClass.getConfigById<TableRoleClass>(data.classId).getActivationCounts();
        const color = new Color(content.color);
        const active = data.count >= thresholds[0];
        this.getNode("background").getComponent(Sprite).color = active ? color : ColorConst.shopPanel;
        const icon = this.getNode("icon");
        this.setSprite(icon, ResPath.getClassSpriteItemIcon(content.id), "bundle");
        icon.getComponent(Sprite).color = active ? ColorConst.getShopDarkAccentColor(color) : ColorConst.shopTick;
        this.updateProgressMarks(thresholds, data.count, color);
        if (this.preview) {
            this.schedule(this.togglePreview, 0.5);
        }
    }

    private updateProgressMarks(thresholds: number[], count: number, color: Color) {
        const box = this.getNode("tickBox");
        const length = Math.max(box.children.length, thresholds.length);
        let previousCount = 0;
        for (let index = 0; index < length; index++) {
            if (index < thresholds.length && index >= box.children.length) {
                const child = instantiate(box.children[0]);
                child.parent = box;
            }
            const column = box.children[index];
            column.active = index < thresholds.length;
            if (index < thresholds.length) {
                this.updateColumnMarks(column, thresholds[index] - previousCount, count - previousCount, color);
                previousCount = thresholds[index];
            }
        }
        box.getComponent(Layout).updateLayout();
    }

    private updateColumnMarks(column: Node, maximum: number, count: number, color: Color) {
        const length = Math.max(column.children.length, maximum);
        for (let index = 0; index < length; index++) {
            if (index < maximum && index >= column.children.length) {
                const child = instantiate(column.children[0]);
                child.parent = column;
            }
            const mark = column.children[index];
            mark.active = index < maximum;
            const sprite = mark.getComponent(Sprite);
            sprite.color = index < count ? color : ColorConst.shopTick;
            if (this.data.previewNext && index === count && mark.active) {
                this.preview = { mark: sprite, color, lit: false };
            }
        }
        column.getComponent(Layout).updateLayout();
    }

    private togglePreview() {
        if (this.preview) {
            this.preview.lit = !this.preview.lit;
            this.preview.mark.color = this.preview.lit ? this.preview.color : ColorConst.shopTick;
        }
    }

    protected btnClass() {
        if (!this.clickBlocked) {
            const content = TableShopContent.getRoleClass(this.data.classId);
            const roleClass = TableRoleClass.getConfigById<TableRoleClass>(this.data.classId);
            const text = `<color=${content.color}>${roleClass.name}</color>[fg]（${this.data.count}人）\n\n${content.description1}`;
            oops.gui.open(TooltipPanelView, { data: text });
        }
    }
}
