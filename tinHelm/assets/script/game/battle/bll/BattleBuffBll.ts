import { TableBattleBuff, BattleBuffCategory, BattleBuffStackMode } from '../../common/table/TableBattleBuff';
import { BattleBuffTypeEnum } from '../../common/table/BattleBuffTypeEnum';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleSide } from '../model/BattleTypes';
export class BattleBuffBll extends CCBusiness<Battle> {
    // 计算闪避、飞行与硬甲对本次伤害的修正。
    calculateIncomingDamage(side: BattleSide, amount: number, kind: string): number {
        if (kind === 'HP_LOSS' || amount <= 0) {
            return amount;
        }
        const resolver = this.ent.BattleValueResolver;
        if (kind === 'ATTACK' && resolver.getBuffStacks(side, BattleBuffTypeEnum.EVASION) > 0) {
            this.removeBuff(side, BattleBuffTypeEnum.EVASION, 1);
            return 0;
        }
        const flight = kind === 'ATTACK' && resolver.getBuffStacks(side, BattleBuffTypeEnum.FLIGHT) > 0;
        return Math.max(0, amount * (flight ? 0.5 : 1) - Math.max(0, resolver.getBuffStacks(side, BattleBuffTypeEnum.ARMOR)));
    }
    // 结算攻击穿透生命后的护甲衰减与暴怒。
    applyAttackHpLoss(side: BattleSide): void {
        const resolver = this.ent.BattleValueResolver;
        this.removeBuff(side, BattleBuffTypeEnum.PLATED_ARMOR, 1);
        this.removeBuff(side, BattleBuffTypeEnum.FLIGHT, 1);
        const fury = resolver.getBuffStacks(side, BattleBuffTypeEnum.FURY);
        if (fury > 0) {
            this.addBuff(side, BattleBuffTypeEnum.STRENGTH, fury, 'COMBAT');
        }
    }
    // 按配置分类添加状态，并结算人工制品抵消减益。
    addBuff(side: BattleSide, id: BattleBuffTypeEnum, stacks: number, duration = 'DEFAULT'): void {
        if (!Number.isFinite(stacks)) {
            throw new Error('状态层数必须是有限数值');
        }
        stacks = Math.trunc(stacks);
        if (!stacks) {
            return;
        }
        const resolver = this.ent.BattleValueResolver;
        const config = TableBattleBuff.requireBuffConfig(id);
        if (config.category === BattleBuffCategory.Debuff && stacks > 0 && resolver.getBuffStacks(side, BattleBuffTypeEnum.ARTIFACT) > 0) {
            this.removeBuff(side, BattleBuffTypeEnum.ARTIFACT, 1);
            return;
        }
        const currentStacks = resolver.getBuffStacks(side, id);
        let desiredStacks = currentStacks + stacks;
        if (config.stackMode === BattleBuffStackMode.Max) {
            desiredStacks = Math.max(currentStacks, stacks);
            if (desiredStacks === currentStacks) {
                return;
            }
        }
        else if (config.stackMode === BattleBuffStackMode.Replace) {
            desiredStacks = stacks;
        }
        desiredStacks = Math.max(-config.maxStacks, Math.min(config.maxStacks, desiredStacks));
        if (config.stackMode !== BattleBuffStackMode.Add) {
            this.removeBuff(side, id);
            stacks = desiredStacks;
        }
        else {
            stacks = desiredStacks - currentStacks;
        }
        if (!stacks) {
            return;
        }
        const expiresTurn = this.ent.BattleModel.turn + (duration === 'NEXT_TURN' ? 1 : 0);
        const expires = ['TURN', 'NEXT_TURN'].includes(duration);
        const activeBuffs = resolver.getActor(side).buffs;
        const existing = activeBuffs.find(buff => {
            return buff.id === id && buff.duration === duration
                && (!expires || buff.expiresTurn === expiresTurn);
        });
        if (existing) {
            existing.stacks += stacks;
        }
        else {
            activeBuffs.push({ id, stacks, duration, expiresTurn });
        }
        resolver.getActor(side).buffs = activeBuffs.filter(buff => {
            return buff.stacks !== 0;
        });
    }
    // 移除指定状态的部分层数或全部状态。
    removeBuff(side: BattleSide, id: BattleBuffTypeEnum | 'ALL', amount = Infinity): void {
        const actor = this.ent.BattleValueResolver.getActor(side);
        if (id === 'ALL' && amount === Infinity) {
            actor.buffs = [];
            return;
        }
        let remaining = Math.max(0, amount);
        for (const buff of actor.buffs) {
            if (id === 'ALL' || buff.id === id) {
                const removed = Math.min(Math.abs(buff.stacks), remaining);
                buff.stacks -= Math.sign(buff.stacks) * removed;
                remaining -= removed;
            }
        }
        actor.buffs = actor.buffs.filter(buff => {
            return buff.stacks !== 0;
        });
    }
    // 按Buff表分类清除减益和负层数状态。
    cleanseDebuffs(side: BattleSide): void {
        const actor = this.ent.BattleValueResolver.getActor(side);
        actor.buffs = actor.buffs.filter(buff => {
            return TableBattleBuff.requireBuffConfig(buff.id).category !== BattleBuffCategory.Debuff && buff.stacks > 0;
        });
    }
    // 按倍率修改状态并限制总层数，保留每份状态的持续范围。
    multiplyBuffStacks(side: BattleSide, id: BattleBuffTypeEnum, factor: number): void {
        if (!Number.isFinite(factor) || factor < 0) {
            throw new Error('状态倍率必须是非负有限数值');
        }
        const actor = this.ent.BattleValueResolver.getActor(side);
        const config = TableBattleBuff.requireBuffConfig(id);
        const buffs = actor.buffs.filter(item => {
            return item.id === id;
        });
        for (const buff of buffs) {
            const stacks = Math.trunc(buff.stacks * factor);
            if (!Number.isFinite(stacks)) {
                throw new Error('状态层数超出有限数值范围');
            }
            buff.stacks = stacks;
        }
        const total = buffs.reduce((sum, buff) => {
            return sum + buff.stacks;
        }, 0);
        let excess = total - Math.max(-config.maxStacks, Math.min(config.maxStacks, total));
        for (const buff of buffs) {
            if (Math.sign(buff.stacks) === Math.sign(excess)) {
                const removed = Math.min(Math.abs(buff.stacks), Math.abs(excess)) * Math.sign(excess);
                buff.stacks -= removed;
                excess -= removed;
            }
        }
        actor.buffs = actor.buffs.filter(buff => {
            return buff.stacks !== 0;
        });
    }
    // 等待中毒伤害结算后减少层数并处理格挡保留。
    async settleTurnStartBuffs(side: BattleSide): Promise<void> {
        const runId = this.ent.BattleModel.runId;
        const resolver = this.ent.BattleValueResolver;
        const actor = resolver.getActor(side);
        // 格挡保留至自己的下一回合开始，保证能抵挡敌人攻击。
        if (resolver.getBuffStacks(side, BattleBuffTypeEnum.BARRICADE) <= 0) {
            actor.block = side === BattleSide.Player
                ? Math.min(actor.block, this.ent.BattlePlayerModel.retainedBlockLimit) : 0;
        }
        const poison = resolver.getBuffStacks(side, BattleBuffTypeEnum.POISON);
        if (poison > 0) {
            await this.ent.BattleDamageBll.applyDamage(resolver.getOppositeSide(side), side, poison, 'HP_LOSS', true);
            if (runId === this.ent.BattleModel.runId) {
                this.removeBuff(side, BattleBuffTypeEnum.POISON, 1);
            }
        }
    }
    // 等待回合末状态伤害结算后处理恢复、强化与到期状态。
    async settleTurnEndBuffs(side: BattleSide): Promise<void> {
        const runId = this.ent.BattleModel.runId;
        const resolver = this.ent.BattleValueResolver;
        for (const id of [BattleBuffTypeEnum.BURN, BattleBuffTypeEnum.CONSTRICTED]) {
            const amount = resolver.getBuffStacks(side, id);
            if (amount > 0 && !this.ent.BattleBll.isBattleFinished(runId)) {
                await this.ent.BattleDamageBll.applyDamage(resolver.getOppositeSide(side), side, amount, 'HP_LOSS', true);
                if (this.ent.BattleBll.isBattleFinished(runId)) {
                    return;
                }
                this.removeBuff(side, id, 1);
            }
        }
        const ritual = resolver.getBuffStacks(side, BattleBuffTypeEnum.RITUAL);
        if (ritual > 0 && !this.ent.BattleBll.isBattleFinished(runId)) {
            this.addBuff(side, BattleBuffTypeEnum.STRENGTH, ritual, 'COMBAT');
        }
        const regeneration = resolver.getBuffStacks(side, BattleBuffTypeEnum.REGENERATION);
        if (regeneration > 0 && !this.ent.BattleBll.isBattleFinished()) {
            this.ent.BattleDamageBll.restoreHp(side, regeneration);
            this.removeBuff(side, BattleBuffTypeEnum.REGENERATION, 1);
        }
        const metallicize = resolver.getBuffStacks(side, BattleBuffTypeEnum.METALLICIZE) + resolver.getBuffStacks(side, BattleBuffTypeEnum.PLATED_ARMOR);
        if (metallicize > 0) {
            this.ent.BattleDamageBll.addBlock(side, metallicize, false);
        }
        const actor = resolver.getActor(side);
        for (const buff of actor.buffs) {
            if (buff.duration === 'DEFAULT' && TableBattleBuff.requireBuffConfig(buff.id).decayAtTurnEnd) {
                buff.stacks = Math.max(0, buff.stacks - 1);
            }
        }
        actor.buffs = actor.buffs.filter(buff => {
            return buff.stacks !== 0
                && !(['TURN', 'NEXT_TURN'].includes(buff.duration) && buff.expiresTurn <= this.ent.BattleModel.turn);
        });
    }
    // 读取Buff表中的状态名称。
    getBuffName(id: BattleBuffTypeEnum): string {
        return TableBattleBuff.requireBuffConfig(id).name;
    }
    // 生成当前格挡与状态层数的显示文本。
    describeBuffs(side: BattleSide): string {
        const actor = this.ent.BattleValueResolver.getActor(side);
        // 微信构建会把 Set 展开编译为 concat，使用 Array.from 显式转为数组。
        const ids = Array.from(new Set(actor.buffs.map(buff => {
            return buff.id;
        })));
        return [`格挡 ${actor.block}`, ...ids.map(id => {
                return `${this.getBuffName(id)} ${this.ent.BattleValueResolver.getBuffStacks(side, id)}`;
            })].join('  ');
    }
    // 移除本次行动结束时到期的状态。
    clearActionBuffs(): void {
        for (const side of [BattleSide.Player, BattleSide.Enemy]) {
            const actor = this.ent.BattleValueResolver.getActor(side);
            actor.buffs = actor.buffs.filter(buff => {
                return buff.duration !== 'ACTION';
            });
        }
    }
}
