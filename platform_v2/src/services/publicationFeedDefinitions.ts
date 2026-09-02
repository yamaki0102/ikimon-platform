export const PUBLICATION_FEED_DEFINITIONS = Object.freeze({
  "miyakoda-renri-area": Object.freeze({
    feedKey: "miyakoda-renri-area",
    title: Object.freeze({ ja: "この場所で見つけたもの", en: "What was found here" }),
    scopeLabel: Object.freeze({ ja: "浜松・都田", en: "Miyakoda, Hamamatsu" }),
    locale: "ja" as const,
    scopeKind: "area" as const,
    scope: Object.freeze([{ kind: "entity" as const, id: "ikimon:aikan:renri-no-ki" }]),
    channels: Object.freeze([
      Object.freeze({ key: "living", label: Object.freeze({ ja: "この場所の生きもの", en: "Living things here" }) }),
      Object.freeze({ key: "community_photo", label: Object.freeze({ ja: "みんなのフォト", en: "Community photos" }) }),
    ]),
    publicationPolicyVersion: "public-feed-v1",
    updatedAt: "2026-08-28T00:00:00.000Z",
    allowedConsumerOrigins: Object.freeze([
      "https://lenrinokinoshitade.com",
      "https://lenrinokinoshitade-top-staging.pages.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]),
  }),
  "ryuyo-insect-park": Object.freeze({
    feedKey: "ryuyo-insect-park",
    title: Object.freeze({ ja: "竜洋昆虫自然観察公園で見つけたもの", en: "What was found at Ryuyo Insect Nature Observation Park" }),
    scopeLabel: Object.freeze({ ja: "磐田・竜洋昆虫自然観察公園", en: "Ryuyo, Iwata" }),
    locale: "ja" as const,
    scopeKind: "area" as const,
    scope: Object.freeze([{ kind: "entity" as const, id: "osm:way:530835577" }]),
    channels: Object.freeze([
      Object.freeze({ key: "living", label: Object.freeze({ ja: "園内の生きもの", en: "Living things in the park" }) }),
      Object.freeze({ key: "community_photo", label: Object.freeze({ ja: "園内のフォト", en: "Park photos" }) }),
    ]),
    publicationPolicyVersion: "public-feed-v1",
    updatedAt: "2026-09-02T00:00:00.000Z",
    allowedConsumerOrigins: Object.freeze([]),
  }),
});

export type PublicationFeedDefinitionKey = keyof typeof PUBLICATION_FEED_DEFINITIONS;
