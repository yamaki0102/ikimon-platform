import { generateCuratorJsonWithRetry } from "../services/curatorGeminiWorker.js";
import { dedupeInvasiveRows, validateInvasiveLawRows } from "../services/curatorTrustBoundary.js";

const SOURCE_URL = "https://www.env.go.jp/nature/intro/2outline/list.html";

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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const maxChars = parsePositiveInt(process.env.CURATOR_SMOKE_MAX_CHARS, 30_000);
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "ikimon-curator-smoke/1.0 (+https://ikimon.life)" },
  });
  if (!response.ok) {
    throw new Error(`source_fetch_failed:${response.status}`);
  }
  const text = await response.text();
  const result = await generateCuratorJsonWithRetry<{
    rows?: unknown[];
  }>({
    provider: "gemini",
    model: "gemini-3.1-flash-lite-preview",
    curatorName: "invasive-law-smoke",
    runId: null,
    systemPrompt: SYSTEM_PROMPT,
    userText: [
      `source_url: ${SOURCE_URL}`,
      `smoke_max_chars: ${maxChars}`,
      "Extract only rows visible in this source chunk.",
      "",
      text.slice(0, maxChars),
    ].join("\n"),
    responseJsonSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
  }, 3);

  const validation = validateInvasiveLawRows(Array.isArray(result.parsed.rows) ? result.parsed.rows : []);
  const deduped = dedupeInvasiveRows(validation.accepted);
  const dropReasons = validation.dropped.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});
  const output = {
    ok: deduped.length > 0,
    source_url: SOURCE_URL,
    model: result.model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    cost_usd: result.costUsd,
    extracted_rows: Array.isArray(result.parsed.rows) ? result.parsed.rows.length : 0,
    accepted_rows: validation.accepted.length,
    dropped_rows: validation.dropped.length,
    deduped_rows: deduped.length,
    drop_reasons: dropReasons,
    dropped_sample: validation.dropped.slice(0, 5).map((item) => ({
      index: item.index,
      reason: item.reason,
      row: Array.isArray(result.parsed.rows) ? result.parsed.rows[item.index] : null,
    })),
    sample: deduped.slice(0, 5),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-REDACTED") : String(error));
  process.exit(1);
});
