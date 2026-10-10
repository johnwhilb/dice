import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableCard } from '../../common/table/TableCard';
import { TableDice } from '../../common/table/TableDice';
import { BattlePhase } from '../model/BattleModel';
import { BattleCardPile, BattleCardPlayedEvent, BattleContext, BattleEffect, BattleSide, BattleEventData } from '../model/BattleTypes';
export enum CardEvent {
    Play = 'ON_PLAY',
    Drawn = 'ON_DRAWN',
    Discarded = 'ON_DISCARDED',
    Exhausted = 'ON_EXHAUSTED',
    Retained = 'ON_RETAINED',
    TurnEndInHand = 'ON_TURN_END_IN_HAND',
    HitUnblocked = 'ON_HIT_UNBLOCKED',
    KillWithThisCard = 'ON_KILL_WITH_THIS_CARD',
    CombatStart = 'ON_COMBAT_START'
}

export enum BattleTriggerEvent {
    BeforeCardPlayed = 'ON_BEFORE_CARD_PLAYED',
    CardPlayed = 'ON_CARD_PLAYED',
    CardDrawn = 'ON_CARD_DRAWN',
    Shuffle = 'ON_SHUFFLE',
    Exhaust = 'ON_EXHAUST',
    Discard = 'ON_DISCARD',
    BlockCardPlayed = 'ON_BLOCK_CARD_PLAYED',
    AttackPlayed = 'ON_ATTACK_PLAYED',
    SkillPlayed = 'ON_SKILL_PLAYED',
    PowerPlayed = 'ON_POWER_PLAYED',
    StatusPlayed = 'ON_STATUS_PLAYED',
    CursePlayed = 'ON_CURSE_PLAYED',
    CombatStart = 'ON_COMBAT_START',
    CombatEnd = 'ON_COMBAT_END',
    TurnStart = 'ON_TURN_START',
    TurnEnd = 'ON_TURN_END',
    AfterEnemyTurn = 'AFTER_ENEMY_TURN',
    HandReady = 'ON_HAND_READY',
    EnemyDied = 'ON_ENEMY_DIED',
    DamageDealt = 'ON_DAMAGE_DEALT',
    DamageTaken = 'ON_DAMAGE_TAKEN',
    HpLoss = 'ON_HP_LOSS',
    CardDamageDealt = 'ON_CARD_DAMAGE_DEALT',
    EnergyChanged = 'ON_ENERGY_CHANGED',
    EnergySpent = 'ON_ENERGY_SPENT'
}

export class BattleCardBll extends CCBusiness<Battle> {
    // 向指定牌堆添加配置中的卡牌。
    addCard(cardId: number, count: number, pile: string): void {
        const player = this.ent.BattlePlayerModel;
        const destination = pile === 'DRAW' ? player.drawPile : pile === 'HAND' ? player.handCards : player.discardPile;
        for (let index = 0; index < Math.min(100, count); index++) {
            destination.push(cardId);
        }
        this.ent.BattleBll.refreshBattleView();
    }
    // 读取用于展示的牌堆副本。
    getPileCards(pile: BattleCardPile): number[] {
        const player = this.ent.BattlePlayerModel;
        // 展示副本，排序不改变抽牌顺序；重复的卡牌仍逐张显示。
        return pile === BattleCardPile.Draw ? [...player.drawPile].sort((left, right) => {
            return left - right;
        })
            : [...player.discardPile];
    }
    // 随机打乱卡牌顺序并返回副本。
    shuffleCards(cards: number[]): number[] {
        const result = [...cards];
        for (let index = result.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }
    // 校验牌组效果并安排固有牌的初始位置。
    initializeDeck(cards: number[]): void {
        const player = this.ent.BattlePlayerModel;
        const deck = this.shuffleCards(cards);
        for (const cardId of deck) {
            const card = TableCard.getConfigById(cardId)!;
            this.ent.BattleEffectBll.validateEffects(card.effect);
        }
        player.drawPile = [...deck.filter(id => {
                return TableCard.getConfigById(id)!.flags.innate;
            }),
            ...deck.filter(id => {
                return !TableCard.getConfigById(id)!.flags.innate;
            })];
    }
    // 检查手牌是否满足出牌与骰子条件。
    canPlayCard(index: number): boolean {
        return !!this.getPlayableDiceIndexes(index);
    }
    // 读取可供当前手牌使用的骰子索引。
    private getPlayableDiceIndexes(index: number): number[] | null {
        const player = this.ent.BattlePlayerModel;
        if (!Number.isInteger(index) || index < 0 || index >= player.handCards.length) {
            return null;
        }
        const card = TableCard.getConfigById(player.handCards[index])!;
        if (card.flags.unplayable) {
            return null;
        }
        if (player.freeDiceCards > 0) {
            return [];
        }
        const availableIndexes = player.dice.map((_value, diceIndex) => {
            return diceIndex;
        })
            .filter(diceIndex => {
            return !player.diceUsed.includes(diceIndex);
        })
            .sort((left, right) => {
            return player.dice[right] - player.dice[left] || left - right;
        });
        const diceNeed = card.DiceNeed.map(Number);
        return this.matchDiceIndexes(diceNeed, availableIndexes, [], 0);
    }
    // 按卡牌条件匹配互不重复的骰子。
    private matchDiceIndexes(diceNeed: number[], availableIndexes: number[], matchedIndexes: number[], needIndex: number): number[] | null {
        if (needIndex >= diceNeed.length) {
            return matchedIndexes;
        }
        const player = this.ent.BattlePlayerModel;
        const dice = TableDice.getConfigById(diceNeed[needIndex])!;
        if (dice.role !== player.playerId) {
            return null;
        }
        for (const diceIndex of availableIndexes) {
            if (!dice.diceNum.includes(player.dice[diceIndex])) {
                continue;
            }
            const result = this.matchDiceIndexes(diceNeed, availableIndexes.filter(index => {
                return index !== diceIndex;
            }), [...matchedIndexes, diceIndex], needIndex + 1);
            if (result) {
                return result;
            }
        }
        return null;
    }
    // 等待出牌、装备事件和牌堆移动完成，再解除战斗操作锁。
    playCard(index: number): Promise<void> {
        const model = this.ent.BattleModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.ent.BattleBll.isBattleFinished()) {
            return Promise.resolve();
        }
        const usedDiceIndexes = this.getPlayableDiceIndexes(index);
        if (!usedDiceIndexes) {
            model.message = '骰子条件不足，或此牌不可打出';
            this.ent.BattleBll.refreshBattleView();
            return Promise.resolve();
        }
        model.busy = true;
        model.message = '';
        const player = this.ent.BattlePlayerModel;
        const cardId = player.handCards.splice(index, 1)[0];
        const card = TableCard.getConfigById(cardId)!;
        if (player.freeDiceCards > 0) {
            // 优先消耗本回合次数，跨回合次数独立保留。
            if (player.freeDiceCards === player.combatFreeDiceCards) {
                player.combatFreeDiceCards--;
            }
            player.freeDiceCards--;
        }
        player.diceUsed.push(...usedDiceIndexes);
        player.diceLocked = player.diceLocked.filter(index => {
            return !usedDiceIndexes.includes(index);
        });
        player.resolvingCards.push(cardId);
        const context = this.ent.BattleValueResolver.createContext(BattleSide.Player, cardId, card.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy);
        context.cardPlay = true;
        player.cardsPlayed++;
        if (card.type === 'ATTACK') {
            player.attacksPlayed++;
        }
        const event: BattleCardPlayedEvent = { cardId, type: card.type, diceCount: usedDiceIndexes.length,
            requiredDiceCount: card.DiceNeed.length, cardCount: player.cardsPlayed, attackCount: player.attacksPlayed };
        this.ent.BattleBll.refreshBattleView();
        return (async () => {
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.BeforeCardPlayed, BattleSide.Player, event);
            if (this.ent.BattleBll.isBattleFinished(context.runId)) {
                return;
            }
            context.variables.cardDamageBonus = card.type === 'ATTACK' ? player.cardDamageBonus : 0;
            context.variables.nextCardDamageBonus = card.type === 'ATTACK' ? player.nextCardDamageBonus : 0;
            if (card.type === 'ATTACK') {
                player.nextCardDamageBonus = 0;
            }
            await this.runCardEvent(cardId, CardEvent.Play, context);
            if (context.runId !== model.runId) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CardPlayed, BattleSide.Player, event);
            if (context.runId !== model.runId) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(this.getCardPlayedEvent(card.type), BattleSide.Player, event);
            if (!this.ent.BattleBll.isBattleFinished(context.runId) && context.variables.cardBlockGained > 0) {
                await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.BlockCardPlayed, BattleSide.Player, { ...event, block: context.variables.cardBlockGained });
            }
        })().catch((error: Error) => {
            if (context.runId === model.runId) {
                this.ent.BattleBll.handleBattleError(error);
            }
        }).finally(async () => {
            if (context.runId !== model.runId) {
                return;
            }
            await (async () => {
                player.resolvingCards.splice(player.resolvingCards.indexOf(cardId), 1);
                if (card.flags.exhaust || context.variables.exhaustThisCard) {
                    player.exhaustPile.push(cardId);
                    await this.runCardEvent(cardId, CardEvent.Exhausted, context);
                    await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.Exhaust, BattleSide.Player, { cardId, type: card.type });
                }
                else if (card.type === 'POWER') {
                    player.powerPile.push(cardId);
                }
                else {
                    player.discardPile.push(cardId);
                }
                this.ent.BattleBuffBll.clearActionBuffs();
                await this.ent.BattleBll.finishResult();
            })().catch((error: Error) => {
                this.ent.BattleBll.handleBattleError(error);
            }).finally(() => {
                model.busy = false;
                this.ent.BattleBll.refreshBattleView();
            });
        });
    }
    // 等待洗牌、抽到卡牌的自身效果和抽牌事件完成，支持装备带来的额外手牌。
    async drawOneCard(recycle: boolean, extra = false): Promise<boolean> {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        if (this.ent.BattleBll.isBattleFinished() || (!extra && player.handCards.length >= player.handLimit)) {
            return false;
        }
        if (!player.drawPile.length && recycle && player.discardPile.length) {
            player.drawPile = this.shuffleCards(player.discardPile.splice(0));
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.Shuffle, BattleSide.Player);
        }
        if (this.ent.BattleBll.isBattleFinished(runId)) {
            return false;
        }
        if (!player.drawPile.length || this.ent.BattleBll.isBattleFinished()) {
            return false;
        }
        const cardId = player.drawPile.shift()!;
        player.handCards.push(cardId);
        player.handLimit = Math.max(player.handLimit, player.handCards.length);
        await this.runCardEvent(cardId, CardEvent.Drawn);
        if (runId !== this.ent.BattleModel.runId) {
            return false;
        }
        await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CardDrawn, BattleSide.Player, { cardId });
        return true;
    }
    // 等待额外抽牌逐张结算；不消耗能量，缺牌时自然停止。
    async drawExtraCards(count: number): Promise<void> {
        let remaining = Math.min(100, Math.max(0, Math.floor(count)));
        while (remaining-- > 0) {
            if (!await this.drawOneCard(true, true)) {
                break;
            }
        }
    }
    /** 等待回合开始时逐张补足手牌，保留牌会占用手牌上限。 */
    // 等待逐张补足本回合的正常手牌。
    async fillHand(): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        let remaining = player.drawPile.length + player.discardPile.length;
        while (remaining-- > 0 && player.handCards.length < player.handLimit) {
            if (!await this.drawOneCard(true)) {
                break;
            }
        }
    }
    // 等待付费抽牌触发的装备效果和抽牌事件完成，再恢复操作。
    drawPaidCard(): Promise<boolean> {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.ent.BattleBll.isBattleFinished()
            || player.energy <= 0 || player.handCards.length >= player.handLimit
            || (!player.drawPile.length && !player.discardPile.length)) {
            return Promise.resolve(false);
        }
        const runId = model.runId;
        model.busy = true;
        model.message = '';
        return (async () => {
            await this.ent.BattleEquipmentBll.changeEnergy(-1, 'DRAW');
            if (this.ent.BattleBll.isBattleFinished(runId)) {
                return false;
            }
            return await this.drawOneCard(true);
        })().catch((error: Error) => {
            if (runId === model.runId) {
                this.ent.BattleBll.handleBattleError(error);
            }
            return false;
        }).finally(async () => {
            if (runId === model.runId) {
                model.busy = false;
                await this.ent.BattleBll.finishResult();
                this.ent.BattleBll.refreshBattleView();
            }
        });
    }
    // 等待回合末手牌效果、保留与弃置依次结算。
    async settleHandAtTurnEnd(): Promise<void> {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        for (const cardId of [...player.handCards]) {
            await this.runCardEvent(cardId, CardEvent.TurnEndInHand);
            if (this.ent.BattleBll.isBattleFinished(runId)) {
                return;
            }
            const index = player.handCards.indexOf(cardId);
            if (index < 0) {
                continue;
            }
            const card = TableCard.getConfigById(cardId)!;
            if (card.flags.ethereal) {
                await this.moveFromHand(index, true);
            }
            else if (card.flags.retain) {
                await this.runCardEvent(cardId, CardEvent.Retained);
            }
            else {
                await this.moveFromHand(index, false);
            }
        }
    }
    // 等待卡牌离手后的弃置或消耗事件结算。
    async moveFromHand(index: number, exhaust: boolean): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        if (!Number.isInteger(index) || index < 0 || index >= player.handCards.length) {
            return;
        }
        const cardId = player.handCards.splice(index, 1)[0];
        (exhaust ? player.exhaustPile : player.discardPile).push(cardId);
        await this.runCardEvent(cardId, exhaust ? CardEvent.Exhausted : CardEvent.Discarded);
        await this.ent.BattleTriggerBll.fireEvent(exhaust ? BattleTriggerEvent.Exhaust : BattleTriggerEvent.Discard, BattleSide.Player, { cardId });
        this.ent.BattleBll.refreshBattleView();
    }
    // 等待选择或随机弃牌及对应事件完成。
    async discardCards(count: number, mode: string, exhaust = false, filter: BattleEventData = {}): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        let remaining = Math.min(count, player.handCards.length);
        while (remaining-- > 0 && !this.ent.BattleBll.isBattleFinished()) {
            const candidates = player.handCards.map((cardId, index) => {
                return ({ card: TableCard.getConfigById(cardId)!, index });
            })
                .filter(item => {
                return (!filter.type || item.card.type === filter.type) && (!filter.id || item.card.id === filter.id);
            });
            if (!candidates.length) {
                return;
            }
            const selected = mode === 'SELECT'
                ? await this.ent.BattleEffectBll.chooseEffect(exhaust ? '选择消耗的手牌' : '选择弃置的手牌', candidates.map(item => {
                    return `${item.card.name}：${item.card.des}`;
                }))
                : mode === 'RANDOM' ? Math.floor(Math.random() * candidates.length) : 0;
            if (selected < 0) {
                return;
            }
            await this.moveFromHand(candidates[selected].index, exhaust);
        }
    }
    // 根据卡牌类型读取对应的全局出牌事件。
    private getCardPlayedEvent(cardType: string): BattleTriggerEvent {
        switch (cardType) {
            case 'ATTACK':
                return BattleTriggerEvent.AttackPlayed;
            case 'SKILL':
                return BattleTriggerEvent.SkillPlayed;
            case 'POWER':
                return BattleTriggerEvent.PowerPlayed;
            case 'STATUS':
                return BattleTriggerEvent.StatusPlayed;
            case 'CURSE':
                return BattleTriggerEvent.CursePlayed;
            default:
                throw new Error(`卡牌类型无效：${cardType}`);
        }
    }
    // 等待卡牌指定事件效果完成并防止递归触发。
    runCardEvent(cardId: number, event: CardEvent, context?: BattleContext): Promise<void> {
        const card = TableCard.getConfigById(cardId)!;
        const effects: BattleEffect[] = card.effect;
        const cardContext = context ? context : this.ent.BattleValueResolver.createContext(BattleSide.Player, cardId, card.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy);
        const activeEvents = cardContext.activeCardEvents;
        const eventKey = `${cardId}:${event}`;
        if (activeEvents.includes(eventKey)) {
            return Promise.resolve();
        }
        cardContext.activeCardEvents = activeEvents;
        activeEvents.push(eventKey);
        return (async () => {
            await this.ent.BattleEffectBll.executeEffects(effects.filter(effect => {
                return effect.trigger ? effect.trigger === event : event === CardEvent.Play;
            }), cardContext, event === CardEvent.KillWithThisCard);
            if (cardContext.runId !== this.ent.BattleModel.runId) {
                return;
            }
            if (cardContext.variables.exhaustThisCard && !this.ent.BattlePlayerModel.resolvingCards.includes(cardId)) {
                const index = this.ent.BattlePlayerModel.handCards.indexOf(cardId);
                if (index >= 0) {
                    await this.moveFromHand(index, true);
                }
            }
        })().finally(() => {
            activeEvents.pop();
        });
    }
    // 等待牌组中的开战效果逐张完成。
    async triggerCards(event: CardEvent, owner: BattleSide): Promise<void> {
        if (owner !== BattleSide.Player || event !== CardEvent.CombatStart) {
            return;
        }
        for (const id of [...this.ent.BattlePlayerModel.drawPile]) {
            await this.runCardEvent(id, event);
        }
    }
}
