import {
  COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
  isCommonEventTemplateConfig,
  type CommonEventTemplateConfig,
  type CommonEventTemplateKey,
} from "./commonEventTemplateContract.js";

export const COMMON_EVENT_TEMPLATE_PRESET_VERSION = "event-template-preset-v1" as const;

export type CommonEventTemplateActivityKey = Exclude<CommonEventTemplateKey, "ryuyo">;

export interface CommonEventTemplateStep {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly choices?: readonly { readonly value: string; readonly label: string }[];
  readonly answer?: string;
  readonly hint?: string;
  /** A real activity instruction, separate from browser-only demo instructions. */
  readonly target: string;
  readonly countUnit?: "scene" | "comparison_pair";
}

export interface CommonEventTemplateActivity {
  readonly key: CommonEventTemplateActivityKey;
  readonly title: string;
  readonly kind: "stamp" | "mission" | "together";
  readonly description: string;
  readonly steps: readonly CommonEventTemplateStep[];
}

export interface CommonEventTemplatePreset {
  readonly key: CommonEventTemplateKey;
  readonly title: string;
  readonly description: string;
  readonly activities: readonly CommonEventTemplateActivity[];
}

const STAMP_RALLY: CommonEventTemplateActivity = {
  key: "stamp-rally",
  title: "スタンプラリー",
  kind: "stamp",
  description: "3つの観察ポイントを、好きな順番で。見つけたら、自分の手帳に印をつけます。",
  steps: [
    {
      id: "stamp-look", title: "足元をよく見る",
      prompt: "葉、石、落ち葉。気になった形をひとつ探してみましょう。画面だけで試すときは、見つけたつもりでチェックできます。",
      target: "足元の葉・石・落ち葉などから、気になった形をひとつ見つける。",
    },
    {
      id: "stamp-compare", title: "ふたつを見くらべる",
      prompt: "似ているところ、違うところをひとつずつ。名前が分からなくても進められます。",
      target: "身の回りのふたつを見くらべ、似ているところか違いをひとつ確かめる。",
      countUnit: "comparison_pair",
    },
    {
      id: "stamp-remember", title: "発見を持ち帰る",
      prompt: "今日覚えておきたいことをひとつ決めたら、最後の印をつけましょう。",
      target: "観察で覚えておきたい発見を、言葉・絵・メモなどでひとつ残す。",
    },
  ],
};

const MISSION_QUEST: CommonEventTemplateActivity = {
  key: "mission-quest",
  title: "Mission / Quest",
  kind: "mission",
  description: "見る、くらべる、伝える。短いミッションをひとつずつ進めます。写真は任意です。",
  steps: [
    {
      id: "mission-distance", title: "観察する距離を考える",
      prompt: "近くの生きものを見るとき、どの行動から始めますか？ この体験では、距離をとって見ることを条件にしています。",
      choices: [{ value: "watch", label: "少し離れて、動きを見る" }, { value: "chase", label: "追いかけて近づく" }],
      answer: "watch", hint: "少し離れて見る、を選び直して記録すると次へ進めます。",
      target: "生きものを追いかけず、少し離れた位置から動きを観察する。",
    },
    {
      id: "mission-shape", title: "形を見つける",
      prompt: "目にとまった形をひとつ選んで記録しましょう。紙に描いてから選んでも進められます。",
      choices: [{ value: "round", label: "まるい形" }, { value: "long", label: "細長い形" }, { value: "jagged", label: "ぎざぎざの形" }],
      target: "目にとまった形をひとつ見つけ、言葉・絵・メモなどで表す。",
    },
    {
      id: "mission-tell", title: "違いをひとつ伝える",
      prompt: "見くらべて気づいたことは、どの見方に近いですか？ 選んだ内容を確かめて、体験を振り返りましょう。",
      choices: [{ value: "color", label: "色の違い" }, { value: "size", label: "大きさの違い" }, { value: "movement", label: "動きの違い" }],
      target: "色・大きさ・動きなど、見くらべて気づいた違いをひとつ伝える。",
    },
  ],
};

const COLLABORATIVE_OBSERVATION: CommonEventTemplateActivity = {
  key: "collaborative-observation",
  title: "みんなで観察",
  kind: "together",
  description: "共通テーマは「色・形・動き」。記録、内容の確認、集計への反映を順番に試せます。",
  steps: [
    {
      id: "together-color", title: "色の発見",
      prompt: "どの色に目がとまりましたか？ この体験では、選択した言葉だけを集計の見本に使います。",
      choices: [{ value: "green", label: "緑" }, { value: "brown", label: "茶色" }, { value: "yellow", label: "黄色" }],
      target: "身の回りで見つけた色をひとつ記録し、共通テーマに持ち寄る。",
    },
    {
      id: "together-shape", title: "形の発見",
      prompt: "似た形を集めると、違いにも気づきます。ひとつ選んで記録してみましょう。",
      choices: [{ value: "round", label: "まるい" }, { value: "long", label: "細長い" }, { value: "jagged", label: "ぎざぎざ" }],
      target: "身の回りで見つけた形をひとつ記録し、共通テーマに持ち寄る。",
    },
    {
      id: "together-movement", title: "動きの発見",
      prompt: "動いていても、じっとしていても、観察の手がかりになります。",
      choices: [{ value: "walking", label: "歩いている" }, { value: "flying", label: "飛んでいる" }, { value: "still", label: "じっとしている" }],
      target: "動いている様子やじっとしている様子をひとつ記録し、共通テーマに持ち寄る。",
    },
  ],
};

function freezeDefinition<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDefinition(child);
  }
  return value;
}

// Preview rendering and organizer draft creation use these same activities.
// Ryuuyo is a composition of the three common activities, not another engine.
export const COMMON_EVENT_TEMPLATE_PRESETS: readonly CommonEventTemplatePreset[] = freezeDefinition([
  { key: "stamp-rally", title: STAMP_RALLY.title, description: STAMP_RALLY.description, activities: [STAMP_RALLY] },
  { key: "mission-quest", title: MISSION_QUEST.title, description: MISSION_QUEST.description, activities: [MISSION_QUEST] },
  { key: "collaborative-observation", title: COLLABORATIVE_OBSERVATION.title, description: COLLABORATIVE_OBSERVATION.description, activities: [COLLABORATIVE_OBSERVATION] },
  {
    key: "ryuyo", title: "こんちゅうクンとめぐる、竜洋のとっておき。",
    description: "気に入った場所や小さな発見を、写真で３枚まで。あだ名もひと言も任意、紙でも残せる発見ノートの企画です。",
    activities: [STAMP_RALLY, MISSION_QUEST, COLLABORATIVE_OBSERVATION],
  },
]);

export interface CommonEventTemplateMissionDraft {
  /** Stable source key for same-session materialization; not a database ID. */
  presetStepKey: string;
  activityKey: CommonEventTemplateActivityKey;
  stationId: null;
  replacementForMissionId: null;
  scope: "participant" | "event";
  locationBinding: "none";
  title: string;
  target: string;
  countUnit: "scene" | "comparison_pair";
  goalCount: 1;
  countingPolicy: Record<string, unknown>;
  verificationPolicy: "organizer_review";
  weatherSensitivity: "all_weather";
  fallbackGroup: "";
  status: "draft";
  startsAt: null;
  endsAt: null;
  sortOrder: number;
}

export interface CommonEventTemplateDraft {
  presetVersion: typeof COMMON_EVENT_TEMPLATE_PRESET_VERSION;
  template: CommonEventTemplateConfig;
  course: {
    title: string;
    status: "draft";
    config: Record<string, unknown>;
  };
  missions: CommonEventTemplateMissionDraft[];
}

/**
 * Plan only. The authenticated adapter owns the atomic, idempotent insert and
 * must preserve existing courses, organizer edits and activation state on replay.
 * No session facts, participants, stations, evidence, consent or publication
 * state are inferred here. Real locations and operational conditions remain
 * organizer settings. All missions require explicit publication and review.
 */
export function buildCommonEventTemplateDraft(
  value: unknown,
  options: { title?: string } = {},
): CommonEventTemplateDraft | null {
  if (!isCommonEventTemplateConfig(value)) return null;
  const preset = COMMON_EVENT_TEMPLATE_PRESETS.find((candidate) => candidate.key === value.key);
  if (!preset) return null;
  const template: CommonEventTemplateConfig = {
    contract_version: COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
    key: preset.key,
  };
  const missions = preset.activities.flatMap((activity) => activity.steps.map((step): CommonEventTemplateMissionDraft => ({
    presetStepKey: step.id,
    activityKey: activity.key,
    stationId: null,
    replacementForMissionId: null,
    scope: activity.kind === "together" ? "event" : "participant",
    locationBinding: "none",
    title: step.title,
    target: step.target,
    countUnit: step.countUnit ?? "scene",
    goalCount: 1,
    countingPolicy: {
      one_count: step.countUnit === "comparison_pair" ? "主催者が確認した比較1組" : "主催者が確認した発見または活動1件",
      event_template_step_key: step.id,
    },
    verificationPolicy: "organizer_review",
    weatherSensitivity: "all_weather",
    fallbackGroup: "",
    status: "draft",
    startsAt: null,
    endsAt: null,
    sortOrder: 0,
  })));
  missions.forEach((mission, index) => { mission.sortOrder = index; });
  return {
    presetVersion: COMMON_EVENT_TEMPLATE_PRESET_VERSION,
    template,
    course: {
      title: options.title?.trim() || preset.title,
      status: "draft",
      config: {
        event_template: { ...template },
        event_template_preset_version: COMMON_EVENT_TEMPLATE_PRESET_VERSION,
      },
    },
    missions,
  };
}
