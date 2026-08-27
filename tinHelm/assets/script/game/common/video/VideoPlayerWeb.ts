// VideoPlayerWeb.ts — 简洁稳定版
// Cocos Creator 3.8.6

import {
    Texture2D,
    SpriteFrame,
    Rect,
    Size,
    Vec2,
} from "cc";
import { VideoFitHelper } from "./VideoFitHelper";
import { IVideoPlayArgs, VideoBase } from "./VideoBase";

export default class VideoPlayerWeb extends VideoBase {
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    private tex: Texture2D | null = null;
    private spriteFrame: SpriteFrame | null = null;

    private running = false;
    private paused = false;

    private rafId: number | null = null;
    private fullScreenWidth = 0;
    private fullScreenHeight = 0;

    private previousTime = 0;
    private totalTime = 0
    private loopCount = 0
    private playMode: IVideoPlayArgs["playMode"] = "normal";
    private shouldLoop = false;
    private pingPongDirection = 1;
    private pingPongPausedAt = 0;
    private reverseFrameIndex = 0;
    private lastReverseFrameAt = 0;
    private lastCachedVideoTime = -1;
    private readonly maxCachedFrames = 180;
    private cachedFrames: Uint8Array[] = [];

    protected onDestroy() {
        this.stop()
    }
    // ---- Public API ----
    public play(url: string, args: IVideoPlayArgs) {
        this.stop(); // clean old

        this.video = document.createElement("video");
        this.video.src = url;
        this.video.crossOrigin = "anonymous";
        this.video.playsInline = true;
        this.video.muted = args.muted != null ? args.muted : false; // 防止浏览器拦截 autoplay
        this.playMode = args.playMode ?? "normal";
        this.shouldLoop = args.loop;
        this.cachedFrames.length = 0;
        this.lastCachedVideoTime = -1;
        this.video.loop = this.playMode === "forward-reverse" ? false : args.loop;
        this.setupFullScreen(this.video)

        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

        this.video.onloadedmetadata = () => {
            const size = VideoFitHelper.getSize(this.video!.videoWidth, this.video!.videoHeight)
            if (!size || !this.canvas) return;
            this.fullScreenWidth = size.width
            this.fullScreenHeight = size.height

            this.canvas.width = this.fullScreenWidth;
            this.canvas.height = this.fullScreenHeight;
        };

        this.video.onended = () => {
            if (this.playMode === "forward-reverse") return;
            this.loopCount++;
            this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
            this.running = false;
        };

        this.video.onerror = (e) => {
            console.error("Video error:", e);
        };

        this.video.play().then(() => {
            this.running = true;
            this.paused = false;
            if (this.playMode === "forward-reverse") {
                this.startPingPong();
            }
            this.loopUpdate();
            this.listeners.forEach((listener) => listener.onVideoPlay?.());
        }).catch(err => {
            console.error("Video play blocked:", err);
        });
    }
    /**
    * 获取 video DOM
    */
    getVideoElement() {
        return this.video;
    }
    private setupFullScreen(video: HTMLVideoElement) {
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        // video.style.objectFit = "contain";  // contain=黑边   cover=裁剪填满
        video.style.objectFit = "cover";  // contain=黑边   cover=裁剪填满
        video.style.background = "black";
        video.style.pointerEvents = "none"; // 禁止点到 video
    }

    public pause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        this.pingPongPausedAt = performance.now();
        this.video?.pause();
        this.listeners.forEach((listener) => listener.onVideoPause?.());
    }

    public resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        this.pauseTime = 0
        if (this.playMode === "forward-reverse") {
            if (this.pingPongDirection > 0) {
                this.video?.play().catch((err) => console.error("Video resume blocked:", err));
            } else {
                this.lastReverseFrameAt += performance.now() - this.pingPongPausedAt;
            }
            if (this.rafId == null) this.loopUpdate();
        } else {
            this.video?.play().catch((err) => console.error("Video resume blocked:", err));
            if (this.rafId == null) this.loopUpdate();
        }
        this.listeners.forEach((listener) => listener.onVideoResume?.());
    }

    public stop() {
        this.running = false;
        this.paused = false;
        this.loopCount = 0
        this.previousTime = 0;
        this.totalTime = 0
        this.pingPongDirection = 1;
        this.pingPongPausedAt = 0;
        this.reverseFrameIndex = 0;
        this.lastReverseFrameAt = 0;
        this.lastCachedVideoTime = -1;
        this.cachedFrames.length = 0;

        if (this.rafId != null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        if (this.video) {
            this.video.pause();
            this.video.src = "";
            this.video = null;
            this.listeners.forEach((listener) => listener.onVideoStop?.());
        }

        this.canvas = null;
        this.ctx = null;

        if (this.render_sprite && this.render_sprite.spriteFrame === this.spriteFrame) {
            this.render_sprite.spriteFrame = null!;
        }

        this.spriteFrame?.destroy();
        this.tex?.destroy();
        this.spriteFrame = null;
        this.tex = null;
    }

    // ---- RAF Loop ----
    private loopUpdate() {
        if (!this.running || this.paused) return;
        if (!this.video || !this.ctx) return;
        if (this.rafId != null) return;

        const draw = () => {
            if (!this.running || this.paused) {
                this.rafId = null;
                return;
            }

            if (!this.video || !this.ctx) return;
            this.updatePingPongFrame();
            const current = this.video.currentTime;
            if (this.pauseTime > 0 && this.pauseTime <= current) {
                this.pause()
                return
            }
            if (current < this.previousTime) {
                this.previousTime = 0
            }
            this.listeners.forEach((listener) => listener.onVideoPlaying?.(current));

            const w = this.fullScreenWidth;
            const h = this.fullScreenHeight;
            if (w > 0 && h > 0 && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                if (this.playMode === "forward-reverse" && this.pingPongDirection < 0) {
                    const frame = this.cachedFrames[this.reverseFrameIndex];
                    if (frame) {
                        this.uploadFrame(frame, w, h);
                    }
                } else {
                    // draw to canvas
                    this.ctx.drawImage(this.video, 0, 0, w, h);

                    // read back pixels
                    const img = this.ctx.getImageData(0, 0, w, h);
                    const rgba = new Uint8Array(img.data.buffer);

                    this.uploadFrame(rgba, w, h);
                    this.cachePingPongFrame(rgba, current);
                }
            }

            if (this.playMode !== "forward-reverse") {
                let delta = current - this.previousTime;
                this.totalTime += delta
                // 检测是否完成一次循环（从末尾跳回开头）
                if (this.totalTime >= this.video.duration) {
                    this.loopCount++
                    this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
                    this.totalTime = 0
                }
            }
            this.previousTime = current;

            this.rafId = requestAnimationFrame(draw);
        };

        this.rafId = requestAnimationFrame(draw);
    }

    // ---- Texture Upload ----
    private uploadFrame(rgba: Uint8Array, w: number, h: number) {
        // ensure texture
        // console.log("sprite",w, h)
        if (!this.tex || this.tex.width !== w || this.tex.height !== h) {
            this.tex?.destroy();
            this.spriteFrame?.destroy();

            this.tex = new Texture2D();
            (this.tex as any).reset({ width: w, height: h });

            this.spriteFrame = new SpriteFrame();
            this.spriteFrame.texture = this.tex;
            this.spriteFrame.rect = new Rect(0, 0, w, h);
            this.spriteFrame.originalSize = new Size(w, h);
            this.spriteFrame.offset = new Vec2(0, 0);

            if (this.render_sprite && this.render_sprite.isValid) {
                this.render_sprite.spriteFrame = this.spriteFrame;
            }
        }

        // upload RGBA
        (this.tex as any).uploadData(rgba);
    }

    private startPingPong() {
        if (!this.video || !Number.isFinite(this.video.duration) || this.video.duration <= 0) {
            this.running = false;
            return;
        }
        this.pingPongDirection = 1;
        this.pingPongPausedAt = 0;
        this.reverseFrameIndex = 0;
        this.lastReverseFrameAt = 0;
        this.lastCachedVideoTime = -1;
    }

    private updatePingPongFrame() {
        if (this.playMode !== "forward-reverse" || !this.video) return;
        const duration = this.video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        if (this.pingPongDirection > 0) {
            if (!this.video.ended && this.video.currentTime < duration - 0.016) return;
            this.video.pause();
            this.pingPongDirection = -1;
            this.reverseFrameIndex = Math.max(0, this.cachedFrames.length - 1);
            this.lastReverseFrameAt = performance.now();
            this.loopCount++;
            this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
            return;
        }

        if (this.cachedFrames.length <= 0) {
            this.restartForward();
            return;
        }

        const frameDuration = Math.max(1 / 60, duration / this.cachedFrames.length);
        const now = performance.now();
        const step = Math.floor((now - this.lastReverseFrameAt) * 0.001 / frameDuration);
        if (step <= 0) return;

        this.reverseFrameIndex -= step;
        this.lastReverseFrameAt += step * frameDuration * 1000;
        if (this.reverseFrameIndex > 0) return;

        this.reverseFrameIndex = 0;
        this.loopCount++;
        this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
        if (!this.shouldLoop) {
            this.running = false;
            return;
        }
        this.restartForward();
    }

    private cachePingPongFrame(rgba: Uint8Array, currentTime: number) {
        if (this.playMode !== "forward-reverse" || this.pingPongDirection < 0) return;
        if (this.cachedFrames.length >= this.maxCachedFrames) return;
        if (this.lastCachedVideoTime >= 0 && currentTime - this.lastCachedVideoTime < 1 / 30) return;
        this.cachedFrames.push(new Uint8Array(rgba));
        this.lastCachedVideoTime = currentTime;
    }

    private restartForward() {
        if (!this.video) return;
        this.pingPongDirection = 1;
        this.previousTime = 0;
        this.totalTime = 0;
        this.video.currentTime = 0;
        this.video.play().catch((err) => console.error("Video replay blocked:", err));
    }
}
