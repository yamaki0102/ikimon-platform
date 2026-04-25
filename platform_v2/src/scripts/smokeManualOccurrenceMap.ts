type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  privilegedWriteApiKey: string;
  cleanup: boolean;
};

type SmokeResult = {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
  response?: unknown;
};

type JsonResponse = {
  payload: unknown;
  headers: Headers;
};

type SmokeStep = {
  name: string;
  url: string;
  payload: unknown;
  method?: "GET";
  validate: (payload: unknown) => string | null;
  headers?: () => HeadersInit | undefined;
  afterSuccess?: (response: JsonResponse) => void;
};

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;

  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `manual-occurrence-map-${stamp}`,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY ?? "",
    cleanup: true,
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
      continue;
    }
    if (arg.startsWith("--fixture-prefix=")) {
      options.fixturePrefix = arg.slice("--fixture-prefix=".length).trim() || options.fixturePrefix;
      continue;
    }
    if (arg.startsWith("--privileged-write-api-key=")) {
      options.privilegedWriteApiKey =
        arg.slice("--privileged-write-api-key=".length).trim() || options.privilegedWriteApiKey;
      continue;
    }
    if (arg === "--no-cleanup") {
      options.cleanup = false;
    }
  }

  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson(url: string, init: RequestInit): Promise<JsonResponse> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const parsed = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${JSON.stringify(parsed)}`);
  }

  return {
    payload: parsed,
    headers: response.headers,
  };
}

async function postJson(url: string, payload: unknown, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

async function getJson(url: string, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, {
    method: "GET",
    headers,
  });
}

function privilegedHeaders(options: SmokeOptions): HeadersInit | undefined {
  if (!options.privilegedWriteApiKey) {
    return undefined;
  }
  return { "x-ikimon-write-key": options.privilegedWriteApiKey };
}

function validateUserResponse(payload: unknown, expectedUserId: string): string | null {
  if (!isRecord(payload) || payload.userId !== expectedUserId) {
    return "user upsert did not return expected userId";
  }
  if (!isRecord(payload.compatibility) || typeof payload.compatibility.attempted !== "boolean") {
    return "user upsert compatibility payload missing";
  }
  return null;
}

function validateSessionResponse(payload: unknown, expectedUserId: string): string | null {
  if (!isRecord(payload) || payload.ok !== true) {
    return "session response missing ok=true";
  }
  if (!isRecord(payload.session) || payload.session.userId !== expectedUserId) {
    return "session response missing expected user";
  }
  return null;
}

function validateObservationResponse(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return "observation response is not an object";
  }
  if (typeof payload.visitId !== "string" || typeof payload.occurrenceId !== "string" || typeof payload.placeId !== "string") {
    return "observation response missing ids";
  }
  if (!isRecord(payload.compatibility) || typeof payload.compatibility.attempted !== "boolean") {
    return "observation response missing compatibility";
  }
  return null;
}

function validateMapCells(payload: unknown): string | null {
  if (!isRecord(payload) || payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    return "map cells payload missing feature collection";
  }

  if (!payload.features.length) {
    return "map cells payload returned no cells";
  }

  const first = payload.features[0];
  if (!isRecord(first) || !isRecord(first.geometry) || first.geometry.type !== "Polygon") {
    return "map cells payload should expose polygon cells";
  }
  if (!isRecord(first.properties) || typeof first.properties.cellId !== "string") {
    return "map cells payload missing cellId";
  }
  if (typeof first.properties.label !== "string" || typeof first.properties.gridM !== "number") {
    return "map cells payload missing privacy props";
  }

  return null;
}

function validateMapContainsVisit(
  payload: unknown,
  expectedOccurrenceId: string,
  expectedVisitId: string,
): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return "map observations payload missing items";
  }

  const hit = payload.items.some((item) => {
    if (!isRecord(item)) {
      return false;
    }
    return item.occurrenceId === expectedOccurrenceId || item.visitId === expectedVisitId;
  });

  if (!hit) {
    return `map observations missing visit ${expectedVisitId}`;
  }

  const leaked = payload.items.some((item) => {
    if (!isRecord(item)) return false;
    return "lat" in item || "lng" in item || "placeName" in item || "siteName" in item;
  });
  if (leaked) {
    return "map observations leaked exact or site-level location fields";
  }

  return null;
}

function withSessionCookie(cookie: string): Record<string, string> | undefined {
  return cookie ? { cookie } : undefined;
}

function validateCleanupResponse(payload: unknown): string | null {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.cleanup)) {
    return "cleanup response missing cleanup summary";
  }
  return null;
}

function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const userId = `${options.fixturePrefix}-user`;
  const observationId = `${options.fixturePrefix}-note-only`;
  const nowIso = new Date().toISOString();
  const latitude = 34.7116;
  const longitude = 137.7274;

  const userPayload = {
    userId,
    displayName: "Manual Occurrence Smoke",
    email: `${userId}@example.invalid`,
    roleName: "Observer",
    rankLabel: "観察者",
    authProvider: "smoke",
    banned: false,
  };

  const observationPayload = {
    observationId,
    legacyObservationId: observationId,
    userId,
    observedAt: nowIso,
    latitude,
    longitude,
    prefecture: "Shizuoka",
    municipality: "Hamamatsu",
    localityNote: "Manual occurrence smoke note-only",
    note: "manual occurrence smoke note-only observation",
    siteId: "manual-occurrence-smoke-site",
    siteName: "Manual Occurrence Smoke Site",
    dataQuality: "smoke",
    qualityGrade: "casual",
    evidenceTags: ["smoke", "note-only"],
    substrateTags: ["test"],
    taxon: null,
    sourcePayload: {
      source: "smoke_manual_occurrence_map",
      scenario: "note_only",
    },
  };

  const mapCellsUrl = `${baseUrl}/api/v1/map/cells?bbox=${[
    longitude - 0.01,
    latitude - 0.01,
    longitude + 0.01,
    latitude + 0.01,
  ].join(",")}&zoom=13&marker_profile=manual_only`;

  const mapUrl = `${baseUrl}/api/v1/map/observations?bbox=${[
    longitude - 0.01,
    latitude - 0.01,
    longitude + 0.01,
    latitude + 0.01,
  ].join(",")}&zoom=13&limit=50&marker_profile=manual_only`;

  const checks: SmokeResult[] = [];
  let failed = false;
  let sessionCookie = "";
  let occurrenceId = "";
  let visitId = "";

  const steps: SmokeStep[] = [
    {
      name: "users/upsert",
      url: `${baseUrl}/api/v1/users/upsert`,
      payload: userPayload,
      validate: (payload: unknown) => validateUserResponse(payload, userId),
      headers: () => privilegedHeaders(options),
    },
    {
      name: "auth/session/issue",
      url: `${baseUrl}/api/v1/auth/session/issue`,
      payload: {
        userId,
        ttlHours: 24,
      },
      validate: (payload: unknown) => validateSessionResponse(payload, userId),
      headers: () => privilegedHeaders(options),
      afterSuccess: (response: JsonResponse) => {
        const rawCookie = response.headers.get("set-cookie") ?? "";
        sessionCookie = rawCookie.split(";")[0] ?? "";
      },
    },
    {
      name: "observations/upsert note-only",
      url: `${baseUrl}/api/v1/observations/upsert`,
      payload: observationPayload,
      validate: validateObservationResponse,
      headers: () => withSessionCookie(sessionCookie),
      afterSuccess: (response: JsonResponse) => {
        if (!isRecord(response.payload)) {
          return;
        }
        occurrenceId = typeof response.payload.occurrenceId === "string" ? response.payload.occurrenceId : "";
        visitId = typeof response.payload.visitId === "string" ? response.payload.visitId : "";
      },
    },
    {
      name: "map/cells note-only",
      url: mapCellsUrl,
      method: "GET" as const,
      payload: null,
      validate: validateMapCells,
    },
    {
      name: "map/observations note-only",
      url: mapUrl,
      method: "GET" as const,
      payload: null,
      validate: (payload: unknown) => validateMapContainsVisit(payload, occurrenceId, visitId),
    },
  ];

  for (const step of steps) {
    try {
      const response =
        step.method === "GET"
          ? await getJson(step.url, step.headers ? step.headers() : undefined)
          : await postJson(step.url, step.payload, step.headers ? step.headers() : undefined);
      const validationError = step.validate(response.payload);
      if (validationError) {
        checks.push({
          name: step.name,
          url: step.url,
          ok: false,
          error: validationError,
          response: response.payload,
        });
        failed = true;
        continue;
      }
      if (typeof step.afterSuccess === "function") {
        step.afterSuccess(response);
      }
      checks.push({
        name: step.name,
        url: step.url,
        ok: true,
        response: response.payload,
      });
    } catch (error) {
      checks.push({
        name: step.name,
        url: step.url,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_manual_occurrence_map_failure",
      });
      failed = true;
    }
  }

  if (options.cleanup) {
    const cleanupUrl = `${baseUrl}/api/v1/ops/staging/fixtures/cleanup`;
    try {
      const cleanupResponse = await postJson(
        cleanupUrl,
        {
          fixturePrefix: options.fixturePrefix,
          dryRun: false,
        },
        privilegedHeaders(options),
      );
      const cleanupError = validateCleanupResponse(cleanupResponse.payload);
      if (cleanupError) {
        checks.push({
          name: "fixtures/cleanup",
          url: cleanupUrl,
          ok: false,
          error: cleanupError,
          response: cleanupResponse.payload,
        });
        failed = true;
      } else {
        checks.push({
          name: "fixtures/cleanup",
          url: cleanupUrl,
          ok: true,
          response: cleanupResponse.payload,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_fixture_cleanup_failure";
      const cleanupDisabled = message.includes("staging_fixture_cleanup_disabled");
      if (cleanupDisabled && isLocalBaseUrl(baseUrl)) {
        checks.push({
          name: "fixtures/cleanup",
          url: cleanupUrl,
          ok: true,
          error: "cleanup_skipped_local_env",
        });
      } else {
        checks.push({
          name: "fixtures/cleanup",
          url: cleanupUrl,
          ok: false,
          error: message,
        });
        failed = true;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        fixturePrefix: options.fixturePrefix,
        checks,
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
