import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, langFromPathPrefix, type SiteLang } from "../i18n.js";
import { getShortCopy, renderLongformPage } from "../content/index.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import {
  legacyRedirectEntries,
  listMarketingPages,
  listPagesByLane,
  localizedPageLangs,
  sitePageLabel,
  sitePageSummary,
  type RouteLane,
  type SitePageDefinition,
} from "../siteMap.js";

type MarketingPageMeta = {
  title: string;
  eyebrow: string;
  heading: string;
  lead: string;
  activeNav: "home" | "learn" | "business" | "explore" | "community";
  bodyPageId: string;
  footerNote?: string;
  afterActions?: Array<{ href: string; label: string }>;
};

type ContactFormCopy = {
  categories: Array<{ value: string; label: string }>;
  fields: {
    category: string;
    message: string;
    messagePlaceholder: string;
    messageHint: string;
    name: string;
    namePlaceholder: string;
    organization: string;
    organizationPlaceholder: string;
    email: string;
    emailPlaceholder: string;
    emailHint: string;
  };
  submit: string;
  noscript: string;
  status: {
    loading: string;
    successPrefix: string;
    successSuffix: string;
    errorPrefix: string;
    network: string;
  };
};

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function isLanguagePrefixedRequest(url: string): boolean {
  const queryIndex = url.indexOf("?");
  const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  return Boolean(langFromPathPrefix(path));
}

function activeNavLabel(activeNav: MarketingPageMeta["activeNav"], lang: SiteLang): string {
  switch (activeNav) {
    case "business":
      return getShortCopy<string>(lang, "shared", "shell.nav.business");
    case "community":
      return getShortCopy<string>(lang, "shared", "shell.nav.community");
    case "explore":
      return getShortCopy<string>(lang, "shared", "shell.nav.explore");
    case "learn":
      return getShortCopy<string>(lang, "shared", "shell.nav.learn");
    default:
      return getShortCopy<string>(lang, "shared", "shell.nav.home");
  }
}

function localizeInternalLinks(html: string, basePath: string, lang: SiteLang): string {
  return html.replace(/href="([^"]+)"/g, (_match, href: string) => {
    if (!href.startsWith("/")) {
      return `href="${escapeHtml(href)}"`;
    }
    return `href="${escapeHtml(appendLangToHref(withBasePath(basePath, href), lang))}"`;
  });
}

function renderAfterActions(basePath: string, lang: SiteLang, actions?: Array<{ href: string; label: string }>): string {
  if (!actions || actions.length === 0) {
    return "";
  }
  return `<div class="doc-link-strip">${actions
    .map((action) => `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, action.href), lang))}">${escapeHtml(action.label)}</a>`)
    .join("")}</div>`;
}

function renderContactForm(basePath: string, lang: SiteLang): string {
  const copy = getShortCopy<ContactFormCopy>(lang, "public", "contactForm");
  const submitEndpoint = withBasePath(basePath, "/api/v1/contact/submit");
  const optionsHtml = copy.categories
    .map((category) => `<option value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</option>`)
    .join("");

  return `<section class="section">
    <style>
      .cf-form { display: grid; gap: 14px; max-width: 720px; margin: 0 auto 24px; padding: 24px; border-radius: 22px; background: linear-gradient(180deg, #ffffff, #f8fafc); border: 1px solid rgba(15,23,42,.08); }
      .cf-form label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #111827; }
      .cf-form input, .cf-form select, .cf-form textarea { padding: 10px 12px; border: 1px solid rgba(15,23,42,.15); border-radius: 12px; font-size: 14px; background: #fff; font-family: inherit; }
      .cf-form textarea { min-height: 140px; resize: vertical; }
      .cf-form .cf-required::after { content: " *"; color: #dc2626; }
      .cf-form .cf-hint { font-size: 12px; color: #6b7280; font-weight: 400; }
      .cf-form .cf-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .cf-form button[type=submit] { padding: 12px 22px; border-radius: 999px; border: none; background: #111827; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; }
      .cf-form button[type=submit]:disabled { opacity: .5; cursor: not-allowed; }
      .cf-form .cf-status { font-size: 13px; color: #4b5563; }
      .cf-form .cf-status.cf-err { color: #dc2626; font-weight: 700; }
      .cf-form .cf-status.cf-ok { color: #16a34a; font-weight: 700; }
    </style>
    <form class="cf-form" id="cf-form" onsubmit="return false;">
      <label><span class="cf-required">${escapeHtml(copy.fields.category)}</span>
        <select name="category" required>${optionsHtml}</select>
      </label>
      <label><span class="cf-required">${escapeHtml(copy.fields.message)}</span>
        <textarea name="message" required minlength="5" maxlength="8000" placeholder="${escapeHtml(copy.fields.messagePlaceholder)}"></textarea>
        <span class="cf-hint">${escapeHtml(copy.fields.messageHint)}</span>
      </label>
      <label>${escapeHtml(copy.fields.name)}
        <input name="name" type="text" maxlength="200" placeholder="${escapeHtml(copy.fields.namePlaceholder)}" />
      </label>
      <label>${escapeHtml(copy.fields.organization)}
        <input name="organization" type="text" maxlength="200" placeholder="${escapeHtml(copy.fields.organizationPlaceholder)}" />
      </label>
      <label>${escapeHtml(copy.fields.email)}
        <input name="email" type="email" maxlength="200" placeholder="${escapeHtml(copy.fields.emailPlaceholder)}" />
        <span class="cf-hint">${escapeHtml(copy.fields.emailHint)}</span>
      </label>
      <div class="cf-actions">
        <button type="submit" id="cf-submit">${escapeHtml(copy.submit)}</button>
        <span class="cf-status" id="cf-status"></span>
      </div>
      <noscript><p class="cf-status cf-err">${escapeHtml(copy.noscript)}</p></noscript>
    </form>
    <script>
      (function(){
        var form = document.getElementById('cf-form');
        if (!form) return;
        var btn = document.getElementById('cf-submit');
        var status = document.getElementById('cf-status');
        form.addEventListener('submit', async function(ev){
          ev.preventDefault();
          btn.disabled = true;
          status.className = 'cf-status';
          status.textContent = ${JSON.stringify(copy.status.loading)};
          var fd = new FormData(form);
          var payload = {
            category: fd.get('category') || 'question',
            message: fd.get('message') || '',
            name: fd.get('name') || '',
            organization: fd.get('organization') || '',
            email: fd.get('email') || '',
            sourceUrl: location.href,
            userAgent: navigator.userAgent
          };
          try {
            var res = await fetch(${JSON.stringify(submitEndpoint)}, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'same-origin'
            });
            var data = await res.json().catch(function(){ return {}; });
            if (res.ok && data && data.ok) {
              status.className = 'cf-status cf-ok';
              status.textContent = ${JSON.stringify(copy.status.successPrefix)} + (data.submissionId || '').slice(0, 8) + ${JSON.stringify(copy.status.successSuffix)};
              form.reset();
            } else {
              status.className = 'cf-status cf-err';
              status.textContent = ${JSON.stringify(copy.status.errorPrefix)} + ((data && data.error) ? data.error : ('HTTP ' + res.status));
            }
          } catch (_error) {
            status.className = 'cf-status cf-err';
            status.textContent = ${JSON.stringify(copy.status.network)};
          } finally {
            btn.disabled = false;
          }
        });
      })();
    </script>
  </section>`;
}

const LOWER_PAGE_STYLES = `
  .lower-page { display: grid; gap: 22px; }
  .lower-route-intro { margin-top: 8px; }
  .lower-route-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .lower-route-tile { min-height: 118px; padding: 18px; border-radius: 20px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.04); }
  .lower-route-tile strong { display: block; margin: 5px 0 6px; color: #0f172a; font-size: 16px; }
  .lower-route-tile span { display: inline-flex; color: #047857; font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .lower-route-tile p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.65; }
  .doc-article { max-width: 880px; margin: 0 auto; }
  .doc-prose { padding: 30px clamp(20px, 4vw, 36px); border-radius: 24px; background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(248,250,252,.94)); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 16px 36px rgba(15,23,42,.06); }
  .doc-prose h1, .doc-prose h2, .doc-prose h3 { margin: 0 0 14px; color: #0f172a; letter-spacing: -.02em; }
  .doc-prose h1 { font-size: 28px; line-height: 1.24; }
  .doc-prose h2 { margin-top: 28px; font-size: 21px; line-height: 1.32; }
  .doc-prose h3 { margin-top: 22px; font-size: 17px; line-height: 1.4; }
  .doc-prose p, .doc-prose li { color: #475569; font-size: 15px; line-height: 1.9; }
  .doc-prose ul, .doc-prose ol { margin: 0 0 18px; padding-left: 22px; display: grid; gap: 10px; }
  .doc-prose a { color: #047857; font-weight: 800; text-decoration: none; }
  .doc-prose a:hover { text-decoration: underline; }
  .doc-prose blockquote { margin: 20px 0; padding: 16px 18px; border-left: 4px solid #10b981; background: rgba(16,185,129,.06); border-radius: 0 16px 16px 0; }
  .doc-link-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 16px; }
  .route-gateway { margin-top: 4px; }
  .route-gateway .section-header p { max-width: 680px; }
  .route-gateway-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .route-gateway-card { display: flex; flex-direction: column; min-height: 176px; padding: 20px; border-radius: 20px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.04); }
  .route-gateway-card h3 { margin: 8px 0 8px; color: #0f172a; font-size: 18px; line-height: 1.35; }
  .route-gateway-card p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.7; }
  .route-gateway-card span:last-child { margin-top: auto; padding-top: 14px; color: #047857; font-weight: 900; font-size: 13px; }
  @media (max-width: 820px) {
    .lower-route-grid, .route-gateway-grid { grid-template-columns: 1fr; }
  }
`;

const CHANGELOG_EXTRA_STYLES = `
  .cl-wrap { padding: 0 0 80px; }
  .cl-hero { max-width: 860px; margin: 0 auto; padding: 72px 24px 48px; }
  .cl-eyebrow { font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #047857; margin: 0 0 16px; font-family: monospace; }
  .cl-h1 { font-size: clamp(26px, 4vw, 38px); font-weight: 900; letter-spacing: -.03em; color: #0f172a; margin: 0 0 14px; line-height: 1.15; }
  .cl-lead { color: #64748b; font-size: 16px; line-height: 1.75; max-width: 560px; margin: 0 0 28px; }
  .cl-latest { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px; border-radius: 18px; background: rgba(16,185,129,.05); border: 1px solid rgba(16,185,129,.18); max-width: 580px; }
  .cl-live { width: 10px; height: 10px; min-width: 10px; border-radius: 50%; background: #10b981; margin-top: 5px; animation: cl-pulse 2s ease-in-out infinite; }
  @keyframes cl-pulse { 0%,100%{box-shadow:0 0 0 3px rgba(16,185,129,.25)} 50%{box-shadow:0 0 0 5px rgba(16,185,129,.08)} }
  .cl-lm { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
  .cl-lm-ver { font-size: 12px; font-weight: 800; color: #047857; font-family: monospace; }
  .cl-lm-date { font-size: 12px; color: #94a3b8; }
  .cl-ls { color: #0f172a; font-size: 14px; line-height: 1.6; margin: 0; }
  .cl-filter { position: sticky; top: 56px; z-index: 10; display: flex; gap: 8px; flex-wrap: wrap; padding: 11px 24px; background: rgba(249,255,254,.94); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(15,23,42,.06); }
  .clf-btn { padding: 5px 13px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid rgba(15,23,42,.12); background: transparent; color: #64748b; cursor: pointer; white-space: nowrap; transition: background .12s, color .12s, border-color .12s; }
  .clf-btn.is-active, .clf-btn:hover { background: #0f172a; color: #fff; border-color: #0f172a; }
  .clf-feature.is-active, .clf-feature:hover { background: #059669; border-color: #059669; }
  .clf-improvement.is-active, .clf-improvement:hover { background: #0284c7; border-color: #0284c7; }
  .clf-fix.is-active, .clf-fix:hover { background: #d97706; border-color: #d97706; }
  .clf-feature { color: #047857; border-color: rgba(16,185,129,.3); }
  .clf-improvement { color: #0369a1; border-color: rgba(59,130,246,.3); }
  .clf-fix { color: #b45309; border-color: rgba(234,88,12,.3); }
  .cl-list { max-width: 860px; margin: 0 auto; padding: 0 24px; }
  .cl-entry { display: grid; grid-template-columns: 108px 1fr; gap: 36px; padding: 40px 0; border-bottom: 1px solid rgba(15,23,42,.06); }
  .cl-entry:last-child { border-bottom: 0; }
  .cl-date { font-size: 11.5px; font-family: monospace; color: #94a3b8; padding-top: 4px; text-align: right; line-height: 1.4; }
  .cl-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px; }
  .cl-ver { font-size: 11.5px; font-family: monospace; color: #94a3b8; }
  .cl-tag { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .03em; }
  .cl-tf { background: #dcfce7; color: #15803d; }
  .cl-ti { background: #dbeafe; color: #1e40af; }
  .cl-tx { background: #fef3c7; color: #92400e; }
  .cl-title { margin: 0 0 14px; font-size: 17px; font-weight: 800; line-height: 1.38; letter-spacing: -.015em; color: #0f172a; }
  .cl-items { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  .cl-items li { position: relative; padding-left: 16px; font-size: 14px; color: #475569; line-height: 1.75; }
  .cl-items li::before { content: "–"; position: absolute; left: 0; top: 0; color: rgba(15,23,42,.25); }
  .cl-items strong { color: #0f172a; font-weight: 700; }
  @media (max-width: 640px) {
    .cl-entry { grid-template-columns: 1fr; gap: 6px; }
    .cl-date { text-align: left; }
    .cl-hero { padding: 48px 18px 36px; }
    .cl-filter { padding: 10px 18px; }
    .cl-list { padding: 0 18px; }
  }
`;

type ChangelogEntry = {
  version: string;
  date: string;
  dateJa: string;
  summary?: string;
  title: string;
  tags: Array<"feature" | "improvement" | "fix">;
  items: Array<{ label: string; body: string }>;
};

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: "v0.11.4", date: "2026-05-02", dateJa: "2026年5月2日",
    summary: "観察後の体験ループを接続し、位置情報の修正と日本語ラベルの統一を行いました。",
    title: "観察後の体験ループを接続、位置情報とラベルを修正",
    tags: ["feature", "fix"],
    items: [
      { label: "観察後の体験ループ", body: "ガイドセッション終了後に「今日の成果」を確認し、次の観察につながる流れを整えました。" },
      { label: "日本語表示を統一", body: "サイト全体の日本語ラベルをより自然に読めるよう揃え直しました。" },
      { label: "観察の位置情報を修正", body: "記録された場所のデータが正確に保存・表示されるよう直しました。" },
    ],
  },
  {
    version: "v0.11.3", date: "2026-04-30", dateJa: "2026年4月30日",
    title: "スマホで開きやすく、野外でも続けやすい土台を強化",
    tags: ["improvement"],
    items: [
      { label: "ホーム画面から使いやすく", body: "端末のホーム画面に追加した状態でも、記録・地図・読み物へ自然に進める動線に整えました。" },
      { label: "野外での途中再開", body: "通信が途切れても途中まで入力した内容を続けられる仕組みの基盤を整えました。" },
      { label: "ページ間のつながりを改善", body: "更新履歴・地図・記録ページが互いに見つかりやすいよう構成を調整しました。" },
    ],
  },
  {
    version: "v0.11.2", date: "2026-04-29", dateJa: "2026年4月29日",
    title: "地域ガイドと写真まわりを、野外で使いやすく",
    tags: ["improvement", "fix"],
    items: [
      { label: "今いる場所の文脈でガイドが話す", body: "地域の自然・歴史・環境の手がかりをもとに、ガイドがより文脈を持って語りかけるようになりました。" },
      { label: "長いセッションでも記録が途切れない", body: "通信が切れたり散歩が長くなっても記録が壊れにくくなりました。" },
      { label: "ガイド中のおすすめと振り返り", body: "セッション途中や終了後に「次に見るもの」と「今日の発見」が表示されるようになりました。" },
      { label: "写真の顔写り込みへの配慮", body: "人が写り込む可能性がある写真でも安全に扱えるよう処理を強化しました。" },
      { label: "カメラが使えないときの代替", body: "端末の制約でカメラが起動しない場合でも、写真選択から記録できる流れを用意しました。" },
    ],
  },
  {
    version: "v0.11.1", date: "2026-04-28", dateJa: "2026年4月28日",
    title: "観察記録を「大きさ・珍しさ・外来種」の視点で読み解けるように",
    tags: ["feature", "improvement"],
    items: [
      { label: "3つの視点で記録を読む", body: "ひとつの観察を、発見の大きさ・地域での希少さ・外来種情報の3つの角度から確認できるようになりました。" },
      { label: "外来種・管理対象種をすぐ確認", body: "記録した生きものが法令上注意が必要なものかどうか確認しやすくなりました。" },
      { label: "気になる種の通知準備", body: "特定の生きものやテーマを追いかけたい人向けの通知機能の基盤を整えました。" },
    ],
  },
  {
    version: "v0.11.0", date: "2026-04-27", dateJa: "2026年4月27日",
    title: "観察会・音声記録・投稿の安全性をまとめて前進",
    tags: ["feature", "fix"],
    items: [
      { label: "観察会を作れる", body: "複数人で同じ場所・テーマを調べる「観察会」の作成・参加・振り返りができるようになりました。" },
      { label: "鳴き声・環境音を独立した記録として残せる", body: "音声を写真とは別の発見として記録できるようになりました。" },
      { label: "重複投稿を防止", body: "連打や通信の揺れで観察が重複しないよう修正しました。" },
      { label: "野外からの投稿を安定化", body: "メディア処理と確認の流れを見直し、投稿に失敗しにくくなりました。" },
    ],
  },
  {
    version: "v0.10.1", date: "2026-04-08", dateJa: "2026年4月8日",
    title: "AI考察 全面強化 — 写真で即分析・見分け方まで表示",
    tags: ["feature", "improvement"],
    items: [
      { label: "AI自動提案が復活", body: "写真をアップロードするだけで、候補と考察がすぐ返ってくる流れを戻しました。複数枚も一度に扱えます。" },
      { label: "見分け方を表示", body: "「この種をどう見分けるか」のポイントと、似た種との違いがAI考察に追加されました。" },
      { label: "より踏み込んだ判定", body: "形質がはっきり写っている場合、属止まりでなく種レベルまで判定しやすくなりました。" },
      { label: "大きな写真でも止まらない", body: "AI考察の安定性を改善し、失敗しにくくなりました。" },
      { label: "デザインを整理", body: "サイト全体の配色を整理し、記録や考察が読みやすくなりました。" },
    ],
  },
  {
    version: "v0.10.0", date: "2026-04上旬", dateJa: "2026年4月上旬",
    title: "おすすめ調査エリア + 鳥の鳴き声AIを二重チェックに",
    tags: ["feature", "improvement"],
    items: [
      { label: "「ここ行くと見つかるかも」を地図で表示", body: "GBIFやiNaturalistのデータと比べて、発見チャンスが高いエリアを地図に出すようになりました。" },
      { label: "鳥の鳴き声を2つのAIで確認", body: "2つの音声AIが一致した検出だけを採用し、誤検出が大幅に減りました。" },
      { label: "スキャン後の結果レビュー", body: "終了後に今日の検出種・確信度・音声クリップをまとめて確認できます。" },
      { label: "検出候補をより多く表示", body: "閾値と地理フィルターを調整し、見逃しと誤検出を同時に減らしました。" },
    ],
  },
  {
    version: "v0.9.0", date: "2026-03-31", dateJa: "2026年3月31日",
    title: "散歩しながらAIが語りかける — AIレンズ",
    tags: ["feature", "improvement"],
    items: [
      { label: "AIレンズ", body: "散歩・自転車・ドライブ中に、近くで検出した生きものの生態・保全の話をAIが音声で語りかけます。" },
      { label: "散歩レポート", body: "セッション後に「今日の検出種・ルート・自然浴スコア」を一画面で振り返れます。" },
      { label: "観察詳細にAI豆知識", body: "生態・保全情報が観察詳細ページに自動表示されるようになりました。" },
      { label: "投稿後に写真を追加できる", body: "投稿済みの観察に後から写真を足せるようになりました。" },
    ],
  },
  {
    version: "v0.8.1", date: "2026-03下旬", dateJa: "2026年3月下旬",
    title: "サウンドアーカイブ — 聞いた鳴き声をみんなで同定",
    tags: ["feature"],
    items: [
      { label: "鳴き声をみんなで同定できる", body: "野外で録音した鳴き声を投稿し、コミュニティで種を確認できる機能を追加しました。写真がなくても記録できます。" },
      { label: "ウォーク中の検出がマイ図鑑に連動", body: "散歩中の音声検出がマイ図鑑の種ページから再生できるようになりました。" },
    ],
  },
  {
    version: "v0.8.0", date: "2026-03中旬", dateJa: "2026年3月中旬",
    title: "Androidアプリ公開 + 世界11,560種の鳴き声AI同定",
    tags: ["feature"],
    items: [
      { label: "Androidアプリ（ikimon Pocket）を公開", body: "カメラ検出・音声同定・ウォークモードをネイティブアプリとして使えます。" },
      { label: "世界11,560種の鳥を端末上で同定", body: "BirdNET V3.0搭載。Pixelではハードウェア加速で高速処理できます。" },
      { label: "カメラ・音声・環境センサーを同時動作", body: "3つのAIを並列で動かし、検出精度を高めます。" },
      { label: "音声ガイド話者を追加", body: "ずんだもん・もち子さん・青山龍星から選べます。Bluetooth出力にも対応しました。" },
      { label: "ガイドの雰囲気を選べる", body: "「自然探索」「歴史文化」「おまかせ」から選択できます。" },
    ],
  },
  {
    version: "v0.7.1", date: "2026-03中旬", dateJa: "2026年3月中旬",
    title: "AI考察に環境文脈を注入 + データを長期保存",
    tags: ["feature", "improvement"],
    items: [
      { label: "AI考察に環境情報が反映される", body: "気温・湿度・バイオーム・過去の検出履歴も考察の材料になりました。" },
      { label: "撮影地の地形・植生・気候も考慮", body: "場所の文脈からより正確な候補を出せるようになりました。" },
      { label: "スキャンデータを長期保存", body: "将来の研究に使える形で環境データを蓄積します。重要な瞬間だけを自動選別して保存します。" },
    ],
  },
  {
    version: "v0.7.0", date: "2026-03中旬", dateJa: "2026年3月中旬",
    title: "ライブスキャン・ウォーク・ライブマップ・マイ図鑑・クエスト",
    tags: ["feature"],
    items: [
      { label: "ライブスキャン", body: "カメラで見るだけでAIがリアルタイムに種を検出します。" },
      { label: "ウォークモード", body: "散歩のルートをGPSで記録しながら、マイクが鳴き声を自動検出します。" },
      { label: "ライブマップ（ログイン不要）", body: "アカウントなしで地域の生物多様性データを地図で見られます。" },
      { label: "マイ図鑑", body: "自分が観察・スキャン・音声検出で関わった種だけのコレクションになりました。" },
      { label: "クエスト", body: "「次に何を見るか」を動機づけるクエストシステムを再設計しました。" },
      { label: "写真をフルスクリーンで", body: "スワイプ・ピンチズームに対応しました。" },
      { label: "4種類のリアクション", body: "「足あと」「いいね」「すてき」「学び」を付けられます。" },
      { label: "和名で表示", body: "AIやGBIFの学名・英名を自動で日本語の和名に変換します。" },
    ],
  },
  {
    version: "v0.6.1", date: "2026-03", dateJa: "2026年3月",
    title: "「そうかも！」ワンタップ同定 + ナビゲーション整理",
    tags: ["feature", "improvement"],
    items: [
      { label: "AI考察から「そうかも！」でワンタップ同定", body: "AI提案をそのまま自分の同定票として送れるようになりました。" },
      { label: "自分の出会い方で種を解説", body: "場所・季節・見つけ方に応じたAI解説がマイ図鑑の種ページに生成されます。" },
      { label: "ナビゲーションをすっきり", body: "よく使う場所へすばやくたどり着けるようメニューを整理しました。" },
    ],
  },
  {
    version: "v0.6.0", date: "2026-03-14", dateJa: "2026年3月14日",
    title: "法人向け導線と図鑑をまとめて強化",
    tags: ["improvement"],
    items: [
      { label: "法人プランに応じた表示切り替え", body: "記録ボードやレポートを契約プランに応じた表示に整理しました。" },
      { label: "関連書籍の導線を追加", body: "種や観察に応じた関連書籍が表示されるようになりました。" },
    ],
  },
  {
    version: "v0.5.1–v0.5.9", date: "2026-03-11", dateJa: "2026年3月11日",
    title: "AIメモ・同定・料金・組織向けを一気に整理",
    tags: ["improvement"],
    items: [
      { label: "AIメモを読みやすく再構成", body: "「結論 → 手がかり → 次に確認すること」の順で読みやすくなりました。" },
      { label: "同定ステータスを2段階化", body: "「種まで確定」と「属・科レベルで安定」を区別して表示できるようになりました。" },
      { label: "料金体系を3プランに整理", body: "月額39,800円のスタンダードプランを設定しました。" },
      { label: "組織向け申込みをスムーズに", body: "招待リンク方式に変更し、申込み後すぐワークスペースへ入れるようにしました。" },
      { label: "AIの候補を同定作業につなげやすく", body: "候補名をタップすると近い記録を探せるリンクに変更しました。" },
      { label: "サイト全体の言葉を整理", body: "ナビゲーション・フッター・Aboutページのトーンを統一しました。" },
    ],
  },
  {
    version: "v0.5.0", date: "2026-03-10", dateJa: "2026年3月10日",
    title: "施設由来の記録に対応 + 投稿後にAI考察が自動生成",
    tags: ["feature"],
    items: [
      { label: "動物園・植物園の記録に対応", body: "施設で見た生きものを「施設由来」として投稿できます。野生記録とは区別して扱われます。" },
      { label: "投稿後にAI考察が自動生成", body: "写真・位置・季節をもとにAIが考察を自動で付けます。" },
      { label: "場所・季節も考慮した考察", body: "撮影地の都道府県・季節も補助証拠として参照されます。" },
    ],
  },
  {
    version: "v0.4.0", date: "2026-03-09", dateJa: "2026年3月9日",
    title: "みんなの同定をより賢く集計",
    tags: ["improvement"],
    items: [
      { label: "属・種レベルが混在しても集計できる", body: "複数人の同定から共通の分類群を自動で導き出せるようになりました。" },
      { label: "矛盾した同定を自動検知", body: "系統的に矛盾する同定が混在する場合、確定を自動で保留します。" },
    ],
  },
  {
    version: "v0.3.4", date: "2026-03-09", dateJa: "2026年3月9日",
    title: "個体数・環境情報の記録に対応",
    tags: ["feature"],
    items: [
      { label: "個体数を記録できる", body: "周辺の個体数をざっくり選べます。長期的な個体数変動の追跡に使われます。" },
      { label: "同定の根拠を記録できる", body: "体色・模様・形・行動・鳴き声などの根拠を残せます。" },
      { label: "環境バイオームと地面の状態", body: "森林・草地・湿地・都市など生息環境を記録できます。" },
    ],
  },
  {
    version: "v0.3.3", date: "2026-03-09", dateJa: "2026年3月9日",
    title: "ログイン復旧 & 表示バグ修正",
    tags: ["fix"],
    items: [
      { label: "Google・Xログインを復旧", body: "ボタンが一時的に表示されない問題を修正しました。" },
      { label: "投稿の表示順を修正", body: "過去の日付の写真がフィードに表示されない問題を直しました。" },
    ],
  },
  {
    version: "v0.3.1–v0.3.2", date: "2026-03-08", dateJa: "2026年3月8日",
    title: "AI同定・環境自動推定・ネイチャーポジティブガイド公開",
    tags: ["feature"],
    items: [
      { label: "「AIにきいてみる」機能", body: "写真から生きものの分類候補を返します。種の断定ではなく、参考情報として提案します。" },
      { label: "環境情報の自動入力", body: "写真の背景からバイオーム・野生/植栽・ライフステージをAIが推定し、フォームに反映します。" },
      { label: "ネイチャーポジティブガイドを公開", body: "散歩・生きもの観察・脳活性化の三位一体を科学的エビデンスで解説するページを新設しました。" },
    ],
  },
  {
    version: "v0.2.0–v0.3.0", date: "2026-03-04", dateJa: "2026年3月4日〜7日",
    title: "ダッシュボード刷新 + バッジ・スコア・ソーシャルログイン",
    tags: ["feature", "improvement", "fix"],
    items: [
      { label: "ダッシュボードを全面リニューアル", body: "ランクカード・デイリークエスト・カテゴリ探索を搭載した新デザインに。" },
      { label: "バッジ・スコアシステムが本格稼働", body: "記録数・同定貢献・連続投稿などでバッジが取得できます。" },
      { label: "Google・Xログイン対応", body: "ソーシャルログインでかんたんにアカウントを作れます。" },
      { label: "地域達成度をマイルストーン制に", body: "遠すぎる目標をやめ、次の一歩が手の届く距離に見えるようになりました。" },
      { label: "ヒートマップ・フィルターのバグ修正", body: "探索フィルターと地図表示の問題を修正しました。" },
    ],
  },
  {
    version: "v0.1.0–v0.1.2", date: "2025-11-01", dateJa: "2025年11月〜2026年1月",
    title: "プロトタイプ版スタート",
    tags: ["feature"],
    items: [
      { label: "フィールドノート", body: "写真から生きものを記録する入口を作りました。" },
      { label: "コミュニティ同定", body: "みんなで種の名前を提案・確認できます。" },
      { label: "地図探索", body: "周辺の生きものを地図で確認できます。" },
      { label: "企業向けレポート・地図埋め込み", body: "生物多様性レポートの自動生成と、自社サイトへの地図埋め込みに対応しました。" },
      { label: "PWA対応", body: "ホーム画面に追加できるようになりました。" },
    ],
  },
];

function renderChangelogBody(_basePath: string, _lang: SiteLang): string {
  const latest = CHANGELOG_ENTRIES[0];
  const tagLabel: Record<string, string> = { feature: "新機能", improvement: "改善", fix: "修正" };
  const tagClass: Record<string, string> = { feature: "cl-tf", improvement: "cl-ti", fix: "cl-tx" };
  const filterClass: Record<string, string> = { feature: "clf-feature", improvement: "clf-improvement", fix: "clf-fix" };

  const entriesHtml = CHANGELOG_ENTRIES.map((entry) => {
    const tagBadges = entry.tags
      .map((t) => `<span class="cl-tag ${tagClass[t] ?? ""}">${escapeHtml(tagLabel[t] ?? t)}</span>`)
      .join("");
    const itemsHtml = entry.items
      .map((item) => `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.body)}</li>`)
      .join("");
    return `<article class="cl-entry" data-tags="${escapeHtml(entry.tags.join(","))}">
      <time class="cl-date">${escapeHtml(entry.date)}</time>
      <div>
        <div class="cl-head">
          <span class="cl-ver">${escapeHtml(entry.version)}</span>
          ${tagBadges}
        </div>
        <h2 class="cl-title">${escapeHtml(entry.title)}</h2>
        <ul class="cl-items">${itemsHtml}</ul>
      </div>
    </article>`;
  }).join("");

  const filterBtns = (["feature", "improvement", "fix"] as const)
    .map((t) => `<button class="clf-btn ${filterClass[t]}" data-f="${t}">${tagLabel[t]}</button>`)
    .join("");

  return `<div class="cl-wrap">
    <section class="cl-hero">
      <p class="cl-eyebrow">Changelog</p>
      <h1 class="cl-h1">ikimon に最近起きた変化</h1>
      <p class="cl-lead">使う人に関係する変化だけを記録します。内部の実装名ではなく、見える変化で書く方針です。</p>
      ${latest ? `<div class="cl-latest">
        <div class="cl-live"></div>
        <div>
          <div class="cl-lm">
            <span class="cl-lm-ver">最新 — ${escapeHtml(latest.version)}</span>
            <time class="cl-lm-date">${escapeHtml(latest.dateJa)}</time>
          </div>
          <p class="cl-ls">${escapeHtml(latest.summary ?? latest.title)}</p>
        </div>
      </div>` : ""}
    </section>
    <div class="cl-filter" id="clf">
      <button class="clf-btn is-active" data-f="all">すべて</button>
      ${filterBtns}
    </div>
    <section class="cl-list" id="cll">${entriesHtml}</section>
    <script>(function(){var f=document.getElementById("clf"),l=document.getElementById("cll");if(!f||!l)return;f.addEventListener("click",function(e){var btn=e.target.closest(".clf-btn");if(!btn)return;var filter=btn.dataset.f||"all";f.querySelectorAll(".clf-btn").forEach(function(b){b.classList.toggle("is-active",b===btn)});l.querySelectorAll(".cl-entry").forEach(function(entry){var tags=(entry.dataset.tags||"").split(",");entry.style.display=filter==="all"||tags.includes(filter)?"":"none"})})})();</script>
  </div>`;
}

function laneForMeta(meta: MarketingPageMeta): RouteLane {
  switch (meta.activeNav) {
    case "business":
      return "business";
    case "community":
      return "group";
    case "learn":
      return meta.bodyPageId === "privacy" || meta.bodyPageId === "terms" || meta.bodyPageId === "faq" || meta.bodyPageId === "contact"
        ? "trust"
        : "learn";
    default:
      return "start";
  }
}

function relatedLanesFor(lane: RouteLane): RouteLane[] {
  switch (lane) {
    case "business":
      return ["business", "research", "trust"];
    case "group":
      return ["group", "start", "business"];
    case "trust":
      return ["trust", "learn", "business"];
    case "research":
      return ["research", "learn", "trust"];
    default:
      return ["learn", "start", "trust"];
  }
}

function renderLaneIntro(meta: MarketingPageMeta): string {
  const lane = laneForMeta(meta);
  const tiles: Record<RouteLane, Array<{ label: string; title: string; body: string }>> = {
    start: [
      { label: "start", title: "まず1件残す", body: "名前が分からなくても、写真・場所・時刻・メモから始められます。" },
      { label: "map", title: "次に歩く場所を見る", body: "地図とノートから、再訪しやすい場所を見つけます。" },
      { label: "trust", title: "あとから確かめる", body: "同定や公開範囲は、記録後にも整えられます。" },
    ],
    learn: [
      { label: "guide", title: "使い方を先に読む", body: "操作説明ではなく、どんな記録が後から育つかをまとめています。" },
      { label: "identify", title: "名前は途中でよい", body: "候補、似た種類、見分けるヒントを残せる状態をつくります。" },
      { label: "method", title: "強い主張は確認つき", body: "AI と人の役割、信頼レーン、研究利用の線引きを明示します。" },
    ],
    trust: [
      { label: "privacy", title: "場所を見せすぎない", body: "希少種や個人の行動が読めすぎる情報は安全側に寄せます。" },
      { label: "terms", title: "自然と人に配慮する", body: "採集や立入を促さず、観察を残すための前提をそろえます。" },
      { label: "contact", title: "迷ったら相談する", body: "個人利用、団体利用、研究利用を同じ入口から整理します。" },
    ],
    group: [
      { label: "thin", title: "濃いSNSにしない", body: "主役は一人の観察。つながりは、場所を見直すために薄く置きます。" },
      { label: "walk", title: "同じ場所を歩く", body: "観察会やテーマ調査は、同じ場所を複数人で見るための入口です。" },
      { label: "record", title: "まず通常記録へ", body: "特別なイベント機能より先に、1件ずつ残せる導線を優先します。" },
    ],
    business: [
      { label: "small", title: "小さく始める", body: "最初から重い専用画面を作らず、対象場所と運用を先に決めます。" },
      { label: "school", title: "学校・地域で使う", body: "観察会、授業、地域調査に必要な準備を短く整理します。" },
      { label: "contact", title: "相談内容を具体化する", body: "場所、人数、期間、公開範囲が分かると始め方を設計できます。" },
    ],
    research: [
      { label: "scope", title: "研究目的を先に置く", body: "必要な粒度、対象地域、公開範囲を最初に確認します。" },
      { label: "method", title: "言いすぎない", body: "努力量や確認状態のない強い主張は避けます。" },
      { label: "contact", title: "相談から始める", body: "既存データの扱いと新しい記録設計を分けて考えます。" },
    ],
    specialist: [
      { label: "scope", title: "権限範囲で見る", body: "authority scope に合う観察だけを確認対象にします。" },
      { label: "review", title: "根拠を残す", body: "approve / reject / note の理由を記録に残します。" },
      { label: "public", title: "公開面から説明する", body: "制度の考え方は methodology に寄せ、権限画面だけで閉じません。" },
    ],
    ops: [
      { label: "qa", title: "導線を一巡する", body: "ページ、状態、redirect、health を分けて確認します。" },
      { label: "sitemap", title: "正準を固定する", body: "XML sitemap と QA sitemap を同じ定義から生成します。" },
      { label: "release", title: "本番は PR 経由", body: "直接デプロイではなく、main merge 後の CI に任せます。" },
    ],
  };
  return `<section class="section lower-route-intro">
    <div class="lower-route-grid">
      ${tiles[lane].map((tile) => `<div class="lower-route-tile">
        <span>${escapeHtml(tile.label)}</span>
        <strong>${escapeHtml(tile.title)}</strong>
        <p>${escapeHtml(tile.body)}</p>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderGatewayGrid(basePath: string, lang: SiteLang, meta: MarketingPageMeta, currentRoutePath: string): string {
  const pages = relatedLanesFor(laneForMeta(meta))
    .flatMap((lane) => listPagesByLane(lane, "footer"))
    .filter((page) => page.path !== currentRoutePath)
    .slice(0, 6);
  if (pages.length === 0) {
    return "";
  }
  return `<section class="section route-gateway">
    <div class="section-header">
      <div>
        <div class="eyebrow">next route</div>
        <h2>次に見るページ</h2>
        <p>このページで終わらず、記録・信頼性・相談のどこへ進むべきかを近い順に置いています。</p>
      </div>
    </div>
    <div class="route-gateway-grid">
      ${pages.map((page) => `<a class="route-gateway-card" href="${escapeHtml(appendLangToHref(withBasePath(basePath, page.path), lang))}">
        <span class="eyebrow">${escapeHtml(page.lane)}</span>
        <h3>${escapeHtml(sitePageLabel(page, lang))}</h3>
        <p>${escapeHtml(sitePageSummary(page, lang))}</p>
        <span>開く</span>
      </a>`).join("")}
    </div>
  </section>`;
}

function renderPageDocument(basePath: string, lang: SiteLang, currentPath: string, page: SitePageDefinition, prependHtml = ""): string {
  const pageKey = page.marketing?.pageKey;
  if (!pageKey) {
    throw new Error(`missing_marketing_page_key:${page.path}`);
  }
  const availableLangs = localizedPageLangs(page);
  const hasLocalizedSeoPage = availableLangs.includes(lang);
  const meta = getShortCopy<MarketingPageMeta>(lang, "public", `marketing.pages.${pageKey}`);

  const bodyHtml = localizeInternalLinks(renderLongformPage(lang, meta.bodyPageId), basePath, lang);
  return renderSiteDocument({
    basePath,
    title: meta.title,
    description: meta.lead,
    activeNav: activeNavLabel(meta.activeNav, lang),
    lang,
    currentPath,
    canonicalPath: appendLangToHref(page.path, hasLocalizedSeoPage ? lang : "ja"),
    alternateLangs: availableLangs,
    noindex: !hasLocalizedSeoPage,
    extraStyles: LOWER_PAGE_STYLES,
    hero: {
      eyebrow: meta.eyebrow,
      heading: meta.heading,
      lead: meta.lead,
      tone: "light",
      align: "center",
      afterActionsHtml: renderAfterActions(basePath, lang, meta.afterActions),
    },
    body: `<div class="lower-page">
      ${renderLaneIntro(meta)}
      ${prependHtml}
      <section class="section doc-article"><article class="doc-prose">${bodyHtml}</article></section>
      ${renderGatewayGrid(basePath, lang, meta, page.path)}
    </div>`,
    footerNote: meta.footerNote ?? getShortCopy<string>(lang, "shared", "footerNotes.public"),
  });
}

export async function registerMarketingRoutes(app: FastifyInstance): Promise<void> {
  const redirectMap = new Map<string, string>([
    ...legacyRedirectEntries().map((entry) => [entry.source, entry.target] as const),
    ["/for-business/", "/for-business"],
    ["/explore/", "/explore"],
    ["/learn/", "/learn"],
    ["/home/", "/home"],
    ["/notes/", "/notes"],
    ["/map/", "/map"],
    ["/sitemap", "/sitemap.xml"],
    ["/sitemap.php", "/sitemap.xml"],
  ]);

  for (const [legacyPath, targetPath] of redirectMap) {
    app.get(legacyPath, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      return reply.redirect(appendLangToHref(withBasePath(basePath, targetPath), lang), 308);
    });
  }

  for (const page of listMarketingPages()) {
    app.get(page.path, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const url = requestUrl(request);
      const lang = detectLangFromUrl(url);
      const availableLangs = localizedPageLangs(page);
      if (isLanguagePrefixedRequest(url) && !availableLangs.includes(lang)) {
        return reply.redirect(appendLangToHref(withBasePath(basePath, "/"), lang), 302);
      }
      const prependHtml = page.marketing?.prepend === "contactForm" ? renderContactForm(basePath, lang) : "";
      reply.type("text/html; charset=utf-8");
      return renderPageDocument(
        basePath,
        lang,
        requestCurrentPath(request as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
        page,
        prependHtml,
      );
    });
  }

  app.post<{ Body: { category?: string; name?: string; email?: string; organization?: string; message?: string; sourceUrl?: string } }>(
    "/contact",
    async (_request, reply) => {
      reply.code(400);
      reply.type("application/json");
      return { ok: false, error: "use_api_endpoint", hint: "POST /api/v1/contact/submit" };
    },
  );
}
