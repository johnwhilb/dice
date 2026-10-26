from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
root=Path(__file__).resolve().parents[2]
files=list((root/'生成界面').rglob('*.png'))
sheet=Image.new('RGB',(1200,240*((len(files)+2)//3)), '#cccccc')
for i,p in enumerate(files):
 im=Image.open(p).convert('RGB'); im.thumbnail((394,214))
 x=(i%3)*400;y=(i//3)*240
 sheet.paste(im,(x,y));ImageDraw.Draw(sheet).text((x,y+214),str(i+1),fill='black')
 print(i+1,p.name,Image.open(p).size)
sheet.save(root/'output/imagegen/诊所历史参考总览.png')
