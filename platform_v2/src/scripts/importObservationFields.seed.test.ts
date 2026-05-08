import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, "data", "nature_symbiosis_sites.seed.json");

test("aikan renri official URL points to the owner primary source, not an ikimon article", async () => {
  const seed = JSON.parse(await readFile(seedPath, "utf8")) as {
    sites?: Array<{ certification_id?: string; official_url?: string }>;
  };
  const site = seed.sites?.find((entry) => entry.certification_id === "aikan-renri-ikan-hq");

  assert.ok(site, "aikan renri seed must exist");
  assert.equal(site.official_url, "https://i-kan.co.jp/company/biodiversity/");
  assert.doesNotMatch(site.official_url ?? "", /^https:\/\/ikimon\.life\//);
});
