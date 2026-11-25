import { game, sys } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { MainMenu } from "../MainMenu";
import { Game } from "../../game/Game";
import { smc } from "../../common/SingletonModuleComp";
import { coinSounds, GameAudio, switchAltSound, switchSound } from "../../common/GameAudio";
import { ShopBll } from "../../shop/bll/ShopBll";

export class MainMenuBll extends CCBusiness<MainMenu> {
    /** 创建或复用本局实体，打开首轮商店。 */
    entryGame() {
        GameAudio.playTransition(false);
        if (!smc.game) {
            smc.game = Game.create();
        }
        smc.game.openShop();
    }

    /** 判断是否存在可恢复的商店或海克斯存档。 */
    canContinue() {
        return ShopBll.hasSavedRun();
    }

    /** 恢复最近的商店或海克斯存档，存档无效时由读档业务提示。 */
    continueGame() {
        GameAudio.playTransition(false);
        if (!smc.game) {
            smc.game = Game.create();
        }
        smc.game.openShop(true);
    }

    /** 进入主菜单时将当前曲目平滑恢复到菜单音量和正常速度。 */
    playMenuMusic() {
        GameAudio.setMusic(0.5, 1, 2);
        GameAudio.preloadEffects([switchSound, switchAltSound, "Wind Bolt 8", "Wind Bolt 12", "Error 2", ...coinSounds]);
    }

    /** 原生平台退出游戏，浏览器平台返回关闭页面的多语言提示键。 */
    quitGame() {
        oops.audio.save();
        if (sys.isNative) {
            game.end();
            return "";
        }
        return "main_menu_quit_browser";
    }

    /** 打开原版游戏的音乐专辑页面。 */
    openSoundtrack() {
        GameAudio.playSwitchPair();
        sys.openURL("https://kubbimusic.com/album/ember");
    }

    /** 打开原版游戏的社区页面。 */
    openCommunity() {
        GameAudio.playSwitchPair();
        sys.openURL("https://discord.gg/4d6GWmChKY");
    }
}
