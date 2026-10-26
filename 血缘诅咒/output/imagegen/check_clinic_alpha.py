from pathlib import Path
from PIL import Image
import sys
sys.stdout.reconfigure(encoding='utf-8')
folder=Path(r'C:\Users\DHXM\.codex\generated_images\01a175f4-97e3-73a3-aace-7685d802be91')
for name in ['exec-d854c2d1-1673-4a1c-b01c-cce6c3d7e3b4.png','exec-5b691aab-0061-4ed5-9e40-d877f7424ee1.png']:
    img=Image.open(folder/name)
    print(name,img.size,img.mode)
    if 'A' in img.getbands():
        alpha=img.getchannel('A')
        hist=alpha.histogram()
        print('alpha',alpha.getextrema(),'bbox',alpha.getbbox(),'transparent',round(hist[0]/sum(hist),4),'partial',round(sum(hist[1:255])/sum(hist),4))
        for xy in [(100,500),(200,500),(800,100),(700,400),(400,10),(200,100),(300,1400)]: print(xy,img.getpixel(xy))
