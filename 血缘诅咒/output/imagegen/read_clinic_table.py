from pathlib import Path
import sys, zipfile, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
source=Path(r'C:\Users\DHXM\Desktop\场景怪物表.xlsx')
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as z:
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        strings=[''.join(si.itertext()) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
    print('WORKBOOK',z.read('xl/workbook.xml').decode())
    for name in z.namelist():
        if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'):
            print('\nSHEET',name)
            for row in ET.fromstring(z.read(name)).findall('.//m:sheetData/m:row',ns):
                cells=[]
                for cell in row.findall('m:c',ns):
                    value=cell.find('m:v',ns)
                    text=value.text if value is not None else ''.join(cell.find('m:is',ns).itertext()) if cell.find('m:is',ns) is not None else ''
                    if cell.get('t')=='s': text=strings[int(text)]
                    if text: cells.append(cell.get('r')+': '+text)
                if cells: print(' | '.join(cells))
root=Path(__file__).resolve().parents[2]
print('\n===画风规范===\n'+(root/'提示词.txt').read_text(encoding='utf-8'))
print('\n===参考清单===')
for folder in ['画风锚点','生成界面']:
    for p in (root/folder).rglob('*'):
        if p.suffix.lower() in ['.png','.jpg','.jpeg','.webp','.bmp']: print(p)
