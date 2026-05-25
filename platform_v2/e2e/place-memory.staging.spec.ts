import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  cleanupFixtures,
  createStagingApiContext,
  requireEnv,
  uniqueFixturePrefix,
} from "./support/staging.js";

type SessionPayload = {
  ok: boolean;
  error?: string;
};

type UpsertPayload = {
  ok?: boolean;
  error?: string;
  visitId?: string;
  occurrenceId?: string;
  placeMemory?: {
    entryId: string;
    cellId: string;
    tags: string[];
    echoNote: string;
    hasPrivateNote: boolean;
    photoEchoEnabled: boolean;
  } | null;
  placeMemorySample?: Array<{ entryId: string; echoNote: string; ownEntry: boolean }>;
};

function cookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

async function upsertUser(api: APIRequestContext, writeKey: string, userId: string): Promise<void> {
  const response = await api.post("/api/v1/users/upsert", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      userId,
      displayName: `Place Memory QA ${userId}`,
      email: `${userId}@example.invalid`,
      roleName: "Observer",
      rankLabel: "観察者",
      authProvider: "playwright",
      banned: false,
    },
  });
  expect(response.ok(), `upsert user ${userId}`).toBeTruthy();
}

async function issueSessionCookie(api: APIRequestContext, writeKey: string, userId: string): Promise<string> {
  const response = await api.post("/api/v1/auth/session/issue", {
    headers: {
      "x-ikimon-write-key": writeKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: { userId, ttlHours: 4 },
  });
  const payload = (await response.json().catch(() => null)) as SessionPayload | null;
  expect(response.ok(), payload?.error ?? `session issue ${userId}`).toBeTruthy();
  const rawCookie = response.headers()["set-cookie"];
  expect(rawCookie, `session cookie ${userId}`).toBeTruthy();
  return cookieHeader(rawCookie!);
}

async function postMemoryRecord(api: APIRequestContext, cookie: string, input: {
  fixturePrefix: string;
  userId: string;
  suffix: string;
  latitude: number;
  longitude: number;
  echoNote: string;
  privateNote: string;
}): Promise<UpsertPayload> {
  const response = await api.post("/api/v1/observations/upsert", {
    headers: {
      cookie,
      "content-type": "application/json",
      accept: "application/json",
    },
    data: {
      observationId: `${input.fixturePrefix}-${input.suffix}-visit`,
      clientSubmissionId: `${input.fixturePrefix}-${input.suffix}-submission`,
      userId: input.userId,
      observedAt: "2026-05-25T09:00:00.000Z",
      latitude: input.latitude,
      longitude: input.longitude,
      localityNote: `place memory staging ${input.fixturePrefix}`,
      note: `place memory staging record ${input.fixturePrefix} ${input.suffix}`,
      taxon: { vernacularName: "クスノキ", scientificName: "Cinnamomum camphora", rank: "species" },
      sourcePayload: { source: input.fixturePrefix, fixturePrefix: input.fixturePrefix },
      placeMemory: {
        tags: ["refresh_walk", "walked_with_someone"],
        echoNote: input.echoNote,
        privateNote: input.privateNote,
        photoEchoEnabled: false,
      },
    },
  });
  const payload = (await response.json().catch(() => null)) as UpsertPayload | null;
  expect(response.ok(), payload?.error ?? `record ${input.suffix}`).toBeTruthy();
  expect(payload?.ok, payload?.error ?? `record ${input.suffix}`).toBeTruthy();
  expect(payload?.placeMemory?.entryId, `place memory entry ${input.suffix}`).toBeTruthy();
  return payload!;
}

test("place memory unlocks only after same-cell recording and supports anonymous moderation actions", async ({ playwright }) => {
  const writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
  const api = await createStagingApiContext(playwright);
  const fixturePrefix = uniqueFixturePrefix("smoke-place-memory");
  const userA = `${fixturePrefix}-a`;
  const userB = `${fixturePrefix}-b`;

  try {
    await upsertUser(api, writeKey, userA);
    await upsertUser(api, writeKey, userB);
    const cookieA = await issueSessionCookie(api, writeKey, userA);
    const cookieB = await issueSessionCookie(api, writeKey, userB);

    const first = await postMemoryRecord(api, cookieA, {
      fixturePrefix,
      userId: userA,
      suffix: "a",
      latitude: 34.7108,
      longitude: 137.7261,
      echoNote: "春の夕方に歩いた",
      privateNote: "private staging memo should never leak",
    });
    const cellId = first.placeMemory!.cellId;
    expect(first.placeMemory?.hasPrivateNote).toBe(true);
    expect(JSON.stringify(first)).not.toContain("private staging memo");

    const lockedResponse = await api.get(`/api/v1/place-memory?cellId=${encodeURIComponent(cellId)}`, {
      headers: { cookie: cookieB, accept: "application/json" },
    });
    const locked = await lockedResponse.json() as { ok: boolean; unlocked: boolean; items: unknown[] };
    expect(lockedResponse.ok()).toBeTruthy();
    expect(locked.unlocked).toBe(false);
    expect(locked.items).toHaveLength(0);

    const second = await postMemoryRecord(api, cookieB, {
      fixturePrefix,
      userId: userB,
      suffix: "b",
      latitude: 34.71082,
      longitude: 137.72612,
      echoNote: "同じ木陰で見つけた",
      privateNote: "second private memo should never leak",
    });
    expect(JSON.stringify(second.placeMemorySample ?? [])).not.toContain("second private memo");

    const listResponse = await api.get(`/api/v1/place-memory?cellId=${encodeURIComponent(cellId)}&limit=12`, {
      headers: { cookie: cookieB, accept: "application/json" },
    });
    const list = await listResponse.json() as {
      ok: boolean;
      unlocked: boolean;
      items: Array<{ entryId: string; echoNote: string; ownEntry: boolean; observedYearMonth: string; likedByMe: boolean; likeCount: number }>;
    };
    expect(listResponse.ok()).toBeTruthy();
    expect(list.unlocked).toBe(true);
    expect(list.items.map((item) => item.echoNote)).toEqual(expect.arrayContaining(["春の夕方に歩いた", "同じ木陰で見つけた"]));
    expect(JSON.stringify(list)).not.toContain("private staging memo");
    expect(list.items.every((item) => /^\d{4}-\d{2}$/.test(item.observedYearMonth))).toBe(true);

    const firstEntry = list.items.find((item) => item.echoNote === "春の夕方に歩いた");
    expect(firstEntry).toBeTruthy();
    const likeResponse = await api.post(`/api/v1/place-memory/${encodeURIComponent(firstEntry!.entryId)}/like`, {
      headers: { cookie: cookieB, accept: "application/json" },
    });
    const liked = await likeResponse.json() as { ok: boolean; liked: boolean; likeCount: number };
    expect(likeResponse.ok()).toBeTruthy();
    expect(liked.liked).toBe(true);
    expect(liked.likeCount).toBe(1);

    const selfLikeResponse = await api.post(`/api/v1/place-memory/${encodeURIComponent(second.placeMemory!.entryId)}/like`, {
      headers: { cookie: cookieB, accept: "application/json" },
    });
    expect(selfLikeResponse.status()).toBe(403);

    const reportResponse = await api.post(`/api/v1/place-memory/${encodeURIComponent(firstEntry!.entryId)}/report`, {
      headers: {
        cookie: cookieB,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: { reasonCode: "qa_hide", reasonNote: "staging self-hide check" },
    });
    const reported = await reportResponse.json() as { ok: boolean; hiddenForMe: boolean; moderationStatus: string };
    expect(reportResponse.ok()).toBeTruthy();
    expect(reported.hiddenForMe).toBe(true);
    expect(reported.moderationStatus).toBe("visible");

    const hiddenListResponse = await api.get(`/api/v1/place-memory?cellId=${encodeURIComponent(cellId)}&limit=12`, {
      headers: { cookie: cookieB, accept: "application/json" },
    });
    const hiddenList = await hiddenListResponse.json() as { items: Array<{ entryId: string }> };
    expect(hiddenList.items.some((item) => item.entryId === firstEntry!.entryId)).toBe(false);
  } finally {
    await cleanupFixtures(api, writeKey, fixturePrefix).catch(() => undefined);
    await api.dispose();
  }
});
