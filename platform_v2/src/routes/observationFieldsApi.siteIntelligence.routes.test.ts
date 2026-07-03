import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(new URL("./observationFieldsApi.ts", import.meta.url), "utf8");

test("field API exposes exact-pin-free public profile and Site Brief payload", () => {
  assert.match(routeSource, /\/api\/v1\/fields\/:fieldId\/public-profile/);
  assert.match(routeSource, /buildFieldPublicProfileView/);
  assert.match(routeSource, /getAreaPlaceSnapshot\(request\.params\.fieldId/);
  assert.match(routeSource, /getFieldStats\(request\.params\.fieldId\)/);
  assert.match(routeSource, /publicBrief/);
  assert.match(routeSource, /Cache-Control", "public, max-age=60/);
});
