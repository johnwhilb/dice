import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { IEffectData, IProjectileHitParticle } from "../EffectEvent";

@ecs.register("EffectModel")
export class EffectModel extends ecs.Comp {
    effects: IEffectData[] = [];
    projectileHitParticles: IProjectileHitParticle[] = [];
    /** 角色下标对应的出手回弹剩余秒数。 */
    recoilLife = new Map<number, number>();
    /** 角色下标对应的受伤回弹剩余秒数。 */
    hurtLife = new Map<number, number>();
    /** 镜头反馈剩余秒数，范围冲击优先于射击的轻微震动。 */
    shakeLife = 0;
    /** 当前震动的总时长和起始振幅。 */
    shakeDuration = 0;
    shakeAmplitude = 0;
    /** 退场慢放剩余的现实秒数。 */
    slowLife = 0;

    /** 清空本场短时表现数据。 */
    reset() {
        this.effects = [];
        this.projectileHitParticles = [];
        this.recoilLife.clear();
        this.hurtLife.clear();
        this.shakeLife = 0;
        this.shakeDuration = 0;
        this.shakeAmplitude = 0;
        this.slowLife = 0;
    }
}
