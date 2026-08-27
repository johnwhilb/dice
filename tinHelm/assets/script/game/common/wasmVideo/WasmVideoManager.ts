import { Texture2D, VideoClip } from 'cc';
import { SoftVideoDecoder } from './soft/SoftVideoDecoder';
import { FfmpegH264Decoder, FfmpegH264Session } from './soft/FfmpegH264Decoder';
import { parseMp4ToAnnexB } from './soft/Mp4Demuxer';
import type { DecodedVideoData, DecodedYuvFrame } from './soft/VideoTypes';
import { SoftVideoStrategy, type SoftVideoBindOptions } from './soft/SoftVideoStrategy';

const TAG = '[WasmVideoManager]';
const DEFAULT_RING = 4;

type VideoState = 'idle' | 'loading' | 'decoding' | 'ready' | 'failed';

type VideoReadyListener = (
    texture: Texture2D,
    width: number,
    height: number,
    decoded: DecodedVideoData | null,
) => void;

// 新增事件类型定义
type VideoEvent = 'playStart' | 'playEnd' | 'progress';
type VideoPlayStartListener = (url: string) => void;
type VideoPlayEndListener = (url: string) => void;
type VideoProgressListener = (url: string, playTime: number, progress: number, currentFrame: number, totalFrames: number) => void;

type VideoSource = VideoClip | string;

type VideoEntry = {
    url: string;
    sourceKey: string;
    state: VideoState;
    gen: number;
    decodeStartMs: number;
    sliceBudgetMs: number;
    firstFrameNotified: boolean;
    strategy: SoftVideoStrategy;
    ringCapacity: number;
    loop: boolean;
    samples: Uint8Array[];
    fps: number;
    duration: number;
    width: number;
    height: number;
    /** 下一待喂入的 AU 下标 */
    auIndex: number;
    /** 已产出画面帧数 */
    pictureCount: number;
    playTime: number;
    playing: boolean;
    cacheComplete: boolean;
    session: FfmpegH264Session | null;
    rgbFrames: Uint8ClampedArray[];
    yuvFrames: DecodedYuvFrame[];
    /** 环形：frameIndex → rgb；按 picture 序号 */
    ring: Map<number, Uint8ClampedArray>;
    ringDecodePicture: number;
    lastPresented: number;
    lastUploadFrame: number;
    lastRgbFrameIndex: number;
    currentRgb: Uint8ClampedArray | null;
    mp4Buffer: ArrayBuffer | null;
    decoded: DecodedVideoData | null;
    texture: Texture2D | null;
    listeners: VideoReadyListener[];

    fillRunning: boolean;

    // 新增事件监听器
    loopCount: number;
    playStartNotified: boolean
    playStartListeners: VideoPlayStartListener[];
    playEndListeners: VideoPlayEndListener[];
    progressListeners: VideoProgressListener[];
};

/**
 * wasm视频管理：按 SoftVideoStrategy 选择实时 / 环形 / 首遍缓存 / 预载。
 */
export class WasmVideoManager {
    private static _instances: Map<SoftVideoStrategy, WasmVideoManager> = new Map();
    /*不同的策略取不同的实例*/
    public static getIns(strategy: SoftVideoStrategy) {
        if (!this._instances.has(strategy)) {
            this._instances.set(strategy, new WasmVideoManager());
        }
        return this._instances.get(strategy);
    }

    private readonly playSliceBudgetMs: number = 5;
    private readonly entries: Map<string, VideoEntry> = new Map();
    private emptyTexture: Texture2D | null = null;
    private decodeQueue: Promise<void> = Promise.resolve();

    /**
     * 绑定视频。策略决定何时回调 onReady（首帧 / 预载完成）。
     */
    public bind(
        url: string,
        source: VideoSource,
        onReady: VideoReadyListener,
        options?: SoftVideoBindOptions,
    ): void {
        const sourceKey = this.resolveSourceKey(source);
        const entry = this.ensureEntry(url);
        entry.sourceKey = sourceKey;
        entry.strategy = options?.strategy ?? SoftVideoStrategy.FirstPassCacheRgb;
        entry.ringCapacity = Math.max(2, options?.ringCapacity ?? DEFAULT_RING);
        entry.loop = options?.loop ?? true;

        if (
            (entry.state === 'ready' || entry.firstFrameNotified)
            && entry.texture
            && entry.decoded
            && entry.sourceKey === sourceKey
        ) {
            this.restartDecoder(entry);
            entry.playTime = 0;
            entry.playing = true;
            onReady(entry.texture, entry.decoded.width, entry.decoded.height, entry.decoded);
            return;
        }

        if (entry.sourceKey !== sourceKey) {
            this.resetRuntime(entry);
            entry.state = 'idle';
        }
        if (entry.listeners.indexOf(onReady) == -1) {
            entry.listeners.push(onReady);
        }
        this.ensureDecoded(url, source);
    }

    /** 每帧推进播放时间并刷新纹理（PageVideo.update 调用） */
    public tick(url: string, dt: number): void {
        const entry = this.entries.get(url);
        if (!entry || !entry.playing || !entry.texture || entry.fps <= 0) {
            return;
        }

        // 首次播放开始，派发playStart事件
        if (entry.playTime <= 0 && entry.loopCount == 0 && !entry.playStartNotified) {
            this.dispatchPlayStart(entry);
        }

        entry.playTime += dt;
        let isPlayEnd = false;
        if (entry.loop && entry.duration > 0) {
            if (entry.playTime >= entry.duration) {
                entry.playTime %= entry.duration;
                entry.loopCount++
                // 循环播放结束会重新开始
                this.dispatchPlayEnd(entry);
            }
        } else if (entry.playing && entry.duration > 0 && entry.playTime >= entry.duration) {
            entry.playTime = entry.duration;
            entry.playing = false;
            isPlayEnd = true;
            entry.loopCount++
        }
        const target = this.resolveTargetFrame(entry);
        const maxFrame = this.maxFrameIndex(entry);
        this.ensureFrameAvailable(entry, target);
        this.presentFrame(entry, target);
        this.pumpBackgroundDecode(entry);

        // 派发进度事件
        if (entry.duration > 0) {
            const progress = Math.min(1, Math.max(0, entry.playTime / entry.duration));
            this.dispatchProgress(entry, entry.playTime, progress, target, maxFrame + 1);
        }
        // 非循环模式播放结束，派发事件
        if (isPlayEnd) {
            this.dispatchPlayEnd(entry);
        }
    }

    public removeReadyListener(url: string, onReady: VideoReadyListener): void {
        const entry = this.ensureEntry(url);
        entry.listeners = entry.listeners.filter(l => l !== onReady);
    }

    public getDecoded(url: string): DecodedVideoData | null {
        return this.entries.get(url)?.decoded ?? null;
    }

    /**
         * 添加视频事件监听
         */
    public on(url: string, event: 'playStart', listener: VideoPlayStartListener): void;
    public on(url: string, event: 'playEnd', listener: VideoPlayEndListener): void;
    public on(url: string, event: 'progress', listener: VideoProgressListener): void;
    public on(url: string, event: VideoEvent, listener: Function): void {
        const entry = this.ensureEntry(url);
        switch (event) {
            case 'playStart':
                entry.playStartListeners.push(listener as VideoPlayStartListener);
                break;
            case 'playEnd':
                entry.playEndListeners.push(listener as VideoPlayEndListener);
                break;
            case 'progress':
                entry.progressListeners.push(listener as VideoProgressListener);
                break;
        }
    }

    /**
   * 移除视频事件监听
   */
    public off(url: string, event: 'playStart', listener: VideoPlayStartListener): void;
    public off(url: string, event: 'playEnd', listener: VideoPlayEndListener): void;
    public off(url: string, event: 'progress', listener: VideoProgressListener): void;
    public off(url: string, event: VideoEvent, listener: Function): void {
        const entry = this.entries.get(url);
        if (!entry) return;

        switch (event) {
            case 'playStart':
                entry.playStartListeners = entry.playStartListeners.filter(l => l !== listener);
                break;
            case 'playEnd':
                entry.playEndListeners = entry.playEndListeners.filter(l => l !== listener);
                break;
            case 'progress':
                entry.progressListeners = entry.progressListeners.filter(l => l !== listener);
                break;
        }
    }

    public release(url: string): void {
        const entry = this.entries.get(url);
        if (!entry) {
            return;
        }
        entry.gen++;
        entry.playing = false;
        entry.listeners.length = 0;
        entry.mp4Buffer = null;
        entry.samples = [];
        entry.rgbFrames = [];
        entry.yuvFrames = [];
        entry.ring.clear();
        entry.currentRgb = null;
        entry.decoded = null;
        if (entry.session) {
            entry.session.release();
            entry.session = null;
        }
        if (entry.texture) {
            entry.texture.destroy();
            entry.texture = null;
        }
        this.entries.delete(url);
        console.log(TAG, 'release', url);
    }

    public getEmptyTexture(): Texture2D {
        if (!this.emptyTexture) {
            const texture = new Texture2D();
            texture.reset({
                width: 2,
                height: 2,
                format: Texture2D.PixelFormat.RGBA8888,
            });
            texture.uploadData(new Uint8Array(16));
            this.emptyTexture = texture;
        }
        return this.emptyTexture;
    }

    private ensureDecoded(url: string, source: VideoSource): void {
        const entry = this.ensureEntry(url);
        const sourceKey = this.resolveSourceKey(source);
        if (entry.state === 'ready' || entry.state === 'loading' || entry.state === 'decoding') {
            if (entry.sourceKey === sourceKey) {
                return;
            }
        }
        if (!sourceKey) {
            this.markFailed(entry, url, typeof source === 'string' ? 'remote url missing' : 'clip uuid missing');
            return;
        }

        entry.sourceKey = sourceKey;
        entry.sliceBudgetMs = this.playSliceBudgetMs;
        if (entry.state === 'failed') {
            entry.state = 'idle';
        }
        this.resetRuntime(entry);
        entry.gen++;
        const loadGen = entry.gen;
        entry.decodeStartMs = performance.now();
        // console.log(
        //     TAG,
        //     'decode start',
        //     url,
        //     typeof source === 'string' ? 'remote' : 'clip',
        //     SoftVideoStrategy[entry.strategy],
        //     'gen',
        //     loadGen,
        // );
        entry.state = 'loading';
        void this.loadMp4AndDecode(url, loadGen, source);
    }

    private resetRuntime(entry: VideoEntry): void {
        if (entry.texture) {
            entry.texture.destroy();
            entry.texture = null;
        }
        if (entry.session) {
            entry.session.release();
            entry.session = null;
        }
        entry.decoded = null;
        entry.firstFrameNotified = false;
        entry.samples = [];
        entry.rgbFrames = [];
        entry.yuvFrames = [];
        entry.ring.clear();
        entry.currentRgb = null;
        entry.auIndex = 0;
        entry.pictureCount = 0;
        entry.ringDecodePicture = 0;
        entry.lastPresented = -1;
        entry.lastUploadFrame = -1;
        entry.lastRgbFrameIndex = -1;
        entry.playTime = 0;
        entry.playing = false;
        entry.cacheComplete = false;
        entry.fillRunning = false;
        entry.width = 0;
        entry.height = 0;
        entry.fps = 0;
        entry.duration = 0;
        entry.loopCount = 0;
        entry.playStartNotified = false;
    }

    private async loadMp4AndDecode(url: string, loadGen: number, source: VideoSource): Promise<void> {
        const entry = this.entries.get(url);
        if (!entry || loadGen !== entry.gen) {
            return;
        }
        try {
            const mp4Buffer = typeof source === 'string'
                ? await SoftVideoDecoder.loadMp4FromUrl(source)
                : await SoftVideoDecoder.loadMp4FromAsset(source); //这里暂时不支持，等以后有需要了再说
            if (loadGen !== entry.gen) {
                return;
            }
            entry.mp4Buffer = mp4Buffer;
            console.log(
                TAG, 'mp4 loaded', url,
                `${(performance.now() - entry.decodeStartMs).toFixed(1)}ms`,
                `${mp4Buffer.byteLength}B`,
            );
            entry.state = 'decoding';
            await this.runStrategyDecode(url, loadGen, mp4Buffer);
        } catch (error) {
            if (loadGen !== entry.gen) {
                return;
            }
            this.markFailed(entry, url, 'mp4 load failed');
            console.error(TAG, 'mp4 load failed', url, error);
        }
    }

    private async runStrategyDecode(url: string, loadGen: number, mp4Buffer: ArrayBuffer): Promise<void> {
        const entry = this.entries.get(url);
        if (!entry || loadGen !== entry.gen) {
            return;
        }

        try {
            await this.enqueueDecode(async () => {
                if (loadGen !== entry.gen) {
                    return;
                }
                const parsed = parseMp4ToAnnexB(mp4Buffer);
                console.log(TAG, 'parsed', parsed);
                entry.samples = parsed.samples;
                entry.fps = parsed.fps;
                entry.duration = parsed.duration > 0 ? parsed.duration : 0;
                entry.width = parsed.width;
                entry.height = parsed.height;

                switch (entry.strategy) {
                    case SoftVideoStrategy.PreloadCacheRgb:
                        await this.runPreloadRgb(entry, loadGen, parsed.samples, parsed.fps, parsed.duration);
                        break;
                    case SoftVideoStrategy.PreloadCacheYuv:
                        await this.runPreloadYuv(entry, loadGen, parsed.samples, parsed.fps, parsed.duration);
                        break;
                    case SoftVideoStrategy.FirstPassCacheRgb:
                        await this.runFirstPassRgb(entry, loadGen, parsed.samples, parsed.fps, parsed.duration);
                        break;
                    case SoftVideoStrategy.FirstPassCacheYuv:
                        await this.runFirstPassYuv(entry, loadGen, parsed.samples, parsed.fps, parsed.duration);
                        break;
                    case SoftVideoStrategy.Realtime:
                        await this.runRealtimeSetup(entry, loadGen);
                        break;
                    case SoftVideoStrategy.RingBuffer:
                        await this.runRingSetup(entry, loadGen);
                        break;
                    default:
                        await this.runFirstPassRgb(entry, loadGen, parsed.samples, parsed.fps, parsed.duration);
                        break;
                }
            });
        } catch (error) {
            if (loadGen !== entry.gen) {
                return;
            }
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('decode aborted')) {
                console.log(TAG, 'decode aborted', url, 'gen', loadGen);
                if (entry.state === 'decoding') {
                    entry.state = 'idle';
                }
                return;
            }
            this.markFailed(entry, url, 'decode failed');
            console.error(TAG, 'decode failed', url, error);
        }
    }

    private async runPreloadRgb(
        entry: VideoEntry,
        loadGen: number,
        samples: Uint8Array[],
        fps: number,
        duration: number,
    ): Promise<void> {
        const decoded = await SoftVideoDecoder.decodeMp4(
            entry.mp4Buffer!,
            fps,
            'rgb',
        );
        if (loadGen !== entry.gen) {
            return;
        }
        entry.rgbFrames = decoded.frames;
        entry.pictureCount = decoded.frameCount;
        entry.width = decoded.width;
        entry.height = decoded.height;
        entry.fps = decoded.fps;
        entry.duration = duration > 0 ? duration : decoded.duration;
        entry.cacheComplete = true;
        entry.decoded = {
            ...decoded,
            duration: entry.duration,
            streaming: false,
        };
        this.notifyFirstFrame(entry, decoded.frames[0]);
        entry.state = 'ready';
        entry.playing = true;
        console.log(TAG, 'preload rgb ready', entry.url, entry.width, entry.height, entry.pictureCount);
    }

    private async runPreloadYuv(
        entry: VideoEntry,
        loadGen: number,
        samples: Uint8Array[],
        fps: number,
        duration: number,
    ): Promise<void> {
        await FfmpegH264Decoder.ensureReady();
        const decoded = await FfmpegH264Decoder.decodeAccessUnitsYuv(samples, fps, duration);
        if (loadGen !== entry.gen) {
            return;
        }
        entry.yuvFrames = decoded.yuvFrames ?? [];
        entry.pictureCount = entry.yuvFrames.length;
        entry.width = decoded.width;
        entry.height = decoded.height;
        entry.fps = fps;
        entry.duration = duration > 0 ? duration : decoded.duration;
        entry.cacheComplete = true;
        entry.session = await FfmpegH264Decoder.createSession();
        const first = entry.session.yuvToRgb(entry.yuvFrames[0]);
        entry.currentRgb = first;
        entry.decoded = {
            width: entry.width,
            height: entry.height,
            fps: entry.fps,
            frameCount: entry.pictureCount,
            duration: entry.duration,
            bytesPerPixel: 3,
            frames: [],
            yuvFrames: entry.yuvFrames,
            streaming: false,
        };
        this.notifyFirstFrame(entry, first);
        entry.state = 'ready';
        entry.playing = true;
        console.log(TAG, 'preload yuv ready', entry.url, entry.pictureCount);
    }

    private async runFirstPassRgb(
        entry: VideoEntry,
        loadGen: number,
        samples: Uint8Array[],
        fps: number,
        duration: number,
    ): Promise<void> {
        const decoded = await SoftVideoDecoder.decodeMp4Streaming(entry.mp4Buffer!, 0, {
            softSliceBudgetMs: entry.sliceBudgetMs,
            shouldAbort: () => loadGen !== entry.gen,
            outputMode: 'rgb',
            onPictureFrame: (width, height, frameIndex, frames) => {
                if (loadGen !== entry.gen) {
                    return;
                }
                entry.width = width;
                entry.height = height;
                entry.fps = fps;
                entry.rgbFrames = frames;
                entry.pictureCount = frames.length;
                if (duration > 0) {
                    entry.duration = duration;
                } else {
                    entry.duration = frames.length / fps;
                }
                entry.decoded = {
                    width,
                    height,
                    fps,
                    frameCount: frames.length,
                    duration: entry.duration,
                    bytesPerPixel: 3,
                    frames,
                    streaming: true,
                };
                if (frameIndex === 0) {
                    this.notifyFirstFrame(entry, frames[0]);
                    entry.playing = true;
                }
            },
        });
        if (loadGen !== entry.gen) {
            return;
        }
        entry.rgbFrames = decoded.frames;
        entry.pictureCount = decoded.frameCount;
        entry.width = decoded.width;
        entry.height = decoded.height;
        entry.duration = duration > 0 ? duration : decoded.duration;
        entry.cacheComplete = true;
        if (entry.decoded) {
            entry.decoded.frameCount = decoded.frameCount;
            entry.decoded.duration = entry.duration;
            entry.decoded.streaming = false;
        } else {
            entry.decoded = { ...decoded, streaming: false };
            this.notifyFirstFrame(entry, decoded.frames[0]);
            entry.playing = true;
        }
        entry.state = 'ready';
        console.log(TAG, 'first-pass rgb done', entry.url, entry.pictureCount);
    }

    private async runFirstPassYuv(
        entry: VideoEntry,
        loadGen: number,
        samples: Uint8Array[],
        fps: number,
        duration: number,
    ): Promise<void> {
        entry.session = await FfmpegH264Decoder.createSession();
        const session = entry.session;
        let unitIndex = 0;
        const yieldForDecode = (): Promise<void> =>
            new Promise((resolve) => requestAnimationFrame(() => resolve()));

        while (unitIndex < samples.length) {
            if (loadGen !== entry.gen) {
                return;
            }
            const sliceStart = performance.now();
            while (unitIndex < samples.length && performance.now() - sliceStart < entry.sliceBudgetMs) {
                const yuv = session.decodeAccessUnitYuv(samples[unitIndex++]);
                if (!yuv) {
                    continue;
                }
                entry.yuvFrames.push(yuv);
                entry.width = yuv.width;
                entry.height = yuv.height;
                entry.fps = fps;
                entry.pictureCount = entry.yuvFrames.length;
                if (duration > 0) {
                    entry.duration = duration;
                } else {
                    entry.duration = entry.pictureCount / fps;
                }
                const rgb = session.yuvToRgb(yuv);
                entry.currentRgb = rgb;
                entry.decoded = {
                    width: entry.width,
                    height: entry.height,
                    fps,
                    frameCount: entry.pictureCount,
                    duration: entry.duration,
                    bytesPerPixel: 3,
                    frames: [],
                    yuvFrames: entry.yuvFrames,
                    streaming: true,
                };
                if (!entry.firstFrameNotified) {
                    this.notifyFirstFrame(entry, rgb);
                    entry.playing = true;
                } else if (entry.texture && entry.pictureCount - 1 === this.resolveTargetFrame(entry)) {
                    entry.texture.uploadData(rgb);
                }
            }
            if (unitIndex < samples.length) {
                await yieldForDecode();
            }
        }

        if (loadGen !== entry.gen) {
            return;
        }
        entry.cacheComplete = true;
        if (entry.decoded) {
            entry.decoded.streaming = false;
            entry.decoded.frameCount = entry.yuvFrames.length;
            entry.decoded.duration = entry.duration;
        }
        entry.state = 'ready';
        console.log(TAG, 'first-pass yuv done', entry.url, entry.yuvFrames.length);
    }

    private async runRealtimeSetup(entry: VideoEntry, loadGen: number): Promise<void> {
        entry.session = await FfmpegH264Decoder.createSession();
        if (loadGen !== entry.gen) {
            return;
        }
        // 解出首帧即可开播
        const ok = this.decodeNextPictures(entry, 1);
        if (!ok || !entry.currentRgb) {
            this.markFailed(entry, entry.url, 'realtime first frame failed');
            return;
        }
        if (entry.duration <= 0 && entry.fps > 0) {
            entry.duration = entry.samples.length / entry.fps;
        }
        entry.decoded = {
            width: entry.width,
            height: entry.height,
            fps: entry.fps,
            frameCount: entry.samples.length,
            duration: entry.duration,
            bytesPerPixel: 3,
            frames: [],
            streaming: true,
        };
        this.notifyFirstFrame(entry, entry.currentRgb);
        entry.playing = true;
        entry.state = 'ready';
        console.log(TAG, 'realtime ready', entry.url);
    }

    private async runRingSetup(entry: VideoEntry, loadGen: number): Promise<void> {
        entry.session = await FfmpegH264Decoder.createSession();
        if (loadGen !== entry.gen) {
            return;
        }
        this.fillRing(entry, entry.ringCapacity);
        const first = entry.ring.get(0);
        if (!first) {
            this.markFailed(entry, entry.url, 'ring first frame failed');
            return;
        }
        if (entry.duration <= 0 && entry.fps > 0) {
            entry.duration = entry.samples.length / entry.fps;
        }
        entry.currentRgb = first;
        entry.decoded = {
            width: entry.width,
            height: entry.height,
            fps: entry.fps,
            frameCount: entry.samples.length,
            duration: entry.duration,
            bytesPerPixel: 3,
            frames: [],
            streaming: true,
        };
        this.notifyFirstFrame(entry, first);
        entry.playing = true;
        entry.state = 'ready';
        console.log(TAG, 'ring ready', entry.url, 'cap', entry.ringCapacity);
    }

    private resolveTargetFrame(entry: VideoEntry): number {
        const maxIndex = Math.max(0, this.maxFrameIndex(entry));
        return Math.min(maxIndex, Math.max(0, Math.floor(entry.playTime * entry.fps)));
    }

    private maxFrameIndex(entry: VideoEntry): number {
        switch (entry.strategy) {
            case SoftVideoStrategy.PreloadCacheRgb:
            case SoftVideoStrategy.FirstPassCacheRgb:
                return Math.max(0, entry.rgbFrames.length - 1);
            case SoftVideoStrategy.PreloadCacheYuv:
            case SoftVideoStrategy.FirstPassCacheYuv:
                return Math.max(0, entry.yuvFrames.length - 1);
            case SoftVideoStrategy.Realtime:
            case SoftVideoStrategy.RingBuffer:
                return Math.max(0, entry.samples.length - 1);
            default:
                return Math.max(0, entry.pictureCount - 1);
        }
    }

    private ensureFrameAvailable(entry: VideoEntry, target: number): void {
        switch (entry.strategy) {
            case SoftVideoStrategy.Realtime:
                this.ensureRealtimeFrame(entry, target);
                break;
            case SoftVideoStrategy.RingBuffer:
                this.ensureRingFrame(entry, target);
                break;
            default:
                break;
        }
    }

    private ensureRealtimeFrame(entry: VideoEntry, target: number): void {
        if (!entry.session) {
            return;
        }
        if (target < entry.lastPresented) {
            this.restartDecoder(entry);
        }
        while (entry.pictureCount <= target && entry.auIndex < entry.samples.length) {
            this.decodeNextPictures(entry, 1);
        }
        if (entry.auIndex >= entry.samples.length && entry.pictureCount > 0) {
            entry.cacheComplete = true;
        }
        entry.lastPresented = target;
    }

    private ensureRingFrame(entry: VideoEntry, target: number): void {
        if (target < entry.lastPresented) {
            this.restartDecoder(entry);
        }
        if (!entry.ring.has(target)) {
            while (!entry.ring.has(target) && entry.auIndex < entry.samples.length) {
                this.fillRing(entry, 1);
            }
        }
        const minKeep = Math.max(0, target - 1);
        for (const key of [...entry.ring.keys()]) {
            if (key < minKeep) {
                entry.ring.delete(key);
            }
        }
        entry.lastPresented = target;
    }

    private restartDecoder(entry: VideoEntry): void {
        if (entry.session) {
            entry.session.release();
        }
        entry.session = FfmpegH264Decoder.createSessionSync();
        entry.auIndex = 0;
        entry.pictureCount = 0;
        entry.ringDecodePicture = 0;
        entry.ring.clear();
        entry.cacheComplete = false;
        entry.currentRgb = null;
        entry.lastPresented = -1;
        entry.lastUploadFrame = -1;
        entry.lastRgbFrameIndex = -1;

        entry.loopCount = 0;
        entry.playStartNotified = false;
    }

    /** 尽量解出 want 张画面；返回是否至少解出 1 张 */
    private decodeNextPictures(entry: VideoEntry, want: number): boolean {
        if (!entry.session) {
            return false;
        }
        let got = 0;
        while (got < want && entry.auIndex < entry.samples.length) {
            const batch = entry.session.decodeAccessUnitsRgbBatch(entry.samples, entry.auIndex, 1);
            entry.auIndex += batch.consumed;
            if (batch.consumed <= 0) {
                break;
            }
            if (batch.width > 0) {
                entry.width = batch.width;
                entry.height = batch.height;
            }
            for (const frame of batch.frames) {
                entry.currentRgb = frame;
                entry.pictureCount += 1;
                got += 1;
            }
        }
        return got > 0;
    }

    private fillRing(entry: VideoEntry, count: number): void {
        if (!entry.session) {
            return;
        }
        let filled = 0;
        while (filled < count && entry.auIndex < entry.samples.length) {
            if (entry.ring.size >= entry.ringCapacity) {
                // 环满：若最旧已远离播放头则删，否则停止
                const oldest = Math.min(...entry.ring.keys());
                const playHead = this.resolveTargetFrame(entry);
                if (oldest < playHead) {
                    entry.ring.delete(oldest);
                } else {
                    break;
                }
            }
            const batch = entry.session.decodeAccessUnitsRgbBatch(entry.samples, entry.auIndex, 1);
            entry.auIndex += batch.consumed;
            if (batch.consumed <= 0) {
                break;
            }
            if (batch.width > 0) {
                entry.width = batch.width;
                entry.height = batch.height;
            }
            for (const frame of batch.frames) {
                entry.ring.set(entry.ringDecodePicture, frame);
                entry.ringDecodePicture += 1;
                entry.pictureCount = entry.ringDecodePicture;
                filled += 1;
            }
        }
        if (entry.auIndex >= entry.samples.length) {
            entry.cacheComplete = true;
        }
    }

    private pumpBackgroundDecode(entry: VideoEntry): void {
        if (entry.strategy !== SoftVideoStrategy.RingBuffer || entry.fillRunning) {
            return;
        }
        if (entry.cacheComplete || entry.auIndex >= entry.samples.length) {
            return;
        }
        const playHead = this.resolveTargetFrame(entry);
        const ahead = entry.ringDecodePicture - playHead;
        if (ahead >= entry.ringCapacity - 1) {
            return;
        }
        entry.fillRunning = true;
        const gen = entry.gen;
        requestAnimationFrame(() => {
            entry.fillRunning = false;
            if (gen !== entry.gen) {
                return;
            }
            this.fillRing(entry, 2);
        });
    }

    private presentFrame(entry: VideoEntry, target: number): void {
        if (!entry.texture) {
            return;
        }
        let rgb: Uint8ClampedArray | null = null;
        switch (entry.strategy) {
            case SoftVideoStrategy.PreloadCacheRgb:
            case SoftVideoStrategy.FirstPassCacheRgb:
                rgb = entry.rgbFrames[target] ?? null;
                break;
            case SoftVideoStrategy.PreloadCacheYuv:
            case SoftVideoStrategy.FirstPassCacheYuv: {
                if (entry.lastRgbFrameIndex === target && entry.currentRgb) {
                    rgb = entry.currentRgb;
                } else {
                    const yuv = entry.yuvFrames[target];
                    if (yuv) {
                        if (!entry.session) {
                            entry.session = FfmpegH264Decoder.createSessionSync();
                        }
                        rgb = entry.session.yuvToRgb(yuv);
                        entry.currentRgb = rgb;
                        entry.lastRgbFrameIndex = target;
                    }
                }
                break;
            }
            case SoftVideoStrategy.RingBuffer:
                rgb = entry.ring.get(target) ?? entry.currentRgb;
                if (rgb) {
                    entry.currentRgb = rgb;
                }
                break;
            case SoftVideoStrategy.Realtime:
                rgb = entry.currentRgb;
                break;
            default:
                rgb = entry.currentRgb;
                break;
        }
        if (!rgb) {
            return;
        }
        if (entry.lastUploadFrame === target) {
            return;
        }
        entry.texture.uploadData(rgb);
        entry.lastUploadFrame = target;
    }

    private notifyFirstFrame(entry: VideoEntry, rgb: Uint8ClampedArray): void {
        if (entry.firstFrameNotified) {
            return;
        }
        entry.firstFrameNotified = true;
        let texture = entry.texture;
        if (!texture) {
            texture = new Texture2D();
            texture.reset({
                width: entry.width,
                height: entry.height,
                format: Texture2D.PixelFormat.RGB888,
            });
            entry.texture = texture;
        }
        texture.uploadData(rgb);
        if (!entry.decoded) {
            entry.decoded = {
                width: entry.width,
                height: entry.height,
                fps: entry.fps,
                frameCount: Math.max(1, entry.pictureCount),
                duration: entry.duration,
                bytesPerPixel: 3,
                frames: entry.rgbFrames,
                yuvFrames: entry.yuvFrames.length > 0 ? entry.yuvFrames : undefined,
                streaming: !entry.cacheComplete,
            };
        }
        console.log(TAG, 'first frame', entry.url, entry.width, entry.height, SoftVideoStrategy[entry.strategy]);
        this.notifyEntryListeners(entry, texture, entry.width, entry.height, entry.decoded);
    }

    public ensureEntry(url: string): VideoEntry {
        let entry = this.entries.get(url);
        if (!entry) {
            entry = {
                url: url,
                sourceKey: '',
                state: 'idle',
                gen: 0,
                decodeStartMs: 0,
                sliceBudgetMs: this.playSliceBudgetMs,
                firstFrameNotified: false,
                strategy: SoftVideoStrategy.FirstPassCacheRgb,
                ringCapacity: DEFAULT_RING,
                loop: true,
                samples: [],
                fps: 0,
                duration: 0,
                width: 0,
                height: 0,
                auIndex: 0,
                pictureCount: 0,
                playTime: 0,
                playing: false,
                cacheComplete: false,
                session: null,
                rgbFrames: [],
                yuvFrames: [],
                ring: new Map(),
                ringDecodePicture: 0,
                lastPresented: -1,
                lastUploadFrame: -1,
                lastRgbFrameIndex: -1,
                currentRgb: null,
                mp4Buffer: null,
                decoded: null,
                texture: null,
                listeners: [],
                fillRunning: false,

                // 初始化事件监听器数组
                loopCount: 0,
                playStartNotified: false,
                playStartListeners: [],
                playEndListeners: [],
                progressListeners: [],
            };
            this.entries.set(url, entry);
        }
        return entry;
    }

    private notifyEntryListeners(
        entry: VideoEntry,
        texture: Texture2D,
        width: number,
        height: number,
        decoded: DecodedVideoData | null,
    ): void {
        const listeners = entry.listeners.splice(0, entry.listeners.length);
        for (const listener of listeners) {
            listener(texture, width, height, decoded);
        }
    }

    private markFailed(entry: VideoEntry, url: string, reason: string): void {
        entry.state = 'failed';
        console.error(TAG, reason, url);
        const empty = this.getEmptyTexture();
        this.notifyEntryListeners(entry, empty, empty.width, empty.height, null);
    }

    private enqueueDecode(task: () => Promise<void>): Promise<void> {
        const run = this.decodeQueue.then(task);
        this.decodeQueue = run.catch(() => { });
        return run;
    }

    private resolveSourceKey(source: VideoSource): string {
        if (typeof source === 'string') {
            return source.trim();
        }
        return (source?.uuid || source?._uuid) ?? '';
    }

    private dispatchPlayStart(entry: VideoEntry): void {
        if (entry.playStartNotified) {
            return;
        }
        for (const listener of entry.playStartListeners) {
            listener(entry.url);
        }
        entry.playStartNotified = true;
    }

    private dispatchPlayEnd(entry: VideoEntry): void {
        for (const listener of entry.playEndListeners) {
            listener(entry.url);
        }
    }

    private dispatchProgress(entry: VideoEntry, playTime: number, progress: number, currentFrame: number, totalFrames: number): void {
        for (const listener of entry.progressListeners) {
            listener(entry.url, playTime, progress, currentFrame, totalFrames);
        }
    }
}