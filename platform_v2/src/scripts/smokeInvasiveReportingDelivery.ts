import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { runAlertDeliveryWorker, type SendEmailFn } from "../services/alertDeliveryWorker.js";
import { emitInvasiveReportingForOccurrence } from "../services/invasiveReporting.js";

type Args = {
  to: string;
  keep: boolean;
  captureOnly: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const toArg = args.find((arg) => arg.startsWith("--to="));
  return {
    to: toArg ? toArg.slice("--to=".length).trim() : "",
    keep: args.includes("--keep"),
    captureOnly: args.includes("--capture-only"),
  };
}

async function cleanup(prefix: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `DELETE FROM invasive_reporting_events
      WHERE occurrence_id = $1
         OR payload_json->>'smokePrefix' = $2`,
    [`${prefix}-occurrence`, prefix],
  );
  await pool.query("DELETE FROM alert_deliveries WHERE occurrence_id = $1", [`${prefix}-occurrence`]);
  await pool.query("DELETE FROM evidence_assets WHERE occurrence_id = $1 OR visit_id = $2", [
    `${prefix}-occurrence`,
    `${prefix}-visit`,
  ]);
  await pool.query(
    `DELETE FROM asset_blobs
      WHERE source_payload->>'smokePrefix' = $1`,
    [prefix],
  );
  await pool.query("DELETE FROM occurrences WHERE occurrence_id = $1", [`${prefix}-occurrence`]);
  await pool.query("DELETE FROM visits WHERE visit_id = $1", [`${prefix}-visit`]);
  await pool.query("DELETE FROM users WHERE user_id = $1", [`${prefix}-user`]);
  await pool.query(
    `DELETE FROM invasive_reporting_rules
      WHERE source_payload->>'smokePrefix' = $1`,
    [prefix],
  );
  await pool.query(
    `DELETE FROM invasive_reporting_contacts
      WHERE source_payload->>'smokePrefix' = $1`,
    [prefix],
  );
  await pool.query(
    `DELETE FROM alert_recipients
      WHERE notes LIKE $1`,
    [`%${prefix}%`],
  );
  await pool.query(
    `DELETE FROM reporting_jurisdictions
      WHERE source_payload->>'smokePrefix' = $1`,
    [prefix],
  );
}

async function seedAndEmit(prefix: string, to: string): Promise<Record<string, unknown>> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingJurisdiction = await client.query<{ jurisdiction_id: string }>(
      `SELECT jurisdiction_id::text
         FROM reporting_jurisdictions
        WHERE country_code = 'JP'
          AND admin_area_1 = '静岡県'
          AND municipality = '浜松市'
        LIMIT 1`,
    );
    let jurisdictionId = existingJurisdiction.rows[0]?.jurisdiction_id ?? null;
    if (!jurisdictionId) {
      const jurisdiction = await client.query<{ jurisdiction_id: string }>(
        `INSERT INTO reporting_jurisdictions (
            country_code, admin_area_1, municipality, locality_label, languages, timezone, source_payload
         )
         VALUES ('JP', '静岡県', '浜松市', '静岡県浜松市 smoke', '["ja","en"]'::jsonb, 'Asia/Tokyo', $1::jsonb)
         RETURNING jurisdiction_id::text`,
        [JSON.stringify({ smokePrefix: prefix })],
      );
      jurisdictionId = jurisdiction.rows[0]!.jurisdiction_id;
    }
    const recipient = await client.query<{ recipient_id: string }>(
      `INSERT INTO alert_recipients (
          recipient_type, display_name, email, prefecture, municipality,
          interest_invasive, source_url, notes
       )
       VALUES ('municipality', $1, $2, '静岡県', '浜松市', true, 'https://ikimon.life/for-business/invasive-reporting', $3)
       RETURNING recipient_id::text`,
      [`外来種通報 smoke ${prefix}`, to, `temporary invasive reporting smoke ${prefix}`],
    );
    const contact = await client.query<{ contact_id: string }>(
      `INSERT INTO invasive_reporting_contacts (
          jurisdiction_id, alert_recipient_id, organization_name, department_name,
          contact_role, delivery_mode, email, send_permission_status,
          supported_languages, official_url, source_title, last_verified_at, notes, source_payload
       )
       VALUES ($1::uuid, $2::uuid, 'ikimon.life smoke recipient', '外来種通報テスト', 'municipality',
               'email', $3, 'approved', '["ja","en"]'::jsonb,
               'https://ikimon.life/for-business/invasive-reporting', 'temporary smoke', CURRENT_DATE,
               'temporary test contact; remove after smoke', $4::jsonb)
       RETURNING contact_id::text`,
      [
        jurisdictionId,
        recipient.rows[0]!.recipient_id,
        to,
        JSON.stringify({ smokePrefix: prefix }),
      ],
    );
    const rule = await client.query<{ rule_id: string }>(
      `INSERT INTO invasive_reporting_rules (
          contact_id, jurisdiction_id, reporting_category, urgency,
          taxon_names, mhlw_categories, required_fields, handling_warnings,
          user_guidance_ja, authority_guidance_ja, source_payload
       )
       VALUES ($1::uuid, $2::uuid, 'emergency_biosecurity', 'urgent',
               '["ヒアリ","Solenopsis invicta"]'::jsonb,
               '["iaspecified"]'::jsonb,
               '["写真","発見場所","発見日時","個体数"]'::jsonb,
               '["素手で触らない","生きたまま運ばない","駆除判断を自己判断しない"]'::jsonb,
               '安全な距離から写真と場所を残してください。',
               'AI候補・詳細位置・写真URLを確認依頼として共有します。',
               $3::jsonb)
       RETURNING rule_id::text`,
      [
        contact.rows[0]!.contact_id,
        jurisdictionId,
        JSON.stringify({ smokePrefix: prefix }),
      ],
    );
    await client.query(
      `INSERT INTO users (user_id, display_name, email, is_seed)
       VALUES ($1, 'Invasive smoke user', NULL, true)`,
      [`${prefix}-user`],
    );
    await client.query(
      `INSERT INTO visits (
          visit_id, user_id, observed_at, point_latitude, point_longitude,
          coordinate_uncertainty_m, observed_country, observed_prefecture,
          observed_municipality, locality_note, note, source_kind, source_payload
       )
       VALUES ($1, $2, NOW(), 34.7108, 137.7261, 15,
               'JP', '静岡県', '浜松市', '浜松市内 smoke location',
               'temporary invasive reporting smoke', 'smoke', $3::jsonb)`,
      [`${prefix}-visit`, `${prefix}-user`, JSON.stringify({ smokePrefix: prefix })],
    );
    await client.query(
      `INSERT INTO occurrences (
          occurrence_id, visit_id, scientific_name, vernacular_name,
          taxon_rank, basis_of_record, organism_origin, individual_count,
          confidence_score, evidence_tier, ai_assessment_status, source_payload
       )
       VALUES ($1, $2, 'Solenopsis invicta', 'ヒアリ', 'species',
               'HumanObservation', 'alien', 3, 0.92, 2.0, 'ai_candidate', $3::jsonb)`,
      [`${prefix}-occurrence`, `${prefix}-visit`, JSON.stringify({ note: "テスト投稿: ヒアリ候補", smokePrefix: prefix })],
    );
    const blob = await client.query<{ blob_id: string }>(
      `INSERT INTO asset_blobs (storage_path, media_type, mime_type, public_url, source_payload)
       VALUES ($1, 'image', 'image/jpeg', $2, $3::jsonb)
       RETURNING blob_id::text`,
      [
        `smoke/${prefix}.jpg`,
        `https://ikimon.life/uploads/smoke/${prefix}.jpg`,
        JSON.stringify({ smokePrefix: prefix }),
      ],
    );
    await client.query(
      `INSERT INTO evidence_assets (blob_id, occurrence_id, visit_id, asset_role, source_payload)
       VALUES ($1::uuid, $2, $3, 'photo', $4::jsonb)`,
      [
        blob.rows[0]!.blob_id,
        `${prefix}-occurrence`,
        `${prefix}-visit`,
        JSON.stringify({ smokePrefix: prefix }),
      ],
    );

    const emitSummary = await emitInvasiveReportingForOccurrence(client, {
      occurrenceId: `${prefix}-occurrence`,
      visitId: `${prefix}-visit`,
      scientificName: "Solenopsis invicta",
      vernacularName: "ヒアリ",
      genus: "Solenopsis",
      family: "Formicidae",
      orderName: "Hymenoptera",
      className: "Insecta",
      invasiveStatus: "iaspecified",
      prefecture: "静岡県",
      municipality: "浜松市",
    });
    await client.query("commit");
    return {
      jurisdictionId,
      recipientId: recipient.rows[0]!.recipient_id,
      contactId: contact.rows[0]!.contact_id,
      ruleId: rule.rows[0]!.rule_id,
      emitSummary,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function readDeliveryRows(prefix: string): Promise<Array<Record<string, unknown>>> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT delivery_id::text, delivery_status, error_message, delivered_at,
            trigger_kind, channel, recipient_id::text
       FROM alert_deliveries
      WHERE occurrence_id = $1
      ORDER BY created_at`,
    [`${prefix}-occurrence`],
  );
  return result.rows;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!args.to) throw new Error("--to=<email> is required");
  const prefix = `smoke-inv-report-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const captured: Array<{ to: string; subject: string; body: string }> = [];
  const sendEmail: SendEmailFn | undefined = args.captureOnly
    ? async (input) => {
        captured.push({ to: input.to, subject: input.subject, body: input.body });
      }
    : undefined;

  let seeded: Record<string, unknown> | null = null;
  try {
    seeded = await seedAndEmit(prefix, args.to);
    const deliverySummary = await runAlertDeliveryWorker({ batchSize: 10, sendEmail });
    const deliveries = await readDeliveryRows(prefix);
    const ok = deliverySummary.sent >= 1 && deliverySummary.failed === 0;
    console.log(JSON.stringify({ ok, prefix, seeded, deliverySummary, deliveries, captured }, null, 2));
    if (!ok) {
      throw new Error(`invasive_reporting_smoke_delivery_failed sent=${deliverySummary.sent} failed=${deliverySummary.failed}`);
    }
  } finally {
    if (!args.keep) {
      await cleanup(prefix).catch((error) => {
        console.error(`cleanup_failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    await getPool().end();
  }
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
