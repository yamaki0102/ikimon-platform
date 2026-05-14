import { appendLangToHref, type SiteLang } from "../i18n.js";
import { withBasePath } from "../httpBasePath.js";
import { classifyAiCandidateTrustLevel, isOpenCandidate, type AiCandidateTrustLevel } from "../ui/observationCandidatePresentation.js";
import { buildObservationDetailPath } from "./observationDetailLink.js";
import { formatTaxonDisplayName } from "./localizedDisplay.js";
import type {
  ObservationVisitBundle,
  ObservationVisitCandidate,
  ObservationVisitSubject,
} from "./observationVisitBundle.js";

export type VisibleRecordTrustLevel = AiCandidateTrustLevel | "reviewed";

export type VisibleRecordItem = {
  key: string;
  source: "subject" | "candidate";
  occurrenceId: string | null;
  candidateId: string | null;
  displayName: string;
  roleLabel: string;
  rankLabel: string | null;
  confidence: number | null;
  trustLevel: VisibleRecordTrustLevel;
  trustLabel: string;
  bucket: "main" | "reference";
  href: string | null;
  note: string | null;
  historyLabel: string | null;
  historyDetail: string | null;
  isCurrent: boolean;
  isFeatured: boolean;
  adoptEndpoint: string | null;
  proposalKind: "none" | "community_subject" | "ai_candidate";
};

export function formatObservationRecordTitle(dateStr: string | null | undefined, placeLabel: string): string {
  void dateStr;
  const place = placeLabel && placeLabel !== "場所未設定" ? placeLabel : "この場所";
  return `${place}で見つけた記録`;
}

export function visibleRecordTrustLabel(level: VisibleRecordTrustLevel): string {
  switch (level) {
    case "reviewed":
      return "確認あり";
    case "strong":
      return "AI推定";
    case "medium":
      return "AI推定";
    case "reference":
      return "参考";
  }
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

function candidateRoleLabel(candidate: ObservationVisitCandidate): string {
  const name = candidate.displayName;
  const note = candidate.note ?? "";
  if (/ハチ|蜂|bee/i.test(name) || /訪花|吸蜜|花粉/i.test(note)) return "一緒に写ってるかも";
  if (/イネ科|草|芝|gramin|poaceae/i.test(name) || candidate.rank === "lifeform") return "周りの草";
  if (candidate.rank === "family" || candidate.rank === "order") return "名前確認中";
  return "一緒に写ってるかも";
}

function roleSortWeight(item: VisibleRecordItem): number {
  if (item.source === "subject") return 0;
  switch (item.roleLabel) {
    case "一緒に写ってるかも":
      return 1;
    case "周りの草":
      return 2;
    case "名前確認中":
      return 3;
    default:
      return 4;
  }
}

function subjectTrustLevel(subject: ObservationVisitSubject): VisibleRecordTrustLevel {
  if (subject.subjectSource === "community_subject_proposal" && subject.identificationCount === 0 && !subject.hasSpecialistApproval) {
    return "medium";
  }
  if ((subject.evidenceTier ?? 0) >= 3 || subject.hasSpecialistApproval || subject.identificationCount > 0) {
    return "reviewed";
  }
  if (subject.latestAssessmentBand === "high") return "strong";
  if (subject.latestAssessmentBand === "medium") return "medium";
  if (subject.latestAssessmentBand === "low") return "reference";
  if (typeof subject.confidence === "number") {
    return subject.confidence >= 0.72 ? "strong" : subject.confidence >= 0.5 ? "medium" : "reference";
  }
  return "strong";
}

export function buildVisibleRecordItems(options: {
  basePath: string;
  lang: SiteLang;
  bundle: ObservationVisitBundle;
  currentSubject: ObservationVisitSubject;
  featuredSubject: ObservationVisitSubject;
  isOwner: boolean;
  canProposeSubject?: boolean;
}): VisibleRecordItem[] {
  const subjectIds = new Set(options.bundle.subjects.map((subject) => subject.occurrenceId));
  const subjectItems: VisibleRecordItem[] = options.bundle.subjects.map((subject) => {
    const subjectDisplay = formatTaxonDisplayName(subject, options.lang);
    const trustLevel = subjectTrustLevel(subject);
    const confidence = typeof subject.confidence === "number" ? subject.confidence : null;
    return {
      key: `subject:${subject.occurrenceId}`,
      source: "subject",
      occurrenceId: subject.occurrenceId,
      candidateId: null,
      displayName: subjectDisplay.primaryLabel,
      roleLabel: subject.subjectSource === "community_subject_proposal"
        ? "一緒に写ってるかも"
        : subject.isPrimary
          ? "主役っぽい"
          : subject.roleLabel,
      rankLabel: subject.rank ? publicRankHint(subject.rank) || rankLabelJa(subject.rank) : null,
      confidence,
      trustLevel,
      trustLabel: trustLevel === "reviewed"
        ? subject.hasSpecialistApproval || (subject.evidenceTier ?? 0) >= 3
          ? "専門家確認"
          : subject.identificationCount > 0
            ? "みんなで確認"
            : "未確認"
        : visibleRecordTrustLabel(trustLevel),
      bucket: trustLevel === "reference" ? "reference" : "main",
      href: appendLangToHref(
        withBasePath(options.basePath, buildObservationDetailPath(options.bundle.visitId, subject.occurrenceId)),
        options.lang,
      ),
      note: subject.focusReason,
      historyLabel: subject.subjectSource === "community_subject_proposal"
        ? "この場面からの提案"
        : subject.adoptedFromAiCandidate
          ? "AI候補から見つけたもの"
          : null,
      historyDetail: subject.subjectSource === "community_subject_proposal"
        ? "投稿者の正式な主張ではなく、この場面を見た人の提案です。名前は人の確認で確かになります。"
        : subject.adoptedFromAiCandidate
          ? "AI候補を、同じ場面に写る対象として分けています。名前は人の確認でさらに確かになります。"
        : null,
      isCurrent: subject.occurrenceId === options.currentSubject.occurrenceId,
      isFeatured: subject.occurrenceId === options.featuredSubject.occurrenceId,
      adoptEndpoint: null,
      proposalKind: subject.subjectSource === "community_subject_proposal" ? "community_subject" : "none",
    };
  });

  const candidateItems = options.bundle.aiCandidates
    .filter((candidate) => isOpenCandidate(candidate))
    .filter((candidate) => !candidate.suggestedOccurrenceId || !subjectIds.has(candidate.suggestedOccurrenceId))
    .map<VisibleRecordItem>((candidate) => {
      const trustLevel = classifyAiCandidateTrustLevel(candidate);
      const confidence = typeof candidate.confidence === "number" ? candidate.confidence : null;
      const rankLabel = candidate.rank ? publicRankHint(candidate.rank) || rankLabelJa(candidate.rank) : null;
      return {
        key: `candidate:${candidate.candidateId}`,
        source: "candidate",
        occurrenceId: null,
        candidateId: candidate.candidateId,
        displayName: candidate.displayName,
        roleLabel: candidateRoleLabel(candidate),
        rankLabel,
        confidence,
        trustLevel,
        trustLabel: visibleRecordTrustLabel(trustLevel),
        bucket: trustLevel === "reference" ? "reference" : "main",
        href: null,
      note: candidate.note,
      historyLabel: null,
      historyDetail: null,
      isCurrent: false,
      isFeatured: false,
      adoptEndpoint: (options.canProposeSubject ?? options.isOwner)
        ? withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.bundle.visitId)}/candidates/${encodeURIComponent(candidate.candidateId)}/propose`)
        : null,
      proposalKind: "ai_candidate",
    };
  });

  return [...subjectItems, ...candidateItems].sort((left, right) => {
    const bucketWeight = (item: VisibleRecordItem): number => item.bucket === "main" ? 1 : 0;
    const trustWeight = (item: VisibleRecordItem): number =>
      item.trustLevel === "reviewed" ? 4 : item.trustLevel === "strong" ? 3 : item.trustLevel === "medium" ? 2 : 1;
    const leftScore = bucketWeight(left) * 100 + trustWeight(left) * 10;
    const rightScore = bucketWeight(right) * 100 + trustWeight(right) * 10;
    if (rightScore !== leftScore) return rightScore - leftScore;
    if (left.source !== right.source) return left.source === "subject" ? -1 : 1;
    if ((right.confidence ?? 0) !== (left.confidence ?? 0)) return (right.confidence ?? 0) - (left.confidence ?? 0);
    if (roleSortWeight(left) !== roleSortWeight(right)) return roleSortWeight(left) - roleSortWeight(right);
    return left.displayName.localeCompare(right.displayName, "ja");
  });
}

export function visibleRecordMeta(item: VisibleRecordItem): string[] {
  const meta = [item.roleLabel, item.trustLabel, item.rankLabel].filter((value): value is string => Boolean(value));
  if (item.source === "candidate" && typeof item.confidence === "number") {
    meta.push(`${Math.round(item.confidence * 100)}%`);
  }
  return meta;
}
