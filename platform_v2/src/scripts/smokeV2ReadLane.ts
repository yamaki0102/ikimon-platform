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
): { name: string; url: string; marker: string; allowedStatuses: number[] } | null {
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
    marker: qa.expectedText.ja,
    allowedStatuses: qa.allowStatus ?? [200],
  };
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
    const coreChecks = [
      {
        name: "record",
        url: `${baseUrl}/record?userId=${encodeURIComponent(userId)}`,
        marker: "Quick capture",
        allowedStatuses: [200],
      },
      {
        name: "explore",
        url: `${baseUrl}/explore`,
        marker: "近くで見つかっているもの",
        allowedStatuses: [200],
      },
      {
        name: "home",
        url: `${baseUrl}/home?userId=${encodeURIComponent(userId)}`,
        marker: "My places",
        allowedStatuses: [200],
      },
      {
        name: "observation detail",
        url: `${baseUrl}/observations/${encodeURIComponent(visitId)}?subject=${encodeURIComponent(occurrenceId)}`,
        marker: "名前と分類",
        allowedStatuses: [200],
      },
      {
        name: "profile",
        url: `${baseUrl}/profile/${encodeURIComponent(userId)}`,
        marker: "最近の My places",
        allowedStatuses: [200],
      },
    ];
    const registryChecks = listVisualQaPages()
      .map((page) => visualQaCheckForPage(baseUrl, page, { userId, visitId, occurrenceId }))
      .filter((check): check is NonNullable<typeof check> => Boolean(check));
    const seenUrls = new Set<string>();
    const checks = [...coreChecks, ...registryChecks].filter((check) => {
      const key = `${check.url}::${check.marker}`;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });

    const results: Array<{ name: string; url: string; ok: boolean; error?: string }> = [];
    let failed = false;

    for (const check of checks) {
      try {
        const { html, status } = await fetchHtml(check.url, check.allowedStatuses);
        if (!html.includes(check.marker)) {
          results.push({ name: check.name, url: check.url, ok: false, error: `marker_missing:${check.marker}` });
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
