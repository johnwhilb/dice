import type { Color } from "cc";

/** 碎片方向、初始尺寸和存活状态，长度采用商店坐标，时间单位为秒。 */
export interface IShopEffectParticle {
    x: number;
    y: number;
    directionX: number;
    directionY: number;
    speed: number;
    width: number;
    duration: number;
    life: number;
    sizeFactor: number;
}

/** 从旧图标取样的消散效果与当前的弹簧状态。 */
export interface IShopEffectBurst {
    x: number;
    y: number;
    color: Color;
    elapsed: number;
    radius: number;
    springScale: number;
    springVelocity: number;
    particles: IShopEffectParticle[];
}

export class ShopEffectModel {
    bursts: IShopEffectBurst[] = [];
}
