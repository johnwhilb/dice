import { director, Director, JsonAsset } from "cc";
import type { AssetManager } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { JsonUtil } from "db://oops-framework/core/utils/JsonUtil";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { CommonStorageConfig } from "../common/config/GameStorageConfig";
import type { Initialize } from "./Initialize";
import { InitializeEvent, InitializeProgress } from "./InitializeEvent";
import type { IInitializeProgress } from "./InitializeEvent";

interface IBundleDownloadProgress {
    progress?: number;
    totalBytesWritten?: number;
    totalBytesExpectedToWrite?: number;
}

const tableBatchSize = 4;

export class InitializeBll extends CCBusiness<Initialize> {
    /** 开始加载启动资源，等待各阶段结束后通过事件通知界面。 */
    load() {
        this.loadStartup().catch((error: unknown) => {
            console.error("启动资源加载失败", error);
            this.dispatchEvent(InitializeEvent.LoadFailed);
        });
    }

    /** 等待界面先绘制，再分阶段下载资源包、配置表、语言和公共资源。 */
    private async loadStartup() {
        const downloadMessage = "正在加载游戏资源";
        this.updateProgress(downloadMessage, 0);
        await this.waitForDraw();

        let downloadRatio = 0;
        let downloading = true;
        const bundle = await oops.res.loadBundle(oops.res.defaultBundleName, {
            onFileProgress: (details: IBundleDownloadProgress) => {
                if (!downloading) {
                    return;
                }
                const expectedBytes = details?.totalBytesExpectedToWrite ?? 0;
                const ratio = expectedBytes > 0
                    ? (details.totalBytesWritten ?? 0) / expectedBytes
                    : (details?.progress ?? 0) / 100;
                if (Number.isFinite(ratio) && ratio > downloadRatio) {
                    downloadRatio = Math.min(ratio, 1);
                    this.updateProgress(downloadMessage, downloadRatio * InitializeProgress.Bundle);
                }
            },
        }).catch((error: unknown) => {
            downloading = false;
            throw error;
        });
        downloading = false;

        await this.loadTables(bundle);
        this.updateProgress("正在加载语言", InitializeProgress.Tables);
        await this.waitForDraw();
        await this.loadLanguage();

        this.updateProgress("正在加载公共资源", InitializeProgress.Language);
        await this.waitForDraw();
        await this.loadCommon();

        this.updateProgress("正在进入主菜单", InitializeProgress.Common);
        await this.waitForDraw();
        this.dispatchEvent(InitializeEvent.LoadFinished);
    }

    /** 从 bundle 读取游戏配置表，每次绘制后最多开始加载四张。 */
    private async loadTables(bundle: AssetManager.Bundle) {
        const tables = bundle.getDirWithPath("config/game", JsonAsset).map((item) => {
            return item.path;
        });
        const total = tables.length;
        if (!total) {
            throw new Error("缺少游戏配置表");
        }

        const message = "正在加载游戏配置";
        this.updateProgress(message, InitializeProgress.Bundle);
        let completed = 0;
        while (completed < total) {
            await this.waitForDraw();
            const batch = tables.slice(completed, completed + tableBatchSize);
            await new Promise<void>((resolve, reject) => {
                bundle.load(batch, JsonAsset, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
            completed += batch.length;
            const progress = InitializeProgress.Bundle + completed / total * (InitializeProgress.Tables - InitializeProgress.Bundle);
            this.updateProgress(message, progress);
        }

        await this.waitForDraw();
        await JsonUtil.loadDir();
        for (const path of tables) {
            const name = path.slice(path.lastIndexOf("/") + 1);
            if (!JsonUtil.get(name)) {
                throw new Error(`缺少游戏配置表：${name}`);
            }
        }
    }

    /** 读取本地语言选项，首次进入时保存默认语言。 */
    private loadLanguage() {
        return new Promise<void>((resolve) => {
            let language = oops.storage.get(CommonStorageConfig.Language);
            if (!language) {
                language = oops.config.game.languageDefault;
                oops.storage.set(CommonStorageConfig.Language, language);
            }
            oops.language.setLanguage(language, resolve);
        });
    }

    /** 加载框架公共预制体和动画，失败时终止初始化。 */
    private loadCommon() {
        return new Promise<void>((resolve, reject) => {
            oops.res.loadDir("common", (error: Error | null) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }

    /** 等待当前画面实际绘制结束后，再开始下一批加载。 */
    private waitForDraw() {
        return new Promise<void>((resolve) => {
            director.once(Director.EVENT_AFTER_DRAW, resolve);
        });
    }

    /** 将当前阶段 message 和归一化进度 value 交给界面。 */
    private updateProgress(message: string, value: number) {
        const progress: IInitializeProgress = { message, value };
        this.dispatchEvent(InitializeEvent.LoadProgress, progress);
    }
}
