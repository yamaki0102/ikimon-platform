import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("legacy delta sync passes a changed-files manifest to the importer", async () => {
  const source = await readFile(path.join(process.cwd(), "src/scripts/syncLegacyDelta.ts"), "utf8");

  assert.match(source, /mkdtemp\(path\.join\(tmpdir\(\), "ikimon-legacy-delta-"\)\)/);
  assert.match(source, /JSON\.stringify\(changedFiles\.map\(\(file\) => file\.filePath\), null, 2\)/);
  assert.match(source, /--changed-files-manifest=\$\{manifestPath\}/);
  assert.match(source, /await rm\(path\.dirname\(manifestPath\), \{ recursive: true, force: true \}\)/);
  assert.match(source, /await runImporterForChangedFiles\(options, changedFiles\)/);
});
