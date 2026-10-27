from pathlib import Path
import struct
import sys
import zlib
from PIL import Image, ImageChops


def u16(data, offset):
    return struct.unpack_from('>H', data, offset)[0]


def u32(data, offset):
    return struct.unpack_from('>I', data, offset)[0]


def parse(data):
    assert data[:6] == b'8BPS\x00\x01'
    channels, height, width, depth, mode = struct.unpack_from('>HIIHH', data, 12)
    assert depth == 8 and mode == 3
    offset = 26
    for _ in range(2):
        offset += 4 + u32(data, offset)
    section_start = offset
    section_end = offset + 4 + u32(data, offset)
    info_start = offset + 4
    info_end = info_start + 4 + u32(data, info_start)
    count = struct.unpack_from('>h', data, info_start + 4)[0]
    offset = info_start + 6
    records = []
    for _ in range(abs(count)):
        start = offset
        top, left, bottom, right, nc = struct.unpack_from('>iiiiH', data, offset)
        offset += 18
        channel_info = []
        for _ in range(nc):
            cid, length = struct.unpack_from('>hI', data, offset)
            channel_info.append((cid, length))
            offset += 6
        assert data[offset:offset+4] == b'8BIM'
        blend = data[offset+4:offset+8]
        opacity, clipping, flags, filler = data[offset+8:offset+12]
        extra_size = u32(data, offset+12)
        extra_start = offset+16
        offset = extra_start
        offset += 4 + u32(data, offset)
        offset += 4 + u32(data, offset)
        name_len = data[offset]
        name_raw = data[offset+1:offset+1+name_len]
        try:
            name = name_raw.decode('gbk')
        except UnicodeDecodeError:
            name = name_raw.decode('latin1')
        offset += (name_len + 1 + 3) // 4 * 4
        tags = []
        while offset + 12 <= extra_start + extra_size:
            sig, key = data[offset:offset+4], data[offset+4:offset+8]
            if sig not in (b'8BIM', b'8B64'):
                break
            length = u32(data, offset+8)
            payload = data[offset+12:offset+12+length]
            tags.append(key.decode('ascii', 'replace'))
            if key == b'luni':
                name = payload[4:4+u32(payload, 0)*2].decode('utf-16be')
            offset += 12 + length + length % 2
        offset = extra_start + extra_size
        records.append(dict(name=name, box=(left, top, right, bottom),
                            channels=channel_info, blend=blend,
                            opacity=opacity, flags=flags, tags=tags,
                            record=data[start:offset]))
    records_end = offset
    for record in records:
        record['channel_data'] = []
        for cid, length in record['channels']:
            record['channel_data'].append((cid, data[offset:offset+length]))
            offset += length
    assert offset <= info_end and info_end-offset <= 1
    return dict(width=width, height=height, channels=channels, count=count,
                section_start=section_start, section_end=section_end,
                info_end=info_end, records=records, records_end=records_end,
                global_tail=data[info_end:section_end])


def decode_channel(data, width, height):
    compression = u16(data, 0)
    if compression == 0:
        raw = data[2:]
    elif compression == 1:
        sizes = struct.unpack_from('>'+'H'*height, data, 2)
        offset = 2 + 2*height
        out = bytearray()
        for size in sizes:
            row = data[offset:offset+size]
            offset += size
            pos = 0
            decoded = bytearray()
            while pos < len(row):
                control = row[pos]
                pos += 1
                if control <= 127:
                    decoded.extend(row[pos:pos+control+1])
                    pos += control+1
                elif control >= 129:
                    decoded.extend(row[pos:pos+1]*(257-control))
                    pos += 1
            assert len(decoded) == width
            out.extend(decoded)
        raw = bytes(out)
    elif compression == 2:
        raw = zlib.decompress(data[2:])
    else:
        raise ValueError(f'Unsupported compression {compression}')
    assert len(raw) == width*height
    return Image.frombytes('L', (width, height), raw)


def compose_layers(info):
    canvas = Image.new('RGBA', (info['width'], info['height']))
    for record in info['records']:
        if record['flags'] & 2:
            continue
        assert record['blend'] == b'norm' and record['opacity'] == 255
        left, top, right, bottom = record['box']
        bands = {cid:decode_channel(raw, right-left, bottom-top)
                 for cid,raw in record['channel_data'] if cid in (-1,0,1,2)}
        alpha = bands.get(-1, Image.new('L', (right-left,bottom-top),255))
        layer = Image.merge('RGBA', [bands[0],bands[1],bands[2],alpha])
        canvas.alpha_composite(layer, (left,top))
    return canvas


def add_background(source, background, output, preview):
    original = source.read_bytes()
    info = parse(original)
    bg = Image.open(background).convert('RGBA')
    assert bg.size == (info['width'],info['height']), bg.size
    assert bg.getchannel('A').getextrema() == (255,255)
    # Source records and encoded channel bytes are retained verbatim.
    base = compose_layers(info)
    original_merged = Image.open(source).convert('RGBA')
    # Photoshop stores this document's merged RGB against a white matte,
    # alongside its independent transparency channel. Compare in that space.
    base_visible = Image.alpha_composite(Image.new('RGBA',base.size,'white'),base).convert('RGB')
    visible_delta = ImageChops.difference(base_visible,original_merged.convert('RGB'))
    print('source_layer_vs_merged_extrema',visible_delta.getextrema())
    assert max(hi for lo,hi in visible_delta.getextrema()) <= 2
    assert ImageChops.difference(base.getchannel('A'),original_merged.getchannel('A')).getbbox() is None
    w,h = bg.size
    blobs = [(cid,b'\x00\x00'+band.tobytes()) for cid,band in zip((0,1,2,-1),bg.split())]
    name = '渔村战斗背景'
    pascal = b'Fishing village background'
    name_field = bytes([len(pascal)])+pascal
    name_field += b'\x00' * (-len(name_field)%4)
    utf16 = name.encode('utf-16be')
    uni = struct.pack('>I',len(utf16)//2)+utf16
    uni += b'\x00' * (len(uni)%2)
    extra = b'\x00'*8 + name_field + b'8BIMluni'+struct.pack('>I',len(uni))+uni
    record = struct.pack('>iiiiH',0,0,h,w,4)
    record += b''.join(struct.pack('>hI',cid,len(blob)) for cid,blob in blobs)
    record += b'8BIMnorm'+bytes([255,0,0,0])+struct.pack('>I',len(extra))+extra
    new_count = (abs(info['count'])+1) * (-1 if info['count']<0 else 1)
    layer_info = struct.pack('>h',new_count)
    layer_info += record + b''.join(r['record'] for r in info['records'])
    layer_info += b''.join(blob for cid,blob in blobs)
    layer_info += b''.join(blob for r in info['records'] for cid,blob in r['channel_data'])
    layer_info += b'\x00' * (len(layer_info)%2)
    section = struct.pack('>I',len(layer_info))+layer_info+info['global_tail']
    final = Image.alpha_composite(bg,base)
    merged = b'\x00\x00'+b''.join(band.tobytes() for band in final.split()[:info['channels']])
    updated = original[:info['section_start']]+struct.pack('>I',len(section))+section+merged
    output.write_bytes(updated)
    reread = parse(updated)
    for old,new in zip(info['records'],reread['records'][1:]):
        assert old['record']==new['record'] and old['channel_data']==new['channel_data']
    rebuilt = compose_layers(reread)
    reopened_merged = Image.open(output).convert('RGBA')
    assert ImageChops.difference(rebuilt,final).getbbox() is None
    assert ImageChops.difference(reopened_merged,final).getbbox() is None
    rebuilt.save(preview)
    print('verified',len(reread['records']),'layers',bg.size)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if sys.argv[1] == '--inspect':
        document = parse(Path(sys.argv[2]).read_bytes())
        print({k:v for k,v in document.items() if k not in ('records','global_tail')})
        for layer in document['records']:
            print({k:v for k,v in layer.items() if k not in ('record','channel_data')})
        tail = document['global_tail']
        print('tail_start',repr(tail[:48]))
    else:
        add_background(*map(Path,sys.argv[1:5]))
