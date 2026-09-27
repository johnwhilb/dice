export enum BattleSide {
    Player = 'PLAYER',
    Enemy = 'ENEMY'
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
