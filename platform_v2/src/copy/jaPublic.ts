import { getShortCopy } from "../content/index.js";

type JaPublicSharedCopy = {
  cta: {
    record: string;
    startObservation: string;
    openNotebook: string;
    openMap: string;
    readFaq: string;
    openGuide: string;
    openScan: string;
    openAbout: string;
    openGroupHelp: string;
    contact: string;
  };
  labels: {
    notebook: string;
    hint: string;
    revisit: string;
    groupHelp: string;
    groupHelpLong: string;
  };
  ai: {
    short: string;
    support: string;
    supportLong: string;
  };
  business: {
    nav: string;
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  };
};

export const JA_PUBLIC_INTERNAL_JARGON = [
  "place-first",
  "methodology",
  "authority-backed",
  "readiness",
  "public claim",
  "field loop",
] as const;

export const JA_PUBLIC_SHARED_COPY = getShortCopy<JaPublicSharedCopy>("ja", "shared", "publicShared");
