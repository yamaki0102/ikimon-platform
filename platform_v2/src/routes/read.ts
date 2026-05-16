import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import { getSessionFromCookie, type SessionSnapshot } from "../services/authSession.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import {
  getReviewerAccessContext,
  listRecentReviewerAuthorities,
  listReviewerAuthorityAudit,
  type ReviewerAuthority,
  type ReviewerAuthorityAuditAction,
  type ReviewerAuthorityAuditEntry,
  type ReviewerAuthorityEvidenceType,
} from "../services/reviewerAuthorities.js";
import {
  listAuthorityRecommendationsForUser,
  listPendingAuthorityRecommendationsForReviewer,
  type AuthorityRecommendation,
  type AuthorityRecommendationSourceKind,
  type AuthorityRecommendationStatus,
} from "../services/authorityRecommendations.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingSnapshot } from "../services/landingSnapshot.js";
import {
  formatActorDisplay,
  formatIdentificationCount,
  formatPlaceDisplay,
  formatTaxonDisplayName,
} from "../services/localizedDisplay.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../ui/observationCard.js";
import { isOpenCandidate, rankProminentAiCandidates } from "../ui/observationCandidatePresentation.js";
import { getObservationContext, groupFeaturesByLayer } from "../services/observationContext.js";
import { getReactionSummary, type ReactionType } from "../services/observationReactions.js";
import { getIdentificationConsensus, type IdentificationConsensusResult } from "../services/identificationConsensus.js";
import { getObserverStats } from "../services/observerStats.js";
import { buildObserverProfileHref } from "../services/observerProfileLink.js";
import { getTaxonInsight, type TaxonInsight } from "../services/taxonInsights.js";
import { getSiteBrief, type SiteBrief } from "../services/siteBrief.js";
import { getPlaceManagementPolicy, type PlaceManagementPolicy } from "../services/placeManagementPolicy.js";
import { getPlaceVegetationTrend, type PlaceVegetationTrend } from "../services/placeVegetationTrend.js";
import {
  civicContextLabel,
  getCivicObservationContext,
  listCivicObservationContexts,
  type CivicObservationContext,
} from "../services/civicNatureContext.js";
import { getObservationDetailHeavy, type NearbyObservation, type SiblingSubject } from "../services/observationDetailHeavy.js";
import {
  confidenceLabel,
  invasiveActionLabel,
  mhlwCategoryLabel,
  sizeClassLabel,
  type CandidateReading,
  type InvasiveResponse,
  type ManagementActionCandidate,
  type NoveltyHint,
  type SizeAssessment,
} from "../services/observationAiAssessment.js";
import {
  getObservationVisitBundle,
  type ObservationVisitBundle,
  type ObservationVisitCandidate,
  type ObservationVisitSubject,
} from "../services/observationVisitBundle.js";
import {
  buildVisibleRecordItems,
  formatObservationRecordTitle,
  visibleRecordMeta,
  type VisibleRecordItem,
} from "../services/observationSceneReadModel.js";
import { buildPublicMapCellHref } from "../services/publicLocation.js";
import {
  getHomeSnapshot,
  getObservationDetailSnapshot,
  getObservationListSnapshot,
  getProfileSnapshot,
  getSpecialistSnapshot,
  type HomeSnapshot,
  type HomePlace,
  type LandingObservation,
  type LandingSnapshot,
  type ObservationDetailSnapshot,
  type ObservationListSnapshot,
  type ProfileSnapshot,
} from "../services/readModels.js";
import { getProfileNoteDigest, type ProfileNoteDigest } from "../services/profileNoteDigest.js";
import {
  getReferenceProfileSummary,
  listReferenceCandidatesForIdentification,
  type ReferenceCandidate,
  type ReferenceProfileSummary,
} from "../services/referenceLibrary.js";
import { getRegionalStoryCue, type RegionalKnowledgeCard, type RegionalStoryCue } from "../services/regionalStory.js";
import {
  assertSpecialistAdminSession,
  assertSpecialistSession,
} from "../services/writeGuards.js";
import {
  MAP_MINI_STYLES,
  mapMiniBootScript,
  renderMapMini,
  toMapMiniCells,
} from "../ui/mapMini.js";
import {
  MAP_EXPLORER_STYLES,
  mapExplorerBootScript,
  renderMapExplorer,
} from "../ui/mapExplorer.js";
import {
  OBSERVATION_MEDIA_STYLES,
  REGION_DISPLAY_CONF_MIN,
  REGION_LARGE_AREA_MIN,
  renderObservationMedia,
  toSubjectRegionMap,
  type ObservationMediaAnnotationTarget,
} from "../ui/observationMedia.js";
import { GUIDE_FLOW_STYLES, renderGuideFlow } from "../ui/guideFlow.js";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "../ui/placeRevisit.js";
import { getFixedPointStation } from "../services/fixedPointStation.js";
import { FIXED_POINT_STATION_STYLES, renderFixedPointStationBody } from "../ui/fixedPointStation.js";

type LayoutHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
};

type PublicSharedCopy = {
  cta: {
    record: string;
    openNotebook: string;
    openMap: string;
  };
  ai: {
    support: string;
  };
};

type PublicRouteCard = {
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

type ObservationsHtmlCacheEntry = {
  expiresAt: number;
  html: string;
};

const OBSERVATIONS_HTML_CACHE_TTL_MS = 120_000;
const OBSERVATIONS_HTML_CACHE_MAX_ENTRIES = 32;
const observationsHtmlCache = new Map<string, ObservationsHtmlCacheEntry>();

function layout(
  basePath: string,
  title: string,
  body: string,
  activeNav: string,
  hero?: LayoutHero,
  extraStyles?: string,
  currentPath?: string,
  hideFooter = false,
  shellClassName?: string,
  lang: SiteLang = "ja",
  footerNote?: string,
): string {
  const defaultFooterNote = lang === "ja"
    ? "いつもの道で見つけた自然を、その場で読み解く。"
    : "Read nearby nature from the scene you found.";
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    lang,
    body,
    hero: hero
      ? {
          eyebrow: hero.eyebrow,
          heading: hero.heading,
          headingHtml: hero.headingHtml ?? hero.heading,
          lead: hero.lead,
          tone: "light",
          align: "center",
          actions: hero.actions,
        }
      : undefined,
    extraStyles,
    currentPath,
    hideFooter,
    shellClassName,
    footerNote: footerNote ?? defaultFooterNote,
  });
}

function renderPublicRouteCardGrid(
  cards: PublicRouteCard[],
  basePath: string,
  lang: SiteLang,
  ctaClass: "btn btn-solid" | "inline-link",
): string {
  return `<div class="grid">${cards
    .map((card) => {
      const ctaHref = card.ctaHref ? appendLangToHref(withBasePath(basePath, card.ctaHref), lang) : "";
      const ctaHtml = card.ctaHref && card.ctaLabel
        ? `<div class="actions" style="margin-top:12px"><a class="${ctaClass}" href="${escapeHtml(ctaHref)}">${escapeHtml(card.ctaLabel)}</a></div>`
        : "";
      const metaHtml = card.meta ? `<p class="meta" style="margin-top:10px">${escapeHtml(card.meta)}</p>` : "";
      return `<div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(card.eyebrow)}</div><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.body)}</p>${metaHtml}${ctaHtml}</div></div>`;
    })
    .join("")}</div>`;
}

const GUIDE_ENTRY_STYLES = `
  .guide-loop-panel { margin-top: 18px; }
  .guide-loop-card {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(260px, .85fr);
    gap: 16px;
    align-items: stretch;
    padding: 24px;
    border-radius: 24px;
    border: 1px solid rgba(16,185,129,.16);
    background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(255,255,255,.96) 58%, rgba(240,249,255,.82));
    box-shadow: 0 16px 38px rgba(15,23,42,.06);
  }
  .guide-loop-card h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(24px, 3vw, 34px); line-height: 1.2; letter-spacing: 0; }
  .guide-loop-card p { margin: 10px 0 0; color: #475569; line-height: 1.75; font-weight: 720; }
  .guide-loop-steps { display: grid; gap: 8px; }
  .guide-loop-step {
    min-height: 54px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px;
    border-radius: 14px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.12);
    color: #334155;
    font-size: 13px;
    line-height: 1.45;
    font-weight: 780;
  }
  .guide-loop-step b {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    font-size: 12px;
  }
  .guide-loop-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  @media (max-width: 820px) {
    .guide-loop-card { grid-template-columns: 1fr; padding: 18px; border-radius: 20px; }
  }
`;

function renderGuideLoopPanel(basePath: string, lang: SiteLang): string {
  const href = (path: string) => escapeHtml(appendLangToHref(withBasePath(basePath, path), lang));
  const copy = lang === "ja"
    ? {
        eyebrow: "loop",
        title: "ガイドで見たことを、記録と成果確認につなげる",
        body: "ライブガイドはその場で終わらせず、気づきは記録へ、歩いた足跡は成果確認へ、場所の変化はマップへ戻します。写真・動画・ガイド・観察レコードが別々の体験にならないよう、ここから一巡できます。",
        record: "写真・動画を記録する",
        outcomes: "ガイド成果を見る",
        map: "マップで場所を見る",
        aria: "ガイド後の流れ",
        steps: [
          "その場でガイドを開始して、環境の手がかりを残す",
          "残したい発見は写真・動画つきの記録にする",
          "ガイド成果確認でルートと代表カードを見返す",
          "マップと記録ライブラリから、次に歩く場所へ戻る",
        ],
      }
    : {
        eyebrow: "loop",
        title: "Turn Guide traces into records and outcomes",
        body: "Live Guide should not end in the moment. Save discoveries as records, review the walked trace as outcomes, and return to the map for the next place.",
        record: "Record photo or video",
        outcomes: "Review Guide outcomes",
        map: "Open map",
        aria: "After Guide flow",
        steps: [
          "Start Guide and save field context",
          "Turn important discoveries into photo or video records",
          "Review route traces and representative cards",
          "Return to the map and notebook for the next walk",
        ],
      };
  return `<section class="section guide-loop-panel">
    <div class="guide-loop-card">
      <div>
        <div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
        <h2>${escapeHtml(copy.title)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <div class="guide-loop-actions">
          <a class="btn btn-solid" href="${href("/record")}">${escapeHtml(copy.record)}</a>
          <a class="btn btn-ghost" href="${href("/guide/outcomes")}">${escapeHtml(copy.outcomes)}</a>
          <a class="btn btn-ghost" href="${href("/map")}">${escapeHtml(copy.map)}</a>
        </div>
      </div>
      <div class="guide-loop-steps" aria-label="${escapeHtml(copy.aria)}">
        ${copy.steps.map((step, index) => `<div class="guide-loop-step"><b>${index + 1}</b><span>${escapeHtml(step)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

type NotesLoopStepCopy = {
  label: string;
  title: string;
  body: string;
  path: string;
  cta: string;
};

type NotesLibraryCopy = {
  pageTitle: string;
  activeNav: string;
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  actions: {
    record: string;
    guide: string;
    outcomes: string;
  };
  statsAria: string;
  stats: {
    observations: string;
    photos: string;
    named: string;
  };
  loop: {
    aria: string;
    eyebrow: string;
    title: string;
    lead: string;
    steps: NotesLoopStepCopy[];
  };
  sections: {
    ownEyebrow: string;
    publicEyebrow: string;
    ownTitle: string;
    publicTitle: string;
    placesEyebrow: string;
    placesTitle: string;
    placesLead: string;
    placesEmpty: string;
    nearbyEyebrow: string;
    nearbyTitle: string;
    nearbyLead: string;
  };
  controls: {
    aria: string;
    searchPlaceholder: string;
    filterAria: string;
    sourceLanesAria: string;
    all: string;
    photo: string;
    video: string;
    guide: string;
    scan: string;
    uncertain: string;
    identified: string;
  };
  sourceLabels: Record<NonNullable<LandingObservation["librarySourceKind"]>, string>;
  card: {
    fallbackName: string;
    fallbackPlace: string;
    uncertainBadge: string;
    namedBadge: string;
    menuAria: string;
    detail: string;
    delete: string;
    deleting: string;
    deleteConfirm: string;
    deleteFailedPrefix: string;
  };
  emptyLibrary: string;
  latestFallback: string;
  nearbyEmpty: string;
  footerNote: string;
};

function notesLibraryCopy(lang: SiteLang): NotesLibraryCopy {
  const localized: Record<SiteLang, NotesLibraryCopy> = {
    ja: {
      pageTitle: "記録ライブラリ | ikimon",
      activeNav: "記録ライブラリ",
      heroEyebrow: "記録ライブラリ",
      heroTitle: "記録ライブラリ",
      heroLead: "写真・動画・音声・場所・時刻・メモをまとめて残した「記録」を見返す場所です。1件の記録から複数の対象ごとの記録を作れます。対象ごとの記録や同定は詳細で切り分け、ここでは場所・時間・証拠・再訪文脈を主役にします。",
      actions: {
        record: "記録する",
        guide: "ライブガイドを使う",
        outcomes: "ガイド成果を見る",
      },
      statsAria: "記録ライブラリの概要",
      stats: {
        observations: "記録",
        photos: "写真枚数",
        named: "対象化済み",
      },
      loop: {
        aria: "記録体験の流れ",
        eyebrow: "記録の流れ",
        title: "記録する → 記録を見返す → 対象ごとの記録に分ける → 同定で確かめる",
        lead: "記録ライブラリは倉庫ではなく、次の一歩を決める場所です。写真・動画・音声、ライブガイド、ガイド成果、マップを同じ循環として扱います。",
        steps: [
          { label: "記録", title: "写真・動画を残す", body: "見つけたもの、場所、時刻、メモを1件の記録として保存する。", path: "/record", cta: "記録する" },
          { label: "Guide", title: "名前より環境を読む", body: "分からない場面はライブガイドで、植生・水路・道ばたの変化を足跡にする。", path: "/guide", cta: "ガイドへ" },
          { label: "対象", title: "対象ごとの記録に分ける", body: "1件の記録の中から、生きもの・痕跡・音ごとに切り出す。", path: "/records?view=public", cta: "記録を見る" },
          { label: "同定", title: "名前を確かめる", body: "AI候補を手がかりに、人の同定で種類を判断する。", path: "/records?view=needs_id", cta: "同定へ" },
        ],
      },
      sections: {
        ownEyebrow: "My records",
        publicEyebrow: "Public sample",
        ownTitle: "自分の記録",
        publicTitle: "公開されている観察レコード",
        placesEyebrow: "Albums",
        placesTitle: "場所アルバム",
        placesLead: "よく行く場所をフォルダみたいに開く。",
        placesEmpty: "場所アルバムはまだありません。",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "近くの公開観察レコード",
        nearbyLead: "自分の記録とは分けて、地域の背景として薄く見る。",
      },
      controls: {
        aria: "記録ライブラリの絞り込み",
        searchPlaceholder: "場所・気づきで探す",
        filterAria: "表示切り替え",
        sourceLanesAria: "データの種類",
        all: "すべて",
        photo: "写真",
        video: "動画",
        guide: "ガイド",
        scan: "スキャン",
        uncertain: "同定待ち",
        identified: "観察レコードあり",
      },
      sourceLabels: {
        video: "動画",
        guide: "ガイド",
        scan: "スキャン",
        photo: "写真",
        note: "記録",
      },
      card: {
        fallbackName: "対象を整理中の記録",
        fallbackPlace: "場所未設定",
        uncertainBadge: "同定待ち",
        namedBadge: "観察レコードあり",
        menuAria: "記録メニュー",
        detail: "詳しく見る",
        delete: "削除する",
        deleting: "削除中...",
        deleteConfirm: "この記録を一覧と公開ページから削除します。よろしいですか？",
        deleteFailedPrefix: "削除できませんでした: ",
      },
      emptyLibrary: "まだ記録ライブラリに並べる記録がありません。",
      latestFallback: "記録が増えるほど、ここに月ごとの棚が育ちます。",
      nearbyEmpty: "まだ近くの公開観察レコードは表示できません。自分の記録ライブラリを主役にします。",
      footerNote: "記録の棚はこのページ、成長や地域への効き方はマイページに分けています。",
    },
    en: {
      pageTitle: "Observation Library | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Observation Library",
      heroTitle: "Observation Library",
      heroLead: "A photo-first library for your records. Photos, videos, guide traces, and map discoveries stay organized by month so you can browse, search, and open the next record quickly.",
      actions: {
        record: "Record photos or video",
        guide: "Use live guide",
        outcomes: "View guide outcomes",
      },
      statsAria: "Observation library summary",
      stats: {
        observations: "Records",
        photos: "Photos",
        named: "Named",
      },
      loop: {
        aria: "Observation experience loop",
        eyebrow: "Experience loop",
        title: "Record, read, review, and walk again.",
        lead: "The library is not storage. It is the place that makes the next walk easier to choose by connecting photos, video, live guide traces, guide outcomes, and the map.",
        steps: [
          { label: "Record", title: "Save photos or video", body: "Keep the main subject, place, and time before details fade.", path: "/record", cta: "Record" },
          { label: "Guide", title: "Read the setting, not only the name", body: "When the name is unclear, use live guide to save vegetation, water, roadside, and habitat clues.", path: "/guide", cta: "Open guide" },
          { label: "Outcome", title: "Review what the walk produced", body: "See routes, representative cards, and next places as outcomes of the field walk.", path: "/guide/outcomes", cta: "View outcomes" },
          { label: "Map", title: "Return to the next place", body: "Compare the library with the map to notice gaps, seasons, and places worth revisiting.", path: "/map", cta: "Open map" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "My observation records",
        publicTitle: "Public observation records",
        placesEyebrow: "Albums",
        placesTitle: "Place albums",
        placesLead: "Open familiar places like folders.",
        placesEmpty: "No place albums yet.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Nearby public records",
        nearbyLead: "Keep them separate from your own shelf and read them as local background.",
      },
      controls: {
        aria: "Filter observation library",
        searchPlaceholder: "Search by name or place",
        filterAria: "Display filters",
        sourceLanesAria: "Data types",
        all: "All",
        photo: "Photos",
        video: "Video",
        guide: "Guide",
        scan: "Scan",
        uncertain: "Needs name",
        identified: "Has ID",
      },
      sourceLabels: {
        video: "Video",
        guide: "Guide",
        scan: "Scan",
        photo: "Photo",
        note: "Note",
      },
      card: {
        fallbackName: "Record checking its name",
        fallbackPlace: "Place not set",
        uncertainBadge: "Needs name",
        namedBadge: "Named",
        menuAria: "Observation menu",
        detail: "View details",
        delete: "Delete",
        deleting: "Deleting...",
        deleteConfirm: "Delete this observation from the list and public page?",
        deleteFailedPrefix: "Could not delete: ",
      },
      emptyLibrary: "No records in this observation library yet.",
      latestFallback: "As records grow, monthly shelves will appear here.",
      nearbyEmpty: "Nearby public records are not available yet. Your own library stays primary.",
      footerNote: "Observation shelves live here. Growth and local contribution stay on your profile.",
    },
    es: {
      pageTitle: "Biblioteca de observaciones | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Biblioteca de observaciones",
      heroTitle: "Biblioteca de observaciones",
      heroLead: "Una biblioteca visual para tus registros. Fotos, videos, guías y hallazgos del mapa quedan ordenados por mes para mirar, buscar y abrir el siguiente registro con rapidez.",
      actions: {
        record: "Registrar foto o video",
        guide: "Usar guía en vivo",
        outcomes: "Ver resultados",
      },
      statsAria: "Resumen de la biblioteca de observaciones",
      stats: {
        observations: "Registros",
        photos: "Fotos",
        named: "Con nombre",
      },
      loop: {
        aria: "Ciclo de observación",
        eyebrow: "Experience loop",
        title: "Registra, lee, revisa y vuelve a caminar.",
        lead: "La biblioteca no es un almacén. Es el lugar que ayuda a elegir la próxima salida conectando fotos, videos, guías, resultados y mapa.",
        steps: [
          { label: "Record", title: "Guarda fotos o video", body: "Conserva el sujeto, el lugar y la hora antes de que se pierdan los detalles.", path: "/record", cta: "Registrar" },
          { label: "Guide", title: "Lee el entorno, no solo el nombre", body: "Si el nombre no está claro, guarda pistas de vegetación, agua, caminos y hábitat.", path: "/guide", cta: "Abrir guía" },
          { label: "Outcome", title: "Revisa lo que produjo la caminata", body: "Mira rutas, tarjetas representativas y próximos lugares como resultado de la salida.", path: "/guide/outcomes", cta: "Ver resultados" },
          { label: "Map", title: "Vuelve al siguiente lugar", body: "Compara la biblioteca con el mapa para notar vacíos, temporadas y sitios para volver.", path: "/map", cta: "Abrir mapa" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "Mis registros de observación",
        publicTitle: "Registros públicos de observación",
        placesEyebrow: "Albums",
        placesTitle: "Álbumes de lugares",
        placesLead: "Abre lugares conocidos como carpetas.",
        placesEmpty: "Aún no hay álbumes de lugares.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Registros públicos cercanos",
        nearbyLead: "Se mantienen separados de tu biblioteca y sirven como contexto local.",
      },
      controls: {
        aria: "Filtrar biblioteca de observaciones",
        searchPlaceholder: "Buscar por nombre o lugar",
        filterAria: "Filtros de vista",
        sourceLanesAria: "Tipos de datos",
        all: "Todo",
        photo: "Fotos",
        video: "Video",
        guide: "Guía",
        scan: "Escaneo",
        uncertain: "Sin nombre",
        identified: "Con ID",
      },
      sourceLabels: {
        video: "Video",
        guide: "Guía",
        scan: "Escaneo",
        photo: "Foto",
        note: "Nota",
      },
      card: {
        fallbackName: "Registro con nombre por confirmar",
        fallbackPlace: "Lugar no definido",
        uncertainBadge: "Sin nombre",
        namedBadge: "Con nombre",
        menuAria: "Menú de observación",
        detail: "Ver detalles",
        delete: "Eliminar",
        deleting: "Eliminando...",
        deleteConfirm: "¿Eliminar esta observación de la lista y de la página pública?",
        deleteFailedPrefix: "No se pudo eliminar: ",
      },
      emptyLibrary: "Aún no hay registros en esta biblioteca.",
      latestFallback: "A medida que crezcan los registros, aquí aparecerán estantes mensuales.",
      nearbyEmpty: "Aún no hay registros públicos cercanos disponibles. Tu biblioteca sigue siendo lo principal.",
      footerNote: "Los registros viven aquí. El crecimiento y la contribución local quedan en tu perfil.",
    },
    "pt-BR": {
      pageTitle: "Biblioteca de observações | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Biblioteca de observações",
      heroTitle: "Biblioteca de observações",
      heroLead: "Uma biblioteca visual para seus registros. Fotos, vídeos, guias e descobertas do mapa ficam organizados por mês para navegar, buscar e abrir o próximo registro rapidamente.",
      actions: {
        record: "Registrar foto ou vídeo",
        guide: "Usar guia ao vivo",
        outcomes: "Ver resultados",
      },
      statsAria: "Resumo da biblioteca de observações",
      stats: {
        observations: "Registros",
        photos: "Fotos",
        named: "Com nome",
      },
      loop: {
        aria: "Ciclo de observação",
        eyebrow: "Experience loop",
        title: "Registre, leia, revise e caminhe de novo.",
        lead: "A biblioteca não é armazenamento. Ela ajuda a escolher a próxima saída conectando fotos, vídeos, guias, resultados e mapa.",
        steps: [
          { label: "Record", title: "Salve fotos ou vídeo", body: "Guarde o sujeito, o lugar e o horário antes que os detalhes se percam.", path: "/record", cta: "Registrar" },
          { label: "Guide", title: "Leia o ambiente, não só o nome", body: "Quando o nome não estiver claro, salve pistas de vegetação, água, caminho e habitat.", path: "/guide", cta: "Abrir guia" },
          { label: "Outcome", title: "Revise o que a caminhada gerou", body: "Veja rotas, cartões representativos e próximos lugares como resultado da saída.", path: "/guide/outcomes", cta: "Ver resultados" },
          { label: "Map", title: "Volte ao próximo lugar", body: "Compare a biblioteca com o mapa para notar lacunas, estações e locais para revisitar.", path: "/map", cta: "Abrir mapa" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "Meus registros de observação",
        publicTitle: "Registros públicos de observação",
        placesEyebrow: "Albums",
        placesTitle: "Álbuns de lugares",
        placesLead: "Abra lugares conhecidos como pastas.",
        placesEmpty: "Ainda não há álbuns de lugares.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Registros públicos próximos",
        nearbyLead: "Eles ficam separados da sua biblioteca e servem como contexto local.",
      },
      controls: {
        aria: "Filtrar biblioteca de observações",
        searchPlaceholder: "Buscar por nome ou lugar",
        filterAria: "Filtros de visualização",
        sourceLanesAria: "Tipos de dados",
        all: "Todos",
        photo: "Fotos",
        video: "Vídeo",
        guide: "Guia",
        scan: "Scan",
        uncertain: "Sem nome",
        identified: "Com ID",
      },
      sourceLabels: {
        video: "Vídeo",
        guide: "Guia",
        scan: "Scan",
        photo: "Foto",
        note: "Nota",
      },
      card: {
        fallbackName: "Registro com nome a confirmar",
        fallbackPlace: "Lugar não definido",
        uncertainBadge: "Sem nome",
        namedBadge: "Com nome",
        menuAria: "Menu da observação",
        detail: "Ver detalhes",
        delete: "Excluir",
        deleting: "Excluindo...",
        deleteConfirm: "Excluir esta observação da lista e da página pública?",
        deleteFailedPrefix: "Não foi possível excluir: ",
      },
      emptyLibrary: "Ainda não há registros nesta biblioteca.",
      latestFallback: "Conforme os registros crescem, prateleiras mensais aparecem aqui.",
      nearbyEmpty: "Ainda não há registros públicos próximos disponíveis. Sua biblioteca continua em primeiro plano.",
      footerNote: "Os registros ficam aqui. Crescimento e contribuição local ficam no seu perfil.",
    },
  };
  return localized[lang] ?? localized.ja;
}

function formatNotesNumber(value: number, lang: SiteLang): string {
  const locale = lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : lang === "pt-BR" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(locale).format(value);
}

function notesItemCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value} 件`;
  if (lang === "es") return `${value} registros`;
  if (lang === "pt-BR") return `${value} registros`;
  return `${value} records`;
}

function notesPlaceCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value} 場所`;
  if (lang === "es") return `${value} lugares`;
  if (lang === "pt-BR") return `${value} lugares`;
  return `${value} places`;
}

function notesRecordUnitLabel(lang: SiteLang): string {
  if (lang === "ja") return "件";
  if (lang === "es") return "registros";
  if (lang === "pt-BR") return "registros";
  return "records";
}

function notesPhotoCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value}枚`;
  if (lang === "es") return `${value} fotos`;
  if (lang === "pt-BR") return `${value} fotos`;
  return `${value} photos`;
}

function notesPhotoAltIndex(index: number, lang: SiteLang): string {
  const value = formatNotesNumber(index, lang);
  if (lang === "ja") return `写真${value}`;
  if (lang === "es") return `foto ${value}`;
  if (lang === "pt-BR") return `foto ${value}`;
  return `photo ${value}`;
}

function renderNotesExperienceLoop(basePath: string, lang: SiteLang): string {
  const copy = notesLibraryCopy(lang).loop;
  const href = (path: string) => escapeHtml(appendLangToHref(withBasePath(basePath, path), lang));
  return `<section class="notes-experience-loop" aria-label="${escapeHtml(copy.aria)}">
    <div class="notes-loop-head">
      <span>${escapeHtml(copy.eyebrow)}</span>
      <h2>${escapeHtml(copy.title)}</h2>
      <p>${escapeHtml(copy.lead)}</p>
    </div>
    <div class="notes-loop-steps">
      ${copy.steps.map((step, index) => `<a class="notes-loop-step" href="${href(step.path)}">
        <b>${index + 1}</b>
        <span>${escapeHtml(step.label)}</span>
        <strong>${escapeHtml(step.title)}</strong>
        <em>${escapeHtml(step.body)}</em>
        <i>${escapeHtml(step.cta)}</i>
      </a>`).join("")}
    </div>
  </section>`;
}

function rankLabelJa(rank: string): string {
  const table: Record<string, string> = {
    kingdom: "界",
    phylum: "門",
    class: "綱",
    order: "目",
    family: "科",
    subfamily: "亜科",
    tribe: "族",
    genus: "属",
    subgenus: "亜属",
    species_group: "種群",
    species: "種",
    subspecies: "亜種",
  };
  return table[rank.toLowerCase()] ?? rank;
}

function authorityEvidenceLabel(evidenceType: ReviewerAuthorityEvidenceType): string {
  switch (evidenceType) {
    case "field_event":
      return "観察会";
    case "webinar":
      return "ウェビナー";
    case "literature":
      return "論文・文献";
    case "reference_owned":
      return "図鑑・雑誌";
    default:
      return "その他";
  }
}

function renderAuthoritySummaryChips(authorities: Awaited<ReturnType<typeof getReviewerAccessContext>>["activeAuthorities"]): string {
  if (authorities.length === 0) {
    return `<div class="meta">まだ分類群スコープは付与されていません。</div>`;
  }

  return `<div class="actions">${authorities
    .map((authority) =>
      `<span class="pill">${escapeHtml(authority.scopeTaxonName)}${authority.scopeTaxonRank ? ` · ${escapeHtml(authority.scopeTaxonRank)}` : ""}</span>`,
    )
    .join("")}</div>`;
}

function renderAuthorityCards(authorities: ReviewerAuthority[]): string {
  if (authorities.length === 0) {
    return `<div class="row"><div>まだ authority はありません。</div></div>`;
  }

  return authorities
    .map((authority) => {
      const evidence = authority.evidence.length > 0
        ? authority.evidence.map((entry) =>
            `<li>${escapeHtml(authorityEvidenceLabel(entry.evidenceType))} · ${escapeHtml(entry.title)}${entry.issuerName ? ` <span class="meta">(${escapeHtml(entry.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      const statusLabel = authority.status === "active" ? "active" : "revoked";
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(authority.scopeTaxonName)}</div>
                <div class="meta">${escapeHtml(authority.scopeTaxonRank || "rank未設定")} · ${escapeHtml(authority.subjectUserId)}</div>
              </div>
              <span class="pill">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="meta">付与: ${escapeHtml(authority.grantedAt)} / 理由: ${escapeHtml(authority.reason || "未記載")}</div>
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            <div class="actions">
              ${authority.status === "active"
                ? `<button class="btn secondary" type="button" data-revoke-authority="${escapeHtml(authority.authorityId)}">Revoke</button>`
                : ""}
              <button class="btn secondary" type="button" data-add-evidence="${escapeHtml(authority.authorityId)}">Add evidence</button>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

function authorityRecommendationStatusLabel(status: AuthorityRecommendationStatus): string {
  switch (status) {
    case "pending":
      return "pending";
    case "granted":
      return "granted";
    case "rejected":
      return "rejected";
    case "revoked":
      return "revoked";
    default:
      return status;
  }
}

function authorityRecommendationSourceLabel(sourceKind: AuthorityRecommendationSourceKind): string {
  return sourceKind === "ops_registered" ? "運営登録" : "自己申告";
}

function renderAuthorityAuditCards(entries: ReviewerAuthorityAuditEntry[]): string {
  if (entries.length === 0) {
    return `<div class="row"><div>監査ログはまだありません。</div></div>`;
  }

  return entries
    .map((entry) => {
      const evidence = entry.evidence.length > 0
        ? entry.evidence.map((item) =>
            `<li>${escapeHtml(authorityEvidenceLabel(item.evidenceType))} · ${escapeHtml(item.title)}${item.issuerName ? ` <span class="meta">(${escapeHtml(item.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(entry.scopeTaxonName || "scope未設定")}</div>
                <div class="meta">${escapeHtml(entry.subjectDisplayName || entry.subjectUserId || "subject不明")} · ${escapeHtml(entry.action)}</div>
              </div>
              <span class="pill">${escapeHtml(entry.authorityStatus || "unknown")}</span>
            </div>
            <div class="meta">actor: ${escapeHtml(entry.actorDisplayName || entry.actorUserId || "system")} / created: ${escapeHtml(entry.createdAt)}</div>
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            <details>
              <summary style="cursor:pointer;font-weight:700">payload</summary>
              <pre style="margin:12px 0 0;padding:12px;border-radius:14px;background:#0f172a;color:#e2e8f0;overflow:auto;font-size:12px;line-height:1.6">${escapeHtml(JSON.stringify(entry.payload, null, 2))}</pre>
            </details>
          </div>
        </div>`;
    })
    .join("");
}

function renderAuthorityRecommendationCards(
  recommendations: AuthorityRecommendation[],
  options: {
    currentUserId?: string | null;
    showGrantActions?: boolean;
    canReject?: boolean;
  } = {},
): string {
  if (recommendations.length === 0) {
    return `<div class="row"><div>recommendation はまだありません。</div></div>`;
  }

  return recommendations
    .map((recommendation) => {
      const evidence = recommendation.evidence.length > 0
        ? recommendation.evidence.map((entry) =>
            `<li>${escapeHtml(authorityEvidenceLabel(entry.evidenceType))} · ${escapeHtml(entry.title)}${entry.issuerName ? ` <span class="meta">(${escapeHtml(entry.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      const subjectLabel = recommendation.subjectDisplayName || recommendation.subjectUserId;
      const scopeLabel = `${recommendation.scopeTaxonName}${recommendation.scopeTaxonRank ? ` · ${recommendation.scopeTaxonRank}` : ""}`;
      const ownership = options.currentUserId && options.currentUserId === recommendation.subjectUserId ? "あなた" : subjectLabel;
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(scopeLabel)}</div>
                <div class="meta">${escapeHtml(ownership || "user不明")} · ${escapeHtml(authorityRecommendationSourceLabel(recommendation.sourceKind))}</div>
              </div>
              <span class="pill">${escapeHtml(authorityRecommendationStatusLabel(recommendation.status))}</span>
            </div>
            <div class="meta">作成: ${escapeHtml(recommendation.createdAt)} / 推薦: ${escapeHtml(recommendation.recommendedByDisplayName || recommendation.recommendedByUserId || "未設定")}</div>
            ${recommendation.resolutionNote ? `<div class="meta">解決メモ: ${escapeHtml(recommendation.resolutionNote)}</div>` : ""}
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            ${(options.showGrantActions || options.canReject) && recommendation.status === "pending"
              ? `<div class="actions">
                  ${options.showGrantActions ? `<button class="btn" type="button" data-grant-recommendation="${escapeHtml(recommendation.recommendationId)}">Grant</button>` : ""}
                  ${options.canReject ? `<button class="btn secondary" type="button" data-reject-recommendation="${escapeHtml(recommendation.recommendationId)}">Reject</button>` : ""}
                </div>`
              : ""}
          </div>
        </div>`;
    })
    .join("");
}

/** Small inline "state" card for 401 / 404 states — replaces the old dark-hero div. */
function seasonFromDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "不明";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "不明";
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function formatAbsolute(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${mo}.${da} ${hh}:${mi}`;
}

function canUseSpecialistWorkbench(session: SessionSnapshot | null | undefined): boolean {
  if (!session || session.banned) return false;
  const role = `${session.roleName ?? ""} ${session.rankLabel ?? ""}`.toLowerCase();
  return /admin|analyst|specialist|reviewer|authority|expert|curator/.test(role);
}

function consensusStatusLabel(status: IdentificationConsensusResult["consensusStatus"] | null | undefined): string {
  switch (status) {
    case "community_consensus":
      return "分類合意あり";
    case "authority_backed":
      return "専門確認あり";
    case "open_dispute":
      return "反対意見あり";
    case "gbif_match_failed":
      return "分類名の照合待ち";
    case "lineage_conflict":
      return "分類系列の整理待ち";
    case "single_identification":
      return "同定1件";
    default:
      return "同定待ち";
  }
}

function verificationStatusLabel(status: IdentificationConsensusResult["identificationVerificationStatus"] | null | undefined): string {
  switch (status) {
    case "authority_reviewed":
      return "専門家確認";
    case "community_consensus":
      return "みんなで確認";
    case "blocked_open_dispute":
      return "要追加証拠";
    case "blocked_taxonomy_match":
      return "分類照合待ち";
    case "blocked_lineage_conflict":
      return "分類整理待ち";
    case "needs_media":
      return "要追加証拠";
    case "needs_identification":
      return "未確認";
    default:
      return "未確認";
  }
}

const OBSERVATION_DETAIL_STYLES = `
  ${OBSERVATION_MEDIA_STYLES}
  .shell.shell-observation-detail { --ikimon-shell-target-max: var(--ikimon-page-max); }
  .obs-reading-hero { display: grid; grid-template-columns: 1fr; gap: 18px; margin-top: 16px; margin-bottom: 16px; }
  .obs-reading-media { min-width: 0; order: 1; }
  .obs-reading-panel { display: grid; gap: 10px; align-self: start; order: 2; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 42px rgba(15,23,42,.06); }
  .obs-reading-kicker { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-reading-title { margin: 0; color: #0f172a; font-size: clamp(24px, 3.6vw, 44px); line-height: 1.08; font-weight: 950; letter-spacing: 0; overflow-wrap: anywhere; }
  .obs-reading-lead { margin: 0; color: #64748b; font-size: 12.5px; line-height: 1.6; font-weight: 700; }
  .obs-media-evidence-shell { display: grid; gap: 10px; }
  .obs-media-evidence-head { display: none; }
  .obs-media-evidence-title { display: inline-flex; align-items: center; gap: 7px; color: #0f172a; font-size: 13px; font-weight: 950; }
  .obs-media-evidence-count { color: #475569; font-size: 11.5px; font-weight: 850; }
  .obs-media-discovery { position: relative; z-index: 5; display: grid; gap: 8px; padding: 10px 11px; border-radius: 14px; background: linear-gradient(135deg, rgba(236,253,245,.94), rgba(240,249,255,.9)); border: 1px solid rgba(16,185,129,.2); }
  .obs-media-discovery-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .obs-media-discovery-title { color: #0f172a; font-size: 13px; line-height: 1.25; font-weight: 950; }
  .obs-media-discovery-count { flex-shrink: 0; color: #047857; font-size: 11px; line-height: 1; font-weight: 950; }
  .obs-media-discovery-rail { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; scrollbar-width: none; }
  .obs-media-discovery-rail::-webkit-scrollbar { display: none; }
  .obs-media-discovery-target { flex: 0 0 auto; max-width: 190px; min-height: 38px; display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 16px; border: 1px solid rgba(15,23,42,.1); background: #fff; color: #0f172a; font: inherit; cursor: pointer; box-shadow: 0 6px 16px rgba(15,23,42,.05); }
  .obs-media-discovery-target:hover, .obs-media-discovery-target:focus-visible { border-color: rgba(16,185,129,.34); background: #ecfdf5; outline: none; }
  .obs-media-discovery-target.is-current { border-color: rgba(37,99,235,.34); background: #eff6ff; }
  .obs-media-discovery-target.is-candidate { border-color: rgba(245,158,11,.32); background: #fffbeb; }
  .obs-media-discovery-target.is-current.is-candidate { border-color: rgba(37,99,235,.34); background: #eff6ff; }
  .obs-media-discovery-name { overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; font-size: 12px; line-height: 1.25; font-weight: 950; }
  .obs-media-discovery-role { color: #64748b; font-size: 10px; line-height: 1; font-weight: 900; }
  .obs-record-brief { display: grid; gap: 10px; padding: 12px; border-radius: 16px; background: linear-gradient(135deg, rgba(236,253,245,.78), rgba(239,246,255,.78)); border: 1px solid rgba(16,185,129,.18); }
  .obs-record-brief-kicker { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-record-brief-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .obs-record-brief-card { display: grid; gap: 3px; min-height: 72px; padding: 10px 11px; border-radius: 12px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.07); }
  .obs-record-brief-card span { color: #64748b; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-record-brief-card strong { color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
  .obs-record-brief-card small { color: #64748b; font-size: 11px; line-height: 1.45; font-weight: 750; }
  .obs-reading-media .obs-media-ledger { display: none !important; }
  .obs-record-brief-compact { gap: 8px; padding: 10px 12px; border-radius: 14px; }
  .obs-record-compact-main { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .obs-record-compact-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .obs-record-brief-compact .obs-hero-observer { flex: 0 0 auto; }
  .obs-reading-panel > .obs-media-ledger { display: flex; flex-wrap: nowrap; gap: 5px; overflow-x: auto; scrollbar-width: none; }
  .obs-reading-panel > .obs-media-ledger::-webkit-scrollbar { display: none; }
  .obs-reading-panel .obs-media-ledger-item { flex: 1 1 0; min-width: 0; min-height: 32px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 7px; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.075); text-align: center; white-space: nowrap; }
  .obs-reading-panel a.obs-media-ledger-item { color: inherit; text-decoration: none; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(250,245,255,.84)); }
  .obs-reading-panel a.obs-media-ledger-item:hover, .obs-reading-panel a.obs-media-ledger-item:focus-visible { background: #f5f3ff; border-color: rgba(168,85,247,.24); outline: none; }
  .obs-reading-panel .obs-media-ledger-item strong { flex: 0 0 auto; color: #475569; font-size: 10px; line-height: 1.2; font-weight: 950; }
  .obs-reading-panel .obs-media-ledger-item span { flex: 0 0 auto; color: #0f172a; font-size: 11.5px; line-height: 1.2; font-weight: 950; }
  .obs-reading-panel .obs-media-ledger-item small { display: none; }
  .obs-record-insight { display: grid; gap: 8px; padding: 13px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(240,253,244,.92), rgba(255,255,255,.96)); border: 1px solid rgba(16,185,129,.16); }
  .obs-record-insight p { margin: 0; color: #334155; font-size: 12.5px; line-height: 1.72; font-weight: 740; text-align: start; }
  .obs-record-insight-desktop { display: none; }
  .obs-record-use-status { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; padding: 8px 9px; border-radius: 12px; background: rgba(248,250,252,.82); border: 1px solid rgba(15,23,42,.06); }
  .obs-record-use-status span { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 7px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #475569; font-size: 10px; line-height: 1.2; font-weight: 950; }
  .obs-record-use-status span:first-child { background: #fff7ed; border-color: rgba(245,158,11,.24); color: #92400e; }
  .obs-ai-readout-merged { gap: 10px; padding: 13px 14px; border-radius: 16px; background: linear-gradient(135deg, #ffffff, #f0fdf4); border-color: rgba(16,185,129,.18); }
  .obs-ai-target-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .obs-ai-target-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 5px 4px 10px; border-radius: 999px; border: 1px solid rgba(16,185,129,.22); background: rgba(236,253,245,.82); color: #0f172a; font: inherit; font-size: 12px; line-height: 1.2; font-weight: 950; cursor: pointer; }
  .obs-ai-target-chip[aria-pressed="true"] { background: #ecfdf5; border-color: rgba(16,185,129,.38); box-shadow: inset 0 0 0 1px rgba(16,185,129,.12); }
  .obs-ai-target-status { display: inline-flex; align-items: center; min-height: 20px; padding: 2px 7px; border-radius: 999px; background: rgba(245,158,11,.13); border: 1px solid rgba(245,158,11,.22); color: #92400e; font-size: 9px; line-height: 1; font-weight: 950; }
  .obs-ai-target-status.is-confirmed { background: rgba(16,185,129,.13); border-color: rgba(16,185,129,.24); color: #047857; }
  .obs-ai-merged-row { display: grid; gap: 5px; }
  .obs-ai-merged-label { color: #64748b; font-size: 10px; line-height: 1.2; font-weight: 950; letter-spacing: .07em; text-transform: uppercase; }
  .obs-ai-merged-pills { display: flex; flex-wrap: wrap; gap: 5px; }
  .obs-ai-merged-pills span { display: inline-flex; align-items: center; min-height: 24px; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 11px; line-height: 1.25; font-weight: 850; }
  .obs-ai-detail { display: grid; gap: 8px; padding-top: 1px; }
  .obs-ai-detail[hidden] { display: none; }
  .obs-ai-detail-lead { display: flex; align-items: baseline; gap: 7px; min-width: 0; margin: 0; color: #334155; font-size: 11.5px; line-height: 1.5; font-weight: 760; white-space: normal; }
  .obs-ai-detail-lead strong { flex: 0 0 auto; padding: 2px 7px; border-radius: 999px; background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.2); color: #92400e; font-size: 9.5px; line-height: 1.15; font-weight: 950; }
  .obs-ai-detail-lead span { min-width: 0; color: #334155; overflow: visible; text-overflow: clip; }
  .obs-ai-size-card { display: grid; gap: 7px; padding: 9px 10px; border-radius: 12px; background: rgba(239,246,255,.64); border: 1px solid rgba(59,130,246,.12); }
  .obs-ai-size-main { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .obs-ai-size-main span { display: grid; gap: 2px; min-height: 40px; padding: 6px 7px; border-radius: 10px; background: rgba(255,255,255,.82); color: #64748b; font-size: 9.5px; line-height: 1.2; font-weight: 900; }
  .obs-ai-size-main b { color: #0f172a; font-size: 12px; line-height: 1.2; font-weight: 950; }
  .obs-ai-size-card p { margin: 0; color: #475569; font-size: 10.5px; line-height: 1.5; font-weight: 720; }
  .obs-ai-story { display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: linear-gradient(135deg, rgba(255,251,235,.78), rgba(255,255,255,.9)); border: 1px solid rgba(245,158,11,.18); }
  .obs-ai-story-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: #0f172a; font-size: 12px; line-height: 1.3; font-weight: 950; }
  .obs-ai-story-head em { color: #92400e; font-size: 10.5px; line-height: 1.2; font-style: italic; font-weight: 850; }
  .obs-ai-story-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .obs-ai-story-list li { display: grid; gap: 2px; color: #334155; font-size: 11px; line-height: 1.55; font-weight: 740; }
  .obs-ai-story-list strong { color: #0f172a; font-size: 10.5px; line-height: 1.25; font-weight: 950; }
  .obs-ai-detail-grid { display: grid; gap: 7px; }
  .obs-ai-detail-box { display: grid; gap: 6px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.76); border: 1px solid rgba(15,23,42,.06); }
  .obs-ai-detail-label { color: #64748b; font-size: 10px; line-height: 1.2; font-weight: 950; letter-spacing: .06em; text-transform: uppercase; }
  .obs-ai-detail-list, .obs-ai-compare-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
  .obs-ai-detail-list li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px; color: #334155; font-size: 11px; line-height: 1.45; font-weight: 760; }
  .obs-ai-detail-list li::before { content: ""; width: 5px; height: 5px; margin-top: .65em; border-radius: 999px; background: #10b981; }
  .obs-ai-compare-list li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 7px; align-items: start; color: #334155; font-size: 11px; line-height: 1.45; font-weight: 780; }
  .obs-ai-compare-list li::before { content: "✓"; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-top: 1px; border-radius: 999px; background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.24); color: #047857; font-size: 10px; line-height: 1; font-weight: 950; }
  .obs-ai-compare-list strong { color: #0f172a; font-weight: 950; }
  @media (min-width: 960px) {
    .obs-ai-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .obs-ai-detail-box:first-child, .obs-ai-detail-box:last-child { grid-column: 1 / -1; }
    .obs-hero-video > .obs-record-insight:not(.obs-record-insight-desktop) { display: none; }
    .obs-reading-panel .obs-record-insight-desktop { display: grid; }
    .obs-reading-panel .obs-record-insight-desktop p { font-size: 12px; line-height: 1.62; }
    .obs-reading-media .obs-video-evidence { display: grid !important; order: 4; max-width: none; margin: 0; padding: 10px 12px; border-radius: 14px; background: rgba(248,250,252,.88); }
    .obs-reading-media .obs-video-evidence-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .obs-reading-media .obs-video-evidence-frame figcaption { min-height: 42px; grid-template-rows: 14px 20px; align-content: start; font-size: 9.5px; line-height: 1.2; }
    .obs-reading-media .obs-video-evidence-frame small { display: none; }
  }
  .obs-first-read { display: grid; gap: 7px; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #ffffff, #f0fdf4); border: 1px solid rgba(16,185,129,.18); }
  .obs-first-read-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-scene-overview strong { color: #0f172a; font-size: 12.5px; line-height: 1.35; font-weight: 950; }
  .obs-first-read p { margin: 0; color: #334155; font-size: 13px; line-height: 1.7; font-weight: 760; }
  .obs-current-find { display: grid; gap: 9px; padding: 4px 0 0; }
  .obs-current-find-kicker { color: #0369a1; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-record-story { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 16px 44px rgba(15,23,42,.06); }
  .obs-record-story-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .obs-record-story-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-record-story-title { margin: 3px 0 0; color: #0f172a; font-size: 18px; line-height: 1.35; font-weight: 950; letter-spacing: 0; }
  .obs-record-story-pill { flex-shrink: 0; min-height: 28px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 950; }
  .obs-record-story-body { display: grid; gap: 9px; }
  .obs-record-story-body p { margin: 0; color: #334155; font-size: 13px; line-height: 1.75; font-weight: 760; }
  .obs-record-story-note { color: #64748b; font-size: 11.5px; line-height: 1.55; font-weight: 760; }
  .obs-record-story-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .obs-record-story-card { display: grid; gap: 7px; padding: 13px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-record-story-card strong { color: #0f172a; font-size: 13.5px; line-height: 1.35; font-weight: 950; }
  .obs-record-story-card p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 740; }
  @media (min-width: 960px) {
    .obs-reading-hero { grid-template-columns: minmax(0, 1.18fr) minmax(330px, .82fr); align-items: start; gap: 28px; }
    .obs-reading-media { order: 1; }
    .obs-reading-panel { order: 2; }
  }
  .obs-summary-strip { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; }
  .obs-summary-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); font-size: 11.5px; line-height: 1.4; }
  .obs-summary-chip-label { color: #64748b; font-weight: 900; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
  .obs-summary-chip-value { color: #0f172a; font-weight: 900; }
  .obs-summary-copy { margin: 0; color: #475569; font-size: 13.5px; line-height: 1.75; font-weight: 720; }
  .obs-reading-trust { display: grid; gap: 3px; padding: 10px 12px; border-radius: 12px; background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.88)); border: 1px solid rgba(16,185,129,.18); }
  .obs-reading-trust span { color: #047857; font-size: 10px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
  .obs-reading-trust strong { color: #0f172a; font-size: 14px; line-height: 1.3; font-weight: 950; }
  .obs-reading-trust p { margin: 0; color: #475569; font-size: 12px; line-height: 1.55; font-weight: 700; }
  .obs-original-record-link { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; width: fit-content; padding: 8px 13px; border-radius: 999px; background: rgba(15,23,42,.06); color: #0f172a; font-size: 12px; font-weight: 950; text-decoration: none; }
  .obs-original-record-link:hover { background: rgba(15,23,42,.1); }
  .obs-next-actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .obs-next-action { display: grid; gap: 3px; min-height: 58px; padding: 12px 14px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.1); color: #0f172a; text-decoration: none; transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
  .obs-next-action:hover { transform: translateY(-1px); box-shadow: 0 10px 20px rgba(15,23,42,.08); }
  .obs-next-action.is-primary { background: #ecfdf5; color: #047857; border-color: rgba(16,185,129,.25); box-shadow: 0 10px 24px rgba(16,185,129,.08); }
  .obs-next-action-label { font-size: 14px; font-weight: 950; line-height: 1.3; }
  .obs-next-action-body { color: inherit; opacity: .72; font-size: 12px; line-height: 1.45; font-weight: 760; }
  .obs-read-progress { position: sticky; top: 56px; z-index: 20; display: none; gap: 6px; overflow-x: auto; margin: 4px 0 10px; padding: 5px 4px; background: rgba(255,255,255,.88); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(15,23,42,.06); scrollbar-width: none; }
  .obs-read-progress::-webkit-scrollbar { display: none; }
  .obs-read-progress a { flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 32px; padding: 6px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 11.5px; line-height: 1; font-weight: 900; text-decoration: none; }
  .obs-read-progress a:hover, .obs-read-progress a:focus-visible { background: #ecfdf5; color: #047857; border-color: rgba(16,185,129,.24); outline: none; }
  .obs-reading-flow { display: grid; gap: 18px; max-width: var(--ikimon-content-max); margin: 0 auto; }
  .obs-reading-section { display: grid; gap: 14px; scroll-margin-top: 96px; }
  .obs-visual-next-capture { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 26px rgba(15,23,42,.04); }
  .obs-visual-next-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
  .obs-visual-next-card { display: grid; gap: 5px; padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .obs-visual-next-card.is-high { background: #ecfdf5; border-color: rgba(16,185,129,.24); }
  .obs-visual-next-card span { color: #047857; font-size: 10px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-visual-next-card strong { color: #0f172a; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .obs-visual-next-card p { margin: 0; color: #475569; font-size: 12px; line-height: 1.55; font-weight: 750; }
  .obs-summary-section, .obs-support-panel, .obs-layer, .obs-reading-hero { scroll-margin-top: 96px; }
  @media (max-width: 720px) {
    .obs-reading-hero { gap: 10px; margin-top: 8px; margin-bottom: 12px; }
    .obs-reading-panel { display: contents; }
    .obs-record-brief-compact { order: 1; display: grid; gap: 7px; padding: 9px 10px; }
    .obs-reading-panel > .obs-media-ledger { order: 2; }
    .obs-reading-media { order: 4; }
    .obs-hero-video .obs-record-insight { order: 3; }
    .obs-reading-panel [data-obs-switch-ai-readout] { order: 5; }
    .obs-reading-panel .obs-record-use-status { order: 6; }
    .obs-media-evidence-shell { gap: 7px; }
    .obs-media-evidence-head { padding: 7px 9px; border-radius: 12px; }
    .obs-media-evidence-title { font-size: 12px; }
    .obs-media-evidence-count { font-size: 10.5px; }
    .obs-media-discovery { gap: 6px; padding: 8px 9px; border-radius: 12px; }
    .obs-media-discovery-head { display: none; }
    .obs-media-discovery-title { font-size: 12px; }
    .obs-media-discovery-target { min-height: 34px; max-width: 156px; padding: 6px 8px; border-radius: 14px; }
    .obs-media-discovery-name { font-size: 11px; }
    .obs-media-discovery-role { display: none; }
    .obs-record-brief:not(.obs-record-brief-compact),
    .obs-hero-badges,
    .obs-summary-strip { display: none; }
    .obs-record-compact-main { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
    .obs-record-compact-meta { flex-wrap: nowrap; gap: 6px; min-width: 0; font-size: 11px; }
    .obs-record-compact-meta span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .obs-record-brief-compact .obs-hero-observer { flex: 0 0 auto; font-size: 11px; }
    .obs-record-insight { padding: 10px; border-radius: 13px; }
    .obs-record-insight p { font-size: 11.5px; line-height: 1.55; }
    .obs-current-find { gap: 0; padding: 0; }
    .obs-current-find-kicker { display: none; }
    .obs-hero-byline { margin-top: 5px; font-size: 11px; }
    .obs-reading-title { font-size: 20px; line-height: 1.1; }
    .obs-hero-avatar { width: 20px; height: 20px; font-size: 10px; }
    .obs-first-read { gap: 5px; padding: 10px; border-radius: 12px; }
    .obs-first-read-eye { font-size: 9.5px; letter-spacing: .06em; }
    .obs-first-read p { font-size: 11.5px; line-height: 1.35; }
    .obs-record-brief-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .obs-record-brief-card { min-height: 68px; padding: 8px 7px; }
    .obs-record-brief-card strong { font-size: 12px; }
    .obs-record-brief-card small { font-size: 10px; }
    .obs-read-progress { top: 50px; margin-inline: -4px; }
    .obs-next-action { min-height: 64px; }
    .obs-record-story-head { display: grid; justify-content: stretch; gap: 8px; }
    .obs-record-story-title { font-size: 17px; line-height: 1.45; overflow-wrap: anywhere; }
    .obs-record-story-pill { justify-self: start; max-width: 100%; white-space: normal; }
    .obs-record-story-cards { grid-template-columns: 1fr; }
  }
  .obs-hero { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 18px; margin-bottom: 30px; }
  @media (min-width: 860px) {
    .obs-hero { grid-template-columns: minmax(0, 1.16fr) minmax(320px, .84fr); align-items: start; gap: 36px; }
  }
  .obs-hero-placeholder { aspect-ratio: 4/3; display: grid; place-items: center; text-align: center; font-weight: 800; color: #475569; background: repeating-linear-gradient(0deg, #f0fdf4 0 24px, #ecfdf5 24px 25px); border-radius: 20px; gap: 8px; }
  .obs-hero-placeholder span:first-child { font-size: 40px; }
  .obs-hero-meta { display: flex; flex-direction: column; gap: 15px; padding: 6px 4px 4px; align-self: start; }
  .obs-hero-title { margin: 0; max-width: 18ch; font-size: clamp(30px, 3.1vw, 42px); font-weight: 900; color: #0f172a; letter-spacing: -.02em; line-height: 1.16; }
  .obs-hero-byline { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; color: #475569; font-size: 12.5px; line-height: 1.45; }
  .obs-hero-observer { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; color: #0f172a; text-decoration: none; }
  .obs-hero-avatar { width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 11px; flex-shrink: 0; overflow: hidden; }
  .obs-hero-avatar-img { background: transparent; object-fit: cover; }
  .obs-hero-when { font-weight: 700; }
  .obs-hero-when::before { content: "📅 "; }
  .obs-hero-place::before { content: "📍 "; }
  .obs-hero-badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 5px 12px; font-size: 11.5px; font-weight: 800; background: rgba(16,185,129,.1); color: #047857; border: 1px solid rgba(16,185,129,.2); }
  .obs-badge-species { background: rgba(59,130,246,.08); color: #1d4ed8; border-color: rgba(59,130,246,.2); }
  .obs-badge-nearby { background: rgba(168,85,247,.08); color: #7e22ce; border-color: rgba(168,85,247,.2); }
  .obs-badge-video { background: rgba(15,23,42,.08); color: #0f172a; border-color: rgba(15,23,42,.16); }
  .obs-trust-ladder { display: grid; gap: 10px; padding: 0; border-radius: 16px; background: transparent; border: 0; box-shadow: none; }
  .obs-trust-summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 58px; padding: 12px 14px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); cursor: pointer; }
  .obs-trust-summary::-webkit-details-marker { display: none; }
  .obs-trust-summary::marker { content: ""; }
  .obs-trust-summary strong { display: block; margin-top: 2px; color: #0f172a; font-size: 14px; line-height: 1.45; }
  .obs-trust-toggle { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 5px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 900; }
  .obs-trust-ladder[open] .obs-trust-toggle { background: rgba(15,23,42,.08); color: #334155; }
  .obs-trust-lead { margin: 0; padding: 0 4px; font-size: 12.5px; line-height: 1.7; color: #475569; }
  .obs-trust-head { display: grid; gap: 4px; }
  .obs-trust-head strong { font-size: 15px; color: #0f172a; }
  .obs-trust-head p { margin: 0; font-size: 12.5px; line-height: 1.7; color: #475569; }
  .obs-trust-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .obs-trust-step { display: grid; gap: 6px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.72); border: 1px solid rgba(15,23,42,.08); }
  .obs-trust-step.is-reached { border-color: rgba(16,185,129,.24); background: linear-gradient(135deg, rgba(240,253,244,.96), rgba(255,255,255,.98)); }
  .obs-trust-step.is-current { box-shadow: inset 0 0 0 1px rgba(59,130,246,.2); }
  .obs-trust-step-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-trust-step-label { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #0f172a; }
  .obs-trust-step-pill { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(59,130,246,.12); color: #1d4ed8; font-size: 10px; font-weight: 900; }
  .obs-trust-step-meta { font-size: 11.5px; line-height: 1.6; color: #64748b; font-weight: 700; }
  .obs-reaction-bar { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 0; }
  .obs-reaction { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #fff; font-weight: 800; font-size: 12px; color: #334155; cursor: pointer; transition: transform .12s ease, background .2s ease; }
  .obs-reaction:hover { background: #f9fafb; transform: translateY(-1px); }
  .obs-reaction.is-reacted { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.3); color: #047857; }
  .obs-reaction-count { background: rgba(15,23,42,.06); padding: 1px 6px; border-radius: 10px; font-size: 10.5px; font-weight: 800; }
  .obs-reaction-label { display: none; }
  @media (min-width: 640px) { .obs-reaction-label { display: inline; } }
  .obs-support-panel { display: grid; gap: 9px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.76); border: 1px solid rgba(15,23,42,.07); box-shadow: 0 8px 20px rgba(15,23,42,.035); }
  .obs-support-actions { display: grid; gap: 10px; }
  .obs-support-title { margin: 0; font-size: 13px; font-weight: 900; color: #0f172a; }
  .obs-support-note { margin: 0; color: #64748b; font-size: 12px; line-height: 1.6; }
  .obs-focus { display: grid; gap: 12px; margin-top: 16px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(236,253,245,.92)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 10px 28px rgba(16,185,129,.08); }
  .obs-focus-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-focus-title { margin: 0; font-size: 19px; font-weight: 900; color: #0f172a; line-height: 1.35; letter-spacing: -.01em; }
  .obs-focus-copy { margin: 6px 0 0; font-size: 13px; line-height: 1.7; color: #475569; }
  .obs-focus-pill { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .obs-focus-featured { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px 16px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-focus-role { font-size: 10.5px; font-weight: 900; letter-spacing: .12em; color: #64748b; text-transform: uppercase; }
  .obs-focus-name-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 6px; }
  .obs-focus-name { font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1.2; letter-spacing: -.02em; }
  .obs-focus-rank { font-size: 12px; font-weight: 800; color: #64748b; }
  .obs-focus-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .obs-focus-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 11.5px; font-weight: 800; }
  .obs-focus-open { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 999px; text-decoration: none; background: #111827; color: #fff; font-size: 12.5px; font-weight: 900; white-space: nowrap; box-shadow: 0 6px 18px rgba(15,23,42,.16); }
  .obs-focus-open:hover { background: #1f2937; }
  .obs-focus-open.is-current { background: rgba(16,185,129,.12); color: #047857; box-shadow: none; }
  .obs-focus-rail { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .obs-focus-card { display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border-radius: 14px; border: 1px solid rgba(15,23,42,.08); background: #fff; text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
  .obs-focus-card:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(15,23,42,.08); }
  .obs-focus-card.is-featured { border-color: rgba(16,185,129,.28); background: linear-gradient(135deg, #f0fdf4, #ffffff); }
  .obs-focus-card.is-current { box-shadow: inset 0 0 0 2px rgba(59,130,246,.16); border-color: rgba(59,130,246,.24); }
  .obs-focus-card.is-annotation-focus { border-color: rgba(245,158,11,.34); box-shadow: 0 0 0 4px rgba(245,158,11,.16), 0 12px 24px rgba(15,23,42,.1); }
  .obs-focus-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-focus-card-role { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
  .obs-focus-card-state { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; font-size: 10px; font-weight: 900; }
  .obs-focus-card.is-current .obs-focus-card-state { background: rgba(59,130,246,.12); color: #1d4ed8; }
  .obs-focus-card-name { font-size: 15px; font-weight: 900; color: #0f172a; line-height: 1.35; }
  .obs-focus-card-meta { font-size: 11.5px; line-height: 1.6; color: #64748b; font-weight: 700; }
  .obs-visible-records { margin-top: 10px; }
  .obs-visible-record-card.is-candidate { border-color: rgba(14,165,233,.18); background: linear-gradient(135deg, #ffffff, #f0f9ff); }
  .obs-visible-record-card.is-reference { opacity: .92; background: #f8fafc; }
  .obs-visible-record-history { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; background: rgba(59,130,246,.08); color: #1e3a8a; font-size: 11px; line-height: 1.45; }
  .obs-visible-record-history strong { font-size: 11.5px; color: #1d4ed8; }
  .obs-visible-record-history span { color: #475569; }
  .obs-visible-record-note { margin: -2px 0 0; color: #334155; font-size: 12.5px; line-height: 1.68; font-weight: 760; }
  .obs-visible-record-action { width: 100%; min-height: 40px; padding: 9px 11px; border: 0; border-radius: 12px; background: #059669; color: #fff; font-size: 12px; font-weight: 950; cursor: pointer; }
  .obs-visible-record-action:disabled { opacity: .72; cursor: wait; }
  .obs-visible-record-boundary { display: inline-flex; align-items: center; color: #64748b; font-size: 11px; line-height: 1.45; font-weight: 800; }
  .obs-visible-record-reference { margin: 0; background: rgba(248,250,252,.86); }
  .obs-visible-record-reference-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; padding: 0 12px 12px; }
  .obs-ai-readout { display: grid; gap: 10px; padding: 14px 16px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-ai-readout.is-low, .obs-ai-readout.is-tent { border-color: rgba(239,68,68,.18); background: linear-gradient(180deg, #fff7f7, #fff); }
  .obs-ai-readout.is-medium { border-color: rgba(245,158,11,.22); background: linear-gradient(180deg, #fffdf2, #fff); }
  .obs-ai-readout-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-ai-readout-title { margin: 0; color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 900; }
  .obs-ai-readout-badge { flex-shrink: 0; padding: 4px 8px; border-radius: 999px; background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.26); color: #047857; font-size: 10px; font-weight: 900; white-space: nowrap; }
  .obs-ai-readout.is-low .obs-ai-readout-badge, .obs-ai-readout.is-tent .obs-ai-readout-badge { background: rgba(239,68,68,.1); border-color: rgba(239,68,68,.22); color: #991b1b; }
  .obs-ai-readout.is-medium .obs-ai-readout-badge { background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.28); color: #92400e; }
  .obs-ai-readout-rec { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; color: #0f172a; font-size: 14px; font-weight: 900; }
  .obs-ai-readout-rank { color: #64748b; font-size: 12px; font-weight: 800; }
  .obs-ai-readout-section-label { margin: 0 0 6px; color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-ai-readout-clues { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .obs-ai-readout-clues li { padding: 4px 9px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 11.5px; line-height: 1.35; font-weight: 800; }
  .obs-ai-readout-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .obs-ai-readout-note { margin: 0; padding: 10px 12px; border-radius: 12px; background: rgba(248,250,252,.9); color: #475569; font-size: 12px; line-height: 1.65; font-weight: 700; }
  .obs-ai-readout-note strong { display: block; margin-bottom: 2px; color: #0f172a; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; }
  .obs-layer-note { margin: 0 0 14px; padding: 12px 14px; border-radius: 12px; background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.14); color: #334155; font-size: 13px; line-height: 1.7; }
  @media (max-width: 720px) {
    .obs-focus-featured { flex-direction: column; }
    .obs-focus-open { width: 100%; }
    .obs-focus-rail { display: flex; overflow-x: auto; padding-bottom: 2px; scroll-snap-type: x proximity; }
    .obs-focus-rail:not(.obs-visible-record-main) .obs-focus-card { min-width: 220px; scroll-snap-align: start; }
    .obs-visible-record-main { display: grid; grid-template-columns: 1fr; overflow: visible; gap: 8px; scroll-snap-type: none; }
    .obs-visible-record-main .obs-focus-card { min-width: 0; padding: 12px; gap: 7px; scroll-snap-align: none; }
    .obs-visible-record-main .obs-focus-card-role { font-size: 10px; letter-spacing: .05em; text-transform: none; }
    .obs-visible-record-main .obs-focus-card-state { padding: 2px 7px; font-size: 9.5px; }
    .obs-visible-record-main .obs-focus-card-name { font-size: 14px; overflow-wrap: anywhere; }
    .obs-visible-record-main .obs-focus-card-meta { font-size: 10.5px; line-height: 1.45; }
    .obs-visible-record-main .obs-visible-record-note { display: block; font-size: 11.5px; line-height: 1.6; }
    .obs-ai-readout { gap: 5px; padding: 8px 9px; border-radius: 12px; }
    .obs-ai-readout-top { gap: 8px; }
    .obs-ai-readout-title { font-size: 12.5px; line-height: 1.3; }
    .obs-ai-readout-badge { padding: 3px 7px; font-size: 10px; }
    .obs-ai-readout-rec { gap: 5px; font-size: 12.5px; line-height: 1.25; }
    .obs-ai-readout-rank { font-size: 10.5px; }
    .obs-ai-readout-section-label { margin-bottom: 4px; font-size: 9.5px; letter-spacing: .06em; }
    .obs-ai-readout-clues { gap: 4px; }
    .obs-ai-readout-clues li { padding: 3px 6px; font-size: 10px; line-height: 1.2; }
    .obs-ai-readout-clues li:nth-child(n+3) { display: none; }
    .obs-ai-readout-note { display: block; overflow: visible; padding: 6px 7px; border-radius: 10px; font-size: 10.5px; line-height: 1.45; }
    .obs-ai-readout-note strong { display: inline; margin: 0 4px 0 0; font-size: 9.5px; letter-spacing: .04em; }
    .obs-ai-readout-grid { grid-template-columns: 1fr; gap: 5px; }
  }
  .obs-owner-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; max-width: var(--ikimon-content-max); margin: 0 auto 12px; padding: 7px 9px; border-radius: 14px; background: rgba(255,255,255,.82); border: 1px solid rgba(148,163,184,.24); box-shadow: 0 6px 16px rgba(15,23,42,.04); }
  .obs-owner-tools::before { content: "管理"; flex: 0 0 auto; color: #64748b; font-size: 10px; line-height: 1; letter-spacing: .08em; font-weight: 950; text-transform: uppercase; }
  .obs-owner-tools .section { margin: 0; }
  .obs-owner-tool,
  .obs-reassess-row { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 34px; padding: 0; border: 0; background: transparent; margin: 0; }
  .obs-reassess-row.section, .obs-photo-recovery.section, .obs-owner-delete.section { margin-top: 0; }
  .obs-owner-tool-label { color: #64748b; font-size: 10px; line-height: 1; letter-spacing: .05em; font-weight: 950; }
  .obs-reassess-btn { appearance: none; border: 0; border-radius: 999px; min-height: 32px; padding: 7px 11px; background: #111827; color: #fff; font-weight: 850; font-size: 11.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 3px 10px rgba(15,23,42,.16); }
  .obs-reassess-btn:hover { background: #1f2937; }
  .obs-reassess-btn[disabled] { opacity: .6; cursor: progress; }
  .obs-reassess-status { max-width: 260px; font-size: 11px; font-weight: 750; color: #047857; }
  .obs-reassess-status.is-error { color: #b91c1c; }
  .obs-photo-recovery, .obs-owner-delete { padding: 0; border-radius: 0; overflow: visible; }
  .obs-photo-recovery-form { display: inline-flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .obs-photo-recovery-picker { position: relative; min-height: 32px; display: inline-flex; align-items: center; justify-content: center; padding: 7px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.12); color: #334155; font-size: 11.5px; font-weight: 900; cursor: pointer; overflow: hidden; }
  .obs-photo-recovery-picker input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .obs-photo-recovery-submit { min-height: 32px; padding: 7px 11px; border-radius: 999px; border: 0; background: #111827; color: #fff; font: inherit; font-size: 11.5px; font-weight: 900; cursor: pointer; }
  .obs-photo-recovery-submit[disabled] { opacity: .6; cursor: progress; }
  .obs-photo-recovery-status { max-width: 260px; color: #047857; font-size: 11px; font-weight: 850; }
  .obs-photo-recovery-status.is-error { color: #b91c1c; }
  .obs-owner-delete-button { min-height: 32px; padding: 7px 11px; border-radius: 999px; border: 1px solid rgba(185,28,28,.22); background: #fff7ed; color: #9a3412; font: inherit; font-size: 11.5px; font-weight: 900; cursor: pointer; }
  .obs-owner-delete-button[disabled] { opacity: .62; cursor: progress; }
  .obs-owner-delete-status { max-width: 260px; color: #9a3412; font-size: 11px; font-weight: 850; }
  .obs-owner-delete-status.is-error { color: #b91c1c; }
  .obs-invasive-reporting { max-width: var(--ikimon-content-max); margin: 0 auto 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(255,247,237,.96), rgba(240,253,244,.9)); border: 1px solid rgba(245,158,11,.26); box-shadow: 0 10px 26px rgba(15,23,42,.04); display: grid; gap: 12px; }
  .obs-invasive-reporting-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
  .obs-invasive-reporting h2 { margin: 3px 0 0; color: #0f172a; font-size: 17px; line-height: 1.35; font-weight: 950; }
  .obs-invasive-reporting p { margin: 0; color: #334155; font-size: 13px; line-height: 1.75; font-weight: 760; }
  .obs-invasive-reporting-pill { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; background: rgba(245,158,11,.13); color: #92400e; border: 1px solid rgba(245,158,11,.28); font-size: 11px; font-weight: 950; }
  .obs-invasive-reporting-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .obs-invasive-reporting-panel { padding: 12px; border-radius: 12px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); }
  .obs-invasive-reporting-panel strong { display: block; margin-bottom: 6px; color: #0f172a; font-size: 12px; font-weight: 950; }
  .obs-invasive-reporting-panel ul { margin: 0; padding-left: 18px; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 740; }
  .obs-invasive-reporting-link { width: fit-content; min-height: 36px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 999px; background: #111827; color: #fff; text-decoration: none; font-size: 12px; font-weight: 950; }
  @media (max-width: 760px) {
    .obs-owner-tools { align-items: flex-start; }
    .obs-owner-tools::before { width: 100%; }
    .obs-owner-tool, .obs-reassess-row, .obs-photo-recovery-form { width: 100%; }
    .obs-photo-recovery-picker, .obs-photo-recovery-submit, .obs-owner-delete-button, .obs-reassess-btn { min-height: 38px; border-radius: 12px; }
    .obs-invasive-reporting { padding: 13px; border-radius: 14px; }
    .obs-invasive-reporting-head { display: grid; }
    .obs-invasive-reporting-grid { grid-template-columns: 1fr; }
  }

  .obs-layers-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
  @media (min-width: 960px) {
    .obs-layers-grid { grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    .obs-layers-grid > .obs-layer { margin: 0 !important; }
    /* 全幅 span (優先度 高 or 内容が横長): 名前と分類 / この生きものについて / 場所の物語 */
    .obs-layers-grid > .obs-layer-2,
    .obs-layers-grid > .obs-layer-6,
    .obs-layers-grid > .obs-layer-3 { grid-column: 1 / -1; }
  }
  .obs-layer { display: flex; flex-direction: column; gap: 14px; margin-bottom: 0; padding: 20px; border-radius: 18px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 1px 2px rgba(15,23,42,.03); }
  .obs-layer-title { margin: 0; font-size: 17px; font-weight: 900; color: #0f172a; letter-spacing: .01em; }
  .obs-layer-subtitle { margin: 4px 0 -2px; font-size: 14px; font-weight: 950; color: #0f172a; }
  .obs-terminology-strip { display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-terminology-strip span { min-height: 30px; display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11.5px; font-weight: 950; }
  .obs-story-block { padding: 14px 16px; background: #f9fafb; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-story-ai { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.15); }
  .obs-story-eyebrow { font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 6px; }
  .obs-story-block p { margin: 0 0 6px; color: #334155; font-size: 14px; line-height: 1.7; }
  .obs-ai-note { display: block; margin-top: 6px; color: #94a3b8; font-size: 11.5px; font-weight: 600; }

  .obs-footprint { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
  .obs-footprint-row { padding: 12px 14px; background: #fffbeb; border-radius: 12px; border: 1px solid rgba(245,158,11,.2); display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
  .obs-footprint-num { font-size: 22px; font-weight: 900; color: #b45309; letter-spacing: -.02em; }
  .obs-footprint-label { font-size: 11.5px; color: #78716c; font-weight: 700; }

  .obs-lineage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 4px; padding: 10px 12px; background: #f1f5f9; border-radius: 10px; font-size: 12.5px; }
  .obs-lineage-item { display: inline-flex; flex-direction: column; gap: 1px; padding: 4px 10px; background: #fff; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); font-weight: 800; color: #1e293b; }
  .obs-lineage-item small { font-size: 9px; color: #94a3b8; letter-spacing: .08em; }
  .obs-lineage-sep { color: #cbd5e1; font-weight: 700; }

  .obs-id-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .obs-id-item { display: flex; gap: 12px; padding: 12px 14px; background: #f8fafc; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-id-avatar { width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; color: #fff; display: grid; place-items: center; font-weight: 900; flex-shrink: 0; }
  .obs-id-body { flex: 1; min-width: 0; }
  .obs-id-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .obs-id-name { font-size: 15px; font-weight: 900; color: #0f172a; }
  .obs-id-rank { background: rgba(59,130,246,.1); color: #1d4ed8; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
  .obs-id-accepted { background: rgba(16,185,129,.14); color: #047857; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; border: 1px solid rgba(16,185,129,.3); }
  .obs-id-meta { font-size: 11.5px; color: #64748b; font-weight: 700; margin-top: 3px; }
  .obs-id-note { margin: 6px 0 0; color: #475569; font-size: 13px; line-height: 1.6; }
  .obs-empty { color: #94a3b8; font-size: 13.5px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 12px; border: 1px dashed rgba(15,23,42,.1); }
  .obs-identify-panel { grid-column: 1 / -1; border-color: rgba(14,165,233,.18); background: linear-gradient(180deg, #ffffff, #f8fafc); }
  .obs-identify-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .obs-identify-pill { display: inline-flex; align-items: center; min-height: 30px; padding: 5px 12px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11.5px; font-weight: 900; white-space: nowrap; }
  .obs-consensus-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .obs-consensus-card { display: grid; gap: 5px; padding: 13px 14px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-consensus-card span { font-size: 10.5px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  .obs-consensus-card strong { font-size: 14px; color: #0f172a; line-height: 1.45; }
  .obs-needed-box { padding: 13px 15px; border-radius: 13px; background: rgba(254,249,195,.62); border: 1px solid rgba(234,179,8,.22); }
  .obs-needed-box ul { margin: 6px 0 0; padding-left: 18px; color: #713f12; font-size: 13px; line-height: 1.7; }
  .obs-proposal-trust { display: grid; gap: 10px; padding: 13px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,251,235,.9), rgba(255,255,255,.96)); border: 1px solid rgba(245,158,11,.24); }
  .obs-proposal-trust p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 760; }
  .obs-proposal-trust-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(124px, 1fr)); gap: 7px; }
  .obs-proposal-trust-stat { display: grid; gap: 2px; padding: 9px 10px; border-radius: 11px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.07); }
  .obs-proposal-trust-stat span { color: #64748b; font-size: 10px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-proposal-trust-stat strong { color: #0f172a; font-size: 13px; line-height: 1.25; font-weight: 950; }
  .obs-proposal-trust-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  .obs-proposal-trust-actions button { min-height: 40px; padding: 8px 11px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #fff; color: #0f172a; font: inherit; font-size: 12px; line-height: 1.2; font-weight: 900; cursor: pointer; }
  .obs-proposal-trust-actions button:hover, .obs-proposal-trust-actions button:focus-visible { background: #ecfdf5; border-color: rgba(16,185,129,.26); outline: none; }
  .obs-identify-split { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 880px) { .obs-identify-split { grid-template-columns: .92fr 1.08fr; } }
  .obs-identify-split h3 { margin: 0 0 9px; font-size: 14px; color: #0f172a; font-weight: 900; }
  .obs-dispute-list { display: grid; gap: 8px; }
  .obs-dispute-item { padding: 12px 13px; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-dispute-item.is-open { border-color: rgba(239,68,68,.28); background: rgba(254,242,242,.72); }
  .obs-dispute-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .obs-dispute-top strong { font-size: 13px; color: #0f172a; }
  .obs-dispute-top span { padding: 2px 8px; border-radius: 999px; background: rgba(15,23,42,.08); color: #475569; font-size: 10px; font-weight: 900; }
  .obs-dispute-name { margin-top: 5px; font-size: 13px; font-weight: 900; color: #991b1b; }
  .obs-dispute-item p { margin: 6px 0 0; color: #475569; font-size: 12.5px; line-height: 1.6; }
  .obs-identify-form { display: grid; gap: 11px; }
  .obs-identify-fields { display: grid; grid-template-columns: 1fr; gap: 10px; }
  @media (min-width: 720px) { .obs-identify-fields { grid-template-columns: 1fr 160px; } .obs-identify-fields .is-wide { grid-column: 1 / -1; } }
  .obs-identify-fields label { display: grid; gap: 5px; font-size: 12px; font-weight: 900; color: #334155; }
  .obs-identify-fields input, .obs-identify-fields textarea { width: 100%; border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 12px 13px; font: inherit; background: #fff; color: #0f172a; }
  .obs-identify-fields input { min-height: 50px; }
  .obs-identify-fields textarea { min-height: 104px; resize: vertical; }
  .obs-reference-picker { display: grid; gap: 9px; padding: 12px; border-radius: 12px; border: 1px solid rgba(14,165,233,.16); background: rgba(240,249,255,.72); }
  .obs-reference-picker-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .obs-reference-picker-head strong { color: #0f172a; font-size: 13px; line-height: 1.35; }
  .obs-reference-picker-head a { color: #0369a1; font-size: 12px; font-weight: 900; text-decoration: none; }
  .obs-reference-options { display: grid; gap: 7px; }
  .obs-reference-option { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px; align-items: start; padding: 9px; border-radius: 10px; background: rgba(255,255,255,.84); border: 1px solid rgba(15,23,42,.08); }
  .obs-reference-option input { width: 18px; height: 18px; margin-top: 2px; }
  .obs-reference-option span, .obs-reference-option small { display: block; min-width: 0; overflow-wrap: anywhere; }
  .obs-reference-option span { color: #0f172a; font-size: 12.5px; line-height: 1.45; font-weight: 900; }
  .obs-reference-option small { margin-top: 3px; color: #64748b; font-size: 11.5px; line-height: 1.45; font-weight: 720; }
  .obs-reference-locator { display: grid; gap: 5px; font-size: 12px; font-weight: 900; color: #334155; }
  .obs-reference-locator input { width: 100%; min-height: 44px; border: 1px solid rgba(15,23,42,.14); border-radius: 10px; padding: 10px 12px; font: inherit; background: #fff; color: #0f172a; }
  .obs-identify-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .obs-identify-actions .btn { min-height: 52px; padding-inline: 16px; }
  .obs-identify-actions .btn.is-annotation-focus { box-shadow: 0 0 0 4px rgba(16,185,129,.18); border-color: rgba(16,185,129,.34); }
  .obs-identify-status { min-height: 32px; padding: 8px 10px; border-radius: 10px; background: #f8fafc; color: #475569; font-size: 12px; font-weight: 800; }
  .obs-identify-status.is-error { color: #b91c1c; background: #fef2f2; }
  .obs-identify-login { padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px dashed rgba(15,23,42,.14); }
  .obs-identify-login p { margin: 5px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.6; }
  .obs-frame-identify-card { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(236,253,245,.9)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 10px 26px rgba(15,23,42,.045); }
  .obs-frame-identify-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-frame-identify-copy { display: grid; gap: 3px; min-width: 0; }
  .obs-frame-identify-eye { color: #047857; font-size: 10px; line-height: 1.2; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .obs-frame-identify-title { margin: 0; color: #0f172a; font-size: 16px; line-height: 1.25; font-weight: 950; }
  .obs-frame-identify-copy p { margin: 0; color: #475569; font-size: 11.5px; line-height: 1.55; font-weight: 760; }
  .obs-frame-identify-new { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 7px 10px; border-radius: 999px; background: #0f9f6e; color: #fff; font-size: 11px; font-weight: 950; text-decoration: none; box-shadow: 0 8px 18px rgba(16,185,129,.18); }
  .obs-frame-candidate-switch { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 7px; padding: 7px; border-radius: 13px; background: rgba(255,255,255,.76); border: 1px solid rgba(16,185,129,.14); }
  .obs-frame-candidate-meter { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 4px 8px; border-radius: 999px; background: rgba(236,253,245,.92); color: #047857; font-size: 10px; line-height: 1.2; font-weight: 950; white-space: nowrap; }
  .obs-frame-candidate-meter strong { color: #0f172a; font-size: 11px; }
  .obs-frame-identify-candidates { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; scrollbar-width: none; }
  .obs-frame-identify-candidates::-webkit-scrollbar { display: none; }
  .obs-frame-candidate { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 6px 10px; border-radius: 999px; background: #fff; border: 1px solid rgba(16,185,129,.24); color: #0f172a; font-size: 12px; line-height: 1.2; font-weight: 950; }
  .obs-frame-candidate span { display: inline-flex; align-items: center; min-height: 20px; padding: 2px 7px; border-radius: 999px; background: #fff7ed; border: 1px solid rgba(245,158,11,.22); color: #92400e; font-size: 9.5px; font-weight: 950; }
  .obs-frame-identify-card .obs-ai-actions { padding: 9px; border-radius: 12px; background: rgba(255,255,255,.72); }
  .obs-ai-actions { display: grid; gap: 7px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.07); }
  .obs-ai-actions-label { color: #64748b; font-size: 10px; line-height: 1.2; font-weight: 950; letter-spacing: .06em; text-transform: uppercase; }
  .obs-ai-action-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
  .obs-ai-action { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 6px 8px; border-radius: 12px; border: 1px solid rgba(15,23,42,.1); background: #fff; color: #0f172a; text-align: center; text-decoration: none; font-size: 11px; line-height: 1.2; font-weight: 950; white-space: normal; }
  .obs-ai-action.is-primary { background: #ecfdf5; border-color: rgba(16,185,129,.28); color: #047857; }
  .obs-frame-identify-add-note { margin: 0; color: #0369a1; font-size: 11px; line-height: 1.45; font-weight: 850; }
  .obs-frame-identify-card .obs-identify-fold > summary { min-height: 38px; padding: 8px 10px; border-radius: 12px; background: rgba(248,250,252,.86); font-size: 11.5px; font-weight: 950; }
  .obs-frame-identify-card .obs-identify-split { padding: 8px 10px 10px; gap: 12px; }
  .obs-frame-identify-card .obs-identify-split > div { display: grid; gap: 8px; }
  .obs-frame-identify-card .obs-identify-split h3 { margin: 0; padding-left: 2px; font-size: 13px; line-height: 1.35; }
  .obs-frame-identify-card .obs-identify-split .obs-empty { margin: 0; padding: 14px 16px; text-align: left; }
  .obs-ai-review { display: grid; gap: 12px; margin: 0 0 16px; padding: 14px; border-radius: 16px; background: linear-gradient(135deg, rgba(239,246,255,.92), rgba(240,253,244,.72)); border: 1px solid rgba(59,130,246,.18); }
  .obs-ai-review-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .obs-ai-review-kicker { color: #0369a1; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-ai-review-title { margin: 2px 0 0; color: #0f172a; font-size: 15px; line-height: 1.35; font-weight: 950; }
  .obs-ai-review-badge { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; background: rgba(2,132,199,.12); color: #075985; font-size: 11px; font-weight: 950; }
  .obs-ai-review-copy { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 760; }
  .obs-ai-review-counts { display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-ai-review-counts span { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); color: #475569; font-size: 11px; font-weight: 900; }
  .obs-ai-review-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .obs-ai-review-actions button { min-height: 44px; }
  .obs-ai-review-status { color: #475569; font-size: 12px; font-weight: 850; }
  .obs-ai-review-status.is-error { color: #b91c1c; }
  .obs-specialist-link { display: inline-flex; margin-top: 10px; font-weight: 900; color: #0369a1; text-decoration: none; }
  .obs-id-evidence { display: grid; gap: 12px; padding: 16px; border-radius: 18px; background: linear-gradient(180deg, #ffffff, #f7fcf9); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 14px 34px rgba(15,23,42,.045); }
  .obs-id-evidence-note { width: fit-content; max-width: 100%; display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #64748b; font-size: 11px; line-height: 1.25; font-weight: 850; }
  .obs-id-filter { display: flex; align-items: center; gap: 8px; width: min(100%, 460px); padding: 6px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-id-filter input { flex: 1 1 auto; min-width: 0; min-height: 34px; border: 0; outline: 0; background: transparent; color: #0f172a; font: inherit; font-size: 13px; font-weight: 850; padding: 0 8px; }
  .obs-id-filter input::placeholder { color: #94a3b8; }
  .obs-id-filter-count { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 28px; padding: 4px 9px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 950; }
  .obs-id-tabs { display: flex; flex-wrap: wrap; gap: 7px; padding: 5px; border-radius: 999px; background: rgba(255,255,255,.84); border: 1px solid rgba(15,23,42,.08); width: fit-content; max-width: 100%; }
  .obs-id-tabs.is-many { width: 100%; max-height: 164px; overflow: auto; border-radius: 16px; align-content: flex-start; }
  .obs-id-tab { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border: 1px solid transparent; border-radius: 999px; background: transparent; color: #334155; font: inherit; font-size: 12px; font-weight: 950; cursor: pointer; }
  .obs-id-tab[hidden] { display: none; }
  .obs-id-tab[aria-selected="true"] { background: #ecfdf5; border-color: rgba(16,185,129,.3); color: #047857; }
  .obs-id-empty { display: none; padding: 10px 12px; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #64748b; font-size: 12px; font-weight: 850; }
  .obs-id-empty.is-visible { display: block; }
  .obs-id-panel { display: grid; gap: 11px; }
  .obs-id-panel[hidden] { display: none; }
  .obs-id-summary { display: grid; gap: 8px; padding: 13px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-id-status-pill { width: fit-content; display: inline-flex; align-items: center; min-height: 27px; padding: 5px 10px; border-radius: 999px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.24); color: #047857; font-size: 11px; font-weight: 950; }
  .obs-id-summary p { margin: 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 750; }
  .obs-id-compare { display: grid; grid-template-columns: 112px minmax(0,1fr); gap: 10px; padding: 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .obs-id-compare strong { color: #047857; font-size: 12px; line-height: 1.35; font-weight: 950; }
  .obs-id-compare span { color: #475569; font-size: 12px; line-height: 1.55; font-weight: 730; }
  .obs-id-evidence-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(280px,.92fr); gap: 10px; }
  .obs-id-evidence-card { display: grid; gap: 8px; padding: 13px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-id-evidence-card h3 { margin: 0; color: #0f172a; font-size: 13.5px; line-height: 1.35; font-weight: 950; }
  .obs-id-evidence-list, .obs-id-shot-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
  .obs-id-evidence-list li, .obs-id-shot-list li { display: grid; grid-template-columns: 26px minmax(0,1fr); gap: 8px; align-items: start; padding: 9px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.06); color: #475569; font-size: 12px; line-height: 1.5; font-weight: 730; }
  .obs-id-evidence-list b, .obs-id-shot-list b { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 950; }
  .obs-id-actions { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 11px; border-radius: 14px; background: #fbfefc; border: 1px solid rgba(16,185,129,.16); }
  .obs-id-vote, .obs-id-missing { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .obs-id-missing { padding-left: 10px; border-left: 1px solid rgba(15,23,42,.08); }
  .obs-id-action { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 8px 11px; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.1); color: #0f172a; text-decoration: none; font-size: 12px; line-height: 1.2; font-weight: 950; }
  .obs-id-action.is-primary { background: #d1fae5; color: #065f46; border-color: rgba(16,185,129,.32); }
  .obs-id-action.is-add { background: #eff6ff; color: #1d4ed8; border-color: rgba(59,130,246,.18); }
  @media (max-width: 640px) {
    .obs-identify-panel { padding: 16px; border-radius: 16px; }
    .obs-identify-head { flex-direction: column; align-items: stretch; }
    .obs-identify-pill { align-self: flex-start; min-height: 34px; }
    .obs-consensus-grid { grid-template-columns: 1fr; }
    .obs-identify-actions { display: grid; grid-template-columns: 1fr; }
    .obs-identify-actions .btn { width: 100%; min-height: 56px; white-space: normal; border-radius: 14px; }
    .obs-ai-review-head { flex-direction: column; }
    .obs-ai-review-actions { display: grid; grid-template-columns: 1fr; }
    .obs-ai-review-actions button { width: 100%; }
    .obs-frame-identify-card { gap: 9px; padding: 11px; border-radius: 14px; }
    .obs-frame-identify-top { align-items: stretch; }
    .obs-frame-identify-new { min-height: 40px; padding: 8px 10px; border-radius: 12px; }
    .obs-frame-candidate-switch { grid-template-columns: 1fr; gap: 6px; padding: 7px; }
    .obs-frame-candidate { min-height: 40px; padding: 8px 11px; }
    .obs-frame-identify-card .obs-ai-action-row { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    .obs-frame-identify-card .obs-ai-action { min-height: 44px; padding: 7px 6px; font-size: 10.5px; }
    .obs-id-filter { width: 100%; border-radius: 14px; }
    .obs-id-tabs { width: 100%; border-radius: 14px; }
    .obs-id-tab { flex: 1 1 140px; }
    .obs-id-evidence-grid, .obs-id-actions { grid-template-columns: 1fr; }
    .obs-id-compare { grid-template-columns: 1fr; }
    .obs-id-missing { padding-left: 0; padding-top: 10px; border-left: 0; border-top: 1px solid rgba(15,23,42,.08); }
    .obs-needed-box { padding: 12px 13px; }
    .obs-identify-split { gap: 18px; }
    .obs-focus-head { display: grid; }
    .obs-focus-pill { width: fit-content; letter-spacing: 0; text-transform: none; white-space: normal; }
    .obs-ai-cutout { padding: 14px; border-radius: 16px; }
    .obs-ai-cutout-head { display: grid; }
    .obs-ai-cutout-card { grid-template-columns: 1fr; }
    .obs-ai-cutout-action, .obs-ai-cutout-learn { width: 100%; min-height: 52px; border-radius: 14px; white-space: normal; }
  }

  /* ADR-0004: 主種 + 共生種グリッド */
  .obs-subjects { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 8px; }
  .obs-subjects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .obs-subject-card { padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); display: flex; flex-direction: column; gap: 4px; }
  .obs-subject-card.is-primary { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.25); }
  .obs-subject-role { font-size: 10.5px; font-weight: 900; letter-spacing: .1em; color: #64748b; text-transform: uppercase; }
  .obs-subject-card.is-primary .obs-subject-role { color: #047857; }
  .obs-subject-name { font-size: 14.5px; font-weight: 900; color: #0f172a; line-height: 1.3; }
  .obs-subject-rank { font-size: 11.5px; color: #64748b; font-weight: 700; }
  .obs-subject-conf { font-size: 11px; font-weight: 800; color: #16a34a; }
  .obs-ai-cutout { margin-top: 16px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(236,253,245,.94), rgba(239,246,255,.94)); border: 1px solid rgba(16,185,129,.2); display: grid; gap: 12px; box-shadow: 0 12px 28px rgba(15,23,42,.06); }
  .obs-ai-cutout-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .obs-ai-cutout-eye { margin: 0 0 4px; color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-ai-cutout-title { margin: 0; color: #0f172a; font-size: 15.5px; line-height: 1.45; font-weight: 950; }
  .obs-ai-cutout-copy { margin: 5px 0 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 750; }
  .obs-ai-cutout-pill { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 30px; padding: 6px 10px; border-radius: 999px; background: rgba(16,185,129,.14); color: #065f46; font-size: 11px; line-height: 1; font-weight: 950; white-space: nowrap; }
  .obs-ai-cutout-grid { display: grid; gap: 9px; }
  .obs-ai-cutout-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); }
  .obs-ai-cutout-card strong { display: block; color: #0f172a; font-size: 14px; line-height: 1.35; }
  .obs-ai-cutout-meta { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-ai-cutout-meta span { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 999px; background: rgba(15,23,42,.06); color: #475569; font-size: 10.5px; line-height: 1; font-weight: 900; }
  .obs-ai-cutout-note { margin: 7px 0 0; color: #64748b; font-size: 11.5px; line-height: 1.55; font-weight: 700; }
  .obs-ai-cutout-action { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 13px; border: 0; border-radius: 999px; background: #059669; color: #fff; font-size: 12px; line-height: 1.25; font-weight: 950; cursor: pointer; box-shadow: 0 8px 18px rgba(5,150,105,.18); white-space: nowrap; }
  .obs-ai-cutout-action:disabled { cursor: wait; opacity: .72; }
  .obs-ai-cutout-learn { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 9px 12px; border-radius: 999px; background: rgba(255,255,255,.8); border: 1px solid rgba(15,23,42,.1); color: #0369a1; font-size: 12px; font-weight: 950; text-decoration: none; white-space: nowrap; }
  .obs-ai-cutout-status { min-height: 28px; padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,.74); color: #475569; font-size: 11.5px; font-weight: 850; }
  .obs-ai-cutout-status.is-error { background: #fef2f2; color: #b91c1c; }

  .obs-peers { margin: 0; padding: 10px 14px; background: rgba(168,85,247,.06); border-radius: 10px; font-size: 13px; color: #6b21a8; border: 1px solid rgba(168,85,247,.15); }
  .regional-story { display: grid; gap: 14px; margin: 18px 0; padding: 18px; border-radius: 12px; border: 1px solid rgba(16,185,129,.18); background: linear-gradient(135deg, rgba(240,253,244,.92), rgba(255,255,255,.96)); box-shadow: 0 12px 28px rgba(15,23,42,.045); }
  .regional-story-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
  .regional-story-eyebrow { color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .regional-story h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(22px, 3vw, 32px); line-height: 1.18; letter-spacing: 0; }
  .regional-story-details > summary { cursor: pointer; list-style: none; }
  .regional-story-details > summary::-webkit-details-marker { display: none; }
  .regional-story-summary-title { display: block; margin-top: 6px; color: #10251a; font-size: clamp(18px, 2.4vw, 24px); line-height: 1.25; letter-spacing: 0; }
  .regional-story-head > span { flex: 0 0 auto; display: inline-flex; min-height: 28px; align-items: center; padding: 5px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 950; }
  .regional-story-lead { margin: 0; color: #475569; line-height: 1.8; font-weight: 720; }
  .regional-story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .regional-story-grid:has(> :only-child) { grid-template-columns: 1fr; }
  .regional-story-grid:empty { display: none; }
  .regional-story-grid div { min-height: 96px; padding: 13px; border-radius: 10px; background: rgba(255,255,255,.82); border: 1px solid rgba(16,185,129,.12); }
  .regional-story-next { border-color: rgba(2,132,199,.22) !important; background: linear-gradient(135deg, rgba(240,249,255,.92), rgba(255,255,255,.96)) !important; }
  .regional-story-next small { color: #0369a1 !important; }
  .regional-story-grid small { display: block; color: #047857; font-size: 11px; font-weight: 950; }
  .regional-story-grid strong { display: block; margin-top: 8px; color: #1f3527; font-size: 14px; line-height: 1.55; }
  .regional-story-sources { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px dashed rgba(16,185,129,.16); }
  .regional-story-sources-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .regional-story-sources a { display: inline-flex; align-items: center; min-height: 30px; padding: 6px 9px; border-radius: 999px; background: rgba(16,185,129,.08); color: #047857; font-size: 11px; font-weight: 850; text-decoration: none; }
  .regional-story-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; border-top: 1px dashed rgba(16,185,129,.16); }
  .regional-story-cards-eye { color: #047857; font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; padding-top: 4px; }
  .regional-story-card { display: flex; gap: 12px; padding: 12px 14px; border-radius: 12px; background: #ffffff; border: 1px solid rgba(16,185,129,.18); text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease; }
  .regional-story-card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16,185,129,.12); }
  .regional-story-card-icon { font-size: 22px; line-height: 1; flex: 0 0 auto; }
  .regional-story-card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .regional-story-card-title { font-size: 13.5px; font-weight: 850; color: #10251a; line-height: 1.4; }
  .regional-story-card-summary { font-size: 12.5px; color: #475569; line-height: 1.6; }
  .regional-story-card-source { font-size: 11px; color: #047857; font-weight: 800; }
  .obs-nearby-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .obs-nearby-card { display: flex; flex-direction: column; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); overflow: hidden; text-decoration: none; color: inherit; transition: transform .15s ease; }
  .obs-nearby-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
  .obs-nearby-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; }
  .obs-nearby-nophoto { aspect-ratio: 4/3; display: grid; place-items: center; background: #f1f5f9; color: #94a3b8; font-size: 24px; }
  .obs-nearby-body { padding: 8px 10px; }
  .obs-nearby-name { font-weight: 800; font-size: 12.5px; color: #0f172a; margin-bottom: 2px; }
  .obs-nearby-meta { font-size: 10.5px; color: #94a3b8; font-weight: 700; }
  .obs-area-records { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.16); box-shadow: 0 16px 40px rgba(15,23,42,.045); }
  .obs-area-records-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .obs-area-records-eye { color: #047857; font-size: 10.5px; line-height: 1.2; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
  .obs-area-records-head p { margin: 5px 0 0; max-width: 58em; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 760; }
  .obs-area-count { flex: 0 0 auto; display: inline-flex; min-height: 30px; align-items: center; padding: 5px 11px; border-radius: 999px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.2); color: #047857; font-size: 11px; font-weight: 950; }
  .obs-area-records .obs-nearby-grid { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .obs-area-records .obs-nearby-card { flex-direction: row; align-items: stretch; min-height: 112px; padding: 0; gap: 0; border-color: rgba(16,185,129,.14); box-shadow: 0 10px 24px rgba(15,23,42,.035); }
  .obs-area-records .obs-nearby-card:hover { border-color: rgba(16,185,129,.28); box-shadow: 0 14px 28px rgba(15,23,42,.06); }
  .obs-area-records .obs-nearby-nophoto { width: 52px; height: 52px; aspect-ratio: auto; flex: 0 0 52px; border-radius: 13px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); color: #047857; font-size: 18px; }
  .obs-area-records .obs-area-thumb { width: 180px; flex: 0 0 180px; min-height: 0; aspect-ratio: 4 / 3; object-fit: cover; background: #e2e8f0; }
  .obs-area-records .obs-nearby-body { display: grid; align-content: center; gap: 5px; padding: 13px 14px; min-width: 0; }
  .obs-nearby-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .obs-nearby-title-row .obs-nearby-name { margin: 0; min-width: 0; }
  .obs-nearby-badge { flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 20px; padding: 2px 7px; border-radius: 999px; background: rgba(245,158,11,.12); border: 1px solid rgba(245,158,11,.2); color: #92400e; font-size: 9.5px; line-height: 1; font-weight: 950; }
  .obs-nearby-badge.is-plant { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.22); color: #047857; }
  .obs-nearby-reason { color: #334155; font-size: 11.5px; line-height: 1.45; font-weight: 800; }
  @media (max-width: 640px) {
    .obs-area-records { padding: 16px; }
    .obs-area-records .obs-nearby-grid { grid-template-columns: 1fr; }
    .obs-area-records .obs-nearby-card { flex-direction: column; min-height: 0; }
    .obs-area-records .obs-area-thumb { width: 100%; flex: 0 0 auto; min-height: 0; height: auto; aspect-ratio: 16 / 9; }
    .obs-area-records .obs-nearby-body { padding: 11px 12px; gap: 4px; }
    .obs-nearby-reason { font-size: 11px; line-height: 1.35; }
  }

  .obs-seasonal-wrap { padding: 10px 12px; background: #fffbeb; border-radius: 10px; }
  .obs-seasonal { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; align-items: end; height: 60px; margin-top: 6px; }
  .obs-seasonal-bar { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; font-size: 9px; color: #b45309; font-weight: 700; }
  @media (max-width: 680px) {
    .regional-story-head, .regional-story-grid { grid-template-columns: 1fr; }
    .regional-story-head { flex-direction: column; }
  }
  .obs-seasonal-bar::before { content: ""; display: block; width: 100%; height: var(--h, 0%); background: linear-gradient(180deg, #f59e0b, #fbbf24); border-radius: 3px 3px 0 0; min-height: 2px; }

  .obs-cta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .obs-cta-item { min-height: 82px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 16px 12px; border-radius: 14px; background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid rgba(16,185,129,.15); text-decoration: none; color: #064e3b; font-weight: 800; transition: transform .15s ease; }
  .obs-cta-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,.12); }
  .obs-cta-icon { font-size: 26px; }
  .obs-cta-label { font-size: 13px; text-align: center; }

  .obs-insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .obs-insight-item { padding: 14px 16px; background: #f8fafc; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-insight-eye { font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: .12em; margin-bottom: 6px; }
  .obs-insight-item p { margin: 0; font-size: 13.5px; line-height: 1.7; color: #334155; }

  /* 観察のヒント (Layer 1 先頭・全幅・必ずユーザー目に入る上段) */
  .obs-hint-section { display: flex; flex-direction: column; gap: 14px; padding: 22px 22px; margin-bottom: 24px; border-radius: 18px; border: 1px solid rgba(16,185,129,.18); background: linear-gradient(180deg, #f0fdf4, #ecfdf5); }
  .obs-hint-section.is-medium { border-color: rgba(245,158,11,.22); background: linear-gradient(180deg, #fffbeb, #fef9c3); }
  .obs-hint-section.is-low, .obs-hint-section.is-tent { border-color: rgba(239,68,68,.18); background: linear-gradient(180deg, #fef2f2, #fff1f2); }
  .obs-hint-head { display: flex; align-items: flex-start; gap: 12px; justify-content: space-between; }
  .obs-hint-eyebrow { margin: 0 0 4px; font-size: 10.5px; font-weight: 900; letter-spacing: .16em; color: #64748b; text-transform: uppercase; }
  .obs-hint-title { margin: 0; font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.45; }
  .obs-hint-badge { flex-shrink: 0; padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 900; background: rgba(16,185,129,.15); color: #065f46; border: 1px solid rgba(16,185,129,.3); white-space: nowrap; }
  .obs-hint-section.is-medium .obs-hint-badge { background: rgba(245,158,11,.15); color: #92400e; border-color: rgba(245,158,11,.3); }
  .obs-hint-section.is-low .obs-hint-badge, .obs-hint-section.is-tent .obs-hint-badge { background: rgba(239,68,68,.1); color: #991b1b; border-color: rgba(239,68,68,.25); }
  .obs-hint-rec { display: inline-flex; align-items: baseline; gap: 10px; padding: 10px 14px; background: #fff; border-radius: 12px; border: 1px solid rgba(15,23,42,.08); align-self: flex-start; }
  .obs-hint-rec-name { font-size: 18px; font-weight: 900; color: #0f172a; }
  .obs-hint-rec-rank { font-size: 12px; font-weight: 700; color: #64748b; }
  .obs-hint-best { margin: 0; font-size: 13.5px; color: #334155; padding: 10px 14px; background: rgba(255,255,255,.7); border-radius: 10px; border: 1px dashed rgba(15,23,42,.12); }
  .obs-hint-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .obs-hint-sub { padding: 12px 14px; background: #fff; border-radius: 12px; border: 1px solid rgba(15,23,42,.06); }
  .obs-hint-sub.obs-hint-boost { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.2); }
  .obs-hint-eye { font-size: 10.5px; font-weight: 900; letter-spacing: .14em; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
  .obs-hint-eye-note { margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 700; color: #94a3b8; font-size: 10px; }
  .obs-hint-eye-small { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .obs-hint-sub p, .obs-hint-fun p { margin: 0; font-size: 13.5px; line-height: 1.7; color: #334155; }
  .obs-hint-tags { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-hint-tags li { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; font-size: 12px; font-weight: 700; color: #0f172a; }
  .obs-hint-tags li small { color: #94a3b8; font-size: 10.5px; font-weight: 600; }
  .obs-hint-fun { padding: 12px 14px; background: rgba(99,102,241,.08); border-radius: 12px; border: 1px solid rgba(99,102,241,.18); }
  .obs-hint-similar { padding: 14px 16px; background: rgba(236,72,153,.06); border-radius: 12px; border: 1px solid rgba(236,72,153,.15); display: flex; flex-direction: column; gap: 8px; }
  .obs-hint-inner { margin-top: 4px; }
  .obs-hint-bul { margin: 0; padding-left: 16px; color: #334155; font-size: 13px; line-height: 1.7; }
  .obs-hint-bul li { margin-bottom: 2px; }
  .obs-hint-reminder { margin: 6px 0 0; font-size: 11px; color: #94a3b8; }
  .obs-hint-foot { margin: 4px 0 0; font-size: 11.5px; color: #94a3b8; text-align: right; font-style: italic; }
  .obs-hint-tags.is-muted li { background: rgba(148,163,184,.1); border-color: rgba(148,163,184,.28); color: #475569; font-weight: 600; }
  .obs-hint-missing .obs-hint-eye { color: #64748b; }
  .obs-hint-eye-note { font-weight: 700; font-size: 10px; color: #94a3b8; margin-left: 4px; padding: 1px 6px; border-radius: 999px; background: rgba(148,163,184,.12); }
  .obs-hint-badge-candidate { background: rgba(14,165,233,.12) !important; color: #0369a1 !important; border-color: rgba(14,165,233,.28) !important; }

  .obs-management-card { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.78)); border: 1px solid rgba(16,185,129,.22); display: flex; flex-direction: column; gap: 12px; }
  .obs-management-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-management-head .obs-hint-reminder { margin: 4px 0 0; color: #475569; }
  .obs-management-list { display: flex; flex-direction: column; gap: 10px; }
  .obs-management-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.08); }
  .obs-management-item[data-confirm-state="confirmed"] { border-color: rgba(16,185,129,.34); background: rgba(236,253,245,.96); }
  .obs-management-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .obs-management-kind { align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: rgba(14,165,233,.12); color: #0369a1; font-size: 10px; font-weight: 900; }
  .obs-management-main strong { font-size: 14px; color: #0f172a; line-height: 1.45; }
  .obs-management-main p { margin: 0; font-size: 12.5px; color: #475569; line-height: 1.6; }
  .obs-management-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-management-meta span { font-size: 10.5px; font-weight: 800; color: #64748b; padding: 2px 7px; border-radius: 999px; background: rgba(148,163,184,.12); }
  .obs-management-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .obs-management-actions .btn { min-height: 34px; padding: 6px 10px; font-size: 12px; }
  .obs-care-advice { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(255,255,255,.95), rgba(240,253,244,.86)); border: 1px solid rgba(16,185,129,.2); display: grid; gap: 12px; }
  .obs-care-advice.is-consult { background: linear-gradient(135deg, rgba(255,247,237,.96), rgba(255,251,235,.9)); border-color: rgba(245,158,11,.28); }
  .obs-care-advice.is-suppress { background: linear-gradient(135deg, rgba(239,246,255,.94), rgba(240,253,244,.86)); border-color: rgba(14,165,233,.22); }
  .obs-care-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-care-title { margin: 0; color: #0f172a; font-size: 15px; line-height: 1.4; font-weight: 950; }
  .obs-care-lead { margin: 4px 0 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 740; }
  .obs-care-status { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 28px; padding: 4px 9px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; border: 1px solid rgba(16,185,129,.25); font-size: 10.5px; line-height: 1.15; font-weight: 950; }
  .obs-care-advice.is-consult .obs-care-status { background: rgba(245,158,11,.13); color: #92400e; border-color: rgba(245,158,11,.3); }
  .obs-care-grid { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 10px; }
  .obs-care-panel { padding: 12px 13px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.07); }
  .obs-care-panel strong { display: block; margin-bottom: 6px; color: #0f172a; font-size: 12px; line-height: 1.35; font-weight: 950; }
  .obs-care-panel ul { margin: 0; padding-left: 17px; color: #334155; font-size: 12.5px; line-height: 1.65; font-weight: 740; }
  .obs-care-note { margin: 0; color: #64748b; font-size: 11.5px; line-height: 1.6; font-weight: 760; }
  .obs-care-policy { display: grid; gap: 8px; padding: 12px 13px; border-radius: 12px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); }
  .obs-care-policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .obs-care-policy label { display: grid; gap: 4px; color: #475569; font-size: 10.5px; font-weight: 900; }
  .obs-care-policy select, .obs-care-policy textarea { width: 100%; border: 1px solid rgba(15,23,42,.14); border-radius: 10px; background: #fff; color: #0f172a; font: inherit; font-size: 12px; font-weight: 760; }
  .obs-care-policy select { min-height: 34px; padding: 6px 8px; }
  .obs-care-policy textarea { min-height: 54px; padding: 8px; resize: vertical; }
  .obs-care-policy-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .obs-care-policy button { min-height: 34px; padding: 7px 12px; border: 0; border-radius: 999px; background: #0f172a; color: #fff; font: inherit; font-size: 12px; font-weight: 950; cursor: pointer; }
  .obs-care-policy-status { color: #047857; font-size: 11px; font-weight: 850; }
  .obs-care-policy-status.is-error { color: #b91c1c; }
  .obs-care-priority { display: inline-flex; align-items: center; width: fit-content; min-height: 24px; padding: 3px 8px; border-radius: 999px; background: rgba(14,165,233,.12); color: #075985; border: 1px solid rgba(14,165,233,.22); font-size: 10.5px; line-height: 1.2; font-weight: 950; }
  .obs-care-priority.is-high { background: rgba(239,68,68,.10); color: #991b1b; border-color: rgba(239,68,68,.22); }
  .obs-care-priority.is-low { background: rgba(100,116,139,.10); color: #475569; border-color: rgba(100,116,139,.2); }
  @media (max-width: 680px) {
    .obs-management-item { grid-template-columns: 1fr; }
    .obs-management-actions { justify-content: stretch; }
    .obs-management-actions .btn { flex: 1; }
    .obs-care-grid { grid-template-columns: 1fr; }
    .obs-care-policy-grid { grid-template-columns: 1fr; }
    .obs-care-head { display: grid; }
    .obs-care-status { width: fit-content; }
  }

  .obs-area-card { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(240,253,244,.7), rgba(239,246,255,.7)); border: 1px solid rgba(14,165,233,.18); display: flex; flex-direction: column; gap: 12px; }
  .obs-area-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-area-head .obs-hint-reminder { margin: 4px 0 0; color: #475569; }
  .obs-area-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .obs-area-group { padding: 10px 12px; background: rgba(255,255,255,.65); border-radius: 12px; border: 1px solid rgba(14,165,233,.12); }
  .obs-area-eye { font-size: 11.5px; font-weight: 900; color: #0f172a; letter-spacing: .02em; margin-bottom: 6px; }
  .obs-area-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .obs-area-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12.5px; color: #334155; line-height: 1.5; }
  .obs-area-label { font-weight: 800; color: #0f172a; }
  .obs-area-why { color: #64748b; font-size: 11.5px; }
  .obs-area-conf { padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .03em; flex-shrink: 0; }
  .obs-area-conf-high { background: rgba(16,185,129,.15); color: #065f46; }
  .obs-area-conf-medium { background: rgba(245,158,11,.15); color: #92400e; }
  .obs-area-conf-low { background: rgba(148,163,184,.18); color: #475569; }
  .obs-area-brief { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(14,165,233,.2); margin-bottom: 4px; }
  .obs-area-brief.is-match { background: rgba(209,250,229,.9); border-color: rgba(16,185,129,.3); }
  .obs-area-brief.is-near { background: rgba(254,252,232,.9); border-color: rgba(234,179,8,.28); }
  .obs-area-brief.is-divergent { background: rgba(254,242,242,.9); border-color: rgba(239,68,68,.28); }
  .obs-area-brief-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: rgba(15,23,42,.08); color: #0f172a; font-size: 15px; font-weight: 900; flex-shrink: 0; }
  .obs-area-brief.is-match .obs-area-brief-icon { background: rgba(16,185,129,.18); color: #065f46; }
  .obs-area-brief.is-near .obs-area-brief-icon { background: rgba(234,179,8,.22); color: #713f12; }
  .obs-area-brief.is-divergent .obs-area-brief-icon { background: rgba(239,68,68,.18); color: #991b1b; }
  .obs-area-brief-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .obs-area-brief-eye { font-size: 10.5px; font-weight: 900; color: #475569; letter-spacing: .04em; text-transform: uppercase; }
  .obs-area-brief-label { font-size: 13.5px; font-weight: 800; color: #0f172a; }
  .obs-area-brief-status { font-size: 11px; font-weight: 900; color: #475569; letter-spacing: .03em; padding: 3px 9px; border-radius: 999px; background: rgba(15,23,42,.06); flex-shrink: 0; }
  .obs-area-brief.is-match .obs-area-brief-status { background: rgba(16,185,129,.2); color: #065f46; }
  .obs-area-brief.is-near .obs-area-brief-status { background: rgba(234,179,8,.22); color: #713f12; }
  .obs-area-brief.is-divergent .obs-area-brief-status { background: rgba(239,68,68,.16); color: #991b1b; }

  .obs-shot-card { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(254,252,232,.85), rgba(255,237,213,.6)); border: 1px solid rgba(234,179,8,.24); display: flex; flex-direction: column; gap: 10px; }
  .obs-shot-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-shot-head .obs-hint-reminder { margin: 4px 0 0; color: #713f12; }
  .obs-shot-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .obs-shot-item { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; background: rgba(255,255,255,.86); border-radius: 12px; border: 1px solid rgba(234,179,8,.2); }
  .obs-shot-role { display: inline-flex; align-items: center; gap: 6px; font-weight: 900; font-size: 12.5px; color: #422006; min-width: 140px; }
  .obs-shot-icon { font-size: 14px; }
  .obs-shot-target { font-weight: 700; color: #0f172a; font-size: 13px; }
  .obs-shot-rationale { color: #64748b; font-size: 11.5px; flex-grow: 1; min-width: 140px; }
  .obs-shot-pri { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .04em; flex-shrink: 0; }
  .obs-shot-pri-high { background: rgba(239,68,68,.12); color: #991b1b; }
  .obs-shot-pri-medium { background: rgba(234,179,8,.18); color: #713f12; }
  .obs-role-cov { margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(234,179,8,.22); display: flex; flex-direction: column; gap: 8px; }
  .obs-role-cov-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-role-cov-eye { font-size: 11.5px; font-weight: 900; color: #713f12; letter-spacing: .04em; text-transform: uppercase; }
  .obs-role-cov-count { font-size: 11.5px; font-weight: 800; color: #64748b; }
  .obs-role-cov-count.is-met { color: #065f46; background: rgba(16,185,129,.14); padding: 2px 9px; border-radius: 999px; }
  .obs-role-cov-bar { position: relative; height: 6px; border-radius: 999px; background: rgba(234,179,8,.15); overflow: hidden; }
  .obs-role-cov-bar span { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #f59e0b, #10b981); transition: width .3s ease; }
  .obs-role-cov-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .obs-role-chip { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(148,163,184,.15); color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; }
  .obs-role-chip.is-covered { background: rgba(16,185,129,.16); color: #065f46; font-weight: 900; }

  .obs-fold { border-radius: 12px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); overflow: hidden; margin-bottom: 8px; }
  .obs-fold > summary { padding: 12px 16px; font-weight: 800; color: #111827; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
  .obs-fold > summary::after { content: "+"; color: #9ca3af; font-size: 16px; margin-left: auto; }
  .obs-fold[open] > summary::after { content: "−"; }
  .obs-fold-count { background: rgba(15,23,42,.08); color: #475569; font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
  .obs-chips { padding: 0 16px 14px; margin: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-chip { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; color: #111827; }
  .obs-chip-conf { color: #16a34a; font-weight: 800; font-size: 10.5px; }
  .obs-chip-src { font-size: 11px; }
`;

function stateCard(eyebrow: string, title: string, body: string): string {
  return `<section class="section">
    <div class="state-card">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h2 style="margin-top:8px">${escapeHtml(title)}</h2>
      <div style="margin-top:8px;color:#475569;line-height:1.7">${body}</div>
    </div>
  </section>`;
}

type RankedSubject = SiblingSubject & {
  focusScore: number;
  focusReason: string;
  roleLabel: string;
};

function highLearningCandidates(candidates: ObservationVisitCandidate[]): ObservationVisitCandidate[] {
  return rankProminentAiCandidates(candidates, 4);
}

function mediaSceneNoun(context: ObservationMediaCopyContext): string {
  if (context.hasVideos && context.hasPhotos) return "写真・動画";
  if (context.hasVideos) return "映像";
  return "写真";
}

function mediaSceneFrom(context: ObservationMediaCopyContext): string {
  if (context.hasVideos && context.hasPhotos) return "写真・動画";
  if (context.hasVideos) return "映像";
  return "写真";
}

function mediaVisibleSurfaceLabel(context: ObservationMediaCopyContext): string {
  if (context.hasVideos && context.hasPhotos) return "この写真・動画に写っているもの";
  if (context.hasVideos) return "この映像に写っているもの";
  return "この写真に写っているもの";
}

function renderMediaDiscoveryPicker(items: VisibleRecordItem[], mediaContext: ObservationMediaCopyContext): string {
  const targets = items
    .filter((item) => Boolean(item.occurrenceId || item.candidateId))
    .slice(0, 8);
  if (targets.length === 0) return "";
  const sceneNoun = mediaSceneNoun(mediaContext);
  return `<div class="obs-media-discovery" data-media-discovery>
    <div class="obs-media-discovery-head">
      <span class="obs-media-discovery-title">${escapeHtml(`${sceneNoun}の中から選ぶ`)}</span>
      <span class="obs-media-discovery-count">${escapeHtml(`${targets.length}件`)}</span>
    </div>
    <div class="obs-media-discovery-rail" aria-label="${escapeHtml(`${sceneNoun}に写っている対象`)}">
      ${targets.map((item) => {
        const attrs = [
          `data-annotation-target="${escapeHtml(item.key)}"`,
          `data-annotation-label="${escapeHtml(item.displayName)}"`,
          item.occurrenceId ? `data-annotation-subject-id="${escapeHtml(item.occurrenceId)}"` : "",
          item.candidateId ? `data-annotation-candidate-id="${escapeHtml(item.candidateId)}"` : "",
        ].filter(Boolean).join(" ");
        const className = [
          "obs-media-discovery-target",
          item.isCurrent ? "is-current" : "",
          item.source === "candidate" ? "is-candidate" : "",
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${className}" ${attrs} aria-label="${escapeHtml(`${item.displayName}を見る`)}">
          <span class="obs-media-discovery-name">${escapeHtml(item.displayName)}</span>
          <span class="obs-media-discovery-role">${escapeHtml(item.roleLabel)}</span>
        </button>`;
      }).join("")}
    </div>
  </div>`;
}

function visibleRecordRead(item: VisibleRecordItem): { role: string; badge: string; body: string } {
  const text = `${item.displayName} ${item.roleLabel} ${item.rankLabel ?? ""} ${item.note ?? ""}`.toLowerCase();
  const badge =
    item.trustLevel === "reviewed"
      ? "確認あり"
      : item.rankLabel
        ? item.rankLabel
        : item.source === "candidate" || item.proposalKind === "ai_candidate"
          ? "仮説"
          : "記録";

  if (/ハチ|蜂|bee|ミツバチ|訪花|花粉|吸蜜/.test(text)) {
    return {
      role: "花に来た虫",
      badge,
      body: "花を利用している相手として重要です。外来かどうかだけで終わらせず、どの花に来ていたかを残すと、その場所の花資源としての役割が見えてきます。",
    };
  }

  if (/イネ科|poaceae|grass|芝|草|lifeform/.test(text)) {
    return {
      role: "草地と裸地",
      badge,
      body: "細い草、草丈、密度、土や礫の見え方は背景ではありません。刈られ方、踏まれ方、乾きやすさを読む手がかりになります。",
    };
  }

  if (/カラスノエンドウ|スズメノエンドウ|エンドウ|マメ科|vicia/.test(text)) {
    return {
      role: item.isFeatured || item.isCurrent ? "代表候補" : "写っている植物",
      badge,
      body: "形や名前だけでなく、どこまで広がり、周囲の草や裸地とどう接しているかまで写ると、この場所でのふるまいが見えてきます。",
    };
  }

  if (/鳥|ハト|鳩|カワラバト|カラス|スズメ|bird|aves/.test(text)) {
    return {
      role: "この場所を使う鳥",
      badge,
      body: "名前だけでなく、階段、手すり、植栽、人との距離まで一緒に残ると、都市や公園のどこを使っているかが読める記録になります。",
    };
  }

  if (/樹|木|クスノキ|カエデ|サクラ|落葉|常緑|tree|植栽/.test(text)) {
    return {
      role: "背景の木・植栽",
      badge,
      body: "主対象の背景に見える木や植栽も、環境を読む材料です。日陰、足元の湿り気、管理された植え込みとの関係が後から比べやすくなります。",
    };
  }

  if (/花|葉|茎|群落|グランドカバー|ヒメイワダレソウ|イワダレソウ|タンポポ|ツワブキ|サツキ|クチナシ|植物|plant/.test(text)) {
    return {
      role: item.isFeatured || item.isCurrent ? "代表候補" : "写っている植物",
      badge,
      body: "形や名前だけでなく、どこまで広がり、周囲の草や裸地とどう接しているかまで写ると、この場所でのふるまいが見えてきます。",
    };
  }

  return {
    role: item.isFeatured || item.isCurrent ? "代表候補" : "一緒に写るもの",
    badge,
    body: "この場面を読む材料のひとつです。名前がまだ粗くても、位置、数、まわりとの関係が残るほど、時間がたっても使いやすい記録になります。",
  };
}

function renderVisibleRecordCard(item: VisibleRecordItem, mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext()): string {
  const className = [
    "obs-focus-card",
    "obs-visible-record-card",
    item.isFeatured ? "is-featured" : "",
    item.isCurrent ? "is-current" : "",
    item.trustLevel === "reference" ? "is-reference" : "",
    item.source === "candidate" ? "is-candidate" : "",
  ].filter(Boolean).join(" ");
  const read = visibleRecordRead(item);
  const meta = visibleRecordMeta(item)
    .filter((value) => value !== item.roleLabel && value !== item.trustLabel)
    .join(" · ");
  const stateLabel = item.isCurrent ? "表示中" : read.badge;
  const body = `
    <div class="obs-focus-card-top">
      <span class="obs-focus-card-role">${escapeHtml(read.role)}</span>
      ${stateLabel ? `<span class="obs-focus-card-state" data-subject-state>${escapeHtml(stateLabel)}</span>` : `<span class="obs-focus-card-state" data-subject-state hidden></span>`}
    </div>
    <div class="obs-focus-card-name">${escapeHtml(item.displayName)}</div>
    ${meta ? `<div class="obs-focus-card-meta">${escapeHtml(meta)}</div>` : ""}
    <p class="obs-visible-record-note">${escapeHtml(read.body)}</p>
    ${item.adoptEndpoint && item.candidateId
      ? `<button type="button"
           class="obs-visible-record-action"
           data-adopt-candidate="${escapeHtml(item.candidateId)}"
           data-adopt-endpoint="${escapeHtml(item.adoptEndpoint)}">${escapeHtml(item.adoptLabel ?? "観測レコードにする")}</button>`
      : ""}`;
  void mediaContext;

  if (item.href && item.occurrenceId) {
    return `<a class="${className}"
       href="${escapeHtml(item.href)}"
       data-subject-switch="1"
       data-subject-id="${escapeHtml(item.occurrenceId)}">${body}</a>`;
  }
  return `<div class="${className}" data-visible-record-candidate="${escapeHtml(item.candidateId ?? "")}">${body}</div>`;
}

export function renderVisibleRecordItemsPanel(items: VisibleRecordItem[], mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext()): string {
  return renderVisibleRecordItemsPanelForMedia(items, mediaContext);
}

function renderVisibleRecordItemsPanelForMedia(items: VisibleRecordItem[], mediaContext: ObservationMediaCopyContext): string {
  const mainItems = items.filter((item) => item.bucket === "main");
  const referenceItems = items.filter((item) => item.bucket === "reference");
  const cards = (mainItems.length > 0 ? mainItems : items).map((item) => renderVisibleRecordCard(item, mediaContext)).join("");
  const referenceBlock = referenceItems.length > 0 && mainItems.length > 0
    ? `<details class="obs-fold obs-visible-record-reference">
         <summary>参考候補 <span class="obs-fold-count">${referenceItems.length}</span></summary>
         <div class="obs-visible-record-reference-grid">${referenceItems.map((item) => renderVisibleRecordCard(item, mediaContext)).join("")}</div>
       </details>`
    : "";
  return `<div class="obs-focus obs-visible-records" data-visible-records-panel>
    <div class="obs-focus-head">
      <div>
        <div class="obs-story-eyebrow">${escapeHtml(mediaVisibleSurfaceLabel(mediaContext))}</div>
        <h2 class="obs-focus-title">写っているもの</h2>
      </div>
      <span class="obs-focus-pill">${escapeHtml(`${items.length}件`)}</span>
    </div>
    <div class="obs-focus-rail obs-visible-record-main">${cards}</div>
    ${referenceBlock}
    <div class="obs-ai-cutout-status" data-adopt-candidate-status hidden></div>
  </div>`;
}

function sceneAtomForVisibleItem(item: VisibleRecordItem): string {
  if (/ハチ|蜂|bee/i.test(item.displayName) || /訪花/.test(item.roleLabel) || /訪花/.test(item.note ?? "")) return "訪花中のハチ";
  if (/ツルニチニチソウ|ツルニチソウ|グランドカバー|つる/i.test(item.displayName) || /グランドカバー/.test(item.note ?? "")) return "足元のグランドカバー";
  if (/背景|樹木|木|低木|植栽/i.test(item.displayName) || /庭木|樹木|植栽/.test(item.note ?? "")) return "背景の樹木";
  if (/イネ科|雑草|草|芝|poaceae/i.test(item.displayName) || /草/.test(item.roleLabel)) return "周囲の草地";
  if (/ヒメイワダレソウ|イワダレソウ/.test(item.displayName) || /白い花|群落/.test(item.note ?? "")) return "白い花の群落";
  if (/シャクナゲ|カルミア|ツツジ|花|葉|群落|地面|茎|ヒメイワダレソウ|イワダレソウ/.test(item.displayName) || /花|群落/.test(item.note ?? "")) return "植栽の花";
  return item.displayName;
}

function sceneReadTextForVisibleItems(items: VisibleRecordItem[], mediaContext: ObservationMediaCopyContext): string {
  const labels = items.map((item) => `${item.displayName} ${item.roleLabel} ${item.note ?? ""}`).join(" ");
  const sceneNoun = mediaSceneNoun(mediaContext);
  if (/アメリカシャクナゲ|カルミア|kalmia/i.test(labels)) {
    const companions = [
      /背景|樹木|木|低木|植栽/i.test(labels) ? "背後の樹木" : "",
      /ツルニチニチソウ|グランドカバー|斑入り/i.test(labels) ? "足元の斑入りグランドカバー" : "",
      /雑草|草地|裸地|礫|踏圧/i.test(labels) ? "草地と裸地" : "",
    ].filter(Boolean);
    return `AIは満開の植栽低木を主役に、${companions.length > 0 ? companions.join("、") : "周囲の植栽帯"}が同じ${sceneNoun}に重なる場面として読んでいます。`;
  }
  if (/ヒメイワダレソウ|イワダレソウ/i.test(labels) && /ハチ|蜂|bee|訪花/i.test(labels)) {
    return `AIは低く広がる白い花を主役に、訪花中の虫と周囲の草地が同じ${sceneNoun}に入った場面として読んでいます。`;
  }
  const atoms = items
    .map(sceneAtomForVisibleItem)
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 4);
  if (atoms.length >= 2) {
    const [main, ...rest] = atoms;
    return `AIは${main}を主役に、${rest.join("、")}が同じ${sceneNoun}に入った場面として読んでいます。`;
  }
  if (atoms.length === 1) return `AIは${atoms[0]}を中心に、周囲との位置関係をこの${sceneNoun}から読もうとしています。`;
  return `AIは名前だけでなく、主役と周囲の状態を同じ${sceneNoun}から読もうとしています。`;
}

function formatSceneRecordTitle(items: VisibleRecordItem[], fallback: string): string {
  const atoms = items
    .map(sceneAtomForVisibleItem)
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 3);
  return atoms.length >= 2 ? atoms.join("・") : fallback;
}

function renderObservationSceneOverview(items: VisibleRecordItem[], mediaContext: ObservationMediaCopyContext): string {
  const atoms = items
    .map(sceneAtomForVisibleItem)
    .concat(items.length > 0 ? ["裸地・礫・踏圧"] : [])
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 5);
  const sceneNoun = mediaSceneNoun(mediaContext);
  return `<article class="obs-first-read obs-scene-overview">
    <div class="obs-first-read-eye">${escapeHtml(mediaVisibleSurfaceLabel(mediaContext))}</div>
    ${atoms.length > 0 ? `<div class="obs-media-discovery-rail" aria-label="${escapeHtml(`${sceneNoun}から読める要素`)}">${atoms.map((atom) => `<span class="obs-media-discovery-target" style="cursor:default"><span class="obs-media-discovery-name">${escapeHtml(atom)}</span></span>`).join("")}</div>` : ""}
    <strong>AIの場面読み</strong>
    <p>${escapeHtml(sceneReadTextForVisibleItems(items, mediaContext))}</p>
  </article>`;
}

function buildObservationMediaAnnotationTargets(
  items: VisibleRecordItem[],
  bundle: ObservationVisitBundle,
): ObservationMediaAnnotationTarget[] {
  const subjectRegions = new Map(bundle.subjects.map((subject) => [subject.occurrenceId, subject.regions]));
  const candidateRegions = new Map(bundle.aiCandidates.map((candidate) => [candidate.candidateId, candidate.regions]));
  return items
    .map((item) => {
      const regions = item.occurrenceId
        ? subjectRegions.get(item.occurrenceId) ?? []
        : item.candidateId
          ? candidateRegions.get(item.candidateId) ?? []
          : [];
      if (regions.length === 0) return null;
      return {
        key: item.key,
        occurrenceId: item.occurrenceId,
        candidateId: item.candidateId,
        displayName: item.displayName,
        roleLabel: item.roleLabel,
        trustLabel: item.trustLabel,
        proposalKind: item.proposalKind,
        adoptEndpoint: item.adoptEndpoint,
        regions,
      } satisfies ObservationMediaAnnotationTarget;
    })
    .filter((item): item is ObservationMediaAnnotationTarget => Boolean(item));
}

function renderAiCandidateLearningPanel(options: {
  basePath: string;
  lang: SiteLang;
  visitId: string;
  candidates: ObservationVisitCandidate[];
  canProposeSubject: boolean;
  isOwner: boolean;
  mediaContext?: ObservationMediaCopyContext;
}): string {
  const candidates = highLearningCandidates(options.candidates);
  if (candidates.length === 0) return "";
  const identifyHref = appendLangToHref(withBasePath(options.basePath, `/observations/${encodeURIComponent(options.visitId)}#identify`), options.lang);
  const mediaCopy = observationMediaCopy(options.mediaContext ?? photoOnlyMediaContext());
  const isVideoOnly = Boolean(options.mediaContext?.hasVideos && !options.mediaContext.hasPhotos);
  const sceneNoun = mediaSceneNoun(options.mediaContext ?? photoOnlyMediaContext());
  return `<section class="obs-ai-cutout" data-ai-cutout-panel>
    <div class="obs-ai-cutout-head">
      <div>
        <p class="obs-ai-cutout-eye">ほかにも写っていそうなもの</p>
        <h2 class="obs-ai-cutout-title">${escapeHtml(isVideoOnly ? "映像の中に、ほかにも見つけたものがありそうです" : `この${sceneNoun}に、ほかにも見つけたものがありそうです`)}</h2>
        <p class="obs-ai-cutout-copy">自動で拾った候補です。この${escapeHtml(sceneNoun)}に写る別の対象として名前を確かめられます。</p>
      </div>
      <span class="obs-ai-cutout-pill">${candidates.length} 件</span>
    </div>
    <div class="obs-ai-cutout-grid">
      ${candidates.map((candidate) => {
        const confidence = typeof candidate.confidence === "number" ? Math.round(candidate.confidence * 100) : null;
        const meta = [
          confidence != null ? (confidence >= 80 ? "かなり近そう" : confidence >= 55 ? "候補" : "要確認") : null,
          publicRankHint(candidate.rank) || null,
          candidate.regions.length > 0 ? "位置の手がかりあり" : "位置は確認待ち",
        ].filter((item): item is string => Boolean(item));
        const action = options.canProposeSubject
          ? `<button type="button"
               class="obs-ai-cutout-action"
               data-adopt-candidate="${escapeHtml(candidate.candidateId)}"
               data-adopt-endpoint="${escapeHtml(withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.visitId)}/candidates/${encodeURIComponent(candidate.candidateId)}/${options.isOwner ? "adopt" : "propose"}`))}">
               ${escapeHtml(options.isOwner ? "観測レコードにする" : "写っている対象として知らせる")}
             </button>`
          : `<a class="obs-ai-cutout-learn" href="${escapeHtml(identifyHref)}">同定する</a>`;
        return `<div class="obs-ai-cutout-card">
          <div>
            <strong>${escapeHtml(candidate.displayName)}</strong>
            ${meta.length > 0 ? `<div class="obs-ai-cutout-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
            ${candidate.note ? `<p class="obs-ai-cutout-note">${escapeHtml(friendlyObservationText(candidate.note, 74))}</p>` : `<p class="obs-ai-cutout-note">${escapeHtml(`同じ${sceneNoun}から見つけた候補です。写っているかを人が確かめます。`)}</p>`}
          </div>
          ${action}
        </div>`;
      }).join("")}
    </div>
    <div class="obs-ai-cutout-status" data-adopt-candidate-status>${options.canProposeSubject ? escapeHtml(`同じ日時・同じ場所・同じ${mediaCopy.clueHeading.replace("から拾えている手がかり", "")}に写る対象として扱います。名前は人の確認でさらに確かになります。`) : "ログインすると、写っているかもしれない対象を知らせられます。自動候補は確定名ではありません。"}</div>
  </section>`;
}

function subjectSpecificityScore(rank: string | null): number {
  switch ((rank ?? "").toLowerCase()) {
    case "species":
      return 70;
    case "subspecies":
      return 62;
    case "genus":
      return 48;
    case "family":
      return 30;
    case "order":
      return 20;
    case "class":
      return 12;
    case "lifeform":
      return 8;
    default:
      return 10;
  }
}

function subjectRoleLabel(subject: SiblingSubject): string {
  if (subject.roleHint === "alt_candidate") return "同定候補";
  if (subject.roleHint === "vegetation") return "植生";
  if (subject.isPrimary) return "最初に拾われた対象";
  return "同じ記録の別対象";
}

function subjectPriorityScore(subject: SiblingSubject, currentOccurrenceId: string): number {
  let score = 0;

  if (subject.identificationCount > 0) {
    score += 260 + Math.min(subject.identificationCount, 6) * 55;
  }

  if (typeof subject.confidence === "number") {
    score += Math.round(subject.confidence * 70);
  }

  switch (subject.latestAssessmentBand) {
    case "high":
      score += 95;
      break;
    case "medium":
      score += 58;
      break;
    case "low":
      score += 28;
      break;
    case "unknown":
      score += 8;
      break;
    default:
      break;
  }

  score += subjectSpecificityScore(subject.rank);

  if (subject.roleHint === "alt_candidate") {
    score -= 45;
  } else if (subject.roleHint === "vegetation") {
    score -= 18;
  } else if (subject.isPrimary) {
    score += 6;
  }

  if (subject.occurrenceId === currentOccurrenceId) {
    score += 4;
  }

  return score;
}

function subjectFocusReason(subject: SiblingSubject): string {
  if (subject.identificationCount > 0) {
    return `みんなの名前確認が ${subject.identificationCount} 件集まっている対象`;
  }
  if (subject.latestAssessmentBand === "high") {
    return "写真からかなり有力そうに見える対象";
  }
  if (typeof subject.confidence === "number" && subject.confidence >= 0.75) {
    return "写真由来の確率が高く、先に見たほうが理解しやすい対象";
  }
  if (subject.roleHint === "vegetation") {
    return "背景ではなく環境手がかりとして読むと意味が出る対象";
  }
  if (subject.roleHint === "alt_candidate") {
    return "同じ被写体を別の分類で見るための候補";
  }
  if (subject.isPrimary) {
    return "最初の対象として保存されている";
  }
    return "同じ記録に写っている別対象";
}

function rankSiblingSubjects(subjects: SiblingSubject[], currentOccurrenceId: string): RankedSubject[] {
  return subjects
    .map((subject) => ({
      ...subject,
      focusScore: subjectPriorityScore(subject, currentOccurrenceId),
      focusReason: subjectFocusReason(subject),
      roleLabel: subjectRoleLabel(subject),
    }))
    .sort((a, b) => {
      if (b.focusScore !== a.focusScore) return b.focusScore - a.focusScore;
      if (b.identificationCount !== a.identificationCount) return b.identificationCount - a.identificationCount;
      const specificityDelta = subjectSpecificityScore(b.rank) - subjectSpecificityScore(a.rank);
      if (specificityDelta !== 0) return specificityDelta;
      const bIsCurrent = b.occurrenceId === currentOccurrenceId ? 1 : 0;
      const aIsCurrent = a.occurrenceId === currentOccurrenceId ? 1 : 0;
      if (bIsCurrent !== aIsCurrent) return bIsCurrent - aIsCurrent;
      if (Number(b.isPrimary) !== Number(a.isPrimary)) return Number(b.isPrimary) - Number(a.isPrimary);
      return a.subjectIndex - b.subjectIndex;
    });
}

function renderReactionBar(
  reactions: Awaited<ReturnType<typeof getReactionSummary>> | null,
  viewerUserId: string | null,
  occurrenceId: string,
): string {
  const reactionMeta: Record<ReactionType, { icon: string; label: string }> = {
    like: { icon: "💚", label: "いいね" },
    helpful: { icon: "✨", label: "参考になった" },
    curious: { icon: "🧭", label: "興味あり" },
    thanks: { icon: "🙏", label: "ありがとう" },
  };
  return reactions
    ? `<div class="obs-reaction-bar" data-occurrence-id="${escapeHtml(occurrenceId)}">
         ${(["like", "helpful", "curious", "thanks"] as ReactionType[])
           .map((type) => `
             <button type="button" class="obs-reaction${reactions.viewerReacted[type] ? " is-reacted" : ""}"
                     data-reaction-type="${type}"
                     ${viewerUserId ? "" : 'data-login-required="1"'}>
               <span>${reactionMeta[type].icon}</span>
               <span class="obs-reaction-label">${reactionMeta[type].label}</span>
               <span class="obs-reaction-count">${reactions.counts[type]}</span>
             </button>`)
           .join("")}
       </div>`
    : "";
}

function renderInvasiveCard(invasive: InvasiveResponse, subjectName: string): string {
  const categoryLabel = mhlwCategoryLabel(invasive.mhlwCategory);
  const pillClass = invasive.mhlwCategory ? `detail-pill detail-pill--${invasive.mhlwCategory}` : "detail-pill detail-pill--prevention";
  const actionLabel = invasiveActionLabel(invasive.recommendedAction);
  const isStrict = invasive.mhlwCategory === "iaspecified";
  const legalBlock = invasive.legalWarning
    ? `<div class="detail-warning-box">⚖️ ${escapeHtml(invasive.legalWarning)}</div>`
    : "";
  const regional = invasive.regionalCaveat
    ? `<p class="detail-card-meta">📍 地域差: ${escapeHtml(invasive.regionalCaveat)}</p>`
    : "";
  const basis = invasive.actionBasis
    ? `<p class="detail-card-meta">出典: ${escapeHtml(invasive.actionBasis)}</p>`
    : "";
  const followBtn = subjectName
    ? `<button class="detail-action-btn" type="button" data-follow-taxon="${escapeHtml(subjectName)}">この種をフォロー</button>`
    : "";
  const reportBtn = isStrict
    ? `<a class="detail-action-btn detail-action-btn--danger" href="https://www.env.go.jp/nature/intro/4control/list.html" target="_blank" rel="noopener">環境省に通報</a>`
    : "";
  return `<section class="detail-card detail-card--lens-invasive">
    <h3 class="detail-card-title">🚨 外来種の可能性 <span class="${pillClass}">${escapeHtml(categoryLabel || "外来種")}</span></h3>
    <div class="detail-card-body">
      ${actionLabel ? `<p style="font-size:18px;font-weight:800;margin:6px 0 4px">推奨対応: ${escapeHtml(actionLabel)}</p>` : ""}
      ${legalBlock}
      ${basis}
      ${regional}
    </div>
    <div class="detail-action-row">
      ${followBtn}
      ${reportBtn}
    </div>
    <p class="detail-card-hedge">${escapeHtml(invasive.hedge)} 駆除前に必ずお住まいの自治体（環境部局）にご確認ください。</p>
  </section>`;
}

function renderInvasiveReportingGuidanceBlock(subject: ObservationVisitSubject, basePath: string, lang: SiteLang): string {
  const invasive = subject.aiAssessment?.invasiveResponse;
  if (!invasive?.isInvasive) return "";
  const categoryLabel = mhlwCategoryLabel(invasive.mhlwCategory) || "外来種候補";
  const learnHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/invasive-species-reporting"), lang));
  const required = ["写真", "発見場所", "発見日時", "個体数や広がり", "安全上の状況"];
  const avoid = ["素手で触らない", "生きたまま運ばない", "駆除判断を自己判断しない", "水草や植物片を散らさない"];
  return `<section class="obs-invasive-reporting" aria-label="外来種情報提供">
    <div class="obs-invasive-reporting-head">
      <div>
        <div class="obs-story-eyebrow">外来種情報提供</div>
        <h2>外来種情報提供の対象になる可能性があります</h2>
      </div>
      <span class="obs-invasive-reporting-pill">${escapeHtml(categoryLabel)}</span>
    </div>
    <p>AI候補が外来種 hard-gate を通った場合、地域ルールと受信許可が揃った自治体・機関にだけ、詳細位置・写真・観察日時を自動共有します。受信許可がない窓口には送らず、公式窓口を案内します。</p>
    <div class="obs-invasive-reporting-grid">
      <div class="obs-invasive-reporting-panel">
        <strong>求められやすい情報</strong>
        <ul>${required.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="obs-invasive-reporting-panel">
        <strong>この場で避けること</strong>
        <ul>${avoid.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
    <p>AI候補であり、確定同定ではありません。詳細位置は公開ページには出ません。</p>
    <a class="obs-invasive-reporting-link" href="${learnHref}">外来種情報提供の仕組みを見る</a>
  </section>`;
}

function selectOption(value: string, current: string, label: string): string {
  return `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function policySummary(policy: PlaceManagementPolicy | null): string {
  if (!policy) return "方針未設定";
  const goal: Record<PlaceManagementPolicy["managementGoal"], string> = {
    balanced: "安全と景観を部分管理",
    keep_clear: "通路・排水はすっきり",
    native_patch: "在来草地を残す",
    flowering_allowed: "花の時期は一部残す",
    invasive_watch: "外来種候補を早めに確認",
  };
  const tolerance: Record<PlaceManagementPolicy["weedTolerance"], string> = {
    low: "草は少なめ",
    medium: "必要部分だけ抑える",
    high: "草花を多めに残す",
  };
  return `${goal[policy.managementGoal]} / ${tolerance[policy.weedTolerance]}`;
}

function renderPolicyForm(policy: PlaceManagementPolicy | null, options: {
  canEditPolicy: boolean;
  placeId: string | null;
  basePath: string;
}): string {
  if (!options.canEditPolicy || !options.placeId) return "";
  const current = policy ?? {
    managementGoal: "balanced",
    weedTolerance: "medium",
    invasiveResponse: "ask_first",
    mowingFrequency: "as_needed",
    notes: "",
  };
  const endpoint = withBasePath(options.basePath, `/api/v1/places/${encodeURIComponent(options.placeId)}/management-policy`);
  return `<form class="obs-care-policy" data-care-policy-form data-endpoint="${escapeHtml(endpoint)}">
    <strong>会社敷地の管理方針</strong>
    <div class="obs-care-policy-grid">
      <label>方針
        <select name="managementGoal">
          ${selectOption("balanced", current.managementGoal, "安全と景観を部分管理")}
          ${selectOption("keep_clear", current.managementGoal, "通路・排水はすっきり")}
          ${selectOption("native_patch", current.managementGoal, "在来草地を残す")}
          ${selectOption("flowering_allowed", current.managementGoal, "花の時期は一部残す")}
          ${selectOption("invasive_watch", current.managementGoal, "外来種候補を早めに確認")}
        </select>
      </label>
      <label>草の許容
        <select name="weedTolerance">
          ${selectOption("low", current.weedTolerance, "少なめ")}
          ${selectOption("medium", current.weedTolerance, "必要部分だけ抑える")}
          ${selectOption("high", current.weedTolerance, "草花を多めに残す")}
        </select>
      </label>
      <label>外来種候補
        <select name="invasiveResponse">
          ${selectOption("ask_first", current.invasiveResponse, "確認してから作業")}
          ${selectOption("controlled_removal", current.invasiveResponse, "計画的に除去")}
          ${selectOption("observe", current.invasiveResponse, "まず観察")}
        </select>
      </label>
      <label>草刈り頻度
        <select name="mowingFrequency">
          ${selectOption("as_needed", current.mowingFrequency, "必要時")}
          ${selectOption("monthly", current.mowingFrequency, "月1目安")}
          ${selectOption("seasonal", current.mowingFrequency, "季節ごと")}
          ${selectOption("rare", current.mowingFrequency, "なるべく少なく")}
        </select>
      </label>
    </div>
    <label>メモ
      <textarea name="notes" maxlength="600" placeholder="例: 正面通路は短く、花壇脇は花が終わるまで残す">${escapeHtml(current.notes)}</textarea>
    </label>
    <div class="obs-care-policy-actions">
      <button type="submit">方針を保存</button>
      <span class="obs-care-policy-status" data-care-policy-status aria-live="polite">${policy ? "保存済み" : ""}</span>
    </div>
  </form>`;
}

function renderCarePolicyScript(canEditPolicy: boolean): string {
  if (!canEditPolicy) return "";
  return `<script>(function(){
    if (window.__ikimonCarePolicyBound) return;
    window.__ikimonCarePolicyBound = true;
    document.addEventListener('submit', function(event) {
      var form = event.target && event.target.closest ? event.target.closest('[data-care-policy-form]') : null;
      if (!form) return;
      event.preventDefault();
      var status = form.querySelector('[data-care-policy-status]');
      var button = form.querySelector('button[type="submit"]');
      var endpoint = form.getAttribute('data-endpoint') || '';
      var data = new FormData(form);
      var payload = {
        managementGoal: String(data.get('managementGoal') || ''),
        weedTolerance: String(data.get('weedTolerance') || ''),
        invasiveResponse: String(data.get('invasiveResponse') || ''),
        mowingFrequency: String(data.get('mowingFrequency') || ''),
        notes: String(data.get('notes') || '')
      };
      if (button) button.disabled = true;
      if (status) { status.textContent = '保存中...'; status.classList.remove('is-error'); }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      }).then(function(response) {
        return response.json().catch(function(){ return {}; }).then(function(json) {
          if (!response.ok || !json || json.ok === false) throw new Error(String((json && json.error) || response.status || 'save_failed'));
          if (status) status.textContent = '保存しました';
        });
      }).catch(function(error) {
        if (status) { status.textContent = '保存できませんでした: ' + String(error && error.message || 'network'); status.classList.add('is-error'); }
      }).finally(function(){ if (button) button.disabled = false; });
    });
  })();</script>`;
}

function renderTrendPanel(trend: PlaceVegetationTrend | null, policy: PlaceManagementPolicy | null): string {
  if (!trend) return "";
  const priorityLabel = trend.priority === "high" ? "優先度 高" : trend.priority === "medium" ? "優先度 中" : "優先度 低";
  return `<div class="obs-care-panel">
    <strong>同じ場所から読む優先順位</strong>
    <span class="obs-care-priority is-${escapeHtml(trend.priority)}">${escapeHtml(priorityLabel)}</span>
    <p>${escapeHtml(trend.headline)}</p>
    <p>${escapeHtml(trend.summary)}</p>
    <ul>${[...trend.evidence, `保存方針: ${policySummary(policy)}`].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </div>`;
}

function renderVegetationCareAdviceCard(subject: ObservationVisitSubject, options: {
  policy?: PlaceManagementPolicy | null;
  trend?: PlaceVegetationTrend | null;
  canEditPolicy?: boolean;
  placeId?: string | null;
  basePath?: string;
} = {}): string {
  const ai = subject.aiAssessment;
  const area = ai?.areaInference ?? null;
  const managementActions = ai?.managementActionCandidates ?? [];
  const display = formatTaxonDisplayName(subject, "ja").primaryLabel;
  const areaHintLines = [
    ...(area?.vegetationStructureCandidates ?? []),
    ...(area?.humanInfluenceCandidates ?? []),
    ...(area?.managementHintCandidates ?? []),
  ].map((candidate) => [candidate.label, candidate.why].filter(Boolean).join(": "));
  const managementActionLines = managementActions.map((candidate) =>
    [candidate.label, candidate.why].filter(Boolean).join(": "),
  );
  const text = [
    display,
    subject.displayName,
    subject.vernacularName,
    subject.scientificName,
    subject.roleLabel,
    subject.focusReason,
    subject.roleHint,
    ai?.recommendedTaxonName,
    ai?.bestSpecificTaxonName,
    ai?.simpleSummary,
    ai?.narrative,
    ...(ai?.diagnosticFeaturesSeen ?? []),
    ...areaHintLines,
    ...managementActionLines,
  ].filter(Boolean).join(" ");
  const isLikelyPlant = /植物|花|草|雑草|木|樹|低木|葉|茎|株|群落|植栽|グランドカバー|つる|蔓|イネ科|シャクナゲ|カルミア|ツルニチニチソウ|ヒメイワダレソウ|plant|tree|grass|vinca|kalmia/i.test(text);
  if (!isLikelyPlant && !ai?.invasiveResponse?.isInvasive) return "";

  const invasive = ai?.invasiveResponse?.isInvasive ? ai.invasiveResponse : null;
  const strictInvasive = invasive?.mhlwCategory === "iaspecified" || invasive?.recommendedAction === "report_only" || invasive?.recommendedAction === "do_not_handle";
  const controlledRemoval = invasive?.recommendedAction === "controlled_removal";
  const actionKinds = new Set(managementActions.map((candidate) => candidate.actionKind));
  const removalOrMowingSignal = actionKinds.has("invasive_removal") || actionKinds.has("mowing") || actionKinds.has("cleanup");
  const sitePressureSignal = actionKinds.has("bare_ground") || actionKinds.has("trampling") || actionKinds.has("pruning");
  const managedPlanting = /植栽|園芸|低木|シャクナゲ|カルミア|kalmia/i.test(text);
  const spreadingGround = removalOrMowingSignal || sitePressureSignal || /雑草|草地|イネ科|グランドカバー|ツルニチニチソウ|つる|蔓|地下茎|種子|裸地|踏圧|vinca/i.test(text);

  const status = strictInvasive
    ? "相談"
    : controlledRemoval
      ? "計画的に抑える"
      : managedPlanting
        ? "手入れ対象"
        : spreadingGround
          ? "抜く前に確認"
          : "様子見";
  const className = strictInvasive ? "is-consult" : controlledRemoval || spreadingGround ? "is-suppress" : "";
  const title = strictInvasive
    ? "抜く前に、管理者か自治体へ確認"
    : controlledRemoval
      ? "広げない前提で、計画的に抑える候補"
      : managedPlanting
        ? "抜く対象というより、植栽として手入れを判断"
        : spreadingGround
          ? "全部抜くより、区画を決めて抑える"
          : "今は抜く/残すを決めず、材料を集める";
  const lead = strictInvasive
    ? "写真AIの読取で外来種の可能性が出たときは、作業量より先に扱い方の確認です。生きたまま移動・保管すると問題になることがあります。"
    : controlledRemoval
      ? "外来種の根拠がある候補です。ただし、処分方法や作業時期を誤ると拡げることがあります。場所の管理目的に合わせて、先に手順を決めます。"
      : managedPlanting
        ? "会社や施設の植栽帯では、花木そのものより、足元の植物・裸地・通路へのはみ出しを見て手入れ量を決めるのが現実的です。"
        : spreadingGround
          ? "会社の敷地では、見た目だけで一面を裸地化するより、通路・排水・植栽への影響、種がつく時期、増え方を見て範囲管理する方が失敗しにくいです。"
          : "この1件だけでは管理判断を強く出しません。写真AIの読取と、場所の管理目的を並べてから決めます。";
  const nextActions = strictInvasive
    ? ["同定が合っているかを人が確認する", "生きたまま別の場所へ動かさない", "管理者・自治体に写真と場所を共有する"]
    : controlledRemoval
      ? ["花・実・種がつく前か確認する", "作業範囲と処分方法を先に決める", "抜いた根や破片を他の区画へ落とさない"]
      : managedPlanting
        ? ["通路や排水を邪魔している部分だけ整える", "足元のグランドカバーが植栽を覆いすぎていないか見る", "花後・剪定時期・景観目的を確認する"]
        : spreadingGround
          ? ["残す区画と抑える区画を決める", "通路・排水・植栽を邪魔する範囲から作業する", "一部だけ残して次回の増え方を比べる"]
          : ["同じ場所で何度か記録する", "花・葉・株元が分かる写真を追加する", "会社の管理目的と照らす"];
  const evidence = [
    ...managementActions.slice(0, 2).map((candidate) => `管理候補: ${candidate.label}${candidate.why ? `（${candidate.why}）` : ""}`),
    ...(area?.managementHintCandidates ?? []).slice(0, 2).map((candidate) => `手入れの跡: ${candidate.label}${candidate.why ? `（${candidate.why}）` : ""}`),
    ...(area?.humanInfluenceCandidates ?? []).slice(0, 1).map((candidate) => `場所の文脈: ${candidate.label}${candidate.why ? `（${candidate.why}）` : ""}`),
  ].filter(Boolean);
  const evidenceItems = evidence.length > 0
    ? evidence
    : ["写真AIの読取だけでは作業判断が弱いので、同じ場所の増え方・通路や排水への影響・管理目的を追加で見る"];
  const policy = options.policy ?? null;
  const trend = options.trend ?? null;
  const policyDrivenAction = policy?.managementGoal === "keep_clear"
    ? "保存した方針に合わせ、通路・排水まわりを優先する"
    : policy?.managementGoal === "native_patch" || policy?.managementGoal === "flowering_allowed"
      ? "保存した方針に合わせ、残す区画を先に決める"
      : policy?.managementGoal === "invasive_watch"
        ? "保存した方針に合わせ、外来種候補は作業前に確認する"
        : "";
  const fieldActions = policyDrivenAction ? [policyDrivenAction, ...nextActions.slice(0, 2)] : nextActions;
  const avoid = strictInvasive
    ? ["素手で扱わない", "袋に入れて生きたまま持ち歩かない", "別区画へ移さない"]
    : invasive
      ? ["刈った破片を散らさない", "土ごと他の場所へ移さない", "確信がないまま大量処分しない"]
      : ["一度に裸地化しない", "花や実だけで同定を決め打ちしない", "周囲の虫や土の状態を無視しない"];
  const basisParts = [
    invasive?.actionBasis ? `外来種メモ: ${invasive.actionBasis}` : "",
    policy ? `保存方針: ${policySummary(policy)}。` : "",
    "最終判断は同定、敷地の目的、安全、現地ルールで決めてください。",
  ].filter(Boolean);
  const trendPanel = renderTrendPanel(trend, policy);
  const policyForm = renderPolicyForm(policy, {
    canEditPolicy: Boolean(options.canEditPolicy),
    placeId: options.placeId ?? null,
    basePath: options.basePath ?? "",
  });
  return `<section class="obs-care-advice ${className}" aria-label="現場アドバイス">
    <div class="obs-care-head">
      <div>
        <div class="obs-hint-eyebrow">現場アドバイス</div>
        <h3 class="obs-care-title">${escapeHtml(title)}</h3>
        <p class="obs-care-lead">${escapeHtml(lead)}</p>
      </div>
      <span class="obs-care-status">${escapeHtml(status)}</span>
    </div>
    <div class="obs-care-grid">
      <div class="obs-care-panel">
        <strong>この場でやること</strong>
        <ul>${fieldActions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="obs-care-panel">
        <strong>判断材料</strong>
        <ul>${evidenceItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      ${trendPanel}
      <div class="obs-care-panel">
        <strong>避けること</strong>
        <ul>${avoid.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </div>
    ${policyForm}
    <p class="obs-care-note">${escapeHtml(basisParts.join(" "))}</p>
    ${renderCarePolicyScript(Boolean(options.canEditPolicy))}
  </section>`;
}

function renderSizeCard(size: SizeAssessment, subjectName: string): string {
  const cls = size.sizeClass;
  const isExceptional = cls === "exceptional";
  const pill = isExceptional
    ? `<span class="detail-pill detail-pill--exceptional">${escapeHtml(sizeClassLabel(cls))}</span>`
    : cls
      ? `<span class="detail-pill" style="background:rgba(59,130,246,.10);color:#1e3a8a">${escapeHtml(sizeClassLabel(cls))}</span>`
      : "";
  const typical = size.typicalSizeCm !== null
    ? `<p style="margin:4px 0;font-size:15px">平均サイズ: <strong>${size.typicalSizeCm.toFixed(1)} cm</strong></p>`
    : "";
  const observed = size.observedSizeEstimateCm !== null
    ? `<p style="margin:4px 0;font-size:18px">この個体: <strong>${size.observedSizeEstimateCm.toFixed(1)} cm</strong></p>`
    : `<p class="detail-card-meta">画像内のスケール参照（手・指・コインなど）が見当たらず、長さ推定はできていません。</p>`;
  const ranking = size.rankingHint
    ? `<p style="margin:4px 0;color:var(--accent-hover);font-weight:700">${escapeHtml(size.rankingHint)}</p>`
    : "";
  const basis = size.basis
    ? `<p class="detail-card-meta">推定根拠: ${escapeHtml(size.basis)}</p>`
    : "";
  const _name = subjectName;
  void _name;
  return `<section class="detail-card detail-card--lens-size">
    <h3 class="detail-card-title">📏 大きさの目安 ${pill}</h3>
    <div class="detail-card-body">
      ${typical}
      ${observed}
      ${ranking}
      ${basis}
    </div>
    <p class="detail-card-hedge">${escapeHtml(size.hedge)}</p>
  </section>`;
}

function renderNoveltyCard(novelty: NoveltyHint): string {
  const pct = novelty.noveltyScore !== null ? Math.round(novelty.noveltyScore * 100) : null;
  return `<section class="detail-card detail-card--lens-novelty">
    <h3 class="detail-card-title">🔍 もしかして新種？ <span class="detail-pill detail-pill--novelty">${pct !== null ? `${pct}% の可能性（参考）` : "可能性あり"}</span></h3>
    <div class="detail-card-body">
      <div class="detail-warning-box" style="background:rgba(168,85,247,.10);border-color:rgba(168,85,247,.25);color:#581c87">これはAIの仮説です。新種判定はAIにはできず、専門研究者による形態・遺伝子解析を経て初めて確定します。</div>
      ${novelty.reasoning ? `<p style="margin-top:10px">${escapeHtml(novelty.reasoning)}</p>` : ""}
    </div>
    <p class="detail-card-hedge">${escapeHtml(novelty.hedge)}</p>
  </section>`;
}

function renderThreeLensCards(subject: ObservationVisitSubject): string {
  const ai = subject.aiAssessment;
  if (!ai) return "";
  const subjectName = ai.recommendedTaxonName || subject.displayName || "";
  const cards: string[] = [];
  if (ai.invasiveResponse) cards.push(renderInvasiveCard(ai.invasiveResponse, subjectName));
  if (ai.sizeAssessment) cards.push(renderSizeCard(ai.sizeAssessment, subjectName));
  if (ai.noveltyHint) cards.push(renderNoveltyCard(ai.noveltyHint));
  if (cards.length === 0) return "";
  return `<div class="detail-three-lens" style="margin-top:14px">${cards.join("")}${renderFollowTaxonScript()}</div>`;
}

let __followScriptEmitted = new WeakSet<object>();
const __followScriptKey = {};

function renderFollowTaxonScript(): string {
  // SSR で複数 subject 描画時に script タグが重複するため、IIFE 内で
  // window フラグを見て一度だけハンドラを取り付ける。
  return `<script>(function(){
    if (window.__ikimonFollowTaxonInit) return;
    window.__ikimonFollowTaxonInit = true;
    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest && event.target.closest('[data-follow-taxon]');
      if (!btn) return;
      event.preventDefault();
      var name = btn.getAttribute('data-follow-taxon');
      if (!name) return;
      btn.disabled = true;
      btn.textContent = '送信中…';
      fetch('/api/v1/me/subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scientificName: name,
          taxonRank: 'species',
          matchField: 'scientific_name',
          channel: 'digest_daily',
          label: name + ' フォロー',
        }),
      }).then(function (r) {
        if (r.status === 401) {
          btn.disabled = false;
          btn.textContent = 'ログインが必要です';
          return;
        }
        if (!r.ok) throw new Error('failed');
        btn.textContent = 'フォロー中 ✓';
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'もう一度フォロー';
      });
    });
  })();</script>`;
}
// referenced to keep WeakSet for future per-request dedupe (no-op now)
void __followScriptEmitted;
void __followScriptKey;

function compactAiReadoutText(text: string, maxLength = 92): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const firstSentenceEnd = normalized.search(/[。.!?！？]/);
  if (firstSentenceEnd > 0 && firstSentenceEnd + 1 <= maxLength) {
    return normalized.slice(0, firstSentenceEnd + 1);
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function friendlyObservationText(text: string | null | undefined, maxLength = 92): string {
  let value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const replacements: Array<[RegExp, string]> = [
    [/個々の花の詳細な構造（花冠の裂片の様子）/g, "花びらの細部"],
    [/花の集まり（花の集まり）/g, "花の集まり"],
    [/地面をはう地面をはう/g, "地面をはう"],
    [/地面をはうの茎/g, "地面をはう茎"],
    [/横からの近くから/g, "横から近くで"],
    [/真上近くから/g, "真上から"],
    [/近くから写真\s*が/g, "近くの写真が"],
    [/の近くから/g, "を近くから"],
    [/在来種との識別に必須/g, "似た種類と比べる手がかり"],
    [/匍匐性植物優占/g, "地面をはう植物が多い"],
    [/マクロ/g, "近くから"],
    [/花序/g, "花の集まり"],
    [/鋸歯/g, "葉のギザギザ"],
    [/総苞/g, "花の根もと"],
    [/匍匐性/g, "地面をはう"],
    [/群落/g, "まとまって生えている場所"],
    [/中生〜乾性/g, "やや乾いた場所"],
    [/中生/g, "ほどよく湿った場所"],
    [/乾性/g, "乾きやすい場所"],
    [/植生構造/g, "草や木の様子"],
    [/遷移段階/g, "育ち方"],
    [/人為影響/g, "人の手が入った跡"],
    [/管理履歴/g, "手入れの跡"],
    [/水分環境/g, "湿り気"],
    [/\bspecies\b/gi, "細かい名前"],
    [/\bgenus\b/gi, "近いなかま"],
    [/\bfamily\b/gi, "大きななかま"],
    [/\btaxonomy\b/gi, "名前の分け方"],
  ];
  for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
  value = value
    .replace(/地面をはう地面をはう/g, "地面をはう")
    .replace(/地面をはうの/g, "地面をはう")
    .replace(/地面をはう地面をはう/g, "地面をはう")
    .replace(/花の横からの近くから/g, "花を横から近くで")
    .replace(/花びらの細部の近くの写真/g, "花びらを近くで写した写真")
    .replace(/\s+([がをには])/g, "$1")
    .replace(/([、。])\1+/g, "$1");
  return compactAiReadoutText(value, maxLength);
}

function publicRankHint(rank: string | null | undefined): string {
  switch (String(rank ?? "").toLowerCase()) {
    case "species":
    case "subspecies":
      return "細かい名前";
    case "genus":
    case "subgenus":
    case "species_group":
      return "近いなかま";
    case "family":
    case "subfamily":
    case "tribe":
    case "lifeform":
      return "大きななかま";
    case "order":
    case "class":
    case "phylum":
    case "kingdom":
      return "広いなかま";
    default:
      return "";
  }
}

function stripCandidateNameFromCopy(text: string, candidateName: string): string {
  let value = text.trim();
  if (candidateName) {
    value = value
      .replace(new RegExp(candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gu"), "")
      .replace(/(?:という)?(?:候補|種|名前)です。?$/u, "です。");
  }
  value = value
    .replace(/、\s*です/u, "です")
    .replace(/の、/u, "の")
    .replace(/\s+/gu, " ")
    .replace(/。{2,}/gu, "。")
    .trim();
  if (!value) return "";
  return value.replace(/。$/u, "");
}

function renderAiSizeSummary(size: SizeAssessment | null): string {
  if (!size) return "";
  const sizeLabel = sizeClassLabel(size.sizeClass);
  const typical = size.typicalSizeCm !== null ? `${size.typicalSizeCm.toFixed(1)} cm` : "不明";
  const ranking = size.rankingHint ? friendlyObservationText(size.rankingHint, 24) : "参考";
  const noteParts = [
    size.observedSizeEstimateCm !== null ? `AI目測 ${size.observedSizeEstimateCm.toFixed(1)} cm` : "スケール参照はなく長さ推定は不可",
    size.basis ? `${friendlyObservationText(size.basis, 34)}のAI目測` : "AI目測",
    "誤差大です",
  ];
  return `<div class="obs-ai-size-card" aria-label="大きさの目安">
    <div class="obs-ai-size-main">
      <span>大きさの目安<b>${escapeHtml(sizeLabel)}</b></span>
      <span>平均サイズ<b>${escapeHtml(typical)}</b></span>
      <span>種内の見方<b>${escapeHtml(ranking)}</b></span>
    </div>
    <p>${escapeHtml(noteParts.filter(Boolean).join("。"))}</p>
  </div>`;
}

function renderAiTaxonStory(insight: TaxonInsight | null | undefined, fallbackName: string): string {
  if (!insight || (!insight.etymology && !insight.ecologyNote && !insight.rarityNote)) return "";
  const rows = [
    insight.etymology ? `<li><strong>名前の由来</strong><span>${escapeHtml(friendlyObservationText(insight.etymology, 110))}</span></li>` : "",
    insight.ecologyNote ? `<li><strong>生き方</strong><span>${escapeHtml(friendlyObservationText(insight.ecologyNote, 112))}</span></li>` : "",
    insight.rarityNote ? `<li><strong>出会いやすさ</strong><span>${escapeHtml(friendlyObservationText(insight.rarityNote, 108))}</span></li>` : "",
  ].filter(Boolean).join("");
  if (!rows) return "";
  return `<div class="obs-ai-story" aria-label="${escapeHtml(fallbackName)}の解説">
    <div class="obs-ai-story-head"><span>${escapeHtml(fallbackName)}を知る</span>${insight.scientificName ? `<em>${escapeHtml(insight.scientificName)}</em>` : ""}</div>
    <ul class="obs-ai-story-list">${rows}</ul>
  </div>`;
}

function renderAiCompareList(subject: ObservationVisitSubject): string {
  const ai = subject.aiAssessment;
  const nameText = `${subject.displayName} ${subject.vernacularName ?? ""} ${subject.scientificName ?? ""} ${ai?.recommendedTaxonName ?? ""}`;
  if (/カワラヒワ|Chloris sinica/i.test(nameText)) {
    return `<div class="obs-ai-detail-box">
      <div class="obs-ai-detail-label">似た仲間との見分け</div>
      <ul class="obs-ai-compare-list">
        <li><span><strong>アオジより翼の黄色い帯がはっきり出るか</strong><br>飛翔時に翼全体へ黄色が広がるなら、カワラヒワ寄り。</span></li>
        <li><span><strong>嘴が太く円錐形に見えるか</strong><br>種子を割るような短く太い嘴なら、アトリ科の候補として強い。</span></li>
        <li><span><strong>腹部の模様だけでアオジに寄せていないか</strong><br>この映像では腹側が弱いので、翼の黄色と嘴を優先して見る。</span></li>
      </ul>
    </div>`;
  }
  const similar = (ai?.similarTaxa ?? []).slice(0, 3);
  const tips = (ai?.distinguishingTips ?? ai?.confirmMore ?? []).map((item) => friendlyObservationText(item, 84)).filter(Boolean).slice(0, 3);
  if (similar.length === 0 && tips.length === 0) return "";
  const rows = similar.length > 0
    ? similar.map((item, index) => `<li><span><strong>${escapeHtml(item.name)}と比べる</strong><br>${escapeHtml(tips[index] ?? "形・色・写っている部位を見比べると判断しやすくなります。")}</span></li>`).join("")
    : tips.map((item) => `<li><span>${escapeHtml(item)}</span></li>`).join("");
  return `<div class="obs-ai-detail-box">
    <div class="obs-ai-detail-label">似た仲間との見分け</div>
    <ul class="obs-ai-compare-list">${rows}</ul>
  </div>`;
}

function renderHeroAiReadout(subject: ObservationVisitSubject, hasOpenDispute = false, insight: TaxonInsight | null = null): string {
  const aiAssessment = subject.aiAssessment;
  if (!aiAssessment) {
    return `<section class="obs-ai-readout is-tent">
      <div class="obs-ai-readout-top">
        <div>
          <p class="obs-hint-eyebrow">名前のいま</p>
          <h3 class="obs-ai-readout-title">${hasOpenDispute ? "名前の見方が割れています。" : "写真から名前を探している段階です。"}</h3>
        </div>
        <span class="obs-ai-readout-badge">${hasOpenDispute ? "確認中" : "未確認"}</span>
      </div>
      <p class="obs-ai-readout-note">${hasOpenDispute ? "別の名前の提案があるため、候補が固まるまで断定しません。" : "写っている形や場所から、分かる人が手がかりを足せます。"}</p>
    </section>`;
  }

  const band = aiAssessment.confidenceBand;
  const bandClass = band === "high" ? "is-high" : band === "medium" ? "is-medium" : band === "low" ? "is-low" : "is-tent";
  const bandLabel = confidenceLabel(band);
  const candidateName = aiAssessment.recommendedTaxonName || subject.displayName || "名前確認中";
  const statusLabel = hasOpenDispute ? "確認中" : subject.identifications.length > 0 ? "確認あり" : "確定前";
  const statusClass = subject.identifications.length > 0 ? " is-confirmed" : "";
  const clues = aiAssessment.diagnosticFeaturesSeen
    .map((feature) => friendlyObservationText(feature, 48))
    .filter(Boolean)
    .slice(0, 3);
  const cluePills = clues.length > 0
    ? `<div class="obs-ai-merged-row"><div class="obs-ai-merged-label">根拠</div><div class="obs-ai-merged-pills">${clues.map((feature) => `<span>${escapeHtml(feature.replace(/（.*?）/gu, ""))}</span>`).join("")}</div></div>`
    : "";
  const leadSource = aiAssessment.simpleSummary || aiAssessment.narrative || clues[0] || "";
  const seasonal = aiAssessment.seasonalContext ? stripCandidateNameFromCopy(friendlyObservationText(aiAssessment.seasonalContext, 64), candidateName) : "";
  const leadText = [
    stripCandidateNameFromCopy(friendlyObservationText(leadSource, 72), candidateName),
    seasonal && !/季節|繁殖|春|夏|秋|冬|月/.test(leadSource) ? seasonal : "",
  ].filter(Boolean).join("。");
  const featureList = clues.length > 0
    ? `<div class="obs-ai-detail-box"><div class="obs-ai-detail-label">映像フレームから拾えている手がかり</div><ul class="obs-ai-detail-list">${clues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : "";
  const compareList = renderAiCompareList(subject);
  const sizeCard = renderAiSizeSummary(aiAssessment.sizeAssessment);
  const story = renderAiTaxonStory(insight, candidateName);
  const note = hasOpenDispute
    ? `<p class="obs-ai-merged-note"><strong>注意</strong>別の名前の提案があるため、候補が固まるまで断定しません。</p>`
    : "";

  return `<section class="obs-ai-readout obs-ai-readout-merged ${bandClass}">
    <div class="obs-ai-target-list obs-ai-primary-targets" aria-label="AIが見ている候補">
      <button class="obs-ai-target-chip" type="button" data-ai-target="${escapeHtml(subject.occurrenceId)}" aria-pressed="true">
        <span>${escapeHtml(candidateName)}</span><span class="obs-ai-target-status${statusClass}">${escapeHtml(statusLabel)}</span>
      </button>
    </div>
    ${cluePills}
    <div class="obs-ai-detail" data-ai-panel="${escapeHtml(subject.occurrenceId)}">
      ${leadText ? `<p class="obs-ai-detail-lead"><strong>${escapeHtml(bandLabel)}</strong><span>${escapeHtml(leadText)}</span></p>` : ""}
      ${sizeCard}
      ${story}
      <div class="obs-ai-detail-grid">${featureList}${compareList}</div>
      ${note}
    </div>
  </section><script>(function(){
    document.querySelectorAll('[data-obs-switch-ai-readout]').forEach(function(root){
      if (root.getAttribute('data-ai-readout-bound') === '1') return;
      root.setAttribute('data-ai-readout-bound', '1');
      root.addEventListener('click', function(event){
        var button = event.target && event.target.closest ? event.target.closest('[data-ai-target]') : null;
        if (!button || !root.contains(button)) return;
        var key = button.getAttribute('data-ai-target');
        root.querySelectorAll('[data-ai-target]').forEach(function(item){ item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); });
        root.querySelectorAll('[data-ai-panel]').forEach(function(panel){ panel.hidden = panel.getAttribute('data-ai-panel') !== key; });
      });
    });
  })();</script>`;
}

type ObservationMediaCopyContext = {
  hasPhotos: boolean;
  hasVideos: boolean;
};

function photoOnlyMediaContext(): ObservationMediaCopyContext {
  return { hasPhotos: true, hasVideos: false };
}

function mediaContextForSnapshot(snapshot: ObservationDetailSnapshot): ObservationMediaCopyContext {
  return {
    hasPhotos: snapshot.photoAssets.length > 0,
    hasVideos: snapshot.videoAssets.length > 0,
  };
}

function observationMediaCopy(context: ObservationMediaCopyContext): {
  clueHeading: string;
  missingHeading: string;
  nextEvidenceHeading: string;
  areaLabel: string;
  areaReminder: string;
  shotAriaLabel: string;
  shotHeading: string;
  shotReminder: string;
  focusLead: string;
  contextHeading: string;
  reassessHint: string;
  videoReassessLoadingText: string;
  photoRecoveryEyebrow: string;
  photoRecoveryTitle: string;
  photoRecoveryBody: string;
} {
  const isVideoOnly = context.hasVideos && !context.hasPhotos;
  if (isVideoOnly) {
    return {
      clueHeading: "映像フレームから拾えている手がかり",
      missingHeading: "この映像からは読み取れないもの",
      nextEvidenceHeading: "あると助かる証拠カット",
      areaLabel: "映像フレームからのエリア推察",
      areaReminder: "自動メモです。断定ではありません。地図の情報と合わせて見てください。",
      shotAriaLabel: "名前の確認に役立つ証拠カット",
      shotHeading: "あると助かる証拠カット",
      shotReminder: "無理に揃える必要はありません。短い映像カットがあると、名前の確認が楽になります。",
      focusLead: "映像フレームから読めている手がかりと、まだ止めている理由を先に確認できます。",
      contextHeading: "動画・音から拾えたこと",
      reassessHint: "動画をもう一度見て、見分けるメモを更新できます。",
      videoReassessLoadingText: "AIで動画を確認しています…",
      photoRecoveryEyebrow: "Add supporting photos",
      photoRecoveryTitle: "この動画記録に写真を追加",
      photoRecoveryBody: "花の根もとや葉など、止まって見える写真を同じ記録に追加できます。",
    };
  }
  if (context.hasVideos) {
    return {
      clueHeading: "写真・映像フレームから拾えている手がかり",
      missingHeading: "この記録のメディアからは読み取れないもの",
      nextEvidenceHeading: "あると助かる写真・映像",
      areaLabel: "写真・映像フレームからのエリア推察",
      areaReminder: "自動メモです。断定ではありません。地図の情報と合わせて見てください。",
      shotAriaLabel: "名前の確認に役立つ写真・映像",
      shotHeading: "足せるなら便利な写真・映像",
      shotReminder: "無理に揃えるものではありません。別角度があると名前を見やすくなります。",
      focusLead: "見えている特徴と、保留している点だけをまとめています。",
      contextHeading: "写真・動画・音から拾えたこと",
      reassessHint: "写真や動画をもう一度見て、見分けるメモを更新できます。",
      videoReassessLoadingText: "AIで動画を確認しています…",
      photoRecoveryEyebrow: "写真追加",
      photoRecoveryTitle: "この記録に写真を追加",
      photoRecoveryBody: "別角度や周辺の写真を同じ記録に追加できます。",
    };
  }
  return {
    clueHeading: "写真から拾えている手がかり",
    missingHeading: "この写真からは読み取れないもの",
    nextEvidenceHeading: "あると助かる写真",
    areaLabel: "この 1 枚からのエリア推察",
    areaReminder: "自動メモです。断定ではありません。地図の情報と合わせて見てください。",
    shotAriaLabel: "名前の確認に役立つ写真",
    shotHeading: "足せるなら便利な写真",
    shotReminder: "無理に揃えるものではありません。別角度があると名前を見やすくなります。",
    focusLead: "見えている特徴と、保留している点だけをまとめています。",
    contextHeading: "写真と音から拾えたこと",
    reassessHint: "写真をもう一度見て、見分けるメモを更新できます。",
    videoReassessLoadingText: "AIで動画を確認しています…",
    photoRecoveryEyebrow: "写真復旧",
    photoRecoveryTitle: "この記録に写真を復旧",
    photoRecoveryBody: "写真の保存が途中で止まった記録は、ここから同じ記録に写真だけ追加できます。",
  };
}

function renderSubjectHint(
  subject: ObservationVisitSubject,
  siteBrief: SiteBrief | null = null,
  photoAssets: { roleTag: string | null }[] | null = null,
  basePath = "",
  mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext(),
  fieldAdviceContext: {
    policy?: PlaceManagementPolicy | null;
    trend?: PlaceVegetationTrend | null;
    canEditPolicy?: boolean;
    placeId?: string | null;
  } = {},
): string {
  const aiAssessment = subject.aiAssessment;
  if (!aiAssessment) {
    const careAdvice = renderVegetationCareAdviceCard(subject, {
      ...fieldAdviceContext,
      basePath,
    });
    return `<details class="obs-fold obs-hint-fold">
      <summary>くわしい見分けメモ <span class="obs-fold-count">様子見</span></summary>
      <section class="obs-hint-section is-tent">
      <div class="obs-hint-head">
        <div>
          <p class="obs-hint-eyebrow">見分けるメモ</p>
          <h2 class="obs-hint-title">${escapeHtml(subject.displayName)} は、まだ自動メモがありません</h2>
        </div>
        <span class="obs-hint-badge">様子見</span>
      </div>
      <p class="obs-hint-foot">この見つけたものは、同定する人を待っています。ほかの候補は下から確認できます。</p>
      ${careAdvice}
      </section>
    </details>`;
  }

  const band = aiAssessment.confidenceBand;
  const bandClass = band === "high" ? "is-high" : band === "medium" ? "is-medium" : band === "low" ? "is-low" : "is-tent";
  const bandLabel = confidenceLabel(band);
  const headline = friendlyObservationText(aiAssessment.simpleSummary || aiAssessment.narrative || "", 96);
  const rec = aiAssessment.recommendedTaxonName
    ? `<div class="obs-hint-rec"><span class="obs-hint-rec-name">${escapeHtml(aiAssessment.recommendedTaxonName)}</span>${aiAssessment.recommendedRank ? `<span class="obs-hint-rec-rank">${escapeHtml(publicRankHint(aiAssessment.recommendedRank) || "候補")}</span>` : ""}</div>`
    : "";
  const best = aiAssessment.bestSpecificTaxonName && aiAssessment.bestSpecificTaxonName !== aiAssessment.recommendedTaxonName
    ? `<p class="obs-hint-best">候補の中では <strong>${escapeHtml(aiAssessment.bestSpecificTaxonName)}</strong> が有力</p>`
    : "";
  const mediaCopy = observationMediaCopy(mediaContext);
  const clues = aiAssessment.diagnosticFeaturesSeen.length > 0
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">${escapeHtml(mediaCopy.clueHeading)}</div><ul class="obs-hint-tags">${aiAssessment.diagnosticFeaturesSeen.map((feature) => `<li>${escapeHtml(friendlyObservationText(feature, 48))}</li>`).join("")}</ul></div>`
    : "";
  const missingPhoto = aiAssessment.missingEvidence.length > 0
    ? `<div class="obs-hint-sub obs-hint-missing"><div class="obs-hint-eye">${escapeHtml(mediaCopy.missingHeading)} <span class="obs-hint-eye-note">自動メモ</span></div><ul class="obs-hint-tags is-muted">${aiAssessment.missingEvidence.map((item) => `<li>${escapeHtml(friendlyObservationText(item, 48))}</li>`).join("")}</ul></div>`
    : "";
  const stop = aiAssessment.stopReason
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">まだ決めない理由</div><p>${escapeHtml(friendlyObservationText(aiAssessment.stopReason, 110))}</p></div>`
    : "";
  const placeSeason = (aiAssessment.geographicContext || aiAssessment.seasonalContext)
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">場所と季節のヒント</div>${aiAssessment.geographicContext ? `<p>📍 ${escapeHtml(friendlyObservationText(aiAssessment.geographicContext, 90))}</p>` : ""}${aiAssessment.seasonalContext ? `<p>🗓 ${escapeHtml(friendlyObservationText(aiAssessment.seasonalContext, 90))}</p>` : ""}</div>`
    : "";
  const areaInference = renderAreaInferenceCard(aiAssessment.areaInference, siteBrief, mediaContext);
  const managementActions = renderManagementActionCandidateCard(
    aiAssessment.managementActionCandidates,
    subject.occurrenceId,
    basePath,
  );
  const shotSuggestions = renderShotSuggestionsCard(aiAssessment.shotSuggestions, photoAssets, mediaContext);
  const hasShotSuggestionsCard = (aiAssessment.shotSuggestions ?? []).length > 0;
  const boost = "";
  // 構造化された shotSuggestions カードがある時は、自由文 nextStep をたたみ重複を避ける
  const nextShotItems: string[] = [];
  if (aiAssessment.nextStepText) nextShotItems.push(aiAssessment.nextStepText);
  aiAssessment.confirmMore.forEach((tip) => { if (tip) nextShotItems.push(tip); });
  const nextStep = !hasShotSuggestionsCard && nextShotItems.length > 0
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">${escapeHtml(mediaCopy.nextEvidenceHeading)}</div>${nextShotItems.length === 1 ? `<p>${escapeHtml(friendlyObservationText(nextShotItems[0], 90))}</p>` : `<ul class="obs-hint-bul">${nextShotItems.map((tip) => `<li>${escapeHtml(friendlyObservationText(tip, 78))}</li>`).join("")}</ul>`}</div>`
    : "";
  const funFact = aiAssessment.funFact
    ? `<div class="obs-hint-fun"><div class="obs-hint-eye">ちょっとした豆知識</div><p>${escapeHtml(friendlyObservationText(aiAssessment.funFact, 120))}</p></div>`
    : "";
  const claimRefs = "";
  // similar: confirmMore は nextStep に統合済みなので、ここでは出さない
  const similar = aiAssessment.similarTaxa.length > 0 || aiAssessment.distinguishingTips.length > 0
    ? `<div class="obs-hint-similar">
         <div class="obs-hint-eye">まぎらわしい仲間 <span class="obs-hint-eye-note">自動メモ</span></div>
         ${aiAssessment.similarTaxa.length > 0 ? `<ul class="obs-hint-tags">${aiAssessment.similarTaxa.map((taxon) => `<li>${escapeHtml(taxon.name)}${taxon.rank ? ` <small>(${escapeHtml(publicRankHint(taxon.rank) || rankLabelJa(taxon.rank))})</small>` : ""}</li>`).join("")}</ul>` : ""}
         ${aiAssessment.distinguishingTips.length > 0 ? `<div class="obs-hint-inner"><div class="obs-hint-eye-small">見分け方のポイント</div><ul class="obs-hint-bul">${aiAssessment.distinguishingTips.map((tip) => `<li>${escapeHtml(friendlyObservationText(tip, 78))}</li>`).join("")}</ul></div>` : ""}
         <p class="obs-hint-reminder">※ 自動メモです。図鑑や詳しい人の確認も合わせて見てください。</p>
       </div>`
    : "";
  const runMeta = `<p class="obs-hint-foot">このメモは次の観察につなぐための参考情報です。名前の決定には入りません。</p>`;
  const threeLens = renderThreeLensCards(subject);
  const careAdvice = renderVegetationCareAdviceCard(subject, {
    ...fieldAdviceContext,
    basePath,
  });
  return `<details class="obs-fold obs-hint-fold">
    <summary>くわしい見分けメモ <span class="obs-fold-count">${escapeHtml(bandLabel)}</span></summary>
    <section class="obs-hint-section ${bandClass}">
    <div class="obs-hint-head">
      <div>
        <p class="obs-hint-eyebrow">見分けるメモ</p>
        <h2 class="obs-hint-title">${escapeHtml(headline || "見分けるヒント")}</h2>
      </div>
      <span class="obs-hint-badge">${escapeHtml(bandLabel)}</span>
    </div>
    ${threeLens}
    ${rec}${best}
    <div class="obs-hint-grid">${clues}${missingPhoto}${stop}${placeSeason}${boost}${nextStep}</div>
    ${claimRefs}
    ${careAdvice}
    ${managementActions}
    ${areaInference}
    ${shotSuggestions}
    ${funFact}
    ${similar}
    ${runMeta}
    </section>
  </details>`;
}

function renderCivicContextBlock(
  context: CivicObservationContext | null,
  snapshot: ObservationDetailSnapshot,
  basePath: string,
  lang: SiteLang,
): string {
  if (!context) return "";
  const evidenceItems = [
    snapshot.photoAssets.length > 0 ? `写真 ${snapshot.photoAssets.length}件` : "",
    snapshot.videoAssets.length > 0 ? `動画 ${snapshot.videoAssets.length}件` : "",
    snapshot.note ? "メモあり" : "",
    context.revisitOfVisitId ? "再記録" : "",
    context.fieldId ? "区画あり" : "",
    context.routeId ? "ルートあり" : "",
    context.plotId ? "プロットあり" : "",
  ].filter(Boolean);
  const precisionLabel: Record<CivicObservationContext["publicPrecision"], string> = {
    exact_private: "正確な位置は非公開",
    site: "場所単位で公開",
    mesh: "メッシュ単位で公開",
    municipality: "市区町村単位で公開",
    hidden: "位置は公開しない",
  };
  const riskLabel = context.riskLane === "normal" ? "通常記録" : "確認対象";
  const revisitHref = appendLangToHref(
    withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(snapshot.visitId)}`),
    lang,
  );
  return `<div class="obs-story-block obs-story-civic">
    <div class="obs-story-eyebrow">地域自然の文脈</div>
    <p><strong>${escapeHtml(civicContextLabel(context))}</strong></p>
    <p>${escapeHtml([riskLabel, precisionLabel[context.publicPrecision], context.activityIntent ? `目的: ${context.activityIntent}` : ""].filter(Boolean).join(" · "))}</p>
    ${evidenceItems.length > 0 ? `<p>${escapeHtml(`証拠: ${evidenceItems.join("・")}`)}</p>` : ""}
    <p><a href="${escapeHtml(revisitHref)}">この場所で再記録</a></p>
  </div>`;
}

function isMeaningfulRegionalSource(card: RegionalKnowledgeCard): boolean {
  const url = (card.sourceUrl || "").trim();
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/") return false;
  const lastSeg = path.split("/").filter(Boolean).pop() ?? "";
  if (/^(top|index|home|default)(\.[a-z]+)?$/i.test(lastSeg)) return false;
  const segs = path.split("/").filter(Boolean);
  if (segs.length < 2) return false;
  return true;
}

const REGIONAL_CATEGORY_ICON: Record<string, string> = {
  history: "📜",
  cultural_asset: "🏛️",
  landform: "⛰️",
  water: "💧",
  agriculture: "🌾",
  industry: "🏭",
  disaster_memory: "⚠️",
  ecology: "🌿",
  policy: "📋",
  local_life: "🏘️",
};

function softenActionCueText(value: string, maxLength = 90): string {
  const text = friendlyObservationText(value, maxLength).trim();
  return text
    .replace(/^次(?:は|に)(?:見るなら|撮るなら|足すなら|できることは)?(?:、|\s)*/u, "")
    .replace(/^もう一度(?:見に行く|見る)(?:なら|と)?(?:、|\s)*/u, "")
    .replace(/^まず(?:は|、|\s)*/u, "")
    .replace(/^機会があれば(?:、|\s)*/u, "")
    .replace(/^(?:ぜひ|必ず)(?:、|\s)*/u, "")
    .trim();
}

function renderRegionalStoryPanel(story: RegionalStoryCue | null | undefined, variant: "observation" | "profile" | "compact" = "observation"): string {
  if (!story) return "";
  const rawCards = story.cards.slice(0, variant === "observation" ? 2 : 1);
  // Dedupe by sourceUrl + 一般ポータルURLを除外（top/index/単一セグメント）
  const seenUrls = new Set<string>();
  const meaningfulCards = rawCards.filter((card) => {
    if (!card.sourceUrl || seenUrls.has(card.sourceUrl)) return false;
    if (!isMeaningfulRegionalSource(card)) return false;
    seenUrls.add(card.sourceUrl);
    return true;
  });
  const literatureBlock = meaningfulCards.length > 0
    ? `<div class="regional-story-cards" aria-label="参照した地域資料">
        <div class="regional-story-cards-eye">地域資料</div>
        ${meaningfulCards.map((card) => {
          const icon = REGIONAL_CATEGORY_ICON[card.category] ?? "📚";
          return `<a class="regional-story-card" href="${escapeHtml(card.sourceUrl)}" target="_blank" rel="noreferrer noopener">
            <span class="regional-story-card-icon" aria-hidden="true">${icon}</span>
            <span class="regional-story-card-body">
              <span class="regional-story-card-title">${escapeHtml(card.title)}</span>
              <span class="regional-story-card-summary">${escapeHtml(card.summary)}</span>
              <span class="regional-story-card-source">${escapeHtml(card.sourceLabel)} ↗</span>
            </span>
          </a>`;
        }).join("")}
      </div>`
    : "";
  const nextAngle = story.nextObservationAngle?.trim();
  const nextAngleBlock = nextAngle
    ? `<div class="regional-story-next">
        <small>見返すなら</small>
        <strong>${escapeHtml(softenActionCueText(nextAngle, 92))}</strong>
      </div>`
    : "";
  const collective = story.collectiveNote?.trim();
  const collectiveBlock = collective
    ? `<div class="regional-story-collective">
        <small>比べられること</small>
        <strong>${escapeHtml(softenActionCueText(collective, 96))}</strong>
      </div>`
    : "";
  const className = `regional-story regional-story--${variant}`;
  const badge = story.sourceMode === "fallback"
    ? story.angleLabel
    : `${story.angleLabel}・地域資料あり`;
  if (variant === "observation") {
    return `<section class="${className}" data-testid="regional-story">
      <details class="regional-story-details">
        <summary class="regional-story-head">
          <div>
            <span class="regional-story-eyebrow">場所の手がかり</span>
            <strong class="regional-story-summary-title">${escapeHtml(story.placeHook)}</strong>
          </div>
          <span>${escapeHtml(story.sourceMode === "fallback" ? story.angleLabel : "地域資料あり")}</span>
        </summary>
        <p class="regional-story-lead">${escapeHtml(softenActionCueText(story.whyHere, 118))}</p>
        <div class="regional-story-grid">${nextAngleBlock}${collectiveBlock}</div>
        ${literatureBlock}
      </details>
    </section>`;
  }
  return `<section class="${className}" data-testid="regional-story">
    <div class="regional-story-head">
      <div>
        <div class="regional-story-eyebrow">この場所を見返すヒント</div>
        <h2>${escapeHtml(story.placeHook)}</h2>
      </div>
      <span>${escapeHtml(badge)}</span>
    </div>
    <p class="regional-story-lead">${escapeHtml(story.whyHere)}</p>
    <div class="regional-story-grid">${nextAngleBlock}${collectiveBlock}</div>
    ${literatureBlock}
  </section>`;
}

const AREA_INFERENCE_LABELS: Array<{
  key: keyof import("../services/observationAiAssessment.js").AreaInference;
  label: string;
  icon: string;
}> = [
  { key: "vegetationStructureCandidates", label: "草や木の様子", icon: "🌳" },
  { key: "successionStageCandidates", label: "育ち方", icon: "🌱" },
  { key: "humanInfluenceCandidates", label: "人の手が入った跡", icon: "🏘️" },
  { key: "moistureRegimeCandidates", label: "湿り気", icon: "💧" },
  { key: "managementHintCandidates", label: "手入れの跡", icon: "🪚" },
];

const MANAGEMENT_ACTION_LABELS: Record<string, string> = {
  mowing: "草刈り",
  water_management: "水まわり",
  pruning: "剪定",
  planting: "植栽",
  harvesting: "収穫",
  tilling: "耕起",
  cleanup: "清掃",
  trampling: "踏み跡",
  invasive_removal: "外来種除去",
  bare_ground: "裸地化",
  unknown: "管理の手がかり",
};

function managementSourceLabel(source: ManagementActionCandidate["source"]): string {
  switch (source) {
    case "video_frame": return "動画フレーム";
    case "revisit_comparison": return "前回比較";
    case "satellite_context": return "環境データ";
    default: return "写真";
  }
}

function renderManagementActionCandidateCard(
  candidates: ManagementActionCandidate[] | null | undefined,
  occurrenceId: string,
  basePath: string,
): string {
  const visible = (candidates ?? [])
    .map((candidate, index) => ({ candidate, index }))
    .filter((item) => item.candidate.confirmState !== "rejected");
  if (visible.length === 0) return "";
  const endpointBase = withBasePath(
    basePath,
    `/api/v1/observations/${encodeURIComponent(occurrenceId)}/management-candidates`,
  );
  const rows = visible.map(({ candidate, index }) => {
    const band = candidate.confidence == null
      ? "unknown"
      : candidate.confidence >= 0.7
        ? "high"
        : candidate.confidence >= 0.45
          ? "medium"
          : "low";
    const stateLabel = candidate.confirmState === "confirmed" ? "確認済み" : "自動推定";
    const label = candidate.label || `${MANAGEMENT_ACTION_LABELS[candidate.actionKind] ?? "管理行為"}の可能性`;
    return `<article class="obs-management-item is-${escapeHtml(band)}" data-management-candidate data-confirm-state="${escapeHtml(candidate.confirmState)}">
      <div class="obs-management-main">
        <span class="obs-management-kind">${escapeHtml(MANAGEMENT_ACTION_LABELS[candidate.actionKind] ?? candidate.actionKind)}</span>
        <strong>${escapeHtml(label)}</strong>
        ${candidate.why ? `<p>${escapeHtml(friendlyObservationText(candidate.why, 90))}</p>` : ""}
        <div class="obs-management-meta">
          <span>${escapeHtml(managementSourceLabel(candidate.source))}</span>
          ${candidate.confidence != null ? `<span>可能性 ${Math.round(candidate.confidence * 100)}%</span>` : ""}
          <span data-management-state>${escapeHtml(stateLabel)}</span>
        </div>
      </div>
      <div class="obs-management-actions" data-management-endpoint="${escapeHtml(`${endpointBase}/${index}/confirm`)}">
        <button type="button" class="btn btn-solid" data-management-action="confirmed">合ってる</button>
        <button type="button" class="btn secondary" data-management-action="rejected">違う</button>
        <button type="button" class="btn secondary" data-management-action="suggested">あとで</button>
      </div>
    </article>`;
  }).join("");
  return `<section class="obs-management-card" aria-label="写真から読めそうな場所の変化">
    <div class="obs-management-head">
      <div>
        <div class="obs-hint-eyebrow">写真から読めそうな場所の変化</div>
        <p class="obs-hint-reminder">写真や動画から見える手入れの候補です。断定ではありません。あとで人が確認できます。</p>
      </div>
      <span class="obs-hint-badge obs-hint-badge-candidate">自動推定</span>
    </div>
    <div class="obs-management-list">${rows}</div>
    ${renderManagementCandidateScript()}
  </section>`;
}

function renderManagementCandidateScript(): string {
  return `<script>(function(){
    if (window.__ikimonManagementCandidateBound) return;
    window.__ikimonManagementCandidateBound = true;
    document.addEventListener('click', async function(event){
      const button = event.target && event.target.closest ? event.target.closest('[data-management-action]') : null;
      if (!button) return;
      const actions = button.closest('[data-management-endpoint]');
      const item = button.closest('[data-management-candidate]');
      if (!actions || !item) return;
      const state = button.getAttribute('data-management-action');
      const stateEl = item.querySelector('[data-management-state]');
      if (state === 'suggested') {
        if (stateEl) stateEl.textContent = 'あとで確認';
        item.dataset.confirmState = 'suggested';
        return;
      }
      button.disabled = true;
      try {
        const response = await fetch(actions.getAttribute('data-management-endpoint'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ confirmState: state }),
        });
        const payload = await response.json().catch(function(){ return {}; });
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'confirm_failed');
        item.dataset.confirmState = state;
        if (stateEl) stateEl.textContent = state === 'confirmed' ? '確認済み' : '違うとして除外';
        if (state === 'rejected') item.style.display = 'none';
      } catch (err) {
        if (stateEl) stateEl.textContent = '保存できませんでした';
      } finally {
        button.disabled = false;
      }
    });
  })();</script>`;
}

function siteBriefAgreement(siteBrief: SiteBrief | null, candidates: { label: string }[]): "match" | "near" | "divergent" | "none" {
  if (!siteBrief || candidates.length === 0) return "none";
  const brief = siteBrief.hypothesis.label.toLowerCase();
  for (const cand of candidates) {
    const label = cand.label.toLowerCase();
    if (brief.includes(label) || label.includes(brief)) return "match";
  }
  // 近縁: どちらも 森/林 / 草/草地 / 水/湿 / 田/畑 の同群なら near
  const groups: Array<[string, string[]]> = [
    ["forest", ["森", "林", "樹", "木", "森林"]],
    ["grass", ["草", "草地", "草原", "草本"]],
    ["wet", ["水", "湿", "湿地", "湿原", "沼", "池"]],
    ["crop", ["畑", "農", "田", "耕", "作地"]],
    ["urban", ["市街", "住宅", "公園", "道路", "人為"]],
  ];
  const groupOf = (s: string): string | null => {
    for (const [g, ks] of groups) if (ks.some((k) => s.includes(k))) return g;
    return null;
  };
  const briefGroup = groupOf(brief);
  if (briefGroup) {
    for (const cand of candidates) {
      if (groupOf(cand.label.toLowerCase()) === briefGroup) return "near";
    }
  }
  return "divergent";
}

function renderAreaInferenceCard(
  areaInference: import("../services/observationAiAssessment.js").AreaInference | null | undefined,
  siteBrief: SiteBrief | null = null,
  mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext(),
): string {
  if (!areaInference) return "";
  const hasAny = AREA_INFERENCE_LABELS.some(({ key }) => (areaInference[key] ?? []).length > 0);
  const hasSiteBrief = Boolean(siteBrief && siteBrief.hypothesis.label);
  if (!hasAny && !hasSiteBrief) return "";
  const confLabel = (confidence: number | null): string => {
    if (confidence === null) return "";
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "medium";
    return "low";
  };
  // siteBrief を「地点情報(決定論)」として植生構造カードにバッジ表示
  const vegCands = areaInference.vegetationStructureCandidates ?? [];
  const briefAgreement = siteBriefAgreement(siteBrief, vegCands);
  const briefBanner = hasSiteBrief
    ? (() => {
        const icon =
          briefAgreement === "match" ? "✓" :
          briefAgreement === "near" ? "≈" :
          briefAgreement === "divergent" ? "⚡" : "📍";
        const tone =
          briefAgreement === "match" ? "is-match" :
          briefAgreement === "near" ? "is-near" :
          briefAgreement === "divergent" ? "is-divergent" : "is-info";
        const label =
          briefAgreement === "match" ? "画像推察と一致" :
          briefAgreement === "near" ? "画像推察と近い" :
          briefAgreement === "divergent" ? "画像からは違う候補も" : "参考";
        return `<div class="obs-area-brief ${tone}">
          <span class="obs-area-brief-icon">${icon}</span>
          <div class="obs-area-brief-body">
            <div class="obs-area-brief-eye">地図から見た場所 <span class="obs-hint-eye-note">参考</span></div>
            <div class="obs-area-brief-label">${escapeHtml(siteBrief!.hypothesis.label)}</div>
          </div>
          <span class="obs-area-brief-status">${escapeHtml(label)}</span>
        </div>`;
      })()
    : "";
  const groups = AREA_INFERENCE_LABELS
    .map(({ key, label, icon }) => {
      const candidates = areaInference[key] ?? [];
      if (candidates.length === 0) return "";
      return `<div class="obs-area-group">
        <div class="obs-area-eye">${icon} ${escapeHtml(label)}</div>
        <ul class="obs-area-list">
          ${candidates.map((cand) => {
            const band = confLabel(cand.confidence);
            return `<li class="obs-area-item${band ? ` is-${band}` : ""}">
              <span class="obs-area-label">${escapeHtml(friendlyObservationText(cand.label, 42))}</span>
              ${cand.why ? `<span class="obs-area-why">${escapeHtml(friendlyObservationText(cand.why, 70))}</span>` : ""}
              ${band ? `<span class="obs-area-conf obs-area-conf-${band}">${band === "high" ? "可能性高" : band === "medium" ? "可能性中" : "可能性低"}</span>` : ""}
            </li>`;
          }).join("")}
        </ul>
      </div>`;
    })
    .filter(Boolean)
    .join("");
  const mediaCopy = observationMediaCopy(mediaContext);
  return `<details class="obs-area-card" aria-label="${escapeHtml(mediaCopy.areaLabel)}">
    <summary class="obs-area-head" style="cursor:pointer;list-style:none">
      <div>
        <div class="obs-hint-eyebrow">${escapeHtml(mediaCopy.areaLabel)} <span class="obs-hint-eye-note">タップで展開</span></div>
        <p class="obs-hint-reminder">${escapeHtml(mediaCopy.areaReminder)}</p>
      </div>
      <span class="obs-hint-badge obs-hint-badge-candidate">参考</span>
    </summary>
    ${briefBanner}
    ${hasAny ? `<div class="obs-area-groups">${groups}</div>` : ""}
  </details>`;
}

const SHOT_ROLE_META: Record<string, { icon: string; label: string }> = {
  full_body: { icon: "🖼", label: "全景 / 全身" },
  close_up_organ: { icon: "🔍", label: "部位クローズアップ" },
  habitat_wide: { icon: "🌄", label: "生息環境の広角" },
  substrate: { icon: "🪨", label: "基質 / 止まっている物" },
  scale_reference: { icon: "📏", label: "スケール参照" },
};

const SHOT_ROLE_ORDER: Array<{ key: string; label: string; icon: string }> = [
  { key: "full_body", label: "全景/全身", icon: "🖼" },
  { key: "close_up_organ", label: "部位アップ", icon: "🔍" },
  { key: "habitat_wide", label: "生息環境", icon: "🌄" },
  { key: "substrate", label: "基質", icon: "🪨" },
  { key: "scale_reference", label: "スケール", icon: "📏" },
];

function renderRoleCoverageStrip(photoAssets: { roleTag: string | null }[] | null | undefined): string {
  if (!photoAssets || photoAssets.length === 0) return "";
  const covered = new Set<string>();
  for (const p of photoAssets) if (p.roleTag && p.roleTag !== "unknown") covered.add(p.roleTag);
  const chips = SHOT_ROLE_ORDER.map(({ key, label, icon }) => {
    const hit = covered.has(key);
    return `<span class="obs-role-chip${hit ? " is-covered" : ""}" title="${escapeHtml(label)}">${icon} ${escapeHtml(label)}${hit ? " ✓" : ""}</span>`;
  }).join("");
  const hitCount = covered.size;
  const threshold = 3;
  const pct = Math.min(100, Math.round((hitCount / SHOT_ROLE_ORDER.length) * 100));
  const pastThreshold = hitCount >= threshold;
  return `<div class="obs-role-cov">
    <div class="obs-role-cov-head">
      <div class="obs-role-cov-eye">組写真カバレッジ</div>
      <div class="obs-role-cov-count ${pastThreshold ? "is-met" : ""}">${hitCount} / ${SHOT_ROLE_ORDER.length} role${pastThreshold ? " · Tier 1.5 条件OK" : ""}</div>
    </div>
    <div class="obs-role-cov-bar"><span style="width:${pct}%"></span></div>
    <div class="obs-role-cov-chips">${chips}</div>
    </div>`;
}

function renderObservationPhotoRecoveryPanel(options: {
  basePath: string;
  visitId: string;
  isOwner: boolean;
  existingPhotoCount: number;
  mediaContext?: ObservationMediaCopyContext;
}): string {
  if (!options.isOwner) return "";
  const hasPhotos = options.existingPhotoCount > 0;
  const mediaCopy = observationMediaCopy(options.mediaContext ?? {
    hasPhotos,
    hasVideos: false,
  });
  const recoveryCopy = hasPhotos
    ? {
        eyebrow: "写真追加",
        title: "この記録に写真を追加",
        body: "別角度や周辺の写真を、同じ記録に追加できます。",
      }
    : {
        eyebrow: mediaCopy.photoRecoveryEyebrow,
        title: mediaCopy.photoRecoveryTitle,
        body: mediaCopy.photoRecoveryBody,
      };
  const endpoint = withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.visitId)}/photos/upload`);
  return `<section class="section obs-owner-tool obs-photo-recovery" data-photo-recovery data-upload-endpoint="${escapeHtml(endpoint)}" data-existing-photo-count="${escapeHtml(String(options.existingPhotoCount))}" title="${escapeHtml(recoveryCopy.body)}">
    <form class="obs-photo-recovery-form" aria-label="${escapeHtml(recoveryCopy.title)}">
      <span class="obs-owner-tool-label">${escapeHtml(recoveryCopy.eyebrow)}</span>
      <label class="obs-photo-recovery-picker">
        <span>選択</span>
        <input type="file" accept="image/*" multiple />
      </label>
      <button type="submit" class="obs-photo-recovery-submit">保存</button>
      <span class="obs-photo-recovery-status" data-photo-recovery-status aria-live="polite"></span>
    </form>
  </section>`;
}

function renderObservationPhotoRecoveryScript(isOwner: boolean): string {
  if (!isOwner) return "";
  return `<script>(function(){
    var root = document.querySelector('[data-photo-recovery]');
    if (!root) return;
    var form = root.querySelector('.obs-photo-recovery-form');
    var input = root.querySelector('input[type="file"]');
    var button = root.querySelector('.obs-photo-recovery-submit');
    var status = root.querySelector('[data-photo-recovery-status]');
    var endpoint = root.getAttribute('data-upload-endpoint') || '';
    var existingPhotoCount = Number(root.getAttribute('data-existing-photo-count') || '0');
    var PHOTO_RECOVERY_MAX_EDGE = 2560;
    var PHOTO_RECOVERY_JPEG_QUALITY = 0.88;
    var PHOTO_RECOVERY_CONCURRENCY = 2;
    var setStatus = function(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    };
    var readFileAsDataUrl = function(file) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(){ resolve(String(reader.result || '')); };
        reader.onerror = function(){ reject(new Error('file_read_failed')); };
        reader.readAsDataURL(file);
      });
    };
    var mapWithConcurrency = function(items, limit, worker) {
      var results = new Array(items.length);
      var nextIndex = 0;
      var workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
      var runners = Array.from({ length: workerCount }).map(function() {
        return Promise.resolve().then(function runNext() {
          if (nextIndex >= items.length) return undefined;
          var index = nextIndex;
          nextIndex += 1;
          return Promise.resolve(worker(items[index], index)).then(function(result) {
            results[index] = result;
            return runNext();
          });
        });
      });
      return Promise.all(runners).then(function(){ return results; });
    };
    var loadImageElementForUpload = function(file) {
      return new Promise(function(resolve, reject) {
        var url = URL.createObjectURL(file);
        var image = new Image();
        image.onload = function() {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = function() {
          URL.revokeObjectURL(url);
          reject(new Error('photo_decode_failed'));
        };
        image.src = url;
      });
    };
    var loadImageForUpload = function(file) {
      var createBitmap = typeof window.createImageBitmap === 'function'
        ? window.createImageBitmap.bind(window)
        : (typeof createImageBitmap === 'function' ? createImageBitmap : null);
      if (!createBitmap) return loadImageElementForUpload(file);
      return createBitmap(file, { imageOrientation: 'from-image' }).catch(function(){
        return createBitmap(file).catch(function(){ return loadImageElementForUpload(file); });
      });
    };
    var canvasToJpegDataUrl = function(canvas, quality) {
      return new Promise(function(resolve) {
        if (!canvas || typeof canvas.toBlob !== 'function') {
          resolve(canvas.toDataURL('image/jpeg', quality));
          return;
        }
        canvas.toBlob(function(blob) {
          if (!blob) {
            resolve(canvas.toDataURL('image/jpeg', quality));
            return;
          }
          readFileAsDataUrl(blob).then(resolve).catch(function(){ resolve(canvas.toDataURL('image/jpeg', quality)); });
        }, 'image/jpeg', quality);
      });
    };
    var preparePhotoUpload = function(file) {
      return loadImageForUpload(file).then(function(image) {
        var width = Number(image.naturalWidth || image.width || 0);
        var height = Number(image.naturalHeight || image.height || 0);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
        var scale = Math.min(1, PHOTO_RECOVERY_MAX_EDGE / Math.max(width, height));
        var targetWidth = Math.max(1, Math.round(width * scale));
        var targetHeight = Math.max(1, Math.round(height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        var context = canvas.getContext('2d');
        if (!context) throw new Error('photo_canvas_unavailable');
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        if (image && typeof image.close === 'function') image.close();
        return canvasToJpegDataUrl(canvas, PHOTO_RECOVERY_JPEG_QUALITY).then(function(base64Data) {
          var safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
          return {
            filename: safeName + '.jpg',
            mimeType: 'image/jpeg',
            base64Data: base64Data
          };
        });
      }).catch(function() {
        return readFileAsDataUrl(file).then(function(base64Data) {
          return {
            filename: file.name || 'upload.jpg',
            mimeType: file.type || 'image/jpeg',
            base64Data: base64Data
          };
        });
      });
    };
    if (!form || !input || !button || !endpoint) return;
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      var files = Array.prototype.slice.call(input.files || []).filter(function(file){
        return file && file.type && file.type.indexOf('image/') === 0;
      });
      if (!files.length) {
        setStatus('写真を選んでください。', true);
        return;
      }
      button.disabled = true;
      var uploaded = 0;
      var failed = [];
      var prepared = 0;
      setStatus('写真を圧縮しています 0/' + String(files.length), false);
      mapWithConcurrency(files, PHOTO_RECOVERY_CONCURRENCY, function(file, index) {
        return preparePhotoUpload(file).then(function(upload) {
          prepared += 1;
          setStatus('写真を圧縮しています ' + String(prepared) + '/' + String(files.length), false);
          return { upload: upload, index: index };
        });
      }).then(function(items) {
        var completed = 0;
        setStatus('保存中 0/' + String(items.length), false);
        return mapWithConcurrency(items, PHOTO_RECOVERY_CONCURRENCY, function(item) {
          return fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              filename: item.upload.filename,
              mimeType: item.upload.mimeType,
              base64Data: item.upload.base64Data,
              mediaRole: existingPhotoCount === 0 && item.index === 0 ? 'primary_subject' : 'context'
            })
          }).then(function(response) {
            return response.json().catch(function(){ return {}; }).then(function(json) {
              completed += 1;
              setStatus('保存中 ' + String(completed) + '/' + String(items.length), false);
              if (!response.ok || !json || json.ok === false) {
                failed.push(String((json && json.error) || response.status || 'upload_failed'));
                return;
              }
              uploaded += 1;
            });
          }).catch(function(error) {
            completed += 1;
            setStatus('保存中 ' + String(completed) + '/' + String(items.length), true);
            failed.push(String(error && error.message || 'network'));
          });
        });
      }).then(function() {
        if (uploaded > 0 && failed.length === 0) {
          setStatus('保存しました。表示を更新します。', false);
          setTimeout(function(){ window.location.reload(); }, 700);
          return;
        }
        if (uploaded > 0) {
          setStatus(String(uploaded) + '枚を保存しました。失敗: ' + failed[0], true);
          setTimeout(function(){ window.location.reload(); }, 1100);
          return;
        }
        setStatus('保存できませんでした: ' + (failed[0] || 'unknown_error'), true);
        button.disabled = false;
      }).catch(function(error) {
        setStatus('通信エラー: ' + String(error && error.message || 'network'), true);
        button.disabled = false;
      });
    });
  })();</script>`;
}

function renderObservationOwnerDeletePanel(options: {
  basePath: string;
  visitId: string;
  isOwner: boolean;
  lang: SiteLang;
}): string {
  if (!options.isOwner) return "";
  const endpoint = withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.visitId)}/hide`);
  const notesHref = appendLangToHref(withBasePath(options.basePath, "/records?view=mine"), options.lang);
  return `<section class="section obs-owner-tool obs-owner-delete" data-owner-delete data-delete-endpoint="${escapeHtml(endpoint)}" data-after-delete-href="${escapeHtml(notesHref)}" title="一覧と公開ページから外します。写真ファイルは監査用に残します。">
    <span class="obs-owner-tool-label">削除</span>
    <button type="button" class="obs-owner-delete-button" data-owner-delete-button>削除</button>
    <span class="obs-owner-delete-status" data-owner-delete-status aria-live="polite"></span>
  </section>`;
}

function renderObservationOwnerDeleteScript(isOwner: boolean): string {
  if (!isOwner) return "";
  return `<script>(function(){
    var root = document.querySelector('[data-owner-delete]');
    if (!root) return;
    var button = root.querySelector('[data-owner-delete-button]');
    var status = root.querySelector('[data-owner-delete-status]');
    var endpoint = root.getAttribute('data-delete-endpoint') || '';
    var nextHref = root.getAttribute('data-after-delete-href') || '/records?view=mine';
    var setStatus = function(message, isError) {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-error', Boolean(isError));
    };
    if (!button || !endpoint) return;
    button.addEventListener('click', function() {
      if (!window.confirm('この記録を一覧と公開ページから削除します。よろしいですか？')) return;
      button.disabled = true;
      setStatus('削除中...', false);
      fetch(endpoint, {
        method: 'POST',
        headers: { accept: 'application/json' },
        credentials: 'same-origin'
      }).then(function(response) {
        return response.json().catch(function(){ return {}; }).then(function(json) {
          if (!response.ok || !json || json.ok === false) {
            throw new Error(String((json && json.error) || response.status || 'delete_failed'));
          }
          setStatus('削除しました。記録ライブラリへ戻ります。', false);
          setTimeout(function(){ window.location.href = nextHref; }, 700);
        });
      }).catch(function(error) {
        setStatus('削除できませんでした: ' + String(error && error.message || 'network'), true);
        button.disabled = false;
      });
    });
  })();</script>`;
}

const START_STATE_STYLES = `
  .record-confidence-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 18px; }
  .record-confidence-item { flex: 1 1 112px; min-height: 58px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); }
  .record-confidence-item strong { display: block; color: #0f172a; font-size: 13px; line-height: 1.35; }
  .record-confidence-item span { display: block; margin-top: 3px; color: #475569; font-size: 11px; line-height: 1.5; font-weight: 750; }
  .start-guide { display: grid; gap: 20px; }
  .start-guide-panel { max-width: 760px; margin: 0 auto; padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.92)); border: 1px solid rgba(16,185,129,.18); }
  .start-guide-panel h2 { margin: 8px 0; color: #0f172a; }
  .start-guide-panel p { margin: 0; color: #475569; line-height: 1.8; }
  .start-guide-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .start-guide-actions .btn-solid { min-width: 210px; }
  .record-capture-dock { display: none; }
  .record-dock-action { min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 7px 6px; border-radius: 17px; border: 1px solid transparent; background: rgba(248,250,252,.9); color: #0f172a; text-decoration: none; font-size: 11px; font-weight: 900; line-height: 1.2; }
  .record-dock-primary { background: #ecfdf5; color: #065f46; }
  .record-dock-icon { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.06); flex: 0 0 auto; }
  .record-dock-primary .record-dock-icon { background: rgba(16,185,129,.14); }
  .record-dock-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .site-mobile-menu-panel { max-height: calc(100dvh - 184px); overflow-y: auto; overscroll-behavior: contain; }
  @media (max-width: 720px) {
    .start-guide { padding-bottom: 104px; }
    .site-footer { padding-bottom: 104px; }
    .record-capture-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 40; padding: 8px; border-radius: 24px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 20px 44px rgba(15,23,42,.2); display: grid; grid-template-columns: 1.2fr repeat(3, minmax(0, .82fr)); gap: 8px; }
    .has-global-record-launcher .record-capture-dock { display: none; }
  }
`;

type RecordConfidenceItem = {
  title: string;
  body: string;
};

type RecordStartCopy = {
  title: string;
  activeNav: string;
  footerNote: string;
  heroEyebrow: string;
  heroHeading: string;
  heroLead: string;
  photoAction: string;
  registerAction: string;
  panelEyebrow: string;
  panelHeading: string;
  panelBody: string;
  noteAction: string;
  learnAction: string;
  dockAria: string;
  dockPhoto: string;
  dockNote: string;
  dockVideo: string;
  dockGallery: string;
  confidenceAria: string;
  confidenceItems: RecordConfidenceItem[];
};

type RecordPageCopy = {
  title: string;
  activeNav: string;
  footerNote: string;
  heading: string;
  lead: string;
  sessionLabel: string;
  captureAria: string;
  photoTitle: string;
  photoSub: string;
  noteTitle: string;
  noteSub: string;
  videoTitle: string;
  videoSub: string;
  galleryTitle: string;
  gallerySub: string;
  guideLink: string;
  learnLink: string;
  dockAria: string;
  dockPhoto: string;
  dockNote: string;
  dockVideo: string;
  dockGallery: string;
  captureResultLabel: string;
  captureResultTitle: string;
  captureResultHelp: string;
  captureChange: string;
  locationTitle: string;
  locationBody: string;
  locationAction: string;
  submittingLabel: string;
  modeEntryLabel: string;
  modeQuickLabel: string;
  modeSurveyLabel: string;
  modeQuickLead: string;
  modeSurveyLead: string;
  confidenceAria: string;
  confidenceItems: RecordConfidenceItem[];
  captureLabels: Record<"note" | "photo" | "video" | "gallery", { title: string; help: string }>;
};

type RecordFormCopy = {
  preSubmitLabel: string;
  submitPanelTitle: string;
  submitPanelHelpMedia: string;
  submitPanelHelpNote: string;
  submitPanelHelpEmpty: string;
  submitButton: string;
  observedAtLabel: string;
  placeLabel: string;
  locationUnknown: string;
  locationHelp: string;
  currentLocation: string;
  locationSearchPlaceholder: string;
  locationSearchButton: string;
  locationMapAria: string;
  locationMapFallback: string;
  coordinateSummary: string;
  latitudeLabel: string;
  longitudeLabel: string;
  coordinatePlaceholder: string;
  laterSummary: string;
  localityNoteLabel: string;
  localityNotePlaceholder: string;
  mediaRoleLabel: string;
  mediaRolePrimaryTitle: string;
  mediaRolePrimaryBody: string;
  mediaRoleContextTitle: string;
  mediaRoleContextBody: string;
  mediaRoleSoundTitle: string;
  mediaRoleSoundBody: string;
  mediaRoleSecondaryTitle: string;
  mediaRoleSecondaryBody: string;
  vernacularNameLabel: string;
  vernacularNamePlaceholder: string;
  scientificNameLabel: string;
  scientificNamePlaceholder: string;
  municipalityLabel: string;
  municipalityPlaceholder: string;
  rankLabel: string;
  recordModeLabel: string;
  quickModeTitle: string;
  quickModeBody: string;
  surveyModeTitle: string;
  surveyModeBody: string;
  tipsLink: string;
  submitDockAria: string;
  submitDockLocation: string;
  submitDockMeta: string;
  submitDockSave: string;
  locationSelected: string;
  mediaNoteOnly: string;
  mediaLocationMissing: string;
  recordRoleTitle: string;
  recordRoleHelp: string;
  recordRolePill: string;
  activityIntentLabel: string;
  activityIntentOptions: Record<"discover" | "revisit" | "compare" | "learn" | "manage" | "confirm" | "share", string>;
  participantRoleLabel: string;
  participantRoleOptions: Record<"finder" | "photographer" | "context_recorder" | "note_taker" | "student" | "teacher" | "manager" | "participant", string>;
  quickReviewTitle: string;
  quickReviewHelp: string;
  quickReviewPill: string;
  quickCaptureStateLabel: string;
  quickCaptureStateOptions: Record<"present" | "unknown" | "no_detection_note", string>;
  nextLookForLabel: string;
  nextLookForPlaceholder: string;
  surveyBlockTitle: string;
  surveyBlockHelp: string;
  surveyBlockPill: string;
  checklistCompletionLabel: string;
  checklistCompletionOptions: Record<"complete" | "partial", string>;
  targetTaxaScopeLabel: string;
  targetTaxaScopePlaceholder: string;
  effortMinutesLabel: string;
  surveyResultLabel: string;
  surveyResultOptions: Record<"detected" | "no_detection_note", string>;
  revisitReasonLabel: string;
  revisitReasonPlaceholder: string;
  fieldScanTitle: string;
  fieldScanHelp: string;
  fieldScanPill: string;
  fieldScanTypeLabel: string;
  fieldScanModeOptions: Record<"none" | "site_snapshot" | "fixed_point" | "route" | "area_footprint" | "calibration_evidence", string>;
  fixedPointIdLabel: string;
  fixedPointIdPlaceholder: string;
  routeIdLabel: string;
  routeIdPlaceholder: string;
  areaIdLabel: string;
  areaIdPlaceholder: string;
  waterTitle: string;
  waterHelp: string;
  waterPill: string;
  catchOutcomeLabel: string;
  catchOutcomeOptions: Record<"none" | "caught" | "released" | "kept" | "lost" | "no_catch" | "observed_only", string>;
  captureMethodLabel: string;
  captureMethodPlaceholder: string;
  participantCountLabel: string;
  publicWaterbodyLabel: string;
  publicWaterbodyPlaceholder: string;
  releasedCountLabel: string;
  keptCountLabel: string;
};

function recordStartCopy(lang: SiteLang): RecordStartCopy {
  const localized: Record<SiteLang, RecordStartCopy> = {
    ja: {
      title: "記録する準備 | ikimon",
      activeNav: "記録",
      footerNote: "詳しい使い方は読み物ページで確認できます。",
      heroEyebrow: "記録",
      heroHeading: "写真で記録する",
      heroLead: "記録は、写真・動画・音声・場所・時刻・メモをまとめて残したものです。1件の記録から、あとで複数の対象ごとの記録を作れます。",
      photoAction: "ログインして写真で記録する",
      registerAction: "新しく登録して記録する",
      panelEyebrow: "sign in required",
      panelHeading: "記録画面はログイン後に開きます。",
      panelBody: "写真・動画・音声・場所・時刻・メモを自分の記録ライブラリに保存するため、記録前にログインします。",
      noteAction: "メモで始める",
      learnAction: "使い方を読む",
      dockAria: "ログインして記録する",
      dockPhoto: "写真",
      dockNote: "メモ",
      dockVideo: "動画",
      dockGallery: "選ぶ",
      confidenceAria: "記録しやすくするヒント",
      confidenceItems: [
        { title: "場所と時間が残る", body: "あとで同じ場所を比べられます。" },
        { title: "周囲も手がかり", body: "環境・音・動きも記録の解像度になります。" },
        { title: "対象はあとで分ける", body: "必要になったら対象ごとの記録として切り出せます。" },
      ],
    },
    en: {
      title: "Start a record | ikimon",
      activeNav: "Record",
      footerNote: "Read the guide when you want more detail.",
      heroEyebrow: "record",
      heroHeading: "Start with a photo",
      heroLead: "One photo is enough. Names and details can come later.",
      photoAction: "Sign in and record a photo",
      registerAction: "Create account and record",
      panelEyebrow: "sign in required",
      panelHeading: "Sign in before opening the record screen.",
      panelBody: "Your photo, place, and time are saved to your own notebook.",
      noteAction: "Start with a note",
      learnAction: "Read how it works",
      dockAria: "Sign in and start a record",
      dockPhoto: "Photo",
      dockNote: "Note",
      dockVideo: "Video",
      dockGallery: "Files",
      confidenceAria: "Prompts that make recording easier",
      confidenceItems: [
        { title: "Name can come later", body: "Save the moment first." },
        { title: "One photo is enough", body: "Place and time stay with it." },
        { title: "Community can help", body: "A public record can collect clues." },
      ],
    },
    es: {
      title: "Empezar un registro | ikimon",
      activeNav: "Registro",
      footerNote: "Lee la guia cuando quieras mas detalle.",
      heroEyebrow: "registro",
      heroHeading: "Empieza con una foto",
      heroLead: "Una foto basta. El nombre y los detalles pueden venir despues.",
      photoAction: "Iniciar sesion y registrar foto",
      registerAction: "Crear cuenta y registrar",
      panelEyebrow: "sesion requerida",
      panelHeading: "Inicia sesion antes de abrir la pantalla de registro.",
      panelBody: "Tu foto, lugar y hora se guardan en tu propio cuaderno.",
      noteAction: "Empezar con nota",
      learnAction: "Leer como funciona",
      dockAria: "Iniciar sesion y empezar un registro",
      dockPhoto: "Foto",
      dockNote: "Nota",
      dockVideo: "Video",
      dockGallery: "Archivos",
      confidenceAria: "Pistas para registrar con confianza",
      confidenceItems: [
        { title: "El nombre puede esperar", body: "Guarda primero el momento." },
        { title: "Una foto basta", body: "Lugar y hora quedan juntos." },
        { title: "La comunidad ayuda", body: "El registro puede sumar pistas." },
      ],
    },
    "pt-BR": {
      title: "Comecar um registro | ikimon",
      activeNav: "Registrar",
      footerNote: "Leia o guia quando quiser mais detalhes.",
      heroEyebrow: "registro",
      heroHeading: "Comece com uma foto",
      heroLead: "Uma foto basta. O nome e os detalhes podem vir depois.",
      photoAction: "Entrar e registrar foto",
      registerAction: "Criar conta e registrar",
      panelEyebrow: "login necessario",
      panelHeading: "Entre antes de abrir a tela de registro.",
      panelBody: "Sua foto, local e horario ficam salvos no seu proprio caderno.",
      noteAction: "Comecar com nota",
      learnAction: "Ler como funciona",
      dockAria: "Entrar e comecar um registro",
      dockPhoto: "Foto",
      dockNote: "Nota",
      dockVideo: "Video",
      dockGallery: "Arquivos",
      confidenceAria: "Pistas para registrar com confianca",
      confidenceItems: [
        { title: "O nome pode vir depois", body: "Salve o momento primeiro." },
        { title: "Uma foto basta", body: "Local e horario ficam juntos." },
        { title: "A comunidade ajuda", body: "O registro pode ganhar pistas." },
      ],
    },
  };
  return localized[lang] ?? localized.ja;
}

function recordPageCopy(lang: SiteLang): RecordPageCopy {
  const start = recordStartCopy(lang);
  const localized: Record<SiteLang, RecordPageCopy> = {
    ja: {
      title: "記録する | ikimon",
      activeNav: "記録",
      footerNote: "いつもの道で見つけた自然を、あとで対象ごとの記録や観察レコードへ育てられる形に残す。",
      heading: "記録する",
      lead: "写真・動画・音声・場所・時刻・メモをまとめて1件の記録として保存します。名前や対象の切り分けはあとからで大丈夫です。",
      sessionLabel: "ログイン中",
      captureAria: "記録の始め方",
      photoTitle: "写真で記録する",
      photoSub: "撮る / 選ぶ",
      noteTitle: "メモだけ残す",
      noteSub: "写真なし",
      videoTitle: "動画で残す",
      videoSub: "最大60秒",
      galleryTitle: "ファイルから選ぶ",
      gallerySub: "写真 / 動画",
      guideLink: "AIのヒントを見ながら探す",
      learnLink: "使い方を読む",
      dockAria: "すぐ記録する",
      dockPhoto: "写真",
      dockNote: "メモ",
      dockVideo: "動画",
      dockGallery: "選ぶ",
      captureResultLabel: "自動下書き",
      captureResultTitle: "未選択",
      captureResultHelp: "写真・日時・地点だけで保存できます。周囲や気づきはあとで足して、記録の解像度を上げられます。",
      captureChange: "選び直す",
      locationTitle: "写真に場所も入れる",
      locationBody: "現在地を入れると、あとで同じ場所を見返しやすくなります。",
      locationAction: "現在地を入れる",
      submittingLabel: "送信中...",
      modeEntryLabel: "記録入口",
      modeQuickLabel: "ふだんの記録",
      modeSurveyLabel: "しっかり記録",
      modeQuickLead: "場所・時間・気づいたことを、まず 1 つ残すための入力です。",
      modeSurveyLead: "見た条件も一緒に残して、あとで同じ場所・同じ対象を比べやすくするための入力です。",
      confidenceAria: start.confidenceAria,
      confidenceItems: start.confidenceItems,
      captureLabels: {
        note: { title: "メモだけ残す", help: "写真なしでも、場所・時間・ひとことで記録を残せます。" },
        photo: { title: "写真で記録する", help: "撮った写真、または端末上の写真を記録に添付します。" },
        video: { title: "動画で記録する", help: "動画を選ぶと、長さ・地点・公開までの状態を順番に案内します。" },
        gallery: { title: "ファイルを選ぶ", help: "撮影済みの写真または動画を記録に添付します。" },
      },
    },
    en: {
      title: "Record | ikimon",
      activeNav: "Record",
      footerNote: "Save nearby nature in a form you can revisit later.",
      heading: "Record with photo",
      lead: "Take or choose a photo first. The extra fields appear only after that.",
      sessionLabel: "Signed in",
      captureAria: "Ways to start a record",
      photoTitle: "Record with photo",
      photoSub: "Take / choose",
      noteTitle: "Leave a note",
      noteSub: "No photo",
      videoTitle: "Record video",
      videoSub: "Up to 60 sec",
      galleryTitle: "Choose files",
      gallerySub: "Photo / video",
      guideLink: "Look with AI hints",
      learnLink: "Read how it works",
      dockAria: "Start recording now",
      dockPhoto: "Photo",
      dockNote: "Note",
      dockVideo: "Video",
      dockGallery: "Files",
      captureResultLabel: "Auto draft",
      captureResultTitle: "Nothing selected",
      captureResultHelp: "Photo, time, and place are enough to save. Names and notes can come later.",
      captureChange: "Choose again",
      locationTitle: "Add a place to the photo",
      locationBody: "Adding your location makes it easier to revisit the same place later.",
      locationAction: "Use current location",
      submittingLabel: "Sending...",
      modeEntryLabel: "Record entry",
      modeQuickLabel: "Everyday record",
      modeSurveyLabel: "Survey record",
      modeQuickLead: "Save one record with place, time, and what you noticed.",
      modeSurveyLead: "Add viewing conditions so you can compare this place later.",
      confidenceAria: start.confidenceAria,
      confidenceItems: start.confidenceItems,
      captureLabels: {
        note: { title: "Leave a note", help: "Record place, time, and a short note even without a photo." },
        photo: { title: "Record with photo", help: "Attach a new photo or a photo from this device." },
        video: { title: "Record video", help: "After choosing a video, we guide length, place, and publishing status." },
        gallery: { title: "Choose files", help: "Attach saved photos or videos to this record." },
      },
    },
    es: {
      title: "Registrar | ikimon",
      activeNav: "Registro",
      footerNote: "Guarda la naturaleza cercana para volver a verla despues.",
      heading: "Registrar con foto",
      lead: "Toma o elige una foto primero. Los campos extra aparecen despues.",
      sessionLabel: "Sesion iniciada",
      captureAria: "Formas de empezar un registro",
      photoTitle: "Registrar con foto",
      photoSub: "Tomar / elegir",
      noteTitle: "Dejar nota",
      noteSub: "Sin foto",
      videoTitle: "Registrar video",
      videoSub: "Hasta 60 s",
      galleryTitle: "Elegir archivos",
      gallerySub: "Foto / video",
      guideLink: "Buscar con pistas de IA",
      learnLink: "Leer como funciona",
      dockAria: "Registrar ahora",
      dockPhoto: "Foto",
      dockNote: "Nota",
      dockVideo: "Video",
      dockGallery: "Archivos",
      captureResultLabel: "Borrador automatico",
      captureResultTitle: "Nada elegido",
      captureResultHelp: "Foto, hora y lugar bastan para guardar. El nombre y las notas pueden venir despues.",
      captureChange: "Elegir otra vez",
      locationTitle: "Agregar lugar a la foto",
      locationBody: "Agregar ubicacion ayuda a volver al mismo lugar despues.",
      locationAction: "Usar ubicacion actual",
      submittingLabel: "Enviando...",
      modeEntryLabel: "Entrada de registro",
      modeQuickLabel: "Registro diario",
      modeSurveyLabel: "Registro de muestreo",
      modeQuickLead: "Guarda un registro con lugar, hora y lo que notaste.",
      modeSurveyLead: "Agrega condiciones para comparar este lugar despues.",
      confidenceAria: start.confidenceAria,
      confidenceItems: start.confidenceItems,
      captureLabels: {
        note: { title: "Dejar nota", help: "Registra lugar, hora y una nota corta aunque no haya foto." },
        photo: { title: "Registrar con foto", help: "Adjunta una foto nueva o una foto del dispositivo." },
        video: { title: "Registrar video", help: "Despues de elegir video, guiamos duracion, lugar y estado de publicacion." },
        gallery: { title: "Elegir archivos", help: "Adjunta fotos o videos guardados a este registro." },
      },
    },
    "pt-BR": {
      title: "Registrar | ikimon",
      activeNav: "Registrar",
      footerNote: "Salve a natureza por perto para rever depois.",
      heading: "Registrar com foto",
      lead: "Tire ou escolha uma foto primeiro. Os campos extras aparecem depois.",
      sessionLabel: "Conectado",
      captureAria: "Formas de comecar um registro",
      photoTitle: "Registrar com foto",
      photoSub: "Tirar / escolher",
      noteTitle: "Deixar nota",
      noteSub: "Sem foto",
      videoTitle: "Registrar video",
      videoSub: "Ate 60 s",
      galleryTitle: "Escolher arquivos",
      gallerySub: "Foto / video",
      guideLink: "Procurar com dicas de IA",
      learnLink: "Ler como funciona",
      dockAria: "Registrar agora",
      dockPhoto: "Foto",
      dockNote: "Nota",
      dockVideo: "Video",
      dockGallery: "Arquivos",
      captureResultLabel: "Rascunho automatico",
      captureResultTitle: "Nada selecionado",
      captureResultHelp: "Foto, horario e local bastam para salvar. Nome e notas podem vir depois.",
      captureChange: "Escolher de novo",
      locationTitle: "Adicionar local a foto",
      locationBody: "Adicionar o local facilita rever o mesmo ponto depois.",
      locationAction: "Usar local atual",
      submittingLabel: "Enviando...",
      modeEntryLabel: "Entrada do registro",
      modeQuickLabel: "Registro diario",
      modeSurveyLabel: "Registro de campo",
      modeQuickLead: "Salve um registro com local, horario e o que voce notou.",
      modeSurveyLead: "Adicione condicoes para comparar este lugar depois.",
      confidenceAria: start.confidenceAria,
      confidenceItems: start.confidenceItems,
      captureLabels: {
        note: { title: "Deixar nota", help: "Registre local, horario e uma nota curta mesmo sem foto." },
        photo: { title: "Registrar com foto", help: "Anexe uma foto nova ou uma foto deste dispositivo." },
        video: { title: "Registrar video", help: "Depois de escolher video, guiamos duracao, local e status de publicacao." },
        gallery: { title: "Escolher arquivos", help: "Anexe fotos ou videos salvos a este registro." },
      },
    },
  };
  return localized[lang] ?? localized.ja;
}

function recordFormCopy(lang: SiteLang): RecordFormCopy {
  const localized: Record<SiteLang, RecordFormCopy> = {
    ja: {
      preSubmitLabel: "送信前チェック",
      submitPanelTitle: "メディア未選択",
      submitPanelHelpMedia: "日時と地点を確認して記録として保存します。周囲・音・動き・気づきはあとで足せます。",
      submitPanelHelpNote: "写真なしの記録として保存します。あとで写真を足せます。",
      submitPanelHelpEmpty: "写真を選ぶと、ここから保存できます。",
      submitButton: "記録を保存",
      observedAtLabel: "観察した日時",
      placeLabel: "記録の地点",
      locationUnknown: "地点未指定",
      locationHelp: "現在地、検索、地図タップで記録の地点を決められます。",
      currentLocation: "現在地",
      locationSearchPlaceholder: "公園名・駅名・住所で探す",
      locationSearchButton: "検索",
      locationMapAria: "記録の地点を地図で指定",
      locationMapFallback: "地図を読み込み中。表示されたらタップして記録の地点を指定できます。",
      coordinateSummary: "座標を直接編集",
      latitudeLabel: "緯度",
      longitudeLabel: "経度",
      coordinatePlaceholder: "自動取得 or 手入力",
      laterSummary: "あとで補完する項目",
      localityNoteLabel: "場所のメモ",
      localityNotePlaceholder: "例: 公園の入口付近 / 水辺の柵のそば",
      mediaRoleLabel: "このメディアの役割",
      mediaRolePrimaryTitle: "主役",
      mediaRolePrimaryBody: "この記録の中心",
      mediaRoleContextTitle: "周囲",
      mediaRoleContextBody: "場所・環境の手がかり",
      mediaRoleSoundTitle: "音・動き",
      mediaRoleSoundBody: "鳴き声や行動",
      mediaRoleSecondaryTitle: "別対象候補",
      mediaRoleSecondaryBody: "同じ画面の別の生きもの",
      vernacularNameLabel: "和名 / 通称（分かれば）",
      vernacularNamePlaceholder: "例: スズメ",
      scientificNameLabel: "学名 / 分類（分かれば）",
      scientificNamePlaceholder: "例: Passer montanus",
      municipalityLabel: "市区町村",
      municipalityPlaceholder: "例: 浜松市",
      rankLabel: "確信度",
      recordModeLabel: "記録の残し方",
      quickModeTitle: "ふだんの記録",
      quickModeBody: "いつもの散歩で見つけたことを残す",
      surveyModeTitle: "しっかり記録",
      surveyModeBody: "比べたい観察の条件も一緒に残す",
      tipsLink: "記録のコツを読む",
      submitDockAria: "記録を送信する",
      submitDockLocation: "現在地",
      submitDockMeta: "メディア未選択",
      submitDockSave: "保存",
      locationSelected: "記録の地点を指定済み",
      mediaNoteOnly: "メモのみ",
      mediaLocationMissing: "地点未指定",
      recordRoleTitle: "この記録の役割",
      recordRoleHelp: "目的と役割を軽く残すと、あとで定点比較・授業・管理記録に束ねやすくなります。",
      recordRolePill: "文脈",
      activityIntentLabel: "今日の目的",
      activityIntentOptions: {
        discover: "見つける",
        revisit: "同じ場所をもう一度見る",
        compare: "前と比べる",
        learn: "授業・学びに使う",
        manage: "手入れや管理と結びつける",
        confirm: "気になる対象を確認する",
        share: "観察会・共有用に残す",
      },
      participantRoleLabel: "自分の役割",
      participantRoleOptions: {
        finder: "見つけた人",
        photographer: "撮影した人",
        context_recorder: "周囲を記録する人",
        note_taker: "メモ係",
        student: "児童・生徒",
        teacher: "先生・引率",
        manager: "管理者",
        participant: "参加者",
      },
      quickReviewTitle: "あとで見返すためのメモ",
      quickReviewHelp: "見つけた / 見なかった / まだ分からない を軽く残すと、次の散歩で比べやすくなります。",
      quickReviewPill: "再訪用",
      quickCaptureStateLabel: "今回の記録の残し方",
      quickCaptureStateOptions: {
        present: "見つけて書く",
        unknown: "まだ分からないまま残す",
        no_detection_note: "今日は見なかったメモを記録として残す",
      },
      nextLookForLabel: "次に見返す手がかり",
      nextLookForPlaceholder: "例: 同じ水辺の音 / 葉の裏 / 同じ木の花",
      surveyBlockTitle: "比べるための記録",
      surveyBlockHelp: "同じ場所を見比べたいときの追加入力です。ふだんの記録とは分けて残します。",
      surveyBlockPill: "比較用",
      checklistCompletionLabel: "どこまで見たか",
      checklistCompletionOptions: {
        complete: "ひと通り見た",
        partial: "気になるものだけ見た",
      },
      targetTaxaScopeLabel: "何を見たかったか",
      targetTaxaScopePlaceholder: "例: 水辺の鳥 / 春のチョウ / 公園の花",
      effortMinutesLabel: "見た時間（分）",
      surveyResultLabel: "今回の結果",
      surveyResultOptions: {
        detected: "見つけて記録に残した",
        no_detection_note: "見つからなかったメモだけ残す",
      },
      revisitReasonLabel: "また見に行きたい理由",
      revisitReasonPlaceholder: "例: 先月と比べたい / 同じ水路の変化を見たい",
      fieldScanTitle: "フィールドスキャン",
      fieldScanHelp: "場所の状態、定点、ルート、面、較正証拠を分けて残します。",
      fieldScanPill: "スキャン",
      fieldScanTypeLabel: "種類",
      fieldScanModeOptions: {
        none: "指定なし",
        site_snapshot: "場所",
        fixed_point: "定点",
        route: "ルート",
        area_footprint: "面",
        calibration_evidence: "較正",
      },
      fixedPointIdLabel: "定点ID",
      fixedPointIdPlaceholder: "例: fp-park-01",
      routeIdLabel: "ルートID",
      routeIdPlaceholder: "例: route-river-01",
      areaIdLabel: "エリアID",
      areaIdPlaceholder: "例: area-wetland-01",
      waterTitle: "水辺・釣果",
      waterHelp: "釣った、見た、釣れなかったを分けて残します。",
      waterPill: "水辺",
      catchOutcomeLabel: "結果",
      catchOutcomeOptions: {
        none: "指定なし",
        caught: "釣った/採った",
        released: "リリース",
        kept: "持ち帰り",
        lost: "逃した",
        no_catch: "釣れなかった",
        observed_only: "見ただけ",
      },
      captureMethodLabel: "方法",
      captureMethodPlaceholder: "例: ルアー / 目視 / タモ網",
      participantCountLabel: "人数",
      publicWaterbodyLabel: "公開水域名",
      publicWaterbodyPlaceholder: "例: 市内の河川 / 浜名湖周辺",
      releasedCountLabel: "放した数",
      keptCountLabel: "持ち帰り数",
    },
    en: {
      preSubmitLabel: "Before saving",
      submitPanelTitle: "No media selected",
      submitPanelHelpMedia: "Check time and place, then save. Names and notes can come later.",
      submitPanelHelpNote: "Save this as a note without a photo. You can add a photo later.",
      submitPanelHelpEmpty: "Choose a photo or note to save from here.",
      submitButton: "Save and complete later",
      observedAtLabel: "Observed time",
      placeLabel: "Observation place",
      locationUnknown: "Place not set",
      locationHelp: "Use current location, search, or tap the map.",
      currentLocation: "Current location",
      locationSearchPlaceholder: "Search park, station, or address",
      locationSearchButton: "Search",
      locationMapAria: "Choose observation place on the map",
      locationMapFallback: "Loading map. Tap it when it appears to set the place.",
      coordinateSummary: "Edit coordinates directly",
      latitudeLabel: "Latitude",
      longitudeLabel: "Longitude",
      coordinatePlaceholder: "Auto or manual",
      laterSummary: "Fields you can complete later",
      localityNoteLabel: "Place note",
      localityNotePlaceholder: "Example: near the park entrance / by the waterside fence",
      mediaRoleLabel: "Role of this media",
      mediaRolePrimaryTitle: "Main subject",
      mediaRolePrimaryBody: "Center of this record",
      mediaRoleContextTitle: "Context",
      mediaRoleContextBody: "Place and habitat clues",
      mediaRoleSoundTitle: "Sound / motion",
      mediaRoleSoundBody: "Call or behavior",
      mediaRoleSecondaryTitle: "Another candidate",
      mediaRoleSecondaryBody: "Another living thing in the frame",
      vernacularNameLabel: "Common name if known",
      vernacularNamePlaceholder: "Example: sparrow",
      scientificNameLabel: "Scientific name / taxon if known",
      scientificNamePlaceholder: "Example: Passer montanus",
      municipalityLabel: "Municipality",
      municipalityPlaceholder: "Example: Hamamatsu",
      rankLabel: "Confidence rank",
      recordModeLabel: "Record mode",
      quickModeTitle: "Everyday record",
      quickModeBody: "Save what you found on a normal walk",
      surveyModeTitle: "Survey record",
      surveyModeBody: "Add conditions when you want to compare later",
      tipsLink: "Read recording tips",
      submitDockAria: "Submit record",
      submitDockLocation: "Location",
      submitDockMeta: "No media selected",
      submitDockSave: "Save",
      locationSelected: "Place set",
      mediaNoteOnly: "Note only",
      mediaLocationMissing: "Place missing",
      recordRoleTitle: "Role of this record",
      recordRoleHelp: "A light purpose and role make it easier to reuse later for revisits, classes, or management notes.",
      recordRolePill: "Context",
      activityIntentLabel: "Today's purpose",
      activityIntentOptions: {
        discover: "Discover",
        revisit: "Revisit the same place",
        compare: "Compare with before",
        learn: "Use for class or learning",
        manage: "Connect to care or management",
        confirm: "Check something you noticed",
        share: "Save for a group walk",
      },
      participantRoleLabel: "Your role",
      participantRoleOptions: {
        finder: "Finder",
        photographer: "Photographer",
        context_recorder: "Context recorder",
        note_taker: "Note taker",
        student: "Student",
        teacher: "Teacher / guide",
        manager: "Manager",
        participant: "Participant",
      },
      quickReviewTitle: "Note for later",
      quickReviewHelp: "A small found / not found / unsure note makes the next walk easier to compare.",
      quickReviewPill: "Revisit",
      quickCaptureStateLabel: "How to keep this record",
      quickCaptureStateOptions: {
        present: "Found and noted",
        unknown: "Save while unsure",
        no_detection_note: "Not found today",
      },
      nextLookForLabel: "What to look for next",
      nextLookForPlaceholder: "Example: the waterside bird from last week / a leaf to identify / the same tree flower",
      surveyBlockTitle: "Record for comparison",
      surveyBlockHelp: "Use this when you want to compare the same place later. It stays separate from everyday records.",
      surveyBlockPill: "Compare",
      checklistCompletionLabel: "How much did you check?",
      checklistCompletionOptions: {
        complete: "Checked broadly",
        partial: "Checked selected things",
      },
      targetTaxaScopeLabel: "What did you want to check?",
      targetTaxaScopePlaceholder: "Example: waterside birds / spring butterflies / park flowers",
      effortMinutesLabel: "Time spent (minutes)",
      surveyResultLabel: "Result this time",
      surveyResultOptions: {
        detected: "Found and recorded",
        no_detection_note: "Not found note only",
      },
      revisitReasonLabel: "Why revisit?",
      revisitReasonPlaceholder: "Example: compare with last month / check changes in the same canal",
      fieldScanTitle: "Field scan",
      fieldScanHelp: "Separate site state, fixed point, route, area, and calibration evidence.",
      fieldScanPill: "Scan",
      fieldScanTypeLabel: "Type",
      fieldScanModeOptions: {
        none: "Not specified",
        site_snapshot: "Site",
        fixed_point: "Fixed point",
        route: "Route",
        area_footprint: "Area",
        calibration_evidence: "Calibration",
      },
      fixedPointIdLabel: "Fixed point ID",
      fixedPointIdPlaceholder: "Example: fp-park-01",
      routeIdLabel: "Route ID",
      routeIdPlaceholder: "Example: route-river-01",
      areaIdLabel: "Area ID",
      areaIdPlaceholder: "Example: area-wetland-01",
      waterTitle: "Waterside / catch",
      waterHelp: "Keep caught, seen, and not caught records separate.",
      waterPill: "Waterside",
      catchOutcomeLabel: "Outcome",
      catchOutcomeOptions: {
        none: "Not specified",
        caught: "Caught / collected",
        released: "Released",
        kept: "Kept",
        lost: "Lost",
        no_catch: "No catch",
        observed_only: "Seen only",
      },
      captureMethodLabel: "Method",
      captureMethodPlaceholder: "Example: lure / visual check / net",
      participantCountLabel: "People",
      publicWaterbodyLabel: "Public waterbody label",
      publicWaterbodyPlaceholder: "Example: city river / around Lake Hamana",
      releasedCountLabel: "Released count",
      keptCountLabel: "Kept count",
    },
    es: {
      preSubmitLabel: "Antes de guardar",
      submitPanelTitle: "Sin medio elegido",
      submitPanelHelpMedia: "Revisa hora y lugar, luego guarda. El nombre y las notas pueden venir despues.",
      submitPanelHelpNote: "Guarda esto como nota sin foto. Puedes agregar una foto despues.",
      submitPanelHelpEmpty: "Elige una foto o nota para guardar desde aqui.",
      submitButton: "Guardar y completar despues",
      observedAtLabel: "Hora observada",
      placeLabel: "Lugar de observacion",
      locationUnknown: "Lugar sin definir",
      locationHelp: "Usa ubicacion actual, busca o toca el mapa.",
      currentLocation: "Ubicacion actual",
      locationSearchPlaceholder: "Buscar parque, estacion o direccion",
      locationSearchButton: "Buscar",
      locationMapAria: "Elegir lugar de observacion en el mapa",
      locationMapFallback: "Cargando mapa. Tocalo cuando aparezca para fijar el lugar.",
      coordinateSummary: "Editar coordenadas directamente",
      latitudeLabel: "Latitud",
      longitudeLabel: "Longitud",
      coordinatePlaceholder: "Automatico o manual",
      laterSummary: "Campos que puedes completar despues",
      localityNoteLabel: "Nota del lugar",
      localityNotePlaceholder: "Ejemplo: cerca de la entrada del parque / junto al agua",
      mediaRoleLabel: "Rol de este medio",
      mediaRolePrimaryTitle: "Sujeto principal",
      mediaRolePrimaryBody: "Centro de este registro",
      mediaRoleContextTitle: "Contexto",
      mediaRoleContextBody: "Pistas de lugar y habitat",
      mediaRoleSoundTitle: "Sonido / movimiento",
      mediaRoleSoundBody: "Canto o conducta",
      mediaRoleSecondaryTitle: "Otro candidato",
      mediaRoleSecondaryBody: "Otro ser vivo en la imagen",
      vernacularNameLabel: "Nombre comun si lo sabes",
      vernacularNamePlaceholder: "Ejemplo: gorrion",
      scientificNameLabel: "Nombre cientifico / taxon si lo sabes",
      scientificNamePlaceholder: "Ejemplo: Passer montanus",
      municipalityLabel: "Municipio",
      municipalityPlaceholder: "Ejemplo: Hamamatsu",
      rankLabel: "Rango de confianza",
      recordModeLabel: "Modo de registro",
      quickModeTitle: "Registro diario",
      quickModeBody: "Guarda lo que encontraste en un paseo normal",
      surveyModeTitle: "Registro de muestreo",
      surveyModeBody: "Agrega condiciones si quieres comparar despues",
      tipsLink: "Leer consejos de registro",
      submitDockAria: "Enviar registro",
      submitDockLocation: "Lugar",
      submitDockMeta: "Sin medio elegido",
      submitDockSave: "Guardar",
      locationSelected: "Lugar definido",
      mediaNoteOnly: "Solo nota",
      mediaLocationMissing: "Falta lugar",
      recordRoleTitle: "Rol de este registro",
      recordRoleHelp: "Un proposito y rol ligeros ayudan a reutilizarlo despues para visitas, clases o gestion.",
      recordRolePill: "Contexto",
      activityIntentLabel: "Proposito de hoy",
      activityIntentOptions: {
        discover: "Descubrir",
        revisit: "Volver al mismo lugar",
        compare: "Comparar con antes",
        learn: "Usar para clase o aprendizaje",
        manage: "Conectar con cuidado o gestion",
        confirm: "Confirmar algo observado",
        share: "Guardar para caminata grupal",
      },
      participantRoleLabel: "Tu rol",
      participantRoleOptions: {
        finder: "Quien encontro",
        photographer: "Fotografo",
        context_recorder: "Quien registra contexto",
        note_taker: "Quien toma notas",
        student: "Estudiante",
        teacher: "Docente / guia",
        manager: "Gestor",
        participant: "Participante",
      },
      quickReviewTitle: "Nota para despues",
      quickReviewHelp: "Una nota breve de encontrado / no encontrado / incierto facilita comparar el proximo paseo.",
      quickReviewPill: "Revisita",
      quickCaptureStateLabel: "Como guardar este registro",
      quickCaptureStateOptions: {
        present: "Encontrado y anotado",
        unknown: "Guardar aunque no sepa",
        no_detection_note: "No encontrado hoy",
      },
      nextLookForLabel: "Que buscar despues",
      nextLookForPlaceholder: "Ejemplo: el ave del agua de la semana pasada / una hoja por identificar / la flor del mismo arbol",
      surveyBlockTitle: "Registro para comparar",
      surveyBlockHelp: "Usalo cuando quieras comparar el mismo lugar despues. Queda separado del registro diario.",
      surveyBlockPill: "Comparar",
      checklistCompletionLabel: "Cuanto revisaste?",
      checklistCompletionOptions: {
        complete: "Revise en general",
        partial: "Revise solo lo importante",
      },
      targetTaxaScopeLabel: "Que querias revisar?",
      targetTaxaScopePlaceholder: "Ejemplo: aves de agua / mariposas de primavera / flores del parque",
      effortMinutesLabel: "Tiempo usado (minutos)",
      surveyResultLabel: "Resultado esta vez",
      surveyResultOptions: {
        detected: "Encontrado y registrado",
        no_detection_note: "Solo nota de no encontrado",
      },
      revisitReasonLabel: "Por que volver?",
      revisitReasonPlaceholder: "Ejemplo: comparar con el mes pasado / ver cambios en el mismo canal",
      fieldScanTitle: "Escaneo de campo",
      fieldScanHelp: "Separa estado del sitio, punto fijo, ruta, area y evidencia de calibracion.",
      fieldScanPill: "Escaneo",
      fieldScanTypeLabel: "Tipo",
      fieldScanModeOptions: {
        none: "Sin especificar",
        site_snapshot: "Sitio",
        fixed_point: "Punto fijo",
        route: "Ruta",
        area_footprint: "Area",
        calibration_evidence: "Calibracion",
      },
      fixedPointIdLabel: "ID de punto fijo",
      fixedPointIdPlaceholder: "Ejemplo: fp-park-01",
      routeIdLabel: "ID de ruta",
      routeIdPlaceholder: "Ejemplo: route-river-01",
      areaIdLabel: "ID de area",
      areaIdPlaceholder: "Ejemplo: area-wetland-01",
      waterTitle: "Agua / captura",
      waterHelp: "Separa capturado, visto y no capturado.",
      waterPill: "Agua",
      catchOutcomeLabel: "Resultado",
      catchOutcomeOptions: {
        none: "Sin especificar",
        caught: "Capturado / recolectado",
        released: "Liberado",
        kept: "Conservado",
        lost: "Escapo",
        no_catch: "Sin captura",
        observed_only: "Solo visto",
      },
      captureMethodLabel: "Metodo",
      captureMethodPlaceholder: "Ejemplo: senuelo / vista / red",
      participantCountLabel: "Personas",
      publicWaterbodyLabel: "Etiqueta publica del agua",
      publicWaterbodyPlaceholder: "Ejemplo: rio de la ciudad / alrededor del lago Hamana",
      releasedCountLabel: "Cantidad liberada",
      keptCountLabel: "Cantidad conservada",
    },
    "pt-BR": {
      preSubmitLabel: "Antes de salvar",
      submitPanelTitle: "Nenhuma midia selecionada",
      submitPanelHelpMedia: "Confira horario e local, depois salve. Nome e notas podem vir depois.",
      submitPanelHelpNote: "Salve isto como nota sem foto. Voce pode adicionar foto depois.",
      submitPanelHelpEmpty: "Escolha uma foto ou nota para salvar daqui.",
      submitButton: "Salvar e completar depois",
      observedAtLabel: "Horario observado",
      placeLabel: "Local da observacao",
      locationUnknown: "Local nao definido",
      locationHelp: "Use local atual, busca ou toque no mapa.",
      currentLocation: "Local atual",
      locationSearchPlaceholder: "Buscar parque, estacao ou endereco",
      locationSearchButton: "Buscar",
      locationMapAria: "Escolher local da observacao no mapa",
      locationMapFallback: "Carregando mapa. Toque nele quando aparecer para definir o local.",
      coordinateSummary: "Editar coordenadas diretamente",
      latitudeLabel: "Latitude",
      longitudeLabel: "Longitude",
      coordinatePlaceholder: "Automatico ou manual",
      laterSummary: "Campos que voce pode completar depois",
      localityNoteLabel: "Nota do local",
      localityNotePlaceholder: "Exemplo: perto da entrada do parque / junto a agua",
      mediaRoleLabel: "Papel desta midia",
      mediaRolePrimaryTitle: "Tema principal",
      mediaRolePrimaryBody: "Centro deste registro",
      mediaRoleContextTitle: "Contexto",
      mediaRoleContextBody: "Pistas de local e habitat",
      mediaRoleSoundTitle: "Som / movimento",
      mediaRoleSoundBody: "Canto ou comportamento",
      mediaRoleSecondaryTitle: "Outro candidato",
      mediaRoleSecondaryBody: "Outro ser vivo na imagem",
      vernacularNameLabel: "Nome comum se souber",
      vernacularNamePlaceholder: "Exemplo: pardal",
      scientificNameLabel: "Nome cientifico / taxon se souber",
      scientificNamePlaceholder: "Exemplo: Passer montanus",
      municipalityLabel: "Municipio",
      municipalityPlaceholder: "Exemplo: Hamamatsu",
      rankLabel: "Nivel de confianca",
      recordModeLabel: "Modo de registro",
      quickModeTitle: "Registro diario",
      quickModeBody: "Salve o que encontrou em uma caminhada normal",
      surveyModeTitle: "Registro de campo",
      surveyModeBody: "Adicione condicoes quando quiser comparar depois",
      tipsLink: "Ler dicas de registro",
      submitDockAria: "Enviar registro",
      submitDockLocation: "Local",
      submitDockMeta: "Nenhuma midia selecionada",
      submitDockSave: "Salvar",
      locationSelected: "Local definido",
      mediaNoteOnly: "Somente nota",
      mediaLocationMissing: "Falta local",
      recordRoleTitle: "Papel deste registro",
      recordRoleHelp: "Um proposito e papel simples ajudam a reutilizar depois em revisitas, aulas ou gestao.",
      recordRolePill: "Contexto",
      activityIntentLabel: "Proposito de hoje",
      activityIntentOptions: {
        discover: "Descobrir",
        revisit: "Revisitar o mesmo local",
        compare: "Comparar com antes",
        learn: "Usar em aula ou aprendizado",
        manage: "Conectar a cuidado ou gestao",
        confirm: "Confirmar algo observado",
        share: "Guardar para caminhada em grupo",
      },
      participantRoleLabel: "Seu papel",
      participantRoleOptions: {
        finder: "Quem encontrou",
        photographer: "Fotografo",
        context_recorder: "Quem registra contexto",
        note_taker: "Quem anota",
        student: "Estudante",
        teacher: "Professor / guia",
        manager: "Gestor",
        participant: "Participante",
      },
      quickReviewTitle: "Nota para depois",
      quickReviewHelp: "Uma nota breve de encontrado / nao encontrado / incerto facilita comparar a proxima caminhada.",
      quickReviewPill: "Revisita",
      quickCaptureStateLabel: "Como guardar este registro",
      quickCaptureStateOptions: {
        present: "Encontrado e anotado",
        unknown: "Salvar mesmo sem saber",
        no_detection_note: "Nao encontrado hoje",
      },
      nextLookForLabel: "O que procurar depois",
      nextLookForPlaceholder: "Exemplo: ave da agua da semana passada / folha para identificar / flor da mesma arvore",
      surveyBlockTitle: "Registro para comparar",
      surveyBlockHelp: "Use quando quiser comparar o mesmo local depois. Fica separado do registro diario.",
      surveyBlockPill: "Comparar",
      checklistCompletionLabel: "Quanto voce verificou?",
      checklistCompletionOptions: {
        complete: "Verifiquei em geral",
        partial: "Verifiquei pontos escolhidos",
      },
      targetTaxaScopeLabel: "O que queria verificar?",
      targetTaxaScopePlaceholder: "Exemplo: aves da agua / borboletas da primavera / flores do parque",
      effortMinutesLabel: "Tempo usado (minutos)",
      surveyResultLabel: "Resultado desta vez",
      surveyResultOptions: {
        detected: "Encontrado e registrado",
        no_detection_note: "Somente nota de nao encontrado",
      },
      revisitReasonLabel: "Por que revisitar?",
      revisitReasonPlaceholder: "Exemplo: comparar com o mes passado / ver mudancas no mesmo canal",
      fieldScanTitle: "Varredura de campo",
      fieldScanHelp: "Separe estado do local, ponto fixo, rota, area e evidencia de calibracao.",
      fieldScanPill: "Varredura",
      fieldScanTypeLabel: "Tipo",
      fieldScanModeOptions: {
        none: "Nao especificado",
        site_snapshot: "Local",
        fixed_point: "Ponto fixo",
        route: "Rota",
        area_footprint: "Area",
        calibration_evidence: "Calibracao",
      },
      fixedPointIdLabel: "ID do ponto fixo",
      fixedPointIdPlaceholder: "Exemplo: fp-park-01",
      routeIdLabel: "ID da rota",
      routeIdPlaceholder: "Exemplo: route-river-01",
      areaIdLabel: "ID da area",
      areaIdPlaceholder: "Exemplo: area-wetland-01",
      waterTitle: "Agua / captura",
      waterHelp: "Separe capturado, visto e nao capturado.",
      waterPill: "Agua",
      catchOutcomeLabel: "Resultado",
      catchOutcomeOptions: {
        none: "Nao especificado",
        caught: "Capturado / coletado",
        released: "Solto",
        kept: "Mantido",
        lost: "Escapou",
        no_catch: "Sem captura",
        observed_only: "Somente visto",
      },
      captureMethodLabel: "Metodo",
      captureMethodPlaceholder: "Exemplo: isca / visual / rede",
      participantCountLabel: "Pessoas",
      publicWaterbodyLabel: "Rotulo publico da agua",
      publicWaterbodyPlaceholder: "Exemplo: rio da cidade / entorno do lago Hamana",
      releasedCountLabel: "Quantidade solta",
      keptCountLabel: "Quantidade mantida",
    },
  };
  return localized[lang] ?? localized.ja;
}

function renderRecordConfidenceStrip(lang: SiteLang): string {
  const copy = recordStartCopy(lang);
  return `<div class="record-confidence-strip" aria-label="${escapeHtml(copy.confidenceAria)}">${copy.confidenceItems
    .map((item) => `<div class="record-confidence-item"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body)}</span></div>`)
    .join("")}</div>`;
}

function renderRecordStartGuide(basePath: string, lang: SiteLang, currentUrl = "/record"): string {
  const copy = recordStartCopy(lang);
  const currentParams = new URL(currentUrl, "https://ikimon.local").searchParams;
  const start = currentParams.get("start");
  const recordStart = start === "note" || start === "photo" || start === "video" || start === "gallery" ? start : "";
  const recordParams = new URLSearchParams();
  if (recordStart) recordParams.set("start", recordStart);
  if (currentParams.get("draft") === "1") recordParams.set("draft", "1");
  if (lang) recordParams.set("lang", lang);
  const recordTarget = `/record${recordParams.toString() ? `?${recordParams.toString()}` : ""}`;
  const recordTargetForStart = (kind: "note" | "photo" | "video" | "gallery") => {
    const params = new URLSearchParams();
    params.set("start", kind);
    if (currentParams.get("draft") === "1" && recordStart === kind) params.set("draft", "1");
    if (lang) params.set("lang", lang);
    return `/record?${params.toString()}`;
  };
  const loginFor = (target: string) => appendLangToHref(withBasePath(basePath, `/login?redirect=${encodeURIComponent(target)}`), lang);
  const loginHref = loginFor(recordStart ? recordTarget : recordTargetForStart("photo"));
  const memoHref = loginFor(recordTargetForStart("note"));
  const registerHref = appendLangToHref(withBasePath(basePath, `/register?redirect=${encodeURIComponent(recordTarget)}`), lang);
  const learnHref = appendLangToHref(withBasePath(basePath, "/learn"), lang);
  const qaHint = process.env.ALLOW_QUERY_USER_ID === "1"
    ? `<p class="meta" style="margin-top:14px;font-size:12px;color:#64748b">staging QA: <code>${escapeHtml(withBasePath(basePath, "/record?userId=..."))}</code></p>`
    : "";
  return renderSiteDocument({
    basePath,
    title: copy.title,
    activeNav: copy.activeNav,
    lang,
    currentPath: appendLangToHref(withBasePath(basePath, "/record"), lang),
    extraStyles: START_STATE_STYLES,
    hero: {
      eyebrow: copy.heroEyebrow,
      heading: copy.heroHeading,
      lead: copy.heroLead,
      tone: "light",
      align: "center",
      actions: [
        { href: loginHref, label: copy.photoAction },
        { href: registerHref, label: copy.registerAction, variant: "secondary" },
      ],
    },
    body: `<div class="start-guide">
      <section class="section">
        <div class="start-guide-panel">
          <div class="eyebrow">${escapeHtml(copy.panelEyebrow)}</div>
          <h2>${escapeHtml(copy.panelHeading)}</h2>
          <p>${escapeHtml(copy.panelBody)}</p>
          ${renderRecordConfidenceStrip(lang)}
          <div class="start-guide-actions">
            <a class="btn btn-solid" href="${escapeHtml(loginHref)}">${escapeHtml(copy.photoAction)}</a>
            <a class="btn btn-ghost" href="${escapeHtml(memoHref)}">${escapeHtml(copy.noteAction)}</a>
            <a class="btn btn-ghost" href="${escapeHtml(learnHref)}">${escapeHtml(copy.learnAction)}</a>
          </div>
          ${qaHint}
        </div>
      </section>
      <nav class="record-capture-dock" aria-label="${escapeHtml(copy.dockAria)}">
        <a class="record-dock-action record-dock-primary" href="${escapeHtml(loginFor(recordTargetForStart("photo")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
          <span>${escapeHtml(copy.dockPhoto)}</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor(recordTargetForStart("note")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg></span>
          <span>${escapeHtml(copy.dockNote)}</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor(recordTargetForStart("video")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
          <span>${escapeHtml(copy.dockVideo)}</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor(recordTargetForStart("gallery")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
          <span>${escapeHtml(copy.dockGallery)}</span>
        </a>
      </nav>
    </div>`,
    footerNote: copy.footerNote,
  });
}

function renderShotSuggestionsCard(
  shotSuggestions: import("../services/observationAiAssessment.js").ShotSuggestion[] | null | undefined,
  photoAssets: { roleTag: string | null }[] | null | undefined = null,
  mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext(),
): string {
  const hasSuggestions = shotSuggestions && shotSuggestions.length > 0;
  const coverageStrip = renderRoleCoverageStrip(photoAssets);
  if (!hasSuggestions && !coverageStrip) return "";
  const mediaCopy = observationMediaCopy(mediaContext);
  const items = hasSuggestions ? (shotSuggestions as import("../services/observationAiAssessment.js").ShotSuggestion[]).map((suggestion) => {
    const meta = SHOT_ROLE_META[suggestion.role] ?? { icon: "📸", label: suggestion.role };
    const priorityBadge = suggestion.priority === "high"
      ? `<span class="obs-shot-pri obs-shot-pri-high">必須級</span>`
      : `<span class="obs-shot-pri obs-shot-pri-medium">余裕があれば</span>`;
    return `<li class="obs-shot-item">
      <span class="obs-shot-role"><span class="obs-shot-icon">${meta.icon}</span>${escapeHtml(meta.label)}</span>
      <span class="obs-shot-target">${escapeHtml(friendlyObservationText(suggestion.target, 38))}</span>
      ${suggestion.rationale ? `<span class="obs-shot-rationale">${escapeHtml(friendlyObservationText(suggestion.rationale, 60))}</span>` : ""}
      ${priorityBadge}
    </li>`;
  }).join("") : "";
  return `<section class="obs-shot-card" aria-label="${escapeHtml(mediaCopy.shotAriaLabel)}">
    <div class="obs-shot-head">
      <div>
        <div class="obs-hint-eyebrow">${escapeHtml(mediaCopy.shotHeading)}</div>
        <p class="obs-hint-reminder">${escapeHtml(mediaCopy.shotReminder)}</p>
      </div>
    </div>
    ${coverageStrip}
    ${items ? `<ul class="obs-shot-list">${items}</ul>` : ""}
  </section>`;
}

function renderSubjectComparison(bundle: ObservationVisitBundle, subject: ObservationVisitSubject): string {
  if (!bundle.selectedRun && !bundle.previousRun) {
    return "";
  }
  const current = subject.aiAssessment;
  const previous = subject.previousAiAssessment;
  const currentText = current
    ? `${current.recommendedTaxonName ?? subject.displayName} / ${confidenceLabel(current.confidenceBand)}`
    : "今回はまだヒントがありません";
  const previousText = previous
    ? `${previous.recommendedTaxonName ?? subject.displayName} / ${confidenceLabel(previous.confidenceBand)}`
    : "前のヒントはまだありません";
  return `<details class="obs-fold">
    <summary>前の候補を見る <span class="obs-fold-count">確認中</span></summary>
    <div class="obs-hint-sub">
      <div class="obs-hint-eye">今回の見え方</div>
      <p>${escapeHtml(currentText)}</p>
      ${bundle.selectedRun ? `<p class="obs-hint-foot">自動メモ: ${escapeHtml(bundle.selectedRun.generatedAt)}</p>` : ""}
    </div>
    <div class="obs-hint-sub">
      <div class="obs-hint-eye">前の候補</div>
      <p>${escapeHtml(previousText)}</p>
      ${bundle.previousRun ? `<p class="obs-hint-foot">自動メモ: ${escapeHtml(bundle.previousRun.generatedAt)}</p>` : ""}
    </div>
  </details>`;
}

function renderAiCandidates(bundle: ObservationVisitBundle): string {
  if (bundle.aiCandidates.length === 0) {
    return "";
  }
  return `<details class="obs-fold">
    <summary>ほかの自動候補 <span class="obs-fold-count">${bundle.aiCandidates.length}</span></summary>
    <div class="obs-nearby-grid">
      ${bundle.aiCandidates.map((candidate) => `
        <div class="obs-nearby-card">
          <div class="obs-nearby-body">
            <div class="obs-nearby-name">${escapeHtml(candidate.displayName)}</div>
            <div class="obs-nearby-meta">${escapeHtml([
              publicRankHint(candidate.rank) || null,
              typeof candidate.confidence === "number" ? `${Math.round(candidate.confidence * 100)}%` : null,
              candidate.candidateStatus === "matched" && candidate.suggestedOccurrenceId ? "記録済み" : "候補",
            ].filter(Boolean).join(" · "))}</div>
            ${candidate.note ? `<p class="obs-id-note">${escapeHtml(candidate.note)}</p>` : ""}
          </div>
        </div>`).join("")}
    </div>
  </details>`;
}

function normalizeCandidateReadingKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function candidateReadingMap(bundle: ObservationVisitBundle): Map<string, CandidateReading> {
  const map = new Map<string, CandidateReading>();
  for (const subject of bundle.subjects) {
    for (const reading of subject.aiAssessment?.candidateReadings ?? []) {
      const keys = [reading.name, reading.scientificName].map(normalizeCandidateReadingKey).filter(Boolean);
      for (const key of keys) {
        if (!map.has(key)) map.set(key, reading);
      }
    }
  }
  return map;
}

function findCandidateReading(
  map: Map<string, CandidateReading>,
  names: Array<string | null | undefined>,
): CandidateReading | null {
  for (const name of names) {
    const hit = map.get(normalizeCandidateReadingKey(name));
    if (hit) return hit;
  }
  return null;
}

function fallbackCandidateReadingForSubject(options: {
  name: string;
  roleLabel?: string | null;
  rank?: string | null;
  focusReason?: string | null;
  simpleSummary?: string | null;
}): CandidateReading {
  const name = normalizeCandidateReadingKey(options.name);
  const focus = friendlyObservationText(options.focusReason || options.simpleSummary || "", 72);
  if (name.includes("ヒメイワダレソウ")) {
    return {
      name: options.name,
      scientificName: "",
      rank: null,
      role: "白い花の群落",
      visibleFeatures: [
        "地面を覆う低い群落が見えます。",
        "小さな白い花がまとまって咲いています。",
        "葉と茎が低く広がり、草地の面を作っています。",
      ],
      weakPoints: [
        "イワダレソウ類との比較には、花の集まりの長さ、葉の大きさ、葉のギザギザ、茎の毛が欲しいです。",
      ],
      shootingTips: [
        "花を真上と横から撮る",
        "葉の表裏と茎の毛を近くで撮る",
        "群落の広がり、裸地、草丈が入る引き写真を残す",
      ],
      regionalRead: "緑化で使われる植物が、道端や公園の小さな草地でどれくらい広がっているかを読む材料になります。",
    };
  }
  if (name.includes("アメリカシャクナゲ") || name.includes("カルミア") || name.includes("kalmia")) {
    return {
      name: options.name,
      scientificName: "Kalmia latifolia",
      rank: "species",
      role: "植栽の花",
      visibleFeatures: [
        "濃いピンクから淡いピンクの花がまとまって咲いています。",
        "皿形の花冠と、花の内側に入る雄しべの構造が見えます。",
        "低木状の枝ぶりと、厚みのある緑葉が同じ株に写っています。",
      ],
      weakPoints: [
        "品種や近い園芸植物まで見るには、花の正面、葉の表裏、枝先の付き方をもう少し近くで見たいです。",
      ],
      shootingTips: [
        "花を正面から撮り、雄しべの付き方を残す",
        "葉の表裏と枝先を近くで撮る",
        "株全体と周囲の植栽帯が分かる引き写真を残す",
      ],
      regionalRead: "浜松市の街なかの植栽として、開花の時期、管理された低木、足元のグランドカバーを一緒に読める記録です。",
    };
  }
  if (name.includes("ツルニチニチソウ") || name.includes("ツルニチソウ") || name.includes("vinca")) {
    return {
      name: options.name,
      scientificName: "Vinca major",
      rank: "species",
      role: "足元のグランドカバー",
      visibleFeatures: [
        "低木の足元に、斑入りの楕円形の葉が広がっています。",
        "葉が対になって付くように見え、地表を覆うグランドカバーとして読めます。",
      ],
      weakPoints: [
        "紫色の5裂花が写っていないため、ツルニチニチソウ類としては保留が残ります。",
        "ヒメツルニチニチソウとの比較には、葉の大きさ、葉縁、茎の毛、つるの伸び方が欲しいです。",
      ],
      shootingTips: [
        "花がある時期に、花を正面と横から撮る",
        "葉の大きさ、葉縁、斑入りの有無を近くで撮る",
        "茎が地面を這う様子と株元を撮る",
      ],
      regionalRead: "植栽帯の足元で低木と混じるグランドカバーとして、管理地の植物の重なりを読む材料になります。",
    };
  }
  if (name.includes("雑草群落") || name.includes("草本群落") || name.includes("草地")) {
    return {
      name: options.name,
      scientificName: "",
      rank: "lifeform",
      role: "周囲の草地",
      visibleFeatures: [
        "植栽の足元に、低い草本と裸地が混じって見えます。",
        "主役の花木だけでなく、管理された地表面の状態が同じ写真に残っています。",
      ],
      weakPoints: [
        "草の種類まで分けるには、葉の形、株元、花や穂が見える近景が必要です。",
      ],
      shootingTips: [
        "足元の草を真上から撮る",
        "葉、株元、花や穂があれば近くで撮る",
        "裸地、落ち葉、踏まれた場所が入る引き写真を残す",
      ],
      regionalRead: "街なかの植栽帯で、草が残る場所、裸地になる場所、人の手入れの強さを後から比べられます。",
    };
  }
  if (name.includes("背景の樹木") || name.includes("背景の木") || name.includes("樹木")) {
    return {
      name: options.name,
      scientificName: "",
      rank: "lifeform",
      role: "背景の木・植栽",
      visibleFeatures: [
        "花木の奥に、別の緑葉の樹木が写っています。",
        "植栽帯が単独の花木ではなく、複数の植物で構成されていることが分かります。",
      ],
      weakPoints: [
        "種類を絞るには、葉の形、枝の付き方、樹皮、花や実が見える写真が必要です。",
      ],
      shootingTips: [
        "葉の表裏と枝先を撮る",
        "幹や樹皮を近くで撮る",
        "花木との位置関係が分かる引き写真を残す",
      ],
      regionalRead: "背景の木も、街路や敷地の植栽構成を読む手がかりになります。花だけでなく場所の緑の層を残せます。",
    };
  }
  if (name.includes("セイヨウミツバチ") || name.includes("ミツバチ")) {
    return {
      name: options.name,
      scientificName: "",
      rank: null,
      role: "花に来た虫",
      visibleFeatures: [
        "白い花を利用している昆虫として読めます。",
        "植物だけでなく、花を使う相手まで同じ場面に残っています。",
      ],
      weakPoints: [
        "ニホンミツバチ、ハナバチ類、ハナアブ類と比べるには、腹部の帯、脚、翅、眼が見える横姿が欲しいです。",
      ],
      shootingTips: [
        "花に止まった横姿を撮る",
        "腹部の帯、脚の花粉、翅が見える1枚を残す",
        "どの花に来ていたか分かる引き写真も撮る",
      ],
      regionalRead: "花壇ではない足元の花も、虫にとって花資源になっている可能性を残せます。",
    };
  }
  if (name.includes("イネ科")) {
    return {
      name: options.name,
      scientificName: "",
      rank: null,
      role: "周囲の草",
      visibleFeatures: [
        "細い葉の草が、白い花の群落の周囲に混じっています。",
        "草丈や密度は、刈り取りや踏圧を読む手がかりになります。",
      ],
      weakPoints: [
        "種名まで進むには、小穂、葉舌、葉鞘、株元が見える写真が必要です。",
      ],
      shootingTips: [
        "小穂がある株を近くで撮る",
        "葉の付け根と株元を撮る",
        "花の群落との距離が分かる引き写真を残す",
      ],
      regionalRead: "背景の草ではなく、草地がどう管理され、どの植物が残っているかを示す情報になります。",
    };
  }

  const rankHint = publicRankHint(options.rank ?? null) || (options.rank ? rankLabelJa(options.rank) : null) || "候補";
  return {
    name: options.name,
    scientificName: "",
    rank: options.rank ?? null,
    role: options.roleLabel || rankHint,
    visibleFeatures: [
      focus || "写真内の形、色、写っている場所から候補として読んでいます。",
      `${rankHint}として扱えるところまで整理しています。`,
    ],
    weakPoints: [
      "細部が見える写真や、別角度の写真が増えると、似た相手との違いを確かめやすくなります。",
    ],
    shootingTips: [
      "全体が分かる引き写真",
      "形や模様が分かる近景",
      "周囲との位置関係が分かる写真",
    ],
    regionalRead: "場所、季節、周囲の環境が一緒に残るほど、同じ地域の記録と比べやすくなります。",
  };
}

const MAX_IDENTITY_EVIDENCE_TARGETS = 16;
const IDENTITY_EVIDENCE_SEARCH_THRESHOLD = 7;

function identityEvidenceSummary(input: {
  features: string[];
  weakPoints: string[];
  fallback?: string | null;
}): string {
  const feature = input.features.find((item) => item && !/候補|確認|可能性|読んでいます/.test(item));
  const weakPoint = input.weakPoints.find((item) => item && !/細部が見える写真/.test(item));
  if (feature && weakPoint) return `${feature.replace(/。$/u, "")}。ただし、${weakPoint.replace(/^ただし、?/u, "").replace(/。$/u, "")}。`;
  if (feature) return feature;
  return friendlyObservationText(input.fallback || "", 104);
}

function renderSubjectEvidenceTabs(options: {
  basePath: string;
  lang: SiteLang;
  visitId: string;
  bundle: ObservationVisitBundle;
}): string {
  const subjectIds = new Set(options.bundle.subjects.map((subject) => subject.occurrenceId));
  const identifyHref = appendLangToHref(withBasePath(options.basePath, `/observations/${encodeURIComponent(options.visitId)}#identify`), options.lang);
  const missingHref = appendLangToHref(withBasePath(options.basePath, `/observations/${encodeURIComponent(options.visitId)}#co-candidates`), options.lang);
  const readings = candidateReadingMap(options.bundle);
  const subjectTargets = options.bundle.subjects.map((subject) => {
    const ai = subject.aiAssessment;
    const display = formatTaxonDisplayName(subject, options.lang).primaryLabel;
    const reading = findCandidateReading(readings, [
      display,
      subject.displayName,
      subject.vernacularName,
      subject.scientificName,
      ai?.recommendedTaxonName,
      ai?.bestSpecificTaxonName,
    ]);
    const fallbackReading = fallbackCandidateReadingForSubject({
      name: display,
      roleLabel: subject.roleLabel,
      rank: subject.rank,
      focusReason: subject.focusReason,
      simpleSummary: ai?.simpleSummary ?? null,
    });
    const sourceReading = reading ?? fallbackReading;
    const features = (sourceReading.visibleFeatures?.length ? sourceReading.visibleFeatures : ai?.diagnosticFeaturesSeen ?? [])
      .map((item) => friendlyObservationText(item, 64))
      .filter(Boolean)
      .slice(0, 4);
    const shots = (reading?.shootingTips?.length
      ? reading.shootingTips
      : fallbackReading.shootingTips?.length
        ? fallbackReading.shootingTips
      : (ai?.shotSuggestions ?? []).map((item) => `${friendlyObservationText(item.target, 26)}: ${friendlyObservationText(item.rationale, 54)}`))
      .filter(Boolean)
      .slice(0, 4);
    const similar = (ai?.similarTaxa ?? [])
      .map((item) => item.name)
      .filter(Boolean)
      .slice(0, 3);
    const weakPoints = (sourceReading.weakPoints?.length
      ? sourceReading.weakPoints
      : similar.length > 0
        ? [`${similar.join("、")}。${friendlyObservationText((ai?.distinguishingTips ?? ai?.confirmMore ?? [])[0] ?? "", 80)}`]
        : [friendlyObservationText((ai?.missingEvidence ?? ai?.confirmMore ?? [])[0] ?? "近くで見える細部が増えると、候補を絞りやすくなります。", 92)])
      .map((item) => friendlyObservationText(item, 92))
      .filter(Boolean)
      .slice(0, 4);
    const regionalRead = sourceReading.regionalRead
      ? friendlyObservationText(sourceReading.regionalRead, 120)
      : friendlyObservationText(ai?.geographicContext || ai?.seasonalContext || "場所や季節の読みは、写真と地域情報が増えるほど強くなります。", 120);
    return {
      key: subject.occurrenceId,
      name: display,
      status: ai ? "写真からの仮説" : "確認待ち",
      summary: identityEvidenceSummary({
        features,
        weakPoints,
        fallback: ai?.narrative || ai?.stopReason || fallbackReading.visibleFeatures?.[0] || subject.focusReason,
      }),
      compareLabel: "比べたい相手",
      compareText: "",
      features,
      weakPoints,
      shots,
      regionalRead,
    };
  });
  const candidateTargets = options.bundle.aiCandidates
    .filter((candidate) => isOpenCandidate(candidate))
    .filter((candidate) => !candidate.suggestedOccurrenceId || !subjectIds.has(candidate.suggestedOccurrenceId))
    .slice(0, Math.max(0, MAX_IDENTITY_EVIDENCE_TARGETS - subjectTargets.length))
    .map((candidate) => {
      const reading = findCandidateReading(readings, [candidate.displayName, candidate.scientificName]);
      const fallbackReading = fallbackCandidateReadingForSubject({
        name: candidate.displayName,
        rank: candidate.rank,
        focusReason: candidate.note,
      });
      const sourceReading = reading ?? fallbackReading;
      const weakPoints = (sourceReading.weakPoints?.length
        ? sourceReading.weakPoints
        : [candidate.rank ? `${publicRankHint(candidate.rank) || rankLabelJa(candidate.rank)}までの候補です。位置や細部を人が確認すると扱いやすくなります。` : "写真内の位置や細部を人が確認すると扱いやすくなります。"])
        .map((item) => friendlyObservationText(item, 92))
        .filter(Boolean)
        .slice(0, 4);
      return {
        key: candidate.candidateId,
        name: candidate.displayName,
        status: "未検出候補",
        summary: identityEvidenceSummary({
          features: (sourceReading.visibleFeatures?.length ? sourceReading.visibleFeatures : [candidate.note || ""]).map((item) => friendlyObservationText(item, 64)).filter(Boolean),
          weakPoints,
          fallback: null,
        }),
        compareLabel: "比べたい相手",
        compareText: "",
        features: (sourceReading.visibleFeatures?.length ? sourceReading.visibleFeatures : [candidate.note || "同じ場面に写っている可能性があります。"]).map((item) => friendlyObservationText(item, 64)),
        weakPoints,
        shots: (sourceReading.shootingTips?.length ? sourceReading.shootingTips : ["対象が入る引き写真", "形が分かる近景", "周囲との位置関係"]).slice(0, 4),
        regionalRead: friendlyObservationText(sourceReading.regionalRead || "場所や季節の読みは、写真と地域情報が増えるほど強くなります。", 120),
      };
    });
  const targets = [...subjectTargets, ...candidateTargets].filter((target) => target.name);
  if (targets.length === 0) return "";
  const showCandidateSearch = targets.length >= IDENTITY_EVIDENCE_SEARCH_THRESHOLD;
  return `<section id="identity-evidence" class="section obs-layer obs-id-evidence" data-obs-section="identity_evidence">
    <div class="obs-identify-head">
      <div>
        <h2 class="obs-layer-title">同定の根拠</h2>
        <div class="obs-id-evidence-note">AIが写真から拾った仮説です。人の確認で強くなります。</div>
      </div>
    </div>
    ${showCandidateSearch ? `<label class="obs-id-filter">
      <input type="search" placeholder="候補名で絞り込み" autocomplete="off" data-obs-id-search>
      <span class="obs-id-filter-count" data-obs-id-visible-count>${targets.length}件</span>
    </label>` : ""}
    <div class="obs-id-tabs${showCandidateSearch ? " is-many" : ""}" role="tablist" aria-label="AI候補の同定根拠">
      ${targets.map((target, index) => {
        const searchText = [target.name, target.status, target.summary, target.compareText, ...target.features, ...target.weakPoints]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return `<button class="obs-id-tab" type="button" role="tab" aria-selected="${index === 0 ? "true" : "false"}" aria-controls="obs-id-panel-${index}" id="obs-id-tab-${index}" data-obs-id-tab="${escapeHtml(String(index))}" data-obs-id-search-text="${escapeHtml(searchText)}">${escapeHtml(target.name)}</button>`;
      }).join("")}
    </div>
    <div class="obs-id-empty" data-obs-id-empty hidden>該当する候補がありません</div>
    ${targets.map((target, index) => `<article class="obs-id-panel" id="obs-id-panel-${index}" role="tabpanel" aria-labelledby="obs-id-tab-${index}" data-obs-id-panel="${escapeHtml(String(index))}"${index === 0 ? "" : " hidden"}>
      <div class="obs-id-summary">
        <span class="obs-id-status-pill">${escapeHtml(target.status)}</span>
        ${target.summary ? `<p>${escapeHtml(target.summary)}</p>` : ""}
        ${target.compareText ? `<div class="obs-id-compare">
          <strong>${escapeHtml(target.compareLabel)}</strong>
          <span>${escapeHtml(target.compareText)}</span>
        </div>` : ""}
      </div>
      <div class="obs-id-evidence-grid">
        <div class="obs-id-evidence-card">
          <h3>見えている特徴</h3>
          <ul class="obs-id-evidence-list">${(target.features.length > 0 ? target.features : ["この写真から拾った候補です。"]).map((item, itemIndex) => `<li><b>${itemIndex + 1}</b><span>${escapeHtml(item)}</span></li>`).join("")}</ul>
        </div>
        <div class="obs-id-evidence-card">
          <h3>弱い点</h3>
          <ul class="obs-id-evidence-list">${(target.weakPoints.length > 0 ? target.weakPoints : [target.compareText]).map((item, itemIndex) => `<li><b>${itemIndex + 1}</b><span>${escapeHtml(item)}</span></li>`).join("")}</ul>
        </div>
        <div class="obs-id-evidence-card">
          <h3>詳しくする撮り方</h3>
          <ul class="obs-id-shot-list">${(target.shots.length > 0 ? target.shots : ["全体が分かる引き写真", "形が分かる近景", "周囲との関係"]).map((item, itemIndex) => `<li><b>${itemIndex + 1}</b><span>${escapeHtml(item)}</span></li>`).join("")}</ul>
        </div>
        <div class="obs-id-evidence-card">
          <h3>地域との読み</h3>
          <p>${escapeHtml(target.regionalRead)}</p>
        </div>
      </div>
      <div class="obs-id-actions" aria-label="${escapeHtml(`${target.name}への同定アクション`)}">
        <div class="obs-id-vote">
          <a class="obs-id-action is-primary" href="${escapeHtml(identifyHref)}">${escapeHtml(target.name)}を支持</a>
          <a class="obs-id-action" href="${escapeHtml(identifyHref)}">証拠不足で保留</a>
          <a class="obs-id-action" href="${escapeHtml(identifyHref)}">別名を提案</a>
        </div>
        <div class="obs-id-missing">
          <a class="obs-id-action is-add" href="${escapeHtml(missingHref)}">別の写り込みを追加</a>
        </div>
      </div>
    </article>`).join("")}
  </section>
  <script>(function(){
    var root = document.getElementById('identity-evidence');
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[data-obs-id-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-obs-id-panel]'));
    var search = root.querySelector('[data-obs-id-search]');
    var count = root.querySelector('[data-obs-id-visible-count]');
    var empty = root.querySelector('[data-obs-id-empty]');
    function selectTab(tab){
      if (!tab) return;
      var target = tab.getAttribute('data-obs-id-tab') || '';
      tabs.forEach(function(item){
        item.setAttribute('aria-selected', String(item === tab));
      });
      panels.forEach(function(panel){
        panel.hidden = panel.getAttribute('data-obs-id-panel') !== target;
      });
    }
    function applyFilter(){
      if (!search) return;
      var query = (search.value || '').trim().toLowerCase();
      var visible = [];
      tabs.forEach(function(tab){
        var haystack = tab.getAttribute('data-obs-id-search-text') || tab.textContent || '';
        var matches = !query || haystack.toLowerCase().indexOf(query) !== -1;
        tab.hidden = !matches;
        if (matches) visible.push(tab);
      });
      if (count) count.textContent = visible.length + '件';
      if (empty) {
        empty.hidden = visible.length !== 0;
        empty.classList.toggle('is-visible', visible.length === 0);
      }
      var selected = tabs.find(function(tab){ return tab.getAttribute('aria-selected') === 'true'; });
      if (!selected || selected.hidden) {
        if (visible[0]) {
          selectTab(visible[0]);
        } else {
          panels.forEach(function(panel){ panel.hidden = true; });
        }
      }
    }
    root.addEventListener('click', function(event){
      var tab = event.target instanceof Element ? event.target.closest('[data-obs-id-tab]') : null;
      selectTab(tab);
    });
    if (search) search.addEventListener('input', applyFilter);
  })();</script>`;
}

function renderSubjectTaxonomy(
  subject: ObservationVisitSubject,
  featuredSubject: ObservationVisitSubject | null,
  subjectCount: number,
  bundle: ObservationVisitBundle,
): string {
  const subjectDisplay = formatTaxonDisplayName(subject, "ja");
  const featuredDisplay = featuredSubject ? formatTaxonDisplayName(featuredSubject, "ja") : null;
  const lineageChips = subject.lineage.length > 0
    ? `<div class="obs-lineage">
         ${subject.lineage.map((lineage) => `<span class="obs-lineage-item"><small>${escapeHtml(publicRankHint(lineage.rank) || rankLabelJa(lineage.rank))}</small>${escapeHtml(lineage.name)}</span>`).join('<span class="obs-lineage-sep">›</span>')}
       </div>`
    : "";
  const layer2Title = "名前の記録";
  const layer2Note = featuredSubject && subject.occurrenceId !== featuredSubject.occurrenceId
    ? `<p class="obs-layer-note">いまは <strong>${escapeHtml(subjectDisplay.primaryLabel)}</strong> を見ています。最初に見る候補は <strong>${escapeHtml(featuredDisplay?.primaryLabel ?? featuredSubject.displayName)}</strong> ですが、上のカードから切り替えられます。</p>`
    : bundle.lockedByHuman
      ? `<p class="obs-layer-note">この表示は、人の確認を優先して固定しています。</p>`
      : "";
  const idsList = subject.identifications.length > 0
    ? `<ul class="obs-id-list">
         ${subject.identifications.map((item) => `
           <li class="obs-id-item">
             <div class="obs-id-avatar">${escapeHtml((formatActorDisplay(item.actorName, "ja") || "?").slice(0, 1))}</div>
             <div class="obs-id-body">
               <div class="obs-id-line">
                 <span class="obs-id-name">${escapeHtml(item.proposedName)}</span>
                 ${item.proposedRank ? `<span class="obs-id-rank">${escapeHtml(publicRankHint(item.proposedRank) || rankLabelJa(item.proposedRank))}</span>` : ""}
                 ${item.acceptedRank ? `<span class="obs-id-accepted">✓ ${escapeHtml(rankLabelJa(item.acceptedRank))}で確定</span>` : ""}
               </div>
               <div class="obs-id-meta">${escapeHtml(formatActorDisplay(item.actorName, "ja"))} · ${escapeHtml(item.createdAt)}</div>
               ${item.notes ? `<p class="obs-id-note">${escapeHtml(item.notes)}</p>` : ""}
             </div>
           </li>`).join("")}
        </ul>`
    : `<p class="obs-empty">人の同定はまだありません。自動候補は確定名ではありません。</p>`;
  return `
    <section class="section obs-layer obs-layer-2">
      <h2 class="obs-layer-title">${layer2Title}</h2>
      ${layer2Note}
      ${lineageChips}
      ${idsList}
      ${renderSubjectComparison(bundle, subject)}
      ${renderAiCandidates(bundle)}
    </section>`;
}

function renderIdentificationParticipation(options: {
  basePath: string;
  lang: SiteLang;
  snapshot: NonNullable<Awaited<ReturnType<typeof getObservationDetailSnapshot>>>;
  subject?: ObservationVisitSubject;
  mediaContext?: ObservationMediaCopyContext;
  consensus: IdentificationConsensusResult | null;
  viewerSession: SessionSnapshot | null;
  canUseSpecialistWorkbench: boolean;
  referenceCandidates?: ReferenceCandidate[];
}): string {
  const { basePath, snapshot, consensus, viewerSession } = options;
  const snapshotDisplay = formatTaxonDisplayName(snapshot, "ja");
  const community = consensus?.communityTaxon;
  const currentConsensus = community
    ? `${community.name}（${rankLabelJa(community.rank)}、${community.supporterCount}名 / ${Math.round(community.supportRatio * 100)}%）`
    : "まだみんなの見方はそろっていません";
  const targetLabel = snapshotDisplay.primaryLabel;
  const needed = consensus?.neededEvidence.length
    ? consensus.neededEvidence
    : ["名前の提案や理由メモが1件あると、見方を比べやすくなります"];
  const neededList = needed.map((item) => softenActionCueText(item, 74)
    .replace(/を少なくとも1件追加する/u, "が1件あると、見方を比べやすくなります")
    .replace(/を追加する/u, "があると、見方を比べやすくなります")
    .replace(/する$/u, "できると助かります"));
  const openDisputeCount = snapshot.disputes.filter((item) => item.status === "open").length;
  const isCommunitySubjectProposal = options.subject?.subjectSource === "community_subject_proposal";
  const proposalSceneNoun = mediaSceneNoun(options.mediaContext ?? photoOnlyMediaContext());
  const proposalTrustBlock = isCommunitySubjectProposal
    ? `<div class="obs-proposal-trust" data-subject-proposal-trust>
        <div>
          <div class="obs-story-eyebrow">この${escapeHtml(proposalSceneNoun)}からの提案</div>
          <p>投稿者の正式な主張ではありません。投稿者には通知され、見た人は名前・反対意見・証拠不足をここで足せます。</p>
        </div>
        <div class="obs-proposal-trust-grid">
          <div class="obs-proposal-trust-stat"><span>名前の提案</span><strong>${escapeHtml(`${snapshot.identifications.length}件`)}</strong></div>
          <div class="obs-proposal-trust-stat"><span>別の見方</span><strong>${escapeHtml(openDisputeCount > 0 ? `${openDisputeCount}件あり` : "まだなし")}</strong></div>
          <div class="obs-proposal-trust-stat"><span>状態</span><strong>${escapeHtml(consensusStatusLabel(consensus?.consensusStatus))}</strong></div>
        </div>
        ${viewerSession
          ? `<div class="obs-proposal-trust-actions">
              <button type="button" data-proposal-focus="support">合っていそう</button>
              <button type="button" data-proposal-focus="alternative">別の名前かも</button>
              <button type="button" data-proposal-focus="needs_more_evidence">もっと証拠がいる</button>
            </div>`
          : `<p>ログインすると、この提案に名前や理由を足せます。</p>`}
      </div>`
    : "";
  const defaultName = snapshot.scientificName || (snapshotDisplay.isAwaitingId ? "" : snapshotDisplay.primaryLabel);
  const defaultRank = snapshot.scientificName ? "species" : "";
  const endpointId = encodeURIComponent(snapshot.occurrenceId);
  const identifyEndpoint = withBasePath(basePath, `/api/v1/observations/${endpointId}/identifications`);
  const disputeEndpoint = withBasePath(basePath, `/api/v1/observations/${endpointId}/disputes`);
  const aiReviewEndpoint = withBasePath(basePath, `/api/v1/observation-records/${endpointId}/ai-review`);
  const specialistHref = withBasePath(basePath, `/specialist/id-workbench?occurrenceId=${endpointId}`);
  const isAiJudgement = snapshot.aiAssessmentStatus === "ai_judgement";
  const aiReviewStateLabel = snapshot.aiReviewAgreeCount > 0 && snapshot.aiReviewDisagreeCount > 0
    ? "確認が割れています"
    : snapshot.aiReviewAgreeCount > 0
      ? "みんなで確認"
      : snapshot.aiReviewDisagreeCount > 0
        ? "違う意見あり"
        : "AI推定";
  const aiReviewBlock = isAiJudgement
    ? `<div class="obs-ai-review" data-ai-review-panel data-ai-review-endpoint="${escapeHtml(aiReviewEndpoint)}">
        <div class="obs-ai-review-head">
          <div>
            <div class="obs-ai-review-kicker">自動で作った候補</div>
            <div class="obs-ai-review-title">写真から「これかもしれない」として残した段階です</div>
          </div>
          <span class="obs-ai-review-badge">${escapeHtml(aiReviewStateLabel)}</span>
        </div>
        <p class="obs-ai-review-copy">確定名ではありません。見えている特徴が合っているか、人が正誤判定すると、この観察レコードの信頼度が上がります。</p>
        <div class="obs-ai-review-counts">
          <span>合ってる ${snapshot.aiReviewAgreeCount}件</span>
          <span>違う ${snapshot.aiReviewDisagreeCount}件</span>
        </div>
        ${viewerSession
          ? `<div class="obs-ai-review-actions">
              <button type="button" class="btn btn-solid" data-ai-review-state="agree">合ってる</button>
              <button type="button" class="btn secondary" data-ai-review-state="disagree">違う</button>
              <button type="button" class="btn secondary" data-ai-review-state="later">あとで</button>
            </div>
            <div class="obs-ai-review-status" data-ai-review-status>候補を確認できます。</div>`
          : `<div class="obs-identify-login"><strong>ログインすると候補を確認できます。</strong><p>見るだけならこのまま使えます。</p></div>`}
      </div>`
    : "";
  const disputes = snapshot.disputes.length > 0
    ? `<div class="obs-dispute-list">
        ${snapshot.disputes.map((item) => `
          <div class="obs-dispute-item${item.status === "open" ? " is-open" : ""}">
            <div class="obs-dispute-top">
              <strong>${escapeHtml(item.kind === "alternative_id" ? "別の名前の提案" : item.kind === "needs_more_evidence" ? "証拠が足りない" : item.kind)}</strong>
              <span>${escapeHtml(item.status)}</span>
            </div>
            ${item.proposedName ? `<div class="obs-dispute-name">${escapeHtml(item.proposedName)}${item.proposedRank ? ` · ${escapeHtml(publicRankHint(item.proposedRank) || rankLabelJa(item.proposedRank))}` : ""}</div>` : ""}
            ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
            <div class="obs-id-meta">${escapeHtml(formatActorDisplay(item.actorName, "ja"))} · ${escapeHtml(item.createdAt)}</div>
          </div>`).join("")}
       </div>`
    : `<p class="obs-empty">別の見方はまだありません。別の名前や、もっと証拠がいることに気づいたら、ここから記録できます。</p>`;

  const rankValue = `<input name="proposedRank" type="hidden" value="${escapeHtml(defaultRank)}" />`;
  const referenceCandidates = options.referenceCandidates ?? [];
  const referencePicker = viewerSession
    ? `<div class="obs-reference-picker">
        <div class="obs-reference-picker-head">
          <strong>参照資料を選ぶ</strong>
          <a href="${escapeHtml(withBasePath(basePath, "/references/capture"))}">資料を登録</a>
        </div>
        ${referenceCandidates.length > 0
          ? `<div class="obs-reference-options">
              ${referenceCandidates.slice(0, 6).map((candidate) => `<label class="obs-reference-option">
                <input type="checkbox" name="referenceSourceIds" value="${escapeHtml(candidate.sourceId)}" ${candidate.owned ? "checked" : ""} />
                <span>
                  ${escapeHtml(candidate.title)}
                  <small>${escapeHtml([
                    candidate.reason,
                    candidate.owned ? "所有確認済み" : "共有カタログ",
                    candidate.taxonLabels.slice(0, 3).join(" / "),
                    candidate.usedCount > 0 ? `過去に${candidate.usedCount}回使用` : "",
                  ].filter(Boolean).join(" · "))}</small>
                </span>
              </label>`).join("")}
            </div>`
          : `<p class="obs-empty">この分類群の参照資料はまだありません。</p>`}
        <label class="obs-reference-locator"><span>ページ・図版番号</span><input name="referenceLocator" type="text" maxlength="160" placeholder="例: p.42 / 図3 / 検索ページ" /></label>
      </div>`
    : "";
  const form = viewerSession
    ? `<form class="obs-identify-form" data-identify-form data-identify-endpoint="${escapeHtml(identifyEndpoint)}" data-dispute-endpoint="${escapeHtml(disputeEndpoint)}">
        <div class="obs-identify-fields">
          <label><span>提案する名前</span><input name="proposedName" type="text" value="${escapeHtml(defaultName)}" placeholder="例: モンシロチョウ / 白いチョウの仲間" /></label>
          ${rankValue}
          <label class="is-wide"><span>理由メモ</span><textarea name="notes" rows="3" placeholder="見えた形、似ている種類との違い、追加でほしい写真など"></textarea></label>
        </div>
        ${referencePicker}
        <div class="obs-identify-actions">
          <button type="button" class="btn btn-solid" data-identify-action="support">この名前だと思う</button>
          <button type="button" class="btn secondary" data-identify-action="alternative">別の名前だと思う</button>
          <button type="button" class="btn secondary" data-identify-action="needs_more_evidence">証拠が足りない</button>
          <button type="button" class="btn secondary" data-identify-action="note">根拠メモを追加</button>
        </div>
        <div class="obs-identify-status" data-identify-status>Ready.</div>
      </form>`
    : `<div class="obs-identify-login">
        <strong>書き込むにはログインが必要です。</strong>
        <p>見るだけならこのまま使えます。</p>
       </div>`;

  void currentConsensus;
  void neededList;
  void proposalTrustBlock;
  void aiReviewBlock;
  const newRecordHref = appendLangToHref(withBasePath(basePath, "/record"), options.lang);
  const candidateStatus = snapshot.identifications.length > 0 ? "確認あり" : "確定前";
  const candidateActions = [
    { label: "この候補に同意", className: " is-primary", reviewState: "agree", focus: null },
    { label: "名前を修正", className: "", reviewState: null, focus: "alternative" },
    { label: "まだ決めない", className: "", reviewState: null, focus: "needs_more_evidence" },
  ];
  const actionButtons = candidateActions.map((action) => {
    const label = escapeHtml(action.label);
    if (viewerSession && isAiJudgement) {
      const reviewAttr = action.reviewState ? ` data-ai-review-state="${escapeHtml(action.reviewState)}"` : "";
      const focusAttr = action.focus ? ` data-proposal-focus="${escapeHtml(action.focus)}"` : "";
      return `<button type="button" class="obs-ai-action${action.className}"${reviewAttr}${focusAttr}>${label}</button>`;
    }
    return `<a class="obs-ai-action${action.className}" href="#identify">${label}</a>`;
  }).join("");

  return `<section id="identify" class="obs-frame-identify-card"${isAiJudgement ? ` data-ai-review-panel data-ai-review-endpoint="${escapeHtml(aiReviewEndpoint)}"` : ""}>
    <div class="obs-frame-identify-top">
      <div class="obs-frame-identify-copy">
        <div class="obs-frame-identify-eye">名前を確かめる</div>
        <h2 class="obs-frame-identify-title">AI候補をどう扱うか</h2>
        <p>下の3つは、選択中のAI候補への判断です。別の生きもの・環境を追加する場合は別レコードにします。</p>
      </div>
      <a class="obs-frame-identify-new" href="${escapeHtml(newRecordHref)}">別レコードを追加</a>
    </div>
    <div class="obs-frame-candidate-switch">
      <div class="obs-frame-candidate-meter"><span>AI候補</span><strong>1/1</strong></div>
      <div class="obs-frame-identify-candidates" aria-label="AI候補">
        <button class="obs-frame-candidate" type="button" aria-pressed="true">${escapeHtml(targetLabel)}<span>${escapeHtml(candidateStatus)}</span></button>
      </div>
    </div>
    <div class="obs-ai-actions" aria-label="${escapeHtml(`${targetLabel}候補への判断`)}">
      <div class="obs-ai-actions-label">${escapeHtml(`${targetLabel}候補への操作`)}</div>
      <div class="obs-ai-action-row">${actionButtons}</div>
      <div class="obs-identify-muted">${viewerSession ? "理由を残す場合は下を開いて入力できます。" : "ログインすると判断と理由を残せます。見るだけならこのまま使えます。"}</div>
      ${viewerSession && isAiJudgement ? `<div class="obs-ai-review-status" data-ai-review-status>候補を確認できます。</div>` : ""}
    </div>
    <p class="obs-frame-identify-add-note">${escapeHtml(`${targetLabel}以外も写っている、または未レコードの対象がある場合は「別レコードを追加」から分けて残します。`)}</p>
    <details class="obs-fold obs-identify-fold">
      <summary>この候補への理由を書く</summary>
      <div class="obs-identify-split">
        <div>
          <h3>別の見方</h3>
          ${disputes}
        </div>
        <div>
          <h3>入力</h3>
          ${form}
          ${options.canUseSpecialistWorkbench
            ? `<a class="obs-specialist-link" href="${escapeHtml(specialistHref)}">specialist batch review で開く</a>`
            : ""}
        </div>
      </div>
    </details>
  </section>`;
}

type ObservationNextAction = {
  href: string;
  label: string;
  body: string;
  key: string;
  primary?: boolean;
};

function renderObservationSummaryStrip(options: {
  displayName: string;
  observedAt: string;
  placeLabel: string;
  observerDisplay: string;
  trustStageLabel: string;
  subjectCount: number;
  mediaCount: number;
}): string {
  void options;
  return "";
}

function observationEvidenceLabel(snapshot: ObservationDetailSnapshot): string {
  const parts = [
    snapshot.photoAssets.length > 0 ? `写真 ${snapshot.photoAssets.length}枚` : "",
    snapshot.videoAssets.length > 0 ? `動画 ${snapshot.videoAssets.length}本` : "",
    snapshot.audioAssets.length > 0 ? `音 ${snapshot.audioAssets.length}件` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "メディアはまだありません";
}

function observationRecordModeLabel(snapshot: ObservationDetailSnapshot): string {
  if (snapshot.visitMode === "survey" || snapshot.recordMode === "survey") {
    return snapshot.surveyResult === "no_detection_note" ? "見つからなかったメモ" : "調べながら残した記録";
  }
  if (snapshot.videoAssets.length > 0 && snapshot.photoAssets.length === 0) return "動画で残した記録";
  if (snapshot.note && snapshot.photoAssets.length === 0 && snapshot.videoAssets.length === 0) return "メモの記録";
  return "見つけたものの記録";
}

function renderObservationMediaLedger(snapshot: ObservationDetailSnapshot, sameAreaCount: number): string {
  const photoCount = snapshot.photoAssets?.length ?? 0;
  const videoCount = snapshot.videoAssets?.length ?? 0;
  const audioCount = snapshot.audioAssets?.length ?? 0;
  const sameAreaItem = sameAreaCount > 0
    ? `<a class="obs-media-ledger-item" href="#place" aria-label="同じエリアの投稿一覧へ移動"><strong>同エリア</strong><span>${escapeHtml(`${sameAreaCount}件`)}</span><small>投稿一覧へ</small></a>`
    : `<div class="obs-media-ledger-item"><strong>同エリア</strong><span>0件</span><small>近隣なし</small></div>`;
  const items = [
    `<div class="obs-media-ledger-item"><strong>写真</strong><span>${escapeHtml(`${photoCount}枚`)}</span><small>${escapeHtml(photoCount > 0 ? "記録あり" : "未記録")}</small></div>`,
    `<div class="obs-media-ledger-item"><strong>動画</strong><span>${escapeHtml(`${videoCount}本`)}</span><small>${escapeHtml(videoCount > 0 ? "動きあり" : "未記録")}</small></div>`,
    `<div class="obs-media-ledger-item"><strong>音</strong><span>${escapeHtml(`${audioCount}件`)}</span><small>${escapeHtml(audioCount > 0 ? "音声あり" : "未記録")}</small></div>`,
    sameAreaItem,
  ];
  return `<div class="obs-media-ledger" aria-label="メディア台帳">${items.join("")}</div>`;
}

function seasonPhraseFromObservedAt(observedAt: string): string {
  const date = new Date(observedAt);
  if (!Number.isFinite(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const ten = day <= 10 ? "上旬" : day <= 20 ? "中旬" : "下旬";
  return `${month}月${ten}`;
}

function renderObservationRecordInsightText(options: {
  snapshot: ObservationDetailSnapshot;
  subject: ObservationVisitSubject;
  recordItems: VisibleRecordItem[];
  placeLabel: string;
}): string {
  const subjectName = options.subject.aiAssessment?.recommendedTaxonName || options.subject.displayName || "名前を確認中の対象";
  const text = `${subjectName} ${options.subject.scientificName ?? ""} ${options.recordItems.map((item) => `${item.displayName} ${item.roleLabel} ${item.note ?? ""}`).join(" ")}`;
  const place = options.placeLabel || options.snapshot.municipality || options.snapshot.publicLocation?.label || "この場所";
  const season = seasonPhraseFromObservedAt(options.snapshot.observedAt);
  const hasLowGrass = /低い草丈|草地|草|イネ科|芝/.test(text);
  const envParts = [
    /裸地/.test(text) ? "裸地" : "",
    /礫|砂礫/.test(text) ? "礫" : "",
    /踏圧|踏まれ/.test(text) ? "踏圧" : "",
  ].filter(Boolean);
  const isBird = /鳥|カワラヒワ|スズメ|ハト|鳩|カラス|aves|bird/i.test(text);
  const isPlant = /植物|草|花|葉|茎|イネ科|poaceae|plant/i.test(text);
  if (isBird && (hasLowGrass || envParts.length > 0)) {
    const foot = [hasLowGrass ? "低い草丈" : "", envParts.length > 0 ? `${envParts.join("・")}が混じる足元` : "足元"].filter(Boolean).join("と");
    return `${subjectName}らしい鳥が、${foot}の近くに写っています。周辺・環境としては${envParts.length > 0 ? envParts.join("・") : "草地の状態"}が読み取れ、${place}${season ? `の草地・${season}` : "の草地"}という条件も、分布や季節感として自然です。踏まれた感じのある草地を季節ごとに重ねて見ると、花の量、虫の来方、草地の保たれ方が地域の変化として見えてきます。`;
  }
  if (isPlant) {
    return `${subjectName}らしい植物が、周囲の草や足元の状態と一緒に写っています。名前だけでなく、どこに生え、どのくらい広がり、まわりの裸地や草地とどう接しているかが残る記録です。${place}${season ? `・${season}` : ""}の同じエリアで重ねて見ると、花の量や草地の保たれ方の変化を比べられます。`;
  }
  return `${subjectName}らしい対象が、まわりの状態と一緒に残っています。名前だけでなく、${place}${season ? `・${season}` : ""}にどんな場面として現れていたかを後から読み返せる記録です。`;
}

function renderObservationRecordInsight(text: string, className = ""): string {
  return `<div class="obs-record-insight${className ? ` ${className}` : ""}" aria-label="この記録から言えること"><p>${escapeHtml(text)}</p></div>`;
}

function renderObservationUseStatus(snapshot: ObservationDetailSnapshot, consensus: IdentificationConsensusResult | null): string {
  const humanLabel = snapshot.identifications.length > 0 || consensus?.communityTaxon ? "人の確認あり" : "人の確認待ち";
  const statusLabel = consensus?.hasOpenDispute ? "確認中" : snapshot.aiAssessmentStatus === "ai_judgement" ? "確定前" : verificationStatusLabel(consensus?.identificationVerificationStatus);
  const useLabel = snapshot.photoAssets.length + snapshot.videoAssets.length + snapshot.audioAssets.length > 0 ? "使える範囲: 場面メモ" : "使える範囲: メモ";
  return `<div class="obs-record-use-status" aria-label="この記録の使える範囲">
    <span>${escapeHtml(statusLabel)}</span>
    <span>${escapeHtml(snapshot.aiAssessmentStatus === "ai_judgement" ? "AI推定" : "名前確認")}</span>
    <span>${escapeHtml(humanLabel)}</span>
    <span>${escapeHtml(useLabel)}</span>
  </div>`;
}

function nearbyRecordBadge(displayName: string): { label: string; className: string } {
  if (/同定待ち|名前待ち|未同定/.test(displayName)) return { label: "名前待ち", className: "" };
  if (/イネ科|植物|草|花|葉|木|樹|plant|poaceae/i.test(displayName)) return { label: "草地", className: " is-plant" };
  return { label: "同エリア", className: "" };
}

function nearbyRecordReason(displayName: string): string {
  if (/イネ科|植物|草|花|葉|木|樹|plant|poaceae/i.test(displayName)) {
    return "鳥がいた足元の環境と比べて見られます。";
  }
  if (/同定待ち|名前待ち|未同定/.test(displayName)) {
    return "この場所で、まだ名前が決まっていない写り込みです。";
  }
  return "同じエリアの別の場面として続けて見られます。";
}

function renderNearbyAreaRecords(options: {
  basePath: string;
  lang: SiteLang;
  placeLabel: string;
  nearby: NearbyObservation[];
}): string {
  if (options.nearby.length === 0) return "";
  const dates = Array.from(new Set(
    options.nearby
      .map((item) => formatShortDate(item.observedAt, options.lang === "ja" ? "ja-JP" : "en-US") || item.observedAt)
      .filter(Boolean),
  )).slice(0, 3);
  const place = options.placeLabel || "同じエリア";
  const lead = dates.length > 0
    ? `${dates.join("・")}の近い投稿です。鳥だけで終わらず、同じ草地まわりの写り方を続けて見られます。`
    : "近い投稿を続けて見ると、この場所で何が一緒に写るかを比べやすくなります。";
  const cards = options.nearby.slice(0, 6).map((item) => {
    const href = appendLangToHref(
      withBasePath(options.basePath, buildObservationDetailPath(item.visitId, item.occurrenceId)),
      options.lang,
    );
    const thumb = item.photoUrl ? (toThumbnailUrl(item.photoUrl, "sm") ?? item.photoUrl) : null;
    const badge = nearbyRecordBadge(item.displayName);
    return `<a class="obs-nearby-card" href="${escapeHtml(href)}">
      ${thumb
        ? `<img class="obs-area-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(item.displayName)}" loading="lazy" decoding="async" onerror="this.outerHTML='&lt;div class=&quot;obs-nearby-nophoto&quot;&gt;📷&lt;/div&gt;'" />`
        : '<div class="obs-nearby-nophoto">📷</div>'}
      <div class="obs-nearby-body">
        <div class="obs-nearby-title-row">
          <div class="obs-nearby-name">${escapeHtml(item.displayName)}</div>
          <span class="obs-nearby-badge${escapeHtml(badge.className)}">${escapeHtml(badge.label)}</span>
        </div>
        <div class="obs-nearby-reason">${escapeHtml(nearbyRecordReason(item.displayName))}</div>
        <div class="obs-nearby-meta">${escapeHtml(item.observerName)} · ${escapeHtml(formatShortDate(item.observedAt, options.lang === "ja" ? "ja-JP" : "en-US") || item.observedAt)}</div>
      </div>
    </a>`;
  }).join("");
  return `<section id="place" class="section obs-layer obs-layer-3 obs-area-records" data-obs-section="place">
    <div class="obs-area-records-head">
      <div>
        <div class="obs-area-records-eye">次に見るなら</div>
        <h2 class="obs-layer-title">${escapeHtml(`${place}をもう少し見る`)}</h2>
        <p>${escapeHtml(lead)}</p>
      </div>
      <span class="obs-area-count">${escapeHtml(`${options.nearby.length}件`)}</span>
    </div>
    <div class="obs-nearby-grid">${cards}</div>
  </section>`;
}

function aiJudgementStateLabel(input: {
  aiAssessmentStatus?: string | null;
  aiReviewAgreeCount?: number | null;
  aiReviewDisagreeCount?: number | null;
  identificationCount?: number | null;
}): string | null {
  if (input.aiAssessmentStatus !== "ai_judgement") return null;
  const agree = Number(input.aiReviewAgreeCount ?? 0);
  const disagree = Number(input.aiReviewDisagreeCount ?? 0);
  if (agree > 0 && disagree > 0) return "確認が割れています";
  if (agree > 0 || Number(input.identificationCount ?? 0) > 0) return "みんなで確認";
  if (disagree > 0) return "違う意見あり";
  return "AI推定";
}

function renderObservationRecordStory(options: {
  snapshot: ObservationDetailSnapshot;
  subject: ObservationVisitSubject;
  recordItems: VisibleRecordItem[];
  siteBrief: SiteBrief | null;
  regionalStory: RegionalStoryCue | null;
  civicContext: CivicObservationContext | null;
  mediaContext: ObservationMediaCopyContext;
}): string {
  const recordSceneParts = options.recordItems
    .map((item) => {
      if (/ハチ|蜂|bee/i.test(item.displayName) || /訪花/.test(item.roleLabel) || /訪花/.test(item.note ?? "")) return "訪花中のハチ";
      if (/イネ科|草|芝|poaceae/i.test(item.displayName) || /草/.test(item.roleLabel)) return "周囲の草地";
      if (/花|葉|群落|地面|茎|ヒメイワダレソウ|イワダレソウ/.test(item.displayName) || /花|群落/.test(item.note ?? "")) return "足元の白い花";
      return item.source === "candidate" ? "同じ場面の候補" : "見つけたもの";
    })
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 3);
  const hasBee = recordSceneParts.some((name) => /ハチ|蜂|bee/i.test(name));
  const hasMultipleRecords = options.recordItems.length >= 2;
  const place = options.snapshot.municipality || options.snapshot.placeName || options.snapshot.publicLocation?.label || "この場所";
  const sceneNoun = mediaSceneNoun(options.mediaContext);
  const subjectLabel = formatTaxonDisplayName(options.subject, "ja").primaryLabel;
  const allRecordText = options.recordItems.map((item) => `${item.displayName} ${item.roleLabel} ${item.note ?? ""}`).join(" ");
  const isKalmiaScene = /アメリカシャクナゲ|カルミア|kalmia/i.test(`${subjectLabel} ${allRecordText}`);
  const hasGroundCover = /ツルニチニチソウ|ツルニチソウ|グランドカバー|斑入り/i.test(allRecordText);
  const hasManagedGround = /雑草|草地|裸地|礫|踏圧|植栽/i.test(allRecordText);
  const storyCards = isKalmiaScene
    ? [
        {
          title: "満開の植栽低木",
          body: "花だけを切り出すのではなく、低木の株全体、花の密度、周囲の植栽との重なりが残っています。園芸植物がその場所でどう見えていたかを読み返せる記録です。",
        },
        {
          title: hasGroundCover ? "株元を覆う植物" : "足元の植栽",
          body: hasGroundCover
            ? "主役の下に斑入りの葉をもつグランドカバーが広がり、花木と地表を覆う植物が同じ植栽帯で重なっていることが分かります。"
            : "主役の足元まで写っているため、花木だけでなく地表の管理状態や別の植物との接し方も後から確認できます。",
        },
        {
          title: "管理された植栽帯",
          body: hasManagedGround
            ? "草地、裸地、礫、踏まれた面が一緒に残るため、開花だけでなく人の手入れや歩行圧が入る場所として比べられます。"
            : "同じ画角で季節を重ねると、開花量、足元の植物、背景の樹木の変化を植栽帯の記録として追えます。",
        },
      ]
    : [
        {
          title: /ヒメイワダレソウ|イワダレソウ/.test(subjectLabel) ? "足元に咲く花" : "主役の見え方",
          body: /ヒメイワダレソウ|イワダレソウ/.test(subjectLabel)
            ? "低く広がる白い花が、道端の小さな面をつくっています。名前だけでなく、どこまで広がり、裸地や草とどう接しているかが見える記録です。"
            : `${sceneNoun}の中に、主役の形と周囲の状態が一緒に残っています。名前だけでなく、その場でどう見えていたかを読み返せます。`,
        },
        {
          title: hasBee ? "花を使う虫" : "一緒に写るもの",
          body: hasBee
            ? "花に来た虫が一緒に写ることで、この場所が花資源として使われている場面になります。小さな訪花の記録が、季節の動きを残します。"
            : hasMultipleRecords
              ? "複数の対象を分けて残すと、主役のそばに何があったかを後から比べられます。1つの名前で終わらない場面の記録です。"
              : "同じ画角で別の日にも記録すると、そこを使う虫や周囲の変化が見えてきます。",
        },
        {
          title: "人の手が入る草地",
          body: "低い草丈、裸地、礫、踏まれた感じが写っています。同じ場所を季節ごとに重ねると、花の量、虫の来方、草地の保たれ方が地域の変化として見えてきます。",
        },
      ];
  return `<div class="obs-record-story">
    <div class="obs-record-story-head">
      <div>
        <div class="obs-record-story-eye">${escapeHtml(place)}の記録</div>
        <h3 class="obs-record-story-title">${escapeHtml(`${place}の足元にある、小さな季節の物語`)}</h3>
      </div>
      <span class="obs-record-story-pill">${escapeHtml(recordSceneParts.length > 0 ? recordSceneParts.join("・") : "写真・場所・地域")}</span>
    </div>
    <div class="obs-record-story-cards">
      ${storyCards.map((card) => `<div class="obs-record-story-card"><strong>${escapeHtml(card.title)}</strong><p>${escapeHtml(card.body)}</p></div>`).join("")}
    </div>
  </div>`;
}

function renderObservationNextActionRail(actions: ObservationNextAction[]): string {
  return `<div class="obs-next-actions" aria-label="次の一歩">
    ${actions.map((action) => `<a class="obs-next-action${action.primary ? " is-primary" : ""}"
         href="${escapeHtml(action.href)}"
         data-observation-primary-cta="${escapeHtml(action.key)}"
         data-kpi-action="observation:primary:${escapeHtml(action.key)}">
      <span class="obs-next-action-label">${escapeHtml(action.label)}</span>
      <span class="obs-next-action-body">${escapeHtml(action.body)}</span>
    </a>`).join("")}
  </div>`;
}

function renderVisualNextCaptureSuggestions(snapshot: ObservationDetailSnapshot): string {
  if (snapshot.nextCaptureSuggestions.length === 0) return "";
  const suggestions = snapshot.nextCaptureSuggestions
    .filter((item) => item.priority === "high")
    .concat(snapshot.nextCaptureSuggestions.filter((item) => item.priority !== "high"))
    .slice(0, 2);
  const roleLabels: Record<string, string> = {
    full_body: "全体",
    close_up_organ: "細部",
    habitat_wide: "環境",
    substrate: "足元",
    scale_reference: "スケール",
  };
  return `<div class="obs-visual-next-capture">
    <div class="obs-story-eyebrow">次に見つけるなら</div>
    <div class="obs-visual-next-grid">
      ${suggestions.map((item) => `
        <div class="obs-visual-next-card${item.priority === "high" ? " is-high" : ""}">
          <span>${escapeHtml(roleLabels[item.role] ?? item.role)}${item.priority === "high" ? " / 優先" : ""}</span>
          <strong>${escapeHtml(friendlyObservationText(item.target, 38))}</strong>
          <p>${escapeHtml(friendlyObservationText(item.rationale, 62))}</p>
        </div>`).join("")}
    </div>
  </div>`;
}

function renderPhotoFirstRead(
  subject: ObservationVisitSubject,
  recordItems: VisibleRecordItem[],
  hasOpenDispute: boolean,
  mediaContext: ObservationMediaCopyContext = photoOnlyMediaContext(),
): string {
  const ai = subject.aiAssessment;
  const clue = (ai?.diagnosticFeaturesSeen ?? [])
    .map((item) => friendlyObservationText(item, 54))
    .find((item) => /花|葉|草|茎|地面|実|羽|脚|模様|色|形/.test(item));
  const scene = clue || subject.focusReason || "写っている形や周りの様子";
  const candidateName = ai?.recommendedTaxonName || subject.displayName || "名前確認中の生きもの";
  const coSubjects = recordItems.filter((item) => item.source === "candidate" || item.proposalKind !== "none").length;
  const sceneFrom = mediaSceneFrom(mediaContext);
  const line1 = `${scene}が${sceneFrom}から見えます。`;
  const line2 = hasOpenDispute
    ? `${candidateName}も候補の一つですが、別の見方があるため名前はまだ決めきりません。`
    : coSubjects > 0
      ? `${candidateName}の候補に加えて、一緒に写っていそうなものも探せます。`
      : `${candidateName}の候補として読めます。`;
  return `<div class="obs-first-read">
    <div class="obs-first-read-eye">まず${escapeHtml(sceneFrom)}から分かること</div>
    <p>${escapeHtml(line1)}</p>
    <p>${escapeHtml(line2)}</p>
  </div>`;
}

function renderObservationReadingHero(options: {
  mediaBlock: string;
  snapshot: ObservationDetailSnapshot;
  recordTitle: string;
  observerDisplay: string;
  observerHref: string;
  observedAt: string;
  placeLabel: string;
  badges: string[];
  focusRailBlock: string;
  mediaDiscoveryBlock: string;
  mediaLedgerBlock: string;
  recordInsightBlock: string;
  useStatusBlock: string;
  identifyBlock: string;
  visibleRecordCount: number;
  summaryStrip: string;
  firstReadBlock: string;
  sceneOverviewBlock: string;
  nameStatusBlock: string;
  nextActionRail: string;
  trustStageLabel: string;
  trustLead: string;
  recordsHref: string;
  evidenceLabel: string;
  recordModeLabel: string;
  mediaSceneLabel: string;
}): string {
  return `<section id="photos" class="section obs-reading-hero" data-obs-section="photos">
    <div class="obs-reading-media obs-media-evidence-shell">
      ${options.mediaBlock}
      ${options.mediaDiscoveryBlock}
      ${options.identifyBlock}
    </div>
    <aside class="obs-reading-panel" aria-label="この${escapeHtml(options.mediaSceneLabel)}と見つけたもの">
      <h1 class="sr-only">${escapeHtml(options.recordTitle)}</h1>
      <div id="summary" class="obs-record-brief obs-record-brief-compact" data-obs-section="summary" aria-label="この${escapeHtml(options.mediaSceneLabel)}の記録">
        <div class="obs-record-compact-main">
          <div class="obs-record-compact-meta">
            <span>${escapeHtml(formatAbsolute(options.observedAt))}</span>
            <span>${escapeHtml(options.placeLabel)}</span>
          </div>
          <a class="obs-hero-observer" href="${escapeHtml(options.observerHref)}">
            ${options.snapshot.observerAvatarUrl
              ? `<img class="obs-hero-avatar obs-hero-avatar-img" src="${escapeHtml(options.snapshot.observerAvatarUrl)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'obs-hero-avatar',textContent:${JSON.stringify((options.observerDisplay || "?").slice(0, 1))}}))" />`
              : `<span class="obs-hero-avatar">${escapeHtml((options.observerDisplay || "?").slice(0, 1))}</span>`}
            <span>${escapeHtml(options.observerDisplay)}</span>
          </a>
        </div>
      </div>
      ${options.mediaLedgerBlock}
      ${options.recordInsightBlock}
      ${options.useStatusBlock}
      ${options.summaryStrip}
      ${options.sceneOverviewBlock}
      <div data-obs-switch-ai-readout>${options.nameStatusBlock}</div>
      ${options.nextActionRail}
    </aside>
  </section>`;
}

function renderObservationReadProgress(options: {
  basePath: string;
  observationId: string;
  subjectId: string;
  isOwner: boolean;
}): string {
  const endpoint = withBasePath(options.basePath, "/api/v1/ui-kpi/events");
  const sections = [
    { href: "#summary", key: "summary", label: "場面の記録" },
    { href: "#photos", key: "photos", label: "写真・動画・音" },
    { href: "#trust", key: "trust", label: "反応" },
    { href: "#story", key: "story", label: "気づき" },
    { href: "#identity-evidence", key: "identity_evidence", label: "根拠" },
    { href: "#next-hints", key: "next_hints", label: "次に探す" },
    { href: "#identify", key: "identify", label: "同定" },
    { href: "#place", key: "place", label: "場所" },
    { href: "#related", key: "related", label: "関連" },
  ];
  return `<nav class="obs-read-progress" aria-label="記録ページの読み進め">
    ${sections.map((section) => `<a href="${section.href}" data-obs-progress-link="${section.key}">${escapeHtml(section.label)}</a>`).join("")}
  </nav>
  <script>(function(){
    var endpoint = ${JSON.stringify(endpoint)};
    var observationId = ${JSON.stringify(options.observationId)};
    var subjectId = ${JSON.stringify(options.subjectId)};
    var isOwner = ${JSON.stringify(options.isOwner)};
    var pagePath = location.pathname + location.search;
    var sessionPrefix = 'ikimon:v2:observation_read:' + observationId + ':' + subjectId + ':';
    Array.prototype.slice.call(document.querySelectorAll('[data-obs-progress-link]')).forEach(function(link){
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) === '#' && !document.querySelector(href)) link.remove();
    });
    var send = function(eventName, actionKey, metadata) {
      try {
        var payload = {
          eventName: eventName,
          pagePath: pagePath,
          routeKey: '/observations/:id',
          actionKey: actionKey,
          metadata: Object.assign({
            observationId: observationId,
            subjectId: subjectId,
            isOwner: isOwner,
            lang: document.documentElement.lang || 'ja',
            ts: new Date().toISOString()
          }, metadata || {})
        };
        fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
          credentials: 'same-origin'
        }).catch(function(){});
      } catch (_) {}
    };
    var seen = {};
    var remember = function(key) {
      if (seen[key]) return false;
      seen[key] = true;
      try {
        if (sessionStorage.getItem(sessionPrefix + key) === '1') return false;
        sessionStorage.setItem(sessionPrefix + key, '1');
      } catch (_) {}
      return true;
    };
    var sections = Array.prototype.slice.call(document.querySelectorAll('[data-obs-section]'));
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (!entry.isIntersecting) return;
          var key = entry.target.getAttribute('data-obs-section') || '';
          if (!key || !remember('section:' + key)) return;
          send('section_view', 'observation:section:' + key, { sectionKey: key });
        });
      }, { threshold: 0.45 });
      sections.forEach(function(section){ io.observe(section); });
    }
    var milestones = [25, 50, 75, 90, 100];
    var ticking = false;
    var checkDepth = function(){
      ticking = false;
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      var depth = Math.min(100, Math.round((window.scrollY / max) * 100));
      milestones.forEach(function(milestone){
        if (depth >= milestone && remember('depth:' + milestone)) {
          send('read_depth', 'observation:read_depth:' + milestone, { depthPercent: milestone });
        }
      });
    };
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(checkDepth);
    }, { passive: true });
    checkDepth();
    document.addEventListener('click', function(event){
      var target = event.target instanceof Element ? event.target.closest('[data-observation-primary-cta]') : null;
      if (!target) return;
      var ctaKey = target.getAttribute('data-observation-primary-cta') || '';
      send('primary_cta_click', 'observation:primary:' + ctaKey, { ctaKey: ctaKey });
    }, { capture: true, passive: true });
  })();</script>`;
}

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function buildPlaceCompareLine(place: Pick<HomePlace, "previousObservedAt">): string {
  return place.previousObservedAt
    ? `前回 ${formatShortDate(place.previousObservedAt, "ja-JP")}`
    : "この場所の最初の記録です。";
}

function buildPlaceNextLine(place: Pick<HomePlace, "nextLookFor" | "revisitReason" | "latestDisplayName">): string {
  const focus = pickPlaceFocus(place);
  return focus
    ? `次は ${focus}`
    : "次の散歩で小さな変化を1つ残す";
}

function renderPlaceRows(
  basePath: string,
  lang: SiteLang,
  viewerUserId: string | null | undefined,
  places: HomePlace[],
  emptyMessage: string,
): string {
  if (places.length === 0) {
    return `<div class="row"><div>${escapeHtml(emptyMessage)}</div></div>`;
  }

  return places.map((place) => {
    const recordHref = viewerUserId
      ? buildPlaceRecordHref(basePath, lang, viewerUserId, place)
      : null;
    return `<div class="row row-place-revisit">
      <div>
        <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
        <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${place.visitCount} 回</div>
        <div class="meta">${escapeHtml(buildPlaceCompareLine(place))}</div>
        <div class="meta">${escapeHtml(buildPlaceNextLine(place))}</div>
      </div>
      <div class="row-place-actions">
        <span class="pill">${escapeHtml(formatShortDate(place.lastObservedAt, "ja-JP") || place.lastObservedAt)}</span>
        ${recordHref ? `<a class="btn btn-ghost" href="${escapeHtml(recordHref)}">ここで記録</a>` : ""}
      </div>
    </div>`;
  }).join("");
}

const PLACE_REVISIT_ROW_STYLES = `
  .row-place-revisit {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .row-place-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
  }
  @media (max-width: 640px) {
    .row-place-revisit { flex-direction: column; }
    .row-place-actions { width: 100%; flex-direction: row; justify-content: space-between; align-items: center; }
  }
`;

const PROFILE_CHANNEL_STYLES = `
  .profile-channel-grid { display: grid; grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr)); gap: 12px; }
  .profile-channel-card { min-width: 0; min-height: 248px; display: grid; grid-template-rows: minmax(132px, 1fr) auto; overflow: hidden; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.92); box-shadow: 0 14px 34px rgba(15,23,42,.055); color: inherit; text-decoration: none; }
  .profile-channel-card:first-child { min-height: 320px; }
  .profile-channel-media { position: relative; display: grid; place-items: center; min-height: 132px; background: linear-gradient(135deg, #ecfdf5, #f8fafc 58%, #f0f9ff); color: #047857; font-size: 13px; font-weight: 950; }
  .profile-channel-media img { width: 100%; height: 100%; min-height: 132px; object-fit: cover; display: block; }
  .profile-channel-media > span { width: 100%; height: 100%; min-height: 132px; display: grid; place-items: center; }
  .profile-channel-body { display: grid; gap: 6px; align-content: start; padding: 14px; }
  .profile-channel-body small { color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; }
  .profile-channel-body strong { color: #10251a; font-size: 17px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
  .profile-channel-body em { color: #64748b; font-size: 12.5px; line-height: 1.6; font-style: normal; font-weight: 720; overflow-wrap: anywhere; }
  @media (max-width: 980px) {
    .profile-channel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-channel-card:first-child { min-height: 248px; }
  }
  @media (max-width: 620px) {
    .profile-channel-grid { grid-template-columns: 1fr; }
    .profile-channel-card, .profile-channel-card:first-child { min-height: 220px; }
  }
`;

const PROFILE_HUB_STYLES = `
  ${PROFILE_CHANNEL_STYLES}
  ${PLACE_REVISIT_ROW_STYLES}
  .profile-hub-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; min-width: 0; }
  .profile-hub-actions .btn { min-height: 44px; max-width: 100%; white-space: normal; }
  .profile-summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .profile-summary-card { min-width: 0; min-height: 118px; padding: 18px; border-radius: 18px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 24px rgba(15,23,42,.045); overflow-wrap: anywhere; }
  .profile-summary-card strong { display: block; margin-top: 8px; font-size: 28px; line-height: 1.05; color: #0f172a; letter-spacing: 0; }
  .profile-summary-card span { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-weight: 750; line-height: 1.55; }
  .profile-next-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .profile-reading-digest { min-width: 0; padding: 22px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: linear-gradient(135deg, rgba(236,253,245,.82), rgba(255,255,255,.92) 54%, rgba(240,249,255,.76)); box-shadow: 0 16px 38px rgba(15,23,42,.06); display: grid; gap: 16px; }
  .profile-reading-main { min-width: 0; }
  .profile-reading-main h3 { margin: 8px 0 0; color: #1a2e1f; font-size: clamp(28px, 3.2vw, 44px); line-height: 1.1; letter-spacing: 0; max-width: 18ch; }
  .profile-reading-main p { margin: 12px 0 0; color: #475569; line-height: 1.8; font-weight: 720; max-width: 68em; }
  .profile-reading-points { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .profile-reading-points div { min-width: 0; min-height: 142px; padding: 14px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.78); overflow-wrap: anywhere; }
  .profile-reading-points span { display: block; color: #047857; font-size: 12px; font-weight: 950; }
  .profile-reading-points strong { display: block; margin-top: 8px; color: #1a2e1f; font-size: 16px; line-height: 1.35; }
  .profile-reading-points p { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.65; font-weight: 700; }
  .profile-reading-actions { display: flex; flex-wrap: wrap; gap: 10px; min-width: 0; }
  .profile-reading-actions .btn { max-width: 100%; white-space: normal; }
  .regional-story { display: grid; gap: 14px; padding: 18px; border-radius: 12px; border: 1px solid rgba(16,185,129,.18); background: linear-gradient(135deg, rgba(240,253,244,.92), rgba(255,255,255,.96)); box-shadow: 0 12px 28px rgba(15,23,42,.045); }
  .regional-story-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
  .regional-story-eyebrow { color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .regional-story h2 { margin: 6px 0 0; color: #10251a; font-size: clamp(22px, 3vw, 32px); line-height: 1.18; letter-spacing: 0; }
  .regional-story-details > summary { cursor: pointer; list-style: none; }
  .regional-story-details > summary::-webkit-details-marker { display: none; }
  .regional-story-summary-title { display: block; margin-top: 6px; color: #10251a; font-size: clamp(18px, 2.4vw, 24px); line-height: 1.25; letter-spacing: 0; }
  .regional-story-head > span { flex: 0 0 auto; display: inline-flex; min-height: 28px; align-items: center; padding: 5px 10px; border-radius: 999px; background: #ecfdf5; color: #047857; font-size: 11px; font-weight: 950; }
  .regional-story-lead { margin: 0; color: #475569; line-height: 1.8; font-weight: 720; }
  .regional-story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .regional-story-grid:has(> :only-child) { grid-template-columns: 1fr; }
  .regional-story-grid:empty { display: none; }
  .regional-story-grid div { min-width: 0; min-height: 96px; padding: 13px; border-radius: 10px; background: rgba(255,255,255,.82); border: 1px solid rgba(16,185,129,.12); overflow-wrap: anywhere; }
  .regional-story-next { border-color: rgba(2,132,199,.22) !important; background: linear-gradient(135deg, rgba(240,249,255,.92), rgba(255,255,255,.96)) !important; }
  .regional-story-next small { color: #0369a1 !important; }
  .regional-story-grid small { display: block; color: #047857; font-size: 11px; font-weight: 950; }
  .regional-story-grid strong { display: block; margin-top: 8px; color: #1f3527; font-size: 14px; line-height: 1.55; }
  .regional-story-sources { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 4px; border-top: 1px dashed rgba(16,185,129,.16); }
  .regional-story-sources-eye { color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
  .regional-story-sources a { display: inline-flex; align-items: center; min-height: 30px; max-width: 100%; padding: 6px 9px; border-radius: 999px; background: rgba(16,185,129,.08); color: #047857; font-size: 11px; font-weight: 850; text-decoration: none; overflow-wrap: anywhere; }
  .regional-story-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; border-top: 1px dashed rgba(16,185,129,.16); }
  .regional-story-cards-eye { color: #047857; font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; padding-top: 4px; }
  .regional-story-card { display: flex; gap: 12px; padding: 12px 14px; border-radius: 12px; background: #ffffff; border: 1px solid rgba(16,185,129,.18); text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease; }
  .regional-story-card:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16,185,129,.12); }
  .regional-story-card-icon { font-size: 22px; line-height: 1; flex: 0 0 auto; }
  .regional-story-card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .regional-story-card-title { font-size: 13.5px; font-weight: 850; color: #10251a; line-height: 1.4; }
  .regional-story-card-summary { font-size: 12.5px; color: #475569; line-height: 1.6; }
  .regional-story-card-source { font-size: 11px; color: #047857; font-weight: 800; }
  .profile-place-story-list { display: grid; gap: 12px; }
  .profile-history-shell, .profile-growth-shell, .profile-contribution-shell { min-width: 0; display: grid; gap: 14px; padding: 22px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: rgba(255,255,255,.84); box-shadow: 0 14px 32px rgba(15,23,42,.05); }
  .profile-history-line { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .profile-history-step { min-width: 0; min-height: 116px; padding: 14px; border-radius: 8px; background: linear-gradient(135deg, rgba(236,253,245,.78), rgba(248,250,252,.92)); border: 1px solid rgba(16,185,129,.13); overflow-wrap: anywhere; }
  .profile-history-step span, .profile-growth-card span, .profile-contribution-card span { display: block; color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; }
  .profile-history-step strong, .profile-growth-card strong, .profile-contribution-card strong { display: block; margin-top: 8px; color: #10251a; font-size: 20px; line-height: 1.2; font-weight: 950; }
  .profile-history-step p, .profile-growth-card p, .profile-contribution-card p { margin: 8px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
  .profile-growth-grid, .profile-contribution-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .profile-growth-card, .profile-contribution-card { min-width: 0; min-height: 132px; padding: 15px; border-radius: 8px; border: 1px solid rgba(16,185,129,.13); background: rgba(248,250,252,.82); overflow-wrap: anywhere; }
  .profile-life-strip { display: flex; flex-wrap: wrap; gap: 8px; }
  .profile-life-pill { display: inline-flex; align-items: center; max-width: 100%; min-height: 34px; padding: 7px 10px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 900; overflow-wrap: anywhere; }
  .profile-library-link { display: inline-flex; align-items: center; justify-content: center; width: fit-content; max-width: 100%; min-height: 42px; padding: 10px 14px; border-radius: 999px; background: #10251a; color: #fff; font-weight: 950; text-align: center; text-decoration: none; white-space: normal; }
  .profile-reference-shell { min-width: 0; display: grid; gap: 14px; padding: 22px; border-radius: 8px; border: 1px solid rgba(14,165,233,.16); background: linear-gradient(135deg, rgba(240,249,255,.86), rgba(255,255,255,.94)); box-shadow: 0 14px 32px rgba(15,23,42,.05); }
  .profile-reference-grid { display: grid; grid-template-columns: 160px 160px minmax(0,1fr); gap: 10px; align-items: stretch; }
  .profile-reference-stat, .profile-reference-recent { min-width: 0; min-height: 116px; padding: 14px; border-radius: 8px; border: 1px solid rgba(14,165,233,.14); background: rgba(255,255,255,.82); overflow-wrap: anywhere; }
  .profile-reference-stat span, .profile-reference-recent span { display: block; color: #0369a1; font-size: 11px; line-height: 1.2; font-weight: 950; }
  .profile-reference-stat strong, .profile-reference-recent strong { display: block; margin-top: 8px; color: #10251a; font-size: 22px; line-height: 1.25; font-weight: 950; }
  .profile-reference-recent p { margin: 8px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
  .profile-action-card { min-width: 0; display: grid; gap: 10px; min-height: 176px; padding: 20px; border-radius: 20px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.05); overflow-wrap: anywhere; }
  .profile-action-card h3 { margin: 0; font-size: 19px; line-height: 1.35; color: #0f172a; }
  .profile-action-card p { margin: 0; color: #64748b; line-height: 1.7; }
  .profile-intro-heading { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .profile-avatar { width: 58px; height: 58px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; flex: 0 0 auto; background: #ecfdf5; color: #047857; border: 1px solid rgba(16,185,129,.18); font-size: 22px; font-weight: 950; }
  .profile-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-intro-heading h2 { min-width: 0; overflow-wrap: anywhere; }
  .profile-life-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .profile-life-card { min-width: 0; display: grid; grid-template-rows: auto 1fr; min-height: 210px; overflow: hidden; border-radius: 18px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); }
  .profile-life-media { position: relative; width: 100%; aspect-ratio: 4 / 3; background: #e2e8f0; }
  .profile-life-thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e2e8f0; display: block; }
  .profile-life-placeholder { width: 100%; aspect-ratio: 4 / 3; display: grid; place-items: center; background: linear-gradient(135deg, #ecfdf5, #f8fafc); color: #047857; font-weight: 900; }
  .profile-life-media .profile-life-thumb, .profile-life-media .profile-life-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; aspect-ratio: auto; }
  .profile-life-body { padding: 14px; }
  .profile-life-body strong { display: block; color: #0f172a; line-height: 1.4; }
  .profile-life-body span { display: block; margin-top: 6px; color: #64748b; font-size: 12px; line-height: 1.55; }
  .profile-settings-card { max-width: 760px; margin: 0 auto; padding: 24px; border-radius: 20px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 14px 32px rgba(15,23,42,.055); }
  .profile-settings-form { display: grid; gap: 18px; }
  .profile-settings-field { display: grid; gap: 8px; }
  .profile-settings-field label { font-weight: 850; color: #0f172a; }
  .profile-settings-field input, .profile-settings-field textarea { width: 100%; min-height: 48px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(15,23,42,.16); background: #fff; color: #0f172a; font: inherit; line-height: 1.6; box-sizing: border-box; }
  .profile-settings-avatar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding: 14px; border-radius: 18px; border: 1px solid rgba(15,23,42,.1); background: rgba(248,250,252,.82); }
  .profile-settings-avatar-preview { width: 76px; height: 76px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; background: #ecfdf5; color: #047857; font-size: 24px; font-weight: 950; flex: 0 0 auto; }
  .profile-settings-avatar-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-settings-avatar-control { display: grid; gap: 8px; min-width: min(260px, 100%); flex: 1; }
  .profile-settings-avatar-control input { min-height: auto; padding: 10px; }
  .profile-settings-field textarea { min-height: 148px; resize: vertical; }
  .profile-settings-help { margin: 0; color: #64748b; font-size: 13px; line-height: 1.65; }
  .profile-settings-status { min-height: 24px; color: #475569; font-weight: 800; }
  .profile-settings-status.is-error { color: #b91c1c; }
  .profile-settings-status.is-success { color: #047857; }
  @media (max-width: 980px) {
    .profile-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-next-grid, .profile-life-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-reading-points { grid-template-columns: 1fr; }
    .profile-history-line, .profile-growth-grid, .profile-contribution-grid, .profile-reference-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .profile-summary-grid, .profile-next-grid, .profile-life-grid { grid-template-columns: 1fr; }
    .profile-history-line, .profile-growth-grid, .profile-contribution-grid, .profile-reference-grid, .regional-story-grid { grid-template-columns: 1fr; }
    .regional-story-head { flex-direction: column; }
    .profile-reading-digest, .profile-history-shell, .profile-growth-shell, .profile-contribution-shell, .profile-reference-shell { padding: 16px; }
    .profile-summary-card { min-height: 96px; padding: 15px; border-radius: 8px; }
    .profile-reading-main h3 { max-width: 100%; font-size: 27px; line-height: 1.18; }
    .profile-reading-actions .btn, .profile-hub-actions .btn, .profile-library-link { width: 100%; border-radius: 14px; }
    .profile-intro-heading { align-items: flex-start; gap: 12px; }
    .profile-settings-card { padding: 18px; border-radius: 8px; }
    .profile-settings-avatar { align-items: flex-start; }
  }
`;

function formatProfileNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatProfileDate(value: string | null | undefined): string {
  if (!value) return "これから";
  return formatShortDate(value, "ja-JP") || value.slice(0, 10);
}

function profileObservationYears(snapshot: ProfileSnapshot): number {
  if (!snapshot.stats.firstObservedAt) return 0;
  const first = new Date(snapshot.stats.firstObservedAt).getTime();
  if (!Number.isFinite(first)) return 0;
  const days = Math.max(1, Math.round((Date.now() - first) / 86400000));
  return Math.max(1, Math.ceil(days / 365));
}

function profileRevisitCount(snapshot: ProfileSnapshot): number {
  return snapshot.recentPlaces.reduce((sum, place) => sum + Math.max(0, place.visitCount - 1), 0);
}

function renderProfileSummary(snapshot: ProfileSnapshot): string {
  const stats = snapshot.stats;
  const cards = [
    { eyebrow: "Total", value: stats.totalObservations, label: "総記録数" },
    { eyebrow: "This month", value: stats.thisMonthObservations, label: "今月の記録" },
    { eyebrow: "Places", value: stats.placeCount, label: "記録した場所" },
    { eyebrow: "Life List", value: stats.uniqueTaxaAllTime, label: "見てきた生きもの" },
    { eyebrow: "Streak", value: stats.currentStreakDays, label: "現在ストリーク" },
  ];
  return `<section class="section" data-testid="profile-summary">
    <div class="profile-summary-grid">
      ${cards.map((card) => `<div class="profile-summary-card">
        <div class="eyebrow">${escapeHtml(card.eyebrow)}</div>
        <strong>${escapeHtml(formatProfileNumber(card.value))}</strong>
        <span>${escapeHtml(card.label)}</span>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderProfileIntro(basePath: string, snapshot: ProfileSnapshot, editable = false): string {
  if (!snapshot.avatarUrl && !snapshot.profileBio && !snapshot.expertise && !editable) {
    return "";
  }
  const editLink = editable
    ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/profile/settings"))}">編集する</a>`
    : "";
  const avatarFallback = (snapshot.displayName || "?").slice(0, 1);
  const avatar = snapshot.avatarUrl
    ? `<span class="profile-avatar"><img src="${escapeHtml(snapshot.avatarUrl)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'profile-avatar',textContent:${JSON.stringify(avatarFallback)}}))" /></span>`
    : `<span class="profile-avatar">${escapeHtml(avatarFallback)}</span>`;
  return `<section class="section" data-testid="profile-intro">
    <div class="card is-soft">
      <div class="card-body stack">
        <div class="section-header">
          <div class="profile-intro-heading">
            ${avatar}
            <div>
              <div class="eyebrow">プロフィール</div>
              <h2>${escapeHtml(snapshot.displayName)} の記録メモ</h2>
            </div>
          </div>
          ${editLink}
        </div>
        ${snapshot.expertise ? `<p class="meta"><strong>関心分野:</strong> ${escapeHtml(snapshot.expertise)}</p>` : ""}
        ${snapshot.profileBio ? `<p style="margin:0;white-space:pre-wrap">${escapeHtml(snapshot.profileBio)}</p>` : `<p class="meta" style="margin:0">自己紹介はまだありません。</p>`}
      </div>
    </div>
  </section>`;
}

function profileObservationHref(basePath: string, item: {
  occurrenceId: string;
  visitId: string;
  detailId?: string;
  featuredOccurrenceId?: string | null;
}): string {
  return withBasePath(basePath, buildObservationDetailPath(
    item.detailId ?? item.visitId ?? item.occurrenceId,
    item.featuredOccurrenceId ?? item.occurrenceId,
  ));
}

function renderChannelMediaCard(
  href: string,
  label: string,
  title: string,
  body: string,
  photoUrl: string | null | undefined,
  fallback: string,
): string {
  const mediaUrl = photoUrl ? (toThumbnailUrl(photoUrl, "md") ?? photoUrl) : null;
  return `<a class="profile-channel-card" href="${escapeHtml(href)}">
    <span class="profile-channel-media">
      ${mediaUrl
        ? `<img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden>${escapeHtml(fallback)}</span>`
        : `<span>${escapeHtml(fallback)}</span>`}
    </span>
    <span class="profile-channel-body">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(title)}</strong>
      <em>${escapeHtml(body)}</em>
    </span>
  </a>`;
}

function renderHomeChannelDashboard(basePath: string, snapshot: HomeSnapshot): string {
  const isPersonalHome = Boolean(snapshot.viewerUserId);
  const latest = snapshot.recentObservations[0] ?? null;
  const firstPlace = snapshot.myPlaces[0] ?? null;
  const secondPlace = snapshot.myPlaces[1] ?? null;
  const latestHref = latest ? profileObservationHref(basePath, latest) : withBasePath(basePath, "/record");
  const placeHref = withBasePath(basePath, isPersonalHome && (secondPlace || firstPlace) ? "/records?view=places" : "/map");
  const placeTitle = secondPlace?.placeName ?? firstPlace?.placeName ?? (isPersonalHome ? "地図から探す" : "近くの発見を見る");
  const placeBody = secondPlace
    ? buildPlaceNextLine(secondPlace)
    : firstPlace
      ? buildPlaceNextLine(firstPlace)
      : isPersonalHome
        ? "近くの発見から、次に歩く場所を選ぶ"
        : "地域の記録から、最初に歩く場所を決める";
  return `<section class="section" data-testid="home-channel">
    <div class="home-workbench" aria-label="${escapeHtml(isPersonalHome ? "マイページ操作" : "はじめる操作")}">
      <div class="home-action-grid">
        <a class="home-action-card is-primary" href="${escapeHtml(withBasePath(basePath, "/record"))}">
          <span>記録する</span>
          <strong>${escapeHtml(firstPlace?.placeName ?? "いま見つけたもの")}</strong>
          <em>${escapeHtml(firstPlace ? "同じ場所で次の観察を残す" : "写真と場所を残す")}</em>
        </a>
        <a class="home-action-card" href="${escapeHtml(latestHref)}">
          <span>前回を見る</span>
          <strong>${escapeHtml(latest?.displayName ?? "まだ記録はありません")}</strong>
          <em>${escapeHtml(latest ? `${formatProfileDate(latest.observedAt)} · ${latest.placeName}` : "最初の記録を作る")}</em>
        </a>
        <a class="home-action-card" href="${escapeHtml(placeHref)}">
          <span>${escapeHtml(isPersonalHome ? "次に行く" : "場所を探す")}</span>
          <strong>${escapeHtml(placeTitle)}</strong>
          <em>${escapeHtml(placeBody)}</em>
        </a>
      </div>
    </div>
  </section>`;
}

export function renderHomePageHtml(basePath: string, lang: SiteLang, snapshot: HomeSnapshot, showSpecialistCta = false): string {
  const cards = snapshot.recentObservations.map((item) =>
    renderObservationCard(basePath, lang, {
      occurrenceId: item.occurrenceId,
      visitId: item.visitId,
      detailId: item.detailId,
      featuredOccurrenceId: item.featuredOccurrenceId,
      featuredSubjectName: item.featuredSubjectName,
      subjectCount: item.subjectCount,
      isMultiSubject: item.isMultiSubject,
      featuredConfidenceBand: item.featuredConfidenceBand,
      displayStability: item.displayStability,
      displayName: item.displayName,
      observedAt: item.observedAt,
      observerName: item.observerName,
      placeName: item.placeName,
      municipality: item.municipality,
      publicLocation: item.publicLocation,
      photoUrl: item.photoUrl,
      mediaUrl: item.mediaUrl,
      hasPhoto: item.hasPhoto,
      hasVideo: item.hasVideo,
      identificationCount: item.identificationCount,
      latitude: null,
      longitude: null,
      observerUserId: null,
      observerAvatarUrl: null,
    }, { locationMode: "public", showSpecialistCta, compact: true }),
  ).join("");
  const myPlaces = renderPlaceRows(
    basePath,
    lang,
    snapshot.viewerUserId,
    snapshot.myPlaces,
    "まだ記録した場所はありません。",
  );
  return layout(
    basePath,
    "ホーム | ikimon",
    `${renderHomeChannelDashboard(basePath, snapshot)}
      <section class="section"><div class="section-header"><div><div class="eyebrow">記録</div><h2>最近の観察</h2></div><a class="section-link" href="${escapeHtml(withBasePath(basePath, "/records?view=mine"))}">すべて見る</a></div><div class="home-grid">${cards}</div></section>
      ${snapshot.viewerUserId ? `<section class="section"><div class="section-header"><div><div class="eyebrow">場所</div><h2>再訪したい場所</h2></div><a class="section-link" href="${escapeHtml(withBasePath(basePath, "/records?view=places"))}">場所を見る</a></div><div class="list">${myPlaces}</div></section>` : ""}`,
    "ホーム",
    undefined,
    `${OBSERVATION_CARD_STYLES}
        .home-workbench { min-width: 0; }
        .home-action-grid { min-width: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .home-action-card { min-width: 0; min-height: 118px; display: grid; align-content: start; gap: 7px; padding: 14px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.92); box-shadow: 0 10px 24px rgba(15,23,42,.045); color: inherit; text-decoration: none; overflow-wrap: anywhere; }
        .home-action-card:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(15,23,42,.075); }
        .home-action-card span { color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; }
        .home-action-card strong { color: #10251a; font-size: 16px; line-height: 1.35; font-weight: 950; }
        .home-action-card em { color: #64748b; font-size: 12px; line-height: 1.55; font-style: normal; font-weight: 720; }
        .home-action-card.is-primary { background: #10251a; border-color: #10251a; color: #fff; }
        .home-action-card.is-primary span,
        .home-action-card.is-primary strong,
        .home-action-card.is-primary em { color: #fff; }
        .home-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; align-items: start; }
        .home-grid .obs-card { border-radius: 8px; box-shadow: 0 8px 20px rgba(15,23,42,.045); }
        .home-grid .obs-card:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(15,23,42,.075); }
        .home-grid .obs-card-media { aspect-ratio: 16 / 10; }
        .home-grid .obs-card-meta { padding: 10px 12px 12px; }
        .home-grid .obs-card-place { -webkit-line-clamp: 1; }
        .home-grid .obs-card-actions { display: none; }
        @media (max-width: 980px) {
          .home-action-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 620px) {
          .home-action-grid { grid-template-columns: 1fr; }
          .home-action-card { min-height: 98px; }
          .home-grid { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 10px; }
          .home-grid .obs-card-attribution { font-size: 12px; }
          .home-grid .obs-card-when { display: none; }
        }
        ${PLACE_REVISIT_ROW_STYLES}
      `,
    appendLangToHref(withBasePath(basePath, "/home"), lang),
  );
}

function renderProfileChannelHero(basePath: string, snapshot: ProfileSnapshot): string {
  const latest = snapshot.recentObservations[0] ?? null;
  const firstPlace = snapshot.recentPlaces[0] ?? null;
  const topLife = snapshot.lifeListPreview[0] ?? null;
  return `<section class="section" data-testid="profile-channel">
    <div class="profile-channel-grid">
      ${renderChannelMediaCard(
        withBasePath(basePath, firstPlace ? "/records?view=places" : "/map"),
        "自分のフィールド",
        firstPlace?.placeName ?? "これから歩く場所",
        firstPlace ? buildPlaceNextLine(firstPlace) : "場所の記録が入ると、よく歩くフィールドとして育ちます。",
        latest?.photoUrl,
        "FIELD",
      )}
      ${renderChannelMediaCard(
        latest ? profileObservationHref(basePath, latest) : withBasePath(basePath, "/record"),
        "最近の記録",
        latest?.displayName ?? "まだ記録はありません",
        latest ? `${formatProfileDate(latest.observedAt)} · ${latest.placeName}` : "最初の発見から、自然との関わりが見えるページになります。",
        latest?.photoUrl,
        "PHOTO",
      )}
      ${renderChannelMediaCard(
        withBasePath(basePath, firstPlace ? "/record" : "/map"),
        "次に行く場所",
        firstPlace ? buildPlaceNextLine(firstPlace) : "地図から探す",
        firstPlace ? `${firstPlace.placeName} をもう一度見る理由があります。` : "近くの発見から、次の観察地点を選べます。",
        null,
        "NEXT",
      )}
      ${renderChannelMediaCard(
        withBasePath(basePath, "/records?view=mine"),
        "自分の図鑑",
        topLife?.displayName ?? "名前が付くと並びます",
        topLife ? `${formatProfileNumber(topLife.observationCount)} 件の記録から見返せます。` : "同定が進むほど、自分だけの Life List が育ちます。",
        topLife?.photoUrl ?? latest?.photoUrl,
        "LIFE",
      )}
    </div>
  </section>`;
}

function renderProfileNextActions(basePath: string, snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const firstPlace = snapshot.recentPlaces[0] ?? null;
  const latestObservation = snapshot.recentObservations[0] ?? null;
  const latestHref = latestObservation
    ? withBasePath(basePath, buildObservationDetailPath(
      latestObservation.detailId ?? latestObservation.visitId ?? latestObservation.occurrenceId,
      latestObservation.featuredOccurrenceId ?? latestObservation.occurrenceId,
    ))
    : withBasePath(basePath, "/records?view=mine");
  const latestBody = digest?.todayReading || (latestObservation
    ? `${latestObservation.displayName} を見返すと、${latestObservation.placeName} の前回のページから読み始められます。`
    : "まだ自分の記録はありません。記録一覧や場所の章から、読み返し方を先に眺められます。");
  const placeBody = digest?.placeChapters[0]?.readingAngle || (firstPlace
    ? `${firstPlace.placeName} は ${firstPlace.visitCount} 回分の記憶があります。${buildPlaceNextLine(firstPlace)}。`
    : "場所が増えるほど、同じ道の季節差や小さな変化を章として読み返せます。");
  const learningBody = digest?.learningHighlight || "Life List は数ではなく、見分ける観点が増えてきた履歴として読み返せます。";
  const contributionBody = digest?.localContribution || `${formatProfileNumber(snapshot.stats.placeCount)} か所の記憶が、地域を読み返す手がかりを増やしています。`;
  const contributionValue = digest
    ? `${escapeHtml(formatProfileNumber(digest.sourceStats.observationCount))} ページ`
    : `${escapeHtml(formatProfileNumber(snapshot.stats.totalObservations))} ページ`;
  return `<section class="section" data-testid="profile-next-actions">
    <div class="section-header"><div><div class="eyebrow">My history</div><h2>自分の記録史</h2></div></div>
    <div class="profile-reading-digest">
      <div class="profile-reading-main">
        <div class="eyebrow">Story</div>
        <h3>積み上がった時間から、今日の自分を読み直す</h3>
        <p>${escapeHtml(latestBody)}</p>
      </div>
      <div class="profile-reading-points">
        <div><span>はじまり</span><strong>${escapeHtml(formatProfileDate(snapshot.stats.firstObservedAt))}</strong><p>${escapeHtml(snapshot.stats.firstObservedAt ? `${profileObservationYears(snapshot)} 年分の記録史として読み返せます。` : "最初の記録が入ると、ここから自分の歴史が始まります。")}</p></div>
        <div><span>見えてきたこと</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.uniqueTaxaAllTime))} 種を見てきた</strong><p>${escapeHtml(learningBody)}</p></div>
        <div><span>地域への手がかり</span><strong>${contributionValue}</strong><p>${escapeHtml(contributionBody)}</p></div>
      </div>
      <div class="profile-reading-actions">
        <a class="btn btn-solid" href="${escapeHtml(latestHref)}">前回のページを読む</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/records?view=mine"))}">記録一覧を見る</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/guide/outcomes"))}">ガイド成果を見る</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/records?view=places"))}">場所を見る</a>
      </div>
    </div>
  </section>`;
}

function renderProfileHistory(snapshot: ProfileSnapshot): string {
  const latest = snapshot.recentObservations[0] ?? null;
  const firstPlace = snapshot.recentPlaces[0] ?? null;
  const years = profileObservationYears(snapshot);
  const revisitCount = profileRevisitCount(snapshot);
  return `<section class="section" data-testid="profile-history">
    <div class="section-header"><div><div class="eyebrow">Timeline</div><h2>積み上がった履歴</h2></div></div>
    <div class="profile-history-shell">
      <div class="profile-history-line">
        <div class="profile-history-step"><span>最初の記録</span><strong>${escapeHtml(formatProfileDate(snapshot.stats.firstObservedAt))}</strong><p>${escapeHtml(years > 0 ? `${years} 年分の記録として残っています。` : "ここから記録の履歴が始まります。")}</p></div>
        <div class="profile-history-step"><span>最近のページ</span><strong>${escapeHtml(latest?.displayName ?? "これから")}</strong><p>${escapeHtml(latest ? `${latest.placeName} の ${formatProfileDate(latest.observedAt)} の記録。` : "記録が入ると、前回のページとして読めます。")}</p></div>
        <div class="profile-history-step"><span>再訪</span><strong>${escapeHtml(formatProfileNumber(revisitCount))} 回</strong><p>${escapeHtml(firstPlace ? `${firstPlace.placeName} など、同じ場所を重ねて見ています。` : "同じ場所をもう一度見るほど、変化が読めます。")}</p></div>
        <div class="profile-history-step"><span>今月</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.thisMonthObservations))} 件</strong><p>最近の関心がどこに向いているかを示す短い章です。</p></div>
      </div>
    </div>
  </section>`;
}

function renderProfileGrowth(snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const topLife = snapshot.lifeListPreview.slice(0, 6);
  return `<section class="section" data-testid="profile-growth">
    <div class="section-header"><div><div class="eyebrow">Growth</div><h2>前より見えてきたこと</h2></div></div>
    <div class="profile-growth-shell">
      <div class="profile-growth-grid">
        <div class="profile-growth-card"><span>Life List</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.uniqueTaxaAllTime))} 種</strong><p>数を競うためではなく、見分ける観点が増えてきた履歴です。</p></div>
        <div class="profile-growth-card"><span>手がかりが濃い記録</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.tier2PlusCount))} 件</strong><p>写真や文脈が残り、あとから確かめやすい記録です。</p></div>
        <div class="profile-growth-card"><span>学びの要約</span><strong>${escapeHtml(digest ? "更新済み" : "準備中")}</strong><p>${escapeHtml(digest?.learningHighlight || "記録が増えるほど、よく見る生きものや名前が揺れている対象を要約できます。")}</p></div>
      </div>
      ${topLife.length > 0
        ? `<div class="profile-life-strip">${topLife.map((item) => `<span class="profile-life-pill">${escapeHtml(item.displayName)}</span>`).join("")}</div>`
        : `<div class="profile-life-strip"><span class="profile-life-pill">名前が付くとここに並びます</span></div>`}
    </div>
  </section>`;
}

function renderProfilePlaceStories(stories: RegionalStoryCue[]): string {
  if (stories.length === 0) return "";
  return `<section class="section" data-testid="profile-place-stories">
    <div class="section-header"><div><div class="eyebrow">Place relationship</div><h2>自分と場所の関係史</h2></div></div>
    <div class="profile-place-story-list">
      ${stories.slice(0, 3).map((story) => renderRegionalStoryPanel(story, "profile")).join("")}
    </div>
  </section>`;
}

function renderProfileContribution(basePath: string, snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const revisitCount = profileRevisitCount(snapshot);
  return `<section class="section" data-testid="profile-contribution">
    <div class="section-header"><div><div class="eyebrow">Contribution</div><h2>地域に残った手がかり</h2></div></div>
    <div class="profile-contribution-shell">
      <div class="profile-contribution-grid">
        <div class="profile-contribution-card"><span>記録</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.totalObservations))}</strong><p>キミの記録が、この地域を読み返す手がかりになっています。</p></div>
        <div class="profile-contribution-card"><span>場所</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.placeCount))}</strong><p>見た場所が増えるほど、地域の自然を読み返す入口が増えます。</p></div>
        <div class="profile-contribution-card"><span>再訪の厚み</span><strong>${escapeHtml(formatProfileNumber(revisitCount))}</strong><p>${escapeHtml(digest?.localContribution || "同じ場所を重ねて見ることが、変化の手がかりになります。")}</p></div>
      </div>
      <a class="profile-library-link" href="${escapeHtml(withBasePath(basePath, "/records?view=mine"))}">記録一覧を見る</a>
    </div>
  </section>`;
}

function renderProfileLifeList(snapshot: ProfileSnapshot): string {
  const items = snapshot.lifeListPreview;
  if (items.length === 0) {
    return `<section class="section" data-testid="profile-life-list">
      <div class="section-header"><div><div class="eyebrow">Life List</div><h2>見てきた生きもの</h2></div></div>
      <div class="onboarding-empty">
        <div class="eyebrow">まだ 0 種</div>
        <h3>名前が分からない記録から始められます</h3>
        <p>観察に名前が付くと、ここに自分の Life List としてまとまります。</p>
      </div>
    </section>`;
  }
  return `<section class="section" data-testid="profile-life-list">
    <div class="section-header"><div><div class="eyebrow">Life List</div><h2>見てきた生きもの</h2></div></div>
    <div class="profile-life-grid">
      ${items.map((item) => `<div class="profile-life-card">
        ${item.photoUrl
          ? `<div class="profile-life-media"><img class="profile-life-thumb" src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div class="profile-life-placeholder" hidden>Life List</div></div>`
          : `<div class="profile-life-placeholder">Life List</div>`}
        <div class="profile-life-body">
          <strong>${escapeHtml(item.displayName)}</strong>
          <span>${item.scientificName ? escapeHtml(item.scientificName) + " · " : ""}${escapeHtml(formatProfileNumber(item.observationCount))} 件</span>
          <span>最新: ${escapeHtml(formatShortDate(item.latestObservedAt, "ja-JP") || item.latestObservedAt)}</span>
        </div>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderProfileReferenceLibrary(basePath: string, summary: ReferenceProfileSummary | null = null): string {
  const recent = summary?.recent[0] ?? null;
  return `<section class="section" data-testid="profile-reference-library">
    <div class="section-header"><div><div class="eyebrow">References</div><h2>所有確認済み資料</h2></div></div>
    <div class="profile-reference-shell">
      <div class="profile-reference-grid">
        <div class="profile-reference-stat"><span>所有確認済み</span><strong>${escapeHtml(formatProfileNumber(summary?.ownedVerifiedCount ?? 0))}</strong></div>
        <div class="profile-reference-stat"><span>要整理</span><strong>${escapeHtml(formatProfileNumber(summary?.needsReviewCount ?? 0))}</strong></div>
        <div class="profile-reference-recent">
          <span>最近の資料</span>
          <strong>${escapeHtml(recent?.title ?? "まだ登録はありません")}</strong>
          <p>${escapeHtml(recent ? `${recent.taxonLabels.slice(0, 3).join(" / ") || "分類群未整理"} · 同定 ${recent.usedCount}回` : "表紙/ISBNを登録すると、同定フォームで再利用できます。")}</p>
        </div>
      </div>
      <div class="profile-reading-actions">
        <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/references"))}">資料一覧を見る</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/references/capture"))}">表紙を連続登録</a>
      </div>
    </div>
  </section>`;
}

function renderSelfProfileHub(
  basePath: string,
  lang: SiteLang,
  snapshot: ProfileSnapshot,
  digest: ProfileNoteDigest | null = null,
  regionalStories: RegionalStoryCue[] = [],
  referenceSummary: ReferenceProfileSummary | null = null,
): string {
  return `${renderProfileChannelHero(basePath, snapshot)}
    ${renderProfileIntro(basePath, snapshot, true)}
    ${renderProfileNextActions(basePath, snapshot, digest)}
    ${renderProfileReferenceLibrary(basePath, referenceSummary)}
    ${renderProfileLifeList(snapshot)}
    ${renderProfilePlaceStories(regionalStories)}
    ${renderProfileHistory(snapshot)}
    ${renderProfileGrowth(snapshot, digest)}
    ${renderProfileSummary(snapshot)}
    ${renderProfileContribution(basePath, snapshot, digest)}`;
}

function renderProfileSettingsForm(basePath: string, snapshot: ProfileSnapshot): string {
  const endpoint = withBasePath(basePath, "/api/v1/profile/me");
  const backHref = withBasePath(basePath, "/profile");
  const avatarFallback = (snapshot.displayName || "?").slice(0, 1);
  return `<section class="section" data-testid="profile-settings">
    <div class="profile-settings-card">
      <form class="profile-settings-form" data-profile-settings data-endpoint="${escapeHtml(endpoint)}">
        <div>
          <div class="eyebrow">Profile settings</div>
          <h2 style="margin:8px 0 0">プロフィール編集</h2>
          <p class="profile-settings-help" style="margin-top:8px">公開プロフィールとマイページの表示名、アイコン、自己紹介を更新します。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-avatar">アイコン</label>
          <div class="profile-settings-avatar">
            <div class="profile-settings-avatar-preview" data-avatar-preview>
              ${snapshot.avatarUrl ? `<img src="${escapeHtml(snapshot.avatarUrl)}" alt="" onerror="this.remove();this.parentElement.textContent=${escapeHtml(JSON.stringify(avatarFallback))}" />` : escapeHtml(avatarFallback)}
            </div>
            <div class="profile-settings-avatar-control">
              <input id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
              <p class="profile-settings-help">5MBまで。JPG / PNG / WebP / GIF を使えます。</p>
            </div>
          </div>
        </div>
        <div class="profile-settings-field">
          <label for="profile-display-name">表示名</label>
          <input id="profile-display-name" name="displayName" value="${escapeHtml(snapshot.displayName)}" maxlength="50" required autocomplete="name" />
          <p class="profile-settings-help">1-50文字。ヘッダー、マイページ、公開プロフィールに表示されます。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-expertise">関心分野</label>
          <input id="profile-expertise" name="expertise" value="${escapeHtml(snapshot.expertise ?? "")}" maxlength="120" placeholder="例: 里山の植物、都市鳥類、昆虫写真" />
          <p class="profile-settings-help">自分がよく見る対象や得意な観察領域を短く残します。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-bio">自己紹介</label>
          <textarea id="profile-bio" name="profileBio" maxlength="500" placeholder="観察している場所、見ている生きもの、記録の方針など">${escapeHtml(snapshot.profileBio ?? "")}</textarea>
          <p class="profile-settings-help">500文字まで。公開プロフィールの説明として使えます。</p>
        </div>
        <div class="actions">
          <button class="btn btn-solid" type="submit">保存する</button>
          <a class="btn btn-ghost" href="${escapeHtml(backHref)}">マイページへ戻る</a>
        </div>
        <div class="profile-settings-status" data-profile-settings-status role="status" aria-live="polite"></div>
      </form>
    </div>
  </section>
  <script>
(function () {
  const form = document.querySelector('[data-profile-settings]');
  if (!form) return;
  const status = form.querySelector('[data-profile-settings-status]');
  const endpoint = form.getAttribute('data-endpoint');
  const messages = {
    display_name_required: '表示名を入力してください。',
    display_name_too_long: '表示名は50文字以内で入力してください。',
    profile_bio_too_long: '自己紹介は500文字以内で入力してください。',
    expertise_too_long: '関心分野は120文字以内で入力してください。',
    avatar_invalid: 'アイコン画像を読み込めませんでした。',
    avatar_empty: 'アイコン画像が空です。',
    avatar_too_large: 'アイコン画像は5MB以内にしてください。',
    avatar_invalid_type: 'アイコンは JPG / PNG / WebP / GIF を選んでください。',
    session_required: 'ログインし直してください。'
  };
  const setStatus = (message, kind) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-success', kind === 'success');
  };
  const avatarInput = form.querySelector('input[name="avatar"]');
  const avatarPreview = form.querySelector('[data-avatar-preview]');
  let selectedAvatar = null;
  const readAvatar = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!/^image\\/(jpeg|png|webp|gif)$/.test(file.type || '')) {
      return reject(new Error(messages.avatar_invalid_type));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error(messages.avatar_too_large));
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name || 'avatar',
      mimeType: file.type || 'image/jpeg',
      base64Data: String(reader.result || '')
    });
    reader.onerror = () => reject(new Error(messages.avatar_invalid));
    reader.readAsDataURL(file);
  });
  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files ? Array.from(avatarInput.files)[0] || null : null;
      try {
        selectedAvatar = await readAvatar(file);
        if (selectedAvatar && avatarPreview) {
          avatarPreview.innerHTML = '';
          const image = document.createElement('img');
          image.alt = '';
          image.src = selectedAvatar.base64Data;
          avatarPreview.appendChild(image);
        }
        setStatus('', '');
      } catch (error) {
        selectedAvatar = null;
        avatarInput.value = '';
        setStatus(error instanceof Error ? error.message : messages.avatar_invalid, 'error');
      }
    });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!endpoint) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setStatus('保存しています。', '');
    const data = new FormData(form);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: String(data.get('displayName') || ''),
          expertise: String(data.get('expertise') || ''),
          profileBio: String(data.get('profileBio') || ''),
          avatar: selectedAvatar
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok === false) {
        const key = payload && payload.error ? payload.error : 'profile_update_failed';
        throw new Error(messages[key] || '保存に失敗しました。入力内容を確認してください。');
      }
      setStatus('保存しました。マイページへ戻れます。', 'success');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存に失敗しました。', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
</script>`;
}

function renderProfileSnapshotBody(
  basePath: string,
  lang: SiteLang,
  viewerUserId: string | null | undefined,
  snapshot: ProfileSnapshot,
  mode: "registered" | "guest" = "registered",
): string {
  const places = renderPlaceRows(
    basePath,
    lang,
    viewerUserId,
    snapshot.recentPlaces,
    "まだ場所の記録はありません。",
  );
  const observations = snapshot.recentObservations.map((item) => `
      <div class="row">
        <div>
          <a style="font-weight:800;color:inherit;text-decoration:none" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">${escapeHtml(formatTaxonDisplayName(item, lang).primaryLabel)}</a>
          <div class="meta">${escapeHtml(formatPlaceDisplay(item, lang, viewerUserId ? "owner" : "public"))} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <div class="actions">
          <span class="pill">${escapeHtml(formatIdentificationCount(item.identificationCount, lang))}</span>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)) + "#identify")}">同定する</a>
        </div>
      </div>`).join("");
  const guestIntro = mode === "guest"
    ? `<section class="section"><div class="card is-soft"><div class="card-body stack">
        <div class="eyebrow">Guest notebook</div>
        <h2>匿名のまま残された、小さな記録</h2>
        <p class="meta">Guest の記録はアカウントのプロフィールではなく、公開された観察レコードと場所の履歴だけで読める簡易ライブラリとして表示します。名前よりも、何を見つけ、どこを歩いたかを中心に残します。</p>
      </div></div></section>`
    : "";

  return `${guestIntro}
      ${mode === "registered" ? renderProfileIntro(basePath, snapshot) : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">記録</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`;
}

function notesEntryDate(obs: LandingObservation): string {
  return (obs.entryType === "identification" ? obs.identifiedAt : obs.observedAt) ?? obs.observedAt;
}

function notesEntryKind(obs: LandingObservation, lang: SiteLang = "ja"): string {
  if (lang === "ja") return obs.entryType === "identification" ? "同定メモ" : "観察ページ";
  if (lang === "es") return obs.entryType === "identification" ? "Nota de ID" : "Página de observación";
  if (lang === "pt-BR") return obs.entryType === "identification" ? "Nota de ID" : "Página de observação";
  return obs.entryType === "identification" ? "ID note" : "Observation page";
}

function notesDetailHref(basePath: string, lang: SiteLang, obs: LandingObservation): string {
  return appendLangToHref(
    withBasePath(
      basePath,
      buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
    ),
    lang,
  );
}

function notesPlaceLine(obs: LandingObservation, lang: SiteLang, locationMode: "owner" | "public"): string {
  return formatPlaceDisplay({
    placeName: obs.placeName,
    municipality: obs.municipality,
    publicLocation: obs.publicLocation,
  }, lang, locationMode);
}

function notesPhotoUrls(obs: LandingObservation, preset: "sm" | "md"): string[] {
  const sourceUrls = Array.isArray(obs.photoUrls) && obs.photoUrls.length > 0
    ? obs.photoUrls
    : (obs.photoUrl ? [obs.photoUrl] : []);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const sourceUrl of sourceUrls) {
    const url = toThumbnailUrl(sourceUrl, preset) ?? sourceUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function notesPhotoCount(obs: LandingObservation): number {
  const declared = Number(obs.photoCount ?? 0);
  if (Number.isFinite(declared) && declared > 0) return Math.round(declared);
  return notesPhotoUrls(obs, "sm").length;
}

function renderNotesMiniCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { locationMode: "owner" | "public" },
): string {
  const href = notesDetailHref(basePath, lang, obs);
  const displayName = formatTaxonDisplayName({
    vernacularName: obs.vernacularName,
    scientificName: obs.scientificName,
    displayName: obs.displayName,
    aiCandidateName: obs.aiCandidateName,
    fallback: obs.proposedName ?? "名前を確かめているページ",
  }, lang).primaryLabel;
  const dateLabel = formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
  const placeLine = notesPlaceLine(obs, lang, options.locationMode);
  const photoUrls = notesPhotoUrls(obs, "sm");
  const photoCount = notesPhotoCount(obs);
  const entryKind = notesEntryKind(obs, lang);
  const photo = photoUrls[0]
    ? `<span class="notes-thumb"><img src="${escapeHtml(photoUrls[0])}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden>${escapeHtml(entryKind.slice(0, 1))}</span>${photoCount > 1 ? `<b class="notes-thumb-count">${escapeHtml(formatNotesNumber(photoCount, lang))}</b>` : ""}</span>`
    : `<span class="notes-thumb notes-thumb-empty">${escapeHtml(entryKind.slice(0, 1))}</span>`;
  const observerLine = obs.observerName ? `${formatActorDisplay(obs.observerName, lang)} · ` : "";
  const needsNameLine = lang === "ja" ? "名前を見返す余地あり" : lang === "es" ? "Nombre por revisar" : lang === "pt-BR" ? "Nome a revisar" : "Name to review";
  const supportLine = obs.entryType === "identification"
    ? `${observerLine}${obs.proposedName ? `${obs.proposedName} · ` : ""}${dateLabel}`
    : `${observerLine}${obs.identificationCount > 0 ? `${formatIdentificationCount(obs.identificationCount, lang)} · ` : `${needsNameLine} · `}${dateLabel}`;
  return `<a class="notes-page-card" href="${escapeHtml(href)}" data-entry-type="${escapeHtml(obs.entryType ?? "observation")}">
    ${photo}
    <span class="notes-page-copy">
      <span class="notes-page-kicker">${escapeHtml(entryKind)}</span>
      <strong>${escapeHtml(displayName)}</strong>
      <span>${escapeHtml(placeLine)}</span>
      <em>${escapeHtml(supportLine)}</em>
    </span>
  </a>`;
}

function notesLibraryMonthKey(obs: LandingObservation): string {
  const date = notesEntryDate(obs);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "unknown";
}

function notesLibraryMonthLabel(key: string, lang: SiteLang): string {
  if (key === "unknown") return lang === "ja" ? "日付なし" : "Undated";
  const [year, month] = key.split("-");
  if (lang === "ja") return `${year}年${Number(month)}月`;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(`${key}-01T00:00:00Z`));
}

function notesLibraryDateLabel(obs: LandingObservation, lang: SiteLang): string {
  return formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
}

function notesLibraryIsUncertain(obs: LandingObservation): boolean {
  const name = (obs.displayName || obs.proposedName || "").trim();
  return obs.isAiCandidate === true
    || obs.identificationCount === 0
    || name === ""
    || name === "同定待ち"
    || /awaiting id|unknown|unresolved/i.test(name);
}

function notesLibrarySourceKind(obs: LandingObservation): NonNullable<LandingObservation["librarySourceKind"]> {
  if (obs.librarySourceKind) return obs.librarySourceKind;
  if (obs.hasVideo) return "video";
  if (notesPhotoCount(obs) > 0) return "photo";
  return "note";
}

function notesLibrarySourceLabel(kind: NonNullable<LandingObservation["librarySourceKind"]>, lang: SiteLang): string {
  return notesLibraryCopy(lang).sourceLabels[kind] ?? notesLibraryCopy(lang).sourceLabels.note;
}

function notesCivicContextLabel(context: CivicObservationContext, lang: SiteLang): string {
  if (context.activityLabel) return context.activityLabel;
  if (lang === "ja") return civicContextLabel(context);
  const labels: Record<Exclude<SiteLang, "ja">, Partial<Record<CivicObservationContext["contextKind"], string>> & { revisit: string; fallback: string }> = {
    en: {
      event: "Event record",
      school: "School/class nature note",
      satoyama: "Management and observation record",
      risk: "Record needing review",
      site_summary: "First nature summary for this place",
      revisit: "Revisit record for this place",
      fallback: "Field note",
    },
    es: {
      event: "Registro de evento",
      school: "Nota natural de escuela/clase",
      satoyama: "Registro de manejo y observación",
      risk: "Registro que necesita revisión",
      site_summary: "Primer resumen natural de este lugar",
      revisit: "Revisita de este lugar",
      fallback: "Nota de campo",
    },
    "pt-BR": {
      event: "Registro de evento",
      school: "Nota de natureza da escola/turma",
      satoyama: "Registro de manejo e observação",
      risk: "Registro que precisa de revisão",
      site_summary: "Primeiro resumo natural deste lugar",
      revisit: "Revisita deste lugar",
      fallback: "Nota de campo",
    },
  };
  const copy = labels[lang];
  if (context.activityIntent === "revisit") return copy.revisit;
  return copy[context.contextKind] ?? copy.fallback;
}

function renderNotesLibraryCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext> },
): string {
  const copy = notesLibraryCopy(lang);
  const href = notesDetailHref(basePath, lang, obs);
  const canOwnerHide = options.locationMode === "owner" && obs.entryType !== "identification";
  const hideEndpoint = withBasePath(basePath, `/api/v1/observations/${encodeURIComponent(obs.visitId)}/hide`);
  const displayName = formatTaxonDisplayName({
    vernacularName: obs.vernacularName,
    scientificName: obs.scientificName,
    displayName: obs.displayName,
    aiCandidateName: obs.aiCandidateName,
    fallback: obs.proposedName ?? copy.card.fallbackName,
  }, lang).primaryLabel;
  const placeLine = notesPlaceLine(obs, lang, options.locationMode);
  const observerLine = obs.observerName ? `${formatActorDisplay(obs.observerName, lang)} · ` : "";
  const photoUrls = notesPhotoUrls(obs, "md");
  const photoCount = notesPhotoCount(obs);
  const dateLabel = notesLibraryDateLabel(obs, lang);
  const isUncertain = notesLibraryIsUncertain(obs);
  const sourceKind = notesLibrarySourceKind(obs);
  const sourceLabel = notesLibrarySourceLabel(sourceKind, lang);
  const civicContext = options.civicContexts?.get(obs.visitId);
  const civicLabel = civicContext ? notesCivicContextLabel(civicContext, lang) : "";
  const filters = [
    "all",
    sourceKind,
    photoCount > 0 ? "photos" : "no-photo",
    isUncertain ? "uncertain" : "named",
    obs.identificationCount > 0 || obs.entryType === "identification" ? "identified" : "needs-id",
  ].join(" ");
  const searchable = `${displayName} ${placeLine} ${obs.observerName} ${dateLabel} ${sourceLabel} ${civicLabel}`.toLowerCase();
  const visiblePhotos = photoUrls.slice(0, 4);
  const photo = visiblePhotos.length > 1
    ? `<span class="notes-library-photo-stack">${visiblePhotos.map((url, index) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(`${displayName} ${notesPhotoAltIndex(index + 1, lang)}`)}" loading="lazy" decoding="async" onerror="this.remove()" />`).join("")}</span><b class="notes-library-photo-count">${escapeHtml(notesPhotoCountLabel(photoCount, lang))}</b>`
    : visiblePhotos[0]
      ? `<img src="${escapeHtml(visiblePhotos[0])}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.closest('.notes-library-card').classList.add('is-photo-missing');this.remove()" />${photoCount > 1 ? `<b class="notes-library-photo-count">${escapeHtml(notesPhotoCountLabel(photoCount, lang))}</b>` : ""}`
    : `<span class="notes-library-placeholder">${escapeHtml(sourceLabel.slice(0, 1))}</span>`;
  const ownerMenu = canOwnerHide
    ? `<details class="notes-library-card-menu">
        <summary aria-label="${escapeHtml(copy.card.menuAria)}"><span aria-hidden="true"></span></summary>
        <div class="notes-library-card-menu-panel">
          <a href="${escapeHtml(href)}">${escapeHtml(copy.card.detail)}</a>
          <button type="button" data-owner-hide-observation data-hide-endpoint="${escapeHtml(hideEndpoint)}">${escapeHtml(copy.card.delete)}</button>
        </div>
      </details>`
    : "";
  return `<article class="notes-library-card is-source-${escapeHtml(sourceKind)}${photoCount > 0 ? "" : " is-photo-missing"}" data-library-card data-filter="${escapeHtml(filters)}" data-search="${escapeHtml(searchable)}">
    <a class="notes-library-card-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(displayName)}">
      <span class="notes-library-photo">${photo}</span>
      <span class="notes-library-overlay">
        <span class="notes-library-badges">
          <b class="notes-source-badge is-source-${escapeHtml(sourceKind)}">${escapeHtml(sourceLabel)}</b>
          ${civicLabel ? `<b class="notes-context-badge">${escapeHtml(civicLabel)}</b>` : ""}
          ${isUncertain ? `<b>${escapeHtml(copy.card.uncertainBadge)}</b>` : `<b>${escapeHtml(copy.card.namedBadge)}</b>`}
          ${obs.identificationCount > 0 ? `<b>${escapeHtml(formatIdentificationCount(obs.identificationCount, lang))}</b>` : ""}
        </span>
        <strong>${escapeHtml(displayName)}</strong>
        <em>${escapeHtml(`${observerLine}${placeLine || copy.card.fallbackPlace} · ${dateLabel}`)}</em>
      </span>
    </a>
    ${ownerMenu}
  </article>`;
}

function renderNotesLibraryMonths(
  basePath: string,
  lang: SiteLang,
  entries: LandingObservation[],
  options: { locationMode: "owner" | "public"; civicContexts?: Map<string, CivicObservationContext>; showMonthCount?: boolean },
): string {
  if (entries.length === 0) {
    return `<div class="notes-library-empty">${escapeHtml(notesLibraryCopy(lang).emptyLibrary)}</div>`;
  }
  const groups = new Map<string, LandingObservation[]>();
  for (const entry of entries) {
    const key = notesLibraryMonthKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries()).map(([key, items]) => `<section class="notes-library-month" data-library-month>
    <div class="notes-library-month-head">
      <h2>${escapeHtml(notesLibraryMonthLabel(key, lang))}</h2>
      ${options.showMonthCount === false ? "" : `<span>${escapeHtml(notesItemCountLabel(items.length, lang))}</span>`}
    </div>
    <div class="notes-library-grid">
      ${items.map((obs) => renderNotesLibraryCard(basePath, lang, obs, options)).join("")}
    </div>
  </section>`).join("");
}

function renderNotesLibraryControls(lang: SiteLang): string {
  const copy = notesLibraryCopy(lang);
  const filterToggleLabel = lang === "ja" ? "絞る" : lang === "en" ? "Filter" : lang === "es" ? "Filtrar" : "Filtrar";
  return `<section class="notes-library-controls" aria-label="${escapeHtml(copy.controls.aria)}">
    <div class="notes-library-search">
      <span aria-hidden="true">⌕</span>
      <input type="search" placeholder="${escapeHtml(copy.controls.searchPlaceholder)}" data-library-search />
    </div>
    <input class="notes-library-filter-toggle" type="checkbox" id="notes-library-filter-toggle" aria-label="${escapeHtml(copy.controls.filterAria)}" />
    <label class="notes-library-filter-label" for="notes-library-filter-toggle">${escapeHtml(filterToggleLabel)}</label>
    <div class="notes-library-filters" role="group" aria-label="${escapeHtml(copy.controls.filterAria)}">
      <button type="button" class="is-active" data-library-filter="all">${escapeHtml(copy.controls.all)}</button>
      <button type="button" data-library-filter="photo">${escapeHtml(copy.controls.photo)}</button>
      <button type="button" data-library-filter="video">${escapeHtml(copy.controls.video)}</button>
      <button type="button" data-library-filter="guide">${escapeHtml(copy.controls.guide)}</button>
      <button type="button" data-library-filter="scan">${escapeHtml(copy.controls.scan)}</button>
      <button type="button" data-library-filter="uncertain">${escapeHtml(copy.controls.uncertain)}</button>
      <button type="button" data-library-filter="identified">${escapeHtml(copy.controls.identified)}</button>
    </div>
  </section>`;
}

function renderNotesLibrarySourceLanes(entries: LandingObservation[], lang: SiteLang): string {
  const counts = new Map<NonNullable<LandingObservation["librarySourceKind"]>, number>();
  for (const entry of entries) {
    const kind = notesLibrarySourceKind(entry);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const lanes: Array<NonNullable<LandingObservation["librarySourceKind"]>> = ["photo", "video", "guide", "scan", "note"];
  const copy = notesLibraryCopy(lang);
  return `<div class="notes-library-source-lanes" aria-label="${escapeHtml(copy.controls.sourceLanesAria)}">
    ${lanes.map((kind) => `<button type="button" class="notes-library-source-lane is-source-${escapeHtml(kind)}" data-library-filter="${escapeHtml(kind)}">
      <span>${escapeHtml(notesLibrarySourceLabel(kind, lang))}</span>
      <strong>${escapeHtml(formatNotesNumber(counts.get(kind) ?? 0, lang))}</strong>
    </button>`).join("")}
  </div>`;
}

function renderNotesLibraryPlaceAlbums(snapshot: LandingSnapshot, lang: SiteLang): string {
  const copy = notesLibraryCopy(lang);
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
      <div class="notes-library-section-head"><div><span>${escapeHtml(copy.sections.placesEyebrow)}</span><h2>${escapeHtml(copy.sections.placesTitle)}</h2></div></div>
      <div class="notes-library-empty">${escapeHtml(copy.sections.placesEmpty)}</div>
    </section>`;
  }
  const albums = snapshot.myPlaces.slice(0, 10).map((place) => {
    const focus = pickPlaceFocus(place);
    return `<button type="button" class="notes-library-album" data-library-place="${escapeHtml(place.placeName)}">
      <span>${escapeHtml(place.municipality || copy.card.fallbackPlace)}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <em>${escapeHtml(notesItemCountLabel(place.visitCount, lang))}${focus ? ` · ${escapeHtml(focus)}` : ""}</em>
    </button>`;
  }).join("");
  return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
    <div class="notes-library-section-head"><div><span>${escapeHtml(copy.sections.placesEyebrow)}</span><h2>${escapeHtml(copy.sections.placesTitle)}</h2></div><p>${escapeHtml(copy.sections.placesLead)}</p></div>
    <div class="notes-library-album-row">${albums}</div>
  </section>`;
}

function renderNotesLibraryScript(lang: SiteLang): string {
  const copy = notesLibraryCopy(lang).card;
  return `<script>
(function () {
  const messages = ${JSON.stringify({
    deleteConfirm: copy.deleteConfirm,
    deleting: copy.deleting,
    delete: copy.delete,
    deleteFailedPrefix: copy.deleteFailedPrefix,
  })};
  const root = document.querySelector('[data-notes-library]');
  if (!root) return;
  const search = root.querySelector('[data-library-search]');
  const count = root.querySelector('[data-library-visible-count]');
  const cards = Array.from(root.querySelectorAll('[data-library-card]'));
  const months = Array.from(root.querySelectorAll('[data-library-month]'));
  const filterButtons = Array.from(root.querySelectorAll('[data-library-filter]'));
  let activeFilter = 'all';
  function apply() {
    const query = search ? String(search.value || '').trim().toLowerCase() : '';
    let visible = 0;
    cards.forEach(function (card) {
      const filters = String(card.getAttribute('data-filter') || '');
      const haystack = String(card.getAttribute('data-search') || '');
      const okFilter = activeFilter === 'all' || filters.split(/\\s+/).indexOf(activeFilter) >= 0;
      const okSearch = !query || haystack.indexOf(query) >= 0;
      const show = okFilter && okSearch && card.getAttribute('data-owner-hidden') !== 'true';
      card.hidden = !show;
      if (show) visible += 1;
    });
    months.forEach(function (month) {
      month.hidden = !month.querySelector('[data-library-card]:not([hidden])');
    });
    if (count) count.textContent = String(visible);
  }
  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeFilter = button.getAttribute('data-library-filter') || 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b === button); });
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
  document.querySelectorAll('[data-library-place]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!search) return;
      search.value = button.getAttribute('data-library-place') || '';
      activeFilter = 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-library-filter') === 'all'); });
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      apply();
    });
  });
  root.addEventListener('toggle', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLDetailsElement) || !target.classList.contains('notes-library-card-menu') || !target.open) return;
    root.querySelectorAll('.notes-library-card-menu[open]').forEach(function (details) {
      if (details !== target) details.removeAttribute('open');
    });
  }, true);
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.notes-library-card-menu')) return;
    root.querySelectorAll('.notes-library-card-menu[open]').forEach(function (details) {
      details.removeAttribute('open');
    });
  });
  root.addEventListener('click', function (event) {
    var button = event.target instanceof Element ? event.target.closest('[data-owner-hide-observation]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    var endpoint = button.getAttribute('data-hide-endpoint') || '';
    var card = button.closest('[data-library-card]');
    if (!endpoint || !card) return;
    if (!window.confirm(messages.deleteConfirm)) return;
    button.disabled = true;
    button.textContent = messages.deleting;
    fetch(endpoint, {
      method: 'POST',
      headers: { accept: 'application/json' },
      credentials: 'same-origin'
    }).then(function (response) {
      return response.json().catch(function(){ return {}; }).then(function (json) {
        if (!response.ok || !json || json.ok === false) {
          throw new Error(String((json && json.error) || response.status || 'delete_failed'));
        }
        card.hidden = true;
        card.setAttribute('data-owner-hidden', 'true');
        apply();
      });
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = messages.delete;
      window.alert(messages.deleteFailedPrefix + String(error && error.message || 'network'));
    });
  });
  apply();
})();
</script>`;
}

function renderNotesReadingBrief(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const latest = snapshot.myFeed[0] ?? snapshot.feed[0] ?? null;
  const firstPlace = snapshot.myPlaces[0] ?? null;
  const supportedCount = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const latestHref = latest ? notesDetailHref(basePath, lang, latest) : appendLangToHref(withBasePath(basePath, "/records?view=public"), lang);
  const latestName = latest?.displayName || "近くのページ";
  const latestPlace = latest ? notesPlaceLine(latest, lang, snapshot.viewerUserId ? "owner" : "public") : "この地域";
  const latestDate = latest ? (formatShortDate(notesEntryDate(latest), "ja-JP") || "最近") : "今日";
  const placeName = firstPlace?.placeName ?? "まだ章になっていない場所";
  const digestPlace = digest?.placeChapters[0] ?? null;
  const placeMemory = digestPlace?.readingAngle || (firstPlace
    ? `${firstPlace.visitCount} 回分の記憶があり、${buildPlaceNextLine(firstPlace)}。`
    : "場所の章はまだ薄い。でも近くのページを読むだけでも、同じ道を見返す感覚は先に掴める。");
  const learningLine = digest?.learningHighlight || (supportedCount > 0
    ? `${supportedCount} 件のページで、名前や同定の手がかりが育っています。`
    : "名前が揺れているページも、次に分かる楽しみとして残っています。");
  const contributionLine = digest?.localContribution || (snapshot.viewerUserId
    ? `${formatProfileNumber(ownObservationPages)} ページと ${formatProfileNumber(snapshot.myPlaces.length)} つの場所が、地域を読み返す材料になっています。`
    : `${formatProfileNumber(snapshot.stats.observationCount)} 件の公開ページが、地域の自然を読める形で残っています。`);
  const digestLead = digest?.todayReading
    || `${latestPlace} の ${latestDate} のページを起点に読むと、ただの一覧ではなく「前に何を見て、何が分かり、地域に何が残ったか」までつながって見えます。`;
  const digestQuote = digest?.growthStory || "記録は単なる保存履歴ではなく、同じ場所をもう一度おもしろくするための読み物です。";
  const readingOrder = [
    { label: "前回のページ", value: `${latestDate} の ${latestName}` },
    { label: "場所の章", value: placeName },
    { label: "学び", value: supportedCount > 0 ? "名前が育ったページ" : "まだ名前が揺れているページ" },
    { label: "地域への効き方", value: snapshot.viewerUserId ? "自分の足あとが残した手がかり" : "公開記録が残した手がかり" },
  ];
  return `<section id="notes-reading" class="section notes-reading" data-testid="notes-reading-brief">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">読むための記録</div><h2>今日読むページ</h2></div>
      <p>ここだけ読めば、前回のページ、場所の記憶、学び、地域への効き方までひと通り分かるようにします。</p>
    </div>
    <div class="notes-digest-shell">
      <article class="notes-digest-main">
        <div class="notes-digest-kicker">今日の読み筋</div>
        <h3>${escapeHtml(latestName)}から読む、今日の記録</h3>
        <p>${escapeHtml(digestLead)}</p>
        <blockquote>${escapeHtml(digestQuote)}</blockquote>
        <div class="notes-digest-story-grid">
          <div>
            <span>前回からの続き</span>
            <strong>${escapeHtml(placeName)}</strong>
            <p>${escapeHtml(placeMemory)}</p>
          </div>
          <div>
            <span>見えてきたこと</span>
            <strong>${escapeHtml(supportedCount > 0 ? "名前の手がかりが増えた" : "分からなさも残っている")}</strong>
            <p>${escapeHtml(learningLine)}</p>
          </div>
          <div>
            <span>世界や地域への効き方</span>
            <strong>この地域の観察レコードが少し厚くなった</strong>
            <p>${escapeHtml(contributionLine)}</p>
          </div>
        </div>
        <a class="notes-digest-link" href="${escapeHtml(latestHref)}">${escapeHtml(latest ? "このページを詳しく読む" : "近くのページを読む")}</a>
      </article>
      <aside class="notes-digest-rail" aria-label="今日の読み順">
        <div class="notes-digest-rail-head">今日の読み順</div>
        ${readingOrder.map((item, index) => `<div class="notes-reading-step">
          <b>${index + 1}</b>
          <span><em>${escapeHtml(item.label)}</em><strong>${escapeHtml(item.value)}</strong></span>
        </div>`).join("")}
        <div class="notes-digest-score">
          <strong>${escapeHtml(formatProfileNumber(snapshot.viewerUserId ? ownObservationPages : snapshot.stats.observationCount))}</strong>
          <span>${escapeHtml(snapshot.viewerUserId ? "自分のページ" : "公開ページ")}</span>
        </div>
      </aside>
    </div>
  </section>`;
}

function renderNotesLearningHighlights(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownEntries = snapshot.myFeed;
  const uniqueNames = new Set(ownEntries.map((obs) => obs.displayName).filter(Boolean));
  const supportedCount = ownEntries.filter((obs) => obs.identificationCount > 0).length;
  const identificationMemos = ownEntries.filter((obs) => obs.entryType === "identification").length;
  const openQuestions = ownEntries.filter((obs) => obs.identificationCount === 0 && obs.entryType !== "identification").length;
  const cards = [
    {
      value: formatProfileNumber(uniqueNames.size),
      label: "よく見返せる生きもの",
      body: uniqueNames.size > 0 ? "名前の並びが、自分の観察テーマになっていきます。" : "近くのページを読むほど、見たい対象が見つかります。",
    },
    {
      value: formatProfileNumber(supportedCount),
      label: "同定が育ったページ",
      body: supportedCount > 0 ? "候補名や人の同定が、読み返す手がかりになります。" : "まだ揺れている名前も、学びの余白として残ります。",
    },
    {
      value: formatProfileNumber(openQuestions),
      label: "まだ名前が揺れている記録",
      body: "分からないまま残るページは、次に分かる楽しみを作ります。",
    },
    {
      value: formatProfileNumber(identificationMemos),
      label: "自分が残した同定メモ",
      body: "誰かのページに残した見立ても、自分の学びの履歴です。",
    },
  ];
  return `<section id="notes-learning" class="section notes-page" data-testid="notes-learning">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">学びのハイライト</div><h2>前より見えてきたこと</h2></div>
      <p>${escapeHtml(digest?.learningHighlight || "正解数ではなく、見返すたびに増える観点を並べます。")}</p>
    </div>
    <div class="notes-metric-grid">
      ${cards.map((card) => `<div class="notes-metric-card">
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.label)}</span>
        <p>${escapeHtml(card.body)}</p>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderNotesContributionSummary(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const placeCount = snapshot.myPlaces.length;
  const weekCount = snapshot.habit?.thisWeekCount ?? 0;
  const supportedPages = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const cards = snapshot.viewerUserId
    ? [
      { value: formatProfileNumber(ownObservationPages), label: "地域に残したページ" },
      { value: formatProfileNumber(placeCount), label: "場所の章" },
      { value: formatProfileNumber(weekCount), label: "今週読める足あと" },
      { value: formatProfileNumber(supportedPages), label: "同定の手がかり" },
    ]
    : [
      { value: formatProfileNumber(snapshot.stats.observationCount), label: "公開されているページ" },
      { value: formatProfileNumber(snapshot.stats.speciesCount), label: "見えてきた生きもの" },
      { value: formatProfileNumber(snapshot.stats.placeCount), label: "場所の記憶" },
      { value: formatProfileNumber(snapshot.feed.filter((obs) => obs.identificationCount > 0).length), label: "同定の手がかり" },
    ];
  return `<section id="notes-impact" class="section notes-impact" data-testid="notes-impact">
    <div class="notes-impact-band">
      <div>
        <div class="notes-eyebrow">地域に残った手がかり</div>
        <h2>キミの記録で、この地域の観察レコードが少し厚くなった</h2>
        <p>${escapeHtml(digest?.contributionStory || "大げさに言い切らず、いま見えている観察・場所・同定の範囲で、役立ったことだけを返します。")}</p>
      </div>
      <div class="notes-impact-grid">
        ${cards.map((card) => `<div><strong>${escapeHtml(card.value)}</strong><span>${escapeHtml(card.label)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderNotesPlaceChapters(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
      <div class="notes-section-head"><div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div></div>
      <div class="notes-empty-reading">場所の章はまだありません。近くのページを読むと、同じ場所を何度も見返す面白さが分かります。</div>
    </section>`;
  }
  const digestByPlace = new Map((digest?.placeChapters ?? []).map((chapter) => [chapter.placeName, chapter]));
  const chapters = snapshot.myPlaces.map((place) => {
    const focus = pickPlaceFocus(place);
    const digestChapter = digestByPlace.get(place.placeName);
    const compared = place.previousObservedAt
      ? `前回 ${formatShortDate(place.previousObservedAt, "ja-JP")}`
      : "この場所の最初のページ";
    const href = appendLangToHref(withBasePath(basePath, "/records?view=mine"), lang);
    const localClue = digestChapter?.localClue
      || `${place.visitCount} 回分のページが、この場所をあとから読める手がかりになっています。`;
    return `<a class="notes-place-chapter" href="${escapeHtml(href)}">
      <span class="notes-place-topline">${escapeHtml(place.municipality || "地域")}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <span>前回見たもの: ${escapeHtml(place.latestDisplayName || "まだ名前を確かめているページ")}</span>
      <span>${escapeHtml(compared)} · ${escapeHtml(String(place.visitCount))} 回分</span>
      <em>${escapeHtml(digestChapter?.readingAngle || (focus ? `次に読む観点: ${focus}` : "次に読む観点: 小さな変化"))}</em>
      <span>地域への手がかり: ${escapeHtml(localClue)}</span>
      <b>この場所を読む</b>
    </a>`;
  }).join("");
  return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div>
      <p>よく歩く場所を、行き先ではなく読み返す章として並べます。</p>
    </div>
    <div class="notes-place-grid">${chapters}</div>
  </section>`;
}

const NOTES_READING_STYLES = `
  .notes-page { margin-top: 24px; }
  .notes-section-head { display: grid; grid-template-columns: minmax(0,.74fr) minmax(240px,.26fr); gap: 18px; align-items: end; margin-bottom: 18px; }
  .notes-section-head h2 { margin: 6px 0 0; color: #1a2e1f; font-size: clamp(27px,3vw,42px); line-height: 1.12; letter-spacing: 0; }
  .notes-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 680; }
  .notes-eyebrow { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-digest-shell {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 14px;
    align-items: stretch;
  }
  .notes-digest-main, .notes-digest-rail {
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.84);
    box-shadow: 0 16px 38px rgba(15,23,42,.06);
  }
  .notes-digest-main {
    min-height: 360px;
    padding: clamp(20px, 3vw, 30px);
    display: grid;
    gap: 16px;
    align-content: start;
    background:
      linear-gradient(135deg, rgba(236,253,245,.74), rgba(255,255,255,.9) 45%, rgba(240,249,255,.72)),
      rgba(255,255,255,.86);
  }
  .notes-digest-kicker, .notes-digest-rail-head {
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-main h3 {
    margin: 0;
    max-width: 16ch;
    color: #1a2e1f;
    font-size: clamp(30px, 4.1vw, 56px);
    line-height: 1.05;
    letter-spacing: 0;
  }
  .notes-digest-main > p {
    margin: 0;
    max-width: 58em;
    color: #374151;
    line-height: 1.85;
    font-weight: 720;
  }
  .notes-digest-main blockquote {
    margin: 0;
    padding: 14px 16px;
    border-left: 4px solid #10b981;
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    color: #1a2e1f;
    font-size: 17px;
    line-height: 1.7;
    font-weight: 900;
  }
  .notes-digest-story-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .notes-digest-story-grid div {
    min-height: 154px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.78);
  }
  .notes-digest-story-grid span {
    display: block;
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-story-grid strong {
    display: block;
    margin-top: 8px;
    color: #1a2e1f;
    font-size: 16px;
    line-height: 1.35;
  }
  .notes-digest-story-grid p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.65;
    font-weight: 700;
  }
  .notes-digest-link {
    width: fit-content;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 900;
    box-shadow: 0 14px 30px rgba(16,37,26,.16);
  }
  .notes-digest-rail {
    padding: 16px;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .notes-reading-step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px;
    border-radius: 8px;
    background: rgba(236,253,245,.72);
  }
  .notes-reading-step b {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #10b981;
    color: #fff;
    line-height: 1;
  }
  .notes-reading-step em {
    display: block;
    color: #047857;
    font-style: normal;
    font-size: 11px;
    font-weight: 950;
  }
  .notes-reading-step strong {
    display: block;
    margin-top: 3px;
    color: #1a2e1f;
    font-size: 13px;
    line-height: 1.45;
  }
  .notes-digest-score {
    margin-top: 4px;
    padding: 14px;
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.14);
  }
  .notes-digest-score strong { display: block; color: #1a2e1f; font-size: 32px; line-height: 1; font-weight: 950; }
  .notes-digest-score span { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .notes-metric-card, .notes-place-chapter {
    min-height: 138px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
    text-decoration: none;
    color: inherit;
  }
  .notes-place-chapter:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(16,185,129,.1); }
  .notes-page-kicker, .notes-place-topline { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-metric-card strong { display: block; color: #1a2e1f; font-size: 30px; line-height: 1.05; font-weight: 950; }
  .notes-metric-card span { display: block; margin-top: 8px; color: #047857; font-size: 12px; font-weight: 900; }
  .notes-metric-card p { margin: 8px 0 0; color: #64748b; line-height: 1.65; font-size: 13px; }
  .notes-impact-band {
    display: grid;
    grid-template-columns: minmax(0,.62fr) minmax(320px,.38fr);
    gap: 18px;
    align-items: center;
    padding: 22px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.88));
    box-shadow: 0 18px 42px rgba(16,185,129,.09);
  }
  .notes-impact-band h2 { margin: 8px 0 0; color: #1a2e1f; font-size: clamp(26px,3vw,40px); line-height: 1.14; letter-spacing: 0; }
  .notes-impact-band p { margin: 12px 0 0; color: #475569; line-height: 1.8; font-weight: 700; }
  .notes-impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .notes-impact-grid div { padding: 14px; border-radius: 8px; background: rgba(255,255,255,.78); border: 1px solid rgba(16,185,129,.14); }
  .notes-impact-grid strong { display: block; color: #1a2e1f; font-size: 25px; line-height: 1.05; font-weight: 950; }
  .notes-impact-grid span { display: block; margin-top: 6px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-place-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .notes-place-chapter { display: grid; gap: 7px; min-height: 190px; }
  .notes-place-chapter strong { color: #1a2e1f; font-size: 19px; line-height: 1.32; }
  .notes-place-chapter span, .notes-place-chapter em { color: #64748b; font-style: normal; font-size: 13px; line-height: 1.55; }
  .notes-place-chapter b { width: fit-content; margin-top: 4px; color: #047857; font-size: 13px; }
  .notes-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .notes-grid.is-compact { grid-template-columns: 1fr; }
  .notes-page-card {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.86);
    box-shadow: 0 10px 24px rgba(15,23,42,.045);
    color: inherit;
    text-decoration: none;
  }
  .notes-thumb { position: relative; width: 58px; height: 58px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; background: #ecfdf5; color: #047857; font-weight: 950; }
  .notes-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-thumb-count { position: absolute; right: 4px; bottom: 4px; min-width: 21px; height: 21px; display: grid; place-items: center; padding: 0 5px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; line-height: 1; font-weight: 950; }
  .notes-page-copy { min-width: 0; display: grid; gap: 3px; }
  .notes-page-copy strong { color: #1a2e1f; font-size: 16px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-page-copy span:not(.notes-page-kicker), .notes-page-copy em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 720; }
  .notes-empty-reading { padding: 18px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  @media (max-width: 980px) {
    .notes-digest-shell, .notes-impact-band, .notes-section-head { grid-template-columns: 1fr; }
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid, .notes-impact-grid { grid-template-columns: 1fr; }
    .notes-section-head h2 { font-size: 28px; }
    .notes-digest-main h3 { font-size: 34px; max-width: 100%; }
  }
`;

const NOTES_LIBRARY_STYLES = `
  .shell.shell-notes-library {
    max-width: none;
    padding: 26px 0 28px;
  }
  .notes-library-shell { width: 100%; display: grid; gap: 24px; }
  .notes-library-hero {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 20px;
    align-items: center;
    padding: clamp(24px, 3vw, 36px);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.78));
    border: 1px solid rgba(16,185,129,.16);
  }
  .notes-library-hero span, .notes-library-section-head span { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-library-hero h1 { margin: 8px 0 0; color: #10251a; font-size: clamp(34px, 5vw, 64px); line-height: 1.03; letter-spacing: 0; }
  .notes-library-hero p { margin: 14px 0 0; max-width: 50em; color: #475569; line-height: 1.8; font-weight: 720; }
  .notes-library-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
  .notes-library-actions a { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 9px 12px; border-radius: 999px; background: #fff; border: 1px solid rgba(16,185,129,.16); color: #047857; font-size: 12px; font-weight: 950; text-decoration: none; }
  .notes-library-actions a:first-child { background: #10251a; color: #fff; border-color: #10251a; }
  .notes-experience-loop { display: grid; grid-template-columns: minmax(0, .32fr) minmax(0, .68fr); gap: 16px; align-items: stretch; padding: 18px; border-radius: 8px; background: #10251a; color: #fff; box-shadow: 0 18px 42px rgba(16,37,26,.13); }
  .notes-loop-head { display: grid; align-content: center; gap: 9px; }
  .notes-loop-head span { color: #86efac; font-size: 12px; font-weight: 950; }
  .notes-loop-head h2 { margin: 0; font-size: clamp(22px, 2.5vw, 34px); line-height: 1.16; letter-spacing: 0; }
  .notes-loop-head p { margin: 0; color: rgba(255,255,255,.76); line-height: 1.7; font-size: 13px; font-weight: 750; }
  .notes-loop-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .notes-loop-step { min-height: 190px; display: grid; align-content: start; gap: 8px; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); color: #fff; text-decoration: none; }
  .notes-loop-step:hover { background: rgba(255,255,255,.13); transform: translateY(-1px); }
  .notes-loop-step b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: #34d399; color: #10251a; font-size: 12px; font-weight: 950; }
  .notes-loop-step span { color: #86efac; font-size: 11px; font-weight: 950; }
  .notes-loop-step strong { color: #fff; font-size: 15px; line-height: 1.35; }
  .notes-loop-step em { color: rgba(255,255,255,.72); font-size: 12px; line-height: 1.55; font-style: normal; font-weight: 730; }
  .notes-loop-step i { align-self: end; width: fit-content; margin-top: 4px; padding: 5px 8px; border-radius: 999px; background: rgba(255,255,255,.12); color: #fff; font-size: 11px; line-height: 1; font-style: normal; font-weight: 950; }
  .notes-library-stats { align-self: center; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .notes-library-stats div { padding: 13px; border-radius: 8px; background: rgba(255,255,255,.82); border: 1px solid rgba(16,185,129,.13); }
  .notes-library-stats strong { display: block; color: #10251a; font-size: 24px; line-height: 1; font-weight: 950; }
  .notes-library-stats em { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-style: normal; font-weight: 850; }
  .notes-library-controls { position: sticky; top: 68px; z-index: 5; display: grid; grid-template-columns: minmax(220px, .34fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; background: rgba(255,255,255,.9); border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 30px rgba(15,23,42,.055); backdrop-filter: blur(16px); }
  .notes-library-search { min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .notes-library-search span { color: #047857; font-weight: 950; }
  .notes-library-search input { width: 100%; border: 0; outline: 0; background: transparent; color: #0f172a; font: inherit; font-weight: 750; }
  .notes-library-filter-toggle, .notes-library-filter-label { display: none; }
  .notes-library-filters { display: flex; flex-wrap: wrap; gap: 8px; }
  .notes-library-filters button { min-height: 38px; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #334155; font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
  .notes-library-filters button.is-active { background: #10251a; color: #fff; border-color: #10251a; }
  .notes-library-count { min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 900; white-space: nowrap; }
  .notes-library-count strong { color: #10251a; font-size: 18px; }
  .notes-library-source-lanes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .notes-library-source-lane { min-height: 72px; display: grid; align-content: center; gap: 5px; text-align: left; padding: 11px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.86); color: #334155; font: inherit; cursor: pointer; }
  .notes-library-source-lane span { font-size: 11px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane strong { color: #10251a; font-size: 22px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane.is-source-photo { border-color: rgba(16,185,129,.18); background: #ecfdf5; }
  .notes-library-source-lane.is-source-video { border-color: rgba(14,165,233,.18); background: #f0f9ff; }
  .notes-library-source-lane.is-source-guide { border-color: rgba(245,158,11,.2); background: #fffbeb; }
  .notes-library-source-lane.is-source-scan { border-color: rgba(20,184,166,.2); background: #f0fdfa; }
  .notes-library-source-lane.is-source-note { border-color: rgba(100,116,139,.16); background: #f8fafc; }
  .notes-library-section-head { display: grid; grid-template-columns: minmax(0, .7fr) minmax(220px, .3fr); gap: 16px; align-items: end; margin-bottom: 14px; }
  .notes-library-section-head h2, .notes-library-month-head h2 { margin: 5px 0 0; color: #10251a; font-size: clamp(24px, 2.6vw, 36px); line-height: 1.14; letter-spacing: 0; }
  .notes-library-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 700; }
  .notes-library-album-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 3px; scroll-snap-type: x proximity; }
  .notes-library-album { flex: 0 0 240px; min-height: 112px; display: grid; gap: 6px; text-align: left; padding: 14px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: rgba(255,255,255,.86); color: inherit; font: inherit; cursor: pointer; scroll-snap-align: start; }
  .notes-library-album span { color: #047857; font-size: 11px; font-weight: 950; }
  .notes-library-album strong { color: #10251a; font-size: 16px; line-height: 1.35; }
  .notes-library-album em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 800; }
  .notes-library-month { display: grid; gap: 12px; }
  .notes-library-month[hidden], .notes-library-card[hidden] { display: none; }
  .notes-library-month-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
  .notes-library-month-head span { color: #64748b; font-size: 12px; font-weight: 900; }
  .notes-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); grid-auto-flow: dense; gap: 10px; }
  .notes-library-card { position: relative; min-height: 184px; aspect-ratio: 1 / 1.12; overflow: hidden; border-radius: 8px; background: #ecfdf5; color: #fff; text-decoration: none; border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 28px rgba(15,23,42,.06); }
  .notes-library-card-link { position: absolute; inset: 0; display: block; color: inherit; text-decoration: none; }
  .notes-library-card:nth-child(7n + 1) { grid-row: span 2; aspect-ratio: 1 / 1.35; }
  .notes-library-card:hover { transform: translateY(-2px); box-shadow: 0 18px 36px rgba(16,185,129,.12); }
  .notes-library-photo { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(219,234,254,.9)); color: #047857; font-size: 34px; font-weight: 950; }
  .notes-library-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-library-photo-stack { width: 100%; height: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 2px; background: #0f172a; }
  .notes-library-photo-stack img { min-width: 0; min-height: 0; }
  .notes-library-photo-count { position: absolute; top: 9px; right: 9px; z-index: 1; padding: 5px 8px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; line-height: 1; font-weight: 950; box-shadow: 0 6px 16px rgba(15,23,42,.2); }
  .notes-library-card::after { content: ""; position: absolute; inset: 34% 0 0; background: linear-gradient(180deg, transparent, rgba(15,23,42,.78)); pointer-events: none; }
  .notes-library-card.is-photo-missing::after { background: linear-gradient(180deg, rgba(255,255,255,0), rgba(16,37,26,.18)); }
  .notes-library-overlay { position: absolute; inset: auto 0 0; z-index: 1; display: grid; gap: 5px; padding: 12px; }
  .notes-library-overlay strong { color: #fff; font-size: 15px; line-height: 1.25; text-shadow: 0 1px 9px rgba(0,0,0,.34); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-overlay em { color: rgba(255,255,255,.86); font-size: 11px; line-height: 1.35; font-style: normal; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-card.is-photo-missing .notes-library-overlay strong { color: #10251a; text-shadow: none; }
  .notes-library-card.is-photo-missing .notes-library-overlay em { color: #475569; }
  .notes-library-card-menu { position: absolute; top: 8px; right: 8px; z-index: 3; }
  .notes-library-card-menu summary { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.12); box-shadow: 0 8px 20px rgba(15,23,42,.18); cursor: pointer; list-style: none; }
  .notes-library-card-menu summary::-webkit-details-marker { display: none; }
  .notes-library-card-menu summary span,
  .notes-library-card-menu summary span::before,
  .notes-library-card-menu summary span::after { width: 4px; height: 4px; border-radius: 999px; background: #10251a; display: block; content: ""; }
  .notes-library-card-menu summary span { position: relative; }
  .notes-library-card-menu summary span::before { position: absolute; left: -7px; top: 0; }
  .notes-library-card-menu summary span::after { position: absolute; right: -7px; top: 0; }
  .notes-library-card-menu-panel { position: absolute; top: 40px; right: 0; min-width: 132px; display: grid; gap: 4px; padding: 7px; border-radius: 8px; background: #fff; border: 1px solid rgba(15,23,42,.1); box-shadow: 0 18px 38px rgba(15,23,42,.18); }
  .notes-library-card-menu-panel a,
  .notes-library-card-menu-panel button { min-height: 38px; display: flex; align-items: center; justify-content: flex-start; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: #10251a; font: inherit; font-size: 12px; font-weight: 900; text-align: left; text-decoration: none; cursor: pointer; white-space: nowrap; }
  .notes-library-card-menu-panel a:hover,
  .notes-library-card-menu-panel button:hover { background: #f1f5f9; }
  .notes-library-card-menu-panel button { color: #b91c1c; }
  .notes-library-card-menu-panel button[disabled] { opacity: .65; cursor: progress; }
  .notes-library-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .notes-library-badges b { width: fit-content; padding: 4px 7px; border-radius: 999px; background: rgba(255,255,255,.86); color: #065f46; font-size: 10px; line-height: 1; font-weight: 950; }
  .notes-library-badges .notes-context-badge { background: rgba(236,253,245,.94); color: #047857; }
  .notes-source-badge.is-source-video { color: #0369a1; }
  .notes-source-badge.is-source-guide { color: #92400e; }
  .notes-source-badge.is-source-scan { color: #0f766e; }
  .notes-source-badge.is-source-note { color: #475569; }
  .notes-library-empty { padding: 20px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  .notes-nearby-library { opacity: .9; }
  .notes-nearby-library .notes-library-grid { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); }
  .notes-nearby-library .notes-library-card { min-height: 150px; }
  @media (max-width: 980px) {
    .shell.shell-notes-library { padding: 20px 16px 22px; }
    .notes-library-hero, .notes-library-controls, .notes-library-section-head { grid-template-columns: 1fr; }
    .notes-experience-loop { grid-template-columns: 1fr; }
    .notes-loop-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-library-controls { position: static; }
  }
  @media (max-width: 620px) {
    .notes-library-hero { padding: 22px; }
    .notes-library-hero h1 { font-size: 38px; }
    .notes-experience-loop { padding: 14px; }
    .notes-loop-steps { grid-template-columns: 1fr; gap: 9px; }
    .notes-loop-step { min-height: 0; }
    .notes-library-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .notes-library-stats div { padding: 10px; }
    .notes-library-stats strong { font-size: 19px; }
    .notes-library-source-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .notes-library-card, .notes-library-card:nth-child(7n + 1) { min-height: 168px; aspect-ratio: 1 / 1.18; grid-row: auto; }
    .notes-library-album { flex-basis: 210px; }
  }
`;

type ObservationFilterKey = "all" | "needs_id" | "ai" | "no_id" | "photo" | "video" | "identified" | "multi";

type ObservationIndexCopy = {
  activeNav: string;
  title: string;
  identifyTitle: string;
  footerNote: string;
  countSuffix: string;
  relatedActionsAria: string;
  mapAction: string;
  recordAction: string;
  recordActionAria: string;
  controlPanelAria: string;
  searchPlaceholder: string;
  searchLabel: string;
  toolbarAria: string;
  detailsSummary: string;
  resultPanelAria: string;
  emptyInitial: string;
  emptyFiltered: string;
  shortcutIdentify: string;
  shortcutConfirm: string;
  identifyAriaTemplate: string;
  status: {
    ai: string;
    awaiting: string;
    identified: string;
  };
  filters: Record<ObservationFilterKey, string>;
  advanced: {
    status: string;
    evidence: string;
    taxon: string;
    rank: string;
    date: string;
    ids: string;
    sort: string;
  };
  options: {
    all: string;
    noPhoto: string;
    species: string;
    genus: string;
    family: string;
    order: string;
    class: string;
    phylum: string;
    sevenDays: string;
    thirtyDays: string;
    ninetyDays: string;
    zeroIds: string;
    oneId: string;
    twoPlusIds: string;
    newest: string;
    oldest: string;
    leastId: string;
    mostId: string;
  };
  field: {
    aria: string;
    label: string;
    placeholder: string;
    clear: string;
    empty: string;
  };
  presets: {
    aria: string;
    placeholder: string;
    save: string;
    fallback: string;
    spotFallback: string;
    deleteSuffix: string;
  };
};

function observationIndexCopy(lang: SiteLang): ObservationIndexCopy {
  const localized: Record<SiteLang, ObservationIndexCopy> = {
    ja: {
      activeNav: "見つける",
      title: "観察レコード一覧",
      identifyTitle: "同定",
      footerNote: "公開されている観察レコードを、見つける・確かめる・記録する流れにつなげます。",
      countSuffix: "件",
      relatedActionsAria: "関連する操作",
      mapAction: "地図",
      recordAction: "+",
      recordActionAria: "記録する",
      controlPanelAria: "同定と観察の絞り込み",
      searchPlaceholder: "名前・場所・人",
      searchLabel: "観察を検索",
      toolbarAria: "観察レコードの表示切り替え",
      detailsSummary: "詳細",
      resultPanelAria: "観察カード",
      emptyInitial: "まだ表示できる観察レコードがありません。",
      emptyFiltered: "該当する観察がありません。",
      shortcutIdentify: "同定",
      shortcutConfirm: "確認",
      identifyAriaTemplate: "{name}を同定する",
      status: { ai: "AI候補", awaiting: "同定待ち", identified: "同定あり" },
      filters: {
        all: "すべて",
        needs_id: "同定待ち",
        ai: "AI候補",
        no_id: "未同定",
        photo: "写真あり",
        video: "動画あり",
        multi: "複数対象",
        identified: "名前あり",
      },
      advanced: { status: "状態", evidence: "証拠", taxon: "分類", rank: "階級", date: "日付", ids: "同定数", sort: "並び" },
      options: {
        all: "すべて",
        noPhoto: "写真なし",
        species: "種",
        genus: "属",
        family: "科",
        order: "目",
        class: "綱",
        phylum: "門",
        sevenDays: "7日",
        thirtyDays: "30日",
        ninetyDays: "90日",
        zeroIds: "0件",
        oneId: "1件",
        twoPlusIds: "2件以上",
        newest: "新しい順",
        oldest: "古い順",
        leastId: "同定少ない順",
        mostId: "同定多い順",
      },
      field: { aria: "登録エリア", label: "登録エリア", placeholder: "スポット名", clear: "解除", empty: "登録エリアなし" },
      presets: { aria: "保存条件", placeholder: "保存名（任意）", save: "保存", fallback: "条件", spotFallback: "スポット", deleteSuffix: "を削除" },
    },
    en: {
      activeNav: "Explore",
      title: "Observations",
      identifyTitle: "Identify",
      footerNote: "Browse public observations, check names, and move into your next record.",
      countSuffix: " records",
      relatedActionsAria: "Related actions",
      mapAction: "Map",
      recordAction: "+",
      recordActionAria: "Record an observation",
      controlPanelAria: "Filter observations and identifications",
      searchPlaceholder: "Name, place, person",
      searchLabel: "Search observations",
      toolbarAria: "Observation view filters",
      detailsSummary: "Filters",
      resultPanelAria: "Observation cards",
      emptyInitial: "No public observations are ready to show yet.",
      emptyFiltered: "No observations match these filters.",
      shortcutIdentify: "Identify",
      shortcutConfirm: "Check",
      identifyAriaTemplate: "Identify {name}",
      status: { ai: "AI candidate", awaiting: "Needs ID", identified: "Named" },
      filters: {
        all: "All",
        needs_id: "Needs ID",
        ai: "AI candidates",
        no_id: "No ID yet",
        photo: "Photos",
        video: "Videos",
        multi: "Multiple subjects",
        identified: "Named",
      },
      advanced: { status: "Status", evidence: "Evidence", taxon: "Taxon", rank: "Rank", date: "Date", ids: "IDs", sort: "Sort" },
      options: {
        all: "All",
        noPhoto: "No photo",
        species: "Species",
        genus: "Genus",
        family: "Family",
        order: "Order",
        class: "Class",
        phylum: "Phylum",
        sevenDays: "7 days",
        thirtyDays: "30 days",
        ninetyDays: "90 days",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Newest first",
        oldest: "Oldest first",
        leastId: "Fewest IDs",
        mostId: "Most IDs",
      },
      field: { aria: "Registered areas", label: "Registered areas", placeholder: "Spot name", clear: "Clear", empty: "No registered areas" },
      presets: { aria: "Saved filters", placeholder: "Preset name (optional)", save: "Save", fallback: "Filter", spotFallback: "Spot", deleteSuffix: " delete" },
    },
    es: {
      activeNav: "Explorar",
      title: "Observaciones",
      identifyTitle: "Identificar",
      footerNote: "Explora observaciones publicas, revisa nombres y pasa al siguiente registro.",
      countSuffix: " registros",
      relatedActionsAria: "Acciones relacionadas",
      mapAction: "Mapa",
      recordAction: "+",
      recordActionAria: "Registrar una observacion",
      controlPanelAria: "Filtros de observaciones e identificaciones",
      searchPlaceholder: "Nombre, lugar, persona",
      searchLabel: "Buscar observaciones",
      toolbarAria: "Filtros de vista de observaciones",
      detailsSummary: "Filtros",
      resultPanelAria: "Tarjetas de observacion",
      emptyInitial: "Aun no hay observaciones publicas listas para mostrar.",
      emptyFiltered: "Ninguna observacion coincide con estos filtros.",
      shortcutIdentify: "Identificar",
      shortcutConfirm: "Revisar",
      identifyAriaTemplate: "Identificar {name}",
      status: { ai: "Candidato IA", awaiting: "Necesita ID", identified: "Con nombre" },
      filters: {
        all: "Todas",
        needs_id: "Necesita ID",
        ai: "Candidatos IA",
        no_id: "Sin ID",
        photo: "Fotos",
        video: "Videos",
        multi: "Varios sujetos",
        identified: "Con nombre",
      },
      advanced: { status: "Estado", evidence: "Evidencia", taxon: "Taxon", rank: "Rango", date: "Fecha", ids: "IDs", sort: "Orden" },
      options: {
        all: "Todas",
        noPhoto: "Sin foto",
        species: "Especie",
        genus: "Genero",
        family: "Familia",
        order: "Orden",
        class: "Clase",
        phylum: "Filo",
        sevenDays: "7 dias",
        thirtyDays: "30 dias",
        ninetyDays: "90 dias",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Mas recientes",
        oldest: "Mas antiguas",
        leastId: "Menos IDs",
        mostId: "Mas IDs",
      },
      field: { aria: "Areas registradas", label: "Areas registradas", placeholder: "Nombre del punto", clear: "Quitar", empty: "Sin areas registradas" },
      presets: { aria: "Filtros guardados", placeholder: "Nombre del filtro (opcional)", save: "Guardar", fallback: "Filtro", spotFallback: "Punto", deleteSuffix: " eliminar" },
    },
    "pt-BR": {
      activeNav: "Explorar",
      title: "Observacoes",
      identifyTitle: "Identificar",
      footerNote: "Explore observacoes publicas, confira nomes e siga para o proximo registro.",
      countSuffix: " registros",
      relatedActionsAria: "Acoes relacionadas",
      mapAction: "Mapa",
      recordAction: "+",
      recordActionAria: "Registrar uma observacao",
      controlPanelAria: "Filtros de observacoes e identificacoes",
      searchPlaceholder: "Nome, lugar, pessoa",
      searchLabel: "Buscar observacoes",
      toolbarAria: "Filtros da lista de observacoes",
      detailsSummary: "Filtros",
      resultPanelAria: "Cartoes de observacao",
      emptyInitial: "Ainda nao ha observacoes publicas prontas para mostrar.",
      emptyFiltered: "Nenhuma observacao combina com estes filtros.",
      shortcutIdentify: "Identificar",
      shortcutConfirm: "Conferir",
      identifyAriaTemplate: "Identificar {name}",
      status: { ai: "Candidato de IA", awaiting: "Precisa de ID", identified: "Com nome" },
      filters: {
        all: "Todas",
        needs_id: "Precisa de ID",
        ai: "Candidatos IA",
        no_id: "Sem ID",
        photo: "Fotos",
        video: "Videos",
        multi: "Varios sujeitos",
        identified: "Com nome",
      },
      advanced: { status: "Status", evidence: "Evidencia", taxon: "Taxon", rank: "Nivel", date: "Data", ids: "IDs", sort: "Ordem" },
      options: {
        all: "Todas",
        noPhoto: "Sem foto",
        species: "Especie",
        genus: "Genero",
        family: "Familia",
        order: "Ordem",
        class: "Classe",
        phylum: "Filo",
        sevenDays: "7 dias",
        thirtyDays: "30 dias",
        ninetyDays: "90 dias",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Mais recentes",
        oldest: "Mais antigas",
        leastId: "Menos IDs",
        mostId: "Mais IDs",
      },
      field: { aria: "Areas registradas", label: "Areas registradas", placeholder: "Nome do ponto", clear: "Limpar", empty: "Sem areas registradas" },
      presets: { aria: "Filtros salvos", placeholder: "Nome do filtro (opcional)", save: "Salvar", fallback: "Filtro", spotFallback: "Ponto", deleteSuffix: " excluir" },
    },
  };
  return localized[lang] ?? localized.ja;
}

function formatObservationIndexCount(count: number, copy: ObservationIndexCopy): string {
  return `${count}${copy.countSuffix}`;
}

type RecordsWorkbenchView = "mine" | "public" | "needs_id" | "media" | "places";

type RecordsWorkbenchCopy = {
  title: string;
  activeNav: string;
  searchLabel: string;
  mapLabel: string;
  recordLabel: string;
  empty: string;
  tabs: Record<RecordsWorkbenchView, string>;
  side: {
    title: string;
    latest: string;
    places: string;
    needsId: string;
    photos: string;
  };
};

function recordsWorkbenchCopy(lang: SiteLang): RecordsWorkbenchCopy {
  const localized: Record<SiteLang, RecordsWorkbenchCopy> = {
    ja: {
      title: "記録を見る | ikimon",
      activeNav: "記録を見る",
      searchLabel: "記録を探す",
      mapLabel: "地図",
      recordLabel: "+",
      empty: "表示できる記録がまだありません。",
      tabs: {
        mine: "自分",
        public: "近く",
        needs_id: "確認待ち",
        media: "動画/ガイド",
        places: "場所",
      },
      side: {
        title: "この棚の状態",
        latest: "最新",
        places: "場所",
        needsId: "確認待ち",
        photos: "メディア",
      },
    },
    en: {
      title: "Records | ikimon",
      activeNav: "Records",
      searchLabel: "Search records",
      mapLabel: "Map",
      recordLabel: "+",
      empty: "No records are ready to show yet.",
      tabs: {
        mine: "Mine",
        public: "Nearby",
        needs_id: "Needs ID",
        media: "Video/Guide",
        places: "Places",
      },
      side: {
        title: "Shelf",
        latest: "Latest",
        places: "Places",
        needsId: "Needs ID",
        photos: "Media",
      },
    },
    es: {
      title: "Registros | ikimon",
      activeNav: "Registros",
      searchLabel: "Buscar registros",
      mapLabel: "Mapa",
      recordLabel: "+",
      empty: "Aun no hay registros listos para mostrar.",
      tabs: {
        mine: "Mios",
        public: "Cerca",
        needs_id: "Por revisar",
        media: "Video/Guia",
        places: "Lugares",
      },
      side: {
        title: "Estante",
        latest: "Ultimo",
        places: "Lugares",
        needsId: "Por revisar",
        photos: "Medios",
      },
    },
    "pt-BR": {
      title: "Registros | ikimon",
      activeNav: "Registros",
      searchLabel: "Buscar registros",
      mapLabel: "Mapa",
      recordLabel: "+",
      empty: "Ainda nao ha registros prontos para mostrar.",
      tabs: {
        mine: "Meus",
        public: "Perto",
        needs_id: "Revisar",
        media: "Video/Guia",
        places: "Lugares",
      },
      side: {
        title: "Estante",
        latest: "Ultimo",
        places: "Lugares",
        needsId: "Revisar",
        photos: "Midia",
      },
    },
  };
  return localized[lang] ?? localized.ja;
}

function normalizeRecordsView(raw: unknown, hasViewer: boolean): RecordsWorkbenchView {
  const view = typeof raw === "string" ? raw.trim() : "";
  if (view === "public" || view === "needs_id" || view === "media" || view === "places") return view;
  if (view === "mine") return hasViewer ? "mine" : "public";
  return hasViewer ? "mine" : "public";
}

function uniqueRecords(entries: LandingObservation[]): LandingObservation[] {
  const seen = new Set<string>();
  const unique: LandingObservation[] = [];
  for (const entry of entries) {
    const key = `${entry.entryType ?? "observation"}:${entry.visitId}:${entry.occurrenceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function publicObservationToLandingObservation(item: ObservationListSnapshot["observations"][number]): LandingObservation {
  return {
    occurrenceId: item.occurrenceId,
    visitId: item.visitId,
    detailId: item.detailId,
    featuredOccurrenceId: item.featuredOccurrenceId,
    featuredSubjectName: item.featuredSubjectName,
    subjectCount: item.subjectCount,
    isMultiSubject: item.isMultiSubject,
    featuredConfidenceBand: item.featuredConfidenceBand,
    displayStability: item.displayStability,
    displayName: item.displayName,
    scientificName: item.scientificName,
    vernacularName: item.vernacularName,
    featuredTaxonRank: item.featuredTaxonRank,
    aiCandidateName: item.aiCandidateName,
    aiCandidateRank: item.aiCandidateRank,
    isAiCandidate: item.isAiCandidate,
    observedAt: item.observedAt,
    observerName: item.observerName,
    placeName: item.placeName,
    municipality: item.municipality,
    publicLocation: item.publicLocation,
    photoUrl: item.photoUrl,
    mediaUrl: item.mediaUrl,
    hasPhoto: item.hasPhoto,
    hasVideo: item.hasVideo,
    identificationCount: item.identificationCount,
    fieldRefs: item.fieldRefs,
    latitude: null,
    longitude: null,
    observerUserId: null,
    observerAvatarUrl: null,
    librarySourceKind: item.hasVideo ? "video" : item.photoUrl ? "photo" : "note",
    entryType: "observation",
  };
}

function recordsNeedsId(entry: LandingObservation): boolean {
  const name = (entry.displayName || entry.proposedName || "").trim();
  return entry.isAiCandidate === true
    || entry.identificationCount === 0
    || name === ""
    || name === "同定待ち"
    || /awaiting id|unknown|unresolved/i.test(name);
}

function recordsHasMedia(entry: LandingObservation): boolean {
  const kind = notesLibrarySourceKind(entry);
  return kind === "photo" || kind === "video" || kind === "guide" || kind === "scan";
}

function recordsViewHref(basePath: string, lang: SiteLang, view: RecordsWorkbenchView): string {
  return appendLangToHref(withBasePath(basePath, `/records?view=${view}`), lang);
}

function renderRecordsViewTabs(
  basePath: string,
  lang: SiteLang,
  activeView: RecordsWorkbenchView,
  copy: RecordsWorkbenchCopy,
): string {
  const views: RecordsWorkbenchView[] = ["mine", "public", "needs_id", "media", "places"];
  return `<nav class="records-view-tabs" aria-label="${escapeHtml(copy.searchLabel)}">
    ${views.map((view) => `<a class="${view === activeView ? "is-active" : ""}" href="${escapeHtml(recordsViewHref(basePath, lang, view))}">
      <span>${escapeHtml(copy.tabs[view])}</span>
    </a>`).join("")}
  </nav>`;
}

function renderRecordsSidePanel(
  lang: SiteLang,
  entries: LandingObservation[],
  snapshot: LandingSnapshot,
  copy: RecordsWorkbenchCopy,
): string {
  const latest = entries[0] ?? null;
  const latestLabel = latest
    ? `${notesLibraryDateLabel(latest, lang)} · ${latest.displayName || latest.proposedName || notesLibraryCopy(lang).card.fallbackName}`
    : copy.empty;
  const firstPlaces = snapshot.myPlaces.slice(0, 5);
  return `<aside class="records-side-panel">
    <div class="records-side-head">
      <span>${escapeHtml(copy.side.title)}</span>
    </div>
    <div class="records-side-metrics">
      <div><span>${escapeHtml(copy.side.latest)}</span><strong>${escapeHtml(latestLabel)}</strong></div>
    </div>
    ${firstPlaces.length > 0 ? `<div class="records-side-places">
      ${firstPlaces.map((place) => `<button type="button" data-library-place="${escapeHtml(place.placeName)}"><span>${escapeHtml(place.municipality ?? "")}</span><strong>${escapeHtml(place.placeName)}</strong></button>`).join("")}
    </div>` : ""}
  </aside>`;
}

function recordWorkbenchEntriesForView(
  view: RecordsWorkbenchView,
  ownEntries: LandingObservation[],
  publicEntries: LandingObservation[],
): LandingObservation[] {
  const all = uniqueRecords([...ownEntries, ...publicEntries]);
  if (view === "mine") return ownEntries;
  if (view === "public") return publicEntries;
  if (view === "needs_id") return all.filter(recordsNeedsId);
  if (view === "media") return all.filter(recordsHasMedia);
  return all;
}

function recordsStoryCopy(lang: SiteLang): {
  eyebrow: string;
  title: string;
  lead: string;
  latest: string;
  revisit: string;
  naming: string;
  openLatest: string;
  addRecord: string;
  emptyTitle: string;
  emptyLead: string;
} {
  if (lang === "en") {
    return {
      eyebrow: "My observation story",
      title: "Turn records into a trail, not a list.",
      lead: "Start from the last field note, revisit a place, and keep the naming work visible.",
      latest: "Latest chapter",
      revisit: "Place thread",
      naming: "Name thread",
      openLatest: "Open latest",
      addRecord: "Add the next record",
      emptyTitle: "Start the first chapter.",
      emptyLead: "One photo, video, sound, place, or note is enough to begin your nature story.",
    };
  }
  return {
    eyebrow: "自分の自然観察ストーリー",
    title: "記録を一覧ではなく、続きのある物語にする。",
    lead: "前回の発見、よく行く場所、名前を確かめる余地を、次の行動につなげます。",
    latest: "最新の章",
    revisit: "場所の続き",
    naming: "名前の続き",
    openLatest: "最新を見る",
    addRecord: "次の記録を足す",
    emptyTitle: "最初の章を始める。",
    emptyLead: "写真・動画・音・場所・ひとことのどれか1つで、自分の自然観察ストーリーが始まります。",
  };
}

function renderRecordsStoryStrip(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  ownEntries: LandingObservation[],
): string {
  const copy = recordsStoryCopy(lang);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
  if (ownEntries.length === 0) {
    return `<section class="records-story" aria-label="${escapeHtml(copy.eyebrow)}">
      <div class="records-story-head">
        <span>${escapeHtml(copy.eyebrow)}</span>
        <h1>${escapeHtml(copy.emptyTitle)}</h1>
        <p>${escapeHtml(copy.emptyLead)}</p>
      </div>
      <a class="records-story-primary" href="${escapeHtml(recordHref)}" data-kpi-action="records:story:first_record" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(recordHref)}">${escapeHtml(copy.addRecord)}</a>
    </section>`;
  }

  const latest = ownEntries[0]!;
  const latestTitle = formatTaxonDisplayName({
    vernacularName: latest.vernacularName,
    scientificName: latest.scientificName,
    displayName: latest.displayName,
    aiCandidateName: latest.aiCandidateName,
    fallback: latest.proposedName ?? (lang === "ja" ? "名前を確かめている記録" : "Record to identify"),
  }, lang).primaryLabel;
  const latestHref = notesDetailHref(basePath, lang, latest);
  const revisitId = latest.visitId || latest.detailId || latest.occurrenceId;
  const revisitHref = appendLangToHref(withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(revisitId)}`), lang);
  const latestPlace = notesPlaceLine(latest, lang, "owner") || (lang === "ja" ? "場所未設定" : "No place yet");
  const namedCount = ownEntries.filter((obs) => !notesLibraryIsUncertain(obs)).length;
  const needsNameCount = Math.max(0, ownEntries.length - namedCount);
  const placeCount = snapshot.myPlaces.length || new Set(ownEntries.map((obs) => notesPlaceLine(obs, lang, "owner")).filter(Boolean)).size;
  const activeDays = snapshot.habit?.activeDaysLast60 ?? 0;
  const latestLine = `${notesLibraryDateLabel(latest, lang)} · ${latestPlace}`;

  return `<section class="records-story" aria-label="${escapeHtml(copy.eyebrow)}">
    <div class="records-story-head">
      <span>${escapeHtml(copy.eyebrow)}</span>
      <h1>${escapeHtml(copy.title)}</h1>
      <p>${escapeHtml(copy.lead)}</p>
    </div>
    <div class="records-story-metrics" aria-label="${escapeHtml(copy.eyebrow)} metrics">
      <span><strong>${escapeHtml(formatNotesNumber(ownEntries.length, lang))}</strong>${escapeHtml(notesItemCountLabel(ownEntries.length, lang).replace(/^[\d,.]+\s*/, ""))}</span>
      <span><strong>${escapeHtml(formatNotesNumber(placeCount, lang))}</strong>${escapeHtml(lang === "ja" ? "場所" : "places")}</span>
      <span><strong>${escapeHtml(formatNotesNumber(activeDays, lang))}</strong>${escapeHtml(lang === "ja" ? "観察日" : "days")}</span>
    </div>
    <div class="records-story-cards">
      <a class="records-story-card is-featured" href="${escapeHtml(latestHref)}" data-kpi-action="records:story:latest">
        <small>${escapeHtml(copy.latest)}</small>
        <strong>${escapeHtml(latestTitle)}</strong>
        <span>${escapeHtml(latestLine)}</span>
        <em>${escapeHtml(copy.openLatest)}</em>
      </a>
      <a class="records-story-card" href="${escapeHtml(revisitHref)}" data-kpi-action="records:story:revisit" data-kpi-event="primary_cta_click" data-kpi-funnel="landing_record" data-kpi-target="${escapeHtml(revisitHref)}">
        <small>${escapeHtml(copy.revisit)}</small>
        <strong>${escapeHtml(latestPlace)}</strong>
        <span>${escapeHtml(lang === "ja" ? "同じ場所で季節や個体数の変化を足す" : "Add the next change at the same place")}</span>
        <em>${escapeHtml(copy.addRecord)}</em>
      </a>
      <a class="records-story-card" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/records?view=needs_id"), lang))}" data-kpi-action="records:story:naming">
        <small>${escapeHtml(copy.naming)}</small>
        <strong>${escapeHtml(formatNotesNumber(needsNameCount, lang))}</strong>
        <span>${escapeHtml(lang === "ja" ? "名前を確かめる余地がある記録" : "Records still open for naming")}</span>
        <em>${escapeHtml(lang === "ja" ? "確認待ちを見る" : "Open needs ID")}</em>
      </a>
    </div>
  </section>`;
}

function renderRecordsWorkbench(
  basePath: string,
  lang: SiteLang,
  view: RecordsWorkbenchView,
  snapshot: LandingSnapshot,
  publicEntries: LandingObservation[],
  civicContexts: Map<string, CivicObservationContext>,
): string {
  const copy = recordsWorkbenchCopy(lang);
  const ownEntries = snapshot.viewerUserId ? snapshot.myFeed : [];
  const entries = recordWorkbenchEntriesForView(view, ownEntries, publicEntries);
  const locationMode = view === "mine" && snapshot.viewerUserId ? "owner" : "public";
  const storyHtml = view === "mine" && snapshot.viewerUserId
    ? renderRecordsStoryStrip(basePath, lang, snapshot, ownEntries)
    : "";
  return `<div class="records-workbench" data-testid="records-workbench">
    <header class="records-topbar">
      <div class="records-topbar-brand">
        <strong>${escapeHtml(copy.activeNav)}</strong>
      </div>
      ${renderRecordsViewTabs(basePath, lang, view, copy)}
      <div class="records-actions" aria-label="${escapeHtml(observationIndexCopy(lang).relatedActionsAria)}">
        <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/map"), lang))}">${escapeHtml(copy.mapLabel)}</a>
        <a class="is-primary" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}" aria-label="${escapeHtml(observationIndexCopy(lang).recordActionAria)}">${escapeHtml(copy.recordLabel)}</a>
      </div>
    </header>
    <main class="records-main">
      ${storyHtml}
      <section class="records-grid-panel" data-notes-library>
        ${renderNotesLibraryControls(lang)}
        ${entries.length > 0
          ? renderNotesLibraryMonths(basePath, lang, entries, { locationMode, civicContexts, showMonthCount: false })
          : `<div class="notes-library-empty">${escapeHtml(copy.empty)}</div>`}
      </section>
    </main>
    ${renderNotesLibraryScript(lang)}
  </div>`;
}

const RECORDS_WORKBENCH_STYLES = `
  .shell.shell-records-workbench {
    max-width: none;
    padding: 0;
  }
  .records-workbench {
    min-height: calc(100dvh - 56px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    background: #f8fafc;
  }
  .records-topbar {
    position: sticky;
    top: 56px;
    z-index: 20;
    min-height: 58px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 8px 14px;
    background: rgba(255,255,255,.94);
    border-bottom: 1px solid rgba(15,23,42,.08);
    backdrop-filter: blur(18px);
  }
  .records-topbar-brand { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
  .records-topbar-brand strong { color: #0f172a; font-size: 16px; line-height: 1; font-weight: 950; white-space: nowrap; }
  .records-view-tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
  .records-view-tabs::-webkit-scrollbar { display: none; }
  .records-view-tabs a {
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    padding: 0 13px;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid rgba(15,23,42,.08);
    color: #334155;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
  }
  .records-view-tabs a.is-active { background: #10251a; border-color: #10251a; color: #fff; }
  .records-actions { display: flex; gap: 8px; }
  .records-actions a {
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid rgba(15,23,42,.1);
    color: #0f172a;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
  }
  .records-actions a.is-primary { background: #064e3b; border-color: #064e3b; color: #fff; font-size: 24px; line-height: 1; }
  .records-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
    padding: 10px 14px 14px;
  }
  .records-story {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: end;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 14px;
    background:
      linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.96)),
      #fff;
    box-shadow: 0 16px 42px rgba(15,23,42,.07);
  }
  .records-story-head {
    min-width: 0;
    display: grid;
    gap: 5px;
  }
  .records-story-head span,
  .records-story-card small {
    color: #047857;
    font-size: 11px;
    font-weight: 950;
  }
  .records-story-head h1 {
    margin: 0;
    max-width: 22em;
    color: #10251a;
    font-size: clamp(22px, 2.6vw, 34px);
    line-height: 1.14;
    letter-spacing: 0;
    font-weight: 950;
  }
  .records-story-head p {
    margin: 0;
    max-width: 64em;
    color: #475569;
    font-size: 14px;
    line-height: 1.6;
    font-weight: 720;
  }
  .records-story-primary,
  .records-story-card em {
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 13px;
    border-radius: 999px;
    background: #047857;
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-style: normal;
    font-weight: 950;
  }
  .records-story-metrics {
    display: flex;
    gap: 8px;
  }
  .records-story-metrics span {
    min-width: 74px;
    display: grid;
    gap: 3px;
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.74);
    color: #64748b;
    font-size: 11px;
    font-weight: 850;
  }
  .records-story-metrics strong {
    color: #10251a;
    font-size: 20px;
    line-height: 1;
    font-weight: 950;
  }
  .records-story-cards {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1.25fr 1fr 1fr;
    gap: 10px;
  }
  .records-story-card {
    min-width: 0;
    min-height: 138px;
    display: grid;
    align-content: start;
    gap: 7px;
    padding: 13px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 12px;
    background: #fff;
    color: #0f172a;
    text-decoration: none;
  }
  .records-story-card.is-featured {
    background: #10251a;
    color: #fff;
  }
  .records-story-card.is-featured small,
  .records-story-card.is-featured span {
    color: rgba(255,255,255,.72);
  }
  .records-story-card strong {
    color: inherit;
    font-size: 20px;
    line-height: 1.2;
    font-weight: 950;
  }
  .records-story-card span {
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 760;
  }
  .records-story-card em {
    justify-self: start;
    margin-top: auto;
    background: #fff;
    color: #10251a;
    border: 1px solid rgba(15,23,42,.08);
  }
  .records-grid-panel {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 12px;
  }
  .records-workbench .notes-library-controls {
    position: sticky;
    top: 114px;
    z-index: 10;
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 6px;
    align-items: center;
    padding: 6px;
    border-radius: 10px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(15,23,42,.06);
    backdrop-filter: blur(14px);
  }
  .records-workbench .notes-library-grid {
    grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  }
  .records-workbench .notes-library-card,
  .records-workbench .notes-library-card:nth-child(7n + 1) {
    min-height: 176px;
    aspect-ratio: 1 / 1.1;
    grid-row: auto;
    border-radius: 10px;
  }
  @media (max-width: 980px) {
    .records-topbar {
      top: 56px;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
      min-height: 0;
      gap: 6px;
      padding: 6px 8px;
    }
    .records-topbar-brand { display: none; }
    .records-view-tabs { min-width: 0; flex-wrap: nowrap; overflow-x: auto; }
    .records-view-tabs a { min-height: 31px; padding: 0 10px; font-size: 12px; }
    .records-actions { display: none; }
    .records-actions a { min-width: 34px; min-height: 34px; padding: 0 11px; font-size: 12px; }
    .records-actions a.is-primary { font-size: 21px; }
    .records-main { grid-template-columns: 1fr; padding: 6px 8px 10px; }
    .records-story {
      grid-template-columns: 1fr;
      align-items: start;
      padding: 12px;
      border-radius: 12px;
    }
    .records-story-head h1 { font-size: 22px; }
    .records-story-head p { font-size: 13px; }
    .records-story-metrics {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .records-story-metrics::-webkit-scrollbar { display: none; }
    .records-story-cards {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(210px, 74vw);
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .records-story-cards::-webkit-scrollbar { display: none; }
    .records-story-card { min-height: 130px; }
    .records-workbench .notes-library-controls {
      position: static;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px;
      padding: 5px;
    }
    .records-workbench .notes-library-search { min-height: 36px; padding: 0 9px; }
    .records-workbench .notes-library-search input { font-size: 13px; }
    .records-workbench .notes-library-filter-label {
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 11px;
      border-radius: 999px;
      background: #10251a;
      color: #fff;
      font-size: 12px;
      font-weight: 950;
      cursor: pointer;
      white-space: nowrap;
    }
    .records-workbench .notes-library-filters {
      grid-column: 1 / -1;
      display: none;
      gap: 5px;
      padding-top: 1px;
    }
    .records-workbench .notes-library-filter-toggle:checked + .notes-library-filter-label + .notes-library-filters { display: flex; }
    .records-workbench .notes-library-filters button { min-height: 31px; padding: 5px 9px; font-size: 11px; }
  }
  @media (max-width: 620px) {
    .records-topbar-brand strong { font-size: 14px; }
    .records-actions a { min-width: 34px; min-height: 34px; }
    .records-workbench .notes-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  }
`;

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const resolution = resolveViewer(request.query, session);
    const viewerUserId = resolution.viewerUserId ?? "";
    if (!viewerUserId) {
      reply.type("text/html; charset=utf-8");
      return renderRecordStartGuide(basePath, lang, String((request as unknown as { url?: string }).url ?? "/record"));
    }

    reply.type("text/html; charset=utf-8");
    const recordCopy = recordPageCopy(lang);
    const recordForm = recordFormCopy(lang);
    const recordGuideHref = appendLangToHref(withBasePath(basePath, "/guide"), lang);
    const recordLearnHref = appendLangToHref(withBasePath(basePath, "/learn"), lang);
    const recordLandingSnapshot = await getLandingSnapshot(viewerUserId).catch(() => null);
    const firstRecordCandidate = recordLandingSnapshot ? recordLandingSnapshot.myFeed.length === 0 : false;
    return renderSiteDocument({
      basePath,
      title: recordCopy.title,
      activeNav: recordCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/record"), lang),
      footerNote: recordCopy.footerNote,
      body: `<section class="record-page">
        <div class="record-shell">
          <section class="record-card record-sheet">
            <div class="record-card-head">
              <div>
                <div class="eyebrow" id="record-mode-eyebrow">record</div>
                <h2>${escapeHtml(recordCopy.heading)}</h2>
                <p class="meta" id="record-mode-lead">${escapeHtml(recordCopy.lead)}</p>
              </div>
              <div class="record-session-pill">
                <span class="record-session-label">${escapeHtml(recordCopy.sessionLabel)}</span>
                <strong>${escapeHtml(viewerUserId)}</strong>
              </div>
            </div>
            ${renderRecordConfidenceStrip(lang)}
            <div class="record-capture-launcher" aria-label="${escapeHtml(recordCopy.captureAria)}">
              <button type="button" class="record-capture-option record-capture-photo-primary is-primary" data-capture-action="photo">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
                <strong>${escapeHtml(recordCopy.photoTitle)}</strong>
                <span>${escapeHtml(recordCopy.photoSub)}</span>
              </button>
              <button type="button" class="record-capture-option" data-capture-action="note">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg></span>
                <strong>${escapeHtml(recordCopy.noteTitle)}</strong>
                <span>${escapeHtml(recordCopy.noteSub)}</span>
              </button>
              <button type="button" class="record-capture-option" data-capture-action="video">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
                <strong>${escapeHtml(recordCopy.videoTitle)}</strong>
                <span>${escapeHtml(recordCopy.videoSub)}</span>
              </button>
              <button type="button" class="record-capture-option" data-capture-action="gallery">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
                <strong>${escapeHtml(recordCopy.galleryTitle)}</strong>
                <span>${escapeHtml(recordCopy.gallerySub)}</span>
              </button>
            </div>
            <div class="record-secondary-links">
              <a href="${escapeHtml(recordGuideHref)}">${escapeHtml(recordCopy.guideLink)}</a>
              <a href="${escapeHtml(recordLearnHref)}">${escapeHtml(recordCopy.learnLink)}</a>
            </div>
            <div class="record-capture-dock" aria-label="${escapeHtml(recordCopy.dockAria)}">
              <button type="button" class="record-dock-action record-dock-primary" data-capture-action="photo">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
                <span>${escapeHtml(recordCopy.dockPhoto)}</span>
              </button>
              <button type="button" class="record-dock-action" data-capture-action="note">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg></span>
                <span>${escapeHtml(recordCopy.dockNote)}</span>
              </button>
              <button type="button" class="record-dock-action" data-capture-action="video">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
                <span>${escapeHtml(recordCopy.dockVideo)}</span>
              </button>
              <button type="button" class="record-dock-action" data-capture-action="gallery">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
                <span>${escapeHtml(recordCopy.dockGallery)}</span>
              </button>
            </div>
            <div id="record-capture-result" class="record-capture-result" hidden>
              <div>
                <span class="record-label">${escapeHtml(recordCopy.captureResultLabel)}</span>
                <strong id="record-capture-result-title">${escapeHtml(recordCopy.captureResultTitle)}</strong>
                <p id="record-capture-result-help">${escapeHtml(recordCopy.captureResultHelp)}</p>
              </div>
              <button type="button" class="btn btn-ghost" id="record-capture-change">${escapeHtml(recordCopy.captureChange)}</button>
            </div>
            <div id="record-location-nudge" class="record-location-nudge" hidden>
              <div>
                <strong>${escapeHtml(recordCopy.locationTitle)}</strong>
                <p>${escapeHtml(recordCopy.locationBody)}</p>
              </div>
              <button type="button" data-record-locate>${escapeHtml(recordCopy.locationAction)}</button>
            </div>
            <div id="record-autofill-status" class="record-autofill-status" hidden aria-live="polite"></div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" data-first-record-candidate="${firstRecordCandidate ? "1" : "0"}" class="record-form" hidden>
              <input id="record-media-photo" data-record-media-input data-capture-kind="photo" type="file" accept="image/*" capture="environment" multiple hidden />
              <input id="record-media-video" data-record-media-input data-capture-kind="video" type="file" accept="video/*" capture="environment" hidden />
              <input id="record-media" data-record-media-input data-capture-kind="gallery" type="file" accept="image/*,video/*" multiple hidden />
              <input id="record-video-primary-photo-input" type="file" accept="image/*" capture="environment" hidden />
              <input type="hidden" name="recordMode" value="quick" />
              <input type="hidden" name="placeId" value="" />
              <input type="hidden" name="prefecture" value="" />
              <input type="hidden" name="revisitOfVisitId" value="" />
              <div id="record-video-guide" class="record-video-guide" hidden>
                <div class="record-video-guide-head">
                  <div>
                    <span class="record-label">動画記録ナビ</span>
                    <strong id="record-video-guide-title">動画を選ぶと、ここに次の行動を出します。</strong>
                    <p id="record-video-guide-help">長い動画でも、使う60秒を選べばそのまま保存できます。</p>
                  </div>
                  <span id="record-video-guide-badge">待機中</span>
                </div>
                <ol class="record-video-guide-steps" aria-label="動画記録の手順">
                  <li data-video-guide-step="pick"><b>1</b><span>動画を選ぶ</span></li>
                  <li data-video-guide-step="length"><b>2</b><span>60秒以内にする</span></li>
                  <li data-video-guide-step="save"><b>3</b><span>保存する</span></li>
                </ol>
              </div>
              <div id="record-submit-panel" class="record-submit-panel" hidden>
                <div>
                  <span class="record-label">${escapeHtml(recordForm.preSubmitLabel)}</span>
                  <strong id="record-submit-panel-title">${escapeHtml(recordForm.submitPanelTitle)}</strong>
                  <p id="record-submit-panel-help">${escapeHtml(recordForm.submitPanelHelpMedia)}</p>
                </div>
                <button type="submit" class="btn btn-solid">${escapeHtml(recordForm.submitButton)}</button>
              </div>
              <div id="record-video-primary-photo" class="record-video-primary-photo" hidden>
                <div>
                  <span class="record-label">動画の主役写真</span>
                  <strong id="record-video-primary-photo-title">主役写真を追加</strong>
                  <p id="record-video-primary-photo-help">動画だけでは「どれが主役か」が曖昧になりやすいので、主役がよく写った写真を1枚添えると同定しやすくなります。</p>
                </div>
                <div class="record-video-primary-photo-actions">
                  <button type="button" class="btn btn-solid" id="record-video-primary-photo-pick">主役写真を追加</button>
                  <button type="button" class="btn btn-ghost" id="record-video-primary-photo-clear" hidden>外す</button>
                </div>
              </div>
              <div id="record-video-trim" class="record-video-trim" hidden>
                <div class="record-video-trim-head">
                  <div>
                    <strong>動画の長さを確認</strong>
                    <p>青い範囲が記録されます。60秒以内ならそのまま保存できます。</p>
                  </div>
                  <span id="record-video-trim-duration">0.0秒</span>
                </div>
                <div class="record-video-length-meter" data-video-length-state="ok">
                  <div class="record-video-length-row">
                    <span id="record-video-length-label">使う長さ 0秒</span>
                    <strong id="record-video-length-limit">60秒まで</strong>
                  </div>
                  <div class="record-video-length-track" aria-hidden="true"><span id="record-video-length-fill"></span></div>
                </div>
                <div class="record-video-trim-preview">
                  <video id="record-video-trim-player" controls playsinline preload="metadata" aria-label="動画トリミングプレビュー"></video>
                </div>
                <div class="record-video-trim-shortcuts" aria-label="使う区間をすばやく選ぶ">
                  <button type="button" id="record-video-trim-first">はじめの60秒</button>
                  <button type="button" id="record-video-trim-last">おわりの60秒</button>
                </div>
                <div class="record-video-trim-controls">
                  <label>
                    <span>開始 <output id="record-video-trim-start-label">0.0秒</output></span>
                    <input id="record-video-trim-start" type="range" min="0" max="0" step="0.1" value="0" />
                  </label>
                  <label>
                    <span>終了 <output id="record-video-trim-end-label">0.0秒</output></span>
                    <input id="record-video-trim-end" type="range" min="0" max="0" step="0.1" value="0" />
                  </label>
                </div>
                <div class="record-video-trim-actions">
                  <button type="button" class="btn btn-solid" id="record-video-trim-apply">この長さでOK</button>
                  <span id="record-video-trim-status" aria-live="polite">動画を選ぶと、長さと保存できる状態を表示します。</span>
                </div>
              </div>
              <label class="record-field record-field-wide"><span class="record-label">${escapeHtml(recordForm.observedAtLabel)}</span><input id="observedAt" name="observedAt" type="datetime-local" required /></label>
              <div class="record-field record-field-wide record-gps-row">
                <span class="record-label">${escapeHtml(recordForm.placeLabel)}</span>
                <div class="record-place-picker">
                  <div class="record-place-head">
                    <div>
                      <strong id="record-location-label">${escapeHtml(recordForm.locationUnknown)}</strong>
                      <p id="record-location-help">${escapeHtml(recordForm.locationHelp)}</p>
                    </div>
                    <button type="button" class="btn btn-ghost record-gps-btn" data-record-locate>${escapeHtml(recordForm.currentLocation)}</button>
                  </div>
                  <div class="record-place-search">
                    <input id="record-location-search" type="search" placeholder="${escapeHtml(recordForm.locationSearchPlaceholder)}" autocomplete="off" />
                    <button type="button" id="record-location-search-btn">${escapeHtml(recordForm.locationSearchButton)}</button>
                  </div>
                  <div id="record-location-results" class="record-location-results" hidden></div>
                  <div id="record-location-map" class="record-location-map" aria-label="${escapeHtml(recordForm.locationMapAria)}">
                    <div class="record-location-map-fallback">${escapeHtml(recordForm.locationMapFallback)}</div>
                  </div>
                  <details class="record-coordinate-details">
                    <summary>${escapeHtml(recordForm.coordinateSummary)}</summary>
                    <div class="record-gps-inputs">
                      <label class="record-field"><span class="record-label">${escapeHtml(recordForm.latitudeLabel)}</span><input name="latitude" type="number" step="0.000001" placeholder="${escapeHtml(recordForm.coordinatePlaceholder)}" required /></label>
                      <label class="record-field"><span class="record-label">${escapeHtml(recordForm.longitudeLabel)}</span><input name="longitude" type="number" step="0.000001" placeholder="${escapeHtml(recordForm.coordinatePlaceholder)}" required /></label>
                    </div>
                  </details>
                </div>
              </div>
              <details class="record-field record-field-wide record-later-details">
                <summary>${escapeHtml(recordForm.laterSummary)}</summary>
                <div class="record-later-grid">
                  <label class="record-field record-field-wide"><span class="record-label">${escapeHtml(recordForm.localityNoteLabel)}</span><input name="localityNote" type="text" placeholder="${escapeHtml(recordForm.localityNotePlaceholder)}" /></label>
                  <div class="record-field record-field-wide record-media-role">
                    <span class="record-label">${escapeHtml(recordForm.mediaRoleLabel)}</span>
                    <div class="record-media-role-grid" role="radiogroup" aria-label="${escapeHtml(recordForm.mediaRoleLabel)}">
                      <label class="record-media-role-chip">
                        <input type="radio" name="mediaRole" value="primary_subject" checked />
                        <strong>${escapeHtml(recordForm.mediaRolePrimaryTitle)}</strong>
                        <span>${escapeHtml(recordForm.mediaRolePrimaryBody)}</span>
                      </label>
                      <label class="record-media-role-chip">
                        <input type="radio" name="mediaRole" value="context" />
                        <strong>${escapeHtml(recordForm.mediaRoleContextTitle)}</strong>
                        <span>${escapeHtml(recordForm.mediaRoleContextBody)}</span>
                      </label>
                      <label class="record-media-role-chip">
                        <input type="radio" name="mediaRole" value="sound_motion" />
                        <strong>${escapeHtml(recordForm.mediaRoleSoundTitle)}</strong>
                        <span>${escapeHtml(recordForm.mediaRoleSoundBody)}</span>
                      </label>
                      <label class="record-media-role-chip">
                        <input type="radio" name="mediaRole" value="secondary_candidate" />
                        <strong>${escapeHtml(recordForm.mediaRoleSecondaryTitle)}</strong>
                        <span>${escapeHtml(recordForm.mediaRoleSecondaryBody)}</span>
                      </label>
                    </div>
                  </div>
                  <label class="record-field"><span class="record-label">${escapeHtml(recordForm.vernacularNameLabel)}</span><input name="vernacularName" type="text" placeholder="${escapeHtml(recordForm.vernacularNamePlaceholder)}" /></label>
                  <label class="record-field"><span class="record-label">${escapeHtml(recordForm.scientificNameLabel)}</span><input name="scientificName" type="text" placeholder="${escapeHtml(recordForm.scientificNamePlaceholder)}" /></label>
                  <label class="record-field"><span class="record-label">${escapeHtml(recordForm.municipalityLabel)}</span><input name="municipality" type="text" placeholder="${escapeHtml(recordForm.municipalityPlaceholder)}" /></label>
                  <label class="record-field"><span class="record-label">${escapeHtml(recordForm.rankLabel)}</span><input name="rank" type="text" value="species" placeholder="species / genus / family" /></label>
                  <div class="record-field record-field-wide record-mode-switch">
                    <span class="record-label">${escapeHtml(recordForm.recordModeLabel)}</span>
                    <div class="record-mode-grid" role="group" aria-label="${escapeHtml(recordForm.recordModeLabel)}">
                      <button type="button" class="record-mode-chip is-active" data-record-mode="quick">
                        <strong>${escapeHtml(recordForm.quickModeTitle)}</strong>
                        <span>${escapeHtml(recordForm.quickModeBody)}</span>
                      </button>
                      <button type="button" class="record-mode-chip" data-record-mode="survey">
                        <strong>${escapeHtml(recordForm.surveyModeTitle)}</strong>
                        <span>${escapeHtml(recordForm.surveyModeBody)}</span>
                      </button>
                    </div>
                  </div>
                  <div class="record-field record-field-wide">
                    <div class="record-survey-box record-quick-box">
                      <div class="record-survey-head">
                        <div>
                          <span class="record-label">${escapeHtml(recordForm.recordRoleTitle)}</span>
                          <p class="record-help">${escapeHtml(recordForm.recordRoleHelp)}</p>
                        </div>
                        <span class="record-survey-pill">${escapeHtml(recordForm.recordRolePill)}</span>
                      </div>
                      <div class="record-survey-grid">
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.activityIntentLabel)}</span>
                          <select name="activityIntent">
                            <option value="discover">${escapeHtml(recordForm.activityIntentOptions.discover)}</option>
                            <option value="revisit">${escapeHtml(recordForm.activityIntentOptions.revisit)}</option>
                            <option value="compare">${escapeHtml(recordForm.activityIntentOptions.compare)}</option>
                            <option value="learn">${escapeHtml(recordForm.activityIntentOptions.learn)}</option>
                            <option value="manage">${escapeHtml(recordForm.activityIntentOptions.manage)}</option>
                            <option value="confirm">${escapeHtml(recordForm.activityIntentOptions.confirm)}</option>
                            <option value="share">${escapeHtml(recordForm.activityIntentOptions.share)}</option>
                          </select>
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.participantRoleLabel)}</span>
                          <select name="participantRole">
                            <option value="finder">${escapeHtml(recordForm.participantRoleOptions.finder)}</option>
                            <option value="photographer">${escapeHtml(recordForm.participantRoleOptions.photographer)}</option>
                            <option value="context_recorder">${escapeHtml(recordForm.participantRoleOptions.context_recorder)}</option>
                            <option value="note_taker">${escapeHtml(recordForm.participantRoleOptions.note_taker)}</option>
                            <option value="student">${escapeHtml(recordForm.participantRoleOptions.student)}</option>
                            <option value="teacher">${escapeHtml(recordForm.participantRoleOptions.teacher)}</option>
                            <option value="manager">${escapeHtml(recordForm.participantRoleOptions.manager)}</option>
                            <option value="participant">${escapeHtml(recordForm.participantRoleOptions.participant)}</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="record-field record-field-wide record-quick-fields" data-quick-only>
                    <div class="record-survey-box record-quick-box">
                      <div class="record-survey-head">
                        <div>
                          <span class="record-label">${escapeHtml(recordForm.quickReviewTitle)}</span>
                          <p class="record-help">${escapeHtml(recordForm.quickReviewHelp)}</p>
                        </div>
                        <span class="record-survey-pill">${escapeHtml(recordForm.quickReviewPill)}</span>
                      </div>
                      <div class="record-survey-grid">
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.quickCaptureStateLabel)}</span>
                          <select name="quickCaptureState">
                            <option value="present">${escapeHtml(recordForm.quickCaptureStateOptions.present)}</option>
                            <option value="unknown">${escapeHtml(recordForm.quickCaptureStateOptions.unknown)}</option>
                            <option value="no_detection_note">${escapeHtml(recordForm.quickCaptureStateOptions.no_detection_note)}</option>
                          </select>
                        </label>
                        <label class="record-field record-field-wide">
                          <span class="record-label">${escapeHtml(recordForm.nextLookForLabel)}</span>
                          <input name="nextLookFor" type="text" placeholder="${escapeHtml(recordForm.nextLookForPlaceholder)}" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="record-field record-field-wide record-survey-fields" data-survey-only hidden>
                    <div class="record-survey-box">
                      <div class="record-survey-head">
                        <div>
                          <span class="record-label">${escapeHtml(recordForm.surveyBlockTitle)}</span>
                          <p class="record-help">${escapeHtml(recordForm.surveyBlockHelp)}</p>
                        </div>
                        <span class="record-survey-pill">${escapeHtml(recordForm.surveyBlockPill)}</span>
                      </div>
                      <div class="record-survey-grid">
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.checklistCompletionLabel)}</span>
                          <select name="checklistCompletion" data-survey-required disabled>
                            <option value="complete">${escapeHtml(recordForm.checklistCompletionOptions.complete)}</option>
                            <option value="partial">${escapeHtml(recordForm.checklistCompletionOptions.partial)}</option>
                          </select>
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.targetTaxaScopeLabel)}</span>
                          <input name="targetTaxaScope" type="text" placeholder="${escapeHtml(recordForm.targetTaxaScopePlaceholder)}" data-survey-required disabled />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.effortMinutesLabel)}</span>
                          <input name="effortMinutes" type="number" min="1" step="1" placeholder="20" data-survey-required disabled />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.surveyResultLabel)}</span>
                          <select name="surveyResult" disabled>
                            <option value="detected">${escapeHtml(recordForm.surveyResultOptions.detected)}</option>
                            <option value="no_detection_note">${escapeHtml(recordForm.surveyResultOptions.no_detection_note)}</option>
                          </select>
                        </label>
                        <label class="record-field record-field-wide">
                          <span class="record-label">${escapeHtml(recordForm.revisitReasonLabel)}</span>
                          <textarea name="revisitReason" rows="3" placeholder="${escapeHtml(recordForm.revisitReasonPlaceholder)}" data-survey-required disabled></textarea>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="record-field record-field-wide">
                    <div class="record-survey-box">
                      <div class="record-survey-head">
                        <div>
                          <span class="record-label">${escapeHtml(recordForm.fieldScanTitle)}</span>
                          <p class="record-help">${escapeHtml(recordForm.fieldScanHelp)}</p>
                        </div>
                        <span class="record-survey-pill">${escapeHtml(recordForm.fieldScanPill)}</span>
                      </div>
                      <div class="record-survey-grid">
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.fieldScanTypeLabel)}</span>
                          <select name="fieldScanMode">
                            <option value="">${escapeHtml(recordForm.fieldScanModeOptions.none)}</option>
                            <option value="site_snapshot">${escapeHtml(recordForm.fieldScanModeOptions.site_snapshot)}</option>
                            <option value="fixed_point">${escapeHtml(recordForm.fieldScanModeOptions.fixed_point)}</option>
                            <option value="route">${escapeHtml(recordForm.fieldScanModeOptions.route)}</option>
                            <option value="area_footprint">${escapeHtml(recordForm.fieldScanModeOptions.area_footprint)}</option>
                            <option value="calibration_evidence">${escapeHtml(recordForm.fieldScanModeOptions.calibration_evidence)}</option>
                          </select>
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.fixedPointIdLabel)}</span>
                          <input name="fixedPointId" type="text" placeholder="${escapeHtml(recordForm.fixedPointIdPlaceholder)}" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.routeIdLabel)}</span>
                          <input name="routeId" type="text" placeholder="${escapeHtml(recordForm.routeIdPlaceholder)}" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.areaIdLabel)}</span>
                          <input name="areaId" type="text" placeholder="${escapeHtml(recordForm.areaIdPlaceholder)}" />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div class="record-field record-field-wide">
                    <div class="record-survey-box record-water-box">
                      <div class="record-survey-head">
                        <div>
                          <span class="record-label">${escapeHtml(recordForm.waterTitle)}</span>
                          <p class="record-help">${escapeHtml(recordForm.waterHelp)}</p>
                        </div>
                        <span class="record-survey-pill">${escapeHtml(recordForm.waterPill)}</span>
                      </div>
                      <div class="record-survey-grid">
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.catchOutcomeLabel)}</span>
                          <select name="catchOutcome">
                            <option value="">${escapeHtml(recordForm.catchOutcomeOptions.none)}</option>
                            <option value="caught">${escapeHtml(recordForm.catchOutcomeOptions.caught)}</option>
                            <option value="released">${escapeHtml(recordForm.catchOutcomeOptions.released)}</option>
                            <option value="kept">${escapeHtml(recordForm.catchOutcomeOptions.kept)}</option>
                            <option value="lost">${escapeHtml(recordForm.catchOutcomeOptions.lost)}</option>
                            <option value="no_catch">${escapeHtml(recordForm.catchOutcomeOptions.no_catch)}</option>
                            <option value="observed_only">${escapeHtml(recordForm.catchOutcomeOptions.observed_only)}</option>
                          </select>
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.captureMethodLabel)}</span>
                          <input name="captureMethod" type="text" placeholder="${escapeHtml(recordForm.captureMethodPlaceholder)}" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.participantCountLabel)}</span>
                          <input name="participantCount" type="number" min="1" step="1" placeholder="1" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.publicWaterbodyLabel)}</span>
                          <input name="publicWaterbodyLabel" type="text" placeholder="${escapeHtml(recordForm.publicWaterbodyPlaceholder)}" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.releasedCountLabel)}</span>
                          <input name="releasedCount" type="number" min="0" step="1" placeholder="0" />
                        </label>
                        <label class="record-field">
                          <span class="record-label">${escapeHtml(recordForm.keptCountLabel)}</span>
                          <input name="keptCount" type="number" min="0" step="1" placeholder="0" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
              <div id="record-video-progress" class="record-video-progress" hidden aria-live="polite">
                <div class="record-video-progress-head">
                  <strong>動画アップロード進捗</strong>
                  <button type="button" id="record-video-cancel" class="btn btn-ghost" disabled>キャンセル</button>
                </div>
                <progress id="record-video-progressbar" max="100" value="0" aria-label="動画アップロード進捗"></progress>
                <div class="record-video-progress-meta">
                  <span id="record-video-progress-label">0%</span>
                  <span id="record-video-progress-bytes">0 MB / 0 MB</span>
                </div>
                <div id="record-video-live" class="record-video-live" aria-live="polite">動画を選ぶと進捗を表示します。</div>
                <div id="record-video-publication-status" class="record-video-publication-status" hidden>
                  <div class="record-video-publication-title">
                    <strong>公開までの状態</strong>
                    <span id="record-video-publication-badge">待機中</span>
                  </div>
                  <ol class="record-video-publication-steps" aria-label="動画公開までの状態">
                    <li data-video-publication-step="upload"><b>1</b><span>アップロード</span><small>動画を送る</small></li>
                    <li data-video-publication-step="processing"><b>2</b><span>公開準備</span><small>再生できる形にする</small></li>
                    <li data-video-publication-step="public"><b>3</b><span>公開完了</span><small>みんなが見られる</small></li>
                  </ol>
                  <div id="record-video-publication-help" class="record-video-publication-help">動画を選ぶと、いま待つところをここに表示します。</div>
                </div>
              </div>
              <div class="record-actions">
                <button class="btn btn-solid" type="submit">${escapeHtml(recordForm.submitButton)}</button>
                <a class="btn btn-ghost" href="${escapeHtml(recordLearnHref)}">${escapeHtml(recordForm.tipsLink)}</a>
              </div>
              <div class="record-submit-dock" aria-label="${escapeHtml(recordForm.submitDockAria)}">
                <button type="button" class="record-submit-location" data-record-locate>${escapeHtml(recordForm.submitDockLocation)}</button>
                <span id="record-submit-dock-meta" class="record-submit-dock-meta">${escapeHtml(recordForm.submitDockMeta)}</span>
                <button type="submit" class="record-submit-primary">${escapeHtml(recordForm.submitDockSave)}</button>
              </div>
            </form>
            <div id="record-status" class="record-status-inline list" aria-live="polite"></div>
          </section>
        </div>
      </section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('record-form');
        const status = document.getElementById('record-status');
        const observedAt = document.getElementById('observedAt');
        const modeEyebrow = document.getElementById('record-mode-eyebrow');
        const modeLead = document.getElementById('record-mode-lead');
        const modeInput = form ? form.querySelector('[name=recordMode]') : null;
        const modeButtons = form ? Array.from(form.querySelectorAll('[data-record-mode]')) : [];
        const quickFieldsWrap = form ? form.querySelector('[data-quick-only]') : null;
        const surveyFieldsWrap = form ? form.querySelector('[data-survey-only]') : null;
        const surveyRequiredFields = form ? Array.from(form.querySelectorAll('[data-survey-required]')) : [];
        const mediaRoleInputs = form ? Array.from(form.querySelectorAll('input[name="mediaRole"]')) : [];
        const previewDate = document.getElementById('record-preview-date');
        const previewKicker = document.getElementById('record-preview-kicker');
        const previewTitle = document.getElementById('record-preview-title');
        const previewPlace = document.getElementById('record-preview-place');
        const previewMunicipality = document.getElementById('record-preview-municipality');
        const previewCoords = document.getElementById('record-preview-coords');
        const previewPhoto = document.getElementById('record-preview-photo');
        const mediaInput = document.getElementById('record-media');
        const mediaInputs = Array.from(document.querySelectorAll('[data-record-media-input]'));
        const captureButtons = Array.from(document.querySelectorAll('[data-capture-action]'));
        const captureResult = document.getElementById('record-capture-result');
        const captureResultTitle = document.getElementById('record-capture-result-title');
        const captureResultHelp = document.getElementById('record-capture-result-help');
        const captureChange = document.getElementById('record-capture-change');
        const locationNudge = document.getElementById('record-location-nudge');
        const autofillStatus = document.getElementById('record-autofill-status');
        const locateButtons = Array.from(document.querySelectorAll('[data-record-locate]'));
        const locationLabel = document.getElementById('record-location-label');
        const locationHelp = document.getElementById('record-location-help');
        const locationMapEl = document.getElementById('record-location-map');
        const locationSearchInput = document.getElementById('record-location-search');
        const locationSearchButton = document.getElementById('record-location-search-btn');
        const locationResults = document.getElementById('record-location-results');
        const videoGuide = document.getElementById('record-video-guide');
        const videoGuideTitle = document.getElementById('record-video-guide-title');
        const videoGuideHelp = document.getElementById('record-video-guide-help');
        const videoGuideBadge = document.getElementById('record-video-guide-badge');
        const videoGuideSteps = Array.from(document.querySelectorAll('[data-video-guide-step]'));
        const videoProgressWrap = document.getElementById('record-video-progress');
        const videoProgressBar = document.getElementById('record-video-progressbar');
        const videoProgressLabel = document.getElementById('record-video-progress-label');
        const videoProgressBytes = document.getElementById('record-video-progress-bytes');
        const videoLive = document.getElementById('record-video-live');
        const videoPublicationStatus = document.getElementById('record-video-publication-status');
        const videoPublicationBadge = document.getElementById('record-video-publication-badge');
        const videoPublicationHelp = document.getElementById('record-video-publication-help');
        const videoPublicationSteps = Array.from(document.querySelectorAll('[data-video-publication-step]'));
        const videoCancel = document.getElementById('record-video-cancel');
        const videoTrimWrap = document.getElementById('record-video-trim');
        const videoTrimPlayer = document.getElementById('record-video-trim-player');
        const videoTrimStart = document.getElementById('record-video-trim-start');
        const videoTrimEnd = document.getElementById('record-video-trim-end');
        const videoTrimControls = videoTrimWrap ? videoTrimWrap.querySelector('.record-video-trim-controls') : null;
        const videoTrimStartLabel = document.getElementById('record-video-trim-start-label');
        const videoTrimEndLabel = document.getElementById('record-video-trim-end-label');
        const videoTrimDuration = document.getElementById('record-video-trim-duration');
        const videoTrimApply = document.getElementById('record-video-trim-apply');
        const videoTrimStatus = document.getElementById('record-video-trim-status');
        const videoLengthLabel = document.getElementById('record-video-length-label');
        const videoLengthLimit = document.getElementById('record-video-length-limit');
        const videoLengthFill = document.getElementById('record-video-length-fill');
        const videoLengthMeter = videoLengthFill ? videoLengthFill.closest('.record-video-length-meter') : null;
        const videoTrimFirst = document.getElementById('record-video-trim-first');
        const videoTrimLast = document.getElementById('record-video-trim-last');
        const videoPrimaryPhotoWrap = document.getElementById('record-video-primary-photo');
        const videoPrimaryPhotoInput = document.getElementById('record-video-primary-photo-input');
        const videoPrimaryPhotoPick = document.getElementById('record-video-primary-photo-pick');
        const videoPrimaryPhotoClear = document.getElementById('record-video-primary-photo-clear');
        const videoPrimaryPhotoTitle = document.getElementById('record-video-primary-photo-title');
        const videoPrimaryPhotoHelp = document.getElementById('record-video-primary-photo-help');
        const submitPanel = document.getElementById('record-submit-panel');
        const submitPanelTitle = document.getElementById('record-submit-panel-title');
        const submitPanelHelp = document.getElementById('record-submit-panel-help');
        const submitDockMeta = document.getElementById('record-submit-dock-meta');
        const MAX_PHOTO_FILES = 6;
        const PHOTO_UPLOAD_MAX_EDGE = 2560;
        const PHOTO_UPLOAD_JPEG_QUALITY = 0.88;
        const PHOTO_UPLOAD_CONCURRENCY = 2;
        const PHOTO_EXIF_READ_MAX_BYTES = 8 * 1024 * 1024;
        const FRESH_MEDIA_LOCATION_WINDOW_MS = 10 * 60 * 1000;
        const MAX_VIDEO_BASIC_POST_BYTES = 200000000;
        const MAX_VIDEO_TUS_BYTES = 1024 * 1024 * 1024;
        const TUS_CHUNK_BYTES = 8 * 1024 * 1024;
        const MAX_VIDEO_SECONDS = 60;
        let previewObjectUrl = '';
        let videoTrimObjectUrl = '';
        let activeTusUpload = null;
        let cancelTusUpload = null;
        let videoPublicationPollToken = 0;
        let selectedMediaFiles = [];
        let selectedVideoFile = null;
        let selectedPrimaryPhotoFile = null;
        let selectedCaptureKind = '';
        let selectedMediaCapturedAt = null;
        let selectedMediaRole = 'primary_subject';
        let selectedOriginalVideoFile = null;
        let selectedVideoWasTrimmed = false;
        let mediaAutofillSequence = 0;
        let pendingMediaRetryObservationId = '';
        let videoTrimState = null;
        let recordMap = null;
        let recordMapMarker = null;
        let recordMapReady = false;
        let locationSearchAbort = null;
        let localityLookupAbort = null;
        let localityLookupSequence = 0;
        let recordLocationProvenance = null;
        let recordSubmitInFlight = false;
        const DEFAULT_RECORD_LOCATION = { lat: 34.7108, lng: 137.7261, zoom: 13 };
        const captureLabels = ${JSON.stringify(recordCopy.captureLabels)};
        const recordUiCopy = {
          entryLabel: ${JSON.stringify(recordCopy.modeEntryLabel)},
          quickLabel: ${JSON.stringify(recordCopy.modeQuickLabel)},
          surveyLabel: ${JSON.stringify(recordCopy.modeSurveyLabel)},
          lead: ${JSON.stringify(recordCopy.lead)},
          quickLead: ${JSON.stringify(recordCopy.modeQuickLead)},
          surveyLead: ${JSON.stringify(recordCopy.modeSurveyLead)},
          submittingLabel: ${JSON.stringify(recordCopy.submittingLabel)},
          locationUnknown: ${JSON.stringify(recordForm.locationUnknown)},
          locationHelp: ${JSON.stringify(recordForm.locationHelp)},
          locationSelected: ${JSON.stringify(recordForm.locationSelected)},
          submitPanelHelpMedia: ${JSON.stringify(recordForm.submitPanelHelpMedia)},
          submitPanelHelpNote: ${JSON.stringify(recordForm.submitPanelHelpNote)},
          submitPanelHelpEmpty: ${JSON.stringify(recordForm.submitPanelHelpEmpty)},
          submitDockMeta: ${JSON.stringify(recordForm.submitDockMeta)},
          mediaNoteOnly: ${JSON.stringify(recordForm.mediaNoteOnly)},
          mediaLocationMissing: ${JSON.stringify(recordForm.mediaLocationMissing)},
        };

        if (observedAt && !observedAt.value) {
          const now = new Date();
          observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }

        const setStatus = (html) => {
          if (status) status.innerHTML = html;
        };
        const recordKpiEndpoint = withBasePath('/api/v1/ui-kpi/events');
        const recordKpiStartedAt = Date.now();
        const recordKpiSessionId = (window.crypto && typeof window.crypto.randomUUID === 'function')
          ? window.crypto.randomUUID()
          : 'record-kpi-' + String(Date.now()) + '-' + String(Math.random()).slice(2);
        const recordStartParams = new URLSearchParams(window.location.search || '');
        const recordKpiStartMode = recordStartParams.get('start') || 'default';
        const recordFirstRecordCandidate = Boolean(form && form.dataset && form.dataset.firstRecordCandidate === '1');

        const safeAllSelectedMediaFiles = () => {
          try {
            return typeof allSelectedMediaFiles === 'function' ? allSelectedMediaFiles() : [];
          } catch (_) {
            return [];
          }
        };

        const collectRecordKpiDefaults = (extra) => {
          const coords = readCoords();
          const files = safeAllSelectedMediaFiles();
          return Object.assign({
            recordSessionId: recordKpiSessionId,
            lang: document.documentElement.lang || 'ja',
            elapsedMs: Math.max(0, Date.now() - recordKpiStartedAt),
            captureKind: selectedCaptureKind || 'unknown',
            startMode: recordKpiStartMode,
            firstRecordCandidate: recordFirstRecordCandidate,
            hasLocation: Boolean(coords),
            mediaCount: files.length,
            photoCount: selectedMediaFiles.length,
            videoCount: selectedVideoFile ? 1 : 0,
          }, extra || {});
        };

        const sendRecordKpi = (eventName, actionKey, metadata) => {
          try {
            const payload = {
              eventName,
              pagePath: window.location.pathname + window.location.search,
              routeKey: '/record',
              actionKey,
              userId: form && form.dataset ? form.dataset.userId || undefined : undefined,
              metadata: collectRecordKpiDefaults(metadata),
            };
            fetch(recordKpiEndpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              credentials: 'include',
              keepalive: true,
              body: JSON.stringify(payload),
            }).catch(() => undefined);
          } catch (_) {
            // KPI must never block the record flow.
          }
        };

        const sendRecordFunnelStep = (actionKey, metadata) => sendRecordKpi('funnel_step', actionKey, metadata);
        const sendRecordFunnelError = (actionKey, metadata) => sendRecordKpi('funnel_error', actionKey, metadata);
        const sendRecordTaskCompletion = (actionKey, metadata) => sendRecordKpi('task_completion', actionKey, metadata);
        const sendRecordCtaClick = (actionKey, metadata) => sendRecordKpi('primary_cta_click', actionKey, metadata);
        const recordSubmitButtons = () => form ? Array.from(form.querySelectorAll('button[type="submit"]')) : [];
        const setRecordSubmitting = (submitting) => {
          recordSubmitInFlight = Boolean(submitting);
          recordSubmitButtons().forEach((button) => {
            button.disabled = Boolean(submitting);
            if (submitting) {
              if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent || '';
              button.textContent = recordUiCopy.submittingLabel;
            } else if (button.dataset.idleLabel) {
              button.textContent = button.dataset.idleLabel;
            }
          });
        };

        const isSurveyMode = () => modeInput && modeInput.value === 'survey';

        const coordsMissing = () => {
          if (!form) return true;
          const lat = form.elements.namedItem('latitude');
          const lng = form.elements.namedItem('longitude');
          const latValue = lat && 'value' in lat ? String(lat.value || '').trim() : '';
          const lngValue = lng && 'value' in lng ? String(lng.value || '').trim() : '';
          return !latValue || !lngValue;
        };

        const readCoords = () => {
          if (!form) return null;
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          const latRaw = latField && 'value' in latField ? String(latField.value || '').trim() : '';
          const lngRaw = lngField && 'value' in lngField ? String(lngField.value || '').trim() : '';
          if (!latRaw || !lngRaw) return null;
          const lat = Number(latRaw);
          const lng = Number(lngRaw);
          return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        };

        const normalizePrefectureLabel = (value) => {
          const raw = String(value || '').trim();
          const lower = raw.toLowerCase().replace(/[-\\s]+/g, ' ');
          if (raw === '静岡' || raw === '静岡県' || lower === 'shizuoka' || lower === 'shizuoka prefecture') return '静岡県';
          return raw;
        };

        const normalizeMunicipalityLabel = (value) => {
          const raw = String(value || '').trim();
          const lower = raw.toLowerCase().replace(/[-\\s]+/g, ' ');
          if (raw === '浜松' || raw === '浜松市' || lower === 'hamamatsu' || lower === 'hamamatsu city' || lower === 'hamamatsu shi') return '浜松市';
          if (raw === '静岡市' || lower === 'shizuoka city' || lower === 'shizuoka shi') return '静岡市';
          if (raw === '静岡県' || lower === 'shizuoka' || lower === 'shizuoka prefecture') return '';
          return raw;
        };

        const inferLocalityFromCoords = (lat, lng) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return {};
          if (lat >= 34.55 && lat <= 35.32 && lng >= 137.45 && lng <= 138.08) {
            return { prefecture: '静岡県', municipality: '浜松市' };
          }
          if (lat >= 34.82 && lat <= 35.36 && lng >= 138.15 && lng <= 138.72) {
            return { prefecture: '静岡県', municipality: '静岡市' };
          }
          return {};
        };

        const localityFromAddress = (address) => {
          const source = address && typeof address === 'object' ? address : {};
          const prefecture = normalizePrefectureLabel(source.state || source.province || source.region || '');
          const municipality = normalizeMunicipalityLabel(
            source.city || source.town || source.village || source.municipality || source.county || '',
          );
          return { prefecture, municipality };
        };

        const applyLocalityFields = (locality) => {
          if (!form || !locality) return;
          const prefField = form.elements.namedItem('prefecture');
          const muniField = form.elements.namedItem('municipality');
          const prefecture = normalizePrefectureLabel(locality.prefecture || '');
          const municipality = normalizeMunicipalityLabel(locality.municipality || '');
          if (prefField && 'value' in prefField && prefecture) prefField.value = prefecture;
          if (muniField && 'value' in muniField && municipality) muniField.value = municipality;
          syncPreview();
        };

        const lookupLocalityForCoords = async (lat, lng) => {
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const fallback = inferLocalityFromCoords(lat, lng);
          if (fallback.prefecture || fallback.municipality) applyLocalityFields(fallback);
          const sequence = ++localityLookupSequence;
          if (localityLookupAbort) localityLookupAbort.abort();
          localityLookupAbort = new AbortController();
          try {
            const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=ja&lat='
              + encodeURIComponent(String(lat)) + '&lon=' + encodeURIComponent(String(lng));
            const response = await fetch(url, { signal: localityLookupAbort.signal, headers: { Accept: 'application/json' } });
            if (!response.ok || sequence !== localityLookupSequence) return;
            const row = await response.json();
            if (sequence !== localityLookupSequence) return;
            applyLocalityFields(localityFromAddress(row && row.address));
          } catch (error) {
            if (error && error.name === 'AbortError') return;
          }
        };

        const isFreshMedia = () => {
          const capturedAt = selectedMediaCapturedAt instanceof Date ? selectedMediaCapturedAt : null;
          const firstMedia = firstSelectedMediaFile();
          const baseTime = capturedAt || (firstMedia && firstMedia.lastModified ? new Date(firstMedia.lastModified) : null);
          if (!baseTime || Number.isNaN(baseTime.getTime())) return selectedCaptureKind === 'photo';
          return Math.abs(Date.now() - baseTime.getTime()) <= FRESH_MEDIA_LOCATION_WINDOW_MS;
        };

        const syncLocationNudge = () => {
          if (!locationNudge) return;
          const firstMedia = firstSelectedMediaFile();
          locationNudge.hidden = !(firstMedia && (isImageFile(firstMedia) || isVideoFile(firstMedia)) && coordsMissing() && isFreshMedia());
          syncSubmitCta();
        };

        const updateLocationText = (sourceLabel) => {
          const coords = readCoords();
          if (!locationLabel || !locationHelp) return;
          if (!coords) {
            locationLabel.textContent = recordUiCopy.locationUnknown;
            locationHelp.textContent = recordUiCopy.locationHelp;
            return;
          }
          locationLabel.textContent = sourceLabel || recordUiCopy.locationSelected;
          locationHelp.textContent = coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
        };

        const setRecordLocationProvenance = (source, lat, lng, details) => {
          recordLocationProvenance = {
            source: source || 'unknown',
            latitude: Number.isFinite(Number(lat)) ? Number(Number(lat).toFixed(6)) : null,
            longitude: Number.isFinite(Number(lng)) ? Number(Number(lng).toFixed(6)) : null,
            capturedAt: new Date().toISOString(),
            details: details && typeof details === 'object' ? details : {},
          };
        };

        const setRecordLocation = (lat, lng, sourceLabel, opts) => {
          if (!form || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          if (latField && 'value' in latField) latField.value = Number(lat).toFixed(6);
          if (lngField && 'value' in lngField) lngField.value = Number(lng).toFixed(6);
          if (opts && opts.address) {
            applyLocalityFields(localityFromAddress(opts.address));
          } else {
            void lookupLocalityForCoords(Number(lat), Number(lng));
          }
          setRecordLocationProvenance(opts && opts.source ? opts.source : 'manual_or_unknown', lat, lng, {
            label: sourceLabel || null,
            reverseGeocode: Boolean(!(opts && opts.address)),
            address: opts && opts.address ? opts.address : null,
            accuracyM: opts && Number.isFinite(Number(opts.accuracyM)) ? Number(opts.accuracyM) : null,
            positionTimestamp: opts && opts.positionTimestamp ? opts.positionTimestamp : null,
            fileName: opts && opts.fileName ? opts.fileName : null,
            displayName: opts && opts.displayName ? opts.displayName : null,
            osmType: opts && opts.osmType ? opts.osmType : null,
            osmId: opts && opts.osmId ? opts.osmId : null,
          });
          updateLocationText(sourceLabel);
          syncPreview();
          syncLocationNudge();
          sendRecordFunnelStep('location_set', {
            locationSource: recordLocationProvenance ? recordLocationProvenance.source : 'unknown',
            latitude: Number(lat).toFixed(6),
            longitude: Number(lng).toFixed(6),
          });
          if (recordMapReady && recordMap && window.maplibregl) {
            recordMap.jumpTo({ center: [Number(lng), Number(lat)], zoom: opts && opts.zoom ? opts.zoom : Math.max(recordMap.getZoom(), 15) });
            if (!recordMapMarker) recordMapMarker = new window.maplibregl.Marker({ color: '#047857' }).addTo(recordMap);
            recordMapMarker.setLngLat([Number(lng), Number(lat)]);
          }
        };

        const setAutofillStatus = (items) => {
          if (!autofillStatus) return;
          if (!items || !items.length) {
            autofillStatus.hidden = true;
            autofillStatus.textContent = '';
            return;
          }
          autofillStatus.hidden = false;
          autofillStatus.textContent = '自動入力: ' + items.join(' / ');
        };

        const syncModeUi = () => {
          const survey = isSurveyMode();
          if (modeEyebrow) modeEyebrow.textContent = selectedCaptureKind
            ? (survey ? recordUiCopy.surveyLabel : recordUiCopy.quickLabel)
            : recordUiCopy.entryLabel;
          if (modeLead) {
            modeLead.textContent = selectedCaptureKind
              ? (survey
                  ? recordUiCopy.surveyLead
                  : recordUiCopy.quickLead)
              : recordUiCopy.lead;
          }
          if (previewKicker) previewKicker.textContent = survey ? recordUiCopy.surveyLabel : recordUiCopy.quickLabel;
          if (quickFieldsWrap) quickFieldsWrap.hidden = survey;
          if (surveyFieldsWrap) surveyFieldsWrap.hidden = !survey;
          surveyRequiredFields.forEach((field) => {
            field.disabled = !survey;
            if (survey) field.setAttribute('required', 'required');
            else field.removeAttribute('required');
          });
          modeButtons.forEach((button) => {
            const active = button.getAttribute('data-record-mode') === (modeInput ? modeInput.value : 'quick');
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          syncLocationNudge();
        };

        const normalizeError = (error) => {
          if (!error) return 'unknown_error';
          if (typeof error === 'string') return error;
          if (error && typeof error.message === 'string') return error.message;
          return String(error);
        };

        const escapeHtmlText = (value) => String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const formatObservedDate = (value) => {
          if (!value) return '';
          const parsed = new Date(String(value));
          if (Number.isNaN(parsed.getTime())) return String(value);
          return parsed.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
        };

        const dateToLocalInputValue = (date) => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
          return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };

        const parseMetadataDate = (value) => {
          const date = new Date(String(value || ''));
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const normalizeDraftMetadata = (metadata) => metadata && typeof metadata === 'object' ? metadata : {};
        const normalizeMediaRole = (value) => {
          const raw = String(value || '').trim();
          return ['primary_subject', 'context', 'sound_motion', 'secondary_candidate'].includes(raw) ? raw : 'primary_subject';
        };

        const syncMediaRoleInputs = () => {
          mediaRoleInputs.forEach((input) => {
            input.checked = input.value === selectedMediaRole;
          });
        };

        const setSelectedMediaRole = (role) => {
          selectedMediaRole = normalizeMediaRole(role);
          syncMediaRoleInputs();
        };

        const selectedPhotoFiles = () => selectedMediaFiles.filter((file) => file instanceof File && isImageFile(file));
        const allSelectedMediaFiles = () => [
          ...selectedPhotoFiles(),
          ...(selectedVideoFile instanceof File ? [selectedVideoFile] : []),
        ];
        const firstSelectedMediaFile = () => allSelectedMediaFiles()[0] || null;
        const hasSelectedMedia = () => allSelectedMediaFiles().length > 0;
        const hasNoteDraft = () => selectedCaptureKind === 'note';
        const hasRecordDraft = () => hasSelectedMedia() || hasNoteDraft();
        const selectedMediaSummaryText = () => {
          const parts = [];
          const photoCount = selectedPhotoFiles().length + (selectedPrimaryPhotoFile instanceof File ? 1 : 0);
          if (photoCount > 0) parts.push('写真' + String(photoCount) + '枚');
          if (selectedVideoFile instanceof File) parts.push('動画あり');
          if (hasNoteDraft() && !hasSelectedMedia()) parts.push(recordUiCopy.mediaNoteOnly);
          if (coordsMissing()) parts.push(recordUiCopy.mediaLocationMissing);
          return parts.length ? parts.join(' / ') : recordUiCopy.submitDockMeta;
        };

        const syncSubmitCta = () => {
          const hasDraft = hasRecordDraft();
          if (submitPanel) submitPanel.hidden = !hasDraft;
          const summary = selectedMediaSummaryText();
          if (submitPanelTitle) submitPanelTitle.textContent = summary;
          if (submitPanelHelp) {
            submitPanelHelp.textContent = hasSelectedMedia()
              ? recordUiCopy.submitPanelHelpMedia
              : hasNoteDraft()
                ? recordUiCopy.submitPanelHelpNote
                : recordUiCopy.submitPanelHelpEmpty;
          }
          if (submitDockMeta) submitDockMeta.textContent = summary;
        };

        const syncVideoPrimaryPhotoUi = () => {
          const hasVideo = selectedVideoFile instanceof File && isVideoFile(selectedVideoFile);
          if (videoPrimaryPhotoWrap) videoPrimaryPhotoWrap.hidden = !hasVideo;
          if (!hasVideo) selectedPrimaryPhotoFile = null;
          if (videoPrimaryPhotoTitle) {
            videoPrimaryPhotoTitle.textContent = selectedPrimaryPhotoFile
              ? '主役写真: ' + (selectedPrimaryPhotoFile.name || '選択済み')
              : '主役写真を追加';
          }
          if (videoPrimaryPhotoHelp) {
            videoPrimaryPhotoHelp.textContent = selectedPrimaryPhotoFile
              ? 'この写真を主役として保存し、動画は音・動きの証拠として同じ記録に添付します。'
              : '写真は任意です。名前を調べやすくしたいときだけ、主役が写った写真を1枚足せます。';
          }
          if (videoPrimaryPhotoClear) videoPrimaryPhotoClear.hidden = !selectedPrimaryPhotoFile;
        };

        const readMetadataLocation = (metadata) => {
          const location = metadata && metadata.location && typeof metadata.location === 'object' ? metadata.location : null;
          if (!location) return null;
          const lat = Number(location.latitude);
          const lng = Number(location.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        };

        const parseExifDate = (value) => {
          const match = String(value || '').match(/^(\\d{4}):(\\d{2}):(\\d{2})\\s+(\\d{2}):(\\d{2})(?::(\\d{2}))?/);
          if (!match) return null;
          const date = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6] || '0'),
          );
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const parseJpegExif = async (file) => {
          if (!file || !isJpegFile(file)) return {};
          const buffer = await file.slice(0, Math.min(file.size || 0, PHOTO_EXIF_READ_MAX_BYTES)).arrayBuffer();
          const view = new DataView(buffer);
          if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return {};
          let offset = 2;
          while (offset + 4 <= view.byteLength) {
            if (view.getUint8(offset) !== 0xff) break;
            let markerOffset = offset + 1;
            while (markerOffset < view.byteLength && view.getUint8(markerOffset) === 0xff) markerOffset += 1;
            if (markerOffset >= view.byteLength) break;
            const marker = view.getUint8(markerOffset);
            if (marker === 0xda || marker === 0xd9) break;
            if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
              offset = markerOffset + 1;
              continue;
            }
            const lengthOffset = markerOffset + 1;
            if (lengthOffset + 2 > view.byteLength) break;
            const segmentLength = view.getUint16(lengthOffset, false);
            const segmentStart = lengthOffset + 2;
            const segmentEnd = lengthOffset + segmentLength;
            if (segmentLength < 2 || segmentEnd > view.byteLength) break;
            if (marker === 0xe1 && segmentLength >= 8) {
              const exifHeader = String.fromCharCode(
                view.getUint8(segmentStart),
                view.getUint8(segmentStart + 1),
                view.getUint8(segmentStart + 2),
                view.getUint8(segmentStart + 3),
              );
              if (exifHeader === 'Exif') {
                return readExifTiff(view, segmentStart + 6);
              }
            }
            offset = segmentEnd;
          }
          return {};
        };

        const readFourCc = (view, start) => {
          if (start < 0 || start + 4 > view.byteLength) return '';
          return String.fromCharCode(
            view.getUint8(start),
            view.getUint8(start + 1),
            view.getUint8(start + 2),
            view.getUint8(start + 3),
          );
        };

        const readVariableUint = (view, start, size) => {
          if (!size) return 0;
          if (start < 0 || start + size > view.byteLength) return null;
          let value = 0;
          for (let i = 0; i < size; i += 1) value = value * 256 + view.getUint8(start + i);
          return value;
        };

        const walkIsoBoxes = (view, start, end, visitor) => {
          let offset = Math.max(0, start);
          const limit = Math.min(view.byteLength, end);
          while (offset + 8 <= limit) {
            let boxSize = view.getUint32(offset, false);
            const type = readFourCc(view, offset + 4);
            let headerSize = 8;
            if (boxSize === 1) {
              if (offset + 16 > limit) break;
              boxSize = view.getUint32(offset + 8, false) * 4294967296 + view.getUint32(offset + 12, false);
              headerSize = 16;
            } else if (boxSize === 0) {
              boxSize = limit - offset;
            }
            if (!boxSize || boxSize < headerSize || offset + boxSize > limit) break;
            visitor({
              type,
              start: offset,
              contentStart: offset + headerSize,
              end: offset + boxSize,
            });
            offset += boxSize;
          }
        };

        const findTiffStart = (view, start, end) => {
          const limit = Math.min(view.byteLength, end);
          for (let offset = Math.max(0, start); offset + 4 <= limit; offset += 1) {
            const byteOrder = view.getUint16(offset, false);
            if ((byteOrder === 0x4949 || byteOrder === 0x4d4d) && view.getUint16(offset + 2, byteOrder === 0x4949) === 42) {
              return offset;
            }
          }
          return null;
        };

        const parseHeifExif = async (file) => {
          if (!file || !isHeifFile(file)) return {};
          const buffer = await file.arrayBuffer();
          const view = new DataView(buffer);
          const exifItemIds = new Set();
          const itemExtents = new Map();

          const parseIinf = (start, end) => {
            if (start + 6 > end) return;
            const version = view.getUint8(start);
            let cursor = start + 4;
            const entryCount = version === 0 ? view.getUint16(cursor, false) : view.getUint32(cursor, false);
            cursor += version === 0 ? 2 : 4;
            walkIsoBoxes(view, cursor, end, (box) => {
              if (box.type !== 'infe' || box.contentStart + 12 > box.end) return;
              const itemInfoVersion = view.getUint8(box.contentStart);
              if (itemInfoVersion < 2) return;
              let itemCursor = box.contentStart + 4;
              const itemId = itemInfoVersion >= 3 ? view.getUint32(itemCursor, false) : view.getUint16(itemCursor, false);
              itemCursor += itemInfoVersion >= 3 ? 4 : 2;
              itemCursor += 2;
              if (readFourCc(view, itemCursor) === 'Exif') exifItemIds.add(itemId);
            });
            void entryCount;
          };

          const parseIloc = (start, end) => {
            if (start + 8 > end) return;
            const version = view.getUint8(start);
            let cursor = start + 4;
            const sizeByte = view.getUint8(cursor);
            const offsetSize = sizeByte >> 4;
            const lengthSize = sizeByte & 0x0f;
            cursor += 1;
            const baseByte = view.getUint8(cursor);
            const baseOffsetSize = baseByte >> 4;
            const indexSize = version === 1 || version === 2 ? baseByte & 0x0f : 0;
            cursor += 1;
            const itemCount = version < 2 ? view.getUint16(cursor, false) : view.getUint32(cursor, false);
            cursor += version < 2 ? 2 : 4;
            for (let i = 0; i < itemCount && cursor < end; i += 1) {
              const itemId = version < 2 ? view.getUint16(cursor, false) : view.getUint32(cursor, false);
              cursor += version < 2 ? 2 : 4;
              let constructionMethod = 0;
              if (version === 1 || version === 2) {
                constructionMethod = view.getUint16(cursor, false) & 0x0fff;
                cursor += 2;
              }
              cursor += 2;
              const baseOffset = readVariableUint(view, cursor, baseOffsetSize);
              cursor += baseOffsetSize;
              if (baseOffset === null || cursor + 2 > end) return;
              const extentCount = view.getUint16(cursor, false);
              cursor += 2;
              const extents = [];
              for (let j = 0; j < extentCount && cursor < end; j += 1) {
                if (indexSize) cursor += indexSize;
                const extentOffset = readVariableUint(view, cursor, offsetSize);
                cursor += offsetSize;
                const extentLength = readVariableUint(view, cursor, lengthSize);
                cursor += lengthSize;
                if (constructionMethod === 0 && extentOffset !== null && extentLength !== null) {
                  extents.push({ offset: baseOffset + extentOffset, length: extentLength });
                }
              }
              if (extents.length) itemExtents.set(itemId, extents);
            }
          };

          const parseMeta = (start, end) => {
            if (start + 4 > end) return;
            walkIsoBoxes(view, start + 4, end, (box) => {
              if (box.type === 'iinf') parseIinf(box.contentStart, box.end);
              if (box.type === 'iloc') parseIloc(box.contentStart, box.end);
            });
          };

          walkIsoBoxes(view, 0, view.byteLength, (box) => {
            if (box.type === 'meta') parseMeta(box.contentStart, box.end);
          });

          for (const itemId of exifItemIds) {
            const extents = itemExtents.get(itemId) || [];
            for (const extent of extents) {
              const start = Number(extent.offset);
              const end = Number(extent.length) > 0 ? start + Number(extent.length) : view.byteLength;
              if (!Number.isFinite(start) || start < 0 || start >= view.byteLength) continue;
              const tiffStart = findTiffStart(view, start, Math.min(end, view.byteLength));
              if (tiffStart !== null) return readExifTiff(view, tiffStart);
            }
          }
          return {};
        };

        const parseImageExif = async (file) => {
          if (isJpegFile(file)) return parseJpegExif(file);
          if (isHeifFile(file)) return parseHeifExif(file);
          return {};
        };

        const readExifTiff = (view, tiffStart) => {
          if (tiffStart + 8 > view.byteLength) return {};
          const byteOrder = view.getUint16(tiffStart, false);
          const littleEndian = byteOrder === 0x4949;
          if (!littleEndian && byteOrder !== 0x4d4d) return {};
          if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {};
          const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
          const typeBytes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

          const readString = (start, count) => {
            const chars = [];
            for (let i = 0; i < count && start + i < view.byteLength; i += 1) {
              const code = view.getUint8(start + i);
              if (code === 0) break;
              chars.push(String.fromCharCode(code));
            }
            return chars.join('').trim();
          };
          const readNumber = (start, type) => {
            if (start < 0 || start >= view.byteLength) return null;
            if (type === 3 && start + 2 <= view.byteLength) return view.getUint16(start, littleEndian);
            if (type === 4 && start + 4 <= view.byteLength) return view.getUint32(start, littleEndian);
            if (type === 9 && start + 4 <= view.byteLength) return view.getInt32(start, littleEndian);
            if ((type === 5 || type === 10) && start + 8 <= view.byteLength) {
              const numerator = type === 5 ? view.getUint32(start, littleEndian) : view.getInt32(start, littleEndian);
              const denominator = type === 5 ? view.getUint32(start + 4, littleEndian) : view.getInt32(start + 4, littleEndian);
              return denominator ? numerator / denominator : 0;
            }
            if ((type === 1 || type === 7) && start + 1 <= view.byteLength) return view.getUint8(start);
            return null;
          };
          const readValue = (entryOffset) => {
            const type = view.getUint16(entryOffset + 2, littleEndian);
            const count = view.getUint32(entryOffset + 4, littleEndian);
            const totalBytes = (typeBytes[type] || 0) * count;
            if (!totalBytes) return null;
            const valueStart = totalBytes <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
            if (valueStart < tiffStart || valueStart + totalBytes > view.byteLength) return null;
            if (type === 2) return readString(valueStart, count);
            const values = [];
            for (let i = 0; i < count; i += 1) {
              const value = readNumber(valueStart + i * (typeBytes[type] || 0), type);
              if (value !== null) values.push(value);
            }
            return count === 1 ? values[0] : values;
          };
          const readIfd = (ifdOffset) => {
            const start = tiffStart + ifdOffset;
            if (start < tiffStart || start + 2 > view.byteLength) return {};
            const count = view.getUint16(start, littleEndian);
            const values = {};
            for (let i = 0; i < count; i += 1) {
              const entryOffset = start + 2 + i * 12;
              if (entryOffset + 12 > view.byteLength) break;
              const tag = view.getUint16(entryOffset, littleEndian);
              values[tag] = readValue(entryOffset);
            }
            return values;
          };
          const ifd0 = readIfd(firstIfdOffset);
          const exifIfd = ifd0[0x8769] ? readIfd(Number(ifd0[0x8769])) : {};
          const gpsIfd = ifd0[0x8825] ? readIfd(Number(ifd0[0x8825])) : {};
          const toDecimal = (parts, ref) => {
            if (!Array.isArray(parts) || parts.length < 3) return null;
            const decimal = Number(parts[0]) + Number(parts[1]) / 60 + Number(parts[2]) / 3600;
            if (!Number.isFinite(decimal)) return null;
            return String(ref || '').toUpperCase() === 'S' || String(ref || '').toUpperCase() === 'W' ? -decimal : decimal;
          };
          return {
            capturedAt: parseExifDate(exifIfd[0x9003] || exifIfd[0x9004] || ifd0[0x0132]),
            latitude: toDecimal(gpsIfd[2], gpsIfd[1]),
            longitude: toDecimal(gpsIfd[4], gpsIfd[3]),
          };
        };

        const normalizeGeolocationError = (error) => {
          const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : 0;
          const message = code === 1
            ? 'geolocation_denied'
            : code === 2
              ? 'geolocation_position_unavailable'
              : code === 3
                ? 'geolocation_timeout'
                : error instanceof Error && error.message ? error.message : 'geolocation_failed';
          const normalized = new Error(message);
          normalized.geolocationCode = code;
          return normalized;
        };

        const isGeolocationDenied = (error) =>
          Boolean(error && (error.geolocationCode === 1 || error.message === 'geolocation_denied'));

        const geolocationFailureMessage = (error) => {
          const message = error && error.message ? error.message : 'geolocation_failed';
          if (message === 'geolocation_denied') return '位置情報の利用が拒否されています。ブラウザまたはOSのサイト設定で ikimon.life の位置情報を許可してから、もう一度押してください。';
          if (message === 'geolocation_timeout') return '位置情報の取得が時間切れになりました。屋外や窓際で少し待ってからもう一度押すか、座標を手動で入力してください。';
          if (message === 'geolocation_insecure_context') return '位置情報はHTTPSで開いたページだけ使えます。https://ikimon.life/record を開き直してください。';
          if (message === 'geolocation_unavailable') return 'このブラウザでは位置情報を利用できません。別のブラウザで開くか、座標を手動で入力してください。';
          return '位置情報の取得に失敗しました。ブラウザまたはOSの位置情報設定を確認するか、座標を手動で入力してください。';
        };

        const normalizedPositionOptions = (options) => ({
          enableHighAccuracy: options && Object.prototype.hasOwnProperty.call(options, 'enableHighAccuracy') ? Boolean(options.enableHighAccuracy) : true,
          maximumAge: options && Number.isFinite(Number(options.maximumAge)) ? Number(options.maximumAge) : 30000,
          timeout: options && Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 10000,
        });

        const readCurrentPosition = (options) => new Promise((resolve, reject) => {
          if (window.isSecureContext === false) {
            reject(new Error('geolocation_insecure_context'));
            return;
          }
          if (!navigator.geolocation) {
            reject(new Error('geolocation_unavailable'));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            (error) => reject(normalizeGeolocationError(error)),
            normalizedPositionOptions(options),
          );
        });

        const currentLocationAttempts = (options) => {
          if (options && Array.isArray(options.attempts) && options.attempts.length) return options.attempts;
          const hasExplicitPositionOptions = options && (
            Object.prototype.hasOwnProperty.call(options, 'enableHighAccuracy') ||
            Object.prototype.hasOwnProperty.call(options, 'maximumAge') ||
            Object.prototype.hasOwnProperty.call(options, 'timeout')
          );
          if (hasExplicitPositionOptions) return [options];
          return [
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
            { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 12000 },
          ];
        };

        const applyCurrentLocation = async (sourceLabel, silent, options) => {
          if (!form) return false;
          locateButtons.forEach((button) => { button.disabled = true; });
          let lastError = null;
          try {
            const attempts = currentLocationAttempts(options);
            for (const attempt of attempts) {
              try {
                const position = await readCurrentPosition(attempt);
                if (options && typeof options.guard === 'function' && !options.guard()) return false;
                setRecordLocation(position.coords.latitude, position.coords.longitude, sourceLabel, {
                  zoom: 16,
                  source: 'browser_geolocation',
                  accuracyM: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
                  positionTimestamp: Number.isFinite(position.timestamp) ? new Date(position.timestamp).toISOString() : null,
                });
                return true;
              } catch (error) {
                lastError = normalizeGeolocationError(error);
                if (isGeolocationDenied(lastError)) break;
              }
            }
            if (!silent) alert(geolocationFailureMessage(lastError));
            return false;
          } finally {
            locateButtons.forEach((button) => { button.disabled = false; });
          }
        };

        const applyMediaAutofill = async (file, metadata, opts) => {
          if (!file || !form) {
            setAutofillStatus([]);
            return;
          }
          const guard = opts && typeof opts.guard === 'function' ? opts.guard : () => true;
          const filled = [];
          const draftMetadata = normalizeDraftMetadata(metadata);
          let exif = {};
          try {
            exif = await parseImageExif(file);
          } catch (_) {
            exif = {};
          }
          if (!guard()) return;
          const metadataCapturedAt = parseMetadataDate(draftMetadata.capturedAt);
          const capturedAt = exif.capturedAt || metadataCapturedAt || (file.lastModified ? new Date(file.lastModified) : null);
          const observedValue = dateToLocalInputValue(capturedAt);
          if (observedAt && observedValue) {
            observedAt.value = observedValue;
            selectedMediaCapturedAt = capturedAt;
            filled.push(exif.capturedAt || metadataCapturedAt ? '撮影日時' : 'ファイル日時');
          }
          if (Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude)) {
            setRecordLocation(Number(exif.latitude), Number(exif.longitude), '写真の撮影地点', {
              zoom: 16,
              source: 'photo_exif_gps',
              fileName: file && file.name ? String(file.name).slice(0, 180) : null,
            });
            filled.push('写真の位置');
          } else {
            const metadataLocation = readMetadataLocation(draftMetadata);
            if (metadataLocation) {
              setRecordLocation(metadataLocation.lat, metadataLocation.lng, '撮影時の現在地', {
                zoom: 16,
                source: 'capture_metadata_location',
                fileName: file && file.name ? String(file.name).slice(0, 180) : null,
              });
              filled.push('撮影時の位置');
            } else if (opts && opts.autoLocateFreshCapture && coordsMissing() && isFreshMedia()) {
              const located = await applyCurrentLocation('撮影時の現在地', true, {
                enableHighAccuracy: false,
                maximumAge: 60000,
                timeout: 2500,
                guard,
              });
              if (!guard()) return;
              if (located) filled.push('現在地');
            }
          }
          if (!guard()) return;
          setAutofillStatus(filled);
          syncPreview();
          syncLocationNudge();
        };

        const scheduleMediaAutofill = (file, metadata, opts) => {
          const sequence = ++mediaAutofillSequence;
          const guard = () => sequence === mediaAutofillSequence;
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              if (!guard()) return;
              void applyMediaAutofill(file, metadata, { ...(opts || {}), guard }).catch(() => {
                if (!guard()) return;
                setAutofillStatus([]);
                syncLocationNudge();
              });
            }, 0);
          });
        };

        const buildImpactHtml = (impact, extraStatus) => {
          const notes = [];
          if (impact && impact.placeName) {
            notes.push(impact.placeName + ' の記録が ' + String(impact.visitCount || 1) + ' 件目になりました。');
          }
          if (impact && impact.previousObservedAt) {
            notes.push('前回は ' + formatObservedDate(impact.previousObservedAt) + ' の記録があります。同じ場所で比べる解像度が上がりました。');
          } else if (impact && impact.placeName) {
            notes.push('この場所の時間・環境・気づきを比べる起点ができました。');
          }
          if (impact && impact.focusLabel) {
            notes.push('次に見返す手がかりとして「' + String(impact.focusLabel) + '」を残しました。');
          } else if (impact && impact.captureState === 'unknown') {
            notes.push('名前を急がず、場所・時間・周囲の手がかりを先に残しました。');
          } else if (impact && impact.captureState === 'no_detection_note') {
            notes.push('今日は見なかった状況も、次回比較の解像度になります。');
          }
          if (extraStatus) {
            notes.push(extraStatus);
          }
          if (!notes.length) {
            notes.push('記録の場所・時間・メディアを保存しました。');
          }
          return notes.map((line) => '<div class="meta" style="margin-top:6px">' + escapeHtmlText(line) + '</div>').join('');
        };

        const applyPrefillFromQuery = () => {
          if (!form) return;
          const params = new URLSearchParams(window.location.search);
          const names = ['latitude', 'longitude', 'prefecture', 'municipality', 'localityNote', 'placeId', 'scientificName', 'vernacularName', 'rank', 'nextLookFor', 'targetTaxaScope', 'revisitReason', 'activityIntent', 'participantRole', 'revisitOfVisitId', 'fieldScanMode', 'fixedPointId', 'routeId', 'areaId'];
          names.forEach((name) => {
            if (!params.has(name)) return;
            const field = form.elements.namedItem(name);
            if (field && 'value' in field) {
              field.value = params.get(name) || '';
            }
          });
          if (params.has('quickCaptureState')) {
            const field = form.elements.namedItem('quickCaptureState');
            if (field && 'value' in field) {
              field.value = params.get('quickCaptureState') || 'present';
            }
          }
          if (params.has('surveyResult')) {
            const field = form.elements.namedItem('surveyResult');
            if (field && 'value' in field) {
              field.value = params.get('surveyResult') || 'detected';
            }
          }
          if (params.has('recordMode') && modeInput) {
            modeInput.value = params.get('recordMode') === 'survey' ? 'survey' : 'quick';
          }
          if (params.has('revisitObservationId')) {
            const revisitField = form.elements.namedItem('revisitOfVisitId');
            if (revisitField && 'value' in revisitField) revisitField.value = params.get('revisitObservationId') || '';
            const intentField = form.elements.namedItem('activityIntent');
            if (intentField && 'value' in intentField) intentField.value = 'revisit';
          }
        };

        const applyStartModeFromQuery = () => {
          const params = new URLSearchParams(window.location.search);
          const start = params.get('start');
          if (start === 'note' || start === 'photo' || start === 'video' || start === 'gallery') {
            setPendingCaptureKind(start);
          }
        };

        const formatBytes = (bytes) => {
          if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
          const mb = bytes / (1024 * 1024);
          if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
          return mb.toFixed(1) + ' MB';
        };

        const isVideoFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          if (type.startsWith('video/')) return true;
          return /\.(mp4|mov|m4v|webm|ogv|avi)$/i.test(String(file.name || ''));
        };

        const isImageFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          if (type.startsWith('image/')) return true;
          return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(String(file.name || ''));
        };

        const isJpegFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          return type === 'image/jpeg' || type === 'image/jpg' || /\.jpe?g$/i.test(String(file.name || ''));
        };

        const isHeifFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          return type === 'image/heic' || type === 'image/heif' || /\.(heic|heif)$/i.test(String(file.name || ''));
        };

        const resetVideoProgress = () => {
          if (videoProgressWrap) videoProgressWrap.hidden = true;
          if (videoProgressBar) videoProgressBar.value = 0;
          if (videoProgressLabel) videoProgressLabel.textContent = '0%';
          if (videoProgressBytes) videoProgressBytes.textContent = '0 MB / 0 MB';
          if (videoLive) videoLive.textContent = '動画を選ぶと進捗を表示します。';
          if (videoPublicationStatus) videoPublicationStatus.hidden = true;
          videoPublicationPollToken += 1;
          if (videoCancel) videoCancel.disabled = true;
          activeTusUpload = null;
          cancelTusUpload = null;
        };

        const setVideoPublicationStatus = (stage, detailHref) => {
          if (!videoPublicationStatus) return;
          const normalized = stage === 'failed' || stage === 'public' || stage === 'processing' || stage === 'uploaded' || stage === 'uploading'
            ? stage
            : 'uploading';
          const stateByStage = {
            uploading: { badge: '送信中', help: 'この画面のまま待ってください。動画をサーバーへ送っています。', steps: { upload: 'current', processing: 'pending', public: 'pending' } },
            uploaded: { badge: '保存中', help: '動画は届きました。記録に紐づけています。', steps: { upload: 'done', processing: 'current', public: 'pending' } },
            processing: { badge: '公開準備中', help: '動画は保存済みです。再生準備をしています。画面を閉じても大丈夫です。', steps: { upload: 'done', processing: 'current', public: 'pending' } },
            public: { badge: '公開できました', help: '動画つき記録を公開しました。見つけたもののページで見られます。', steps: { upload: 'done', processing: 'done', public: 'done' } },
            failed: { badge: '失敗', help: '動画の公開準備で止まりました。記録本体が保存済みなら、同じ画面から動画だけ再試行できます。', steps: { upload: 'failed', processing: 'pending', public: 'pending' } },
          };
          const config = stateByStage[normalized];
          videoPublicationStatus.hidden = false;
          videoPublicationStatus.dataset.stage = normalized;
          if (videoPublicationBadge) videoPublicationBadge.textContent = config.badge;
          if (videoPublicationHelp) {
            videoPublicationHelp.innerHTML = config.help + (detailHref && normalized === 'public'
              ? ' <a href="' + detailHref + '">観察を見る</a>'
              : '');
          }
          videoPublicationSteps.forEach((step) => {
            const key = step.getAttribute('data-video-publication-step') || '';
            const stepState = config.steps[key] || 'pending';
            step.dataset.state = stepState;
            const marker = step.querySelector('b');
            if (marker) {
              const pendingText = key === 'upload' ? '1' : (key === 'processing' ? '2' : '3');
              marker.textContent = stepState === 'done' ? '✓' : (stepState === 'failed' ? '!' : pendingText);
            }
          });
        };

        const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

        const waitForVideoPublication = async (detailHref, streamUid, observationId) => {
          if (!detailHref) return false;
          const token = ++videoPublicationPollToken;
          setVideoPublicationStatus('processing', detailHref);
          const waits = [0, 1500, 2500, 4000, 6000, 8000, 10000, 12000];
          for (const waitMs of waits) {
            if (token !== videoPublicationPollToken) return false;
            if (waitMs > 0) await delay(waitMs);
            if (token !== videoPublicationPollToken) return false;
            try {
              if (streamUid) {
                const response = await fetch(withBasePath('/api/v1/videos/' + encodeURIComponent(streamUid) + '/finalize'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', accept: 'application/json' },
                  credentials: 'include',
                  cache: 'no-store',
                  body: JSON.stringify({
                    observationId: observationId || null,
                    mediaRole: 'sound_motion',
                  }),
                });
                const json = await response.json();
                if (response.ok && json.ok && json.video && json.video.readyToStream) {
                  setVideoPublicationStatus('public', detailHref);
                  return true;
                }
              } else {
                const response = await fetch(detailHref, {
                  method: 'HEAD',
                  credentials: 'include',
                  cache: 'no-store',
                });
                if (response.ok) {
                  setVideoPublicationStatus('public', detailHref);
                  return true;
                }
                if (response.status === 405) {
                  const fallback = await fetch(detailHref, {
                    method: 'GET',
                    credentials: 'include',
                    cache: 'no-store',
                  });
                  if (fallback.ok) {
                    setVideoPublicationStatus('public', detailHref);
                    return true;
                  }
                }
              }
            } catch (_) {
              // Keep showing processing; transient network errors are not a user failure.
            }
          }
          if (token === videoPublicationPollToken) {
            setVideoPublicationStatus('processing', detailHref);
            if (videoPublicationHelp) {
              videoPublicationHelp.textContent = '動画は保存済みです。公開準備が続いています。画面を閉じても大丈夫です。数分後に観察ページを開いてください。';
            }
          }
          return false;
        };

        const updateVideoProgress = (uploaded, total) => {
          if (videoProgressWrap) videoProgressWrap.hidden = false;
          setVideoPublicationStatus('uploading');
          const safeTotal = Number(total) > 0 ? Number(total) : 1;
          const percent = Math.max(0, Math.min(100, Math.round((Number(uploaded) / safeTotal) * 100)));
          if (videoProgressBar) videoProgressBar.value = percent;
          if (videoProgressLabel) videoProgressLabel.textContent = percent + '%';
          if (videoProgressBytes) videoProgressBytes.textContent = formatBytes(uploaded) + ' / ' + formatBytes(total);
        };

        const formatVideoSeconds = (seconds) => {
          const value = Number(seconds);
          if (!Number.isFinite(value) || value < 0) return '0.0秒';
          return value.toFixed(1) + '秒';
        };

        const setVideoGuideState = (state, title, help, badge) => {
          if (!videoGuide) return;
          const hasVideo = selectedVideoFile instanceof File && isVideoFile(selectedVideoFile);
          videoGuide.hidden = !hasVideo;
          if (!hasVideo) return;
          videoGuide.dataset.state = state || 'picked';
          if (videoGuideTitle) videoGuideTitle.textContent = title || '動画を確認しています。';
          if (videoGuideHelp) videoGuideHelp.textContent = help || '長さと地点を確認して保存できます。';
          if (videoGuideBadge) videoGuideBadge.textContent = badge || '確認中';
          const doneByState = {
            picked: ['pick'],
            ok: ['pick', 'length'],
            trim: ['pick'],
            ready: ['pick', 'length'],
            saving: ['pick', 'length', 'save'],
          };
          const done = doneByState[state] || ['pick'];
          videoGuideSteps.forEach((step) => {
            const key = step.getAttribute('data-video-guide-step') || '';
            const active = (state === 'trim' && key === 'length') || (state === 'ready' && key === 'save');
            step.dataset.state = done.includes(key) ? 'done' : (active ? 'current' : 'pending');
          });
        };

        const isVideoDurationReadError = (error) => {
          const message = normalizeError(error);
          return message === 'video_metadata_read_failed' || message === 'video_duration_unknown';
        };

        const getVideoDuration = (file) => new Promise((resolve, reject) => {
          const probe = document.createElement('video');
          const objectUrl = URL.createObjectURL(file);
          let settled = false;
          let askedBySeek = false;
          const cleanup = () => {
            settled = true;
            URL.revokeObjectURL(objectUrl);
            probe.removeAttribute('src');
            probe.load();
          };
          const finishWithDuration = () => {
            if (settled) return true;
            const duration = Number(probe.duration);
            if (Number.isFinite(duration) && duration > 0) {
              cleanup();
              resolve(duration);
              return true;
            }
            return false;
          };
          const trySeekProbe = () => {
            if (settled || askedBySeek) return;
            askedBySeek = true;
            try {
              probe.currentTime = 1e101;
            } catch (_) {
              // Some mobile browsers only reveal Blob video duration after a large seek.
            }
          };
          const fail = (code) => {
            if (settled) return;
            cleanup();
            reject(new Error(code));
          };
          probe.preload = 'metadata';
          probe.muted = true;
          probe.playsInline = true;
          probe.onloadedmetadata = () => {
            if (!finishWithDuration()) trySeekProbe();
          };
          probe.ondurationchange = finishWithDuration;
          probe.onloadeddata = finishWithDuration;
          probe.oncanplay = finishWithDuration;
          probe.onseeked = finishWithDuration;
          probe.onerror = () => {
            fail('video_metadata_read_failed');
          };
          window.setTimeout(() => fail('video_duration_unknown'), 8000);
          probe.src = objectUrl;
          probe.load();
        });

        const resetVideoTrim = (opts) => {
          if (videoTrimObjectUrl) {
            URL.revokeObjectURL(videoTrimObjectUrl);
            videoTrimObjectUrl = '';
          }
          if (videoTrimPlayer) {
            videoTrimPlayer.pause();
            videoTrimPlayer.removeAttribute('src');
            videoTrimPlayer.load();
          }
          if (videoTrimWrap) videoTrimWrap.hidden = true;
          if (videoTrimStatus) videoTrimStatus.textContent = '動画を選ぶと、長さと保存できる状態を表示します。';
          if (videoLengthFill) videoLengthFill.style.width = '0%';
          if (videoLengthLabel) videoLengthLabel.textContent = '使う長さ 0秒';
          if (videoLengthLimit) videoLengthLimit.textContent = '60秒まで';
          if (videoLengthMeter) videoLengthMeter.dataset.videoLengthState = 'ok';
          if (videoTrimApply) videoTrimApply.disabled = false;
          if (videoTrimApply) videoTrimApply.hidden = false;
          if (videoTrimControls) videoTrimControls.hidden = false;
          if (videoTrimFirst) videoTrimFirst.hidden = true;
          if (videoTrimLast) videoTrimLast.hidden = true;
          videoTrimState = null;
          selectedOriginalVideoFile = null;
          if (!(opts && opts.keepTrimmedFlag)) selectedVideoWasTrimmed = false;
        };

        const syncVideoTrimControls = (changed) => {
          if (!videoTrimState || !videoTrimStart || !videoTrimEnd) return;
          const duration = videoTrimState.duration;
          let start = Number(videoTrimStart.value);
          let end = Number(videoTrimEnd.value);
          if (!Number.isFinite(start)) start = 0;
          if (!Number.isFinite(end)) end = Math.min(duration, MAX_VIDEO_SECONDS);
          start = Math.max(0, Math.min(start, Math.max(0, duration - 0.1)));
          end = Math.max(0.1, Math.min(end, duration));
          if (end <= start + 0.2) {
            if (changed === 'start') end = Math.min(duration, start + 0.2);
            else start = Math.max(0, end - 0.2);
          }
          if (end - start > MAX_VIDEO_SECONDS) {
            if (changed === 'start') end = Math.min(duration, start + MAX_VIDEO_SECONDS);
            else start = Math.max(0, end - MAX_VIDEO_SECONDS);
          }
          videoTrimState.start = start;
          videoTrimState.end = end;
          videoTrimStart.value = String(start);
          videoTrimEnd.value = String(end);
          if (videoTrimStartLabel) videoTrimStartLabel.textContent = formatVideoSeconds(start);
          if (videoTrimEndLabel) videoTrimEndLabel.textContent = formatVideoSeconds(end);
          if (videoTrimDuration) videoTrimDuration.textContent = formatVideoSeconds(end - start);
          if (videoLengthFill) {
            const ratio = Math.max(0, Math.min(1, (end - start) / MAX_VIDEO_SECONDS));
            videoLengthFill.style.width = String(Math.round(ratio * 100)) + '%';
          }
          if (videoLengthLabel) videoLengthLabel.textContent = '使う長さ ' + formatVideoSeconds(end - start);
          if (videoLengthLimit) {
            videoLengthLimit.textContent = duration > MAX_VIDEO_SECONDS + 0.5
              ? '全体 ' + formatVideoSeconds(duration)
              : '60秒以内';
          }
          if (videoTrimPlayer && Math.abs(Number(videoTrimPlayer.currentTime || 0) - start) > 0.4) {
            videoTrimPlayer.currentTime = start;
          }
          const isLongVideo = duration > MAX_VIDEO_SECONDS + 0.5;
          const needsClip = isLongVideo || start > 0.15 || end < duration - 0.15;
          if (videoLengthMeter) videoLengthMeter.dataset.videoLengthState = end - start > MAX_VIDEO_SECONDS + 0.5 ? 'warn' : 'ok';
          if (videoTrimApply) videoTrimApply.textContent = needsClip ? 'この60秒でOK' : 'このままOK';
          if (videoTrimApply) videoTrimApply.hidden = !isLongVideo;
          if (videoTrimControls) videoTrimControls.hidden = !isLongVideo;
          if (videoTrimFirst) videoTrimFirst.hidden = !isLongVideo;
          if (videoTrimLast) videoTrimLast.hidden = !isLongVideo;
          if (videoTrimStatus) {
            videoTrimStatus.textContent = needsClip
              ? '長い動画です。青い範囲だけを保存します。このまま保存を押しても自動で切り出します。'
              : '60秒以内です。このまま保存できます。';
          }
          setVideoGuideState(
            needsClip ? 'trim' : 'ready',
            needsClip ? '使う60秒を選べば保存できます。' : 'この動画はそのまま保存できます。',
            needsClip ? '迷ったら「はじめの60秒」のままで大丈夫です。' : '次は撮影地点を確認して保存します。',
            needsClip ? '60秒選択中' : 'OK',
          );
        };

        const loadVideoTrimEditor = async (file) => {
          resetVideoTrim();
          if (!file || !isVideoFile(file) || !videoTrimWrap || !videoTrimStart || !videoTrimEnd) return;
          const duration = await getVideoDuration(file);
          selectedOriginalVideoFile = file;
          selectedVideoWasTrimmed = false;
          videoTrimState = { sourceFile: file, duration, start: 0, end: Math.min(duration, MAX_VIDEO_SECONDS) };
          videoTrimStart.max = String(duration);
          videoTrimEnd.max = String(duration);
          videoTrimStart.value = '0';
          videoTrimEnd.value = String(Math.min(duration, MAX_VIDEO_SECONDS));
          if (videoTrimObjectUrl) URL.revokeObjectURL(videoTrimObjectUrl);
          videoTrimObjectUrl = URL.createObjectURL(file);
          if (videoTrimPlayer) {
            videoTrimPlayer.src = videoTrimObjectUrl;
            videoTrimPlayer.currentTime = 0;
          }
          videoTrimWrap.hidden = false;
          syncVideoTrimControls();
        };

        const setVideoTrimRange = (start, end) => {
          if (!videoTrimState || !videoTrimStart || !videoTrimEnd) return;
          videoTrimStart.value = String(Math.max(0, Number(start) || 0));
          videoTrimEnd.value = String(Math.max(0.1, Number(end) || Math.min(videoTrimState.duration, MAX_VIDEO_SECONDS)));
          syncVideoTrimControls();
        };

        const createTrimmedVideoFile = () => new Promise((resolve, reject) => {
          if (!videoTrimState || !videoTrimState.sourceFile) {
            reject(new Error('video_trim_source_missing'));
            return;
          }
          const start = Number(videoTrimState.start || 0);
          const end = Number(videoTrimState.end || 0);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_VIDEO_SECONDS + 0.5) {
            reject(new Error('video_trim_range_invalid'));
            return;
          }
          const sourceFile = videoTrimState.sourceFile;
          const sourceUrl = URL.createObjectURL(sourceFile);
          const sourceVideo = document.createElement('video');
          const cleanup = () => {
            URL.revokeObjectURL(sourceUrl);
            sourceVideo.pause();
            sourceVideo.removeAttribute('src');
            sourceVideo.load();
          };
          const captureStream = () => {
            const capture = sourceVideo.captureStream || sourceVideo.mozCaptureStream;
            return capture ? capture.call(sourceVideo) : null;
          };
          sourceVideo.preload = 'auto';
          sourceVideo.playsInline = true;
          sourceVideo.volume = 0;
          sourceVideo.src = sourceUrl;
          sourceVideo.onerror = () => {
            cleanup();
            reject(new Error('video_trim_failed'));
          };
          sourceVideo.onloadedmetadata = async () => {
            try {
              sourceVideo.currentTime = start;
              await new Promise((seekResolve, seekReject) => {
                if (Math.abs(Number(sourceVideo.currentTime || 0) - start) < 0.05) {
                  seekResolve(true);
                  return;
                }
                const timer = window.setTimeout(() => seekReject(new Error('video_trim_seek_failed')), 8000);
                sourceVideo.onseeked = () => {
                  window.clearTimeout(timer);
                  seekResolve(true);
                };
              });
              const stream = captureStream();
              if (!stream || typeof MediaRecorder === 'undefined') {
                cleanup();
                reject(new Error('video_trim_unsupported'));
                return;
              }
              const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
                  ? 'video/webm'
                  : '';
              const chunks = [];
              const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
              let settled = false;
              const finish = (error) => {
                if (settled) return;
                settled = true;
                stream.getTracks().forEach((track) => track.stop());
                cleanup();
                if (error) {
                  reject(error);
                  return;
                }
                const type = chunks[0] ? chunks[0].type || 'video/webm' : 'video/webm';
                const blob = new Blob(chunks, { type });
                resolve(new File([blob], 'ikimon-video-trim-' + Date.now() + '.webm', { type, lastModified: Date.now() }));
              };
              recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) chunks.push(event.data);
              };
              recorder.onerror = () => finish(new Error('video_trim_failed'));
              recorder.onstop = () => finish(null);
              recorder.start(1000);
              await sourceVideo.play();
              const timer = window.setInterval(() => {
                if (sourceVideo.currentTime >= end || sourceVideo.ended) {
                  window.clearInterval(timer);
                  if (recorder.state === 'recording') recorder.stop();
                }
              }, 100);
            } catch (error) {
              cleanup();
              reject(error instanceof Error ? error : new Error('video_trim_failed'));
            }
          };
        });

        const ensureVideoReadyForUpload = async (file) => {
          if (!file || !isVideoFile(file)) return file;
          let duration = 0;
          try {
            duration = await getVideoDuration(file);
          } catch (error) {
            if (isVideoDurationReadError(error)) {
              if (videoLive) videoLive.textContent = '端末で秒数を読めませんでした。60秒以内の動画としてアップロードし、サーバー側の上限で確認します。';
              return file;
            }
            throw error;
          }
          if (duration > MAX_VIDEO_SECONDS + 0.5 && !selectedVideoWasTrimmed) {
            if (!videoTrimState || !selectedOriginalVideoFile) {
              throw new Error('video_trim_required');
            }
            if (videoTrimApply) videoTrimApply.disabled = true;
            if (videoTrimStatus) videoTrimStatus.textContent = '選んだ60秒を作ってから保存します。少し待ってください。';
            if (videoLive) videoLive.textContent = '長い動画から選んだ60秒を作成中です。';
            setVideoGuideState('saving', '選んだ60秒を作っています。', '終わると自動でアップロードに進みます。', '作成中');
            try {
              const trimmedFile = await createTrimmedVideoFile();
              selectedVideoFile = trimmedFile;
              selectedVideoWasTrimmed = true;
              renderPreviewFile(trimmedFile);
              resetVideoTrim({ keepTrimmedFlag: true });
              return trimmedFile;
            } catch (error) {
              if (videoTrimApply) videoTrimApply.disabled = false;
              throw error;
            }
          }
          return file;
        };

        const applyVideoTrim = async () => {
          if (!videoTrimState || !selectedOriginalVideoFile) return;
          const duration = Number(videoTrimState.duration || 0);
          const start = Number(videoTrimState.start || 0);
          const end = Number(videoTrimState.end || 0);
          const needsClip = duration > MAX_VIDEO_SECONDS + 0.5 || start > 0.15 || end < duration - 0.15;
          if (!needsClip) {
            selectedVideoFile = selectedOriginalVideoFile;
            selectedVideoWasTrimmed = false;
            if (videoTrimStatus) videoTrimStatus.textContent = 'このまま保存できます。';
            if (videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
            setVideoGuideState('ready', 'この動画はそのまま保存できます。', '次は撮影地点を確認して保存します。', 'OK');
            syncSubmitCta();
            return;
          }
          if (videoTrimApply) videoTrimApply.disabled = true;
          if (videoTrimStatus) videoTrimStatus.textContent = '選んだ60秒の動画を作成中です...';
          setVideoGuideState('saving', '選んだ60秒を作っています。', '終わると保存できる状態になります。', '作成中');
          try {
            const trimmedFile = await createTrimmedVideoFile();
            selectedVideoFile = trimmedFile;
            selectedVideoWasTrimmed = true;
            renderPreviewFile(trimmedFile);
            showRecordFormForMedia(allSelectedMediaFiles(), selectedCaptureKind || 'video');
            resetVideoTrim({ keepTrimmedFlag: true });
            if (videoProgressWrap) videoProgressWrap.hidden = false;
            if (videoLive) videoLive.textContent = '切り出した動画をアップロードできます。送信すると開始します。';
            setVideoGuideState('ready', '60秒の動画にできました。', '次は撮影地点を確認して保存します。', 'OK');
          } catch (error) {
            if (videoTrimApply) videoTrimApply.disabled = false;
            const message = normalizeError(error);
            if (videoTrimStatus) {
              videoTrimStatus.textContent = message === 'video_trim_unsupported'
                ? 'このブラウザでは動画の切り出しに対応していません。60秒以内の動画を選んでください。'
                : '動画の切り出しに失敗しました。別の区間か動画で試してください。';
            }
          }
        };

        const hydrateRecordMap = () => {
          if (!locationMapEl || recordMapReady || !window.maplibregl) return;
          recordMapReady = true;
          const fallback = locationMapEl.querySelector('.record-location-map-fallback');
          if (fallback) fallback.style.display = 'none';
          const coords = readCoords();
          const center = coords ? [coords.lng, coords.lat] : [DEFAULT_RECORD_LOCATION.lng, DEFAULT_RECORD_LOCATION.lat];
          recordMap = new window.maplibregl.Map({
            container: locationMapEl,
            style: {
              version: 8,
              sources: {
                osm: {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors',
                },
              },
              layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
            },
            center,
            zoom: coords ? 15 : DEFAULT_RECORD_LOCATION.zoom,
            attributionControl: false,
          });
          recordMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          recordMap.on('load', () => {
            if (coords) {
              const currentLabel = locationLabel && locationLabel.textContent && locationLabel.textContent !== '地点未指定'
                ? locationLabel.textContent
                : '撮影地点を指定済み';
              setRecordLocation(coords.lat, coords.lng, currentLabel, { zoom: 15, source: 'existing_form_coordinates' });
            }
            recordMap.resize();
          });
          recordMap.on('click', (event) => {
            if (!event || !event.lngLat) return;
            setRecordLocation(event.lngLat.lat, event.lngLat.lng, '地図で指定した撮影地点', {
              zoom: Math.max(recordMap.getZoom(), 15),
              source: 'map_click',
            });
          });
        };

        const ensureRecordMap = () => {
          if (!locationMapEl) return;
          if (window.maplibregl) {
            hydrateRecordMap();
            return;
          }
          if (!document.querySelector('link[data-maplibre="1"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
            link.integrity = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            link.setAttribute('data-maplibre', '1');
            document.head.appendChild(link);
          }
          if (document.querySelector('script[data-record-maplibre="1"]')) return;
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
          script.integrity = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
          script.crossOrigin = 'anonymous';
          script.referrerPolicy = 'no-referrer';
          script.defer = true;
          script.setAttribute('data-record-maplibre', '1');
          script.onload = hydrateRecordMap;
          script.onerror = () => {
            if (locationMapEl) locationMapEl.classList.add('is-fallback');
          };
          document.head.appendChild(script);
        };

        const renderLocationResults = (rows) => {
          if (!locationResults) return;
          if (!rows || !rows.length) {
            locationResults.innerHTML = '<div class="record-location-empty">候補が見つかりませんでした。</div>';
            locationResults.hidden = false;
            return;
          }
          locationResults.innerHTML = rows.map((row, index) =>
            '<button type="button" class="record-location-result" data-index="' + String(index) + '">' +
              '<strong>' + escapeHtmlText(row.display_name || '地点候補') + '</strong>' +
              '<span>' + escapeHtmlText(Number(row.lat).toFixed(5) + ', ' + Number(row.lon).toFixed(5)) + '</span>' +
            '</button>'
          ).join('');
          locationResults.hidden = false;
          Array.from(locationResults.querySelectorAll('.record-location-result')).forEach((button, index) => {
            button.addEventListener('click', () => {
              const row = rows[index];
              const lat = Number(row && row.lat);
              const lng = Number(row && row.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              setRecordLocation(lat, lng, '検索で選んだ撮影地点', {
                zoom: 16,
                source: 'place_search_result',
                address: row && row.address,
                displayName: row && row.display_name ? String(row.display_name).slice(0, 240) : null,
                osmType: row && row.osm_type ? String(row.osm_type).slice(0, 40) : null,
                osmId: row && row.osm_id ? String(row.osm_id).slice(0, 80) : null,
              });
              if (locationSearchInput) locationSearchInput.value = row.display_name || '';
              locationResults.innerHTML = '';
              locationResults.hidden = true;
            });
          });
        };

        const searchRecordLocation = async () => {
          if (!locationSearchInput) return;
          const query = String(locationSearchInput.value || '').trim();
          if (query.length < 2) {
            renderLocationResults([]);
            return;
          }
          if (locationSearchAbort) locationSearchAbort.abort();
          locationSearchAbort = new AbortController();
          if (locationResults) {
            locationResults.hidden = false;
            locationResults.innerHTML = '<div class="record-location-empty">検索中...</div>';
          }
          try {
            const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=jp&accept-language=ja&q=' + encodeURIComponent(query);
            const response = await fetch(url, { signal: locationSearchAbort.signal, headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('place_search_failed');
            const rows = await response.json();
            renderLocationResults(Array.isArray(rows) ? rows : []);
          } catch (error) {
            if (error && error.name === 'AbortError') return;
            if (locationResults) {
              locationResults.hidden = false;
              locationResults.innerHTML = '<div class="record-location-empty">検索に失敗しました。現在地か地図で指定してください。</div>';
            }
          }
        };

        const fillCurrentLocation = () => {
          if (!navigator.geolocation || !form) {
            alert('位置情報を利用できません。手動で入力してください。');
            return;
          }
          void applyCurrentLocation('現在地を撮影地点に設定', false);
        };

        const clearMediaInputsExcept = (activeInput) => {
          mediaInputs.forEach((input) => {
            if (input !== activeInput) input.value = '';
          });
        };

        const normalizeSelectedFiles = (files, kind) => {
          const incoming = Array.isArray(files) ? files.filter((file) => file instanceof File && file.size > 0) : [];
          const photos = [];
          let video = null;
          const notices = [];
          incoming.forEach((file) => {
            if (isImageFile(file)) {
              if (photos.length < MAX_PHOTO_FILES) photos.push(file);
              else notices.push('写真は最大' + String(MAX_PHOTO_FILES) + '枚までです。超過分は外しました。');
              return;
            }
            if (isVideoFile(file)) {
              if (!video) video = file;
              else notices.push('動画は1本までです。2本目以降は外しました。');
              return;
            }
            notices.push('画像または動画ではないファイルを外しました。');
          });
          if (kind === 'video' && video) {
            return { photos, video, notices };
          }
          return { photos, video, notices };
        };

        const showRecordFormForMedia = (files, kind, notices) => {
          const normalized = normalizeSelectedFiles(files, kind);
          selectedMediaFiles = normalized.photos;
          selectedVideoFile = normalized.video;
          selectedCaptureKind = kind || '';
          const hasMedia = hasSelectedMedia();
          const hasDraft = hasRecordDraft();
          if (hasMedia && !selectedMediaRole) setSelectedMediaRole('primary_subject');
          if (selectedVideoFile && selectedMediaFiles.length === 0) setSelectedMediaRole('sound_motion');
          if (selectedMediaFiles.length > 0) selectedPrimaryPhotoFile = null;
          if (!hasMedia) selectedPrimaryPhotoFile = null;
          if (form) form.hidden = !hasDraft;
          if (captureResult) captureResult.hidden = !hasDraft;
          document.documentElement.classList.toggle('record-has-media', hasDraft);
          if (hasDraft) window.requestAnimationFrame(ensureRecordMap);
          const label = captureLabels[selectedCaptureKind] || captureLabels.gallery;
          const photoCount = selectedMediaFiles.length;
          const mediaSummary = [
            photoCount > 0 ? '写真' + String(photoCount) + '枚' : '',
            selectedVideoFile ? '動画1本' : '',
          ].filter(Boolean).join(' / ');
          if (captureResultTitle) captureResultTitle.textContent = hasDraft
            ? (hasMedia ? '下書き作成済み - ' + mediaSummary : label.title)
            : '未選択';
          const noticeText = [...(notices || []), ...normalized.notices].filter(Boolean).join(' ');
          if (captureResultHelp) captureResultHelp.textContent = hasDraft
            ? (noticeText || label.help)
            : '写真を選ぶと、日時と地点だけで保存できます。';
          captureButtons.forEach((button) => {
            const active = button.getAttribute('data-capture-action') === selectedCaptureKind;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          syncModeUi();
          syncSubmitCta();
          if (hasDraft && form) {
            window.requestAnimationFrame(() => form.scrollIntoView({ block: 'start', behavior: 'auto' }));
          }
          if (selectedVideoFile) {
            setVideoGuideState('picked', '動画を確認しています。', '長さを読んで、保存できる状態か表示します。', '確認中');
          } else if (videoGuide) {
            videoGuide.hidden = true;
          }
          syncVideoPrimaryPhotoUi();
        };

        const setPendingCaptureKind = (kind) => {
          if (!captureLabels[kind]) return;
          if (kind === 'note') {
            showRecordFormForMedia([], 'note');
            renderPreviewFile(null);
            resetVideoProgress();
            resetVideoTrim();
            setAutofillStatus([]);
            return;
          }
          selectedMediaFiles = [];
          selectedVideoFile = null;
          selectedCaptureKind = kind;
          if (form) form.hidden = true;
          if (captureResult) captureResult.hidden = false;
          document.documentElement.classList.remove('record-has-media');
          const label = captureLabels[kind];
          if (captureResultTitle) captureResultTitle.textContent = label.title + 'で始める';
          if (captureResultHelp) captureResultHelp.textContent = 'ログイン後の続きです。下の「' + label.title.replace('を撮る', '').replace('から選ぶ', '') + '」を押すと始められます。';
          syncLocationNudge();
          captureButtons.forEach((button) => {
            const active = button.getAttribute('data-capture-action') === kind;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          syncVideoPrimaryPhotoUi();
          syncSubmitCta();
          syncModeUi();
        };

        const clearSelectedMedia = () => {
          mediaAutofillSequence += 1;
          selectedMediaFiles = [];
          selectedVideoFile = null;
          selectedPrimaryPhotoFile = null;
          pendingMediaRetryObservationId = '';
          selectedCaptureKind = '';
          mediaInputs.forEach((input) => { input.value = ''; });
          if (videoPrimaryPhotoInput) videoPrimaryPhotoInput.value = '';
          if (form) form.hidden = true;
          if (captureResult) captureResult.hidden = true;
          if (locationNudge) locationNudge.hidden = true;
          setAutofillStatus([]);
          selectedMediaCapturedAt = null;
          setSelectedMediaRole('primary_subject');
          updateLocationText();
          document.documentElement.classList.remove('record-has-media');
          captureButtons.forEach((button) => {
            button.classList.remove('is-active');
            button.setAttribute('aria-pressed', 'false');
          });
          renderPreviewFile(null);
          resetVideoTrim();
          resetVideoProgress();
          if (videoGuide) videoGuide.hidden = true;
          syncVideoPrimaryPhotoUi();
          syncSubmitCta();
          syncModeUi();
        };

        const renderPreviewFile = (file) => {
          if (!previewPhoto) return;
          if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = '';
          }
          if (!file) {
            previewPhoto.className = 'record-preview-photo is-empty';
            previewPhoto.innerHTML = '写真 / 動画プレビュー';
            return;
          }
          if (isVideoFile(file)) {
            previewObjectUrl = URL.createObjectURL(file);
            previewPhoto.className = 'record-preview-photo';
            previewPhoto.innerHTML = '<video controls playsinline muted preload="metadata" src="' + previewObjectUrl + '" aria-label="動画プレビュー"></video>';
            return;
          }
          if (isImageFile(file)) {
            previewObjectUrl = URL.createObjectURL(file);
            previewPhoto.className = 'record-preview-photo';
            previewPhoto.innerHTML = '<img src="' + previewObjectUrl + '" alt="preview" />';
            return;
          }
          previewPhoto.className = 'record-preview-photo is-empty';
          previewPhoto.innerHTML = '対応していないファイル形式です。';
        };

        const renderPreviewSelection = () => {
          const files = allSelectedMediaFiles();
          const [first = null] = files;
          renderPreviewFile(first);
          if (previewPhoto && files.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'record-preview-count';
            badge.textContent = selectedMediaSummaryText();
            previewPhoto.appendChild(badge);
          }
        };

        const syncPreview = () => {
          if (!form) return;
          const data = new FormData(form);
          const survey = String(data.get('recordMode') || '') === 'survey';
          const scientificName = String(data.get('scientificName') || '').trim();
          const vernacularName = String(data.get('vernacularName') || '').trim();
          const localityNote = String(data.get('localityNote') || '').trim();
          const municipality = String(data.get('municipality') || '').trim();
          const revisitReason = String(data.get('revisitReason') || '').trim();
          const nextLookFor = String(data.get('nextLookFor') || '').trim();
          const quickCaptureState = String(data.get('quickCaptureState') || 'present');
          const targetTaxaScope = String(data.get('targetTaxaScope') || '').trim();
          const latitude = String(data.get('latitude') || '').trim();
          const longitude = String(data.get('longitude') || '').trim();
          const observedAtValue = String(data.get('observedAt') || '').trim();
          if (previewTitle) previewTitle.textContent = vernacularName || scientificName || '対象を整理中の記録';
          if (previewPlace) {
            previewPlace.textContent = survey
              ? (revisitReason || targetTaxaScope || localityNote || 'また見に行きたい理由や見たかったものを書くと、あとで比べやすくなります。')
              : (nextLookFor
                  || (quickCaptureState === 'no_detection_note'
                    ? '今日は見なかったメモとして残します。'
                    : quickCaptureState === 'unknown'
                      ? 'まだ分からないまま残し、あとで見分け直せます。'
                      : localityNote)
                  || '場所メモが入ると、あとから再訪理由として効きます。');
          }
          if (previewMunicipality) previewMunicipality.textContent = municipality || '自治体未入力';
          if (previewCoords) previewCoords.textContent = latitude && longitude ? latitude + ', ' + longitude : '座標未入力';
          if (previewDate) {
            previewDate.textContent = observedAtValue
              ? new Date(observedAtValue).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
              : '今日';
          }
          syncLocationNudge();
        };

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('file_read_failed'));
          reader.readAsDataURL(file);
        });
        const mapWithConcurrency = async (items, limit, worker) => {
          const results = new Array(items.length);
          let nextIndex = 0;
          const workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
          await Promise.all(Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
              const index = nextIndex;
              nextIndex += 1;
              results[index] = await worker(items[index], index);
            }
          }));
          return results;
        };
        const canvasToJpegDataUrl = (canvas, quality) => new Promise((resolve) => {
          if (!canvas || typeof canvas.toBlob !== 'function') {
            resolve(canvas.toDataURL('image/jpeg', quality));
            return;
          }
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(canvas.toDataURL('image/jpeg', quality));
              return;
            }
            readFileAsDataUrl(blob).then(resolve).catch(() => resolve(canvas.toDataURL('image/jpeg', quality)));
          }, 'image/jpeg', quality);
        });
        const loadImageElementForUpload = (file) => new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const image = new Image();
          image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('photo_decode_failed'));
          };
          image.src = url;
        });
        const loadImageForUpload = async (file) => {
          const createBitmap = typeof window.createImageBitmap === 'function'
            ? window.createImageBitmap.bind(window)
            : (typeof createImageBitmap === 'function' ? createImageBitmap : null);
          if (createBitmap) {
            try {
              return await createBitmap(file, { imageOrientation: 'from-image' });
            } catch (_) {
              try {
                return await createBitmap(file);
              } catch (_) {
                // Fall back to HTMLImageElement decoding below.
              }
            }
          }
          return await loadImageElementForUpload(file);
        };
        const preparePhotoUpload = async (file) => {
          try {
            const image = await loadImageForUpload(file);
            const width = Number(image.naturalWidth || image.width || 0);
            const height = Number(image.naturalHeight || image.height || 0);
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
            const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
            const targetWidth = Math.max(1, Math.round(width * scale));
            const targetHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('photo_canvas_unavailable');
            context.drawImage(image, 0, 0, targetWidth, targetHeight);
            if (image && typeof image.close === 'function') image.close();
            const base64Data = await canvasToJpegDataUrl(canvas, PHOTO_UPLOAD_JPEG_QUALITY);
            const safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
            return {
              filename: safeName + '.jpg',
              mimeType: 'image/jpeg',
              base64Data,
              facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: null },
            };
          } catch (_) {
            return {
              filename: file.name || 'upload.jpg',
              mimeType: file.type || 'image/jpeg',
              base64Data: await readFileAsDataUrl(file),
              facePrivacy: { detector: 'server_async_face_privacy', status: 'pending', faceCount: 0, error: 'photo_canvas_fallback' },
            };
          }
        };
        const sha256Hex = async (value) => {
          if (!(window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined')) return '';
          const bytes = new TextEncoder().encode(String(value || ''));
          const digest = await window.crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        };

        const RECORD_DRAFT_DB = 'ikimon-record-draft';
        const RECORD_DRAFT_STORE = 'drafts';
        const RECORD_DRAFT_KEY = 'latest';
        const openRecordDraftDb = () => new Promise((resolve, reject) => {
          if (!('indexedDB' in window)) {
            reject(new Error('indexeddb_unavailable'));
            return;
          }
          const request = indexedDB.open(RECORD_DRAFT_DB, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(RECORD_DRAFT_STORE)) db.createObjectStore(RECORD_DRAFT_STORE);
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
        });
        const consumeRecordDraft = async () => {
          const db = await openRecordDraftDb();
          try {
            return await new Promise((resolve, reject) => {
              const transaction = db.transaction(RECORD_DRAFT_STORE, 'readwrite');
              const store = transaction.objectStore(RECORD_DRAFT_STORE);
              const request = store.get(RECORD_DRAFT_KEY);
              let value = null;
              request.onsuccess = () => {
                value = request.result || null;
                store.delete(RECORD_DRAFT_KEY);
                if (window.ikimonAppOutbox && typeof window.ikimonAppOutbox.delete === 'function') {
                  window.ikimonAppOutbox.delete('record:' + RECORD_DRAFT_KEY).catch(() => undefined);
                }
              };
              request.onerror = () => reject(request.error || new Error('indexeddb_read_failed'));
              transaction.oncomplete = () => resolve(value);
              transaction.onerror = () => reject(transaction.error || new Error('indexeddb_transaction_failed'));
            });
          } finally {
            db.close();
          }
        };
        const importGlobalRecordDraft = async () => {
          const params = new URLSearchParams(window.location.search);
          if (params.get('draft') !== '1') return;
          let draft = null;
          try {
            draft = await consumeRecordDraft();
          } catch (_) {
            draft = null;
          }
          const draftFiles = draft && Array.isArray(draft.files) ? draft.files.filter((file) => file instanceof File) : [];
          const file = draft && draft.file instanceof File ? draft.file : null;
          const files = draftFiles.length ? draftFiles : (file ? [file] : []);
          const kind = draft && captureLabels[draft.kind] ? draft.kind : (params.get('start') || 'gallery');
          const metadata = normalizeDraftMetadata(draft && draft.metadata);
          setSelectedMediaRole(metadata.mediaRole || (kind === 'video' ? 'sound_motion' : 'primary_subject'));
          if (!files.length) {
            setPendingCaptureKind(kind);
            return;
          }
          selectedMediaCapturedAt = null;
          clearMediaInputsExcept(null);
          const normalized = normalizeSelectedFiles(files, kind);
          showRecordFormForMedia(files, kind);
          renderPreviewSelection();
          const firstAutofillFile = normalized.photos[0] || normalized.video || null;
          if (!normalized.video) {
            resetVideoTrim();
            resetVideoProgress();
            scheduleMediaAutofill(firstAutofillFile, metadata, { autoLocateFreshCapture: kind === 'photo' || kind === 'gallery' });
          } else if (videoProgressWrap) {
            scheduleMediaAutofill(firstAutofillFile, metadata, { autoLocateFreshCapture: kind === 'video' });
            let trimReady = true;
            try {
              await loadVideoTrimEditor(normalized.video);
            } catch (_) {
              trimReady = false;
              resetVideoTrim();
              if (videoLive) videoLive.textContent = '端末で秒数を読めませんでした。60秒以内の動画ならこのまま記録できます。';
            }
            videoProgressWrap.hidden = false;
            if (trimReady && videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
          }
        };

        const validateVideoDuration = async (file) => {
          let duration = 0;
          try {
            duration = await getVideoDuration(file);
          } catch (error) {
            if (isVideoDurationReadError(error)) return null;
            throw error;
          }
          if (duration > MAX_VIDEO_SECONDS + 0.5) {
            throw new Error('video_duration_too_long');
          }
          return duration;
        };

        const uploadVideoWithDirectPost = (directUploadUrl, file) =>
          new Promise((resolve, reject) => {
            let settled = false;
            const request = new XMLHttpRequest();
            const finish = (error) => {
              if (settled) return;
              settled = true;
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              if (error) reject(error);
              else resolve(true);
            };
            request.upload.onprogress = (event) => {
              updateVideoProgress(event.loaded || 0, event.lengthComputable ? event.total : (file.size || 0));
              if (videoLive) videoLive.textContent = '動画をアップロード中です。';
            };
            request.onerror = () => finish(new Error('video_upload_network_failed'));
            request.onabort = () => finish(new Error('video_upload_cancelled'));
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) {
                updateVideoProgress(file.size || 0, file.size || 0);
                if (videoLive) videoLive.textContent = '動画アップロードが完了しました。';
                finish(null);
                return;
              }
              finish(new Error('video_upload_failed:' + String(request.status) + ':' + String(request.responseText || '').slice(0, 120)));
            };

            activeTusUpload = request;
            cancelTusUpload = () => {
              request.abort();
            };
            if (videoCancel) videoCancel.disabled = false;
            updateVideoProgress(0, file.size || 0);
            const formData = new FormData();
            formData.append('file', file, file.name || 'upload.mp4');
            request.open('POST', directUploadUrl, true);
            request.send(formData);
          });

        const requestTusOffset = (uploadUrl) =>
          new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) {
                const offset = Number(request.getResponseHeader('Upload-Offset') || '0');
                resolve(Number.isFinite(offset) && offset >= 0 ? offset : 0);
                return;
              }
              reject(new Error('video_tus_offset_failed:' + String(request.status)));
            };
            request.onerror = () => reject(new Error('video_tus_offset_network_failed'));
            request.open('HEAD', uploadUrl, true);
            request.setRequestHeader('Tus-Resumable', '1.0.0');
            request.send();
          });

        const uploadVideoWithTus = (uploadUrl, file) =>
          new Promise((resolve, reject) => {
            let settled = false;
            let offset = 0;
            let currentRequest = null;
            const finish = (error) => {
              if (settled) return;
              settled = true;
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              if (error) reject(error);
              else resolve(true);
            };
            const sendChunk = async () => {
              if (settled) return;
              if (offset >= file.size) {
                updateVideoProgress(file.size || 0, file.size || 0);
                if (videoLive) videoLive.textContent = '動画アップロードが完了しました。処理が終わるまで少し待ってください。';
                finish(null);
                return;
              }
              const end = Math.min(file.size, offset + TUS_CHUNK_BYTES);
              const chunk = file.slice(offset, end);
              let attempts = 0;
              const patch = () => {
                attempts += 1;
                const request = new XMLHttpRequest();
                currentRequest = request;
                activeTusUpload = request;
                request.upload.onprogress = (event) => {
                  updateVideoProgress(offset + (event.loaded || 0), file.size || 0);
                  if (videoLive) videoLive.textContent = '動画を分割してアップロード中です。通信が途切れても途中から続けます。';
                };
                request.onerror = async () => {
                  if (settled) return;
                  if (attempts <= 3) {
                    try {
                      offset = await requestTusOffset(uploadUrl);
                    } catch (_) {
                      // keep local offset and retry
                    }
                    window.setTimeout(patch, 600 * attempts);
                    return;
                  }
                  finish(new Error('video_tus_upload_network_failed'));
                };
                request.onabort = () => finish(new Error('video_upload_cancelled'));
                request.onload = () => {
                  if (request.status >= 200 && request.status < 300) {
                    const nextOffset = Number(request.getResponseHeader('Upload-Offset') || String(end));
                    offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : end;
                    updateVideoProgress(offset, file.size || 0);
                    sendChunk();
                    return;
                  }
                  finish(new Error('video_tus_upload_failed:' + String(request.status) + ':' + String(request.responseText || '').slice(0, 120)));
                };
                request.open('PATCH', uploadUrl, true);
                request.setRequestHeader('Tus-Resumable', '1.0.0');
                request.setRequestHeader('Upload-Offset', String(offset));
                request.setRequestHeader('Content-Type', 'application/offset+octet-stream');
                request.send(chunk);
              };
              patch();
            };
            cancelTusUpload = () => {
              if (currentRequest) currentRequest.abort();
              else finish(new Error('video_upload_cancelled'));
            };
            if (videoCancel) videoCancel.disabled = false;
            updateVideoProgress(0, file.size || 0);
            sendChunk();
          });

        if (form) {
          form.addEventListener('input', syncPreview);
        }
        modeButtons.forEach((button) => {
          button.addEventListener('click', () => {
            if (!modeInput) return;
            modeInput.value = button.getAttribute('data-record-mode') || 'quick';
            syncModeUi();
            syncPreview();
          });
        });
        const delegateToGlobalRecordLauncher = (action) => {
          if (action !== 'photo' && action !== 'video' && action !== 'gallery') return false;
          if (window.matchMedia && !window.matchMedia('(max-width: 720px)').matches) return false;
          const trigger = document.querySelector('[data-global-record-trigger="' + action + '"]');
          if (!trigger || typeof trigger.click !== 'function') return false;
          trigger.click();
          return true;
        };
        captureButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const action = button.getAttribute('data-capture-action') || 'gallery';
            sendRecordFunnelStep('capture_method_selected', { captureKind: action });
            if (action === 'note') {
              selectedMediaCapturedAt = null;
              mediaAutofillSequence += 1;
              clearMediaInputsExcept(null);
              showRecordFormForMedia([], 'note');
              renderPreviewFile(null);
              resetVideoProgress();
              resetVideoTrim();
              setAutofillStatus([]);
              return;
            }
            if (delegateToGlobalRecordLauncher(action)) return;
            const target = document.querySelector('[data-record-media-input][data-capture-kind="' + action + '"]') || mediaInput;
            if (target && typeof target.click === 'function') target.click();
          });
        });
        mediaInputs.forEach((input) => {
          input.addEventListener('change', async () => {
            const files = input.files ? Array.from(input.files) : [];
            const kind = input.getAttribute('data-capture-kind') || 'gallery';
            selectedMediaCapturedAt = null;
            mediaAutofillSequence += 1;
            clearMediaInputsExcept(input);
            const normalized = normalizeSelectedFiles(files, kind);
            if (normalized.photos.length || normalized.video) {
              sendRecordFunnelStep('media_selected', {
                captureKind: kind,
                mediaCount: normalized.photos.length + (normalized.video ? 1 : 0),
                photoCount: normalized.photos.length,
                videoCount: normalized.video ? 1 : 0,
              });
            }
            if (!files.length || (!normalized.photos.length && !normalized.video)) {
              selectedMediaFiles = [];
              selectedVideoFile = null;
              renderPreviewFile(null);
              showRecordFormForMedia([], '');
              resetVideoProgress();
              resetVideoTrim();
              setAutofillStatus([]);
            } else if (!normalized.video) {
              setSelectedMediaRole('primary_subject');
              showRecordFormForMedia(files, kind);
              renderPreviewSelection();
              resetVideoProgress();
              resetVideoTrim();
              scheduleMediaAutofill(normalized.photos[0] || null, {}, { autoLocateFreshCapture: kind === 'photo' || kind === 'gallery' });
            } else if (videoProgressWrap) {
              setSelectedMediaRole(kind === 'video' ? 'sound_motion' : 'primary_subject');
              showRecordFormForMedia(files, kind);
              renderPreviewSelection();
              scheduleMediaAutofill(normalized.photos[0] || normalized.video, {}, { autoLocateFreshCapture: kind === 'video' });
              let trimReady = true;
              try {
                await loadVideoTrimEditor(normalized.video);
              } catch (_) {
                trimReady = false;
                resetVideoTrim();
                if (videoLive) videoLive.textContent = '端末で秒数を読めませんでした。60秒以内の動画ならこのまま記録できます。';
                setVideoGuideState('ready', '動画を選べました。', '端末で秒数を読めませんでした。60秒以内の動画として保存時に確認します。', '確認中');
              }
              videoProgressWrap.hidden = false;
              if (trimReady && videoLive) videoLive.textContent = '長さを確認しました。保存を押すとアップロードします。';
            }
          });
        });
        if (videoPrimaryPhotoPick && videoPrimaryPhotoInput) {
          videoPrimaryPhotoPick.addEventListener('click', () => {
            if (typeof videoPrimaryPhotoInput.click === 'function') videoPrimaryPhotoInput.click();
          });
        }
        if (videoPrimaryPhotoInput) {
          videoPrimaryPhotoInput.addEventListener('change', async () => {
            const file = videoPrimaryPhotoInput.files ? Array.from(videoPrimaryPhotoInput.files)[0] || null : null;
            if (!file) return;
            if (!isImageFile(file)) {
              selectedPrimaryPhotoFile = null;
              syncVideoPrimaryPhotoUi();
              setStatus('<div class="row"><div>主役写真には画像ファイルを選んでください。</div></div>');
              return;
            }
            selectedPrimaryPhotoFile = file;
            syncVideoPrimaryPhotoUi();
            scheduleMediaAutofill(file, {}, { autoLocateFreshCapture: false });
          });
        }
        if (videoPrimaryPhotoClear) {
          videoPrimaryPhotoClear.addEventListener('click', () => {
            selectedPrimaryPhotoFile = null;
            if (videoPrimaryPhotoInput) videoPrimaryPhotoInput.value = '';
            syncVideoPrimaryPhotoUi();
          });
        }
        if (captureChange) {
          captureChange.addEventListener('click', clearSelectedMedia);
        }
        if (videoTrimStart) {
          videoTrimStart.addEventListener('input', () => syncVideoTrimControls('start'));
        }
        if (videoTrimEnd) {
          videoTrimEnd.addEventListener('input', () => syncVideoTrimControls('end'));
        }
        if (videoTrimFirst) {
          videoTrimFirst.addEventListener('click', () => {
            if (!videoTrimState) return;
            setVideoTrimRange(0, Math.min(videoTrimState.duration, MAX_VIDEO_SECONDS));
          });
        }
        if (videoTrimLast) {
          videoTrimLast.addEventListener('click', () => {
            if (!videoTrimState) return;
            const end = Number(videoTrimState.duration || 0);
            setVideoTrimRange(Math.max(0, end - MAX_VIDEO_SECONDS), end);
          });
        }
        if (videoTrimPlayer) {
          videoTrimPlayer.addEventListener('timeupdate', () => {
            if (!videoTrimState) return;
            const end = Number(videoTrimState.end || 0);
            if (Number(videoTrimPlayer.currentTime || 0) > end) {
              videoTrimPlayer.pause();
              videoTrimPlayer.currentTime = Number(videoTrimState.start || 0);
            }
          });
        }
        if (videoTrimApply) {
          videoTrimApply.addEventListener('click', applyVideoTrim);
        }
        mediaRoleInputs.forEach((input) => {
          input.addEventListener('change', () => {
            if (input.checked) setSelectedMediaRole(input.value);
          });
        });
        locateButtons.forEach((button) => {
          button.addEventListener('click', fillCurrentLocation);
        });
        if (locationSearchButton) {
          locationSearchButton.addEventListener('click', searchRecordLocation);
        }
        if (locationSearchInput) {
          locationSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              searchRecordLocation();
            }
          });
        }
        if (form) {
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          [latField, lngField].forEach((field) => {
            if (field && field.addEventListener) {
              field.addEventListener('input', () => {
                updateLocationText('座標を直接編集');
                const coords = readCoords();
                if (coords) {
                  setRecordLocationProvenance('manual_coordinate_edit', coords.lat, coords.lng, {
                    label: '座標を直接編集',
                    reverseGeocode: false,
                  });
                  sendRecordFunnelStep('location_set', {
                    locationSource: 'manual_coordinate_edit',
                    latitude: coords.lat.toFixed(6),
                    longitude: coords.lng.toFixed(6),
                  });
                }
                syncPreview();
                syncLocationNudge();
              });
            }
          });
        }
        if (videoCancel) {
          videoCancel.addEventListener('click', () => {
            if (typeof cancelTusUpload === 'function') {
              cancelTusUpload();
              setStatus('<div class="row"><div>動画アップロードをキャンセルしました。</div></div>');
            }
          });
        }

        applyPrefillFromQuery();
        syncModeUi();
        syncPreview();
        resetVideoProgress();
        applyStartModeFromQuery();
        importGlobalRecordDraft();
        sendRecordFunnelStep('record_open', {
          hasRevisitContext: Boolean(recordStartParams.get('revisitObservationId') || recordStartParams.get('revisit_of_visit_id')),
        });

        document.addEventListener('click', (event) => {
          const target = event.target && event.target.closest ? event.target.closest('[data-record-success-cta]') : null;
          if (!target) return;
          sendRecordCtaClick('record_success_' + (target.getAttribute('data-record-success-cta') || 'unknown'), {
            href: target.getAttribute('href') || '',
          });
        });

        if (form) {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (recordSubmitInFlight) return;
            const data = new FormData(form);
            const userId = form.dataset.userId || '';
            const observationId = pendingMediaRetryObservationId || 'record-' + Date.now();
            let savedDetailId = '';
            let savedVisitId = '';
            if (!userId) {
              setStatus('<div class="row"><div>ログイン情報を確認できませんでした。ページを開き直してから、もう一度お試しください。</div></div>');
              return;
            }
            setRecordSubmitting(true);
            setStatus('<div class="row"><div>記録を送信中...</div></div>');
            sendRecordFunnelStep('submit_attempt', {
              pendingMediaRetry: Boolean(pendingMediaRetryObservationId),
              mediaCount: safeAllSelectedMediaFiles().length,
            });
            try {
              const recordMode = String(data.get('recordMode') || 'quick') === 'survey' ? 'survey' : 'quick';
              const checklistCompletion = String(data.get('checklistCompletion') || 'complete');
              const targetTaxaScope = String(data.get('targetTaxaScope') || '').trim();
              const effortMinutes = Number(data.get('effortMinutes'));
              const revisitReason = String(data.get('revisitReason') || '').trim();
              const nextLookFor = String(data.get('nextLookFor') || '').trim();
              const quickCaptureState = String(data.get('quickCaptureState') || 'present');
              const activityIntent = String(data.get('activityIntent') || 'discover').trim();
              const participantRole = String(data.get('participantRole') || 'finder').trim();
              const revisitOfVisitId = String(data.get('revisitOfVisitId') || '').trim();
              const placeIdHint = String(data.get('placeId') || '').trim();
              const surveyResult = String(data.get('surveyResult') || 'detected');
              const catchOutcome = String(data.get('catchOutcome') || '').trim();
              const captureMethod = String(data.get('captureMethod') || '').trim();
              const participantCount = Number(data.get('participantCount'));
              const publicWaterbodyLabel = String(data.get('publicWaterbodyLabel') || '').trim();
              const releasedCount = Number(data.get('releasedCount'));
              const keptCount = Number(data.get('keptCount'));
              const fieldScanMode = String(data.get('fieldScanMode') || '').trim();
              const fixedPointId = String(data.get('fixedPointId') || '').trim();
              const routeId = String(data.get('routeId') || '').trim();
              const areaId = String(data.get('areaId') || '').trim();
              const eventCode = String(recordStartParams.get('event') || recordStartParams.get('eventCode') || '').trim();
              const eventSessionId = String(recordStartParams.get('eventSessionId') || '').trim();
              const eventTeamId = String(recordStartParams.get('teamId') || '').trim();
              const eventParticipantRole = String(recordStartParams.get('participantRole') || participantRole || '').trim();
              if (recordMode === 'survey') {
                if (!targetTaxaScope) {
                  throw new Error('survey_target_scope_required');
                }
                if (!Number.isFinite(effortMinutes) || effortMinutes <= 0) {
                  throw new Error('survey_effort_required');
                }
                if (!revisitReason) {
                  throw new Error('survey_revisit_reason_required');
                }
              }
              const speciesNote = recordMode === 'survey'
                ? '[survey] ' + revisitReason + (surveyResult === 'no_detection_note' ? ' / no target detected protocol note' : '')
                : '';
              const scientificName = String(data.get('scientificName') || '').trim();
              const vernacularName = String(data.get('vernacularName') || '').trim();
              const rank = String(data.get('rank') || '').trim();
              const mediaRole = normalizeMediaRole(data.get('mediaRole') || selectedMediaRole);
              const photoFiles = selectedPhotoFiles();
              const primaryPhotoFile = selectedPrimaryPhotoFile instanceof File && selectedPrimaryPhotoFile.size > 0 ? selectedPrimaryPhotoFile : null;
              const photoUploadList = [
                ...photoFiles.map((file, index) => ({
                  file,
                  role: index === 0 ? (mediaRole === 'sound_motion' ? 'primary_subject' : mediaRole) : 'context',
                })),
                ...(primaryPhotoFile ? [{ file: primaryPhotoFile, role: 'primary_subject' }] : []),
              ];
              const preparedPhotoUploads = [];
              const clientPhotoHashes = [];
              if (photoUploadList.length > 0) {
                setStatus('<div class="row"><div>写真を記録用に整えています...</div></div>');
              }
              let preparedPhotoCount = 0;
              const preparedPhotoItems = await mapWithConcurrency(photoUploadList, PHOTO_UPLOAD_CONCURRENCY, async (item) => {
                const upload = await preparePhotoUpload(item.file);
                const hash = await sha256Hex(upload.base64Data);
                preparedPhotoCount += 1;
                setStatus('<div class="row"><div>写真を記録用に整えています... ' + String(preparedPhotoCount) + '/' + String(photoUploadList.length) + '</div></div>');
                return {
                  upload,
                  role: item.role,
                  hash: hash || [upload.filename, upload.mimeType, String(item.file && item.file.size || 0)].join(':'),
                };
              });
              preparedPhotoItems.forEach((item) => {
                preparedPhotoUploads.push({ upload: item.upload, role: item.role });
                clientPhotoHashes.push(item.hash);
              });
              const observedAtIso = new Date(String(data.get('observedAt'))).toISOString();
              const latitude = Number(data.get('latitude'));
              const longitude = Number(data.get('longitude'));
              const videoFingerprint = selectedVideoFile instanceof File
                ? ['video', selectedVideoFile.name || '', String(selectedVideoFile.size || 0), String(selectedVideoFile.lastModified || 0)].join(':')
                : '';
              const clientSubmissionSeed = [
                userId,
                observedAtIso,
                Number.isFinite(latitude) ? latitude.toFixed(6) : '',
                Number.isFinite(longitude) ? longitude.toFixed(6) : '',
                clientPhotoHashes.join(','),
                videoFingerprint,
              ].join('|');
              const clientSubmissionId = 'record-form:' + ((await sha256Hex(clientSubmissionSeed)) || observationId);
              const civicContextKind = activityIntent === 'manage'
                ? 'satoyama'
                : activityIntent === 'confirm'
                  ? 'risk'
                  : activityIntent === 'learn'
                    ? 'school'
                    : activityIntent === 'share'
                      ? 'event'
                      : 'ordinary';
              const payload = {
                observationId,
                legacyObservationId: observationId,
                clientSubmissionId,
                userId,
                observedAt: observedAtIso,
                latitude,
                longitude,
                prefecture: String(data.get('prefecture') || ''),
                municipality: String(data.get('municipality') || ''),
                localityNote: String(data.get('localityNote') || ''),
                note: speciesNote,
                visitMode: recordMode === 'survey' ? 'survey' : 'manual',
                completeChecklistFlag: recordMode === 'survey' ? checklistCompletion === 'complete' : false,
                targetTaxaScope: recordMode === 'survey' ? targetTaxaScope : null,
                effortMinutes: recordMode === 'survey' ? effortMinutes : null,
                revisitReason: recordMode === 'survey' ? revisitReason : nextLookFor || null,
                sourcePayload: {
                  source: 'v2_web',
                  record_mode: recordMode,
                  survey_result: recordMode === 'survey' ? surveyResult : null,
                  quick_capture_state: recordMode === 'survey' ? null : quickCaptureState,
                  next_look_for: recordMode === 'survey' ? null : (nextLookFor || null),
                  media_role: mediaRole,
                  place_id_hint: placeIdHint || null,
                  client_submission_id: clientSubmissionId,
                  client_photo_sha256s: clientPhotoHashes,
                  location_provenance: recordLocationProvenance,
                  field_scan_requested: Boolean(fieldScanMode),
                  absence_semantics: recordMode === 'survey'
                    ? (surveyResult === 'no_detection_note' ? 'protocol_note_only' : null)
                    : (quickCaptureState === 'no_detection_note'
                        ? 'casual_note_only'
                        : quickCaptureState === 'unknown'
                          ? 'needs_followup'
                          : null),
                  water_record_requested: Boolean(catchOutcome),
                },
                civicContext: {
                  contextKind: civicContextKind,
                  activityIntent,
                  participantRole,
                  audienceScope: activityIntent === 'learn' ? 'class_group' : activityIntent === 'share' ? 'event_participants' : 'private',
                  publicPrecision: 'municipality',
                  riskLane: activityIntent === 'confirm' ? 'danger_candidate' : 'normal',
                  reportConsent: 'none',
                  revisitOfVisitId: revisitOfVisitId || null,
                  sourcePayload: {
                    source: 'record_form_context',
                    record_mode: recordMode,
                  },
                },
                dataRights: {
                  recordConsent: 'private',
                  researchUseConsent: 'none',
                  enterpriseReportConsent: 'none',
                  mediaLicense: 'all_rights_reserved',
                  externalExportAllowed: false,
                  withdrawalStatus: 'active',
                  sourcePayload: {
                    source: 'record_form_default_rights',
                  },
                },
                waterRecord: catchOutcome
                  ? {
                      catchOutcome,
                      captureMethod: captureMethod || null,
                      participantCount: Number.isFinite(participantCount) && participantCount > 0 ? participantCount : null,
                      effortMinutes: recordMode === 'survey' ? effortMinutes : null,
                      targetTaxaScope: targetTaxaScope || scientificName || vernacularName || null,
                      releasedCount: Number.isFinite(releasedCount) && releasedCount >= 0 ? releasedCount : null,
                      keptCount: Number.isFinite(keptCount) && keptCount >= 0 ? keptCount : null,
                      publicWaterbodyLabel: publicWaterbodyLabel || null,
                      waterbodyType: 'unspecified',
                      geometryPrecision: publicWaterbodyLabel ? 'label_only' : null,
                      sourcePayload: {
                        source: 'record_form_water_fields',
                        no_catch_semantics: catchOutcome === 'no_catch' ? 'capture_attempt_not_species_absence' : null,
                      },
                    }
                  : null,
                eventCode: eventCode || null,
                eventSessionId: eventSessionId || null,
                teamId: eventTeamId || null,
                participantRole: eventParticipantRole || null,
                fieldScan: fieldScanMode
                  ? {
                      scanMode: fieldScanMode,
                      fixedPointId: fixedPointId || null,
                      routeId: routeId || null,
                      areaId: areaId || null,
                      methodPayload: {
                        record_mode: recordMode,
                        target_taxa_scope: targetTaxaScope || null,
                        effort_minutes: recordMode === 'survey' ? effortMinutes : null,
                      },
                      qualityPayload: {
                        media_role: mediaRole,
                        photo_count: preparedPhotoUploads.length,
                        has_video: Boolean(selectedVideoFile),
                      },
                      sourcePayload: {
                        source: 'record_form_field_scan',
                      },
                    }
                  : null,
                governanceContext: fieldScanMode || recordMode === 'survey'
                  ? {
                      localKnowledgeContext: {},
                      sitePolicyContext: {
                        publicPrecision: 'municipality',
                      },
                      reviewScope: {
                        mode: fieldScanMode ? 'field_scan' : 'guide_survey',
                        fieldScanMode: fieldScanMode || null,
                        targetTaxaScope: targetTaxaScope || null,
                      },
                      rolePermissions: {
                        observer: ['submit'],
                        reviewer: ['verify', 'generalize_public_precision'],
                      },
                      publicPrecisionPolicy: 'system_risk_cap',
                      sourcePayload: {
                        source: 'record_form_governance_default',
                      },
                    }
                  : null,
                taxon: scientificName || vernacularName
                  ? {
                      scientificName,
                      vernacularName,
                      rank,
                    }
                  : null,
              };

              const observationResponse = await fetch(withBasePath('/api/v1/observations/upsert'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
              });
              const observationJson = await observationResponse.json();
              if (!observationResponse.ok || !observationJson.ok) {
                throw new Error(observationJson.error || 'observation_upsert_failed');
              }
              const detailId = String(observationJson.occurrenceId || observationId);
              const visitId = String(observationJson.visitId || observationId);
              savedDetailId = detailId;
              savedVisitId = visitId;
              sendRecordFunnelStep('observation_upsert_success', {
                visitId,
                occurrenceId: detailId,
                placeId: observationJson.placeId || null,
                occurrenceCount: Array.isArray(observationJson.occurrenceIds) ? observationJson.occurrenceIds.length : 1,
              });
              let extraStatus = '';

              const uploadPhotoFile = async (upload, mediaRoleForPhoto, index, total) => {
                setStatus('<div class="row"><div>写真を保存しています... ' + String(index) + '/' + String(total) + '</div></div>');
                const photoResponse = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(detailId) + '/photos/upload'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', accept: 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    filename: upload.filename,
                    mimeType: upload.mimeType,
                    base64Data: upload.base64Data,
                    mediaRole: mediaRoleForPhoto,
                    facePrivacy: upload.facePrivacy || null,
                  }),
                });
                const photoJson = await photoResponse.json();
                if (!photoResponse.ok || !photoJson.ok) {
                  throw new Error('photo_upload_failed_at_' + String(index) + ':' + (photoJson.error || 'photo_upload_failed'));
                }
                sendRecordFunnelStep('photo_upload_success', {
                  visitId,
                  occurrenceId: detailId,
                  photoIndex: index,
                  photoTotal: total,
                  mediaRole: mediaRoleForPhoto,
                });
              };

              await mapWithConcurrency(preparedPhotoUploads, PHOTO_UPLOAD_CONCURRENCY, async (item, index) => {
                await uploadPhotoFile(item.upload, item.role, index + 1, preparedPhotoUploads.length);
              });
              if (preparedPhotoUploads.length > 0) {
                extraStatus = '写真' + String(preparedPhotoUploads.length) + '枚を同じ記録に保存しました。';
              }

              let videoFile = selectedVideoFile instanceof File && selectedVideoFile.size > 0 ? selectedVideoFile : null;
              let videoStreamUid = '';
              let videoReadyToStream = false;
              if (videoFile) {
                  videoFile = await ensureVideoReadyForUpload(videoFile);
                  if (videoFile.size > MAX_VIDEO_TUS_BYTES) {
                    throw new Error('video_file_too_large');
                  }
                  await validateVideoDuration(videoFile);
                  const uploadProtocol = videoFile.size >= MAX_VIDEO_BASIC_POST_BYTES ? 'tus' : 'post';
                  const videoDetailHref = withBasePath('/observations/' + encodeURIComponent(detailId));

                  setStatus('<div class="row"><div>動画アップロードの準備をしています...</div></div>');
                  setVideoPublicationStatus('uploading', videoDetailHref);
                  const issueResponse = await fetch(withBasePath('/api/v1/videos/direct-upload'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      filename: videoFile.name || 'upload.mp4',
                      maxDurationSeconds: MAX_VIDEO_SECONDS,
                      observationId: detailId,
                      mediaRole: 'sound_motion',
                      uploadProtocol,
                      fileSizeBytes: videoFile.size,
                    }),
                  });
                  const issueJson = await issueResponse.json();
                  if (!issueResponse.ok || !issueJson.ok || !issueJson.uploadUrl || !issueJson.uid) {
                    throw new Error(issueJson.error || 'video_issue_failed');
                  }
                  videoStreamUid = String(issueJson.uid || '');

                  if (String(issueJson.uploadProtocol || uploadProtocol) === 'tus') {
                    await uploadVideoWithTus(String(issueJson.uploadUrl), videoFile);
                  } else {
                    await uploadVideoWithDirectPost(String(issueJson.uploadUrl), videoFile);
                  }
                  setStatus('<div class="row"><div>動画を記録に紐づけています...</div></div>');
                  setVideoPublicationStatus('uploaded', videoDetailHref);

                  const finalizeResponse = await fetch(withBasePath('/api/v1/videos/' + encodeURIComponent(String(issueJson.uid)) + '/finalize'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      observationId: detailId,
                      mediaRole: 'sound_motion',
                    }),
                  });
                  const finalizeJson = await finalizeResponse.json();
                  if (!finalizeResponse.ok || !finalizeJson.ok) {
                    throw new Error(finalizeJson.error || 'video_finalize_failed');
                  }
                  sendRecordFunnelStep('video_upload_success', {
                    visitId,
                    occurrenceId: detailId,
                    uploadProtocol,
                    readyToStream: Boolean(finalizeJson.video && finalizeJson.video.readyToStream),
                    streamUid: String(issueJson.uid || ''),
                  });
                  const videoReady = Boolean(finalizeJson.video && finalizeJson.video.readyToStream);
                  videoReadyToStream = videoReady;
                  setVideoPublicationStatus('processing', videoDetailHref);
                  if (videoReady) {
                    extraStatus = [extraStatus, '動画は保存済みです。公開までの状態を下に表示しています。'].filter(Boolean).join(' ');
                  } else {
                    extraStatus = [extraStatus, '動画は保存済みです。再生準備が終わるまで、公開までの状態を下に表示しています。'].filter(Boolean).join(' ');
                  }
              }

              const suffix = extraStatus
                ? extraStatus
                : '';
              const impactHtml = buildImpactHtml(observationJson.impact || null, suffix);
              const observationHref = withBasePath('/observations/' + encodeURIComponent(detailId));
              const notesHref = withBasePath('/records?view=mine');
              const revisitHref = withBasePath('/record?start=gallery&revisitObservationId=' + encodeURIComponent(visitId));
              setStatus('<div class="row"><div><strong>記録を保存しました。</strong>' + impactHtml + '<div class="meta"><a href="' + notesHref + '" data-record-success-cta="notes">記録を見る</a> · <a href="' + observationHref + '" data-record-success-cta="observation_detail">見つけたものを確認する</a> · <a href="' + revisitHref + '" data-record-success-cta="revisit_same_place">同じ場所でもう1件記録する</a></div></div></div>');
              sendRecordFunnelStep('record_success_rendered', {
                visitId,
                occurrenceId: detailId,
                placeId: observationJson.placeId || null,
                successCtas: ['observation_detail', 'revisit_same_place', 'notes'],
              });
              sendRecordTaskCompletion('record_saved', {
                visitId,
                occurrenceId: detailId,
                placeId: observationJson.placeId || null,
                mediaCount: safeAllSelectedMediaFiles().length,
                photoUploadCount: preparedPhotoUploads.length,
                hasVideo: Boolean(selectedVideoFile),
              });
              pendingMediaRetryObservationId = '';
              form.reset();
              if (modeInput) modeInput.value = 'quick';
              if (observedAt) {
                const now = new Date();
                observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              }
              clearSelectedMedia();
              if (videoFile) {
                const videoDetailHref = withBasePath('/observations/' + encodeURIComponent(detailId));
                if (videoReadyToStream) {
                  setVideoPublicationStatus('public', videoDetailHref);
                } else {
                  setVideoPublicationStatus('processing', videoDetailHref);
                  void waitForVideoPublication(videoDetailHref, videoStreamUid, detailId);
                }
              }
              syncModeUi();
              syncPreview();
            } catch (error) {
              const message = normalizeError(error);
              let userMessage = message;
              if (message === 'video_file_too_large') userMessage = '動画サイズが大きすぎます。短く切り出すか、画質を下げてください。';
              if (message === 'video_duration_too_long') userMessage = '動画の長さは 60 秒以内にしてください。';
              if (message === 'video_trim_required') userMessage = '動画は記録前に最大60秒の区間を選んでください。';
              if (message === 'video_trim_range_invalid') userMessage = '動画の切り出し範囲は最大60秒にしてください。';
              if (message === 'video_trim_unsupported') userMessage = 'このブラウザでは動画の切り出しに対応していません。60秒以内の動画を選んでください。';
              if (message === 'video_upload_library_unavailable') userMessage = '動画アップロード部品を読み込めませんでした。通信状態を確認して再読み込みしてください。';
              if (message === 'video_upload_cancelled') userMessage = '動画アップロードをキャンセルしました。';
              if (message.startsWith('photo_upload_failed_at_')) {
                const match = message.match(/^photo_upload_failed_at_(\\d+)/);
                userMessage = '写真' + (match ? match[1] : '') + '枚目の保存に失敗しました。記録本体は保存済みなら、詳細ページから確認できます。';
              }
              if (message === 'cloudflare_stream_not_configured') userMessage = '動画アップロードの設定が有効ではありません。写真と記録本体は保存済みなら、詳細ページから確認できます。';
              if (message.startsWith('cloudflare_error') || message.startsWith('cloudflare_tus_error') || message === 'video_issue_failed') userMessage = '動画アップロードの準備ができませんでした。時間をおいて動画だけ再試行してください。';
              const isGenericVideoUploadError = (message.indexOf('tus') >= 0 || message.indexOf('upload') >= 0)
                && message.indexOf('photo_upload_failed_at_') < 0
                && message !== 'video_upload_library_unavailable'
                && message !== 'video_upload_cancelled'
                && message !== 'cloudflare_stream_not_configured'
                && message !== 'video_issue_failed'
                && !message.startsWith('cloudflare_error');
              if (isGenericVideoUploadError) userMessage = '動画アップロードに失敗しました。通信状態を確認して動画だけ再試行してください。';
              if (message === 'video_metadata_read_failed' || message === 'video_duration_unknown') userMessage = '動画の長さを確認できませんでした。別の動画で試してください。';
              if (message === 'unsupported_media_type') userMessage = '画像または動画ファイルを選択してください。';
              if (message === 'survey_target_scope_required') userMessage = 'しっかり記録では、何を見たかったかを入力してください。';
              if (message === 'survey_effort_required') userMessage = 'しっかり記録では、見た時間を入力してください。';
              if (message === 'survey_revisit_reason_required') userMessage = 'しっかり記録では、また見に行きたい理由を入力してください。';
              const partialLink = savedDetailId
                ? '<div class="meta"><a href="' + withBasePath('/observations/' + encodeURIComponent(savedDetailId)) + '">保存済みの見つけたものを見る</a> · メディアだけ再試行する場合はこの画面のまま再送信してください。</div>'
                : '';
              const invasiveReportingNote = savedDetailId
                ? '<div class="meta">AI判定で外来種候補になった場合、許可済みの自治体・機関へ写真・日時・詳細位置を自動共有することがあります。公開ページに詳細位置は出ません。</div>'
                : '';
              const statusHeading = savedDetailId ? '記録本体は保存済みです。' : '送信に失敗しました。';
              if (savedDetailId) pendingMediaRetryObservationId = observationId;
              const funnelErrorAction = message.startsWith('photo_upload_failed_at_')
                ? 'photo_upload_error'
                : (message.indexOf('video') >= 0 || message.indexOf('cloudflare') >= 0 || message.indexOf('tus') >= 0)
                  ? 'video_upload_error'
                  : 'record_submit_error';
              if (funnelErrorAction === 'video_upload_error') {
                setVideoPublicationStatus('failed', savedDetailId ? withBasePath('/observations/' + encodeURIComponent(savedDetailId)) : '');
              }
              sendRecordFunnelError(funnelErrorAction, {
                errorCode: message,
                userMessage,
                visitId: savedVisitId || null,
                occurrenceId: savedDetailId || null,
                partialRecordSaved: Boolean(savedDetailId),
              });
              setStatus('<div class="row"><div>' + statusHeading + '<div class="meta">' + userMessage + '</div>' + partialLink + invasiveReportingNote + '</div></div>');
            } finally {
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              setRecordSubmitting(false);
            }
          });
        }
      </script>`,
      extraStyles: `
        .record-page { margin-top: 24px; }
        .record-shell { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; max-width: 920px; margin: 0 auto; }
        .record-card { border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.92)); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 16px 36px rgba(15,23,42,.06); padding: 24px; }
        .record-sheet { position: relative; overflow: hidden; }
        .record-sheet::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 34px, rgba(14,165,233,.05) 35px, transparent 36px); pointer-events: none; }
        .record-sheet::after { content: ""; position: absolute; inset: 0 auto 0 20px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.28), rgba(239,68,68,.14)); pointer-events: none; }
        .record-sheet > * { position: relative; z-index: 1; }
        .record-card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 18px; padding-left: 16px; }
        .record-card-head h2 { margin: 10px 0 0; font-size: clamp(24px, 2.8vw, 34px); line-height: 1.26; letter-spacing: -.02em; }
        .record-session-pill { display: inline-flex; flex-direction: column; gap: 4px; padding: 12px 16px; border-radius: 18px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); min-width: 180px; }
        .record-session-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
        .record-session-pill strong { font-size: 14px; color: #0f172a; word-break: break-all; }
        .record-capture-launcher { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding-left: 16px; margin: 0 0 12px; }
        .record-capture-option { min-height: 132px; display: grid; align-content: start; gap: 8px; text-align: left; padding: 16px; border-radius: 22px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); color: #0f172a; text-decoration: none; cursor: pointer; box-shadow: 0 10px 24px rgba(15,23,42,.045); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
        .record-capture-option:hover, .record-capture-option.is-active { transform: translateY(-2px); border-color: rgba(14,165,233,.34); box-shadow: 0 16px 32px rgba(14,165,233,.1); }
        .record-capture-option.is-primary { background: linear-gradient(180deg, rgba(236,253,245,.96), rgba(240,249,255,.96)); border-color: rgba(16,185,129,.24); }
        .record-capture-photo-primary { grid-column: span 2; }
        .record-capture-icon { width: 42px; height: 42px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.05); color: #047857; }
        .record-capture-icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .record-capture-option strong { font-size: 15px; line-height: 1.25; }
        .record-capture-photo-primary strong { font-size: 19px; }
        .record-capture-option span:last-child { font-size: 12px; line-height: 1.55; color: #64748b; font-weight: 700; }
        .record-confidence-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: -2px 0 14px 16px; }
        .record-confidence-item { flex: 1 1 112px; min-height: 58px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); }
        .record-confidence-item strong { display: block; color: #0f172a; font-size: 13px; line-height: 1.35; }
        .record-confidence-item span { display: block; margin-top: 3px; color: #475569; font-size: 11px; line-height: 1.5; font-weight: 750; }
        .record-secondary-links { display: flex; flex-wrap: wrap; gap: 10px 14px; margin: 0 0 18px 16px; }
        .record-secondary-links a { color: #047857; font-size: 13px; font-weight: 900; text-decoration: none; }
        .record-secondary-links a:hover { text-decoration: underline; }
        .record-has-media .record-capture-launcher,
        .record-has-media .record-confidence-strip,
        .record-has-media .record-secondary-links { display: none; }
        .record-subject-context { margin: -2px 0 18px 16px; padding: 16px; border-radius: 20px; background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(239,246,255,.9)); border: 1px solid rgba(16,185,129,.2); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; }
        .record-subject-context strong { display: block; margin-top: 4px; color: #0f172a; font-size: 15px; line-height: 1.35; }
        .record-subject-context p { margin: 5px 0 0; color: #475569; font-size: 12px; line-height: 1.7; font-weight: 750; }
        .record-subject-context-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; max-width: 250px; }
        .record-subject-context-tags span { padding: 7px 9px; border-radius: 999px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); color: #064e3b; font-size: 11px; line-height: 1.2; font-weight: 950; white-space: nowrap; }
        .record-capture-result { margin: -2px 0 18px 16px; padding: 14px 16px; border-radius: 18px; background: rgba(236,253,245,.82); border: 1px solid rgba(16,185,129,.24); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .record-capture-result[hidden] { display: none; }
        .record-capture-result strong { display: block; margin-top: 4px; color: #0f172a; font-size: 14px; word-break: break-word; }
        .record-capture-result p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 700; }
        .record-location-nudge { margin: -2px 0 18px 16px; padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(240,253,250,.95), rgba(239,246,255,.95)); border: 1px solid rgba(14,165,233,.22); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .record-location-nudge[hidden] { display: none; }
        .record-location-nudge strong { color: #0f172a; font-size: 14px; }
        .record-location-nudge p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 700; }
        .record-location-nudge button { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 0; background: #0f766e; color: #fff; font: inherit; font-size: 12px; font-weight: 950; white-space: nowrap; }
        .record-autofill-status { margin: -6px 0 16px 16px; padding: 10px 13px; border-radius: 999px; width: fit-content; max-width: calc(100% - 16px); background: rgba(236,253,245,.9); border: 1px solid rgba(16,185,129,.24); color: #065f46; font-size: 12px; font-weight: 900; line-height: 1.5; }
        .record-autofill-status[hidden] { display: none; }
        .record-place-picker { display: grid; gap: 12px; padding: 14px; border-radius: 20px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-place-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .record-place-head strong { display: block; color: #0f172a; font-size: 15px; line-height: 1.45; }
        .record-place-head p { margin: 3px 0 0; color: #64748b; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-place-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
        .record-place-search input { min-height: 48px; padding: 0 14px; border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: #fff; font: inherit; }
        .record-place-search button { min-height: 48px; padding: 0 16px; border-radius: 16px; border: 0; background: #0f766e; color: #fff; font: inherit; font-weight: 950; cursor: pointer; }
        .record-location-results { display: grid; gap: 8px; }
        .record-location-results[hidden] { display: none; }
        .record-location-result { display: grid; gap: 3px; text-align: left; padding: 11px 12px; border-radius: 14px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #0f172a; font: inherit; cursor: pointer; }
        .record-location-result strong { font-size: 13px; line-height: 1.45; }
        .record-location-result span, .record-location-empty { color: #64748b; font-size: 12px; line-height: 1.55; font-weight: 750; }
        .record-location-map { position: relative; min-height: 240px; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg,#ecfdf5,#eff6ff); border: 1px solid rgba(15,23,42,.08); }
        .record-location-map-fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; text-align: center; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 850; }
        .record-coordinate-details { display: grid; gap: 10px; }
        .record-coordinate-details summary { min-height: 44px; display: flex; align-items: center; padding: 0 12px; border-radius: 14px; background: rgba(248,250,252,.9); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-size: 13px; font-weight: 900; cursor: pointer; }
        .record-coordinate-details .record-gps-inputs { margin-top: 10px; }
        .record-capture-dock { margin: -6px 0 18px 16px; padding: 8px; border-radius: 22px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 38px rgba(15,23,42,.08); display: grid; grid-template-columns: 1.2fr repeat(3, minmax(0, .82fr)); gap: 8px; }
        .record-dock-action { min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 7px 6px; border-radius: 17px; border: 1px solid transparent; background: rgba(248,250,252,.9); color: #0f172a; text-decoration: none; font-size: 11px; font-weight: 900; cursor: pointer; line-height: 1.2; }
        .record-dock-action:hover, .record-dock-action.is-active { border-color: rgba(14,165,233,.28); background: #f0f9ff; }
        .record-dock-primary { background: #ecfdf5; color: #065f46; }
        .record-dock-primary:hover, .record-dock-primary.is-active { background: #ecfdf5; border-color: rgba(16,185,129,.24); }
        .record-dock-icon { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.06); flex: 0 0 auto; }
        .record-dock-primary .record-dock-icon { background: rgba(16,185,129,.14); }
        .record-dock-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .record-submit-dock { display: none; }
        .record-submit-panel { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border-radius: 20px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.24); }
        .record-submit-panel[hidden] { display: none; }
        .record-submit-panel strong { display: block; margin-top: 4px; color: #0f172a; font-size: 15px; line-height: 1.35; }
        .record-submit-panel p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-submit-panel .btn { min-width: 140px; }
        .site-footer { padding-bottom: 104px; }
        .site-mobile-menu-panel { max-height: calc(100dvh - 184px); overflow-y: auto; overscroll-behavior: contain; }
        .record-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding-left: 16px; scroll-margin-top: 92px; }
        .record-form[hidden] { display: none; }
        .record-field { display: flex; flex-direction: column; gap: 8px; }
        .record-field-wide { grid-column: 1 / -1; }
        .record-label { font-weight: 800; color: #0f172a; font-size: 14px; }
        .record-help { font-size: 12px; line-height: 1.6; color: #64748b; }
        .record-later-details { padding: 0; }
        .record-later-details > summary { min-height: 52px; display: flex; align-items: center; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-weight: 900; cursor: pointer; }
        .record-later-details > summary::after { content: "+"; margin-left: auto; color: #047857; font-size: 18px; line-height: 1; }
        .record-later-details[open] > summary::after { content: "-"; }
        .record-later-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 16px; border-radius: 20px; background: rgba(248,250,252,.7); border: 1px solid rgba(15,23,42,.06); }
        .record-advanced { padding: 0; }
        .record-advanced summary { min-height: 52px; display: flex; align-items: center; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-weight: 900; cursor: pointer; }
        .record-advanced-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 16px; border-radius: 20px; background: rgba(248,250,252,.7); border: 1px solid rgba(15,23,42,.06); }
        .record-mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .record-mode-chip { display: grid; gap: 4px; text-align: left; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(15,23,42,.1); background: rgba(255,255,255,.84); color: #0f172a; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .record-mode-chip strong { font-size: 14px; }
        .record-mode-chip span { font-size: 12px; line-height: 1.6; color: #64748b; font-weight: 700; }
        .record-mode-chip.is-active { border-color: rgba(14,165,233,.36); box-shadow: 0 10px 24px rgba(14,165,233,.1); transform: translateY(-1px); }
        .record-media-role { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-video-guide { grid-column: 1 / -1; display: grid; gap: 12px; padding: 16px; border-radius: 18px; background: #f0f9ff; border: 1px solid rgba(14,165,233,.22); }
        .record-video-guide[hidden] { display: none; }
        .record-video-guide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .record-video-guide-head strong { display: block; margin-top: 4px; color: #0f172a; font-size: 16px; line-height: 1.35; }
        .record-video-guide-head p { margin: 5px 0 0; color: #475569; font-size: 13px; line-height: 1.6; font-weight: 780; }
        .record-video-guide-head > span { flex: 0 0 auto; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; background: #0369a1; color: #fff; font-size: 12px; font-weight: 950; white-space: nowrap; }
        .record-video-guide[data-state="trim"] .record-video-guide-head > span { background: #b45309; }
        .record-video-guide[data-state="ready"] .record-video-guide-head > span,
        .record-video-guide[data-state="saving"] .record-video-guide-head > span { background: #047857; }
        .record-video-guide-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .record-video-guide-steps li { min-height: 58px; display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 12px; background: rgba(255,255,255,.74); border: 1px solid rgba(15,23,42,.08); color: #475569; font-weight: 900; }
        .record-video-guide-steps b { flex: 0 0 26px; width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #e2e8f0; color: #334155; font-size: 12px; }
        .record-video-guide-steps span { font-size: 12px; line-height: 1.25; }
        .record-video-guide-steps li[data-state="done"] { background: #ecfdf5; border-color: rgba(16,185,129,.28); color: #064e3b; }
        .record-video-guide-steps li[data-state="done"] b { background: #059669; color: #fff; }
        .record-video-guide-steps li[data-state="current"] { background: #fffbeb; border-color: rgba(245,158,11,.34); color: #78350f; }
        .record-video-guide-steps li[data-state="current"] b { background: #f59e0b; color: #fff; }
        .record-video-primary-photo { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: linear-gradient(135deg, rgba(236,253,245,.95), rgba(239,246,255,.95)); border: 1px solid rgba(16,185,129,.22); }
        .record-video-primary-photo[hidden] { display: none; }
        .record-video-primary-photo strong { display: block; margin-top: 4px; color: #0f172a; font-size: 14px; line-height: 1.4; word-break: break-word; }
        .record-video-primary-photo p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-video-primary-photo-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .record-media-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .record-media-role-chip { position: relative; display: grid; gap: 4px; min-height: 76px; padding: 12px; border-radius: 16px; border: 1px solid rgba(15,23,42,.1); background: rgba(248,250,252,.92); cursor: pointer; }
        .record-media-role-chip input { position: absolute; opacity: 0; pointer-events: none; }
        .record-media-role-chip strong { color: #0f172a; font-size: 13px; line-height: 1.3; }
        .record-media-role-chip span { color: #64748b; font-size: 11px; line-height: 1.45; font-weight: 750; }
        .record-media-role-chip:has(input:checked) { border-color: rgba(16,185,129,.34); background: #ecfdf5; box-shadow: 0 8px 18px rgba(16,185,129,.1); }
        .record-media-role-chip:has(input:focus-visible) { outline: 3px solid #0284c7; outline-offset: 2px; }
        .record-survey-box { display: grid; gap: 14px; padding: 18px; border-radius: 20px; background: linear-gradient(135deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.18); }
        .record-survey-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .record-survey-pill { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.08); color: #0f172a; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .record-survey-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .record-survey-caution { display: grid; gap: 4px; padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-survey-caution strong { color: #0f172a; font-size: 13px; }
        .record-survey-caution span { color: #475569; font-size: 12px; line-height: 1.7; font-weight: 700; }
        .record-video-trim { grid-column: 1 / -1; display: grid; gap: 12px; padding: 14px; border-radius: 18px; background: linear-gradient(180deg, rgba(236,253,245,.92), rgba(239,246,255,.92)); border: 1px solid rgba(14,165,233,.2); }
        .record-video-trim[hidden] { display: none; }
        .record-video-trim-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .record-video-trim-head strong { display: block; color: #0f172a; font-size: 16px; }
        .record-video-trim-head p { margin: 4px 0 0; color: #475569; font-size: 13px; line-height: 1.55; font-weight: 780; }
        .record-video-trim-head span { flex: 0 0 auto; min-width: 96px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; padding: 7px 12px; border-radius: 999px; background: #064e3b; color: #fff; font-size: 13px; font-weight: 950; border: 1px solid rgba(16,185,129,.2); }
        .record-video-length-meter { display: grid; gap: 7px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); }
        .record-video-length-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; color: #0f172a; font-size: 13px; font-weight: 950; }
        .record-video-length-row strong { color: #047857; font-size: 12px; white-space: nowrap; }
        .record-video-length-meter[data-video-length-state="warn"] .record-video-length-row strong { color: #b45309; }
        .record-video-length-track { height: 12px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
        .record-video-length-track span { display: block; width: 0; height: 100%; border-radius: inherit; background: #059669; transition: width .18s ease, background .18s ease; }
        .record-video-length-meter[data-video-length-state="warn"] .record-video-length-track span { background: #f59e0b; }
        .record-video-trim-preview { aspect-ratio: 16 / 9; min-height: 160px; border-radius: 16px; overflow: hidden; background: #020617; }
        .record-video-trim-preview video { width: 100%; height: 100%; display: block; object-fit: contain; background: #020617; }
        .record-video-trim-shortcuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .record-video-trim-shortcuts button { min-height: 48px; border: 1px solid rgba(14,165,233,.24); border-radius: 14px; background: #fff; color: #075985; font: inherit; font-size: 13px; font-weight: 950; cursor: pointer; }
        .record-video-trim-shortcuts button[hidden] { display: none; }
        .record-video-trim-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .record-video-trim-controls[hidden] { display: none; }
        .record-video-trim-controls label { display: grid; gap: 7px; padding: 10px; border-radius: 14px; background: rgba(255,255,255,.76); color: #0f172a; font-size: 12px; font-weight: 900; }
        .record-video-trim-controls label span { display: flex; justify-content: space-between; gap: 8px; }
        .record-video-trim-controls input { width: 100%; accent-color: #047857; }
        .record-video-trim-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .record-video-trim-actions span { flex: 1 1 240px; color: #0f766e; font-size: 13px; line-height: 1.55; font-weight: 850; }
        .record-video-progress { grid-column: 1 / -1; padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.2); display: grid; gap: 8px; }
        .record-video-progress[hidden] { display: none; }
        .record-video-progress-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .record-video-progress strong { font-size: 13px; color: #0f172a; }
        .record-video-progress progress { width: 100%; height: 13px; }
        .record-video-progress-meta { display: flex; justify-content: space-between; gap: 12px; color: #334155; font-size: 12px; font-weight: 700; }
        .record-video-live { font-size: 12px; color: #0f766e; line-height: 1.5; }
        .record-video-publication-status { display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(14,165,233,.18); }
        .record-video-publication-status[hidden] { display: none; }
        .record-video-publication-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .record-video-publication-title strong { font-size: 13px; }
        .record-video-publication-title span { flex: 0 0 auto; min-height: 28px; display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; background: #0f766e; color: #fff; font-size: 12px; font-weight: 950; }
        .record-video-publication-status[data-stage="failed"] .record-video-publication-title span { background: #b91c1c; }
        .record-video-publication-status[data-stage="public"] .record-video-publication-title span { background: #047857; }
        .record-video-publication-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .record-video-publication-steps li { min-height: 82px; display: grid; gap: 4px; align-content: start; padding: 10px 8px; border-radius: 10px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #475569; }
        .record-video-publication-steps b { width: 28px; height: 28px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; background: #e2e8f0; color: #334155; font-size: 13px; font-weight: 950; }
        .record-video-publication-steps span { color: #0f172a; font-size: 12px; font-weight: 950; line-height: 1.25; }
        .record-video-publication-steps small { color: #64748b; font-size: 11px; line-height: 1.35; font-weight: 800; }
        .record-video-publication-steps li[data-state="current"] { background: #ecfeff; border-color: rgba(14,165,233,.34); }
        .record-video-publication-steps li[data-state="current"] b { background: #0ea5e9; color: #fff; }
        .record-video-publication-steps li[data-state="done"] { background: #ecfdf5; border-color: rgba(16,185,129,.32); }
        .record-video-publication-steps li[data-state="done"] b { background: #059669; color: #fff; }
        .record-video-publication-steps li[data-state="failed"] { background: #fef2f2; border-color: rgba(185,28,28,.28); }
        .record-video-publication-steps li[data-state="failed"] b { background: #b91c1c; color: #fff; }
        .record-video-publication-help { color: #0f766e; font-size: 12px; line-height: 1.55; font-weight: 850; }
        .record-video-publication-help a { color: #0369a1; text-decoration: underline; text-underline-offset: 3px; font-weight: 950; }
        .record-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
        .record-status-inline { grid-column: 1 / -1; margin: 14px 0 0 16px; }
        .record-sidebar { display: grid; gap: 18px; }
        .record-preview-card h2, .record-guide-card h2 { margin: 10px 0 0; font-size: 22px; line-height: 1.3; }
        .record-preview {
          margin-top: 16px;
          padding: 20px 20px 18px 24px;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border: 1px solid rgba(15,23,42,.06);
          position: relative;
          overflow: hidden;
        }
        .record-preview::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 30px, rgba(14,165,233,.06) 31px, transparent 32px); pointer-events: none; }
        .record-preview::after { content: ""; position: absolute; inset: 0 auto 0 16px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.12)); pointer-events: none; }
        .record-preview > * { position: relative; z-index: 1; }
        .record-preview-topline { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; font-weight: 800; }
        .record-preview-kicker { color: #059669; }
        .record-preview h3 { margin: 14px 0 10px; font-size: 24px; line-height: 1.3; letter-spacing: -.02em; }
        .record-preview p { margin: 0; color: #475569; line-height: 1.8; }
        .record-preview-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 14px; color: #334155; font-size: 13px; font-weight: 700; }
        .record-preview-photo { position: relative; margin-top: 16px; min-height: 160px; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)); border: 1px solid rgba(14,165,233,.12); display: grid; place-items: center; color: #0f172a; font-weight: 800; }
        .record-preview-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .record-preview-photo video { width: 100%; height: 100%; display: block; object-fit: cover; background: #020617; }
        .record-preview-photo.is-empty { color: #475569; font-size: 13px; }
        .record-preview-count { position: absolute; right: 10px; bottom: 10px; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; font-weight: 950; }
        @media (max-width: 720px) {
          .record-page { padding-bottom: 104px; }
          .record-has-media .record-page { padding-bottom: 118px; }
          .record-has-media .hero-panel { display: none; }
          .record-card { padding: 20px; border-radius: 24px; }
          .record-capture-launcher { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-left: 0; }
          .record-capture-photo-primary { grid-column: 1 / -1; }
          .record-confidence-strip { margin-left: 0; }
          .record-secondary-links { margin-left: 0; }
          .record-has-media .record-card-head { display: none; }
          .record-capture-option { min-height: 124px; padding: 14px; border-radius: 18px; }
          .record-subject-context { margin-left: 0; grid-template-columns: 1fr; align-items: start; }
          .record-subject-context-tags { justify-content: flex-start; max-width: none; }
          .record-has-media .record-subject-context { display: none; }
          .record-capture-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 40; margin: 0; grid-template-columns: 1.2fr repeat(3, minmax(0, .82fr)); border-radius: 24px; padding: 8px; box-shadow: 0 20px 44px rgba(15,23,42,.2); }
          .has-global-record-launcher .record-capture-dock { display: none; }
          .record-has-media .record-capture-dock { display: none; }
          .record-dock-action { min-height: 58px; }
          .record-dock-icon { width: 28px; height: 28px; }
          .record-location-nudge { margin-left: 0; align-items: flex-start; flex-direction: column; }
          .record-location-nudge button { width: 100%; }
          .record-autofill-status { margin-left: 0; max-width: 100%; border-radius: 16px; }
          .record-place-head { flex-direction: column; }
          .record-place-head .record-gps-btn { width: 100%; }
          .record-place-search { grid-template-columns: 1fr; }
          .record-location-map { min-height: 220px; }
          .record-submit-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 42; display: grid; grid-template-columns: minmax(0, .65fr) minmax(0, .95fr) minmax(0, 1.1fr); gap: 8px; padding: 8px; border-radius: 24px; background: rgba(255,255,255,.96); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 20px 44px rgba(15,23,42,.2); }
          .record-submit-location, .record-submit-primary { min-height: 58px; border-radius: 17px; border: 0; font: inherit; font-weight: 950; cursor: pointer; }
          .record-submit-location { background: #f1f5f9; color: #0f172a; }
          .record-submit-primary { background: #064e3b; color: #fff; box-shadow: 0 10px 24px rgba(6,78,59,.22); }
          .record-submit-location:disabled, .record-submit-primary:disabled { opacity: .55; cursor: wait; }
          .record-submit-dock-meta { min-height: 58px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px 8px; border-radius: 17px; background: #ecfdf5; color: #064e3b; font-size: 11px; line-height: 1.25; font-weight: 950; }
          .record-submit-panel { align-items: flex-start; flex-direction: column; }
          .record-submit-panel .btn { width: 100%; }
          .record-capture-result { margin-left: 0; align-items: flex-start; flex-direction: column; }
          .record-form { grid-template-columns: 1fr; padding-left: 0; }
          .record-video-guide-head { flex-direction: column; }
          .record-video-guide-head > span { width: 100%; }
          .record-video-guide-steps { grid-template-columns: 1fr; }
          .record-video-guide-steps li { min-height: 48px; }
          .record-video-primary-photo { align-items: flex-start; flex-direction: column; }
          .record-video-primary-photo-actions, .record-video-primary-photo-actions .btn { width: 100%; }
          .record-video-trim-head { flex-direction: column; }
          .record-video-trim-head span { width: 100%; }
          .record-video-trim-shortcuts { grid-template-columns: 1fr; }
          .record-video-trim-controls { grid-template-columns: 1fr; }
          .record-video-trim-actions .btn { width: 100%; }
          .record-video-publication-steps { grid-template-columns: 1fr; }
          .record-video-publication-steps li { min-height: auto; grid-template-columns: auto 1fr; align-items: center; }
          .record-video-publication-steps small { grid-column: 2; }
          .record-mode-grid, .record-survey-grid, .record-advanced-grid, .record-later-grid, .record-media-role-grid { grid-template-columns: 1fr; }
          .record-card-head { padding-left: 0; }
          .record-sheet::after, .record-preview::after { display: none; }
        }
      `,
    });
  });

  app.get("/explore", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const url = new URL(String((request as unknown as { url?: string }).url ?? "/explore"), "https://ikimon.local");
    const lang = detectLangFromUrl(url.pathname + url.search);
    url.searchParams.delete("lang");
    const query = url.searchParams.toString();
    return reply.redirect(appendLangToHref(withBasePath(basePath, `/records?view=public${query ? `&${query}` : ""}`), lang), 308);
  });

  app.get<{ Querystring: { view?: string; filter?: string } }>("/records", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const view = normalizeRecordsView(request.query.view, Boolean(viewerUserId));
    const [snapshot, observationSnapshot] = await Promise.all([
      getLandingSnapshot(viewerUserId),
      getObservationListSnapshot(96).catch(() => ({
        observations: [],
        summary: {
          shownCount: 0,
          awaitingIdCount: 0,
          identifiedCount: 0,
          multiSubjectCount: 0,
        },
      } satisfies ObservationListSnapshot)),
    ]);
    const publicEntries = observationSnapshot.observations.map(publicObservationToLandingObservation);
    const activeEntries = recordWorkbenchEntriesForView(view, snapshot.viewerUserId ? snapshot.myFeed : [], publicEntries);
    const civicContexts = await listCivicObservationContexts(activeEntries.map((obs) => obs.visitId));
    const copy = recordsWorkbenchCopy(lang);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: copy.title,
      activeNav: copy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, `/records?view=${view}`), lang),
      shellClassName: "shell-bleed shell-records-workbench",
      extraStyles: `${NOTES_LIBRARY_STYLES}\n${RECORDS_WORKBENCH_STYLES}`,
      hideFooter: true,
      body: renderRecordsWorkbench(basePath, lang, view, snapshot, publicEntries, civicContexts),
      footerNote: notesLibraryCopy(lang).footerNote,
    });
  });

  app.get<{ Querystring: { filter?: string } }>("/observations", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = String((request as unknown as { url?: string }).url ?? "");
    const lang = detectLangFromUrl(rawUrl);
    const url = new URL(rawUrl, "https://ikimon.local");
    const targetView = request.query.filter === "needs_id" || request.query.filter === "ai" || request.query.filter === "no_id"
      ? "needs_id"
      : request.query.filter === "photo" || request.query.filter === "video"
        ? "media"
        : "public";
    url.searchParams.delete("lang");
    url.searchParams.delete("filter");
    const query = url.searchParams.toString();
    return reply.redirect(appendLangToHref(withBasePath(basePath, `/records?view=${targetView}${query ? `&${query}` : ""}`), lang), 308);
    /*
    Legacy observations index renderer: canonical surface moved to /records.
    const observationCopy = observationIndexCopy(lang);
    const session = await getSessionFromCookie(request.headers.cookie);
    const activeFilter = request.query.filter === "needs_id"
      || request.query.filter === "ai"
      || request.query.filter === "no_id"
      || request.query.filter === "photo"
      || request.query.filter === "video"
      || request.query.filter === "identified"
      || request.query.filter === "multi"
      ? request.query.filter
      : "all";
    const showSpecialistCta = canUseSpecialistWorkbench(session);
    let canCacheHtml = !showSpecialistCta;
    const cacheKey = `${basePath}|${lang}|${activeFilter}`;
    const now = Date.now();
    if (canCacheHtml) {
      const cached = observationsHtmlCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        reply.header("x-ikimon-observations-html-cache", "hit");
        reply.type("text/html; charset=utf-8");
        return cached.html;
      }
    }
    let snapshot;
    try {
      snapshot = await getObservationListSnapshot(48);
    } catch {
      canCacheHtml = false;
      snapshot = {
        observations: [],
        summary: {
          shownCount: 0,
          awaitingIdCount: 0,
          identifiedCount: 0,
          multiSubjectCount: 0,
        },
      };
    }
    const visibleObservations = snapshot.observations.filter((item) => {
      if (activeFilter === "needs_id") return item.displayName === "同定待ち" || item.isAiCandidate;
      if (activeFilter === "ai") return Boolean(item.isAiCandidate);
      if (activeFilter === "no_id") return item.identificationCount === 0;
      if (activeFilter === "photo") return Boolean(item.hasPhoto ?? item.photoUrl);
      if (activeFilter === "video") return Boolean(item.hasVideo);
      if (activeFilter === "identified") return item.displayName !== "同定待ち" && !item.isAiCandidate;
      if (activeFilter === "multi") return Boolean(item.isMultiSubject);
      return true;
    });
    const pageTitle = activeFilter === "needs_id" ? observationCopy.identifyTitle : observationCopy.title;
    const pageCountLabel = formatObservationIndexCount(visibleObservations.length, observationCopy);
    const fieldOptions = new Map<string, { name: string; count: number }>();
    for (const item of snapshot.observations) {
      for (const field of item.fieldRefs ?? []) {
        const current = fieldOptions.get(field.fieldId);
        fieldOptions.set(field.fieldId, {
          name: field.name,
          count: (current?.count ?? 0) + 1,
        });
      }
    }
    const fieldSelectOptions = Array.from(fieldOptions.entries())
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, "ja"))
      .map(([fieldId, field]) => `<button type="button" class="observations-spot-chip" data-observations-field-chip="${escapeHtml(fieldId)}" data-field-name="${escapeHtml(field.name.toLowerCase())}">${escapeHtml(field.name)}<b>${escapeHtml(String(field.count))}</b></button>`)
      .join("");
    const cards = visibleObservations.map((item) => {
      const detailHref = appendLangToHref(
        withBasePath(
          basePath,
          buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId),
        ),
        lang,
      );
      const identifyHref = `${detailHref}#identify`;
      const statusLabel = item.isAiCandidate
        ? observationCopy.status.ai
        : item.displayName === "同定待ち" || item.identificationCount === 0
          ? observationCopy.status.awaiting
          : observationCopy.status.identified;
      const statusKeys = [
        item.displayName === "同定待ち" || item.isAiCandidate ? "needs-id" : "",
        item.isAiCandidate ? "ai" : "",
        item.identificationCount === 0 ? "no-id" : "",
        item.displayName !== "同定待ち" && !item.isAiCandidate ? "identified" : "",
        item.isMultiSubject ? "multi" : "",
      ].filter(Boolean).join(" ");
      const mediaKeys = [
        (item.hasPhoto ?? item.photoUrl) ? "photo" : "",
        item.hasVideo ? "video" : "",
      ].filter(Boolean);
      const mediaKey = mediaKeys.length > 0 ? mediaKeys.join(" ") : "no-photo";
      const idBucket = item.identificationCount <= 0 ? "zero" : item.identificationCount === 1 ? "one" : "two-plus";
      const observedMs = Date.parse(item.observedAt);
      const fieldIds = (item.fieldRefs ?? []).map((field) => field.fieldId).join(" ");
      const fieldNames = (item.fieldRefs ?? []).map((field) => field.name).join(" ");
      const taxonText = [
        item.displayName,
        item.featuredSubjectName,
        item.vernacularName,
        item.scientificName,
        item.aiCandidateName,
      ].filter(Boolean).join(" ").toLowerCase();
      const rankKey = String(item.featuredTaxonRank ?? item.aiCandidateRank ?? "").trim().toLowerCase();
      const searchText = [
        item.displayName,
        item.featuredSubjectName,
        item.vernacularName,
        item.scientificName,
        item.aiCandidateName,
        item.observerName,
        item.placeName,
        item.municipality,
        formatPlaceDisplay({
          placeName: item.placeName,
          municipality: item.municipality,
          publicLocation: item.publicLocation,
        }, lang, "public"),
        fieldNames,
        statusLabel,
      ].filter(Boolean).join(" ").toLowerCase();
      return `<div class="observations-grid-item"
        data-observation-tile
        data-search="${escapeHtml(searchText)}"
        data-status="${escapeHtml(statusKeys)}"
        data-media="${escapeHtml(mediaKey)}"
        data-fields="${escapeHtml(fieldIds)}"
        data-taxon="${escapeHtml(taxonText)}"
        data-rank="${escapeHtml(rankKey)}"
        data-id-bucket="${escapeHtml(idBucket)}"
        data-id-count="${escapeHtml(String(item.identificationCount))}"
        data-observed-ms="${escapeHtml(String(Number.isFinite(observedMs) ? observedMs : 0))}">
        ${renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        detailId: item.detailId,
        featuredOccurrenceId: item.featuredOccurrenceId,
        featuredSubjectName: item.featuredSubjectName,
        subjectCount: item.subjectCount,
        isMultiSubject: item.isMultiSubject,
        featuredConfidenceBand: item.featuredConfidenceBand,
        displayStability: item.displayStability,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        publicLocation: item.publicLocation,
        photoUrl: item.photoUrl,
        mediaUrl: item.mediaUrl,
        hasPhoto: item.hasPhoto,
        hasVideo: item.hasVideo,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
        }, { compact: true, locationMode: "public", showSpecialistCta })}
        <a class="observations-id-shortcut" href="${escapeHtml(identifyHref)}" aria-label="${escapeHtml(observationCopy.identifyAriaTemplate.replace("{name}", item.displayName))}">${escapeHtml(statusLabel === observationCopy.status.identified ? observationCopy.shortcutConfirm : observationCopy.shortcutIdentify)}</a>
      </div>`;
    }).join("");
    const aiCandidateCount = snapshot.observations.filter((item) => item.isAiCandidate).length;
    const noIdCount = snapshot.observations.filter((item) => item.identificationCount === 0).length;
    const photoCount = snapshot.observations.filter((item) => Boolean(item.hasPhoto ?? item.photoUrl)).length;
    const videoCount = snapshot.observations.filter((item) => Boolean(item.hasVideo)).length;
    const filters = [
      { href: "/observations", label: observationCopy.filters.all, key: "all", count: snapshot.summary.shownCount },
      { href: "/observations?filter=needs_id", label: observationCopy.filters.needs_id, key: "needs_id", count: snapshot.summary.awaitingIdCount },
      { href: "/observations?filter=ai", label: observationCopy.filters.ai, key: "ai", count: aiCandidateCount },
      { href: "/observations?filter=no_id", label: observationCopy.filters.no_id, key: "no_id", count: noIdCount },
      { href: "/observations?filter=photo", label: observationCopy.filters.photo, key: "photo", count: photoCount },
      { href: "/observations?filter=video", label: observationCopy.filters.video, key: "video", count: videoCount },
      { href: "/observations?filter=multi", label: observationCopy.filters.multi, key: "multi", count: snapshot.summary.multiSubjectCount },
      { href: "/observations?filter=identified", label: observationCopy.filters.identified, key: "identified", count: snapshot.summary.identifiedCount },
    ].map((item) => `
      <a class="observations-chip${item.key === activeFilter ? " is-active" : ""}" href="${escapeHtml(appendLangToHref(withBasePath(basePath, item.href), lang))}">
        <span>${escapeHtml(item.label)}</span><b>${escapeHtml(String(item.count))}</b>
      </a>`).join("");
    const observationsCurrentPath = activeFilter === "all" ? "/observations" : `/observations?filter=${activeFilter}`;

    const html = layout(
      basePath,
      `${pageTitle} | ikimon`,
      `<section class="observations-page${activeFilter === "needs_id" ? " is-identify" : ""}" data-testid="observations-index" data-observations-page>
        <header class="observations-titlebar">
          <div>
            <h1>${escapeHtml(pageTitle)}</h1>
            <p class="observations-title-lead">${escapeHtml(lang === "ja" ? "観察レコードは、研究や公開データで扱う生きもの単位の記録です。1件の記録から切り出した対象ごとの記録を、同定状態と証拠メディアで確認できます。" : "Observation records are subject-level records used for public and research data.")}</p>
            <span data-observations-count>${escapeHtml(pageCountLabel)}</span>
          </div>
        <nav class="observations-actions" aria-label="${escapeHtml(observationCopy.relatedActionsAria)}">
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/map"), lang))}" aria-label="${escapeHtml(observationCopy.mapAction)}">${escapeHtml(observationCopy.mapAction)}</a>
            <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}" aria-label="${escapeHtml(observationCopy.recordActionAria)}">${escapeHtml(observationCopy.recordAction)}</a>
          </nav>
        </header>
        <div class="observations-workbench">
          <aside class="observations-control-panel" aria-label="${escapeHtml(observationCopy.controlPanelAria)}">
            <div class="observations-search" role="search">
              <span aria-hidden="true">⌕</span>
              <input type="search" placeholder="${escapeHtml(observationCopy.searchPlaceholder)}" aria-label="${escapeHtml(observationCopy.searchLabel)}" data-observations-search />
            </div>
            <nav class="observations-toolbar" aria-label="${escapeHtml(observationCopy.toolbarAria)}">
              ${filters}
            </nav>
            <details class="observations-advanced">
              <summary>${escapeHtml(observationCopy.detailsSummary)}</summary>
              <div class="observations-advanced-grid">
                <label>${escapeHtml(observationCopy.advanced.status)}
                  <select data-observations-filter="status">
                    <option value="all">${escapeHtml(observationCopy.options.all)}</option>
                    <option value="needs-id">${escapeHtml(observationCopy.filters.needs_id)}</option>
                    <option value="ai">${escapeHtml(observationCopy.filters.ai)}</option>
                    <option value="no-id">${escapeHtml(observationCopy.filters.no_id)}</option>
                    <option value="identified">${escapeHtml(observationCopy.filters.identified)}</option>
                    <option value="multi">${escapeHtml(observationCopy.filters.multi)}</option>
                  </select>
                </label>
                <label>${escapeHtml(observationCopy.advanced.evidence)}
                  <select data-observations-filter="media">
                    <option value="all">${escapeHtml(observationCopy.options.all)}</option>
                    <option value="photo">${escapeHtml(observationCopy.filters.photo)}</option>
                    <option value="video">${escapeHtml(observationCopy.filters.video)}</option>
                    <option value="no-photo">${escapeHtml(observationCopy.options.noPhoto)}</option>
                  </select>
                </label>
                <label>${escapeHtml(observationCopy.advanced.taxon)}
                  <input type="search" placeholder="${escapeHtml(`${observationCopy.options.family} / ${observationCopy.options.genus} / ${observationCopy.options.species}`)}" data-observations-taxon />
                </label>
                <label>${escapeHtml(observationCopy.advanced.rank)}
                  <select data-observations-filter="rank">
                    <option value="all">${escapeHtml(observationCopy.options.all)}</option>
                    <option value="species">${escapeHtml(observationCopy.options.species)}</option>
                    <option value="genus">${escapeHtml(observationCopy.options.genus)}</option>
                    <option value="family">${escapeHtml(observationCopy.options.family)}</option>
                    <option value="order">${escapeHtml(observationCopy.options.order)}</option>
                    <option value="class">${escapeHtml(observationCopy.options.class)}</option>
                    <option value="phylum">${escapeHtml(observationCopy.options.phylum)}</option>
                  </select>
                </label>
                <label>${escapeHtml(observationCopy.advanced.date)}
                  <select data-observations-filter="date">
                    <option value="all">${escapeHtml(observationCopy.options.all)}</option>
                    <option value="7d">${escapeHtml(observationCopy.options.sevenDays)}</option>
                    <option value="30d">${escapeHtml(observationCopy.options.thirtyDays)}</option>
                    <option value="90d">${escapeHtml(observationCopy.options.ninetyDays)}</option>
                  </select>
                </label>
                <label>${escapeHtml(observationCopy.advanced.ids)}
                  <select data-observations-filter="ids">
                    <option value="all">${escapeHtml(observationCopy.options.all)}</option>
                    <option value="zero">${escapeHtml(observationCopy.options.zeroIds)}</option>
                    <option value="one">${escapeHtml(observationCopy.options.oneId)}</option>
                    <option value="two-plus">${escapeHtml(observationCopy.options.twoPlusIds)}</option>
                  </select>
                </label>
                <label>${escapeHtml(observationCopy.advanced.sort)}
                  <select data-observations-sort>
                    <option value="newest">${escapeHtml(observationCopy.options.newest)}</option>
                    <option value="oldest">${escapeHtml(observationCopy.options.oldest)}</option>
                    <option value="least-id">${escapeHtml(observationCopy.options.leastId)}</option>
                    <option value="most-id">${escapeHtml(observationCopy.options.mostId)}</option>
                  </select>
                </label>
              </div>
            </details>
            <section class="observations-spot-filter" aria-label="${escapeHtml(observationCopy.field.aria)}">
              <div class="observations-spot-search">
                <span>${escapeHtml(observationCopy.field.label)}</span>
                <input type="search" placeholder="${escapeHtml(observationCopy.field.placeholder)}" data-observations-spot-search />
                <button type="button" data-observations-field-clear hidden>${escapeHtml(observationCopy.field.clear)}</button>
              </div>
              <div class="observations-spot-chips" data-observations-field-list>
                <button type="button" class="observations-spot-chip is-active" data-observations-field-chip="all">${escapeHtml(observationCopy.options.all)}</button>
                ${fieldSelectOptions || `<span class="observations-spot-empty">${escapeHtml(observationCopy.field.empty)}</span>`}
              </div>
            </section>
            <section class="observations-presets" aria-label="${escapeHtml(observationCopy.presets.aria)}">
              <div class="observations-preset-save">
                <input type="text" placeholder="${escapeHtml(observationCopy.presets.placeholder)}" aria-label="${escapeHtml(observationCopy.presets.placeholder)}" data-observations-preset-name />
                <button type="button" data-observations-preset-save>${escapeHtml(observationCopy.presets.save)}</button>
              </div>
              <div class="observations-preset-list" data-observations-presets></div>
            </section>
          </aside>
          <section class="observations-results-panel" aria-label="${escapeHtml(observationCopy.resultPanelAria)}">
            <div class="observations-video-grid" data-observations-grid>
              ${cards || `<div class="observations-empty">${escapeHtml(observationCopy.emptyInitial)}</div>`}
            </div>
            <div class="observations-empty" data-observations-empty hidden>${escapeHtml(observationCopy.emptyFiltered)}</div>
          </section>
        </div>
        <script>
(function () {
  const observationsCopy = ${JSON.stringify({
    countSuffix: observationCopy.countSuffix,
    presetFallback: observationCopy.presets.fallback,
    spotFallback: observationCopy.presets.spotFallback,
    deleteSuffix: observationCopy.presets.deleteSuffix,
  })};
  const root = document.querySelector('[data-observations-page]');
  if (!root) return;
  const search = root.querySelector('[data-observations-search]');
  const initialQuery = new URLSearchParams(window.location.search || '').get('q') || '';
  const count = root.querySelector('[data-observations-count]');
  const empty = root.querySelector('[data-observations-empty]');
  const grid = root.querySelector('[data-observations-grid]');
  const controls = Array.from(root.querySelectorAll('[data-observations-filter]'));
  const sort = root.querySelector('[data-observations-sort]');
  const taxon = root.querySelector('[data-observations-taxon]');
  const spotSearch = root.querySelector('[data-observations-spot-search]');
  const fieldClear = root.querySelector('[data-observations-field-clear]');
  const fieldChips = Array.from(root.querySelectorAll('[data-observations-field-chip]'));
  const presetName = root.querySelector('[data-observations-preset-name]');
  const presetSave = root.querySelector('[data-observations-preset-save]');
  const presetList = root.querySelector('[data-observations-presets]');
  const tiles = Array.from(root.querySelectorAll('[data-observation-tile]'));
  const storageKey = 'ikimon.identify.filterPresets.v1';
  let activeField = 'all';
  function readPresets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter(function (item) { return item && typeof item === 'object'; }).slice(0, 24) : [];
    } catch (_) {
      return [];
    }
  }
  function writePresets(presets) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(presets.slice(0, 24)));
    } catch (_) {}
  }
  function readState() {
    const active = {};
    controls.forEach(function (control) {
      active[control.getAttribute('data-observations-filter') || ''] = String(control.value || 'all');
    });
    return {
      query: search ? String(search.value || '') : '',
      taxon: taxon ? String(taxon.value || '') : '',
      field: activeField,
      filters: active,
      sort: sort ? String(sort.value || 'newest') : 'newest'
    };
  }
  function setField(value) {
    activeField = value || 'all';
    fieldChips.forEach(function (chip) {
      chip.classList.toggle('is-active', String(chip.getAttribute('data-observations-field-chip') || 'all') === activeField);
    });
    if (fieldClear) fieldClear.hidden = activeField === 'all';
  }
  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    if (search) search.value = String(state.query || '');
    if (taxon) taxon.value = String(state.taxon || '');
    if (sort && state.sort) sort.value = String(state.sort || 'newest');
    const filters = state.filters && typeof state.filters === 'object' ? state.filters : {};
    controls.forEach(function (control) {
      const key = control.getAttribute('data-observations-filter') || '';
      if (Object.prototype.hasOwnProperty.call(filters, key)) control.value = String(filters[key] || 'all');
    });
    setField(String(state.field || 'all'));
    applySearch();
  }
  function renderPresets() {
    if (!presetList) return;
    const presets = readPresets();
    presetList.innerHTML = '';
    presets.forEach(function (preset, index) {
      const wrap = document.createElement('span');
      wrap.className = 'observations-preset-chip';
      const load = document.createElement('button');
      load.type = 'button';
      load.textContent = String(preset.name || observationsCopy.presetFallback);
      load.addEventListener('click', function () { applyState(preset.state); });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', String(preset.name || observationsCopy.presetFallback) + observationsCopy.deleteSuffix);
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        const next = readPresets();
        next.splice(index, 1);
        writePresets(next);
        renderPresets();
      });
      wrap.appendChild(load);
      wrap.appendChild(remove);
      presetList.appendChild(wrap);
    });
  }
  function savePreset() {
    const name = presetName ? String(presetName.value || '').trim() : '';
    const state = readState();
    const fallback = [state.filters.status, state.taxon, state.field === 'all' ? '' : observationsCopy.spotFallback].filter(Boolean).join(' · ') || observationsCopy.presetFallback;
    const presets = readPresets().filter(function (item) { return String(item.name || '') !== (name || fallback); });
    presets.unshift({ name: name || fallback, state: state, savedAt: Date.now() });
    writePresets(presets);
    if (presetName) presetName.value = '';
    renderPresets();
  }
  function filterSpotChips() {
    const query = spotSearch ? String(spotSearch.value || '').trim().toLowerCase() : '';
    fieldChips.forEach(function (chip) {
      if (String(chip.getAttribute('data-observations-field-chip') || 'all') === 'all') {
        chip.hidden = false;
        return;
      }
      const name = String(chip.getAttribute('data-field-name') || '').toLowerCase();
      chip.hidden = Boolean(query) && name.indexOf(query) < 0;
    });
  }
  function applySearch() {
    const query = search ? String(search.value || '').trim().toLowerCase() : '';
    const taxonQuery = taxon ? String(taxon.value || '').trim().toLowerCase() : '';
    const now = Date.now();
    const active = {};
    controls.forEach(function (control) {
      active[control.getAttribute('data-observations-filter') || ''] = String(control.value || 'all');
    });
    let visible = 0;
    tiles.forEach(function (tile) {
      const haystack = String(tile.getAttribute('data-search') || '');
      const status = String(tile.getAttribute('data-status') || '');
      const media = String(tile.getAttribute('data-media') || '');
      const fields = String(tile.getAttribute('data-fields') || '');
      const taxonText = String(tile.getAttribute('data-taxon') || '');
      const rank = String(tile.getAttribute('data-rank') || '');
      const idBucket = String(tile.getAttribute('data-id-bucket') || '');
      const observedMs = Number(tile.getAttribute('data-observed-ms') || 0);
      const ageDays = observedMs > 0 ? (now - observedMs) / 86400000 : Infinity;
      const okQuery = !query || haystack.indexOf(query) >= 0;
      const okTaxon = !taxonQuery || taxonText.indexOf(taxonQuery) >= 0;
      const okStatus = !active.status || active.status === 'all' || status.split(/\\s+/).indexOf(active.status) >= 0;
      const okMedia = !active.media || active.media === 'all' || media.split(/\\s+/).indexOf(active.media) >= 0;
      const okField = activeField === 'all' || fields.split(/\\s+/).indexOf(activeField) >= 0;
      const okRank = !active.rank || active.rank === 'all' || rank === active.rank;
      const okIds = !active.ids || active.ids === 'all' || idBucket === active.ids;
      const okDate = !active.date || active.date === 'all'
        || (active.date === '7d' && ageDays <= 7)
        || (active.date === '30d' && ageDays <= 30)
        || (active.date === '90d' && ageDays <= 90);
      const show = okQuery && okTaxon && okStatus && okMedia && okField && okRank && okIds && okDate;
      tile.hidden = !show;
      if (show) visible += 1;
    });
    if (grid && sort) {
      const sorted = tiles.slice().sort(function (a, b) {
        const av = Number(a.getAttribute('data-observed-ms') || 0);
        const bv = Number(b.getAttribute('data-observed-ms') || 0);
        const ai = Number(a.getAttribute('data-id-count') || 0);
        const bi = Number(b.getAttribute('data-id-count') || 0);
        if (sort.value === 'oldest') return av - bv;
        if (sort.value === 'least-id') return ai - bi || bv - av;
        if (sort.value === 'most-id') return bi - ai || bv - av;
        return bv - av;
      });
      sorted.forEach(function (tile) { grid.appendChild(tile); });
    }
    if (count) count.textContent = String(visible) + observationsCopy.countSuffix;
    if (empty) empty.hidden = visible !== 0 || tiles.length === 0;
  }
  if (search) search.addEventListener('input', applySearch);
  if (taxon) taxon.addEventListener('input', applySearch);
  if (spotSearch) spotSearch.addEventListener('input', filterSpotChips);
  if (fieldClear) fieldClear.addEventListener('click', function () { setField('all'); applySearch(); });
  fieldChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      setField(String(chip.getAttribute('data-observations-field-chip') || 'all'));
      applySearch();
    });
  });
  if (presetSave) presetSave.addEventListener('click', savePreset);
  if (presetName) presetName.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      savePreset();
    }
  });
  controls.forEach(function (control) { control.addEventListener('change', applySearch); });
  if (sort) sort.addEventListener('change', applySearch);
  setField('all');
  if (search && initialQuery) search.value = initialQuery;
  filterSpotChips();
  renderPresets();
  applySearch();
})();
</script>
      </section>`,
      observationCopy.activeNav,
      undefined,
      `${OBSERVATION_CARD_STYLES}
        .observations-page { display: grid; gap: 14px; margin-top: 4px; }
        .observations-titlebar { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
        .observations-titlebar h1 { margin: 0; color: #0f172a; font-size: 28px; line-height: 1.1; letter-spacing: 0; }
        .observations-title-lead { max-width: 72ch; margin: 8px 0 0; color: #475569; font-size: 13px; line-height: 1.7; font-weight: 750; }
        .observations-titlebar span { display: block; margin-top: 3px; color: #64748b; font-size: 13px; font-weight: 850; }
        .observations-actions { display: inline-flex; align-items: center; gap: 8px; }
        .observations-actions a { min-width: 46px; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; padding: 0 13px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.1); color: #0f172a; font-size: 14px; font-weight: 950; text-decoration: none; box-shadow: 0 4px 14px rgba(15,23,42,.04); }
        .observations-actions a:last-child { background: #064e3b; border-color: #064e3b; color: #fff; font-size: 22px; line-height: 1; }
        .observations-workbench { display: grid; gap: 14px; min-width: 0; }
        .observations-control-panel,
        .observations-results-panel { min-width: 0; }
        .observations-control-panel { display: grid; gap: 10px; align-content: start; }
        .observations-results-panel { display: grid; gap: 12px; }
        .observations-search { min-height: 52px; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; padding: 0 16px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.09); box-shadow: 0 5px 18px rgba(15,23,42,.04); }
        .observations-search span { color: #64748b; font-size: 20px; font-weight: 900; }
        .observations-search input { width: 100%; border: 0; outline: 0; background: transparent; color: #0f172a; font: inherit; font-size: 16px; font-weight: 750; }
        .observations-search input::placeholder { color: #94a3b8; }
        .observations-toolbar { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: none; }
        .observations-chip { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex: 0 0 auto; padding: 0 14px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.1); color: #0f172a; font-size: 14px; font-weight: 900; text-decoration: none; }
        .observations-chip b { min-width: 22px; padding: 2px 7px; border-radius: 999px; background: rgba(15,23,42,.06); color: #475569; font-size: 11px; line-height: 1.2; font-weight: 950; text-align: center; }
        .observations-chip.is-active { background: #0f172a; border-color: #0f172a; color: #fff; }
        .observations-chip.is-active b { background: rgba(255,255,255,.18); color: #fff; }
        .observations-advanced { border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.09); overflow: hidden; }
        .observations-advanced summary { min-height: 46px; display: flex; align-items: center; padding: 0 16px; color: #0f172a; font-size: 14px; font-weight: 950; cursor: pointer; list-style: none; }
        .observations-advanced summary::-webkit-details-marker { display: none; }
        .observations-advanced summary::after { content: "+"; margin-left: auto; font-size: 18px; line-height: 1; }
        .observations-advanced[open] summary::after { content: "-"; }
        .observations-advanced-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; padding: 0 12px 12px; }
        .observations-advanced label { display: grid; gap: 5px; color: #475569; font-size: 12px; font-weight: 900; }
        .observations-advanced select,
        .observations-advanced input,
        .observations-preset-save input,
        .observations-spot-search input { min-height: 42px; width: 100%; border-radius: 12px; border: 1px solid rgba(15,23,42,.12); background: #f8fafc; color: #0f172a; padding: 0 10px; font: inherit; font-size: 13px; font-weight: 850; }
        .observations-spot-filter, .observations-presets { display: grid; gap: 8px; padding: 10px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.09); }
        .observations-spot-search { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
        .observations-spot-search span { color: #475569; font-size: 12px; font-weight: 950; white-space: nowrap; }
        .observations-spot-search button,
        .observations-preset-save button,
        .observations-preset-chip button { min-height: 40px; border: 1px solid rgba(15,23,42,.1); background: #f8fafc; color: #0f172a; border-radius: 999px; padding: 0 13px; font: inherit; font-size: 13px; font-weight: 950; cursor: pointer; }
        .observations-spot-chips, .observations-preset-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; }
        .observations-spot-chip { min-height: 38px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #f8fafc; color: #0f172a; padding: 0 13px; font: inherit; font-size: 13px; font-weight: 900; cursor: pointer; }
        .observations-spot-chip b { min-width: 20px; padding: 2px 6px; border-radius: 999px; background: rgba(15,23,42,.06); color: #475569; font-size: 11px; line-height: 1.2; }
        .observations-spot-chip.is-active { background: #ecfdf5; border-color: rgba(6,78,59,.24); color: #064e3b; }
        .observations-spot-empty { min-height: 38px; display: inline-flex; align-items: center; color: #64748b; font-size: 13px; font-weight: 850; }
        .observations-preset-save { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
        .observations-preset-save button { background: #0f172a; border-color: #0f172a; color: #fff; }
        .observations-preset-chip { flex: 0 0 auto; display: inline-flex; align-items: center; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.1); overflow: hidden; }
        .observations-preset-chip button { border: 0; background: transparent; border-radius: 0; }
        .observations-preset-chip button:last-child { min-width: 36px; padding: 0 10px; color: #64748b; }
        .observations-video-grid { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 8px; align-items: start; }
        .observations-grid-item { position: relative; min-width: 0; }
        .observations-grid-item[hidden] { display: none; }
        .observations-video-grid .obs-card { border-radius: 8px; box-shadow: none; border-color: rgba(15,23,42,.07); }
        .observations-video-grid .obs-card:hover { transform: none; box-shadow: 0 6px 18px rgba(15,23,42,.08); }
        .observations-video-grid .obs-card-media { aspect-ratio: 1 / 1; }
        .observations-video-grid .obs-card-kind,
        .observations-video-grid .obs-card-tier,
        .observations-video-grid .obs-card-avatar { display: none; }
        .observations-video-grid .obs-card-meta { min-height: 64px; padding: 8px 9px 10px; gap: 4px; border-top: 0; }
        .observations-video-grid .obs-card-who { gap: 6px; }
        .observations-video-grid .obs-card-attribution { font-size: 12px; }
        .observations-video-grid .obs-card-when { font-size: 10.5px; }
        .observations-video-grid .obs-card-place { font-size: 11px; line-height: 1.35; -webkit-line-clamp: 1; }
        .observations-video-grid .obs-card-actions { display: none; }
        .observations-id-shortcut { position: absolute; right: 8px; top: 8px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 10px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 12px; font-weight: 950; text-decoration: none; backdrop-filter: blur(8px); }
        .observations-empty { grid-column: 1 / -1; min-height: 132px; display: grid; place-items: center; padding: 22px; border-radius: 8px; background: #fff; border: 1px solid rgba(15,23,42,.08); color: #475569; font-weight: 850; }
        .observations-empty[hidden] { display: none; }
        @media (min-width: 1161px) {
          .observations-page.is-identify .observations-workbench {
            grid-template-columns: minmax(280px, 330px) minmax(0, 1fr);
            gap: 16px;
            align-items: start;
          }
          .observations-page.is-identify .observations-control-panel {
            position: sticky;
            top: 76px;
            max-height: calc(100dvh - 92px);
            overflow-y: auto;
            padding: 12px;
            border-radius: 18px;
            border: 1px solid rgba(15,23,42,.08);
            background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,255,252,.92));
            box-shadow: 0 16px 42px rgba(15,23,42,.07);
          }
          .observations-page.is-identify .observations-toolbar,
          .observations-page.is-identify .observations-spot-chips,
          .observations-page.is-identify .observations-preset-list {
            display: grid;
            grid-template-columns: 1fr;
            overflow: visible;
            padding-bottom: 0;
          }
          .observations-page.is-identify .observations-chip,
          .observations-page.is-identify .observations-spot-chip,
          .observations-page.is-identify .observations-preset-chip {
            justify-content: space-between;
            width: 100%;
          }
          .observations-page.is-identify .observations-advanced-grid {
            grid-template-columns: 1fr;
          }
          .observations-page.is-identify .observations-video-grid {
            grid-template-columns: repeat(4, minmax(0,1fr));
          }
        }
        @media (max-width: 1180px) { .observations-video-grid { grid-template-columns: repeat(4, minmax(0,1fr)); } }
        @media (max-width: 820px) {
          .observations-page { gap: 12px; }
          .observations-titlebar h1 { font-size: 25px; }
          .observations-advanced-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .observations-video-grid { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 6px; }
          .observations-video-grid .obs-card-meta { min-height: 58px; padding: 7px 8px 9px; }
          .observations-video-grid .obs-card-when { display: none; }
          .observations-id-shortcut { min-height: 32px; padding: 0 9px; font-size: 11px; }
        }
        @media (max-width: 520px) {
          .observations-video-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .observations-search { min-height: 50px; }
          .observations-chip { min-height: 40px; padding: 0 12px; font-size: 13px; }
          .observations-chip b { display: none; }
          .observations-advanced-grid { grid-template-columns: 1fr; }
        }
      `,
      observationsCurrentPath,
      true,
      activeFilter === "needs_id" ? "shell-immersive shell-identify" : undefined,
      lang,
      observationCopy.footerNote,
    );
    if (canCacheHtml) {
      for (const [key, entry] of observationsHtmlCache) {
        if (entry.expiresAt <= now) observationsHtmlCache.delete(key);
      }
      if (!observationsHtmlCache.has(cacheKey) && observationsHtmlCache.size >= OBSERVATIONS_HTML_CACHE_MAX_ENTRIES) {
        observationsHtmlCache.clear();
      }
      observationsHtmlCache.set(cacheKey, {
        expiresAt: Date.now() + OBSERVATIONS_HTML_CACHE_TTL_MS,
        html,
      });
      reply.header("x-ikimon-observations-html-cache", "miss");
    }
    reply.type("text/html; charset=utf-8");
    return html;
    */
  });

  app.get("/home", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getHomeSnapshot(viewerUserId);

    reply.type("text/html; charset=utf-8");
    return renderHomePageHtml(basePath, lang, snapshot, canUseSpecialistWorkbench(session));
  });

  app.get<{ Params: { id: string }; Querystring: { subject?: string; occurrence?: string } }>("/observations/:id", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = viewerSession?.userId ?? null;
    const requestedSubjectId = request.query.subject ?? request.query.occurrence ?? null;
    const bundle = await getObservationVisitBundle(request.params.id, requestedSubjectId);
    if (!bundle) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }
    const canonicalHref = appendLangToHref(
      withBasePath(basePath, buildObservationDetailPath(bundle.visitId, bundle.canonicalSubjectId)),
      lang,
    );
    if (request.params.id !== bundle.visitId || request.query.subject !== bundle.canonicalSubjectId) {
      return reply.redirect(canonicalHref, 302);
    }

    const snapshot = await getObservationDetailSnapshot(bundle.canonicalSubjectId, { viewerUserId });
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }

    const mediaContext = mediaContextForSnapshot(snapshot);
    const mediaCopy = observationMediaCopy(mediaContext);
    const currentSubject = bundle.subjects.find((subject) => subject.occurrenceId === bundle.canonicalSubjectId) ?? bundle.subjects[0] ?? null;
    const featuredSubject = bundle.subjects.find((subject) => subject.occurrenceId === bundle.featuredOccurrenceId) ?? bundle.subjects[0] ?? null;
    const subjectCount = bundle.subjects.length;
    if (!currentSubject || !featuredSubject) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("対象が見つかりません", "この観察の subject を表示できません", "subject 情報がまだ同期中の可能性があります。"), "みつける");
    }

    const [obsContext, heavy, reactions, observerStats, insight, siteBriefResult, consensus, civicContext] = await Promise.all([
      getObservationContext(bundle.canonicalSubjectId, snapshot.visitId ?? null, null).catch(() => null),
      getObservationDetailHeavy(bundle.canonicalSubjectId, snapshot.visitId ?? null, snapshot.placeId ?? null, viewerUserId).catch(() => null),
      subjectCount >= 2 ? Promise.resolve(null) : getReactionSummary(bundle.canonicalSubjectId, viewerUserId).catch(() => null),
      viewerUserId
        ? getObserverStats(viewerUserId, snapshot.placeId ?? null, bundle.canonicalSubjectId).catch(() => null)
        : Promise.resolve(null),
      snapshot.scientificName || snapshot.displayName
        ? getTaxonInsight({
            scientificName: snapshot.scientificName ?? "",
            vernacularName: snapshot.displayName,
            lat: snapshot.latitude ?? undefined,
            lng: snapshot.longitude ?? undefined,
            season: seasonFromDate(snapshot.observedAt),
            lang: "ja",
            cacheOnly: true,
          }).catch(() => null)
        : Promise.resolve(null),
      typeof snapshot.latitude === "number" && typeof snapshot.longitude === "number"
        ? getSiteBrief(snapshot.latitude, snapshot.longitude, "ja").catch(() => null)
        : Promise.resolve(null),
      getIdentificationConsensus(bundle.canonicalSubjectId).catch(() => null),
      getCivicObservationContext(bundle.visitId).catch(() => null),
    ]);
    const managementPolicy = await getPlaceManagementPolicy(snapshot.placeId, viewerUserId).catch(() => null);
    const vegetationTrend = await getPlaceVegetationTrend(snapshot.placeId, managementPolicy).catch(() => null);
    const fieldAdviceContext = {
      policy: managementPolicy,
      trend: vegetationTrend,
      canEditPolicy: Boolean(viewerUserId && snapshot.placeId),
      placeId: snapshot.placeId,
    };
    const subjectIdentifyEntries = await Promise.all(
      bundle.subjects.map(async (subject) => {
        if (subject.occurrenceId === snapshot.occurrenceId) {
          const referenceCandidates = viewerUserId
            ? await listReferenceCandidatesForIdentification({ userId: viewerUserId, occurrenceId: subject.occurrenceId }).catch(() => [])
            : [];
          return [subject.occurrenceId, { snapshot, consensus, referenceCandidates }] as const;
        }
        const [subjectSnapshot, subjectConsensus, referenceCandidates] = await Promise.all([
          getObservationDetailSnapshot(subject.occurrenceId, { viewerUserId }).catch(() => null),
          getIdentificationConsensus(subject.occurrenceId).catch(() => null),
          viewerUserId
            ? listReferenceCandidatesForIdentification({ userId: viewerUserId, occurrenceId: subject.occurrenceId }).catch(() => [])
            : Promise.resolve([]),
        ]);
        return [
          subject.occurrenceId,
          {
            snapshot: subjectSnapshot ?? {
              ...snapshot,
              occurrenceId: subject.occurrenceId,
              displayName: subject.displayName,
              scientificName: subject.scientificName,
              vernacularName: subject.vernacularName,
              identifications: subject.identifications,
              disputes: [],
              visualEvidence: snapshot.visualEvidence,
              nextCaptureSuggestions: snapshot.nextCaptureSuggestions,
            },
            consensus: subjectConsensus,
            referenceCandidates,
          },
        ] as const;
      }),
    );
    const subjectIdentifyMap = new Map(subjectIdentifyEntries);

    // ===== Layer 0: ヒーロー =====
    const isOwner = !!viewerUserId && viewerUserId === snapshot.observerUserId;
    const visibleRecordItems = buildVisibleRecordItems({
      basePath,
      lang,
      bundle,
      currentSubject,
      featuredSubject,
      isOwner,
      canProposeSubject: Boolean(viewerUserId),
    });
    const mediaAnnotationTargets = buildObservationMediaAnnotationTargets(visibleRecordItems, bundle);
    const currentSubjectDisplay = formatTaxonDisplayName(currentSubject, lang);
    const snapshotDisplay = formatTaxonDisplayName(snapshot, lang);
    const observerDisplay = formatActorDisplay(snapshot.observerName, lang);
    const relatedObservationsHref = appendLangToHref(
      withBasePath(
        basePath,
        snapshotDisplay.isAwaitingId
          ? "/records?view=needs_id"
          : `/records?view=public&q=${encodeURIComponent(snapshotDisplay.primaryLabel)}`,
      ),
      lang,
    );
    const visibleAiCandidateCount = visibleRecordItems.filter((item) => item.source === "candidate").length;
    const badges: string[] = [];
    badges.push(`<span class="obs-badge obs-badge-species">🧩 ${visibleRecordItems.length}件の見つけたもの</span>`);
    if (visibleAiCandidateCount > 0) badges.push(`<span class="obs-badge obs-badge-species">自動候補 ${visibleAiCandidateCount}件</span>`);
    if (currentSubject && featuredSubject && currentSubject.occurrenceId !== featuredSubject.occurrenceId) {
      badges.push(`<span class="obs-badge obs-badge-nearby" data-current-subject-badge>👀 表示中 ${escapeHtml(currentSubjectDisplay.primaryLabel)}</span>`);
    }
    const currentAiJudgementLabel = aiJudgementStateLabel(currentSubject);
    if (currentAiJudgementLabel) badges.push(`<span class="obs-badge obs-badge-ai">自動候補: ${escapeHtml(currentAiJudgementLabel)}</span>`);
    if (currentSubject.identificationCount > 0) badges.push(`<span class="obs-badge obs-badge-consensus">🧭 名前の提案 ${currentSubject.identificationCount}件</span>`);
    if (heavy && heavy.nearby.length > 0) badges.push(`<span class="obs-badge obs-badge-nearby">📍 同地点 ${heavy.nearby.length} 件</span>`);
    if (snapshot.videoAssets.length > 0) badges.push(`<span class="obs-badge obs-badge-video">🎬 動画あり</span>`);
    if (snapshot.audioAssets.length > 0) badges.push(`<span class="obs-badge obs-badge-video">音あり</span>`);

    const reactionBar = subjectCount >= 2 ? "" : renderReactionBar(reactions, viewerUserId, bundle.canonicalSubjectId);
    const aiCandidateLearningPanel = renderAiCandidateLearningPanel({
          basePath,
          lang,
          visitId: bundle.visitId,
          candidates: bundle.aiCandidates,
          canProposeSubject: Boolean(viewerUserId),
          isOwner,
          mediaContext,
        });
    const canSeeCanonicalLocation = isOwner || /admin/i.test(String(viewerSession?.roleName ?? ""));
    const regionalStory = await getRegionalStoryCue({
      surface: "observation",
      viewerUserId,
      place: {
        placeId: snapshot.placeId,
        placeName: snapshot.placeName,
        municipality: snapshot.municipality,
        latitude: snapshot.latitude,
        longitude: snapshot.longitude,
        publicLabel: snapshot.publicLocation?.label ?? null,
        allowPrecisePlaceLabel: canSeeCanonicalLocation,
      },
      observation: {
        observationId: snapshot.occurrenceId,
        observedAt: snapshot.observedAt,
        displayName: snapshotDisplay.primaryLabel,
      },
      maxCards: 2,
    }).catch(() => null);
    const heroPlaceLabel = canSeeCanonicalLocation
      ? formatPlaceDisplay(snapshot, lang, "owner")
      : formatPlaceDisplay(snapshot, lang, "public");
    const recordInsightText = renderObservationRecordInsightText({
      snapshot,
      subject: currentSubject,
      recordItems: visibleRecordItems,
      placeLabel: heroPlaceLabel,
    });
    const { mediaBlock, galleryScript } = renderObservationMedia(snapshot, currentSubject, mediaAnnotationTargets, {
      afterVideoHtml: renderObservationRecordInsight(recordInsightText),
    });
    const publicMapHref = buildPublicMapCellHref(withBasePath(basePath, "/map"), snapshot.publicLocation);
    const detailMapHref = canSeeCanonicalLocation
      ? withBasePath(basePath, "/map")
      : publicMapHref;
    const trustStage =
      (currentSubject.evidenceTier ?? 0) >= 3
        ? "public_claim"
        : currentSubject.hasSpecialistApproval
          ? "authority_backed"
          : currentSubject.identificationCount > 0
            ? "community_support"
            : currentSubject.latestAssessmentBand && currentSubject.latestAssessmentBand !== "unknown"
              ? "ai_suggestion"
              : "";
    const trustLead =
      trustStage === "public_claim"
          ? "詳しい人の確認と証拠があります。"
        : trustStage === "authority_backed"
          ? "詳しい人の確認があります。"
          : trustStage === "community_support"
            ? "複数の見方が近づいています。"
            : "仮の候補です。確定名ではありません。";
    const trustSteps = [
      { id: "ai_suggestion", label: "自動候補", meta: "写真から拾った仮の候補" },
      { id: "community_support", label: "みんなの確認", meta: "見方がそろう" },
      { id: "authority_backed", label: "詳しい人の確認", meta: "名前がより確かに" },
      { id: "public_claim", label: "公開に使いやすい", meta: "記録として使いやすい段階" },
    ];
    const trustStageLabel = trustSteps.find((step) => step.id === trustStage)?.label ?? "候補";
    const targetTaxaScopeLabel = (() => {
      const scope = (snapshot.targetTaxaScope ?? "").trim();
      if (!scope) return null;
      if (scope === "all_observed_taxa") return "見つかったものを広く残す";
      if (scope === "plants") return "植物";
      if (scope === "birds") return "鳥類";
      if (scope === "insects") return "昆虫";
      return scope;
    })();
    const surveyResultLabel = snapshot.surveyResult === "no_detection_note"
      ? "今回は見つからなかったメモ"
      : snapshot.surveyResult === "detected"
        ? "今回は見つけたものを記録"
        : null;
    const surveySummary =
      snapshot.visitMode === "survey"
        ? (() => {
            const protocolChips: string[] = [];
            protocolChips.push(`<span class="obs-focus-chip">${snapshot.completeChecklistFlag ? "complete checklist" : "partial checklist"}</span>`);
            if (targetTaxaScopeLabel) protocolChips.push(`<span class="obs-focus-chip">${escapeHtml(targetTaxaScopeLabel)}</span>`);
            if (snapshot.effortMinutes != null) protocolChips.push(`<span class="obs-focus-chip">⏱️ ${snapshot.effortMinutes} 分</span>`);
            if (snapshot.distanceMeters != null) protocolChips.push(`<span class="obs-focus-chip">📏 ${Math.round(snapshot.distanceMeters)} m</span>`);
            if (snapshot.revisitReason) protocolChips.push(`<span class="obs-focus-chip">↺ ${escapeHtml(snapshot.revisitReason)}</span>`);
            const boundaryNote = snapshot.surveyResult === "no_detection_note" || snapshot.absenceSemantics === "protocol_note_only"
              ? "この記録は「見つからなかった」を不在の主張としては扱っていません。手順の注記としてだけ保持しています。"
              : "比較したい観察として、どれだけ歩いたか・手順・範囲を残した記録です。比較の精度を上げるための記録で、増減や不在をここだけで断定しません。";
            return `<div class="obs-story-block">
              <div class="obs-story-eyebrow">この日の見方</div>
              <p>この記録では、見た範囲や時間も分かります。写真だけで言い切れない変化は、ここでは断定しません。</p>
              ${protocolChips.length > 0 ? `<div class="obs-focus-meta">${protocolChips.join("")}</div>` : ""}
              ${surveyResultLabel ? `<p style="margin-top:10px">${escapeHtml(surveyResultLabel)}</p>` : ""}
              <small class="obs-ai-note">${escapeHtml(boundaryNote)}</small>
            </div>`;
          })()
        : "";
    const trustLadderBlock = `<details class="obs-trust-ladder">
      <summary class="obs-trust-summary">
        <span>
          <span class="obs-story-eyebrow">同定</span>
          <strong>いまは「${escapeHtml(trustStageLabel)}」の段階です</strong>
        </span>
        <span class="obs-trust-toggle">詳しく</span>
      </summary>
      <p class="obs-trust-lead">${escapeHtml(trustLead)}</p>
      <div class="obs-trust-steps">
        ${trustSteps.map((step) => {
          const current =
            trustStage === step.id
            || (trustStage === "public_claim" && (step.id === "authority_backed" || step.id === "community_support" || step.id === "ai_suggestion"))
            || (trustStage === "authority_backed" && (step.id === "community_support" || step.id === "ai_suggestion"))
            || (trustStage === "community_support" && step.id === "ai_suggestion");
          const isCurrent = trustStage === step.id;
          return `<div class="obs-trust-step${current ? " is-reached" : ""}${isCurrent ? " is-current" : ""}">
            <div class="obs-trust-step-top">
              <span class="obs-trust-step-label">${escapeHtml(step.label)}</span>
              ${isCurrent ? `<span class="obs-trust-step-pill">現在地</span>` : ""}
            </div>
            <div class="obs-trust-step-meta">${escapeHtml(step.meta)}</div>
          </div>`;
        }).join("")}
      </div>
    </details>`;

    const focusRailBlock = renderVisibleRecordItemsPanel(visibleRecordItems, mediaContext);
    // 写真上の対象切替UIは、場面読みより目立つ割に情報量が薄いため表示しない。
    // 画像内の枠クリックや下部の記録カードへの連動は残す。
    const mediaDiscoveryBlock = "";

    const revisitRecordHref = buildPlaceRecordHref(basePath, lang, viewerUserId, {
      placeId: snapshot.placeId,
      placeName: snapshot.placeName || heroPlaceLabel || "この場所",
      municipality: snapshot.municipality,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      lastRecordMode: snapshot.recordMode,
      lastSurveyResult: snapshot.surveyResult,
      revisitReason: snapshot.revisitReason,
      nextLookFor: snapshotDisplay.primaryLabel,
      latestDisplayName: snapshotDisplay.primaryLabel,
      absenceSemantics: snapshot.absenceSemantics,
    });
    const nextActions: ObservationNextAction[] = [
      {
        href: revisitRecordHref,
        label: "この場所を再訪する",
        body: "同じ地点で季節や変化を重ねる",
        key: "revisit_place",
        primary: true,
      },
      {
        href: appendLangToHref(withBasePath(basePath, `/record?start=gallery&revisitObservationId=${encodeURIComponent(bundle.visitId)}`), lang),
        label: "追加写真を撮る",
        body: "足りない角度や証拠を補う",
        key: "add_media",
      },
      {
        href: "#identify",
        label: "同定を更新する",
        body: "名前・根拠・証拠不足を足す",
        key: "identify",
      },
      {
        href: relatedObservationsHref,
        label: "似た観察を見る",
        body: "近い記録から読み方を広げる",
        key: "explore_related",
      },
    ];
    const summaryStrip = renderObservationSummaryStrip({
      displayName: snapshotDisplay.primaryLabel,
      observedAt: snapshot.observedAt,
      placeLabel: heroPlaceLabel,
      observerDisplay,
      trustStageLabel,
      subjectCount,
      mediaCount: snapshot.photoAssets.length + snapshot.videoAssets.length + snapshot.audioAssets.length,
    });
    const evidenceLabel = observationEvidenceLabel(snapshot);
    // 上部のアクション案内を廃止（下部 ctaBlock に関連リンクとして集約済みのため重複削除）
    const nextActionRail = "";
    void nextActions;
    const recordTitle = formatSceneRecordTitle(
      visibleRecordItems,
      formatObservationRecordTitle(snapshot.observedAt, heroPlaceLabel),
    );
    const identifyBlock = `<div data-obs-section="identify" data-obs-switch-identify>${renderIdentificationParticipation({
      basePath,
      lang,
      snapshot,
      subject: currentSubject,
      mediaContext,
      consensus,
      viewerSession,
      canUseSpecialistWorkbench: canUseSpecialistWorkbench(viewerSession),
      referenceCandidates: subjectIdentifyMap.get(currentSubject.occurrenceId)?.referenceCandidates ?? [],
    })}</div>`;
    const heroBlock = renderObservationReadingHero({
      mediaBlock,
      snapshot,
      recordTitle,
      observerDisplay,
      observerHref: appendLangToHref(buildObserverProfileHref(basePath, snapshot.observerUserId) ?? "#", lang),
      observedAt: snapshot.observedAt,
      placeLabel: heroPlaceLabel,
      badges,
      focusRailBlock,
      mediaDiscoveryBlock,
      mediaLedgerBlock: renderObservationMediaLedger(snapshot, heavy?.nearby.length ?? 0),
      recordInsightBlock: renderObservationRecordInsight(recordInsightText, "obs-record-insight-desktop"),
      useStatusBlock: renderObservationUseStatus(snapshot, consensus),
      identifyBlock,
      visibleRecordCount: visibleRecordItems.length,
      summaryStrip,
      firstReadBlock: renderPhotoFirstRead(currentSubject, visibleRecordItems, consensus?.hasOpenDispute === true, mediaContext),
      sceneOverviewBlock: renderObservationSceneOverview(visibleRecordItems, mediaContext),
      nameStatusBlock: renderHeroAiReadout(currentSubject, consensus?.hasOpenDispute === true, insight),
      nextActionRail,
      trustStageLabel,
      trustLead,
      recordsHref: appendLangToHref(withBasePath(basePath, isOwner ? "/records?view=mine" : "/records?view=public"), lang),
      evidenceLabel,
      recordModeLabel: observationRecordModeLabel(snapshot),
      mediaSceneLabel: mediaSceneNoun(mediaContext),
    });
    // 下部の旧要約ブロックは廃止: hero に summaryStrip / trust panel が既に表示されており重複のため
    const summaryBlock = "";
    const readProgressBlock = renderObservationReadProgress({
      basePath,
      observationId: bundle.visitId,
      subjectId: bundle.canonicalSubjectId,
      isOwner,
    });
    const photoRecoveryBlock = renderObservationPhotoRecoveryPanel({
      basePath,
      visitId: bundle.visitId,
      isOwner,
      existingPhotoCount: snapshot.photoAssets.length,
      mediaContext,
    });
    const ownerDeleteBlock = renderObservationOwnerDeletePanel({
      basePath,
      visitId: bundle.visitId,
      isOwner,
      lang,
    });

    const hintBlock = "";
    const aiCandidateLearningBlock = aiCandidateLearningPanel
      ? `<div id="co-candidates" class="obs-reading-section" data-obs-section="co_candidates">${aiCandidateLearningPanel}</div>`
      : "";
    const regionalStoryBlock = "";
    void regionalStory;
    const recordStoryBlock = "";

    // ===== Layer 1: 物語 =====
    const ownerNote = snapshot.note
      ? `<div class="obs-story-block">
           <div class="obs-story-eyebrow">この日のメモ</div>
           <p>${escapeHtml(snapshot.note)}</p>
         </div>`
      : "";
    const aiFirst = obsContext && (obsContext.environmentContexts.length > 0 || obsContext.seasonalNotes.length > 0)
      ? `<div class="obs-story-block obs-story-ai">
           <div class="obs-story-eyebrow">写真から読めそうなこと</div>
           ${obsContext.environmentContexts.map((e) => `<p>${escapeHtml(friendlyObservationText(e, 90))}</p>`).join("")}
           ${obsContext.seasonalNotes.map((e) => `<p>${escapeHtml(friendlyObservationText(e, 90))}</p>`).join("")}
           <small class="obs-ai-note">※ 自動メモです。みんなの確認と合わせて見てください。</small>
         </div>`
      : "";
    const footprintCard = observerStats
      ? `<div class="obs-footprint">
           <div class="obs-footprint-row">
             <span class="obs-footprint-num">#${observerStats.totalObservations}</span>
             <span class="obs-footprint-label">あなたの累計記録</span>
           </div>
           <div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.thisMonthObservations}</span>
             <span class="obs-footprint-label">今月の記録</span>
           </div>
           ${observerStats.placeVisitCount > 1 ? `<div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.placeVisitCount}</span>
             <span class="obs-footprint-label">この場所に来た回数</span>
           </div>` : ""}
           ${observerStats.currentStreakDays > 1 ? `<div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.currentStreakDays}</span>
             <span class="obs-footprint-label">連続観察日数</span>
           </div>` : ""}
         </div>`
      : "";
    const civicContextBlock = renderCivicContextBlock(civicContext, snapshot, basePath, lang);
    const layer1 = ownerNote
      ? `<section id="story" class="section obs-layer obs-layer-1" data-obs-section="story">
           <h2 class="obs-layer-title">この日のメモ</h2>
           <div class="obs-layer-body">${ownerNote}</div>
         </section>`
      : "";
    void recordStoryBlock;
    void surveySummary;
    void aiFirst;
    void footprintCard;
    void civicContextBlock;

    // ===== Layer 2: 同定 =====
    const identityEvidenceBlock = renderSubjectEvidenceTabs({
      basePath,
      lang,
      visitId: bundle.visitId,
      bundle,
    });
    const layer2 = `${identityEvidenceBlock}<div data-obs-switch-taxonomy>${renderSubjectTaxonomy(currentSubject, featuredSubject, subjectCount, bundle)}</div>`;

    // ===== Layer 3: 次に見るなら =====
    const layer3 = renderNearbyAreaRecords({
      basePath,
      lang,
      placeLabel: heroPlaceLabel,
      nearby: heavy?.nearby ?? [],
    });
    void relatedObservationsHref;
    void detailMapHref;

    // ===== Layer 5: CTA =====
    const ctaBlock = ``;

    // ===== Layer 6: 豆知識 =====
    const insightBits: string[] = [];
    if (insight && insight.etymology) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📖 名前の由来</div><p>${escapeHtml(insight.etymology)}</p></div>`);
    if (insight && insight.ecologyNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🌿 生き方</div><p>${escapeHtml(insight.ecologyNote)}</p></div>`);
    if (insight && insight.lookAlikeNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🔍 似た仲間</div><p>${escapeHtml(insight.lookAlikeNote)}</p></div>`);
    if (insight && insight.rarityNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📍 出会いやすさ</div><p>${escapeHtml(insight.rarityNote)}</p></div>`);
    const hasOpenNameDispute = consensus?.hasOpenDispute === true;
    const layer6 = "";
    void hasOpenNameDispute;
    void insightBits;

    // ===== コンテキスト折り畳み (Phase D 既存、保持) =====
    const grouped = obsContext ? groupFeaturesByLayer(obsContext.features) : { coexistingTaxa: [], environment: [], sounds: [] };
    const renderFeatureChips = (list: typeof grouped.coexistingTaxa): string =>
      list.map((f) => `<li class="obs-chip" title="${escapeHtml(f.note ?? "")}"><span class="obs-chip-name">${escapeHtml(f.name)}</span>${
        typeof f.confidence === "number" ? `<span class="obs-chip-conf">${Math.round(f.confidence * 100)}%</span>` : ""
      }<span class="obs-chip-src">${f.sourceKind === "audio" ? "🎤" : "📷"}</span></li>`).join("");
    const coexistingSection = grouped.coexistingTaxa.length > 0
      ? `<details class="obs-fold" open>
           <summary>🌿 同地点の生きもの <span class="obs-fold-count">${grouped.coexistingTaxa.length}</span></summary>
           <ul class="obs-chips">${renderFeatureChips(grouped.coexistingTaxa)}</ul>
         </details>` : "";
    const soundsSection = grouped.sounds.length > 0
      ? `<details class="obs-fold"><summary>🎤 音で拾った <span class="obs-fold-count">${grouped.sounds.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.sounds)}</ul></details>` : "";
    const envSection = grouped.environment.length > 0
      ? `<details class="obs-fold"><summary>🏞️ 環境の情報 <span class="obs-fold-count">${grouped.environment.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.environment)}</ul></details>` : "";
    const contextBlock = (coexistingSection || soundsSection || envSection)
      ? `<section class="section obs-layer"><h2 class="obs-layer-title">${escapeHtml(mediaCopy.contextHeading)}</h2>${coexistingSection}${soundsSection}${envSection}</section>` : "";
    const hasAdoptableVisibleCandidate = visibleRecordItems.some((item) => Boolean(item.adoptEndpoint));

    const subjectTemplates = bundle.subjects.map((subject) => `
      <template data-subject-first-read-template="${escapeHtml(subject.occurrenceId)}">${renderPhotoFirstRead(subject, visibleRecordItems, subjectIdentifyMap.get(subject.occurrenceId)?.consensus?.hasOpenDispute === true, mediaContext)}</template>
      <template data-subject-ai-readout-template="${escapeHtml(subject.occurrenceId)}">${renderHeroAiReadout(subject, subjectIdentifyMap.get(subject.occurrenceId)?.consensus?.hasOpenDispute === true, subject.occurrenceId === currentSubject.occurrenceId ? insight : null)}</template>
      <template data-subject-hint-template="${escapeHtml(subject.occurrenceId)}">${renderSubjectHint(subject, siteBriefResult ?? null, snapshot.photoAssets, basePath, mediaContext, fieldAdviceContext)}</template>
      <template data-subject-taxonomy-template="${escapeHtml(subject.occurrenceId)}">${renderSubjectTaxonomy(subject, featuredSubject, subjectCount, bundle)}</template>
      <template data-subject-identify-template="${escapeHtml(subject.occurrenceId)}">${renderIdentificationParticipation({
        basePath,
        lang,
        snapshot: subjectIdentifyMap.get(subject.occurrenceId)?.snapshot ?? snapshot,
        subject,
        mediaContext,
        consensus: subjectIdentifyMap.get(subject.occurrenceId)?.consensus ?? null,
        viewerSession,
        canUseSpecialistWorkbench: canUseSpecialistWorkbench(viewerSession),
        referenceCandidates: subjectIdentifyMap.get(subject.occurrenceId)?.referenceCandidates ?? [],
      })}</template>`).join("");
    // supportBlock は反応UIのみだったため、この詳細ページでは表示しない。
    const supportBlock = "";
    void reactionBar;
    void trustLadderBlock;
    const reassessButtons: string[] = [];
    if (isOwner) {
      if (snapshot.photoAssets.length > 0) {
        reassessButtons.push(
          `<button type="button"
                   class="obs-reassess-btn"
                   data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(bundle.visitId) + "/reassess"))}"
                   data-loading-text="AIで確認しています…">写真をもう一度見る</button>`,
        );
      }
      if (snapshot.videoAssets.length > 0) {
        reassessButtons.push(
          `<button type="button"
                   class="obs-reassess-btn"
                   data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(bundle.visitId) + "/reassess-from-video"))}"
                   data-loading-text="${escapeHtml(mediaCopy.videoReassessLoadingText)}">動画をもう一度見る</button>`,
        );
      }
    }
    const reassessBlock = isOwner && reassessButtons.length > 0
      ? `<section class="section obs-reassess-row" aria-label="見分けるメモを更新">
           <span class="obs-owner-tool-label">AI</span>
           ${reassessButtons.join("")}
           <span class="obs-reassess-status" data-reassess-status hidden></span>
         </section>`
      : "";
    const ownerToolsBlock = (photoRecoveryBlock || ownerDeleteBlock || reassessBlock)
      ? `<section class="obs-owner-tools" aria-label="投稿者用ツール">${photoRecoveryBlock}${ownerDeleteBlock}${reassessBlock}</section>`
      : "";
    const invasiveReportingGuidanceBlock = renderInvasiveReportingGuidanceBlock(currentSubject, basePath, lang);
    const subjectRegionMap = toSubjectRegionMap(bundle.subjects);
    const switchScript = subjectCount > 1
      ? `<script>(function(){
           var currentSubjectId = ${JSON.stringify(bundle.canonicalSubjectId)};
           var featuredSubjectId = ${JSON.stringify(featuredSubject.occurrenceId)};
           var regionMap = ${JSON.stringify(subjectRegionMap)};
           var regionDisplayConfMin = ${REGION_DISPLAY_CONF_MIN};
           var regionLargeAreaMin = ${REGION_LARGE_AREA_MIN};
           var links = Array.prototype.slice.call(document.querySelectorAll('[data-subject-switch][data-subject-id]'));
           var firstReadRoot = document.querySelector('[data-obs-switch-first-read]');
           var aiReadoutRoot = document.querySelector('[data-obs-switch-ai-readout]');
           var hintRoot = document.querySelector('[data-obs-switch-hint]');
           var taxonomyRoot = document.querySelector('[data-obs-switch-taxonomy]');
           var identifyRoot = document.querySelector('[data-obs-switch-identify]');
           var currentBadge = document.querySelector('[data-current-subject-badge]');
           var selectTemplate = function(attr, subjectId){
             return document.querySelector('template[' + attr + '="' + subjectId.replace(/"/g, '\\"') + '"]');
           };
           var renderRegions = function(subjectId){
             Array.prototype.slice.call(document.querySelectorAll('[data-region-layer]')).forEach(function(layer){
               layer.innerHTML = '';
               layer.hidden = true;
             });
             var regions = regionMap[subjectId] || [];
             var visibleRegionCount = 0;
             regions.forEach(function(region){
               if (!region || !region.rect || !region.assetId) return;
               if (typeof region.confidenceScore === 'number' && region.confidenceScore < regionDisplayConfMin) return;
               var layer = document.querySelector('[data-region-layer="' + region.assetId.replace(/"/g, '\\"') + '"]');
               if (!layer) return;
               layer.hidden = false;
               var box = document.createElement('span');
               var regionArea = Number(region.rect.width || 0) * Number(region.rect.height || 0);
               box.className = 'obs-region-box' + (regionArea >= regionLargeAreaMin ? ' is-large-region' : '');
               box.style.left = (region.rect.x * 100) + '%';
               box.style.top = (region.rect.y * 100) + '%';
               box.style.width = (region.rect.width * 100) + '%';
               box.style.height = (region.rect.height * 100) + '%';
               if (region.note) {
                 var label = document.createElement('span');
                 label.className = 'obs-region-box-label';
                 label.textContent = region.note;
                 box.appendChild(label);
               }
               layer.appendChild(box);
               visibleRegionCount += 1;
             });
             var regionSummary = document.querySelector('[data-region-summary]');
             if (regionSummary) {
               regionSummary.hidden = true;
               regionSummary.textContent = '';
             }
           };
           var updateStateLabels = function(subjectId){
             links.forEach(function(link){
               var isCurrent = link.getAttribute('data-subject-id') === subjectId;
               link.classList.toggle('is-current', isCurrent);
               var state = link.querySelector('[data-subject-state]');
               if (!state) return;
               if (isCurrent) {
                 state.hidden = false;
                 state.textContent = '表示中';
               } else if (link.getAttribute('data-subject-id') === featuredSubjectId) {
                 state.hidden = false;
                 state.textContent = '有力';
               } else {
                 state.hidden = true;
                 state.textContent = '';
               }
             });
             if (currentBadge) {
               currentBadge.hidden = subjectId === featuredSubjectId;
               var active = links.find(function(link){ return link.getAttribute('data-subject-id') === subjectId; });
               var nameEl = active ? active.querySelector('.obs-focus-card-name') : null;
               currentBadge.textContent = nameEl ? ('👀 表示中 ' + nameEl.textContent) : '';
             }
           };
           var renderSubject = function(subjectId, push){
             var aiReadoutTemplate = selectTemplate('data-subject-ai-readout-template', subjectId);
             var firstReadTemplate = selectTemplate('data-subject-first-read-template', subjectId);
             var hintTemplate = selectTemplate('data-subject-hint-template', subjectId);
             var taxonomyTemplate = selectTemplate('data-subject-taxonomy-template', subjectId);
             var identifyTemplate = selectTemplate('data-subject-identify-template', subjectId);
             if (firstReadRoot && firstReadTemplate) firstReadRoot.innerHTML = firstReadTemplate.innerHTML;
             if (aiReadoutRoot && aiReadoutTemplate) aiReadoutRoot.innerHTML = aiReadoutTemplate.innerHTML;
             if (hintRoot && hintTemplate) hintRoot.innerHTML = hintTemplate.innerHTML;
             if (taxonomyRoot && taxonomyTemplate) taxonomyRoot.innerHTML = taxonomyTemplate.innerHTML;
             if (identifyRoot && identifyTemplate) identifyRoot.innerHTML = identifyTemplate.innerHTML;
             renderRegions(subjectId);
             updateStateLabels(subjectId);
             window.dispatchEvent(new CustomEvent('ikimon:identify-panel-replaced'));
             window.dispatchEvent(new CustomEvent('ikimon:subject-rendered', { detail: { subjectId: subjectId } }));
             currentSubjectId = subjectId;
             if (push) {
               var active = links.find(function(link){ return link.getAttribute('data-subject-id') === subjectId; });
               if (active && active.href) history.pushState({ subject: subjectId }, '', active.href);
             }
           };
           links.forEach(function(link){
             link.addEventListener('click', function(event){
               if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
               event.preventDefault();
               var subjectId = link.getAttribute('data-subject-id');
               if (!subjectId || subjectId === currentSubjectId) return;
               renderSubject(subjectId, true);
             });
           });
           window.addEventListener('popstate', function(){
             var params = new URLSearchParams(window.location.search);
             var subjectId = params.get('subject');
             if (subjectId) renderSubject(subjectId, false);
           });
           window.addEventListener('ikimon:media-asset-selected', function(){
             renderRegions(currentSubjectId);
           });
           renderSubject(currentSubjectId, false);
         })();</script>`
      : "";
    const annotationScript = mediaAnnotationTargets.length > 0
      ? `<script>(function(){
           var currentSubjectId = ${JSON.stringify(bundle.canonicalSubjectId)};
           var baseObservationHref = ${JSON.stringify(withBasePath(basePath, `/observations/${encodeURIComponent(bundle.visitId)}`))};
           var langSuffix = ${JSON.stringify(lang === "ja" ? "&lang=ja" : lang === "en" ? "&lang=en" : "")};
           var cssEscape = function(value) {
             if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
             return String(value).replace(/["\\\\]/g, '\\\\$&');
           };
           var setActiveAnnotations = function(subjectId) {
             currentSubjectId = subjectId || currentSubjectId;
             Array.prototype.slice.call(document.querySelectorAll('[data-annotation-subject-id]')).forEach(function(node){
               node.classList.toggle('is-current', node.getAttribute('data-annotation-subject-id') === currentSubjectId);
             });
             Array.prototype.slice.call(document.querySelectorAll('[data-annotation-candidate-id]')).forEach(function(node){
               node.classList.remove('is-current');
             });
           };
           var setActiveCandidateAnnotations = function(candidateId) {
             Array.prototype.slice.call(document.querySelectorAll('[data-annotation-subject-id]')).forEach(function(node){
               node.classList.remove('is-current');
             });
             Array.prototype.slice.call(document.querySelectorAll('[data-annotation-candidate-id]')).forEach(function(node){
               node.classList.toggle('is-current', node.getAttribute('data-annotation-candidate-id') === candidateId);
             });
           };
           var focusCandidateCard = function(candidateId) {
             var selector = '[data-visible-record-candidate="' + cssEscape(candidateId) + '"]';
             var card = document.querySelector(selector);
             if (!card) return false;
             card.classList.add('is-annotation-focus');
             card.scrollIntoView({ behavior: 'smooth', block: 'center' });
             window.setTimeout(function(){ card.classList.remove('is-annotation-focus'); }, 1800);
             var button = card.querySelector('[data-adopt-candidate]');
             if (button && typeof button.focus === 'function') button.focus({ preventScroll: true });
             var status = document.querySelector('[data-adopt-candidate-status]');
             if (status) {
               status.hidden = false;
               status.classList.remove('is-error');
               status.textContent = '枠で選んだ候補です。写っている対象として記録できます。';
             }
             return true;
           };
           document.addEventListener('click', function(event){
             var target = event.target instanceof Element ? event.target.closest('[data-annotation-target]') : null;
             if (!target) return;
             event.preventDefault();
             event.stopPropagation();
             var subjectId = target.getAttribute('data-annotation-subject-id') || '';
             var candidateId = target.getAttribute('data-annotation-candidate-id') || '';
             if (subjectId) {
               if (subjectId === currentSubjectId) {
                 setActiveAnnotations(subjectId);
                 return;
               }
               var link = document.querySelector('[data-subject-switch][data-subject-id="' + cssEscape(subjectId) + '"]');
               if (link) {
                 link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                 setActiveAnnotations(subjectId);
                 return;
               }
               var sep = baseObservationHref.indexOf('?') >= 0 ? '&' : '?';
               window.location.href = baseObservationHref + sep + 'subject=' + encodeURIComponent(subjectId) + langSuffix;
               return;
             }
             if (candidateId && focusCandidateCard(candidateId)) {
               setActiveCandidateAnnotations(candidateId);
               return;
             }
           }, { capture: true });
           window.addEventListener('ikimon:subject-rendered', function(event){
             var detail = event && event.detail ? event.detail : {};
             if (detail.subjectId) setActiveAnnotations(detail.subjectId);
           });
           setActiveAnnotations(currentSubjectId);
         })();</script>`
      : "";
    const reassessScript = isOwner
      ? `<script>(function(){
           var buttons = Array.prototype.slice.call(document.querySelectorAll('.obs-reassess-btn[data-reassess-endpoint]'));
           if (!buttons.length) return;
           var statusEl = document.querySelector('[data-reassess-status]');
           var setBusy = function(disabled) {
             buttons.forEach(function(button){ button.disabled = disabled; });
           };
           buttons.forEach(function(btn){
             btn.addEventListener('click', function(){
               var endpoint = btn.getAttribute('data-reassess-endpoint');
               if (!endpoint) return;
               var loadingText = btn.getAttribute('data-loading-text') || '再判定中…';
               setBusy(true);
               if (statusEl) { statusEl.hidden = false; statusEl.classList.remove('is-error'); statusEl.textContent = loadingText; }
               fetch(endpoint, { method: 'POST', credentials: 'include' })
                .then(function(r){ return r.json().then(function(j){ return { ok: r.ok && j && j.ok, j: j }; }); })
                .then(function(res){
                  if (!res.ok) {
                    if (statusEl) { statusEl.classList.add('is-error'); statusEl.textContent = '失敗: ' + ((res.j && res.j.error) || 'unknown_error'); }
                    setBusy(false);
                    return;
                  }
                  if (statusEl) { statusEl.textContent = '判定完了 — ページを更新します'; }
                  setTimeout(function(){ window.location.reload(); }, 600);
                })
                .catch(function(e){
                  if (statusEl) { statusEl.classList.add('is-error'); statusEl.textContent = '通信エラー: ' + (e && e.message || 'network'); }
                  setBusy(false);
                });
             });
           });
          })();</script>`
      : "";
    const candidateAdoptionScript = viewerUserId && (aiCandidateLearningPanel || hasAdoptableVisibleCandidate)
      ? `<script>(function(){
           var panels = Array.prototype.slice.call(document.querySelectorAll('[data-ai-cutout-panel], [data-visible-records-panel]'));
           if (!panels.length) return;
           var buttons = [];
           panels.forEach(function(panel){
             buttons = buttons.concat(Array.prototype.slice.call(panel.querySelectorAll('[data-adopt-candidate][data-adopt-endpoint]')));
           });
           var status = document.querySelector('[data-adopt-candidate-status]');
           var setStatus = function(message, isError) {
             if (!status) return;
             status.hidden = false;
             status.textContent = message;
             status.classList.toggle('is-error', Boolean(isError));
           };
           buttons.forEach(function(button){
             button.addEventListener('click', function(){
               var endpoint = button.getAttribute('data-adopt-endpoint');
               if (!endpoint) return;
               buttons.forEach(function(item){ item.disabled = true; });
               var original = button.textContent;
               button.textContent = '記録しています…';
                setStatus(${JSON.stringify(`この${mediaSceneNoun(mediaContext)}に写っているものとして記録しています。`)}, false);
               fetch(endpoint, {
                 method: 'POST',
                 headers: { accept: 'application/json' },
                 credentials: 'same-origin',
               })
               .then(function(response){
                 return response.json().then(function(json){ return { ok: response.ok && json && json.ok, json: json }; });
               })
               .then(function(result){
                 if (!result.ok) {
                   throw new Error(String((result.json && result.json.error) || 'candidate_record_failed'));
                 }
                 setStatus('記録に反映しました。対象を開きます。', false);
                 var occurrenceId = String(result.json.occurrenceId || '');
                 var visitId = String(result.json.visitId || ${JSON.stringify(bundle.visitId)});
                 var next = ${JSON.stringify(appendLangToHref(withBasePath(basePath, `/observations/${encodeURIComponent(bundle.visitId)}`), lang))};
                 if (occurrenceId) {
                   next = ${JSON.stringify(withBasePath(basePath, "/observations/"))} + encodeURIComponent(visitId) + '?subject=' + encodeURIComponent(occurrenceId) + ${JSON.stringify(lang === "ja" ? "&lang=ja" : lang === "en" ? "&lang=en" : "")};
                 }
                 setTimeout(function(){ window.location.href = next; }, 550);
               })
               .catch(function(error){
                 button.textContent = original;
                 buttons.forEach(function(item){ item.disabled = false; });
                 setStatus('記録に反映できませんでした: ' + String(error && error.message || 'network'), true);
               });
             });
           });
         })();</script>`
      : "";
    const identifyScript = `<script>(function(){
      var bindAiReviewPanels = function(){
        Array.prototype.slice.call(document.querySelectorAll('[data-ai-review-panel]')).forEach(function(panel){
          if (panel.getAttribute('data-ai-review-bound') === '1') return;
          panel.setAttribute('data-ai-review-bound', '1');
          var endpoint = panel.getAttribute('data-ai-review-endpoint') || '';
          var status = panel.querySelector('[data-ai-review-status]');
          var setStatus = function(message, isError) {
            if (!status) return;
            status.textContent = message;
            status.classList.toggle('is-error', Boolean(isError));
          };
          panel.querySelectorAll('[data-ai-review-state]').forEach(function(button){
            button.addEventListener('click', function(){
              var reviewState = button.getAttribute('data-ai-review-state') || '';
              if (!endpoint || !reviewState) return;
              setStatus('保存中...', false);
              fetch(endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ reviewState: reviewState }),
              })
              .then(function(response) {
                return response.json().then(function(json) { return { ok: response.ok && json && json.ok !== false, json: json }; });
              })
              .then(function(result) {
                if (!result.ok) {
                  setStatus('保存できませんでした: ' + String((result.json && result.json.error) || 'unknown_error'), true);
                  return;
                }
                setStatus('保存しました。表示を更新します。', false);
                setTimeout(function(){ window.location.reload(); }, 650);
              })
              .catch(function(error) {
                setStatus('通信エラー: ' + String(error && error.message || 'network'), true);
              });
            });
          });
        });
      };
      var bindIdentifyForms = function(){
        Array.prototype.slice.call(document.querySelectorAll('[data-identify-form]')).forEach(function(form){
          if (form.getAttribute('data-identify-bound') === '1') return;
          form.setAttribute('data-identify-bound', '1');
          var status = form.querySelector('[data-identify-status]');
          var setStatus = function(message, isError) {
            if (!status) return;
            status.textContent = message;
            status.classList.toggle('is-error', Boolean(isError));
          };
          var submit = function(action) {
            var data = new FormData(form);
            var proposedName = String(data.get('proposedName') || '').trim();
            var proposedRank = String(data.get('proposedRank') || '').trim();
            var notes = String(data.get('notes') || '').trim();
            var referenceSourceIds = Array.prototype.slice.call(form.querySelectorAll('input[name="referenceSourceIds"]:checked')).map(function(input){ return input.value; }).filter(Boolean);
            var referenceLocator = String(data.get('referenceLocator') || '').trim();
            var identifyEndpoint = form.getAttribute('data-identify-endpoint') || '';
            var disputeEndpoint = form.getAttribute('data-dispute-endpoint') || '';
            var isAlternative = action === 'alternative';
            var isNeedsEvidence = action === 'needs_more_evidence';
            if (!isNeedsEvidence && !proposedName) {
              setStatus('名前を入れてください。証拠不足だけを伝える場合は「証拠が足りない」を使えます。', true);
              return;
            }
            var endpoint = isAlternative || isNeedsEvidence ? disputeEndpoint : identifyEndpoint;
            var body = isAlternative
              ? { kind: 'alternative_id', proposedName: proposedName, proposedRank: proposedRank, reason: notes }
              : isNeedsEvidence
                ? { kind: 'needs_more_evidence', reason: notes || '証拠が足りない' }
                : { proposedName: proposedName, proposedRank: proposedRank, notes: notes, stance: 'support', referenceSourceIds: referenceSourceIds, referenceLocator: referenceLocator };
            setStatus('保存中...', false);
            fetch(endpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(body),
            })
            .then(function(response) {
              return response.json().then(function(json) { return { ok: response.ok && json && json.ok !== false, json: json }; });
            })
            .then(function(result) {
              if (!result.ok) {
                setStatus('保存できませんでした: ' + String((result.json && result.json.error) || 'unknown_error'), true);
                return;
              }
              setStatus('保存しました。表示を更新します。', false);
              setTimeout(function(){ window.location.reload(); }, 700);
            })
            .catch(function(error) {
              setStatus('通信エラー: ' + String(error && error.message || 'network'), true);
            });
          };
          form.querySelectorAll('[data-identify-action]').forEach(function(button) {
            button.addEventListener('click', function() {
              submit(button.getAttribute('data-identify-action') || 'support');
            });
          });
        });
      };
      var bindProposalQuickActions = function(){
        Array.prototype.slice.call(document.querySelectorAll('[data-proposal-focus]')).forEach(function(button){
          if (button.getAttribute('data-proposal-focus-bound') === '1') return;
          button.setAttribute('data-proposal-focus-bound', '1');
          button.addEventListener('click', function(){
            var action = button.getAttribute('data-proposal-focus') || 'support';
            var panel = button.closest('[data-obs-switch-identify]') || document;
            var fold = panel.querySelector('.obs-identify-fold');
            if (fold) fold.setAttribute('open', 'open');
            var form = panel.querySelector('[data-identify-form]');
            if (!form) return;
            var status = form.querySelector('[data-identify-status]');
            var targetButton = form.querySelector('[data-identify-action="' + action + '"]');
            if (status) {
              status.classList.remove('is-error');
              status.textContent = action === 'support'
                ? '名前と理由を入れて「この名前だと思う」で保存できます。'
                : action === 'alternative'
                  ? '別の名前と理由を入れて保存できます。'
                  : '見えにくい部分や足りない写真を理由メモに残せます。';
            }
            var focusTarget = action === 'needs_more_evidence'
              ? form.querySelector('textarea[name="notes"]')
              : form.querySelector('input[name="proposedName"]');
            if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus({ preventScroll: false });
            if (targetButton) {
              targetButton.classList.add('is-annotation-focus');
              window.setTimeout(function(){ targetButton.classList.remove('is-annotation-focus'); }, 1200);
            }
          });
        });
      };
      bindAiReviewPanels();
      bindIdentifyForms();
      bindProposalQuickActions();
      window.addEventListener('ikimon:identify-panel-replaced', bindAiReviewPanels);
      window.addEventListener('ikimon:identify-panel-replaced', bindIdentifyForms);
      window.addEventListener('ikimon:identify-panel-replaced', bindProposalQuickActions);
    })();</script>`;
    const photoRecoveryScript = renderObservationPhotoRecoveryScript(isOwner);
    const ownerDeleteScript = renderObservationOwnerDeleteScript(isOwner);
    const readingFlow = `<div class="obs-reading-flow">${summaryBlock}${supportBlock}${layer1}${focusRailBlock}${hintBlock}${layer2}${aiCandidateLearningBlock}${layer3}${contextBlock}${ctaBlock}</div>`;
    void hintBlock;
    void identifyBlock;
    void regionalStoryBlock;
    void layer6;
    const detailBody = `${heroBlock}${readProgressBlock}${ownerToolsBlock}${invasiveReportingGuidanceBlock}${readingFlow}<div hidden>${subjectTemplates}</div>${switchScript}${annotationScript}${photoRecoveryScript}${ownerDeleteScript}${reassessScript}${candidateAdoptionScript}${identifyScript}${galleryScript}`;

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${recordTitle} | ikimon`,
      detailBody,
      "みつける",
      undefined,
      OBSERVATION_DETAIL_STYLES,
      buildObservationDetailPath(bundle.visitId, bundle.canonicalSubjectId),
      false,
      "shell-observation-detail",
      lang,
    );
  });

  app.get<{ Params: { userId: string } }>("/guest/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (!request.params.userId.startsWith("guest_")) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Guest record not found", stateCard("Guest 記録なし", "この Guest 記録は見つかりません", "Guest 記録のURLではない、または記録が非公開の可能性があります。"), "ホーム");
    }
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Guest record not found", stateCard("Guest 記録なし", "この Guest 記録は見つかりません", "リンクが古い、または公開できる観察がまだありません。"), "ホーム");
    }
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} notebook | ikimon`,
      renderProfileSnapshotBody(basePath, lang, viewerSession?.userId ?? null, snapshot, "guest"),
      "ホーム",
      {
        eyebrow: "Guest observer",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: "匿名の観察者が残した、最近の場所と観察の記録。",
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このGuestのホームを見る" },
        ],
      },
      PLACE_REVISIT_ROW_STYLES,
      appendLangToHref(withBasePath(basePath, `/guest/${encodeURIComponent(request.params.userId)}`), lang),
    );
  });

  app.get<{ Params: { userId: string } }>("/profile/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (request.params.userId.startsWith("guest_")) {
      const guestHref = appendLangToHref(withBasePath(basePath, `/guest/${encodeURIComponent(request.params.userId)}`), lang);
      return reply.redirect(guestHref, 302);
    }
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "このユーザーは見つかりません", "リンクが古い、または非公開の可能性があります。"), "ホーム");
    }
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      renderProfileSnapshotBody(basePath, lang, viewerSession?.userId ?? null, snapshot),
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "Observer",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: `この人の記録 — 最近の場所と観察を追う。`,
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このユーザーのホームを見る" },
        ],
      },
      PLACE_REVISIT_ROW_STYLES,
      appendLangToHref(withBasePath(basePath, `/profile/${encodeURIComponent(request.params.userId)}`), lang),
    );
  });

  app.get<{ Params: { placeId: string } }>("/places/:placeId/station", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const station = await getFixedPointStation(decodeURIComponent(request.params.placeId)).catch(() => null);
    if (!station) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "定点ページ | ikimon",
        stateCard("定点ページが見つかりません", "この場所の記録をまだ束ねられません", "観察詳細やマップから、同じ場所の再記録を作ると定点ページが育ちます。"),
        "記録",
        undefined,
        undefined,
        appendLangToHref(withBasePath(basePath, `/places/${encodeURIComponent(request.params.placeId)}/station`), lang),
      );
    }
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `定点ページ | ${station.place.name} | ikimon`,
      renderFixedPointStationBody(station, basePath),
      "記録",
      undefined,
      FIXED_POINT_STATION_STYLES,
      appendLangToHref(withBasePath(basePath, `/places/${encodeURIComponent(station.place.placeId)}/station`), lang),
    );
  });

  app.get("/profile", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return layout(
        basePath,
        "マイページ | ikimon",
        stateCard(
          "マイページ",
          "ログインすると、自分の記録史を読み返せます",
          `<p style="margin:0 0 12px">記録一覧を起点に、マイページでは、積み上げた時間、前より見えてきたこと、地域に残った手がかりを確認できます。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/login?redirect=/profile"))}">ログインしてマイページへ</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/register?redirect=/profile"))}">新しく登録する</a>
          </div>`,
        ),
        "ホーム",
        undefined,
        undefined,
        appendLangToHref(withBasePath(basePath, "/profile"), lang),
      );
    }
    const [snapshot, digest, referenceSummary] = await Promise.all([
      getProfileSnapshot(session.userId),
      getProfileNoteDigest(session.userId),
      getReferenceProfileSummary(session.userId).catch(() => null),
    ]);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "まだ公開できるプロフィールがありません", "記録として読めるページが増えると、ここに場所と学びの履歴が育ち始めます。"), "ホーム");
    }
    const regionalStories = (await Promise.all(snapshot.recentPlaces.slice(0, 3).map((place) => getRegionalStoryCue({
      surface: "profile",
      viewerUserId: session.userId,
      place: {
        placeId: place.placeId,
        placeName: place.placeName,
        municipality: place.municipality,
        latitude: place.latitude,
        longitude: place.longitude,
        allowPrecisePlaceLabel: true,
      },
      maxCards: 1,
    }).catch(() => null)))).filter((story): story is RegionalStoryCue => Boolean(story));
    const heroActions = [
      { href: "/records?view=mine", label: "記録一覧を見る" },
      { href: "/guide/outcomes", label: "ガイド成果を見る", variant: "secondary" as const },
      { href: "/records?view=places", label: "場所を見る", variant: "secondary" as const },
      { href: "/profile/settings", label: "プロフィール編集", variant: "secondary" as const },
      { href: "/logout", label: "ログアウト", variant: "secondary" as const },
    ];

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `マイページ | ${snapshot.displayName} | ikimon`,
      renderSelfProfileHub(basePath, lang, snapshot, digest, regionalStories, referenceSummary),
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "観察者",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: "あなたのマイページ。記録一覧を起点に、積み上げた歴史、学び、地域に残った手がかりを気持ちよく読み返します。",
        actions: heroActions,
      },
      PROFILE_HUB_STYLES,
      appendLangToHref(withBasePath(basePath, "/profile"), lang),
    );
  });

  app.get("/profile/settings", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return layout(
        basePath,
        "プロフィール編集 | ikimon",
        stateCard(
          "プロフィール編集",
          "プロフィール編集にはログインが必要です",
          `<div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/login?redirect=/profile/settings"))}">ログインする</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/profile"))}">マイページへ</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const snapshot = await getProfileSnapshot(session.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "プロフィール編集 | ikimon", stateCard("プロフィールなし", "編集できるプロフィールがありません", "記録を 1 つでも残すとプロフィールが育ち始めます。"), "ホーム");
    }
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "プロフィール編集 | ikimon",
      renderProfileSettingsForm(basePath, snapshot),
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "観察者",
        heading: "プロフィール編集",
        lead: "表示名、関心分野、自己紹介を整えて、マイページと公開プロフィールの文脈をそろえます。",
        actions: [
          { href: "/profile", label: "マイページへ戻る", variant: "secondary" as const },
          { href: "/record", label: "記録する" },
        ],
      },
      PROFILE_HUB_STYLES,
    );
  });

  app.get("/api/v1/specialist/me/authorities", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const access = await getReviewerAccessContext(session.userId, session.roleName, session.rankLabel);
      return {
        ok: true,
        globalRole: access.globalRole,
        hasSpecialistAccess: access.hasSpecialistAccess,
        authorities: access.activeAuthorities,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authorities_lookup_failed",
      };
    }
  });

  app.get("/api/v1/authority/recommendations/me", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const recommendations = await listAuthorityRecommendationsForUser(session.userId);
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/recommendations/pending", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = await assertSpecialistSession(session, session?.userId ?? "");
      const recommendations = await listPendingAuthorityRecommendationsForReviewer({
        actorUserId: resolvedSession.userId,
        actorRoleName: resolvedSession.roleName,
        actorRankLabel: resolvedSession.rankLabel,
      });
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/authorities/audit", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSpecialistAdminSession(session, session?.userId ?? "");
      const query = (typeof request.query === "object" && request.query ? request.query : {}) as Record<string, unknown>;
      const rawAction = typeof query.action === "string" ? query.action.trim() : "";
      const rawStatus = typeof query.status === "string" ? query.status.trim() : "";
      const recommendations = await listReviewerAuthorityAudit({
        subjectUserId: typeof query.subjectUserId === "string" ? query.subjectUserId.trim() : null,
        scopeTaxonName: typeof query.scopeTaxonName === "string" ? query.scopeTaxonName.trim() : null,
        action: (rawAction === "grant" || rawAction === "revoke" || rawAction === "update")
          ? rawAction as ReviewerAuthorityAuditAction
          : null,
        status: rawStatus === "active" || rawStatus === "revoked" ? rawStatus : null,
        limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
      });
      return {
        ok: true,
        audit: recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_audit_lookup_failed",
      };
    }
  });

  app.get("/authority/recommendations", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const authorityRecommendationCopy = getShortCopy<any>(lang, "specialist", "authorityRecommendations.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority recommendations",
        stateCard(
          "サインイン",
          "authority recommendation の申請にはサインインが必要です",
          `<p style="margin:0 0 12px">自分の学習証跡を積み上げて、分類群ごとの authority 候補として申請できます。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const recommendations = await listAuthorityRecommendationsForUser(session.userId);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority recommendations | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="row">
            <div>
              <div class="eyebrow">Self claim</div>
              <h2>authority 候補として申請する</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          <p class="meta">観察会・ウェビナー・論文・図鑑/雑誌などの学習証跡を添えて、自分の分類群スコープ recommendation を作成します。証跡だけでは自動昇格せず、同じ分類群 authority 保有者または運営の解決が必要です。</p>
          <form id="authority-recommendation-form" class="stack" style="margin-top:14px">
            <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Evidence type</span>
                <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">なし</option>
                  <option value="field_event">観察会</option>
                  <option value="webinar">ウェビナー</option>
                  <option value="literature">論文・文献</option>
                  <option value="reference_owned">図鑑・雑誌</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-10" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="どこで学び、何をベースに見分けているか"></textarea></label>
            <div class="actions">
              <button class="btn" type="submit">申請する</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の全文を読む</a>
            </div>
          </form>
          <div id="authority-recommendation-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">My recommendations</div><h2>自分の申請状況</h2></div></div>${renderAuthorityRecommendationCards(recommendations, { currentUserId: session.userId })}</section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('authority-recommendation-form');
        const status = document.getElementById('authority-recommendation-status');
        const setStatus = (html) => { status.innerHTML = html; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const evidenceType = String(data.get('evidenceType') || '').trim();
          const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
          const payload = {
            sourceKind: 'self_claim',
            scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
            scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
            scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
            evidence: evidenceType && evidenceTitle ? [{
              evidenceType,
              title: evidenceTitle,
              issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
              url: String(data.get('evidenceUrl') || '').trim() || null,
              notes: String(data.get('evidenceNotes') || '').trim() || null,
            }] : [],
          };
          if (!payload.scopeTaxonName) {
            setStatus('<div class="row"><div>scopeTaxonName は必須です。</div></div>');
            return;
          }
          setStatus('<div class="row"><div>Submitting recommendation...</div></div>');
          const response = await fetch(withBasePath('/api/v1/authority/recommendations'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await response.json();
          if (!response.ok || json.ok === false) {
            setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'authority_recommendation_create_failed') + '</div></div></div>');
            return;
          }
          setStatus('<div class="row"><div><strong>Recommendation created.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
          reloadSoon();
        });
      </script>`,
      "ホーム",
      {
        eyebrow: authorityRecommendationCopy.eyebrow,
        heading: authorityRecommendationCopy.heading,
        headingHtml: authorityRecommendationCopy.heading,
        lead: authorityRecommendationCopy.lead,
        actions: authorityRecommendationCopy.actions,
      },
    );
  });

  app.get("/specialist/id-workbench", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "専門家レビューの入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
          `<p style="margin:0 0 12px">レビュー queue と同定 workbench は、Admin / Analyst か、分類群 authority を持つ reviewer だけが入れます。制度の考え方と authority 候補になる道は説明ページにまとめています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const requestedLane = typeof request.query === "object" && request.query && "lane" in request.query
      ? String((request.query as Record<string, unknown>).lane || "")
      : "";
    const requestedOccurrenceId = typeof request.query === "object" && request.query && "occurrenceId" in request.query
      ? String((request.query as Record<string, unknown>).occurrenceId || "").trim()
      : "";
    const lane = requestedLane === "public-claim" || requestedLane === "expert-lane" ? requestedLane : "default";
    const reviewerUserId = session?.userId ?? "";
    const access = await getReviewerAccessContext(reviewerUserId, session?.roleName, session?.rankLabel);
    const snapshot = await getSpecialistSnapshot(lane, {
      userId: reviewerUserId,
      roleName: session?.roleName,
      rankLabel: session?.rankLabel,
    });
    const workbenchCopy = getShortCopy<any>(lang, "specialist", "idWorkbench.hero");
    const laneTitle =
      lane === "public-claim"
        ? workbenchCopy.publicClaim.heading
        : lane === "expert-lane"
          ? workbenchCopy.expertLane.heading
          : workbenchCopy.default.heading;
    const laneLead =
      lane === "public-claim"
        ? workbenchCopy.publicClaim.lead
        : lane === "expert-lane"
          ? workbenchCopy.expertLane.lead
          : workbenchCopy.default.lead;
    const scopeSummary = renderAuthoritySummaryChips(access.activeAuthorities);
    const scopeMeta = access.canManageAll
      ? `<div class="meta">Analyst / Admin は全分類群にアクセスできます。authority を付けると reviewer の担当範囲も絞れます。</div>`
      : `<div class="meta">表示中の queue は、あなたに付与された分類群 authority に一致する観察だけです。</div>`;
    const manageAuthorityAction = access.canManageAll
      ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>`
      : `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>`;
    const rows = snapshot.queue.map((item) => {
      const detailHref = withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId));
      const disputeLabel = (item.openDisputeCount ?? 0) > 0 ? ` · open dispute ${item.openDisputeCount}` : "";
      const claimRefLabel = (item.claimRefCount ?? 0) > 0 ? ` · claim refs ${item.claimRefCount}` : " · no claim refs";
      return `
      <div class="row specialist-queue-row" data-occurrence-id="${escapeHtml(item.occurrenceId)}" data-display-name="${escapeHtml(item.displayName)}">
        <div>
          <div style="font-weight:800">${escapeHtml(formatTaxonDisplayName(item, lang).primaryLabel)}</div>
          <div class="meta">${escapeHtml(formatPlaceDisplay(item, lang, "public"))} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(formatActorDisplay(item.observerName, lang))} · ${escapeHtml(item.municipality || "位置をぼかしています")}${escapeHtml(disputeLabel)}${escapeHtml(claimRefLabel)}</div>
        </div>
        <div class="actions">
          <span class="pill">${escapeHtml(formatIdentificationCount(item.identificationCount, lang))}</span>
          <button class="btn secondary" type="button" data-queue-action="approve">approve</button>
          <button class="btn secondary" type="button" data-queue-action="alternative">alternative</button>
          <button class="btn secondary" type="button" data-queue-action="needs_more_evidence">needs evidence</button>
          <a class="btn btn-ghost" href="${escapeHtml(detailHref)}">詳細</a>
        </div>
      </div>`;
    }).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${laneTitle} | ikimon`,
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">担当できる分類群</h2>
            </div>
            ${manageAuthorityAction}
          </div>
          ${scopeSummary}
          ${scopeMeta}
        </div></div></section>
      <section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal specialist action</h2>
          <form id="specialist-review-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "reviewer")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" value="${escapeHtml(requestedOccurrenceId)}" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Scientific or common name" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="どの根拠でこの同定にしたか"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="specialist-review-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Summary</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">unresolved occurrences / ${snapshot.summary.totalOccurrences} total</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Identifications</div><h2>${snapshot.summary.identificationCount}</h2><p class="meta">current identification rows in v2</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Observation photos</div><h2>${snapshot.summary.observationPhotoAssets}</h2><p class="meta">photo assets available for review</p></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Queue</div><h2>レビュー待ちの観察</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const lane = ${JSON.stringify(lane)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('specialist-review-form');
        const status = document.getElementById('specialist-review-status');
        const setStatus = (html) => { status.innerHTML = html; };
        const fillWorkbench = (occurrenceId, displayName, mode) => {
          form.elements.occurrenceId.value = occurrenceId || '';
          if (mode === 'alternative') {
            form.elements.proposedName.value = '';
            form.elements.notes.value = '別分類候補: ';
            form.elements.proposedName.focus();
            setStatus('<div class="row"><div>Alternative mode: 別分類名と根拠を入れて approve か note を選んでください。</div></div>');
            return;
          }
          form.elements.proposedName.value = displayName && displayName !== '同定待ち' ? displayName : '';
          form.elements.proposedRank.value = form.elements.proposedRank.value || 'species';
          if (mode === 'needs_more_evidence') {
            form.elements.notes.value = '証拠不足: 追加写真・形質情報が必要';
          }
        };
        document.querySelectorAll('[data-queue-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const row = button.closest('[data-occurrence-id]');
            const occurrenceId = row ? row.getAttribute('data-occurrence-id') : '';
            const displayName = row ? row.getAttribute('data-display-name') : '';
            const action = button.getAttribute('data-queue-action');
            if (!occurrenceId) return;
            if (action === 'alternative') {
              fillWorkbench(occurrenceId, displayName, 'alternative');
              return;
            }
            if (action === 'needs_more_evidence') {
              fillWorkbench(occurrenceId, displayName, 'needs_more_evidence');
              setStatus('<div class="row"><div>Opening needs-evidence dispute...</div></div>');
              const response = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(occurrenceId) + '/disputes'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ kind: 'needs_more_evidence', reason: '専門レビュー: 追加証拠が必要' }),
              });
              const json = await response.json();
              if (!response.ok || json.ok === false) {
                setStatus('<div class="row"><div>Needs-evidence failed.<div class="meta">' + String(json.error || 'dispute_submit_failed') + '</div></div></div>');
                return;
              }
              setStatus('<div class="row"><div><strong>Needs-evidence dispute opened.</strong><div class="meta">' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
              return;
            }
            fillWorkbench(occurrenceId, displayName, 'approve');
            form.querySelector('button[data-decision="approve"]').click();
          });
        });
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const proposedName = String(data.get('proposedName') || '').trim();
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            if (decision === 'approve' && !proposedName) {
              setStatus('<div class="row"><div>Approve には proposedName が必要です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting specialist review...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane, decision, proposedName, proposedRank, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            const scope = json.authorityScope && json.authorityScope.scopeTaxonName
              ? ' · ' + String(json.authorityScope.scopeTaxonName)
              : '';
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.reviewClass || 'plain_review') + scope + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: workbenchCopy.eyebrow,
        heading: laneTitle,
        headingHtml: escapeHtml(laneTitle),
        lead: laneLead,
        actions: workbenchCopy.actions,
      },
    );
  });

  app.get("/specialist/recommendations", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const recommendationsCopy = getShortCopy<any>(lang, "specialist", "recommendations.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    let resolvedSession;
    try {
      resolvedSession = await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "専門家推薦の入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
          `<p style="margin:0 0 12px">pending recommendation を解決できるのは、同じ分類群 scope の authority 保有者、または運営権限を持つアカウントです。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const access = await getReviewerAccessContext(
      resolvedSession.userId,
      resolvedSession.roleName,
      resolvedSession.rankLabel,
    );
    const pendingRecommendations = await listPendingAuthorityRecommendationsForReviewer({
      actorUserId: resolvedSession.userId,
      actorRoleName: resolvedSession.roleName,
      actorRankLabel: resolvedSession.rankLabel,
    });

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Specialist recommendations | ikimon",
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">解決できる分類群</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          ${renderAuthoritySummaryChips(access.activeAuthorities)}
          <div class="meta">${access.canManageAll ? "Admin / Analyst は全 pending recommendation を横断で確認できます。" : "自分の authority scope に一致する pending recommendation だけが表示されます。"}</div>
        </div></div></section>
      ${access.canManageAll
        ? `<section class="section"><div class="card"><div class="card-body">
            <div class="eyebrow">Ops registered</div>
            <h2>運営が pending recommendation を登録する</h2>
            <form id="ops-recommendation-form" class="stack" style="margin-top:14px">
              <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
                <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
                <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              </div>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
                <label class="stack"><span style="font-weight:700">Evidence type</span>
                  <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                    <option value="">なし</option>
                    <option value="field_event">観察会</option>
                    <option value="webinar">ウェビナー</option>
                    <option value="literature">論文・文献</option>
                    <option value="reference_owned">図鑑・雑誌</option>
                    <option value="other">その他</option>
                  </select>
                </label>
                <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-10" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              </div>
              <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="参加履歴・読んだ文献・保有資料など"></textarea></label>
              <div class="actions">
                <button class="btn" type="submit">Pending 登録</button>
                <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>
              </div>
            </form>
          </div></div></section>`
        : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">Pending queue</div><h2>解決待ち recommendation</h2></div></div>${renderAuthorityRecommendationCards(pendingRecommendations, { showGrantActions: true, canReject: access.canManageAll })}</section>
      <div id="specialist-recommendation-status" class="section"><div class="list"><div class="row"><div>Ready.</div></div></div></div>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const actorUserId = ${JSON.stringify(resolvedSession.userId)};
        const canReject = ${JSON.stringify(access.canManageAll)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const statusHost = document.getElementById('specialist-recommendation-status');
        const setStatus = (html) => { statusHost.innerHTML = '<div class="list">' + html + '</div>'; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };
        document.querySelectorAll('[data-grant-recommendation]').forEach((button) => {
          button.addEventListener('click', async () => {
            const recommendationId = button.getAttribute('data-grant-recommendation');
            const resolutionNote = window.prompt('Grant note (optional)', '') || null;
            if (!recommendationId) return;
            setStatus('<div class="row"><div>Granting recommendation...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/recommendations/' + encodeURIComponent(recommendationId) + '/grant'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, resolutionNote }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Grant failed.<div class="meta">' + String(json.error || 'authority_recommendation_grant_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Recommendation granted.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });
        if (canReject) {
          document.querySelectorAll('[data-reject-recommendation]').forEach((button) => {
            button.addEventListener('click', async () => {
              const recommendationId = button.getAttribute('data-reject-recommendation');
              const resolutionNote = window.prompt('Reject reason を入力してください', 'needs more evidence');
              if (!recommendationId || !resolutionNote) return;
              setStatus('<div class="row"><div>Rejecting recommendation...</div></div>');
              const response = await fetch(withBasePath('/api/v1/specialist/recommendations/' + encodeURIComponent(recommendationId) + '/reject'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ resolutionNote }),
              });
              const json = await response.json();
              if (!response.ok || json.ok === false) {
                setStatus('<div class="row"><div>Reject failed.<div class="meta">' + String(json.error || 'authority_recommendation_reject_failed') + '</div></div></div>');
                return;
              }
              setStatus('<div class="row"><div><strong>Recommendation rejected.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
              reloadSoon();
            });
          });
        }
        const opsForm = document.getElementById('ops-recommendation-form');
        if (opsForm) {
          opsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(opsForm);
            const evidenceType = String(data.get('evidenceType') || '').trim();
            const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
            const payload = {
              sourceKind: 'ops_registered',
              subjectUserId: String(data.get('subjectUserId') || '').trim(),
              scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
              scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
              scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
              evidence: evidenceType && evidenceTitle ? [{
                evidenceType,
                title: evidenceTitle,
                issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
                url: String(data.get('evidenceUrl') || '').trim() || null,
                notes: String(data.get('evidenceNotes') || '').trim() || null,
              }] : [],
            };
            if (!payload.subjectUserId || !payload.scopeTaxonName) {
              setStatus('<div class="row"><div>subjectUserId と scopeTaxonName は必須です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Creating pending recommendation...</div></div>');
            const response = await fetch(withBasePath('/api/v1/authority/recommendations'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Create failed.<div class="meta">' + String(json.error || 'authority_recommendation_create_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Pending recommendation created.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        }
      </script>`,
      "ホーム",
      {
        eyebrow: recommendationsCopy.eyebrow,
        heading: recommendationsCopy.heading,
        headingHtml: recommendationsCopy.heading,
        lead: recommendationsCopy.lead,
        actions: recommendationsCopy.actions,
      },
    );
  });

  app.get("/specialist/authority-audit", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const auditCopy = getShortCopy<any>(lang, "specialist", "authorityAudit.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistAdminSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority audit required",
        stateCard(
          "Admin only",
          "authority 監査ログは Analyst / Admin 専用です",
          `<p style="margin:0 0 12px">grant / revoke / update の痕跡は一般公開せず、運営が追跡できる面に閉じています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin へ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const query = (typeof request.query === "object" && request.query ? request.query : {}) as Record<string, unknown>;
    const subjectUserId = typeof query.subjectUserId === "string" ? query.subjectUserId.trim() : "";
    const scopeTaxonName = typeof query.scopeTaxonName === "string" ? query.scopeTaxonName.trim() : "";
    const action = typeof query.action === "string" ? query.action.trim() : "";
    const status = typeof query.status === "string" ? query.status.trim() : "";
    const audit = await listReviewerAuthorityAudit({
      subjectUserId: subjectUserId || null,
      scopeTaxonName: scopeTaxonName || null,
      action: action === "grant" || action === "revoke" || action === "update" ? action as ReviewerAuthorityAuditAction : null,
      status: status === "active" || status === "revoked" ? status : null,
      limit: typeof query.limit === "string" ? Number(query.limit) : 60,
    });

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority audit | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="row">
            <div>
              <div class="eyebrow">Filters</div>
              <h2>grant / revoke / update を追う</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          <form class="stack" method="get" action="${escapeHtml(withBasePath(basePath, "/specialist/authority-audit"))}" style="margin-top:14px">
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" value="${escapeHtml(subjectUserId)}" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" value="${escapeHtml(scopeTaxonName)}" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Action</span>
                <select name="action" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">all</option>
                  <option value="grant"${action === "grant" ? " selected" : ""}>grant</option>
                  <option value="update"${action === "update" ? " selected" : ""}>update</option>
                  <option value="revoke"${action === "revoke" ? " selected" : ""}>revoke</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Status</span>
                <select name="status" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">all</option>
                  <option value="active"${status === "active" ? " selected" : ""}>active</option>
                  <option value="revoked"${status === "revoked" ? " selected" : ""}>revoked</option>
                </select>
              </label>
            </div>
            <div class="actions">
              <button class="btn" type="submit">絞り込む</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>
            </div>
          </form>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Recent-first</div><h2>authority audit</h2></div></div>${renderAuthorityAuditCards(audit)}</section>`,
      "ホーム",
      {
        eyebrow: auditCopy.eyebrow,
        heading: auditCopy.heading,
        headingHtml: auditCopy.heading,
        lead: auditCopy.lead,
        actions: auditCopy.actions,
      },
    );
  });

  app.get("/specialist/authority-admin", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const authorityAdminCopy = getShortCopy<any>(lang, "specialist", "authorityAdmin.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistAdminSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority admin required",
        stateCard(
          "Admin only",
          "authority 管理は Analyst / Admin 専用です",
          `<p style="margin:0 0 12px">grant / revoke / evidence 追加は運営権限を持つアカウントだけが実行できます。制度の考え方は公開ページにまとめています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">専門確認へ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const authorities = await listRecentReviewerAuthorities(24);

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority Admin | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Grant authority</div>
          <h2>分類群 authority を付与する</h2>
          <form id="authority-grant-form" class="stack" style="margin-top:14px">
            <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Reason</span><textarea name="reason" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="例: たんぽぽ観察会で見分け方実習を完了"></textarea></label>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Evidence type</span>
                <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">なし</option>
                  <option value="field_event">観察会</option>
                  <option value="webinar">ウェビナー</option>
                  <option value="literature">論文・文献</option>
                  <option value="reference_owned">図鑑・雑誌</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-01" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="2" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="アフィリエイト URL などは sourcePayload 側に後から追記可能"></textarea></label>
            <div class="actions">
              <button class="btn" type="submit">Grant</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-audit"))}">Audit を見る</a>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">専門確認へ戻る</a>
            </div>
          </form>
          <div id="authority-admin-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Recent authorities</div><h2>最近の grant / revoke</h2></div></div>${renderAuthorityCards(authorities)}</section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('authority-grant-form');
        const status = document.getElementById('authority-admin-status');
        const setStatus = (html) => { status.innerHTML = html; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const evidenceType = String(data.get('evidenceType') || '').trim();
          const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
          const payload = {
            subjectUserId: String(data.get('subjectUserId') || '').trim(),
            scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
            scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
            scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
            reason: String(data.get('reason') || '').trim() || null,
            evidence: evidenceType && evidenceTitle ? [{
              evidenceType,
              title: evidenceTitle,
              issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
              url: String(data.get('evidenceUrl') || '').trim() || null,
              notes: String(data.get('evidenceNotes') || '').trim() || null,
            }] : [],
          };
          if (!payload.subjectUserId || !payload.scopeTaxonName) {
            setStatus('<div class="row"><div>subjectUserId と scopeTaxonName は必須です。</div></div>');
            return;
          }
          setStatus('<div class="row"><div>Granting authority...</div></div>');
          const response = await fetch(withBasePath('/api/v1/specialist/authorities/grant'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await response.json();
          if (!response.ok || json.ok === false) {
            setStatus('<div class="row"><div>Grant failed.<div class="meta">' + String(json.error || 'specialist_authority_grant_failed') + '</div></div></div>');
            return;
          }
          setStatus('<div class="row"><div><strong>Authority granted.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + ' → ' + String(json.authority && json.authority.subjectUserId || '') + '</div></div></div>');
          reloadSoon();
        });

        document.querySelectorAll('[data-revoke-authority]').forEach((button) => {
          button.addEventListener('click', async () => {
            const authorityId = button.getAttribute('data-revoke-authority');
            const reason = window.prompt('Revoke reason を入力してください', 'scope review completed');
            if (!authorityId || !reason) return;
            setStatus('<div class="row"><div>Revoking authority...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/authorities/' + encodeURIComponent(authorityId) + '/revoke'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ reason }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Revoke failed.<div class="meta">' + String(json.error || 'specialist_authority_revoke_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Authority revoked.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });

        document.querySelectorAll('[data-add-evidence]').forEach((button) => {
          button.addEventListener('click', async () => {
            const authorityId = button.getAttribute('data-add-evidence');
            const evidenceType = window.prompt('Evidence type: field_event / webinar / literature / reference_owned / other', 'field_event');
            if (!authorityId || !evidenceType) return;
            const title = window.prompt('Evidence title', '');
            if (!title) return;
            const issuerName = window.prompt('Issuer name (optional)', '') || null;
            const url = window.prompt('URL (optional)', '') || null;
            const notes = window.prompt('Notes (optional)', '') || null;
            setStatus('<div class="row"><div>Adding evidence...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/authorities/' + encodeURIComponent(authorityId) + '/evidence'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ evidenceType, title, issuerName, url, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Evidence add failed.<div class="meta">' + String(json.error || 'specialist_authority_evidence_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Evidence added.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: authorityAdminCopy.eyebrow,
        heading: authorityAdminCopy.heading,
        headingHtml: authorityAdminCopy.heading,
        lead: authorityAdminCopy.lead,
        actions: authorityAdminCopy.actions,
      },
    );
  });

  app.get("/specialist/review-queue", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const reviewQueueCopy = getShortCopy<any>(lang, "specialist", "reviewQueue.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "レビューキューの入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
          `<p style="margin:0 0 12px">review-queue は broad triage 面ですが、閲覧できるのは Admin / Analyst か、分類群 authority を持つ reviewer だけです。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const reviewerUserId = session?.userId ?? "";
    const access = await getReviewerAccessContext(reviewerUserId, session?.roleName, session?.rankLabel);
    const snapshot = await getSpecialistSnapshot("review-queue", {
      userId: reviewerUserId,
      roleName: session?.roleName,
      rankLabel: session?.rankLabel,
    });
    const scopeSummary = renderAuthoritySummaryChips(access.activeAuthorities);
    const scopeMeta = access.canManageAll
      ? `<div class="meta">Analyst / Admin は全分類群の broad triage を確認できます。</div>`
      : `<div class="meta">review-queue でも、あなたの authority scope に一致する観察だけが表示されます。</div>`;
    const manageAuthorityAction = access.canManageAll
      ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>`
      : `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>`;
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">
        <div>
          <div style="font-weight:800">${escapeHtml(formatTaxonDisplayName(item, lang).primaryLabel)}</div>
          <div class="meta">${escapeHtml(formatPlaceDisplay(item, lang, "public"))} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(formatActorDisplay(item.observerName, lang))} · ${escapeHtml(formatIdentificationCount(item.identificationCount, lang))}</div>
        </div>
        <span class="pill">Open</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Review Queue | ikimon",
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">この queue で見える分類群</h2>
            </div>
            ${manageAuthorityAction}
          </div>
          ${scopeSummary}
          ${scopeMeta}
        </div></div></section>
      <section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal review action</h2>
          <form id="review-queue-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "reviewer")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Approve 時に必須" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="triage メモや差し戻し理由"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="review-queue-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section"><div class="grid">
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">Queue size</div><h2>${snapshot.queue.length}</h2><p class="meta">review shell に表示中の observation sample</p></div></div>
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">未同定</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">v2 全体で名前を確認中の観察</p></div></div>
      </div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Review sample</div><h2>レビュー対象</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('review-queue-form');
        const status = document.getElementById('review-queue-status');
        const setStatus = (html) => { status.innerHTML = html; };
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const proposedName = String(data.get('proposedName') || '').trim();
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            if (decision === 'approve' && !proposedName) {
              setStatus('<div class="row"><div>Approve には proposedName が必要です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting review action...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane: 'review-queue', decision, proposedName, proposedRank, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            const scope = json.authorityScope && json.authorityScope.scopeTaxonName
              ? ' · ' + String(json.authorityScope.scopeTaxonName)
              : '';
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.reviewClass || 'plain_review') + scope + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: reviewQueueCopy.eyebrow,
        heading: reviewQueueCopy.heading,
        headingHtml: reviewQueueCopy.heading,
        lead: reviewQueueCopy.lead,
        actions: reviewQueueCopy.actions,
      },
    );
  });

  /* -------------------------------------------------------------- */
  /* Field Note main entry (/notes) — user's own notebook           */
  /* -------------------------------------------------------------- */
  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = String((request as unknown as { url?: string }).url ?? "");
    const lang = detectLangFromUrl(rawUrl);
    const url = new URL(rawUrl, "https://ikimon.local");
    url.searchParams.delete("lang");
    const query = url.searchParams.toString();
    return reply.redirect(appendLangToHref(withBasePath(basePath, `/records?view=mine${query ? `&${query}` : ""}`), lang), 308);
    /*
    Legacy notes library renderer: canonical surface moved to /records.
    const copy = notesLibraryCopy(lang);
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getLandingSnapshot(viewerUserId);

    const isLoggedIn = Boolean(viewerUserId);
    const libraryEntries = isLoggedIn ? snapshot.myFeed : snapshot.feed;
    const nearbyEntries = isLoggedIn ? snapshot.feed.slice(0, 12) : [];
    const civicContexts = await listCivicObservationContexts([
      ...libraryEntries.map((obs) => obs.visitId),
      ...nearbyEntries.map((obs) => obs.visitId),
    ]);
    const uniquePlaces = new Set(libraryEntries.map((obs) => notesPlaceLine(obs, lang, isLoggedIn ? "owner" : "public")).filter(Boolean));
    const placeCount = isLoggedIn ? snapshot.myPlaces.length : uniquePlaces.size;
    const photoCount = libraryEntries.reduce((sum, obs) => sum + notesPhotoCount(obs), 0);
    const namedCount = libraryEntries.filter((obs) => !notesLibraryIsUncertain(obs)).length;
    const latest = libraryEntries[0] ?? null;
    const latestLine = latest
      ? `${notesLibraryDateLabel(latest, lang)} · ${latest.displayName || latest.proposedName || copy.card.fallbackName}`
      : copy.latestFallback;

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: copy.pageTitle,
      activeNav: copy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/notes"), lang),
      shellClassName: "shell-notes-library",
      extraStyles: NOTES_LIBRARY_STYLES,
      body: `<div class="notes-library-shell">
        <section class="notes-library-hero">
          <div>
            <span>${escapeHtml(copy.heroEyebrow)}</span>
            <h1>${escapeHtml(copy.heroTitle)}</h1>
            <p>${escapeHtml(copy.heroLead)}</p>
            <div class="notes-library-actions">
              <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.actions.record)}</a>
              <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/guide"), lang))}">${escapeHtml(copy.actions.guide)}</a>
              <a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/guide/outcomes"), lang))}">${escapeHtml(copy.actions.outcomes)}</a>
            </div>
          </div>
          <div class="notes-library-stats" aria-label="${escapeHtml(copy.statsAria)}">
            <div><strong>${escapeHtml(formatNotesNumber(libraryEntries.length, lang))}</strong><em>${escapeHtml(copy.stats.observations)}</em></div>
            <div><strong>${escapeHtml(formatNotesNumber(photoCount, lang))}</strong><em>${escapeHtml(copy.stats.photos)}</em></div>
            <div><strong>${escapeHtml(formatNotesNumber(namedCount, lang))}</strong><em>${escapeHtml(copy.stats.named)}</em></div>
          </div>
        </section>
        ${renderNotesExperienceLoop(basePath, lang)}
        <section id="notes-own" class="section notes-library-main" data-notes-library data-testid="notes-own">
          <div class="notes-library-section-head">
            <div><span>${escapeHtml(isLoggedIn ? copy.sections.ownEyebrow : copy.sections.publicEyebrow)}</span><h2>${escapeHtml(isLoggedIn ? copy.sections.ownTitle : copy.sections.publicTitle)}</h2></div>
            <p>${escapeHtml(latestLine)}</p>
          </div>
          ${renderNotesLibraryControls(libraryEntries.length, placeCount, lang)}
          ${renderNotesLibrarySourceLanes(libraryEntries, lang)}
          ${renderNotesLibraryMonths(basePath, lang, libraryEntries, { locationMode: isLoggedIn ? "owner" : "public", civicContexts })}
        </section>
        ${renderNotesLibraryPlaceAlbums(snapshot, lang)}
        <section id="notes-nearby" class="section notes-nearby-library" data-testid="notes-nearby">
          <div class="notes-library-section-head"><div><span>${escapeHtml(copy.sections.nearbyEyebrow)}</span><h2>${escapeHtml(copy.sections.nearbyTitle)}</h2></div><p>${escapeHtml(copy.sections.nearbyLead)}</p></div>
          ${nearbyEntries.length > 0
            ? renderNotesLibraryMonths(basePath, lang, nearbyEntries, { locationMode: "public", civicContexts })
            : `<div class="notes-library-empty">${escapeHtml(copy.nearbyEmpty)}</div>`}
        </section>
        ${renderNotesLibraryScript(lang)}
      </div>`,
      footerNote: copy.footerNote,
    });
    */
  });

  /* -------------------------------------------------------------- */
  /* AI Lens entry (/lens) — marketing + CTA into /record           */
  /* -------------------------------------------------------------- */
  app.get("/lens", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const lensPageCopy = getShortCopy<any>(lang, "public", "read.lens");
    const sharedCopy = getShortCopy<PublicSharedCopy>(lang, "shared", "publicShared");

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lensPageCopy.title,
      activeNav: lensPageCopy.activeNav,
      lang,
      hero: {
        eyebrow: lensPageCopy.hero.eyebrow,
        heading: lensPageCopy.hero.heading,
        headingHtml: lensPageCopy.hero.heading,
        lead: lensPageCopy.hero.lead,
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: sharedCopy.cta.record },
          { href: "/records?view=mine", label: sharedCopy.cta.openNotebook, variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          ${lensPageCopy.steps.map((step: { title: string; body: string }) => `<div class="row"><div><strong>${escapeHtml(step.title)}</strong><div class="meta">${escapeHtml(step.body)}</div></div></div>`).join("")}
        </div>
      </section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.guidanceCards as PublicRouteCard[], basePath, lang, "btn btn-solid")}</section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.followupCards as PublicRouteCard[], basePath, lang, "inline-link")}</section>`,
      footerNote: lensPageCopy.footerNote,
    });
  });

  /* -------------------------------------------------------------- */
  /* Map (/map) — full Map Explorer (tabs, filters, basemaps, xlinks)*/
  /* -------------------------------------------------------------- */
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapPageCopy = getShortCopy<any>(lang, "public", "read.map");

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: mapPageCopy.title,
      activeNav: mapPageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/map"), lang),
      shellClassName: "shell-bleed shell-map",
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: a map page should land on the map, not on
      // a wall of text. The explorer component carries a tight eyebrow
      // strip at the top so context is still one line away.
      // Footer is also hidden — it competes with the canvas for vertical
      // space and the user has confirmed it isn't useful here.
      hideFooter: true,
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: mapPageCopy.footerNote,
    });
  });

  app.get("/guide", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const guidePageCopy = getShortCopy<any>(lang, "public", "read.guide");
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: guidePageCopy.title,
      activeNav: guidePageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/guide"), lang),
      extraStyles: `${GUIDE_FLOW_STYLES}\n${GUIDE_ENTRY_STYLES}`,
      body: `${renderGuideFlow(basePath, lang)}${renderGuideLoopPanel(basePath, lang)}`,
      footerNote: guidePageCopy.footerNote,
    });
  });
}

// Keep the legacy mini map exports accessible so TypeScript doesn't mark them unused.
void MAP_MINI_STYLES;
void mapMiniBootScript;
void renderMapMini;
void toMapMiniCells;
void getLandingSnapshot;
