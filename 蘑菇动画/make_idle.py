from pathlib import Path
from PIL import Image
import numpy as np
import json

ROOT = Path(__file__).parent / 'output' / 'character_idle'
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = Path(r'C:\Users\DHXM\AppData\Local\Temp\codex-clipboard-7f762a34-cad4-4915-9318-da0faa873809.png')
im = Image.open(SOURCE).convert('RGBA')
print('SOURCE', im.size, 'alpha', im.getextrema()[3], 'bbox', im.getbbox())
print('corners', [im.getpixel(p) for p in [(0,0),(im.width-1,0),(0,im.height-1)]])
alpha = np.asarray(im)[:,:,3]
for threshold in [0,1,8,32,64,128,254]:
    ys,xs=np.nonzero(alpha>threshold)
    print('ALPHA',threshold,len(xs),(int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())))
im.save(ROOT / 'reference.png')
im.crop((580,180,760,330)).resize((720,600), Image.Resampling.NEAREST).save(ROOT / 'face_inspection.png')
(ROOT / 'input').mkdir(exist_ok=True)
for i in range(4):
    im.save(ROOT / 'input' / f'frame_{i:02d}.png')
