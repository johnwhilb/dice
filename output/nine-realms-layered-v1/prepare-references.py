"""Crop reference guides only; final art is generated with built-in image_gen."""
from pathlib import Path
from PIL import Image
import json

root=Path(__file__).resolve().parent
source=Image.open(root.parent/'nine-realms-explorer'/'map-nine-realms-ui-free.png').convert('RGBA')
specs=[
 ('jotunheim','约顿海姆',(0,0,520,345)),
 ('asgard','阿斯加德',(520,0,1165,340)),
 ('alfheim','阿尔夫海姆',(1160,0,1672,360)),
 ('vanaheim','华纳海姆',(0,335,520,680)),
 ('midgard','米德加德',(520,345,1160,690)),
 ('svartalfheim','斯瓦塔尔法海姆',(1165,345,1672,690)),
 ('muspelheim','穆斯贝尔海姆',(0,630,530,941)),
 ('niflheim','尼福尔海姆',(535,660,1145,941)),
 ('helheim','赫尔海姆',(1145,635,1672,941)),
]
data=[]
for ident,name,box in specs:
    box=tuple(round(v*(source.width/1672 if i%2==0 else source.height/941)) for i,v in enumerate(box))
    source.crop(box).save(root/'references'/f'{ident}.png')
    data.append(dict(id=ident,name=name,reference=f'references/{ident}.png',referenceCrop=list(box)))
(root/'references'/'source-layout.json').write_text(json.dumps(dict(width=source.width,height=source.height,worlds=data),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(worlds=len(data),sourceSize=source.size)))
