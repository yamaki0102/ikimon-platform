import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildApp } from "../app.js";
import {
  buildMunicipalWalkMapConfigFromSourceCatalogV0,
  getStaticMunicipalWalkMapConfigV0,
} from "../services/municipalWalkMap.js";

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
  assert.match(routeSource, /\/admin\/municipal-walk-map-reviews/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-creators/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-reviews/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-reviews\/:walkMapId\/actions/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-templates/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-map-source-catalog/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps\/preview/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/api\/v1\/municipal-walk-maps"/);
  assert.match(routeSource, /\/walk-map-source-drafts\/:sourceId/);
  assert.match(routeSource, /\/walk-maps\/:walkMapId/);
  assert.match(routeSource, /\/walk-maps"/);
  assert.match(routeSource, /renderWalkMapIndexBody/);
  assert.match(routeSource, /renderReviewQueueBody/);
  assert.match(routeSource, /reviewMunicipalWalkMapPublicationV0/);
  assert.match(routeSource, /IKIMON_ENABLE_DB_WALK_MAP_INDEX/);
  assert.match(routeSource, /listPublicMunicipalWalkMapSummariesV0/);
  assert.match(routeSource, /listStaticMunicipalWalkMapPublicSummariesV0/);
  assert.match(routeSource, /assertMunicipalWalkMapAdminAccess/);
  assert.match(routeSource, /isAdminOrAnalystRole/);
  assert.match(routeSource, /assertPrivilegedWriteAccess/);
  assert.match(routeSource, /!options\.allowDraft && !isPublicDbVisible\(dbConfig\)/);
  assert.match(routeSource, /isPublicStaticVisible\(staticConfig\)/);
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
  assert.match(routeSource, /data-template-source-count/);
  assert.match(routeSource, /data-template-start-link/);
  assert.match(routeSource, /この型で始める/);
  assert.match(routeSource, /matchingSources\.length/);
  assert.match(routeSource, /mobilityText\(mode, "ja"\)/);
  assert.match(routeSource, /templateId/);
  assert.match(routeSource, /listMunicipalWalkMapTemplatesV0/);
  assert.match(routeSource, /listMunicipalWalkMapSourceCatalogV0/);
  assert.match(routeSource, /buildMunicipalWalkMapConfigFromSourceCatalogV0/);
  assert.match(routeSource, /renderSourceCatalogPanel/);
  assert.match(routeSource, /data-walk-map-source-catalog/);
  assert.match(routeSource, /data-source-template-id/);
  assert.match(routeSource, /sourceId/);
  assert.match(routeSource, /source_catalog/);
  assert.match(routeSource, /下書きに入れる/);
  assert.match(routeSource, /data-add-source-reference/);
  assert.match(routeSource, /data-source-label/);
  assert.match(routeSource, /textarea\[name='sourceReferences'\]/);
  assert.match(routeSource, /current\.indexOf\(url\) >= 0/);
  assert.match(routeSource, /field\.value = current \? current \+ "\\\\n" \+ line : line/);
  assert.match(routeSource, /引用元へ/);
  assert.match(routeSource, /公式ページを開く/);
  assert.match(routeSource, /primaryTypeLabel/);
  assert.match(routeSource, /sourceCatalog = listMunicipalWalkMapSourceCatalogV0\(\{ templateId: selectedTemplateId \|\| undefined \}\)/);
  assert.match(routeSource, /buildMunicipalWalkMapConfigFromTemplateV0/);
  assert.match(routeSource, /routeStops: routeStops/);
  assert.match(routeSource, /routeFlexibility/);
  assert.match(routeSource, /mobilityModes/);
  assert.match(routeSource, /returnCues/);
  assert.match(routeSource, /sourceReferences/);
  assert.match(routeSource, /publicationReview/);
  assert.match(routeSource, /publicAccessAttested/);
  assert.match(routeSource, /sourceRightsAttested/);
  assert.match(routeSource, /emergencyHidden/);
  assert.match(routeSource, /wmSourceReferences/);
  assert.match(routeSource, /SensitiveContext/);
  assert.match(routeSource, /sensitiveContext/);
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
  assert.match(routeSource, /data-walk-map-draft-json/);
  assert.match(routeSource, /data-walk-map-refresh-draft-json/);
  assert.match(routeSource, /data-walk-map-import-draft-json/);
  assert.match(routeSource, /data-walk-map-copy-draft-json/);
  assert.match(routeSource, /data-walk-map-preview-draft/);
  assert.match(routeSource, /data-walk-map-stops/);
  assert.match(routeSource, /data-walk-map-add-stop/);
  assert.match(routeSource, /data-walk-map-remove-stop/);
  assert.match(routeSource, /function wmVisibleStopIndexes\(form\)/);
  assert.match(routeSource, /wmEnsureStopSections\(form, stops\.length\)/);
  assert.match(routeSource, /Math\.max\(3, config\.routeStops\.length\)/);
  assert.match(routeSource, /function wmDraftJsonText\(form\)/);
  assert.match(routeSource, /function wmApplyDraftPayload\(form, payload\)/);
  assert.match(routeSource, /wmSetField\(form, "walkMapId", payload\.walkMapId \|\| ""\)/);
  assert.match(routeSource, /wmSetChecked\(form, "publicAccessAttested", review\.publicAccessAttested\)/);
  assert.match(routeSource, /prefix \+ "NoticeCues"/);
  assert.match(routeSource, /JSON\.stringify\(wmPayload\(form\), null, 2\)/);
  assert.match(routeSource, /JSON\.parse\(text\)/);
  assert.match(routeSource, /navigator\.clipboard\.writeText/);
  assert.match(routeSource, /\/api\/v1\/admin\/municipal-walk-maps\/preview/);
  assert.match(routeSource, /URL\.createObjectURL/);
  assert.match(routeSource, /window\.open\(blobUrl/);
  assert.match(routeSource, /公式PDFの本文や図版は入れず/);
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
      assert.match(response.body, /八ツ山周辺を歩くサンプル/);
      assert.match(response.body, /麻機の水辺を歩くサンプル/);
      assert.match(response.body, /引用元 2件/);
      assert.match(response.body, /href="\/ja\/walk-maps\/jp-shizuoka-asahata-waterfront-sample-v0/);
      assert.doesNotMatch(response.body, /jp-shizuoka-light-nature-walk-v0/);
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

test("municipal walk map public list API can scope candidates by map center", async () => {
  await withEnv({ DATABASE_URL: undefined, IKIMON_ENABLE_DB_WALK_MAP_INDEX: undefined }, async () => {
    const app = buildApp();
    try {
      const shizuoka = await app.inject({
        method: "GET",
        url: "/api/v1/municipal-walk-maps?lat=34.975&lng=138.383&limit=2",
      });
      assert.equal(shizuoka.statusCode, 200);
      const shizuokaBody = shizuoka.json();
      assert.equal(shizuokaBody.ok, true);
      assert.equal(shizuokaBody.locationFiltered, true);
      assert.equal(shizuokaBody.matchedMunicipalityCode, "22100");
      assert.equal(shizuokaBody.summaries.length, 2);
      assert.match(JSON.stringify(shizuokaBody.summaries), /jp-shizuoka-/);

      const tokyo = await app.inject({
        method: "GET",
        url: "/api/v1/municipal-walk-maps?lat=35.681&lng=139.767&limit=2",
      });
      assert.equal(tokyo.statusCode, 200);
      const tokyoBody = tokyo.json();
      assert.equal(tokyoBody.locationFiltered, true);
      assert.equal(tokyoBody.matchedMunicipalityCode, null);
      assert.deepEqual(tokyoBody.summaries, []);
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
        url: "/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /麻機の水辺を歩くサンプル/);
      assert.match(response.body, /公開プレビュー/);
      assert.match(response.body, /散策案内/);
      assert.match(response.body, /公開された道の近くで/);
      assert.match(response.body, /移動手段/);
      assert.match(response.body, /徒歩 \/ 自転車 \/ 公共交通/);
      assert.match(response.body, /場所の出し方/);
      assert.match(response.body, /正確な立入地点は、この画面では出しません。/);
      assert.match(response.body, /公開粒度/);
      assert.match(response.body, /学校・私有地は許可と公開範囲を先に確認する/);
      assert.match(response.body, /引用元/);
      assert.match(response.body, /歩くときの優先/);
      assert.match(response.body, /立ち寄り先をゆるく選ぶための案内/);
      assert.match(response.body, /現地の状況を優先してください/);
      assert.match(response.body, /静岡市 いきもの散策マップ/);
      assert.match(response.body, /PDF本文や図版は転載していません/);
      assert.match(response.body, /context=municipal_walk_map/);
      assert.match(response.body, /walkMapId=jp-shizuoka-asahata-waterfront-sample-v0/);
      assert.match(response.body, /stopId=asahata-water-edge/);
      assert.doesNotMatch(response.body, /public_preview/);
      assert.doesNotMatch(response.body, /municipal_walk_map_location_safety/);
      assert.doesNotMatch(response.body, /school_stop_requires_permission/);
    } finally {
      await app.close();
    }
  });
});

test("municipal walk map source draft review renders Shizuoka draft without admin session", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/walk-map-source-drafts/shizuoka-ikimono-walk-route",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /静岡市 いきもの散策マップ 下書き/);
      assert.match(response.body, /source_draft_review/);
      assert.match(response.body, /6\. 公園の開けた場所/);
      assert.match(response.body, /asahata2024-map\.pdf/);
      assert.match(response.body, /yatsuyama-map\.pdf/);
      assert.match(response.body, /000980916\.pdf/);
      assert.match(response.body, /許可と公開範囲が確認できるまで記録ボタンは出しません/);
      assert.doesNotMatch(response.body, /\/admin\/municipal-walk-maps/);
      assert.doesNotMatch(response.body, /内部メモ/);
      assert.doesNotMatch(response.body, /見返|読み返|少し厚|貢献|順番通り|育つ場所/);
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

test("municipal walk map admin page renders source catalog and source-reference action", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      ENABLE_DEV_DUMMY_ADMIN: "1",
      DEV_DUMMY_ADMIN_TOKEN: "test-admin-token",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/admin/municipal-walk-maps?templateId=route_species_walk",
          headers: {
            accept: "text/html",
            cookie: "ikimon_v2_session=test-admin-token",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /参考元カタログ/);
        assert.match(response.body, /data-template-source-count="4"/);
        assert.match(response.body, /data-template-start-link="\/admin\/municipal-walk-maps\?templateId=route_species_walk"/);
        assert.match(response.body, /この型で始める/);
        assert.match(response.body, /徒歩 \/ 自転車 \/ 公共交通/);
        assert.match(response.body, /自然散策マップ/);
        assert.match(response.body, /data-walk-map-publication-gate/);
        assert.match(response.body, /自治体・登録団体・登録会社の確認済み登録だけが公開できます/);
        assert.match(response.body, /商業主目的は公開不可/);
        assert.match(response.body, /公開承認者と日付が入るまで公開モードでは保存できません/);
        assert.match(response.body, /\/admin\/municipal-walk-map-reviews/);
        assert.match(response.body, /data-walk-map-source-catalog/);
        assert.match(response.body, /data-add-source-reference/);
        assert.match(response.body, /\/admin\/municipal-walk-maps\?sourceId=funabashi-nature-walk-maps/);
        assert.match(response.body, /下書きに入れる/);
        assert.match(response.body, /引用元へ/);
        assert.match(response.body, /公式ページを開く/);
        assert.match(response.body, /textarea name="sourceReferences"/);
        assert.match(response.body, /name="publicAccessAttested"/);
        assert.match(response.body, /name="sourceRightsAttested"/);
        assert.match(response.body, /name="emergencyHidden"/);
        assert.match(response.body, /PDF本文・図版・写真を転載していない/);
        assert.match(response.body, /船橋市/);
        assert.match(response.body, /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p035951\.html/);
        assert.doesNotMatch(response.body, /世田谷区/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map admin page can prefill a draft from a source catalog entry", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      ENABLE_DEV_DUMMY_ADMIN: "1",
      DEV_DUMMY_ADMIN_TOKEN: "test-admin-token",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/admin/municipal-walk-maps?sourceId=funabashi-nature-walk-maps",
          headers: {
            accept: "text/html",
            cookie: "ikimon_v2_session=test-admin-token",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /data-source="source_catalog"/);
        assert.match(response.body, /name="walkMapId" value="draft-funabashi-nature-walk-maps"/);
        assert.match(response.body, /name="municipality" value="船橋市"/);
        assert.match(response.body, /name="creatorName" value="船橋市"/);
        assert.match(response.body, /自然散策マップ 下書き/);
        assert.match(response.body, /公式ページを引用元/);
        assert.match(response.body, /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p035951\.html/);
        assert.match(response.body, /PDF本文、図版、写真は転載しません/);
        assert.match(response.body, /wm-admin-source-card is-selected/);
        assert.match(response.body, /name="publishMode"/);
        assert.match(response.body, /value="draft" selected/);
        assert.match(response.body, /下書きJSON/);
        assert.match(response.body, /data-walk-map-draft-json/);
        assert.match(response.body, /JSONを作る/);
        assert.match(response.body, /JSONを読み込む/);
        assert.match(response.body, /保存せずプレビュー/);
        assert.match(response.body, /コピー/);
        assert.match(response.body, /DBに保存する前に/);
        assert.doesNotMatch(response.body, /data-walk-map-draft-json readonly/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map admin page renders Shizuoka source draft with multiple stops", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      ENABLE_DEV_DUMMY_ADMIN: "1",
      DEV_DUMMY_ADMIN_TOKEN: "test-admin-token",
    },
    async () => {
      const app = buildApp();
      try {
        const response = await app.inject({
          method: "GET",
          url: "/admin/municipal-walk-maps?sourceId=shizuoka-ikimono-walk-route",
          headers: {
            accept: "text/html",
            cookie: "ikimon_v2_session=test-admin-token",
          },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.body, /name="walkMapId" value="draft-shizuoka-ikimono-walk-route"/);
        assert.match(response.body, /静岡市 いきもの散策マップ 下書き/);
        assert.match(response.body, /立ち寄り先 6/);
        assert.match(response.body, /name="stop5Title"/);
        assert.match(response.body, /yatsuyama-map\.pdf/);
        assert.match(response.body, /asahata2024-map\.pdf/);
        assert.match(response.body, /000980916\.pdf/);
        assert.match(response.body, /data-walk-map-add-stop/);
        assert.match(response.body, /data-walk-map-remove-stop/);
        assert.doesNotMatch(response.body, /見返|読み返|少し厚|貢献|順番通り|育つ場所/);
      } finally {
        await app.close();
      }
    },
  );
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

test("municipal walk map review queue page requires an admin session before DB access", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/admin/municipal-walk-map-reviews",
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

test("municipal walk map review action API requires admin access before DB access", async () => {
  await withEnv({ DATABASE_URL: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/municipal-walk-map-reviews/test-map/actions",
        headers: { "content-type": "application/json" },
        payload: { action: "approve_public_preview" },
      });

      assert.equal(response.statusCode, 503);
      assert.match(response.body, /privileged_write_api_key_not_configured/);
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

test("municipal walk map admin API rejects public save from unverified creator before touching DB", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const config = getStaticMunicipalWalkMapConfigV0("jp-shizuoka-asahata-waterfront-sample-v0");
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/admin/municipal-walk-maps",
          headers: {
            "content-type": "application/json",
            "x-ikimon-write-key": "test-write-key",
          },
          payload: {
            config: {
              ...config,
              publishMode: "public",
              creatorProfile: {
                creatorId: "group:unverified-walk-team",
                registrationKind: "registered_group",
                verificationStatus: "pending",
                commercialIntent: "none",
              },
              publicationReview: {
                publicAccessAttested: true,
                sourceRightsAttested: true,
                permissionAttestedBy: "test",
                permissionAttestedAt: "2026-06-24",
                publishApprovedByUserId: "admin-user",
                publishApprovedAt: "2026-06-24",
                emergencyHidden: false,
                takedownReason: null,
              },
            },
          },
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.json().error, /public_publish_requires_verified_creator/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map admin preview API renders public HTML without touching DB", async () => {
  await withEnv(
    {
      DATABASE_URL: undefined,
      V2_PRIVILEGED_WRITE_API_KEY: "test-write-key",
    },
    async () => {
      const app = buildApp();
      try {
        const config = buildMunicipalWalkMapConfigFromSourceCatalogV0("funabashi-nature-walk-maps");
        config.routeStops[0]!.internalMemo = "internal memo must stay out of the preview html";
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/admin/municipal-walk-maps/preview",
          headers: {
            "content-type": "application/json",
            "x-ikimon-write-key": "test-write-key",
          },
          payload: { config },
        });

        assert.equal(response.statusCode, 200);
        assert.match(response.headers["content-type"] as string, /text\/html/);
        assert.match(response.body, /自然散策マップ 下書き/);
        assert.match(response.body, /admin_draft/);
        assert.match(response.body, /歩くときの優先/);
        assert.match(response.body, /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p035951\.html/);
        assert.doesNotMatch(response.body, /internal memo must stay out/);
        assert.doesNotMatch(response.body, /"ok":true/);
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
        assert.ok(body.sources.length >= 21);
        assert.match(JSON.stringify(body.sources), /静岡市/);
        assert.match(JSON.stringify(body.sources), /https:\/\/www\.city\.shizuoka\.lg\.jp/);
        assert.match(JSON.stringify(body.sources), /船橋市/);
        assert.match(JSON.stringify(body.sources), /https:\/\/www\.city\.funabashi\.lg\.jp\/machi\/kankyou\/010\/p035951\.html/);
        assert.match(JSON.stringify(body.sources), /世田谷区/);
        assert.match(JSON.stringify(body.sources), /https:\/\/www\.city\.setagaya\.lg\.jp\/02074\/4717\.html/);
      } finally {
        await app.close();
      }
    },
  );
});

test("municipal walk map source catalog API filters by template id", async () => {
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
          url: "/api/v1/admin/municipal-walk-map-source-catalog?templateId=route_species_walk",
          headers: {
            "x-ikimon-write-key": "test-write-key",
          },
        });

        assert.equal(response.statusCode, 200);
        const body = response.json();
        assert.equal(body.ok, true);
        assert.ok(body.sources.length >= 4);
        assert.ok(body.sources.every((source: { templateId: string }) => source.templateId === "route_species_walk"));
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
  assert.match(migration, /publication_review JSONB NOT NULL/);
  assert.match(migration, /jp-shizuoka-yatsuyama-sample-v0/);
  assert.match(migration, /jp-shizuoka-asahata-waterfront-sample-v0/);
  assert.match(migration, /jp-shizuoka-mariko-waterfront-sample-v0/);
  assert.match(migration, /https:\/\/www\.city\.shizuoka\.lg\.jp\/s6347\/s001494\.html/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_map_stops/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS municipal_walk_map_audit/);
  assert.match(migration, /CHECK \(access IN \('public_access', 'permission_required', 'private_or_restricted', 'unknown'\)\)/);
  assert.match(migration, /sensitive_context TEXT NOT NULL DEFAULT 'none'/);
  assert.match(migration, /CHECK \(sensitive_context IN \('none', 'school_or_minor', 'private_edge', 'rare_species'\)\)/);
  assert.match(migration, /linked_field_id TEXT/);
  assert.match(migration, /internal_memo TEXT/);
  assert.match(migration, /idx_municipal_walk_map_stops_walk_order/);
  assert.match(migration, /publicAccessAttested/);
  assert.match(migration, /sourceRightsAttested/);
  assert.match(migration, /publishApprovedByUserId/);
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
  assert.match(source, /publication_review/);
  assert.match(source, /DELETE FROM municipal_walk_map_stops WHERE walk_map_id = \$1/);
  assert.match(source, /INSERT INTO municipal_walk_map_stops/);
  assert.match(source, /INSERT INTO municipal_walk_map_audit/);
  assert.match(source, /await client\.query\("COMMIT"\)/);
  assert.match(source, /await client\.query\("ROLLBACK"\)/);
});
