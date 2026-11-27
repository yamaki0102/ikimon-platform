import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { searchD1PublicPlaces } from "./placeRegistryD1";
import type { Env } from "./core/env";
import {
  buildNonParkPlaceCandidates,
  parseCulturalPropertiesCsv,
  parseMoeSymbiosisPdfText,
  renderNonParkImportSql,
  renderNonParkRollbackSql,
} from "../scripts/import-places-shizuoka-heritage.mjs";

function sqliteDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

test("parseMoeSymbiosisPdfText extracts only Shizuoka rows, handles multi-line wrap, and deduplicates transitioned R5/R6 sites", () => {
  const r806 = [
    " 100 三菱電機株式会社 静岡製作所 群馬工場   三菱電機株式会社 静岡製作所 群馬工場   三菱電機株式会社 静岡製作所 群馬工場   群馬県   太田市   令和７年度第３回   創出",
    "       しずおかフィナンシャルグループ本部「しずぎんの森」 生     しずおかフィナンシャルグループ本部「しずぎんの",
    " 255                                                                    株式会社しずおかフィナンシャルグループ             静岡県      静岡市      令和７年度第１回    維持",
    "       物多様性増進活動計画                      森」",
    " 257 麻機遊水地保全活用増進実施計画                   麻機遊水地                            麻機遊水地保全活用推進協議会                  静岡県      静岡市      令和８年度第２回    維持",
    " 261 半田緑地保全活動実施計画                      半田緑地                             （静岡県）浜松市                        静岡県      浜松市      令和８年度第２回    維持",
  ].join("\n");

  const r5r6 = [
    " 160 麻機遊水地                             麻機遊水地保全活用推進協議会              静岡県       静岡市      R5前期   R8第２回",
    " 163 富士通沼津工場                           富士通株式会社                     静岡県       沼津市      R5前期",
  ].join("\n");

  const items = parseMoeSymbiosisPdfText({
    r806ZoshinText: r806,
    r806RenkeiText: "",
    r5r6Text: r5r6,
  });

  // No.100 is Gunma, No.160 transitions into No.257 -> keep 255, 257, 261, 163 (4 distinct)
  assert.equal(items.length, 4);
  assert.deepEqual(
    items.map((x) => ({ name: x.name, municipality: x.municipality })).sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: "しずおかフィナンシャルグループ本部「しずぎんの森」", municipality: "静岡市" },
      { name: "半田緑地", municipality: "浜松市" },
      { name: "富士通沼津工場", municipality: "沼津市" },
      { name: "麻機遊水地", municipality: "静岡市" },
    ]
  );
  // Fact-only summary contains zero copied plan descriptions
  for (const item of items) {
    assert.match(item.factSummary, /^環境省 (?:自然共生サイト認定|増進活動実施計画認定)/);
    assert.ok(!item.factSummary.includes("増進活動計画"));
  }
});

test("parseCulturalPropertiesCsv filters monuments, keeps Hamamatsu 市認定, and drops 非公開 entries", () => {
  const hmCsv = [
    "指定等,区分,種別,名称,所有者,所在地,指定年月日,公開情報,備考,NO,区,緯度,経度",
    "国指定,有形,建造物,方広寺七尊菩薩堂,方広寺,浜名区引佐町奥山,1954-09-17,公開,,1,浜名区,,",
    "国指定,記念物,史跡,蜆塚遺跡,浜松市,中央区蜆塚四丁目,1959-05-13,公開,,16,中央区,,",
    "国指定,記念物,天然記念物,京丸のアカヤシオ及びシロヤシオ群生地,国有林,天竜区春野町小俣京丸,1982-07-03,非公開,,22,天竜区,,",
    "市認定,記念物,史跡,浜松テスト古墳,地元,中央区テスト町,2020-01-01,,,500,中央区,,",
  ].join("\n");

  const parsed = parseCulturalPropertiesCsv(hmCsv, "hamamatsu_cp");
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]?.name, "蜆塚遺跡");
  assert.equal(parsed[1]?.name, "浜松テスト古墳");
  assert.equal(parsed[1]?.isRegionalHeritage, true);
});

test("buildNonParkPlaceCandidates matches OSM, falls back to municipality centroid with needsReview flag, and generated SQL executes cleanly in D1 with rollback", async (t) => {
  const batch = "nonpark-test-20261127";
  const retrievedAt = "2026-11-27T11:00:00Z";
  const moeItems = parseMoeSymbiosisPdfText({
    r806ZoshinText: " 261 半田緑地保全活動実施計画   半田緑地   （静岡県）浜松市   静岡県   浜松市   令和８年度第２回   維持\n 255 しずぎんの森計画   しずぎんの森   株式会社   静岡県   静岡市   令和７年度第１回   維持",
    r806RenkeiText: "",
    r5r6Text: "",
  });
  const cpItems = parseCulturalPropertiesCsv(
    [
      "指定等,区分,種別,名称,所有者,所在地,指定年月日,公開情報,備考,NO,区,緯度,経度",
      "国指定,記念物,史跡,蜆塚遺跡,浜松市,中央区蜆塚四丁目,1959-05-13,公開,,16,中央区,,",
    ].join("\n"),
    "hamamatsu_cp"
  );

  const built = buildNonParkPlaceCandidates({
    moeItems,
    culturalItems: cpItems,
    osmMatches: {
      "半田緑地": { osmType: "way", osmId: 62242770, lat: 34.775487, lng: 137.745651 },
    },
    municipalityCenters: {
      "静岡市": [34.975562, 138.38276],
      "浜松市": [34.710808, 137.726303],
    },
    existingNames: [],
  });

  assert.equal(built.places.length, 3);
  const handa = built.places.find((p) => p.name === "半田緑地")!;
  const shizugin = built.places.find((p) => p.name === "しずぎんの森")!;
  assert.equal(handa.needsCoordinateReview, false);
  assert.equal(handa.verificationStatus, "source_verified");
  assert.equal(shizugin.needsCoordinateReview, true);
  assert.equal(shizugin.verificationStatus, "unverified");
  assert.equal(shizugin.lat, 34.975562);

  const importSql = renderNonParkImportSql(built.places, { batch, retrievedAt });
  const rollbackSql = renderNonParkRollbackSql(batch);

  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE IF NOT EXISTS place_memory_entries (entry_id TEXT PRIMARY KEY, cell_id TEXT, updated_at TEXT);");
  sqlite.exec(await readFile(new URL("../migrations/observations/0068_universal_place_atlas.sql", import.meta.url), "utf8"));
  sqlite.exec(importSql);

  const db = sqliteDb(sqlite);
  const found = await searchD1PublicPlaces({ db, query: "半田緑地" });
  assert.equal(found.results.length, 1);
  assert.equal(found.results[0]?.canonicalName, "半田緑地");

  // Re-running INSERT OR IGNORE stays idempotent
  sqlite.exec(importSql);
  const totalBeforeRollback = (sqlite.prepare("SELECT COUNT(*) AS c FROM places WHERE public_profile_status = 'published'").get() as { c: number }).c;
  assert.equal(totalBeforeRollback, 3);

  sqlite.exec(rollbackSql);
  const totalAfterRollback = (sqlite.prepare("SELECT COUNT(*) AS c FROM places WHERE public_profile_status = 'published'").get() as { c: number }).c;
  assert.equal(totalAfterRollback, 0);
});

test("committed shizuoka-nonpark-places import.sql and rollback.sql apply cleanly to places D1 schema", async (t) => {
  const importSql = await readFile(new URL("../data/shizuoka-nonpark-places/import.sql", import.meta.url), "utf8");
  const rollbackSql = await readFile(new URL("../data/shizuoka-nonpark-places/rollback.sql", import.meta.url), "utf8");
  const summary = JSON.parse(await readFile(new URL("../data/shizuoka-nonpark-places/summary.json", import.meta.url), "utf8")) as {
    imported: number;
    missingCoordinateSkipped: number;
    bySourceKind: Record<string, number>;
  };

  assert.equal(summary.missingCoordinateSkipped, 0);
  assert.equal(summary.bySourceKind.moe_30by30, 30);
  assert.equal(summary.bySourceKind.hamamatsu_cultural_property, 205);
  assert.equal(summary.bySourceKind.shizuoka_cultural_property, 220);

  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE IF NOT EXISTS place_memory_entries (entry_id TEXT PRIMARY KEY, cell_id TEXT, updated_at TEXT);");
  sqlite.exec(await readFile(new URL("../migrations/observations/0068_universal_place_atlas.sql", import.meta.url), "utf8"));
  sqlite.exec(importSql);

  const countPublished = (sqlite.prepare("SELECT COUNT(*) AS c FROM places WHERE public_profile_status = 'published'").get() as { c: number }).c;
  assert.equal(countPublished, summary.imported);

  const db = sqliteDb(sqlite);
  const handa = await searchD1PublicPlaces({ db, query: "半田緑地" });
  assert.ok(handa.results.some((p) => p.canonicalName === "半田緑地"));

  sqlite.exec(rollbackSql);
  const afterRollback = (sqlite.prepare("SELECT COUNT(*) AS c FROM places WHERE public_profile_status = 'published'").get() as { c: number }).c;
  assert.equal(afterRollback, 0);
});
