import test from "node:test";
import assert from "node:assert/strict";
import { __test__ } from "./areaSnapshotVisitScope.js";

const square = {
  type: "Polygon",
  coordinates: [[
    [137.0, 34.0],
    [138.0, 34.0],
    [138.0, 35.0],
    [137.0, 35.0],
    [137.0, 34.0],
  ]],
};

const field = {
  fieldId: "11111111-1111-4111-8111-111111111111",
  lat: 34.5,
  lng: 137.5,
  radiusM: 500,
  polygon: square,
};

test("visit scope query groups spatial matches before observed_at filters", () => {
  const query = __test__.AREA_SNAPSHOT_VISIT_SCOPE_SQL;
  let balance = 0;
  for (const char of query) {
    if (char === "(") balance += 1;
    if (char === ")") balance -= 1;
    assert.ok(balance >= 0, "query has an unmatched closing parenthesis");
  }
  assert.equal(balance, 0);
  assert.match(query, /where\s+\(/);
  assert.match(query, /\)\s+and \(\$7::timestamptz is null or v\.observed_at >= \$7::timestamptz\)/);
  assert.doesNotMatch(query, /where\s+v\.source_payload/);
});

test("visit scope excludes fixture synthetic and contentless visits before area snapshots", () => {
  const query = __test__.AREA_SNAPSHOT_VISIT_SCOPE_SQL;

  assert.match(query, /left join users u on u\.user_id = v\.user_id/);
  assert.match(query, /coalesce\(\(v\.visit_id\)::text, ''\) ~/);
  assert.match(query, /coalesce\(u\.is_seed, false\) = false/);
  assert.match(query, /v\.legacy_observation_id[\s\S]*dummy\|seed\|sample/);
  assert.match(query, /coalesce\(v\.public_visibility, 'public'\) = 'public'/);
  assert.match(query, /smoke\[-_\]\?ui/);
  assert.match(query, /public_media_ea\.visit_id = v\.visit_id/);
  assert.match(query, /from occurrences area_scope_o/);
  assert.match(query, /area_scope_o\.visit_id = v\.visit_id/);
});

test("visitMatchesAreaScope rejects geolocated records outside a polygon even when field_id matches", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 35.2,
    point_longitude: 137.5,
    source_field_id: field.fieldId,
    resolved_match: false,
  }), false);
});

test("visitMatchesAreaScope rejects geolocated records outside a polygon even when pre-resolved", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 35.2,
    point_longitude: 137.5,
    source_field_id: null,
    resolved_match: true,
  }), false);
});

test("visitMatchesAreaScope accepts geolocated records inside the polygon", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: 34.5,
    point_longitude: 137.5,
    source_field_id: null,
    resolved_match: false,
  }), true);
});

test("visitMatchesAreaScope accepts pre-resolved field matches without rechecking coordinates", () => {
  assert.equal(__test__.visitMatchesAreaScope(field, {
    point_latitude: null,
    point_longitude: null,
    source_field_id: null,
    resolved_match: true,
  }), true);
});
