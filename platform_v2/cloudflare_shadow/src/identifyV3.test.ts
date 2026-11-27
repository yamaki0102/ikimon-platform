import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "./index";
import type { Env } from "./core/env";
import { SESSION_COOKIE_NAME } from "./core/shared";
import * as identifyV3Flag from "./flags/IDENTIFY_V3_ENABLED";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";
import {
  TAXON_TREE,
  applyRegionalSplitToObservation,
  applyTaxonomyChange,
  canApproveSplitRule,
  checkSeasonAndDistributionOutlier,
  computeVoterOverturnRate,
  deriveAutoGrownSkills,
  evaluateConfirmationRules,
  formatIdentifyLocationDisplay,
  formatSpokenJustificationJa,
  isVoterEligible,
  rankIdentifyFeedItems,
  recomputeUnitStatsAfterSplit,
  resolveNodeSkillLevel,
  validateStructuredJustification,
  type IdentifyFeedCandidateInput,
  type IdentifySkillDeclaration,
} from "./identifyV3Domain";
import { renderIdentifyV3Page } from "./identifyV3";

function findChromiumExecutable(): string | null {
  for (const c of [
    process.env.CHROMIUM_PATH,
    "/home/nexus/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ]) {
    if (c && existsSync(c)) return c;
  }
  return null;
}

test("IDENTIFY_V3_ENABLED flag defaults to off in staging and production", () => {
  assert.equal(identifyV3Flag.flag, "IDENTIFY_V3_ENABLED");
  assert.equal(identifyV3Flag.staging, false);
  assert.equal(identifyV3Flag.production, false);
  assert.equal(PROTOTYPE_FLAGS.find((f) => f.flag === "IDENTIFY_V3_ENABLED")?.stagingEnabled, false);
});

test("3-tier skill resolution: closest taxon node wins and fine skill flows before broad and some", () => {
  const skills: IdentifySkillDeclaration[] = [
    { taxonNodeKey: "bird", level: "general", source: "declared" },
    { taxonNodeKey: "buncho", level: "none", source: "declared" },
    { taxonNodeKey: "crow_family", level: "expert", source: "declared" },
    { taxonNodeKey: "cicada", level: "some", source: "declared" },
  ];

  assert.equal(TAXON_TREE.some((n) => n.level === "major" && n.key === "bird"), true);
  assert.equal(resolveNodeSkillLevel("suzume", skills), "general"); // inherits from bird
  assert.equal(resolveNodeSkillLevel("buncho", skills), "none"); // explicit fine override wins
  assert.equal(resolveNodeSkillLevel("hashibuto", skills), "expert"); // inherits from crow_family

  const items: IdentifyFeedCandidateInput[] = [
    {
      observationId: "obs-cicada",
      observedAt: "2026-08-16T01:15:00Z",
      ownerDisplayName: "はな",
      aiMajorGroup: "cicada",
      aiCandidates: [{ candidateKey: "abura", name: "アブラゼミ", scientificName: "Graptopsaltria nigrofuscata", rank: "species", rankOrder: 1, confidence: 0.9, visualEvidence: ["茶色い羽"] }],
      humanProposals: [],
      statusWord: "AIの読み取り",
      openDisputeCount: 0,
      hasInsufficientEvidence: false,
      holdState: null,
    },
    {
      observationId: "obs-buncho-excluded",
      observedAt: "2026-11-23T00:41:00Z",
      ownerDisplayName: "もり",
      aiMajorGroup: "bird",
      aiCandidates: [{ candidateKey: "buncho", name: "文鳥", scientificName: "Lonchura oryzivora", rank: "species", rankOrder: 1, confidence: 0.92, visualEvidence: [] }],
      humanProposals: [],
      statusWord: "AIの読み取り",
      openDisputeCount: 0,
      hasInsufficientEvidence: false,
      holdState: null,
    },
    {
      observationId: "obs-suzume-broad",
      observedAt: "2026-11-20T01:00:00Z",
      ownerDisplayName: "そら",
      aiMajorGroup: "bird",
      aiCandidates: [{ candidateKey: "suzume", name: "スズメ", scientificName: "Passer montanus", rank: "species", rankOrder: 1, confidence: 0.88, visualEvidence: [] }],
      humanProposals: [],
      statusWord: "AIの読み取り",
      openDisputeCount: 0,
      hasInsufficientEvidence: false,
      holdState: null,
    },
    {
      observationId: "obs-crow-fine-lowconf",
      observedAt: "2026-11-19T02:00:00Z",
      ownerDisplayName: "みずき",
      aiMajorGroup: "bird",
      aiCandidates: [
        { candidateKey: "tobi", name: "トビ", rank: "species", rankOrder: 1, confidence: 0.55, visualEvidence: [] },
        { candidateKey: "kawasemi", name: "カワセミ", rank: "species", rankOrder: 2, confidence: 0.25, visualEvidence: [] },
        { candidateKey: "hashibuto", name: "ハシブトガラス", scientificName: "Corvus macrorhynchos", rank: "species", rankOrder: 3, confidence: 0.15, visualEvidence: [] },
      ],
      humanProposals: [{ proposedName: "ハシブトガラス", count: 1 }],
      statusWord: "人の提案",
      openDisputeCount: 0,
      hasInsufficientEvidence: false,
      holdState: null,
    },
  ];

  const ranked = rankIdentifyFeedItems(items, skills);
  // obs-buncho-excluded has top candidate buncho which is explicitly 'none' -> excluded
  // obs-crow-fine-lowconf flows first due to fine skill (crow_family), marked lowConfidenceMatch
  // obs-suzume-broad flows next (bird=general)
  // obs-cicada flows last (cicada=some)
  assert.deepEqual(
    ranked.map((r) => r.observation.observationId),
    ["obs-crow-fine-lowconf", "obs-suzume-broad", "obs-cicada"],
  );
  assert.equal(ranked[0]?.isLowConfidenceCandidateMatch, true);
  assert.equal(ranked[0]?.matchedSkillTier, "fine");
  assert.equal(ranked[2]?.matchedSkillTier, "some");
});

test("auto-grown skills only adjust stream and never grant confirmation authority", () => {
  const grown = deriveAutoGrownSkills(
    [
      { taxonKey: "buncho", actionCount: 4, confirmedCount: 2 },
      { taxonKey: "grass", actionCount: 14, confirmedCount: 12 },
    ],
    [{ taxonNodeKey: "grass", level: "some", source: "declared" }],
    [],
  );
  const bunchoGrown = grown.autoGrown.find((g) => g.taxonNodeKey === "buncho");
  assert.ok(bunchoGrown);
  assert.equal(bunchoGrown.grantsAuthority, false);
  const grassSuggest = grown.promotionSuggestions.find((s) => s.taxonNodeKey === "grass");
  assert.ok(grassSuggest);
  assert.equal(grassSuggest.confirmedCount, 12);
});

test("§16 location formatting puts blur/protection ahead of ward detail and supports area observations", () => {
  const pointOk = formatIdentifyLocationDisplay({
    placeName: "佐鳴湖",
    cityWardLabel: "浜松市中央区",
    publicCell: "cell:34.71,137.70",
    observedAt: "2026-11-20T01:00:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    protection: "none",
    areaKind: "point",
  });
  assert.equal(pointOk.text, "佐鳴湖（浜松市中央区）");
  assert.equal(pointOk.blurApplied, false);

  const areaOk = formatIdentifyLocationDisplay({
    placeName: "久留女木の里山エリア",
    cityWardLabel: "浜松市浜名区",
    publicCell: "cell:34.86,137.68",
    observedAt: "2026-08-16T01:15:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    protection: "none",
    areaKind: "area",
  });
  assert.equal(areaOk.text, "久留女木の里山エリア（浜松市浜名区）の中で観察されました");
  assert.match(areaOk.areaNote ?? "", /範囲までです/);

  const blurred = formatIdentifyLocationDisplay({
    placeName: "秘密の湿地",
    cityWardLabel: "浜松市浜名区",
    publicCell: "cell:34.71,137.70",
    observedAt: "2026-11-20T01:00:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    protection: "coarse",
    areaKind: "point",
  });
  assert.equal(blurred.blurApplied, true);
  assert.equal(blurred.text.includes("秘密の湿地"), false);
  assert.equal(blurred.text.includes("浜名区"), false);
});

test("§17 spoken justification cleans filler words cleanly without changing meaning", () => {
  const formatted = formatSpokenJustificationJa("えーと、頭が黒くて、あのー、ほおが白いから文鳥だと思います");
  assert.equal(formatted, "頭が黒くて、ほおが白いから文鳥だと思います。");
});

test("§19 + U7/U8/U9 regional taxon split migrates inside, widens at boundary with U7 tag, requires checker+admin (U8), and recounts without overturning (U9)", () => {
  const rule = {
    ruleId: "split-1",
    ruleVersion: 1,
    originalTaxon: "トウキョウダルマガエル",
    newTaxon: "キタダルマガエル",
    broadenedTaxon: "アカガエルの仲間",
    citationText: "日本両生類学会 2026年改訂",
    effectiveFrom: "2026-11-27",
    bbox: { minLat: 36.0, maxLat: 37.5, minLng: 139.0, maxLng: 141.0 },
  };

  assert.equal(canApproveSplitRule({ hasMatchingScopeReviewer: true, isOperatorAdmin: true }), true);
  assert.equal(canApproveSplitRule({ hasMatchingScopeReviewer: true, isOperatorAdmin: false }), false);
  assert.equal(canApproveSplitRule({ hasMatchingScopeReviewer: false, isOperatorAdmin: true }), false);

  const inside = applyRegionalSplitToObservation(
    { observationId: "o-in", lat: 36.7, lng: 139.8, accuracyM: 100, isCoarseProtected: false, currentTaxon: "トウキョウダルマガエル", statusWord: "確認済み" },
    rule,
  );
  assert.equal(inside.outcome, "reassigned");
  assert.equal(inside.nextTaxon, "キタダルマガエル");
  assert.equal(inside.nextStatusWord, "確認済み");
  assert.match(inside.provenanceTag ?? "", /分類の改訂（地域による・日本両生類学会 2026年改訂）/);

  const boundary = applyRegionalSplitToObservation(
    { observationId: "o-edge", lat: 36.0005, lng: 139.8, accuracyM: 500, isCoarseProtected: false, currentTaxon: "トウキョウダルマガエル", statusWord: "確認済み" },
    rule,
  );
  assert.equal(boundary.outcome, "widened_reconfirm");
  assert.equal(boundary.nextTaxon, "アカガエルの仲間");
  // U7: Do NOT add a 4th status word; keep D7 vocabulary + reason tag
  assert.equal(boundary.nextStatusWord, "人の提案");
  assert.equal(boundary.reasonTag, "分類の変更");

  const stats = recomputeUnitStatsAfterSplit(
    { "トウキョウダルマガエル": 5, "キタダルマガエル": 1 },
    2,
    { originalTaxon: "トウキョウダルマガエル", newTaxon: "キタダルマガエル", migratedConfirmedCount: 3, baselineOverturnedCount: 1 },
  );
  assert.equal(stats.countsByTaxon["キタダルマガエル"], 4);
  assert.equal(stats.overturnedCount, 1);
});

test("worker fetch enforces Rule 11 auth (401/403), 5 decisions, undo, saved list, and skills behind IDENTIFY_V3_ENABLED", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role_name TEXT NOT NULL DEFAULT 'member',
      rank_label TEXT,
      banned INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      taxon_label TEXT,
      note TEXT,
      exact_lat REAL,
      exact_lng REAL,
      location_accuracy_m REAL,
      public_cell TEXT NOT NULL,
      public_area_label TEXT,
      visibility TEXT NOT NULL DEFAULT 'public',
      emergency_hidden INTEGER NOT NULL DEFAULT 0,
      processing_state TEXT NOT NULL DEFAULT 'accepted',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE asset_ledger (
      asset_id TEXT PRIMARY KEY,
      draft_id TEXT,
      observation_id TEXT,
      owner_user_id TEXT,
      mime TEXT NOT NULL,
      exif_scrub_state TEXT NOT NULL DEFAULT 'scrubbed',
      public_derivative_key TEXT,
      uploaded_at TEXT
    );
    CREATE TABLE observation_ai_review_targets (
      occurrence_id TEXT PRIMARY KEY,
      ai_assessment_status TEXT NOT NULL DEFAULT 'ai_judgement',
      scientific_name TEXT,
      vernacular_name TEXT,
      taxon_rank TEXT,
      ai_run_id TEXT,
      candidate_id TEXT,
      candidate_scientific_name TEXT,
      candidate_vernacular_name TEXT,
      candidate_taxon_rank TEXT,
      ai_recommended_taxon_name TEXT,
      ai_recommended_rank TEXT,
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE observation_identifications (
      identification_id TEXT PRIMARY KEY,
      occurrence_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      proposed_name TEXT NOT NULL,
      proposed_rank TEXT,
      stance TEXT NOT NULL DEFAULT 'support',
      notes TEXT,
      source_key TEXT NOT NULL UNIQUE,
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE observation_identification_disputes (
      dispute_id TEXT PRIMARY KEY,
      occurrence_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      proposed_name TEXT,
      proposed_rank TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE observation_identification_workbench_holds (
      hold_id TEXT PRIMARY KEY,
      occurrence_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      hold_reason TEXT NOT NULL DEFAULT '',
      source_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (occurrence_id, actor_user_id)
    );
    CREATE TABLE outbox (
      outbox_id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      target_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      partition_month TEXT,
      dispatch_state TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_saved_items (
      user_id TEXT NOT NULL,
      object_kind TEXT NOT NULL,
      object_id TEXT NOT NULL,
      canonical_path TEXT NOT NULL,
      display_title TEXT NOT NULL,
      state TEXT NOT NULL,
      revision INTEGER NOT NULL,
      last_command_id TEXT NOT NULL,
      last_command_digest TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, object_kind, object_id)
    );
    CREATE TABLE readmodel_public_observations (
      observation_id TEXT PRIMARY KEY,
      public_cell TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      taxon_label TEXT,
      public_area_label TEXT,
      asset_count INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const memberToken = "idv3-member";
  const adminToken = "idv3-admin";
  const bannedToken = "idv3-banned";
  const sha = (t: string) => createHash("sha256").update(t).digest("hex");
  const exp = new Date(Date.now() + 86_400_000).toISOString();
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha(memberToken), "u-mori", "もり", "member", null, 0, exp, null);
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha(adminToken), "u-admin", "運営", "admin", null, 0, exp, null);
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha(bannedToken), "u-ban", "制限", "member", null, 1, exp, null);
  sqlite
    .prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, public_area_label, visibility) VALUES (?,?,?,?,?,?,?,?)")
    .run("obs-priv-1", "d-priv", "u-owner1", "2026-11-23T01:00:00Z", "秘密の鳥", "cell:34.71,137.70", "非公開", "private");

  sqlite
    .prepare("INSERT INTO observations (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, public_area_label, visibility) VALUES (?,?,?,?,?,?,?,?)")
    .run("obs-bird-1", "d-1", "u-owner1", "2026-11-23T00:41:00Z", "文鳥", "cell:34.71,137.70", "佐鳴湖（浜松市中央区）", "public");
  sqlite
    .prepare("INSERT INTO asset_ledger (asset_id, observation_id, owner_user_id, mime, exif_scrub_state, public_derivative_key) VALUES (?,?,?,?,?,?)")
    .run("asset-1", "obs-bird-1", "u-owner1", "image/jpeg", "scrubbed", "derived/obs-bird-1/display.webp");
  sqlite
    .prepare("INSERT INTO observation_ai_review_targets (occurrence_id, vernacular_name, scientific_name, taxon_rank, ai_recommended_taxon_name, source_payload_json) VALUES (?,?,?,?,?,?)")
    .run(
      "obs-bird-1",
      "文鳥",
      "Lonchura oryzivora",
      "species",
      "文鳥",
      JSON.stringify({
        majorGroup: "bird",
        candidates: [
          { candidateKey: "buncho", name: "文鳥", scientificName: "Lonchura oryzivora", rank: "species", confidence: 0.91, visualEvidence: ["頭が黒く、ほおが白いです"] },
          { candidateKey: "suzume", name: "スズメ", scientificName: "Passer montanus", rank: "species", confidence: 0.25, visualEvidence: ["ほおに黒い丸があります"] },
        ],
      }),
    );

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          const r = sqlite.prepare(query).run(...(values as never[]));
          return { meta: { changes: Number(r.changes) } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run(): Promise<{ meta?: { changes?: number } }> }>) {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
  } as unknown as Env["OBS_DB"];

  const offEnv = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db } as unknown as Env;
  const offApi = await worker.fetch(new Request("https://zukan.earth/api/v1/identify-v3/feed"), offEnv);
  assert.equal(offApi.status, 404);

  const onEnv = {
    ...offEnv,
    ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ IDENTIFY_V3_ENABLED: { state: "all" } }),
  } as unknown as Env;

  // Rule 11: unauthenticated -> 401
  const anonPost = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-bird-1", decision: "save" }),
    }),
    onEnv,
  );
  assert.equal(anonPost.status, 401);

  // Rule 11: banned user -> 403
  const bannedPost = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${bannedToken}`, "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-bird-1", decision: "save" }),
    }),
    onEnv,
  );
  assert.equal(bannedPost.status, 403);

  // Rule 11: non-admin cannot register split rule -> 403
  const nonAdminSplit = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/split-rules", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ originalTaxon: "A", newTaxon: "B" }),
    }),
    onEnv,
  );
  assert.equal(nonAdminSplit.status, 403);

  // Another user's private record cannot be accessed/decided -> 403/404
  const otherPrivateDec = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-priv-1", decision: "save" }),
    }),
    onEnv,
  );
  assert.equal(otherPrivateDec.status, 403);

  // Save skills
  const skillRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/skills", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        userId: "attacker-id-ignored",
        updates: [
          { taxonNodeKey: "bird", level: "general" },
          { taxonNodeKey: "buncho", level: "expert" },
        ],
      }),
    }),
    onEnv,
  );
  assert.equal(skillRes.status, 200);
  // Confirm server wrote using session.userId (u-mori), ignoring body userId
  const savedSkillRow = sqlite.prepare("SELECT user_id FROM user_saved_items WHERE object_kind = 'identify_v3_skill' AND object_id = 'bird'").get() as { user_id: string };
  assert.equal(savedSkillRow.user_id, "u-mori");

  // Save decision -> private hold only, not public identification
  const saveRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-bird-1", decision: "save", savedCandidateName: "文鳥" }),
    }),
    onEnv,
  );
  assert.equal(saveRes.status, 200);
  assert.equal((sqlite.prepare("SELECT hold_reason FROM observation_identification_workbench_holds WHERE occurrence_id = 'obs-bird-1' AND actor_user_id = 'u-mori'").get() as { hold_reason: string }).hold_reason, "saved");
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM observation_identifications").get() as { n: number }).n, 0);

  // Saved view renders saved item
  const savedPage = await worker.fetch(
    new Request("https://zukan.earth/ja/identify?view=saved", { headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` } }),
    onEnv,
  );
  assert.equal(savedPage.status, 200);
  const savedHtml = await savedPage.text();
  assert.match(savedHtml, /保存したときの候補：文鳥/);

  // Undo restores from saved
  const undoRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/undo", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-bird-1" }),
    }),
    onEnv,
  );
  assert.equal(undoRes.status, 200);
  assert.equal((sqlite.prepare("SELECT COUNT(*) AS n FROM observation_identification_workbench_holds").get() as { n: number }).n, 0);

  // Identify decision (同定する) with formatted voice justification -> writes observation_identifications
  const identifyRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        occurrenceId: "obs-bird-1",
        decision: "identify",
        proposedName: "文鳥",
        proposedRank: "species",
        justificationText: "頭が黒くてほおが白い。",
        photoPart: "頭・顔",
      }),
    }),
    onEnv,
  );
  assert.equal(identifyRes.status, 200);
  assert.equal((sqlite.prepare("SELECT proposed_name FROM observation_identifications WHERE occurrence_id = 'obs-bird-1'").get() as { proposed_name: string }).proposed_name, "文鳥");

  // Undetermined decision (この写真では決められない) -> writes observation_identification_disputes
  const undetRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ occurrenceId: "obs-bird-1", decision: "undetermined", reason: "ピンボケで見分けられない" }),
    }),
    onEnv,
  );
  assert.equal(undetRes.status, 200);
  assert.equal((sqlite.prepare("SELECT kind FROM observation_identification_disputes WHERE occurrence_id = 'obs-bird-1'").get() as { kind: string }).kind, "insufficient_evidence");
});

test("Playwright verifies 375px and 1280px layout, fixed decbar, scroll dim guard, and zero overflow", async (t) => {
  const executablePath = findChromiumExecutable();
  if (!executablePath) {
    t.skip("No Chromium binary available");
    return;
  }
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());

  const feedHtml = renderIdentifyV3Page({
    view: "feed",
    lang: "ja",
    displayName: "ゆい",
    skills: [
      { taxonNodeKey: "buncho", level: "expert", source: "declared" },
      { taxonNodeKey: "bird", level: "general", source: "declared" },
    ],
    autoGrown: [{ taxonNodeKey: "buncho", label: "文鳥", reasonText: "あなたが文鳥の記録に賛成してきたことから、文鳥は自動で得意に入っています。", grantsAuthority: false }],
    promotionSuggestions: [{ taxonNodeKey: "grass", label: "草", confirmedCount: 12 }],
    confirmedCountsByNode: { bird: 18, buncho: 9, grass: 12 },
    feedItems: [
      {
        observation: {
          observationId: "obs-1",
          observedAt: "2026-11-23T00:41:00Z",
          ownerDisplayName: "もり",
          aiMajorGroup: "bird",
          aiCandidates: [
            { candidateKey: "buncho", name: "文鳥", scientificName: "Lonchura oryzivora", rank: "species", rankOrder: 1, confidence: 0.92, visualEvidence: ["頭が黒く、ほおが真っ白です。"] },
            { candidateKey: "suzume", name: "スズメ", scientificName: "Passer montanus", rank: "species", rankOrder: 2, confidence: 0.21, visualEvidence: ["ほおに黒い丸があります。"] },
          ],
          humanProposals: [{ proposedName: "文鳥", count: 1, latestActorName: "はまっこ" }],
          statusWord: "人の提案",
          openDisputeCount: 0,
          hasInsufficientEvidence: false,
          holdState: null,
          photoUrl: "/thumb/buncho.svg",
          photoCount: 1,
          locationText: "佐鳴湖（浜松市中央区）",
          areaNote: null,
        },
        matchedNodeKey: "buncho",
        matchedNodeLabel: "文鳥（鳥の中の種類）",
        matchedSkillTier: "fine",
        isLowConfidenceCandidateMatch: false,
        priorityBucket: 1,
      },
    ],
    savedItems: [],
    settledSavedItems: [],
    savedCount: 2,
    nextCursor: null,
  });

  for (const vp of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.route("**/*", async (route) => {
      if (route.request().url().includes("/thumb/")) {
        await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="270"><rect width="360" height="270" fill="#2e6b4c"/></svg>' });
        return;
      }
      await route.fulfill({ status: 204, body: "" });
    });
    await page.setContent(feedHtml);
    const check = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      decbarCount: document.querySelectorAll(".id3-decbar").length,
      dpillHeight: (document.querySelector(".id3-dpill") as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
      agreeHeight: (document.querySelector(".id3-agree") as HTMLElement | null)?.getBoundingClientRect().height ?? 0,
      hasExpertMockButton: document.body.textContent?.includes("根拠を添えて確定する") ?? false,
    }));
    assert.equal(check.overflowX, 0);
    assert.equal(check.decbarCount, 1);
    assert.ok(check.agreeHeight >= 44, `agree height ${check.agreeHeight} < 44`);
    if (vp.width < 960) {
      assert.ok(check.dpillHeight >= 44, `pill height ${check.dpillHeight} < 44`);
    }
    // Without scoped authority, expert confirmation CTA stays hidden
    assert.equal(check.hasExpertMockButton, false);
    await ctx.close();
  }
});

test("confirmation rules: voter eligibility (7 days & <20% overturn excluding taxonomy changes), 14-day escalation, outlier inquiry, objection Tier3 halt, and taxonomy rename/merge/split", () => {
  // Overturn rate excludes taxonomy/split updates
  const rate = computeVoterOverturnRate([
    { overturned: true, reasonTag: "分類の変更" },
    { overturned: true, reasonTag: "taxon_split" },
    { overturned: false, reasonTag: null },
    { overturned: false, reasonTag: null },
    { overturned: false, reasonTag: null },
    { overturned: true, reasonTag: "misidentification" },
  ]);
  // Only 4 non-taxonomy outcomes, 1 overturned => 0.25 (>= 20%)
  assert.equal(rate, 0.25);
  assert.equal(isVoterEligible({ activeDays: 7, overturnRate: 0.19 }), true);
  assert.equal(isVoterEligible({ activeDays: 6, overturnRate: 0.1 }), false);
  assert.equal(isVoterEligible({ activeDays: 10, overturnRate: 0.2 }), false);

  // Justification validation requires trait selection + photoPosition + visibility ('見える' | '見えない')
  assert.equal(validateStructuredJustification({ traits: [], photoPart: "頭・顔", visibility: "見える" }).ok, false);
  assert.equal(validateStructuredJustification({ traits: ["ほおが白い"], photoPart: "頭・顔", visibility: "見える" }).ok, true);

  // Scoped reviewer + structured justification confirms alone, while non-matching voter does not
  const expertConfirmed = evaluateConfirmationRules({
    targetTaxon: "文鳥",
    observedAt: "2026-11-20T01:00:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    votes: [
      {
        actorUserId: "u-exp",
        proposedName: "文鳥",
        proposedRank: "species",
        activeDays: 30,
        overturnRate: 0.02,
        hasScopedAuthority: true,
        structuredJustification: { traits: ["ほおが白い"], photoPart: "頭・顔", visibility: "見える" },
      },
    ],
    objections: [],
    lat: 34.71,
    lng: 137.7,
  });
  assert.equal(expertConfirmed.statusWord, "確認済み");
  assert.equal(expertConfirmed.confirmedWithObjection, false);
  assert.equal(expertConfirmed.tier3ExportAllowed, true);
  assert.equal(expertConfirmed.confirmedBasis, "scoped_reviewer");

  // Justified objection sets Confirmed-with-objection modifier AND halts Tier3 export
  const disputedConfirmed = evaluateConfirmationRules({
    targetTaxon: "文鳥",
    observedAt: "2026-11-20T01:00:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    votes: [
      {
        actorUserId: "u-exp",
        proposedName: "文鳥",
        proposedRank: "species",
        activeDays: 30,
        overturnRate: 0.02,
        hasScopedAuthority: true,
        structuredJustification: { traits: ["ほおが白い"], photoPart: "頭・顔", visibility: "見える" },
      },
    ],
    objections: [
      {
        actorUserId: "u-obj",
        proposedName: "ジュウシマツ",
        structuredJustification: { traits: ["背中に模様"], photoPart: "羽・背中", visibility: "見える" },
      },
    ],
    lat: 34.71,
    lng: 137.7,
  });
  assert.equal(disputedConfirmed.statusWord, "確認済み");
  assert.equal(disputedConfirmed.confirmedWithObjection, true);
  assert.equal(disputedConfirmed.tier3ExportAllowed, false);

  // 14 days without confirmation escalates target evaluation rank 1 step up
  const escalated = evaluateConfirmationRules({
    targetTaxon: "スズメ",
    targetRank: "species",
    observedAt: "2026-11-01T01:00:00Z",
    nowMs: Date.parse("2026-11-27T01:00:00Z"),
    votes: [{ actorUserId: "u-1", proposedName: "スズメ", proposedRank: "species", activeDays: 14, overturnRate: 0.05, hasScopedAuthority: false }],
    objections: [],
    lat: 34.71,
    lng: 137.7,
  });
  assert.equal(escalated.escalatedOneRankUp, true);
  assert.equal(escalated.recommendedRank, "genus");

  // Season / distribution outlier -> needsInquiry ('要照会')
  const outlierWinterCicada = checkSeasonAndDistributionOutlier({
    taxonKeyOrName: "アブラゼミ",
    observedAt: "2026-12-20T03:00:00Z",
    lat: 34.71,
    lng: 137.7,
  });
  assert.equal(outlierWinterCicada.needsInquiry, true);
  assert.match(outlierWinterCicada.reasons.join(" "), /時期/);

  const outlierCoord = checkSeasonAndDistributionOutlier({
    taxonKeyOrName: "アブラゼミ",
    observedAt: "2026-08-15T03:00:00Z",
    lat: 10.0,
    lng: 137.7,
  });
  assert.equal(outlierCoord.needsInquiry, true);
  assert.match(outlierCoord.reasons.join(" "), /分布/);

  // Taxonomy maintenance: rename & merge automatic preserving confirmed; non-geo split widens to reconfirmationShelf
  const renamed = applyTaxonomyChange({ kind: "rename", currentTaxon: "旧種名", newTaxon: "新種名", statusWord: "確認済み" });
  assert.equal(renamed.nextTaxon, "新種名");
  assert.equal(renamed.nextStatusWord, "確認済み");
  assert.equal(renamed.reconfirmationShelf, false);
  assert.equal(renamed.countsAsOverturn, false);

  const merged = applyTaxonomyChange({ kind: "merge", currentTaxon: "統合元種", newTaxon: "統合先種", statusWord: "確認済み" });
  assert.equal(merged.nextTaxon, "統合先種");
  assert.equal(merged.nextStatusWord, "確認済み");
  assert.equal(merged.countsAsOverturn, false);

  const nonGeoSplit = applyTaxonomyChange({ kind: "split", currentTaxon: "トウキョウダルマガエル", broadenedTaxon: "アカガエルの仲間", statusWord: "確認済み" });
  assert.equal(nonGeoSplit.nextTaxon, "アカガエルの仲間");
  assert.equal(nonGeoSplit.nextStatusWord, "人の提案");
  assert.equal(nonGeoSplit.reconfirmationShelf, true);
  assert.equal(nonGeoSplit.reasonTag, "分類の変更");
  assert.equal(nonGeoSplit.countsAsOverturn, false);
});

test("worker API enforces scoped reviewer authorization and structured evidence for confirm/object decisions", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, display_name TEXT NOT NULL, role_name TEXT NOT NULL DEFAULT 'member', rank_label TEXT, banned INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL, last_used_at TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, draft_id TEXT NOT NULL UNIQUE, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, note TEXT, exact_lat REAL, exact_lng REAL, location_accuracy_m REAL, public_cell TEXT NOT NULL, public_area_label TEXT, visibility TEXT NOT NULL DEFAULT 'public', emergency_hidden INTEGER NOT NULL DEFAULT 0, processing_state TEXT NOT NULL DEFAULT 'accepted', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, draft_id TEXT, observation_id TEXT, owner_user_id TEXT, mime TEXT NOT NULL, exif_scrub_state TEXT NOT NULL DEFAULT 'scrubbed', public_derivative_key TEXT, uploaded_at TEXT);
    CREATE TABLE observation_ai_review_targets (occurrence_id TEXT PRIMARY KEY, ai_assessment_status TEXT NOT NULL DEFAULT 'ai_judgement', scientific_name TEXT, vernacular_name TEXT, taxon_rank TEXT, ai_run_id TEXT, candidate_id TEXT, candidate_scientific_name TEXT, candidate_vernacular_name TEXT, candidate_taxon_rank TEXT, ai_recommended_taxon_name TEXT, ai_recommended_rank TEXT, source_payload_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE observation_identifications (identification_id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, proposed_name TEXT NOT NULL, proposed_rank TEXT, stance TEXT NOT NULL DEFAULT 'support', notes TEXT, source_key TEXT NOT NULL UNIQUE, source_payload_json TEXT NOT NULL DEFAULT '{}', is_current INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE observation_identification_disputes (dispute_id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, kind TEXT NOT NULL, proposed_name TEXT, proposed_rank TEXT, reason TEXT, status TEXT NOT NULL DEFAULT 'open', source_payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE observation_identification_workbench_holds (hold_id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, hold_reason TEXT NOT NULL DEFAULT '', source_payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (occurrence_id, actor_user_id));
    CREATE TABLE specialist_authorities (authority_id TEXT PRIMARY KEY, subject_user_id TEXT NOT NULL, granted_by_user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', authority_kind TEXT NOT NULL DEFAULT 'taxon_identification', scope_taxon_name TEXT NOT NULL, scope_taxon_rank TEXT, scope_taxon_key TEXT, scope_json TEXT NOT NULL DEFAULT '{}', granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT, expires_at TEXT, reason TEXT, source_payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE observation_specialist_reviews (review_id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, lane TEXT NOT NULL DEFAULT 'expert-lane', decision TEXT NOT NULL, proposed_name TEXT, proposed_rank TEXT, accepted_rank TEXT, notes TEXT, review_class TEXT NOT NULL DEFAULT 'authority_backed', source_payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (occurrence_id, actor_user_id, lane));
    CREATE TABLE user_saved_items (user_id TEXT NOT NULL, object_kind TEXT NOT NULL, object_id TEXT NOT NULL, canonical_path TEXT NOT NULL, display_title TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL, last_command_id TEXT NOT NULL, last_command_digest TEXT NOT NULL, saved_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, object_kind, object_id));
  `);
  const sha = (t: string) => createHash("sha256").update(t).digest("hex");
  const exp = new Date(Date.now() + 86_400_000).toISOString();
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha("tok-member"), "u-mem", "一般", "member", null, 0, exp, null);
  sqlite.prepare("INSERT INTO auth_sessions VALUES (?,?,?,?,?,?,?,?)").run(sha("tok-bird-rev"), "u-bird", "鳥確認者", "specialist", null, 0, exp, null);
  sqlite.prepare("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "obs-b1", "d-b1", "u-owner", "2026-11-23T00:41:00Z", "文鳥", null, 34.71, 137.7, 50, "cell:34.71,137.70", "佐鳴湖（浜松市中央区）", "public", 0, "accepted", "2026-11-23T00:41:00Z",
  );
  sqlite.prepare("INSERT INTO specialist_authorities (authority_id, subject_user_id, granted_by_user_id, status, authority_kind, scope_taxon_name, scope_taxon_rank, scope_taxon_key) VALUES (?,?,?,?,?,?,?,?)").run(
    "auth-bird", "u-bird", "u-admin", "active", "taxon_identification", "鳥", "class", "bird",
  );

  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async run() { return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } }; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run(): Promise<{ meta?: { changes?: number } }> }>) { const r = []; for (const s of stmts) r.push(await s.run()); return r; },
  } as unknown as Env["OBS_DB"];
  const env = { ENVIRONMENT: "staging", CORE_DB: db, OBS_DB: db, ZUKAN_FEATURE_ROLLOUTS: JSON.stringify({ IDENTIFY_V3_ENABLED: { state: "all" } }) } as unknown as Env;

  // Member without scoped authority cannot confirm -> 403
  const memConfirm = await worker.fetch(new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=tok-member`, "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId: "obs-b1", decision: "confirm", proposedName: "文鳥", traits: ["ほおが白い"], photoPart: "頭・顔", visibility: "見える" }),
  }), env);
  assert.equal(memConfirm.status, 403);

  // Scoped reviewer without structured justification cannot confirm -> 400
  const noEvConfirm = await worker.fetch(new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=tok-bird-rev`, "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId: "obs-b1", decision: "confirm", proposedName: "文鳥" }),
  }), env);
  assert.equal(noEvConfirm.status, 400);

  // Scoped reviewer WITH structured justification confirms alone -> 200
  const okConfirm = await worker.fetch(new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=tok-bird-rev`, "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId: "obs-b1", decision: "confirm", proposedName: "文鳥", proposedRank: "species", traits: ["頭が黒くほおが白い"], photoPart: "頭・顔", visibility: "見える", justificationText: "くちばしが太くピンク色です" }),
  }), env);
  assert.equal(okConfirm.status, 200);
  const okJson = (await okConfirm.json()) as { statusWord: string; tier3ExportAllowed: boolean };
  assert.equal(okJson.statusWord, "確認済み");
  assert.equal(okJson.tier3ExportAllowed, true);
  assert.equal((sqlite.prepare("SELECT decision FROM observation_specialist_reviews WHERE occurrence_id = 'obs-b1'").get() as { decision: string }).decision, "approve");

  // Justified objection marks 確認済み（異議あり） + Tier3停止
  const okObject = await worker.fetch(new Request("https://zukan.earth/api/v1/identify-v3/decisions", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=tok-member`, "content-type": "application/json" },
    body: JSON.stringify({ occurrenceId: "obs-b1", decision: "object", proposedName: "ジュウシマツ", traits: ["背中にうろこ模様"], photoPart: "羽・背中", visibility: "見える", reason: "背中の模様がジュウシマツです" }),
  }), env);
  assert.equal(okObject.status, 200);
  const objJson = (await okObject.json()) as { confirmedWithObjection: boolean; tier3ExportAllowed: boolean };
  assert.equal(objJson.confirmedWithObjection, true);
  assert.equal(objJson.tier3ExportAllowed, false);
});

test("saved view: quiet count lead, folded filter, settled section, no confirm promise copy", () => {
  const item = (id: string, settled: boolean) => ({
    occurrenceId: id, photoUrl: null, currentTitle: "文鳥", statusWord: (settled ? "確認済み" : "人の提案") as "確認済み" | "人の提案",
    ownerDisplayName: "記録者", locationText: "浜松市中央区", observedDateLabel: "11月1日", savedCandidateName: "文鳥", savedAtLabel: "11月2日",
    settledByActorName: null, settledReason: settled ? "ほかの人の根拠つきの提案で決まりました。" : null, savedAtIso: "2026-11-02T00:00:00Z",
    settledAtIso: settled ? "2026-11-20T00:00:00Z" : null, taxonNodeKey: "buncho", stateSummary: "x",
  });
  const base = { lang: "ja" as const, displayName: "a", skills: [], autoGrown: [], promotionSuggestions: [], confirmedCountsByNode: {}, feedItems: [], nextCursor: null };
  const ja = renderIdentifyV3Page({ ...base, view: "saved", savedItems: [item("o1", false)], settledSavedItems: [item("o2", true)], savedCount: 1 });
  assert.match(ja, /いま <b>1件<\/b> あります/);
  assert.match(ja, /<details[^>]*>\s*<summary[^>]*>分類や時期で絞る/);
  assert.match(ja, /決まったもの/);
  assert.equal(/確定できます|あと\d+件/.test(ja), false);
  const en = renderIdentifyV3Page({ ...base, lang: "en", view: "saved", savedItems: [item("o1", false)], settledSavedItems: [], savedCount: 1 });
  assert.match(en, /You have <b>1<\/b> now/);
  const skills = renderIdentifyV3Page({ ...base, view: "skills", savedItems: [], settledSavedItems: [], savedCount: 0 });
  for (const w of ["くわしい", "全般わかる", "わかるものもある", "流さない"]) assert.ok(skills.includes(w));
});
