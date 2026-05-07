import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyEntityKeyIssues,
  defaultCertifiedEntityKey,
  entityKeyFromGeoProperties,
} from "./observationFieldIdentity.js";

test("entityKeyFromGeoProperties accepts overseas stable gazetteer identifiers", () => {
  assert.equal(entityKeyFromGeoProperties({ wikidata: "Q60" }), "wikidata:Q60");
  assert.equal(entityKeyFromGeoProperties({ geonameid: 5128581 }), "geonames:5128581");
  assert.equal(entityKeyFromGeoProperties({ "ISO3166-2": "US-NY" }), "iso3166:US-NY");
  assert.equal(entityKeyFromGeoProperties({ GID_2: "USA.33.1_1" }), "gadm:usa-33-1_1");
  assert.equal(entityKeyFromGeoProperties({ WDPAID: "555577555" }), "protectedplanet:555577555");
  assert.equal(entityKeyFromGeoProperties({ P29_002: "B122210001234" }), "mext_school:B122210001234");
});

test("defaultCertifiedEntityKey prefers explicit and global payload IDs before source-local certification IDs", () => {
  assert.equal(
    defaultCertifiedEntityKey({
      source: "protected_area",
      certificationId: "generic-upload-42",
      payload: { wikidata: "Q90" },
    }),
    "wikidata:Q90",
  );
  assert.equal(
    defaultCertifiedEntityKey({
      source: "protected_area",
      certificationId: "generic-upload-42",
      payload: { raw_properties: { WDPAID: "12345" } },
    }),
    "protectedplanet:12345",
  );
  assert.equal(
    defaultCertifiedEntityKey({
      source: "oecm",
      certificationId: "site-123",
    }),
    "oecm:site-123",
  );
});

test("classifyEntityKeyIssues flags current public areas with missing or unstable identity", () => {
  assert.deepEqual(classifyEntityKeyIssues({
    source: "user_defined",
    admin_level: "admin_municipality",
    name: "Some Municipality",
    entity_key: "",
    valid_to: null,
    owner_user_id: null,
  }).map((issue) => issue.kind), ["missing_entity_key"]);

  assert.deepEqual(classifyEntityKeyIssues({
    source: "protected_area",
    admin_level: "protected",
    name: "Imported Park",
    certification_id: "generic-world-parks-12",
    entity_key: "protected_area:generic-world-parks-12",
    valid_to: null,
    owner_user_id: null,
  }).map((issue) => issue.kind), ["unstable_generated_certification_id"]);

  assert.deepEqual(classifyEntityKeyIssues({
    source: "protected_area",
    admin_level: "protected",
    name: "Imported Park",
    certification_id: "wdpa-1",
    entity_key: "protectedplanet:1",
    valid_to: null,
    owner_user_id: null,
  }), []);
});
