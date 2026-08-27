import { sys } from "cc";

export type WxWebAssemblyApi = {
    instantiate: (path: string, imports: WebAssembly.Imports) => Promise<{
        instance: WebAssembly.Instance;
        module: WebAssembly.Module;
    }>;
};

export function isRemoteUrl(path: string): boolean {
    return /^https?:\/\//i.test(path);
}

export function normalizeAssetPath(url: string): string {
    return url.trim().split('?')[0];
}

/** 规范化微信包内资源路径（去 query / 前缀斜杠）。 */
export function normalizeWxAssetPath(url: string): string {
    return normalizeAssetPath(url).replace(/^\/+/, '');
}

/** 规范化微信 WASM 路径：仅允许包内 .wasm / .wasm.br。 */
export function normalizeWxWasmPath(url: string): string {
    let path = normalizeWxAssetPath(url);
    if (path.startsWith('wxfile://')) {
        throw new Error(`WXWebAssembly does not support wxfile path: ${path}`);
    }
    if (isRemoteUrl(path)) {
        throw new Error(`WXWebAssembly does not support http path: ${path}`);
    }
    if (!path.endsWith('.wasm') && !path.endsWith('.wasm.br')) {
        throw new Error(`WXWebAssembly requires .wasm path, got "${path}"`);
    }
    return path;
}

export function isWeChatPlatform(): boolean {
    const wxApi = (globalThis as { wx?: { getFileSystemManager?: () => unknown } }).wx;
    return typeof wxApi?.getFileSystemManager === 'function';
}

export function isWxWebAssemblyEnv(): boolean {
    const g = globalThis as { wx?: unknown; WXWebAssembly?: WxWebAssemblyApi };
    return isWeChatPlatform() && !!g.WXWebAssembly;
}

function getWxWasm() {
    return (globalThis as { WXWebAssembly?: WxWebAssemblyApi }).WXWebAssembly;
}

export function cloneBuffer(src: ArrayBuffer): ArrayBuffer {
    const out = new Uint8Array(src.byteLength);
    out.set(new Uint8Array(src));
    return out.buffer;
}

export function viewToArrayBuffer(view: ArrayBufferView): ArrayBuffer {
    const out = new Uint8Array(view.byteLength);
    out.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return out.buffer;
}

export function asReadableBuffer(data: ArrayBuffer | ArrayBufferView | null | undefined): ArrayBuffer | null {
    if (!data) {
        return null;
    }
    if (data instanceof ArrayBuffer) {
        return data.byteLength > 0 ? cloneBuffer(data) : null;
    }
    if (ArrayBuffer.isView(data)) {
        return data.byteLength > 0 ? viewToArrayBuffer(data) : null;
    }
    return null;
}

export function instantiateWasmBinary(
    wasmBinary: ArrayBuffer,
    imports: WebAssembly.Imports,
    packagePath?: string,
): Promise<{ instance: WebAssembly.Instance; module: WebAssembly.Module }> {
    if (isWxWebAssemblyEnv()) {
        if (!packagePath) {
            return Promise.reject(new Error('WeChat wasm package path missing'));
        }
        const wxWasm = getWxWasm();
        if (!wxWasm) {
            return Promise.reject(new Error('WXWebAssembly unavailable'));
        }
        const path = normalizeWxWasmPath(packagePath);
        console.log(`instantiate wasm: ${path}`);
        //微信开发者工具、安卓微信、pc微信
        return wxWasm.instantiate(path, imports);
    }
    return WebAssembly.instantiate(wasmBinary, imports);
}

export async function wxDownloadVideo(url) {
    if (url.startsWith('wxfile://')) {
        return new Promise((resolve, reject) => {
            resolve(url)
        })
    }
    return new Promise((resolve, reject) => {
        wx.downloadFile({
            url,
            success(res) {
                if (res.statusCode !== 200) {
                    reject(new Error(`download failed: ${res.statusCode}`))
                    return
                }
                // res.tempFilePath 形如 wxfile://tmp_xxx.mp4
                console.log(`download success:${url} => ${res.tempFilePath}`)
                resolve(res.tempFilePath)
            },
            fail: reject
        })
    })
}
export async function wxReadVideoAsArrayBuffer(tempFilePath) {
    return new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager()
        fs.readFile({
            filePath: tempFilePath,
            success(res) {
                // res.data: ArrayBuffer
                console.log(`read success:${tempFilePath}`)
                resolve(res.data)
            },
            fail: reject
        })
    })
}

export function isWasmVideoSupported() {
    if (sys.platform == sys.Platform.WECHAT_GAME) {
        const platforms = ["devtools", "windows"];
        const { platform } = wx.getSystemInfoSync();
        return platforms.indexOf(platform) !== -1;
    }
    return false
}