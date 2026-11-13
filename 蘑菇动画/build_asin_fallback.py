from pathlib import Path
import json,html
from copy import copy
import openpyxl
from openpyxl.drawing.image import Image
from openpyxl.styles import Font,Alignment
from openpyxl.comments import Comment
p=Path('asin_work'); data=json.loads((p/'details.json').read_text(encoding='utf-8'));images=json.loads((p/'images.json').read_text(encoding='utf-8'))
w=openpyxl.load_workbook('C:/Users/DHXM/xwechat_files/wxid_sg26ic6mmdv611_3e1b/msg/file/2026-11/Ref ASIN - 副本.xlsx');s=w['Sheet1']
ids=['B0BKGCN9P6','B09S9SW2VJ','B08JCQPDZ3','B08ND49388','B08ND49388','B0D8BCY87D','B0D6RJ42M2','B07P6KPQHW','B0F2411PZZ','B075DP3KV9']
for col,px in zip('ABCDEFG',[120,172,355,270,165,285,360]):s.column_dimensions[col].width=(px-5)/7
s.row_dimensions[1].height=22.5
for r,a in enumerate(ids,2):
 d=data[a];s.cell(r,1,a)
 for c,v in zip(range(3,7),[html.unescape(images[a]['title']).replace('\\/','/'),d['size'],d['material'],d['features']]):s.cell(r,c,v)
 s.row_dimensions[r].height=138.75
 im=Image(p/(a+'-thumb.png'));s.add_image(im,'B'+str(r))
for row in s.iter_rows(min_row=1,max_row=11,min_col=1,max_col=7):
 for c in row:
  f=copy(c.font);f.name='Arial';f.sz=11;c.font=f
  al=copy(c.alignment);al.vertical='center';al.wrap_text=True;c.alignment=al
def note(c,t):s[c].comment=Comment(t,'Source')
note('C4','Amazon page could not be retrieved. Exact-ASIN sources: https://manuals.plus/asin/B08JCQPDZ3 and https://zambia.desertcart.com/products/230891355-vingli-portable-toilet-indoor-outdoor-commode-w-detachable-inner-bucket . Main image: Amazon-hosted product image linked by Manuals+. The listed 30.9 in height needs verification; other retailers list 15.7 in with the lid closed.')
note('D2','Source: linked Amazon page. Product overview lists 16.5 in height and 2.68 kg, while the feature text mentions 15.7 in height. The cell follows the overview.')
note('D9','Source: linked Amazon page. Bag size follows the product description (18.5 x 19.7 in); weight follows technical details (0.41 kg). Description separately lists 0.97 lb.')
note('A6','The original row contained a repeated Website link with a blank ASIN. The ASIN and product information were filled from that link; the row was preserved.')
note('F10','Listing safety instruction: switch off and remove the immersion heater before immersing or operating the shower pump.')
out=Path('outputs/asin-20261113/Ref ASIN - Completed.xlsx');out.parent.mkdir(parents=True,exist_ok=True);w.save(out)
print(out.resolve())
