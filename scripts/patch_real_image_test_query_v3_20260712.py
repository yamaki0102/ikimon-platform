from __future__ import annotations

from pathlib import Path

TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def apply() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")
    marker = 'normalized.startsWith("SELECT asset_id, object_key, sha256, mime,")'
    if marker in tests:
        print("asset_query_handler=already_present")
        return

    anchor = '    throw new Error(`Unhandled SQL all: ${this.query}`);'
    if tests.count(anchor) != 1:
        raise RuntimeError(f"Unhandled SQL all anchor count={tests.count(anchor)}")

    handler = '''    if (
      normalized.startsWith("SELECT asset_id, object_key, sha256, mime,") &&
      normalized.includes("FROM asset_ledger")
    ) {
      const observationId = string(v[0]);
      const rows = [...this.db.assets.values()]
        .filter((asset) => asset.observation_id === observationId && asset.processing_state === "uploaded")
        .map((asset) => ({ ...asset }));
      return { results: rows as T[] };
    }

'''
    TEST_PATH.write_text(tests.replace(anchor, handler + anchor, 1), encoding="utf-8")
    print("asset_query_handler=added")


if __name__ == "__main__":
    apply()
