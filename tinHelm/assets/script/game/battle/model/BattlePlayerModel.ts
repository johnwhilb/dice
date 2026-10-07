import { ecs } from 'db://oops-framework/libs/ecs/ECS';
import { BattleBuff } from './BattleTypes';


@ecs.register('BattlePlayerModel')
export class BattlePlayerModel extends ecs.Comp {

    turn: number = 1;
    dice: number[] = [];
    diceLocked: number[] = [];
    diceUsed: number[] = [];
    readonly baseHandLimit: number = 5;
    handLimit: number = 5;
    cardDamageBonus: number = 0;
    cardBlockBonus: number = 0;
    nextCardDamageBonus: number = 0;
    nextCardBlockBonus: number = 0;
    retainedBlockLimit: number = 0;
    freeDiceCards: number = 0;
    combatFreeDiceCards: number = 0;
    freeDiceExpiresTurn: number = 0;
    cardsPlayed: number = 0;
    attacksPlayed: number = 0;
    handCards: number[] = [];
    drawPile: number[] = [];
    discardPile: number[] = [];
    resolvingCards: number[] = [];
    exhaustPile: number[] = [];
    powerPile: number[] = [];
    energy: number = 0;
    readonly baseEnergy: number = 3;
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
        this.handLimit = this.baseHandLimit;
        this.cardDamageBonus = 0;
        this.cardBlockBonus = 0;
        this.nextCardDamageBonus = 0;
        this.nextCardBlockBonus = 0;
        this.retainedBlockLimit = 0;
        this.freeDiceCards = 0;
        this.combatFreeDiceCards = 0;
        this.freeDiceExpiresTurn = 0;
        this.cardsPlayed = 0;
        this.attacksPlayed = 0;
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
