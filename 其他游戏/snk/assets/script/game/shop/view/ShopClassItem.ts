import { smc } from "../../common/SingletonModuleComp";
import { TooltipPanelView } from "./TooltipPanelView";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import { _decorator, Color, Layout, Node, Sprite, Vec4, instantiate } from "cc";
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
    private readonly highlightParams = new Vec4();
    private iconColor = ColorConst.shopTick;
    private readonly litIconColor = new Color();
    private readonly displayIconColor = new Color();
    private popLife: number = 0;

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
        this.getNode("classHighlight").active = false;
        const content = TableShopContent.getRoleClass(data.classId);
        const thresholds = TableRoleClass.getConfigById<TableRoleClass>(data.classId).getActivationCounts();
        const color = new Color(content.color);
        this.highlightParams.set(color.r / 255, color.g / 255, color.b / 255, 0);
        const active = data.count >= thresholds[0];
        this.getNode("background").getComponent(Sprite).color = active ? color : ColorConst.shopPanel;
        const icon = this.getNode("icon");
        this.setSprite(icon, ResPath.getClassSpriteItemIcon(content.id), "bundle");
        this.iconColor = active ? ColorConst.getShopDarkAccentColor(color) : ColorConst.shopTick;
        Color.lerp(this.litIconColor, color, ColorConst.WHITE, 0.78);
        icon.getComponent(Sprite).color = this.iconColor;
        this.updateProgressMarks(thresholds, data.count, color);
        if (this.preview) {
            this.schedule(this.togglePreview, 0.5);
        }
    }

    setHighlight(classIds: ReadonlySet<number> | undefined, opacity: number) {
        const highlight = this.getNode("classHighlight");
        highlight.active = opacity > 0 && !!classIds?.has(this.data.classId);
        const icon = this.getNode("icon").getComponent(Sprite);
        if (highlight.active) {
            Color.lerp(this.displayIconColor, this.iconColor, this.litIconColor, opacity);
            icon.color = this.displayIconColor;
            this.highlightParams.w = opacity;
            highlight.getComponent(Sprite).getMaterialInstance(0).setProperty("focusParams", this.highlightParams);
        } else {
            icon.color = this.iconColor;
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

    playActivatePop() {
        this.popLife = 0.28;
    }

    update(deltaTime: number) {
        if (this.popLife > 0) {
            this.popLife = Math.max(0, this.popLife - deltaTime);
            const t = this.popLife / 0.28;
            const scale = 1 + 0.28 * Math.sin(t * Math.PI) * t;
            this.node.setScale(scale, scale, 1);
            if (this.popLife === 0) {
                this.node.setScale(1, 1, 1);
            }
        }
    }

    protected btnClass() {
        if (!this.clickBlocked) {
            const content = TableShopContent.getRoleClass(this.data.classId);
            const roleClass = TableRoleClass.getConfigById<TableRoleClass>(this.data.classId);
            const text = `<color=${content.color}>${roleClass.name}</color>[fg]（${this.data.count}人）\n\n${content.description1}`;
            TooltipPanelView.show({ text });
        }
    }
}
