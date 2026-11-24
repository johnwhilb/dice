import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { BattleState } from "../BattleEvent";

const originalArenaShortSide = 216;
const combatConfigScale = 3;

@ecs.register("BattleModel")
export class BattleModel extends ecs.Comp {
    arenaWidth: number = 0;
    arenaHeight: number = 0;
    combatScale: number = 1;
    cameraX: number = 0;
    cameraY: number = 0;
    level: number = 0;
    wave: number = 0;
    countdown: number = 0;
    /** 当前战斗阶段累计实战秒数，用于结算展示。 */
    battleDuration: number = 0;
    /** 上一次派发倒计时跳变事件时的整数秒。 */
    lastCountdownCeil: number = 0;
    state: BattleState = BattleState.Countdown;
    bossScheduled: boolean = false;
    settled: boolean = false;
    /** 胜利播报完成后到面板出现的剩余秒数，未播完时为空。 */
    victoryPanelDelay?: number;
    /** 触摸转向引导点坐标（逻辑战场坐标）及激活状态。 */
    steerActive: boolean = false;
    steerX: number = 0;
    steerY: number = 0;
    steerFade: number = 0;

    /** 预制体提供显示尺寸，战斗数值沿用按原版三倍坐标录入的尺度。 */
    setArenaSize(width: number, height: number) {
        this.arenaWidth = width;
        this.arenaHeight = height;
        const shortSide = Math.min(width, height);
        this.combatScale = shortSide > 0 ? shortSide / (originalArenaShortSide * combatConfigScale) : 1;
    }

    /** 返回应用等比缩放前的战斗逻辑宽度。 */
    get combatWidth() {
        return this.arenaWidth / this.combatScale;
    }

    /** 返回应用等比缩放前的战斗逻辑高度。 */
    get combatHeight() {
        return this.arenaHeight / this.combatScale;
    }

    /** 将原版镜头位移换算为战场显示坐标。 */
    get originalToViewScale() {
        return combatConfigScale * this.combatScale;
    }

    /** 清空预制体提供的战斗区域尺寸，角色数据由 PlayerModel 管理。 */
    reset() {
        this.arenaWidth = 0;
        this.arenaHeight = 0;
        this.combatScale = 1;
        this.cameraX = 0;
        this.cameraY = 0;
        this.level = 0;
        this.wave = 0;
        this.countdown = 0;
        this.battleDuration = 0;
        this.lastCountdownCeil = 0;
        this.state = BattleState.Countdown;
        this.bossScheduled = false;
        this.settled = false;
        this.victoryPanelDelay = undefined;
        this.steerActive = false;
        this.steerX = 0;
        this.steerY = 0;
        this.steerFade = 0;
    }
}
