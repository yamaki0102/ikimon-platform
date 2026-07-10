import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("place confirmation is owner-only and limited to boundary park candidates", async () => {
  const serviceSource = await readFile(path.join(process.cwd(), "src", "services", "observationPlaceConfirmation.ts"), "utf8");
  const writeRouteSource = await readFile(path.join(process.cwd(), "src", "routes", "write.ts"), "utf8");

  assert.match(serviceSource, /target\.user_id !== actorUserId/);
  assert.match(serviceSource, /place_confirmation_not_boundary_candidate/);
  assert.match(serviceSource, /field_not_confirmable_candidate/);
  assert.match(serviceSource, /f\.admin_level in \('osm_park', 'park'\)/);
  assert.match(serviceSource, /resolved_field_ids = \(/);
  assert.match(serviceSource, /- 'field_id'/);
  assert.match(serviceSource, /owner_boundary_place_confirm/);
  assert.match(writeRouteSource, /\/api\/v1\/observations\/:id\/place-confirmation/);
  assert.match(writeRouteSource, /confirmObservationPlace/);
});
