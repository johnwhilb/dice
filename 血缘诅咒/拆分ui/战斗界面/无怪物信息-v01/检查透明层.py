"""只检查图片、生成验收预览并复制原始 RGBA，不修图。"""
from pathlib import Path
import json
import shutil
import sys
from PIL import Image, ImageDraw
import numpy as np

out = Path(__file__).resolve().parent
src = Path(sys.argv[1])
im = Image.open(src).convert('RGBA')
dest = out / 'UI总层.png'
if src.resolve() != dest.resolve():
    shutil.copy2(src, dest)
w, h = im.size
a = np.array(im.getchannel('A'))
report = {'size': [w,h], 'expected_size': [1672,941], 'source': str(src),
          'mode': Image.open(src).mode, 'alpha_min': int(a.min()), 'alpha_max': int(a.max()),
          'transparent_pixels': int((a==0).sum()), 'partial_alpha_pixels': int(((a>0)&(a<255)).sum()),
          'opaque_pixels': int((a==255).sum())}
vals, counts = np.unique(a,return_counts=True)
report['alpha_histogram'] = {str(int(v)):int(n) for v,n in zip(vals,counts)}
# 图片2区分原位坐标检查与主观的画风/文字检查。
regions = {'上方中央战斗区': (300,60,1370,450), '左怪物信息区': (325,80,550,265),
           '右怪物信息区': (1130,80,1365,265), '顶部敌人数文字区': (1375,8,1475,36)}
report['region_nonzero_alpha'] = {k:int((a[y0:y1,x0:x1]>0).sum()) for k,(x0,y0,x1,y1) in regions.items()} if (w,h)==(1672,941) else {}
(out/'透明检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
for name, color in [('白底',(255,255,255,255)), ('深灰底',(51,51,51,255)), ('棋盘底',None)]:
    bg = Image.new('RGBA',im.size,color or (210,210,210,255))
    if color is None:
        d=ImageDraw.Draw(bg)
        for y in range(0,h,24):
            for x in range(0,w,24):
                if (x//24+y//24)%2: d.rectangle((x,y,x+23,y+23),fill=(164,164,164,255))
    Image.alpha_composite(bg,im).convert('RGB').save(out/(name+'检查.png'))
    if color is None:
        preview=Image.alpha_composite(bg,im).convert('RGB')
        boxes=[(10,535,310,880),(380,450,1120,610),(385,595,660,941),(1310,625,1672,920)]
        panels=[]
        for box in boxes:
            crop=preview.crop(box)
            crop=crop.resize((crop.width*2,crop.height*2))
            panels.append(crop)
        sheet=Image.new('RGB',(max(p.width for p in panels),sum(p.height for p in panels)),(128,128,128))
        yy=0
        for panel in panels: sheet.paste(panel,(0,yy)); yy+=panel.height
        sheet.save(out/'边缘放大检查.png')
print(json.dumps(report,ensure_ascii=True))
