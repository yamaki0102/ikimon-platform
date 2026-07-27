import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
}
function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

type Artifact = { id: string; value: unknown; digest: string };
class Vault {
  private items = new Map<string, Artifact>();
  put(id: string, value: unknown) { const item = { id, value, digest: hash(value) }; this.items.set(id, item); return item; }
  get(id: string) { return this.items.get(id) ?? null; }
  destroy(id: string) { this.items.delete(id); }
}

type Claim = {
  id: string; revision: number; subjectId: string; predicateUri: string; predicateVersion: number;
  artifactId: string | null; observedAt: string; recordedAt: string; sequence: number;
  authorityIds: readonly string[];
};
class ClaimStore {
  private sequence = 0;
  private claims: Claim[] = [];
  constructor(private vault: Vault) {}
  append(input: Omit<Claim, "revision" | "sequence" | "artifactId"> & { artifactId: string; value: unknown }): Claim {
    const previous = this.claims.filter((c) => c.id === input.id).sort((a, b) => b.revision - a.revision)[0];
    this.vault.put(input.artifactId, input.value);
    const claim: Claim = { ...input, artifactId: input.artifactId, revision: (previous?.revision ?? 0) + 1, sequence: ++this.sequence };
    delete (claim as Claim & { value?: unknown }).value;
    this.claims.push(claim);
    return claim;
  }
  watermark() { return this.sequence; }
  latest(subjectId: string, predicateUri: string, watermark: number) {
    const latest = new Map<string, Claim>();
    for (const claim of this.claims.filter((c) => c.subjectId === subjectId && c.predicateUri === predicateUri && c.sequence <= watermark)) {
      const current = latest.get(claim.id);
      if (!current || current.revision < claim.revision) latest.set(claim.id, claim);
    }
    return [...latest.values()];
  }
}

type Predicate = {
  uri: string; version: number; valueType: "string" | "number" | "boolean" | "json";
  enumValues?: readonly string[]; cardinality: "one" | "many"; polarity: boolean;
  temporal: "atemporal" | "valid-time" | "observation-time" | "bitemporal";
};
function predicateEvolution(previous: Predicate, next: Predicate) {
  const reasons: string[] = [];
  let newUri = false;
  if (next.version <= previous.version) reasons.push("version_must_increase");
  if (previous.valueType !== next.valueType) { newUri = true; reasons.push("value_type_changed"); }
  if (previous.cardinality === "many" && next.cardinality === "one") { newUri = true; reasons.push("cardinality_narrowed"); }
  if (previous.polarity !== next.polarity) { newUri = true; reasons.push("polarity_changed"); }
  if (previous.temporal !== next.temporal) { newUri = true; reasons.push("temporal_profile_changed"); }
  if (previous.enumValues && next.enumValues && previous.enumValues.some((v) => !next.enumValues?.includes(v))) {
    newUri = true; reasons.push("value_schema_narrowed");
  }
  if (newUri && previous.uri === next.uri) reasons.push("new_predicate_uri_required");
  return { newUri, reasons };
}

type Authority = {
  id: string; rank: number; validFrom: string; validTo: string | null;
  revokedAt: string | null; revocation: "prospective" | "retroactive" | null;
};
function authorityEffective(authority: Authority, targetTime: string, evaluatedAt: string) {
  if (targetTime < authority.validFrom || (authority.validTo && targetTime >= authority.validTo)) return false;
  if (!authority.revokedAt || evaluatedAt < authority.revokedAt) return true;
  if (authority.revocation === "retroactive") return false;
  return authority.revocation === "prospective" ? targetTime < authority.revokedAt : true;
}

type IdentityAssertion = {
  publicId: string; mode: "resolved" | "ambiguous" | "redirect"; setId: string | null;
  subjects: readonly string[]; successor: string | null; from: string; to: string | null;
};
class IdentityLedger {
  assertions: IdentityAssertion[] = [];
  resolve(publicId: string, at: string) {
    const current = this.assertions.filter((a) => a.publicId === publicId && a.from <= at && (!a.to || at < a.to))
      .sort((a, b) => b.from.localeCompare(a.from))[0];
    if (!current) return { http: 404, status: "unknown" as const };
    if (current.mode === "redirect") return { http: 308, status: "redirect" as const, successor: current.successor };
    if (current.mode === "ambiguous") return { http: 200, status: "ambiguous" as const, candidates: current.subjects };
    return { http: 200, status: "resolved" as const, setId: current.setId, subjects: current.subjects };
  }
}

type Policy = { id: string; version: number; priority: "recency" | "authority"; evaluator: string };
function resolve(input: {
  runId: string; store: ClaimStore; vault: Vault; subjectId: string; predicate: Predicate; watermark: number;
  recordedTimeWatermark: string; policy: Policy; authorities: readonly Authority[]; targetTime: string; evaluatedAt: string;
}) {
  const ranked = input.store.latest(input.subjectId, input.predicate.uri, input.watermark)
    .filter((claim) => claim.predicateVersion === input.predicate.version)
    .map((claim) => ({
      claim,
      rank: claim.authorityIds.map((id) => input.authorities.find((a) => a.id === id)).filter((a): a is Authority => Boolean(a))
        .filter((a) => authorityEffective(a, input.targetTime, input.evaluatedAt)).reduce((max, a) => Math.max(max, a.rank), 0),
    }))
    .sort((a, b) => {
      if (input.policy.priority === "authority" && a.rank !== b.rank) return b.rank - a.rank;
      const time = b.claim.observedAt.localeCompare(a.claim.observedAt);
      if (time !== 0) return time;
      if (input.policy.priority === "recency" && a.rank !== b.rank) return b.rank - a.rank;
      return `${a.claim.id}@${a.claim.revision}`.localeCompare(`${b.claim.id}@${b.claim.revision}`);
    });
  let status: "empty" | "resolved" | "disputed" = ranked.length ? "resolved" : "empty";
  let accepted = ranked.length ? [`${ranked[0].claim.id}@${ranked[0].claim.revision}`] : [];
  if (ranked.length > 1) {
    const [a, b] = ranked;
    const av = a.claim.artifactId ? input.vault.get(a.claim.artifactId)?.value : undefined;
    const bv = b.claim.artifactId ? input.vault.get(b.claim.artifactId)?.value : undefined;
    if (a.rank === b.rank && a.claim.observedAt === b.claim.observedAt && canonical(av) !== canonical(bv)) {
      status = "disputed"; accepted = [];
    }
  }
  const candidates = ranked.map(({ claim }) => `${claim.id}@${claim.revision}`);
  const body = {
    runId: input.runId, subjectId: input.subjectId, predicate: `${input.predicate.uri}@${input.predicate.version}`,
    claimStoreSnapshotToken: `claim-seq:${input.watermark}`, claimStoreSequenceWatermark: input.watermark,
    recordedTimeWatermark: input.recordedTimeWatermark, candidateQuery: "claim-by-subject-predicate@1",
    predicateRegistryHash: hash(input.predicate), authorityHash: hash(input.authorities),
    policy: `${input.policy.id}@${input.policy.version}`, evaluator: input.policy.evaluator,
    candidates, accepted, rejected: candidates.filter((ref) => !accepted.includes(ref)), status,
    disputeCaseId: status === "disputed" ? `dispute:${input.runId}` : null,
  };
  return { ...body, outputHash: hash(body) };
}

type Snapshot = { id: string; entries: readonly { field: string; claimRef: string; artifactId: string }[]; hash: string };
function snapshot(id: string, entries: Snapshot["entries"]): Snapshot { const body = { id, entries }; return { ...body, hash: hash(body) }; }
type StatusEvent = { id: string; snapshotId: string; action: "suppress" | "redact" | "erase"; claimRefs: readonly string[]; at: string };
function replay(s: Snapshot, vault: Vault, events: readonly StatusEvent[], access: "public" | "internal") {
  const fields: Record<string, unknown> = {}; const missing: string[] = []; let reproducibility: "full" | "redacted" | "degraded" = "full";
  for (const entry of s.entries) {
    const actions = events.filter((e) => e.snapshotId === s.id && e.claimRefs.includes(entry.claimRef));
    const erase = actions.find((e) => e.action === "erase"); const redact = actions.find((e) => e.action === "redact");
    const suppress = actions.find((e) => e.action === "suppress");
    if (erase) { reproducibility = "degraded"; fields[entry.field] = { status: "erased", at: erase.at }; missing.push(entry.field); continue; }
    if (redact) { if (reproducibility === "full") reproducibility = "redacted"; fields[entry.field] = { status: "redacted", at: redact.at }; missing.push(entry.field); continue; }
    if (suppress && access === "public") { fields[entry.field] = { status: "suppressed", at: suppress.at }; missing.push(entry.field); continue; }
    const artifact = vault.get(entry.artifactId);
    if (!artifact) { reproducibility = "degraded"; fields[entry.field] = { status: "unavailable" }; missing.push(entry.field); continue; }
    fields[entry.field] = artifact.value;
  }
  return { originalSnapshotHash: s.hash, reproducibility, fields, missing };
}

type Survey = { subjectId: string; at: string; outcome: "detected" | "not_detected" | "indeterminate"; effortMinutes: number };
const contradict = (a: Survey, b: Survey) => a.subjectId === b.subjectId && a.at === b.at && a.outcome !== b.outcome;
const coverage = (applicable: boolean, surveys: readonly Survey[]) => !applicable ? "not_applicable" : surveys.length ? "assessed" : "unassessed";
const publicationTreatment = (pending: boolean, policy: "suppress" | "annotate" | "retain") => pending ? policy : "retain";

type Rights = { objectId: string; purpose: "metadata" | "preservation" | "publication" | "embedding"; basis: "allowed" | "denied" | "unknown"; validTo: string | null };
function rights(objectId: string, purpose: Rights["purpose"], at: string, bases: readonly Rights[], metadataSafe = false) {
  const basis = bases.find((b) => b.objectId === objectId && b.purpose === purpose);
  if (!basis) return purpose === "metadata" && metadataSafe ? "allow" : "review";
  if (basis.validTo && at >= basis.validTo) return "deny";
  return basis.basis === "allowed" ? "allow" : basis.basis === "denied" ? "deny" : purpose === "metadata" && metadataSafe ? "allow" : "review";
}

const hours: Predicate = { uri: "https://zukan.earth/predicate/opening-hours", version: 1, valueType: "string", cardinality: "one", polarity: false, temporal: "valid-time" };
function add(store: ClaimStore, id: string, value: unknown, artifactId: string, observedAt: string, authorityIds: readonly string[] = []) {
  return store.append({ id, subjectId: "subject:shop", predicateUri: hours.uri, predicateVersion: 1, artifactId, value, observedAt, recordedAt: observedAt, authorityIds });
}

test("#16 identity split preserves publication and resolves the old handle with HTTP 200 ambiguity", () => {
  const ledger = new IdentityLedger();
  ledger.assertions.push(
    { publicId: "place:old", mode: "resolved", setId: "set:1", subjects: ["subject:a", "subject:b"], successor: null, from: "2024-01-01", to: "2027-01-01" },
    { publicId: "place:old", mode: "ambiguous", setId: null, subjects: ["subject:a", "subject:b"], successor: null, from: "2027-01-01", to: null },
  );
  const vault = new Vault(); vault.put("artifact:name", "統合時の表示名");
  const issued = snapshot("snapshot:2025", [{ field: "name", claimRef: "claim:name@1", artifactId: "artifact:name" }]);
  assert.equal(ledger.resolve("place:old", "2025-01-01").status, "resolved");
  const current = ledger.resolve("place:old", "2027-02-01");
  assert.equal(current.http, 200); assert.equal(current.status, "ambiguous");
  assert.equal(replay(issued, vault, [], "public").originalSnapshotHash, issued.hash);
});

test("#17 non-detection in 2024 and detection in 2026 are not contradictory", () => {
  const a: Survey = { subjectId: "taxon:dragonfly", at: "2024-06-01", outcome: "not_detected", effortMinutes: 30 };
  const b: Survey = { subjectId: "taxon:dragonfly", at: "2026-06-01", outcome: "detected", effortMinutes: 30 };
  assert.equal(contradict(a, b), false); assert.equal(coverage(true, [a, b]), "assessed");
  assert.equal(coverage(true, []), "unassessed"); assert.equal(coverage(false, []), "not_applicable");
});

test("#18 unresolved correction follows a versioned publication gate", () => {
  assert.equal(publicationTreatment(true, "suppress"), "suppress");
  assert.equal(publicationTreatment(true, "annotate"), "annotate");
});

test("#19 destructive predicate changes require a new URI", () => {
  const changed: Predicate = { ...hours, version: 2, polarity: true };
  const result = predicateEvolution(hours, changed);
  assert.equal(result.newUri, true); assert.ok(result.reasons.includes("new_predicate_uri_required"));
  const vault = new Vault(); const store = new ClaimStore(vault); const claim = add(store, "claim:v1", "09:00-17:00", "artifact:v1", "2026-01-01");
  assert.equal(claim.predicateVersion, 1);
});

test("#20 claim-store watermark makes policy runs deterministic", () => {
  const vault = new Vault(); const store = new ClaimStore(vault);
  const authority: Authority = { id: "authority:operator", rank: 100, validFrom: "2024-01-01", validTo: null, revokedAt: null, revocation: null };
  add(store, "claim:old-authority", "09:00-17:00", "artifact:old", "2025-01-01", [authority.id]);
  add(store, "claim:new-recency", "10:00-18:00", "artifact:new", "2026-01-01");
  const watermark = store.watermark();
  const base = { store, vault, subjectId: "subject:shop", predicate: hours, watermark, recordedTimeWatermark: "2026-01-01", authorities: [authority], targetTime: "2026-06-01", evaluatedAt: "2026-06-01" };
  const recency = resolve({ ...base, runId: "run:recency", policy: { id: "hours", version: 1, priority: "recency", evaluator: "build:a" } });
  const trusted = resolve({ ...base, runId: "run:authority", policy: { id: "hours", version: 2, priority: "authority", evaluator: "build:a" } });
  assert.notDeepEqual(recency.accepted, trusted.accepted);
  add(store, "claim:later", "24 hours", "artifact:later", "2026-07-01");
  const replayRun = resolve({ ...base, runId: "run:recency", policy: { id: "hours", version: 1, priority: "recency", evaluator: "build:a" } });
  assert.equal(replayRun.outputHash, recency.outputHash); assert.ok(!replayRun.candidates.includes("claim:later@1"));
});

test("#21 publication expiry blocks new output while preservation remains allowed", () => {
  const bases: Rights[] = [
    { objectId: "source:pdf", purpose: "publication", basis: "allowed", validTo: "2027-01-01" },
    { objectId: "source:pdf", purpose: "preservation", basis: "allowed", validTo: null },
    { objectId: "derived:embedding", purpose: "embedding", basis: "unknown", validTo: null },
  ];
  assert.equal(rights("source:pdf", "publication", "2027-02-01", bases), "deny");
  assert.equal(rights("source:pdf", "preservation", "2027-02-01", bases), "allow");
  assert.equal(rights("derived:embedding", "embedding", "2026-07-01", bases), "review");
  assert.equal(rights("missing", "metadata", "2026-07-01", bases, true), "allow");
});

test("#22 erasure degrades replay without rewriting the issued snapshot", () => {
  const vault = new Vault(); vault.put("artifact:name", "Example Shop"); vault.put("artifact:minor", "Minor Name");
  const issued = snapshot("snapshot:2027", [
    { field: "name", claimRef: "claim:name@1", artifactId: "artifact:name" },
    { field: "person", claimRef: "claim:person@1", artifactId: "artifact:minor" },
  ]);
  const originalHash = issued.hash; vault.destroy("artifact:minor");
  const event: StatusEvent = { id: "erase:1", snapshotId: issued.id, action: "erase", claimRefs: ["claim:person@1"], at: "2027-05-01" };
  const result = replay(issued, vault, [event], "public");
  assert.equal(issued.hash, originalHash); assert.equal(result.reproducibility, "degraded"); assert.deepEqual(result.missing, ["person"]);
});

test("#23 prospective authority revocation preserves the valid past period", () => {
  const authority: Authority = { id: "authority:delegate", rank: 100, validFrom: "2025-01-01", validTo: null, revokedAt: "2027-01-01", revocation: "prospective" };
  assert.equal(authorityEffective(authority, "2026-06-01", "2028-01-01"), true);
  assert.equal(authorityEffective(authority, "2027-02-01", "2028-01-01"), false);
  assert.equal(authorityEffective({ ...authority, revocation: "retroactive" }, "2026-06-01", "2028-01-01"), false);
});

test("#24 equal-authority conflicting claims open a DisputeCase", () => {
  const vault = new Vault(); const store = new ClaimStore(vault);
  const city: Authority = { id: "authority:city", rank: 100, validFrom: "2024-01-01", validTo: null, revokedAt: null, revocation: null };
  const shop: Authority = { ...city, id: "authority:shop" };
  add(store, "claim:city", "09:00-17:00", "artifact:city", "2026-06-01", [city.id]);
  add(store, "claim:shop", "10:00-18:00", "artifact:shop", "2026-06-01", [shop.id]);
  const run = resolve({ runId: "run:conflict", store, vault, subjectId: "subject:shop", predicate: hours, watermark: store.watermark(), recordedTimeWatermark: "2026-06-01", policy: { id: "no-tie-break", version: 1, priority: "authority", evaluator: "build:a" }, authorities: [city, shop], targetTime: "2026-06-01", evaluatedAt: "2026-06-01" });
  assert.equal(run.status, "disputed"); assert.deepEqual(run.accepted, []); assert.equal(run.disputeCaseId, "dispute:run:conflict");
});
