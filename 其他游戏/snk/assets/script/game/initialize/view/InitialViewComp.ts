import { _decorator, Label, ProgressBar } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import type { Initialize } from "../Initialize";
import { InitializeBll } from "../InitializeBll";
import { InitializeEvent } from "../InitializeEvent";
import type { IInitializeProgress } from "../InitializeEvent";
import { LoadingViewComp } from "./LoadingViewComp";

const { ccclass } = _decorator;

/** 游戏初始画面 - 避免加载框架通用资源与自定义游戏资源过长时的过度画面 */
@ccclass("InitialViewComp")
@ecs.register("InitialView", false)
export class InitialViewComp extends CCView<Initialize> {
    start() {
        this.on(InitializeEvent.LoadProgress, this.onLoadProgress, this);
        this.once(InitializeEvent.LoadFinished, this.enter, this);
        this.once(InitializeEvent.LoadFailed, this.onLoadFailed, this);
        this.ent.getBusiness<InitializeBll>(InitializeBll).load();
    }

    private onLoadProgress(event: string, progress: IInitializeProgress) {
        this.getNode("lbtLoadingMessage").getComponent(Label)!.string = progress.message;
        this.getNode("loadingProgress").getComponent(ProgressBar)!.progress = progress.value;
        this.getNode("lbtLoadingPercent").getComponent(Label)!.string = `${Math.floor(progress.value * 100)}%`;
    }

    private enter() {
        oops.gui.setOpenFailure(this.onOpenFailure);
        this.ent.addUi(LoadingViewComp).then((node) => {
            if (node) {
                this.remove();
            } else {
                this.onLoadFailed();
            }
        }, () => {
            this.onLoadFailed();
        });
    }

    private onLoadFailed() {
        this.getNode("lbtLoadingMessage").getComponent(Label)!.string = "加载失败，请重新进入游戏";
    }

    /** 窗口打开失败事件 */
    private onOpenFailure() {
        oops.gui.toast("网络异常请稍后重试");
    }

    reset(): void {
        this.node.destroy();
    }
}
