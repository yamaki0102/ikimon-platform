export type PlaceCategoryId = "nature" | "eat" | "buy" | "care" | "medical" | "learn" | "play" | "pray" | "stay" | "service" | "admin" | "transit";

export type PlaceCategoryDef = { id: PlaceCategoryId; label: string; glyph: string; examples: readonly [string, string, string] };

export const PLACE_CATEGORIES: readonly PlaceCategoryDef[] = [
  { id: "nature", label: "自然を歩く", glyph: "🌿", examples: ["山・川・湖", "浜・森", "観察スポット"] },
  { id: "eat", label: "食べる・飲む", glyph: "🍴", examples: ["飲食店", "カフェ", "居酒屋"] },
  { id: "buy", label: "買う", glyph: "🛍", examples: ["商店", "スーパー", "直売所"] },
  { id: "care", label: "整える・癒やす", glyph: "♨", examples: ["美容室", "整体", "温泉"] },
  { id: "medical", label: "診てもらう", glyph: "✚", examples: ["病院", "薬局", "整骨院"] },
  { id: "learn", label: "学ぶ・通う", glyph: "📖", examples: ["学校", "図書館", "習い事"] },
  { id: "play", label: "遊ぶ・観る", glyph: "🎡", examples: ["動物園", "博物館", "運動施設"] },
  { id: "pray", label: "祈る・弔う", glyph: "⛩", examples: ["神社", "寺院", "霊園"] },
  { id: "stay", label: "泊まる", glyph: "🛏", examples: ["ホテル", "旅館", "キャンプ場"] },
  { id: "service", label: "頼む・直す", glyph: "🔧", examples: ["修理", "クリーニング", "不動産"] },
  { id: "admin", label: "手続き・用事", glyph: "🏛", examples: ["役所", "郵便局", "銀行"] },
  { id: "transit", label: "移動する", glyph: "🚉", examples: ["駅", "駐車場", "ガソリンスタンド"] },
];

export const PLACE_CATEGORY_IDS: readonly PlaceCategoryId[] = PLACE_CATEGORIES.map((c) => c.id);
export const isPlaceCategoryId = (v: unknown): v is PlaceCategoryId => typeof v === "string" && (PLACE_CATEGORY_IDS as readonly string[]).includes(v);
export const placeCategoryDef = (id: PlaceCategoryId): PlaceCategoryDef => PLACE_CATEGORIES.find((c) => c.id === id)!;

export const HIDDEN_CATEGORY = "_hidden";
export const PENDING_CATEGORY = "_pending";
export const DISPENSING_TAG = "dispensing";

export type PlaceClassifyInput = { place_kind?: string | null; canonical_name?: string | null; metadata_json?: string | null };
export type PlaceClassification = {
  primary: PlaceCategoryId | typeof HIDDEN_CATEGORY;
  tags: string[];
  rule_id: string;
  status: "confirmed";
};

type Rule = { id: string; primary: PlaceCategoryId | typeof HIDDEN_CATEGORY; name?: RegExp; kv?: readonly string[]; tags?: readonly PlaceCategoryId[] };

const PRAY = "(?:神社|寺|寺院|修道院|教会|霊園|墓地|斎場|葬儀|納骨|大社|神宮|八幡宮|稲荷|礼拝|モスク|祠|霊苑|墓園)";
const EAT = "(?:カフェ|cafe|珈琲|コーヒー|喫茶|食堂|レストラン|居酒屋|ラーメン|らーめん|寿司|鮨|そば|蕎麦|うどん|パン|ベーカリー|焼肉|焼鳥|焼き鳥|バー$|ビストロ|ダイニング|ファミレス|定食|カレー|餃子|天ぷら|うなぎ|鰻|洋食|中華|スイーツ|ケーキ|洋菓子|和菓子|パティスリー)";
const NATURE_NAME = /(?:自然|森林|緑地|湿地|干潟|渓谷|海岸|砂丘|砂浜|湖|沼|池$|山$|岳$|峠|滝|川$|河川|河原|原生|里山|雑木林|野鳥|ビオトープ|湧水|岬|浜$|海浜|丘陵)/u;

const RULES: readonly Rule[] = [
  { id: "n-farm", primary: HIDDEN_CATEGORY, name: /(?:^|[^a-z])(?:田|畑|農地|圃場|果樹園|茶園|ほ場|水田)$|農園$/u, kv: ["landuse=farmland", "landuse=farmyard", "landuse=orchard", "landuse=vineyard", "landuse=meadow"] },
  { id: "n-work", primary: HIDDEN_CATEGORY, name: /(?:工場|事務所|倉庫|処理場|浄水場|下水|清掃センター|ダム$|変電所|消防署|消防団|発電所|ポンプ場|配水)/u, kv: ["landuse=industrial", "man_made=works", "man_made=wastewater_plant", "man_made=water_works", "waterway=dam", "amenity=fire_station", "power=substation", "power=plant", "building=industrial", "building=warehouse"] },

  { id: "d-pharm-store", primary: "buy", name: /ドラッグ|ドラックストア|ドラッグストア/u, kv: ["shop=chemist"] },
  { id: "m-pharm", primary: "medical", name: /薬局|調剤薬局|ファーマシー/u, kv: ["amenity=pharmacy"] },
  { id: "m-vet", primary: "medical", name: /動物病院|獣医|アニマルクリニック|ペットクリニック/u, kv: ["amenity=veterinary"] },
  { id: "m-bone", primary: "medical", name: /整骨院|接骨院|鍼灸|はり灸|針灸|柔道整復/u, kv: ["healthcare=physiotherapist", "healthcare=acupuncture"] },
  { id: "m-care", primary: "medical", name: /介護|デイサービス|老人ホーム|特養|老健|グループホーム|子育て支援|児童館|地域包括|訪問看護|福祉|ケアセンター|障害者|放課後等デイ/u, kv: ["amenity=nursing_home", "social_facility=nursing_home", "social_facility=group_home", "social_facility=assisted_living", "amenity=social_facility"] },
  { id: "m-clinic", primary: "medical", name: /病院|医院|クリニック|診療所|歯科|医療センター|内科|外科|小児科|眼科|耳鼻|皮膚科|整形外科|産婦人科|歯医者|ホスピタル/u, kv: ["amenity=hospital", "amenity=clinic", "amenity=doctors", "amenity=dentist", "healthcare=hospital", "healthcare=clinic", "healthcare=doctor", "healthcare=dentist"] },

  { id: "s-stay", primary: "stay", name: /ホテル|旅館|民宿|ゲストハウス|旅籠|ロッジ|コテージ|キャンプ|オートキャンプ|ペンション|宿$|ホステル|リゾート|グランピング|バンガロー/u, kv: ["tourism=hotel", "tourism=hostel", "tourism=guest_house", "tourism=motel", "tourism=camp_site", "tourism=caravan_site", "tourism=chalet", "tourism=apartment"] },

  { id: "l-learn", primary: "learn", name: /小学校|中学校|高等学校|高校|大学|短大|専門学校|幼稚園|保育園|保育所|こども園|認定こども|学園|塾|スクール|教室|図書館|学習センター|予備校|習い事|教習所|寺子屋/u, kv: ["amenity=school", "amenity=kindergarten", "amenity=university", "amenity=college", "amenity=library", "amenity=language_school", "amenity=driving_school", "amenity=music_school", "amenity=childcare"] },
  { id: "p-pray-eat", primary: "pray", name: new RegExp(`${PRAY}.*${EAT}|${EAT}.*${PRAY}$`, "u"), tags: ["eat"] },
  { id: "e-eat", primary: "eat", name: new RegExp(EAT, "u"), kv: ["amenity=restaurant", "amenity=cafe", "amenity=bar", "amenity=pub", "amenity=fast_food", "amenity=food_court", "amenity=ice_cream", "amenity=biergarten"] },
  { id: "p-pray", primary: "pray", name: new RegExp(PRAY, "u"), kv: ["amenity=place_of_worship", "amenity=grave_yard", "landuse=cemetery", "amenity=funeral_hall", "building=shrine", "building=temple", "building=church", "historic=wayside_shrine"] },

  { id: "c-care", primary: "care", name: /美容|ヘアサロン|ヘアー|サロン|理容|床屋|エステ|整体|もみほぐし|リラクゼーション|マッサージ|ネイル|まつげ|温泉|スパ$|銭湯|湯$|サウナ|岩盤浴|スーパー銭湯|健康ランド/u, kv: ["shop=hairdresser", "shop=beauty", "shop=massage", "shop=nails", "amenity=spa", "amenity=public_bath", "leisure=sauna", "leisure=spa", "natural=hot_spring"] },


  { id: "t-transit", primary: "transit", name: /駅$|バス停|バスターミナル|バスセンター|駐車場|パーキング|ガソリンスタンド|給油所|サービスエリア|パーキングエリア|インターチェンジ|空港|港$|フェリー|ターミナル|停留所|レンタカー|駐輪/u, kv: ["railway=station", "railway=halt", "railway=tram_stop", "highway=bus_stop", "public_transport=station", "public_transport=platform", "amenity=parking", "amenity=fuel", "amenity=bus_station", "amenity=bicycle_parking", "aeroway=aerodrome", "amenity=ferry_terminal"] },
  { id: "a-admin", primary: "admin", name: /役所|役場|区役所|市役所|町役場|郵便局|銀行|信用金庫|信金|農協|交番|駐在所|警察署|裁判所|税務署|法務局|公民館|出張所|サービスセンター|年金事務所|ハローワーク|市民センター|コミュニティセンター/u, kv: ["amenity=bank", "amenity=post_office", "amenity=police", "amenity=townhall", "amenity=courthouse", "office=government", "amenity=community_centre", "amenity=atm"] },

  { id: "v-service", primary: "service", name: /クリーニング|ランドリー|修理|車検|整備|板金|不動産|式場|結婚|ブライダル|貸し|レンタル|コワーキング|貸会議室|貸しスペース|写真館|フォトスタジオ|リフォーム|鍵|仕立て|工務店|葬祭|ウェディング|スタジオ/u, kv: ["shop=dry_cleaning", "shop=laundry", "shop=car_repair", "shop=tailor", "shop=photo", "shop=locksmith", "shop=copyshop", "shop=estate_agent", "office=estate_agent", "amenity=car_wash", "amenity=coworking_space", "amenity=events_venue", "craft=*", "amenity=studio"] },

  { id: "y-play", primary: "play", name: /動物園|水族館|博物館|美術館|科学館|資料館|記念館|映画館|シネマ|劇場|ホール$|ジム|フィットネス|ヨガ|体育館|運動公園|プール|スタジアム|球場|競技場|ゴルフ|テニス|ボウリング|カラオケ|ゲームセンター|遊園地|テーマパーク|アスレチック|スポーツ|運動場|グラウンド|サーキット|牧場|ふれあい|ドーム$|アリーナ|道場|ミュージアム|ギャラリー/u, kv: ["tourism=museum", "tourism=gallery", "tourism=zoo", "tourism=aquarium", "tourism=theme_park", "tourism=attraction", "amenity=cinema", "amenity=theatre", "amenity=arts_centre", "leisure=sports_centre", "leisure=fitness_centre", "leisure=swimming_pool", "leisure=stadium", "leisure=golf_course", "leisure=pitch", "leisure=playground", "leisure=track", "leisure=amusement_arcade", "leisure=bowling_alley", "leisure=water_park", "leisure=dance", "leisure=miniature_golf"] },

  { id: "b-buy", primary: "buy", name: /スーパー|マーケット|市場|直売|商店|百貨店|デパート|ショッピング|モール|コンビニ|ホームセンター|ドン・キホーテ|ドンキ|ストア|ショップ|販売|物産|道の駅|雑貨|書店|本屋|花屋|酒店|酒屋|精肉|鮮魚|青果|八百屋|ファッション|衣料|家電|リサイクル/u, kv: ["amenity=marketplace", "shop=*"] },

  { id: "z-nature", primary: "nature", kv: ["natural=peak", "natural=beach", "natural=wood", "natural=water", "natural=wetland", "natural=bay", "natural=cape", "natural=cliff", "natural=spring", "natural=scrub", "natural=heath", "natural=grassland", "natural=volcano", "natural=valley", "natural=ridge", "natural=coastline", "natural=cave_entrance", "waterway=river", "waterway=stream", "waterway=waterfall", "leisure=nature_reserve", "boundary=protected_area", "landuse=forest", "landuse=conservation", "place=island", "tourism=viewpoint", "leisure=bird_hide", "leisure=garden"] },
];

const NAME_ONLY_NATURE_KINDS = new Set(["nature_area", "mountain", "river", "lake", "forest", "coast", "beach", "wetland", "sea", "island", "waterfall", "hill", "field_site"]);
const PLAY_KINDS = new Set(["museum", "zoo", "aquarium", "stadium", "sports", "playground", "theme_park"]);
const PRAY_KINDS = new Set(["shrine", "temple", "church", "cemetery"]);
const LEARN_KINDS = new Set(["school", "library", "university", "kindergarten"]);

const PAIR_KEYS = new Set(["tags", "osm_tags", "osm", "properties", "source_tags", "attributes"]);
const SKIP_KEYS = new Set(["name", "name_ja", "name_en", "alias", "aliases", "source", "url", "website", "note", "description", "municipality", "prefecture", "locality"]);

export function metadataPairs(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!raw) return out;
  let meta: unknown;
  try { meta = JSON.parse(raw); } catch { return out; }
  const addValue = (key: string, value: unknown): void => {
    const k = key.trim().toLowerCase();
    if (!k || SKIP_KEYS.has(k)) return;
    if (typeof value === "string") for (const part of value.split(";")) { const v = part.trim().toLowerCase(); if (v) out.add(`${k}=${v}`); }
    else if (typeof value === "boolean") out.add(`${k}=${value ? "yes" : "no"}`);
  };
  const walk = (obj: unknown, depth: number): void => {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "string" && item.includes("=")) { const i = item.indexOf("="); addValue(item.slice(0, i), item.slice(i + 1)); }
        else if (depth < 2) walk(item, depth + 1);
      }
      return;
    }
    if (typeof obj !== "object" || obj === null) return;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (PAIR_KEYS.has(key.toLowerCase()) && depth < 2) walk(value, depth + 1);
      else addValue(key, value);
    }
  };
  walk(meta, 0);
  return out;
}

const hasKv = (pairs: ReadonlySet<string>, kvs: readonly string[]): boolean => kvs.some((kv) => {
  if (kv.endsWith("=*")) { const p = kv.slice(0, -1); for (const x of pairs) if (x.startsWith(p) && x !== `${p}no`) return true; return false; }
  return pairs.has(kv);
});

export function classifyPlace(place: PlaceClassifyInput): PlaceClassification | null {
  const name = String(place.canonical_name ?? "").normalize("NFKC").trim().toLowerCase();
  const kind = String(place.place_kind ?? "").trim().toLowerCase();
  const pairs = metadataPairs(place.metadata_json);
  const dispensing = pairs.has("dispensing=yes");

  const finish = (rule: Rule | { id: string; primary: PlaceCategoryId; tags?: readonly PlaceCategoryId[] }): PlaceClassification => {
    const tags = new Set<string>(rule.tags ?? []);
    if (rule.primary === "buy" && dispensing) { tags.add("medical"); tags.add(DISPENSING_TAG); }
    if (rule.primary === "medical" && dispensing && /薬局|ファーマシー/u.test(name)) tags.add(DISPENSING_TAG);
    if (rule.primary === "pray" && (pairs.has("cafe=yes") || pairs.has("amenity=cafe") || pairs.has("food=yes"))) tags.add("eat");
    if (rule.primary === "stay" && /温泉|スパ|サウナ/u.test(name)) tags.add("care");
    if (rule.primary === "care" && /旅館|ホテル/u.test(name)) tags.add("stay");
    if (rule.primary === "play" && /温泉|スパ|サウナ|銭湯/u.test(name)) tags.add("care");
    tags.delete(rule.primary);
    return { primary: rule.primary, tags: [...tags].sort(), rule_id: rule.id, status: "confirmed" };
  };

  if (name) {
    if (/公園$/u.test(name)) {
      if (hasKv(pairs, RULES.find((r) => r.id === "z-nature")!.kv!) && !pairs.has("leisure=playground")) return finish({ id: "park-nature-tag", primary: "nature" });
      if (NATURE_NAME.test(name) && !/(?:運動|遊戯|児童|広場|スポーツ)/u.test(name)) return finish({ id: "park-nature-name", primary: "nature" });
      return finish({ id: "park-default", primary: "play" });
    }
    for (const r of RULES) if (r.name?.test(name)) return finish(r);
    if (kind === "park" && NATURE_NAME.test(name)) return finish({ id: "park-nature-name", primary: "nature" });
  }
  for (const r of RULES) if (r.kv && hasKv(pairs, r.kv)) return finish(r);

  if (kind === "park") return finish({ id: "kind-park", primary: "play" });
  if (NAME_ONLY_NATURE_KINDS.has(kind)) return finish({ id: "kind-nature", primary: "nature" });
  if (PLAY_KINDS.has(kind)) return finish({ id: "kind-play", primary: "play" });
  if (PRAY_KINDS.has(kind)) return finish({ id: "kind-pray", primary: "pray" });
  if (LEARN_KINDS.has(kind)) return finish({ id: "kind-learn", primary: "learn" });
  if (name && NATURE_NAME.test(name) && kind === "other_named_area") return finish({ id: "name-nature", primary: "nature" });
  return null;
}

export type StoredAssignmentSource = "rule" | "ai" | "human";
export const canOverwriteAssignment = (existing: StoredAssignmentSource | null | undefined): boolean => existing === null || existing === undefined || existing === "rule";
