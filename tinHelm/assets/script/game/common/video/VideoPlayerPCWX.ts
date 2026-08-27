// @ts-nocheck -- WeChat/WASM APIs are only available in the mini-game build environment.
// VideoPlayerPCWX.ts
import { _decorator, Sprite, SpriteFrame, UITransform } from "cc";
import { SoftVideoStrategy } from "../wasmVideo/soft/SoftVideoStrategy";
import { DecodedVideoData } from "../wasmVideo/soft/VideoTypes";
import { WasmVideoManager } from "../wasmVideo/WasmVideoManager";
// import { WechatWebAudio } from "../wxApis/WechatWebAudio";
import { IVideoPlayArgs, VideoBase } from "./VideoBase";
import { VideoFitHelper } from "./VideoFitHelper";
const { ccclass, property } = _decorator;

/**  
 * pc端微信 VideoDecoder 不能用，因此使用wasm 软解码绕过。
 */

@ccclass("VideoPlayerPCWX")
export class VideoPlayerPCWX extends VideoBase {
    // if true, try to auto-loop on 'ended'
    public loop = false;
    private muted = false; //是否静音

    private wasmVideoManager: WasmVideoManager = null;
    // private audio: WechatWebAudio = null;
    private spriteFrame: SpriteFrame | null = null;

    // polling fallback
    private pollTimer: number | null = null;

    private running = false;
    private paused = false;
    private loopCount = 0

    private playbackRate = 1.0;      // 播放速率（0.5, 1.0, 2.0等）
    private baseTimestamp = 0;        // 基准系统时间戳（毫秒）
    private basePts = 0;              // 基准PTS（毫秒）
    private currentPts = 0;           // 当前播放位置（毫秒）

    private audioPlayTime = 0 //音频已经播放时间S

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

        this.destroyTexture();
        if (this.currentUrl != null && this.currentUrl.length > 0) {
            this.wasmVideoManager?.release(this.currentUrl)
        }
        this.stopPolling();
        this.unbindEvents()
    }

    private onVideoPlayStart = (url: string) => {
        //console.log("视频开始播放:", url, this.wasmVideoManager.ensureEntry(url));
        this.listeners.forEach((listener) => listener.onVideoPlay?.());
    }

    private onVideoPlayEnd = (url: string) => {
        this.loopCount++
        //console.log("视频播放结束:", url, this.wasmVideoManager.ensureEntry(url));
        this.listeners.forEach((listener) => listener.onVideoEnded?.(this.loopCount));
        if (!this.loop) {
            this.stop()
        }
    }

    private onVideoProgress = (url: string, playTime: number, progress: number, currentFrame: number, totalFrames: number) => {
        //console.log(`播放进度: ${(progress * 100).toFixed(1)}%, 当前帧: ${currentFrame}/${totalFrames}`);
        this.listeners.forEach((listener) => listener.onVideoPlaying?.(playTime));
    }

    private bindEvents() {
        this.unbindEvents()
        this.wasmVideoManager.on(this.currentUrl, "playStart", this.onVideoPlayStart);
        this.wasmVideoManager.on(this.currentUrl, "playEnd", this.onVideoPlayEnd);
        this.wasmVideoManager.on(this.currentUrl, "progress", this.onVideoProgress);
        //console.log("视频播放事件绑定:", this.currentUrl, Object.assign({}, this.wasmVideoManager.ensureEntry(this.currentUrl).playStartListeners));
    }

    private unbindEvents() {
        this.wasmVideoManager.off(this.currentUrl, "playStart", this.onVideoPlayStart);
        this.wasmVideoManager.off(this.currentUrl, "playEnd", this.onVideoPlayEnd);
        this.wasmVideoManager.off(this.currentUrl, "progress", this.onVideoProgress);
        //console.log("视频播放事件解绑:", this.currentUrl, Object.assign({}, this.wasmVideoManager.ensureEntry(this.currentUrl).playStartListeners));
    }

    // ---------------------- public API ----------------------
    private currentUrl = "";
    private _decoded: DecodedVideoData | null = null;
    public play(url: string, args: IVideoPlayArgs) {
        this.stop()

        this.loop = args.loop;
        this.muted = args.muted;
        this._decoded = null
        let strategy = this.loop ? SoftVideoStrategy.FirstPassCacheRgb : SoftVideoStrategy.Realtime
        this.wasmVideoManager = WasmVideoManager.getIns(strategy);
        // 播放新视频前，先解绑当前url的旧事件，避免重复绑定
        if (this.currentUrl && this.currentUrl.length > 0) {
            this.unbindEvents();
        }
        this.currentUrl = url;
        this.bindEvents()
        this.wasmVideoManager.bind(url, url, this.onVideoReady,
            {
                strategy: strategy,
                ringCapacity: 4,
                loop: this.loop,
            })
    }

    private onVideoReady = (texture, width, height, decoded) => {
        if (!texture || !decoded) {
            console.error('bind failed');
            return;
        }
        this.wasmVideoManager.removeReadyListener(this.currentUrl, this.onVideoReady); //移除首帧监听
        let entry = this.wasmVideoManager.ensureEntry(this.currentUrl);
        !this.muted && this.createWebAudio(entry.mp4Buffer)
        this._decoded = decoded;
        this.running = true;
        if (!this.spriteFrame) {
            this.spriteFrame = new SpriteFrame();
            this.spriteFrame.packable = false;
        }
        this.spriteFrame.texture = texture;
        this.render_sprite.spriteFrame = this.spriteFrame;

        this.applyFullScreen(width, height)

        this.startPlay()

        // console.info(
        //     'ready',
        //     url ? 'remote' : 'clip',
        //     SoftVideoStrategy.Realtime,
        //     `${width}x${height}`,
        //     `${decoded.frames.length || decoded.yuvFrames?.length || 0}/${decoded.frameCount} frames`,
        //     decoded.streaming ? 'streaming' : 'cached',
        // );

    }

    private createWebAudio(buffer: ArrayBuffer) {
        if (!this.audio) {
            // this.audio = new WechatWebAudio()
        }
        this.audio.load(buffer, this.loop, this.startPlay.bind(this))
    }

    private startPlay() {
        if ((!this.muted && !this.audio.isLoaded()) || !this._decoded) { //等音视频都加载完同步播放
            return
        }
        this._play()
    }

    public pause() {
        if (!this.wasmVideoManager) return;
        if (!this.running || this.paused) return;
        this.audio?.pause()
        this._pause()
        this.listeners.forEach((listener) => listener.onVideoPause?.());
    }

    public resume() {
        if (!this.wasmVideoManager) return;
        if (!this.running || !this.paused) return;
        this.audio?.resume()
        this._resume();
        this.listeners.forEach((listener) => listener.onVideoResume?.());
    }

    public stop() {
        if (!this.wasmVideoManager) return;
        if (!this.running) return;
        this.running = false;
        this.paused = false;
        this.loopCount = 0;
        this.audio?.stop()
        this.stopPolling();
        this.listeners.forEach((listener) => listener.onVideoStop?.());
    }

    private _play() {
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

    // -------------------- polling fallback --------------------

    private loopUpdate() {
        try {
            if (this.paused) return; //暂停   
            const currentPlaybackTime = this.getCurrentPlaybackTime();
            //按时间暂停功能
            if (this.pauseTime > 0 && this.pauseTime <= currentPlaybackTime) {
                this.pause()
                return
            }
            if (!this.running) {
                return;
            }
            let time = this.audio ? this.audio.getCurrentTime() : currentPlaybackTime * 0.001;
            let delta = time - this.audioPlayTime
            this.audioPlayTime = time;
            this.wasmVideoManager.tick(this.currentUrl, delta);
            const latest = this.wasmVideoManager.getDecoded(this.currentUrl);
            if (latest) {
                this._decoded = latest;
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
        this.audioPlayTime = this.audio ? this.audio.getCurrentTime() : 0
        this.pollTimer = window.setInterval(() => {
            this.loopUpdate();
        }, 8.3333); //按照120fps更新
        this.loopUpdate();
        this.audio?.play();
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
}
