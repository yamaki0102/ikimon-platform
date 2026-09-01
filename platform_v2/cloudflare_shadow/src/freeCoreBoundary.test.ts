import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderObservationEventRecapPage } from "./index.js";

test("free Event recap keeps operational counts but omits taxon aggregation", () => {
  const html = renderObservationEventRecapPage({
    session: { sessionId: "event-1", title: "Free activity" },
    permissions: { canManage: false },
    highlights: { observationCount: 2, participantsCount: 3, uniqueSpeciesCount: 7, topTaxa: [{ name: "セミ", count: 2 }] },
    photos: [{ photoUrl: "/photo", taxonName: "セミ" }],
  });
  assert.match(html, /観察記録/);
  assert.match(html, /参加した家族・グループ/);
  assert.doesNotMatch(html, /セミ|uniqueSpeciesCount|topTaxa|見つかった種類|taxonomic/i);
});

test("native free activity and report surfaces keep the derived-output boundary explicit", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const live = source.slice(source.indexOf("function renderObservationEventLivePage"), source.indexOf("function renderObservationEventConsolePage"));
  const report = source.slice(source.indexOf("async function buildObservationEventOfficialReport"), source.indexOf("function csvCell"));
  assert.doesNotMatch(live, /uniqueTaxaCount|targetTaxaHtml|targetSpecies/);
  assert.match(report, /professional_report_requires_separate_contract/);
  assert.match(source, /hasProfessionalReportEntitlement/);
});
