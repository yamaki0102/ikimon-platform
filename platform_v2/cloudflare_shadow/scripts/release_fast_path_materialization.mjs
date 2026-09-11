const SHA40 = /^[0-9a-f]{40}$/u;

function list(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function strings(value) { return [...new Set(list(value).filter((item) => typeof item === "string" && item.length > 0))].sort(); }

export function validateMaterializationImpactReceipt(receipt, { sourceSha, targetEnv } = {}) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) errors.push("receipt_invalid");
  if (!SHA40.test(receipt?.release_source_sha) || receipt.release_source_sha !== sourceSha) errors.push("source_sha_mismatch");
  if (receipt?.environment !== targetEnv) errors.push("environment_mismatch");
  if (!["REUSE_EXACT", "SELECTIVE_REBUILD", "FULL_REBUILD"].includes(receipt?.reuse_decision)) errors.push("reuse_decision_invalid");
  if (typeof receipt?.artifact_identity_digest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(receipt.artifact_identity_digest)) errors.push("artifact_identity_missing");
  if (!receipt?.prior_artifact_provenance || typeof receipt.prior_artifact_provenance !== "object") errors.push("prior_artifact_provenance_missing");
  if (receipt?.reuse_decision === "REUSE_EXACT") {
    for (const field of ["bundle_hash", "version_prefix", "manifest_key", "pointer_key"]) if (typeof receipt.prior_artifact_provenance[field] !== "string" || receipt.prior_artifact_provenance[field].length === 0) errors.push(`prior_${field}_missing`);
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

