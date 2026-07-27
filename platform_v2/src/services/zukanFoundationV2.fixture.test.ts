import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");

class Vault {
  private readonly values = new Map<string, unknown>();
  put(id: string, value: unknown) { this.values.set(id, value); }
  get(id: string) { return this.values.get(id); }
  erase(id: string) { this.values.delete(id); }
}
type Claim = { id: string; rev: number; subject: string; predicate: string; predicateVersion: number; artifact: string; observedAt: string; seq: number; authorities: readonly string[] };
class ClaimStore {
  private seq = 0;
  private readonly claims: Claim[] = [];
  constructor(private readonly vault: Vault) {}
  append(input: Omit<Claim, "rev" | "seq"> & { value: unknown }): Claim {
    const rev = (this.claims.filter((x) => x.id === input.id).sort((a, b) => b.rev - a.rev)[0]?.rev ?? 0) + 1;
    this.vault.put(input.artifact, input.value);
    const { value: _value, ...stored } = input;
    const claim = { ...stored, rev, seq: ++this.seq };
    this.claims.push(claim);
    return claim;
  }
  watermark() { return this.seq; }
  latest(subject: string, predicate: string, watermark: number) {
    const result = new Map<string, Claim>();
    for (const claim of this.claims.filter((x) => x.subject === subject && x.predicate === predicate && x.seq <= watermark)) {
      if ((result.get(claim.id)?.rev ?? 0) < claim.rev) result.set(claim.id, claim);
    }
    return [...result.values()];
  }
}

type Predicate = { uri: string; version: number; type: "string" | "number"; cardinality: "one" | "many"; polarity: boolean; temporal: "valid" | "observed"; values?: readonly string[] };
function predicateChange(oldDef: Predicate, next: Predicate) {
  const breaking = oldDef.type !== next.type || (oldDef.cardinality === "many" && next.cardinality === "one") || oldDef.polarity !== next.polarity || oldDef.temporal !== next.temporal || Boolean(oldDef.values?.some((v) => !next.values?.includes(v)));
  return { breaking, valid: !breaking || oldDef.uri !== next.uri };
}
type Authority = { id: string; rank: number; from: string; to: string | null; revokedAt: string | null; mode: "prospective" | "retroactive" | null };
function authorityValid(a: Authority, target: string, evaluatedAt: string) {
  if (target < a.from || (a.to !== null && target >= a.to)) return false;
  if (a.revokedAt === null || evaluatedAt < a.revokedAt) return true;
  return a.mode === "prospective" ? target < a.revokedAt : false;
}

type Identity = { publicId: string; status: "resolved" | "ambiguous" | "redirect"; subjects: readonly string[]; successor: string | null; from: string; to: string | null };
function resolveIdentity(assertions: readonly Identity[], publicId: string, at: string) {
  const current = assertions.filter((x) => x.publicId === publicId && x.from <= at && (x.to === null || at < x.to)).sort((a, b) => b.from.localeCompare(a.from))[0];
  if (!current) return { http: 404, status: "unknown" as const };
  if (current.status === "redirect") return { http: 308, status: current.status, successor: current.successor };
  return { http: 200, status: current.status, subjects: current.subjects };
}

type Policy = { id: string; version: number; priority: "recency" | "authority"; build: string };
function runResolution(input: { id: string; store: ClaimStore; vault: Vault; subject: string; predicate: Predicate; watermark: number; policy: Policy; authorities: readonly Authority[]; target: string; evaluatedAt: string }) {
  const ranked = input.store.latest(input.subject, input.predicate.uri, input.watermark).filter((x) => x.predicateVersion === input.predicate.version).map((claim) => ({ claim, rank: claim.authorities.map((id) => input.authorities.find((a) => a.id === id)).filter((a): a is Authority => a !== undefined).filter((a) => authorityValid(a, input.target, input.evaluatedAt)).reduce((n, a) => Math.max(n, a.rank), 0) })).sort((a, b) => input.policy.priority === "authority" && a.rank !== b.rank ? b.rank - a.rank : b.claim.observedAt.localeCompare(a.claim.observedAt) || (input.policy.priority === "recency" ? b.rank - a.rank : 0) || a.claim.id.localeCompare(b.claim.id));
  let disputed = false;
  if (ranked.length > 1) {
    const a = ranked[0]!; const b = ranked[1]!;
    disputed = a.rank === b.rank && a.claim.observedAt === b.claim.observedAt && canonical(input.vault.get(a.claim.artifact)) !== canonical(input.vault.get(b.claim.artifact));
  }
  const candidates = ranked.map((x) => `${x.claim.id}@${x.claim.rev}`);
  const accepted = disputed || ranked.length === 0 ? [] : [candidates[0]!];
  const body = { id: input.id, snapshotToken: `claim-seq:${input.watermark}`, watermark: input.watermark, predicate: `${input.predicate.uri}@${input.predicate.version}`, registryHash: digest(input.predicate), authorityHash: digest(input.authorities), policy: `${input.policy.id}@${input.policy.version}`, build: input.policy.build, candidates, accepted, dispute: disputed ? `dispute:${input.id}` : null };
  return { ...body, hash: digest(body) };
}

type Snapshot = { id: string; hash: string; entries: readonly { field: string; claim: string; artifact: string }[] };
type Governance = { snapshot: string; claim: string; action: "suppress" | "redact" | "erase"; at: string };
function makeSnapshot(id: string, entries: Snapshot["entries"]): Snapshot { return { id, entries, hash: digest({ id, entries }) }; }
function replay(snapshot: Snapshot, vault: Vault, events: readonly Governance[], access: "public" | "internal") {
  let reproducibility: "full" | "redacted" | "degraded" = "full"; const missing: string[] = [];
  for (const entry of snapshot.entries) {
    const actions = events.filter((x) => x.snapshot === snapshot.id && x.claim === entry.claim);
    if (actions.some((x) => x.action === "erase") || vault.get(entry.artifact) === undefined) { reproducibility = "degraded"; missing.push(entry.field); }
    else if (actions.some((x) => x.action === "redact")) { if (reproducibility === "full") reproducibility = "redacted"; missing.push(entry.field); }
    else if (access === "public" && actions.some((x) => x.action === "suppress")) missing.push(entry.field);
  }
  return { snapshotHash: snapshot.hash, reproducibility, missing };
}

type Survey = { subject: string; at: string; outcome: "detected" | "not_detected" | "indeterminate" };
const contradict = (a: Survey, b: Survey) => a.subject === b.subject && a.at === b.at && a.outcome !== b.outcome;
const coverage = (applicable: boolean, surveys: readonly Survey[]) => applicable ? (surveys.length ? "assessed" : "unassessed") : "not_applicable";
type Right = { object: string; purpose: "metadata" | "preservation" | "publication" | "embedding"; basis: "allowed" | "denied" | "unknown"; to: string | null };
function right(object: string, purpose: Right["purpose"], at: string, rights: readonly Right[], metadataSafe = false) { const found = rights.find((x) => x.object === object && x.purpose === purpose); if (!found) return purpose === "metadata" && metadataSafe ? "allow" : "review"; if (found.to !== null && at >= found.to) return "deny"; return found.basis === "allowed" ? "allow" : found.basis === "denied" ? "deny" : purpose === "metadata" && metadataSafe ? "allow" : "review"; }

const hours: Predicate = { uri: "https://zukan.earth/predicate/opening-hours", version: 1, type: "string", cardinality: "one", polarity: false, temporal: "valid" };
function claim(store: ClaimStore, id: string, value: unknown, observedAt: string, authorities: readonly string[] = []) { return store.append({ id, subject: "shop", predicate: hours.uri, predicateVersion: 1, artifact: `artifact:${id}`, value, observedAt, authorities }); }

test("#16 split keeps old publication reproducible and returns 200 ambiguity", () => { const assertions: Identity[] = [{ publicId: "old", status: "resolved", subjects: ["a", "b"], successor: null, from: "2024", to: "2027" }, { publicId: "old", status: "ambiguous", subjects: ["a", "b"], successor: null, from: "2027", to: null }]; const vault = new Vault(); vault.put("name", "old name"); const issued = makeSnapshot("2025", [{ field: "name", claim: "name@1", artifact: "name" }]); assert.equal(resolveIdentity(assertions, "old", "2028").status, "ambiguous"); assert.equal(replay(issued, vault, [], "public").snapshotHash, issued.hash); });
test("#17 non-detection then later detection is not a contradiction", () => { const a: Survey = { subject: "taxon", at: "2024", outcome: "not_detected" }; const b: Survey = { subject: "taxon", at: "2026", outcome: "detected" }; assert.equal(contradict(a, b), false); assert.equal(coverage(true, [a, b]), "assessed"); assert.equal(coverage(true, []), "unassessed"); });
test("#18 pending dispute obeys versioned publication gate", () => { const gate = (pending: boolean, policy: "suppress" | "annotate") => pending ? policy : "retain"; assert.equal(gate(true, "suppress"), "suppress"); assert.equal(gate(true, "annotate"), "annotate"); });
test("#19 destructive predicate change requires another URI", () => { assert.deepEqual(predicateChange(hours, { ...hours, version: 2, polarity: true }), { breaking: true, valid: false }); const vault = new Vault(); const store = new ClaimStore(vault); assert.equal(claim(store, "legacy", "09-17", "2026").predicateVersion, 1); });
test("#20 policy and claim watermark make replay deterministic", () => { const vault = new Vault(); const store = new ClaimStore(vault); const authority: Authority = { id: "owner", rank: 100, from: "2020", to: null, revokedAt: null, mode: null }; claim(store, "official", "09-17", "2025", [authority.id]); claim(store, "recent", "10-18", "2026"); const watermark = store.watermark(); const base = { store, vault, subject: "shop", predicate: hours, watermark, authorities: [authority], target: "2026", evaluatedAt: "2026" }; const recency = runResolution({ ...base, id: "run", policy: { id: "hours", version: 1, priority: "recency", build: "a" } }); const trusted = runResolution({ ...base, id: "trusted", policy: { id: "hours", version: 2, priority: "authority", build: "a" } }); assert.notDeepEqual(recency.accepted, trusted.accepted); claim(store, "later", "24h", "2027"); assert.equal(runResolution({ ...base, id: "run", policy: { id: "hours", version: 1, priority: "recency", build: "a" } }).hash, recency.hash); });
test("#21 publication expiry does not remove preservation", () => { const rights: Right[] = [{ object: "pdf", purpose: "publication", basis: "allowed", to: "2027" }, { object: "pdf", purpose: "preservation", basis: "allowed", to: null }, { object: "embedding", purpose: "embedding", basis: "unknown", to: null }]; assert.equal(right("pdf", "publication", "2028", rights), "deny"); assert.equal(right("pdf", "preservation", "2028", rights), "allow"); assert.equal(right("embedding", "embedding", "2026", rights), "review"); });
test("#22 erase produces degraded replay without changing snapshot hash", () => { const vault = new Vault(); vault.put("public", "shop"); vault.put("minor", "name"); const issued = makeSnapshot("spring", [{ field: "name", claim: "name@1", artifact: "public" }, { field: "person", claim: "person@1", artifact: "minor" }]); const before = issued.hash; vault.erase("minor"); const result = replay(issued, vault, [{ snapshot: issued.id, claim: "person@1", action: "erase", at: "2027" }], "public"); assert.equal(issued.hash, before); assert.equal(result.reproducibility, "degraded"); assert.deepEqual(result.missing, ["person"]); });
test("#23 prospective revocation does not invalidate the valid past", () => { const a: Authority = { id: "delegate", rank: 100, from: "2025", to: null, revokedAt: "2027", mode: "prospective" }; assert.equal(authorityValid(a, "2026", "2028"), true); assert.equal(authorityValid(a, "2028", "2028"), false); assert.equal(authorityValid({ ...a, mode: "retroactive" }, "2026", "2028"), false); });
test("#24 equal-authority conflict becomes a DisputeCase", () => { const vault = new Vault(); const store = new ClaimStore(vault); const city: Authority = { id: "city", rank: 100, from: "2020", to: null, revokedAt: null, mode: null }; const owner: Authority = { ...city, id: "owner" }; claim(store, "city", "09-17", "2026", [city.id]); claim(store, "owner", "10-18", "2026", [owner.id]); const result = runResolution({ id: "conflict", store, vault, subject: "shop", predicate: hours, watermark: store.watermark(), policy: { id: "no-tie", version: 1, priority: "authority", build: "a" }, authorities: [city, owner], target: "2026", evaluatedAt: "2026" }); assert.equal(result.dispute, "dispute:conflict"); assert.deepEqual(result.accepted, []); });
