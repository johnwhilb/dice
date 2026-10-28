"""复制工具原始输出，仅读取像素并生成验收预览，不修改透明UI素材。"""
from pathlib import Path
import json, shutil, sys
import numpy as np
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
out=root/'拆分ui/战斗界面/无怪物信息-v01'
out.mkdir(parents=True,exist_ok=True)
src=Path(sys.argv[1])
ui=Image.open(src).convert('RGBA')
dest=root/'生成界面/苍白之血-战斗UI优化-v01.png'
shutil.copy2(src,dest)
shutil.copy2(src,out/'UI总层.png')
psd_path=root/'生成界面/苍白之血-大教堂区战斗背景-v01.psd'
enemy=Image.open(psd_path).convert('RGBA')
scene=Image.open(root/'生成界面/苍白之血-大教堂区战斗背景-v01.png').convert('RGBA')
stage=Image.alpha_composite(scene,enemy)
canvas=Image.new('RGBA',stage.size,(0,0,0,0))
canvas.paste(ui,(0,0))
# 以下只作核验预览，不改变交付UI的尺寸或像素。
Image.alpha_composite(stage,canvas).convert('RGB').save(out/'PSD敌人适配预览.png')
for name,color in [('白底检查',(255,255,255,255)),('深灰底检查',(45,45,45,255)),('棋盘底检查',None)]:
    bg=Image.new('RGBA',ui.size,color or (210,210,210,255))
    if color is None:
        d=ImageDraw.Draw(bg)
        for y in range(0,ui.height,24):
            for x in range(0,ui.width,24):
                if (x//24+y//24)%2: d.rectangle((x,y,x+23,y+23),fill=(155,155,155,255))
    comp=Image.alpha_composite(bg,ui).convert('RGB')
    comp.save(out/(name+'.png'))
    if color is None:
        crop=comp.crop((350,590,1300,941))
        crop.resize((crop.width*2,crop.height*2)).save(out/'操作区放大检查.png')
alpha=np.array(canvas.getchannel('A'))
enemy_a=np.array(enemy.getchannel('A'))
report={'source_ui':str(src),'output_size':list(ui.size),'psd_size':list(enemy.size),
        'mode':Image.open(src).mode,'alpha_range':[int(alpha.min()),int(alpha.max())],
        'central_stage_nontransparent_pixels':int((alpha[60:600,300:1300]>8).sum()),
        'enemy_alpha_range':[int(enemy_a.min()),int(enemy_a.max())],
        'enemy_overlap_pixels':int(((alpha>8)&(enemy_a>8)).sum()),
        'partial_enemy_occlusion_allowed_by_user':True,
        'psd_bbox':list(enemy.getbbox() or ()),
        'ui_sha256':__import__('hashlib').sha256(dest.read_bytes()).hexdigest()}
(out/'透明与遮挡检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True))
