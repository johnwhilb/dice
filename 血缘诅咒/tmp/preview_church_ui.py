from PIL import Image
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path.cwd()
bg=root/'\u751f\u6210\u754c\u9762'/'\u82cd\u767d\u4e4b\u8840-\u5927\u6559\u5802\u533a\u53cc\u654c\u6218\u6597\u573a\u666f-v01.png'
ui=Path(r'C:\Users\DHXM\AppData\Local\Temp\codex-clipboard-82c4c5cf-ca0a-474f-83ad-9a0568032c85.png')
out=root/'\u751f\u6210\u754c\u9762'/'\u82cd\u767d\u4e4b\u8840-\u5927\u6559\u5802\u533a\u53cc\u654c-UI\u5408\u6210\u9884\u89c8-v01.png'
a=Image.open(bg).convert('RGBA'); b=Image.open(ui)
print('background',a.size,'UI',b.size,b.mode,'alpha extrema',b.getchannel('A').getextrema() if 'A' in b.getbands() else 'none')
if 'A' not in b.getbands() or b.getchannel('A').getextrema()[0]==255: raise ValueError('UI has no transparency')
if a.size != b.size: a=a.resize(b.size,Image.Resampling.LANCZOS)
if out.exists(): raise FileExistsError(out)
Image.alpha_composite(a,b.convert('RGBA')).convert('RGB').save(out)
print(out)
