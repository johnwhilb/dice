import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { IShopRoleData } from "../ShopEvent";
import { ShopEvent, ShopRoleKind } from "../ShopEvent";
import { _decorator, Prefab, Node, EventTouch, instantiate, Label, Layout, Sprite } from "cc";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { ShopTeamRoleItem } from "./ShopTeamRoleItem";
import { TableRole } from "../../common/table/TableRole";

const { ccclass, property } = _decorator;

@ccclass("ShopTeamRole")
export class ShopTeamRole extends GameComponent {
    @property(Prefab)
    private rolePrefab: Prefab;
    private teamIndex = -1;
    private popLife: number = 0;
    private popStrength: number = 0.14;

    private get business() {
        return smc.game.shop.getBusiness<ShopBll>(ShopBll);
    }

    start() {
        this.node.on(Node.EventType.TOUCH_START, this.startRowTouch, this, true);
    }

    private startRowTouch(event: EventTouch) {
        if (this.teamIndex >= 0 && event.target.name !== "btnRole") {
            this.dispatchEvent(ShopEvent.StartTeamDrag, this.teamIndex, event.getUILocation(), event.getID());
        }
    }

    playPop(strength: number = 0.14) {
        this.popStrength = strength;
        this.popLife = 0.24;
    }

    update(deltaTime: number) {
        if (this.popLife > 0) {
            this.popLife = Math.max(0, this.popLife - deltaTime);
            const t = this.popLife / 0.24;
            const scale = 1 + this.popStrength * Math.sin(t * Math.PI);
            this.node.setScale(scale, scale, 1);
            if (this.popLife === 0) {
                this.node.setScale(1, 1, 1);
            }
        }
    }

    setData(index: number, unit: IPlayerUnit, preview: boolean = false) {
        const visible = preview || index !== smc.game.shop.ShopModel.grabbedIndex;
        this.teamIndex = visible && !preview ? index : -1;
        this.getComponent(Sprite).enabled = visible;
        this.getNode("lbtName").getComponent(Label).string = TableRole.getConfigById<TableRole>(unit.roleId).name;
        const top: IShopRoleData[] = [
            { roleId: unit.roleId, level: unit.level, index, kind: preview ? ShopRoleKind.Preview : ShopRoleKind.Team },
        ];
        const reserves = this.business.getReserves(index);
        const lower: IShopRoleData[] = [];
        for (const level of [2, 1]) {
            const count = level === 2 ? reserves.level2 : reserves.level1;
            const row = level === unit.level ? top : lower;
            for (let copy = 0; copy < count; copy++) {
                row.push({ roleId: unit.roleId, level, index, kind: preview ? ShopRoleKind.Preview : ShopRoleKind.Reserve });
            }
        }
        const roleBox = this.getNode("roleBox");
        roleBox.active = true;
        this.setRwdContent(roleBox, top, 1);
        const reserveBox = this.getNode("reserveBox");
        reserveBox.active = lower.length > 0;
        this.setRwdContent(reserveBox, lower);
        const layout = this.getComponent(Layout);
        layout.enabled = true;
        layout.updateLayout(true);
        if (!visible) {
            layout.enabled = false;
            roleBox.active = false;
            reserveBox.active = false;
        }
    }

    measure(index: number, level: number) {
        const reserves = this.business.getReserves(index);
        this.getNode("roleBox").active = true;
        this.getNode("reserveBox").active = (level > 1 && reserves.level1 > 0) || (level > 2 && reserves.level2 > 0);
        this.getComponent(Layout).updateLayout(true);
    }

    private setRwdContent(box: Node, items: IShopRoleData[], offset: number = 0) {
        const length = Math.max(box.children.length - offset, items.length);
        for (let index = 0; index < length; index++) {
            const data = items[index];
            if (data && index + offset >= box.children.length) {
                const child = instantiate(this.rolePrefab);
                child.parent = box;
            }
            const node = box.children[index + offset];
            node.active = !!data;
            if (data) {
                node.getComponent(ShopTeamRoleItem).setData(data);
            }
        }
        box.getComponent(Layout).updateLayout();
    }
}
