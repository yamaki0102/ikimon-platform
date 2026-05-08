import assert from "node:assert/strict";
import test from "node:test";
import { validateNarrative } from "./contentClaimsValidator.js";

test("claim validator blocks certification and biodiversity improvement proof wording", () => {
  const result = validateNarrative("この記録は自然共生サイト認定を証明し、生物多様性改善を保証します。", "ja");

  assert.equal(result.ok, false);
  assert.ok(result.hardViolations.some((violation) => violation.id === "nature_coexistence_proven"));
  assert.ok(result.hardViolations.some((violation) => violation.id === "certification_or_improvement_proof"));
});
