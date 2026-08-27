/** 软解输出：rgb=默认 RGB888 全缓存；yuv=先落 YUV；rgba=可选带 Alpha */
export type SoftDecodeOutputMode = 'rgb' | 'yuv' | 'rgba';

/** 单帧 YUV（I420），供 YUV 全缓存策略使用 */
export type DecodedYuvFrame = {
    width: number;
    height: number;
    /** Y 平面行距（可能因对齐 > width） */
    stride: number;
    /** UV 平面行距（可能因对齐 > width/2，勿用 stride/2） */
    strideUv: number;
    y: Uint8Array;
    u: Uint8Array;
    v: Uint8Array;
};

/** 解码结果：默认全帧 RGB888 缓存在内存，供循环播放。 */
export interface DecodedVideoData {
    width: number;
    height: number;
    fps: number;
    frameCount: number;
    duration: number;
    /** 每像素字节数：rgb=3，rgba=4 */
    bytesPerPixel: 3 | 4;
    /** RGB 帧（策略 4/6 或展示用）；YUV 策略下可为空或仅作 scratch */
    frames: Uint8ClampedArray[];
    /** YUV 全缓存（策略 3/5） */
    yuvFrames?: DecodedYuvFrame[];
    /** 边解边播中：frames/yuvFrames 持续增长 */
    streaming?: boolean;
}

/** 时间片边解边播选项 */
export type StreamingDecodeOptions = {
    softSliceBudgetMs?: number;
    shouldAbort?: () => boolean;
    /** 默认 rgb */
    outputMode?: SoftDecodeOutputMode;
    onPictureFrame?: (width: number, height: number, frameIndex: number, frames: Uint8ClampedArray[]) => void;
};
