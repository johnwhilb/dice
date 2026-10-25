from pathlib import Path
from PIL import Image
import json

root = Path(__file__).parent
atlas = Image.open(root.parent / 'nine-realms-map/kingdom-landmarks.png').convert('RGBA')
names = ['alfheim','vanaheim','jotunheim','svartalfheim','midgard','asgard','helheim','niflheim','muspelheim']
report = []
for i, name in enumerate(names):
    col, row = i % 3, i // 3
    rect = (round(col*atlas.width/3),round(row*atlas.height/3),round((col+1)*atlas.width/3),round((row+1)*atlas.height/3))
    tile = atlas.crop(rect)
    bounds = tile.getchannel('A').point(lambda a: 255 if a > 25 else 0).getbbox()
    tile = tile.crop(bounds)
    # Preserve source artwork and alpha; add safe transparent output padding.
    out = Image.new('RGBA',(tile.width+16,tile.height+16))
    out.paste(tile,(8,8))
    out.save(root / 'assets' / (name+'.png'))
    report.append(dict(id=name,source='existing kingdom-landmarks.png',cell=rect,crop=bounds,size=out.size))
(root/'assets/extraction.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'terrain':Image.open(root/'assets/terrain.png').size,'atlas':atlas.size,'props':len(report)}))
