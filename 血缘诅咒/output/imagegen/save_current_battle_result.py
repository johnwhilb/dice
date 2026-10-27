from pathlib import Path
import shutil, sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
source=Path(r'C:\Users\DHXM\.codex\generated_images\01a17b47-7a7b-7c60-9758-d01aa60b2a97')
drafts=root/'output/imagegen/约瑟夫卡战斗-本次草稿'
drafts.mkdir(parents=True,exist_ok=True)
names=['exec-8eb911a9-1241-40b4-8b67-027e96c669db.png','exec-798df38f-f504-4db2-98e6-1a39ec80af30.png','exec-16b6e779-bb99-4dbd-a935-9c91dc021131.png','exec-d3feb663-f1f8-4bae-9ea2-21158968d43c.png']
for i,name in enumerate(names,1):
    dst=drafts/f'布局调整草稿-{i:02d}.png'
    if not dst.exists(): shutil.copy2(source/name,dst)
final_dir=root/'生成界面'
final_dir.mkdir(exist_ok=True)
v=1
while True:
    target=final_dir/f'苍白之血-约瑟夫卡战斗-待确认稿-v{v:02d}.png'
    if not target.exists(): break
    v+=1
shutil.copy2(source/'exec-bda675be-919b-4027-bbdf-2d57f29b0307.png',target)
with Image.open(target) as im:
    im.verify()
with Image.open(target) as im:
    print('SAVED',target)
    print('SIZE',im.size,'BYTES',target.stat().st_size)
