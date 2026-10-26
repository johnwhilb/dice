from pathlib import Path
from PIL import Image
import shutil, sys, json
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
generated=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91')
records=root/'output/imagegen'
names={
    '战斗场景':'exec-f8991621-4f05-4f5b-9d4e-e08efb627d1e.png',
    '兽化狼人':'exec-27290bb5-1b4b-4bfe-babd-4afcbc8cec2e.png',
    '小型天界使者':'exec-5949f25e-a29d-4399-9132-9d35c99b57a4.png',
}
if len(sys.argv)>1:
    names['假约瑟夫卡']=sys.argv[1]
for label,filename in [('战斗场景','exec-2ca45877-0ca7-4a5a-a507-9138fcac91bf.png'),('假约瑟夫卡','exec-d854c2d1-1673-4a1c-b01c-cce6c3d7e3b4.png')]:
    dst=records/f'苍白之血-约瑟夫卡诊所-{label}-v01-draft01.png'
    if not dst.exists(): shutil.copy2(generated/filename,dst)
manifest=[]
for label,filename in names.items():
    stem=f'苍白之血-约瑟夫卡诊所-{label}-v01'
    src=generated/filename
    dst=root/'生成界面'/f'{stem}.png'
    if not dst.exists(): shutil.copy2(src,dst)
    elif dst.read_bytes()!=src.read_bytes(): raise FileExistsError(dst)
    prompt=(records/f'{stem}.prompt.txt').read_text(encoding='utf-8')
    edit=records/f'{stem}-edit.prompt.txt'
    if edit.exists(): prompt+='\n\n===后续定向修正调用===\n'+edit.read_text(encoding='utf-8')
    dst.with_suffix('.prompt.txt').write_text(prompt,encoding='utf-8')
    im=Image.open(dst)
    entry={'label':label,'path':str(dst),'source':str(src),'size':im.size,'mode':im.mode}
    if 'A' in im.getbands():
        alpha=im.getchannel('A')
        hist=alpha.histogram()
        entry.update(alpha_extrema=alpha.getextrema(),transparent_fraction=hist[0]/sum(hist),near_opaque_fraction=sum(hist[250:])/sum(hist),low_alpha_fraction=sum(hist[1:16])/sum(hist))
    manifest.append(entry)
    print(json.dumps(entry,ensure_ascii=False))
(records/'约瑟夫卡诊所-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
