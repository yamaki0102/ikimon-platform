import assert from "node:assert/strict";
import test from "node:test";
import {
  findFocusedExperience,
  findFocusedExperienceByCanonicalPath,
  focusedExperienceHref,
  focusedExperienceText,
  listFocusedExperiences,
  requireFocusedExperience,
} from "./focusedExperienceRegistry.js";


test("Kubiaka is the enabled canonical focused experience", () => {
  const experiences = listFocusedExperiences();
  assert.equal(experiences.length, 1);
  assert.equal(experiences[0]?.experienceKey, "kubiaka-watch");
  assert.equal(experiences[0]?.canonicalPath, "/kubiaka");
  assert.equal(experiences[0]?.taxonId, "Aromia bungii");
  assert.equal(experiences[0]?.publicAreaPrecision, "aggregate_only");
});


test("focused experience lookup accepts the key and any canonical child route", () => {
  assert.equal(findFocusedExperience(" KUBIAKA-WATCH ")?.canonicalPath, "/kubiaka");
  assert.equal(findFocusedExperienceByCanonicalPath("/kubiaka")?.experienceKey, "kubiaka-watch");
  assert.equal(findFocusedExperienceByCanonicalPath("https://example.test/kubiaka/record?source=qr")?.experienceKey, "kubiaka-watch");
  assert.equal(findFocusedExperienceByCanonicalPath("/records"), null);
});


test("focused experience helpers keep the canonical path and localized title stable", () => {
  const definition = requireFocusedExperience("kubiaka-watch");
  assert.equal(focusedExperienceHref(definition), "/kubiaka");
  assert.equal(focusedExperienceHref(definition, "/record"), "/kubiaka/record");
  assert.equal(focusedExperienceText(definition.title, "ja"), "クビアカツヤカミキリ見守り");
  assert.equal(focusedExperienceText(definition.shortTitle, "en"), "Kubiaka watch");
});


test("unknown focused experience keys fail closed", () => {
  assert.equal(findFocusedExperience("unknown"), null);
  assert.throws(() => requireFocusedExperience("unknown"), /focused_experience_not_found/);
});
