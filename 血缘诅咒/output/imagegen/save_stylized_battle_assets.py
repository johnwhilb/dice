from pathlib import Path
from PIL import Image
import numpy as np
import shutil, sys, json

sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
generated=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91')
work=root/'output/imagegen/诊所素材风格化'
battle=root/'拆分ui/战斗界面'
records=battle/'处理记录/约瑟夫卡诊所-v01'
records.mkdir(parents=True,exist_ok=True)
specs=[
    ('background','背景','约瑟夫卡诊所-v01','exec-0d0631c4-bd51-4de8-8539-69a1ff8d2183.png',None),
    ('wolf','敌人','约瑟夫卡诊所-兽化狼人-v01','exec-9f8aefd8-4cfd-41c3-b106-580e23816875.png',[340,200,335,280]),
    ('celestial','敌人','约瑟夫卡诊所-小型天界使者-v01','exec-5f0cab32-1020-4717-a473-74b979a6624d.png',[790,230,160,255]),
    ('impostor','敌人','约瑟夫卡诊所-假约瑟夫卡-v01','exec-c08b4ae4-8cd8-49ea-8a1b-a08ea7047521.png',[1035,112,290,370]),
]
manifest={'scene':'约瑟夫卡诊所','game':'苍白之血','source_interface':'生成界面/苍白之血-战斗界面-约瑟夫卡诊所-v01.png','canvas':[1672,941],'method':'内置image_gen提取、遮挡补绘及风格化；非逐像素无损拆分','assets':[]}
for key,folder,stem,source_name,envelope in specs:
    dst=battle/folder/f'{stem}.png'
    dst.parent.mkdir(parents=True,exist_ok=True)
    if dst.exists(): raise FileExistsError(dst)
    shutil.copy2(generated/source_name,dst)
    prompt=(work/f'{stem}.prompt.txt').read_text(encoding='utf-8')
    edit=work/f'{stem}-edit.prompt.txt'
    if edit.exists(): prompt+='\n\n===定向修正调用===\n'+edit.read_text(encoding='utf-8')
    (records/f'{stem}.prompt.txt').write_text(prompt,encoding='utf-8')
    image=Image.open(dst)
    data={'key':key,'file':dst.relative_to(root).as_posix(),'size':list(image.size),'mode':image.mode,'tool_original':str(generated/source_name),'display_envelope_reference':envelope}
    if 'A' in image.getbands():
        a=image.getchannel('A')
        hist=a.histogram()
        alpha=np.asarray(a)
        yy,xx=np.nonzero(alpha>=16)
        visible=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)] if len(xx) else None
        data.update(alpha_extrema=list(a.getextrema()),transparent_fraction=round(hist[0]/sum(hist),6),near_opaque_fraction=round(sum(hist[250:])/sum(hist),6),visible_bbox_alpha16=visible)
    manifest['assets'].append(data)
    print(json.dumps(data,ensure_ascii=False))
for stem,source_name in [('约瑟夫卡诊所-v01','exec-03dcce63-b68f-4042-8b6a-6abe685ae9cd.png'),('约瑟夫卡诊所-小型天界使者-v01','exec-971fb1a2-bc44-41da-8461-198bd4f021a2.png')]:
    draft=work/f'{stem}-draft01.png'
    if not draft.exists(): shutil.copy2(generated/source_name,draft)
(records/'素材清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(work/'素材清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('manifest:',records/'素材清单.json')
