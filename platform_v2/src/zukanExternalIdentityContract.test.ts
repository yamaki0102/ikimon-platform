import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("external HTTP User-Agent contact URLs use the canonical ZUKAN origin", async () => {
  const sources = await Promise.all([
    readFile(new URL("./services/curatorSourceSnapshot.ts", import.meta.url), "utf8"),
    readFile(new URL("./scripts/importOsmLeisureParks.ts", import.meta.url), "utf8"),
    readFile(new URL("./scripts/scrapeNatureSymbiosisSites.ts", import.meta.url), "utf8"),
    readFile(new URL("./scripts/smokeInvasiveLawCurator.ts", import.meta.url), "utf8"),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /(?:user-agent|GEOCODE_UA)[^\n]*https:\/\/ikimon\.life/i);
    assert.match(source, /https:\/\/zukan\.earth/);
  }
  assert.match(sources[0]!, /ikimon-curator\/7\.2 \(\+https:\/\/zukan\.earth\)/);
  assert.match(sources[1]!, /contact: yamaki0102@gmail\.com/);
  assert.match(sources[2]!, /yamaki0102@gmail\.com/);
  assert.match(sources[3]!, /ikimon-curator-smoke\/1\.0 \(\+https:\/\/zukan\.earth\)/);
});
