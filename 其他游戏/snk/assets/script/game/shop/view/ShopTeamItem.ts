import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { IShopRoleData } from "../ShopEvent";
import { ShopRoleKind } from "../ShopEvent";
import { _decorator, Prefab, Node, instantiate, Label, Layout } from "cc";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { ShopRoleItem } from "./ShopRoleItem";
import { TableRole } from "../../common/table/TableRole";

const { ccclass, property } = _decorator;

@ccclass("ShopTeamItem")
export class ShopTeamItem extends GameComponent {
    @property(Prefab)
    private rolePrefab: Prefab;

    private get business() {
        return smc.game.shop.getBusiness<ShopBll>(ShopBll);
    }

    setData(index: number, unit: IPlayerUnit, preview: boolean = false) {
        const body = this.getNode("teamBody");
        body.active = preview || index !== smc.game.shop.ShopModel.grabbedIndex;
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
        this.setRwdContent(this.getNode("roleBox"), top, 1);
        const reserveBox = this.getNode("reserveBox");
        reserveBox.active = lower.length > 0;
        this.setRwdContent(reserveBox, lower);
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
                node.getComponent(ShopRoleItem).setData(data, 20 + data.level * 20);
            }
        }
        box.getComponent(Layout).updateLayout();
    }
}
