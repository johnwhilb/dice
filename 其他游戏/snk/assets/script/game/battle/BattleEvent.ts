/** 战斗事件。 */
export enum BattleEvent {
    /** 队伍准备完成后打开战斗界面，无参数。 */
    OpenBattle = "battle_open",
    /** 关卡、倒计时、波次或战斗结果变化，无参数。 */
    UpdateState = "battle_update_state",
    /** 开场倒计时归零，无参数。 */
    CountdownFinished = "battle_countdown_finished",
}

/** 本场战斗流程状态。 */
export enum BattleState {
    /** 队员可移动，敌人等待开场倒计时。 */
    Countdown,
    /** 正在刷怪与战斗。 */
    Running,
    /** 清怪胜利，等待唯一一次奖励结算。 */
    Victory,
    /** 全队阵亡，停止模拟且不发放奖励。 */
    Defeat,
}

