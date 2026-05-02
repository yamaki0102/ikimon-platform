export type LandingStrings = {
  title: string;
  heroEyebrow: string;
  heroHeading: string;
  heroHeadingPlain: string;
  heroLead: string;
  heroPromiseChips: string[];
  heroDailyLabel: string;
  heroLatestLabel: string;
  heroStatsLabel: string;
  heroPhotoFallback: string;
  heroReasonLabels: Record<"seasonal" | "nearby" | "vividPhoto" | "supported" | "fresh", string>;
  dailyDashboard: {
    eyebrow: string;
    title: string;
    lead: string;
    scoreLabel: string;
    seasonalTitle: string;
    seasonalEmpty: string;
    cards: Record<"recordToday" | "revisitPlace" | "nearbyPulse" | "needsId", {
      eyebrow: string;
      title: string;
      body: string;
      cta: string;
      metricLabel: string;
    }>;
  };
  numberLocale: string;
  statLabelTemplate: (obsFormatted: string, speciesFormatted: string) => string;
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
};

export type FieldLoopStrings = {
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
};

export type ObservationEventStrings = {
  // 一覧
  listEyebrow: string;
  listHeroHeading: string;
  listHeroLead: string;
  listCreateCta: string;
  listBackToCommunity: string;
  listLiveSection: string;
  listPastSection: string;
  listLiveEmpty: string;
  listPastEmpty: string;
  badgeLive: string;
  badgeEnded: string;
  joinCta: string;
  recapCta: string;
  // モード
  modeLabels: Record<"discovery" | "effort_maximize" | "bingo" | "absence_confirm" | "ai_quest", string>;
  // チェックイン
  checkinEyebrow: string;
  checkinHeading: (title: string) => string;
  checkinLead: (mode: string, targets: string) => string;
  checkinNameLabel: string;
  checkinTeamLabel: string;
  checkinShareLocation: string;
  checkinIsMinor: string;
  checkinAuthenticated: string;
  checkinGuestNote: string;
  checkinSubmit: string;
  // ライブ
  liveModeSuffix: string;
  liveTargetLabel: string;
  liveFeedHeader: string;
  liveFeedSeed: string;
  liveStatObs: string;
  liveStatSpecies: string;
  liveStatAbsence: string;
  liveActionRecord: string;
  liveActionSearched: string;
  liveActionAbsent: string;
  liveActionRole: string;
  liveQuestEyebrow: string;
  liveQuestAccept: string;
  liveQuestDecline: string;
  liveAbsenceFormHeading: string;
  liveAbsenceFormLead: string;
  liveAbsenceTaxonLabel: string;
  liveAbsenceEffortLabel: string;
  liveAbsenceConfidenceLabel: string;
  liveAbsenceConfidenceSearched: string;
  liveAbsenceConfidenceAbsent: string;
  liveAbsenceCancel: string;
  liveAbsenceSubmit: string;
  liveOfflineLabel: string;
  liveReconnectLabel: string;
  // 管制塔
  consoleEyebrow: string;
  consoleHeading: (title: string) => string;
  consoleLead: string;
  consoleAnnounceLabel: string;
  consoleAnnouncePlaceholder: string;
  consoleAnnounceSubmit: string;
  consoleQuestRunCta: string;
  consoleStatParticipants: string;
  consoleStatObs: string;
  consoleStatAbsence: string;
  consoleStatQuests: string;
  consoleTeamHeader: string;
  consoleAddTeamLabel: string;
  consoleAddTeamCta: string;
  consoleFeedHeader: string;
  consoleEndCta: string;
  // 振り返り
  recapTabOverview: string;
  recapTabTeams: string;
  recapTabMe: string;
  recapTabTimeline: string;
  recapTabImpact: string;
  recapTopTaxa: string;
  recapStats: string;
  recapTeamsHeader: string;
  recapMeFallback: string;
  recapImpactEmpty: string;
};

export type AppStrings = {
  landing: LandingStrings;
  fieldLoop: FieldLoopStrings;
  observationEvent: ObservationEventStrings;
};

export type PartialAppStrings = {
  landing?: Partial<LandingStrings> & {
    tools?: { lens?: Partial<LandingStrings["tools"]["lens"]>; scan?: Partial<LandingStrings["tools"]["scan"]> };
  };
  fieldLoop?: Partial<FieldLoopStrings>;
  observationEvent?: Partial<ObservationEventStrings>;
};
