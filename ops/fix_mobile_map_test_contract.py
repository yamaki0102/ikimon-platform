from pathlib import Path

path = Path(__file__).resolve().parents[1] / "platform_v2/src/ui/mapExplorer.test.ts"
source = path.read_text(encoding="utf-8")
old = "  assert.match(script, /switchMapTab\\(t\\);[\\s\\S]*drawer\\.removeAttribute\\('open'\\);/);"
new = "  assert.match(script, /switchMapTab\\(t\\);[\\s\\S]*closeFilterDrawer\\(\\);/);"
count = source.count(old)
if count != 1:
    raise SystemExit(f"legacy drawer assertion: expected 1 match, found {count}")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
