import type { ObservationFirstCard, ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import {
  observationFirstRecordDetailCopy,
  type ObservationFirstRecordDetailCopy,
  type ObservationRecordLang,
} from "./observationFirstRecordDetailI18n";
import { PRODUCTION_PUBLIC_ORIGIN } from "../../src/services/trustedPublicOrigin";

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
};

export type ObservationFirstRecordPresentation = {
  lang?: ObservationRecordLang;
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
  comparison?: ObservationFirstComparisonPresentation | null;
  aiCandidateInsights?: ObservationFirstAiCandidateInsight[];
  aiFeedback?: string | null;
  aiNextPhoto?: string | null;
  mediaDedup?: {
    sourcePhotoCount: number;
    representativePhotoCount: number;
    excludedPhotoCount: number;
  } | null;
  related?: ObservationFirstRelatedPresentation[];
  canonicalUrl?: string;
  actionNonce: string;
  processingMessage?: string | null;
  processingStatusPanel?: string | null;
  notice?: string | null;
  viewerAuthenticated?: boolean;
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
      return `<figure class="of-media-slide" id="record-media-${index + 1}"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(copy.enlargePhoto)}"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(label)}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async"${index === 0 ? ' fetchpriority="high"' : ""}></a></figure>`;
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

const observationName = (card: ObservationFirstCard, copy: ObservationFirstRecordDetailCopy): { text: string; ai: boolean } => {
  const acceptedName = publicSubjectName(card.acceptedIdentification?.proposedName);
  if (acceptedName) return { text: acceptedName, ai: false };
  const suggestedName = card.aiSuggestions
    .map((item) => publicSubjectName(item.proposedName) ?? publicSubjectName(item.proposedScientificName))
    .find((item): item is string => item !== null);
  if (suggestedName) return { text: template(copy.candidateTemplate, suggestedName), ai: true };
  const genericLabels = new Set(["名前を決めていない対象", "観察した生きもの", "飼育されている生きもの"]);
  const subjectLabel = publicSubjectName(card.subjectLabel);
  return { text: !subjectLabel || genericLabels.has(subjectLabel) ? subjectTypeName(card, copy) : subjectLabel, ai: false };
};

function renderLearning(card: ObservationFirstCard, copy: ObservationFirstRecordDetailCopy): string {
  const suggestion = card.aiSuggestions.find((item) => item.visualEvidence.length > 0 || item.shootingAdvice.length > 0);
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
): string {
  if (card.acceptedIdentification || !presentation.aiCandidateInsights?.length) return "";
  const candidates = presentation.aiCandidateInsights.slice(0, 3);
  return `<section class="of-candidate-comparison" aria-labelledby="of-candidate-comparison-title"><h3 id="of-candidate-comparison-title">${escapeHtml(copy.compareCandidates)}</h3><p>${escapeHtml(copy.compareCandidatesLead)}</p><ul>${candidates.map((candidate) => {
    const scientificName = candidate.scientificName && candidate.scientificName !== candidate.name
      ? `<small><i>${escapeHtml(candidate.scientificName)}</i></small>`
      : "";
    const supporting = candidate.supportingFeatures.slice(0, 2);
    const uncertainty = [...candidate.missingFeatures, ...candidate.contradictions].slice(0, 1);
    return `<li><strong>${escapeHtml(candidate.name)}</strong>${scientificName}${supporting.length ? `<span><b>${escapeHtml(copy.candidateEvidence)}</b> ${escapeHtml(supporting.join("、"))}</span>` : ""}${uncertainty.length ? `<span><b>${escapeHtml(copy.candidateUncertainty)}</b> ${escapeHtml(uncertainty[0])}</span>` : ""}</li>`;
  }).join("")}</ul></section>`;
}

function renderAiFeedback(
  presentation: ObservationFirstRecordPresentation,
  copy: ObservationFirstRecordDetailCopy,
): string {
  if (!presentation.aiFeedback && !presentation.aiNextPhoto) return "";
  return `<section class="of-note" data-ai-feedback aria-labelledby="of-ai-feedback-title"><h2 id="of-ai-feedback-title">${escapeHtml(copy.aiFeedbackTitle)}</h2>${presentation.aiFeedback ? `<p>${escapeHtml(presentation.aiFeedback)}</p>` : ""}${presentation.aiNextPhoto ? `<p><strong>${escapeHtml(copy.aiNextPhotoTitle)}</strong><br>${escapeHtml(presentation.aiNextPhoto)}</p>` : ""}</section>`;
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
    return `<a class="of-login-proposal" href="${escapeHtml(`${langPrefix(presentation.lang ?? "ja")}/login?redirect=${encodeURIComponent(`/observations/${detail.recordId}`)}`)}">${escapeHtml(copy.loginToPropose)}</a>`;
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
): string {
  const display = observationName(card, copy);
  const common = hidden("observation_id", card.observationId) + hidden("return_lang", presentation.lang ?? "ja");
  const acceptedName = publicSubjectName(card.acceptedIdentification?.proposedName);
  const accepted = acceptedName
    ? `<div class="of-record-name"><span>${escapeHtml(copy.recordName)}</span><strong>${escapeHtml(acceptedName)}</strong></div>`
    : "";
  const aiNames = card.aiSuggestions.flatMap((item) => {
    const name = publicSubjectName(item.proposedName) ?? publicSubjectName(item.proposedScientificName);
    return name ? [name] : [];
  });
  const ai = aiNames.length > 0
    ? `<section class="of-ai-detail"><h4>${escapeHtml(copy.aiFound)}</h4><ul>${aiNames.map((name) => `<li><strong>${escapeHtml(name)}</strong><span>${escapeHtml(copy.photoCandidate)}</span></li>`).join("")}</ul></section>`
    : "";
  const proposals = card.communityIdentifications.filter((item) => !item.accepted && publicSubjectName(item.proposedName));
  const proposalList = proposals.length > 0
    ? `<section class="of-proposals"><h4>${escapeHtml(copy.proposals)}</h4><ul>${proposals.map((item, claimIndex) => `<li><span>${escapeHtml(item.proposedName)}</span>${detail.owner ? `<form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "accept_identification")}${hidden("identification_id", item.claimId)}${hidden("operation_id", `${presentation.actionNonce}-${index}-accept-${claimIndex}`)}<button type="submit">${escapeHtml(copy.acceptName)}</button></form>` : ""}</li>`).join("")}</ul></section>`
    : "";
  return `<article class="of-observation-detail"><h3>${escapeHtml(display.text)}</h3>${accepted}${ai}${proposalList}${renderIdentificationForm(card, index, detail, presentation, action, copy)}</article>`;
}

function renderObservationSummary(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  action: string,
  copy: ObservationFirstRecordDetailCopy,
): string {
  const active = detail.observations.filter((card) => card.state === "active");
  if (active.length === 0) return "";
  const names = active.slice(0, 3).map((card) => ({
    ...observationName(card, copy),
    communityProposal: card.communityIdentifications.some((item) => !item.accepted && publicSubjectName(item.proposedName)),
  }));
  const list = names.map((item) => {
    const status = item.ai ? copy.aiCandidate : item.communityProposal ? copy.communityProposalAvailable : "";
    return `<li${item.ai ? ' data-ai-candidate="true"' : ""}><strong>${escapeHtml(item.text)}</strong>${status ? `<small>${escapeHtml(status)}</small>` : ""}</li>`;
  }).join("");
  const details = active.map((card, index) => renderObservationDetail(card, index, detail, presentation, action, copy)).join("");
  return `<section class="of-summary" aria-labelledby="of-summary-title"><h2 id="of-summary-title">${escapeHtml(copy.found)}</h2><ul class="of-summary-list">${list}</ul>${renderLearning(active[0]!, copy)}${renderAiCandidateComparison(active[0]!, presentation, copy)}<details class="of-observation-details"><summary>${escapeHtml(active.length > 1 ? copy.openAll : copy.openDetails)}</summary><div>${details}</div></details></section>`;
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

function renderSceneUnderstanding(presentation: ObservationFirstRecordPresentation, copy: ObservationFirstRecordDetailCopy): string {
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
  return `<section class="of-environment" aria-labelledby="of-environment-title"><h2 id="of-environment-title">${escapeHtml(copy.placeSummary)}</h2>${headline ? `<p class="of-environment-headline">${escapeHtml(headline)}</p>` : ""}${rows.length ? `<ul>${rows.join("")}</ul>` : ""}${inferred ? `<small>${escapeHtml(copy.photoInference)}</small>` : ""}</section>`;
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
      return `<section class="of-manage-subject"><h3>${escapeHtml(observationName(card, copy).text)}</h3><form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "restore")}${hidden("operation_id", `${presentation.actionNonce}-${index}-restore`)}<button type="submit">${escapeHtml(copy.restore)}</button></form></section>`;
    }
    const mergeTargets = active.filter((candidate) => candidate.observationId !== card.observationId);
    return `<section class="of-manage-subject"><h3>${escapeHtml(observationName(card, copy).text)}</h3>
      <form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "split")}${hidden("operation_id", `${presentation.actionNonce}-${index}-split`)}<label>${escapeHtml(copy.separateName)}<input name="display_name" maxlength="160" autocomplete="off"></label><label>${escapeHtml(copy.subjectType)}<select name="subject_type">${selectOptions(subjectTypes)}</select></label><button type="submit">${escapeHtml(copy.separate)}</button></form>
      ${mergeTargets.length ? `<form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "merge")}${hidden("operation_id", `${presentation.actionNonce}-${index}-merge`)}<label>${escapeHtml(copy.combineWith)}<select name="target_observation_id">${mergeTargets.map((candidate) => `<option value="${escapeHtml(candidate.observationId)}">${escapeHtml(observationName(candidate, copy).text)}</option>`).join("")}</select></label><button type="submit">${escapeHtml(copy.combine)}</button></form>` : ""}
      <form method="post" action="${escapeHtml(action)}">${common}${hidden("action", "exclude")}${hidden("reason", "not_visible_in_record")}${hidden("operation_id", `${presentation.actionNonce}-${index}-exclude`)}<button class="is-secondary" type="submit">${escapeHtml(copy.notVisible)}</button></form>
    </section>`;
  }).join("");
  const mediaAssignment = media.length > 0 && active.length > 0
    ? `<section><h3>${escapeHtml(copy.assignMedia)}</h3><p>${escapeHtml(copy.assignMediaLead)}</p>${media.map((item, index) => `<form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "media_reassign")}${hidden("media_id", item.mediaId)}${hidden("operation_id", `${presentation.actionNonce}-media-${index}`)}<label>${escapeHtml(mediaLabel(item.mediaKind, copy))}<select name="target_observation_id">${active.map((card) => `<option value="${escapeHtml(card.observationId)}">${escapeHtml(observationName(card, copy).text)}</option>`).join("")}</select></label><button type="submit">${escapeHtml(copy.assign)}</button></form>`).join("")}</section>`
    : "";
  const visibilitySettings = `<section><h3>${escapeHtml(copy.visibilitySettings)}</h3><p>${escapeHtml(copy.visibilityLead)}</p><form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "set_visibility")}${hidden("operation_id", `${presentation.actionNonce}-visibility-${detail.visibility}`)}<label>${escapeHtml(copy.visibilitySettings)}<select name="visibility">${selectOptions({ public: copy.visibility.public, private: copy.visibility.private }, detail.visibility === "public" ? "public" : "private")}</select></label><button type="submit">${escapeHtml(copy.saveVisibility)}</button></form></section>`;
  const policy = detail.visibility !== "private"
    ? `<section><form method="post" action="${escapeHtml(action)}">${returnLang}${hidden("action", "set_proposal_policy")}${hidden("accepts_identification_proposals", detail.proposalPolicy.identification ? "0" : "1")}${hidden("operation_id", `${presentation.actionNonce}-policy-${detail.proposalPolicy.identification ? "off" : "on"}`)}<button class="is-secondary" type="submit">${escapeHtml(detail.proposalPolicy.identification ? copy.pauseProposals : copy.receiveProposals)}</button></form></section>`
    : "";
  return `<details class="of-manage" id="manage"><summary>${escapeHtml(copy.manage)}</summary><p class="of-manage-lead">${escapeHtml(copy.manageLead)}</p><div class="of-manage-body">${visibilitySettings}${add}${cards}${mediaAssignment}${policy}</div></details>`;
}

function renderCaptureInfo(
  detail: ObservationFirstRecordDetail,
  presentation: ObservationFirstRecordPresentation,
  media: ObservationFirstMediaPresentation[],
  copy: ObservationFirstRecordDetailCopy,
): string {
  const counts = (["photo", "video", "audio"] as const).flatMap((kind) => {
    const count = media.filter((item) => item.mediaKind === kind).length;
    return count > 0 ? [`${copy[kind]} ${count}`] : [];
  }).join(" · ");
  return `<details class="of-capture"><summary>${escapeHtml(copy.captureInfo)}</summary><dl><div><dt>${escapeHtml(copy.capturedAt)}</dt><dd>${escapeHtml(presentation.observedLabel)}</dd></div><div><dt>${escapeHtml(copy.place)}</dt><dd>${escapeHtml(presentation.publicLocationLabel ?? detail.privacy.publicLocationLabel)}</dd></div><div><dt>${escapeHtml(copy.scope)}</dt><dd>${escapeHtml(copy.visibility[detail.visibility])}</dd></div>${counts ? `<div><dt>${escapeHtml(copy.mediaCount)}</dt><dd>${escapeHtml(counts)}</dd></div>` : ""}</dl></details>`;
}

function renderRelated(items: ObservationFirstRelatedPresentation[] | undefined, lang: ObservationRecordLang, copy: ObservationFirstRecordDetailCopy): string {
  if (!items?.length) return "";
  const cards = items.slice(0, 6).map((item) => {
    const safePhoto = item.photoUrl && !forbiddenPublicMediaLocator.test(item.photoUrl) ? item.photoUrl : null;
    const title = forbiddenEmptyCopy.test(item.title) ? copy.relatedRecord : item.title;
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
  const title = presentation.titleIsFallback || forbiddenEmptyCopy.test(presentation.title) ? copy.natureRecord : presentation.title;
  const action = `/api/v1/records/${encodeURIComponent(detail.recordId)}/observation-actions`;
  const canonicalUrl = presentation.canonicalUrl ?? `${PRODUCTION_PUBLIC_ORIGIN}/${lang}/observations/${encodeURIComponent(detail.recordId)}`;
  const prefix = langPrefix(lang);
  const cleanStatus = presentation.processingMessage && !forbiddenEmptyCopy.test(presentation.processingMessage) ? presentation.processingMessage : null;
  const processingStatusPanel = presentation.processingStatusPanel?.trim() ?? "";
  const duplicateNotice = detail.owner && presentation.mediaDedup && presentation.mediaDedup.excludedPhotoCount > 0
    ? copy.similarPhotosHidden.replace("{count}", String(presentation.mediaDedup.excludedPhotoCount))
    : null;
  const languageLinks = (["ja", "en", "es", "pt-br"] as const).map((item) => `<a href="/${item}/observations/${encodeURIComponent(detail.recordId)}" lang="${escapeHtml(item)}"${item === lang ? ' aria-current="page"' : ""}>${escapeHtml(item === "ja" ? "JP" : item === "pt-br" ? "PT" : item.toUpperCase())}</a>`).join("");
  const menu = `<details class="of-menu"><summary aria-label="${escapeHtml(copy.menu)}"><span aria-hidden="true">•••</span></summary><nav aria-label="${escapeHtml(copy.menu)}"><a href="${prefix}/">${escapeHtml(copy.home)}</a><a href="${prefix}/records">${escapeHtml(copy.records)}</a><div aria-label="${escapeHtml(copy.language)}">${languageLinks}</div></nav></details>`;
  const mediaStage = renderRecordMedia(media, title, copy);
  const summary = renderObservationSummary(detail, { ...presentation, lang }, action, copy);
  const aiFeedback = renderAiFeedback(presentation, copy);
  const scene = renderSceneUnderstanding(presentation, copy);
  const environment = renderEnvironment(presentation.environment, copy);
  const comparison = renderComparison(presentation.comparison, lang, copy);
  const note = presentation.note?.trim() ? `<section class="of-note" aria-labelledby="of-note-title"><h2 id="of-note-title">${escapeHtml(copy.note)}</h2><p>${escapeHtml(presentation.note.trim())}</p></section>` : "";
  const management = renderOwnerManagement(detail, { ...presentation, lang }, media, action, copy);
  const capture = renderCaptureInfo(detail, presentation, media, copy);
  const related = renderRelated(presentation.related, lang, copy);
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(canonicalUrl)}`;
  const locationProtection = presentation.locationProtectionLabel?.trim()
    || (detail.visibility === "public" ? copy.approximateLocation : copy.exactLocationPrivate);
  return `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | ${escapeHtml(copy.documentSuffix)}</title>
  <style>
    :root{color-scheme:light;--ink:#16231c;--muted:#607067;--line:#dce7e0;--paper:#fff;--wash:#f4f8f5;--green:#0a7b57;--soft:#edf7f2;--focus:#f59e0b}*{box-sizing:border-box}html{overflow-x:hidden;scroll-behavior:smooth}body{margin:0;background:var(--wash);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;overflow-wrap:anywhere}a{color:#0b6f61}button,input,select,textarea{font:inherit}a,button,input,select,textarea,summary{min-height:44px}:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.of-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;min-height:58px;padding:6px max(12px,calc((100vw - 1320px)/2));background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.of-back{display:inline-flex;align-items:center;gap:7px;padding:0 10px;color:var(--ink);font-weight:800;text-decoration:none}.of-menu{position:relative}.of-menu>summary{display:grid;place-items:center;width:48px;cursor:pointer;list-style:none;border-radius:999px;font-weight:900}.of-menu>summary::-webkit-details-marker{display:none}.of-menu nav{position:absolute;right:0;top:50px;display:grid;width:min(270px,calc(100vw - 24px));padding:10px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 20px 50px rgba(15,35,25,.18)}.of-menu:not([open]) nav{display:none}.of-menu nav>a{display:flex;align-items:center;padding:8px 10px;border-radius:10px;font-weight:800;text-decoration:none}.of-menu nav div{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding-top:8px;border-top:1px solid var(--line)}.of-menu nav div a{display:grid;place-items:center;border-radius:9px;text-decoration:none}.of-menu [aria-current="page"]{background:var(--soft);font-weight:900}.of-page{width:min(1320px,100%);margin:0 auto 56px}.of-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,440px);align-items:start}.of-layout.has-no-media{grid-template-columns:minmax(0,700px);justify-content:center}.of-layout.has-no-media .of-media-column{display:none}.of-media-column{position:sticky;top:58px;min-width:0}.of-media-stage{position:relative;display:grid;align-items:center;min-height:calc(100vh - 58px);background:#101713;color:#fff}.of-media-gallery{display:flex;width:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;overscroll-behavior-x:contain}.of-media-slide{display:grid;place-items:center;flex:0 0 100%;min-width:0;min-height:min(74vw,calc(100vh - 96px));margin:0;scroll-snap-align:start}.of-media-slide a{display:grid;place-items:center;width:100%;min-height:inherit}.of-media-slide img{display:block;width:auto;max-width:100%;height:auto;max-height:calc(100vh - 96px);object-fit:contain}.of-media-slide video{display:block;width:100%;height:auto;max-height:calc(100vh - 96px);object-fit:contain}.of-media-slide.is-audio{align-content:center;gap:22px;padding:32px}.of-media-slide audio{width:min(520px,100%)}.of-audio-mark{font-size:72px;line-height:1;color:#9be7c9}.of-media-nav{position:absolute;right:14px;bottom:14px;display:flex;gap:7px;padding:6px;border-radius:999px;background:rgba(0,0,0,.58)}.of-media-nav a{display:grid;place-items:center;width:44px;min-height:44px;border-radius:999px;color:#fff;text-decoration:none}.of-media-nav a:hover,.of-media-nav a:focus-visible{background:rgba(255,255,255,.2)}.of-panel{min-width:0;padding:28px 24px 48px;background:#fff;min-height:calc(100vh - 58px);border-left:1px solid var(--line)}.of-layout.has-no-media .of-panel{border-left:0}.of-record-info h1{margin:0;font-size:clamp(27px,3vw,38px);line-height:1.22;letter-spacing:-.02em}.of-meta{display:grid;gap:5px;margin:14px 0 18px;color:var(--muted)}.of-meta p{display:flex;align-items:flex-start;gap:8px;margin:0}.of-meta p span:first-child{font-weight:800;color:var(--ink)}.of-meta .of-location-protection{color:#365848;font-weight:750}.of-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}.of-action{display:inline-flex;align-items:center;justify-content:center;padding:9px 15px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font-weight:850;text-decoration:none}.of-action.is-primary{border-color:var(--green);background:var(--green);color:#fff}.of-status{margin:0 0 14px;padding:10px 12px;border-radius:12px;background:var(--soft)}.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture{margin-top:14px;padding:17px;border:1px solid var(--line);border-radius:17px;background:#fff}.of-summary{background:linear-gradient(150deg,#effaf5,#fff 55%)}.of-summary h2,.of-scene h2,.of-environment h2,.of-comparison h2,.of-note h2{margin:0 0 9px;font-size:19px;line-height:1.35}.of-summary-list{display:grid;gap:7px;margin:0;padding:0;list-style:none}.of-summary-list li{position:relative;display:grid;padding-left:18px;font-size:17px}.of-summary-list li:before{content:"";position:absolute;left:1px;top:.72em;width:7px;height:7px;border-radius:50%;background:var(--green)}.of-summary-list li strong{font-weight:850}.of-summary-list li small{color:var(--muted);font-size:13px}.of-learning{display:grid;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}.of-learning>h3{margin:0;font-size:17px}.of-learning h4{margin:0 0 5px;font-size:15px}.of-learning ul{margin:0;padding-left:20px;color:#33473c}.of-scene{background:#f5f8fb}.of-scene ul{display:flex;flex-wrap:wrap;gap:7px;margin:0;padding:0;list-style:none}.of-scene li{padding:5px 10px;border:1px solid #cbd8df;border-radius:999px;background:#fff;font-weight:750}.of-detection-state{margin:11px 0 0;color:#33473c}.of-comparison p{margin:0 0 6px}.of-comparison a{display:inline-flex;align-items:center;font-weight:800}.of-observation-details,.of-propose{margin-top:12px}.of-observation-details>summary,.of-propose>summary,.of-manage>summary,.of-capture>summary{display:flex;align-items:center;cursor:pointer;color:var(--green);font-weight:900;list-style-position:inside}.of-observation-detail{margin-top:12px;padding:14px;border-radius:13px;background:var(--wash)}.of-observation-detail h3{margin:0 0 8px;font-size:17px}.of-record-name{display:grid;margin-bottom:9px}.of-record-name span,.of-ai-detail span{color:var(--muted);font-size:13px}.of-ai-detail h4,.of-proposals h4{margin:10px 0 5px;font-size:14px}.of-ai-detail ul,.of-proposals ul{display:grid;gap:6px;margin:0;padding:0;list-style:none}.of-ai-detail li{display:grid}.of-proposals li{display:flex;align-items:center;justify-content:space-between;gap:8px}.of-proposals form{margin:0}.of-proposals button{padding:7px 11px}.of-propose form,.of-manage form{display:grid;gap:8px;margin-top:9px}.of-propose label,.of-manage label{display:grid;gap:4px;font-weight:800}.of-propose input,.of-propose textarea,.of-manage input,.of-manage select{width:100%;padding:9px 10px;border:1px solid #aebfb5;border-radius:10px;background:#fff}.of-propose button,.of-manage button{border:0;border-radius:11px;background:var(--green);color:#fff;font-weight:900;padding:10px 13px}.of-manage button.is-secondary{border:1px solid var(--line);background:#fff;color:var(--ink)}.of-login-proposal{display:inline-flex;align-items:center;margin-top:10px;font-weight:850}.of-environment{background:#f7faf0}.of-environment-headline{margin:0 0 8px;font-weight:850}.of-environment ul{display:grid;gap:5px;margin:0;padding:0;list-style:none}.of-environment li{display:grid;grid-template-columns:minmax(112px,.75fr) minmax(0,1.25fr);gap:10px}.of-environment li span{color:var(--muted)}.of-environment small{display:block;margin-top:9px;color:var(--muted)}.of-note p{margin:0;white-space:pre-wrap}.of-manage>summary,.of-capture>summary{color:var(--ink)}.of-manage-lead{margin:3px 0 0;color:var(--muted);font-size:14px}.of-manage-body{display:grid;gap:14px;padding-top:11px}.of-manage-body>section{padding-top:12px;border-top:1px solid var(--line)}.of-manage-body>section:first-child{padding-top:0;border-top:0}.of-manage h3{margin:0;font-size:16px}.of-manage p{margin:5px 0;color:var(--muted);font-size:14px}.of-capture dl{display:grid;gap:8px;margin:11px 0 0}.of-capture dl div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px}.of-capture dt{color:var(--muted)}.of-capture dd{margin:0;font-weight:750}.of-related{padding:24px}.of-related h2{margin:0 0 12px;font-size:21px}.of-related>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.of-related-card{display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;min-height:76px;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none}.of-related-card.has-no-photo{grid-template-columns:minmax(0,1fr)}.of-related-card img{width:76px;height:76px;object-fit:cover}.of-related-card span{display:grid;padding:8px 10px}.of-related-card small{color:var(--muted)}@media(max-width:899px){.of-layout{display:flex;flex-direction:column}.of-media-column{position:static;width:100%}.of-media-stage{min-height:0}.of-media-slide{min-height:min(82vh,133vw)}.of-media-slide img,.of-media-slide video{max-height:min(82vh,133vw)}.of-panel{width:100%;min-height:0;padding:22px 16px 38px;border-left:0}.of-related{padding:18px 16px}.of-related>div{display:flex;overflow-x:auto;gap:10px;scroll-snap-type:x proximity;padding-bottom:8px}.of-related-card{flex:0 0 min(76vw,300px);scroll-snap-align:start}.of-record-info h1{font-size:29px}.of-observation-details[open],.of-manage[open]{position:fixed;inset:58px 0 0;z-index:60;margin:0;padding:16px;overflow-y:auto;border-radius:0;background:#fff}.of-observation-details[open]>summary,.of-manage[open]>summary{position:sticky;top:0;z-index:2;padding:8px 0;background:#fff;border-bottom:1px solid var(--line)}}@media(max-width:390px){.of-header{padding-inline:6px}.of-panel{padding:19px 12px 34px}.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture{padding:14px;border-radius:14px}.of-related{padding-inline:12px}.of-environment li{grid-template-columns:1fr;gap:0}.of-capture dl div{grid-template-columns:92px minmax(0,1fr)}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.of-media-gallery,.of-related>div{scroll-behavior:auto}}
    .of-candidate-comparison{display:grid;gap:10px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line)}.of-candidate-comparison>h3{margin:0;font-size:17px}.of-candidate-comparison>p{margin:0;color:var(--muted);font-size:14px}.of-candidate-comparison>ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.of-candidate-comparison li{display:grid;gap:3px;padding:10px;border-radius:11px;background:#fff}.of-candidate-comparison li small{color:var(--muted)}.of-candidate-comparison li span{font-size:14px;color:#33473c}.of-candidate-comparison li b{font-size:12px;color:var(--muted)}
  </style></head><body><header class="of-header"><a class="of-back" href="${prefix}/records" aria-label="${escapeHtml(copy.back)}">← <span>${escapeHtml(copy.back)}</span></a>${menu}</header><main class="of-page" data-observation-first-record-detail="1"><div class="of-layout${mediaStage ? "" : " has-no-media"}"><div class="of-media-column">${mediaStage}</div><aside class="of-panel"><section class="of-record-info">${presentation.notice ? `<p class="of-status" role="status">${escapeHtml(presentation.notice)}</p>` : ""}<h1>${escapeHtml(title)}</h1><div class="of-meta"><p><span>◷</span>${escapeHtml(presentation.observedLabel)}</p><p><span>⌖</span>${escapeHtml(presentation.publicLocationLabel ?? detail.privacy.publicLocationLabel)}</p><p class="of-location-protection"><span>◌</span>${escapeHtml(locationProtection)}</p><p><span>◉</span>${escapeHtml(copy.visibility[detail.visibility])}</p></div><div class="of-actions">${detail.owner ? `<a class="of-action is-primary" href="#manage">${escapeHtml(copy.edit)}</a>` : ""}<a class="of-action" href="${escapeHtml(mailto)}">${escapeHtml(copy.share)}</a></div>${cleanStatus ? `<p class="of-status" role="status" aria-live="polite">${escapeHtml(cleanStatus)}</p>` : ""}${processingStatusPanel}${duplicateNotice ? `<p class="of-status" data-media-dedup-notice>${escapeHtml(duplicateNotice)}</p>` : ""}</section>${note}${summary}${aiFeedback}${scene}${environment}${comparison}${management}${capture}</aside></div>${related}</main></body></html>`;
}
