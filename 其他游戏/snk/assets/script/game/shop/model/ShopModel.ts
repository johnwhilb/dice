import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IPlayerUnit } from "../../player/PlayerEvent";

export interface IShopItem {
    contentId: number;
    level: number;
    xp: number;
}

/** 待领取的海克斯候选、共享免费资格，以及各槽位的商人免费资格。 */
export interface IShopHexReward {
    candidates: number[];
    freeReroll: boolean;
    slotFreeRerolls?: boolean[];
}

export interface IShopSave {
    version: number;
    gold: number;
    offers: number[];
    team: IPlayerUnit[];
    items: IShopItem[];
    itemPool: number[];
    hexReward?: IShopHexReward;
    shopLevel: number;
    shopXp: number;
    battleLevel: number;
    loop: number;
    newGamePlus: number;
    locked: boolean;
    /** 本局已通过金手指添加角色，允许恢复重复、超员及非商店角色；旧存档可不包含此字段。 */
    goldFingerEnabled?: boolean;
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
    goldFingerEnabled: boolean = false;
    guideOpen: boolean = false;
    grabbedIndex: number = -1;
    rightButtonDown: boolean = false;
    items: IShopItem[] = [];
    itemPool: number[] = [];
    hexReward?: IShopHexReward;
    offers: number[] = [];
    team: IPlayerUnit[] = [];

    /** 清空金币、商品、商店等级、队伍、道具、待领取海克斯和本局金手指标记。 */
    reset() {
        this.gold = 0;
        this.shopLevel = 1;
        this.shopXp = 0;
        this.battleLevel = 1;
        this.loop = 0;
        this.newGamePlus = 0;
        this.locked = false;
        this.goldFingerEnabled = false;
        this.guideOpen = false;
        this.grabbedIndex = -1;
        this.rightButtonDown = false;
        this.items = [];
        this.itemPool = [];
        this.hexReward = undefined;
        this.offers = [];
        this.team = [];
    }
}
