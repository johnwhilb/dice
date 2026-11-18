import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Player } from "../Player";
import { PlayerActionKind } from "../PlayerEvent";
import { PlayerBattleBll } from "./PlayerBattleBll";
import { PlayerBll } from "./PlayerBll";
import { PlayerPassiveBll } from "./PlayerPassiveBll";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { SkillTypeKeyEnum } from "../../common/table/SkillTypeKeyEnum";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { CombatBll } from "../../combat/bll/CombatBll";
import { CombatCamp } from "../../combat/CombatEvent";
import { ProjectileBll } from "../../projectile/bll/ProjectileBll";
import { SummonBll } from "../../summon/bll/SummonBll";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import type { IBuffData } from "../../buff/BuffEvent";
import type { IEnemyData } from "../../enemy/EnemyEvent";
import { EffectBll } from "../../effect/bll/EffectBll";

export class PlayerActionBll extends CCBusiness<Player> {
    /** 推进 delta 秒角色技能和延迟指令，仅存活角色发动主动技能。 */
    update(delta: number) {
        const game = this.ent.game;
        const model = this.ent.PlayerModel;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const pending = model.actions.slice();
        model.actions = [];
        pending.forEach((action) => {
            action.remaining -= delta;
            if (action.remaining > 0) {
                model.actions.push(action);
                return;
            }
            const player = model.players[action.source];
            if (action.kind === PlayerActionKind.Death) {
                if (player.hp > 0) {
                    this.ent.getBusiness<PlayerBll>(PlayerBll).setHp(action.source, 0);
                    this.onPlayerDeath(action.source);
                }
                return;
            }
            if (action.kind === PlayerActionKind.ProjectileArea) {
                game.combat.getBusiness<CombatBll>(CombatBll).area(action.source, player.skill.id, action.x, action.y, player.skill.radius / 2, action.damage, false);
                return;
            }
            if (player.hp <= 0) {
                return;
            }
            if (action.kind === PlayerActionKind.Repeat) {
                this.cast(action.source, true);
            } else if (action.kind === PlayerActionKind.Area) {
                game.combat.getBusiness<CombatBll>(CombatBll).area(action.source, player.skill.id, action.x, action.y, player.skill.radius, action.damage, action.proc);
            } else {
                this.fire(action.source, action.x, action.y, action.damage);
            }
        });
        model.players.forEach((player, index) => {
            if (player.hp <= 0) {
                return;
            }
            if (!player.initialized) {
                player.initialized = true;
                this.initialize(index);
            }
            player.auxiliaryTimer += delta;
            if (player.roleId === RoleKeyEnum.Engineer && player.skill.extraEvery > 0 && player.auxiliaryTimer >= player.skill.extraEvery) {
                player.auxiliaryTimer -= player.skill.extraEvery;
                for (let spawn = 0; spawn < player.skill.extraShots; spawn++) {
                    game.summon.getBusiness<SummonBll>(SummonBll).create(index, SummonTypeKeyEnum.Turret, player.pose.x, player.pose.y, stats.stats(index).damage);
                }
                game.summon.SummonModel.summons.forEach((summon) => {
                    if (summon.typeId === SummonTypeKeyEnum.Turret) {
                        summon.damage *= player.skill.extraPower;
                    }
                });
            }
            const attack = [SkillTypeKeyEnum.Projectile, SkillTypeKeyEnum.Area, SkillTypeKeyEnum.Curse, SkillTypeKeyEnum.GoldHit, SkillTypeKeyEnum.DotArea, SkillTypeKeyEnum.Force].includes(player.skill.kind) && !player.skill.follow || player.roleId === RoleKeyEnum.Vulcanist;
            player.attackTimer -= delta * (attack ? stats.stats(index).attackSpeedMultiplier : 1);
            if (player.skill.interval > 0 && player.attackTimer <= 0) {
                if (this.cast(index)) {
                    player.attackTimer += player.skill.interval;
                } else {
                    player.attackTimer = 0;
                }
            }
        });
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).update(delta);
    }

    /** 初始化 index 的免死、觉醒和灵能球，一场只处理一次。 */
    private initialize(index: number) {
        const game = this.ent.game;
        const player = this.ent.PlayerModel.players[index];
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const buffs = game.buff.getBusiness<BuffBll>(BuffBll);
        if (player.roleId === RoleKeyEnum.Priest && player.skill.extraShots > 0) {
            this.aliveIndices().slice().sort(() => {
                return Math.random() - .5;
            }).slice(0, player.skill.extraShots).forEach((target) => {
                buffs.add(CombatCamp.Player, target, index, BuffKind.Revive, 1, Number.MAX_SAFE_INTEGER, player.skill.id);
            });
        }
        if (stats.hasClass(index, RoleClassKeyEnum.Psyker) && stats.classLevel(RoleClassKeyEnum.Psyker) > 0) {
            const first = this.aliveIndices().find((target) => {
                return stats.hasClass(target, RoleClassKeyEnum.Psyker);
            });
            const count = 1 + (first === index ? stats.classValue(RoleClassKeyEnum.Psyker) + stats.item(ShopContentKeyEnum.ItemPsykerOrbs) : 0);
            for (let orb = 0; orb < count; orb++) {
                game.summon.getBusiness<SummonBll>(SummonBll).create(index, SummonTypeKeyEnum.PsykerOrb, player.pose.x, player.pose.y, stats.stats(index).damage);
            }
        }
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).initialize(index);
        if (player.roleId === RoleKeyEnum.PlagueDoctor && player.skill.extraPower > 0) {
            const summon = game.summon.getBusiness<SummonBll>(SummonBll);
            summon.zone(index, player.skill.id, player.pose.x, player.pose.y);
            const aura = game.summon.SummonModel.areas[game.summon.SummonModel.areas.length - 1];
            aura.follow = true;
            aura.radius *= TableCombatRule.getCurrent().critMultiplier;
            aura.life = Number.MAX_SAFE_INTEGER;
        }
    }

    /** 返回存活角色的队伍下标，阵容本身保持原顺序。 */
    aliveIndices() {
        return this.ent.PlayerModel.players.map((player, index) => {
            return player.hp > 0 ? index : -1;
        }).filter((index) => {
            return index >= 0;
        });
    }

    /** 将 source 的 kind 指令延迟 delay 秒执行，x、y 和 damage 为施放快照。 */
    queue(source: number, kind: PlayerActionKind, delay: number, x: number, y: number, damage: number, proc: boolean = true) {
        this.ent.PlayerModel.actions.push({ source, kind, remaining: delay, x, y, damage, proc });
    }

    /** 按角色技能配置施放 index 的技能，repeated 表示额外施法，不再触发术士重复。 */
    private cast(index: number, repeated: boolean = false) {
        const game = this.ent.game;
        const player = this.ent.PlayerModel.players[index];
        const skill = player.skill;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        const summon = game.summon.getBusiness<SummonBll>(SummonBll);
        const buffs = game.buff.getBusiness<BuffBll>(BuffBll);
        const rule = TableCombatRule.getCurrent();
        const enemies = player.roleId === RoleKeyEnum.Spellblade ? [] : combat.targets(player.pose.x, player.pose.y, skill.range);
        const target = skill.targetCenter || skill.kind === SkillTypeKeyEnum.GoldHit ? enemies[Math.floor(Math.random() * enemies.length)] : enemies[0];
        const requiresTarget = skill.kind === SkillTypeKeyEnum.Projectile || skill.kind === SkillTypeKeyEnum.Area || skill.kind === SkillTypeKeyEnum.Curse || skill.kind === SkillTypeKeyEnum.GoldHit || skill.kind === SkillTypeKeyEnum.Force;
        if (requiresTarget && skill.range > 0 && !target || buffs.get(CombatCamp.Player, index, BuffKind.Stun) || buffs.get(CombatCamp.Player, index, BuffKind.Silence)) {
            return false;
        }
        const group = player.roleId === RoleKeyEnum.Vulcanist ? combat.targets(player.pose.x, player.pose.y, Number.MAX_SAFE_INTEGER) : [];
        const x = group.length ? (player.pose.x + group.reduce((sum, enemy) => {
            return sum + enemy.x;
        }, 0) / group.length) / 2 : target && skill.targetCenter ? target.x : player.pose.x;
        const y = group.length ? (player.pose.y + group.reduce((sum, enemy) => {
            return sum + enemy.y;
        }, 0) / group.length) / 2 : target && skill.targetCenter ? target.y : player.pose.y;
        const damage = stats.stats(index).damage * skill.damage;
        if (!repeated) {
            player.castCount += 1;
        }
        if (skill.kind === SkillTypeKeyEnum.Projectile) {
            const targets = skill.allTargets ? enemies : target ? [target] : [];
            if (!targets.length && !skill.range) {
                const angle = Math.random() * Math.PI * 2;
                this.fire(index, player.pose.x + Math.cos(angle) * rule.chainRange, player.pose.y + Math.sin(angle) * rule.chainRange, damage);
            }
            targets.forEach((enemy) => {
                const count = player.roleId === RoleKeyEnum.Barrager && skill.extraEvery && player.castCount % skill.extraEvery === 0 ? skill.extraShots : skill.shots;
                for (let shot = 0; shot < count; shot++) {
                    this.fire(index, enemy.x, enemy.y, damage, shot, count);
                }
            });
            if (skill.summonId && Math.random() < skill.summonChance) {
                const count = player.roleId === RoleKeyEnum.Hunter ? Math.max(skill.extraShots, skill.shots) : Math.max(skill.extraShots, 1);
                for (let spawn = 0; spawn < count; spawn++) {
                    summon.create(index, skill.summonId, player.pose.x, player.pose.y, stats.stats(index).damage);
                }
            }
            if (player.roleId === RoleKeyEnum.DualGunner && skill.extraEvery && player.castCount % skill.extraEvery === 0 && target) {
                for (let shot = 0; shot < skill.extraShots; shot++) {
                    this.queue(index, PlayerActionKind.Shot, shot * skill.extraDelay, target.x, target.y, damage);
                }
            }
        } else if (skill.kind === SkillTypeKeyEnum.Area) {
            if (player.roleId === RoleKeyEnum.Elementor) {
                combat.squareArea(index, skill.id, x, y, skill.radius, damage, player.pose.angle * Math.PI / 180);
            } else {
                combat.area(index, skill.id, x, y, skill.radius, damage);
                this.areaStatuses(index, skill.id, x, y, skill.radius);
            }
            for (let repeat = 1; repeat < skill.shots; repeat++) {
                this.queue(index, PlayerActionKind.Area, repeat * skill.burstDelay, x, y, damage);
            }
        } else if (skill.kind === SkillTypeKeyEnum.DotArea || skill.kind === SkillTypeKeyEnum.Force) {
            summon.zone(index, skill.id, x, y, skill.kind === SkillTypeKeyEnum.Force);
        } else if (skill.kind === SkillTypeKeyEnum.Summon) {
            for (let spawn = 0; spawn < skill.shots; spawn++) {
                summon.create(index, skill.summonId, x, y, stats.stats(index).damage);
            }
        } else if (skill.kind === SkillTypeKeyEnum.HealOrb || skill.kind === SkillTypeKeyEnum.Fairy) {
            const arena = game.battle.BattleModel;
            summon.orb((Math.random() - .5) * arena.combatWidth, (Math.random() - .5) * arena.combatHeight, skill.shots);
            if (skill.kind === SkillTypeKeyEnum.Fairy) {
                this.aliveIndices().slice().sort(() => {
                    return Math.random() - .5;
                }).slice(0, skill.shots).forEach((targetIndex) => {
                    buffs.add(CombatCamp.Player, targetIndex, index, BuffKind.AttackSpeed, skill.power - 1, skill.duration, skill.id);
                });
            }
        } else if (skill.kind === SkillTypeKeyEnum.ChainBuff || skill.kind === SkillTypeKeyEnum.Shield) {
            const targets = skill.kind === SkillTypeKeyEnum.ChainBuff ? this.aliveIndices() : this.aliveIndices().slice().sort(() => {
                return Math.random() - .5;
            }).slice(0, skill.shots);
            targets.forEach((targetIndex) => {
                buffs.add(CombatCamp.Player, targetIndex, index, skill.kind === SkillTypeKeyEnum.ChainBuff ? BuffKind.Chain : BuffKind.Shield, skill.kind === SkillTypeKeyEnum.ChainBuff ? skill.power : 1, skill.duration, skill.id);
            });
        } else if (skill.kind === SkillTypeKeyEnum.Sacrifice) {
            this.aliveIndices().forEach((targetIndex) => {
                buffs.add(CombatCamp.Player, targetIndex, index, BuffKind.Damage, skill.power, Number.MAX_SAFE_INTEGER, skill.id, true);
            });
            combat.hitPlayer(index, damage);
        } else if (skill.kind === SkillTypeKeyEnum.GoldHit) {
            const all = combat.targets(x, y, Number.MAX_SAFE_INTEGER);
            const enemy = all[Math.floor(Math.random() * all.length)];
            if (enemy) {
                combat.hitEnemy(enemy, game.shop.ShopModel.gold * skill.damage, index, skill.id, true);
                if (!repeated) {
                    for (let cast = 0; cast < skill.extraShots && Math.random() < (skill.extraShots - cast) / (skill.extraShots + 2); cast++) {
                        this.queue(index, PlayerActionKind.Repeat, rule.repeatDelay * (cast + 1), x, y, damage);
                    }
                }
            }
        } else if (skill.kind === SkillTypeKeyEnum.Curse) {
            const count = skill.targets + stats.item(ShopContentKeyEnum.ItemMalediction) + stats.classValue(RoleClassKeyEnum.Curser);
            combat.targets(x, y, skill.radius).slice(0, count).forEach((enemy) => {
                buffs.add(CombatCamp.Enemy, enemy.id, index, BuffKind.Curse, 1, skill.duration, skill.id, player.roleId === RoleKeyEnum.Usurer);
                if (skill.silence) {
                    buffs.add(CombatCamp.Enemy, enemy.id, index, BuffKind.Silence, 1, skill.silence, skill.id);
                }
                if (skill.dot) {
                    buffs.add(CombatCamp.Enemy, enemy.id, index, BuffKind.Dot, damage * skill.dot, skill.duration, skill.id);
                }
                if (player.roleId === RoleKeyEnum.Usurer && skill.extraEvery) {
                    const debt = game.buff.BuffModel.buffs.find((entry) => {
                        return entry.camp === CombatCamp.Enemy && entry.target === enemy.id && entry.source === index && entry.kind === BuffKind.Curse && entry.skillId === skill.id;
                    });
                    if (debt.power >= skill.extraEvery) {
                        debt.power = 0;
                        combat.hitEnemy(enemy, damage * skill.extraPower, index, skill.id, false);
                    }
                }
                this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onCurse(index, enemy);
            });
        }
        if (!repeated && stats.hasClass(index, RoleClassKeyEnum.Sorcerer)) {
            const every = stats.classValue(RoleClassKeyEnum.Sorcerer);
            player.repeatCount += 1;
            if (every > 0 && player.repeatCount >= every) {
                player.repeatCount = 0;
                this.queue(index, PlayerActionKind.Repeat, rule.repeatDelay, x, y, damage);
                this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onRepeat(index, x, y);
            }
        }
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onAttack(index);
        return true;
    }

    /** 发射 index 的配置弹丸，shot、count 控制扇形、平行和连射。 */
    fire(index: number, x: number, y: number, damage: number, shot: number = 0, count: number = 1, proc: boolean = true, homing: boolean = false) {
        const player = this.ent.PlayerModel.players[index];
        const skill = player.skill;
        const stats = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const angle = Math.atan2(y - player.pose.y, x - player.pose.x) + (shot - (count - 1) / 2) * skill.spread;
        const rule = TableCombatRule.getCurrent();
        const muzzle = player.config.bodySize * rule.projectileMuzzle;
        const parallel = skill.parallel ? (shot - (count - 1) / 2) * player.config.bodySize : 0;
        const projectile = this.ent.game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(index, skill.id,
            player.pose.x + Math.cos(angle) * muzzle - Math.sin(angle) * parallel,
            player.pose.y + Math.sin(angle) * muzzle + Math.cos(angle) * parallel,
            angle, damage * (1 + stats.item(ShopContentKeyEnum.ItemBallista)), shot * skill.burstDelay, proc, homing);
        projectile.muzzle = {
            x: projectile.x - Math.cos(angle) * muzzle / 2,
            y: projectile.y - Math.sin(angle) * muzzle / 2,
        };
    }

    /** 对技能区域内敌人应用减速、眩晕、击退和火焰死亡标记。 */
    areaStatuses(source: number, skillId: number, x: number, y: number, radius: number) {
        const game = this.ent.game;
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        combat.targets(x, y, radius).forEach((enemy) => {
            this.applyStatuses(source, enemy, skill);
            if (this.ent.PlayerModel.players[source].roleId === RoleKeyEnum.Pyromancer && skill.extraPower > 0) {
                game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, enemy.id, source, BuffKind.Curse, 1, skill.interval, skillId);
            }
        });
    }

    /** 为 source 的技能命中 enemy 应用配置状态，状态不递归触发命中。 */
    private applyStatuses(source: number, enemy: IEnemyData, skill: TablePlayerSkill) {
        const game = this.ent.game;
        const buffs = game.buff.getBusiness<BuffBll>(BuffBll);
        if (skill.slow) {
            buffs.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Slow, skill.slow, Math.max(skill.duration, skill.interval), skill.id);
        }
        if (skill.stun) {
            buffs.add(CombatCamp.Enemy, enemy.id, source, BuffKind.Stun, 1, skill.stun, skill.id);
            if (skill.extraPower) {
                buffs.add(CombatCamp.Enemy, enemy.id, source, BuffKind.DamageTaken, skill.extraPower, skill.stun, skill.id);
            }
        }
        if (skill.knockback && skill.kind !== SkillTypeKeyEnum.Curse) {
            const player = this.ent.PlayerModel.players[source];
            game.combat.getBusiness<CombatBll>(CombatBll).push(enemy, Math.atan2(enemy.y - player.pose.y, enemy.x - player.pose.x), skill.knockback, source, player.stats.damage * skill.extraPower);
        }
    }

    /** 处理主动攻击命中，critical 表示此次暴击，damage 为减伤前伤害。 */
    onHit(source: number, enemy: IEnemyData, skillId: number, damage: number, critical: boolean) {
        const game = this.ent.game;
        const player = this.ent.PlayerModel.players[source];
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        this.applyStatuses(source, enemy, skill);
        if (skill.dot) {
            const multiplier = critical && skill.extraPower ? skill.extraPower : 1;
            game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, enemy.id, source, BuffKind.Dot, damage * skill.dot * multiplier, skill.duration, skill.id);
        }
        const summons = skill.critSummons * Number(critical) + (player.roleId === RoleKeyEnum.Corruptor ? skill.hitSummons : 0);
        this.critters(source, enemy.x, enemy.y, summons);
        if (critical && player.roleId === RoleKeyEnum.Thief && skill.extraPower) {
            game.enemy.EnemyModel.pickedUpGold += 1;
        }
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onHit(source, enemy, damage);
    }

    /** 炮手的炮弹在 x、y 引爆后，为 source 按技能参数排程一组分散的余爆。 */
    queueCannonAftershocks(source: number, skill: TablePlayerSkill, x: number, y: number, damage: number) {
        const spread = skill.radius * 2 / 3;
        for (let shot = 0; shot < skill.extraShots; shot++) {
            const offsetX = (Math.random() * 2 - 1) * spread;
            const offsetY = (Math.random() * 2 - 1) * spread;
            this.queue(source, PlayerActionKind.ProjectileArea, (shot + 1) * skill.extraDelay, x + offsetX, y + offsetY, damage * skill.extraPower, false);
        }
    }

    /** 在 x、y 生成 count 只 source 所属幼虫。 */
    critters(source: number, x: number, y: number, count: number) {
        const damage = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(source).damage;
        for (let index = 0; index < count; index++) {
            this.ent.game.summon.getBusiness<SummonBll>(SummonBll).create(source, SummonTypeKeyEnum.Critter, x, y, damage);
        }
    }

    /** 敌人死亡只触发一次诅咒和击杀被动，source 为击杀者，无归属时为负数。 */
    onEnemyDeath(enemy: IEnemyData, source: number, skillId: number) {
        if (enemy.deathResolved) {
            return;
        }
        enemy.deathResolved = true;
        const game = this.ent.game;
        game.buff.BuffModel.buffs.filter((buff) => {
            return buff.camp === CombatCamp.Enemy && buff.target === enemy.id && buff.kind === BuffKind.Curse && buff.remaining > 0 && buff.skillId > 0;
        }).forEach((buff) => {
            const player = this.ent.PlayerModel.players[buff.source];
            const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(buff.skillId);
            if (player.roleId === RoleKeyEnum.Infestor) {
                this.critters(buff.source, enemy.x, enemy.y, skill.killSummons);
            } else if (player.roleId === RoleKeyEnum.Jester) {
                const count = TableCombatRule.getCurrent().barrageCount;
                for (let shot = 0; shot < count; shot++) {
                    game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(buff.source, skill.id, enemy.x, enemy.y, shot * Math.PI * 2 / count, player.stats.damage, 0, false, skill.homing, true);
                }
            } else if (player.roleId === RoleKeyEnum.Bane) {
                game.summon.getBusiness<SummonBll>(SummonBll).zone(buff.source, skill.id, enemy.x, enemy.y);
            } else if (player.roleId === RoleKeyEnum.Pyromancer) {
                game.combat.getBusiness<CombatBll>(CombatBll).squareArea(buff.source, skill.id, enemy.x, enemy.y, skill.radius, player.stats.damage * skill.extraPower,
                    Math.random() * Math.PI * 2, false);
            }
        });
        if (source >= 0) {
            const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
            if (this.ent.PlayerModel.players[source].roleId === RoleKeyEnum.Corruptor) {
                this.critters(source, enemy.x, enemy.y, skill.killSummons);
            }
            this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onKill(source, enemy);
        }
    }

    /** 处理诅咒到期，发射者在延迟结束时启动敌人撞墙攻击。 */
    expireCurse(buff: IBuffData) {
        const player = this.ent.PlayerModel.players[buff.source];
        if (player.roleId !== RoleKeyEnum.Launcher) {
            return;
        }
        const enemy = this.ent.game.enemy.EnemyModel.enemies.find((entry) => {
            return entry.id === buff.target && !entry.dead;
        });
        if (enemy) {
            const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(buff.skillId);
            const angle = Math.floor(Math.random() * 4) * Math.PI / 2;
            this.ent.game.combat.getBusiness<CombatBll>(CombatBll).push(enemy, angle, skill.knockback, buff.source, this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll).stats(buff.source).damage * skill.damage);
        }
    }

    /** 受伤时累计守心者治疗、兽王幼虫及道具反应。 */
    onHurt(index: number, damage: number) {
        const game = this.ent.game;
        const player = this.ent.PlayerModel.players[index];
        if (player.roleId === RoleKeyEnum.Psykeeper) {
            player.storedDamage += damage;
            if (player.storedDamage >= player.stats.hp * player.skill.power) {
                player.storedDamage = 0;
                game.summon.getBusiness<SummonBll>(SummonBll).orb(player.pose.x, player.pose.y, player.skill.shots);
            }
            if (player.skill.extraPower) {
                game.combat.getBusiness<CombatBll>(CombatBll).area(index, player.skill.id, player.pose.x, player.pose.y, Number.MAX_SAFE_INTEGER, damage * player.skill.extraPower, false);
            }
        }
        if (player.roleId === RoleKeyEnum.Beastmaster) {
            this.critters(index, player.pose.x, player.pose.y, player.skill.hitSummons);
        }
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onHurt(index, damage);
    }

    /** 触发第七位延迟死亡，已触发过则不再延长。 */
    delayDeath(index: number) {
        const player = this.ent.PlayerModel.players[index];
        const duration = this.ent.getBusiness<PlayerBattleBll>(PlayerBattleBll).item(ShopContentKeyEnum.ItemLasting7);
        if (this.aliveIndices().indexOf(index) + 1 !== TableCombatRule.getCurrent().lastingPosition || !duration || player.lasting) {
            return false;
        }
        player.lasting = true;
        this.ent.game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Player, index, index, BuffKind.Invulnerable, 1, duration);
        this.queue(index, PlayerActionKind.Death, duration, 0, 0, 0);
        return true;
    }

    /** 角色 index 阵亡后的道具效果由被动业务统一处理。 */
    onPlayerDeath(index: number) {
        const player = this.ent.PlayerModel.players[index];
        this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showPlayerDeath(player.pose.x, player.pose.y, player.roleId);
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onDeath(index);
    }

    /** 拾取治疗球后处理 index 的加速与弹幕道具。 */
    onHealPickup(index: number) {
        this.ent.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onHealPickup(index);
    }

    /** 拾取金币时触发矿工和道具逻辑。 */
    onGoldPickup(x: number, y: number) {
        this.ent.PlayerModel.players.forEach((player, index) => {
            if (player.hp > 0 && player.roleId === RoleKeyEnum.Miner) {
                for (let shot = 0; shot < player.skill.shots; shot++) {
                    this.ent.game.projectile.getBusiness<ProjectileBll>(ProjectileBll).fire(index, player.skill.id, x, y, shot * Math.PI * 2 / player.skill.shots, player.stats.damage, 0, false, true);
                }
            }
        });
    }
}
