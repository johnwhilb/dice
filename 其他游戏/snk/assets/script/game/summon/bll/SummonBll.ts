import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Summon } from "../Summon";
import { TableSummonType } from "../../common/table/TableSummonType";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { PlayerBattleBll } from "../../player/bll/PlayerBattleBll";
import { PlayerActionBll } from "../../player/bll/PlayerActionBll";
import { CombatBll } from "../../combat/bll/CombatBll";
import { ProjectileBll } from "../../projectile/bll/ProjectileBll";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import type { ISummonData } from "../SummonEvent";
import { AreaFeedback } from "../../effect/EffectEvent";
import { EffectBll } from "../../effect/bll/EffectBll";

export class SummonBll extends CCBusiness<Summon> {
    /** 在 x、y 生成 source 所属的 typeId 造物，damage 为主人实时伤害快照。 */
    create(source: number, typeId: number, x: number, y: number, damage: number) {
        const game = this.ent.game;
        const config = TableSummonType.getConfigById<TableSummonType>(typeId);
        const stats = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const conjurer = 1 + stats.classValue(RoleClassKeyEnum.Conjurer);
        const critter = typeId === SummonTypeKeyEnum.Critter;
        const hp = config.hp + (critter ? stats.classValue(RoleClassKeyEnum.Swarmer) + stats.item(ShopContentKeyEnum.ItemHive) : 0);
        const data: ISummonData = { id: this.ent.SummonModel.nextId++, source, typeId, x, y, angle: Math.random() * Math.PI * 2, hp, life: config.life * conjurer,
            timer: 0, damage: damage * config.damage * conjurer, dead: false, createdAt: game.combat.CombatModel.elapsed };
        this.ent.SummonModel.summons.push(data);
        const owner = game.player.PlayerModel.players[source];
        game.effect.getBusiness<EffectBll>(EffectBll).showSpawnRing(x, y, critter ? 14 : 24, owner.roleId);
        return data;
    }

    /** 生成 count 个治疗球，治疗师羁绊可额外生成，随机位置由战场边界约束。 */
    orb(x: number, y: number, count: number) {
        const chance = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll).classValue(RoleClassKeyEnum.Healer);
        const effects = this.ent.game.effect.getBusiness<EffectBll>(EffectBll);
        for (let index = 0; index < count; index++) {
            if (this.ent.SummonModel.orbs.length >= TableCombatRule.getCurrent().orbLimit) {
                break;
            }
            this.ent.SummonModel.orbs.push({ x, y, dead: false });
            effects.showSpawnRing(x, y, 20, RoleKeyEnum.Cleric);
            if (Math.random() < chance) {
                this.ent.SummonModel.orbs.push({ x, y, dead: false });
            }
        }
    }

    /** 建立 source 的持续区域，force 决定聚拢或伤害，参数以技能表为准。 */
    zone(source: number, skillId: number, x: number, y: number, force: boolean = false, damageScale: number = 1) {
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        const stats = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(source);
        const radius = skill.zoneRadius > 0 ? skill.zoneRadius : skill.radius;
        const duration = skill.zoneDuration > 0 ? skill.zoneDuration : skill.duration;
        const angle = Math.random() * Math.PI * 2;
        const arcSpeed = force ? (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 2) * Math.PI : (Math.random() - 0.5) * Math.PI / 2;
        this.ent.SummonModel.areas.push({ source, skillId, x, y, shotTimer: 0, radius: radius * stats.areaSizeMultiplier, damage: stats.damage * skill.damage * damageScale,
            life: duration, timer: 0, interval: skill.tick, follow: skill.follow, force, speed: skill.projectileSpeed, angle,
            createdAt: this.ent.game.combat.CombatModel.elapsed, arcSpeed });
    }

    /** 更新 delta 秒造物、持续区域与治疗球拾取，width、height 为边界。 */
    update(delta: number, width: number, height: number) {
        const game = this.ent.game;
        const model = this.ent.SummonModel;
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        const stats = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const rule = TableCombatRule.getCurrent();
        model.areas.forEach((area) => {
            const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(area.skillId);
            const owner = game.player.PlayerModel.players[area.source];
            if (area.follow) {
                area.x = owner.pose.x;
                area.y = owner.pose.y;
                if (owner.hp <= 0) {
                    area.life = 0;
                    return;
                }
            } else if (owner.roleId === RoleKeyEnum.Witch) {
                area.x += Math.cos(area.angle) * area.speed * delta;
                area.y += Math.sin(area.angle) * area.speed * delta;
                if (Math.abs(area.x) > width / 2) {
                    area.angle = Math.PI - area.angle;
                }
                if (Math.abs(area.y) > height / 2) {
                    area.angle = -area.angle;
                }
            }
            area.life -= delta;
            area.shotTimer += delta;
            if (owner.roleId === RoleKeyEnum.Witch && skill.extraEvery > 0 && area.shotTimer >= skill.extraEvery) {
                area.shotTimer = 0;
                const target = combat.nearest(area.x, area.y, skill.radius, new Set<number>());
                if (target) {
                    game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(area.source, skill.id, area.x, area.y, Math.atan2(target.y - area.y, target.x - area.x), owner.stats.damage, 0, false, false, true);
                }
            }
            if (area.force) {
                combat.pull(area.x, area.y, area.radius, skill.pull, delta);
                if (area.life <= 0 && skill.extraPower > 0) {
                    combat.area(area.source, area.skillId, area.x, area.y, area.radius, stats.stats(area.source).damage * skill.extraPower, true, false, true, AreaFeedback.Targets);
                }
            } else {
                const chronomancer = game.player.PlayerModel.players.find((player) => {
                    return player.hp > 0 && player.roleId === RoleKeyEnum.Chronomancer;
                });
                area.timer += delta * (chronomancer ? 1 + chronomancer.skill.extraPower : 1);
                if (area.timer >= area.interval) {
                    game.player.getBusiness<PlayerActionBll>(PlayerActionBll).areaStatuses(area.source, area.skillId, area.x, area.y, area.radius);
                    combat.area(area.source, area.skillId, area.x, area.y, area.radius, area.damage * area.timer, false, true, true);
                    area.timer = 0;
                }
            }
        });
        model.summons.slice().forEach((summon) => {
            if (summon.dead) {
                return;
            }
            const config = TableSummonType.getConfigById<TableSummonType>(summon.typeId);
            const owner = game.player.PlayerModel.players[summon.source];
            const skill = owner.skill;
            summon.life -= delta;
            summon.timer += delta;
            const target = combat.nearest(summon.x, summon.y, config.range, new Set<number>());
            const allTarget = combat.nearest(summon.x, summon.y, Math.hypot(width, height), new Set<number>());
            if (config.orbit) {
                summon.angle += config.speed * delta * (1 + stats.item(ShopContentKeyEnum.ItemOrbitism));
                const radius = config.range * (1 + stats.item(ShopContentKeyEnum.ItemPsychosense));
                summon.x = owner.pose.x + Math.cos(summon.angle) * radius;
                summon.y = owner.pose.y + Math.sin(summon.angle) * radius;
                if (owner.hp <= 0) {
                    summon.life = 0;
                }
            } else if (config.speed > 0 && allTarget) {
                summon.angle = Math.atan2(allTarget.y - summon.y, allTarget.x - summon.x);
                const power = owner.roleId === RoleKeyEnum.Artificer ? 1 + skill.power : 1;
                summon.x += Math.cos(summon.angle) * config.speed * delta * power;
                summon.y += Math.sin(summon.angle) * config.speed * delta * power;
            }
            const fast = owner.roleId === RoleKeyEnum.Carver || owner.roleId === RoleKeyEnum.Vulcanist || owner.roleId === RoleKeyEnum.Sentry || owner.roleId === RoleKeyEnum.Artificer ? 1 + skill.power : 1;
            const interval = config.interval / fast;
            if (summon.timer >= interval && interval > 0) {
                if (config.heal) {
                    summon.attackAt = game.combat.CombatModel.elapsed;
                    this.orb(summon.x, summon.y, config.shots);
                    summon.timer = 0;
                } else if (summon.typeId === SummonTypeKeyEnum.Volcano) {
                    summon.attackAt = game.combat.CombatModel.elapsed;
                    combat.area(summon.source, skill.id, summon.x, summon.y, config.radius, summon.damage, true, false, false, AreaFeedback.Burst, Math.random() * Math.PI);
                    summon.timer = 0;
                } else if (target) {
                    if (config.orbit || summon.typeId === SummonTypeKeyEnum.Critter || summon.typeId === SummonTypeKeyEnum.Pet) {
                        summon.attackAt = game.combat.CombatModel.elapsed;
                        combat.hitEnemy(target, summon.damage * (config.orbit ? 1 + stats.item(ShopContentKeyEnum.ItemPsychosink) : 1), summon.source, skill.id, false);
                        if (!config.orbit) {
                            summon.hp -= 1;
                            const burst = stats.item(ShopContentKeyEnum.ItemBanelingBurst);
                            if (burst > 0) {
                                summon.hp = 0;
                                combat.area(summon.source, skill.id, summon.x, summon.y, config.radius, burst, false);
                            }
                        }
                    } else {
                        const rearm = 1 + stats.item(ShopContentKeyEnum.ItemRearm);
                        for (let shot = 0; shot < config.shots * rearm; shot++) {
                            const angle = summon.typeId === SummonTypeKeyEnum.Sentry ? summon.angle + shot * Math.PI * 2 / config.shots : Math.atan2(target.y - summon.y, target.x - summon.x);
                            const bullet = game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(summon.source, skill.id, summon.x, summon.y, angle, summon.damage, shot * rule.barrageInterval, false, false, true);
                            bullet.speed = rule.projectileSpeed;
                            bullet.bounces = skill.bounces;
                            bullet.summon = summon;
                        }
                    }
                    summon.timer = 0;
                }
            }
            const detonate = config.explode && config.speed > 0 && allTarget && Math.hypot(summon.x - allTarget.x, summon.y - allTarget.y) <= config.radius;
            if (target && summon.timer === 0 && Math.random() < stats.item(ShopContentKeyEnum.ItemTaunt)) {
                combat.targets(summon.x, summon.y, config.range).forEach((enemy) => {
                    game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, enemy.id, summon.source, BuffKind.Taunt, summon.id, rule.tauntDuration);
                });
            }
            if (summon.life <= 0 || summon.hp <= 0 || detonate) {
                summon.dead = true;
                if (config.explode || stats.item(ShopContentKeyEnum.ItemConstructInstability)) {
                    combat.area(summon.source, skill.id, summon.x, summon.y, config.radius, summon.damage * (config.explode ? skill.damage : stats.item(ShopContentKeyEnum.ItemConstructInstability)), false, false, false, AreaFeedback.Burst, Math.random() * Math.PI);
                }
                for (let shot = 0; shot < skill.deathShots; shot++) {
                    game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(summon.source, skill.id, summon.x, summon.y, shot * Math.PI * 2 / skill.deathShots, summon.damage, 0, false);
                }
            }
        });
        model.orbs.forEach((orb) => {
            const target = game.player.PlayerModel.players.filter((player) => {
                return player.hp > 0;
            }).sort((left, right) => {
                return Math.hypot(left.pose.x - orb.x, left.pose.y - orb.y) - Math.hypot(right.pose.x - orb.x, right.pose.y - orb.y);
            })[0];
            if (!target) {
                return;
            }
            const distance = Math.hypot(target.pose.x - orb.x, target.pose.y - orb.y);
            const magnet = stats.item(ShopContentKeyEnum.ItemMagnetism);
            if (distance <= (magnet > 0 ? rule.magnetAttract : rule.orbAttract)) {
                const step = Math.min(distance, rule.orbSpeed * delta);
                if (distance > 0) {
                    orb.x += (target.pose.x - orb.x) / distance * step;
                    orb.y += (target.pose.y - orb.y) / distance * step;
                }
                if (distance <= rule.healPickupRadius) {
                    const lowest = game.player.PlayerModel.players.filter((player) => {
                        return player.hp > 0;
                    }).sort((left, right) => {
                        return left.hp / left.stats.hp - right.hp / right.stats.hp;
                    })[0];
                    const index = game.player.PlayerModel.players.indexOf(lowest);
                    combat.heal(index, lowest.stats.hp * rule.healRatio);
                    game.player.getBusiness<PlayerActionBll>(PlayerActionBll).onHealPickup(game.player.PlayerModel.players.indexOf(target));
                    orb.dead = true;
                }
            }
        });
        model.summons = model.summons.filter((entry) => {
            return !entry.dead;
        });
        model.areas = model.areas.filter((entry) => {
            return entry.life > 0;
        });
        model.orbs = model.orbs.filter((entry) => {
            return !entry.dead;
        });
    }
}
