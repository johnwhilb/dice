from pathlib import Path
import shutil
src=Path(r'C:\Users\DHXM\.codex\generated_images\01a181ad-fa81-7cc1-92c1-9f0ee3c9b901\exec-f9a589f2-e7c5-4e2e-9174-ac7202057f1c.png')
dest=Path.cwd()/'\u751f\u6210\u754c\u9762'/'\u82cd\u767d\u4e4b\u8840-\u5927\u6559\u5802\u533a\u53cc\u654c\u6218\u6597\u573a\u666f-v01.png'
if dest.exists(): raise FileExistsError(dest)
shutil.copy2(src,dest)
print(dest)
