from pathlib import Path
from PIL import Image
p=Path(__file__).resolve().parents[1]
src=Path(r'C:\Users\DHXM\.codex\generated_images\01a18085-e897-75a2-8b23-4a2a500c1b84\exec-8ceea86f-8c10-4d31-a495-d1d0ee6f7d80.png')
im=Image.open(src)
print('source size:',im.size)
dest=p/'生成界面'
dest.mkdir(exist_ok=True)
version=1
while (dest/f'苍白之血-战斗UI无插画版-v{version:02}.png').exists():
    version+=1
out=dest/f'苍白之血-战斗UI无插画版-v{version:02}.png'
im.resize((1334,750),Image.Resampling.LANCZOS).save(out)
print(str(out).encode('ascii','backslashreplace').decode())
print('saved size:',Image.open(out).size)
