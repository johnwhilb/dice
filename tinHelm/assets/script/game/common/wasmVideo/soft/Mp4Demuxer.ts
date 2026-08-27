/**
 * 渐进式 MP4（ISO BMFF）解封装：提取 H.264 轨，转为 Annex-B access unit。
 *
 * 支持：ftyp + moov + mdat 的标准 MP4，H.264 avc1/avc3 轨。
 * 不支持：fMP4（moof/mdat 分片）、多视频轨、非 H.264 编码。
 * 解码：统一 FFmpeg libav H.264 WASM（已移除 Broadway/avc）。
 */

const START_CODE = new Uint8Array([0, 0, 0, 1]);
const SVP1_MAGIC = 0x31505653; // 'SVP1' — 拒绝误传入的 .bin
const FTYP_MAGIC = 0x66747970; // 'ftyp'

export interface Mp4ParseResult {
    fps: number;
    h264: ArrayBuffer;
    /** avcC 中的 profile_idc，66=Baseline，77=Main，100=High */
    profileIdc: number;
    width: number;
    height: number;
    frameCount: number;
    duration: number;
    /** 每个 MP4 sample 对应一个 Access Unit（Annex-B） */
    samples: Uint8Array[];
}

interface BoxNode {
    type: string;
    start: number;
    size: number;
    header: number;
    children: BoxNode[];
}

interface SampleTable {
    sampleSizes: number[];
    chunkOffsets: number[];
    samplesPerChunk: number[];
    firstChunk: number[];
    sampleDeltas: number[];
    syncSamples: number[];
}

interface VideoTrackInfo {
    timescale: number;
    width: number;
    height: number;
    profileIdc: number;
    sps: Uint8Array;
    pps: Uint8Array;
    nalLengthSize: number;
    table: SampleTable;
}

function readType(data: Uint8Array, offset: number): string {
    return String.fromCharCode(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    );
}

function parseBoxes(data: Uint8Array, start: number, end: number): BoxNode[] {
    const boxes: BoxNode[] = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = start;
    while (offset + 8 <= end) {
        let size = view.getUint32(offset);
        const type = readType(data, offset + 4);
        let header = 8;
        if (size === 1) {
            if (offset + 16 > end) {
                break;
            }
            size = Number(view.getBigUint64(offset + 8));
            header = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < header || offset + size > end) {
            break;
        }
        const payloadStart = offset + header;
        const payloadEnd = offset + size;
        const containerTypes = new Set([
            'moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'meta', 'ilst',
        ]);
        const node: BoxNode = {
            type,
            start: offset,
            size,
            header,
            children: containerTypes.has(type)
                ? parseBoxes(data, payloadStart, payloadEnd)
                : [],
        };
        boxes.push(node);
        offset += size;
    }
    return boxes;
}

function findBoxes(boxes: BoxNode[], type: string): BoxNode[] {
    const found: BoxNode[] = [];
    for (const box of boxes) {
        if (box.type === type) {
            found.push(box);
        }
        if (box.children.length > 0) {
            found.push(...findBoxes(box.children, type));
        }
    }
    return found;
}

function findFirstBox(boxes: BoxNode[], type: string): BoxNode | null {
    for (const box of boxes) {
        if (box.type === type) {
            return box;
        }
        const child = findFirstBox(box.children, type);
        if (child) {
            return child;
        }
    }
    return null;
}

function readVersionFlags(data: Uint8Array, offset: number): { version: number; flags: number; body: number } {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const version = view.getUint8(offset);
    const flags = (view.getUint8(offset + 1) << 16)
        | (view.getUint8(offset + 2) << 8)
        | view.getUint8(offset + 3);
    return { version, flags, body: offset + 4 };
}

function readUint32(data: Uint8Array, offset: number): number {
    return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function readUint16(data: Uint8Array, offset: number): number {
    return (data[offset] << 8) | data[offset + 1];
}

function readFixedPoint1616(data: Uint8Array, offset: number): number {
    return readUint32(data, offset) / 65536;
}

function parseMdhd(data: Uint8Array, box: BoxNode): number {
    const { version, body } = readVersionFlags(data, box.start + box.header);
    if (version === 1) {
        return readUint32(data, body + 16);
    }
    return readUint32(data, body + 8);
}

function parseTkhd(data: Uint8Array, box: BoxNode): { width: number; height: number } {
    const { version, body } = readVersionFlags(data, box.start + box.header);
    const dimOffset = version === 1 ? body + 84 : body + 72;
    return {
        width: Math.round(readFixedPoint1616(data, dimOffset)),
        height: Math.round(readFixedPoint1616(data, dimOffset + 4)),
    };
}

function parseHdlr(data: Uint8Array, box: BoxNode): string {
    const body = box.start + box.header + 4;
    return readType(data, body + 4);
}

function parseAvcC(data: Uint8Array, offset: number, size: number): {
    profileIdc: number;
    sps: Uint8Array;
    pps: Uint8Array;
    nalLengthSize: number;
} {
    const end = offset + size;
    let pos = offset + 6;
    const profileIdc = data[offset + 1];
    const nalLengthSize = (data[offset + 4] & 0x03) + 1;
    const spsCount = data[offset + 5] & 0x1f;
    const spsList: Uint8Array[] = [];
    for (let i = 0; i < spsCount && pos + 2 <= end; i++) {
        const len = readUint16(data, pos);
        pos += 2;
        spsList.push(data.subarray(pos, pos + len));
        pos += len;
    }
    if (pos >= end) {
        throw new Error('Mp4Demuxer: avcC missing PPS');
    }
    const ppsCount = data[pos];
    pos += 1;
    const ppsList: Uint8Array[] = [];
    for (let i = 0; i < ppsCount && pos + 2 <= end; i++) {
        const len = readUint16(data, pos);
        pos += 2;
        ppsList.push(data.subarray(pos, pos + len));
        pos += len;
    }
    if (spsList.length === 0 || ppsList.length === 0) {
        throw new Error('Mp4Demuxer: avcC SPS/PPS missing');
    }
    return { profileIdc, sps: spsList[0], pps: ppsList[0], nalLengthSize };
}

function parseStsd(data: Uint8Array, box: BoxNode): {
    profileIdc: number;
    sps: Uint8Array;
    pps: Uint8Array;
    nalLengthSize: number;
} {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        const entrySize = readUint32(data, pos);
        const entryType = readType(data, pos + 4);
        if (entryType === 'avc1' || entryType === 'avc3') {
            let scan = pos + 8 + 78;
            const entryEnd = pos + entrySize;
            while (scan + 8 <= entryEnd) {
                const childSize = readUint32(data, scan);
                const childType = readType(data, scan + 4);
                if (childType === 'avcC') {
                    return parseAvcC(data, scan + 8, childSize - 8);
                }
                scan += childSize > 0 ? childSize : 8;
            }
            throw new Error('Mp4Demuxer: avc1 entry without avcC');
        }
        pos += entrySize;
    }
    throw new Error('Mp4Demuxer: no avc1/avc3 sample entry');
}

function parseStts(data: Uint8Array, box: BoxNode): number[] {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    const deltas: number[] = [];
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        const sampleCount = readUint32(data, pos);
        const sampleDelta = readUint32(data, pos + 4);
        for (let j = 0; j < sampleCount; j++) {
            deltas.push(sampleDelta);
        }
        pos += 8;
    }
    return deltas;
}

function parseStss(data: Uint8Array, box: BoxNode): number[] {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    const syncSamples: number[] = [];
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        syncSamples.push(readUint32(data, pos) - 1);
        pos += 4;
    }
    return syncSamples;
}

function parseStsc(data: Uint8Array, box: BoxNode): { firstChunk: number[]; samplesPerChunk: number[] } {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    const firstChunk: number[] = [];
    const samplesPerChunk: number[] = [];
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        firstChunk.push(readUint32(data, pos));
        samplesPerChunk.push(readUint32(data, pos + 4));
        pos += 12;
    }
    return { firstChunk, samplesPerChunk };
}

function parseStsz(data: Uint8Array, box: BoxNode): number[] {
    const payload = box.start + box.header;
    const sampleSize = readUint32(data, payload + 4);
    const sampleCount = readUint32(data, payload + 8);
    if (sampleSize !== 0) {
        return Array.from({ length: sampleCount }, () => sampleSize);
    }
    const sizes: number[] = [];
    let pos = payload + 12;
    for (let i = 0; i < sampleCount; i++) {
        sizes.push(readUint32(data, pos));
        pos += 4;
    }
    return sizes;
}

function parseStco(data: Uint8Array, box: BoxNode): number[] {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    const offsets: number[] = [];
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        offsets.push(readUint32(data, pos));
        pos += 4;
    }
    return offsets;
}

function parseCo64(data: Uint8Array, box: BoxNode): number[] {
    const payload = box.start + box.header;
    const entryCount = readUint32(data, payload + 4);
    const offsets: number[] = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let pos = payload + 8;
    for (let i = 0; i < entryCount; i++) {
        offsets.push(Number(view.getBigUint64(pos)));
        pos += 8;
    }
    return offsets;
}

function buildSampleOffsets(table: SampleTable): number[] {
    const { sampleSizes, chunkOffsets, samplesPerChunk, firstChunk } = table;
    const sampleOffsets: number[] = [];
    let sampleIndex = 0;
    for (let chunkIndex = 0; chunkIndex < chunkOffsets.length; chunkIndex++) {
        const chunkNumber = chunkIndex + 1;
        let entryIndex = firstChunk.length - 1;
        for (let i = 0; i < firstChunk.length; i++) {
            if (chunkNumber >= firstChunk[i]) {
                entryIndex = i;
            }
        }
        const perChunk = samplesPerChunk[entryIndex];
        let offset = chunkOffsets[chunkIndex];
        for (let j = 0; j < perChunk && sampleIndex < sampleSizes.length; j++) {
            sampleOffsets.push(offset);
            offset += sampleSizes[sampleIndex];
            sampleIndex += 1;
        }
    }
    return sampleOffsets;
}

function sampleToAnnexB(sample: Uint8Array, nalLengthSize: number): Uint8Array {
    const parts: Uint8Array[] = [];
    let offset = 0;
    while (offset + nalLengthSize <= sample.length) {
        let nalLen = 0;
        for (let i = 0; i < nalLengthSize; i++) {
            nalLen = (nalLen << 8) | sample[offset + i];
        }
        offset += nalLengthSize;
        if (nalLen <= 0 || offset + nalLen > sample.length) {
            break;
        }
        const annexB = new Uint8Array(4 + nalLen);
        annexB.set(START_CODE, 0);
        annexB.set(sample.subarray(offset, offset + nalLen), 4);
        parts.push(annexB);
        offset += nalLen;
    }
    if (parts.length === 0) {
        return sample;
    }
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const part of parts) {
        out.set(part, pos);
        pos += part.length;
    }
    return out;
}

function prependParameterSets(sps: Uint8Array, pps: Uint8Array): Uint8Array {
    const out = new Uint8Array(8 + sps.length + pps.length);
    out.set(START_CODE, 0);
    out.set(sps, 4);
    out.set(START_CODE, 4 + sps.length);
    out.set(pps, 8 + sps.length);
    return out;
}

function estimateFps(sampleDeltas: number[], timescale: number, defaultFps: number): number {
    if (sampleDeltas.length === 0 || timescale <= 0) {
        return defaultFps;
    }
    const delta = sampleDeltas[0];
    if (delta <= 0) {
        return defaultFps;
    }
    const fps = Math.round(timescale / delta);
    return fps > 0 ? fps : defaultFps;
}

function parseVideoTrack(data: Uint8Array, trak: BoxNode): VideoTrackInfo | null {
    const mdia = findFirstBox(trak.children, 'mdia');
    if (!mdia) {
        return null;
    }
    const hdlr = findFirstBox(mdia.children, 'hdlr');
    if (!hdlr || parseHdlr(data, hdlr) !== 'vide') {
        return null;
    }
    const mdhd = findFirstBox(mdia.children, 'mdhd');
    const tkhd = findFirstBox(trak.children, 'tkhd');
    const stbl = findFirstBox(mdia.children, 'stbl');
    if (!mdhd || !tkhd || !stbl) {
        return null;
    }
    const stsd = findFirstBox(stbl.children, 'stsd');
    const stts = findFirstBox(stbl.children, 'stts');
    const stsc = findFirstBox(stbl.children, 'stsc');
    const stsz = findFirstBox(stbl.children, 'stsz');
    const stco = findFirstBox(stbl.children, 'stco') ?? findFirstBox(stbl.children, 'co64');
    if (!stsd || !stts || !stsc || !stsz || !stco) {
        return null;
    }
    const codec = parseStsd(data, stsd);
    const { width, height } = parseTkhd(data, tkhd);
    const chunkOffsets = stco.type === 'co64' ? parseCo64(data, stco) : parseStco(data, stco);
    const { firstChunk, samplesPerChunk } = parseStsc(data, stsc);
    const stss = findFirstBox(stbl.children, 'stss');
    return {
        timescale: parseMdhd(data, mdhd),
        width,
        height,
        profileIdc: codec.profileIdc,
        sps: codec.sps,
        pps: codec.pps,
        nalLengthSize: codec.nalLengthSize,
        table: {
            sampleSizes: parseStsz(data, stsz),
            chunkOffsets,
            samplesPerChunk,
            firstChunk,
            sampleDeltas: parseStts(data, stts),
            syncSamples: stss ? parseStss(data, stss) : [0],
        },
    };
}

/**
 * 将 MP4 文件解析为 Annex-B H.264 与帧率。
 * @param buffer - 完整 MP4 文件
 * @param defaultFps - 无法从 stts 推算时的默认帧率
 */
export function parseMp4ToAnnexB(buffer: ArrayBuffer, defaultFps = 24): Mp4ParseResult {
    const data = new Uint8Array(buffer);
    if (data.byteLength < 12) {
        throw new Error('Mp4Demuxer: file too small');
    }
    if (new DataView(buffer).getUint32(0, true) === SVP1_MAGIC) {
        throw new Error('Mp4Demuxer: input is SVP1 .bin — 请指定 MP4 VideoClip，不支持 .bin 格式');
    }
    const hasFtyp = readType(data, 4) === 'ftyp'
        || (data.byteLength >= 8 && readType(data, 0) === 'ftyp')
        || readUint32(data, 4) === FTYP_MAGIC;
    if (!hasFtyp) {
        throw new Error('Mp4Demuxer: not a valid MP4 (missing ftyp box)');
    }

    const root = parseBoxes(data, 0, data.byteLength);
    const moov = findFirstBox(root, 'moov');
    const mdat = findFirstBox(root, 'mdat');
    if (!moov || !mdat) {
        throw new Error('Mp4Demuxer: requires moov + mdat (progressive MP4 only)');
    }

    const traks = findBoxes(moov.children, 'trak');
    let track: VideoTrackInfo | null = null;
    for (const trak of traks) {
        const parsed = parseVideoTrack(data, trak);
        if (parsed) {
            track = parsed;
            break;
        }
    }
    if (!track) {
        throw new Error('Mp4Demuxer: no H.264 video track found');
    }

    const sampleOffsets = buildSampleOffsets(track.table);
    const syncSet = new Set(track.table.syncSamples);
    const paramSets = prependParameterSets(track.sps, track.pps);
    const samples: Uint8Array[] = [];
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < sampleOffsets.length; i++) {
        const size = track.table.sampleSizes[i];
        const offset = sampleOffsets[i];
        if (size <= 0 || offset + size > data.byteLength) {
            continue;
        }
        const sample = data.subarray(offset, offset + size);
        const auParts: Uint8Array[] = [];
        if (syncSet.has(i)) {
            auParts.push(paramSets);
            chunks.push(paramSets);
        }
        const annexB = sampleToAnnexB(sample, track.nalLengthSize);
        auParts.push(annexB);
        chunks.push(annexB);

        const auLen = auParts.reduce((sum, part) => sum + part.length, 0);
        const au = new Uint8Array(auLen);
        let auPos = 0;
        for (const part of auParts) {
            au.set(part, auPos);
            auPos += part.length;
        }
        samples.push(au);
    }

    if (chunks.length === 0) {
        throw new Error('Mp4Demuxer: no video samples extracted');
    }

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const h264 = new Uint8Array(total);
    let pos = 0;
    for (const chunk of chunks) {
        h264.set(chunk, pos);
        pos += chunk.length;
    }

    const fps = estimateFps(track.table.sampleDeltas, track.timescale, defaultFps);
    const frameCount = samples.length;
    const totalTicks = track.table.sampleDeltas.reduce((sum, delta) => sum + delta, 0);
    const duration = track.timescale > 0 ? totalTicks / track.timescale : frameCount / fps;
    return {
        fps,
        h264: h264.buffer,
        profileIdc: track.profileIdc,
        width: track.width,
        height: track.height,
        frameCount,
        duration,
        samples,
    };
}

/** 素材信息：任意 H.264 profile 均可由 libav 解码；体积敏感时可转 Baseline。 */
export function warnBroadwayProfile(profileIdc: number): void {
    if (profileIdc === 66) {
        return;
    }
    const name = profileIdc === 77 ? 'Main' : profileIdc === 100 ? 'High' : `profile ${profileIdc}`;
    console.info(
        `[Mp4Demuxer] ${name} — libav WASM 解码。若需更小体积可转 Baseline：` +
        'ffmpeg -i level1.mp4 -c:v libx264 -profile:v baseline -bf 0 -b:v 500k -an level1.mp4',
    );
}
