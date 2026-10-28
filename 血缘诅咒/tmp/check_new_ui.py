from PIL import Image, ImageChops
from pathlib import Path
import shutil,sys
sys.stdout.reconfigure(encoding='utf-8')
source=Path(r'C:\Users\DHXM\AppData\Local\Temp\codex-clipboard-e36fd9f3-a988-4e9d-bd2f-9f92fb972906.png')
generated=Path(r'C:\Users\DHXM\.codex\generated_images\01a181ad-fa81-7cc1-92c1-9f0ee3c9b901\exec-5ba2b89b-9e88-46e6-919b-32f3391078c2.png')
dest=Path.cwd()/'output'/'imagegen'/'\u6218\u6597UI-2D\u9ab0\u5b50\u5361\u724c-\u5f85\u4fee\u6b63\u7a3f-v01.png'
a=Image.open(source).convert('RGBA'); b=Image.open(generated).convert('RGBA')
print('source',a.size,a.getchannel('A').getextrema(),'result',b.size,b.getchannel('A').getextrema())
if a.size==b.size:
 for name,box in [('top-left',(0,0,450,120)),('pause',(1550,0,1672,120)),('right-panels',(1320,580,1672,800))]:
  d=ImageChops.difference(a.crop(box),b.crop(box)); print(name,'different bbox',d.convert('RGB').getbbox())
dest.parent.mkdir(parents=True,exist_ok=True)
if dest.exists(): raise FileExistsError(dest)
shutil.copy2(generated,dest)
print(dest)
