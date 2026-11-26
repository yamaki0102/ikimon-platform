export const GUEST_TOP_V2_FLAG = "GUEST_TOP_V2_PROTOTYPE_ENABLED";

export type GuestTopV2Place = { name: string; href: string; photoUrl: string | null; recordCount?: number | null };

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const IMG = "/assets/img/landing/zukan-guest-v2-";
const LOCKUP = "/assets/brand/zukan-lockup.svg";

const screenFrame = (src: string, w: number, h: number, alt: string, first: boolean): string =>
  `<div class="zg2-screen"><div class="zg2-bar" aria-hidden="true"><span></span><span></span><span></span><i>zukan.earth</i></div><img src="${IMG}${src}.webp" width="${w}" height="${h}" alt="${esc(alt)}" decoding="async"${first ? ' fetchpriority="high"' : ' loading="lazy"'}></div>`;

const placeRow = (pl: GuestTopV2Place): string =>
  `<li><a class="zk-place-row" href="${esc(pl.href)}">${pl.photoUrl ? `<img src="${esc(pl.photoUrl)}" alt="" loading="lazy" width="76" height="76">` : `<span class="zk-place-ph" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#143F2E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>`}<span class="zk-place-text"><strong>${esc(pl.name)}</strong>${typeof pl.recordCount === "number" && pl.recordCount > 0 ? `<span>記録 ${pl.recordCount}件</span>` : ""}</span><span class="zk-chev" aria-hidden="true">›</span></a></li>`;

const devFrame = (barLabel: string, body: string, photo?: string): string =>
  `<div class="zg2-dev"><span class="zg2-dev-badge">開発中</span><div class="zg2-mock"><div class="zg2-mock-bar"><img src="${LOCKUP}" alt="ZUKAN" width="63" height="14" loading="lazy"><span>${esc(barLabel)}</span></div><div class="zg2-mock-body">${photo ? `<img class="zg2-mock-photo" src="${IMG}${photo}.webp" width="640" height="240" alt="" loading="lazy"><span class="zg2-photo-note">写真はイメージです</span>` : ""}${body}</div></div></div>`;

const row = (k: string, v: string): string => `<div class="zg2-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;

const example = (open: boolean, title: string, text: string, frame: string): string =>
  `<details class="zg2-ex"${open ? " open" : ""}><summary><h3>${esc(title)}</h3></summary><div class="zg2-ex-body"><p>${esc(text)}</p>${frame}</div></details>`;

export function renderGuestTopV2Main(options: { prefix: string; places: GuestTopV2Place[] }): string {
  const { prefix } = options;
  const feedbackHref = `${prefix}/otayori?from=${encodeURIComponent(`${prefix}/`)}`;
  const places = options.places.slice(0, 2);
  const placeList = places.length > 0 ? `<ul class="zk-place-list zg2-places">${places.map(placeRow).join("")}</ul>` : "";
  return `
    <div class="zg2" data-zk-guest-top="v2">
      <section class="zg2-band zg2-hero" aria-labelledby="zg2-h1">
        <div class="zg2-hero-copy">
          <h1 id="zg2-h1"><span>撮ると、</span><span>まちの今が</span><span>図鑑になる。</span></h1>
          <p class="zg2-lead">ズカンは、撮った写真が場所と日付でたまって、その場所の図鑑になっていくサービスです。</p>
          <div class="zg2-cta">
            <a class="zk-btn-primary" href="${prefix}/register">順番待ちに登録する</a>
            <a class="zk-btn-secondary" href="${prefix}/login">ログイン</a>
          </div>
          <p class="zg2-note">ズカンは作っている途中のサービスで、いまは招待された方から少しずつ案内しています。</p>
        </div>
        ${screenFrame("record", 750, 700, "ズカンの記録の画面。イネ科植物の記録、2026年5月25日、写真3枚", true)}
      </section>

      <section class="zg2-sec" aria-labelledby="zg2-now">
        <span class="zg2-tag">いま動いているもの</span>
        <h2 id="zg2-now">今できること</h2>
        <p class="zg2-sub">下の画面は、実際に動いている本番の画面です。</p>
        <div class="zg2-now-grid">
          <div class="zg2-now-item">
            ${screenFrame("place", 718, 560, "場所の図鑑の画面。常盤公園の記録がたまっています", false)}
            <h3>場所の図鑑</h3>
            <p>公開されている場所では、その場所の記録が図鑑のようにたまっていきます。</p>
            ${placeList}
          </div>
          <div class="zg2-now-item">
            ${screenFrame("map", 750, 560, "地図の画面。場所を探せます", false)}
            <h3>地図で場所を探す</h3>
            <p>地図から、公開されている場所を探せます。<a class="zg2-link" href="${prefix}/map">地図を開く</a></p>
          </div>
        </div>
        <p class="zg2-foot">写真は最初、自分だけに見えます。公開する場所は自分で選べます。</p>
      </section>

      <section class="zg2-band zg2-future" aria-labelledby="zg2-future">
        <span class="zg2-tag zg2-tag-dev">これから作るもの</span>
        <h2 id="zg2-future">NOCOSILとつなぐと</h2>
        <p class="zg2-sub">仕事の道具「NOCOSIL」とつなぐ使い方を開発しています。点線の枠は、できたらこう見えるという作り画面です（名前・数字は架空）。</p>
        <div class="zg2-ex-list">
          ${example(true, "記録が、活動の成果として使われたことが分かる", "NOCOSILでまとめた活動の成果にズカンの記録が使われたら、場所や記録のページに表示できるように開発を進めています。", devFrame("場所のページ", `<h4>みなと川の土手</h4><p class="zg2-meta">この場所の記録 42件</p><div class="zg2-bandline">この場所の記録 12件が、「みなと川をきれいにする会」の活動報告に使われました</div>${row("使われた記録", "秋の記録 12件")}${row("まとめた場所", "活動報告")}`))}
          ${example(false, "お店や団体のページを、場所とつないで公開する", "NOCOSILで作ったお店や団体のページを、ズカンの場所のページに載せられるように開発を進めています。", devFrame("場所のページ", `<h4>みなと川の土手</h4><p class="zg2-meta">この場所の記録 42件</p><div class="zg2-bandline">この場所のお店：ベーカリー そらいろ</div>${row("営業時間", "9:00〜18:00")}${row("パンの予約", "お店のページを見る")}`, "pond"))}
          ${example(false, "イベントや観察会を公開して、参加を受ける", "NOCOSILで企画したイベントや観察会を、ズカンで公開して参加を受けられるように開発を進めています。", devFrame("イベント", `<h4>冬の水辺観察会</h4><p class="zg2-meta">12月14日（月）9:00〜11:00・みなと川の土手</p><div class="zg2-chips"><span class="zg2-chip zg2-chip-fill">参加する</span><span class="zg2-chip">あと6名</span></div><div class="zg2-bandline">申し込みと当日の段取りを見る</div>`, "heron"))}
          ${example(false, "学校や団体からの案内の依頼を受ける", "学校や団体からの「自然案内をお願いしたい」という依頼をズカンで受けられるように開発を進めています。", devFrame("案内の依頼", `<h4>自然案内の依頼が届いています</h4><p class="zg2-meta">みなと小学校・3年生の校外学習</p>${row("日にち", "1月20日（水）午前")}${row("場所", "みなと川の土手")}<div class="zg2-chips"><span class="zg2-chip zg2-chip-fill">受ける</span><span class="zg2-chip">段取りを見る</span></div>`))}
        </div>
      </section>

      <section class="zg2-sec" aria-labelledby="zg2-join">
        <span class="zg2-tag">いっしょに作る</span>
        <h2 id="zg2-join">いっしょに作りませんか</h2>
        <p class="zg2-sub">ズカンは、使う人といっしょに作っています。</p>
        <div class="zg2-join-grid">
          <div class="zg2-card">
            <h3>使ってみたい方へ</h3>
            <p>いまは招待制です。登録しておくと、案内できるようになったときに連絡します。写真は自分だけに見える状態から始まります。</p>
            <a class="zg2-btn" href="${prefix}/register">順番待ちに登録する</a>
          </div>
          <div class="zg2-card">
            <h3>声を届ける</h3>
            <p>使ってみて気づいたことを送れます。届いた声は、作る順番を決める材料になります。</p>
            <a class="zg2-btn" href="${esc(feedbackHref)}">声を届ける</a>
          </div>
          <div class="zg2-card">
            <h3>お店・団体・学校の方へ</h3>
            <p>NOCOSILとの連携を最初に試す仲間を探しています。使ってみたい場面を教えてください。</p>
            <a class="zg2-btn" href="${esc(feedbackHref)}">相談する</a>
          </div>
        </div>
      </section>

      <footer class="zg2-foot-bar">
        <p>NOCOSILとの連携は開発中です。</p>
        <p>© IKIMON株式会社</p>
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
    .zg2-cta>a{flex:1;min-width:140px;padding:0 20px}
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
`;
