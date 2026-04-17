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
      heroEyebrow: "feel the field.",
      heroHeading: "いつもの散歩が、<br><span class=\"hero-emphasis\">冒険になる。</span>",
      heroHeadingPlain: "いつもの散歩が、冒険になる。",
      heroLead: "AI が土地を読み、地図が次の一歩を灯す。歩くほど、同じ道がちがって見えてくる。",
      statLabel: (obs: number, species: number) => `${obs.toLocaleString("ja-JP")} 件の観察 · ${species.toLocaleString("ja-JP")} 種`,
      actionPrimaryLoggedIn: "ノートの続きを書く",
      actionPrimaryGuest: "ノートを始める",
      actionSecondary: "探索マップを見る",
      toolSectionEyebrow: "ノートを育てる入口",
      toolSectionTitle: "ノートに新しいページを書く理由を増やす 2 つの入口",
      toolSectionLead: "主役はフィールドノート。フィールドガイドとフィールドスキャンは、次の 1 枚を書きたくなるための補助です。",
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
      heroEyebrow: "feel the field.",
      heroHeading: "Your usual walk <span class=\"hero-emphasis\">becomes an adventure.</span>",
      heroHeadingPlain: "Your usual walk becomes an adventure.",
      heroLead: "An AI guide reads the land aloud. The map lights up reasons to come back. Every step sharpens the world.",
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
      heroEyebrow: "feel the field.",
      heroHeading: "Tu paseo de siempre <span class=\"hero-emphasis\">se vuelve una aventura.</span>",
      heroHeadingPlain: "Tu paseo de siempre se vuelve una aventura.",
      heroLead: "Una guía IA lee el territorio en voz alta. El mapa enciende razones para volver. Cada paso afila el mundo.",
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
      heroEyebrow: "feel the field.",
      heroHeading: "Sua caminhada de sempre <span class=\"hero-emphasis\">vira uma aventura.</span>",
      heroHeadingPlain: "Sua caminhada de sempre vira uma aventura.",
      heroLead: "Um guia IA lê a paisagem em voz alta. O mapa acende motivos para voltar. Cada passo afia o mundo.",
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

function fieldLoopSectionCopy(lang: SiteLang) {
  const copy = {
    ja: {
      eyebrow: "satellite → field → loop",
      title: "衛星で目星をつけ、歩いて確かめ、ノートに積んでいく。",
      lead: "このループが回るたびに、同じ道がちがって見えてくる。観測の空白と不在の証拠は、きちんと分けて扱う。",
      primaryCta: "ループの詳細を見る",
      secondaryCta: "フィールドスキャン",
      loopTitle: "4 steps",
      principleTitle: "こだわり",
      boundaryTitle: "言葉の約束",
      steps: [
        { title: "1. 衛星で狙いをつける", body: "林縁や水際、湿地、遷移帯。怪しい場所を、家を出る前に見つけておく。" },
        { title: "2. 3 つに絞っていく", body: "どの microhabitat を確かめるか、どこを撮るか、何を書き留めるかを、先に決めておく。" },
        { title: "3. AI は断定しない", body: "見えた特徴と、足りない証拠と、次に撮るといい 1 枚を教えてくれる。" },
        { title: "4. 差分が積もっていく", body: "季節ごとの違いが積み重なって、また来たくなる理由が育っていく。" },
      ],
      principles: [
        "答えより、目を育てていく。",
        "種名より、文脈を厚くしていく。",
        "空白と不在を、いっしょにしない。",
        "不確実性も、きちんとデータとして残しておく。",
      ],
      boundaries: [
        "空白 = まだ見ていない",
        "不在 = 努力量とセットで",
        "AI更新 = 検証済みだけ",
      ],
    },
    en: {
      eyebrow: "satellite → field → loop",
      title: "Aim from the satellite, check it on foot, and write it down in the notebook.",
      lead: "Every turn of the loop, the same path starts looking different. Blank coverage and evidence of absence are kept clearly apart.",
      primaryCta: "See the loop",
      secondaryCta: "Field Scan",
      loopTitle: "4 steps",
      principleTitle: "what we care about",
      boundaryTitle: "our words",
      steps: [
        { title: "1. Aim from the satellite", body: "Edges, water, wetlands, succession zones — find the suspicious places before you leave home." },
        { title: "2. Narrow it down to three", body: "Decide which microhabitat to verify, what to photograph, and what context to write down." },
        { title: "3. The AI never overclaims", body: "It tells you what it saw, what evidence is missing, and which shot is worth taking next." },
        { title: "4. The deltas pile up", body: "Season by season, the differences stack, and a reason to come back keeps growing." },
      ],
      principles: [
        "We train the eye, not just the answer.",
        "We thicken the context before we push for certainty.",
        "We never blur blank with absent.",
        "We keep uncertainty and deltas as data, too.",
      ],
      boundaries: [
        "Blank = not yet observed",
        "Absence = only with effort logged",
        "Model updates = validated only",
      ],
    },
    es: {
      eyebrow: "satellite → field → loop",
      title: "Apuntamos desde el satélite, lo comprobamos a pie, y lo anotamos en el cuaderno.",
      lead: "Con cada vuelta del bucle, el mismo camino empieza a verse distinto. Vacío y ausencia se mantienen claramente separados.",
      primaryCta: "Ver el bucle",
      secondaryCta: "Escaneo de Campo",
      loopTitle: "4 pasos",
      principleTitle: "lo que importa",
      boundaryTitle: "nuestras palabras",
      steps: [
        { title: "1. Apuntar desde el satélite", body: "Bordes, agua, humedales, zonas de sucesión: encuentra los lugares sospechosos antes de salir de casa." },
        { title: "2. Reducirlo a tres", body: "Decide qué microhábitat vas a verificar, qué foto vas a tomar y qué contexto vas a anotar." },
        { title: "3. La IA nunca afirma de más", body: "Te dice qué se ve, qué evidencia falta y cuál es la próxima foto que conviene tomar." },
        { title: "4. Los deltas se acumulan", body: "Estación a estación, las diferencias se apilan, y crece un motivo para volver." },
      ],
      principles: [
        "Entrenamos la mirada, no solo la respuesta.",
        "Engordamos el contexto antes de pedir certeza.",
        "Nunca confundimos vacío con ausencia.",
        "Tratamos la incertidumbre y los deltas también como datos.",
      ],
      boundaries: [
        "Vacío = aún no observado",
        "Ausencia = solo con esfuerzo registrado",
        "Actualización de IA = solo validado",
      ],
    },
    "pt-BR": {
      eyebrow: "satellite → field → loop",
      title: "A gente mira pelo satélite, confere a pé, e anota no caderno.",
      lead: "A cada volta do loop, o mesmo caminho começa a parecer diferente. Vazio e ausência ficam claramente separados.",
      primaryCta: "Ver o loop",
      secondaryCta: "Escaneamento",
      loopTitle: "4 passos",
      principleTitle: "o que importa",
      boundaryTitle: "nossas palavras",
      steps: [
        { title: "1. Mirar pelo satélite", body: "Bordas, água, áreas úmidas, zonas de sucessão: ache os lugares suspeitos antes de sair de casa." },
        { title: "2. Reduzir a três", body: "Decide qual microhabitat vai verificar, qual foto vai tirar e qual contexto vai anotar." },
        { title: "3. A IA nunca afirma demais", body: "Ela diz o que viu, qual evidência falta, e qual é a próxima foto que vale a pena tirar." },
        { title: "4. Os deltas se acumulam", body: "Estação após estação, as diferenças vão empilhando, e cresce um motivo para voltar." },
      ],
      principles: [
        "Treinamos o olhar, não só a resposta.",
        "Engrossamos o contexto antes de cobrar certeza.",
        "Nunca misturamos vazio com ausência.",
        "Tratamos incerteza e deltas como dados também.",
      ],
      boundaries: [
        "Vazio = ainda não observado",
        "Ausência = só com esforço registrado",
        "Atualização de IA = apenas validado",
      ],
    },
  } satisfies Record<SiteLang, {
    eyebrow: string;
    title: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    loopTitle: string;
    principleTitle: string;
    boundaryTitle: string;
    steps: Array<{ title: string; body: string }>;
    principles: string[];
    boundaries: string[];
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
  const fieldLoop = fieldLoopSectionCopy(lang);
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

  const fieldLoopSectionHtml = `<section class="section field-loop-section" aria-labelledby="field-loop-heading">
    <div class="field-loop-shell">
      <div class="field-loop-copy">
        <div class="eyebrow">${escapeHtml(fieldLoop.eyebrow)}</div>
        <h2 id="field-loop-heading">${escapeHtml(fieldLoop.title)}</h2>
        <p>${escapeHtml(fieldLoop.lead)}</p>
        <div class="actions" style="margin-top:18px">
          <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/learn/field-loop"), lang))}">${escapeHtml(fieldLoop.primaryCta)}</a>
          <a class="btn btn-ghost" href="${escapeHtml(appendLangToHref(withBasePath(options.basePath, "/scan"), lang))}">${escapeHtml(fieldLoop.secondaryCta)}</a>
        </div>
        <div class="field-loop-boundary-strip" aria-label="${escapeHtml(fieldLoop.boundaryTitle)}">
          ${fieldLoop.boundaries.map((item) => `<span class="field-loop-boundary-chip">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="field-loop-principles">
        <div class="eyebrow">${escapeHtml(fieldLoop.principleTitle)}</div>
        <ul class="field-loop-principle-list">
          ${fieldLoop.principles.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    </div>
    <div class="section-header" style="margin-top:24px">
      <div>
        <div class="eyebrow">${escapeHtml(fieldLoop.loopTitle)}</div>
        <h3>${escapeHtml(lang === "ja" ? "衛星から再訪までを 1 本につなぐ" : "One connected flow from orbit to revisit")}</h3>
      </div>
    </div>
    <div class="field-loop-grid">
      ${fieldLoop.steps.map((step) => `<article class="card field-loop-card"><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.body)}</p></article>`).join("")}
    </div>
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
  .field-loop-section { position: relative; overflow: hidden; }
  .field-loop-shell { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .95fr); gap: 18px; align-items: stretch; }
  .field-loop-copy, .field-loop-principles { border-radius: 28px; padding: 26px; }
  .field-loop-copy { background: radial-gradient(circle at top left, rgba(16,185,129,.18), transparent 44%), linear-gradient(180deg, #f8fffc 0%, #effaf4 100%); border: 1px solid rgba(16,185,129,.16); }
  .field-loop-copy h2 { margin-top: 8px; font-size: clamp(26px, 3vw, 38px); line-height: 1.18; letter-spacing: -.03em; }
  .field-loop-copy p { max-width: 58ch; }
  .field-loop-boundary-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .field-loop-boundary-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 8px 12px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 12px; font-weight: 800; letter-spacing: -.01em; }
  .field-loop-principles { background: linear-gradient(180deg, #0f172a 0%, #111827 100%); color: rgba(255,255,255,.92); border: 1px solid rgba(255,255,255,.08); }
  .field-loop-principles .eyebrow { color: rgba(167,243,208,.92); }
  .field-loop-principle-list { margin: 12px 0 0; padding-left: 18px; display: grid; gap: 12px; }
  .field-loop-principle-list li { margin: 0; }
  .field-loop-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 14px; }
  .field-loop-card { min-height: 100%; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid rgba(15,23,42,.08); }
  .field-loop-card h3 { margin: 0 0 10px; font-size: 17px; line-height: 1.35; letter-spacing: -.02em; }
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
    .field-loop-shell { grid-template-columns: 1fr; }
    .field-loop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .fn-main-head { flex-direction: column; align-items: flex-start; justify-content: flex-start; }
    .fn-main-head-actions { align-items: flex-start; min-width: 0; width: 100%; }
    .fn-grid, .fn-grid-compact { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 720px) {
    .tool-card-grid { grid-template-columns: 1fr; }
    .field-loop-copy, .field-loop-principles { padding: 22px; }
    .field-loop-grid { grid-template-columns: 1fr; }
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
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "AI ガイドが囁く" : lang === "es" ? "La IA susurra" : lang === "pt-BR" ? "A IA sussurra" : "AI guide whispers")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "地図に次の一歩が灯る" : lang === "es" ? "El mapa enciende el próximo paso" : lang === "pt-BR" ? "O mapa acende o próximo passo" : "The map lights the next step")}</span>
    <span class="hero-chip">${escapeHtml(lang === "ja" ? "歩くほど、世界が濃くなる" : lang === "es" ? "Cada paso, el mundo se vuelve más denso" : lang === "pt-BR" ? "Cada passo, o mundo fica mais denso" : "Every step, the world deepens")}</span>
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
${fieldLoopSectionHtml}
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
