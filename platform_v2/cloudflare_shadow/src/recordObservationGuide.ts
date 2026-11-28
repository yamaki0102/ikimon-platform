import type { D1Database } from "./core/env";

type GuideDb = Pick<D1Database, "prepare" | "batch">;
export type ObservationGuideGenerate = (request: Record<string, unknown>) => Promise<string>;

export const OBSERVATION_GUIDE_AXIS = "observation_guide";
export const OBSERVATION_GUIDE_MODEL_VERSION = "observation_guide_v2";
export const OBSERVATION_GUIDE_MAX_CHARS = 80;
export const OBSERVATION_GUIDE_MAX_ATTEMPTS = 2;

const PRAISE = /すごい|凄い|素晴らしい|すばらしい|上手|素敵|すてき|見事|お見事|立派|最高|完璧/u;
const TECHNIQUE = /ピント|構図|撮り方|撮影|ブレ|ボケ|露出|画質|接写|クローズアップ|撮/u;
const EXCLAIM = /[!！]/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const CONDESCEND = /ですね|でしょう|ましょう|くださいね/u;
const ENDING_PARTICLE = /[ねよ](?:。|$)/u;
const SENSE = /かわいい|可愛い|きれい|綺麗|美しい/u;
const POLITE_END = /(?:です|ます|ください)$/u;

export function observationGuideFailures(text: string): string[] {
  const normalized = text.normalize("NFKC");
  const failures: string[] = [];
  const trimmed = text.trim();
  const length = [...trimmed].length;
  if (length === 0) return failures;
  if (length > OBSERVATION_GUIDE_MAX_CHARS) failures.push("length");
  if (/\n/u.test(text)) failures.push("multiline");
  if (EXCLAIM.test(normalized)) failures.push("exclaim");
  if (EMOJI.test(text)) failures.push("emoji");
  if (PRAISE.test(normalized)) failures.push("praise");
  if (TECHNIQUE.test(normalized)) failures.push("technique");
  if (CONDESCEND.test(normalized)) failures.push("tone");
  if (ENDING_PARTICLE.test(normalized)) failures.push("particle");
  if (SENSE.test(normalized)) failures.push("sense");
  const sentences = normalized.trim().split(/(?<=。)/u).map((part) => part.trim().replace(/。$/u, "")).filter(Boolean);
  if (sentences.length === 0 || !sentences.every((part) => POLITE_END.test(part))) failures.push("ending");
  return failures;
}

export const OBSERVATION_GUIDE_OUTPUT_SCHEMA = {
  type: "object",
  properties: { guide: { type: "string" } },
  required: ["guide"],
} as const;

export function buildObservationGuidePrompt(labels: readonly string[], feedback = ""): string {
  return [
    "あなたは自然観察指導員です。この記録を撮った人の隣で、同じ写真を一緒に見ています。次に見るとき目を向けると面白い一点を、そっと一言で伝えてください。",
    "材料は下の「写真の読み取り結果」だけ。そこに無い特徴・習性・数を足さない。",
    "選び方: 「次に確かめるとよい点」や「見分け方」「似た種類との違い」から、実物で確かめやすい一点を1つだけ選ぶ。「写真に見えた特徴」を一言添えて、どこを見ればよいかが分かるようにする。生きものの手がかりが無いときは「場所の手がかり」から選ぶ。",
    "生きものの名前は材料にあるものだけ使える。「AIの推定」の名前は言い切らず「〜のようです」とする。むずかしい用語（小穂、葉舌、花序など）はふだんの言葉に言い換える。",
    "伝えるほどの一点が無いときは guide を空文字にする。無理に作らない。",
    "書き方: まず写真に見えていることを1つ言い、続けて、次に見るとき何を確かめる・探すと面白いかを添える。80字以内、1〜2文。どの文も「〜です。」「〜ます。」「〜みてください。」のどれかで終える。文末に「ね」「よ」を付けない。",
    "感嘆符・絵文字・ほめ言葉・写真の撮り方への言及（接写、クローズアップ、撮る等）・「でしょう」「ましょう」・英字は使わない。",
    "出力はJSONで {\"guide\": \"本文\"} のみ。",
    "写真の読み取り結果:",
    ...labels.map((label) => `- ${label}`),
    ...(feedback ? [feedback] : []),
  ].join("\n");
}

type SuggestionRow = { proposed_name: string | null; proposed_scientific_name: string | null; confidence_score: number | null; rationale_json: string | null };
type ClaimRow = { proposed_name: string | null; accepted_name: string | null; claim_status: string; actor_kind: string };
type CueRow = { label?: unknown; evidence?: unknown; confidence?: unknown };

const HUMAN_NAME = /^(?:ヒト|人間|人物|人|Homo sapiens)$/iu;
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(str).filter(Boolean) : str(value) ? [str(value)] : [];

export type ObservationGuideMaterial = { labels: string[]; human: boolean };

export function buildObservationGuideMaterial(input: {
  suggestions: readonly SuggestionRow[];
  claims?: readonly ClaimRow[];
  cues?: readonly CueRow[];
}): ObservationGuideMaterial {
  const labels: string[] = [];
  const claims = input.claims ?? [];
  const accepted = claims.find((claim) => claim.claim_status === "accepted" && str(claim.accepted_name || claim.proposed_name));
  const owner = claims.find((claim) => claim.actor_kind === "owner" && str(claim.proposed_name));
  const top = input.suggestions[0];
  const human = !!top && (HUMAN_NAME.test(str(top.proposed_name)) || HUMAN_NAME.test(str(top.proposed_scientific_name)));
  if (accepted) labels.push(`確認済みの名前: ${str(accepted.accepted_name || accepted.proposed_name)}`);
  else if (owner) labels.push(`本人が付けた名前: ${str(owner.proposed_name)}`);
  for (const suggestion of input.suggestions.slice(0, 2)) {
    const name = str(suggestion.proposed_name) || str(suggestion.proposed_scientific_name);
    if (!name) continue;
    let rationale: Record<string, unknown> = {};
    try { rationale = JSON.parse(suggestion.rationale_json ?? "{}") as Record<string, unknown>; } catch { rationale = {}; }
    labels.push(`生きもの（AIの推定）: ${name}`);
    for (const item of strList(rationale.visualEvidence)) labels.push(`写真に見えた特徴: ${item}`);
    for (const item of strList(rationale.distinguishingPoints ?? rationale.distinguishing)) labels.push(`見分け方: ${item}`);
    for (const item of strList(rationale.similarTaxa ?? rationale.similar)) labels.push(`似た種類との違い: ${item}`);
    for (const item of strList(rationale.needsMoreEvidence)) labels.push(`次に確かめるとよい点: ${item}`);
  }
  const cues = (input.cues ?? [])
    .filter((cue) => typeof cue.confidence === "number" && cue.confidence >= 0.6 && str(cue.label))
    .sort((a, b) => Number(b.confidence) - Number(a.confidence))
    .slice(0, 4);
  for (const cue of cues) labels.push(`場所の手がかり: ${str(cue.label)}${str(cue.evidence) ? `（${str(cue.evidence)}）` : ""}`);
  return { labels, human };
}

async function hashLabels(labels: readonly string[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(labels.join("\n")));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export type GenerateObservationGuideInput = {
  db: GuideDb;
  recordId: string;
  ownerUserId: string;
  model: string;
  generate: ObservationGuideGenerate;
  protectedRecord?: boolean;
};
export type GenerateObservationGuideResult = { stored: boolean; called: boolean; failures: string[] };

export async function generateAndStoreObservationGuide(input: GenerateObservationGuideInput): Promise<GenerateObservationGuideResult> {
  const { db, recordId, ownerUserId } = input;
  if (input.protectedRecord) return { stored: false, called: false, failures: [] };
  const suggestions = (await db.prepare(
    `SELECT s.proposed_name, s.proposed_scientific_name, s.confidence_score, s.rationale_json
       FROM observation_ai_suggestions s
       JOIN record_observations ro ON ro.observation_id = s.observation_id
      WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = ? AND s.suggestion_status = 'active'
      ORDER BY s.confidence_score DESC, s.created_at DESC LIMIT 2`,
  ).bind(recordId).all<SuggestionRow>()).results ?? [];
  const claims = (await db.prepare(
    `SELECT c.proposed_name, c.accepted_name, c.claim_status, c.actor_kind
       FROM observation_identification_claims c
       JOIN record_observations ro ON ro.observation_id = c.observation_id
      WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = ? AND c.claim_status IN ('candidate', 'accepted') AND c.stance = 'support'
      ORDER BY c.created_at DESC LIMIT 8`,
  ).bind(recordId).all<ClaimRow>()).results ?? [];
  const assessment = await db.prepare(
    `SELECT value_json FROM environment_assessments
      WHERE record_runtime = 'cloudflare_d1' AND record_id = ? ORDER BY updated_at DESC LIMIT 1`,
  ).bind(recordId).first<{ value_json: string | null }>();
  let cues: CueRow[] = [];
  try {
    const parsed = JSON.parse(assessment?.value_json ?? "{}") as { cues?: unknown };
    if (Array.isArray(parsed.cues)) cues = parsed.cues as CueRow[];
  } catch { cues = []; }
  const material = buildObservationGuideMaterial({ suggestions, claims, cues });
  if (material.human || material.labels.length === 0) return { stored: false, called: false, failures: [] };
  const labels = material.labels;
  const materialHash = await hashLabels(labels);
  const existing = await db.prepare(
    `SELECT quality_gate_json FROM record_reading_cards WHERE visit_id = ? AND axis = ? LIMIT 1`,
  ).bind(recordId, OBSERVATION_GUIDE_AXIS).first<{ quality_gate_json: string | null }>();
  if (existing) {
    try {
      if ((JSON.parse(existing.quality_gate_json ?? "{}") as { materialHash?: string }).materialHash === materialHash) return { stored: false, called: false, failures: [] };
    } catch { /* regenerate */ }
  }
  let feedback = "";
  let failures: string[] = [];
  for (let attempt = 0; attempt < OBSERVATION_GUIDE_MAX_ATTEMPTS; attempt += 1) {
    const raw = await input.generate({
      contents: [{ role: "user", parts: [{ text: buildObservationGuidePrompt(labels, feedback) }] }],
      generationConfig: {
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseJsonSchema: OBSERVATION_GUIDE_OUTPUT_SCHEMA,
        thinkingConfig: { thinkingLevel: "minimal" },
      },
    });
    let guide = "";
    try {
      const parsed = JSON.parse(raw) as { guide?: unknown };
      guide = typeof parsed.guide === "string" ? parsed.guide.trim() : "";
    } catch { guide = ""; }
    failures = observationGuideFailures(guide);
    if (failures.length === 0 && guide === "") return { stored: false, called: true, failures: [] };
    if (failures.length === 0) {
      await db.prepare(
        `INSERT INTO record_reading_cards (card_id, visit_id, axis, title, body, sources_json, visibility, generation_condition_json, quality_gate_json, model_version, created_by_user_id)
         VALUES (?, ?, ?, '', ?, '[]', 'public', '{}', ?, ?, ?)
         ON CONFLICT(visit_id, axis) DO UPDATE SET body = excluded.body, quality_gate_json = excluded.quality_gate_json,
           model_version = excluded.model_version, created_by_user_id = excluded.created_by_user_id, updated_at = CURRENT_TIMESTAMP`,
      ).bind(`reading_card_guide_${recordId}`, recordId, OBSERVATION_GUIDE_AXIS, guide, JSON.stringify({ textGate: true, materialHash }), OBSERVATION_GUIDE_MODEL_VERSION, ownerUserId).run();
      return { stored: true, called: true, failures: [] };
    }
    feedback = `前回の出力は不合格でした（${failures.join("、")}）。禁止事項を守って書き直してください。`;
  }
  return { stored: false, called: true, failures };
}

export async function loadObservationGuide(db: GuideDb, recordId: string): Promise<string | null> {
  const row = await db.prepare(
    `SELECT body FROM record_reading_cards WHERE visit_id = ? AND axis = ? AND visibility = 'public' LIMIT 1`,
  ).bind(recordId, OBSERVATION_GUIDE_AXIS).first<{ body: string }>();
  const body = row?.body?.trim() ?? "";
  return body && observationGuideFailures(body).length === 0 ? body : null;
}

export const OBSERVATION_GUIDE_ATTEMPT_AXIS = "observation_guide_attempted";

export type ObservationGuideBackfillDeps = {
  db: GuideDb;
  model: string;
  generate: ObservationGuideGenerate;
  isProtected: (recordId: string) => Promise<boolean>;
};

export function parseGuideBackfillOwnerIds(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}

export async function runObservationGuideOwnerBackfill(
  deps: ObservationGuideBackfillDeps,
  ownerIds: readonly string[],
  limit = 8,
): Promise<{ selected: number; stored: number }> {
  if (ownerIds.length === 0 || limit <= 0) return { selected: 0, stored: 0 };
  const marks = ownerIds.map(() => "?").join(",");
  const rows = (await deps.db.prepare(
    `SELECT o.observation_id AS record_id, o.owner_user_id AS owner_user_id
       FROM observations o
      WHERE o.owner_user_id IN (${marks})
        AND NOT EXISTS (SELECT 1 FROM record_reading_cards c WHERE c.visit_id = o.observation_id AND c.axis IN (?, ?))
        AND EXISTS (SELECT 1 FROM observation_ai_suggestions s JOIN record_observations ro ON ro.observation_id = s.observation_id
                     WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = o.observation_id AND s.suggestion_status = 'active')
      ORDER BY o.created_at DESC LIMIT ?`,
  ).bind(...ownerIds, OBSERVATION_GUIDE_AXIS, OBSERVATION_GUIDE_ATTEMPT_AXIS, limit).all<{ record_id: string; owner_user_id: string }>()).results ?? [];
  let stored = 0;
  for (const row of rows.slice(0, limit)) {
    await deps.db.prepare(
      `INSERT OR IGNORE INTO record_reading_cards (card_id, visit_id, axis, title, body, sources_json, visibility, model_version, created_by_user_id)
       VALUES (?, ?, ?, '', '', '[]', 'owner_only', ?, ?)`,
    ).bind(`reading_card_guide_attempt_${row.record_id}`, row.record_id, OBSERVATION_GUIDE_ATTEMPT_AXIS, OBSERVATION_GUIDE_MODEL_VERSION, row.owner_user_id).run();
    try {
      const protectedRecord = await deps.isProtected(row.record_id);
      const result = await generateAndStoreObservationGuide({
        db: deps.db, recordId: row.record_id, ownerUserId: row.owner_user_id, model: deps.model, generate: deps.generate, protectedRecord,
      });
      if (result.stored) stored += 1;
    } catch { /* attempt marker prevents retry */ }
  }
  return { selected: rows.length, stored };
}
