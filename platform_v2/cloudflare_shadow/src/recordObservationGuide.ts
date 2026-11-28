import type { D1Database } from "./core/env";
import { buildAiNoteEvidence, promptEvidence, DEFAULT_TAXON_NOTES, type AiNoteCountFact } from "./recordAiNote";
import { d1ReadingQuery, readRecordReading } from "./recordReading";

type GuideDb = Pick<D1Database, "prepare" | "batch">;
export type ObservationGuideGenerate = (request: Record<string, unknown>) => Promise<string>;

export const OBSERVATION_GUIDE_AXIS = "observation_guide";
export const OBSERVATION_GUIDE_MODEL_VERSION = "observation_guide_v1";
export const OBSERVATION_GUIDE_MAX_CHARS = 120;
export const OBSERVATION_GUIDE_MAX_ATTEMPTS = 2;

const PRAISE = /すごい|凄い|素晴らしい|すばらしい|上手|素敵|すてき|見事|お見事|立派|最高|完璧/u;
const TECHNIQUE = /ピント|構図|撮り方|撮影|ブレ|ボケ|露出|画質/u;
const EXCLAIM = /[!！]/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const CONDESCEND = /ですね|でしょう|ましょう|くださいね/u;

export function observationGuideFailures(text: string): string[] {
  const normalized = text.normalize("NFKC");
  const failures: string[] = [];
  const length = [...text.trim()].length;
  if (length === 0) failures.push("empty");
  if (length > OBSERVATION_GUIDE_MAX_CHARS) failures.push("length");
  if (/\n/u.test(text)) failures.push("multiline");
  if (EXCLAIM.test(normalized)) failures.push("exclaim");
  if (EMOJI.test(text)) failures.push("emoji");
  if (PRAISE.test(normalized)) failures.push("praise");
  if (TECHNIQUE.test(normalized)) failures.push("technique");
  if (CONDESCEND.test(normalized)) failures.push("tone");
  return failures;
}

export const OBSERVATION_GUIDE_OUTPUT_SCHEMA = {
  type: "object",
  properties: { guide: { type: "string" } },
  required: ["guide"],
} as const;

export function buildObservationGuidePrompt(labels: readonly string[], feedback = ""): string {
  return [
    "自然観察指導員が隣でそっと言う一言として、この記録を見る人への観察ガイドを日本語で1つだけ書いてください。使える材料は下の根拠一覧だけです。一覧にない事実・名前・数・習性を足さないでください。",
    "内容は「見るポイントを1つだけ」。色・もよう・形・比べる先など、観察が深まる具体的な一点を示す。対象は自然に限らず、建物・看板・まちの行事なら、その対象に合う見るポイントにする。",
    `${OBSERVATION_GUIDE_MAX_CHARS}字以内、1〜2文。「〜を見てみてください」「〜に注目すると〜が分かります」のような落ち着いた言い方にする。`,
    "禁止: 感嘆符、絵文字、評価・称賛（すごい、素晴らしい、上手、素敵等）、写真の撮り方の採点（ピント、構図、撮り方等）、上から目線、なれなれしい言い方、「ですね」。英字・内部の番号も出さない。",
    "出力はJSONで {\"guide\": \"本文\"} のみ。",
    "根拠一覧:",
    ...labels.map((label) => `- ${label}`),
    ...(feedback ? [feedback] : []),
  ].join("\n");
}

export type GenerateObservationGuideInput = {
  db: GuideDb;
  recordId: string;
  ownerUserId: string;
  model: string;
  generate: ObservationGuideGenerate;
  protectedRecord?: boolean;
  counts?: readonly AiNoteCountFact[];
};
export type GenerateObservationGuideResult = { stored: boolean; called: boolean; failures: string[] };

export async function generateAndStoreObservationGuide(input: GenerateObservationGuideInput): Promise<GenerateObservationGuideResult> {
  const { db, recordId, ownerUserId } = input;
  if (input.protectedRecord) return { stored: false, called: false, failures: [] };
  const reading = await readRecordReading(d1ReadingQuery(db as unknown as Parameters<typeof d1ReadingQuery>[0]), recordId);
  const evidence = buildAiNoteEvidence(reading, { taxonNotes: DEFAULT_TAXON_NOTES, counts: input.counts });
  if (!reading.analyzed || !evidence.some((item) => item.capture)) return { stored: false, called: false, failures: [] };
  const labels = promptEvidence(evidence).map((item) => item.label);
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
    let text = "";
    try {
      const parsed = JSON.parse(raw) as { guide?: unknown };
      text = typeof parsed.guide === "string" ? parsed.guide.trim() : "";
    } catch { text = ""; }
    failures = observationGuideFailures(text);
    if (failures.length === 0) {
      await db.prepare(
        `INSERT INTO record_reading_cards (card_id, visit_id, axis, title, body, sources_json, visibility, generation_condition_json, quality_gate_json, model_version, created_by_user_id)
         VALUES (?, ?, ?, '', ?, '[]', 'public', '{}', '{"textGate":true}', ?, ?)
         ON CONFLICT(visit_id, axis) DO UPDATE SET body = excluded.body, quality_gate_json = excluded.quality_gate_json,
           model_version = excluded.model_version, created_by_user_id = excluded.created_by_user_id, updated_at = CURRENT_TIMESTAMP`,
      ).bind(`reading_card_guide_${recordId}`, recordId, OBSERVATION_GUIDE_AXIS, text, OBSERVATION_GUIDE_MODEL_VERSION, ownerUserId).run();
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
