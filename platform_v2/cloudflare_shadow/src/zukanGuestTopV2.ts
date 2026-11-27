export const GUEST_TOP_V2_FLAG = "GUEST_TOP_V2_PROTOTYPE_ENABLED";

export type GuestTopV2Place = { name: string; href: string; photoUrl: string | null; recordCount?: number | null };

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const IMG = "/assets/img/landing/zukan-guest-v2-";
const LOCKUP = "/assets/brand/zukan-lockup.svg";

const screenFrame = (src: string, w: number, h: number, alt: string, first: boolean): string =>
  `<div class="zg2-screen"><div class="zg2-bar" aria-hidden="true"><span></span><span></span><span></span><i>zukan.earth</i></div><img src="${IMG}${src}.webp" width="${w}" height="${h}" alt="${esc(alt)}" decoding="async"${first ? ' fetchpriority="high"' : ' loading="lazy"'}></div>`;

export type GuestTopV2Lang = "ja" | "en";

const placeRow = (pl: GuestTopV2Place, en: boolean): string =>
  `<li><a class="zk-place-row" href="${esc(pl.href)}">${pl.photoUrl ? `<img src="${esc(pl.photoUrl)}" alt="" loading="lazy" width="76" height="76">` : `<span class="zk-place-ph" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#143F2E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>`}<span class="zk-place-text"><strong>${esc(pl.name)}</strong>${typeof pl.recordCount === "number" && pl.recordCount > 0 ? `<span>${en ? `${pl.recordCount} ${pl.recordCount === 1 ? "record" : "records"}` : `記録 ${pl.recordCount}件`}</span>` : ""}</span><span class="zk-chev" aria-hidden="true">›</span></a></li>`;

const devFrame = (en: boolean, barLabel: string, body: string, photo?: string): string =>
  `<div class="zg2-dev"><span class="zg2-dev-badge">${en ? "In development" : "開発中"}</span><div class="zg2-mock"><div class="zg2-mock-bar"><img src="${LOCKUP}" alt="ZUKAN" width="63" height="14" loading="lazy"><span>${esc(barLabel)}</span></div><div class="zg2-mock-body">${photo ? `<img class="zg2-mock-photo" src="${IMG}${photo}.webp" width="640" height="240" alt="" loading="lazy"><span class="zg2-photo-note">${en ? "Photo is an illustration" : "写真はイメージです"}</span>` : ""}${body}</div></div></div>`;

const row = (k: string, v: string): string => `<div class="zg2-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;

const example = (open: boolean, title: string, text: string, frame: string): string =>
  `<details class="zg2-ex"${open ? " open" : ""}><summary><h3>${esc(title)}</h3></summary><div class="zg2-ex-body"><p>${esc(text)}</p>${frame}</div></details>`;

export function renderGuestTopV2Main(options: { prefix: string; places: GuestTopV2Place[]; lang?: GuestTopV2Lang }): string {
  const { prefix } = options;
  const en = options.lang === "en";
  const t = (ja: string, e: string): string => (en ? e : ja);
  const feedbackHref = `${prefix}/otayori?from=${encodeURIComponent(`${prefix}/`)}`;
  const places = options.places.slice(0, 2);
  const placeList = places.length > 0 ? `<ul class="zk-place-list zg2-places">${places.map((pl) => placeRow(pl, en)).join("")}</ul>` : "";
  return `
    <div class="zg2" data-zk-guest-top="v2">
      <section class="zg2-band zg2-hero" aria-labelledby="zg2-h1">
        <div class="zg2-hero-copy">
          <h1 id="zg2-h1">${en ? "<span>Snap a photo,</span> <span>and your town</span> <span>becomes a guide.</span>" : "<span>撮ると、</span><span>まちの今が</span><span>図鑑になる。</span>"}</h1>
          <p class="zg2-lead">${t("ZUKANは、撮った写真が場所と日付でたまって、その場所の図鑑になっていくサービスです。", "ZUKAN collects the photos you take by place and date, and turns each place into its own nature guide.")}</p>
          <div class="zg2-cta">
            <a class="zk-btn-primary" href="${prefix}/register">${t("順番待ちに登録する", "Join the waitlist")}</a>
            <a class="zk-btn-secondary" href="${prefix}/login">${t("ログイン", "Log in")}</a>
          </div>
          <p class="zg2-note">${t("ZUKANは作っている途中のサービスで、いまは招待された方から少しずつ案内しています。", "ZUKAN is still being built, and for now we are opening it gradually to people who have been invited.")}</p>
        </div>
        ${screenFrame("record", 750, 700, t("ZUKANの記録の画面。広葉樹の葉の記録、2026年5月25日、写真3枚", "The ZUKAN record screen. A record of broadleaf leaves, May 25, 2026, with 3 photos"), true)}
      </section>

      <section class="zg2-sec" aria-labelledby="zg2-now">
        <span class="zg2-tag">${t("いま動いているもの", "Working now")}</span>
        <h2 id="zg2-now">${t("今できること", "What you can do today")}</h2>
        <p class="zg2-sub">${t("下の画面は、実際に動いている本番の画面です。", "The screens below are the live, working product.")}</p>
        <div class="zg2-now-grid">
          <div class="zg2-now-item">
            ${screenFrame("place", 718, 560, t("場所の図鑑の画面。常盤公園の記録がたまっています", "A place guide screen. Records are building up for Tokiwa Park"), false)}
            <h3>${t("場所の図鑑", "Place guides")}</h3>
            <p>${t("公開されている場所では、その場所の記録が図鑑のようにたまっていきます。", "In places that are made public, records for that place build up like a guide.")}</p>
            ${placeList}
          </div>
          <div class="zg2-now-item">
            ${screenFrame("map", 750, 560, t("地図の画面。場所を探せます", "The map screen. You can look for places"), false)}
            <h3>${t("地図で場所を探す", "Find places on the map")}</h3>
            <p>${t("地図から、公開されている場所を探せます。", "You can find public places from the map.")}<a class="zg2-link" href="${prefix}/map">${t("地図を開く", "Open the map")}</a></p>
          </div>
        </div>
        <p class="zg2-foot">${t("写真は最初、自分だけに見えます。公開する場所は自分で選べます。", "Photos are visible only to you at first. You choose which places to make public.")}</p>
      </section>

      <section class="zg2-band zg2-future" aria-labelledby="zg2-future">
        <span class="zg2-tag zg2-tag-dev">${t("これから作るもの", "Coming next")}</span>
        <h2 id="zg2-future">${t("NOCOSILとつなぐと", "Connecting with NOCOSIL")}</h2>
        <p class="zg2-sub">${t("仕事の道具「NOCOSIL」とつなぐ使い方を開発しています。点線の枠は、できたらこう見えるという作り画面です（名前・数字は架空）。", "We are building ways to connect ZUKAN with NOCOSIL, our tool for work. The dashed frames are mock-ups of how it could look (names and numbers are made up).")}</p>
        <div class="zg2-ex-list">
          ${example(true, t("記録が、活動の成果として使われたことが分かる", "See when your records are used in a group's results"), t("NOCOSILでまとめた活動の成果にZUKANの記録が使われたら、場所や記録のページに表示できるように開発を進めています。", "We are working on showing it on the place and record pages when ZUKAN records are used in activity results compiled in NOCOSIL."), devFrame(en, t("場所のページ", "Place page"), `<h4>${t("みなと川の土手", "Minato River bank")}</h4><p class="zg2-meta">${t("この場所の記録 42件", "42 records at this place")}</p><div class="zg2-bandline">${t("この場所の記録 12件が、「みなと川をきれいにする会」の活動報告に使われました", "12 records from this place were used in the activity report of the Minato River Cleanup Group")}</div>${row(t("使われた記録", "Records used"), t("秋の記録 12件", "12 autumn records"))}${row(t("まとめた場所", "Compiled in"), t("活動報告", "Activity report"))}`))}
          ${example(false, t("お店や団体のページを、場所とつないで公開する", "Publish a shop or group page linked to a place"), t("NOCOSILで作ったお店や団体のページを、ZUKANの場所のページに載せられるように開発を進めています。", "We are working on letting pages for shops and groups made in NOCOSIL appear on ZUKAN place pages."), devFrame(en, t("場所のページ", "Place page"), `<h4>${t("みなと川の土手", "Minato River bank")}</h4><p class="zg2-meta">${t("この場所の記録 42件", "42 records at this place")}</p><div class="zg2-bandline">${t("この場所のお店：ベーカリー そらいろ", "Shop at this place: Sorairo Bakery")}</div>${row(t("営業時間", "Hours"), t("9:00〜18:00", "9:00 AM-6:00 PM"))}${row(t("パンの予約", "Bread orders"), t("お店のページを見る", "View the shop page"))}`, "pond"))}
          ${example(false, t("イベントや観察会を公開して、参加を受ける", "Publish events and nature walks and take sign-ups"), t("NOCOSILで企画したイベントや観察会を、ZUKANで公開して参加を受けられるように開発を進めています。", "We are working on letting events and nature walks planned in NOCOSIL be published on ZUKAN, with sign-ups."), devFrame(en, t("イベント", "Event"), `<h4>${t("冬の水辺観察会", "Winter Waterside Walk")}</h4><p class="zg2-meta">${t("12月14日（月）9:00〜11:00・みなと川の土手", "Mon, Dec 14, 9:00-11:00 AM · Minato River bank")}</p><div class="zg2-chips"><span class="zg2-chip zg2-chip-fill">${t("参加する", "Join")}</span><span class="zg2-chip">${t("あと6名", "6 spots left")}</span></div><div class="zg2-bandline">${t("申し込みと当日の段取りを見る", "See sign-up and plans for the day")}</div>`, "heron"))}
          ${example(false, t("学校や団体からの案内の依頼を受ける", "Receive guide requests from schools and groups"), t("学校や団体からの「自然案内をお願いしたい」という依頼をZUKANで受けられるように開発を進めています。", "We are working on letting you receive requests on ZUKAN from schools and groups asking for a nature guide."), devFrame(en, t("案内の依頼", "Guide request"), `<h4>${t("自然案内の依頼が届いています", "A nature guide request has arrived")}</h4><p class="zg2-meta">${t("みなと小学校・3年生の校外学習", "Minato Elementary School · Grade 3 field trip")}</p>${row(t("日にち", "Date"), t("1月20日（水）午前", "Wed, Jan 20, morning"))}${row(t("場所", "Place"), t("みなと川の土手", "Minato River bank"))}<div class="zg2-chips"><span class="zg2-chip zg2-chip-fill">${t("受ける", "Accept")}</span><span class="zg2-chip">${t("段取りを見る", "See the plan")}</span></div>`))}
        </div>
      </section>

      <section class="zg2-sec" aria-labelledby="zg2-join">
        <span class="zg2-tag">${t("いっしょに作る", "Build it together")}</span>
        <h2 id="zg2-join">${t("いっしょに作りませんか", "Help us build it")}</h2>
        <p class="zg2-sub">${t("ZUKANは、使う人といっしょに作っています。", "We are building ZUKAN together with the people who use it.")}</p>
        <div class="zg2-join-grid">
          <div class="zg2-card">
            <h3>${t("使ってみたい方へ", "Want to try it?")}</h3>
            <p>${t("いまは招待制です。登録しておくと、案内できるようになったときに連絡します。写真は自分だけに見える状態から始まります。", "It is invite-only for now. Join the waitlist and we will contact you when we can open a spot. Your photos start out visible only to you.")}</p>
            <a class="zg2-btn" href="${prefix}/register">${t("順番待ちに登録する", "Join the waitlist")}</a>
          </div>
          <div class="zg2-card">
            <h3>${t("声を届ける", "Send feedback")}</h3>
            <p>${t("使ってみて気づいたことを送れます。届いた声は、作る順番を決める材料になります。", "Tell us what you notice while using it. What we hear helps decide what we build first.")}</p>
            <a class="zg2-btn" href="${esc(feedbackHref)}">${t("声を届ける", "Send feedback")}</a>
          </div>
          <div class="zg2-card">
            <h3>${t("お店・団体・学校の方へ", "For shops, groups and schools")}</h3>
            <p>${t("NOCOSILとの連携を最初に試す仲間を探しています。使ってみたい場面を教えてください。", "We are looking for partners to be first to try the NOCOSIL connection. Tell us how you would like to use it.")}</p>
            <a class="zg2-btn" href="${esc(feedbackHref)}">${t("相談する", "Get in touch")}</a>
          </div>
        </div>
      </section>

      <footer class="zg2-foot-bar">
        <p>${t("NOCOSILとの連携は開発中です。", "The NOCOSIL connection is in development.")}</p>
        <p>© ${t("IKIMON株式会社", "IKIMON Inc.")}</p>
      </footer>
    </div>
  `;
}

export const GUEST_TOP_V2_CSS = `
    .zg2{--dev:#8a4b00;--dev-bg:#fff6e0;--dev-line:#d9a62e;display:grid;gap:0}
    .zg2 a{-webkit-tap-highlight-color:transparent}
    .zg2 h1,.zg2 h2,.zg2 h3,.zg2 h4,.zg2 p{margin:0}
    .zg2-band{background:var(--surface);margin:0 -20px;padding:24px 20px}
    .zg2-sec{padding:24px 0}
    .zg2-hero{display:grid;gap:18px;padding-top:20px}
    .zg2-hero-copy{display:grid;gap:12px;align-content:center}
    .zg2 .zg2-hero h1{font-size:30px;line-height:1.4;font-weight:800;letter-spacing:.01em}.zg2 .zg2-hero h1 span{display:inline-block}
    .zg2-lead{font-size:16px;line-height:1.7}
    .zg2-cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
    .zg2-cta>a{flex:1 1 auto;min-width:120px;padding:0 14px;white-space:nowrap}
    .zg2-note{font-size:14px;color:var(--muted)}
    .zg2-screen{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(20,63,46,.1)}
    .zg2-bar{display:flex;align-items:center;gap:6px;padding:7px 12px;border-bottom:1px solid var(--line);background:#fff}
    .zg2-bar span{width:9px;height:9px;border-radius:50%;background:var(--line)}
    .zg2-bar i{margin-left:8px;font-style:normal;font-size:11px;color:var(--muted);background:var(--surface);border-radius:6px;padding:2px 10px}
    .zg2-screen img{display:block;width:100%;height:auto}
    .zg2-bar{display:none}
    .zg2-now-item .zg2-screen img{aspect-ratio:16/9;object-fit:cover;object-position:center 72%}
    .zg2-now-item:first-child .zg2-screen img{object-position:center bottom}
    .zg2-tag{display:inline-block;font-size:13px;font-weight:700;color:var(--green);background:#eaf1ec;border-radius:999px;padding:4px 12px}
    .zg2-tag-dev{color:var(--dev);background:var(--dev-bg)}
    .zg2 h2{font-size:24px;line-height:1.4;font-weight:800;margin-top:10px}
    .zg2-sub{margin-top:8px;font-size:15px;color:var(--muted)}
    .zg2-now-grid{display:grid;gap:26px;margin-top:22px}
    .zg2-now-item{display:grid;gap:6px;align-content:start}
    .zg2-now-item .zg2-screen{margin-bottom:8px}
    .zg2 h3{font-size:18px;line-height:1.5;font-weight:800}
    .zg2-now-item p{font-size:15px}
    .zg2-places{margin-top:4px}
    .zg2-places .zk-place-row{padding:8px 0;min-height:60px;grid-template-columns:56px minmax(0,1fr) auto;gap:12px}
    .zg2-places .zk-place-row img,.zg2-places .zk-place-ph{width:56px;height:56px;border-radius:12px}
    .zg2-places .zk-place-text strong{font-size:17px}
    .zg2-link,.zg2-link:visited{margin-left:6px;color:var(--link);font-weight:700;text-decoration:underline;white-space:nowrap}
    .zg2-foot{margin-top:18px;font-size:14px;color:var(--muted)}
    .zg2-ex-list{display:grid;gap:10px;margin-top:20px}
    .zg2-ex{background:#fff;border:1px solid var(--line);border-radius:14px}
    .zg2-ex summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:10px 16px}
    .zg2-ex summary::-webkit-details-marker{display:none}
    .zg2-ex summary::after{content:"";flex:none;width:10px;height:10px;border-right:2px solid var(--green);border-bottom:2px solid var(--green);transform:rotate(45deg);margin-top:-4px;transition:transform .15s}
    .zg2-ex[open] summary::after{transform:rotate(-135deg);margin-top:4px}
    .zg2-ex summary h3{font-size:15px;line-height:1.45}
    .zg2-ex summary:focus-visible{outline:3px solid var(--link);outline-offset:2px;border-radius:14px}
    .zg2-ex-body{display:grid;gap:18px;padding:0 16px 18px;align-items:start}
    .zg2-ex-body>p{font-size:15px}
    .zg2-dev{position:relative;border:2px dashed var(--dev-line);border-radius:14px;background:#fff;padding:12px 10px 10px;margin-top:6px}
    .zg2-dev-badge{position:absolute;top:-13px;left:14px;background:var(--dev-line);color:#3d2600;font-size:12px;font-weight:800;border-radius:999px;padding:3px 12px}
    .zg2-photo-note{display:block;margin:-6px 0 8px;font-size:11px;color:var(--sub,#5b6660);text-align:right}
    .zg2-mock{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}
    .zg2-mock-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
    .zg2-mock-bar img{height:14px;width:auto}
    .zg2-mock-bar span{margin-left:auto;font-size:12px;color:var(--muted)}
    .zg2-mock-body{padding:12px;display:grid;gap:4px}
    .zg2-mock-photo{width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:6px}
    .zg2 h4{font-size:16px;font-weight:800;margin-top:2px}
    .zg2-meta{font-size:13px;color:var(--muted)}
    .zg2-bandline{margin-top:8px;background:#eaf1ec;border-radius:8px;padding:9px 12px;font-size:13px;font-weight:700;color:var(--green)}
    .zg2-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
    .zg2-row:last-of-type{border-bottom:0}
    .zg2-row span:last-child{color:var(--muted);font-size:13px;text-align:right}
    .zg2-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .zg2-chip{font-size:12px;font-weight:700;border:1.5px solid var(--green);color:var(--green);border-radius:999px;padding:3px 12px}
    .zg2-chip-fill{background:var(--green);color:#fff}
    .zg2-join-grid{display:grid;gap:12px;margin-top:18px}
    .zg2-card{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:#fff;display:grid;gap:4px;align-content:start}
    .zg2-card h3{font-size:17px}
    .zg2-card p{font-size:14px;color:var(--muted);margin-bottom:6px}
    .zg2-btn,.zg2-btn:visited{min-height:44px;display:inline-flex;align-items:center;justify-content:center;justify-self:start;padding:0 22px;border-radius:999px;border:2px solid var(--green);background:#fff;color:var(--green);font-size:15px;font-weight:700;text-decoration:none}
    .zg2-foot-bar{border-top:1px solid var(--line);padding:18px 0 4px;display:grid;gap:2px}
    .zg2-foot-bar p{font-size:13px;color:var(--muted)}
    @media(min-width:720px){
      .zg2-bar{display:flex}
      .zg2-now-item .zg2-screen img{aspect-ratio:auto}
      .zg2-band{margin:0;border-radius:24px;padding:40px 36px}
      .zg2-hero{grid-template-columns:1fr 1.1fr;gap:36px;align-items:center;padding-top:40px}
      .zg2 .zg2-hero h1{font-size:38px}
      .zg2-cta>a{flex:0 1 auto;min-width:170px}
      .zg2-sec{padding:48px 0}
      .zg2 h2{font-size:28px}
      .zg2-now-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}
      .zg2-ex-body{grid-template-columns:1fr 1.2fr;gap:28px}
      .zg2-join-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    }
    @media(min-width:1024px){
      .zg2 .zg2-hero h1{font-size:44px}
      .zg2 h2{font-size:30px}
    }
`;
