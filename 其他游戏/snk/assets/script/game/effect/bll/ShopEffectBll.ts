import type { Color } from "cc";
import type { IShopEffectBurst, ShopEffectModel } from "../model/ShopEffectModel";
import { ColorConst } from "../../common/config/ColorConst";

export const shopEffectScale = 3;
export const shopEffectExpandTime = 0.1;
export const shopEffectColorTime = shopEffectExpandTime + 0.15;

export class ShopEffectBll {
    private readonly shrinkTime = 0.25;
    private readonly maxParticleTime = 0.55;

    constructor(private readonly model: ShopEffectModel) {
    }

    /** 在局部坐标 x、y 播放碎裂，color 为碎片颜色。 */
    play(x: number, y: number, color: Color) {
        this.model.bursts.push({
            x,
            y,
            color: color.clone(),
            elapsed: 0,
            radius: 0,
            springScale: 1,
            springVelocity: 0,
            particles: [],
        });
    }

    /** 在局部坐标 x、y 播放庆祝光环、星芒与多色粒子，major 表示高阶升星爆发。 */
    playCelebration(x: number, y: number, color: Color, major: boolean = false) {
        const count = major ? 20 : 12;
        const particles = Array.from({ length: count }, (value, index) => {
            const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
            const duration = (major ? 0.42 : 0.32) + Math.random() * 0.22;
            const accent = major && index % 2 === 0 ? ColorConst.shopMergeButton.clone() : color.clone();
            return {
                x,
                y,
                directionX: Math.cos(angle),
                directionY: Math.sin(angle),
                speed: ((major ? 190 : 145) + Math.random() * 75) * shopEffectScale * 0.65,
                width: ((major ? 6.5 : 5) + Math.random() * 3) * shopEffectScale,
                life: duration,
                duration,
                sizeFactor: 1,
                color: accent,
            };
        });
        this.model.bursts.push({
            x,
            y,
            color: color.clone(),
            elapsed: shopEffectExpandTime,
            radius: (major ? 8 : 6) * shopEffectScale,
            springScale: major ? 2.2 : 1.7,
            springVelocity: 0,
            particles,
            ringRadius: major ? 82 : 56,
            ringDuration: major ? 0.42 : 0.32,
            starFlash: major,
        });
    }

    /** 在局部坐标 x、y 生成带弹性上浮的商店提示飘字 text，major 放大强调。 */
    playText(x: number, y: number, text: string, color: Color, major: boolean = false) {
        this.model.texts.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 18,
            vy: major ? 95 : 78,
            text,
            color: color.clone(),
            elapsed: 0,
            duration: major ? 0.92 : 0.72,
            major,
        });
    }

    /** 用最长 1/60 秒的小步更新 delta 秒的亮斑、光环、弹簧、碎片与飘字。 */
    update(delta: number) {
        let remaining = Math.min(delta, shopEffectExpandTime + this.maxParticleTime);
        while (remaining > 0 && (this.model.bursts.length > 0 || this.model.texts.length > 0)) {
            const step = Math.min(remaining, 1 / 60);
            this.model.bursts = this.model.bursts.filter((burst) => {
                this.advanceBurst(burst, step);
                const ringAlive = !!burst.ringDuration && burst.elapsed - shopEffectExpandTime < burst.ringDuration;
                return burst.radius > 0 || burst.particles.length > 0 || burst.elapsed <= shopEffectExpandTime || ringAlive;
            });
            this.model.texts = this.model.texts.filter((item) => {
                item.elapsed += step;
                item.x += item.vx * step;
                item.y += item.vy * step;
                item.vy *= Math.max(0, 1 - 2.6 * step);
                return item.elapsed < item.duration;
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
                    x: burst.x,
                    y: burst.y,
                    directionX: Math.cos(angle),
                    directionY: Math.sin(angle),
                    speed: (150 + Math.random() * 50) * shopEffectScale,
                    width: (5 + Math.random() * 3) * shopEffectScale,
                    life: duration,
                    duration,
                    sizeFactor: 1,
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
