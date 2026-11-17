import { smc } from "../../common/SingletonModuleComp";
import { ShopBll } from "../bll/ShopBll";
import { GameComponent } from "db://oops-framework/module/common/GameComponent";
import type { IShopRoleData } from "../ShopEvent";
import { ShopRoleKind } from "../ShopEvent";
import { _decorator, Prefab, Node, instantiate, Layout } from "cc";
import type { IPlayerUnit } from "../../player/PlayerEvent";
import { ShopRoleItem } from "./ShopRoleItem";

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
        const main: IShopRoleData[] = [
            { roleId: unit.roleId, level: unit.level, index, kind: preview ? ShopRoleKind.Preview : ShopRoleKind.Team },
        ];
        this.updateRoles(this.getNode("roleBox"), main);
        const reserves = this.business.getReserves(index);
        const data = Array.from({ length: reserves.level2 + reserves.level1 }, (value, slot): IShopRoleData => {
            return {
                roleId: unit.roleId,
                level: slot < reserves.level2 ? 2 : 1,
                index,
                kind: preview ? ShopRoleKind.Preview : ShopRoleKind.Reserve,
            };
        });
        this.updateRoles(this.getNode("reserveBox"), data);
    }

    private updateRoles(box: Node, items: IShopRoleData[]) {
        const length = Math.max(box.children.length, items.length);
        for (let index = 0; index < length; index++) {
            const data = items[index];
            if (data && index >= box.children.length) {
                const child = instantiate(this.rolePrefab);
                child.parent = box;
            }
            const node = box.children[index];
            node.active = !!data;
            if (data) {
                node.getComponent(ShopRoleItem).setData(data);
            }
        }
        box.getComponent(Layout).updateLayout();
    }
}
