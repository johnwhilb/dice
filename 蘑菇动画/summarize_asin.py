from pathlib import Path
import re, sys, json, html
sys.stdout.reconfigure(encoding='utf-8')
for p in Path('asin_work').glob('*.html'):
 s=p.read_text(encoding='utf-8'); t=p.with_suffix('.txt').read_text(encoding='utf-8')
 title=re.search(r'<span[^>]+id="productTitle"[^>]*>(.*?)</span>',s,re.S)
 img=re.search(r'<img[^>]+id="landingImage"[^>]*>',s,re.S)
 print('\nASIN',p.stem,'BYTES',len(s),'TITLE',html.unescape(re.sub('<[^>]+>','',title[1])).strip() if title else 'NONE')
 print('IMAGE',img[0] if img else 'NONE')
 for term in ['Product Dimensions','Package Dimensions','Item Weight','Material','About this item']:
  for m in list(re.finditer(re.escape(term),t))[:3]:print(t[max(0,m.start()-50):m.start()+1800])
