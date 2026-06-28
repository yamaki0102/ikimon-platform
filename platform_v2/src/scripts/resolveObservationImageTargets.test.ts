import assert from "node:assert/strict";
import test from "node:test";
import {
  detailHtmlMatchesPhotoOnlyObservation,
  observationImageTargetFromMapItem,
  observationImageTargetPath,
  resolveObservationImageTargets,
  type FetchLike,
} from "./resolveObservationImageTargets.js";

const photoOnlyHtml = `
  <div class="obs-hero-media-stack is-photo-only">
    <img data-obs-preview-img src="/photo.webp">
  </div>
`;

test("observationImageTargetPath keeps record and occurrence URL shapes", () => {
  assert.equal(
    observationImageTargetPath({ visitId: "record-1781252770584", occurrenceId: "occ:record-1781252770584:0" }),
    "/observations/record-1781252770584?subject=occ%3Arecord-1781252770584%3A0&lang=ja",
  );
  assert.equal(
    observationImageTargetPath({
      visitId: "fdd87039-b91f-4fd6-8dac-093ea06817d1",
      occurrenceId: "occ:fdd87039-b91f-4fd6-8dac-093ea06817d1:0",
    }),
    "/observations/occ%3Afdd87039-b91f-4fd6-8dac-093ea06817d1%3A0?lang=ja",
  );
});

test("observationImageTargetFromMapItem requires public photo data", () => {
  assert.equal(observationImageTargetFromMapItem({ visitId: "record-1", occurrenceId: "occ:record-1:0" }), null);
  assert.deepEqual(
    observationImageTargetFromMapItem({
      visitId: "record-1",
      occurrenceId: "occ:record-1:0",
      photoUrl: "/derived/photo.webp",
      observedAt: "2026-06-01",
      displayName: "同定待ち",
    }),
    {
      path: "/observations/record-1?subject=occ%3Arecord-1%3A0&lang=ja",
      visitId: "record-1",
      occurrenceId: "occ:record-1:0",
      observedAt: "2026-06-01",
      displayName: "同定待ち",
      photoUrl: "/derived/photo.webp",
      source: "record-path",
    },
  );
});

test("detailHtmlMatchesPhotoOnlyObservation rejects video detail DOM", () => {
  assert.equal(detailHtmlMatchesPhotoOnlyObservation(photoOnlyHtml), true);
  assert.equal(detailHtmlMatchesPhotoOnlyObservation(`${photoOnlyHtml}<div class="obs-hero-video-frame"></div>`), false);
  assert.equal(detailHtmlMatchesPhotoOnlyObservation(`${photoOnlyHtml}<div class="obs-video-evidence-frame"></div>`), false);
});

test("resolveObservationImageTargets selects recent record paths plus an occurrence path", async () => {
  const mapItems = [
    { visitId: "record-3", occurrenceId: "occ:record-3:0", photoUrl: "/p3.webp", observedAt: "2026-06-03" },
    { visitId: "record-2", occurrenceId: "occ:record-2:0", photoUrl: "/p2.webp", observedAt: "2026-06-02" },
    { visitId: "record-video", occurrenceId: "occ:record-video:0", photoUrl: "/video.webp", observedAt: "2026-06-02" },
    { visitId: "record-1", occurrenceId: "occ:record-1:0", photoUrl: "/p1.webp", observedAt: "2026-06-01" },
    { visitId: "uuid-1", occurrenceId: "occ:uuid-1:0", photoUrl: "/uuid.webp", observedAt: "2026-05-01" },
  ];
  const fetchImpl: FetchLike = async (input) => {
    const url = String(input);
    if (url.includes("/api/v1/map/observations")) {
      return new Response(JSON.stringify({ items: mapItems }), { status: 200 });
    }
    const html = url.includes("record-video")
      ? `${photoOnlyHtml}<div class="obs-hero-video-frame"></div>`
      : photoOnlyHtml;
    return new Response(html, { status: 200 });
  };

  const result = await resolveObservationImageTargets({
    baseUrl: "https://example.test",
    count: 4,
    fetchImpl,
  });

  assert.deepEqual(result.targets.map((target) => target.visitId), ["record-3", "record-2", "record-1", "uuid-1"]);
  assert.deepEqual(result.targets.map((target) => target.source), [
    "record-path",
    "record-path",
    "record-path",
    "occurrence-path",
  ]);
});
