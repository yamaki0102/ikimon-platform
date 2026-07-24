import assert from "node:assert/strict";
import test from "node:test";
import { getStrings } from "../../src/i18n/index.js";
import { renderLandingTopSections } from "../../src/ui/landingTop.js";
import { injectStateSplitHome } from "./index";
import { applyPublicHomeUxPolish } from "./publicHomeUxPolish";
import { applyFocusedPublicHomeRedesign } from "./publicFocusedHomeRedesign";
import { enforceCameraFirstHomeCtaHtml } from "./cameraFirstHomeCta";

const template = `<!doctype html><html lang="ja"><head></head><body>
<header data-home-header data-home-auth-state="guest"></header>
<main><div class="home-state-root" data-home-contract="state-split-v1" data-home-auth-state="guest">
<div class="home-state-view is-guest" data-home-view="guest"><section class="home-guest-hero"><!-- ikimon-home-slot:guest-hero:start --><!-- ikimon-home-slot:guest-hero:end --></section><!-- ikimon-home-slot:guest-public:start --><a href="/ja/records?view=public">public</a><!-- ikimon-home-slot:guest-public:end --></div>
<div class="home-state-view is-member" data-home-view="member" hidden>
<!-- ikimon-home-section:member-primary:start --><section>template-first-state</section><!-- ikimon-home-section:member-primary:end -->
<!-- ikimon-home-section:member-recent:start --><!-- ikimon-home-section:member-recent:end -->
<!-- ikimon-home-section:member-discovery:start --><!-- ikimon-home-section:member-discovery:end -->
<!-- ikimon-home-section:member-place:start --><!-- ikimon-home-section:member-place:end -->
</div></div></main><div data-app-install-prompt></div></body></html>`;

function mockEnv() {
  const prepare = (sql: string) => {
    const statement = {
      bind: (..._values: unknown[]) => statement,
      all: async () => {
        if (sql.includes("public_map_snapshot_records_v1")) return { results: [
          { visit_id: "public-1", cell_1000: "safe-cell", observed_at: "2026-07-20T00:00:00Z", display_name: "ツバメ", asset_count: 1 },
          { visit_id: "owner-latest", cell_1000: "safe-cell", observed_at: "2026-07-18T00:00:00Z", display_name: "自分の公開記録", asset_count: 1 },
        ] };
        if (sql.includes("SELECT observation_id, public_derivative_key") && sql.includes("asset_ledger")) return { results: [
          { observation_id: "public-1", public_derivative_key: "public/public-1.webp" },
          { observation_id: "owner-latest", public_derivative_key: "public/owner-latest.webp" },
        ] };
        if (sql.includes("FROM observations o") && sql.includes("owner_user_id = ?")) return { results: [
          { observation_id: "owner-latest", observed_at: "2026-07-21T00:00:00Z", taxon_label: "川沿いの夕景", note: null, visibility: "private", public_derivative_key: "public/owner-latest.webp", ai_assessment_status: "completed", ai_request_status: null, ai_candidate_label: null },
          { observation_id: "owner-discovery", observed_at: "2026-07-19T00:00:00Z", taxon_label: null, note: "鳥の記録", visibility: "limited", public_derivative_key: "public/owner-discovery.webp", ai_assessment_status: "completed", ai_request_status: null, ai_candidate_label: "カワセミ" },
        ] };
        if (sql.includes("production_import_evidence_assets") || (sql.includes("FROM asset_ledger") && sql.includes("GROUP BY observation_id"))) return { results: [] };
        return { results: [] };
      },
    };
    return statement;
  };
  return { OBS_DB: { prepare }, PUBLIC_DERIVED_IMAGE_TRANSFORM_MODE: "disabled" } as never;
}

test("state split worker injects owner data into the actual canonical Home renderer", async () => {
  const strings = getStrings("ja");
  const rendered = renderLandingTopSections({
    basePath: "",
    lang: "ja",
    copy: strings.landing,
    fieldLoop: strings.fieldLoop,
    isLoggedIn: false,
    snapshot: {
      viewerUserId: null,
      stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
      feed: [],
      myFeed: [],
      myPlaces: [],
      nearbyFields: [],
      nearbyEvents: [],
      mapPreviewCells: [],
      ambient: [],
      habit: null,
      dailyDashboard: null,
    },
  });
  const canonicalHtml = `<!doctype html><html lang="ja"><head></head><body>${rendered.heroHtml}${rendered.dailyDashboardHtml}</body></html>`;
  assert.match(canonicalHtml, /ikimon-home-section:member-primary:start/);
  assert.match(canonicalHtml, /ikimon-home-section:member-recent:start/);
  assert.match(canonicalHtml, /ikimon-home-section:member-place:start/);

  const injected = await injectStateSplitHome(
    canonicalHtml,
    { userId: "viewer", banned: false } as never,
    new URL("https://staging.ikimon.life/ja/"),
    mockEnv(),
  );
  assert.doesNotMatch(injected, /data-home-primary-state="first_record"[^>]*data-home-primary-active="true"/);
  assert.match(injected, /data-home-primary-state="recent_memory"/);
  assert.match(injected, /川沿いの夕景/);
  assert.match(injected, /owner-discovery/);
  assert.match(injected, /場所から見つける/);
});

test("state split worker preserves the curated guest hero instead of promoting the latest public photo", async () => {
  const strings = getStrings("ja");
  const rendered = renderLandingTopSections({
    basePath: "",
    lang: "ja",
    copy: strings.landing,
    fieldLoop: strings.fieldLoop,
    isLoggedIn: false,
    snapshot: {
      viewerUserId: null,
      stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
      feed: [],
      myFeed: [],
      myPlaces: [],
      nearbyFields: [],
      nearbyEvents: [],
      mapPreviewCells: [],
      ambient: [],
      habit: null,
      dailyDashboard: null,
    },
  });
  const canonicalHtml = `<!doctype html><html lang="ja"><head></head><body>${rendered.heroHtml}${rendered.dailyDashboardHtml}</body></html>`;
  const injected = await injectStateSplitHome(
    canonicalHtml,
    null,
    new URL("https://staging.ikimon.life/ja/"),
    mockEnv(),
  );

  assert.match(injected, /\/assets\/img\/landing\/home-community-hero\.webp/);
  assert.match(injected, /home-generated-badge">イメージ</);
  assert.doesNotMatch(injected, /\/media\/derived\/public%2Fpublic-1\.webp/);
});

test("state split worker turns owner history into a memory-first Home with a place continuation", async () => {
  const html = await injectStateSplitHome(template, { userId: "viewer", banned: false } as never, new URL("https://staging.ikimon.life/ja/"), mockEnv());
  assert.match(html, /data-home-auth-state="member"/);
  assert.match(html, /data-home-view="guest" hidden/);
  assert.match(html, /data-home-view="member">/);
  assert.doesNotMatch(html, /template-first-state/);
  assert.match(html, /この前の記録/);
  assert.match(html, /今日の記録を撮る/);
  assert.match(html, /data-global-record-trigger="photo"/);
  assert.match(html, /最近の記録/);
  assert.doesNotMatch(html, /写真からわかったこと|カワセミ かもしれません|近くで残された記録/);
  assert.match(html, /場所から見つける/);
  assert.match(html, /href="\/ja\/map\?tab=places"/);
  const member = html.slice(html.indexOf('data-home-view="member"'));
  assert.equal((member.match(/data-home-record-id="owner-latest"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="owner-discovery"/g) || []).length, 1);
  assert.equal((member.match(/data-home-record-id="public-1"/g) || []).length, 0);
  assert.doesNotMatch(member, /latitude|longitude|public_cell|safe-cell/);
  assert.doesNotMatch(member, /autoplay|<video/);
});

test("state split contract bypasses all legacy home rewrites", () => {
  const focused = applyFocusedPublicHomeRedesign(template);
  const camera = enforceCameraFirstHomeCtaHtml(focused);
  const polished = applyPublicHomeUxPolish(camera, "ja");
  assert.doesNotMatch(polished, /ikimon-focused-home-v3|ikimon-public-home-ux-v2/);
  assert.match(polished, /data-home-contract="state-split-v1"/);
  assert.match(polished, /data-app-install-prompt[^>]*aria-hidden="true"[^>]*inert[^>]*data-public-home-install-suppressed/);
});
