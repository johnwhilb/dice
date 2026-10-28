from pathlib import Path
from PIL import Image
import numpy as np, shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
src=Path(r'C:\Users\DHXM\AppData\Local\Temp\codex-clipboard-ea5f06ec-5816-4e63-a913-3fc0bc1f371b.png')
generated=Path(r'C:\Users\DHXM\.codex\generated_images\01a181ad-fa81-7cc1-92c1-9f0ee3c9b901\exec-f96e6d66-a1ef-4b76-82c6-a8e5f852265b.png')
a=Image.open(src).convert('RGBA'); b=Image.open(generated).convert('RGBA')
print('source size',a.size,'output size',b.size,'alpha',b.getchannel('A').getextrema())
if a.size==b.size:
 x=np.array(a); y=np.array(b)
 for n,(l,t,r,bt) in {'top left':(0,0,450,110),'pause':(1550,0,1672,110),'character':(15,600,410,825),'right panels':(1330,585,1655,795),'end turn':(1290,800,1672,920)}.items():
  print(n, int(np.any(x[t:bt,l:r]!=y[t:bt,l:r],axis=2).sum()))
else: print('FAIL: sizes differ; pixel equality impossible')
dest=Path.cwd()/'output'/'imagegen'/'\u6218\u6597UI-\u951a\u70b9\u98ce\u683c-\u5f85\u4fee\u6b63\u7a3f-v01.png'
if dest.exists(): raise FileExistsError(dest)
shutil.copy2(generated,dest)
print('saved',dest)
