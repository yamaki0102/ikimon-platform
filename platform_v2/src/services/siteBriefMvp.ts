import type { FieldPublicProfile } from "./fieldPublicProfile.js";

export type SiteBriefAudience = "public" | "manager";

export type SiteBriefMvpInput = {
  audience: SiteBriefAudience;
  profile: FieldPublicProfile;
  evidenceSummary: string[];
  managerGaps: string[];
  nextActions: string[];
};

export type SiteBriefSection = {
  title: string;
  body: string;
};

export type SiteBriefMvp = {
  audience: SiteBriefAudience;
  fieldId: string;
  placeName: string;
  placeType: string;
  summary: string;
  evidenceSummary: string[];
  gaps: string[];
  nextActions: string[];
  sections: SiteBriefSection[];
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanList(values: string[], limit = 8): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, limit);
}

function sentenceList(values: string[], fallback: string): string {
  const cleaned = cleanList(values, 6);
  return cleaned.length ? cleaned.join("、") : fallback;
}

export function buildSiteBriefMvp(input: SiteBriefMvpInput): SiteBriefMvp {
  const profile = input.profile;
  const evidenceSummary = cleanList(input.evidenceSummary);
  const gaps = input.audience === "manager" ? cleanList(input.managerGaps) : [];
  const nextActions = cleanList(input.nextActions.length > 0 ? input.nextActions : profile.nextObservationPrompts);
  const taxa = profile.confirmedTaxa.map((taxon) => taxon.name);
  const summary = `${profile.placeName}は、${sentenceList(profile.environmentTypes, "環境タイプ確認中")}の記録がある${profile.placeType}です。`;
  const sections: SiteBriefSection[] = [
    {
      title: "この場所で言えること",
      body: `${profile.placeName}では${sentenceList(taxa, "確認生物を集計中")}が確認されています。${profile.confidence.label}。`,
    },
    {
      title: "まだ言えないこと",
      body: profile.limitations.length > 0
        ? profile.limitations.map((item) => item.label).join("、")
        : input.audience === "manager" && gaps.length > 0
          ? gaps.join("、")
          : "少数記録や未確認の評価は断定しません。",
    },
    {
      title: "次の観察",
      body: sentenceList(nextActions, "季節を変えて同じ場所を記録する"),
    },
  ];

  return {
    audience: input.audience,
    fieldId: profile.fieldId,
    placeName: profile.placeName,
    placeType: profile.placeType,
    summary,
    evidenceSummary,
    gaps,
    nextActions,
    sections,
  };
}

export function buildSiteBriefMvpSet(inputs: SiteBriefMvpInput[]): SiteBriefMvp[] {
  return inputs.slice(0, 3).map(buildSiteBriefMvp);
}
