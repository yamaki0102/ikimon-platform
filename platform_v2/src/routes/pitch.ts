import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type PitchSlide = {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  punch: string;
  image?: string;
  mode: "cover" | "dark" | "light" | "split";
  bullets: string[];
  talk: string;
  proof?: Array<{ label: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
};

const ASSET_ROOT = "/assets/img/pitch";

const PITCH_SLIDES: PitchSlide[] = [
  {
    id: "cover",
    kicker: "IKIMON / Shizuoka pitch",
    title: "地域の観察を、未来の判断材料へ。",
    lead: "ikimon.life は、市民・行政・研究・企業の生きもの記録を、楽しさを壊さず、あとから使える自然モニタリングへ育てる基盤です。",
    punch: "Enjoy Life から、Monitoring OS へ。",
    image: `${ASSET_ROOT}/ikimon-pitch-riverside-hero.webp`,
    mode: "cover",
    bullets: ["スマホだけで話せる", "PCならデモへ飛べる", "スクリーンなら1枚ずつ投影できる"],
    talk: "明日の最初の一言はこれでよい。『自然を守る』ではなく、『見続ける仕組みを作る』。行政・研究者には、この言い方のほうが正確に届く。",
  },
  {
    id: "award-spine",
    kicker: "Award spine",
    title: "アワード資料の核は、そのまま明日の紹介に使える。",
    lead: "JR東日本SUP、ICC、JST、ハマハブ向けに整理した論点は、相手が違っても同じ構造です。地域の自然は重要になっている。でも、誰が見て、どう社会で使うかが分断されています。",
    punch: "課題は、記録不足ではなく接続不足。",
    image: `${ASSET_ROOT}/ikimon-pitch-evidence-grid.webp`,
    mode: "dark",
    bullets: [
      "市民や現地パートナーの観察が、企業・自治体・教育側の説明に届きにくい",
      "AI候補を確定扱いすると、誤同定や過大主張が起きる",
      "単発イベントで終わると、次に見るべき場所や根拠が残らない",
    ],
    proof: [
      { label: "JR SUP", value: "地域共創・実証" },
      { label: "ICC", value: "7分ピッチ骨格" },
      { label: "JST", value: "STI / SDGs接続" },
      { label: "ハマハブ", value: "行政課題適合" },
    ],
    talk: "ここで『応募資料を流用している』ではなく、『複数の公募に耐える共通仮説ができた』と捉える。明日の相手には、行政課題と研究品質の両方に刺さる。",
  },
  {
    id: "one-sentence",
    kicker: "One sentence",
    title: "地域の人や現地パートナーの観察を、報告可能な観察パッケージへ育てる。",
    lead: "写真、日時、位置、努力量、メモを入口に、AI候補、根拠付き同定、レビュー、品質区分、レポート下書きへつなげます。",
    punch: "入口は軽く、出口は慎重に。",
    mode: "light",
    bullets: [
      "名前が分からなくても記録を残せる",
      "AIは確定者ではなく、候補と次に見る点を返す補助役",
      "report-ready / reviewable / supporting / insufficient を分ける",
    ],
    proof: [
      { label: "入力", value: "写真・位置・時刻" },
      { label: "確認", value: "根拠・レビュー" },
      { label: "出力", value: "言える範囲" },
    ],
    talk: "応募資料の15秒コピーを、明日の会話用に少し柔らかくした版。短く聞かれたらこのスライドだけで答えられる。",
  },
  {
    id: "monitoring-os",
    kicker: "Product direction",
    title: "次の商用形は、契約地域を継続運用する IKIMON Monitoring。",
    lead: "単発レポートではなく、対象エリアの記録、レビュー、地図、出力準備を継続的に回す作業空間です。",
    punch: "1契約ワークスペースで、記録から出力まで完走する。",
    image: `${ASSET_ROOT}/ikimon-pitch-monitoring-workspace.webp`,
    mode: "split",
    bullets: [
      "契約エリア内の記録を動的に集める",
      "同定待ち、根拠不足、空白エリア、粗化確認をキュー化する",
      "PDF/CSV出力時に条件、件数、粗化ルール、audit_log_id を残す",
    ],
    proof: [
      { label: "通常価格", value: "100万円" },
      { label: "地域育成", value: "50万円" },
      { label: "主役", value: "運用者/パートナー" },
    ],
    talk: "プロダクトの話はここまでで十分。細かい機能紹介に入りすぎず、『継続運用OS』という言葉を残す。",
  },
  {
    id: "trust-boundary",
    kicker: "Claim boundary",
    title: "信頼性は、断定ではなく状態を分けることで作る。",
    lead: "生物多様性改善、自然共生サイト認定、TNFD対応、AI同定の正しさは保証しません。言えることと言えないことを分けるから、行政・研究・企業に接続できます。",
    punch: "確認済みと候補を混ぜない。",
    mode: "light",
    bullets: [
      "AIだけで確定扱いしない",
      "未検出ではなく、現時点では確認されていないと言う",
      "努力量・証拠・根拠・確認状態・公開範囲を一緒に見る",
    ],
    proof: [
      { label: "Say", value: "継続的に見直す補助基盤" },
      { label: "Do not say", value: "公式判断の代替" },
      { label: "Absolute", value: "過大主張しない" },
    ],
    talk: "ここは国立環境研究所の人がいるなら一番重要。『夢を語る』より『言いすぎない設計』が信用になる。",
  },
  {
    id: "shizuoka-pilot",
    kicker: "Shizuoka pilot",
    title: "静岡では、1地域・1テーマ・1出力の実地パイロットに落とせる。",
    lead: "外来種、学校・地域観察、自然共生サイト、企業緑地。テーマは広げられるが、最初は小さく切るほうが強い。",
    punch: "90日で、見える成果と次の観察計画を作る。",
    image: `${ASSET_ROOT}/ikimon-pitch-shizuoka-pilot.webp`,
    mode: "dark",
    bullets: [
      "行政: 相談・確認・既存手続きへつなぐ導線",
      "研究: データ品質、同定、努力量のレビュー観点",
      "地域: 楽しく続く観察会と、次に見る候補の提示",
    ],
    proof: [
      { label: "外来種", value: "報告・確認" },
      { label: "自然共生", value: "継続記録" },
      { label: "教育", value: "探究・観察" },
    ],
    talk: "明日の場では、静岡市の環境政策課に『行政判断を代替しない』と明確に言う。お願いは、実証テーマとデータ品質項目を一緒に詰めたい、でよい。",
  },
  {
    id: "ask",
    kicker: "Ask",
    title: "明日のゴールは、採用の即答ではなく、次の確認事項を決めること。",
    lead: "相手に求めるのは、評価ではなく共同設計の入口です。現場、行政、研究の観点から、実証に必要な境界線を持ち帰ります。",
    punch: "良い紹介は、次の1歩が具体化すること。",
    mode: "light",
    bullets: [
      "どこまでを行政・研究向けに言ってよいか",
      "最初の実地パイロットに向く場所・テーマは何か",
      "データ品質レビューに必要な最低項目は何か",
    ],
    links: [
      { label: "地図", href: "/map" },
      { label: "信頼性", href: "/learn/methodology" },
      { label: "企業・地域", href: "/for-business" },
      { label: "活用例", href: "/cases" },
    ],
    talk: "最後はこの3問。話が盛り上がっても、次に確認する相手・場所・項目を1つでも決める。",
  },
];

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function currentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(getForwardedBasePath(request.headers), requestUrl(request));
}

function renderProofItems(slide: PitchSlide): string {
  if (!slide.proof?.length) return "";
  return `<div class="pitch-proof-grid">${slide.proof.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}</div>`;
}

function renderSlideLinks(basePath: string, lang: SiteLang, slide: PitchSlide): string {
  if (!slide.links?.length) return "";
  return `<div class="pitch-link-row">${slide.links.map((link) => `<a href="${escapeHtml(appendLangToHref(withBasePath(basePath, link.href), lang))}">${escapeHtml(link.label)}</a>`).join("")}</div>`;
}

function renderSlide(basePath: string, lang: SiteLang, slide: PitchSlide, index: number): string {
  const style = slide.image ? ` style="--pitch-image:url('${escapeHtml(slide.image)}')"` : "";
  const bullets = slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
  return `<section class="pitch-slide is-${escapeHtml(slide.mode)}" id="${escapeHtml(slide.id)}" data-pitch-slide data-slide-index="${index}"${style}>
    ${slide.image ? `<div class="pitch-image" aria-hidden="true"></div>` : ""}
    <div class="pitch-content">
      <p class="pitch-kicker">${escapeHtml(slide.kicker)} <span>${index + 1}/${PITCH_SLIDES.length}</span></p>
      <h2>${escapeHtml(slide.title)}</h2>
      <p class="pitch-lead">${escapeHtml(slide.lead)}</p>
      <div class="pitch-punch">${escapeHtml(slide.punch)}</div>
      <ul class="pitch-bullets">${bullets}</ul>
      ${renderProofItems(slide)}
      ${renderSlideLinks(basePath, lang, slide)}
      <details class="pitch-talk"><summary>話す要点</summary><p>${escapeHtml(slide.talk)}</p></details>
    </div>
  </section>`;
}

function renderPitchBody(basePath: string, lang: SiteLang): string {
  const slides = PITCH_SLIDES.map((slide, index) => renderSlide(basePath, lang, slide, index)).join("");
  return `<div class="pitch-page" data-pitch-deck data-current-slide="0">
    <aside class="pitch-toolbar" aria-label="ピッチ操作">
      <button type="button" data-pitch-prev aria-label="前のスライド">‹</button>
      <span data-pitch-counter>1/${PITCH_SLIDES.length}</span>
      <button type="button" data-pitch-next aria-label="次のスライド">›</button>
      <button type="button" data-pitch-mode>スクリーン</button>
      <button type="button" onclick="window.print()">PDF</button>
    </aside>
    <main class="pitch-slides" id="pitch-slides">${slides}</main>
    <section class="pitch-backup">
      <p class="pitch-kicker">Fallback script</p>
      <h2>通信や投影が崩れたら、この30秒だけ話す。</h2>
      <ol>
        <li>ikimon.life は、地域の観察を報告可能な自然モニタリングへ育てる基盤です。</li>
        <li>AIは確定ではなく候補。努力量、根拠、確認状態、言える範囲を分けます。</li>
        <li>静岡では、1地域・1テーマ・1出力の実地パイロットから始めたいです。</li>
      </ol>
    </section>
  </div>
  <script>
    (function(){
      var root = document.querySelector('[data-pitch-deck]');
      if (!root) return;
      var slides = Array.prototype.slice.call(root.querySelectorAll('[data-pitch-slide]'));
      var counter = root.querySelector('[data-pitch-counter]');
      var index = 0;
      function show(next) {
        index = Math.max(0, Math.min(slides.length - 1, next));
        root.dataset.currentSlide = String(index);
        slides.forEach(function(slide, i){ slide.classList.toggle('is-active', i === index); });
        if (counter) counter.textContent = (index + 1) + '/' + slides.length;
        if (root.classList.contains('is-screen')) slides[index].scrollIntoView({ block: 'start' });
      }
      root.querySelector('[data-pitch-prev]')?.addEventListener('click', function(){ show(index - 1); });
      root.querySelector('[data-pitch-next]')?.addEventListener('click', function(){ show(index + 1); });
      root.querySelector('[data-pitch-mode]')?.addEventListener('click', function(event){
        root.classList.toggle('is-screen');
        event.currentTarget.textContent = root.classList.contains('is-screen') ? '一覧' : 'スクリーン';
        show(index);
      });
      document.addEventListener('keydown', function(event){
        if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); show(index + 1); }
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(index - 1); }
        if (event.key === 'Escape') root.classList.remove('is-screen');
      });
      show(0);
    })();
  </script>`;
}

const PITCH_STYLES = `
  body:has(.shell.is-pitch-mode) { background: #080d0b; }
  body:has(.shell.is-pitch-mode) .site-header,
  body:has(.shell.is-pitch-mode) .desktop-side-nav,
  body:has(.shell.is-pitch-mode) .site-mobile-menu-panel,
  body:has(.shell.is-pitch-mode) .global-record-launcher,
  body:has(.shell.is-pitch-mode) .global-record-camera-close,
  body:has(.shell.is-pitch-mode) .global-record-camera-actions,
  body:has(.shell.is-pitch-mode) [data-global-record-launcher] { display: none !important; }
  .shell.is-pitch-mode { width: 100%; max-width: none; margin: 0; padding: 0; }
  .pitch-page { --ink:#f8f5ec; --paper:#f7f2e8; --green:#58c28b; --blue:#71b7e8; --gold:#f3c45b; --dark:#08110d; color: var(--ink); background: radial-gradient(circle at 20% 0%, rgba(88,194,139,.22), transparent 32%), #080d0b; padding: 16px clamp(10px,2.6vw,34px) 54px; }
  .pitch-toolbar { position: sticky; top: 12px; z-index: 50; max-width: 1240px; margin: 0 auto 12px; display: flex; justify-content: flex-end; align-items: center; gap: 8px; pointer-events: none; }
  .pitch-toolbar button, .pitch-toolbar span { pointer-events: auto; min-height: 42px; border: 1px solid rgba(255,255,255,.18); background: rgba(8,13,11,.82); color: #fff; border-radius: 8px; padding: 8px 12px; font-weight: 950; backdrop-filter: blur(14px); box-shadow: 0 12px 28px rgba(0,0,0,.22); }
  .pitch-toolbar button { cursor: pointer; }
  .pitch-slides { max-width: 1240px; margin: 0 auto; display: grid; gap: 18px; }
  .pitch-slide { position: relative; overflow: hidden; min-height: min(82svh, 760px); border: 1px solid rgba(255,255,255,.12); background: #101814; box-shadow: 0 26px 80px rgba(0,0,0,.34); }
  .pitch-image { position: absolute; inset: 0; background-image: linear-gradient(90deg, rgba(5,9,7,.88), rgba(5,9,7,.56) 42%, rgba(5,9,7,.12)), var(--pitch-image); background-size: cover; background-position: center; transform: scale(1.01); }
  .pitch-content { position: relative; z-index: 2; width: min(760px, 100%); min-height: inherit; display: grid; align-content: center; gap: 18px; padding: clamp(30px,6vw,82px); }
  .pitch-slide.is-cover .pitch-content { width: min(900px, 100%); }
  .pitch-slide.is-cover .pitch-image { background-image: linear-gradient(90deg, rgba(5,9,7,.86), rgba(5,9,7,.46) 48%, rgba(5,9,7,.04)), var(--pitch-image); background-position: center; }
  .pitch-slide.is-split .pitch-content { margin-left: auto; width: min(680px, 56%); background: linear-gradient(90deg, rgba(8,13,11,.36), rgba(8,13,11,.84)); }
  .pitch-slide.is-light { background: linear-gradient(135deg, #fbf7ed, #e7f1e7); color: #102019; }
  .pitch-slide.is-light .pitch-content { width: 100%; max-width: none; grid-template-columns: minmax(0, 1.08fr) minmax(280px, .92fr); column-gap: clamp(24px, 5vw, 66px); }
  .pitch-slide.is-light .pitch-kicker, .pitch-slide.is-light h2, .pitch-slide.is-light .pitch-lead, .pitch-slide.is-light .pitch-punch { grid-column: 1; }
  .pitch-slide.is-light .pitch-bullets, .pitch-slide.is-light .pitch-proof-grid, .pitch-slide.is-light .pitch-link-row, .pitch-slide.is-light .pitch-talk { grid-column: 2; }
  .pitch-kicker { margin: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--green); font-size: 12px; line-height: 1.2; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
  .pitch-slide.is-light .pitch-kicker { color: #0f7a4f; }
  .pitch-content h2 { margin: 0; max-width: 980px; font-size: clamp(38px, 6.3vw, 82px); line-height: 1.02; letter-spacing: 0; text-wrap: balance; }
  .pitch-slide:not(.is-cover) .pitch-content h2 { font-size: clamp(34px, 5.1vw, 62px); }
  .pitch-lead { margin: 0; max-width: 780px; color: rgba(255,255,255,.82); font-size: clamp(18px,2vw,25px); line-height: 1.62; font-weight: 740; text-wrap: pretty; }
  .pitch-slide.is-light .pitch-lead { color: #4d5b51; }
  .pitch-punch { width: fit-content; max-width: 100%; padding: 13px 17px; border-left: 5px solid var(--gold); background: rgba(255,255,255,.12); color: #fff8dc; font-size: clamp(18px,2vw,25px); line-height: 1.32; font-weight: 950; }
  .pitch-slide.is-light .pitch-punch { background: #102019; color: #fff; border-left-color: #0f7a4f; }
  .pitch-bullets { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
  .pitch-bullets li { padding: 12px 14px; border-left: 4px solid rgba(113,183,232,.86); background: rgba(255,255,255,.1); color: rgba(255,255,255,.9); font-size: 16px; line-height: 1.55; font-weight: 820; }
  .pitch-slide.is-light .pitch-bullets li { background: rgba(255,255,255,.7); color: #1a2c22; border-left-color: #0f7a4f; }
  .pitch-proof-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .pitch-proof-grid div { min-height: 92px; display: grid; align-content: center; gap: 6px; padding: 13px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.12); }
  .pitch-proof-grid span { color: var(--green); font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .pitch-proof-grid strong { font-size: 18px; line-height: 1.25; color: #fff; }
  .pitch-slide.is-light .pitch-proof-grid div { background: #102019; }
  .pitch-link-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .pitch-link-row a { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 8px; background: #102019; color: #fff; text-decoration: none; font-weight: 950; }
  .pitch-talk { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.08); padding: 11px 13px; }
  .pitch-talk summary { cursor: pointer; color: var(--blue); font-weight: 950; }
  .pitch-talk p { margin: 9px 0 0; color: rgba(255,255,255,.76); line-height: 1.65; }
  .pitch-slide.is-light .pitch-talk { background: rgba(16,32,25,.08); border-color: rgba(16,32,25,.15); }
  .pitch-slide.is-light .pitch-talk p { color: #4d5b51; }
  .pitch-backup { max-width: 1240px; margin: 18px auto 0; padding: clamp(24px,4vw,44px); border: 1px solid rgba(255,255,255,.12); background: #101814; }
  .pitch-backup h2 { margin: 10px 0 12px; font-size: clamp(28px,4vw,48px); line-height: 1.14; }
  .pitch-backup ol { margin: 0; padding-left: 24px; color: rgba(255,255,255,.84); font-size: 18px; line-height: 1.75; font-weight: 780; }
  .pitch-page.is-screen { min-height: 100svh; padding-top: 0; }
  .pitch-page.is-screen .pitch-slides { display: block; }
  .pitch-page.is-screen .pitch-slide { display: none; min-height: calc(100svh - 112px); margin-bottom: 0; }
  .pitch-page.is-screen .pitch-slide.is-active { display: block; }
  .pitch-page.is-screen .pitch-talk { display: none; }
  .pitch-page.is-screen .pitch-backup { display: none; }
  @media (max-width: 820px) {
    .pitch-page { padding-inline: 10px; }
    .pitch-toolbar { position: fixed; left: 10px; right: 10px; top: auto; bottom: max(12px, env(safe-area-inset-bottom)); justify-content: center; margin: 0; }
    .pitch-toolbar button, .pitch-toolbar span { min-height: 40px; padding: 8px 9px; font-size: 12px; }
    .pitch-slide { min-height: auto; }
    .pitch-image { background-image: linear-gradient(180deg, rgba(5,9,7,.5), rgba(5,9,7,.92) 48%, rgba(5,9,7,.98)), var(--pitch-image); }
    .pitch-content { min-height: 74svh; padding: 24px; gap: 14px; }
    .pitch-content h2, .pitch-slide:not(.is-cover) .pitch-content h2 { font-size: 34px; line-height: 1.08; }
    .pitch-lead { font-size: 17px; }
    .pitch-slide.is-light .pitch-content { display: grid; grid-template-columns: 1fr; }
    .pitch-slide.is-light .pitch-kicker, .pitch-slide.is-light h2, .pitch-slide.is-light .pitch-lead, .pitch-slide.is-light .pitch-punch, .pitch-slide.is-light .pitch-bullets, .pitch-slide.is-light .pitch-proof-grid, .pitch-slide.is-light .pitch-link-row, .pitch-slide.is-light .pitch-talk { grid-column: 1; }
    .pitch-slide.is-split .pitch-content { width: auto; margin-left: 0; background: rgba(8,13,11,.78); }
    .pitch-proof-grid { grid-template-columns: 1fr; }
    .pitch-page.is-screen .pitch-proof-grid { display: none; }
    .pitch-page.is-screen .pitch-slide.is-active { min-height: 100svh; padding-bottom: 72px; }
  }
  @media print {
    .site-header, .desktop-side-nav, .site-footer, .pitch-toolbar { display: none !important; }
    .pitch-page { padding: 0; background: #fff; }
    .pitch-slide, .pitch-backup { min-height: 96vh; break-after: page; box-shadow: none; border: 1px solid #d1d5db; }
    .pitch-talk { display: none; }
  }
`;

export async function registerPitchRoutes(app: FastifyInstance): Promise<void> {
  app.get("/pitch/ikimon", async (request, reply) => {
    const basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: "ikimon.life pitch mode",
      description: "スマホ、PC、スクリーンで使える ikimon.life の紹介Webピッチ。",
      activeNav: "企業・地域",
      lang,
      currentPath: currentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
      canonicalPath: "/pitch/ikimon",
      alternateLangs: ["ja"],
      noindex: true,
      shellClassName: "is-pitch-mode",
      hideFooter: true,
      extraStyles: PITCH_STYLES,
      body: renderPitchBody(basePath, lang),
    });
  });
}
