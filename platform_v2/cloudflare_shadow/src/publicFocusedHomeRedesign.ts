export const FOCUSED_PUBLIC_HOME_PRESENTATION = "focused-home-v3";

const FOCUSED_HOME_STYLE_ID = "ikimon-focused-home-v3";

type FocusedHomeLang = "ja" | "en";

const FOCUSED_HOME_STYLE = `<style id="${FOCUSED_HOME_STYLE_ID}">
  [data-app-install-prompt] {
    display: none !important;
  }
  .prototype-guest-home,
  .prototype-guest-home-copy,
  .prototype-guest-home-panel,
  .prototype-guest-home-proof,
  .prototype-guest-home-proof-grid,
  .prototype-focused-feed-heading,
  .prototype-record-feed.is-guest {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
  .prototype-guest-home-stats,
  .prototype-guest-home-notes,
  .prototype-guest-home-guide {
    display: none !important;
  }
  .prototype-guest-home-copy {
    gap: 14px;
  }
  .prototype-guest-home-copy h1 {
    max-width: 10em;
    font-size: clamp(36px, 4.7vw, 60px);
    letter-spacing: -.035em;
    overflow-wrap: anywhere;
  }
  .prototype-guest-home-copy h1 span {
    display: block;
  }
  .prototype-guest-home-lead,
  .prototype-guest-home-trust,
  .prototype-focused-feed-heading strong,
  .prototype-focused-feed-heading span {
    min-width: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  .prototype-guest-home-lead {
    max-width: 31em !important;
  }
  .prototype-guest-home-actions.is-focused {
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  .prototype-guest-home-actions.is-focused a {
    min-width: 0;
    max-width: 100%;
    min-height: 48px;
    padding: 0 18px;
    font-size: 15px;
    box-sizing: border-box;
    overflow-wrap: anywhere;
  }
  .prototype-guest-home-actions.is-focused .prototype-guest-home-primary {
    min-height: 52px;
    padding-inline: 22px;
    font-size: 16px;
    box-shadow: 0 16px 36px rgba(2, 6, 23, .22);
  }
  .prototype-guest-home-actions.is-focused .prototype-guest-home-secondary {
    background: transparent;
    border-color: rgba(255,255,255,.42);
  }
  .prototype-guest-home-trust {
    margin: -2px 0 0 !important;
    color: rgba(236,253,245,.88) !important;
    font-size: 13px !important;
    line-height: 1.45 !important;
    font-weight: 800 !important;
  }
  .prototype-guest-home-panel {
    align-content: stretch;
  }
  .prototype-guest-home-proof {
    height: 100%;
  }
  .prototype-guest-home-proof-grid {
    height: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .prototype-guest-home-proof-card {
    position: relative;
    min-width: 0;
    max-width: 100%;
    min-height: 142px;
    overflow: hidden;
    box-sizing: border-box;
  }
  .prototype-guest-home-proof-card img {
    width: 100%;
    max-width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .prototype-focused-feed-heading {
    display: grid;
    gap: 4px;
    margin: 8px 0 14px;
  }
  .prototype-focused-feed-heading strong {
    color: #10251a;
    font-size: clamp(24px, 3vw, 34px);
    line-height: 1.15;
    font-weight: 950;
    letter-spacing: -.02em;
  }
  .prototype-focused-feed-heading span {
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
    font-weight: 750;
  }
  @media (max-width: 720px) {
    .shell.shell-bleed.prototype-shell {
      min-width: 0;
      max-width: calc(100vw - 32px);
      padding-top: 14px;
      box-sizing: border-box;
    }
    .prototype-guest-home {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 28px;
    }
    .prototype-guest-home-panel {
      width: 100%;
      order: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .prototype-guest-home-proof {
      width: 100%;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .prototype-guest-home-proof-head {
      display: none;
    }
    .prototype-guest-home-proof-grid {
      width: 100%;
      display: block;
    }
    .prototype-guest-home-proof-card {
      display: none;
    }
    .prototype-guest-home-proof-card:first-child {
      width: 100%;
      display: block;
      height: clamp(270px, 42vh, 370px);
      min-height: 270px;
      border-radius: 20px;
      box-shadow: 0 18px 42px rgba(15,23,42,.16);
    }
    .prototype-guest-home-proof-card:first-child span {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      position: absolute;
      left: 12px;
      right: auto;
      bottom: 12px;
      max-width: calc(100% - 24px);
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(2,6,23,.76);
      color: #fff;
      font-size: 13px;
      font-weight: 900;
      line-height: 1;
      box-sizing: border-box;
      backdrop-filter: blur(8px);
    }
    .prototype-guest-home-copy {
      width: 100%;
      order: 1;
      gap: 12px;
      padding: 20px 4px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: #10251a;
    }
    .prototype-guest-home-copy > span {
      max-width: 100%;
      padding: 0;
      background: transparent;
      color: #047857;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .prototype-guest-home-copy h1 {
      max-width: 100%;
      color: #10251a;
      font-size: clamp(34px, 9.8vw, 42px);
      line-height: 1.04;
    }
    .prototype-guest-home-copy p,
    .prototype-guest-home-lead {
      max-width: 100% !important;
      color: #334155 !important;
      font-size: 16px !important;
      line-height: 1.65 !important;
      font-weight: 720 !important;
    }
    .prototype-guest-home-actions.is-focused {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      margin-top: 2px;
    }
    .prototype-guest-home-actions.is-focused a {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      min-height: 46px;
      padding-inline: 12px;
      border-color: rgba(15,118,110,.22);
      background: #fff;
      color: #0f766e;
      font-size: 15px;
    }
    .prototype-guest-home-actions.is-focused .prototype-guest-home-primary {
      min-height: 54px;
      background: #047857;
      border-color: #047857;
      color: #fff;
      font-size: 17px;
      box-shadow: 0 16px 34px rgba(4,120,87,.22);
    }
    .prototype-guest-home-actions.is-focused .prototype-guest-home-secondary {
      background: #fff;
      border-color: rgba(15,118,110,.24);
      color: #0f766e;
    }
    .prototype-guest-home-trust {
      width: 100%;
      color: #64748b !important;
      font-size: 13px !important;
      line-height: 1.5 !important;
    }
    .prototype-focused-feed-heading {
      width: 100%;
      margin: 0 0 12px;
    }
    .prototype-focused-feed-heading strong {
      font-size: 25px;
    }
    .prototype-focused-feed-heading span {
      font-size: 13px;
    }
    .prototype-record-feed.is-guest,
    .prototype-record-feed-list,
    .prototype-record-feed-card,
    .prototype-record-feed-main,
    .prototype-record-feed-media-wrap {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    .prototype-record-feed-list {
      gap: 22px;
    }
    .prototype-record-feed.is-guest .prototype-record-feed-media-wrap {
      height: clamp(300px, 50vh, 440px);
      min-height: 300px;
    }
    .prototype-record-feed-badges > span,
    .prototype-record-feed-copy span {
      font-size: 13px;
    }
  }
  @media (max-width: 360px) {
    .shell.shell-bleed.prototype-shell {
      max-width: calc(100vw - 24px);
    }
    .prototype-guest-home-proof-card:first-child {
      height: 260px;
      min-height: 260px;
    }
    .prototype-guest-home-copy {
      padding-inline: 0;
    }
    .prototype-guest-home-copy h1 {
      font-size: 33px;
    }
    .prototype-guest-home-copy p,
    .prototype-guest-home-lead {
      font-size: 15px !important;
    }
  }
</style>`;

function detectFocusedHomeLang(html: string): FocusedHomeLang | null {
  if (/<html\b[^>]*\blang=["']ja(?:-[^"']+)?["']/iu.test(html) || html.includes("地域の記録から始める")) {
    return "ja";
  }
  if (/<html\b[^>]*\blang=["']en(?:-[^"']+)?["']/iu.test(html) || html.includes("Start from local records")) {
    return "en";
  }
  return null;
}

function recordHrefFromRecordsHref(recordsHref: string): string {
  const rewritten = recordsHref.replace(/\/records(?:\?[^"#]*)?(?:#[^"]*)?$/u, "/record?start=gallery");
  return rewritten === recordsHref ? "/record?start=gallery" : rewritten;
}

function rewriteFocusedHomeCopy(html: string, lang: FocusedHomeLang): string {
  const copy = lang === "ja"
    ? {
        oldTitle: "地域の記録から始める",
        title: "見つけたものを、<span>写真1枚から。</span>",
        oldLead: "地図、フィールド、みんなの公開記録から、今日歩く場所やあとで見返す手がかりを探せます。名前が分からない記録も、地域の記憶として残ります。",
        lead: "名前が分からなくても大丈夫。身近な発見を、地域の記録として残せます。",
      }
    : {
        oldTitle: "Start from local records",
        title: "Begin with <span>one photo.</span>",
        oldLead: "Browse public records, the map, and fields to choose where to walk today and what to revisit later.",
        lead: "You do not need the name first. Save a nearby discovery now and let it grow into a local record.",
      };

  return html
    .replace(
      `<h1 id="prototype-guest-home-heading">${copy.oldTitle}</h1>`,
      `<h1 id="prototype-guest-home-heading">${copy.title}</h1>`,
    )
    .replace(`<p>${copy.oldLead}</p>`, `<p class="prototype-guest-home-lead">${copy.lead}</p>`);
}

function rewriteFocusedHomeActions(html: string, lang: FocusedHomeLang): string {
  const actionPattern = /<div class="prototype-guest-home-actions">([\s\S]*?)<\/div>/u;
  return html.replace(actionPattern, (block, inner: string) => {
    const hrefs = Array.from(inner.matchAll(/\bhref="([^"]+)"/gu), (match) => match[1] ?? "").filter(Boolean);
    if (hrefs.length < 2) return block;
    const recordsHref = hrefs[0] ?? "/records?view=public";
    const mapHref = hrefs[1] ?? "/map";
    const recordHref = recordHrefFromRecordsHref(recordsHref);
    const copy = lang === "ja"
      ? {
          primary: "写真を残す",
          secondary: "近くを地図で見る",
          trust: "名前はあとで。位置はおおまかに表示されます。",
        }
      : {
          primary: "Save a photo",
          secondary: "Explore nearby",
          trust: "Names can come later. Public locations are generalized.",
        };
    return `<div class="prototype-guest-home-actions is-focused">
        <a class="prototype-guest-home-primary" href="${recordHref}" data-kpi-action="landing:guest_home:focused_record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${recordHref}">${copy.primary}</a>
        <a class="prototype-guest-home-secondary" href="${mapHref}" data-kpi-action="landing:guest_home:focused_map">${copy.secondary}</a>
      </div>
      <p class="prototype-guest-home-trust">${copy.trust}</p>`;
  });
}

function injectFocusedFeedHeading(html: string, lang: FocusedHomeLang): string {
  if (html.includes("prototype-focused-feed-heading")) return html;
  const copy = lang === "ja"
    ? { title: "今日届いた記録", body: "身近な発見を、そのまま見られます。" }
    : { title: "Recent local records", body: "See what people have noticed nearby." };
  return html.replace(
    /(<section class="prototype-record-feed is-guest"[^>]*>)/u,
    `$1\n    <div class="prototype-focused-feed-heading"><strong>${copy.title}</strong><span>${copy.body}</span></div>`,
  );
}

function injectFocusedHomeStyles(html: string): string {
  if (html.includes(`id="${FOCUSED_HOME_STYLE_ID}"`)) return html;
  if (html.includes("</head>")) return html.replace("</head>", `${FOCUSED_HOME_STYLE}\n</head>`);
  return `${FOCUSED_HOME_STYLE}${html}`;
}

export function applyFocusedPublicHomeRedesign(html: string): string {
  if (html.includes('data-home-contract="state-split-v1"')) return html;
  const lang = detectFocusedHomeLang(html);
  let redesigned = html;
  if (lang) {
    redesigned = rewriteFocusedHomeCopy(redesigned, lang);
    redesigned = rewriteFocusedHomeActions(redesigned, lang);
    redesigned = injectFocusedFeedHeading(redesigned, lang);
  }
  return injectFocusedHomeStyles(redesigned);
}
