type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  privilegedWriteApiKey: string;
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

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;

  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `smoke-${stamp}`,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY ?? "",
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

function validatePhotoUploadResponse(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return "photo upload response is not an object";
  }
  if (typeof payload.visitId !== "string" || typeof payload.occurrenceId !== "string") {
    return "photo upload response missing ids";
  }
  if (typeof payload.relativePath !== "string" || typeof payload.publicUrl !== "string") {
    return "photo upload response missing paths";
  }
  if (!isRecord(payload.compatibility) || typeof payload.compatibility.attempted !== "boolean") {
    return "photo upload response missing compatibility";
  }
  return null;
}

function validateTrackResponse(payload: unknown, expectedPointCount: number): string | null {
  if (!isRecord(payload)) {
    return "track response is not an object";
  }
  if (typeof payload.visitId !== "string" || typeof payload.placeId !== "string") {
    return "track response missing ids";
  }
  if (payload.pointCount !== expectedPointCount) {
    return "track response pointCount mismatch";
  }
  if (!isRecord(payload.compatibility) || typeof payload.compatibility.attempted !== "boolean") {
    return "track response missing compatibility";
  }
  return null;
}

function validateRememberTokenResponse(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.tokenHash !== "string") {
    return "remember token response missing tokenHash";
  }
  if (!isRecord(payload.compatibility) || typeof payload.compatibility.attempted !== "boolean") {
    return "remember token response missing compatibility";
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

function withSessionCookie(cookie: string): Record<string, string> | undefined {
  return cookie ? { cookie } : undefined;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const userId = `${options.fixturePrefix}-user`;
  const observationId = `${options.fixturePrefix}-obs`;
  const sessionId = `${options.fixturePrefix}-track`;
  const nowIso = new Date().toISOString();
  const rawToken = `${options.fixturePrefix}-remember-token`;
  const tinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK8QAAAAASUVORK5CYII=";

  const userPayload = {
    userId,
    displayName: "Write Lane Smoke",
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
    latitude: 34.7108,
    longitude: 137.7261,
    prefecture: "Shizuoka",
    municipality: "Hamamatsu",
    localityNote: "Staging write-lane smoke",
    note: "write lane smoke observation",
    siteId: "smoke-site",
    siteName: "Staging Smoke Site",
    dataQuality: "smoke",
    qualityGrade: "casual",
    evidenceTags: ["smoke"],
    substrateTags: ["test"],
    taxon: {
      scientificName: "Passer montanus",
      vernacularName: "Tree Sparrow",
      rank: "species",
    },
    sourcePayload: {
      source: "smoke_v2_write_lane",
    },
  };

  const trackPayload = {
    sessionId,
    userId,
    startedAt: nowIso,
    updatedAt: nowIso,
    municipality: "Hamamatsu",
    prefecture: "Shizuoka",
    distanceMeters: 125,
    stepCount: 180,
    points: [
      {
        latitude: 34.7108,
        longitude: 137.7261,
        accuracyMeters: 5,
        timestamp: nowIso,
      },
      {
        latitude: 34.711,
        longitude: 137.7264,
        accuracyMeters: 6,
        timestamp: new Date(Date.now() + 30_000).toISOString(),
      },
    ],
    sourcePayload: {
      source: "smoke_v2_write_lane",
    },
  };

  const checks: SmokeResult[] = [];
  let failed = false;
  let sessionCookie = "";

  const steps = [
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
      name: "auth/session/current",
      url: `${baseUrl}/api/v1/auth/session`,
      method: "GET",
      payload: null,
      validate: (payload: unknown) => validateSessionResponse(payload, userId),
      headers: () => withSessionCookie(sessionCookie),
    },
    {
      name: "auth/remember-tokens/issue",
      url: `${baseUrl}/api/v1/auth/remember-tokens/issue`,
      payload: {
        userId,
        rawToken,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        ipAddress: "127.0.0.1",
        userAgent: "smoke-v2-write-lane",
      },
      validate: validateRememberTokenResponse,
      headers: () => privilegedHeaders(options),
    },
    {
      name: "observations/upsert",
      url: `${baseUrl}/api/v1/observations/upsert`,
      payload: observationPayload,
      validate: validateObservationResponse,
      headers: () => withSessionCookie(sessionCookie),
    },
    {
      name: "observations/photos/upload",
      url: `${baseUrl}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`,
      payload: {
        filename: "smoke-upload.png",
        mimeType: "image/png",
        base64Data: tinyPngBase64,
      },
      validate: validatePhotoUploadResponse,
      headers: () => withSessionCookie(sessionCookie),
    },
    {
      name: "tracks/upsert",
      url: `${baseUrl}/api/v1/tracks/upsert`,
      payload: trackPayload,
      validate: (payload: unknown) => validateTrackResponse(payload, trackPayload.points.length),
      headers: () => withSessionCookie(sessionCookie),
    },
    {
      name: "auth/session/logout",
      url: `${baseUrl}/api/v1/auth/session/logout`,
      payload: {},
      validate: (payload: unknown) => {
        if (!isRecord(payload) || payload.revoked !== true) {
          return "session logout did not revoke token";
        }
        return null;
      },
      headers: () => withSessionCookie(sessionCookie),
      afterSuccess: () => {
        sessionCookie = "";
      },
    },
    {
      name: "auth/remember-tokens/revoke",
      url: `${baseUrl}/api/v1/auth/remember-tokens/revoke`,
      payload: {
        token: rawToken,
      },
      validate: validateRememberTokenResponse,
      headers: () => privilegedHeaders(options),
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
        error: error instanceof Error ? error.message : "unknown_write_lane_failure",
      });
      failed = true;
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
