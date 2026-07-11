from pathlib import Path

root = Path(__file__).resolve().parents[1]
workflow = root / ".github/workflows/deploy.yml"
source = workflow.read_text(encoding="utf-8")
old = 'if [[ "$app_sw" != *"ikimon-app-v6"* ||'
new = 'if [[ "$app_sw" != *"ikimon-app-v7"* ||'
if old not in source:
    raise SystemExit("stale PWA deploy check marker not found")
workflow.write_text(source.replace(old, new, 1), encoding="utf-8")
