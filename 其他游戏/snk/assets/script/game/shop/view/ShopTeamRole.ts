import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { IShopRoleData } from "../ShopEvent";
import { ShopRoleKind } from "../ShopEvent";
import { _decorator, Prefab, Node, instantiate, Label, Layout, Sprite } from "cc";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { ShopTeamRoleItem } from "./ShopTeamRoleItem";
import { TableRole } from "../../common/table/TableRole";

const { ccclass, property } = _decorator;

@ccclass("ShopTeamRole")
export class ShopTeamRole extends GameComponent {
    @property(Prefab)
    private rolePrefab: Prefab;

    private get business() {
        return smc.game.shop.getBusiness<ShopBll>(ShopBll);
    }

    setData(index: number, unit: IPlayerUnit, preview: boolean = false) {
        const visible = preview || index !== smc.game.shop.ShopModel.grabbedIndex;
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
