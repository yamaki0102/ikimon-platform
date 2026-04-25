import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { FieldLoopStrings, LandingStrings } from "../i18n/strings.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import type {
  LandingDailyCardKind,
  LandingObservation,
  LandingSnapshot,
} from "../services/readModels.js";
import { toThumbnailUrl, type ThumbnailPreset } from "../services/thumbnailUrl.js";
import { renderMapMini, toMapMiniCells } from "./mapMini.js";
import { escapeHtml } from "./siteShell.js";

export type LandingTopRenderOptions = {
  basePath: string;
  lang: SiteLang;
  copy: LandingStrings;
  fieldLoop: FieldLoopStrings;
  snapshot: LandingSnapshot;
  isLoggedIn: boolean;
};

export type LandingTopSections = {
  heroHtml: string;
  dailyDashboardHtml: string;
  linkBandHtml: string;
  flowSectionHtml: string;
  mapSectionHtml: string;
  librarySectionHtml: string;
  trustSectionHtml: string;
  communitySectionHtml: string;
  finalCtaHtml: string;
};

const DAILY_CARD_KPI_ACTIONS = {
  recordToday: "landing:daily:card:recordToday",
  revisitPlace: "landing:daily:card:revisitPlace",
  nearbyPulse: "landing:daily:card:nearbyPulse",
  needsId: "landing:daily:card:needsId",
} satisfies Record<LandingDailyCardKind, string>;

function localeForLang(lang: SiteLang): string {
  const localeMap: Record<SiteLang, string> = {
    ja: "ja-JP",
    en: "en-US",
    es: "es-ES",
    "pt-BR": "pt-BR",
  };
  return localeMap[lang];
}

function formatLandingObservedAt(lang: SiteLang, raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(localeForLang(lang), {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLandingNumber(copy: LandingStrings, value: number): string {
  return new Intl.NumberFormat(copy.numberLocale).format(value);
}

function landingHref(basePath: string, lang: SiteLang, href: string): string {
  return appendLangToHref(withBasePath(basePath, href), lang);
}

function observationDetailHref(basePath: string, lang: SiteLang, obs: LandingObservation): string {
  return appendLangToHref(
    withBasePath(
      basePath,
      buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
    ),
    lang,
  );
}

function observationPlaceLabel(obs: LandingObservation): string {
  return obs.publicLocation?.label || [obs.placeName, obs.municipality].filter(Boolean).join(" · ");
}

function landingObservationMeta(lang: SiteLang, obs: LandingObservation): string {
  return [observationPlaceLabel(obs), formatLandingObservedAt(lang, obs.observedAt)].filter(Boolean).join(" · ");
}

function displayObservationName(obs: LandingObservation | null | undefined, fallback: string): string {
  return obs?.displayName || obs?.aiCandidateName || fallback;
}

function uniqueLandingObservations(snapshot: LandingSnapshot): LandingObservation[] {
  const featured = snapshot.dailyDashboard?.featuredObservation ?? null;
  const observations = [featured, ...snapshot.myFeed, ...snapshot.feed]
    .filter((obs): obs is LandingObservation => Boolean(obs));
  return Array.from(new Map(observations.map((obs) => [obs.occurrenceId, obs])).values());
}

function observationImageUrl(obs: LandingObservation | null | undefined, preset: ThumbnailPreset): string | null {
  if (!obs?.photoUrl) return null;
  return toThumbnailUrl(obs.photoUrl, preset) ?? obs.photoUrl;
}

function renderObservationThumb(obs: LandingObservation, copy: LandingStrings, preset: ThumbnailPreset, eager = false): string {
  const imageUrl = observationImageUrl(obs, preset);
  if (!imageUrl) {
    return `<span class="prototype-feed-thumb is-empty" aria-hidden="true">ID</span>`;
  }
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(displayObservationName(obs, copy.heroPhotoFallback))}" loading="${eager ? "eager" : "lazy"}" decoding="async" />`;
}

function renderObservationEvidenceCard(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingObservation,
  kpiAction: string | null,
  size: "large" | "small",
): string {
  const href = observationDetailHref(basePath, lang, obs);
  const kpiAttr = kpiAction ? ` data-kpi-action="${escapeHtml(kpiAction)}"` : "";
  return `<a class="prototype-evidence-card prototype-evidence-${size}" href="${escapeHtml(href)}"${kpiAttr}>
    <small>${escapeHtml(landingObservationMeta(lang, obs) || copy.heroLatestLabel)}</small>
    <strong>${escapeHtml(displayObservationName(obs, copy.heroPhotoFallback))}</strong>
    <p>写真なしの観察です。場所、日時、同定状態を手がかりに詳細を確認できます。</p>
    <span>${obs.identificationCount > 0 ? `${escapeHtml(formatLandingNumber(copy, obs.identificationCount))}件の同定` : "同定待ち"}</span>
  </a>`;
}

function renderPhotoTile(
  basePath: string,
  lang: SiteLang,
  copy: LandingStrings,
  obs: LandingObservation,
  index: number,
  size: "large" | "small",
  fallbackTitle: string,
  fallbackLabel: string,
  kpiAction: string | null,
): string {
  const imageUrl = observationImageUrl(obs, size === "large" ? "lg" : "md");
  if (!imageUrl) return renderObservationEvidenceCard(basePath, lang, copy, obs, kpiAction, size);
  const href = observationDetailHref(basePath, lang, obs);
  const title = displayObservationName(obs, fallbackTitle);
  const label = landingObservationMeta(lang, obs) || fallbackLabel;
  const kpiAttr = kpiAction ? ` data-kpi-action="${escapeHtml(kpiAction)}"` : "";
  return `<a class="prototype-photo prototype-photo-${size}" href="${escapeHtml(href)}"${kpiAttr}>
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" />
    <span><small>${escapeHtml(label)}</small><strong>${escapeHtml(title)}</strong></span>
  </a>`;
}

function renderEmptyDailyState(basePath: string, lang: SiteLang, copy: LandingStrings): string {
  return `<div class="prototype-daily-empty" role="status">
    <small>${escapeHtml(copy.heroPhotoFallback)}</small>
    <strong>まだ公開できる観察がありません</strong>
    <p>トップではダミー写真を使いません。最初の記録が入るまでは、記録開始・地図・読み物への入口だけを表示します。</p>
    <div class="prototype-empty-actions">
      <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, "/record"))}" data-kpi-action="landing:daily:card:recordToday">${escapeHtml(copy.actionPrimaryGuest)}</a>
      <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/map"))}" data-kpi-action="landing:daily:card:nearbyPulse">${escapeHtml(copy.actionSecondary)}</a>
      <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:linkband:learn">読み物を見る</a>
    </div>
  </div>`;
}

function renderLandingHeroHtml(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot, isLoggedIn } = options;
  const featuredObservation = snapshot.dailyDashboard?.featuredObservation ?? null;
  const uniqueHeroPool = uniqueLandingObservations(snapshot);
  const photoObservation = featuredObservation?.photoUrl
    ? featuredObservation
    : uniqueHeroPool.find((obs) => Boolean(obs.photoUrl)) ?? null;
  const heroImage = observationImageUrl(photoObservation, "lg");
  const actionPrimaryHref = isLoggedIn ? "/notes" : "/record";

  const recentRows = uniqueHeroPool.slice(0, 3).map((obs, index) => {
    const href = observationDetailHref(basePath, lang, obs);
    const label = featuredObservation?.occurrenceId === obs.occurrenceId
      ? copy.heroReasonLabels[featuredObservation.reasonKey]
      : obs.isAiCandidate
        ? "AI 候補"
        : obs.identificationCount > 0
          ? "確認中"
          : "新着";
    return `<a class="prototype-feed-row" href="${escapeHtml(href)}" data-kpi-action="landing:hero:observation">
      ${renderObservationThumb(obs, copy, "sm", index === 0)}
      <span>
        <strong>${escapeHtml(displayObservationName(obs, copy.heroPhotoFallback))}</strong>
        <small>${escapeHtml(landingObservationMeta(lang, obs))}</small>
      </span>
      <em>${escapeHtml(label)}</em>
    </a>`;
  }).join("");

  const feedHtml = recentRows || `<div class="prototype-feed-empty">
    <strong>まだ公開できる観察がありません</strong>
    <small>記録が入るまでは、実写真もダミー写真も表示しません。</small>
    <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/record"))}" data-kpi-action="landing:hero:observation">最初の記録へ</a>
  </div>`;

  const heroMapClass = heroImage ? "prototype-hero-map" : "prototype-hero-map is-empty";
  const heroMapStyle = heroImage ? ` style="--hero-image:url('${escapeHtml(heroImage)}')"` : "";

  return `<section class="prototype-hero" aria-labelledby="landing-hero-heading">
    <div class="prototype-hero-copy">
      <div class="prototype-live-pill"><span></span>${escapeHtml(copy.heroDailyLabel)}</div>
      <h1 id="landing-hero-heading">${copy.heroHeading}</h1>
      <p>${escapeHtml(copy.heroLead)}</p>
      <div class="prototype-actions">
        <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, actionPrimaryHref))}" data-kpi-action="landing:hero:primary">${escapeHtml(isLoggedIn ? copy.actionPrimaryLoggedIn : "今日の記録を始める")}</a>
        <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/map"))}" data-kpi-action="landing:hero:map">近くの発見を見る</a>
      </div>
      <div class="prototype-stat-grid" aria-label="${escapeHtml(copy.heroStatsLabel)}">
        <div class="prototype-stat-card"><strong>証拠</strong><span>写真・音・場所・時刻を残す</span></div>
        <div class="prototype-stat-card"><strong>確認</strong><span>名前の候補と根拠を分ける</span></div>
        <div class="prototype-stat-card"><strong>安全</strong><span>希少種と個人情報に配慮</span></div>
      </div>
    </div>

    <div class="prototype-hero-visual" aria-label="自然観測画面のイメージ">
      <div class="${heroMapClass}"${heroMapStyle}></div>
      <div class="prototype-scan-line"></div>
      <div class="prototype-signal-stack">
        <div class="prototype-signal-card"><i>EV</i><div><strong>音の記録も証拠に</strong><span>鳥・虫の音も、あとから確かめる手がかりに</span></div></div>
        <div class="prototype-signal-card"><i>ID</i><div><strong>希少種位置を自動マスク</strong><span>公開範囲を安全側で制御</span></div></div>
      </div>
      <div class="prototype-hero-panel">
        <div class="prototype-observation-panel">
          <div class="prototype-panel-head"><span>${escapeHtml(copy.heroLatestLabel)}</span><span>更新中</span></div>
          ${feedHtml}
        </div>
        <div class="prototype-identify-panel">
          <div class="prototype-panel-head"><span>名前を確かめる流れ</span><span>${escapeHtml(formatLandingNumber(copy, uniqueHeroPool.reduce((sum, obs) => sum + obs.identificationCount, 0)))}件</span></div>
          <div class="prototype-name-steps">
            <div class="prototype-name-step"><b>1</b><span><strong>候補を見る</strong><small>写真や音から近い名前を並べる</small></span></div>
            <div class="prototype-name-step"><b>2</b><span><strong>特徴を比べる</strong><small>似た種類、季節、場所を確認する</small></span></div>
            <div class="prototype-name-step"><b>3</b><span><strong>人が確かめる</strong><small>根拠が残る記録として育てる</small></span></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderLandingDailyDashboard(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot } = options;
  const dashboard = snapshot.dailyDashboard;
  const observations = uniqueLandingObservations(snapshot);
  const featuredObservation = dashboard?.featuredObservation ?? observations[0] ?? null;
  const mainObservation = featuredObservation ?? observations[0] ?? null;
  const seasonal = dashboard?.seasonalStrip.map((item) => item.observation) ?? observations.slice(1, 5);
  const smallObservations = [...seasonal, ...observations].filter((obs, index, list) =>
    list.findIndex((candidate) => candidate.occurrenceId === obs.occurrenceId) === index
    && obs.occurrenceId !== mainObservation?.occurrenceId,
  ).slice(0, 4);
  const topSmallTiles = smallObservations.slice(0, 2).map((obs, index) =>
    renderPhotoTile(basePath, lang, copy, obs, index + 1, "small", copy.heroPhotoFallback, "近くの記録", null),
  ).join("");
  const bottomSmallTiles = smallObservations.slice(2, 4).map((obs, index) =>
    renderPhotoTile(basePath, lang, copy, obs, index + 3, "small", copy.heroPhotoFallback, "再訪候補", null),
  ).join("");

  const dailyCards = dashboard?.dailyCards ?? [];
  const dailyCardsHtml = dailyCards.slice(0, 4).map((card) => {
    const cardCopy = copy.dailyDashboard.cards[card.kind];
    const href = card.observation
      ? observationDetailHref(basePath, lang, card.observation)
      : landingHref(basePath, lang, card.href);
    const metricHtml = card.metricValue !== null && card.metricValue !== undefined
      ? `<span><strong>${escapeHtml(formatLandingNumber(copy, card.metricValue))}</strong>${escapeHtml(cardCopy.metricLabel)}</span>`
      : "";
    return `<a class="prototype-daily-card" href="${escapeHtml(href)}" data-kpi-action="${escapeHtml(DAILY_CARD_KPI_ACTIONS[card.kind])}">
      <small>${escapeHtml(cardCopy.eyebrow)}</small>
      <strong>${escapeHtml(card.primaryText ?? cardCopy.title)}</strong>
      <p>${escapeHtml(card.secondaryText ?? cardCopy.body)}</p>
      ${metricHtml}
      <em>${escapeHtml(cardCopy.cta)}</em>
    </a>`;
  }).join("");

  const mainContentHtml = mainObservation
    ? `<div class="prototype-daily-grid">
      ${renderPhotoTile(basePath, lang, copy, mainObservation, 0, "large", "今日の注目記録", copy.heroPhotoFallback, "landing:daily:featured")}
      <div class="prototype-daily-side">
        ${topSmallTiles ? `<div class="prototype-photo-row">${topSmallTiles}</div>` : ""}
        <div class="prototype-thought-card">
          <small>記録の考え方</small>
          <strong>完璧な投稿より、あとで確かめられる証拠を残す。</strong>
          <p>写真、音、位置、季節、環境メモを組み合わせることで、観察の根拠をあとから確かめやすくなる。</p>
        </div>
        ${bottomSmallTiles ? `<div class="prototype-photo-row">${bottomSmallTiles}</div>` : ""}
      </div>
    </div>`
    : renderEmptyDailyState(basePath, lang, copy);

  return `<section class="prototype-section" id="record">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">${escapeHtml(copy.dailyDashboard.eyebrow)}</div>
        <h2>${escapeHtml(copy.dailyDashboard.title)}</h2>
      </div>
      <p>${escapeHtml(copy.dailyDashboard.lead)}</p>
    </div>
    ${mainContentHtml}
    ${dailyCardsHtml ? `<div class="prototype-daily-card-grid">${dailyCardsHtml}</div>` : ""}
  </section>`;
}

function renderLinkBand(basePath: string, lang: SiteLang): string {
  return `<aside class="prototype-link-band" aria-label="既存ページへの導線">
    <i>READ</i>
    <div>
      <strong>はじめてなら、観察の考え方から読めます。</strong>
      <span>読み物、よくある質問、更新情報、事業・研究向けページへつながります。</span>
    </div>
    <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:linkband:learn">読み物を見る</a>
  </aside>`;
}

function renderFlowSection(fieldLoop: FieldLoopStrings): string {
  return `<section class="prototype-section" aria-labelledby="prototype-flow-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">${escapeHtml(fieldLoop.eyebrow)}</div>
        <h2 id="prototype-flow-heading">${escapeHtml(fieldLoop.title)}</h2>
      </div>
      <p>${escapeHtml(fieldLoop.lead)}</p>
    </div>
    <div class="prototype-flow-grid">
      ${fieldLoop.steps.slice(0, 3).map((step, index) => `<article class="prototype-flow-card">
        <div class="prototype-flow-body">
          <i>${escapeHtml(["REC", "MAP", "ID"][index] ?? "GO")}</i>
          <h3>${escapeHtml(step.title.replace(/^\d+\.\s*/, ""))}</h3>
          <p>${escapeHtml(step.body)}</p>
        </div>
        <div class="prototype-flow-num">${String(index + 1).padStart(2, "0")}</div>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderMapSection(options: LandingTopRenderOptions): string {
  const { basePath, lang, copy, snapshot } = options;
  const mapHref = landingHref(basePath, lang, "/map");
  const mapCells = toMapMiniCells(snapshot.mapPreviewCells, mapHref);

  return `<section class="prototype-map-section" id="map" aria-labelledby="prototype-map-heading">
    <div class="prototype-map-copy">
      <div class="prototype-map-step"><b>04</b><span class="prototype-eyebrow">${escapeHtml(copy.mapSectionEyebrow)}</span></div>
      <h2 id="prototype-map-heading">${escapeHtml(copy.mapSectionTitle)}</h2>
      <p>${escapeHtml(copy.mapSectionLead)}</p>
      <div class="prototype-map-points">
        <a href="${escapeHtml(landingHref(basePath, lang, "/map"))}" data-kpi-action="landing:map:open"><i>RT</i><span><strong>また同じ場所へ行く</strong><small>季節や個体数の変化を残す</small></span></a>
        <a href="${escapeHtml(landingHref(basePath, lang, "/explore"))}"><i>LY</i><span><strong>場所ごとの発見を重ねる</strong><small>水辺、林、街路樹を比較できる</small></span></a>
        <a href="${escapeHtml(landingHref(basePath, lang, "/record"))}"><i>NX</i><span><strong>次の観察地点を見つける</strong><small>多い場所と少ない場所を見返せる</small></span></a>
      </div>
    </div>
    <div class="prototype-map-board">
      ${renderMapMini({
        cells: mapCells,
        mapHref,
        mapCtaLabel: copy.mapCta,
        mapCtaKpiAction: "landing:map:open",
        emptyLabel: copy.mapEmpty,
        height: 420,
      })}
    </div>
  </section>`;
}

function renderLibrarySection(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-section" id="learn" aria-labelledby="prototype-learn-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">読み物と案内</div>
        <h2 id="prototype-learn-heading">迷った時に、すぐ深められる。</h2>
      </div>
      <p>トップで体験を伝え、既存の読み物・よくある質問・更新情報へ自然につなぐ。新規ユーザーは理解し、継続ユーザーは変化を追える。</p>
    </div>
    <div class="prototype-library-grid">
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn"))}" data-kpi-action="landing:library:learn"><i>BK</i><h3>読み物の入口</h3><p>ikimon.life の考え方、観察の流れ、用語、方法論をまとめて読める入口。</p><span>読み物へ</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn/identification-basics"))}" data-kpi-action="landing:library:identification"><i>ID</i><h3>名前を確かめる基本</h3><p>名前の候補、似た種類、根拠の残し方を、はじめての人にも分かる形で案内する。</p><span>名前の調べ方へ</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/faq"))}" data-kpi-action="landing:library:faq"><i>QA</i><h3>よくある質問</h3><p>投稿、公開範囲、位置情報、名前の確認、研究利用で迷いやすい点を先回りして解消する。</p><span>質問を見る</span></a>
      <a class="prototype-library-card" href="${escapeHtml(landingHref(basePath, lang, "/learn/updates"))}" data-kpi-action="landing:library:updates"><i>UP</i><h3>更新情報</h3><p>機能追加、見せ方の改善、公開範囲の変更など、サービスの変化を追える場所。</p><span>更新を見る</span></a>
    </div>
  </section>`;
}

function renderTrustSection(): string {
  return `<section class="prototype-section" aria-labelledby="prototype-trust-heading">
    <div class="prototype-section-head">
      <div>
        <div class="prototype-eyebrow">信頼と安全</div>
        <h2 id="prototype-trust-heading">自然も人も、守れる公開へ。</h2>
      </div>
      <p>地域の自然記録は、残すほど価値が出る。一方で、希少種や個人の行動履歴は扱いを間違えると危険になる。公開範囲は安全側で設計する。</p>
    </div>
    <div class="prototype-trust-grid">
      <article><i>SAFE</i><h3>希少種の位置をぼかす</h3><p>保護上配慮が必要な生きものは、詳しい位置をそのまま公開しない。発見の喜びと保全を両立する。</p></article>
      <article><i>PROOF</i><h3>名前の根拠を残す</h3><p>誰が、どの根拠で、どの程度の確信を持って名前を提案したかを分けて扱う。</p></article>
      <article><i>DATA</i><h3>研究に使いやすくする</h3><p>観察、場所、時刻、証拠写真を整理し、あとから地域調査や教育活動で参照しやすくする。</p></article>
    </div>
  </section>`;
}

function renderCommunitySection(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-community" aria-labelledby="prototype-community-heading">
    <div>
      <div class="prototype-eyebrow">地域で使う</div>
      <h2 id="prototype-community-heading">個人の発見を、地域の知へ。</h2>
      <p>ikimon.life は、投稿を集めるだけの場所ではなく、地域の自然を見つけ、確かめ、残し、また歩くための基盤。個人、学校、研究者、自治体が同じ記録を別の視点で参照しやすくする。</p>
      <div class="prototype-actions">
        <a class="prototype-btn prototype-btn-primary" href="${escapeHtml(landingHref(basePath, lang, "/community"))}" data-kpi-action="landing:community:community">コミュニティを見る</a>
        <a class="prototype-btn prototype-btn-secondary" href="${escapeHtml(landingHref(basePath, lang, "/for-business"))}" data-kpi-action="landing:community:business">事業向けを見る</a>
      </div>
    </div>
    <div class="prototype-use-grid">
      <article><strong>個人の図鑑</strong><span>自分が見つけた生きものを、場所と季節で見返す。</span></article>
      <article><strong>学校の観察</strong><span>校区や遠足先で見つけた自然を、授業後も残す。</span></article>
      <article><strong>研究の入口</strong><span>市民の記録を、地域調査の手がかりにする。</span></article>
      <article><strong>地域の記憶</strong><span>まちの自然の変化を、次の世代へ渡せる形で残す。</span></article>
    </div>
  </section>`;
}

function renderFinalCta(basePath: string, lang: SiteLang): string {
  return `<section class="prototype-cta">
    <div>
      <h2>今日の散歩を、自然記録に。</h2>
      <p>特別な調査ではなく、いつもの道で見つけた一枚から。名前が分からなくても、記録はあとから育てられる。</p>
    </div>
    <a class="prototype-btn prototype-btn-dark" href="${escapeHtml(landingHref(basePath, lang, "/record"))}" data-kpi-action="landing:cta:record">記録する</a>
  </section>`;
}

export function renderLandingTopSections(options: LandingTopRenderOptions): LandingTopSections {
  return {
    heroHtml: renderLandingHeroHtml(options),
    dailyDashboardHtml: renderLandingDailyDashboard(options),
    linkBandHtml: renderLinkBand(options.basePath, options.lang),
    flowSectionHtml: renderFlowSection(options.fieldLoop),
    mapSectionHtml: renderMapSection(options),
    librarySectionHtml: renderLibrarySection(options.basePath, options.lang),
    trustSectionHtml: renderTrustSection(),
    communitySectionHtml: renderCommunitySection(options.basePath, options.lang),
    finalCtaHtml: renderFinalCta(options.basePath, options.lang),
  };
}

export const LANDING_TOP_STYLES = `
  body {
    background:
      linear-gradient(90deg, rgba(16,185,129,.07) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.055) 1px, transparent 1px),
      linear-gradient(180deg, #ffffff 0%, #f9fffe 48%, #f2fbf7 100%);
    background-size: 48px 48px, 48px 48px, auto;
  }
  .site-header { background: rgba(255,255,255,.84); border-bottom-color: rgba(26,46,31,.08); }
  .site-header-inner { max-width: 1480px; min-height: 72px; }
  .prototype-shell {
    width: min(1480px, calc(100% - 32px));
    max-width: none;
    margin-inline: auto;
    padding-top: clamp(24px, 4vw, 56px);
    color: #1a2e1f;
  }
  .prototype-btn {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 18px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 14px;
    font-weight: 900;
    white-space: nowrap;
  }
  .prototype-btn-primary { background: linear-gradient(135deg, #10b981, #059669); color: #fff; box-shadow: 0 18px 44px rgba(16,185,129,.18); }
  .prototype-btn-secondary { background: rgba(255,255,255,.78); color: #1a2e1f; border-color: rgba(16,185,129,.28); }
  .prototype-btn-dark { background: #10251a; color: #fff; box-shadow: 0 18px 44px rgba(16,37,26,.18); }
  .prototype-hero {
    min-height: min(820px, calc(100svh - 72px));
    display: grid;
    grid-template-columns: minmax(0, .98fr) minmax(420px, 1.02fr);
    align-items: center;
    gap: 24px;
  }
  .prototype-hero-copy { display: grid; gap: 25px; align-content: center; }
  .prototype-live-pill {
    width: fit-content;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1px solid rgba(16,185,129,.28);
    border-radius: 999px;
    background: rgba(16,185,129,.1);
    color: #047857;
    box-shadow: 0 8px 24px rgba(16,185,129,.08);
    font-size: 12px;
    font-weight: 900;
  }
  .prototype-live-pill span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #10b981;
    box-shadow: 0 0 0 7px rgba(16,185,129,.14);
  }
  .prototype-live-pill time { padding-left: 10px; border-left: 1px solid rgba(16,185,129,.24); color: #64748b; }
  .prototype-hero h1 {
    margin: 0;
    max-width: 13ch;
    font-size: clamp(44px, 5.5vw, 76px);
    line-height: 1.04;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-hero h1 .hero-emphasis { color: #10b981; white-space: normal; overflow-wrap: anywhere; }
  .prototype-hero p {
    margin: 0;
    max-width: 42em;
    color: #374151;
    font-size: clamp(15px, 1.35vw, 18px);
    font-weight: 680;
  }
  .prototype-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .prototype-stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; max-width: 640px; }
  .prototype-stat-card {
    min-height: 116px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.76);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
  }
  .prototype-stat-card strong { display: block; color: #1a2e1f; font-size: 29px; line-height: 1.05; font-weight: 950; }
  .prototype-stat-card span { display: block; margin-top: 8px; color: #64748b; font-size: 12px; font-weight: 780; }
  .prototype-hero-visual {
    min-height: 680px;
    position: relative;
    border: 1px solid rgba(16,185,129,.18);
    border-radius: 8px;
    background: #f9fffe;
    overflow: hidden;
    box-shadow: 0 30px 70px rgba(16,185,129,.14);
  }
  .prototype-hero-map {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, rgba(249,255,254,.42), rgba(236,253,245,.24) 42%, rgba(224,242,254,.3)),
      var(--hero-image);
    background-size: auto, cover;
    background-position: center;
    filter: saturate(1.06) contrast(1.04) brightness(.98);
    transform: scale(1.02);
  }
  .prototype-hero-map.is-empty {
    background:
      linear-gradient(90deg, rgba(16,185,129,.11) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
      linear-gradient(135deg, rgba(236,253,245,.96), rgba(240,249,255,.94) 58%, rgba(255,247,237,.82));
    background-size: 54px 54px, 54px 54px, auto;
  }
  .prototype-hero-map::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(16,185,129,.16) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.12) 1px, transparent 1px);
    background-size: 72px 72px;
    mix-blend-mode: multiply;
    opacity: .62;
  }
  .prototype-scan-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 31%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #10b981, #0ea5e9, transparent);
    box-shadow: 0 0 26px rgba(16,185,129,.46);
    animation: prototype-scan 4.4s ease-in-out infinite alternate;
  }
  @keyframes prototype-scan {
    from { transform: translateY(-180px); }
    to { transform: translateY(260px); }
  }
  .prototype-signal-stack {
    position: absolute;
    top: 20px;
    right: 20px;
    display: grid;
    gap: 9px;
    width: min(288px, calc(100% - 40px));
  }
  .prototype-signal-card,
  .prototype-observation-panel,
  .prototype-identify-panel {
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.88);
    box-shadow: 0 14px 34px rgba(15,23,42,.09);
    backdrop-filter: blur(16px);
  }
  .prototype-signal-card { min-height: 76px; display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px; }
  .prototype-signal-card i,
  .prototype-library-card i,
  .prototype-flow-card i,
  .prototype-map-points i,
  .prototype-trust-grid i,
  .prototype-link-band i {
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: rgba(16,185,129,.12);
    color: #047857;
    font-style: normal;
    font-size: 11px;
    font-weight: 950;
  }
  .prototype-signal-card i { width: 38px; height: 38px; }
  .prototype-signal-card strong,
  .prototype-feed-row strong,
  .prototype-name-step strong { display: block; color: #1a2e1f; font-size: 13px; line-height: 1.3; }
  .prototype-signal-card span,
  .prototype-feed-row small,
  .prototype-name-step small { display: block; color: #64748b; font-size: 11px; font-weight: 740; }
  .prototype-hero-panel { position: absolute; left: 18px; right: 18px; bottom: 18px; display: grid; grid-template-columns: 1.1fr .9fr; gap: 12px; }
  .prototype-observation-panel,
  .prototype-identify-panel { min-height: 220px; padding: 14px; }
  .prototype-panel-head { display: flex; justify-content: space-between; gap: 10px; color: #64748b; font-size: 11px; font-weight: 920; }
  .prototype-feed-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(15,23,42,.08);
  }
  .prototype-feed-row:last-child { border-bottom: 0; }
  .prototype-feed-row img,
  .prototype-feed-thumb {
    width: 52px;
    height: 52px;
    border-radius: 6px;
  }
  .prototype-feed-row img { object-fit: cover; display: block; }
  .prototype-feed-thumb {
    display: grid;
    place-items: center;
    background:
      linear-gradient(90deg, rgba(16,185,129,.14) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.1) 1px, transparent 1px),
      #f8fffc;
    background-size: 12px 12px, 12px 12px, auto;
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .prototype-feed-row strong { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prototype-feed-row em { color: #64748b; font-size: 11px; font-style: normal; font-weight: 760; }
  .prototype-feed-empty { display: grid; gap: 9px; padding: 16px 0; }
  .prototype-name-steps { display: grid; gap: 8px; margin-top: 14px; }
  .prototype-name-step { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; gap: 9px; padding: 9px; border-radius: 8px; background: rgba(16,185,129,.08); }
  .prototype-name-step b { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 999px; background: #10b981; color: #fff; font-size: 12px; line-height: 1; }
  .prototype-link-band {
    padding: 16px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    margin: 18px 0 34px;
  }
  .prototype-link-band i { width: 44px; height: 44px; border-radius: 12px; }
  .prototype-link-band strong { display: block; font-size: 16px; line-height: 1.35; font-weight: 950; }
  .prototype-link-band span { display: block; margin-top: 3px; color: #64748b; font-size: 12px; font-weight: 680; }
  .prototype-section { padding: clamp(58px, 8vw, 104px) 0; scroll-margin-top: 92px; }
  .prototype-section-head { display: grid; grid-template-columns: minmax(0, .7fr) minmax(280px, .3fr); gap: 24px; align-items: end; margin-bottom: 24px; }
  .prototype-eyebrow { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-section h2,
  .prototype-map-copy h2,
  .prototype-community h2,
  .prototype-cta h2 {
    margin: 8px 0 0;
    max-width: min(760px, 100%);
    color: #1a2e1f;
    font-size: clamp(31px, 3.25vw, 50px);
    line-height: 1.1;
    letter-spacing: 0;
    font-weight: 950;
  }
  .prototype-section-head p,
  .prototype-map-copy p,
  .prototype-community p,
  .prototype-cta p { margin: 0; color: #475569; font-size: 15px; font-weight: 680; }
  .prototype-daily-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 14px; }
  .prototype-photo,
  .prototype-evidence-card,
  .prototype-thought-card,
  .prototype-daily-card,
  .prototype-flow-card,
  .prototype-library-card,
  .prototype-trust-grid article,
  .prototype-use-grid article,
  .prototype-daily-empty {
    border-radius: 8px;
    background: #fff;
    border: 1px solid rgba(16,185,129,.12);
    box-shadow: 0 22px 60px rgba(15,23,42,.09);
  }
  .prototype-photo { position: relative; overflow: hidden; min-height: 210px; }
  .prototype-photo-large { min-height: 560px; }
  .prototype-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .prototype-photo::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 46%, rgba(0,0,0,.55)); }
  .prototype-photo span { position: absolute; left: 18px; right: 18px; bottom: 18px; z-index: 2; color: #fff; }
  .prototype-photo small { display: block; color: #d9f99d; font-size: 12px; font-weight: 950; }
  .prototype-photo strong { display: block; margin-top: 4px; font-size: 24px; line-height: 1.25; font-weight: 950; }
  .prototype-photo-small strong { font-size: 15px; }
  .prototype-evidence-card {
    min-height: 210px;
    padding: 18px;
    display: grid;
    align-content: end;
    gap: 10px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      #fbfffe;
    background-size: 32px 32px, 32px 32px, auto;
  }
  .prototype-evidence-large { min-height: 560px; }
  .prototype-evidence-card small,
  .prototype-evidence-card span { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-evidence-card strong { color: #1a2e1f; font-size: 24px; line-height: 1.25; font-weight: 950; }
  .prototype-evidence-small strong { font-size: 15px; }
  .prototype-evidence-card p { margin: 0; color: #475569; font-size: 13px; font-weight: 650; }
  .prototype-daily-empty {
    min-height: 380px;
    padding: clamp(22px, 4vw, 42px);
    display: grid;
    align-content: center;
    gap: 14px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      linear-gradient(135deg, #ffffff, #f0fdf4 62%, #f0f9ff);
    background-size: 42px 42px, 42px 42px, auto;
  }
  .prototype-daily-empty small { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-daily-empty strong { max-width: 19ch; color: #1a2e1f; font-size: clamp(28px, 4vw, 48px); line-height: 1.12; font-weight: 950; }
  .prototype-daily-empty p { max-width: 52ch; margin: 0; color: #475569; font-size: 15px; font-weight: 680; }
  .prototype-empty-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
  .prototype-daily-side { display: grid; gap: 14px; align-content: stretch; }
  .prototype-photo-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .prototype-thought-card { min-height: 192px; padding: 20px; display: grid; align-content: center; gap: 12px; background: #10251a; color: #fff; }
  .prototype-thought-card small { color: #a7f3d0; font-weight: 950; }
  .prototype-thought-card strong { max-width: 22ch; font-size: 26px; line-height: 1.25; font-weight: 950; }
  .prototype-thought-card p { margin: 0; color: rgba(255,255,255,.75); font-size: 13px; font-weight: 650; }
  .prototype-daily-card-grid,
  .prototype-flow-grid,
  .prototype-library-grid,
  .prototype-trust-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
  .prototype-flow-grid,
  .prototype-trust-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .prototype-daily-card,
  .prototype-flow-card,
  .prototype-library-card,
  .prototype-trust-grid article { min-height: 210px; display: grid; align-content: start; gap: 12px; padding: 18px; }
  .prototype-daily-card small,
  .prototype-library-card span { color: #047857; font-size: 12px; font-weight: 950; }
  .prototype-daily-card strong,
  .prototype-flow-card h3,
  .prototype-library-card h3,
  .prototype-trust-grid h3 { margin: 0; color: #1a2e1f; font-size: 21px; line-height: 1.25; font-weight: 950; }
  .prototype-daily-card p,
  .prototype-flow-card p,
  .prototype-library-card p,
  .prototype-trust-grid p { margin: 0; color: #475569; font-size: 13px; font-weight: 650; }
  .prototype-daily-card span strong { display: inline; margin-right: 5px; font-size: 26px; }
  .prototype-daily-card em { align-self: end; color: #047857; font-size: 12px; font-style: normal; font-weight: 950; }
  .prototype-flow-card i,
  .prototype-library-card i,
  .prototype-trust-grid i { width: 48px; height: 48px; border-radius: 12px; }
  .prototype-flow-body { display: grid; gap: 12px; }
  .prototype-flow-num { order: -1; color: rgba(16,185,129,.36); font-size: 42px; line-height: 1; font-weight: 950; }
  .prototype-map-section {
    position: relative;
    display: grid;
    grid-template-columns: minmax(340px, .58fr) minmax(0, 1fr);
    gap: 18px;
    align-items: stretch;
    margin-top: 14px;
    scroll-margin-top: 92px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background:
      linear-gradient(90deg, rgba(16,185,129,.08) 1px, transparent 1px),
      linear-gradient(0deg, rgba(14,165,233,.06) 1px, transparent 1px),
      linear-gradient(135deg, rgba(236,253,245,.95) 0%, rgba(240,249,255,.9) 56%, rgba(255,247,237,.78) 100%);
    background-size: 48px 48px, 48px 48px, auto;
    box-shadow: 0 18px 52px rgba(15,23,42,.075);
  }
  .prototype-map-copy {
    padding: clamp(22px, 4vw, 38px);
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    box-shadow: 0 16px 42px rgba(15,23,42,.06);
    display: grid;
    align-content: center;
    gap: 18px;
  }
  .prototype-map-step { display: flex; align-items: center; gap: 10px; color: #047857; font-weight: 950; }
  .prototype-map-step b { color: rgba(16,185,129,.44); font-size: clamp(42px, 5vw, 72px); line-height: 1; }
  .prototype-map-points { display: grid; gap: 9px; }
  .prototype-map-points a { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border: 1px solid rgba(16,185,129,.13); border-radius: 8px; background: rgba(255,255,255,.72); }
  .prototype-map-points i { width: 34px; height: 34px; border-radius: 9px; }
  .prototype-map-points strong { display: block; color: #1a2e1f; font-size: 14px; line-height: 1.35; }
  .prototype-map-points small { display: block; color: #64748b; font-size: 12px; font-weight: 650; }
  .prototype-map-board { min-height: 520px; position: relative; overflow: hidden; border: 1px solid rgba(16,185,129,.16); border-radius: 8px; background: #ecfdf5; box-shadow: 0 18px 46px rgba(15,23,42,.1); }
  .prototype-map-board .map-mini { height: 100%; min-height: 520px; border-radius: 0; border: 0; box-shadow: none; }
  .prototype-community {
    margin-top: clamp(58px, 8vw, 104px);
    padding: clamp(26px, 5vw, 44px);
    display: grid;
    grid-template-columns: minmax(0, .92fr) minmax(320px, 1.08fr);
    gap: 18px;
    border-radius: 8px;
    background: #10251a;
    color: #fff;
    box-shadow: 0 24px 64px rgba(16,37,26,.2);
  }
  .prototype-community h2 { color: #fff; }
  .prototype-community p { color: rgba(255,255,255,.78); margin-top: 14px; }
  .prototype-community .prototype-eyebrow { color: #a7f3d0; }
  .prototype-use-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .prototype-use-grid article { min-height: 154px; padding: 18px; background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.13); box-shadow: none; }
  .prototype-use-grid strong { display: block; color: #fff; font-size: 18px; font-weight: 950; }
  .prototype-use-grid span { display: block; margin-top: 8px; color: rgba(255,255,255,.72); font-size: 13px; font-weight: 650; }
  .prototype-cta {
    margin-top: clamp(58px, 8vw, 104px);
    padding: clamp(24px, 4vw, 38px);
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 18px;
    align-items: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #10b981, #0ea5e9);
    color: #fff;
    box-shadow: 0 24px 64px rgba(16,185,129,.22);
  }
  .prototype-cta h2 { color: #fff; margin: 0; }
  .prototype-cta p { color: rgba(255,255,255,.84); margin-top: 10px; }
  @media (max-width: 1020px) {
    .prototype-hero,
    .prototype-daily-grid,
    .prototype-map-section,
    .prototype-community { grid-template-columns: 1fr; }
    .prototype-hero-visual { min-height: 620px; }
    .prototype-section-head { grid-template-columns: 1fr; align-items: start; }
    .prototype-daily-card-grid,
    .prototype-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .prototype-shell { width: min(100% - 24px, 1480px); padding-top: 18px; }
    .prototype-hero { min-height: 0; gap: 20px; }
    .prototype-hero h1 { font-size: clamp(38px, 12vw, 52px); line-height: 1.08; }
    .prototype-stat-grid,
    .prototype-hero-panel,
    .prototype-flow-grid,
    .prototype-trust-grid,
    .prototype-use-grid,
    .prototype-cta { grid-template-columns: 1fr; }
    .prototype-hero-visual { min-height: 620px; }
    .prototype-signal-stack { left: 14px; right: 14px; top: 14px; width: auto; }
    .prototype-hero-panel { left: 14px; right: 14px; bottom: 14px; }
    .prototype-link-band { grid-template-columns: 1fr; }
    .prototype-flow-grid {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      padding: 2px 0 0;
      margin-top: 14px;
    }
    .prototype-flow-grid::before {
      content: "";
      position: absolute;
      left: 28px;
      top: 18px;
      bottom: 94px;
      width: 2px;
      background: linear-gradient(180deg, rgba(16,185,129,.42), rgba(14,165,233,.24));
    }
    .prototype-flow-card {
      position: relative;
      min-height: auto;
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "num body";
      gap: 12px;
      padding: 12px 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }
    .prototype-flow-body {
      grid-area: body;
      padding: 14px;
      border: 1px solid rgba(16,185,129,.14);
      border-radius: 8px;
      background: rgba(255,255,255,.82);
      box-shadow: 0 10px 28px rgba(15,23,42,.045);
    }
    .prototype-flow-card .prototype-flow-num {
      grid-area: num;
      order: 0;
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      position: relative;
      z-index: 1;
      border: 1px solid rgba(16,185,129,.18);
      border-radius: 999px;
      background: #ecfdf5;
      color: #10b981;
      font-size: 22px;
      box-shadow: 0 0 0 8px rgba(249,255,254,.92);
    }
    .prototype-flow-card i {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }
    .prototype-map-section {
      margin-top: 4px;
    }
    .prototype-map-copy h2 {
      max-width: 100%;
      font-size: 30px;
    }
    .prototype-map-board,
    .prototype-map-board .map-mini,
    .prototype-map-board .map-mini-canvas {
      min-height: 430px;
    }
    .prototype-photo-large,
    .prototype-evidence-large { min-height: 420px; }
    .prototype-photo-row { grid-template-columns: 1fr; }
    .prototype-daily-card-grid,
    .prototype-library-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .prototype-actions,
    .prototype-empty-actions { display: grid; grid-template-columns: 1fr; }
    .prototype-btn { width: 100%; white-space: normal; text-align: center; }
    .prototype-hero-visual { min-height: 700px; }
    .prototype-feed-row { grid-template-columns: 46px minmax(0, 1fr); }
    .prototype-feed-row em { grid-column: 2; }
    .prototype-feed-row img,
    .prototype-feed-thumb { width: 46px; height: 46px; }
  }
`;
