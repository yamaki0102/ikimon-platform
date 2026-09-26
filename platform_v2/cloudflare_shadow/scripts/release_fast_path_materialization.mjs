import { createHash } from "node:crypto";

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const VERSION_PREFIX = /^original-ui\/versions\/[0-9a-f]{64}$/u;

function list(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function strings(value) { return [...new Set(list(value).filter((item) => typeof item === "string" && item.length > 0))].sort(); }

export function stableHtmlSha256(payload) {
  const normalized = String(payload)
    .replace(/nonce="[^"]*"/gu, 'nonce="__CSP_NONCE__"')
    .replace(/'nonce-[^']*'/gu, "'nonce-__CSP_NONCE__'");
  return createHash("sha256").update(normalized).digest("hex");
}

export function validateMaterializationImpactReceipt(receipt, { sourceSha, targetEnv } = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return ["receipt_invalid"];
  if (!SHA40.test(receipt.release_source_sha) || receipt.release_source_sha !== sourceSha) errors.push("source_sha_mismatch");
  if (receipt.environment !== targetEnv) errors.push("environment_mismatch");
  if (!["REUSE_EXACT", "SELECTIVE_REBUILD", "FULL_REBUILD"].includes(receipt.reuse_decision)) errors.push("reuse_decision_invalid");
  if (typeof receipt.artifact_identity_digest !== "string" || !SHA256_DIGEST.test(receipt.artifact_identity_digest)) errors.push("artifact_identity_missing");
  const provenance = receipt.prior_artifact_provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) errors.push("prior_artifact_provenance_missing");
  else if (receipt.reuse_decision === "REUSE_EXACT" || receipt.reuse_decision === "SELECTIVE_REBUILD") {
    if (!SHA256.test(provenance.bundle_hash)) errors.push("prior_bundle_hash_missing");
    if (!VERSION_PREFIX.test(provenance.version_prefix)) errors.push("prior_version_prefix_missing");
    if (typeof provenance.manifest_key !== "string" || !provenance.manifest_key) errors.push("prior_manifest_key_missing");
    if (typeof provenance.pointer_key !== "string" || !provenance.pointer_key) errors.push("prior_pointer_key_missing");
    if (provenance.manifest_sha256 != null && !SHA256.test(provenance.manifest_sha256)) errors.push("prior_manifest_sha256_invalid");
  }
  return [...new Set(errors)].sort();
}

function objectIdentity(item) { return item?.key ?? item?.pathname ?? item?.id ?? null; }

export function selectMaterializationItems(items, receipt) {
  const all = list(items);
  if (!receipt) return { mode: "FULL", reason: "NO_RECEIPT", items: all, uiR2PutCount: all.length, skippedCount: 0 };
  if (receipt.reuse_decision === "REUSE_EXACT") return { mode: "REUSE_EXACT", reason: "UNCHANGED_ARTIFACT_INPUT_CLOSURE", items: [], uiR2PutCount: 0, skippedCount: all.length };
  if (receipt.reuse_decision === "FULL_REBUILD") return { mode: "FULL", reason: "FULL_INPUT_CLOSURE_INVALIDATED", items: all, uiR2PutCount: all.length, skippedCount: 0 };
  if (receipt.reuse_decision !== "SELECTIVE_REBUILD") return { mode: "FULL", reason: "UNKNOWN_IMPACT_DECISION", items: all, uiR2PutCount: all.length, skippedCount: 0 };
  const affected = new Set(strings(receipt.materialization?.affected_objects ?? receipt.impact?.affected_artifacts ?? []));
  if (affected.size === 0) return { mode: "FULL", reason: "SELECTIVE_OBJECT_CLOSURE_MISSING", items: all, uiR2PutCount: all.length, skippedCount: 0 };
  const selected = all.filter((item) => affected.has(objectIdentity(item)) || affected.has(item?.pathname) || affected.has(item?.key?.replace(/^original-ui\//u, "")));
  if (selected.length === 0) return { mode: "FULL", reason: "SELECTIVE_OBJECT_CLOSURE_NO_MATCH", items: all, uiR2PutCount: all.length, skippedCount: 0 };
  return { mode: "SELECTIVE_REBUILD", reason: "AFFECTED_OBJECT_CLOSURE", items: selected, uiR2PutCount: selected.length, skippedCount: all.length - selected.length };
}
