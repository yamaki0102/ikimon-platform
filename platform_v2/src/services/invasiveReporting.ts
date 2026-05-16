import type { PoolClient } from "pg";
import type { EmitAlertsContext } from "./alertDispatcher.js";

export type InvasiveReportingEmitSummary = {
  matchedRules: number;
  pendingDeliveries: number;
  suppressedNoPermission: number;
};

type ReportingRuleRow = {
  rule_id: string;
  contact_id: string;
  jurisdiction_id: string;
  alert_recipient_id: string | null;
  organization_name: string;
  department_name: string | null;
  contact_role: string;
  delivery_mode: string;
  email: string | null;
  phone: string | null;
  form_url: string | null;
  api_endpoint: string | null;
  send_permission_status: string;
  supported_languages: unknown;
  official_url: string | null;
  reporting_category: string;
  urgency: string;
  taxon_names: unknown;
  mhlw_categories: unknown;
  required_fields: unknown;
  handling_warnings: unknown;
  user_guidance_ja: string | null;
  authority_guidance_ja: string | null;
  country_code: string;
  admin_area_1: string | null;
  admin_area_2: string | null;
  municipality: string | null;
  locality_label: string;
  languages: unknown;
  timezone: string;
};

type ObservationReportingDetail = {
  occurrenceId: string;
  visitId: string;
  observedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateUncertaintyM: string | number | null;
  localityNote: string | null;
  note: string | null;
  individualCount: number | null;
  photoUrls: string[];
};

const EMPTY_SUMMARY: InvasiveReportingEmitSummary = {
  matchedRules: 0,
  pendingDeliveries: 0,
  suppressedNoPermission: 0,
};

export function isInvasiveReportingTrigger(invasiveStatus: string | null): boolean {
  return invasiveStatus === "iaspecified" || invasiveStatus === "priority";
}

export async function emitInvasiveReportingForOccurrence(
  client: PoolClient,
  ctx: EmitAlertsContext,
): Promise<InvasiveReportingEmitSummary> {
  if (!isInvasiveReportingTrigger(ctx.invasiveStatus)) return { ...EMPTY_SUMMARY };
  if (!ctx.prefecture && !ctx.municipality) return { ...EMPTY_SUMMARY };

  try {
    const rules = await findMatchingReportingRules(client, ctx);
    if (rules.length === 0) return { ...EMPTY_SUMMARY };
    const detail = await loadObservationReportingDetail(client, ctx);
    const summary: InvasiveReportingEmitSummary = {
      matchedRules: rules.length,
      pendingDeliveries: 0,
      suppressedNoPermission: 0,
    };

    for (const rule of rules) {
      const payload = buildInvasiveReportingPayload(ctx, detail, rule);
      await insertReportingEvent(client, ctx, rule, "candidate", payload);

      const canSend =
        rule.send_permission_status === "approved" &&
        rule.delivery_mode === "email" &&
        Boolean(rule.alert_recipient_id);
      if (!canSend) {
        await insertReportingEvent(client, ctx, rule, "suppressed_no_permission", payload);
        summary.suppressedNoPermission += 1;
        continue;
      }

      const delivery = await client.query<{ delivery_id: string }>(
        `INSERT INTO alert_deliveries (
            occurrence_id, recipient_id, trigger_kind, channel, payload_json
         )
         VALUES ($1::text, $2::uuid, 'municipality_invasive', 'email', $3::jsonb)
         ON CONFLICT (occurrence_id, recipient_id, trigger_kind) WHERE recipient_id IS NOT NULL DO NOTHING
         RETURNING delivery_id::text`,
        [ctx.occurrenceId, rule.alert_recipient_id, JSON.stringify(payload)],
      );
      const deliveryId = delivery.rows[0]?.delivery_id ?? null;
      if (deliveryId) {
        await insertReportingEvent(client, ctx, rule, "pending_delivery", payload, deliveryId);
        summary.pendingDeliveries += 1;
      }
    }

    return summary;
  } catch (err) {
    if (isMissingReportingTableError(err)) return { ...EMPTY_SUMMARY };
    throw err;
  }
}

export function buildInvasiveReportingPayload(
  ctx: EmitAlertsContext,
  detail: ObservationReportingDetail | null,
  rule: Pick<
    ReportingRuleRow,
    | "rule_id"
    | "contact_id"
    | "organization_name"
    | "department_name"
    | "delivery_mode"
    | "send_permission_status"
    | "official_url"
    | "reporting_category"
    | "urgency"
    | "required_fields"
    | "handling_warnings"
    | "user_guidance_ja"
    | "authority_guidance_ja"
    | "country_code"
    | "admin_area_1"
    | "admin_area_2"
    | "municipality"
    | "locality_label"
    | "supported_languages"
  >,
): Record<string, unknown> {
  const requiredFields = normalizeStringArray(rule.required_fields);
  const handlingWarnings = normalizeStringArray(rule.handling_warnings);
  return {
    occurrenceId: ctx.occurrenceId,
    visitId: ctx.visitId,
    triggerKind: "municipality_invasive",
    confidenceBoundary: "AI候補であり、確定同定ではありません。機関側で確認してください。",
    subject: {
      scientificName: ctx.scientificName,
      vernacularName: ctx.vernacularName,
      genus: ctx.genus ?? null,
      family: ctx.family ?? null,
      orderName: ctx.orderName ?? null,
      className: ctx.className ?? null,
    },
    place: {
      prefecture: ctx.prefecture ?? rule.admin_area_1 ?? null,
      municipality: ctx.municipality ?? rule.municipality ?? null,
      localityLabel: rule.locality_label,
      latitude: detail?.latitude ?? null,
      longitude: detail?.longitude ?? null,
      coordinateUncertaintyM: detail?.coordinateUncertaintyM ?? null,
      localityNote: detail?.localityNote ?? null,
    },
    observation: {
      observedAt: detail?.observedAt ?? null,
      note: detail?.note ?? null,
      individualCount: detail?.individualCount ?? null,
      photoUrls: detail?.photoUrls ?? [],
      publicUrl: `https://ikimon.life/observations/${encodeURIComponent(ctx.visitId)}`,
    },
    invasiveStatus: ctx.invasiveStatus,
    reporting: {
      ruleId: rule.rule_id,
      contactId: rule.contact_id,
      organizationName: rule.organization_name,
      departmentName: rule.department_name ?? "",
      deliveryMode: rule.delivery_mode,
      sendPermissionStatus: rule.send_permission_status,
      category: rule.reporting_category,
      urgency: rule.urgency,
      requiredFields,
      handlingWarnings,
      userGuidanceJa: rule.user_guidance_ja ?? "",
      authorityGuidanceJa: rule.authority_guidance_ja ?? "",
      officialUrl: rule.official_url ?? "",
      supportedLanguages: normalizeStringArray(rule.supported_languages),
      jurisdiction: {
        countryCode: rule.country_code,
        adminArea1: rule.admin_area_1,
        adminArea2: rule.admin_area_2,
        municipality: rule.municipality,
      },
    },
  };
}

async function findMatchingReportingRules(
  client: PoolClient,
  ctx: EmitAlertsContext,
): Promise<ReportingRuleRow[]> {
  const taxonCandidates = [
    ctx.scientificName,
    ctx.vernacularName,
    ctx.genus,
    ctx.family,
    ctx.orderName,
    ctx.className,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const result = await client.query<ReportingRuleRow>(
    `SELECT
        r.rule_id::text,
        c.contact_id::text,
        j.jurisdiction_id::text,
        c.alert_recipient_id::text,
        c.organization_name,
        c.department_name,
        c.contact_role,
        c.delivery_mode,
        c.email,
        c.phone,
        c.form_url,
        c.api_endpoint,
        c.send_permission_status,
        c.supported_languages,
        c.official_url,
        r.reporting_category,
        r.urgency,
        r.taxon_names,
        r.mhlw_categories,
        r.required_fields,
        r.handling_warnings,
        r.user_guidance_ja,
        r.authority_guidance_ja,
        j.country_code,
        j.admin_area_1,
        j.admin_area_2,
        j.municipality,
        j.locality_label,
        j.languages,
        j.timezone
       FROM invasive_reporting_rules r
       JOIN invasive_reporting_contacts c ON c.contact_id = r.contact_id
       JOIN reporting_jurisdictions j ON j.jurisdiction_id = r.jurisdiction_id
      WHERE r.is_active = true
        AND (r.active_from IS NULL OR r.active_from <= CURRENT_DATE)
        AND (r.active_until IS NULL OR r.active_until >= CURRENT_DATE)
        AND (c.active_from IS NULL OR c.active_from <= CURRENT_DATE)
        AND (c.active_until IS NULL OR c.active_until >= CURRENT_DATE)
        AND j.country_code = COALESCE($1::text, j.country_code)
        AND ($2::text IS NULL OR j.admin_area_1 IS NULL OR j.admin_area_1 = $2)
        AND ($3::text IS NULL OR j.municipality IS NULL OR j.municipality = $3)
        AND (
          jsonb_array_length(r.mhlw_categories) = 0
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(r.mhlw_categories) AS cat(value)
             WHERE lower(cat.value) = lower(COALESCE($4::text, ''))
          )
        )
        AND (
          jsonb_array_length(r.taxon_names) = 0
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(r.taxon_names) AS taxon(value)
             WHERE lower(taxon.value) = ANY($5::text[])
          )
        )
      ORDER BY
        CASE r.urgency WHEN 'urgent' THEN 0 WHEN 'seasonal' THEN 1 ELSE 2 END,
        c.send_permission_status = 'approved' DESC,
        j.municipality IS NULL,
        c.organization_name`,
    [
      "JP",
      ctx.prefecture ?? null,
      ctx.municipality ?? null,
      ctx.invasiveStatus ?? null,
      taxonCandidates.map((value) => value.toLowerCase()),
    ],
  );
  return result.rows;
}

async function loadObservationReportingDetail(
  client: PoolClient,
  ctx: EmitAlertsContext,
): Promise<ObservationReportingDetail | null> {
  const result = await client.query<{
    occurrence_id: string;
    visit_id: string;
    observed_at: string | null;
    latitude: number | null;
    longitude: number | null;
    coordinate_uncertainty_m: string | number | null;
    locality_note: string | null;
    note: string | null;
    individual_count: number | null;
    photo_urls: unknown;
  }>(
    `SELECT
        o.occurrence_id,
        o.visit_id,
        v.observed_at::text,
        v.point_latitude::float8 AS latitude,
        v.point_longitude::float8 AS longitude,
        v.coordinate_uncertainty_m,
        v.locality_note,
        COALESCE(NULLIF(o.source_payload->>'note', ''), v.note) AS note,
        o.individual_count,
        COALESCE(
          jsonb_agg(DISTINCT COALESCE(ab.public_url, ab.storage_path))
            FILTER (WHERE COALESCE(ab.public_url, ab.storage_path) IS NOT NULL AND ab.media_type = 'image'),
          '[]'::jsonb
        ) AS photo_urls
       FROM occurrences o
       JOIN visits v ON v.visit_id = o.visit_id
       LEFT JOIN evidence_assets ea ON ea.occurrence_id = o.occurrence_id OR (ea.occurrence_id IS NULL AND ea.visit_id = o.visit_id)
       LEFT JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
      WHERE o.occurrence_id = $1
      GROUP BY o.occurrence_id, o.visit_id, v.observed_at, v.point_latitude, v.point_longitude,
               v.coordinate_uncertainty_m, v.locality_note, v.note, o.source_payload, o.individual_count
      LIMIT 1`,
    [ctx.occurrenceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    occurrenceId: row.occurrence_id,
    visitId: row.visit_id,
    observedAt: row.observed_at,
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateUncertaintyM: row.coordinate_uncertainty_m,
    localityNote: row.locality_note,
    note: row.note,
    individualCount: row.individual_count,
    photoUrls: normalizeStringArray(row.photo_urls),
  };
}

async function insertReportingEvent(
  client: PoolClient,
  ctx: EmitAlertsContext,
  rule: Pick<ReportingRuleRow, "rule_id" | "contact_id" | "alert_recipient_id">,
  status: "candidate" | "suppressed_no_permission" | "pending_delivery" | "sent" | "failed",
  payload: Record<string, unknown>,
  deliveryId: string | null = null,
): Promise<void> {
  await client.query(
    `INSERT INTO invasive_reporting_events (
        occurrence_id, visit_id, rule_id, contact_id, recipient_id, delivery_id,
        event_status, trigger_source, invasive_status, payload_json
     )
     VALUES ($1::text, $2::text, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
             $7, 'ai_reassess', $8, $9::jsonb)`,
    [
      ctx.occurrenceId,
      ctx.visitId,
      rule.rule_id,
      rule.contact_id,
      rule.alert_recipient_id,
      deliveryId,
      status,
      ctx.invasiveStatus,
      JSON.stringify(payload),
    ],
  );
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    try {
      return normalizeStringArray(JSON.parse(value));
    } catch {
      return value.length > 0 ? [value] : [];
    }
  }
  if (value && typeof value === "object") {
    return Object.values(value).map((item) => String(item)).filter((item) => item.length > 0);
  }
  return [];
}

function isMissingReportingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "42P01" || code === "42703";
}
