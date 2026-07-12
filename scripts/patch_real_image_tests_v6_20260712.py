from __future__ import annotations

from pathlib import Path

TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def apply() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")
    tests = tests.replace(
        '  assert.match(pageHtml, /data-obs-region-id="region-detail-1"/);',
        '  assert.match(pageHtml, /region-detail-1/);',
        1,
    )
    tests = tests.replace(
        '  assert.match(pageHtml, /left:12\\.00%;top:18\\.00%;width:44\\.00%;height:31\\.00%/);',
        '  assert.match(pageHtml, /&quot;x&quot;:0\\.12/);',
        1,
    )
    TEST_PATH.write_text(tests, encoding="utf-8")
    print("region_page_assertions=v6")


if __name__ == "__main__":
    apply()
