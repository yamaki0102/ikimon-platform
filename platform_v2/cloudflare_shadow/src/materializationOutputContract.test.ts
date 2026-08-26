import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const materializerSource = await readFile(
  fileURLToPath(new URL("../scripts/materialize-original-ui-html.mjs", import.meta.url)),
  "utf8",
);

test("materialization report exposes the exact source SHA at the top level", () => {
  assert.match(materializerSource, /const result = \{[\s\S]*sourceSha: materializationSourceSha,/u);
});
