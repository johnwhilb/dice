import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { BattleState } from "../BattleEvent";

const originalArenaShortSide = 216;
const combatConfigScale = 3;

@ecs.register("BattleModel")
export class BattleModel extends ecs.Comp {
    arenaWidth: number = 0;
    arenaHeight: number = 0;
    combatScale: number = 1;
    level: number = 0;
    wave: number = 0;
    countdown: number = 0;
    state: BattleState = BattleState.Countdown;
    bossScheduled: boolean = false;
    settled: boolean = false;
    resultTime: number = 0;

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

    /** 清空预制体提供的战斗区域尺寸，角色数据由 PlayerModel 管理。 */
    reset() {
        this.arenaWidth = 0;
        this.arenaHeight = 0;
        this.combatScale = 1;
        this.level = 0;
        this.wave = 0;
        this.countdown = 0;
        this.state = BattleState.Countdown;
        this.bossScheduled = false;
        this.settled = false;
        this.resultTime = 0;
    }
}
