import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("admin guide program routes are gated and write through the service layer", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "adminGuidePrograms.ts"), "utf8");
  assert.match(source, /\/admin\/guide-programs/);
  assert.match(source, /isAdminOrAnalystRole/);
  assert.match(source, /assertPrivilegedWriteAccess/);
  assert.match(source, /getGuideProgramEditorState/);
  assert.match(source, /upsertGuideProgram/);
  assert.match(source, /buildGuideProgramRecap/);
  assert.match(source, /\/admin\/guide-programs\/:programId\/recap/);
  assert.match(source, /\/api\/v1\/admin\/guide-programs\/:programId\/recap/);
  assert.match(source, /Field Program Recap/);
  assert.match(source, /recapStatValue/);
  assert.match(source, /k未満/);
  assert.match(source, /個人別行動履歴、正確な来訪経路、公式調査結果としては扱いません/);
  assert.match(source, /\/api\/v1\/admin\/guide-programs\/:programId/);
});
