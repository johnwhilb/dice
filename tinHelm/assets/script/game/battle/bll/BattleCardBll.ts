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
    CombatStart = 'ON_COMBAT_START',
    TurnEndInExhaust = 'ON_TURN_END_IN_EXHAUST'
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
    EnergySpent = 'ON_ENERGY_SPENT',
    BlockGained = 'ON_BLOCK_GAINED',
    StatusApplied = 'ON_STATUS_APPLIED'
}

export class BattleCardBll extends CCBusiness<Battle> {
    // 向指定牌堆添加配置中的卡牌。
    addCard(cardId: number, count: number, pile: string): void {
        const player = this.ent.BattlePlayerModel;
        const destination = pile === 'DRAW' ? player.drawPile : pile === 'HAND' ? player.handCards : player.discardPile;
        const capacity = pile === 'HAND' ? Math.max(0, player.handLimit - player.handCards.length) : 100;
        for (let index = 0; index < Math.min(capacity, Math.max(0, Math.floor(count))); index++) {
            destination.push(this.createInstance(cardId));
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
        const deck = this.shuffleCards(cards.map(id => {
            return this.createInstance(id);
        }));
        for (const cardId of deck) {
            const card = this.getCard(cardId)!;
            this.ent.BattleEffectBll.validateEffects(card.effect);
        }
        player.drawPile = [...deck.filter(id => {
                return this.getCard(id)!.flags.innate;
            }),
            ...deck.filter(id => {
                return !this.getCard(id)!.flags.innate;
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
        const card = this.getCard(player.handCards[index])!;
        if (card.flags.unplayable) {
            return null;
        }
        if (this.isFreeCard(card)) {
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
        const diceNeed = this.getRequiredDice(card);
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
        const runId = model.runId;
        model.busy = true;
        model.message = '';
        const player = this.ent.BattlePlayerModel;
        const cardId = player.handCards.splice(index, 1)[0];
        const card = this.getCard(cardId)!;
        if (player.freeDiceCards > 0 && !this.hasSpecificFreeCard(card)) {
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
        player.freeInstanceTurns.delete(cardId);
        if (card.type === 'ATTACK' && player.nextAttackFree > 0) {
            player.nextAttackFree--;
        }
        return this.resolveCard(cardId, usedDiceIndexes.length).catch((error: Error) => {
            if (runId === model.runId) {
                this.ent.BattleBll.handleBattleError(error);
            }
        }).finally(async () => {
            if (runId !== model.runId) {
                return;
            }
            model.busy = false;
            await this.ent.BattleBll.finishResult();
            this.ent.BattleBll.refreshBattleView();
        });
    }
    // 等待自动与手动出牌共用的效果链；自动出牌不再次支付骰子。
    async resolveCard(cardId: number, diceCount = 0, exhaustAfter = false): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        const card = this.getCard(cardId);
        const model = this.ent.BattleModel;
        if (++player.resolutionDepth > 100) {
            player.resolutionDepth--;
            throw new Error('自动出牌嵌套超过安全深度，请检查循环效果');
        }
        player.resolvingCards.push(cardId);
        const context = this.ent.BattleValueResolver.createContext(BattleSide.Player, cardId, card.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy);
        context.cardPlay = true;
        const repeats = card.type === 'ATTACK' ? player.nextAttackRepeats : 0;
        if (card.type === 'ATTACK') {
            player.nextAttackRepeats = 0;
        }
        player.cardsPlayed++;
        player.attacksPlayed += card.type === 'ATTACK' ? 1 : 0;
        const event: BattleCardPlayedEvent = { cardId, type: card.type, diceCount,
            requiredDiceCount: card.DiceNeed.length, cardCount: player.cardsPlayed, attackCount: player.attacksPlayed };
        await (async () => {
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.BeforeCardPlayed, BattleSide.Player, event);
            context.variables.cardDamageBonus = card.type === 'ATTACK' ? player.cardDamageBonus : 0;
            context.variables.nextCardDamageBonus = card.type === 'ATTACK' ? player.nextCardDamageBonus : 0;
            if (card.type === 'ATTACK') {
                player.nextCardDamageBonus = 0;
            }
            for (let repeat = 0; repeat <= repeats && !this.ent.BattleBll.isBattleFinished(context.runId); repeat++) {
                await this.runCardEvent(cardId, CardEvent.Play, context);
            }
            if (context.runId !== model.runId) {
                return;
            }
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CardPlayed, BattleSide.Player, event);
            await this.ent.BattleTriggerBll.fireEvent(this.getCardPlayedEvent(card.type), BattleSide.Player, event);
            if (!this.ent.BattleBll.isBattleFinished(context.runId) && context.variables.cardBlockGained > 0) {
                await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.BlockCardPlayed, BattleSide.Player, { ...event, block: context.variables.cardBlockGained });
            }
        })().finally(async () => {
            if (context.runId !== model.runId) {
                return;
            }
            player.resolutionDepth--;
            player.resolvingCards.splice(player.resolvingCards.indexOf(cardId), 1);
            if (exhaustAfter || card.flags.exhaust
                || (card.type === 'SKILL' && player.cardRules.SKILL_FREE_EXHAUST)) {
                player.exhaustPile.push(cardId);
                player.exhaustedThisTurn++;
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
        });
    }
    // 等待洗牌、入手效果和抽牌事件完成；所有抽牌均受手牌上限约束。
    async drawOneCard(recycle: boolean, onDraw?: (card: TableCard) => void): Promise<boolean> {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        if (player.drawLocked || this.ent.BattleBll.isBattleFinished() || player.handCards.length >= player.handLimit) {
            return false;
        }
        if (!player.drawPile.length && recycle && player.discardPile.length) {
            player.drawPile = this.shuffleCards(player.discardPile.splice(0));
            await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.Shuffle, BattleSide.Player);
        }
        if (this.ent.BattleBll.isBattleFinished(runId)) {
            return false;
        }
        if (!player.drawPile.length || player.handCards.length >= player.handLimit || this.ent.BattleBll.isBattleFinished()) {
            return false;
        }
        const cardId = player.drawPile.shift()!;
        player.handCards.push(cardId);
        if (onDraw) {
            onDraw(this.getCard(cardId));
        }
        await this.runCardEvent(cardId, CardEvent.Drawn);
        if (runId !== this.ent.BattleModel.runId) {
            return false;
        }
        await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.CardDrawn, BattleSide.Player, { cardId, type: this.getCard(cardId).type, strike: this.getCard(cardId).name.includes('打击') });
        return true;
    }
    // 等待指定数量的免费抽牌逐张结算；洗回弃牌堆，满手或无牌时停止。
    async drawExtraCards(count: number, untilNonAttack = false): Promise<void> {
        const runId = this.ent.BattleModel.runId;
        let remaining = Math.min(100, Math.max(0, Math.floor(count)));
        while (remaining-- > 0 && !this.ent.BattleBll.isBattleFinished(runId)) {
            let stop = false;
            const drawn = await this.drawOneCard(true, card => {
                stop = untilNonAttack && card.type !== 'ATTACK';
            });
            if (!drawn || stop) {
                break;
            }
        }
    }
    // 等待回合开始补足基础手牌数量；保留牌占用数量，上限不决定发牌数量。
    async fillHand(): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        const targetCount = Math.min(player.baseHandCount, player.handLimit);
        let remaining = player.drawPile.length + player.discardPile.length;
        while (remaining-- > 0 && player.handCards.length < targetCount) {
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
            || player.drawLocked || player.energy <= 0 || player.handCards.length >= player.handLimit
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
            const card = this.getCard(cardId)!;
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
        if (exhaust) {
            player.exhaustedThisTurn++;
        }
        await this.runCardEvent(cardId, exhaust ? CardEvent.Exhausted : CardEvent.Discarded);
        await this.ent.BattleTriggerBll.fireEvent(exhaust ? BattleTriggerEvent.Exhaust : BattleTriggerEvent.Discard, BattleSide.Player, { cardId, type: this.getCard(cardId).type });
        this.ent.BattleBll.refreshBattleView();
    }
    // 等待选择或随机弃牌及对应事件完成。
    async discardCards(count: number, mode: string, exhaust = false, filter: BattleEventData = {}, context?: BattleContext, children: BattleEffect[] = []): Promise<void> {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        const initialCards = new Set(player.handCards);
        let remaining = Math.min(count, player.handCards.length);
        while (remaining-- > 0 && !this.ent.BattleBll.isBattleFinished()) {
            const candidates = player.handCards.map((cardId, index) => {
                return ({ card: this.getCard(cardId)!, index });
            })
                .filter(item => {
                return initialCards.has(item.card.id) && (!filter.type || item.card.type === filter.type)
                    && (!filter.notType || item.card.type !== filter.notType) && (!filter.id || item.card.baseId === filter.id);
            });
            if (!candidates.length) {
                return;
            }
            const selected = mode === 'SELECT'
                ? await this.ent.BattleEffectBll.chooseEffect(exhaust ? '选择消耗的手牌' : '选择弃置的手牌', candidates.map(item => {
                    return `${item.card.name}：${item.card.des}`;
                }))
                : mode === 'RANDOM' ? Math.floor(Math.random() * candidates.length) : 0;
            if (selected < 0 || selected >= candidates.length || this.ent.BattleBll.isBattleFinished(runId)) {
                return;
            }
            const selectedCard = candidates[selected].card;
            if (context) {
                context.variables.exhaustedCount = (context.variables.exhaustedCount || 0) + (exhaust ? 1 : 0);
                context.variables.exhaustedDamage = this.readBaseDamage(selectedCard.id);
            }
            await this.moveFromHand(candidates[selected].index, exhaust);
            if (context) {
                await this.ent.BattleEffectBll.executeEffects(children, context);
            }
        }
    }
    // 根据实例编号读取当前显示数据，动态骰子要求与本张成长同步展示。
    getCard(id: number): TableCard {
        const player = this.ent.BattlePlayerModel;
        const card = player.cardInstances.get(id) || TableCard.getConfigById(id);
        if (!card) {
            throw new Error('卡牌配置不存在：' + id);
        }
        const growth = player.cardGrowth.get(id) || 0;
        return card.createInstance(id, this.isFreeCard(card) ? [] : this.getRequiredDice(card),
            card.des + (growth ? `\n本张牌每段伤害增加${growth}。` : ''));
    }
    // 创建独立实例，复制时继承本张牌的成长，免骰标记不复制。
    createInstance(id: number): number {
        const player = this.ent.BattlePlayerModel;
        const card = player.cardInstances.get(id) || TableCard.getConfigById(id);
        if (!card) {
            throw new Error('无法生成不存在的卡牌：' + id);
        }
        const instanceId = player.nextInstanceId--;
        player.cardInstances.set(instanceId, card.createInstance(instanceId));
        player.cardGrowth.set(instanceId, player.cardGrowth.get(id) || 0);
        return instanceId;
    }
    // 读取专属于技能、攻击或当前实例的免骰资格。
    private hasSpecificFreeCard(card: TableCard): boolean {
        const player = this.ent.BattlePlayerModel;
        return !!(card.type === 'SKILL' && player.cardRules.SKILL_FREE_EXHAUST)
            || (card.type === 'ATTACK' && player.nextAttackFree > 0)
            || player.freeInstanceTurns.get(card.id) === this.ent.BattleModel.turn;
    }
    // 汇总通用与专属免骰资格。
    private isFreeCard(card: TableCard): boolean {
        return this.hasSpecificFreeCard(card) || this.ent.BattlePlayerModel.freeDiceCards > 0;
    }
    // 按当前攻击次数减免配置指定花色，其他花色仍需支付。
    private getRequiredDice(card: TableCard): number[] {
        const raw = this.ent.BattlePlayerModel.cardInstances.get(card.id) || card;
        let discount = Math.min(Number(raw.flags.discountMax) || 0, this.ent.BattlePlayerModel.attacksPlayed);
        return raw.DiceNeed.map(Number).filter(id => {
            if (id === raw.flags.discountDice && discount > 0) {
                discount--;
                return false;
            }
            return true;
        });
    }
    // 读取第一段基础攻击伤害，排除力量、易伤等最终伤害修正。
    readBaseDamage(id: number): number {
        const card = this.getCard(id);
        const find = (effects: BattleEffect[]): number => {
            for (const effect of effects) {
                if (effect.params.damageKind === 'ATTACK' && !effect.trigger) {
                    return this.ent.BattleValueResolver.resolveNumber(effect.params.amount,
                        this.ent.BattleValueResolver.createContext(BattleSide.Player, id));
                }
                const nested = find(effect.children);
                if (nested) {
                    return nested;
                }
            }
            return 0;
        };
        return find(card.effect) + (this.ent.BattlePlayerModel.cardGrowth.get(id) || 0);
    }
    // 等待选牌或随机移动，移动已有实例不会额外生成卡牌。
    async moveCard(pile: string, destination: string, mode: string, context: BattleContext, exhaustAfter = false): Promise<void> {
        const player = this.ent.BattlePlayerModel;
        const source = pile === 'DRAW' ? player.drawPile : pile === 'EXHAUST' ? player.exhaustPile : pile === 'DISCARD' ? player.discardPile : player.handCards;
        const candidates = source.filter(id => {
            return mode !== 'RANDOM_ATTACK' || this.getCard(id).type === 'ATTACK';
        });
        const eventId = Number(context.event.cardId);
        const selected = mode === 'THIS' ? candidates.indexOf(context.cardId) : mode === 'EVENT' ? candidates.indexOf(eventId)
            : mode.startsWith('RANDOM') ? Math.floor(Math.random() * candidates.length)
            : mode === 'SELECT' ? await this.ent.BattleEffectBll.chooseEffect('选择卡牌', candidates.map(id => {
                return this.getCard(id).name;
            })) : 0;
        if (context.runId !== this.ent.BattleModel.runId || selected < 0 || selected >= candidates.length) {
            return;
        }
        if (destination === 'HAND' && player.handCards.length >= player.handLimit) {
            return;
        }
        const id = candidates[selected];
        source.splice(source.indexOf(id), 1);
        if (destination === 'PLAY') {
            player.freeInstanceTurns.delete(id);
            if (this.getCard(id).type === 'ATTACK' && player.nextAttackFree > 0) {
                player.nextAttackFree--;
            }
            await this.resolveCard(id, 0, exhaustAfter);
        }
        else if (destination === 'DRAW_TOP') {
            player.drawPile.unshift(id);
        }
        else {
            (destination === 'HAND' ? player.handCards : player.discardPile).push(id);
        }
    }
    // 回合结束时仅结算仍在消耗堆中的配置事件，不移出消耗堆。
    async settleExhaustAtTurnEnd(): Promise<void> {
        for (const id of [...this.ent.BattlePlayerModel.exhaustPile]) {
            await this.runCardEvent(id, CardEvent.TurnEndInExhaust);
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
        const card = this.getCard(cardId)!;
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
