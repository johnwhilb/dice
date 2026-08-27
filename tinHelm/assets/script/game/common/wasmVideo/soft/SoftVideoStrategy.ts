import { Enum } from 'cc';

/**
 * 软解播放策略（Inspector 可选）
 * 1 实时解码 / 2 环形缓冲 / 3 首遍缓存 YUV / 4 首遍缓存 RGB888 / 5 预载 YUV / 6 预载 RGB888
 */
export enum SoftVideoStrategy {
    /** 几乎不占帧缓存；按进度逐帧解码，最吃 CPU */
    Realtime = 1,
    /** 只缓存即将播放的 N 帧，边播边解 */
    RingBuffer = 2,
    /** 第一遍边解边播并落盘 YUV，之后从 YUV 转 RGB 循环 */
    FirstPassCacheYuv = 3,
    /** 第一遍边解边播并落盘 RGB888，之后直接播缓存 */
    FirstPassCacheRgb = 4,
    /** 开播前解完全部 YUV，再播（省内存、播放时转色），需要时间进行预加载 */
    PreloadCacheYuv = 5,
    /** 开播前解完全部 RGB888，再播（最流畅、最占内存），需要时间进行预加载*/
    PreloadCacheRgb = 6,
}

Enum(SoftVideoStrategy);

export type SoftVideoBindOptions = {
    strategy?: SoftVideoStrategy;
    /** 环形缓冲容量（仅 RingBuffer），默认 16 */
    ringCapacity?: number;
    loop?: boolean;
};
