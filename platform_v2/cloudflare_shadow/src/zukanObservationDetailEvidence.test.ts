import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import {
  buildObservationDetailEvidence,
  handleGetObservationEvidence,
  renderObservationDetailEvidenceHtml,
} from "./zukanObservationDetailEvidence";

test("renderObservationDetailEvidenceHtml renders D1/D2 viewer badge and D6 verified evidence", () => {
  const ownHtml = renderObservationDetailEvidenceHtml(
    buildObservationDetailEvidence({
      observationId: "obs_1",
      isOwner: true,
      observedAt: "2026-11-25T10:00:00Z",
      placeId: "place_1",
      locationPrecision: "public_place",
      hasScrubbedAsset: true,
    }),
    "ja"
  );
  assert.match(ownHtml, /data-detail-evidence="d1-d2-d6"/);
  assert.match(ownHtml, /自分の記録/);
  assert.match(ownHtml, /確認済み/);
  assert.match(ownHtml, /登録された場所/);

  const otherHtml = renderObservationDetailEvidenceHtml(
    buildObservationDetailEvidence({
      observationId: "obs_2",
      isOwner: false,
      observedAt: "2026-11-25T10:00:00Z",
      placeId: null,
      locationPrecision: "grid",
      hasScrubbedAsset: false,
    }),
    "ja"
  );
  assert.match(otherHtml, /みんなの記録/);
  assert.match(otherHtml, /確認待ち/);
});

test("GET /api/v1/observations/:id/evidence enforces 401/403 on private records and 200 on public records", async () => {
  const privateObsDb = {
    prepare(sql: string) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes("FROM observations")) {
                return {
                  observation_id: "obs_priv",
                  user_id: "owner_1",
                  visibility: "private",
                  observed_at: "2026-11-25T10:00:00Z",
                  location_precision: "grid",
                  place_id: null,
                };
              }
              return { cnt: 1 };
            },
          };
        },
      };
    },
  };

  const unauthPrivate = await handleGetObservationEvidence(
    "obs_priv",
    null,
    privateObsDb as any
  );
  assert.equal(unauthPrivate.status, 401);

  const otherUserPrivate = await handleGetObservationEvidence(
    "obs_priv",
    { userId: "other_user", banned: false } as any,
    privateObsDb as any
  );
  assert.equal(otherUserPrivate.status, 403);

  const ownerPrivate = await handleGetObservationEvidence(
    "obs_priv",
    { userId: "owner_1", banned: false } as any,
    privateObsDb as any
  );
  assert.equal(ownerPrivate.status, 200);
  const ownerBody = (await ownerPrivate.json()) as {
    ok: boolean;
    evidence: { isOwner: boolean; verificationState: string };
  };
  assert.equal(ownerBody.ok, true);
  assert.equal(ownerBody.evidence.isOwner, true);
  assert.equal(ownerBody.evidence.verificationState, "verified");

  const unauthWorker = await worker.fetch(
    new Request("https://shadow.test/api/v1/observations/nonexistent_obs/evidence"),
    {
      OBS_DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return null;
                },
              };
            },
          };
        },
      },
    } as any
  );
  assert.equal(unauthWorker.status, 404);
});
