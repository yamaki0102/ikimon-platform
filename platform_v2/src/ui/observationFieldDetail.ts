import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import type { PlaceSnapshot } from "../services/placeSnapshot.js";
import type { AreaObservationGalleryItem, AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import {
  AREA_SPOT_TYPE_LABELS,
  normalizeAreaEncyclopediaPayload,
  resolveAreaGuideTemplates,
  type AreaActor,
  type AreaEncyclopediaPayload,
  type AreaEncyclopediaSpot,
  type AreaGuideTemplate,
  type AreaLocalGuide,
  type AreaSpotType,
} from "../services/areaEncyclopediaPayload.js";
import { renderPlaceSnapshotTeaser } from "./placeSnapshot.js";
import { RECORD_CARD_SIZING_TOKENS } from "./recordCardSizing.js";
import {
  buildFieldPublicProfileView,
  type FieldPublicProfileView,
} from "../services/fieldPublicProfileView.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isIkimonUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "zukan.earth"
      || parsed.hostname.endsWith(".zukan.earth")
      || parsed.hostname === "ikimon.life"
      || parsed.hostname.endsWith(".ikimon.life");
  } catch {
    return /^https?:\/\/(?:[^/]+\.)?(?:zukan\.earth|ikimon\.life)(?:[/:?#]|$)/i.test(value);
  }
}

function sourceConfidenceLabel(field: ObservationField): string {
  if (field.verificationLabel.trim()) return field.verificationLabel;
  if (field.verificationLevel === "registry_matched") return "公的台帳と一致";
  if (field.verificationLevel === "page_verified") return "公式ページで確認";
  if (field.verificationLevel === "owner_verified") return "設置者により確認済み";
  if (field.verificationLevel === "staff_verified") return "担当者確認済み";
  const score = field.sourceConfidence;
  if (score >= 0.95) return "一次情報: 強い外部根拠あり";
  if (score >= 0.75) return "一次情報: 公式ページ候補あり";
  if (score >= 0.45) return "一次情報: 外部情報確認中";
  return "一次情報: 未確認";
}

function fieldSourceLabel(field: ObservationField): string {
  switch (field.source) {
    case "user_defined":
      return "利用者が作成したエリア";
    case "nature_symbiosis_site":
      return "連携エリア";
    case "tsunag":
      return "地域連携エリア";
    case "protected_area":
      return "保護区由来のエリア";
    case "oecm":
      return "保全候補エリア";
    case "school":
      return "管理されたエリア";
    case "osm_park":
      return "公園データ由来のエリア";
    case "admin_municipality":
      return "市区町村データ由来のエリア";
    case "admin_prefecture":
      return "都道府県データ由来のエリア";
    case "admin_country":
      return "国・地域データ由来のエリア";
    default:
      return "登録エリア";
  }
}

function fieldVerificationSummary(field: ObservationField): { label: string; body: string } {
  if (field.verificationLabel.trim()) {
    return { label: field.verificationLabel.trim(), body: "公開できる範囲の根拠を確認済みです。" };
  }
  switch (field.verificationLevel) {
    case "registry_matched":
      return { label: "台帳確認済み", body: "公的台帳と照合した範囲で表示しています。" };
    case "page_verified":
      return { label: "公式ページ確認済み", body: "公式ページで確認できる範囲に絞って表示しています。" };
    case "owner_verified":
      return { label: "管理者確認済み", body: "管理主体の確認が取れた範囲で表示しています。" };
    case "staff_verified":
      return { label: "担当者確認済み", body: "担当者が確認した公開情報として表示しています。" };
    default:
      return { label: "確認待ち", body: "名称や公開範囲は確認中です。安全のため詳細位置は出しません。" };
  }
}

function sourceLinkItems(field: ObservationField): Array<{ label: string; url: string }> {
  const items = [
    { label: "公式", url: field.ownerUrl },
    { label: "認定情報", url: field.certificationUrl },
    { label: "事例", url: field.storyUrl },
  ];
  if (!items.some((item) => item.url) && field.officialUrl) {
    items.push({ label: isIkimonUrl(field.officialUrl) ? "事例" : "公式", url: field.officialUrl });
  }
  const seen = new Set<string>();
  return items
    .map((item) => ({ label: item.label, url: item.url.trim() }))
    .filter((item) => {
      const url = item.url.trim();
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function renderSourceButtons(field: ObservationField): string {
  return sourceLinkItems(field)
    .map((item) => `<a class="evt-btn evt-btn-on-dark" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label)} ↗</a>`)
    .join("");
}

function renderFieldTrustInfo(field: ObservationField): string {
  const buttons = renderSourceButtons(field);
  if (!buttons && !field.verificationLabel.trim()) return "";
  return `<section class="field-trust-info" aria-label="信頼情報">
    <header>
      <div>
        <span class="evt-eyebrow">Evidence</span>
        <h2 class="evt-heading">信頼情報</h2>
      </div>
      <span class="field-trust-status">${escapeHtml(sourceConfidenceLabel(field))}</span>
    </header>
    ${buttons ? `<div class="field-trust-links">${buttons}</div>` : ""}
  </section>`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.max(0, Number.isFinite(value) ? value : 0));
}

function formatObservationDate(iso: string | null | undefined): string {
  if (!iso) return "まだ記録なし";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "まだ記録なし";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

function isAreaSnapshot(snapshot: PlaceSnapshot | null | undefined): snapshot is AreaPlaceSnapshot {
  return Boolean(snapshot && Array.isArray((snapshot as Partial<AreaPlaceSnapshot>).observationGallery));
}

function fieldHeroAreaMetrics(
  encyclopedia: AreaEncyclopediaPayload,
  snapshot: PlaceSnapshot | null | undefined,
  guideTemplateCount: number,
): Array<{ value: number; label: string }> {
  const hasLocalGuides = encyclopedia.localGuides.length > 0;
  return [
    { value: snapshot?.observationSummary.totalObservations ?? 0, label: "公開記録" },
    { value: encyclopedia.spots.length, label: "近くのスポット" },
    { value: hasLocalGuides ? encyclopedia.localGuides.length : guideTemplateCount, label: hasLocalGuides ? "現地ガイド" : "ガイド候補" },
  ];
}

function fieldHeroMetrics(stats: FieldStats, snapshot: PlaceSnapshot | null | undefined): Array<{ value: number; label: string }> {
  const summary = snapshot?.observationSummary;
  const hasPlaceObservations = Boolean(
    summary && (summary.totalObservations > 0 || summary.uniqueTaxa > 0 || summary.totalVisits > 0),
  );
  if (hasPlaceObservations && summary) {
    return [
      { value: summary.totalVisits, label: "記録回数" },
      { value: summary.uniqueTaxa, label: "累計種数" },
      { value: summary.totalObservations, label: "累計記録" },
    ];
  }
  return [
    { value: stats.totalSessions, label: "開催回数" },
    { value: stats.uniqueSpeciesCount, label: "累計種数" },
    { value: stats.totalObservations, label: "累計記録" },
  ];
}

function fieldSeasonLabel(snapshot: PlaceSnapshot | null | undefined): string {
  const labels = snapshot?.observationSummary.seasonLabels?.filter(Boolean) ?? [];
  return labels.length > 0 ? labels.join("・") : "季節の記録を募集中";
}

function renderFieldHeroSignals(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const names = snapshot.observationGallery
    .filter((item) => item.isCurrentSeason)
    .map((item) => item.displayName || "見つけたもの")
    .filter(Boolean);
  const uniqueNames = Array.from(new Set(names)).slice(0, 4);
  if (uniqueNames.length === 0) return "";
  return `<div class="field-map-signals" aria-label="今の季節に見えるもの">
    <span>今見えるもの</span>
    ${uniqueNames.map((name) => `<b>${escapeHtml(name)}</b>`).join("")}
  </div>`;
}

function spotTypeLabel(type: AreaSpotType): string {
  return AREA_SPOT_TYPE_LABELS[type] ?? "スポット";
}

function actorNameMap(actors: AreaActor[]): Map<string, string> {
  return new Map(actors.map((actor) => [actor.id, actor.name]));
}

function renderAreaHeroStats(metrics: Array<{ value: number; label: string }>): string {
  const visibleMetrics = metrics.filter((item) => item.value > 0);
  if (visibleMetrics.length === 0) {
    return `<div class="field-map-hero-stats field-map-hero-stats-empty" aria-label="エリア図鑑の公開記録">
      <span>この図鑑はこれから</span>
    </div>`;
  }
  return `<div class="field-map-hero-stats" aria-label="エリア図鑑の公開記録">
    ${visibleMetrics.map((item) => `<div><strong>${formatNumber(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}
  </div>`;
}

function renderPublicRangeChips(field: ObservationField): string {
  const verification = fieldVerificationSummary(field);
  const locationLabel = [field.prefecture, field.city].filter(Boolean).join(" / ");
  const chips = [
    "公開範囲: 位置をぼかして表示",
    field.radiusM ? `半径 ${formatNumber(field.radiusM)}m` : "",
    verification.label,
    fieldSourceLabel(field),
    locationLabel,
  ].filter(Boolean);
  return `<div class="field-public-chips" aria-label="公開範囲と確認状態">
    ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
  </div>`;
}

function renderAreaTags(encyclopedia: AreaEncyclopediaPayload, snapshot: PlaceSnapshot | null | undefined): string {
  const tags = [fieldSeasonLabel(snapshot), ...encyclopedia.tags].filter(Boolean);
  return `<div class="field-map-hero-tags">
    ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
  </div>`;
}

function renderSpotFilters(): string {
  const filters: Array<{ key: "all" | AreaSpotType; label: string }> = [
    { key: "all", label: "近く" },
    { key: "park_land", label: AREA_SPOT_TYPE_LABELS.park_land },
    { key: "facility", label: AREA_SPOT_TYPE_LABELS.facility },
    { key: "water_care", label: AREA_SPOT_TYPE_LABELS.water_care },
    { key: "observation_point", label: AREA_SPOT_TYPE_LABELS.observation_point },
    { key: "food", label: AREA_SPOT_TYPE_LABELS.food },
  ];
  return `<div class="field-spot-filters" role="group" aria-label="近くのスポットを絞り込む">
    ${filters.map((filter, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-spot-filter="${escapeHtml(filter.key)}">${escapeHtml(filter.label)}</button>`).join("")}
  </div>`;
}

function renderSpotCard(spot: AreaEncyclopediaSpot, actors: Map<string, string>): string {
  const stats = [
    { value: spot.publicRecordCount, label: "公開記録" },
    { value: spot.guideCount, label: "ガイド" },
  ];
  const actorLabels = spot.actorIds
    .map((actorId) => actors.get(actorId))
    .filter((name): name is string => Boolean(name));
  return `<article class="field-spot-card" data-area-spot-card data-spot-id="${escapeHtml(spot.id)}" data-spot-type="${escapeHtml(spot.type)}">
    <header>
      <span class="field-spot-type">${escapeHtml(spotTypeLabel(spot.type))}</span>
      <h3>${escapeHtml(spot.name)}</h3>
    </header>
    ${spot.summary ? `<p>${escapeHtml(spot.summary)}</p>` : ""}
    <div class="field-spot-stats">
      ${stats.map((item) => `<span><strong>${formatNumber(item.value)}</strong>${escapeHtml(item.label)}</span>`).join("")}
    </div>
    ${actorLabels.length > 0 ? `<div class="field-spot-actors">${actorLabels.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>` : ""}
  </article>`;
}

function renderAreaSpots(encyclopedia: AreaEncyclopediaPayload): string {
  const actors = actorNameMap(encyclopedia.actors);
  const hasSpots = encyclopedia.spots.length > 0;
  if (!hasSpots) return "";
  const sectionLabel = "近くのスポット";
  const spotCards = encyclopedia.spots.map((spot) => renderSpotCard(spot, actors)).join("");
  return `<section class="field-area-spots" aria-label="${sectionLabel}">
    <header>
      <div><span class="evt-eyebrow">Area Spots</span><h2 class="evt-heading">${sectionLabel}</h2></div>
      ${renderSpotFilters()}
    </header>
    <div class="field-spot-grid" data-spot-list>${spotCards}</div>
  </section>`;
}

function formatMeters(value: number | null): string {
  if (value == null) return "";
  return `半径約 ${formatNumber(value)}m`;
}

function formatDuration(value: number | null): string {
  if (value == null || value <= 0) return "";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  if (minutes <= 0) return `${seconds}秒`;
  if (seconds <= 0) return `${minutes}分`;
  return `${minutes}分${seconds}秒`;
}

function renderGuideCard(guide: AreaLocalGuide): string {
  const status = guide.status === "planned" ? "予定あり" : "現地で聞ける";
  const chips = [
    status,
    formatMeters(guide.unlockRadiusM),
    guide.transcriptAvailable ? "文字起こしあり" : "",
    formatDuration(guide.audioDurationSeconds),
    ...guide.languages,
  ].filter(Boolean);
  return `<article class="field-guide-card">
    <header>
      <span>${escapeHtml(status)}</span>
      <h3>${escapeHtml(guide.title)}</h3>
    </header>
    <div class="field-guide-chips">${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}</div>
  </article>`;
}

function renderGuideTemplateCard(template: AreaGuideTemplate): string {
  return `<article class="field-guide-card is-template">
    <header>
      <span>入口ガイド</span>
      <h3>${escapeHtml(template.title)}</h3>
    </header>
    <p>${escapeHtml(template.summary)}</p>
    <div class="field-guide-chips">
      <span>1分</span>
      <span>見るポイント</span>
    </div>
  </article>`;
}

function renderLocalGuides(encyclopedia: AreaEncyclopediaPayload, guideTemplates: AreaGuideTemplate[]): string {
  const guideCards = encyclopedia.localGuides.length > 0
    ? encyclopedia.localGuides.map(renderGuideCard).join("")
    : guideTemplates.map(renderGuideTemplateCard).join("");
  return `<section class="field-local-guides" id="field-local-guides" aria-label="現地で聞けるガイド">
    <header>
      <div><span class="evt-eyebrow">Local Guide</span><h2 class="evt-heading">現地で見る入口</h2></div>
      <span class="field-privacy-note">位置情報は保存しない</span>
    </header>
    ${encyclopedia.localGuides.length === 0 ? `<p class="evt-lead">固有ガイドがない場所でも、足元・季節・木のまわりから歩き出せる入口を置きます。</p>` : ""}
    <div class="field-guide-grid">${guideCards}</div>
  </section>`;
}

function renderActorCard(actor: AreaActor): string {
  const body = `<strong>${escapeHtml(actor.name)}</strong><span>${escapeHtml(actor.roleLabel)}</span>`;
  return actor.url
    ? `<a class="field-actor-card" href="${escapeHtml(actor.url)}" target="_blank" rel="noopener">${body}</a>`
    : `<article class="field-actor-card">${body}</article>`;
}

function renderAreaActors(encyclopedia: AreaEncyclopediaPayload): string {
  if (encyclopedia.actors.length === 0 && encyclopedia.externalLinks.length === 0) return "";
  const actorCards = encyclopedia.actors.map(renderActorCard).join("");
  const links = encyclopedia.externalLinks.length > 0
    ? `<div class="field-external-links">${encyclopedia.externalLinks.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)} ↗</a>`).join("")}</div>`
    : "";
  return `<section class="field-area-actors" aria-label="関連">
    <header><span class="evt-eyebrow">Related</span><h2 class="evt-heading">関連</h2></header>
    ${actorCards ? `<div class="field-actor-grid">${actorCards}</div>` : ""}
    ${links}
  </section>`;
}

function renderAreaGrowthEmpty(encyclopedia: AreaEncyclopediaPayload): string {
  if (encyclopedia.spots.length > 0 || encyclopedia.actors.length > 0 || encyclopedia.externalLinks.length > 0) return "";
  return `<section class="field-area-growth-empty" aria-label="この図鑑はこれから育つ">
    <span class="evt-eyebrow">Growing Area</span>
    <h2 class="evt-heading">この図鑑はこれから育つ</h2>
    <p class="evt-lead">見どころ、関わる人や団体、近くの入口は、記録や観察会が増えたらここにまとまります。まずは1分ガイドから歩き出せます。</p>
    <a class="evt-btn evt-btn-primary" href="#field-local-guides">現地で見る入口へ</a>
  </section>`;
}

function renderAlbumCard(item: AreaObservationGalleryItem): string {
  const isPrivate = item.visibility === "viewer_private";
  const href = `/observations/${encodeURIComponent(item.visitId || item.occurrenceId)}`;
  const meta = [
    item.isCurrentSeason && item.seasonLabel ? `今の季節・${item.seasonLabel}` : item.seasonLabel ?? "",
    isPrivate ? "" : `${item.observationCount}件`,
    item.observedAt ? item.observedAt.slice(0, 10) : "",
  ].filter(Boolean).join(" / ");
  const media = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="field-album-empty-thumb" aria-hidden="true"></span>`;
  const privacy = isPrivate
    ? `<em class="field-album-private"><small>${escapeHtml(item.privacyReason ?? "公開アルバムには出ていません")}</small></em>`
    : "";
  return `<a class="field-album-card${isPrivate ? " is-private" : ""}" href="${escapeHtml(href)}">
    <span class="field-album-thumb">${media}</span>
    ${privacy}
    <span class="field-album-body">
      <strong>${escapeHtml(item.displayName || "見つけたもの")}</strong>
      <small>${escapeHtml(meta)}</small>
    </span>
  </a>`;
}

function renderFieldViewerMemory(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot) || !snapshot.viewerContribution?.hasViewerRecords) return "";
  const cards = snapshot.viewerContribution.recordCards.slice(0, 4).map(renderAlbumCard).join("");
  return `<section class="field-memory">
    <header>
      <div><span class="evt-eyebrow">My Memory</span><h2 class="evt-heading">あなたがこの場所で見つけたもの</h2></div>
      <span class="evt-badge evt-mode-discovery">${snapshot.viewerContribution.recordCount}件</span>
    </header>
    <p class="evt-lead">${escapeHtml(snapshot.viewerContribution.positiveFeedbackLine)}</p>
    <div class="field-album-grid field-album-grid-compact">${cards}</div>
  </section>`;
}

function renderFieldAlbum(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const gallery = snapshot.observationGallery.slice(0, 12);
  const current = gallery.filter((item) => item.isCurrentSeason).slice(0, 6);
  const missing = snapshot.seasonalCoverage.filter((row) => row.observations <= 0);
  const missingText = missing.length > 0 ? missing.map((row) => row.label).join("・") : "四季の入口あり";
  const hasGallery = gallery.length > 0;
  const hasCurrent = current.length > 0;
  if (!hasGallery && !hasCurrent) {
    return `<section class="field-album is-empty" id="field-album">
      <header>
        <div><span class="evt-eyebrow">Area Album</span><h2 class="evt-heading">この公園の記録を育てる</h2></div>
        <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">公開図鑑ページ</a>
      </header>
      <p class="evt-lead">未記録季節: ${escapeHtml(missingText)}。最初の写真や季節の記録が、この場所を選ぶ理由になります。</p>
      <div class="field-album-empty-grid">
        <article class="field-album-empty-card">
          <span class="evt-eyebrow">First Record</span>
          <h3>最初の一枚を残す</h3>
          <p>花壇の端、木の幹、足元の小さな動きを記録すると、公園のアルバムが始まります。</p>
        </article>
        <article class="field-album-empty-card">
          <span class="evt-eyebrow">Season</span>
          <h3>季節の顔を足す</h3>
          <p>春・夏・秋・冬の違いが見えると、同じ場所をまた見る理由が増えます。</p>
        </article>
      </div>
    </section>`;
  }
  const galleryHtml = gallery.length > 0
    ? gallery.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Area Album</span><h3 class="evt-heading">まだ記録カードはありません</h3><p class="evt-lead">この場所で最初の写真を残すと、地域の生きものアルバムが始まります。</p></article>`;
  const currentHtml = current.length > 0
    ? current.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Season</span><h3 class="evt-heading">今の季節の記録を足す</h3><p class="evt-lead">季節の顔が見えると、地図からこの場所を選ぶ理由が強くなります。</p></article>`;
  return `<section class="field-album" id="field-album">
    <header>
      <div><span class="evt-eyebrow">Area Album</span><h2 class="evt-heading">公開写真 / 季節</h2></div>
      <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">公開図鑑ページ</a>
    </header>
    <p class="evt-lead">未記録季節: ${escapeHtml(missingText)}。公園や水辺を見に来た人が、公開写真と季節からこの場所の記録を眺められる入口です。</p>
    <div class="field-album-grid">${galleryHtml}</div>
    <h3 class="evt-heading" style="font-size:18px;margin:18px 0 10px;">今の季節に見えるもの</h3>
    <div class="field-album-grid field-album-grid-compact">${currentHtml}</div>
  </section>`;
}

function renderAreaHeroFeature(snapshot: PlaceSnapshot | null | undefined, stats: FieldStats): string {
  const publicRecordCount = snapshot?.observationSummary.totalObservations ?? stats.totalObservations;
  if (isAreaSnapshot(snapshot) && snapshot.representativePhoto) {
    const photo = snapshot.representativePhoto;
    const href = `/observations/${encodeURIComponent(photo.visitId || photo.occurrenceId)}`;
    return `<a class="field-area-feature-card has-image" href="${escapeHtml(href)}">
      <span class="field-area-feature-media"><img src="${escapeHtml(photo.photoUrl)}" alt="" loading="eager" decoding="async" /></span>
      <span class="field-area-feature-body">
        <small>公開記録</small>
        <strong>${escapeHtml(photo.displayName || "このエリアの記録")}</strong>
        <em>${escapeHtml(formatObservationDate(photo.observedAt))}</em>
      </span>
    </a>`;
  }
  if (publicRecordCount > 0) {
    return `<article class="field-area-feature-card">
      <span class="field-area-feature-mark" aria-hidden="true"></span>
      <span class="field-area-feature-body">
        <small>記録の蓄積</small>
        <strong>公開記録 ${formatNumber(publicRecordCount)}件</strong>
        <em>写真や季節の記録から、このエリアの変化を読めます。</em>
      </span>
    </article>`;
  }
  return `<article class="field-area-feature-card is-empty">
    <span class="field-area-feature-mark" aria-hidden="true"></span>
    <span class="field-area-feature-body">
      <small>公開記録</small>
      <strong>このエリアの公開記録はまだありません</strong>
      <em>最初の写真やメモが、地域図鑑の入口になります。</em>
    </span>
  </article>`;
}

function renderFieldPublicRange(field: ObservationField): string {
  const verification = fieldVerificationSummary(field);
  const locationLabel = [field.prefecture, field.city].filter(Boolean).join(" / ") || "粗い場所だけ表示";
  const radiusLabel = field.radiusM ? `半径約 ${formatNumber(field.radiusM)}m` : "公開範囲を丸めて表示";
  const cards = [
    {
      key: "公開範囲",
      title: "位置をぼかして表示",
      body: "正確な座標とジオメトリ本体は、この公開ページでは表示しません。",
    },
    {
      key: "確認状態",
      title: verification.label,
      body: verification.body,
    },
    {
      key: "作成元",
      title: fieldSourceLabel(field),
      body: "内部の登録値ではなく、利用者が読める意味に直して表示しています。",
    },
    {
      key: "粗い場所",
      title: locationLabel,
      body: radiusLabel,
    },
  ];
  return `<section class="field-public-range" aria-label="公開範囲と確認">
    <header>
      <div><span class="evt-eyebrow">Safety / Evidence</span><h2 class="evt-heading">公開範囲と確認</h2></div>
      <span class="field-public-range-badge">詳細位置は非公開</span>
    </header>
    <div class="field-public-range-grid">
      ${cards.map((card) => `<article>
        <span>${escapeHtml(card.key)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.body)}</p>
      </article>`).join("")}
    </div>
  </section>`;
}

function renderFieldPublicProfile(view: FieldPublicProfileView): string {
  const profile = view.profile;
  const taxa = profile.confirmedTaxa.length > 0
    ? profile.confirmedTaxa.slice(0, 8).map((taxon) => `<span>${escapeHtml(taxon.name)} ×${formatNumber(taxon.observationCount)}</span>`).join("")
    : `<span>${escapeHtml(profile.limitations[0]?.label ?? "確認記録が少ないため、詳細な傾向はまだ表示していません")}</span>`;
  const environments = profile.environmentTypes.length > 0
    ? profile.environmentTypes.map((label) => `<span>${escapeHtml(label)}</span>`).join("")
    : "<span>環境タイプ確認中</span>";
  const sections = view.publicBrief.sections.map((section) => `<article>
    <span>${escapeHtml(section.title)}</span>
    <p>${escapeHtml(section.body)}</p>
  </article>`).join("");
  return `<section class="field-public-profile" data-field-public-profile aria-label="Site Intelligence">
    <header>
      <div>
        <span class="evt-eyebrow">Site Intelligence</span>
        <h2 class="evt-heading">場所プロフィール</h2>
      </div>
      <span class="field-public-profile-confidence">${escapeHtml(profile.confidence.label)}</span>
    </header>
    <p class="evt-lead">${escapeHtml(view.publicBrief.summary)}</p>
    <div class="field-public-profile-grid">${sections}</div>
    <div class="field-public-profile-strip" aria-label="確認された生きもの">${taxa}</div>
    <div class="field-public-profile-strip" aria-label="環境タイプ">${environments}</div>
    <div class="field-public-profile-next">
      <strong>次の観察</strong>
      <span>${escapeHtml(profile.nextObservationPrompts.slice(0, 3).join(" / "))}</span>
    </div>
  </section>`;
}

export function renderFieldDetailBody(args: { field: ObservationField; stats: FieldStats; snapshot?: PlaceSnapshot | null }): string {
  const { field, stats, snapshot } = args;
  const encyclopedia = normalizeAreaEncyclopediaPayload(field.payload);
  const guideTemplates = resolveAreaGuideTemplates(encyclopedia);
  const publicProfileView = buildFieldPublicProfileView({ field, stats, snapshot: isAreaSnapshot(snapshot) ? snapshot : null });
  const heroMetrics = fieldHeroMetrics(stats, snapshot);
  const areaHeroMetrics = fieldHeroAreaMetrics(encyclopedia, snapshot, guideTemplates.length);
  const latestObservedAt = snapshot?.observationSummary.latestObservedAt ?? null;

  const sessionRows = stats.recentSessions.length === 0
    ? `<p class="evt-lead">まだこのフィールドでの観察会はありません。</p>`
    : stats.recentSessions.map((s) => {
        const isLive = !s.endedAt;
        const detailHref = isLive
          ? (s.eventCode ? `/community/events/${encodeURIComponent(s.eventCode)}/join` : `/events/${s.sessionId}/live`)
          : `/events/${s.sessionId}/recap`;
        return `<article class="evt-card" style="display:grid; gap:6px;">
          <header style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span class="evt-badge ${isLive ? "evt-mode-discovery is-live" : "evt-mode-discovery"}">${isLive ? "LIVE" : "終了"}</span>
            <span class="evt-eyebrow">${escapeHtml(formatDate(s.startedAt))}</span>
          </header>
          <h3 class="evt-heading" style="margin:0; font-size:16px;">${escapeHtml(s.title || "観察会")}</h3>
          <div style="display:flex; gap:6px;">
            <a class="evt-btn evt-btn-ghost" href="${escapeHtml(detailHref)}" style="flex:1; min-height:36px; padding:6px 10px;">${isLive ? "参加" : "振り返り"}</a>
            <a class="evt-btn evt-btn-primary" href="/community/events/new?template_from=${encodeURIComponent(s.sessionId)}" style="flex:1; min-height:36px; padding:6px 10px;">🔁 再開催</a>
          </div>
        </article>`;
      }).join("");

  const topTaxa = stats.topTaxa.length === 0
    ? `<p class="evt-lead">記録はまだありません。</p>`
    : stats.topTaxa.map((t) => `<span class="evt-badge evt-mode-discovery">${escapeHtml(t.name)} ×${t.count}</span>`).join(" ");

  const areaLabel = field.areaHa ? `${field.areaHa.toFixed(2)} ha` : `半径 ${field.radiusM} m`;

  return `
<section class="evt-recap-shell field-detail-shell" data-field-id="${escapeHtml(field.fieldId)}">

  <article class="field-area-hero">
    <div class="field-area-hero-copy">
      <span class="evt-result-eyebrow">エリア図鑑</span>
      <h1>${escapeHtml(field.name)}</h1>
      ${renderPublicRangeChips(field)}
      ${field.summary ? `<p>${escapeHtml(field.summary)}</p>` : `<p>このエリアに積み上がる公開記録を、安全な範囲で読むためのページです。</p>`}
      ${renderAreaHeroStats(areaHeroMetrics)}
      ${renderAreaTags(encyclopedia, snapshot)}
      ${renderFieldHeroSignals(snapshot)}
      <div class="field-detail-actions">
        <a class="evt-btn evt-btn-primary" href="/record?field_id=${encodeURIComponent(field.fieldId)}">このエリアで記録する</a>
        <a class="evt-btn evt-btn-ghost" href="#field-local-guides">1分ガイドを見る</a>
      </div>
    </div>
    ${renderAreaHeroFeature(snapshot, stats)}
  </article>

  ${renderFieldViewerMemory(snapshot)}

  ${renderFieldPublicProfile(publicProfileView)}

  ${renderLocalGuides(encyclopedia, guideTemplates)}

  ${renderFieldAlbum(snapshot)}

  ${renderAreaSpots(encyclopedia)}

  ${renderAreaActors(encyclopedia)}

  ${renderAreaGrowthEmpty(encyclopedia)}

  ${snapshot ? renderPlaceSnapshotTeaser(snapshot) : ""}

  <section class="field-detail-metrics" aria-label="記録の厚み">
    <header>
      <div>
        <span class="evt-eyebrow">Area Records</span>
        <h2 class="evt-heading">このエリアの記録</h2>
      </div>
      <div class="field-detail-metrics-actions">
        <a class="evt-btn evt-btn-primary" href="/community/events/new?field_id=${encodeURIComponent(field.fieldId)}">ここで観察会を作る</a>
        <a class="evt-btn evt-btn-ghost" href="/community/fields">エリア一覧へ</a>
      </div>
    </header>
    <p class="evt-lead">公開範囲: ${escapeHtml(areaLabel)}。希少種や詳細位置は、場所を丸めた記録として公開します。</p>
    <div class="evt-result-stats evt-stagger">
      ${heroMetrics.map((item) => `<div><strong>${formatNumber(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}
    </div>
    <div class="field-detail-freshness"><span>最終記録</span><strong>${escapeHtml(formatObservationDate(latestObservedAt))}</strong></div>
  </section>

  ${renderFieldPublicRange(field)}

  ${renderFieldTrustInfo(field)}

  <section>
    <h2 class="evt-heading">よく見つかる種</h2>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${topTaxa}</div>
  </section>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <h2 class="evt-heading" style="margin:0;">過去・進行中の観察会</h2>
      <span class="evt-eyebrow">${stats.totalSessions}</span>
    </header>
    <div class="evt-stagger" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
      ${sessionRows}
    </div>
  </section>
</section>
`;
}

export function fieldDetailScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector("[data-field-id]");
  if (!root) return;
  const lat = Number(root.dataset.lat || 35.0);
  const lng = Number(root.dataset.lng || 138.0);
  let polygon = null;
  let areaSpots = [];
  try { polygon = JSON.parse(root.dataset.polygon || "null"); } catch(_){}
  try { areaSpots = JSON.parse(root.dataset.areaSpots || "[]"); } catch(_){}
  const mapEl = root.querySelector("[data-evt-field-map]");

  root.querySelectorAll("[data-spot-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.getAttribute("data-spot-filter") || "all";
      root.querySelectorAll("[data-spot-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      root.querySelectorAll("[data-area-spot-card]").forEach((card) => {
        const type = card.getAttribute("data-spot-type") || "";
        card.hidden = filter !== "all" && type !== filter;
      });
    });
  });

  function ensureMaplibre(){
    return new Promise((resolve) => {
      if (window.maplibregl) return resolve(window.maplibregl);
      if (!document.querySelector("link[data-evt-maplibre-css]")){
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        css.dataset.evtMaplibreCss = "1";
        document.head.appendChild(css);
      }
      const existing = document.querySelector("script[data-evt-maplibre-js]");
      if (existing){
        const i = setInterval(() => { if (window.maplibregl){ clearInterval(i); resolve(window.maplibregl); } }, 60);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      s.async = true;
      s.dataset.evtMaplibreJs = "1";
      s.onload = () => resolve(window.maplibregl);
      document.head.appendChild(s);
    });
  }

  function isPublicSpot(value){
    return value &&
      typeof value.name === "string" &&
      Number.isFinite(Number(value.lat)) &&
      Number.isFinite(Number(value.lng));
  }

  const startMap = async () => {
    if (!mapEl) return;
    const ml = await ensureMaplibre();
    if (!ml) return;
    const map = new ml.Map({
      container: mapEl,
      style: {
        version: 8,
        sources: {
          gsi: { type: "raster", tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"], tileSize: 256, attribution: "&copy; 国土地理院" }
        },
        layers: [{ id: "gsi", type: "raster", source: "gsi" }]
      },
      center: [lng, lat],
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      const polyFeature = ((polygon && polygon.type === "Polygon") || (polygon && polygon.type === "MultiPolygon"))
        ? { type: "Feature", geometry: polygon, properties: {} }
        : null;
      const bounds = new ml.LngLatBounds();
      const collect = (coords) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
          bounds.extend(coords);
          return;
        }
        coords.forEach(collect);
      };
      if (polyFeature) {
        map.addSource("evt-field", { type: "geojson", data: polyFeature });
        map.addLayer({
          id: "evt-field-fill",
          type: "fill",
          source: "evt-field",
          paint: { "fill-color": "#0f766e", "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: "evt-field-line",
          type: "line",
          source: "evt-field",
          paint: { "line-color": "#0f766e", "line-opacity": 0.92, "line-width": 2.4 },
        });
        collect(polyFeature.geometry.coordinates);
      }
      areaSpots.filter(isPublicSpot).forEach((spot) => {
        const spotLat = Number(spot.lat);
        const spotLng = Number(spot.lng);
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "field-spot-map-pin";
        marker.setAttribute("aria-label", spot.name);
        marker.title = spot.name;
        marker.innerHTML = "<span></span>";
        marker.addEventListener("click", () => {
          const card = Array.from(root.querySelectorAll("[data-area-spot-card]")).find((item) => item.getAttribute("data-spot-id") === String(spot.id || ""));
          if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        new ml.Marker({ element: marker, anchor: "bottom" }).setLngLat([spotLng, spotLat]).addTo(map);
        bounds.extend([spotLng, spotLat]);
      });
      const compact = mapEl.getBoundingClientRect().width < 720;
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: compact ? 28 : 56, maxZoom: compact ? 15 : 16, duration: 0 });
    });
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(startMap, { timeout: 800 });
  } else {
    window.setTimeout(startMap, 120);
  }
})();
`;
}

export const FIELD_DETAIL_ALBUM_STYLES = `
${RECORD_CARD_SIZING_TOKENS}
.field-detail-shell {
  max-width: 1160px;
}
.field-detail-shell .evt-result-stats {
  max-width: 900px;
}
.field-area-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
  gap: 16px;
  align-items: stretch;
  padding: clamp(18px, 3vw, 34px);
  border-radius: 22px;
  border: 1px solid rgba(15,23,42,.08);
  background: linear-gradient(135deg, rgba(240,253,250,.96), rgba(240,249,255,.94) 58%, rgba(255,251,235,.90));
  box-shadow: 0 18px 50px rgba(15,23,42,.10);
}
.field-area-hero-copy {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 12px;
}
.field-area-hero-copy h1 {
  max-width: 24ch;
  margin: 0;
  color: #0f172a;
  font-size: clamp(28px, 4vw, 46px);
  line-height: 1.08;
  font-weight: 950;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.field-area-hero-copy p {
  max-width: 62ch;
  margin: 0;
  color: #334155;
  font-size: 15px;
  line-height: 1.7;
  font-weight: 650;
}
.field-public-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-public-chips span {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,118,110,.18);
  background: rgba(255,255,255,.76);
  color: #0f766e;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
}
.field-area-hero .field-map-hero-stats div,
.field-area-hero .field-map-hero-stats-empty span {
  border-color: rgba(15,23,42,.08);
  background: rgba(255,255,255,.82);
}
.field-area-hero .field-map-hero-stats strong {
  color: #0f172a;
}
.field-area-hero .field-map-hero-stats span {
  color: #475569;
}
.field-area-hero .field-map-hero-tags span,
.field-area-hero .field-map-signals b,
.field-area-hero .field-map-signals > span {
  border-color: rgba(15,118,110,.14);
  background: rgba(255,255,255,.72);
  color: #0f766e;
}
.field-area-hero .field-map-signals > span {
  background: rgba(15,118,110,.10);
}
.field-area-feature-card {
  min-width: 0;
  min-height: 100%;
  display: grid;
  align-content: center;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.90);
  color: #0f172a;
  text-decoration: none;
  box-shadow: 0 12px 34px rgba(15,23,42,.08);
}
.field-area-feature-card.has-image {
  padding: 0;
  overflow: hidden;
  align-content: start;
}
.field-area-feature-media {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: block;
  overflow: hidden;
  background: #e7f5ef;
}
.field-area-feature-media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.field-area-feature-mark {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background:
    linear-gradient(90deg, rgba(15,118,110,.14) 1px, transparent 1px),
    linear-gradient(0deg, rgba(14,165,233,.12) 1px, transparent 1px),
    #f8fffc;
  background-size: 13px 13px, 13px 13px, auto;
  border: 1px solid rgba(15,118,110,.16);
}
.field-area-feature-body {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.field-area-feature-card.has-image .field-area-feature-body {
  padding: 16px;
}
.field-area-feature-body small {
  color: #0f766e;
  font-size: 12px;
  line-height: 1.15;
  font-weight: 950;
}
.field-area-feature-body strong {
  color: #0f172a;
  font-size: 21px;
  line-height: 1.25;
  font-weight: 950;
  overflow-wrap: anywhere;
}
.field-area-feature-body em {
  color: #475569;
  font-style: normal;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 750;
}
.field-public-range {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,.94);
  border: 1px solid rgba(15,23,42,.08);
}
.field-public-range > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-public-range .evt-heading {
  margin: 0;
}
.field-public-range-badge {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,118,110,.18);
  background: rgba(240,253,250,.96);
  color: #0f766e;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
}
.field-public-range-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.field-public-range-grid article {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.08);
  background: #ffffff;
}
.field-public-range-grid span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 900;
}
.field-public-range-grid strong {
  color: #0f172a;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 950;
  overflow-wrap: anywhere;
}
.field-public-range-grid p {
  margin: 0;
  color: #475569;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 750;
}
.field-public-profile {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(248,250,252,.94);
  border: 1px solid rgba(15,23,42,.08);
}
.field-public-profile > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.field-public-profile .evt-heading {
  margin: 0;
}
.field-public-profile-confidence {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(22,163,74,.18);
  background: rgba(236,253,245,.96);
  color: #166534;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
}
.field-public-profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.field-public-profile-grid article {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.08);
  background: #ffffff;
}
.field-public-profile-grid span {
  color: #64748b;
  font-size: 11px;
  line-height: 1.2;
  font-weight: 900;
}
.field-public-profile-grid p {
  margin: 0;
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 750;
}
.field-public-profile-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.field-public-profile-strip span {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(15,23,42,.08);
  color: #0f172a;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 850;
}
.field-public-profile-next {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: #fff7ed;
  border: 1px solid rgba(245,158,11,.2);
}
.field-public-profile-next strong {
  flex-shrink: 0;
  color: #92400e;
  font-size: 12px;
  font-weight: 950;
}
.field-public-profile-next span {
  color: #334155;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 780;
}
.field-map-hero {
  min-height: clamp(340px, 36vw, 430px);
  overflow: hidden;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
  border-radius: 24px;
  border: 1px solid rgba(15,23,42,.08);
  background: #dbeafe;
  box-shadow: 0 24px 70px rgba(15,23,42,.14);
}
.field-map-hero-map {
  position: absolute;
  inset: 0;
}
.field-map-hero-map::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(15,23,42,.04) 0%, rgba(15,23,42,.10) 42%, rgba(15,23,42,.72) 100%);
}
.field-map-hero-map .evt-live-map-canvas {
  width: 100%;
  height: 100%;
}
.field-spot-map-pin {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 2px solid #ffffff;
  border-radius: 999px 999px 999px 6px;
  background: #0f766e;
  box-shadow: 0 12px 28px rgba(15,23,42,.26);
  transform: rotate(-45deg);
  cursor: pointer;
}
.field-spot-map-pin span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ffffff;
}
.field-spot-map-pin:focus-visible {
  outline: 3px solid rgba(14,165,233,.7);
  outline-offset: 3px;
}
.field-map-hero-copy {
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  width: min(600px, calc(100% - 32px));
  margin: 16px;
  padding: clamp(18px, 2.4vw, 26px);
  border-radius: 18px;
  background: rgba(6,78,59,.88);
  color: #ffffff;
  box-shadow: 0 18px 46px rgba(15,23,42,.28);
  backdrop-filter: blur(12px);
}
.field-map-hero-copy h2 {
  max-width: 24ch;
  margin: 0;
  font-size: clamp(26px, 2.8vw, 38px);
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: 0;
}
.field-map-hero-copy p {
  max-width: 64ch;
  margin: 0;
  color: rgba(236,253,245,.90);
}
.field-map-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.field-map-hero-stats-empty {
  display: flex;
  width: fit-content;
  max-width: 100%;
}
.field-map-hero-stats div {
  min-width: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.12);
}
.field-map-hero-stats strong,
.field-map-hero-stats span {
  display: block;
}
.field-map-hero-stats strong {
  color: #ffffff;
  font-size: 22px;
  line-height: 1;
  font-weight: 950;
}
.field-map-hero-stats span {
  margin-top: 4px;
  color: rgba(236,253,245,.90);
  font-size: 11px;
  line-height: 1.2;
  font-weight: 850;
}
.field-map-hero-stats-empty span {
  margin-top: 0;
  width: fit-content;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.12);
}
.field-map-hero-tags,
.field-map-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-map-hero-tags span,
.field-map-signals b,
.field-map-signals > span {
  width: fit-content;
  max-width: 100%;
  padding: 6px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.12);
  color: #ecfdf5;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
}
.field-map-signals > span {
  background: rgba(255,255,255,.20);
}
.field-map-signals b {
  overflow-wrap: anywhere;
}
.field-detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.field-map-hero-copy .field-detail-actions {
  margin-top: 0;
}
.field-detail-freshness {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.18);
  color: #d1fae5;
}
.field-detail-freshness span {
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .08em;
}
.field-detail-freshness strong {
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
}
.field-detail-metrics {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(15,23,42,.08);
}
.field-detail-metrics > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-detail-metrics-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.field-detail-metrics .evt-heading {
  margin: 0;
}
.field-detail-metrics .field-detail-freshness {
  background: rgba(16,185,129,.10);
  border-color: rgba(16,185,129,.18);
  color: #047857;
}
.field-detail-metrics .field-detail-freshness strong {
  color: #064e3b;
}
.field-trust-info {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(248,250,252,.94);
  border: 1px solid rgba(15,23,42,.08);
}
.field-trust-info > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-trust-info .evt-heading {
  margin: 0;
}
.field-trust-status {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.18);
  color: #047857;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
}
.field-trust-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-trust-links .evt-btn-on-dark {
  background: #0f766e;
  color: #ffffff;
  border-color: rgba(15,118,110,.28);
}
.field-album {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 14px;
  background: rgba(255,255,255,.96);
  border: 1px solid rgba(15,23,42,.08);
}
.field-album > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.field-album.is-empty {
  background: linear-gradient(135deg, rgba(248,250,252,.98), rgba(240,253,250,.86));
}
.field-album-empty-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field-album-empty-card {
  min-width: 0;
  display: grid;
  gap: 7px;
  padding: 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 10px 24px rgba(15,23,42,.045);
}
.field-album-empty-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 950;
}
.field-album-empty-card p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}
.field-album-grid {
  display: grid;
  grid-template-columns: var(--ikimon-record-card-grid-desktop);
  gap: var(--ikimon-record-card-grid-gap-desktop);
}
.field-album-grid-compact {
  grid-template-columns: var(--ikimon-record-card-grid-desktop);
}
.field-album-card {
  min-width: 0;
  display: grid;
  gap: var(--ikimon-record-card-inner-gap);
  color: inherit;
  text-decoration: none;
}
.field-album-card.is-private {
  color: #0f172a;
}
.field-album-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: var(--ikimon-record-card-thumb-ratio);
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(15,23,42,.08);
  border-radius: var(--ikimon-record-card-thumb-radius);
  background:
    linear-gradient(90deg, rgba(16,185,129,.1) 1px, transparent 1px),
    linear-gradient(0deg, rgba(14,165,233,.08) 1px, transparent 1px),
    #f8fffc;
  background-size: 22px 22px, 22px 22px, auto;
  box-shadow: var(--ikimon-record-card-thumb-shadow);
}
.field-album-thumb img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  transition: transform .18s ease;
}
.field-album-card:hover .field-album-thumb img {
  transform: scale(1.025);
}
.field-album-empty-thumb {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: #e7f5ef;
  color: #047857;
}
.field-album-body {
  min-width: 0;
  display: grid;
  gap: var(--ikimon-record-card-body-gap);
}
.field-album-body strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #10251a;
  font-size: var(--ikimon-record-card-title-size);
  line-height: var(--ikimon-record-card-title-line-height);
  font-weight: 950;
}
.field-album-body small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-size: var(--ikimon-record-card-meta-size);
  line-height: var(--ikimon-record-card-meta-line-height);
  font-weight: 850;
}
.field-album-private {
  display: grid;
  gap: 3px;
  font-style: normal;
  color: #075985;
  font-size: 11px;
  font-weight: 900;
}
.field-album-private::before {
  content: "自分だけ";
  width: fit-content;
  border-radius: 999px;
  background: rgba(14,165,233,.12);
  border: 1px solid rgba(14,165,233,.22);
  padding: 3px 8px;
}
.field-album-private small {
  color: #64748b;
}
.field-memory {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,251,235,.78), rgba(240,249,255,.90));
  border: 1px solid rgba(245,158,11,.20);
}
.field-memory > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.field-area-spots,
.field-local-guides,
.field-area-actors,
.field-area-growth-empty {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 14px;
  background: rgba(255,255,255,.94);
  border: 1px solid rgba(15,23,42,.08);
}
.field-area-growth-empty {
  background: linear-gradient(135deg, rgba(248,250,252,.98), rgba(240,253,250,.90));
  border-style: dashed;
}
.field-area-growth-empty .evt-heading {
  margin: 0;
}
.field-area-growth-empty .evt-btn {
  justify-self: start;
}
.field-local-guides {
  gap: 16px;
  padding: 20px;
  background:
    linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.98) 54%, rgba(240,249,255,.88));
  border-color: rgba(16,185,129,.22);
  box-shadow: 0 18px 44px rgba(15,118,110,.08);
}
.field-area-spots > header,
.field-local-guides > header,
.field-area-actors > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.field-area-spots .evt-heading,
.field-local-guides .evt-heading,
.field-area-actors .evt-heading {
  margin: 0;
}
.field-spot-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}
.field-spot-filters button {
  min-height: 34px;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: #ffffff;
  color: #334155;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.1;
  cursor: pointer;
}
.field-spot-filters button.is-active,
.field-spot-filters button:hover {
  border-color: rgba(15,118,110,.28);
  background: rgba(240,253,250,.96);
  color: #0f766e;
}
.field-spot-grid,
.field-guide-grid,
.field-actor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.field-guide-grid {
  counter-reset: field-guide-card;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.field-spot-card,
.field-guide-card,
.field-actor-card {
  min-width: 0;
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.08);
  background: #ffffff;
  color: #0f172a;
  text-decoration: none;
}
.field-spot-card[hidden] {
  display: none;
}
.field-spot-card header,
.field-guide-card header {
  display: grid;
  gap: 6px;
}
.field-spot-card h3,
.field-guide-card h3 {
  min-width: 0;
  margin: 0;
  color: #0f172a;
  font-size: 16px;
  line-height: 1.25;
  font-weight: 950;
  overflow-wrap: anywhere;
}
.field-spot-card p,
.field-guide-card p {
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}
.field-guide-card.is-template {
  position: relative;
  min-height: 158px;
  align-content: start;
  padding: 18px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15,23,42,.055);
}
.field-guide-card.is-template::before {
  counter-increment: field-guide-card;
  content: counter(field-guide-card);
  position: absolute;
  right: 14px;
  top: 14px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #0f766e;
  color: #ffffff;
  font-size: 13px;
  font-weight: 950;
  box-shadow: 0 8px 18px rgba(15,118,110,.18);
}
.field-guide-card.is-template header {
  padding-right: 38px;
}
.field-spot-type,
.field-guide-card header span,
.field-privacy-note {
  width: fit-content;
  max-width: 100%;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(15,118,110,.10);
  color: #0f766e;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.1;
}
.field-spot-stats,
.field-spot-actors,
.field-guide-chips,
.field-external-links {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.field-spot-stats span,
.field-spot-actors span,
.field-guide-chips span,
.field-external-links a {
  width: fit-content;
  max-width: 100%;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(248,250,252,.96);
  color: #334155;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.15;
  text-decoration: none;
}
.field-spot-stats strong {
  margin-right: 4px;
  color: #0f766e;
}
.field-actor-card strong,
.field-actor-card span {
  min-width: 0;
  display: block;
  overflow-wrap: anywhere;
}
.field-actor-card strong {
  font-size: 15px;
  line-height: 1.25;
  font-weight: 950;
}
.field-actor-card span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}
.field-empty-card {
  min-height: 0;
  padding: 16px;
  border-radius: 12px;
  background: rgba(248,250,252,.82);
  box-shadow: none;
}
@media (max-width: 1020px) {
  .field-detail-shell {
    max-width: 1080px;
  }
  .field-area-hero {
    grid-template-columns: 1fr;
  }
  .field-public-range-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field-public-profile-grid {
    grid-template-columns: 1fr;
  }
  .field-map-hero {
    min-height: clamp(420px, 58vw, 500px);
  }
  .field-map-hero-copy {
    width: calc(100% - 24px);
    margin: 12px;
  }
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: var(--ikimon-record-card-grid-tablet);
    gap: var(--ikimon-record-card-grid-gap-tablet);
  }
  .field-album > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-memory > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-area-spots > header,
  .field-local-guides > header,
  .field-area-actors > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-spot-filters {
    justify-content: flex-start;
  }
  .field-detail-metrics > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-detail-metrics-actions {
    justify-content: flex-start;
  }
  .field-trust-info > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 720px) {
  .field-area-hero {
    padding: 18px;
    border-radius: 18px;
  }
  .field-area-hero-copy h1 {
    font-size: 30px;
  }
  .field-area-hero .field-map-hero-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .field-public-range > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-public-profile > header,
  .field-public-profile-next {
    display: grid;
  }
  .field-public-range-grid {
    grid-template-columns: 1fr;
  }
  .field-map-hero {
    min-height: 0;
    grid-template-rows: clamp(156px, 42vw, 208px) auto;
    align-items: stretch;
    border-radius: 18px;
  }
  .field-map-hero-map {
    position: relative;
    inset: auto;
    min-height: clamp(156px, 42vw, 208px);
  }
  .field-map-hero-map::after {
    background: linear-gradient(180deg, rgba(15,23,42,.02) 0%, rgba(15,23,42,.10) 100%);
  }
  .field-map-hero-copy {
    width: 100%;
    margin: 0;
    padding: 18px;
    border-radius: 0;
    background: #064e3b;
    box-shadow: none;
    backdrop-filter: none;
  }
  .field-map-hero-copy h2 {
    font-size: clamp(24px, 7.5vw, 31px);
  }
  .field-map-hero-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .field-map-hero-stats div {
    width: fit-content;
    padding: 6px 9px;
    border-radius: 999px;
  }
  .field-map-hero-stats strong,
  .field-map-hero-stats span {
    display: inline;
  }
  .field-map-hero-stats strong {
    margin-right: 4px;
    font-size: 14px;
  }
  .field-map-hero-stats span {
    margin-top: 0;
    font-size: 11px;
  }
  .field-spot-grid,
  .field-guide-grid,
  .field-actor-grid {
    grid-template-columns: 1fr;
  }
  .field-local-guides {
    padding-top: 74px;
  }
  .field-album-empty-grid {
    grid-template-columns: 1fr;
  }
  .field-map-hero-copy p {
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    font-size: 14px;
    line-height: 1.55;
  }
  .field-map-signals {
    max-height: 64px;
    overflow: hidden;
  }
  .field-map-hero-copy .field-detail-actions .evt-btn {
    flex: 1 1 150px;
    min-height: 44px;
    padding: 8px 12px;
  }
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: var(--ikimon-record-card-grid-mobile);
    gap: var(--ikimon-record-card-grid-gap-mobile);
  }
  .field-album-card {
    gap: var(--ikimon-record-card-inner-gap-mobile);
  }
  .field-album-thumb {
    border-radius: var(--ikimon-record-card-thumb-radius-mobile);
    box-shadow: var(--ikimon-record-card-thumb-shadow-mobile);
  }
  .field-album-body {
    gap: var(--ikimon-record-card-body-gap-mobile);
  }
  .field-album-body strong {
    font-size: var(--ikimon-record-card-title-size-mobile);
    line-height: var(--ikimon-record-card-title-line-height-mobile);
  }
  .field-album-body small {
    font-size: var(--ikimon-record-card-meta-size);
  }
}
@media (max-width: 480px) {
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: var(--ikimon-record-card-grid-mobile);
    gap: var(--ikimon-record-card-grid-gap-compact);
  }
}
`;
