import assert from "node:assert/strict";
import test from "node:test";
import { natureSymbiosisExplanationCount, natureSymbiosisExplanationUrl } from "./natureSymbiosisExplanations";

test("nature symbiosis sites resolve to their 連理の木の下で explanation page", () => {
  assert.equal(
    natureSymbiosisExplanationUrl("nature_symbiosis_site", "aikan-renri-ikan-hq"),
    "https://lenrinokinoshitade.com/sites/law-zoshin-17bfc2c1de795a50/"
  );
  const url = natureSymbiosisExplanationUrl("nature_symbiosis_site", "R6second43_KaseyamaForest");
  assert.match(url, /^https:\/\/lenrinokinoshitade\.com\/sites\/[A-Za-z0-9-]+\/$/u);
  assert.ok(natureSymbiosisExplanationCount() >= 290);
});

test("other sources, unknown ids and prototype keys get no explanation link", () => {
  assert.equal(natureSymbiosisExplanationUrl("tsunag", "R6second43_KaseyamaForest"), "");
  assert.equal(natureSymbiosisExplanationUrl("nature_symbiosis_site", "ns-2023-001"), "");
  assert.equal(natureSymbiosisExplanationUrl("nature_symbiosis_site", "toString"), "");
  assert.equal(natureSymbiosisExplanationUrl("nature_symbiosis_site", null), "");
});
