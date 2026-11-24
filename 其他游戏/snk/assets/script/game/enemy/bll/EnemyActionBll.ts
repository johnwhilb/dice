import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { TableEnemy } from "../../common/table/TableEnemy";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import type { Enemy } from "../Enemy";
import { EnemyObjectKind } from "../EnemyEvent";
import { PlayerBll } from "../../player/bll/PlayerBll";
import type { IPlayerData } from "../../player/model/PlayerModel";
import type { IEnemyData, IEnemySource } from "../EnemyEvent";
import { EnemySpawnBll } from "./EnemySpawnBll";
import { CombatBll } from "../../combat/bll/CombatBll";
import { CombatCamp } from "../../combat/CombatEvent";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import { PlayerBattleBll } from "../../player/bll/PlayerBattleBll";
import { PlayerActionBll } from "../../player/bll/PlayerActionBll";
import { PlayerPassiveBll } from "../../player/bll/PlayerPassiveBll";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { EffectBll } from "../../effect/bll/EffectBll";
import { BattleAudioBll } from "../../effect/bll/BattleAudioBll";
import { ArenaWallSide } from "../../effect/EffectEvent";
import { GameAudio } from "../../common/GameAudio";

export class EnemyActionBll extends CCBusiness<Enemy> {
    /** 推进 delta 秒的移动、技能、碰撞和战场对象，width、height 为战场尺寸。 */
    update(delta: number, width: number, height: number) {
        const model = this.ent.EnemyModel;
        model.spatial.clear();
        const cellSize = TableBattleRule.getCurrent().separationRadius;
        model.enemies.forEach((enemy) => {
            const key = `${Math.floor(enemy.x / cellSize)},${Math.floor(enemy.y / cellSize)}`;
            if (!model.spatial.has(key)) {
                model.spatial.set(key, []);
            }
            model.spatial.get(key).push(enemy);
        });
        const players = this.ent.game.player.PlayerModel.players.filter((player) => {
            return player.hp > 0;
        });
        if (players.length) {
            const snapshot = model.enemies.slice();
            snapshot.forEach((enemy) => {
                if (!enemy.dead) {
                    this.updateEnemy(enemy, players[0], delta, width, height);
                    this.collidePlayers(enemy);
                }
            });
            this.updateObjects(delta);
        }
        model.enemies = model.enemies.filter((enemy) => {
            return !enemy.dead;
        });
        model.objects = model.objects.filter((object) => {
            return !object.dead;
        });
    }

    /** 按原版追击、分离及精英技能推进 enemy，target 为存活队首。 */
    private updateEnemy(enemy: IEnemyData, target: IPlayerData, delta: number, width: number, height: number) {
        const rule = TableBattleRule.getCurrent();
        const config = enemy.config;
        const buffs = this.ent.game.buff.getBusiness<BuffBll>(BuffBll);
        const taunt = this.ent.game.buff.BuffModel.buffs.find((entry) => {
            return entry.camp === CombatCamp.Enemy && entry.target === enemy.id && entry.kind === BuffKind.Taunt && entry.remaining > 0;
        });
        if (taunt) {
            const summon = this.ent.game.summon.SummonModel.summons.find((entry) => {
                return entry.id === taunt.power && !entry.dead;
            });
            if (summon) {
                target = { ...target, pose: { x: summon.x, y: summon.y, angle: summon.angle } };
            }
        }
        if (buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.Stun)) {
            return;
        }
        enemy.boostRemaining = Math.max(0, enemy.boostRemaining - delta);
        if (config.selfDestructMax > 0) {
            enemy.life -= delta;
            if (enemy.life <= 0) {
                this.die(enemy);
                this.ent.game.player.getBusiness<PlayerActionBll>(PlayerActionBll).onEnemyDeath(enemy, -1, 0);
                return;
            }
        }
        enemy.skillTimer -= delta;
        if (enemy.forceRemaining > 0) {
            enemy.forceRemaining = Math.max(0, enemy.forceRemaining - delta);
            if (!enemy.forceRemaining) {
                GameAudio.playEffect("Wind Bolt 20");
            }
            this.ent.EnemyModel.enemies.forEach((other) => {
                const dx = enemy.forceX - other.x;
                const dy = enemy.forceY - other.y;
                const distance = Math.hypot(dx, dy);
                if (other.dead || distance === 0 || distance > config.skillRange) {
                    return;
                }
                if (enemy.forceRemaining > 0) {
                    const step = Math.min(distance, config.skillSpeed * delta);
                    other.x += dx / distance * step;
                    other.y += dy / distance * step;
                } else {
                    this.push(other, Math.atan2(target.pose.y - other.y, target.pose.x - other.x), config.skillSpeed, rule.knockbackDuration);
                }
            });
        }
        if (enemy.skillTimer <= 0 && !buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.Silence)) {
            this.useSkill(enemy, target);
        }
        let vx = 0;
        let vy = 0;
        if (enemy.knockbackRemaining > 0) {
            enemy.knockbackRemaining -= delta;
            vx = enemy.knockbackX;
            vy = enemy.knockbackY;
        } else if (enemy.chargeRemaining > 0) {
            const charging = enemy.chargeRemaining > config.skillDuration;
            enemy.chargeRemaining -= delta;
            if (enemy.chargeRemaining <= config.skillDuration) {
                if (charging) {
                    GameAudio.playEffect("Wind Bolt 14", 0.2);
                }
                vx = enemy.chargeX * config.skillSpeed;
                vy = enemy.chargeY * config.skillSpeed;
            }
        } else if (enemy.shooting) {
            enemy.angle = Math.atan2(target.pose.y - enemy.y, target.pose.x - enemy.x) * 180 / Math.PI;
        } else {
            let targetX = target.pose.x;
            let targetY = target.pose.y;
            if (config.boss) {
                const group = this.ent.EnemyModel.enemies.filter((entry) => {
                    return !entry.dead;
                });
                if (group.length > 1) {
                    targetX = group.reduce((sum, entry) => {
                        return sum + entry.x;
                    }, 0) / group.length;
                    targetY = group.reduce((sum, entry) => {
                        return sum + entry.y;
                    }, 0) / group.length;
                }
            }
            const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
            const boost = enemy.boostRemaining > 0
                ? (rule.boostBase + rule.boostLevelStep * this.ent.EnemyModel.level + rule.boostNgStep * this.ent.EnemyModel.newGamePlus) * (rule.boostEndRatio + (1 - rule.boostEndRatio) * enemy.boostRemaining / enemy.boostDuration)
                : 1;
            vx = Math.cos(angle) * enemy.speed * boost;
            vy = Math.sin(angle) * enemy.speed * boost;
            const neighbours: IEnemyData[] = [];
            const cellX = Math.floor(enemy.x / rule.separationRadius);
            const cellY = Math.floor(enemy.y / rule.separationRadius);
            for (const offsetX of [-1, 0, 1]) {
                for (const offsetY of [-1, 0, 1]) {
                    const bucket = this.ent.EnemyModel.spatial.get(`${cellX + offsetX},${cellY + offsetY}`);
                    if (bucket) {
                        neighbours.push(...bucket);
                    }
                }
            }
            for (const other of neighbours) {
                if (other.id === enemy.id || other.dead) {
                    continue;
                }
                const dx = enemy.x - other.x;
                const dy = enemy.y - other.y;
                const distance = Math.hypot(dx, dy);
                if (distance > 0 && distance < rule.separationRadius) {
                    const force = (1 - distance / rule.separationRadius) * rule.separationStrength;
                    vx += dx / distance * force;
                    vy += dy / distance * force;
                }
            }
            const wander = Math.sin(this.ent.EnemyModel.elapsed * rule.wanderRate + enemy.id);
            vx += -Math.sin(angle) * wander * rule.wanderStrength * config.wanderFactor;
            vy += Math.cos(angle) * wander * rule.wanderStrength * config.wanderFactor;
        }
        const stats = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const slow = Math.min(1, buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.Slow) + stats.item(ShopContentKeyEnum.ItemTemporalChains) + (buffs.get(CombatCamp.Enemy, enemy.id, BuffKind.Dot) ? stats.item(ShopContentKeyEnum.ItemDeceleration) : 0));
        const nextX = enemy.x + vx * delta * (1 - slow);
        const nextY = enemy.y + vy * delta * (1 - slow);
        enemy.x = Math.max(-width / 2 + config.width / 2, Math.min(width / 2 - config.width / 2, nextX));
        enemy.y = Math.max(-height / 2 + config.height / 2, Math.min(height / 2 - config.height / 2, nextY));
        if (enemy.knockbackRemaining > 0 && (nextX !== enemy.x || nextY !== enemy.y)) {
            const side = nextX !== enemy.x
                ? nextX < enemy.x ? ArenaWallSide.Left : ArenaWallSide.Right
                : nextY < enemy.y ? ArenaWallSide.Bottom : ArenaWallSide.Top;
            const heavy = enemy.wallSource >= 0;
            const roleId = heavy ? this.ent.game.player.PlayerModel.players[enemy.wallSource].roleId : 0;
            this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showWallImpact(enemy.x, enemy.y, side, roleId, heavy);
            if (heavy) {
                const source = enemy.wallSource;
                enemy.wallSource = -1;
                const player = this.ent.game.player.PlayerModel.players[source];
                this.ent.game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, enemy.wallDamage, source, player.skill.id, false);
                this.ent.game.player.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).onWall(source, enemy);
            }
        }
        if (vx || vy) {
            enemy.angle = Math.atan2(vy, vx) * 180 / Math.PI;
        }
    }

    /** 执行 enemy 类型配置对应的精英或首领技能，target 用于瞄准和冲撞。 */
    private useSkill(enemy: IEnemyData, target: IPlayerData) {
        const config = enemy.config;
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        enemy.skillTimer = this.randomRange(config.skillMin, config.skillMax);
        if (config.id === EnemyKeyEnum.Headbutter) {
            const distance = Math.hypot(target.pose.x - enemy.x, target.pose.y - enemy.y);
            if (distance < config.skillRange && enemy.chargeRemaining <= 0) {
                const angle = Math.atan2(target.pose.y - enemy.y, target.pose.x - enemy.x);
                enemy.chargeX = Math.cos(angle);
                enemy.chargeY = Math.sin(angle);
                enemy.chargeRemaining = config.skillDelay + config.skillDuration;
                enemy.skillTimer *= Math.max(rule.headbuttNgMin, 1 - model.newGamePlus * (1 - rule.headbuttNgMin) / rule.headbuttNgMax);
            } else {
                enemy.skillTimer = rule.simulationStep;
            }
        } else if (config.id === EnemyKeyEnum.Shooter) {
            enemy.shooting = true;
            const speed = Math.min(config.projectileSpeed + config.projectileGrowth * model.level + model.newGamePlus * rule.shooterNgSpeedStep, config.projectileMaxSpeed);
            for (let index = 0; index < config.projectileCount; index++) {
                this.projectile(enemy, Math.atan2(target.pose.y - enemy.y, target.pose.x - enemy.x), speed, enemy.damage * (1 + model.newGamePlus * rule.shooterNgDamageStep), index * rule.shooterBurstInterval * Math.max(1 - model.level * rule.shooterBurstLevelStep, rule.shooterBurstMinScale));
            }
            enemy.skillTimer *= 1 - Math.min(model.level * rule.shooterCooldownLevelStep, rule.shooterCooldownMax);
        } else if (config.id === EnemyKeyEnum.BossForcer) {
            const group = model.enemies.filter((other) => {
                return !other.dead;
            });
            enemy.forceX = group.reduce((sum, other) => {
                return sum + other.x;
            }, 0) / group.length;
            enemy.forceY = group.reduce((sum, other) => {
                return sum + other.y;
            }, 0) / group.length;
            enemy.forceRemaining = config.skillDelay;
            GameAudio.playEffect("Magical Impact 18");
        } else if (config.id === EnemyKeyEnum.Tank) {
            const targets = this.nearby(enemy, config.skillRange).slice(0, config.skillTargets);
            if (targets.length) {
                GameAudio.playEffect("Wind Bolt 20");
            }
            targets.forEach((other) => {
                const angle = Math.atan2(target.pose.y - other.y, target.pose.x - other.x);
                this.push(other, angle, config.skillSpeed, rule.knockbackDuration);
            });
            if (config.id === EnemyKeyEnum.Tank) {
                enemy.skillTimer *= Math.max(rule.tankNgMin, 1 - model.newGamePlus * (1 - rule.tankNgMin) / rule.headbuttNgMax);
            }
        } else if (config.id === EnemyKeyEnum.BossSpeedBooster) {
            this.nearby(enemy, config.skillRange).slice(0, config.skillTargets).forEach((other) => {
                this.boost(other);
            });
        } else if (config.id === EnemyKeyEnum.BossExploder || config.id === EnemyKeyEnum.BossSwarmer) {
            this.sacrifice(enemy, config.id);
        } else if (config.id === EnemyKeyEnum.BossRandomizer) {
            const skills: number[] = rule.randomBossSkills;
            const type = skills[Math.floor(Math.random() * skills.length)];
            if (type === EnemyKeyEnum.BossSpeedBooster) {
                this.nearby(enemy, config.skillRange).forEach((other) => {
                    this.boost(other);
                });
            } else if (type === EnemyKeyEnum.BossForcer) {
                this.nearby(enemy, config.forceRange).forEach((other) => {
                    this.push(other, Math.atan2(target.pose.y - other.y, target.pose.x - other.x), TableEnemy.getConfigById(EnemyKeyEnum.BossForcer).skillSpeed, rule.knockbackDuration);
                });
            } else {
                this.sacrifice(enemy, type);
            }
        }
    }

    /** 返回 enemy 周围 range 内的其他存活敌人，首领献祭与精英技能共用。 */
    private nearby(enemy: IEnemyData, range: number) {
        return this.ent.EnemyModel.enemies.filter((other) => {
            return other.id !== enemy.id && !other.dead && Math.hypot(other.x - enemy.x, other.y - enemy.y) <= range;
        });
    }

    /** 按首领技能 type 献祭一名普通敌人，转换成虫群、地雷或环形弹幕。 */
    private sacrifice(enemy: IEnemyData, type: number) {
        const candidates = this.nearby(enemy, enemy.config.skillRange).filter((other) => {
            return !other.config.boss && !other.config.critter;
        });
        if (!candidates.length) {
            return;
        }
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const config = TableEnemy.getConfigById<TableEnemy>(type);
        this.die(target);
        this.ent.game.player.getBusiness<PlayerActionBll>(PlayerActionBll).onEnemyDeath(target, -1, 0);
        if (type === EnemyKeyEnum.BossSwarmer) {
            GameAudio.playEffect("Critters eating 2");
            GameAudio.playEffect("Popping bloody Sac 1", 0.6);
            this.spawnCritters(target, config.spawnMin, config.spawnMax);
        } else if (enemy.config.id === EnemyKeyEnum.BossRandomizer) {
            GameAudio.playEffect("Shooting Projectile (Classic) 11", 0.4);
            this.radial(target, config, true);
        } else {
            this.mine(target, config);
        }
    }

    /** 检查敌人 enemy 与各存活队员的接触进入，按原版进行互伤和击退。 */
    private collidePlayers(enemy: IEnemyData) {
        if (enemy.dead) {
            return;
        }
        const rule = TableBattleRule.getCurrent();
        const players = this.ent.game.player.PlayerModel.players;
        const contacts = new Set<number>();
        players.forEach((player, index) => {
            if (player.hp <= 0 || enemy.dead) {
                return;
            }
            const radius = (Math.max(enemy.config.width, enemy.config.height) + player.config.bodySize) / 2;
            if (Math.hypot(player.pose.x - enemy.x, player.pose.y - enemy.y) > radius) {
                return;
            }
            contacts.add(index);
            if (this.ent.game.buff.getBusiness<BuffBll>(BuffBll).get(CombatCamp.Player, index, BuffKind.Shield)) {
                this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showShieldBlock(player.pose.x, player.pose.y, player.roleId);
                this.ent.game.combat.getBusiness<CombatBll>(CombatBll).push(enemy, Math.atan2(enemy.y - player.pose.y, enemy.x - player.pose.x), TableCombatRule.getCurrent().orbSpeed, index);
                return;
            }
            if (enemy.contacts.has(index)) {
                return;
            }
            const charge = enemy.config.id === EnemyKeyEnum.Headbutter && enemy.chargeRemaining > 0 && enemy.chargeRemaining <= enemy.config.skillDuration;
            const damage = enemy.damage * (charge ? rule.chargeDamageBase + Math.floor(this.ent.EnemyModel.level / rule.chargeDamageLevelDivisor) : 1);
            const multiplier = rule.doubleContactRoles.includes(player.roleId) ? rule.doubleContactMultiplier : 1;
            this.ent.game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, player.stats.damage * multiplier, index, player.skill.id, false);
            this.ent.game.player.getBusiness<PlayerBll>(PlayerBll).hit(index, damage);
            this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showBodyContact((player.pose.x + enemy.x) / 2, (player.pose.y + enemy.y) / 2, player.roleId, enemy.config.id);
            this.push(enemy, Math.atan2(enemy.y - player.pose.y, enemy.x - player.pose.x), this.randomRange(rule.knockbackMin, rule.knockbackMax), rule.knockbackDuration);
            enemy.chargeRemaining = 0;
        });
        enemy.contacts = contacts;
    }

    /** 按伤害 damage 和防御公式扣减 enemy 血量，死亡仅结算一次。 */
    hit(enemy: IEnemyData, damage: number) {
        this.ent.game.combat.getBusiness<CombatBll>(CombatBll).hitEnemy(enemy, damage);
    }

    /** 扣减已经过统一伤害结算的 damage，保留敌人自身死亡技能。 */
    applyDamage(enemy: IEnemyData, damage: number) {
        if (enemy.dead) {
            return;
        }
        enemy.hp = Math.max(0, enemy.hp - damage);
        if (enemy.hp > 0) {
            return;
        }
        this.die(enemy);
    }

    /** 直接结束 enemy 的生命，统一处理自毁、献祭和受伤死亡的技能与掉落。 */
    private die(enemy: IEnemyData) {
        if (enemy.dead) {
            return;
        }
        enemy.hp = 0;
        enemy.dead = true;
        if (!enemy.config.critter) {
            this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showEnemyDeath(enemy.x, enemy.y, enemy.config.width / 2, enemy.config.id, enemy.config.boss);
        } else {
            this.ent.game.effect.getBusiness<BattleAudioBll>(BattleAudioBll).playEnemyDeath(enemy.config.id, false);
        }
        if (enemy.config.id === EnemyKeyEnum.SpeedBooster) {
            this.nearby(enemy, enemy.config.skillRange).forEach((other) => {
                this.boost(other, true);
            });
        } else if (enemy.config.id === EnemyKeyEnum.Exploder) {
            this.mine(enemy, enemy.config);
        } else if (enemy.config.id === EnemyKeyEnum.Spawner) {
            this.spawnCritters(enemy, enemy.config.spawnMin, enemy.config.spawnMax);
        }
        if (!enemy.config.critter && Math.random() * 100 < this.goldChance()) {
            this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).createObject(EnemyObjectKind.Gold, enemy, 0, 0, 0, 0, 0);
        }
    }

    /** 按存活佣兵职业人数读取原版金币掉落概率。 */
    private goldChance() {
        const rule = TableBattleRule.getCurrent();
        const count = this.ent.game.player.PlayerModel.players.filter((player) => {
            return player.hp > 0 && player.config.getClasses().some((roleClass) => {
                return roleClass.id === rule.mercenaryClassId;
            });
        }).length;
        return count >= rule.mercenaryThresholds[1] ? rule.mercenaryHighChance : count >= rule.mercenaryThresholds[0] ? rule.mercenaryLowChance : 0;
    }

    /** 在 source 周围生成 min 到 max 名小虫，继承原版死亡召唤伤害。 */
    private spawnCritters(source: IEnemyData, min: number, max: number) {
        const count = Math.floor(this.randomRange(min, max + 1));
        for (let index = 0; index < count; index++) {
            const enemy = this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).spawn(EnemyKeyEnum.Critter, source.x, source.y);
            enemy.damage = source.damage * TableBattleRule.getCurrent().critterDeathDamageMultiplier;
            this.push(enemy, index * Math.PI * 2 / count, TableBattleRule.getCurrent().knockbackMin, TableBattleRule.getCurrent().knockbackDuration);
        }
    }

    /** 使 enemy 获得随时间衰减的原版移速增益。 */
    private boost(enemy: IEnemyData, short: boolean = false) {
        const rule = TableBattleRule.getCurrent();
        enemy.boostDuration = short ? rule.boostBase : rule.boostBase + rule.boostLevelStep * this.ent.EnemyModel.level + rule.boostNgStep * this.ent.EnemyModel.newGamePlus;
        enemy.boostRemaining = enemy.boostDuration;
    }

    /** 对 enemy 施加 angle 弧度方向、speed 局部速度、duration 秒的击退。 */
    private push(enemy: IEnemyData, angle: number, speed: number, duration: number) {
        enemy.knockbackX = Math.cos(angle) * speed;
        enemy.knockbackY = Math.sin(angle) * speed;
        enemy.knockbackRemaining = duration;
    }

    /** 在 source 位置按 config 的爆破参数生成延迟地雷。 */
    private mine(source: IEnemySource, config: TableEnemy) {
        const rule = TableBattleRule.getCurrent();
        const delay = Math.max(rule.mineMinInterval, rule.mineInterval - this.ent.EnemyModel.newGamePlus * rule.mineNgIntervalStep) * rule.minePulses;
        const mine = this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).createObject(EnemyObjectKind.Mine, source, 0, 0, source.damage, delay, 0);
        mine.configId = config.id;
    }

    /** 从 source 按 config 生成环形弹幕，randomizer 区分随机首领的弹丸参数。 */
    private radial(source: IEnemySource, config: TableEnemy, randomizer: boolean = false) {
        const rule = TableBattleRule.getCurrent();
        const ng = this.ent.EnemyModel.newGamePlus;
        const count = Math.floor(config.projectileCount + ng * (randomizer ? rule.bossNgCountStep : rule.mineNgCountStep));
        const speed = Math.min(config.projectileSpeed + config.projectileGrowth * this.ent.EnemyModel.level, config.projectileMaxSpeed);
        for (let index = 0; index < count; index++) {
            this.projectile(source, index * Math.PI * 2 / count, speed, source.damage * (randomizer ? 1 + ng * rule.bossNgDamageStep : config.projectileDamage), 0, config.id);
        }
    }

    /** 创建 source 发射的弹丸，angle 为弧度，delay 为生成后的停留时间。 */
    private projectile(source: IEnemySource, angle: number, speed: number, damage: number, delay: number, configId: number = source.config.id) {
        const object = this.ent.getBusiness<EnemySpawnBll>(EnemySpawnBll).createObject(EnemyObjectKind.Projectile, source, angle, speed, damage, TableBattleRule.getCurrent().projectileLife, delay);
        object.configId = configId;
        if (configId === EnemyKeyEnum.Shooter) {
            const offset = source.config.width * TableBattleRule.getCurrent().projectileMuzzleFactor;
            object.x += Math.cos(angle) * offset;
            object.y += Math.sin(angle) * offset;
        }
    }

    /** 更新 delta 秒的地雷和金币，双方弹丸由 Projectile 模块推进。 */
    private updateObjects(delta: number) {
        const model = this.ent.EnemyModel;
        const rule = TableBattleRule.getCurrent();
        const combatRule = TableCombatRule.getCurrent();
        const players = this.ent.game.player.PlayerModel.players;
        model.objects.slice().forEach((object) => {
            if (object.dead) {
                return;
            }
            if (object.delay > 0) {
                object.delay -= delta;
                return;
            }
            if (object.kind === EnemyObjectKind.SpawnMarker) {
                object.life -= delta;
                object.dead = object.life <= 0;
                return;
            }
            if (object.kind === EnemyObjectKind.Mine) {
                const interval = Math.max(rule.mineMinInterval, rule.mineInterval - model.newGamePlus * rule.mineNgIntervalStep);
                const previousPulse = Math.ceil(object.life / interval);
                object.life -= delta;
                if (Math.ceil(object.life / interval) < previousPulse) {
                    const rate = 1 + (rule.minePulses - previousPulse + 1) * 0.1;
                    GameAudio.playEffect("Weapon Swap 2", 0.5, rate, rate);
                }
                if (object.life <= 0) {
                    GameAudio.playEffect("Shooting Projectile (Classic) 11", 0.4);
                    GameAudio.playEffect("Cannon shots 1", 0.4);
                    const config = TableEnemy.getConfigById<TableEnemy>(object.configId);
                    const source: IEnemySource = { id: object.id, config, x: object.x, y: object.y, damage: object.damage };
                    this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showArea(object.x, object.y, 48, 0, true);
                    this.radial(source, config);
                    object.dead = true;
                }
                return;
            }
            players.forEach((player) => {
                if (player.hp <= 0 || object.dead) {
                    return;
                }
                const radius = object.kind === EnemyObjectKind.Gold ? rule.goldPickupRadius : (player.config.bodySize + object.height) / 2;
                const distance = Math.hypot(player.pose.x - object.x, player.pose.y - object.y);
                const magnetism = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll).item(ShopContentKeyEnum.ItemMagnetism);
                const magnetRange = magnetism > 0 ? combatRule.magnetAttract : combatRule.orbAttract;
                if (object.kind === EnemyObjectKind.Gold && distance > radius && distance <= magnetRange) {
                    const step = Math.min(distance, combatRule.orbSpeed * delta);
                    object.x += (player.pose.x - object.x) / distance * step;
                    object.y += (player.pose.y - object.y) / distance * step;
                }
                if (Math.hypot(player.pose.x - object.x, player.pose.y - object.y) <= radius) {
                    object.dead = true;
                    if (object.kind === EnemyObjectKind.Gold) {
                        model.pickedUpGold += rule.goldAmount;
                        this.ent.game.effect.getBusiness<EffectBll>(EffectBll).showPickupRipple(object.x, object.y, true);
                        this.ent.game.player.getBusiness<PlayerActionBll>(PlayerActionBll).onGoldPickup(object.x, object.y);
                    }
                }
            });
        });
    }

    /** 返回 min 到 max 之间的随机数，配置零区间用于无技能普通敌人。 */
    private randomRange(min: number, max: number) {
        return min + Math.random() * (max - min);
    }
}
