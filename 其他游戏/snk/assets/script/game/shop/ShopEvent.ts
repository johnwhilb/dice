/**
 * 商店事件
 */
export enum ShopEvent {
    /** 商店数据变更后刷新界面，无参数。 */
    UpdateShopContent = "shop_update_content",
    /** 新局或读档成功后打开商店。 */
    OpenShop = "shop_open",
    /** 回合结算成功后返回商店。 */
    RoundCompleted = "shop_round_completed",
    /** 记录队员拖拽起点；参数 index 为队伍下标，point 为触摸的 UI 坐标。 */
    StartTeamDrag = "shop_start_team_drag",
    /** 队员交换位置后通知列表更新；参数 from、to 为交换前的两个队伍下标。 */
    UpdateTeamOrder = "shop_update_team_order",
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
