import sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
p=Path('UI\u62c6\u5206\u4e0ePSD\u5de5\u4f5c\u6d41\u7a0b.md')
print(p.read_text(encoding='utf-8'))
