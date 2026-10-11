import type { PersonPublication } from "../../src/content/personPublications";

export const PERSON_EXCHANGE_SCHEMA = "zukan.person-publication-exchange/v1" as const;
const PUBLIC_ID = /^[a-f0-9]{32}$/u;
const ISSUER = /^publisher_[a-zA-Z0-9_-]{8,96}$/u;
const EDITION = /^[a-zA-Z0-9_.:-]{1,120}$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;
const allowedFields = new Set(["publicId", "slug", "edition", "locale", "state", "authority", "name",
  "latinName", "headline", "summary", "paragraphs", "activities", "links", "updatedOn", "identityMode", "discoverability"]);
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u001f]/u.test(v);
const validHref = (href: unknown): href is string => {
  if (!text(href, 500)) return false;
  try { const u = new URL(href); return u.protocol === "https:" && !u.username && !u.password; }
  catch { return false; }
};

export interface PersonEditionEnvelope {
  readonly schema: typeof PERSON_EXCHANGE_SCHEMA;
  /** Opaque public publisher ref; no workspace IDs, source URLs or secrets in public storage. */
  readonly issuerPublicRef: string;
  readonly publicId: string;
  readonly revision: number;
  readonly editionId: string;
  readonly action: "publish" | "withdraw";
  readonly profile: PersonPublication | null;
}
export interface VerifiedPersonIssuer {
  /** Bound by a trusted auth adapter, never copied from request body. */
  readonly issuerPublicRef: string;
  readonly actorAuthorized: true;
  readonly subjectConsent: true;
  readonly ageAuthority: "adult" | "guardian_verified";
}
export interface PersonD1Statement {
  bind(...values: (string | number | null)[]): PersonD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface PersonD1 {
  prepare(query: string): PersonD1Statement;
  batch(statements: PersonD1Statement[]): Promise<unknown[]>;
}
export interface StoredPersonRow {
  readonly public_id: string;
  readonly issuer_public_ref: string;
  readonly current_revision: number;
  readonly edition_id: string;
  readonly digest: string;
  readonly publication_state: "published" | "withdrawn";
  readonly public_json: string;
}
export class PersonExchangeError extends Error {
  constructor(readonly code: string, readonly status: number = 409) { super(code); }
}

function publicProfile(input: PersonPublication | null, publicId: string, editionId: string): PersonPublication | null {
  if (input === null || !isObject(input) || Object.keys(input).some(k => !allowedFields.has(k))) return null;
  if (input.publicId !== publicId || input.edition !== editionId || input.locale !== "ja"
    || input.state !== "published" || input.authority !== "subject_explicit" || !SLUG.test(input.slug)
    || !text(input.name, 80) || !text(input.latinName, 120) || !text(input.headline, 180)
    || !text(input.summary, 2000) || !ISO_DAY.test(input.updatedOn)
    || !["real_name", "alias", "anonymous"].includes(input.identityMode ?? "real_name")
    || !["indexed", "unlisted"].includes(input.discoverability ?? "unlisted")
    || !Array.isArray(input.paragraphs) || input.paragraphs.length > 12
    || input.paragraphs.some(x => !text(x, 2000))
    || !Array.isArray(input.activities) || input.activities.length > 12
    || input.activities.some(x => !isObject(x) || Object.keys(x).some(k => !["title", "text"].includes(k))
      || !text(x.title, 120) || !text(x.text, 1800))
    || !Array.isArray(input.links) || input.links.length > 12
    || input.links.some(x => !isObject(x) || Object.keys(x).some(k => !["label", "href"].includes(k))
      || !text(x.label, 120) || !validHref(x.href))) {
    throw new PersonExchangeError("person_public_profile_invalid", 400);
  }
  // Privacy default: a pseudonym cannot smuggle a romanized legal name.
  if (input.identityMode !== undefined && input.identityMode !== "real_name") {
    return { ...input, latinName: "", slug: "person", ...(input.identityMode === "anonymous"
      ? { name: "匿名", slug: "person", links: [] } : {}) };
  }
  return { ...input, discoverability: input.discoverability ?? "unlisted" };
}
const digest = async (value: string): Promise<string> => Array.from(new Uint8Array(await crypto.subtle.digest(
  "SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");

function assertEnvelope(value: PersonEditionEnvelope, verified: VerifiedPersonIssuer): PersonPublication | null {
  if (!value || value.schema !== PERSON_EXCHANGE_SCHEMA || !ISSUER.test(value.issuerPublicRef)
    || !PUBLIC_ID.test(value.publicId) || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !EDITION.test(value.editionId) || !["publish", "withdraw"].includes(value.action)
    || !verified || verified.actorAuthorized !== true || verified.subjectConsent !== true
    || !["adult", "guardian_verified"].includes(verified.ageAuthority)
    || verified.issuerPublicRef !== value.issuerPublicRef) {
    throw new PersonExchangeError("person_publication_authority_denied", 403);
  }
  if (value.action === "withdraw") {
    if (value.profile !== null) throw new PersonExchangeError("person_withdraw_must_not_carry_profile", 400);
    return null;
  }
  const profile = publicProfile(value.profile, value.publicId, value.editionId);
  if (!profile) throw new PersonExchangeError("person_public_profile_invalid", 400);
  return profile;
}

export async function receivePersonEdition(db: PersonD1, incoming: PersonEditionEnvelope,
  verified: VerifiedPersonIssuer): Promise<"created" | "updated" | "replayed"> {
  const profile = assertEnvelope(incoming, verified);
  const json = profile === null ? "{}" : JSON.stringify(profile);
  if (new TextEncoder().encode(json).length > 32_000) throw new PersonExchangeError("person_public_profile_too_large", 413);
  const sha = await digest(JSON.stringify({ publicId: incoming.publicId, issuer: incoming.issuerPublicRef,
    revision: incoming.revision, edition: incoming.editionId, action: incoming.action, json }));
  const existing = await db.prepare("SELECT * FROM zukan_person_publications WHERE public_id = ?").bind(incoming.publicId).first<StoredPersonRow>();
  if (existing && existing.issuer_public_ref !== incoming.issuerPublicRef) throw new PersonExchangeError("person_issuer_conflict");
  if (existing && existing.current_revision >= incoming.revision) {
    if (existing.current_revision === incoming.revision && existing.digest === sha && existing.edition_id === incoming.editionId) return "replayed";
    throw new PersonExchangeError("person_edition_stale_or_conflicting");
  }
  const state = incoming.action === "withdraw" ? "withdrawn" : "published";
  await db.batch([
    db.prepare("INSERT INTO zukan_person_publications "
      + "(public_id, issuer_public_ref, current_revision, edition_id, digest, publication_state, public_json, updated_at) "
      + "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "
      + "ON CONFLICT(public_id) DO UPDATE SET "
      + "current_revision=excluded.current_revision, edition_id=excluded.edition_id, digest=excluded.digest, "
      + "publication_state=excluded.publication_state, public_json=excluded.public_json, updated_at=excluded.updated_at "
      + "WHERE zukan_person_publications.issuer_public_ref=excluded.issuer_public_ref "
      + "AND zukan_person_publications.current_revision < excluded.current_revision")
      .bind(incoming.publicId, incoming.issuerPublicRef, incoming.revision, incoming.editionId, sha, state, json),
    db.prepare("INSERT OR IGNORE INTO zukan_person_publication_editions "
      + "(public_id, revision, issuer_public_ref, edition_id, digest, publication_state, public_json, published_at) "
      + "SELECT public_id, current_revision, issuer_public_ref, edition_id, digest, publication_state, public_json, CURRENT_TIMESTAMP "
      + "FROM zukan_person_publications WHERE public_id=? AND current_revision=? AND digest=?")
      .bind(incoming.publicId, incoming.revision, sha),
  ]);
  const saved = await db.prepare("SELECT * FROM zukan_person_publications WHERE public_id = ?").bind(incoming.publicId).first<StoredPersonRow>();
  if (!saved || saved.issuer_public_ref !== incoming.issuerPublicRef || saved.current_revision !== incoming.revision
    || saved.digest !== sha || saved.edition_id !== incoming.editionId || saved.publication_state !== state) {
    throw new PersonExchangeError("person_edition_readback_conflict");
  }
  return existing ? "updated" : "created";
}

/** Indexed point lookup; withdrawn rows suppress legacy static fallbacks. */
export async function readPersonEdition(db: PersonD1, publicId: string): Promise<{ found: boolean; profile: PersonPublication | null }> {
  if (!PUBLIC_ID.test(publicId)) return { found: false, profile: null };
  const row = await db.prepare("SELECT * FROM zukan_person_publications WHERE public_id = ?").bind(publicId).first<StoredPersonRow>();
  if (!row) return { found: false, profile: null };
  if (row.publication_state !== "published") return { found: true, profile: null };
  const parsed: unknown = JSON.parse(row.public_json);
  return { found: true, profile: publicProfile(parsed as PersonPublication, row.public_id, row.edition_id) };
}
