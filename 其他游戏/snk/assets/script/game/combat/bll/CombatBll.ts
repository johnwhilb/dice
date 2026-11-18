import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Combat } from "../Combat";
import { CombatCamp, CombatEvent } from "../CombatEvent";
import { BuffKind } from "../../buff/BuffEvent";
import { BuffBll } from "../../buff/bll/BuffBll";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { PlayerBll } from "../../player/bll/PlayerBll";
import { PlayerBattleBll } from "../../player/bll/PlayerBattleBll";
import { PlayerActionBll } from "../../player/bll/PlayerActionBll";
import { EnemyActionBll } from "../../enemy/bll/EnemyActionBll";
import type { IEnemyData } from "../../enemy/EnemyEvent";
import { EffectBll } from "../../effect/bll/EffectBll";
import { EffectKind } from "../../effect/EffectEvent";
import { ProjectileBll } from "../../projectile/bll/ProjectileBll";
import { SummonBll } from "../../summon/bll/SummonBll";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";

export class CombatBll extends CCBusiness<Combat> {
    /** 清理新战斗或跳关时的所有临时对象，保留商店阵容与资源。 */
    reset() {
        const game = this.ent.game;
        this.ent.CombatModel.reset();
        game.buff.BuffModel.reset();
        game.projectile.ProjectileModel.reset();
        game.summon.SummonModel.reset();
        game.effect.EffectModel.reset();
    }

    /** 返回中心 x、y 周围 range 内的存活敌人，按距离排序。 */
    targets(x: number, y: number, range: number) {
        return this.ent.game.enemy.EnemyModel.enemies.filter((enemy) => {
            return !enemy.dead && Math.hypot(enemy.x - x, enemy.y - y) <= range;
        }).sort((left, right) => {
            return Math.hypot(left.x - x, left.y - y) - Math.hypot(right.x - x, right.y - y);
        });
    }

    /** 查找最近敌人，excluded 为已命中的实例集合。 */
    nearest(x: number, y: number, range: number, excluded: Set<number>) {
        return this.targets(x, y, range).find((enemy) => {
            return !excluded.has(enemy.id);
        });
    }

    /** 将中心范围内的敌人按 speed 速度吸引，delta 为时间步长。 */
    pull(x: number, y: number, range: number, speed: number, delta: number) {
        this.targets(x, y, range).forEach((enemy) => {
            const distance = Math.hypot(x - enemy.x, y - enemy.y);
            if (distance > 0) {
                const step = Math.min(distance, speed * delta);
                enemy.x += (x - enemy.x) / distance * step;
                enemy.y += (y - enemy.y) / distance * step;
            }
        });
    }

    /** 对 enemy 施加 angle 弧度方向的击退，source 为角色下标，wallDamage 为撞墙伤害。 */
    push(enemy: IEnemyData, angle: number, speed: number, source: number, wallDamage: number = 0) {
        const stats = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const force = speed * (1 + stats.classValue(RoleClassKeyEnum.Forcer));
        enemy.knockbackX = Math.cos(angle) * force;
        enemy.knockbackY = Math.sin(angle) * force;
        enemy.knockbackRemaining = TableCombatRule.getCurrent().pushDuration;
        enemy.wallDamage = wallDamage;
        enemy.wallSource = source;
    }

    /** 使用原版正负防御公式换算 damage，避免负防御时出现除零。 */
    mitigate(damage: number, defense: number) {
        const base = TableBattleRule.getCurrent().defenseBase;
        return damage * (defense >= 0 ? base / (base + defense) : 2 - base / (base - defense));
    }

    /** 结算敌人伤害，source 小于零表示敌方友伤或无玩家归属；proc、dot 区分触发链。 */
    hitEnemy(enemy: IEnemyData, damage: number, source: number = -1, skillId: number = 0, proc: boolean = false, dot: boolean = false) {
        if (enemy.dead) {
            return;
        }
        const game = this.ent.game;
        const stats = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const action = game.player.getBusiness<PlayerActionBll>(PlayerActionBll);
        const buffs = game.buff.getBusiness<BuffBll>(BuffBll);
        const rule = TableCombatRule.getCurrent();
        const sourceSkillId = source >= 0 && skillId === 0 ? game.player.PlayerModel.players[source].skill.id : skillId;
        let amount = damage;
        let critical = false;
        if (source >= 0) {
            if (proc && !dot) {
                const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(sourceSkillId);
                const rogue = stats.hasClass(source, RoleClassKeyEnum.Rogue);
                const chance = stats.item(ShopContentKeyEnum.ItemCriticalStrike) + skill.critChance + (rogue ? stats.classValue(RoleClassKeyEnum.Rogue) : 0);
                critical = Math.random() < chance;
                if (critical) {
                    const assassination = stats.item(ShopContentKeyEnum.ItemAssassination);
                    amount *= rogue ? assassination > 0 ? assassination : rule.rogueCritMultiplier : rule.critMultiplier;
                    const player = game.player.PlayerModel.players[source];
                    if (player.roleId === RoleKeyEnum.Thief && skill.extraPower) {
                        amount *= skill.extraPower;
                    }
                } else if (rogue && stats.item(ShopContentKeyEnum.ItemAssassination)) {
                    amount /= rule.critMultiplier;
                }
            }
            amount *= 1 + stats.item(ShopContentKeyEnum.ItemVulnerability);
            if (dot) {
                amount *= 1 + stats.item(ShopContentKeyEnum.ItemCallOfTheVoid);
                if (stats.hasClass(source, RoleClassKeyEnum.Voider)) {
                    amount *= 1 + stats.classValue(RoleClassKeyEnum.Voider);
                }
            }
        }
        let defense = enemy.config.defense - stats.classValue(RoleClassKeyEnum.Mage);
        if (buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.Dot)) {
            defense *= 1 - stats.item(ShopContentKeyEnum.ItemSeeping);
        }
        amount = Math.max(0, this.mitigate(amount, defense) * (1 + buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.DamageTaken)));
        if (amount > 0) {
            enemy.hitTime = this.ent.CombatModel.elapsed;
        }
        game.enemy.getBusiness<EnemyActionBll>(EnemyActionBll).applyDamage(enemy, amount);
        game.effect.getBusiness<EffectBll>(EffectBll).show(EffectKind.Damage, enemy.x, enemy.y, 0, amount, source >= 0 ? game.player.PlayerModel.players[source].roleId : 0);
        if (source >= 0 && proc) {
            action.onHit(source, enemy, sourceSkillId, damage, critical);
        }
        if (enemy.dead) {
            action.onEnemyDeath(enemy, source, sourceSkillId);
        }
    }

    /** 在 x、y 周围造成范围伤害，半径和伤害受施放者实时属性影响。 */
    area(source: number, skillId: number, x: number, y: number, radius: number, damage: number, proc: boolean = true, dot: boolean = false, scaledRadius: boolean = false) {
        const game = this.ent.game;
        const stats = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const values = stats.stats(source);
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        const range = scaledRadius ? radius : radius * values.areaSizeMultiplier;
        const targets = this.targets(x, y, range);
        const amount = damage * values.areaDamageMultiplier * (1 + (skill.perTarget + stats.item(ShopContentKeyEnum.ItemResonance)) * targets.length);
        targets.forEach((enemy) => {
            this.hitEnemy(enemy, amount, source, skillId, proc, dot);
        });
        game.effect.getBusiness<EffectBll>(EffectBll).show(EffectKind.Area, x, y, range, 0, game.player.PlayerModel.players[source].roleId);
    }

    /** 对角色 index 结算伤害，统一处理护盾、免死、受伤事件和死亡技能。 */
    hitPlayer(index: number, damage: number) {
        const game = this.ent.game;
        const player = game.player.PlayerModel.players[index];
        const buffs = game.buff.getBusiness<BuffBll>(BuffBll);
        if (player.hp <= 0 || buffs.get(CombatCamp.Player, index, BuffKind.Invulnerable) || buffs.get(CombatCamp.Player, index, BuffKind.Shield)) {
            return;
        }
        const stats = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(index);
        const actual = Math.max(0, this.mitigate(damage, stats.defense));
        let hp = Math.max(0, player.hp - actual);
        if (hp <= 0 && buffs.consume(CombatCamp.Player, index, BuffKind.Revive)) {
            hp = stats.hp;
        }
        const action = game.player.getBusiness<PlayerActionBll>(PlayerActionBll);
        if (hp <= 0 && action.delayDeath(index)) {
            hp = stats.hp;
        }
        game.player.getBusiness<PlayerBll>(PlayerBll).setHp(index, hp);
        action.onHurt(index, actual);
        game.effect.getBusiness<EffectBll>(EffectBll).show(EffectKind.Damage, player.pose.x, player.pose.y, 0, actual, player.roleId);
        if (player.hp <= 0) {
            action.onPlayerDeath(index);
        }
    }

    /** 治疗存活角色 index，应用治疗道具倍率并通过 Player 事件更新血条。 */
    heal(index: number, amount: number) {
        const game = this.ent.game;
        const player = game.player.PlayerModel.players[index];
        if (player.hp <= 0) {
            return;
        }
        const power = 1 + game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll).item(ShopContentKeyEnum.ItemBlessing);
        const healed = Math.min(player.stats.hp - player.hp, amount * power);
        game.player.getBusiness<PlayerBll>(PlayerBll).setHp(index, player.hp + healed);
        game.effect.getBusiness<EffectBll>(EffectBll).show(EffectKind.Heal, player.pose.x, player.pose.y, 0, healed, player.roleId);
    }

    /** 推进 delta 秒共用战斗模块，角色攻击先于弹丸命中，最后更新短时表现。 */
    update(delta: number, width: number, height: number) {
        const game = this.ent.game;
        this.ent.CombatModel.elapsed += delta;
        game.buff.getBusiness<BuffBll>(BuffBll).update(delta);
        game.player.getBusiness<PlayerActionBll>(PlayerActionBll).update(delta);
        game.summon.getBusiness<SummonBll>(SummonBll).update(delta, width, height);
        game.projectile.getBusiness<ProjectileBll>(ProjectileBll).update(delta, width, height);
        game.effect.getBusiness<EffectBll>(EffectBll).update(delta);
    }

    /** 一帧模拟结束后同步玩家弹丸、召唤物和表现。 */
    refreshView() {
        this.dispatchEvent(CombatEvent.UpdateFrame);
    }
}
