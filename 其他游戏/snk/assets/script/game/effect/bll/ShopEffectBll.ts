import type { Color } from "cc";
import type { IShopEffectBurst, ShopEffectModel } from "../model/ShopEffectModel";

export const shopEffectScale = 3;
export const shopEffectExpandTime = 0.1;
export const shopEffectColorTime = shopEffectExpandTime + 0.15;

export class ShopEffectBll {
    private readonly shrinkTime = 0.25;
    private readonly maxParticleTime = 0.5;

    constructor(private readonly model: ShopEffectModel) {
    }

    /** 在图标中心 x、y 的下方生成消散，color 为旧图标的显示底色。 */
    play(x: number, y: number, color: Color) {
        this.model.bursts.push({
            x, y: y - 4 * shopEffectScale, color: color.clone(),
            elapsed: 0, radius: 0, springScale: 1, springVelocity: 0, particles: [],
        });
    }

    /** 用最长 1/60 秒的小步更新 delta 秒的亮斑、弹簧和碎片。 */
    update(delta: number) {
        let remaining = Math.min(delta, shopEffectExpandTime + this.maxParticleTime);
        while (remaining > 0 && this.model.bursts.length > 0) {
            const step = Math.min(remaining, 1 / 60);
            this.model.bursts = this.model.bursts.filter((burst) => {
                this.advanceBurst(burst, step);
                return burst.radius > 0 || burst.particles.length > 0 || burst.elapsed <= shopEffectExpandTime;
            });
            remaining -= step;
        }
    }

    /** 推进单个 burst 的亮斑时间，并在展开结束时施加弹簧冲击和生成碎片。 */
    private advanceBurst(burst: IShopEffectBurst, delta: number) {
        const previous = burst.elapsed;
        burst.elapsed += delta;
        if (burst.elapsed < shopEffectExpandTime) {
            burst.radius = 6 * shopEffectScale * this.cubicInOut(burst.elapsed / shopEffectExpandTime);
            return;
        }
        let burstDelta = delta;
        if (previous < shopEffectExpandTime) {
            burstDelta = burst.elapsed - shopEffectExpandTime;
            burst.springScale += 1;
            const count = 6 + Math.floor(Math.random() * 3);
            burst.particles = Array.from({ length: count }, () => {
                const angle = Math.random() * 2 * Math.PI;
                const duration = 0.3 + Math.random() * 0.2;
                return {
                    x: burst.x, y: burst.y, directionX: Math.cos(angle), directionY: Math.sin(angle),
                    speed: (150 + Math.random() * 50) * shopEffectScale,
                    width: (5 + Math.random() * 3) * shopEffectScale,
                    life: duration, duration, sizeFactor: 1,
                };
            });
        }
        burst.springVelocity += (-100 * (burst.springScale - 1) - 10 * burst.springVelocity) * burstDelta;
        burst.springScale += burst.springVelocity * burstDelta;
        burst.radius = 6 * shopEffectScale * Math.max(0, 1 - (burst.elapsed - shopEffectExpandTime) / this.shrinkTime);
        burst.particles = burst.particles.filter((particle) => {
            particle.life -= burstDelta;
            if (particle.life <= 0) {
                return false;
            }
            particle.sizeFactor = this.cubicInOut(particle.life / particle.duration);
            const distance = particle.speed * particle.sizeFactor * burstDelta;
            particle.x += particle.directionX * distance;
            particle.y += particle.directionY * distance;
            return true;
        });
    }

    /** 返回归一化时间 progress 对应的三次缓入缓出比例。 */
    private cubicInOut(progress: number) {
        return progress < 0.5 ? 4 * progress ** 3 : 1 - 4 * (1 - progress) ** 3;
    }
}
