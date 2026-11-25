import { _decorator, Label } from "cc";
import { CCView } from "db://oops-framework/module/common/CCView";
import { ecs } from "db://oops-framework/libs/ecs/ECS";
import { gui } from "db://oops-framework/core/gui/Gui";
import { LayerType } from "db://oops-framework/core/gui/layer/LayerEnum";
import { lang } from "../common/Language";
import type { Setting } from "./Setting";
import { SettingBll } from "./SettingBll";
import { ControlMode, SettingEvent } from "./SettingEvent";

const { ccclass } = _decorator;

@ccclass("MainMenuOptionView")
@ecs.register("SettingView", false)
@gui.register("SettingView", {
    layer: LayerType.PopUp,
    prefab: "gui/setting/SettingView",
    mask: true,
})
export class SettingView extends CCView<Setting> {
    start() {
        this.getNode("txtSettingTitle").getComponent(Label).string = lang("main_menu_options");
        this.getNode("txtBack").getComponent(Label).string = lang("main_menu_back");
        this.on(SettingEvent.AudioChanged, this.refreshAudio, this);
        this.on(SettingEvent.ControlModeChanged, this.refreshControlMode, this);
        this.refreshAudio();
        this.refreshControlMode();
    }

    private refreshAudio() {
        const model = this.ent.SettingModel;
        this.getNode("lbtMusic").getComponent(Label).string = lang(
            model.musicEnabled ? "main_menu_music_on" : "main_menu_music_off"
        );
        this.getNode("lbtEffect").getComponent(Label).string = lang(
            model.effectEnabled ? "main_menu_effect_on" : "main_menu_effect_off"
        );
    }

    private refreshControlMode() {
        const mode = this.ent.SettingModel.controlMode;
        this.getNode("lbtControlMode").getComponent(Label).string = lang(
            mode === ControlMode.Joystick ? "setting_control_joystick" : "setting_control_follow"
        );
    }

    reset() {
        this.off(SettingEvent.AudioChanged, this.refreshAudio, this);
        this.off(SettingEvent.ControlModeChanged, this.refreshControlMode, this);
    }

    btnMusic() {
        this.ent.getBusiness<SettingBll>(SettingBll).toggleMusic();
    }

    btnEffect() {
        this.ent.getBusiness<SettingBll>(SettingBll).toggleEffect();
    }

    btnControlMode() {
        this.ent.getBusiness<SettingBll>(SettingBll).toggleControlMode();
    }

    btnBack() {
        this.remove();
    }
}
