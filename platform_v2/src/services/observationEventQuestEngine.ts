import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { appendLiveEvent } from "./observationEventLive.js";
import {
  buildQuestPromptContext,
  summarizeContextForPrompt,
  type QuestPromptContext,
} from "./observationEventContext.js";

export type QuestTrigger =
  | "interval"
  | "new_species"
  | "target_hit"
  | "stuck"
  | "rare_alert"
  | "ending_soon"
  | "manual";

export type QuestKind = "spatial" | "taxa" | "effort" | "absence" | "recovery" | "surprise";

interface GeneratedQuest {
  team_name: string;
  kind: QuestKind;
  headline: string;
  prompt: string;
  rationale: string;
  expires_in_minutes?: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/observation_event_quest.md");
let CACHED_TEMPLATE: string | null = null;

function loadTemplate(): string {
  if (CACHED_TEMPLATE !== null) return CACHED_TEMPLATE;
  CACHED_TEMPLATE = readFileSync(PROMPT_PATH, "utf-8");
  return CACHED_TEMPLATE;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadTemplate();
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

// === dedup: 同じ (sessionId, trigger) を 90 秒内に2 回呼ばない ===
const triggerDedup = new Map<string, number>();
const TRIGGER_DEDUP_MS = 90_000;

function canTrigger(sessionId: string, trigger: QuestTrigger): boolean {
  const key = `${sessionId}:${trigger}`;
  const last = triggerDedup.get(key) ?? 0;
  const now = Date.now();
  if (now - last < TRIGGER_DEDUP_MS) return false;
  triggerDedup.set(key, now);
  if (triggerDedup.size > 5_000) {
    const first = triggerDedup.keys().next().value;
    if (first) triggerDedup.delete(first);
  }
  return true;
}

function getClient(): GoogleGenAI {
  const config = loadConfig();
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

interface CallGeminiResult { rawText: string; modelUsed: string }

async function callGemini(prompt: string): Promise<CallGeminiResult> {
  const ai = getClient();
  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return { rawText: text, modelUsed: model };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw err;
    }
  }
  throw lastErr ?? new Error("gemini_all_models_failed");
}

function parseQuests(rawText: string): GeneratedQuest[] {
  if (!rawText) return [];
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { quests?: unknown };
    if (!parsed || !Array.isArray(parsed.quests)) return [];
    return parsed.quests
      .map((q) => q as Partial<GeneratedQuest>)
      .filter((q): q is GeneratedQuest =>
        typeof q.kind === "string" &&
        ["spatial", "taxa", "effort", "absence", "recovery", "surprise"].includes(q.kind) &&
        typeof q.team_name === "string" &&
        typeof q.headline === "string" &&
        typeof q.prompt === "string",
      )
      .slice(0, 6);
  } catch {
    return [];
  }
}

function findTeamId(ctx: QuestPromptContext, teamName: string): { teamId: string | null; scope: "team" | "event" | "participant" } {
  if (teamName === "all") return { teamId: null, scope: "event" };
  if (teamName === "organizer") return { teamId: null, scope: "event" };
  const t = ctx.teams.find((x) => x.name === teamName);
  return { teamId: t?.teamId ?? null, scope: t ? "team" : "event" };
}

// ---------------------------------------------------------------------------
// Static fallback: API 失敗時に生成する簡易 Quest
// ---------------------------------------------------------------------------
function buildStaticFallbackQuests(ctx: QuestPromptContext): GeneratedQuest[] {
  const out: GeneratedQuest[] = [];
  if (ctx.remainingTargets.length > 0) {
    out.push({
      team_name: "all",
      kind: "taxa",
      headline: `未達成: ${ctx.remainingTargets[0]}`,
      prompt: `あと ${ctx.remainingTargets.length} 種の目標が残ってる。${ctx.remainingTargets[0]} を探してみよう。`,
      rationale: "目標達成率はセッション全体の指標になる。残種は特に観察効率が伸びやすい。",
      expires_in_minutes: 15,
    });
  }
  const empty = ctx.meshHint.sampleEmpty[0];
  if (empty) {
    out.push({
      team_name: "all",
      kind: "spatial",
      headline: "未踏エリアへ",
      prompt: `周辺 ${empty.lat.toFixed(2)}, ${empty.lng.toFixed(2)} 付近はまだ誰も歩いてない。10 分歩いてみよう。`,
      rationale: "未踏メッシュを埋めると effort カバレッジが上がり、Occupancy Model 信頼度が改善する。",
      expires_in_minutes: 18,
    });
  }
  if (ctx.observations.recentTaxa.length > 0) {
    out.push({
      team_name: "all",
      kind: "absence",
      headline: "「いない」を確かめよう",
      prompt: `この場所で 5 分、目に入る種類を絞って探してみる。見つからなかったら「いない」を残そう。`,
      rationale: "Absence 記録は ZINB / Occupancy Model 入力として希少。研究貢献度が個人記録より高い。",
      expires_in_minutes: 12,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主関数: セッションに対して Quest を 1 回生成
// ---------------------------------------------------------------------------
export interface RunQuestGenerationOptions {
  trigger: QuestTrigger;
  forceContext?: QuestPromptContext;
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  /** dedup を bypass する手動呼び出し用 */
  skipDedup?: boolean;
}

export async function runQuestGeneration(
  sessionId: string,
  options: RunQuestGenerationOptions,
): Promise<{ quests: number; modelUsed: string | null; trigger: QuestTrigger }> {
  if (!options.skipDedup && !canTrigger(sessionId, options.trigger)) {
    return { quests: 0, modelUsed: null, trigger: options.trigger };
  }

  const ctx = options.forceContext
    ?? (await buildQuestPromptContext(sessionId, options.fallbackLat ?? null, options.fallbackLng ?? null));
  if (!ctx) return { quests: 0, modelUsed: null, trigger: options.trigger };

  const summary = summarizeContextForPrompt(ctx);
  const now = new Date();
  const promptText = renderPrompt({
    context: summary,
    trigger: options.trigger,
    session_started_at: ctx.observations.recentTaxa.length === 0 ? now.toISOString() : now.toISOString(),
    now: now.toISOString(),
  });

  let raw: CallGeminiResult | null = null;
  try {
    raw = await callGemini(promptText);
  } catch (err) {
    // 静的 fallback
    const fallback = buildStaticFallbackQuests(ctx);
    if (fallback.length === 0) {
      // eslint-disable-next-line no-console
      console.error("[quest-engine] gemini failed, no fallback", err);
      return { quests: 0, modelUsed: null, trigger: options.trigger };
    }
    return persistQuests(sessionId, ctx, fallback, "static-fallback", options.trigger);
  }

  let quests = parseQuests(raw.rawText);
  if (quests.length === 0) quests = buildStaticFallbackQuests(ctx);
  if (quests.length === 0) return { quests: 0, modelUsed: raw.modelUsed, trigger: options.trigger };

  return persistQuests(sessionId, ctx, quests, raw.modelUsed, options.trigger);
}

async function persistQuests(
  sessionId: string,
  ctx: QuestPromptContext,
  quests: GeneratedQuest[],
  modelUsed: string,
  trigger: QuestTrigger,
): Promise<{ quests: number; modelUsed: string; trigger: QuestTrigger }> {
  const pool = getPool();
  let inserted = 0;
  for (const q of quests) {
    const expiresMin = Math.max(5, Math.min(60, Math.round(q.expires_in_minutes ?? 15)));
    const { teamId, scope } = findTeamId(ctx, q.team_name);
    try {
      const result = await pool.query<{ quest_id: string }>(
        `INSERT INTO observation_event_quests (
            session_id, team_id, scope, kind, prompt, payload, generated_by, status, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'offered', NOW() + ($8 || ' minutes')::interval)
         RETURNING quest_id`,
        [
          sessionId,
          teamId,
          scope,
          q.kind,
          q.prompt,
          JSON.stringify({ headline: q.headline, rationale: q.rationale, team_name: q.team_name, trigger }),
          modelUsed,
          String(expiresMin),
        ],
      );
      const questId = result.rows[0]?.quest_id;
      if (!questId) continue;
      inserted++;
      await appendLiveEvent({
        sessionId,
        type: "quest_offered",
        scope: scope === "team" ? "team" : "all",
        teamId,
        payload: {
          quest_id: questId,
          kind: q.kind,
          headline: q.headline,
          prompt: q.prompt,
          rationale: q.rationale,
          team_name: q.team_name,
          expires_in_minutes: expiresMin,
          trigger,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[quest-engine] insert failed", err);
    }
  }
  return { quests: inserted, modelUsed, trigger };
}

// ---------------------------------------------------------------------------
// Quest 受諾 / 辞退 / 完了
// ---------------------------------------------------------------------------
export async function decideQuest(params: {
  questId: string;
  decision: "accepted" | "declined" | "completed" | "expired";
  decidedBy: string | null;
}): Promise<void> {
  const pool = getPool();
  const result = await pool.query<{ session_id: string; team_id: string | null; kind: string; payload: Record<string, unknown>; status: string }>(
    `UPDATE observation_event_quests
     SET status = $2,
         decided_by = COALESCE($3, decided_by),
         decided_at = COALESCE(decided_at, NOW())
     WHERE quest_id = $1
     RETURNING session_id, team_id, kind, payload, status`,
    [params.questId, params.decision, params.decidedBy],
  );
  const row = result.rows[0];
  if (!row) return;

  const eventType =
    params.decision === "accepted" ? "quest_accepted" :
    params.decision === "declined" ? "quest_declined" :
    "quest_completed";
  await appendLiveEvent({
    sessionId: row.session_id,
    type: eventType,
    scope: row.team_id ? "team" : "all",
    teamId: row.team_id,
    actorUserId: params.decidedBy,
    payload: {
      quest_id: params.questId,
      kind: row.kind,
      headline: (row.payload as { headline?: string }).headline ?? "",
    },
  });
}

// ---------------------------------------------------------------------------
// Scheduler: アプリ起動時に startQuestScheduler() を一度呼ぶ。
// 5 分ごとに「現在進行中の全セッション」に対して trigger='interval' を発火。
// ---------------------------------------------------------------------------
let schedulerHandle: NodeJS.Timeout | null = null;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

export function startQuestScheduler(): void {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    void runSchedulerTick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[quest-scheduler] tick failed", err);
    });
  }, SCHEDULER_INTERVAL_MS);
  if (typeof schedulerHandle.unref === "function") schedulerHandle.unref();
}

export function stopQuestScheduler(): void {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
}

async function runSchedulerTick(): Promise<void> {
  const pool = getPool();
  const result = await pool.query<{ session_id: string; location_lat: string | null; location_lng: string | null }>(
    `SELECT session_id, location_lat::text AS location_lat, location_lng::text AS location_lng
     FROM observation_event_sessions
     WHERE ended_at IS NULL
       AND started_at <= NOW()
       AND started_at >= NOW() - INTERVAL '8 hours'
     ORDER BY started_at DESC
     LIMIT 50`,
  );
  for (const row of result.rows) {
    void runQuestGeneration(row.session_id, {
      trigger: "interval",
      fallbackLat: row.location_lat ? Number(row.location_lat) : null,
      fallbackLng: row.location_lng ? Number(row.location_lng) : null,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[quest-scheduler] session ${row.session_id} failed`, err);
    });
  }
}
