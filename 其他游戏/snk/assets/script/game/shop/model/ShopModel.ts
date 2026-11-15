import { ecs } from "db://oops-framework/libs/ecs/ECS";

export interface IShopUnit {
    roleId: number;
    level: number;
    copies: number;
}

export interface IShopItem {
    contentId: number;
    level: number;
    xp: number;
}

export interface IShopSave {
    version: number;
    gold: number;
    offers: number[];
    team: IShopUnit[];
    items: IShopItem[];
    itemPool: number[];
    shopLevel: number;
    shopXp: number;
    battleLevel: number;
    loop: number;
    newGamePlus: number;
    locked: boolean;
}

export interface IShopClassProgress {
    classId: number;
    count: number;
    thresholds: number[];
    activeLevel: number;
}

@ecs.register("ShopModel")
export class ShopModel extends ecs.Comp {
    static readonly saveVersion: 1 = 1;
    gold: number = 0;
    shopLevel: number = 1;
    shopXp: number = 0;
    battleLevel: number = 1;
    loop: number = 0;
    newGamePlus: number = 0;
    locked: boolean = false;
    guideOpen: boolean = false;
    grabbedIndex: number = -1;
    rightButtonDown: boolean = false;
    items: IShopItem[] = [];
    itemPool: number[] = [];
    offers: number[] = [];
    team: IShopUnit[] = [];

    /** 清空金币、商品、商店等级、队伍和道具数据。 */
    reset() {
        this.gold = 0;
        this.shopLevel = 1;
        this.shopXp = 0;
        this.battleLevel = 1;
        this.loop = 0;
        this.newGamePlus = 0;
        this.locked = false;
        this.guideOpen = false;
        this.grabbedIndex = -1;
        this.rightButtonDown = false;
        this.items = [];
        this.itemPool = [];
        this.offers = [];
        this.team = [];
    }
}
