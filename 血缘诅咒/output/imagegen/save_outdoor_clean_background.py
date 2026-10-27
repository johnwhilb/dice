from pathlib import Path
from PIL import Image
import shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
source=Path(r'C:\Users\DHXM\.codex\generated_images\01a17b47-7a7b-7c60-9758-d01aa60b2a97\exec-16045e23-9b59-46cd-be1a-fdd95c45a05e.png')
folder=root/'生成界面'
folder.mkdir(exist_ok=True)
version=1
while True:
    target=folder/f'苍白之血-约瑟夫卡室外纯背景-v{version:02d}.png'
    if not target.exists(): break
    version+=1
shutil.copy2(source,target)
with Image.open(target) as im: im.verify()
with Image.open(target) as im: print('SAVED',target,'SIZE',im.size)
