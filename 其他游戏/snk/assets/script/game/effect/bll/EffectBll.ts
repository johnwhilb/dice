import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Effect } from "../Effect";
import { EffectKind, bossDeathDuration, bossSlowDuration, chainDuration, enemyDeathDuration, impactShakeDuration, muzzleDuration, projectileEndDuration, projectileParticleScale, recoilDuration, spawnArrivalDuration } from "../EffectEvent";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import type { IProjectileData } from "../../projectile/ProjectileEvent";
import { arrowResidueDuration, criticalDuration, knifeResidueDuration, playerDeathDuration, playerDeathSlowDuration, playerHurtDuration } from "../EffectEvent";

export class EffectBll extends CCBusiness<Effect> {
    /** 记录位置 x、y 的 kind 表现，amount 为飘字数值，roleId 决定动态颜色。 */
    show(kind: EffectKind, x: number, y: number, radius: number, amount: number, roleId: number, endX: number = x, endY: number = y) {
        const rule = TableCombatRule.getCurrent();
        const life = kind === EffectKind.Damage || kind === EffectKind.Heal ? rule.textLife : rule.effectLife;
        this.ent.EffectModel.effects.push({ kind, x, y, endX, endY, radius, amount, roleId, life });
    }

    /** 在 x、y 生成亮斑和碎片，ended 表示弹丸终止，颜色来自 roleId 和 enemyConfigId。 */
    showProjectileHit(x: number, y: number, ended: boolean, roleId: number, enemyConfigId?: number) {
        const kind = ended ? EffectKind.ProjectileEnd : EffectKind.ProjectileHit;
        const radius = ended ? 8 : 6;
        const life = ended ? projectileEndDuration : 0.1;
        this.ent.EffectModel.effects.push({ kind, x, y, endX: x, endY: y, radius, amount: 0, roleId: 0, life });
        const count = ended ? 2 + Math.floor(Math.random() * 2) : 2;
        for (let index = 0; index < count; index++) {
            const angle = Math.random() * 2 * Math.PI;
            this.spawnProjectileParticle(x, y, angle, 50 + Math.random() * 100, roleId, !ended && index === 1 ? enemyConfigId : undefined);
        }
    }

    /** 在 x、y 沿 angle 绘制角色色发射闪光，有 source 时记录对应角色的出手回弹。 */
    showMuzzle(x: number, y: number, angle: number, roleId: number, source?: number) {
        const model = this.ent.EffectModel;
        model.effects.push({ kind: EffectKind.Muzzle, x, y, endX: x, endY: y, radius: 0, amount: angle, roleId, life: muzzleDuration });
        if (source !== undefined) {
            model.recoilLife.set(source, recoilDuration);
            this.shake(impactShakeDuration * 0.55, 2);
        }
    }

    /** 记录范围冲击尺寸与可选方形朝向 squareAngle，impact 控制镜头反馈。 */
    showArea(x: number, y: number, radius: number, roleId: number, impact: boolean, squareAngle?: number) {
        const life = TableCombatRule.getCurrent().effectLife;
        this.ent.EffectModel.effects.push({ kind: EffectKind.Area, x, y, endX: x, endY: y, radius, amount: 0, roleId, life, squareAngle });
        if (impact) {
            this.shake(impactShakeDuration, 6);
        }
    }

    /** 在两端坐标生成角色色电弧并各发出一颗碎片。 */
    showChain(x: number, y: number, endX: number, endY: number, roleId: number) {
        this.ent.EffectModel.effects.push({ kind: EffectKind.Chain, x, y, endX, endY, radius: 0, amount: 0, roleId, life: chainDuration });
        const angle = Math.atan2(endY - y, endX - x);
        this.spawnProjectileParticle(x, y, angle + Math.PI / 2, 65, roleId);
        this.spawnProjectileParticle(endX, endY, angle - Math.PI / 2, 85, roleId);
    }

    /** 在实际刷出敌人的 x、y 生成出场色环，radius 来自敌人体型。 */
    showSpawnArrival(x: number, y: number, radius: number, enemyConfigId: number) {
        this.ent.EffectModel.effects.push({
            kind: EffectKind.SpawnArrival, x, y, endX: x, endY: y, radius, amount: enemyConfigId, roleId: 0, life: spawnArrivalDuration,
        });
    }

    /** 在 x、y 生成敌人死亡色环和碎片，boss 决定是否触发整场慢放。 */
    showEnemyDeath(x: number, y: number, radius: number, enemyConfigId: number, boss: boolean = false) {
        const model = this.ent.EffectModel;
        const kind = boss ? EffectKind.BossDeath : EffectKind.EnemyDeath;
        const life = boss ? bossDeathDuration : enemyDeathDuration;
        model.effects.push({ kind, x, y, endX: x, endY: y, radius, amount: enemyConfigId, roleId: 0, life });
        if (boss) {
            model.slowLife = Math.max(model.slowLife, bossSlowDuration);
            this.shake(impactShakeDuration, 6);
        }
        const count = boss ? 16 : 4 + Math.floor(Math.random() * 3);
        for (let index = 0; index < count; index++) {
            const speed = boss ? 90 + Math.random() * 160 : 50 + Math.random() * 100;
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, speed, 0, enemyConfigId);
        }
    }

    /** 记录撞墙的 x、y、方向 angle 和墙面种类，knife 表示飞刀。 */
    showWallResidue(x: number, y: number, angle: number, wallAngle: number, roleId: number, knife: boolean, speed: number) {
        const kind = knife ? EffectKind.WallKnife : EffectKind.WallArrow;
        const life = knife ? knifeResidueDuration : arrowResidueDuration;
        this.ent.EffectModel.effects.push({ kind, x, y, endX: wallAngle, endY: speed, radius: 0, amount: angle, roleId, life });
    }

    /** 为角色下标 source 记录受击闪白与轻震。 */
    showPlayerHurt(source: number) {
        this.ent.EffectModel.hurtLife.set(source, playerHurtDuration);
        this.shake(playerHurtDuration, 4);
    }

    /** 在退场位置生成角色色收束环和碎片，并短暂放慢战斗。 */
    showPlayerDeath(x: number, y: number, roleId: number) {
        const model = this.ent.EffectModel;
        model.slowLife = Math.max(model.slowLife, playerDeathSlowDuration);
        model.effects.push({ kind: EffectKind.PlayerDeath, x, y, endX: x, endY: y, radius: 36, amount: 0, roleId, life: playerDeathDuration });
        this.shake(playerHurtDuration, 5);
        const count = 4 + Math.floor(Math.random() * 3);
        for (let index = 0; index < count; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 50 + Math.random() * 100, roleId);
        }
    }

    /** 为 x、y 的暴击生成亮环及攻击方和受击方颜色的碎片。 */
    showCritical(x: number, y: number, roleId: number, enemyConfigId: number) {
        this.ent.EffectModel.effects.push({ kind: EffectKind.Critical, x, y, endX: x, endY: y, radius: 36, amount: 0, roleId, life: criticalDuration });
        this.shake(criticalDuration, 7);
        for (let index = 0; index < 3; index++) {
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 100 + Math.random() * 300, roleId);
            this.spawnProjectileParticle(x, y, Math.random() * 2 * Math.PI, 100 + Math.random() * 300, roleId, enemyConfigId);
        }
    }

    /** 以 duration 秒和 amplitude 战场单位请求镜头震动，保留较强的当前冲击。 */
    private shake(duration: number, amplitude: number) {
        const model = this.ent.EffectModel;
        if (model.shakeLife > 0 && model.shakeAmplitude * (model.shakeLife / model.shakeDuration) ** 2 > amplitude) {
            return;
        }
        model.shakeLife = duration;
        model.shakeDuration = duration;
        model.shakeAmplitude = amplitude;
    }

    /** 从 shot 当前位置发出尾迹，奥术师按弹道反方向散开并跟随主球闪亮。 */
    showProjectileTrail(shot: IProjectileData, roleId: number, arcane: boolean) {
        const angle = arcane ? shot.angle + Math.PI + (Math.random() - 0.5) * Math.PI / 3 : Math.random() * Math.PI * 2;
        const speed = arcane ? 10 + Math.random() * 15 : 50 + Math.random() * 100;
        this.spawnProjectileParticle(shot.x, shot.y, angle, speed, roleId, undefined, arcane ? shot : undefined);
    }

    /** 生成从 x、y 沿 angle 运动的碎片，speed 为原版坐标下的初速，颜色由角色、敌人或主球状态决定。 */
    private spawnProjectileParticle(x: number, y: number, angle: number, speed: number, roleId: number, enemyConfigId?: number, parentShot?: IProjectileData) {
        const duration = 0.2 + Math.random() * 0.4;
        this.ent.EffectModel.projectileHitParticles.push({
            x, y, directionX: Math.cos(angle), directionY: Math.sin(angle),
            speed: speed * projectileParticleScale,
            width: (3.5 + Math.random() * 3.5) * projectileParticleScale,
            duration, life: duration, sizeFactor: 1, roleId, enemyConfigId, parentShot,
        });
    }

    /** 推进 delta 秒表现时间，删除过期效果。 */
    update(delta: number) {
        const model = this.ent.EffectModel;
        model.shakeLife = Math.max(0, model.shakeLife - delta);
        model.recoilLife.forEach((life, source) => {
            if (life > delta) {
                model.recoilLife.set(source, life - delta);
            } else {
                model.recoilLife.delete(source);
            }
        });
        model.hurtLife.forEach((life, source) => {
            if (life > delta) {
                model.hurtLife.set(source, life - delta);
            } else {
                model.hurtLife.delete(source);
            }
        });
        this.ent.EffectModel.effects.forEach((effect) => {
            effect.life -= delta;
        });
        this.ent.EffectModel.effects = this.ent.EffectModel.effects.filter((effect) => {
            return effect.life > 0;
        });
        this.ent.EffectModel.projectileHitParticles = this.ent.EffectModel.projectileHitParticles.filter((particle) => {
            particle.life -= delta;
            if (particle.life <= 0) {
                return false;
            }
            const remaining = particle.life / particle.duration;
            particle.sizeFactor = remaining < 0.5 ? 4 * remaining ** 3 : 1 - 4 * (1 - remaining) ** 3;
            const distance = particle.speed * particle.sizeFactor * delta;
            particle.x += particle.directionX * distance;
            particle.y += particle.directionY * distance;
            return true;
        });
    }
}
