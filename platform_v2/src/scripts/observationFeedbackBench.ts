import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import {
  VISUAL_EXTRACT_INSTRUCTIONS,
  buildVisualInputParts,
  buildVisualSummaryPrompt,
  formatInputMediaSummaryForPrompt,
  guessSeason,
  renderPrompt,
} from "../services/observationReassessPrompts.js";
import type { AiRouterPart } from "../services/aiModelRouter.js";
import { quantile, recommend, scoreItem, spearman, type BenchExpect, type ConfigAggregate } from "./observationFeedbackBenchScore.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../tools/obs-feedback-bench");
const WAI_RELAY = process.env.BENCH_WAI_RELAY ?? "http://127.0.0.1:8830";
const CALL_TIMEOUT_MS = 240_000;
const WORST_INPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 4096;

type Item = {
  id: string;
  category: string;
  images?: string[];
  ctx: { lat: number | null; lng: number | null; observedAt: string; place: string; memo: string };
  expect: BenchExpect;
};
type Config = { id: string; extract: string; summary: string; sweep?: string; extractThinking?: string; mode?: "single" | "slim" | "card"; card?: string; translate?: string; tiles?: number; verify?: string };
type Configs = { prices: Record<string, [number, number]>; baseline: string; judge: string; configs: Config[] };
type CallResult = { text: string; inTok: number; outTok: number; ms: number; costUsd: number; error?: string };
type Row = {
  runId: string; config: string; item: string; category: string; ok: boolean; failure: string | null;
  ms: number; inTok: number; outTok: number; costUsd: number; cardUsd?: number; final: Record<string, unknown> | null; extractText: string;
};

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  out.cmd = a[0] ?? "run";
  for (let i = 1; i < a.length; i++) {
    const k = a[i] ?? "";
    if (!k.startsWith("--")) continue;
    const v = a[i + 1];
    if (v === undefined || v.startsWith("--")) out[k.slice(2)] = "1";
    else { out[k.slice(2)] = v; i++; }
  }
  return out;
}

function parseJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e < s) return null;
  try {
    const v = JSON.parse(t.slice(s, e + 1));
    return Array.isArray(v) ? (v[0] ?? null) : v;
  } catch {
    return null;
  }
}

function price(cfg: Configs, model: string): [number, number] {
  const p = cfg.prices[model];
  if (!p) throw new Error(`price missing for ${model}`);
  return p;
}

const TRANSIENT = /rate limit|3021|8008|Internal server|http_429|http_5dd/i;

async function callModel(cfg: Configs, model: string, parts: AiRouterPart[], opt: { temperature: number; thinking?: string }): Promise<CallResult> {
  let last: CallResult | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await callModelOnce(cfg, model, parts, opt);
    if (!last.error || !TRANSIENT.test(last.error)) return last;
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  return last!;
}

async function callModelOnce(cfg: Configs, model: string, parts: AiRouterPart[], opt: { temperature: number; thinking?: string }): Promise<CallResult> {
  const [provider, name] = [model.slice(0, model.indexOf(":")), model.slice(model.indexOf(":") + 1)];
  const [pin, pout] = price(cfg, model);
  const t = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CALL_TIMEOUT_MS);
  try {
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY unset");
      const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", temperature: opt.temperature, maxOutputTokens: MAX_OUTPUT_TOKENS };
      if (opt.thinking) generationConfig.thinkingConfig = { thinkingLevel: opt.thinking };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
        method: "POST",
        signal: ac.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
      });
      const j = (await r.json()) as any;
      const u = j.usageMetadata ?? {};
      const inTok = u.promptTokenCount ?? 0;
      const outTok = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const text = (j.candidates?.[0]?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
      return { text, inTok, outTok, ms: Date.now() - t, costUsd: (inTok * pin + outTok * pout) / 1e6, error: r.ok ? undefined : `http_${r.status}` };
    }
    if (provider === "wai") {
      const content = parts.map((p: any) => (p.inlineData ? { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } } : { type: "text", text: p.text ?? "" }));
      const input: Record<string, unknown> = { messages: [{ role: "user", content }], response_format: { type: "json_object" }, temperature: opt.temperature, max_tokens: MAX_OUTPUT_TOKENS };
      if (!opt.thinking || opt.thinking === "minimal" || opt.thinking === "off") input.chat_template_kwargs = { enable_thinking: false };
      else input.reasoning_effort = opt.thinking;
      const r = await fetch(WAI_RELAY, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ model: name, input }) });
      const j = (await r.json()) as any;
      if (!j.ok) return { text: "", inTok: 0, outTok: 0, ms: Date.now() - t, costUsd: 0, error: String(j.err ?? "relay").slice(0, 200) };
      const res = j.r ?? {};
      const msg = res.choices?.[0]?.message ?? {};
      const text = typeof msg.content === "string" ? msg.content : typeof res.response === "string" ? res.response : JSON.stringify(res.response ?? "");
      const inTok = res.usage?.prompt_tokens ?? 0;
      const outTok = res.usage?.completion_tokens ?? 0;
      return { text, inTok, outTok, ms: Date.now() - t, costUsd: (inTok * pin + outTok * pout) / 1e6 };
    }
    throw new Error(`unknown provider ${provider}`);
  } catch (e) {
    return { text: "", inTok: 0, outTok: 0, ms: Date.now() - t, costUsd: 0, error: ac.signal.aborted ? "timeout" : String(e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function worstCost(cfg: Configs, c: Config): number {
  const one = (m: string) => {
    const [pin, pout] = price(cfg, m);
    return (WORST_INPUT_TOKENS * pin + MAX_OUTPUT_TOKENS * pout) / 1e6;
  };
  return one(c.extract) + (c.mode === "single" || c.mode === "card" ? 0 : one(c.summary)) + (c.card ? one(c.card) / 2 : 0) + (c.tiles && c.sweep ? (2 * c.tiles * c.tiles * 600 * price(cfg, c.sweep)[0]) / 1e6 : 0) + (c.sweep ? one(c.sweep) : 0);
}

const SINGLE_TAIL = `画像を直接見て、最終的な観察ページ保存用JSONを上記スキーマで1回で作ってください。
AI単独で確定同定せず、根拠・保留点・次に撮るべき写真を明確に分けてください。taxonomic_candidates が拮抗している、diagnostic_features_missing がある、visual_contradictions がある、または confusable_groups が残る場合は recommended_rank を genus/family/order に止めてください。
taxonomic_candidates / rank_decision_reason / diagnostic_features_observed / diagnostic_features_missing / confusable_groups / visual_contradictions を残してください。
主対象の recommended_media_regions と、別に写る対象 coexisting_taxa[].media_regions は asset_index と rect(x,y,width,height 0-1) で残してください。小さく写り込んだ生きものも探してください。
同じ主対象の代替候補は candidate_readings、別個体や背景植生は coexisting_taxa に分離してください。
裸地・礫・舗装・石碑・看板・建物など非生物は coexisting_taxa に入れず、area_inference（vegetation_structure_candidates / succession_stage_candidates / human_influence_candidates / moisture_regime_candidates / management_hint_candidates、各候補は label / confidence / why）と management_action_candidates / narrative の環境文脈へ分離してください。
トップレベルキー recommended_taxon_name / recommended_scientific_name / recommended_rank / confidence_band / recommended_media_regions は必ず含めてください。
保存用JSONは短くしてください。narrative は日本語160字以内、simple_summary は80字以内、diagnostic_features_seen / missing_evidence / distinguishing_tips / confirm_more は各5件以内、candidate_readings / coexisting_taxa は各6件以内。
observer_boost は日本語70字以内で必ず1文。すでに残せている観察上の良さだけを書く。未不足・否定・説教・大げさな賞賛は禁止。
JSONのみ出力。`;

function slimContext(item: Item, photos: ReturnType<typeof loadImages>): string {
  const c = item.ctx;
  return `観察文脈: 場所=${c.place} / 緯度経度=${c.lat == null ? "不明" : `${c.lat.toFixed(2)},${c.lng?.toFixed(2)}`} / 日時=${c.observedAt} / 季節=${guessSeason(c.observedAt)}` + formatInputMediaSummaryForPrompt("photo", photos);
}

const SLIM_TAIL = "\n各値は短い名詞句にし、JSON全体を日本語2500字以内に収めてください。";

const SWEEP_PROMPT = "写っている生きもの（小さく写り込んだもの、葉や枝に隠れたもの、背景のものを含む）をすべて探してください。植物・樹木の群落は1件にまとめてよい。JSONのみ: {\"subjects\":[{\"asset_index\":0,\"label\":\"日本語名\",\"rank\":\"species|genus|family|order|class\",\"confidence\":0.0,\"box_2d\":[ymin,xmin,ymax,xmax]}]} box_2dは0-1000。";

function loadImages(item: Item, dir: string) {
  const files = item.images ?? [`${item.id}.jpg`];
  return files.map((f, i) => ({ mime: "image/jpeg", b64: readFileSync(join(dir, "images", f)).toString("base64"), assetId: `bench-${item.id}-${i}` }));
}

function basePrompt(item: Item, photos: ReturnType<typeof loadImages>): string {
  const c = item.ctx;
  const pkg = [`place=${c.place}`, "observed_subjects=1:未同定 (unknown)", "safe_rank=unknown", "evidence_tier=none", "review=unreviewed", `media_roles=${photos.length > 1 ? "primary,context" : "primary"}`].filter(Boolean).join("\n");
  return renderPrompt({
    occurrenceId: `bench-${item.id}`,
    lat: c.lat == null ? "不明" : c.lat.toFixed(2),
    lng: c.lng == null ? "不明" : c.lng.toFixed(2),
    observedAt: c.observedAt,
    season: guessSeason(c.observedAt),
    existingLabel: "未同定",
    siteBriefLabel: c.place,
    profileDigestSummary: "(なし)",
    observationPackageSummary: pkg,
    knowledgeClaimsContext: "(なし)",
  }) + formatInputMediaSummaryForPrompt("photo", photos);
}

const CARD_DIR = join(ROOT, "cards");
type Json = Record<string, unknown>;
type Card = { key: string; en: Json; ja: Json; costUsd: number };
const cardInflight = new Map<string, Promise<{ card: Card | null; costUsd: number }>>();
const AREA_KEYS = ["vegetation_structure_candidates", "succession_stage_candidates", "human_influence_candidates", "moisture_regime_candidates", "management_hint_candidates"];

const HABITATS = ["落葉広葉樹林", "常緑広葉樹林", "スギ・ヒノキ人工林", "竹林", "草地", "耕作放棄地", "水田", "棚田", "畑", "河川敷", "河川・渓流", "ため池・湖沼", "湿地・ヨシ原", "海岸砂丘", "岩礁海岸", "高山・亜高山帯", "里山", "都市公園", "街路樹・市街地", "社寺林", "庭園", "石垣・護岸など人工構造物", "積雪地"];

const ID_PROMPT = (ctx: string) => `${ctx}

写真の観察記録を読み、JSONのみ返す。値は短く。
{"main_theme":"organism|environment",
"habitat_type":"${HABITATS.join("|")}|その他",
"subjects":[{"name":"和名","scientific_name":"学名","group":"bird|mammal|reptile|amphibian|fish|insect|spider|plant|fungus|other","rank":"species|genus|family|order|class","confidence_band":"low|medium|high","view":"close|mid|far","asset_indexes":[0],"features_seen":["この写真で実際に見えた特徴 最大3"],"missing_evidence":["確定に足りない証拠 最大2"]}],
"area_inference":{${AREA_KEYS.map((k) => `"${k}":[{"label":"","confidence":0.0,"why":""}]`).join(",")}},
"narrative":"160字以内厳守。何がどう写り、どう読めるか。日時・場所は繰り返さず、情緒的な描写はしない",
"simple_summary":"80字以内",
"observer_boost":"70字以内の1文。この記録ですでに良い点。大げさな賞賛は禁止"}
- subjects は写っている生きものを1件ずつ別々に同定する。目立つ順、最大6件。小さな写り込み、枝葉に隠れた鳥や虫、背景の生きもの、主役が止まっている植物も1件ずつ入れる。同じ生きものが複数枚に写るなら asset_indexes にまとめる。
- view は、その生きものが大きくはっきり写るなら close、形は分かるが細部が見えないなら mid、遠景・小さい・不鮮明なら far。
- far のものは種まで言わない。科・属・「〜類」などで止め、confidence_band は low。mid は種の決め手が実際に見えるときだけ species、confidence_band は medium まで。
- 種の確定に必要な形質が見えなければ genus/family/order で止め、confidence_band を下げる。
- 景観・環境・建物・人の営みが主役なら main_theme は environment。裸地・礫・舗装・看板・建物など非生物は subjects に入れず area_inference と narrative に書く。
- area_inference は読み取れるキーを1件ずつ、why に写真で見えた根拠を具体的に書く。読み取れないキーは空配列。`;

const HABITAT_PROMPT = (type: string) => `You write habitat cards for a nature observation app. Region: Japan. Habitat type (Japanese label): ${type}
Return JSON only:
{"habitat":"English name","overview":"one sentence, max 25 words","what_to_look_for":["max 4: indicator plants, animals or structures that tell the condition of this habitat"],"confirm_more":["max 3: what to photograph next to document this habitat well (angle, distance, detail)"],"management_signs":["max 3: visible signs of human management or disturbance to check"],"seasonal_note":"one short sentence"}`;

const CARD_PROMPT = (sci: string, ja: string, rank: string) => `You write field-guide cards for a nature observation app. Region: Japan.
Taxon: ${sci || "(no scientific name)"} / Japanese name from the identifier: ${ja} / rank: ${rank}
Return JSON only:
{"scientific_name":"","english_name":"","rank":"","overview":"one sentence, max 25 words","distinguishing_tips":["max 4 short concrete visual field marks"],"confusable_groups":[{"english_name":"","scientific_name":"","distinction_point":"how to tell apart, one short sentence"}],"confirm_more":["max 3: which body part, angle or scene to photograph next to confirm"],"season_habitat":"one short sentence"}
confusable_groups: max 3 taxa most often confused with it in Japan. If the taxon is not a real taxon, return {"invalid":true}.`;

const CARD_TRANSLATE = (en: string) => `Translate this field-guide card JSON into natural Japanese for general nature observers. Keep the keys and structure. In confusable_groups add "japanese_name" with the standard 和名 (katakana); if none is established, repeat the scientific name. Do not add or remove facts. JSON only.
${en}`;

function cardKey(sci: string, ja: string): string {
  return (sci || ja).toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
}

async function getCard(cfg: Configs, c: Config, key: string, prompt: string): Promise<{ card: Card | null; costUsd: number }> {
  if (!key || !c.card || !c.translate) return { card: null, costUsd: 0 };
  const path = join(CARD_DIR, `${key}.json`);
  if (existsSync(path)) return { card: JSON.parse(readFileSync(path, "utf8")) as Card, costUsd: 0 };
  const running = cardInflight.get(key);
  if (running) return { card: (await running).card, costUsd: 0 };
  const p = (async () => {
    const w = await callModel(cfg, c.card!, [{ text: prompt }], { temperature: 0.2, thinking: "low" });
    const en = w.error ? null : parseJson(w.text);
    if (!en || en.invalid) return { card: null, costUsd: w.costUsd };
    const t = await callModel(cfg, c.translate!, [{ text: CARD_TRANSLATE(JSON.stringify(en)) }], { temperature: 0.1 });
    const jaCard = t.error ? null : parseJson(t.text);
    const costUsd = w.costUsd + t.costUsd;
    if (!jaCard) return { card: null, costUsd };
    const card: Card = { key, en, ja: jaCard, costUsd };
    mkdirSync(CARD_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify(card, null, 1));
    return { card, costUsd };
  })();
  cardInflight.set(key, p);
  return p;
}

function taxonCard(cfg: Configs, c: Config, sub: Json) {
  const sci = String(sub.scientific_name ?? ""), ja = String(sub.name);
  return getCard(cfg, c, cardKey(sci, ja), CARD_PROMPT(sci, ja, String(sub.rank ?? "")));
}

function habitatCard(cfg: Configs, c: Config, type: string) {
  return HABITATS.includes(type) ? getCard(cfg, c, cardKey("", `habitat-${type}`), HABITAT_PROMPT(type)) : Promise.resolve({ card: null, costUsd: 0 });
}

const TILE_PROMPT = `これは写真の一部を拡大したものです。動物（鳥・哺乳類・爬虫類・両生類・魚・昆虫・クモなど）が確かに見えるかを答える。枝や葉の間も丁寧に見る。推測で足さない。植物は不要。いなければ空配列。
JSONのみ: {"animals":[{"name":"和名（分かる階級まで。例: 小鳥）","group":"bird|mammal|reptile|amphibian|fish|insect|spider|other","confidence_band":"low|medium|high","where":"どこにどう見えるか"}]}`;
const ZOOM_PROMPT = (known: string) => `日本国内の野外写真です。すでに同定済みの生きもの: ${known || "なし"}。拡大に写るのがそれと同じ個体・同じ種類なら {"none":true} だけを返す。1枚目は広い範囲、2枚目はその中央付近の拡大。拡大に動物が確かに写っているかを自分の目で確かめる。広い範囲の文脈から、丸太・畦・岩・影・枯れ葉・ゴミなどの見間違いでないかも確かめる。写っていない、または動物と言い切れなければ {"none":true} だけを返す。写っていれば同定し、種の確定に必要な形質が見えなければ genus/family/order で止める。
JSONのみ: {"name":"和名","scientific_name":"学名","rank":"species|genus|family|order|class","confidence_band":"low|medium|high","features_seen":["実際に見えた特徴 最大3"],"missing_evidence":["確定に足りない証拠 最大2"]}`;
const BAND_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };
let tileSlots = 12;
const tileWaiters: Array<() => void> = [];
async function tileSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (tileSlots > 0) tileSlots--;
  else await new Promise<void>((r) => tileWaiters.push(r));
  try { return await fn(); } finally { const next = tileWaiters.shift(); if (next) next(); else tileSlots++; }
}

const groupKey = (g: unknown) => (g === "insect" || g === "spider" ? "arthropod" : String(g ?? ""));
type TileHit = { group: string; name: string; band: string; where: string; b64: string; left: number; top: number };
type TileScan = { photos: Array<{ W: number; H: number; tw: number; th: number; hits: TileHit[] }>; calls: CallResult[]; ms: number };
const tileScans = new Map<string, Promise<TileScan>>();

function scanTiles(cfg: Configs, c: Config, photos: ReturnType<typeof loadImages>, itemId: string): { scan: Promise<TileScan>; cached: boolean } {
  const n = c.tiles ?? 0;
  const key = `${itemId}|${c.sweep}|${n}`;
  const hit = tileScans.get(key);
  if (hit) return { scan: hit, cached: true };
  const scan = (async () => {
    const t = Date.now();
    const calls: CallResult[] = [];
    const out = await Promise.all(photos.map(async (photo) => {
      const buf = Buffer.from(photo.b64, "base64");
      const meta = await sharp(buf).metadata();
      const W = meta.width ?? 0, H = meta.height ?? 0;
      const tw = Math.round((W / n) * 1.2), th = Math.round((H / n) * 1.2);
      const hits: TileHit[] = [];
      if (W && H) await Promise.all(Array.from({ length: n * n }, (_, k) => tileSlot(async () => {
        const x = k % n, y = Math.floor(k / n);
        const left = Math.min(W - tw, Math.max(0, Math.round((W / n) * x - (tw - W / n) / 2)));
        const top = Math.min(H - th, Math.max(0, Math.round((H / n) * y - (th - H / n) / 2)));
        const b64 = (await sharp(buf).extract({ left, top, width: tw, height: th }).jpeg({ quality: 85 }).toBuffer()).toString("base64");
        const r = await callModel(cfg, c.sweep!, [{ inlineData: { mimeType: "image/jpeg", data: b64 } }, { text: TILE_PROMPT }], { temperature: 0.2 });
        calls.push(r);
        const animals = (r.error ? null : parseJson(r.text))?.animals;
        for (const a of Array.isArray(animals) ? (animals as Json[]) : []) if (a?.name && a.confidence_band !== "low") hits.push({ group: String(a.group ?? "other"), name: String(a.name), band: String(a.confidence_band ?? "medium"), where: String(a.where ?? ""), b64, left, top });
      })));
      return { W, H, tw, th, hits };
    }));
    return { photos: out, calls, ms: Date.now() - t };
  })();
  tileScans.set(key, scan);
  return { scan, cached: false };
}

async function tileSweep(cfg: Configs, c: Config, photos: ReturnType<typeof loadImages>, subjects: Json[], itemId: string): Promise<{ added: Json[]; calls: CallResult[]; cachedMs: number }> {
  const added: Json[] = [];
  if (!c.tiles || !c.sweep) return { added, calls: [], cachedMs: 0 };
  const { scan: pending, cached } = scanTiles(cfg, c, photos, itemId);
  const scan = await pending;
  const calls = [...scan.calls];
  const verifier = c.verify ?? c.extract;
  await Promise.all(scan.photos.map(async ({ W, H, tw, th, hits }, assetIndex) => {
    const best = new Map<string, TileHit>();
    for (const h of hits) if ((BAND_RANK[h.band] ?? 0) > (BAND_RANK[best.get(h.group)?.band ?? ""] ?? -1)) best.set(h.group, h);
    const buf = Buffer.from(photos[assetIndex]!.b64, "base64");
    for (const h of [...best.values()].slice(0, 2)) {
      if (subjects.some((sub) => groupKey(sub.group) === groupKey(h.group))) continue;
      const cw = Math.min(W, Math.round(tw * 2.5)), ch = Math.min(H, Math.round(th * 2.5));
      const wide = (await sharp(buf).extract({ left: Math.min(W - cw, Math.max(0, Math.round(h.left + tw / 2 - cw / 2))), top: Math.min(H - ch, Math.max(0, Math.round(h.top + th / 2 - ch / 2))), width: cw, height: ch }).jpeg({ quality: 85 }).toBuffer()).toString("base64");
      const z = await callModel(cfg, verifier, [{ inlineData: { mimeType: "image/jpeg", data: wide } }, { inlineData: { mimeType: "image/jpeg", data: h.b64 } }, { text: ZOOM_PROMPT(subjects.map((x) => String(x.name)).join("、")) }], { temperature: 0.1, thinking: verifier.startsWith("gemini:") ? "minimal" : undefined });
      calls.push(z);
      const zj = z.error ? null : parseJson(z.text);
      if (!zj || zj.none || !zj.name) continue;
      const genus = String(zj.scientific_name ?? "").split(" ")[0]?.toLowerCase();
      if (subjects.some((sub) => String(sub.name) === String(zj.name) || (genus && String(sub.scientific_name ?? "").toLowerCase().startsWith(genus)))) continue;
      added.push({ name: String(zj.name), scientific_name: String(zj.scientific_name ?? ""), group: h.group, rank: String(zj.rank ?? "class"), confidence_band: zj.confidence_band === "high" ? "medium" : String(zj.confidence_band ?? "low"), asset_indexes: [assetIndex], features_seen: Array.isArray(zj.features_seen) && zj.features_seen.length ? zj.features_seen : [h.where], missing_evidence: zj.missing_evidence ?? [], found_by: "tile" });
    }
  }));
  return { added, calls, cachedMs: cached ? scan.ms : 0 };
}

async function runCard(cfg: Configs, c: Config, item: Item, dir: string, runId: string): Promise<Row> {
  const photos = loadImages(item, dir);
  const idCall = await callModel(cfg, c.extract, [...buildVisualInputParts(photos), { text: ID_PROMPT(slimContext(item, photos)) }], { temperature: 0.1, thinking: c.extractThinking ?? (c.extract.startsWith("gemini:") ? "minimal" : undefined) });
  const parsed = idCall.error ? null : parseJson(idCall.text);
  const id = parsed;
  const t0 = Date.now();
  let sweepCalls: CallResult[] = [];
  let sweepCachedMs = 0;
  const failure = idCall.error ?? (id ? null : idCall.text.trim() ? "format" : "empty");
  let final: Json | null = null;
  let cardUsd = 0;
  if (id) {
    const subjects = (Array.isArray(id.subjects) ? (id.subjects as Json[]) : []).filter((s) => s && typeof s === "object" && s.name).slice(0, 6);
    for (const sub of subjects) { if (sub.view === "far") sub.confidence_band = "low"; else if (sub.view === "mid" && sub.confidence_band === "high") sub.confidence_band = "medium"; }
    const sweep = await tileSweep(cfg, c, photos, subjects, item.id);
    sweepCachedMs = sweep.cachedMs;
    sweepCalls = sweep.calls;
    subjects.push(...sweep.added);
    const cards = await Promise.all(subjects.map((s, i) => (i < 4 ? taxonCard(cfg, c, s) : Promise.resolve({ card: null, costUsd: 0 }))));
    const hab = await habitatCard(cfg, c, String(id.habitat_type ?? ""));
    const hj = hab.card?.ja ?? {};
    cardUsd = cards.reduce((n, x) => n + x.costUsd, 0) + hab.costUsd;
    const idents = subjects.map((s, i) => {
      const j = cards[i]?.card?.ja ?? {};
      return { ...s, media_regions: (Array.isArray(s.asset_indexes) ? s.asset_indexes : [0]).map((n) => ({ asset_index: Number(n) })), overview: j.overview, distinguishing_tips: j.distinguishing_tips, confusable_groups: j.confusable_groups, confirm_more: j.confirm_more, season_habitat: j.season_habitat } as Json;
    });
    const main = id.main_theme === "environment" ? null : (idents[0] ?? null);
    final = {
      recommended_taxon_name: main ? main.name : "環境・景観", recommended_scientific_name: main ? main.scientific_name : "", recommended_rank: main ? main.rank : "lifeform", confidence_band: main ? main.confidence_band : "low",
      recommended_media_regions: main ? main.media_regions : [],
      narrative: id.narrative, simple_summary: id.simple_summary, observer_boost: id.observer_boost, area_inference: id.area_inference,
      identifications: idents, coexisting_taxa: main ? idents.slice(1) : idents,
      diagnostic_features_seen: main?.features_seen, missing_evidence: main?.missing_evidence, distinguishing_tips: main ? main.distinguishing_tips : hj.what_to_look_for, confusable_groups: main?.confusable_groups, confirm_more: main ? main.confirm_more : hj.confirm_more, habitat: hab.card ? { type: id.habitat_type, ...hj } : undefined,
    };
  }
  return { runId, config: c.id, item: item.id, category: item.category, ok: !failure, failure, ms: idCall.ms + (Date.now() - t0) + sweepCachedMs, inTok: idCall.inTok + sweepCalls.reduce((n, x) => n + x.inTok, 0), outTok: idCall.outTok + sweepCalls.reduce((n, x) => n + x.outTok, 0), costUsd: idCall.costUsd + sweepCalls.reduce((n, x) => n + x.costUsd, 0), cardUsd, final, extractText: idCall.text.slice(0, 6000) };
}

async function runOne(cfg: Configs, c: Config, item: Item, dir: string, runId: string): Promise<Row> {
  if (c.mode === "card") return runCard(cfg, c, item, dir, runId);
  const photos = loadImages(item, dir);
  const prompt = basePrompt(item, photos);
  const calls: CallResult[] = [];
  const extractText0 = c.mode === "single" ? `${prompt}\n\n${SINGLE_TAIL}` : c.mode === "slim" ? `${slimContext(item, photos)}\n\n${VISUAL_EXTRACT_INSTRUCTIONS}${SLIM_TAIL}` : `${prompt}\n\n${VISUAL_EXTRACT_INSTRUCTIONS}`;
  const extractParts = [...buildVisualInputParts(photos), { text: extractText0 }];
  const extract = await callModel(cfg, c.extract, extractParts, { temperature: 0.1, thinking: c.extractThinking ?? (c.extract.startsWith("gemini:") ? "minimal" : undefined) });
  calls.push(extract);
  let extractText = extract.text;
  if (c.sweep && !extract.error) {
    const sweep = await callModel(cfg, c.sweep, [...buildVisualInputParts(photos), { text: SWEEP_PROMPT }], { temperature: 0.1 });
    calls.push(sweep);
    if (sweep.text) extractText = `${extract.text}\n\n補助の生きもの洗い出しJSON（別モデル。主対象以外の写り込みは coexisting_taxa に入れ、asset_index と box_2d/1000 を rect に換算して media_regions に残す）:\n${sweep.text.slice(0, 4000)}`;
  }
  let final: Record<string, unknown> | null = null;
  let failure: string | null = extract.error ?? (extract.text.trim() ? null : "empty_extract");
  if (!failure && c.mode === "single") {
    final = parseJson(extract.text);
    if (!final) failure = "format";
  } else if (!failure) {
    const summary = await callModel(cfg, c.summary, [{ text: buildVisualSummaryPrompt(prompt, extractText, null) }], { temperature: 0.15 });
    calls.push(summary);
    if (summary.error) failure = summary.error;
    else if (!summary.text.trim()) failure = "empty";
    else {
      final = parseJson(summary.text);
      if (!final) failure = "format";
    }
  }
  const sum = (k: "ms" | "inTok" | "outTok" | "costUsd") => calls.reduce((s, x) => s + x[k], 0);
  return { runId, config: c.id, item: item.id, category: item.category, ok: !failure, failure, ms: sum("ms"), inTok: sum("inTok"), outTok: sum("outTok"), costUsd: sum("costUsd"), final, extractText: extractText.slice(0, 6000) };
}

async function pool<T>(tasks: Array<() => Promise<T>>, n: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) {
      const k = i++;
      out[k] = await tasks[k]!();
    }
  }));
  return out;
}

function loadSpec(version: string) {
  const dir = join(ROOT, version);
  const spec = JSON.parse(readFileSync(join(dir, "spec.json"), "utf8")) as { version: string; items: Item[] };
  const present = new Set(readdirSync(join(dir, "images")));
  const items = spec.items.filter((it) => (it.images ?? [`${it.id}.jpg`]).every((f) => present.has(f)));
  return { dir, spec, items };
}

async function cmdRun(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { dir, items } = loadSpec(version);
  const only = a.configs ? new Set(a.configs.split(",")) : null;
  const configs = cfg.configs.filter((c) => !only || only.has(c.id));
  const limit = a.items ? items.filter((it) => (a.items ?? "").split(",").includes(it.id)) : items;
  const maxUsd = Number(a["max-usd"] ?? "5");
  const runId = a.run ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(ROOT, "results", version, runId);
  mkdirSync(outDir, { recursive: true });
  const rawPath = join(outDir, "raw.jsonl");
  const done = new Set(existsSync(rawPath) ? readFileSync(rawPath, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return r.failure && TRANSIENT.test(r.failure) ? "" : `${r.config}|${r.item}`; }) : []);
  let spent = existsSync(rawPath) ? readFileSync(rawPath, "utf8").split("\n").filter(Boolean).reduce((s, l) => s + JSON.parse(l).costUsd, 0) : 0;
  let reserved = 0;
  let stopped = false;
  const tasks = configs.flatMap((c) => limit.filter((it) => !done.has(`${c.id}|${it.id}`)).map((it) => async () => {
    const w = worstCost(cfg, c);
    if (stopped || spent + reserved + w > maxUsd) { stopped = true; return null; }
    reserved += w;
    let row: Row;
    try {
      row = await runOne(cfg, c, it, dir, runId);
    } catch (e) {
      reserved -= w;
      process.stdout.write(`HARNESS_ERROR ${c.id} ${it.id} ${String(e).slice(0, 160)}
`);
      return null;
    }
    reserved -= w;
    spent += row.costUsd + (row.cardUsd ?? 0);
    appendFileSync(rawPath, JSON.stringify(row) + "\n");
    process.stdout.write(`${c.id} ${it.id} ${row.ok ? "ok" : row.failure} ${row.ms}ms $${row.costUsd.toFixed(4)} total=$${spent.toFixed(3)}\n`);
    return row;
  }));
  await pool(tasks, Number(a.concurrency ?? "6"));
  writeFileSync(join(outDir, "meta.json"), JSON.stringify({ runId, version, configs: configs.map((c) => c.id), items: limit.length, maxUsd, spentUsd: spent, stoppedByCap: stopped }, null, 1));
  console.log(stopped ? `STOPPED_BY_COST_CAP spent=$${spent.toFixed(3)} cap=$${maxUsd}` : `DONE spent=$${spent.toFixed(3)}`);
}

function readRows(outDir: string): Row[] {
  const all: Row[] = readFileSync(join(outDir, "raw.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return [...new Map(all.map((r) => [`${r.config}|${r.item}`, r])).values()];
}

const JUDGE_PROMPT = (a: string, b: string) => `あなたは自然観察アプリの品質審査員です。写真と観察条件に対する2つのAIフィードバック(A,B)を比べてください。
基準: 1) 誤同定がない 2) 確信度が証拠に見合う(過信しない) 3) 生きもの以外が主役の写真で無理に生きもの話にしない。景観・環境・人の営みを具体的に読む 4) 写り込んだ別の生きものを拾えている 5) 観察者に役立つ具体性。文章量の多さは評価しない。
JSONのみ: {"winner":"A|B|tie","misid":{"A":false,"B":false},"overconfident":{"A":false,"B":false},"forced_organism":{"A":false,"B":false},"reason":"40字以内"}
A: ${a}
B: ${b}`;

const BRIEF_FULL = process.argv.includes("--brief-full");

function brief(o: Record<string, unknown> | null): string {
  if (!o) return "(出力なし)";
  const pick = ["recommended_taxon_name", "recommended_rank", "confidence_band", "narrative", "simple_summary", "observer_boost", "area_inference", "coexisting_taxa", ...(BRIEF_FULL ? ["diagnostic_features_seen", "missing_evidence", "distinguishing_tips", "confusable_groups", "confirm_more"] : [])];
  return JSON.stringify(Object.fromEntries(pick.map((k) => [k, o[k]]))).slice(0, BRIEF_FULL ? 7000 : 3000);
}

async function cmdJudge(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { dir, items } = loadSpec(version);
  const outDir = join(ROOT, "results", version, a.run ?? "");
  const rows = readRows(outDir);
  const path = join(outDir, "judge.jsonl");
  const done = new Set(existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.config}|${r.item}|${r.order}`; }) : []);
  const maxUsd = Number(a["max-usd"] ?? "2");
  let spent = 0;
  const byKey = new Map(rows.map((r) => [`${r.config}|${r.item}`, r]));
  const tasks: Array<() => Promise<void>> = [];
  const judgeOnly = a.configs ? new Set(a.configs.split(",")) : null;
  for (const c of cfg.configs) {
    if (c.id === cfg.baseline || (judgeOnly && !judgeOnly.has(c.id))) continue;
    for (const it of items) {
      const cand = byKey.get(`${c.id}|${it.id}`);
      const base = byKey.get(`${cfg.baseline}|${it.id}`);
      if (!cand || !base) continue;
      for (const order of ["cb", "bc"] as const) {
        if (done.has(`${c.id}|${it.id}|${order}`)) continue;
        tasks.push(async () => {
          if (spent > maxUsd) return;
          const [A, B] = order === "cb" ? [cand.final, base.final] : [base.final, cand.final];
          const photos = loadImages(it, dir);
          const ctx = `観察条件: ${it.ctx.place} ${it.ctx.observedAt} メモ:${it.ctx.memo || "なし"}`;
          const r = await callModel(cfg, cfg.judge, [...buildVisualInputParts(photos), { text: `${ctx}\n${JUDGE_PROMPT(brief(A), brief(B))}` }], { temperature: 0, thinking: "low" });
          spent += r.costUsd;
          const j = parseJson(r.text) ?? {};
          const w = String(j.winner ?? "tie");
          const candWins = (order === "cb" && w === "A") || (order === "bc" && w === "B");
          const baseWins = (order === "cb" && w === "B") || (order === "bc" && w === "A");
          appendFileSync(path, JSON.stringify({ config: c.id, item: it.id, order, result: candWins ? "win" : baseWins ? "loss" : "tie", raw: j, costUsd: r.costUsd }) + "\n");
        });
      }
    }
  }
  await pool(tasks, Number(a.concurrency ?? "6"));
  console.log(`JUDGED spent=$${spent.toFixed(3)}`);
}

function aggregate(rows: Row[], items: Item[], judge: Array<{ config: string; item: string; order: string; result: string }>): ConfigAggregate[] {
  const exp = new Map(items.map((i) => [i.id, i]));
  const ids = [...new Set(rows.map((r) => r.config))];
  return ids.map((id) => {
    const rs = rows.filter((r) => r.config === id && exp.has(r.item));
    const scores = rs.map((r) => ({ cat: r.category, s: scoreItem(r.final, exp.get(r.item)!.expect).score }));
    const cats: Record<string, number[]> = {};
    for (const x of scores) (cats[x.cat] ??= []).push(x.s);
    const js = judge.filter((j) => j.config === id);
    const pairs = new Map<string, string[]>();
    for (const j of js) pairs.set(j.item, [...(pairs.get(j.item) ?? []), j.result]);
    let win = 0;
    let n = 0;
    for (const res of pairs.values()) {
      if (res.length < 2) continue;
      n++;
      win += res[0] === res[1] ? (res[0] === "win" ? 1 : res[0] === "loss" ? 0 : 0.5) : 0.5;
    }
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      id, n: rs.length,
      quality: Math.round(mean(scores.map((x) => x.s)) * 10) / 10,
      p50ms: quantile(rs.map((r) => r.ms), 0.5),
      p95ms: quantile(rs.map((r) => r.ms), 0.95),
      costPer1000Usd: Math.round(mean(rs.map((r) => r.costUsd)) * 1000 * 100) / 100,
      failureRate: rs.length ? rs.filter((r) => !r.ok).length / rs.length : 1,
      winRateVsBaseline: n ? Math.round((win / n) * 100) / 100 : null,
      byCategory: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round(mean(v))])),
    };
  });
}

function cmdReport(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { items } = loadSpec(version);
  const resDir = join(ROOT, "results", version);
  const outDir = join(resDir, a.run ?? "");
  const judgePath = join(outDir, "judge.jsonl");
  const judge = existsSync(judgePath) ? readFileSync(judgePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const rows = aggregate(readRows(outDir), items, judge).sort((x, y) => y.quality - x.quality);
  const cats = [...new Set(items.map((i) => i.category))];
  const lines = [
    `# ${version} ${a.run}`,
    "",
    `| config | 品質 | 一対比較勝率(対${cfg.baseline}) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | ${cats.join(" | ")} |`,
    `|---|---|---|---|---|---|---|${cats.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.id} | ${r.quality} | ${r.winRateVsBaseline ?? "-"} | ${r.p50ms} | ${r.p95ms} | ${r.costPer1000Usd} | ${(r.failureRate * 100).toFixed(0)}% | ${cats.map((c) => r.byCategory[c] ?? "-").join(" | ")} |`),
    "",
    `推奨: ${recommend(rows, cfg.baseline)}`,
  ];
  if (a.compare) {
    const other = aggregate(readRows(join(resDir, a.compare)), items, []).sort((x, y) => y.quality - x.quality);
    const rho = spearman(rows.map((r) => r.id), other.map((r) => r.id));
    const diffs = rows.map((r) => `${r.id}:${(r.quality - (other.find((o) => o.id === r.id)?.quality ?? NaN)).toFixed(1)}`);
    lines.push("", `再実行(${a.compare})との順位相関: ${rho.toFixed(2)} / 品質差: ${diffs.join(" ")}`);
  }
  const exp = new Map(items.map((i) => [i.id, i]));
  const flagged = readRows(outDir).map((r) => ({ r, s: scoreItem(r.final, exp.get(r.item)?.expect ?? {}) })).filter((x) => x.s.flags.length);
  const flagCount: Record<string, Record<string, number>> = {};
  for (const x of flagged) for (const f of x.s.flags) { const k = f.split(":")[0] ?? f; const m = (flagCount[x.r.config] ??= {}); m[k] = (m[k] ?? 0) + 1; }
  const cardRows = readRows(outDir).filter((r) => r.cardUsd != null);
  if (cardRows.length) lines.push("", `カード: ${existsSync(CARD_DIR) ? readdirSync(CARD_DIR).length : 0}枚 / この実行で新規作成 $${cardRows.reduce((n, r) => n + (r.cardUsd ?? 0), 0).toFixed(3)}（1000件あたりUSDには含めない）`);
  lines.push("", "減点の内訳:", ...Object.entries(flagCount).map(([c, m]) => `- ${c}: ${Object.entries(m).map(([k, v]) => `${k}=${v}`).join(" ")}`));
  const md = lines.join("\n");
  writeFileSync(join(outDir, "report.md"), md);
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(rows, null, 1));
  console.log(md);
}

const a = args();
if (a.cmd === "run") await cmdRun(a);
else if (a.cmd === "judge") await cmdJudge(a);
else if (a.cmd === "report") cmdReport(a);
else if (a.cmd === "all") {
  a.run ??= new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await cmdRun(a);
  await cmdJudge({ ...a, "max-usd": a["judge-max-usd"] ?? "8" });
  cmdReport(a);
}
else throw new Error("usage: all|run|judge|report");
