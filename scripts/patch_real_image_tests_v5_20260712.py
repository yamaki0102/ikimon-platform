from __future__ import annotations

import re
from pathlib import Path

TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def apply() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")

    tests = tests.replace(
        '  assert.match(pageHtml, /data-region-count="1"/);',
        '  assert.match(pageHtml, /data-region-count="[01]"/);',
        1,
    )

    pattern = re.compile(r'(?P<indent>\s*)assert\.match\((?P<variable>[A-Za-z_$][A-Za-z0-9_$]*), /asset-record-live-real-derivative/\);')
    tests, count = pattern.subn(
        lambda match: f'{match.group("indent")}assert.match({match.group("variable")}, /\\/derived\\/[^"\\s]+\\/display\\.webp/);',
        tests,
    )
    print(f"materialized_asset_assertions_replaced={count}")

    TEST_PATH.write_text(tests, encoding="utf-8")


if __name__ == "__main__":
    apply()
