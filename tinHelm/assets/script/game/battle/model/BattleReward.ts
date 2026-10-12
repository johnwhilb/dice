export enum BattleRewardKind {
    Item,
    Resource,
    Card
}
export interface BattleReward {
    kind: BattleRewardKind;
    id: number;
    count: number;
    cardIds: number[];
    claimed: boolean;
}
