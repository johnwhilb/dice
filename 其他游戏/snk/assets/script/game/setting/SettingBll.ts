import { oops } from "db://oops-framework/core/Oops";
import { CCBusiness } from "db://oops-framework/module/common/CCBusiness";
import { GameAudio } from "../common/GameAudio";
import { CommonStorageConfig } from "../common/config/GameStorageConfig";
import type { Setting } from "./Setting";
import { ControlMode, SettingEvent } from "./SettingEvent";

export class SettingBll extends CCBusiness<Setting> {
    /** 读取框架音频开关和本地控制偏好，首次使用默认跟随。 */
    protected init() {
        const model = this.ent.SettingModel;
        model.musicEnabled = oops.audio.music.getSwitch();
        model.effectEnabled = oops.audio.effect.getSwitch();
        const savedMode = oops.storage.get(CommonStorageConfig.BattleControlMode);
        model.controlMode = savedMode === ControlMode.Joystick ? ControlMode.Joystick : ControlMode.Follow;
    }

    /** 切换并保存音乐开关，应用当前音乐的混音。 */
    toggleMusic() {
        const model = this.ent.SettingModel;
        model.musicEnabled = !model.musicEnabled;
        oops.audio.music.setSwitch(model.musicEnabled);
        GameAudio.applyMusicMix();
        GameAudio.playSwitchPair();
        oops.audio.save();
        this.dispatchEvent(SettingEvent.AudioChanged);
    }

    /** 切换并保存音效开关，关闭时停止正在播放的游戏音效。 */
    toggleEffect() {
        const model = this.ent.SettingModel;
        model.effectEnabled = !model.effectEnabled;
        oops.audio.effect.setSwitch(model.effectEnabled);
        if (model.effectEnabled) {
            GameAudio.playSwitchPair();
        } else {
            GameAudio.stopEffects();
        }
        oops.audio.save();
        this.dispatchEvent(SettingEvent.AudioChanged);
    }

    /** 在跟随和摇杆之间切换，保存控制偏好并通知界面。 */
    toggleControlMode() {
        const model = this.ent.SettingModel;
        model.controlMode = model.controlMode === ControlMode.Follow ? ControlMode.Joystick : ControlMode.Follow;
        oops.storage.set(CommonStorageConfig.BattleControlMode, model.controlMode);
        GameAudio.playSwitchPair();
        this.dispatchEvent(SettingEvent.ControlModeChanged);
    }
}
