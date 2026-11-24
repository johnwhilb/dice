import type { Color, Vec3 } from "cc";

/**
 * 商店事件
 */
export enum ShopEvent {
    /** 商店数据变更后刷新界面，无参数。 */
    UpdateShopContent = "shop_update_content",
    /** 商品视觉消散；购买传移除槽位 index，手动刷新不传槽位。 */
    ShowOfferRemoval = "shop_show_offer_removal",
    /** 角色出售成功后播放消散；参数为等级块的世界坐标与颜色。 */
    ShowRoleSaleEffect = "shop_show_role_sale_effect",
    /** 新局或读档成功后打开商店。 */
    OpenShop = "shop_open",
    /** 回合结算成功后返回商店，并携带金币结算明细。 */
    RoundCompleted = "shop_round_completed",
    /** 记录队员拖拽起点并高亮羁绊；参数为队伍下标、触摸 UI 坐标和触点 ID。 */
    StartTeamDrag = "shop_start_team_drag",
    /** 队员交换位置后通知列表更新；参数 from、to 为交换前的两个队伍下标。 */
    UpdateTeamOrder = "shop_update_team_order",
}

/** 回合结算转场展示的金币来源。 */
export interface IRoundGoldReward {
    roundGold: number;
    pickedUpGold: number;
    interest: number;
}

/**
 * 商店角色节点的展示与交互类型。
 */
export enum ShopRoleKind {
    /** 商店待购买的角色。 */
    Offer,
    /** 队伍中的主角色。 */
    Team,
    /** 队员持有的一级或二级储备角色。 */
    Reserve,
    /** 拖拽时展示的角色预览，不参与交互。 */
    Preview,
}

/** 提示面板支持出售的对象类型。 */
export enum ShopTooltipSaleKind {
    /** 队伍中的主角色。 */
    Team,
    /** 队员持有的储备角色。 */
    Reserve,
    /** 已拥有的被动道具。 */
    Item,
}

/** 提示面板中的出售目标及其商店槽位。 */
export interface IShopTooltipSale {
    kind: ShopTooltipSaleKind;
    index: number;
    level: number;
    effectOrigin?: IShopSaleEffectOrigin;
}

/** 打开详情时记录的等级块世界坐标与颜色。 */
export interface IShopSaleEffectOrigin {
    position: Vec3;
    color: Color;
}

/** 商店提示面板的内容以及可选的出售目标。 */
export interface IShopTooltipData {
    text: string;
    sale?: IShopTooltipSale;
}

/**
 * 商店角色数据
 */
export interface IShopRoleData {
    /** 角色配置 ID。 */
    roleId: number;
    /** 当前角色等级，储备角色为对应储备等级。 */
    level: number;
    /** 零起始下标：商品使用商品槽位，其余使用所属队伍槽位。 */
    index: number;
    /** 决定节点展示方式及允许的交互。 */
    kind: ShopRoleKind;
}
