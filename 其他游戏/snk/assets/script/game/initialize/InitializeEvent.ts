/** 游戏启动事件。 */
export enum InitializeEvent {
    /** 加载阶段或总进度变化，参数为 IInitializeProgress。 */
    LoadProgress = "initialize_load_progress",
    /** 启动所需资源加载完成，无参数。 */
    LoadFinished = "initialize_load_finished",
    /** 加载失败，无参数。 */
    LoadFailed = "initialize_load_failed",
}

/** 各阶段在总进度条上的结束位置。 */
export enum InitializeProgress {
    /** 游戏资源包下载完成。 */
    Bundle = 0.75,
    /** 配置表全部加载完成。 */
    Tables = 0.90,
    /** 当前语言加载完成。 */
    Language = 0.95,
    /** 公共资源加载完成。 */
    Common = 1,
}

/** 当前阶段的提示文本与 0 到 1 的总进度。 */
export interface IInitializeProgress {
    message: string;
    value: number;
}
