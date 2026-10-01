import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { TableEnemy } from '../../common/table/TableEnemy';
import { BattleSide, EnemyActionType, EnemyBehaviorNode, EnemyBehaviorNodeType, EnemyConditionField } from '../model/BattleTypes';

export class BattleEnemyBll extends CCBusiness<Battle> {

    initEnemy() {
        const enemyInfo = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId)
        const model = this.ent.BattleEnemyModel;
        model.hp = enemyInfo?.originHp || 1;
        model.maxHp = model.hp;
        model.block = 0;
        model.buffs = [];
        model.plannedActions = [];
        model.lastAction = '';
        model.lastMoveId = '';
        model.repeatCount = 0;
    }

    planAction() {
        const enemy = TableEnemy.getConfigById(this.ent.BattleEnemyModel.enemyId);
        const actions = this.selectActions(enemy?.getBehavior());
        this.ent.BattleEnemyModel.plannedActions = actions.length ? actions : [{
            type: EnemyBehaviorNodeType.Action,
            action: EnemyActionType.Wait
        }];
    }

    private selectActions(node: EnemyBehaviorNode | undefined, depth = 0): EnemyBehaviorNode[] {
        if (!node || depth > 20) {
            return [];
        }
        const children = node.children || [];
        switch (node.type) {
            case EnemyBehaviorNodeType.Action:
                return [node];
            case EnemyBehaviorNodeType.Condition:
                return this.checkCondition(node) ? this.selectActions(children[0], depth + 1) : [];
            case EnemyBehaviorNodeType.Sequence: {
                const actions: EnemyBehaviorNode[] = [];
                for (const child of children) {
                    const selected = this.selectActions(child, depth + 1);
                    if (!selected.length) {
                        return [];
                    }
                    actions.push(...selected);
                }
                return actions;
            }
            case EnemyBehaviorNodeType.Selector:
                for (const child of children) {
                    const actions = this.selectActions(child, depth + 1);
                    if (actions.length) {
                        return actions;
                    }
                }
                return [];
            case EnemyBehaviorNodeType.Random: {
                const choices = children.map(child => ({ child, actions: this.selectActions(child, depth + 1) }))
                    .filter(choice => choice.actions.length && (choice.child.weight ?? 1) > 0);
                const total = choices.reduce((sum, choice) => sum + (choice.child.weight ?? 1), 0);
                let roll = Math.random() * total;
                for (const choice of choices) {
                    roll -= choice.child.weight ?? 1;
                    if (roll < 0) {
                        return choice.actions;
                    }
                }
                return [];
            }
            case EnemyBehaviorNodeType.Cycle: {
                if (!children.length) {
                    return [];
                }
                const index = (this.ent.BattleModel.turn - 1) % children.length;
                return this.selectActions(children[index], depth + 1);
            }
            default:
                return [];
        }
    }

    private checkCondition(node: EnemyBehaviorNode) {
        const enemy = this.ent.BattleEnemyModel;
        const player = this.ent.BattlePlayerModel;
        let actual = 0;
        switch (node.field) {
            case EnemyConditionField.Turn:
                actual = this.ent.BattleModel.turn;
                break;
            case EnemyConditionField.SelfHpPercent:
                actual = enemy.hp / Math.max(1, enemy.maxHp) * 100;
                break;
            case EnemyConditionField.PlayerHpPercent:
                actual = player.hp / Math.max(1, player.maxHp) * 100;
                break;
            case EnemyConditionField.SelfBlock:
                actual = enemy.block;
                break;
            case EnemyConditionField.PlayerBlock:
                actual = player.block;
                break;
            case EnemyConditionField.TurnMod:
                actual = this.ent.BattleModel.turn % Math.max(1, node.modulus ?? 1);
                break;
            case EnemyConditionField.RepeatCount:
                actual = enemy.repeatCount;
                break;
            case EnemyConditionField.LastAction:
                return node.operator === '==' ? enemy.lastAction === node.actionValue
                    : node.operator === '!=' && enemy.lastAction !== node.actionValue;
            default:
                return false;
        }
        const value = node.value ?? 0;
        switch (node.operator) {
            case '<': return actual < value;
            case '<=': return actual <= value;
            case '==': return actual === value;
            case '!=': return actual !== value;
            case '>=': return actual >= value;
            case '>': return actual > value;
            default: return false;
        }
    }

    intent() {
        const names: Record<EnemyActionType, string> = {
            [EnemyActionType.Attack]: '攻击',
            [EnemyActionType.Defend]: '防御',
            [EnemyActionType.Buff]: '强化',
            [EnemyActionType.Debuff]: '削弱',
            [EnemyActionType.Heal]: '治疗',
            [EnemyActionType.Wait]: '等待',
            [EnemyActionType.LoseHp]: '失去生命',
            [EnemyActionType.RemoveBlock]: '移除格挡',
            [EnemyActionType.Cleanse]: '净化',
            [EnemyActionType.Discard]: '弃牌',
            [EnemyActionType.Exhaust]: '消耗手牌',
            [EnemyActionType.AddCard]: '塞入卡牌',
            [EnemyActionType.Effects]: '复合效果'
        };
        return this.ent.BattleEnemyModel.plannedActions.map(action => {
            const label = action.moveName?.trim() || names[action.action || EnemyActionType.Wait];
            if (action.action === EnemyActionType.Attack) {
                return `${label} ${action.amount ?? 0}${(action.hits ?? 1) > 1 ? `×${action.hits}` : ''}`;
            }
            if ([EnemyActionType.Defend, EnemyActionType.Heal, EnemyActionType.LoseHp, EnemyActionType.RemoveBlock].includes(action.action || EnemyActionType.Wait)) {
                return `${label} ${action.amount ?? 0}`;
            }
            if (action.action === EnemyActionType.AddCard) {
                return `${label} ${action.cardId ?? 0} × ${action.count ?? 1}`;
            }
            if (action.action === EnemyActionType.Effects) {
                return `${label} ${action.effects?.length ?? 0} 项`;
            }
            if (action.action === EnemyActionType.Buff || action.action === EnemyActionType.Debuff) {
                return `${label} ${action.status || ''} ${action.stacks ?? 0}`;
            }
            return label;
        }).join(' + ');
    }

    async act() {
        const actions = this.ent.BattleEnemyModel.plannedActions;
        const model = this.ent.BattleEnemyModel;
        const moveId = actions.map(action => action.editorId || action.action || '').join('+');
        model.repeatCount = moveId && moveId === model.lastMoveId ? model.repeatCount + 1 : 1;
        model.lastMoveId = moveId;
        for (const action of actions) {
            if (this.ent.BattleBll.isFinished()) {
                return;
            }
            switch (action.action) {
                case EnemyActionType.Attack:
                    for (let hit = 0; hit < Math.min(100, action.hits ?? 1); hit++) {
                        if (this.ent.BattleBll.isFinished()) {
                            return;
                        }
                        await this.ent.BattleDamageBll.damage(BattleSide.Enemy, BattleSide.Player, action.amount ?? 0);
                    }
                    break;
                case EnemyActionType.Defend:
                    this.ent.BattleDamageBll.block(BattleSide.Enemy, action.amount ?? 0);
                    break;
                case EnemyActionType.Buff:
                    this.ent.BattleBuffBll.add(BattleSide.Enemy, action.status || '', action.stacks ?? 0);
                    break;
                case EnemyActionType.Debuff:
                    this.ent.BattleBuffBll.add(BattleSide.Player, action.status || '', action.stacks ?? 0);
                    break;
                case EnemyActionType.Heal:
                    this.ent.BattleDamageBll.heal(BattleSide.Enemy, action.amount ?? 0);
                    break;
                case EnemyActionType.Wait:
                    break;
                case EnemyActionType.LoseHp:
                    await this.ent.BattleDamageBll.damage(BattleSide.Enemy, action.target || BattleSide.Player,
                        action.amount ?? 0, 'HP_LOSS', true);
                    break;
                case EnemyActionType.RemoveBlock:
                    {
                        const actor = this.ent.BattleValueResolver.actor(action.target || BattleSide.Player);
                        actor.block = Math.max(0, actor.block - (action.amount ?? 0));
                    }
                    break;
                case EnemyActionType.Cleanse:
                    this.ent.BattleBuffBll.cleanse(action.target || BattleSide.Enemy);
                    break;
                case EnemyActionType.Discard:
                case EnemyActionType.Exhaust:
                    await this.ent.BattleCardBll.discard(action.count ?? 1, 'RANDOM', action.action === EnemyActionType.Exhaust);
                    break;
                case EnemyActionType.AddCard:
                    this.ent.BattleCardBll.addCard(action.cardId ?? 0, action.count ?? 1, action.pile || 'DISCARD');
                    break;
                case EnemyActionType.Effects:
                    this.ent.BattleEffectBll.validate(action.effects || []);
                    await this.ent.BattleEffectBll.execute(action.effects || [],
                        this.ent.BattleValueResolver.context(BattleSide.Enemy, 0, BattleSide.Player));
                    break;
            }
            model.lastAction = action.action || EnemyActionType.Wait;
            this.ent.BattleBll.refresh();
        }
    }

}
