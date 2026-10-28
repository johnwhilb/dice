from pathlib import Path
import json
from PIL import Image

root=Path(__file__).resolve().parents[1]
out=root/'tmp'/'战斗UI检查'
out.mkdir(parents=True,exist_ok=True)
for directory in ['画风锚点','可用界面','生成界面','拆分ui/战斗界面']:
    print(json.dumps({'directory':directory,'files':[str(p.relative_to(root)) for p in (root/directory).rglob('*') if p.is_file() and (directory!='拆分ui/战斗界面' or p.parent==root/directory)]},ensure_ascii=True))
p=root/'生成界面/苍白之血-大教堂区战斗背景-v01.psd'
psd=Image.open(p)
print(json.dumps({'psd':str(p),'size':psd.size,'mode':psd.mode,'layers':getattr(psd,'layers',None)},ensure_ascii=True,default=str))
print(json.dumps({'alpha_extrema':psd.getchannel('A').getextrema(),'alpha_bbox':psd.getchannel('A').getbbox()},ensure_ascii=True))
psd.convert('RGB').save(out/'PSD原始合成.png')
print('PSD preview saved')
im=Image.open(Path('C:/Users/DHXM/AppData/Local/Temp/codex-clipboard-ad5b554f-9a77-4ba2-8c60-bb38014e7982.png'))
print(json.dumps({'attachment_size':im.size,'mode':im.mode},ensure_ascii=True))
