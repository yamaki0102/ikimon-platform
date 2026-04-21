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
      id: "what-this-field-achieved",
      label: "Chapter 1",
      title: "この領域は何を達成してきたか",
      lead: "生きものの記録を開くことは、単に投稿数を増やすことではありませんでした。誰が自然を見られるか、誰が記録に参加できるか、その前提そのものを広げてきた変化でした。",
      paragraphs: [
        "この領域は、市民が見たものを広く集めることで、専門家だけでは届かなかった空間と時間の解像度を押し広げてきました<sup>[1][2][3]</sup>。投稿の敷居が下がったことで、分布、季節性、初出、異変の兆しのような現象は、研究者が単独で取りに行くより先に共有されるようになりました。",
        "その価値は大きい。大量の観察は、研究や保全に資するだけでなく、自然を見る人を増やし、見ること自体を社会の基礎技能に戻しました<sup>[2][3]</sup>。生物記録は、専門家の専有物ではなく、参加可能な公共インフラへ近づいてきたと言えます。",
        "ただし、この領域は一枚岩ではありません。広域投稿型、共同同定型、構造化モニタリング型、AI補助型は、同じ『生きものを見る』でも、強い問いが違います。ikimon はその違いを隠さずに設計したいと考えています。",
      ],
      debates: [
        {
          title: "観察量と比較可能性",
          body: "量が増えるほど見えるものは増える。一方で、比較できることが自動で増えるわけではない。空間解像度に強い設計と、時系列比較に強い設計は、同じではありません。",
        },
      ],
    },
    {
      id: "what-digitalization-changed",
      label: "Chapter 2",
      title: "デジタル化で何が変わったか",
      lead: "デジタル化が変えたのは、投稿の速さだけではありません。記録、共有、フィードバック、再利用が一つの流れになったことです。",
      paragraphs: [
        "スマートフォン、位置情報、共有コメント、公開データ基盤、そして画像認識の進歩によって、生物記録は『詳しい人がノートに書くもの』から『その場で撮り、あとから共同で解像度を上げるもの』へ変わりました<sup>[2][10]</sup>。",
        "この変化で重要になったのは、unstructured と structured を二項対立で見るのでなく、連続体として扱うことです。自由投稿に近い入口も、checklist や protocol を持つ観察も、同じエコシステムの中に共存しうると整理されています<sup>[6]</sup>。",
        "AI も同じです。自動化は入口を下げますが、優れたプロダクトは『判定を肩代わりする』より『次に何を見るかを返す』方向で価値を出します<sup>[10][11]</sup>。ikimon が AI を copilot と呼ぶのは、この流れを踏まえているからです。",
      ],
      chips: ["広域投稿型", "共同同定型", "構造化モニタリング型", "AI補助型"],
    },
    {
      id: "what-gets-harder-at-scale",
      label: "Chapter 3",
      title: "量が増えるほど難しくなったこと",
      lead: "参加が広がるほど、データの価値が消えるわけではありません。むしろ、どの条件で読めるのかを、以前より丁寧に区別しなければならなくなります。",
      paragraphs: [
        "量が増えると、難しさも露わになります。観察は空間・時間・分類群・観察者に対して均質に集まりません<sup>[6][8]</sup>。よく見られる場所、見つけやすい種、休日の自然地、写真を撮りやすい対象に寄るのは、デジタル化した参加型記録の自然な帰結です。",
        "2026年の研究では、日常の延長で観察する人と、能動的に観察に出る人では、どこで何を記録するかがかなり違うことが示されました<sup>[8]</sup>。つまり、データの偏りは『参加者の多さ』だけでなく、『参加のされ方』からも生まれます。",
        "さらに、比較可能性は努力量の記録なしには立ち上がりません。いつ、どこで、どれだけ探したかが分からないままでは、blank はまず未観測であって、不在とは限りません<sup>[6][9]</sup>。2026年の recent synthesis も、グローバルな利用では data-generating process を理解し、空間・時間・観察者の異質性を前提に解釈すべきだと整理しています<sup>[12]</sup>。",
        "検証も同じで、投稿量が増えるほど、写真の質、証拠の厚み、レビュー負荷、説明責任の分配が中心課題になります<sup>[7]</sup>。量の問題は、最終的に trust の問題へ戻ってきます。",
      ],
      callout: {
        title: "blank と absence は別です",
        body: "見つかっていないことは、まず未観測や観測薄い領域を意味します。不在に近い主張には sampling effort と protocol が要ります。",
      },
      debates: [
        {
          title: "共同同定と説明責任",
          body: "多人数の同定は候補を絞るのに強い。しかし、公開主張には『誰がどの根拠で引き受けたか』という provenance が別途必要になります。",
        },
        {
          title: "観測空白と不在主張",
          body: "地図に点がないことは、まだ十分に見ていないことと区別しなければならない。absence を語る条件は、presence を語る条件より重いのです。",
        },
      ],
    },
    {
      id: "boundaries-after-ai",
      label: "Chapter 4",
      title: "AI が入口を下げたあと、むしろ重要になった境界",
      lead: "AI があると記録しやすくなります。だからこそ、どこまでが候補で、どこからが判断なのかを、プロダクト側が明示しなければなりません。",
      paragraphs: [
        "AI が入口を下げたあと、むしろ重要になったのは境界です。どこまでが suggestion で、どこからが review で、どこからが public claim なのか。この境界が曖昧だと、速さは出ても、学習と信頼が同時に痩せます<sup>[7][10][11]</sup>。",
        "自動識別アプリの研究は、この領域がすでに大衆的であることを示しています<sup>[10]</sup>。一方で、dialogic な設計では、人と AI が独立した視点を持ったまま協働することで、双方の精度と学習が伸びうることも示されました<sup>[11]</sup>。",
        "だから ikimon は、AI judge ではなく AI copilot を取ります。AI は候補提示と理解支援、community は知識の往復、authority は公開前の責任ある確認、public claim はその先のレーンです。段差を混ぜないことが、AI 時代の最低限の礼儀だと私たちは考えています。",
      ],
      debates: [
        {
          title: "AI自動化と学習機会",
          body: "入口を下げる AI は価値がある。ただし、答えだけを返す AI は観察者の視力を奪いやすい。ikimon は『何を見るべきか』を返す側に寄せます。",
        },
      ],
    },
    {
      id: "the-job-ikimon-takes",
      label: "Chapter 5",
      title: "ikimon が引き受ける別の仕事",
      lead: "ikimon が最適化したいのは、最大の広域データ基盤になることではありません。place と再訪と責任境界を、一つの体験にすることです。",
      paragraphs: [
        "ikimon が引き受けたいのは、最大の広域データ基盤になることではありません。私たちが深く作るのは、地元の人が同じ場所に戻り、place memory を積み上げる <code>place-first observatory</code> と、外から来る人に地方を訪れる理由と再訪理由を返す <code>regional entry service</code> です。",
        "この違いは UI の話だけではなく、データの意味の話でもあります。ikimon は quick capture と survey を分け、比べたい visit では effort、checklist、scope、revisit reason を残します。旅先の 1 枚も、その場限りの消費で終わらせず、次にまた来る hook に変えることを狙います。",
        "place が主語になると、記録は単なる点でなく、その場所に戻るための文脈になります。ここで重いのは、世界一広く集めることより、同じ場所をもう一度見に来たくなる構造です<sup>[4][5]</sup>。",
      ],
      callout: {
        title: "ikimon の重心",
        body: "place / revisit / protocol / authority を、公開面の主語として維持します。",
      },
      chips: ["place-first observatory", "regional entry service", "survey protocol", "authority-backed review"],
    },
    {
      id: "why-this-is-not-opposition",
      label: "Chapter 6",
      title: "既存アプローチと敵対しない理由",
      lead: "違うのは、態度ではなく担当する仕事です。広く集めることと、同じ場所へ戻る理由を作ることは、どちらも必要ですが、同じ設計ではありません。",
      paragraphs: [
        "この立場は、既存アプローチへの反論ではありません。広く集める仕事、共同で名前に近づく仕事、厳密な比較を作る仕事、学校や地域で継続的に測る仕事は、それぞれ必要です。",
        "ikimon が選んでいるのは、その中で『place と再訪と責任境界』を主役にすることです。広域収集に強い仕組みがあるからこそ、ikimon は地方の現場で、『次にここへ来る理由』と『同じ場所を見続ける意味』に集中できます。",
        "向いている問いが違う。だから敵対ではなく、分業です。私たちは、他の方式を否定するのでなく、自分たちがどこに責任を持つかを明示したいだけです。",
      ],
    },
    {
      id: "promises-and-non-promises",
      label: "Chapter 7",
      title: "ikimon が約束すること / まだ約束しないこと",
      lead: "このページの本当の目的は、思想紹介ではなく責任境界の公開です。できることより先に、言いすぎない線を見せます。",
      paragraphs: [
        "ikimon が約束するのは、観測を失わず、後から比較できる形で残すこと。AI を候補提示に留め、authority を visible にし、absence と trend を条件未達のまま言いすぎないことです。",
        "まだ約束しないのは、AI 単独の最終判定、条件未達データからの増減断言、protocol を持たない不在主張、あらゆる記録がそのまま研究品質になるという期待です。",
        "このページを長くしたのは、機能説明ではなく責任境界の説明が必要だと思っているからです。ikimon は『なんでもできる生物サービス』を目指さず、『この場所を、また見に来る理由を作る』ことを、はっきり選びます。",
      ],
      cards: [
        {
          title: "ikimon が約束すること",
          body: "place memory、旅先の 1 枚を再訪理由へ返すこと、survey では protocol を残すこと、authority-backed な trust lane を visible にすること。",
        },
        {
          title: "ikimon がまだ約束しないこと",
          body: "AI 単独の final truth、条件未達データからの absence / trend 主張、全記録の自動 research 化、何でもできる万能な生物プラットフォーム化。",
        },
      ],
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
    <section class="fl-sec" id="outline">
      <div class="fl-label">Outline</div>
      <h2 class="fl-h2">このページで扱うこと</h2>
      <p class="fl-lead">既存のやり方を名指しで批判するのではなく、生物記録サービスが何を達成し、どこで難しさを抱え、ikimon がどの仕事を引き受けるのかを、論文ベースで言葉にし直します。</p>
      <div class="fl-trust">
        <strong>このページの前提</strong>
        これは他の方式への反論ではなく、ikimon がどこに責任を持つかを公開するためのページです。広く集める仕事と、place memory を作る仕事は、敵対ではなく分業だと私たちは考えています。
      </div>
      ${renderFieldLoopOutline(sections)}
    </section>
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
    ${renderFieldLoopReferences("このページで参照している主要文献", references)}
    <section class="fl-sec">
      <div class="fl-label">Next</div>
      <h2 class="fl-h2">制度と方法論を続けて見る</h2>
      <p class="fl-body">このページは立ち位置の説明です。運用レベルの trust 制度は <code>Authority Policy</code>、データの扱いと非約束範囲は <code>Methodology</code> に分けています。</p>
      <div class="fl-cta-actions">
        <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">まずは観察を残す</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/authority-policy"))}">同定 trust 制度を見る</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">Methodology を読む</a>
      </div>
      <p class="fl-premise">明示する境界 — AI は候補提示と理解支援 / community support と authority-backed を混ぜない / blank と absence は分ける / trend は条件未達データに対して言いすぎない / ikimon は place と再訪に重心を置く</p>
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
        ? "ikimon は、地元の人がいつもの場所を育てる `place-first observatory` であり、外から来る人に地方を訪れる理由と再訪理由を返す `regional entry service` でもあります。広域収集の仕事と place memory の仕事は敵対ではなく、解く問いが違うと考えています。"
        : "ikimon is a place-first observatory for locals and a regional entry service that gives travelers reasons to visit and return.",
      cards([
        {
          title: "主役は local core",
          body: "いちばん深く作っているのは、その場所の近くで暮らし、同じ場所に戻り続ける人の体験です。place memory が積み上がる設計を中心にしています。",
        },
        {
          title: "旅先の 1 枚も、再訪理由に変える",
          body: "旅先で撮った偶発的な 1 枚を、その場限りの投稿で終わらせず、また来たい理由や近くの別 place に続く hook に変えることも重要な約束です。",
        },
        {
          title: "AI は copilot であって、審判ではない",
          body: "AI は候補提示と理解支援を担います。何を見ればいいかを絞るための役であり、名前を自動で確定する役ではありません。",
        },
        {
          title: "trust lane を分ける",
          body: "AI suggestion、Community support、Authority-backed、Public claim を混ぜません。public claim は authority-backed review を通る前提で扱います。",
        },
        {
          title: "断定より、証拠と protocol を残す",
          body: "quick capture と survey を分け、比べたい visit では effort / checklist / scope を残します。あとで読み返して比較できることを優先します。",
        },
        {
          title: "absence / trend は言いすぎない",
          body: "観測空白と不在を混ぜません。条件未達のデータに対して、`いない` や `増えた` をサービス側が強く言わない境界を守ります。",
        },
      ]) + rows([
        {
          title: "まずは quick capture か survey で 1 件残す",
          body: "名前が分からなくても始められます。近くの場所でも、旅先でも、まず 1 件を place memory に変えてください。",
          actionHref: withBasePath(basePath, "/record"),
          actionLabel: lang === "ja" ? "観察を記録する" : "Start recording",
        },
        {
          title: "trust と非約束範囲を確認する",
          body: "AI の役割、public claim 条件、absence / trend をまだ約束しない理由を FAQ で明示しています。",
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
          title: "同定 trust 制度",
          body: "なぜ AI と市民同定だけでは research/public claim にしないのか、なぜ authority を分類群ごとに切るのか、推薦と監査を含めて公開します。",
          actionHref: withBasePath(basePath, "/learn/authority-policy"),
          actionLabel: lang === "ja" ? "制度を見る" : "Policy",
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
    const pageTitle = lang === "ja" ? "なぜ ikimon はこの形を取るのか | ikimon" : "Why ikimon takes this shape | ikimon";
    const heroHeading = lang === "ja"
      ? "なぜ ikimon は、この形を取るのか。"
      : "Why ikimon takes this shape.";
    const heroLead = lang === "ja"
      ? "生物記録サービスはこの十数年で大きく進化しました。ikimon は、その流れを否定するのでなく、どの仕事を引き受け、どこで言いすぎないかを、論文と変遷を踏まえて公開します。"
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
      `<div class="note">${escapeHtml(lang === "ja" ? "これは他の方式への反論ではなく、ikimon の責任境界を公開するページです。" : "This page is about ikimon's responsibility boundary, not opposition.")}</div><a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">← ${lang === "ja" ? "解説一覧" : "Learn"}</a>`,
      lang === "ja" ? "なぜ ikimon は、<br>この形を取るのか。" : "Why ikimon takes<br>this shape.",
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
      "ikimon の同定 trust 制度",
      "AI・市民・authority-backed reviewer・運営を混ぜずに扱うための制度です。なぜそうしているか、どうやって authority 候補になるか、どこまでが research/public claim なのかを公開します。",
      `${FL_CSS}<div class="fl">
      <section class="fl-sec">
        <div class="fl-label">このページの目的</div>
        <h2 class="fl-h2">同定の速さより、信頼の由来を残す。</h2>
        <p class="fl-lead">ikimon は「AI がそう言った」「みんながそう思った」だけで research/public claim に進めない設計にしています。理由は、どの分類群で、誰が、どの根拠で任せられているかを追えないと、公開後の信頼が崩れるからです。</p>
        <div class="fl-trust">
          <strong>基本方針</strong>
          AI と市民同定は候補を広げる層、authority-backed review は公開前の確度を担保する層、Admin / Analyst は制度運営と監査を担う層として分けます。
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">なぜ分けるか</div>
        <h2 class="fl-h2">AI と市民同定だけでは、研究レベルにしない。</h2>
        <div class="fl-reasons">
          <div class="fl-reason">
            <div class="fl-reason-num">01</div>
            <div class="fl-reason-body">
              <h3>AI は候補提示であって、責任主体ではない</h3>
              <p>AI は方向性を示せますが、「この分類群の見分けは任せられる」と社会的に引き受ける主体ではありません。だから research/public claim の根拠に単独では使いません。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">02</div>
            <div class="fl-reason-body">
              <h3>市民同定は価値があるが、最終公開の代替ではない</h3>
              <p>市民同定は、候補を絞る・見分け方を学ぶ・レビュー優先順位を上げるために重要です。ただし「誰がこの分類群を引き受けたか」が曖昧なまま研究扱いにすると、誤同定時の説明責任が弱くなります。</p>
            </div>
          </div>
          <div class="fl-reason">
            <div class="fl-reason-num">03</div>
            <div class="fl-reason-body">
              <h3>公開主張には provenance が要る</h3>
              <p>あとで「なぜこの観察をここまで上げたのか」を追えることが必要です。ikimon では review 時の authority snapshot と監査ログを残し、後から制度の外側に逃げないようにします。</p>
            </div>
          </div>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">scope 設計</div>
        <h2 class="fl-h2">authority を global role ではなく、分類群ごとに切る。</h2>
        <p class="fl-body">「専門家だから全部任せる」ではなく、「タンポポ属なら任せられる」「この科なら見られる」という分類群スコープで権限を持たせます。これにより、UI に見える queue と、実際に approve できる範囲が一致します。</p>
        <div class="fl-callout">
          <strong>なぜ taxon scope なのか</strong>
          <p>見分け方の熟達は分類群ごとに偏るからです。鳥に強い人がキノコも同じ精度で見られるとは限りません。ikimon は最初からその現実に合わせます。</p>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">役割分担</div>
        <h2 class="fl-h2">AI / 市民 / authority / 運営の4層</h2>
        <div class="fl-roles">
          <article class="fl-role"><span class="fl-role-icon">🛰️</span><h3>AI</h3><p>候補と見分けのポイントを返す層。</p><span class="fl-role-tag">確定はしない</span></article>
          <article class="fl-role"><span class="fl-role-icon">🧭</span><h3>市民同定者</h3><p>候補を絞り、証拠を持ち寄る層。</p><span class="fl-role-tag">公開前の学習と絞り込み</span></article>
          <article class="fl-role"><span class="fl-role-icon">🔬</span><h3>Authority-backed reviewer</h3><p>自分の分類群 scope で approve し、専門確認を付与する層。</p><span class="fl-role-tag">scope 内だけ任せる</span></article>
          <article class="fl-role"><span class="fl-role-icon">🛠️</span><h3>Admin / Analyst</h3><p>制度の運営、manual grant/revoke、監査、例外処理を担う層。</p><span class="fl-role-tag">制度を閉じずに追跡する</span></article>
        </div>
      </section>

      <section class="fl-sec">
        <div class="fl-label">境界条件</div>
        <h2 class="fl-h2">研究レベルと公開主張は同じではない。</h2>
        <div class="fl-tiers">
          <div class="fl-tier fl-tier-1">
            <div><div class="fl-tier-name">AI / 市民同定</div><div class="fl-tier-meaning">候補層</div></div>
            <div><div class="fl-tier-col-label">できること</div><div class="fl-tier-col-body">候補提示、絞り込み、追加観察の誘導、queue の優先度上げ</div></div>
            <div><div class="fl-tier-col-label">できないこと</div><div class="fl-tier-col-no">単独で research/public claim 化</div></div>
          </div>
          <div class="fl-tier fl-tier-3">
            <div><div class="fl-tier-name">Authority-backed review</div><div class="fl-tier-meaning">専門確認済み</div></div>
            <div><div class="fl-tier-col-label">できること</div><div class="fl-tier-col-body">専門確認レーンで approve し、分類群 scope に基づく責任ある review を残す</div></div>
            <div><div class="fl-tier-col-label">できないこと</div><div class="fl-tier-col-no">証拠不足のまま自動で研究公開すること</div></div>
          </div>
          <div class="fl-tier fl-tier-4">
            <div><div class="fl-tier-name">Public claim / research candidate</div><div class="fl-tier-meaning">最終公開候補</div></div>
            <div><div class="fl-tier-col-label">条件</div><div class="fl-tier-col-body">public-claim lane で authority-backed か admin override の approve が入り、媒体条件も満たすこと</div></div>
            <div><div class="fl-tier-col-label">補足</div><div class="fl-tier-col-no">証拠が弱ければ authority-backed reviewed のまま止める</div></div>
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
      "はじめての方、local core、traveler loop、同定 trust、AI の役割、組織導入、データと公開範囲について、ikimon の前提を整理しています。",
      `<section class="section">
        <div class="section-header"><h2>はじめての方へ</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">ikimon とは何ですか？</summary><p class="fl-faq-a">ikimon は、地元の人が近くの自然との関係を深める <code>place-first observatory</code> であり、外から来る人に地方を訪れる理由と再訪理由を返す <code>regional entry service</code> でもあります。AI は候補提示と理解支援を担いますが、名前や public claim を自動で確定するサービスではありません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">登録や費用はかかりますか？</summary><p class="fl-faq-a">個人利用は登録不要・無料です。閲覧・記録・マップ・AI ヒントなどの基本導線をそのまま使えます。企業・自治体との連携は、deep workspace を前提にせず、place stewardship や regional partnership の相談から始めます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">スマートフォンだけで使えますか？</summary><p class="fl-faq-a">はい。ブラウザだけで完結します。アプリのダウンロードは不要です。iPhone（Safari）・Android（Chrome）でホーム画面に追加すると、アプリのように使えます。山や森など電波が弱い場所では、写真と記録を端末に保存し、電波が戻ったら自動送信されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">子どもでも使えますか？</summary><p class="fl-faq-a">使えます。13 歳未満のお子さんは保護者の同意・見守りのもとでご利用ください。Google アカウントを使ってログインするため、Google の年齢制限ポリシーが適用されます。学校でのフィールドワーク・環境教育にも活用いただけます。教育目的での利用相談は contact@ikimon.life まで。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>記録について</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">名前がわからなくても記録できますか？</summary><p class="fl-faq-a">できます。場所・日時・写真だけでも記録になります。quick capture で残してもいいし、あとで比べたい visit は survey として effort / checklist / scope を付けて残せます。名前は空欄のままでも構いません。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">どんな写真を撮ればいいですか？</summary><p class="fl-faq-a">「全体像」「特徴部分のアップ」「生息環境」の 3 枚が理想です。鳥なら体の模様・くちばし、昆虫なら翅の模様・触角、植物なら花・葉・茎がポイント。1 枚だけでも記録になります。定規や手を添えてサイズ感を示すと同定しやすくなります。暗い場所ではフラッシュより自然光が有効です。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">過去の写真も投稿できますか？</summary><p class="fl-faq-a">できます。EXIF 情報（撮影日時・GPS 座標）が残っている写真なら、日時と場所が自動入力されます。情報が消えている写真でも、おおよその日時と場所をメモ欄で補足すれば有用なデータになります。自分が撮影した写真に限ります（他人の写真の転載は禁止です）。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">私の 1 件の記録に意味はありますか？</summary><p class="fl-faq-a">あります。地元の人にとっては place memory の 1 行になり、旅で来た人にとっては次にまた来る理由の種になります。ただし、1 件だけで増減や不在まで強く言うことはしません。まずは後から読み返せる観察として残すことを優先します。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">こんな投稿は避けてください</summary><p class="fl-faq-a">AI 生成画像・他人が撮影した写真・生き物が写っていない写真・同じペットの繰り返し投稿・虚偽の位置情報や日時は避けてください。「自分が見て撮った・生き物が写っている・生き物を傷つけていない」の 3 点がクリアなら、名前がわからなくてもピントが甘くても投稿 OK です。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>AI と同定について</h2></div>
        <div class="card" style="margin-bottom:16px"><div class="card-body"><strong>同定の trust 制度を詳しく読む</strong><p style="margin:10px 0 0;color:#4b5563;line-height:1.8">なぜ AI と市民同定だけでは research/public claim にしないのか、なぜ authority を分類群ごとに切るのか、推薦と監査を含めて 1 ページにまとめています。</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/learn/authority-policy"))}">制度の説明を見る</a></div></div></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">AI は名前を自動で確定しますか？</summary><p class="fl-faq-a">しません。AI が返すのは候補と見分けのヒントです。AI 同定と市民同定は候補層として扱い、research/public claim に進めるには、分類群 authority を持つ reviewer の approve か、運営の明示的な override が必要です。制度の全体像は「同定 trust 制度」ページで公開しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿後に表示される「観察のヒント」とは何ですか？</summary><p class="fl-faq-a">投稿後に写真・場所・季節をもとに AI が自動生成するメモです。「いまはここまで絞れそう」「見分けのポイント」「次に確認すると良いこと」を示します。コミュニティ同定の票にはなりません。名前を断定するものではなく、あくまでヒントとして参考にしてください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">間違った名前を付けてしまったらどうなりますか？</summary><p class="fl-faq-a">いつでも修正できます。間違いはコミュニティが一緒に修正してくれます。「モンシロチョウだと思ったらスジグロシロチョウだった」——この体験が観察力を磨きます。初心者もベテランも学びの途中です。間違いを恐れずに挑戦する姿勢をコミュニティは応援しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">「研究グレード」とは何ですか？</summary><p class="fl-faq-a">ikimon では、AI 候補や市民同定だけで研究レベルに上げません。写真・日時・位置などの媒体条件に加え、public-claim lane で authority-backed review か admin override が入った観察だけが research/public claim 候補になります。証拠不足なら authority-backed reviewed のまま止め、研究公開とは分けます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">AI の提案はどのくらい正確ですか？</summary><p class="fl-faq-a">「参考情報」として設計しています。得意不得意はありますが、そもそも public claim の根拠に単独では使いません。AI は方向性を示し、人の review と authority-backed review が公開前の確度を支えます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q"><code>いない</code> や <code>増えた</code> は分かりますか？</summary><p class="fl-faq-a">条件付きです。ikimon では観測空白と不在を混ぜません。survey で effort / checklist / scope を残していないデータに対して、サービス側が <code>いない</code> や <code>増えた</code> を強く言うことはしません。<code>no target detected</code> も open 時点では protocol note only として扱います。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">投稿データが AI の学習に使われますか？</summary><p class="fl-faq-a">第三者の AI 企業には一切提供しません。AI クローラーによるスクレイピングも技術的にブロックしています。将来的に ikimon 自身のサービス改善（AI 同定精度の向上）に活用する可能性がありますが、その場合も外部に流出することはありません。データの主権はユーザーとikimon コミュニティにあります。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>企業・自治体向け</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">法人向けは個人利用と何が違いますか？</summary><p class="fl-faq-a">公開時点での違いは、deep な専用 workspace より、地域や組織の place stewardship を立ち上げる相談導線があることです。観察会、地域導線、記録の続け方、authority-backed review とのつなぎ方を一緒に設計できます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">地域側にはどう説明すればよいですか？</summary><p class="fl-faq-a"><code>ikimon は訪問理由と再訪理由を作る器であり、地域の自然や場所の文脈を place stewardship に変える入口です</code> と説明するのが基本です。観光万能アプリでも、研究ダッシュボード万能アプリでもない、と最初に伝える方が誤解が少なくなります。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">費用はどのくらいかかりますか？</summary><p class="fl-faq-a">個人利用は無料です。法人・自治体連携は、対象場所、初回導線、継続体制の重さによって変わるため、まず相談ベースで始めます。公開時点では、固定料金より導線設計を優先しています。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自社や地域の場所だけで始められますか？</summary><p class="fl-faq-a">始められます。まずは対象 place を決め、そこで最初の記録と再訪理由を立ち上げるところから始めます。境界や deep 管理画面を整えるのは、その loop が回り始めてからで構いません。</p></details>
        </div>
      </section>
      <section class="section">
        <div class="section-header"><h2>データ・プライバシー</h2></div>
        <div class="fl-faq">
          <details class="fl-faq-item"><summary class="fl-faq-q">位置情報は公開されますか？</summary><p class="fl-faq-a">絶滅危惧種（環境省・都道府県レッドリスト該当種）の位置情報は自動でマスキングされ、詳細な場所が特定されない精度に落とされます。通常の記録も住所が特定されるような表示はしません。写真の EXIF 情報（GPS 座標）はアップロード時に自動除去されます。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">自分のデータを削除できますか？</summary><p class="fl-faq-a">できます。各観察記録の詳細ページからいつでも削除できます。削除するとデータベースから完全に除去されます（復元不可）。アカウント全体の削除は contact@ikimon.life までご連絡ください。</p></details>
          <details class="fl-faq-item"><summary class="fl-faq-q">データは他のプラットフォームと共有されますか？</summary><p class="fl-faq-a">SNS や広告目的での共有はしません。将来的な open biodiversity data 連携は検討していますが、authority-backed review や媒体条件など、公開に足る条件を満たしたものだけを対象にします。条件未達データを trend や absence の根拠として外に押し出すことはしません。</p></details>
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
      "学校・自治体・企業・地域事業者に対して、ikimon は deep workspace を先に約束するのではなく、place stewardship と repeatable observation loop を立ち上げる導線として公開します。",
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
          title: "place stewardship を作る",
          body: "初回の観察会や現地導線を通じて、その場所にまた来る理由を残します。分析より先に、現場で loop が回ることを優先します。",
        },
        {
          title: "natural capital practice の入口",
          body: "welfare 訴求ではなく、地域の place stewardship や natural capital practice の入口として扱います。報告や分析は、その後に乗せます。",
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
          title: "なぜ deep workspace を先に約束しないのか",
          body: "公開時点の完成ラインは、地域側が `訪問理由と再訪理由を作る器` だと理解できることです。まずは入口と loop を正しく立ち上げます。",
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
        { title: "まず入口を合わせる", body: "公開時点では、地域や組織が place stewardship / regional partnership / natural capital practice のどこで使うかを揃えるところから始めます。" },
        { title: "必要になったら追加する", body: "継続運用、出力、専門 review 連携などは、現場で loop が回り始めてから段階的に追加します。" },
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
        { title: "最初の 1 件を記録する", body: "quick capture / survey を使い分けて、場所・時刻・写真を place memory にする流れを確認できます。", actionHref: withBasePath(basePath, "/record"), actionLabel: "記録画面へ" },
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
