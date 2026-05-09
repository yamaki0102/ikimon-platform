import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const routeSource = readFileSync(
  fileURLToPath(new URL("./adminSiteEvidence.ts", import.meta.url)),
  "utf8",
);
const appSource = readFileSync(
  fileURLToPath(new URL("../app.ts", import.meta.url)),
  "utf8",
);

test("admin site evidence routes are registered and role gated", () => {
  assert.match(appSource, /registerAdminSiteEvidenceRoutes/);
  assert.match(routeSource, /\/admin\/site-evidence/);
  assert.match(routeSource, /\/admin\/site-evidence\/print/);
  assert.match(routeSource, /getSessionFromCookie/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.match(routeSource, /aikan-renri-ikan-hq/);
});

test("admin site evidence HTML keeps evidence lanes and supplementary purpose explicit", () => {
  assert.match(routeSource, /AI候補/);
  assert.match(routeSource, /reviewer検証済み/);
  assert.match(routeSource, /活動指標/);
  assert.match(routeSource, /補助資料/);
  assert.match(routeSource, /default threshold 0\.9/);
  assert.match(routeSource, /@page\{size:A4 portrait/);
});

test("admin site evidence source does not include banned claim wording", () => {
  assert.doesNotMatch(routeSource, /TNFD準拠を証明|自然共生サイト認定を証明|生物多様性改善を証明|AIが確定/);
});
