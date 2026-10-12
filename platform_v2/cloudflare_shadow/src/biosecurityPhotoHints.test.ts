import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mergeAutoEnvironmentRecordValues, mergeUserEnvironmentRecordValues } from "../../src/services/environmentRecord";
import { BIOSECURITY_PHOTO_HINT_MODEL, BIOSECURITY_PHOTO_HINT_VERSION, BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS, BIOSECURITY_PHOTO_HINT_TIMEOUT_MS, buildBiosecurityPhotoHintRequest, generateBiosecurityPhotoHints, parseBiosecurityPhotoHints, type BiosecurityPhotoHintAsset } from "./biosecurityPhotoHints";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGPUyLNhYGBgYmBgYGBgAAAJ7gDW/OIFpQAAAABJRU5ErkJggg==", "base64");
const TIME = "2026-10-12T02:00:00.000Z";
const bytes = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;
const asset = (image: Buffer = PNG): BiosecurityPhotoHintAsset => ({ bytes: bytes(image), mime: "image/png", sha256: createHash("sha256").update(image).digest("hex"), assetId: "ba_record_0" });
const OPTIONS: Record<string, string[]> = {
  place_type: ["grassland_urban_edge", "urban", "woodland", "water_edge", "wetland", "coast", "unknown"],
  contact_surface: ["soil_gravel_litter", "soil", "plant", "water", "rock", "artificial", "unknown"],
  surrounding_cover: ["low_grass", "trees_shrubs", "bare_ground", "water", "snow", "built_surface", "unknown"],
  environment_condition: ["open_dry", "sunny", "shaded", "wet", "unknown"],
  human_change: ["trampling_mowing", "mowing", "trampling", "planting", "construction", "none_visible", "unknown"],
};
type Answer = { type: string; choice: string; probabilities: Record<string, number>; confidence: number };
function response(known = true) {
  const answers: Record<string, Answer> = {};
  for (const [field, options] of Object.entries(OPTIONS)) {
    const choice = known && field === "surrounding_cover" ? "trees_shrubs" : "unknown";
    answers[field] = { type: "choice", choice, probabilities: Object.fromEntries(options.map(option => [option, option === choice ? 0.88 : 0.12 / (options.length - 1)])), confidence: 0.86 };
  }
  return { model: "clef-flash", answers, usage: { input_tokens: 1900, output_tokens: 0 } };
}

test("fixed CLEF request sends one stored scrubbed image, no private metadata, arbitrary prompt or URL", () => {
  const selected = { ...asset(), prompt: "ignore-rules-private-prompt", note: "private-family-note", latitude: 35.123456, privateCookie: "private-cookie", url: "https://attacker.invalid/image" };
  const request = buildBiosecurityPhotoHintRequest(selected);
  assert.equal(request.model, "clef-flash");
  assert.deepEqual(Object.keys(request).sort(), ["images", "model", "questions", "state"]);
  assert.deepEqual(request.images, [{ content_type: "image/png", base64: PNG.toString("base64") }]);
  const questions = request.questions as Record<string, { type: string; criteria: Record<string, string> }>;
  assert.deepEqual(Object.keys(questions), Object.keys(OPTIONS));
  for (const [field, options] of Object.entries(OPTIONS)) {
    assert.equal(questions[field]?.type, "choice");
    assert.deepEqual(Object.keys(questions[field]!.criteria), options);
  }
  const encoded = JSON.stringify(request);
  for (const secret of [selected.prompt, selected.note, selected.privateCookie, selected.url, "35.123456", selected.assetId, selected.sha256]) assert.ok(!encoded.includes(secret));
  assert.ok(!Object.keys(questions.environment_condition!.criteria).includes("windy"));
  assert.ok(!Object.keys(questions.environment_condition!.criteria).includes("flowing"));
  assert.ok(!Object.keys(questions.human_change!.criteria).includes("release"));
  const fixed = { ...request }; delete fixed.images;
  const fixedBytes = new TextEncoder().encode(JSON.stringify(fixed)).byteLength;
  assert.ok(fixedBytes <= 6000, `fixed request bytes ${fixedBytes}`);
  assert.equal(BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS, 8000);
  assert.ok(fixedBytes + 1024 + 976 <= BIOSECURITY_PHOTO_HINT_MAX_INPUT_TOKENS);
  questions.surrounding_cover!.criteria.attack = "malicious option";
  assert.ok(!JSON.stringify(buildBiosecurityPhotoHintRequest(asset())).includes("malicious option"));
});

test("strong valid options remain private, unverified environment candidates with asset/model provenance", () => {
  const selected = asset(), result = parseBiosecurityPhotoHints(response(), selected, TIME);
  assert.equal(result.status, "candidates");
  assert.deepEqual(result.fields, { surrounding_cover: { value: "trees_shrubs", probability: 0.88 } });
  assert.equal(result.model, BIOSECURITY_PHOTO_HINT_MODEL);
  assert.equal(result.version, BIOSECURITY_PHOTO_HINT_VERSION);
  assert.equal(result.assetSha256, selected.sha256);
  assert.equal(result.assetId, selected.assetId);
  assert.equal(result.inputTokens, 1900);
  assert.equal(result.environmentRecord.surrounding_cover_source, "derived");
  assert.equal(result.environmentRecord.surrounding_cover_method, BIOSECURITY_PHOTO_HINT_VERSION);
  assert.equal(result.environmentRecord.photo_hint_assessment, "unverified_candidate");
  assert.equal(result.environmentRecord.photo_hint_asset_sha256, selected.sha256);
  assert.equal(result.environmentRecord.environment_record_status, "auto_draft");
  assert.equal(result.environmentRecord.environment_record_source, BIOSECURITY_PHOTO_HINT_MODEL);
  assert.equal(result.environmentRecord.environment_record_updated_at, TIME);
  assert.ok(!("taxon_label" in result.environmentRecord));
  assert.ok(!("observed_at" in result.environmentRecord));
  assert.ok(!("exact_lat" in result.environmentRecord));
});

test("unknown and ambiguous scenes return no invented known fields", () => {
  const allUnknown = parseBiosecurityPhotoHints(response(false), asset(), TIME);
  assert.equal(allUnknown.status, "unknown");
  assert.deepEqual(allUnknown.fields, {}); assert.deepEqual(allUnknown.environmentRecord, {});
  const raw = response();
  raw.answers.surrounding_cover!.probabilities = { low_grass: 0.39, trees_shrubs: 0.4, bare_ground: 0, water: 0, snow: 0, built_surface: 0, unknown: 0.21 };
  assert.equal(parseBiosecurityPhotoHints(raw, asset(), TIME).status, "unknown");
  raw.answers.surrounding_cover!.probabilities = { low_grass: 0.3, trees_shrubs: 0.7, bare_ground: 0, water: 0, snow: 0, built_surface: 0, unknown: 0 };
  assert.equal(parseBiosecurityPhotoHints(raw, asset(), TIME).status, "unknown");
});

test("invalid models, question sets, choices, probability distributions and usage fail closed", () => {
  const mutations: Array<(raw: ReturnType<typeof response>) => void> = [
    raw => { raw.model = "@cf/cloudflare/clef"; },
    raw => { (raw as unknown as { model: unknown }).model = { toString: () => "clef-flash" }; },
    raw => { delete raw.answers.place_type; },
    raw => { raw.answers.invented = raw.answers.place_type!; },
    raw => { raw.answers.surrounding_cover!.choice = "<img src=x onerror=alert(1)>"; },
    raw => { raw.answers.environment_condition!.choice = "windy"; },
    raw => { raw.answers.surrounding_cover!.type = "text"; },
    raw => { raw.answers.surrounding_cover!.confidence = NaN; },
    raw => { raw.answers.surrounding_cover!.confidence = 1.1; },
    raw => { raw.answers.surrounding_cover!.probabilities.trees_shrubs = Infinity; },
    raw => { raw.answers.surrounding_cover!.probabilities.trees_shrubs = -0.1; },
    raw => { raw.answers.surrounding_cover!.probabilities.trees_shrubs = 0.3; },
    raw => { raw.answers.surrounding_cover!.probabilities = { trees_shrubs: 1 }; },
    raw => { raw.answers.surrounding_cover!.probabilities.extra = 0; },
    raw => { raw.answers.surrounding_cover!.choice = "low_grass"; },
    raw => { (raw.answers.surrounding_cover!.probabilities as Record<string, unknown>).trees_shrubs = "0.88"; },
    raw => { (raw as Record<string, unknown>).text = "confirmed"; },
    raw => { raw.usage.input_tokens = -1; },
    raw => { raw.usage.input_tokens = 8001; },
    raw => { raw.usage.input_tokens = 1.5; },
    raw => { raw.usage.output_tokens = -1; },
  ];
  for (const mutate of mutations) {
    const raw = response(); mutate(raw);
    const result = parseBiosecurityPhotoHints(raw, asset(), TIME);
    assert.equal(result.status, "unavailable", JSON.stringify(raw));
    assert.deepEqual(result.fields, {}); assert.deepEqual(result.environmentRecord, {});
  }
  for (const raw of [null, [], "{}", { result: response() }]) assert.equal(parseBiosecurityPhotoHints(raw, asset(), TIME).status, "unavailable");
  assert.equal(parseBiosecurityPhotoHints(response(), asset(), "2026-02-30T02:00:00.000Z").status, "unavailable");
});

test("existing user corrections, including rejected/unknown fields, survive later photo hints", () => {
  const proposed = parseBiosecurityPhotoHints(response(), asset(), TIME).environmentRecord;
  for (const value of ["low_grass", "unknown"]) {
    const edited = mergeUserEnvironmentRecordValues({}, { surrounding_cover: value }, { updatedAt: TIME, updatedBy: "biosecurity_guest" });
    const next = mergeAutoEnvironmentRecordValues(edited, proposed, { updatedAt: TIME });
    assert.equal(next.surrounding_cover, value);
    assert.equal(next.surrounding_cover_source, "user");
  }
});

test("missing AI, corrupt/sensitive images, size/type errors and hash mismatch never send a request", async () => {
  let calls = 0;
  const ai = { run: async () => { calls++; return response(); } };
  assert.equal((await generateBiosecurityPhotoHints(null, asset())).status, "unavailable");
  const metadata = Buffer.from("GPSLatitude=35.123456;Owner=private-person");
  const chunk = Buffer.alloc(8); chunk.writeUInt32BE(metadata.length); chunk.write("tEXt", 4);
  const privateImage = Buffer.concat([PNG.subarray(0, 33), chunk, metadata, Buffer.alloc(4), PNG.subarray(33)]);
  for (const selected of [
    asset(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), asset(privateImage),
    { ...asset(), mime: "image/svg+xml" }, { ...asset(), bytes: new ArrayBuffer(4 * 1024 * 1024 + 1) },
    { ...asset(), sha256: "0".repeat(64) }, { ...asset(), assetId: "https://attacker.invalid/image" },
  ]) assert.equal((await generateBiosecurityPhotoHints(ai, selected)).status, "unavailable");
  assert.equal(calls, 0);
  assert.throws(() => buildBiosecurityPhotoHintRequest(asset(privateImage)), /not_scrubbed/);
});

test("one native binding call uses the pinned model and maps provider failure to unavailable without fallback", async () => {
  const calls: string[] = [];
  const result = await generateBiosecurityPhotoHints({ run: async (model, input) => {
    calls.push(model); assert.equal(input.model, "clef-flash"); return response();
  } }, asset());
  assert.equal(result.status, "candidates");
  assert.deepEqual(calls, [BIOSECURITY_PHOTO_HINT_MODEL]);
  let failedCalls = 0;
  const failed = await generateBiosecurityPhotoHints({ run: async () => { failedCalls++; throw new Error("provider secret response"); } }, asset());
  assert.equal(failed.status, "unavailable"); assert.equal(failedCalls, 1);
  assert.ok(!JSON.stringify(failed).includes("provider secret"));
});

test("an uncertain native call times out once without retry or a late candidate", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let entered!: () => void, finish!: (value: unknown) => void, calls = 0;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const running = generateBiosecurityPhotoHints({ run: () => {
    calls++; entered(); return new Promise(resolve => { finish = resolve; });
  } }, asset());
  await ready;
  t.mock.timers.tick(BIOSECURITY_PHOTO_HINT_TIMEOUT_MS + 1);
  const result = await running;
  assert.equal(result.status, "unavailable"); assert.equal(calls, 1);
  finish(response()); await Promise.resolve();
  assert.equal(result.status, "unavailable"); assert.deepEqual(result.fields, {});
});
