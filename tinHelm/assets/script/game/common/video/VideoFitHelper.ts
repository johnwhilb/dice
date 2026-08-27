import { gameCommon } from "../config/GameCommon";

export class VideoFitHelper {

    static getSize(videoWidth: number, videoHeight: number) {
        if (videoWidth <= 0 || videoHeight <= 0) return;
        const viewSize = gameCommon.getVisibleSize();
        const videoRatio = videoWidth / videoHeight;
        const screenRatio = viewSize.width / viewSize.height;
        let targetW = viewSize.width;
        let targetH = viewSize.height;
        if (videoRatio > screenRatio) {
            // 视频比屏幕更宽：高度铺满，宽度按比例计算
            targetH = targetH;
            targetW = targetH * videoRatio;
        } else {
            // 视频比屏幕更高，宽度铺满，高度按比例计算
            targetW = targetW;
            targetH = targetW / videoRatio;
        }
        console.log("视频输出宽高：", targetW, targetH)
        return { width: targetW, height: targetH }
    }
}
