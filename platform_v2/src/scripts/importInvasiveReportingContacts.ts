import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";

type SeedFile = {
  source?: string;
  verifiedAt?: string;
  defaultSendPermissionStatus?: string;
  jurisdictions: SeedJurisdiction[];
  contacts: SeedContact[];
};

type SeedJurisdiction = {
  key: string;
  countryCode: string;
  adminArea1?: string;
  adminArea2?: string;
  municipality?: string;
  localityLabel: string;
  languages?: string[];
  timezone?: string;
};

type SeedContact = {
  key: string;
  jurisdictionKey: string;
  organizationName: string;
  departmentName?: string;
  contactRole: string;
  deliveryMode?: string;
  email?: string;
  phone?: string;
  fax?: string;
  formUrl?: string;
  apiEndpoint?: string;
  sendPermissionStatus?: string;
  supportedLanguages?: string[];
  officialUrl?: string;
  sourceTitle?: string;
  lastVerifiedAt?: string;
  activeFrom?: string;
  activeUntil?: string;
  notes?: string;
  rules?: SeedRule[];
};

type SeedRule = {
  category: string;
  urgency?: string;
  taxonNames?: string[];
  mhlwCategories?: string[];
  requiredFields?: string[];
  handlingWarnings?: string[];
  userGuidanceJa?: string;
  authorityGuidanceJa?: string;
  activeFrom?: string;
  activeUntil?: string;
};

type ImportSummary = {
  jurisdictions: number;
  contacts: number;
  rules: number;
  alertRecipientsLinked: number;
};

const ALLOWED_PERMISSION = new Set(["approved", "pending", "not_requested", "denied", "external_only", "revoked"]);

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function resolveInputFile(raw: string): string {
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(process.cwd(), raw);
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizePermission(raw: string | undefined, fallback: string | undefined): string {
  const value = raw || fallback || "not_requested";
  return ALLOWED_PERMISSION.has(value) ? value : "not_requested";
}

function ruleKey(contactKey: string, rule: SeedRule, index: number): string {
  const taxa = (rule.taxonNames ?? []).join("|");
  return `${contactKey}:${rule.category}:${rule.urgency ?? "normal"}:${taxa || index}`;
}

async function importSeed(seed: SeedFile): Promise<ImportSummary> {
  const pool = getPool();
  const client = await pool.connect();
  const summary: ImportSummary = { jurisdictions: 0, contacts: 0, rules: 0, alertRecipientsLinked: 0 };
  const jurisdictionIds = new Map<string, string>();

  try {
    await client.query("begin");

    for (const jurisdiction of seed.jurisdictions) {
      const existing = await client.query<{ jurisdiction_id: string }>(
        `SELECT jurisdiction_id::text
           FROM reporting_jurisdictions
          WHERE country_code = $1::text
            AND COALESCE(admin_area_1, '') = COALESCE($2::text, '')
            AND COALESCE(admin_area_2, '') = COALESCE($3::text, '')
            AND COALESCE(municipality, '') = COALESCE($4::text, '')
          LIMIT 1`,
        [
          jurisdiction.countryCode,
          jurisdiction.adminArea1 ?? null,
          jurisdiction.adminArea2 ?? null,
          jurisdiction.municipality ?? null,
        ],
      );
      let jurisdictionId = existing.rows[0]?.jurisdiction_id ?? null;
      const values = [
        jurisdiction.countryCode,
        jurisdiction.adminArea1 ?? null,
        jurisdiction.adminArea2 ?? null,
        jurisdiction.municipality ?? null,
        jurisdiction.localityLabel,
        JSON.stringify(jurisdiction.languages ?? ["ja"]),
        jurisdiction.timezone ?? "Asia/Tokyo",
        JSON.stringify({ seedKey: jurisdiction.key, source: seed.source ?? "" }),
      ];
      if (jurisdictionId) {
        await client.query(
          `UPDATE reporting_jurisdictions
              SET locality_label = $1,
                  languages = $2::jsonb,
                  timezone = $3,
                  source_payload = source_payload || $4::jsonb,
                  updated_at = NOW()
            WHERE jurisdiction_id = $5::uuid`,
          [values[4], values[5], values[6], values[7], jurisdictionId],
        );
      } else {
        const inserted = await client.query<{ jurisdiction_id: string }>(
          `INSERT INTO reporting_jurisdictions (
              country_code, admin_area_1, admin_area_2, municipality, locality_label,
              languages, timezone, source_payload, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, NOW())
           RETURNING jurisdiction_id::text`,
          values,
        );
        jurisdictionId = inserted.rows[0]!.jurisdiction_id;
      }
      jurisdictionIds.set(jurisdiction.key, jurisdictionId);
      summary.jurisdictions += 1;
    }

    for (const contact of seed.contacts) {
      const jurisdictionId = jurisdictionIds.get(contact.jurisdictionKey);
      if (!jurisdictionId) throw new Error(`Unknown jurisdictionKey: ${contact.jurisdictionKey}`);
      const jurisdiction = seed.jurisdictions.find((item) => item.key === contact.jurisdictionKey);
      const seedPermission = normalizePermission(contact.sendPermissionStatus, seed.defaultSendPermissionStatus);
      const existing = await client.query<{ contact_id: string; send_permission_status: string }>(
        `SELECT contact_id::text, send_permission_status
           FROM invasive_reporting_contacts
          WHERE source_payload->>'seedKey' = $1::text
          LIMIT 1`,
        [contact.key],
      );
      const currentPermission = existing.rows[0]?.send_permission_status;
      const permission = currentPermission && currentPermission !== "not_requested" ? currentPermission : seedPermission;
      const alertRecipientId = await ensureAlertRecipientForApprovedContact(client, contact, jurisdiction, permission);
      if (alertRecipientId) summary.alertRecipientsLinked += 1;

      const values = [
        jurisdictionId,
        alertRecipientId,
        contact.organizationName,
        contact.departmentName ?? "",
        contact.contactRole,
        contact.deliveryMode ?? "email",
        contact.email ?? null,
        contact.phone ?? null,
        contact.fax ?? null,
        contact.formUrl ?? null,
        contact.apiEndpoint ?? null,
        permission,
        JSON.stringify(contact.supportedLanguages ?? ["ja"]),
        contact.officialUrl ?? "",
        contact.sourceTitle ?? "",
        normalizeDate(contact.lastVerifiedAt ?? seed.verifiedAt),
        normalizeDate(contact.activeFrom),
        normalizeDate(contact.activeUntil),
        contact.notes ?? "",
        JSON.stringify({ seedKey: contact.key, source: seed.source ?? "" }),
      ];

      let contactId = existing.rows[0]?.contact_id ?? null;
      if (contactId) {
        await client.query(
          `UPDATE invasive_reporting_contacts
              SET jurisdiction_id = $1::uuid,
                  alert_recipient_id = $2::uuid,
                  organization_name = $3,
                  department_name = $4,
                  contact_role = $5,
                  delivery_mode = $6,
                  email = $7,
                  phone = $8,
                  fax = $9,
                  form_url = $10,
                  api_endpoint = $11,
                  send_permission_status = $12,
                  supported_languages = $13::jsonb,
                  official_url = $14,
                  source_title = $15,
                  last_verified_at = $16::date,
                  active_from = $17::date,
                  active_until = $18::date,
                  notes = $19,
                  source_payload = source_payload || $20::jsonb,
                  updated_at = NOW()
            WHERE contact_id = $21::uuid`,
          [...values, contactId],
        );
      } else {
        const inserted = await client.query<{ contact_id: string }>(
          `INSERT INTO invasive_reporting_contacts (
              jurisdiction_id, alert_recipient_id, organization_name, department_name,
              contact_role, delivery_mode, email, phone, fax, form_url, api_endpoint,
              send_permission_status, supported_languages, official_url, source_title,
              last_verified_at, active_from, active_until, notes, source_payload
           )
           VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11,
              $12, $13::jsonb, $14, $15, $16::date, $17::date, $18::date, $19, $20::jsonb
           )
           RETURNING contact_id::text`,
          values,
        );
        contactId = inserted.rows[0]!.contact_id;
      }
      summary.contacts += 1;

      for (const [index, rule] of (contact.rules ?? []).entries()) {
        const seedRuleKey = ruleKey(contact.key, rule, index);
        const ruleValues = [
          contactId,
          jurisdictionId,
          rule.category,
          rule.urgency ?? "normal",
          JSON.stringify(rule.taxonNames ?? []),
          JSON.stringify(rule.mhlwCategories ?? []),
          JSON.stringify(rule.requiredFields ?? []),
          JSON.stringify(rule.handlingWarnings ?? []),
          rule.userGuidanceJa ?? "",
          rule.authorityGuidanceJa ?? "",
          normalizeDate(rule.activeFrom),
          normalizeDate(rule.activeUntil),
          JSON.stringify({ seedKey: seedRuleKey, contactSeedKey: contact.key, source: seed.source ?? "" }),
        ];
        const existingRule = await client.query<{ rule_id: string }>(
          `SELECT rule_id::text
             FROM invasive_reporting_rules
            WHERE source_payload->>'seedKey' = $1::text
            LIMIT 1`,
          [seedRuleKey],
        );
        const ruleId = existingRule.rows[0]?.rule_id;
        if (ruleId) {
          await client.query(
            `UPDATE invasive_reporting_rules
                SET contact_id = $1::uuid,
                    jurisdiction_id = $2::uuid,
                    reporting_category = $3,
                    urgency = $4,
                    taxon_names = $5::jsonb,
                    mhlw_categories = $6::jsonb,
                    required_fields = $7::jsonb,
                    handling_warnings = $8::jsonb,
                    user_guidance_ja = $9,
                    authority_guidance_ja = $10,
                    active_from = $11::date,
                    active_until = $12::date,
                    source_payload = source_payload || $13::jsonb,
                    updated_at = NOW()
              WHERE rule_id = $14::uuid`,
            [...ruleValues, ruleId],
          );
        } else {
          await client.query(
            `INSERT INTO invasive_reporting_rules (
                contact_id, jurisdiction_id, reporting_category, urgency, taxon_names,
                mhlw_categories, required_fields, handling_warnings, user_guidance_ja,
                authority_guidance_ja, active_from, active_until, source_payload
             )
             VALUES (
                $1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb,
                $8::jsonb, $9, $10, $11::date, $12::date, $13::jsonb
             )`,
            ruleValues,
          );
        }
        summary.rules += 1;
      }
    }

    await client.query("commit");
    return summary;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function ensureAlertRecipientForApprovedContact(
  client: { query: PoolClient["query"] },
  contact: SeedContact,
  jurisdiction: SeedJurisdiction | undefined,
  permission: string,
): Promise<string | null> {
  if (permission !== "approved") return null;
  if ((contact.deliveryMode ?? "email") !== "email") return null;
  if (!contact.email) return null;

  const existing = await client.query<{ recipient_id: string }>(
    `SELECT recipient_id::text
       FROM alert_recipients
      WHERE source_url = $1::text
        AND display_name = $2::text
        AND email = $3::text
      LIMIT 1`,
    [contact.officialUrl ?? "", contact.organizationName, contact.email],
  );
  if (existing.rows[0]) return existing.rows[0].recipient_id;

  const inserted = await client.query<{ recipient_id: string }>(
    `INSERT INTO alert_recipients (
        recipient_type, display_name, email, prefecture, municipality,
        interest_invasive, source_url, notes
     )
     VALUES ($1, $2, $3, $4, $5, true, $6, $7)
     RETURNING recipient_id::text`,
    [
      contact.contactRole === "municipality" ? "municipality" : "agency",
      contact.organizationName,
      contact.email,
      jurisdiction?.adminArea1 ?? null,
      jurisdiction?.municipality ?? null,
      contact.officialUrl ?? "",
      `invasive reporting contact seedKey=${contact.key}`,
    ],
  );
  return inserted.rows[0]!.recipient_id;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const input = String(args.file ?? "");
  if (!input) {
    throw new Error("--file is required");
  }
  const filePath = resolveInputFile(input);
  const raw = await readFile(filePath, "utf8");
  const seed = JSON.parse(raw) as SeedFile;
  if (!Array.isArray(seed.jurisdictions) || !Array.isArray(seed.contacts)) {
    throw new Error(`Invalid invasive reporting seed: ${filePath}`);
  }
  const summary = await importSeed(seed);
  console.log(JSON.stringify({ ok: true, file: filePath, summary }, null, 2));
  await getPool().end();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
