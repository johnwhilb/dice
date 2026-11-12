from PIL import Image
from pathlib import Path

source = Path(r'C:\Users\DHXM\.codex\generated_images\01a1cd70-8772-7dd3-b469-382a7713d2da\exec-3000acc1-037d-45e5-b009-413d1115d416.png')
target = Path(__file__).with_name('messmer-secret-chamber-1750x750.png')
im = Image.open(source).convert('RGB')
print('source', im.size)
# Center crop to the requested 7:3 aspect ratio, then resample uniformly.
w, h = im.size
crop_w = min(w, round(h * 7 / 3))
crop_h = min(h, round(w * 3 / 7))
left = (w - crop_w) // 2
top = (h - crop_h) // 2
im.crop((left, top, left + crop_w, top + crop_h)).resize((1750, 750), Image.Resampling.LANCZOS).save(target)
print('output', target, Image.open(target).size)
