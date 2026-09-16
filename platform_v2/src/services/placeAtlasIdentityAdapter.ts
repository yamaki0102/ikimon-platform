import {
  normalizePlaceAtlasRef,
  type PlaceAtlasProfile,
  type PlaceAtlasRef,
} from "./placeAtlasContract.js";
import {
  type AssertionTime,
  type EvidenceRef,
  type PlaceExternalIdentifier,
  type PlaceIdentity,
  type PlaceNameAssertion,
} from "./globalPlaceIdentity.js";

export const PLACE_ATLAS_IDENTITY_ADAPTER_VERSION = "place_atlas_identity_adapter/source-0" as const;

export type PlaceAtlasIdentityAdapterFailure =
  | "canonical_identity_missing"
  | "canonical_identity_mismatch"
  | "place_atlas_ref_invalid"
  | "place_name_missing"
  | "generated_at_invalid"
  | "evidence_missing"
  | "evidence_invalid"
  | "publication_suppressed";

export type PlaceAtlasIdentityAdapterResult =
  | {
      status: "mapped";
      adapterVersion: typeof PLACE_ATLAS_IDENTITY_ADAPTER_VERSION;
      mappingMode: "source_ref_only";
      identity: PlaceIdentity;
      sourceRef: PlaceAtlasRef;
      evidence: EvidenceRef[];
      nameAssertions: PlaceNameAssertion[];
      externalIdentifiers: PlaceExternalIdentifier[];
      recordBindings: [];
    }
  | {
      status: "unresolved";
      adapterVersion: typeof PLACE_ATLAS_IDENTITY_ADAPTER_VERSION;
      reason: PlaceAtlasIdentityAdapterFailure;
    };

type SourceReference = NonNullable<PlaceAtlasProfile["provenance"]["sourceReferences"]>[number];

function nonEmptyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function validDate(value: string): boolean {
  return value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

function assertionTime(recordedAt: string): AssertionTime {
  return {
    validTime: { start: null, end: null },
    recordedTime: { start: recordedAt, end: null },
    observedTime: null,
  };
}

function isVerifiedStatus(value: string): boolean {
  return value === "source_verified" || value === "administrator_verified";
}

function toEvidence(source: SourceReference): EvidenceRef | null {
  const sourceType = nonEmptyText(source.sourceType);
  const sourceId = nonEmptyText(source.sourceId);
  if (!sourceType || !sourceId || !Number.isFinite(source.confidence) || source.confidence < 0 || source.confidence > 1) {
    return null;
  }
  return {
    sourceType,
    sourceId,
    sourceUrl: source.sourceUrl ?? null,
    confidence: source.confidence,
    note: source.verificationStatus ? `place_atlas_verification:${source.verificationStatus}` : undefined,
  };
}

function externalIdentifierScheme(ref: PlaceAtlasRef): string {
  if (ref.kind === "field") return "place_atlas.field";
  if (ref.kind === "osm_area") return "place_atlas.osm_area";
  return "place_atlas.public_cell";
}

function externalIdentifierValue(ref: PlaceAtlasRef): string {
  if (ref.kind === "field") return ref.fieldId;
  if (ref.kind === "osm_area") return ref.entityKey;
  return ref.cellId;
}

function nameAssertions(
  profile: PlaceAtlasProfile,
  placeId: string,
  time: AssertionTime,
  evidence: EvidenceRef[],
  status: PlaceNameAssertion["status"],
): PlaceNameAssertion[] {
  const assertions: PlaceNameAssertion[] = [];
  const seen = new Set<string>();
  const add = (name: unknown, nameType: PlaceNameAssertion["nameType"], language: string | null = null) => {
    const normalizedName = nonEmptyText(name);
    const normalizedLanguage = nonEmptyText(language);
    if (!normalizedName) return;
    const key = `${nameType}|${normalizedLanguage ?? ""}|${normalizedName}`;
    if (seen.has(key)) return;
    seen.add(key);
    assertions.push({
      placeId,
      name: normalizedName,
      nameType,
      language: normalizedLanguage,
      script: null,
      time,
      evidence,
      status,
    });
  };

  add(profile.place.name, "canonical");
  for (const alias of profile.place.aliases ?? []) add(alias, "common");
  for (const [language, name] of Object.entries(profile.place.multilingualNames ?? {})) {
    add(name, "common", language);
  }
  return assertions;
}

/**
 * Maps a Place Atlas profile into Global Place assertions only when both sides
 * already carry the same explicit canonical identity. Names, geometry, slugs,
 * addresses, and OSM identifiers are never used to create or reconcile identity.
 */
export function adaptPlaceAtlasProfileToGlobalIdentity(
  profile: PlaceAtlasProfile,
  identity: PlaceIdentity,
): PlaceAtlasIdentityAdapterResult {
  const profileCanonicalId = nonEmptyText(profile.place.canonicalPlaceId);
  if (!profileCanonicalId) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "canonical_identity_missing" };
  }
  if (profileCanonicalId !== identity.canonicalPlaceId) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "canonical_identity_mismatch" };
  }
  if (profile.publication.status === "suppressed") {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "publication_suppressed" };
  }
  if (!nonEmptyText(profile.place.name)) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "place_name_missing" };
  }
  if (!validDate(profile.provenance.generatedAt)) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "generated_at_invalid" };
  }

  const sourceRef = normalizePlaceAtlasRef(profile.placeRef as unknown as Record<string, unknown>);
  if (!sourceRef) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "place_atlas_ref_invalid" };
  }

  const sourceReferences = profile.provenance.sourceReferences ?? [];
  if (sourceReferences.length === 0) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "evidence_missing" };
  }
  const evidence = sourceReferences.map(toEvidence);
  if (evidence.some((item) => item === null)) {
    return { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "evidence_invalid" };
  }
  const resolvedEvidence = evidence as EvidenceRef[];
  const verified = isVerifiedStatus(profile.place.verificationStatus ?? "unverified") &&
    sourceReferences.every((source) => isVerifiedStatus(source.verificationStatus));
  const status: PlaceNameAssertion["status"] = verified ? "asserted" : "candidate";
  const time = assertionTime(profile.provenance.generatedAt);

  return {
    status: "mapped",
    adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION,
    mappingMode: "source_ref_only",
    identity,
    sourceRef,
    evidence: resolvedEvidence,
    nameAssertions: nameAssertions(profile, identity.canonicalPlaceId, time, resolvedEvidence, status),
    externalIdentifiers: [{
      placeId: identity.canonicalPlaceId,
      scheme: externalIdentifierScheme(sourceRef),
      value: externalIdentifierValue(sourceRef),
      time,
      evidence: resolvedEvidence,
      status,
    }],
    recordBindings: [],
  };
}
