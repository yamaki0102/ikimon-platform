import { haversineMeters } from "./locationPrivacy";
import { disclosePublicLocation, type LocationProtection } from "./recordPublicLocation";

export type TaxonTreeLevel = "major" | "group" | "species";
export type SkillDeclarationLevel = "expert" | "general" | "some" | "none";
export type IdentifyStatusWord = "AIの読み取り" | "人の提案" | "確認済み";
export type IdentifyDecisionKind = "identify" | "save" | "delegate" | "read" | "undetermined";

// Pending U1-U6 decisions (waiting for Makki confirmation — UI intentionally omitted).
export type PendingExpertRequirementStub = {
  readonly decisionPending: "U1_U6";
  readonly expertEligibilityResolved: false;
  readonly expertConfirmationUiEnabled: false;
};

export type TaxonNode = {
  key: string;
  labelJa: string;
  level: TaxonTreeLevel;
  parentKey: string | null;
  aliases: readonly string[];
};

export const TAXON_TREE: readonly TaxonNode[] = [
  { key: "bird", labelJa: "鳥", level: "major", parentKey: null, aliases: ["鳥", "鳥類", "bird", "birds", "aves"] },
  { key: "sparrow_family", labelJa: "スズメの仲間", level: "group", parentKey: "bird", aliases: ["スズメの仲間", "カエデチョウ", "passeridae"] },
  { key: "buncho", labelJa: "文鳥", level: "species", parentKey: "sparrow_family", aliases: ["文鳥", "ブンチョウ", "lonchura oryzivora", "padda oryzivora"] },
  { key: "suzume", labelJa: "スズメ", level: "species", parentKey: "sparrow_family", aliases: ["スズメ", "passer montanus"] },
  { key: "crow_family", labelJa: "カラスの仲間", level: "group", parentKey: "bird", aliases: ["カラスの仲間", "corvus"] },
  { key: "hashibuto", labelJa: "ハシブトガラス", level: "species", parentKey: "crow_family", aliases: ["ハシブトガラス", "corvus macrorhynchos"] },
  { key: "hashiboso", labelJa: "ハシボソガラス", level: "species", parentKey: "crow_family", aliases: ["ハシボソガラス", "corvus corone"] },
  { key: "waterbird_group", labelJa: "水辺の鳥", level: "group", parentKey: "bird", aliases: ["水辺の鳥", "サギ", "カワセミ"] },
  { key: "kawasemi", labelJa: "カワセミ", level: "species", parentKey: "waterbird_group", aliases: ["カワセミ", "alcedo atthis"] },
  { key: "aosagi", labelJa: "アオサギ", level: "species", parentKey: "waterbird_group", aliases: ["アオサギ", "ardea cinerea"] },

  { key: "cicada", labelJa: "セミの仲間", level: "major", parentKey: null, aliases: ["セミの仲間", "セミ", "cicada", "cicadidae"] },
  { key: "abura", labelJa: "アブラゼミ", level: "species", parentKey: "cicada", aliases: ["アブラゼミ", "graptopsaltria nigrofuscata"] },
  { key: "minmin", labelJa: "ミンミンゼミ", level: "species", parentKey: "cicada", aliases: ["ミンミンゼミ", "hyalessa maculaticollis"] },

  { key: "grass", labelJa: "草", level: "major", parentKey: null, aliases: ["草", "草本", "植物", "plant", "plantae"] },
  { key: "enokoro", labelJa: "エノコログサ", level: "species", parentKey: "grass", aliases: ["エノコログサ", "setaria viridis"] },

  { key: "amphibian", labelJa: "両生類", level: "major", parentKey: null, aliases: ["両生類", "カエル", "amphibia"] },
  { key: "frog_family", labelJa: "アカガエルの仲間", level: "group", parentKey: "amphibian", aliases: ["アカガエルの仲間", "ダルマガエル", "rana", "pelophylax"] },
  { key: "tokyo_daruma", labelJa: "トウキョウダルマガエル", level: "species", parentKey: "frog_family", aliases: ["トウキョウダルマガエル", "pelophylax porosus"] },
  { key: "kita_daruma", labelJa: "キタダルマガエル", level: "species", parentKey: "frog_family", aliases: ["キタダルマガエル"] },

  { key: "seaweed", labelJa: "海藻", level: "major", parentKey: null, aliases: ["海藻", "藻類", "algae", "seaweed"] },
  { key: "insect", labelJa: "昆虫", level: "major", parentKey: null, aliases: ["昆虫", "虫", "insecta", "insect"] },
] as const;

const NODE_BY_KEY = new Map<string, TaxonNode>(TAXON_TREE.map((n) => [n.key, n]));

export type IdentifySkillDeclaration = {
  taxonNodeKey: string;
  level: SkillDeclarationLevel;
  source: "declared" | "auto_grown" | "dismissed";
};

export function findTaxonNode(keyOrName: string | null | undefined): TaxonNode | null {
  const raw = String(keyOrName ?? "").trim();
  if (!raw) return null;
  const direct = NODE_BY_KEY.get(raw);
  if (direct) return direct;
  const norm = raw.normalize("NFKC").toLocaleLowerCase("en-US");
  for (const node of TAXON_TREE) {
    if (node.labelJa.normalize("NFKC").toLocaleLowerCase("en-US") === norm) return node;
    if (node.aliases.some((a) => a.normalize("NFKC").toLocaleLowerCase("en-US") === norm)) return node;
  }
  return null;
}

export function taxonNodeLabelWithParent(key: string): string {
  const node = NODE_BY_KEY.get(key);
  if (!node) return key;
  if (!node.parentKey) return node.labelJa;
  let root: TaxonNode | undefined = node;
  while (root.parentKey && NODE_BY_KEY.has(root.parentKey)) {
    root = NODE_BY_KEY.get(root.parentKey)!;
  }
  const unitWord = node.level === "species" ? "種類" : "仲間";
  return root.key === node.key ? node.labelJa : `${node.labelJa}（${root.labelJa}の中の${unitWord}）`;
}

/** Walk nearest node up to major ancestor; closest declared node wins (§1). */
export function resolveNodeSkillLevel(taxonKeyOrName: string, skills: readonly IdentifySkillDeclaration[]): SkillDeclarationLevel {
  const map = new Map<string, IdentifySkillDeclaration>();
  for (const s of skills) {
    if (s.source !== "dismissed") map.set(s.taxonNodeKey, s);
  }
  let cur: TaxonNode | null = findTaxonNode(taxonKeyOrName);
  const directRaw = map.get(taxonKeyOrName);
  if (!cur && directRaw) return directRaw.level;
  while (cur) {
    const hit = map.get(cur.key);
    if (hit) return hit.level;
    cur = cur.parentKey ? (NODE_BY_KEY.get(cur.parentKey) ?? null) : null;
  }
  return "none";
}

export function nodeDepth(nodeKey: string): number {
  const node = NODE_BY_KEY.get(nodeKey);
  if (!node) return 0;
  return node.level === "species" ? 2 : node.level === "group" ? 1 : 0;
}

export type IdentifyAiCandidate = {
  candidateKey: string;
  name: string;
  scientificName?: string | null;
  rank: "species" | "genus" | "family" | "order" | "class" | "lifeform" | "unknown";
  rankOrder: number;
  confidence: number;
  visualEvidence: string[];
};

export type IdentifyFeedCandidateInput = {
  observationId: string;
  observedAt: string;
  ownerDisplayName: string;
  aiMajorGroup: string;
  aiCandidates: IdentifyAiCandidate[];
  humanProposals: Array<{ proposedName: string; count: number; latestActorName?: string }>;
  statusWord: IdentifyStatusWord;
  openDisputeCount: number;
  hasInsufficientEvidence: boolean;
  holdState: "saved" | "delegated" | "read" | null;
  photoUrl?: string | null;
  photoCount?: number;
  locationText?: string;
  areaNote?: string | null;
  splitReasonTag?: "分類の変更" | null;
  splitProvenanceNote?: string | null;
};

export type RankedIdentifyFeedItem = {
  observation: IdentifyFeedCandidateInput;
  matchedNodeKey: string;
  matchedNodeLabel: string;
  matchedSkillTier: "fine" | "broad" | "some";
  isLowConfidenceCandidateMatch: boolean;
  priorityBucket: number;
};

function candidateMatchesSkillNode(candidate: IdentifyAiCandidate, skillKey: string): boolean {
  const candNode = findTaxonNode(candidate.candidateKey) ?? findTaxonNode(candidate.name) ?? findTaxonNode(candidate.scientificName);
  if (!candNode) return false;
  let cur: TaxonNode | null = candNode;
  while (cur) {
    if (cur.key === skillKey) return true;
    cur = cur.parentKey ? (NODE_BY_KEY.get(cur.parentKey) ?? null) : null;
  }
  return false;
}

function intraTierOrder(obs: IdentifyFeedCandidateInput): number {
  const topHumanCount = obs.humanProposals.reduce((m, p) => Math.max(m, p.count), 0);
  if (obs.openDisputeCount > 0) return 2; // Conflicting opinions / evidence needed
  if (topHumanCount >= 1) return 1; // Almost confirmed
  return 3; // Unnamed yet
}

/** Rank feed strictly according to user skills (§2, §3, §13). */
export function rankIdentifyFeedItems(
  items: readonly IdentifyFeedCandidateInput[],
  skills: readonly IdentifySkillDeclaration[],
): RankedIdentifyFeedItem[] {
  const activeSkills = skills.filter((s) => s.source !== "dismissed" && s.level !== "none");
  if (activeSkills.length === 0) return [];

  const ranked: RankedIdentifyFeedItem[] = [];
  for (const obs of items) {
    if (obs.holdState !== null || obs.statusWord === "確認済み") continue;
    const majorNode = findTaxonNode(obs.aiMajorGroup);
    const primaryCand = obs.aiCandidates[0] ?? null;

    // Closest explicit node on primary candidate or major group determines exclusion (`none`)
    const primaryResolvedLevel = primaryCand
      ? resolveNodeSkillLevel(primaryCand.candidateKey || primaryCand.name, skills)
      : majorNode
        ? resolveNodeSkillLevel(majorNode.key, skills)
        : "none";
    const majorResolvedLevel = majorNode ? resolveNodeSkillLevel(majorNode.key, skills) : "none";

    // Find best matching active skill across candidates (top-2 or lower rank >= 3) or major group
    let bestFine: { skill: IdentifySkillDeclaration; lowConf: boolean } | null = null;
    for (const s of activeSkills) {
      if (nodeDepth(s.taxonNodeKey) === 0 || (s.level !== "expert" && s.level !== "general")) continue;
      const candMatch = obs.aiCandidates.find((c) => candidateMatchesSkillNode(c, s.taxonNodeKey));
      if (!candMatch) continue;
      const explicitLevel = resolveNodeSkillLevel(candMatch.candidateKey || candMatch.name, skills);
      if (explicitLevel === "none") continue;
      const isLowConf = candMatch.rankOrder >= 3 || candMatch.confidence < 0.35;
      if (!bestFine || (!isLowConf && bestFine.lowConf) || nodeDepth(s.taxonNodeKey) > nodeDepth(bestFine.skill.taxonNodeKey)) {
        bestFine = { skill: s, lowConf: isLowConf };
      }
    }

    if (bestFine) {
      ranked.push({
        observation: obs,
        matchedNodeKey: bestFine.skill.taxonNodeKey,
        matchedNodeLabel: taxonNodeLabelWithParent(bestFine.skill.taxonNodeKey),
        matchedSkillTier: "fine",
        isLowConfidenceCandidateMatch: bestFine.lowConf,
        priorityBucket: bestFine.lowConf ? 2 : 1,
      });
      continue;
    }

    // If the top candidate itself is explicitly marked `流さない`, exclude unless another candidate matched fine skill
    if (primaryCand && primaryResolvedLevel === "none" && majorResolvedLevel === "none") continue;
    if (primaryCand && primaryResolvedLevel === "none") continue;

    // Broad major skill (`expert` / `general`) or `some`
    if (majorNode && (majorResolvedLevel === "expert" || majorResolvedLevel === "general")) {
      ranked.push({
        observation: obs,
        matchedNodeKey: majorNode.key,
        matchedNodeLabel: taxonNodeLabelWithParent(majorNode.key),
        matchedSkillTier: "broad",
        isLowConfidenceCandidateMatch: false,
        priorityBucket: 3,
      });
      continue;
    }

    if (majorNode && majorResolvedLevel === "some") {
      ranked.push({
        observation: obs,
        matchedNodeKey: majorNode.key,
        matchedNodeLabel: `${majorNode.labelJa}（わかるものもある）`,
        matchedSkillTier: "some",
        isLowConfidenceCandidateMatch: false,
        priorityBucket: 4,
      });
    }
  }

  return ranked.sort((a, b) => {
    if (a.priorityBucket !== b.priorityBucket) return a.priorityBucket - b.priorityBucket;
    const ordDiff = intraTierOrder(a.observation) - intraTierOrder(b.observation);
    if (ordDiff !== 0) return ordDiff;
    return b.observation.observedAt.localeCompare(a.observation.observedAt);
  });
}

export type ActivityCountByTaxon = {
  taxonKey: string;
  actionCount: number;
  confirmedCount: number;
};

export type AutoGrownSkillNote = {
  taxonNodeKey: string;
  label: string;
  reasonText: string;
  grantsAuthority: false; // Explicitly non-authoritative (§12)
};

export type PromotionSuggestion = {
  taxonNodeKey: string;
  label: string;
  confirmedCount: number;
};

/** §12/§13 Auto-grown fine skills & quiet promotion facts. Never grants authority. */
export function deriveAutoGrownSkills(
  activity: readonly ActivityCountByTaxon[],
  declared: readonly IdentifySkillDeclaration[],
  dismissedNodeKeys: readonly string[],
): {
  autoGrown: AutoGrownSkillNote[];
  promotionSuggestions: PromotionSuggestion[];
} {
  const declaredMap = new Map(declared.map((d) => [d.taxonNodeKey, d]));
  const dismissed = new Set(dismissedNodeKeys);
  const autoGrown: AutoGrownSkillNote[] = [];
  const promotionSuggestions: PromotionSuggestion[] = [];

  for (const row of activity) {
    const node = findTaxonNode(row.taxonKey);
    const key = node?.key ?? row.taxonKey;
    const label = node?.labelJa ?? row.taxonKey;
    const decl = declaredMap.get(key);

    if (!decl && !dismissed.has(key) && row.actionCount >= 3) {
      autoGrown.push({
        taxonNodeKey: key,
        label,
        reasonText: `あなたが${label}の記録に賛成してきたことから、${label}は自動で得意に入っています。`,
        grantsAuthority: false,
      });
    }

    if (decl && decl.level === "some" && row.confirmedCount >= 8) {
      promotionSuggestions.push({
        taxonNodeKey: key,
        label,
        confirmedCount: row.confirmedCount,
      });
    }
  }
  return { autoGrown, promotionSuggestions };
}

/** §16 Location display: Place + Municipality + Ward; blur/withholding always wins. */
export function formatIdentifyLocationDisplay(input: {
  placeName?: string | null;
  cityWardLabel?: string | null;
  publicAreaLabel?: string | null;
  publicCell?: string | null;
  observedAt: string;
  nowMs: number;
  protection?: LocationProtection;
  areaKind?: "point" | "area";
  specialAlertKind?: string | null;
  accuracyM?: number | null;
}): {
  text: string;
  areaNote: string | null;
  blurApplied: boolean;
} {
  const disclosure = disclosePublicLocation({
    publicCell: input.publicCell,
    observedAt: input.observedAt,
    nowMs: input.nowMs,
    protection: input.protection ?? "none",
  });

  const heavyBlur =
    disclosure.status === "withheld" ||
    disclosure.coarsenedByProtection ||
    Boolean(input.specialAlertKind) ||
    (input.accuracyM !== null && input.accuracyM !== undefined && input.accuracyM > 1500);

  if (heavyBlur) {
    const coarse = disclosure.status === "point" ? disclosure.radiusLabelJa : "地域非公開";
    return {
      text: `場所の保護により粗く表示しています（${coarse}）`,
      areaNote: input.specialAlertKind ? "この場所は配慮が必要なため詳しく出しません。" : "公開精度（ぼかし）の設定が優先されています。",
      blurApplied: true,
    };
  }

  const place = String(input.placeName ?? "").trim();
  const cityWard = String(input.cityWardLabel ?? "").trim();
  const fallbackArea = String(input.publicAreaLabel ?? "").trim();
  const baseLabel = place && cityWard ? `${place}（${cityWard}）` : place || cityWard || fallbackArea || "場所の情報なし";

  if (input.areaKind === "area") {
    return {
      text: `${baseLabel}の中で観察されました`,
      areaNote: "この記録は、点ではなくエリア（範囲）で示されています。場所の根拠は、この範囲までです。",
      blurApplied: false,
    };
  }

  return {
    text: baseLabel,
    areaNote: null,
    blurApplied: false,
  };
}

/** §17 Speech transcript cleanup: disfluency trimming + punctuation only. */
export function formatSpokenJustificationJa(rawTranscript: string): string {
  let text = String(rawTranscript ?? "")
    .normalize("NFKC")
    .replace(/[\r\n]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return "";
  text = text
    .replace(/(?:えー+と|あのー+|えっと|うーん|なんか)[、,\s]*/gu, "")
    .replace(/\s+/gu, " ")
    .replace(/^[、,.\s]+/u, "")
    .trim();
  if (!text) return "";
  if (!/[。．！？!?]$/u.test(text)) {
    text += "。";
  }
  return text;
}

export type RegionalSplitRule = {
  ruleId: string;
  ruleVersion: number;
  originalTaxon: string;
  newTaxon: string;
  broadenedTaxon: string;
  citationText: string;
  effectiveFrom: string;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
};

export type SplitTargetObservation = {
  observationId: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  isCoarseProtected: boolean;
  currentTaxon: string;
  statusWord: IdentifyStatusWord;
};

/** U8: Checker (matching scope) + Operator admin dual-approval required. */
export function canApproveSplitRule(input: { hasMatchingScopeReviewer: boolean; isOperatorAdmin: boolean }): boolean {
  return Boolean(input.hasMatchingScopeReviewer && input.isOperatorAdmin);
}

/** §19 + U7 Regional split evaluation. Never introduces a 4th status word. */
export function applyRegionalSplitToObservation(
  obs: SplitTargetObservation,
  rule: RegionalSplitRule,
): {
  outcome: "reassigned" | "widened_reconfirm" | "unchanged";
  nextTaxon: string;
  nextStatusWord: IdentifyStatusWord;
  reasonTag: "分類の変更" | null;
  provenanceTag: string | null;
} {
  if (obs.currentTaxon !== rule.originalTaxon) {
    return { outcome: "unchanged", nextTaxon: obs.currentTaxon, nextStatusWord: obs.statusWord, reasonTag: null, provenanceTag: null };
  }

  if (obs.isCoarseProtected || obs.lat === null || obs.lng === null || (obs.accuracyM ?? 0) > 1500) {
    return {
      outcome: "widened_reconfirm",
      nextTaxon: rule.broadenedTaxon,
      nextStatusWord: obs.statusWord === "確認済み" ? "人の提案" : obs.statusWord,
      reasonTag: "分類の変更",
      provenanceTag: `分類の改訂（位置保護のため広い単位・${rule.citationText}）`,
    };
  }

  const { minLat, maxLat, minLng, maxLng } = rule.bbox;
  const inside = obs.lat >= minLat && obs.lat <= maxLat && obs.lng >= minLng && obs.lng <= maxLng;
  const distToEdgeM = Math.min(
    haversineMeters(obs.lat, obs.lng, minLat, obs.lng),
    haversineMeters(obs.lat, obs.lng, maxLat, obs.lng),
    haversineMeters(obs.lat, obs.lng, obs.lat, minLng),
    haversineMeters(obs.lat, obs.lng, obs.lat, maxLng),
  );
  const uncertaintyM = Math.max(0, obs.accuracyM ?? 50);

  if (distToEdgeM <= uncertaintyM) {
    return {
      outcome: "widened_reconfirm",
      nextTaxon: rule.broadenedTaxon,
      nextStatusWord: obs.statusWord === "確認済み" ? "人の提案" : obs.statusWord,
      reasonTag: "分類の変更",
      provenanceTag: `分類の改訂（境界付近のため広い単位・${rule.citationText}）`,
    };
  }

  if (inside) {
    return {
      outcome: "reassigned",
      nextTaxon: rule.newTaxon,
      nextStatusWord: obs.statusWord,
      reasonTag: null,
      provenanceTag: `分類の改訂（地域による・${rule.citationText}）`,
    };
  }

  return { outcome: "unchanged", nextTaxon: obs.currentTaxon, nextStatusWord: obs.statusWord, reasonTag: null, provenanceTag: null };
}

/** U9: Recompute unit statistics for migrated records without counting as overturned. */
export function recomputeUnitStatsAfterSplit(
  countsByTaxon: Record<string, number>,
  _migratedTotal: number,
  input: {
    originalTaxon: string;
    newTaxon: string;
    migratedConfirmedCount: number;
    baselineOverturnedCount: number;
  },
): {
  countsByTaxon: Record<string, number>;
  overturnedCount: number;
} {
  const next = { ...countsByTaxon };
  const moved = Math.max(0, Math.min(input.migratedConfirmedCount, next[input.originalTaxon] ?? 0));
  next[input.originalTaxon] = Math.max(0, (next[input.originalTaxon] ?? 0) - moved);
  next[input.newTaxon] = (next[input.newTaxon] ?? 0) + moved;
  return {
    countsByTaxon: next,
    overturnedCount: input.baselineOverturnedCount,
  };
}
