import type { D1Database, D1PreparedStatement } from "./core/env";
import {
  AI_NOTE_OUTPUT_SCHEMA,
  AI_NOTE_RULE_VERSION,
  AI_NOTE_SLOT_NUMBERS,
  DEFAULT_TAXON_NOTES,
  buildAiNoteEvidence,
  autoCitedEvidence,
  buildAiNotePrompt,
  checkAiNoteSlot,
  chooseInviteKind,
  eligibleInviteKinds,
  inviteBasisIds,
  evidenceMap,
  evidenceRefs,
  isInviteKind,
  parseAiNoteOutput,
  visibleAiNoteSlots,
  type AiNoteCountFact,
  type AiNoteEvidenceRef,
  type AiNoteSlotNo,
  type StoredAiNoteSlot,
  type TaxonNote,
  type VisibleAiNoteSlot,
} from "./recordAiNote";
import { d1ReadingQuery, deterministicUuid, readRecordReading } from "./recordReading";

type NoteDb = Pick<D1Database, "prepare" | "batch">;
export type AiNoteGenerate = (request: Record<string, unknown>) => Promise<string>;
export const AI_NOTE_RECENT_INVITE_WINDOW = 3;
export const AI_NOTE_RETRY_AFTER_SQL = "-1 hour";

type NoteRow = {
  slot: number;
  text_ja: string;
  evidence_json: string;
  invite_kind: string | null;
  status: string;
  owner_user_id: string;
};

function parseRefs(value: string): AiNoteEvidenceRef[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const source = entry as { id?: unknown; fp?: unknown };
      return typeof source?.id === "string" && typeof source.fp === "string" ? [{ id: source.id, fp: source.fp }] : [];
    });
  } catch {
    return [];
  }
}

export async function loadStoredAiNote(db: NoteDb, recordId: string): Promise<{ slots: StoredAiNoteSlot[]; ownerUserId: string | null }> {
  const rows = (await db.prepare(
    `SELECT slot, text_ja, evidence_json, invite_kind, status, owner_user_id
       FROM record_ai_notes WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND rule_version = ? ORDER BY slot`,
  ).bind(recordId, AI_NOTE_RULE_VERSION).all<NoteRow>()).results;
  return {
    ownerUserId: rows[0]?.owner_user_id ?? null,
    slots: rows.flatMap((row) => (row.slot === 1 || row.slot === 2 || row.slot === 3
      ? [{ slot: row.slot as AiNoteSlotNo, text: row.text_ja, evidence: parseRefs(row.evidence_json), invite: row.invite_kind, status: row.status }]
      : [])),
  };
}

export type LoadVisibleAiNoteOptions = {
  isOwner: boolean;
  protectedRecord: boolean | (() => Promise<boolean>);
  ownerUserId?: string | null;
  taxonNotes?: readonly TaxonNote[];
  counts?: readonly AiNoteCountFact[] | (() => Promise<readonly AiNoteCountFact[]>);
};

export async function loadVisibleAiNote(
  db: NoteDb,
  recordId: string,
  options: LoadVisibleAiNoteOptions,
): Promise<{ slots: VisibleAiNoteSlot[]; claimedStale: AiNoteSlotNo[]; ownerUserId: string | null }> {
  const stored = await loadStoredAiNote(db, recordId);
  const resolvedOwnerId = stored.ownerUserId ?? options.ownerUserId ?? null;
  const none = { slots: [], claimedStale: [], ownerUserId: resolvedOwnerId };
  if (typeof options.protectedRecord === "function" ? await options.protectedRecord() : options.protectedRecord) return none;
  if (stored.slots.length === 0) {
    if (!resolvedOwnerId) return none;
    const reading = await readRecordReading(d1ReadingQuery(db as unknown as Parameters<typeof d1ReadingQuery>[0]), recordId);
    const evidence = buildAiNoteEvidence(reading, { taxonNotes: options.taxonNotes });
    if (!reading.analyzed || !evidence.some((item) => item.capture)) return none;
    const claimId = await deterministicUuid(`record-ai-note-row:${recordId}:1`);
    const claim = await db.prepare(
      `INSERT INTO record_ai_notes (note_id, record_runtime, record_id, owner_user_id, slot, rule_version, generation_id, text_ja, evidence_json, invite_kind, model, status)
       VALUES (?, 'cloudflare_d1', ?, ?, 1, ?, 'pending-claim', '再生成待機中', '[]', NULL, '', 'stale')
       ON CONFLICT(record_runtime, record_id, slot) DO UPDATE SET
         owner_user_id = excluded.owner_user_id,
         rule_version = excluded.rule_version,
         generation_id = excluded.generation_id,
         status = 'stale',
         updated_at = CURRENT_TIMESTAMP
       WHERE (rule_version <> excluded.rule_version)
          OR (status = 'stale' AND updated_at < datetime('now', '${AI_NOTE_RETRY_AFTER_SQL}'))`,
    ).bind(claimId, recordId, resolvedOwnerId, AI_NOTE_RULE_VERSION).run() as { meta?: { changes?: number } } | undefined;
    return { slots: [], claimedStale: (claim?.meta?.changes ?? 0) > 0 ? [1] : [], ownerUserId: resolvedOwnerId };
  }
  const reading = await readRecordReading(d1ReadingQuery(db as unknown as Parameters<typeof d1ReadingQuery>[0]), recordId);
  const needsCounts = stored.slots.some((slot) => slot.evidence.some((ref) => ref.id.startsWith("count:")));
  const counts = typeof options.counts === "function" ? (needsCounts ? await options.counts().catch(() => []) : []) : options.counts;
  const current = buildAiNoteEvidence(reading, { taxonNotes: options.taxonNotes, counts });
  const { visible, staleSlots } = visibleAiNoteSlots(stored.slots, current, { owner: options.isOwner });
  const claimedStale: AiNoteSlotNo[] = [];
  for (const slot of staleSlots) {
    const claim = await db.prepare(
      `UPDATE record_ai_notes SET status = 'stale', updated_at = CURRENT_TIMESTAMP
        WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND slot = ? AND rule_version = ?
          AND (status = 'ready' OR (status = 'stale' AND updated_at < datetime('now', '${AI_NOTE_RETRY_AFTER_SQL}')))`,
    ).bind(recordId, slot, AI_NOTE_RULE_VERSION).run() as { meta?: { changes?: number } } | undefined;
    if ((claim?.meta?.changes ?? 0) > 0) claimedStale.push(slot);
  }
  return { slots: visible, claimedStale, ownerUserId: stored.ownerUserId };
}

async function recentInviteKinds(db: NoteDb, ownerUserId: string, recordId: string): Promise<string[]> {
  const rows = (await db.prepare(
    `SELECT invite_kind FROM record_ai_notes
      WHERE owner_user_id = ? AND slot = 3 AND status = 'ready' AND record_id <> ? AND invite_kind IS NOT NULL
      ORDER BY created_at DESC LIMIT ${AI_NOTE_RECENT_INVITE_WINDOW}`,
  ).bind(ownerUserId, recordId).all<{ invite_kind: string }>()).results;
  return rows.map((row) => row.invite_kind);
}

export const AI_NOTE_RECENT_TEXT_WINDOW = 3;

async function recentSlotOneTexts(db: NoteDb, ownerUserId: string, recordId: string): Promise<string[]> {
  const rows = (await db.prepare(
    `SELECT text_ja FROM record_ai_notes
      WHERE owner_user_id = ? AND slot = 1 AND status = 'ready' AND record_id <> ?
      ORDER BY created_at DESC LIMIT ${AI_NOTE_RECENT_TEXT_WINDOW}`,
  ).bind(ownerUserId, recordId).all<{ text_ja: string }>()).results;
  return rows.map((row) => row.text_ja);
}

export type GenerateAiNoteInput = {
  db: NoteDb;
  recordId: string;
  ownerUserId: string;
  model: string;
  generate: AiNoteGenerate;
  protectedRecord?: boolean;
  taxonNotes?: readonly TaxonNote[];
  counts?: readonly AiNoteCountFact[];
};
export const AI_NOTE_MAX_ATTEMPTS = 2;
const FAILURE_HINT_JA: Record<string, string> = {
  reveal_missing: "「〇〇が写っているので、△△が分かります。」の形にし、△△は〇〇の言い換えや曖昧語（環境・様子・特徴）、否定（入っていない）にしない",
  length: "1文・句点は最後に1つだけ、枠1と枠2は45字以内、枠3は50字以内にする",
  narration: "枚数・「写真に」・行動（過ごす、歩く等）の言い方を使わない",
  hedge: "AIの読み取りの名前は「〇〇らしい鳥」の形にするか、名前を出さず「鳥」「虫」「草」「木」と書く",
  banned: "評価・称賛・命令・英字を使わない",
  fluency: "「ようです」を文中に入れない",
  evidence_missing: "文に出した名前やものの記号を evidence に入れる",
  capture_fact_missing: "写っているもの・場所のようすの記号を evidence に入れる",
  number: "根拠一覧にない数字や数え方を使わない",
  frequency: "「よく見られます」などの頻度の言い方は、件数の根拠が5件以上の時だけ使う",
  invite_form: "「次は〜すると、〜も残せます／〜が分かります」の形にする（近づく・巣・餌は不可）",
  invite_kind: "決められた種類の誘いにする",
};
export type GenerateAiNoteResult = { stored: AiNoteSlotNo[]; dropped: Array<{ slot: AiNoteSlotNo; text: string; failures: string[] }>; called: boolean };

export async function generateAndStoreAiNote(input: GenerateAiNoteInput): Promise<GenerateAiNoteResult> {
  const { db, recordId, ownerUserId } = input;
  const reading = await readRecordReading(d1ReadingQuery(db as unknown as Parameters<typeof d1ReadingQuery>[0]), recordId);
  const evidence = buildAiNoteEvidence(reading, { taxonNotes: input.taxonNotes ?? DEFAULT_TAXON_NOTES, counts: input.counts });
  const map = evidenceMap(evidence);
  const dropped: GenerateAiNoteResult["dropped"] = [];
  const keep = new Map<AiNoteSlotNo, { text: string; refs: AiNoteEvidenceRef[]; invite: string | null }>();
  let called = false;
  if (!input.protectedRecord && reading.analyzed && evidence.some((item) => item.capture)) {
    const avoid = await recentInviteKinds(db, ownerUserId, recordId);
    const recentTexts = await recentSlotOneTexts(db, ownerUserId, recordId);
    const inviteKind = chooseInviteKind(eligibleInviteKinds(reading), recordId, avoid);
    called = true;
    let feedback = "";
    for (let attempt = 0; attempt < AI_NOTE_MAX_ATTEMPTS; attempt += 1) {
      const { prompt, aliases } = buildAiNotePrompt({ evidence, inviteKind, recordId, recentTexts });
      const raw = await input.generate({
        contents: [{ role: "user", parts: [{ text: feedback ? `${prompt}\n${feedback}` : prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
          responseJsonSchema: AI_NOTE_OUTPUT_SCHEMA,
          thinkingConfig: { thinkingLevel: "minimal" },
        },
      });
      const failed: Array<{ slot: AiNoteSlotNo; text: string; failures: string[] }> = [];
      for (const draft of parseAiNoteOutput(raw, aliases)) {
        if (keep.has(draft.slot)) continue;
        if (draft.slot === 1) draft.evidence = autoCitedEvidence(draft.text, draft.evidence, evidence);
        if (draft.slot === 3 && inviteKind) draft.evidence = [...new Set([...draft.evidence, ...inviteBasisIds(inviteKind, evidence)])];
        const failures = checkAiNoteSlot(draft, map) as string[];
        if (draft.slot === 3 && (!inviteKind || draft.invite !== inviteKind)) failures.push("invite_not_missing");
        if (failures.length > 0) { failed.push({ slot: draft.slot, text: draft.text, failures }); continue; }
        keep.set(draft.slot, { text: draft.text, refs: evidenceRefs(draft.evidence, map), invite: draft.slot === 3 && isInviteKind(draft.invite) ? draft.invite : null });
      }
      dropped.length = 0;
      dropped.push(...failed.filter((entry) => !keep.has(entry.slot)));
      const missing = ([1, ...(inviteKind ? [3] : [])] as AiNoteSlotNo[]).filter((slot) => !keep.has(slot));
      if (missing.length === 0) break;
      feedback = `前回の出力は次の理由で不合格でした。直して、全ての枠をもう一度出力してください。\n${dropped.map((entry) => `枠${entry.slot}「${entry.text}」: ${entry.failures.map((code) => FAILURE_HINT_JA[code] ?? code).join(" / ")}`).join("\n") || missing.map((slot) => `枠${slot}が出力されませんでした。`).join("\n")}`;
    }
  }
  const generationId = await deterministicUuid(`record-ai-note:${recordId}:${AI_NOTE_RULE_VERSION}:${crypto.randomUUID()}`);
  const statements: D1PreparedStatement[] = [];
  for (const slot of AI_NOTE_SLOT_NUMBERS) {
    const entry = keep.get(slot);
    if (!entry) {
      statements.push(db.prepare(
        "DELETE FROM record_ai_notes WHERE record_runtime = 'cloudflare_d1' AND record_id = ? AND slot = ?",
      ).bind(recordId, slot));
      continue;
    }
    statements.push(db.prepare(
      `INSERT INTO record_ai_notes (note_id, record_runtime, record_id, owner_user_id, slot, rule_version, generation_id, text_ja, evidence_json, invite_kind, model, status)
       VALUES (?, 'cloudflare_d1', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready')
       ON CONFLICT(record_runtime, record_id, slot) DO UPDATE SET
         owner_user_id = excluded.owner_user_id, rule_version = excluded.rule_version, generation_id = excluded.generation_id,
         text_ja = excluded.text_ja, evidence_json = excluded.evidence_json, invite_kind = excluded.invite_kind,
         model = excluded.model, status = 'ready', created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      await deterministicUuid(`record-ai-note-row:${recordId}:${slot}`), recordId, ownerUserId, slot, AI_NOTE_RULE_VERSION, generationId,
      entry.text, JSON.stringify(entry.refs), entry.invite, input.model,
    ));
  }
  await db.batch(statements);
  return { stored: [...keep.keys()], dropped, called };
}
