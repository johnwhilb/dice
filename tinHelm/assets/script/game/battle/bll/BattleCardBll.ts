import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableCard } from '../../common/table/TableCard';
import { TableDice } from '../../common/table/TableDice';
import { BattlePhase } from '../model/BattleModel';
import { BattleCardPile, BattleContext, BattleEffect, BattleSide } from '../model/BattleTypes';

export class BattleCardBll extends CCBusiness<Battle> {
    getPileCards(pile: BattleCardPile) {
        const player = this.ent.BattlePlayerModel;
        // 展示副本，排序不改变抽牌顺序；重复的卡牌仍逐张显示。
        return pile === BattleCardPile.Draw ? [...player.drawPile].sort((left, right) => left - right)
            : [...player.discardPile];
    }

    shuffle(cards: number[]) {
        const result = [...cards];
        for (let index = result.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }

    initialize(cards: number[]) {
        const player = this.ent.BattlePlayerModel;
        const deck = this.shuffle(cards);
        for (const cardId of deck) {
            const card = TableCard.getConfigById(cardId);
            if (!card) {
                throw new Error(`卡牌配置不存在：${cardId}`);
            }
            this.ent.BattleEffectBll.validate(card.effect);
        }
        player.drawPile = [...deck.filter(id => TableCard.getConfigById(id)?.flags.innate),
            ...deck.filter(id => !TableCard.getConfigById(id)?.flags.innate)];
    }

    canPlay(index: number) {
        return !!this.getPlayableDiceIndexes(index);
    }

    private getPlayableDiceIndexes(index: number) {
        const player = this.ent.BattlePlayerModel;
        const card = TableCard.getConfigById(player.handCards[index]);
        if (!card || card.flags.unplayable) {
            return null;
        }
        const availableIndexes = player.dice.map((_value, diceIndex) => diceIndex)
            .filter(diceIndex => !player.diceUsed.includes(diceIndex))
            .sort((left, right) => player.dice[right] - player.dice[left] || left - right);
        const diceNeed = card.DiceNeed.map(Number);
        return this.matchDiceIndexes(diceNeed, availableIndexes, [], 0);
    }

    private matchDiceIndexes(diceNeed: number[], availableIndexes: number[], matchedIndexes: number[], needIndex: number): number[] | null {
        if (needIndex >= diceNeed.length) {
            return matchedIndexes;
        }
        const player = this.ent.BattlePlayerModel;
        const dice = TableDice.getConfigById(diceNeed[needIndex]);
        if (!dice || dice.role !== player.playerId) {
            return null;
        }
        for (const diceIndex of availableIndexes) {
            if (!dice.diceNum.includes(player.dice[diceIndex])) {
                continue;
            }
            const result = this.matchDiceIndexes(
                diceNeed,
                availableIndexes.filter(index => index !== diceIndex),
                [...matchedIndexes, diceIndex],
                needIndex + 1
            );
            if (result) {
                return result;
            }
        }
        return null;
    }

    async play(index: number) {
        const model = this.ent.BattleModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.ent.BattleBll.isFinished()) {
            return;
        }
        const usedDiceIndexes = this.getPlayableDiceIndexes(index);
        if (!usedDiceIndexes) {
            model.message = '骰子条件不足，或此牌不可打出';
            this.ent.BattleBll.refresh();
            return;
        }
        model.busy = true;
        model.message = '';
        const player = this.ent.BattlePlayerModel;
        const cardId = player.handCards.splice(index, 1)[0];
        const card = TableCard.getConfigById(cardId)!;
        player.diceUsed.push(...usedDiceIndexes);
        player.diceLocked = player.diceLocked.filter(index => !usedDiceIndexes.includes(index));
        player.resolvingCards.push(cardId);
        const context = this.ent.BattleValueResolver.context(BattleSide.Player, cardId,
            card.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy);
        this.ent.BattleBll.refresh();
        try {
            await this.runCardEvent(cardId, 'ON_PLAY', context);
            if (context.runId !== model.runId) {
                return;
            }
            await this.ent.BattleTriggerBll.fire('ON_CARD_PLAYED', BattleSide.Player, { cardId, type: card.type });
            if (context.runId !== model.runId) {
                return;
            }
            await this.ent.BattleTriggerBll.fire(`ON_${card.type}_PLAYED`, BattleSide.Player, { cardId, type: card.type });
        } catch (error) {
            if (context.runId === model.runId) {
                this.ent.BattleBll.fail(error);
            }
        } finally {
            if (context.runId !== model.runId) {
                return;
            }
            try {
                player.resolvingCards.splice(player.resolvingCards.indexOf(cardId), 1);
                if (card.flags.exhaust || context.variables.exhaustThisCard) {
                    player.exhaustPile.push(cardId);
                    await this.runCardEvent(cardId, 'ON_EXHAUSTED', context);
                    await this.ent.BattleTriggerBll.fire('ON_EXHAUST', BattleSide.Player, { cardId, type: card.type });
                } else if (card.type === 'POWER') {
                    player.powerPile.push(cardId);
                } else {
                    player.discardPile.push(cardId);
                }
                this.ent.BattleBuffBll.clearAction();
                await this.ent.BattleBll.finishResult();
            } catch (error) {
                this.ent.BattleBll.fail(error);
            } finally {
                model.busy = false;
                this.ent.BattleBll.refresh();
            }
        }
    }

    async drawOne(recycle: boolean): Promise<boolean> {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        if (this.ent.BattleBll.isFinished() || player.handCards.length >= player.handLimit) {
            return false;
        }
        if (!player.drawPile.length && recycle && player.discardPile.length) {
            player.drawPile = this.shuffle(player.discardPile.splice(0));
            await this.ent.BattleTriggerBll.fire('ON_SHUFFLE', BattleSide.Player);
        }
        if (this.ent.BattleBll.isFinished(runId)) {
            return false;
        }
        const cardId = player.drawPile.shift();
        if (!cardId || this.ent.BattleBll.isFinished()) {
            return false;
        }
        player.handCards.push(cardId);
        await this.runCardEvent(cardId, 'ON_DRAWN');
        if (runId !== this.ent.BattleModel.runId) {
            return false;
        }
        await this.ent.BattleTriggerBll.fire('ON_CARD_DRAWN', BattleSide.Player, { cardId });
        return true;
    }

    /** 回合开始时补足手牌，保留牌会占用手牌上限 */
    async fillHand() {
        const player = this.ent.BattlePlayerModel;
        let remaining = player.drawPile.length + player.discardPile.length;
        while (remaining-- > 0 && player.handCards.length < player.handLimit) {
            if (!await this.drawOne(true)) {
                break;
            }
        }
    }

    async draw() {
        const model = this.ent.BattleModel;
        const player = this.ent.BattlePlayerModel;
        if (model.busy || model.phase !== BattlePhase.PlayerAction || this.ent.BattleBll.isFinished()
            || player.energy <= 0 || player.handCards.length >= player.handLimit
            || (!player.drawPile.length && !player.discardPile.length)) {
            return false;
        }
        const runId = model.runId;
        model.busy = true;
        model.message = '';
        player.energy--;
        try {
            return await this.drawOne(true);
        } catch (error) {
            if (runId === model.runId) {
                this.ent.BattleBll.fail(error);
            }
            return false;
        } finally {
            if (runId === model.runId) {
                model.busy = false;
                await this.ent.BattleBll.finishResult();
                this.ent.BattleBll.refresh();
            }
        }
    }

    async endTurn() {
        const runId = this.ent.BattleModel.runId;
        const player = this.ent.BattlePlayerModel;
        for (const cardId of [...player.handCards]) {
            await this.runCardEvent(cardId, 'ON_TURN_END_IN_HAND');
            if (this.ent.BattleBll.isFinished(runId)) {
                return;
            }
            const index = player.handCards.indexOf(cardId);
            if (index < 0) {
                continue;
            }
            const card = TableCard.getConfigById(cardId)!;
            if (card.flags.ethereal) {
                await this.moveFromHand(index, true);
            } else if (card.flags.retain) {
                await this.runCardEvent(cardId, 'ON_RETAINED');
            } else {
                await this.moveFromHand(index, false);
            }
        }
    }

    async moveFromHand(index: number, exhaust: boolean) {
        const player = this.ent.BattlePlayerModel;
        const cardId = player.handCards.splice(index, 1)[0];
        if (!cardId) {
            return;
        }
        (exhaust ? player.exhaustPile : player.discardPile).push(cardId);
        await this.runCardEvent(cardId, exhaust ? 'ON_EXHAUSTED' : 'ON_DISCARDED');
        await this.ent.BattleTriggerBll.fire(exhaust ? 'ON_EXHAUST' : 'ON_DISCARD', BattleSide.Player, { cardId });
        this.ent.BattleBll.refresh();
    }

    async discard(count: number, mode: string, exhaust = false, filter: Record<string, unknown> = {}) {
        const player = this.ent.BattlePlayerModel;
        let remaining = Math.min(count, player.handCards.length);
        while (remaining-- > 0 && !this.ent.BattleBll.isFinished()) {
            const candidates = player.handCards.map((cardId, index) => ({ card: TableCard.getConfigById(cardId)!, index }))
                .filter(item => (!filter.type || item.card.type === filter.type) && (!filter.id || item.card.id === filter.id));
            if (!candidates.length) {
                return;
            }
            const selected = mode === 'SELECT'
                ? await this.ent.BattleEffectBll.choose(exhaust ? '选择消耗的手牌' : '选择弃置的手牌', candidates.map(item => `${item.card.name}：${item.card.des}`))
                : mode === 'RANDOM' ? Math.floor(Math.random() * candidates.length) : 0;
            if (selected < 0) {
                return;
            }
            await this.moveFromHand(candidates[selected].index, exhaust);
        }
    }

    async runCardEvent(cardId: number, event: string, context?: BattleContext) {
        const card = TableCard.getConfigById(cardId);
        const effects: BattleEffect[] = card?.effect || [];
        const cardContext = context || this.ent.BattleValueResolver.context(BattleSide.Player, cardId,
            card?.target === 'SELF' ? BattleSide.Player : BattleSide.Enemy);
        const activeEvents = cardContext.activeCardEvents || [];
        const eventKey = `${cardId}:${event}`;
        if (activeEvents.includes(eventKey)) {
            return;
        }
        cardContext.activeCardEvents = activeEvents;
        activeEvents.push(eventKey);
        try {
            await this.ent.BattleEffectBll.execute(effects.filter(effect => (effect.trigger || 'ON_PLAY') === event), cardContext,
                event === 'ON_KILL_WITH_THIS_CARD');
            if (cardContext.runId !== this.ent.BattleModel.runId) {
                return;
            }
            if (cardContext.variables.exhaustThisCard && !this.ent.BattlePlayerModel.resolvingCards.includes(cardId)) {
                const index = this.ent.BattlePlayerModel.handCards.indexOf(cardId);
                if (index >= 0) {
                    await this.moveFromHand(index, true);
                }
            }
        } finally {
            activeEvents.pop();
        }
    }

    async triggerCards(event: string, owner: BattleSide) {
        if (owner !== BattleSide.Player || event !== 'ON_COMBAT_START') {
            return;
        }
        for (const id of [...this.ent.BattlePlayerModel.drawPile]) {
            await this.runCardEvent(id, event);
        }
    }
}
