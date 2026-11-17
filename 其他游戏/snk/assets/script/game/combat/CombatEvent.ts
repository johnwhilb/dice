/** 共用战斗事件。 */
export enum CombatEvent {
    /** 本帧战斗表现数据完成更新，无参数。 */
    UpdateFrame = "combat_update_frame",
}

/** 战斗对象阵营。 */
export enum CombatCamp {
    /** 玩家，目标编号为队伍下标。 */
    Player,
    /** 敌人，目标编号为实例 ID。 */
    Enemy,
}
