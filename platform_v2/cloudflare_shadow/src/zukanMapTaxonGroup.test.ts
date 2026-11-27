import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";
import { inferTaxonGroupForLabel, parseMapTaxonGroupFilter } from "./zukanMapTaxonGroup";

test("parseMapTaxonGroupFilter accepts taxonomic groups and ignores invasive/unknown", () => {
  assert.equal(parseMapTaxonGroupFilter("insect"), "insect");
  assert.equal(parseMapTaxonGroupFilter("bird"), "bird");
  assert.equal(parseMapTaxonGroupFilter("plant"), "plant");
  assert.equal(parseMapTaxonGroupFilter("BIRD"), "bird");
  assert.equal(parseMapTaxonGroupFilter("invasive"), null);
  assert.equal(parseMapTaxonGroupFilter(""), null);
  assert.equal(parseMapTaxonGroupFilter(null), null);
});

test("inferTaxonGroupForLabel classifies Japanese species names and respects stored non-generic taxon_group", () => {
  assert.equal(inferTaxonGroupForLabel("スズメ"), "bird");
  assert.equal(inferTaxonGroupForLabel("ヤツデ"), "plant");
  assert.equal(inferTaxonGroupForLabel("モンシロチョウ"), "insect");
  assert.equal(inferTaxonGroupForLabel("不明な名前", "insect"), "insect");
  assert.equal(inferTaxonGroupForLabel("スズメ", "other"), "bird");
});

test("/api/v1/map/cells and /observations filter by taxon_group after full-set coarsening", async () => {
  const observedAt = "2026-10-15T14:23:45.000Z";
  const obsRows = [
    { observation_id: "obs-d1", owner_user_id: "u-a", public_cell: "cell:35.52,139.52", taxon_label: "スズメ" },
    { observation_id: "obs-d2", owner_user_id: "u-b", public_cell: "cell:35.52,139.52", taxon_label: "モンシロチョウ" },
    { observation_id: "obs-d3", owner_user_id: "u-c", public_cell: "cell:35.52,139.52", taxon_label: "ヤツデ" },
    { observation_id: "obs-s1", owner_user_id: "u-1", public_cell: "cell:35.68,139.77", taxon_label: "カンサイタンポポ" },
  ];
  const mockDb = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first() {
          return null;
        },
        async all() {
          if (sql.includes("FROM public_map_snapshot_records_v1")) {
            throw new Error("no such table: public_map_snapshot_records_v1");
          }
          if (sql.includes("FROM readmodel_public_observations")) {
            return {
              results: obsRows.map((r) => ({
                observation_id: r.observation_id,
                public_cell: r.public_cell.replace(/^cell:/, ""),
                observed_at: observedAt,
                taxon_label: r.taxon_label,
                asset_count: 0,
                public_area_label: "東京都",
              })),
            };
          }
          if (sql.includes("SELECT observation_id, owner_user_id FROM observations")) {
            const set = new Set(bound.map(String));
            return { results: obsRows.filter((r) => set.has(r.observation_id)).map((r) => ({ observation_id: r.observation_id, owner_user_id: r.owner_user_id })) };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
  };
  const env = { OBS_DB: mockDb } as never;

  const plantCellsRes = await worker.fetch(new Request("https://zukan.earth/api/v1/map/cells?bbox=139.0,35.0,140.0,36.0&taxon_group=plant"), env);
  assert.equal(plantCellsRes.status, 200);
  const plantCells = await plantCellsRes.json() as {
    features: Array<{ properties: { cellId: string; count: number; gridM: number } }>;
    stats: { totalRecords: number };
  };
  assert.equal(plantCells.stats.totalRecords, 2);
  assert.deepEqual(plantCells.features.map((f) => [f.properties.cellId, f.properties.gridM]).sort(), [
    ["cell:35.52,139.52", 1000],
    ["cell:35.7,139.8", 10000],
  ]);

  const insectObsRes = await worker.fetch(new Request("https://zukan.earth/api/v1/map/observations?bbox=139.0,35.0,140.0,36.0&taxon_group=insect"), env);
  assert.equal(insectObsRes.status, 200);
  const insectObs = await insectObsRes.json() as {
    items: Array<{ visitId: string; taxonGroup: string; publicCellId: string }>;
  };
  assert.deepEqual(insectObs.items.map((i) => i.visitId), ["obs-d2"]);
  assert.equal(insectObs.items[0]?.taxonGroup, "insect");
  assert.equal(insectObs.items[0]?.publicCellId, "cell:35.52,139.52");
});

test("resolveTaxonGroups prefers stored snapshot group and falls back to label inference", async () => {
  const { resolveTaxonGroups } = await import("./zukanMapTaxonGroup");
  const db = { prepare(sql: string) { return { bind() { return { async all() {
    if (sql.includes("public_map_snapshot_records_v1")) return { results: [{ name: "テスト種", grp: "bird", n: 3 }, { name: "テスト種", grp: "other", n: 9 }] };
    throw new Error("no table");
  } }; } }; } };
  const m = await resolveTaxonGroups(db as never, ["テスト種", "カワヅザクラ", "不明な名前"]);
  assert.equal(m.get("テスト種"), "bird");
  assert.equal(m.get("カワヅザクラ"), "plant");
  assert.equal(m.get("不明な名前"), "other");
});

test("regionMapCardHtml draws small markers for sparse cells", async () => {
  const { regionMapCardHtml } = await import("./regionSurfaceV1");
  const html = regionMapCardHtml([{ cell: "35.0000,139.0000", count: 1 }], "/ja/map", "ja");
  const m = /<rect x="[\d.]+" y="[\d.]+" width="(\d+\.\d)" height="(\d+\.\d)"/g;
  const sizes = [...html.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/g)];
  assert.equal(sizes.length, 1);
  assert.ok(Number(sizes[0]![1]) <= 30 && Number(sizes[0]![2]) <= 30);
  void m;
});
