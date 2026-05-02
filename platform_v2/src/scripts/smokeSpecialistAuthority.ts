type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  privilegedWriteApiKey: string;
};

type StepResult = {
  name: string;
  ok: boolean;
  status?: number;
  error?: string;
  response?: unknown;
};

type FetchResult = {
  status: number;
  ok: boolean;
  payload: unknown;
  headers: Headers;
};

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;

  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `authority-${stamp}`,
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

function privilegedHeaders(options: SmokeOptions): HeadersInit {
  return { "x-ikimon-write-key": options.privilegedWriteApiKey };
}

function withCookie(cookie: string): HeadersInit | undefined {
  return cookie ? { cookie } : undefined;
}

async function requestJson(url: string, init: RequestInit): Promise<FetchResult> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
    headers: response.headers,
  };
}

async function requestText(url: string, headers?: HeadersInit): Promise<{ status: number; ok: boolean; body: string }> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "text/html,application/xhtml+xml",
      ...(headers ?? {}),
    },
  });

  return {
    status: response.status,
    ok: response.ok,
    body: await response.text(),
  };
}

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function extractSessionCookie(headers: Headers): string {
  const rawCookie = headers.get("set-cookie") ?? "";
  return rawCookie.split(";")[0] ?? "";
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.privilegedWriteApiKey) {
    throw new Error("V2_PRIVILEGED_WRITE_API_KEY is required");
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const adminUserId = `${options.fixturePrefix}-admin`;
  const reviewerUserId = `${options.fixturePrefix}-reviewer`;
  const ownerUserId = `${options.fixturePrefix}-owner`;
  const observationId = `${options.fixturePrefix}-obs`;
  const observedAt = new Date().toISOString();
  const scopeTaxonName = "Taraxacum";
  const matchingTaxon = "Taraxacum officinale";
  const nonMatchingTaxon = "Bellis perennis";

  let adminCookie = "";
  let reviewerCookie = "";
  let ownerCookie = "";
  let occurrenceId = "";
  let grantedAuthorityId = "";

  const steps: StepResult[] = [];

  async function run(name: string, task: () => Promise<unknown>): Promise<void> {
    try {
      const response = await task();
      steps.push({
        name,
        ok: true,
        response,
      });
    } catch (error) {
      steps.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : "unknown_smoke_failure",
      });
      throw error;
    }
  }

  await run("users/upsert admin", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/users/upsert`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: adminUserId,
        displayName: "Authority Admin",
        email: `${adminUserId}@example.invalid`,
        roleName: "Analyst",
        rankLabel: "分析担当",
        authProvider: "smoke",
        banned: false,
      }),
    });
    expect(result.ok, `admin upsert failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.userId === adminUserId, "admin upsert returned unexpected payload");
    return result.payload;
  });

  await run("users/upsert reviewer", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/users/upsert`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: reviewerUserId,
        displayName: "Authority Reviewer",
        email: `${reviewerUserId}@example.invalid`,
        roleName: "Observer",
        rankLabel: "観察者",
        authProvider: "smoke",
        banned: false,
      }),
    });
    expect(result.ok, `reviewer upsert failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.userId === reviewerUserId, "reviewer upsert returned unexpected payload");
    return result.payload;
  });

  await run("users/upsert owner", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/users/upsert`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: ownerUserId,
        displayName: "Authority Owner",
        email: `${ownerUserId}@example.invalid`,
        roleName: "Observer",
        rankLabel: "観察者",
        authProvider: "smoke",
        banned: false,
      }),
    });
    expect(result.ok, `owner upsert failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.userId === ownerUserId, "owner upsert returned unexpected payload");
    return result.payload;
  });

  await run("auth/session/issue admin", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/auth/session/issue`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: adminUserId,
        ttlHours: 24,
      }),
    });
    expect(result.ok, `admin session issue failed: ${JSON.stringify(result.payload)}`);
    adminCookie = extractSessionCookie(result.headers);
    expect(Boolean(adminCookie), "admin session cookie missing");
    return result.payload;
  });

  await run("auth/session/issue reviewer", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/auth/session/issue`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: reviewerUserId,
        ttlHours: 24,
      }),
    });
    expect(result.ok, `reviewer session issue failed: ${JSON.stringify(result.payload)}`);
    reviewerCookie = extractSessionCookie(result.headers);
    expect(Boolean(reviewerCookie), "reviewer session cookie missing");
    return result.payload;
  });

  await run("auth/session/issue owner", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/auth/session/issue`, {
      method: "POST",
      headers: privilegedHeaders(options),
      body: JSON.stringify({
        userId: ownerUserId,
        ttlHours: 24,
      }),
    });
    expect(result.ok, `owner session issue failed: ${JSON.stringify(result.payload)}`);
    ownerCookie = extractSessionCookie(result.headers);
    expect(Boolean(ownerCookie), "owner session cookie missing");
    return result.payload;
  });

  await run("specialist/id-workbench denied before grant", async () => {
    const result = await requestText(`${baseUrl}/specialist/id-workbench?lane=expert-lane`, withCookie(reviewerCookie));
    expect(result.status === 403, `expected 403 before grant, got ${result.status}`);
    return { status: result.status };
  });

  await run("observations/upsert", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/observations/upsert`, {
      method: "POST",
      headers: withCookie(ownerCookie),
      body: JSON.stringify({
        observationId,
        legacyObservationId: observationId,
        userId: ownerUserId,
        observedAt,
        latitude: 34.7108,
        longitude: 137.7261,
        prefecture: "Shizuoka",
        municipality: "Hamamatsu",
        localityNote: "specialist authority smoke",
        note: "specialist authority smoke observation",
        taxon: {
          scientificName: matchingTaxon,
          vernacularName: "セイヨウタンポポ",
          rank: "species",
        },
        sourcePayload: {
          source: "smoke_specialist_authority",
        },
      }),
    });
    expect(result.ok, `observation upsert failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && typeof result.payload.occurrenceId === "string", "observation payload missing occurrenceId");
    occurrenceId = String((result.payload as Record<string, unknown>).occurrenceId);
    return result.payload;
  });

  await run("specialist/authorities/grant", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/authorities/grant`, {
      method: "POST",
      headers: withCookie(adminCookie),
      body: JSON.stringify({
        subjectUserId: reviewerUserId,
        scopeTaxonName,
        scopeTaxonRank: "genus",
        reason: "smoke grant",
        evidence: [
          {
            evidenceType: "field_event",
            title: "Taraxacum field workshop",
            issuerName: "Smoke Test Society",
            notes: "seed grant for smoke test",
          },
        ],
      }),
    });
    expect(result.ok, `authority grant failed: ${JSON.stringify(result.payload)}`);
    expect(
      isRecord(result.payload)
      && isRecord(result.payload.authority)
      && typeof result.payload.authority.authorityId === "string",
      "authority grant payload missing authorityId",
    );
    const authorityPayload = isRecord(result.payload) && isRecord(result.payload.authority)
      ? result.payload.authority
      : null;
    grantedAuthorityId = authorityPayload ? String(authorityPayload.authorityId) : "";
    return result.payload;
  });

  await run("specialist/me/authorities after grant", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/me/authorities`, {
      method: "GET",
      headers: withCookie(reviewerCookie),
    });
    expect(result.ok, `authority self lookup failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.hasSpecialistAccess === true, "reviewer should have specialist access after grant");
    const authorities = isRecord(result.payload) && Array.isArray(result.payload.authorities)
      ? result.payload.authorities
      : [];
    expect(authorities.length > 0, "reviewer authority list should not be empty after grant");
    return result.payload;
  });

  await run("specialist/id-workbench allowed after grant", async () => {
    const result = await requestText(`${baseUrl}/specialist/id-workbench?lane=expert-lane`, withCookie(reviewerCookie));
    expect(result.status === 200, `expected 200 after grant, got ${result.status}`);
    return { status: result.status };
  });

  await run("specialist review approve matching", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/occurrences/${encodeURIComponent(occurrenceId)}/review`, {
      method: "POST",
      headers: withCookie(reviewerCookie),
      body: JSON.stringify({
        actorUserId: reviewerUserId,
        lane: "expert-lane",
        decision: "approve",
        proposedName: matchingTaxon,
        proposedRank: "species",
        notes: "matching scope smoke approval",
      }),
    });
    expect(result.ok, `matching approve failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.reviewClass === "authority_backed", "matching approve should be authority_backed");
    return result.payload;
  });

  await run("specialist review reject non-matching", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/occurrences/${encodeURIComponent(occurrenceId)}/review`, {
      method: "POST",
      headers: withCookie(reviewerCookie),
      body: JSON.stringify({
        actorUserId: reviewerUserId,
        lane: "expert-lane",
        decision: "approve",
        proposedName: nonMatchingTaxon,
        proposedRank: "species",
        notes: "should fail due to non-matching scope",
      }),
    });
    expect(result.status === 403, `expected 403 for non-matching approve, got ${result.status}`);
    expect(isRecord(result.payload) && result.payload.error === "specialist_authority_required", "non-matching approve should fail with specialist_authority_required");
    return result.payload;
  });

  await run("specialist/authorities/revoke", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/authorities/${encodeURIComponent(grantedAuthorityId)}/revoke`, {
      method: "POST",
      headers: withCookie(adminCookie),
      body: JSON.stringify({
        reason: "smoke revoke",
      }),
    });
    expect(result.ok, `authority revoke failed: ${JSON.stringify(result.payload)}`);
    return result.payload;
  });

  await run("specialist/me/authorities after revoke", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/me/authorities`, {
      method: "GET",
      headers: withCookie(reviewerCookie),
    });
    expect(result.ok, `authority self lookup after revoke failed: ${JSON.stringify(result.payload)}`);
    expect(isRecord(result.payload) && result.payload.hasSpecialistAccess === false, "reviewer should lose specialist access after revoke");
    const authorities = isRecord(result.payload) && Array.isArray(result.payload.authorities)
      ? result.payload.authorities
      : [];
    expect(authorities.length === 0, "reviewer authority list should be empty after revoke");
    return result.payload;
  });

  await run("specialist/id-workbench denied after revoke", async () => {
    const result = await requestText(`${baseUrl}/specialist/id-workbench?lane=expert-lane`, withCookie(reviewerCookie));
    expect(result.status === 403, `expected 403 after revoke, got ${result.status}`);
    return { status: result.status };
  });

  await run("specialist review deny after revoke", async () => {
    const result = await requestJson(`${baseUrl}/api/v1/specialist/occurrences/${encodeURIComponent(occurrenceId)}/review`, {
      method: "POST",
      headers: withCookie(reviewerCookie),
      body: JSON.stringify({
        actorUserId: reviewerUserId,
        lane: "expert-lane",
        decision: "approve",
        proposedName: matchingTaxon,
        proposedRank: "species",
        notes: "should fail after revoke",
      }),
    });
    expect(result.status === 403, `expected 403 after revoke approve, got ${result.status}`);
    expect(isRecord(result.payload) && result.payload.error === "specialist_role_required", "approve after revoke should fail with specialist_role_required");
    return result.payload;
  });

  console.log(
    JSON.stringify(
      {
        baseUrl: options.baseUrl,
        fixturePrefix: options.fixturePrefix,
        occurrenceId,
        grantedAuthorityId,
        status: "passed",
        steps,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "smoke_specialist_authority_failed";
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
