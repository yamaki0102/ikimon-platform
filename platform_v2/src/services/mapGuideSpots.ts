export type MapGuideSourceLink = {
  label: string;
  url: string;
};

export type MapGuideSpot = {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  locationPrecision: "exact" | "approximate";
  visitAnchorLabel: string;
  publicLocationMode: "exact" | "area" | "hidden";
  subjectLocationMode: "same_as_visit_anchor" | "area_public" | "hidden";
  sensitiveReviewStatus: "cleared" | "needs_review";
  category: "heritage" | "nature" | "community" | "owner";
  approvalState: "public_source" | "owner_verified";
  preview: string;
  script: string;
  storyPoints: string[];
  triggerRadiusM: number;
  unlockedRadiusM: number;
  guideAreaId?: string;
  guideProgramIds?: string[];
  ownerType?: "owner" | "community" | "municipality" | "school";
  visibilityStatus?: "published" | "paused" | "hidden";
  safetyStatus?: "active" | "caution" | "closed";
  landownerConsent?: boolean;
  availableTimePolicy?: "anytime_public" | "business_hours" | "event_only";
  distanceDisplayPolicy?: "coarse";
  requiredAccuracyM?: number;
  accuracyBufferCapM?: number;
  sourceLinks: MapGuideSourceLink[];
};

export type MapGuideProgram = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  participationMode: "any_order" | "ordered";
  status: "published" | "draft" | "paused" | "closed";
  guideSpotIds: string[];
};

type Bbox = [number, number, number, number];

export type MapGuideSpotFeature = {
  type: "Feature";
  properties: Omit<MapGuideSpot, "lat" | "lng">;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

export type MapGuideSpotFeatureCollection = {
  type: "FeatureCollection";
  features: MapGuideSpotFeature[];
};

const HAMAMATSU_CITY_HERITAGE_URL = "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamamatsuchiikiisan.html";

export const MAP_GUIDE_PROGRAMS: MapGuideProgram[] = [
  {
    id: "aikan-renri-guide-relay",
    slug: "aikan-renri-guide-relay",
    title: "連理の木 自然共生ガイドリレー",
    summary: "愛管株式会社の自然共生サイト周辺で、記録を残すと現地ガイドがあとから聞ける企画です。",
    participationMode: "any_order",
    status: "published",
    guideSpotIds: ["aikan-renri-lenri-tree"],
  },
  {
    id: "hamamatsu-heritage-guide-relay",
    slug: "hamamatsu-heritage-guide-relay",
    title: "浜松地域遺産ガイドリレー",
    summary: "地域遺産の近くで記録を残しながら、現地で聞ける短いガイドをつないでいく企画です。",
    participationMode: "any_order",
    status: "published",
    guideSpotIds: [
      "hamamatsu-shijimizuka-site",
      "hamamatsu-nakamurake-house",
      "hamamatsu-maisaka-wakihonjin",
      "hamamatsu-castle-ruins",
      "hamamatsu-ryotanji-garden",
      "hamamatsu-makaya-temple-garden",
      "hamamatsu-hourinji-temple",
      "hamamatsu-heritage-system",
    ],
  },
];

export const MAP_GUIDE_SPOTS: MapGuideSpot[] = [
  {
    id: "aikan-renri-lenri-tree",
    title: "Cafe & Restaurant LENRIと連理の木",
    subtitle: "愛管の自然共生サイトで、食・農・設備技術と土地の関係を聞く",
    lat: 34.81435,
    lng: 137.7327,
    locationPrecision: "exact",
    visitAnchorLabel: "Cafe & Restaurant LENRI/連理の木の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "owner",
    approvalState: "owner_verified",
    preview: "連理の木、れんり農園、Cafe & Restaurant LENRI、地中熱GXを、同じ場所で育ってきた地域の物語として紹介します。",
    script: "ここは、愛管株式会社が設備会社としての現場力を、食、農、自然共生、教育へ少しずつ結び直してきた場所です。連理の木の下で始まった活動は、れんり農園、Cafe & Restaurant LENRI、地域の素材を生かす食の場へ広がりました。訪れたら、看板や建物だけでなく、連理の木、農園、足元の草地、水や熱の使い方にも目を向けてください。",
    storyPoints: [
      "連理の木を中心に、食、農、自然共生、設備技術が同じ場所でつながっている。",
      "Cafe & Restaurant LENRIは、地域素材や場づくりを通じて人と土地の関係を見せる入口。",
      "地中熱GXや自然共生サイトの活動も、裏側でこの場所の思想を支えている。",
    ],
    triggerRadiusM: 120,
    unlockedRadiusM: 45,
    guideAreaId: "aikan-renri-ikan-hq",
    guideProgramIds: ["aikan-renri-guide-relay"],
    ownerType: "owner",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 120,
    accuracyBufferCapM: 80,
    sourceLinks: [
      { label: "愛管株式会社: 生物多様性", url: "https://i-kan.co.jp/company/biodiversity/" },
      { label: "浜松市: 地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL },
    ],
  },
  {
    id: "hamamatsu-shijimizuka-site",
    title: "蜆塚遺跡",
    subtitle: "縄文時代の集落と貝塚を、今の公園で見る",
    lat: 34.713292,
    lng: 137.7031213,
    locationPrecision: "exact",
    visitAnchorLabel: "蜆塚公園・博物館周辺の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "東海地方でも大きな縄文時代の集落跡として紹介される場所です。",
    script: "ここは、縄文時代後期から晩期にかけての集落跡を、今の公園の中で見られる場所です。浜松市の紹介では、環状にめぐる貝塚を伴う集落として説明されています。歩く時は、展示物だけでなく、地形、貝塚、隣接する博物館までをひとつの時間の層として見てください。",
    storyPoints: [
      "縄文時代の暮らしの跡が、現在は公園として保存されている。",
      "貝塚は食べ物のごみではなく、当時の環境や暮らしを読む手がかりになる。",
      "博物館とセットで見ると、現地の地形と出土資料がつながる。",
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 蜆塚遺跡", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/hamatsu/hamatsu/shizimizuka.html" },
    ],
  },
  {
    id: "hamamatsu-nakamurake-house",
    title: "中村家住宅",
    subtitle: "宇布見に残る大規模な近世住宅",
    lat: 34.6974944,
    lng: 137.6336934,
    locationPrecision: "exact",
    visitAnchorLabel: "中村家住宅の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "国指定重要文化財として紹介される、雄踏町宇布見の歴史的住宅です。",
    script: "ここでは、建物の大きさだけでなく、部屋の配置や柱の立ち方にも注目してください。浜松市の紹介では、敷地内に残る寄棟造葦葺平屋建の建物として説明されています。住宅は、ひとつの家の歴史だけでなく、宇布見の土地と人の移動を読む入口になります。",
    storyPoints: [
      "大きな屋敷構えと主屋の構造から、地域の有力家の暮らしが見える。",
      "建物の間取りや柱の配置は、保存建築を読む具体的な手がかりになる。",
      "浜名湖周辺の歴史や東海道沿いの文化とつながる。",
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 中村家住宅", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/yuto/yuto/nakamurake.html" },
    ],
  },
  {
    id: "hamamatsu-maisaka-wakihonjin",
    title: "旧舞坂脇本陣",
    subtitle: "東海道舞坂宿と今切渡しの記憶",
    lat: 34.68472,
    lng: 137.6087012,
    locationPrecision: "exact",
    visitAnchorLabel: "旧舞坂脇本陣の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "旧東海道に残る脇本陣の遺構として紹介される場所です。",
    script: "ここは、江戸時代の東海道舞坂宿を想像するための入口です。浜松市の紹介では、舞坂宿は江戸から30番目の宿場で、今切渡しの渡船場に関わる場所として説明されています。建物だけでなく、海と街道、人の移動が重なる地点として見てください。",
    storyPoints: [
      "舞坂宿は東海道と今切渡しを結ぶ交通の節点だった。",
      "復元された建物から、宿場町の役割を現地で想像できる。",
      "湖・海・街道が重なる浜松らしい文化景観の入口になる。",
    ],
    triggerRadiusM: 220,
    unlockedRadiusM: 90,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 旧舞坂脇本陣", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/maisaka/maisaka/wakihonjin.html" },
    ],
  },
  {
    id: "hamamatsu-castle-ruins",
    title: "浜松城跡",
    subtitle: "街なかに残る城郭の石垣と地形",
    lat: 34.7117306,
    lng: 137.7249641,
    locationPrecision: "exact",
    visitAnchorLabel: "浜松城公園の来訪地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "市指定史跡として、野面積みの石垣などが紹介されています。",
    script: "浜松城跡では、天守だけでなく石垣と地形を見てください。浜松市の紹介では、野面積みと呼ばれる古い石垣の特徴が残る場所として説明されています。街の中心にありながら、城の防御、地形、まちの記憶が同時に見える場所です。",
    storyPoints: [
      "石垣の積み方から、古い城郭の技術が読める。",
      "城跡は観光地であると同時に、市街地の地形を理解する手がかりになる。",
      "三方ヶ原合戦や犀ヶ崖など、周辺の戦国史跡ともつながる。",
    ],
    triggerRadiusM: 260,
    unlockedRadiusM: 110,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 浜松城跡", url: "https://www.city.hamamatsu.shizuoka.jp/kouen/siro/hamamatujou.html" },
    ],
  },
  {
    id: "hamamatsu-ryotanji-garden",
    title: "龍潭寺庭園",
    subtitle: "井伊谷の歴史と庭園を見る",
    lat: 34.8286004,
    lng: 137.6679167,
    locationPrecision: "exact",
    visitAnchorLabel: "龍潭寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "浜名区引佐町井伊谷の文化財として紹介される庭園です。",
    script: "龍潭寺では、庭そのものだけでなく、井伊谷の地形や周辺の城跡、寺院の配置を一緒に見てください。浜松市の文化財一覧では、龍潭寺庭園が名勝として紹介されています。静かな庭の奥に、地域の政治と信仰の記憶が重なっています。",
    storyPoints: [
      "庭園は鑑賞の場であり、井伊谷の歴史を読む入口でもある。",
      "寺の建物、庭、背後の地形を一体で見ると場所の意味が立ち上がる。",
      "周辺の地域遺産センターや城跡と合わせて巡ると理解が深まる。",
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 名勝", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/shitei/meisho.html" },
      { label: "浜松市: 地域遺産センター", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/maibun/index.html" },
    ],
  },
  {
    id: "hamamatsu-makaya-temple-garden",
    title: "摩訶耶寺庭園",
    subtitle: "湖北に残る古庭園の時間",
    lat: 34.8176672,
    lng: 137.5568322,
    locationPrecision: "exact",
    visitAnchorLabel: "摩訶耶寺庭園の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "鎌倉時代初期にさかのぼる庭園として紹介される場所です。",
    script: "摩訶耶寺庭園では、水、石、池の配置をゆっくり見てください。浜松市の文化財情報では、鎌倉時代初期に作られたとされる池泉鑑賞式の庭園として紹介されています。庭は静かな景色ですが、修復されながら受け継がれてきた文化財でもあります。",
    storyPoints: [
      "池泉鑑賞式の庭園として、石と水の配置が見どころになる。",
      "古い庭園は、自然そのものではなく、人が自然をどう見たかを残す。",
      "修復の履歴まで含めて、地域で守る文化財として見られる。",
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 摩訶耶寺庭園", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/bunkazaijyoho77.html" },
    ],
  },
  {
    id: "hamamatsu-hourinji-temple",
    title: "初山宝林寺",
    subtitle: "浜松にもたらされた黄檗文化",
    lat: 34.8170097,
    lng: 137.6917906,
    locationPrecision: "exact",
    visitAnchorLabel: "初山宝林寺の公開見学地点",
    publicLocationMode: "exact",
    subjectLocationMode: "same_as_visit_anchor",
    sensitiveReviewStatus: "cleared",
    category: "heritage",
    approvalState: "public_source",
    preview: "明の僧・独湛に関わる黄檗宗寺院として紹介されています。",
    script: "初山宝林寺では、建物の形や雰囲気に残る異国的な要素を見てください。浜松市の紹介では、明国からの渡来僧・独湛禅師と、黄檗文化が浜松にもたらされた流れが説明されています。寺を見ることは、浜松が外から来た文化を受け止めてきた歴史を見ることでもあります。",
    storyPoints: [
      "黄檗文化は、建築や信仰の表現として浜松に残っている。",
      "寺の配置や建物の意匠から、地域と外来文化の接点が見える。",
      "細江・引佐周辺の寺社や井伊谷の歴史と合わせて巡れる。",
    ],
    triggerRadiusM: 240,
    unlockedRadiusM: 100,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "business_hours",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 浜松にもたらされた黄檗文化", url: "https://www.city.hamamatsu.shizuoka.jp/hamahaku/02tenji/tokubetu/oubaku.html" },
      { label: "浜松市: 文化財情報vol.1", url: "https://www.city.hamamatsu.shizuoka.jp/bunkazai/info/info_01.html" },
    ],
  },
  {
    id: "hamamatsu-heritage-system",
    title: "浜松地域遺産認定制度",
    subtitle: "地域で受け継がれてきた文化資源を見る入口",
    lat: 34.710834,
    lng: 137.726126,
    locationPrecision: "approximate",
    visitAnchorLabel: "浜松中心部の地域遺産制度紹介地点",
    publicLocationMode: "area",
    subjectLocationMode: "area_public",
    sensitiveReviewStatus: "cleared",
    category: "community",
    approvalState: "public_source",
    preview: "浜松市が地域の文化資源を顕彰する制度の考え方を紹介します。",
    script: "浜松市の地域遺産認定制度は、指定文化財だけでなく、地域で大切にされてきた文化資源を見えるようにする仕組みです。市の説明では、地域の個性を顕在化させ、市民協働で活用することが期待されています。地図で点を見る時も、建物や木だけでなく、それを受け継ぐ人や地域の記憶を合わせて見てください。",
    storyPoints: [
      "制度は、地域に残る文化資源をゆるやかに認め、活用するための入口になる。",
      "所有者や地域の同意、文化財保護審議会の意見を経て認定される。",
      "ZUKANのガイドでは、出典を明示しながら現地で聞ける形に変換する。",
    ],
    triggerRadiusM: 300,
    unlockedRadiusM: 120,
    guideProgramIds: ["hamamatsu-heritage-guide-relay"],
    ownerType: "municipality",
    visibilityStatus: "published",
    safetyStatus: "active",
    landownerConsent: true,
    availableTimePolicy: "anytime_public",
    distanceDisplayPolicy: "coarse",
    requiredAccuracyM: 150,
    accuracyBufferCapM: 100,
    sourceLinks: [
      { label: "浜松市: 浜松地域遺産認定制度", url: HAMAMATSU_CITY_HERITAGE_URL },
    ],
  },
];

function inBbox(spot: MapGuideSpot, bbox: Bbox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return spot.lng >= minLng && spot.lng <= maxLng && spot.lat >= minLat && spot.lat <= maxLat;
}

function toFeature(spot: MapGuideSpot): MapGuideSpotFeature {
  const { lat: _lat, lng: _lng, ...properties } = spot;
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: [spot.lng, spot.lat],
    },
  };
}

export function listMapGuideSpotsForBbox(options: { bbox: Bbox; limit?: number }): MapGuideSpotFeatureCollection {
  const limit = Math.max(1, Math.min(120, options.limit ?? 80));
  return {
    type: "FeatureCollection",
    features: MAP_GUIDE_SPOTS
      .filter((spot) => inBbox(spot, options.bbox))
      .slice(0, limit)
      .map(toFeature),
  };
}
