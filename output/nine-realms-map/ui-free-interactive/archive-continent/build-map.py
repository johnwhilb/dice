"""Deterministic sprite trimming, placement metadata and QA composition only."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
specs = [
    ('asgard', '阿斯加德', 400, 255, 330, 'temple'),
    ('jotun', '约顿海姆', 875, 318, 330, 'relic'),
    ('muspel', '穆斯贝尔海姆', 1350, 395, 235, 'sword'),
    ('vana', '华纳海姆', 335, 505, 320, 'shrine'),
    ('mid', '米德加德', 790, 525, 300, 'town'),
    ('alf', '阿尔夫海姆', 1195, 595, 310, 'palace'),
    ('dwarf', '斯瓦塔尔法海姆', 345, 790, 330, 'forge'),
    ('nifl', '尼福尔海姆', 810, 850, 340, 'mist'),
    ('hel', '赫尔海姆', 1280, 850, 340, 'gate'),
]
base = Image.open(root / 'terrain.png').convert('RGBA')
W, H = base.size
props = root / 'props'
props.mkdir(exist_ok=True)
landmarks = []
for i, (ident, name, x, y, width, action) in enumerate(specs, 1):
    sprite = Image.open(root / 'processed' / f'prop_pack-{i}.png').convert('RGBA')
    bbox = sprite.getbbox()
    assert bbox, ident
    # Keep a transparent 4-pixel guard around every final tight sprite.
    cropped = sprite.crop(bbox)
    final = Image.new('RGBA', (cropped.width + 8, cropped.height + 8))
    final.alpha_composite(cropped, (4, 4))
    final.save(props / f'{ident}.png')
    height = round(width * final.height / final.width)
    item = dict(id=ident, name=name, image=f'props/{ident}.png',
                x=x, y=y, w=width, h=height, anchor='center-bottom',
                layer='interactables', sortY=y, action=action,
                occlusionClass='tall', interaction={'type':'realm-interact','shape':'rect',
                'x':x-width/2,'y':y-height,'w':width,'h':height})
    landmarks.append(item)
    base.alpha_composite(final.resize((width, height), Image.Resampling.LANCZOS),
                         (round(x-width/2), y-height))
data = dict(schema='nine-realms.interactive-map.v1', map_mode='scene_mode',
            visual_model='layered_raster', runtime_object_model='interactive_scene_objects',
            collision_model='trigger_zones', engine_target='raw_canvas',
            width=W, height=H, base='terrain.png', anchor='center-bottom',
            landmarks=landmarks,
            scene_hooks={'event':'realm-interact','detail':['id','name','action','visits'],
                         'cameraBounds':{'x':0,'y':0,'w':W,'h':H}},
            collision={'blockers':[], 'reason':'World map selection; no actor movement.'},
            provenance={'basePrompt':'terrain.prompt.txt','propsPrompt':'landmarks.prompt.txt',
                        'spacingPrompt':'landmarks.spacing.prompt.txt',
                        'source':'built-in image_gen'})
(root/'map-data.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
(root/'map-data.js').write_text('window.NINE_REALMS_MAP = '+json.dumps(data, ensure_ascii=False)+';\n', encoding='utf-8')
base.convert('RGB').save(root/'layered-preview.png')
print(json.dumps({'size':[W,H], 'landmarks':len(landmarks), 'alpha':True}))
