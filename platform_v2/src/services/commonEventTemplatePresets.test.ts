import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
  COMMON_EVENT_TEMPLATE_KEYS,
  type CommonEventTemplateKey,
} from "./commonEventTemplateContract.js";
import {
  buildCommonEventTemplateDraft,
  COMMON_EVENT_TEMPLATE_PRESETS,
  COMMON_EVENT_TEMPLATE_PRESET_VERSION,
} from "./commonEventTemplatePresets.js";

function template(key: CommonEventTemplateKey) {
  return { contract_version: COMMON_EVENT_TEMPLATE_CONTRACT_VERSION, key };
}

test("all four contract keys have reusable presets and nonempty draft missions", () => {
  assert.deepEqual(COMMON_EVENT_TEMPLATE_PRESETS.map((preset) => preset.key), COMMON_EVENT_TEMPLATE_KEYS);
  for (const key of COMMON_EVENT_TEMPLATE_KEYS) {
    const draft = buildCommonEventTemplateDraft(template(key));
    assert.ok(draft);
    assert.equal(draft.presetVersion, COMMON_EVENT_TEMPLATE_PRESET_VERSION);
    assert.deepEqual(draft.template, template(key));
    assert.equal(draft.missions.length, key === "ryuyo" ? 9 : 3);
    assert.equal(new Set(draft.missions.map((mission) => mission.presetStepKey)).size, draft.missions.length);
    assert.deepEqual(draft.missions.map((mission) => mission.sortOrder), draft.missions.map((_, index) => index));
    assert.ok(draft.missions.every((mission) => mission.title.length > 0 && mission.target.length > 0));
  }
});

test("Ryuuyo reuses the same three activities and the same mission meaning", () => {
  const composite = COMMON_EVENT_TEMPLATE_PRESETS.find((preset) => preset.key === "ryuyo");
  assert.ok(composite);
  const componentKeys = ["stamp-rally", "mission-quest", "collaborative-observation"] as const;
  for (const [index, key] of componentKeys.entries()) {
    const preset = COMMON_EVENT_TEMPLATE_PRESETS.find((candidate) => candidate.key === key);
    assert.ok(preset);
    assert.equal(composite.activities[index], preset.activities[0]);
  }
  const combined = buildCommonEventTemplateDraft(template("ryuyo"));
  assert.ok(combined);
  const componentMissions = componentKeys.flatMap((key) => {
    const draft = buildCommonEventTemplateDraft(template(key));
    assert.ok(draft);
    return draft.missions;
  });
  assert.deepEqual(
    combined.missions.map(({ sortOrder: _sortOrder, ...mission }) => mission),
    componentMissions.map(({ sortOrder: _sortOrder, ...mission }) => mission),
  );
  assert.deepEqual(combined.missions.map((mission) => mission.scope), [
    "participant", "participant", "participant", "participant", "participant", "participant", "event", "event", "event",
  ]);
});

test("templates create only reviewed drafts and never infer operational facts or consent", () => {
  const draft = buildCommonEventTemplateDraft({
    ...template("ryuyo"),
    status: "live", public_launch: true, real_participant_intake: true,
    fee: 999, started_at: "2030-01-01", location_lat: 1, location_lng: 2,
    partner: "unverified-partner", consent: true, answer: "client-answer",
  }, { title: "主催者が決めた企画名" });
  assert.ok(draft);
  assert.equal(draft.course.title, "主催者が決めた企画名");
  assert.equal(draft.course.status, "draft");
  assert.deepEqual(draft.course.config, {
    event_template: template("ryuyo"),
    event_template_preset_version: COMMON_EVENT_TEMPLATE_PRESET_VERSION,
  });
  for (const mission of draft.missions) {
    assert.equal(mission.status, "draft");
    assert.equal(mission.verificationPolicy, "organizer_review");
    assert.equal(mission.locationBinding, "none");
    assert.equal(mission.stationId, null);
    assert.equal(mission.replacementForMissionId, null);
    assert.equal(mission.startsAt, null);
    assert.equal(mission.endsAt, null);
    assert.equal(mission.goalCount, 1);
  }
  assert.doesNotMatch(JSON.stringify(draft), /"(?:lat|lng|location_lat|location_lng|fee|partner|consent|public_launch|real_participant_intake|answer|choices|hint|prompt|sessionId|createdBy|participantId)"/);
  assert.doesNotMatch(JSON.stringify(draft), /unverified-partner|client-answer|2030-01-01/);
});

test("real mission instructions do not copy simulated completion or quiz state", () => {
  const preset = COMMON_EVENT_TEMPLATE_PRESETS.find((candidate) => candidate.key === "stamp-rally");
  assert.ok(preset);
  assert.match(preset.activities[0]?.steps[0]?.prompt ?? "", /見つけたつもり/);
  const draft = buildCommonEventTemplateDraft(template("ryuyo"));
  assert.ok(draft);
  const renderedInstructions = draft.missions.map((mission) => mission.target).join("\n");
  assert.doesNotMatch(renderedInstructions, /見つけたつもり|画面だけ|体験用|選び直して|集計の見本/);
  assert.equal(draft.missions.find((mission) => mission.presetStepKey === "stamp-compare")?.countUnit, "comparison_pair");
  for (const mission of draft.missions) {
    assert.equal(mission.countingPolicy.event_template_step_key, mission.presetStepKey);
    assert.ok(typeof mission.countingPolicy.one_count === "string");
  }
});

test("invalid or unsupported template contracts cannot produce a course", () => {
  for (const invalid of [
    undefined, null, [], "ryuyo", {}, { key: "ryuyo" },
    { contract_version: "event-template-v0", key: "ryuyo" },
    { contract_version: COMMON_EVENT_TEMPLATE_CONTRACT_VERSION, key: "unknown" },
    { contract_version: COMMON_EVENT_TEMPLATE_CONTRACT_VERSION, key: "__proto__" },
  ]) {
    assert.equal(buildCommonEventTemplateDraft(invalid), null);
  }
});

test("repeated planning is deterministic and caller edits cannot mutate shared presets or another draft", () => {
  const input = template("ryuyo");
  const first = buildCommonEventTemplateDraft(input);
  const second = buildCommonEventTemplateDraft(input);
  assert.ok(first && second);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.notEqual(first.course.config, second.course.config);
  assert.notEqual(first.template, first.course.config.event_template);
  assert.notEqual(first.missions[0]?.countingPolicy, second.missions[0]?.countingPolicy);
  const mission = first.missions[0];
  assert.ok(mission);
  mission.title = "主催者による編集";
  mission.countingPolicy.one_count = "主催者が調整した数え方";
  first.course.title = "編集したコース";
  first.course.config.event_template = template("stamp-rally");
  assert.deepEqual(buildCommonEventTemplateDraft(input), second);
  assert.deepEqual(input, template("ryuyo"));
  assert.ok(Object.isFrozen(COMMON_EVENT_TEMPLATE_PRESETS));
  assert.ok(Object.isFrozen(COMMON_EVENT_TEMPLATE_PRESETS[0]?.activities[0]?.steps[0]));
});
