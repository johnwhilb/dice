/** 设置变更事件。 */
export enum SettingEvent {
    /** 音乐或音效设置已变更，无参数。 */
    AudioChanged = "setting_audio_changed",
    /** 战斗控制方式已变更，无参数。 */
    ControlModeChanged = "setting_control_mode_changed",
}

/** 战斗控制方式。 */
export enum ControlMode {
    /** 队首朝触摸位置转向。 */
    Follow = "follow",
    /** 队首按浮动摇杆方向转向。 */
    Joystick = "joystick",
}
