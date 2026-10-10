import type { CardEvent, BattleTriggerEvent } from '../bll/BattleCardBll';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { BattleEffectTypeEnum } from '../../common/table/BattleEffectTypeEnum';
export interface BattleEventData {
    [key: string]: number | string | boolean | undefined;
}
export interface BattleEffectParams {
    [key: string]: number | string | boolean | BattleEventData | undefined;
    status?: BattleBuffTypeEnum | 'ALL';
    stat?: BattleBuffTypeEnum | 'HP' | 'MAX_HP' | 'BLOCK';
    filter?: BattleEventData;
    event?: BattleTriggerEvent;
    amount?: number | string;
    stacks?: number | string;
    count?: number | string;
    hits?: number | string;
    ignoreBlock?: boolean;
    scale?: boolean;
    canKill?: boolean;
    unique?: boolean;
}
export enum BattleSide {
    Player = 'PLAYER',
    Enemy = 'ENEMY'
}
export enum EnemyBehaviorNodeType {
    Selector = 'SELECTOR',
    Random = 'RANDOM',
    Sequence = 'SEQUENCE',
    Condition = 'CONDITION',
    Action = 'ACTION',
    Cycle = 'CYCLE'
}
export enum EnemyActionType {
    Attack = 'ATTACK',
    Defend = 'DEFEND',
    Buff = 'BUFF',
    Debuff = 'DEBUFF',
    Heal = 'HEAL',
    Wait = 'WAIT',
    LoseHp = 'LOSE_HP',
    RemoveBlock = 'REMOVE_BLOCK',
    Cleanse = 'CLEANSE',
    Discard = 'DISCARD',
    Exhaust = 'EXHAUST',
    AddCard = 'ADD_CARD',
    Effects = 'EFFECTS'
}
export enum EnemyConditionField {
    Turn = 'TURN',
    SelfHpPercent = 'SELF_HP_PERCENT',
    PlayerHpPercent = 'PLAYER_HP_PERCENT',
    SelfBlock = 'SELF_BLOCK',
    PlayerBlock = 'PLAYER_BLOCK',
    TurnMod = 'TURN_MOD',
    RepeatCount = 'REPEAT_COUNT',
    LastAction = 'LAST_ACTION'
}
export interface EnemyBehaviorNode {
    type: EnemyBehaviorNodeType;
    children: EnemyBehaviorNode[];
    field?: EnemyConditionField;
    operator?: string;
    value?: number;
    action?: EnemyActionType;
    moveName?: string;
    amount?: number;
    hits?: number;
    status?: BattleBuffTypeEnum;
    stacks?: number;
    duration?: string;
    weight?: number;
    modulus?: number;
    actionValue?: EnemyActionType;
    target?: BattleSide;
    cardId?: number;
    pile?: string;
    count?: number;
    effects?: BattleEffect[];
    editorId?: string;
}
export enum EnemyPhaseCondition {
    HpBelow = 'HP_BELOW',
    TurnAtLeast = 'TURN_AT_LEAST',
    HitsAtLeast = 'HITS_AT_LEAST'
}
export interface EnemyInitialStatus {
    status: BattleBuffTypeEnum;
    stacks: number;
    duration: string;
}
export interface EnemyPhase {
    id: string;
    name: string;
    condition: EnemyPhaseCondition;
    value: number;
    effects: BattleEffect[];
    behavior?: EnemyBehaviorNode;
}
export interface EnemyMechanicTrigger {
    event: BattleTriggerEvent;
    listenSide: BattleSide;
    effects: BattleEffect[];
    limit: number;
    filter: BattleEventData;
}
export interface EnemyMechanics {
    initialStatuses: EnemyInitialStatus[];
    phases: EnemyPhase[];
    triggers: EnemyMechanicTrigger[];
}
export enum BattleCardPile {
    Draw = 'DRAW',
    Discard = 'DISCARD'
}
export interface BattleBuff {
    id: BattleBuffTypeEnum;
    stacks: number;
    duration: string;
    expiresTurn: number;
}
export interface BattleActor {
    hp: number;
    maxHp: number;
    block: number;
    buffs: BattleBuff[];
}
export interface BattleCondition {
    op?: string;
    rules?: BattleCondition[];
    lhs?: number | string | boolean;
    cmp?: string;
    rhs?: number | string | boolean;
}
export interface BattleEffect {
    id?: string;
    type: BattleEffectTypeEnum;
    target: string;
    trigger?: CardEvent;
    note?: string;
    params: BattleEffectParams;
    condition?: BattleCondition;
    children: BattleEffect[];
    elseEffects: BattleEffect[];
}
export interface BattleContext {
    runId: number;
    source: BattleSide;
    target: BattleSide;
    cardId: number;
    variables: Record<string, number>;
    event: BattleEventData;
    activeCardEvents: string[];
    /** 只有实际打出的卡牌使用卡牌加成，装备和持续触发效果不继承。 */
    cardPlay?: boolean;
    equipmentKey?: string;
}
export interface BattleCardPlayedEvent extends BattleEventData {
    cardId: number;
    type: string;
    diceCount: number;
    requiredDiceCount: number;
    cardCount: number;
    attackCount: number;
    block?: number;
}
export interface BattleEnergyEvent extends BattleEventData {
    previous: number;
    current: number;
    amount: number;
    spent: number;
    reason: string;
}
export interface BattleTrigger {
    owner: BattleSide;
    event: BattleTriggerEvent;
    effects: BattleEffect[];
    context: BattleContext;
    filter: BattleEventData;
    remaining: number;
    scope: string;
    expiresTurn: number;
    dueTurn: number;
    active: boolean;
}
export interface BattleChoice {
    title: string;
    options: string[];
    resolve: (index: number) => void;
}
