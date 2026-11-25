export const PLACE_VOCAB_VERSION = "place-state/1";
export const FEATURE_VOCAB_VERSION = "feature-kind/1";
export const FEATURE_SLOT = "feature_kind";
export const ORGANISM_SLOT = "organism";

export const PLACE_SLOTS = ["place_type", "contact_surface", "surrounding_cover", "environment_condition", "human_change"] as const;
export type PlaceSlot = (typeof PLACE_SLOTS)[number];

export const PLACE_TERMS: Record<PlaceSlot, ReadonlyArray<readonly [string, string]>> = {
  place_type: [
    ["urban", "まちなか"], ["grassland_urban_edge", "まちの縁の草地"], ["woodland", "林・森"], ["water_edge", "水辺"],
    ["wetland", "湿地"], ["coast", "海岸"], ["farmland", "田畑"], ["indoors", "屋内"], ["unknown", "分からない"],
  ],
  contact_surface: [
    ["soil", "土"], ["soil_gravel_litter", "土・砂利・落ち葉が混じる面"], ["sand", "砂"], ["gravel", "砂利"], ["leaf_litter", "落ち葉"],
    ["rock", "岩・石"], ["plant", "植物"], ["water", "水"], ["artificial", "人工の面"], ["unknown", "分からない"],
  ],
  surrounding_cover: [
    ["low_grass", "低い草"], ["trees_shrubs", "木・低木"], ["bare_ground", "土が出た地面"], ["water", "水面"], ["snow", "雪"],
    ["built_surface", "建物・舗装"], ["mixed_cover", "複数が同じくらい"], ["unknown", "分からない"],
  ],
  environment_condition: [
    ["sunny", "日が当たっている"], ["shaded", "日陰"], ["wet", "濡れている"], ["flowing", "水が流れている"],
    ["open_dry", "開けて乾いて見える"], ["windy", "風で揺れている"], ["unknown", "分からない"],
  ],
  human_change: [
    ["mowing", "草刈りの跡"], ["trampling", "踏み跡"], ["trampling_mowing", "踏み跡と草刈りの跡"], ["planting", "植えた跡"],
    ["construction", "工事の跡"], ["litter_visible", "捨てられた物が見える"], ["none_visible", "写っている範囲では見当たらない"],
    ["unknown", "分からない"],
  ],
};

export const FEATURE_TERMS = [
  ["building", "建物"], ["bridge", "橋"], ["revetment", "護岸"], ["signboard", "案内板"], ["pavement", "舗装"], ["fence", "柵"],
  ["artifact", "道具・人工物"], ["grass_patch", "草むら"], ["tree_canopy", "木の茂み"], ["rock", "岩"], ["water_surface", "水面"],
  ["unknown_feature", "種類が分からないもの"],
] as const;
export type FeatureKind = (typeof FEATURE_TERMS)[number][0];

const featureLabels = new Map<string, string>(FEATURE_TERMS);

export const isPlaceSlot = (value: unknown): value is PlaceSlot => typeof value === "string" && (PLACE_SLOTS as readonly string[]).includes(value);
export const isPlaceCode = (slot: PlaceSlot, code: unknown): boolean => typeof code === "string" && PLACE_TERMS[slot].some(([known]) => known === code);
export const isFeatureKind = (value: unknown): value is FeatureKind => typeof value === "string" && featureLabels.has(value);
export const placeLabelJa = (slot: PlaceSlot, code: string): string | null => PLACE_TERMS[slot].find(([known]) => known === code)?.[1] ?? null;
export const featureLabelJa = (kind: string): string | null => featureLabels.get(kind) ?? null;

export function normalizePlaceValue(slot: PlaceSlot, raw: unknown): { code: string; sourceValue: string | null } {
  if (isPlaceCode(slot, raw)) return { code: raw as string, sourceValue: null };
  const sourceValue = typeof raw === "string" ? raw.replace(/[^a-z0-9_]/giu, "").slice(0, 40) || null : null;
  return { code: "unknown", sourceValue };
}

const SENSITIVE_LABEL = /人物|人影|通行人|歩行者|作業員|顔|ナンバー|車両番号|プレート|書類|文書|氏名|^人$|person|people|pedestrian|\bface\b|licen[sc]e|plate|document|passport/iu;
const FEATURE_PATTERNS: ReadonlyArray<readonly [FeatureKind, RegExp]> = [
  ["revetment", /護岸|堤防|土手|revetment|levee|embankment/iu],
  ["bridge", /橋|bridge/iu],
  ["signboard", /看板|案内板|標識|表札|\bsign/iu],
  ["building", /建物|建築|ビル|住宅|家屋|屋根|building|house/iu],
  ["pavement", /舗装|道路|アスファルト|歩道|路面|pavement|asphalt|\broad\b/iu],
  ["fence", /柵|フェンス|塀|壁|fence|\bwall\b/iu],
  ["grass_patch", /草むら|草地|草原|芝|雑草|grass/iu],
  ["tree_canopy", /樹木|木立|茂み|樹冠|低木|林|\btrees?\b|canopy|shrub/iu],
  ["rock", /岩|石|\brock|stone/iu],
  ["water_surface", /水面|池|川|水路|湖|海|\bwater/iu],
  ["artifact", /道具|人工物|ごみ|ゴミ|容器|ベンチ|電柱|遊具|網|ネット|artifact|litter|bench/iu],
];

export function featureKindFromLabel(label: string, unknownFallback: boolean): FeatureKind | null {
  const text = label.normalize("NFKC");
  if (SENSITIVE_LABEL.test(text)) return null;
  for (const [kind, pattern] of FEATURE_PATTERNS) if (pattern.test(text)) return kind;
  return unknownFallback ? "unknown_feature" : null;
}

export type ReadingTimeRange = { startMs: number; endMs: number };
export type ReadingMediaMeta = { durationMs?: number | null };
export type ReadingFeatureInput = { kind: string; assetIndex?: number; timeRange?: ReadingTimeRange };
export type ReadingPlaceInput = {
  assetIndex?: number;
  timeRange?: ReadingTimeRange;
  fields: Partial<Record<PlaceSlot, unknown>>;
  assessmentState: "informative" | "not_informative" | "not_assessable";
  scope: "photo" | "photo_set";
};
export type ReadingSqlMutation = { sql: string; values: Array<string | number | null> };

const textBytes = (value: string): ArrayBuffer => new TextEncoder().encode(value).buffer as ArrayBuffer;

export const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textBytes(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const deterministicUuid = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(value)));
  const bytes = digest.slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export function resolveMediaIndex(index: number | null | undefined, mediaIds: readonly string[]): string | null {
  if (index === undefined || index === null) return mediaIds.length === 1 ? mediaIds[0]! : null;
  return Number.isInteger(index) && index >= 0 && index < mediaIds.length ? mediaIds[index]! : null;
}

export function validTimeRange(range: ReadingTimeRange | undefined, durationMs: number | null | undefined): ReadingTimeRange | null {
  if (!range) return null;
  const { startMs, endMs } = range;
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) return null;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && endMs > durationMs) return null;
  return { startMs, endMs };
}

type Anchor = { assetId: string | null; key: string; locatorJson: string };

function anchorFor(input: { mediaIds: readonly string[]; mediaMeta?: readonly ReadingMediaMeta[] }, assetIndex: number | undefined, timeRange: ReadingTimeRange | undefined): Anchor {
  const assetId = resolveMediaIndex(assetIndex, input.mediaIds);
  if (!assetId) return { assetId: null, key: "record", locatorJson: "{}" };
  const position = input.mediaIds.indexOf(assetId);
  const range = validTimeRange(timeRange, input.mediaMeta?.[position]?.durationMs);
  if (range) return { assetId, key: `t:${range.startMs}-${range.endMs}`, locatorJson: JSON.stringify(range) };
  return { assetId, key: "full", locatorJson: "{}" };
}

export const MEDIA_ORDER_MAX_POSITION = 255;
const MEDIA_ORDER_SQL = `INSERT OR IGNORE INTO record_media_order (record_runtime, record_id, asset_id, position)
SELECT 'cloudflare_d1', ?, ?,
  CASE WHEN ? IS NOT NULL AND NOT EXISTS (SELECT 1 FROM record_media_order WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND position = ?)
    THEN ? ELSE (SELECT COALESCE(MAX(position), -1) + 1 FROM record_media_order WHERE record_runtime = 'cloudflare_d1' AND record_id = ?) END`;

export function mediaOrderMutation(recordId: string, assetId: string, requestedPosition: unknown): ReadingSqlMutation {
  const position = typeof requestedPosition === "number" && Number.isInteger(requestedPosition) && requestedPosition >= 0 && requestedPosition <= MEDIA_ORDER_MAX_POSITION ? requestedPosition : null;
  return { sql: MEDIA_ORDER_SQL, values: [recordId, assetId, position, recordId, position, position, recordId] };
}

type OrderDb = { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };

export async function writeRecordMediaOrder(db: OrderDb, recordId: string, assetId: string, requestedPosition?: unknown): Promise<boolean> {
  const mutation = mediaOrderMutation(recordId, assetId, requestedPosition);
  try {
    await db.prepare(mutation.sql).bind(...mutation.values).run();
    return true;
  } catch (error) {
    console.warn(JSON.stringify({ message: "record_media_order_write_failed", recordId, error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

const ITEM_UPSERT_SQL = `INSERT INTO record_reading_items (
  item_id, record_runtime, record_id, kind, slot, source_key, observation_id,
  anchor_asset_id, anchor_locator_key, anchor_locator_json, display_order, status
) VALUES (?, 'cloudflare_d1', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
ON CONFLICT(record_runtime, record_id, source_key) DO UPDATE SET
  display_order = excluded.display_order,
  status = 'active',
  row_version = record_reading_items.row_version + 1,
  updated_at = CURRENT_TIMESTAMP`;

const AI_REVISION_SQL = `INSERT INTO record_reading_revisions (
  revision_id, item_id, seq, base_revision_id, action, actor_kind, actor_id,
  vocab_version, slot, value_code, value_json, suggestion_id, reason_code, request_id
) VALUES (?, ?,
  (SELECT COALESCE(MAX(seq), 0) + 1 FROM record_reading_revisions WHERE item_id = ?),
  (SELECT revision_id FROM record_reading_revisions WHERE item_id = ? ORDER BY seq DESC LIMIT 1),
  'read', 'ai', NULL, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(item_id, request_id) DO NOTHING`;

type ItemSpec = {
  sourceKey: string;
  kind: "organism" | "feature" | "place_field";
  slot: string;
  observationId: string | null;
  anchor: Anchor;
  displayOrder: number;
  vocabVersion: string | null;
  valueCode: string | null;
  valueJson: Record<string, unknown>;
  suggestionId: string | null;
  reasonCode: string | null;
};

async function itemMutations(recordId: string, requestId: string, spec: ItemSpec): Promise<{ itemId: string; mutations: ReadingSqlMutation[] }> {
  const itemId = await deterministicUuid(`record-reading-item:${recordId}:${spec.sourceKey}`);
  const revisionId = await deterministicUuid(`record-reading-revision:${itemId}:${requestId}`);
  const vocabSlot = spec.vocabVersion ? spec.slot : null;
  return {
    itemId,
    mutations: [
      {
        sql: ITEM_UPSERT_SQL,
        values: [itemId, recordId, spec.kind, spec.slot, spec.sourceKey, spec.observationId, spec.anchor.assetId, spec.anchor.key, spec.anchor.locatorJson, spec.displayOrder],
      },
      {
        sql: AI_REVISION_SQL,
        values: [
          revisionId, itemId, itemId, itemId,
          spec.vocabVersion, vocabSlot, spec.valueCode, JSON.stringify(spec.valueJson), spec.suggestionId, spec.reasonCode, requestId,
        ],
      },
    ],
  };
}

export type OrganismReadingInput = {
  observationId: string;
  suggestionId: string;
  displayOrder: number;
  assetIds: string[];
  aiRunId: string;
};

export async function buildOrganismReadingMutations(recordId: string, requestId: string, organism: OrganismReadingInput): Promise<ReadingSqlMutation[]> {
  const { mutations } = await itemMutations(recordId, requestId, {
    sourceKey: `organism:${organism.observationId}`,
    kind: "organism",
    slot: ORGANISM_SLOT,
    observationId: organism.observationId,
    anchor: { assetId: null, key: "record", locatorJson: "{}" },
    displayOrder: organism.displayOrder,
    vocabVersion: null,
    valueCode: null,
    valueJson: { aiRunId: organism.aiRunId, assetIds: organism.assetIds },
    suggestionId: organism.suggestionId,
    reasonCode: null,
  });
  return mutations;
}

export type ReadingPlanInput = {
  recordId: string;
  requestId: string;
  aiRunId: string;
  mediaIds: readonly string[];
  mediaMeta?: readonly ReadingMediaMeta[];
  model: string;
  promptVersion: string;
  organismCount: number;
  features?: readonly ReadingFeatureInput[];
  place?: readonly ReadingPlaceInput[];
};

export async function buildFeaturePlaceMutations(input: ReadingPlanInput): Promise<ReadingSqlMutation[]> {
  const mutations: ReadingSqlMutation[] = [];
  const keys: string[] = [];
  const evidence = { aiRunId: input.aiRunId, model: input.model, promptVersion: input.promptVersion };
  let order = input.organismCount;

  const ordinals = new Map<string, number>();
  for (const feature of input.features ?? []) {
    if (!isFeatureKind(feature.kind)) throw new Error("record_reading_invalid_feature_kind");
    const anchor = anchorFor(input, feature.assetIndex, feature.timeRange);
    const base = `feature:${anchor.assetId ?? "record"}:${anchor.key}:${feature.kind}`;
    const ordinal = (ordinals.get(base) ?? 0) + 1;
    ordinals.set(base, ordinal);
    const sourceKey = `${base}:${ordinal}`;
    keys.push(sourceKey);
    const built = await itemMutations(input.recordId, input.requestId, {
      sourceKey, kind: "feature", slot: FEATURE_SLOT, observationId: null, anchor, displayOrder: order++,
      vocabVersion: FEATURE_VOCAB_VERSION, valueCode: feature.kind, valueJson: evidence, suggestionId: null, reasonCode: null,
    });
    mutations.push(...built.mutations);
  }

  const placeAnchors = new Set<string>();
  for (const place of input.place ?? []) {
    const anchor = anchorFor(input, place.assetIndex, place.timeRange);
    const anchorKey = `${anchor.assetId ?? "record"}:${anchor.key}`;
    if (placeAnchors.has(anchorKey)) continue;
    placeAnchors.add(anchorKey);
    const informative = place.assessmentState === "informative";
    for (const slot of PLACE_SLOTS) {
      const normalized = informative ? normalizePlaceValue(slot, place.fields[slot]) : { code: "unknown", sourceValue: null };
      const sourceKey = `place:${anchorKey}:${slot}`;
      keys.push(sourceKey);
      const built = await itemMutations(input.recordId, input.requestId, {
        sourceKey, kind: "place_field", slot, observationId: null, anchor, displayOrder: order++,
        vocabVersion: PLACE_VOCAB_VERSION, valueCode: normalized.code,
        valueJson: { ...evidence, scope: place.scope, assessmentState: place.assessmentState, ...(normalized.sourceValue ? { sourceValue: normalized.sourceValue } : {}) },
        suggestionId: null, reasonCode: informative ? null : `environment_${place.assessmentState}`,
      });
      mutations.push(...built.mutations);
    }
  }

  if (input.place !== undefined || input.features !== undefined) {
    mutations.push({
      sql: `UPDATE record_reading_items SET status = 'superseded', row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND kind IN ('feature', 'place_field') AND status = 'active'
          AND source_key NOT IN (${keys.length > 0 ? keys.map(() => "?").join(", ") : "''"})
          AND NOT EXISTS (SELECT 1 FROM record_reading_revisions r WHERE r.item_id = record_reading_items.item_id AND r.actor_kind <> 'ai')`,
      values: [input.recordId, ...keys],
    });
  }
  return mutations;
}

export type ReadingState = "ai_read" | "proposed" | "confirmed";
export type ReadingKind = "organism" | "feature" | "place_field";
export type ReadingRevisionLike = {
  seq: number;
  action: string;
  actorKind: string;
  actorId: string | null;
  valueCode: string | null;
  revisionId?: string | null;
  revertsRevisionId?: string | null;
  valueKey?: string | null;
  removedFlag?: boolean;
  voided?: boolean;
};
export type ReadingComputeOptions = { kind?: ReadingKind; suspendedActors?: ReadonlySet<string> };
export type ReadingComputed = {
  state: ReadingState;
  valueCode: string | null;
  valueKey: string | null;
  actorKind: string;
  removed: boolean;
  ownerPinned: boolean;
  otherViewCount: number;
  contested: boolean;
  disputed: boolean;
  supporterCount: number;
};

export const REMOVE_VOTE_KEY = "__remove__";
export const normalizeReadingName = (value: string): string => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

const isDecisive = (revision: ReadingRevisionLike | undefined): revision is ReadingRevisionLike =>
  Boolean(revision) && ["set", "agree", "revert", "remove"].includes(revision!.action);
const keyOf = (revision: ReadingRevisionLike): string | null => revision.valueKey ?? revision.valueCode;

export function computeReadingState(revisions: readonly ReadingRevisionLike[], options: ReadingComputeOptions = {}): ReadingComputed {
  const suspended = options.suspendedActors ?? new Set<string>();
  const ordered = revisions.filter((revision) => !revision.voided).sort((left, right) => left.seq - right.seq);
  const lastAi = [...ordered].reverse().find((revision) => revision.actorKind === "ai" && revision.action === "read");
  const aiKey = lastAi ? keyOf(lastAi) : null;
  const aiValue = lastAi?.valueCode ?? null;
  const lastBy = (kind: string): ReadingRevisionLike | undefined => [...ordered].reverse().find((revision) => revision.actorKind === kind && revision.action !== "read");
  const reverted = new Set<string>();
  for (const revision of ordered) if (revision.action === "revert" && revision.actorKind === "owner" && revision.revertsRevisionId) reverted.add(revision.revertsRevisionId);

  const latestByActor = new Map<string, { key: string | null; kind: "vote" | "object" | "none"; seq: number }>();
  let shown: string | null = null;
  const tally = (): Map<string, { count: number; firstSeq: number }> => {
    const result = new Map<string, { count: number; firstSeq: number }>();
    for (const [actor, vote] of latestByActor) {
      if (vote.kind !== "vote" || vote.key === null || suspended.has(actor)) continue;
      const entry = result.get(vote.key) ?? { count: 0, firstSeq: vote.seq };
      entry.count += 1;
      entry.firstSeq = Math.min(entry.firstSeq, vote.seq);
      result.set(vote.key, entry);
    }
    return result;
  };
  for (const revision of ordered) {
    if (revision.actorKind !== "community") continue;
    const actor = revision.actorId ?? `anon:${revision.seq}`;
    if (revision.revisionId && reverted.has(revision.revisionId)) latestByActor.set(actor, { key: null, kind: "none", seq: revision.seq });
    else if (revision.action === "object") latestByActor.set(actor, { key: null, kind: "object", seq: revision.seq });
    else if (revision.action === "remove") latestByActor.set(actor, { key: REMOVE_VOTE_KEY, kind: "vote", seq: revision.seq });
    else if (revision.action === "propose" || revision.action === "agree") {
      const key = keyOf(revision);
      latestByActor.set(actor, key ? { key, kind: "vote", seq: revision.seq } : { key: null, kind: "none", seq: revision.seq });
    }
    const counts = tally();
    if (counts.size === 0) shown = null;
    else {
      const top = Math.max(...[...counts.values()].map((entry) => entry.count));
      const leaders = [...counts.entries()].filter(([, entry]) => entry.count === top);
      shown = shown !== null && leaders.some(([key]) => key === shown) ? shown : leaders.sort((left, right) => left[1].firstSeq - right[1].firstSeq)[0]![0];
    }
  }
  const counts = tally();
  const total = [...counts.values()].reduce((sum, entry) => sum + entry.count, 0);
  const disputed = [...latestByActor.entries()].some(([actor, vote]) => vote.kind === "object" && !suspended.has(actor));
  const contested = counts.size > 1;
  const cap = (state: ReadingState): ReadingState => (options.kind === "organism" && state === "confirmed" ? "proposed" : state);
  const base = { contested, disputed };

  const owner = lastBy("owner");
  if (isDecisive(owner)) {
    const removed = owner.action === "remove" || (owner.action === "revert" && owner.removedFlag === true);
    const ownerKey = removed ? null : keyOf(owner) ?? aiKey;
    return {
      ...base, state: cap("confirmed"), valueCode: removed ? null : owner.valueCode ?? aiValue, valueKey: ownerKey, actorKind: "owner", removed, ownerPinned: true,
      otherViewCount: total - (counts.get(removed ? REMOVE_VOTE_KEY : ownerKey ?? "")?.count ?? 0), supporterCount: 0,
    };
  }
  const curator = lastBy("curator");
  if (isDecisive(curator) && curator.action !== "agree") {
    const removed = curator.action === "remove";
    return { ...base, state: cap("confirmed"), valueCode: removed ? null : curator.valueCode, valueKey: removed ? null : keyOf(curator), actorKind: "curator", removed, ownerPinned: false, otherViewCount: 0, supporterCount: 0 };
  }
  if (shown !== null && counts.has(shown)) {
    const shownCount = counts.get(shown)!.count;
    const top = Math.max(...[...counts.values()].map((entry) => entry.count));
    const confirmed = shownCount === top && shownCount >= 2 && !disputed && shownCount / total >= 2 / 3;
    const removed = shown === REMOVE_VOTE_KEY;
    const valueCode = removed || options.kind === "organism" ? null : shown;
    return {
      ...base, state: cap(confirmed ? "confirmed" : "proposed"), valueCode, valueKey: removed ? null : shown, actorKind: "community", removed, ownerPinned: false,
      otherViewCount: total - shownCount, supporterCount: shownCount,
    };
  }
  return { ...base, state: "ai_read", valueCode: aiValue, valueKey: aiKey, actorKind: "ai", removed: false, ownerPinned: false, otherViewCount: 0, supporterCount: 0 };
}

export type ReadingQuery = (sql: string, values: unknown[]) => Promise<Array<Record<string, unknown>>>;
type D1Like = { prepare(sql: string): { bind(...values: unknown[]): { all<T = Record<string, unknown>>(): Promise<{ results: T[] }> } } };
export const d1ReadingQuery = (db: D1Like): ReadingQuery => async (sql, values) => (await db.prepare(sql).bind(...values).all<Record<string, unknown>>()).results;

export type ReadingLocator = { kind: "full" | "rect" | "time_range" | "frame_time" | "other"; startMs?: number; endMs?: number; rect?: { x: number; y: number; width: number; height: number } };
export type ReadingFoundItem = {
  itemId: string;
  kind: "organism" | "feature";
  state: ReadingState;
  code: string | null;
  labelJa: string | null;
  observationId: string | null;
  name: { vernacular: string | null; scientific: string | null; rank: string | null } | null;
  locator: ReadingLocator;
  otherViewCount?: number;
  contested?: boolean;
  disputed?: boolean;
  ownerPinned?: boolean;
};
export type ReadingPlaceValue = {
  itemId: string; code: string; labelJa: string | null; state: ReadingState; actorKind: string; locator: ReadingLocator;
  otherViewCount?: number; contested?: boolean; disputed?: boolean; ownerPinned?: boolean;
};
export type ReadingPlaceFields = Record<PlaceSlot, ReadingPlaceValue | null>;
export type RecordReadingMedia = {
  assetId: string;
  mediaKind: "photo" | "video" | "audio" | "other";
  position: number;
  durationMs: number | null;
  found: ReadingFoundItem[];
  place: ReadingPlaceFields;
  placeRead: boolean;
};
export type RecordReading = {
  recordId: string;
  analyzed: boolean;
  media: RecordReadingMedia[];
  recordLevel: { found: ReadingFoundItem[]; place: ReadingPlaceFields; placeRead: boolean };
};

const emptyPlace = (): ReadingPlaceFields => ({ place_type: null, contact_surface: null, surrounding_cover: null, environment_condition: null, human_change: null });
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function itemLocator(key: string, json: Record<string, unknown>): ReadingLocator {
  if (key.startsWith("t:")) return { kind: "time_range", startMs: num(json.startMs) ?? 0, endMs: num(json.endMs) ?? 0 };
  return { kind: "full" };
}

function linkLocator(kind: string | null, json: Record<string, unknown>): ReadingLocator {
  if (kind === "time_range") return { kind, startMs: num(json.startMs) ?? 0, endMs: num(json.endMs) ?? 0 };
  if (kind === "frame_time") return { kind, startMs: num(json.ms) ?? num(json.startMs) ?? 0 };
  if (kind === "rect" && json.rect && typeof json.rect === "object") return { kind, rect: json.rect as ReadingLocator["rect"] };
  return { kind: "full" };
}

export function revisionLikeFromRow(row: Record<string, unknown>): ReadingRevisionLike {
  const valueJson = parseJson(row.value_json);
  const name = typeof valueJson.name === "string" ? normalizeReadingName(valueJson.name) : null;
  return {
    seq: num(row.seq) ?? 0,
    action: str(row.action) ?? "",
    actorKind: str(row.actor_kind) ?? "",
    actorId: str(row.actor_id),
    valueCode: str(row.value_code),
    revisionId: str(row.revision_id),
    revertsRevisionId: str(row.reverts_revision_id),
    valueKey: name || null,
    removedFlag: valueJson.removed === true,
    voided: num(row.voided) === 1,
  };
}

export async function readRecordReading(query: ReadingQuery, recordId: string): Promise<RecordReading> {
  const [assets, items, revisions, organisms, links, standing, voids] = await Promise.all([
    query(
      `SELECT a.asset_id, a.mime, a.duration_ms, o.position
         FROM asset_ledger a
         LEFT JOIN record_media_order o ON o.record_runtime = 'cloudflare_d1' AND o.record_id = a.observation_id AND o.asset_id = a.asset_id
        WHERE a.observation_id = ? AND a.processing_state = 'uploaded'
        ORDER BY o.position IS NULL, o.position, a.created_at, a.asset_id`,
      [recordId],
    ),
    query(
      `SELECT item_id, kind, slot, observation_id, anchor_asset_id, anchor_locator_key, anchor_locator_json
         FROM record_reading_items
        WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND status = 'active'
        ORDER BY display_order, item_id`,
      [recordId],
    ),
    query(
      `SELECT r.item_id, r.revision_id, r.seq, r.action, r.actor_kind, r.actor_id, r.value_code, r.value_json, r.reverts_revision_id
         FROM record_reading_revisions r
         JOIN record_reading_items i ON i.item_id = r.item_id
        WHERE i.record_runtime = 'cloudflare_d1' AND i.record_id = ?
        ORDER BY r.item_id, r.seq`,
      [recordId],
    ),
    query(
      `SELECT ro.observation_id, ro.lifecycle_status, ro.accepted_identification_id,
              s.proposed_name AS ai_name, s.proposed_scientific_name AS ai_scientific, s.proposed_rank AS ai_rank,
              c.accepted_name, c.proposed_scientific_name AS accepted_scientific, c.accepted_rank
         FROM record_observations ro
         LEFT JOIN observation_ai_suggestions s ON s.observation_id = ro.observation_id AND s.suggestion_status = 'active'
         LEFT JOIN observation_identification_claims c ON c.observation_id = ro.observation_id AND c.identification_id = ro.accepted_identification_id
        WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = ?`,
      [recordId],
    ),
    query(
      `SELECT m.observation_id, m.media_id, m.locator_kind, m.locator_json
         FROM record_observation_media m
         JOIN record_observations ro ON ro.observation_id = m.observation_id
        WHERE ro.record_runtime = 'cloudflare_d1' AND ro.record_id = ? AND m.active = 1 AND m.role <> 'excluded'
        ORDER BY m.created_at, m.link_id`,
      [recordId],
    ),
    query("SELECT user_id FROM record_proposer_standing WHERE status = 'suspended'", []).catch(() => []),
    query(
      `SELECT v.revision_id FROM record_reading_revision_voids v JOIN record_reading_items i ON i.item_id = v.item_id
        WHERE i.record_runtime = 'cloudflare_d1' AND i.record_id = ?`,
      [recordId],
    ).catch(() => []),
  ]);
  const voidedIds = new Set(voids.map((row) => str(row.revision_id)).filter((id): id is string => Boolean(id)));
  const suspendedActors = new Set(standing.map((row) => str(row.user_id)).filter((id): id is string => Boolean(id)));

  const revisionsByItem = new Map<string, ReadingRevisionLike[]>();
  for (const row of revisions) {
    const itemId = str(row.item_id);
    if (!itemId) continue;
    const list = revisionsByItem.get(itemId) ?? [];
    const like = revisionLikeFromRow(row);
    list.push(like.revisionId && voidedIds.has(like.revisionId) ? { ...like, voided: true } : like);
    revisionsByItem.set(itemId, list);
  }
  const organismRows = new Map(organisms.map((row) => [str(row.observation_id) ?? "", row]));
  const linksByObservation = new Map<string, Array<{ mediaId: string; locator: ReadingLocator }>>();
  for (const row of links) {
    const observationId = str(row.observation_id);
    const mediaId = str(row.media_id);
    if (!observationId || !mediaId) continue;
    const list = linksByObservation.get(observationId) ?? [];
    list.push({ mediaId, locator: linkLocator(str(row.locator_kind), parseJson(row.locator_json)) });
    linksByObservation.set(observationId, list);
  }

  const media: RecordReadingMedia[] = assets.map((row, position) => {
    const mime = str(row.mime) ?? "";
    return {
      assetId: str(row.asset_id) ?? "",
      mediaKind: mime.startsWith("image/") ? "photo" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "other",
      position,
      durationMs: num(row.duration_ms),
      found: [],
      place: emptyPlace(),
      placeRead: false,
    };
  });
  const byAsset = new Map(media.map((entry) => [entry.assetId, entry]));
  const recordLevel: RecordReading["recordLevel"] = { found: [], place: emptyPlace(), placeRead: false };

  for (const item of items) {
    const itemId = str(item.item_id) ?? "";
    const kind = str(item.kind);
    const computed = computeReadingState(revisionsByItem.get(itemId) ?? [], { kind: kind === "organism" || kind === "feature" || kind === "place_field" ? kind : undefined, suspendedActors });
    const proposalView = { otherViewCount: computed.otherViewCount, contested: computed.contested, disputed: computed.disputed, ownerPinned: computed.ownerPinned };
    if (computed.removed) continue;
    if (kind === "organism") {
      const observationId = str(item.observation_id) ?? "";
      const organism = organismRows.get(observationId);
      if (!organism || str(organism.lifecycle_status) !== "active") continue;
      const accepted = str(organism.accepted_identification_id) !== null;
      const name = accepted
        ? { vernacular: str(organism.accepted_name), scientific: str(organism.accepted_scientific), rank: str(organism.accepted_rank) }
        : { vernacular: str(organism.ai_name), scientific: str(organism.ai_scientific), rank: str(organism.ai_rank) };
      const base = { itemId, kind: "organism" as const, state: accepted ? "confirmed" as const : computed.state, code: null, labelJa: null, observationId, name, ...proposalView };
      const organismLinks = linksByObservation.get(observationId) ?? [];
      const placed = organismLinks.filter((link) => byAsset.has(link.mediaId));
      if (placed.length === 0) recordLevel.found.push({ ...base, locator: { kind: "full" } });
      for (const link of placed) byAsset.get(link.mediaId)!.found.push({ ...base, locator: link.locator });
      continue;
    }
    const anchorAsset = str(item.anchor_asset_id);
    const locator = itemLocator(str(item.anchor_locator_key) ?? "full", parseJson(item.anchor_locator_json));
    if (kind === "feature") {
      const code = computed.valueCode;
      const found: ReadingFoundItem = { itemId, kind: "feature", state: computed.state, code, labelJa: code ? featureLabelJa(code) : null, observationId: null, name: null, locator, ...proposalView };
      if (!anchorAsset) recordLevel.found.push(found);
      else byAsset.get(anchorAsset)?.found.push(found);
      continue;
    }
    if (kind === "place_field") {
      const slot = str(item.slot);
      if (!isPlaceSlot(slot) || !computed.valueCode) continue;
      const value: ReadingPlaceValue = { itemId, code: computed.valueCode, labelJa: placeLabelJa(slot, computed.valueCode), state: computed.state, actorKind: computed.actorKind, locator, ...proposalView };
      const target = anchorAsset ? byAsset.get(anchorAsset) : recordLevel;
      if (!target) continue;
      target.place[slot] = value;
      target.placeRead = true;
    }
  }
  return { recordId, analyzed: items.length > 0, media, recordLevel };
}
