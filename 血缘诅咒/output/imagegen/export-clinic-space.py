from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,json
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]);im=Image.open(source).convert('RGB');native=im.size
im=im.resize((1920,1080),Image.Resampling.LANCZOS)
dest=root/'生成界面/苍白之血-约瑟夫卡诊所-战斗背景空间规范-v01.png'
if dest.exists():raise RuntimeError('Final output already exists; select a new version before export')
im.save(dest)
promptRecord=root/'output/imagegen/约瑟夫卡诊所-空间规范定稿提示词.json'
if promptRecord.exists():
    record=json.loads(promptRecord.read_text(encoding='utf-8'))
    dest.with_suffix('.prompt.txt').write_text(record['method']+'\n\n'+record['prompt']+'\n\n参考图：\n'+'\n'.join(record['referencedImages']),encoding='utf-8')
check=im.copy();d=ImageDraw.Draw(check,'RGBA');f=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',22)
def box(bounds,color):d.rectangle(tuple(round(v*(1920 if i%2==0 else 1080)) for i,v in enumerate(bounds)),outline=color,width=3)
box((.18,.18,.82,.57),(99,224,188,200))
box((0,.56,1,.61),(238,195,83,200))
for y,label,c in [(.48,'48% floor start range',(140,178,230,220)),(.54,'54% floor start range',(140,178,230,220)),(.58,'58% foot baseline',(255,210,111,255)),(.60,'60% UI background',(190,180,164,220))]:
 yy=round(y*1080);d.line((0,yy,1920,yy),fill=c,width=2);d.text((700,yy+3),label,font=f,fill=c)
qa=root/'output/imagegen/约瑟夫卡诊所-空间分区检查.png';check.save(qa)
meta={'source':str(source),'source_size':native,'output':str(dest),'output_size':[1920,1080],'processing':'仅使用Lanczos归一到请求的1920×1080尺寸；未拼接、裁切或绘改内容','zones':{'combat_clear':[.18,.18,.82,.57],'floor_start_range':[.48,.54],'standing_band':[.56,.61],'foot_y':.58,'ui_background':[.60,1.]},'qa':str(qa)}
(root/'output/imagegen/约瑟夫卡诊所-空间规范导出.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(meta,ensure_ascii=False,indent=2))
