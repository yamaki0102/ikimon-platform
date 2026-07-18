export const PUBLIC_HOME_UX_POLISH_PRESENTATION = "public-home-ux-v2";

const HOME_PATHS = new Set(["/", "/home", "/ja", "/ja/", "/ja/home", "/en", "/en/", "/en/home"]);
const UX_STYLE_ID = "ikimon-public-home-ux-v2";
const MAX_GUEST_RECORD_CARDS = 6;

type HomeLang = "ja" | "en";

const UX_STYLE = `<style id="${UX_STYLE_ID}">
  [data-public-home-install-suppressed],
  [data-app-install-prompt],
  [data-app-install-action],
  [data-app-install-dismiss] {
    display: none !important;
  }
  .prototype-guest-home-actions.is-focused a:focus-visible,
  .prototype-home-records-more a:focus-visible {
    outline: 3px solid #0f766e;
    outline-offset: 3px;
  }
  .prototype-home-records-more {
    display: flex;
    justify-content: center;
    margin: 18px 0 0;
  }
  .prototype-home-records-more a {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 1px solid rgba(15,118,110,.24);
    border-radius: 999px;
    background: #fff;
    color: #0f766e;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 900;
    text-decoration: none;
    box-sizing: border-box;
  }
  @media (max-width: 720px) {
    .prototype-home-records-more a {
      width: 100%;
      min-height: 50px;
    }
  }
</style>`;

function isFocusedHomeRequest(request: Request): boolean {
  if (request.method.toUpperCase() !== "GET") return false;
  try {
    const path = new URL(request.url).pathname.replace(/\/+$/u, "") || "/";
    return HOME_PATHS.has(path);
  } catch {
    return false;
  }
}

function detectHomeLang(request: Request, html: string): HomeLang | null {
  try {
    const path = new URL(request.url).pathname.toLowerCase();
    if (path === "/en" || path === "/en/" || path === "/en/home") return "en";
    if (path === "/" || path === "/home" || path === "/ja" || path === "/ja/" || path === "/ja/home") return "ja";
  } catch {
    // Fall back to the document language below.
  }
  if (/<html\b[^>]*\blang=["']en(?:-[^"']+)?["']/iu.test(html)) return "en";
  if (/<html\b[^>]*\blang=["']ja(?:-[^"']+)?["']/iu.test(html)) return "ja";
  return null;
}

function suppressPublicHomeInstallPrompt(html: string): string {
  return html.replace(
    /<(aside|div)\b([^>]*\bdata-app-install-prompt\b[^>]*)>/iu,
    (tag) => {
      let patched = tag;
      if (/\baria-hidden=["'][^"']*["']/iu.test(patched)) {
        patched = patched.replace(/\baria-hidden=["'][^"']*["']/iu, 'aria-hidden="true"');
      } else {
        patched = patched.replace(/>$/u, ' aria-hidden="true">');
      }
      if (!/\bhidden(?:\s|=|>)/iu.test(patched)) patched = patched.replace(/>$/u, " hidden>");
      if (!/\binert(?:\s|=|>)/iu.test(patched)) patched = patched.replace(/>$/u, " inert>");
      if (!/\bdata-public-home-install-suppressed(?:\s|=|>)/iu.test(patched)) {
        patched = patched.replace(/>$/u, ' data-public-home-install-suppressed="true">');
      }
      return patched;
    },
  );
}

function removeGuestHeroGuide(html: string): string {
  return html.replace(
    /<a\b[^>]*\bclass=["'][^"']*\bprototype-guest-home-guide\b[^"']*["'][^>]*>[\s\S]*?<\/a>/giu,
    "",
  );
}

function rewriteHomeCopy(html: string, lang: HomeLang): string {
  const copy = lang === "ja"
    ? {
        currentLead: "名前が分からなくても大丈夫。身近な発見を、地域の記録として残せます。",
        lead: "名前が分からなくても大丈夫。まずは自分の記録として残し、あとから見返せます。",
        currentSecondary: "近くを地図で見る",
        secondary: "近くの記録を見る",
        currentTrust: "名前はあとで。位置はおおまかに表示されます。",
        trust: "名前はあとから追加できます。公開画面では、正確な場所をそのまま表示しません。",
        currentFeedTitle: "今日届いた記録",
        feedTitle: "最近の公開記録",
        currentFeedBody: "身近な発見を、そのまま見られます。",
        feedBody: "公開されている記録を、最大6件紹介します。",
        proofLabel: "実際の公開記録",
      }
    : {
        currentLead: "You do not need the name first. Save a nearby discovery now and let it grow into a local record.",
        lead: "You do not need the name first. Save it for yourself now and return to it later.",
        currentSecondary: "Explore nearby",
        secondary: "See nearby records",
        currentTrust: "Names can come later. Public locations are generalized.",
        trust: "Add the name later. Public pages do not show the exact location as recorded.",
        currentFeedTitle: "Recent local records",
        feedTitle: "Recent public records",
        currentFeedBody: "See what people have noticed nearby.",
        feedBody: "A focused selection of up to six public records.",
        proofLabel: "A real public record",
      };

  let rewritten = html
    .replace(copy.currentLead, copy.lead)
    .replace(copy.currentSecondary, copy.secondary)
    .replace(copy.currentTrust, copy.trust)
    .replace(copy.currentFeedTitle, copy.feedTitle)
    .replace(copy.currentFeedBody, copy.feedBody);

  rewritten = rewritten.replace(
    /(<div class="prototype-guest-home-proof-grid">[\s\S]*?<span>)(?:写真|Photo)(<\/span>)/u,
    `$1${copy.proofLabel}$2`,
  );

  return rewritten;
}

function connectTrustTextToActions(html: string): string {
  const rewritten = html.replace(
    /<p class="prototype-guest-home-trust">/u,
    '<p id="prototype-guest-home-trust" class="prototype-guest-home-trust">',
  );

  return rewritten.replace(
    /<div class="prototype-guest-home-actions is-focused">([\s\S]*?)<\/div>/u,
    (block) => block.replace(/<a\b(?![^>]*\baria-describedby=)/gu, '<a aria-describedby="prototype-guest-home-trust"'),
  );
}

function limitGuestRecordCards(html: string, lang: HomeLang): string {
  if (html.includes("prototype-home-records-more")) return html;

  return html.replace(
    /<section class="prototype-record-feed is-guest"[^>]*>[\s\S]*?<\/section>/u,
    (section) => {
      let cardIndex = 0;
      let limited = section.replace(
        /<article\b[^>]*\bclass=["'][^"']*\bprototype-record-feed-card\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gu,
        (card) => {
          cardIndex += 1;
          return cardIndex <= MAX_GUEST_RECORD_CARDS ? card : "";
        },
      );

      const href = lang === "ja" ? "/ja/records?view=public" : "/en/records?view=public";
      const label = lang === "ja" ? "もっと記録を見る" : "See more records";
      const more = `<div class="prototype-home-records-more"><a href="${href}" data-kpi-action="landing:guest_home:more_records">${label}</a></div>`;
      limited = limited.replace(/<\/section>\s*$/u, `${more}</section>`);
      return limited;
    },
  );
}

function injectUxStyles(html: string): string {
  if (html.includes(`id="${UX_STYLE_ID}"`)) return html;
  if (html.includes("</head>")) return html.replace("</head>", `${UX_STYLE}\n</head>`);
  return `${UX_STYLE}${html}`;
}

export function applyPublicHomeUxPolish(html: string, lang: HomeLang): string {
  let polished = suppressPublicHomeInstallPrompt(html);
  polished = removeGuestHeroGuide(polished);
  polished = rewriteHomeCopy(polished, lang);
  polished = connectTrustTextToActions(polished);
  polished = limitGuestRecordCards(polished, lang);
  return injectUxStyles(polished);
}

export async function polishPublicHomeUx(request: Request, response: Response): Promise<Response> {
  if (!isFocusedHomeRequest(request) || response.status < 200 || response.status >= 300) return response;
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const lang = detectHomeLang(request, html);
  if (!lang) {
    const unchangedHeaders = new Headers(response.headers);
    unchangedHeaders.delete("content-length");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: unchangedHeaders,
    });
  }

  const polished = applyPublicHomeUxPolish(html, lang);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");
  headers.set("x-ikimon-home-ux-polish", PUBLIC_HOME_UX_POLISH_PRESENTATION);

  return new Response(polished, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
