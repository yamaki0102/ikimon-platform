import type { ObservationAiSubjectCandidate } from "./cloudflareObservationAi";
import {
  GEMINI_CANDIDATE_FUSION_RULE_VERSION,
  applyGeminiObservationSummary,
  type GeminiEnvironmentEvidence,
  type GeminiFusedCandidate,
  type GeminiMergedObservation,
  type GeminiObservationImage,
  type GeminiObservationSummary,
  type GeminiRecordClass,
  parseGeminiPhotoReadings,
} from "./geminiObservationBatch";
import { FEATURE_TERMS, PLACE_SLOTS, PLACE_TERMS } from "./recordReading";
import { LOOKALIKE_PROMPT, LOOKALIKE_STORE_PREFIX, MEASURE_VERSION, measuredBand, normalizeLookalike, readLookalike, readScene, sceneQuestions, subjectQuestions, type DecideMany, type LookalikeCard, type LookalikeMeasure, type SceneMeasure } from "./observationCardMeasure";
import { bytesToBase64, cropRgb, decodePngRgb, encodePngRgb, tileRects, wideRect, type PixelRect } from "./observationCardPng";

export const CARD_ID_MODEL = "gemini-3.1-flash-lite";
export const CARD_WRITER_MODEL = "gemini-4-hydrogen";
export const CARD_TILE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const CARD_DECISION_MODEL = "gemini-decision-1";
export const CARD_PROMPT_VERSION = "observation-card/v1";
export const CARD_STORE_PREFIX = "ai-cards/v1/";
export const CARD_TILE_GRID = 5;
export const CARD_TILE_MAX_IMAGES = 2;
export const CARD_TILE_BUDGET_MS = 45_000;
export const CARD_TILE_SKIP_CLASSES = ["person", "document", "food", "object"];
const NON_ORGANISM_CLASSES = new Set(["person", "document", "food", "object"]);
export const CARD_PUBLIC_EVIDENCE_MAX = 160;
export const CARD_PUBLIC_TEXT_MAX = 220;

type Json = Record<string, unknown>;
type Rank = ObservationAiSubjectCandidate["rank"];

export type CardModelCall = (model: string, parts: Json[], options: { temperature: number; thinkingLevel?: string }) => Promise<string>;

export type CardDeps = {
  gemini: CardModelCall;
  decide?: (images: GeminiObservationImage[], question: string) => Promise<number>;
  measure?: DecideMany;
  onScene?: (scene: SceneMeasure) => Promise<void>;
  tileModel?: (pngBase64: string, prompt: string) => Promise<string>;
  tileSource?: (assetIndex: number) => Promise<Uint8Array | null>;
  loadCard: (key: string) => Promise<Json | null>;
  saveCard: (key: string, card: Json) => Promise<void>;
  tileConcurrency?: number;
  tileBudgetMs?: number;
  now?: () => number;
};

export type CardInput = { observedAt: string | null; images: GeminiObservationImage[] };

export type CardStats = {
  subjects: number;
  tileCalls: number;
  tileFound: number;
  tileError: string | null;
  secondCheck: "agree" | "conflict" | "coarser" | "skipped";
  cardsUsed: number;
  cardsCreated: number;
  measure?: { version: string; scene: SceneMeasure | null; lookalike: LookalikeMeasure | null; subjectP: number[]; error: string | null };
};

const RECORD_CLASSES: GeminiRecordClass[] = ["organism", "person", "food", "environment", "object", "document", "mixed", "unknown"];
const AREA_SLOTS: Record<string, GeminiEnvironmentEvidence["cues"][number]["slot"]> = {
  vegetation_structure_candidates: "vegetation_structure",
  succession_stage_candidates: "vegetation_structure",
  human_influence_candidates: "human_influence",
  moisture_regime_candidates: "moisture",
  management_hint_candidates: "management_signs",
};
const PLACE_TYPES: Record<string, GeminiEnvironmentEvidence["fields"]["place_type"]> = {
  落葉広葉樹林: "woodland", 常緑広葉樹林: "woodland", "スギ・ヒノキ人工林": "woodland", 竹林: "woodland", 社寺林: "woodland",
  草地: "grassland_urban_edge", 耕作放棄地: "grassland_urban_edge",
  河川敷: "water_edge", "河川・渓流": "water_edge", "ため池・湖沼": "water_edge",
  "湿地・ヨシ原": "wetland", 水田: "wetland", 棚田: "wetland",
  海岸砂丘: "coast", 岩礁海岸: "coast",
  都市公園: "urban", "街路樹・市街地": "urban", 庭園: "urban", "石垣・護岸など人工構造物": "urban",
};
export const CARD_HABITATS = [...Object.keys(PLACE_TYPES), "畑", "高山・亜高山帯", "里山", "積雪地"];
const RANKS = new Set<Rank>(["species", "genus", "family", "order", "class", "lifeform", "unknown"]);
const BAND_CONFIDENCE: Record<string, number> = { high: 0.85, medium: 0.6, low: 0.3 };
const BAND_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };
const EXCLUDED_NAME = /^(ヒト|人間|人物|人|空|水|土)$|岩|^石|雲|雪|砂|網|巣$|足跡/;
const VAGUE_NAME = /^(植物|樹木|樹木類|草本|草本類|草本植物|草|木|植物の葉|植物の果実)$/;
const IMPLAUSIBLE_TILE_NAME = /ワニ|クロコダイル|アリゲーター|ライオン|トラ$|ゾウ|キリン|ペンギン/;
const TILE_COARSE: Record<string, [string, string, Rank]> = {
  bird: ["鳥類", "Aves", "class"], mammal: ["哺乳類", "Mammalia", "class"], reptile: ["爬虫類", "Reptilia", "class"], amphibian: ["両生類", "Amphibia", "class"],
  fish: ["魚類", "Actinopterygii", "class"], insect: ["昆虫", "Insecta", "class"], spider: ["クモ類", "Araneae", "order"],
};

const ID_PROMPT = (ctx: string) => `${ctx}

写真の観察記録を読み、JSONのみ返す。値は短く。
{"record_class":"${RECORD_CLASSES.join("|")}",
"main_theme":"organism|environment",
"inventory":["写っている生きものを、名前を決める前に見た目で短く書き出す。最大8"],
"habitat_type":"${CARD_HABITATS.join("|")}|その他",
"subjects":[{"name":"和名","scientific_name":"学名","role":"main|host|other_animal|background","group":"bird|mammal|reptile|amphibian|fish|insect|spider|plant|fungus|other","rank":"species|genus|family|order|class","confidence_band":"low|medium|high","view":"close|mid|far","asset_indexes":[0],"features_seen":["この写真で実際に見えた特徴 最大3"],"missing_evidence":["確定に足りない証拠 最大2"]}],
"photos":[{"asset_index":0,"assessment_state":"informative|not_informative|not_assessable",${PLACE_SLOTS.map((slot) => `"${slot}":"${PLACE_TERMS[slot].map(([code]) => code).join("|")}"`).join(",")},"feature_kinds":["${FEATURE_TERMS.filter(([code]) => code !== "unknown_feature").map(([code]) => code).join("|")}"]}],
"area_inference":{${Object.keys(AREA_SLOTS).map((k) => `"${k}":[{"label":"","confidence":0.0,"why":""}]`).join(",")}},
"narrative":"160字以内厳守。何がどう写り、どう読めるか。日時・場所は繰り返さず、情緒的な描写はしない",
"simple_summary":"80字以内",
"observer_boost":"70字以内の1文。この記録ですでに良い点。大げさな賞賛は禁止"}
- record_class は写真全体の分類。人物が主役なら person、料理・食品なら food、看板・案内板・地図・紙面・画面が主役なら document、建物・人工物が主役なら object、風景・環境が主役なら environment、生きものが主役なら organism、複数が同程度なら mixed。看板や案内板に描かれた動物のイラストは生きものとして subjects に入れない。看板・案内板の文字が読めるなら simple_summary に「...」で囲んでその題名を書く（例：看板「四日市市少年自然の家パノラマ図」）。人物の容姿・属性・個人情報はどの欄にも書かない。
- 最初に inventory を書く。写真を隅まで見て、次の順に見えるものを1行ずつ書き出す。そのあと inventory の各行に1件ずつ subjects を対応させて同定する（行を飛ばさない。最大8件）: (1) 主役の生きもの (2) 主役が止まる・食べる・隠れる植物など host (3) ほかの動物 other_animal（小さな写り込み、枝葉に隠れた鳥や虫、遠くの個体） (4) 背景や足元の植生 background（樹林、草地、コケ、シダ、水草など、まとまりごとに1件）。同じ生きものが複数枚に写るなら asset_indexes にまとめる。
- background の植生は、決め手が見えない限り「落葉広葉樹」「イネ科草本」「コケ植物」のような粗い名前にし、rank は family/order/class、view は mid か far。
- 例（カマキリが黄色い花穂に止まり、奥がススキの草地の写真）: inventory=["緑色の大きなカマキリ","カマキリが止まる黄色い花穂の草","奥に広がる穂の出たススキ状の草"] → subjects は オオカマキリ(main)、セイタカアワダチソウ(host)、ススキ類(background, genus) の3件。
- 「植物」「樹木」「草本類」だけの言い方は使わず、少なくとも「落葉広葉樹」「イネ科草本」「シダ植物」程度まで言う。そこまで言えないものは挙げない。同じ種類の個体が複数いても1件にまとめる。クモの網・巣・足跡などの痕跡は subjects に入れず narrative に書く。
- 人（ヒト）は inventory にも subjects にも入れない。機械・建物・道具、雲・空・水・岩・雪・砂など生きものでないものも入れない。生きものが見当たらなければ subjects は空配列にし、無理に埋めない。
- 樹木・栽培植物・赤トンボ類など似た種が多いものは、花・果実・葉や模様の細部といった決め手を features_seen に書けるときだけ species。書けなければ属・科で止める。
- view は、その生きものが大きくはっきり写るなら close、形は分かるが細部が見えないなら mid、遠景・小さい・不鮮明なら far。
- far のものは種まで言わない。科・属・「〜類」などで止め、confidence_band は low。mid は種の決め手が実際に見えるときだけ species、confidence_band は medium まで。
- 種の確定に必要な形質が見えなければ genus/family/order で止め、confidence_band を下げる。
- 景観・環境・建物・人の営みが主役なら main_theme は environment。裸地・礫・舗装・看板・建物など非生物は subjects に入れず area_inference と narrative に書く。
- area_inference は読み取れるキーを1件ずつ、why に写真で見えた根拠を具体的に書く。読み取れないキーは空配列。
- photos は写真1枚ごとに1件（asset_index を必ず付ける）。その写真だけから読み取れる場所のようす5項目と、写っている構造物・地形の種類 feature_kinds（最大6）を選ぶ。写真ごとに違ってよい。他の写真から推測で補わず、その写真で根拠がない項目は unknown、feature_kinds は写っているものだけにする。看板・表札・標識の文字、車のナンバー、人の名前は読まず、どの欄にも書かない（種類のコードだけ）。`;

const HABITAT_PROMPT = (type: string) => `You write habitat cards for a nature observation app. Region: Japan. Habitat type (Japanese label): ${type}
Return JSON only:
{"habitat":"English name","overview":"one sentence, max 25 words","what_to_look_for":["max 4: indicator plants, animals or structures that tell the condition of this habitat"],"confirm_more":["max 3: what to photograph next to document this habitat well (angle, distance, detail)"],"management_signs":["max 3: visible signs of human management or disturbance to check"],"seasonal_note":"one short sentence"}`;

const TAXON_PROMPT = (sci: string, ja: string, rank: string) => `You write field-guide cards for a nature observation app. Region: Japan.
Taxon: ${sci || "(no scientific name)"} / Japanese name from the identifier: ${ja} / rank: ${rank}
Return JSON only:
{"scientific_name":"","english_name":"","rank":"","overview":"one sentence, max 25 words","distinguishing_tips":["max 4 short concrete visual field marks"],"confusable_groups":[{"english_name":"","scientific_name":"","distinction_point":"how to tell apart, one short sentence"}],"confirm_more":["max 3: which body part, angle or scene to photograph next to confirm"],"season_habitat":"one short sentence"}
confusable_groups: max 3 taxa most often confused with it in Japan. If the taxon is not a real taxon, return {"invalid":true}.`;

const TRANSLATE_PROMPT = (en: string) => `Translate this field-guide card JSON into natural Japanese for general nature observers. Keep the keys and structure. In confusable_groups add "japanese_name" with the standard 和名 (katakana); if none is established, repeat the scientific name. Do not add or remove facts. JSON only.
${en}`;

const TILE_PROMPT = `これは写真の一部を拡大したものです。動物（鳥・哺乳類・爬虫類・両生類・魚・昆虫・クモなど）が確かに見えるかを答える。枝や葉の間も丁寧に見る。推測で足さない。植物は不要。いなければ空配列。
JSONのみ: {"animals":[{"name":"和名（分かる階級まで。例: 小鳥）","group":"bird|mammal|reptile|amphibian|fish|insect|spider|other","confidence_band":"low|medium|high","where":"どこにどう見えるか"}]}`;

const ZOOM_PROMPT = (known: string) => `日本国内の野外写真です。すでに同定済みの生きもの: ${known || "なし"}。拡大に写るのがそれと同じ個体・同じ種類なら {"none":true} だけを返す。1枚目は広い範囲、2枚目はその中央付近の拡大。拡大に動物が確かに写っているかを自分の目で確かめる。広い範囲の文脈から、丸太・流木・畦・岩・影・枯れ葉・ゴミなどの見間違いでないかも確かめる。日本の野外に普通いない動物に見えたら見間違いとして扱う。写っていない、または動物と言い切れなければ {"none":true} だけを返す。写っていれば同定し、種の確定に必要な形質が見えなければ genus/family/order で止める。
JSONのみ: {"name":"和名","scientific_name":"学名","rank":"species|genus|family|order|class","confidence_band":"low|medium|high","features_seen":["実際に見えた特徴 最大3"],"missing_evidence":["確定に足りない証拠 最大2"]}`;

const SECOND_PROMPT = (ctx: string) => `${ctx}

写真でいちばん大きくはっきり写る生きものを1つだけ同定する。種の決め手が実際に見えなければ属・科で止める。JSONのみ: {"name":"和名","scientific_name":"学名","rank":"species|genus|family|order|class"}`;

const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const list = (v: unknown, max = 4, each = 160): string[] => (Array.isArray(v) ? v.map((x) => str(x, each)).filter(Boolean).slice(0, max) : []);
const objects = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Json[]) : []);
const fit = (parts: string[], max: number, sep = " "): string => {
  let out = "";
  for (const part of parts.map((x) => x.trim()).filter(Boolean)) {
    const next = out ? out + sep + part : part;
    if (next.length > max) { if (!out) out = part.slice(0, max); break; }
    out = next;
  }
  return out;
};
const groupKey = (g: unknown): string => (g === "insect" || g === "spider" ? "arthropod" : String(g ?? ""));
const genusOf = (x: Json): string => str(x.scientific_name).split(" ")[0]?.toLowerCase() ?? "";

export function parseCardJson(text: string): Json | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Json) : null;
  } catch {
    return null;
  }
}

export function cardSeason(iso: string | null): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "不明";
  const m = d.getUTCMonth() + 1;
  return m >= 3 && m <= 5 ? "春" : m >= 6 && m <= 8 ? "夏" : m >= 9 && m <= 11 ? "秋" : "冬";
}

export const cardContext = (input: CardInput): string => `観察文脈: 国=日本 / 日時=${input.observedAt ?? "不明"} / 季節=${cardSeason(input.observedAt)} / 写真${input.images.length}枚`;

export const cardImageParts = (images: GeminiObservationImage[]): Json[] => images.flatMap((image, index) => [
  { text: `入力画像 asset_index=${index}` },
  { inlineData: { mimeType: image.mimeType, data: image.base64Data } },
]);

export function cardKey(sci: string, ja: string): string {
  return (sci || ja).toLowerCase().replace(/[^a-z0-9぀-ヿ一-鿿]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

export function normalizeCardSubjects(raw: unknown, imageCount: number): Json[] {
  const merged: Json[] = [];
  for (const sub of objects(raw)) {
    const name = str(sub.name, 120);
    if (!name || EXCLUDED_NAME.test(name) || /homo sapiens/i.test(str(sub.scientific_name))) continue;
    const indexes = (Array.isArray(sub.asset_indexes) ? sub.asset_indexes : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < imageCount);
    const item: Json = { ...sub, name, scientific_name: str(sub.scientific_name, 180), asset_indexes: indexes.length ? indexes : imageCount === 1 ? [0] : [] };
    const dup = merged.find((x) => x.name === name || (genusOf(item) && genusOf(x) === genusOf(item)));
    if (dup) dup.asset_indexes = [...new Set([...(dup.asset_indexes as number[]), ...(item.asset_indexes as number[])])];
    else merged.push(item);
  }
  const specific = merged.filter((x) => !VAGUE_NAME.test(String(x.name)));
  const subjects = (specific.length ? specific : merged).slice(0, 8);
  for (const sub of subjects) {
    if (!(String(sub.confidence_band) in BAND_RANK)) sub.confidence_band = "low";
    if (sub.view === "far") {
      sub.confidence_band = "low";
      if (sub.rank === "species") {
        sub.rank = "genus";
        sub.name = `${String(sub.name)}の仲間`;
        sub.scientific_name = genusOf(sub) ? str(sub.scientific_name).split(" ")[0] : "";
      }
    } else if (sub.view === "mid" && sub.confidence_band === "high") sub.confidence_band = "medium";
  }
  return subjects;
}

export function applySecondCheck(lead: Json, second: Json | null): CardStats["secondCheck"] {
  const name = str(second?.name, 120);
  if (!second || !name) return "skipped";
  const same = name === lead.name || (str(second.scientific_name) !== "" && str(second.scientific_name).toLowerCase() === str(lead.scientific_name).toLowerCase());
  if (same) return "agree";
  if (second.rank === "species") {
    lead.confidence_band = "low";
    lead.alt_candidate = name;
    lead.alt_scientific_name = str(second.scientific_name, 180);
    lead.missing_evidence = [...list(lead.missing_evidence), `別の読み取りでは${name}。決め手の確認が必要`];
    return "conflict";
  }
  if (lead.confidence_band === "high") lead.confidence_band = "medium";
  return "coarser";
}

export const decisionQuestion = (lead: Json): string => `Does this photo show ${str(lead.name, 120)}${str(lead.scientific_name) ? ` (${str(lead.scientific_name, 180)})` : ""}? Answer yes only if the visible organism is this species.`;

export function applyDecisionCheck(lead: Json, p: number | null): CardStats["secondCheck"] {
  if (p === null || !Number.isFinite(p)) return "skipped";
  if (p >= 0.8) return "agree";
  if (p >= 0.5) {
    if (lead.confidence_band === "high") lead.confidence_band = "medium";
    return "coarser";
  }
  lead.confidence_band = "low";
  lead.missing_evidence = [...list(lead.missing_evidence), "別の確認では種の決め手が見えていない。決め手の確認が必要"];
  return "conflict";
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k]!, k);
    }
  }));
  return out;
}

type TileHit = { group: string; name: string; band: string; where: string; rect: PixelRect; png: string };

async function tileSweep(input: CardInput, deps: CardDeps, subjects: Json[], stats: CardStats): Promise<Json[]> {
  const added: Json[] = [];
  if (!deps.tileModel || !deps.tileSource) return added;
  const known = () => [...subjects, ...added].map((x) => String(x.name)).join("、");
  const now = deps.now ?? Date.now;
  const deadline = now() + (deps.tileBudgetMs ?? CARD_TILE_BUDGET_MS);
  const overBudget = () => { if (now() <= deadline) return false; stats.tileError ??= "tile_budget_exceeded"; return true; };
  for (let assetIndex = 0; assetIndex < Math.min(input.images.length, CARD_TILE_MAX_IMAGES); assetIndex++) {
    if (overBudget()) break;
    const source = await deps.tileSource(assetIndex);
    if (!source) continue;
    const image = await decodePngRgb(source);
    const hits: TileHit[] = [];
    await mapLimit(tileRects(image.width, image.height, CARD_TILE_GRID), deps.tileConcurrency ?? 8, async (rect) => {
      if (overBudget()) return;
      const png = bytesToBase64(await encodePngRgb(cropRgb(image, rect)));
      stats.tileCalls++;
      let parsed: Json | null = null;
      try { parsed = parseCardJson(await deps.tileModel!(png, TILE_PROMPT)); } catch { return; }
      for (const a of objects(parsed?.animals)) {
        const name = str(a.name, 80);
        if (name && a.confidence_band !== "low" && !IMPLAUSIBLE_TILE_NAME.test(name)) hits.push({ group: str(a.group, 20) || "other", name, band: str(a.confidence_band, 10) || "medium", where: str(a.where, 160), rect, png });
      }
    });
    const best = new Map<string, TileHit>();
    for (const h of hits) if ((BAND_RANK[h.band] ?? 0) > (BAND_RANK[best.get(h.group)?.band ?? ""] ?? -1)) best.set(h.group, h);
    for (const h of [...best.values()].slice(0, 2)) {
      if (overBudget() || [...subjects, ...added].some((sub) => groupKey(sub.group) === groupKey(h.group))) continue;
      const wide = bytesToBase64(await encodePngRgb(cropRgb(image, wideRect(image.width, image.height, h.rect))));
      let zoom: Json | null = null;
      try {
        zoom = parseCardJson(await deps.gemini(CARD_ID_MODEL, [{ inlineData: { mimeType: "image/png", data: wide } }, { inlineData: { mimeType: "image/png", data: h.png } }, { text: ZOOM_PROMPT(known()) }], { temperature: 0.1, thinkingLevel: "minimal" }));
      } catch { continue; }
      const name = str(zoom?.name, 120);
      if (!zoom || zoom.none || !name || zoom.confidence_band === "low" || IMPLAUSIBLE_TILE_NAME.test(name)) continue;
      const genus = genusOf(zoom);
      if ([...subjects, ...added].some((sub) => sub.name === name || (genus && genusOf(sub) === genus))) continue;
      const coarse = ["species", "genus"].includes(str(zoom.rank)) ? TILE_COARSE[h.group] : undefined;
      added.push({
        name: coarse ? coarse[0] : name, scientific_name: coarse ? coarse[1] : str(zoom.scientific_name, 180), ...(coarse ? { tentative: name } : {}),
        role: "other_animal", group: h.group, rank: coarse ? coarse[2] : str(zoom.rank) || "class", confidence_band: "low", view: "far", asset_indexes: [assetIndex],
        features_seen: list(zoom.features_seen, 3).length ? list(zoom.features_seen, 3) : [h.where], missing_evidence: list(zoom.missing_evidence, 2), found_by: "tile",
      });
    }
  }
  stats.tileFound = added.length;
  return added;
}

async function getCard(deps: CardDeps, key: string, prompt: string, stats: CardStats): Promise<Json | null> {
  if (!key) return null;
  try {
    const stored = await deps.loadCard(key);
    if (stored?.ja && typeof stored.ja === "object") { stats.cardsUsed++; return stored.ja as Json; }
    const en = parseCardJson(await deps.gemini(CARD_WRITER_MODEL, [{ text: prompt }], { temperature: 0.2, thinkingLevel: "low" }));
    if (!en || en.invalid) return null;
    const ja = parseCardJson(await deps.gemini(CARD_ID_MODEL, [{ text: TRANSLATE_PROMPT(JSON.stringify(en)) }], { temperature: 0.1 }));
    if (!ja) return null;
    await deps.saveCard(key, { key, version: CARD_PROMPT_VERSION, en, ja });
    stats.cardsCreated++;
    stats.cardsUsed++;
    return ja;
  } catch {
    return null;
  }
}

async function getLookalike(deps: CardDeps, lead: Json, stats: CardStats): Promise<LookalikeCard | null> {
  const key = LOOKALIKE_STORE_PREFIX + cardKey(str(lead.scientific_name), String(lead.name));
  const stored = await deps.loadCard(key).catch(() => null);
  const cached = normalizeLookalike(stored?.card);
  if (cached) { stats.cardsUsed++; return cached; }
  const card = normalizeLookalike(parseCardJson(await deps.gemini(CARD_WRITER_MODEL, [{ text: LOOKALIKE_PROMPT(String(lead.name), str(lead.scientific_name), str(lead.rank)) }], { temperature: 0.1, thinkingLevel: "low" })));
  if (!card) return null;
  await deps.saveCard(key, { key, version: MEASURE_VERSION, card });
  stats.cardsCreated++;
  stats.cardsUsed++;
  return card;
}

const toRank = (v: unknown): Rank => (RANKS.has(v as Rank) ? (v as Rank) : "lifeform");

const toCandidate = (sub: Json, index: number): ObservationAiSubjectCandidate => ({
  candidateKey: `card:${index}:${cardKey("", String(sub.name)).slice(0, 60) || "subject"}`,
  vernacularName: str(sub.name, 120) || null,
  scientificName: str(sub.scientific_name, 180) || null,
  rank: toRank(sub.rank),
  confidence: typeof sub.measured_confidence === "number" ? Math.round(sub.measured_confidence * 100) / 100 : BAND_CONFIDENCE[String(sub.confidence_band)] ?? 0.3,
  visualEvidence: list(sub.features_seen, 2, 120),
  needsMoreEvidence: list(sub.missing_evidence, 2, 120),
  assetIndex: (sub.asset_indexes as number[] | undefined)?.[0],
  assetIndices: [...((sub.asset_indexes as number[] | undefined) ?? [])],
  sourceModel: sub.found_by === "tile" ? CARD_TILE_MODEL : CARD_ID_MODEL,
  subjectLocator: {},
});

const toFused = (c: ObservationAiSubjectCandidate, sub: Json): GeminiFusedCandidate => ({
  candidateKey: c.candidateKey, name: c.vernacularName, scientificName: c.scientificName, rank: c.rank, confidence: c.confidence,
  supportingFeatures: list(sub.features_seen, 3), missingFeatures: list(sub.missing_evidence, 3), contradictions: [],
  sourceLanes: ["primary"], sourceModels: [c.sourceModel ?? CARD_ID_MODEL], sourceAssetIndices: (sub.asset_indexes as number[] | undefined) ?? [],
  subjectLocator: {}, fusionScore: c.confidence,
});

export function buildCardMergedObservation(id: Json, subjects: Json[], cards: Array<Json | null>, habitat: Json | null, measure: CardStats["measure"] | null = null): GeminiMergedObservation {
  const candidates = subjects.map(toCandidate);
  const isEnvironment = id.main_theme === "environment";
  const mainIndex = candidates.length > 0 ? 0 : -1;
  const main = mainIndex >= 0 ? candidates[mainIndex]! : null;
  const lead = mainIndex >= 0 ? subjects[mainIndex]! : null;
  const look = main && lead && measure?.lookalike && measure.lookalike.other < 0.3 ? measure.lookalike : null;
  const topCandidates: GeminiFusedCandidate[] = look
    ? look.candidates.slice(0, 3).map((c, i) => {
      const feat = (state: string, tail: string) => c.features.filter((f) => f.state === state).map((f) => `${f.part ? `${f.part}: ` : ""}${f.ja}${tail}`);
      return {
        candidateKey: `card:look:${i}`, name: c.ja, scientificName: c.sci || null, rank: "species", confidence: c.p, fusionScore: c.p,
        supportingFeatures: feat("seen", ""), missingFeatures: feat("unclear", "（この写真では判別できない）"), contradictions: feat("not_seen", "（写っていない）"),
        sourceLanes: ["primary"], sourceModels: [CARD_DECISION_MODEL], sourceAssetIndices: [0], subjectLocator: {},
        measuredProbability: c.p, howToTell: c.how,
      } as GeminiFusedCandidate;
    })
    : main && lead ? [toFused(main, lead)] : [];
  if (!look && main && lead && str(lead.alt_candidate)) {
    topCandidates.push({ ...toFused(main, lead), candidateKey: "card:alt", name: str(lead.alt_candidate, 120), scientificName: str(lead.alt_scientific_name, 180) || null, rank: "species", confidence: 0.25, fusionScore: 0.25, supportingFeatures: [], missingFeatures: ["別の読み取りで挙がった候補。決め手の確認が必要"] });
  }
  const cues: GeminiEnvironmentEvidence["cues"] = [];
  const area = id.area_inference && typeof id.area_inference === "object" ? (id.area_inference as Json) : {};
  for (const [key, slot] of Object.entries(AREA_SLOTS)) for (const c of objects(area[key]).slice(0, 2)) {
    const label = str(c.label, 120);
    if (label) cues.push({ slot, label, evidence: str(c.why, 240), asset_index: 0, confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)) });
  }
  const narrative = str(id.narrative, CARD_PUBLIC_TEXT_MAX);
  const recordClass: GeminiRecordClass = RECORD_CLASSES.includes(id.record_class as GeminiRecordClass) ? (id.record_class as GeminiRecordClass) : isEnvironment ? "environment" : main ? "organism" : "unknown";
  const reviewReasons = [
    ...(lead && str(lead.alt_candidate) ? [`主対象の候補が ${String(lead.name)} と ${str(lead.alt_candidate)} に割れた`] : []),
    ...subjects.filter((s) => s.found_by === "tile").map((s) => `小さな写り込みを切り分けで検出: ${String(s.name)}${str(s.tentative) ? `（候補 ${str(s.tentative)}・未確認）` : ""}`),
  ];
  const merged: GeminiMergedObservation = {
    candidate: {
      candidateKey: main?.candidateKey ?? null, vernacularName: main?.vernacularName ?? null, scientificName: main?.scientificName ?? null,
      rank: main?.rank ?? "unknown", confidence: main?.confidence ?? 0, visualEvidence: main?.visualEvidence ?? [], needsMoreEvidence: main?.needsMoreEvidence ?? [],
      assetIndex: main?.assetIndex, assetIndices: main?.assetIndices, subjectLocator: {}, sourceModel: main?.sourceModel ?? CARD_ID_MODEL,
      nonBiological: candidates.length === 0, coexistingSubjects: candidates.slice(1, 8),
    },
    topCandidates,
    genericCandidateOnly: Boolean(main) && ["class", "lifeform", "unknown"].includes(main!.rank),
    candidateFusionRuleVersion: GEMINI_CANDIDATE_FUSION_RULE_VERSION,
    recordClass,
    informationState: narrative || cues.length > 0 || candidates.length > 0 ? "informative" : "not_informative",
    detectionState: candidates.length > 0 ? "detected" : "not_detected",
    environment: {
      assessment_state: cues.length > 0 ? "informative" : "not_informative",
      fields: { place_type: PLACE_TYPES[str(id.habitat_type)] ?? "unknown", contact_surface: "unknown", surrounding_cover: "unknown", environment_condition: "unknown", human_change: "unknown" },
      cues,
      uncertain_cues: [],
      photos: parseGeminiPhotoReadings(id.photos),
    },
    relations: [],
    qualityFlags: [],
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    specialistEscalation: null,
    summary: null,
  };
  const summary: GeminiObservationSummary = {
    narrative,
    subject_explanations: subjects.slice(0, 8).map((sub, i) => {
      const card = cards[i] ?? null;
      const tips = list(card?.distinguishing_tips, 4, 120);
      const confusable = objects(card?.confusable_groups).slice(0, 3).map((c) => `${str(c.japanese_name, 60) || str(c.scientific_name, 80)}（${str(c.distinction_point, 120)}）`);
      const uncertain = fit([
        str(sub.tentative) ? `候補は${str(sub.tentative)}ですが未確認です。` : "",
        str(sub.alt_candidate) ? `${str(sub.alt_candidate)}の可能性もあります。` : "",
        ...confusable.map((c) => `似た種類: ${c}`),
      ], CARD_PUBLIC_EVIDENCE_MAX);
      return {
        subject_id: candidates[i]!.candidateKey ?? `card:${i}`,
        title: str(sub.name, 120),
        explanation: fit([str(card?.overview, 200), ...tips.map((tip, k) => (k === 0 ? `見分け方: ${tip}` : `／${tip}`))], CARD_PUBLIC_EVIDENCE_MAX, ""),
        uncertainty: uncertain,
        next_photo: fit(list(card?.confirm_more, 3, 120), CARD_PUBLIC_EVIDENCE_MAX, "／"),
      };
    }),
    environment_summary: fit([str(id.simple_summary, 200), str(habitat?.overview, 200)], CARD_PUBLIC_TEXT_MAX),
    interaction_summary: list(habitat?.what_to_look_for, 4, 120).length ? `この環境で注目するとよいもの: ${list(habitat?.what_to_look_for, 4, 120).join("／")}` : "",
    observer_feedback: fit([measure?.scene?.qualityLabel && main && !isEnvironment && ["single", "multi"].includes(measure.scene.kind) ? `写真の情報量: ${measure.scene.qualityLabel}。` : "", str(id.observer_boost, 200), ...(candidates.length === 0 ? list(habitat?.confirm_more, 2, 120).map((x, k) => (k === 0 ? `次に撮るなら: ${x}` : `／${x}`)) : [])], CARD_PUBLIC_TEXT_MAX, ""),
  };
  return applyGeminiObservationSummary(merged, summary);
}

export async function runObservationCardPipeline(input: CardInput, deps: CardDeps): Promise<{ merged: GeminiMergedObservation; stats: CardStats; subjects: Json[]; id: Json }> {
  const stats: CardStats = { subjects: 0, tileCalls: 0, tileFound: 0, tileError: null, secondCheck: "skipped", cardsUsed: 0, cardsCreated: 0 };
  const ctx = cardContext(input);
  const measure = deps.measure;
  const measureStats: NonNullable<CardStats["measure"]> = { version: MEASURE_VERSION, scene: null, lookalike: null, subjectP: [], error: null };
  if (measure) stats.measure = measureStats;
  const noteError = (error: unknown) => { measureStats.error ??= (error instanceof Error ? error.message : String(error)).slice(0, 120); return null; };
  const scenePromise = measure
    ? measure(input.images, sceneQuestions()).then(readScene).then(async (scene) => { measureStats.scene = scene; if (deps.onScene) await deps.onScene(scene).catch(() => undefined); return scene; }).catch(noteError)
    : Promise.resolve(null);
  const id = parseCardJson(await deps.gemini(CARD_ID_MODEL, [...cardImageParts(input.images), { text: ID_PROMPT(ctx) }], { temperature: 0.1, thinkingLevel: "minimal" }));
  if (!id) throw new Error("card_identification_invalid_json");
  const isNonOrganism = NON_ORGANISM_CLASSES.has(String(id.record_class));
  const subjects = isNonOrganism ? [] : normalizeCardSubjects(id.subjects, input.images.length);
  const lead = subjects[0];
  const organismLead = !isNonOrganism && lead && id.main_theme !== "environment" ? lead : null;
  const [found, second, measured] = await Promise.all([
    CARD_TILE_SKIP_CLASSES.includes(String(id.record_class)) ? Promise.resolve([] as Json[]) : tileSweep(input, deps, subjects, stats).catch((error: unknown) => {
      stats.tileError = (error instanceof Error ? error.message : String(error)).slice(0, 120);
      return [] as Json[];
    }),
    !measure && organismLead && organismLead.rank === "species"
      ? deps.decide
        ? deps.decide(input.images, decisionQuestion(organismLead)).catch(() => null)
        : deps.gemini(CARD_ID_MODEL, [...cardImageParts(input.images), { text: SECOND_PROMPT(ctx) }], { temperature: 0.1, thinkingLevel: "minimal" }).then(parseCardJson).catch(() => null)
      : Promise.resolve(null),
    measure && subjects.length > 0
      ? (async () => {
        const card = organismLead ? await getLookalike(deps, organismLead, stats).catch(noteError) : null;
        const answers = await measure(input.images, subjectQuestions(subjects, card));
        return { answers, card };
      })().catch(noteError)
      : Promise.resolve(null),
  ]);
  if (measured) {
    subjects.slice(0, 8).forEach((sub, i) => {
      const p = Number(measured.answers[`s${i}`]?.noul);
      if (!Number.isFinite(p)) return;
      measureStats.subjectP[i] = Math.round(p * 100) / 100;
      if (sub === organismLead && sub.rank === "species") stats.secondCheck = applyDecisionCheck(sub, p);
      const band = measuredBand(p);
      sub.confidence_band = sub.view === "far" && band === "high" ? "medium" : band;
      sub.measured_confidence = p;
    });
    if (measured.card) measureStats.lookalike = readLookalike(measured.card, measured.answers);
  } else if (lead) stats.secondCheck = typeof second === "number" ? applyDecisionCheck(lead, second) : applySecondCheck(lead, second);
  await scenePromise;
  if (!isNonOrganism) subjects.push(...found.slice(0, Math.max(0, 8 - subjects.length)));
  stats.subjects = subjects.length;
  const habitatType = str(id.habitat_type);
  const [cards, habitat] = await Promise.all([
    Promise.all(subjects.map((sub, i) => (i < 4 ? getCard(deps, cardKey(str(sub.scientific_name), String(sub.name)), TAXON_PROMPT(str(sub.scientific_name), String(sub.name), str(sub.rank)), stats) : Promise.resolve(null)))),
    !isNonOrganism && CARD_HABITATS.includes(habitatType) ? getCard(deps, cardKey("", `habitat-${habitatType}`), HABITAT_PROMPT(habitatType), stats) : Promise.resolve(null),
  ]);
  return { merged: buildCardMergedObservation(id, subjects, cards, habitat, stats.measure ?? null), stats, subjects, id };
}

export async function callCardDecision(apiKey: string, images: GeminiObservationImage[], question: string, fetcher: typeof fetch = fetch): Promise<number> {
  const body = JSON.stringify({
    model: CARD_DECISION_MODEL,
    input: images.map((image) => ({ type: "image", data: image.base64Data, mime_type: image.mimeType, resolution: "medium" })),
    questions: { q: { type: "noul", instructions: question } },
  });
  let lastError = "card_decision_failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher("https://generativelanguage.googleapis.com/v1beta/decisions", {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body, signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        const p = Number(((await response.json()) as { answers?: { q?: { noul?: unknown } } }).answers?.q?.noul);
        if (!Number.isFinite(p)) throw new Error("card_decision_answer_missing");
        return p;
      }
      lastError = `card_decision_api_failed:${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = (error instanceof Error ? error.message : String(error)).slice(0, 160);
      if (lastError === "card_decision_answer_missing") break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(lastError);
}

export async function callCardGemini(apiKey: string, model: string, parts: Json[], options: { temperature: number; thinkingLevel?: string }, fetcher: typeof fetch = fetch): Promise<string> {
  if (model !== CARD_ID_MODEL && model !== CARD_WRITER_MODEL) throw new Error(`card_model_not_allowed:${model}`);
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: options.temperature, maxOutputTokens: 4096, ...(options.thinkingLevel ? { thinkingConfig: { thinkingLevel: options.thinkingLevel } } : {}) },
  });
  let lastError = "card_gemini_failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body, signal: AbortSignal.timeout(90_000),
      });
      if (response.ok) {
        const value = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
        const text = (value.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
        if (!text.trim()) throw new Error("card_gemini_text_missing");
        return text;
      }
      lastError = `card_gemini_api_failed:${response.status}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = (error instanceof Error ? error.message : String(error)).slice(0, 160);
      if (lastError === "card_gemini_text_missing") break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(`${lastError}:${model}`);
}
