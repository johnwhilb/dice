"""Deterministic alpha trimming, layout metadata, composition and QA; no generated art."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, shutil, zipfile

ROOT=Path(__file__).resolve().parent
layout=json.loads((ROOT/'references/source-layout.json').read_text(encoding='utf-8'))
W,H=layout['width'],layout['height']
bg=Image.open(ROOT/'raw/background.png').convert('RGB')
if bg.size!=(W,H):
    bg=bg.resize((W,H),Image.Resampling.LANCZOS)
background=ROOT/'backgrounds/background-paper-tree.png'
bg.save(background)
canvas=bg.convert('RGBA')
world_layer=Image.new('RGBA',(W,H),(0,0,0,0))
items=[]
checks=[]
for spec in layout['worlds']:
    ident=spec['id']
    image=Image.open(ROOT/'raw'/f'{ident}.png').convert('RGBA')
    a=image.getchannel('A')
    amin,amax=a.getextrema()
    assert amin==0 and amax>=240, f'{ident}: missing true transparency or solid scene'
    mask=a.point(lambda v:255 if v>=3 else 0)
    bbox=mask.getbbox()
    assert bbox, f'{ident}: empty image'
    edge_touch=bbox[0]==0 or bbox[1]==0 or bbox[2]==image.width or bbox[3]==image.height
    assert not edge_touch, f'{ident}: artwork touches raw edge, inspect/regenerate'
    # Remove sub-1% alpha noise only; preserve visible semi-transparent fog/smoke.
    a=a.point(lambda v:0 if v<3 else v)
    image.putalpha(a)
    actual=a.getbbox()
    trimmed=image.crop(actual)
    guard=12
    final=Image.new('RGBA',(trimmed.width+guard*2,trimmed.height+guard*2),(0,0,0,0))
    final.alpha_composite(trimmed,(guard,guard))
    out=ROOT/'worlds'/f'{ident}.png'
    final.save(out)
    x0,y0,x1,y1=spec['referenceCrop']
    factor=min((x1-x0-16)/final.width,(y1-y0-16)/final.height)
    rw,rh=round(final.width*factor),round(final.height*factor)
    x=round((x0+x1-rw)/2)
    y=round((y0+y1-rh)/2)
    rendered=final.resize((rw,rh),Image.Resampling.LANCZOS)
    canvas.alpha_composite(rendered,(x,y))
    world_layer.alpha_composite(rendered,(x,y))
    hist=a.histogram()
    info=dict(id=ident,name=spec['name'],image=f'worlds/{ident}.png',
              source=f'raw/{ident}.png',prompt=f'prompts/{ident}.prompt.txt',
              nativeSize={'width':final.width,'height':final.height},
              sourceCrop=list(actual),transparentGuard=guard,layer='worlds',
              x=x,y=y,w=rw,h=rh,anchor='top-left',
              centerBottom={'x':x+rw/2,'y':y+rh},
              sortY=y+rh,occlusionClass='tall',occupantPolicy={'mode':'none'},
              interactiveBounds={'x':x,'y':y,'w':rw,'h':rh},
              sha256=hashlib.sha256(out.read_bytes()).hexdigest())
    items.append(info)
    if ident=='muspelheim':
        info['postPrompt']='prompts/muspelheim-edge-repair.prompt.txt'
    checks.append(dict(id=ident,mode=final.mode,alphaMin=amin,alphaMax=amax,
                       transparentPixelFraction=round(hist[0]/(image.width*image.height),4),
                       edgeTouch=edge_touch,nativeSize=list(final.size)))

canvas.convert('RGB').save(ROOT/'preview.png')
world_layer.save(ROOT/'worlds-layer.png')
font_path=Path('C:/Windows/Fonts/simkai.ttf')
font=ImageFont.truetype(str(font_path),30) if font_path.exists() else ImageFont.load_default()
small=ImageFont.truetype(str(font_path),20) if font_path.exists() else ImageFont.load_default()
cell_w,cell_h=640,440
contact=Image.new('RGBA',(cell_w*3,cell_h*3),(241,236,222,255))
draw=ImageDraw.Draw(contact)
for i,item in enumerate(items):
    col,row=i%3,i//3
    left,top=col*cell_w,row*cell_h
    for yy in range(top+58,top+cell_h-12,20):
        for xx in range(left+12,left+cell_w-12,20):
            tone=224 if ((xx-left)//20+(yy-top)//20)%2 else 238
            draw.rectangle((xx,yy,min(xx+19,left+cell_w-13),min(yy+19,top+cell_h-13)),fill=(tone,tone,tone,255))
    draw.text((left+18,top+12),item['name'],font=font,fill=(42,41,33))
    draw.text((left+240,top+22),item['id']+'.png',font=small,fill=(85,84,76))
    image=Image.open(ROOT/item['image']).convert('RGBA')
    image.thumbnail((cell_w-40,cell_h-86),Image.Resampling.LANCZOS)
    contact.alpha_composite(image,(left+(cell_w-image.width)//2,top+64+(cell_h-80-image.height)//2))
contact.convert('RGB').save(ROOT/'contact-sheet.png')

manifest=dict(schema='nine-realms.layered-overworld.v1',map_mode='scene_mode',
              visual_model='layered_raster',runtime_object_model='interactive_scene_objects',
              engine_target='HTML_or_Cocos',collision_model='trigger_zones',
              size={'width':W,'height':H},
              background={'image':'backgrounds/background-paper-tree.png','prompt':'prompts/background.prompt.txt','opaque':True},
              combinedWorldsLayer='worlds-layer.png',
              worlds=items,renderOrder=['background','worlds sorted by sortY'],
              collision={'blockers':[],'reason':'World selection map, no actor navigation.'},
              scene_hooks={'cameraBounds':{'x':0,'y':0,'w':W,'h':H}},
              provenance={'sourceImage':'../nine-realms-explorer/map-nine-realms-ui-free.png',
                          'artSource':'built-in image_gen',
                          'edit':'Separate each world, remove paper background; gently align marker/crayon style; selectively reduce repeated detail by about 10–18%.',
                          'processing':'Remove alpha noise below 3/255, alpha trim, transparent padding, resize for preview, metadata and packaging only.'})
(ROOT/'map-data.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'verification.json').write_text(json.dumps({'worldCount':len(items),'backgroundSize':[W,H],
    'allTrueAlpha':True,'allEdgesClear':True,'checks':checks},ensure_ascii=False,indent=2),encoding='utf-8')
readme='''九界分层素材 · v1

backgrounds/background-paper-tree.png：独立暖纸＋浅世界树背景（1672×941）。
worlds/：九个世界的独立透明 PNG，无 UI、无连接线。
worlds-layer.png：按原图位置排好的九界整层透明 PNG，可与背景直接叠加。
preview.png：依据原图布局合成的预览。
contact-sheet.png：九界透明素材检查图（棋盘格仅在此预览图上）。
map-data.json：世界中文名称、PNG 路径、原生尺寸、合成坐标、锚点和交互区域。
verification.json：透明通道与边缘检查记录。
prompts/：每张图的实际生成提示词，使用内置 image_gen。
raw/：原始生成结果。references/：源图分区参考。

使用方法：背景在底层；按 map-data.json 的 x/y/w/h 放置各世界。
默认 x/y 为左上角坐标；如引擎用底部中心锚点，使用 centerBottom。
所有世界 PNG 均保留 12 像素透明保护边，白雪、白云与遗骨不是被扣空的区域。
灰色迷雾、瀑布、熔岩、云层及周边小浮石属于对应世界图层。
每个世界作为完整岛屿素材；内部建筑尚未单独拆层。

美术调整：保留主体轮廓和主要地标，适度减少重复小叶片、碎石、屋顶细纹等，轻度加强粗黑线和蜡笔笔触。
生成式修整可能使局部细节和边缘与原图略有差异；preview.png 为本包实际合成效果。
'''
(ROOT/'README.txt').write_text(readme,encoding='utf-8')
bundle=ROOT.parent/'nine-realms-layered-v1.zip'
with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for folder in ['worlds','backgrounds','prompts']:
        for p in sorted((ROOT/folder).glob('*')):
            archive.write(p,str(Path(ROOT.name)/p.relative_to(ROOT)))
    for name in ['preview.png','worlds-layer.png','contact-sheet.png','map-data.json','verification.json','README.txt']:
        archive.write(ROOT/name,str(Path(ROOT.name)/name))
print(json.dumps({'worlds':len(items),'background':[W,H],'zip':str(bundle),'checks':'passed'},ensure_ascii=False))
