import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleSide } from '../model/BattleTypes';

export class BattleBuffBll extends CCBusiness<Battle> {
    private readonly debuffs = ['WEAK', 'VULNERABLE', 'FRAIL', 'POISON', 'BURN', 'CONSTRICTED'];

    incomingDamage(side: BattleSide, amount: number, kind: string) {
        if (kind === 'HP_LOSS' || amount <= 0) {
            return amount;
        }
        const resolver = this.ent.BattleValueResolver;
        if (kind === 'ATTACK' && resolver.stacks(side, 'EVASION') > 0) {
            this.remove(side, 'EVASION', 1);
            return 0;
        }
        const flight = kind === 'ATTACK' && resolver.stacks(side, 'FLIGHT') > 0;
        return Math.max(0, amount * (flight ? 0.5 : 1) - Math.max(0, resolver.stacks(side, 'ARMOR')));
    }

    attackHpLoss(side: BattleSide) {
        const resolver = this.ent.BattleValueResolver;
        this.remove(side, 'PLATED_ARMOR', 1);
        this.remove(side, 'FLIGHT', 1);
        const fury = resolver.stacks(side, 'FURY');
        if (fury > 0) {
            this.add(side, 'STRENGTH', fury, 'COMBAT');
        }
    }

    add(side: BattleSide, id: string, stacks: number, duration = 'DEFAULT') {
        if (!Number.isFinite(stacks)) {
            throw new Error('状态层数必须是有限数值');
        }
        id = id.toUpperCase();
        stacks = Math.trunc(stacks);
        if (!stacks) {
            return;
        }
        const resolver = this.ent.BattleValueResolver;
        if (this.debuffs.includes(id) && stacks > 0 && resolver.stacks(side, 'ARTIFACT') > 0) {
            this.remove(side, 'ARTIFACT', 1);
            return;
        }
        const buffs = resolver.actor(side).buffs;
        const expiresTurn = this.ent.BattleModel.turn + (duration === 'NEXT_TURN' ? 1 : 0);
        const expires = ['TURN', 'NEXT_TURN'].includes(duration);
        const existing = buffs.find(buff => buff.id === id && buff.duration === duration
            && (!expires || buff.expiresTurn === expiresTurn));
        if (existing) {
            existing.stacks += stacks;
        } else {
            buffs.push({ id, stacks, duration, expiresTurn });
        }
        resolver.actor(side).buffs = buffs.filter(buff => buff.stacks !== 0);
    }

    remove(side: BattleSide, id: string, amount = Infinity) {
        const actor = this.ent.BattleValueResolver.actor(side);
        if (id === 'ALL' && amount === Infinity) {
            actor.buffs = [];
            return;
        }
        let remaining = Math.max(0, amount);
        for (const buff of actor.buffs) {
            if (id === 'ALL' || buff.id === id.toUpperCase()) {
                const removed = Math.min(Math.abs(buff.stacks), remaining);
                buff.stacks -= Math.sign(buff.stacks) * removed;
                remaining -= removed;
            }
        }
        actor.buffs = actor.buffs.filter(buff => buff.stacks !== 0);
    }

    cleanse(side: BattleSide) {
        const actor = this.ent.BattleValueResolver.actor(side);
        actor.buffs = actor.buffs.filter(buff => !this.debuffs.includes(buff.id) && buff.stacks > 0);
    }

    async startTurn(side: BattleSide) {
        const runId = this.ent.BattleModel.runId;
        const resolver = this.ent.BattleValueResolver;
        const actor = resolver.actor(side);
        // 格挡保留至自己的下一回合开始，保证能抵挡敌人攻击。
        if (resolver.stacks(side, 'BARRICADE') <= 0) {
            actor.block = side === BattleSide.Player
                ? Math.min(actor.block, this.ent.BattlePlayerModel.retainedBlockLimit) : 0;
        }
        const poison = resolver.stacks(side, 'POISON');
        if (poison > 0) {
            await this.ent.BattleDamageBll.damage(resolver.opposite(side), side, poison, 'HP_LOSS', true);
            if (runId === this.ent.BattleModel.runId) {
                this.remove(side, 'POISON', 1);
            }
        }
    }

    async endTurn(side: BattleSide) {
        const runId = this.ent.BattleModel.runId;
        const resolver = this.ent.BattleValueResolver;
        for (const id of ['BURN', 'CONSTRICTED']) {
            const amount = resolver.stacks(side, id);
            if (amount > 0 && !this.ent.BattleBll.isFinished(runId)) {
                await this.ent.BattleDamageBll.damage(resolver.opposite(side), side, amount, 'HP_LOSS', true);
                if (this.ent.BattleBll.isFinished(runId)) {
                    return;
                }
                this.remove(side, id, 1);
            }
        }
        const ritual = resolver.stacks(side, 'RITUAL');
        if (ritual > 0 && !this.ent.BattleBll.isFinished(runId)) {
            this.add(side, 'STRENGTH', ritual, 'COMBAT');
        }
        const regeneration = resolver.stacks(side, 'REGENERATION');
        if (regeneration > 0 && !this.ent.BattleBll.isFinished()) {
            this.ent.BattleDamageBll.heal(side, regeneration);
            this.remove(side, 'REGENERATION', 1);
        }
        const metallicize = resolver.stacks(side, 'METALLICIZE') + resolver.stacks(side, 'PLATED_ARMOR');
        if (metallicize > 0) {
            this.ent.BattleDamageBll.block(side, metallicize, false);
        }
        const actor = resolver.actor(side);
        for (const buff of actor.buffs) {
            if (buff.duration === 'DEFAULT' && ['WEAK', 'VULNERABLE', 'FRAIL', 'INTANGIBLE'].includes(buff.id)) {
                buff.stacks = Math.max(0, buff.stacks - 1);
            }
        }
        actor.buffs = actor.buffs.filter(buff => buff.stacks !== 0
            && !(['TURN', 'NEXT_TURN'].includes(buff.duration) && buff.expiresTurn <= this.ent.BattleModel.turn));
    }

    name(id: string) {
        const names: Record<string, string> = {
            STRENGTH: '力量', DEXTERITY: '敏捷', WEAK: '虚弱', VULNERABLE: '易伤',
            FRAIL: '脆弱', POISON: '中毒', ARTIFACT: '人工制品', INTANGIBLE: '无实体',
            THORNS: '荆棘', REGENERATION: '再生', METALLICIZE: '金属化', BARRICADE: '壁垒',
            ARMOR: '硬甲', EVASION: '闪避', FLIGHT: '飞行', PLATED_ARMOR: '多层护甲',
            FURY: '受击暴怒', RITUAL: '仪式', BURN: '灼烧', CONSTRICTED: '紧缚'
        };
        return names[id] || id;
    }

    describe(side: BattleSide) {
        const actor = this.ent.BattleValueResolver.actor(side);
        // 微信构建会把 Set 展开编译为 concat，使用 Array.from 显式转为数组。
        const ids = Array.from(new Set(actor.buffs.map(buff => buff.id)));
        return [`格挡 ${actor.block}`, ...ids.map(id => `${this.name(id)} ${this.ent.BattleValueResolver.stacks(side, id)}`)].join('  ');
    }

    clearAction() {
        for (const side of [BattleSide.Player, BattleSide.Enemy]) {
            const actor = this.ent.BattleValueResolver.actor(side);
            actor.buffs = actor.buffs.filter(buff => buff.duration !== 'ACTION');
        }
    }
}
