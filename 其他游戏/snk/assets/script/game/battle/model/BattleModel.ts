import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { BattleState } from "../BattleEvent";

@ecs.register("BattleModel")
export class BattleModel extends ecs.Comp {
    arenaWidth: number = 0;
    arenaHeight: number = 0;
    level: number = 0;
    wave: number = 0;
    countdown: number = 0;
    state: BattleState = BattleState.Countdown;
    bossScheduled: boolean = false;
    settled: boolean = false;
    resultTime: number = 0;

    /** 清空预制体提供的战斗区域尺寸，角色数据由 PlayerModel 管理。 */
    reset() {
        this.arenaWidth = 0;
        this.arenaHeight = 0;
        this.level = 0;
        this.wave = 0;
        this.countdown = 0;
        this.state = BattleState.Countdown;
        this.bossScheduled = false;
        this.settled = false;
        this.resultTime = 0;
    }
}
