import { CardEvent } from './BattleCardBll';
import { BattleEffectTypeEnum } from '../../common/table/BattleEffectTypeEnum';
import { TableBattleEffect } from '../../common/table/TableBattleEffect';
import { TableBattleBuff } from '../../common/table/TableBattleBuff';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleEffect, BattleEventData } from '../model/BattleTypes';
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
            if ([BattleEffectTypeEnum.APPLY_STATUS, BattleEffectTypeEnum.REMOVE_STATUS, BattleEffectTypeEnum.MULTIPLY_STATUS, BattleEffectTypeEnum.TRANSFER_STATUS].includes(effect.type)) {
                if (effect.type !== BattleEffectTypeEnum.REMOVE_STATUS || effect.params.status !== 'ALL') {
                    TableBattleBuff.requireBuffId(effect.params.status);
                }
            }
            if ([BattleEffectTypeEnum.MODIFY_STAT, BattleEffectTypeEnum.SET_STAT, BattleEffectTypeEnum.DOUBLE_STAT].includes(effect.type)) {
                const stat = effect.params.stat;
                if (stat !== 'HP' && stat !== 'MAX_HP' && stat !== 'BLOCK') {
                    TableBattleBuff.requireBuffId(stat);
                }
            }
            if ([BattleEffectTypeEnum.MODIFY_CARD_VALUE, BattleEffectTypeEnum.GAIN_ENERGY, BattleEffectTypeEnum.DRAW, BattleEffectTypeEnum.RETAIN_BLOCK, BattleEffectTypeEnum.FREE_DICE].includes(effect.type)
                && effect.target !== 'SELF') {
                throw new Error('该装备效果只支持 SELF：' + effect.type);
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
                || (!allowFinished && this.ent.BattleBll.isBattleFinished())) {
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
                    if (context.cardPlay && damageKind === 'ATTACK') {
                        context.variables.nextCardDamageBonus = 0;
                    }
                    const loss = await damage.applyDamage(context.source, target, readNumberParam('amount') + cardDamage, damageKind, params.ignoreBlock === true, context);
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
                const gained = damage.addBlock(target, readAmount() + bonus, params.scale !== false);
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
                await this.ent.BattleEquipmentBll.changeEnergy(readAmount(), 'EFFECT');
                break;
            case BattleEffectTypeEnum.DRAW:
                await this.ent.BattleCardBll.drawExtraCards(readNumberParam('count'));
                break;
            case BattleEffectTypeEnum.RETAIN_BLOCK:
                this.ent.BattlePlayerModel.retainedBlockLimit = Math.max(0, this.ent.BattlePlayerModel.retainedBlockLimit + Math.floor(readAmount()));
                break;
            case BattleEffectTypeEnum.FREE_DICE:
                this.ent.BattleEquipmentBll.grantFreeDice(readNumberParam('count'), readTextParam('scope'));
                break;
            case BattleEffectTypeEnum.BLOCK_NEXT_TURN:
                this.ent.BattleTriggerBll.scheduleEffects('NEXT_TURN_START', 1, [{ type: BattleEffectTypeEnum.BLOCK, target: effect.target, params: { amount: readAmount(), scale: true }, children: [], elseEffects: [] }], context);
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
            case BattleEffectTypeEnum.MULTIPLY_BLOCK:
                actor.block = Math.max(0, Math.floor(actor.block * readNumberParam('factor')));
                break;
            case BattleEffectTypeEnum.REMOVE_BLOCK:
            case BattleEffectTypeEnum.PIERCE_BLOCK:
                actor.block = Math.max(0, actor.block - (params.amount === 'ALL' ? actor.block : readAmount()));
                break;
            case BattleEffectTypeEnum.APPLY_STATUS:
                buffs.addBuff(target, TableBattleBuff.requireBuffId(status), readNumberParam('stacks'), readTextParam('duration'));
                break;
            case BattleEffectTypeEnum.REMOVE_STATUS:
                buffs.removeBuff(target, status === 'ALL' ? 'ALL' : TableBattleBuff.requireBuffId(status), params.stacks === 'ALL' ? Infinity : readNumberParam('stacks'));
                break;
            case BattleEffectTypeEnum.MULTIPLY_STATUS: {
                buffs.multiplyBuffStacks(target, TableBattleBuff.requireBuffId(status), readNumberParam('factor'));
                break;
            }
            case BattleEffectTypeEnum.TRANSFER_STATUS: {
                const stacks = Math.min(resolver.getBuffStacks(target, TableBattleBuff.requireBuffId(status)), params.amount === 'ALL' ? Infinity : readAmount());
                buffs.removeBuff(target, TableBattleBuff.requireBuffId(status), stacks);
                buffs.addBuff(resolver.resolveTargetSide(readTextParam('destination'), context), TableBattleBuff.requireBuffId(status), stacks);
                break;
            }
            case BattleEffectTypeEnum.CLEANSE:
                buffs.cleanseDebuffs(target);
                break;
            case BattleEffectTypeEnum.SET_INTANGIBLE:
                buffs.addBuff(target, BattleBuffTypeEnum.INTANGIBLE, readNumberParam('stacks'));
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
                    actor.maxHp = Math.max(1, actor.maxHp + readAmount());
                    actor.hp = Math.min(actor.hp, actor.maxHp);
                }
                else if (stat === 'BLOCK') {
                    actor.block = Math.max(0, Math.floor(actor.block + readAmount()));
                }
                else {
                    buffs.addBuff(target, TableBattleBuff.requireBuffId(stat), readAmount(), readTextParam('duration'));
                }
                break;
            }
            case BattleEffectTypeEnum.SET_STAT:
            case BattleEffectTypeEnum.DOUBLE_STAT: {
                const stat = params.stat;
                const current = stat === 'BLOCK' ? actor.block : stat === 'HP' ? actor.hp : stat === 'MAX_HP' ? actor.maxHp : resolver.getBuffStacks(target, TableBattleBuff.requireBuffId(stat));
                const value = effect.type === BattleEffectTypeEnum.DOUBLE_STAT
                    ? current * 2
                    : readNumberParam('value');
                if (stat === 'BLOCK') {
                    actor.block = Math.max(0, Math.floor(value));
                }
                else if (stat === 'HP') {
                    actor.hp = Math.min(actor.maxHp, Math.max(0, Math.floor(value)));
                }
                else if (stat === 'MAX_HP') {
                    actor.maxHp = Math.max(1, Math.floor(value));
                    actor.hp = Math.min(actor.hp, actor.maxHp);
                }
                else {
                    buffs.removeBuff(target, TableBattleBuff.requireBuffId(stat));
                    buffs.addBuff(target, TableBattleBuff.requireBuffId(stat), value, 'COMBAT');
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
            case BattleEffectTypeEnum.RANDOM_CHOICE: {
                const options = [...children];
                const count = Math.min(100, Math.max(0, readNumberParam('count')));
                for (let index = 0; index < count && options.length; index++) {
                    const selected = Math.floor(Math.random() * options.length);
                    await this.executeEffects([options[selected]], context, allowFinished);
                    if (params.unique !== false) {
                        options.splice(selected, 1);
                    }
                }
                break;
            }
            case BattleEffectTypeEnum.DISCARD:
            case BattleEffectTypeEnum.EXHAUST:
            case BattleEffectTypeEnum.DISCARD_HAND:
            case BattleEffectTypeEnum.EXHAUST_HAND:
                await this.ent.BattleCardBll.discardCards(params.count === 'ALL' || [BattleEffectTypeEnum.DISCARD_HAND, BattleEffectTypeEnum.EXHAUST_HAND].includes(effect.type) ? Infinity : readNumberParam('count'), [BattleEffectTypeEnum.DISCARD_HAND, BattleEffectTypeEnum.EXHAUST_HAND].includes(effect.type) ? 'ALL' : readTextParam('mode'), [BattleEffectTypeEnum.EXHAUST, BattleEffectTypeEnum.EXHAUST_HAND].includes(effect.type), this.readEventFilter(params.filter));
                break;
            case BattleEffectTypeEnum.ADD_CARD:
                this.ent.BattleCardBll.addCard(readNumberParam('cardId'), readNumberParam('count'), readTextParam('pile'));
                break;
            case BattleEffectTypeEnum.EXHAUST_THIS_CARD:
                context.variables.exhaustThisCard = 1;
                break;
            case BattleEffectTypeEnum.GAIN_GOLD:
            case BattleEffectTypeEnum.LOSE_GOLD:
                this.ent.BattleModel.gold = Math.max(0, this.ent.BattleModel.gold
                    + Math.max(0, Math.floor(readAmount())) * (effect.type === BattleEffectTypeEnum.GAIN_GOLD ? 1 : -1));
                break;
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
        if (effect.type === BattleEffectTypeEnum.APPLY_STATUS) {
            return name + '：' + this.ent.BattleBuffBll.getBuffName(TableBattleBuff.requireBuffId(params.status)) + ' ' + params.stacks + '层';
        }
        return params.amount === undefined ? name : name + ' ' + params.amount;
    }
}
