import { getPool } from "../../../db.js";
import { CURATOR_DEEPSEEK_MODEL, CURATOR_DEFAULT_MODEL } from "../../../services/aiModelPricing.js";
import { generateCuratorJsonWithRetry, postCuratorReceiver, type CuratorModelProvider } from "../../../services/curatorGeminiWorker.js";
import { buildInvasiveLawMigrationSql } from "../../../services/curatorSqlBuilder.js";
import { chunkText, fetchSourceSnapshot, type CuratorSourceSnapshot } from "../../../services/curatorSourceSnapshot.js";
import {
  assertNoSecretLeak,
  dedupeInvasiveRows,
  validateInvasiveLawRows,
  type InvasiveLawParsedRow,
} from "../../../services/curatorTrustBoundary.js";
import type { CuratorWorkflowContext, CuratorWorkflowResult } from "./types.js";

type GeminiInvasiveResponse = {
  rows?: Array<{
    scientific_name?: string;
    vernacular_jp?: string;
    mhlw_category?: string;
    source_excerpt?: string;
  }>;
};

const SOURCE_URL = "https://www.env.go.jp/nature/intro/2outline/list.html";
const JPY_PER_USD = 150;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scientific_name: { type: "string" },
          vernacular_jp: { type: "string" },
          mhlw_category: {
            type: "string",
            enum: ["iaspecified", "priority", "industrial", "prevention"],
          },
          source_excerpt: { type: "string" },
        },
        required: ["scientific_name", "mhlw_category", "source_excerpt"],
      },
    },
  },
  required: ["rows"],
};

const SYSTEM_PROMPT = [
  "You extract invasive species rows from the official Japanese Ministry of the Environment invasive species list.",
  "Return JSON only: { rows: [{ scientific_name, vernacular_jp, mhlw_category, source_excerpt }] }.",
  "Use only these mhlw_category values: iaspecified, priority, industrial, prevention.",
  "source_excerpt must be a short verbatim span from the source and must be <= 600 characters.",
  "Do not infer species that are not present in the source chunk.",
].join("\n");

function readProvider(): CuratorModelProvider {
  const raw = process.env.CURATOR_LLM_PROVIDER?.trim().toLowerCase();
  return raw === "deepseek" ? "deepseek" : "gemini";
}

function modelForProvider(provider: CuratorModelProvider): string {
  const envModel = process.env.CURATOR_LLM_MODEL?.trim();
  if (envModel) return envModel;
  return provider === "deepseek" ? CURATOR_DEEPSEEK_MODEL : CURATOR_DEFAULT_MODEL;
}

async function sourceAlreadySeen(snapshot: CuratorSourceSnapshot): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM source_snapshots
        WHERE source_kind = $1
          AND content_sha256 = $2
     ) AS exists`,
    [snapshot.sourceKind, snapshot.contentSha256],
  );
  return result.rows[0]?.exists === true;
}

function validationOnlyResult(input: {
  status: CuratorWorkflowResult["status"];
  reason: string;
  costUsd: number;
  provider: CuratorModelProvider;
  model: string;
  modelCallCount: number;
  geminiCallCount: number;
  chunkCount: number;
  rowsProposed: number;
  rowsDroppedValidation: number;
}): CuratorWorkflowResult {
  return {
    status: input.status,
    prUrl: null,
    error: input.reason,
    costUsd: input.costUsd,
    costJpy: Number((input.costUsd * JPY_PER_USD).toFixed(4)),
    cmaSessionId: null,
    curatorModelProvider: input.provider,
    curatorModelName: input.model,
    curatorModelCallCount: input.modelCallCount,
    geminiCallCount: input.geminiCallCount,
    geminiSkipReason: input.reason,
    chunkCount: input.chunkCount,
    rowsProposed: input.rowsProposed,
    rowsDroppedValidation: input.rowsDroppedValidation,
  };
}

export async function runInvasiveLawCurator(ctx: CuratorWorkflowContext): Promise<CuratorWorkflowResult> {
  const provider = readProvider();
  const model = modelForProvider(provider);
  const snapshot = await fetchSourceSnapshot({
    url: SOURCE_URL,
    sourceKind: "env_invasive_jp",
    license: "gov-jp-open",
  }).catch((error) => {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`source_fetch_failed:${detail}`);
  });

  if (await sourceAlreadySeen(snapshot)) {
    return validationOnlyResult({
      status: "cancelled",
      reason: "source_unchanged",
      costUsd: 0,
      provider,
      model,
      modelCallCount: 0,
      geminiCallCount: 0,
      chunkCount: 0,
      rowsProposed: 0,
      rowsDroppedValidation: 0,
    });
  }

  const chunks = chunkText(snapshot.text, 30_000);
  const acceptedRows: InvasiveLawParsedRow[] = [];
  let rowsDroppedValidation = 0;
  let costUsd = 0;
  let modelCallCount = 0;
  let geminiCallCount = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] ?? "";
    if (chunk.trim().length < 1000) {
      continue;
    }
    const result = await generateCuratorJsonWithRetry<GeminiInvasiveResponse>({
      provider,
      model,
      curatorName: ctx.curator,
      runId: ctx.runId,
      systemPrompt: SYSTEM_PROMPT,
      userText: [
        `chunk_index: ${index + 1}/${chunks.length}`,
        `source_url: ${SOURCE_URL}`,
        "Extract only rows visible in this chunk.",
        "",
        chunk,
      ].join("\n"),
      responseJsonSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
    }, 3);
    modelCallCount += 1;
    if (result.provider === "gemini") geminiCallCount += 1;
    costUsd += result.costUsd;
    const validation = validateInvasiveLawRows(Array.isArray(result.parsed.rows) ? result.parsed.rows : []);
    acceptedRows.push(...validation.accepted);
    rowsDroppedValidation += validation.dropped.length;
  }

  const rows = dedupeInvasiveRows(acceptedRows);
  if (rows.length === 0) {
    return validationOnlyResult({
      status: "failed",
      reason: modelCallCount === 0 ? "all_chunks_under_1k_chars" : "schema_validation_failed_all_chunks",
      costUsd,
      provider,
      model,
      modelCallCount,
      geminiCallCount,
      chunkCount: chunks.length,
      rowsProposed: 0,
      rowsDroppedValidation,
    });
  }

  const sqlContent = buildInvasiveLawMigrationSql({ runId: ctx.runId, snapshot, rows });
  const payload = {
    run_id: ctx.runId,
    curator_name: ctx.curator,
    proposal_kind: "migration_sql",
    title: `MHLW invasive list snapshot ${new Date().toISOString().slice(0, 10)}`,
    summary: `Snapshot-backed proposal with ${rows.length} candidate invasive species rows from the official Ministry of the Environment list.`,
    sql_content: sqlContent,
    rationale: `Scheduled invasive-law curator run. Source: ${SOURCE_URL}`,
    curator_model_provider: provider,
    curator_model_name: model,
    curator_model_call_count: modelCallCount,
    gemini_call_count: geminiCallCount,
    gemini_skip_reason: "none",
    chunk_count: chunks.length,
    rows_proposed: rows.length,
    rows_dropped_validation: rowsDroppedValidation,
  };
  assertNoSecretLeak(JSON.stringify(payload), [
    process.env.GEMINI_API_KEY,
    process.env.DEEPSEEK_API_KEY,
    ctx.receiver?.secret,
  ]);

  if (!ctx.receiver) {
    return validationOnlyResult({
      status: "partial",
      reason: "receiver_not_configured",
      costUsd,
      provider,
      model,
      modelCallCount,
      geminiCallCount,
      chunkCount: chunks.length,
      rowsProposed: rows.length,
      rowsDroppedValidation,
    });
  }

  const receiver = await postCuratorReceiver({
    payload,
    receiverUrl: ctx.receiver.url,
    receiverSecret: ctx.receiver.secret,
  });

  return {
    status: "success",
    prUrl: receiver.prUrl,
    error: null,
    costUsd,
    costJpy: Number((costUsd * JPY_PER_USD).toFixed(4)),
    cmaSessionId: null,
    curatorModelProvider: provider,
    curatorModelName: model,
    curatorModelCallCount: modelCallCount,
    geminiCallCount,
    geminiSkipReason: "none",
    chunkCount: chunks.length,
    rowsProposed: rows.length,
    rowsDroppedValidation,
  };
}
