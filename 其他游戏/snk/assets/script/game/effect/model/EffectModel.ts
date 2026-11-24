import { ecs } from "db://oops-framework/libs/ecs/ECS";
import type { ArenaWallSide, IEffectData, IProjectileHitParticle } from "../EffectEvent";

interface ICameraShake {
    elapsed: number;
    amplitude: number;
    duration: number;
    samplesX: number[];
    samplesY: number[];
}

interface IWallRipple {
    source: number;
    delay: number;
    rank: number;
    rate: number;
}

@ecs.register("EffectModel")
export class EffectModel extends ecs.Comp {
    effects: IEffectData[] = [];
    projectileHitParticles: IProjectileHitParticle[] = [];
    /** 角色下标对应的出手回弹剩余秒数。 */
    recoilLife = new Map<number, number>();
    /** 角色下标对应的受伤回弹剩余秒数。 */
    hurtLife = new Map<number, number>();
    /** 蛇头撞墙后向队尾依次传导的波浪回弹队列。 */
    wallRipples: IWallRipple[] = [];
    /** 镜头反馈剩余秒数，范围冲击优先于射击的轻微震动。 */
    shakeLife = 0;
    /** 当前震动的总时长和起始振幅。 */
    shakeDuration = 0;
    shakeAmplitude = 0;
    collisionShakes: ICameraShake[] = [];
    collisionShakeX = 0;
    collisionShakeY = 0;
    wallShakeX = 0;
    wallShakeY = 0;
    wallVelocityX = 0;
    wallVelocityY = 0;
    /** 退场慢放剩余的现实秒数。 */
    slowLife = 0;
    /** 短促打击顿帧剩余现实秒数。 */
    hitstopLife = 0;
    /** 两次顿帧之间的冷却秒数，防止高频攻击导致卡顿感。 */
    hitstopCooldown = 0;
    /** 全屏受击红闪剩余现实秒数。 */
    screenHurtFlash = 0;
    /** 竞技场四面墙的撞击高亮剩余秒数。 */
    wallFlashLife = new Map<ArenaWallSide, number>();
    /** 本场战斗连杀数与连杀计时。 */
    killStreak = 0;
    killStreakTimer = 0;
    /** 本场总击杀数与总暴击数，用于结算展示。 */
    totalKills = 0;
    totalCrits = 0;

    /** 返回随机震动或墙面弹簧是否仍在活动。 */
    get hasCollisionShake() {
        return !!(this.collisionShakes.length || this.wallShakeX || this.wallShakeY || this.wallVelocityX || this.wallVelocityY);
    }

    /** 清空本场短时表现与统计数据。 */
    reset() {
        this.effects = [];
        this.projectileHitParticles = [];
        this.recoilLife.clear();
        this.hurtLife.clear();
        this.wallRipples = [];
        this.shakeLife = 0;
        this.shakeDuration = 0;
        this.shakeAmplitude = 0;
        this.collisionShakes = [];
        this.collisionShakeX = 0;
        this.collisionShakeY = 0;
        this.wallShakeX = 0;
        this.wallShakeY = 0;
        this.wallVelocityX = 0;
        this.wallVelocityY = 0;
        this.slowLife = 0;
        this.hitstopLife = 0;
        this.hitstopCooldown = 0;
        this.screenHurtFlash = 0;
        this.wallFlashLife.clear();
        this.killStreak = 0;
        this.killStreakTimer = 0;
        this.totalKills = 0;
        this.totalCrits = 0;
    }
}
