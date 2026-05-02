import { loadConfig } from "../config.js";
import { getPool } from "../db.js";

const DEEPSEEK_V4_FLASH_INPUT_MISS_USD_PER_MILLION = 0.14;
const DEEPSEEK_V4_FLASH_OUTPUT_USD_PER_MILLION = 0.28;
const PROFILE_DIGEST_VERSION = 1;

export type ProfileNoteDigestPlaceChapter = {
  placeName: string;
  readingAngle: string;
  localClue: string;
};

export type ProfileNoteDigest = {
  userId: string;
  todayReading: string;
  learningHighlight: string;
  localContribution: string;
  growthStory: string;
  contributionStory: string;
  placeChapters: ProfileNoteDigestPlaceChapter[];
  sourceStats: {
    observationCount: number;
    placeCount: number;
    lifeListCount: number;
    identificationCount: number;
  };
  generatedAt: string;
  sourceKind: "local" | "deepseek" | string;
};

type DigestStats = ProfileNoteDigest["sourceStats"] & {
  supportedCount: number;
  openQuestionCount: number;
};

type DigestVisit = {
  visitId: string;
  observedAt: string;
  displayName: string;
  placeName: string;
  municipality: string | null;
  note: string | null;
  identificationCount: number;
};

type DigestPlace = {
  placeName: string;
  municipality: string | null;
  visitCount: number;
  latestDisplayName: string | null;
  previousObservedAt: string | null;
};

type DigestContext = {
  stats: DigestStats;
  latestVisits: DigestVisit[];
  places: DigestPlace[];
  existing: ProfileNoteDigest | null;
};

type RefreshInput = {
  userId: string;
  visitId?: string | null;
};

type DeepseekDigestJson = {
  todayReading?: unknown;
  learningHighlight?: unknown;
  localContribution?: unknown;
  growthStory?: unknown;
  contributionStory?: unknown;
  placeChapters?: unknown;
};

type DeepseekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export function estimateProfileDigestTokenCount(text: string): number {
  return Math.max(1, Math.ceil(Array.from(text).length / 3));
}

export function estimateProfileDigestCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (Math.max(0, inputTokens) / 1_000_000) * DEEPSEEK_V4_FLASH_INPUT_MISS_USD_PER_MILLION
    + (Math.max(0, outputTokens) / 1_000_000) * DEEPSEEK_V4_FLASH_OUTPUT_USD_PER_MILLION
  );
}

function compactText(value: string | null | undefined, maxLength: number): string {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function safeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function sanitizeDigestText(value: unknown, fallback: string, maxLength = 180): string {
  return compactText(typeof value === "string" ? value : fallback, maxLength) || fallback;
}

function sanitizePlaceChapters(value: unknown, fallback: ProfileNoteDigestPlaceChapter[]): ProfileNoteDigestPlaceChapter[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const chapters = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      return {
        placeName: sanitizeDigestText(record.placeName, "", 48),
        readingAngle: sanitizeDigestText(record.readingAngle, "", 90),
        localClue: sanitizeDigestText(record.localClue, "", 90),
      };
    })
    .filter((item): item is ProfileNoteDigestPlaceChapter => Boolean(item?.placeName && item.readingAngle && item.localClue))
    .slice(0, 4);
  return chapters.length > 0 ? chapters : fallback;
}

function fallbackPlaceChapters(places: DigestPlace[]): ProfileNoteDigestPlaceChapter[] {
  return places.slice(0, 4).map((place) => ({
    placeName: place.placeName,
    readingAngle: place.latestDisplayName
      ? `${place.latestDisplayName} を起点に、前回との差分を読む`
      : "次に見えるものを探しながら読む",
    localClue: `${place.visitCount} 回分の訪問が、この場所を読み返す手がかりになっています。`,
  }));
}

function buildLocalDigest(userId: string, context: DigestContext, sourceObservationId: string | null): ProfileNoteDigest {
  const latest = context.latestVisits[0] ?? null;
  const firstPlace = context.places[0] ?? null;
  const latestName = latest?.displayName ?? "最近のページ";
  const latestPlace = latest?.placeName ?? firstPlace?.placeName ?? "いつもの地域";
  const stats = context.stats;
  const chapters = fallbackPlaceChapters(context.places);

  return {
    userId,
    todayReading: latest
      ? `${latestPlace} の ${latestName} から読むと、前回の発見と次に見たい観点がつながります。`
      : "まだページは薄いですが、近くの記録を読むだけでも次に見たい観点が生まれます。",
    learningHighlight: stats.supportedCount > 0
      ? `${stats.supportedCount} 件で名前や同定の手がかりが育っています。分かる範囲が少しずつ広がっています。`
      : `${stats.openQuestionCount} 件の名前が揺れています。分からなさも、次に見返す理由として残っています。`,
    localContribution: `${stats.observationCount} ページ、${stats.placeCount} か所、${stats.lifeListCount} 種の範囲で、この地域を読み返す材料が増えています。`,
    growthStory: firstPlace
      ? `${firstPlace.placeName} を何度も読むほど、同じ場所の季節差や見落としていた対象が見えやすくなります。`
      : "ページが増えるほど、自分が何をよく見ているか、次に何を確かめたいかが見えます。",
    contributionStory: "大げさな成果ではなく、キミの一つひとつの観察が、地域の自然をあとから読める形で少し厚くしています。",
    placeChapters: chapters,
    sourceStats: {
      observationCount: stats.observationCount,
      placeCount: stats.placeCount,
      lifeListCount: stats.lifeListCount,
      identificationCount: stats.identificationCount,
    },
    generatedAt: new Date().toISOString(),
    sourceKind: sourceObservationId ? "local" : (context.existing?.sourceKind ?? "local"),
  };
}

function buildDigestPrompt(context: DigestContext, localDigest: ProfileNoteDigest): string {
  const payload = {
    task: "ikimon.life profile notebook digest",
    constraints: [
      "Japanese only",
      "Do not encourage posting or writing",
      "Make the user's history feel worth rereading",
      "Use only the provided statistics; do not overclaim scientific impact",
      "Treat the model output as copywriting draft only; facts come from stats and latestVisits",
      "Do not mention exact coordinates or private location details",
      "Return compact JSON only",
    ],
    outputSchema: {
      todayReading: "string <= 120 chars",
      learningHighlight: "string <= 120 chars",
      localContribution: "string <= 120 chars",
      growthStory: "string <= 140 chars",
      contributionStory: "string <= 140 chars",
      placeChapters: [
        {
          placeName: "string",
          readingAngle: "string <= 70 chars",
          localClue: "string <= 70 chars",
        },
      ],
    },
    stats: context.stats,
    latestVisits: context.latestVisits.slice(0, 5).map((visit) => ({
      observedAt: visit.observedAt.slice(0, 10),
      displayName: visit.displayName,
      placeName: visit.placeName,
      municipality: visit.municipality,
      note: compactText(visit.note, 80),
      identificationCount: visit.identificationCount,
    })),
    places: context.places.slice(0, 4),
    previousDigest: context.existing
      ? {
          todayReading: context.existing.todayReading,
          learningHighlight: context.existing.learningHighlight,
          localContribution: context.existing.localContribution,
          growthStory: context.existing.growthStory,
          contributionStory: context.existing.contributionStory,
        }
      : null,
    fallback: localDigest,
  };
  return JSON.stringify(payload);
}

function clampPromptToTokenBudget(prompt: string, maxTokens: number): string {
  let current = prompt;
  while (estimateProfileDigestTokenCount(current) > maxTokens && current.length > 800) {
    current = current.slice(0, Math.floor(current.length * 0.86));
  }
  return current;
}

async function loadDigestContext(userId: string): Promise<DigestContext> {
  const pool = getPool();
  const [statsResult, latestResult, placesResult, existing] = await Promise.all([
    pool.query<{
      observation_count: string;
      place_count: string;
      life_list_count: string;
      identification_count: string;
      supported_count: string;
      open_question_count: string;
    }>(
      `select
          count(distinct v.visit_id)::text as observation_count,
          count(distinct v.place_id) filter (where v.place_id is not null)::text as place_count,
          count(distinct coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, '')))
            filter (where coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, '')) is not null)::text as life_list_count,
          count(distinct i.identification_id)::text as identification_count,
          count(distinct v.visit_id) filter (where i.identification_id is not null)::text as supported_count,
          count(distinct v.visit_id) filter (
            where i.identification_id is null
              and coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, '')) is null
          )::text as open_question_count
         from visits v
         left join occurrences o on o.visit_id = v.visit_id and coalesce(o.subject_index, 0) = 0
         left join identifications i on i.occurrence_id = o.occurrence_id
        where v.user_id = $1`,
      [userId],
    ),
    pool.query<{
      visit_id: string;
      observed_at: string;
      display_name: string | null;
      place_name: string | null;
      municipality: string | null;
      note: string | null;
      identification_count: string;
    }>(
      `select
          v.visit_id,
          v.observed_at::text,
          coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), '名前を確かめているページ') as display_name,
          coalesce(p.canonical_name, v.observed_municipality, 'いつもの場所') as place_name,
          v.observed_municipality as municipality,
          v.note,
          count(distinct i.identification_id)::text as identification_count
         from visits v
         left join places p on p.place_id = v.place_id
         left join occurrences o on o.visit_id = v.visit_id and coalesce(o.subject_index, 0) = 0
         left join identifications i on i.occurrence_id = o.occurrence_id
        where v.user_id = $1
        group by v.visit_id, v.observed_at, display_name, place_name, v.observed_municipality, v.note
        order by v.observed_at desc, v.visit_id desc
        limit 8`,
      [userId],
    ),
    pool.query<{
      place_name: string | null;
      municipality: string | null;
      visit_count: string;
      latest_display_name: string | null;
      previous_observed_at: string | null;
    }>(
      `with place_visits as (
          select
            v.place_id,
            coalesce(p.canonical_name, v.observed_municipality, 'いつもの場所') as place_name,
            v.observed_municipality as municipality,
            v.observed_at,
            coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), '名前を確かめているページ') as display_name,
            row_number() over (partition by v.place_id order by v.observed_at desc, v.visit_id desc) as rn,
            count(*) over (partition by v.place_id) as visit_count
          from visits v
          left join places p on p.place_id = v.place_id
          left join occurrences o on o.visit_id = v.visit_id and coalesce(o.subject_index, 0) = 0
         where v.user_id = $1
           and v.place_id is not null
        )
        select
          place_name,
          municipality,
          max(visit_count)::text as visit_count,
          max(display_name) filter (where rn = 1) as latest_display_name,
          (max(observed_at) filter (where rn = 2))::text as previous_observed_at
        from place_visits
        group by place_id, place_name, municipality
        order by max(observed_at) desc
        limit 6`,
      [userId],
    ),
    getProfileNoteDigest(userId),
  ]);
  const statsRow = statsResult.rows[0];
  return {
    stats: {
      observationCount: safeInteger(statsRow?.observation_count),
      placeCount: safeInteger(statsRow?.place_count),
      lifeListCount: safeInteger(statsRow?.life_list_count),
      identificationCount: safeInteger(statsRow?.identification_count),
      supportedCount: safeInteger(statsRow?.supported_count),
      openQuestionCount: safeInteger(statsRow?.open_question_count),
    },
    latestVisits: latestResult.rows.map((row) => ({
      visitId: row.visit_id,
      observedAt: row.observed_at,
      displayName: row.display_name ?? "名前を確かめているページ",
      placeName: row.place_name ?? "いつもの場所",
      municipality: row.municipality,
      note: row.note,
      identificationCount: safeInteger(row.identification_count),
    })),
    places: placesResult.rows.map((row) => ({
      placeName: row.place_name ?? "いつもの場所",
      municipality: row.municipality,
      visitCount: safeInteger(row.visit_count),
      latestDisplayName: row.latest_display_name,
      previousObservedAt: row.previous_observed_at,
    })),
    existing,
  };
}

function parseStoredDigest(row: {
  user_id: string;
  today_reading: string;
  learning_highlight: string;
  local_contribution: string;
  growth_story: string;
  contribution_story: string;
  place_chapters: unknown;
  source_stats: unknown;
  generated_at: string;
  source_kind: string;
}): ProfileNoteDigest {
  const sourceStats = row.source_stats && typeof row.source_stats === "object"
    ? row.source_stats as Record<string, unknown>
    : {};
  return {
    userId: row.user_id,
    todayReading: row.today_reading,
    learningHighlight: row.learning_highlight,
    localContribution: row.local_contribution,
    growthStory: row.growth_story,
    contributionStory: row.contribution_story,
    placeChapters: sanitizePlaceChapters(row.place_chapters, []),
    sourceStats: {
      observationCount: safeInteger(sourceStats.observationCount),
      placeCount: safeInteger(sourceStats.placeCount),
      lifeListCount: safeInteger(sourceStats.lifeListCount),
      identificationCount: safeInteger(sourceStats.identificationCount),
    },
    generatedAt: row.generated_at,
    sourceKind: row.source_kind,
  };
}

export async function getProfileNoteDigest(userId: string | null | undefined): Promise<ProfileNoteDigest | null> {
  if (!userId) {
    return null;
  }
  try {
    const pool = getPool();
    const result = await pool.query<{
      user_id: string;
      today_reading: string;
      learning_highlight: string;
      local_contribution: string;
      growth_story: string;
      contribution_story: string;
      place_chapters: unknown;
      source_stats: unknown;
      generated_at: string;
      source_kind: string;
    }>(
      `select
          user_id,
          today_reading,
          learning_highlight,
          local_contribution,
          growth_story,
          contribution_story,
          place_chapters,
          source_stats,
          generated_at::text,
          source_kind
         from profile_note_digests
        where user_id = $1
        limit 1`,
      [userId],
    );
    const row = result.rows[0];
    return row ? parseStoredDigest(row) : null;
  } catch {
    return null;
  }
}

async function getMonthlyUsageUsd(): Promise<number> {
  const pool = getPool();
  const result = await pool.query<{ total: string | null }>(
    `select coalesce(sum(estimated_cost_usd), 0)::text as total
       from profile_note_digest_usage
      where created_at >= date_trunc('month', now())`,
  );
  return Number(result.rows[0]?.total ?? 0) || 0;
}

async function callDeepseekDigest(apiKey: string, model: string, prompt: string, maxOutputTokens: number): Promise<{
  json: DeepseekDigestJson;
  inputTokens: number;
  outputTokens: number;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You write compact Japanese notebook digests for a citizen-science biodiversity app. Return JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxOutputTokens,
        temperature: 0.35,
      }),
    });
    if (!response.ok) {
      throw new Error(`deepseek_digest_failed:${response.status}`);
    }
    const body = await response.json() as DeepseekChatResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("deepseek_digest_empty");
    }
    return {
      json: JSON.parse(content) as DeepseekDigestJson,
      inputTokens: safeInteger(body.usage?.prompt_tokens) || estimateProfileDigestTokenCount(prompt),
      outputTokens: safeInteger(body.usage?.completion_tokens) || estimateProfileDigestTokenCount(content),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mergeDeepseekDigest(userId: string, context: DigestContext, localDigest: ProfileNoteDigest, json: DeepseekDigestJson): ProfileNoteDigest {
  return {
    userId,
    todayReading: sanitizeDigestText(json.todayReading, localDigest.todayReading, 130),
    learningHighlight: sanitizeDigestText(json.learningHighlight, localDigest.learningHighlight, 130),
    localContribution: sanitizeDigestText(json.localContribution, localDigest.localContribution, 130),
    growthStory: sanitizeDigestText(json.growthStory, localDigest.growthStory, 160),
    contributionStory: sanitizeDigestText(json.contributionStory, localDigest.contributionStory, 160),
    placeChapters: sanitizePlaceChapters(json.placeChapters, localDigest.placeChapters.length > 0 ? localDigest.placeChapters : fallbackPlaceChapters(context.places)),
    sourceStats: localDigest.sourceStats,
    generatedAt: new Date().toISOString(),
    sourceKind: "deepseek",
  };
}

async function saveDigest(
  digest: ProfileNoteDigest,
  metadata: {
    sourceObservationId: string | null;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  },
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into profile_note_digests (
        user_id,
        digest_version,
        today_reading,
        learning_highlight,
        local_contribution,
        growth_story,
        contribution_story,
        place_chapters,
        source_stats,
        source_observation_id,
        source_kind,
        provider,
        model,
        estimated_input_tokens,
        estimated_output_tokens,
        estimated_cost_usd,
        generated_at,
        updated_at
     ) values (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, now(), now()
     )
     on conflict (user_id) do update set
        digest_version = excluded.digest_version,
        today_reading = excluded.today_reading,
        learning_highlight = excluded.learning_highlight,
        local_contribution = excluded.local_contribution,
        growth_story = excluded.growth_story,
        contribution_story = excluded.contribution_story,
        place_chapters = excluded.place_chapters,
        source_stats = excluded.source_stats,
        source_observation_id = excluded.source_observation_id,
        source_kind = excluded.source_kind,
        provider = excluded.provider,
        model = excluded.model,
        estimated_input_tokens = excluded.estimated_input_tokens,
        estimated_output_tokens = excluded.estimated_output_tokens,
        estimated_cost_usd = excluded.estimated_cost_usd,
        generated_at = now(),
        updated_at = now()`,
    [
      digest.userId,
      PROFILE_DIGEST_VERSION,
      digest.todayReading,
      digest.learningHighlight,
      digest.localContribution,
      digest.growthStory,
      digest.contributionStory,
      JSON.stringify(digest.placeChapters),
      JSON.stringify(digest.sourceStats),
      metadata.sourceObservationId,
      digest.sourceKind,
      metadata.provider,
      metadata.model,
      metadata.inputTokens,
      metadata.outputTokens,
      metadata.estimatedCostUsd,
    ],
  );
}

async function recordDigestUsage(userId: string, sourceObservationId: string | null, provider: string, model: string, inputTokens: number, outputTokens: number, estimatedCostUsd: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into profile_note_digest_usage (
        user_id,
        operation,
        provider,
        model,
        input_tokens,
        output_tokens,
        estimated_cost_usd,
        source_observation_id
     ) values ($1, 'profile_note_digest', $2, $3, $4, $5, $6, $7)`,
    [userId, provider, model, inputTokens, outputTokens, estimatedCostUsd, sourceObservationId],
  );
}

export async function refreshProfileNoteDigestForObservation(input: RefreshInput): Promise<{ updated: boolean; sourceKind: string }> {
  try {
    const config = loadConfig();
    const context = await loadDigestContext(input.userId);
    const localDigest = buildLocalDigest(input.userId, context, input.visitId ?? null);
    const localMetadata = {
      sourceObservationId: input.visitId ?? null,
      provider: "local",
      model: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };

    if (config.profileDigest.provider !== "deepseek" || !config.deepseekApiKey) {
      await saveDigest(localDigest, localMetadata);
      return { updated: true, sourceKind: "local" };
    }

    const rawPrompt = buildDigestPrompt(context, localDigest);
    const prompt = clampPromptToTokenBudget(rawPrompt, config.profileDigest.maxInputTokens);
    const estimatedInputTokens = estimateProfileDigestTokenCount(prompt);
    const estimatedMaxCostUsd = estimateProfileDigestCostUsd(estimatedInputTokens, config.profileDigest.maxOutputTokens);
    const usedUsd = await getMonthlyUsageUsd();
    const maxMonthlyUsd = config.profileDigest.monthlyBudgetJpy / config.profileDigest.assumedJpyPerUsd;
    if (usedUsd + estimatedMaxCostUsd > maxMonthlyUsd) {
      await saveDigest(localDigest, localMetadata);
      return { updated: true, sourceKind: "local_budget_guard" };
    }

    try {
      const deepseekResult = await callDeepseekDigest(
        config.deepseekApiKey,
        config.profileDigest.model,
        prompt,
        config.profileDigest.maxOutputTokens,
      );
      const actualCostUsd = estimateProfileDigestCostUsd(deepseekResult.inputTokens, deepseekResult.outputTokens);
      const digest = mergeDeepseekDigest(input.userId, context, localDigest, deepseekResult.json);
      await saveDigest(digest, {
        sourceObservationId: input.visitId ?? null,
        provider: "deepseek",
        model: config.profileDigest.model,
        inputTokens: deepseekResult.inputTokens,
        outputTokens: deepseekResult.outputTokens,
        estimatedCostUsd: actualCostUsd,
      });
      await recordDigestUsage(
        input.userId,
        input.visitId ?? null,
        "deepseek",
        config.profileDigest.model,
        deepseekResult.inputTokens,
        deepseekResult.outputTokens,
        actualCostUsd,
      );
      return { updated: true, sourceKind: "deepseek" };
    } catch {
      await saveDigest(localDigest, localMetadata);
      return { updated: true, sourceKind: "local_deepseek_fallback" };
    }
  } catch {
    return { updated: false, sourceKind: "failed" };
  }
}
