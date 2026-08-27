import { VideoBase } from "./VideoBase";

export class VideoPlayerMgr {
    private static _instance: VideoPlayerMgr = null;
    public static get ins(): VideoPlayerMgr {
        if (!this._instance) {
            this._instance = new VideoPlayerMgr();
        }
        return this._instance;
    }

    private _cachePlayers: VideoBase[] = [];
    addPlayer<T extends VideoBase>(player: T) {
        this._cachePlayers.push(player);
    }

    removePlayer<T extends VideoBase>(player: T) {
        const index = this._cachePlayers.findIndex((item) => item === player);
        if (index !== -1) {
            this._cachePlayers.splice(index, 1);
        }
    }

    clean() {
        this._cachePlayers.forEach((item) => {
            item.stop();
        });
        this._cachePlayers = [];
    }
    stop() {
        this._cachePlayers.forEach((item) => {
            item.stop();
        });

    }
    pause() {
        this._cachePlayers.forEach((item) => {
            item.pause();
        });
    }

    resume() {
        this._cachePlayers.forEach((item) => {
            item.resume();
        });
    }
}