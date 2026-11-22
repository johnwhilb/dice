import { _decorator } from "cc";
import type { IShopRoleData } from "../ShopEvent";
import { ShopRoleItem } from "./ShopRoleItem";

const { ccclass } = _decorator;

@ccclass("ShopTeamRoleItem")
export class ShopTeamRoleItem extends ShopRoleItem {
    setData(data: IShopRoleData) {
        super.setData(data, 20 + data.level * 20);
    }
}
