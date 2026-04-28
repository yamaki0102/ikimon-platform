/**
 * /api/v1/me/subscriptions   ユーザーの taxon フォロー (購読) 管理
 * /api/v1/me/alerts          受信履歴
 *
 * いずれもログインユーザー必須。Cookie 認証 (services/authSession.ts) で識別する。
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
}
