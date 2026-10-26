from pathlib import Path
from PIL import Image
import shutil, sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
src=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91\exec-bc042a3b-b7da-470b-add7-a6439e532099.png')
dst=root/'生成界面/苍白之血-约瑟夫卡诊所-战斗合成-v01.png'
if dst.exists(): raise FileExistsError(dst)
shutil.copy2(src,dst)
shutil.copy2(root/'output/imagegen/苍白之血-约瑟夫卡诊所-战斗合成-v01.prompt.txt',dst.with_suffix('.prompt.txt'))
print(dst)
print(Image.open(dst).size)
