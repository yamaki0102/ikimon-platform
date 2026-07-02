import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationField } from "../services/observationFieldRegistry.js";
import { renderFieldListBody } from "./observationFieldList.js";

function field(overrides: Partial<ObservationField> = {}): ObservationField {
  return {
    fieldId: "field-1",
    source: "nature_symbiosis_site",
    adminLevel: null,
    name: "朝比奈の水辺",
    nameKana: "",
    summary: "水辺と草地を含む観察フィールド。",
    prefecture: "静岡県",
    city: "静岡市",
    lat: 34.98,
    lng: 138.38,
    radiusM: 300,
    polygon: null,
    areaHa: 12.4,
    certificationId: "cert-1",
    certifiedAt: "2026-01-01T00:00:00.000Z",
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.9,
    verificationLevel: "registry_matched",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    entityKey: "field-1",
    validFrom: null,
    validTo: null,
    supersededBy: null,
    payload: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("field list splits first choice into place search and event setup", () => {
  const html = renderFieldListBody({
    fields: [field()],
    prefectures: [{ prefecture: "静岡県", total: 1, natureSymbiosisSite: 1, tsunag: 0, school: 0, userDefined: 0 }],
    filter: {},
  });

  assert.match(html, /いつもの場所に、記録が積み上がる。/);
  assert.match(html, /校庭や庭先は、公開せず自分やグループだけの非公開フィールド/);
  assert.match(html, /公開フィールドを見る/);
  assert.match(html, /id="field-db-search"/);
  assert.match(html, /一覧から見て、必要なら名前・市町村・都道府県で絞り込めます/);
  assert.doesNotMatch(html, />学校<\/a>/);
  assert.match(html, /href="\/community\/events\/new"/);
  assert.match(html, /<summary class="evt-eyebrow"[^>]*>都道府県で絞り込み<\/summary>/);
});

test("field cards keep existing actions while exposing field and event readiness", () => {
  const html = renderFieldListBody({
    fields: [field()],
    prefectures: [],
    filter: {},
  });

  assert.match(html, /朝比奈の水辺/);
  assert.match(html, /確認済み/);
  assert.match(html, /観察会の範囲に使える/);
  assert.match(html, /href="\/community\/fields\/field-1"/);
  assert.match(html, /href="\/community\/events\/new\?field_id=field-1"/);
});

test("school field cards make permission status visible", () => {
  const html = renderFieldListBody({
    fields: [field({ source: "school", adminLevel: "school", certifiedAt: null, sourceConfidence: 0.3, verificationLevel: "" })],
    prefectures: [],
    filter: {},
  });

  assert.match(html, /確認中/);
  assert.match(html, /許可確認が必要/);
});
