import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("external API User-Agent contact URLs use ZUKAN while technical client ids remain stable", async () => {
  const [workerSource, placeAtlasSource] = await Promise.all([
    readFile(new URL("./index.ts", import.meta.url), "utf8"),
    readFile(new URL("./placeAtlasProfileNative.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workerSource, /"User-Agent": "ZUKAN universal place atlas contact: https:\/\/zukan\.earth"/);
  assert.match(workerSource, /"User-Agent": "ZUKAN area polygon repair contact: https:\/\/zukan\.earth"/);
  assert.match(placeAtlasSource, /"user-agent": "ZUKAN place atlas contact: https:\/\/zukan\.earth"/);
  assert.doesNotMatch(workerSource, /User-Agent[^\n]+https:\/\/ikimon\.life/);
  assert.doesNotMatch(placeAtlasSource, /user-agent[^\n]+https:\/\/ikimon\.life/);
  assert.match(workerSource, /"X-Ikimon-Client": "ikimon\.life-named-area-polygons"/);
  assert.match(workerSource, /"X-Ikimon-Client": "ikimon\.life-area-polygons"/);
  assert.match(placeAtlasSource, /"x-ikimon-client": "ikimon\.life-place-atlas"/);
});
