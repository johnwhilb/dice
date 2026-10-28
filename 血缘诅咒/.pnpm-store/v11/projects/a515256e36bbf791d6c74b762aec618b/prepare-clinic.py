from pathlib import Path
import json,sys
import openpyxl
from PIL import Image,ImageDraw
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
out=root/'拆分ui/战斗界面/约瑟夫卡诊所-完整-v01'
(out/'资料').mkdir(parents=True,exist_ok=True)
w=openpyxl.load_workbook(root/'场景怪物表_带图版.xlsx')
records=[]
for s in w:
    rows=[2] if s==w.worksheets[0] else [2,3,4]
    for r in rows:
        record={'sheet':s.title,'row':r,'cells':{c.coordinate:c.value for c in s[r] if c.value is not None}}
        for im in s._images:
            if im.anchor._from.row+1==r:
                p=out/'资料'/f'{s.cell(r,1).value}-表内参考.png'
                p.write_bytes(im._data())
                record['reference']=str(p)
        records.append(record)
(out/'资料/表格原文.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False,indent=2))
folders=['可用界面','游戏界面画风锚点','拆分ui/战斗界面/敌人','拆分ui/战斗界面/背景']
for fi,folder in enumerate(folders):
    files=[p for p in (root/folder).rglob('*') if p.suffix.lower() in ['.png','.jpg','.jpeg','.webp']]
    c=Image.new('RGB',(1000,360*((len(files)+1)//2)), '#555555');d=ImageDraw.Draw(c)
    for i,p in enumerate(files):
        im=Image.open(p).convert('RGBA');im.thumbnail((492,320));x=(i%2)*500;y=(i//2)*360
        c.paste(im,(x+(500-im.width)//2,y),im);d.text((x+5,y+325),p.name,fill='white')
    p=out/'资料'/f'参考总览-{fi}.png';c.save(p);print(p)
