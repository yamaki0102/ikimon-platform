/**
 * A discovery journal presentation over the existing Event, guest media and
 * organizer Review contracts. The active Worker owns all access/state checks.
 */
export const EVENT_DISCOVERY_VERSION = "event-discovery-v1" as const;
export const RYUYO_DISCOVERY_TITLE = "こんちゅうクンとめぐる、竜洋のとっておき。";
const RYUYO_FIELD_ID = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
const ASSET_ROOT = "/assets/event-discovery/";

export interface DiscoveryEventView {
  sessionId: string;
  title: string;
  eventCode: string;
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

/** Unlisted campaign introduction; deliberately not a dated event instance. */
export function renderObservationEventDiscoveryCampaign(): string {
  return surface(`
    <p class="ed-kicker">竜洋昆虫自然観察公園</p>
    <div class="ed-intro">
      <h1 class="ed-title"><span class="ed-title-preface">こんちゅうクンとめぐる、</span><span>竜洋のとっておき。</span></h1>
      <div><p>気に入った場所。<br>初めて見つけた、小さなこと。<br>今日の「ここ、いいな」を、写真で３枚まで。</p><a class="ed-button ed-primary" href="#discovery-code">参加コードを入力する<span aria-hidden="true">→</span></a></div>
    </div>
    <figure class="ed-hero">${illustration("hero", "木漏れ日の小道と池を巡る自然観察のイラスト", true)}<figcaption>イラストはイメージです</figcaption></figure>
    <ul class="ed-ribbon" aria-label="参加のしかた"><li>あだ名は任意</li><li>写真は１枚から</li><li>紙でも参加</li></ul>
    <section class="ed-section" aria-labelledby="discovery-how"><p class="ed-kicker">今日の楽しみ方</p><h2 id="discovery-how">あなたが見つけた、竜洋を残そう。</h2>
      <ol class="ed-steps"><li><span class="ed-step-number" aria-hidden="true">01</span><h3>歩いて、見つける。</h3><p>気になる虫、木かげの景色、おもしろい形。自分の「いいな」を探してみよう。</p></li><li><span class="ed-step-number" aria-hidden="true">02</span><h3>写真は、３枚まで。</h3><p>１枚でも２枚でも大丈夫。「ここがよかった」のひと言は、書きたければ。</p></li><li><span class="ed-step-number" aria-hidden="true">03</span><h3>みんなの発見に出会う。</h3><p>共有を選んだ記録は、確認後にひとり分のノートとして集まります。</p></li></ol><p class="ed-help ed-footer-note">主催者が選んだとっておきは、ひと言のコメントを添えて紹介できます。</p>
    </section>
    <section class="ed-section ed-story">${illustration("discovery", "葉の上のテントウムシと黄色いチョウ、虫眼鏡のイラスト")}<div><p class="ed-kicker">発見のヒント</p><h2>むずかしい名前は、<br>知らなくて大丈夫。</h2><p>葉っぱの重なり、きらっと光る水辺、目をこらして見つけた虫。気になったものを、よく見てみよう。</p><p>「思ったより小さかった」「この場所が好き」。そんなひと言も、あなたらしい発見です。</p></div></section>
    <section class="ed-section ed-story">${illustration("memories", "3枚の写真枠を並べた観察ノートと鉛筆のイラスト")}<div><p class="ed-kicker">写真でも、紙でも</p><h2>その日の３つを、<br>自分の言葉で。</h2><p>スマートフォンを使わない方は、紙に絵や言葉で残せます。気に入った場所と、よかった理由を自由に。</p><p>みんなに見せたい記録は、担当者が確認して同じギャラリーへ。紙だけで持ち帰るのも大丈夫です。</p><a class="ed-text-link" href="/events/ryuyo/print">紙のシートを開く</a></div></section>
    <section id="discovery-code" class="ed-section ed-code" aria-labelledby="discovery-code-heading"><div><p class="ed-kicker">開催の案内が届いた方へ</p><h2 id="discovery-code-heading">今日のノートを開こう。</h2><p>担当者から届いた参加コードを入力してください。ログインせずに始められます。</p><p class="ed-help">開催日時・集合場所は、各回の案内をご確認ください。</p></div><form data-discovery-code-form><label for="discovery-event-code">参加コード</label><input id="discovery-event-code" name="event_code" maxlength="64" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="案内に書かれたコード" required><button class="ed-button ed-primary" type="submit">参加する回を開く<span aria-hidden="true">→</span></button>${statusRegion()}</form></section>
    <section class="ed-organizer-link"><div><p>担当者の方へ</p><p class="ed-help">日時と案内を入れて、この企画の開催準備を始められます。</p></div><a class="ed-text-link" href="/community/events/new?event_template=ryuyo&amp;field_id=${RYUYO_FIELD_ID}">この企画で開催準備を始める<span aria-hidden="true"> →</span></a></section>
  `, "campaign");
}

export function renderObservationEventDiscoveryJoin(input: DiscoveryEventView & {
  isAuthenticated?: boolean;
  canJoin?: boolean;
  canViewGallery?: boolean;
  teams?: readonly { teamId: string; name: string }[];
}): string {
  const teams = input.teams ?? [];
  return surface(`
    <a class="ed-back" href="/events/ryuyo">企画の楽しみ方<span aria-hidden="true"> ↗</span></a>
    ${stateNotice(input.stateMessage)}
    <div class="ed-welcome"><div><p class="ed-kicker">あなたの発見ノート</p><h1>${escapeHtml(input.title)}</h1><p class="ed-help">${escapeHtml(dateLabel(input.startedAt))}</p><p>気に入った場所や、ちょっとした発見を写真で３枚まで。名前もコメントも、入れたければ。</p></div>${illustration("discovery", "小さな発見を楽しむ、葉と虫眼鏡のイラスト")}</div>
    ${input.canJoin === false ? '<p class="ed-notice">いまは参加の受付をしていません。主催者の案内をご確認ください。</p>' : `<form class="ed-form ed-join-form" data-discovery-join-form novalidate>
      <label for="discovery-nickname">あだ名や下の名前を、よければどうぞ<span class="ed-optional">任意</span></label><input id="discovery-nickname" name="display_name" maxlength="32" autocomplete="nickname" placeholder="例：ゆう、むしずき" aria-describedby="discovery-name-help"><p class="ed-help" id="discovery-name-help">空欄でも参加できます。本名や連絡先は書かないでください。</p>
      ${teams.length ? `<label for="discovery-team">班<span class="ed-optional">任意</span></label><select id="discovery-team" name="team_id"><option value="">選ばない</option>${teams.map((team) => `<option value="${escapeHtml(team.teamId)}">${escapeHtml(team.name)}</option>`).join("")}</select>` : ""}
      <label class="ed-check"><input type="checkbox" name="is_minor"><span>参加者に未成年が含まれます</span></label>
      <p class="ed-help">${input.isAuthenticated ? "このイベントでの呼び名を使います。" : "ログインは不要です。"}同じ端末・ブラウザから、自分の記録を見返せます。写真や呼び名の公開は、あとで選べます。</p>
      ${statusRegion()}<button class="ed-button ed-primary" type="submit" data-discovery-join-submit>名前なしでも、ノートを始める<span aria-hidden="true">→</span></button>
    </form>`}
    ${input.canViewGallery ? `<p><a class="ed-button" href="${escapeHtml(eventHref(input.sessionId, "discoveries"))}">みんなの発見を見る<span aria-hidden="true"> →</span></a></p>` : ""}
    <p class="ed-help ed-footer-note"><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "print"))}">紙のシートを使う</a>　写真を撮らずに、歩いて楽しむだけでも大丈夫です。</p>
  `, "join", attrs(input));
}

export function renderObservationEventDiscoveryCapture(input: DiscoveryEventView & {
  displayName?: string | null;
  isMinor?: boolean;
  canSubmit?: boolean;
  canManage?: boolean;
}): string {
  const title = input.displayName?.trim() ? `${input.displayName.trim()}の発見ノート` : "自分の発見ノート";
  return surface(`
    <div class="ed-context"><a class="ed-back" href="/events/ryuyo">竜洋のとっておき</a><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "discoveries"))}">みんなの発見を見る</a></div>
    ${stateNotice(input.stateMessage)}
    <header class="ed-page-heading"><p class="ed-kicker">${escapeHtml(input.title)}</p><h1>${escapeHtml(title)}</h1><p>今日の「ここ、いいな」を、写真で３枚まで。１枚から残せます。</p></header>
    ${statusRegion()}<div class="ed-own-heading"><h2>残した写真</h2><button class="ed-button ed-small" type="button" data-discovery-refresh>再読み込み</button></div><div class="ed-own-journal" data-discovery-receipts><p class="ed-help">保存した記録を読み込んでいます。</p></div>
    <p class="ed-help" data-discovery-photo-count></p>
    ${input.canSubmit === true ? `<form class="ed-form ed-capture-form" data-discovery-media-form>
      <h2>とっておきを、もうひとつ。</h2><p class="ed-help" data-discovery-limit-message>保存済みの写真を確認してから追加できます。</p>
      <fieldset data-discovery-capture-fields disabled><legend class="ed-sr-only">写真とひと言</legend>
      <label class="ed-photo-picker" for="discovery-photo"><span class="ed-photo-plus" aria-hidden="true">＋</span><strong>写真を撮る・選ぶ</strong><span class="ed-help">１枚ずつ・JPEG / PNG / WebP・12 MB まで</span></label><input class="ed-file" id="discovery-photo" name="media" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required aria-describedby="discovery-photo-help"><p id="discovery-photo-help" class="ed-help">人物や名札、車の番号などが写らないようにしてください。</p><div class="ed-selected-preview" data-discovery-photo-preview></div>
      <label for="discovery-spot">どこが気に入った？<span class="ed-optional">任意</span></label><input id="discovery-spot" name="spot_label" maxlength="80" placeholder="例：木かげの小道">
      <label for="discovery-caption">よかったこと・発見したこと<span class="ed-optional">任意</span></label><textarea id="discovery-caption" name="caption" maxlength="280" rows="3" placeholder="ひと言でも、空欄でも。"></textarea>
      <label class="ed-check"><input name="private_storage_consent" type="checkbox" value="yes" required><span>写真を保存し、自分と主催者が確認できるようにします。</span></label>
      <label class="ed-check"><input name="creator_rights_attestation" type="checkbox" value="yes" required><span>自分で撮った写真、またはこの用途で使う許可を得た写真です。</span></label>
      <div class="ed-share-choice"><label class="ed-check"><input name="gallery_consent" type="checkbox" value="yes"><span>みんなの発見に載せてもよい<span class="ed-help">この写真・ひと言・場所のメモ・呼び名を、主催者の確認後に掲載します。リンクを知っている人が見られます。</span></span></label><p class="ed-help">選ばなくても、自分の記録として保存できます。</p>
      <label class="ed-check" data-discovery-guardian-row hidden><input name="guardian_gallery_consent" type="checkbox" value="yes"><span>このギャラリーへの公開について、保護者の同意があります。</span></label></div>
      <button class="ed-button ed-primary" type="submit" data-discovery-save>この写真を保存する</button></fieldset>
    </form>` : '<p class="ed-notice">いまは写真を追加できません。保存済みの記録はここで確認できます。</p>'}
    <div class="ed-paper-strip"><div><h2>紙で残しても大丈夫。</h2><p>気に入った場所を、絵や言葉で。共有したいときは、担当者に渡してください。</p></div><a class="ed-button" href="${escapeHtml(eventHref(input.sessionId, "print"))}">紙のシートを開く</a></div>
    ${input.canManage ? `<p class="ed-help"><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "console"))}">主催者の画面へ</a></p>` : ""}
  `, "capture", `${attrs(input)} data-is-minor="${input.isMinor === true}"`);
}

export function renderObservationEventDiscoveryGallery(input: DiscoveryEventView & { canManage?: boolean }): string {
  return surface(`
    <div class="ed-context"><a class="ed-back" href="/events/ryuyo">竜洋のとっておき</a><a class="ed-text-link" href="${escapeHtml(eventHref(input.sessionId, "rally"))}">自分のノートへ</a></div>
    <header class="ed-gallery-heading"><p class="ed-kicker">${escapeHtml(input.title)}</p><h1>みんなの、とっておき。</h1><p>同じ場所を歩いても、見つけるものはひとりずつ。<br>写真とひと言で集まった、小さな発見ノートです。</p></header>
    <div class="ed-gallery-toolbar"><p class="ed-help" data-discovery-counts>掲載されたノートを読み込んでいます。</p><button class="ed-button ed-small" type="button" data-discovery-refresh>新しい発見を読み込む</button></div>
    ${statusRegion()}<div class="ed-journals" data-discovery-journals></div><button class="ed-button ed-load-more" type="button" data-discovery-more hidden>続きを見る</button>
    <p class="ed-help ed-footer-note">本人が共有を選び、主催者が確認した記録を掲載しています。このページはリンクを知っている人が見られます。</p>
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
.ed{color:#17211b;font-size:16px;line-height:1.8;overflow-wrap:anywhere}.ed *{box-sizing:border-box}.ed [hidden]{display:none!important}.ed p{margin:0 0 16px}.ed h1,.ed h2,.ed h3{font-weight:700;color:#143f2e;line-height:1.45}.ed h1{font-size:32px;margin:0 0 16px}.ed h2{font-size:26px;margin:0 0 20px}.ed h3{font-size:20px;margin:0 0 12px}.ed input,.ed select,.ed textarea,.ed button{font:inherit}.ed input,.ed textarea,.ed select{max-width:100%;color:#17211b}.ed a{color:#0055ad;text-underline-offset:4px}.ed button,.ed a,.ed input,.ed select,.ed textarea{touch-action:manipulation}.ed .ed-kicker{font-size:14px;letter-spacing:.06em;font-weight:700;color:#55615a;margin:0 0 16px}.ed .ed-help{font-size:14px;color:#55615a;line-height:1.75}.ed .ed-button{display:inline-flex;justify-content:center;align-items:center;gap:12px;min-width:44px;min-height:48px;border:1px solid #68746c;border-radius:4px;padding:10px 20px;background:#fff;color:#17211b;font-weight:700;text-decoration:none;line-height:1.5;white-space:normal;cursor:pointer}.ed .ed-button.ed-primary{background:#143f2e;color:#fff;border-color:#143f2e}.ed .ed-button:not(:disabled):hover{background:#eef2e9}.ed .ed-button.ed-primary:not(:disabled):hover{background:#0f3023}.ed .ed-button:disabled{color:#55615a;background:#eef0ec;cursor:default;border-color:#a0a8a2}.ed .ed-button.ed-small{font-size:14px;padding:8px 14px;min-height:44px}.ed :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid #000;outline-offset:3px;box-shadow:0 0 0 6px #ffd43d}.ed .ed-status:focus{outline:2px solid #143f2e;outline-offset:4px}.ed .ed-text-link,.ed .ed-back{display:inline-flex;align-items:center;min-height:44px;line-height:1.5}.ed .ed-text-link{font-weight:700}.ed .ed-back{font-size:14px}.ed .ed-intro{display:grid;grid-template-columns:1.35fr 1fr;gap:32px;align-items:end;margin:24px 0 28px}.ed .ed-title{font-size:46px;letter-spacing:.01em;margin:0}.ed .ed-title>span{display:block}.ed .ed-title .ed-title-preface{font-size:28px;margin-bottom:8px}.ed .ed-intro p{margin:0 0 20px}.ed .ed-hero{margin:0}.ed .ed-hero img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:8px}.ed .ed-hero figcaption{font-size:14px;color:#55615a;text-align:right;margin-top:6px}.ed .ed-ribbon{list-style:none;margin:0;padding:24px 0 32px;display:flex;justify-content:center;gap:32px;border-bottom:1px solid #dde2dc}.ed .ed-ribbon li{display:flex;align-items:center;gap:12px}.ed .ed-ribbon li::before{content:"";display:block;width:8px;height:8px;border-radius:50%;background:#e2b63c}.ed .ed-section{padding:48px 0;border-bottom:1px solid #dde2dc}.ed .ed-steps{list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;margin:0;padding:0}.ed .ed-step-number{font-size:14px;font-weight:700;color:#143f2e;letter-spacing:.12em;display:block;margin-bottom:8px}.ed .ed-steps p{color:#55615a;margin:0}.ed .ed-story{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.55fr);align-items:center;gap:48px}.ed .ed-story>img{width:100%;height:auto;aspect-ratio:1;border-radius:8px}.ed .ed-story h2{font-size:28px}.ed .ed-code{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;scroll-margin-top:96px}.ed .ed-code input{display:block;width:100%;margin:8px 0 16px;min-height:48px;padding:10px 12px;border:1px solid #68746c;border-radius:4px;background:#fff}.ed .ed-code label{font-weight:700}.ed .ed-organizer-link{padding:28px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:32px}.ed .ed-organizer-link p{margin:0}.ed .ed-organizer-link>a{max-width:280px}.ed .ed-welcome{display:grid;grid-template-columns:1.7fr 1fr;gap:32px;align-items:center;margin:24px 0 32px}.ed .ed-welcome img{display:block;width:100%;height:auto;border-radius:8px}.ed .ed-form{max-width:720px}.ed .ed-form label:not(.ed-check):not(.ed-photo-picker){display:block;font-weight:700;margin:20px 0 8px}.ed .ed-form input:not([type=checkbox]):not([type=file]),.ed .ed-form select,.ed .ed-form textarea{display:block;width:100%;min-height:48px;padding:10px 12px;border:1px solid #68746c;border-radius:4px;background:#fff;line-height:1.5}.ed .ed-form textarea{resize:vertical}.ed .ed-form fieldset{border:0;min-width:0;margin:0;padding:0}.ed .ed-form fieldset:disabled{opacity:.7}.ed .ed-form .ed-help{margin-top:8px}.ed .ed-optional{font-size:14px;font-weight:400;margin-inline-start:8px;color:#55615a}.ed .ed-check{display:flex;gap:12px;align-items:flex-start;min-height:44px;padding:10px 0;font-weight:400;cursor:pointer}.ed .ed-check input{flex:0 0 auto;width:20px;height:20px;margin:4px 0 0;accent-color:#143f2e}.ed .ed-check .ed-help{display:block;margin:4px 0 0}.ed .ed-status{margin:12px 0}.ed .ed-status:empty{display:none}.ed .ed-status:not(:empty){padding:12px 16px;border-inline-start:3px solid #68746c;background:#eef2e9}.ed .ed-status[data-error=true]{color:#b42318;border-color:#b42318;background:#fff3ef}.ed .ed-notice{padding:16px 20px;border-inline-start:3px solid #68746c;background:#eef2e9;margin:20px 0}.ed .ed-context,.ed .ed-own-heading,.ed .ed-gallery-toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.ed .ed-context{margin-bottom:24px}.ed .ed-page-heading{margin-bottom:32px}.ed .ed-own-heading{margin-bottom:16px}.ed .ed-own-heading h2{margin:0}.ed .ed-own-heading .ed-kicker{margin-bottom:4px}.ed .ed-own-journal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.ed .ed-receipt{min-width:0;border-bottom:1px solid #dde2dc;padding-bottom:20px}.ed .ed-receipt img{width:100%;height:200px;object-fit:contain;background:#edf1e9;border-radius:8px}.ed .ed-receipt h3{font-size:18px;margin:12px 0 8px}.ed .ed-receipt p{white-space:pre-wrap;margin:8px 0}.ed .ed-receipt .ed-gallery-state{font-size:14px;white-space:normal;color:#55615a}.ed .ed-capture-form{border-top:1px solid #dde2dc;margin-top:32px;padding-top:28px}.ed .ed-photo-picker{display:flex;align-items:center;justify-content:center;flex-direction:column;min-height:160px;padding:24px;border:1px dashed #68746c;background:#f5f6f0;border-radius:8px;cursor:pointer;gap:6px}.ed .ed-photo-plus{font-size:30px;line-height:1}.ed .ed-file{display:block;max-width:100%;margin-top:12px;min-height:44px;font-size:14px}.ed .ed-file::file-selector-button{font:inherit;min-height:44px;padding:8px 12px;border:1px solid #68746c;background:#fff;color:#17211b;border-radius:4px;margin-right:12px}.ed .ed-selected-preview:empty{display:none}.ed .ed-selected-preview img{display:block;max-width:100%;max-height:360px;object-fit:contain;border-radius:8px}.ed .ed-share-choice{padding:16px 20px;background:#eef2e9;border-radius:8px;margin:16px 0 24px}.ed .ed-share-choice>p:last-child{margin-bottom:0}.ed .ed-paper-strip{display:flex;align-items:center;justify-content:space-between;gap:24px;border-top:1px solid #dde2dc;margin-top:40px;padding-top:28px}.ed .ed-paper-strip h2{font-size:22px;margin-bottom:8px}.ed .ed-paper-strip p{margin:0}.ed .ed-paper-strip .ed-button{flex-shrink:0}.ed .ed-gallery-heading{max-width:720px;margin:24px 0 40px}.ed .ed-gallery-heading h1{font-size:40px}.ed .ed-gallery-toolbar{padding-bottom:20px;border-bottom:1px solid #dde2dc;margin-bottom:24px}.ed .ed-gallery-toolbar p{margin:0}.ed .ed-journals{display:grid;gap:32px}.ed .ed-journal{padding:24px;border:1px solid #dde2dc;border-radius:8px;background:#fff}.ed .ed-journal h2{font-size:22px;margin:0 0 20px}.ed .ed-journal-entries{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.ed .ed-entry{min-width:0;margin:0}.ed .ed-entry img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#f1f3ed;border-radius:4px}.ed .ed-entry h3{font-size:18px;margin:12px 0 8px}.ed .ed-entry p{white-space:pre-wrap;margin:8px 0}.ed .ed-paper-note-view{border-top:3px solid #d8b446;background:#fbfaf2;padding:20px;min-height:160px}.ed .ed-paper-note-view .ed-kicker{margin:0 0 8px}.ed .ed-selection{padding:12px 14px;background:#f7f1d9;margin-top:12px;border-radius:4px}.ed .ed-selection strong{font-size:14px;display:block}.ed .ed-selection p{font-size:14px;margin-bottom:0}.ed .ed-empty{padding:40px 0;max-width:560px}.ed .ed-empty h2{margin-bottom:12px}.ed .ed-load-more{display:flex;margin:28px auto 0}.ed .ed-footer-note{margin-top:28px}.ed .ed-review-filters{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.ed .ed-review-filters [aria-pressed=true]{background:#143f2e;color:#fff;border-color:#143f2e}.ed .ed-review{padding:24px 0;border-bottom:1px solid #dde2dc;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:24px}.ed .ed-review img{display:block;width:100%;max-height:360px;object-fit:contain;background:#f1f3ed;border-radius:8px}.ed .ed-review>div>p{white-space:pre-wrap}.ed .ed-review .ed-form label{margin-top:12px}.ed .ed-review-actions{display:flex;gap:12px;flex-wrap:wrap}.ed .ed-review .ed-help{margin-bottom:8px}.ed .ed-paper-entry{margin-top:32px;border-top:1px solid #dde2dc}.ed summary{cursor:pointer;min-height:48px;padding:16px 0;font-weight:700;line-height:1.5}.ed .ed-paper-fields{margin-top:24px!important;border-top:1px solid #dde2dc!important;padding-top:16px!important}.ed .ed-paper-fields legend{font-weight:700;padding:0 12px 0 0}.ed .ed-print-toolbar{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}.ed .ed-print-sheet{background:white;padding:32px;border:1px solid #dde2dc}.ed .ed-print-sheet h1{font-size:26px}.ed .ed-print-name{display:flex;flex-wrap:wrap;gap:8px}.ed .ed-print-name span{min-width:160px;flex:1;border-bottom:1px solid #68746c}.ed .ed-print-note{border:1px solid #68746c;border-radius:4px;padding:16px;margin:20px 0;break-inside:avoid}.ed .ed-print-note h2{font-size:18px;margin:0}.ed .ed-print-note h2 span{margin-right:12px}.ed .ed-print-writing{height:96px}.ed .ed-print-line{height:28px;border-top:1px solid #dde2dc;border-bottom:1px solid #dde2dc}.ed .ed-print-choice{margin-top:24px}.ed .ed-sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(min-width:721px) and (max-width:900px){.ed .ed-intro{grid-template-columns:1fr;gap:24px}.ed .ed-title{font-size:40px}}
@media(max-width:720px){.ed h1{font-size:28px}.ed h2{font-size:24px}.ed .ed-intro{grid-template-columns:1fr;gap:24px;margin-top:8px}.ed .ed-title{font-size:30px}.ed .ed-title .ed-title-preface{font-size:22px}.ed .ed-hero img{aspect-ratio:1.35;object-position:40% 50%}.ed .ed-ribbon{justify-content:flex-start;gap:12px 20px;flex-wrap:wrap;padding:20px 0 24px;font-size:14px}.ed .ed-steps{grid-template-columns:1fr;gap:24px}.ed .ed-step-number{float:left;margin:3px 16px 0 0}.ed .ed-steps h3{margin-bottom:8px}.ed .ed-section{padding:32px 0}.ed .ed-story{grid-template-columns:1fr;gap:24px}.ed .ed-story>img{max-width:360px;margin:auto}.ed .ed-story h2{font-size:26px}.ed .ed-code{grid-template-columns:1fr;gap:24px}.ed .ed-organizer-link{flex-direction:column;gap:12px}.ed .ed-organizer-link>a{max-width:none}.ed .ed-welcome{grid-template-columns:1fr;gap:16px}.ed .ed-welcome img{display:none}.ed .ed-join-form .ed-button{width:100%}.ed .ed-own-journal{grid-template-columns:1fr}.ed .ed-receipt{display:grid;grid-template-columns:120px minmax(0,1fr);gap:0 16px}.ed .ed-receipt>img{height:120px;grid-row:1/5}.ed .ed-receipt>h3{margin-top:0}.ed .ed-receipt>.ed-button{grid-column:2;justify-self:start}.ed .ed-receipt>p{margin-top:0}.ed .ed-paper-strip{flex-direction:column;align-items:flex-start;gap:16px}.ed .ed-gallery-heading h1{font-size:30px}.ed .ed-gallery-heading{margin:20px 0 28px}.ed .ed-journal{padding:20px 16px}.ed .ed-journal-entries{grid-template-columns:1fr;gap:24px}.ed .ed-journal h2{font-size:22px}.ed .ed-review{grid-template-columns:1fr}.ed .ed-share-choice{padding:12px 16px}.ed .ed-print-sheet{padding:20px}.ed .ed-print-sheet h1{font-size:24px}}
@media(prefers-reduced-motion:reduce){.ed *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}@media(forced-colors:active){.ed :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid Highlight;box-shadow:none}.ed .ed-photo-picker,.ed .ed-journal{border-color:CanvasText}}
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
    const labels = {private:'自分と主催者だけの記録',pending_review:'主催者の確認待ち',published:'みんなの発見に掲載',withdrawn:'取り下げ済み'};
    const errors = {event_media_intake_closed:'写真の受付は終了しています。保存済みの記録は確認できます。',event_discovery_not_live:'まだ記録の受付が始まっていません。主催者の案内をご確認ください。',event_checkin_closed:'いまは参加の受付をしていません。',checked_in_participant_required:'参加情報を確認できません。同じ端末の参加リンクから開き直してください。',event_guest_cookie_required:'参加情報を保存できませんでした。Cookieを利用できる設定で、このページを開き直してください。',discovery_photo_limit_reached:'写真は３枚までです。残した写真を確認してください。',media_too_large:'写真を12 MB以下にして選び直してください。',media_required_or_too_large:'12 MB以下の写真を選んでください。',unsupported_media_type:'JPEG・PNG・WebPの写真を選んでください。',guardian_gallery_consent_required:'公開する場合は、保護者の同意を確認してください。',private_image_scrubber_unavailable:'いまは写真を安全に保存する準備ができません。時間をおいてお試しください。',private_image_scrub_failed:'この写真を保存できませんでした。別の写真を選ぶか、時間をおいてお試しください。',idempotency_key_conflict:'前の送信と内容が変わっています。保存済みの記録を確認してください。',withdrawal_cleanup_pending:'取り下げを受け付けました。削除の完了を確認しています。',media_withdrawn:'この写真は取り下げられています。'};
    Object.assign(errors,{three_photo_limit:'写真は３枚までです。保存が完了していない記録も、再試行するか取り下げてください。',discovery_claim_photo_limit:'記録を引き継ぐと３枚を超えます。先に残す写真を確認してください。',event_media_intake_not_started:'まだ写真の受付が始まっていません。主催者の案内をご確認ください。',event_checkin_not_started:'まだ参加の受付が始まっていません。主催者の案内をご確認ください。',rights_and_visual_privacy_confirmation_required:'利用する権利と写り込みを確認し、チェックを入れてください。',caption_invalid:'ひと言は280文字以内で入力してください。',spot_label_invalid:'場所のメモは80文字以内で入力してください。',nickname_invalid:'呼び名は32文字以内で入力してください。空欄でも参加できます。',invalid_cursor:'続きの取得情報を確認できません。再読み込みしてください。',image_privacy_metadata_verification_failed:'写真の確認処理を完了できませんでした。掲載せず、主催者用の記録として残っています。',private_media_unavailable:'保存した写真を読み取れませんでした。再読み込みしてから確認してください。'});
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
    function permittedMediaHref(href, privateMedia = false) {
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return null;
      const prefix = base + (privateMedia ? '/guest-media/' : '/discoveries/');
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
    if (kind === 'campaign') {
      query('[data-discovery-code-form]')?.addEventListener('submit', event => {
        event.preventDefault();
        const code = value(event.currentTarget, 'event_code');
        if (!code || code.length > 64 || /[\s/\\?#]/.test(code)) { tell('案内に書かれた参加コードを入力してください。', true); field(event.currentTarget, 'event_code')?.focus(); return; }
        window.location.assign('/community/events/' + encodeURIComponent(code) + '/join');
      });
      return;
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
        try { const data = await jsonRequest(base + '/checkin','POST',{display_name:name,team_id:value(form,'team_id') || null,is_minor:checked(form,'is_minor'),share_location:false,guardian_location_consent:false}); if (typeof data.participant_id !== 'string' || !data.participant_id) throw new Error('参加の結果を確認できませんでした。入力は残っています。'); storagePut(draftKey,null); tell('ノートを開きます。'); window.location.assign('/events/' + encodeURIComponent(sessionId) + '/rally'); }
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
      let loaded = false; let activeCount = 0; let savedCount = 0; let saving = false; let reading = false; let previewUrl = null; let reservations = [];
      const retryReservation = () => pending && reservations.some(receipt => receipt.idempotencyKey === pending.key && receipt.mediaState !== 'saved');
      function updateForm() {
        const retrying = retryReservation();
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
      function resetDraft() { form?.reset(); storagePut(draftKey,null); clearPreview(); if(form)syncGuardian(form,root.dataset.isMinor === 'true'); }
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
        const photo=field(form,'media');restoreDraft(pending?.payload||storageGet(draftKey));
        form.addEventListener('input',()=>storagePut(draftKey,draftPayload()));
        form.addEventListener('change',()=>{syncGuardian(form,root.dataset.isMinor==='true');storagePut(draftKey,draftPayload());});
        photo.addEventListener('change',()=>{clearPreview();const file=photo.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12582912){tell('12 MB以下のJPEG・PNG・WebP写真を選んでください。',true);photo.value='';return;}previewUrl=URL.createObjectURL(file);const img=node('img');img.src=previewUrl;img.alt='選んだ写真。まだ保存していません。';preview.append(img);});
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(saving||!loaded||(activeCount>=3&&!retryReservation()))return;if(!form.reportValidity())return;
          const file=photo.files?.[0];if(!file)return;
          const payload=draftPayload();
          const fingerprint=JSON.stringify([file.name,file.size,file.lastModified,payload.caption,payload.spotLabel,payload.galleryConsent,payload.guardianGalleryConsent]);
          if(pending?.fingerprint&&pending.fingerprint!==fingerprint){tell('前の写真の保存結果を先に確認してください。「再読み込み」で記録を確認し、同じ写真・内容で再試行できます。',true);await load();return;}
          if(!pending)pending={key:randomKey()};pending.fingerprint=fingerprint;pending.payload=payload;storagePut(pendingKey,pending);storagePut(draftKey,payload);
          saving=true;updateForm();tell('写真を保存しています。画面をそのままにしてください。');
          try{
            const data=new FormData();data.set('media',file);data.set('caption',payload.caption);data.set('spot_label',payload.spotLabel);data.set('gallery_consent',payload.galleryConsent?'yes':'no');data.set('guardian_gallery_consent',payload.guardianGalleryConsent?'yes':'no');data.set('private_storage_consent','yes');data.set('creator_rights_attestation','yes');
            const saved=await request(base+'/guest-media',{method:'POST',headers:{'idempotency-key':pending.key},body:data});
            if(!saved.receipt||typeof saved.receipt.receiptId!=='string')throw new Error('保存の結果を確認できませんでした。「再読み込み」で確認してください。');
            const galleryState=saved.receipt.galleryStatus;
            pending=null;storagePut(pendingKey,null);resetDraft();const verified=await load();
            if(verified)tell(galleryState==='published'?'写真を保存し、みんなの発見に掲載しました。':galleryState==='pending_review'?'写真を保存しました。みんなの発見への掲載は、主催者の確認待ちです。':'写真を保存しました。自分と主催者だけが確認できます。');
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
    if (kind === 'gallery') {
      const list=query('[data-discovery-journals]');const more=query('[data-discovery-more]');const refresh=query('[data-discovery-refresh]');const counts=query('[data-discovery-counts]');let nextCursor=null;let busy=false;let known=new Set();
      function journalCard(journal){const card=node('article',null,'ed-journal');card.dataset.journalId=String(journal.journalId);card.append(node('h2',journal.displayName?String(journal.displayName)+'のとっておき':'ある参加者のとっておき'));const entries=node('div',null,'ed-journal-entries');journal.entries.slice(0,3).forEach((entry,index)=>{const item=node('figure',null,'ed-entry');if(entry.kind==='paper'){const paper=node('div',null,'ed-paper-note-view');paper.append(node('p','紙で残した発見','ed-kicker'));if(entry.spotLabel)paper.append(node('h3',entry.spotLabel));if(entry.caption)paper.append(node('p',entry.caption));item.append(paper);}else{const href=permittedMediaHref(entry.contentHref);if(href){const image=node('img');image.src=href;image.alt=entry.spotLabel?String(entry.spotLabel):'とっておきの写真 '+(index+1);image.loading='lazy';item.append(image);}else item.append(node('p','この写真は現在表示できません。','ed-help'));if(entry.spotLabel)item.append(node('h3',entry.spotLabel));if(entry.caption)item.append(node('p',entry.caption));}if(entry.selectionLabel||entry.selectionComment){const selected=node('div',null,'ed-selection');selected.append(node('strong',entry.selectionLabel||'主催者からのひと言'));if(entry.selectionComment)selected.append(node('p',entry.selectionComment));item.append(selected);}entries.append(item);});card.append(entries);return card;}
      async function load(append=false){if(busy)return;busy=true;refresh.disabled=true;more.disabled=true;tell('');try{const data=await request(base+'/discoveries?limit=24'+(append&&nextCursor?'&cursor='+encodeURIComponent(nextCursor):''));if(!Array.isArray(data.journals)||!data.counts||!Number.isInteger(data.counts.journals)||!Number.isInteger(data.counts.entries))throw new Error('ノートの一覧を読み取れませんでした。');for(const journal of data.journals){if(!journal||typeof journal.journalId!=='string'||!Array.isArray(journal.entries)||journal.entries.length>3)throw new Error('ノートの内容を読み取れませんでした。');}
        if(!append){list.replaceChildren();known=new Set();}data.journals.forEach(journal=>{if(known.has(journal.journalId))return;known.add(journal.journalId);list.append(journalCard(journal));});nextCursor=typeof data.nextCursor==='string'&&data.nextCursor?data.nextCursor:null;more.hidden=!nextCursor;counts.textContent=data.counts.journals+'冊の発見ノート · 写真とメモ '+data.counts.entries+'件';if(!known.size){const empty=node('div',null,'ed-empty');empty.append(node('h2','最初の、とっておき。'),node('p','公開された発見が届くと、ここに一人ひとりのノートが並びます。'));list.append(empty);}else tell(append?'続きを読み込みました。':'新しい発見を読み込みました。');}
        catch(error){tell(error.message||'みんなの発見を読み込めませんでした。',true);if(!known.size)counts.textContent='掲載数を確認できません。';}finally{busy=false;refresh.disabled=false;more.disabled=false;}}
      refresh.addEventListener('click',()=>void load(false));more.addEventListener('click',()=>void load(true));void load(false);return;
    }
    /* ORGANIZER */
    if(kind==='organizer'){
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
      refresh.addEventListener('click',()=>void load(false));more.addEventListener('click',()=>void load(true));
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
