import type { Color, Vec3 } from "cc";

/**
 * 商店事件
 */
export enum ShopEvent {
    /** 商店数据变更后刷新界面，无参数。 */
    UpdateShopContent = "shop_update_content",
    /** 商品视觉消散；购买传移除槽位 index，手动刷新不传槽位。 */
    ShowOfferRemoval = "shop_show_offer_removal",
    /** 角色或道具出售成功后播放消散；参数为节点世界坐标与颜色。 */
    ShowRoleSaleEffect = "shop_show_role_sale_effect",
    /** 新局或读档成功后打开商店。 */
    OpenShop = "shop_open",
    /** 回合结算成功后继续结算流程，携带金币结算明细。 */
    RoundCompleted = "shop_round_completed",
    /** 海克斯候选与刷新费用变化后更新选择界面；单槽刷新时携带被刷新的槽位下标。 */
    UpdateHexReward = "shop_update_hex_reward",
    /** 点击海克斯卡片切换选中项；参数为槽位下标 index 与强化配置 ID contentId。 */
    SelectHexCandidate = "shop_select_hex_candidate",
    /** 海克斯单张卡横向翻牌换卡到达中点揭晓新内容；参数为槽位下标 index。 */
    HexCardFlipped = "shop_hex_card_flipped",
    /** 海克斯奖励已领取，关闭选择界面并进入商店，无参数。 */
    HexRewardSelected = "shop_hex_reward_selected",
    /** 记录队员拖拽起点并高亮羁绊；参数为队伍下标、触摸 UI 坐标和触点 ID。 */
    StartTeamDrag = "shop_start_team_drag",
    /** 队员交换位置后通知列表更新；参数 from、to 为交换前的两个队伍下标。 */
    UpdateTeamOrder = "shop_update_team_order",
    /** 商店金币发生变化；参数为变化量 delta（正数为获得，负数为消耗）。 */
    GoldChanged = "shop_gold_changed",
    /** 成功购买或合成角色；参数为 IShopUnitBought。 */
    UnitBought = "shop_unit_bought",
    /** 商店刷新出新商品，无参数。 */
    OffersRefreshed = "shop_offers_refreshed",
    /** 商店等级或经验变动；参数为 IShopLevelChange。 */
    ShopLevelChanged = "shop_level_changed",
    /** 被动道具经验或等级提升；参数为 IShopItemUpgrade。 */
    ItemUpgraded = "shop_item_upgraded",
    /** 商店操作被拒绝（金币不足/队伍已满/已满级）；参数为 ShopDeniedReason。 */
    ActionDenied = "shop_action_denied",
    /** 临时预览高亮一组职业羁绊；参数为职业 ID 集合与触点 ID。 */
    HighlightClasses = "shop_highlight_classes",
}

/** 商店音效标识。 */
export enum ShopSound {
    /** 购买角色。 */
    Buy = "sfxShopBuy",
    /** 出售角色或道具。 */
    Sell = "sfxShopSell",
    /** 道具升至二级。 */
    Upgrade = "sfxShopUpgrade",
    /** 道具升至三级。 */
    MaxUpgrade = "sfxShopMaxUpgrade",
    /** 刷新商品。 */
    Refresh = "sfxShopRefresh",
    /** 选中海克斯强化卡。 */
    Select = "sfxShopSelect",
    /** 锁定或解锁商店。 */
    Lock = "sfxShopLock",
    /** 成功购买或降低商店经验，或购买道具经验。 */
    Experience = "shopExperience",
    /** 出发进入战斗。 */
    StartBattle = "sfxShopStartBattle",
    /** 金币不足或操作被拒绝。 */
    Error = "sfxShopError",
}

/** 商店操作被拒绝的具体原因。 */
export enum ShopDeniedReason {
    /** 金币不足。 */
    GoldMissing,
    /** 队伍人数已满。 */
    TeamFull,
    /** 角色已满级。 */
    MaxLevel,
}

/** 回合结算转场展示的金币来源。 */
export interface IRoundGoldReward {
    roundGold: number;
    pickedUpGold: number;
    interest: number;
}

/** 购买角色后的反馈载荷。 */
export interface IShopUnitBought {
    teamIndex: number;
    roleId: number;
    level: number;
    upgraded: boolean;
}

/** 商店等级或经验变动反馈载荷。 */
export interface IShopLevelChange {
    level: number;
    leveledUp: boolean;
    downgraded: boolean;
}

/** 被动道具经验或等级提升载荷。 */
export interface IShopItemUpgrade {
    index: number;
    level: number;
    leveledUp: boolean;
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

/** 商店提示面板的内容、可选出售目标以及可选被动道具升级下标。 */
export interface IShopTooltipData {
    text: string;
    sale?: IShopTooltipSale;
    upgradeItemIndex?: number;
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
