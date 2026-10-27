from PIL import Image
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
folder=Path(r'C:\Users\DHXM\.codex\generated_images\01a17b47-7a7b-7c60-9758-d01aa60b2a97')
for p in folder.glob('*.png'):
    with Image.open(p) as im: print(p,im.size)
