/**
 * /api/v1/me/subscriptions        Taxon follow subscription management
 * /api/v1/me/area-subscriptions   Place / field / region follow management
 * /api/v1/me/personalized-menu    Side-menu personalization feed
 * /api/v1/me/alerts               Alert delivery history
 *
 * Both route groups require a logged-in user resolved from the session cookie.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getPool } from "../db.js";
import { getSessionFromCookie } from "../services/authSession.js";

const VALID_MATCH_FIELDS = new Set([
  "scientific_name",
  "genus",
  "family",
  "order_name",
  "class_name",
]);
const VALID_RANKS = new Set(["species", "genus", "family", "order", "class", "phylum"]);
const VALID_CHANNELS = new Set(["email", "digest_daily", "digest_weekly", "none"]);
const VALID_AREA_TARGET_TYPES = new Set(["field", "place", "region"]);

type CreateBody = {
  scientificName?: string;
  taxonRank?: string;
  matchField?: string;
  triggerInvasiveOnly?: boolean;
  triggerRareOnly?: boolean;
  channel?: string;
  label?: string;
  geoFilter?: Record<string, unknown>;
};

type AreaSubscriptionBody = {
  targetType?: string;
  targetId?: string;
  label?: string;
  href?: string;
};

async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string | null> {
  const cookie = (request.headers.cookie as string | undefined) ?? undefined;
  const session = await getSessionFromCookie(cookie).catch(() => null);
  if (!session) {
    void reply.code(401).send({ ok: false, error: "auth_required" });
    return null;
  }
  return session.userId;
}

function safeLabel(value: unknown, fallback: string): string {
  const label = typeof value === "string" ? value.trim() : "";
  return (label || fallback).slice(0, 120);
}

function safeMenuHref(value: unknown, fallback: string): string {
  const href = typeof value === "string" ? value.trim() : "";
  if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\n")) {
    return fallback;
  }
  return href.slice(0, 240);
}

function areaHref(targetType: string, targetId: string): string {
  const encoded = encodeURIComponent(targetId);
  if (targetType === "field") return `/map?field=${encoded}`;
  if (targetType === "place") return `/map?place=${encoded}`;
  return `/map?region=${encoded}`;
}

function normalizeMenuHref(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";
  try {
    const url = new URL(raw, "https://ikimon.local");
    const parts = url.pathname.split("/").filter(Boolean);
    const first = parts[0];
    const langlessPath = first === "ja" || first === "en" || first === "es" || first === "pt-BR"
      ? `/${parts.slice(1).join("/")}` || "/"
      : url.pathname;
    return `${langlessPath}${url.search}`;
  } catch {
    return raw.split("#", 1)[0] ?? raw;
  }
}

function menuLabelFromHref(href: string): string {
  const normalized = normalizeMenuHref(href);
  if (normalized === "/observations?filter=needs_id") return "同定";
  if (normalized.startsWith("/map")) return "マップ";
  if (normalized.startsWith("/record")) return "記録";
  if (normalized.startsWith("/notes")) return "観察ライブラリ";
  if (normalized.startsWith("/observations")) return "観察投稿一覧";
  if (normalized.startsWith("/learn/updates")) return "更新情報";
  if (normalized.startsWith("/learn")) return "学ぶ";
  if (normalized.startsWith("/community")) return "地域";
  if (normalized.startsWith("/for-business")) return "法人";
  if (normalized.startsWith("/profile") || normalized.startsWith("/home")) return "マイページ";
  if (normalized.startsWith("/explore")) return "見つける";
  return "よく見るページ";
}

function dedupeMenuItems<T extends { href: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = `${normalizeMenuHref(item.href)}::${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function toCount(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function registerMeSubscriptionsApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/me/subscriptions", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const pool = getPool();
    const result = await pool.query<{
      subscription_id: string;
      scientific_name: string | null;
      taxon_rank: string | null;
      match_field: string;
      trigger_invasive_only: boolean;
      trigger_rare_only: boolean;
      channel: string;
      label: string;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT subscription_id::text,
              scientific_name,
              taxon_rank,
              match_field,
              trigger_invasive_only,
              trigger_rare_only,
              channel,
              label,
              is_active,
              created_at::text
         FROM taxon_alert_subscriptions
        WHERE user_id = $1
        ORDER BY is_active DESC, created_at DESC
        LIMIT 200`,
      [userId],
    );
    void reply.send({
      ok: true,
      subscriptions: result.rows.map((r) => ({
        subscriptionId: r.subscription_id,
        scientificName: r.scientific_name,
        taxonRank: r.taxon_rank,
        matchField: r.match_field,
        triggerInvasiveOnly: r.trigger_invasive_only,
        triggerRareOnly: r.trigger_rare_only,
        channel: r.channel,
        label: r.label,
        isActive: r.is_active,
        createdAt: r.created_at,
      })),
    });
  });

  app.post("/api/v1/me/subscriptions", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as CreateBody;
    const scientificName = typeof body.scientificName === "string" ? body.scientificName.trim() : "";
    const taxonRank = typeof body.taxonRank === "string" ? body.taxonRank.trim() : "";
    const matchField = typeof body.matchField === "string" ? body.matchField.trim() : "";
    const channelRaw = typeof body.channel === "string" ? body.channel.trim() : "email";
    const channel = VALID_CHANNELS.has(channelRaw) ? channelRaw : "email";

    if (!scientificName && !taxonRank) {
      void reply.code(400).send({ ok: false, error: "scientificName_or_taxonRank_required" });
      return;
    }
    if (!VALID_MATCH_FIELDS.has(matchField)) {
      void reply.code(400).send({ ok: false, error: "invalid_match_field" });
      return;
    }
    if (taxonRank && !VALID_RANKS.has(taxonRank)) {
      void reply.code(400).send({ ok: false, error: "invalid_taxon_rank" });
      return;
    }

    const pool = getPool();
    const result = await pool.query<{ subscription_id: string }>(
      `INSERT INTO taxon_alert_subscriptions (
          user_id, scientific_name, taxon_rank, match_field,
          trigger_invasive_only, trigger_rare_only, channel, label, geo_filter_json
       ) VALUES ($1, NULLIF($2,''), NULLIF($3,''), $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING subscription_id::text`,
      [
        userId,
        scientificName,
        taxonRank,
        matchField,
        body.triggerInvasiveOnly === true,
        body.triggerRareOnly === true,
        channel,
        typeof body.label === "string" ? body.label.slice(0, 200) : "",
        JSON.stringify(body.geoFilter ?? {}),
      ],
    );
    void reply.send({ ok: true, subscriptionId: result.rows[0]!.subscription_id });
  });

  app.delete("/api/v1/me/subscriptions/:id", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const params = request.params as { id?: string };
    const id = params.id?.trim() ?? "";
    if (!id) {
      void reply.code(400).send({ ok: false, error: "id_required" });
      return;
    }
    const pool = getPool();
    const result = await pool.query<{ subscription_id: string }>(
      `DELETE FROM taxon_alert_subscriptions
        WHERE subscription_id = $1::uuid AND user_id = $2
       RETURNING subscription_id::text`,
      [id, userId],
    );
    if (result.rows.length === 0) {
      void reply.code(404).send({ ok: false, error: "not_found" });
      return;
    }
    void reply.send({ ok: true });
  });

  app.get("/api/v1/me/area-subscriptions", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const pool = getPool();
    const result = await pool.query<{
      subscription_id: string;
      target_type: string;
      target_id: string;
      label: string;
      field_name: string | null;
      place_name: string | null;
      href: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT s.subscription_id::text,
              s.target_type,
              s.target_id,
              s.label,
              f.name AS field_name,
              p.canonical_name AS place_name,
              s.href,
              s.is_active,
              s.created_at::text,
              s.updated_at::text
         FROM user_area_subscriptions s
         LEFT JOIN observation_fields f
           ON s.target_type = 'field' AND f.field_id::text = s.target_id
         LEFT JOIN places p
           ON s.target_type = 'place' AND p.place_id = s.target_id
        WHERE s.user_id = $1
        ORDER BY s.is_active DESC, s.updated_at DESC
        LIMIT 100`,
      [userId],
    );
    void reply.send({
      ok: true,
      subscriptions: result.rows.map((r) => {
        const label = safeLabel(r.label || r.field_name || r.place_name, r.target_id);
        return {
          subscriptionId: r.subscription_id,
          targetType: r.target_type,
          targetId: r.target_id,
          label,
          href: safeMenuHref(r.href, areaHref(r.target_type, r.target_id)),
          isActive: r.is_active,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      }),
    });
  });

  app.post("/api/v1/me/area-subscriptions", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as AreaSubscriptionBody;
    const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "";
    const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
    if (!VALID_AREA_TARGET_TYPES.has(targetType) || !targetId) {
      void reply.code(400).send({ ok: false, error: "targetType_and_targetId_required" });
      return;
    }
    const fallbackHref = areaHref(targetType, targetId);
    const label = safeLabel(body.label, targetId);
    const href = safeMenuHref(body.href, fallbackHref);
    const pool = getPool();
    const result = await pool.query<{ subscription_id: string }>(
      `INSERT INTO user_area_subscriptions (
          user_id, target_type, target_id, label, href, is_active, updated_at
       ) VALUES ($1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (user_id, target_type, target_id)
       DO UPDATE SET label = EXCLUDED.label,
                     href = EXCLUDED.href,
                     is_active = true,
                     updated_at = NOW()
       RETURNING subscription_id::text`,
      [userId, targetType, targetId.slice(0, 160), label, href],
    );
    void reply.send({ ok: true, subscriptionId: result.rows[0]!.subscription_id });
  });

  app.delete("/api/v1/me/area-subscriptions/:id", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const params = request.params as { id?: string };
    const id = params.id?.trim() ?? "";
    if (!id) {
      void reply.code(400).send({ ok: false, error: "id_required" });
      return;
    }
    const pool = getPool();
    const result = await pool.query<{ subscription_id: string }>(
      `DELETE FROM user_area_subscriptions
        WHERE subscription_id = $1::uuid AND user_id = $2
       RETURNING subscription_id::text`,
      [id, userId],
    );
    if (result.rows.length === 0) {
      void reply.code(404).send({ ok: false, error: "not_found" });
      return;
    }
    void reply.send({ ok: true });
  });

  app.get<{ Querystring: { limit?: string } }>("/api/v1/me/personalized-menu", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const limit = Math.min(Math.max(Number(request.query.limit ?? 10) || 10, 1), 20);
    const pool = getPool();
    const [taxa, areas, areaStats, history, unreadAlerts] = await Promise.all([
      pool.query<{
        label: string;
        scientific_name: string | null;
        taxon_rank: string | null;
      }>(
        `SELECT label, scientific_name, taxon_rank
           FROM taxon_alert_subscriptions
          WHERE user_id = $1 AND is_active = true
          ORDER BY created_at DESC
          LIMIT 8`,
        [userId],
      ),
      pool.query<{
        target_type: string;
        target_id: string;
        label: string;
        field_name: string | null;
        place_name: string | null;
        href: string;
      }>(
        `SELECT s.target_type,
                s.target_id,
                s.label,
                f.name AS field_name,
                p.canonical_name AS place_name,
                s.href
           FROM user_area_subscriptions s
           LEFT JOIN observation_fields f
             ON s.target_type = 'field' AND f.field_id::text = s.target_id
           LEFT JOIN places p
             ON s.target_type = 'place' AND p.place_id = s.target_id
          WHERE s.user_id = $1 AND s.is_active = true
          ORDER BY s.updated_at DESC
          LIMIT 8`,
        [userId],
      ),
      pool.query<{
        target_type: string;
        target_id: string;
        observation_count: string;
        needs_id_count: string;
      }>(
        `SELECT s.target_type,
                s.target_id,
                COUNT(DISTINCT o.occurrence_id)::text AS observation_count,
                COUNT(DISTINCT o.occurrence_id) FILTER (
                  WHERE NULLIF(o.scientific_name, '') IS NULL
                    AND NULLIF(o.vernacular_name, '') IS NULL
                    AND ident.has_current_id IS NULL
                )::text AS needs_id_count
           FROM user_area_subscriptions s
           LEFT JOIN visits v
             ON (
               s.target_type = 'place'
               AND v.place_id = s.target_id
             ) OR (
               s.target_type = 'field'
               AND EXISTS (
                 SELECT 1
                   FROM unnest(v.resolved_field_ids) AS rf(field_id)
                  WHERE rf.field_id::text = s.target_id
               )
             )
           LEFT JOIN occurrences o
             ON o.visit_id = v.visit_id
           LEFT JOIN LATERAL (
             SELECT 1 AS has_current_id
               FROM identifications i
              WHERE i.occurrence_id = o.occurrence_id
                AND COALESCE(i.is_current, true) = true
              LIMIT 1
           ) ident ON true
          WHERE s.user_id = $1 AND s.is_active = true
          GROUP BY s.target_type, s.target_id`,
        [userId],
      ),
      pool.query<{
        href: string;
        last_seen: string;
        score: string;
      }>(
        `WITH events AS (
           SELECT COALESCE(NULLIF(route_key, ''), NULLIF(page_path, '')) AS href, created_at
             FROM ui_kpi_events
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '90 days'
           UNION ALL
           SELECT COALESCE(NULLIF(route_key, ''), NULLIF(page_path, '')) AS href, created_at
             FROM observation_ui_kpi_events
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '90 days'
         )
         SELECT href,
                MAX(created_at)::text AS last_seen,
                COUNT(*)::text AS score
           FROM events
          WHERE href IS NOT NULL
            AND href LIKE '/%'
            AND href NOT LIKE '/api/%'
            AND href NOT LIKE '/login%'
            AND href NOT LIKE '/register%'
          GROUP BY href
          ORDER BY COUNT(*) DESC, MAX(created_at) DESC
          LIMIT 10`,
        [userId],
      ),
      pool.query<{ unread_count: string }>(
        `SELECT COUNT(*)::text AS unread_count
           FROM alert_deliveries
          WHERE user_id = $1
            AND acknowledged_at IS NULL`,
        [userId],
      ),
    ]);
    const areaStatsByKey = new Map(
      areaStats.rows.map((r) => [
        `${r.target_type}:${r.target_id}`,
        {
          observationCount: toCount(r.observation_count),
          needsIdCount: toCount(r.needs_id_count),
        },
      ]),
    );
    const unreadAlertCount = toCount(unreadAlerts.rows[0]?.unread_count);
    const items = dedupeMenuItems([
      ...areas.rows.map((r) => {
        const label = safeLabel(r.label || r.field_name || r.place_name, r.target_id);
        const stats = areaStatsByKey.get(`${r.target_type}:${r.target_id}`) ?? { observationCount: 0, needsIdCount: 0 };
        return {
          kind: r.target_type,
          label,
          href: safeMenuHref(r.href, areaHref(r.target_type, r.target_id)),
          source: "follow",
          stats,
        };
      }),
      ...taxa.rows.map((r) => {
        const label = safeLabel(r.label || r.scientific_name || r.taxon_rank, "分類群");
        return {
          kind: "taxon",
          label,
          href: `/explore?q=${encodeURIComponent(label)}`,
          source: "follow",
          stats: { followed: true },
        };
      }),
      ...history.rows.map((r) => ({
        kind: "history",
        label: menuLabelFromHref(r.href),
        href: safeMenuHref(r.href, "/"),
        source: "history",
        score: Number(r.score) || 0,
        lastSeen: r.last_seen,
        stats: { viewCount: Number(r.score) || 0 },
      })),
    ]).slice(0, limit);
    void reply.send({ ok: true, items, summary: { unreadAlertCount } });
  });

  app.get("/api/v1/me/alerts", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const pool = getPool();
    const result = await pool.query<{
      delivery_id: string;
      occurrence_id: string;
      trigger_kind: string;
      delivery_status: string;
      delivered_at: string | null;
      acknowledged_at: string | null;
      created_at: string;
      payload_json: unknown;
    }>(
      `SELECT delivery_id::text,
              occurrence_id::text,
              trigger_kind,
              delivery_status,
              delivered_at::text,
              acknowledged_at::text,
              created_at::text,
              payload_json
         FROM alert_deliveries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [userId],
    );
    void reply.send({
      ok: true,
      alerts: result.rows.map((r) => ({
        deliveryId: r.delivery_id,
        occurrenceId: r.occurrence_id,
        triggerKind: r.trigger_kind,
        deliveryStatus: r.delivery_status,
        deliveredAt: r.delivered_at,
        acknowledgedAt: r.acknowledged_at,
        createdAt: r.created_at,
        payload: r.payload_json,
      })),
    });
  });

  app.post("/api/v1/me/alerts/:id/acknowledge", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const params = request.params as { id?: string };
    const body = (request.body ?? {}) as { note?: string };
    const id = params.id?.trim() ?? "";
    if (!id) {
      void reply.code(400).send({ ok: false, error: "id_required" });
      return;
    }
    const pool = getPool();
    const result = await pool.query<{ delivery_id: string }>(
      `UPDATE alert_deliveries
          SET acknowledged_at = NOW(),
              acknowledged_note = $3,
              delivery_status = CASE WHEN delivery_status='sent' THEN 'acknowledged' ELSE delivery_status END
        WHERE delivery_id = $1::uuid AND user_id = $2
       RETURNING delivery_id::text`,
      [id, userId, typeof body.note === "string" ? body.note.slice(0, 500) : null],
    );
    if (result.rows.length === 0) {
      void reply.code(404).send({ ok: false, error: "not_found" });
      return;
    }
    void reply.send({ ok: true });
  });

  app.post("/api/v1/me/alerts/read", async (request, reply) => {
    const userId = await requireUser(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 100)
      : [];
    const pool = getPool();
    const result = ids.length > 0
      ? await pool.query<{ delivery_id: string }>(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, NOW()),
                delivery_status = CASE WHEN delivery_status='sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = $1
            AND delivery_id::text = ANY($2::text[])
          RETURNING delivery_id::text`,
        [userId, ids],
      )
      : await pool.query<{ delivery_id: string }>(
        `UPDATE alert_deliveries
            SET acknowledged_at = COALESCE(acknowledged_at, NOW()),
                delivery_status = CASE WHEN delivery_status='sent' THEN 'acknowledged' ELSE delivery_status END
          WHERE user_id = $1
            AND acknowledged_at IS NULL
          RETURNING delivery_id::text`,
        [userId],
      );
    void reply.send({ ok: true, acknowledgedCount: result.rows.length });
  });
}
