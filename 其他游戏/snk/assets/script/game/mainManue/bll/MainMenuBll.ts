import { game, sys } from "cc";
import { oops } from "db://oops-framework/core/Oops";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { MainMenu } from "../MainMenu";
import { Game } from "../../game/Game";
import { smc } from "../../common/SingletonModuleComp";
import { coinSounds, GameAudio, switchAltSound, switchSound } from "../../common/GameAudio";

export class MainMenuBll extends CCBusiness<MainMenu> {
    /** 创建或复用本局实体，打开首轮商店。 */
    entryGame() {
        GameAudio.playTransition(false);
        if (!smc.game) {
            smc.game = Game.create();
        }
        smc.game.openShop();
    }

    /** 恢复已保存的商店局，无效存档返回多语言提示键。 */
    continueGame() {
        GameAudio.playTransition(false);
        if (!smc.game) {
            smc.game = Game.create();
        }
        smc.game.openShop(true);
    }

    /** 从框架音频管理器同步音乐、音效开关到主菜单数据。 */
    refreshAudio() {
        const model = this.ent.MainMenuModel;
        model.musicEnabled = oops.audio.music.getSwitch();
        model.effectEnabled = oops.audio.effect.getSwitch();
    }

    /** 进入主菜单时将当前曲目平滑恢复到菜单音量和正常速度。 */
    playMenuMusic() {
        GameAudio.setMusic(0.5, 1, 2);
        GameAudio.preloadEffects([switchSound, switchAltSound, "Wind Bolt 8", "Wind Bolt 12", "Error 2", ...coinSounds]);
    }

    /** 切换背景音乐静音状态，保留当前播放进度并保存框架音频配置。 */
    toggleMusic() {
        const enabled = !oops.audio.music.getSwitch();
        oops.audio.music.setSwitch(enabled);
        GameAudio.applyMusicMix();
        GameAudio.playSwitchPair();
        oops.audio.save();
        this.refreshAudio();
    }

    /** 切换音效开关并保存到框架音频配置。 */
    toggleEffect() {
        const enabled = !oops.audio.effect.getSwitch();
        oops.audio.effect.setSwitch(enabled);
        if (enabled) {
            GameAudio.playSwitchPair();
        } else {
            GameAudio.stopEffects();
        }
        oops.audio.save();
        this.refreshAudio();
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
