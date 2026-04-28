/**
 * 観察成立 (reassess 完了) を起点に、関連する通知をマッチングして
 * `alert_deliveries` に pending 行を作る。
 *
 * トリガーの種類:
 *  - `municipality_invasive`: 特定外来生物 / 重点対策外来種 が記録されたとき、
 *    地点に紐づく市区町村受信者 (alert_recipients.recipient_type='municipality') へ通報
 *  - `invasive` / `rare` / `novelty`: 研究者・機関 (recipient_type='researcher'|'agency') へ通報
 *  - `taxon_match`: ユーザー購読 (taxon_alert_subscriptions) のマッチング
 *
 * 設計:
 *  - 実際のメール送信は `runAlertDeliveryWorker` (cron / systemd timer) で別プロセスから
 *  - dispatcher は **DB に pending 行を書くだけ**。失敗してもreassess の主処理を巻き込まない
 *  - 重複送信は migration 0063 の partial UNIQUE で抑止 (ON CONFLICT DO NOTHING)
 */

import type { PoolClient } from "pg";
import { getPool } from "../db.js";

export type EmitAlertsContext = {
  occurrenceId: string;
  visitId: string;
  /** 0061 で同期される invasive_status (iaspecified/priority/industrial/prevention/native/null) */
  invasiveStatus: string | null;
  /** subject の代表学名 */
  scientificName: string | null;
  vernacularName: string | null;
  /** GBIF backbone 由来の上位分類 */
  genus?: string | null;
  family?: string | null;
  orderName?: string | null;
  className?: string | null;
  /** 地点情報 */
  prefecture?: string | null;
  municipality?: string | null;
  /** 観察者 (購読配信時の自己除外用) */
  observerUserId?: string | null;
  /** novelty score (>= 0.5 のとき novelty trigger) */
  noveltyScore?: number | null;
  /** rare 判定 (redlist_versions 連携で将来拡張) */
  isRare?: boolean;
};

export type AlertDispatchSummary = {
  municipalityInvasive: number;
  researcherInvasive: number;
  researcherRare: number;
  researcherNovelty: number;
  userTaxonMatches: number;
};

export async function emitAlertsForOccurrence(
  ctx: EmitAlertsContext,
  client?: PoolClient,
): Promise<AlertDispatchSummary> {
  const summary: AlertDispatchSummary = {
    municipalityInvasive: 0,
    researcherInvasive: 0,
    researcherRare: 0,
    researcherNovelty: 0,
    userTaxonMatches: 0,
  };

  const exec = async (c: PoolClient): Promise<void> => {
    if (isInvasiveTrigger(ctx.invasiveStatus)) {
      summary.municipalityInvasive = await emitMunicipalityInvasive(c, ctx);
      summary.researcherInvasive = await emitResearcherTrigger(c, ctx, "invasive");
    }
    if (ctx.isRare) {
      summary.researcherRare = await emitResearcherTrigger(c, ctx, "rare");
    }
    if (typeof ctx.noveltyScore === "number" && ctx.noveltyScore >= 0.5) {
      summary.researcherNovelty = await emitResearcherTrigger(c, ctx, "novelty");
    }
    summary.userTaxonMatches = await emitUserTaxonMatches(c, ctx);
  };

  if (client) {
    await exec(client);
  } else {
    const pool = getPool();
    const c = await pool.connect();
    try {
      await exec(c);
    } finally {
      c.release();
    }
  }
  return summary;
}

function isInvasiveTrigger(invasiveStatus: string | null): boolean {
  return invasiveStatus === "iaspecified" || invasiveStatus === "priority";
}

async function emitMunicipalityInvasive(
  client: PoolClient,
  ctx: EmitAlertsContext,
): Promise<number> {
  if (!ctx.prefecture && !ctx.municipality) {
    // 地点情報が無いと自治体マッチできない。広域 agency は別 trigger でカバー。
    return 0;
  }
  const result = await client.query<{ recipient_id: string }>(
    `INSERT INTO alert_deliveries (
        occurrence_id, recipient_id, trigger_kind, channel, payload_json
     )
     SELECT $1::uuid, r.recipient_id, 'municipality_invasive',
            COALESCE(NULLIF(r.email, '') IS NOT NULL, false)::text || '_email',
            $5::jsonb
       FROM alert_recipients r
      WHERE r.is_active
        AND r.recipient_type = 'municipality'
        AND r.interest_invasive = true
        AND ($2::text IS NULL OR r.prefecture = $2)
        AND ($3::text IS NULL OR r.municipality = $3 OR r.municipality IS NULL)
     ON CONFLICT (occurrence_id, recipient_id, trigger_kind) WHERE recipient_id IS NOT NULL DO NOTHING
     RETURNING recipient_id::text`,
    [
      ctx.occurrenceId,
      ctx.prefecture ?? null,
      ctx.municipality ?? null,
      ctx.invasiveStatus,
      buildPayload(ctx, "municipality_invasive"),
    ],
  );
  return result.rows.length;
}

async function emitResearcherTrigger(
  client: PoolClient,
  ctx: EmitAlertsContext,
  kind: "invasive" | "rare" | "novelty",
): Promise<number> {
  const interestColumn =
    kind === "invasive" ? "interest_invasive" : kind === "rare" ? "interest_rare" : null;
  // novelty は専用列を持たないため、interest_taxon_json の subject 学名一致のみで判定。
  // taxon JSON 例: [{"rank":"family","name":"Felidae"}]
  const taxonNameCandidates = [
    ctx.scientificName,
    ctx.genus,
    ctx.family,
    ctx.orderName,
    ctx.className,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const interestClause = interestColumn ? `r.${interestColumn} = true` : "true";
  const taxonClause = taxonNameCandidates.length > 0
    ? `OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(r.interest_taxon_json) AS it
          WHERE lower(it->>'name') = ANY($2::text[])
       )`
    : "";

  const result = await client.query<{ recipient_id: string }>(
    `INSERT INTO alert_deliveries (
        occurrence_id, recipient_id, trigger_kind, channel, payload_json
     )
     SELECT $1::uuid, r.recipient_id, $3,
            COALESCE(NULLIF(r.email, '') IS NOT NULL, false)::text || '_email',
            $4::jsonb
       FROM alert_recipients r
      WHERE r.is_active
        AND r.recipient_type IN ('researcher','agency')
        AND (${interestClause} ${taxonClause})
     ON CONFLICT (occurrence_id, recipient_id, trigger_kind) WHERE recipient_id IS NOT NULL DO NOTHING
     RETURNING recipient_id::text`,
    [
      ctx.occurrenceId,
      taxonNameCandidates.map((n) => n.toLowerCase()),
      kind,
      buildPayload(ctx, kind),
    ],
  );
  return result.rows.length;
}

async function emitUserTaxonMatches(
  client: PoolClient,
  ctx: EmitAlertsContext,
): Promise<number> {
  // ユーザー購読のマッチ条件:
  //  - match_field='scientific_name' AND scientific_name (lower) = subject の学名
  //  - match_field='genus' AND scientific_name (lower) = subject の genus
  //  - match_field='family' / 'order_name' / 'class_name' も同様
  //  - rank フィルタなしの購読は taxon_rank IS NULL でマッチ
  //  - trigger_invasive_only / trigger_rare_only でフィルタ
  const candidates = [
    { field: "scientific_name", value: ctx.scientificName },
    { field: "genus", value: ctx.genus ?? null },
    { field: "family", value: ctx.family ?? null },
    { field: "order_name", value: ctx.orderName ?? null },
    { field: "class_name", value: ctx.className ?? null },
  ].filter((c) => typeof c.value === "string" && c.value.trim().length > 0) as Array<{ field: string; value: string }>;
  if (candidates.length === 0) return 0;

  const isInvasive = isInvasiveTrigger(ctx.invasiveStatus);
  const isRare = ctx.isRare === true;

  let total = 0;
  for (const cand of candidates) {
    const result = await client.query<{ subscription_id: string }>(
      `INSERT INTO alert_deliveries (
          occurrence_id, user_id, subscription_id, trigger_kind, channel, payload_json
       )
       SELECT $1::uuid, s.user_id, s.subscription_id, 'taxon_match', s.channel, $4::jsonb
         FROM taxon_alert_subscriptions s
        WHERE s.is_active
          AND s.match_field = $2
          AND lower(s.scientific_name) = $3
          AND ($5::text IS NULL OR s.user_id <> $5)
          AND (s.trigger_invasive_only = false OR $6::boolean = true)
          AND (s.trigger_rare_only = false OR $7::boolean = true)
       ON CONFLICT (occurrence_id, user_id, subscription_id, trigger_kind) WHERE user_id IS NOT NULL AND subscription_id IS NOT NULL DO NOTHING
       RETURNING subscription_id::text`,
      [
        ctx.occurrenceId,
        cand.field,
        cand.value.toLowerCase(),
        buildPayload(ctx, "taxon_match"),
        ctx.observerUserId ?? null,
        isInvasive,
        isRare,
      ],
    );
    total += result.rows.length;
  }
  return total;
}

function buildPayload(ctx: EmitAlertsContext, kind: string): string {
  return JSON.stringify({
    occurrenceId: ctx.occurrenceId,
    visitId: ctx.visitId,
    triggerKind: kind,
    subject: {
      scientificName: ctx.scientificName,
      vernacularName: ctx.vernacularName,
      genus: ctx.genus ?? null,
      family: ctx.family ?? null,
    },
    place: {
      prefecture: ctx.prefecture ?? null,
      municipality: ctx.municipality ?? null,
    },
    invasiveStatus: ctx.invasiveStatus,
    noveltyScore: typeof ctx.noveltyScore === "number" ? ctx.noveltyScore : null,
    isRare: ctx.isRare === true,
  });
}
