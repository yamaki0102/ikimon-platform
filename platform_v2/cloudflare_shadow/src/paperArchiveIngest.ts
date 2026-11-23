import type { Env } from "./core/env";
import { containsDiscoveryPersonalInformation } from "./eventDiscoveryPrivacy";

export const PAPER_ARCHIVE_PAGES_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS paper_archive_pages (
  page_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL DEFAULT '',
  place_name TEXT NOT NULL,
  observed_year INTEGER NOT NULL,
  observed_date TEXT NOT NULL,
  source_image_url TEXT NOT NULL,
  species_json TEXT NOT NULL,
  participant_count INTEGER,
  is_rare_species INTEGER NOT NULL DEFAULT 0,
  face_redacted INTEGER NOT NULL DEFAULT 0,
  publish_status TEXT NOT NULL DEFAULT 'draft',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  last_corrected_by TEXT NOT NULL DEFAULT '',
  correction_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)
`.trim();

export type PaperArchivePageRow = {
  page_id: string;
  place_id: string;
  place_name: string;
  observed_year: number;
  observed_date: string;
  source_image_url: string;
  species_json: string;
  participant_count: number | null;
  is_rare_species: number;
  face_redacted: number;
  publish_status: string;
  created_by_user_id: string;
  last_corrected_by: string;
  correction_count: number;
  created_at: number;
};

export class PaperArchiveHttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

export async function ensurePaperArchiveTable(env: Env): Promise<void> {
  await env.CORE_DB.prepare(PAPER_ARCHIVE_PAGES_CREATE_SQL).run();
  try {
    await env.CORE_DB.prepare(
      "ALTER TABLE paper_archive_pages ADD COLUMN created_by_user_id TEXT NOT NULL DEFAULT ''"
    ).run();
  } catch {
    // Column already exists
  }
}

export function isAllowedZukanArchiveImageUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (/^\/(?:media|derived|archive|assets|api\/v1\/media)\//u.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "zukan.earth";
  } catch {
    return false;
  }
}

export async function loadPaperArchivePageById(env: Env, pageId: string): Promise<PaperArchivePageRow | null> {
  await ensurePaperArchiveTable(env);
  return env.CORE_DB.prepare(
    "SELECT * FROM paper_archive_pages WHERE page_id = ?1 LIMIT 1"
  ).bind(pageId).first<PaperArchivePageRow>();
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function redactPaperPersonalInfo(text: string): string {
  let out = String(text ?? "");
  out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[連絡先保護]");
  out = out.replace(/0\d{1,4}-\d{1,4}-\d{3,4}/g, "[電話保護]");
  out = out.replace(/((?:記録者|氏名|担当|代表|名前)[:：])\s*[^\s、。,.\n]+/g, "$1 [個人名保護]");
  if (containsDiscoveryPersonalInformation(out)) {
    out = out.replace(/(?:さん|君|ちゃん|氏)\b/g, "");
  }
  return out.trim();
}

export function extractPaperArchivePageFields(rawText: string): {
  observedYear: number;
  observedDate: string;
  placeName: string;
  speciesList: string[];
  participantCount: number | null;
} {
  const safeText = redactPaperPersonalInfo(rawText);
  let observedDate = "";
  let observedYear = new Date().getUTCFullYear();

  const jpDateMatch = safeText.match(/(19\d{2}|20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const isoDateMatch = safeText.match(/(19\d{2}|20\d{2})-(\d{1,2})-(\d{1,2})/);
  const yearOnlyMatch = safeText.match(/(19\d{2}|20\d{2})\s*年?/);

  if (jpDateMatch) {
    observedYear = Number(jpDateMatch[1]);
    observedDate = `${jpDateMatch[1]}-${String(Number(jpDateMatch[2])).padStart(2, "0")}-${String(Number(jpDateMatch[3])).padStart(2, "0")}`;
  } else if (isoDateMatch) {
    observedYear = Number(isoDateMatch[1]);
    observedDate = `${isoDateMatch[1]}-${String(Number(isoDateMatch[2])).padStart(2, "0")}-${String(Number(isoDateMatch[3])).padStart(2, "0")}`;
  } else if (yearOnlyMatch) {
    observedYear = Number(yearOnlyMatch[1]);
    observedDate = `${observedYear}-01-01`;
  } else {
    observedDate = `${observedYear}-01-01`;
  }

  const placeMatch = safeText.match(/(?:場所|観察地|地点)[:：]\s*([^\n、,。]+)/);
  const placeName = placeMatch?.[1]?.trim() || "記録地点";

  const countMatch = safeText.match(/(?:人数|参加者)[:：]?\s*(\d{1,4})\s*(?:人|名)?/);
  const participantCount = countMatch ? Number(countMatch[1]) : null;

  const speciesMatch = safeText.match(/(?:生きもの|種|観察種|確認)[:：]\s*([^\n]+)/);
  const speciesList = speciesMatch?.[1]
    ? speciesMatch[1].split(/[、,・/]+/).map((s) => redactPaperPersonalInfo(s)).filter(Boolean).slice(0, 30)
    : [];

  return { observedYear, observedDate, placeName, speciesList, participantCount };
}

export async function ingestPaperArchivePages(
  env: Env,
  actorUserId: string,
  pages: Array<{
    pageId?: string;
    placeId?: string;
    placeName?: string;
    observedYear?: number;
    observedDate?: string;
    sourceImageUrl: string;
    rawText?: string;
    speciesList?: string[];
    participantCount?: number | null;
    isRareSpecies?: boolean;
  }>
): Promise<PaperArchivePageRow[]> {
  const ownerUserId = actorUserId.trim();
  if (!ownerUserId) throw new PaperArchiveHttpError(401, "login_required");
  await ensurePaperArchiveTable(env);
  const inserted: PaperArchivePageRow[] = [];

  for (const item of pages.slice(0, 50)) {
    const sourceImageUrl = item.sourceImageUrl.trim();
    if (!isAllowedZukanArchiveImageUrl(sourceImageUrl)) {
      throw new PaperArchiveHttpError(400, "invalid_source_image_url");
    }

    let pageId = `pap_${crypto.randomUUID().slice(0, 12)}`;
    let isDraftUpdate = false;
    if (typeof item.pageId === "string" && /^pap_[A-Za-z0-9_-]{3,80}$/.test(item.pageId)) {
      const existing = await env.CORE_DB.prepare(
        "SELECT page_id, created_by_user_id, publish_status FROM paper_archive_pages WHERE page_id = ?1 LIMIT 1"
      ).bind(item.pageId).first<{ page_id: string; created_by_user_id: string; publish_status: string }>();
      if (existing) {
        if (existing.created_by_user_id !== ownerUserId || existing.publish_status !== "draft") {
          throw new PaperArchiveHttpError(403, "forbidden_page_overwrite");
        }
        pageId = existing.page_id;
        isDraftUpdate = true;
      }
    }

    const extracted = extractPaperArchivePageFields(item.rawText ?? "");
    const isRare = item.isRareSpecies === true ? 1 : 0;
    const placeName = redactPaperPersonalInfo(item.placeName?.trim() || extracted.placeName);
    const observedYear = typeof item.observedYear === "number" && Number.isInteger(item.observedYear)
      ? item.observedYear
      : extracted.observedYear;
    const observedDate = item.observedDate?.trim() || extracted.observedDate;
    const species = (Array.isArray(item.speciesList) ? item.speciesList : extracted.speciesList)
      .map((s) => redactPaperPersonalInfo(String(s)))
      .filter(Boolean);
    const participantCount = typeof item.participantCount === "number" ? item.participantCount : extracted.participantCount;

    const row: PaperArchivePageRow = {
      page_id: pageId,
      place_id: isRare ? "" : (item.placeId ?? "").trim().slice(0, 160),
      place_name: isRare ? "広域（希少種保護のため位置非公開）" : placeName.slice(0, 120),
      observed_year: observedYear,
      observed_date: observedDate.slice(0, 32),
      source_image_url: sourceImageUrl.slice(0, 500),
      species_json: JSON.stringify(species),
      participant_count: participantCount,
      is_rare_species: isRare,
      face_redacted: 0,
      publish_status: "draft",
      created_by_user_id: ownerUserId,
      last_corrected_by: "",
      correction_count: 0,
      created_at: Date.now()
    };

    if (isDraftUpdate) {
      await env.CORE_DB.prepare(
        `UPDATE paper_archive_pages
         SET place_name = ?2, observed_year = ?3, observed_date = ?4, species_json = ?5,
             participant_count = ?6, source_image_url = ?7, face_redacted = 0
         WHERE page_id = ?1 AND created_by_user_id = ?8 AND publish_status = 'draft'`
      ).bind(
        row.page_id,
        row.place_name,
        row.observed_year,
        row.observed_date,
        row.species_json,
        row.participant_count,
        row.source_image_url,
        ownerUserId
      ).run();
    } else {
      await env.CORE_DB.prepare(
        `INSERT INTO paper_archive_pages (
          page_id, place_id, place_name, observed_year, observed_date, source_image_url,
          species_json, participant_count, is_rare_species, face_redacted, publish_status,
          created_by_user_id, last_corrected_by, correction_count, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`
      ).bind(
        row.page_id,
        row.place_id,
        row.place_name,
        row.observed_year,
        row.observed_date,
        row.source_image_url,
        row.species_json,
        row.participant_count,
        row.is_rare_species,
        row.face_redacted,
        row.publish_status,
        row.created_by_user_id,
        row.last_corrected_by,
        row.correction_count,
        row.created_at
      ).run();
    }

    inserted.push(row);
  }

  return inserted;
}

export async function correctPaperArchivePage(
  env: Env,
  pageId: string,
  input: {
    correctedByName: string;
    placeName?: string;
    observedYear?: number;
    observedDate?: string;
    speciesList?: string[];
    participantCount?: number | null;
  }
): Promise<PaperArchivePageRow | null> {
  await ensurePaperArchiveTable(env);
  const existing = await env.CORE_DB.prepare(
    "SELECT * FROM paper_archive_pages WHERE page_id = ?1 LIMIT 1"
  ).bind(pageId).first<PaperArchivePageRow>();
  if (!existing) return null;

  const nextPlaceName = existing.is_rare_species
    ? existing.place_name
    : redactPaperPersonalInfo(input.placeName?.trim() || existing.place_name);
  const nextYear = typeof input.observedYear === "number" ? input.observedYear : existing.observed_year;
  const nextDate = input.observedDate?.trim() || existing.observed_date;
  const nextSpecies = Array.isArray(input.speciesList)
    ? JSON.stringify(input.speciesList.map((s) => redactPaperPersonalInfo(String(s))).filter(Boolean))
    : existing.species_json;
  const nextCount = typeof input.participantCount === "number" ? input.participantCount : existing.participant_count;
  const corrector = input.correctedByName.trim().slice(0, 80) || "会員";

  await env.CORE_DB.prepare(
    `UPDATE paper_archive_pages
     SET place_name = ?2, observed_year = ?3, observed_date = ?4, species_json = ?5,
         participant_count = ?6, last_corrected_by = ?7, correction_count = correction_count + 1
     WHERE page_id = ?1`
  ).bind(pageId, nextPlaceName, nextYear, nextDate, nextSpecies, nextCount, corrector).run();

  return {
    ...existing,
    place_name: nextPlaceName,
    observed_year: nextYear,
    observed_date: nextDate,
    species_json: nextSpecies,
    participant_count: nextCount,
    last_corrected_by: corrector,
    correction_count: existing.correction_count + 1
  };
}

export async function setPaperArchivePublishStatus(
  env: Env,
  pageId: string,
  publishStatus: "draft" | "published"
): Promise<{ ok: boolean; error?: string }> {
  await ensurePaperArchiveTable(env);
  const existing = await loadPaperArchivePageById(env, pageId);
  if (!existing) return { ok: false, error: "page_not_found" };
  if (publishStatus === "published" && existing.face_redacted !== 1) {
    return { ok: false, error: "face_redaction_required" };
  }
  const res = await env.CORE_DB.prepare(
    "UPDATE paper_archive_pages SET publish_status = ?2 WHERE page_id = ?1"
  ).bind(pageId, publishStatus).run();
  const changes = Number((res as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  return { ok: changes > 0 };
}

export async function listPublishedPaperArchivesForPlace(env: Env, placeId: string): Promise<PaperArchivePageRow[]> {
  try {
    await ensurePaperArchiveTable(env);
    const res = await env.CORE_DB.prepare(
      `SELECT * FROM paper_archive_pages
       WHERE place_id = ?1 AND publish_status = 'published' AND face_redacted = 1
       ORDER BY observed_year DESC, observed_date DESC`
    ).bind(placeId).all<PaperArchivePageRow>();
    return res.results ?? [];
  } catch {
    return [];
  }
}

export function renderPaperArchiveTimelineHtml(pages: PaperArchivePageRow[]): string {
  if (!pages || pages.length === 0) return "";
  return `<section class="pap-timeline" data-paper-archive-timeline aria-labelledby="pap-heading">
    <style>
      .pap-timeline{margin-top:24px;padding:18px;border:1px solid #d7dfd8;border-radius:16px;background:#fff;display:grid;gap:14px}
      .pap-timeline h2{margin:0;font-size:1.2rem}
      .pap-item{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;padding:12px;border-radius:12px;background:#f7faf7;border:1px solid #e1e9e2}
      .pap-item img{width:120px;height:150px;object-fit:cover;border-radius:8px;border:1px solid #cfd9d2;background:#fff}
      .pap-meta{display:grid;gap:6px;align-content:start}
    </style>
    <h2 id="pap-heading">紙の記録・過去の年表（場所×年）</h2>
    ${pages.map((p) => {
      let species: string[] = [];
      try { species = JSON.parse(p.species_json) as string[]; } catch { species = []; }
      return `<article class="pap-item" data-paper-page="${escapeHtml(p.page_id)}">
        <img src="${escapeHtml(p.source_image_url)}" alt="${escapeHtml(`${p.observed_year}年 ${p.place_name} の元紙面`)}" loading="lazy">
        <div class="pap-meta">
          <strong>${p.observed_year}年（${escapeHtml(p.observed_date)}） · ${escapeHtml(p.place_name)}</strong>
          <div>生きもの: ${escapeHtml(species.join("、") || "記載なし")}</div>
          ${p.participant_count !== null ? `<div>参加人数: ${p.participant_count}人</div>` : ""}
          ${p.last_corrected_by ? `<small>声の修正: ${escapeHtml(p.last_corrected_by)}</small>` : ""}
        </div>
      </article>`;
    }).join("")}
  </section>`;
}
