"""Preserve the generated original and conform a centered 1750x750 plate."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
from PIL import Image

root = Path(__file__).resolve().parent
source = Path(sys.argv[1])
original = root / 'original.png'
shutil.copy2(source, original)
conform = Path.home() / '.codex/skills/generate2dmap/scripts/conform_background.py'
subprocess.run([sys.executable, str(conform), 'conform', '--input', str(original),
                '--size', '1750x750', '--mode', 'ground-fit',
                '--ground-y', '460', '--floor-y', '360',
                '--output-dir', str(root / 'final')], check=True)
final = root / 'final/background.png'
with Image.open(original) as im:
    source_size = list(im.size)
with Image.open(final) as im:
    final_size = list(im.size)
assert final_size == [1750, 750]
report = {
    'art_source': 'host_image', 'route': 'Codex image_gen',
    'model': 'tool-managed; not exposed', 'estimateUsd': None,
    'original': {'path': 'original.png', 'size': source_size,
                 'sha256': hashlib.sha256(original.read_bytes()).hexdigest()},
    'final': {'path': 'final/background.png', 'size': final_size,
              'sha256': hashlib.sha256(final.read_bytes()).hexdigest()},
    'checks': {'exact_resolution': True},
    'stage_status': 'needs-visual-review',
    'limits': ['Composition percentages and perspective are visual targets, not a geometric proof.']
}
(root / 'provenance.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
