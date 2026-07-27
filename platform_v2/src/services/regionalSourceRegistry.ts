export type RegionalPublisherKind =
  | "national-government"
  | "prefecture"
  | "municipality"
  | "tourism-organization"
  | "general-incorporated-association"
  | "nonprofit"
  | "school"
  | "neighborhood-group"
  | "company"
  | "shop-or-farm"
  | "citizen-group"
  | "individual"
  | "zukan";

export type RegionalSourceFormat =
  | "landing-page"
  | "html"
  | "api"
  | "csv"
  | "rdf"
  | "geojson"
  | "pdf"
  | "digital-book"
  | "paper"
  | "spreadsheet"
  | "image";

export type RegionalSourceRightsClass =
  | "OPEN_REUSE"
  | "ATTRIBUTION_REUSE"
  | "FACTS_ONLY"
  | "INDEX_ONLY"
  | "CONTRIBUTED_PRIVATE"
  | "RESTRICTED"
  | "UNKNOWN";

export type RegionalSourceState =
  | "DISCOVERED"
  | "RIGHTS_CLASSIFIED"
  | "ACQUIRED"
  | "PRESERVED"
  | "EXTRACTED"
  | "NORMALIZED"
  | "LINK_PROPOSED"
  | "HUMAN_REVIEWED"
  | "PUBLISHED"
  | "SUPERSEDED"
  | "RETIRED";

export type RegionalPublisher = {
  publisherId: string;
  name: string;
  kind: RegionalPublisherKind;
  officialUrl: string;
};

export type RegionalSourceAsset = {
  sourceAssetId: string;
  title: string;
  publisherIds: readonly string[];
  geographicScopes: readonly string[];
  canonicalUrl: string;
  format: RegionalSourceFormat;
  rightsClass: RegionalSourceRightsClass;
  state: RegionalSourceState;
  issuedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string | null;
  language: string;
  licenseLabel: string | null;
  notes: string;
};

export const REGIONAL_PUBLISHERS: readonly RegionalPublisher[] = [
  {
    publisherId: "publisher:iwata-city",
    name: "磐田市",
    kind: "municipality",
    officialUrl: "https://www.city.iwata.shizuoka.jp/",
  },
  {
    publisherId: "publisher:iwata-tourism-association",
    name: "磐田市観光協会",
    kind: "tourism-organization",
    officialUrl: "https://kanko-iwata.jp/",
  },
  {
    publisherId: "publisher:miyakoda",
    name: "一般社団法人MIYAKODA",
    kind: "general-incorporated-association",
    officialUrl: "https://miyakoda.jp/",
  },
  {
    publisherId: "publisher:japan-tourism-agency",
    name: "観光庁",
    kind: "national-government",
    officialUrl: "https://www.mlit.go.jp/kankocho/",
  },
  {
    publisherId: "publisher:tokyo-convention-visitors-bureau",
    name: "公益財団法人東京観光財団",
    kind: "tourism-organization",
    officialUrl: "https://www.tcvb.or.jp/",
  },
] as const;

export const REGIONAL_SOURCE_ASSETS: readonly RegionalSourceAsset[] = [
  {
    sourceAssetId: "source:iwata:open-data-landing",
    title: "磐田市オープンデータ",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://www.city.iwata.shizuoka.jp/shiseijouhou/1006207/1002775.html",
    format: "landing-page",
    rightsClass: "ATTRIBUTION_REUSE",
    state: "PUBLISHED",
    issuedAt: null,
    updatedAt: null,
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: "磐田市オープンデータ利用規約（CC BY 2.1 JP）",
    notes: "個別データセットの配布元、更新日、ライセンスを別SourceAssetとして保持する。",
  },
  {
    sourceAssetId: "source:iwata:tourism-facilities-linkdata",
    title: "磐田市 観光施設一覧",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://linkdata.org/view/rdf1s10214i",
    format: "rdf",
    rightsClass: "ATTRIBUTION_REUSE",
    state: "PUBLISHED",
    issuedAt: null,
    updatedAt: "2024-03-26",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: "LinkData metadata: CC BY 3.0",
    notes: "現行のいわた地域図鑑snapshotへ取り込み済み。",
  },
  {
    sourceAssetId: "source:iwata:urban-parks-linkdata",
    title: "磐田市 都市公園一覧",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://linkdata.org/view/rdf1s3748i",
    format: "rdf",
    rightsClass: "ATTRIBUTION_REUSE",
    state: "PUBLISHED",
    issuedAt: null,
    updatedAt: "2022-10-28",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: "LinkData metadata: CC BY 3.0",
    notes: "現行のいわた地域図鑑snapshotへ取り込み済み。",
  },
  {
    sourceAssetId: "source:iwata:community-centers-linkdata",
    title: "磐田市 交流センター一覧",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://linkdata.org/view/rdf1s4564i",
    format: "rdf",
    rightsClass: "ATTRIBUTION_REUSE",
    state: "PUBLISHED",
    issuedAt: null,
    updatedAt: "2022-10-28",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: "LinkData metadata: CC BY 3.0",
    notes: "現行のいわた地域図鑑snapshotへ取り込み済み。",
  },
  {
    sourceAssetId: "source:iwata:cultural-properties-linkdata",
    title: "磐田市 文化財一覧",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://linkdata.org/view/rdf1s10219i",
    format: "rdf",
    rightsClass: "ATTRIBUTION_REUSE",
    state: "PUBLISHED",
    issuedAt: null,
    updatedAt: "2024-03-26",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: "LinkData metadata: CC BY 3.0",
    notes: "現行のいわた地域図鑑snapshotへ取り込み済み。位置欠損を推測で補わない。",
  },
  {
    sourceAssetId: "source:iwata:tourism-pamphlets",
    title: "磐田市観光パンフレット",
    publisherIds: ["publisher:iwata-city"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://www.city.iwata.shizuoka.jp/sports_midokoro/kankou/kankou_pamphlet/1002008.html",
    format: "landing-page",
    rightsClass: "INDEX_ONLY",
    state: "RIGHTS_CLASSIFIED",
    issuedAt: null,
    updatedAt: "2026-06-01",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: null,
    notes: "Kitemi、トラベルトランク、外国語版、家康公ゆかりの地MAP等の版台帳入口。PDF本文・画像の再掲載は個別確認。",
  },
  {
    sourceAssetId: "source:iwata-tourism-association:pamphlet-map-index",
    title: "磐田市観光パンフレット＆ウォーキングマップ",
    publisherIds: ["publisher:iwata-tourism-association"],
    geographicScopes: ["place:jp-shizuoka-iwata"],
    canonicalUrl: "https://kanko-iwata.jp/useful_information/pamphlet/",
    format: "landing-page",
    rightsClass: "INDEX_ONLY",
    state: "RIGHTS_CLASSIFIED",
    issuedAt: null,
    updatedAt: null,
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: null,
    notes: "ありがた歩記9種、文化財マップ等のSourceEditionを発見する入口。",
  },
  {
    sourceAssetId: "source:miyakoda:official-website",
    title: "一般社団法人MIYAKODA公式サイト",
    publisherIds: ["publisher:miyakoda"],
    geographicScopes: ["place:jp-shizuoka-hamamatsu-miyakoda"],
    canonicalUrl: "https://miyakoda.jp/",
    format: "html",
    rightsClass: "FACTS_ONLY",
    state: "RIGHTS_CLASSIFIED",
    issuedAt: null,
    updatedAt: null,
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: null,
    notes: "団体概要、会員、イベント、都田わくわくMAPの発行経緯を含む。説明文・画像の再掲載は権利確認。",
  },
  {
    sourceAssetId: "source:miyakoda:wakuwaku-map:2025",
    title: "都田わくわくMAP2025",
    publisherIds: ["publisher:miyakoda"],
    geographicScopes: ["place:jp-shizuoka-hamamatsu-miyakoda"],
    canonicalUrl: "https://miyakoda.jp/img/map2025.pdf",
    format: "pdf",
    rightsClass: "INDEX_ONLY",
    state: "DISCOVERED",
    issuedAt: "2025",
    updatedAt: "2026-06-15",
    retrievedAt: null,
    language: "ja",
    licenseLabel: null,
    notes: "公式サイトから公開される紙マップPDF。取得・全掲載地点抽出・再出版条件は未確認。",
  },
  {
    sourceAssetId: "source:japan-tourism-agency:tourism-dx-standardization-2026",
    title: "観光DX推進に向けたデジタルツールのデータ連携における標準化に関する調査結果",
    publisherIds: ["publisher:japan-tourism-agency"],
    geographicScopes: ["place:jp"],
    canonicalUrl: "https://www.mlit.go.jp/kankocho/topics06_00050.html",
    format: "landing-page",
    rightsClass: "INDEX_ONLY",
    state: "RIGHTS_CLASSIFIED",
    issuedAt: "2026-03-30",
    updatedAt: "2026-03-30",
    retrievedAt: "2026-07-28",
    language: "ja",
    licenseLabel: null,
    notes: "宿泊PMS等の標準データセット調査。地域POI共通スキーマとは範囲が異なるため、参考標準として管理する。",
  },
  {
    sourceAssetId: "source:tokyo-brochures:catalog",
    title: "東京観光デジタルパンフレットギャラリー",
    publisherIds: ["publisher:tokyo-convention-visitors-bureau"],
    geographicScopes: ["place:jp-tokyo"],
    canonicalUrl: "https://www.gotokyo.org/book/",
    format: "digital-book",
    rightsClass: "INDEX_ONLY",
    state: "RIGHTS_CLASSIFIED",
    issuedAt: null,
    updatedAt: null,
    retrievedAt: "2026-07-28",
    language: "multi",
    licenseLabel: null,
    notes: "多数発行主体のPDFを集約するPublication catalog例。掲載物の著作権は財団または発行元に残る。",
  },
] as const;

export type RegionalSourceRegistrySummary = {
  publisherCount: number;
  sourceCount: number;
  municipalSourceCount: number;
  nonMunicipalSourceCount: number;
  byFormat: Record<string, number>;
  byRightsClass: Record<string, number>;
  byState: Record<string, number>;
};

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

export function buildRegionalSourceRegistrySummary(): RegionalSourceRegistrySummary {
  const municipalPublisherIds = new Set(
    REGIONAL_PUBLISHERS.filter((publisher) => publisher.kind === "municipality").map((publisher) => publisher.publisherId),
  );
  const municipalSourceCount = REGIONAL_SOURCE_ASSETS.filter((source) =>
    source.publisherIds.some((publisherId) => municipalPublisherIds.has(publisherId)),
  ).length;

  return {
    publisherCount: REGIONAL_PUBLISHERS.length,
    sourceCount: REGIONAL_SOURCE_ASSETS.length,
    municipalSourceCount,
    nonMunicipalSourceCount: REGIONAL_SOURCE_ASSETS.length - municipalSourceCount,
    byFormat: countBy(REGIONAL_SOURCE_ASSETS.map((source) => source.format)),
    byRightsClass: countBy(REGIONAL_SOURCE_ASSETS.map((source) => source.rightsClass)),
    byState: countBy(REGIONAL_SOURCE_ASSETS.map((source) => source.state)),
  };
}

export function findRegionalSourceAsset(sourceAssetId: string): RegionalSourceAsset | null {
  return REGIONAL_SOURCE_ASSETS.find((source) => source.sourceAssetId === sourceAssetId) ?? null;
}
