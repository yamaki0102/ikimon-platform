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

export type AppStrings = {
  landing: LandingStrings;
  fieldLoop: FieldLoopStrings;
};

export type PartialAppStrings = {
  landing?: Partial<LandingStrings> & {
    tools?: { lens?: Partial<LandingStrings["tools"]["lens"]>; scan?: Partial<LandingStrings["tools"]["scan"]> };
  };
  fieldLoop?: Partial<FieldLoopStrings>;
};
