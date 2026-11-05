from pathlib import Path
import json, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent / 'output' / 'character_idle'
base = np.asarray(Image.open(ROOT / 'reference.png').convert('RGBA')).copy()
# The upload contains alpha=1 dust far outside the figure. Remove only that dust.
base[base[:,:,3] <= 1] = 0
H,W = base.shape[:2]
frames=[]
durations=[650,110,650,790]
eye_boxes=[(617,242,665,286),(699,242,725,286)]
for i in range(4):
    a=np.asarray(Image.open(ROOT / 'breathe_native' / f'frame_{i:02d}.png').convert('RGBA')).copy()
    a[a[:,:,3] <= 1] = 0
    # Exact source pixels lock the whole head and both boots, including alpha.
    a[:367]=base[:367]
    a[1080:]=base[1080:]
    # Local cloth follow-through: integer-pixel row shifts, no interpolation,
    # no palette changes. This is a hand-authored layer after native breathing.
    amplitude=[0,2,3,1][i]
    old=a.copy()
    for y in range(770,1080):
        u=(y-770)/310
        dx=round(amplitude*np.sin(np.pi*u)**2)
        if dx:
            a[y,330:870]=0
            a[y,330+dx:870+dx]=old[y,330:870]
    if i == 1:
        # Hand-authored closed-eye frame, placed on the inspected original eyes.
        # Copy adjacent same-row skin; sample the lash colour from the source.
        # Keep the original upper lashes verbatim, replacing only the exposed
        # sclera and lower iris. Same-column cheek samples avoid a bright patch.
        for y in range(261,287):
            a[y,618:665,:3]=base[292,618:665,:3]
            a[y,699:716,:3]=base[y,690,:3]
    frame=Image.fromarray(a)
    frames.append(frame)

out=ROOT / 'frames'; out.mkdir(exist_ok=True)
for i,frame in enumerate(frames):
    frame.save(out / f'idle_{i+1:02d}.png')
sheet=Image.new('RGBA',(W*4,H))
for i,frame in enumerate(frames): sheet.paste(frame,(W*i,0))
sheet.save(ROOT / 'idle_spritesheet.png')
frames[0].save(ROOT / 'idle.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,quality=80,method=1,exact=True)
# GIF has binary alpha and at most 255 visible colours. Share one palette to
# prevent per-frame colour pumping; PNG and lossless WebP retain full RGBA.
rgb=sheet.convert('RGB').quantize(colors=255,method=Image.Quantize.MEDIANCUT)
palette=rgb.getpalette()[:765]+[0,0,0]
pal=Image.new('P',(1,1)); pal.putpalette(palette)
gifframes=[]
for frame in frames:
    p=frame.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE)
    idx=np.asarray(p).copy(); idx[np.asarray(frame)[:,:,3]<128]=255
    g=Image.fromarray(idx).convert('P'); g.putpalette(palette)
    g.info['transparency']=255; gifframes.append(g)
gifframes[0].save(ROOT / 'idle.gif',save_all=True,append_images=gifframes[1:],duration=durations,loop=0,transparency=255,disposal=2,optimize=False)

# An inspection board and a compact preview use nearest-neighbour scaling.
board=Image.new('RGB',(4*340,750),'#777e89')
d=ImageDraw.Draw(board)
for i,frame in enumerate(frames):
    preview=frame.crop((320,0,900,1254)); preview.thumbnail((330,714),Image.Resampling.NEAREST)
    board.paste(preview,(i*340,30),preview)
    d.text((i*340+10,8),f'{i+1:02d}   {durations[i]} ms',fill='white')
board.save(ROOT / 'contact_sheet.png')
faceboard=Image.new('RGB',(720,600),'#777e89')
for i,frame in enumerate(frames):
    c=frame.crop((580,180,760,330)).resize((360,300),Image.Resampling.NEAREST)
    faceboard.paste(c,((i%2)*360,(i//2)*300),c)
faceboard.save(ROOT / 'face_check.png')
small=[]
for frame in frames:
    c=frame.crop((320,0,900,1254))
    c.thumbnail((290,627),Image.Resampling.NEAREST); small.append(c)
small[0].save(ROOT / 'idle_preview.webp',save_all=True,append_images=small[1:],duration=durations,loop=0,lossless=True,quality=100,exact=True)

arrays=[np.asarray(f) for f in frames]
qa={'frame_count':4,'frame_size':[W,H],'duration_ms':durations,'loop_duration_ms':sum(durations),
    'boots_identical_all_frames':all(np.array_equal(a[1080:],base[1080:]) for a in arrays),
    'head_identical_except_blink':all(np.array_equal(arrays[i][:367],base[:367]) for i in [0,2,3]),
    'transparent_corners':all(a[0,0,3]==0 and a[-1,-1,3]==0 for a in arrays),
    'adjacent_changed_pixels':[int(np.any(arrays[i]!=arrays[(i+1)%4],axis=2).sum()) for i in range(4)],
    'native_breathing':'sprite-gen breathe --mode pixel --depth 0.008 --depth-x 0.003 --breaths 1 --lag 0',
    'hand_authored_stages':['Closed-eye pixels in frame 2','Integer-row cloth follow-through','Exact source restoration on head and boots'],
    'background_cleanup':'Only alpha <= 1 dust removed',
    'notes':['4 frames follow the explicit request; fewer than the skill recommended 6 frames per breath.','PNG and WebP preserve full RGBA. GIF uses a shared 255-colour palette and binary alpha.']}
assert qa['boots_identical_all_frames'] and qa['head_identical_except_blink'] and qa['transparent_corners']
with Image.open(ROOT/'idle.webp') as w:
    qa['webp_frames']=w.n_frames
    qa['webp_lossless_rgba_verified']=True
    for i in range(4):
        w.seek(i); decoded=np.asarray(w.convert('RGBA'))
        mask=arrays[i][:,:,3]>0
        if not np.array_equal(decoded[mask],arrays[i][mask]): qa['webp_lossless_rgba_verified']=False
with Image.open(ROOT/'idle.gif') as g: qa['gif_frames']=g.n_frames
assert qa['webp_frames']==4 and qa['gif_frames']==4 and qa['webp_lossless_rgba_verified']
(ROOT/'qa_report.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
manifest={'frames':[{ 'filename':f'frames/idle_{i+1:02d}.png','frame':{'x':W*i,'y':0,'w':W,'h':H},'duration':durations[i]} for i in range(4)],'meta':{'image':'idle_spritesheet.png','size':{'w':W*4,'h':H},'scale':1,'loop':True,'frameTags':[{'name':'Idle','from':0,'to':3,'direction':'forward'}],'filter':'nearest','foot_anchor_px':[620,1239]}}
(ROOT/'idle.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(ROOT/'README.txt').write_text('Idle: 4 frames, 1254 x 1254 per frame; horizontal sprite sheet 5016 x 1254.\nTiming: 650 / 110 / 650 / 790 ms; loop 2200 ms. Frame 2 is the blink.\nUse nearest-neighbour filtering and idle.json timings.\nNative sprite-gen pixel breathing, followed by hand-authored eye and cloth edits. Head and boots remain fixed.\nSource contains softly shaded enlarged pixels; original size and colours are retained.\nPNG / lossless WebP retain RGBA. GIF has a shared 255-colour palette and binary alpha.\n',encoding='utf-8')
with zipfile.ZipFile(ROOT/'character_idle.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in [ROOT/'idle_spritesheet.png',ROOT/'idle.json',ROOT/'idle.gif',ROOT/'idle.webp',ROOT/'idle_preview.webp',ROOT/'contact_sheet.png',ROOT/'qa_report.json',ROOT/'README.txt',*sorted(out.glob('*.png'))]: z.write(p,p.relative_to(ROOT))
print(json.dumps(qa,ensure_ascii=False,indent=2))
