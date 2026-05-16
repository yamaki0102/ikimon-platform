/**
 * 配信ワーカー: alert_deliveries の pending 行を取り出してメール / webhook を送る。
 *
 * VPS では /usr/sbin/sendmail 経由で実送信し、成功時だけ `delivery_status='sent'` にする。
 * ローカル / テストでは `sendEmail` を注入して送信先と本文を検証できる。
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
import { sendMailViaSendmail } from "./contactSubmit.js";

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
 * デフォルトのメール送信関数。
 * VPS では /usr/sbin/sendmail が msmtp-mta に接続されている前提で送る。
 */
const defaultSendEmail: SendEmailFn = async ({ to, subject, body }) => {
  const result = await sendMailViaSendmail(to, subject, body);
  if (!result.ok) {
    throw new Error(result.error ?? "sendmail_failed");
  }
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
      if (row.channel.startsWith("digest") || row.channel !== "email") {
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
        await insertInvasiveReportingDeliveryEvent(client, row.delivery_id, "sent", null).catch(() => undefined);
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
  await insertInvasiveReportingDeliveryEvent(client, deliveryId, "failed", message).catch(() => undefined);
}

async function insertInvasiveReportingDeliveryEvent(
  client: PoolClient,
  deliveryId: string,
  status: "sent" | "failed",
  errorMessage: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO invasive_reporting_events (
        occurrence_id, visit_id, rule_id, contact_id, recipient_id, delivery_id,
        event_status, trigger_source, invasive_status, payload_json, error_message
     )
     SELECT occurrence_id, visit_id, rule_id, contact_id, recipient_id, delivery_id,
            $2, 'delivery_worker', invasive_status, payload_json, $3
       FROM invasive_reporting_events
      WHERE delivery_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 1`,
    [deliveryId, status, errorMessage ? errorMessage.slice(0, 500) : null],
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
  const observation = (payload.observation ?? {}) as Record<string, unknown>;
  const reporting = (payload.reporting ?? {}) as Record<string, unknown>;
  const sciName = String(subj.scientificName ?? "");
  const verName = String(subj.vernacularName ?? sciName);
  const prefecture = String(place.prefecture ?? "");
  const municipality = String(place.municipality ?? "");
  const placeLabel = [prefecture, municipality].filter(Boolean).join(" / ") || "観察地点";
  const observationUrl = String(observation.publicUrl ?? `https://ikimon.life/observations/${String(payload.visitId ?? payload.occurrenceId ?? "")}`);

  switch (triggerKind) {
    case "municipality_invasive": {
      const requiredFields = stringList(reporting.requiredFields);
      const handlingWarnings = stringList(reporting.handlingWarnings);
      const photoUrls = stringList(observation.photoUrls);
      const latitude = valueLine("緯度", place.latitude);
      const longitude = valueLine("経度", place.longitude);
      const uncertainty = valueLine("位置精度", place.coordinateUncertaintyM ? `${String(place.coordinateUncertaintyM)} m` : "");
      const organization = String(reporting.organizationName ?? "");
      const category = String(reporting.category ?? "");
      const guidance = String(reporting.authorityGuidanceJa ?? "");
      const officialUrl = String(reporting.officialUrl ?? "");
      const subject = `【ikimon.life 外来種観察通知】${placeLabel} で「${verName}」の観察報告`;
      const body = [
        `${organization ? `${organization} 御中` : "ご担当者様"}`,
        ``,
        `${placeLabel} 付近で外来種候補「${verName} ${sciName}」の観察報告が登録されました。`,
        `この通知は、貴機関が受信許可済みの連携先として登録されている場合にのみ送信しています。`,
        ``,
        `観察ページ: ${observationUrl}`,
        `観察日時: ${String(observation.observedAt ?? "未確認")}`,
        latitude,
        longitude,
        uncertainty,
        `場所メモ: ${String(place.localityNote ?? "未記載")}`,
        `観察メモ: ${String(observation.note ?? "未記載")}`,
        `分類群: ${String(subj.family ?? "")} / ${String(subj.genus ?? "")}`,
        `環境省カテゴリ (AI判定): ${String(payload.invasiveStatus ?? "未確認")}`,
        `通報分類: ${category || "未分類"}`,
        photoUrls.length > 0 ? `写真URL:\n${photoUrls.map((url) => `- ${url}`).join("\n")}` : `写真URL: 未登録`,
        requiredFields.length > 0 ? `\nこの窓口で求められる情報:\n${requiredFields.map((item) => `- ${item}`).join("\n")}` : "",
        handlingWarnings.length > 0 ? `\n観察者へ表示している注意:\n${handlingWarnings.map((item) => `- ${item}`).join("\n")}` : "",
        guidance ? `\n連携メモ: ${guidance}` : "",
        officialUrl ? `公式窓口: ${officialUrl}` : "",
        ``,
        `※ AI候補であり、確定同定ではありません。写真・現地状況をご確認ください。`,
        `※ 詳細位置はこの通知に含めますが、公開ページでは原則ぼかして表示します。`,
        ``,
        `配信停止: https://ikimon.life/unsubscribe`,
      ].filter((line) => line !== "").join("\n");
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
    case "subject_proposal": {
      return {
        subject: `【ikimon.life】写真・動画に別の対象が提案されました`,
        body: [
          String(payload.title ?? "別の対象が提案されました"),
          ``,
          String(payload.body ?? `${verName}も写っているかもしれません。`),
          `観察ページ: ${observationUrl}`,
          ``,
          `投稿者の正式な主張ではなく、この写真・動画を見た人からの提案です。`,
        ].join("\n"),
      };
    }
    default: {
      return {
        subject: `【ikimon.life】観察通知 (${triggerKind})`,
        body: `${verName} の観察があります。\n${observationUrl}`,
      };
    }
  }
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.length > 0) return [value];
  return [];
}

function valueLine(label: string, value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `${label}: ${text || "未確認"}`;
}
