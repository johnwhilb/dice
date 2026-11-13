from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import openpyxl,sys,json
sys.stdout.reconfigure(encoding='utf-8')
p=Path('asin_work')
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
bold=ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',15)
def wrap(text,width):
 lines=[]
 for para in str(text or '').split('\n'):
  line=''
  for word in para.split():
   v=(line+' '+word).strip()
   if font.getlength(v)>width and line:lines.append(line);line=word
   else:line=v
  lines.append(line)
 return lines
if len(sys.argv)>1 and sys.argv[1]=='thumbs':
 for f in p.glob('*.jpg'):
  im=Image.open(f).convert('RGB');im.thumbnail((154,164))
  bg=Image.new('RGB',(166,176),'white');bg.paste(im,((166-im.width)//2,(176-im.height)//2));bg.save(p/(f.stem+'-thumb.png'))
 print('Main images fitted:',len(list(p.glob('*-thumb.png'))));sys.exit()
src=Path('C:/Users/DHXM/xwechat_files/wxid_sg26ic6mmdv611_3e1b/msg/file/2026-11/Ref ASIN - 副本.xlsx')
target=Path('outputs/asin-20261113/Ref ASIN - Completed.xlsx')
before=len(sys.argv)>1 and sys.argv[1]=='before'
w=openpyxl.load_workbook(src if before else target);s=w['Sheet1']
widths=[120,172,355,270,165,285,360]
if before:
 print('Original layout:',[(k,v.width) for k,v in s.column_dimensions.items()])
 print('Original font:',s['A1'].font)
else:
 assert w.sheetnames==openpyxl.load_workbook(src).sheetnames
 assert len(s._images)==10,len(s._images)
 assert all(s.cell(r,c).value for r in range(2,12) for c in [1,3,4,5,6,7])
 assert len({s.cell(r,1).value for r in range(2,12)})==9
 assert all(s.cell(r,7).value==openpyxl.load_workbook(src)['Sheet1'].cell(r,7).value for r in range(2,12))
 print('Verified: 10 rows, 9 distinct ASINs, 10 embedded images; source links and sheet names preserved.')
for start,end in ([(2,5)] if before else [(2,6),(7,11)]):
 h=185;im=Image.new('RGB',(sum(widths),30+(end-start+1)*h),'white');d=ImageDraw.Draw(im)
 for rr in [1]+list(range(start,end+1)):
  y=0 if rr==1 else 30+(rr-start)*h;rh=30 if rr==1 else h;x=0
  for cc,ww in enumerate(widths,1):
   d.rectangle((x,y,x+ww,y+rh),outline='#d9d9d9')
   if cc==2 and rr>1 and not before:
    f=p/(s.cell(rr,1).value+'-thumb.png');im.paste(Image.open(f),(x,y))
   else:
    ls=wrap(s.cell(rr,cc).value,ww-16)
    if not before:assert len(ls)*19<=rh-4,(rr,cc,len(ls))
    yy=y+max(5,(rh-len(ls)*19)//2)
    for line in ls:d.text((x+8,yy),line,font=bold if rr==1 else font,fill='#222222');yy+=19
   x+=ww
 name='before-fallback.png' if before else f'check-{start}-{end}.png';im.save(p/name)
 print('Rendered',name)
