import Fastify from "fastify";
import { getPool } from "./db.js";
import { getForwardedBasePath, withBasePath } from "./httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "./i18n.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLegacyAssetRoutes } from "./routes/legacyAssets.js";
import { registerMapApiRoutes } from "./routes/mapApi.js";
import { registerMarketingRoutes } from "./routes/marketing.js";
import { registerOpsRoutes } from "./routes/ops.js";
import { registerReadRoutes } from "./routes/read.js";
import { registerWriteRoutes } from "./routes/write.js";
import { registerUiKpiRoutes } from "./routes/uiKpi.js";
import { registerGuideApiRoutes } from "./routes/guideApi.js";
import { registerWalkApiRoutes } from "./routes/walkApi.js";
import { registerResearchApiRoutes } from "./routes/researchApi.js";
import { getSessionFromCookie } from "./services/authSession.js";
import { resolveViewer } from "./services/viewerIdentity.js";
import { getLandingSnapshot } from "./services/landingSnapshot.js";
import type { LandingSnapshot } from "./services/readModels.js";
import { COMMUNITY_METER_STYLES, renderCommunityMeter } from "./ui/communityMeter.js";
import { DEMO_LOGIN_BANNER_STYLES, renderDemoLoginBanner } from "./ui/demoLoginBanner.js";
import { FIELD_NOTE_MAIN_STYLES, renderFieldNoteMain } from "./ui/fieldNoteMain.js";
import { MAP_MINI_STYLES, mapMiniBootScript, renderMapMini, toMapPoints } from "./ui/mapMini.js";
import { MENTOR_STRIP_STYLES, renderMentorStrip } from "./ui/mentorStrip.js";
import { OBSERVATION_CARD_STYLES } from "./ui/observationCard.js";
import { QUICK_NAV_STYLES, renderQuickNav } from "./ui/quickNav.js";
import { REVISIT_FLOW_STYLES, renderRevisitFlow } from "./ui/revisitFlow.js";
import { TODAY_HABIT_STYLES, renderTodayHabit } from "./ui/todayHabit.js";
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
      heroLead: "いつもの道で見つけた生きものを、場所と季節ごとに残す。読み返すたび、同じ道の見え方が変わってくる。",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("ja-JP")} 件の観察 · ${species.toLocaleString("ja-JP")} 種`,
      actionPrimaryLoggedIn: "ノートの続きを書く",
      actionPrimaryGuest: "ノートを始める",
      actionSecondary: "探索マップを見る",
      toolSectionEyebrow: "ノートを支える入口",
      toolSectionTitle: "再訪と記録を支える 2 つの補助線",
      toolSectionLead: "主役はフィールドノート。フィールドガイドとフィールドスキャンは、次の 1 枚を書く理由を増やすために置いてある。",
      tools: {
        lens: {
          eyebrow: "フィールドガイド",
          title: "歩きながら、映像と音声でその場を読み解く",
          body: "カメラをかざすと AI が周囲を解析して音声で案内する。生きもの・土地の歴史・建物の来歴まで。気づいたことはノートに自動で蓄積。",
          cta: "フィールドガイドを見る",
          badge: "beta",
        },
        scan: {
          eyebrow: "フィールドスキャン",
          title: "近くの場所が、いま何を抱えているか",
          body: "今いる場所の周りで、どんな生きものが記録されてきたかを地図で見られる。次に歩く道を選ぶときに。",
          cta: "フィールドスキャンを見る",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "場所のノート",
      mapSectionTitle: "また行きたくなる場所を、地図で振り返る",
      mapSectionLead: "観察が、どの場所にどう積み重なっているか。同じ場所が季節でどう動くか。次に歩く理由を、地図のなかから探せる。",
      mapCta: "マップを開く",
      mapEmpty: "まだ地図に載せる観察がありません",
      bizEyebrow: "企業・自治体の方へ",
      bizTitle: "場所のノートを、組織の自然インフラに",
      bizBody: "学校・自治体・企業で、自然共生サイトの観察を続けるための共有ノートとして使える。導入の相談から運用まで、必要な分だけ手伝う。",
      bizCta: "法人向けページへ",
      footerNote: "歩いて、見つけて、ノートに残す。",
    },
    en: {
      title: "ikimon.life — Walk, find, write it in the notebook",
      heroEyebrow: "Welcome to ikimon",
      heroHeading: "Walk, find, <span class=\"hero-emphasis\">write it in the notebook.</span>",
      heroHeadingPlain: "Walk, find, write it in the notebook.",
      heroLead: "Save what you find on your usual walks, by place and season. The more you re-read it, the more the same path looks different.",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("en-US")} observations · ${species.toLocaleString("en-US")} species`,
      actionPrimaryLoggedIn: "Keep writing",
      actionPrimaryGuest: "Start your notebook",
      actionSecondary: "See the map",
      toolSectionEyebrow: "Inputs to your notebook",
      toolSectionTitle: "Two ways to feed the notebook",
      toolSectionLead: "Field Note is the core. Field Guide and Field Scan are supporting inputs that give you more reasons to add another page.",
      tools: {
        lens: {
          eyebrow: "Field Guide",
          title: "Walk with an AI guide reading the world around you",
          body: "Point your camera and the AI reads the scene aloud — wildlife, land history, buildings, and the people who shaped the place. Notes accumulate automatically.",
          cta: "See Field Guide",
          badge: "beta",
        },
        scan: {
          eyebrow: "Field Scan",
          title: "What the place around you has held",
          body: "See on the map which species have been recorded around here. A way to choose which path to walk next.",
          cta: "See Field Scan",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Place notebook",
      mapSectionTitle: "Revisit places worth walking again, on the map",
      mapSectionLead: "How observations stack at each place. How a place shifts with the season. Find the next reason to walk inside the map.",
      mapCta: "Open the full map",
      mapEmpty: "No observations on the map yet",
      bizEyebrow: "For organizations",
      bizTitle: "Place notebooks as nature infrastructure for your team",
      bizBody: "A shared notebook for schools, municipalities, and companies to keep observing protected and nature-positive sites. From onboarding to running it, we help only as much as is needed.",
      bizCta: "For Business",
      footerNote: "ikimon.life v2 — Walk, find, write it in the notebook.",
    },
    es: {
      title: "ikimon.life — Camina, descubre, escríbelo en el cuaderno",
      heroEyebrow: "Bienvenido a ikimon",
      heroHeading: "Camina, descubre, <span class=\"hero-emphasis\">escríbelo en el cuaderno.</span>",
      heroHeadingPlain: "Camina, descubre, escríbelo en el cuaderno.",
      heroLead: "Guarda lo que encuentras en tus paseos habituales, por lugar y por estación. Cuanto más lo relees, más distinto se ve el mismo camino.",
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
          title: "La IA te ayuda a encontrar un nombre mientras caminas",
          body: "La IA propone candidatos para lo que está cerca. Es una guía, no la respuesta. Quien decide eres tú.",
          cta: "Ver Lente IA",
          badge: "beta",
        },
        scan: {
          eyebrow: "Escaneo de campo",
          title: "Lo que el lugar a tu alrededor ha sostenido",
          body: "Mira en el mapa qué especies se han registrado por aquí. Una forma de elegir qué camino caminar después.",
          cta: "Ver Escaneo",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Cuaderno del lugar",
      mapSectionTitle: "Vuelve a lugares que vale la pena recorrer, en el mapa",
      mapSectionLead: "Cómo se acumulan las observaciones en cada lugar. Cómo un lugar cambia con la estación. Encuentra dentro del mapa la próxima razón para caminar.",
      mapCta: "Abrir el mapa",
      mapEmpty: "Aún no hay observaciones en el mapa",
      bizEyebrow: "Para organizaciones",
      bizTitle: "Cuadernos del lugar como infraestructura natural de tu equipo",
      bizBody: "Un cuaderno compartido para escuelas, municipios y empresas que necesitan seguir observando sitios protegidos y nature-positive. Desde la puesta en marcha hasta la operación, ayudamos solo lo necesario.",
      bizCta: "Para organizaciones",
      footerNote: "ikimon.life v2 — Camina, descubre, escríbelo en el cuaderno.",
    },
    "pt-BR": {
      title: "ikimon.life — Caminhe, descubra, escreva no caderno",
      heroEyebrow: "Bem-vindo ao ikimon",
      heroHeading: "Caminhe, descubra, <span class=\"hero-emphasis\">escreva no caderno.</span>",
      heroHeadingPlain: "Caminhe, descubra, escreva no caderno.",
      heroLead: "Guarde o que encontra nas suas caminhadas habituais, por lugar e por estação. Quanto mais você relê, mais o mesmo caminho parece diferente.",
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
          title: "A IA ajuda a achar um nome enquanto você caminha",
          body: "A IA sugere candidatos para o que está por perto. É um guia, não a resposta. Quem decide é você.",
          cta: "Ver Lente IA",
          badge: "beta",
        },
        scan: {
          eyebrow: "Escaneamento de campo",
          title: "O que o lugar ao seu redor já abrigou",
          body: "Veja no mapa quais espécies já foram registradas por aqui. Um jeito de escolher qual caminho seguir em seguida.",
          cta: "Ver Escaneamento",
          badge: "v0.10",
        },
      },
      mapSectionEyebrow: "Caderno do lugar",
      mapSectionTitle: "Volte a lugares que valem outra caminhada, no mapa",
      mapSectionLead: "Como as observações se acumulam em cada lugar. Como o lugar muda com a estação. Encontre dentro do mapa o próximo motivo para caminhar.",
      mapCta: "Abrir o mapa completo",
      mapEmpty: "Ainda não há observações no mapa",
      bizEyebrow: "Para organizações",
      bizTitle: "Cadernos do lugar como infraestrutura natural do seu time",
      bizBody: "Um caderno compartilhado para escolas, prefeituras e empresas que precisam continuar observando sites protegidos e nature-positive. Da entrada até a operação, ajudamos só o necessário.",
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
  isDemoView: boolean,
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
    TODAY_HABIT_STYLES,
    REVISIT_FLOW_STYLES,
    COMMUNITY_METER_STYLES,
    MENTOR_STRIP_STYLES,
    DEMO_LOGIN_BANNER_STYLES,
    `
  .quick-nav-inner { grid-template-columns: repeat(5, minmax(0, 1fr)); max-width: none; }
  .tool-card-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 16px; max-width: none; }
  .landing-tools .section-header,
  .landing-map .section-header { flex-direction: row; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .fn-main-head { flex-direction: row; flex-wrap: wrap; gap: 20px 28px; align-items: flex-end; justify-content: space-between; }
  .fn-main-head-actions { align-items: flex-end; min-width: 220px; width: auto; }
  .fn-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .fn-grid-compact { grid-template-columns: repeat(4, minmax(0,1fr)); }
  .fn-place-row { display: flex; flex-wrap: wrap; }
  .fn-ambient-row { display: flex; flex-wrap: wrap; }
  .fn-ambient-item { border-radius: 999px; padding: 8px 14px 8px 8px; }
  @media (max-width: 980px) {
    .quick-nav-inner { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  .landing-hero-stat { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 13px; font-weight: 800; letter-spacing: -.01em; }
  .landing-hero-stat::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,.18); }
  @media (max-width: 860px) {
    .fn-main-head { flex-direction: column; align-items: flex-start; justify-content: flex-start; }
    .fn-main-head-actions { align-items: flex-start; min-width: 0; width: 100%; }
    .fn-grid, .fn-grid-compact { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 720px) {
    .tool-card-grid { grid-template-columns: 1fr; }
    .landing-tools .section-header,
    .landing-map .section-header { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 640px) {
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .fn-grid, .fn-grid-compact { grid-template-columns: 1fr; }
  }
    `,
  ].join("\n");

  // Hero rhythm: badge → h1 → lead → chips (small) → CTA (large) → stat pill (subtle).
  // Putting chips above the CTAs keeps the visual cadence small→large→small without bouncing.
  const heroSupplementHtml = `<div class="hero-chip-row">
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "主役はフィールドノート" : lang === "es" ? "El cuaderno es el centro" : lang === "pt-BR" ? "O caderno e o centro" : "Field Note first")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "フィールドガイドで土地を読む" : lang === "es" ? "Guía de Campo lee el lugar" : lang === "pt-BR" ? "Guia de Campo lê o lugar" : "Field Guide reads the place")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "地図で再訪理由が育つ" : lang === "es" ? "El mapa crea motivos para volver" : lang === "pt-BR" ? "O mapa cria motivos para voltar" : "Map grows revisit reasons")}</span>
  </div>`;

  const heroAfterActionsHtml = statLine
    ? `<div class="landing-hero-stat">${escapeHtml(statLine)}</div>`
    : "";

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
    belowHeroHtml: `${renderDemoLoginBanner(options.basePath, lang, { demoUserId: options.userId, isDemoView })}${renderQuickNav(options.basePath, lang)}`,
    extraStyles,
    body: `${renderTodayHabit(options.basePath, lang, snapshot)}
${renderRevisitFlow(options.basePath, lang, snapshot)}
${renderFieldNoteMain(options.basePath, lang, snapshot)}
${toolsSectionHtml}
${mapSectionHtml}
${renderCommunityMeter(options.basePath, lang, snapshot)}
${renderMentorStrip(options.basePath, lang)}
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
      const { viewerUserId, queryOverrideHonored } = resolveViewer(request.query, session);
      const snapshot = await getLandingSnapshot(viewerUserId);
      reply.type("text/html; charset=utf-8");
      return buildLandingRootHtml(
        context,
        lang,
        requestCurrentPath(request as unknown as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
        snapshot,
        queryOverrideHonored,
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
  void registerLegacyAssetRoutes(app);
  void registerMapApiRoutes(app);
  void registerMarketingRoutes(app);
  void registerReadRoutes(app);
  void registerWriteRoutes(app);
  void registerUiKpiRoutes(app);
  void registerOpsRoutes(app);
  void registerGuideApiRoutes(app);
  void registerWalkApiRoutes(app);
  void registerResearchApiRoutes(app);

  return app;
}
