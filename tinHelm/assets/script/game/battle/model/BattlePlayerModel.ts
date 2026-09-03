import { ecs } from 'db://oops-framework/libs/ecs/ECS';


@ecs.register('BattlePlayerModel')
export class BattlePlayerModel extends ecs.Comp {

    turn: number = 1;
    dice: number[] = [];
    handCards: number[] = [];
    drawPile: number[] = [];
    discardPile: number[] = [];
    hp: number = 0;
    maxHp: number = 0;
    playerId: number = 0;

    reset() {
        this.turn = 1;
        this.dice = [];
        this.handCards = [];
        this.drawPile = [];
        this.discardPile = [];
        this.hp = 0;
        this.playerId = 0;
    }
}