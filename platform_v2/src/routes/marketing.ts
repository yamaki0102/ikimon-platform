import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function layout(
  basePath: string,
  lang: SiteLang,
  currentPath: string,
  title: string,
  eyebrow: string,
  heading: string,
  lead: string,
  body: string,
  activeNavKey: string,
  afterActionsHtml?: string,
  headingHtml?: string,
): string {
  const activeNav = activeNavLabel(activeNavKey, lang);
  const copy = layoutCopy(lang);
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    lang,
    currentPath,
    hero: {
      eyebrow,
      heading,
      headingHtml: headingHtml ?? escapeHtml(heading),
      lead,
      tone: "light",
      align: "center",
      afterActionsHtml: afterActionsHtml ?? "",
    },
    body,
    footerNote: copy.footerNote,
  });
}

function layoutCopy(lang: SiteLang): { record: string; explore: string; business: string; footerNote: string } {
  switch (lang) {
    case "en":
      return {
        record: "Record",
        explore: "Explore",
        business: "For Business",
        footerNote: "Save what you find nearby and review it later, place by place.",
      };
    case "es":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizaciones",
        footerNote: "Guarda lo que encuentras cerca y revísalo después, lugar por lugar.",
      };
    case "pt-BR":
      return {
        record: "Registrar",
        explore: "Explorar",
        business: "Para organizações",
        footerNote: "Guarde o que encontra por perto e reveja depois, lugar por lugar.",
      };
    default:
      return {
        record: "記録する",
        explore: "みつける",
        business: "法人向け",
        footerNote: "いつもの道で見つけた自然を、あとで見返せる形に残す。",
      };
  }
}

function activeNavLabel(nav: string, lang: SiteLang): string {
  const table: Record<string, Record<SiteLang, string>> = {
    Home: { ja: "ホーム", en: "Home", es: "Inicio", "pt-BR": "Início" },
    Learn: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    "For Business": { ja: "法人向け", en: "For Business", es: "Para organizaciones", "pt-BR": "Para organizações" },
    FAQ: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    Trust: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
    Contact: { ja: "読む", en: "Learn", es: "Aprender", "pt-BR": "Aprender" },
  };
  return table[nav]?.[lang] ?? nav;
}

const FL_CSS = `<style>
  .fl { max-width: 760px; margin: 0 auto; padding: 0 4px; }
  .fl-sec { padding: 56px 0; border-bottom: 1px solid rgba(15,23,42,.08); }
  .fl-sec:last-child { border-bottom: none; }
  .fl-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #16a34a; margin-bottom: 12px; }
  .fl-h2 { font-size: clamp(24px, 3vw, 36px); font-weight: 800; line-height: 1.25; letter-spacing: -.03em; color: #0f172a; margin: 0 0 20px; }
  .fl-lead { font-size: 17px; line-height: 1.85; color: #374151; margin: 0 0 32px; }
  .fl-body { font-size: 15px; line-height: 1.9; color: #4b5563; margin: 0 0 20px; }
  .fl-body:last-child { margin-bottom: 0; }
  .fl-cycle { display: flex; align-items: stretch; gap: 0; margin: 32px 0; }
  .fl-cycle-step { flex: 1; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); padding: 20px 16px; text-align: center; font-size: 13px; font-weight: 700; line-height: 1.55; color: #1f2937; position: relative; }
  .fl-cycle-step:first-child { border-radius: 16px 0 0 16px; }
  .fl-cycle-step:last-child { border-radius: 0 16px 16px 0; }
  .fl-cycle-step + .fl-cycle-step { border-left: none; }
  .fl-cycle-step::after { content: "→"; position: absolute; right: -12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #16a34a; font-weight: 900; z-index: 1; }
  .fl-cycle-step:last-child::after { content: ""; }
  .fl-cycle-num { display: block; font-size: 11px; font-weight: 800; color: #16a34a; letter-spacing: .06em; margin-bottom: 8px; }
  .fl-trust { background: #0f172a; color: rgba(255,255,255,.88); border-radius: 16px; padding: 22px 28px; margin: 28px 0; font-size: 15px; line-height: 1.75; }
  .fl-trust strong { color: #bbf7d0; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; display: block; margin-bottom: 8px; }
  .fl-chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
  .fl-chip { display: inline-flex; align-items: center; padding: 9px 15px; border-radius: 999px; background: rgba(15,23,42,.05); border: 1px solid rgba(15,23,42,.08); font-size: 12.5px; font-weight: 700; color: #374151; line-height: 1.4; }
  .fl-reasons { display: grid; gap: 28px; margin: 32px 0; }
  .fl-reason { display: grid; grid-template-columns: 48px 1fr; gap: 20px; align-items: start; }
  .fl-reason-num { font-size: 28px; font-weight: 900; color: #10b981; line-height: 1; padding-top: 2px; }
  .fl-reason-body h3 { font-size: 16px; font-weight: 800; color: #111827; margin: 0 0 8px; line-height: 1.4; }
  .fl-reason-body p { font-size: 14.5px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-steps { display: grid; gap: 0; margin: 32px 0; }
  .fl-step { display: grid; grid-template-columns: 56px 1fr; gap: 0; position: relative; }
  .fl-step-num { display: flex; flex-direction: column; align-items: center; }
  .fl-step-num-badge { width: 36px; height: 36px; border-radius: 50%; background: #f0fdf4; border: 2px solid #16a34a; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #16a34a; flex-shrink: 0; }
  .fl-step-num-line { flex: 1; width: 2px; background: linear-gradient(180deg, #bbf7d0 0%, #f0fdf4 100%); margin-top: 4px; }
  .fl-step:last-child .fl-step-num-line { display: none; }
  .fl-step-content { padding: 0 0 32px 20px; }
  .fl-step:last-child .fl-step-content { padding-bottom: 0; }
  .fl-step-content h3 { font-size: 15px; font-weight: 800; color: #111827; margin: 5px 0 6px; line-height: 1.4; }
  .fl-step-content p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-step-badge-text { font-size: 10px; font-weight: 800; color: #16a34a; line-height: 1.1; text-align: center; padding: 0 2px; }
  .fl-tiers { display: grid; gap: 14px; margin: 28px 0; }
  .fl-tier { border-radius: 16px; padding: 22px 24px; display: grid; grid-template-columns: 130px 1fr 1fr; gap: 16px; align-items: start; border: 1px solid rgba(15,23,42,.08); }
  .fl-tier-1 { background: #f8fafc; }
  .fl-tier-2 { background: #f0fdf4; border-color: rgba(22,163,74,.12); }
  .fl-tier-3 { background: #ecfdf5; border-color: rgba(22,163,74,.2); }
  .fl-tier-4 { background: #dcfce7; border-color: rgba(22,163,74,.3); }
  .fl-tier-name { font-size: 14px; font-weight: 800; color: #111827; line-height: 1.45; }
  .fl-tier-meaning { font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 4px; }
  .fl-tier-col-label { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
  .fl-tier-col-body { font-size: 13px; line-height: 1.75; color: #374151; }
  .fl-tier-col-no { font-size: 13px; line-height: 1.75; color: #9ca3af; }
  .fl-callout { border-radius: 16px; padding: 22px 24px; background: linear-gradient(135deg, #f7fee7 0%, #ecfccb 100%); border: 1px solid rgba(101,163,13,.2); margin: 24px 0; }
  .fl-callout strong { display: block; font-size: 13px; font-weight: 800; color: #3f6212; letter-spacing: .02em; margin-bottom: 8px; }
  .fl-callout p { font-size: 14px; line-height: 1.85; color: #3f6212; margin: 0; }
  .fl-info { border-radius: 16px; padding: 22px 24px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); margin: 24px 0; }
  .fl-info strong { display: block; font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
  .fl-info p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-roles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 28px 0; }
  .fl-role { border-radius: 16px; padding: 24px; background: #fafafa; border: 1px solid rgba(15,23,42,.07); }
  .fl-role-icon { font-size: 24px; display: block; margin-bottom: 14px; }
  .fl-role h3 { font-size: 16px; font-weight: 800; color: #111827; margin: 0 0 6px; }
  .fl-role p { font-size: 13.5px; line-height: 1.8; color: #6b7280; margin: 0 0 14px; }
  .fl-role-tag { display: inline-block; font-size: 12px; font-weight: 700; color: #166534; background: #dcfce7; border-radius: 8px; padding: 5px 10px; line-height: 1.4; }
  .fl-benefits { list-style: none; margin: 20px 0; padding: 0; display: grid; gap: 10px; }
  .fl-benefits li { display: flex; align-items: baseline; gap: 10px; font-size: 15px; line-height: 1.8; color: #374151; }
  .fl-benefits li::before { content: "✓"; font-weight: 900; color: #16a34a; flex-shrink: 0; }
  .fl-faq { display: grid; gap: 12px; margin: 28px 0; }
  .fl-faq-item { border-radius: 14px; background: #f9fafb; border: 1px solid rgba(15,23,42,.07); }
  .fl-faq-q { font-size: 15px; font-weight: 800; color: #111827; margin: 0; line-height: 1.5; }
  .fl-faq-a { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  details.fl-faq-item summary.fl-faq-q { padding: 20px 24px; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  details.fl-faq-item summary.fl-faq-q::-webkit-details-marker { display: none; }
  details.fl-faq-item summary.fl-faq-q::after { content: "+"; font-size: 20px; font-weight: 400; color: #9ca3af; flex-shrink: 0; }
  details.fl-faq-item[open] summary.fl-faq-q::after { content: "−"; }
  details.fl-faq-item .fl-faq-a { padding: 0 24px 20px; border-top: 1px solid rgba(15,23,42,.06); padding-top: 14px; }
  .fl-refs { margin: 24px 0 0; padding: 24px; background: #f9fafb; border-radius: 14px; }
  .fl-refs-label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9ca3af; margin-bottom: 14px; }
  .fl-refs ol { margin: 0; padding: 0; display: grid; gap: 12px; }
  .fl-refs li { font-size: 13px; line-height: 1.8; color: #6b7280; list-style: none; }
  .fl-refs em { font-style: italic; }
  .fl-outline { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 28px 0 0; }
  .fl-outline a { display: block; padding: 16px 18px; border-radius: 14px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #0f172a; text-decoration: none; font-size: 13px; font-weight: 700; line-height: 1.65; }
  .fl-outline a:hover { border-color: rgba(22,163,74,.26); background: #f0fdf4; }
  .fl-outline a span { display: block; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #16a34a; margin-bottom: 8px; }
  .fl-debates { display: grid; gap: 14px; margin: 28px 0 0; }
  .fl-debate { border-left: 4px solid #0f172a; border-radius: 0 16px 16px 0; background: #f8fafc; padding: 18px 20px; }
  .fl-debate h3 { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 8px; line-height: 1.5; }
  .fl-debate p { font-size: 13.5px; line-height: 1.85; color: #475569; margin: 0; }
  .fl-ref-list { counter-reset: ref; }
  .fl-ref-list li { position: relative; padding-left: 24px; }
  .fl-ref-list li::before { counter-increment: ref; content: counter(ref) "."; position: absolute; left: 0; top: 0; font-size: 12px; font-weight: 800; color: #94a3b8; }
  .fl-ref-link { color: #0f172a; text-decoration: none; font-weight: 700; }
  .fl-ref-link:hover { text-decoration: underline; }
  .fl-ref-meta { display: block; margin-top: 3px; font-size: 12px; color: #6b7280; }
  .fl-sec[id] { scroll-margin-top: 96px; }
  .fl-cta-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 20px; }
  .fl-premise { font-size: 12.5px; line-height: 1.9; color: #94a3b8; border-top: 1px solid rgba(15,23,42,.06); padding-top: 20px; margin-top: 4px; }
  .fl-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 28px 0; }
  .fl-card { border-radius: 16px; padding: 24px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .fl-card h3 { font-size: 15px; font-weight: 800; color: #111827; margin: 0 0 10px; line-height: 1.4; }
  .fl-card p { font-size: 14px; line-height: 1.85; color: #4b5563; margin: 0; }
  .fl-divider { border: none; border-top: 1px solid rgba(15,23,42,.08); margin: 32px 0; }
  @media (max-width: 640px) {
    .fl-sec { padding: 40px 0; }
    .fl-cycle { flex-direction: column; }
    .fl-cycle-step { border-radius: 0 !important; border-left: 1px solid rgba(15,23,42,.08) !important; }
    .fl-cycle-step:first-child { border-radius: 16px 16px 0 0 !important; }
    .fl-cycle-step:last-child { border-radius: 0 0 16px 16px !important; }
    .fl-cycle-step::after { content: "↓"; right: auto; left: 50%; bottom: -12px; top: auto; transform: translateX(-50%); }
    .fl-tier { grid-template-columns: 1fr; gap: 12px; }
    .fl-roles, .fl-2col, .fl-outline { grid-template-columns: 1fr; }
  }
  @media (max-width: 860px) {
    .fl-tier { grid-template-columns: 140px 1fr; }
    .fl-tier > *:last-child { grid-column: 1 / -1; }
  }
</style>`;

// Break Krug AI-slop 3-col feature grid by making the first card featured
// (double-width, accent left border, larger heading) and the rest plain.
// Also drops the repeated "ikimon" eyebrow that all cards used to share.
function cards(items: Array<{ title: string; body: string; href?: string; label?: string; eyebrow?: string }>): string {
  const featured = items[0];
  if (!featured) return "";
  const rest = items.slice(1);
  const featuredHtml = `<div class="card has-accent mkt-featured">
    ${featured.eyebrow ? `<div class="eyebrow">${escapeHtml(featured.eyebrow)}</div>` : ""}
    <h2 class="mkt-featured-title">${escapeHtml(featured.title)}</h2>
    <p>${escapeHtml(featured.body)}</p>
    ${featured.href ? `<div class="actions" style="margin-top:14px"><a class="btn btn-solid" href="${escapeHtml(featured.href)}">${escapeHtml(featured.label ?? "Open")}</a></div>` : ""}
  </div>`;
  const restHtml = rest
    .map(
      (item) => `<div class="card is-soft">
        ${item.eyebrow ? `<div class="eyebrow">${escapeHtml(item.eyebrow)}</div>` : ""}
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        ${item.href ? `<div class="actions" style="margin-top:10px"><a class="inline-link" href="${escapeHtml(item.href)}">${escapeHtml(item.label ?? "Open")}</a></div>` : ""}
      </div>`,
    )
    .join("");
  return `<section class="section mkt-cards">
    <style>
      .mkt-cards .card { flex: 1 1 260px; }
      .mkt-cards .mkt-featured { flex: 1 1 100%; padding: 28px 32px; background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%); border-left: 4px solid #10b981; }
      .mkt-cards .mkt-featured-title { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.3; letter-spacing: -.02em; margin-top: 10px; }
      .mkt-cards .card h3 { margin: 6px 0 8px; font-size: 16px; font-weight: 800; letter-spacing: -.01em; color: #0f172a; }
      .mkt-cards .grid { gap: 14px; }
    </style>
    ${featuredHtml}
    <div class="grid" style="margin-top:14px">${restHtml}</div>
  </section>`;
}

function rows(items: Array<{ title: string; body: string; actionHref?: string; actionLabel?: string }>): string {
  return `<section class="section"><div class="list">${items
    .map(
      (item) => `<div class="row">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="meta">${escapeHtml(item.body)}</div>
        </div>
        ${item.actionHref ? `<a class="btn btn-ghost" href="${escapeHtml(item.actionHref)}">${escapeHtml(item.actionLabel ?? "Open")}</a>` : ""}
      </div>`,
    )
    .join("")}</div></section>`;
}

type FieldLoopDebate = {
  title: string;
  body: string;
};

type FieldLoopCard = {
  title: string;
  body: string;
};

type FieldLoopSection = {
  id: string;
  label: string;
  title: string;
  lead?: string;
  paragraphs: string[];
  callout?: { title: string; body: string };
  debates?: FieldLoopDebate[];
  chips?: string[];
  cards?: FieldLoopCard[];
};

type FieldLoopReference = {
  href: string;
  citation: string;
  meta?: string;
};

function renderFieldLoopOutline(sections: FieldLoopSection[]): string {
  return `<div class="fl-outline">${sections
    .map(
      (section, index) => `<a href="#${escapeHtml(section.id)}">
        <span>CHAPTER ${index + 1}</span>
        ${escapeHtml(section.title)}
      </a>`,
    )
    .join("")}</div>`;
}

function renderFieldLoopDebates(debates: FieldLoopDebate[]): string {
  return `<div class="fl-debates">${debates
    .map(
      (debate) => `<article class="fl-debate">
        <h3>${escapeHtml(debate.title)}</h3>
        <p>${debate.body}</p>
      </article>`,
    )
    .join("")}</div>`;
}

function renderFieldLoopCards(items: FieldLoopCard[]): string {
  return `<div class="fl-2col">${items
    .map(
      (item) => `<div class="fl-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </div>`,
    )
    .join("")}</div>`;
}

function renderFieldLoopReferences(title: string, refs: FieldLoopReference[]): string {
  return `<section class="fl-sec" id="references">
    <div class="fl-label">References</div>
    <h2 class="fl-h2">${escapeHtml(title)}</h2>
    <div class="fl-refs">
      <div class="fl-refs-label">Linked sources</div>
      <ol class="fl-ref-list">${refs
        .map(
          (ref) => `<li>
            <a class="fl-ref-link" href="${escapeHtml(ref.href)}" target="_blank" rel="noreferrer">${escapeHtml(ref.citation)}</a>
            ${ref.meta ? `<span class="fl-ref-meta">${escapeHtml(ref.meta)}</span>` : ""}
          </li>`,
        )
        .join("")}</ol>
    </div>
  </section>`;
}

type GlossaryEntry = { term: string; aka?: string; plain: string; context?: string };

const GLOSSARY_JA: GlossaryEntry[] = [
  {
    term: "フィールドループ",
    plain: "「観察する → 記録する → 読み返す」の 3 ステップをぐるりと一周する、ikimon が勧める散歩と記録のサイクル。",
    context: "同じ場所で何周か回すと、季節の差分や場所の変化が見えてきます。",
  },
  {
    term: "場所の記憶",
    aka: "place memory",
    plain: "同じ場所に何度か通うことで、その場所に積み上がっていく観察ノートの厚み。",
    context: "1 回の観察では読めない、時間をかけて育つ文脈のこと。",
  },
  {
    term: "なぜここか / なぜ今か",
    aka: "why here / why now",
    plain: "この場所に寄る理由、今寄る意味。地図の偏りと季節の差分から返される手がかり。",
    context: "フィールドスキャンで、訪問先を選ぶときに使う入口です。",
  },
  {
    term: "また来る理由",
    aka: "next revisit hook",
    plain: "1 回の訪問を、次にまた来るための理由につなげる仕掛け。",
    context: "旅先の 1 枚を、その場限りの消費で終わらせないための設計です。",
  },
  {
    term: "1 回の訪問で残せること",
    aka: "one-visit contribution",
    plain: "旅行などで一度だけ寄るときに、その場所に残していける観察や手がかり。",
  },
  {
    term: "AI ヒント / AI 伴走",
    aka: "AI copilot",
    plain: "候補を出したり、次に何を見ればいいかを返す AI の役割。最終判断は人がする前提。",
    context: "ikimon は AI を「助手席」として扱います。運転するのは人です。",
  },
  {
    term: "人の確認",
    aka: "review / authority-backed review",
    plain: "観察が公開情報として使われる前に、経験のある人や任された人が通す確認プロセス。",
    context: "AI だけで公開判定しないのは、最終的な責任を人に置くためです。",
  },
  {
    term: "任された人",
    aka: "authority",
    plain: "分類群や地域ごとに、確認を任されている経験者や専門家。",
    context: "AI と一般の同定との間にある中間レイヤー。公開前の責任を引き受けます。",
  },
  {
    term: "公開前提の記録",
    aka: "public claim",
    plain: "研究や公的な場で使える品質として、公開を前提に扱う記録のレーン。",
    context: "AI 候補のままや、人の確認が済む前の記録は、このレーンには載せません。",
  },
  {
    term: "未観測",
    aka: "blank",
    plain: "「まだ十分に探していない」状態。地図に点がないことと同じ意味。",
    context: "「不在」と混ぜないことが、ikimon の基本姿勢です。",
  },
  {
    term: "不在",
    aka: "absence",
    plain: "「探したけれど、そこにはいなかった」状態。主張するにはどれだけ歩いたかの記録が必要。",
    context: "未観測との区別は、データを読むときの最重要ポイントです。",
  },
  {
    term: "どれだけ歩いたか",
    aka: "sampling effort",
    plain: "観察に費やした時間・距離・範囲の記録。比較や不在主張をするときの前提になります。",
  },
  {
    term: "手順",
    aka: "protocol",
    plain: "比較したい観察で、同じ条件で記録するために決めておく段取り。",
    context: "ふだんの散歩では不要。本格的に比較したい観察のときだけ使います。",
  },
  {
    term: "その場の 1 枚",
    aka: "quick capture",
    plain: "計画せず、散歩の途中で「あ、これ」と撮る 1 枚。ikimon の基本の入口。",
  },
  {
    term: "場所を見守る取り組み",
    aka: "place stewardship",
    plain: "学校・自治体・企業などが、地域の場所を継続的に観察し、記録を積み上げていく取り組み。",
    context: "ikimon の法人向けは、ここを支える入口として設計しています。",
  },
];

const GLOSSARY_EN: GlossaryEntry[] = [
  { term: "Field Loop", plain: "Observe → Record → Revisit. One cycle of ikimon's walking and recording loop." },
  { term: "place memory", plain: "The thickness of context that builds up when the same place is walked and recorded again and again." },
  { term: "why here / why now", plain: "Reasons to stop here and reasons to stop now, returned from map bias and seasonal gaps." },
  { term: "next revisit hook", plain: "A hook that turns one visit into a reason to come back." },
  { term: "AI copilot", plain: "AI as a passenger-seat helper that returns candidates and clues. Humans still decide." },
  { term: "review", plain: "A human check step before a record is treated as public." },
  { term: "authority", plain: "Trusted humans who hold the review responsibility for specific taxa or regions." },
  { term: "public claim", plain: "A record lane that is treated as publishable — only after human review." },
  { term: "blank vs absence", plain: "Blank = not yet observed. Absence = looked for but not found, and requires effort to claim." },
  { term: "sampling effort", plain: "How much time, distance, and coverage was spent. Needed to make comparison claims." },
  { term: "protocol", plain: "A decided procedure used when you want comparable observations." },
  { term: "place stewardship", plain: "Institutional care for a place, carried by schools, municipalities, or local partners." },
];

function renderGlossaryBody(basePath: string, lang: SiteLang): string {
  const list = lang === "ja" ? GLOSSARY_JA : GLOSSARY_EN;
  const introJa = `このページは、ikimon の説明の中で出てくる言葉を、できるだけやさしく並べたものです。本文で詰まったら、ここへ戻ってくるだけで十分です。`;
  const introEn = `A plain-language glossary of the words ikimon uses. Come back here whenever you need.`;
  const entries = list
    .map(
      (e) => `<section class="fl-sec" id="term-${escapeHtml(e.aka ?? e.term)
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9-]/g, "")
        .toLowerCase() || escapeHtml(e.term)}">
        <h3 class="fl-h2" style="font-size:20px;">${escapeHtml(e.term)}${e.aka ? ` <small style="font-size:13px;font-weight:500;color:#64748b;">（${escapeHtml(e.aka)}）</small>` : ""}</h3>
        <p class="fl-body">${escapeHtml(e.plain)}</p>
        ${e.context ? `<p class="fl-body" style="color:#475569;">${escapeHtml(e.context)}</p>` : ""}
      </section>`,
    )
    .join("");
  return `${FL_CSS}
  <div class="fl">
    <section class="fl-sec">
      <p class="fl-lead">${escapeHtml(lang === "ja" ? introJa : introEn)}</p>
    </section>
    ${entries}
    <section class="fl-sec">
      <div class="fl-label">${lang === "ja" ? "次に読む" : "Next"}</div>
      <h2 class="fl-h2">${lang === "ja" ? "もう少し深く知りたいとき" : "If you want to go deeper"}</h2>
      <div class="fl-cta-actions">
        <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/field-loop"), lang))}">${lang === "ja" ? "フィールドループを読む" : "Read Field Loop"}</a>
        <a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/authority-policy"), lang))}">${lang === "ja" ? "信頼のしくみを見る" : "Trust policy"}</a>
      </div>
    </section>
  </div>`;
}

function renderFieldLoopBody(basePath: string, lang: SiteLang): string {
  if (lang !== "ja") {
    const sections: FieldLoopSection[] = [
      {
        id: "why-this-shape",
        label: "Why This Shape",
        title: "ikimon is choosing a different job.",
        lead: "This page explains why ikimon is not trying to be every kind of biodiversity platform at once.",
        paragraphs: [
          "Digital biodiversity recording has expanded who can participate, how fast observations move, and how widely they can be reused. That broadening matters for science, conservation, and public learning.<sup>[1][2][3]</sup>",
          "But the same literature also shows that broad participation, uneven effort, community verification, and AI assistance create different strengths and limits. These systems are not interchangeable.<sup>[6][7][8][9][10][11]</sup>",
        ],
      },
      {
        id: "ikimon-focus",
        label: "ikimon Focus",
        title: "place-first observatory + regional entry service",
        paragraphs: [
          "ikimon focuses on two loops: local people returning to the same place, and travelers turning a single encounter into a reason to come back. That is why we emphasize place memory, revisit hooks, protocol when comparison matters, and visible trust lanes.",
          "We treat AI as a copilot for suggestions and understanding support, not as the final judge. We also avoid strong absence or trend claims when effort conditions are not met.",
        ],
      },
      {
        id: "responsibility-boundary",
        label: "Boundary",
        title: "What we promise, and what we do not.",
        paragraphs: [
          "We promise evidence, revisitability, visible authority, and honest limits. We do not promise AI-only final truth, automatic research-grade claims, or trend and absence assertions from under-specified records.",
        ],
        cards: [
          {
            title: "We promise",
            body: "place memory, protocol when comparison matters, authority-backed review, and explicit non-promises around absence and trend.",
          },
          {
            title: "We do not promise",
            body: "AI-only public claims, blanket research quality from every record, or overconfident narratives that hide uncertainty.",
          },
        ],
      },
    ];
    const references: FieldLoopReference[] = [
      { href: "https://doi.org/10.1016/j.tree.2009.03.017", citation: "Silvertown (2009) / Trends in Ecology & Evolution" },
      { href: "https://doi.org/10.1016/j.biocon.2014.10.021", citation: "Theobald et al. (2015) / Biological Conservation" },
      { href: "https://doi.org/10.1016/j.biocon.2016.09.004", citation: "Chandler et al. (2017) / Biological Conservation" },
      { href: "https://doi.org/10.1371/journal.pbio.3000357", citation: "Callaghan et al. (2019) / PLOS Biology" },
      { href: "https://doi.org/10.5334/cstp.351", citation: "Baker et al. (2021) / Citizen Science: Theory and Practice" },
      { href: "https://doi.org/10.1093/biosci/biae077", citation: "Truong & Van der Wal (2024) / BioScience" },
      { href: "https://doi.org/10.5334/cstp.735", citation: "Sharma et al. (2024) / Citizen Science: Theory and Practice" },
      { href: "https://doi.org/10.5334/cstp.868", citation: "Grady et al. (2026) / Citizen Science: Theory and Practice" },
      { href: "https://doi.org/10.17161/bi.v20i1.24266", citation: "Soberón & Christén (2026) / Biodiversity Informatics" },
      { href: "https://doi.org/10.32942/X2TH4R", citation: "Callaghan et al. (2026) / EcoEvoRxiv", meta: "preprint / under review" },
    ];
    return `${FL_CSS}
    <div class="fl">
      ${renderFieldLoopOutline(sections)}
      ${sections
        .map(
          (section) => `<section class="fl-sec" id="${escapeHtml(section.id)}">
            <div class="fl-label">${escapeHtml(section.label)}</div>
            <h2 class="fl-h2">${escapeHtml(section.title)}</h2>
            ${section.lead ? `<p class="fl-lead">${section.lead}</p>` : ""}
            ${section.paragraphs.map((paragraph) => `<p class="fl-body">${paragraph}</p>`).join("")}
            ${section.callout ? `<div class="fl-callout"><strong>${escapeHtml(section.callout.title)}</strong><p>${escapeHtml(section.callout.body)}</p></div>` : ""}
            ${section.debates ? renderFieldLoopDebates(section.debates) : ""}
            ${section.chips ? `<div class="fl-chips">${section.chips.map((chip) => `<span class="fl-chip">${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
            ${section.cards ? renderFieldLoopCards(section.cards) : ""}
          </section>`,
        )
        .join("")}
      ${renderFieldLoopReferences("Selected references behind this stance", references)}
      <section class="fl-sec">
        <div class="fl-label">Next</div>
        <h2 class="fl-h2">See the adjacent pages.</h2>
        <p class="fl-body">Read the trust policy and methodology pages if you want the operational boundary after the positioning statement.</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">Start recording</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/authority-policy"))}">Trust policy</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">Methodology</a>
        </div>
      </section>
    </div>`;
  }

  const sections: FieldLoopSection[] = [
    {
      id: "data-streams",
      label: "",
      title: "ひとつの場所を、いろんな解像度で見たい",
      paragraphs: [
        "ikimon が集めたいのは、1 種類のデータではありません。粗い衛星の画像で広く当たりをつけ、車や徒歩で現地へ近づき、散歩の途中の映像と音声、そして市民が残すフィールドノート。解像度の違うデータが、同じ場所に重なっていくといいな、と考えています。",
        "粗いものは広く、細かいものは深く。両方が揃ってはじめて、場所の状態が見えてくるのではないか、と思っています。",
      ],
      chips: ["衛星", "移動（車・徒歩）", "映像・音声", "フィールドノート"],
    },
    {
      id: "identification-layers",
      label: "",
      title: "同定は、AI と人と専門家で重ねたい",
      paragraphs: [
        "集まったデータに名前をつける工程も、1 層で済ませたくありません。AI が候補を広げ、市民の同定が候補を絞り、分類群を任された専門家が公開前に通す。そんな重ね方を目指しています。",
        "それぞれ違う強みがあると考えていて、組み合わせることで速さと確度を同時に保てるのではないか、と思っています。AI 単独での公開判定はしないつもりです。",
      ],
      chips: ["AI が候補を広げる", "市民が候補を絞る", "専門家が確認する"],
    },
    {
      id: "knowledge-base",
      label: "",
      title: "集まったデータが、次の観察を賢くするはず",
      paragraphs: [
        "観察・同定・確認を重ねたデータは、「知の基盤」として少しずつ積み上がっていく、と考えています。どこで何が見られやすいか、季節でどう変わるか、どの場所が手薄か。そういった輪郭が、回すほど明らかになっていくのではないでしょうか。",
        "知の基盤が育つと、次の観察も賢くなるはずです。衛星で当たりをつける精度が上がり、AI の候補提示が土地に合ったものになり、市民が撮るべき 1 枚の狙いも定まっていく。工程そのものが改善していくイメージです。",
        "「データが基盤を育て、基盤が工程を改善し、工程がさらに良いデータを生む」。この循環こそが、ikimon の考えるフィールドループです。1 回で完結するものではなく、回せば回すほど効いてくる、と考えています。",
      ],
    },
    {
      id: "where-you-fit",
      label: "",
      title: "あなたの 1 枚が、循環の起点になる",
      paragraphs: [
        "「名前が分からない」「写真が甘い」でも大丈夫だと考えています。気になったもの、気になった場所の 1 枚をノートに残すこと、それ自体が循環の入口になるはずです。",
        "地元の人には、いつもの散歩道が何度も楽しめる場所に。旅で来た人には、今ここに寄る理由と、また来たい理由に。この 2 つの入り口を、ikimon は丁寧に作っていきたいと思っています。",
      ],
      callout: {
        title: "「見つかっていない」と「いない」は別",
        body: "地図に点がないことは、まず「まだ十分に探していない」と読むのが安全だ、と言われています。「いない」と言い切るには、どれだけ歩いたか・どんな手順で探したかの記録が必要になる、と考えています。",
      },
    },
    {
      id: "promises",
      label: "",
      title: "ikimon の約束、約束しないこと",
      paragraphs: [
        "「なんでもできる生物サービス」を目指しているわけではありません。「この場所を、また見に来る理由を作り、循環を回す」ことに絞っています。",
      ],
      cards: [
        {
          title: "約束すること",
          body: "観察をなくさず、あとから比較できる形で残す。AI はヒント役にとどめる。人と専門家の確認を見える形にする。条件が揃わない「不在」や「増減」は言わない。",
        },
        {
          title: "約束しないこと",
          body: "AI 単独の最終判定。条件不足のデータからの「減った」「いない」の断言。手順のない観察からの不在主張。どんな記録も自動で研究品質になるという期待。",
        },
      ],
    },
  ];
  const backgroundSections: Array<{ title: string; body: string }> = [
    {
      title: "市民の観察が、自然の見方を変えてきた",
      body: "ここ 20 年でスマホと共有サービスが普及し、生物の記録は「詳しい人がノートに書くもの」から「誰でも撮って、みんなで磨くもの」へ変わりました<sup>[1][2][3]</sup>。分布・季節性・変化の兆しといった現象が、研究者より先に市民の手で共有されるようになっています。",
    },
    {
      title: "量が増えるほど、読み方に注意が要る",
      body: "観察は場所・季節・種類・人によって均等には集まりません<sup>[6][8]</sup>。2026 年の研究では、普段の散歩の延長で観察する人と、目的を持って観察に出る人では、どこで何を記録するかが大きく違うと示されました<sup>[8]</sup>。「どれだけ歩いたか」の記録がないと、「見つかっていない」が「まだ見ていない」なのか「本当にいない」のか区別できません<sup>[6][9][12]</sup>。",
    },
    {
      title: "AI が入ると、境界のひき方が大事になる",
      body: "AI が候補を返してくれると記録は格段にラクになる一方、速さだけを求めると学習と信頼が薄くなるという研究もあります<sup>[7][10][11]</sup>。人と AI が別の視点を保ったまま対話する設計では、双方の精度と学習が伸びることも示されました<sup>[11]</sup>。ikimon はこの方向を選んでいます。",
    },
  ];
  const references: FieldLoopReference[] = [
    { href: "https://doi.org/10.1016/j.tree.2009.03.017", citation: "Silvertown (2009) / Trends in Ecology & Evolution" },
    { href: "https://doi.org/10.1016/j.biocon.2014.10.021", citation: "Theobald et al. (2015) / Biological Conservation" },
    { href: "https://doi.org/10.1016/j.biocon.2016.09.004", citation: "Chandler et al. (2017) / Biological Conservation" },
    { href: "https://doi.org/10.1016/j.biocon.2016.09.003", citation: "Newman et al. (2017) / Biological Conservation" },
    { href: "https://doi.org/10.5751/ES-14754-290111", citation: "Haywood et al. (2024) / Ecology and Society" },
    { href: "https://doi.org/10.1371/journal.pbio.3000357", citation: "Callaghan et al. (2019) / PLOS Biology" },
    { href: "https://doi.org/10.5334/cstp.351", citation: "Baker et al. (2021) / Citizen Science: Theory and Practice" },
    { href: "https://doi.org/10.5334/cstp.868", citation: "Grady et al. (2026) / Citizen Science: Theory and Practice" },
    { href: "https://doi.org/10.17161/bi.v20i1.24266", citation: "Soberón & Christén (2026) / Biodiversity Informatics" },
    { href: "https://doi.org/10.1093/biosci/biae077", citation: "Truong & Van der Wal (2024) / BioScience" },
    { href: "https://doi.org/10.5334/cstp.735", citation: "Sharma et al. (2024) / Citizen Science: Theory and Practice" },
    { href: "https://doi.org/10.32942/X2TH4R", citation: "Callaghan et al. (2026) / EcoEvoRxiv", meta: "preprint / under review" },
  ];

  return `${FL_CSS}
  <div class="fl">
    ${sections
      .map(
        (section) => `<section class="fl-sec" id="${escapeHtml(section.id)}">
          <h2 class="fl-h2">${escapeHtml(section.title)}</h2>
          ${section.lead ? `<p class="fl-lead">${section.lead}</p>` : ""}
          ${section.paragraphs.map((paragraph) => `<p class="fl-body">${paragraph}</p>`).join("")}
          ${section.callout ? `<div class="fl-callout"><strong>${escapeHtml(section.callout.title)}</strong><p>${escapeHtml(section.callout.body)}</p></div>` : ""}
          ${section.chips ? `<div class="fl-chips">${section.chips.map((chip) => `<span class="fl-chip">${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
          ${section.cards ? renderFieldLoopCards(section.cards) : ""}
        </section>`,
      )
      .join("")}
    <details class="fl-sec" style="margin-top:16px;"><summary class="fl-label" style="cursor:pointer;">このフィールドループを支えている研究の流れ</summary>
      <p class="fl-body" style="margin-top:16px;">フィールドループという考え方は、ikimon が一から思いついたものではありません。この領域で積み上がってきた研究の流れを、私たちなりに読んで整理したものです。以下はその背景のメモです。</p>
      ${backgroundSections.map((bg) => `<div style="margin-top:20px;"><strong style="font-size:15px;">${escapeHtml(bg.title)}</strong><p class="fl-body" style="margin-top:8px;">${bg.body}</p></div>`).join("")}
    </details>
    <details class="fl-sec"><summary class="fl-label" style="cursor:pointer;">参考文献</summary>
      ${renderFieldLoopReferences("このページで参照している主要文献", references)}
    </details>
    <section class="fl-sec">
      <h2 class="fl-h2">次に読む</h2>
      <p class="fl-body">同定の信頼のしくみは <a href="${escapeHtml(withBasePath(basePath, "/learn/authority-policy"))}">信頼のしくみ</a>、データの扱いと約束の範囲は <a href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">方法論</a> にまとめています。用語は <a href="${escapeHtml(withBasePath(basePath, "/learn/glossary"))}">用語集</a> で確認できます。</p>
      <div class="fl-cta-actions">
        <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">まずは観察を残す</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/glossary"))}">用語集</a>
      </div>
    </section>
  </div>`;
}

function renderContactForm(_basePath: string): string {
  // 認証不要フォーム。POST /api/v1/contact/submit に JSON 送信。
  // JS 無効環境では送信できない旨を noscript で案内。
  const categories = [
    { value: "question",    label: "❓ 質問" },
    { value: "bug",         label: "🐛 バグ報告" },
    { value: "improvement", label: "💡 要望・提案" },
    { value: "partnership", label: "🤝 導入・連携" },
    { value: "media",       label: "📰 取材・メディア" },
    { value: "deletion",    label: "🗑️ データ削除" },
    { value: "other",       label: "💬 その他" },
  ];
  const optionsHtml = categories
    .map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`)
    .join("");

  return `<section class="section">
<style>
  .cf-form { display: grid; gap: 14px; max-width: 640px; margin: 0 auto 32px; padding: 24px; border-radius: 16px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); }
  .cf-form label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #111827; }
  .cf-form input, .cf-form select, .cf-form textarea { padding: 10px 12px; border: 1px solid rgba(15,23,42,.15); border-radius: 10px; font-size: 14px; background: #fff; font-family: inherit; }
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
  <label><span class="cf-required">カテゴリ</span>
    <select name="category" required>${optionsHtml}</select>
  </label>
  <label><span class="cf-required">内容</span>
    <textarea name="message" required minlength="5" maxlength="8000" placeholder="ご質問・ご要望・ご報告の内容を記入してください。"></textarea>
    <span class="cf-hint">最低 5 文字・最大 8000 文字</span>
  </label>
  <label>お名前
    <input name="name" type="text" maxlength="200" placeholder="任意" />
  </label>
  <label>組織名
    <input name="organization" type="text" maxlength="200" placeholder="任意" />
  </label>
  <label>メールアドレス
    <input name="email" type="email" maxlength="200" placeholder="返信を希望する場合は入力してください" />
    <span class="cf-hint">入力すると受付自動返信が届きます（任意）</span>
  </label>
  <div class="cf-actions">
    <button type="submit" id="cf-submit">送信する</button>
    <span class="cf-status" id="cf-status"></span>
  </div>
  <noscript><p class="cf-status cf-err">JavaScript を有効にして送信してください。無効の場合は contact@ikimon.life へ直接メールでご連絡をお願いします。</p></noscript>
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
    status.textContent = '送信中…';
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
      var res = await fetch('/api/v1/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      var data = await res.json().catch(function(){ return {}; });
      if (res.ok && data && data.ok) {
        status.className = 'cf-status cf-ok';
        status.textContent = '送信しました。受付番号: ' + (data.submissionId || '').slice(0, 8) + '…';
        form.reset();
      } else {
        status.className = 'cf-status cf-err';
        var msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
        status.textContent = '送信できませんでした: ' + msg;
      }
    } catch(e) {
      status.className = 'cf-status cf-err';
      status.textContent = '送信できませんでした（ネットワークエラー）';
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>
</section>`;
}

export async function registerMarketingRoutes(app: FastifyInstance): Promise<void> {
  const redirectMap = new Map<string, string>([
    ["/index.php", "/"],
    ["/guides.php", "/learn/identification-basics"],
    ["/guidelines.php", "/learn/methodology"],
    ["/updates.php", "/learn/updates"],
    ["/methodology.php", "/learn/methodology"],
    ["/about.php", "/about"],
    ["/faq.php", "/faq"],
    ["/privacy.php", "/privacy"],
    ["/terms.php", "/terms"],
    ["/contact.php", "/contact"],
    ["/for-business.php", "/for-business"],
    ["/pricing.php", "/for-business/pricing"],
    ["/for-business/index.php", "/for-business"],
    ["/for-business/pricing.php", "/for-business/pricing"],
    ["/for-business/demo.php", "/for-business/demo"],
    ["/for-business/status.php", "/for-business/status"],
    ["/for-business/apply.php", "/for-business/apply"],
    ["/for-business/create.php", "/for-business/apply"],
    ["/id_workbench.php", "/specialist/id-workbench"],
    ["/id_center.php", "/specialist/id-workbench"],
    ["/needs_id.php", "/specialist/id-workbench"],
    ["/review_queue.php", "/specialist/review-queue"],
    // legacy PHP の観察図鑑 → v2 の生きもの探索 (/explore)
    ["/zukan", "/explore"],
    ["/zukan.php", "/explore"],
    // trailing slash 正規化
    ["/for-business/", "/for-business"],
    ["/explore/", "/explore"],
    ["/learn/", "/learn"],
    ["/home/", "/home"],
    ["/notes/", "/notes"],
    ["/map/", "/map"],
  ]);

  for (const [legacyPath, targetPath] of redirectMap) {
    app.get(legacyPath, async (request, reply) => {
      const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      return reply.redirect(appendLangToHref(withBasePath(basePath, targetPath), lang), 308);
    });
  }

  app.get("/about", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimonについて — 近くの自然と旅先の場所が、また来る理由に変わる | ikimon" : "About | ikimon",
      lang === "ja" ? "ikimonについて" : "About",
      "近くの自然と旅先の場所を、また来たくなる理由に変える。",
      lang === "ja"
        ? "ikimon は、地元の人がいつもの場所を育てるためのサービスであり、外から来る人に地方を訪れる理由と再訪理由を返すサービスでもあります。広く集める仕事と、場所の記憶を積み上げる仕事は敵対ではなく、解く問いが違うと考えています。"
        : "ikimon is a place-first observatory for locals and a regional entry service that gives travelers reasons to visit and return.",
      cards([
        {
          title: "主役は地元の人",
          body: "いちばん深く作っているのは、その場所の近くで暮らし、同じ場所に戻り続ける人の体験です。場所の記憶が積み上がる設計を中心にしています。",
        },
        {
          title: "旅先の 1 枚も、再訪理由に変える",
          body: "旅先で撮った偶発的な 1 枚を、その場限りの投稿で終わらせず、また来たい理由や、近くの別の場所へ続く手がかりに変えることも重要な約束です。",
        },
        {
          title: "AI は伴走役で、審判ではない",
          body: "AI は候補と理解のヒントを返します。何を見ればいいかを絞るための役であり、名前を自動で確定する役ではありません。",
        },
        {
          title: "信頼のレーンを分ける",
          body: "AI のヒント、みんなの同定、任された人の確認、公開前提の主張、この 4 つを混ぜません。公開前提は、任された人の確認を通る前提で扱います。",
        },
        {
          title: "断定より、証拠と手順を残す",
          body: "その場の 1 枚と、比較したい観察を分け、比較したい観察には「どれだけ歩いたか」「手順」「範囲」を残します。あとで読み返して比較できることを優先します。",
        },
        {
          title: "不在や増減は言いすぎない",
          body: "「まだ見ていない」と「不在」を混ぜません。条件が揃っていないデータに対して、サービス側が「いない」「増えた」を強く言わない境界を守ります。",
        },
      ]) + rows([
        {
          title: "まずは 1 件残す",
          body: "名前が分からなくても始められます。近くの場所でも、旅先でも、まず 1 件を場所の記憶に変えてください。",
          actionHref: withBasePath(basePath, "/record"),
          actionLabel: lang === "ja" ? "観察を記録する" : "Start recording",
        },
        {
          title: "信頼の範囲と、約束しないことを確認する",
          body: "AI の役割、公開前提の条件、不在や増減をまだ約束しない理由を FAQ で明示しています。",
          actionHref: withBasePath(basePath, "/faq"),
          actionLabel: lang === "ja" ? "FAQ を読む" : "FAQ",
        },
      ]),
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/field-loop"), lang))}">${lang === "ja" ? "この形の理由を読む" : "Read why ikimon takes this shape"}</a>`,
    );
  });

  app.get("/learn", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "解説ガイド一覧 | ikimon" : "Learn | ikimon",
      lang === "ja" ? "解説ガイド" : "Learn",
      lang === "ja" ? "ikimon をもっとよく使うために" : "Learn",
      "近い場所の記録をどう続けるか、断定しない同定をどう扱うか、記録をどんなアーカイブとして残すかを整理しています。",
      cards([
        {
          title: "近い場所と再訪",
          body: "同じ場所に戻ることが、なぜ学びと継続の中心になるかを整理します。",
        },
        {
          title: "断定しない同定",
          body: "AI は候補、観察は証拠、レビューは別レーンという扱いを確認します。",
          href: withBasePath(basePath, "/learn/authority-policy"),
          label: lang === "ja" ? "制度を見る" : "Policy",
        },
        {
          title: "組織導入と長期アーカイブ",
          body: "学校・自治体・企業で、場所の記録をどう始めて続けるかを確認できます。",
          href: withBasePath(basePath, "/for-business"),
          label: lang === "ja" ? "法人向け" : "For Business",
        },
      ]) + rows([
        {
          title: lang === "ja" ? "Field Loop / 変遷と立ち位置" : "Field Loop / Positioning",
          body: lang === "ja"
            ? "生物記録サービスの変遷、AI 時代の論点、ikimon が place と再訪に重心を置く理由を、長文でまとめた思想ページです。"
            : "A long-form page on the transition of biodiversity recording, AI-era boundaries, and why ikimon centers place and revisits.",
          actionHref: withBasePath(basePath, "/learn/field-loop"),
          actionLabel: lang === "ja" ? "長文で読む" : "Read",
        },
        {
          title: "同定の考え方",
          body: "断定しない理由、次に見るべきポイント、再観察で精度を上げる方法。",
          actionHref: withBasePath(basePath, "/learn/identification-basics"),
          actionLabel: lang === "ja" ? "読む" : "Basics",
        },
        {
          title: "同定の信頼のしくみ",
          body: "なぜ AI とみんなの同定だけでは研究・公開用途にしないのか、なぜ任された人を分類群ごとに置くのか、推薦と監査を含めて公開します。",
          actionHref: withBasePath(basePath, "/learn/authority-policy"),
          actionLabel: lang === "ja" ? "しくみを見る" : "Policy",
        },
        {
          title: "用語集",
          body: "ikimon の説明で出てくる言葉を、やさしくまとめた一覧。本文で詰まったらここへ。",
          actionHref: withBasePath(basePath, "/learn/glossary"),
          actionLabel: lang === "ja" ? "用語を見る" : "Glossary",
        },
        {
          title: "Methodology（方針）",
          body: "データ方針、位置情報の扱い、公開の前提と限界。",
          actionHref: withBasePath(basePath, "/learn/methodology"),
          actionLabel: lang === "ja" ? "確認する" : "Methodology",
        },
        {
          title: "アップデート",
          body: "機能追加を単なる更新履歴ではなく、観察体験の進化として整理。",
        },
      ]),
      "Learn",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/about"))}">ikimon について読む</a>`,
    );
  });

  app.get("/learn/field-loop", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const pageTitle = lang === "ja" ? "フィールドループとは | ikimon" : "Why ikimon takes this shape | ikimon";
    const heroHeading = lang === "ja"
      ? "フィールドループとは"
      : "Why ikimon takes this shape.";
    const heroLead = lang === "ja"
      ? "衛星から見る、歩いて確かめる、映像と音で拾う、みんなで同定する、専門家が確認する。集まったデータが「知の基盤」を厚くし、その基盤が次の観察を賢くしていく。こんな循環を ikimon ではフィールドループと呼んでいます。"
      : "ikimon is not trying to be every kind of biodiversity platform at once. This page explains the job it chooses and the boundaries it keeps visible.";
    const body = renderFieldLoopBody(basePath, lang);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      pageTitle,
      "Learn",
      heroHeading,
      heroLead,
      body,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      lang === "ja" ? "フィールドループとは" : "Why ikimon takes<br>this shape.",
    );
  });

  app.get("/learn/glossary", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const pageTitle = lang === "ja" ? "用語集 | ikimon" : "Glossary | ikimon";
    const heroHeading = lang === "ja" ? "用語集" : "Glossary";
    const heroLead = lang === "ja"
      ? "ikimon の説明で出てくる言葉を、ざっくりと一覧にしました。詰まったらこのページに戻ってきてください。"
      : "A plain-language glossary of the words ikimon uses. Come back here whenever you need.";
    const body = renderGlossaryBody(basePath, lang);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      pageTitle,
      lang === "ja" ? "読む" : "Learn",
      heroHeading,
      heroLead,
      body,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
    );
  });

  app.get("/learn/authority-policy", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Authority Policy | ikimon",
      "Learn",
      "ikimon の同定の信頼のしくみ",
      "AI・市民・任された確認者・運営を混ぜずに扱うためのしくみです。なぜそうしているか、どうやって任された人の候補になるか、どこまでが研究・公開用途なのかを公開します。",
      `${FL_CSS}<div class="fl">
      <section class="fl-sec">
        <div class="fl-label">このページの目的</div>
        <h2 class="fl-h2">同定の速さより、信頼の由来を残す。</h2>
        <p class="fl-lead">ikimon は「AI がそう言った」「みんながそう思った」だけで研究・公開用途に進めない設計にしています。理由は、どの分類群で、誰が、どの根拠で任せられているかを追えないと、公開後の信頼が崩れるからです。</p>
        <div class="fl-trust">
          <strong>基本方針</strong>
          AI と市民同定は候補を広げる層、任された人の確認は公開前の確度を担保する層、運営は制度全体の監査を担う層として分けます。
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">なぜ分けるか</div>
        <h2 class="fl-h2">AI と市民同定だけでは、研究レベルにしない。</h2>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>AI は候補を出す役で、責任を持つ主体ではない</h3>
              <p>AI は方向性を示せますが、「この分類群の見分けは任せられる」と社会的に引き受ける主体ではありません。だから研究・公開用途の根拠に単独では使いません。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>市民同定は価値があるが、最終公開の代替ではない</h3>
              <p>市民同定は、候補を絞る・見分け方を学ぶ・確認の優先順位を上げるために重要です。ただし「誰がこの分類群を引き受けたか」が曖昧なまま研究扱いにすると、誤同定時の説明責任が弱くなります。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>公開するには「どこからの情報か」を残す必要がある</h3>
              <p>あとで「なぜこの観察をここまで上げたのか」を追えることが必要です。ikimon では確認時の権限スナップショットと監査ログを残し、後からしくみの外側に逃げないようにします。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">scope 設計</div>
        <h2 class="fl-h2">確認権限は、全体ではなく分類群ごとに切る。</h2>
        <p class="fl-body">「専門家だから全部任せる」ではなく、「タンポポ属なら任せられる」「この科なら見られる」という分類群の範囲で権限を持たせます。これにより、画面に見える確認待ちの一覧と、実際に承認できる範囲が一致します。</p>
        <div class="fl-callout">
          <strong>なぜ分類群ごとなのか</strong>
          <p>見分け方の熟達は分類群ごとに偏るからです。鳥に強い人がキノコも同じ精度で見られるとは限りません。ikimon は最初からその現実に合わせます。</p>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">役割分担</div>
        <h2 class="fl-h2">AI / 市民 / 任された人 / 運営の 4 層</h2>
        <div class="fl-roles">
          <article class="fl-role"><span class="fl-role-icon">🛰️</span><h3>AI</h3><p>候補と見分けのポイントを返す層。</p><span class="fl-role-tag">確定はしない</span></article>
          <article class="fl-role"><span class="fl-role-icon">🧭</span><h3>市民同定者</h3><p>候補を絞り、証拠を持ち寄る層。</p><span class="fl-role-tag">公開前の学習と絞り込み</span></article>
          <article class="fl-role"><span class="fl-role-icon">🔬</span><h3>任された確認者</h3><p>自分の担当する分類群で承認し、専門確認を付与する層。</p><span class="fl-role-tag">担当範囲内だけ任せる</span></article>
          <article class="fl-role"><span class="fl-role-icon">🛠️</span><h3>運営</h3><p>しくみの運営、権限の付与・取り消し、監査、例外処理を担う層。</p><span class="fl-role-tag">しくみを閉じずに追跡する</span></article>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">境界条件</div>
        <h2 class="fl-h2">研究レベルと公開主張は同じではない。</h2>
        <div class="fl-tiers">
          <div class="fl-tier fl-tier-1">
            <div><div class="fl-tier-name">AI / 市民同定</div><div class="fl-tier-meaning">候補層</div></div>
            <div><div class="fl-tier-col-label">できること</div><div class="fl-tier-col-body">候補提示、絞り込み、追加観察の誘導、確認待ちの優先度上げ</div></div>
            <div><div class="fl-tier-col-label">できないこと</div><div class="fl-tier-col-no">単独で研究・公開用途にすること</div></div>
          </div>
          <div class="fl-tier fl-tier-3">
            <div><div class="fl-tier-name">任された人の確認</div><div class="fl-tier-meaning">専門確認済み</div></div>
            <div><div class="fl-tier-col-label">できること</div><div class="fl-tier-col-body">専門確認レーンで承認し、分類群の担当範囲に基づく責任ある確認を残す</div></div>
            <div><div class="fl-tier-col-label">できないこと</div><div class="fl-tier-col-no">証拠不足のまま自動で研究公開すること</div></div>
          </div>
          <div class="fl-tier fl-tier-4">
            <div><div class="fl-tier-name">公開前提 / 研究候補</div><div class="fl-tier-meaning">最終公開候補</div></div>
            <div><div class="fl-tier-col-label">条件</div><div class="fl-tier-col-body">公開前提のレーンで、任された人の承認または運営の明示的な承認が入り、媒体条件も満たすこと</div></div>
            <div><div class="fl-tier-col-label">補足</div><div class="fl-tier-col-no">証拠が弱ければ、専門確認済みのまま止める</div></div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">authority 候補になる道</div>
        <h2 class="fl-h2">市民が専門候補になるには、証跡を積み上げる。</h2>
        <p class="fl-body">観察会、ウェビナー、推薦論文、図鑑・雑誌の保有などは、どれも authority 候補になるための根拠になります。ただし、根拠があるだけで自動資格化はしません。どの分類群まで任せられるかを、既存 authority 保有者や運営が判断します。</p>
        <div class="fl-steps">
          <div class="fl-step"><div class="fl-step-num"><div class="fl-step-num-badge">1</div><div class="fl-step-num-line"></div></div><div class="fl-step-content"><h3>自己申告 or 運営登録</h3><p>本人が self claim を出すか、運営が観察会・読書証跡から pending recommendation を登録します。</p></div></div>
          <div class="fl-step"><div class="fl-step-num"><div class="fl-step-num-badge">2</div><div class="fl-step-num-line"></div></div><div class="fl-step-content"><h3>証跡を添付</h3><p>観察会、ウェビナー、論文、図鑑/雑誌などを structured evidence として積みます。</p></div></div>
          <div class="fl-step"><div class="fl-step-num"><div class="fl-step-num-badge">3</div><div class="fl-step-num-line"></div></div><div class="fl-step-content"><h3>same-scope reviewer が grant</h3><p>同じ分類群 scope の active authority 保有者が、任せられると判断したときだけ authority に変わります。</p></div></div>
        </div>
        <div class="fl-info">
          <strong>重要</strong>
          <p>雑誌や図鑑の保有、論文読了はそれだけで自動資格化しません。あくまで「何をベースに見分けているか」の根拠として積み上げます。将来的にアフィリエイト導線を付けても、この原則は変えません。</p>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">運営と監査</div>
        <h2 class="fl-h2">grant / revoke / update は監査される。</h2>
        <p class="fl-body">authority は裏で audit を残します。誰が誰に、どの scope を、どの根拠で付けたかを運営が追えるようにし、閉じたブラックボックスにしません。</p>
        <ul class="fl-benefits">
          <li>Admin / Analyst は manual grant / revoke と reject を持つ</li>
          <li>review 時には authority snapshot を保存し、後で権限が変わっても当時の判断根拠を残す</li>
          <li>監査ログは公開せず、運営面で追跡する</li>
        </ul>
      </section>

      <section class="fl-sec">
        <div class="fl-label">次の一歩</div>
        <h2 class="fl-h2">制度を読んだあと、何をすればいいか</h2>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/authority/recommendations"))}">authority 候補を申請する</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/field-loop"))}">Field Loop に戻る</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/specialist/recommendations"))}">推薦待ちを見る</a>
        </div>
      </section>
      </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
    );
  });

  app.get("/learn/identification-basics", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Identification Basics | ikimon",
      "Learn",
      "その場で名前が出なくて、当然です。",
      "ikimon では、観察を残す・AI が候補を返す・専門家が検証する、この3つを別の役割として分けて設計しています。混ぜないことが、同定の基本です。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">3つの前提</div>
        <h2 class="fl-h2">名前が分からなくても、観察は始められる。</h2>
        <p class="fl-lead">ikimon は「その場で正解を断言する」ことを求めません。観察を残し、候補を広げ、あとから確度を上げていく設計です。</p>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>種まで絞り込めないとき</h3>
              <p>写真の角度、部位の写っていない部分、幼体や季節による姿の違い、近い仲間との共通点が多い種では、属までで止める方が正確なことがあります。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>AI が返す候補の役割</h3>
              <p>AI は「正解」ではなく、候補の種・見分けるポイント・次に撮りたい部位を返します。最後に決めるのは観察者ご自身です。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>専門家によるレビュー</h3>
              <p>より厳密な同定や確認は、専門家向けの別画面で扱います。日常の観察とは分けているので、一般のご利用では気にする必要はありません。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">確度の上げ方</div>
        <h2 class="fl-h2">撮り直しで候補が絞れる</h2>
        <p class="fl-body">葉の裏、翅の脈、腹部、花の付け根、全景と接写の組み合わせなど、決め手になる部位を追加すると候補を絞りやすくなります。</p>
        <div class="fl-info">
          <strong>ikimon が返したいもの</strong>
          <p>種名だけでなく、まだ断定しない理由、似た候補、次に何を撮れば進むか、そしてその場所にまた行きたくなる理由。</p>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">最初の一歩</div>
        <h2 class="fl-h2">まず 1 件、記録してみる</h2>
        <p class="fl-body">完璧な同定でなくて構いません。観察と再訪を重ねることで、少しずつ見えるものが変わっていきます。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">観察を記録する</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench"))}">専門家向け画面を開く</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      "その場で名前が出なくて、<br>当然です。",
    );
  });

  app.get("/learn/methodology", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Methodology | ikimon",
      "Learn",
      "ikimon が何をどう扱うか、全部見せます。",
      "データの取り扱い、希少種の位置保護、モニタリング参考指標の考え方を公開しています。数値は環境の価値を断言するためではなく、継続観察の対話をするために置いています。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">データの扱い方</div>
        <h2 class="fl-h2">3つの基本方針</h2>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>Data policy</h3>
              <p>ライブスキャン中の映像は AI 判定後に自動削除し、環境音は鳥類判定のためにのみ使います。投稿された観察は将来の open biodiversity data 連携も見据えています。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>Location handling</h3>
              <p>GPS は生態学的な精度を保ちつつ、希少種はマスク処理し、公開権限に応じて位置精度を制御します。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>MRI（モニタリング参考インデックス）</h3>
              <p>MRI は種の多様性、保全価値、データ信頼性、分類群カバー率、調査継続性の 5 軸を見る参考指標で、良し悪しの断定ではありません。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">指標の詳細</div>
        <h2 class="fl-h2">5 軸評価モデル</h2>
        <p class="fl-body">種の多様性 30%、保全価値 25%、データ信頼性 20%、分類群カバー率 15%、調査継続性 10% を掛け合わせて経時変化を見ます。</p>
        <div class="fl-callout">
          <strong>観測空白と不在証拠</strong>
          <p>地図でまず見えるのは「未観測」や「観測薄い」領域だと考えています。「いない」に近い判断をするには、時期・時間帯・探索努力を含む sampling effort と、より高い証拠条件が必要だと言われています。</p>
        </div>
        <div class="fl-2col">
          <div class="fl-card">
            <h3>Open science stance</h3>
            <p>市民科学データはブラックボックスの都合で閉じず、条件と限界を公開したうえで future archive として残します。</p>
          </div>
          <div class="fl-card">
            <h3>Business / public との関係</h3>
            <p>企業や自治体にとっても、指標は報告のためだけでなく、場所ごとの変化を見返す共通言語として使います。</p>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">連携</div>
        <h2 class="fl-h2">組織での活用</h2>
        <p class="fl-body">研究・教育・保全の現場で ikimon の観察インフラを活用したい場合は、法人向けページからご相談ください。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/for-business"))}">For business</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/field-loop"))}">Field Loop を読む</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      "ikimonが何をどう扱うか、<br>全部見せます。",
    );
  });

  app.get("/learn/updates", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Updates | ikimon",
      "Learn",
      "少しずつ、確実に。",
      "歩いて・見つけて・書き残す体験が楽になる方向へ、ikimon は小さく進化してきました。主な節目を時系列で残しています。",
      `${FL_CSS}<div class="fl">

      <section class="fl-sec">
        <div class="fl-label">リリース履歴</div>
        <h2 class="fl-h2">小さく、着実に。</h2>
        <p class="fl-lead">機能追加の履歴ではなく、「自分の学びが育つ」「みんなの観察が AI を育てる」「地域の記録として積み上がる」の 3 つの方向に近づいた順序として読んでいただけると幸いです。</p>
        <div class="fl-steps">
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.10.1</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-04-08 — フィールドノート中心の導線</h3>
              <p>v2 の public 面を、フィールドノート中心の導線へ寄せました。主役を record / notes / revisit に固定しています。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.10.0</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-04 — Map lane 整備</h3>
              <p>フィールドスキャンで、次に歩く場所を考えるための map lane を整備しました。探索はノートに戻るための補助線として扱います。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.9.0</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03-31 — AIレンズ入口</h3>
              <p>AIレンズの入口を追加しました。現時点では完成機能としてではなく、将来の walking-time guide へつながる入口として置いています。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.8.x</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03 — 証拠保存の強化</h3>
              <p>写真や音を含む観察の証拠を、あとから見返せる形で残す方向を強めました。入力の幅を広げるための基盤整備です。</p>
            </div>
          </div>
          <div class="fl-step">
            <div class="fl-step-num">
              <div class="fl-step-num-badge" style="font-size:9px;width:42px;border-radius:10px;"><span class="fl-step-badge-text">v0.7.x</span></div>
              <div class="fl-step-num-line"></div>
            </div>
            <div class="fl-step-content">
              <h3>2026-03 — 場所・再訪・記録の軸</h3>
              <p>場所・再訪・個人の記録を中心に据えるための初期導線を整えました。探索系の機能は、この軸を支える位置に置いています。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">今の体験を確かめる</div>
        <h2 class="fl-h2">実際に触ってみる</h2>
        <p class="fl-body">トップページから、記録・みつける・ホーム・観察の詳細まで、今の体験を一通り確認できます。</p>
        <div class="fl-cta-actions">
          <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ</a>
          <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/record"))}">観察を記録する</a>
        </div>
      </section>

    </div>`,
      "Learn",
      `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
    );
  });

  app.get("/faq", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "よくある質問 | ikimon" : "FAQ | ikimon",
      "FAQ",
      "よくある質問",
      "はじめての方、地元の人の使い方、旅先での使い方、同定の信頼、AI の役割、組織導入、データと公開範囲について、ikimon の前提を整理しています。",
      `<section class="section">
        <div class="section-header"><h2>はじめての方へ</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">ikimon とは何ですか？</summary><p class="fl-faq-a">ikimon は、地元の人が近くの自然との関係を深めるためのサービスであり、外から来る人に地方を訪れる理由と再訪理由を返すサービスでもあります。AI は候補とヒントを返しますが、名前や公開用途の判定を自動で確定するサービスではありません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">登録や費用はかかりますか？</summary><p class="fl-faq-a">個人利用は登録不要・無料です。閲覧・記録・マップ・AI ヒントなどの基本導線をそのまま使えます。企業・自治体との連携は、専用の業務画面を先に約束するのではなく、地域で場所を見守る取り組みや地域連携の相談から始めます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">スマートフォンだけで使えますか？</summary><p class="fl-faq-a">はい。ブラウザだけで完結します。アプリのダウンロードは不要です。iPhone（Safari）・Android（Chrome）でホーム画面に追加すると、アプリのように使えます。山や森など電波が弱い場所では、写真と記録を端末に保存し、電波が戻ったら自動送信されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">子どもでも使えますか？</summary><p class="fl-faq-a">使えます。13 歳未満のお子さんは保護者の同意・見守りのもとでご利用ください。Google アカウントを使ってログインするため、Google の年齢制限ポリシーが適用されます。学校でのフィールドワーク・環境教育にも活用いただけます。教育目的での利用相談は contact@ikimon.life まで。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>記録について</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">名前がわからなくても記録できますか？</summary><p class="fl-faq-a">できます。場所・日時・写真だけでも記録になります。その場の 1 枚として残してもいいし、あとで比べたい観察はどれだけ歩いたか・手順・範囲を付けて残せます。名前は空欄のままでも構いません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">どんな写真を撮ればいいですか？</summary><p class="fl-faq-a">「全体像」「特徴部分のアップ」「生息環境」の 3 枚が理想です。鳥なら体の模様・くちばし、昆虫なら翅の模様・触角、植物なら花・葉・茎がポイント。1 枚だけでも記録になります。定規や手を添えてサイズ感を示すと同定しやすくなります。暗い場所ではフラッシュより自然光が有効です。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">過去の写真も投稿できますか？</summary><p class="fl-faq-a">できます。EXIF 情報（撮影日時・GPS 座標）が残っている写真なら、日時と場所が自動入力されます。情報が消えている写真でも、おおよその日時と場所をメモ欄で補足すれば有用なデータになります。自分が撮影した写真に限ります（他人の写真の転載は禁止です）。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">私の 1 件の記録に意味はありますか？</summary><p class="fl-faq-a">あります。地元の人にとっては場所の記憶の 1 行になり、旅で来た人にとっては次にまた来る理由の種になります。ただし、1 件だけで増減や不在まで強く言うことはしません。まずは後から読み返せる観察として残すことを優先します。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">こんな投稿は避けてください</summary><p class="fl-faq-a">AI 生成画像・他人が撮影した写真・生き物が写っていない写真・同じペットの繰り返し投稿・虚偽の位置情報や日時は避けてください。「自分が見て撮った・生き物が写っている・生き物を傷つけていない」の 3 点がクリアなら、名前がわからなくてもピントが甘くても投稿 OK です。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>AI と同定について</h2></div>
        <div class="card" style="margin-bottom:16px"><div class="card-body"><strong>同定の信頼のしくみを詳しく読む</strong><p style="margin:10px 0 0;color:#4b5563;line-height:1.8">なぜ AI とみんなの同定だけでは研究・公開用途にしないのか、なぜ任された人を分類群ごとに置くのか、推薦と監査を含めて 1 ページにまとめています。</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/learn/authority-policy"))}">しくみの説明を見る</a></div></div></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">AI は名前を自動で確定しますか？</summary><p class="fl-faq-a">しません。AI が返すのは候補と見分けのヒントです。AI と市民同定は候補層として扱い、研究・公開用途に進めるには、分類群ごとに任された人の確認か、運営の明示的な判断が必要です。しくみの全体像は「同定の信頼」ページで公開しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿後に表示される「観察のヒント」とは何ですか？</summary><p class="fl-faq-a">投稿後に写真・場所・季節をもとに AI が自動生成するメモです。「いまはここまで絞れそう」「見分けのポイント」「次に確認すると良いこと」を示します。コミュニティ同定の票にはなりません。名前を断定するものではなく、あくまでヒントとして参考にしてください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">間違った名前を付けてしまったらどうなりますか？</summary><p class="fl-faq-a">いつでも修正できます。間違いはコミュニティが一緒に修正してくれます。「モンシロチョウだと思ったらスジグロシロチョウだった」——この体験が観察力を磨きます。初心者もベテランも学びの途中です。間違いを恐れずに挑戦する姿勢をコミュニティは応援しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">「研究グレード」とは何ですか？</summary><p class="fl-faq-a">ikimon では、AI 候補や市民同定だけで研究レベルに上げません。写真・日時・位置などの媒体条件に加え、公開前提のレーンで、任された人の確認か運営判断が入った観察だけが研究・公開候補になります。証拠不足ならそのまま止めて、研究公開とは分けます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">AI の提案はどのくらい正確ですか？</summary><p class="fl-faq-a">「参考情報」として設計しています。得意不得意はありますが、そもそも公開前提の主張の根拠に単独では使いません。AI は方向性を示し、人の確認と、任された人の確認が公開前の確度を支えます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q"><code>いない</code> や <code>増えた</code> は分かりますか？</summary><p class="fl-faq-a">条件付きです。ikimon では「まだ見ていない」と「不在」を混ぜません。どれだけ歩いたか・手順・範囲を残していないデータに対して、サービス側が「いない」「増えた」を強く言うことはしません。「見つからなかった」も、公開時点では手順の注記としてだけ扱います。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿データが AI の学習に使われますか？</summary><p class="fl-faq-a">第三者の AI 企業には一切提供しません。AI クローラーによるスクレイピングも技術的にブロックしています。将来的に ikimon 自身のサービス改善（AI 同定精度の向上）に活用する可能性がありますが、その場合も外部に流出することはありません。データの主権はユーザーとikimon コミュニティにあります。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>企業・自治体向け</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">法人向けは個人利用と何が違いますか？</summary><p class="fl-faq-a">公開時点での違いは、深い専用の業務画面を先に約束するより、地域や組織で「場所を見守る取り組み」を立ち上げる相談導線があることです。観察会、地域導線、記録の続け方、任された人の確認とのつなぎ方を一緒に設計できます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">地域側にはどう説明すればよいですか？</summary><p class="fl-faq-a">「ikimon は訪問理由と再訪理由を作る器であり、地域の自然や場所の文脈を、場所を見守る取り組みに変える入口です」と説明するのが基本です。観光万能アプリでも、研究ダッシュボード万能アプリでもない、と最初に伝える方が誤解が少なくなります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">費用はどのくらいかかりますか？</summary><p class="fl-faq-a">個人利用は無料です。法人・自治体連携は、対象場所、初回導線、継続体制の重さによって変わるため、まず相談ベースで始めます。公開時点では、固定料金より導線設計を優先しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自社や地域の場所だけで始められますか？</summary><p class="fl-faq-a">始められます。まずは対象の場所を決め、そこで最初の記録と再訪理由を立ち上げるところから始めます。境界や専用の業務画面を整えるのは、そのサイクルが回り始めてからで構いません。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>データ・プライバシー</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">位置情報は公開されますか？</summary><p class="fl-faq-a">絶滅危惧種（環境省・都道府県レッドリスト該当種）の位置情報は自動でマスキングされ、詳細な場所が特定されない精度に落とされます。通常の記録も住所が特定されるような表示はしません。写真の EXIF 情報（GPS 座標）はアップロード時に自動除去されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自分のデータを削除できますか？</summary><p class="fl-faq-a">できます。各観察記録の詳細ページからいつでも削除できます。削除するとデータベースから完全に除去されます（復元不可）。アカウント全体の削除は contact@ikimon.life までご連絡ください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">データは他のプラットフォームと共有されますか？</summary><p class="fl-faq-a">SNS や広告目的での共有はしません。将来的なオープンな生物多様性データ連携は検討していますが、任された人の確認や媒体条件など、公開に足る条件を満たしたものだけを対象にします。条件を満たさないデータを、増減や不在の根拠として外に押し出すことはしません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿データのライセンスはどうなりますか？</summary><p class="fl-faq-a">投稿時に CC0・CC BY・CC BY-NC の 3 種類から選べます。デフォルトは CC BY（表示・改変・商用利用可）です。世界中の研究者がデータを活用できる形にするには CC BY が最適です。写真の著作権は投稿者に帰属し、ikimon が著作権を取得することはありません。</p></details>
        </div>
      </section>`,
      "Learn",
    );
  });

  app.get("/privacy", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Privacy Policy | ikimon",
      "Trust",
      "プライバシーポリシー",
      "ikimon は、記録を長く残すためにデータを扱います。同時に、希少種や個人の行動が露出しすぎないよう公開範囲を分けます。",
      rows([
        { title: "お預かりするもの", body: "アカウント情報、観察記録、写真・音声などの証拠、サービス運用に必要なログ。" },
        { title: "公開範囲の考え方", body: "観察は残しますが、希少種や保護上配慮が必要な位置は公開精度を下げる、あるいは非公開にします。" },
        { title: "使い道", body: "観察履歴の表示、再訪しやすいノートの提供、同定補助、将来の長期アーカイブ整備、安全運用のため。" },
        { title: "個別のお問い合わせ", body: "詳細な取り扱い方針や削除依頼は、お問い合わせページから受け付けています。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
      ]),
      "Learn",
    );
  });

  app.get("/terms", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Terms | ikimon",
      "Trust",
      "利用規約",
      "安全に記録を残し、他者や生きものへの不利益を避けながら使っていただくための要点をまとめています。",
      rows([
        { title: "投稿についての確認", body: "写真・音声・メモの権利を持つ内容のみ投稿してください。公開範囲と位置情報の扱いも投稿時に確認いただきます。" },
        { title: "避けてほしい行為", body: "なりすまし、不正アクセス、他者への迷惑行為、希少種や保護上配慮が必要な位置の不用意な公開は禁止です。" },
        { title: "AI と同定の扱い", body: "AI の候補は補助です。公開面での断定は、観察証拠やレビューの状態と切り分けて扱います。" },
        { title: "運用変更について", body: "改善に伴い画面や URL が変わることがありますが、既存の記録は移行し、読み返せる状態の維持を優先します。" },
      ]),
      "Learn",
    );
  });

  app.get("/contact", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    const formHtml = renderContactForm(basePath);
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "Contact | ikimon",
      "Contact",
      "お問い合わせ",
      "ikimon に関するご質問や導入相談を受け付けています。個人利用と組織導入で窓口を分けています。",
      formHtml + rows([
        {
          title: "法人・団体のお問い合わせ",
          body: "企業・自治体・学校で、自然共生サイトや観察導線を始めたい場合はこちらの導線もあります。",
          actionHref: withBasePath(basePath, "/for-business/apply"),
          actionLabel: "法人のお問い合わせ",
        },
        {
          title: "導入の考え方を見る",
          body: "料金より先に、どういう場所でどう始めるかを確認できます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: "導入を見る",
        },
      ]),
      "Learn",
    );
  });

  app.post<{ Body: { category?: string; name?: string; email?: string; organization?: string; message?: string; sourceUrl?: string } }>(
    "/contact",
    async (_request, reply) => {
      // フォームの action が /contact を指していても、クライアントの JS が fetch で /api/v1/contact/submit を使う。
      // JS 無効環境のフォールバックとして、/contact への POST はエラーを返す（fetch を使うよう促す）。
      reply.code(400);
      reply.type("application/json");
      return { ok: false, error: "use_api_endpoint", hint: "POST /api/v1/contact/submit" };
    },
  );

  app.get("/for-business", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      lang === "ja" ? "ikimon for Business — 訪問理由と再訪理由を育てる地域連携 | ikimon" : "For Business | ikimon",
      lang === "ja" ? "法人向け" : "For Business",
      "訪問理由と再訪理由を育てる、地域連携の入口。",
      "学校・自治体・企業・地域事業者に対して、ikimon は専用の業務画面を先に約束するのではなく、地域で場所を見守る取り組みと、繰り返せる観察のサイクルを立ち上げる導線として公開します。",
      cards([
        {
          title: "まずは place を立ち上げる",
          body: "はじめに必要なのは分析より、対象となる場所で最初の訪問理由と再訪導線を作ることです。",
          href: withBasePath(basePath, "/for-business/demo"),
          label: lang === "ja" ? "デモを見る" : "Demo",
        },
        {
          title: "想定する連携先",
          body: "自治体、学校、企業、NPO、地域事業者など、地域の自然や場所の文脈を訪問体験に変えたい組織を対象にしています。",
        },
        {
          title: "段階的に始める",
          body: "公開時点では、正しい入口と説明責任を優先します。重い専用運用は後続フェーズで追加します。",
          href: withBasePath(basePath, "/for-business/pricing"),
          label: lang === "ja" ? "料金を見る" : "Pricing",
        },
        {
          title: "場所を見守る取り組みを作る",
          body: "初回の観察会や現地導線を通じて、その場所にまた来る理由を残します。分析より先に、現場でサイクルが回ることを優先します。",
        },
        {
          title: "自然資本の取り組みの入口",
          body: "福祉的な訴求ではなく、地域で場所を見守る取り組みや、自然資本の取り組みの入口として扱います。報告や分析は、その後に乗せます。",
        },
        {
          title: "よくある質問",
          body: "導入前に確認したい点を先に整理できます。",
          href: withBasePath(basePath, "/faq"),
          label: "FAQ",
        },
        {
          title: "導入相談と共同実証",
          body: "対象場所、初回の観察導線、継続体制まで含めて相談できます。",
          href: withBasePath(basePath, "/for-business/apply"),
          label: lang === "ja" ? "相談する" : "Apply",
        },
      ]) + rows([
        {
          title: "なぜ専用の業務画面を先に約束しないのか",
          body: "公開時点の完成ラインは、地域側が「訪問理由と再訪理由を作る器」だと理解できることです。まずは入口とサイクルを正しく立ち上げます。",
          actionHref: withBasePath(basePath, "/for-business/pricing"),
          actionLabel: lang === "ja" ? "詳しく見る" : "Learn more",
        },
      ]),
      "For Business",
      `<a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/contact"))}">問い合わせる</a>`,
    );
  });

  app.get("/for-business/pricing", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Pricing | ikimon",
      "For Business",
      "連携の始め方",
      "最初から重い契約を結ぶより、まずは place 単位で訪問理由と再訪導線を立ち上げ、必要な運用だけを段階的に足す方針です。",
      rows([
        { title: "まず入口を合わせる", body: "公開時点では、地域や組織が「場所を見守る取り組み」「地域連携」「自然資本の取り組み」のどこで使うかを揃えるところから始めます。" },
        { title: "必要になったら追加する", body: "継続運用、出力、専門家の確認との連携などは、現場でサイクルが回り始めてから段階的に追加します。" },
        { title: "ご相談", body: "対象場所、初回観察会、無償提供の適用可否などは、下記から相談できます。", actionHref: withBasePath(basePath, "/for-business/apply"), actionLabel: "お問い合わせ" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/demo", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Demo | ikimon",
      "For Business",
      "実際の画面で、訪問理由と再訪導線を確認する",
      "営業用の別画面ではなく、実際の public lane を見ていただきます。どのように place を立ち上げ、訪問理由と再訪理由を返すかを把握できます。",
      rows([
        { title: "場所の広がりを見る", body: "どの場所に観察が積み重なっているかだけでなく、なぜ今そこへ行くかの読み方を確認できます。", actionHref: withBasePath(basePath, "/map"), actionLabel: "マップへ" },
        { title: "最初の 1 件を記録する", body: "その場の 1 枚と、比較したい観察を使い分けて、場所・時刻・写真を「場所の記憶」にする流れを確認できます。", actionHref: withBasePath(basePath, "/record"), actionLabel: "記録画面へ" },
        { title: "運用 readiness を見る", body: "サービスの健全性と切替 readiness を確認できるページです。", actionHref: withBasePath(basePath, "/ops/readiness"), actionLabel: "運用状況へ" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/status", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Status | ikimon",
      "For Business",
      "サービスの状況",
      "ikimon の稼働だけでなく、切替 readiness、互換性、rollback 前提の運用準備を確認するためのページです。",
      rows([
        { title: "データの整合性", body: "legacy との比較、delta sync、read/write lane の整合、rehearsal 結果を確認しながら進めています。" },
        { title: "運用面の準備", body: "本番切替は near-ready の確認だけでなく、rollback 可能性と compatibility write を前提に管理しています。" },
        { title: "次の予定", body: "新しい画面へ順次切り替えますが、一定期間は rollback lane を残し、急な後戻りができる状態を維持します。" },
      ]),
      "For Business",
    );
  });

  app.get("/for-business/apply", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      lang,
      requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
      "For Business Apply | ikimon",
      "For Business",
      "法人・団体のお問い合わせ",
      "導入相談、共同実証、対象場所の選定、初回観察導線の設計などを受け付けています。個人利用と無料開始には申し込み不要です。",
      rows([
        { title: "お問い合わせの種類", body: "導入相談、共同実証、対象場所の整理、運用設計の相談など、近い内容をお知らせください。" },
        { title: "対象となる場所", body: "観察したい敷地、公園・緑地、拠点周辺など、まず立ち上げたい場所を教えてください。" },
        { title: "いま困っていること", body: "初回観察会の設計、継続者不足、報告導線、対象範囲の整理など、現状の課題を共有いただけると早いです。" },
        { title: "次のステップ", body: "ご連絡フォームをご用意するまで、下記の総合お問い合わせから受け付けております。", actionHref: withBasePath(basePath, "/contact"), actionLabel: "お問い合わせへ" },
      ]),
      "For Business",
    );
  });
}
