import { FEATURE_TERMS, PLACE_SLOTS, type PlaceSlot, type RecordReading, type ReadingFoundItem, type ReadingPlaceValue } from "./recordReading";

export const AI_NOTE_RULE_VERSION = "ai-note/2";
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
  scale_reference: "大きさの比べられる物（手や硬貨など）を一緒に入れる",
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
  terms: string[];
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
  | "banned" | "narration" | "fluency" | "reveal_missing" | "length" | "number" | "frequency" | "hedge" | "learning_basis" | "invite_form" | "invite_kind";

export type AiNoteEvidenceOptions = { taxonNotes?: readonly TaxonNote[]; counts?: readonly AiNoteCountFact[] };

const termsOf = (label: string): string[] => label.split(/[・や、]/u).map((part) => part.trim()).filter((part) => [...part].length >= 2);
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
      if (nameJa && FEATURE_TERMS.some(([, label]) => label === nameJa)) return;
      const id = `item:${found.itemId}`;
      put({
        id, kind: "organism", fp: fp("o", vernacular, scientific, found.state), capture: false, number: null,
        organismItemId: found.itemId, nameJa, aiRead: found.state === "ai_read", terms: nameJa ? [nameJa] : [],
        label: `見つかったもの: ${nameJa ?? scientific}（${STATE_JA[found.state]}）${found.state === "ai_read" && nameJa ? `※文中では必ず「${nameJa}らしい〇〇」の形にする（〇〇は鳥・虫・草・木・生きもの等）` : ""}`,
      });
      const note = notes.find((entry) => entry.names.some((name) => name === vernacular || name === scientific));
      if (note) {
        put({
          id: `note:${found.itemId}:${note.key}`, kind: "taxon_note", fp: fp("n", note.key, note.text), capture: false, number: null,
          organismItemId: found.itemId, nameJa: null, aiRead: false, terms: [], label: `保存済みの解説（${nameJa ?? scientific}）: ${note.text}`,
        });
      }
      return;
    }
    if (!found.labelJa || found.code === "unknown_feature") return;
    put({
      id: `item:${found.itemId}`, kind: "feature", fp: fp("f", found.code, found.state), capture: true, number: null,
      organismItemId: null, nameJa: null, aiRead: false, terms: termsOf(found.labelJa), label: `写っているもの: ${found.labelJa}（${STATE_JA[found.state]}）`,
    });
  };
  const addPlace = (slot: PlaceSlot, value: ReadingPlaceValue | null) => {
    if (!value || value.code === "unknown" || !value.labelJa) return;
    put({
      id: `item:${value.itemId}`, kind: "place", fp: fp("p", slot, value.code, value.state), capture: true, number: null,
      organismItemId: null, nameJa: null, aiRead: false, terms: termsOf(value.labelJa), label: `${PLACE_SLOT_LABEL_JA[slot]}: ${value.labelJa}（${STATE_JA[value.state]}）`,
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
      id: "fact:photo_count", kind: "photo_fact", fp: fp("c", String(photos)), capture: false, number: photos,
      organismItemId: null, nameJa: null, aiRead: false, terms: [], label: `写真の枚数: ${photos}枚`,
    });
  }
  for (const count of options.counts ?? []) {
    put({
      id: count.id, kind: "count", fp: fp("k", String(count.count)), capture: false, number: count.count,
      organismItemId: null, nameJa: null, aiRead: false, terms: [], label: `${count.label}: ${count.count}件`,
    });
  }
  return [...out.values()];
}

export function autoCitedEvidence(text: string, cited: readonly string[], evidence: readonly AiNoteEvidence[]): string[] {
  const extra = evidence.filter((item) => item.terms.some((term) => text.includes(term))).map((item) => item.id);
  return [...new Set([...cited, ...extra])];
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
  /立派|素敵|すてき|魅力|貴重|大切|嬉しい|うれしい|ぴったり|最適|理想的|ちょうど良|良い場所|いい場所|おすすめ|お見事|ならでは/u,
];
const BEHAVIOR_PATTERN = /過ごし|歩い|飛ん|泳い|食べ|休ん|鳴い|活動する|生息/u;
const VAGUE_REVEAL = /環境|様子|状況|性質|雰囲気|生息|特徴|入っていない|手つかず|自然のまま|隠れ場所|混ざり合う/u;
const NARRATION_PATTERN = /収め[まて]|記録され|記録しま|撮影され|撮影しま|撮られて|写真に|枚の写真|写真が\d|写真は\d|\d+枚|写っており|写ってお|が見られます|が見られる|見受けられ|確認できます|確認できる/u;
const FLUENCY_PATTERN = /よう(?:です|で|だ|な)|といえ|と言え|である。|でしょう/u;
const REVEAL_PATTERN = /^[^。、]{2,24}(?:、[^。、]{2,16})?(?:ので|から|ため)、[^。、]{3,28}(?:分かります|わかります|読み取れます|確かめられます|たどれます|残せます|見えてきます)。$/u;
const FACT_CLAUSE_END = /(?:写っている|写る|写り込んでいる|見える|入っている|ある|あり|映っている|広がっている|並んでいる|生えている|残っている|流れている|見られる|っている)(?:の)?$/u;
const INVITE_KIND_TEXT: Record<InviteKind, RegExp> = {
  step_back_whole: /離れ|全体|全景|引い/u,
  ground_contact: /足もと|足元|地面|境目/u,
  scale_reference: /大きさ|比べ|並べ|サイズ/u,
  other_angle: /角度|横から|別の|反対|裏|上から|正面/u,
  leaf_or_flower: /葉|花|実|枝/u,
  other_season: /季節|同じ場所/u,
  sound: /音|声|鳴/u,
};
const FREQUENCY_PATTERN = /よく見られ|多く見られ|たくさん見られ|毎年|いつも|ふつうに見られ|普通に見られ|この時期に多|よくいる|よく来る/u;
const HEDGE_PATTERN = /の仲間|に見え|と読み取れ|らしき|らしい|かもしれ|と思われ|と見られ/u;
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
  const normalized = text.normalize("NFKC").replace(/一種/gu, "");
  const found: number[] = [...normalized.matchAll(/\d+(?:\.\d+)?/gu)].map((match) => Number(match[0]));
  for (const match of normalized.matchAll(new RegExp(`([一二三四五六七八九十百]+)(?=[${COUNTER}])`, "gu"))) found.push(kanjiNumber(match[1]!));
  return found;
}

function isTautology(text: string): boolean {
  const [factPart, ...rest] = text.split(/ので、|から、|ため、/u);
  const reveal = rest.join("");
  const fact = [...(factPart ?? "").replace(/(?:が|も|まで)?(?:写っている|写る|写り込んでいる|見える|入っている|ある|あり|映っている|広がっている|並んでいる|生えている|残っている|流れている|見られる|っている)(?:の)?$/u, "")];
  if (fact.join("").split(/[とやも、・]/u).some((part) => [...part].length >= 2 && reveal.includes(part))) return true;
  for (let index = 0; index + 3 <= fact.length; index += 1) if (reveal.includes(fact.slice(index, index + 3).join(""))) return true;
  return false;
}

export function aiNoteTextFailures(slot: AiNoteSlotNo, text: string, invite: string | null, options: { skipKind?: boolean } = {}): AiNoteFailure[] {
  const failures: AiNoteFailure[] = [];
  const normalized = text.normalize("NFKC");
  if (BANNED_PATTERNS.some((pattern) => pattern.test(normalized))) failures.push("banned");
  if (NARRATION_PATTERN.test(normalized) || BEHAVIOR_PATTERN.test(normalized)) failures.push("narration");
  if (FLUENCY_PATTERN.test(normalized)) failures.push("fluency");
  const length = [...text].length;
  if (!/^[^。\n]+。$/u.test(text) || length > AI_NOTE_SLOT_MAX_CHARS[slot]) failures.push("length");
  if (slot === 1) {
    const fact = text.split(/ので、|から、|ため、/u)[0] ?? "";
    if (!REVEAL_PATTERN.test(text) || !FACT_CLAUSE_END.test(fact) || VAGUE_REVEAL.test(text) || isTautology(text)) failures.push("reveal_missing");
  }
  if (slot === 3) {
    if (!INVITE_PATTERN.test(text) || INVITE_UNSAFE.test(text)) failures.push("invite_form");
    if (!options.skipKind) {
      if (!isInviteKind(invite) || !INVITE_KIND_TEXT[invite].test(text)) failures.push("invite_kind");
    }
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
  if (draft.slot === 2 && !known.some((item) => item.kind === "taxon_note" || item.kind === "count")) failures.push("learning_basis");
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

const LANDSCAPE_FEATURES = new Set(["grass_patch", "tree_canopy", "water_surface", "revetment", "building", "bridge", "rock"]);
const SCALE_FEATURES = new Set(["artifact", "building", "bridge", "fence", "signboard", "pavement", "revetment"]);
const SINGING_NAME = /鳥|サギ|ガラス|スズメ|ヒヨドリ|ムクドリ|カモ|ヒワ|セミ|カエル|コオロギ|キリギリス|フクロウ|ウグイス|シジュウカラ/u;

export function eligibleInviteKinds(reading: RecordReading): InviteKind[] {
  const levels = [...reading.media, reading.recordLevel];
  const found = levels.flatMap((level) => level.found);
  const organisms = found.filter((item) => item.kind === "organism");
  const features = new Set(found.flatMap((item) => (item.kind === "feature" && item.code ? [item.code] : [])));
  const known = (slot: PlaceSlot) => levels.some((level) => level.place[slot] !== null && level.place[slot]!.code !== "unknown");
  const photos = reading.media.filter((media) => media.mediaKind === "photo").length;
  const hasOrganism = organisms.length > 0;
  const wideCount = [...features].filter((code) => LANDSCAPE_FEATURES.has(code)).length;
  const kinds: InviteKind[] = [];
  if (hasOrganism && wideCount < 2 && photos <= 2) kinds.push("step_back_whole");
  if (!known("contact_surface") || (hasOrganism && photos <= 2)) kinds.push("ground_contact");
  if (hasOrganism && ![...features].some((code) => SCALE_FEATURES.has(code))) kinds.push("scale_reference");
  if (hasOrganism && photos <= 2) kinds.push("other_angle");
  if (hasOrganism && organisms.some((item) => SINGING_NAME.test(item.name?.vernacular ?? ""))) kinds.push("sound");
  if (known("place_type") || features.size > 0) kinds.push("other_season");
  return kinds;
}

export function inviteBasisIds(kind: InviteKind, evidence: readonly AiNoteEvidence[]): string[] {
  const organism = evidence.filter((item) => item.kind === "organism").map((item) => item.id);
  const placeOrFeature = evidence.filter((item) => item.capture).map((item) => item.id);
  const pool = kind === "ground_contact" || kind === "other_season" ? placeOrFeature : organism.length > 0 ? organism : placeOrFeature;
  return pool.slice(0, 2);
}

const hashText = (value: string): number => {
  let hash = 2166136261;
  for (const ch of value) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return hash;
};

export function chooseInviteKind(eligible: readonly InviteKind[], recordId: string, avoid: readonly string[]): InviteKind | null {
  const open = eligible.filter((kind) => !avoid.includes(kind));
  if (open.length === 0) return null;
  const specific = open.filter((kind) => kind !== "other_season");
  const pool = specific.length > 0 && hashText(`season:${recordId}`) % 5 !== 0 ? specific : open;
  return [...pool].sort((left, right) => hashText(`${recordId}:${left}`) - hashText(`${recordId}:${right}`))[0]!;
}

export type AiNotePromptInput = { evidence: readonly AiNoteEvidence[]; inviteKind: InviteKind | null };

export function buildAiNotePrompt(input: AiNotePromptInput): { prompt: string; aliases: Map<string, string>; allowSlot2: boolean } {
  const aliases = new Map<string, string>();
  const lines = input.evidence.map((item, index) => {
    const alias = `e${index + 1}`;
    aliases.set(alias, item.id);
    return `${alias}: ${item.label}`;
  });
  const allowSlot2 = input.evidence.some((item) => item.kind === "taxon_note" || item.kind === "count");
  const prompt = [
    "記録ページに置く短い日本語を作ってください。使える材料は下の根拠一覧だけです。一覧にない事実・名前・数・習性を足さないでください。",
    "枠1（必須）: 「写っている具体的な事実」＋「ので、それで分かること」を1文で書く。形は『〇〇が写っているので、△△が分かります。』。45字以内、句点は文末に1つだけ、1つの主語と1つの述語で自然な日本語にする。",
    "文に出す名前・もの・場所のようすは、必ずその一覧の記号を evidence に入れる（入れ忘れた文は捨てられる）。名前が「AIの読み取り」のものは、必ず「〇〇らしい〇〇」の形にする。名前が長くなる時は、名前を出さず「鳥」「虫」「草」「木」とだけ書いてよい（その方が自然）。",
    "枠1の良い例: 「水面と足もとまで写っているので、鳥が待つ場所の深さが分かります。」「柵と低い草が写っているので、人の手が入った草地だと分かります。」「木の茂みと日陰が写っているので、日差しの少ない林だと分かります。」",
    "「分かること」は、写っているものから一歩で言えることにする。例: 草刈りの跡・柵・舗装・建物・案内板→人の手が入った（人の暮らしに近い）場所、木の茂みと日陰→日差しの少ない林、水面→水辺、低い草や草むら→草地、岩や土→足もとが固く開けた場所（根拠にある語を繰り返す答えは避ける）。木と低い草→緑の多い場所、濡れている・水が流れている→水気のある場所、日が当たって開けている→日当たりのよい開けた場所。場所の種類の名前を、そのまま「分かること」として繰り返さない。「〜が入っていない」「〜がない」のような否定で締めない。「環境」「様子」「状況」「性質」「特徴」のような曖昧な言葉で締めない。",
    "枠1で守ること: 「分かること」は、根拠の内容から言えることだけにする。写真の枚数、「写真に」「収めました」「記録されています」のような説明の言い方は使わない。「〜のようです」は使わない。生きものの動き・行動・習性（過ごす、歩く、飛ぶ、食べる等）は書かない。根拠から言えない環境の評価（自然のまま、豊か等）も書かない。",
    allowSlot2
      ? "枠2（任意）: 根拠の「保存済みの解説」「件数」にある内容だけで、その生きもの・場所の学びを1文（45字以内）で書く。言い換えや場所の説明の繰り返しにはしない。件数は根拠に書かれた数のまま使い、「よく見られます」「多く見られます」のような頻度の言い方は、件数の根拠が5件以上の時だけ使う（5件未満は件数だけを書く）。"
      : "枠2は出さない（保存済みの解説も件数も無い）。",
    input.inviteKind
      ? `枠3: 次の一歩の誘いを1文（50字以内）。種類は ${input.inviteKind}（${INVITE_HINT_JA[input.inviteKind]}）に決まっている。「次は〜すると、〜も残せます」または「次は〜すると、〜が分かります」の形だけ。命令にしない。生きものの名前は書かず「この生きもの」と書く。近づく・触る・捕まえる・巣や餌に関わる誘いは書かない。`
      : "枠3は出さない。",
    "禁止: 評価・称賛（よく撮れています、上手ですね、素敵、貴重等）、正解や不正解の判定、命令（〜してください）、言い切り（絶対・確実）、感嘆符、絵文字、英字、内部の番号。「あなたは」で始めない。数字は根拠一覧に書かれた数だけ。",
    "各枠には、根拠として使った一覧の記号（e1など）を evidence に入れる。枠1は「写っているもの」または場所のようすの根拠を必ず含める。材料が足りない枠は出力しない（slotsに含めない）。invite_kindは枠3だけ決まった種類、他は none。",
    "根拠一覧:",
    ...lines,
  ].join("\n");
  return { prompt, aliases, allowSlot2 };
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
  const kept = slots.filter((entry) => (owner || entry.slot !== 3) && aiNoteTextFailures(entry.slot, entry.text, null, { skipKind: true }).length === 0);
  let total = 0;
  const out: VisibleAiNoteSlot[] = [];
  for (const entry of [...kept].sort((left, right) => left.slot - right.slot)) {
    total += [...entry.text].length;
    if (total > AI_NOTE_TOTAL_MAX_CHARS || out.length >= 3) break;
    out.push(entry);
  }
  return out;
}
