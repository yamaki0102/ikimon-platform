import { createHash } from "node:crypto";

export const materializeManifestSchemaVersion = "original-ui-materialize/v1";
export const noPointerEvidenceSchema = "ikimon.materialize-no-pointer/v1";
const versionPrefixPattern = /^original-ui\/versions\/[a-f0-9]{64}$/u;

const sha256 = (payload) => createHash("sha256").update(payload).digest("hex");
const stripPrefix = (key) => String(key ?? "").replace(/^original-ui\//u, "");

export async function runPool(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  });
  await Promise.all(workers);
}

export function pointerBody({ bundleHash, versionPrefix, sourceSha }) {
  return { manifest_hash: bundleHash, version_prefix: versionPrefix, source_sha: sourceSha };
}

export function pointerText(body) {
  return `${JSON.stringify(body, null, 2)}\n`;
}

function pointerEquals(parsed, body) {
  return Boolean(parsed)
    && parsed.manifest_hash === body.manifest_hash
    && parsed.version_prefix === body.version_prefix
    && parsed.source_sha === body.source_sha;
}

function normalizePriorItem(item, fallbackVersionPrefix) {
  const key = stripPrefix(item?.key);
  const versionPrefix = String(item?.version_prefix ?? fallbackVersionPrefix);
  if (!key || !versionPrefixPattern.test(versionPrefix)) return null;
  return {
    key,
    bytes: Number.isFinite(item?.bytes) ? item.bytes : undefined,
    sha256: String(item?.sha256 ?? "").toLowerCase(),
    identitySha256: String(item?.identitySha256 ?? item?.identity_sha256 ?? "").toLowerCase(),
    contentType: item?.contentType ?? item?.content_type ?? undefined,
    version_prefix: versionPrefix,
  };
}

export function parsePriorManifest(payload, { targetEnv, scope }) {
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("prior_manifest_invalid_json");
  }
  if (parsed?.schemaVersion !== materializeManifestSchemaVersion || parsed.targetEnv !== targetEnv || parsed.scope !== scope) {
    throw new Error("prior_manifest_provenance_mismatch");
  }
  if (!versionPrefixPattern.test(String(parsed.versionPrefix ?? ""))) throw new Error("prior_manifest_version_prefix_invalid");
  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item) => normalizePriorItem(item, parsed.versionPrefix)).filter(Boolean)
    : [];
  if (items.length === 0) throw new Error("prior_manifest_items_missing");
  return {
    bundleHash: String(parsed.bundleHash ?? ""),
    versionPrefix: parsed.versionPrefix,
    sourceSha: String(parsed.sourceSha ?? ""),
    byKey: new Map(items.map((item) => [item.key, item])),
  };
}

// Items whose identitySha256 (nonce-normalized for HTML, raw for static) equals the prior entry
// are not uploaded; the new manifest points them at the prior version_prefix.
export function planReuse(allItems, prior, versionPrefix) {
  const reused = new Map();
  const uploadItems = [];
  for (const item of allItems) {
    const key = stripPrefix(item.key);
    const previous = prior.byKey.get(key);
    const identity = String(item.identitySha256 ?? "").toLowerCase();
    if (previous && identity && previous.identitySha256 === identity) reused.set(key, previous);
    else uploadItems.push(item);
  }
  const currentKeys = new Set(allItems.map((item) => stripPrefix(item.key)));
  const removedKeys = [...prior.byKey.keys()].filter((key) => !currentKeys.has(key)).sort();
  const manifestItems = allItems.map((item) => {
    const key = stripPrefix(item.key);
    const previous = reused.get(key);
    return previous
      ? { key, bytes: previous.bytes, sha256: previous.sha256, identitySha256: previous.identitySha256, contentType: previous.contentType, version_prefix: previous.version_prefix }
      : { key, bytes: item.bytes, sha256: item.sha256, identitySha256: item.identitySha256, contentType: item.contentType, version_prefix: versionPrefix };
  }).sort((a, b) => a.key.localeCompare(b.key));
  return {
    uploadItems,
    reusedCount: reused.size,
    removedKeys,
    manifestItems,
    unchanged: uploadItems.length === 0 && removedKeys.length === 0,
  };
}

async function readPrior(io, manifestKey, { targetEnv, scope }) {
  try {
    const prior = parsePriorManifest(await io.readText(await io.get(manifestKey, "prior-materialize-manifest.json")), { targetEnv, scope });
    return { prior, error: null };
  } catch (error) {
    return { prior: null, error: `prior_manifest_unavailable:${error?.message ?? "unknown"}` };
  }
}

async function readPointer(io, pointerKey) {
  try {
    return JSON.parse(await io.readText(await io.get(pointerKey, "current-pointer-prior.json")));
  } catch {
    return null;
  }
}

function pendingPointer({ pointerKey, body, manifestSha256 }) {
  return {
    key: pointerKey,
    body,
    text: pointerText(body),
    manifest_key: `${body.version_prefix}/manifest.json`,
    manifest_sha256: manifestSha256,
  };
}

// Groups entries by content type (wrangler bulk put takes one --content-type per call) and uploads
// each group with one bulk call. Falls back to per-object puts for a group if the bulk call fails.
async function uploadGroups(entries, { io, concurrency, summary }) {
  const byType = new Map();
  for (const entry of entries) {
    const contentType = entry.contentType || "application/octet-stream";
    if (!byType.has(contentType)) byType.set(contentType, []);
    byType.get(contentType).push(entry);
  }
  for (const [contentType, group] of byType) {
    try {
      await io.bulkPut(group.map(({ key, filePath }) => ({ key, filePath })), { contentType, concurrency });
    } catch {
      summary.bulkFallbacks = (summary.bulkFallbacks ?? 0) + 1;
      await runPool(group, concurrency, (entry) => io.put(entry.key, entry.filePath, contentType));
    }
  }
  return entries.length;
}

// io: { put(key, filePath, contentType), bulkPut(entries, {contentType, concurrency}) (throws on failure),
//       get(key, name) -> filePath (throws if absent), readText(filePath), writeText(name, text) -> filePath }
export async function runDirectR2Sync(input) {
  const {
    allItems, selection, selectiveManifestItems = null, skipIfUnchanged, targetEnv, scope,
    manifestKey, pointerKey, bundleHash, sourceSha, concurrency, noPointer, io, summary,
  } = input;
  const versionPrefix = `original-ui/versions/${bundleHash}`;
  let mode = selection.mode;
  let reason = selection.reason;
  let uploadItems = selection.items;
  let skipped = selection.skippedCount;
  let plan = null;
  let prior = null;
  let pointerParsed = null;

  if (skipIfUnchanged) {
    // Prior mutable manifest and current pointer are independent reads: issue them concurrently.
    const [priorRead, pointerRead] = await Promise.all([
      readPrior(io, manifestKey, { targetEnv, scope }),
      noPointer ? null : readPointer(io, pointerKey),
    ]);
    prior = priorRead.prior;
    pointerParsed = pointerRead;
    if (prior) {
      plan = planReuse(allItems, prior, versionPrefix);
      uploadItems = plan.uploadItems;
      mode = "IDENTITY_REUSE";
      reason = "IDENTITY_EQUAL_REUSE";
      skipped = plan.reusedCount;
    } else {
      uploadItems = allItems;
      mode = "FULL";
      reason = priorRead.error;
      skipped = 0;
    }
  }
  summary.skipped += skipped;
  summary.reused = plan ? plan.reusedCount : 0;
  summary.uiR2PutCount = uploadItems.length;

  // Same source as the prior run and nothing changed: the prior versioned manifest is already valid.
  // Only the pointer may need (re)writing, and never when --no-pointer is set.
  if (plan?.unchanged && prior.sourceSha === sourceSha) {
    const reuseBody = pointerBody({ bundleHash: prior.bundleHash, versionPrefix: prior.versionPrefix, sourceSha });
    const pending = pendingPointer({ pointerKey, body: reuseBody, manifestSha256: null });
    const base = {
      ok: true, skipped: true, key: manifestKey, sha256: null, versionPrefix: prior.versionPrefix, pointerKey,
      transport: "wrangler-r2", uiR2PutCount: 0, uploaded: 0, reused: plan.reusedCount,
      selectionMode: mode, selectionReason: reason,
    };
    if (noPointer) return { ...base, status: "SKIPPED_UNCHANGED", pending_pointer: pending };
    if (pointerEquals(pointerParsed, reuseBody)) return { ...base, status: "SKIPPED_UNCHANGED", pending_pointer: null };
    const pointerPath = await io.writeText(`current-${targetEnv}.json`, pending.text);
    await io.put(pointerKey, pointerPath, "application/json");
    return { ...base, skipped: false, status: "POINTER_ONLY_WRITTEN", pending_pointer: null };
  }

  const uploaded = await uploadGroups(uploadItems.map((item) => ({
    key: `${versionPrefix}/${stripPrefix(item.key)}`, filePath: item.filePath, contentType: item.contentType,
  })), { io, concurrency, summary });
  summary.uploaded += uploaded;
  summary.updated += uploaded;

  const manifestItems = plan ? plan.manifestItems
    : (mode === "SELECTIVE_REBUILD" && selectiveManifestItems) ? await selectiveManifestItems()
      : allItems.map((item) => ({
        key: stripPrefix(item.key), bytes: item.bytes, sha256: item.sha256,
        identitySha256: item.identitySha256, contentType: item.contentType, version_prefix: versionPrefix,
      }));
  const manifest = {
    schemaVersion: materializeManifestSchemaVersion,
    sourceSha,
    targetEnv,
    scope,
    bundleHash,
    versionPrefix,
    items: manifestItems,
  };
  const manifestPayload = `${JSON.stringify(manifest, null, 2)}\n`;
  // Manifests are written only after every object they reference has been uploaded.
  const manifestPath = await io.writeText("materialize-manifest.json", manifestPayload);
  await uploadGroups([
    { key: `${versionPrefix}/manifest.json`, filePath: manifestPath, contentType: "application/json" },
    { key: manifestKey, filePath: manifestPath, contentType: "application/json" },
  ], { io, concurrency, summary });

  const body = pointerBody({ bundleHash, versionPrefix, sourceSha });
  const pending = pendingPointer({ pointerKey, body, manifestSha256: sha256(manifestPayload) });
  if (!noPointer) {
    const pointerPath = await io.writeText(`current-${targetEnv}.json`, pending.text);
    await io.put(pointerKey, pointerPath, "application/json");
  }
  return {
    ok: true, status: noPointer ? "NO_POINTER_WRITTEN" : "WRITTEN", skipped: false,
    key: manifestKey, sha256: pending.manifest_sha256, versionPrefix, pointerKey, transport: "wrangler-r2",
    uiR2PutCount: uploadItems.length, uploaded: uploadItems.length, reused: summary.reused,
    selectionMode: mode, selectionReason: reason,
    pending_pointer: noPointer ? pending : null,
  };
}

// Flips the pointer only, from a --no-pointer evidence file, after verifying the versioned manifest.
export async function runPointerOnly({ evidence, targetEnv, pointerKey, sourceSha, execute, io }) {
  if (evidence?.schema !== noPointerEvidenceSchema || evidence.targetEnv !== targetEnv) {
    throw new Error("pointer_only_evidence_invalid");
  }
  const pending = evidence.pending_pointer;
  const body = pending?.body;
  if (!body || pending.key !== pointerKey || pending.text !== pointerText(body)
      || !/^[a-f0-9]{64}$/u.test(String(body.manifest_hash ?? ""))
      || !versionPrefixPattern.test(String(body.version_prefix ?? ""))
      || !/^[a-f0-9]{40}$/u.test(String(body.source_sha ?? ""))) {
    throw new Error("pointer_only_evidence_pointer_invalid");
  }
  if (pending.manifest_key !== `${body.version_prefix}/manifest.json`) throw new Error("pointer_only_evidence_manifest_key_mismatch");
  if (execute && body.source_sha !== sourceSha) throw new Error("pointer_only_source_sha_mismatch");

  let manifestText;
  try {
    manifestText = await io.readText(await io.get(pending.manifest_key, "pointer-only-versioned-manifest.json"));
  } catch {
    throw new Error("pointer_only_refused:versioned_manifest_missing");
  }
  if (pending.manifest_sha256 && sha256(manifestText) !== pending.manifest_sha256) {
    throw new Error("pointer_only_refused:versioned_manifest_sha256_mismatch");
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error("pointer_only_refused:versioned_manifest_invalid_json");
  }
  if (manifest?.bundleHash !== body.manifest_hash || manifest?.versionPrefix !== body.version_prefix
      || manifest?.targetEnv !== targetEnv || manifest?.sourceSha !== body.source_sha) {
    throw new Error("pointer_only_refused:versioned_manifest_provenance_mismatch");
  }

  if (!execute) return { ok: true, status: "DRY_RUN_VERIFIED", key: pointerKey, pending_pointer: pending };
  const pointerPath = await io.writeText(`current-${targetEnv}.json`, pending.text);
  await io.put(pointerKey, pointerPath, "application/json");
  return { ok: true, status: "POINTER_WRITTEN", key: pointerKey, versionPrefix: body.version_prefix, bundleHash: body.manifest_hash };
}
