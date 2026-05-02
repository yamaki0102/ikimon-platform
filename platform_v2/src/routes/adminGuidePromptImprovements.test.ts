import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("admin guide prompt improvement routes are gated before review writes", () => {
  const source = readFileSync(join(process.cwd(), "src", "routes", "adminGuidePromptImprovements.ts"), "utf8");

  assert.match(source, /\/admin\/guide-prompt-improvements/);
  assert.match(source, /getSessionFromCookie/);
  assert.match(source, /isAdminOrAnalystRole/);
  assert.match(source, /assertPrivilegedWriteAccess/);
  assert.match(source, /updateGuideHypothesisPromptImprovementReviewStatus/);
  assert.match(source, /updateGuideHypothesisPromptImprovementQueueStatus/);
});
