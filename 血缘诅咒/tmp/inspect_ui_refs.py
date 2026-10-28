from pathlib import Path
import json
p=Path(__file__).resolve().parents[1]
print(json.dumps({d:[str(f) for f in (p/d).rglob('*') if f.suffix.lower() in ['.png','.jpg','.jpeg','.webp']] for d in ['画风锚点','可用界面']},ensure_ascii=True))
