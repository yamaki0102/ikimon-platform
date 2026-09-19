import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyProgram, parsePublicProgram, programDigest, programProfiles,
  ProgramInputError, PUBLIC_PROGRAM_MAX_BYTES, PUBLIC_PROGRAM_SCHEMA,
} from "./publicProgram.js";

// Pure public-data fixtures: no account, receiver, storage or publication calls.
function program(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: PUBLIC_PROGRAM_SCHEMA,
    requestId: "12345678-1234-4123-8123-123456789abc",
    profile: "event", title: "まちの記録を集める日",
    startsAt: "2026-10-01T01:00:00.000Z", endsAt: "2026-10-01T03:00:00.000Z",
    timezone: "Asia/Tokyo", placeLabel: "集合広場", description: "写真と地図を持ち寄ります。",
    conditions: "参加条件を確認してください。", stations: [], ...overrides,
  };
}
function invalid(overrides: Record<string, unknown>, field: string, publication = true): void {
  assert.throws(() => parsePublicProgram(program(overrides), publication),
    (error: unknown) => error instanceof ProgramInputError && error.field === field);
}

for (const profile of programProfiles) {
  test(`${profile}: public definition round-trips without payment or identity fields`, () => {
    const input = program({ profile, stations: profile === "stamp_rally" ? [{ id: "station-1", name: "広場" }] : [] });
    const before = structuredClone(input);
    const parsed = parsePublicProgram(input);
    assert.deepEqual(parsed, before);
    assert.deepEqual(input, before);
    assert.notStrictEqual(parsed, input);
    assert.deepEqual(parsePublicProgram(JSON.parse(JSON.stringify(parsed))), parsed);
  });
}

test("draft permits unknown dates, location and rally stations without implying publishability", () => {
  for (const profile of programProfiles) {
    const input = program({ profile, startsAt: "", endsAt: "", placeLabel: "", stations: [] });
    assert.equal(parsePublicProgram(input, false).profile, profile);
    assert.throws(() => parsePublicProgram(input), ProgramInputError);
  }
});

test("starter templates have fresh request identities but are not complete drafts", () => {
  const first = emptyProgram("stamp_rally");
  const second = emptyProgram("stamp_rally");
  assert.notEqual(first.requestId, second.requestId);
  assert.equal(first.schema, PUBLIC_PROGRAM_SCHEMA);
  assert.deepEqual(first.stations, []);
  assert.throws(() => parsePublicProgram(first, false), ProgramInputError);
  assert.equal(parsePublicProgram({ ...first, title: "企画中" }, false).profile, "stamp_rally");
});

test("normalizes public text without mutating the caller or reusing mutable station objects", () => {
  const input = program({ profile: "stamp_rally", title: "  まち歩き  ", placeLabel: " 広場 ",
    stations: [{ id: " stop-1 ", name: " 受付 " }] });
  const before = structuredClone(input);
  const result = parsePublicProgram(input);
  assert.equal(result.title, "まち歩き");
  assert.equal(result.placeLabel, "広場");
  assert.deepEqual(result.stations, [{ id: "stop-1", name: "受付" }]);
  assert.deepEqual(input, before);
  assert.notStrictEqual(result.stations, input.stations);
});

for (const root of [null, [], "event", 42, true]) {
  test(`rejects non-object root: ${JSON.stringify(root)}`, () => {
    assert.throws(() => parsePublicProgram(root), ProgramInputError);
  });
}

test("rejects every missing top-level field rather than inferring public intent", () => {
  for (const key of Object.keys(program())) {
    const input = program();
    delete input[key];
    assert.throws(() => parsePublicProgram(input),
      (error: unknown) => error instanceof ProgramInputError && error.field === "fields", key);
  }
});

for (const key of ["ownerId", "workspaceId", "role", "consent", "participants", "paymentStatus", "publish", "privateNotes"]) {
  test(`does not accept authority or private-context field: ${key}`, () => {
    invalid({ [key]: "not-public-program-data" }, "fields");
  });
}

test("requires the exact schema and a supported Program profile", () => {
  invalid({ schema: "ikimon.public-program/v2" }, "schema");
  for (const profile of ["", "booking", "photo_contest", null, {}]) invalid({ profile }, "profile");
});

test("requires a versioned UUID request identity for replay correlation", () => {
  for (const requestId of ["", "request-1", "00000000-0000-0000-0000-000000000000",
    "12345678-1234-4123-7123-123456789abc", "12345678-1234-9123-8123-123456789abc"]) {
    invalid({ requestId }, "requestId");
  }
});

for (const [field, limit] of [["title", 80], ["placeLabel", 160], ["description", 2000], ["conditions", 1000]] as const) {
  test(`${field}: enforces its text limit and rejects non-text values`, () => {
    assert.equal(parsePublicProgram(program({ [field]: "a".repeat(limit) }))[field].length, limit);
    for (const value of ["a".repeat(limit + 1), null, 42, []]) invalid({ [field]: value }, field);
  });
}

test("required public text cannot be whitespace-only; optional text can be empty", () => {
  invalid({ title: "   " }, "title");
  invalid({ title: "   " }, "title", false);
  invalid({ placeLabel: "   " }, "placeLabel");
  const parsed = parsePublicProgram(program({ description: " ", conditions: " " }));
  assert.equal(parsed.description, "");
  assert.equal(parsed.conditions, "");
});

test("rejects invalid or missing timezones", () => {
  for (const timezone of ["", "Unknown/Place", "x".repeat(81), null]) invalid({ timezone }, "timezone");
});

for (const startsAt of ["2026-02-30T01:00:00.000Z", "2026-13-01T01:00:00.000Z",
  "2026-10-01", "2026-10-01T01:00:00", "2026-10-01T01:00:00Z",
  "2026-10-01T10:00:00.000+09:00", "not-a-date"]) {
  test(`rejects a noncanonical or nonexistent start instant: ${startsAt}`, () => invalid({ startsAt }, "startsAt"));
}

test("valid leap-day instants are accepted but non-leap-day rollover is rejected", () => {
  assert.equal(parsePublicProgram(program({ startsAt: "2028-02-29T01:00:00.000Z",
    endsAt: "2028-02-29T02:00:00.000Z" })).startsAt, "2028-02-29T01:00:00.000Z");
  invalid({ startsAt: "2027-02-29T01:00:00.000Z" }, "startsAt");
});

test("end must be later than start, including partially filled drafts", () => {
  for (const endsAt of ["2026-10-01T01:00:00.000Z", "2026-09-30T23:00:00.000Z"]) invalid({ endsAt }, "endsAt");
  invalid({ startsAt: "" }, "endsAt", false);
  assert.equal(parsePublicProgram(program({ endsAt: "" })).endsAt, "");
  invalid({ profile: "stamp_rally", endsAt: "", stations: [{ id: "s1", name: "広場" }] }, "endsAt");
});

test("only rallies carry stations and publication requires at least one", () => {
  invalid({ stations: [{ id: "s1", name: "広場" }] }, "stations");
  invalid({ profile: "stamp_rally" }, "stations");
  invalid({ stations: {} }, "stations");
  const stations = Array.from({ length: 40 }, (_, i) => ({ id: `stop-${i}`, name: `地点${i}` }));
  assert.equal(parsePublicProgram(program({ profile: "stamp_rally", stations })).stations.length, 40);
  invalid({ profile: "stamp_rally", stations: [...stations, { id: "overflow", name: "地点" }] }, "stations");
});

test("station IDs are unique after trimming and bounded to their portable alphabet", () => {
  invalid({ profile: "stamp_rally", stations: [{ id: "stop", name: "A" }, { id: " stop ", name: "B" }] }, "station_id");
  for (const id of ["", "a/b", "two words", "地点", "a".repeat(41)]) {
    invalid({ profile: "stamp_rally", stations: [{ id, name: "広場" }] }, "station_id");
  }
});

test("station names must be present for publication and stay within their bound", () => {
  for (const name of ["", " ", "a".repeat(81), null]) {
    invalid({ profile: "stamp_rally", stations: [{ id: "s1", name }] }, "station_name");
  }
  assert.equal(parsePublicProgram(program({ profile: "stamp_rally", stations: [{ id: "s1", name: "" }] }), false).stations[0]?.name, "");
});

test("station payload rejects missing values, non-objects and extra metadata", () => {
  for (const entry of [null, [], "stop", { id: "s1" }, { name: "広場" }, { id: "s1", name: "広場", privateProgress: 1 }]) {
    assert.throws(() => parsePublicProgram(program({ profile: "stamp_rally", stations: [entry] })), ProgramInputError);
  }
});

test("total payload limit counts UTF-8 bytes, not just JavaScript string length", () => {
  const input = program({ description: "あ".repeat(Math.ceil(PUBLIC_PROGRAM_MAX_BYTES / 3)) });
  assert.ok(JSON.stringify(input).length < PUBLIC_PROGRAM_MAX_BYTES);
  assert.ok(new TextEncoder().encode(JSON.stringify(input)).length > PUBLIC_PROGRAM_MAX_BYTES);
  assert.throws(() => parsePublicProgram(input),
    (error: unknown) => error instanceof ProgramInputError && error.field === "size");
});

test("normalized definitions give stable SHA-256 digests; edits and request changes remain distinct", async () => {
  const input = program();
  const reordered = Object.fromEntries(Object.entries(input).reverse());
  const first = await programDigest(parsePublicProgram(input));
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(await programDigest(parsePublicProgram(reordered)), first);
  assert.notEqual(await programDigest(parsePublicProgram(program({ title: "別の企画" }))), first);
  assert.notEqual(await programDigest(parsePublicProgram(program({ requestId: "12345678-1234-4123-8123-123456789abd" }))), first);
});
