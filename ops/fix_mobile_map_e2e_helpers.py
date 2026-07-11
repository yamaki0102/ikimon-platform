from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "platform_v2/e2e/map.staging.spec.ts"
source = path.read_text(encoding="utf-8")
new = '''  await installMapLibreStubForSmoke(page);
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page, "/map", true);'''

if new in source:
    print("map E2E helper correction already applied")
else:
    pattern = re.compile(
        r'  await installMapApiStubs\(page\);\r?\n'
        r'  await waitForMapReady\(page, "/map"\);'
    )
    source, count = pattern.subn(new, source, count=1)
    if count != 1:
        raise SystemExit(f"map E2E helper correction: expected 1 match, found {count}")
    path.write_text(source, encoding="utf-8")
    print("map E2E helper correction applied")
