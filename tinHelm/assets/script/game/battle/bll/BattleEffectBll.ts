import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleContext, BattleEffect } from '../model/BattleTypes';

/** JSON 顺序解释器；选择节点等待界面确认后继续同一条结算链。 */
export class BattleEffectBll extends CCBusiness<Battle> {
    private readonly supported = [
        'DAMAGE', 'BLOCK', 'HEAL', 'LOSE_HP', 'KILL_IF', 'MULTIPLY_BLOCK', 'REMOVE_BLOCK', 'PIERCE_BLOCK',
        'BLOCK_NEXT_TURN', 'APPLY_STATUS', 'REMOVE_STATUS', 'MULTIPLY_STATUS', 'TRANSFER_STATUS', 'CLEANSE',
        'MODIFY_STAT', 'SET_STAT', 'DOUBLE_STAT', 'SET_INTANGIBLE', 'IF', 'SEQUENCE', 'REPEAT',
        'REGISTER_TRIGGER', 'SCHEDULE', 'CHOOSE_ONE', 'RANDOM_CHOICE', 'DISCARD', 'EXHAUST',
        'DISCARD_HAND', 'EXHAUST_HAND', 'EXHAUST_THIS_CARD', 'GAIN_GOLD', 'LOSE_GOLD',
        'SET_VARIABLE', 'MODIFY_VARIABLE', 'ADD_CARD'
    ];

    validate(effects: BattleEffect[], depth = 0) {
        if (depth > 20 || !Array.isArray(effects)) {
            throw new Error('效果 JSON 嵌套过深或格式错误');
        }
        for (const effect of effects) {
            if (!this.supported.includes(effect.type)) {
                throw new Error(`战斗尚不支持效果：${effect.type}，请调整该卡配置`);
            }
            if (effect.type === 'EXHAUST' && effect.params?.zone && effect.params.zone !== 'HAND') {
                throw new Error('EXHAUST 当前仅支持 HAND');
            }
            this.validate(effect.children || [], depth + 1);
            this.validate(effect.elseEffects || [], depth + 1);
        }
    }

    async execute(effects: BattleEffect[], context: BattleContext, allowFinished = false): Promise<void> {
        for (const effect of effects) {
            if (context.runId !== this.ent.BattleModel.runId || this.ent.BattleModel.closed
                || (!allowFinished && this.ent.BattleBll.isFinished())) {
                return;
            }
            if (effect.type !== 'IF' && !this.ent.BattleValueResolver.condition(effect.condition, context)) {
                continue;
            }
            await this.executeOne(effect, context, allowFinished);
            if (context.runId === this.ent.BattleModel.runId) {
                this.ent.BattleBll.checkResult();
                this.ent.BattleBll.refresh();
            }
        }
    }

    private async executeOne(effect: BattleEffect, context: BattleContext, allowFinished: boolean) {
        const resolver = this.ent.BattleValueResolver;
        const buffs = this.ent.BattleBuffBll;
        const damage = this.ent.BattleDamageBll;
        const target = resolver.target(effect.target, context);
        const actor = resolver.actor(target);
        const params = effect.params || {};
        const children = effect.children || [];
        const number = (key: string, fallback = 0) => {
            return resolver.number(params[key], context, fallback);
        };
        const text = (key: string, fallback = '') => {
            return typeof params[key] === 'string' ? String(params[key]) : fallback;
        };
        const amount = params.amount === 'ALL' ? Infinity : number('amount');
        const status = text('status').toUpperCase();
        switch (effect.type) {
            case 'DAMAGE': {
                const hits = Math.min(100, Math.max(0, Math.floor(number('hits', 1))));
                context.variables.totalHpLoss = 0;
                for (let hit = 0; hit < hits && !this.ent.BattleBll.isFinished(); hit++) {
                    const loss = await damage.damage(context.source, target, number('amount'), text('damageKind', 'ATTACK'), params.ignoreBlock === true);
                    context.variables.lastDamage = loss;
                    context.variables.totalHpLoss = (context.variables.totalHpLoss || 0) + loss;
                    if (context.cardId && loss > 0) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, 'ON_HIT_UNBLOCKED', context);
                    }
                    if (context.cardId && actor.hp <= 0) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, 'ON_KILL_WITH_THIS_CARD', context);
                    }
                }
                break;
            }
            case 'BLOCK':
                damage.block(target, amount);
                break;
            case 'BLOCK_NEXT_TURN':
                this.ent.BattleTriggerBll.schedule('NEXT_TURN_START', 1,
                    [{ type: 'BLOCK', target: effect.target, params: { amount } }], context);
                break;
            case 'HEAL':
                damage.heal(target, amount);
                break;
            case 'LOSE_HP':
                await damage.damage(context.source, target,
                    params.canKill === true ? amount : Math.min(amount, Math.max(0, actor.hp - 1)), 'HP_LOSS', true);
                break;
            case 'KILL_IF':
                if (actor.hp <= number('threshold')) {
                    await damage.damage(context.source, target, actor.hp, 'HP_LOSS', true);
                    if (context.cardId) {
                        await this.ent.BattleCardBll.runCardEvent(context.cardId, 'ON_KILL_WITH_THIS_CARD', context);
                    }
                }
                break;
            case 'MULTIPLY_BLOCK':
                actor.block = Math.max(0, Math.floor(actor.block * number('factor', 1)));
                break;
            case 'REMOVE_BLOCK':
            case 'PIERCE_BLOCK':
                actor.block = Math.max(0, actor.block - (params.amount === 'ALL' ? actor.block : amount));
                break;
            case 'APPLY_STATUS':
                buffs.add(target, status, number('stacks'), text('duration', 'DEFAULT'));
                break;
            case 'REMOVE_STATUS':
                buffs.remove(target, status, params.stacks === 'ALL' ? Infinity : number('stacks'));
                break;
            case 'MULTIPLY_STATUS': {
                const next = resolver.stacks(target, status) * number('factor', 1);
                // 原地缩放，保留持续时间，也不重复触发人工制品。
                for (const buff of actor.buffs.filter(item => item.id === status)) {
                    buff.stacks = Math.trunc(buff.stacks * number('factor', 1));
                }
                if (!next) {
                    buffs.remove(target, status);
                }
                break;
            }
            case 'TRANSFER_STATUS': {
                const stacks = Math.min(resolver.stacks(target, status), params.amount === 'ALL' ? Infinity : amount);
                buffs.remove(target, status, stacks);
                buffs.add(resolver.target(text('destination', 'ENEMY'), context), status, stacks);
                break;
            }
            case 'CLEANSE':
                buffs.cleanse(target);
                break;
            case 'SET_INTANGIBLE':
                buffs.add(target, 'INTANGIBLE', number('stacks', 1));
                break;
            case 'MODIFY_STAT': {
                const stat = text('stat');
                if (stat === 'HP') {
                    if (amount >= 0) {
                        damage.heal(target, amount);
                    } else {
                        await damage.damage(context.source, target, -amount, 'HP_LOSS', true);
                    }
                } else if (stat === 'MAX_HP') {
                    actor.maxHp = Math.max(1, actor.maxHp + amount);
                    actor.hp = Math.min(actor.hp, actor.maxHp);
                } else {
                    buffs.add(target, stat, amount, text('duration', 'COMBAT'));
                }
                break;
            }
            case 'SET_STAT':
            case 'DOUBLE_STAT': {
                const stat = text('stat');
                const value = effect.type === 'DOUBLE_STAT' ? resolver.stacks(target, stat) * 2 : number('value');
                if (stat === 'BLOCK') {
                    actor.block = Math.max(0, Math.floor(value));
                } else {
                    buffs.remove(target, stat);
                    buffs.add(target, stat, value, 'COMBAT');
                }
                break;
            }
            case 'IF':
                await this.execute(resolver.condition(effect.condition, context) ? children : effect.elseEffects || [], context, allowFinished);
                break;
            case 'SEQUENCE':
                await this.execute(children, context, allowFinished);
                break;
            case 'REPEAT': {
                const count = Math.max(0, Math.min(100, number('maxIterations', 30), Math.floor(number('count'))));
                for (let index = 0; index < count; index++) {
                    await this.execute(children, context, allowFinished);
                }
                break;
            }
            case 'REGISTER_TRIGGER':
                this.ent.BattleTriggerBll.register(text('event'), children, context, text('scope', 'COMBAT'),
                    number('limit'), this.record(params.filter));
                break;
            case 'SCHEDULE':
                this.ent.BattleTriggerBll.schedule(text('when'), number('times', 1), children, context);
                break;
            case 'CHOOSE_ONE': {
                const options = children.slice(0, Math.max(1, number('showCount', children.length)));
                const choices = Math.min(options.length, Math.max(1, number('maxChoices', 1)));
                for (let count = 0; count < choices; count++) {
                    const index = await this.choose('选择卡牌效果', options.map(option => this.describe(option)));
                    if (index < 0) {
                        return;
                    }
                    const selected = options.splice(index, 1)[0];
                    await this.execute([selected], context, allowFinished);
                }
                break;
            }
            case 'RANDOM_CHOICE': {
                const options = [...children];
                const count = Math.min(100, Math.max(0, number('count', 1)));
                for (let index = 0; index < count && options.length; index++) {
                    const selected = Math.floor(Math.random() * options.length);
                    await this.execute([options[selected]], context, allowFinished);
                    if (params.unique !== false) {
                        options.splice(selected, 1);
                    }
                }
                break;
            }
            case 'DISCARD':
            case 'EXHAUST':
            case 'DISCARD_HAND':
            case 'EXHAUST_HAND':
                await this.ent.BattleCardBll.discard(params.count === 'ALL' || effect.type.endsWith('_HAND') ? Infinity : number('count', 1),
                    effect.type.endsWith('_HAND') ? 'ALL' : text('mode', 'SELECT'), effect.type.startsWith('EXHAUST'), this.record(params.filter));
                break;
            case 'ADD_CARD':
                this.ent.BattleCardBll.addCard(number('cardId'), number('count', 1), text('pile', 'DISCARD'));
                break;
            case 'EXHAUST_THIS_CARD':
                context.variables.exhaustThisCard = 1;
                break;
            case 'GAIN_GOLD':
            case 'LOSE_GOLD':
                this.ent.BattleModel.gold = Math.max(0, this.ent.BattleModel.gold
                    + Math.max(0, Math.floor(amount)) * (effect.type === 'GAIN_GOLD' ? 1 : -1));
                break;
            case 'SET_VARIABLE':
            case 'MODIFY_VARIABLE': {
                const name = text('name');
                const scope = text('scope', 'ACTION');
                const variables = scope === 'COMBAT' ? this.ent.BattleModel.combatVariables
                    : scope === 'TURN' ? this.ent.BattleModel.turnVariables : context.variables;
                const value = number('value');
                const previous = variables[name] || 0;
                switch (effect.type === 'SET_VARIABLE' ? 'SET' : text('operator', 'ADD')) {
                    case 'ADD': variables[name] = previous + value; break;
                    case 'MULTIPLY': variables[name] = previous * value; break;
                    case 'MIN': variables[name] = Math.min(previous, value); break;
                    case 'MAX': variables[name] = Math.max(previous, value); break;
                    default: variables[name] = value; break;
                }
                break;
            }
            default:
                throw new Error(`未实现的效果：${effect.type}`);
        }
    }

    private record(value: unknown): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        if (typeof value === 'object' && value && !Array.isArray(value)) {
            for (const [key, entry] of Object.entries(value)) {
                result[key] = entry;
            }
        }
        return result;
    }

    choose(title: string, options: string[]): Promise<number> {
        if (!options.length || this.ent.BattleBll.isFinished()) {
            return Promise.resolve(-1);
        }
        return new Promise(resolve => {
            this.ent.BattleModel.choice = { title, options, resolve };
            this.ent.BattleBll.refresh();
        });
    }

    select(index: number) {
        const choice = this.ent.BattleModel.choice;
        if (!choice || index < 0 || index >= choice.options.length) {
            return;
        }
        this.ent.BattleModel.choice = null;
        choice.resolve(index);
        this.ent.BattleBll.refresh();
    }

    describe(effect: BattleEffect): string {
        const params = effect.params || {};
        const target = effect.target === 'ENEMY' ? '敌人' : '自身';
        const children = (effect.children || []).map(child => this.describe(child)).join('；');
        if (effect.note) {
            return effect.note;
        }
        switch (effect.type) {
            case 'SEQUENCE':
                return children;
            case 'REPEAT':
                return `重复 ${params.count} 次（${children}）`;
            case 'DAMAGE':
                return `对${target}造成 ${params.amount} 点伤害 × ${params.hits || 1} 次`;
            case 'BLOCK':
                return `${target}获得 ${params.amount} 点格挡`;
            case 'HEAL':
                return `${target}回复 ${params.amount} 点生命`;
            case 'APPLY_STATUS':
                return `${target}获得 ${params.stacks} 层${this.ent.BattleBuffBll.name(String(params.status))}`;
            case 'MODIFY_STAT':
                return `${target}${this.ent.BattleBuffBll.name(String(params.stat))} ${Number(params.amount) >= 0 ? '+' : ''}${params.amount}`;
            case 'CLEANSE':
                return `清除${target}的减益`;
            case 'GAIN_GOLD':
                return `获得 ${params.amount} 金币`;
            default:
                return children || effect.type;
        }
    }
}
