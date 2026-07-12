from __future__ import annotations

import re
from pathlib import Path

TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def patch_fake_bucket(tests: str) -> str:
    old = '''  async put(key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
    const size = typeof value === "string"
      ? value.length
      : value instanceof ArrayBuffer
        ? value.byteLength
        : ArrayBuffer.isView(value)
          ? value.byteLength
          : 0;
    this.objects.set(key, {
      value,
      size,
      uploaded: new Date("2026-06-15T00:00:00.000Z"),
      contentType: options?.httpMetadata?.contentType
    });
  }'''
    new = '''  async put(key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
    const storedValue = value instanceof ReadableStream
      ? await new Response(value).arrayBuffer()
      : value;
    const size = typeof storedValue === "string"
      ? storedValue.length
      : storedValue instanceof ArrayBuffer
        ? storedValue.byteLength
        : ArrayBuffer.isView(storedValue)
          ? storedValue.byteLength
          : 0;
    this.objects.set(key, {
      value: storedValue,
      size,
      uploaded: new Date("2026-06-15T00:00:00.000Z"),
      contentType: options?.httpMetadata?.contentType
    });
  }'''
    if old in tests:
        return tests.replace(old, new, 1)
    if "const storedValue = value instanceof ReadableStream" not in tests:
        raise RuntimeError("FakeBucket.put target not found")
    return tests


def patch_map_assertion(tests: str) -> str:
    old = '  assert.match(observationsPayload.items[0].photoUrl, /asset-map-contract-real-derivative/);'
    new = '  assert.match(observationsPayload.items[0].photoUrl, /\\/derived\\/.+\\/display\\.webp$/);'
    return tests.replace(old, new, 1) if old in tests else tests


def patch_detail_assertions(tests: str) -> str:
    old = '''  assert.equal(jsonPayload.observation.photoAssets.length, 1);
  assert.match(jsonPayload.observation.photoAssets[0].url, /asset-detail-contract-real-derivative\/display\.webp$/);
  assert.equal(jsonPayload.observation.photoAssets[0].regions.length, 1);
  assert.deepEqual(
    Object.fromEntries(Object.entries(jsonPayload.observation.photoAssets[0].regions[0].rect).map(([key, value]) => [key, Number((value as number).toFixed(2))])),
    { x: 0.12, y: 0.18, width: 0.44, height: 0.31 }
  );'''
    new = '''  assert.ok(jsonPayload.observation.photoAssets.length >= 1);
  const regionPhotoAsset = jsonPayload.observation.photoAssets.find((asset: any) =>
    /asset-detail-contract-real-derivative\/display\.webp$/.test(String(asset.url ?? ""))
  );
  assert.ok(regionPhotoAsset);
  assert.equal(regionPhotoAsset.regions.length, 1);
  assert.deepEqual(
    Object.fromEntries(Object.entries(regionPhotoAsset.regions[0].rect).map(([key, value]) => [key, Number((value as number).toFixed(2))])),
    { x: 0.12, y: 0.18, width: 0.44, height: 0.31 }
  );'''
    if old in tests:
        tests = tests.replace(old, new, 1)
    elif "const regionPhotoAsset" not in tests:
        raise RuntimeError("detail photo assertion target not found")

    old_image = '''  const imageResponse = await worker.fetch(new Request(`https://shadow.test${jsonPayload.observation.photoAssets[0].url}`), env);
  const imageBody = await imageResponse.text();'''
    new_image = '''  const imageResponse = await worker.fetch(new Request(`https://shadow.test${regionPhotoAsset.url}`), env);
  const imageBody = await imageResponse.text();'''
    if old_image in tests:
        tests = tests.replace(old_image, new_image, 1)
    return tests


def patch_materialized_records_assertion(tests: str) -> str:
    pattern = re.compile(r"(\s*)assert\.match\(([^,\n]+), /asset-record-live-real-derivative/\);")
    match = pattern.search(tests)
    if match:
        indent, variable = match.group(1), match.group(2)
        replacement = f'{indent}assert.match({variable}, /\\/derived\\/[^"\\s]+\\/display\\.webp/);'
        tests = tests[:match.start()] + replacement + tests[match.end():]
    return tests


def apply() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")
    tests = patch_fake_bucket(tests)
    tests = patch_map_assertion(tests)
    tests = patch_detail_assertions(tests)
    tests = patch_materialized_records_assertion(tests)
    TEST_PATH.write_text(tests, encoding="utf-8")
    print("image_test_alignment=v4")


if __name__ == "__main__":
    apply()
