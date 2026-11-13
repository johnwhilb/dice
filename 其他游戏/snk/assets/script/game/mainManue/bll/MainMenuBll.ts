import { game, sys } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { CCBusiness } from 'db://oops-framework/module/common/CCBusiness';
import { MainMenu } from '../MainMenu';
import { Battle } from '../../battle/Battle';
import { smc } from '../../common/SingletonModuleComp';

export class MainMenuBll extends CCBusiness<MainMenu> {
    /** 创建或复用本局实体，打开首轮商店。 */
    entryGame() {
        if (!smc.battle) {
            smc.battle = Battle.create();
        }
        smc.battle.openShop();
    }

    /** 响应继续游戏入口，返回暂无存档的多语言提示键。 */
    continueGame() {
        return 'main_menu_save_unavailable';
    }

    /** 从框架音频管理器同步音乐、音效开关到主菜单数据。 */
    refreshAudio() {
        const model = this.ent.MainMenuModel;
        model.musicEnabled = oops.audio.music.getSwitch();
        model.effectEnabled = oops.audio.effect.getSwitch();
    }

    /** 音乐开关开启时，随机选择一首原版主菜单背景音乐循环播放。 */
    playMenuMusic() {
        if (!oops.audio.music.getSwitch()) {
            return;
        }
        const paths = this.ent.MainMenuModel.menuMusicPaths;
        const path = paths[Math.floor(Math.random() * paths.length)] || paths[0];
        if (path) {
            oops.audio.playMusic(path, { bundle: 'bundle', loop: true });
        }
    }

    /** 切换背景音乐开关，开启时播放主菜单音乐，并保存框架音频配置。 */
    toggleMusic() {
        const enabled = !oops.audio.music.getSwitch();
        oops.audio.music.setSwitch(enabled);
        if (enabled) {
            this.playMenuMusic();
        }
        oops.audio.save();
        this.refreshAudio();
    }

    /** 切换音效开关并保存到框架音频配置。 */
    toggleEffect() {
        oops.audio.effect.setSwitch(!oops.audio.effect.getSwitch());
        oops.audio.save();
        this.refreshAudio();
    }

    /** 原生平台退出游戏，浏览器平台返回关闭页面的多语言提示键。 */
    quitGame() {
        oops.audio.save();
        if (sys.isNative) {
            game.end();
            return '';
        }
        return 'main_menu_quit_browser';
    }

    /** 打开原版游戏的音乐专辑页面。 */
    openSoundtrack() {
        sys.openURL('https://kubbimusic.com/album/ember');
    }

    /** 打开原版游戏的社区页面。 */
    openCommunity() {
        sys.openURL('https://discord.gg/4d6GWmChKY');
    }
}
