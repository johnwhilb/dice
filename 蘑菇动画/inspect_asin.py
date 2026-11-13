from pathlib import Path
import openpyxl
p=Path('C:/Users/DHXM/xwechat_files/wxid_sg26ic6mmdv611_3e1b/msg/file/2026-11/Ref ASIN - 副本.xlsx')
w=openpyxl.load_workbook(p)
for s in w:
 print(s.title,s.max_row,s.max_column)
 for row in s:
  v=[f'{c.coordinate}={c.value}' for c in row if c.value is not None]
  if v: print(' | '.join(v))
