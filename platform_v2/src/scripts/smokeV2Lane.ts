type SmokeOptions = {
  baseUrl: string;
};

type SmokeCheck = {
  name: string;
  path: string;
  accept?: string;
  parse: "json" | "text";
  validate: (payload: unknown) => string | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

async function fetchText(url: string, accept = "text/html"): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const checks: SmokeCheck[] = [
    {
      name: "root",
      path: "/",
      accept: "*/*",
      parse: "text",
      validate: (payload) => {
        if (typeof payload !== "string") {
          return "root did not return HTML";
        }
        const normalized = payload.toLowerCase();
        if (!normalized.includes("<!doctype html") || !normalized.includes("ikimon.life")) {
          return "root landing HTML marker mismatch";
        }
        if (payload.includes('"status":"bootstrapping"')) {
          return "root returned bootstrapping JSON";
        }
        return null;
      },
    },
    {
      name: "healthz",
      path: "/healthz",
      parse: "json",
      validate: (payload) => {
        if (!isRecord(payload) || payload.ok !== true) {
          return "healthz is not ok";
        }
        return null;
      },
    },
    {
      name: "readyz",
      path: "/readyz",
      parse: "json",
      validate: (payload) => {
        if (!isRecord(payload) || payload.ok !== true || typeof payload.now !== "string") {
          return "readyz did not confirm database readiness";
        }
        return null;
      },
    },
    {
      name: "ops/readiness",
      path: "/ops/readiness",
      parse: "json",
      validate: (payload) => {
        if (!isRecord(payload) || typeof payload.status !== "string") {
          return "ops/readiness missing status";
        }
        const gates = payload.gates;
        if (!isRecord(gates) || gates.parityVerified !== true || gates.deltaSyncHealthy !== true) {
          return "ops/readiness gates are not healthy enough";
        }
        return null;
      },
    },
  ];

  const results: Array<{ name: string; url: string; ok: boolean; error?: string }> = [];
  let failed = false;

  for (const check of checks) {
    const url = `${options.baseUrl.replace(/\/+$/, "")}${check.path}`;
    try {
      const payload = check.parse === "json" ? await fetchJson(url) : await fetchText(url, check.accept);
      const validationError = check.validate(payload);
      if (validationError) {
        results.push({ name: check.name, url, ok: false, error: validationError });
        failed = true;
        continue;
      }
      results.push({ name: check.name, url, ok: true });
    } catch (error) {
      results.push({
        name: check.name,
        url,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_smoke_failure",
      });
      failed = true;
    }
  }

  console.log(
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        checks: results,
        status: failed ? "failed" : "passed",
      },
      null,
      2,
    ),
  );

  if (failed) {
    process.exitCode = 1;
  }
}

void main();
