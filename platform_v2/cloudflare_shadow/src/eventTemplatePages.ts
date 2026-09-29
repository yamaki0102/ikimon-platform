import {
  COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
  type CommonEventTemplateKey,
} from "../../src/services/commonEventTemplateContract";

export const EVENT_TEMPLATE_PREVIEW_ROUTES = Object.freeze({
  stampRally: "/preview/events/stamp-rally",
  missionQuest: "/preview/events/mission-quest",
  collaborativeObservation: "/preview/events/collaborative-observation",
  ryuyo: "/preview/events/ryuyo-insect-observation-park",
});

type PresetKey = Exclude<CommonEventTemplateKey, "ryuyo">;

interface EventPreset {
  key: PresetKey;
  title: string;
  description: string;
  steps: readonly string[];
}

const STAMP_RALLY_PRESET: EventPreset = Object.freeze({
  key: "stamp-rally",
  title: "スタンプラリー",
  description: "イベントごとに設定されたチェックポイントを回り、参加者自身の進み具合を確かめる体験です。",
  steps: ["チェックポイントと参加方法を確認する", "設定された方法でチェックインする", "自分の進み具合を振り返る"],
});
const MISSION_QUEST_PRESET: EventPreset = Object.freeze({
  key: "mission-quest",
  title: "Mission / Quest",
  description: "主催者が用意した観察ミッションを読み、必要な記録や確認の状態をたどる体験です。",
  steps: ["ミッションの内容と条件を読む", "必要な記録を残す", "確認状態と次の行動を見る"],
});
const COLLABORATIVE_OBSERVATION_PRESET: EventPreset = Object.freeze({
  key: "collaborative-observation",
  title: "みんなで観察",
  description: "共通の観察テーマへ参加し、自分の記録と、確認を経て共有できる情報を分けて扱う体験です。",
  steps: ["共通テーマと参加方法を確認する", "自分の観察記録を残す", "確認後に共有できる情報を見る"],
});

const PRESET_BY_ROUTE: Readonly<Record<string, EventPreset>> = Object.freeze({
  [EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally]: STAMP_RALLY_PRESET,
  [EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest]: MISSION_QUEST_PRESET,
  [EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation]: COLLABORATIVE_OBSERVATION_PRESET,
});

const PRESET_LINKS = Object.freeze([
  { route: EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally, label: "スタンプラリー" },
  { route: EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest, label: "Mission / Quest" },
  { route: EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation, label: "みんなで観察" },
]);

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/gu, (character) => entities[character] ?? character);
}

function makeNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (value) => value.toString(16).padStart(2, "0")).join("");
}

function relatedPresets(activeRoute: string): string {
  return PRESET_LINKS.map((link) => {
    const current = link.route === activeRoute ? " aria-current=\"page\"" : "";
    return "<li><a href=\"" + link.route + "\"" + current + ">" + escapeHtml(link.label) + "</a></li>";
  }).join("");
}

function previewNotice(): string {
  return "<aside class=\"notice\" aria-label=\"プレビューの状態\"><strong>イベント情報は未登録です</strong><p>このページでは開催日、主催者、費用、定員、申込み、参加実績を確認できません。申込みや記録の送信も行われません。</p></aside>";
}

function createFromTemplateLink(key: CommonEventTemplateKey): string {
  return "<p><a class=\"template-create-link\" href=\"/community/events/new?event_template=" + encodeURIComponent(key) + "\">このテンプレートで開催準備を始める</a></p>";
}

function renderPresetPage(route: string, preset: EventPreset): string {
  const steps = preset.steps.map((step) => "<li>" + escapeHtml(step) + "</li>").join("");
  return "<main class=\"page\" data-event-template-contract=\"" + COMMON_EVENT_TEMPLATE_CONTRACT_VERSION + "\" data-template-key=\"" + preset.key + "\">" +
    "<p class=\"kicker\">共通イベントテンプレートのプレビュー</p>" +
    "<h1>" + escapeHtml(preset.title) + "</h1>" +
    "<p class=\"lead\">" + escapeHtml(preset.description) + "</p>" +
    previewNotice() +
    createFromTemplateLink(preset.key) +
    "<section aria-labelledby=\"flow-heading\"><h2 id=\"flow-heading\">体験の流れ</h2><ol class=\"steps\">" + steps + "</ol></section>" +
    "<section class=\"state\" aria-labelledby=\"state-heading\"><h2 id=\"state-heading\">このページの状態</h2><p>テンプレートの内容を確認するためのページです。開催中のイベント、保存済みの進捗、参加者の投稿は表示していません。</p></section>" +
    relatedSection(route) +
    "</main>";
}

function relatedSection(activeRoute: string): string {
  return "<section class=\"related\" aria-labelledby=\"related-heading\"><h2 id=\"related-heading\">同じイベント基盤の体験</h2><ul>" +
    relatedPresets(activeRoute) +
    "<li><a href=\"" + EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo + "\">竜洋のイベントページプレビュー</a></li>" +
    "</ul></section>";
}

function renderRyuyoPage(): string {
  const fields = [
    ["開催日", "未登録"],
    ["主催者・開催承認", "未確認"],
    ["費用・定員", "未確認"],
    ["申込み", "受付なし"],
  ].map(([label, value]) => "<div class=\"fact\"><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("");
  return "<main class=\"page ryuyo\" data-event-template-contract=\"" + COMMON_EVENT_TEMPLATE_CONTRACT_VERSION + "\" data-template-key=\"ryuyo\">" +
    "<p class=\"kicker\">イベントページのプレビュー</p>" +
    "<h1>竜洋昆虫自然観察公園での<br class=\"wide-only\">自然観察イベント</h1>" +
    "<p class=\"lead\">竜洋での体験を想定したページ構成を確認できます。公園の公式告知や、開催決定を示すものではありません。</p>" +
    createFromTemplateLink("ryuyo") +
    "<section aria-labelledby=\"facts-heading\"><h2 id=\"facts-heading\">開催情報</h2><dl class=\"facts\">" + fields + "</dl></section>" +
    "<section class=\"state\" aria-labelledby=\"experience-heading\"><h2 id=\"experience-heading\">ひとつの基盤でつながる体験</h2><p>開催内容が確認された後、同じイベント設定からラリー、ミッション、みんなで観察の参加体験を構成します。ここでは申込み、投稿、ギャラリーを利用できません。</p>" +
    "<ul class=\"experience-list\">" +
    "<li><a href=\"" + EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally + "\">スタンプラリーを見る</a></li>" +
    "<li><a href=\"" + EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest + "\">Mission / Questを見る</a></li>" +
    "<li><a href=\"" + EVENT_TEMPLATE_PREVIEW_ROUTES.collaborativeObservation + "\">みんなで観察を見る</a></li>" +
    "</ul></section>" +
    "<p class=\"disclaimer\">開催日時、参加条件、費用、定員、主催者の確認がそろうまで、申込みは受け付けません。</p>" +
    "</main>";
}

function pageDocument(body: string, nonce: string): string {
  const css = [
    ":root{color-scheme:light;--action:#143f2e;--paper:#f7f7f3;--surface:#fff;--ink:#17211b;--muted:#465a4d;--line:#cbd5ca;--notice:#eef2e9}",
    "*{box-sizing:border-box}",
    "html{background:var(--paper);scroll-behavior:smooth}",
    "body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;font-size:16px;line-height:1.7}",
    ".topline{border-bottom:1px solid var(--line);background:var(--surface)}.topline-inner{max-width:1120px;margin:auto;padding:14px clamp(20px,5vw,56px);display:flex;justify-content:space-between;gap:16px;font-weight:700}.topline small{font-size:16px;color:var(--muted);font-weight:500}",
    ".page{max-width:1120px;margin:auto;padding:clamp(32px,7vw,76px) clamp(20px,5vw,56px) 72px}.kicker{margin:0 0 12px;color:var(--action);font-weight:700;letter-spacing:.04em}.page h1{max-width:18ch;margin:0;font-size:clamp(2.2rem,6vw,4.6rem);line-height:1.14;letter-spacing:-.035em}.page.ryuyo h1{max-width:28ch}.lead{max-width:62ch;margin:22px 0 36px;font-size:clamp(1.1rem,2.4vw,1.35rem);line-height:1.75}",
    ".notice{max-width:760px;padding:20px 22px;border-left:5px solid var(--action);background:var(--notice)}.notice p{margin:6px 0 0;color:var(--muted)}",
    ".page section{margin-top:48px}.page h2{margin:0 0 18px;font-size:1.5rem;line-height:1.35}.steps{counter-reset:step;list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.steps li{min-height:116px;padding:20px 22px 22px 0}.steps li+li{border-left:1px solid var(--line);padding-left:22px}.steps li::before{counter-increment:step;content:\"0\" counter(step);display:block;margin-bottom:8px;color:var(--action);font-weight:800;font-variant-numeric:tabular-nums}",
    ".state{max-width:760px}.state p{max-width:68ch}.related{max-width:760px}.related ul,.experience-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px}.related a,.experience-list a,.template-create-link{min-height:44px;display:inline-flex;align-items:center;padding:8px 14px;border:1px solid var(--action);border-radius:999px;color:var(--action);text-decoration:none;font-weight:700}.related a:hover,.experience-list a:hover,.template-create-link:hover{background:#e8eee7}.related a:focus-visible,.experience-list a:focus-visible,.template-create-link:focus-visible{outline:3px solid var(--action);outline-offset:3px}",
    ".facts{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--line)}.fact{padding:16px 14px 18px 0;border-bottom:1px solid var(--line)}.fact:nth-child(even){padding-left:18px;border-left:1px solid var(--line)}.fact dt{font-weight:700;color:var(--muted)}.fact dd{margin:4px 0 0;font-size:1.2rem;font-weight:700}.disclaimer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted)}",
    "a:focus-visible{outline:3px solid var(--action);outline-offset:3px}.skip-link{position:absolute;left:12px;top:-80px;z-index:2;min-height:44px;padding:8px 12px;background:#fff;color:var(--action)}.skip-link:focus{top:12px}",
    "@media(max-width:700px){.topline-inner{align-items:flex-start;flex-direction:column;gap:2px}.steps{grid-template-columns:1fr}.steps li{min-height:0;padding:16px 4px}.steps li+li{border-left:0;border-top:1px solid var(--line);padding-left:4px}.facts{grid-template-columns:1fr}.fact:nth-child(even){padding-left:0;border-left:0}.wide-only{display:none}}",
    "@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}",
  ].join("");
  return "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><title>イベントプレビュー — ZUKAN</title><style nonce=\"" + nonce + "\">" + css + "</style></head><body><a class=\"skip-link\" href=\"#main\">本文へ移動</a><header class=\"topline\"><div class=\"topline-inner\"><span>ZUKAN　イベントプレビュー</span><small>開催情報・申込みは未登録</small></div></header><div id=\"main\">" + body + "</div><footer class=\"topline\"><div class=\"topline-inner\"><span>プレビュー専用ページ</span><small>公開告知・参加受付ではありません</small></div></footer></body></html>";
}

export function handleEventTemplatePreviewPage(request: Request, pathname: string): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const preset = PRESET_BY_ROUTE[pathname];
  const isRyuyo = pathname === EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo;
  if (!preset && !isRyuyo) return null;

  const nonce = makeNonce();
  const body = preset ? renderPresetPage(pathname, preset) : renderRyuyoPage();
  return new Response(request.method === "HEAD" ? null : pageDocument(body, nonce), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src 'none'; connect-src 'none'; img-src 'none'; font-src 'self'; style-src 'nonce-" + nonce + "'",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}
