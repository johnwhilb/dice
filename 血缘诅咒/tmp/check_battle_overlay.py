from PIL import Image
from pathlib import Path
p=Path(r'C:\Users\DHXM\.codex\generated_images\01a18085-e897-75a2-8b23-4a2a500c1b84\exec-816f67b4-7038-4a18-a23f-9e3824cb3979.png')
i=Image.open(p)
print(i.size, i.mode, i.getpixel((800,200)))
if 'A' in i.getbands():
 print('alpha extrema:',i.getchannel('A').getextrema())
