// VideoPlayerWeb.ts — 简洁稳定版
// Cocos Creator 3.8.6

import {
    _decorator,
    Component,
    Sprite,
    Texture2D,
    SpriteFrame,
    Rect,
    Size,
    Vec2,
} from "cc";
import { VideoFitHelper } from "./VideoFitHelper";
import { IVideoPlayArgs, VideoBase } from "./VideoBase";
const { ccclass, property } = _decorator;

@ccclass("VideoPlayerWeb")
export default class VideoPlayerWeb extends VideoBase {
    private video: HTMLVideoElement | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    private tex: Texture2D | null = null;
    private spriteFrame: SpriteFrame | null = null;

    private running = false;
    private paused = false;

    private rafId: number | null = null;
    private fullScreenWidth: number
    private fullScreenHeight: number

    private previousTime = 0;
    private totalTime = 0
    private loopCount = 0

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
        this.video.loop = args.loop;
        this.setupFullScreen(this.video)

        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

        this.video.onloadedmetadata = () => {
            let size = VideoFitHelper.getSize(this.video!.videoWidth, this.video!.videoHeight)
            this.fullScreenWidth = size.width
            this.fullScreenHeight = size.height

            this.canvas!.width = this.fullScreenWidth;
            this.canvas!.height = this.fullScreenHeight;
        };

        this.video.onended = () => {
            this.running = false;
        };

        this.video.onerror = (e) => {
            console.error("Video error:", e);
        };

        this.video.play().then(() => {
            this.running = true;
            this.paused = false;
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
        this.video?.pause();
        this.listeners.forEach((listener) => listener.onVideoPause?.());
    }

    public resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        this.pauseTime = 0
        this.video?.play();
        this.loopUpdate();
        this.listeners.forEach((listener) => listener.onVideoResume?.());
    }

    public stop() {
        this.running = false;
        this.paused = false;
        this.loopCount = 0
        this.previousTime = 0;
        this.totalTime = 0

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

        const draw = () => {
            if (!this.running || this.paused) return;

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
            if (w > 0 && h > 0) {
                // draw to canvas
                this.ctx!.drawImage(this.video!, 0, 0, w, h);

                // read back pixels
                const img = this.ctx!.getImageData(0, 0, w, h);
                const rgba = new Uint8Array(img.data.buffer);

                this.uploadFrame(rgba, w, h);
            }

            let delta = current - this.previousTime;
            this.totalTime += delta
            // 检测是否完成一次循环（从末尾跳回开头）
            if (this.totalTime >= this.video.duration) {
                this.loopCount++
                this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
                this.totalTime = 0
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
}
