from pathlib import Path
from PIL import Image
import shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
src=Path(r'C:\Users\DHXM\.codex\generated_images\01a17b47-7a7b-7c60-9758-d01aa60b2a97')
draft_dir=root/'output/imagegen/约瑟夫卡第一人称-草稿'
draft_dir.mkdir(parents=True,exist_ok=True)
for i,name in enumerate(['exec-808b66ec-b080-42ec-b807-ae02b0a2aefb.png','exec-3e0594ea-b3ec-4042-8970-ad5a315a88cf.png','exec-e84dc6f6-8d26-4b27-b5d0-aeed4a3b46b0.png'],1):
    dst=draft_dir/f'调整草稿-{i:02d}.png'
    if not dst.exists(): shutil.copy2(src/name,dst)
folder=root/'生成界面'
folder.mkdir(exist_ok=True)
v=1
while True:
    dst=folder/f'苍白之血-约瑟夫卡诊所战斗-第一人称-v{v:02d}.png'
    if not dst.exists(): break
    v+=1
shutil.copy2(src/'exec-ccf4dc31-b607-474a-aa0d-8ac87d1e6859.png',dst)
with Image.open(dst) as im: im.verify()
with Image.open(dst) as im: print('SAVED',dst,'SIZE',im.size,'BYTES',dst.stat().st_size)
