import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("observation detail lets owners recover missing photos without exposing review rows publicly", async () => {
  const readModels = await readFile(path.join(process.cwd(), "src", "services", "readModels.ts"), "utf8");
  const readRoutes = await readFile(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");
  const landingSnapshot = await readFile(path.join(process.cwd(), "src", "services", "landingSnapshot.ts"), "utf8");

  assert.match(readModels, /getObservationDetailSnapshot\(\s*id: string,\s*options: \{ viewerUserId\?: string \| null \}/);
  assert.match(readModels, /or v\.user_id = \$2/);
  assert.match(readRoutes, /renderObservationPhotoRecoveryPanel/);
  assert.match(readRoutes, /data-photo-recovery/);
  assert.match(readRoutes, /\/api\/v1\/observations\/\$\{encodeURIComponent\(options\.visitId\)\}\/photos\/upload/);
  assert.match(readRoutes, /mediaRole: existingPhotoCount === 0 && uploaded === 0 \? 'primary_subject' : 'context'/);
  assert.match(landingSnapshot, /own observation library, including review rows that need media recovery/);
  assert.match(landingSnapshot, /coalesce\(v\.public_visibility, 'public'\) <> 'hidden'/);
});
