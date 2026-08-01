import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX,
  rewriteKubiakaPhotoUploadUrl,
} from "./kubiakaFocusedExperience.js";

test("photo upload URL stays in the dedicated Kubiaka endpoint", () => {
  assert.equal(
    rewriteKubiakaPhotoUploadUrl("/api/v1/observations/occ:visit-1:0/photos/upload"),
    "/api/v1/kubiaka/observations/occ:visit-1:0/photos/upload",
  );
  assert.equal(
    rewriteKubiakaPhotoUploadUrl(
      "/preview/api/v1/observations/visit-1/photos/upload?retry=1",
    ),
    "/preview/api/v1/kubiaka/observations/visit-1/photos/upload?retry=1",
  );
  assert.equal(
    rewriteKubiakaPhotoUploadUrl("/api/v1/observations/upsert"),
    "/api/v1/observations/upsert",
  );
  assert.equal(KUBIAKA_PRIVATE_PHOTO_UPLOAD_PREFIX, "/api/v1/kubiaka/observations");
});

test("dedicated route uses server-only authorization and omits external hooks", () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), "src/routes/kubiakaFocusedExperience.ts"),
    "utf8",
  );
  assert.match(routeSource, /KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION/);
  assert.match(routeSource, /assertSameOriginRequest/);
  assert.match(routeSource, /assertObservationOwnedByUser/);
  assert.match(routeSource, /kubiaka-private-photo-upload/);
  assert.match(routeSource, /externalRouting: "denied"/);
  assert.match(routeSource, /automaticRecipientDelivery: "denied"/);
  assert.doesNotMatch(routeSource, /emitAreaWatchNotificationForObservation/);
  assert.doesNotMatch(routeSource, /kickPlaceMemoryPhotoProcessingForVisit/);
});

test("generic write route cannot mint the server-only authorization", () => {
  const writeSource = readFileSync(
    path.join(process.cwd(), "src/routes/write.ts"),
    "utf8",
  );
  assert.doesNotMatch(writeSource, /KUBIAKA_PRIVATE_UPLOAD_AUTHORIZATION/);
});
