import { _decorator, Component, Sprite, Texture2D, sys, VideoClip } from "cc";
import { VideoPlayerWX } from "./VideoPlayerWX";
import VideoPlayerWeb from "./VideoPlayerWeb";
import { IVideoPlayArgs, IVideoPlayerEvent, VideoBase } from "./VideoBase";
import { VideoPlayerPCWX } from "./VideoPlayerPCWX";
import { oops } from "../../../oops/core/Oops";
import { VideoPlayerMgr } from "./VideoPlayerMgr";
import { isWasmVideoSupported } from "../wasmVideo/soft/Utils";

const { ccclass, property } = _decorator;

@ccclass("VideoManager")
export class VideoManager extends Component {
    @property(Sprite)
    videoSprite: Sprite | null = null;   // 显示视频的 Sprite

    private player: VideoBase = null;
    private prePlayer: VideoBase = null;

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
            this.player = this.createVideo();
            this.player!.render_sprite = this.videoSprite;
            VideoPlayerMgr.ins.addPlayer(this.player);
        }
    }

    private createVideo(): VideoBase {
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

    private getVideoUrl(vc: VideoClip) {
        switch (sys.platform) {
            case sys.Platform.WECHAT_GAME:
                return (vc as any)["_video"];
            case sys.Platform.DESKTOP_BROWSER:
            case sys.Platform.MOBILE_BROWSER:
                return this.processBaseUrl(vc["_video"]["baseURI"]) + vc.nativeUrl
            default:
                console.warn("当前平台不支持获取视频URL");
                return null;
        }
    }

    private processBaseUrl(url: string): string {
        const noQuery = url.split("?")[0];
        return noQuery.substring(0, noQuery.lastIndexOf("/") + 1);
    }

    public onDestroy() {
        this.stop();
        //释放资源
        this._cacheVideos.forEach((vc: VideoClip, url: string) => {
            oops.res.release(url);
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
        let videoUrl = this.videoUrlMap.get(url);
        if (videoUrl) {
            this.player?.play(videoUrl, args);
            return;
        }

        this.loadVideoClip(url, (vc: VideoClip) => {
            let video_url = this.getVideoUrl(vc);
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

    preLoadLinkVideos(videos: string[]) {
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
        oops.res.load(url, VideoClip, (err: Error | null, vc: VideoClip) => {
            this._cacheVideos.set(url, vc);
            callback?.(vc)
        })
    }
}
