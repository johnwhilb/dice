import { _decorator } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { CCView } from "db://oops-framework/module/common/CCView";
import { GameAudio } from "../../common/GameAudio";
import type { Initialize } from "../Initialize";
import { smc } from "../../common/SingletonModuleComp";
import { TransitionView } from "./TransitionView";

const { ccclass } = _decorator;

/** 游戏资源加载 */
@ccclass("LoadingViewComp")
@ecs.register("LoadingView", false)
@gui.register("LoadingView", { layer: LayerType.UI, prefab: "gui/loading/loading" })
export class LoadingViewComp extends CCView<Initialize> {
    start() {
        this.loadGameRes();
    }

    private onLoginSuccessGame() {
        TransitionView.play({}, () => {
            return smc.mainMenu.open().then((node) => {
                if (!node) {
                    return false;
                }
                this.remove();
                return true;
            });
        }).then((ready) => {
            if (!ready) {
                oops.gui.toast(oops.language.getLangByID("shop_load_failed"));
                return;
            }
            GameAudio.preloadMusicBundle();
        });
    }

    /** 加载初始游戏内容资源 */
    private loadGameRes() {
        oops.res.loadDir("game", this.onCompleteCallback.bind(this));
    }

    /** 加载完成事件 */
    private onCompleteCallback(error?: Error) {
        if (error) {
            oops.gui.toast(oops.language.getLangByID("shop_load_failed"));
            return;
        }
        this.onLoginSuccessGame();
    }

    reset(): void {
    }
}
