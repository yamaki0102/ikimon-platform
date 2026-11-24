import { recordsDiscoveryDetailHref, recordsDiscoveryListHref, type RecordsDiscoveryContext } from "./recordsDiscoveryContext";
import { renderObservationOwnerDeletePanel, renderObservationOwnerDeleteScript } from "../../src/ui/observationOwnerDelete";
import { APP_EXPERIENCE_STYLES, renderAppExperienceHeader, renderAppExperienceNavigation, renderAppExperienceQuickCamera } from "../../src/ui/appExperience";
import type { ObservationFirstCard, ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { isPublicObservationAiSubjectEligible } from "./publicObservationAiPresentation";
import {
  observationFirstRecordDetailCopy,
  type ObservationFirstRecordDetailCopy,
  type ObservationRecordLang,
} from "./observationFirstRecordDetailI18n";
import { PRODUCTION_PUBLIC_ORIGIN } from "../../src/services/trustedPublicOrigin";
import type {
  OwnerPublicationExclusionCode,
  OwnerPublicationReturn,
  OwnerPublicationReviewState,
} from "../../src/services/publicationSyndication";

export type ObservationFirstMediaPresentation = {
  mediaId: string;
  mediaKind: "photo" | "video" | "audio";
  url: string | null;
};

export type ObservationFirstRelatedPresentation = {
  recordId: string;
  title: string;
  observedLabel: string;
  photoUrl: string | null;
};

export type ObservationFirstDetectionState = "detected" | "not_detected" | "not_assessable";

export function isObservationDetectionEvidence(item: ObservationFirstCard): boolean {
  if (item.state !== "active") return false;
  return item.assertionStatus === "human_asserted"
    || item.acceptedIdentification !== null
    || item.communityIdentifications.length > 0
    || item.aiSuggestions.length > 0;
}

export function resolveObservationFirstDetectionState(
  activeEvidenceObservationCount: number,
  aiAssessmentStatus: string | null | undefined,
  aiRequestStatus: string | null | undefined,
): ObservationFirstDetectionState | null {
  if (aiAssessmentStatus === "completed_no_candidate") return "not_detected";
  if (aiAssessmentStatus === "completed_not_assessable") return "not_assessable";
  if (activeEvidenceObservationCount > 0) return "detected";
  if (aiRequestStatus === "failed") return "not_assessable";
  return null;
}

export type ObservationFirstComparisonPresentation = {
  summary: string;
  comparedRecordId: string;
  comparedObservedLabel: string;
};

export type ObservationFirstAiCandidateInsight = {
  name: string;
  scientificName: string | null;
  supportingFeatures: string[];
  missingFeatures: string[];
  contradictions: string[];
  probability?: number | null;
  howToTell?: string | null;
};

export type ObservationFirstRecordPresentation = {
  lang?: ObservationRecordLang;
  recordsDiscoveryContext?: RecordsDiscoveryContext | null;
  title: string;
  titleIsFallback?: boolean;
  observedLabel: string;
  note: string | null;
  publicLocationLabel?: string | null;
  locationProtectionLabel?: string | null;
  detectionState?: ObservationFirstDetectionState | null;
  sceneElements?: string[];
  media: ObservationFirstMediaPresentation[];
  environment?: Record<string, string> | null;
  humanExpertCommentsHtml?: string;
  comparison?: ObservationFirstComparisonPresentation | null;
  aiCandidateInsights?: ObservationFirstAiCandidateInsight[];
  /** Server-only primary identity mapping, never serialized into this page. */
  aiPersonPrimaryNames?: readonly string[];
  aiFeedback?: string | null;
  customTitle?: string | null;
  signboardTitle?: string | null;
  aiNextPhoto?: string | null;
  mediaDedup?: {
    sourcePhotoCount: number;
    representativePhotoCount: number;
    excludedPhotoCount: number;
  } | null;
  related?: ObservationFirstRelatedPresentation[];
  canonicalUrl?: string;
  shareUrl?: string;
  actionNonce: string;
  processingMessage?: string | null;
  processingStatusPanel?: string | null;
  savedControlHtml?: string;
  savedScriptHtml?: string;
  notice?: string | null;
  viewerAuthenticated?: boolean;
  publicationReturn?: OwnerPublicationReturn | null;
};

const escapeHtml = (value: unknown): string => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const hidden = (name: string, value: string): string => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;
const forbiddenPublicMediaLocator = /(?:[?&#/]|^)(?:lat|lng|longitude|latitude|cell(?:id)?|mesh|geohash|coordinate|h3)[=_:/-]|[-+]?\d{1,2}\.\d{4,}\s*[,/]\s*[-+]?\d{2,3}\.\d{4,}/iu;
const forbiddenEmptyCopy = /対象はまだ分けられていません|人から記録された同定候補はまだありません|名前は未決定|割り当てられたメディアはありません|確認待ち|みんなの確認はまだありません|名前の提案を募集中|みんなに聞く|(?:^|\D)0件/u;

const template = (value: string, name: string): string => value.replace("{name}", name);
const mediaLabel = (kind: ObservationFirstMediaPresentation["mediaKind"], copy: ObservationFirstRecordDetailCopy): string => kind === "photo" ? copy.photo : kind === "video" ? copy.video : copy.audio;
const langPrefix = (lang: ObservationRecordLang): string => `/${lang}`;
const internalSubjectPlaceholder = /^(?:unidentified|unknown(?:[_ -]subject)?|unclassified|unspecified)$/iu;

const publicSubjectName = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && !internalSubjectPlaceholder.test(normalized) ? normalized : null;
};

const displayAiSuggestions = (card: ObservationFirstCard, personPrimaryNames?: readonly string[]): ObservationFirstCard["aiSuggestions"] => card.aiSuggestions
  .filter((item) => isPublicObservationAiSubjectEligible(item.proposedName, personPrimaryNames, item.proposedScientificName));

const isHumanOnlyAiCard = (card: ObservationFirstCard, personPrimaryNames?: readonly string[]): boolean => card.aiSuggestions
  .some((item) => !isPublicObservationAiSubjectEligible(item.proposedName, personPrimaryNames, item.proposedScientificName))
  && !displayAiSuggestions(card, personPrimaryNames).some((item) => publicSubjectName(item.proposedName) || publicSubjectName(item.proposedScientificName));

const subjectTypeName = (card: ObservationFirstCard, copy: ObservationFirstRecordDetailCopy): string => {
  if (card.subjectType === "pet") return copy.subjectTypes.pet;
  if (card.subjectType === "group") return copy.subjectTypes.group;
  if (card.subjectType === "trace") return copy.subjectTypes.trace;
  if (card.subjectType === "sound") return copy.subjectTypes.sound;
  if (card.subjectType === "unknown_subject") return copy.subjectTypes.unknown_subject;
  return copy.subjectTypes.organism;
};

const safeMedia = (items: ObservationFirstMediaPresentation[]): ObservationFirstMediaPresentation[] => {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (seen.has(item.mediaId) || !item.url || forbiddenPublicMediaLocator.test(item.url)) return [];
    seen.add(item.mediaId);
    return [item];
  });
};

function renderRecordMedia(items: ObservationFirstMediaPresentation[], title: string, copy: ObservationFirstRecordDetailCopy): string {
  if (items.length === 0) return "";
  const slides = items.map((item, index) => {
    const label = `${title} — ${mediaLabel(item.mediaKind, copy)} ${index + 1}`;
    if (item.mediaKind === "photo") {
      return `<figure class="of-media-slide" id="record-media-${index + 1}"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-of-photo-trigger data-of-photo-src="${escapeHtml(item.url)}" data-of-photo-alt="${escapeHtml(label)}" aria-label="${escapeHtml(copy.enlargePhoto)}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(label)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ""}></a></figure>`;
    }
    if (item.mediaKind === "video") {
      return `<figure class="of-media-slide" id="record-media-${index + 1}"><video controls preload="metadata" aria-label="${escapeHtml(label)}" src="${escapeHtml(item.url)}"><a href="${escapeHtml(item.url)}">${escapeHtml(copy.openVideo)}</a></video></figure>`;
    }
    return `<figure class="of-media-slide is-audio" id="record-media-${index + 1}"><div class="of-audio-mark" aria-hidden="true">♪</div><audio controls preload="metadata" aria-label="${escapeHtml(label)}" src="${escapeHtml(item.url)}"><a href="${escapeHtml(item.url)}">${escapeHtml(copy.openAudio)}</a></audio></figure>`;
  }).join("");
  const navigation = items.length > 1
    ? `<nav class="of-media-nav" aria-label="${escapeHtml(copy.mediaNavigation)}">${items.map((item, index) => `<a href="#record-media-${index + 1}" aria-label="${escapeHtml(`${mediaLabel(item.mediaKind, copy)} ${index + 1}`)}">${index + 1}</a>`).join("")}</nav>`
    : "";
  return `<section class="of-media-stage" aria-label="${escapeHtml(copy.media)}"><div class="of-media-gallery" tabindex="0">${slides}</div>${navigation}</section>`;
}

function renderPhotoLightbox(hasPhotos: boolean, copy: ObservationFirstRecordDetailCopy): string {
  if (!hasPhotos) return "";
  return `<div class="of-lightbox" data-of-lightbox role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.enlargePhoto)}" hidden><button type="button" class="of-lightbox-toggle" data-of-lightbox-toggle data-zoom-actual="${escapeHtml(copy.zoomActual)}" data-zoom-fit="${escapeHtml(copy.zoomFit)}" aria-pressed="false">${escapeHtml(copy.zoomActual)}</button><button type="button" class="of-lightbox-close" data-of-lightbox-close aria-label="${escapeHtml(copy.closeZoom)}">✕ ${escapeHtml(copy.closeZoom)}</button><div class="of-lightbox-inner" data-of-lightbox-inner><img class="of-lightbox-img is-fit" data-of-lightbox-img alt=""></div></div>`;
}

function renderPhotoLightboxScript(hasPhotos: boolean): string {
  if (!hasPhotos) return "";
  return `<script data-of-lightbox-script>
(function(){
  var lb = document.querySelector('[data-of-lightbox]');
  if (!lb) return;
  var inner = lb.querySelector('[data-of-lightbox-inner]');
  var img = lb.querySelector('[data-of-lightbox-img]');
  var toggle = lb.querySelector('[data-of-lightbox-toggle]');
  var closeBtn = lb.querySelector('[data-of-lightbox-close]');
  if (!inner || !img || !toggle || !closeBtn) return;
  var lastTrigger = null;
  var drag = null;
  var dragged = false;
  function setActual(actual) {
    img.classList.toggle('is-actual', actual);
    img.classList.toggle('is-fit', !actual);
    toggle.setAttribute('aria-pressed', actual ? 'true' : 'false');
    toggle.textContent = actual ? (toggle.getAttribute('data-zoom-fit') || '') : (toggle.getAttribute('data-zoom-actual') || '');
  }
  function open(src, alt, trigger) {
    lastTrigger = trigger || null;
    img.src = src;
    img.alt = alt || '';
    setActual(false);
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function close() {
    lb.hidden = true;
    img.removeAttribute('src');
    document.documentElement.style.overflow = '';
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    lastTrigger = null;
  }
  document.addEventListener('click', function(e) {
    var trigger = e.target && e.target.closest ? e.target.closest('[data-of-photo-trigger]') : null;
    if (!trigger) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var src = trigger.getAttribute('data-of-photo-src') || trigger.getAttribute('href');
    if (!src) return;
    e.preventDefault();
    open(src, trigger.getAttribute('data-of-photo-alt') || '', trigger);
  });
  toggle.addEventListener('click', function() { setActual(!img.classList.contains('is-actual')); });
  closeBtn.addEventListener('click', close);
  lb.addEventListener('click', function(e) {
    if (e.target === lb || e.target === inner) close();
  });
  img.addEventListener('click', function() {
    if (dragged) { dragged = false; return; }
    setActual(!img.classList.contains('is-actual'));
  });
  img.addEventListener('pointerdown', function(e) {
    if (!img.classList.contains('is-actual') || e.button !== 0) return;
    dragged = false;
    drag = { x: e.clientX, y: e.clientY, sl: lb.scrollLeft, st: lb.scrollTop };
    img.classList.add('is-dragging');
    try { img.setPointerCapture(e.pointerId); } catch (_) {}
  });
  img.addEventListener('pointermove', function(e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged = true;
    lb.scrollLeft = drag.sl - dx;
    lb.scrollTop = drag.st - dy;
  });
  function endDrag(e) {
    if (!drag) return;
    drag = null;
    img.classList.remove('is-dragging');
    try { img.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  img.addEventListener('pointerup', endDrag);
  img.addEventListener('pointercancel', endDrag);
  document.addEventListener('keydown', function(e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
})();
</script>`;
}

const observationName = (card: ObservationFirstCard, copy: ObservationFirstRecordDetailCopy, personPrimaryNames?: readonly string[]): { text: string; ai: boolean } => {
  const acceptedName = publicSubjectName(card.acceptedIdentification?.proposedName);
  if (acceptedName) return { text: acceptedName, ai: false };
  const suggestedName = displayAiSuggestions(card, personPrimaryNames)
    .map((item) => publicSubjectName(item.proposedName) ?? publicSubjectName(item.proposedScientificName))
    .find((item): item is string => item !== null);
  if (suggestedName) return { text: template(copy.candidateTemplate, suggestedName), ai: true };
  const genericLabels = new Set(["名前を決めていない対象", "観察した生きもの", "飼育されている生きもの"]);
  const hasHumanClaim = card.assertionStatus === "human_asserted" || card.acceptedIdentification || card.communityIdentifications.length > 0;
  const subjectLabel = hasHumanClaim || isPublicObservationAiSubjectEligible(card.subjectLabel, personPrimaryNames)
    ? publicSubjectName(card.subjectLabel) : null;
  return { text: !subjectLabel || genericLabels.has(subjectLabel) ? subjectTypeName(card, copy) : subjectLabel, ai: false };
};

const japaneseAiProse = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const englishAiProse = /\b[A-Za-z]{3,}(?:[ -]+[A-Za-z]{3,}){2,}\b/u;

function aiProseForLang(value: string, lang: ObservationRecordLang): string | null {
  if (lang !== "ja") return value;
  return japaneseAiProse.test(value) && !englishAiProse.test(value) ? value : null;
}

function aiProseListForLang(values: string[], lang: ObservationRecordLang): string[] {
  return values.flatMap((value) => {
    const localized = aiProseForLang(value, lang);
    return localized ? [localized] : [];
  });
}

function renderLearning(
  card: ObservationFirstCard,
  copy: ObservationFirstRecordDetailCopy,
  lang: ObservationRecordLang,
  personPrimaryNames?: readonly string[],
  excludedEvidence: ReadonlySet<string> = new Set(),
  nextPhotoItem: string | null = null,
): string {
  const suggestion = displayAiSuggestions(card, personPrimaryNames).map((item) => ({
    visualEvidence: aiProseListForLang(item.visualEvidence, lang).filter((text) => !excludedEvidence.has(text)),
    shootingAdvice: aiProseListForLang(item.shootingAdvice, lang).filter((text) => {
      if (!nextPhotoItem) return true;
      const concise = conciseNextPhotoItem(text);
      return concise !== nextPhotoItem && !text.includes(nextPhotoItem) && !nextPhotoItem.includes(concise) && !/実物の生体詳細/.test(text);
    }),
  })).find((item) => item.visualEvidence.length > 0 || item.shootingAdvice.length > 0);
  if (!suggestion) return "";
  const visible = suggestion.visualEvidence.slice(0, 2);
  const advice = suggestion.shootingAdvice.slice(0, 2);
  return `<section class="of-learning" aria-labelledby="of-learning-title"><h3 id="of-learning-title">${escapeHtml(copy.learning)}</h3>
    ${visible.length ? `<section><h4>${escapeHtml(copy.distinguishingPoints)}</h4><ul>${visible.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    ${advice.length ? `<section><h4>${escapeHtml(copy.shootingAdvice)}</h4><ul>${advice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
  </section>`;
}

function renderAiCandidateComparison(
  card: ObservationFirstCard,
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
  nextPhotoItem: string | null = null,
): string {
  if (card.acceptedIdentification || !presentation.aiCandidateInsights?.length) return "";
  const candidates = presentation.aiCandidateInsights
    .filter((candidate) => isPublicObservationAiSubjectEligible(candidate.name, presentation.aiPersonPrimaryNames, candidate.scientificName)).slice(0, 3);
  if (candidates.length === 0) return "";
  return `<section class="of-candidate-comparison" aria-labelledby="of-candidate-comparison-title"><h3 id="of-candidate-comparison-title">${escapeHtml(copy.compareCandidates)}</h3><ul>${candidates.map((candidate) => {
    const scientificName = candidate.scientificName && candidate.scientificName !== candidate.name
      ? `<small><i>${escapeHtml(candidate.scientificName)}</i></small>`
      : "";
    const lang = presentation.lang ?? "ja";
    const supporting = aiProseListForLang(candidate.supportingFeatures, lang).slice(0, 2);
    const uncertainty = aiProseListForLang([...candidate.missingFeatures, ...candidate.contradictions], lang)
      .filter((text) => {
        if (!nextPhotoItem) return true;
        const concise = conciseNextPhotoItem(text);
        return concise !== nextPhotoItem && !text.includes(nextPhotoItem) && !nextPhotoItem.includes(concise) && !/実物の生体詳細/.test(text);
      })
      .slice(0, 1);
    const p = typeof candidate.probability === "number" ? candidate.probability : null;
    const likely = p === null ? "" : `<em class="of-likely" data-likely="${p >= 0.6 ? "high" : p >= 0.2 ? "mid" : "low"}">${escapeHtml(p >= 0.6 ? copy.likelyHigh : p >= 0.2 ? copy.likelyMid : copy.likelyLow)}</em>`;
    const how = candidate.howToTell ? aiProseListForLang([candidate.howToTell], lang)[0] : undefined;
    return `<li><strong>${escapeHtml(candidate.name)}</strong>${scientificName}${likely}${how ? `<span><b>${escapeHtml(copy.distinguishingPoints)}</b> ${escapeHtml(how)}</span>` : ""}${supporting.length ? `<span><b>${escapeHtml(copy.candidateEvidence)}</b> ${escapeHtml(supporting.join("、"))}</span>` : ""}${uncertainty.length ? `<span><b>${escapeHtml(copy.candidateUncertainty)}</b> ${escapeHtml(uncertainty[0])}</span>` : ""}</li>`;
  }).join("")}</ul></section>`;
}

function environmentFallbackFeedback(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
  lang: ObservationRecordLang,
): string | null {
  const activeCount = detail.observations.filter((card) => card.state === "active").length;
  if (activeCount > 0 && presentation.detectionState !== "not_detected") return null;
  const env = presentation.environment;
  const placeHeadline = env?.place_type && env.place_type !== "unknown" ? copy.environmentHeadlines[env.place_type] : null;
  const detailLabels = (["contact_surface", "surrounding_cover", "environment_condition", "human_change"] as const).flatMap((field) => {
    const val = env?.[field];
    const label = val && val !== "unknown" ? copy.environmentValues[val] : null;
    return label ? [label] : [];
  });
  const sceneLabels = (presentation.sceneElements ?? derivedSceneElements(env))
    .filter((item) => sceneElementKeys.has(item) && copy.sceneElements[item])
    .map((item) => copy.sceneElements[item]);
  const parts = [...new Set([...detailLabels, ...sceneLabels])].slice(0, 3);
  if (!placeHeadline && parts.length === 0) return null;
  const sep = lang === "ja" ? "・" : ", ";
  if (lang === "ja") {
    const summary = placeHeadline && parts.length > 0
      ? `${placeHeadline}（${parts.join(sep)}）`
      : placeHeadline ?? `${parts.join(sep)}`;
    return summary;
  }
  const summary = placeHeadline && parts.length > 0
    ? `${placeHeadline} (${parts.join(sep)}).`
    : placeHeadline ? `${placeHeadline}.` : `${parts.join(sep)}.`;
  return summary;
}

function conciseNextPhotoItem(value: string): string {
  return value
    .trim()
    .replace(/の詳細(?:が|の)(?:わかる|分かる)部位・角度.*$/u, "")
    .replace(/(?:が|の)(?:わかる|分かる)部位・角度.*$/u, "")
    .replace(/(?:が|の)(?:わかる|分かる)角度からの?(?:撮影(?:してください)?)?。?$/u, "")
    .replace(/(?:を撮影すると|が撮れると|の撮影をおすすめします)[^。]*。?$/u, "")
    .trim() || value.trim();
}

const adviceProsePattern = /(?:おすすめします|伝わりやすくなります|比べやすくなります|残すと|撮影することで|確認すると)/u;

const SIGNBOARD_CANDIDATE_PATTERN = /案内板|看板|イラスト|パノラマ図|案内図|標柱|掲示板|ポスター|パンフレット|signboard|illustration|diagram/u;

export function isSignboardRecord(detail: ObservationFirstRecordDetail, presentation: Pick<ObservationFirstRecordPresentation, "title" | "note" | "aiFeedback" | "aiCandidateInsights">): boolean {
  const hasHumanAccepted = detail.observations.some((card) => card.state === "active" && Boolean(publicSubjectName(card.acceptedIdentification?.proposedName)));
  if (hasHumanAccepted) return false;
  if (SIGNBOARD_CANDIDATE_PATTERN.test(presentation.title)) return true;
  for (const c of presentation.aiCandidateInsights ?? []) {
    if (SIGNBOARD_CANDIDATE_PATTERN.test(c.name)) return true;
  }
  for (const card of detail.observations) {
    if (card.state !== "active") continue;
    for (const s of card.aiSuggestions) {
      if (s.proposedName && SIGNBOARD_CANDIDATE_PATTERN.test(s.proposedName)) return true;
    }
  }
  return false;
}

function renderAiFeedback(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
): string {
  if (isSignboardRecord(detail, presentation)) return "";
  const lang = presentation.lang ?? "ja";
  const subjects = detail.observations.filter((card) => card.state === "active").flatMap((card) => [
    ...card.aiSuggestions,
    ...(card.acceptedIdentification ? [card.acceptedIdentification] : []),
    ...card.communityIdentifications,
  ]).map((subject) => [subject.proposedName, subject.proposedScientificName]);
  subjects.push(...(presentation.aiCandidateInsights ?? []).map((candidate) => [candidate.name, candidate.scientificName]));
  const eligible = (names: Array<string | null>) => isPublicObservationAiSubjectEligible(names[0], presentation.aiPersonPrimaryNames, names[1]);
  const humanOnly = subjects.some((names) => !eligible(names))
    && !subjects.some((names) => eligible(names) && names.some((name) => publicSubjectName(name)));
  const rawFeedback = (presentation.aiFeedback ? aiProseForLang(presentation.aiFeedback, lang) : null)
    ?? (!humanOnly ? environmentFallbackFeedback(detail, presentation, copy, lang) : null);
  const feedback = rawFeedback && !adviceProsePattern.test(rawFeedback) ? rawFeedback : null;
  const defaultEnvironmentNextPhoto = !humanOnly && !presentation.aiFeedback && rawFeedback && lang === "ja"
    ? "足元・水際・植生の境目"
    : null;
  const rawNextPhoto = (!humanOnly && presentation.aiNextPhoto ? aiProseForLang(presentation.aiNextPhoto, lang) : null)
    ?? defaultEnvironmentNextPhoto;
  const nextPhoto = rawNextPhoto ? conciseNextPhotoItem(rawNextPhoto) : null;
  const feedbackAiNote = presentation.customTitle?.trim() ? copy.aiGeneratedNote : copy.aiGeneratedTitleAndNote;
  if (nextPhoto) {
    return `<section class="of-note" data-ai-feedback aria-labelledby="of-ai-feedback-title"><h2 id="of-ai-feedback-title">${escapeHtml(copy.aiFeedbackTitle)}</h2><p>${escapeHtml(copy.aiNextPhotoTitle)}：${escapeHtml(nextPhoto)}</p><p class="of-ai-note">${escapeHtml(feedbackAiNote)}</p></section>`;
  }
  if (!feedback) return "";
  return `<section class="of-note" data-ai-feedback aria-labelledby="of-ai-feedback-title"><h2 id="of-ai-feedback-title">${escapeHtml(copy.aiFeedbackTitle)}</h2><p>${escapeHtml(feedback)}</p><p class="of-ai-note">${escapeHtml(feedbackAiNote)}</p></section>`;
}

function renderIdentificationForm(
  card: ObservationFirstCard,
  index: number,
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  action: string,
  copy: ObservationFirstRecordDetailCopy,
): string {
  const allowed = card.state === "active" && (detail.owner || detail.proposalPolicy.identification);
  if (!allowed) return "";
  if (!detail.owner && !presentation.viewerAuthenticated) {
    const lang = presentation.lang ?? "ja";
    const continuation = recordsDiscoveryDetailHref(detail.recordId, lang, presentation.recordsDiscoveryContext ?? null);
    return `<a class="of-login-proposal" href="${escapeHtml(`${langPrefix(lang)}/login?redirect=${encodeURIComponent(continuation)}`)}">${escapeHtml(copy.loginToPropose)}</a>`;
  }
  const common = hidden("observation_id", card.observationId) + hidden("return_lang", presentation.lang ?? "ja");
  return `<details class="of-propose"><summary>${escapeHtml(copy.proposeName)}</summary><form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "identify")}${hidden("operation_id", `${presentation.actionNonce}-${index}-identify`)}<label>${escapeHtml(copy.proposedName)}<input name="proposed_name" required maxlength="160" autocomplete="off"></label><label>${escapeHtml(copy.proposalNote)}<textarea name="note" rows="2" maxlength="500"></textarea></label><button type="submit">${escapeHtml(copy.saveProposal)}</button></form></details>`;
}

function renderObservationDetail(
  card: ObservationFirstCard,
  index: number,
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  action: string,
  copy: ObservationFirstRecordDetailCopy,
  options: { omitHeading?: boolean; omitAiSuggestions?: boolean; omitLoginLink?: boolean } = {},
): string {
  const display = observationName(card, copy, presentation.aiPersonPrimaryNames);
  const common = hidden("observation_id", card.observationId) + hidden("return_lang", presentation.lang ?? "ja");
  const acceptedName = publicSubjectName(card.acceptedIdentification?.proposedName);
  const accepted = acceptedName
    ? `<div class="of-record-name"><span>${escapeHtml(copy.roleRecorderConfirmed)}</span><strong>${escapeHtml(acceptedName)}</strong></div>`
    : "";
  const aiNames = options.omitAiSuggestions
    ? []
    : displayAiSuggestions(card, presentation.aiPersonPrimaryNames).flatMap((item) => {
        const name = publicSubjectName(item.proposedName) ?? publicSubjectName(item.proposedScientificName);
        return name ? [name] : [];
      });
  const ai = aiNames.length > 0
    ? `<section class="of-ai-detail"><h4>${escapeHtml(copy.aiFound)}</h4><ul>${aiNames.map((name) => `<li><strong>${escapeHtml(name)}</strong><span>${escapeHtml(copy.photoCandidate)}</span></li>`).join("")}</ul></section>`
    : "";
  const proposals = card.communityIdentifications.filter((item) => !item.accepted && publicSubjectName(item.proposedName));
  const groupedProposals = [...proposals.reduce((map, item) => {
    const entry = map.get(item.proposedName) ?? { first: item, count: 0 };
    entry.count += 1;
    map.set(item.proposedName, entry);
    return map;
  }, new Map<string, { first: (typeof proposals)[number]; count: number }>()).values()];
  const proposalList = groupedProposals.length > 0
    ? `<section class="of-proposals"><h4>${escapeHtml(copy.proposals)}</h4><ul>${groupedProposals.map(({ first, count }, claimIndex) => {
        const roleLabel = count > 1 ? copy.roleOtherPeopleCount.replace("{count}", String(count)) : copy.roleOtherPerson;
        return `<li><span>${escapeHtml(first.proposedName)} <small>(${escapeHtml(roleLabel)})</small></span>${detail.owner ? `<form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "accept_identification")}${hidden("identification_id", first.claimId)}${hidden("operation_id", `${presentation.actionNonce}-${index}-accept-${claimIndex}`)}<button type="submit">${escapeHtml(copy.acceptName)}</button></form>` : ""}</li>`;
      }).join("")}</ul></section>`
    : "";
  const form = options.omitLoginLink && !detail.owner && !presentation.viewerAuthenticated
    ? ""
    : renderIdentificationForm(card, index, detail, presentation, action, copy);
  const heading = options.omitHeading ? "" : `<h3>${escapeHtml(display.text)}</h3>`;
  if (!heading && !accepted && !ai && !proposalList && !form) return "";
  return `<article class="of-observation-detail">${heading}${accepted}${ai}${proposalList}${form}</article>`;
}

function renderObservationSummary(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  action: string,
  copy: ObservationFirstRecordDetailCopy,
): string {
  if (isSignboardRecord(detail, presentation)) {
    return "";
  }
  const active = detail.observations.filter((card) => card.state === "active"
    && (card.assertionStatus === "human_asserted" || card.acceptedIdentification || card.communityIdentifications.length > 0 || !isHumanOnlyAiCard(card, presentation.aiPersonPrimaryNames)));
  if (active.length === 0) return "";
  const hasCardInsights = Boolean(presentation.aiCandidateInsights?.length);
  const resolved = active.map((card) => ({
    card,
    ...observationName(card, copy, presentation.aiPersonPrimaryNames),
    accepted: Boolean(publicSubjectName(card.acceptedIdentification?.proposedName)),
    communityProposal: card.communityIdentifications.some((item) => !item.accepted && publicSubjectName(item.proposedName)),
  }));
  const meaningful = resolved.filter((item) => item.accepted || item.ai || item.communityProposal);
  const summaryItems = meaningful.length > 0 ? meaningful.slice(0, 3) : [];
  const seenNames = new Set<string>();
  const list = summaryItems.flatMap((item) => {
    if (seenNames.has(item.text)) return [];
    seenNames.add(item.text);
    const status = item.accepted ? copy.roleRecorderConfirmed : item.ai ? copy.aiCandidate : item.communityProposal ? copy.roleOtherPerson : "";
    return [`<li${item.ai ? ' data-ai-candidate="true"' : ""}><strong>${escapeHtml(item.text)}</strong>${status ? `<small>${escapeHtml(status)}</small>` : ""}</li>`];
  }).join("");
  const nextPhotoItem = presentation.aiNextPhoto ? conciseNextPhotoItem(presentation.aiNextPhoto) : null;
  const comparison = renderAiCandidateComparison(active[0]!, presentation, copy, nextPhotoItem);
  const comparisonEvidence = new Set(
    (presentation.aiCandidateInsights ?? []).flatMap((candidate) => aiProseListForLang(candidate.supportingFeatures, presentation.lang ?? "ja")),
  );
  const learning = renderLearning(active[0]!, copy, presentation.lang ?? "ja", presentation.aiPersonPrimaryNames, comparison ? comparisonEvidence : new Set(), nextPhotoItem);
  const detailCards = (meaningful.length > 0 ? meaningful.map((item) => item.card) : active.slice(0, 1))
    .map((card, index) => renderObservationDetail(card, index, detail, presentation, action, copy, {
      omitHeading: meaningful.length > 0 || seenNames.size > 0,
      omitAiSuggestions: hasCardInsights || summaryItems.some((item) => item.ai),
      omitLoginLink: true,
    }))
    .filter(Boolean);
  const detailsBlock = detailCards.length > 0
    ? `<details class="of-observation-details"><summary>${escapeHtml(detailCards.length > 1 ? copy.openAll : copy.openDetails)}</summary><div>${detailCards.join("")}</div></details>`
    : "";
  const loginToPropose = !detail.owner && !presentation.viewerAuthenticated && active.some((card) => detail.proposalPolicy.identification)
    ? renderIdentificationForm(active[0]!, 0, detail, presentation, action, copy)
    : "";
  const summaryIsAi = Boolean(presentation.aiCandidateInsights?.length)
    || active.some((card) => !publicSubjectName(card.acceptedIdentification?.proposedName) && displayAiSuggestions(card, presentation.aiPersonPrimaryNames).length > 0);
  const aiNote = summaryIsAi ? `<p class="of-ai-note">${escapeHtml(copy.aiGeneratedExplanationNote)}</p>` : "";
  if (!list && !learning && !comparison && !detailsBlock && !loginToPropose) return "";
  return `<section class="of-summary" aria-labelledby="of-summary-title"><h2 id="of-summary-title">${escapeHtml(copy.found)}</h2>${list ? `<ul class="of-summary-list">${list}</ul>` : ""}${learning}${comparison}${aiNote}${detailsBlock}${loginToPropose}</section>`;
}

const sceneElementKeys = new Set(["water", "low_grass", "trees_shrubs", "bare_ground", "built_surface", "soil", "plant", "rock", "artificial", "urban", "coast", "wetland"]);

function derivedSceneElements(environment: Record<string, string> | null | undefined): string[] {
  if (!environment) return [];
  const mappings: Array<[string, Record<string, string>]> = [
    ["place_type", { water_edge: "water", wetland: "wetland", coast: "coast", woodland: "trees_shrubs", urban: "urban", grassland_urban_edge: "low_grass" }],
    ["contact_surface", { water: "water", soil_gravel_litter: "soil", soil: "soil", plant: "plant", rock: "rock", artificial: "artificial" }],
    ["surrounding_cover", { water: "water", low_grass: "low_grass", trees_shrubs: "trees_shrubs", bare_ground: "bare_ground", built_surface: "built_surface" }],
  ];
  const found = mappings.flatMap(([field, values]) => {
    if (environment[`${field}_source`] !== "derived") return [];
    const key = values[environment[field] ?? ""];
    return key ? [key] : [];
  });
  return [...new Set(found)].slice(0, 8);
}

function renderSceneUnderstanding(presentation: ObservationFirstRecordPresentation, copy: ObservationFirstRecordDetailCopy, signboard = false): string {
  if (signboard) {
    const lang = presentation.lang ?? "ja";
    const signLabel = lang === "ja" ? "案内板" : lang === "es" ? "Cartel informativo" : lang === "pt-br" ? "Placa informativa" : "Signboard";
    return `<section class="of-scene" aria-labelledby="of-scene-title"><h2 id="of-scene-title">${escapeHtml(copy.sceneFound)}</h2><p>${escapeHtml(copy.subjectTypes.unknown_subject)}：${escapeHtml(signLabel)}</p><p class="of-ai-note">${escapeHtml(copy.aiGeneratedExplanationNote)}</p></section>`;
  }
  const rawElements = presentation.sceneElements ?? derivedSceneElements(presentation.environment);
  const elements = [...new Set(rawElements)].filter((item) => sceneElementKeys.has(item) && copy.sceneElements[item]).slice(0, 8);
  const state = presentation.detectionState;
  if (!state && elements.length === 0) return "";
  if (state === "detected" && elements.length === 0) return "";
  const stateMessage = state === "not_detected" ? copy.notDetected : state === "not_assessable" ? copy.notAssessable : "";
  return `<section class="of-scene" aria-labelledby="of-scene-title"><h2 id="of-scene-title">${escapeHtml(copy.sceneFound)}</h2>${elements.length ? `<ul>${elements.map((item) => `<li>${escapeHtml(copy.sceneElements[item])}</li>`).join("")}</ul>` : ""}${stateMessage ? `<p class="of-detection-state" data-detection-state="${escapeHtml(state ?? "")}">${escapeHtml(stateMessage)}</p>` : ""}</section>`;
}

function renderComparison(comparison: ObservationFirstComparisonPresentation | null | undefined, lang: ObservationRecordLang, copy: ObservationFirstRecordDetailCopy): string {
  if (!comparison?.summary.trim() || !comparison.comparedObservedLabel.trim() || !/^[A-Za-z0-9:_-]{1,180}$/u.test(comparison.comparedRecordId)) return "";
  return `<section class="of-comparison" aria-labelledby="of-comparison-title"><h2 id="of-comparison-title">${escapeHtml(copy.previousChange)}</h2><p>${escapeHtml(comparison.summary.trim())}</p><a href="${escapeHtml(`${langPrefix(lang)}/observations/${encodeURIComponent(comparison.comparedRecordId)}`)}">${escapeHtml(template(copy.comparedWith, comparison.comparedObservedLabel.trim()))}</a></section>`;
}

function renderEnvironment(environment: Record<string, string> | null | undefined, copy: ObservationFirstRecordDetailCopy): string {
  if (!environment) return "";
  const placeType = environment.place_type;
  const rows = (["contact_surface", "surrounding_cover", "environment_condition", "human_change"] as const).flatMap((field) => {
    const value = environment[field];
    const label = value && value !== "unknown" ? copy.environmentValues[value] : null;
    return label ? [`<li><span>${escapeHtml(copy.environmentFields[field])}</span><strong>${escapeHtml(label)}</strong></li>`] : [];
  });
  const headline = placeType && placeType !== "unknown" ? copy.environmentHeadlines[placeType] : null;
  if (!headline && rows.length === 0) return "";
  const inferred = environment.environment_record_status === "auto_draft"
    || Object.keys(environment).some((key) => key.endsWith("_source") && environment[key] === "derived");
  return `<section class="of-environment" aria-labelledby="of-environment-title"><h2 id="of-environment-title">${escapeHtml(copy.placeSummary)}</h2>${headline ? `<p class="of-environment-headline">${escapeHtml(headline)}</p>` : ""}${rows.length ? `<ul>${rows.join("")}</ul>` : ""}${inferred ? `<p class="of-ai-note">${escapeHtml(copy.aiGeneratedEnvironmentNote)}</p>` : ""}</section>`;
}

function selectOptions(values: Record<string, string>, selected?: string): string {
  return Object.entries(values).map(([value, label]) => `<option value="${escapeHtml(value)}"${selected === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function renderOwnerManagement(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  media: ObservationFirstMediaPresentation[],
  action: string,
  copy: ObservationFirstRecordDetailCopy,
): string {
  if (!detail.owner) return "";
  const lang = presentation.lang ?? "ja";
  const returnLang = hidden("return_lang", lang);
  if (isSignboardRecord(detail, presentation)) {
    return "";
  }
  const active = detail.observations.filter((card) => card.state === "active");
  const subjectTypes = {
    unknown_subject: copy.subjectTypes.unknown_subject,
    organism: copy.subjectTypes.organism,
    group: copy.subjectTypes.group,
    trace: copy.subjectTypes.trace,
    sound: copy.subjectTypes.sound,
  };
  const add = `<section><h3>${escapeHtml(copy.addSubject)}</h3><form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "add")}${hidden("operation_id", `${presentation.actionNonce}-add`)}<label>${escapeHtml(copy.subjectName)}<input name="display_name" maxlength="160" autocomplete="off" placeholder="${escapeHtml(copy.subjectNameExample)}"></label><label>${escapeHtml(copy.subjectType)}<select name="subject_type">${selectOptions(subjectTypes)}</select></label><label>${escapeHtml(copy.context)}<select name="captive_context">${selectOptions(copy.contexts)}</select></label><button type="submit">${escapeHtml(copy.add)}</button></form></section>`;
  const cards = detail.observations.map((card, index) => {
    const common = returnLang + hidden("observation_id", card.observationId);
    if (card.state === "excluded") {
      return `<section class="of-manage-subject"><h3>${escapeHtml(observationName(card, copy, presentation.aiPersonPrimaryNames).text)}</h3><form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "restore")}${hidden("operation_id", `${presentation.actionNonce}-${index}-restore`)}<button type="submit">${escapeHtml(copy.restore)}</button></form></section>`;
    }
    const mergeTargets = active.filter((candidate) => candidate.observationId !== card.observationId);
    return `<section class="of-manage-subject"><h3>${escapeHtml(observationName(card, copy, presentation.aiPersonPrimaryNames).text)}</h3>
      <form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "split")}${hidden("operation_id", `${presentation.actionNonce}-${index}-split`)}<label>${escapeHtml(copy.separateName)}<input name="display_name" maxlength="160" autocomplete="off"></label><label>${escapeHtml(copy.subjectType)}<select name="subject_type">${selectOptions(subjectTypes)}</select></label><button type="submit">${escapeHtml(copy.separate)}</button></form>
      ${mergeTargets.length ? `<form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "merge")}${hidden("operation_id", `${presentation.actionNonce}-${index}-merge`)}<label>${escapeHtml(copy.combineWith)}<select name="target_observation_id">${mergeTargets.map((candidate) => `<option value="${escapeHtml(candidate.observationId)}">${escapeHtml(observationName(candidate, copy, presentation.aiPersonPrimaryNames).text)}</option>`).join("")}</select></label><button type="submit">${escapeHtml(copy.combine)}</button></form>` : ""}
      <form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "exclude")}${hidden("reason", "not_visible_in_record")}${hidden("operation_id", `${presentation.actionNonce}-${index}-exclude`)}<button class="is-secondary" type="submit">${escapeHtml(copy.notVisible)}</button></form>
    </section>`;
  }).join("");
  const mediaAssignment = media.length > 0 && active.length > 0
    ? `<section><h3>${escapeHtml(copy.assignMedia)}</h3><p>${escapeHtml(copy.assignMediaLead)}</p>${media.map((item, index) => `<form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "media_reassign")}${hidden("media_id", item.mediaId)}${hidden("operation_id", `${presentation.actionNonce}-media-${index}`)}<label>${escapeHtml(mediaLabel(item.mediaKind, copy))}<select name="target_observation_id">${active.map((card) => `<option value="${escapeHtml(card.observationId)}">${escapeHtml(observationName(card, copy, presentation.aiPersonPrimaryNames).text)}</option>`).join("")}</select></label><button type="submit">${escapeHtml(copy.assign)}</button></form>`).join("")}</section>`
    : "";
  const visibilitySettings = `<section><h3>${escapeHtml(copy.visibilitySettings)}</h3><p>${escapeHtml(copy.visibilityLead)}</p><form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "set_visibility")}${hidden("operation_id", `${presentation.actionNonce}-visibility-${detail.visibility}`)}<label>${escapeHtml(copy.visibilitySettings)}<select name="visibility">${selectOptions({ public: copy.visibility.public, private: copy.visibility.private }, detail.visibility === "public" ? "public" : "private")}</select></label><button type="submit">${escapeHtml(copy.saveVisibility)}</button></form></section>`;
  const policy = detail.visibility !== "private"
    ? `<section><form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "set_proposal_policy")}${hidden("accepts_identification_proposals", detail.proposalPolicy.identification ? "0" : "1")}${hidden("operation_id", `${presentation.actionNonce}-policy-${detail.proposalPolicy.identification ? "off" : "on"}`)}<button class="is-secondary" type="submit">${escapeHtml(detail.proposalPolicy.identification ? copy.pauseProposals : copy.receiveProposals)}</button></form></section>`
    : "";
  return `<details class="of-manage" id="manage"><summary>${escapeHtml(copy.manage)}</summary><p class="of-manage-lead">${escapeHtml(copy.manageLead)}</p><div class="of-manage-body" id="of-manage-body">${visibilitySettings}${add}${cards}${mediaAssignment}${policy}${renderObservationOwnerDeletePanel({basePath:"",visitId:detail.recordId,isOwner:detail.owner,lang:presentation.lang === "pt-br" ? "pt-BR" : presentation.lang ?? "ja"})}</div></details>`;
}

function renderCaptureInfo(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  media: ObservationFirstMediaPresentation[],
  copy: ObservationFirstRecordDetailCopy,
): string {
  const observedLabel = presentation.observedLabel.trim() || (presentation.lang === "ja" || !presentation.lang ? "日時不明" : presentation.lang === "es" ? "Fecha desconocida" : presentation.lang === "pt-br" ? "Data desconhecida" : "Date unknown");
  const counts = (["photo", "video", "audio"] as const).flatMap((kind) => {
    const count = media.filter((item) => item.mediaKind === kind).length;
    return count > 0 ? [`${copy[kind]} ${count}`] : [];
  }).join(" · ");
  return `<details class="of-capture" open><summary>${escapeHtml(copy.captureInfo)}</summary><dl><div><dt>${escapeHtml(copy.capturedAt)}</dt><dd>${escapeHtml(observedLabel)}</dd></div><div><dt>${escapeHtml(copy.place)}</dt><dd>${escapeHtml(presentation.publicLocationLabel ?? detail.privacy.publicLocationLabel)}</dd></div><div><dt>${escapeHtml(copy.scope)}</dt><dd>${escapeHtml(copy.visibility[detail.visibility])}</dd></div>${counts ? `<div><dt>${escapeHtml(copy.mediaCount)}</dt><dd>${escapeHtml(counts)}</dd></div>` : ""}</dl></details>`;
}

function publicationReviewLabel(state: OwnerPublicationReviewState, copy: ObservationFirstRecordDetailCopy): string {
  switch (state) {
    case "approved": return copy.publicationReviewApproved;
    case "changes_requested": return copy.publicationReviewChangesRequested;
    case "held": return copy.publicationReviewHeld;
    case "rejected": return copy.publicationReviewRejected;
    case "withdrawn": return copy.publicationReviewWithdrawn;
    default: return copy.publicationReviewNotReviewed;
  }
}

function publicationExclusionLabel(code: OwnerPublicationExclusionCode | null, copy: ObservationFirstRecordDetailCopy): string | null {
  switch (code) {
    case "record_not_public": return copy.publicationExclusionRecordNotPublic;
    case "review_not_approved": return copy.publicationExclusionReviewNotApproved;
    case "destination_not_configured": return copy.publicationExclusionDestinationNotConfigured;
    case "destination_not_consented": return copy.publicationExclusionConsentRequired;
    case "minor_status_unresolved": return copy.publicationExclusionMinorUnknown;
    case "guardian_authority_unresolved": return copy.publicationExclusionGuardianUnknown;
    case "guardian_authority_withdrawn": return copy.publicationExclusionGuardianWithdrawn;
    case "record_withdrawn":
    case "syndication_consent_withdrawn": return copy.publicationExclusionWithdrawn;
    case null:
    case undefined: return null;
    default: return copy.publicationExclusionDefault;
  }
}

function publicationStateLabel(state: OwnerPublicationReturn["publication"]["state"], copy: ObservationFirstRecordDetailCopy): string {
  switch (state) {
    case "eligible": return copy.publicationEligible;
    case "published": return copy.publicationPublished;
    case "excluded": return copy.publicationExcluded;
    default: return copy.publicationNotReady;
  }
}

function renderOwnerPublicationReturn(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
): string {
  const publicationReturn = presentation.publicationReturn;
  if (!detail.owner || !publicationReturn) return "";
  const destinationItems = publicationReturn.publication.destinations.map((destination) => {
    const label = destination.feedKey === "miyakoda-renri-area"
      ? copy.publicationDestinationMiyakoda
      : destination.label;
    const status = destination.status === "published"
      ? copy.publicationReadBack
      : destination.status === "eligible"
        ? copy.publicationConfigured
        : copy.publicationExcluded;
    const exclusion = publicationExclusionLabel(destination.exclusionCode, copy);
    return `<li data-publication-destination-status="${escapeHtml(destination.status)}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(status)}</span><small>${escapeHtml(copy.publicationProductionReadonly)} · ${escapeHtml(copy.publicationPolicyVersion)}: ${escapeHtml(destination.sourceVersion)}${exclusion ? ` · ${escapeHtml(exclusion)}` : ""}</small></li>`;
  }).join("");
  const exclusion = publicationExclusionLabel(publicationReturn.publication.exclusionCode, copy);
  return `<section class="of-publication-return" data-publication-return="owner-only" aria-labelledby="of-publication-return-title"><h2 id="of-publication-return-title">${escapeHtml(copy.publicationReturnTitle)}</h2><dl><div><dt>${escapeHtml(copy.publicationReview)}</dt><dd data-publication-review-state="${escapeHtml(publicationReturn.review.state)}">${escapeHtml(publicationReviewLabel(publicationReturn.review.state, copy))}</dd></div><div><dt>${escapeHtml(copy.publicationEligibility)}</dt><dd data-publication-state="${escapeHtml(publicationReturn.publication.state)}">${escapeHtml(publicationStateLabel(publicationReturn.publication.state, copy))}</dd></div></dl>${destinationItems ? `<h3>${escapeHtml(copy.publicationDestinations)}</h3><ul>${destinationItems}</ul>` : ""}${exclusion ? `<p class="of-publication-exclusion" data-publication-exclusion><strong>${escapeHtml(copy.publicationExclusion)}</strong> ${escapeHtml(exclusion)}</p>` : ""}</section>`;
}

export function extractSignboardQuote(
  detail: ObservationFirstRecordDetail,
  presentation: Pick<ObservationFirstRecordPresentation, "note" | "aiFeedback" | "aiCandidateInsights" | "signboardTitle">,
): string | null {
  const direct = presentation.signboardTitle?.trim();
  if (direct) return direct;
  const candidates: Array<string | null | undefined> = [
    presentation.note,
    presentation.aiFeedback,
    ...(presentation.aiCandidateInsights ?? []).flatMap((item) => item.supportingFeatures),
    ...detail.observations.filter((card) => card.state === "active").flatMap((card) => card.aiSuggestions.flatMap((s) => s.visualEvidence)),
  ];
  for (const text of candidates) {
    if (!text) continue;
    const match = text.match(/[「『]([^」』]{2,60})[」』]/u);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function resolveSignboardTitle(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
  lang: ObservationRecordLang,
): string {
  if (!presentation.titleIsFallback && !SIGNBOARD_CANDIDATE_PATTERN.test(presentation.title) && !forbiddenEmptyCopy.test(presentation.title) && presentation.title !== copy.natureRecord) {
    return presentation.title;
  }
  const extracted = extractSignboardQuote(detail, presentation);
  if (extracted) return extracted;
  return lang === "ja" ? "まちの記録" : lang === "es" ? "Registro urbano" : lang === "pt-br" ? "Registro urbano" : "Town record";
}

function renderRelated(items: ObservationFirstRelatedPresentation[] | undefined, lang: ObservationRecordLang, copy: ObservationFirstRecordDetailCopy): string {
  if (!items?.length) return "";
  const cards = items.slice(0, 6).map((item) => {
    const safePhoto = item.photoUrl && !forbiddenPublicMediaLocator.test(item.photoUrl) ? item.photoUrl : null;
    const quoted = item.title.match(/[「『]([^」』]{2,60})[」』]/u)?.[1]?.trim();
    const title = quoted
      ? quoted
      : forbiddenEmptyCopy.test(item.title) || SIGNBOARD_CANDIDATE_PATTERN.test(item.title)
        ? copy.relatedRecord
        : item.title;
    return `<a class="of-related-card${safePhoto ? "" : " has-no-photo"}" href="${escapeHtml(`${langPrefix(lang)}/observations/${encodeURIComponent(item.recordId)}`)}">${safePhoto ? `<img src="${escapeHtml(safePhoto)}" alt="" loading="lazy" decoding="async">` : ""}<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(item.observedLabel)}</small></span></a>`;
  }).join("");
  return `<section class="of-related" aria-labelledby="of-related-title"><h2 id="of-related-title">${escapeHtml(copy.related)}</h2><div>${cards}</div></section>`;
}

export function renderObservationFirstRecordDetailHtml(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
): string {
  const lang = presentation.lang ?? "ja";
  const copy = observationFirstRecordDetailCopy(lang);
  const media = safeMedia(presentation.media);
  const signboard = isSignboardRecord(detail, presentation);
  const customTitle = presentation.customTitle?.trim() || null;
  const title = customTitle
    ? customTitle
    : signboard
      ? resolveSignboardTitle(detail, presentation, copy, lang)
      : presentation.titleIsFallback || forbiddenEmptyCopy.test(presentation.title)
        ? copy.natureRecord
        : presentation.title;
  const action = `/api/v1/records/${encodeURIComponent(detail.recordId)}/observation-actions`;
  const canonicalUrl = presentation.canonicalUrl ?? `${PRODUCTION_PUBLIC_ORIGIN}/${lang}/observations/${encodeURIComponent(detail.recordId)}`;
  const shareUrl = presentation.shareUrl ?? canonicalUrl;
  const prefix = langPrefix(lang);
  const cleanStatus = presentation.processingMessage && !forbiddenEmptyCopy.test(presentation.processingMessage) ? presentation.processingMessage : null;
  const processingStatusPanel = presentation.processingStatusPanel?.trim() ?? "";
  const duplicateNotice = detail.owner && presentation.mediaDedup && presentation.mediaDedup.excludedPhotoCount > 0
    ? copy.similarPhotosHidden.replace("{count}", String(presentation.mediaDedup.excludedPhotoCount))
    : null;
  const languageLinks = (["ja", "en", "es", "pt-br"] as const).map((item) => `<a href="${escapeHtml(recordsDiscoveryDetailHref(detail.recordId, item, presentation.recordsDiscoveryContext ?? null))}" lang="${escapeHtml(item)}"${item === lang ? ' aria-current="page"' : ""}>${escapeHtml(item === "ja" ? "JP" : item === "pt-br" ? "PT" : item.toUpperCase())}</a>`).join("");
  const menu = `<details class="of-menu"><summary aria-label="${escapeHtml(copy.menu)}"><span aria-hidden="true">•••</span></summary><nav aria-label="${escapeHtml(copy.menu)}"><a href="${prefix}/">${escapeHtml(copy.home)}</a><a href="${escapeHtml(recordsDiscoveryListHref(lang, presentation.recordsDiscoveryContext ?? null))}">${escapeHtml(copy.records)}</a><div aria-label="${escapeHtml(copy.language)}">${languageLinks}</div></nav></details>`;
  const hasPhotos = media.some((item) => item.mediaKind === "photo");
  const mediaStage = renderRecordMedia(media, title, copy);
  const photoLightbox = renderPhotoLightbox(hasPhotos, copy);
  const photoLightboxScript = renderPhotoLightboxScript(hasPhotos);
  const summary = renderObservationSummary(detail, { ...presentation, lang }, action, copy);
  const aiFeedback = renderAiFeedback(detail, presentation, copy);
  const scene = renderSceneUnderstanding(presentation, copy, signboard);
  const environment = renderEnvironment(presentation.environment, copy);
  const resetTitleForm = customTitle
    ? `<form method="post" action="${escapeHtml(action)}">${hidden("action", "reset_title")}${hidden("return_lang", lang)}${hidden("operation_id", `${presentation.actionNonce}-title-reset`)}<button type="submit" class="is-secondary">${escapeHtml(copy.resetTitle)}</button></form>`
    : "";
  const titleEditForm = detail.owner
    ? `<details class="of-title-edit"><summary>${escapeHtml(copy.editTitle)}</summary><form method="post" action="${escapeHtml(action)}">${hidden("action", "set_title")}${hidden("return_lang", lang)}${hidden("operation_id", `${presentation.actionNonce}-title`)}<input name="title" value="${escapeHtml(title)}" maxlength="120" required aria-label="${escapeHtml(copy.editTitle)}"><button type="submit">${escapeHtml(copy.saveTitle)}</button></form>${resetTitleForm}</details>`
    : "";
  const titleBlock = `<div class="of-title-row"><h1>${escapeHtml(title)}</h1>${titleEditForm}</div>`;
  const comparison = renderComparison(presentation.comparison, lang, copy);
  const note = presentation.note?.trim() ? `<section class="of-note" aria-labelledby="of-note-title"><h2 id="of-note-title">${escapeHtml(copy.note)}</h2><p>${escapeHtml(presentation.note.trim())}</p></section>` : "";
  const publicationReturn = renderOwnerPublicationReturn(detail, { ...presentation, lang }, copy);
  const management = renderOwnerManagement(detail, { ...presentation, lang }, media, action, copy);
  const capture = renderCaptureInfo(detail, presentation, media, copy);
  const related = renderRelated(presentation.related, lang, copy);
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareUrl)}`;
  const publicLocation = presentation.publicLocationLabel ?? detail.privacy.publicLocationLabel;
  const redundantBlurLabel = !presentation.locationProtectionLabel?.trim()
    && detail.visibility === "public"
    && /ぼか|blur|approx/i.test(publicLocation);
  const locationProtection = redundantBlurLabel
    ? ""
    : presentation.locationProtectionLabel?.trim() || (detail.visibility === "public" ? copy.approximateLocation : copy.exactLocationPrivate);
  const observedLabel = presentation.observedLabel.trim() || (lang === "ja" ? "日時不明" : lang === "es" ? "Fecha desconocida" : lang === "pt-br" ? "Data desconhecida" : "Date unknown");
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | ${escapeHtml(copy.documentSuffix)}</title>
  <style>
    :root{color-scheme:light;--ink:#16231c;--muted:#607067;--line:#dce7e0;--paper:#fff;--wash:#f4f8f5;--green:#0a7b57;--soft:#edf7f2;--focus:#f59e0b}*{box-sizing:border-box}html{overflow-x:hidden;scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;overflow-wrap:anywhere}a{color:#0b6f61}button,input,select,textarea{font:inherit}a,button,input,select,textarea,summary{min-height:44px}:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.of-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;min-height:58px;padding:6px max(12px,calc((100vw - 1320px)/2));background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.of-back{display:inline-flex;align-items:center;gap:7px;padding:0 10px;color:var(--ink);font-weight:800;text-decoration:none}.of-menu{position:relative}.of-menu>summary{display:grid;place-items:center;width:48px;cursor:pointer;list-style:none;border-radius:999px;font-weight:900}.of-menu>summary::-webkit-details-marker{display:none}.of-menu nav{position:absolute;right:0;top:50px;display:grid;width:min(270px,calc(100vw - 24px));padding:10px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(15,35,25,.18)}.of-menu:not([open]) nav{display:none}.of-menu nav>a{display:flex;align-items:center;padding:8px 10px;border-radius:10px;font-weight:800;text-decoration:none}.of-menu nav div{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding-top:8px;border-top:1px solid var(--line)}.of-menu nav div a{display:grid;place-items:center;border-radius:9px;text-decoration:none}.of-menu [aria-current="page"]{background:var(--soft);font-weight:900}.of-page{width:min(1320px,100%);margin:0 auto 56px}.of-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,440px);align-items:start}.of-layout.has-no-media{grid-template-columns:minmax(0,700px);justify-content:center}.of-layout.has-no-media .of-media-column{display:none}.of-media-column{position:sticky;top:58px;min-width:0}.of-media-stage{position:relative;display:grid;align-items:center;min-height:calc(100vh - 58px);background:#101713;color:#fff}.of-media-gallery{display:flex;width:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;overscroll-behavior-x:contain}.of-media-slide{display:grid;place-items:center;flex:0 0 100%;min-width:0;min-height:min(74vw,calc(100vh - 96px));margin:0;scroll-snap-align:start}.of-media-slide a{display:grid;place-items:center;width:100%;min-height:inherit}.of-media-slide img{display:block;width:auto;max-width:100%;height:auto;max-height:calc(100vh - 96px);object-fit:contain}.of-media-slide video{display:block;width:100%;height:auto;max-height:calc(100vh - 96px);object-fit:contain}.of-media-slide.is-audio{align-content:center;gap:22px;padding:32px}.of-media-slide audio{width:min(520px,100%)}.of-audio-mark{font-size:72px;line-height:1;color:#9be7c9}.of-media-nav{display:flex;justify-content:center;gap:8px;padding:10px 12px;background:#101713}.of-media-nav a{display:grid;place-items:center;min-width:44px;min-height:44px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font-weight:800;text-decoration:none}.of-media-nav a:hover,.of-media-nav a:focus-visible{background:rgba(255,255,255,.3)}.of-panel{min-width:0;padding:28px 24px 48px;background:#fff;min-height:calc(100vh - 58px);border-left:1px solid var(--line)}.of-layout.has-no-media .of-panel{border-left:0}.of-record-info h1{margin:0;font-size:clamp(27px,3vw,38px);line-height:1.22;letter-spacing:-.02em}.of-meta{display:grid;gap:5px;margin:14px 0 18px;color:var(--muted)}.of-meta p{display:flex;align-items:flex-start;gap:8px;margin:0}.of-meta p span:first-child{font-weight:800;color:var(--ink)}.of-meta .of-location-protection{color:#365848;font-weight:750}.of-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}.of-action{display:inline-flex;align-items:center;justify-content:center;padding:9px 15px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font-weight:850;text-decoration:none}.of-action.is-primary{border-color:var(--green);background:var(--green);color:#fff}.of-status{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:var(--soft)}.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture,.of-publication-return{margin-top:14px;padding:17px;border:1px solid var(--line);border-radius:17px;background:#fff}.of-summary{background:linear-gradient(150deg,#effaf5,#fff 55%)}.of-summary h2,.of-scene h2,.of-environment h2,.of-comparison h2,.of-note h2,.of-publication-return h2{margin:0 0 9px;font-size:19px;line-height:1.35}.of-summary-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.of-summary-list li{position:relative;display:grid;padding-left:18px;font-size:17px}.of-summary-list li:before{content:"";position:absolute;left:1px;top:.72em;width:7px;height:7px;border-radius:50%;background:var(--green)}.of-summary-list li strong{font-weight:850}.of-summary-list li small{color:var(--muted);font-size:13px}.of-learning{display:grid;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}.of-learning>h3{margin:0;font-size:17px}.of-learning h4{margin:0 0 5px;font-size:15px}.of-learning ul{margin:0;padding-left:20px;color:#33473c}.of-scene{background:#f5f8fb}.of-scene ul{display:flex;flex-wrap:wrap;gap:7px;margin:0;padding:0;list-style:none}.of-scene li{padding:5px 10px;border:1px solid #cbd8df;border-radius:999px;background:#fff;font-weight:750}.of-detection-state{margin:11px 0 0;color:#33473c}.of-comparison p{margin:0 0 6px}.of-comparison a{display:inline-flex;align-items:center;font-weight:800}.of-publication-return{background:#f7faf0}.of-publication-return dl{display:grid;gap:8px;margin:0}.of-publication-return dl div{display:grid;grid-template-columns:minmax(100px,.8fr) minmax(0,1.2fr);gap:10px}.of-publication-return dt{color:var(--muted)}.of-publication-return dd{margin:0;font-weight:800}.of-publication-return h3{margin:13px 0 5px;font-size:16px}.of-publication-return ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}.of-publication-return li{display:grid;gap:1px;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:#fff}.of-publication-return li span{font-weight:800}.of-publication-return li small,.of-publication-exclusion{color:var(--muted);font-size:14px}.of-publication-exclusion{margin:12px 0 0}.of-observation-details,.of-propose{margin-top:12px}.of-observation-details>summary,.of-propose>summary,.of-manage>summary,.of-capture>summary{display:flex;align-items:center;cursor:pointer;color:var(--green);font-weight:900;list-style-position:inside}.of-observation-detail{margin-top:12px;padding:14px;border-radius:13px;background:var(--wash)}.of-observation-detail h3{margin:0 0 8px;font-size:17px}.of-record-name{display:grid;margin-bottom:9px}.of-record-name span,.of-ai-detail span{color:var(--muted);font-size:13px}.of-ai-detail h4,.of-proposals h4{margin:10px 0 5px;font-size:14px}.of-ai-detail ul,.of-proposals ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}.of-ai-detail li{display:grid}.of-proposals li{display:flex;align-items:center;justify-content:space-between;gap:8px}.of-proposals form{margin:0}.of-proposals button{padding:7px 11px}.of-propose form,.of-manage form{display:grid;gap:8px;margin-top:9px}.of-propose label,.of-manage label{display:grid;gap:4px;font-weight:800}.of-propose input,.of-propose textarea,.of-manage input,.of-manage select{width:100%;padding:9px 10px;border:1px solid #aebfb5;border-radius:10px;background:#fff}.of-propose button,.of-manage button{border:0;border-radius:11px;background:var(--green);color:#fff;font-weight:900;padding:10px 13px}.of-manage button.is-secondary{border:1px solid var(--line);background:#fff;color:var(--ink)}.of-login-proposal{display:inline-flex;align-items:center;margin-top:10px;font-weight:850}.of-environment{background:#f7faf0}.of-environment-headline{margin:0 0 8px;font-weight:850}.of-environment ul{display:grid;gap:5px;margin:0;padding:0;list-style:none}.of-environment li{display:grid;grid-template-columns:minmax(112px,.75fr) minmax(0,1.25fr);gap:10px}.of-environment li span{color:var(--muted)}.of-environment small{display:block;margin-top:9px;color:var(--muted)}.of-note p{margin:0;white-space:pre-wrap}.of-manage>summary,.of-capture>summary{color:var(--ink)}.of-manage-lead{margin:3px 0 0;color:var(--muted);font-size:14px}.of-manage-body{display:grid;gap:14px;padding-top:11px}.of-manage-body>section{padding-top:12px;border-top:1px solid var(--line)}.of-manage-body>section:first-child{padding-top:0;border-top:0}.of-manage h3{margin:0;font-size:16px}.of-manage p{margin:5px 0;color:var(--muted);font-size:14px}.of-capture dl{display:grid;gap:8px;margin:11px 0 0}.of-capture dl div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px}.of-capture dt{color:var(--muted)}.of-capture dd{margin:0;font-weight:750}.of-related{padding:24px}.of-related h2{margin:0 0 12px;font-size:21px}.of-related>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.of-related-card{display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;min-height:76px;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none}.of-related-card.has-no-photo{grid-template-columns:minmax(0,1fr)}.of-related-card img{width:76px;height:76px;object-fit:cover}.of-related-card span{display:grid;padding:8px 10px}.of-related-card small{color:var(--muted)}@media(max-width:899px){.of-layout{display:flex;flex-direction:column}.of-media-column{position:static;width:100%}.of-media-stage{min-height:0}.of-media-slide{min-height:min(82vh,133vw)}.of-media-slide img,.of-media-slide video{max-height:min(82vh,133vw)}.of-panel{width:100%;min-height:0;padding:22px 16px 38px;border-left:0}.of-related{padding:18px 16px}.of-related>div{display:flex;overflow-x:auto;gap:10px;scroll-snap-type:x proximity;padding-bottom:8px}.of-related-card{flex:0 0 min(76vw,300px);scroll-snap-align:start}.of-record-info h1{font-size:29px}.of-observation-details[open],.of-manage[open]{position:fixed;inset:58px 0 0;z-index:60;margin:0;padding:16px;overflow-y:auto;border-radius:0;background:#fff}.of-observation-details[open]>summary,.of-manage[open]>summary{position:sticky;top:0;z-index:2;padding:8px 0;background:#fff;border-bottom:1px solid var(--line)}}@media(max-width:390px){.of-header{padding-inline:6px}.of-panel{padding:19px 12px 34px}.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture,.of-publication-return{padding:14px;border-radius:14px}.of-related{padding-inline:12px}.of-environment li{grid-template-columns:1fr;gap:0}.of-capture dl div,.of-publication-return dl div{grid-template-columns:92px minmax(0,1fr)}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.of-media-gallery,.of-related>div{scroll-behavior:auto}}
    .of-candidate-comparison{display:grid;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}.of-candidate-comparison>h3{margin:0;font-size:17px}.of-candidate-comparison>p{margin:0;color:var(--muted);font-size:14px}.of-candidate-comparison>ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.of-candidate-comparison li{display:grid;gap:3px;padding:10px;border-radius:11px;background:#fff}.of-candidate-comparison li small{color:var(--muted)}.of-candidate-comparison li span{font-size:14px;color:#33473c}.of-candidate-comparison li b{font-size:12px;color:var(--muted)}.of-likely{justify-self:start;font-style:normal;font-size:12px;padding:1px 8px;border-radius:99px;background:#e8ece9;color:#33473c}.of-likely[data-likely="high"]{background:#2f6f4a;color:#fff}
  #of-manage-body{scroll-margin-top:88px}.of-manage .obs-owner-delete{display:flex;flex-wrap:wrap;align-items:center;gap:12px;border-top:1px solid #dce2dc;padding-top:20px}.of-manage .obs-owner-delete-button{color:#a32920;background:#fff;border:1px solid currentColor;min-height:44px}.of-manage .obs-owner-delete-status{font-size:14px}.of-manage .obs-owner-tool-label{font-weight:700}
  ${APP_EXPERIENCE_STYLES}
  :root{--ink:var(--zukan-text-primary);--muted:var(--zukan-text-secondary);--line:var(--zukan-border-decorative);--paper:var(--zukan-surface-base);--wash:var(--zukan-surface-subtle);--green:var(--zukan-action-primary);--soft:var(--zukan-surface-subtle);--focus:var(--zukan-focus-yellow-300)}
  .of-header{background:var(--paper)}.of-menu nav,.of-panel,.of-action,.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture,.of-publication-return,.of-scene li,.of-publication-return li,.of-candidate-comparison li,.of-propose input,.of-propose textarea,.of-manage input,.of-manage select,.of-manage button.is-secondary,.of-related-card{background:var(--paper);color:var(--ink)}
  .of-summary,.of-scene,.of-environment,.of-publication-return{background:var(--paper)}.of-learning ul,.of-detection-state,.of-candidate-comparison li span,.of-meta .of-location-protection{color:var(--muted)}
  .of-action.is-primary,.of-propose button,.of-manage button{color:var(--zukan-on-action-primary,#fff)}
  [data-ai-feedback]{border-color:var(--green);background:var(--soft)}
  body[data-zukan-app-experience] .of-note[data-ai-feedback]{margin-top:14px;padding:17px;border:1px solid var(--green);border-radius:17px;background:var(--soft);background-image:linear-gradient(150deg,rgba(36,92,58,.08),transparent 70%)}
  .of-ai-box{margin-top:14px;padding:17px;border:1px solid var(--green);border-radius:17px;background:var(--soft)}.of-ai-box>h2{margin:0 0 10px;font-size:19px}
  .of-media-nav{display:flex;justify-content:center;gap:8px;padding:10px 12px;background:var(--paper);border-top:1px solid var(--line)}.of-media-nav a{display:grid;place-items:center;min-width:44px;min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--ink);font-weight:800;text-decoration:none}.of-media-nav a:hover,.of-media-nav a:focus-visible{background:var(--green);color:var(--zukan-on-action-primary,#fff)}
  @media(min-width:900px){body[data-zukan-app-experience] .of-media-stage{min-height:0}body[data-zukan-app-experience] .of-media-slide{min-height:calc(100vh - 96px);aspect-ratio:auto}body[data-zukan-app-experience] .of-media-slide a{min-height:calc(100vh - 96px)}body[data-zukan-app-experience] .of-media-slide :is(img,video){width:100%;height:calc(100vh - 96px);max-height:calc(100vh - 96px);object-fit:contain}}
  @media(max-width:899px){.of-page{margin-bottom:calc(88px + env(safe-area-inset-bottom,0px))}.of-observation-details[open],.of-manage[open],.of-observation-details[open]>summary,.of-manage[open]>summary{background:var(--paper)}}
  .of-related-card img{display:block;width:76px;height:76px;object-fit:cover;flex-shrink:0}
  .of-meta-visibility{display:inline-flex;align-items:center;width:fit-content;padding:2px 10px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--ink);font-size:13px;font-weight:800}
  :focus-visible{outline:2px solid var(--zukan-focus-outline);outline-offset:2px;box-shadow:0 0 0 4px var(--zukan-focus-yellow-300)}
  .of-media-slide a{cursor:zoom-in}.of-lightbox[hidden]{display:none}.of-lightbox{position:fixed;inset:0;z-index:120;background:rgba(8,12,20,.94);overflow:auto;padding:72px 16px 56px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.of-lightbox-inner{min-height:100%;width:100%;display:flex;align-items:center;justify-content:center}.of-lightbox-img{display:block;border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,.6);user-select:none;cursor:zoom-in}.of-lightbox-img.is-fit{max-width:calc(100vw - 32px);max-height:calc(100vh - 140px);width:auto;height:auto}.of-lightbox-img.is-actual{max-width:none;max-height:none;cursor:zoom-out}.of-lightbox-img.is-dragging{cursor:grabbing}.of-lightbox-toggle,.of-lightbox-close{position:fixed;top:16px;z-index:130;display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:999px;border:0;font-weight:800;font-size:14px;cursor:pointer}.of-lightbox-toggle{left:16px;background:rgba(15,23,42,.82);color:#fff;border:1px solid rgba(255,255,255,.22)}.of-lightbox-close{right:16px;background:#fff;color:#0f172a;box-shadow:0 8px 24px rgba(0,0,0,.45)}
  .of-ai-note{margin:8px 0 0;font-size:13px;line-height:1.45;color:#55635b;text-align:left}.of-title-row{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px}.of-title-edit{display:inline-block}.of-title-edit summary{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border:1px solid var(--line);border-radius:999px;font-size:14px;font-weight:750;color:var(--green);cursor:pointer;list-style:none}.of-title-edit summary::-webkit-details-marker{display:none}.of-title-edit form{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.of-title-edit input{flex:1 1 220px;min-height:44px;padding:8px 12px;border:1px solid #aebfb5;border-radius:10px;background:#fff}.of-title-edit button{min-height:44px;padding:0 14px;border:0;border-radius:10px;background:var(--green);color:#fff;font-weight:800;cursor:pointer}
  </style></head><body data-zukan-app-experience="v1">${renderAppExperienceHeader(lang, 1, Boolean(presentation.viewerAuthenticated), "record-detail")}<header class="of-header"><a class="of-back" href="${escapeHtml(recordsDiscoveryListHref(lang, presentation.recordsDiscoveryContext ?? null))}" aria-label="${escapeHtml(copy.back)}">← <span>${escapeHtml(copy.back)}</span></a>${menu}</header><main id="record-detail" tabindex="-1" class="of-page" data-observation-first-record-detail="1"><div class="of-layout${mediaStage ? "" : " has-no-media"}"><div class="of-media-column">${mediaStage}</div><aside class="of-panel"><section class="of-record-info">${presentation.notice ? `<p class="of-status" role="status">${escapeHtml(presentation.notice)}</p>` : ""}${titleBlock}<div class="of-meta"><p><span>◷</span>${escapeHtml(observedLabel)}</p><p><span>⌖</span>${escapeHtml(publicLocation)}</p>${locationProtection ? `<p class="of-location-protection">${escapeHtml(locationProtection)}</p>` : ""}<p class="of-meta-visibility">${escapeHtml(copy.visibility[detail.visibility])}</p></div><div class="of-actions">${detail.owner ? `<a class="of-action is-primary" href="#of-manage-body">${escapeHtml(copy.edit)}</a>` : ""}<a class="of-action" href="${escapeHtml(mailto)}">${escapeHtml(copy.share)}</a>${presentation.savedControlHtml ?? ""}</div>${cleanStatus ? `<p class="of-status" role="status" aria-live="polite">${escapeHtml(cleanStatus)}</p>` : ""}${processingStatusPanel}${duplicateNotice ? `<p class="of-status" data-media-dedup-notice>${escapeHtml(duplicateNotice)}</p>` : ""}</section>${note}${summary}${aiFeedback}${presentation.humanExpertCommentsHtml ?? ""}${scene}${environment}${comparison}${publicationReturn}${management}${capture}</aside></div>${related}<p class="of-ai-footer-note" style="margin:24px 0 0;font-size:13px;color:#657168">${escapeHtml(copy.aiPageFooterNote)}</p></main>${photoLightbox}${renderAppExperienceNavigation(lang, 1, "bottom", Boolean(presentation.viewerAuthenticated))}${renderAppExperienceQuickCamera(lang)}${presentation.savedScriptHtml ?? ""}${renderObservationOwnerDeleteScript(detail.owner, lang === "pt-br" ? "pt-BR" : lang)}${photoLightboxScript}</body></html>`;
}
