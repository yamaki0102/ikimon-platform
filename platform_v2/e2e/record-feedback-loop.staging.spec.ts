import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  createStagingApiContext,
  issueSessionCookie,
  requireEnv,
  uniqueFixturePrefix,
} from "./support/staging.js";

type JsonObject = Record<string, unknown>;
type CleanupDeletedCounts = JsonObject & {
  alerts?: number;
  assets?: number;
  observations?: number;
  r2Objects?: number;
  recordReadingCards?: number;
  sessions?: number;
  users?: number;
};

function sessionCookieHeader(rawCookie: string): string {
  return rawCookie.split(";")[0] ?? rawCookie;
}

function requireApiContext(api: APIRequestContext | null): APIRequestContext {
  expect(api, "staging API context should be initialized by beforeAll").toBeTruthy();
  return api!;
}

async function expectJsonOk<T extends JsonObject>(
  response: Awaited<ReturnType<APIRequestContext["post"]>> | Awaited<ReturnType<APIRequestContext["get"]>>,
  label: string,
): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;
  expect(response.ok(), `${label}: ${JSON.stringify(payload)}`).toBeTruthy();
  expect(payload && payload.ok !== false, `${label}: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload!;
}

test.describe.serial("record feedback loop staging smoke", () => {
  let api: APIRequestContext | null = null;
  let writeKey = "";
  let createdFixturePrefix: string | null = null;
  const createdVisitIds: string[] = [];
  let createdCookie: string | null = null;
  const expectedCleanupMinimums = {
    alerts: 0,
    assets: 0,
    observations: 0,
    r2Objects: 0,
    recordReadingCards: 0,
    sessions: 0,
    users: 0,
  };

  test.beforeAll(async ({ playwright }) => {
    writeKey = requireEnv("V2_PRIVILEGED_WRITE_API_KEY");
    api = await createStagingApiContext(playwright);
  });

  test.afterAll(async () => {
    try {
      if (createdCookie) {
        for (const visitId of createdVisitIds) {
          await api?.post(`/api/v1/observations/${encodeURIComponent(visitId)}/hide`, {
            headers: {
              cookie: createdCookie,
              "content-type": "application/json",
              accept: "application/json",
            },
            data: {},
          }).catch(() => undefined);
        }
      }
      if (api && createdFixturePrefix) {
        const cleanupResponse = await api.post("/api/v1/ops/staging/record-feedback-loop/cleanup", {
          headers: {
            "x-ikimon-write-key": writeKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          data: { fixturePrefix: createdFixturePrefix },
        });
        const cleanup = await expectJsonOk<{ ok: boolean; deleted?: CleanupDeletedCounts }>(cleanupResponse, "cleanup_record_feedback_loop_fixture");
        const deleted = cleanup.deleted ?? {};
        for (const [key, expected] of Object.entries(expectedCleanupMinimums)) {
          expect(Number(deleted[key] ?? 0), `cleanup deleted.${key}`).toBeGreaterThanOrEqual(expected);
        }
      }
    } finally {
      await api?.dispose();
    }
  });

  test("normal record feedback loop reaches read state and clean audio appears on home", async () => {
    const apiContext = requireApiContext(api);
    const fixturePrefix = uniqueFixturePrefix("record-feedback-loop");
    createdFixturePrefix = fixturePrefix;
    const userId = `${fixturePrefix}-user`;
    const visitId = `${fixturePrefix}-visit`;
    const occurrenceId = `occ:${visitId}:0`;
    const rawCookie = await issueSessionCookie(apiContext, writeKey, userId);
    const cookie = sessionCookieHeader(rawCookie);
    expectedCleanupMinimums.sessions = 1;
    expectedCleanupMinimums.users = 1;
    createdCookie = cookie;

    const upsertResponse = await apiContext.post("/api/v1/observations/upsert", {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {
        observationId: visitId,
        clientSubmissionId: `${fixturePrefix}-client`,
        userId,
        observedAt: "2026-06-25T00:00:00.000Z",
        latitude: 34.71234,
        longitude: 137.81234,
        visibility: "private",
        note: "record feedback loop staging smoke",
        taxon: {
          vernacularName: "シロツメクサ",
          scientificName: "Trifolium repens",
          rank: "species",
        },
        sourcePayload: {
          source: "record_feedback_loop_staging_smoke",
          fixturePrefix,
        },
      },
    });
    const upsert = await expectJsonOk<JsonObject>(upsertResponse, "upsert");
    expect(upsert.visitId).toBe(visitId);
    expect(upsert.occurrenceId).toBe(occurrenceId);
    expect((upsert.feedbackLoop as JsonObject | undefined)?.status).toBe("queued");
    createdVisitIds.push(visitId);
    expectedCleanupMinimums.observations += 1;

    const photoResponse = await apiContext.post(`/api/v1/observations/${encodeURIComponent(visitId)}/photos/upload`, {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {
        filename: `${fixturePrefix}.jpg`,
        mimeType: "image/jpeg",
        base64Data: Buffer.from(`record-feedback-loop:${fixturePrefix}`).toString("base64"),
        facePrivacy: "no_faces",
      },
    });
    await expectJsonOk<JsonObject>(photoResponse, "photo_upload");
    expectedCleanupMinimums.assets += 1;
    expectedCleanupMinimums.r2Objects += 1;

    const cardsResponse = await apiContext.post(`/api/v1/observations/${encodeURIComponent(occurrenceId)}/reading-cards`, {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {},
    });
    const cards = await expectJsonOk<JsonObject>(cardsResponse, "reading_cards");
    const feedbackLoop = cards.feedbackLoop as JsonObject | undefined;
    expect(feedbackLoop?.status).toBe("ready");
    expect(feedbackLoop?.claimLevel).toBe("deferred");
    expect(feedbackLoop?.nextAction).toMatchObject({
      href: `/observations/${visitId}?subject=${encodeURIComponent(occurrenceId)}#record-feedback`,
    });
    expectedCleanupMinimums.recordReadingCards = Math.max(
      expectedCleanupMinimums.recordReadingCards,
      Number(feedbackLoop?.cardCount ?? 0),
    );

    const alertsResponse = await apiContext.get("/api/v1/me/alerts", {
      headers: {
        cookie,
        accept: "application/json",
      },
    });
    const alerts = await expectJsonOk<{ ok: boolean; alerts: Array<JsonObject> }>(alertsResponse, "alerts");
    const alert = alerts.alerts.find((item) =>
      item.triggerKind === "record_feedback_ready" &&
      (item.payload as JsonObject | undefined)?.href === `/observations/${visitId}?subject=${encodeURIComponent(occurrenceId)}#record-feedback`
    );
    expect(alert, JSON.stringify(alerts.alerts)).toBeTruthy();
    expect(alert?.acknowledgedAt).toBeFalsy();
    expectedCleanupMinimums.alerts = 1;

    const readResponse = await apiContext.post("/api/v1/me/alerts/read", {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: { ids: [alert?.deliveryId] },
    });
    const read = await expectJsonOk<{ ok: boolean; acknowledgedCount: number }>(readResponse, "alerts_read");
    expect(read.acknowledgedCount).toBeGreaterThanOrEqual(1);

    const audioVisitId = `${fixturePrefix}-audio-visit`;
    const audioRecordResponse = await apiContext.post("/api/v1/observations/upsert", {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {
        observationId: audioVisitId,
        clientSubmissionId: `${fixturePrefix}-audio-client`,
        userId,
        observedAt: "2026-06-25T00:05:00.000Z",
        latitude: 34.7108,
        longitude: 137.7261,
        visibility: "public",
        note: "record feedback loop staging clean audio",
        taxon: {
          vernacularName: "音の記録",
          rank: "unknown",
        },
        sourcePayload: {
          source: "record_feedback_loop_staging_clean_audio",
          fixturePrefix,
          mediaKind: "audio",
        },
      },
    });
    const audioRecord = await expectJsonOk<JsonObject>(audioRecordResponse, "audio_record_upsert");
    expect(audioRecord.visitId).toBe(audioVisitId);
    createdVisitIds.push(audioVisitId);
    expectedCleanupMinimums.observations += 1;

    const cleanWebmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01]).toString("base64");
    const audioUploadResponse = await apiContext.post(`/api/v1/observations/${encodeURIComponent(audioVisitId)}/audio/upload`, {
      headers: {
        cookie,
        "content-type": "application/json",
        accept: "application/json",
      },
      data: {
        filename: `${fixturePrefix}-clean-tone.webm`,
        mimeType: "audio/webm;codecs=opus",
        base64Data: cleanWebmHeader,
        mediaRole: "observation_audio",
        privacyStatus: "clean",
        voiceFlag: "no_voice",
        transcriptionStatus: "done",
        meta: {
          clientVadResult: {
            speechLikely: false,
            confidence: 0.98,
            reason: "record_feedback_loop_staging_clean_audio",
            voiceBandRatio: 0.08,
          },
        },
      },
    });
    const audioUpload = await expectJsonOk<JsonObject>(audioUploadResponse, "audio_upload");
    expect(audioUpload.mediaRole).toBe("observation_audio");
    expect(audioUpload.privacyStatus).toBe("clean");
    expectedCleanupMinimums.assets += 1;
    expectedCleanupMinimums.r2Objects += 1;

    await expect.poll(async () => {
      const homeResponse = await apiContext.get("/ja/", {
        headers: {
          accept: "text/html",
          "cache-control": "no-store",
        },
      });
      const html = await homeResponse.text();
      return homeResponse.ok()
        && html.includes(`data-cloudflare-home-record-id="${audioVisitId}"`)
        && html.includes('data-media-kind="audio"')
        && html.includes("prototype-content-icon is-audio")
        && html.includes('aria-label="音"');
    }, {
      message: "clean audio public record should appear as an audio card on staging home",
      timeout: 90_000,
      intervals: [2_000, 5_000, 10_000],
    }).toBe(true);
  });
});
