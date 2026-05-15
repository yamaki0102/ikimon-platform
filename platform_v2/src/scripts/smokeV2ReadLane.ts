import { getPool } from "../db.js";
import {
  listVisualQaPages,
  materializeSitePagePath,
  sitePageLabel,
  type SitePageDefinition,
} from "../siteMap.js";

type SmokeOptions = {
  baseUrl: string;
};

type HtmlSmokeCheck = {
  name: string;
  url: string;
  markers: string[];
  forbiddenMarkers?: string[];
  allowedStatuses: number[];
};

const defaultRepresentativeSceneReadVisitId = "record-1778549526406";

const representativeSceneReadMarkers = [
  "写っているもの",
  "この組み合わせから読む",
  "同定の根拠",
  "AIが写真から拾った仮説です",
  "ヒメイワダレソウ",
  "セイヨウミツバチ",
  "イネ科の一種",
  "ヒメイワダレソウを支持",
  "証拠不足で保留",
  "別名を提案",
  "別の写り込みを追加",
  "この記録から言えること",
];

const representativeSceneReadForbiddenMarkers = [
  "\"status\":\"bootstrapping\"",
  "1件の見つけたもの",
  "AI 主役 100%",
  "訪花中の候補",
];

function parseArgs(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
    }
  }

  return options;
}

async function fetchHtml(url: string, allowedStatuses = [200]): Promise<{ html: string; status: number }> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
    },
  });

  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return { html: await response.text(), status: response.status };
}

function visualQaCheckForPage(
  baseUrl: string,
  page: SitePageDefinition,
  context: { userId: string; visitId: string; occurrenceId: string },
): HtmlSmokeCheck | null {
  const qa = page.visualQa;
  if (!qa?.smoke) {
    return null;
  }
  const requires = qa.requires ?? "none";
  if ((requires === "user" && !context.userId) || (requires === "occurrence" && !context.occurrenceId)) {
    return null;
  }
  const path = materializeSitePagePath(page, context);
  return {
    name: `visual:${sitePageLabel(page)}`,
    url: `${baseUrl.replace(/\/+$/, "")}${path}${path.includes("?") ? "&" : "?"}lang=ja`,
    markers: [qa.expectedText.ja],
    allowedStatuses: qa.allowStatus ?? [200],
  };
}

function sceneReadSmokeMode(): "auto" | "required" | "skip" {
  const raw = process.env.IKIMON_SCENE_READ_SMOKE?.trim().toLowerCase();
  if (raw === "required" || raw === "skip") {
    return raw;
  }
  return "auto";
}

function markerListFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  return raw
    .split("|")
    .map((marker) => marker.trim())
    .filter(Boolean);
}

function representativeSceneReadTarget(): { visitId: string; subjectId: string; path: string } {
  const visitId = process.env.IKIMON_SCENE_READ_VISIT_ID?.trim() || defaultRepresentativeSceneReadVisitId;
  const subjectId = process.env.IKIMON_SCENE_READ_SUBJECT_ID?.trim() || `occ:${visitId}:0`;
  return {
    visitId,
    subjectId,
    path: `/ja/observations/${encodeURIComponent(visitId)}?subject=${encodeURIComponent(subjectId)}`,
  };
}

async function representativeSceneReadExists(pool: ReturnType<typeof getPool>, visitId: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `select exists (
       select 1
       from occurrences
       where visit_id = $1
       limit 1
     )`,
    [visitId],
  );
  return result.rows[0]?.exists === true;
}

async function representativeSceneReadCheck(
  baseUrl: string,
  pool: ReturnType<typeof getPool>,
): Promise<{ check?: HtmlSmokeCheck; skipped?: { name: string; reason: string } }> {
  const mode = sceneReadSmokeMode();
  if (mode === "skip") {
    return { skipped: { name: "scene:representative-observation-detail", reason: "IKIMON_SCENE_READ_SMOKE=skip" } };
  }

  const target = representativeSceneReadTarget();
  const exists = await representativeSceneReadExists(pool, target.visitId);
  if (!exists && mode === "auto") {
    return { skipped: { name: "scene:representative-observation-detail", reason: "representative scene fixture not present" } };
  }
  if (!exists && mode === "required") {
    throw new Error(`representative scene fixture missing: ${target.visitId}`);
  }

  return {
    check: {
      name: "scene:representative-observation-detail",
      url: `${baseUrl.replace(/\/+$/, "")}${target.path}`,
      markers: markerListFromEnv("IKIMON_SCENE_READ_REQUIRED_MARKERS", representativeSceneReadMarkers),
      forbiddenMarkers: markerListFromEnv("IKIMON_SCENE_READ_FORBIDDEN_MARKERS", representativeSceneReadForbiddenMarkers),
      allowedStatuses: [200],
    },
  };
}

function validateHtmlSmokeCheck(html: string, check: HtmlSmokeCheck): string | null {
  const missingMarkers = check.markers.filter((marker) => !html.includes(marker));
  if (missingMarkers.length > 0) {
    return `marker_missing:${missingMarkers.join("|")}`;
  }

  const presentForbiddenMarkers = (check.forbiddenMarkers ?? []).filter((marker) => html.includes(marker));
  if (presentForbiddenMarkers.length > 0) {
    return `forbidden_marker_present:${presentForbiddenMarkers.join("|")}`;
  }

  return null;
}

function shouldAllowMarkerlessStatus(status: number, check: HtmlSmokeCheck): boolean {
  return status === 404 && check.allowedStatuses.includes(404);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();

  try {
    const latestOccurrence = await pool.query<{ occurrence_id: string; visit_id: string }>(
      `select occurrence_id, visit_id
       from occurrences
       order by created_at desc
       limit 1`,
    );
    const latestUser = await pool.query<{ user_id: string }>(
      `select user_id
       from users
       order by created_at desc
       limit 1`,
    );

    const occurrenceId = latestOccurrence.rows[0]?.occurrence_id ?? "";
    const visitId = latestOccurrence.rows[0]?.visit_id ?? "";
    const userId = latestUser.rows[0]?.user_id ?? "";

    if (!occurrenceId || !visitId || !userId) {
      throw new Error("smoke requires at least one occurrence and one user");
    }

    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    const registryChecks = listVisualQaPages()
      .map((page) => visualQaCheckForPage(baseUrl, page, { userId, visitId, occurrenceId }))
      .filter((check): check is NonNullable<typeof check> => Boolean(check));
    const seenUrls = new Set<string>();
    const checks = registryChecks.filter((check) => {
      const key = `${check.url}::${check.markers.join("|")}`;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });
    const skippedChecks: Array<{ name: string; reason: string }> = [];
    const sceneCheck = await representativeSceneReadCheck(baseUrl, pool);
    if (sceneCheck.check) {
      checks.push(sceneCheck.check);
    }
    if (sceneCheck.skipped) {
      skippedChecks.push(sceneCheck.skipped);
    }

    const results: Array<{ name: string; url: string; ok: boolean; error?: string }> = [];
    let failed = false;

    for (const check of checks) {
      try {
        const { html, status } = await fetchHtml(check.url, check.allowedStatuses);
        if (shouldAllowMarkerlessStatus(status, check)) {
          results.push({ name: check.name, url: check.url, ok: true, error: `status:${status}` });
          continue;
        }
        const validationError = validateHtmlSmokeCheck(html, check);
        if (validationError) {
          results.push({ name: check.name, url: check.url, ok: false, error: `${validationError};status:${status}` });
          failed = true;
          continue;
        }
        results.push({ name: check.name, url: check.url, ok: true, error: status === 200 ? undefined : `status:${status}` });
      } catch (error) {
        results.push({
          name: check.name,
          url: check.url,
          ok: false,
          error: error instanceof Error ? error.message : "unknown_read_smoke_failure",
        });
        failed = true;
      }
    }

    console.log(JSON.stringify({
      baseUrl: options.baseUrl,
      occurrenceId,
      visitId,
      userId,
      checks: results,
      skippedChecks,
      status: failed ? "failed" : "passed",
    }, null, 2));

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

void main();
