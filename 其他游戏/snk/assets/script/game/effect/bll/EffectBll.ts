import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import type { Effect } from "../Effect";
import { EffectKind, projectileEndDuration } from "../EffectEvent";
import { TableCombatRule } from "../../common/table/TableCombatRule";
import type { IProjectileData } from "../../projectile/ProjectileEvent";

export class EffectBll extends CCBusiness<Effect> {
    /** 记录位置 x、y 的 kind 表现，amount 为飘字数值，roleId 决定动态颜色。 */
    show(kind: EffectKind, x: number, y: number, radius: number, amount: number, roleId: number, endX: number = x, endY: number = y) {
        const rule = TableCombatRule.getCurrent();
        const life = kind === EffectKind.Damage || kind === EffectKind.Heal ? rule.textLife : rule.effectLife;
        this.ent.EffectModel.effects.push({ kind, x, y, endX, endY, radius, amount, roleId, life });
    }

    /** 在 x、y 生成亮斑和碎片，ended 表示弹丸终止，颜色来自 roleId 和 enemyConfigId。 */
    showProjectileHit(x: number, y: number, ended: boolean, roleId: number, enemyConfigId: number) {
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

    /** 从 shot 当前位置发出尾迹，奥术师按弹道反方向散开并跟随主球闪亮。 */
    showProjectileTrail(shot: IProjectileData, roleId: number, arcane: boolean) {
        const angle = arcane ? shot.angle + Math.PI + (Math.random() - 0.5) * Math.PI / 3 : Math.random() * Math.PI * 2;
        const speed = arcane ? 30 + Math.random() * 45 : 150 + Math.random() * 300;
        this.spawnProjectileParticle(shot.x, shot.y, angle, speed, roleId, undefined, arcane ? shot : undefined);
    }

    /** 生成从 x、y 沿 angle 运动的碎片，speed 为初速，颜色由角色、敌人或主球状态决定。 */
    private spawnProjectileParticle(x: number, y: number, angle: number, speed: number, roleId: number, enemyConfigId?: number, parentShot?: IProjectileData) {
        const duration = 0.2 + Math.random() * 0.4;
        this.ent.EffectModel.projectileHitParticles.push({
            x, y, directionX: Math.cos(angle), directionY: Math.sin(angle), speed,
            width: 3.5 + Math.random() * 3.5,
            duration, life: duration, sizeFactor: 1, roleId, enemyConfigId, parentShot,
        });
    }

    /** 推进 delta 秒表现时间，删除过期效果。 */
    update(delta: number) {
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
