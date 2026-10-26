from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
print('ROOT')
for p in root.iterdir(): print(p.name,'DIR' if p.is_dir() else '')
print('\nBATTLE DIRS')
for p in root.rglob('*'):
    if p.is_dir() and (p.name in ['战斗界面','敌人','背景'] or p.parent.name=='战斗界面'):
        print(p)
        for f in p.iterdir(): print('  ',f.name)
print('\nROLE SOURCES')
for p in (root/'角色').rglob('*'):
    if p.is_file(): print(p)
