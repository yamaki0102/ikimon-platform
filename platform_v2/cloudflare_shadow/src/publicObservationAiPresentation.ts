import type { ObservationFirstAiCandidateInsight } from "./observationFirstRecordDetailHtml";

const genericCandidate = /^(?:鳥|鳥類|小鳥|動物|生きもの|生物|植物|写っているもの|unknown|unidentified|unclassified)$/iu;
const privateLocation = /(?:\b(?:lat|lng|latitude|longitude|coordinate|geohash|h3)\b|[-+]?\d{1,2}\.\d{4,}\s*[,/]\s*[-+]?\d{2,3}\.\d{4,})/iu;
const humanSubjectName = /^(?:homo sapiens(?: sapiens)?|humans?|persons?|people|人|人間|人物|ヒト|personas?|pessoas?|humanos?|ser(?:es)? humanos?)$/iu;

const normalizedSubjectName = (value: unknown): string => typeof value === "string"
  ? value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase()
  : "";

// Match subject identities, never prose or assertion_status such as human_asserted.
export function isHumanObservationAiSubject(...names: unknown[]): boolean {
  return names.some((name) => humanSubjectName.test(normalizedSubjectName(name)));
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isPersonPrimarySubject(payload: Record<string, unknown>, subject: Record<string, unknown>): boolean {
  if (payload.recordClass !== "person") return false;
  const primary = objectValue(payload.candidate);
  if (!primary) return false;
  // The explicit class governs its primary subject regardless of display name;
  // separately keyed coexisting subjects retain their own eligibility.
  return subject === primary || (typeof primary.candidateKey === "string"
    && primary.candidateKey.trim() !== "" && subject.candidateKey === primary.candidateKey);
}

export function publicObservationAiPersonPrimaryNames(sourcePayloadJson: string | null | undefined): string[] {
  if (!sourcePayloadJson) return [];
  try {
    const payload = objectValue(JSON.parse(sourcePayloadJson));
    if (!payload || payload.recordClass !== "person") return [];
    const primary = objectValue(payload.candidate);
    if (!primary) return [];
    const candidates = [primary, ...(Array.isArray(payload.topCandidates) ? payload.topCandidates : [])]
      .flatMap((value) => {
        const subject = objectValue(value);
        return subject && isPersonPrimarySubject(payload, subject) ? [subject] : [];
      });
    return [...new Set(candidates.flatMap((subject) => [subject.name, subject.vernacularName, subject.scientificName])
      .flatMap((value) => {
        const name = safeText(value);
        return name ? [normalizedSubjectName(name)] : [];
      }))];
  } catch {
    return [];
  }
}

// The array form carries only the primary identity mapping inside server-rendered
// presentation; it must not be added to the public API or to rendered HTML.
export function isPublicObservationAiSubjectEligible(
  label: unknown,
  source: string | readonly string[] | null | undefined,
  scientificName?: unknown,
): boolean {
  if (isHumanObservationAiSubject(label, scientificName)) return false;
  const primaryNames = typeof source === "string" ? publicObservationAiPersonPrimaryNames(source) : source ?? [];
  return ![label, scientificName].some((value) => {
    const name = normalizedSubjectName(value);
    return name && primaryNames.some((primaryName) => normalizedSubjectName(primaryName) === name);
  });
}

function safeText(value: unknown, maxLength = 220): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/gu, " ").trim();
  if (!text || text.length > maxLength || privateLocation.test(text)) return null;
  return text;
}

function safeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    const text = safeText(item);
    return text ? [text] : [];
  }))].slice(0, 3);
}

export function publicObservationAiCandidateInsights(
  sourcePayloadJson: string | null | undefined,
): ObservationFirstAiCandidateInsight[] {
  if (!sourcePayloadJson) return [];
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(sourcePayloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    payload = parsed as Record<string, unknown>;
  } catch {
    return [];
  }
  if (!Array.isArray(payload.topCandidates)) return [];
  const personPrimaryNames = publicObservationAiPersonPrimaryNames(sourcePayloadJson);
  const seen = new Set<string>();
  return payload.topCandidates.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const candidate = value as Record<string, unknown>;
    const name = safeText(candidate.name) ?? safeText(candidate.scientificName);
    if (!name || genericCandidate.test(name) || isPersonPrimarySubject(payload, candidate)
      || !isPublicObservationAiSubjectEligible(candidate.name, personPrimaryNames, candidate.scientificName)) return [];
    const key = name.toLocaleLowerCase("ja-JP");
    if (seen.has(key)) return [];
    const supportingFeatures = safeTextList(candidate.supportingFeatures);
    const missingFeatures = safeTextList(candidate.missingFeatures);
    const contradictions = safeTextList(candidate.contradictions);
    if (supportingFeatures.length + missingFeatures.length + contradictions.length === 0) return [];
    seen.add(key);
    return [{
      name,
      scientificName: safeText(candidate.scientificName),
      supportingFeatures,
      missingFeatures,
      contradictions,
    }];
  }).slice(0, 3);
}

export type PublicObservationAiFeedback = {
  feedback: string | null;
  nextPhoto: string | null;
};

export function publicObservationAiFeedback(
  sourcePayloadJson: string | null | undefined,
): PublicObservationAiFeedback {
  if (!sourcePayloadJson) return { feedback: null, nextPhoto: null };
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(sourcePayloadJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { feedback: null, nextPhoto: null };
    payload = parsed as Record<string, unknown>;
  } catch {
    return { feedback: null, nextPhoto: null };
  }
  const summary = payload.summary && typeof payload.summary === "object" && !Array.isArray(payload.summary)
    ? payload.summary as Record<string, unknown>
    : {};
  const explanations = Array.isArray(summary.subject_explanations) ? summary.subject_explanations : [];
  const main = objectValue(payload.candidate);
  const coexisting = main?.coexistingSubjects;
  const subjects = [
    ...(Array.isArray(payload.topCandidates) ? payload.topCandidates : []),
    ...(main ? [main] : []),
    ...(Array.isArray(coexisting) ? coexisting : []),
  ].flatMap((value) => {
    const subject = objectValue(value);
    return subject ? [subject] : [];
  });
  const namesOf = (subject: Record<string, unknown>): unknown[] => [subject.name, subject.vernacularName, subject.scientificName];
  const personPrimaryNames = publicObservationAiPersonPrimaryNames(sourcePayloadJson);
  const hasHumanContext = payload.recordClass === "person"
    || subjects.some((subject) => isHumanObservationAiSubject(...namesOf(subject)))
    || explanations.some((item) => isHumanObservationAiSubject(objectValue(item)?.title));
  const nextPhoto = explanations.flatMap((item) => {
    const explanation = objectValue(item);
    if (!explanation || isHumanObservationAiSubject(explanation.title)) return [];
    const subjectId = typeof explanation.subject_id === "string" ? explanation.subject_id.trim() : "";
    const title = normalizedSubjectName(explanation.title);
    const byId = subjectId ? subjects.filter((subject) => subject.candidateKey === subjectId) : [];
    const matched = byId.length > 0 ? byId : title
      ? subjects.filter((subject) => namesOf(subject).some((name) => normalizedSubjectName(name) === title))
      : [];
    if (matched.some((subject) => isPersonPrimarySubject(payload, subject)
      || namesOf(subject).some((name) => !isPublicObservationAiSubjectEligible(name, personPrimaryNames)))) return [];
    // In a person/mixed record, only an explicitly matched non-human subject can
    // supply taxonomic shooting advice. Legacy single-subject guidance is retained.
    const hasNamedSubject = matched.some((subject) => namesOf(subject).some((name) => {
      const normalized = normalizedSubjectName(name);
      return normalized && !genericCandidate.test(normalized);
    }));
    if (hasHumanContext && !hasNamedSubject) return [];
    const value = safeText(explanation.next_photo);
    return value ? [value] : [];
  })[0] ?? null;
  return {
    feedback: safeText(summary.observer_feedback),
    nextPhoto,
  };
}
