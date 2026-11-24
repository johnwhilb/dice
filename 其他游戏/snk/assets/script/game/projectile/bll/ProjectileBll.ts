import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Projectile } from "../Projectile";
import type { IProjectileData } from "../ProjectileEvent";
import { spellbladeLength, spellbladeThickness } from "../ProjectileEvent";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { CombatBll } from "../../combat/bll/CombatBll";
import { EffectBll } from "../../effect/bll/EffectBll";
import { BattleAudioBll } from "../../effect/bll/BattleAudioBll";
import { GameAudio } from "../../common/GameAudio";
import { AreaFeedback } from "../../effect/EffectEvent";
import { PlayerBattleBll } from "../../player/bll/PlayerBattleBll";
import { PlayerActionBll } from "../../player/bll/PlayerActionBll";
import { PlayerPassiveBll } from "../../player/bll/PlayerPassiveBll";
import { BuffBll } from "../../buff/bll/BuffBll";
import { BuffKind } from "../../buff/BuffEvent";
import { CombatCamp } from "../../combat/CombatEvent";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";

const bladeInitialDecay = 6.25;
const bladeFinalDecay = 12.25;
const explosiveRoles = new Set([RoleKeyEnum.Wizard, RoleKeyEnum.Blade, RoleKeyEnum.Cannoneer]);
const arrowRoles = new Set([RoleKeyEnum.Archer, RoleKeyEnum.Hunter, RoleKeyEnum.Barrager, RoleKeyEnum.Sentry]);
const knifeRoles = new Set([RoleKeyEnum.Scout, RoleKeyEnum.Outlaw, RoleKeyEnum.Blade, RoleKeyEnum.Spellblade, RoleKeyEnum.Jester, RoleKeyEnum.Beastmaster, RoleKeyEnum.Witch, RoleKeyEnum.Thief]);

export class ProjectileBll extends CCBusiness<Projectile> {
    /** 创建 source 角色的弹丸，位置 x、y，angle 为弧度，delay 为连射延迟，proc 控制被动触发。 */
    fire(source: number, skillId: number, x: number, y: number, angle: number, damage: number, delay: number = 0, proc: boolean = true, homing: boolean = false, generic: boolean = false) {
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        const stats = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const rogue = stats.hasClass(source, RoleClassKeyEnum.Rogue);
        const roleId = this.ent.game.player.PlayerModel.players[source].roleId;
        const data: IProjectileData = {
            source, skillId, x, y, angle, speed: skill.projectileSpeed, damage,
            life: TableCombatRule.getCurrent().projectileLife, delay,
            pierce: skill.pierce, chains: skill.chains + (rogue ? stats.item(ShopContentKeyEnum.ItemFlyingDaggers) : 0),
            bounces: skill.bounces, warps: stats.item(ShopContentKeyEnum.ItemWarpingShots), homing: homing || skill.homing,
            hitIds: new Set<number>(), dead: false, timer: 0, proc, generic,
        };
        if (!generic && roleId === RoleKeyEnum.Spellblade) {
            data.bladeContacts = new Set<number>();
            data.life += bladeInitialDecay + bladeFinalDecay;
        }
        if (!generic && (roleId === RoleKeyEnum.Arcanist || roleId === RoleKeyEnum.Lich || roleId === RoleKeyEnum.Sage)) {
            data.visual = {
                age: 0, trailTime: 0, flashTime: 0, velocity: 0,
                scale: roleId === RoleKeyEnum.Lich ? 1.15 : 1,
                spin: roleId === RoleKeyEnum.Sage ? (Math.random() - 0.5) * Math.PI / 2 : 0,
            };
        }
        if (stats.hasClass(source, RoleClassKeyEnum.Ranger) && Math.random() < stats.item(ShopContentKeyEnum.ItemDivineMachineArrow)) {
            data.homing = true;
            data.pierce += stats.itemLevel(ShopContentKeyEnum.ItemDivineMachineArrow);
        }
        this.ent.ProjectileModel.projectiles.push(data);
        return data;
    }

    /** 更新 delta 秒的双方弹丸运动及命中，width、height 为战场边界。 */
    update(delta: number, width: number, height: number) {
        const game = this.ent.game;
        const model = this.ent.ProjectileModel;
        const rule = TableCombatRule.getCurrent();
        const combat = game.combat.getBusiness<CombatBll>(CombatBll);
        const effects = game.effect.getBusiness<EffectBll>(EffectBll);
        const audio = game.effect.getBusiness<BattleAudioBll>(BattleAudioBll);
        const passives = game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        model.projectiles.slice().forEach((shot) => {
            if (shot.dead) {
                return;
            }
            if (shot.delay > 0) {
                shot.delay -= delta;
                return;
            }
            const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(shot.skillId);
            const roleId = game.player.PlayerModel.players[shot.source].roleId;
            const oldX = shot.x;
            const oldY = shot.y;
            if (!shot.launched) {
                shot.launched = true;
                if (shot.summon && !shot.summon.dead) {
                    shot.summon.attackAt = game.combat.CombatModel.elapsed;
                    shot.summon.attackAngle = shot.angle;
                }
                const muzzle = shot.muzzle;
                effects.showMuzzle(muzzle?.x ?? oldX, muzzle?.y ?? oldY, shot.angle, roleId, muzzle ? shot.source : undefined);
                if (shot.playLaunchSound || (shot.generic && roleId === RoleKeyEnum.Arcanist)) {
                    audio.playShot(roleId, shot.generic && !shot.summon);
                }
            }
            if (shot.homing) {
                const target = combat.nearest(shot.x, shot.y, rule.projectileHomingRange, shot.hitIds);
                if (target) {
                    const desired = Math.atan2(target.y - shot.y, target.x - shot.x);
                    const turn = Math.atan2(Math.sin(desired - shot.angle), Math.cos(desired - shot.angle));
                    shot.angle += Math.max(-rule.homingTurn * delta, Math.min(rule.homingTurn * delta, turn));
                }
            }
            const bladeContacts = shot.bladeContacts;
            const turnSpeed = bladeContacts ? this.spellbladeTurnSpeed(skill, shot.timer + delta / 2) : skill.angularSpeed;
            shot.angle += shot.generic ? 0 : turnSpeed * delta;
            const directionX = Math.cos(shot.angle);
            const directionY = Math.sin(shot.angle);
            const distance = shot.speed * delta;
            shot.x += directionX * distance;
            shot.y += directionY * distance;
            shot.life -= delta;
            shot.timer += delta;
            const visual = shot.visual;
            if (visual) {
                const previousAge = visual.age;
                visual.age += delta;
                visual.flashTime = Math.max(0, visual.flashTime - delta);
                if (roleId === RoleKeyEnum.Sage && previousAge < 0.05 && visual.age >= 0.05) {
                    visual.scale += 0.15;
                }
                visual.velocity += (-100 * (visual.scale - 1) - 10 * visual.velocity) * delta;
                visual.scale += visual.velocity * delta;
                visual.trailTime += delta;
                while (visual.trailTime >= 0.08) {
                    visual.trailTime -= 0.08;
                    effects.showProjectileTrail(shot, roleId, roleId === RoleKeyEnum.Arcanist);
                }
            }
            if (skill.orb && !shot.generic && shot.timer >= (1 / (1 + skill.power))) {
                shot.timer = 0;
                const target = combat.nearest(shot.x, shot.y, skill.range, new Set<number>());
                if (target) {
                    if (visual && roleId === RoleKeyEnum.Arcanist) {
                        visual.flashTime = 0.15;
                        visual.scale += 0.5;
                    }
                    for (let index = 0; index < Math.max(1, skill.extraShots); index++) {
                        const child = this.fire(shot.source, shot.skillId, shot.x, shot.y, Math.atan2(target.y - shot.y, target.x - shot.x), shot.damage, index * rule.barrageInterval, false, false, true);
                        child.speed = rule.projectileSpeed;
                        child.pierce = 0;
                    }
                }
            }
            if (skill.pull > 0 && !shot.generic) {
                combat.pull(shot.x, shot.y, skill.pull, skill.pull, delta);
            }
            const boundaryX = width / 2;
            const boundaryY = height / 2;
            const exitX = Math.abs(shot.x) > boundaryX ? this.travelToEdge(oldX, shot.x, boundaryX) : Number.POSITIVE_INFINITY;
            const exitY = Math.abs(shot.y) > boundaryY ? this.travelToEdge(oldY, shot.y, boundaryY) : Number.POSITIVE_INFINITY;
            const wallX = exitX <= 1 && exitX <= exitY;
            const wallY = exitY <= 1 && exitY <= exitX;
            const wall = wallX || wallY;
            const travel = distance * Math.min(1, exitX, exitY);
            const endX = Math.max(-boundaryX, Math.min(boundaryX, oldX + directionX * travel));
            const endY = Math.max(-boundaryY, Math.min(boundaryY, oldY + directionY * travel));
            const dx = endX - oldX;
            const dy = endY - oldY;
            const length = dx * dx + dy * dy;
            const explosive = !shot.generic && explosiveRoles.has(roleId);
            let redirected = false;
            for (const enemy of game.enemy.EnemyModel.enemies.slice()) {
                if (shot.dead || enemy.dead || (!bladeContacts && shot.hitIds.has(enemy.id))) {
                    continue;
                }
                const t = length > 0 ? Math.max(0, Math.min(1, ((enemy.x - oldX) * dx + (enemy.y - oldY) * dy) / length)) : 0;
                const hitX = oldX + dx * t;
                const hitY = oldY + dy * t;
                if (bladeContacts) {
                    const alreadyTouching = bladeContacts.has(enemy.id);
                    if (combat.overlapsEnemyBox(enemy, endX, endY, directionX, directionY, spellbladeLength / 2, spellbladeThickness / 2)) {
                        bladeContacts.add(enemy.id);
                    } else {
                        bladeContacts.delete(enemy.id);
                    }
                    if (alreadyTouching || !combat.overlapsEnemyBox(enemy, (oldX + endX) / 2, (oldY + endY) / 2, directionX, directionY,
                        (spellbladeLength + travel) / 2, spellbladeThickness / 2)) {
                        continue;
                    }
                } else if (Math.hypot(enemy.x - hitX, enemy.y - hitY) > rule.projectileRadius + enemy.config.height / 2) {
                    continue;
                }
                shot.hitIds.add(enemy.id);
                if (skill.radius > 0 && !shot.generic) {
                    const x = explosive ? hitX : enemy.x;
                    const y = explosive ? hitY : enemy.y;
                    combat.area(shot.source, shot.skillId, x, y, skill.radius, shot.damage, shot.proc, false, false, AreaFeedback.Burst, Math.random() * Math.PI);
                } else {
                    combat.hitEnemy(enemy, shot.damage, shot.source, shot.skillId, shot.proc);
                }
                if (!shot.proc) {
                    game.player.getBusiness<PlayerPassiveBll>(PlayerPassiveBll).triggerChainLightning(shot.source, enemy, shot.damage);
                }
                if (shot.chains > 0) {
                    const next = combat.nearest(enemy.x, enemy.y, rule.projectileChainRange, shot.hitIds);
                    if (next) {
                        effects.showChain(enemy.x, enemy.y, next.x, next.y, roleId, roleId === RoleKeyEnum.Lich);
                        shot.chains -= 1;
                        shot.x = enemy.x;
                        shot.y = enemy.y;
                        shot.angle = Math.atan2(next.y - enemy.y, next.x - enemy.x);
                        redirected = true;
                        if (!shot.generic) {
                            shot.speed *= roleId === RoleKeyEnum.Lich ? 1.1 : 1.25;
                            if (roleId === RoleKeyEnum.Lich && skill.slow > 0) {
                                game.buff.getBusiness<BuffBll>(BuffBll).add(CombatCamp.Enemy, next.id, shot.source, BuffKind.Slow, skill.slow, skill.duration, skill.id);
                            }
                        }
                        shot.damage *= 1 + passives.item(ShopContentKeyEnum.ItemUltimatum) + (roleId === RoleKeyEnum.Scout ? skill.extraPower : 0);
                        effects.showProjectileHit(hitX, hitY, false, roleId, enemy.config.id);
                        audio.playProjectileHit(roleId, !!shot.arrow, !!shot.generic);
                        break;
                    }
                }
                if (shot.pierce > 0) {
                    shot.pierce -= 1;
                } else {
                    shot.dead = true;
                    if (explosive && roleId === RoleKeyEnum.Cannoneer) {
                        game.player.getBusiness<PlayerActionBll>(PlayerActionBll).queueCannonAftershocks(shot.source, skill, hitX, hitY, shot.damage);
                    }
                }
                effects.showProjectileHit(hitX, hitY, shot.dead, roleId, enemy.config.id);
                audio.playProjectileHit(roleId, !!shot.arrow, !!shot.generic);
            }
            if (shot.dead || (redirected && shot.life > 0)) {
                return;
            }
            if (wall && shot.life > 0 && shot.warps > 0) {
                shot.warps -= 1;
                shot.x = wallX ? -endX : endX;
                shot.y = wallY ? -endY : endY;
                bladeContacts?.clear();
                return;
            }
            if (wall && shot.life > 0 && shot.bounces > 0) {
                audio.playProjectileWall(roleId, !!shot.arrow);
                shot.bounces -= 1;
                shot.x = endX;
                shot.y = endY;
                shot.angle = wallX ? Math.PI - shot.angle : shot.angle;
                shot.angle = wallY ? -shot.angle : shot.angle;
                shot.hitIds.clear();
                return;
            }
            if (wall || shot.life <= 0) {
                shot.dead = true;
                if (explosive) {
                    combat.area(shot.source, shot.skillId, endX, endY, skill.radius, shot.damage, shot.proc, false, false, AreaFeedback.Burst, Math.random() * Math.PI);
                    if (roleId === RoleKeyEnum.Cannoneer) {
                        game.player.getBusiness<PlayerActionBll>(PlayerActionBll).queueCannonAftershocks(shot.source, skill, endX, endY, shot.damage);
                    }
                } else if (shot.life <= 0 && skill.pull > 0 && skill.extraPower > 0 && !shot.generic) {
                    combat.area(shot.source, shot.skillId, endX, endY, skill.pull, passives.stats(shot.source).damage * skill.extraPower, false, false, false, AreaFeedback.Targets);
                }
                effects.showProjectileHit(endX, endY, true, roleId);
                const arrow = shot.arrow || arrowRoles.has(roleId);
                const knife = !arrow && knifeRoles.has(roleId);
                if (wall) {
                    audio.playProjectileWall(roleId, arrow);
                }
                if (wall && (arrow || knife)) {
                    const wallAngle = wallX ? (directionX > 0 ? Math.PI : 0) : (directionY > 0 ? -Math.PI / 2 : Math.PI / 2);
                    effects.showWallResidue(endX, endY, shot.angle, wallAngle, roleId, knife, shot.speed * 0.1);
                }
            }
        });
        model.enemyProjectiles.forEach((shot) => {
            if (shot.dead) {
                return;
            }
            if (shot.delay > 0) {
                shot.delay -= delta;
                return;
            }
            const angle = shot.angle * Math.PI / 180;
            if (!shot.launched) {
                shot.launched = true;
                if (shot.configId === EnemyKeyEnum.Shooter) {
                    const shooter = game.enemy.EnemyModel.enemies.find((enemy) => {
                        return !enemy.dead && enemy.id === shot.sourceId;
                    });
                    if (shooter) {
                        shooter.fireTime = game.combat.CombatModel.elapsed;
                    }
                    effects.showMuzzle(shot.x, shot.y, angle, 0);
                    GameAudio.playEffect("Shooting Projectile (Classic) 11", 0.1);
                }
            }
            shot.x += Math.cos(angle) * shot.speed * delta;
            shot.y += Math.sin(angle) * shot.speed * delta;
            shot.life -= delta;
            const hitWall = Math.abs(shot.x) > width / 2 || Math.abs(shot.y) > height / 2;
            shot.dead = shot.life <= 0 || hitWall;
            if (hitWall) {
                GameAudio.playEffect("Player Takes Damage 2", 0.05, 0.9, 1.1);
            }
            if (!shot.dead && passives.item(ShopContentKeyEnum.ItemMeatShield)) {
                const shield = game.summon.SummonModel.summons.find((entry) => {
                    return !entry.dead && entry.typeId === SummonTypeKeyEnum.Critter && Math.hypot(entry.x - shot.x, entry.y - shot.y) < rule.orbAttract;
                });
                if (shield) {
                    shield.hp -= 1;
                    shot.dead = true;
                }
            }
            game.player.PlayerModel.players.forEach((player, index) => {
                if (!shot.dead && player.hp > 0 && Math.hypot(player.pose.x - shot.x, player.pose.y - shot.y) <= (player.config.bodySize + shot.height) / 2) {
                    combat.hitPlayer(index, shot.damage);
                    shot.dead = true;
                }
            });
            if (!shot.dead && shot.configId === EnemyKeyEnum.Shooter) {
                const target = game.enemy.EnemyModel.enemies.find((enemy) => {
                    return !enemy.dead && enemy.id !== shot.sourceId && Math.hypot(enemy.x - shot.x, enemy.y - shot.y) <= (enemy.config.height + shot.height) / 2;
                });
                if (target) {
                    combat.hitEnemy(target, shot.damage * TableBattleRule.getCurrent().shooterFriendlyFireMultiplier);
                    shot.dead = true;
                }
            }
        });
        model.projectiles = model.projectiles.filter((shot) => {
            return !shot.dead;
        });
        model.enemyProjectiles = model.enemyProjectiles.filter((shot) => {
            return !shot.dead;
        });
    }

    /** 根据刀片飞行年龄 age 计算先指数下降、再线性归零的角速度。 */
    private spellbladeTurnSpeed(skill: TablePlayerSkill, age: number) {
        if (age < bladeInitialDecay) {
            return -(skill.angularSpeedEnd + (skill.angularSpeed - skill.angularSpeedEnd) * 2 ** (-10 * age / bladeInitialDecay));
        }
        return -skill.angularSpeedEnd * Math.max(0, 1 - (age - bladeInitialDecay) / bladeFinalDecay);
    }

    /** 计算从 start 移到 end 时，在对应坐标轴上到达边界的位移比例。 */
    private travelToEdge(start: number, end: number, boundary: number) {
        return start === end ? 0 : Math.max(0, (Math.sign(end) * boundary - start) / (end - start));
    }

}
