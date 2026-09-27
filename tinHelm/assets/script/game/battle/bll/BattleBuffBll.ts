import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { Battle } from '../Battle';
import { BattleSide } from '../model/BattleTypes';

export class BattleBuffBll extends CCBusiness<Battle> {
    private readonly debuffs = ['WEAK', 'VULNERABLE', 'FRAIL', 'POISON'];

    add(side: BattleSide, id: string, stacks: number, duration = 'DEFAULT') {
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
            actor.block = 0;
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
        const resolver = this.ent.BattleValueResolver;
        const regeneration = resolver.stacks(side, 'REGENERATION');
        if (regeneration > 0 && !this.ent.BattleBll.isFinished()) {
            this.ent.BattleDamageBll.heal(side, regeneration);
            this.remove(side, 'REGENERATION', 1);
        }
        const metallicize = resolver.stacks(side, 'METALLICIZE');
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
            THORNS: '荆棘', REGENERATION: '再生', METALLICIZE: '金属化', BARRICADE: '壁垒'
        };
        return names[id] || id;
    }

    describe(side: BattleSide) {
        const actor = this.ent.BattleValueResolver.actor(side);
        const ids = [...new Set(actor.buffs.map(buff => buff.id))];
        return [`格挡 ${actor.block}`, ...ids.map(id => `${this.name(id)} ${this.ent.BattleValueResolver.stacks(side, id)}`)].join('  ');
    }

    clearAction() {
        for (const side of [BattleSide.Player, BattleSide.Enemy]) {
            const actor = this.ent.BattleValueResolver.actor(side);
            actor.buffs = actor.buffs.filter(buff => buff.duration !== 'ACTION');
        }
    }
}
