import type { Pool, PoolClient } from "pg";
import { getPool } from "../db.js";
import {
  PUBLIC_OBSERVATION_DISCOVERY_EXCLUSION_SQL,
  PUBLIC_OBSERVATION_QUALITY_SQL,
  VALID_OBSERVATION_PHOTO_ASSET_SQL,
  isMeaningfulPublicObservationLabel,
} from "./observationQualityGate.js";
import {
  normalizeObservationDataRights,
  type ObservationDataRightsInput,
} from "./observationDataRights.js";
import { loadAreaSnapshotVisitIds } from "./areaSnapshotVisitScope.js";
import { decidePublicCoord, isSensitive, loadSensitiveSpeciesIndex } from "./sensitiveSpeciesMasking.js";
import { PRODUCTION_PUBLIC_ORIGIN } from "./trustedPublicOrigin.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export const PUBLICATION_FEED_API_VERSION = "1";
export const PUBLICATION_FEED_POLICY_VERSION = "public-feed-v1";
export const PUBLICATION_FEED_DEFAULT_LIMIT = 12;
export const PUBLICATION_FEED_MAX_LIMIT = 24;

export const PUBLICATION_FEED_CHANNEL_KEYS = ["living", "community_photo"] as const;
export type PublicationFeedKnownChannelKey = (typeof PUBLICATION_FEED_CHANNEL_KEYS)[number];
export type PublicationFeedChannelKey = string;
export type PublicationFeedLocale = "ja" | "en";
export type PublicationFeedScopeKind = "entity" | "place" | "field";
export type PublicationFeedCategory = "area" | "facility" | "school" | "municipality" | "organization";

export type LocalizedPublicationText = string | Partial<Record<PublicationFeedLocale, string>>;

export type PublicationFeedScopeRef = {
  kind: PublicationFeedScopeKind;
  id: string;
};

export type PublicationFeedChannelConfig = {
  key: PublicationFeedChannelKey;
  label: LocalizedPublicationText;
};

export type PublicationFeedConfig = {
  feedKey: string;
  title: LocalizedPublicationText;
  scopeLabel: LocalizedPublicationText;
  locale: PublicationFeedLocale;
  scopeKind: PublicationFeedCategory;
  scope: readonly PublicationFeedScopeRef[];
  channels: readonly PublicationFeedChannelConfig[];
  publicationPolicyVersion: string;
  updatedAt: string;
  allowedConsumerOrigins?: readonly string[];
};

const japaneseChannelLabels: Record<PublicationFeedKnownChannelKey, string> = {
  living: "この場所の生きもの",
  community_photo: "みんなのフォト",
};

const englishChannelLabels: Record<PublicationFeedKnownChannelKey, string> = {
  living: "Living things here",
  community_photo: "Community photos",
};

function localizedText(value: LocalizedPublicationText, locale: PublicationFeedLocale): string {
  if (typeof value === "string") return value;
  const selected = value[locale] ?? value.ja ?? value.en;
  return typeof selected === "string" ? selected : "";
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeIsoDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function confidenceValue(value: unknown): number | null {
  const parsed = numericValue(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(1, parsed));
}

function positiveInteger(value: unknown): number | null {
  const parsed = numericValue(value);
  if (parsed === null || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function safePublicMediaUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
      return null;
    }
    for (const key of parsed.searchParams.keys()) {
      if (/(?:token|signature|credential|secret|access[_-]?key|auth|session)/i.test(key)) return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function scopeConfig(
  input: Omit<PublicationFeedConfig, "publicationPolicyVersion"> & { publicationPolicyVersion?: string },
): PublicationFeedConfig {
  return Object.freeze({
    ...input,
    publicationPolicyVersion: input.publicationPolicyVersion ?? PUBLICATION_FEED_POLICY_VERSION,
    scope: Object.freeze(input.scope.map((scope) => Object.freeze({ ...scope }))),
    channels: Object.freeze(input.channels.map((channel) => Object.freeze({ ...channel }))),
  });
}

export const PUBLICATION_FEED_CONFIGS: Readonly<Record<string, PublicationFeedConfig>> = Object.freeze({
  "miyakoda-renri-area": scopeConfig({
    feedKey: "miyakoda-renri-area",
    title: "この場所で見つけたもの",
    scopeLabel: "浜松・都田",
    locale: "ja",
    scopeKind: "area",
    scope: [{ kind: "entity", id: "ikimon:aikan:renri-no-ki" }],
    channels: [
      { key: "living", label: { ja: japaneseChannelLabels.living, en: englishChannelLabels.living } },
      { key: "community_photo", label: { ja: japaneseChannelLabels.community_photo, en: englishChannelLabels.community_photo } },
    ],
    updatedAt: "2026-08-28T00:00:00.000Z",
    allowedConsumerOrigins: [
      "https://lenrinokinoshitade.com",
      "https://lenrinokinoshitade-top-staging.pages.dev",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
  }),
});

export function definePublicationFeedConfig(
  input: Omit<PublicationFeedConfig, "publicationPolicyVersion"> & { publicationPolicyVersion?: string },
): PublicationFeedConfig {
  return scopeConfig(input);
}

export function getPublicationFeedConfig(feedKey: string): PublicationFeedConfig | null {
  return Object.prototype.hasOwnProperty.call(PUBLICATION_FEED_CONFIGS, feedKey)
    ? PUBLICATION_FEED_CONFIGS[feedKey] ?? null
    : null;
}

export type PublicationFeedCursor = {
  observedAt: string;
  recordId: string;
  channel: PublicationFeedChannelKey;
};

const CURSOR_VERSION = 1;

export function encodePublicationFeedCursor(cursor: PublicationFeedCursor): string {
  return Buffer.from(JSON.stringify({
    v: CURSOR_VERSION,
    observedAt: cursor.observedAt,
    recordId: cursor.recordId,
    channel: cursor.channel,
  }), "utf8").toString("base64url");
}

export function decodePublicationFeedCursor(value: unknown): PublicationFeedCursor | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("invalid_publication_feed_cursor");
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    const observedAt = normalizeIsoDate(decoded.observedAt);
    const recordId = cleanText(decoded.recordId);
    const channel = decoded.channel;
    if (decoded.v !== CURSOR_VERSION || !observedAt || !recordId || !isPublicationFeedChannel(channel)) {
      throw new Error("invalid_publication_feed_cursor");
    }
    return { observedAt, recordId, channel };
  } catch {
    throw new Error("invalid_publication_feed_cursor");
  }
}

function isPublicationFeedChannel(value: unknown): value is PublicationFeedChannelKey {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

export type PublicationFeedCandidateRow = {
  recordId: string;
  visitId: string;
  occurrenceId: string | null;
  channel: PublicationFeedChannelKey;
  observedAt: string;
  sourceUpdatedAt: string | null;
  placeLabel: string | null;
  vernacularName: string | null;
  scientificName: string | null;
  taxonRank: string | null;
  recordStatus: string | null;
  recordConfidence: number | string | null;
  humanName: string | null;
  humanRank: string | null;
  humanConfidence: number | string | null;
  aiName: string | null;
  aiRank: string | null;
  aiConfidence: number | string | null;
  media: {
    url: string | null;
    width: number | string | null;
    height: number | string | null;
    role: string | null;
    hasFace?: boolean;
  };
  publicVisibility: string | null;
  qualityReviewStatus: string | null;
  contextPrecision: string | null;
  riskLane: string | null;
  sensitiveSpecies?: boolean;
  rights: ObservationDataRightsInput;
  allowMultipleChannels?: boolean;
};

export type PublicationFeedClassification = {
  state: "verified" | "candidate" | "accepted" | "not_applicable";
  source: "human_review" | "ai" | "record";
  confidence: number | null;
};

export type PublicationFeedItem = {
  id: string;
  record_id: string;
  channel: PublicationFeedChannelKey;
  media: {
    url: string;
    alt: string;
    width: number | null;
    height: number | null;
  };
  title: string;
  subtitle: string | null;
  observed_at: string;
  place_label: string | null;
  detail_url: string;
  subject: { kind: "taxon" | "environment"; label: string };
  classification: PublicationFeedClassification;
  rights: { republication_allowed: true; attribution: string | null };
};

export type PublicationFeedResponse = {
  api_version: "1";
  feed: {
    feed_key: string;
    title: string;
    scope_label: string;
    updated_at: string;
    publication_policy_version: string;
  };
  channels: Array<{
    key: PublicationFeedChannelKey;
    label: string;
    items: PublicationFeedItem[];
  }>;
  next_cursor: string | null;
};

type ProjectionOptions = {
  channel?: PublicationFeedChannelKey;
  locale?: PublicationFeedLocale;
  limit?: number;
  cursor?: PublicationFeedCursor | null;
  sensitiveSpeciesIndex?: Set<string>;
};

const ANONYMOUS_VIEWER = { isAdminOrAnalyst: false, fieldRole: null } as const;

function channelPriority(channel: PublicationFeedChannelKey): number {
  return channel === "living" ? 0 : 1;
}

function compareRows(left: PublicationFeedCandidateRow, right: PublicationFeedCandidateRow): number {
  const leftObserved = Date.parse(left.observedAt);
  const rightObserved = Date.parse(right.observedAt);
  if (leftObserved !== rightObserved) return rightObserved - leftObserved;
  const channelCompare = channelPriority(left.channel) - channelPriority(right.channel);
  if (channelCompare !== 0) return channelCompare;
  const channelNameCompare = left.channel.localeCompare(right.channel);
  if (channelNameCompare !== 0) return channelNameCompare;
  const recordCompare = left.recordId.localeCompare(right.recordId);
  if (recordCompare !== 0) return recordCompare;
  return left.visitId.localeCompare(right.visitId);
}

function isAfterCursor(row: PublicationFeedCandidateRow, cursor: PublicationFeedCursor): boolean {
  const rowObserved = Date.parse(row.observedAt);
  const cursorObserved = Date.parse(cursor.observedAt);
  if (rowObserved !== cursorObserved) return rowObserved < cursorObserved;
  const channelCompare = channelPriority(row.channel) - channelPriority(cursor.channel);
  if (channelCompare !== 0) return channelCompare > 0;
  const channelNameCompare = row.channel.localeCompare(cursor.channel);
  if (channelNameCompare !== 0) return channelNameCompare > 0;
  const recordCompare = row.recordId.localeCompare(cursor.recordId);
  if (recordCompare !== 0) return recordCompare > 0;
  return false;
}

function rowClassification(row: PublicationFeedCandidateRow): { label: string; classification: PublicationFeedClassification } | null {
  const occurrenceLabel = cleanText(row.vernacularName) ?? cleanText(row.scientificName);
  const humanLabel = cleanText(row.humanName);
  const aiLabel = cleanText(row.aiName);
  const recordStatus = cleanText(row.recordStatus)?.toLowerCase();

  if (humanLabel || recordStatus === "reviewer_verified") {
    const label = humanLabel ?? occurrenceLabel;
    if (label && isMeaningfulPublicObservationLabel(label)) {
      return {
        label,
        classification: {
          state: "verified",
          source: "human_review",
          confidence: confidenceValue(row.humanConfidence) ?? confidenceValue(row.recordConfidence),
        },
      };
    }
  }

  const aiCandidateLabel = aiLabel || (recordStatus === "ai_judgement" || recordStatus === "ai_candidate" || recordStatus === "ai_audio_candidate"
    ? occurrenceLabel
    : null);
  if (aiCandidateLabel && isMeaningfulPublicObservationLabel(aiCandidateLabel)) {
    return {
      label: aiCandidateLabel,
      classification: {
        state: "candidate",
        source: "ai",
        confidence: confidenceValue(row.aiConfidence) ?? confidenceValue(row.recordConfidence),
      },
    };
  }

  if (occurrenceLabel && isMeaningfulPublicObservationLabel(occurrenceLabel)) {
    return {
      label: occurrenceLabel,
      classification: {
        state: "accepted",
        source: "record",
        confidence: confidenceValue(row.recordConfidence),
      },
    };
  }

  return null;
}

function rightsAllowExternalExport(row: PublicationFeedCandidateRow): boolean {
  const rights = normalizeObservationDataRights({
    ...row.rights,
    visitId: row.visitId,
    occurrenceId: row.occurrenceId,
  });
  return rights.externalExportAllowed;
}

function rowIsPubliclyEligible(row: PublicationFeedCandidateRow, sensitiveSpeciesIndex: Set<string>): boolean {
  if (row.publicVisibility !== "public" || row.qualityReviewStatus !== "accepted") return false;
  if (!rightsAllowExternalExport(row)) return false;
  if (row.sensitiveSpecies === true || row.media.hasFace === true) return false;
  if (row.channel === "community_photo" && !isCommunityPhotoRole(row.media.role)) return false;

  const coordDecision = decidePublicCoord(
    {
      scientificName: row.scientificName,
      vernacularName: row.vernacularName,
      contextPrecision: row.contextPrecision as "exact_private" | "site" | "mesh" | "municipality" | "hidden" | null,
      riskLane: row.riskLane,
    },
    ANONYMOUS_VIEWER,
    sensitiveSpeciesIndex,
  );
  if (coordDecision.mode !== "exact") return false;
  if (isSensitive(row.scientificName, sensitiveSpeciesIndex)) return false;
  return safePublicMediaUrl(row.media.url) !== null;
}

function isCommunityPhotoRole(value: unknown): boolean {
  const role = cleanText(value)?.toLowerCase();
  return role === "context" || role === "habitat_wide" || role === "substrate" || role === "scale_reference";
}

function projectRow(row: PublicationFeedCandidateRow): PublicationFeedItem | null {
  const observedAt = normalizeIsoDate(row.observedAt);
  const recordId = cleanText(row.recordId);
  const mediaUrl = safePublicMediaUrl(row.media.url);
  if (!observedAt || !recordId || !mediaUrl) return null;

  const livingClassification = row.channel === "living" ? rowClassification(row) : null;
  if (row.channel === "living" && !livingClassification) return null;
  const title = livingClassification?.label ?? cleanText(row.placeLabel) ?? "周辺環境";
  const alt = `${title}の写真`;
  return {
    id: `${row.channel}:${recordId}`,
    record_id: recordId,
    channel: row.channel,
    media: {
      url: mediaUrl,
      alt,
      width: positiveInteger(row.media.width),
      height: positiveInteger(row.media.height),
    },
    title,
    subtitle: cleanText(row.placeLabel),
    observed_at: observedAt,
    place_label: cleanText(row.placeLabel),
    detail_url: `${PRODUCTION_PUBLIC_ORIGIN}/observations/${encodeURIComponent(recordId)}`,
    subject: row.channel === "living"
      ? { kind: "taxon", label: livingClassification!.label }
      : { kind: "environment", label: "周辺環境" },
    classification: livingClassification?.classification ?? {
      state: "not_applicable",
      source: "record",
      confidence: null,
    },
    rights: {
      republication_allowed: true,
      attribution: null,
    },
  };
}

function latestUpdatedAt(config: PublicationFeedConfig, rows: PublicationFeedCandidateRow[]): string {
  const dates = [config.updatedAt, ...rows.map((row) => row.sourceUpdatedAt ?? row.observedAt)]
    .map(normalizeIsoDate)
    .filter((value): value is string => value !== null)
    .sort();
  return dates.at(-1) ?? new Date(0).toISOString();
}

export function projectPublicationFeed(
  config: PublicationFeedConfig,
  rows: readonly PublicationFeedCandidateRow[],
  options: ProjectionOptions = {},
): PublicationFeedResponse {
  const locale = options.locale ?? config.locale;
  const requestedLimit = options.limit ?? PUBLICATION_FEED_DEFAULT_LIMIT;
  const limit = Math.max(1, Math.min(PUBLICATION_FEED_MAX_LIMIT, Math.trunc(requestedLimit)));
  const sensitiveSpeciesIndex = options.sensitiveSpeciesIndex ?? new Set<string>();
  const selectedChannels = config.channels.filter((channel) => !options.channel || channel.key === options.channel);
  const selectedChannelKeys = new Set(selectedChannels.map((channel) => channel.key));

  const eligibleRows = rows
    .filter((row) => selectedChannelKeys.has(row.channel))
    .filter((row) => rowIsPubliclyEligible(row, sensitiveSpeciesIndex))
    .sort(compareRows);

  const dedupedRows: PublicationFeedCandidateRow[] = [];
  const defaultRecordChannels = new Set<string>();
  const defaultVisitChannels = new Map<string, PublicationFeedChannelKey>();
  for (const row of eligibleRows) {
    const recordKey = `${row.recordId}`;
    if (!row.allowMultipleChannels && defaultRecordChannels.has(recordKey)) continue;
    if (!row.allowMultipleChannels) {
      const existingVisitChannel = defaultVisitChannels.get(row.visitId);
      if (existingVisitChannel && existingVisitChannel !== row.channel) continue;
    }
    dedupedRows.push(row);
    if (!row.allowMultipleChannels) {
      defaultRecordChannels.add(recordKey);
      defaultVisitChannels.set(row.visitId, row.channel);
    }
  }

  const afterCursor = options.cursor
    ? dedupedRows.filter((row) => isAfterCursor(row, options.cursor!))
    : dedupedRows;
  const pageRows = afterCursor.slice(0, limit + 1);
  const hasMore = pageRows.length > limit;
  const visibleRows = hasMore ? pageRows.slice(0, limit) : pageRows;
  const items = visibleRows.map(projectRow).filter((item): item is PublicationFeedItem => item !== null);
  const lastRow = visibleRows.at(-1);

  return {
    api_version: "1",
    feed: {
      feed_key: config.feedKey,
      title: localizedText(config.title, locale),
      scope_label: localizedText(config.scopeLabel, locale),
      updated_at: latestUpdatedAt(config, eligibleRows),
      publication_policy_version: config.publicationPolicyVersion,
    },
    channels: selectedChannels.map((channel) => ({
      key: channel.key,
      label: localizedText(channel.label, locale),
      items: items.filter((item) => item.channel === channel.key),
    })),
    next_cursor: hasMore && lastRow
      ? encodePublicationFeedCursor({
          observedAt: normalizeIsoDate(lastRow.observedAt) ?? new Date(0).toISOString(),
          recordId: lastRow.recordId,
          channel: lastRow.channel,
        })
      : null,
  };
}

type PublicationFeedDbRow = {
  record_id: string;
  visit_id: string;
  occurrence_id: string | null;
  channel: string;
  observed_at: string;
  source_updated_at: string | null;
  place_label: string | null;
  vernacular_name: string | null;
  scientific_name: string | null;
  taxon_rank: string | null;
  record_status: string | null;
  record_confidence: string | null;
  human_name: string | null;
  human_rank: string | null;
  human_confidence: string | null;
  ai_name: string | null;
  ai_rank: string | null;
  ai_confidence: string | null;
  media_url: string | null;
  media_width: number | null;
  media_height: number | null;
  media_role: string | null;
  media_has_face: boolean | null;
  public_visibility: string | null;
  quality_review_status: string | null;
  context_precision: string | null;
  risk_lane: string | null;
  risk_status_sensitive: boolean | null;
  record_consent: string | null;
  research_use_consent: string | null;
  dataset_license: string | null;
  media_license: string | null;
  external_export_allowed: boolean | null;
  withdrawal_status: string | null;
};

export const PUBLICATION_FEED_SOURCE_SQL = `
  with feed_channels(channel) as (
    values ('living'::text), ('community_photo'::text)
  )
  select
    case when feed_channels.channel = 'community_photo' then v.visit_id else coalesce(o.occurrence_id, v.visit_id) end as record_id,
    v.visit_id,
    o.occurrence_id,
    feed_channels.channel,
    v.observed_at::text as observed_at,
    greatest(v.updated_at, coalesce(o.updated_at, v.updated_at), rights.updated_at, photo.created_at)::text as source_updated_at,
    nullif(concat_ws(' / ', nullif(v.observed_municipality, ''), nullif(v.observed_prefecture, '')), '') as place_label,
    o.vernacular_name,
    o.scientific_name,
    o.taxon_rank,
    coalesce(nullif(o.ai_assessment_status, ''), nullif(o.data_quality, '')) as record_status,
    o.confidence_score::text as record_confidence,
    human.proposed_name as human_name,
    human.proposed_rank as human_rank,
    human.confidence_score as human_confidence,
    ai.recommended_taxon_name as ai_name,
    ai.recommended_rank as ai_rank,
    ai.confidence_score as ai_confidence,
    photo.public_url as media_url,
    photo.width_px as media_width,
    photo.height_px as media_height,
    photo.media_role as media_role,
    photo.has_face as media_has_face,
    v.public_visibility,
    v.quality_review_status,
    civic.context_precision,
    civic.risk_lane,
    exists (
      select 1
        from risk_status_versions sensitive_status
       where sensitive_status.valid_to is null
         and sensitive_status.redlist_category in ('CR', 'EN', 'VU', 'NT', 'EW', 'EX')
         and lower(trim(sensitive_status.scientific_name)) = lower(trim(o.scientific_name))
    ) as risk_status_sensitive,
    rights.record_consent,
    rights.research_use_consent,
    rights.dataset_license,
    rights.media_license,
    rights.external_export_allowed,
    rights.withdrawal_status
  from visits v
  cross join feed_channels
  left join occurrences o on o.visit_id = v.visit_id
  join observation_data_rights rights on rights.visit_id = v.visit_id
  left join lateral (
    select i.proposed_name, i.proposed_rank, i.confidence_score::text as confidence_score
      from identifications i
     where o.occurrence_id is not null
       and i.occurrence_id = o.occurrence_id
       and coalesce(i.is_current, true) = true
       and i.actor_kind = 'human'
       and nullif(trim(i.proposed_name), '') is not null
     order by i.created_at desc, i.identification_id
     limit 1
  ) human on true
  left join lateral (
    select a.recommended_taxon_name,
           a.recommended_rank,
           a.raw_json->>'confidence_score' as confidence_score
      from observation_ai_assessments a
     where (
             (o.occurrence_id is not null and a.occurrence_id = o.occurrence_id)
          or (o.occurrence_id is null and a.visit_id = v.visit_id)
           )
       and nullif(trim(a.recommended_taxon_name), '') is not null
     order by a.generated_at desc, a.assessment_id
     limit 1
  ) ai on true
  join lateral (
    select
      ab.public_url,
      ab.width_px,
      ab.height_px,
      ea.role_tag,
      coalesce(mr.media_role, ea.role_tag) as media_role,
      ea.created_at,
      (
        coalesce(lower(ea.source_payload->'facePrivacy'->>'hasFace'), 'false') in ('true', '1', 'yes')
        or coalesce(lower(ab.source_payload->'facePrivacy'->>'hasFace'), 'false') in ('true', '1', 'yes')
      ) as has_face
      from evidence_assets ea
      join asset_blobs ab on ab.blob_id = ea.blob_id
      left join evidence_asset_media_roles mr on mr.asset_id = ea.asset_id
     where (ea.occurrence_id = o.occurrence_id or ea.visit_id = v.visit_id)
       and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
       and nullif(ab.public_url, '') is not null
       and coalesce(lower(ea.source_payload->'facePrivacy'->>'hasFace'), 'false') not in ('true', '1', 'yes')
       and coalesce(lower(ab.source_payload->'facePrivacy'->>'hasFace'), 'false') not in ('true', '1', 'yes')
     order by
       case
         when feed_channels.channel = 'living' and (
           ea.role_tag in ('full_body', 'close_up_organ')
           or mr.media_role = 'primary_subject'
           or ea.source_payload->>'media_role' = 'primary_subject'
         ) then 0
         when feed_channels.channel = 'community_photo' and (
           ea.role_tag in ('habitat_wide', 'substrate', 'scale_reference')
           or mr.media_role = 'context'
           or ea.source_payload->>'media_role' = 'context'
         ) then 0
         else 1
       end,
       case when ea.occurrence_id = o.occurrence_id then 0 else 1 end,
       ea.captured_at desc nulls last,
       ea.created_at asc,
       ea.asset_id
     limit 1
  ) photo on true
  left join lateral (
    select max(c.public_precision) as context_precision, max(c.risk_lane) as risk_lane
      from civic_observation_contexts c
     where c.visit_id = v.visit_id
  ) civic on true
  where v.visit_id = any($1::text[])
    and ${PUBLIC_OBSERVATION_QUALITY_SQL}
    and ${PUBLIC_OBSERVATION_DISCOVERY_EXCLUSION_SQL}
    and rights.external_export_allowed = true
    and rights.record_consent = 'external_export'
    and rights.research_use_consent = 'public_export'
    and rights.dataset_license is not null
    and rights.media_license is not null
    and rights.withdrawal_status = 'active'
    and not exists (
      select 1
        from civic_observation_contexts private_context
       where private_context.visit_id = v.visit_id
         and (
           private_context.risk_lane = 'rare_sensitive'
           or private_context.public_precision in ('exact_private', 'hidden')
         )
    )
    and (
      feed_channels.channel = 'community_photo'
      or coalesce(nullif(human.proposed_name, ''), nullif(ai.recommended_taxon_name, ''), nullif(o.vernacular_name, ''), nullif(o.scientific_name, '')) is not null
    )
    and (
      feed_channels.channel = 'living'
      or lower(coalesce(photo.media_role, '')) in ('context', 'habitat_wide', 'substrate', 'scale_reference')
    )
`;

async function resolvePublicationFeedVisitIds(
  config: PublicationFeedConfig,
  queryable: Queryable,
): Promise<string[]> {
  const fieldRefs = config.scope.filter((scope) => scope.kind === "field").map((scope) => scope.id);
  const entityRefs = config.scope.filter((scope) => scope.kind === "entity").map((scope) => scope.id);
  const placeRefs = config.scope.filter((scope) => scope.kind === "place").map((scope) => scope.id);
  const visitIds = new Set<string>();

  if (placeRefs.length > 0) {
    const placeVisits = await queryable.query<{ visit_id: string }>(
      `select visit_id from visits where place_id = any($1::text[])`,
      [placeRefs],
    );
    for (const row of placeVisits.rows) visitIds.add(row.visit_id);
  }

  if (fieldRefs.length > 0 || entityRefs.length > 0) {
    const fields = await queryable.query<{
      field_id: string;
      entity_key: string | null;
      lat: number | string;
      lng: number | string;
      radius_m: number | string;
      polygon: Record<string, unknown> | null;
    }>(
      `select field_id::text, entity_key, lat, lng, radius_m, polygon
         from observation_fields
        where valid_to is null
          and (
            field_id::text = any($1::text[])
            or (coalesce(entity_key, '') <> '' and entity_key = any($2::text[]))
          )`,
      [fieldRefs, entityRefs],
    );
    for (const field of fields.rows) {
      const lat = numericValue(field.lat);
      const lng = numericValue(field.lng);
      const radiusM = numericValue(field.radius_m);
      if (lat === null || lng === null || radiusM === null) continue;
      const scoped = await loadAreaSnapshotVisitIds(
        {
          fieldId: field.field_id,
          lat,
          lng,
          radiusM,
          polygon: field.polygon,
        },
        null,
        {},
        queryable,
      );
      for (const visitId of scoped) visitIds.add(visitId);
    }
  }

  return Array.from(visitIds).sort();
}

export type GetPublicationFeedOptions = {
  feedKey: string;
  channel?: PublicationFeedChannelKey;
  locale?: PublicationFeedLocale;
  limit?: number;
  cursor?: PublicationFeedCursor | null;
  queryable?: Queryable;
  sensitiveSpeciesIndex?: Set<string>;
};

export async function getPublicationFeed(options: GetPublicationFeedOptions): Promise<PublicationFeedResponse> {
  const config = getPublicationFeedConfig(options.feedKey);
  if (!config) throw new Error("publication_feed_not_found");
  const queryable = options.queryable ?? getPool();
  const visitIds = await resolvePublicationFeedVisitIds(config, queryable);
  if (visitIds.length === 0) {
    return projectPublicationFeed(config, [], {
      channel: options.channel,
      locale: options.locale,
      limit: options.limit,
      cursor: options.cursor,
      sensitiveSpeciesIndex: options.sensitiveSpeciesIndex,
    });
  }

  const result = await queryable.query<PublicationFeedDbRow>(PUBLICATION_FEED_SOURCE_SQL, [visitIds]);
  const rows = result.rows
    .filter((row): row is PublicationFeedDbRow & { channel: PublicationFeedChannelKey } => isPublicationFeedChannel(row.channel))
    .map((row): PublicationFeedCandidateRow => ({
      recordId: row.record_id,
      visitId: row.visit_id,
      occurrenceId: row.occurrence_id,
      channel: row.channel,
      observedAt: row.observed_at,
      sourceUpdatedAt: row.source_updated_at,
      placeLabel: row.place_label,
      vernacularName: row.vernacular_name,
      scientificName: row.scientific_name,
      taxonRank: row.taxon_rank,
      recordStatus: row.record_status,
      recordConfidence: row.record_confidence,
      humanName: row.human_name,
      humanRank: row.human_rank,
      humanConfidence: row.human_confidence,
      aiName: row.ai_name,
      aiRank: row.ai_rank,
      aiConfidence: row.ai_confidence,
      media: {
        url: row.media_url,
        width: row.media_width,
        height: row.media_height,
        role: row.media_role,
        hasFace: row.media_has_face ?? false,
      },
      publicVisibility: row.public_visibility,
      qualityReviewStatus: row.quality_review_status,
      contextPrecision: row.context_precision,
      riskLane: row.risk_lane,
      sensitiveSpecies: row.risk_status_sensitive ?? false,
      rights: {
        recordConsent: row.record_consent as ObservationDataRightsInput["recordConsent"],
        researchUseConsent: row.research_use_consent as ObservationDataRightsInput["researchUseConsent"],
        datasetLicense: row.dataset_license as ObservationDataRightsInput["datasetLicense"],
        mediaLicense: row.media_license as ObservationDataRightsInput["mediaLicense"],
        externalExportAllowed: row.external_export_allowed ?? false,
        withdrawalStatus: row.withdrawal_status as ObservationDataRightsInput["withdrawalStatus"],
      },
    }));
  const sensitiveSpeciesIndex = options.sensitiveSpeciesIndex ?? await loadSensitiveSpeciesIndex();
  return projectPublicationFeed(config, rows, {
    channel: options.channel,
    locale: options.locale,
    limit: options.limit,
    cursor: options.cursor,
    sensitiveSpeciesIndex,
  });
}
