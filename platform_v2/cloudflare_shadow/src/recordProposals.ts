import {
  FEATURE_SLOT,
  FEATURE_VOCAB_VERSION,
  ORGANISM_SLOT,
  PLACE_VOCAB_VERSION,
  computeReadingState,
  deterministicUuid,
  featureLabelJa,
  isFeatureKind,
  normalizeReadingName,
  placeLabelJa,
  revisionLikeFromRow,
  isPlaceSlot,
  validTimeRange,
  type ReadingComputed,
  type ReadingKind,
  type ReadingRevisionLike,
} from "./recordReading";

export const PROPOSAL_RATE_LIMIT = 30;
export const PROPOSAL_RATE_WINDOW_MINUTES = 60;
export const REVERT_SUSPEND_COUNT = 5;
export const REVERT_SUSPEND_OWNERS = 3;
export const REVERT_WINDOW_DAYS = 30;
export const RATE_LIMITED_MESSAGE_JA = "少し時間をおいてからもう一度どうぞ";

type Bound = { first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type ProposalDb = {
  prepare(sql: string): { bind(...values: unknown[]): Bound };
  batch(statements: unknown[]): Promise<Array<{ meta?: { changes?: number } }>>;
};
export type ProposalMutation = { sql: string; values: Array<string | number | null> };
export type OrganismClaimBuilder = (input: { recordId: string; observationId: string; name: string; actorUserId: string; owner: boolean; requestId: string }) => Promise<ProposalMutation[]>;
export type ProposalDeps = { db: ProposalDb; now?: () => Date; organismClaim?: OrganismClaimBuilder };
export type ProposalActor = { userId: string; banned?: boolean } | null;
export type ProposalResult = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };

const OPS = ["propose", "agree", "object", "set", "remove", "revert"] as const;
type Op = (typeof OPS)[number];
const CODE_PATTERN = /^[a-z0-9_]{1,40}$/u;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9:_-]{8,120}$/u;
const RECORD_ID_PATTERN = /^[A-Za-z0-9:_-]{1,180}$/u;
const REASON_PATTERN = /^[a-z0-9_]{1,40}$/u;

export const sqlTime = (date: Date): string => date.toISOString().slice(0, 19).replace("T", " ");
const fail = (status: number, error: string, extra: Record<string, unknown> = {}, headers?: Record<string, string>): ProposalResult => ({ status, body: { ok: false, error, ...extra }, headers });
const str = (value: unknown): string | null => (typeof value === "string" ? value : null);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const REVISION_INSERT_SQL = `INSERT INTO record_reading_revisions (
  revision_id, item_id, seq, base_revision_id, action, actor_kind, actor_id,
  vocab_version, slot, value_code, value_json, reason_code, reverts_revision_id, request_id, created_at
) SELECT ?, ?,
  (SELECT COALESCE(MAX(seq), 0) + 1 FROM record_reading_revisions WHERE item_id = ?),
  (SELECT revision_id FROM record_reading_revisions WHERE item_id = ? ORDER BY seq DESC LIMIT 1),
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
WHERE (? = 0 OR (SELECT COUNT(*) FROM record_reading_revisions WHERE actor_id = ? AND actor_kind = 'community' AND created_at >= ?) < ?)
  AND NOT EXISTS (SELECT 1 FROM record_reading_revisions WHERE item_id = ? AND request_id = ?)`;

const STANDING_SUSPEND_SQL = `INSERT INTO record_proposer_standing (user_id, status, reason, suspended_at, updated_at)
SELECT ?, 'suspended', 'reverted_often', ?, ?
WHERE (SELECT COUNT(*) FROM record_reading_revisions rv JOIN record_reading_revisions t ON t.revision_id = rv.reverts_revision_id
        WHERE rv.action = 'revert' AND t.actor_id = ? AND rv.created_at >= ?
          AND rv.created_at > COALESCE((SELECT released_at FROM record_proposer_standing WHERE user_id = ?), '')) >= ?
   OR (SELECT COUNT(DISTINCT rv.actor_id) FROM record_reading_revisions rv JOIN record_reading_revisions t ON t.revision_id = rv.reverts_revision_id
        WHERE rv.action = 'revert' AND t.actor_id = ? AND rv.created_at >= ?
          AND rv.created_at > COALESCE((SELECT released_at FROM record_proposer_standing WHERE user_id = ?), '')) >= ?
ON CONFLICT(user_id) DO UPDATE SET status = 'suspended', reason = 'reverted_often', suspended_at = excluded.suspended_at,
  released_at = NULL, released_by = NULL, updated_at = excluded.updated_at
WHERE record_proposer_standing.status <> 'suspended'`;

type ItemRow = { item_id: string; kind: ReadingKind; slot: string; observation_id: string | null; anchor_asset_id: string | null; anchor_locator_key: string; anchor_locator_json: string; status: string };

type Prepared = {
  item: { itemId: string; kind: ReadingKind; slot: string };
  ensureItem: ProposalMutation | null;
};

async function loadRevisions(db: ProposalDb, itemId: string): Promise<Array<{ like: ReadingRevisionLike; row: Record<string, unknown> }>> {
  const rows = (await db.prepare(
    `SELECT r.revision_id, r.item_id, r.seq, r.action, r.actor_kind, r.actor_id, r.value_code, r.value_json, r.reverts_revision_id, r.reason_code, r.created_at,
            (v.revision_id IS NOT NULL) AS voided
       FROM record_reading_revisions r LEFT JOIN record_reading_revision_voids v ON v.revision_id = r.revision_id
      WHERE r.item_id = ? ORDER BY r.seq`,
  ).bind(itemId).all<Record<string, unknown>>()).results;
  return rows.map((row) => ({ like: revisionLikeFromRow(row), row }));
}

async function suspendedSet(db: ProposalDb): Promise<Set<string>> {
  const rows = (await db.prepare("SELECT user_id FROM record_proposer_standing WHERE status = 'suspended'").bind().all<{ user_id: string }>()).results;
  return new Set(rows.map((row) => row.user_id));
}

function describe(kind: ReadingKind, slot: string, computed: ReadingComputed) {
  const code = computed.valueCode;
  const labelJa = kind === "feature" ? (code ? featureLabelJa(code) : null) : kind === "place_field" && isPlaceSlot(slot) && code ? placeLabelJa(slot, code) : null;
  return {
    state: computed.state, valueCode: code, labelJa, removed: computed.removed, ownerPinned: computed.ownerPinned,
    otherViewCount: computed.otherViewCount, contested: computed.contested, disputed: computed.disputed,
  };
}

async function vocabAllows(db: ProposalDb, version: string, slot: string, code: string): Promise<boolean> {
  if (!CODE_PATTERN.test(code)) return false;
  const row = await db.prepare("SELECT 1 AS ok FROM record_vocabulary_terms WHERE vocab_version = ? AND slot = ? AND code = ? AND status = 'active' LIMIT 1").bind(version, slot, code).first();
  return row !== null;
}

const vocabFor = (kind: ReadingKind, slot: string): { version: string; slot: string } | null =>
  kind === "place_field" ? { version: PLACE_VOCAB_VERSION, slot } : kind === "feature" ? { version: FEATURE_VOCAB_VERSION, slot: FEATURE_SLOT } : null;

export async function submitReadingProposal(deps: ProposalDeps, input: { recordId: string; actor: ProposalActor; body: unknown }): Promise<ProposalResult> {
  const { db } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const actor = input.actor;
  if (!actor || actor.banned) return fail(401, "session_required");
  const recordId = input.recordId;
  if (!RECORD_ID_PATTERN.test(recordId)) return fail(400, "record_id_invalid");
  if (!isRecord(input.body)) return fail(400, "body_invalid");
  const body = input.body;
  const clientRequestId = str(body.requestId);
  if (!clientRequestId || !REQUEST_ID_PATTERN.test(clientRequestId)) return fail(400, "request_id_invalid");
  const requestedOp = str(body.op) as Op | null;
  if (!requestedOp || !OPS.includes(requestedOp)) return fail(400, "op_invalid");

  const record = await db.prepare(
    `SELECT o.owner_user_id, COALESCE(p.visibility, o.visibility) AS visibility, COALESCE(p.accepts_identification_proposals, 0) AS accepts
       FROM observations o LEFT JOIN record_observation_policies p ON p.record_runtime = 'cloudflare_d1' AND p.record_id = o.observation_id
      WHERE o.observation_id = ? AND o.emergency_hidden = 0 LIMIT 1`,
  ).bind(recordId).first<{ owner_user_id: string; visibility: string; accepts: number }>();
  if (!record) return fail(404, "record_not_found");
  const owner = record.owner_user_id === actor.userId;
  if (!owner) {
    if (record.visibility !== "public" || Number(record.accepts) !== 1) return fail(403, "proposals_not_accepted");
    if (requestedOp === "set" || requestedOp === "revert") return fail(403, "owner_required");
    const standing = await db.prepare("SELECT status FROM record_proposer_standing WHERE user_id = ? LIMIT 1").bind(actor.userId).first<{ status: string }>();
    if (standing?.status === "suspended") return fail(403, "proposer_suspended");
  } else if (requestedOp === "object") return fail(400, "owner_cannot_object");
  const op: Op = owner && requestedOp === "propose" ? "set" : requestedOp;
  const actorKind = owner ? "owner" : "community";
  const requestId = `${actor.userId}:${clientRequestId}`;

  // 対象を決める
  const itemIdInput = str(body.itemId);
  const observationIdInput = str(body.observationId);
  const addInput = isRecord(body.add) ? body.add : null;
  if ([itemIdInput, observationIdInput, addInput].filter((value) => value !== null).length !== 1) return fail(400, "target_invalid");

  let prepared: Prepared;
  let anchorAssetId: string | null = null;
  if (itemIdInput) {
    const item = await db.prepare(
      `SELECT item_id, kind, slot, observation_id, anchor_asset_id, anchor_locator_key, anchor_locator_json, status FROM record_reading_items
        WHERE item_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ? LIMIT 1`,
    ).bind(itemIdInput, recordId).first<ItemRow>();
    if (!item || item.status !== "active") return fail(404, "item_not_found");
    prepared = { item: { itemId: item.item_id, kind: item.kind, slot: item.slot }, ensureItem: null };
  } else if (observationIdInput) {
    const organism = await db.prepare(
      `SELECT observation_id FROM record_observations WHERE observation_id = ? AND record_runtime = 'cloudflare_d1' AND record_id = ? AND lifecycle_status = 'active' LIMIT 1`,
    ).bind(observationIdInput, recordId).first();
    if (!organism) return fail(404, "target_invalid");
    const sourceKey = `organism:${observationIdInput}`;
    const itemId = await deterministicUuid(`record-reading-item:${recordId}:${sourceKey}`);
    prepared = {
      item: { itemId, kind: "organism", slot: ORGANISM_SLOT },
      ensureItem: {
        sql: `INSERT INTO record_reading_items (item_id, record_runtime, record_id, kind, slot, source_key, observation_id, anchor_locator_key, anchor_locator_json, display_order, status)
              VALUES (?, 'cloudflare_d1', ?, 'organism', 'organism', ?, ?, 'record', '{}', 0, 'active') ON CONFLICT(record_runtime, record_id, source_key) DO NOTHING`,
        values: [itemId, recordId, sourceKey, observationIdInput],
      },
    };
  } else {
    if (op !== "set" && op !== "propose") return fail(400, "add_op_invalid");
    if (str(addInput!.kind) !== "feature") return fail(400, "add_kind_invalid");
    const kindCode = str(addInput!.valueCode);
    if (!kindCode || !isFeatureKind(kindCode)) return fail(400, "value_not_allowed");
    const assetInput = str(addInput!.assetId);
    let locatorKey = "full";
    let locatorJson = "{}";
    if (assetInput) {
      const asset = await db.prepare("SELECT asset_id, duration_ms FROM asset_ledger WHERE asset_id = ? AND observation_id = ? AND processing_state = 'uploaded' LIMIT 1").bind(assetInput, recordId).first<{ asset_id: string; duration_ms: number | null }>();
      if (!asset) return fail(400, "asset_invalid");
      anchorAssetId = asset.asset_id;
      if (isRecord(addInput!.timeRange)) {
        const range = validTimeRange({ startMs: num(addInput!.timeRange.startMs), endMs: num(addInput!.timeRange.endMs) }, asset.duration_ms);
        if (!range) return fail(400, "time_range_invalid");
        locatorKey = `t:${range.startMs}-${range.endMs}`;
        locatorJson = JSON.stringify(range);
      }
    } else anchorAssetId = null;
    const sourceKey = `added:${actor.userId}:${clientRequestId}`;
    const itemId = await deterministicUuid(`record-reading-item:${recordId}:${sourceKey}`);
    prepared = {
      item: { itemId, kind: "feature", slot: FEATURE_SLOT },
      ensureItem: {
        sql: `INSERT INTO record_reading_items (item_id, record_runtime, record_id, kind, slot, source_key, anchor_asset_id, anchor_locator_key, anchor_locator_json, display_order, status)
              VALUES (?, 'cloudflare_d1', ?, 'feature', 'feature_kind', ?, ?, ?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM record_reading_items WHERE record_runtime = 'cloudflare_d1' AND record_id = ?), 'active')
              ON CONFLICT(record_runtime, record_id, source_key) DO NOTHING`,
        values: [itemId, recordId, sourceKey, anchorAssetId, locatorKey, locatorJson, recordId],
      },
    };
  }
  const { item } = prepared;
  const itemKind = item.kind;
  const suspended = await suspendedSet(db);
  const history = await loadRevisions(db, item.itemId);
  const compute = (revisions: ReadingRevisionLike[]) => computeReadingState(revisions, { kind: itemKind, suspendedActors: suspended });

  // 同じ要求番号の再送は、書き込まず・回数に数えず、同じ結果を返す
  const existing = await db.prepare("SELECT revision_id FROM record_reading_revisions WHERE item_id = ? AND request_id = ? LIMIT 1").bind(item.itemId, requestId).first<{ revision_id: string }>();
  if (existing) return { status: 200, body: { ok: true, replayed: true, itemId: item.itemId, revisionId: existing.revision_id, current: describe(itemKind, item.slot, compute(history.map((entry) => entry.like))) } };

  // 回数制限はここだけ。他人の記録への書き込みだけを数える
  if (!owner) {
    const windowStart = sqlTime(new Date(now.getTime() - PROPOSAL_RATE_WINDOW_MINUTES * 60_000));
    const used = await db.prepare("SELECT COUNT(*) AS c, MIN(created_at) AS oldest FROM record_reading_revisions WHERE actor_id = ? AND actor_kind = 'community' AND created_at >= ?").bind(actor.userId, windowStart).first<{ c: number; oldest: string | null }>();
    if (num(used?.c) >= PROPOSAL_RATE_LIMIT) return rateLimited(used?.oldest ?? null, now);
  }

  // 値の検査（選択肢だけ。自由な文は受け付けない）
  const vocab = vocabFor(itemKind, item.slot);
  const reasonCode = str(body.reasonCode);
  if (reasonCode !== null && !REASON_PATTERN.test(reasonCode)) return fail(400, "reason_invalid");
  let valueCode: string | null = null;
  let organismName: string | null = null;
  const valueJson: Record<string, unknown> = {};
  const needsValue = op === "propose" || op === "set" || op === "agree";
  if (needsValue) {
    if (vocab) {
      const code = addInput ? str(addInput.valueCode) : str(body.valueCode);
      if (!code || !(await vocabAllows(db, vocab.version, vocab.slot, code))) return fail(400, "value_not_allowed");
      valueCode = code;
    } else {
      const raw = str(body.name)?.normalize("NFKC").trim().replace(/\s+/gu, " ") ?? "";
      if (raw.length < 1 || raw.length > 160 || /[\u0000-\u001f\u007f]/u.test(raw)) return fail(400, "name_invalid");
      organismName = raw;
      valueJson.name = raw;
    }
  }
  if (op === "agree") {
    const known = new Set(history.filter((entry) => !entry.like.voided && ["read", "propose", "agree", "set", "revert"].includes(entry.like.action)).map((entry) => entry.like.valueKey ?? entry.like.valueCode).filter((key): key is string => Boolean(key)));
    const key = valueCode ?? (organismName ? normalizeReadingName(organismName) : null);
    if (!key || !known.has(key)) return fail(400, "nothing_to_agree");
  }

  // 戻す（本人だけ）
  let revertsRevisionId: string | null = null;
  let revertTargetActor: string | null = null;
  if (op === "revert") {
    const targetId = str(body.targetRevisionId);
    const target = history.find((entry) => entry.like.revisionId === targetId);
    if (!target || target.like.actorKind !== "community" || target.like.voided) return fail(400, "revert_target_invalid");
    if (history.some((entry) => entry.like.action === "revert" && entry.like.revertsRevisionId === targetId)) return fail(409, "already_reverted");
    const before = compute(history.map((entry) => entry.like).filter((revision) => revision.seq < target.like.seq));
    revertsRevisionId = targetId;
    revertTargetActor = target.like.actorId;
    valueCode = itemKind === "organism" ? null : before.valueCode;
    if (before.removed) valueJson.removed = true;
    else if (itemKind === "organism" && before.valueKey) valueJson.name = before.valueKey;
  }

  const revisionId = await deterministicUuid(`record-reading-revision:${item.itemId}:${requestId}`);
  const community = actorKind === "community";
  const windowStart = sqlTime(new Date(now.getTime() - PROPOSAL_RATE_WINDOW_MINUTES * 60_000));
  const createdAt = sqlTime(now);
  const statements: ProposalMutation[] = [];
  if (prepared.ensureItem) statements.push(prepared.ensureItem);
  const revisionIndex = statements.length;
  statements.push({
    sql: REVISION_INSERT_SQL,
    values: [
      revisionId, item.itemId, item.itemId, item.itemId,
      op, actorKind, actor.userId,
      vocab?.version ?? null, vocab?.slot ?? null, valueCode, JSON.stringify(valueJson), reasonCode, revertsRevisionId, requestId, createdAt,
      community ? 1 : 0, actor.userId, windowStart, PROPOSAL_RATE_LIMIT,
      item.itemId, requestId,
    ],
  });
  statements.push({ sql: "UPDATE record_reading_items SET row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP WHERE item_id = ?", values: [item.itemId] });
  if (op === "revert" && revertTargetActor) {
    const since = sqlTime(new Date(now.getTime() - REVERT_WINDOW_DAYS * 86_400_000));
    statements.push({
      sql: STANDING_SUSPEND_SQL,
      values: [revertTargetActor, createdAt, createdAt, revertTargetActor, since, revertTargetActor, REVERT_SUSPEND_COUNT, revertTargetActor, since, revertTargetActor, REVERT_SUSPEND_OWNERS],
    });
  }
  if (itemKind === "organism" && organismName && (op === "propose" || op === "set") && deps.organismClaim) {
    const claim = await deps.organismClaim({ recordId, observationId: observationIdInput ?? (await observationOfItem(db, item.itemId)) ?? "", name: organismName, actorUserId: actor.userId, owner, requestId: clientRequestId });
    statements.push(...claim);
  }

  let applied = false;
  for (let attempt = 0; attempt < 3 && !applied; attempt += 1) {
    try {
      const results = await db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...statement.values)));
      applied = num(results[revisionIndex]?.meta?.changes) > 0;
      break;
    } catch (error) {
      if (!/UNIQUE|constraint/iu.test(String(error)) || attempt === 2) throw error;
    }
  }
  if (!applied) {
    const raced = await db.prepare("SELECT revision_id FROM record_reading_revisions WHERE item_id = ? AND request_id = ? LIMIT 1").bind(item.itemId, requestId).first<{ revision_id: string }>();
    if (raced) return { status: 200, body: { ok: true, replayed: true, itemId: item.itemId, revisionId: raced.revision_id, current: describe(itemKind, item.slot, compute((await loadRevisions(db, item.itemId)).map((entry) => entry.like))) } };
    return rateLimited(null, now);
  }
  const after = await loadRevisions(db, item.itemId);
  const suspendedAfter = await suspendedSet(db);
  const current = describe(itemKind, item.slot, computeReadingState(after.map((entry) => entry.like), { kind: itemKind, suspendedActors: suspendedAfter }));
  return { status: 200, body: { ok: true, replayed: false, itemId: item.itemId, revisionId, op, current, proposerSuspended: revertTargetActor ? suspendedAfter.has(revertTargetActor) : undefined } };
}

async function observationOfItem(db: ProposalDb, itemId: string): Promise<string | null> {
  const row = await db.prepare("SELECT observation_id FROM record_reading_items WHERE item_id = ? LIMIT 1").bind(itemId).first<{ observation_id: string | null }>();
  return row?.observation_id ?? null;
}

function rateLimited(oldest: string | null, now: Date): ProposalResult {
  const oldestMs = oldest ? Date.parse(`${oldest.replace(" ", "T")}Z`) : NaN;
  const retryAfterSeconds = Number.isFinite(oldestMs) ? Math.max(1, Math.ceil((oldestMs + PROPOSAL_RATE_WINDOW_MINUTES * 60_000 - now.getTime()) / 1000)) : 60;
  return fail(429, "proposal_rate_limited", { messageJa: RATE_LIMITED_MESSAGE_JA, retryAfterSeconds }, { "retry-after": String(retryAfterSeconds) });
}

export type HistoryViewer = { userId: string | null };
export type FieldNameResolver = (userIds: string[]) => Promise<Map<string, string>>;

export async function readReadingHistory(deps: { db: ProposalDb; fieldNames?: FieldNameResolver }, recordId: string, viewer: HistoryViewer): Promise<ProposalResult> {
  const { db } = deps;
  if (!RECORD_ID_PATTERN.test(recordId)) return fail(404, "record_not_found");
  const record = await db.prepare(
    `SELECT o.owner_user_id, COALESCE(p.visibility, o.visibility) AS visibility FROM observations o
       LEFT JOIN record_observation_policies p ON p.record_runtime = 'cloudflare_d1' AND p.record_id = o.observation_id
      WHERE o.observation_id = ? AND o.emergency_hidden = 0 LIMIT 1`,
  ).bind(recordId).first<{ owner_user_id: string; visibility: string }>();
  const owner = Boolean(record && viewer.userId && record.owner_user_id === viewer.userId);
  if (!record || (record.visibility !== "public" && !owner)) return fail(404, "record_not_found");
  const items = (await db.prepare(
    `SELECT item_id, kind, slot, observation_id, anchor_asset_id, anchor_locator_key, display_order FROM record_reading_items
      WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND status = 'active' ORDER BY display_order, item_id`,
  ).bind(recordId).all<Record<string, unknown>>()).results;
  const revisionRows = (await db.prepare(
    `SELECT r.revision_id, r.item_id, r.seq, r.action, r.actor_kind, r.actor_id, r.value_code, r.value_json, r.reverts_revision_id, r.reason_code, r.created_at,
            (v.revision_id IS NOT NULL) AS voided
       FROM record_reading_revisions r JOIN record_reading_items i ON i.item_id = r.item_id
       LEFT JOIN record_reading_revision_voids v ON v.revision_id = r.revision_id
      WHERE i.record_runtime = 'cloudflare_d1' AND i.record_id = ? ORDER BY r.item_id, r.seq`,
  ).bind(recordId).all<Record<string, unknown>>()).results;
  const suspended = await suspendedSet(db);
  const actorIds = [...new Set(revisionRows.filter((row) => row.actor_kind !== "ai").map((row) => str(row.actor_id)).filter((id): id is string => Boolean(id)))];
  const names = deps.fieldNames && actorIds.length > 0 ? await deps.fieldNames(actorIds).catch(() => new Map<string, string>()) : new Map<string, string>();
  const byItem = new Map<string, Array<Record<string, unknown>>>();
  for (const row of revisionRows) {
    const list = byItem.get(String(row.item_id)) ?? [];
    list.push(row);
    byItem.set(String(row.item_id), list);
  }
  const out = items.map((row) => {
    const kind = String(row.kind) as ReadingKind;
    const slot = String(row.slot);
    const rows = byItem.get(String(row.item_id)) ?? [];
    const current = describe(kind, slot, computeReadingState(rows.map(revisionLikeFromRow), { kind, suspendedActors: suspended }));
    return {
      itemId: String(row.item_id), kind, slot, observationId: str(row.observation_id), anchorAssetId: str(row.anchor_asset_id), anchorLocatorKey: str(row.anchor_locator_key),
      current,
      revisions: rows.map((revision) => {
        const code = str(revision.value_code);
        const actorKind = String(revision.actor_kind);
        const actorId = str(revision.actor_id);
        const valueJson = (() => { try { return JSON.parse(String(revision.value_json ?? "{}")) as Record<string, unknown>; } catch { return {}; } })();
        return {
          revisionId: String(revision.revision_id), seq: num(revision.seq), action: String(revision.action), actorKind,
          fieldName: actorKind === "ai" ? null : actorKind === "owner" || actorId ? names.get(actorId ?? "") ?? null : null,
          mine: Boolean(viewer.userId && actorId === viewer.userId),
          valueCode: code,
          labelJa: kind === "feature" ? (code ? featureLabelJa(code) : null) : kind === "place_field" && isPlaceSlot(slot) && code ? placeLabelJa(slot, code) : null,
          name: typeof valueJson.name === "string" ? valueJson.name : null,
          reasonCode: str(revision.reason_code), revertsRevisionId: str(revision.reverts_revision_id),
          voided: num(revision.voided) === 1, suspendedProposer: Boolean(actorId && suspended.has(actorId)), createdAt: str(revision.created_at),
        };
      }),
    };
  });
  return { status: 200, body: { ok: true, recordId, owner, items: out } };
}

// 運営だけ：ある人の提案をまとめて無効にする（行は消さない）／停止を解く
export async function voidProposerAccount(deps: { db: ProposalDb; now?: () => Date }, input: { adminUserId: string; userId: string }): Promise<ProposalResult> {
  const now = (deps.now ?? (() => new Date()))();
  if (!input.userId || input.userId.length > 180) return fail(400, "user_invalid");
  const at = sqlTime(now);
  const results = await deps.db.batch([
    deps.db.prepare(
      `INSERT OR IGNORE INTO record_reading_revision_voids (revision_id, item_id, actor_id, reason, created_by, created_at)
       SELECT revision_id, item_id, actor_id, 'account_voided', ?, ? FROM record_reading_revisions WHERE actor_id = ? AND actor_kind = 'community'`,
    ).bind(input.adminUserId, at, input.userId),
    deps.db.prepare(
      `INSERT INTO record_proposer_standing (user_id, status, reason, suspended_at, updated_at) VALUES (?, 'suspended', 'account_voided', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET status = 'suspended', reason = 'account_voided', suspended_at = excluded.suspended_at, released_at = NULL, released_by = NULL, updated_at = excluded.updated_at`,
    ).bind(input.userId, at, at),
  ]);
  return { status: 200, body: { ok: true, voidedRevisions: num(results[0]?.meta?.changes), proposerSuspended: true } };
}

export async function releaseProposer(deps: { db: ProposalDb; now?: () => Date }, input: { adminUserId: string; userId: string }): Promise<ProposalResult> {
  const now = (deps.now ?? (() => new Date()))();
  const at = sqlTime(now);
  const results = await deps.db.batch([
    deps.db.prepare("UPDATE record_proposer_standing SET status = 'released', released_at = ?, released_by = ?, updated_at = ? WHERE user_id = ? AND status = 'suspended'").bind(at, input.adminUserId, at, input.userId),
  ]);
  return { status: 200, body: { ok: true, released: num(results[0]?.meta?.changes) > 0 } };
}

const NO_STORE = { "cache-control": "private, no-store", "content-type": "application/json; charset=utf-8" };
const respond = (result: ProposalResult): Response => new Response(JSON.stringify(result.body), { status: result.status, headers: { ...NO_STORE, ...(result.headers ?? {}) } });

export type ProposalRouteDeps = ProposalDeps & {
  fieldNames?: FieldNameResolver;
  readSession: () => Promise<{ userId: string; banned?: boolean; roleName?: string | null; rankLabel?: string | null } | null>;
  isAdmin: (session: { userId: string; roleName?: string | null; rankLabel?: string | null }) => boolean;
};

export async function handleRecordProposalRoute(deps: ProposalRouteDeps, request: Request, pathname: string): Promise<Response | null> {
  const recordMatch = /^\/api\/v1\/records\/([^/]+)\/(reading-proposals|reading-history)$/.exec(pathname);
  const adminMatch = /^\/api\/v1\/admin\/reading-proposals\/(void-account|release-proposer)$/.exec(pathname);
  if (!recordMatch && !adminMatch) return null;
  const sameOrigin = () => request.headers.get("origin") === new URL(request.url).origin;
  if (adminMatch) {
    if (request.method !== "POST") return respond(fail(405, "method_not_allowed"));
    if (!sameOrigin()) return respond(fail(403, "same_origin_required"));
    const session = await deps.readSession().catch(() => null);
    if (!session || session.banned) return respond(fail(401, "session_required"));
    if (!deps.isAdmin(session)) return respond(fail(403, "admin_required"));
    const payload = await request.json().catch(() => null) as { userId?: unknown } | null;
    const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
    return respond(adminMatch[1] === "void-account"
      ? await voidProposerAccount(deps, { adminUserId: session.userId, userId })
      : await releaseProposer(deps, { adminUserId: session.userId, userId }));
  }
  const recordId = decodeURIComponent(recordMatch![1]!);
  if (recordMatch![2] === "reading-history") {
    if (request.method !== "GET") return respond(fail(405, "method_not_allowed"));
    const session = await deps.readSession().catch(() => null);
    return respond(await readReadingHistory(deps, recordId, { userId: session && !session.banned ? session.userId : null }));
  }
  if (request.method !== "POST") return respond(fail(405, "method_not_allowed"));
  if (!sameOrigin()) return respond(fail(403, "same_origin_required"));
  const session = await deps.readSession().catch(() => null);
  const body = await request.json().catch(() => null);
  return respond(await submitReadingProposal(deps, { recordId, actor: session, body }));
}
