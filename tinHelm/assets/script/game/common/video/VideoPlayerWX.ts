// VideoPlayerWX.ts
import { _decorator, Sprite, Texture2D, SpriteFrame, Rect, Size, Vec2, UITransform } from "cc";
import { IVideoPlayArgs, VideoBase } from "./VideoBase";
import { VideoFitHelper } from "./VideoFitHelper";
const { ccclass, property } = _decorator;

/**  能全屏播放  可用
 * VideoPlayerWX
 * - 自动检测 RGBA / NV12 / NV21
 * - 高效 YUV(NV12/NV21) -> RGBA（复用缓冲、最小化拷贝）
 * - 使用 Uint8Array 上传（避免 TS 类型报错）
 * - 自动重建 Texture2D, SpriteFrame
 * - Sprite.sizeMode = Custom 确保渲染
 * - 简单帧率节流（避免 upload 过频）
 *
 * 说明：
 * - 若目标机型能直接输出 RGBA，则速度最快（无需转换）
 * - 若机型输出 NV12/NV21，会转换到 RGBA 并 upload
 * - 若需更高性能（720p 稳定 <1ms），考虑 WASM 实现或服务端预处理
 */

@ccclass("VideoPlayerWX")
export class VideoPlayerWX extends VideoBase {
    // if true, try to auto-loop on 'ended'
    public loop = false;

    // If you already know the device outputs NV21, set to 'VU' to skip detection
    // values: 'AUTO' | 'NV12' | 'NV21'
    public forceYuvFormat: "AUTO" | "NV12" | "NV21" = "AUTO";

    private decoder: WechatMiniprogram.VideoDecoder = null;
    private audio: WechatMiniprogram.MediaAudioPlayer = null;
    private tex: Texture2D | null = null;
    private spriteFrame: SpriteFrame | null = null;
    private videoW = 0;
    private videoH = 0;

    // reusable RGBA buffer
    private rgbaBuf: Uint8Array | null = null;
    private rgbaBuf32: Uint32Array | null = null; // 新增：复用的Uint32视图

    // detection & state
    private detectedFormat: "RGBA" | "NV12" | "NV21" | null = null;
    private minFrameInterval = 0;

    // polling fallback
    private pollTimer: number | null = null;

    private running = false;
    private paused = false;
    private loopCount = 0
    private duration = 0; // 视频总长（毫秒）

    private renderFrames: Array<WechatMiniprogram.FrameDataOptions> = []

    private playbackRate = 1.0;      // 播放速率（0.5, 1.0, 2.0等）
    private baseTimestamp = 0;        // 基准系统时间戳（毫秒）
    private basePts = 0;              // 基准PTS（毫秒）
    private currentPts = 0;           // 当前播放位置（毫秒）

    constructor() {
        super()
        this.initDocoder()
    }

    // 获取当前播放时间（核心方法）
    getCurrentPlaybackTime() {
        if (this.paused) {
            // 暂停时：直接返回暂停时的PTS，不随时间变化
            return this.currentPts;
        } else {
            // 播放时：基于上次记录的时间和经过的时间动态计算
            const now = Date.now();  // 当前系统时间
            const elapsed = (now - this.baseTimestamp) * this.playbackRate;
            return this.basePts + elapsed;
        }
    }

    // 设置播放速率,暂时无用
    private setPlaybackRate(rate: number) {
        if (!this.paused) {
            // 播放中修改速率：先更新时间，再重新设置基准
            this.currentPts = this.getCurrentPlaybackTime();
            this.baseTimestamp = Date.now();
            this.basePts = this.currentPts;
        }
        this.playbackRate = rate;
    }
    protected onDestroy() {
        this.stop();
        if (this.audio) {
            this.audio.destroy()
            this.audio = null
        }
        if (this.decoder) {
            this.decoder.remove()
            this.decoder = null
        }
        this.destroyTexture();
        this.stopPolling();
    }

    initDocoder() {
        const wx = (window as any).wx;
        if (!wx || !wx.createVideoDecoder) {
            console.error("VideoTexturePlayerOptimized: not running in WeChat Mini Game or createVideoDecoder not available.");
            return;
        }
        console.log("wx,sdk v", wx.getSystemInfoSync().SDKVersion);

        try {
            this.decoder = wx.createVideoDecoder ? wx.createVideoDecoder() : null;
            if (!this.decoder) {
                console.error("VideoTexturePlayerOptimized: createVideoDecoder returned null.");
                return;
            }
            // prefer frame event
            if (this.decoder.on) {
                // // some devices emit bufferchange / or require getFrameData
                // this.decoder.on("bufferchange", (res) => {
                //     // treat same as frame event (processFrame has internal checks)
                //     console.log("decoder bufferchange", res);
                //     //this.processFrame(res);
                // });
                this.decoder.on("start", (res) => {
                    // reset detection when starting
                    console.log("decoder start", res);
                    this.minFrameInterval = 1000 / Math.max(1, res.fps); //计算帧率
                    this.duration = res.duration; //记录视频时长
                    this.detectedFormat = null;
                });
                // this.decoder.on("ended", (res) => {

                // });
                this.decoder.on("seek", res => {
                    console.warn("跳转进度", res);
                    if (res.position == 0) { //重置时候，刷新计数
                        this.stopPolling();
                        this.startPolling();
                    }
                });
                this.decoder.on("stop", (res) => {
                    console.log("decoder stop", res);
                });
                // this.decoder.on("error", (err: any) => {
                //     console.error("VideoPlayerWX: decoder internal error", err);
                // });
            }
        } catch (e) {
            console.error("VideoTexturePlayerOptimized: createVideoDecoder failed", e);
            this.decoder = null;
        }
    }

    // ---------------------- public API ----------------------
    private currentUrl = "";

    public play(url: string, args: IVideoPlayArgs) {
        if (!this.decoder) return;
        this.loop = args.loop;
        this.currentUrl = url;
        this.detectedFormat = null;
        this.ensureResetBuffers();
        if (!args.muted && !this.audio) {
            this.audio = wx.createMediaAudioPlayer();
        }
        console.log("url", url)
        this.stop()
        this.decoder.start({
            source: this.currentUrl,
            abortVideo: false,
            mode: 1,
            abortAudio: args.muted,
        }).then(() => {
            if (args.muted) { //静音
                this._play();
            } else {
                this.audio.start().then(() => {
                    this.audio.addAudioSource(this.decoder).then(() => {
                        this._play();
                    })
                })
            }
            this.listeners.forEach((listener) => listener.onVideoPlay?.());
        })
    }

    public pause() {
        if (!this.decoder) return;
        if (!this.running || this.paused) return;
        if (this.audio) {
            this.audio.removeAudioSource(this.decoder);
            this.audio.stop().then(() => {
                this._pause();
            })
        } else {
            this._pause()
        }
        this.listeners.forEach((listener) => listener.onVideoPause?.());
    }

    public resume() {
        if (!this.decoder) return;
        if (!this.running || !this.paused) return;
        if (this.audio) {
            this.audio.start().then(() => {
                this.audio.addAudioSource(this.decoder);
                this._resume();
            });
        } else {
            this._resume();
        }
        this.listeners.forEach((listener) => listener.onVideoResume?.());
    }

    public stop() {
        if (!this.decoder) return;
        if (!this.running) return;
        this.running = false;
        this.paused = false;
        this.loopCount = 0;
        this.renderFrames.length = 0;
        try {
            this.decoder != null && this.decoder.stop();
            this.audio != null && this.audio.stop()
        } catch (e) { }
        this.stopPolling();
        this.listeners.forEach((listener) => listener.onVideoStop?.());
    }

    private _play() {
        this.renderFrames.length = 0;
        this.stopPolling();
        this.startPolling(); // fallback for devices that need getFrameData
    }

    private _pause() {
        this.currentPts = this.getCurrentPlaybackTime();
        this.paused = true;
    }

    private _resume() {
        this.pauseTime = 0
        this.paused = false;
        this.baseTimestamp = Date.now();
        this.basePts = this.currentPts;
        this.loopUpdate();
    }

    private performSeekToStart() {
        if (this.loop && this.decoder) {
            try {
                if (typeof this.decoder.seek === 'function') {
                    this.decoder.seek(0);// 使用seek替代重启解码器，更加稳定
                } else {
                    this.decoder.stop();
                    setTimeout(() => {
                        try {
                            this.decoder.start({ source: this.currentUrl, mode: 1 });
                        } catch (e) {
                            console.error("VideoPlayerWX: loop restart failed", e);
                        }
                    }, 5);
                }
            } catch (e) {
                console.error("VideoPlayerWX: loop seek failed", e);
            }
        } else {
            this.stop()
        }
    }

    // -------------------- polling fallback --------------------

    private loopUpdate() {
        try {
            if (!this.decoder) return;
            if (this.paused) return; //暂停   
            const currentPlaybackTime = this.getCurrentPlaybackTime();
            //按时间暂停功能
            if (this.pauseTime > 0 && this.pauseTime <= currentPlaybackTime) {
                this.pause()
                return
            }

            // 预先填充队列，多读取几帧，保证有足够多的帧可以排序
            // 保持队列最大缓冲，避免内存占用过大
            const maxBufferFrames = 10;
            let hasBFrame = false;
            while (this.renderFrames.length < maxBufferFrames) {
                const f = this.decoder.getFrameData();
                if (f && f.data) {
                    this.renderFrames.push(f);
                    if (!hasBFrame && f.pkDts != f.pkPts) {
                        hasBFrame = true;
                    }
                } else {
                    break; // 没有更多帧了
                }
            }
            if (hasBFrame) {
                this.renderFrames.sort((a, b) => a.pkPts - b.pkPts);
            }

            // 检查是否有"准备好显示"的帧
            //    （当前时间 >= 最小PTS）
            if (this.renderFrames.length > 0 && this.renderFrames[0].pkPts <= currentPlaybackTime) {
                const frame = this.renderFrames.shift();
                this.processFrame(frame);
            } else if (this.renderFrames.length === 0 && currentPlaybackTime >= this.duration) {
                // 只有当所有帧都处理完，且接近视频末尾时，才执行循环跳转
                this.loopCount++;
                this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
                this.performSeekToStart();
            }
        } catch (e) {
            // ignore
        }
    }
    private startPolling() {
        if (this.pollTimer != null) return;
        this.running = true;
        this.baseTimestamp = Date.now();
        this.currentPts = 0;
        this.basePts = this.currentPts;
        this.pollTimer = window.setInterval(() => {
            this.loopUpdate();
        }, 16.6666); //按照60fps更新
        this.loopUpdate();
    }

    private stopPolling() {
        if (this.pollTimer != null) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.currentPts = 0;
        this.basePts = this.currentPts;
        this.running = false;
    }

    // -------------------- frame processing --------------------
    private processFrame(frame: WechatMiniprogram.FrameDataOptions) {
        if (!frame || !frame.data) return;

        // normalize data to Uint8Array
        const data = frame.data instanceof Uint8Array ? frame.data : new Uint8Array(frame.data);
        const w = frame.width;
        const h = frame.height;
        if (!w || !h) return;

        // On first frame (or if size changed), rebuild texture and buffers
        if (w !== this.videoW || h !== this.videoH) {
            this.rebuildForSize(w, h);
            // reset detected format so next branch will detect
            this.detectedFormat = null;
            console.log("rebuildForSize", w, h);
        }

        // detect format if unknown
        if (!this.detectedFormat) {
            this.detectedFormat = this.detectFormat(data, w, h);
            // if forced by config, obey that
            if (this.forceYuvFormat === "NV12") this.detectedFormat = "NV12";
            else if (this.forceYuvFormat === "NV21") this.detectedFormat = "NV21";
            console.log("detectFormat", this.detectedFormat);
        }

        try {
            if (this.detectedFormat === "RGBA") {
                // data length must be w*h*4; upload directly
                this.uploadRGBA(data);
            } else if (this.detectedFormat === "NV12" || this.detectedFormat === "NV21") {
                // convert to RGBA into reusable buffer, then upload
                this.convertYuvToRgbaInto(data, w, h, this.detectedFormat);
                if (this.rgbaBuf) this.uploadRGBA(this.rgbaBuf);
            } else {
                // fallback: if length >= w*h*4, try to truncate and upload
                if (data.length >= w * h * 4) {
                    const view = new Uint8Array(data.buffer, data.byteOffset, w * h * 4);
                    this.uploadRGBA(view);
                } else {
                    // give up this frame
                }
            }
        } catch (e) {
            console.error("VideoTexturePlayerOptimized: processFrame error", e);
        }
        this.listeners.forEach((listener) => listener.onVideoPlaying?.(frame.pkPts));
    }

    // -------------------- texture management --------------------
    private rebuildForSize(w: number, h: number) {
        this.destroyTexture();
        this.videoW = w;
        this.videoH = h;

        // create texture
        this.tex = new Texture2D();
        this.tex.reset({
            width: w,
            height: h,
            format: Texture2D.PixelFormat.RGBA8888,
        });

        // create spriteFrame
        this.spriteFrame = new SpriteFrame();
        this.spriteFrame.texture = this.tex;
        this.spriteFrame.rect = new Rect(0, 0, w, h);
        this.spriteFrame.originalSize = new Size(w, h);
        this.spriteFrame.offset = new Vec2(0, 0);

        if (this.render_sprite) {
            // try {
            //     // ensure raw mode
            //     (this.sprite as any).sizeMode = (this.sprite as any).SizeMode ? (this.sprite as any).SizeMode.RAW : (this.sprite as any).sizeMode;
            // } catch (e) { }
            this.render_sprite.spriteFrame = this.spriteFrame;
        }

        // allocate/resize RGBA buffer once
        const need = w * h * 4;
        if (!this.rgbaBuf || this.rgbaBuf.length < need) {
            this.rgbaBuf = new Uint8Array(need);
            this.rgbaBuf32 = new Uint32Array(this.rgbaBuf.buffer);
        }
        this.applyFullScreen(w, h);
    }

    private destroyTexture() {
        try {
            if (this.spriteFrame) {
                if (this.render_sprite && this.render_sprite.spriteFrame === this.spriteFrame) {
                    this.render_sprite.spriteFrame = null as any;
                }
                try {
                    this.spriteFrame.destroy && this.spriteFrame.destroy();
                } catch (e) { }
                this.spriteFrame = null;
            }
            if (this.tex) {
                try {
                    this.tex.destroy && this.tex.destroy();
                } catch (e) { }
                this.tex = null;
            }
        } catch (e) { }
    }
    private applyFullScreen(videoW: number, videoH: number) {
        if (!this.render_sprite) return;
        const size = VideoFitHelper.getSize(videoW, videoH)
        this.render_sprite.node.getComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
        const uiTransform = this.render_sprite.node.getComponent(UITransform);
        uiTransform.width = size.width;
        uiTransform.height = size.height;

        console.log("applyFullScreen", videoW, videoH, uiTransform.width, uiTransform.height);
    }
    private ensureResetBuffers() {
        // keep existing buffers, but zero detection state
        this.detectedFormat = null;
    }

    // -------------------- upload --------------------
    private uploadRGBA(buf: Uint8Array) {
        if (!this.tex) return;
        // ensure Uint8Array
        const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        try {
            // uploadData accepts ArrayBufferView; pass Uint8Array
            this.tex.uploadData(view);
        } catch (e) {
            console.error("VideoTexturePlayerOptimized: uploadData failed", e);
        }
    }

    // -------------------- detection (fast heuristic) --------------------
    /**
     * detectFormat:
     *  - if length == w*h*4 -> RGBA
     *  - else if length == w*h*1.5 -> NV12/NV21 (decide which by sampling)
     *  - else -> unknown
     */
    private detectFormat(data: Uint8Array, w: number, h: number): "RGBA" | "NV12" | "NV21" | null {
        const len = data.length;
        if (len === w * h * 4) return "RGBA";
        if (len === Math.floor(w * h * 1.5)) {
            // need to decide NV12 vs NV21: sample small blocks and choose better candidate
            const guess = this.guessNvOrder(data, w, h);
            return guess;
        }
        return null;
    }

    /**
     * guessNvOrder:
     *  - sample a small 8x8 region top-left (or center if small)
     *  - convert that patch with NV12 and NV21 methods and check which produces fewer out-of-range / negative values
     *  - heuristic but works well in practice
     */
    private guessNvOrder(data: Uint8Array, w: number, h: number): "NV12" | "NV21" {
        // choose a small patch (clamp to image)
        const sampleW = Math.min(16, w);
        const sampleH = Math.min(16, h);
        const sx = Math.floor((w - sampleW) / 2);
        const sy = Math.floor((h - sampleH) / 2);

        let scoreNV12 = 0;
        let scoreNV21 = 0;

        // compute offsets
        const frameSize = w * h;
        const uvBase = frameSize;

        for (let y = sy; y < sy + sampleH; y++) {
            const yRow = y * w;
            const uvRow = ((y >> 1) * w);
            for (let x = sx; x < sx + sampleW; x++) {
                const yi = yRow + x;
                const Y = data[yi];

                const uvi = uvBase + uvRow + ((x >> 1) << 1);
                const aU = data[uvi];
                const aV = data[uvi + 1];

                // NV12 => U=aU, V=aV
                // NV21 => V=aU, U=aV
                // quick conversion small sample (BT.601 approx)
                const R12 = this._clampInt((298 * (Y - 16) + 409 * (aV - 128) + 128) >> 8);
                const G12 = this._clampInt((298 * (Y - 16) - 100 * (aU - 128) - 208 * (aV - 128) + 128) >> 8);
                const B12 = this._clampInt((298 * (Y - 16) + 516 * (aU - 128) + 128) >> 8);

                const R21 = this._clampInt((298 * (Y - 16) + 409 * (aU - 128) + 128) >> 8);
                const G21 = this._clampInt((298 * (Y - 16) - 100 * (aV - 128) - 208 * (aU - 128) + 128) >> 8);
                const B21 = this._clampInt((298 * (Y - 16) + 516 * (aV - 128) + 128) >> 8);

                // score: prefer values within 0..255 and that are not all equal (avoid degenerate)
                scoreNV12 += this._pixelScore(R12, G12, B12);
                scoreNV21 += this._pixelScore(R21, G21, B21);
            }
        }

        // choose larger score
        return scoreNV12 >= scoreNV21 ? "NV12" : "NV21";
    }

    private _clampInt(v: number) {
        if (v < 0) return 0;
        if (v > 255) return 255;
        return v | 0;
    }

    private _pixelScore(r: number, g: number, b: number) {
        // score higher when values are within 0..255 and have variance
        const mean = (r + g + b) / 3;
        const variance = Math.abs(r - mean) + Math.abs(g - mean) + Math.abs(b - mean);
        return variance;
    }

    // -------------------- YUV -> RGBA conversion (efficient, in-place into rgbaBuf) --------------------
    private convertYuvToRgbaInto(yuv: Uint8Array, w: number, h: number, fmt: "NV12" | "NV21") {
        if (!this.rgbaBuf || this.rgbaBuf.length < w * h * 4) {
            this.rgbaBuf = new Uint8Array(w * h * 4);
            this.rgbaBuf32 = new Uint32Array(this.rgbaBuf.buffer); // 重新分配缓冲区时同时创建视图
        }
        //const out = this.rgbaBuf!;
        const out32 = this.rgbaBuf32!; // 直接使用成员变量中缓存的视图，不需要每次创建
        const frameSize = w * h;
        const uvBase = frameSize;

        // integer-based BT.601 conversion constants
        // We'll compute using integer approximations similar to common formula
        // C = Y - 16; D = U - 128; E = V - 128
        // R = (298*C + 409*E + 128) >> 8
        // G = (298*C - 100*D - 208*E + 128) >> 8
        // B = (298*C + 516*D + 128) >> 8

        let outIdx = 0;

        for (let j = 0; j < h; j++) {
            const yRow = j * w;
            const uvRow = (j >> 1) * w; // interleaved UV row width = w
            for (let i = 0; i < w; i++) {
                const yVal = yuv[yRow + i];
                const uvIndex = uvBase + uvRow + ((i >> 1) << 1);
                let U: number, V: number;
                if (fmt === "NV12") {
                    U = yuv[uvIndex];
                    V = yuv[uvIndex + 1];
                } else {
                    V = yuv[uvIndex];
                    U = yuv[uvIndex + 1];
                }

                const C = yVal - 16;
                const D = U - 128;
                const E = V - 128;

                let R = (298 * C + 409 * E + 128) >> 8;
                let G = (298 * C - 100 * D - 208 * E + 128) >> 8;
                let B = (298 * C + 516 * D + 128) >> 8;

                // // clamp
                // if (R < 0) R = 0; else if (R > 255) R = 255;
                // if (G < 0) G = 0; else if (G > 255) G = 255;
                // if (B < 0) B = 0; else if (B > 255) B = 255;

                // clamp 使用位运算优化
                R = R < 0 ? 0 : (R > 255 ? 255 : R);
                G = G < 0 ? 0 : (G > 255 ? 255 : G);
                B = B < 0 ? 0 : (B > 255 ? 255 : B);

                // out[outIdx++] = R;
                // out[outIdx++] = G;
                // out[outIdx++] = B;
                // out[outIdx++] = 255;

                // 使用 Uint32Array 一次性写入 RGBA，减少 4 次单独赋值
                // RGBA8888 小端模式：0xFFAARRGG -> 实际存储 BB GG RR AA
                out32[outIdx] = (0xFF << 24) | (B << 16) | (G << 8) | R;
            }
        }
    }
}
