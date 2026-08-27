/**
 * FFmpeg libav H.264 软解（单线程 WASM）。
 * 默认 RGB888 全缓存（无透明，较 RGBA 省约 25%）；YUV 策略出口保留。
 */
import { Asset, assetManager } from 'cc';
import { asReadableBuffer, instantiateWasmBinary, isWxWebAssemblyEnv, isWasmVideoSupported } from './Utils';
import type {
    DecodedVideoData,
    DecodedYuvFrame,
    SoftDecodeOutputMode,
    StreamingDecodeOptions,
} from './VideoTypes';

//注意:当前编译出来的wasm初始分配内存只有16M，最大128M.

const AU_CAP = 1024 * 1024;
const BATCH_AU_COUNT = 4;
/** 720p RGB888 单帧上限 */
const MAX_FRAME_RGB = 1280 * 720 * 3;

type LibavH264Module = {
    _create_codec_context: () => number;
    _destroy_codec_context: (ctx: number) => void;
    _decode: (
        ctx: number,
        data: number,
        size: number,
        yOut: number,
        uOut: number,
        vOut: number,
        widthOut: number,
        heightOut: number,
        strideYOut: number,
        strideUvOut: number,
    ) => number;
    _decode_rgb: (
        ctx: number,
        data: number,
        size: number,
        rgbOut: number,
        widthOut: number,
        heightOut: number,
    ) => number;
    _decode_rgb_batch: (
        ctx: number,
        dataBlob: number,
        sizes: number,
        count: number,
        rgbOut: number,
        rgbCapacity: number,
        widthOut: number,
        heightOut: number,
        frameBytesOut: number,
    ) => number;
    _i420_to_rgb: (
        y: number,
        u: number,
        v: number,
        strideY: number,
        strideUv: number,
        width: number,
        height: number,
        colorRange: number,
        colorspace: number,
        rgbOut: number,
    ) => void;
    _i420_to_rgba: (
        y: number,
        u: number,
        v: number,
        strideY: number,
        strideUv: number,
        width: number,
        height: number,
        colorRange: number,
        colorspace: number,
        rgbaOut: number,
    ) => void;
    _close_frame: (ptr: number) => void;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    getValue: (ptr: number, type: string) => number;
    HEAPU8: Uint8Array;
};

type LibavH264Factory = (opts: Record<string, unknown>) => Promise<LibavH264Module>;
type LibavGlueModule = { default?: LibavH264Factory; LibavH264Glue?: LibavH264Factory };

function resolveLibavGlueFactory(mod: LibavGlueModule): LibavH264Factory {
    const globalFactory = (globalThis as { LibavH264Glue?: unknown }).LibavH264Glue;
    for (const candidate of [mod.default, mod.LibavH264Glue, globalFactory]) {
        if (typeof candidate === 'function') {
            return candidate as LibavH264Factory;
        }
    }
    throw new Error(`FfmpegH264Decoder: glue factory missing (exports: ${Object.keys(mod).join(', ')})`);
}

async function loadLibavGlueFactory(): Promise<LibavH264Factory> {
    const existing = (globalThis as { LibavH264Glue?: unknown }).LibavH264Glue;
    if (typeof existing === 'function') {
        return existing as LibavH264Factory;
    }
    // @ts-ignore dynamic import
    return resolveLibavGlueFactory(await import('./lib/libav_h264_glue.js') as LibavGlueModule);
}

async function createLibavModule(wasmBinary: ArrayBuffer): Promise<LibavH264Module> {
    const moduleFactory = await loadLibavGlueFactory();
    const wasmPackagePath = FfmpegH264Decoder.LIBAV_H264_WASM_PATH
    const moduleArg: Record<string, unknown> = {
        wasmBinary,
        locateFile: (path: string) => (path.endsWith('.wasm') ? wasmPackagePath : path),
    };
    if (isWxWebAssemblyEnv()) {
        moduleArg.instantiateWasm = (
            imports: WebAssembly.Imports,
            receiveInstance: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
        ): boolean => {
            instantiateWasmBinary(wasmBinary, imports, wasmPackagePath)
                .then((output) => receiveInstance(output.instance, output.module))
                .catch((error) => console.error('[FfmpegH264Decoder] wasm instantiate failed:', error));
            return true;
        };
    }
    const mod = await moduleFactory(moduleArg);
    if (!mod?._decode_rgb || !mod?._decode_rgb_batch || !mod?._decode || !mod?.HEAPU8) {
        throw new Error('FfmpegH264Decoder: wasm exports missing after init');
    }
    return mod;
}

/** 可复用的 libav 会话（实时/环形/边解边播策略用） */
export class FfmpegH264Session {
    private readonly mod: LibavH264Module;
    private readonly ctx: number;
    private readonly dataIn: number;
    private readonly widthOut: number;
    private readonly heightOut: number;
    private readonly strideYOut: number;
    private readonly strideUvOut: number;
    private readonly yPlaneOut: number;
    private readonly uPlaneOut: number;
    private readonly vPlaneOut: number;
    private readonly frameBytesOut: number;
    private readonly sizesBuf: number;
    private readonly sizesCap: number;
    private pixelBuf = 0;
    private pixelCap = 0;
    private blobBuf = 0;
    private blobCap = 0;

    constructor(mod: LibavH264Module) {
        this.mod = mod;
        this.ctx = mod._create_codec_context();
        this.dataIn = mod._malloc(AU_CAP);
        this.widthOut = mod._malloc(4);
        this.heightOut = mod._malloc(4);
        this.strideYOut = mod._malloc(4);
        this.strideUvOut = mod._malloc(4);
        this.yPlaneOut = mod._malloc(4);
        this.uPlaneOut = mod._malloc(4);
        this.vPlaneOut = mod._malloc(4);
        this.frameBytesOut = mod._malloc(4);
        this.sizesCap = BATCH_AU_COUNT;
        this.sizesBuf = mod._malloc(this.sizesCap * 4);
        this.ensurePixelBuf(MAX_FRAME_RGB * BATCH_AU_COUNT);
    }

    private ensurePixelBuf(bytes: number): void {
        if (bytes <= this.pixelCap && this.pixelBuf) {
            return;
        }
        if (this.pixelBuf) {
            this.mod._free(this.pixelBuf);
        }
        this.pixelBuf = this.mod._malloc(bytes);
        this.pixelCap = bytes;
    }

    private ensureBlobBuf(bytes: number): void {
        if (bytes <= this.blobCap && this.blobBuf) {
            return;
        }
        if (this.blobBuf) {
            this.mod._free(this.blobBuf);
        }
        this.blobBuf = this.mod._malloc(bytes);
        this.blobCap = bytes;
    }

    private writeAuSizes(sizes: number[]): void {
        const view = new Int32Array(this.mod.HEAPU8.buffer, this.sizesBuf, sizes.length);
        for (let i = 0; i < sizes.length; i++) {
            view[i] = sizes[i];
        }
    }

    private copyPixels(bytes: number, offset = 0): Uint8ClampedArray {
        return new Uint8ClampedArray(
            this.mod.HEAPU8.subarray(this.pixelBuf + offset, this.pixelBuf + offset + bytes),
        );
    }

    decodeAccessUnitYuv(au: Uint8Array): DecodedYuvFrame | null {
        if (au.byteLength > AU_CAP) {
            throw new Error(`FfmpegH264Decoder: access unit too large (${au.byteLength} bytes)`);
        }
        this.mod.HEAPU8.set(au, this.dataIn);
        const ptr = this.mod._decode(
            this.ctx, this.dataIn, au.byteLength,
            this.yPlaneOut, this.uPlaneOut, this.vPlaneOut,
            this.widthOut, this.heightOut, this.strideYOut, this.strideUvOut,
        );
        const yPtr = this.mod.getValue(this.yPlaneOut, 'i8*');
        if (!ptr || !yPtr) {
            return null;
        }
        const uPtr = this.mod.getValue(this.uPlaneOut, 'i8*');
        const vPtr = this.mod.getValue(this.vPlaneOut, 'i8*');
        const width = this.mod.getValue(this.widthOut, 'i32');
        const height = this.mod.getValue(this.heightOut, 'i32');
        const stride = this.mod.getValue(this.strideYOut, 'i32');
        const strideUv = this.mod.getValue(this.strideUvOut, 'i32');
        const ySize = stride * height;
        const uvSize = strideUv * (height >> 1);
        const y = new Uint8Array(this.mod.HEAPU8.subarray(yPtr, yPtr + ySize));
        const u = new Uint8Array(this.mod.HEAPU8.subarray(uPtr, uPtr + uvSize));
        const v = new Uint8Array(this.mod.HEAPU8.subarray(vPtr, vPtr + uvSize));
        this.mod._close_frame(ptr);
        return { width, height, stride, strideUv, y, u, v };
    }

    decodeAccessUnitsRgbBatch(
        samples: Uint8Array[],
        start: number,
        count: number,
    ): { frames: Uint8ClampedArray[]; width: number; height: number; consumed: number } {
        const n = Math.min(count, samples.length - start, this.sizesCap);
        if (n <= 0) {
            return { frames: [], width: 0, height: 0, consumed: 0 };
        }
        let blobSize = 0;
        const sizes: number[] = [];
        for (let i = 0; i < n; i++) {
            const au = samples[start + i];
            if (au.byteLength > AU_CAP) {
                throw new Error(`FfmpegH264Decoder: access unit too large (${au.byteLength} bytes)`);
            }
            sizes.push(au.byteLength);
            blobSize += au.byteLength;
        }
        this.ensureBlobBuf(Math.max(blobSize, 1));
        this.ensurePixelBuf(MAX_FRAME_RGB * n);
        let offset = 0;
        for (let i = 0; i < n; i++) {
            this.mod.HEAPU8.set(samples[start + i], this.blobBuf + offset);
            offset += sizes[i];
        }
        this.writeAuSizes(sizes);
        const produced = this.mod._decode_rgb_batch(
            this.ctx, this.blobBuf, this.sizesBuf, n,
            this.pixelBuf, this.pixelCap,
            this.widthOut, this.heightOut, this.frameBytesOut,
        );
        const width = this.mod.getValue(this.widthOut, 'i32');
        const height = this.mod.getValue(this.heightOut, 'i32');
        const frameBytes = this.mod.getValue(this.frameBytesOut, 'i32');
        const frames: Uint8ClampedArray[] = [];
        if (produced > 0 && frameBytes > 0) {
            for (let i = 0; i < produced; i++) {
                frames.push(this.copyPixels(frameBytes, i * frameBytes));
            }
        }
        return { frames, width, height, consumed: n };
    }

    /** YUV → RGB888（YUV 策略播放/落盘时用；无帧元数据时按 limited + 分辨率猜矩阵） */
    yuvToRgb(frame: DecodedYuvFrame): Uint8ClampedArray {
        const { width, height, stride, strideUv, y, u, v } = frame;
        const ySize = stride * height;
        const uvSize = strideUv * (height >> 1);
        this.ensureBlobBuf(ySize + uvSize * 2);
        this.mod.HEAPU8.set(y, this.blobBuf);
        this.mod.HEAPU8.set(u, this.blobBuf + ySize);
        this.mod.HEAPU8.set(v, this.blobBuf + ySize + uvSize);
        const bytes = width * height * 3;
        this.ensurePixelBuf(bytes);
        /* 与 wasm 一致：未标记默认 BT.601；仅宽>=1280 猜 BT.709 */
        const colorspace = width >= 1280 ? 1 : 0;
        this.mod._i420_to_rgb(
            this.blobBuf, this.blobBuf + ySize, this.blobBuf + ySize + uvSize,
            stride, strideUv, width, height,
            0, colorspace, this.pixelBuf,
        );
        return this.copyPixels(bytes);
    }

    release(): void {
        this.mod._destroy_codec_context(this.ctx);
        this.mod._free(this.dataIn);
        this.mod._free(this.widthOut);
        this.mod._free(this.heightOut);
        this.mod._free(this.strideYOut);
        this.mod._free(this.strideUvOut);
        this.mod._free(this.yPlaneOut);
        this.mod._free(this.uPlaneOut);
        this.mod._free(this.vPlaneOut);
        this.mod._free(this.frameBytesOut);
        this.mod._free(this.sizesBuf);
        if (this.pixelBuf) {
            this.mod._free(this.pixelBuf);
        }
        if (this.blobBuf) {
            this.mod._free(this.blobBuf);
        }
    }
}

function resolveBytesPerPixel(mode: SoftDecodeOutputMode): 3 | 4 {
    return mode === 'rgba' ? 4 : 3;
}

/** FFmpeg H.264 解码器：默认 RGB888 全缓存。 */
export class FfmpegH264Decoder {
    private static module: LibavH264Module | null = null;
    private static readyPromise: Promise<void> | null = null;
    static LIBAV_H264_WASM_PATH = ""
    static LIBAV_H264_WASM_BUFFER: ArrayBuffer = null as ArrayBuffer
    static ensureReady(): Promise<void> {
        if (!FfmpegH264Decoder.readyPromise) {
            FfmpegH264Decoder.readyPromise = FfmpegH264Decoder.init();
        }
        return FfmpegH264Decoder.readyPromise;
    }

    static async loadWasm() {
        if (isWasmVideoSupported()) {
            return new Promise(async (resolve, reject) => {
                assetManager.loadBundle("wasm", (err, bundle) => {
                    if (err) {
                        console.error(err);
                        reject(err)
                    }
                    else {
                        bundle.load("libav_h264", (err: any, asset: Asset) => {
                            if (err) {
                                console.error(err);
                                reject(err)
                            }
                            else {
                                FfmpegH264Decoder.LIBAV_H264_WASM_PATH = asset.nativeUrl
                                FfmpegH264Decoder.LIBAV_H264_WASM_BUFFER = asReadableBuffer(asset.nativeAsset)
                                console.log(FfmpegH264Decoder.LIBAV_H264_WASM_PATH, "获取的路径")
                                resolve(asset)
                            }
                        });
                    }
                })
            })
        } else {
            console.log("当前仅微信开发者工具/PC端微信小程序时加载Wasm")
        }
    }

    private static async init(): Promise<void> {
        //const wasmBinary = await loadNativeBinaryByUuid(LIBAV_H264_WASM_UUID, ['.wasm']);
        FfmpegH264Decoder.module = await createLibavModule(this.LIBAV_H264_WASM_BUFFER);
        console.info('[FfmpegH264Decoder] ready (libav decode_rgb + batch, RGB888)');
    }

    private static requireModule(): LibavH264Module {
        const mod = FfmpegH264Decoder.module;
        if (!mod) {
            throw new Error('FfmpegH264Decoder: module not initialized');
        }
        return mod;
    }

    /** 创建长生命周期会话（实时 / 环形缓冲） */
    static async createSession(): Promise<FfmpegH264Session> {
        await FfmpegH264Decoder.ensureReady();
        return FfmpegH264Decoder.createSessionSync();
    }

    /** 模块已 ready 时同步建会话（tick 内回绕重建用） */
    static createSessionSync(): FfmpegH264Session {
        return new FfmpegH264Session(FfmpegH264Decoder.requireModule());
    }

    /** 全量解到 YUV（不转 RGB），供预载 YUV 策略 */
    static async decodeAccessUnitsYuv(
        samples: Uint8Array[],
        fps: number,
        duration = 0,
    ): Promise<DecodedVideoData> {
        await FfmpegH264Decoder.ensureReady();
        const session = FfmpegH264Decoder.createSessionSync();
        const yuvFrames: DecodedYuvFrame[] = [];
        let width = 0;
        let height = 0;
        try {
            for (const au of samples) {
                const yuv = session.decodeAccessUnitYuv(au);
                if (!yuv) {
                    continue;
                }
                width = yuv.width;
                height = yuv.height;
                yuvFrames.push(yuv);
            }
        } finally {
            session.release();
        }
        if (yuvFrames.length === 0) {
            throw new Error('FfmpegH264Decoder: no yuv frames decoded');
        }
        const frameCount = yuvFrames.length;
        return {
            width,
            height,
            fps,
            frameCount,
            duration: duration > 0 ? duration : frameCount / fps,
            bytesPerPixel: 3,
            frames: [],
            yuvFrames,
        };
    }

    static async decodeAccessUnits(
        samples: Uint8Array[],
        fps: number,
        outputMode: SoftDecodeOutputMode = 'rgb',
    ): Promise<DecodedVideoData> {
        await FfmpegH264Decoder.ensureReady();
        if (outputMode === 'yuv') {
            return FfmpegH264Decoder.decodeAccessUnitsYuv(samples, fps);
        }
        const session = FfmpegH264Decoder.createSessionSync();
        const frames: Uint8ClampedArray[] = [];
        let width = 0;
        let height = 0;
        const bytesPerPixel = resolveBytesPerPixel(outputMode);

        try {
            let index = 0;
            while (index < samples.length) {
                const batch = session.decodeAccessUnitsRgbBatch(samples, index, BATCH_AU_COUNT);
                index += batch.consumed;
                if (batch.width > 0) {
                    width = batch.width;
                    height = batch.height;
                }
                for (const frame of batch.frames) {
                    frames.push(frame);
                }
                if (batch.consumed <= 0) {
                    break;
                }
            }
        } finally {
            session.release();
        }

        if (frames.length === 0) {
            throw new Error('FfmpegH264Decoder: no frames decoded');
        }

        console.info(
            `[FfmpegH264Decoder] decoded ${frames.length} frames (${width}x${height} @ ${fps}fps, mode=${outputMode}, bpp=${bytesPerPixel})`,
        );

        return {
            width,
            height,
            fps,
            frameCount: frames.length,
            duration: frames.length / fps,
            bytesPerPixel,
            frames,
        };
    }

    static async decodeAccessUnitsStreaming(
        samples: Uint8Array[],
        fps: number,
        duration: number,
        options: StreamingDecodeOptions,
    ): Promise<DecodedVideoData> {
        await FfmpegH264Decoder.ensureReady();
        const session = FfmpegH264Decoder.createSessionSync();
        const frames: Uint8ClampedArray[] = [];
        const yuvFrames: DecodedYuvFrame[] = [];
        const sliceBudgetMs = options.softSliceBudgetMs ?? 5;
        const outputMode = options.outputMode ?? 'rgb';
        const bytesPerPixel = resolveBytesPerPixel(outputMode);
        let width = 0;
        let height = 0;
        let unitIndex = 0;

        const yieldForDecode = (): Promise<void> =>
            new Promise((resolve) => requestAnimationFrame(() => resolve()));

        try {
            while (unitIndex < samples.length) {
                if (options.shouldAbort?.()) {
                    throw new Error('FfmpegH264Decoder: decode aborted');
                }
                const sliceStart = performance.now();
                while (unitIndex < samples.length && performance.now() - sliceStart < sliceBudgetMs) {
                    if (outputMode === 'yuv') {
                        const yuv = session.decodeAccessUnitYuv(samples[unitIndex++]);
                        if (!yuv) {
                            continue;
                        }
                        width = yuv.width;
                        height = yuv.height;
                        yuvFrames.push(yuv);
                        const rgb = session.yuvToRgb(yuv);
                        frames.push(rgb);
                        options.onPictureFrame?.(width, height, frames.length - 1, frames);
                    } else {
                        const batch = session.decodeAccessUnitsRgbBatch(samples, unitIndex, BATCH_AU_COUNT);
                        unitIndex += batch.consumed;
                        if (batch.consumed <= 0) {
                            break;
                        }
                        if (batch.width > 0) {
                            width = batch.width;
                            height = batch.height;
                        }
                        for (const frame of batch.frames) {
                            frames.push(frame);
                            options.onPictureFrame?.(width, height, frames.length - 1, frames);
                        }
                    }
                    if (performance.now() - sliceStart >= sliceBudgetMs) {
                        break;
                    }
                }
                if (unitIndex < samples.length) {
                    await yieldForDecode();
                }
            }
        } finally {
            session.release();
        }

        if (frames.length === 0 && yuvFrames.length === 0) {
            throw new Error('FfmpegH264Decoder: no frames decoded');
        }

        const resolvedDuration = duration > 0 ? duration : Math.max(frames.length, yuvFrames.length) / fps;
        console.info(
            `[FfmpegH264Decoder] streaming decoded ${Math.max(frames.length, yuvFrames.length)} frames (${width}x${height} @ ${fps}fps, mode=${outputMode})`,
        );

        return {
            width,
            height,
            fps,
            frameCount: Math.max(frames.length, yuvFrames.length),
            duration: resolvedDuration,
            bytesPerPixel,
            frames,
            yuvFrames: yuvFrames.length > 0 ? yuvFrames : undefined,
        };
    }
}
