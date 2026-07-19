import assert from "node:assert/strict";
import test from "node:test";
import { loadOwnerObservationProcessingStatusFromD1 } from "./ownerObservationProcessingStatus.js";

test("D1 owner status keeps media and AI facts separate", async () => {
  const database = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          return {
            observation_id: "record-1",
            observed_at: "2026-07-18T09:00:00.000Z",
            original_photo_count: 1,
            display_photo_count: 0,
            latest_media_job_status: "dispatched",
            latest_media_job_error: null,
            ai_request_status: "pending",
            ai_assessment_status: null,
            candidate_count: 0,
            identification_count: 0,
            updated_at: "2026-07-18T09:01:00.000Z",
          } as T;
        },
      };
    },
  };

  const status = await loadOwnerObservationProcessingStatusFromD1(database, {
    observationId: "record-1",
    ownerUserId: "owner-1",
    providerAvailable: false,
  });

  assert.equal(status?.mediaState, "processing");
  assert.equal(status?.aiState, "unavailable");
  assert.match(status?.message ?? "", /写真1枚は保存済み/);
});

test("D1 owner status returns null when the owner-scoped row is absent", async () => {
  const database = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async first<T>() {
          return null as T | null;
        },
      };
    },
  };

  assert.equal(await loadOwnerObservationProcessingStatusFromD1(database, {
    observationId: "record-1",
    ownerUserId: "other-user",
    providerAvailable: false,
  }), null);
});
