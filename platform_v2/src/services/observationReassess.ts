import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { matchTaxon, matchTaxonBatch, type GbifMatch } from "./gbifBackboneMatch.js";
import type { PoolClient } from "pg";

export type ReassessResult = {
  assessmentId: string;
  occurrenceId: string;
  confidenceBand: string;
  recommendedTaxonName: string;
  narrative: string;
  coexistingAdded: number;
  gbifMatchedPrimary: boolean;
  gbifMatchedCoexistingCount: number;
  modelUsed: string;
};

type GeminiJson = {
  confidence_band?: string;
  recommended_rank?: string;
  recommended_taxon_name?: string;
  recommended_scientific_name?: string;
  best_specific_taxon_name?: string;
  narrative?: string;
  simple_summary?: string;
  observer_boost?: string;
  next_step_text?: string;
  stop_reason?: string;
  fun_fact?: string;
  fun_fact_grounded?: boolean;
  diagnostic_features_seen?: string[];
  missing_evidence?: string[];
  similar_taxa?: Array<{ name?: string; rank?: string }>;
  distinguishing_tips?: string[];
  confirm_more?: string[];
  geographic_context?: string;
  seasonal_context?: string;
  coexisting_taxa?: Array<{ name?: string; scientific_name?: string; rank?: string; confidence?: number; note?: string }>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/observation_reassess.md");
let CACHED_PROMPT: string | null = null;

function loadPrompt(): string {
  if (CACHED_PROMPT) return CACHED_PROMPT;
  CACHED_PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  return CACHED_PROMPT;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadPrompt();
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

function guessSeason(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const m = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function normalizeRank(r: string | undefined): "species" | "genus" | "family" | "order" | "lifeform" | "unknown" {
  const v = String(r ?? "").toLowerCase().trim();
  if (v === "species" || v === "genus" || v === "family" || v === "order" || v === "lifeform") return v;
  return "unknown";
}

function normalizeBand(b: string | undefined): "high" | "medium" | "low" | "unknown" {
  const v = String(b ?? "").toLowerCase().trim();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

async function loadPhotoBytes(client: PoolClient, occurrenceId: string, visitId: string): Promise<Array<{ mime: string; b64: string }>> {
  const rows = await client.query<{
    mime_type: string | null;
    storage_path: string | null;
    public_url: string | null;
  }>(
    `SELECT ab.mime_type, ab.storage_path, ab.public_url
       FROM evidence_assets ea
       JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
      WHERE (ea.occurrence_id = $1 OR ea.visit_id = $2)
        AND ea.asset_role = 'observation_photo'
      ORDER BY ea.created_at ASC
      LIMIT 3`,
    [occurrenceId, visitId],
  );

  const { legacyPublicRoot } = loadConfig();
  const out: Array<{ mime: string; b64: string }> = [];
  for (const r of rows.rows) {
    const candidates: string[] = [];
    if (r.storage_path) {
      if (path.isAbsolute(r.storage_path)) candidates.push(r.storage_path);
      else candidates.push(path.join(legacyPublicRoot, r.storage_path));
    }
    if (r.public_url && !r.public_url.startsWith("http")) {
      candidates.push(path.join(legacyPublicRoot, r.public_url.replace(/^\/+/, "")));
    }
    for (const p of candidates) {
      try {
        const buf = await readFile(p);
        out.push({ mime: r.mime_type || "image/jpeg", b64: buf.toString("base64") });
        break;
      } catch {
        // next candidate
      }
    }
  }
  return out;
}

function getClient(): GoogleGenAI {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: cfg.geminiApiKey });
}

async function runGemini(prompt: string, photos: Array<{ mime: string; b64: string }>): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  const ai = getClient();
  const parts: Array<Record<string, unknown>> = photos.map((p) => ({
    inlineData: { mimeType: p.mime, data: p.b64 },
  }));
  parts.push({ text: prompt });

  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let lastErr: unknown = null;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts }] });
      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      let parsed: GeminiJson = {};
      try {
        const m = rawText.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      } catch {
        parsed = {};
      }
      return { parsed, modelUsed: model, rawText };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw err;
    }
  }
  throw lastErr ?? new Error("gemini_all_models_failed");
}

/**
 * 観察単位の AI 再判定。
 * - observation_ai_assessments に新 assessment を INSERT（旧 assessment は delete せず時系列で残す）
 * - 主 occurrence の recommended_taxon_name が空なら埋める
 * - coexisting_taxa を subject_index ≥ 1 の occurrences として追加（既存 coexisting と重複しないものだけ）
 * - ADR-0004: candidate → subject → occurrence のうち、AI 単独で昇格させないため、
 *   追加 occurrence は evidence_tier=0 / quality_grade=provisional 相当で confidence を記録。
 */
export async function reassessObservation(occurrenceId: string): Promise<ReassessResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // 1. 対象 occurrence を取得
    const occ = await client.query<{
      occurrence_id: string;
      visit_id: string;
      subject_index: number;
      vernacular_name: string | null;
      scientific_name: string | null;
      taxon_rank: string | null;
    }>(
      `SELECT occurrence_id, visit_id, subject_index, vernacular_name, scientific_name, taxon_rank
         FROM occurrences WHERE occurrence_id = $1 LIMIT 1`,
      [occurrenceId],
    );
    const target = occ.rows[0];
    if (!target) throw new Error("occurrence_not_found");
    if (target.subject_index !== 0) {
      throw new Error("reassess_only_primary");
    }

    // 2. visit のコンテキスト
    const visit = await client.query<{
      observed_at: string;
      latitude: number | null;
      longitude: number | null;
      place_id: string | null;
    }>(
      `SELECT to_char(v.observed_at, 'YYYY-MM-DD HH24:MI') AS observed_at,
              coalesce(v.point_latitude, p.center_latitude) AS latitude,
              coalesce(v.point_longitude, p.center_longitude) AS longitude,
              v.place_id
         FROM visits v LEFT JOIN places p ON p.place_id = v.place_id
        WHERE v.visit_id = $1 LIMIT 1`,
      [target.visit_id],
    );
    const vctx = visit.rows[0] ?? { observed_at: "", latitude: null, longitude: null, place_id: null };

    // 3. 写真を最大3枚ロード
    const photos = await loadPhotoBytes(client, occurrenceId, target.visit_id);
    if (photos.length === 0) {
      throw new Error("no_photo_for_reassess");
    }

    // 4. Gemini
    const lat = vctx.latitude ?? 35.0;
    const lng = vctx.longitude ?? 138.0;
    const existingLabel = target.vernacular_name || target.scientific_name || "未同定";
    const prompt = renderPrompt({
      occurrenceId,
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      observedAt: vctx.observed_at || "不明",
      season: guessSeason(vctx.observed_at || null),
      existingLabel,
      siteBriefLabel: vctx.place_id ?? "不明",
    });

    const { parsed, modelUsed, rawText } = await runGemini(prompt, photos);

    const band = normalizeBand(parsed.confidence_band);
    const rank = normalizeRank(parsed.recommended_rank);
    const recommendedName = String(parsed.recommended_taxon_name ?? "").trim();
    const recommendedScientificName = String(parsed.recommended_scientific_name ?? "").trim();
    const bestSpecific = String(parsed.best_specific_taxon_name ?? "").trim();
    const narrative = String(parsed.narrative ?? "").trim();
    const simple = String(parsed.simple_summary ?? "").trim();
    const diagFeatures = Array.isArray(parsed.diagnostic_features_seen) ? parsed.diagnostic_features_seen.filter((x) => typeof x === "string") : [];
    const missing = Array.isArray(parsed.missing_evidence) ? parsed.missing_evidence.filter((x) => typeof x === "string") : [];
    const similar = Array.isArray(parsed.similar_taxa) ? parsed.similar_taxa.filter((x) => x && typeof x.name === "string" && x.name.trim().length > 0).map((x) => ({ name: x.name, rank: x.rank ?? "species" })) : [];
    const distinguishing = Array.isArray(parsed.distinguishing_tips) ? parsed.distinguishing_tips.filter((x) => typeof x === "string") : [];
    const confirmMore = Array.isArray(parsed.confirm_more) ? parsed.confirm_more.filter((x) => typeof x === "string") : [];
    const coex = Array.isArray(parsed.coexisting_taxa)
      ? parsed.coexisting_taxa.filter((x) => {
          if (!x) return false;
          const name = typeof x.name === "string" ? x.name.trim() : "";
          const scientificName = typeof x.scientific_name === "string" ? x.scientific_name.trim() : "";
          return name.length > 0 || scientificName.length > 0;
        })
      : [];

    const primaryRankHint = rank === "unknown" ? null : rank;
    const primaryMatchName = recommendedScientificName || recommendedName;
    const coexPrepared = coex.map((c) => {
      const vernacularName = String(c.name ?? "").trim();
      const scientificName = String(c.scientific_name ?? "").trim();
      const coRank = normalizeRank(c.rank);
      const coConf =
        typeof c.confidence === "number" && Number.isFinite(c.confidence)
          ? Math.min(1, Math.max(0, c.confidence))
          : 0.5;
      return {
        vernacularName,
        scientificName,
        matchName: scientificName || vernacularName,
        rankHint: coRank === "unknown" ? null : coRank,
        rank: coRank,
        confidence: coConf,
        note: c.note ?? null,
      };
    });

    const [primaryGbifMatch, coexistingGbifMatches]: [GbifMatch, GbifMatch[]] = await Promise.all([
      matchTaxon({ name: primaryMatchName, rank: primaryRankHint }),
      matchTaxonBatch(coexPrepared.map((c) => ({ name: c.matchName, rank: c.rankHint }))),
    ]);
    const gbifMatchedPrimary = primaryGbifMatch.usageKey !== null;
    const gbifMatchedCoexistingCount = coexistingGbifMatches.reduce((count, match) => (match.usageKey !== null ? count + 1 : count), 0);
    const confidenceScore = band === "high" ? 0.85 : band === "medium" ? 0.6 : band === "low" ? 0.4 : 0.3;

    // 5. DB 反映
    await client.query("begin");
    const assessmentId = randomUUID();
    await client.query(
      `INSERT INTO observation_ai_assessments (
         assessment_id, occurrence_id, visit_id,
         confidence_band, model_used, prompt_version,
         recommended_rank, recommended_taxon_name, best_specific_taxon_name,
         narrative, simple_summary,
         observer_boost, next_step_text, stop_reason,
         fun_fact, fun_fact_grounded,
         diagnostic_features_seen, missing_evidence, similar_taxa, distinguishing_tips, confirm_more,
         geographic_context, seasonal_context, raw_json
       ) VALUES (
         $1::uuid, $2, $3,
         $4, $5, $6,
         $7, $8, $9,
         $10, $11,
         $12, $13, $14,
         $15, $16,
         $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb,
         $22, $23, $24::jsonb
       )`,
      [
        assessmentId,
        occurrenceId,
        target.visit_id,
        band,
        modelUsed,
        "observation_reassess.md/v1",
        rank === "unknown" ? null : rank,
        recommendedName || null,
        bestSpecific || null,
        narrative,
        simple,
        String(parsed.observer_boost ?? "").trim(),
        String(parsed.next_step_text ?? "").trim(),
        String(parsed.stop_reason ?? "").trim(),
        String(parsed.fun_fact ?? "").trim(),
        Boolean(parsed.fun_fact_grounded),
        JSON.stringify(diagFeatures),
        JSON.stringify(missing),
        JSON.stringify(similar),
        JSON.stringify(distinguishing),
        JSON.stringify(confirmMore),
        String(parsed.geographic_context ?? "").trim(),
        String(parsed.seasonal_context ?? "").trim(),
        JSON.stringify({ raw: rawText.slice(0, 4000), parsed }),
      ],
    );

    // 6. 主 occurrence の taxon 情報を AI 再判定で更新（null は既存値維持）
    const primaryGbifUsageKey = primaryGbifMatch.usageKey;
    const primaryTaxonConceptVersion = primaryGbifUsageKey !== null ? `gbif:${primaryGbifUsageKey}` : null;
    const primaryLineage = primaryGbifUsageKey !== null ? primaryGbifMatch : null;
    if (
      recommendedName ||
      recommendedScientificName ||
      primaryRankHint ||
      primaryTaxonConceptVersion ||
      primaryLineage?.kingdom ||
      primaryLineage?.phylum ||
      primaryLineage?.className ||
      primaryLineage?.orderName ||
      primaryLineage?.family ||
      primaryLineage?.genus
    ) {
      await client.query(
        `UPDATE occurrences
            SET vernacular_name = coalesce($2, vernacular_name),
                scientific_name = coalesce($3, scientific_name),
                taxon_rank = coalesce($4, taxon_rank),
                taxon_concept_version = coalesce($5, taxon_concept_version),
                kingdom = coalesce($6, kingdom),
                phylum = coalesce($7, phylum),
                class_name = coalesce($8, class_name),
                order_name = coalesce($9, order_name),
                family = coalesce($10, family),
                genus = coalesce($11, genus),
                confidence_score = $12,
                source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object('v2_ai_reassess', jsonb_build_object('model', $13::text, 'assessment_id', $14::text))
          WHERE occurrence_id = $1`,
        [
          occurrenceId,
          recommendedName || null,
          recommendedScientificName || null,
          primaryRankHint,
          primaryTaxonConceptVersion,
          primaryLineage?.kingdom ?? null,
          primaryLineage?.phylum ?? null,
          primaryLineage?.className ?? null,
          primaryLineage?.orderName ?? null,
          primaryLineage?.family ?? null,
          primaryLineage?.genus ?? null,
          confidenceScore,
          modelUsed,
          assessmentId,
        ],
      );
    }

    // 7. coexisting_taxa を subject として追加（既存の subject_index ≥ 1 と重複名は除く）
    const existingSubjects = await client.query<{ name: string }>(
      `SELECT lower(coalesce(nullif(vernacular_name,''), scientific_name, '')) AS name
         FROM occurrences WHERE visit_id = $1 AND subject_index >= 1`,
      [target.visit_id],
    );
    const knownNames = new Set(existingSubjects.rows.map((r) => r.name).filter((n) => n.length > 0));

    const maxIdxRes = await client.query<{ max: number | null }>(
      `SELECT max(subject_index) AS max FROM occurrences WHERE visit_id = $1`,
      [target.visit_id],
    );
    let nextIdx = (maxIdxRes.rows[0]?.max ?? 0) + 1;
    let coexAdded = 0;

    for (let idx = 0; idx < coexPrepared.length; idx += 1) {
      const c = coexPrepared[idx];
      if (!c) continue;
      const dedupeName = (c.vernacularName || c.scientificName).toLowerCase();
      if (!dedupeName) continue;
      if (knownNames.has(dedupeName)) continue;

      const coGbif = coexistingGbifMatches[idx];
      const coGbifUsageKey = coGbif?.usageKey ?? null;
      const coTaxonConceptVersion = coGbifUsageKey !== null ? `gbif:${coGbifUsageKey}` : null;
      const coLineage = coGbifUsageKey !== null ? coGbif : null;
      const newOccId = `occ:${target.visit_id}:${nextIdx}`;

      await client.query(
        `INSERT INTO occurrences (
           occurrence_id, visit_id, subject_index,
           vernacular_name, scientific_name, taxon_rank, taxon_concept_version, confidence_score,
           kingdom, phylum, class_name, order_name, family, genus,
           source_payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
         ON CONFLICT (occurrence_id) DO NOTHING`,
        [
          newOccId,
          target.visit_id,
          nextIdx,
          c.vernacularName || null,
          c.scientificName || null,
          c.rank === "unknown" ? null : c.rank,
          coTaxonConceptVersion,
          c.confidence,
          coLineage?.kingdom ?? null,
          coLineage?.phylum ?? null,
          coLineage?.className ?? null,
          coLineage?.orderName ?? null,
          coLineage?.family ?? null,
          coLineage?.genus ?? null,
          JSON.stringify({
            v2_subject: {
              role_hint: "coexisting",
              source: "ai_reassess",
              assessment_id: assessmentId,
              note: c.note,
              gbif: {
                usageKey: coGbifUsageKey,
                matchType: coGbif?.matchType ?? "NONE",
                confidence: coGbif?.confidence ?? null,
              },
            },
          }),
        ],
      );
      knownNames.add(dedupeName);
      nextIdx += 1;
      coexAdded += 1;
    }

    await client.query("commit");

    return {
      assessmentId,
      occurrenceId,
      confidenceBand: band,
      recommendedTaxonName: recommendedName,
      narrative,
      coexistingAdded: coexAdded,
      gbifMatchedPrimary,
      gbifMatchedCoexistingCount,
      modelUsed,
    };
  } catch (err) {
    try { await client.query("rollback"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}
