/**
 * 配信ワーカー: alert_deliveries の pending 行を取り出してメール / webhook を送る。
 *
 * 現状の実装は **DB 完結のスケルトン** で、実際のメール送信は将来 mailer モジュールに
 * 委譲する。今は payload を組み立てて `delivery_status='sent'` にマークする
 * (メール本文は payload_json に格納)。
 *
 * 起動方法:
 *   npx tsx src/scripts/runAlertDeliveryWorker.ts --once
 *
 * cron で 1 分ごとに走らせるか、systemd timer で 5 分ごとが目安。
 * digest_daily / digest_weekly は別パスでまとめ送りするので、ここでは
 * channel=email のみを処理する。
 */

import type { PoolClient } from "pg";
import { getPool } from "../db.js";

export type DeliveryWorkerSummary = {
  picked: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type SendEmailFn = (input: {
  to: string;
  subject: string;
  body: string;
  meta: Record<string, unknown>;
}) => Promise<void>;

export type DeliveryWorkerOptions = {
  batchSize?: number;
  sendEmail?: SendEmailFn;
};

const DEFAULT_BATCH = 25;

/**
 * デフォルトのメール送信関数 (no-op)。
 * 本番では `services/contactSubmit.ts` の sendmail パイプラインを汎化したものに置き換える。
 */
const defaultSendEmail: SendEmailFn = async () => {
  // no-op: DB に sent マークするだけ。実際のメール配信は mailer モジュール完成後に切り替える。
};

export async function runAlertDeliveryWorker(
  options: DeliveryWorkerOptions = {},
): Promise<DeliveryWorkerSummary> {
  const summary: DeliveryWorkerSummary = { picked: 0, sent: 0, failed: 0, skipped: 0 };
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const sendEmail = options.sendEmail ?? defaultSendEmail;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{
      delivery_id: string;
      occurrence_id: string;
      user_id: string | null;
      recipient_id: string | null;
      trigger_kind: string;
      channel: string;
      payload_json: unknown;
    }>(
      `SELECT delivery_id::text, occurrence_id::text, user_id, recipient_id::text,
              trigger_kind, channel, payload_json
         FROM alert_deliveries
        WHERE delivery_status = 'pending'
        ORDER BY created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );
    summary.picked = result.rows.length;

    for (const row of result.rows) {
      // digest 系は別バッチでまとめ送りするので skip
      if (row.channel.startsWith("digest")) {
        summary.skipped += 1;
        continue;
      }
      try {
        const targetEmail = await resolveTargetEmail(client, row.user_id, row.recipient_id);
        if (!targetEmail) {
          await markFailed(client, row.delivery_id, "no_target_email");
          summary.failed += 1;
          continue;
        }
        const { subject, body } = buildEmailContent(row.trigger_kind, row.payload_json);
        await sendEmail({
          to: targetEmail,
          subject,
          body,
          meta: { deliveryId: row.delivery_id, triggerKind: row.trigger_kind },
        });
        await client.query(
          `UPDATE alert_deliveries
              SET delivery_status = 'sent', delivered_at = NOW(), error_message = NULL
            WHERE delivery_id = $1::uuid`,
          [row.delivery_id],
        );
        summary.sent += 1;
      } catch (err) {
        await markFailed(client, row.delivery_id, err instanceof Error ? err.message : String(err));
        summary.failed += 1;
      }
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return summary;
}

async function markFailed(client: PoolClient, deliveryId: string, message: string): Promise<void> {
  await client.query(
    `UPDATE alert_deliveries
        SET delivery_status = 'failed', error_message = $2
      WHERE delivery_id = $1::uuid`,
    [deliveryId, message.slice(0, 500)],
  );
}

async function resolveTargetEmail(
  client: PoolClient,
  userId: string | null,
  recipientId: string | null,
): Promise<string | null> {
  if (recipientId) {
    const r = await client.query<{ email: string | null; is_active: boolean }>(
      `SELECT email, is_active FROM alert_recipients WHERE recipient_id = $1::uuid LIMIT 1`,
      [recipientId],
    );
    const row = r.rows[0];
    if (!row || !row.is_active) return null;
    return row.email && row.email.length > 0 ? row.email : null;
  }
  if (userId) {
    const r = await client.query<{ email: string | null; email_enabled: boolean }>(
      `SELECT u.email,
              COALESCE(p.email_enabled, true) AS email_enabled
         FROM users u
         LEFT JOIN user_notification_preferences p ON p.user_id = u.user_id
        WHERE u.user_id = $1
        LIMIT 1`,
      [userId],
    );
    const row = r.rows[0];
    if (!row || !row.email_enabled) return null;
    return row.email && row.email.length > 0 ? row.email : null;
  }
  return null;
}

function buildEmailContent(triggerKind: string, payloadJson: unknown): { subject: string; body: string } {
  const payload = (payloadJson && typeof payloadJson === "object" ? payloadJson : {}) as Record<string, unknown>;
  const subj = (payload.subject ?? {}) as Record<string, unknown>;
  const place = (payload.place ?? {}) as Record<string, unknown>;
  const sciName = String(subj.scientificName ?? "");
  const verName = String(subj.vernacularName ?? sciName);
  const prefecture = String(place.prefecture ?? "");
  const municipality = String(place.municipality ?? "");
  const placeLabel = [prefecture, municipality].filter(Boolean).join(" / ") || "観察地点";
  const observationUrl = `https://ikimon.life/observations/${String(payload.occurrenceId ?? "")}`;

  switch (triggerKind) {
    case "municipality_invasive": {
      const subject = `【ikimon.life 外来種観察通知】${placeLabel} で「${verName}」の観察報告`;
      const body = [
        `${placeLabel} 付近で外来種「${verName} ${sciName}」の観察報告が登録されました。`,
        ``,
        `観察ページ: ${observationUrl}`,
        `分類群: ${String(subj.family ?? "")} / ${String(subj.genus ?? "")}`,
        `環境省カテゴリ (AI判定): ${String(payload.invasiveStatus ?? "未確認")}`,
        ``,
        `※ AI判定の参考情報です。確定情報ではありません。`,
        `※ 駆除には自治体の判断が必要です。`,
        ``,
        `配信停止: https://ikimon.life/unsubscribe`,
      ].join("\n");
      return { subject, body };
    }
    case "taxon_match": {
      const subject = `【ikimon.life】フォロー中の「${verName}」が観察されました`,
        body = [
          `あなたがフォローしている分類群で観察報告が登録されました。`,
          ``,
          `種名: ${verName} (${sciName})`,
          `観察地: ${placeLabel}`,
          `観察ページ: ${observationUrl}`,
          ``,
          `配信停止 / フォロー解除: https://ikimon.life/me/subscriptions`,
        ].join("\n");
      return { subject, body };
    }
    default: {
      return {
        subject: `【ikimon.life】観察通知 (${triggerKind})`,
        body: `${verName} の観察があります。\n${observationUrl}`,
      };
    }
  }
}
