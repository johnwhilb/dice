import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Player } from "../Player";
import { PlayerBattleBll } from "./PlayerBattleBll";
import { PlayerActionBll } from "./PlayerActionBll";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { CombatBll } from "../../combat/bll/CombatBll";
import { ProjectileBll } from "../../projectile/bll/ProjectileBll";
import { SummonBll } from "../../summon/bll/SummonBll";
import type { IEnemyData } from "../../enemy/EnemyEvent";
import { EffectBll } from "../../effect/bll/EffectBll";
import { EffectKind } from "../../effect/EffectEvent";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import { PlayerActionKind } from "../PlayerEvent";
import { EnemySpawnBll } from "../../enemy/bll/EnemySpawnBll";
import { EnemyObjectKind } from "../../enemy/EnemyEvent";
import { TableEnemy } from "../../common/table/TableEnemy";

export class PlayerPassiveBll extends CCBusiness<Player> {
    /** 初始化 index 的开场道具，随机强化只在队首首次初始化时分配。 */
    initialize(index: number) {
        const action = this.ent.getBusiness<PlayerActionBll>(PlayerActionBll);
        const alive = action.aliveIndices();
        if (index !== alive[0]) {
            return;
        }
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const buff = this.ent.game.buff.getBusiness<BuffBll>(BuffBll);
        const mages = alive.filter((target) => {
            return stats.hasClass(target, RoleClassKeyEnum.Mage);
        });
        if (mages.length && stats.item(ShopContentKeyEnum.ItemAwakening)) {
            const target = mages[Math.floor(Math.random() * mages.length)];
            const value = stats.item(ShopContentKeyEnum.ItemAwakening);
            buff.add(CombatCamp.Player, target, index, BuffKind.Damage, value, Number.MAX_SAFE_INTEGER);
            buff.add(CombatCamp.Player, target, index, BuffKind.AttackSpeed, value, Number.MAX_SAFE_INTEGER);
        }
        if (stats.classCount(RoleClassKeyEnum.Enchanter) >= 2 && stats.item(ShopContentKeyEnum.ItemEnchanted)) {
            const target = alive[Math.floor(Math.random() * alive.length)];
            buff.add(CombatCamp.Player, target, index, BuffKind.AttackSpeed, stats.item(ShopContentKeyEnum.ItemEnchanted), Number.MAX_SAFE_INTEGER);
        }
    }

    /** 创建 source 的通用附加弹幕，count 为弹丸数，homing 控制追踪。 */
    barrage(source: number, count: number, homing: boolean, x: number, y: number, ricochet: boolean = false) {
        const player = this.ent.PlayerModel.players[source];
        const combat = this.ent.game.combat.getBusiness<CombatBll>(CombatBll);
        const rule = TableCombatRule.getCurrent();
        const target = combat.nearest(x, y, rule.chainRange, new Set<number>());
        const angle = target ? Math.atan2(target.y - y, target.x - x) : player.pose.angle * Math.PI / 180;
        const damage = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(source).damage;
        for (let shot = 0; shot < count; shot++) {
            const bullet = this.ent.game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(source, player.skill.id, x, y, angle + (shot - (count - 1) / 2) * rule.barrageSpread, damage, shot * rule.barrageInterval, false, homing, true);
            bullet.bounces += Number(ricochet);
        }
    }

    /** 按 delta 秒推进周期道具，触摸转向持续量用于衔尾蛇左右旋转判定。 */
    update(delta: number) {
        const model = this.ent.PlayerModel;
        const game = this.ent.game;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const action = this.ent.getBusiness<PlayerActionBll>(PlayerActionBll);
        const alive = action.aliveIndices();
        if (!alive.length) {
            return;
        }
        const head = alive[0];
        const player = model.players[head];
        model.turnAmount += Math.atan2(Math.sin(model.heading - model.lastHeading), Math.cos(model.heading - model.lastHeading));
        model.lastHeading = model.heading;
        model.turnElapsed += delta;
        const rule = TableCombatRule.getCurrent();
        if (model.turnElapsed >= rule.turnInterval) {
            model.turnDirection = Math.abs(model.turnAmount) >= rule.turnThreshold ? Math.sign(model.turnAmount) : 0;
            model.turnElapsed = 0;
            model.turnAmount = 0;
        }
        const buff = game.buff.getBusiness<BuffBll>(BuffBll);
        if (model.turnDirection < 0 && stats.item(ShopContentKeyEnum.ItemOuroborosTechniqueL)) {
            alive.forEach((target) => {
                buff.add(CombatCamp.Player, target, head, BuffKind.Defense, stats.item(ShopContentKeyEnum.ItemOuroborosTechniqueL), rule.turnInterval);
            });
        }
        game.shop.ShopModel.items.forEach((item) => {
            const elapsed = model.passiveTimers.has(item.contentId) ? model.passiveTimers.get(item.contentId) + delta : delta;
            model.passiveTimers.set(item.contentId, elapsed);
            let interval = 0;
            if (item.contentId === ShopContentKeyEnum.ItemDivineBlessing || item.contentId === ShopContentKeyEnum.ItemPsycholeak) {
                interval = stats.item(item.contentId);
            } else if (item.contentId === ShopContentKeyEnum.ItemDivinePunishment) {
                interval = rule.divinePunishmentInterval;
            } else if (item.contentId === ShopContentKeyEnum.ItemShoot5) {
                interval = 1 / stats.item(item.contentId);
            } else if (item.contentId === ShopContentKeyEnum.ItemDeath6) {
                interval = rule.deathInterval;
            } else if (item.contentId === ShopContentKeyEnum.ItemOuroborosTechniqueR) {
                interval = 1 / stats.item(item.contentId);
            }
            if (interval <= 0 || elapsed < interval) {
                return;
            }
            model.passiveTimers.set(item.contentId, elapsed - interval);
            if (item.contentId === ShopContentKeyEnum.ItemDivineBlessing) {
                game.summon.getBusiness<SummonBll>(SummonBll).orb(player.pose.x, player.pose.y, 1);
            } else if (item.contentId === ShopContentKeyEnum.ItemPsycholeak) {
                game.summon.getBusiness<SummonBll>(SummonBll).create(head, SummonTypeKeyEnum.PsykerOrb, player.pose.x, player.pose.y, stats.stats(head).damage);
            } else if (item.contentId === ShopContentKeyEnum.ItemDivinePunishment) {
                const damage = stats.item(item.contentId) * stats.classCount(RoleClassKeyEnum.Mage);
                game.enemy.EnemyModel.enemies.slice().forEach((enemy) => {
                    game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, damage, head, player.skill.id, false);
                });
            } else if (item.contentId === ShopContentKeyEnum.ItemDeath6 && alive.length >= rule.deathPosition) {
                const target = alive[rule.deathPosition - 1];
                game.combat.getBusiness<CombatBll>(CombatBll).hitPlayer(target, model.players[target].stats.hp * stats.item(item.contentId));
            } else if (item.contentId === ShopContentKeyEnum.ItemShoot5 && alive.length >= rule.shootPosition) {
                const target = alive[rule.shootPosition - 1];
                this.barrage(target, 1, false, model.players[target].pose.x, model.players[target].pose.y);
            } else if (item.contentId === ShopContentKeyEnum.ItemOuroborosTechniqueR && model.turnDirection > 0) {
                this.barrage(head, 1, false, player.pose.x, player.pose.y);
            }
        });
    }

    /** source 主动攻击时触发游侠羁绊弹幕。 */
    onAttack(source: number) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        if (stats.hasClass(source, RoleClassKeyEnum.Ranger) && Math.random() < stats.classValue(RoleClassKeyEnum.Ranger)) {
            const player = this.ent.PlayerModel.players[source];
            this.barrage(source, TableCombatRule.getCurrent().barrageCount, false, player.pose.x, player.pose.y);
        }
    }

    /** source 命中 enemy 时处理道具；额外伤害均关闭再次触发，避免无限递归。 */
    onHit(source: number, enemy: IEnemyData, damage: number) {
        const game = this.ent.game;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        const buff = game.buff.getBusiness<BuffBll>(BuffBll);
        const player = this.ent.PlayerModel.players[source];
        const skill = player.skill;
        const rule = TableCombatRule.getCurrent();
        const dotChance = stats.item(ShopContentKeyEnum.ItemNoxiousStrike) + stats.item(ShopContentKeyEnum.ItemBurningStrike);
        if (Math.random() < dotChance) {
            buff.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Dot, damage * rule.poisonDamageRatio, rule.defaultDotDuration, skill.id);
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemStunningStrike)) {
            buff.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Stun, 1, rule.statusDuration);
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemSilencingStrike)) {
            buff.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Silence, 1, rule.statusDuration);
        }
        const ranger = stats.hasClass(source, RoleClassKeyEnum.Ranger);
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemKineticStrike) + (ranger ? stats.item(ShopContentKeyEnum.ItemBluntArrow) : 0)) {
            combat.push(enemy, Math.atan2(enemy.y - player.pose.y, enemy.x - player.pose.x), rule.orbSpeed, source);
        }
        if (ranger && Math.random() < stats.item(ShopContentKeyEnum.ItemExplosiveArrow)) {
            combat.area(source, skill.id, enemy.x, enemy.y, rule.fieldRadius, damage * stats.item(ShopContentKeyEnum.ItemExplosiveArrow), false);
        }
        const infused = buff.get(CombatCamp.Player, source, BuffKind.Chain);
        if (infused || Math.random() < stats.item(ShopContentKeyEnum.ItemLightningStrike)) {
            const targets = combat.targets(enemy.x, enemy.y, rule.chainRange).filter((entry) => {
                return entry.id !== enemy.id;
            }).slice(0, infused ? rule.chainInfusionCount : rule.lightningCount);
            targets.forEach((target) => {
                combat.hitEnemy(target, damage * (infused > 0 ? infused : rule.lightningBase + rule.lightningStep * stats.itemLevel(ShopContentKeyEnum.ItemLightningStrike)), source, skill.id, false);
                game.effect.getBusiness<EffectBll>(EffectBll).show(EffectKind.Chain, enemy.x, enemy.y, 0, 0, player.roleId, target.x, target.y);
            });
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemLuckyStrike)) {
            enemy.bonusGold = true;
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemInfestingStrike)) {
            buff.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Curse, 1, Number.MAX_SAFE_INTEGER);
        }
        if (enemy.hp > 0 && !enemy.config.boss && enemy.config.id !== EnemyKeyEnum.Seeker && enemy.hp / enemy.maxHp < stats.item(ShopContentKeyEnum.ItemCullingStrike)) {
            combat.hitEnemy(enemy, enemy.maxHp * TableCombatRule.getCurrent().rogueCritMultiplier, source, skill.id, false);
        }
        if (skill.radius && Math.random() < stats.item(ShopContentKeyEnum.ItemEchoBarrage)) {
            for (let repeat = 0; repeat < stats.itemLevel(ShopContentKeyEnum.ItemEchoBarrage); repeat++) {
                this.ent.getBusiness<PlayerActionBll>(PlayerActionBll).queue(source, PlayerActionKind.Area, (repeat + 1) * rule.repeatDelay, enemy.x, enemy.y, damage / 2, false);
            }
        }
    }

    /** source 击杀 enemy 后触发匕首、追踪弹幕、治疗球和幼虫。 */
    onKill(source: number, enemy: IEnemyData) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const rule = TableCombatRule.getCurrent();
        if (stats.item(ShopContentKeyEnum.ItemCeremonialDagger)) {
            this.barrage(source, 1, true, enemy.x, enemy.y);
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemHomingBarrage)) {
            this.barrage(source, rule.barrageCount, true, enemy.x, enemy.y);
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemHealingStrike)) {
            this.ent.game.summon.getBusiness<SummonBll>(SummonBll).orb(enemy.x, enemy.y, 1);
        }
        if (this.ent.game.buff.BuffModel.buffs.some((entry) => {
            return entry.target === enemy.id && entry.camp === CombatCamp.Enemy && entry.kind === BuffKind.Curse && entry.skillId === 0;
        })) {
            this.ent.getBusiness<PlayerActionBll>(PlayerActionBll).critters(source, enemy.x, enemy.y, rule.infestingCount);
        }
        if (enemy.bonusGold) {
            this.ent.game.enemy.getBusiness<EnemySpawnBll>(EnemySpawnBll).createObject(EnemyObjectKind.Gold, enemy, 0, 0, 0, 0, 0);
        }
    }

    /** source 诅咒 enemy 时附加邪触和厄运。 */
    onCurse(source: number, enemy: IEnemyData) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const buff = this.ent.game.buff.getBusiness<BuffBll>(BuffBll);
        const damage = stats.item(ShopContentKeyEnum.ItemHextouch);
        if (damage) {
            buff.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Dot, damage, TableCombatRule.getCurrent().defaultDotDuration);
        }
        const doom = stats.item(ShopContentKeyEnum.ItemWhispersOfDoom);
        if (doom) {
            enemy.doom += 1;
            const threshold = TableCombatRule.getCurrent().doomBase - stats.itemLevel(ShopContentKeyEnum.ItemWhispersOfDoom);
            if (enemy.doom >= threshold) {
                enemy.doom = 0;
                this.ent.game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, doom, source, this.ent.PlayerModel.players[source].skill.id, false);
            }
        }
    }

    /** index 受伤时处理反伤、附魔师回报和战士防御成长。 */
    onHurt(index: number, damage: number) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const player = this.ent.PlayerModel.players[index];
        const combat = this.ent.game.combat.getBusiness<CombatBll>(CombatBll);
        const reflect = stats.item(ShopContentKeyEnum.ItemCrucio);
        if (reflect) {
            this.ent.game.enemy.EnemyModel.enemies.slice().forEach((enemy) => {
                combat.hitEnemy(enemy, damage * reflect, index, player.skill.id, false);
            });
        }
        const damageBuff = stats.hasClass(index, RoleClassKeyEnum.Enchanter) ? stats.item(ShopContentKeyEnum.ItemPayback) : 0;
        const defenseBuff = stats.hasClass(index, RoleClassKeyEnum.Warrior) ? stats.item(ShopContentKeyEnum.ItemUnrelentingStance) : 0;
        const buff = this.ent.game.buff.getBusiness<BuffBll>(BuffBll);
        this.ent.getBusiness<PlayerActionBll>(PlayerActionBll).aliveIndices().forEach((target) => {
            if (damageBuff) {
                buff.add(CombatCamp.Player, target, index, BuffKind.Damage, damageBuff, Number.MAX_SAFE_INTEGER, 0, true);
            }
            if (defenseBuff) {
                buff.add(CombatCamp.Player, target, index, BuffKind.Defense, defenseBuff, Number.MAX_SAFE_INTEGER, 0, true);
            }
        });
    }

    /** index 死亡后处理爆炸、硬化、最后一战和虚空使持续伤害。 */
    onDeath(index: number) {
        const game = this.ent.game;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const player = this.ent.PlayerModel.players[index];
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        const force = stats.item(ShopContentKeyEnum.ItemKineticBomb);
        if (force) {
            combat.targets(player.pose.x, player.pose.y, TableCombatRule.getCurrent().chainRange).forEach((enemy) => {
                combat.push(enemy, Math.atan2(enemy.y - player.pose.y, enemy.x - player.pose.x), force, index);
            });
        }
        const count = stats.item(ShopContentKeyEnum.ItemPorcupineTechnique);
        if (count) {
            this.barrage(index, count, false, player.pose.x, player.pose.y, true);
        }
        const buff = game.buff.getBusiness<BuffBll>(BuffBll);
        if (stats.item(ShopContentKeyEnum.ItemInsurance) && Math.random() < stats.classValue(RoleClassKeyEnum.Mercenary) * stats.item(ShopContentKeyEnum.ItemInsurance)) {
            const config = TableEnemy.getConfigById<TableEnemy>(EnemyKeyEnum.Seeker);
            for (let gold = 0; gold < TableCombatRule.getCurrent().insuranceGold; gold++) {
                game.enemy.getBusiness<EnemySpawnBll>(EnemySpawnBll).createObject(EnemyObjectKind.Gold, { id: index, config, x: player.pose.x, y: player.pose.y, damage: 0 }, 0, 0, 0, 0, 0);
            }
        }
        const alive = this.ent.getBusiness<PlayerActionBll>(PlayerActionBll).aliveIndices();
        alive.forEach((target) => {
            if (stats.item(ShopContentKeyEnum.ItemHardening)) {
                buff.add(CombatCamp.Player, target, index, BuffKind.Defense, stats.item(ShopContentKeyEnum.ItemHardening), TableCombatRule.getCurrent().hardeningDuration);
            }
        });
        if (alive.length === 1 && stats.item(ShopContentKeyEnum.ItemLastStand)) {
            const target = this.ent.PlayerModel.players[alive[0]];
            if (!target.lastStand) {
                target.lastStand = true;
                combat.heal(alive[0], target.stats.hp);
            }
        }
        if (stats.hasClass(index, RoleClassKeyEnum.Voider) && stats.item(ShopContentKeyEnum.ItemAnnihilation)) {
            game.enemy.EnemyModel.enemies.forEach((enemy) => {
                buff.add(CombatCamp.Enemy, enemy.id, index, BuffKind.Dot, player.stats.damage, stats.item(ShopContentKeyEnum.ItemAnnihilation));
            });
        }
    }

    /** index 拾取治疗球时处理衰减加速和神圣弹幕。 */
    onHealPickup(index: number) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const player = this.ent.PlayerModel.players[index];
        if (stats.item(ShopContentKeyEnum.ItemHaste)) {
            this.ent.getBusiness<PlayerActionBll>(PlayerActionBll).aliveIndices().forEach((target) => {
                this.ent.game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Player, target, index, BuffKind.MoveSpeed, stats.item(ShopContentKeyEnum.ItemHaste), TableCombatRule.getCurrent().hasteDuration);
            });
        }
        if (Math.random() < stats.item(ShopContentKeyEnum.ItemDivineBarrage)) {
            this.barrage(index, TableCombatRule.getCurrent().barrageCount, false, player.pose.x, player.pose.y, true);
        }
    }

    /** 术士 source 重复施法时在 x、y 附加道具区域。 */
    onRepeat(source: number, x: number, y: number) {
        const game = this.ent.game;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const rule = TableCombatRule.getCurrent();
        const radius = rule.fieldRadius;
        const targets = game.combat.getBusiness<CombatBll>(CombatBll).targets(x, y, radius);
        targets.forEach((enemy) => {
            if (stats.item(ShopContentKeyEnum.ItemFreezingField)) {
                game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, enemy.id, source, BuffKind.Slow, stats.item(ShopContentKeyEnum.ItemFreezingField), rule.fieldDuration);
            }
            if (stats.item(ShopContentKeyEnum.ItemBurningField)) {
                game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, enemy.id, source, BuffKind.Dot, stats.item(ShopContentKeyEnum.ItemBurningField), rule.fieldDuration);
            }
        });
        if (stats.item(ShopContentKeyEnum.ItemGravityField)) {
            game.combat.getBusiness<CombatBll>(CombatBll).pull(x, y, radius, rule.orbSpeed, stats.item(ShopContentKeyEnum.ItemGravityField));
        }
    }

    /** source 击退的敌人 enemy 撞墙时触发震颤、重击和碎裂。 */
    onWall(source: number, enemy: IEnemyData) {
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const player = this.ent.PlayerModel.players[source];
        const combat = this.ent.game.combat.getBusiness<CombatBll>(CombatBll);
        const force = Math.hypot(enemy.knockbackX, enemy.knockbackY);
        if (stats.item(ShopContentKeyEnum.ItemHeavyImpact)) {
            combat.hitEnemy(enemy, force * stats.item(ShopContentKeyEnum.ItemHeavyImpact), source, player.skill.id, false);
        }
        if (stats.item(ShopContentKeyEnum.ItemTremor)) {
            combat.area(source, player.skill.id, enemy.x, enemy.y, force * stats.item(ShopContentKeyEnum.ItemTremor), force, false);
        }
        if (stats.item(ShopContentKeyEnum.ItemFracture)) {
            this.barrage(source, stats.item(ShopContentKeyEnum.ItemFracture), false, enemy.x, enemy.y);
        }
    }
}
