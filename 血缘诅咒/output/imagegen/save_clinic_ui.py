from pathlib import Path
from PIL import Image
import shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
originals=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91')
record=root/'output/imagegen'
stem='苍白之血-战斗界面-约瑟夫卡诊所-v01'
dst=root/'生成界面'/f'{stem}.png'
if dst.exists(): raise FileExistsError(dst)
shutil.copy2(originals/'exec-41d6c598-adf6-46de-a861-48444e5453fb.png',dst)
for index,name in enumerate(['exec-b4a40673-9ed1-476d-a05e-311142e8da92.png','exec-74e3cd13-a458-406f-87b8-10392b0c58e9.png'],1):
    draft=record/f'{stem}-draft{index:02d}.png'
    if not draft.exists(): shutil.copy2(originals/name,draft)
prompt=(record/f'{stem}.prompt.txt').read_text(encoding='utf-8')
prompt+='\n\n===选定成图的定向编辑提示词（基于第一轮草稿）===\n'
prompt+=(record/f'{stem}-final-edit.prompt.txt').read_text(encoding='utf-8')
dst.with_suffix('.prompt.txt').write_text(prompt,encoding='utf-8')
print(dst)
print(Image.open(dst).size)
