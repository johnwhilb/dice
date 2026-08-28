// VideoPlayerWeb.ts — Web 性能优化版
// Cocos Creator 3.8.6
//
// 核心优化：
// 1. 前向播放：canvas 直接 uploadData，移除每帧 getImageData() CPU 读回。
// 2. 优先 requestVideoFrameCallback：只在浏览器真正产出新视频帧时上传纹理。
// 3. fallback RAF 也会按 currentTime 去重，避免 30fps 视频被 60/120Hz 重复上传。
// 4. 纹理分辨率与 UI 显示尺寸解耦，避免为了 cover 全屏把视频放大后再逐帧处理。
// 5. forward-reverse：使用低分辨率、低采样率、内存上限的 RGBA 缓存，避免数百 MB/GB 常驻。

import {
    Texture2D,
    SpriteFrame,
    Rect,
    Size,
    Vec2,
    Sprite,
    UITransform,
} from "cc";
import { VideoFitHelper } from "./VideoFitHelper";
import { IVideoPlayArgs, VideoBase } from "./VideoBase";

export default class VideoPlayerWeb extends VideoBase {
    private video: HTMLVideoElement | null = null;

    /** 前向播放的 GPU 上传画布；不做 getImageData，保持 GPU 友好。 */
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    /** 仅 forward-reverse 缓存使用；允许 willReadFrequently。 */
    private cacheCanvas: HTMLCanvasElement | null = null;
    private cacheCtx: CanvasRenderingContext2D | null = null;

    private tex: Texture2D | null = null;
    private spriteFrame: SpriteFrame | null = null;

    private running = false;
    private paused = false;

    private rafId: number | null = null;
    private videoFrameCallbackId: number | null = null;

    /** UI 显示尺寸（逻辑像素），与实际纹理像素解耦。 */
    private displayWidth = 0;
    private displayHeight = 0;

    /** 前向上传纹理尺寸。 */
    private renderWidth = 0;
    private renderHeight = 0;

    /** 正反播缓存尺寸。 */
    private cacheWidth = 0;
    private cacheHeight = 0;

    private previousTime = 0;
    private loopCount = 0;
    private lastRenderedVideoTime = -1;

    private playMode: IVideoPlayArgs["playMode"] = "normal";
    private shouldLoop = false;

    private pingPongDirection = 1;
    private pingPongPausedAt = 0;
    private reverseFrameIndex = 0;
    private lastUploadedReverseIndex = -1;
    private lastReverseFrameAt = 0;
    private lastCachedVideoTime = -1;

    /**
     * 普通播放最多处理约 720p 像素量。
     * UI 仍按 VideoFitHelper 的 cover 尺寸显示，视觉尺寸不变。
     */
    private readonly normalMaxPixels = 1280 * 720;

    /**
     * 正反播需要缓存原始 RGBA，必须更保守。
     * 640x360 一帧约 0.88 MiB。
     */
    private readonly pingPongMaxPixels = 640 * 360;

    /** 正反播最多缓存约 96 MiB RGBA。 */
    private readonly maxReverseCacheBytes = 96 * 1024 * 1024;

    /** 正反播最多 15fps 缓存；长视频会自动进一步降采样以满足内存上限。 */
    private readonly maxReverseCacheFps = 15;

    private maxCachedFrames = 0;
    private reverseCacheInterval = 1 / this.maxReverseCacheFps;
    private cachedFrames: Uint8Array[] = [];

    protected onDestroy() {
        this.stop();
    }

    // ---- Public API ----
    public play(url: string, args: IVideoPlayArgs) {
        this.stop();

        const video = document.createElement("video");
        this.video = video;

        video.src = url;
        video.crossOrigin = "anonymous";
        video.playsInline = true;
        video.preload = "auto";
        video.muted = args.muted ?? false;

        this.playMode = args.playMode ?? "normal";
        this.shouldLoop = args.loop;
        video.loop = this.playMode === "forward-reverse" ? false : args.loop;

        this.resetPlaybackState();
        this.setupFullScreen(video);

        this.canvas = document.createElement("canvas");
        // 不要 willReadFrequently：这个 canvas 的主要用途是 drawImage -> GPU upload。
        this.ctx = this.canvas.getContext("2d", { alpha: false });

        video.onloadedmetadata = () => {
            if (!this.video || this.video !== video || !this.canvas) return;

            const displaySize = VideoFitHelper.getSize(video.videoWidth, video.videoHeight);
            if (!displaySize) return;

            this.displayWidth = displaySize.width;
            this.displayHeight = displaySize.height;
            this.applyDisplaySize(this.displayWidth, this.displayHeight);

            // forward-reverse 需要缓存 RGBA，直接把工作分辨率控制在更安全的范围。
            const maxPixels = this.playMode === "forward-reverse"
                ? this.pingPongMaxPixels
                : this.normalMaxPixels;

            const renderSize = this.getCappedSize(video.videoWidth, video.videoHeight, maxPixels);
            this.renderWidth = renderSize.width;
            this.renderHeight = renderSize.height;
            this.canvas.width = this.renderWidth;
            this.canvas.height = this.renderHeight;

            if (this.playMode === "forward-reverse") {
                this.setupReverseCache(video.videoWidth, video.videoHeight, video.duration);
            }
        };

        video.onended = () => {
            if (!this.running || this.video !== video) return;

            if (this.playMode === "forward-reverse") {
                this.beginReverse();
                return;
            }

            // 非 loop 播放才会自然触发 ended；loop=true 时通常不会触发。
            this.loopCount++;
            this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
            this.running = false;
            this.cancelFrameSchedulers();
        };

        video.onerror = (e) => {
            console.error("Video error:", e);
        };

        video.play().then(() => {
            if (this.video !== video) return;
            this.running = true;
            this.paused = false;
            this.scheduleForwardFrame();
            this.listeners.forEach((listener) => listener.onVideoPlay?.());
        }).catch((err) => {
            console.error("Video play blocked:", err);
        });
    }

    /** 获取 video DOM。 */
    getVideoElement() {
        return this.video;
    }

    private setupFullScreen(video: HTMLVideoElement) {
        // 当前实现仍保留这些属性，方便外部需要拿到 video DOM 时复用。
        // 实际画面显示仍由 Cocos Sprite 完成。
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.background = "black";
        video.style.pointerEvents = "none";
    }

    public pause() {
        if (!this.running || this.paused) return;

        this.paused = true;
        this.pingPongPausedAt = performance.now();
        this.video?.pause();
        this.cancelFrameSchedulers();
        this.listeners.forEach((listener) => listener.onVideoPause?.());
    }

    public resume() {
        if (!this.running || !this.paused) return;

        this.paused = false;
        this.pauseTime = 0;

        if (this.playMode === "forward-reverse" && this.pingPongDirection < 0) {
            this.lastReverseFrameAt += performance.now() - this.pingPongPausedAt;
            this.startReverseLoop();
        } else {
            this.video?.play().then(() => {
                this.scheduleForwardFrame();
            }).catch((err) => console.error("Video resume blocked:", err));
        }

        this.listeners.forEach((listener) => listener.onVideoResume?.());
    }

    public stop() {
        const hadVideo = !!this.video;

        this.running = false;
        this.paused = false;
        this.cancelFrameSchedulers();
        this.resetPlaybackState();

        if (this.video) {
            this.video.pause();
            this.video.onloadedmetadata = null;
            this.video.onended = null;
            this.video.onerror = null;
            this.video.removeAttribute("src");
            try {
                this.video.load();
            } catch (_) { }
            this.video = null;
        }

        this.canvas = null;
        this.ctx = null;
        this.cacheCanvas = null;
        this.cacheCtx = null;

        if (this.render_sprite && this.render_sprite.spriteFrame === this.spriteFrame) {
            this.render_sprite.spriteFrame = null!;
        }

        this.spriteFrame?.destroy();
        this.tex?.destroy();
        this.spriteFrame = null;
        this.tex = null;

        if (hadVideo) {
            this.listeners.forEach((listener) => listener.onVideoStop?.());
        }
    }

    // ---- Forward rendering ----

    /**
     * 优先 requestVideoFrameCallback：浏览器真正产出一帧视频时才执行。
     * 老浏览器 fallback 到 RAF，并使用 currentTime 去重。
     */
    private scheduleForwardFrame() {
        if (!this.running || this.paused || !this.video) return;
        if (this.playMode === "forward-reverse" && this.pingPongDirection < 0) return;

        const videoAny = this.video as any;
        if (typeof videoAny.requestVideoFrameCallback === "function") {
            if (this.videoFrameCallbackId != null) return;

            this.videoFrameCallbackId = videoAny.requestVideoFrameCallback(() => {
                this.videoFrameCallbackId = null;
                if (!this.running || this.paused || !this.video) return;
                if (this.playMode === "forward-reverse" && this.pingPongDirection < 0) return;

                this.renderForwardFrame();
                this.scheduleForwardFrame();
            });
            return;
        }

        if (this.rafId != null) return;

        const tick = () => {
            this.rafId = null;
            if (!this.running || this.paused || !this.video) return;
            if (this.playMode === "forward-reverse" && this.pingPongDirection < 0) return;

            this.renderForwardFrame();
            this.rafId = requestAnimationFrame(tick);
        };

        this.rafId = requestAnimationFrame(tick);
    }

    private renderForwardFrame() {
        if (!this.video || !this.ctx || !this.canvas) return;
        if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        if (this.renderWidth <= 0 || this.renderHeight <= 0) return;

        const current = this.video.currentTime;

        if (this.pauseTime > 0 && this.pauseTime <= current * 1000) {
            this.pause();
            return;
        }

        // fallback RAF 下，一个视频帧可能跨多个屏幕刷新周期；不要重复上传。
        if (Math.abs(current - this.lastRenderedVideoTime) < 0.0001) return;

        // video.loop=true 时 ended 通常不触发，用时间回跳检测一次循环。
        if (this.playMode !== "forward-reverse"
            && this.previousTime > 0
            && current + 0.001 < this.previousTime) {
            this.loopCount++;
            this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
        }

        this.ctx.drawImage(this.video, 0, 0, this.renderWidth, this.renderHeight);

        // 关键：Cocos 3.8 Texture2D.uploadData 支持 HTMLCanvasElement，
        // 直接上传 canvas，避免 getImageData() 把像素从 GPU/Canvas 读回 JS heap。
        this.uploadSource(this.canvas, this.renderWidth, this.renderHeight);

        if (this.playMode === "forward-reverse") {
            this.cachePingPongFrame(current);
        }

        this.previousTime = current;
        this.lastRenderedVideoTime = current;
        this.listeners.forEach((listener) => listener.onVideoPlaying?.(current));
    }

    // ---- Texture ----

    private uploadSource(source: HTMLCanvasElement | Uint8Array, w: number, h: number) {
        if (!this.tex || this.tex.width !== w || this.tex.height !== h) {
            this.tex?.destroy();
            this.spriteFrame?.destroy();

            this.tex = new Texture2D();
            this.tex.reset({
                width: w,
                height: h,
                format: Texture2D.PixelFormat.RGBA8888,
            });

            this.spriteFrame = new SpriteFrame();
            this.spriteFrame.texture = this.tex;
            this.spriteFrame.rect = new Rect(0, 0, w, h);
            this.spriteFrame.originalSize = new Size(w, h);
            this.spriteFrame.offset = new Vec2(0, 0);

            if (this.render_sprite && this.render_sprite.isValid) {
                this.render_sprite.spriteFrame = this.spriteFrame;
            }
        }

        this.tex.uploadData(source as any);
    }

    private applyDisplaySize(width: number, height: number) {
        if (!this.render_sprite) return;

        this.render_sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const uiTransform = this.render_sprite.node.getComponent(UITransform);
        if (!uiTransform) return;

        uiTransform.width = width;
        uiTransform.height = height;
    }

    /** 按最大像素量等比缩放，不放大源视频。 */
    private getCappedSize(videoW: number, videoH: number, maxPixels: number) {
        const sourcePixels = videoW * videoH;
        if (sourcePixels <= maxPixels) {
            return { width: videoW, height: videoH };
        }

        const scale = Math.sqrt(maxPixels / sourcePixels);
        // YUV/视频尺寸通常取偶数更稳定。
        const width = Math.max(2, Math.floor(videoW * scale / 2) * 2);
        const height = Math.max(2, Math.floor(videoH * scale / 2) * 2);
        return { width, height };
    }

    // ---- Ping-pong / reverse cache ----

    private setupReverseCache(videoW: number, videoH: number, duration: number) {
        const cacheSize = this.getCappedSize(videoW, videoH, this.pingPongMaxPixels);
        this.cacheWidth = cacheSize.width;
        this.cacheHeight = cacheSize.height;

        this.cacheCanvas = document.createElement("canvas");
        this.cacheCanvas.width = this.cacheWidth;
        this.cacheCanvas.height = this.cacheHeight;
        this.cacheCtx = this.cacheCanvas.getContext("2d", {
            alpha: false,
            willReadFrequently: true,
        });

        const bytesPerFrame = this.cacheWidth * this.cacheHeight * 4;
        const byMemory = Math.max(2, Math.floor(this.maxReverseCacheBytes / bytesPerFrame));

        // 再加一个硬上限，避免极低分辨率视频产生过多 JS 对象。
        this.maxCachedFrames = Math.min(180, byMemory);

        const minInterval = 1 / this.maxReverseCacheFps;
        if (Number.isFinite(duration) && duration > 0) {
            // 让采样尽量覆盖完整视频，而不是前几秒塞满后停止。
            this.reverseCacheInterval = Math.max(minInterval, duration / this.maxCachedFrames);
        } else {
            this.reverseCacheInterval = minInterval;
        }
    }

    private cachePingPongFrame(currentTime: number) {
        if (this.playMode !== "forward-reverse" || this.pingPongDirection < 0) return;
        if (!this.video || !this.cacheCtx || !this.cacheCanvas) return;
        if (this.maxCachedFrames <= 0 || this.cachedFrames.length >= this.maxCachedFrames) return;

        if (this.lastCachedVideoTime >= 0
            && currentTime - this.lastCachedVideoTime < this.reverseCacheInterval) {
            return;
        }

        this.cacheCtx.drawImage(this.video, 0, 0, this.cacheWidth, this.cacheHeight);
        const imageData = this.cacheCtx.getImageData(0, 0, this.cacheWidth, this.cacheHeight);

        // getImageData 已经新建了一块 buffer，这里只建立 Uint8Array view，不再额外 clone 一份。
        this.cachedFrames.push(new Uint8Array(
            imageData.data.buffer,
            imageData.data.byteOffset,
            imageData.data.byteLength,
        ));
        this.lastCachedVideoTime = currentTime;
    }

    private beginReverse() {
        if (!this.video || this.playMode !== "forward-reverse") return;
        if (this.pingPongDirection < 0) return;

        this.cancelFrameSchedulers();
        this.video.pause();

        this.pingPongDirection = -1;
        this.reverseFrameIndex = Math.max(0, this.cachedFrames.length - 1);
        this.lastUploadedReverseIndex = -1;
        this.lastReverseFrameAt = performance.now();

        this.loopCount++;
        this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));

        if (this.cachedFrames.length <= 0) {
            this.restartForward();
            return;
        }

        this.startReverseLoop();
    }

    private startReverseLoop() {
        if (this.rafId != null) return;

        const tick = () => {
            this.rafId = null;
            if (!this.running || this.paused) return;
            if (this.playMode !== "forward-reverse" || this.pingPongDirection >= 0) return;

            this.renderReverseFrame();

            if (this.running && !this.paused && this.pingPongDirection < 0) {
                this.rafId = requestAnimationFrame(tick);
            }
        };

        this.rafId = requestAnimationFrame(tick);
    }

    private renderReverseFrame() {
        if (this.cachedFrames.length <= 0) {
            this.restartForward();
            return;
        }

        const duration = this.video?.duration ?? 0;
        const frameDuration = Number.isFinite(duration) && duration > 0
            ? Math.max(1 / 60, duration / this.cachedFrames.length)
            : this.reverseCacheInterval;

        const now = performance.now();
        const step = Math.floor((now - this.lastReverseFrameAt) * 0.001 / frameDuration);
        if (step <= 0) return;

        this.reverseFrameIndex = Math.max(0, this.reverseFrameIndex - step);
        this.lastReverseFrameAt += step * frameDuration * 1000;

        if (this.reverseFrameIndex !== this.lastUploadedReverseIndex) {
            const frame = this.cachedFrames[this.reverseFrameIndex];
            if (frame) {
                this.uploadSource(frame, this.cacheWidth, this.cacheHeight);
                this.lastUploadedReverseIndex = this.reverseFrameIndex;

                const reverseTime = frameDuration * this.reverseFrameIndex;
                this.listeners.forEach((listener) => listener.onVideoPlaying?.(reverseTime));
            }
        }

        if (this.reverseFrameIndex > 0) return;

        this.loopCount++;
        this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));

        if (!this.shouldLoop) {
            this.running = false;
            this.cancelFrameSchedulers();
            return;
        }

        this.restartForward();
    }

    private restartForward() {
        if (!this.video) return;

        this.cancelFrameSchedulers();
        this.pingPongDirection = 1;
        this.previousTime = 0;
        this.lastRenderedVideoTime = -1;
        this.lastUploadedReverseIndex = -1;

        this.video.currentTime = 0;
        this.video.play().then(() => {
            this.scheduleForwardFrame();
        }).catch((err) => console.error("Video replay blocked:", err));
    }

    // ---- State / scheduler ----

    private resetPlaybackState() {
        this.previousTime = 0;
        this.loopCount = 0;
        this.lastRenderedVideoTime = -1;

        this.pingPongDirection = 1;
        this.pingPongPausedAt = 0;
        this.reverseFrameIndex = 0;
        this.lastUploadedReverseIndex = -1;
        this.lastReverseFrameAt = 0;
        this.lastCachedVideoTime = -1;

        this.displayWidth = 0;
        this.displayHeight = 0;
        this.renderWidth = 0;
        this.renderHeight = 0;
        this.cacheWidth = 0;
        this.cacheHeight = 0;
        this.maxCachedFrames = 0;
        this.reverseCacheInterval = 1 / this.maxReverseCacheFps;
        this.cachedFrames.length = 0;
    }

    private cancelFrameSchedulers() {
        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.video && this.videoFrameCallbackId != null) {
            const videoAny = this.video as any;
            if (typeof videoAny.cancelVideoFrameCallback === "function") {
                try {
                    videoAny.cancelVideoFrameCallback(this.videoFrameCallbackId);
                } catch (_) { }
            }
        }
        this.videoFrameCallbackId = null;
    }
}