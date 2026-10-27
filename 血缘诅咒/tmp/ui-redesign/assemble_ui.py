from pathlib import Path
import hashlib
import json
import struct
import sys
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(r'F:\COCOSproject\dice\血缘诅咒')
sys.path.insert(0, str(ROOT/'tmp/psd-background'))
from add_background import parse, compose_layers

SOURCE = Path(r'C:\Users\Administrator\.codex\generated_images\01a17d6f-e718-7a90-adcc-fcf8fa00e63b\exec-1d0d695e-ee78-4a54-b770-c451a165d64e.png')
PSD = ROOT/'生成界面/苍白之血-大教堂区战斗背景-v01.psd'
OUT = ROOT/'拆分ui/大教堂区战斗界面/v01'
QA = OUT/'验收预览'
MODULES = OUT/'排版模块'
SIZE = (1672, 941)


def white_matte(im):
    rgb = Image.alpha_composite(Image.new('RGBA', SIZE, 'white'), im).convert('RGB')
    return Image.merge('RGBA', (*rgb.split(), im.getchannel('A')))


def enemy_document(info):
    result=dict(info)
    result['records']=[r for r in info['records'] if r['name']!='UI总层（预览稿，文字未拆分）']
    assert len(result['records'])==2 and all('SoLd' in r['tags'] for r in result['records'])
    return result


def prepare():
    ui_source = Image.open(SOURCE).convert('RGBA')
    assert ui_source.size == SIZE
    for directory in (OUT,QA,MODULES):
        directory.mkdir(parents=True,exist_ok=True)
    # Extract already-transparent generated UI modules, never scene rectangles.
    specs = [
        ('顶部信息', (0,0,1672,70), 1.0, (0,0)),
        ('祭司信息', (495,70,846,202), .75, (535,76)),
        ('渔夫信息', (900,70,1258,202), .75, (900,76)),
        ('五枚骰子', (587,432,1087,540), .72, (659,606)),
        ('重投', (414,458,568,537), .72, (540,625)),
        ('抽牌', (1105,458,1262,537), .72, (1045,625)),
        ('圆弧手牌', (390,540,1290,938), .65, None),
        ('玩家信息', (6,655,390,930), .72, (24,733)),
        ('牌堆与道具', (1374,643,1672,834), .85, (1380,696)),
        ('结束回合', (1374,834,1672,935), None, (1416,878)),
    ]
    result=Image.new('RGBA', SIZE)
    coverage=Image.new('L',SIZE)
    coverage_draw=ImageDraw.Draw(coverage)
    layout=[]
    for name,box,scale,position in specs:
        coverage_draw.rectangle((box[0],box[1],box[2]-1,box[3]-1),fill=255)
        tile=ui_source.crop(box)
        material=tile.getchannel('A').point(lambda value:255 if value>2 else 0)
        bounds=material.getbbox()
        assert bounds, name
        bounds=(max(0,bounds[0]-4),max(0,bounds[1]-4),min(tile.width,bounds[2]+4),min(tile.height,bounds[3]+4))
        tile=tile.crop(bounds)
        source_box=[box[0]+bounds[0],box[1]+bounds[1],box[0]+bounds[2],box[1]+bounds[3]]
        if scale is None:
            target=(210,46)
        else:
            target=(round(tile.width*scale),round(tile.height*scale))
        if target!=tile.size:
            tile=tile.resize(target,Image.Resampling.LANCZOS)
        if name=='圆弧手牌':
            position=((SIZE[0]-tile.width)//2,934-tile.height)
        assert position[0]>=0 and position[1]>=0
        assert position[0]+tile.width<=SIZE[0] and position[1]+tile.height<=SIZE[1]
        tile.save(MODULES/(name+'.png'))
        result.alpha_composite(tile,position)
        layout.append(dict(name=name,file='排版模块/'+name+'.png',x=position[0],y=position[1],width=tile.width,height=tile.height,source_box=source_box))
    stray=ImageChops.multiply(ui_source.getchannel('A'),ImageChops.invert(coverage))
    # Outside the separated modules the generator left only alpha 1/2 noise.
    # Do not threshold component pixels: their antialiasing is kept intact.
    assert stray.getextrema()[1]<=2, stray.getbbox()
    assert result.crop((350,190,1300,605)).getchannel('A').getbbox() is None
    result.save(OUT/'UI总层.png')
    source_data=PSD.read_bytes()
    info=parse(source_data)
    enemies_info=enemy_document(info)
    enemies=compose_layers(enemies_info)
    original_preview=Image.open(PSD).convert('RGBA')
    delta=ImageChops.difference(white_matte(compose_layers(info)).convert('RGB'),original_preview.convert('RGB'))
    assert max(hi for lo,hi in delta.getextrema())<=2
    composite=Image.alpha_composite(enemies,result)
    composite.save(ROOT/'生成界面/苍白之血-渔村战斗界面-v01.png')
    Image.alpha_composite(Image.new('RGBA',SIZE,(52,53,58,255)),composite).save(OUT/'复原预览.png')
    for name,color in [('white',(245,244,240,255)),('dark',(45,46,51,255))]:
        Image.alpha_composite(Image.new('RGBA',SIZE,color),result).save(QA/(name+'.png'))
    check=Image.new('RGBA',SIZE,(200,200,200,255))
    draw=ImageDraw.Draw(check)
    for y in range(0,SIZE[1],24):
        for x in range(0,SIZE[0],24):
            if (x//24+y//24)%2==0:
                draw.rectangle((x,y,x+23,y+23),fill=(155,155,155,255))
    Image.alpha_composite(check,result).save(QA/'checker.png')
    white=Image.open(QA/'white.png')
    for name,box in [('top_edges',(490,60,1210,178)),('portrait_edges',(15,720,330,925)),('dice_edges',(640,600,1260,690)),('card_edges',(440,670,1240,940))]:
        crop=white.crop(box)
        crop.resize((crop.width*2,crop.height*2),Image.Resampling.NEAREST).save(QA/(name+'.png'))
    state=dict(canvas=list(SIZE),source_generated_image=str(SOURCE),source_psd_sha256=hashlib.sha256(source_data).hexdigest(),modules=layout,
               text_status='PNG栅格文字；未拆分为Photoshop可编辑文字层。',font=None,
               enemy_layers=[dict(name=r['name'],box=r['box'],sha256=hashlib.sha256(r['record']+b''.join(raw for cid,raw in r['channel_data'])).hexdigest()) for r in enemies_info['records']])
    (OUT/'文字与布局.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(layout,ensure_ascii=False))


def commit():
    state=json.loads((OUT/'文字与布局.json').read_text(encoding='utf-8'))
    original=PSD.read_bytes()
    assert hashlib.sha256(original).hexdigest()==state['source_psd_sha256'], 'PSD changed after layout inspection'
    info=parse(original)
    enemies_info=enemy_document(info)
    ui=Image.open(OUT/'UI总层.png').convert('RGBA')
    assert ui.size==SIZE
    name='UI总层（预览稿，文字未拆分）'
    legacy=b'UI preview - raster text'
    pascal=bytes([len(legacy)])+legacy
    pascal+=b'\x00'*(-len(pascal)%4)
    uni=name.encode('utf-16be')
    unicode_block=struct.pack('>I',len(uni)//2)+uni
    extra=b'\x00'*8+pascal+b'8BIMluni'+struct.pack('>I',len(unicode_block))+unicode_block
    extra+=b'\x00'*(len(extra)%2)
    channels=[(cid,b'\x00\x00'+band.tobytes()) for cid,band in zip((0,1,2,-1),ui.split())]
    record=struct.pack('>iiiiH',0,0,SIZE[1],SIZE[0],4)
    record+=b''.join(struct.pack('>hI',cid,len(raw)) for cid,raw in channels)
    record+=b'8BIMnorm'+bytes([255,0,0,0])+struct.pack('>I',len(extra))+extra
    count=-(len(enemies_info['records'])+1)
    layers=struct.pack('>h',count)+b''.join(r['record'] for r in enemies_info['records'])+record
    layers+=b''.join(raw for r in enemies_info['records'] for cid,raw in r['channel_data'])
    layers+=b''.join(raw for cid,raw in channels)
    layers+=b'\x00'*(len(layers)%2)
    section=struct.pack('>I',len(layers))+layers+info['global_tail']
    composed=Image.alpha_composite(compose_layers(enemies_info),ui)
    matte=white_matte(composed)
    merged=b'\x00\x00'+b''.join(band.tobytes() for band in matte.split())
    encoded=original[:info['section_start']]+struct.pack('>I',len(section))+section+merged
    candidate=ROOT/'tmp/ui-redesign/verified.psd'
    candidate.write_bytes(encoded)
    reread=parse(encoded)
    assert len(reread['records'])==3
    for old,new in zip(enemies_info['records'],reread['records']):
        assert old['record']==new['record'] and old['channel_data']==new['channel_data']
    rebuilt=compose_layers(reread)
    assert ImageChops.difference(rebuilt,composed).getbbox() is None
    assert ImageChops.difference(Image.open(candidate).convert('RGBA'),matte).getbbox() is None
    # PSD itself is independently reconstructed from its four encoded channels per layer.
    Image.alpha_composite(Image.new('RGBA',SIZE,(52,53,58,255)),rebuilt).save(OUT/'复原预览.png')
    candidate.replace(PSD)
    print('PSD updated; both enemy smart-object records/channel bytes preserved exactly; no background added.')


if __name__=='__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv)>1 and sys.argv[1]=='commit':
        commit()
    else:
        prepare()
