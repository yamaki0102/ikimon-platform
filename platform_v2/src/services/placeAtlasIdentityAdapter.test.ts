import assert from "node:assert/strict";
import test from "node:test";
import type { PlaceAtlasBuildInput, PlaceAtlasProfile } from "./placeAtlasContract.js";
import { buildPlaceAtlasProfile } from "./placeAtlasContract.js";
import type { PlaceIdentity } from "./globalPlaceIdentity.js";
import {
  PLACE_ATLAS_IDENTITY_ADAPTER_VERSION,
  adaptPlaceAtlasProfileToGlobalIdentity,
} from "./placeAtlasIdentityAdapter.js";

const identity: PlaceIdentity = {
  canonicalPlaceId: "place:jp:tokyo:sample",
  placeKind: "nature_area",
  origin: "initial",
};

function profile(overrides: Partial<PlaceAtlasProfile["place"]> = {}, ref: PlaceAtlasBuildInput["placeRef"] = { kind: "field", fieldId: "field-001" }): PlaceAtlasProfile {
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: "Sample Green",
      type: "park",
      localityLabel: "Tokyo",
      canonicalPlaceId: identity.canonicalPlaceId,
      verificationStatus: "source_verified",
      ...overrides,
    },
    records: [],
    recordSetComplete: true,
    locationMode: "field",
    sources: ["place-atlas"],
    sourceReferences: [{
      sourceType: "place_atlas",
      sourceId: "profile-001",
      sourceUrl: "https://example.test/source/profile-001",
      confidence: 0.9,
      verificationStatus: "source_verified",
      lastCheckedAt: "2026-09-14T00:00:00Z",
    }],
    generatedAt: "2026-09-14T00:00:00Z",
  });
}

test("maps an explicitly bound Place Atlas profile into source assertions", () => {
  const result = adaptPlaceAtlasProfileToGlobalIdentity(profile({
    aliases: ["Sample Green", "Green Sample"],
    multilingualNames: { ja: "サンプル緑地" },
  }), identity);

  assert.equal(result.status, "mapped");
  if (result.status !== "mapped") return;
  assert.equal(result.adapterVersion, PLACE_ATLAS_IDENTITY_ADAPTER_VERSION);
  assert.equal(result.mappingMode, "source_ref_only");
  assert.equal(result.sourceRef.kind, "field");
  assert.equal(result.externalIdentifiers[0]?.scheme, "place_atlas.field");
  assert.equal(result.externalIdentifiers[0]?.value, "field-001");
  assert.equal(result.nameAssertions[0]?.name, "Sample Green");
  assert.equal(result.nameAssertions[0]?.status, "asserted");
  assert.equal(result.nameAssertions.some((item) => item.name === "サンプル緑地" && item.language === "ja"), true);
  assert.deepEqual(result.recordBindings, []);
});

test("keeps unverified profiles as candidate assertions", () => {
  const result = adaptPlaceAtlasProfileToGlobalIdentity(profile({ verificationStatus: "unverified" }), identity);
  assert.equal(result.status, "mapped");
  if (result.status !== "mapped") return;
  assert.equal(result.nameAssertions[0]?.status, "candidate");
  assert.equal(result.externalIdentifiers[0]?.status, "candidate");
});

test("requires the profile canonical identity and rejects mismatches", () => {
  const missing = adaptPlaceAtlasProfileToGlobalIdentity(profile({ canonicalPlaceId: undefined }), identity);
  assert.deepEqual(missing, { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "canonical_identity_missing" });

  const mismatch = adaptPlaceAtlasProfileToGlobalIdentity(profile({ canonicalPlaceId: "place:other" }), identity);
  assert.deepEqual(mismatch, { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "canonical_identity_mismatch" });
});

test("does not infer identity from a malformed Place Atlas reference", () => {
  const result = adaptPlaceAtlasProfileToGlobalIdentity(profile({}, { kind: "field", fieldId: "../other" }), identity);
  assert.deepEqual(result, { status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "place_atlas_ref_invalid" });
});

test("preserves each Place Atlas kind as an external identifier, never as canonical identity", () => {
  const cases: Array<[PlaceAtlasBuildInput["placeRef"], string, string]> = [
    [{ kind: "field", fieldId: "field-001" }, "place_atlas.field", "field-001"],
    [{ kind: "osm_area", entityKey: "osm:way:123", osmType: "way", osmId: 123 }, "place_atlas.osm_area", "osm:way:123"],
    [{ kind: "public_cell", cellId: "cell:35.1,139.1" }, "place_atlas.public_cell", "cell:35.1,139.1"],
  ];
  for (const [ref, scheme, value] of cases) {
    const result = adaptPlaceAtlasProfileToGlobalIdentity(profile({}, ref), identity);
    assert.equal(result.status, "mapped");
    if (result.status !== "mapped") continue;
    assert.equal(result.identity.canonicalPlaceId, identity.canonicalPlaceId);
    assert.equal(result.externalIdentifiers[0]?.scheme, scheme);
    assert.equal(result.externalIdentifiers[0]?.value, value);
  }
});

test("fails closed without evidence, for invalid generation time, or suppressed publication", () => {
  const noEvidence = profile();
  noEvidence.provenance.sourceReferences = [];
  assert.equal(adaptPlaceAtlasProfileToGlobalIdentity(noEvidence, identity).status, "unresolved");

  const invalidTime = profile();
  invalidTime.provenance.generatedAt = "not-a-date";
  assert.deepEqual(adaptPlaceAtlasProfileToGlobalIdentity(invalidTime, identity), {
    status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "generated_at_invalid",
  });

  const invalidEvidence = profile();
  invalidEvidence.provenance.sourceReferences![0]!.confidence = 1.1;
  assert.deepEqual(adaptPlaceAtlasProfileToGlobalIdentity(invalidEvidence, identity), {
    status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "evidence_invalid",
  });

  const suppressed = profile();
  suppressed.publication.status = "suppressed";
  assert.deepEqual(adaptPlaceAtlasProfileToGlobalIdentity(suppressed, identity), {
    status: "unresolved", adapterVersion: PLACE_ATLAS_IDENTITY_ADAPTER_VERSION, reason: "publication_suppressed",
  });
});
