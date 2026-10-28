from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
source=Path(r'C:\Users\DHXM\.codex\generated_images\01a18085-e897-75a2-8b23-4a2a500c1b84\exec-bd78ceff-5872-4715-ae1a-add969593146.png')
im=Image.open(source).convert('RGBA')
outdir=root/'生成界面'
outdir.mkdir(exist_ok=True)
v=1
while (outdir/f'苍白之血-战斗UI重设计-草稿-v{v:02}.png').exists(): v+=1
out=outdir/f'苍白之血-战斗UI重设计-草稿-v{v:02}.png'
im.resize((1334,750),Image.Resampling.LANCZOS).save(out)
check=Image.open(out)
print(str(out).encode('ascii','backslashreplace').decode())
print(check.size,check.mode,'center pixel',check.getpixel((667,200)))
