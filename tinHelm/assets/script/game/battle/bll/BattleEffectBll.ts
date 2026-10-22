import { smc } from '../../common/SingletonModuleComp';
import { TableCard } from '../../common/table/TableCard';
import { CardEvent, BattleTriggerEvent } from './BattleCardBll';
import { BattleEffectTypeEnum } from '../../common/table/BattleEffectTypeEnum';
import { TableBattleEffect } from '../../common/table/TableBattleEffect';
import { TableBattleBuff, BattleBuffRuleKind } from '../../common/table/TableBattleBuff';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleEffect, BattleEventData, BattleSide } from '../model/BattleTypes';
/** JSON 顺序解释器；选择节点等待界面确认后继续同一条结算链。 */
export class BattleEffectBll extends CCBusiness<Battle> {
    // 校验效果类型、状态编号和嵌套结构。
    validateEffects(effects: BattleEffect[], depth = 0): void {
        if (depth > 20 || !Array.isArray(effects)) {
            throw new Error('效果 JSON 嵌套过深或格式错误');
        }
        for (const effect of effects) {
            if (!effect.params || !Array.isArray(effect.children) || !Array.isArray(effect.elseEffects)) {
                throw new Error('效果缺少参数或分支');
            }
            if (effect.target !== 'SELF' && effect.target !== 'ENEMY') {
                throw new Error('效果目标无效：' + effect.target);
            }
            if (!TableBattleEffect.isEffectId(effect.type)) {
                throw new Error(`战斗尚不支持效果：${effect.type}，请调整该卡配置`);
            }
            if ([BattleEffectTypeEnum.APPLY_STATUS, BattleEffectTypeEnum.REMOVE_STATUS, BattleEffectTypeEnum.MULTIPLY_STATUS].includes(effect.type)) {
                if (effect.type !== BattleEffectTypeEnum.REMOVE_STATUS || effect.params.status !== 'ALL') {
                    TableBattleBuff.requireBuffId(effect.params.status);
                }
            }
            if (effect.type === BattleEffectTypeEnum.MODIFY_STAT) {
                const stat = effect.params.stat;
                if (stat !== 'HP' && stat !== 'MAX_HP' && stat !== 'BLOCK') {
                    TableBattleBuff.requireBuffId(stat);
                }
            }
            if ([BattleEffectTypeEnum.MODIFY_CARD_VALUE, BattleEffectTypeEnum.GAIN_ENERGY, BattleEffectTypeEnum.DRAW,
                BattleEffectTypeEnum.RETAIN_BLOCK, BattleEffectTypeEnum.FREE_DICE,
                BattleEffectTypeEnum.MOVE_CARD, BattleEffectTypeEnum.COPY_CARD, BattleEffectTypeEnum.PLAY_CARD,
                BattleEffectTypeEnum.TRANSFORM_CARD, BattleEffectTypeEnum.GENERATE_CARD,
                BattleEffectTypeEnum.GROW_CARD, BattleEffectTypeEnum.CARD_RULE].includes(effect.type)
                && effect.target !== 'SELF') {
                throw new Error('该效果只支持 SELF：' + effect.type);
            }
            if ([BattleEffectTypeEnum.DRAW, BattleEffectTypeEnum.GAIN_ENERGY].includes(effect.type)) {
                const key = effect.type === BattleEffectTypeEnum.DRAW ? 'count' : 'amount';
                const value = effect.params[key];
                if (typeof value === 'number' ? !Number.isSafeInteger(value) || value < 0 : typeof value !== 'string' || !value.trim()) {
                    throw new Error(`抽牌或补充能量的 ${key} 必须是非负整数或数值表达式`);
                }
            }
            if (effect.type === BattleEffectTypeEnum.EXHAUST && effect.params.zone && effect.params.zone !== 'HAND') {
                throw new Error('EXHAUST 当前仅支持 HAND');
            }
            this.validateEffects(effect.children, depth + 1);
            this.validateEffects(effect.elseEffects, depth + 1);
        }
    }
    // 等待多段伤害、事件和选择效果按配置顺序完成。
    async executeEffects(effects: BattleEffect[], context: BattleContext, allowFinished = false): Promise<void> {
        for (const effect of effects) {
            if (context.runId !== this.ent.BattleModel.runId || this.ent.BattleModel.closed
                || (!allowFinished && this.ent.BattleBll.isBattleFinished())
                || !this.ent.BattleBuffBll.isContextActive(context)) {
                return;
            }
            if (effect.type !== BattleEffectTypeEnum.IF && !this.ent.BattleValueResolver.checkCondition(effect.condition, context)) {
                continue;
            }
            await this.executeEffect(effect, context, allowFinished);
            if (context.runId === this.ent.BattleModel.runId) {
                this.ent.BattleBll.checkResult();
                this.ent.BattleBll.refreshBattleView();
            }
        }
    }
    // 等待当前效果引起的事件结算完成后，才继续下一个节点。
    private async executeEffect(effect: BattleEffect, context: BattleContext, allowFinished: boolean): Promise<void> {
        const resolver = this.ent.BattleValueResolver;
        const buffs = this.ent.BattleBuffBll;
        const damage = this.ent.BattleDamageBll;
        const target = resolver.resolveTargetSide(effect.target, context);
        const actor = resolver.getActor(target);
        const params = effect.params;
        const children = effect.children;
        const readNumberParam = (key: string): number => {
            return resolver.resolveNumber(params[key], context);
        };
        const readTextParam = (key: string): string => {
            const value = params[key];
            if (typeof value !== 'string' || !value) {
                throw new Error(`效果文本参数缺失：${effect.type}.${key}`);
            }
            return value;
        };
        const readAmount = (): number => {
            return params.amount === 'ALL' ? Infinity : readNumberParam('amount');
        };
        const status = params.status;
        switch (effect.type) {
            case BattleEffectTypeEnum.DAMAGE: {
                const hits = Math.min(100, Math.max(0, Math.floor(readNumberParam('hits'))));
                context.variables.totalHpLoss = 0;
                for (let hit = 0; hit < hits && !this.ent.BattleBll.isBattleFinished(); hit++) {
                    const damageKind = readTextParam('damageKind');
                    const cardDamage = context.cardPlay && damageKind === 'ATTACK'
                        ? context.variables.cardDamageBonus + context.variables.nextCardDamageBonus : 0;
                    const instanceBonus = damageKind === 'ATTACK' ? this.ent.BattlePlayerModel.cardGrowth.get(context.cardId) || 0 : 0;
                    if (context.cardPlay && damageKind === 'ATTACK') {
                        context.variables.nextCardDamageBonus = 0;
                    }
                    const loss = await damage.applyDamage(context.source, target, readNumberParam('amount') + cardDamage + instanceBonus, damageKind, params.ignoreBlock === true, context);
                    context.variables.lastDamage = loss;
                    context.variables.totalHpLoss = context.variables.totalHpLoss + loss;
                    if (context.cardId && loss > 0) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, CardEvent.HitUnblocked, context);
                    }
                    if (context.cardId && actor.hp <= 0) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, CardEvent.KillWithThisCard, context);
                    }
                }
                break;
            }
            case BattleEffectTypeEnum.BLOCK: {
                const player = this.ent.BattlePlayerModel;
                const cardBlock = context.cardPlay && target === context.source && readAmount() > 0;
                const bonus = cardBlock ? player.cardBlockBonus + player.nextCardBlockBonus : 0;
                let multiplier = 1;
                if (cardBlock && player.cardBlocksThisTurn === 0 && buffs.getRuleValue(context.source, BattleBuffRuleKind.FirstBlockDouble)) {
                    multiplier = Math.pow(2, buffs.getRuleValue(context.source, BattleBuffRuleKind.FirstBlockDouble));
                }
                if (cardBlock && readAmount() + bonus > 0) {
                    player.cardBlocksThisTurn++;
                }
                const gained = await damage.addBlock(target, readAmount() + bonus, params.scale !== false, multiplier);
                if (cardBlock && gained > 0) {
                    player.nextCardBlockBonus = 0;
                    context.variables.cardBlockGained = context.variables.cardBlockGained + gained;
                }
                break;
            }
            case BattleEffectTypeEnum.MODIFY_CARD_VALUE:
                this.ent.BattleEquipmentBll.modifyCardValue(readTextParam('kind'), readAmount(), readTextParam('timing'));
                break;
            case BattleEffectTypeEnum.GAIN_ENERGY:
                await this.ent.BattleEquipmentBll.changeEnergy(Math.max(0, Math.floor(readNumberParam('amount'))), 'EFFECT');
                break;
            case BattleEffectTypeEnum.DRAW:
                await this.ent.BattleCardBll.drawExtraCards(readNumberParam('count'), params.untilNonAttack === true);
                break;
            case BattleEffectTypeEnum.RETAIN_BLOCK:
                this.ent.BattlePlayerModel.retainedBlockLimit = Math.max(0, this.ent.BattlePlayerModel.retainedBlockLimit + Math.floor(readAmount()));
                break;
            case BattleEffectTypeEnum.FREE_DICE:
                this.ent.BattleEquipmentBll.grantFreeDice(readNumberParam('count'), readTextParam('scope'));
                break;
            case BattleEffectTypeEnum.HEAL:
                damage.restoreHp(target, readAmount());
                break;
            case BattleEffectTypeEnum.LOSE_HP:
                await damage.applyDamage(context.source, target, params.canKill === true ? readAmount() : Math.min(readAmount(), Math.max(0, actor.hp - 1)), 'HP_LOSS', true);
                break;
            case BattleEffectTypeEnum.KILL_IF:
                if (actor.hp <= readNumberParam('threshold')) {
                    await damage.applyDamage(context.source, target, actor.hp, 'HP_LOSS', true);
                    if (context.cardId) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, CardEvent.KillWithThisCard, context);
                    }
                }
                break;
            case BattleEffectTypeEnum.APPLY_STATUS: {
                const id = TableBattleBuff.requireBuffId(status);
                const previous = resolver.getBuffStacks(target, id);
                await buffs.addBuff(target, id, readNumberParam('stacks'), readTextParam('duration'), context);
                if (resolver.getBuffStacks(target, id) > previous) {
                    await this.ent.BattleTriggerBll.fireEvent(BattleTriggerEvent.StatusApplied, context.source, { status: id, target });
                }
                break;
            }
            case BattleEffectTypeEnum.REMOVE_STATUS:
                buffs.removeBuff(target, status === 'ALL' ? 'ALL' : TableBattleBuff.requireBuffId(status), params.stacks === 'ALL' ? Infinity : readNumberParam('stacks'));
                break;
            case BattleEffectTypeEnum.MULTIPLY_STATUS: {
                buffs.multiplyBuffStacks(target, TableBattleBuff.requireBuffId(status), readNumberParam('factor'));
                break;
            }
            case BattleEffectTypeEnum.CLEANSE:
                buffs.cleanseDebuffs(target);
                break;
            case BattleEffectTypeEnum.MODIFY_STAT: {
                const stat = params.stat;
                if (stat === 'HP') {
                    if (readAmount() >= 0) {
                        damage.restoreHp(target, readAmount());
                    }
                    else {
                        await damage.applyDamage(context.source, target, -readAmount(), 'HP_LOSS', true);
                    }
                }
                else if (stat === 'MAX_HP') {
                    const gained = Math.max(1, actor.maxHp + readAmount()) - actor.maxHp;
                    actor.maxHp += gained;
                    actor.hp = Math.min(actor.hp, actor.maxHp);
                    if (params.persistent === true && target === BattleSide.Player) {
                        smc.player.PlayerModel.maxHp += gained;
                    }
                }
                else if (stat === 'BLOCK') {
                    actor.block = Math.max(0, Math.floor(actor.block + readAmount()));
                }
                else {
                    await buffs.addBuff(target, TableBattleBuff.requireBuffId(stat), readAmount(), readTextParam('duration'), context);
                }
                break;
            }
            case BattleEffectTypeEnum.IF:
                await this.executeEffects(resolver.checkCondition(effect.condition, context) ? children : effect.elseEffects, context, allowFinished);
                break;
            case BattleEffectTypeEnum.SEQUENCE:
                await this.executeEffects(children, context, allowFinished);
                break;
            case BattleEffectTypeEnum.REPEAT: {
                const count = Math.max(0, Math.min(100, readNumberParam('maxIterations'), Math.floor(readNumberParam('count'))));
                for (let index = 0; index < count; index++) {
                    await this.executeEffects(children, context, allowFinished);
                }
                break;
            }
            case BattleEffectTypeEnum.REGISTER_TRIGGER:
                this.ent.BattleTriggerBll.registerTrigger(params.event!, children, context, readTextParam('scope'), readNumberParam('limit'), this.readEventFilter(params.filter));
                break;
            case BattleEffectTypeEnum.SCHEDULE:
                this.ent.BattleTriggerBll.scheduleEffects(readTextParam('when'), readNumberParam('times'), children, context);
                break;
            case BattleEffectTypeEnum.CHOOSE_ONE: {
                const options = children.slice(0, Math.max(1, readNumberParam('showCount')));
                const choices = Math.min(options.length, Math.max(1, readNumberParam('maxChoices')));
                for (let count = 0; count < choices; count++) {
                    const index = await this.chooseEffect('选择卡牌效果', options.map(option => {
                        return this.describeEffect(option);
                    }));
                    if (index < 0) {
                        return;
                    }
                    const selected = options.splice(index, 1)[0];
                    await this.executeEffects([selected], context, allowFinished);
                }
                break;
            }
            case BattleEffectTypeEnum.DISCARD:
            case BattleEffectTypeEnum.EXHAUST:
                context.variables.exhaustedCount = 0;
                context.variables.exhaustedDamage = 0;
                await this.ent.BattleCardBll.discardCards(params.count === 'ALL' ? Infinity : readNumberParam('count'),
                    readTextParam('mode'), effect.type === BattleEffectTypeEnum.EXHAUST,
                    this.readEventFilter(params.filter), context, children);
                break;
            case BattleEffectTypeEnum.GAIN_GOLD:
                this.ent.BattleModel.gold += Math.max(0, Math.floor(readAmount()));
                break;
            case BattleEffectTypeEnum.MOVE_CARD:
                await this.ent.BattleCardBll.moveCard(readTextParam('pile'), readTextParam('destination'), readTextParam('mode'), context);
                break;
            case BattleEffectTypeEnum.PLAY_CARD:
                await this.ent.BattleCardBll.moveCard(readTextParam('pile'), 'PLAY', readTextParam('mode'), context, params.exhaustAfter === true);
                break;
            case BattleEffectTypeEnum.COPY_CARD:
                this.ent.BattleCardBll.addCard(params.source === 'EVENT' ? Number(context.event.cardId) : context.cardId, 1, readTextParam('pile'));
                break;
            case BattleEffectTypeEnum.GROW_CARD: {
                const growth = this.ent.BattlePlayerModel.cardGrowth;
                growth.set(context.cardId, (growth.get(context.cardId) || 0) + readAmount());
                break;
            }
            case BattleEffectTypeEnum.TRANSFORM_CARD: {
                const player = this.ent.BattlePlayerModel;
                player.handCards = player.handCards.map(id => {
                    return params.type === 'ALL' || this.ent.BattleCardBll.getCard(id).type === params.type
                        ? this.ent.BattleCardBll.createInstance(readNumberParam('cardId')) : id;
                });
                break;
            }
            case BattleEffectTypeEnum.GENERATE_CARD: {
                const player = this.ent.BattlePlayerModel;
                const pool = TableCard.getAllConfig().filter(card => {
                    return card.role === player.playerId && card.isNormalReward() && (params.type === 'ALL' || card.type === params.type);
                });
                const count = Math.min(player.handLimit - player.handCards.length, Math.max(0, Math.floor(readNumberParam('count'))));
                for (let index = 0; index < count && pool.length; index++) {
                    const card = pool[Math.floor(Math.random() * pool.length)];
                    const id = this.ent.BattleCardBll.createInstance(card.id);
                    player.handCards.push(id);
                    if (params.freeThisTurn === true) {
                        player.freeInstanceTurns.set(id, this.ent.BattleModel.turn);
                    }
                }
                break;
            }
            case BattleEffectTypeEnum.CARD_RULE: {
                const player = this.ent.BattlePlayerModel;
                const kind = readTextParam('kind');
                const amount = readAmount();
                switch (kind) {
                    case 'LOCK_DRAW':
                        player.drawLocked = true;
                        break;
                    case 'LOCK_ENERGY':
                        player.energyLocked = true;
                        break;
                    case 'NEXT_ATTACK_FREE':
                        player.nextAttackFree += amount;
                        break;
                    case 'NEXT_ATTACK_REPEAT':
                        player.nextAttackRepeats += amount;
                        break;
                    default:
                        throw new Error('不支持的卡牌规则：' + kind);
                }
                break;
            }
            case BattleEffectTypeEnum.SET_VARIABLE:
            case BattleEffectTypeEnum.MODIFY_VARIABLE: {
                const variable = readTextParam('name');
                const name = context.equipmentKey ? context.equipmentKey + '.' + variable : variable;
                const scope = readTextParam('scope');
                const variables = scope === 'COMBAT' ? this.ent.BattleModel.combatVariables
                    : scope === 'TURN' ? this.ent.BattleModel.turnVariables : context.variables;
                const value = readNumberParam('value');
                if (!Object.prototype.hasOwnProperty.call(variables, name)) {
                    variables[name] = 0;
                }
                const previous = variables[name];
                switch (effect.type === BattleEffectTypeEnum.SET_VARIABLE ? 'SET' : readTextParam('operator')) {
                    case 'ADD':
                        variables[name] = previous + value;
                        break;
                    case 'MULTIPLY':
                        variables[name] = previous * value;
                        break;
                    case 'MIN':
                        variables[name] = Math.min(previous, value);
                        break;
                    case 'MAX':
                        variables[name] = Math.max(previous, value);
                        break;
                    default:
                        variables[name] = value;
                        break;
                }
                break;
            }
            default:
                throw new Error(`未实现的效果：${effect.type}`);
        }
    }
    // 读取触发事件使用的筛选条件。
    private readEventFilter(value: BattleEventData | undefined): BattleEventData {
        const result: BattleEventData = {};
        if (typeof value === 'object' && value && !Array.isArray(value)) {
            for (const [key, entry] of Object.entries(value)) {
                result[key] = entry;
            }
        }
        return result;
    }
    // 等待玩家确认效果选择。
    chooseEffect(title: string, options: string[]): Promise<number> {
        if (!options.length || this.ent.BattleBll.isBattleFinished()) {
            return Promise.resolve(-1);
        }
        return new Promise(resolve => {
            this.ent.BattleModel.choice = { title, options, resolve };
            this.ent.BattleBll.refreshBattleView();
        });
    }
    // 确认选中的效果并恢复等待的结算。
    selectEffect(index: number): void {
        const choice = this.ent.BattleModel.choice;
        if (!choice || index < 0 || index >= choice.options.length) {
            return;
        }
        this.ent.BattleModel.choice = null;
        choice.resolve(index);
        this.ent.BattleBll.refreshBattleView();
    }
    // 生成单个效果的显示文本。
    describeEffect(effect: BattleEffect): string {
        if (effect.note) {
            return effect.note;
        }
        const name = TableBattleEffect.requireEffectConfig(effect.type).name;
        const children = effect.children.map(child => {
            return this.describeEffect(child);
        }).join('；');
        if (children) {
            return name + '（' + children + '）';
        }
        const params = effect.params;
        if (effect.type === BattleEffectTypeEnum.DRAW) {
            return name + ' ' + params.count + ' 张';
        }
        if (effect.type === BattleEffectTypeEnum.GAIN_ENERGY) {
            return name + ' ' + params.amount + ' 点';
        }
        if (effect.type === BattleEffectTypeEnum.APPLY_STATUS) {
            return name + '：' + this.ent.BattleBuffBll.getBuffName(TableBattleBuff.requireBuffId(params.status)) + ' ' + params.stacks + '层';
        }
        return params.amount === undefined ? name : name + ' ' + params.amount;
    }
}
