import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { localizePublicLocationLabel, observationDetailLinks } from "./observationDetailLinks";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";

const base: ObservationFirstRecordDetail = {
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visit-links",
  owner: false,
  visibility: "public",
  observationCount: 1,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations: [],
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置をぼかしています" },
};

const render = (lang: "ja" | "en", extra: Record<string, unknown>, detail = base) =>
  renderObservationFirstRecordDetailHtml(detail, {
    lang, title: "カワヅザクラ", titleStatus: "confirmed", observedLabel: "2026-03-01", note: null, media: [], actionNonce: "n",
    publicLocationLabel: localizePublicLocationLabel("位置をぼかしています", lang),
    ...extra,
  } as never);

test("link targets: species skips coarse names, region strips prefecture, place is encoded", () => {
  const l = observationDetailLinks({ lang: "en", speciesName: " カワヅザクラ ", speciesOn: true, areaLabel: "静岡県浜松市", regionOn: true, place: { id: "p/1", name: "公園" } });
  assert.equal(l.species?.href, "/en/species/%E3%82%AB%E3%83%AF%E3%83%85%E3%82%B6%E3%82%AF%E3%83%A9");
  assert.equal(l.region?.href, "/en/regions/jp/shizuoka/hamamatsu");
  assert.equal(l.place?.href, "/en/places/p%2F1");
  assert.equal(observationDetailLinks({ lang: "ja", speciesName: "チョウ", speciesOn: true }).species, null);
  assert.equal(observationDetailLinks({ lang: "ja", speciesName: "バラ科", speciesOn: true }).species, null);
  assert.equal(observationDetailLinks({ lang: "ja", speciesName: "カワヅザクラ", speciesOn: false }).species, null);
  assert.equal(observationDetailLinks({ lang: "ja", areaLabel: "浜松市", regionOn: false }).region, null);
  assert.equal(observationDetailLinks({ lang: "ja", areaLabel: null, regionOn: true }).region, null);
});

test("location label is localized for non-ja and unchanged for ja", () => {
  assert.equal(localizePublicLocationLabel("位置をぼかしています", "ja"), "位置をぼかしています");
  assert.equal(localizePublicLocationLabel("位置をぼかしています", "en"), "Location is blurred");
  assert.equal(localizePublicLocationLabel("位置は非公開です", "pt-br"), "A localização é privada");
  assert.equal(localizePublicLocationLabel("浜松市", "en"), "浜松市");
});

test("detail page renders species, region and place links only for public records", () => {
  const detailLinks = { speciesOn: true, regionOn: true, areaLabel: "浜松市", place: { id: "pl1", name: "公園" } };
  const html = render("en", { detailLinks });
  assert.match(html, /<nav class="of-links"/);
  assert.match(html, /href="\/en\/regions\/jp\/shizuoka\/hamamatsu" data-of-link="region"/);
  assert.match(html, /href="\/en\/places\/pl1" data-of-link="place"/);
  assert.doesNotMatch(html, /位置をぼかしています|前の写真|次の写真/);
  assert.match(html, /Location is blurred/);
  const priv = render("en", { detailLinks }, { ...base, visibility: "private" } as ObservationFirstRecordDetail);
  assert.doesNotMatch(priv, /of-links"/);
  assert.doesNotMatch(render("ja", {}), /of-links"/);
});

test("species link appears for a confirmed accepted name and is absent for coarse names", () => {
  const withName = (name: string): ObservationFirstRecordDetail => ({
    ...base,
    observations: [{
      observationId: "o1", state: "active", subjectType: "organism", subjectLabel: name, assertionStatus: "human_asserted", verificationStatus: "owner_confirmed",
      acceptedIdentification: { claimId: "c", actorType: "owner", actorId: "u", proposalActorType: "owner", proposedName: name, proposedScientificName: null, proposedRank: "species", humanDecision: true },
      communityIdentifications: [], aiSuggestions: [], media: [], provenance: { owner: true, ai: false, community: false, curator: false, imported: false },
    }],
  });
  const links = { speciesOn: true };
  const ok = render("en", { detailLinks: links }, withName("カワヅザクラ"));
  assert.match(ok, /href="\/en\/species\/%E3%82%AB%E3%83%AF%E3%83%85%E3%82%B6%E3%82%AF%E3%83%A9" data-of-link="species"/);
  assert.doesNotMatch(render("en", { detailLinks: links, title: "チョウ" }, withName("チョウ")), /data-of-link="species"/);
});
