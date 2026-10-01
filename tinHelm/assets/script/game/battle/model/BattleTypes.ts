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
    children?: EnemyBehaviorNode[];
    field?: EnemyConditionField;
    operator?: string;
    value?: number;
    action?: EnemyActionType;
    moveName?: string;
    amount?: number;
    hits?: number;
    status?: string;
    stacks?: number;
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

export enum BattleCardPile {
    Draw = 'DRAW',
    Discard = 'DISCARD'
}

export interface BattleBuff {
    id: string;
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
    lhs?: unknown;
    cmp?: string;
    rhs?: unknown;
}

export interface BattleEffect {
    id?: string;
    type: string;
    target?: string;
    trigger?: string;
    note?: string;
    params?: Record<string, unknown>;
    condition?: BattleCondition;
    children?: BattleEffect[];
    elseEffects?: BattleEffect[];
}

export interface BattleContext {
    runId: number;
    source: BattleSide;
    target: BattleSide;
    cardId: number;
    variables: Record<string, number>;
    event: Record<string, unknown>;
    activeCardEvents?: string[];
}

export interface BattleTrigger {
    owner: BattleSide;
    event: string;
    effects: BattleEffect[];
    context: BattleContext;
    filter: Record<string, unknown>;
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
