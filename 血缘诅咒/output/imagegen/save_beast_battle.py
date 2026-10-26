from pathlib import Path
from PIL import Image
import shutil
import sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
source=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91\exec-98848914-00bf-4638-a797-2cf4218cac5b.png')
target=root/'生成界面/苍白之血-战斗界面-焚兽之夜-v01.png'
if target.exists():
    raise FileExistsError(target)
shutil.copy2(source,target)
shutil.copy2(root/'output/imagegen/苍白之血-战斗界面-焚兽之夜-v01.prompt.txt',target.with_suffix('.prompt.txt'))
print(target)
print(Image.open(target).size)
