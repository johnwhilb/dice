from pathlib import Path
from PIL import Image
import shutil
import sys

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
draft = root / 'output/imagegen/苍白之血-战斗界面-v04-draft01.png'
source = Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91\exec-f31e10b7-7634-46dc-a4be-c898d9078a71.png')
if not draft.exists():
    shutil.copy2(source, draft)
print(f'草稿：{draft}，尺寸：{Image.open(draft).size}')
if len(sys.argv) > 1:
    selected = Path(sys.argv[1])
    destination = root / '生成界面/苍白之血-战斗界面-v04.png'
    if destination.exists():
        raise FileExistsError(destination)
    shutil.copy2(selected, destination)
    shutil.copy2(root / 'output/imagegen/苍白之血-战斗界面-v04-final.prompt.txt', destination.with_suffix('.prompt.txt'))
    print(f'成图：{destination}，尺寸：{Image.open(destination).size}')
