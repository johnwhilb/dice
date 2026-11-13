from pathlib import Path
import urllib.request, concurrent.futures, json
import re, html as htmlmod
ids=['B0BKGCN9P6','B09S9SW2VJ','B08JCQPDZ3','B08ND49388','B0D8BCY87D','B0D6RJ42M2','B07P6KPQHW','B0F2411PZZ','B075DP3KV9']
out=Path('asin_work');out.mkdir(exist_ok=True)
def get(a):
 try:
  r=urllib.request.urlopen(urllib.request.Request('https://www.amazon.com/dp/'+a,headers={'User-Agent':'Mozilla/5.0'}),timeout=40)
  raw=r.read(); html=raw.decode('utf-8','replace')
  (out/(a+'.html')).write_text(html,encoding='utf-8')
  t=re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', html, flags=re.S|re.I)
  t=htmlmod.unescape(re.sub('<[^>]+>',' ',t));t=re.sub(r'\s+',' ',t)
  (out/(a+'.txt')).write_text(t,encoding='utf-8')
  return a,r.status,len(raw),t[:350]
 except Exception as e:return a,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 for r in ex.map(get,ids): print(r)
