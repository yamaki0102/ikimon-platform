import { appendLangToHref, supportedLanguages, type SiteLang } from "./i18n.js";
import { getShortCopy, hasLocalizedLongform, hasLocalizedShortCopy } from "./content/index.js";

export type RouteLane =
  | "start"
  | "learn"
  | "trust"
  | "group"
  | "business"
  | "research"
  | "specialist"
  | "ops";

export type SitePageDefinition = {
  path: string;
  lane: RouteLane;
  audience: "public" | "visitor" | "member" | "business" | "researcher" | "specialist" | "operator";
  auth: "public" | "session" | "specialist" | "admin" | "system";
  navVisibility: Array<"header" | "footer" | "qa" | "xml">;
  title: { ja: string; en: string };
  summary: { ja: string; en: string };
  primaryAction?: { href: string; label: { ja: string; en: string } };
  legacyRedirects?: string[];
  marketing?: {
    pageKey: string;
    prepend?: "contactForm";
  };
  visualQa?: {
    smoke: boolean;
    viewports: VisualQaViewportName[];
    expectedText: { ja: string; en?: string };
    readySelector?: string;
    requires?: "none" | "user" | "occurrence" | "specialistDenied";
    allowStatus?: number[];
    screenshot?: {
      baselineName: string;
      fullPage?: boolean;
      maxDiffPixelRatio?: number;
    };
  };
};

export type VisualQaViewportName = "desktop-1440" | "mobile-390";

export type VisualQaViewport = {
  slug: VisualQaViewportName;
  viewport: { width: number; height: number };
  isMobile?: boolean;
  hasTouch?: boolean;
};

export type SitePageMaterializationContext = {
  userId?: string;
  visitId?: string;
  occurrenceId?: string;
};

export const VISUAL_QA_VIEWPORTS: Record<VisualQaViewportName, VisualQaViewport> = {
  "desktop-1440": { slug: "desktop-1440", viewport: { width: 1440, height: 1200 } },
  "mobile-390": { slug: "mobile-390", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

export const SITE_PAGE_DEFINITIONS: SitePageDefinition[] = [
  {
    path: "/",
    lane: "start",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "トップ", en: "Home" },
    summary: { ja: "近くの自然を楽しみ、記録へ進む入口。", en: "The entry point for enjoying nearby nature and starting a record." },
    primaryAction: { href: "/record", label: { ja: "記録する", en: "Record" } },
    legacyRedirects: ["/index.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "身近な自然" }, readySelector: "body", screenshot: { baselineName: "registry-top" } },
  },
  {
    path: "/record",
    lane: "start",
    audience: "member",
    auth: "session",
    navVisibility: ["footer", "qa"],
    title: { ja: "記録する", en: "Record" },
    summary: { ja: "写真・場所・時間・メモを残す。未ログイン時は開始案内を表示。", en: "Record photo, place, time, and notes. Visitors see a start guide." },
    primaryAction: { href: "/record", label: { ja: "記録を始める", en: "Start recording" } },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "記録" }, readySelector: "body", allowStatus: [200], screenshot: { baselineName: "registry-record-start" } },
  },
  {
    path: "/lens",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "その場で見る", en: "Lens" },
    summary: { ja: "名前を決めきる前に、候補と見分けるヒントを見る入口。", en: "See candidates and hints before deciding the name." },
    visualQa: { smoke: true, viewports: ["desktop-1440"], expectedText: { ja: "その場で" }, readySelector: "body", screenshot: { baselineName: "registry-lens" } },
  },
  {
    path: "/map",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "地図", en: "Map" },
    summary: { ja: "観察が集まる場所と、次に歩く理由を見る。", en: "Find places with observations and reasons to walk next." },
    legacyRedirects: ["/scan"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "地図" }, readySelector: "#map-explorer", screenshot: { baselineName: "registry-map" } },
  },
  {
    path: "/explore",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "探す", en: "Explore" },
    summary: { ja: "最近の観察や名前を横断して見る。", en: "Browse observations and names across the service." },
    legacyRedirects: ["/zukan", "/zukan.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "今日の散歩先を探す" }, readySelector: "body", screenshot: { baselineName: "registry-explore" } },
  },
  {
    path: "/notes",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "ノート", en: "Notes" },
    summary: { ja: "場所と再訪のきっかけを見返す。", en: "Review places and reasons to revisit." },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "ノート" }, readySelector: "body", screenshot: { baselineName: "registry-notes" } },
  },
  {
    path: "/home",
    lane: "start",
    audience: "member",
    auth: "session",
    navVisibility: ["qa"],
    title: { ja: "ホーム", en: "Notebook home" },
    summary: { ja: "自分の観察・場所・再訪候補を見る。", en: "See your observations, places, and revisit prompts." },
    visualQa: { smoke: true, viewports: ["desktop-1440"], expectedText: { ja: "最近の観察" }, requires: "user", allowStatus: [200], screenshot: { baselineName: "registry-home" } },
  },
  {
    path: "/profile/:userId",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["qa"],
    title: { ja: "プロフィール", en: "Profile" },
    summary: { ja: "一人の観察と場所の履歴を見る。", en: "Read one observer's observations and places." },
    visualQa: { smoke: true, viewports: ["desktop-1440"], expectedText: { ja: "最近の My places" }, requires: "user", allowStatus: [200], screenshot: { baselineName: "registry-profile" } },
  },
  {
    path: "/observations/:id",
    lane: "start",
    audience: "visitor",
    auth: "public",
    navVisibility: ["qa"],
    title: { ja: "観察詳細", en: "Observation detail" },
    summary: { ja: "1件の観察を、同定・場所・文脈ごと読む。", en: "Read one observation with identification and place context." },
    visualQa: { smoke: true, viewports: ["desktop-1440"], expectedText: { ja: "この観察" }, requires: "occurrence", allowStatus: [200, 404], screenshot: { baselineName: "registry-observation-detail" } },
  },
  {
    path: "/learn",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "使い方と考え方", en: "Learn" },
    summary: { ja: "使い方、名前の調べ方、信頼性の考え方をまとめる。", en: "Guides for use, identification, and trust." },
    marketing: { pageKey: "learnIndex" },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "まず読むページ" }, readySelector: "body", screenshot: { baselineName: "registry-learn" } },
  },
  {
    path: "/about",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ikimon について", en: "About" },
    summary: { ja: "自然を楽しむ入口から始める理由。", en: "Why ikimon starts with enjoying nature." },
    marketing: { pageKey: "about" },
    legacyRedirects: ["/about.php"],
  },
  {
    path: "/learn/identification-basics",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "名前が分からないとき", en: "Identification basics" },
    summary: { ja: "分からないままでも残せる記録の作り方。", en: "How to record well even before knowing the name." },
    marketing: { pageKey: "learnIdentificationBasics" },
    legacyRedirects: ["/guides.php"],
  },
  {
    path: "/learn/methodology",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "研究・データ・信頼性", en: "Methodology" },
    summary: { ja: "AI と人の役割、信頼レーン、言いすぎない線引き。", en: "AI and human roles, trust lanes, and claim boundaries." },
    marketing: { pageKey: "learnMethodology" },
    legacyRedirects: ["/guidelines.php", "/learn/authority-policy", "/methodology.php"],
  },
  {
    path: "/learn/field-loop",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "観察の流れ", en: "Field loop" },
    summary: { ja: "見つける、記録する、また歩く流れ。", en: "The loop of finding, recording, and walking again." },
    marketing: { pageKey: "learnFieldLoop" },
  },
  {
    path: "/learn/glossary",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "用語集", en: "Glossary" },
    summary: { ja: "説明に出てくる言葉を、やさしい言い方で確認する。", en: "Plain-language glossary for terms used in ikimon." },
    marketing: { pageKey: "learnGlossary" },
  },
  {
    path: "/learn/updates",
    lane: "learn",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "更新情報", en: "Updates" },
    summary: { ja: "何が変わったかを使いやすさの変化として見る。", en: "Release updates framed as product changes." },
    marketing: { pageKey: "learnUpdates" },
    legacyRedirects: ["/updates.php"],
  },
  {
    path: "/faq",
    lane: "trust",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "よくある質問", en: "FAQ" },
    summary: { ja: "個人利用・公開範囲・団体相談の迷いどころ。", en: "Common questions on personal use, visibility, and group use." },
    marketing: { pageKey: "faq" },
    legacyRedirects: ["/faq.php"],
  },
  {
    path: "/privacy",
    lane: "trust",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "プライバシー", en: "Privacy" },
    summary: { ja: "位置情報と公開範囲の扱い。", en: "How location and visibility are handled." },
    marketing: { pageKey: "privacy" },
    legacyRedirects: ["/privacy.php"],
  },
  {
    path: "/terms",
    lane: "trust",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "利用規約", en: "Terms" },
    summary: { ja: "安全に記録を残すための要点。", en: "Terms for safe observation records." },
    marketing: { pageKey: "terms" },
    legacyRedirects: ["/terms.php"],
  },
  {
    path: "/contact",
    lane: "trust",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "お問い合わせ", en: "Contact" },
    summary: { ja: "個人利用・学校・地域利用の相談窓口。", en: "Contact for personal, school, and local use." },
    marketing: { pageKey: "contact", prepend: "contactForm" },
    legacyRedirects: ["/contact.php"],
  },
  {
    path: "/community",
    lane: "group",
    audience: "public",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "みんなで調べる", en: "Community" },
    summary: { ja: "濃い SNS ではなく、一人の観察を主役にした薄いつながり。", en: "A light connection layer around individual observations, not a heavy social network." },
    primaryAction: { href: "/record", label: { ja: "まず1件残す", en: "Record one observation" } },
    marketing: { pageKey: "community" },
    legacyRedirects: ["/events.php", "/survey.php", "/bingo.php", "/event_detail.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "みんなで調べる入口" }, readySelector: "body", screenshot: { baselineName: "registry-community" } },
  },
  {
    path: "/community/events",
    lane: "group",
    audience: "public",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "観察会", en: "Observation events" },
    summary: {
      ja: "AI が現場を読み、班でリアルタイム協力する観察会。",
      en: "Realtime cooperative bioblitz where AI reads the field and teams move together.",
    },
    primaryAction: { href: "/community/events", label: { ja: "観察会一覧", en: "Browse events" } },
    legacyRedirects: ["/event_detail.php", "/bioblitz_join.php", "/event_dashboard.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "観察会 OS" }, readySelector: ".evt-hero", screenshot: { baselineName: "registry-observation-events" } },
  },
  {
    path: "/community/fields",
    lane: "group",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "フィールド DB", en: "Field database" },
    summary: {
      ja: "自然共生サイト・TSUNAG・自分の観察フィールドを横断検索する。",
      en: "Search 自然共生サイト / TSUNAG and your own saved observation fields.",
    },
    primaryAction: { href: "/community/fields", label: { ja: "フィールドを探す", en: "Browse fields" } },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "フィールド DB" }, readySelector: ".evt-hero", screenshot: { baselineName: "registry-observation-fields" } },
  },
  {
    path: "/for-business",
    lane: "business",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "団体相談", en: "Group use" },
    summary: { ja: "学校や地域で小さく始めるための入口。", en: "Entry point for schools and local groups." },
    marketing: { pageKey: "forBusiness" },
    legacyRedirects: ["/for-business.php", "/for-business/index.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "学校や地域で始めたい" }, readySelector: "body", screenshot: { baselineName: "registry-for-business" } },
  },
  {
    path: "/for-business/pricing",
    lane: "business",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "連携の始め方", en: "Pricing" },
    summary: { ja: "最初から重い契約にせず、場所ごとに始める。", en: "Start by place before introducing heavier contracts." },
    marketing: { pageKey: "forBusinessPricing" },
    legacyRedirects: ["/pricing.php", "/for-business/pricing.php"],
  },
  {
    path: "/for-business/demo",
    lane: "business",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "画面を見る", en: "Demo" },
    summary: { ja: "公開中の画面で、団体運用の始め方を確認する。", en: "Use the real public pages to inspect group workflows." },
    marketing: { pageKey: "forBusinessDemo" },
    legacyRedirects: ["/for-business/demo.php"],
  },
  {
    path: "/for-business/status",
    lane: "business",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "相談前の状態", en: "Status" },
    summary: { ja: "今できることと、これから整えること。", en: "What is ready now and what comes next." },
    marketing: { pageKey: "forBusinessStatus" },
    legacyRedirects: ["/for-business/status.php"],
  },
  {
    path: "/for-business/apply",
    lane: "business",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "団体相談を送る", en: "Apply" },
    summary: { ja: "学校・地域・イベント利用の相談フォーム。", en: "Inquiry page for school, local, or event use." },
    marketing: { pageKey: "forBusinessApply" },
    legacyRedirects: ["/for-business/apply.php", "/for-business/create.php"],
  },
  {
    path: "/for-researcher/apply",
    lane: "research",
    audience: "researcher",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "研究利用の相談", en: "Research inquiry" },
    summary: { ja: "研究利用の目的、対象地域、必要な粒度を相談する。", en: "Discuss research use, target areas, and data granularity." },
    marketing: { pageKey: "forResearcherApply", prepend: "contactForm" },
  },
  {
    path: "/specialist/id-workbench",
    lane: "specialist",
    audience: "specialist",
    auth: "specialist",
    navVisibility: ["qa"],
    title: { ja: "専門家確認", en: "ID workbench" },
    summary: { ja: "同定待ちの観察を、権限範囲に応じて確認する。", en: "Review observations within authority scope." },
    legacyRedirects: ["/id_workbench.php", "/id_center.php", "/needs_id.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "専門家レビュー" }, requires: "specialistDenied", allowStatus: [403], screenshot: { baselineName: "registry-specialist-id-workbench-denied" } },
  },
  {
    path: "/specialist/recommendations",
    lane: "specialist",
    audience: "specialist",
    auth: "specialist",
    navVisibility: ["qa"],
    title: { ja: "専門家推薦", en: "Specialist recommendations" },
    summary: { ja: "authority 候補と pending recommendation を処理する。", en: "Resolve authority recommendations." },
  },
  {
    path: "/specialist/review-queue",
    lane: "specialist",
    audience: "specialist",
    auth: "specialist",
    navVisibility: ["qa"],
    title: { ja: "レビューキュー", en: "Review queue" },
    summary: { ja: "広めの triage と review action を確認する。", en: "Review broad triage and actions." },
    legacyRedirects: ["/review_queue.php"],
  },
  {
    path: "/specialist/authority-admin",
    lane: "specialist",
    audience: "operator",
    auth: "admin",
    navVisibility: ["qa"],
    title: { ja: "Authority 管理", en: "Authority admin" },
    summary: { ja: "分類群 authority の grant / revoke を扱う。", en: "Grant and revoke taxon authority." },
  },
  {
    path: "/specialist/authority-audit",
    lane: "specialist",
    audience: "operator",
    auth: "admin",
    navVisibility: ["qa"],
    title: { ja: "Authority 監査", en: "Authority audit" },
    summary: { ja: "authority の変更履歴を確認する。", en: "Inspect authority audit history." },
  },
  {
    path: "/authority/recommendations",
    lane: "specialist",
    audience: "member",
    auth: "session",
    navVisibility: ["qa"],
    title: { ja: "推薦を見る", en: "Authority recommendations" },
    summary: { ja: "自分への authority recommendation を見る。", en: "See authority recommendations for the signed-in user." },
  },
  {
    path: "/qa/site-map",
    lane: "ops",
    audience: "operator",
    auth: "public",
    navVisibility: ["qa"],
    title: { ja: "QA サイトマップ", en: "QA sitemap" },
    summary: { ja: "ステージング確認用の全体導線。", en: "Full route map for staging QA." },
  },
  {
    path: "/healthz",
    lane: "ops",
    audience: "operator",
    auth: "system",
    navVisibility: ["qa"],
    title: { ja: "Health", en: "Health" },
    summary: { ja: "サービスの生存確認。", en: "Service liveness check." },
  },
  {
    path: "/readyz",
    lane: "ops",
    audience: "operator",
    auth: "system",
    navVisibility: ["qa"],
    title: { ja: "Ready", en: "Ready" },
    summary: { ja: "起動準備状態の確認。", en: "Readiness check." },
  },
];

export function sitePageLabel(page: SitePageDefinition, lang: string = "ja"): string {
  return lang === "en" ? page.title.en : page.title.ja;
}

export function sitePageSummary(page: SitePageDefinition, lang: string = "ja"): string {
  return lang === "en" ? page.summary.en : page.summary.ja;
}

export function listSitePages(): SitePageDefinition[] {
  return [...SITE_PAGE_DEFINITIONS];
}

export function listPagesByVisibility(visibility: "header" | "footer" | "qa" | "xml"): SitePageDefinition[] {
  return SITE_PAGE_DEFINITIONS.filter((page) => page.navVisibility.includes(visibility));
}

export function listPagesByLane(lane: RouteLane, visibility?: "header" | "footer" | "qa" | "xml"): SitePageDefinition[] {
  return SITE_PAGE_DEFINITIONS.filter((page) => page.lane === lane && (!visibility || page.navVisibility.includes(visibility)));
}

export function listMarketingPages(): SitePageDefinition[] {
  return SITE_PAGE_DEFINITIONS.filter((page) => page.marketing);
}

export function listVisualQaPages(): SitePageDefinition[] {
  return SITE_PAGE_DEFINITIONS.filter((page) => page.visualQa?.smoke);
}

export function visualQaViewport(name: VisualQaViewportName): VisualQaViewport {
  return VISUAL_QA_VIEWPORTS[name];
}

export function materializeSitePagePath(
  page: SitePageDefinition,
  context: SitePageMaterializationContext = {},
): string {
  if (page.path === "/record" && context.userId) {
    return `/record?userId=${encodeURIComponent(context.userId)}`;
  }
  if (page.path === "/home" && context.userId) {
    return `/home?userId=${encodeURIComponent(context.userId)}`;
  }
  if (page.path === "/profile/:userId") {
    return context.userId ? `/profile/${encodeURIComponent(context.userId)}` : "/profile";
  }
  if (page.path === "/observations/:id") {
    const detailId = context.visitId ?? context.occurrenceId;
    if (!detailId) {
      return "/observations/missing";
    }
    const path = `/observations/${encodeURIComponent(detailId)}`;
    return context.occurrenceId ? `${path}?subject=${encodeURIComponent(context.occurrenceId)}` : path;
  }
  return page.path;
}

export function legacyRedirectEntries(): Array<{ source: string; target: string }> {
  return SITE_PAGE_DEFINITIONS.flatMap((page) =>
    (page.legacyRedirects ?? []).map((source) => ({ source, target: page.path })),
  );
}

export function xmlSitemapPages(): SitePageDefinition[] {
  return listPagesByVisibility("xml").filter((page) => !page.path.includes(":"));
}

type MarketingPageMeta = {
  bodyPageId: string;
};

export function localizedPageLangs(page: SitePageDefinition): SiteLang[] {
  if (!page.marketing) {
    return supportedLanguages.map((language) => language.code);
  }
  return supportedLanguages
    .map((language) => language.code)
    .filter((lang) => {
      if (lang === "ja") {
        return true;
      }
      const metaPath = `marketing.pages.${page.marketing!.pageKey}`;
      if (!hasLocalizedShortCopy(lang, "public", metaPath)) {
        return false;
      }
      const meta = getShortCopy<MarketingPageMeta>(lang, "public", metaPath);
      return hasLocalizedLongform(lang, meta.bodyPageId);
    });
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildXmlSitemap(origin: string, today = new Date()): string {
  const base = normalizeOrigin(origin || "https://ikimon.life");
  const lastmod = today.toISOString().slice(0, 10);
  const urls = xmlSitemapPages()
    .flatMap((page) => {
      const langs = localizedPageLangs(page);
      return langs.map((lang) => {
        const localizedPath = appendLangToHref(page.path, lang);
        const alternates = langs
          .map((alternateLang) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(alternateLang)}" href="${escapeXml(`${base}${appendLangToHref(page.path, alternateLang)}`)}" />`)
          .join("\n");
        const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${base}${appendLangToHref(page.path, "ja")}`)}" />`;
        return `  <url>
    <loc>${escapeXml(`${base}${localizedPath}`)}</loc>
    <lastmod>${lastmod}</lastmod>
${alternates}
${xDefault}
  </url>`;
      });
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

export function buildRobotsTxt(origin: string): string {
  const base = normalizeOrigin(origin || "https://ikimon.life");
  return `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
LLMs: ${base}/llms.txt
`;
}
