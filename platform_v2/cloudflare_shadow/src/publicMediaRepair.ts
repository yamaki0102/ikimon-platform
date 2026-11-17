// Public media repair helpers: same-origin face detector assets, face-check carry-over and
// the scheduled upgrade of legacy public image derivatives.

// Same-origin MediaPipe face detector used by the record upload face-privacy check
// (platform_v2/src/ui/facePrivacyScript.ts). Exact files only; mirrors upload_package/public_html.
export const FACE_PRIVACY_STATIC_ASSET_PATHS = [
  "/assets/face-privacy/blaze_face_short_range.tflite",
  "/assets/face-privacy/mediapipe/vision_bundle.mjs",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_internal.js",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_internal.wasm",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_module_internal.js",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_module_internal.wasm",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_nosimd_internal.js",
  "/assets/face-privacy/mediapipe/wasm/vision_wasm_nosimd_internal.wasm"
] as const;

export function isFacePrivacyStaticAssetPath(pathname: string): boolean {
  return (FACE_PRIVACY_STATIC_ASSET_PATHS as readonly string[]).includes(pathname);
}

const RECORDABLE_FACE_PRIVACY_STATUSES = new Set(["no_faces", "redacted", "unavailable", "pending"]);

export function recordableFacePrivacy(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return RECORDABLE_FACE_PRIVACY_STATUSES.has(text) ? text : null;
}

export function isCurrentPublicImageDerivativeMetadata(metadata: Record<string, unknown>): boolean {
  return metadata.tool === "cloudflare-images-public-derivative-v1"
    && metadata.inspectionVersion === "webp-chunk-v2"
    && metadata.scannedContainer === "webp";
}

export function facePrivacyStatusFromMetadata(metadata: Record<string, unknown>): string | null {
  const value = metadata.facePrivacy;
  if (typeof value === "string") return recordableFacePrivacy(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const faceObject = value as Record<string, unknown>;
    // Never carry "no_faces" forward from a contradictory record.
    if (faceObject.hasFace === true || Number(faceObject.faceCount) > 0) {
      return faceObject.status === "redacted" ? "redacted" : null;
    }
    return recordableFacePrivacy(faceObject.status);
  }
  return null;
}

export const LEGACY_PUBLIC_IMAGE_UPGRADE_SQL = `
  SELECT a.observation_id
    FROM asset_ledger a
    JOIN observations o ON o.observation_id = a.observation_id
    LEFT JOIN observation_data_rights rights ON rights.visit_id = o.observation_id
   WHERE a.mime LIKE 'image/%'
     AND a.processing_state = 'uploaded'
     AND a.exif_scrub_state = 'scrubbed'
     AND a.public_derivative_metadata_json IS NOT NULL
     AND a.public_derivative_metadata_json NOT LIKE '%"inspectionVersion":"webp-chunk-v2"%'
     AND a.public_derivative_metadata_json NOT LIKE '%"legacyUpgradeFailedAt"%'
     AND o.visibility = 'public'
     AND o.emergency_hidden = 0
   GROUP BY a.observation_id
   ORDER BY MAX(CASE WHEN rights.source_payload_json LIKE '%destinationFeedKey%' THEN 1 ELSE 0 END) DESC,
            MAX(a.uploaded_at) DESC
   LIMIT 5`;
