from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
out=root/'output/imagegen/clinic-space-layout-guide.png'
W,H=1920,1080
im=Image.new('RGB',(W,H),'#828383');d=ImageDraw.Draw(im)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
d.rectangle((0,0,W,int(.28*H)),fill='#71797e')
d.rectangle((0,int(.51*H),W,H),fill='#766c61')
d.rectangle((0,int(.56*H),W,int(.61*H)),fill='#85796b')
d.rectangle((0,0,int(.16*W),int(.54*H)),fill='#3f4548')
d.rectangle((int(.84*W),0,W,int(.54*H)),fill='#3f4548')
d.rectangle((int(.18*W),int(.18*H),int(.82*W),int(.50*H)),outline='#c6d4d2',width=3)
d.text((W*.35,H*.31),'QUIET WALL / LOW CONTRAST',font=font,fill='white')
d.text((W*.36,H*.36),'NO FURNITURE OR LIGHTS',font=font,fill='white')
d.text((24,190),'CLINIC PROPS',font=small,fill='white')
d.text((24,220),'CROPPED BED',font=small,fill='white')
d.text((24,250),'CABINET / IV',font=small,fill='white')
d.text((W*.86,190),'CLOSED DOOR',font=small,fill='white')
d.text((W*.86,220),'CURTAIN',font=small,fill='white')
d.text((W*.86,250),'FRAME',font=small,fill='white')
for y,color,label in [(.51,'#ead6b1','51% WALL / FLOOR BREAK'),(.58,'#ffe3a6','58% FOOT BASELINE: FLAT CLEAR FLOOR'),(.60,'#aaa294','60% UI ZONE BEGINS')]:
    yy=round(y*H);d.line((0,yy,W,yy),fill=color,width=3);d.text((W*.31,yy+8),label,font=small,fill=color)
d.text((W*.32,H*.82),'QUIET FLOOR ONLY / COVERED BY UI',font=font,fill='#c2b5a6')
d.text((W*.37,25),'LAYOUT GUIDE - NO LABELS IN FINAL',font=small,fill='white')
im.save(out)
print(out)
