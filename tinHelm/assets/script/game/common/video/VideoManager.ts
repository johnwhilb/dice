import { _decorator, Component, Sprite, sys, VideoClip } from "cc";
import { VideoPlayerWX } from "./VideoPlayerWX";
import VideoPlayerWeb from "./VideoPlayerWeb";
import { IVideoPlayArgs, IVideoPlayerEvent, VideoBase } from "./VideoBase";
import { VideoPlayerPCWX } from "./VideoPlayerPCWX";
import { VideoPlayerMgr } from "./VideoPlayerMgr";
import { isWasmVideoSupported } from "../wasmVideo/soft/Utils";
import { oops } from "db://oops-framework/core/Oops";

const { ccclass, property } = _decorator;

@ccclass("VideoManager")
export class VideoManager extends Component {
    @property(Sprite)
    videoSprite: Sprite | null = null;   // 显示视频的 Sprite

    private player: VideoBase | null = null;
    private prePlayer: VideoBase | null = null;

    private videoUrlMap: Map<string, string> = new Map(); //资源映射
    onLoad() {

    }

    private _cacheVideos: Map<string, VideoClip> = new Map();

    initVideo() {
        if (sys.platform != sys.Platform.WECHAT_GAME && this.player) {
            this.prePlayer = this.player;
            this.player = null;
        }
        if (!this.player) {
            const player = this.createVideo();
            if (!player) return;
            player.render_sprite = this.videoSprite;
            this.player = player;
            VideoPlayerMgr.ins.addPlayer(player);
        }
    }

    private createVideo(): VideoBase | null {
        switch (sys.platform) {
            case sys.Platform.WECHAT_GAME: {
                if (isWasmVideoSupported()) { //开发者工具或者pc端小程序
                    return new VideoPlayerPCWX();
                } else {//安卓/ios 微信小程序
                    return new VideoPlayerWX();
                }
            }
            case sys.Platform.DESKTOP_BROWSER:
            case sys.Platform.MOBILE_BROWSER:
                return new VideoPlayerWeb();
            default:
                console.warn("当前平台不支持视频播放");
                return null;
        }
    }

    private getVideoUrl(vc: VideoClip): string | null {
        switch (sys.platform) {
            case sys.Platform.WECHAT_GAME:
                return (vc as any)["_video"] ?? vc.nativeUrl;
            case sys.Platform.DESKTOP_BROWSER:
            case sys.Platform.MOBILE_BROWSER:
                const nativeVideo = (vc as any)["_video"] ?? (vc as any)["_nativeAsset"];
                if (typeof nativeVideo === "string") return nativeVideo;
                if (nativeVideo?.currentSrc) return nativeVideo.currentSrc;
                if (nativeVideo?.src) return nativeVideo.src;
                if (nativeVideo?.baseURI && vc.nativeUrl) {
                    return new URL(vc.nativeUrl, nativeVideo.baseURI).href;
                }
                return vc.nativeUrl || null;
            default:
                console.warn("当前平台不支持获取视频URL");
                return null;
        }
    }

    public onDestroy() {
        this.stop();
        if (this.player) {
            VideoPlayerMgr.ins.removePlayer(this.player);
            this.player = null;
        }
        this.cleanPrePlayer();
        //释放资源
        this._cacheVideos.forEach((vc: VideoClip, url: string) => {
            oops.res.release(url, "bundle");
        })
        this._cacheVideos.clear();
        this.videoUrlMap.clear();
    }

    addListener(listener: IVideoPlayerEvent) {
        this.player?.addListener(listener);
    }

    removeListener(listener: IVideoPlayerEvent) {
        this.player?.removeListener(listener);
    }

    pauseOnTime(time: number) {
        this.player?.pauseOnTime(time);
    }

    // -------- 对外接口 --------

    play(url: string, args: IVideoPlayArgs, preLoadVideos?: string[]) {
        if (!this.player) this.initVideo();
        if (!this.player) return;

        let videoUrl = this.videoUrlMap.get(url);
        if (videoUrl) {
            this.player?.play(videoUrl, args);
            return;
        }

        this.loadVideoClip(url, (vc: VideoClip) => {
            const video_url = this.getVideoUrl(vc);
            if (!video_url) {
                console.error(`[VideoManager] 无法取得视频地址: ${url}`);
                return;
            }
            this.videoUrlMap.set(url, video_url);
            this.player?.play(video_url, args);
            this.preLoadLinkVideos(preLoadVideos)
        })
    }

    cleanPrePlayer() {
        if (this.prePlayer) {
            VideoPlayerMgr.ins.removePlayer(this.prePlayer);
            this.prePlayer.stop();
            this.prePlayer = null
        }
    }

    preLoadLinkVideos(videos?: string[]) {
        if (!videos || videos.length <= 0) {
            return;
        }
        for (let i = 0; i < videos.length; i++) {
            let url = videos[i]
            this.loadVideoClip(url)
        }
    }
    stop() {
        this.player?.stop();
    }
    pause() {
        this.player?.pause();
    }
    resume() {
        this.player?.resume();
    }

    private loadVideoClip(url: string, callback?: (vc: VideoClip) => void) {
        let vcc = this._cacheVideos.get(url)
        if (vcc != null) {
            callback?.(vcc)
            return;
        }
        oops.res.load<VideoClip>("bundle", url, VideoClip)
            .then((vc) => {
                if (!this.isValid) {
                    oops.res.release(url, "bundle");
                    return;
                }
                this._cacheVideos.set(url, vc);
                callback?.(vc)
            })
            .catch((err) => {
                console.error(`[VideoManager] 视频加载失败: ${url}`, err);
            });
    }
}
