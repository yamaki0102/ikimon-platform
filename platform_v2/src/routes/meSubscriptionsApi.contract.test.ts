import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(process.cwd(), "src/routes/meSubscriptionsApi.ts"), "utf8");

function routeBlock(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing route ${startMarker}`);
  assert.ok(end > start, `missing route boundary ${endMarker}`);
  return source.slice(start, end);
}

test("area Watch start is an explicit POST and may intentionally resume a stopped target", () => {
  const post = routeBlock(
    'app.post("/api/v1/me/area-subscriptions"',
    'app.delete("/api/v1/me/area-subscriptions/:id"',
  );

  assert.match(post, /INSERT INTO user_area_subscriptions/iu);
  assert.match(post, /is_active, updated_at/iu);
  assert.match(post, /VALUES \(\$1, \$2, \$3, \$4, \$5, true, NOW\(\)\)/iu);
  assert.match(post, /ON CONFLICT \(user_id, target_type, target_id\)/iu);
  assert.match(post, /is_active = true/iu);
});

test("area Watch stop is durable and idempotent instead of deleting its target history", () => {
  const del = routeBlock(
    'app.delete("/api/v1/me/area-subscriptions/:id"',
    'app.get<{ Querystring: { limit?: string } }>("/api/v1/me/personalized-menu"',
  );

  assert.match(del, /UPDATE user_area_subscriptions/iu);
  assert.match(del, /SET is_active = false/iu);
  assert.match(del, /updated_at = NOW\(\)/iu);
  assert.doesNotMatch(del, /DELETE FROM user_area_subscriptions/iu);
});

test("area Watch alerts disappear from the read surface when public rights are withdrawn", () => {
  const alerts = routeBlock(
    'app.get("/api/v1/me/alerts"',
    'app.post("/api/v1/me/alerts/:id/acknowledge"',
  );

  assert.match(alerts, /LEFT JOIN occurrences o/iu);
  assert.match(alerts, /d\.trigger_kind <> 'area_watch'/iu);
  assert.match(alerts, /FROM observation_data_rights rights/iu);
  assert.match(alerts, /rights\.withdrawal_status = 'active'/iu);
  assert.match(alerts, /rights\.record_consent IN \('public_summary', 'external_export'\)/iu);
});
