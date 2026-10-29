from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
for name in ['\u62c6\u5206ui/\u6218\u6597\u754c\u9762','\u6218\u6597\u573a\u666f','\u89d2\u8272','\u80cc\u666f']:
 p=Path(name); print('\n',name,p.exists())
 if p.exists():
  for f in p.rglob('*'):
   if f.is_file() and f.suffix.lower() in ('.png','.jpg','.jpeg','.psd'): print(str(f))
