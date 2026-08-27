import { Component, Sprite } from "cc";

export abstract class VideoBase extends Component {
    public render_sprite: Sprite | null = null;
    protected listeners: IVideoPlayerEvent[] = [];
    protected pauseTime = 0;

    abstract play(url: string, args: IVideoPlayArgs): void;
    abstract stop(): void;
    abstract pause(): void;
    abstract resume(): void;

    /**
     * 暂停视频播放指定时间
     * @param time 暂停时间，单位毫秒
     */
    pauseOnTime(time: number) {
        this.pauseTime = time;
    }

    addListener(listener: IVideoPlayerEvent) {
        if (this.listeners.findIndex((item) => item == listener) == -1) {
            this.listeners.push(listener);
        }
    }

    removeListener(listener: IVideoPlayerEvent) {
        let index = this.listeners.findIndex((item) => item == listener)
        if (index != -1) {
            this.listeners.splice(index, 1);
        }
    }
}

/**视频事件 */
export interface IVideoPlayerEvent {
    /** 常用事件 */
    /**开始播放事件 */
    onVideoPlay?: () => void;
    /**播放中事件 */
    onVideoPlaying?: (dt: number) => void;
    /**播放结束事件 */
    onVideoEnded?: (loopCount: number) => void;

    /** 以下事件不常用 */
    /**停止播放事件 */
    onVideoStop?: () => void;
    /**暂停播放事件 */
    onVideoPause?: () => void;
    /**恢复播放事件 */
    onVideoResume?: () => void;
}

/**视频播放参数 */
export interface IVideoPlayArgs {
    loop: boolean;
    /**视频静音，true:静音 */
    muted?: boolean;
}