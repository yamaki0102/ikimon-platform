from __future__ import annotations

import json
from pathlib import Path

INDEX_PATH = Path("platform_v2/cloudflare_shadow/src/index.ts")
CONFIG_PATH = Path("platform_v2/cloudflare_shadow/wrangler.jsonc")
TEST_PATH = Path("platform_v2/cloudflare_shadow/src/realImageDerivativeContract.test.ts")
MARKER = "cloudflare-images-public-derivative-v1"


def apply() -> bool:
    source = INDEX_PATH.read_text(encoding="utf-8")
    if MARKER in source:
        print("already patched")
        return False

    env_marker = "interface Env {"
    if source.count(env_marker) != 1:
        raise RuntimeError(f"Env marker count={source.count(env_marker)}")

    interfaces = '''interface ImagesInfo {
  format?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

interface ImagesOutput {
  response(): Response;
}

interface ImagesTransformation {
  transform(options: Record<string, unknown>): ImagesTransformation;
  output(options: { format: string; quality?: number | string; anim?: boolean }): Promise<ImagesOutput>;
}

interface ImagesBinding {
  input(stream: ReadableStream | ArrayBuffer): ImagesTransformation;
  info(stream: ReadableStream | ArrayBuffer): Promise<ImagesInfo>;
}

'''
    source = source.replace(env_marker, interfaces + env_marker, 1)

    asset_binding = "  ASSET_BUCKET: R2Bucket;\n"
    if source.count(asset_binding) != 1:
        raise RuntimeError(f"ASSET_BUCKET binding count={source.count(asset_binding)}")
    source = source.replace(asset_binding, asset_binding + "  IMAGES?: ImagesBinding;\n", 1)

    start = source.index("async function markUploadedAssetsPublicReady(")
    end = source.index("\nfunction rollbackLedgerInsert(", start)
    replacement = r'''async function markImageDerivativeFailed(
  env: Env,
  assetId: string,
  reason: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await env.OBS_DB.prepare(
    `UPDATE asset_ledger
     SET public_derivative_verified_at = NULL,
         public_derivative_metadata_json = ?,
         exif_scrub_state = 'failed',
         public_ready_at = NULL
     WHERE asset_id = ?`
  ).bind(
    JSON.stringify({
      tool: "cloudflare-images-public-derivative-v1",
      reason,
      ...details,
      checkedAt: new Date().toISOString()
    }),
    assetId
  ).run();
}

async function createRealPublicImageDerivative(asset: UploadedAssetRow, env: Env): Promise<boolean> {
  const images = env.IMAGES;
  if (!images) {
    await markImageDerivativeFailed(env, asset.asset_id, "images_binding_unavailable");
    return false;
  }

  const original = await env.ASSET_BUCKET.get(asset.object_key);
  if (!original?.body) {
    await markImageDerivativeFailed(env, asset.asset_id, "original_object_missing");
    return false;
  }

  const originalBytes = await new Response(original.body).arrayBuffer();
  const maxInputBytes = 20 * 1024 * 1024;
  if (originalBytes.byteLength === 0 || originalBytes.byteLength > maxInputBytes) {
    await markImageDerivativeFailed(env, asset.asset_id, "image_input_size_invalid", {
      inputBytes: originalBytes.byteLength,
      maxInputBytes
    });
    return false;
  }

  let originalInfo: ImagesInfo = {};
  try {
    originalInfo = await images.info(originalBytes.slice(0));
  } catch (error) {
    await markImageDerivativeFailed(env, asset.asset_id, "image_info_failed", {
      message: error instanceof Error ? error.message.slice(0, 240) : "unknown_error"
    });
    return false;
  }

  const originalWidth = Number(originalInfo.width ?? 0);
  const targetWidth = Number.isFinite(originalWidth) && originalWidth > 0
    ? Math.min(originalWidth, 1600)
    : 1600;

  let output: ImagesOutput;
  try {
    output = await images
      .input(originalBytes.slice(0))
      .transform({ width: targetWidth })
      .output({ format: "image/webp", quality: 82, anim: false });
  } catch (error) {
    await markImageDerivativeFailed(env, asset.asset_id, "image_transform_failed", {
      message: error instanceof Error ? error.message.slice(0, 240) : "unknown_error"
    });
    return false;
  }

  const outputResponse = output.response();
  const contentType = (outputResponse.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!outputResponse.ok || contentType !== "image/webp") {
    await markImageDerivativeFailed(env, asset.asset_id, "image_transform_invalid_response", {
      status: outputResponse.status,
      contentType
    });
    return false;
  }

  const derivativeBody = await outputResponse.arrayBuffer();
  if (derivativeBody.byteLength === 0) {
    await markImageDerivativeFailed(env, asset.asset_id, "image_transform_empty_output");
    return false;
  }

  const metadataInspection = inspectPublicDerivativeMetadata(derivativeBody, contentType);
  let derivativeInfo: ImagesInfo = {};
  try {
    derivativeInfo = await images.info(derivativeBody.slice(0));
  } catch (error) {
    await markImageDerivativeFailed(env, asset.asset_id, "derivative_info_failed", {
      message: error instanceof Error ? error.message.slice(0, 240) : "unknown_error"
    });
    return false;
  }

  const verifiedMetadata = {
    ...metadataInspection,
    tool: "cloudflare-images-public-derivative-v1",
    sourceContentType: asset.mime,
    sourceBytes: originalBytes.byteLength,
    sourceWidth: originalInfo.width ?? null,
    sourceHeight: originalInfo.height ?? null,
    derivativeFormat: derivativeInfo.format ?? "webp",
    derivativeWidth: derivativeInfo.width ?? null,
    derivativeHeight: derivativeInfo.height ?? null,
    derivativeBytes: derivativeBody.byteLength
  };
  if (metadataInspection.gpsExifPresent || metadataInspection.scannedContainer !== "binary") {
    await markImageDerivativeFailed(env, asset.asset_id, "derivative_privacy_check_failed", verifiedMetadata);
    return false;
  }

  const publicDerivativeKey = `derived/${asset.object_key.replace(/^original\//, "")}/display.webp`;
  const derivativeSha256 = await sha256Hex(derivativeBody);
  await env.ASSET_BUCKET.put(publicDerivativeKey, derivativeBody, {
    httpMetadata: { contentType: "image/webp" }
  });
  const persisted = await env.ASSET_BUCKET.head(publicDerivativeKey);
  if (!persisted || persisted.size !== derivativeBody.byteLength || persisted.httpMetadata?.contentType !== "image/webp") {
    await markImageDerivativeFailed(env, asset.asset_id, "derivative_r2_verification_failed", {
      ...verifiedMetadata,
      persisted: Boolean(persisted),
      persistedBytes: persisted?.size ?? null,
      persistedContentType: persisted?.httpMetadata?.contentType ?? null
    });
    return false;
  }

  await env.OBS_DB.prepare(
    `UPDATE asset_ledger
     SET public_derivative_key = ?,
         public_derivative_sha256 = ?,
         public_derivative_verified_at = CURRENT_TIMESTAMP,
         public_derivative_metadata_json = ?,
         exif_scrub_state = 'scrubbed',
         public_ready_at = CURRENT_TIMESTAMP
     WHERE asset_id = ?`
  ).bind(
    publicDerivativeKey,
    derivativeSha256,
    JSON.stringify(verifiedMetadata),
    asset.asset_id
  ).run();
  return true;
}

async function markUploadedAssetsPublicReady(observationId: string, env: Env): Promise<void> {
  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key, sha256, mime
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow>();

  for (const asset of assets.results) {
    if (asset.mime.startsWith("audio/")) {
      const metadataInspection = {
        gpsExifPresent: false,
        contentType: asset.mime,
        scannedContainer: "audio",
        mediaKind: "audio"
      };
      await env.OBS_DB.prepare(
        `UPDATE asset_ledger
         SET public_derivative_key = ?,
             public_derivative_sha256 = ?,
             public_derivative_verified_at = CURRENT_TIMESTAMP,
             public_derivative_metadata_json = ?,
             exif_scrub_state = 'scrubbed',
             public_ready_at = CURRENT_TIMESTAMP
         WHERE asset_id = ?`
      ).bind(
        asset.object_key,
        asset.sha256 ?? await sha256Hex(textToArrayBuffer(asset.object_key)),
        JSON.stringify(metadataInspection),
        asset.asset_id
      ).run();
      continue;
    }

    if (asset.mime.startsWith("image/")) {
      await createRealPublicImageDerivative(asset, env);
      continue;
    }

    const publicDerivativeKey = `derived/${asset.object_key.replace(/^original\//, "")}/display.webp`;
    const contentType = "image/svg+xml; charset=utf-8";
    const derivativeBody = textToArrayBuffer(shadowDerivativeSvg(asset.asset_id));
    const derivativeSha256 = await sha256Hex(derivativeBody);
    const metadataInspection = inspectPublicDerivativeMetadata(derivativeBody, contentType);
    if (metadataInspection.gpsExifPresent) {
      await env.OBS_DB.prepare(
        `UPDATE asset_ledger
         SET public_derivative_key = ?,
             public_derivative_sha256 = ?,
             public_derivative_metadata_json = ?,
             exif_scrub_state = 'failed'
         WHERE asset_id = ?`
      ).bind(
        publicDerivativeKey,
        derivativeSha256,
        JSON.stringify(metadataInspection),
        asset.asset_id
      ).run();
      continue;
    }
    await env.ASSET_BUCKET.put(publicDerivativeKey, derivativeBody, {
      httpMetadata: { contentType }
    });
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP
       WHERE asset_id = ?`
    ).bind(
      publicDerivativeKey,
      derivativeSha256,
      JSON.stringify(metadataInspection),
      asset.asset_id
    ).run();
  }
}
'''
    source = source[:start] + replacement + source[end:]
    INDEX_PATH.write_text(source, encoding="utf-8")

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    config["images"] = {"binding": "IMAGES"}
    for environment in ("shadow", "staging", "production"):
        config["env"][environment]["images"] = {"binding": "IMAGES"}
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    TEST_PATH.write_text(
        '''import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("image assets are re-encoded to verified WebP bytes", () => {
  assert.match(source, /cloudflare-images-public-derivative-v1/);
  assert.match(source, /asset\.mime\.startsWith\("image\/"\)/);
  assert.match(source, /images[\s\S]*\.output\(\{ format: "image\/webp", quality: 82, anim: false \}\)/);
  assert.match(source, /contentType !== "image\/webp"/);
  assert.match(source, /persisted\.size !== derivativeBody\.byteLength/);
  assert.match(source, /public_ready_at = CURRENT_TIMESTAMP/);
});

test("image branch never publishes the SVG shadow derivative", () => {
  const imageStart = source.indexOf('if (asset.mime.startsWith("image/"))');
  const fallbackStart = source.indexOf('const publicDerivativeKey = `derived/', imageStart + 1);
  assert.ok(imageStart >= 0 && fallbackStart > imageStart);
  const imageBranch = source.slice(imageStart, fallbackStart);
  assert.doesNotMatch(imageBranch, /shadowDerivativeSvg/);
  assert.match(imageBranch, /createRealPublicImageDerivative/);
});

test("Images binding is configured for every deployed environment", () => {
  const parsed = JSON.parse(config);
  assert.equal(parsed.images.binding, "IMAGES");
  assert.equal(parsed.env.shadow.images.binding, "IMAGES");
  assert.equal(parsed.env.staging.images.binding, "IMAGES");
  assert.equal(parsed.env.production.images.binding, "IMAGES");
});
''',
        encoding="utf-8",
    )
    print("patch_status=changed")
    return True


if __name__ == "__main__":
    apply()
