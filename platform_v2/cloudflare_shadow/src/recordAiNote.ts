import { PLACE_SLOTS, type PlaceSlot, type RecordReading, type ReadingFoundItem, type ReadingPlaceValue } from "./recordReading";

export const AI_NOTE_RULE_VERSION = "ai-note/1";
export type AiNoteSlotNo = 1 | 2 | 3;
export const AI_NOTE_SLOT_NUMBERS: readonly AiNoteSlotNo[] = [1, 2, 3];
export const AI_NOTE_SLOT_MAX_CHARS: Record<AiNoteSlotNo, number> = { 1: 45, 2: 45, 3: 50 };
export const AI_NOTE_TOTAL_MAX_CHARS = 140;
export const AI_NOTE_FREQUENCY_MIN_COUNT = 5;
export const AI_NOTE_DISCLOSURE_KEY = "aiGeneratedTitleAndNote";

export const INVITE_KINDS = ["step_back_whole", "ground_contact", "scale_reference", "other_angle", "leaf_or_flower", "other_season", "sound"] as const;
export type InviteKind = (typeof INVITE_KINDS)[number];
export const isInviteKind = (value: unknown): value is InviteKind => typeof value === "string" && (INVITE_KINDS as readonly string[]).includes(value);

const INVITE_HINT_JA: Record<InviteKind, string> = {
  step_back_whole: "少し離れて全体を入れる",
  ground_contact: "足もとと地面の境目を入れる",
  scale_reference: "大きさの比べられる物を入れる",
  other_angle: "別の角度から撮る",
  leaf_or_flower: "葉や花の一部を入れる（植物のみ）",
  other_season: "同じ場所を別の季節にも撮る",
  sound: "音も一緒に残す",
};

export type AiNoteEvidenceKind = "organism" | "feature" | "place" | "photo_fact" | "taxon_note" | "count";
export type AiNoteEvidence = {
  id: string;
  kind: AiNoteEvidenceKind;
  fp: string;
  label: string;
  capture: boolean;
  number: number | null;
  organismItemId: string | null;
  nameJa: string | null;
  aiRead: boolean;
};
export type AiNoteEvidenceRef = { id: string; fp: string };
export type AiNoteSlotDraft = { slot: AiNoteSlotNo; text: string; evidence: string[]; invite: string | null };

export type TaxonNote = { key: string; names: readonly string[]; text: string; source: string };
export type AiNoteCountFact = { id: string; label: string; count: number };
export const DEFAULT_TAXON_NOTES: readonly TaxonNote[] = [];

const PLACE_SLOT_LABEL_JA: Record<PlaceSlot, string> = {
  place_type: "場所の種類",
  contact_surface: "足もとの面",
  surrounding_cover: "まわりのようす",
  environment_condition: "光や水のようす",
  human_change: "人の手の跡",
};

const STATE_JA = { ai_read: "AIの読み取り", proposed: "提案あり", confirmed: "確認済み" } as const;

export type AiNoteFailure =
  | "evidence_missing" | "evidence_unknown" | "evidence_stale" | "capture_fact_missing"
  | "banned" | "fluency" | "length" | "number" | "frequency" | "hedge" | "learning_basis" | "invite_form" | "invite_kind";

export type AiNoteEvidenceOptions = { taxonNotes?: readonly TaxonNote[]; counts?: readonly AiNoteCountFact[] };

const fp = (...parts: Array<string | null | undefined>): string => parts.map((part) => part ?? "").join("|");

export function buildAiNoteEvidence(reading: RecordReading, options: AiNoteEvidenceOptions = {}): AiNoteEvidence[] {
  const out = new Map<string, AiNoteEvidence>();
  const notes = options.taxonNotes ?? DEFAULT_TAXON_NOTES;
  const put = (item: AiNoteEvidence) => { if (!out.has(item.id)) out.set(item.id, item); };
  const addFound = (found: ReadingFoundItem) => {
    if (found.kind === "organism") {
      const vernacular = found.name?.vernacular?.trim() || null;
      const scientific = found.name?.scientific?.trim() || null;
      const nameJa = vernacular;
      if (!nameJa && !scientific) return;
      const id = `item:${found.itemId}`;
      put({
        id, kind: "organism", fp: fp("o", vernacular, scientific, found.state), capture: false, number: null,
        organismItemId: found.itemId, nameJa, aiRead: found.state === "ai_read",
        label: `見つかったもの: ${nameJa ?? scientific}（${STATE_JA[found.state]}）`,
      });
      const note = notes.find((entry) => entry.names.some((name) => name === vernacular || name === scientific));
      if (note) {
        put({
          id: `note:${found.itemId}:${note.key}`, kind: "taxon_note", fp: fp("n", note.key, note.text), capture: false, number: null,
          organismItemId: found.itemId, nameJa: null, aiRead: false, label: `保存済みの解説（${nameJa ?? scientific}）: ${note.text}`,
        });
      }
      return;
    }
    if (!found.labelJa || found.code === "unknown_feature") return;
    put({
      id: `item:${found.itemId}`, kind: "feature", fp: fp("f", found.code, found.state), capture: true, number: null,
      organismItemId: null, nameJa: null, aiRead: false, label: `写っているもの: ${found.labelJa}（${STATE_JA[found.state]}）`,
    });
  };
  const addPlace = (slot: PlaceSlot, value: ReadingPlaceValue | null) => {
    if (!value || value.code === "unknown" || !value.labelJa) return;
    put({
      id: `item:${value.itemId}`, kind: "place", fp: fp("p", slot, value.code, value.state), capture: true, number: null,
      organismItemId: null, nameJa: null, aiRead: false, label: `${PLACE_SLOT_LABEL_JA[slot]}: ${value.labelJa}（${STATE_JA[value.state]}）`,
    });
  };
  const levels = [...reading.media, reading.recordLevel];
  for (const level of levels) {
    for (const found of level.found) addFound(found);
    for (const slot of PLACE_SLOTS) addPlace(slot, level.place[slot]);
  }
  const photos = reading.media.filter((media) => media.mediaKind === "photo").length;
  if (photos >= 2) {
    put({
      id: "fact:photo_count", kind: "photo_fact", fp: fp("c", String(photos)), capture: true, number: photos,
      organismItemId: null, nameJa: null, aiRead: false, label: `写真の枚数: ${photos}枚`,
    });
  }
  for (const count of options.counts ?? []) {
    put({
      id: count.id, kind: "count", fp: fp("k", String(count.count)), capture: false, number: count.count,
      organismItemId: null, nameJa: null, aiRead: false, label: `${count.label}: ${count.count}件`,
    });
  }
  return [...out.values()];
}

export const evidenceMap = (evidence: readonly AiNoteEvidence[]): Map<string, AiNoteEvidence> => new Map(evidence.map((item) => [item.id, item]));
export const evidenceRefs = (ids: readonly string[], map: ReadonlyMap<string, AiNoteEvidence>): AiNoteEvidenceRef[] =>
  ids.flatMap((id) => { const item = map.get(id); return item ? [{ id, fp: item.fp }] : []; });

const BANNED_PATTERNS: readonly RegExp[] = [
  /よく撮れ|上手|素晴らし|すばらし|すごい|見事|きれいに撮|いい写真|良い写真|さすが|完璧|えらい|センス|才能|がんば|頑張/u,
  /正解|不正解|間違|失敗|惜しい|残念|もう少し|足りません|写っていません/u,
  /してください|しましょう|すべき|必要です|撮り直|してみて|なさい/u,
  /間違いなく|確実に|絶対/u,
  /他の人より|ランキング|レベル|ポイント|順位/u,
  /ありがとうございます|特記事項|[!！?？]|\p{Extended_Pictographic}/u,
  /^(?:あなた|貴方)/u,
  /[A-Za-z]{2,}|画像\s*\d|https?:/u,
];
const FREQUENCY_PATTERN = /よく見られ|多く見られ|たくさん見られ|毎年|いつも|ふつうに見られ|普通に見られ|この時期に多|よくいる|よく来る/u;
const HEDGE_PATTERN = /の仲間|のようです|ようです|に見え|と読み取れ|らしき|らしい|かもしれ|と思われ|と見られ/u;
const INVITE_PATTERN = /^次は[^。]{2,40}(?:と|ば)、[^。]{2,40}(?:残せます|分かります|わかります|見えてきます|確かめられます|比べられます|たどれます|伝わります|残せるかもしれません|分かるかもしれません)。$/u;
const INVITE_UNSAFE = /近づ|触[っれる]|捕ま|捕獲|巣|餌|えさ|追い[かけ]|写っていない|足りない|不足/u;
const COUNTER = "枚件羽匹頭本個種回人つ度日月年番";
const KANJI_DIGIT: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function kanjiNumber(text: string): number {
  let total = 0;
  let current = 0;
  for (const ch of text) {
    if (ch === "百") { total += (current || 1) * 100; current = 0; }
    else if (ch === "十") { total += (current || 1) * 10; current = 0; }
    else current = KANJI_DIGIT[ch] ?? current;
  }
  return total + current;
}

export function numbersInText(text: string): number[] {
  const normalized = text.normalize("NFKC");
  const found: number[] = [...normalized.matchAll(/\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
  for (const match of normalized.matchAll(new RegExp(`([一二三四五六七八九十百]+)(?=[${COUNTER}])`, "gu"))) found.push(kanjiNumber(match[1]!));
  return found;
}

export function aiNoteTextFailures(slot: AiNoteSlotNo, text: string, invite: string | null): AiNoteFailure[] {
  const failures: AiNoteFailure[] = [];
  const normalized = text.normalize("NFKC");
  if (BANNED_PATTERNS.some((pattern) => pattern.test(normalized))) failures.push("banned");
  if (/ようです[^。]/u.test(normalized)) failures.push("fluency");
  const length = [...text].length;
  if (!/^[^。\n]+。$/u.test(text) || length > AI_NOTE_SLOT_MAX_CHARS[slot]) failures.push("length");
  if (slot === 3) {
    if (!INVITE_PATTERN.test(text) || INVITE_UNSAFE.test(text)) failures.push("invite_form");
    if (!isInviteKind(invite)) failures.push("invite_kind");
  }
  return failures;
}

export function checkAiNoteSlot(draft: AiNoteSlotDraft, evidence: ReadonlyMap<string, AiNoteEvidence>): AiNoteFailure[] {
  const failures = aiNoteTextFailures(draft.slot, draft.text, draft.invite);
  const cited = draft.evidence.map((id) => evidence.get(id));
  if (draft.evidence.length === 0) failures.push("evidence_missing");
  if (cited.some((item) => !item)) failures.push("evidence_unknown");
  const known = cited.filter((item): item is AiNoteEvidence => Boolean(item));
  if (draft.slot === 1 && !known.some((item) => item.capture)) failures.push("capture_fact_missing");
  const allowed = new Set(known.flatMap((item) => (item.number === null ? [] : [item.number])));
  if (numbersInText(draft.text).some((value) => !allowed.has(value))) failures.push("number");
  if (FREQUENCY_PATTERN.test(draft.text) && !known.some((item) => item.kind === "count" && (item.number ?? 0) >= AI_NOTE_FREQUENCY_MIN_COUNT)) failures.push("frequency");
  for (const item of evidence.values()) {
    if (item.kind !== "organism" || !item.nameJa || !draft.text.includes(item.nameJa)) continue;
    if (!known.some((entry) => entry.id === item.id)) failures.push("evidence_missing");
    if (item.aiRead && draft.slot !== 2 && !HEDGE_PATTERN.test(draft.text)) failures.push("hedge");
    if (draft.slot === 2 && !known.some((entry) => entry.kind === "taxon_note" && entry.organismItemId === item.organismItemId)) failures.push("learning_basis");
  }
  if (draft.slot === 2 && !known.some((item) => item.kind === "taxon_note" || item.kind === "place" || item.kind === "count")) failures.push("learning_basis");
  return [...new Set(failures)];
}

export function checkAiNoteSlotWithRefs(
  draft: AiNoteSlotDraft,
  refs: readonly AiNoteEvidenceRef[],
  current: ReadonlyMap<string, AiNoteEvidence>,
): AiNoteFailure[] {
  const failures = checkAiNoteSlot({ ...draft, evidence: refs.map((ref) => ref.id) }, current);
  if (refs.some((ref) => current.get(ref.id)?.fp !== ref.fp)) failures.push("evidence_stale");
  return [...new Set(failures)];
}

export const AI_NOTE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    slots: {
      type: "array", maxItems: 3,
      items: {
        type: "object",
        properties: {
          slot: { type: "integer", enum: [1, 2, 3] },
          text: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          invite_kind: { type: "string", enum: ["none", ...INVITE_KINDS] },
        },
        required: ["slot", "text", "evidence", "invite_kind"],
      },
    },
  },
  required: ["slots"],
} as const;

export type AiNotePromptInput = { evidence: readonly AiNoteEvidence[]; allowInvite: boolean; avoidInviteKinds: readonly string[] };

export function buildAiNotePrompt(input: AiNotePromptInput): { prompt: string; aliases: Map<string, string> } {
  const aliases = new Map<string, string>();
  const lines = input.evidence.map((item, index) => {
    const alias = `e${index + 1}`;
    aliases.set(alias, item.id);
    return `${alias}: ${item.label}`;
  });
  const invites = INVITE_KINDS.filter((kind) => !input.avoidInviteKinds.includes(kind)).map((kind) => `${kind}=${INVITE_HINT_JA[kind]}`);
  const prompt = [
    "記録ページに置く短い日本語の文を、次の3枠で作ってください。使える材料は下の根拠一覧だけです。一覧にない事実・名前・数・習性を足さないでください。",
    "枠1: 写っている事実と、そこから分かること（1文・45字以内）。根拠に写っているもの・場所のようす・写真の枚数のいずれかを含める。",
    "枠2: 見つかったものまたは場所についての学び（1文・45字以内）。根拠の「保存済みの解説」「場所のようす」にある内容だけで書き、外の知識を足さない。材料が薄ければ出さない。",
    input.allowInvite
      ? `枠3: 次の一歩の誘い（1文・50字以内）。「次は〜すると、〜も残せます」「次は〜すると、〜が分かります」の形だけ。命令にしない。invite_kindは次から選ぶ: ${invites.join(" / ")}。生きものに近づく・触る・捕まえる・巣や餌に関わる誘いは書かない。`
      : "枠3は出さない。",
    "禁止: 評価・称賛（よく撮れています、上手ですね等）、正解や不正解の判定、命令（〜してください）、言い切り（絶対・確実）、感嘆符、絵文字、英字、内部の番号。「あなたは」で始めない。",
    "名前が「AIの読み取り」の生きものは、「〜の仲間のようです」のように言い切らずに書く。「ようです」は文末だけに使い、1枠は必ず1文（句点は最後に1つだけ）にする。数字は根拠一覧に書かれた数だけ使う。件数や「よく見られる」は根拠に件数がある時だけ。",
    "各枠には、根拠として使った一覧の記号（e1など）を evidence に入れる。材料が足りない枠は出力しない（slotsに含めない）。invite_kindは枠3以外では none。",
    "根拠一覧:",
    ...lines,
  ].join("\n");
  return { prompt, aliases };
}

export function parseAiNoteOutput(raw: string, aliases: ReadonlyMap<string, string>): AiNoteSlotDraft[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  const slots = parsed && typeof parsed === "object" ? (parsed as { slots?: unknown }).slots : null;
  if (!Array.isArray(slots)) return [];
  const seen = new Set<number>();
  const drafts: AiNoteSlotDraft[] = [];
  for (const entry of slots) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const slot = source.slot;
    if (slot !== 1 && slot !== 2 && slot !== 3) continue;
    if (seen.has(slot) || typeof source.text !== "string") continue;
    seen.add(slot);
    const refs = Array.isArray(source.evidence) ? source.evidence.filter((value): value is string => typeof value === "string") : [];
    const invite = typeof source.invite_kind === "string" && source.invite_kind !== "none" ? source.invite_kind : null;
    drafts.push({ slot, text: source.text.trim(), evidence: [...new Set(refs.map((ref) => aliases.get(ref.trim().toLowerCase()) ?? ref))], invite: slot === 3 ? invite : null });
  }
  return drafts.sort((left, right) => left.slot - right.slot);
}

export type StoredAiNoteSlot = {
  slot: AiNoteSlotNo;
  text: string;
  evidence: AiNoteEvidenceRef[];
  invite: string | null;
  status: string;
};
export type VisibleAiNoteSlot = { slot: AiNoteSlotNo; text: string };

export function visibleAiNoteSlots(
  stored: readonly StoredAiNoteSlot[],
  current: readonly AiNoteEvidence[],
  viewer: { owner: boolean },
): { visible: VisibleAiNoteSlot[]; staleSlots: AiNoteSlotNo[] } {
  const map = evidenceMap(current);
  const visible: VisibleAiNoteSlot[] = [];
  const staleSlots: AiNoteSlotNo[] = [];
  for (const row of [...stored].sort((left, right) => left.slot - right.slot)) {
    if (row.slot === 3 && !viewer.owner) continue;
    if (row.status !== "ready") continue;
    const failures = checkAiNoteSlotWithRefs({ slot: row.slot, text: row.text, evidence: [], invite: row.invite }, row.evidence, map);
    if (failures.includes("evidence_stale")) { staleSlots.push(row.slot); continue; }
    if (failures.length > 0) continue;
    visible.push({ slot: row.slot, text: row.text });
  }
  return { visible: finalizeVisibleAiNoteSlots(visible, viewer.owner), staleSlots };
}

export function finalizeVisibleAiNoteSlots(slots: readonly VisibleAiNoteSlot[], owner: boolean): VisibleAiNoteSlot[] {
  const kept = slots.filter((entry) => (owner || entry.slot !== 3) && aiNoteTextFailures(entry.slot, entry.text, entry.slot === 3 ? "step_back_whole" : null).length === 0);
  let total = 0;
  const out: VisibleAiNoteSlot[] = [];
  for (const entry of [...kept].sort((left, right) => left.slot - right.slot)) {
    total += [...entry.text].length;
    if (total > AI_NOTE_TOTAL_MAX_CHARS || out.length >= 3) break;
    out.push(entry);
  }
  return out;
}
