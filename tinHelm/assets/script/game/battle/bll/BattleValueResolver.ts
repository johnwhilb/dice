import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleActor, BattleCondition, BattleContext, BattleSide } from '../model/BattleTypes';

/** 只解析数值语法，不执行 JSON 中的 JavaScript。 */
export class BattleValueResolver extends CCBusiness<Battle> {
    actor(side: BattleSide): BattleActor {
        return side === BattleSide.Player ? this.ent.BattlePlayerModel : this.ent.BattleEnemyModel;
    }

    opposite(side: BattleSide) {
        return side === BattleSide.Player ? BattleSide.Enemy : BattleSide.Player;
    }

    target(target: string | undefined, context: BattleContext) {
        return target === 'ENEMY' ? this.opposite(context.source) : context.source;
    }

    stacks(side: BattleSide, id: string) {
        return this.actor(side).buffs.filter(buff => buff.id === id.toUpperCase())
            .reduce((sum, buff) => sum + buff.stacks, 0);
    }

    context(source = BattleSide.Player, cardId = 0, target = this.opposite(source)): BattleContext {
        return { runId: this.ent.BattleModel.runId, source, target, cardId, variables: {}, event: {} };
    }

    number(value: unknown, context: BattleContext, fallback = 0): number {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : fallback;
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        if (typeof value !== 'string' || !value.trim()) {
            return fallback;
        }
        const tokens = value.match(/@[\w.]+|\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z]+|[()+\-*/%,]/g) || [];
        if (tokens.join('') !== value.replace(/\s/g, '')) {
            throw new Error(`无效的数值表达式：${value}`);
        }
        let position = 0;
        const primary = (): number => {
            const token = tokens[position++];
            if (token === '-' || token === '+') {
                return (token === '-' ? -1 : 1) * primary();
            }
            if (token === '(') {
                const result = expression();
                if (tokens[position++] !== ')') {
                    throw new Error('表达式括号不匹配');
                }
                return result;
            }
            if (token?.startsWith('@')) {
                return this.reference(token, context);
            }
            if (/^(min|max|floor|ceil|round|abs)$/.test(token)) {
                if (tokens[position++] !== '(') {
                    throw new Error('函数缺少左括号');
                }
                const args = [expression()];
                while (tokens[position] === ',') {
                    position++;
                    args.push(expression());
                }
                if (tokens[position++] !== ')') {
                    throw new Error('函数缺少右括号');
                }
                switch (token) {
                    case 'min': return Math.min(...args);
                    case 'max': return Math.max(...args);
                    case 'floor': return Math.floor(args[0]);
                    case 'ceil': return Math.ceil(args[0]);
                    case 'round': return Math.round(args[0]);
                    default: return Math.abs(args[0]);
                }
            }
            const result = Number(token);
            if (!token || !Number.isFinite(result)) {
                throw new Error(`无法解析数值：${token}`);
            }
            return result;
        };
        const product = (): number => {
            let result = primary();
            while (['*', '/', '%'].includes(tokens[position])) {
                const operator = tokens[position++];
                const right = primary();
                result = operator === '*' ? result * right : operator === '/' ? result / right : result % right;
            }
            return result;
        };
        const expression = (): number => {
            let result = product();
            while (['+', '-'].includes(tokens[position])) {
                const operator = tokens[position++];
                const right = product();
                result += operator === '+' ? right : -right;
            }
            return result;
        };
        const result = expression();
        if (position !== tokens.length || !Number.isFinite(result)) {
            throw new Error(`表达式结果无效：${value}`);
        }
        return result;
    }

    private reference(path: string, context: BattleContext) {
        const [scope, field, status] = path.slice(1).split('.');
        if (scope === 'self' || scope === 'target') {
            const side = scope === 'self' ? context.source : context.target;
            const actor = this.actor(side);
            switch (field) {
                case 'turn': return this.ent.BattleModel.turn;
                case 'hp': return actor.hp;
                case 'maxHp': return actor.maxHp;
                case 'block': return actor.block;
                case 'energy': return side === BattleSide.Player ? this.ent.BattlePlayerModel.energy : 0;
                case 'buff':
                case 'buffs': return this.stacks(side, status || '');
                default: return this.stacks(side, field || '');
            }
        }
        if (scope === 'event') {
            return Number(context.event[field]) || 0;
        }
        if (scope === 'last_damage') {
            return context.variables.totalHpLoss || 0;
        }
        const variable = field || scope;
        const name = context.equipmentKey ? context.equipmentKey + '.' + variable : variable;
        return context.variables[name] ?? this.ent.BattleModel.turnVariables[name]
            ?? this.ent.BattleModel.combatVariables[name] ?? 0;
    }

    condition(condition: BattleCondition | undefined, context: BattleContext): boolean {
        if (!condition) {
            return true;
        }
        if (condition.rules) {
            return condition.op === 'OR'
                ? condition.rules.some(rule => this.condition(rule, context))
                : condition.rules.every(rule => this.condition(rule, context));
        }
        const left = this.number(condition.lhs, context);
        const right = this.number(condition.rhs, context);
        switch (condition.cmp) {
            case '==': return left === right;
            case '!=': return left !== right;
            case '>': return left > right;
            case '>=': return left >= right;
            case '<': return left < right;
            case '<=': return left <= right;
            default: throw new Error(`不支持的条件运算符：${condition.cmp}`);
        }
    }
}
