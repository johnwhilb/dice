from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
print((root/'提示词.txt').read_text(encoding='utf-8'))
for folder in ['画风锚点', '生成界面']:
    for path in (root/folder).rglob('*'):
        if path.suffix.lower() in ['.png','.jpg','.jpeg','.webp','.bmp']:
            print(path)
