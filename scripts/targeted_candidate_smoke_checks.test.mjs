import assert from "node:assert/strict";
import test from "node:test";
import { validateHtmlPage } from "./targeted_candidate_smoke_checks.mjs";

test("target page validation requires a complete HTML document and expected body copy", () => {
  assert.equal(validateHtmlPage("<!doctype html><html><body>Learn</body></html>", { bodyMarker: "Learn" }), null);
  assert.match(validateHtmlPage("Learn", { bodyMarker: "Learn" }), /complete HTML/u);
  assert.match(validateHtmlPage("<!doctype html><body>Wrong</body>", { bodyMarker: "Learn" }), /body marker/u);
  assert.match(validateHtmlPage("<!doctype html><body>Learn html_not_materialized</body>", { bodyMarker: "Learn" }), /html_not_materialized/u);
});
