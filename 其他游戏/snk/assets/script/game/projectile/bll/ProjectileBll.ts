import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Projectile } from "../Projectile";
import type { IProjectileData } from "../ProjectileEvent";
import { TablePlayerSkill } from "../../common/table/TablePlayerSkill";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import { ShopContentKeyEnum } from "../../common/table/ShopContentKeyEnum";
import { RoleKeyEnum } from "../../common/table/RoleKeyEnum";
import { EnemyKeyEnum } from "../../common/table/EnemyKeyEnum";
import { RoleClassKeyEnum } from "../../common/table/RoleClassKeyEnum";
import { CombatBll } from "../../combat/bll/CombatBll";
import { PlayerBattleBll } from "../../player/bll/PlayerBattleBll";
import { TableBattleRule } from "../../common/table/TableBattleRule";
import { SummonTypeKeyEnum } from "../../common/table/SummonTypeKeyEnum";

export class ProjectileBll extends CCBusiness<Projectile> {
    /** 创建 source 角色的弹丸，位置 x、y，angle 为弧度，delay 为连射延迟，proc 控制被动触发。 */
    fire(source: number, skillId: number, x: number, y: number, angle: number, damage: number, delay: number = 0, proc: boolean = true, homing: boolean = false, generic: boolean = false) {
        const skill = TablePlayerSkill.getConfigById<TablePlayerSkill>(skillId);
        const stats = this.ent.game.player.getBusiness<PlayerBattleBll>(PlayerBattleBll);
        const rogue = stats.hasClass(source, RoleClassKeyEnum.Rogue);
        const data: IProjectileData = {
            source, skillId, x, y, angle, speed: skill.projectileSpeed, damage,
            life: TableCombatRule.getCurrent().projectileLife, delay,
            pierce: skill.pierce, chains: skill.chains + (rogue ? stats.item(ShopContentKeyEnum.ItemFlyingDaggers) : 0),
            bounces: skill.bounces, warps: stats.item(ShopContentKeyEnum.ItemWarpingShots), homing: homing || skill.homing,
            hitIds: new Set<number>(), dead: false, timer: 0, proc, generic,
        };
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
            const oldX = shot.x;
            const oldY = shot.y;
            if (shot.homing) {
                const target = combat.nearest(shot.x, shot.y, rule.chainRange, shot.hitIds);
                if (target) {
                    const desired = Math.atan2(target.y - shot.y, target.x - shot.x);
                    const turn = Math.atan2(Math.sin(desired - shot.angle), Math.cos(desired - shot.angle));
                    shot.angle += Math.max(-rule.homingTurn * delta, Math.min(rule.homingTurn * delta, turn));
                }
            }
            shot.angle += shot.generic ? 0 : skill.angularSpeed * delta;
            shot.x += Math.cos(shot.angle) * shot.speed * delta;
            shot.y += Math.sin(shot.angle) * shot.speed * delta;
            shot.life -= delta;
            shot.timer += delta;
            if (skill.orb && !shot.generic && shot.timer >= (1 / (1 + skill.power))) {
                shot.timer = 0;
                const target = combat.nearest(shot.x, shot.y, skill.range, new Set<number>());
                if (target) {
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
            const wallX = Math.abs(shot.x) > width / 2;
            const wallY = Math.abs(shot.y) > height / 2;
            if (wallX || wallY) {
                if (shot.warps > 0) {
                    shot.warps -= 1;
                    shot.x = wallX ? -Math.sign(shot.x) * width / 2 : shot.x;
                    shot.y = wallY ? -Math.sign(shot.y) * height / 2 : shot.y;
                } else if (shot.bounces > 0) {
                    shot.bounces -= 1;
                    shot.angle = wallX ? Math.PI - shot.angle : -shot.angle;
                    shot.x = Math.max(-width / 2, Math.min(width / 2, shot.x));
                    shot.y = Math.max(-height / 2, Math.min(height / 2, shot.y));
                    shot.hitIds.clear();
                } else {
                    shot.dead = true;
                }
            }
            if (shot.life <= 0) {
                shot.dead = true;
                if (skill.pull > 0 && skill.extraPower > 0 && !shot.generic) {
                    combat.area(shot.source, shot.skillId, shot.x, shot.y, skill.pull, passives.stats(shot.source).damage * skill.extraPower, false);
                }
            }
            for (const enemy of game.enemy.EnemyModel.enemies.slice()) {
                if (shot.dead || enemy.dead || shot.hitIds.has(enemy.id)) {
                    continue;
                }
                const dx = shot.x - oldX;
                const dy = shot.y - oldY;
                const length = dx * dx + dy * dy;
                const t = length > 0 ? Math.max(0, Math.min(1, ((enemy.x - oldX) * dx + (enemy.y - oldY) * dy) / length)) : 0;
                if (Math.hypot(enemy.x - oldX - dx * t, enemy.y - oldY - dy * t) > rule.projectileRadius + enemy.config.height / 2) {
                    continue;
                }
                shot.hitIds.add(enemy.id);
                if (skill.radius > 0 && !shot.generic) {
                    combat.area(shot.source, shot.skillId, enemy.x, enemy.y, skill.radius, shot.damage, shot.proc);
                } else {
                    combat.hitEnemy(enemy, shot.damage, shot.source, shot.skillId, shot.proc);
                }
                if (shot.chains > 0) {
                    const next = combat.nearest(enemy.x, enemy.y, rule.chainRange, shot.hitIds);
                    if (next) {
                        shot.chains -= 1;
                        shot.x = enemy.x;
                        shot.y = enemy.y;
                        shot.angle = Math.atan2(next.y - enemy.y, next.x - enemy.x);
                        const player = game.player.PlayerModel.players[shot.source];
                        shot.damage *= 1 + passives.item(ShopContentKeyEnum.ItemUltimatum) + (player.roleId === RoleKeyEnum.Scout ? skill.extraPower : 0);
                        break;
                    }
                }
                if (shot.pierce > 0) {
                    shot.pierce -= 1;
                } else {
                    shot.dead = true;
                }
            }
        });
        model.enemyProjectiles.forEach((shot) => {
            if (shot.delay > 0) {
                shot.delay -= delta;
                return;
            }
            const angle = shot.angle * Math.PI / 180;
            shot.x += Math.cos(angle) * shot.speed * delta;
            shot.y += Math.sin(angle) * shot.speed * delta;
            shot.life -= delta;
            shot.dead = shot.life <= 0 || Math.abs(shot.x) > width / 2 || Math.abs(shot.y) > height / 2;
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
}
