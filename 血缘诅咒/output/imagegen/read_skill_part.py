from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
p=Path(r'C:\Users\DHXM\.codex\plugins\cache\openai-primary-runtime\spreadsheets\26.1007.11041\skills\spreadsheets')
print('\n'.join((p/'SKILL.md').read_text(encoding='utf-8').splitlines()[140:350]))
print('\n===只读提取===\n'+(p/'references/read_only_qna.md').read_text(encoding='utf-8'))
