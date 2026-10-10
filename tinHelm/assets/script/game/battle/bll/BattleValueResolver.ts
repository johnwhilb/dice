import { TableBattleBuff } from '../../common/table/TableBattleBuff';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleActor, BattleCondition, BattleContext, BattleSide, BattleEventData } from '../model/BattleTypes';
/** 只解析数值语法，不执行 JSON 中的 JavaScript。 */
export class BattleValueResolver extends CCBusiness<Battle> {
    // 读取指定阵营的战斗角色数据。
    getActor(side: BattleSide): BattleActor {
        return side === BattleSide.Player ? this.ent.BattlePlayerModel : this.ent.BattleEnemyModel;
    }
    // 读取指定阵营的对手阵营。
    getOppositeSide(side: BattleSide): BattleSide {
        return side === BattleSide.Player ? BattleSide.Enemy : BattleSide.Player;
    }
    // 根据效果目标解析实际作用阵营。
    resolveTargetSide(target: string, context: BattleContext): BattleSide {
        if (target === 'ENEMY') {
            return this.getOppositeSide(context.source);
        }
        if (target !== 'SELF') {
            throw new Error(`效果目标无效：${target}`);
        }
        return context.source;
    }
    // 汇总指定Buff编号的状态层数。
    getBuffStacks(side: BattleSide, id: BattleBuffTypeEnum): number {
        return this.getActor(side).buffs.filter(buff => {
            return buff.id === id;
        })
            .reduce((sum, buff) => {
            return sum + buff.stacks;
        }, 0);
    }
    // 创建当前战斗批次的效果上下文。
    createContext(source = BattleSide.Player, cardId = 0, target = this.getOppositeSide(source)): BattleContext {
        return { runId: this.ent.BattleModel.runId, source, target, cardId, variables: { totalHpLoss: 0, cardDamageBonus: 0, nextCardDamageBonus: 0, cardBlockGained: 0, exhaustThisCard: 0 }, event: {}, activeCardEvents: [] };
    }
    // 解析有限数值或受限的数学表达式。
    resolveNumber(value: number | string | boolean | BattleEventData | undefined, context: BattleContext): number {
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) {
                throw new Error(`数值无效：${value}`);
            }
            return value;
        }
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`数值或表达式缺失：${value}`);
        }
        const tokens = value.match(/@[\w.]+|\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z]+|[()+\-*/%,]/g);
        if (!tokens) {
            throw new Error(`数值表达式为空：${value}`);
        }
        if (tokens.join('') !== value.replace(/\s/g, '')) {
            throw new Error(`无效的数值表达式：${value}`);
        }
        let position = 0;
        const parsePrimary = (): number => {
            const token = tokens[position++];
            if (token === '-' || token === '+') {
                return (token === '-' ? -1 : 1) * parsePrimary();
            }
            if (token === '(') {
                const result = parseExpression();
                if (tokens[position++] !== ')') {
                    throw new Error('表达式括号不匹配');
                }
                return result;
            }
            if (token?.startsWith('@')) {
                return this.resolveReference(token, context);
            }
            if (/^(min|max|floor|ceil|round|abs)$/.test(token)) {
                if (tokens[position++] !== '(') {
                    throw new Error('函数缺少左括号');
                }
                const args = [parseExpression()];
                while (tokens[position] === ',') {
                    position++;
                    args.push(parseExpression());
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
        const parseProduct = (): number => {
            let result = parsePrimary();
            while (['*', '/', '%'].includes(tokens[position])) {
                const operator = tokens[position++];
                const right = parsePrimary();
                result = operator === '*' ? result * right : operator === '/' ? result / right : result % right;
            }
            return result;
        };
        const parseExpression = (): number => {
            let result = parseProduct();
            while (['+', '-'].includes(tokens[position])) {
                const operator = tokens[position++];
                const right = parseProduct();
                result += operator === '+' ? right : -right;
            }
            return result;
        };
        const result = parseExpression();
        if (position !== tokens.length || !Number.isFinite(result)) {
            throw new Error(`表达式结果无效：${value}`);
        }
        return result;
    }
    // 解析角色、事件与作用域变量引用。
    private resolveReference(path: string, context: BattleContext): number {
        const [scope, field, status] = path.slice(1).split('.');
        if (scope === 'self' || scope === 'target') {
            const side = scope === 'self' ? context.source : context.target;
            const actor = this.getActor(side);
            switch (field) {
                case 'turn': return this.ent.BattleModel.turn;
                case 'hp': return actor.hp;
                case 'maxHp': return actor.maxHp;
                case 'block': return actor.block;
                case 'energy': return side === BattleSide.Player ? this.ent.BattlePlayerModel.energy : 0;
                case 'buff':
                case 'buffs': return this.getBuffStacks(side, TableBattleBuff.requireBuffId(Number(status)));
                default: return this.getBuffStacks(side, TableBattleBuff.requireBuffId(Number(field)));
            }
        }
        if (scope === 'event') {
            return this.resolveNumber(context.event[field], context);
        }
        if (scope === 'last_damage') {
            return context.variables.totalHpLoss;
        }
        const variable = field ? field : scope;
        const name = context.equipmentKey ? context.equipmentKey + '.' + variable : variable;
        for (const variables of [context.variables, this.ent.BattleModel.turnVariables, this.ent.BattleModel.combatVariables]) {
            if (Object.prototype.hasOwnProperty.call(variables, name)) {
                return variables[name];
            }
        }
        throw new Error(`变量尚未初始化：${name}`);
    }
    // 检查组合条件与数值比较结果。
    checkCondition(condition: BattleCondition | undefined, context: BattleContext): boolean {
        if (!condition) {
            return true;
        }
        if (condition.rules) {
            return condition.op === 'OR'
                ? condition.rules.some(rule => {
                    return this.checkCondition(rule, context);
                })
                : condition.rules.every(rule => {
                    return this.checkCondition(rule, context);
                });
        }
        const left = this.resolveNumber(condition.lhs, context);
        const right = this.resolveNumber(condition.rhs, context);
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
