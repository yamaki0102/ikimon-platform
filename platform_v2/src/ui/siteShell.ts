import { withBasePath } from "../httpBasePath.js";

export type SiteAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export type SiteHero = {
  eyebrow: string;
  heading: string;
  lead: string;
  actions?: SiteAction[];
  mediaHtml?: string;
  supplementHtml?: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
};

export type SiteShellOptions = {
  basePath: string;
  title: string;
  body: string;
  hero?: SiteHero;
  activeNav?: string;
  footerNote?: string;
};

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function nav(basePath: string, activeNav?: string): string {
  const links = [
    { href: withBasePath(basePath, "/"), label: "Home" },
    { href: withBasePath(basePath, "/explore"), label: "Explore" },
    { href: withBasePath(basePath, "/record"), label: "Record" },
    { href: withBasePath(basePath, "/learn"), label: "Learn" },
    { href: withBasePath(basePath, "/for-business"), label: "For Business" },
  ];

  return `<header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="${escapeHtml(withBasePath(basePath, "/"))}">
        <span class="brand-mark">i</span>
        <span>
          <strong>ikimon.life</strong>
          <small>observe, learn, revisit</small>
        </span>
      </a>
      <nav class="site-nav">${links
        .map((link) => {
          const activeClass = activeNav === link.label ? " is-active" : "";
          return `<a class="site-nav-link${activeClass}" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`;
        })
        .join("")}</nav>
      <div class="site-header-actions">
        <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">Record</a>
      </div>
    </div>
  </header>`;
}

function hero(basePath: string, content?: SiteHero): string {
  if (!content) {
    return "";
  }

  const actions = (content.actions ?? []).map((action) => {
    const className = action.variant === "secondary" ? "btn btn-ghost-on-dark" : "btn btn-solid";
    return `<a class="${className}" href="${escapeHtml(withBasePath(basePath, action.href))}">${escapeHtml(action.label)}</a>`;
  }).join("");

  return `<section class="hero-panel${content.mediaHtml ? " has-media" : ""}${content.tone === "light" ? " is-light" : ""}${content.align === "center" ? " is-center" : ""}">
    <div class="hero-copy">
      <div class="eyebrow">${escapeHtml(content.eyebrow)}</div>
      <h1>${escapeHtml(content.heading)}</h1>
      <p>${escapeHtml(content.lead)}</p>
      ${content.supplementHtml ? `<div class="hero-supplement">${content.supplementHtml}</div>` : ""}
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </div>
    ${content.mediaHtml ? `<div class="hero-media">${content.mediaHtml}</div>` : ""}
  </section>`;
}

function footer(basePath: string, footerNote?: string): string {
  const note = footerNote ?? "ikimon.life — observe, learn, revisit.";
  return `<footer class="site-footer">
    <div class="site-footer-grid">
      <div class="site-footer-block">
        <div class="eyebrow">ikimon</div>
        <h2>Save what you found nearby and revisit it, place by place.</h2>
        <p class="meta">${escapeHtml(note)}</p>
      </div>
      <div class="site-footer-block">
        <div class="eyebrow">Start</div>
        <div class="footer-links">
          <a href="${escapeHtml(withBasePath(basePath, "/"))}">Home</a>
          <a href="${escapeHtml(withBasePath(basePath, "/explore"))}">Explore</a>
          <a href="${escapeHtml(withBasePath(basePath, "/record"))}">Record</a>
          <a href="${escapeHtml(withBasePath(basePath, "/home"))}">My trail</a>
        </div>
      </div>
      <div class="site-footer-block">
        <div class="eyebrow">Learn</div>
        <div class="footer-links">
          <a href="${escapeHtml(withBasePath(basePath, "/learn"))}">Learn hub</a>
          <a href="${escapeHtml(withBasePath(basePath, "/about"))}">About</a>
          <a href="${escapeHtml(withBasePath(basePath, "/faq"))}">FAQ</a>
          <a href="${escapeHtml(withBasePath(basePath, "/for-business/demo"))}">Demo</a>
          <a href="${escapeHtml(withBasePath(basePath, "/contact"))}">Contact</a>
        </div>
      </div>
      <div class="site-footer-block">
        <div class="eyebrow">For Business</div>
        <div class="footer-links">
          <a href="${escapeHtml(withBasePath(basePath, "/for-business"))}">Overview</a>
          <a href="${escapeHtml(withBasePath(basePath, "/for-business/pricing"))}">Pricing</a>
          <a href="${escapeHtml(withBasePath(basePath, "/for-business/apply"))}">Apply</a>
          <a href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench"))}">Specialist lane</a>
        </div>
      </div>
      <div class="site-footer-block">
        <div class="eyebrow">Trust</div>
        <div class="footer-links">
          <a href="${escapeHtml(withBasePath(basePath, "/privacy"))}">Privacy</a>
          <a href="${escapeHtml(withBasePath(basePath, "/terms"))}">Terms</a>
          <a href="${escapeHtml(withBasePath(basePath, "/contact"))}">Contact</a>
        </div>
      </div>
    </div>
  </footer>`;
}

export function renderSiteDocument(options: SiteShellOptions): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f8f5;
      --surface: rgba(255,255,255,.92);
      --surface-strong: #ffffff;
      --border: rgba(16,185,129,.12);
      --ink: #1a2e1f;
      --muted: #4a635a;
      --hero-a: #163821;
      --hero-b: #8dbf77;
      --hero-c: #dbe7d3;
      --accent: #0d7a5f;
      --accent-hover: #065f46;
      --accent-soft: #ecfdf5;
      --shadow: 0 18px 44px rgba(10, 42, 24, .07);
      --shadow-strong: 0 26px 64px rgba(10, 42, 24, .14);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.07), transparent 36%),
        radial-gradient(circle at top right, rgba(16,185,129,.04), transparent 30%),
        linear-gradient(180deg, #f9fffe 0%, var(--bg) 100%);
    }
    a { color: inherit; text-decoration: none; }
    .site-shell { min-height: 100vh; }
    .shell { max-width: 1140px; margin: 0 auto; padding: 28px 24px 24px; }
    .site-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(18px); background: rgba(249,255,254,.82); border-bottom: 1px solid rgba(16,185,129,.08); }
    .site-header-inner { max-width: 1180px; margin: 0 auto; padding: 16px 24px; display: flex; align-items: center; gap: 18px; justify-content: space-between; flex-wrap: wrap; }
    .brand { display: inline-flex; align-items: center; gap: 12px; min-width: 220px; }
    .brand-mark { width: 38px; height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--hero-a), var(--hero-b)); color: white; font-weight: 900; box-shadow: var(--shadow); }
    .brand strong { display: block; font-size: 15px; }
    .brand small { display: block; margin-top: 2px; color: var(--muted); }
    .site-nav { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .site-nav-link { padding: 9px 14px; border-radius: 999px; background: rgba(255,255,255,.64); border: 1px solid rgba(16,185,129,.1); font-weight: 700; font-size: 14px; color: var(--ink); }
    .site-nav-link.is-active { background: var(--accent); color: white; border-color: transparent; box-shadow: 0 4px 12px rgba(13,122,95,.2); }
    .site-header-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; border-radius: 999px; font-weight: 800; border: 1px solid transparent; }
    .btn-solid { background: linear-gradient(135deg, #0d7a5f, #059669); color: white; box-shadow: 0 8px 20px rgba(13,122,95,.18); }
    .btn-solid-on-light { background: linear-gradient(135deg, var(--hero-a), #1b5f34); color: white; box-shadow: 0 12px 26px rgba(18,61,37,.18); }
    .btn-ghost { background: rgba(255,255,255,.86); border-color: var(--border); color: var(--ink); }
    .btn-ghost-on-dark { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.28); color: white; }
    .btn.secondary { background: rgba(255,255,255,.88); border-color: var(--border); color: var(--ink); }
    .hero-panel {
      position: relative;
      margin-top: 22px;
      padding: 56px 48px;
      border-radius: 32px;
      background:
        radial-gradient(circle at top right, rgba(255,255,255,.10), transparent 28%),
        linear-gradient(135deg, #163821 0%, #1b5f34 52%, #3a8c5a 100%);
      color: white;
      box-shadow: var(--shadow-strong);
      overflow: hidden;
    }
    .hero-panel::after {
      content: "";
      position: absolute;
      inset: auto -6% -22% auto;
      width: 340px;
      height: 340px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,.18), transparent 64%);
      pointer-events: none;
    }
    .hero-panel.has-media {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
      gap: 28px;
      align-items: stretch;
    }
    .hero-copy { position: relative; z-index: 1; }
    .hero-panel h1 {
      margin: 10px 0 0;
      font-family: "Zen Kaku Gothic New", "BIZ UDPGothic", "Noto Sans JP", sans-serif;
      font-size: clamp(30px, 4.2vw, 46px);
      line-height: 1.18;
      letter-spacing: -.02em;
      font-weight: 900;
      max-width: 720px;
    }
    .hero-panel p { margin: 16px 0 0; max-width: 760px; color: rgba(255,255,255,.9); line-height: 1.8; font-size: 17px; }
    .hero-supplement { margin-top: 18px; }
    .hero-metric-strip {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.88);
      font-size: 14px;
      font-weight: 600;
    }
    .hero-metric strong { font-weight: 800; color: white; font-size: 15px; }
    .hero-metric-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.4); flex-shrink: 0; }
    .hero-panel.is-center .hero-copy { text-align: center; margin-inline: auto; }
    .hero-panel.is-center .hero-copy h1,
    .hero-panel.is-center .hero-copy p { margin-inline: auto; }
    .hero-panel.is-center .actions { justify-content: center; }
    .hero-panel.is-light {
      background:
        radial-gradient(circle at top left, rgba(141,191,119,.14), transparent 38%),
        radial-gradient(circle at top right, rgba(37,99,235,.05), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #ffffff 62%, #f8fbf8 100%);
      color: #0f172a;
      box-shadow: 0 18px 40px rgba(15, 23, 42, .06);
      border: 1px solid rgba(15, 23, 42, .08);
    }
    .hero-panel.is-light::after { display: none; }
    .hero-panel.is-light p { color: #475569; }
    .hero-panel.is-light .eyebrow { color: #475569; opacity: 1; }
    .hero-panel.is-light .btn-solid-on-light { background: #0f172a; color: white; box-shadow: 0 12px 24px rgba(15,23,42,.12); }
    .hero-panel.is-light .btn-ghost-on-dark { background: rgba(255,255,255,.92); border-color: rgba(148,163,184,.45); color: #334155; }
    .hero-chip-row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.18);
      backdrop-filter: blur(6px);
      color: rgba(255,255,255,.92);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .01em;
    }
    .hero-media {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1.05fr .95fr;
      gap: 12px;
      min-height: 100%;
    }
    .hero-photo {
      position: relative;
      min-height: 220px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 18px 38px rgba(5, 20, 11, .18);
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.12);
    }
    .hero-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: saturate(1.05) contrast(1.02);
    }
    .hero-photo::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(4,16,9,0) 34%, rgba(4,16,9,.44) 100%);
      pointer-events: none;
    }
    .hero-photo-label {
      position: absolute;
      left: 14px;
      bottom: 14px;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.22);
      color: white;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
    }
    .hero-photo.tall { grid-row: span 2; min-height: 100%; }
    .hero-photo.small { min-height: 148px; }
    .hero { padding: 26px; border-radius: 28px; background: linear-gradient(135deg, var(--hero-a), var(--hero-b)); color: white; box-shadow: 0 20px 46px rgba(18,61,37,.16); }
    .hero .muted, .hero .meta, .hero p { color: rgba(255,255,255,.88); }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); opacity: .9; }
    .section { margin-top: 40px; }
    .section-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-end; }
    .section-header h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
    .section-header p { margin: 8px 0 0; color: var(--muted); }
    .grid, .actions { display: flex; flex-wrap: wrap; gap: 16px; }
    .grid { margin-top: 16px; }
    .card {
      flex: 1 1 260px;
      min-width: 240px;
      padding: 24px;
      border-radius: 20px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      overflow: hidden;
      transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
    }
    .card:hover { transform: translateY(-3px); box-shadow: 0 22px 44px rgba(10,42,24,.10); border-color: rgba(16,185,129,.22); }
    .card-body { padding: 18px; }
    .card h2, .title {
      margin: 8px 0 0;
      font-family: "Zen Kaku Gothic New", "BIZ UDPGothic", "Noto Sans JP", sans-serif;
      font-size: 19px;
      line-height: 1.32;
      font-weight: 800;
      letter-spacing: -.01em;
    }
    .card p, .meta, .muted { color: var(--muted); line-height: 1.7; }
    .meta { font-size: 13px; margin-top: 6px; }
    .list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.86);
      border: 1px solid #dfeadf;
    }
    .row strong { display: block; margin-bottom: 4px; }
    .pill { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
    .thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #e6eee7; }
    .visual-band {
      position: relative;
      padding: 20px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(239,246,239,.92));
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: 1.25fr .95fr .95fr;
      gap: 14px;
      margin-top: 18px;
    }
    .photo-card {
      position: relative;
      min-height: 240px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 20px 38px rgba(10,42,24,.12);
      background: rgba(255,255,255,.74);
    }
    .photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(17,31,21,0) 26%, rgba(17,31,21,.52) 100%);
      pointer-events: none;
    }
    .photo-card .caption {
      position: absolute;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 1;
      color: white;
    }
    .photo-card .caption strong {
      display: block;
      font-family: "Shippori Mincho", "Yu Mincho", serif;
      font-size: 24px;
      line-height: 1.15;
    }
    .photo-card .caption span {
      display: block;
      margin-top: 8px;
      color: rgba(255,255,255,.84);
      line-height: 1.55;
      font-size: 13px;
    }
    .photo-card.tall { min-height: 320px; }
    .stack { display: flex; flex-direction: column; gap: 12px; }
    input, textarea, select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.96);
      color: var(--ink);
      font: inherit;
    }
    code { font-family: ui-monospace, monospace; font-size: 13px; }
    .site-footer { margin-top: 48px; border-top: 1px solid rgba(16,185,129,.08); background: rgba(255,255,255,.52); }
    .site-footer-grid { max-width: 1240px; margin: 0 auto; padding: 28px 24px 40px; display: grid; gap: 18px; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr; }
    .site-footer-block { padding: 18px; border-radius: 20px; background: rgba(255,255,255,.68); border: 1px solid rgba(16,185,129,.08); }
    .site-footer-block h2 { margin: 10px 0 0; font-size: 24px; line-height: 1.2; }
    .footer-links { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .footer-links a { color: var(--muted); font-weight: 700; }
    @media (max-width: 900px) {
      .site-footer-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 720px) {
      .shell { padding: 20px 18px 18px; }
      .site-header-inner { padding: 12px 18px; }
      .hero-panel { padding: 30px 24px; border-radius: 26px; }
      .hero-panel.has-media { grid-template-columns: 1fr; }
      .hero-media { grid-template-columns: 1fr 1fr; }
      .hero-photo.tall { grid-row: auto; min-height: 220px; }
      .photo-grid { grid-template-columns: 1fr; }
      .site-footer-grid { grid-template-columns: 1fr; padding: 22px 18px 34px; }
      .row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="site-shell">
    ${nav(options.basePath, options.activeNav)}
    <main class="shell">
      ${hero(options.basePath, options.hero)}
      ${options.body}
    </main>
    ${footer(options.basePath, options.footerNote)}
  </div>
</body>
</html>`;
}
