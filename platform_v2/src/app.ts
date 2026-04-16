import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "./i18n.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWriteRoutes } from "./routes/write.js";
import { registerUiKpiRoutes } from "./routes/uiKpi.js";
import { getSessionFromCookie } from "./services/authSession.js";
import { resolveViewer } from "./services/viewerIdentity.js";
import { getLandingSnapshot } from "./services/landingSnapshot.js";
import type { LandingSnapshot } from "./services/readModels.js";
import { FIELD_NOTE_MAIN_STYLES, renderFieldNoteMain } from "./ui/fieldNoteMain.js";
import { MAP_MINI_STYLES, mapMiniBootScript, renderMapMini, toMapPoints } from "./ui/mapMini.js";
import { OBSERVATION_CARD_STYLES } from "./ui/observationCard.js";
import { QUICK_NAV_STYLES, renderQuickNav } from "./ui/quickNav.js";
import { TOOL_CARD_STYLES, renderToolCard } from "./ui/toolCard.js";
import { escapeHtml, renderSiteDocument } from "./ui/siteShell.js";

type PreviewContext = {
  basePath: string;
  userId: string;
  occurrenceId: string;
  usesDemoFixture: boolean;
  stats: {
    observationCount: number;
    speciesCount: number;
    placeCount: number;
  };
};

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(getForwardedBasePath(request.headers), requestUrl(request));
}

const localizedNavHome: Record<SiteLang, string> = {
  ja: "ホーム",
  en: "Home",
  es: "Inicio",
  "pt-BR": "Início",
};

function landingCopy(lang: SiteLang) {
  const copy = {
    ja: {
      title: "ikimon — 歩いて、見つけて、ノートに残す",
      heroEyebrow: "ikimon へようこそ",
      heroHeading: "歩いて、見つけて、<span class=\"hero-emphasis\">ノートに残す。</span>",
      heroHeadingPlain: "歩いて、見つけて、ノートに残す。",
      heroLead: "散歩 × 生きもの観察で、自然を守りながら健康に。あなたの一歩が科学データになる。",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("ja-JP")} 件の観察 · ${species.toLocaleString("ja-JP")} 種`,
      actionPrimaryLoggedIn: "ノートの続きを書く",
      actionPrimaryGuest: "ノートを始める",
      actionSecondary: "探索マップを見る",
      toolSectionEyebrow: "もっと観察を楽しむ",
      toolSectionTitle: "ノートをもっと楽しむための 2 つの機能",
      toolSectionLead: "名前が分からなくても、どこに行けば発見があるか分からなくても大丈夫。AI と地図がそっとサポートします。",
      tools: {
        lens: {
          eyebrow: "AIレンズ",
          title: "散歩中の AI ガイドを準備中",
          body: "AIレンズは、本来は歩きながら周囲の生きものを案内する入口です。v2 ではまずノートと記録導線を先に整えています。",
          cta: "AIレンズを見る",
          badge: "beta",
        },
        scan: {
          eyebrow: "フィールドスキャン",
          title: "歩きながら、近くの生きものが分かる",
          body: "今いる場所の近くで、どんな生きものが見つかっているかを地図上で確認できます。散歩のルート選びに。",
          cta: "フィールドスキャンを見る",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "マップで見る",
      mapSectionTitle: "観察した場所を、地図で振り返る",
      mapSectionLead: "あなたと他の方が記録した観察が、どの場所に積み重なっているかを地図で確認できます。",
      mapCta: "マップを開く",
      mapEmpty: "まだ地図に載せる観察がありません",
      bizEyebrow: "法人・団体のみなさまへ",
      bizTitle: "🏢 学校・自治体・企業での導入",
      bizBody: "観察会の運営から報告書の出力まで、組織でご活用いただけるプランをご用意しています。",
      bizCta: "法人向けページへ",
      footerNote: "歩いて、見つけて、ノートに残す。",
    },
    en: {
      title: "ikimon.life — Walk, find, write it in the notebook",
      heroEyebrow: "Welcome to ikimon",
      heroHeading: "Walk, find, <span class=\"hero-emphasis\">write it in the notebook.</span>",
      heroHeadingPlain: "Walk, find, write it in the notebook.",
      heroLead: "Walks + species observation protect nature while keeping you healthy. Your footstep becomes science data.",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("en-US")} observations · ${species.toLocaleString("en-US")} species`,
      actionPrimaryLoggedIn: "Keep writing",
      actionPrimaryGuest: "Start your notebook",
      actionSecondary: "See the map",
      toolSectionEyebrow: "Inputs to your notebook",
      toolSectionTitle: "Two ways to feed the notebook",
      toolSectionLead: "Field Note is the main feature. AI Lens and Field Scan are supporting inputs that make it easier to add another page.",
      tools: {
        lens: {
          eyebrow: "AI Lens",
          title: "Realtime AI guide is being prepared",
          body: "AI Lens is meant to guide nearby species while you walk. In v2, the notebook and record flow come first.",
          cta: "See AI Lens",
          badge: "beta",
        },
        scan: {
          eyebrow: "Field Scan",
          title: "Pick up the signal of species while walking",
          body: "The map suggests the next place to add to your notebook as a recommended survey area.",
          cta: "See Field Scan",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Explore map",
      mapSectionTitle: "See where your notebook has been on the map",
      mapSectionLead: "The map shows where you and others have stacked pages.",
      mapCta: "Open the full map",
      mapEmpty: "No observations on the map yet",
      bizEyebrow: "For Business",
      bizTitle: "For teams and organizations",
      bizBody: "Organize place-based nature records in a format that is easy to revisit later.",
      bizCta: "For Business",
      footerNote: "ikimon.life v2 — Walk, find, write it in the notebook.",
    },
    es: {
      title: "ikimon.life — Camina, descubre, escríbelo en el cuaderno",
      heroEyebrow: "Bienvenido a ikimon",
      heroHeading: "Camina, descubre, <span class=\"hero-emphasis\">escríbelo en el cuaderno.</span>",
      heroHeadingPlain: "Camina, descubre, escríbelo en el cuaderno.",
      heroLead: "Caminar y observar especies protege la naturaleza y tu salud. Tu paso se convierte en datos científicos.",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("es-ES")} observaciones · ${species.toLocaleString("es-ES")} especies`,
      actionPrimaryLoggedIn: "Seguir escribiendo",
      actionPrimaryGuest: "Comenzar tu cuaderno",
      actionSecondary: "Ver el mapa",
      toolSectionEyebrow: "Entradas al cuaderno",
      toolSectionTitle: "Dos formas de alimentar el cuaderno",
      toolSectionLead: "El cuaderno es la función principal. Lente IA y Escaneo son entradas de apoyo para añadir una página más fácil.",
      tools: {
        lens: {
          eyebrow: "Lente IA",
          title: "La guía IA en tiempo real está en preparación",
          body: "Lente IA está pensada para acompañar el paseo y señalar especies cercanas. En v2, primero priorizamos el cuaderno y el flujo de registro.",
          cta: "Ver Lente IA",
          badge: "beta",
        },
        scan: {
          eyebrow: "Escaneo de campo",
          title: "Capta la señal de especies mientras caminas",
          body: "El mapa sugiere el próximo lugar a añadir como área recomendada de estudio.",
          cta: "Ver Escaneo",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Mapa de exploración",
      mapSectionTitle: "Ver en el mapa dónde ha estado tu cuaderno",
      mapSectionLead: "El mapa muestra dónde tú y otros habéis apilado páginas.",
      mapCta: "Abrir el mapa",
      mapEmpty: "Aún no hay observaciones en el mapa",
      bizEyebrow: "Para organizaciones",
      bizTitle: "Para equipos y organizaciones",
      bizBody: "Ordena registros naturales por lugar para revisarlos más tarde con facilidad.",
      bizCta: "Para organizaciones",
      footerNote: "ikimon.life v2 — Camina, descubre, escríbelo en el cuaderno.",
    },
    "pt-BR": {
      title: "ikimon.life — Caminhe, descubra, escreva no caderno",
      heroEyebrow: "Bem-vindo ao ikimon",
      heroHeading: "Caminhe, descubra, <span class=\"hero-emphasis\">escreva no caderno.</span>",
      heroHeadingPlain: "Caminhe, descubra, escreva no caderno.",
      heroLead: "Caminhar e observar espécies protege a natureza e a sua saúde. Seu passo vira dado científico.",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("pt-BR")} observações · ${species.toLocaleString("pt-BR")} espécies`,
      actionPrimaryLoggedIn: "Continuar escrevendo",
      actionPrimaryGuest: "Começar seu caderno",
      actionSecondary: "Ver o mapa",
      toolSectionEyebrow: "Entradas no caderno",
      toolSectionTitle: "Duas formas de alimentar o caderno",
      toolSectionLead: "O caderno é a função principal. Lente IA e Escaneamento são entradas de apoio para adicionar mais páginas.",
      tools: {
        lens: {
          eyebrow: "Lente IA",
          title: "O guia IA em tempo real está em preparação",
          body: "A Lente IA foi pensada para guiar a caminhada e apontar espécies próximas. No v2, o foco inicial é o caderno e o fluxo de registro.",
          cta: "Ver Lente IA",
          badge: "beta",
        },
        scan: {
          eyebrow: "Escaneamento de campo",
          title: "Capte o sinal das espécies enquanto caminha",
          body: "O mapa sugere o próximo lugar para adicionar como área recomendada de estudo.",
          cta: "Ver Escaneamento",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Mapa",
      mapSectionTitle: "Veja no mapa onde seu caderno esteve",
      mapSectionLead: "O mapa mostra onde você e outros empilharam páginas.",
      mapCta: "Abrir o mapa completo",
      mapEmpty: "Ainda não há observações no mapa",
      bizEyebrow: "Para organizações",
      bizTitle: "Para equipes e organizações",
      bizBody: "Organize registros naturais por lugar em um formato fácil de revisitar depois.",
      bizCta: "Para organizações",
      footerNote: "ikimon.life v2 — Caminhe, descubra, escreva no caderno.",
    },
  } satisfies Record<SiteLang, {
    title: string;
    heroEyebrow: string;
    heroHeading: string;
    heroHeadingPlain: string;
    heroLead: string;
    statLabel: (obs: number, species: number) => string;
    actionPrimaryLoggedIn: string;
    actionPrimaryGuest: string;
    actionSecondary: string;
    toolSectionEyebrow: string;
    toolSectionTitle: string;
    toolSectionLead: string;
    tools: {
      lens: { eyebrow: string; title: string; body: string; cta: string; badge: string };
      scan: { eyebrow: string; title: string; body: string; cta: string; badge: string };
    };
    mapSectionEyebrow: string;
    mapSectionTitle: string;
    mapSectionLead: string;
    mapCta: string;
    mapEmpty: string;
    bizEyebrow: string;
    bizTitle: string;
    bizBody: string;
    bizCta: string;
    footerNote: string;
  }>;
  return copy[lang];
}

function buildFlowLink(basePath: string, href: string, label: string, note: string): string {
  return `<a class="card" href="${escapeHtml(withBasePath(basePath, href))}">
    <div class="eyebrow">qa lane</div>
    <h2>${escapeHtml(label)}</h2>
    <p>${escapeHtml(note)}</p>
    <span>Open</span>
  </a>`;
}

function buildLandingRootHtml(
  options: PreviewContext,
  lang: SiteLang,
  currentPath: string,
  snapshot: LandingSnapshot,
): string {
  const copy = landingCopy(lang);
  const isLoggedIn = Boolean(snapshot.viewerUserId);

  const stats = snapshot.stats;
  const statLine = stats.observationCount > 0
    ? copy.statLabel(stats.observationCount, stats.speciesCount)
    : "";

  const mapPoints = toMapPoints(snapshot.feed);
  const mapHref = appendLangToHref(withBasePath(options.basePath, "/map"), lang);

  const toolCardsHtml = `<div class="tool-card-grid">
    ${renderToolCard(options.basePath, lang, {
      icon: "🔍",
      eyebrow: copy.tools.lens.eyebrow,
      title: copy.tools.lens.title,
      body: copy.tools.lens.body,
      ctaLabel: copy.tools.lens.cta,
      href: "/lens",
      badge: copy.tools.lens.badge,
    })}
    ${renderToolCard(options.basePath, lang, {
      icon: "📡",
      eyebrow: copy.tools.scan.eyebrow,
      title: copy.tools.scan.title,
      body: copy.tools.scan.body,
      ctaLabel: copy.tools.scan.cta,
      href: "/scan",
      badge: copy.tools.scan.badge,
    })}
  </div>`;

  const mapSectionHtml = `<section class="section landing-map" aria-labelledby="landing-map-heading">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(copy.mapSectionEyebrow)}</div>
        <h2 id="landing-map-heading">${escapeHtml(copy.mapSectionTitle)}</h2>
        <p>${escapeHtml(copy.mapSectionLead)}</p>
      </div>
    </div>
    ${renderMapMini({
      points: mapPoints,
      mapHref,
      mapCtaLabel: copy.mapCta,
      emptyLabel: copy.mapEmpty,
      height: 280,
    })}
  </section>`;

  const toolsSectionHtml = `<section class="section landing-tools" aria-labelledby="landing-tools-heading">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(copy.toolSectionEyebrow)}</div>
        <h2 id="landing-tools-heading">${escapeHtml(copy.toolSectionTitle)}</h2>
        <p>${escapeHtml(copy.toolSectionLead)}</p>
      </div>
    </div>
    ${toolCardsHtml}
  </section>`;

  const bizSectionHtml = `<section class="section">
    <div class="grid">
      <div class="card">
        <div class="eyebrow">${escapeHtml(copy.bizEyebrow)}</div>
        <h2>${escapeHtml(copy.bizTitle)}</h2>
        <p>${escapeHtml(copy.bizBody)}</p>
        <div class="actions" style="margin-top:14px">
          <a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/for-business"), lang))}">${escapeHtml(copy.bizCta)}</a>
        </div>
      </div>
    </div>
  </section>`;

  const extraStyles = [
    OBSERVATION_CARD_STYLES,
    TOOL_CARD_STYLES,
    MAP_MINI_STYLES,
    FIELD_NOTE_MAIN_STYLES,
    QUICK_NAV_STYLES,
    `
  .tool-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 16px; }
  @media (max-width: 720px) { .tool-card-grid { grid-template-columns: 1fr; } }
  .landing-hero-stat { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 13px; font-weight: 800; letter-spacing: -.01em; }
  .landing-hero-stat::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.18); }
    `,
  ].join("\n");

  const heroSupplementHtml = statLine
    ? `<div class="landing-hero-stat">${escapeHtml(statLine)}</div>`
    : "";

  const heroAfterActionsHtml = `<div class="hero-chip-row">
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "主役はフィールドノート" : lang === "es" ? "El cuaderno es el centro" : lang === "pt-BR" ? "O caderno e o centro" : "Field Note first")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "AIレンズは入口" : lang === "es" ? "La IA abre la puerta" : lang === "pt-BR" ? "A IA abre a porta" : "AI Lens opens the door")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "地図で再訪理由が育つ" : lang === "es" ? "El mapa crea motivos para volver" : lang === "pt-BR" ? "O mapa cria motivos para voltar" : "Map grows revisit reasons")}</span>
  </div>`;

  const heroActionsFinal = isLoggedIn
    ? [
        { href: "/notes", label: copy.actionPrimaryLoggedIn },
        { href: "/map", label: copy.actionSecondary, variant: "secondary" as const },
      ]
    : [
        { href: "/record", label: copy.actionPrimaryGuest },
        { href: "/map", label: copy.actionSecondary, variant: "secondary" as const },
      ];

  return renderSiteDocument({
    basePath: options.basePath,
    title: copy.title,
    activeNav: localizedNavHome[lang],
    lang,
    currentPath,
    hero: {
      eyebrow: copy.heroEyebrow,
      heading: copy.heroHeadingPlain,
      headingHtml: copy.heroHeading,
      lead: copy.heroLead,
      tone: "light",
      align: "center",
      supplementHtml: heroSupplementHtml,
      actions: heroActionsFinal,
      afterActionsHtml: heroAfterActionsHtml,
    },
    belowHeroHtml: renderQuickNav(options.basePath, lang),
    extraStyles,
    body: `${renderFieldNoteMain(options.basePath, lang, snapshot)}
${toolsSectionHtml}
${mapSectionHtml}
${bizSectionHtml}
${mapMiniBootScript()}`,
    footerNote: copy.footerNote,
  });
}

function buildQASiteMapHtml(options: PreviewContext, lang: SiteLang, currentPath: string): string {
  const recordHref = options.userId
    ? `/record?userId=${encodeURIComponent(options.userId)}`
    : "/record";
  const homeHref = options.userId
    ? `/home?userId=${encodeURIComponent(options.userId)}`
    : "/home";
  const profileHref = options.userId
    ? `/profile/${encodeURIComponent(options.userId)}`
    : "/profile";
  const detailHref = options.occurrenceId
    ? `/observations/${encodeURIComponent(options.occurrenceId)}`
    : "/explore";

  return renderSiteDocument({
    basePath: options.basePath,
    title: "サイトマップ (運用向け) | ikimon",
    activeNav: localizedNavHome[lang],
    lang,
    currentPath,
    hero: {
      eyebrow: "staging qa",
      heading: "ページ遷移と確認面を、1枚で把握する。",
      lead: "本番リハーサル前の人間確認用マップです。デザイン確認だけでなく、どの導線がどこへ繋がるか、どこが 401/redirect/JSON になるかまで staging 上で一巡できます。",
      actions: [
        { href: "/", label: "Preview top" },
        { href: recordHref, label: "Start at record", variant: "secondary" },
        { href: "/for-business", label: "Check business", variant: "secondary" },
      ],
    },
    body: `<section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 1</div>
          <h2>Core User Journey</h2>
          <p>記録して、詳細を見て、プロフィールと explore で再訪理由を確認する主導線。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, recordHref, "Record", options.userId ? "staging user 付きで観察追加を確認。" : "user context が無いと 401 になる。")}
        ${buildFlowLink(options.basePath, detailHref, "Observation Detail", options.occurrenceId ? "最新 observation の詳細と identification を確認。" : "fixture が無い場合は explore に退避。")}
        ${buildFlowLink(options.basePath, homeHref, "Home", options.userId ? "My places と recent observations を確認。" : "userId が無い場合は共通 home shell を確認。")}
        ${buildFlowLink(options.basePath, profileHref, "Profile", options.userId ? "同じ user の places / observations を確認。" : "session か userId 前提の画面。")}
        ${buildFlowLink(options.basePath, "/explore", "Explore", "横断の一覧面。municipality / top taxa / recent observations を確認。")}
      </div>
      <div class="note">推奨確認順: <code>Record → Observation Detail → Home → Profile → Explore</code></div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 2</div>
          <h2>Public / Trust / Business</h2>
          <p>公開面の印象と、business 導線が old PHP URL に落ちず v2 で閉じるかを見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/about", "About", "思想、動機設計、Collective AI Growth Loop の見せ方を確認。")}
        ${buildFlowLink(options.basePath, "/faq", "FAQ", "個人利用、Public、v2 確認範囲の FAQ を確認。")}
        ${buildFlowLink(options.basePath, "/privacy", "Privacy", "trust page の最低限表示を確認。")}
        ${buildFlowLink(options.basePath, "/terms", "Terms", "利用条件の最低限表示を確認。")}
        ${buildFlowLink(options.basePath, "/contact", "Contact", "contact から business apply に繋がるか確認。")}
        ${buildFlowLink(options.basePath, "/for-business", "For Business", "business の親ページ。pricing / demo / status / apply へ分岐。")}
        ${buildFlowLink(options.basePath, "/for-business/pricing", "Pricing", "Community と Public の差が読めるか確認。")}
        ${buildFlowLink(options.basePath, "/for-business/demo", "Demo", "Explore / Record / Readiness の業務確認導線。")}
        ${buildFlowLink(options.basePath, "/for-business/status", "Status", "readiness の業務向け説明面。")}
        ${buildFlowLink(options.basePath, "/for-business/apply", "Apply", "導入相談の固定面。フォーム置換前の見せ方を確認。")}
      </div>
      <div class="note">redirect check も重要です。<code>/about.php</code>, <code>/for-business.php</code>, <code>/for-business/apply.php</code> が v2 path に寄るか確認対象です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 3</div>
          <h2>Specialist Review</h2>
          <p>thin entry ではなく、review read/action が v2 側で回るかを見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/specialist/id-workbench", "ID Workbench", "default lane の queue と action form を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/id-workbench?lane=public-claim", "Public Claim Lane", "public claim 用 lane 表示を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/id-workbench?lane=expert-lane", "Expert Lane", "expert lane の queue と action を確認。")}
        ${buildFlowLink(options.basePath, "/specialist/review-queue", "Review Queue", "review sample と approve / reject / note を確認。")}
      </div>
      <div class="note">旧 URL の <code>/id_workbench.php</code> と <code>/review_queue.php</code> は redirect 確認対象です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">flow 4</div>
          <h2>Ops / Release Gate</h2>
          <p>人間のデザイン確認と、切替前判定面を混ぜずに見る。</p>
        </div>
      </div>
      <div class="grid">
        ${buildFlowLink(options.basePath, "/ops/readiness", "Ops Readiness", "near_ready / drift / rollback safety の確認。")}
        ${buildFlowLink(options.basePath, "/healthz", "Health", "service health endpoint の確認。")}
      </div>
      <div class="note">ブラウザ確認はこの page map と public/core/specialist を優先し、JSON endpoint は最後に health/readiness だけ見れば十分です。</div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <div class="eyebrow">checklist</div>
          <h2>人間確認で見るべきこと</h2>
          <p>MECE に漏れなく、リハーサル前に潰すべき観点だけ絞る。</p>
        </div>
      </div>
      <div class="list">
        <div class="row"><strong>Visual</strong><div class="meta">hero / card / button の崩れ、英日混在、CTA 密度、モバイル幅での詰まり。</div></div>
        <div class="row"><strong>Transition</strong><div class="meta">主要導線が 200 / redirect / 401 の想定どおりか。迷子導線や dead end がないか。</div></div>
        <div class="row"><strong>State</strong><div class="meta">userId あり/なし、occurrence あり/なしで説明不足や壊れ方が雑でないか。</div></div>
        <div class="row"><strong>Legacy drift</strong><div class="meta">旧 PHP URL が v2 に寄るか。公開導線から PHP surface に着地しないか。</div></div>
        <div class="row"><strong>Release gate</strong><div class="meta">最後に <code>/ops/readiness</code> と <code>/healthz</code> を見て、デザイン確認と運用確認を切り分ける。</div></div>
      </div>
    </section>`,
    footerNote: "staging walkthrough for full-page QA. use this after the shared shell migration to inspect actual website movement and visual consistency.",
  });
}

async function getPreviewContext(): Promise<PreviewContext> {
  const empty: PreviewContext = {
    basePath: "",
    userId: "",
    occurrenceId: "",
    usesDemoFixture: false,
    stats: { observationCount: 0, speciesCount: 0, placeCount: 0 },
  };
  let pool;
  try {
    pool = getPool();
  } catch {
    return empty;
  }
  const demoUserQuery = `
    select user_id
    from users
    where user_id like 'sample-cadence-%-user'
       or user_id like 'staging-session-smoke-%-user'
       or user_id like 'staging-write-smoke-%-user'
    order by created_at desc
    limit 1
  `;
  const demoOccurrenceQuery = `
    select occurrence_id
    from occurrences
    where occurrence_id like 'occ:sample-cadence-%'
       or occurrence_id like 'occ:staging-session-smoke-%'
       or occurrence_id like 'occ:staging-write-smoke-%'
    order by created_at desc
    limit 1
  `;
  const latestUserQuery = `
    select user_id
    from users
    order by created_at desc
    limit 1
  `;
  const latestOccurrenceQuery = `
    select occurrence_id
    from occurrences
    order by created_at desc
    limit 1
  `;
  const statsQuery = `
    select
      (select count(*) from occurrences)::int as observation_count,
      (select count(distinct scientific_name) from occurrences where scientific_name is not null and scientific_name <> '')::int as species_count,
      (select count(*) from places)::int as place_count
  `;

  let demoUser: { rows: Array<{ user_id: string }> } = { rows: [] };
  let demoOccurrence: { rows: Array<{ occurrence_id: string }> } = { rows: [] };
  let latestUser: { rows: Array<{ user_id: string }> } = { rows: [] };
  let latestOccurrence: { rows: Array<{ occurrence_id: string }> } = { rows: [] };
  let statsResult: { rows: Array<{ observation_count: number; species_count: number; place_count: number }> } = { rows: [] };
  try {
    [demoUser, demoOccurrence, latestUser, latestOccurrence, statsResult] = await Promise.all([
      pool.query<{ user_id: string }>(demoUserQuery),
      pool.query<{ occurrence_id: string }>(demoOccurrenceQuery),
      pool.query<{ user_id: string }>(latestUserQuery),
      pool.query<{ occurrence_id: string }>(latestOccurrenceQuery),
      pool.query<{ observation_count: number; species_count: number; place_count: number }>(statsQuery),
    ]);
  } catch {
    return empty;
  }

  const userId = demoUser.rows[0]?.user_id ?? latestUser.rows[0]?.user_id ?? "";
  const occurrenceId = demoOccurrence.rows[0]?.occurrence_id ?? latestOccurrence.rows[0]?.occurrence_id ?? "";

  const row = statsResult.rows[0];
  return {
    basePath: "",
    userId,
    occurrenceId,
    usesDemoFixture: Boolean(demoUser.rows[0]?.user_id || demoOccurrence.rows[0]?.occurrence_id),
    stats: {
      observationCount: row?.observation_count ?? 0,
      speciesCount: row?.species_count ?? 0,
      placeCount: row?.place_count ?? 0,
    },
  };
}

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get("/", async (request, reply) => {
    const accept = String(request.headers.accept ?? "");
    if (accept.includes("text/html")) {
      const context = await getPreviewContext();
      context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
      const lang = detectLangFromUrl(requestUrl(request));
      const session = await getSessionFromCookie(request.headers.cookie);
      const { viewerUserId } = resolveViewer(request.query, session);
      const snapshot = await getLandingSnapshot(viewerUserId);
      reply.type("text/html; charset=utf-8");
      return buildLandingRootHtml(
        context,
        lang,
        requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
        snapshot,
      );
    }

    return {
      service: "ikimon-platform-v2",
      status: "bootstrapping",
    };
  });

  app.get("/qa/site-map", async (request, reply) => {
    const context = await getPreviewContext();
    context.basePath = getForwardedBasePath(request.headers as Record<string, unknown>);
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return buildQASiteMapHtml(context, lang, requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }));
  });

  void registerHealthRoutes(app);
  void registerMarketingRoutes(app);
  void registerReadRoutes(app);
  void registerWriteRoutes(app);
  void registerUiKpiRoutes(app);
  void registerOpsRoutes(app);

  return app;
}
