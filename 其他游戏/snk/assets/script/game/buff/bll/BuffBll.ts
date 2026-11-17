import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Buff } from "../Buff";
import { BuffEvent, BuffKind } from "../BuffEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { CombatBll } from "../../combat/bll/CombatBll";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { PlayerActionBll } from "../../player/bll/PlayerActionBll";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";

export class BuffBll extends CCBusiness<Buff> {
    /** 为 camp 阵营的 target 添加状态，同来源同技能刷新持续时间，stack 决定数值是否累加。 */
    add(camp: CombatCamp, target: number, source: number, kind: BuffKind, power: number, duration: number, skillId: number = 0, stack: boolean = false) {
        const buffs = this.ent.BuffModel.buffs;
        const existing = buffs.find((entry) => {
            return entry.camp === camp && entry.target === target && entry.source === source && entry.kind === kind && entry.skillId === skillId;
        });
        if (existing) {
            existing.power = stack ? existing.power + power : power;
            existing.remaining = duration;
            existing.duration = duration;
        } else {
            buffs.push({ camp, target, source, kind, power, remaining: duration, duration, tick: 0, skillId });
        }
        this.dispatchEvent(BuffEvent.Changed);
    }

    /** 汇总目标 target 的 kind 状态强度，零表示未施加该状态。 */
    get(camp: CombatCamp, target: number, kind: BuffKind) {
        return this.ent.BuffModel.buffs.reduce((sum, entry) => {
            const power = entry.kind === BuffKind.MoveSpeed ? entry.power * entry.remaining / entry.duration : entry.power;
            return sum + (entry.camp === camp && entry.target === target && entry.kind === kind && entry.remaining > 0 ? power : 0);
        }, 0);
    }

    /** 消耗目标的一次 kind 状态，用于免死和一次性护盾。 */
    consume(camp: CombatCamp, target: number, kind: BuffKind) {
        const entry = this.ent.BuffModel.buffs.find((buff) => {
            return buff.camp === camp && buff.target === target && buff.kind === kind && buff.remaining > 0;
        });
        if (!entry) {
            return false;
        }
        entry.remaining = 0;
        this.dispatchEvent(BuffEvent.Changed);
        return true;
    }

    /** 按 delta 秒推进状态，持续伤害不再次触发命中被动。 */
    update(delta: number) {
        const rule = TableCombatRule.getCurrent();
        const game = this.ent.game;
        const dotSpeed = game.player.PlayerModel.players.reduce((speed, player) => {
            return player.hp > 0 && player.roleId === RoleKeyEnum.Chronomancer ? Math.max(speed, 1 + player.skill.extraPower) : speed;
        }, 1);
        this.ent.BuffModel.buffs.slice().forEach((buff) => {
            if (buff.remaining <= 0) {
                return;
            }
            const step = Math.min(delta, buff.remaining);
            buff.remaining -= step;
            if (buff.kind === BuffKind.Dot) {
                buff.tick += step * dotSpeed;
                if (buff.tick >= rule.dotInterval) {
                    const enemy = game.enemy.EnemyModel.enemies.find((entry) => {
                        return entry.id === buff.target && !entry.dead;
                    });
                    if (enemy) {
                        game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, buff.power * buff.tick, buff.source, buff.skillId, false, true);
                    }
                    buff.tick = 0;
                }
            }
            if (buff.remaining <= 0 && buff.kind === BuffKind.Curse) {
                game.player.getBusiness<PlayerActionBll>(PlayerActionBll).expireCurse(buff);
            }
        });
        const count = this.ent.BuffModel.buffs.length;
        this.ent.BuffModel.buffs = this.ent.BuffModel.buffs.filter((buff) => {
            if (buff.remaining <= 0) {
                return false;
            }
            return buff.camp === CombatCamp.Player ? game.player.PlayerModel.players[buff.target].hp > 0 : game.enemy.EnemyModel.enemies.some((enemy) => {
                return enemy.id === buff.target && !enemy.dead;
            });
        });
        if (this.ent.BuffModel.buffs.length !== count) {
            this.dispatchEvent(BuffEvent.Changed);
        }
    }
}
