import { Size, view } from "cc";

export class VideoFitHelper {

    static getSize(videoWidth: number, videoHeight: number): Size | null {
        if (videoWidth <= 0 || videoHeight <= 0) return null;
        const viewSize = view.getVisibleSize();
        const videoRatio = videoWidth / videoHeight;
        const screenRatio = viewSize.width / viewSize.height;
        let targetW = viewSize.width;
        let targetH = viewSize.height;
        if (videoRatio > screenRatio) {
            // 视频比屏幕更宽：高度铺满，宽度按比例计算
            targetW = targetH * videoRatio;
        } else {
            // 视频比屏幕更高，宽度铺满，高度按比例计算
            targetH = targetW / videoRatio;
        }
        console.log("视频输出宽高：", targetW, targetH)
        return new Size(targetW, targetH)
    }
}
