from __future__ import annotations

from pathlib import Path

INDEX_PATH = Path("platform_v2/cloudflare_shadow/src/index.ts")
TEST_PATH = Path("platform_v2/cloudflare_shadow/src/index.test.ts")


def patch_index() -> None:
    source = INDEX_PATH.read_text(encoding="utf-8")

    query_old = '''    `SELECT asset_id, object_key, sha256, mime
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow>();'''
    query_new = '''    `SELECT asset_id, object_key, sha256, mime,
            public_derivative_key, public_derivative_verified_at,
            public_derivative_metadata_json, exif_scrub_state, public_ready_at
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow & {
    public_derivative_key: string | null;
    public_derivative_verified_at: string | null;
    public_derivative_metadata_json: string | null;
    exif_scrub_state: string | null;
    public_ready_at: string | null;
  }>();'''
    if query_old in source:
        source = source.replace(query_old, query_new, 1)
    elif query_new not in source:
        raise RuntimeError("uploaded asset query target not found")

    loop_old = '''  for (const asset of assets.results) {
    if (asset.mime.startsWith("audio/")) {'''
    loop_new = '''  for (const asset of assets.results) {
    if (
      asset.mime.startsWith("image/") &&
      asset.public_derivative_key &&
      asset.public_derivative_verified_at &&
      asset.public_derivative_metadata_json &&
      asset.exif_scrub_state === "scrubbed" &&
      asset.public_ready_at
    ) {
      try {
        const metadata = JSON.parse(asset.public_derivative_metadata_json) as Record<string, unknown>;
        const derivativeContentType = String(metadata.contentType ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
        const scannedContainer = String(metadata.scannedContainer ?? "").trim().toLowerCase();
        if (
          derivativeContentType === "image/webp" &&
          scannedContainer !== "svg+xml" &&
          metadata.gpsExifPresent !== true
        ) {
          continue;
        }
      } catch {
        // Invalid legacy metadata is regenerated below.
      }
    }

    if (asset.mime.startsWith("audio/")) {'''
    if loop_old in source:
        source = source.replace(loop_old, loop_new, 1)
    elif "Invalid legacy metadata is regenerated below." not in source:
        raise RuntimeError("asset processing loop target not found")

    warn_anchor = '''async function markImageDerivativeFailed(
  env: Env,
  assetId: string,
  reason: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await env.OBS_DB.prepare('''
    warn_replacement = '''async function markImageDerivativeFailed(
  env: Env,
  assetId: string,
  reason: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  console.warn("image_derivative_failed", { assetId, reason, ...details });
  await env.OBS_DB.prepare('''
    if warn_anchor in source:
        source = source.replace(warn_anchor, warn_replacement, 1)
    elif 'console.warn("image_derivative_failed"' not in source:
        raise RuntimeError("derivative failure logging anchor not found")

    INDEX_PATH.write_text(source, encoding="utf-8")


def patch_tests() -> None:
    tests = TEST_PATH.read_text(encoding="utf-8")

    old_tool = '  assert.equal(metadata.tool, "shadow-public-derivative-byte-signature-scan-v1");'
    new_tool = '  assert.equal(metadata.tool, "cloudflare-images-public-derivative-v1");'
    if old_tool in tests:
        tests = tests.replace(old_tool, new_tool, 1)

    sql_marker = 'if (normalized.startsWith("UPDATE asset_ledger SET public_derivative_verified_at = NULL"))'
    if sql_marker not in tests:
        anchor = '    throw new Error(`Unhandled SQL run: ${this.query}`);'
        if tests.count(anchor) != 1:
            raise RuntimeError(f"Unhandled SQL run anchor count={tests.count(anchor)}")
        handler = '''    if (normalized.startsWith("UPDATE asset_ledger SET public_derivative_verified_at = NULL")) {
      const row = requireRow(this.db.assets, string(v[1]));
      row.public_derivative_verified_at = null;
      row.public_derivative_metadata_json = string(v[0]);
      row.exif_scrub_state = "failed";
      row.public_ready_at = null;
      return {};
    }

'''
        tests = tests.replace(anchor, handler + anchor, 1)

    TEST_PATH.write_text(tests, encoding="utf-8")


if __name__ == "__main__":
    patch_index()
    patch_tests()
    print("patch_v2=applied")
