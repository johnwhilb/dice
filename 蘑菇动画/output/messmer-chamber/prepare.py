from pathlib import Path
import json
from PIL import Image, ImageDraw

root=Path(__file__).parent
im=Image.new('RGB',(1750,750),'#514b50')
d=ImageDraw.Draw(im)
d.rectangle((0,360,1749,749),fill='#777074')
d.rectangle((0,0,261,749),fill='#28252b')
d.rectangle((1488,0,1749,749),fill='#28252b')
d.line((262,360,1487,360),fill='#a59896',width=2)
im.save(root/'composition-guide.png')
stage={'schema':'generate2dmap.stage.v1','plate':'messmer-chamber-1750x750.png','sourceSize':[1750,750],'fit':'contain','objectPosition':[0.5,0.5],'reviewedAspectRange':[1750/750,1750/750],'groundPolygons':[[[0.15,0.49],[0.85,0.49],[0.85,1],[0.15,1]]],'playableBand':[0.5,0.98],'slots':{'hero':[],'enemy':[],'boss':[0.5,0.9]},'approachPoints':[],'protectedRegions':[],'effects':[],'bakedContent':{'actors':False,'collectibles':False},'camera':{'center':[0.5,0.48],'pitchDegrees':5,'rollDegrees':0},'composition':{'horizontal':[0.15,0.70,0.15],'horizonY':0.48,'enemyWidth':[0.30,0.70],'contactAnchor':[0.50,0.90]}}
(root/'stage.json').write_text(json.dumps(stage,indent=2),encoding='utf-8')
prompt='''Create ONE finished game combat background: Messmer the Impaler's private dark chamber in Elden Ring, Shadow of the Erdtree. NO characters, NO enemy, no snakes or living creatures, no player weapons, no UI, no lettering, no sheet panels. Opaque full-bleed panoramic background, final 1750 x 750 pixels (7:3).

REFERENCE ROLES: Image 1 is the Messmer master-still design sheet: use its visual language, dark bronze ornament, crimson drapery and charcoal palette to design a compatible environment; DO NOT draw the character, spear, portraits or reference-sheet layout. Image 2 is the project STYLE reference only: bold clean black outlines, angular stylized cartoon forms, controlled flat colors, hard cel shadows, restrained paper texture. Translate this style into environment architecture. Image 3 is an EXACT composition blockout, geometry only: preserve its boundaries and horizon; replace every flat region naturally with finished environment art, no visible blocks or guide lines.

COMPOSITION IS HIGHEST PRIORITY, over decorative detail or authentic architecture. Strict left 15% (x=0..262.5), open center 70% (x=262.5..1487.5), right 15% (x=1487.5..1750). All tall foreground stone piers, black masonry, carved bronze serpent reliefs and crimson hanging curtains stay inside the two side strips, all the way to the edges, producing a balanced natural enclosure. No pillar, curtain, large prop, diagonal arch, tree, furniture or rubble intrudes into the central 70%. No overhead arch crossing the center. Bottom center is entirely unobstructed.

Horizon and wall-to-floor boundary EXACTLY y=48%=360px. Upper 48% is a continuous distant chamber wall extending edge to edge; lower 52% is a continuous broad level stone floor extending horizon to bottom edge. Transition only in y=45..53%. Fixed centered frontal first-person eye-level camera, slight downward pitch 5 degrees, zero roll and zero horizontal offset; mild stable perspective, single vanishing point (50%,48%). No isometric view, no overhead view, no fisheye. Large subdued horizontal wall courses and a soft dark horizontal cornice across the upper backdrop. The middle wall is dark low-contrast smoky plum-grey, quiet and visually complete, with extremely subtle worn masonry. No throne, statue, door, bright window, vertical columns or focal light in the middle. Keep central silhouette region x=30..70% clear from top to contact anchor (50%,90%).

ENVIRONMENT: an enclosed solemn black-stone royal ritual chamber, austere Shadow Keep mood. Side strips have cropped heavy carved stone piers, worn dark bronze snake reliefs, muted crimson cloth and a few small low flames/candles confined near the outer edges. Sparse restrained warm amber edge lighting, dim charcoal/plum ambient light, readable pale ash-grey stone floor. No giant fire, fog wall, lava, forest or exterior sky. A very faint layer of floor haze, sparse ash and large subtle floor slab seams with mild perspective give natural depth. Center floor is readable, calm and dry, NO central carpet, circular emblem, raised dais, steps, pits, rubble, chair or candles. Keep red cloth and any gold ornament away from the central silhouette so the separately composited red-haired crimson-cloaked boss reads clearly. No high-contrast lines or bright focal point behind the future boss. The combat floor is a natural continuous environment, never an empty rectangle or blank cutout.

Render as polished hand-drawn stylized 2D game background matching the reference linework and cel-shaded finish, not photorealism, not a 3D render, not pixel art. The proportions and exact composition above are mandatory. Output just the single finished background, no visible labels, measurements, guides, borders or watermark.'''
(root/'prompt.txt').write_text(prompt,encoding='utf-8')
