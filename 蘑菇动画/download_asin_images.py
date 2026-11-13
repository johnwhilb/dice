from pathlib import Path
import urllib.request,json,concurrent.futures,sys
sys.stdout.reconfigure(encoding='utf-8')
p=Path('asin_work'); data=json.loads((p/'images.json').read_text(encoding='utf-8'))
def get(kv):
 a,d=kv
 try:
  b=urllib.request.urlopen(d['url'],timeout=30).read()
  (p/(a+'.jpg')).write_bytes(b)
  return a,len(b)
 except Exception as e:return a,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
 for x in ex.map(get,data.items()):print(x)
