import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { EnumEvent } from '../../common/table/EnumEvent';

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
    turn: number = 1;
    phase: BattlePhase = BattlePhase.Start;
    dice: number[] = [];
    handCards: number[] = [];
    drawPile: number[] = [];
    discardPile: number[] = [];
    enemyId: number = 0;

    reset() {
        this.turn = 1;
        this.dice = [];
        this.handCards = [];
        this.drawPile = [];
        this.discardPile = [];
        this.enemyId = 0;
    }
}