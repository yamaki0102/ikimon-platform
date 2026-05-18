import { appendLangToHref, supportedLanguages, type SiteLang } from "./i18n.js";
import { getShortCopy, hasLocalizedLongform, hasLocalizedShortCopy } from "./content/index.js";
import { invasiveSpeciesDetailPath, INVASIVE_SPECIES_LIST_PATH, listInvasiveSpecies } from "./services/invasiveSpeciesCatalog.js";

export type RouteLane =
  | "start"
  | "learn"
  | "trust"
  | "group"
  | "business"
  | "research"
  | "specialist"
  | "ops";

export type SiteShellLayoutKind = "home" | "standard" | "wide" | "reading" | "narrow" | "immersive";

export type SitePageDefinition = {
  path: string;
  lane: RouteLane;
  audience: "public" | "visitor" | "member" | "business" | "researcher" | "specialist" | "operator";
  auth: "public" | "session" | "specialist" | "admin" | "system";
  layout: SiteShellLayoutKind;
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

function normalizeSiteMapPath(path: string): string {
  const langCodes = new Set(supportedLanguages.map((language) => language.code.toLowerCase()));
  let pathname = "/";
  try {
    pathname = new URL(path, "https://ikimon.local").pathname;
  } catch {
    pathname = path.split("?", 1)[0] || "/";
  }
  const segments = pathname.split("/").filter(Boolean);
  const maybeLang = segments[0];
  if (maybeLang && langCodes.has(maybeLang.toLowerCase())) {
    pathname = `/${segments.slice(1).join("/")}` || "/";
  }
  return pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
}

function routePatternMatches(pattern: string, pathname: string): boolean {
  const normalizedPattern = normalizeSiteMapPath(pattern);
  if (!normalizedPattern.includes(":")) {
    return normalizedPattern === pathname;
  }
  const patternParts = normalizedPattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) {
    return false;
  }
  return patternParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function sitePageLayout(page: SitePageDefinition): SiteShellLayoutKind {
  return page.layout;
}

export function getSiteShellLayoutForPath(path: string): SiteShellLayoutKind | undefined {
  const pathname = normalizeSiteMapPath(path);
  const page = SITE_PAGE_DEFINITIONS.find((definition) => routePatternMatches(definition.path, pathname));
  return page ? sitePageLayout(page) : undefined;
}

export const SITE_PAGE_DEFINITIONS: SitePageDefinition[] = [
  {
    path: "/",
    lane: "start",
    layout: "home",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "トップ", en: "Home" },
    summary: { ja: "Enjoy Life の思想から、身近な生きものの観察と地域の自然記録へ進む入口。", en: "The entry point for enjoying life through nearby nature and starting a record." },
    primaryAction: { href: "/record", label: { ja: "記録する", en: "Record" } },
    legacyRedirects: ["/index.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "みんなの記録" }, readySelector: "body", screenshot: { baselineName: "registry-top" } },
  },
  {
    path: "/record",
    lane: "start",
    layout: "narrow",
    audience: "member",
    auth: "session",
    navVisibility: ["footer", "qa"],
    title: { ja: "記録する", en: "Record" },
    summary: { ja: "写真・場所・時間・メモを残す。未ログイン時は開始案内を表示。", en: "Record photo, place, time, and notes. Visitors see a start guide." },
    primaryAction: { href: "/record", label: { ja: "記録を始める", en: "Start recording" } },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "記録" }, readySelector: "body", allowStatus: [200], screenshot: { baselineName: "registry-record-start" } },
  },
  {
    path: "/guide",
    lane: "start",
    layout: "immersive",
    audience: "visitor",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ライブガイド", en: "Live Guide" },
    summary: { ja: "映像と音から、その場の環境手がかりを足跡として残す。", en: "Use camera and audio to save field context as guide traces." },
    primaryAction: { href: "/guide", label: { ja: "ガイドを開く", en: "Open Guide" } },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "ライブガイド" }, readySelector: "body", screenshot: { baselineName: "registry-guide" } },
  },
  {
    path: "/guide/outcomes",
    lane: "start",
    layout: "wide",
    audience: "member",
    auth: "session",
    navVisibility: ["qa"],
    title: { ja: "ガイド成果", en: "Guide outcomes" },
    summary: { ja: "ライブガイドで見つけたことを、今日できたことと次の一歩に絞って見返す。", en: "Review what Guide captured and choose one next step." },
    primaryAction: { href: "/guide/outcomes", label: { ja: "成果を見る", en: "Review outcomes" } },
    visualQa: { smoke: true, viewports: ["desktop-1440"], expectedText: { ja: "ガイド成果を見るにはログインが必要です" }, allowStatus: [401, 200], readySelector: "body", screenshot: { baselineName: "registry-guide-outcomes" } },
  },
  {
    path: "/lens",
    lane: "start",
    layout: "immersive",
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
    layout: "immersive",
    audience: "visitor",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "地図", en: "Map" },
    summary: { ja: "観察が集まる場所と、次に歩く理由を見る。", en: "Find places with observations and reasons to walk next." },
    legacyRedirects: ["/scan"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "地図" }, readySelector: "#map-explorer", screenshot: { baselineName: "registry-map" } },
  },
  {
    path: "/records",
    lane: "start",
    layout: "wide",
    audience: "visitor",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "記録を見る", en: "Records" },
    summary: { ja: "自分の記録、公開観察、名前待ち、証拠メディア、場所を1つのワークベンチで見る。", en: "Browse personal records, public observations, records needing names, evidence media, and places in one workbench." },
    primaryAction: { href: "/record", label: { ja: "記録する", en: "Record" } },
    legacyRedirects: ["/zukan", "/zukan.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "記録を見る" }, readySelector: "[data-testid='records-workbench']", screenshot: { baselineName: "registry-records" } },
  },
  {
    path: "/home",
    lane: "start",
    layout: "wide",
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
    layout: "reading",
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
    layout: "wide",
    audience: "visitor",
    auth: "public",
    navVisibility: ["qa"],
    title: { ja: "観察詳細", en: "Observation detail" },
    summary: { ja: "1件の観察を、同定・場所・文脈ごと読む。", en: "Read one observation with identification and place context." },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "見つけたもの" }, requires: "occurrence", allowStatus: [200, 404], screenshot: { baselineName: "registry-observation-detail" } },
  },
  {
    path: "/learn",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "使い方と考え方", en: "Learn" },
    summary: { ja: "名前が分からない観察を、あとで活かせる記録にする。", en: "Guides for turning observations into useful records." },
    marketing: { pageKey: "learnIndex" },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "読みもの索引" }, readySelector: "body", screenshot: { baselineName: "registry-learn" } },
  },
  {
    path: "/about",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ikimon について", en: "About" },
    summary: { ja: "Enjoy Life と、身近な観察から自然との関係を取り戻す理由。", en: "Why ikimon starts with enjoying life through nature." },
    marketing: { pageKey: "about" },
    legacyRedirects: ["/about.php"],
  },
  {
    path: "/learn/identification-basics",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "名前が分からないとき", en: "Identification basics" },
    summary: { ja: "分からないままでも残せる記録の作り方。", en: "How to record well even before knowing the name." },
    marketing: { pageKey: "learnIdentificationBasics" },
    legacyRedirects: ["/guides.php"],
  },
  {
    path: "/learn/biodiversity",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "生物多様性の基礎", en: "Biodiversity basics" },
    summary: { ja: "生物多様性、生態系サービス、ネイチャーポジティブを暮らしから読む。", en: "Plain-language biodiversity basics." },
    marketing: { pageKey: "learnBiodiversity" },
  },
  {
    path: "/learn/citizen-science",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "市民科学と観察", en: "Citizen science" },
    summary: { ja: "市民の観察が科学や地域モニタリングへ接続する条件。", en: "How citizen observations support science." },
    marketing: { pageKey: "learnCitizenScience" },
  },
  {
    path: "/learn/policy-and-business",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "政策・企業活動と自然", en: "Policy and business" },
    summary: { ja: "30by30、自然共生サイト、TNFD、自然資本を重複なく整理する。", en: "Policy and business terms around biodiversity." },
    marketing: { pageKey: "learnPolicyBusiness" },
  },
  {
    path: "/learn/wellbeing",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "自然とウェルビーイング", en: "Nature and wellbeing" },
    summary: { ja: "自然との関係、注意回復、心身への示唆を言いすぎず読む。", en: "Nature and wellbeing without overclaiming." },
    marketing: { pageKey: "learnWellbeing" },
  },
  {
    path: "/learn/technology",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "自然観察とテクノロジー", en: "Nature technology" },
    summary: { ja: "AI、環境DNA、分類名、データセットを観察の信頼性から読む。", en: "AI, eDNA, taxonomy, and datasets." },
    marketing: { pageKey: "learnTechnology" },
  },
  {
    path: INVASIVE_SPECIES_LIST_PATH,
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "外来種一覧", en: "Invasive species" },
    summary: { ja: "外来種を見つけたときの安全行動と公式情報への導線。", en: "Safety notes and official sources for invasive species." },
  },
  {
    path: "/learn/invasive-species-reporting",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "外来種の情報提供", en: "Invasive species reporting" },
    summary: { ja: "外来種候補を見つけたとき、どこが何を求めているかと自動情報提供の境界を読む。", en: "What agencies need from invasive species sightings and when ikimon can share reports." },
    marketing: { pageKey: "learnInvasiveSpeciesReporting" },
  },
  {
    path: "/learn/methodology",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "研究・データ・信頼性", en: "Methodology" },
    summary: { ja: "観察記録を研究・地域活動・レポートで扱うための信頼設計。", en: "AI and human roles, trust lanes, and claim boundaries." },
    marketing: { pageKey: "learnMethodology" },
    legacyRedirects: ["/guidelines.php", "/learn/authority-policy", "/methodology", "/methodology.php"],
  },
  {
    path: "/learn/field-loop",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "観察の流れ", en: "Field loop" },
    summary: { ja: "見つける、観察する、記録する、学ぶ、また歩く流れ。", en: "The loop of finding, recording, and walking again." },
    marketing: { pageKey: "learnFieldLoop" },
  },
  {
    path: "/learn/glossary",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "用語集", en: "Glossary" },
    summary: { ja: "説明に出てくる言葉を、やさしい言い方で確認する。", en: "Plain-language glossary for terms used in ikimon." },
    marketing: { pageKey: "learnGlossary" },
  },
  {
    path: "/learn/biomonweek",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "BioMonWeek 2026を読む", en: "BioMonWeek 2026" },
    summary: { ja: "BioMonWeek 2026を、生物多様性モニタリングの論点から読む。", en: "A plain-language guide to BioMonWeek 2026 and biodiversity monitoring." },
    primaryAction: { href: "/record", label: { ja: "まず1件残す", en: "Record one observation" } },
    marketing: { pageKey: "learnBiomonweek" },
  },
  {
    path: "/learn/terms/biodiversity",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "生物多様性とは", en: "Biodiversity" },
    summary: { ja: "生態系、種、遺伝子の多様さを一語で読む。", en: "A plain-language term page for biodiversity." },
    marketing: { pageKey: "termBiodiversity" },
  },
  {
    path: "/learn/terms/ecosystem-services",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "生態系サービスとは", en: "Ecosystem services" },
    summary: { ja: "自然が暮らしや社会を支える働きを短く整理する。", en: "A plain-language term page for ecosystem services." },
    marketing: { pageKey: "termEcosystemServices" },
  },
  {
    path: "/learn/terms/nature-positive",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ネイチャーポジティブとは", en: "Nature positive" },
    summary: { ja: "自然の損失を止め、回復へ向ける考え方。", en: "A plain-language term page for nature positive." },
    marketing: { pageKey: "termNaturePositive" },
  },
  {
    path: "/learn/terms/30by30",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "30by30とは", en: "30by30" },
    summary: { ja: "2030年までに陸と海の30%以上を保全する目標。", en: "A plain-language term page for 30by30." },
    marketing: { pageKey: "term30by30" },
  },
  {
    path: "/learn/terms/nature-symbiosis-site",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "自然共生サイトとは", en: "Nature symbiosis site" },
    summary: { ja: "民間や地域の保全管理地を国が認定する制度。", en: "A plain-language term page for nature symbiosis sites." },
    marketing: { pageKey: "termNatureSymbiosisSite" },
  },
  {
    path: "/learn/terms/oecm",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "OECMとは", en: "OECM" },
    summary: { ja: "保護区以外で生物多様性保全に貢献している地域を評価する考え方。", en: "A plain-language term page for OECM." },
    marketing: { pageKey: "termOecm" },
  },
  {
    path: "/learn/terms/tnfd",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "TNFDとは", en: "TNFD" },
    summary: { ja: "自然関連の依存、影響、リスク、機会を開示する枠組み。", en: "A plain-language term page for TNFD." },
    marketing: { pageKey: "termTnfd" },
  },
  {
    path: "/learn/terms/natural-capital",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "自然資本とは", en: "Natural capital" },
    summary: { ja: "自然を社会や経済を支える資本として見る考え方。", en: "A plain-language term page for natural capital." },
    marketing: { pageKey: "termNaturalCapital" },
  },
  {
    path: "/learn/terms/biodiversity-credits",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "生物多様性クレジットとは", en: "Biodiversity credits" },
    summary: { ja: "自然の保全や回復を資金化する仕組みとして議論される考え方。", en: "A plain-language term page for biodiversity credits." },
    marketing: { pageKey: "termBiodiversityCredits" },
  },
  {
    path: "/learn/terms/kunming-montreal-gbf",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "昆明・モントリオール生物多様性枠組みとは", en: "Kunming-Montreal GBF" },
    summary: { ja: "2030年へ向けた国際的な生物多様性目標の枠組み。", en: "A plain-language term page for the Kunming-Montreal Global Biodiversity Framework." },
    marketing: { pageKey: "termKunmingMontrealGbf" },
  },
  {
    path: "/learn/terms/citizen-science",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "市民科学とは", en: "Citizen science" },
    summary: { ja: "一般の人が観察、記録、確認に参加する科学の進め方。", en: "A plain-language term page for citizen science." },
    marketing: { pageKey: "termCitizenScience" },
  },
  {
    path: "/learn/terms/biomonweek",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "BioMonWeekとは", en: "BioMonWeek" },
    summary: { ja: "2026年に始まった欧州の生物多様性モニタリング会議。", en: "A plain-language term page for BioMonWeek." },
    marketing: { pageKey: "termBiomonweek" },
  },
  {
    path: "/learn/terms/biodiversity-monitoring",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "生物多様性モニタリングとは", en: "Biodiversity monitoring" },
    summary: { ja: "同じ場所や条件で記録を重ね、生きものの変化を見守ること。", en: "A plain-language term page for biodiversity monitoring." },
    marketing: { pageKey: "termBiodiversityMonitoring" },
  },
  {
    path: "/learn/terms/participatory-monitoring",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "市民参加型モニタリングとは", en: "Participatory monitoring" },
    summary: { ja: "地域の人や参加者が継続的に観察を残す仕組み。", en: "A plain-language term page for participatory monitoring." },
    marketing: { pageKey: "termParticipatoryMonitoring" },
  },
  {
    path: "/learn/terms/fixed-point-observation",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "定点観察とは", en: "Fixed-point observation" },
    summary: { ja: "同じ場所をくり返し見て、季節や年ごとの変化を残す観察。", en: "A plain-language term page for fixed-point observation." },
    marketing: { pageKey: "termFixedPointObservation" },
  },
  {
    path: "/learn/terms/sampling-effort",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "観察努力量とは", en: "Sampling effort" },
    summary: { ja: "どれくらい探したかを表す時間、人数、距離、範囲などの情報。", en: "A plain-language term page for sampling effort." },
    marketing: { pageKey: "termSamplingEffort" },
  },
  {
    path: "/learn/terms/baseline",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ベースラインとは", en: "Baseline" },
    summary: { ja: "あとで変化を比べるための基準時点の状態。", en: "A plain-language term page for baseline records." },
    marketing: { pageKey: "termBaseline" },
  },
  {
    path: "/learn/terms/identification",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "同定とは", en: "Identification" },
    summary: { ja: "見つけた生きものの名前や分類を根拠と一緒に確かめること。", en: "A plain-language term page for identification." },
    marketing: { pageKey: "termIdentification" },
  },
  {
    path: "/learn/terms/ai-candidate",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "AI候補とは", en: "AI candidate" },
    summary: { ja: "AIが出す名前や見分け方のヒント。確定名ではない。", en: "A plain-language term page for AI candidates." },
    marketing: { pageKey: "termAiCandidate" },
  },
  {
    path: "/learn/terms/quick-capture",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "ふだんの記録とは", en: "Quick capture" },
    summary: { ja: "散歩や旅先の発見をまず残す軽い記録。", en: "A plain-language term page for quick capture." },
    marketing: { pageKey: "termQuickCapture" },
  },
  {
    path: "/learn/terms/survey",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "しっかり記録とは", en: "Survey" },
    summary: { ja: "対象、時間、努力量をそろえて残す調査型の記録。", en: "A plain-language term page for survey records." },
    marketing: { pageKey: "termSurvey" },
  },
  {
    path: "/learn/terms/evidence-tier",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "Evidence Tierとは", en: "Evidence Tier" },
    summary: { ja: "記録を研究や報告に使う強さで分ける信頼段階。", en: "A plain-language term page for Evidence Tier." },
    marketing: { pageKey: "termEvidenceTier" },
  },
  {
    path: "/learn/terms/open-dispute",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "open disputeとは", en: "Open dispute" },
    summary: { ja: "別分類、証拠不足、位置や日付の疑問など、未解決の反対意見。", en: "A plain-language term page for open dispute." },
    marketing: { pageKey: "termOpenDispute" },
  },
  {
    path: "/learn/terms/location-data",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "位置情報とは", en: "Location data" },
    summary: { ja: "観察した場所の情報。公開時は安全のため精度を落とす場合がある。", en: "A plain-language term page for location data." },
    marketing: { pageKey: "termLocationData" },
  },
  {
    path: "/learn/terms/rare-species",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "希少種とは", en: "Rare species" },
    summary: { ja: "保護上、位置情報や公開範囲に配慮が必要な生きもの。", en: "A plain-language term page for rare species." },
    marketing: { pageKey: "termRareSpecies" },
  },
  {
    path: "/learn/terms/environmental-dna",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "環境DNAとは", en: "Environmental DNA" },
    summary: { ja: "水、土、空気などに残る生物由来のDNAを調べる技術。", en: "A plain-language term page for environmental DNA." },
    marketing: { pageKey: "termEnvironmentalDna" },
  },
  {
    path: "/learn/terms/gbif",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "GBIFとは", en: "GBIF" },
    summary: { ja: "世界中の生物多様性データを共有する国際的な情報基盤。", en: "A plain-language term page for GBIF." },
    marketing: { pageKey: "termGbif" },
  },
  {
    path: "/learn/terms/darwin-core",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "Darwin Coreとは", en: "Darwin Core" },
    summary: { ja: "生物多様性データを交換しやすくするための標準語彙。", en: "A plain-language term page for Darwin Core." },
    marketing: { pageKey: "termDarwinCore" },
  },
  {
    path: "/learn/terms/dwca",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "DwC-Aとは", en: "DwC-A" },
    summary: { ja: "Darwin Core形式のデータをまとめて配布するためのアーカイブ形式。", en: "A plain-language term page for DwC-A." },
    marketing: { pageKey: "termDwca" },
  },
  {
    path: "/learn/terms/taxonomy-name",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "分類名とは", en: "Taxonomy name" },
    summary: { ja: "生きものを分類体系の中で扱うための名前。", en: "A plain-language term page for taxonomy names." },
    marketing: { pageKey: "termTaxonomyName" },
  },
  {
    path: "/learn/terms/dataset",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "データセットとは", en: "Dataset" },
    summary: { ja: "一定の目的や形式でまとめられた観察・標本などのデータ群。", en: "A plain-language term page for datasets." },
    marketing: { pageKey: "termDataset" },
  },
  {
    path: "/learn/terms/nature-connectedness",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "自然とのつながりとは", en: "Nature connectedness" },
    summary: { ja: "自然との関係を主観的に測る考え方。", en: "A plain-language term page for nature connectedness." },
    marketing: { pageKey: "termNatureConnectedness" },
  },
  {
    path: "/learn/terms/attention-restoration-theory",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "注意回復理論とは", en: "Attention Restoration Theory" },
    summary: { ja: "自然環境が疲れた注意を回復させる可能性を説明する理論。", en: "A plain-language term page for Attention Restoration Theory." },
    marketing: { pageKey: "termAttentionRestorationTheory" },
  },
  {
    path: "/learn/terms/biophilia-hypothesis",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "バイオフィリア仮説とは", en: "Biophilia hypothesis" },
    summary: { ja: "人には生命や自然に向かう傾向があるとする考え方。", en: "A plain-language term page for the biophilia hypothesis." },
    marketing: { pageKey: "termBiophiliaHypothesis" },
  },
  {
    path: "/learn/terms/one-health",
    lane: "learn",
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "One Healthとは", en: "One Health" },
    summary: { ja: "人、動物、環境の健康をつながったものとして扱う考え方。", en: "A plain-language term page for One Health." },
    marketing: { pageKey: "termOneHealth" },
  },
  {
    path: "/learn/updates",
    lane: "learn",
    layout: "reading",
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
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "よくある質問", en: "FAQ" },
    summary: { ja: "個人利用・公開範囲・企業や地域での活用の迷いどころ。", en: "Common questions on personal use, visibility, and group use." },
    marketing: { pageKey: "faq" },
    legacyRedirects: ["/faq.php"],
  },
  {
    path: "/privacy",
    lane: "trust",
    layout: "reading",
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
    layout: "reading",
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
    layout: "reading",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "お問い合わせ", en: "Contact" },
    summary: { ja: "個人利用・学校・地域・企業利用の相談窓口。", en: "Contact for personal, school, and local use." },
    marketing: { pageKey: "contact", prepend: "contactForm" },
    legacyRedirects: ["/contact.php"],
  },
  {
    path: "/community",
    lane: "group",
    layout: "wide",
    audience: "public",
    auth: "public",
    navVisibility: ["header", "footer", "qa", "xml"],
    title: { ja: "みんなで調べる", en: "Community" },
    summary: { ja: "一人の発見を主役に、同じ場所をみんなで見直す入口。", en: "A light connection layer around individual observations, not a heavy social network." },
    primaryAction: { href: "/record", label: { ja: "まず1件残す", en: "Record one observation" } },
    marketing: { pageKey: "community" },
    legacyRedirects: ["/events.php", "/survey.php", "/bingo.php", "/event_detail.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "小さな発見を、みんなで残す" }, readySelector: "body", screenshot: { baselineName: "registry-community" } },
  },
  {
    path: "/community/events",
    lane: "group",
    layout: "wide",
    audience: "public",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "観察会", en: "Observation events" },
    summary: {
      ja: "見つける楽しさを入口に、班で同じ場所を見直し、地域の記録に残す観察会。",
      en: "Realtime cooperative bioblitz where AI reads the field and teams move together.",
    },
    primaryAction: { href: "/community/events", label: { ja: "観察会一覧", en: "Browse events" } },
    legacyRedirects: ["/event_detail.php", "/bioblitz_join.php", "/event_dashboard.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "小さな発見を、みんなで地域の記録" }, readySelector: ".evt-hero", screenshot: { baselineName: "registry-observation-events" } },
  },
  {
    path: "/community/fields",
    lane: "group",
    layout: "wide",
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
    layout: "wide",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "企業・地域で活用", en: "Group use" },
    summary: { ja: "楽しんで続く観察を、企業・自治体・地域のアクションへつなげる入口。", en: "Entry point for schools and local groups." },
    marketing: { pageKey: "forBusiness" },
    legacyRedirects: ["/for-business.php", "/for-business/index.php"],
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "楽しんで続く観察を、地域のアクションへ" }, readySelector: "body", screenshot: { baselineName: "registry-for-business" } },
  },
  {
    path: "/impact",
    lane: "business",
    layout: "reading",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "社会実装と影響", en: "Impact" },
    summary: { ja: "ikimon.life がどの段階で地域・企業・自治体の行動につながるかを、言いすぎず整理する。", en: "How ikimon.life can support local and business action without overclaiming." },
    marketing: { pageKey: "impact" },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "小さな観察を、次の行動の材料へ" }, readySelector: "body", screenshot: { baselineName: "registry-impact" } },
  },
  {
    path: "/cases",
    lane: "business",
    layout: "reading",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "活用例", en: "Cases" },
    summary: { ja: "学校・地域・企業・自治体で、観察記録をどう使い始めるかの例。", en: "Example ways to start using observation records in schools, communities, companies, and municipalities." },
    marketing: { pageKey: "cases" },
    visualQa: { smoke: true, viewports: ["desktop-1440", "mobile-390"], expectedText: { ja: "使い方は、場所と目的から決める" }, readySelector: "body", screenshot: { baselineName: "registry-cases" } },
  },
  {
    path: "/for-business/pricing",
    lane: "business",
    layout: "wide",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "連携の始め方", en: "Pricing" },
    summary: { ja: "対象場所と参加者を決め、観察体験から段階的に始める。", en: "Start by place before introducing heavier contracts." },
    marketing: { pageKey: "forBusinessPricing" },
    legacyRedirects: ["/pricing.php", "/for-business/pricing.php"],
  },
  {
    path: "/for-business/invasive-reporting",
    lane: "business",
    layout: "reading",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "外来種自動情報提供", en: "Invasive reporting partnership" },
    summary: { ja: "自治体・機関向けに、自動で届く条件、共有情報、停止方法、AI判定の限界を説明する。", en: "How approved invasive species reporting works for agencies and municipalities." },
    marketing: { pageKey: "forBusinessInvasiveReporting" },
  },
  {
    path: "/for-business/demo",
    lane: "business",
    layout: "wide",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "画面を見る", en: "Demo" },
    summary: { ja: "公開中の画面で、参加者の観察からレポート活用までの流れを確認する。", en: "Use the real public pages to inspect group workflows." },
    marketing: { pageKey: "forBusinessDemo" },
    legacyRedirects: ["/for-business/demo.php"],
  },
  {
    path: "/for-business/status",
    lane: "business",
    layout: "wide",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "相談前の状態", en: "Status" },
    summary: { ja: "今使える入口と、継続運用・レポートへ広げる順番。", en: "What is ready now and what comes next." },
    marketing: { pageKey: "forBusinessStatus" },
    legacyRedirects: ["/for-business/status.php"],
  },
  {
    path: "/for-business/apply",
    lane: "business",
    layout: "wide",
    audience: "business",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "企業・地域相談を送る", en: "Apply" },
    summary: { ja: "学校・地域・企業利用、共同実証、レポート活用の相談フォーム。", en: "Inquiry page for school, local, or event use." },
    marketing: { pageKey: "forBusinessApply" },
    legacyRedirects: ["/for-business/apply.php", "/for-business/create.php"],
  },
  {
    path: "/for-researcher/apply",
    lane: "research",
    layout: "reading",
    audience: "researcher",
    auth: "public",
    navVisibility: ["footer", "qa", "xml"],
    title: { ja: "研究・レポート利用の相談", en: "Research inquiry" },
    summary: { ja: "研究利用、地域レポート、TNFD・30by30 文脈で必要な粒度を相談する。", en: "Discuss research use, target areas, and data granularity." },
    marketing: { pageKey: "forResearcherApply", prepend: "contactForm" },
  },
  {
    path: "/specialist/id-workbench",
    lane: "specialist",
    layout: "wide",
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
    layout: "wide",
    audience: "specialist",
    auth: "specialist",
    navVisibility: ["qa"],
    title: { ja: "専門家推薦", en: "Specialist recommendations" },
    summary: { ja: "authority 候補と pending recommendation を処理する。", en: "Resolve authority recommendations." },
  },
  {
    path: "/specialist/review-queue",
    lane: "specialist",
    layout: "wide",
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
    layout: "wide",
    audience: "operator",
    auth: "admin",
    navVisibility: ["qa"],
    title: { ja: "Authority 管理", en: "Authority admin" },
    summary: { ja: "分類群 authority の grant / revoke を扱う。", en: "Grant and revoke taxon authority." },
  },
  {
    path: "/specialist/authority-audit",
    lane: "specialist",
    layout: "wide",
    audience: "operator",
    auth: "admin",
    navVisibility: ["qa"],
    title: { ja: "Authority 監査", en: "Authority audit" },
    summary: { ja: "authority の変更履歴を確認する。", en: "Inspect authority audit history." },
  },
  {
    path: "/authority/recommendations",
    lane: "specialist",
    layout: "wide",
    audience: "member",
    auth: "session",
    navVisibility: ["qa"],
    title: { ja: "推薦を見る", en: "Authority recommendations" },
    summary: { ja: "自分への authority recommendation を見る。", en: "See authority recommendations for the signed-in user." },
  },
  {
    path: "/qa/site-map",
    lane: "ops",
    layout: "wide",
    audience: "operator",
    auth: "public",
    navVisibility: ["qa"],
    title: { ja: "QA サイトマップ", en: "QA sitemap" },
    summary: { ja: "ステージング確認用の全体導線。", en: "Full route map for staging QA." },
  },
  {
    path: "/healthz",
    lane: "ops",
    layout: "standard",
    audience: "operator",
    auth: "system",
    navVisibility: ["qa"],
    title: { ja: "Health", en: "Health" },
    summary: { ja: "サービスの生存確認。", en: "Service liveness check." },
  },
  {
    path: "/readyz",
    lane: "ops",
    layout: "standard",
    audience: "operator",
    auth: "system",
    navVisibility: ["qa"],
    title: { ja: "Ready", en: "Ready" },
    summary: { ja: "起動準備状態の確認。", en: "Readiness check." },
  },
];

export function sitePageLabel(page: SitePageDefinition, lang: string = "ja"): string {
  return lang === "ja" ? page.title.ja : page.title.en;
}

export function sitePageSummary(page: SitePageDefinition, lang: string = "ja"): string {
  return lang === "ja" ? page.summary.ja : page.summary.en;
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
      return "/records";
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

function invasiveSpeciesSitemapPaths(): string[] {
  return listInvasiveSpecies().map(invasiveSpeciesDetailPath);
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
  const staticUrls = xmlSitemapPages()
    .flatMap((page) => {
      const langs: SiteLang[] = ["ja"];
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
    });
  const invasiveUrls = invasiveSpeciesSitemapPaths().map((path) => {
    const localizedPath = appendLangToHref(path, "ja");
    const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${base}${localizedPath}`)}" />`;
    return `  <url>
    <loc>${escapeXml(`${base}${localizedPath}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="ja" href="${escapeXml(`${base}${localizedPath}`)}" />
${xDefault}
  </url>`;
  });
  const urls = [...staticUrls, ...invasiveUrls].join("\n");
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
