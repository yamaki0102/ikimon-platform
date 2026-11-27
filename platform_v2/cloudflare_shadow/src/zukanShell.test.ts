import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_SHELL_CSS,
  ZUKAN_SHELL_TOKENS,
  renderZukanEmptyState,
  renderZukanErrorState,
  renderZukanSheet,
  renderZukanShellDocument,
  renderZukanSkeleton,
  renderZukanStatusBand,
} from "./zukanShell";

test("zukanShell exposes design tokens (#143F2E, typography, radii, 120/240/360ms motion + reduced-motion)", () => {
  assert.equal(ZUKAN_SHELL_TOKENS.colors.green.toUpperCase(), "#143F2E");
  assert.equal(ZUKAN_SHELL_TOKENS.motion.fastMs, 120);
  assert.equal(ZUKAN_SHELL_TOKENS.motion.midMs, 240);
  assert.equal(ZUKAN_SHELL_TOKENS.motion.slowMs, 360);

  assert.match(ZUKAN_SHELL_CSS, /--green:#143f2e/i);
  assert.match(ZUKAN_SHELL_CSS, /--font-sans:/);
  assert.match(ZUKAN_SHELL_CSS, /--radius-sm:/);
  assert.match(ZUKAN_SHELL_CSS, /--radius-pill:999px/);
  assert.match(ZUKAN_SHELL_CSS, /--motion-fast:120ms/);
  assert.match(ZUKAN_SHELL_CSS, /--motion-mid:240ms/);
  assert.match(ZUKAN_SHELL_CSS, /--motion-slow:360ms/);
  assert.match(ZUKAN_SHELL_CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(ZUKAN_SHELL_CSS, /a,a:visited\{color:var\(--green\)\}/);
  assert.match(ZUKAN_SHELL_CSS, /\.zt-shell:has\(>\.zt-sidebar\)\{display:grid/);
  assert.doesNotMatch(ZUKAN_SHELL_CSS, /\.zt-shell\{[^}]*display:grid/);
});

test("zukanShell renders 5-item bottom nav order, PC left sidebar, topbar, sheet, status band, skeleton, empty, and error states", () => {
  const doc = renderZukanShellDocument({
    lang: "ja",
    activeNav: "library",
    authenticated: true,
    displayName: "ゆい",
    searchAction: "/ja/",
    pathname: "/ja/",
    homeHref: "/ja/",
    bodyHtml: "<p>body</p>",
  });
  const navOrder = doc.match(/<nav class="zt-bottom-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
  const labels = [...navOrder.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["ライブラリ", "イベント", "撮る", "場所", "自分"]);
  assert.match(doc, /<aside class="zt-sidebar"/);
  assert.match(doc, /<header class="zt-topbar zt-topbar-member"/);

  const sheet = renderZukanSheet({
    id: "test-sheet",
    titleId: "test-sheet-title",
    title: "確認",
    bodyHtml: "<p>中身</p>",
    actionsHtml: '<button type="button">閉じる</button>',
  });
  assert.match(sheet, /<dialog class="zt-sheet" id="test-sheet"/);
  assert.match(sheet, /aria-labelledby="test-sheet-title"/);
  assert.match(sheet, /確認/);

  const band = renderZukanStatusBand({
    tone: "warn",
    title: "通信待ち",
    detail: "あとで送ります",
    actionHref: "/ja/",
    actionLabel: "確認",
  });
  assert.match(band, /class="zt-status-band" data-tone="warn"/);
  assert.match(band, /通信待ち/);

  const skel = renderZukanSkeleton({ count: 3, ariaLabel: "読み込み中" });
  assert.match(skel, /aria-busy="true"/);
  assert.equal((skel.match(/class="zt-skeleton-card"/g) ?? []).length, 3);

  const empty = renderZukanEmptyState({
    title: "まだありません",
    message: "撮ってみましょう",
    actionsHtml: '<a href="/ja/record">撮る</a>',
  });
  assert.match(empty, /class="zt-state-card" data-zukan-empty="1"/);
  assert.match(empty, /まだありません/);

  const err = renderZukanErrorState({ retryHref: "/ja/" });
  assert.match(err, /data-zukan-fetch-error="1"/);
  assert.match(err, /読み込めませんでした/);
  assert.match(err, />もう一度</);
  assert.match(err, /href="\/ja\/"/);
});
