import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("municipal walk map routes are registered with API and preview paths", async () => {
  const appSource = await readFile(path.join(process.cwd(), "src", "app.ts"), "utf8");
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "municipalWalkMaps.ts"), "utf8");

  assert.match(appSource, /registerMunicipalWalkMapRoutes/);
  assert.match(routeSource, /\/api\/v1\/municipal-walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/admin\/municipal-walk-maps/);
  assert.match(routeSource, /\/admin\/municipal-walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/admin\/municipal-walk-map-creators/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-creators/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-templates/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-source-catalog/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/api\/v1\/municipal-walk-maps"/);
  assert.match(routeSource, /\/walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/walk-maps"/);
  assert.match(routeSource, /renderWalkMapIndexBody/);
  assert.match(routeSource, /IKIMON_ENABLE_DB_WALK_MAP_INDEX/);
  assert.match(routeSource, /listPublicMunicipalWalkMapSummariesV0/);
  assert.match(routeSource, /listStaticMunicipalWalkMapPublicSummariesV0/);
  assert.match(routeSource, /assertMunicipalWalkMapAdminAccess/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.match(routeSource, /assertPrivilegedWriteAccess/);
  assert.match(routeSource, /!options\.allowDraft && !isPublicVisible\(dbConfig\)/);
  assert.match(routeSource, /isPublicVisible\(dbConfig\)/);
  assert.match(routeSource, /getStaticMunicipalWalkMapConfigV0\(walkMapId\)/);
  assert.match(routeSource, /getSessionFromCookie/);
  assert.match(routeSource, /getMunicipalWalkMapCreatorV0/);
  assert.match(routeSource, /applyRegisteredCreatorProfileForWriteV0/);
  assert.match(routeSource, /prepareConfigForWrite/);
  assert.match(routeSource, /upsertMunicipalWalkMapConfigV0/);
});

test("municipal walk map authoring UI posts typed config to admin API", async () => {
  const routeSource = await readFile(path.join(process.cwd(), "src", "routes", "municipalWalkMaps.ts"), "utf8");

  assert.match(routeSource, /data-walk-map-form/);
  assert.match(routeSource, /function wmPayload\(form\)/);
  assert.match(routeSource, /data-walk-map-template-picker/);
  assert.match(routeSource, /templateId/);
  assert.match(routeSource, /listMunicipalWalkMapTemplatesV0/);
  assert.match(routeSource, /listMunicipalWalkMapSourceCatalogV0/);
  assert.match(routeSource, /buildMunicipalWalkMapConfigFromTemplateV0/);
  assert.match(routeSource, /routeStops: routeStops/);
  assert.match(routeSource, /routeFlexibility/);
  assert.match(routeSource, /mobilityModes/);
  assert.match(routeSource, /returnCues/);
  assert.match(routeSource, /sourceReferences/);
  assert.match(routeSource, /wmSourceReferences/);
  assert.match(routeSource, /registrationKind/);
  assert.match(routeSource, /creatorId/);
  assert.match(routeSource, /commercialIntent/);
  assert.match(routeSource, /data-walk-map-creator-select/);
  assert.match(routeSource, /creatorRegistryPick/);
  assert.match(routeSource, /data-display-name/);
  assert.match(routeSource, /selectedOptions/);
  assert.match(routeSource, /作成者一覧を読み込めませんでした/);
  assert.match(routeSource, /data-walk-map-creator-form/);
  assert.match(routeSource, /wmCreatorPayload/);
  assert.match(routeSource, /fetch\(endpoint/);
  assert.match(routeSource, /credentials: "same-origin"/);
  assert.match(routeSource, /学校、私有地、未確認の場所は公開前に止まります/);
});

test("municipal walk map public index renders static samples while DB index gate is off", async () => {
  await withEnv({ DATABASE_URL: undefined, IKIMON_ENABLE_DB_WALK_MAP_INDEX: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/walk-maps",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /公開範囲で歩ける散策ルート/);
      assert.match(response.body, /身近な自然を歩く散策マップ/);
      assert.match(response.body, /麻機の水辺を歩くサンプル/);
      assert.match(response.body, /引用元 2件/);
      assert.match(response.body, /href="\/ja\/walk-maps\/jp-shizuoka-asahata-waterfront-sample-v0/);
      const bannedPublicCopy = new RegExp(["見" + "返せる", "貢" + "献", "少し" + "厚"].join("|"));
      assert.doesNotMatch(response.body, bannedPublicCopy);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map public list API returns static summaries while DB index gate is off", async () => {
  await withEnv({ DATABASE_URL: undefined, IKIMON_ENABLE_DB_WALK_MAP_INDEX: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/municipal-walk-maps",
      });

      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.ok, true);
      assert.equal(body.source, "static");
      assert.ok(body.summaries.length >= 3);
      assert.match(JSON.stringify(body.summaries), /jp-shizuoka-asahata-waterfront-sample-v0/);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map public preview renders static sample without DB or internal tokens", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/walk-maps/jp-shizuoka-light-nature-walk-v0",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /身近な自然を歩く散策マップ/);
      assert.match(response.body, /公開プレビュー/);
      assert.match(response.body, /散策案内/);
      assert.match(response.body, /公開範囲で使う/);
      assert.match(response.body, /移動手段/);
      assert.match(response.body, /徒歩 \/ 自転車 \/ 公共交通/);
      assert.match(response.body, /引用元/);
      assert.match(response.body, /静岡市 いきもの散策マップ/);
      assert.match(response.body, /PDF本文や図版は転載していません/);
      assert.match(response.body, /context=municipal_walk_map/);
      assert.match(response.body, /walkMapId=jp-shizuoka-light-nature-walk-v0/);
      assert.match(response.body, /stopId=public-park-start/);
      assert.doesNotMatch(response.body, /public_preview/);
      assert.doesNotMatch(response.body, /school_stop_requires_permission/);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map admin page requires an admin session before DB access", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/admin/municipal-walk-maps",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 403);
      assert.match(response.body, /散策マップ管理/);
      assert.match(response.body, /ログインへ/);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map creator admin page requires an admin session before DB access", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/admin/municipal-walk-map-creators",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 403);
      assert.match(response.body, /散策マップ管理/);
      assert.match(response.body, /ログインへ/);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map admin API rejects malformed config before touching DB", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/admin/municipal-walk-maps",
          headers: {
            "content-type": "application/json",
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            config: {
              schemaVersion: "municipal_walk_map_config/v0",
              walkMapId: "broken",
              municipality: "テスト市",
              creatorName: "テスト市",
              title: "壊れた散策マップ",
              theme: "bad-theme",
              publishMode: "public",
              routeStops: "not-an-array",
              recordModes: "photo",
              publicPrecisionPolicy: "bad-policy",
            },
          },
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.json().error, /invalid_walk_map/);
        assert.match(response.json().error, /invalid_theme/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map creator API rejects malformed creator before touching DB", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/admin/municipal-walk-map-creators",
          headers: {
            "content-type": "application/json",
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            creator: {
              schemaVersion: "municipal_walk_map_creator/v0",
              creatorId: "bad",
              displayName: "",
              registrationKind: "individual",
              verificationStatus: "verified",
              commercialIntent: "primary",
            },
          },
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.json().error, /invalid_walk_map_creator/);
        assert.match(response.json().error, /invalid_creator_id/);
        assert.match(response.json().error, /commercial_primary_creator_cannot_be_verified/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map template API returns MECE templates with privileged write key", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/admin/municipal-walk-map-templates",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.ok, true);
        assert.deepEqual(
          body.templates.map((template: { templateId: string }) => template.templateId),
          [
            "habitat_micro_walk",
            "route_species_walk",
            "stewardship_manners_walk",
            "seasonal_target_walk",
            "citizen_campaign_walk",
            "worksheet_family_walk",
          ],
        );
        assert.match(JSON.stringify(body.templates), /静岡市 いきもの散策マップ/);
        assert.match(JSON.stringify(body.templates), /https:\/\/www\.city\.shizuoka\.lg\.jp\/s6347\/s001494\.html/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map source catalog API returns researched official source patterns", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/admin/municipal-walk-map-source-catalog",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.ok, true);
        assert.ok(body.sources.length >= 1);
        assert.match(JSON.stringify(body.sources), /静岡市/);
        assert.match(JSON.stringify(body.sources), /https:\/\/www\.city\.shizuoka\.lg\.jp/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map migration persists maps stops and audit records", async () => {
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0123_municipal_walk_maps.sql"), "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_maps/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_map_creators/);
  assert.match(migration, /creator_id TEXT PRIMARY KEY/);
  assert.match(migration, /creator_profile JSONB NOT NULL/);
  assert.match(migration, /route_flexibility JSONB NOT NULL/);
  assert.match(migration, /source_references JSONB NOT NULL/);
  assert.match(migration, /jp-shizuoka-yatsuyama-sample-v0/);
  assert.match(migration, /jp-shizuoka-asahata-waterfront-sample-v0/);
  assert.match(migration, /jp-shizuoka-maruko-river-sample-v0/);
  assert.match(migration, /https:\/\/www\.city\.shizuoka\.lg\.jp\/s6347\/s001494\.html/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_map_stops/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_map_audit/);
  assert.match(migration, /CHECK \(access IN \('public_access', 'permission_required', 'private_or_restricted', 'unknown'\)\)/);
  assert.match(migration, /linked_field_id TEXT/);
  assert.match(migration, /internal_memo TEXT/);
  assert.match(migration, /idx_municipal_walk_map_stops_walk_order/);
});

test("municipal walk map DB service writes parent stops and audit in one transaction", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "municipalWalkMap.ts"), "utf8");

  assert.match(source, /export async function upsertMunicipalWalkMapConfigV0/);
  assert.match(source, /await client\.query\("BEGIN"\)/);
  assert.match(source, /INSERT INTO municipal_walk_maps/);
  assert.match(source, /export async function upsertMunicipalWalkMapCreatorV0/);
  assert.match(source, /INSERT INTO municipal_walk_map_creators/);
  assert.match(source, /export function applyRegisteredCreatorProfileForWriteV0/);
  assert.match(source, /registered_creator_not_found/);
  assert.match(source, /creator_profile/);
  assert.match(source, /route_flexibility/);
  assert.match(source, /source_references/);
  assert.match(source, /DELETE FROM municipal_walk_map_stops WHERE walk_map_id = \$1/);
  assert.match(source, /INSERT INTO municipal_walk_map_stops/);
  assert.match(source, /INSERT INTO municipal_walk_map_audit/);
  assert.match(source, /await client\.query\("COMMIT"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
});
