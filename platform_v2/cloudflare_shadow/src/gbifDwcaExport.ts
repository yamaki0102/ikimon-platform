import { PRODUCTION_PUBLIC_ORIGIN } from "../../src/services/trustedPublicOrigin";
import { GBIF_DATA_LICENSE_URI, GBIF_MEDIA_LICENSE_URI } from "./gbifConsent.js";
import { evaluateHumanConfirmation, type ConfirmationClaim, type ClaimActorKind, type ConfirmedTaxon } from "./gbifConfirmation.js";
import { chunkOf, isMissingSchema, marks, randomUuid, sha256Text, type GbifDb, type GbifStatement } from "./gbifDb.js";
import { loadLatestMatches, matchLookupKey, nameKeyOf, type AcceptedTaxonMatch } from "./gbifTaxonMatch.js";
import { metadataProvesPublicFaceSafety, safeDerivedKey } from "./publicationFeedNative.js";
import { disclosePublicLocation, publicDateJst, type LocationProtection } from "./recordPublicLocation.js";

export const GBIF_EXPORT_RULE_VERSION = "gbif-dwca/1";
export const GBIF_STABLE_DAYS = 14;

const DWC = "http://rs.tdwg.org/dwc/terms/";
const DCT = "http://purl.org/dc/terms/";
export const OCCURRENCE_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["occurrenceID", `${DWC}occurrenceID`], ["basisOfRecord", `${DWC}basisOfRecord`], ["occurrenceStatus", `${DWC}occurrenceStatus`],
  ["eventDate", `${DWC}eventDate`], ["countryCode", `${DWC}countryCode`], ["decimalLatitude", `${DWC}decimalLatitude`],
  ["decimalLongitude", `${DWC}decimalLongitude`], ["geodeticDatum", `${DWC}geodeticDatum`], ["coordinateUncertaintyInMeters", `${DWC}coordinateUncertaintyInMeters`],
  ["scientificName", `${DWC}scientificName`], ["taxonRank", `${DWC}taxonRank`], ["kingdom", `${DWC}kingdom`], ["phylum", `${DWC}phylum`],
  ["class", `${DWC}class`], ["order", `${DWC}order`], ["family", `${DWC}family`], ["genus", `${DWC}genus`], ["taxonID", `${DWC}taxonID`],
  ["vernacularName", `${DWC}vernacularName`], ["individualCount", `${DWC}individualCount`], ["recordedBy", `${DWC}recordedBy`],
  ["identificationVerificationStatus", `${DWC}identificationVerificationStatus`], ["license", `${DCT}license`], ["rightsHolder", `${DCT}rightsHolder`],
  ["references", `${DCT}references`], ["dataGeneralizations", `${DWC}dataGeneralizations`], ["informationWithheld", `${DWC}informationWithheld`],
  ["modified", `${DCT}modified`],
];
export const MULTIMEDIA_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["occurrenceID", ""], ["type", `${DCT}type`], ["format", `${DCT}format`], ["identifier", `${DCT}identifier`], ["references", `${DCT}references`],
  ["creator", `${DCT}creator`], ["license", `${DCT}license`], ["rightsHolder", `${DCT}rightsHolder`],
];

export type SensitiveLookup = { listVersion: string; tierOf(nameKey: string): LocationProtection };
export type HeldReason =
  | "no_human_claim" | "single_voter" | "objection" | "taxon_unmatched" | "no_consensus" | "rank_too_coarse" | "expert_conflict"
  | "unstable_under_14_days" | "sensitive_list_unavailable" | "location_hidden" | "location_delayed" | "location_unparseable" | "location_protected_withhold" | "date_unparseable";
export type HeldRow = { observationId: string; recordId: string; reason: HeldReason };

export type ExportRow = {
  occurrenceId: string; observationId: string; recordId: string;
  values: Record<string, string>;
  digest: string;
  mediaCount: number;
  stableSinceMs: number;
};
export type ExportMediaRow = { occurrenceId: string; assetId: string; values: Record<string, string> };

export type GbifEditionBuild = {
  editionId: string;
  ruleVersion: string;
  sensitiveListVersion: string;
  builtAtIso: string;
  rows: ExportRow[];
  mediaRows: ExportMediaRow[];
  held: HeldRow[];
  candidateCount: number;
  files: Record<"occurrence.txt" | "multimedia.txt" | "meta.xml" | "eml.xml", string>;
  archiveDigest: string;
};

export type BuildInput = {
  db: GbifDb;
  nowMs: number;
  sensitive: SensitiveLookup | null;
  baseUrl?: string;
  publisher?: { organizationName: string; contactEmail?: string };
  datasetTitle?: string;
  assumeConsent?: boolean;
  allowUnknownCaptive?: boolean;
  stableDays?: number;
};

type Candidate = {
  observationId: string; recordId: string; ownerUserId: string; countMode: string; countValue: number | null; verificationStatus: string;
  roUpdatedAt: string; reviewedAt: string | null; observedAt: string; publicCell: string; alias: string | null;
};

export async function loadActiveSensitiveList(db: GbifDb): Promise<SensitiveLookup | null> {
  try {
    const version = (await db.query("SELECT list_version FROM gbif_sensitive_list_versions WHERE status = 'active' LIMIT 1", []))[0];
    if (!version) return null;
    const rows = await db.query("SELECT name_key, tier FROM gbif_sensitive_taxa WHERE list_version = ?", [version.list_version]);
    const tiers = new Map<string, LocationProtection>();
    for (const row of rows) tiers.set(String(row.name_key), row.tier === "withhold" ? "withhold" : "coarse");
    return { listVersion: String(version.list_version), tierOf: (key) => tiers.get(key) ?? "none" };
  } catch (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
}

const msOf = (value: unknown): number => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return 0;
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(" ", "T")}Z` : text);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

const tabSafe = (value: unknown): string => String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
const strictTier = (a: LocationProtection, b: LocationProtection): LocationProtection => (a === "withhold" || b === "withhold" ? "withhold" : a === "coarse" || b === "coarse" ? "coarse" : "none");

async function loadCandidates(input: BuildInput, afterId: string, limit: number): Promise<Candidate[]> {
  const captive = input.allowUnknownCaptive ? "ro.captive_context IN ('wild', 'unknown')" : "ro.captive_context = 'wild'";
  const consentJoin = input.assumeConsent
    ? "LEFT JOIN gbif_consent_events cd ON 0"
    : `JOIN gbif_consent_events cd ON cd.record_runtime = 'cloudflare_d1' AND cd.record_id = ro.record_id AND cd.scope = 'data' AND cd.decision = 'on'
         AND NOT EXISTS (SELECT 1 FROM gbif_consent_events n WHERE n.supersedes_id = cd.consent_id)`;
  const sql = (withCivic: boolean) => `SELECT ro.observation_id, ro.record_id, ro.owner_user_id, ro.count_mode, ro.count_value, ro.verification_status,
         ro.updated_at AS ro_updated_at, ro.reviewed_at, o.observed_at, o.public_cell, cd.attribution_alias
    FROM record_observations ro
    JOIN observations o ON o.observation_id = ro.record_id
    ${consentJoin}
    LEFT JOIN record_observation_policies p ON p.record_runtime = ro.record_runtime AND p.record_id = ro.record_id
    LEFT JOIN observation_data_rights r ON r.visit_id = o.observation_id
    ${withCivic ? "LEFT JOIN civic_observation_contexts c ON c.visit_id = o.observation_id" : ""}
   WHERE ro.observation_id > ? AND ro.lifecycle_status = 'active' AND ro.subject_type = 'organism' AND ${captive}
     AND o.visibility = 'public' AND COALESCE(p.visibility, o.visibility) = 'public' AND o.emergency_hidden = 0 AND o.processing_state = 'accepted'
     AND o.public_cell NOT IN ('hidden', 'unknown') AND o.owner_user_id NOT LIKE 'guest%' AND ro.owner_user_id NOT LIKE 'guest%'
     AND COALESCE(r.withdrawal_status, 'active') = 'active'
     ${withCivic ? "AND COALESCE(c.audience_scope, 'public') = 'public' AND COALESCE(c.risk_lane, 'normal') = 'normal' AND COALESCE(c.public_precision, 'municipality') NOT IN ('hidden', 'exact_private')" : ""}
   ORDER BY ro.observation_id LIMIT ?`;
  let rows;
  try {
    rows = await input.db.query(sql(true), [afterId, limit]);
  } catch (error) {
    if (!isMissingSchema(error) || !/civic_observation_contexts/i.test(String((error as Error).message))) throw error;
    rows = await input.db.query(sql(false), [afterId, limit]);
  }
  return rows.map((row) => ({
    observationId: String(row.observation_id), recordId: String(row.record_id), ownerUserId: String(row.owner_user_id),
    countMode: String(row.count_mode), countValue: row.count_value == null ? null : Number(row.count_value),
    verificationStatus: String(row.verification_status), roUpdatedAt: String(row.ro_updated_at ?? ""), reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
    observedAt: String(row.observed_at), publicCell: String(row.public_cell), alias: row.attribution_alias == null ? null : String(row.attribution_alias),
  }));
}

type ClaimRow = ConfirmationClaim & { observationId: string; stamps: string[] };

async function loadClaims(db: GbifDb, observationIds: string[]): Promise<Map<string, ClaimRow[]>> {
  const out = new Map<string, ClaimRow[]>();
  for (const part of chunkOf(observationIds, 80)) {
    const rows = await db.query(
      `SELECT identification_id, observation_id, actor_id, actor_kind, claim_status, stance, proposed_name, proposed_scientific_name, proposed_rank,
              accepted_name, accepted_rank, source_payload_json, decided_at, created_at, updated_at
         FROM observation_identification_claims WHERE observation_id IN (${marks(part.length)})`,
      part,
    );
    for (const row of rows) {
      let authority = false;
      try {
        const payload = JSON.parse(String(row.source_payload_json ?? "{}")) as Record<string, unknown>;
        const reviewClass = String(payload.reviewClass ?? payload.review_class ?? "");
        authority = payload.lane === "public-claim" && (reviewClass === "authority_backed" || reviewClass === "admin_override");
      } catch { authority = false; }
      const claim: ClaimRow = {
        claimId: String(row.identification_id), observationId: String(row.observation_id), actorId: row.actor_id == null ? null : String(row.actor_id),
        actorKind: String(row.actor_kind) as ClaimActorKind, claimStatus: String(row.claim_status), stance: String(row.stance),
        proposedName: String(row.proposed_name), proposedScientificName: row.proposed_scientific_name == null ? null : String(row.proposed_scientific_name),
        proposedRank: row.proposed_rank == null ? null : String(row.proposed_rank), acceptedName: row.accepted_name == null ? null : String(row.accepted_name),
        acceptedRank: row.accepted_rank == null ? null : String(row.accepted_rank), authorityBacked: authority,
        updatedAt: String(row.updated_at ?? row.created_at ?? ""),
        stamps: [row.updated_at, row.created_at, row.decided_at].map((value) => String(value ?? "")),
      };
      const list = out.get(claim.observationId) ?? [];
      list.push(claim);
      out.set(claim.observationId, list);
    }
  }
  return out;
}

async function loadOpenDisputes(db: GbifDb, recordIds: string[]): Promise<Map<string, { open: number; stamps: string[] }>> {
  const out = new Map<string, { open: number; stamps: string[] }>();
  for (const part of chunkOf(recordIds, 80)) {
    const rows = await db.query(
      `SELECT occurrence_id, status, created_at, updated_at FROM observation_identification_disputes WHERE occurrence_id IN (${marks(part.length)})`,
      part.map((id) => `occ:${id}:0`),
    );
    for (const row of rows) {
      const recordId = String(row.occurrence_id).replace(/^occ:/, "").replace(/:\d+$/, "");
      const slot = out.get(recordId) ?? { open: 0, stamps: [] };
      if (row.status === "open") slot.open += 1;
      slot.stamps.push(String(row.created_at ?? ""), String(row.updated_at ?? ""));
      out.set(recordId, slot);
    }
  }
  return out;
}

async function loadAiNames(db: GbifDb, observationIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const part of chunkOf(observationIds, 80)) {
    const rows = await db.query(
      `SELECT observation_id, proposed_name, proposed_scientific_name FROM observation_ai_suggestions
        WHERE suggestion_status IN ('active', 'rejected_by_owner', 'superseded', 'hidden') AND observation_id IN (${marks(part.length)})`,
      part,
    );
    for (const row of rows) {
      const list = out.get(String(row.observation_id)) ?? [];
      for (const value of [row.proposed_name, row.proposed_scientific_name]) if (value) list.push(String(value));
      out.set(String(row.observation_id), list);
    }
  }
  return out;
}

type MediaCandidate = { observationId: string; assetId: string; key: string; mime: string };

async function loadMedia(db: GbifDb, observationIds: string[], assumeConsent: boolean): Promise<Map<string, MediaCandidate[]>> {
  const out = new Map<string, MediaCandidate[]>();
  if (assumeConsent) return out;
  for (const part of chunkOf(observationIds, 60)) {
    const rows = await db.query(
      `SELECT m.observation_id, a.asset_id, a.public_derivative_key, a.public_derivative_metadata_json, a.mime
         FROM record_observation_media m
         JOIN asset_ledger a ON a.asset_id = m.media_id
         JOIN record_observations ro ON ro.observation_id = m.observation_id
         JOIN gbif_consent_events cm ON cm.record_runtime = 'cloudflare_d1' AND cm.record_id = ro.record_id AND cm.scope = 'media' AND cm.asset_id = a.asset_id AND cm.decision = 'on'
          AND NOT EXISTS (SELECT 1 FROM gbif_consent_events n WHERE n.supersedes_id = cm.consent_id)
        WHERE m.observation_id IN (${marks(part.length)}) AND m.active = 1 AND m.role IN ('primary_evidence', 'supporting_evidence')
          AND a.observation_id = ro.record_id AND a.processing_state = 'uploaded' AND a.public_derivative_key IS NOT NULL
          AND a.public_derivative_verified_at IS NOT NULL AND a.exif_scrub_state = 'scrubbed' AND a.public_ready_at IS NOT NULL AND a.mime LIKE 'image/%'
        ORDER BY m.observation_id, a.created_at, a.asset_id`,
      part,
    );
    for (const row of rows) {
      const key = safeDerivedKey(row.public_derivative_key);
      if (!key || !metadataProvesPublicFaceSafety(row.public_derivative_metadata_json == null ? null : String(row.public_derivative_metadata_json))) continue;
      const list = out.get(String(row.observation_id)) ?? [];
      if (!list.some((item) => item.assetId === String(row.asset_id))) list.push({ observationId: String(row.observation_id), assetId: String(row.asset_id), key, mime: "image/webp" });
      out.set(String(row.observation_id), list);
    }
  }
  return out;
}

export async function buildGbifEdition(input: BuildInput): Promise<GbifEditionBuild> {
  const baseUrl = (input.baseUrl ?? PRODUCTION_PUBLIC_ORIGIN).replace(/\/+$/u, "");
  const stableMs = (input.stableDays ?? GBIF_STABLE_DAYS) * 24 * 60 * 60 * 1000;
  const builtAtIso = new Date(input.nowMs).toISOString();
  const rows: ExportRow[] = [];
  const mediaRows: ExportMediaRow[] = [];
  const held: HeldRow[] = [];
  let candidateCount = 0;
  let after = "";
  for (;;) {
    const page = await loadCandidates(input, after, 200);
    if (page.length === 0) break;
    after = page[page.length - 1]!.observationId;
    candidateCount += page.length;
    const recordIds = [...new Set(page.map((candidate) => candidate.recordId))];
    const siblings = new Map<string, string[]>();
    for (const part of chunkOf(recordIds, 60)) {
      const found = await input.db.query(
        `SELECT observation_id, record_id FROM record_observations WHERE record_id IN (${marks(part.length)}) AND lifecycle_status = 'active'`,
        part,
      );
      for (const row of found) {
        const list = siblings.get(String(row.record_id)) ?? [];
        list.push(String(row.observation_id));
        siblings.set(String(row.record_id), list);
      }
    }
    const allObservationIds = [...new Set([...siblings.values()].flat())];
    const [claimsByObservation, disputesByRecord, aiNames, mediaByObservation] = await Promise.all([
      loadClaims(input.db, allObservationIds),
      loadOpenDisputes(input.db, recordIds),
      loadAiNames(input.db, allObservationIds),
      loadMedia(input.db, page.map((candidate) => candidate.observationId), Boolean(input.assumeConsent)),
    ]);
    const lookupPairs: Array<{ name: string; rank: string | null }> = [];
    for (const claims of claimsByObservation.values()) {
      for (const claim of claims) lookupPairs.push({ name: claim.acceptedName ?? claim.proposedScientificName ?? claim.proposedName, rank: claim.acceptedRank ?? claim.proposedRank });
    }
    const matches = await loadLatestMatches(input.db, lookupPairs);
    const matchOf = (name: string, rank: string | null): AcceptedTaxonMatch | null => {
      const found = matches.get(matchLookupKey(name, rank));
      return found?.decision === "accepted" ? found.taxon : null;
    };

    for (const candidate of page) {
      const holdRow = (reason: HeldReason) => held.push({ observationId: candidate.observationId, recordId: candidate.recordId, reason });
      const claims = claimsByObservation.get(candidate.observationId) ?? [];
      const disputes = disputesByRecord.get(candidate.recordId) ?? { open: 0, stamps: [] };
      const confirmation = await evaluateHumanConfirmation({
        claims, openDisputeCount: disputes.open, recordDisputed: candidate.verificationStatus === "disputed", matchOf,
      });
      if (!confirmation.confirmed) { holdRow(confirmation.reason); continue; }
      const taxon = confirmation.taxon;

      const stableSince = Math.max(
        msOf(candidate.roUpdatedAt), msOf(candidate.reviewedAt), ...claims.flatMap((claim) => claim.stamps.map(msOf)), ...disputes.stamps.map(msOf),
      );
      if (!(input.nowMs - stableSince >= stableMs)) { holdRow("unstable_under_14_days"); continue; }

      if (!input.sensitive) { holdRow("sensitive_list_unavailable"); continue; }
      let tier: LocationProtection = "none";
      const names = new Set<string>();
      for (const key of [taxon.name, taxon.lineage.species, taxon.lineage.genus]) if (key) names.add(nameKeyOf(key));
      for (const sibling of siblings.get(candidate.recordId) ?? []) {
        for (const value of aiNames.get(sibling) ?? []) names.add(nameKeyOf(value));
        for (const claim of claimsByObservation.get(sibling) ?? []) {
          for (const value of [claim.proposedName, claim.proposedScientificName, claim.acceptedName]) if (value) names.add(nameKeyOf(value));
        }
      }
      for (const key of names) if (key) tier = strictTier(tier, input.sensitive.tierOf(key));

      const location = disclosePublicLocation({ publicCell: candidate.publicCell, observedAt: candidate.observedAt, nowMs: input.nowMs, protection: tier });
      if (location.status === "withheld") { holdRow(`location_${location.reason}` as HeldReason); continue; }
      const eventDate = publicDateJst(candidate.observedAt);
      if (!eventDate) { holdRow("date_unparseable"); continue; }

      const occurrenceId = `urn:uuid:${candidate.observationId}`;
      const alias = candidate.alias ?? "";
      const km = location.gridMeters / 1000;
      const values: Record<string, string> = {
        occurrenceID: occurrenceId, basisOfRecord: "HumanObservation", occurrenceStatus: "present", eventDate, countryCode: "JP",
        decimalLatitude: String(location.centerLat), decimalLongitude: String(location.centerLng), geodeticDatum: "WGS84",
        coordinateUncertaintyInMeters: String(location.radiusM),
        scientificName: taxon.name, taxonRank: taxon.rank, kingdom: taxon.lineage.kingdom ?? "", phylum: taxon.lineage.phylum ?? "",
        class: taxon.lineage.class ?? "", order: taxon.lineage.order ?? "", family: taxon.lineage.family ?? "", genus: taxon.lineage.genus ?? "",
        taxonID: taxon.usageKey ? `https://www.gbif.org/species/${taxon.usageKey}` : "", vernacularName: taxon.vernacularHint ?? "",
        individualCount: candidate.countMode === "exact" && candidate.countValue && candidate.countValue > 0 ? String(candidate.countValue) : "",
        recordedBy: alias, identificationVerificationStatus: taxon.basis === "expert_verified" ? "expert verified" : "community consensus",
        license: GBIF_DATA_LICENSE_URI, rightsHolder: alias, references: `${baseUrl}/ja/observations/${encodeURIComponent(candidate.recordId)}`,
        dataGeneralizations: `Coordinates replaced by the center of a public grid cell (about ${km} km); event date given to the day.`,
        informationWithheld: "Original coordinates, time of day and detailed place names are withheld.",
        modified: new Date(stableSince).toISOString().slice(0, 10),
      };
      const media = (mediaByObservation.get(candidate.observationId) ?? []).map((item): ExportMediaRow => ({
        occurrenceId, assetId: item.assetId,
        values: {
          occurrenceID: occurrenceId, type: "StillImage", format: item.mime, identifier: `${baseUrl}/${item.key}`,
          references: values.references!, creator: alias, license: GBIF_MEDIA_LICENSE_URI, rightsHolder: alias,
        },
      }));
      const line = OCCURRENCE_COLUMNS.map(([name]) => tabSafe(values[name])).join("\t");
      rows.push({ occurrenceId, observationId: candidate.observationId, recordId: candidate.recordId, values, digest: await sha256Text(line), mediaCount: media.length, stableSinceMs: stableSince });
      mediaRows.push(...media);
    }
    if (page.length < 200) break;
  }

  const files = await buildFiles({ rows, mediaRows, input, builtAtIso, baseUrl });
  const editionId = randomUuid();
  const archiveDigest = await sha256Text(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([name, body]) => `${name}\u0000${body}`).join("\u0001"));
  return {
    editionId, ruleVersion: GBIF_EXPORT_RULE_VERSION, sensitiveListVersion: input.sensitive?.listVersion ?? "unavailable", builtAtIso,
    rows, mediaRows, held, candidateCount, files: { ...files, "eml.xml": files["eml.xml"].replace("__EDITION_ID__", editionId) }, archiveDigest,
  };
}

async function buildFiles(args: { rows: ExportRow[]; mediaRows: ExportMediaRow[]; input: BuildInput; builtAtIso: string; baseUrl: string }) {
  const sorted = [...args.rows].sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  const sortedMedia = [...args.mediaRows].sort((a, b) => (a.occurrenceId === b.occurrenceId ? a.assetId.localeCompare(b.assetId) : a.occurrenceId.localeCompare(b.occurrenceId)));
  const occurrence = [OCCURRENCE_COLUMNS.map(([name]) => name).join("\t"), ...sorted.map((row) => OCCURRENCE_COLUMNS.map(([name]) => tabSafe(row.values[name])).join("\t"))].join("\n") + "\n";
  const multimedia = [MULTIMEDIA_COLUMNS.map(([name]) => name).join("\t"), ...sortedMedia.map((row) => MULTIMEDIA_COLUMNS.map(([name]) => tabSafe(row.values[name])).join("\t"))].join("\n") + "\n";
  return { "occurrence.txt": occurrence, "multimedia.txt": multimedia, "meta.xml": buildMetaXml(), "eml.xml": buildEmlXml({ ...args, rows: sorted }) };
}

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildMetaXml(): string {
  const fields = (columns: ReadonlyArray<readonly [string, string]>, from: number) =>
    columns.slice(from).map(([, term], index) => `    <field index="${index + from}" term="${term}"/>`).join("\n");
  const attrs = `encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="1"`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">
  <core ${attrs} rowType="${DWC}Occurrence">
    <files><location>occurrence.txt</location></files>
    <id index="0"/>
${fields(OCCURRENCE_COLUMNS, 0)}
  </core>
  <extension ${attrs} rowType="http://rs.gbif.org/terms/1.0/Multimedia">
    <files><location>multimedia.txt</location></files>
    <coreid index="0"/>
${fields(MULTIMEDIA_COLUMNS, 1)}
  </extension>
</archive>
`;
}

function buildEmlXml(args: { rows: ExportRow[]; input: BuildInput; builtAtIso: string; baseUrl: string }): string {
  const org = escapeXml(args.input.publisher?.organizationName ?? "IKIMON株式会社");
  const email = args.input.publisher?.contactEmail ? `<electronicMailAddress>${escapeXml(args.input.publisher.contactEmail)}</electronicMailAddress>` : "";
  const title = escapeXml(args.input.datasetTitle ?? "ZUKAN 人が確認した生きものの記録（日本）");
  const dates = args.rows.map((row) => row.values.eventDate!).filter(Boolean).sort();
  const temporal = dates.length > 0 ? `<temporalCoverage><rangeOfDates><beginDate><calendarDate>${dates[0]}</calendarDate></beginDate><endDate><calendarDate>${dates[dates.length - 1]}</calendarDate></endDate></rangeOfDates></temporalCoverage>` : "";
  const party = `<organizationName>${org}</organizationName>${email}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1" xmlns:dc="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="eml://ecoinformatics.org/eml-2.1.1 http://rs.gbif.org/schema/eml-gbif-profile/1.1/eml.xsd" packageId="__EDITION_ID__" system="${escapeXml(args.baseUrl)}" scope="system" xml:lang="ja">
  <dataset>
    <title xml:lang="ja">${title}</title>
    <creator>${party}</creator>
    <metadataProvider>${party}</metadataProvider>
    <pubDate>${args.builtAtIso.slice(0, 10)}</pubDate>
    <language>ja</language>
    <abstract><para>ZUKANに投稿された生きものの記録のうち、人が確認し、投稿者が共有を選び、確認から${GBIF_STABLE_DAYS}日間変更がなかったものだけを集めた、出現記録のデータです。場所は公開地図と同じぼかした格子の中心で、正確な位置は含みません。</para></abstract>
    <intellectualRights><para>This work is licensed under a <ulink url="${GBIF_DATA_LICENSE_URI}"><citetitle>Creative Commons Attribution (CC BY) 4.0 License</citetitle></ulink>.</para></intellectualRights>
    <coverage>
      <geographicCoverage><geographicDescription>Japan</geographicDescription><boundingCoordinates><westBoundingCoordinate>122.9</westBoundingCoordinate><eastBoundingCoordinate>153.99</eastBoundingCoordinate><northBoundingCoordinate>45.6</northBoundingCoordinate><southBoundingCoordinate>20.4</southBoundingCoordinate></boundingCoordinates></geographicCoverage>
      ${temporal}
    </coverage>
    <maintenance><description><para>週1回、全件を作り直します。共有をやめた記録は次の版から外れます。</para></description><maintenanceUpdateFrequency>weekly</maintenanceUpdateFrequency></maintenance>
    <contact>${party}</contact>
    <methods>
      <methodStep><description><para>参加者が自然の中で撮影した写真・動画を投稿し、独立した複数の人（または専門家）が名前を確認した記録だけを対象にします。AIの推定だけの名前は含みません。</para></description></methodStep>
      <qualityControl><description><para>確認から${GBIF_STABLE_DAYS}日間変更がないこと、異議がないこと、希少種の保護判定が済んでいることを条件にしています。</para></description></qualityControl>
    </methods>
  </dataset>
</eml:eml>
`;
}

export function zipStore(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)];
    const local = new Uint8Array([...u32(0x04034b50), ...common, ...nameBytes]);
    parts.push(local, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...common.slice(0, 26), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes]));
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, item) => sum + item.length, 0));
  let position = 0;
  for (const item of all) { out.set(item, position); position += item.length; }
  return out;
}

export async function recordEdition(db: GbifDb, build: GbifEditionBuild): Promise<{ withdrawnOccurrenceIds: string[] }> {
  const previous = (await db.query("SELECT edition_id FROM gbif_editions WHERE status = 'built' ORDER BY built_at DESC, edition_id DESC LIMIT 1", []))[0];
  const current = new Set(build.rows.map((row) => row.occurrenceId));
  let withdrawn: string[] = [];
  if (previous) {
    const prior = await db.query("SELECT occurrence_id FROM gbif_edition_members WHERE edition_id = ?", [previous.edition_id]);
    withdrawn = prior.map((row) => String(row.occurrence_id)).filter((id) => !current.has(id));
  }
  for (const part of chunkOf(build.rows, 30)) {
    await db.run(
      `INSERT OR IGNORE INTO gbif_occurrence_ids (occurrence_id, observation_id, issued_at) VALUES ${part.map(() => "(?, ?, ?)").join(", ")}`,
      part.flatMap((row) => [row.occurrenceId, row.observationId, build.builtAtIso]),
    );
  }
  await db.run(
    `INSERT INTO gbif_editions (edition_id, rule_version, sensitive_list_version, built_at, occurrence_count, media_count, withdrawn_count, archive_digest, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'building')`,
    [build.editionId, build.ruleVersion, build.sensitiveListVersion, build.builtAtIso, build.rows.length, build.mediaRows.length, withdrawn.length, build.archiveDigest],
  );
  for (const part of chunkOf(build.rows, 20)) {
    const statements: GbifStatement[] = [{
      sql: `INSERT INTO gbif_edition_members (edition_id, occurrence_id, row_digest, media_count) VALUES ${part.map(() => "(?, ?, ?, ?)").join(", ")}`,
      values: part.flatMap((row) => [build.editionId, row.occurrenceId, row.digest, row.mediaCount]),
    }];
    await db.batch(statements);
  }
  await db.batch([
    { sql: "UPDATE gbif_editions SET status = 'superseded' WHERE status = 'built' AND edition_id <> ?", values: [build.editionId] },
    { sql: "UPDATE gbif_editions SET status = 'built' WHERE edition_id = ?", values: [build.editionId] },
  ]);
  return { withdrawnOccurrenceIds: withdrawn };
}

export type { ConfirmedTaxon };
