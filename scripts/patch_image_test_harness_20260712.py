from __future__ import annotations

import re
from pathlib import Path

INDEX_PATH = Path("platform_v2/cloudflare_shadow/src/index.ts")
TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def patch_content_type_narrowing() -> None:
    source = INDEX_PATH.read_text(encoding="utf-8")
    old = '''  const contentType = (outputResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();'''
    new = '''  const contentType = ((outputResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0] ?? "")
    .trim()
    .toLowerCase();'''
    if old in source:
        INDEX_PATH.write_text(source.replace(old, new, 1), encoding="utf-8")
        return
    if "cloudflare-images-public-derivative-v1" in source and new not in source:
        start = source.find("const contentType =", source.find("cloudflare-images-public-derivative-v1"))
        raise RuntimeError(f"content type narrowing target not found: {source[start:start + 240]!r}")


def patch_test_harness() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")
    marker = "fake-cloudflare-images-binding-v1"
    if marker in tests:
        return

    anchor = 'const INTERNAL_AUTH_TOKEN = "test-internal-token";\n'
    if tests.count(anchor) != 1:
        raise RuntimeError(f"test binding anchor count={tests.count(anchor)}")

    fake_binding = r'''

// fake-cloudflare-images-binding-v1: deterministic binary WebP-shaped output for Worker unit tests.
const FAKE_WEBP_BYTES = new Uint8Array([82, 73, 70, 70, 16, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32]);
const fakeImagesBinding = {
  async info(_stream: ReadableStream | ArrayBuffer) {
    return { format: "webp", fileSize: FAKE_WEBP_BYTES.byteLength, width: 640, height: 480 };
  },
  input(_stream: ReadableStream | ArrayBuffer) {
    const handle = {
      transform(_options: Record<string, unknown>) {
        return handle;
      },
      async output(_options: { format: string; quality?: number | string; anim?: boolean }) {
        return {
          response() {
            return new Response(FAKE_WEBP_BYTES.slice(), {
              status: 200,
              headers: { "content-type": "image/webp" }
            });
          }
        };
      }
    };
    return handle;
  }
};
'''
    tests = tests.replace(anchor, anchor + fake_binding, 1)

    pattern = re.compile(r"^(\s*)ASSET_BUCKET:\s*([^\n]+),\s*$", re.MULTILINE)

    def add_images(match: re.Match[str]) -> str:
        indent = match.group(1)
        return match.group(0) + f"\n{indent}IMAGES: fakeImagesBinding,"

    tests, binding_count = pattern.subn(add_images, tests)
    if binding_count < 1:
        raise RuntimeError("no ASSET_BUCKET test environments found")
    print(f"patched_test_env_images_bindings={binding_count}")
    TEST_PATH.write_text(tests, encoding="utf-8")


if __name__ == "__main__":
    patch_content_type_narrowing()
    patch_test_harness()
