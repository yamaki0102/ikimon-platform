import type { Env } from "./core/env";
import { ZUKAN_SHELL_CSS, ZUKAN_SHELL_ICONS, renderZukanChrome } from "./zukanShellChrome";
import {
  TAXON_TREE,
  computeVoterOverturnRate,
  deriveAutoGrownSkills,
  evaluateConfirmationRules,
  findTaxonNode,
  formatIdentifyLocationDisplay,
  formatSpokenJustificationJa,
  rankIdentifyFeedItems,
  resolveNodeSkillLevel,
  taxonNodeLabelWithParent,
  validateStructuredJustification,
  canApproveSplitRule,
  type ConfirmationObjectionInput,
  type ConfirmationVoteInput,
  type IdentifyAiCandidate,
  type IdentifyDecisionKind,
  type IdentifyFeedCandidateInput,
  type IdentifySkillDeclaration,
  type IdentifyStatusWord,
  type RankedIdentifyFeedItem,
  type SkillDeclarationLevel,
} from "./identifyV3Domain";

type Lang = "ja" | "en" | "es" | "pt-br";
export type IdentifyV3View = "feed" | "skills" | "saved";

export type IdentifyV3Session = {
  userId: string;
  displayName: string;
  roleName: string;
  banned: boolean;
};

export type IdentifyV3SavedItem = {
  occurrenceId: string;
  photoUrl: string | null;
  currentTitle: string;
  statusWord: IdentifyStatusWord;
  ownerDisplayName: string;
  locationText: string;
  observedDateLabel: string;
  savedCandidateName: string | null;
  savedAtLabel: string;
  settledByActorName: string | null;
  settledReason: string | null;
  savedAtIso: string;
  settledAtIso: string | null;
  taxonNodeKey: string;
  stateSummary: string;
};

export type IdentifyV3WorkspaceData = {
  view: IdentifyV3View;
  lang: Lang;
  displayName: string;
  skills: IdentifySkillDeclaration[];
  autoGrown: Array<{ taxonNodeKey: string; label: string; reasonText: string; grantsAuthority: false }>;
  promotionSuggestions: Array<{ taxonNodeKey: string; label: string; confirmedCount: number }>;
  confirmedCountsByNode: Record<string, number>;
  feedItems: RankedIdentifyFeedItem[];
  savedItems: IdentifyV3SavedItem[];
  settledSavedItems: IdentifyV3SavedItem[];
  savedCount: number;
  nextCursor: string | null;
  cspNonce?: string;
};

const FEED_PAGE_SIZE = 10;
const SETTLED_VISIBLE_MS = 30 * 24 * 60 * 60 * 1000;

const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const svgIcon = (d: string, extra = ""): string =>
  `<svg class="id3-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"${extra}>${d}</svg>`;

const ICONS = {
  back: svgIcon('<path d="m14.5 5.5-6 6.5 6 6.5"/>'),
  check: svgIcon('<path d="M20 6 9 17l-5-5"/>'),
  bookmark: svgIcon('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  eye: svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  users: svgIcon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  photoHelp: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  mic: svgIcon('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/>'),
  search: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  undo: svgIcon('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  chevRight: svgIcon('<path d="M9 18l6-6-6-6"/>'),
  chevDown: svgIcon('<path d="m6 9 6 6 6-6"/>'),
  swap: svgIcon('<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>'),
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function jstMonthDayTimeLabel(iso: string, en = false): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  if (en) return `${MONTHS_EN[jst.getUTCMonth()]} ${jst.getUTCDate()}, ${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
  return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

function jstMonthDayLabel(iso: string, en = false): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  if (en) return `${MONTHS_EN[jst.getUTCMonth()]} ${jst.getUTCDate()}`;
  return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`;
}

function normalizePhotoUrl(key: string | null, observationId: string): string | null {
  if (!key) return null;
  if (key.startsWith("/") || key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("derived/")) return `/derived-transform/w360/${key}`;
  return `/media/${encodeURIComponent(observationId)}`;
}

function parseCandidatesJson(rawPayload: string | null, fallbackName: string | null, fallbackSci: string | null): { majorGroup: string; candidates: IdentifyAiCandidate[] } {
  let majorGroup = "bird";
  const candidates: IdentifyAiCandidate[] = [];
  if (rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
      if (typeof parsed.majorGroup === "string" && parsed.majorGroup.trim()) {
        majorGroup = parsed.majorGroup.trim();
      }
      if (Array.isArray(parsed.candidates)) {
        parsed.candidates.forEach((c, idx) => {
          if (!c || typeof c !== "object") return;
          const rec = c as Record<string, unknown>;
          const name = String(rec.name ?? rec.vernacularName ?? "").trim();
          if (!name) return;
          const node = findTaxonNode(String(rec.candidateKey ?? "")) ?? findTaxonNode(name);
          candidates.push({
            candidateKey: String(rec.candidateKey ?? node?.key ?? name),
            name,
            scientificName: typeof rec.scientificName === "string" ? rec.scientificName : null,
            rank: (typeof rec.rank === "string" ? rec.rank : "species") as IdentifyAiCandidate["rank"],
            rankOrder: Number(rec.rankOrder ?? idx + 1) || idx + 1,
            confidence: Number(rec.confidence ?? (idx === 0 ? 0.85 : 0.35)),
            visualEvidence: Array.isArray(rec.visualEvidence) ? rec.visualEvidence.map((v) => String(v)) : [],
          });
        });
      }
    } catch {
      // Ignore malformed legacy payload JSON cleanly
    }
  }
  if (candidates.length === 0 && fallbackName) {
    const node = findTaxonNode(fallbackName);
    candidates.push({
      candidateKey: node?.key ?? fallbackName,
      name: fallbackName,
      scientificName: fallbackSci,
      rank: "species",
      rankOrder: 1,
      confidence: 0.7,
      visualEvidence: [],
    });
  }
  return { majorGroup, candidates };
}

function computeStatusFromVotes(
  humanVotes: Array<{ actorUserId: string; proposedName: string; actorName?: string }>,
  openDisputeCount: number,
  hasAi: boolean,
  en = false,
): { statusWord: IdentifyStatusWord; summaryText: string; agreedName: string | null } {
  if (humanVotes.length === 0) {
    return {
      statusWord: "AIの読み取り",
      summaryText: en ? (hasAi ? "No one else has agreed yet" : "No clues to a name yet") : (hasAi ? "まだ、ほかの人の賛成はありません" : "まだ名前の手がかりがありません"),
      agreedName: null,
    };
  }
  const counts = new Map<string, { count: number; actors: Set<string>; latestName?: string }>();
  for (const v of humanVotes) {
    const cur = counts.get(v.proposedName) ?? { count: 0, actors: new Set<string>() };
    cur.actors.add(v.actorUserId);
    cur.count = cur.actors.size;
    cur.latestName = v.actorName ?? cur.latestName;
    counts.set(v.proposedName, cur);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  const top = sorted[0]!;
  const distinctTotal = new Set(humanVotes.map((v) => v.actorUserId)).size;
  // D1-D6: confirmed requires >=2 distinct voters, >=2/3 agreement, and 0 open disputes
  if (distinctTotal >= 2 && top[1].count * 3 >= distinctTotal * 2 && openDisputeCount === 0) {
    return {
      statusWord: "確認済み",
      summaryText: en ? `Confirmed as ${top[0]}` : `${top[0]}で、確認済みになりました`,
      agreedName: top[0],
    };
  }
  if (openDisputeCount > 0) {
    return {
      statusWord: "人の提案",
      summaryText: en ? `${openDisputeCount} open ${openDisputeCount === 1 ? "question" : "questions"} about the evidence or other candidates` : `証拠の確認や別候補の意見が${openDisputeCount}件あります`,
      agreedName: top[0],
    };
  }
  return {
    statusWord: "人の提案",
    summaryText: en ? `${top[1].count} ${top[1].count === 1 ? "person agrees" : "people agree"} on ${top[0]}. ${Math.max(1, 2 - top[1].count)} more to confirm` : `${top[0]}に賛成${top[1].count}人。あと${Math.max(1, 2 - top[1].count)}人の賛成で、確認済みになります`,
    agreedName: top[0],
  };
}

export async function loadIdentifyV3WorkspaceData(
  env: Env,
  userId: string,
  options: { view?: IdentifyV3View; lang?: Lang; displayName?: string; cursor?: string | null; q?: string | null; cspNonce?: string } = {},
): Promise<IdentifyV3WorkspaceData> {
  const view: IdentifyV3View = options.view ?? "feed";
  const lang: Lang = options.lang ?? "ja";
  const displayName = options.displayName ?? (lang === "ja" ? "メンバー" : "Member");
  const en = lang !== "ja";
  const offset = Math.max(0, Number(options.cursor ?? 0) || 0);

  // 1. Load user skills & dismissals from CORE_DB user_saved_items (`identify_v3_skill`)
  const skillRows = await env.CORE_DB.prepare(
    `SELECT object_id, display_title, state
       FROM user_saved_items
      WHERE user_id = ? AND object_kind = 'identify_v3_skill'`
  ).bind(userId).all<{ object_id: string; display_title: string; state: string }>().catch(() => ({ results: [] }));

  const skills: IdentifySkillDeclaration[] = [];
  const dismissedKeys: string[] = [];
  for (const row of skillRows.results) {
    let parsed: { level?: SkillDeclarationLevel; source?: "declared" | "auto_grown" | "dismissed" } = {};
    try {
      parsed = JSON.parse(row.display_title) as typeof parsed;
    } catch {}
    if (row.state === "removed" || parsed.source === "dismissed") {
      dismissedKeys.push(row.object_id);
      continue;
    }
    const level: SkillDeclarationLevel = parsed.level && ["expert", "general", "some", "none"].includes(parsed.level) ? parsed.level : "general";
    skills.push({ taxonNodeKey: row.object_id, level, source: parsed.source ?? "declared" });
  }

  // 2. Load user's activity stats in OBS_DB for §12 auto-growth and confirmed factual counts
  const myIdRows = await env.OBS_DB.prepare(
    `SELECT proposed_name, COUNT(*) AS action_count
       FROM observation_identifications
      WHERE actor_user_id = ? AND is_current = 1
      GROUP BY proposed_name`
  ).bind(userId).all<{ proposed_name: string; action_count: number }>().catch(() => ({ results: [] }));

  const confirmedCountsByNode: Record<string, number> = {};
  const activity = myIdRows.results.map((r) => {
    const node = findTaxonNode(r.proposed_name);
    const key = node?.key ?? r.proposed_name;
    const confirmedApprox = Number(r.action_count ?? 0);
    confirmedCountsByNode[key] = (confirmedCountsByNode[key] ?? 0) + confirmedApprox;
    if (node?.parentKey) {
      confirmedCountsByNode[node.parentKey] = (confirmedCountsByNode[node.parentKey] ?? 0) + confirmedApprox;
    }
    return { taxonKey: key, actionCount: Number(r.action_count ?? 0), confirmedCount: confirmedApprox };
  });

  const { autoGrown, promotionSuggestions } = deriveAutoGrownSkills(activity, skills, dismissedKeys);

  // 3. Load candidate observations + AI targets + holds + votes + disputes
  const obsRows = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.owner_user_id, o.observed_at, o.taxon_label, o.exact_lat, o.exact_lng, o.location_accuracy_m,
            o.public_cell, o.public_area_label,
            (SELECT a.public_derivative_key FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' ORDER BY a.uploaded_at DESC LIMIT 1) AS derivative_key,
            (SELECT COUNT(*) FROM asset_ledger a2 WHERE a2.observation_id = o.observation_id) AS photo_count,
            ai.vernacular_name AS ai_vernacular, ai.scientific_name AS ai_scientific, ai.ai_recommended_taxon_name, ai.source_payload_json AS ai_payload
       FROM observations o
       LEFT JOIN observation_ai_review_targets ai ON ai.occurrence_id = o.observation_id
      WHERE o.visibility = 'public' AND COALESCE(o.emergency_hidden, 0) = 0
      ORDER BY o.observed_at DESC
      LIMIT 80`
  ).bind().all<{
    observation_id: string;
    owner_user_id: string;
    observed_at: string;
    taxon_label: string | null;
    exact_lat: number | null;
    exact_lng: number | null;
    location_accuracy_m: number | null;
    public_cell: string | null;
    public_area_label: string | null;
    derivative_key: string | null;
    photo_count: number | null;
    ai_vernacular: string | null;
    ai_scientific: string | null;
    ai_recommended_taxon_name: string | null;
    ai_payload: string | null;
  }>().catch(() => ({ results: [] }));

  const holdRows = await env.OBS_DB.prepare(
    `SELECT occurrence_id, hold_reason, source_payload_json, updated_at
       FROM observation_identification_workbench_holds
      WHERE actor_user_id = ?`
  ).bind(userId).all<{ occurrence_id: string; hold_reason: string; source_payload_json: string; updated_at: string }>().catch(() => ({ results: [] }));

  const holdByOcc = new Map(holdRows.results.map((h) => [h.occurrence_id, h]));

  const occIds = obsRows.results.map((r) => r.observation_id);
  const votesByOcc = new Map<string, Array<{ actorUserId: string; proposedName: string; actorName?: string }>>();
  const lastVoteAtByOcc = new Map<string, string>();
  const disputesByOcc = new Map<string, { openCount: number; hasInsufficientEvidence: boolean }>();

  if (occIds.length > 0) {
    const placeholders = occIds.map(() => "?").join(",");
    const voteRows = await env.OBS_DB.prepare(
      `SELECT occurrence_id, actor_user_id, proposed_name, updated_at
         FROM observation_identifications
        WHERE occurrence_id IN (${placeholders}) AND is_current = 1`
    ).bind(...occIds).all<{ occurrence_id: string; actor_user_id: string; proposed_name: string; updated_at: string | null }>().catch(() => ({ results: [] }));
    for (const v of voteRows.results) {
      const list = votesByOcc.get(v.occurrence_id) ?? [];
      list.push({ actorUserId: v.actor_user_id, proposedName: v.proposed_name });
      votesByOcc.set(v.occurrence_id, list);
      if (v.updated_at && v.updated_at > (lastVoteAtByOcc.get(v.occurrence_id) ?? "")) lastVoteAtByOcc.set(v.occurrence_id, v.updated_at);
    }

    const dispRows = await env.OBS_DB.prepare(
      `SELECT occurrence_id, kind, status
         FROM observation_identification_disputes
        WHERE occurrence_id IN (${placeholders}) AND status = 'open'`
    ).bind(...occIds).all<{ occurrence_id: string; kind: string; status: string }>().catch(() => ({ results: [] }));
    for (const d of dispRows.results) {
      const cur = disputesByOcc.get(d.occurrence_id) ?? { openCount: 0, hasInsufficientEvidence: false };
      cur.openCount += 1;
      if (d.kind === "insufficient_evidence") cur.hasInsufficientEvidence = true;
      disputesByOcc.set(d.occurrence_id, cur);
    }
  }

  const userAuthorities = await env.OBS_DB.prepare(
    `SELECT scope_taxon_name, scope_taxon_key
       FROM specialist_authorities
      WHERE subject_user_id = ? AND status = 'active' AND authority_kind = 'taxon_identification'`
  ).bind(userId).all<{ scope_taxon_name: string; scope_taxon_key: string | null }>().catch(() => ({ results: [] }));

  const hasAuthorityForTaxon = (names: Array<string | null | undefined>): boolean => {
    const candidateTerms = new Set<string>();
    for (const raw of names) {
      const val = String(raw ?? "").trim().toLowerCase();
      if (!val) continue;
      candidateTerms.add(val);
      let node = findTaxonNode(val);
      while (node) {
        candidateTerms.add(node.key.toLowerCase());
        candidateTerms.add(node.labelJa.toLowerCase());
        node = node.parentKey ? findTaxonNode(node.parentKey) : null;
      }
    }
    return userAuthorities.results.some((auth) => {
      const sName = String(auth.scope_taxon_name ?? "").trim().toLowerCase();
      const sKey = String(auth.scope_taxon_key ?? "").trim().toLowerCase();
      return (sName && candidateTerms.has(sName)) || (sKey && candidateTerms.has(sKey));
    });
  };

  const nowMs = Date.now();
  const candidates: IdentifyFeedCandidateInput[] = [];
  const savedItems: IdentifyV3SavedItem[] = [];
  const settledSavedItems: IdentifyV3SavedItem[] = [];

  for (const row of obsRows.results) {
    const hold = holdByOcc.get(row.observation_id);
    const holdReason = hold?.hold_reason ?? null;
    const holdState: IdentifyFeedCandidateInput["holdState"] =
      holdReason === "saved" || holdReason === "delegated" || holdReason === "read" ? holdReason : null;

    const { majorGroup, candidates: aiCandidates } = parseCandidatesJson(
      row.ai_payload,
      row.ai_recommended_taxon_name ?? row.ai_vernacular ?? row.taxon_label,
      row.ai_scientific,
    );
    const votes = votesByOcc.get(row.observation_id) ?? [];
    const disp = disputesByOcc.get(row.observation_id) ?? { openCount: 0, hasInsufficientEvidence: false };
    const consensus = computeStatusFromVotes(votes, disp.openCount, aiCandidates.length > 0, en);
    const primaryTaxonLabel = aiCandidates[0]?.name ?? row.taxon_label ?? majorGroup;
    const evalRes = evaluateConfirmationRules({
      targetTaxon: primaryTaxonLabel,
      targetRank: aiCandidates[0]?.rank ?? "species",
      observedAt: row.observed_at,
      nowMs,
      votes: votes.map((v) => ({
        actorUserId: v.actorUserId,
        proposedName: v.proposedName,
        activeDays: 30,
        overturnRate: computeVoterOverturnRate([]),
        hasScopedAuthority: false,
      })),
      objections: disp.openCount > 0 ? [{ actorUserId: "dispute", structuredJustification: { traits: ["異議"], photoPart: "全体の姿", visibility: "見える" } }] : [],
      lat: row.exact_lat,
      lng: row.exact_lng,
    });
    const canConfirmScoped = hasAuthorityForTaxon([primaryTaxonLabel, majorGroup, row.ai_scientific]);
    const loc = formatIdentifyLocationDisplay({
      publicAreaLabel: row.public_area_label,
      publicCell: row.public_cell,
      observedAt: row.observed_at,
      nowMs,
      accuracyM: row.location_accuracy_m,
    });
    const photoUrl = normalizePhotoUrl(row.derivative_key, row.observation_id);

    const groupedCounts = new Map<string, number>();
    for (const v of votes) groupedCounts.set(v.proposedName, (groupedCounts.get(v.proposedName) ?? 0) + 1);
    const humanProposals = [...groupedCounts.entries()].map(([proposedName, count]) => ({ proposedName, count }));

    const itemInput: IdentifyFeedCandidateInput = {
      observationId: row.observation_id,
      observedAt: row.observed_at,
      ownerDisplayName: en ? "Recorder" : "記録者",
      aiMajorGroup: majorGroup,
      aiCandidates,
      humanProposals,
      statusWord: consensus.statusWord,
      openDisputeCount: disp.openCount,
      hasInsufficientEvidence: disp.hasInsufficientEvidence,
      holdState,
      photoUrl,
      photoCount: Math.max(1, Number(row.photo_count ?? 1)),
      locationText: loc.text,
      areaNote: loc.areaNote,
      canConfirmScoped,
      confirmedWithObjection: evalRes.confirmedWithObjection,
      tier3ExportAllowed: evalRes.tier3ExportAllowed,
      needsInquiry: evalRes.needsInquiry,
      outlierReasons: evalRes.outlierReasons,
      escalatedOneRankUp: evalRes.escalatedOneRankUp,
    };

    if (holdReason === "saved" && hold) {
      let holdMeta: { savedCandidateName?: string; savedAt?: string; settledDismissed?: boolean } = {};
      try {
        holdMeta = JSON.parse(hold.source_payload_json) as typeof holdMeta;
      } catch {}
      const topName = consensus.agreedName ?? aiCandidates[0]?.name ?? row.taxon_label ?? (en ? "Name not decided yet" : "名前はまだ決まっていません");
      const node = findTaxonNode(topName) ?? findTaxonNode(majorGroup);
      const savedCard: IdentifyV3SavedItem = {
        occurrenceId: row.observation_id,
        photoUrl,
        currentTitle: consensus.statusWord === "AIの読み取り" ? (en ? `${topName} (AI reading)` : `${topName}（AIの読み取り）`) : topName,
        statusWord: consensus.statusWord,
        ownerDisplayName: en ? "Recorder" : "記録者",
        locationText: loc.text,
        observedDateLabel: jstMonthDayLabel(row.observed_at, en),
        savedCandidateName: holdMeta.savedCandidateName ?? aiCandidates[0]?.name ?? null,
        savedAtLabel: jstMonthDayLabel(holdMeta.savedAt ?? hold.updated_at, en),
        settledByActorName: null,
        savedAtIso: holdMeta.savedAt ?? hold.updated_at,
        settledAtIso: consensus.statusWord === "確認済み" ? (lastVoteAtByOcc.get(row.observation_id) ?? null) : null,
        settledReason: consensus.statusWord === "確認済み" ? (en ? "Settled by another person's proposal with evidence." : "ほかの人の根拠つきの提案で決まりました。") : null,
        taxonNodeKey: node?.key ?? majorGroup,
        stateSummary: consensus.summaryText,
      };
      if (consensus.statusWord === "確認済み") {
        const settledMs = savedCard.settledAtIso ? Date.parse(savedCard.settledAtIso.includes("T") ? savedCard.settledAtIso : `${savedCard.settledAtIso.replace(" ", "T")}Z`) : NaN;
        const expired = Number.isFinite(settledMs) && nowMs - settledMs > SETTLED_VISIBLE_MS;
        if (!holdMeta.settledDismissed && !expired) settledSavedItems.push(savedCard);
      } else {
        savedItems.push(savedCard);
      }
      continue;
    }

    candidates.push(itemInput);
  }

  // §14 Saved list automatic priority: most active taxa first
  savedItems.sort((a, b) => {
    const freqA = confirmedCountsByNode[a.taxonNodeKey] ?? 0;
    const freqB = confirmedCountsByNode[b.taxonNodeKey] ?? 0;
    if (freqA !== freqB) return freqB - freqA;
    return b.savedAtIso.localeCompare(a.savedAtIso);
  });

  const effectiveSkills: IdentifySkillDeclaration[] = skills.length > 0 ? skills : autoGrown.map((g) => ({ taxonNodeKey: g.taxonNodeKey, level: "general" as const, source: "auto_grown" as const }));
  const rankedAll = rankIdentifyFeedItems(candidates, effectiveSkills);
  const pageItems = rankedAll.slice(offset, offset + FEED_PAGE_SIZE);
  const nextCursor = offset + FEED_PAGE_SIZE < rankedAll.length ? String(offset + FEED_PAGE_SIZE) : null;

  return {
    view,
    lang,
    displayName,
    skills,
    autoGrown,
    promotionSuggestions,
    confirmedCountsByNode,
    feedItems: pageItems,
    savedItems,
    settledSavedItems,
    savedCount: savedItems.length,
    nextCursor,
    cspNonce: options.cspNonce,
  };
}

const IDENTIFY_V3_CSS = `
${ZUKAN_SHELL_CSS}
.id3-wrap{max-width:740px;margin:0 auto;padding:8px 18px 220px}
@media(min-width:960px){.id3-wrap{max-width:1080px;padding:12px 28px 64px}}
.id3-topbar{display:flex;align-items:center;gap:6px;padding:12px 14px 8px;border-bottom:1px solid #eef1ee}
.id3-topbar .id3-back{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;color:#17211b;text-decoration:none;border-radius:12px}
.id3-topbar .id3-tt{flex:1;font-size:17px;font-weight:800;text-align:center}
.id3-topbar .id3-sp{width:44px;flex:none}
.id3-ic{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
.id3-mychips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.id3-chip{display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;border-radius:999px;padding:7px 14px;background:#e9f0eb;color:#143f2e;text-decoration:none;min-height:44px}
.id3-chip.sub{background:#f7f7f3;color:#454f47}
.id3-lead{font-size:14.5px;line-height:1.7;color:#3c4a41;margin-top:10px}
.id3-note{background:#f7f7f3;border-radius:12px;padding:13px 15px;font-size:14px;line-height:1.7;color:#454f47;margin-top:14px}
.id3-strips{margin-top:10px;display:grid;gap:2px}
.id3-strip{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #eef1ee}
.id3-strip img{width:40px;height:40px;border-radius:9px;object-fit:cover;flex:none;background:#eff3ee}
.id3-strip .id3-st{flex:1;font-size:13.5px;font-weight:600;color:#3c4a41}
.id3-strip .id3-undo{display:inline-flex;align-items:center;gap:4px;font-size:13.5px;font-weight:700;color:#0055ad;background:none;border:0;padding:8px 10px;min-height:44px;cursor:pointer}
.id3-feed{display:grid;gap:26px;margin-top:16px}
.id3-card{padding-top:16px;border-top:8px solid #f7f7f3;transition:opacity 240ms ease,transform 240ms ease}
.id3-card.is-collapsing{opacity:0;transform:scale(.98)}
.id3-card.is-collapsed{display:none}
.id3-ghead{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
.id3-ghead h2{margin:0;font-size:17px;font-weight:800;color:#17211b}
.id3-classband{display:flex;align-items:center;gap:8px;background:#f7f7f3;border-radius:12px;padding:10px 14px;margin-top:6px;font-size:14px;color:#454f47}
.id3-photo{margin-top:12px}
.id3-photo img{width:100%;height:300px;object-fit:cover;border-radius:12px;display:block;background:#eff3ee}
@media(min-width:960px){.id3-photo img{height:380px}}
.id3-sumline{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:14px;line-height:1.6;color:#3c4a41;flex-wrap:wrap}
.id3-gwhy{font-size:13.5px;color:#55615a;line-height:1.6;margin-top:4px}
.id3-fcand{border:1.5px solid #dde2dc;border-radius:14px;padding:13px 15px;margin-top:10px;background:#fff}
.id3-fcand-row{display:flex;align-items:center;gap:10px}
.id3-fname{font-size:17.5px;font-weight:800;line-height:1.3}
.id3-fsci{font-size:12.5px;color:#68746c;font-style:italic}
.id3-agree{margin-left:auto;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14.5px;font-weight:700;border-radius:999px;padding:10px 16px;min-height:44px;border:1.5px solid #143f2e;color:#143f2e;background:#fff;cursor:pointer}
.id3-agree.main{background:#143f2e;color:#fff}
.id3-fdiff{font-size:14px;line-height:1.6;color:#26332a;margin-top:8px}
.id3-ffrom{font-size:13px;color:#68746c;margin-top:4px}
.id3-vrow{display:flex;align-items:center;gap:9px;margin-top:10px;border:1.5px dashed #b9c4ba;border-radius:12px;padding:10px 14px;font-size:14.5px;font-weight:700;color:#143f2e;background:#fff;width:100%;min-height:46px;cursor:pointer;text-align:left}
.id3-vrow .id3-vs{margin-left:auto;font-size:12.5px;color:#68746c;font-weight:600}
.id3-voicebox{margin-top:10px;border:1.5px solid #68746c;border-radius:12px;padding:12px;background:#fff;display:grid;gap:10px}
.id3-voicebox[hidden]{display:none}
.id3-voicebox textarea{width:100%;min-height:76px;border:1px solid #dde2dc;border-radius:10px;padding:10px;font:inherit;font-size:14.5px}
.id3-partchips{display:flex;gap:8px;flex-wrap:wrap}
.id3-partchip{font-size:13px;font-weight:700;border:1.5px solid #dde2dc;color:#454f47;border-radius:999px;padding:7px 14px;min-height:38px;background:#fff;cursor:pointer}
.id3-partchip.on{background:#143f2e;border-color:#143f2e;color:#fff}
.id3-blockend{display:flex;gap:6px;margin-top:14px;padding-top:8px;border-top:1px solid #eef1ee}
.id3-be{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13.5px;font-weight:700;color:#55615a;padding:10px 6px;min-height:44px;background:none;border:0;cursor:pointer}
.id3-decbar{position:fixed;left:0;right:0;bottom:76px;z-index:41;background:rgba(255,255,255,.98);border-top:1px solid #e4e9e4;box-shadow:0 -2px 10px rgba(9,25,16,.07);display:flex;align-items:center;gap:10px;padding:10px 14px;transition:opacity 120ms ease}
.id3-decbar.is-scrolling{opacity:.55;pointer-events:none}
@media(min-width:960px){.id3-decbar{display:none}}
.id3-decbar img{width:38px;height:38px;border-radius:9px;object-fit:cover;flex:none;background:#eff3ee}
.id3-dpill{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;background:#143f2e;color:#fff;font-size:15px;font-weight:800;border-radius:999px;min-height:48px;border:0;padding:0 14px;cursor:pointer}
.id3-dmini{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:12px;font-weight:700;color:#454f47;min-width:44px;min-height:44px;background:none;border:0;cursor:pointer}
.id3-skill{padding:14px 0;border-bottom:1px solid #eef1ee}
.id3-sname{font-size:16.5px;font-weight:800}
.id3-sfact{font-size:13.5px;color:#55615a;margin-top:4px}
.id3-opts4{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.id3-opt{text-align:center;font-size:14px;font-weight:700;border:1.5px solid #dde2dc;color:#55615a;border-radius:999px;padding:10px 6px;min-height:44px;background:#fff;cursor:pointer}
.id3-opt.on{background:#143f2e;border-color:#143f2e;color:#fff}
.id3-fine{margin-left:14px;border-left:3px solid #e3eae4;padding-left:12px;margin-top:8px}
.id3-grown{background:#e9f0eb;border-radius:12px;padding:13px 15px;margin-top:12px}
.id3-suggest{background:#f7f7f3;border-radius:12px;padding:13px 15px;margin-top:12px}
.id3-btn-main{display:flex;align-items:center;justify-content:center;width:100%;background:#143f2e;color:#fff;font-size:16px;font-weight:800;border-radius:999px;min-height:52px;border:0;margin-top:18px;cursor:pointer}
.id3-row{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eef1ee;align-items:center;text-decoration:none;color:inherit}
.id3-row img{width:62px;height:62px;border-radius:12px;object-fit:cover;flex:none;background:#eff3ee}
.id3-tag-reason{display:inline-flex;align-items:center;background:#fdf3e7;color:#8a4b00;font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px}
.id3-expert{background:#e9f0eb;border-radius:14px;padding:15px 16px;margin-top:14px}
.id3-expert .id3-et{font-size:15px;font-weight:800;color:#143f2e;line-height:1.5}
.id3-expert .id3-eb{font-size:14px;line-height:1.65;color:#26332a;margin-top:4px}
.id3-expert .id3-ebtn{display:flex;align-items:center;justify-content:center;width:100%;border:1.5px solid #143f2e;color:#143f2e;font-size:15px;font-weight:700;border-radius:12px;min-height:48px;background:#fff;margin-top:10px;cursor:pointer}
`;

export function renderFeedCardsHtml(items: readonly RankedIdentifyFeedItem[], lang: Lang = "ja"): string {
  const en = lang !== "ja";
  const t = (ja: string, e: string): string => (en ? e : ja);
  return items
    .map((ranked, index) => {
      const obs = ranked.observation;
      const topCand = obs.aiCandidates[0] ?? null;
      const topCandName = topCand?.name ?? t("この生きもの", "this species");
      const thumbAttr = obs.photoUrl ? esc(obs.photoUrl) : "";
      const cardsHtml = obs.aiCandidates
        .slice(0, 3)
        .map((cand, cIdx) => {
          const isMain = cIdx === 0;
          const evText = cand.visualEvidence[0] ? `${t("見分ける点：", "Key feature: ")}${esc(cand.visualEvidence[0])}` : "";
          const prop = obs.humanProposals.find((p) => p.proposedName === cand.name);
          const fromText = prop
            ? (en ? `AI reading · <b>${prop.count} ${prop.count === 1 ? "person agrees" : "people agree"}</b>` : `AIの読み取り ・ <b>${prop.count}人が賛成しています</b>`)
            : cand.rankOrder >= 2
              ? (en ? `AI reading (candidate #${cand.rankOrder})` : `AIの読み取り（${cand.rankOrder}番目の候補）`)
              : t("AIの読み取り", "AI reading");
          return `<div class="id3-fcand">
            <div class="id3-fcand-row">
              <div><div class="id3-fname">${esc(cand.name)}</div>${cand.scientificName ? `<div class="id3-fsci">${esc(cand.scientificName)}</div>` : ""}</div>
              <button type="button" class="id3-agree${isMain ? " main" : ""}" data-id3-agree="${esc(obs.observationId)}" data-candidate-name="${esc(cand.name)}" data-candidate-rank="${esc(cand.rank)}">${isMain ? ICONS.check : ""}${t("賛成する", "Agree")}</button>
            </div>
            ${evText ? `<div class="id3-fdiff">${evText}</div>` : ""}
            <div class="id3-ffrom">${fromText}</div>
          </div>`;
        })
        .join("");

      const statusLabel = obs.confirmedWithObjection
        ? t("確認済み（異議あり）・研究公開停止中", "Confirmed (with objection) · research sharing paused")
        : obs.humanProposals.length > 0
          ? (en ? `${obs.humanProposals[0]!.count} ${obs.humanProposals[0]!.count === 1 ? "person agrees" : "people agree"} on ${esc(obs.humanProposals[0]!.proposedName)}. ${Math.max(1, 2 - obs.humanProposals[0]!.count)} more to confirm` : `${esc(obs.humanProposals[0]!.proposedName)}に賛成${obs.humanProposals[0]!.count}人。あと${Math.max(1, 2 - obs.humanProposals[0]!.count)}人の賛成で、確認済みになります`)
          : t("まだ、ほかの人の賛成はありません", "No one else has agreed yet");

      const badgeHtml = [
        obs.splitReasonTag ? `<span class="id3-tag-reason">${esc(obs.splitReasonTag)}</span>` : "",
        obs.needsInquiry ? `<span class="id3-tag-reason">${t("要照会", "Needs review")}</span>` : "",
        obs.escalatedOneRankUp ? `<span class="id3-tag-reason">${t("14日無判断・一段上へ", "No decision in 14 days · escalated")}</span>` : "",
      ].filter(Boolean).join(" ");

      const expertBoxHtml = obs.canConfirmScoped
        ? `<div class="id3-expert" data-id3-expert="${esc(obs.observationId)}">
            <div class="id3-et">${en ? `A confirm entry with evidence is open for the ${esc(topCandName)} range` : `${esc(topCandName)}の範囲で、根拠を添えて確定する入口があります`}</div>
            <div class="id3-eb">${t("形質・写真の場所・見える／見えないの根拠を添えます。", "Add the trait, the part of the photo, and whether it is visible.")}</div>
            <button type="button" class="id3-ebtn" data-id3-expert-confirm-open="${esc(obs.observationId)}">${t("根拠を添えて確定する", "Confirm with evidence")}</button>
          </div>`
        : "";

      return `<article class="id3-card" data-id3-card="${esc(obs.observationId)}" data-top-name="${esc(topCandName)}" data-thumb="${thumbAttr}" data-index="${index}">
        <div class="id3-ghead"><h2>${esc(ranked.matchedNodeLabel)}</h2></div>
        <div class="id3-classband">
          <span>${t("AIの分類：", "AI classification: ")}<b>${esc(findTaxonNode(obs.aiMajorGroup)?.labelJa ?? obs.aiMajorGroup)}</b>${t("（仮説）", " (hypothesis)")}${ranked.isLowConfidenceCandidateMatch ? t(" ・ 候補に入っています（下位の候補です）", " · Listed as a lower-ranked candidate") : ""}${badgeHtml ? ` ${badgeHtml}` : ""}</span>
        </div>
        ${obs.photoUrl ? `<div class="id3-photo"><img src="${esc(obs.photoUrl)}" alt="${en ? `Photo of ${esc(topCandName)}` : `${esc(topCandName)}の写真`}" loading="lazy"></div>` : ""}
        <div class="id3-sumline"><span>${en ? `${esc(obs.ownerDisplayName)}'s record` : `${esc(obs.ownerDisplayName)}さんの記録`} ・ ${esc(obs.locationText ?? t("場所の情報なし", "No location info"))} ・ ${esc(jstMonthDayTimeLabel(obs.observedAt, en))}</span></div>
        ${obs.areaNote ? `<div class="id3-gwhy">${esc(obs.areaNote)}</div>` : ""}
        ${obs.needsInquiry && obs.outlierReasons?.length ? `<div class="id3-gwhy" style="color:#8a4b00">${esc(obs.outlierReasons.join(" / "))}</div>` : ""}
        ${cardsHtml}
        <button type="button" class="id3-vrow" data-id3-voice-open="${esc(obs.observationId)}">${ICONS.mic}${t("声で理由を添える", "Add a reason by voice")}<span class="id3-vs">${t("任意・根拠入力", "Optional")}</span></button>
        <div class="id3-voicebox" data-id3-voicebox="${esc(obs.observationId)}" hidden>
          <div class="id3-gwhy">${t("形質・写真の箇所・見える／見えないを選び、話した内容を確認・修正して残します。", "Pick the trait, the part of the photo, and whether it is visible, then review and edit what you said before saving.")}</div>
          <div class="id3-partchips" role="group" aria-label="${t("形質選択", "Trait")}">
            <button type="button" class="id3-partchip on" data-id3-trait="頭・顔の模様">${t("頭・顔の模様", "Head and face pattern")}</button>
            <button type="button" class="id3-partchip" data-id3-trait="くちばし・口元">${t("くちばし・口元", "Bill or mouth")}</button>
            <button type="button" class="id3-partchip" data-id3-trait="羽・体の色">${t("羽・体の色", "Feather or body color")}</button>
            <button type="button" class="id3-partchip" data-id3-trait="大きさ・形">${t("大きさ・形", "Size and shape")}</button>
          </div>
          <div class="id3-partchips" role="group" aria-label="${t("写真の箇所", "Part of photo")}">
            <button type="button" class="id3-partchip on" data-id3-part="全体の姿">${t("全体の姿", "Whole body")}</button>
            <button type="button" class="id3-partchip" data-id3-part="頭・顔">${t("頭・顔", "Head and face")}</button>
            <button type="button" class="id3-partchip" data-id3-part="羽・背中">${t("羽・背中", "Wings and back")}</button>
            <button type="button" class="id3-partchip" data-id3-part="腹・足">${t("腹・足", "Belly and legs")}</button>
          </div>
          <div class="id3-partchips" role="group" aria-label="${t("見えるか", "Visible or not")}">
            <button type="button" class="id3-partchip on" data-id3-vis="見える">${t("見える", "Visible")}</button>
            <button type="button" class="id3-partchip" data-id3-vis="見えない">${t("見えない", "Not visible")}</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="id3-partchip" data-id3-speech-start="${esc(obs.observationId)}">${ICONS.mic} ${t("声で入力", "Speak")}</button>
            <span class="id3-gwhy" data-id3-speech-status="${esc(obs.observationId)}"></span>
          </div>
          <textarea data-id3-voice-text="${esc(obs.observationId)}" placeholder="${t("見分ける理由を書いて確認します", "Write why you can tell, then review")}"></textarea>
          <button type="button" class="id3-agree main" data-id3-voice-submit="${esc(obs.observationId)}" data-candidate-name="${esc(topCandName)}">${en ? `Review and add to "${esc(topCandName)}"` : `確認して「${esc(topCandName)}」に添える`}</button>
          ${obs.canConfirmScoped ? `<button type="button" class="id3-agree" data-id3-expert-submit="${esc(obs.observationId)}" data-candidate-name="${esc(topCandName)}">${t("この根拠で確定する", "Confirm with this evidence")}</button>` : ""}
        </div>
        <div class="id3-sumline"><span>${t("確認の状態：", "Status: ")}${statusLabel}</span></div>
        ${expertBoxHtml}
        <div class="id3-blockend">
          <button type="button" class="id3-be" data-id3-delegate="${esc(obs.observationId)}">${ICONS.users}${t("ほかの人にまかせる", "Leave it to others")}</button>
          <button type="button" class="id3-be" data-id3-undetermined="${esc(obs.observationId)}">${ICONS.photoHelp}${t("この写真では決められない", "Cannot tell from this photo")}</button>
        </div>
      </article>`;
    })
    .join("\n");
}

function renderSkillsViewBody(data: IdentifyV3WorkspaceData): string {
  const en = data.lang !== "ja";
  const t = (ja: string, e: string): string => (en ? e : ja);
  const majors = TAXON_TREE.filter((n) => n.level === "major");
  const childrenMap = new Map<string, typeof TAXON_TREE[number][]>();
  for (const n of TAXON_TREE) {
    if (!n.parentKey) continue;
    const arr = childrenMap.get(n.parentKey) ?? [];
    arr.push(n);
    childrenMap.set(n.parentKey, arr);
  }

  const levels: Array<{ key: SkillDeclarationLevel; label: string }> = [
    { key: "expert", label: t("くわしい", "Expert") },
    { key: "general", label: t("全般わかる", "General") },
    { key: "some", label: t("わかるものもある", "Some") },
    { key: "none", label: t("流さない", "Hide") },
  ];

  const blocks = majors
    .map((m) => {
      const level = resolveNodeSkillLevel(m.key, data.skills);
      const fact = data.confirmedCountsByNode[m.key];
      const opts = levels
        .map(
          (l) =>
            `<button type="button" class="id3-opt${level === l.key ? " on" : ""}" data-id3-skill-opt data-node="${esc(m.key)}" data-level="${l.key}" aria-pressed="${level === l.key}">${l.label}</button>`,
        )
        .join("");
      const subNodes = (childrenMap.get(m.key) ?? []).flatMap((ch) => [ch, ...(childrenMap.get(ch.key) ?? [])]);
      const fineHtml = subNodes.length
        ? `<details style="margin-top:8px"><summary class="id3-gwhy" style="cursor:pointer">${en ? `Split by group or species (${subNodes.length})` : `仲間・種類ごとに分ける（${subNodes.length}件）`}</summary><div class="id3-fine">${subNodes
            .map((sub) => {
              const sLevel = resolveNodeSkillLevel(sub.key, data.skills);
              const sOpts = levels
                .map(
                  (l) =>
                    `<button type="button" class="id3-opt${sLevel === l.key ? " on" : ""}" data-id3-skill-opt data-node="${esc(sub.key)}" data-level="${l.key}" aria-pressed="${sLevel === l.key}">${l.label}</button>`,
                )
                .join("");
              return `<div class="id3-skill"><div class="id3-sname">${esc(sub.labelJa)}</div><div class="id3-opts4">${sOpts}</div></div>`;
            })
            .join("")}</div></details>`
        : "";
      const suggest = data.promotionSuggestions.find((s) => s.taxonNodeKey === m.key);
      const suggestHtml = suggest
        ? `<div class="id3-suggest"><div>${en ? `${suggest.confirmedCount} of your IDs for ${esc(suggest.label)} have been confirmed. Switch to "Expert" to see ${esc(suggest.label)} records first.` : `${esc(suggest.label)}では、あなたの同定が${suggest.confirmedCount}件確認済みになっています。「くわしい」に変えると、${esc(suggest.label)}の記録が先に流れます。`}</div><div style="display:flex;gap:18px;margin-top:8px"><button type="button" class="id3-undo" data-id3-promote-node="${esc(m.key)}">${t("くわしいに変える", "Switch to Expert")}</button><button type="button" class="id3-undo" style="color:#55615a" data-id3-keep-node="${esc(m.key)}">${t("このままにする", "Keep as is")}</button></div></div>`
        : "";
      return `<div class="id3-skill"><div class="id3-sname">${esc(m.labelJa)}</div>${fact ? `<div class="id3-sfact">${en ? `<b>${fact}</b> of your IDs have been confirmed so far.` : `これまで<b>${fact}件</b>の同定が確認済みになっています。`}</div>` : ""}<div class="id3-opts4">${opts}</div>${fineHtml}${suggestHtml}</div>`;
    })
    .join("");

  const grownHtml = data.autoGrown.length
    ? `<div class="id3-gwhy" style="margin-top:16px">${t("自動で育った得意", "Strengths that grew automatically")}</div>${data.autoGrown
        .map(
          (g) => `<div class="id3-grown" data-id3-grown="${esc(g.taxonNodeKey)}">
            <div style="font-weight:800;color:#143f2e">${esc(g.label)}</div>
            <div class="id3-gwhy">${esc(g.reasonText)}</div>
            <div style="display:flex;gap:18px;margin-top:8px">
              <button type="button" class="id3-undo" data-id3-grown-keep="${esc(g.taxonNodeKey)}">${t("このまま", "Keep")}</button>
              <button type="button" class="id3-undo" style="color:#55615a" data-id3-grown-dismiss="${esc(g.taxonNodeKey)}">${t("得意から外す", "Remove")}</button>
            </div>
          </div>`,
        )
        .join("")}`
    : "";

  return `<h1 style="font-size:19px;font-weight:800;margin-top:8px">${t("あなたの得意を教えてください", "Tell us what you know well")}</h1>
    <p class="id3-lead">${t("最初は、大きな分類だけで大丈夫です。細かい得意は、あなたの判断（賛成・提案・保存）から自動で育ちます。申告はいつでもここで直せます。", "Broad groups are enough to start. Finer strengths grow automatically from your decisions (agreeing, proposing, saving). You can change this here anytime.")}</p>
    <div style="margin-top:12px"><input type="search" data-id3-skill-search placeholder="${t("分類や種類をさがす", "Search groups or species")}" style="width:100%;min-height:46px;border-radius:999px;border:1px solid #dde2dc;background:#f7f7f3;padding:8px 16px;font:inherit"></div>
    ${grownHtml}
    <div id="id3-skills-list">${blocks}</div>
    <div class="id3-note">${t("申告していない分類でも、賛成や提案を続けると、得意として自動で育ちます。", "Even groups you have not set will grow into strengths as you keep agreeing and proposing.")}</div>
    <button type="button" class="id3-btn-main" id="id3-save-skills">${t("この内容で保存する", "Save")}</button>`;
}

function renderSavedViewBody(data: IdentifyV3WorkspaceData): string {
  const en = data.lang !== "ja";
  const t = (ja: string, e: string): string => (en ? e : ja);
  const settledHtml = data.settledSavedItems.length
    ? `<div class="id3-ghead" style="margin-top:18px"><h2>${t("決まったもの", "Settled")}</h2></div>
      <div class="id3-gwhy">${t("保存した記録が決まると、ここに移ります。見終わると、ここから消えます。", "Saved records move here once settled. They disappear after you mark them as seen.")}</div>
      ${data.settledSavedItems
        .map(
          (item) => `<div class="id3-row" data-id3-settled="${esc(item.occurrenceId)}">
            ${item.photoUrl ? `<img src="${esc(item.photoUrl)}" alt="">` : ""}
            <div style="flex:1;min-width:0">
              <div style="font-weight:800">${esc(item.currentTitle)}</div>
              <div class="id3-gwhy">${en ? `${esc(item.ownerDisplayName)}'s record` : `${esc(item.ownerDisplayName)}さんの記録`} ・ ${esc(item.locationText)} ・ ${esc(item.observedDateLabel)}</div>
              ${item.savedCandidateName ? `<div class="id3-gwhy">${en ? `Candidate when saved: ${esc(item.savedCandidateName)} · Saved ${esc(item.savedAtLabel)}` : `保存したときの候補：${esc(item.savedCandidateName)} ・ ${esc(item.savedAtLabel)}に保存`}</div>` : ""}
              <div style="font-size:13px;font-weight:700;color:#143f2e;margin-top:3px">${t("確認済みになりました", "Confirmed")} ${item.settledReason ? `・ ${esc(item.settledReason)}` : ""}</div>
            </div>
            <button type="button" class="id3-undo" data-id3-ack-settled="${esc(item.occurrenceId)}">${t("見終わった", "Seen")}</button>
          </div>`,
        )
        .join("")}`
    : "";

  const itemsHtml = data.savedItems.length
    ? data.savedItems
        .map(
          (item) => `<a class="id3-row" href="/ja/records/${encodeURIComponent(item.occurrenceId)}" data-id3-saved-node="${esc(item.taxonNodeKey)}">
            ${item.photoUrl ? `<img src="${esc(item.photoUrl)}" alt="">` : ""}
            <div style="flex:1;min-width:0">
              <div style="font-weight:800">${esc(item.currentTitle)}</div>
              <div class="id3-gwhy">${en ? `${esc(item.ownerDisplayName)}'s record` : `${esc(item.ownerDisplayName)}さんの記録`} ・ ${esc(item.locationText)} ・ ${esc(item.observedDateLabel)}</div>
              ${item.savedCandidateName ? `<div class="id3-gwhy">${en ? `Candidate when saved: ${esc(item.savedCandidateName)} · Saved ${esc(item.savedAtLabel)}` : `保存したときの候補：${esc(item.savedCandidateName)} ・ ${esc(item.savedAtLabel)}に保存`}</div>` : ""}
              <div style="font-size:13px;font-weight:700;color:#143f2e;margin-top:3px">${esc(item.stateSummary)}</div>
            </div>
            ${ICONS.chevRight}
          </a>`,
        )
        .join("")
    : `<div class="id3-note">${t("保存した記録はまだありません。作業場の「保存」を押すと、ここにまとまります。", "No saved records yet. Press Save in the workspace and they will collect here.")}</div>`;

  return `<p class="id3-lead">${en ? `Your saved records. You have <b>${data.savedCount}</b> now, with the groups you decide on most at the top.` : `保存した記録です。いま <b>${data.savedCount}件</b> あります。よく判断する分類のものが上に並んでいます。`}</p>
    ${settledHtml}
    <div class="id3-ghead" style="margin-top:20px"><h2>${t("保存した記録", "Saved records")}</h2></div>
    <div id="id3-saved-list">${itemsHtml}</div>
    <details style="margin-top:18px;border-top:1px solid #eef1ee;padding-top:12px">
      <summary style="cursor:pointer;font-weight:700;color:#17211b">${t("分類や時期で絞る（必要なときだけ開く）", "Filter by group or season (open when needed)")}</summary>
      <div class="id3-partchips" style="margin-top:10px">
        <button type="button" class="id3-partchip on" data-id3-saved-filter="all">${t("すべて", "All")}</button>
        <button type="button" class="id3-partchip" data-id3-saved-filter="bird">${t("鳥", "Birds")}</button>
        <button type="button" class="id3-partchip" data-id3-saved-filter="cicada">${t("セミの仲間", "Cicadas")}</button>
        <button type="button" class="id3-partchip" data-id3-saved-filter="grass">${t("草", "Grasses")}</button>
      </div>
    </details>
    <div class="id3-note">${t("決まった記録は「決まったもの」に移り、この一覧には残りません。既読にした記録もここには残りません。", "Settled records move to Settled and leave this list. Records marked as read are removed too.")}</div>`;
}

export function renderIdentifyV3Page(data: IdentifyV3WorkspaceData): string {
  const en = data.lang !== "ja";
  const t = (ja: string, e: string): string => (en ? e : ja);
  const prefix = data.lang === "ja" ? "/ja" : `/${data.lang}`;
  const titleMap: Record<IdentifyV3View, string> = {
    feed: t("同定の作業場", "Identification workspace"),
    skills: t("あなたの得意", "Your strengths"),
    saved: t("保存したもの", "Saved"),
  };

  let innerHtml = "";
  let fixedDecbar = "";

  if (data.view === "skills") {
    innerHtml = renderSkillsViewBody(data);
  } else if (data.view === "saved") {
    innerHtml = renderSavedViewBody(data);
  } else {
    const myChips = data.skills
      .filter((s) => s.level !== "none")
      .slice(0, 4)
      .map((s) => `<a class="id3-chip" href="${prefix}/identify?view=skills">${esc(taxonNodeLabelWithParent(s.taxonNodeKey))} ・ ${s.level === "expert" ? t("くわしい", "Expert") : s.level === "general" ? t("全般わかる", "General") : t("わかるものもある", "Some")}</a>`)
      .join("");
    const first = data.feedItems[0]?.observation;
    const firstTopName = first?.aiCandidates[0]?.name ?? t("この生きもの", "this species");

    innerHtml = `
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px">
        <h1 style="margin:0;font-size:17px;font-weight:800">${t("あなたの得意", "Your strengths")}</h1>
        <a href="${prefix}/identify?view=skills" style="margin-left:auto;font-size:13.5px;font-weight:700;color:#0055ad;text-decoration:none;display:inline-flex;align-items:center;min-height:44px;padding:0 6px">${t("変える", "Change")}</a>
      </div>
      <div class="id3-mychips">
        ${myChips || `<a class="id3-chip" href="${prefix}/identify?view=skills">${t("得意を選ぶ", "Choose strengths")}</a>`}
        <a class="id3-chip sub" href="${prefix}/identify?view=saved">${ICONS.bookmark}${en ? `Saved: ${data.savedCount}` : `保存したもの ${data.savedCount}件`}</a>
      </div>
      <p class="id3-lead">${t("得意な記録だけが流れています。細かい得意が先に届きます。決めた記録は細い行になって残り、いつでも取り消せます。", "Only records in your areas of strength appear here, with finer strengths first. Records you decide on shrink to a thin row and can be undone anytime.")}</p>
      <div class="id3-strips" id="id3-strips" aria-live="polite"></div>
      <div class="id3-feed" id="id3-feed">${data.feedItems.length ? renderFeedCardsHtml(data.feedItems, data.lang) : `<div class="id3-note">${en ? `There are no unconfirmed records right now. <a href="${prefix}/identify?view=skills">Check your strengths settings</a>, or come back later.` : `いま流れている未確認の記録はありません。<a href="${prefix}/identify?view=skills">得意の設定を見る</a>か、時間をおいて開いてください。`}</div>`}</div>
      ${data.nextCursor ? `<div id="id3-sentinel" data-next-cursor="${esc(data.nextCursor)}" class="id3-gwhy" style="padding:18px 0;text-align:center">${t("つづきを読み込んでいます…", "Loading more…")}</div>` : ""}`;

    if (first) {
      fixedDecbar = `<div class="id3-decbar" id="id3-decbar" data-target-id="${esc(first.observationId)}">
        <img src="${esc(first.photoUrl ?? "")}" alt="">
        <button type="button" class="id3-dpill" data-id3-bar-agree>${ICONS.check}<span>${en ? `Agree with ${esc(firstTopName)}` : `${esc(firstTopName)}に賛成する`}</span></button>
        <button type="button" class="id3-dmini" data-id3-bar-save>${ICONS.bookmark}<span>${t("保存", "Save")}</span></button>
        <button type="button" class="id3-dmini" data-id3-bar-read>${ICONS.eye}<span>${t("既読", "Seen")}</span></button>
      </div>`;
    }
  }

  const nonceAttr = data.cspNonce ? ` nonce="${esc(data.cspNonce)}"` : "";
  const script = `<script${nonceAttr}>(() => {
    const EN = ${JSON.stringify(en)};
    const T = (ja, e) => (EN ? e : ja);
    const api = async (path, body) => {
      const res = await fetch(path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      return res.json().catch(() => ({ ok: false }));
    };

    const feed = document.getElementById('id3-feed');
    const strips = document.getElementById('id3-strips');
    const decbar = document.getElementById('id3-decbar');
    let scrollTimer = null;

    const updateCenterCard = () => {
      if (!decbar || !feed) return;
      const cards = [...feed.querySelectorAll('[data-id3-card]:not(.is-collapsed)')];
      if (!cards.length) { decbar.style.display = 'none'; return; }
      const mid = window.innerHeight * 0.45;
      let best = cards[0];
      let bestDist = Infinity;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        const dist = Math.abs((r.top + r.bottom) / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = c; }
      }
      const id = best.getAttribute('data-id3-card') || '';
      const name = best.getAttribute('data-top-name') || T('この生きもの', 'this species');
      const thumb = best.getAttribute('data-thumb') || '';
      if (decbar.getAttribute('data-target-id') !== id) {
        decbar.setAttribute('data-target-id', id);
        const span = decbar.querySelector('[data-id3-bar-agree] span');
        if (span) span.textContent = EN ? 'Agree with ' + name : name + 'に賛成する';
        const img = decbar.querySelector('img');
        if (img && thumb) img.src = thumb;
      }
    };

    window.addEventListener('scroll', () => {
      if (decbar) {
        decbar.classList.add('is-scrolling');
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          decbar.classList.remove('is-scrolling');
          updateCenterCard();
        }, 220);
      }
    }, { passive: true });

    const collapseWithStrip = (occId, summaryLabel, thumb) => {
      const card = document.querySelector('[data-id3-card="' + occId + '"]');
      if (card) {
        card.classList.add('is-collapsing');
        setTimeout(() => { card.classList.add('is-collapsed'); updateCenterCard(); }, 240);
      }
      if (strips) {
        const strip = document.createElement('div');
        strip.className = 'id3-strip';
        strip.setAttribute('data-id3-strip', occId);
        strip.innerHTML = (thumb ? '<img src="' + thumb + '" alt="">' : '') + '<span class="id3-st">' + summaryLabel + '</span><button type="button" class="id3-undo" data-id3-undo="' + occId + '">' + T('取り消す', 'Undo') + '</button>';
        strips.prepend(strip);
      }
    };

    const submitDecision = async (occId, payload, summaryLabel) => {
      const card = document.querySelector('[data-id3-card="' + occId + '"]');
      const thumb = card?.getAttribute('data-thumb') || '';
      const r = await api('/api/v1/identify-v3/decisions', { occurrenceId: occId, ...payload });
      if (r && r.ok) collapseWithStrip(occId, summaryLabel, thumb);
    };

    document.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-id3-agree')) {
        const id = t.getAttribute('data-id3-agree');
        const name = t.getAttribute('data-candidate-name');
        const rank = t.getAttribute('data-candidate-rank') || 'species';
        await submitDecision(id, { decision: 'identify', proposedName: name, proposedRank: rank }, EN ? 'Agreed with ' + name : name + 'に賛成しました');
      } else if (t.hasAttribute('data-id3-bar-agree')) {
        const id = decbar?.getAttribute('data-target-id');
        const card = id ? document.querySelector('[data-id3-card="' + id + '"]') : null;
        const name = card?.getAttribute('data-top-name') || T('候補', 'candidate');
        if (id) await submitDecision(id, { decision: 'identify', proposedName: name, proposedRank: 'species' }, EN ? 'Agreed with ' + name : name + 'に賛成しました');
      } else if (t.hasAttribute('data-id3-bar-save')) {
        const id = decbar?.getAttribute('data-target-id');
        const card = id ? document.querySelector('[data-id3-card="' + id + '"]') : null;
        const name = card?.getAttribute('data-top-name') || '';
        if (id) await submitDecision(id, { decision: 'save', savedCandidateName: name }, T('保存しました', 'Saved'));
      } else if (t.hasAttribute('data-id3-bar-read')) {
        const id = decbar?.getAttribute('data-target-id');
        if (id) await submitDecision(id, { decision: 'read' }, T('見ました', 'Marked as seen'));
      } else if (t.hasAttribute('data-id3-delegate')) {
        const id = t.getAttribute('data-id3-delegate');
        await submitDecision(id, { decision: 'delegate' }, T('ほかの人にまかせました', 'Left to others'));
      } else if (t.hasAttribute('data-id3-undetermined')) {
        const id = t.getAttribute('data-id3-undetermined');
        await submitDecision(id, { decision: 'undetermined', reason: 'この写真では決められない' }, T('この写真では決められないと記録しました', 'Noted that this cannot be decided from this photo'));
      } else if (t.hasAttribute('data-id3-undo')) {
        const id = t.getAttribute('data-id3-undo');
        const r = await api('/api/v1/identify-v3/undo', { occurrenceId: id });
        if (r && r.ok) {
          t.closest('[data-id3-strip]')?.remove();
          const card = document.querySelector('[data-id3-card="' + id + '"]');
          if (card) { card.classList.remove('is-collapsed', 'is-collapsing'); updateCenterCard(); }
        }
      } else if (t.hasAttribute('data-id3-voice-open')) {
        const id = t.getAttribute('data-id3-voice-open');
        const box = document.querySelector('[data-id3-voicebox="' + id + '"]');
        if (box) box.hidden = !box.hidden;
      } else if (t.hasAttribute('data-id3-speech-start')) {
        const id = t.getAttribute('data-id3-speech-start');
        const status = document.querySelector('[data-id3-speech-status="' + id + '"]');
        const area = document.querySelector('[data-id3-voice-text="' + id + '"]');
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          if (status) status.textContent = T('このブラウザでは音声認識が使えないため、文字で入力して確認してください。', 'Voice input is not available in this browser. Please type instead.');
          return;
        }
        const rec = new SR();
        rec.lang = 'ja-JP';
        rec.interimResults = false;
        if (status) status.textContent = T('聞き取っています…', 'Listening…');
        rec.onresult = (e) => {
          const raw = e.results?.[0]?.[0]?.transcript || '';
          const cleaned = raw.replace(/(?:えー+と|あのー+|えっと|なんか)[、,\\s]*/g, '').trim();
          const formatted = cleaned && !/[。．！？!?]$/.test(cleaned) ? cleaned + '。' : cleaned;
          if (area) area.value = formatted;
          if (status) status.textContent = T('内容を確認・修正してから保存してください。', 'Review and edit before saving.');
        };
        rec.onerror = () => { if (status) status.textContent = T('音声をとれませんでした。文字で直せます。', 'Could not capture audio. You can type it instead.'); };
        rec.start();
      } else if (t.hasAttribute('data-id3-expert-confirm-open')) {
        const id = t.getAttribute('data-id3-expert-confirm-open');
        const box = document.querySelector('[data-id3-voicebox="' + id + '"]');
        if (box) { box.hidden = false; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (t.hasAttribute('data-id3-trait')) {
        t.classList.toggle('on');
      } else if (t.hasAttribute('data-id3-vis')) {
        const box = t.closest('[data-id3-voicebox]');
        box?.querySelectorAll('[data-id3-vis]').forEach((b) => b.classList.remove('on'));
        t.classList.add('on');
      } else if (t.hasAttribute('data-id3-part')) {
        const box = t.closest('[data-id3-voicebox]');
        box?.querySelectorAll('[data-id3-part]').forEach((b) => b.classList.remove('on'));
        t.classList.add('on');
      } else if (t.hasAttribute('data-id3-voice-submit') || t.hasAttribute('data-id3-expert-submit')) {
        const isConfirm = t.hasAttribute('data-id3-expert-submit');
        const id = t.getAttribute(isConfirm ? 'data-id3-expert-submit' : 'data-id3-voice-submit');
        const name = t.getAttribute('data-candidate-name');
        const box = document.querySelector('[data-id3-voicebox="' + id + '"]');
        const area = box?.querySelector('[data-id3-voice-text="' + id + '"]');
        const traits = [...(box?.querySelectorAll('[data-id3-trait].on') || [])].map((b) => b.getAttribute('data-id3-trait'));
        const part = box?.querySelector('[data-id3-part].on')?.getAttribute('data-id3-part') || '全体の姿';
        const vis = box?.querySelector('[data-id3-vis].on')?.getAttribute('data-id3-vis') || '見える';
        await submitDecision(
          id,
          { decision: isConfirm ? 'confirm' : 'identify', proposedName: name, traits, photoPart: part, visibility: vis, justificationText: area?.value || '' },
          EN ? (isConfirm ? 'Confirmed ' + name + ' with evidence' : 'Agreed with ' + name + ' and added a reason') : (isConfirm ? name + 'を根拠つきで確定しました' : name + 'に理由を添えて賛成しました')
        );
      } else if (t.hasAttribute('data-id3-skill-opt')) {
        const node = t.getAttribute('data-node');
        document.querySelectorAll('[data-id3-skill-opt][data-node="' + node + '"]').forEach((b) => {
          b.classList.remove('on');
          b.setAttribute('aria-pressed', 'false');
        });
        t.classList.add('on');
        t.setAttribute('aria-pressed', 'true');
      } else if (t.id === 'id3-save-skills') {
        const updates = [...document.querySelectorAll('[data-id3-skill-opt].on')].map((b) => ({
          taxonNodeKey: b.getAttribute('data-node'),
          level: b.getAttribute('data-level'),
          source: 'declared'
        }));
        const r = await api('/api/v1/identify-v3/skills', { updates });
        if (r && r.ok) location.href = '${prefix}/identify';
      } else if (t.hasAttribute('data-id3-grown-dismiss')) {
        const node = t.getAttribute('data-id3-grown-dismiss');
        const r = await api('/api/v1/identify-v3/skills', { updates: [{ taxonNodeKey: node, level: 'none', source: 'dismissed' }] });
        if (r && r.ok) document.querySelector('[data-id3-grown="' + node + '"]')?.remove();
      } else if (t.hasAttribute('data-id3-ack-settled')) {
        const id = t.getAttribute('data-id3-ack-settled');
        const r = await api('/api/v1/identify-v3/saved/ack', { occurrenceId: id });
        if (r && r.ok) document.querySelector('[data-id3-settled="' + id + '"]')?.remove();
      } else if (t.hasAttribute('data-id3-saved-filter')) {
        const k = t.getAttribute('data-id3-saved-filter');
        document.querySelectorAll('[data-id3-saved-filter]').forEach((b) => b.classList.toggle('on', b === t));
        document.querySelectorAll('#id3-saved-list [data-id3-saved-node]').forEach((row) => {
          row.style.display = k === 'all' || row.getAttribute('data-id3-saved-node') === k ? '' : 'none';
        });
      }
    });

    const sentinel = document.getElementById('id3-sentinel');
    if (sentinel && feed && 'IntersectionObserver' in window) {
      let loading = false;
      const io = new IntersectionObserver(async (entries) => {
        if (loading || !entries.some((e) => e.isIntersecting)) return;
        const cur = sentinel.getAttribute('data-next-cursor');
        if (!cur) return;
        loading = true;
        const dataRes = await api('/api/v1/identify-v3/feed?cursor=' + encodeURIComponent(cur) + '&lang=' + encodeURIComponent(${JSON.stringify(data.lang)}));
        if (dataRes && dataRes.ok && dataRes.cardsHtml) {
          feed.insertAdjacentHTML('beforeend', dataRes.cardsHtml);
          if (dataRes.nextCursor) sentinel.setAttribute('data-next-cursor', dataRes.nextCursor);
          else sentinel.remove();
        } else sentinel.remove();
        loading = false;
      });
      io.observe(sentinel);
    }
  })();</script>`;

  const backHref = data.view === "feed" ? `${prefix}/` : `${prefix}/identify`;
  const mainBody = `<div class="id3-topbar">
      <a class="id3-back" href="${backHref}" aria-label="${t("もどる", "Back")}">${ICONS.back}</a>
      <span class="id3-tt">${titleMap[data.view]}</span>
      <span class="id3-sp"></span>
    </div>
    <div class="id3-wrap">${innerHtml}</div>`;

  const chrome = renderZukanChrome({
    lang: data.lang,
    activeNav: "none",
    authenticated: true,
    displayName: data.displayName,
    pathname: `${prefix}/identify`,
    homeHref: `${prefix}/library`,
  });

  return `<!DOCTYPE html>
<html lang="${data.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${titleMap[data.view]} - ZUKAN</title>
<style${nonceAttr}>${IDENTIFY_V3_CSS}</style>
</head>
<body>
  <div class="zt-shell">
    ${chrome.sidebarHtml}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main">${mainBody}${chrome.feedbackFootHtml}</main>
    </div>
  </div>
  ${fixedDecbar}
  ${chrome.bottomNavHtml}
  ${script}
</body>
</html>`;
}

const jsonRes = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function handleIdentifyV3ApiRequest(
  request: Request,
  url: URL,
  env: Env,
  session: IdentifyV3Session | null,
  enabled: boolean,
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/v1/identify-v3/")) return null;
  if (!enabled) return jsonRes({ ok: false, error: "not_found" }, 404);
  if (!session) return jsonRes({ ok: false, error: "session_required" }, 401);
  if (session.banned) return jsonRes({ ok: false, error: "account_unavailable" }, 403);

  const sub = url.pathname.slice("/api/v1/identify-v3/".length);
  const now = new Date().toISOString();

  if (request.method === "GET" && sub === "feed") {
    const cursor = url.searchParams.get("cursor");
    const langParam = url.searchParams.get("lang");
    const feedLang: Lang = langParam === "en" || langParam === "es" || langParam === "pt-br" ? langParam : "ja";
    const ws = await loadIdentifyV3WorkspaceData(env, session.userId, { view: "feed", cursor, lang: feedLang, displayName: session.displayName });
    return jsonRes({
      ok: true,
      items: ws.feedItems,
      cardsHtml: renderFeedCardsHtml(ws.feedItems, feedLang),
      nextCursor: ws.nextCursor,
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonRes({ ok: false, error: "invalid_json" }, 400);
  }

  if (request.method === "POST" && sub === "decisions") {
    const occurrenceId = String(body.occurrenceId ?? "").trim();
    const decision = String(body.decision ?? "").trim() as IdentifyDecisionKind;
    if (!occurrenceId || !["identify", "confirm", "object", "save", "delegate", "read", "undetermined"].includes(decision)) {
      return jsonRes({ ok: false, error: "invalid_decision_request" }, 400);
    }
    const target = await env.OBS_DB.prepare(
      "SELECT observation_id, visibility, owner_user_id, taxon_label, observed_at, exact_lat, exact_lng FROM observations WHERE observation_id = ? LIMIT 1",
    )
      .bind(occurrenceId)
      .first<{ observation_id: string; visibility: string; owner_user_id: string; taxon_label: string | null; observed_at: string; exact_lat: number | null; exact_lng: number | null }>()
      .catch(() => null);
    if (!target) {
      return jsonRes({ ok: false, error: "observation_not_found" }, 404);
    }
    if (target.visibility !== "public" && target.owner_user_id !== session.userId) {
      return jsonRes({ ok: false, error: "forbidden" }, 403);
    }

    const evaluateCurrentOccurrence = async (taxonHint: string) => {
      const [votesRes, dispRes, revRes] = await Promise.all([
        env.OBS_DB.prepare("SELECT actor_user_id, proposed_name, proposed_rank, source_payload_json FROM observation_identifications WHERE occurrence_id = ? AND is_current = 1")
          .bind(occurrenceId)
          .all<{ actor_user_id: string; proposed_name: string; proposed_rank: string | null; source_payload_json: string }>()
          .catch(() => ({ results: [] })),
        env.OBS_DB.prepare("SELECT actor_user_id, proposed_name, kind, source_payload_json FROM observation_identification_disputes WHERE occurrence_id = ? AND status = 'open'")
          .bind(occurrenceId)
          .all<{ actor_user_id: string; proposed_name: string | null; kind: string; source_payload_json: string }>()
          .catch(() => ({ results: [] })),
        env.OBS_DB.prepare("SELECT actor_user_id, proposed_name, proposed_rank, decision, source_payload_json FROM observation_specialist_reviews WHERE occurrence_id = ? AND decision = 'approve'")
          .bind(occurrenceId)
          .all<{ actor_user_id: string; proposed_name: string | null; proposed_rank: string | null; decision: string; source_payload_json: string }>()
          .catch(() => ({ results: [] })),
      ]);

      const scopedActorIds = new Set(revRes.results.map((r) => r.actor_user_id));
      const votes: ConfirmationVoteInput[] = votesRes.results.map((v) => {
        let meta: { structuredJustification?: unknown } = {};
        try {
          meta = JSON.parse(v.source_payload_json) as typeof meta;
        } catch {}
        return {
          actorUserId: v.actor_user_id,
          proposedName: v.proposed_name,
          proposedRank: v.proposed_rank,
          activeDays: 30,
          overturnRate: computeVoterOverturnRate([]),
          hasScopedAuthority: scopedActorIds.has(v.actor_user_id),
          structuredJustification: (meta.structuredJustification as ConfirmationVoteInput["structuredJustification"]) ?? null,
        };
      });
      for (const r of revRes.results) {
        if (!votes.some((v) => v.actorUserId === r.actor_user_id)) {
          let meta: { structuredJustification?: unknown } = {};
          try {
            meta = JSON.parse(r.source_payload_json) as typeof meta;
          } catch {}
          votes.push({
            actorUserId: r.actor_user_id,
            proposedName: r.proposed_name ?? taxonHint,
            proposedRank: r.proposed_rank,
            activeDays: 30,
            overturnRate: 0,
            hasScopedAuthority: true,
            structuredJustification: (meta.structuredJustification as ConfirmationVoteInput["structuredJustification"]) ?? null,
          });
        }
      }
      const objections: ConfirmationObjectionInput[] = dispRes.results.map((d) => {
        let meta: { structuredJustification?: unknown } = {};
        try {
          meta = JSON.parse(d.source_payload_json) as typeof meta;
        } catch {}
        return {
          actorUserId: d.actor_user_id,
          proposedName: d.proposed_name,
          structuredJustification:
            (meta.structuredJustification as ConfirmationObjectionInput["structuredJustification"]) ??
            (d.kind === "insufficient_evidence" ? { traits: ["写真証拠不足"], photoPart: "全体の姿", visibility: "見えない" } : null),
        };
      });

      return evaluateConfirmationRules({
        targetTaxon: taxonHint,
        observedAt: target.observed_at,
        votes,
        objections,
        lat: target.exact_lat,
        lng: target.exact_lng,
      });
    };

    if (decision === "confirm") {
      const proposedName = String(body.proposedName ?? target.taxon_label ?? "").trim().slice(0, 160);
      if (!proposedName) return jsonRes({ ok: false, error: "identification_name_required" }, 400);
      const proposedRank = typeof body.proposedRank === "string" ? body.proposedRank.trim().slice(0, 60) : "species";

      const authRows = await env.OBS_DB.prepare(
        `SELECT scope_taxon_name, scope_taxon_key
           FROM specialist_authorities
          WHERE subject_user_id = ? AND status = 'active' AND authority_kind = 'taxon_identification'`
      ).bind(session.userId).all<{ scope_taxon_name: string; scope_taxon_key: string | null }>().catch(() => ({ results: [] }));

      const terms = new Set<string>();
      for (const candidate of [proposedName, target.taxon_label]) {
        const val = String(candidate ?? "").trim().toLowerCase();
        if (!val) continue;
        terms.add(val);
        let node = findTaxonNode(val);
        while (node) {
          terms.add(node.key.toLowerCase());
          terms.add(node.labelJa.toLowerCase());
          node = node.parentKey ? findTaxonNode(node.parentKey) : null;
        }
      }
      const hasScope = authRows.results.some((a) => {
        const sName = String(a.scope_taxon_name ?? "").trim().toLowerCase();
        const sKey = String(a.scope_taxon_key ?? "").trim().toLowerCase();
        return (sName && terms.has(sName)) || (sKey && terms.has(sKey));
      });
      if (!hasScope) {
        return jsonRes({ ok: false, error: "specialist_authority_required" }, 403);
      }

      const evCheck = validateStructuredJustification({
        traits: body.traits as string[],
        photoPart: String(body.photoPart ?? ""),
        visibility: body.visibility as "見える" | "見えない",
        textNote: typeof body.justificationText === "string" ? body.justificationText : null,
      });
      if (!evCheck.ok || !evCheck.normalized) {
        return jsonRes({ ok: false, error: evCheck.reason ?? "structured_justification_incomplete" }, 400);
      }

      const payload = { source: "identify_v3_confirm", structuredJustification: evCheck.normalized, updatedAt: now };
      const sourceKey = `cf_specialist_review:${occurrenceId}:expert-lane:${session.userId}`;
      await env.OBS_DB.batch([
        env.OBS_DB.prepare(
          `INSERT INTO observation_specialist_reviews (
             review_id, occurrence_id, actor_user_id, lane, decision, proposed_name, proposed_rank,
             accepted_rank, notes, review_class, source_payload_json, created_at, updated_at
           ) VALUES (?, ?, ?, 'expert-lane', 'approve', ?, ?, ?, ?, 'authority_backed', ?, ?, ?)
           ON CONFLICT(occurrence_id, actor_user_id, lane) DO UPDATE SET
             decision = excluded.decision,
             proposed_name = excluded.proposed_name,
             proposed_rank = excluded.proposed_rank,
             accepted_rank = excluded.accepted_rank,
             notes = excluded.notes,
             source_payload_json = excluded.source_payload_json,
             updated_at = excluded.updated_at`
        ).bind(`rev_${crypto.randomUUID()}`, occurrenceId, session.userId, proposedName, proposedRank, proposedRank, evCheck.normalized.textNote ?? evCheck.normalized.traits.join("・"), JSON.stringify(payload), now, now),
        env.OBS_DB.prepare(
          `INSERT INTO observation_identifications (
             identification_id, occurrence_id, actor_user_id, proposed_name, proposed_rank,
             stance, notes, source_key, source_payload_json, is_current, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'support', ?, ?, ?, 1, ?, ?)
           ON CONFLICT(source_key) DO UPDATE SET
             proposed_name = excluded.proposed_name,
             proposed_rank = excluded.proposed_rank,
             notes = excluded.notes,
             source_payload_json = excluded.source_payload_json,
             is_current = 1,
             updated_at = excluded.updated_at`
        ).bind(`id_${crypto.randomUUID()}`, occurrenceId, session.userId, proposedName, proposedRank, evCheck.normalized.textNote ?? evCheck.normalized.traits.join("・"), sourceKey, JSON.stringify(payload), now, now),
      ]);

      const state = await evaluateCurrentOccurrence(proposedName);
      return jsonRes({ ok: true, occurrenceId, decision, proposedName, ...state });
    }

    if (decision === "object") {
      const evCheck = validateStructuredJustification({
        traits: body.traits as string[],
        photoPart: String(body.photoPart ?? ""),
        visibility: body.visibility as "見える" | "見えない",
        textNote: typeof body.reason === "string" ? body.reason : typeof body.justificationText === "string" ? body.justificationText : null,
      });
      if (!evCheck.ok || !evCheck.normalized) {
        return jsonRes({ ok: false, error: evCheck.reason ?? "structured_justification_incomplete" }, 400);
      }
      const proposedName = typeof body.proposedName === "string" ? body.proposedName.trim().slice(0, 160) : null;
      const reason = String(body.reason ?? evCheck.normalized.textNote ?? evCheck.normalized.traits.join("・")).slice(0, 240);
      const dispId = `disp_${crypto.randomUUID()}`;
      await env.OBS_DB.prepare(
        `INSERT INTO observation_identification_disputes (
           dispute_id, occurrence_id, actor_user_id, kind, proposed_name, reason, status, source_payload_json, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`
      ).bind(
        dispId,
        occurrenceId,
        session.userId,
        proposedName ? "alternative_id" : "evidence_objection",
        proposedName,
        reason,
        JSON.stringify({ source: "identify_v3_objection", structuredJustification: evCheck.normalized, createdAt: now }),
        now,
        now,
      ).run();

      const state = await evaluateCurrentOccurrence(target.taxon_label ?? proposedName ?? "");
      return jsonRes({ ok: true, occurrenceId, decision, disputeId: dispId, ...state });
    }

    if (decision === "identify") {
      const proposedName = String(body.proposedName ?? "").trim().slice(0, 160);
      if (!proposedName) return jsonRes({ ok: false, error: "identification_name_required" }, 400);
      const proposedRank = typeof body.proposedRank === "string" ? body.proposedRank.trim().slice(0, 60) : "species";
      const rawNote = typeof body.justificationText === "string" ? formatSpokenJustificationJa(body.justificationText) : "";
      const photoPart = typeof body.photoPart === "string" ? body.photoPart.trim().slice(0, 40) : null;
      const sourceKey = `cf_public_identification:${occurrenceId}:${session.userId}`;
      const id = `id_${crypto.randomUUID()}`;
      const payload = { source: "identify_v3", justificationText: rawNote || null, photoPart, updatedAt: now };
      await env.OBS_DB.prepare(
        `INSERT INTO observation_identifications (
           identification_id, occurrence_id, actor_user_id, proposed_name, proposed_rank,
           stance, notes, source_key, source_payload_json, is_current, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'support', ?, ?, ?, 1, ?, ?)
         ON CONFLICT(source_key) DO UPDATE SET
           proposed_name = excluded.proposed_name,
           proposed_rank = excluded.proposed_rank,
           notes = excluded.notes,
           source_payload_json = excluded.source_payload_json,
           is_current = 1,
           updated_at = excluded.updated_at`,
      )
        .bind(id, occurrenceId, session.userId, proposedName, proposedRank, rawNote || null, sourceKey, JSON.stringify(payload), now, now)
        .run();
      return jsonRes({ ok: true, occurrenceId, decision, proposedName });
    }

    if (decision === "undetermined") {
      const reason = String(body.reason ?? "この写真では決められない").trim().slice(0, 240);
      const dispId = `disp_${crypto.randomUUID()}`;
      await env.OBS_DB.prepare(
        `INSERT INTO observation_identification_disputes (
           dispute_id, occurrence_id, actor_user_id, kind, reason, status, source_payload_json, created_at, updated_at
         ) VALUES (?, ?, ?, 'insufficient_evidence', ?, 'open', ?, ?, ?)`,
      )
        .bind(dispId, occurrenceId, session.userId, reason, JSON.stringify({ source: "identify_v3", createdAt: now }), now, now)
        .run();
      return jsonRes({ ok: true, occurrenceId, decision, disputeId: dispId });
    }

    // Personal-only decisions: save / delegate / read -> workbench holds only (never public identification table)
    const holdReason = decision === "save" ? "saved" : decision === "delegate" ? "delegated" : "read";
    const savedCandidateName = typeof body.savedCandidateName === "string" ? body.savedCandidateName.trim().slice(0, 120) : null;
    await env.OBS_DB.prepare(
      `INSERT INTO observation_identification_workbench_holds (
         hold_id, occurrence_id, actor_user_id, hold_reason, source_payload_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(occurrence_id, actor_user_id) DO UPDATE SET
         hold_reason = excluded.hold_reason,
         source_payload_json = excluded.source_payload_json,
         updated_at = excluded.updated_at`,
    )
      .bind(
        `hold_${crypto.randomUUID()}`,
        occurrenceId,
        session.userId,
        holdReason,
        JSON.stringify({ decision, holdReason, savedCandidateName, savedAt: now }),
        now,
        now,
      )
      .run();

    return jsonRes({ ok: true, occurrenceId, decision });
  }

  if (request.method === "POST" && sub === "undo") {
    const occurrenceId = String(body.occurrenceId ?? "").trim();
    if (!occurrenceId) return jsonRes({ ok: false, error: "occurrence_id_required" }, 400);
    await env.OBS_DB.batch([
      env.OBS_DB.prepare("DELETE FROM observation_identification_workbench_holds WHERE occurrence_id = ? AND actor_user_id = ?").bind(
        occurrenceId,
        session.userId,
      ),
      env.OBS_DB.prepare(
        "UPDATE observation_identifications SET is_current = 0, updated_at = ? WHERE occurrence_id = ? AND actor_user_id = ?",
      ).bind(now, occurrenceId, session.userId),
      env.OBS_DB.prepare(
        "UPDATE observation_identification_disputes SET status = 'withdrawn', updated_at = ? WHERE occurrence_id = ? AND actor_user_id = ? AND kind = 'insufficient_evidence' AND status = 'open'",
      ).bind(now, occurrenceId, session.userId),
    ]);
    return jsonRes({ ok: true, occurrenceId, undone: true });
  }

  if (request.method === "POST" && sub === "skills") {
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (updates.length === 0 || updates.length > 100) return jsonRes({ ok: false, error: "invalid_skills_payload" }, 400);
    for (const u of updates) {
      if (!u || typeof u !== "object") continue;
      const rec = u as Record<string, unknown>;
      const nodeKey = String(rec.taxonNodeKey ?? "").trim().slice(0, 80);
      const level = String(rec.level ?? "general").trim();
      const source = rec.source === "dismissed" ? "dismissed" : rec.source === "auto_grown" ? "auto_grown" : "declared";
      if (!nodeKey || !["expert", "general", "some", "none"].includes(level)) continue;
      const itemState = source === "dismissed" ? "removed" : "saved";
      const payloadTitle = JSON.stringify({ level, source, updatedAt: now });
      await env.CORE_DB.prepare(
        `INSERT INTO user_saved_items (
           user_id, object_kind, object_id, canonical_path, display_title, state, revision,
           last_command_id, last_command_digest, saved_at, updated_at
         ) VALUES (?, 'identify_v3_skill', ?, '/ja/identify?view=skills', ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT(user_id, object_kind, object_id) DO UPDATE SET
           display_title = excluded.display_title,
           state = excluded.state,
           revision = user_saved_items.revision + 1,
           updated_at = excluded.updated_at`,
      )
        .bind(session.userId, nodeKey, payloadTitle, itemState, `id3skill_${crypto.randomUUID()}`, nodeKey, now, now)
        .run();
    }
    return jsonRes({ ok: true });
  }

  if (request.method === "POST" && sub === "saved/ack") {
    const occurrenceId = String(body.occurrenceId ?? "").trim();
    if (!occurrenceId) return jsonRes({ ok: false, error: "occurrence_id_required" }, 400);
    const existing = await env.OBS_DB.prepare(
      "SELECT source_payload_json FROM observation_identification_workbench_holds WHERE occurrence_id = ? AND actor_user_id = ?",
    )
      .bind(occurrenceId, session.userId)
      .first<{ source_payload_json: string }>()
      .catch(() => null);
    let meta: Record<string, unknown> = {};
    try {
      if (existing?.source_payload_json) meta = JSON.parse(existing.source_payload_json) as Record<string, unknown>;
    } catch {}
    meta.settledDismissed = true;
    meta.dismissedAt = now;
    await env.OBS_DB.prepare(
      "UPDATE observation_identification_workbench_holds SET source_payload_json = ?, updated_at = ? WHERE occurrence_id = ? AND actor_user_id = ?",
    )
      .bind(JSON.stringify(meta), now, occurrenceId, session.userId)
      .run();
    return jsonRes({ ok: true, occurrenceId, dismissed: true });
  }

  if (request.method === "POST" && sub === "split-rules") {
    const isAdmin = session.roleName === "admin" || session.roleName === "owner";
    const hasMatchingScopeReviewer = Boolean(body.reviewerApproved === true);
    if (!canApproveSplitRule({ hasMatchingScopeReviewer, isOperatorAdmin: isAdmin })) {
      return jsonRes({ ok: false, error: "split_rule_dual_approval_required" }, 403);
    }
    return jsonRes({ ok: true, accepted: true, pendingTableProposal: "taxon_split_rules" });
  }

  return jsonRes({ ok: false, error: "not_found" }, 404);
}
