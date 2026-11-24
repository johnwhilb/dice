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
    color?: Color;
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
    ringRadius?: number;
    ringDuration?: number;
    starFlash?: boolean;
}

/** 商店飘字数据（金币变化、升星、羁绊激活等）。 */
export interface IShopFloatingText {
    x: number;
    y: number;
    vx: number;
    vy: number;
    text: string;
    color: Color;
    elapsed: number;
    duration: number;
    major: boolean;
}

export class ShopEffectModel {
    bursts: IShopEffectBurst[] = [];
    texts: IShopFloatingText[] = [];
}
