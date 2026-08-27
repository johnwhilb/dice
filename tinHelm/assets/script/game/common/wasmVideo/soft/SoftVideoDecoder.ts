/**
 * 跨平台 H.264 软解门面（仅 FFmpeg libav WASM，已移除 Broadway/avc）。
 * MP4 解封装 → libav 软解；默认 RGB888 全缓存，YUV 路径作为策略出口保留。
 */
import { Asset, sys } from 'cc';
import { FfmpegH264Decoder } from './FfmpegH264Decoder';
import { parseMp4ToAnnexB } from './Mp4Demuxer';
import type { DecodedVideoData, SoftDecodeOutputMode, StreamingDecodeOptions } from './VideoTypes';
import { wxDownloadVideo, wxReadVideoAsArrayBuffer } from './Utils';

export type { DecodedVideoData, SoftDecodeOutputMode, StreamingDecodeOptions } from './VideoTypes';
export { SoftVideoStrategy } from './SoftVideoStrategy';
export type { SoftVideoBindOptions } from './SoftVideoStrategy';


export class SoftVideoDecoder {
    static loadMp4FromAsset(asset: Asset): Promise<ArrayBuffer> {
        return Promise.reject(new Error('loadMp4FromAsset unsupported'));
    }

    static async loadVideoArrayBuffer(url) {
        const tempPath = await wxDownloadVideo(url)
        const arrayBuffer = await wxReadVideoAsArrayBuffer(tempPath)
        return { tempPath, arrayBuffer }
    }

    static async loadMp4FromUrl(url: string): Promise<ArrayBuffer> {
        const trimmed = url.trim();
        if (!trimmed) {
            throw new Error('remote mp4 url empty');
        }
        if (sys.Platform.WECHAT_GAME == sys.platform) {
            const { arrayBuffer } = await this.loadVideoArrayBuffer(trimmed)
            return arrayBuffer as ArrayBuffer
        } else {
            if (!/^https?:\/\//i.test(trimmed)) {
                throw new Error(`remote mp4 url invalid: ${trimmed}`);
            }
            const response = await fetch(trimmed);
            if (!response.ok) {
                throw new Error(`fetch mp4 failed: ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength <= 0) {
                throw new Error('remote mp4 empty');
            }
            return buffer;
        }
    }

    /** MP4 → libav WASM 软解（全 profile） */
    static async decodeMp4(
        mp4Buffer: ArrayBuffer,
        fpsOverride = 0,
        outputMode: SoftDecodeOutputMode = 'rgb',
    ): Promise<DecodedVideoData> {
        const parsed = parseMp4ToAnnexB(mp4Buffer);
        const fps = fpsOverride > 0 ? fpsOverride : parsed.fps;
        console.info(`[SoftVideoDecoder] profile ${parsed.profileIdc} → libav WASM (${outputMode})`);
        // @ts-ignore dynamic import
        await import('./lib/libav_h264_glue.js');
        const decoded = await FfmpegH264Decoder.decodeAccessUnits(parsed.samples, fps, outputMode);
        return {
            ...decoded,
            duration: parsed.duration > 0 ? parsed.duration : decoded.duration,
        };
    }

    async decodeFromMp4(mp4Buffer: ArrayBuffer, fpsOverride = 0): Promise<DecodedVideoData> {
        return SoftVideoDecoder.decodeMp4(mp4Buffer, fpsOverride);
    }

    /** MP4 时间片边解边播 */
    static async decodeMp4Streaming(
        mp4Buffer: ArrayBuffer,
        fpsOverride = 0,
        options: StreamingDecodeOptions,
    ): Promise<DecodedVideoData> {
        const parsed = parseMp4ToAnnexB(mp4Buffer);
        const fps = fpsOverride > 0 ? fpsOverride : parsed.fps;
        console.info(
            `[SoftVideoDecoder] streaming profile ${parsed.profileIdc} → libav WASM (${options.outputMode ?? 'rgba'})`,
        );
        // @ts-ignore dynamic import
        await import('./lib/libav_h264_glue.js');
        const decoded = await FfmpegH264Decoder.decodeAccessUnitsStreaming(
            parsed.samples,
            fps,
            parsed.duration,
            options,
        );
        return {
            ...decoded,
            duration: parsed.duration > 0 ? parsed.duration : decoded.duration,
        };
    }
}
