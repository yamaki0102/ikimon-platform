export type AssessmentBand = "high" | "medium" | "low" | "unknown" | null;

export type SubjectRankInput = {
  occurrenceId: string;
  subjectIndex: number;
  displayName: string;
  scientificName: string | null;
  rank: string | null;
  roleHint: string;
  confidence: number | null;
  identificationCount: number;
  latestAssessmentBand: AssessmentBand;
  isPrimary: boolean;
};

export type RankedSubject<T extends SubjectRankInput> = T & {
  priorityScore: number;
  focusReason: string;
  roleLabel: string;
};

export function subjectSpecificityScore(rank: string | null | undefined): number {
  switch (String(rank ?? "").toLowerCase()) {
    case "species": return 5;
    case "genus": return 4;
    case "family": return 3;
    case "order": return 2;
    case "class": return 1;
    case "lifeform": return 1;
    default: return 0;
  }
}

export function subjectRoleLabel(roleHint: string | null | undefined, isPrimary: boolean): string {
  const normalized = String(roleHint ?? "").toLowerCase();
  if (normalized === "vegetation") return "植生";
  if (normalized === "alt_candidate") return "別候補";
  if (normalized === "coexisting" || (!isPrimary && normalized !== "primary")) return "別の生きもの";
  return "有力候補";
}

export function subjectPriorityScore(subject: SubjectRankInput): number {
  const idWeight = subject.identificationCount * 100;
  const aiWeight = subject.latestAssessmentBand === "high"
    ? 30
    : subject.latestAssessmentBand === "medium"
      ? 18
      : subject.latestAssessmentBand === "low"
        ? 10
        : 0;
  const numericConfidence = typeof subject.confidence === "number"
    ? Math.round(subject.confidence * 10)
    : 0;
  const specificity = subjectSpecificityScore(subject.rank) * 5;
  const primaryBias = subject.isPrimary ? 2 : 0;
  const rolePenalty = String(subject.roleHint ?? "").toLowerCase() === "alt_candidate"
    ? 15
    : String(subject.roleHint ?? "").toLowerCase() === "vegetation"
      ? 8
      : 0;
  return idWeight + aiWeight + numericConfidence + specificity + primaryBias - rolePenalty;
}

export function subjectFocusReason(subject: SubjectRankInput): string {
  if (subject.identificationCount > 0) {
    return `コミュニティ同定が ${subject.identificationCount} 件あります`;
  }
  if (subject.latestAssessmentBand === "high") return "AI がかなり近い候補として見ています";
  if (subject.latestAssessmentBand === "medium") return "AI が有力候補として見ています";
  if (typeof subject.confidence === "number" && subject.confidence >= 0.7) return "写真上での一致度が高めです";
  if (subject.rank && subjectSpecificityScore(subject.rank) >= 3) return `${subject.rank} まで整理できています`;
  return subject.isPrimary ? "最初に記録された対象です" : "同じ観察で一緒に写っている対象です";
}

export function rankVisitSubjects<T extends SubjectRankInput>(
  subjects: T[],
  currentOccurrenceId?: string | null,
): Array<RankedSubject<T>> {
  return [...subjects]
    .map((subject) => ({
      ...subject,
      priorityScore: subjectPriorityScore(subject),
      focusReason: subjectFocusReason(subject),
      roleLabel: subjectRoleLabel(subject.roleHint, subject.isPrimary),
    }))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      const leftCurrent = left.occurrenceId === currentOccurrenceId ? 1 : 0;
      const rightCurrent = right.occurrenceId === currentOccurrenceId ? 1 : 0;
      if (rightCurrent !== leftCurrent) return rightCurrent - leftCurrent;
      if (left.subjectIndex !== right.subjectIndex) return left.subjectIndex - right.subjectIndex;
      return left.displayName.localeCompare(right.displayName, "ja");
    });
}
