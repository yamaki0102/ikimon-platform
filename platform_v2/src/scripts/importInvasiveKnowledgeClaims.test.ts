import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SeedRecord = {
  scientific_name: string;
  vernacular_name: string;
  rank: string;
  mhlw_category: string;
  recommended_action: string;
  action_basis: string;
  legal_warning?: string;
  regional_caveat?: string;
  source_url: string;
};

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, "../../db/seeds/invasive_species_seed.ja.json");

const ALLOWED_CATEGORIES = new Set([
  "iaspecified",
  "priority",
  "industrial",
  "prevention",
  "native",
]);
const ALLOWED_ACTIONS = new Set([
  "observe_only",
  "observe_and_report",
  "report_only",
  "do_not_handle",
  "controlled_removal",
]);

async function loadSeed(): Promise<SeedRecord[]> {
  const text = await readFile(seedPath, "utf8");
  const data = JSON.parse(text) as SeedRecord[];
  if (!Array.isArray(data)) throw new Error("seed must be an array");
  return data;
}

test("invasive seed: every record has required fields", async () => {
  const data = await loadSeed();
  assert.ok(data.length >= 20, "seed should contain at least 20 records to be useful");
  for (const rec of data) {
    assert.ok(rec.scientific_name, `missing scientific_name: ${JSON.stringify(rec)}`);
    assert.ok(rec.vernacular_name, `missing vernacular_name: ${rec.scientific_name}`);
    assert.ok(rec.action_basis, `missing action_basis: ${rec.scientific_name}`);
    assert.ok(rec.source_url, `missing source_url: ${rec.scientific_name}`);
    assert.ok(ALLOWED_CATEGORIES.has(rec.mhlw_category), `invalid mhlw_category for ${rec.scientific_name}: ${rec.mhlw_category}`);
    assert.ok(ALLOWED_ACTIONS.has(rec.recommended_action), `invalid recommended_action for ${rec.scientific_name}: ${rec.recommended_action}`);
  }
});

test("invasive seed: iaspecified records carry legal_warning (素人駆除禁止の周知が必須)", async () => {
  const data = await loadSeed();
  const iaspecified = data.filter((r) => r.mhlw_category === "iaspecified");
  assert.ok(iaspecified.length > 0, "should have iaspecified records");
  for (const rec of iaspecified) {
    assert.ok(
      rec.legal_warning && rec.legal_warning.length > 10,
      `iaspecified record must include legal_warning (素人判断禁止の文言が必要): ${rec.scientific_name}`,
    );
  }
});

test("invasive seed: iaspecified records do NOT recommend controlled_removal (一般市民の駆除を促さない)", async () => {
  const data = await loadSeed();
  for (const rec of data) {
    if (rec.mhlw_category === "iaspecified") {
      assert.notEqual(
        rec.recommended_action,
        "controlled_removal",
        `iaspecified の ${rec.scientific_name} は controlled_removal にしない（許可制のため誤誘導になる）`,
      );
    }
  }
});

test("invasive seed: includes ユーザー言及種 (セイヨウタンポポ・アメリカザリガニ)", async () => {
  const data = await loadSeed();
  const sciNames = new Set(data.map((r) => r.scientific_name));
  assert.ok(sciNames.has("Taraxacum officinale"), "セイヨウタンポポ (Taraxacum officinale) が seed に必要");
  assert.ok(sciNames.has("Procambarus clarkii"), "アメリカザリガニ (Procambarus clarkii) が seed に必要");
});

test("invasive seed: source_url points to env.go.jp", async () => {
  const data = await loadSeed();
  for (const rec of data) {
    assert.match(rec.source_url, /env\.go\.jp/, `source_url should be env.go.jp for ${rec.scientific_name}`);
  }
});
