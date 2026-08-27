/**
 * 跨平台 native 资源加载（Web / 编辑器 / 微信小游戏 / 原生）。
 *
 * 核心策略：
 * 1) 优先 uuid -> native url（不依赖 nativeUrl 字段是否存在）；
 * 2) 失败后回退到 asset.nativeUrl / BufferAsset.buffer() / loadAny；
 * 3) 平台读取统一通过读取器分发，微信与原生都走本地文件读取。
 */
import { assetManager, Asset, BufferAsset } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { FfmpegH264Decoder } from './FfmpegH264Decoder';
import { asReadableBuffer, cloneBuffer, isRemoteUrl, isWeChatPlatform, normalizeAssetPath, normalizeWxAssetPath} from './Utils';

type WxFileSystem = { readFileSync: (filePath: string) => ArrayBuffer | ArrayBufferView };

type JsbFileUtils = {
    isFileExist?: (path: string) => boolean;
    getDataFromFile?: (path: string) => ArrayBuffer | ArrayBufferView | null | undefined;
    getStringFromFile?: (path: string) => string | null | undefined;
    fullPathForFilename?: (path: string) => string;
};

type NativeReadSource = 'uuid-url' | 'asset-native-url' | 'asset-buffer' | 'load-any' | 'wx-path-guess';

type PlatformKind = 'wechat-mini-game' | 'native' | 'editor-preview' | 'web';

const DEFAULT_BUNDLE_ORDER = ['bundle', 'resources'];
const loadedWxSubpackages = new Set<string>();

function logTrace(message: string): void {
    console.info(`[NativeAssetLoader] ${message}`);
}

function ensureDotExt(ext: string): string {
    return ext.startsWith('.') ? ext : `.${ext}`;
}

function uniqueStrings(values: string[]): string[] {
    return values.filter((item, index, list) => list.indexOf(item) === index);
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}


function hasFetchApi(): boolean {
    return typeof fetch === 'function';
}

function preferDirectNativeFetch(): boolean {
    return EDITOR || PREVIEW;
}

function detectPlatformKind(): PlatformKind {
    if (isWeChatPlatform()) {
        return 'wechat-mini-game';
    }
    if (isNativeRuntime()) {
        return 'native';
    }
    if (preferDirectNativeFetch()) {
        return 'editor-preview';
    }
    return 'web';
}

export function nativePackagePath(bundleName: string, uuid: string, ext: string): string {
    return `assets/${bundleName}/native/${uuid.slice(0, 2)}/${uuid}${ensureDotExt(ext)}`;
}

function subpackageNativePath(bundleName: string, uuid: string, ext: string): string {
    return `subpackages/${bundleName}/native/${uuid.slice(0, 2)}/${uuid}${ensureDotExt(ext)}`;
}

function wxNativePathCandidates(bundleName: string, uuid: string, ext: string): string[] {
    return [subpackageNativePath(bundleName, uuid, ext), nativePackagePath(bundleName, uuid, ext)];
}


function isNativeRuntime(): boolean {
    const g = globalThis as { jsb?: unknown };
    return !!g.jsb;
}

function getNativeFileUtils(): JsbFileUtils | null {
    const g = globalThis as { jsb?: { fileUtils?: JsbFileUtils } };
    return g.jsb?.fileUtils ?? null;
}

function resolveNativeUrlByUuid(uuid: string, ext: string): string {
    const utils = assetManager.utils;
    if (!utils?.getUrlWithUuid) {
        throw new Error('assetManager.utils.getUrlWithUuid unavailable');
    }
    return utils.getUrlWithUuid(uuid, { nativeExt: ensureDotExt(ext), isNative: true });
}

function readNativeByFetch(url: string): Promise<ArrayBuffer> {
    if (!hasFetchApi()) {
        return Promise.reject(new Error('fetch unavailable'));
    }
    return fetch(url).then(async (response) => {
        if (!response.ok) {
            throw new Error(`${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength <= 0) {
            throw new Error('empty');
        }
        return cloneBuffer(buffer);
    });
}

function readNativeByJsb(path: string): ArrayBuffer {
    const fileUtils = getNativeFileUtils();
    if (!fileUtils) {
        throw new Error('jsb.fileUtils unavailable');
    }

    const normalized = normalizeAssetPath(path);
    const candidates = uniqueStrings([
        normalized,
        normalized.replace(/^\/+/, ''),
        normalized.startsWith('/') ? normalized : `/${normalized}`,
        fileUtils.fullPathForFilename ? fileUtils.fullPathForFilename(normalized.replace(/^\/+/, '')) : '',
    ].filter(Boolean));

    for (const candidate of candidates) {
        try {
            if (fileUtils.isFileExist && !fileUtils.isFileExist(candidate)) {
                continue;
            }
            if (fileUtils.getDataFromFile) {
                const raw = fileUtils.getDataFromFile(candidate);
                const buffer = asReadableBuffer(raw ?? null);
                if (buffer) {
                    return buffer;
                }
            }
        } catch {
            // keep fallback flow
        }
    }
    throw new Error(`native file missing: ${normalized}`);
}

export function readWxPackageBinary(packagePath: string): ArrayBuffer {
    const wxApi = (globalThis as { wx?: { getFileSystemManager: () => WxFileSystem } }).wx;
    if (!wxApi) {
        throw new Error('wx.getFileSystemManager unavailable');
    }

    const normalized = normalizeWxAssetPath(packagePath);
    if (normalized.startsWith('wxfile://') || isRemoteUrl(normalized)) {
        throw new Error(`Wx package read does not support remote path: ${normalized}`);
    }

    for (const candidate of [normalized, `/${normalized}`]) {
        try {
            const data = wxApi.getFileSystemManager().readFileSync(candidate);
            const buffer = asReadableBuffer(data);
            if (buffer) {
                return buffer;
            }
        } catch {
            // try next candidate path
        }
    }
    throw new Error(`file not in wx package: ${normalized}`);
}

async function readNativeByPath(path: string, platform: PlatformKind): Promise<ArrayBuffer> {
    if (platform === 'wechat-mini-game') {
        return readWxPackageBinary(path);
    }
    if (platform === 'native') {
        return readNativeByJsb(path);
    }
    return readNativeByFetch(path);
}

function findBundleNameForUuid(uuid: string): string | null {
    for (const name of DEFAULT_BUNDLE_ORDER) {
        const bundle = assetManager.getBundle(name);
        if (bundle?.getAssetInfo(uuid)) {
            return name;
        }
    }
    return null;
}

function collectBundleCandidates(uuid: string): string[] {
    const primary = findBundleNameForUuid(uuid);
    return primary ? uniqueStrings([primary, ...DEFAULT_BUNDLE_ORDER]) : [...DEFAULT_BUNDLE_ORDER];
}

/** 微信：读取分包 native 前先 loadSubpackage（level / resources 等）。 */
export function ensureWxSubpackage(bundleName: string): Promise<void> {
    if (bundleName === 'main' || loadedWxSubpackages.has(bundleName)) {
        return Promise.resolve();
    }
    const wxApi = (globalThis as {
        wx?: {
            loadSubpackage?: (opts: {
                name: string;
                success?: () => void;
                fail?: (err: unknown) => void;
            }) => unknown;
        };
    }).wx;
    if (!isWeChatPlatform() || !wxApi?.loadSubpackage) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        wxApi.loadSubpackage!({
            name: bundleName,
            success: () => {
                loadedWxSubpackages.add(bundleName);
                resolve();
            },
            fail: reject,
        });
    });
}

async function ensurePathReadyForPlatform(path: string, platform: PlatformKind): Promise<void> {
    if (platform !== 'wechat-mini-game') {
        return;
    }
    const normalized = normalizeWxAssetPath(path);
    if (!normalized.startsWith('subpackages/')) {
        return;
    }
    const bundleName = normalized.split('/')[1];
    if (!bundleName) {
        return;
    }
    await ensureWxSubpackage(bundleName).catch((error) => {
        console.warn(`[NativeAssetLoader] wx.loadSubpackage ${bundleName}`, error);
    });
}

function buildUuidNativePathCandidates(uuid: string, exts: string[], platform: PlatformKind): string[] {
    const directUrls = exts.map((ext) => {
        try {
            return resolveNativeUrlByUuid(uuid, ext);
        } catch {
            return '';
        }
    }).filter(Boolean);

    if (platform !== 'wechat-mini-game') {
        return uniqueStrings(directUrls);
    }

    const guessedPaths: string[] = [];
    for (const bundleName of collectBundleCandidates(uuid)) {
        for (const ext of exts) {
            guessedPaths.push(...wxNativePathCandidates(bundleName, uuid, ext));
        }
    }
    return uniqueStrings([...directUrls, ...guessedPaths]);
}

async function tryReadFromCandidates(
    candidates: string[],
    platform: PlatformKind,
    source: NativeReadSource,
): Promise<{ buffer: ArrayBuffer; path: string }> {
    const errors: string[] = [];
    for (const path of candidates) {
        await ensurePathReadyForPlatform(path, platform);
        try {
            const buffer = await readNativeByPath(path, platform);
            logTrace(`${source} hit | ${path} | ${buffer.byteLength}B`);
            return { buffer, path };
        } catch (error) {
            errors.push(`${path} → ${toErrorMessage(error)}`);
        }
    }
    throw new Error(errors.join('; '));
}

function getAssetNativeUrl(asset: Asset | BufferAsset): string | null {
    const nativeUrl = (asset as { nativeUrl?: string }).nativeUrl;
    return nativeUrl ? normalizeAssetPath(nativeUrl) : null;
}

function readBufferFromBufferAsset(asset: BufferAsset): ArrayBuffer | null {
    try {
        const buffer = asset.buffer();
        return buffer && buffer.byteLength > 0 ? cloneBuffer(buffer) : null;
    } catch {
        return null;
    }
}

function loadAnyByUuid(uuid: string): Promise<BufferAsset> {
    return new Promise((resolve, reject) => {
        assetManager.loadAny({ uuid }, (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`Failed to load asset: ${uuid}`));
                return;
            }
            resolve(asset as BufferAsset);
        });
    });
}

async function readNativeFromAssetLike(
    asset: Asset | BufferAsset,
    uuid: string,
    exts: string[],
    platform: PlatformKind,
): Promise<ArrayBuffer> {
    const errors: string[] = [];

    if (asset instanceof BufferAsset) {
        const direct = readBufferFromBufferAsset(asset);
        if (direct) {
            logTrace(`asset-buffer hit | ${uuid} | ${direct.byteLength}B`);
            return direct;
        }
        errors.push('buffer() empty');
    }

    const nativeUrl = getAssetNativeUrl(asset);
    if (nativeUrl) {
        try {
            await ensurePathReadyForPlatform(nativeUrl, platform);
            const buffer = await readNativeByPath(nativeUrl, platform);
            logTrace(`asset-native-url hit | ${nativeUrl} | ${buffer.byteLength}B`);
            return buffer;
        } catch (error) {
            errors.push(`${nativeUrl} → ${toErrorMessage(error)}`);
        }
    } else {
        errors.push('nativeUrl missing');
    }

    try {
        return await readNativeByUuid(uuid, exts, platform);
    } catch (error) {
        errors.push(`uuid-url → ${toErrorMessage(error)}`);
    }

    throw new Error(`asset-like read failed: ${errors.join('; ')}`);
}

async function readNativeByUuid(uuid: string, exts: string[], platform: PlatformKind): Promise<ArrayBuffer> {
    const candidates = buildUuidNativePathCandidates(uuid, exts, platform);
    if (candidates.length <= 0) {
        throw new Error(`no native path candidates for ${uuid}`);
    }
    if (exts.length == 1 && exts[0] == ".wasm") {
        return FfmpegH264Decoder.LIBAV_H264_WASM_BUFFER;
    } else {
        const result = await tryReadFromCandidates(candidates, platform, 'uuid-url');
        return result.buffer;
    }
}

/**
 * 从 VideoClip / BufferAsset 等读取 native 二进制。
 *
 * 优先级：
 * 1) uuid -> native url；
 * 2) 当前 asset 的 buffer/nativeUrl；
 * 3) loadAny(uuid) 后再走 asset 读取；
 * 4) 最终再试一次 uuid 路径（兜底）。
 */
export async function loadNativeFromAsset(asset: Asset, exts: string[]): Promise<ArrayBuffer> {
    const uuid = asset?.uuid || asset?._uuid;
    if (!uuid) {
        throw new Error('Asset uuid missing');
    }

    const platform = detectPlatformKind();
    const errors: string[] = [];

    try {
        return await readNativeByUuid(uuid, exts, platform);
    } catch (error) {
        errors.push(`uuid-url → ${toErrorMessage(error)}`);
    }

    try {
        return await readNativeFromAssetLike(asset, uuid, exts, platform);
    } catch (error) {
        errors.push(`asset-like → ${toErrorMessage(error)}`);
    }

    try {
        const loaded = await loadAnyByUuid(uuid);
        const viaLoadAny = await readNativeFromAssetLike(loaded, uuid, exts, platform);
        logTrace(`load-any hit | ${uuid} | ${viaLoadAny.byteLength}B`);
        return viaLoadAny;
    } catch (error) {
        errors.push(`load-any → ${toErrorMessage(error)}`);
    }

    try {
        return await readNativeByUuid(uuid, exts, platform);
    } catch (error) {
        errors.push(`uuid-url-retry → ${toErrorMessage(error)}`);
    }

    throw new Error(`loadNativeFromAsset failed for ${uuid}: ${errors.join('; ')}`);
}