import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  FACE_PRIVACY_STATIC_ASSET_PATHS,
  LEGACY_PUBLIC_IMAGE_UPGRADE_SQL,
  facePrivacyStatusFromMetadata,
  isCurrentPublicImageDerivativeMetadata,
} from "./publicMediaRepair";
import { browserSecurityHeaders } from "./core/shared";

const repoRoot = new URL("../../../", import.meta.url);

test("face detector assets are committed and materialized with the same exact paths the Worker serves", () => {
  const materializer = readFileSync(new URL("../scripts/materialize-original-ui-html.mjs", import.meta.url), "utf8");
  const listed = [...materializer.matchAll(/"(\/assets\/face-privacy\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(listed)].sort(), [...FACE_PRIVACY_STATIC_ASSET_PATHS].sort());
  for (const pathname of FACE_PRIVACY_STATIC_ASSET_PATHS) {
    assert.ok(existsSync(new URL(`upload_package/public_html${pathname}`, repoRoot)), `missing ${pathname}`);
  }
});

test("page CSP lets the same-origin face detector compile WebAssembly without allowing eval", () => {
  const csp = browserSecurityHeaders("nonce", true)["content-security-policy"] ?? "";
  const scriptSrc = csp.split("; ").find((directive) => directive.startsWith("script-src ")) ?? "";
  assert.match(scriptSrc, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
});

test("only current Cloudflare Images derivatives with webp-chunk-v2 inspection count as current", () => {
  assert.equal(isCurrentPublicImageDerivativeMetadata({ tool: "cloudflare-images-public-derivative-v1", inspectionVersion: "webp-chunk-v2", scannedContainer: "webp" }), true);
  assert.equal(isCurrentPublicImageDerivativeMetadata({ tool: "sharp", contentType: "image/webp" }), false);
  assert.equal(isCurrentPublicImageDerivativeMetadata({ tool: "cloudflare-images-public-derivative-v1", scannedContainer: "binary" }), false);
});

test("legacy face checks carry forward only when they are not contradictory", () => {
  assert.equal(facePrivacyStatusFromMetadata({ facePrivacy: "no_faces" }), "no_faces");
  assert.equal(facePrivacyStatusFromMetadata({ facePrivacy: { status: "redacted", faceCount: 2 } }), "redacted");
  assert.equal(facePrivacyStatusFromMetadata({ facePrivacy: { status: "no_faces", hasFace: true } }), null);
  assert.equal(facePrivacyStatusFromMetadata({ facePrivacy: { status: "no_faces", faceCount: 1 } }), null);
  assert.equal(facePrivacyStatusFromMetadata({ facePrivacy: "approved" }), null);
  assert.equal(facePrivacyStatusFromMetadata({}), null);
});

test("scheduled legacy upgrade selects only public, scrubbed image derivatives without a prior failed attempt", () => {
  for (const clause of [
    "a.mime LIKE 'image/%'",
    "a.exif_scrub_state = 'scrubbed'",
    "NOT LIKE '%\"inspectionVersion\":\"webp-chunk-v2\"%'",
    "NOT LIKE '%\"legacyUpgradeFailedAt\"%'",
    "o.visibility = 'public'",
    "o.emergency_hidden = 0",
    "LIMIT 5",
  ]) {
    assert.ok(LEGACY_PUBLIC_IMAGE_UPGRADE_SQL.includes(clause), clause);
  }
});
