import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { BattleCardPile, BattleChoice, BattleTrigger } from './BattleTypes';

export enum BattlePhase {
    Start,
    PlayerStart,
    PlayerRollDice,
    PlayerAction,
    PlayerEnd,
    EnemyStart,
    EnemyAction,
    EnemyEnd,
    CheckResult,
    Victory,
    Defeat
}

@ecs.register('BattleModel')
export class BattleModel extends ecs.Comp {
    /** 不随 reset 清零，隔离关闭后尚未返回的异步结算。 */
    runId: number = 0;
    turn: number = 1;
    rollingDiceIndexes: number[] = [];
    phase: BattlePhase = BattlePhase.Start;
    enemyId: number = 0;
    busy: boolean = false;
    shownCardPile: BattleCardPile | null = null;
    resultHandled: boolean = false;
    closed: boolean = false;
    message: string = '';
    gold: number = 0;
    triggers: BattleTrigger[] = [];
    choice: BattleChoice | null = null;
    turnVariables: Record<string, number> = {};
    combatVariables: Record<string, number> = {};

    reset() {
        this.phase = BattlePhase.Start;
        this.turn = 1;
        this.rollingDiceIndexes = [];
        this.enemyId = 0;
        this.busy = false;
        this.shownCardPile = null;
        this.resultHandled = false;
        this.closed = false;
        this.message = '';
        this.gold = 0;
        this.triggers = [];
        this.choice = null;
        this.turnVariables = {};
        this.combatVariables = {};
    }
}
