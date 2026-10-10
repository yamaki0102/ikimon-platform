/**
 * A discovery journal presentation over the existing Event, guest media and
 * organizer Review contracts. The active Worker owns all access/state checks.
 */
export const EVENT_DISCOVERY_VERSION = "event-discovery-v1" as const;
export const RYUYO_DISCOVERY_TITLE = "こんちゅうクンとめぐる、竜洋のとっておき。";
const RYUYO_FIELD_ID = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
const ASSET_ROOT = "/assets/event-discovery/";
/** This external application handoff is used by the explicitly marked tentative Ryuyo LP. */
export const RYUYO_PREVIEW_GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdzTD9OYUKNRiqoMX0bSRHg8sAhzbvJ2q_sjnDGnYdnG_qmUQ/viewform?usp=publish-editor";
const RYUYO_PREVIEW_EVENT_CODE = "RYUPREV1";
export const RYUYO_PREVIEW_TEST_JOIN_URL = "https://ikimon-life-cloudflare-staging.yamaki0102.workers.dev/community/events/RYUPREV1/join";

function previewFormCta(): string {
  let href = "";
  try {
    const url = new URL(RYUYO_PREVIEW_GOOGLE_FORM_URL);
    if (url.protocol === "https:" && !url.username && !url.password &&
      ((url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/")) || url.hostname === "forms.gle")) href = url.href;
  } catch { /* An unset handoff must never become an empty or local navigation. */ }
  return href
    ? `<a class="ed-button ed-primary" data-discovery-google-form href="${escapeHtml(href)}">参加申し込みはこちら<span aria-hidden="true"> →</span></a>`
    : '<button class="ed-button ed-primary" type="button" disabled>申し込みフォームを準備中</button>';
}

const RYUYO_PREVIEW_PHOTOS = {
  "hero": {
    "name": "ryuyo-photo-hero-910d4d1dcc80.webp",
    "width": 1400,
    "height": 933
  },
  "mantis": {
    "name": "ryuyo-photo-mantis-a263162fb3fc.webp",
    "width": 800,
    "height": 800
  },
  "dragonfly": {
    "name": "ryuyo-photo-dragonfly-e6c8709084c5.webp",
    "width": 800,
    "height": 800
  },
  "butterfly": {
    "name": "ryuyo-photo-butterfly-24ed2129e469.webp",
    "width": 800,
    "height": 800
  },
  "leaf": {
    "name": "ryuyo-photo-leaf-0b26a34b41a8.webp",
    "width": 800,
    "height": 800
  },
  "pond": {
    "name": "ryuyo-photo-pond-4c2957c4bb1a.webp",
    "width": 800,
    "height": 800
  },
  "path": {
    "name": "ryuyo-photo-path-0177adc2de81.webp",
    "width": 800,
    "height": 800
  }
} as const;
function previewPhoto(id: keyof typeof RYUYO_PREVIEW_PHOTOS, alt: string, eager = false): string {
  const asset = RYUYO_PREVIEW_PHOTOS[id];
  return `<img src="${ASSET_ROOT}${asset.name}" width="${asset.width}" height="${asset.height}" alt="${escapeHtml(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
function previewPhotoExamples(): string {
  const examples: Array<{ id: keyof typeof RYUYO_PREVIEW_PHOTOS; title: string; place: string; caption: string }> = [
    { id: "mantis", title: "葉っぱの裏に、いた！", place: "草むらのそば", caption: "しゃがんで見たら、葉っぱと同じ色の虫を発見。" },
    { id: "dragonfly", title: "ひと休みしているのかな。", place: "水辺の草", caption: "羽が透けて、きらきらして見えた。" },
    { id: "butterfly", title: "黄色い羽と、小さな花。", place: "小道の花", caption: "花から花へ。止まった瞬間を一枚。" },
    { id: "leaf", title: "穴あきの葉っぱも、おもしろい。", place: "小道の足元", caption: "だれが食べたんだろう。水のつぶも見つけた。" },
    { id: "pond", title: "水の中にも、空がある。", place: "池のほとり", caption: "風が吹くと、映った景色もゆらゆら。" },
    { id: "path", title: "見上げたら、この景色。", place: "木の下", caption: "虫を探す途中で、好きな光を見つけた。" },
  ];
  return examples.map((example) => `<figure class="ed-demo-tile"><button class="ed-gallery-open" type="button" data-discovery-demo data-demo-title="${escapeHtml(example.title)}" data-demo-place="${escapeHtml(example.place)}" data-demo-caption="${escapeHtml(example.caption)}" aria-label="${escapeHtml(example.title)}の写真とメモを見る（AI生成の例）">${previewPhoto(example.id, example.title + "（AI生成写真）")}<span class="ed-demo-caption"><span class="ed-sample-label">AI生成の例</span><strong>${escapeHtml(example.title)}</strong></span></button></figure>`).join("");
}

function previewCampaign(): string {
  return `<template data-discovery-preview-template data-preview-event-code="${RYUYO_PREVIEW_EVENT_CODE}">
    <div class="ed-preview-notice"><strong>仮日程・テスト公開</strong><span>開催は未決定です。申し込みもテスト用です。</span></div>
    <header class="ed-lp-hero">
      <div class="ed-lp-intro"><p class="ed-kicker">1日限定の自然観察イベント</p>
        <h1 class="ed-title"><span class="ed-title-preface">こんちゅうクンとめぐる、</span><span>竜洋のとっておき。</span></h1>
        <p class="ed-lp-lead">公園を歩いて、見つけて、写真に残そう。<br>こんちゅうクンと楽しむ、2時間の自然観察。</p>
        <dl class="ed-event-facts"><div class="ed-date-fact"><dt>仮日程</dt><dd><span class="ed-event-year">2026年</span><time datetime="2026-10-24">10月24日<span class="ed-event-weekday">（土）</span></time></dd></div><div class="ed-time-fact"><dt>時間</dt><dd>10:00〜12:00</dd></div><div class="ed-place-fact"><dt>会場</dt><dd>竜洋昆虫自然観察公園</dd></div></dl>
        <div class="ed-lp-action">${previewFormCta()}<p class="ed-help">Googleフォームで申し込む · 約1分</p></div>
        <div class="ed-lp-action"><a class="ed-button" data-discovery-test-link href="${RYUYO_PREVIEW_TEST_JOIN_URL}">写真のテスト投稿を試す<span aria-hidden="true"> →</span></a><p class="ed-help">会員登録・ログイン不要。テスト用ページで写真の保存・共有・削除を試せます。</p></div>
        <a class="ed-text-link" href="#discovery-community">写真とメモの例を見る<span aria-hidden="true"> ↓</span></a>
      </div><figure class="ed-lp-visual">${previewPhoto("hero", "親子で小道の自然を観察するイメージ（AI生成写真）", true)}<figcaption>AI生成の体験イメージ · 実際の会場・出演者の写真ではありません</figcaption></figure>
    </header>
    <section class="ed-lp-section" aria-labelledby="discovery-how"><h2 id="discovery-how">歩く、見つける、残す。</h2><ol class="ed-steps ed-photo-steps">
      <li>${previewPhoto("hero", "", false)}<div><span class="ed-step-number" aria-hidden="true">1</span><h3>こんちゅうクンと歩く</h3><p>公園の小道や水辺を、ゆっくり観察。</p></div></li>
      <li>${previewPhoto("mantis", "", false)}<div><span class="ed-step-number" aria-hidden="true">2</span><h3>「ここ、いいな」を探す</h3><p>虫も、葉っぱも、好きな景色も。</p></div></li>
      <li>${previewPhoto("dragonfly", "", false)}<div><span class="ed-step-number" aria-hidden="true">3</span><h3>写真を1〜3枚残す</h3><p>ひと言や場所のメモは、書きたいときだけ。</p></div></li>
    </ol><p class="ed-help ed-steps-image-note">写真はAI生成のイメージです。</p></section>
    <section class="ed-lp-section ed-lp-guide" aria-labelledby="discovery-guide"><h2 id="discovery-guide">こんちゅうクンと、<wbr>よく見てみよう。</h2><div><p>葉っぱの裏をのぞいたり、水辺で立ち止まったり。こんちゅうクンと一緒なら、いつもの小道も発見の場所に。</p><p class="ed-guide-note">むずかしい生きものの名前を知らなくても大丈夫。</p></div></section>
    <section id="discovery-day" class="ed-lp-section" aria-labelledby="discovery-day-heading"><div class="ed-own-heading"><h2 id="discovery-day-heading">当日の流れ</h2><p class="ed-help">10:00集合 → 12:00終了予定</p></div><ol class="ed-day-flow"><li>集合</li><li>公園を観察</li><li>写真を残す</li><li>希望者は共有</li></ol><div class="ed-lp-day-action"><a class="ed-button" data-discovery-photo-link hidden href="#discovery-day">写真の画面を開く<span aria-hidden="true"> →</span></a><p class="ed-help" data-discovery-day-state>写真投稿の受付状況を確認しています。</p></div><details class="ed-lp-record-help"><summary>写真の保存と共有について</summary><p class="ed-help">写真を選んだだけでは送信されません。「この写真を保存する」で保存し、共有を選んだ写真は自動確認を通るとすぐに掲載します。人物や個人情報などが含まれる可能性のある写真は確認待ちになります。共有しない写真は公開されません。未成年の方が共有する場合は、保護者の同意が必要です。</p></details><p class="ed-help ed-paper-guidance">紙のシートは、当日会場で配布します。</p>${statusRegion()}</section>
    <section id="discovery-community" class="ed-lp-section ed-lp-community" aria-labelledby="discovery-community-heading"><h2 id="discovery-community-heading">みんなの発見</h2><p class="ed-gallery-lead">みんなが見つけた、今日のとっておき。</p><p class="ed-help">共有OKになった写真だけが、ここに並びます。</p><details class="ed-published-gallery" data-discovery-published open hidden><summary>掲載されたテスト投稿を見る</summary><p class="ed-help">既存の写真2件は生成イラスト、紙の記録3件もテストです。</p><div class="ed-gallery-toolbar"><p class="ed-help" data-discovery-counts>掲載された発見を読み込んでいます。</p><button class="ed-button ed-small" type="button" data-discovery-gallery-refresh disabled>発見を再読み込み</button></div><p class="ed-status" data-discovery-gallery-status role="status" aria-live="polite"></p><div class="ed-journals" data-discovery-journals></div><button class="ed-button ed-load-more" type="button" data-discovery-gallery-more hidden>発見をもっと見る</button></details><div class="ed-demo-gallery" aria-label="写真とメモの掲載イメージ"><div class="ed-demo-heading"><h3>こんな発見を、写真とひと言で。</h3><span class="ed-sample-label">掲載イメージ</span></div><p class="ed-sample-notice">6枚はAI生成の掲載例です。実参加者の投稿・会場写真ではありません。写真を押すと、架空のメモの例が開きます。</p><div class="ed-demo-grid">${previewPhotoExamples()}</div></div><p class="ed-help ed-public-gallery-state" data-discovery-public-gallery-state>参加者の発見は、公開後にここで見られます。</p></section>
    <section id="discovery-signup" class="ed-lp-section ed-lp-signup" aria-labelledby="discovery-signup-heading"><div><h2 id="discovery-signup-heading">あなたの「とっておき」を、<wbr>見つけに行こう。</h2><p class="ed-signup-facts">2026年10月24日（土）<wbr> 10:00〜12:00</p><p class="ed-help">仮日程・テスト公開です。正式な開催案内ではありません。</p></div><div class="ed-lp-action">${previewFormCta()}<p class="ed-help">Googleフォームで申し込む · 約1分</p></div></section>
  </template>`;
}

export interface DiscoveryEventView {
  sessionId: string;
  title: string;
  eventCode: string;
  geminiConsentVersion?: string;
  geminiNoticeRequired?: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
  stateMessage?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function eventHref(sessionId: string, page: string): string {
  return `/events/${encodeURIComponent(sessionId)}/${page}`;
}

function illustration(id: "hero" | "discovery" | "memories", alt: string, eager = false): string {
  const width = id === "hero" ? 1600 : 800;
  const height = id === "hero" ? 900 : 800;
  return `<img src="${ASSET_ROOT}ryuyo-${id}.webp" width="${width}" height="${height}" alt="${escapeHtml(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function surface(content: string, kind: string, attributes = ""): string {
  return `<style>${EVENT_DISCOVERY_STYLES}</style><section class="ed" data-event-discovery="${kind}" ${attributes}>${content}</section><script>${observationEventDiscoveryScript()}</script>`;
}

function attrs(input: DiscoveryEventView): string {
  return `data-session-id="${escapeHtml(input.sessionId)}" data-event-code="${escapeHtml(input.eventCode)}"`;
}

function stateNotice(message?: string): string {
  return message ? `<p class="ed-notice">${escapeHtml(message)}</p>` : "";
}

function statusRegion(): string {
  return '<p class="ed-status" data-discovery-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1"></p>';
}

function dateLabel(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "日時は主催者の案内をご確認ください";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)) + "（日本時間）";
}

/** Campaign listing is resolved from explicit native eligibility; this page invents no event. */
export function renderObservationEventDiscoveryCampaign(): string {
  return surface(`${previewCampaign()}
    <p class="ed-kicker">竜洋昆虫自然観察公園</p>
    <div class="ed-intro">
      <h1 class="ed-title"><span class="ed-title-preface">こんちゅうクンとめぐる、</span><span>竜洋のとっておき。</span></h1>
      <div><p>気に入った場所。<br>初めて見つけた、小さなこと。<br>今日の「ここ、いいな」を、写真で３枚まで。</p><p class="ed-help">写真ごとのコメントは任意。共有を選んだ写真は、写り込みなどの自動確認を通ると、すぐ「みんなの発見」に掲載されます。人物や個人情報が写る写真などは確認待ちになります。</p><a class="ed-button ed-primary" href="#discovery-signup">参加を申し込む<span aria-hidden="true">→</span></a><div class="ed-intro-links"><a class="ed-text-link" href="#discovery-day">当日、写真を投稿する</a><a class="ed-text-link" href="#discovery-community">みんなの発見</a></div></div>
    </div>
    <figure class="ed-hero">${illustration("hero", "木漏れ日の小道と池を巡る自然観察のイラスト", true)}<figcaption>イラストはイメージです</figcaption></figure>
    <ul class="ed-ribbon" aria-label="参加のしかた"><li>あだ名は任意</li><li>写真は１枚から</li><li>コメントも任意</li></ul>
    <section class="ed-section" aria-labelledby="discovery-how"><p class="ed-kicker">見つけたあとの、３ステップ</p><h2 id="discovery-how">あなたが見つけた、竜洋を残そう。</h2>
      <ol class="ed-steps"><li><span class="ed-step-number" aria-hidden="true">01</span><h3>写真を選ぶ。</h3><p>気に入った場所や発見を、スマートフォンから１枚ずつ。カメラで撮ることもできます。全部で３枚まで。</p></li><li><span class="ed-step-number" aria-hidden="true">02</span><h3>ひと言を、添えても。</h3><p>写真ごとに「ここがよかった」を書けます。コメントも場所のメモも、空欄で大丈夫です。</p></li><li><span class="ed-step-number" aria-hidden="true">03</span><h3>写真を保存する。</h3><p>共有するかを選んで保存。問題のない写真はすぐに、人物などが写る写真は確認後に、ひとり分のノートとして集まります。</p></li></ol><p class="ed-help ed-footer-note">写真を選んだだけでは送信・掲載されません。主催者が選んだとっておきは、ひと言のコメントを添えて紹介できます。</p>
    </section>
    <section class="ed-section ed-story">${illustration("discovery", "葉の上のテントウムシと黄色いチョウ、虫眼鏡のイラスト")}<div><p class="ed-kicker">発見のヒント</p><h2>むずかしい名前は、<br>知らなくて大丈夫。</h2><p>葉っぱの重なり、きらっと光る水辺、目をこらして見つけた虫。気になったものを、よく見てみよう。</p><p>「思ったより小さかった」「この場所が好き」。そんなひと言も、あなたらしい発見です。</p></div></section>
    <section id="discovery-signup" class="ed-section ed-participation" aria-labelledby="discovery-signup-heading"><div class="ed-own-heading"><div><p class="ed-kicker">事前の参加申し込み</p><h2 id="discovery-signup-heading">開催日を選んで、申し込もう。</h2></div><button class="ed-button ed-small" type="button" data-discovery-campaign-refresh>開催日を再読み込み</button></div><p>ログインは不要です。申し込みに参加コードは必要ありません。</p>${statusRegion()}
      <div class="ed-form"><label for="discovery-occurrence">開催回</label><select id="discovery-occurrence" data-discovery-occurrence-select disabled><option value="">開催日を読み込んでいます</option></select></div><p class="ed-help"><a class="ed-text-link" href="/events/ryuyo#discovery-signup">公開されている開催回から選び直す</a></p><div class="ed-event-summary" data-discovery-occurrence-summary><p>公開されている開催日を確認しています。</p></div>
      <form class="ed-form" data-discovery-application-form hidden><label for="discovery-application-name">あだ名や下の名前を、よければどうぞ<span class="ed-optional">任意</span></label><input id="discovery-application-name" name="display_name" maxlength="32" autocomplete="nickname" placeholder="例：ゆう、むしずき"><p class="ed-help">空欄でも申し込めます。本名や連絡先は書かないでください。呼び名は、この回の主催者が確認します。</p><button class="ed-button ed-primary" type="submit">申し込みを送る<span aria-hidden="true"> →</span></button><p class="ed-help">これは申込の受領です。参加確定や定員確保ではありません。メール等の通知は送信しません。</p></form><p class="ed-status" data-discovery-application-status role="status" aria-live="polite"></p>
    </section>
    <section id="discovery-day" class="ed-section ed-day" aria-labelledby="discovery-day-heading"><div><p class="ed-kicker">参加する当日に</p><h2 id="discovery-day-heading">写真とひと言を、残そう。</h2><p>主催者が受付を始めると、写真の画面を開けます。写真を選び、コメントを添えたら「この写真を保存する」を押してください。</p><p class="ed-help" data-discovery-day-state>開催回を選ぶと、写真の受付状況を確認できます。</p><a class="ed-button ed-primary" data-discovery-photo-link hidden href="#discovery-signup">写真を投稿する<span aria-hidden="true"> →</span></a></div><details class="ed-code-alternative"><summary>参加コードで開催回を開く</summary><p class="ed-help">担当者から参加コードの案内が届いている方はこちら。</p><form data-discovery-code-form><label for="discovery-event-code">参加コード</label><input id="discovery-event-code" name="event_code" maxlength="64" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button class="ed-button" type="submit">この回を開く</button></form></details></section>
    <section id="discovery-community" class="ed-section" aria-labelledby="discovery-community-heading"><p class="ed-kicker">みんなの発見</p><h2 id="discovery-community-heading">それぞれの「いいな」が、集まる。</h2><p>選んだ開催回の、掲載済みの写真とコメントです。本人が共有を選び、写り込みなどを確認した記録を、参加者ごとにまとめています。</p><div class="ed-gallery-toolbar"><p class="ed-help" data-discovery-counts>開催回を選ぶと、その回の発見がここに並びます。</p><button class="ed-button ed-small" type="button" data-discovery-gallery-refresh disabled>新しい発見を読み込む</button></div><p class="ed-status" data-discovery-gallery-status role="status" aria-live="polite"></p><div class="ed-journals" data-discovery-journals></div><button class="ed-button ed-load-more" type="button" data-discovery-gallery-more hidden>次のノートを見る</button></section>
    <section class="ed-section ed-story">${illustration("memories", "3枚の写真枠を並べた観察ノートと鉛筆のイラスト")}<div><p class="ed-kicker">その日の、とっておき</p><h2>１枚でも、２枚でも。<br>自分のペースで。</h2><p>写真やコメントをみんなに見せるかは、一つずつ選べます。共有しない写真も、自分と主催者だけの記録として残せます。</p><p>紙のシートは当日、会場でお配りします。絵や言葉で発見を残し、共有したい記録は担当者へ。内容を確認してから掲載します。歩いて楽しむだけでも大丈夫です。</p></div></section>
    <section class="ed-organizer-link"><div><p>担当者の方へ</p><p class="ed-help">日時と案内を入れて、この企画の開催準備を始められます。</p></div><a class="ed-text-link" href="/community/events/new?event_template=ryuyo&amp;field_id=${RYUYO_FIELD_ID}">この企画で開催準備を始める<span aria-hidden="true"> →</span></a></section>
  `, "campaign");
}

export function renderObservationEventDiscoveryJoin(input: DiscoveryEventView & {
  isAuthenticated?: boolean;
  displayName?: string | null;
  canJoin?: boolean;
  canViewGallery?: boolean;
  teams?: readonly { teamId: string; name: string }[];
}): string {
  const teams = input.teams ?? [];
  return surface(`
    <a class="ed-back" href="/events/ryuyo?event=${encodeURIComponent(input.eventCode)}">企画の楽しみ方<span aria-hidden="true"> ↗</span></a>
    ${stateNotice(input.stateMessage)}
    <div class="ed-welcome"><div><p class="ed-kicker">あなたの発見ノート</p><h1>${escapeHtml(input.title)}</h1><p class="ed-help">${escapeHtml(dateLabel(input.startedAt))}</p><p>気に入った場所や、ちょっとした発見を写真で３枚まで。名前もコメントも、入れたければ。</p></div>${illustration("discovery", "小さな発見を楽しむ、葉と虫眼鏡のイラスト")}</div>
    ${input.canJoin === false ? '<p class="ed-notice">いまは参加の受付をしていません。主催者の案内をご確認ください。</p>' : `<form class="ed-form ed-join-form" data-discovery-join-form novalidate>
      <label for="discovery-nickname">あだ名や下の名前を、よければどうぞ<span class="ed-optional">任意</span></label><input id="discovery-nickname" name="display_name" value="${escapeHtml(input.displayName)}" maxlength="32" autocomplete="nickname" placeholder="例：ゆう、むしずき" aria-describedby="discovery-name-help"><p class="ed-help" id="discovery-name-help">空欄でも参加できます。本名や連絡先は書かないでください。メール・電話番号などを含む呼び名は公開しません。</p>
      ${teams.length ? `<label for="discovery-team">班<span class="ed-optional">任意</span></label><select id="discovery-team" name="team_id"><option value="">選ばない</option>${teams.map((team) => `<option value="${escapeHtml(team.teamId)}">${escapeHtml(team.name)}</option>`).join("")}</select>` : ""}
      <label class="ed-check"><input type="checkbox" name="is_minor"><span>参加者に未成年が含まれます</span></label>
      ${input.geminiConsentVersion ? `<aside class="ed-notice ed-ai-notice"><h2>共有写真の安全確認と掲載について</h2><p>この開催回では、共有を選んだ写真と任意のコメント・場所のメモを、人物や個人情報などを確認するため Google Gemini に送信します。AI判定でリスクが検出されなかった共有写真は、主催者の個別確認前に、リンクを知っている人が見られる「みんなの発見」に掲載されます。判定できない写真や人物・個人情報などが含まれる可能性のある投稿は掲載せず、主催者の確認待ちにします。</p><p>写真を共有しない選択もできます。人物、名札、連絡先などが写った写真や個人情報を含むメモは共有しないでください。掲載後も取り下げられます。</p><p class="ed-help">「ノートを始める」を押して参加すると、この竜洋の開催回に限り、上記の安全確認と公開の取り扱いに同意したものとして記録します。</p></aside>` : ""}
      <p class="ed-help">${input.isAuthenticated ? "このイベントでの呼び名を使います。" : "ログインは不要です。"}同じ端末・ブラウザから、自分の記録を見返せます。写真や呼び名の公開は、あとで選べます。</p>
      ${statusRegion()}<button class="ed-button ed-primary" type="submit" data-discovery-join-submit>名前なしでも、ノートを始める<span aria-hidden="true">→</span></button>
    </form>`}
    ${input.canViewGallery ? `<p><a class="ed-button" href="${escapeHtml(eventHref(input.sessionId, "discoveries"))}">みんなの発見を見る<span aria-hidden="true"> →</span></a></p>` : ""}
    <p class="ed-help ed-footer-note">紙のシートは当日、会場でお配りします。写真を撮らずに、歩いて楽しむだけでも大丈夫です。</p>
  `, "join", `${attrs(input)}${input.geminiConsentVersion ? ` data-discovery-gemini-consent-version="${escapeHtml(input.geminiConsentVersion)}"` : ""}`);
}

export function renderObservationEventDiscoveryCapture(input: DiscoveryEventView & {
  displayName?: string | null;
  isMinor?: boolean;
  canSubmit?: boolean;
  canManage?: boolean;
}): string {
  const title = input.displayName?.trim() ? `${input.displayName.trim()}の発見ノート` : "自分の発見ノート";
  return surface(`
    ${stateNotice(input.stateMessage)}
    <header class="ed-capture-heading"><p class="ed-kicker">竜洋のとっておき</p><h1>今日の発見を、写真に。</h1><p>１枚から。今日の「ここ、いいな」を３枚まで。</p></header>
    ${input.geminiNoticeRequired ? `<p class="ed-notice">新しい写真を投稿するには、参加時の案内を確認して再チェックインしてください。保存済みの記録は、ここで確認・取り下げできます。<a href="/community/events/${encodeURIComponent(input.eventCode)}/join">参加時の案内を確認する</a></p>` : ""}
    ${statusRegion()}
    ${input.canSubmit === true ? `<form class="ed-form ed-capture-form" data-discovery-media-form>
      <h2 class="ed-sr-only" data-discovery-capture-heading>写真を１枚、残そう。</h2>
      <fieldset data-discovery-capture-fields disabled><legend class="ed-sr-only">写真とひと言</legend>
      <div class="ed-photo-inputs"><div><label class="ed-photo-picker" for="discovery-photo"><span class="ed-photo-plus" aria-hidden="true">＋</span><strong>写真を選ぶ</strong><span class="ed-help">端末にある写真から</span></label><input class="ed-file" id="discovery-photo" name="media" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="discovery-photo-help"></div><div><label class="ed-photo-picker ed-camera-picker" for="discovery-camera"><svg class="ed-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6.5h3l1.5-2h7l1.5 2h3v13H4z"/><circle cx="12" cy="13" r="3.5"/></svg><strong>カメラで撮る</strong><span class="ed-help">いま見つけたものを</span></label><input class="ed-file" id="discovery-camera" name="camera_media" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby="discovery-photo-help"></div></div>
      <p class="ed-help" data-discovery-limit-message>保存済みの写真を確認してから追加できます。</p><p id="discovery-photo-help" class="ed-help">人の顔・名札・車の番号が写らない写真を。選ぶだけでは保存・掲載されません。</p>
      <div class="ed-selected-preview" data-discovery-photo-preview></div>
      <div data-discovery-photo-options hidden>
      <details class="ed-caption-options"><summary>コメントや場所を添える<span class="ed-optional">任意</span></summary>
      <label for="discovery-spot">どこが気に入った？<span class="ed-optional">任意</span></label><input id="discovery-spot" name="spot_label" maxlength="80" placeholder="例：木かげの小道">
      <label for="discovery-caption">写真へのコメント<span class="ed-optional">任意</span></label><textarea id="discovery-caption" name="caption" maxlength="280" rows="3" placeholder="例：葉っぱの裏に、小さな虫を見つけた！"></textarea></details>
      <label class="ed-check"><input name="private_storage_consent" type="checkbox" value="yes" required><span>写真を保存し、自分と主催者が確認することに同意します。</span></label>
      <label class="ed-check"><input name="creator_rights_attestation" type="checkbox" value="yes" required><span>自分で撮った写真、またはこの用途で使う許可を得た写真です。</span></label>
      <div class="ed-share-choice"><label class="ed-check"><input name="gallery_consent" type="checkbox" value="yes"><span>みんなの発見に載せてもよい<span class="ed-help">この写真・コメント・場所のメモ・呼び名を、リンクを知っている人が見られます。</span></span></label><p class="ed-help">共有を選んだ写真は、保存後にメタデータを取り除き、参加時に案内した自動確認を行います。問題なしと判定された写真は掲載され、確認できない内容や人物・個人情報の可能性がある写真は主催者の確認待ちになります。共有を選ばなくても保存でき、掲載後も取り下げられます。</p>
      <label class="ed-check" data-discovery-guardian-row hidden><input name="guardian_gallery_consent" type="checkbox" value="yes"><span>このギャラリーへの公開について、保護者の同意があります。</span></label></div>
      <button class="ed-button ed-primary" type="submit" data-discovery-save>この写真を保存する</button></div></fieldset>
    </form>` : '<p class="ed-notice">いまは写真を追加できません。保存済みの記録はここで確認できます。</p>'}
    <section class="ed-saved-photos" id="saved-photos" aria-labelledby="saved-photos-heading"><div class="ed-own-heading"><div><h2 id="saved-photos-heading">残した写真</h2><p class="ed-help" data-discovery-photo-count></p></div><button class="ed-button ed-small" type="button" data-discovery-refresh>再読み込み</button></div><p class="ed-help">${escapeHtml(title)}</p><div class="ed-own-journal" data-discovery-receipts><p class="ed-help">保存した記録を読み込んでいます。</p></div></section>
    <footer class="ed-event-footer"><nav aria-label="この企画のページ"><a class="ed-back" href="/events/ryuyo?event=${encodeURIComponent(input.eventCode)}">企画のページへ</a><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "discoveries"))}">みんなの発見を見る</a>${input.canManage ? `<a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "console"))}">主催者の画面へ</a>` : ""}</nav><p class="ed-help">${escapeHtml(input.title)}</p><details><summary>写真の扱い・紙での参加について</summary><p class="ed-help">写真は１枚ずつ、JPEG / PNG / WebP・12 MBまで。共有しない写真は、自分と主催者だけが確認できます。同じ端末・ブラウザから記録を見返し、取り下げられます。</p><p class="ed-help">紙のシートは当日、会場でお配りします。紙で残した発見を共有したい方は、担当者へお声がけください。</p></details></footer>
  `, "capture", `${attrs(input)} data-is-minor="${input.isMinor === true}"`);
}

export function renderObservationEventDiscoveryGallery(input: DiscoveryEventView & { canManage?: boolean }): string {
  return surface(`
    <div class="ed-context"><a class="ed-back" href="/events/ryuyo?event=${encodeURIComponent(input.eventCode)}">竜洋のとっておき</a><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "rally"))}">自分のノートへ</a></div>
    <header class="ed-gallery-heading"><p class="ed-kicker">${escapeHtml(input.title)}</p><h1>みんなの、とっておき。</h1><p>同じ場所を歩いても、見つけるものはひとりずつ。<br>写真とひと言で集まった、小さな発見ノートです。</p></header>
    <div class="ed-gallery-toolbar"><p class="ed-help" data-discovery-counts>掲載されたノートを読み込んでいます。</p><button class="ed-button ed-small" type="button" data-discovery-refresh>新しい発見を読み込む</button></div>
    ${statusRegion()}<div class="ed-journals" data-discovery-journals></div><button class="ed-button ed-load-more" type="button" data-discovery-more hidden>続きを見る</button>
    <p class="ed-help ed-footer-note">本人が共有を選び、写り込みなどを確認した記録を掲載しています。このページはリンクを知っている人が見られます。</p>
    ${input.canManage ? `<p><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "console"))}">主催者の確認画面へ</a></p>` : ""}
  `, "gallery", attrs(input));
}

export function renderObservationEventDiscoveryPrint(input: { title?: string; eventCode?: string; sessionId?: string } = {}): string {
  const back = input.sessionId ? eventHref(input.sessionId, "rally") : "/events/ryuyo";
  return surface(`
    <div class="ed-print-toolbar"><a class="ed-back" href="${escapeHtml(back)}">ノートへ戻る</a><button class="ed-button ed-primary" type="button" data-discovery-print-button>このシートを印刷する</button></div>
    <div class="ed-print-sheet"><p class="ed-kicker">竜洋昆虫自然観察公園 · 発見ノート</p><h1>${escapeHtml(input.title || RYUYO_DISCOVERY_TITLE)}</h1><p>好きだな、おもしろいなと思った場所や発見を、３つまで。絵でも言葉でも、１つだけでも大丈夫。</p><p class="ed-print-name">あだ名・下の名前（書きたければ）：<span></span></p>
    ${[1, 2, 3].map((number) => `<section class="ed-print-note"><h2><span>${number}</span> 気に入った場所・見つけたもの</h2><div class="ed-print-writing"></div><p>ここがよかった・気づいたこと：</p><div class="ed-print-line"></div></section>`).join("")}
    <p class="ed-print-choice">□ この紙だけで持ち帰る　　□ みんなの発見に載せてもよい</p><p class="ed-help">共有したいときは担当者へ。掲載前に、公開する内容と呼び名を確認します。未成年の方は保護者と一緒に確認してください。</p>${input.eventCode ? `<p class="ed-help">参加コード：${escapeHtml(input.eventCode)}</p>` : ""}</div>
  `, "print", "data-discovery-print");
}

/** Inserted into the existing authenticated organizer console only. */
export function renderObservationEventDiscoveryOrganizer(input: { sessionId: string; sessionClosed?: boolean }): string {
  return surface(`
    <section class="ed-campaign-settings"><h2>開催回の案内と事前申し込み</h2><p>参加する人が開催日を選べるように、案内と申込受付を設定します。写真の受付開始は「企画の準備と進行」で操作します。</p><form class="ed-form" data-discovery-campaign-settings><fieldset disabled><label class="ed-check"><input name="listed" type="checkbox"><span>この開催回を竜洋の企画ページに表示</span></label><p class="ed-help" data-discovery-listing-permission></p><label class="ed-check"><input name="applications_open" type="checkbox"><span>事前申し込みを受け付ける</span></label><button class="ed-button ed-primary" type="submit">案内と申込受付を保存する</button></fieldset></form><p class="ed-status" data-discovery-settings-status role="status" aria-live="polite"></p><p><a class="ed-text-link" data-discovery-campaign-link hidden href="/events/ryuyo">この開催回の案内ページを開く</a></p><p class="ed-help">企画ページに表示しない開催回も、案内リンクで共有できます。全体のイベント一覧には掲載しません。</p><h3>申し込みの状況</h3><p data-discovery-participant-counts>申し込みの状況を確認しています。</p></section>
    <div class="ed-own-heading"><div><p class="ed-kicker">写真と紙の発見ノート</p><h2>みんなに見せる内容を確認</h2></div><button class="ed-button ed-small" type="button" data-discovery-refresh>再読み込み</button></div>
    <p>写真・呼び名・メモの内容と、本人の共有の希望を確認します。確認がそろった記録が、参加者ごとのノートに集まります。</p><p><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "discoveries"))}">みんなの発見を開く</a>　<a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "print"))}">紙のシートを開く</a></p>
    ${statusRegion()}<div class="ed-review-filters" role="group" aria-label="記録の確認状態"><button type="button" class="ed-button ed-small" data-discovery-review-filter="pending" aria-pressed="true">確認待ち</button><button type="button" class="ed-button ed-small" data-discovery-review-filter="reviewed" aria-pressed="false">確認済み・紹介を編集</button><button type="button" class="ed-button ed-small" data-discovery-review-filter="all" aria-pressed="false">すべて</button></div><p class="ed-help" data-discovery-review-count></p><div data-discovery-review-list><p class="ed-help">記録を読み込んでいます。</p></div><button class="ed-button ed-load-more" type="button" data-discovery-more hidden>次の記録を読み込む</button>
    <details class="ed-paper-entry"><summary>紙で届いた発見を入力する</summary><p>本人に公開の希望を確認して、紙の内容を入力します。公開しない記録も保存できます。</p>
      <form class="ed-form" data-discovery-paper-form>
      <label for="discovery-paper-name">紙に書かれた呼び名<span class="ed-optional">任意</span></label><input id="discovery-paper-name" name="nickname" maxlength="32" autocomplete="off"><p class="ed-help">あだ名か下の名前だけ。書かれていなければ空欄で保存します。</p>
      ${[1, 2, 3].map((number) => `<fieldset class="ed-paper-fields" data-paper-note><legend>発見 ${number}${number > 1 ? "（任意）" : ""}</legend><label for="discovery-paper-spot-${number}">気に入った場所</label><input id="discovery-paper-spot-${number}" name="spot_${number}" maxlength="80"><label for="discovery-paper-note-${number}">ひと言・発見したこと</label><textarea id="discovery-paper-note-${number}" name="caption_${number}" maxlength="280" rows="2"></textarea></fieldset>`).join("")}
      <label class="ed-check"><input name="is_minor" type="checkbox"><span>未成年の方の記録です</span></label><label class="ed-check"><input name="gallery_consent" type="checkbox"><span>本人が、呼び名とメモをみんなの発見に掲載することを希望しています</span></label><label class="ed-check" data-discovery-guardian-row hidden><input name="guardian_gallery_consent" type="checkbox"><span>このギャラリーへの公開について、保護者の同意を確認しました</span></label><p class="ed-help">掲載を選んだ記録も、保存後に内容を確認してから公開します。</p><button class="ed-button ed-primary" type="submit">紙の発見を保存する</button><p class="ed-status" data-discovery-paper-status role="status" aria-live="polite"></p></form>
    </details>
  `, "organizer", `data-session-id="${escapeHtml(input.sessionId)}"`);
}

export const EVENT_DISCOVERY_STYLES = `
.ed{color:#17211b;font-size:16px;line-height:1.8;overflow-wrap:anywhere}.ed *{box-sizing:border-box}.ed [hidden]{display:none!important}.ed p{margin:0 0 16px}.ed h1,.ed h2,.ed h3{font-weight:700;color:#143f2e;line-height:1.45}.ed h1{font-size:32px;margin:0 0 16px}.ed h2{font-size:26px;margin:0 0 20px}.ed h3{font-size:20px;margin:0 0 12px}.ed input,.ed select,.ed textarea,.ed button{font:inherit}.ed input,.ed textarea,.ed select{max-width:100%;color:#17211b}.ed a{color:#0055ad;text-underline-offset:4px}.ed button,.ed a,.ed input,.ed select,.ed textarea{touch-action:manipulation}.ed .ed-kicker{font-size:14px;letter-spacing:.06em;font-weight:700;color:#55615a;margin:0 0 16px}.ed .ed-help{font-size:14px;color:#55615a;line-height:1.75}.ed .ed-button{display:inline-flex;justify-content:center;align-items:center;gap:12px;min-width:44px;min-height:48px;border:1px solid #68746c;border-radius:4px;padding:10px 20px;background:#fff;color:#17211b;font-weight:700;text-decoration:none;line-height:1.5;white-space:normal;cursor:pointer}.ed .ed-button.ed-primary{background:#143f2e;color:#fff;border-color:#143f2e}.ed .ed-button:not(:disabled):hover{background:#eef2e9}.ed .ed-button.ed-primary:not(:disabled):hover{background:#0f3023}.ed .ed-button:disabled{color:#55615a;background:#eef0ec;cursor:default;border-color:#a0a8a2}.ed .ed-button.ed-small{font-size:14px;padding:8px 14px;min-height:44px}.ed :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid #000;outline-offset:3px;box-shadow:0 0 0 6px #ffd43d}.ed .ed-status:focus{outline:2px solid #143f2e;outline-offset:4px}.ed .ed-text-link,.ed .ed-back{display:inline-flex;align-items:center;min-height:44px;line-height:1.5}.ed .ed-text-link{font-weight:700}.ed .ed-back{font-size:14px}.ed .ed-intro{display:grid;grid-template-columns:1.35fr 1fr;gap:32px;align-items:end;margin:24px 0 28px}.ed .ed-title{font-size:46px;letter-spacing:.01em;margin:0}.ed .ed-title>span{display:block}.ed .ed-title .ed-title-preface{font-size:28px;margin-bottom:8px}.ed .ed-intro p{margin:0 0 20px}.ed .ed-hero{margin:0}.ed .ed-hero img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:8px}.ed .ed-hero figcaption{font-size:14px;color:#55615a;text-align:right;margin-top:6px}.ed .ed-ribbon{list-style:none;margin:0;padding:24px 0 32px;display:flex;justify-content:center;gap:32px;border-bottom:1px solid #dde2dc}.ed .ed-ribbon li{display:flex;align-items:center;gap:12px}.ed .ed-ribbon li::before{content:"";display:block;width:8px;height:8px;border-radius:50%;background:#e2b63c}.ed .ed-section{padding:48px 0;border-bottom:1px solid #dde2dc;scroll-margin-top:96px}.ed .ed-steps{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;margin:0;padding:0}.ed .ed-step-number{font-size:14px;font-weight:700;color:#143f2e;letter-spacing:.12em;display:block;margin-bottom:8px}.ed .ed-steps p{color:#55615a;margin:0}.ed .ed-story{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.55fr);align-items:center;gap:48px}.ed .ed-story>img{width:100%;height:auto;aspect-ratio:1;border-radius:8px}.ed .ed-story h2{font-size:28px}.ed .ed-code{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;scroll-margin-top:96px}.ed .ed-code input{display:block;width:100%;margin:8px 0 16px;min-height:48px;padding:10px 12px;border:1px solid #68746c;border-radius:4px;background:#fff}.ed .ed-code label{font-weight:700}.ed .ed-intro-links{display:flex;gap:12px 24px;flex-wrap:wrap;margin-top:20px}.ed .ed-participation{padding:32px;background:#eef2e9;border-radius:8px}.ed .ed-event-summary{margin:20px 0}.ed .ed-event-summary h3{margin-bottom:8px}.ed .ed-day{display:grid;grid-template-columns:1.5fr 1fr;gap:40px}.ed .ed-code-alternative{align-self:start}.ed .ed-code-alternative input{display:block;width:100%;min-height:48px;margin:8px 0 16px;padding:10px;border:1px solid #68746c;border-radius:4px;background:white}.ed .ed-campaign-settings{border-bottom:1px solid #dde2dc;padding-bottom:32px;margin-bottom:36px}.ed .ed-photo-inputs{display:grid;grid-template-columns:1fr 1fr;gap:16px}.ed .ed-organizer-link{padding:28px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:32px}.ed .ed-organizer-link p{margin:0}.ed .ed-organizer-link>a{max-width:280px}.ed .ed-welcome{display:grid;grid-template-columns:1.7fr 1fr;gap:32px;align-items:center;margin:24px 0 32px}.ed .ed-welcome img{display:block;width:100%;height:auto;border-radius:8px}.ed .ed-form{max-width:720px}.ed .ed-form label:not(.ed-check):not(.ed-photo-picker){display:block;font-weight:700;margin:20px 0 8px}.ed .ed-form input:not([type=checkbox]):not([type=file]),.ed .ed-form select,.ed .ed-form textarea{display:block;width:100%;min-height:48px;padding:10px 12px;border:1px solid #68746c;border-radius:4px;background:#fff;line-height:1.5}.ed .ed-form textarea{resize:vertical}.ed .ed-form fieldset{border:0;min-width:0;margin:0;padding:0}.ed .ed-form fieldset:disabled{opacity:.7}.ed .ed-form .ed-help{margin-top:8px}.ed .ed-optional{font-size:14px;font-weight:400;margin-inline-start:8px;color:#55615a}.ed .ed-check{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 0;font-weight:400;cursor:pointer}.ed .ed-check input{flex:0 0 auto;width:20px;height:20px;margin:4px 0 0;accent-color:#143f2e}.ed .ed-check .ed-help{display:block;margin:4px 0 0}.ed .ed-status{margin:12px 0}.ed .ed-status:empty{display:none}.ed .ed-status:not(:empty){padding:12px 16px;border-inline-start:3px solid #68746c;background:#eef2e9}.ed .ed-status[data-error=true]{color:#b42318;border-color:#b42318;background:#fff3ef}.ed .ed-notice{padding:16px 20px;border-inline-start:3px solid #68746c;background:#eef2e9;margin:20px 0}.ed .ed-context,.ed .ed-own-heading,.ed .ed-gallery-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.ed .ed-context{margin-bottom:24px}.ed .ed-page-heading{margin-bottom:32px}.ed .ed-own-heading{margin-bottom:16px}.ed .ed-own-heading h2{margin:0}.ed .ed-own-heading .ed-kicker{margin-bottom:4px}.ed .ed-own-journal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.ed .ed-receipt{min-width:0;border-bottom:1px solid #dde2dc;padding-bottom:20px}.ed .ed-receipt img{width:100%;height:200px;object-fit:contain;background:#edf1e9;border-radius:8px}.ed .ed-receipt h3{font-size:18px;margin:12px 0 8px}.ed .ed-receipt p{white-space:pre-wrap;margin:8px 0}.ed .ed-receipt .ed-gallery-state{font-size:14px;white-space:normal;color:#55615a}.ed[data-event-discovery=capture]{max-width:720px;margin-inline:auto}
.ed .ed-capture-heading{margin:0 0 24px}.ed .ed-capture-heading .ed-kicker{margin-bottom:8px}.ed .ed-capture-heading h1{font-size:28px;margin-bottom:8px}.ed .ed-capture-heading p:last-child{margin:0}
.ed .ed-capture-form{margin:0;padding:0}.ed .ed-capture-form>.ed-sr-only{margin:0}
.ed .ed-caption-options{border-block:1px solid #dde2dc;margin:20px 0 12px}.ed .ed-caption-options[open]{padding-bottom:20px}.ed .ed-caption-options summary{padding:12px 0}
.ed .ed-saved-photos{border-top:1px solid #dde2dc;padding-top:28px;margin-top:32px}.ed .ed-saved-photos .ed-own-heading{margin-bottom:4px}.ed .ed-saved-photos [data-discovery-photo-count]{margin:4px 0 0}.ed .ed-saved-photos .ed-empty{padding:12px 0}.ed .ed-saved-photos .ed-empty p{margin:0}
.ed .ed-event-footer{border-top:1px solid #dde2dc;margin-top:32px;padding-top:20px}.ed .ed-event-footer nav{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px 20px;margin-bottom:16px}.ed .ed-event-footer summary{font-size:14px;padding:10px 0}.ed .ed-event-footer>p{margin-bottom:8px}
.ed .ed-picker-icon{width:30px;height:30px}.ed .ed-capture-form [data-discovery-save]{width:100%;min-height:52px}.ed .ed-selected-preview{margin-top:20px}.ed .ed-selected-preview p{margin:8px 0 0}.ed .ed-photo-picker{display:flex;align-items:center;justify-content:center;flex-direction:column;min-height:124px;padding:16px 8px;border:1px dashed #68746c;background:#f5f6f0;border-radius:8px;cursor:pointer;gap:6px}.ed .ed-photo-plus{font-size:30px;line-height:1}.ed .ed-file{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.ed .ed-photo-inputs>div:focus-within .ed-photo-picker{outline:3px solid #a98221;outline-offset:3px}.ed .ed-selected-preview:empty{display:none}.ed .ed-selected-preview img{display:block;max-width:100%;max-height:360px;object-fit:contain;border-radius:8px}.ed .ed-share-choice{padding:16px 20px;background:#eef2e9;border-radius:8px;margin:16px 0 24px}.ed .ed-share-choice>p:last-child{margin-bottom:0}.ed .ed-paper-strip{display:flex;align-items:center;justify-content:space-between;gap:24px;border-top:1px solid #dde2dc;margin-top:40px;padding-top:28px}.ed .ed-paper-strip h2{font-size:22px;margin-bottom:8px}.ed .ed-paper-strip p{margin:0}.ed .ed-paper-strip .ed-button{flex-shrink:0}.ed .ed-gallery-heading{max-width:720px;margin:24px 0 40px}.ed .ed-gallery-heading h1{font-size:40px}.ed .ed-gallery-toolbar{padding-bottom:20px;border-bottom:1px solid #dde2dc;margin-bottom:24px}.ed .ed-gallery-toolbar p{margin:0}.ed .ed-journals{display:grid;gap:32px}.ed .ed-journal{padding:24px;border:1px solid #dde2dc;border-radius:8px;background:#fff}.ed .ed-journal h2{font-size:22px;margin:0 0 20px}.ed .ed-journal-entries{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.ed .ed-entry{min-width:0;margin:0}.ed .ed-entry img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#f1f3ed;border-radius:4px}.ed .ed-entry h3{font-size:18px;margin:12px 0 8px}.ed .ed-entry p{white-space:pre-wrap;margin:8px 0}.ed .ed-paper-note-view{border-top:3px solid #d8b446;background:#fbfaf2;padding:20px;min-height:160px}.ed .ed-paper-note-view .ed-kicker{margin:0 0 8px}.ed .ed-selection{padding:12px 14px;background:#f7f1d9;margin-top:12px;border-radius:4px}.ed .ed-selection strong{font-size:14px;display:block}.ed .ed-selection p{font-size:14px;margin-bottom:0}.ed .ed-empty{padding:40px 0;max-width:560px}.ed .ed-empty h2{margin-bottom:12px}.ed .ed-load-more{display:flex;margin:28px auto 0}.ed .ed-footer-note{margin-top:28px}.ed .ed-review-filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.ed .ed-review-filters [aria-pressed=true]{background:#143f2e;color:#fff;border-color:#143f2e}.ed .ed-review{padding:24px 0;border-bottom:1px solid #dde2dc;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:24px}.ed .ed-review img{display:block;width:100%;max-height:360px;object-fit:contain;background:#f1f3ed;border-radius:8px}.ed .ed-review>div>p{white-space:pre-wrap}.ed .ed-review .ed-form label{margin-top:12px}.ed .ed-review-actions{display:flex;gap:12px;flex-wrap:wrap}.ed .ed-review .ed-help{margin-bottom:8px}.ed .ed-paper-entry{margin-top:32px;border-top:1px solid #dde2dc}.ed summary{cursor:pointer;min-height:48px;padding:16px 0;font-weight:700;line-height:1.5}.ed .ed-paper-fields{margin-top:24px!important;border-top:1px solid #dde2dc!important;padding-top:16px!important}.ed .ed-paper-fields legend{font-weight:700;padding:0 12px 0 0}.ed .ed-print-toolbar{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}.ed .ed-print-sheet{background:white;padding:32px;border:1px solid #dde2dc}.ed .ed-print-sheet h1{font-size:26px}.ed .ed-print-name{display:flex;flex-wrap:wrap;gap:8px}.ed .ed-print-name span{min-width:160px;flex:1;border-bottom:1px solid #68746c}.ed .ed-print-note{border:1px solid #68746c;border-radius:4px;padding:16px;margin:20px 0;break-inside:avoid}.ed .ed-print-note h2{font-size:18px;margin:0}.ed .ed-print-note h2 span{margin-right:12px}.ed .ed-print-writing{height:96px}.ed .ed-print-line{height:28px;border-top:1px solid #dde2dc;border-bottom:1px solid #dde2dc}.ed .ed-print-choice{margin-top:24px}.ed .ed-sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
/* The isolated preview LP owns these declarations; shared participant controls stay unchanged. */
.ed .ed-preview-notice{display:flex;flex-wrap:wrap;gap:2px 16px;padding:10px 0 14px;color:#8a4b00;font-size:14px;line-height:1.6;border-bottom:1px solid #dde2dc;margin-bottom:28px}
.ed .ed-preview-notice strong{font-weight:700}
.ed .ed-lp-hero{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:44px;align-items:center}
.ed .ed-lp-intro,.ed .ed-lp-visual{min-width:0}
.ed .ed-lp-intro>.ed-kicker{margin-bottom:12px;letter-spacing:.025em}
.ed .ed-lp-intro .ed-title{font-size:42px;letter-spacing:0;margin-bottom:18px;line-height:1.35}
.ed .ed-lp-intro .ed-title .ed-title-preface{font-size:24px;line-height:1.5;margin-bottom:6px}
.ed .ed-lp-lead{max-width:34em;line-height:1.8;text-wrap:pretty}
.ed .ed-event-facts{display:grid;gap:10px;margin:22px 0 26px;padding-top:18px;border-top:1px solid #dde2dc}
.ed .ed-event-facts>div{display:flex;align-items:baseline;gap:12px}
.ed .ed-event-facts dt{flex:0 0 3em;font-size:14px;color:#55615a}
.ed .ed-event-facts dd{margin:0;min-width:0;font-weight:700;color:#143f2e}
.ed .ed-date-fact dd{display:flex;gap:4px 8px;align-items:baseline;flex-wrap:wrap;line-height:1.3}
.ed .ed-event-year{font-size:16px}
.ed .ed-date-fact time{font-size:40px;font-weight:700;white-space:nowrap;letter-spacing:-.015em}
.ed .ed-event-weekday{font-size:20px;letter-spacing:0}
.ed .ed-time-fact dd{font-size:28px;line-height:1.4;font-variant-numeric:tabular-nums}
.ed .ed-fact-note{font-size:14px;font-weight:400;color:#55615a;margin-inline-start:12px}
.ed .ed-lp-action .ed-button{min-height:54px;padding-inline:24px}
.ed .ed-lp-action .ed-help{margin:8px 0 0}
.ed .ed-lp-intro>.ed-text-link{margin-top:12px;gap:12px;font-size:14px}
.ed .ed-lp-visual{margin:0}
.ed .ed-lp-visual img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;object-position:55% 50%;border-radius:8px}
.ed .ed-lp-visual figcaption{font-size:14px;color:#55615a;margin-top:8px;line-height:1.6}
.ed .ed-lp-section{padding:40px 0;border-bottom:1px solid #dde2dc;scroll-margin-top:96px}
.ed .ed-photo-steps{gap:28px}
.ed .ed-photo-steps li{display:grid;grid-template-columns:88px minmax(0,1fr);align-items:start;gap:16px}
.ed .ed-photo-steps img{display:block;width:88px;height:104px;object-fit:cover;border-radius:4px}
.ed .ed-photo-steps .ed-step-number{float:none;margin:0 0 4px;font-size:14px;letter-spacing:0}
.ed .ed-photo-steps h3{font-size:18px;margin-bottom:6px}
.ed .ed-photo-steps p{font-size:14px;line-height:1.7}
.ed .ed-steps-image-note{margin:12px 0 0;font-size:14px}
.ed .ed-lp-guide{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:36px}
.ed .ed-lp-guide h2{margin:0}
.ed .ed-lp-guide p:last-child{margin-bottom:0}
.ed .ed-guide-note{font-weight:700}
.ed .ed-lp-section .ed-own-heading{align-items:baseline;margin-bottom:20px}
.ed .ed-lp-section .ed-own-heading>h2,.ed .ed-lp-section .ed-own-heading>.ed-help{margin:0}
.ed .ed-day-flow{list-style:none;margin:0 0 20px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;counter-reset:day}
.ed .ed-day-flow li{counter-increment:day;padding:12px 0;border-top:2px solid #143f2e;font-weight:700;line-height:1.6}
.ed .ed-day-flow li::before{content:counter(day);font-size:14px;font-weight:400;margin-inline-end:12px}
.ed .ed-lp-day-action{display:flex;align-items:center;gap:12px 20px;flex-wrap:wrap;margin-bottom:12px}
.ed .ed-lp-day-action .ed-help{margin:0}
.ed .ed-lp-record-help>summary,.ed .ed-published-gallery>summary{min-height:44px;padding:9px 0;cursor:pointer;font-size:14px;font-weight:700}
.ed .ed-lp-record-help>p{margin:4px 0 12px;max-width:55em}
.ed .ed-paper-guidance{margin:8px 0 0}
.ed .ed-lp-community>h2{margin-bottom:8px}
.ed .ed-gallery-lead{font-size:18px;margin-bottom:4px}
.ed .ed-demo-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:24px}
.ed .ed-demo-heading h3{font-size:18px;margin:0 0 8px}
.ed .ed-demo-heading>.ed-sample-label{flex-shrink:0}
.ed .ed-sample-notice{font-size:14px;color:#8a4b00;line-height:1.7;max-width:55em}
.ed .ed-demo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px 20px}
.ed .ed-demo-tile,.ed .ed-gallery-tile{min-width:0;margin:0}
.ed .ed-gallery-open{display:block;width:100%;padding:0;border:0;background:none;color:#17211b;text-align:start;cursor:pointer;border-radius:4px;font:inherit;min-height:44px;line-height:1.6}
.ed .ed-gallery-open>img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:4px;background:#f7f7f3}
.ed .ed-demo-tile .ed-gallery-open>img{aspect-ratio:4/3}
.ed .ed-demo-caption{display:flex;flex-direction:column;gap:2px;padding-top:8px}
.ed .ed-demo-caption>strong{font-size:16px;font-weight:600;line-height:1.5}
.ed .ed-gallery-open:hover .ed-demo-caption>strong{text-decoration:underline;text-underline-offset:4px}
.ed .ed-gallery-open:active{opacity:.85}
.ed .ed-sample-label,.ed .ed-tile-name{font-size:14px;line-height:1.6}
.ed .ed-sample-label{color:#8a4b00}
.ed .ed-tile-name{color:#55615a}
.ed .ed-published-gallery{margin-top:28px;border-top:1px solid #dde2dc;padding-top:8px}
.ed .ed-public-gallery-state{margin:24px 0 0}
.ed .ed-photo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}
.ed .ed-photo-journal,.ed .ed-photo-entries{display:contents}
.ed .ed-tile-caption{display:flex;flex-direction:column;gap:2px;padding:8px 0}
.ed .ed-tile-caption>strong{font-size:16px;line-height:1.5}
.ed .ed-paper-summary{display:flex;flex-direction:column;gap:8px;min-height:112px;padding:16px;background:#f7f7f3;border-top:3px solid #d8b446;border-radius:4px}
.ed .ed-paper-kind{font-size:14px;color:#55615a}
.ed .ed-tile-excerpt{font-size:14px;color:#55615a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ed .ed-paper-tile .ed-tile-caption{padding-top:8px}
.ed .ed-photo-grid>.ed-empty{grid-column:1/-1}
.ed .ed-photo-dialog{width:calc(100% - 40px);max-width:720px;max-height:calc(100dvh - 40px);padding:20px;border:1px solid #68746c;border-radius:8px;background:#fff;color:#17211b;overflow:auto}
.ed .ed-photo-dialog::backdrop{background:rgba(23,33,27,.65)}
.ed .ed-photo-dialog>.ed-button{display:flex;margin-inline-start:auto;margin-bottom:16px}
.ed .ed-photo-detail img{display:block;width:100%;height:auto;max-height:55dvh;object-fit:contain;background:#f7f7f3;border-radius:4px;margin:12px 0 20px}
.ed .ed-photo-detail h2{font-size:24px;margin-bottom:8px}
.ed .ed-detail-name{font-size:14px;color:#55615a}
.ed .ed-detail-caption{white-space:pre-wrap}
.ed .ed-lp-signup{display:flex;justify-content:space-between;align-items:center;gap:28px;border-bottom:0}
.ed .ed-lp-signup h2{font-size:26px;margin-bottom:10px}
.ed .ed-lp-signup .ed-signup-facts{font-weight:700;color:#143f2e;margin-bottom:6px}
.ed .ed-lp-signup>div>p:last-child{margin-bottom:0}
.ed .ed-lp-signup .ed-lp-action{flex-shrink:0}
@media(min-width:721px) and (max-width:1099px){.ed .ed-photo-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.ed .ed-photo-steps li{grid-template-columns:64px minmax(0,1fr);gap:12px}.ed .ed-photo-steps img{width:64px;height:96px}}
@media(max-width:900px){.ed .ed-lp-hero{grid-template-columns:1fr;gap:24px}.ed .ed-lp-visual img{aspect-ratio:2.3;object-position:50% 58%}.ed .ed-lp-guide{grid-template-columns:1fr;gap:16px}}
@media(max-width:720px){
.ed .ed-preview-notice{margin-bottom:20px}
.ed .ed-lp-intro .ed-title{font-size:clamp(26px,7.5vw,34px);margin-bottom:14px}
.ed .ed-lp-intro .ed-title .ed-title-preface{font-size:20px;line-height:1.5}
.ed .ed-lp-lead{margin-bottom:12px;line-height:1.8}
.ed .ed-event-facts{margin:18px 0 22px;padding-top:14px;gap:8px}
.ed .ed-event-year{font-size:14px}
.ed .ed-date-fact time{font-size:36px}
.ed .ed-event-weekday{font-size:18px}
.ed .ed-time-fact dd{font-size:26px}
.ed .ed-lp-action .ed-button{width:100%}
.ed .ed-lp-visual img{aspect-ratio:1.6;object-position:50% 50%}
.ed .ed-lp-section{padding:30px 0}
.ed .ed-photo-steps{grid-template-columns:1fr;gap:20px}
.ed .ed-photo-steps li{grid-template-columns:84px minmax(0,1fr);gap:16px}
.ed .ed-photo-steps img{width:84px;height:96px}
.ed .ed-photo-steps h3{font-size:18px}
.ed .ed-lp-guide h2{font-size:24px}
.ed .ed-day-flow{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 20px;margin-bottom:16px}
.ed .ed-day-flow li{font-size:16px;padding:8px 0}
.ed .ed-demo-heading{display:block;margin-top:20px}
.ed .ed-demo-heading h3{margin-bottom:2px}
.ed .ed-sample-notice{margin-top:8px}
.ed .ed-demo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px}
.ed .ed-demo-caption>strong{font-size:14px}
.ed .ed-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ed .ed-paper-summary{padding:12px;gap:6px}
.ed .ed-lp-signup{display:block}
.ed .ed-lp-signup h2{font-size:24px}
.ed .ed-lp-signup .ed-lp-action{margin-top:20px}
.ed .ed-photo-dialog{width:calc(100% - 24px);max-height:calc(100dvh - 24px);padding:16px}
.ed .ed-photo-detail img{max-height:50dvh}
}
@media(min-width:721px) and (max-width:900px){.ed .ed-intro{grid-template-columns:1fr;gap:24px}.ed .ed-title{font-size:40px}}
@media(max-width:720px){.ed h1{font-size:28px}.ed h2{font-size:24px}.ed .ed-intro{grid-template-columns:1fr;gap:24px;margin-top:8px}.ed .ed-title{font-size:30px}.ed .ed-title .ed-title-preface{font-size:22px}.ed .ed-hero img{aspect-ratio:1.35;object-position:40% 50%}.ed .ed-ribbon{justify-content:flex-start;gap:12px 20px;flex-wrap:wrap;padding:20px 0 24px;font-size:14px}.ed .ed-steps{grid-template-columns:1fr;gap:24px}.ed .ed-step-number{float:left;margin:3px 16px 0 0}.ed .ed-steps h3{margin-bottom:8px}.ed .ed-section{padding:32px 0}.ed .ed-story{grid-template-columns:1fr;gap:24px}.ed .ed-story>img{max-width:360px;margin:auto}.ed .ed-story h2{font-size:26px}.ed .ed-code{grid-template-columns:1fr;gap:24px}.ed .ed-organizer-link{flex-direction:column;gap:12px}.ed .ed-organizer-link>a{max-width:none}.ed .ed-welcome{grid-template-columns:1fr;gap:16px}.ed .ed-welcome img{display:none}.ed .ed-join-form .ed-button{width:100%}.ed .ed-own-journal{grid-template-columns:1fr}.ed .ed-receipt{display:grid;grid-template-columns:120px minmax(0,1fr);gap:0 16px}.ed .ed-receipt>img{height:120px;grid-row:1/5}.ed .ed-receipt>h3{margin-top:0}.ed .ed-receipt>.ed-button{grid-column:2;justify-self:start}.ed .ed-receipt>p{margin-top:0}.ed .ed-paper-strip{flex-direction:column;align-items:flex-start;gap:16px}.ed .ed-gallery-heading h1{font-size:30px}.ed .ed-gallery-heading{margin:20px 0 28px}.ed .ed-journal{padding:20px 16px}.ed .ed-journal-entries{grid-template-columns:1fr;gap:24px}.ed .ed-journal h2{font-size:22px}.ed .ed-review{grid-template-columns:1fr}.ed .ed-share-choice{padding:12px 16px}.ed .ed-print-sheet{padding:20px}.ed .ed-print-sheet h1{font-size:24px}}
@media(max-width:600px){.ed .ed-day{grid-template-columns:1fr;gap:20px}.ed .ed-photo-inputs{gap:12px}.ed .ed-participation{padding:24px 16px}.ed .ed-camera-picker{min-height:124px}}@media(prefers-reduced-motion:reduce){.ed *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}@media(forced-colors:active){.ed :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid Highlight;box-shadow:none}.ed .ed-photo-picker,.ed .ed-journal{border-color:CanvasText}}
@media print{@page{size:A4;margin:12mm}body:has([data-discovery-print]) :is(.site-header,.zukan-app-header,.zukan-app-skip,nav,.ed-print-toolbar){display:none!important}body:has([data-discovery-print]){background:#fff!important;color:#000!important}body:has([data-discovery-print]) main{max-width:none!important;padding:0!important;margin:0!important}.ed[data-discovery-print]{font-size:11pt;line-height:1.5}.ed .ed-print-sheet{padding:0;border:0}.ed .ed-print-sheet h1{font-size:18pt}.ed .ed-print-sheet .ed-kicker,.ed .ed-print-sheet .ed-help{font-size:10pt}.ed .ed-print-sheet p{margin-bottom:10px}.ed .ed-print-note{padding:10px;margin:12px 0}.ed .ed-print-note h2{font-size:12pt}.ed .ed-print-writing{height:25mm}.ed .ed-print-line{height:8mm}.ed .ed-print-choice{margin-top:12px}}
`;

export function observationEventDiscoveryScript(): string {
  return String.raw`(() => {
  'use strict';
  const roots = document.querySelectorAll('[data-event-discovery]');
  roots.forEach(root => {
    if (root.dataset.discoveryBound === 'true') return;
    root.dataset.discoveryBound = 'true';
    const kind = root.dataset.eventDiscovery;
    const sessionId = root.dataset.sessionId || '';
    const base = '/api/v1/observation-events/' + encodeURIComponent(sessionId);
    const query = selector => root.querySelector(selector);
    const status = query('[data-discovery-status]');
    const node = (tag, text, className) => { const item = document.createElement(tag); if (text != null) item.textContent = String(text); if (className) item.className = className; return item; };
    const tell = (text, error = false, target = status) => { if (target) { target.textContent = text; target.dataset.error = String(error); } };
    const field = (form, name) => form.elements.namedItem(name);
    const value = (form, name) => String(field(form, name)?.value || '').trim();
    const checked = (form, name) => field(form, name)?.checked === true;
    const randomKey = () => crypto.randomUUID();
    const labels = {private:'自分と主催者だけの記録',pending_review:'写り込みなどの確認待ち',published:'みんなの発見に掲載',withdrawn:'取り下げ済み'};
    const reviewReasons = {person:'人物や顔の写り込みがあるため、確認してから掲載します。',personal_information:'個人情報が含まれる可能性があるため、確認してから掲載します。',sensitive_content:'写真の内容を確認してから掲載します。',uncertain:'写真の写り込みを判定できなかったため、確認してから掲載します。',unavailable:'自動確認を完了できなかったため、確認してから掲載します。'};
    const errors = {event_media_intake_closed:'写真の受付は終了しています。保存済みの記録は確認できます。',event_discovery_not_live:'まだ記録の受付が始まっていません。主催者の案内をご確認ください。',event_checkin_closed:'いまは参加の受付をしていません。',checked_in_participant_required:'参加情報を確認できません。同じ端末の参加リンクから開き直してください。',event_guest_cookie_required:'参加情報を保存できませんでした。Cookieを利用できる設定で、このページを開き直してください。',discovery_photo_limit_reached:'写真は３枚までです。残した写真を確認してください。',media_too_large:'写真を12 MB以下にして選び直してください。',media_required_or_too_large:'12 MB以下の写真を選んでください。',unsupported_media_type:'JPEG・PNG・WebPの写真を選んでください。',guardian_gallery_consent_required:'公開する場合は、保護者の同意を確認してください。',private_image_scrubber_unavailable:'いまは写真を安全に保存する準備ができません。時間をおいてお試しください。',private_image_scrub_failed:'この写真を保存できませんでした。別の写真を選ぶか、時間をおいてお試しください。',idempotency_key_conflict:'前の送信と内容が変わっています。保存済みの記録を確認してください。',withdrawal_cleanup_pending:'取り下げを受け付けました。削除の完了を確認しています。',media_withdrawn:'この写真は取り下げられています。'};
    Object.assign(errors,{three_photo_limit:'写真は３枚までです。保存が完了していない記録も、再試行するか取り下げてください。',discovery_claim_photo_limit:'記録を引き継ぐと３枚を超えます。先に残す写真を確認してください。',event_media_intake_not_started:'まだ写真の受付が始まっていません。主催者の案内をご確認ください。',event_checkin_not_started:'まだ参加の受付が始まっていません。主催者の案内をご確認ください。',rights_and_visual_privacy_confirmation_required:'利用する権利と写り込みを確認し、チェックを入れてください。',caption_invalid:'ひと言は280文字以内で入力してください。',spot_label_invalid:'場所のメモは80文字以内で入力してください。',nickname_invalid:'呼び名は32文字以内で入力してください。空欄でも参加できます。',invalid_cursor:'続きの取得情報を確認できません。再読み込みしてください。',image_privacy_metadata_verification_failed:'写真の確認処理を完了できませんでした。掲載せず、主催者用の記録として残っています。',private_media_unavailable:'保存した写真を読み取れませんでした。再読み込みしてから確認してください。'});
    Object.assign(errors,{discovery_campaign_event_unavailable:'この開催回は表示できません。案内のリンクを確認するか、開催日を選び直してください。',event_application_unavailable:'この開催回は、いま事前申し込みを受け付けていません。',event_application_name_invalid:'呼び名は32文字以内にしてください。空欄でも申し込めます。',discovery_campaign_invalid:'案内と申込受付の設定を確認してください。',discovery_campaign_listing_forbidden:'企画ページへの表示を変更する権限がありません。',discovery_campaign_closed:'終了・中止した開催回の申込受付は開始できません。'});
    async function request(url, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(url, {credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
        const body = await response.json().catch(() => null);
        if (!response.ok) { const error = new Error(errors[body?.error] || (response.status === 403 ? 'この操作をする権限を確認できません。' : '処理を完了できませんでした。入力を残したまま、もう一度お試しください。')); error.status = response.status; error.code = body?.error; error.unknownEffect = response.status >= 500; throw error; }
        if (!body || typeof body !== 'object') throw new Error('結果を読み取れませんでした。もう一度読み込んでください。');
        return body;
      } catch (error) { if (!error.status) { const failure=new Error(error.name==='AbortError'?'通信に時間がかかっています。入力を残したまま、再読み込みや再試行で確認してください。':'通信できませんでした。接続を確認し、入力を残したまま再試行してください。');failure.unknownEffect=true;throw failure; } throw error; }
      finally { clearTimeout(timer); }
    }
    const jsonRequest = (url, method, body) => request(url, {method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    function storageGet(key) { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
    function storagePut(key, data) { try { if (data == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(data)); } catch {} }
    function permittedMediaHref(href, privateMedia = false, mediaBase = base) {
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return null;
      const prefix = mediaBase + (privateMedia ? '/guest-media/' : '/discoveries/');
      if (!href.startsWith(prefix) || !/^[^/?#]+\/content$/.test(href.slice(prefix.length))) return null;
      return href;
    }
    function syncGuardian(form, participantIsMinor) {
      const minor = participantIsMinor === undefined ? checked(form, 'is_minor') : participantIsMinor;
      const required = minor && checked(form, 'gallery_consent');
      const row = form.querySelector('[data-discovery-guardian-row]');
      const consent = field(form, 'guardian_gallery_consent');
      if (row) row.hidden = !required;
      if (consent) { consent.required = required; if (!required) consent.checked = false; }
    }
    function galleryController({list,counts,refresh,more,target}) {
      let currentBase=null,nextCursor=null,generation=0,busy=false;const known=new Map();
      const compact=root.dataset.discoveryPreview==='true';
      if(compact)list.className='ed-photo-grid';
      let dialog=null,dialogBody=null,dialogOpener=null;
      if(compact){
        dialog=node('dialog',null,'ed-photo-dialog');dialog.setAttribute('aria-label','発見の詳細');
        const close=node('button','閉じる ×','ed-button ed-small');close.type='button';close.autofocus=true;
        dialogBody=node('div',null,'ed-photo-detail');dialog.append(close,dialogBody);root.append(dialog);
        close.addEventListener('click',()=>dialog.close());
        dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
        dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();});
        dialog.addEventListener('close',()=>{dialogBody.replaceChildren();if(dialogOpener?.isConnected)dialogOpener.focus();dialogOpener=null;});
        // Fixed, explicitly marked examples never enter the publication data or media APIs.
        root.querySelectorAll('[data-discovery-demo]').forEach(button=>button.addEventListener('click',()=>{
          const detail=node('div');detail.append(node('p','AI生成写真・架空の掲載例','ed-sample-label'));
          const source=button.querySelector('img');if(source){const image=node('img');image.src=source.getAttribute('src');image.alt=source.alt;detail.append(image);}
          detail.append(node('h2',button.dataset.demoTitle),node('p','場所のメモの例：'+button.dataset.demoPlace,'ed-detail-name'),node('p',button.dataset.demoCaption,'ed-detail-caption'),node('p','実参加者の投稿ではありません。呼び名・場所・ひと言は、投稿した写真と一緒に表示できます。','ed-help'));
          dialogBody.replaceChildren(detail);dialogOpener=button;dialog.showModal();
        }));
      }
      function sampleLabel(entry){return entry.kind==='paper'?'紙のテスト記録':String(entry.caption||'').includes('生成イラスト')?'生成イラスト・テスト':'テスト投稿';}
      function openEntry(entry,journal,mediaBase,opener){
        const detail=node('div');detail.append(node('p',sampleLabel(entry),'ed-sample-label'));
        if(entry.kind!=='paper'){const href=permittedMediaHref(entry.contentHref,false,mediaBase);if(href){const image=node('img');image.src=href;image.alt=entry.spotLabel||'とっておきの写真';detail.append(image);}else detail.append(node('p','この写真は現在表示できません。','ed-help'));}
        detail.append(node('h2',entry.spotLabel||(entry.kind==='paper'?'紙で残した発見':'写真で残した発見')),node('p',journal.displayName||'名前なし','ed-detail-name'));
        if(entry.caption)detail.append(node('p',entry.caption,'ed-detail-caption'));
        if(entry.selectionLabel||entry.selectionComment){const selected=node('div',null,'ed-selection');selected.append(node('strong',entry.selectionLabel||'主催者からのひと言'));if(entry.selectionComment)selected.append(node('p',entry.selectionComment));detail.append(selected);}
        dialogBody.replaceChildren(detail);dialogOpener=opener;dialog.showModal();
      }
      function compactJournalCard(journal,mediaBase){
        const card=node('article',null,'ed-photo-journal');card.dataset.journalId=String(journal.journalId);
        const heading=node('h3',journal.displayName?String(journal.displayName)+'のとっておき':'ある参加者のとっておき','ed-sr-only');card.append(heading);
        const entries=node('div',null,'ed-photo-entries');
        journal.entries.slice(0,3).forEach((entry,index)=>{
          const item=node('figure',null,'ed-gallery-tile'+(entry.kind==='paper'?' ed-paper-tile':''));
          const button=node('button',null,'ed-gallery-open');button.type='button';button.setAttribute('aria-label',(journal.displayName||'名前なし')+'の'+(entry.spotLabel||'発見')+'の詳細を見る（'+sampleLabel(entry)+'）');
          if(entry.kind==='paper'){const paper=node('div',null,'ed-paper-summary');paper.append(node('span','紙の記録','ed-paper-kind'),node('strong',entry.spotLabel||'紙で残した発見'));if(entry.caption)paper.append(node('span',entry.caption,'ed-tile-excerpt'));button.append(paper);}
          else{const href=permittedMediaHref(entry.contentHref,false,mediaBase);if(href){const image=node('img');image.src=href;image.alt=entry.spotLabel?String(entry.spotLabel):'とっておきの写真 '+(index+1);image.loading='lazy';image.decoding='async';button.append(image);}else button.append(node('span','この写真は現在表示できません。','ed-help'));}
          const caption=node('span',null,'ed-tile-caption');caption.append(node('span',sampleLabel(entry),'ed-sample-label'));if(entry.kind!=='paper')caption.append(node('strong',entry.spotLabel||'写真の発見'));caption.append(node('span',journal.displayName||'名前なし','ed-tile-name'));button.append(caption);
          button.addEventListener('click',()=>openEntry(entry,journal,mediaBase,button));item.append(button);entries.append(item);
        });card.append(entries);return card;
      }
      function journalCard(journal,mediaBase){if(compact)return compactJournalCard(journal,mediaBase);const card=node('article',null,'ed-journal');card.dataset.journalId=String(journal.journalId);card.append(node('h2',journal.displayName?String(journal.displayName)+'のとっておき':'ある参加者のとっておき'));const entries=node('div',null,'ed-journal-entries');journal.entries.slice(0,3).forEach((entry,index)=>{const item=node('figure',null,'ed-entry');if(entry.kind==='paper'){const paper=node('div',null,'ed-paper-note-view');paper.append(node('p','紙で残した発見','ed-kicker'));if(entry.spotLabel)paper.append(node('h3',entry.spotLabel));if(entry.caption)paper.append(node('p',entry.caption));item.append(paper);}else{const href=permittedMediaHref(entry.contentHref,false,mediaBase);if(href){const image=node('img');image.src=href;image.alt=entry.spotLabel?String(entry.spotLabel):'とっておきの写真 '+(index+1);image.loading='lazy';item.append(image);}else item.append(node('p','この写真は現在表示できません。','ed-help'));if(entry.spotLabel)item.append(node('h3',entry.spotLabel));if(entry.caption)item.append(node('p',entry.caption));}if(entry.selectionLabel||entry.selectionComment){const selected=node('div',null,'ed-selection');selected.append(node('strong',entry.selectionLabel||'主催者からのひと言'));if(entry.selectionComment)selected.append(node('p',entry.selectionComment));item.append(selected);}entries.append(item);});card.append(entries);return card;}
      async function load(append=false){
        if(!currentBase||busy)return;busy=true;const ticket=generation,requestedBase=currentBase;refresh.disabled=true;more.disabled=true;tell('',false,target);
        try{const data=await request(requestedBase+'/discoveries?limit=24'+(append&&nextCursor?'&cursor='+encodeURIComponent(nextCursor):''));if(ticket!==generation)return;
          if(!Array.isArray(data.journals)||!data.counts||!Number.isInteger(data.counts.journals)||!Number.isInteger(data.counts.entries))throw new Error('ノートの一覧を読み取れませんでした。');
          for(const journal of data.journals)if(!journal||typeof journal.journalId!=='string'||!Array.isArray(journal.entries)||journal.entries.length>3)throw new Error('ノートの内容を読み取れませんでした。');
          if(!append){known.clear();list.replaceChildren();}for(const journal of data.journals){const card=journalCard(journal,requestedBase);const previous=known.get(journal.journalId);if(previous)previous.replaceWith(card);else list.append(card);known.set(journal.journalId,card);}
          counts.textContent=data.counts.journals+(compact?'人の発見 · ':'冊のノート · ')+data.counts.entries+(compact?'件':'件の発見');nextCursor=typeof data.nextCursor==='string'&&data.nextCursor?data.nextCursor:null;more.hidden=!nextCursor;
          if(compact){const published=query('[data-discovery-published]'),state=query('[data-discovery-public-gallery-state]');if(published)published.hidden=data.counts.entries===0;if(state)state.hidden=data.counts.entries>0;}
          if(!known.size){const empty=node('div',null,'ed-empty');empty.append(node('h3','この回の発見は、これから。'),node('p','共有を選んだ写真は、写り込みなどの自動確認を通ると、ここに並びます。人物などが写る写真や紙のメモは確認後に掲載します。'));list.replaceChildren(empty);}
        }catch(error){if(ticket!==generation)return;tell(error.message||'みんなの発見を読み込めませんでした。',true,target);if(!known.size)counts.textContent='掲載数を確認できません。再読み込みで確認してください。';}
        finally{if(ticket===generation){busy=false;refresh.disabled=false;more.disabled=false;}}
      }
      refresh.addEventListener('click',()=>void load(false));more.addEventListener('click',()=>void load(true));
      return {show(eventBase,emptyText='開催回を選ぶと、その回の発見がここに並びます。'){generation++;currentBase=eventBase;busy=false;nextCursor=null;known.clear();list.replaceChildren();more.hidden=true;refresh.disabled=!eventBase;counts.textContent=eventBase?'掲載されたノートを読み込んでいます。':emptyText;tell('',false,target);if(eventBase)void load(false);}};
    }
    // The owner-approved public LP keeps tentative dates separate from live event intake.
    const previewTemplate=query('[data-discovery-preview-template]');
    const lpUrl=new URL(window.location.href);
    const publicPreview=lpUrl.hostname==='zukan.earth'&&(!lpUrl.searchParams.has('event')||lpUrl.searchParams.get('event')==='RYUPREV1');
    const stagingPreview=lpUrl.hostname==='ikimon-life-cloudflare-staging.yamaki0102.workers.dev'&&lpUrl.searchParams.get('event')==='RYUPREV1';
    if(kind==='campaign'&&previewTemplate&&(publicPreview||stagingPreview)){
      root.replaceChildren(previewTemplate.content.cloneNode(true));root.dataset.discoveryPreview='true';root.dataset.eventCode='RYUPREV1';
      const previewStatus=query('[data-discovery-status]'),photoLink=query('[data-discovery-photo-link]'),dayState=query('[data-discovery-day-state]');
      const gallery=galleryController({list:query('[data-discovery-journals]'),counts:query('[data-discovery-counts]'),refresh:query('[data-discovery-gallery-refresh]'),more:query('[data-discovery-gallery-more]'),target:query('[data-discovery-gallery-status]')});
      const validEvent=event=>event&&typeof event.sessionId==='string'&&event.sessionId&&event.eventCode==='RYUPREV1'&&typeof event.title==='string';
      const paintPhotoLink=(event,participant)=>{
        const attended=['checked_in','offline','left'].includes(participant?.status);photoLink.hidden=!(event.canCheckIn||attended);
        photoLink.href=attended?'/events/'+encodeURIComponent(event.sessionId)+'/rally':'/community/events/'+encodeURIComponent(event.eventCode)+'/join';
        photoLink.textContent=attended?'写真を投稿・見返す →':'写真の画面を開く →';
        dayState.textContent=event.canSubmit?'テスト用の写真投稿を受付中です。':event.stateMessage||'写真の受付は、主催者の案内をご確認ください。';
      };
      async function loadPreview(){
        try{
          const data=await request(publicPreview?'/api/v1/observation-events/campaigns/ryuyo':'/api/v1/observation-events/campaigns/ryuyo?event=RYUPREV1');
          if(!validEvent(data.selectedEvent)){
            if(publicPreview){photoLink.hidden=true;dayState.textContent='当日の写真投稿は、会場でご案内します。';gallery.show(null,'公開された発見は、ここに並びます。');return;}
            throw new Error('テストイベントを確認できませんでした。');
          }
          const event=data.selectedEvent;root.dataset.sessionId=event.sessionId;paintPhotoLink(event,null);
          gallery.show(event.canViewGallery?'/api/v1/observation-events/'+encodeURIComponent(event.sessionId):null,'みんなの発見は、公開の準備ができるとここに並びます。');
          try{const state=await request('/api/v1/observation-events/'+encodeURIComponent(event.sessionId)+'/application');if(!validEvent(state.event)||state.event.sessionId!==event.sessionId||state.confirmed!==false)throw new Error('この端末の参加状態を確認できませんでした。');paintPhotoLink(state.event,state.participant);}catch(error){tell(error.message||'この端末の参加状態を確認できませんでした。',true,previewStatus);}
        }catch(error){photoLink.hidden=true;dayState.textContent='テストイベントの受付状況を確認できません。再読み込みしてください。';gallery.show(null,'掲載数を確認できません。再読み込みしてください。');tell(error.message||'テストイベントを確認できませんでした。',true,previewStatus);}
      }
      void loadPreview();return;
    }
    if (kind === 'campaign') {
      const select=query('[data-discovery-occurrence-select]'),summary=query('[data-discovery-occurrence-summary]'),refresh=query('[data-discovery-campaign-refresh]');
      const form=query('[data-discovery-application-form]'),applicationStatus=query('[data-discovery-application-status]'),submit=form.querySelector('button[type=submit]');
      const photoLink=query('[data-discovery-photo-link]'),dayState=query('[data-discovery-day-state]');
      const gallery=galleryController({list:query('[data-discovery-journals]'),counts:query('[data-discovery-counts]'),refresh:query('[data-discovery-gallery-refresh]'),more:query('[data-discovery-gallery-more]'),target:query('[data-discovery-gallery-status]')});
      let events=new Map(),selected=null,participant=null,selectionVersion=0,submitting=false,campaignLoading=false;
      const dateText=event=>{const date=new Date(event.startedAt);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'}).format(date)+'（日本時間）':'日時は主催者の案内をご確認ください';};
      const validEvent=event=>event&&typeof event.sessionId==='string'&&event.sessionId&&typeof event.eventCode==='string'&&event.eventCode&&typeof event.title==='string';
      function participationState(){
        if(!selected)return;const registered=participant?.status==='registered',attended=['checked_in','offline','left'].includes(participant?.status);
        form.hidden=!selected.canApply||registered||attended;
        if(registered)tell('申し込みを受け付けています。同じ端末から、この回の写真投稿へ進めます。参加確定や定員確保を意味するものではありません。',false,applicationStatus);
        else if(attended)tell('この端末の参加記録を確認しました。写真の画面から、記録の続きや保存済みの写真を見られます。',false,applicationStatus);
        else tell(selected.canApply?'':selected.stateMessage||'この回は、いま事前申し込みを受け付けていません。',false,applicationStatus);
        photoLink.hidden=!(selected.canCheckIn||attended);photoLink.href=attended?'/events/'+encodeURIComponent(selected.sessionId)+'/rally':'/community/events/'+encodeURIComponent(selected.eventCode)+'/join';
        photoLink.textContent=attended?'写真を投稿・見返す →':'写真の画面を開く →';dayState.textContent=selected.canSubmit?'写真の受付中です。１枚ずつ選び、写真へのコメントを添えて保存できます。':selected.stateMessage||'写真の受付は、開催日時と主催者の開始操作に合わせて始まります。';
      }
      async function selectEvent(event){
        const ticket=++selectionVersion;selected=event;participant=null;form.hidden=true;photoLink.hidden=true;tell('',false,applicationStatus);summary.replaceChildren();
        if(!event){dayState.textContent='開催回を選ぶと、写真の受付状況を確認できます。';gallery.show(null);return;}
        select.value=event.sessionId;summary.append(node('h3',event.title),node('p',dateText(event)));if(event.stateMessage)summary.append(node('p',event.stateMessage,'ed-help'));
        gallery.show(event.canViewGallery?'/api/v1/observation-events/'+encodeURIComponent(event.sessionId):null,'この回の発見は、公開の準備ができるとここに並びます。');
        dayState.textContent='この回の受付状況を確認しています。';tell('申し込みの状態を確認しています。',false,applicationStatus);
        try{const data=await request('/api/v1/observation-events/'+encodeURIComponent(event.sessionId)+'/application');if(ticket!==selectionVersion)return;
          if(!validEvent(data.event)||data.event.sessionId!==event.sessionId||data.confirmed!==false)throw new Error('この回の申し込み状態を確認できませんでした。');
          selected=data.event;participant=data.participant||null;field(form,'display_name').value=storageGet('zukan:event-discovery:application:'+event.sessionId)?.name??participant?.displayName??'';participationState();
        }catch(error){if(ticket!==selectionVersion)return;tell(error.message||'申し込みの状態を確認できませんでした。開催日を再読み込みしてください。',true,applicationStatus);dayState.textContent='受付状況を確認できません。開催日を再読み込みしてください。';}
      }
      async function loadCampaign(){
        if(submitting||campaignLoading)return;campaignLoading=true;if(selected)storagePut('zukan:event-discovery:application:'+selected.sessionId,{name:value(form,'display_name')});refresh.disabled=true;select.disabled=true;submit.disabled=true;await selectEvent(null);summary.replaceChildren(node('p','開催日を確認しています。'));tell('開催日を確認しています。');
        try{const code=new URL(window.location.href).searchParams.get('event');const data=await request('/api/v1/observation-events/campaigns/ryuyo'+(code?'?event='+encodeURIComponent(code):''));
          if(!Array.isArray(data.events)||data.events.some(event=>!validEvent(event))||(data.selectedEvent!=null&&!validEvent(data.selectedEvent)))throw new Error('開催日の一覧を確認できませんでした。');
          events=new Map(data.events.map(event=>[event.sessionId,event]));if(data.selectedEvent)events.set(data.selectedEvent.sessionId,data.selectedEvent);
          select.replaceChildren();const placeholder=node('option',events.size?'開催回を選んでください':'いま申し込める開催日はありません');placeholder.value='';select.append(placeholder);
          for(const event of events.values()){const option=node('option',dateText(event)+' · '+event.title);option.value=event.sessionId;select.append(option);}
          const event=data.selectedEvent||(events.size===1?[...events.values()][0]:null);await selectEvent(event);select.disabled=!events.size;
          if(!events.size){summary.replaceChildren(node('p','次の開催日は、案内が整い次第ここに掲載します。いまは事前申し込みを受け付けていません。'));tell('');}
          else tell(event?'':'参加する開催回を選んでください。');
        }catch(error){await selectEvent(null);select.replaceChildren(node('option','開催日を確認できません'));summary.replaceChildren(node('p','開催日の読み込みを完了できませんでした。「開催日を再読み込み」から確認できます。'));tell(error.message||'開催日を読み込めませんでした。',true);}
        finally{campaignLoading=false;refresh.disabled=false;submit.disabled=false;}
      }
      select.addEventListener('change',()=>{if(!submitting&&!campaignLoading)void selectEvent(events.get(select.value)||null);});refresh.addEventListener('click',()=>void loadCampaign());
      form.addEventListener('input',()=>{if(selected)storagePut('zukan:event-discovery:application:'+selected.sessionId,{name:value(form,'display_name')});});
      form.addEventListener('submit',async event=>{event.preventDefault();if(submitting||campaignLoading||!selected?.canApply||form.hidden)return;const chosen=selected;const name=value(form,'display_name');
        if(name.length>32||/[\u0000-\u001f\u007f]/.test(name)){tell('呼び名は32文字以内で入力してください。空欄でも申し込めます。',true,applicationStatus);return;}
        submitting=true;submit.disabled=true;select.disabled=true;refresh.disabled=true;tell('申し込みを保存しています。',false,applicationStatus);
        try{const data=await jsonRequest('/api/v1/observation-events/'+encodeURIComponent(chosen.sessionId)+'/application','POST',{display_name:name});
          if(data.confirmed!==false||!['registered','checked_in','offline','left'].includes(data.participant?.status))throw new Error('申し込みの保存結果を確認できませんでした。');participant=data.participant;storagePut('zukan:event-discovery:application:'+chosen.sessionId,null);participationState();
        }catch(error){let recovered=false;try{const data=await request('/api/v1/observation-events/'+encodeURIComponent(chosen.sessionId)+'/application');if(data.event?.sessionId===chosen.sessionId&&['registered','checked_in','offline','left'].includes(data.participant?.status)){selected=data.event;participant=data.participant;participationState();recovered=true;}}catch{}if(!recovered)tell(error.message||'申し込みを保存できませんでした。入力を残して再試行してください。',true,applicationStatus);}
        finally{submitting=false;submit.disabled=false;select.disabled=!events.size;refresh.disabled=false;}
      });
      query('[data-discovery-code-form]')?.addEventListener('submit',event=>{event.preventDefault();const code=value(event.currentTarget,'event_code');if(!code||code.length>64||/[\s/\\?#]/.test(code)){tell('案内に書かれた参加コードを入力してください。',true);return;}window.location.assign('/events/ryuyo?event='+encodeURIComponent(code)+'#discovery-day');});
      void loadCampaign();return;
    }
    if (kind === 'print') { query('[data-discovery-print-button]')?.addEventListener('click', () => window.print()); return; }
    if (kind === 'join') {
      const form = query('[data-discovery-join-form]');
      if (!form) return;
      const button = query('[data-discovery-join-submit]');
      const draftKey = 'zukan:event-discovery:join:' + sessionId;
      const draft = storageGet(draftKey);
      if (draft && typeof draft === 'object') {
        if (typeof draft.name === 'string') field(form, 'display_name').value = draft.name.slice(0,32);
        if (field(form, 'team_id') && typeof draft.teamId === 'string') field(form, 'team_id').value = draft.teamId;
        field(form, 'is_minor').checked = draft.isMinor === true;
      }
      const save = () => { storagePut(draftKey,{name:value(form,'display_name'),teamId:value(form,'team_id'),isMinor:checked(form,'is_minor')}); button.textContent = value(form,'display_name') ? 'この呼び名でノートを始める →' : '名前なしでも、ノートを始める →'; };
      save(); form.addEventListener('input', save);
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (button.disabled) return;
        const name = value(form,'display_name');
        if (name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) { tell('呼び名は32文字以内で入力してください。空欄でも参加できます。',true); field(form,'display_name').focus(); return; }
        button.disabled = true; save(); tell('参加情報を確認しています。');
        try { const data = await jsonRequest(base + '/checkin','POST',{display_name:name,team_id:value(form,'team_id') || null,is_minor:checked(form,'is_minor'),share_location:false,guardian_location_consent:false,...(root.dataset.discoveryGeminiConsentVersion?{discovery_gemini_notice_version:root.dataset.discoveryGeminiConsentVersion}:{})}); if (typeof data.participant_id !== 'string' || !data.participant_id) throw new Error('参加の結果を確認できませんでした。入力は残っています。'); storagePut(draftKey,null); tell('ノートを開きます。'); window.location.assign('/events/' + encodeURIComponent(sessionId) + '/rally'); }
        catch (error) { tell(error.message || '参加の結果を確認できませんでした。同じボタンから再確認できます。',true); button.disabled = false; }
      });
      return;
    }
    /* CAPTURE */
    if (kind === 'capture') {
      const form = query('[data-discovery-media-form]');
      const list = query('[data-discovery-receipts]');
      const refresh = query('[data-discovery-refresh]');
      const fields = query('[data-discovery-capture-fields]');
      const count = query('[data-discovery-photo-count]');
      const limit = query('[data-discovery-limit-message]');
      const preview = query('[data-discovery-photo-preview]');
      const pendingKey = 'zukan:event-discovery:upload:' + sessionId;
      const draftKey = 'zukan:event-discovery:capture-draft:' + sessionId;
      let pending = storageGet(pendingKey);
      if (!pending || typeof pending.key !== 'string') pending = null;
      let loaded = false; let activeCount = 0; let savedCount = 0; let saving = false; let reading = false; let previewUrl = null; let reservations = []; let selectedPhoto = null;
      const retryReservation = () => pending && reservations.some(receipt => receipt.idempotencyKey === pending.key && receipt.mediaState !== 'saved');
      function updateForm() {
        const retrying = retryReservation();
        const photoOptions=query('[data-discovery-photo-options]');if(photoOptions)photoOptions.hidden=!selectedPhoto;
        const heading=query('[data-discovery-capture-heading]');if(heading)heading.textContent=savedCount>0?'次の写真を追加する':'写真を１枚、残そう。';
        if (fields) fields.disabled = !loaded || (activeCount >= 3 && !retrying) || saving;
        if (limit) limit.textContent = !loaded ? '保存済みの写真を確認してから追加できます。' : retrying ? '保存が完了していない写真を再試行します。同じ写真を選んでください。' : activeCount >= 3 && savedCount === 3 ? '３枚の写真がそろいました。入れ替えたいときは、写真を取り下げてから追加できます。' : activeCount >= 3 ? '３枚分の記録があります。保存が完了していない記録は、再試行するか取り下げてください。' : 'あと' + (3-activeCount) + '枚まで。１枚や２枚で終えても大丈夫です。';
        if (count) count.textContent = loaded ? savedCount + ' / 3 枚を保存' + (activeCount > savedCount ? ' · 保存未完了 ' + (activeCount-savedCount) + '件' : '') : '';
      }
      const clearPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; preview?.replaceChildren(); };
      function draftPayload() { return {caption:value(form,'caption'),spotLabel:value(form,'spot_label'),galleryConsent:checked(form,'gallery_consent'),guardianGalleryConsent:checked(form,'guardian_gallery_consent'),privateStorageConsent:checked(form,'private_storage_consent'),creatorRightsAttestation:checked(form,'creator_rights_attestation')}; }
      function restoreDraft(draft) {
        if (!form || !draft || typeof draft !== 'object') return;
        field(form,'caption').value = String(draft.caption || '').slice(0,280);
        field(form,'spot_label').value = String(draft.spotLabel || '').slice(0,80);
        for (const [name,key] of [['gallery_consent','galleryConsent'],['guardian_gallery_consent','guardianGalleryConsent'],['private_storage_consent','privateStorageConsent'],['creator_rights_attestation','creatorRightsAttestation']]) field(form,name).checked = draft[key] === true;
        syncGuardian(form,root.dataset.isMinor === 'true');
      }
      function resetDraft() { form?.reset(); selectedPhoto=null; storagePut(draftKey,null); clearPreview(); if(form){field(form,'media').required=true;syncGuardian(form,root.dataset.isMinor === 'true');} }
      function paint(receipts) {
        list.replaceChildren();
        reservations = receipts.filter(receipt => receipt.kind !== 'paper' && receipt.rightsReviewStatus !== 'withdrawn' && receipt.galleryStatus !== 'withdrawn');
        activeCount = reservations.length;
        savedCount = reservations.filter(receipt => receipt.mediaState === 'saved').length;
        reservations.forEach((receipt,index) => {
          const card = node('article',null,'ed-receipt');
          const href = receipt.mediaState === 'saved' && permittedMediaHref(receipt.privateContentHref,true);
          if (href) { const img = node('img'); img.src = href; img.alt = '自分が残した写真 ' + (index+1); img.loading = 'lazy'; card.append(img); }
          card.append(node('h3',receipt.spotLabel || 'とっておき ' + (index+1)));
          if (receipt.caption) card.append(node('p',receipt.caption));
          card.append(node('p',receipt.mediaState === 'saved' ? labels[receipt.galleryStatus] || '記録の状態を確認できません' : receipt.mediaState === 'uploading' ? '保存の完了を確認しています。再読み込みで状態を確認できます。' : '保存が完了していません。同じ写真で再試行できます。','ed-gallery-state'));
          if (receipt.galleryStatus === 'pending_review' && reviewReasons[receipt.reviewRequiredReason]) card.append(node('p',reviewReasons[receipt.reviewRequiredReason],'ed-help'));
          if (receipt.galleryStatus === 'published') { const gallery=node('a','みんなの発見で見る →','ed-text-link');gallery.href='/events/'+encodeURIComponent(sessionId)+'/discoveries';card.append(gallery); }
          if (form && receipt.mediaState !== 'saved' && typeof receipt.idempotencyKey === 'string') {
            const retry = node('button','この写真を再試行','ed-button ed-small'); retry.type='button';
            retry.addEventListener('click',()=>{if(saving)return;pending={key:receipt.idempotencyKey,fingerprint:null,payload:{caption:receipt.caption,spotLabel:receipt.spotLabel,galleryConsent:receipt.galleryConsent,guardianGalleryConsent:receipt.guardianGalleryConsent}};storagePut(pendingKey,pending);restoreDraft(pending.payload);storagePut(draftKey,draftPayload());updateForm();tell('同じ写真を選んで、保存を再試行してください。別の写真にする場合は、この記録を取り下げてから追加します。');field(form,'media').focus();});card.append(retry);
          }
          if (typeof receipt.receiptId === 'string') {
            const withdraw = node('button','取り下げる','ed-button ed-small'); withdraw.type='button';
            withdraw.addEventListener('click',async()=>{if(saving||!window.confirm('この写真とメモを削除し、ギャラリーからも取り下げます。削除後は元に戻せません。続けますか。'))return;withdraw.disabled=true;tell('取り下げを確認しています。');try{await jsonRequest(base+'/guest-media/'+encodeURIComponent(receipt.receiptId)+'/withdraw','POST',{});if(pending?.key===receipt.idempotencyKey){pending=null;storagePut(pendingKey,null);resetDraft();}const verified=await load();if(verified)tell('写真を取り下げました。');}catch(error){await load();tell(error.message||'取り下げの結果を確認できませんでした。再読み込みで確認してください。',true);}});card.append(withdraw);
          }
          list.append(card);
        });
        if (!list.childNodes.length) { const empty=node('div',null,'ed-empty');empty.append(node('p','まだ写真はありません。気に入ったものを、１枚から。'));list.append(empty); }
      }
      async function load() {
        if (reading) return false; reading=true; refresh.disabled=true;
        try {
          const data=await request(base+'/guest-media');
          if(!Array.isArray(data.receipts))throw new Error('記録の一覧を読み取れませんでした。');
          const matched=pending&&data.receipts.find(receipt=>receipt.idempotencyKey===pending.key&&receipt.mediaState==='saved');
          if(matched){pending=null;storagePut(pendingKey,null);resetDraft();tell('前の送信で写真が保存されていることを確認しました。');}
          paint(data.receipts);loaded=true;return true;
        }catch(error){if(!loaded)list.replaceChildren(node('p','保存済みの記録を読み込めませんでした。「再読み込み」から確認できます。','ed-help'));tell(error.message||'記録を読み込めませんでした。',true);return false;}
        finally{reading=false;refresh.disabled=false;updateForm();}
      }
      refresh.addEventListener('click',()=>void load());
      if(form){
        const photo=field(form,'media'),camera=field(form,'camera_media');restoreDraft(pending?.payload||storageGet(draftKey));
        form.addEventListener('input',()=>storagePut(draftKey,draftPayload()));
        form.addEventListener('change',()=>{syncGuardian(form,root.dataset.isMinor==='true');storagePut(draftKey,draftPayload());});
        function choosePhoto(input,alternate){
          const file=input.files?.[0];if(!file)return;
          if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12582912){tell('12 MB以下のJPEG・PNG・WebP写真を選んでください。',true);input.value='';photo.required=!selectedPhoto;return;}
          selectedPhoto=file;if(alternate)alternate.value='';photo.required=false;clearPreview();previewUrl=URL.createObjectURL(file);const img=node('img');img.src=previewUrl;img.alt='選んだ写真。まだ保存していません。';preview.append(img,node('p','この写真を保存します。まだ送信・掲載されていません。','ed-help'));updateForm();tell('写真を選びました。保存と共有の希望を確認してください。');
        }
        photo.addEventListener('change',()=>choosePhoto(photo,camera));camera?.addEventListener('change',()=>choosePhoto(camera,photo));
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(saving||!loaded||(activeCount>=3&&!retryReservation()))return;
          const file=selectedPhoto||photo.files?.[0]||camera?.files?.[0];photo.required=!file;if(!form.reportValidity()||!file)return;
          if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12582912){tell('12 MB以下のJPEG・PNG・WebP写真を選んでください。',true);return;}
          const payload=draftPayload();
          const fingerprint=JSON.stringify([file.name,file.size,file.lastModified,payload.caption,payload.spotLabel,payload.galleryConsent,payload.guardianGalleryConsent]);
          if(pending?.fingerprint&&pending.fingerprint!==fingerprint){tell('前の写真の保存結果を先に確認してください。「再読み込み」で記録を確認し、同じ写真・内容で再試行できます。',true);await load();return;}
          if(!pending)pending={key:randomKey()};pending.fingerprint=fingerprint;pending.payload=payload;storagePut(pendingKey,pending);storagePut(draftKey,payload);
          saving=true;updateForm();tell(payload.galleryConsent?'写真を保存し、写り込みを確認しています。画面をそのままにしてください。':'写真を保存しています。画面をそのままにしてください。');
          try{
            const data=new FormData();data.set('media',file);data.set('caption',payload.caption);data.set('spot_label',payload.spotLabel);data.set('gallery_consent',payload.galleryConsent?'yes':'no');data.set('guardian_gallery_consent',payload.guardianGalleryConsent?'yes':'no');data.set('private_storage_consent','yes');data.set('creator_rights_attestation','yes');
            const saved=await request(base+'/guest-media',{method:'POST',headers:{'idempotency-key':pending.key},body:data});
            if(!saved.receipt||typeof saved.receipt.receiptId!=='string')throw new Error('保存の結果を確認できませんでした。「再読み込み」で確認してください。');
            const galleryState=saved.receipt.galleryStatus;
            pending=null;storagePut(pendingKey,null);resetDraft();const verified=await load();
            if(verified)tell(galleryState==='published'?'写真を保存し、みんなの発見に掲載しました。':galleryState==='pending_review'?'写真を保存しました。'+(reviewReasons[saved.receipt.reviewRequiredReason]||'みんなの発見への掲載は、写り込みなどの確認待ちです。'):'写真を保存しました。自分と主催者だけが確認できます。');
            else tell('写真の保存を受け付けました。一覧の読み込みに失敗したため、「再読み込み」で確認してください。',true);
          }catch(error){
            const uncertain=error.unknownEffect||!error.status;
            const verified=await load();
            if(uncertain&&!pending&&verified){tell('写真が保存されていることを確認しました。');}
            else {if(!uncertain&&!retryReservation()){pending=null;storagePut(pendingKey,null);}tell(uncertain?'保存の結果を確認できませんでした。記録の一覧を確認し、未保存なら同じ写真・内容で再試行できます。':error.message,true);}
          }finally{saving=false;updateForm();}
        });
      }
      window.addEventListener('pagehide',clearPreview);void load();return;
    }
    /* GALLERY */
    if(kind==='gallery'){galleryController({list:query('[data-discovery-journals]'),counts:query('[data-discovery-counts]'),refresh:query('[data-discovery-refresh]'),more:query('[data-discovery-more]'),target:status}).show(base);return;}
    /* ORGANIZER */
    if(kind==='organizer'){
      const campaignForm=query('[data-discovery-campaign-settings]'),settingsStatus=query('[data-discovery-settings-status]'),participantCounts=query('[data-discovery-participant-counts]');
      let campaignSnapshot=null,settingsBusy=false;
      function paintCampaign(data){
        if(!data.campaign||typeof data.campaign.listed!=='boolean'||typeof data.campaign.applicationsOpen!=='boolean'||typeof data.canManageListing!=='boolean'||typeof data.canManageApplications!=='boolean')throw new Error('案内の設定を読み取れませんでした。');
        campaignSnapshot=data;const fields=campaignForm.querySelector('fieldset');fields.disabled=false;field(campaignForm,'listed').checked=data.canManageListing&&data.campaign.listed;field(campaignForm,'listed').disabled=!data.canManageListing;field(campaignForm,'applications_open').checked=data.campaign.applicationsOpen;field(campaignForm,'applications_open').disabled=!data.canManageApplications;
        query('[data-discovery-listing-permission]').textContent=data.canManageListing?'この設定は、竜洋の企画ページの開催日一覧への表示を切り替えます。':'現在、企画ページへの表示権限がないため、この回は開催日一覧に表示されません。事前申し込みの受付は変更できます。';
        const link=query('[data-discovery-campaign-link]');const href=data.campaignHref;if(typeof href==='string'&&href.startsWith('/events/ryuyo?event=')&&!href.includes('\\')){link.href=href;link.hidden=false;}else link.hidden=true;
        const counts=data.participantCounts;if(counts&&Number.isInteger(counts.registered)&&Number.isInteger(counts.checkedIn)&&counts.registered>=0&&counts.checkedIn>=0)participantCounts.textContent='申し込み受付 '+counts.registered+'人 · 当日参加 '+counts.checkedIn+'人';else participantCounts.textContent='申し込みの件数を確認できません。再読み込みしてください。';
      }
      async function loadCampaignSettings(){if(!campaignForm||settingsBusy)return;try{paintCampaign(await request(base+'/discovery-campaign'));tell('',false,settingsStatus);}catch(error){participantCounts.textContent='申し込みの状況を読み込めませんでした。再読み込みしてください。';tell(error.message||'案内の設定を読み込めませんでした。',true,settingsStatus);}}
      campaignForm?.addEventListener('submit',async event=>{event.preventDefault();if(settingsBusy||!campaignSnapshot)return;const fields=campaignForm.querySelector('fieldset');const payload={listed:campaignSnapshot.canManageListing?checked(campaignForm,'listed'):false,applicationsOpen:campaignSnapshot.canManageApplications?checked(campaignForm,'applications_open'):campaignSnapshot.campaign.applicationsOpen};settingsBusy=true;fields.disabled=true;tell('案内と申込受付を保存しています。',false,settingsStatus);
        try{const data=await jsonRequest(base+'/discovery-campaign','PATCH',payload);if(data.campaign?.listed!==payload.listed||data.campaign?.applicationsOpen!==payload.applicationsOpen)throw new Error('設定の保存結果を確認できませんでした。再読み込みしてください。');paintCampaign(data);tell('案内と申込受付を保存しました。写真の受付開始は、上の「企画の準備と進行」で操作します。',false,settingsStatus);}catch(error){tell(error.message||'設定を保存できませんでした。再読み込みで確認してください。',true,settingsStatus);fields.disabled=false;field(campaignForm,'listed').disabled=!campaignSnapshot.canManageListing;field(campaignForm,'applications_open').disabled=!campaignSnapshot.canManageApplications;}finally{settingsBusy=false;}
      });
      void loadCampaignSettings();

      const list=query('[data-discovery-review-list]');
      const more=query('[data-discovery-more]');
      const refresh=query('[data-discovery-refresh]');
      const reviewCount=query('[data-discovery-review-count]');
      const filters=[...root.querySelectorAll('[data-discovery-review-filter]')];
      let nextCursor=null;let busy=false;let reviewFilter='pending';let known=new Map();
      const isPending=receipt=>receipt.rightsReviewStatus==='pending'||receipt.galleryStatus==='pending_review';
      const isShown=receipt=>reviewFilter==='all'||(reviewFilter==='pending'?isPending(receipt):!isPending(receipt));
      function updateReviewCount(){const rows=[...known.values()];const visible=rows.filter(isShown);reviewCount.textContent=visible.length+'件を表示 · 読み込み済み '+rows.length+'件'+(nextCursor?'（続きがあります）':'');filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.discoveryReviewFilter===reviewFilter)));}
      function paintReviews(){list.replaceChildren();[...known.values()].filter(isShown).forEach(receipt=>list.append(reviewCard(receipt)));if(!list.childNodes.length)list.append(node('p',nextCursor?'読み込み済みの範囲に、この状態の記録はありません。続きの記録を読み込めます。':'この状態の写真・メモはありません。','ed-help'));updateReviewCount();}
      function inputLabel(form,label,name,type='text',max=280,current=''){const id='ed-review-'+name+'-'+form.dataset.receiptId;const text=node('label',label);text.htmlFor=id;const control=node(type==='textarea'?'textarea':'input');if(type!=='textarea')control.type=type;control.id=id;control.name=name;control.maxLength=max;control.value=String(current||'');if(type==='textarea')control.rows=2;form.append(text,control);return control;}
      function reviewCard(receipt){
        const card=node('article',null,'ed-review');const info=node('div');
        info.append(node('h3',receipt.kind==='paper'?'紙で残した発見':'写真で残した発見'));
        info.append(node('p',receipt.displayName?receipt.displayName+'のノート':'呼び名なしのノート','ed-help'));
        const href=permittedMediaHref(receipt.privateContentHref,true);
        if(href){const img=node('img');img.src=href;img.alt='主催者が内容を確認するための写真';img.loading='lazy';const full=node('a');full.href=href;full.target='_blank';full.rel='noopener noreferrer';full.append(img,node('span','写真を大きく開く（別タブ）','ed-text-link'));info.append(full);}
        if(receipt.spotLabel)info.append(node('p',receipt.spotLabel));if(receipt.caption)info.append(node('p',receipt.caption));
        info.append(node('p',receipt.rightsReviewStatus==='rejected'?'掲載対象外':labels[receipt.galleryStatus]||'状態を確認中','ed-help'));
        const canPublish=receipt.galleryConsent===true&&(!receipt.isMinor||receipt.guardianGalleryConsent===true);
        info.append(node('p',canPublish?'本人の共有希望あり'+(receipt.isMinor?'・保護者の同意あり':''):'共有への同意がそろっていないため、公開しません','ed-help'));
        card.append(info);
        const form=node('form',null,'ed-form');form.dataset.receiptId=String(receipt.receiptId||receipt.entryId);form.dataset.receiptKind=receipt.kind==='paper'?'paper':'photo';form.noValidate=true;
        const standardNote='利用する権利と、人物・個人情報・公開に適さない位置の写り込みを確認しました。';
        const note=inputLabel(form,'確認メモ（主催者用）','note','textarea',500,receipt.rightsReviewNote||standardNote);note.minLength=8;note.required=true;
        inputLabel(form,'発見賞・紹介の見出し（掲載用・任意）','selectionLabel','text',40,receipt.selectionLabel).placeholder='例：よく見つけたで賞';
        inputLabel(form,'主催者からのひと言（掲載用・任意）','selectionComment','textarea',280,receipt.selectionComment);
        const check=node('label',null,'ed-check');const box=node('input');box.type='checkbox';box.name='confirmed';check.append(box,node('span','内容を目で確認し、利用する権利と、人物・個人情報・公開に適さない位置の写り込みに問題がないことを確認しました。'));form.append(check);
        const actions=node('div',null,'ed-review-actions');
        for(const decision of ['approved','rejected']){const label=decision==='approved'?(canPublish?(receipt.galleryStatus==='published'?'紹介・確認内容を更新する':'確認して掲載する'):'確認を保存する（公開しない）'):(receipt.galleryStatus==='published'?'掲載を止める':'掲載対象外にする');const button=node('button',label,'ed-button'+(decision==='approved'?' ed-primary':''));button.name='decision';button.value=decision;button.type='submit';actions.append(button);}
        if(receipt.kind==='paper'){
          const withdraw=node('button','この紙の記録を取り下げる','ed-button ed-small');withdraw.type='button';
          withdraw.addEventListener('click',async()=>{if(withdraw.disabled||!window.confirm('この紙の記録を削除し、ギャラリーから取り下げます。削除後は元に戻せません。続けますか。'))return;withdraw.disabled=true;try{await jsonRequest(base+'/discovery-paper/'+encodeURIComponent(form.dataset.receiptId)+'/withdraw','POST',{});known.delete(form.dataset.receiptId);card.remove();if(!list.childNodes.length)paintReviews();else updateReviewCount();tell('紙の記録を取り下げました。');}catch(error){tell(error.message||'取り下げの結果を確認できませんでした。再読み込みで確認してください。',true);withdraw.disabled=false;}});actions.append(withdraw);
        }
        form.append(actions);const localStatus=node('p',null,'ed-status');localStatus.setAttribute('role','status');localStatus.setAttribute('aria-live','polite');form.append(localStatus);
        form.addEventListener('submit',async event=>{
          event.preventDefault();const decision=event.submitter?.value;if(!['approved','rejected'].includes(decision))return;
          if(value(form,'note').length<8){tell('確認した内容を８文字以上で記入してください。',true,localStatus);note.focus();return;}
          if(decision==='approved'&&!checked(form,'confirmed')){tell('権利と写り込みを目で確認して、チェックを入れてください。',true,localStatus);box.focus();return;}
          if(!form.reportValidity())return;const buttons=[...form.querySelectorAll('button')];if(buttons.some(button=>button.disabled))return;buttons.forEach(button=>button.disabled=true);tell('確認を保存しています。',false,localStatus);
          try{
            const endpoint=base+(form.dataset.receiptKind==='paper'?'/discovery-paper/':'/guest-media/')+encodeURIComponent(form.dataset.receiptId)+'/review';
            const result=await jsonRequest(endpoint,'PATCH',{decision,note:value(form,'note'),rightsConfirmed:checked(form,'confirmed'),privacyConfirmed:checked(form,'confirmed'),selectionLabel:value(form,'selectionLabel'),selectionComment:value(form,'selectionComment')});
            if(!result.receipt||String(result.receipt.receiptId)!==form.dataset.receiptId||result.receipt.rightsReviewStatus!==decision)throw new Error('確認の保存結果を読み取れませんでした。再読み込みで状態を確認してください。');
            known.set(form.dataset.receiptId,result.receipt);
            if(isShown(result.receipt))card.replaceWith(reviewCard(result.receipt));else card.remove();
            if(!list.childNodes.length)paintReviews();else updateReviewCount();
            tell(result.receipt.galleryStatus==='published'?'確認を記録し、みんなの発見に掲載しました。':decision==='rejected'?'掲載対象外として保存しました。':'確認を記録しました。公開していません。');
          }catch(error){tell(error.message||'確認の保存結果を読み取れませんでした。再読み込みで状態を確認してください。',true,localStatus);buttons.forEach(button=>button.disabled=false);}
        });
        card.append(form);return card;
      }
      async function load(append=false){
        if(busy)return;busy=true;refresh.disabled=true;more.disabled=true;
        try{
          const data=await request(base+'/guest-media?limit=90'+(append&&nextCursor?'&cursor='+encodeURIComponent(nextCursor):''));
          if(!Array.isArray(data.receipts)&&!Array.isArray(data.reviewQueue))throw new Error('確認する記録を読み取れませんでした。');
          const rows=Array.isArray(data.receipts)?data.receipts:data.reviewQueue;
          if(!append)known=new Map();
          rows.forEach(receipt=>{const id=String(receipt.receiptId||receipt.entryId||'');if(!id||receipt.rightsReviewStatus==='withdrawn'||receipt.galleryStatus==='withdrawn'||(receipt.kind!=='paper'&&receipt.mediaState!=='saved'))return;known.set(id,receipt);});
          nextCursor=typeof data.nextCursor==='string'&&data.nextCursor?data.nextCursor:null;more.hidden=!nextCursor;paintReviews();tell(append?'続きの記録を読み込みました。':'記録を読み込みました。');
        }catch(error){if(!known.size)list.replaceChildren(node('p','記録を読み込めませんでした。「再読み込み」から確認できます。','ed-help'));tell(error.message||'記録を読み込めませんでした。',true);}
        finally{busy=false;refresh.disabled=false;more.disabled=false;}
      }
      refresh.addEventListener('click',()=>{void load(false);void loadCampaignSettings();});more.addEventListener('click',()=>void load(true));
      filters.forEach(button=>button.addEventListener('click',()=>{reviewFilter=button.dataset.discoveryReviewFilter;paintReviews();}));
      const paper=query('[data-discovery-paper-form]');
      if(paper){
        const localStatus=paper.querySelector('[data-discovery-paper-status]');
        const attemptKey='zukan:event-discovery:paper:'+sessionId;
        const draftKey='zukan:event-discovery:paper-draft:'+sessionId;
        let attempt=storageGet(attemptKey);if(!attempt||typeof attempt.key!=='string')attempt=null;
        function paperPayload(){return{nickname:value(paper,'nickname'),notes:[1,2,3].map(number=>({caption:value(paper,'caption_'+number),spotLabel:value(paper,'spot_'+number)})),isMinor:checked(paper,'is_minor'),galleryConsent:checked(paper,'gallery_consent'),guardianGalleryConsent:checked(paper,'guardian_gallery_consent')};}
        function restorePaper(draft){if(!draft||typeof draft!=='object')return;field(paper,'nickname').value=String(draft.nickname||'').slice(0,32);[1,2,3].forEach((number,index)=>{field(paper,'caption_'+number).value=String(draft.notes?.[index]?.caption||'').slice(0,280);field(paper,'spot_'+number).value=String(draft.notes?.[index]?.spotLabel||'').slice(0,80);});field(paper,'is_minor').checked=draft.isMinor===true;field(paper,'gallery_consent').checked=draft.galleryConsent===true;field(paper,'guardian_gallery_consent').checked=draft.guardianGalleryConsent===true;syncGuardian(paper);}
        restorePaper(attempt?.payload||storageGet(draftKey));
        paper.addEventListener('input',()=>storagePut(draftKey,paperPayload()));paper.addEventListener('change',()=>{syncGuardian(paper);storagePut(draftKey,paperPayload());});
        paper.addEventListener('submit',async event=>{
          event.preventDefault();const button=paper.querySelector('button[type=submit]');if(button.disabled||!paper.reportValidity())return;
          const draft=paperPayload();const payload={...draft,notes:draft.notes.filter(note=>note.caption||note.spotLabel)};
          if(!payload.notes.length){tell('発見を１つ以上入力してください。',true,localStatus);field(paper,'spot_1').focus();return;}
          const fingerprint=JSON.stringify(payload);
          if(attempt&&attempt.fingerprint!==fingerprint){tell('前の保存結果を確認してから、内容を変えてください。同じ内容で再試行すると、重複せず確認できます。',true,localStatus);return;}
          if(!attempt)attempt={key:randomKey(),fingerprint,payload:draft};storagePut(attemptKey,attempt);storagePut(draftKey,draft);button.disabled=true;tell('紙の発見を保存しています。',false,localStatus);
          try{
            const result=await jsonRequest(base+'/discovery-paper','POST',{...payload,idempotencyKey:attempt.key});
            if(typeof result.journalId!=='string'||!Array.isArray(result.entries))throw new Error('保存の結果を確認できませんでした。同じ内容で再試行できます。');
            attempt=null;storagePut(attemptKey,null);storagePut(draftKey,null);paper.reset();syncGuardian(paper);
            tell('紙の発見を保存しました。共有する記録は、上の一覧で内容を確認してください。',false,localStatus);await load(false);
          }catch(error){if(!error.unknownEffect&&error.status&&error.status<500){attempt=null;storagePut(attemptKey,null);}tell(error.unknownEffect||!error.status?'保存の結果を確認できませんでした。内容を変えずに再試行すると、同じ記録を確認できます。':error.message,true,localStatus);}
          finally{button.disabled=false;}
        });
      }
      void load(false);
    }
  });
})();`;
}

