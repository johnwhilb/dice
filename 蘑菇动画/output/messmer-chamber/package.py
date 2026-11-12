from pathlib import Path
import shutil,json,hashlib
from PIL import Image
p=Path(__file__).parent
raw=Path(r'C:\Users\DHXM\.codex\generated_images\01a1cdb1-7f01-7f03-a2a4-83c81c3540e1\exec-d5316988-3938-46db-b8af-61cc6572e9b8.png')
shutil.copy2(raw,p/'source-generated.png')
shutil.copy2(p/'final/background.png',p/'messmer-chamber-1750x750.png')
assert Image.open(p/'messmer-chamber-1750x750.png').size==(1750,750)
meta={'art_source':'host_image','route':'Codex built-in image_gen','model':'not exposed by host tool','estimateUsd':None,'sourceSize':list(Image.open(raw).size),'finalSize':[1750,750],'references':['../../assets/messmer/master-still-sheet.png','../../style-ref.jpg','composition-guide.png'],'transform':'final/conform.json','sha256':hashlib.sha256((p/'messmer-chamber-1750x750.png').read_bytes()).hexdigest(),'visualReview':{'actorsPainted':False,'centralGroundOpen':True,'note':'Soft wall-to-floor transition; painted horizon is approximate, not pixel-exact at 48%. Side framing is visually approximate to 15/70/15.'},'capabilityReport':'doctor.json; environment capability warnings do not describe the delivered image'}
(p/'provenance.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
