import { getPool } from "../db.js";

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

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const pool = getPool();

  try {
    const latestOccurrence = await pool.query<{ occurrence_id: string }>(
      `select occurrence_id
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
    const userId = latestUser.rows[0]?.user_id ?? "";

    if (!occurrenceId || !userId) {
      throw new Error("smoke requires at least one occurrence and one user");
    }

    const checks = [
      {
        name: "record",
        url: `${options.baseUrl.replace(/\/+$/, "")}/record?userId=${encodeURIComponent(userId)}`,
        marker: "Record minimal shell",
      },
      {
        name: "explore",
        url: `${options.baseUrl.replace(/\/+$/, "")}/explore`,
        marker: "Explore minimal shell",
      },
      {
        name: "home",
        url: `${options.baseUrl.replace(/\/+$/, "")}/home?userId=${encodeURIComponent(userId)}`,
        marker: "Minimum home shell for cutover",
      },
      {
        name: "observation detail",
        url: `${options.baseUrl.replace(/\/+$/, "")}/observations/${encodeURIComponent(occurrenceId)}`,
        marker: "Observation detail",
      },
      {
        name: "profile",
        url: `${options.baseUrl.replace(/\/+$/, "")}/profile/${encodeURIComponent(userId)}`,
        marker: "Profile / My places",
      },
    ];

    const results: Array<{ name: string; url: string; ok: boolean; error?: string }> = [];
    let failed = false;

    for (const check of checks) {
      try {
        const html = await fetchHtml(check.url);
        if (!html.includes(check.marker)) {
          results.push({ name: check.name, url: check.url, ok: false, error: `marker_missing:${check.marker}` });
          failed = true;
          continue;
        }
        results.push({ name: check.name, url: check.url, ok: true });
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
