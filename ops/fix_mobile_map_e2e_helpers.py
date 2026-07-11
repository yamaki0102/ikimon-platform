from pathlib import Path

path = Path(__file__).resolve().parents[1] / "platform_v2/e2e/map.staging.spec.ts"
source = path.read_text(encoding="utf-8")
old = '''  await installMapApiStubs(page);
  await waitForMapReady(page, "/map");'''
new = '''  await installMapLibreStubForSmoke(page);
  await installDeterministicMapApiFixtures(page);
  await waitForMapShellReady(page, "/map", true);'''
count = source.count(old)
if count != 1:
    raise SystemExit(f"map E2E helper correction: expected 1 match, found {count}")
path.write_text(source.replace(old, new, 1), encoding="utf-8")
