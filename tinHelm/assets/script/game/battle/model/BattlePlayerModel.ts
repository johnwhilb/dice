import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { BattleBuff } from './BattleTypes';


@ecs.register('BattlePlayerModel')
export class BattlePlayerModel extends ecs.Comp {

    turn: number = 1;
    dice: number[] = [];
    diceLocked: number[] = [];
    diceUsed: number[] = [];
    readonly handLimit: number = 5;
    handCards: number[] = [];
    drawPile: number[] = [];
    discardPile: number[] = [];
    resolvingCards: number[] = [];
    exhaustPile: number[] = [];
    powerPile: number[] = [];
    energy: number = 0;
    maxEnergy: number = 6;
    block: number = 0;
    buffs: BattleBuff[] = [];
    hp: number = 0;
    maxHp: number = 0;
    playerId: number = 0;

    reset() {
        this.turn = 1;
        this.dice = [];
        this.diceLocked = [];
        this.diceUsed = [];
        this.handCards = [];
        this.drawPile = [];
        this.discardPile = [];
        this.resolvingCards = [];
        this.exhaustPile = [];
        this.powerPile = [];
        this.energy = 0;
        this.maxEnergy = 6;
        this.block = 0;
        this.buffs = [];
        this.hp = 0;
        this.maxHp = 0;
        this.playerId = 0;
    }
}
