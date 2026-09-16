import { parseSavedTarget, savedSnapshotBundle, type SavedReference, type SavedTarget } from "../../src/services/savedReference";

export interface SavedReferenceStatement {
  bind(...values: (string | number | null)[]): SavedReferenceStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface SavedReferenceDatabase { prepare(sql: string): SavedReferenceStatement; }

type Row = { target_key: string; target_type: string; target_id: string; target_path: string;
  is_saved: number; revision: number; last_mutation_id: string; created_at: string; updated_at: string };
export type SavedSourceResolver = (target: SavedTarget) => Promise<{ availability: SavedReference["availability"]; title: string | null }>;
export type SavedSession = { userId: string; banned?: boolean } | null;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "vary": "cookie, authorization", "x-robots-tag": "noindex, nofollow" } });
const columns = "target_key, target_type, target_id, target_path, is_saved, revision, last_mutation_id, created_at, updated_at";
const object = (x: unknown): x is Record<string,unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
export function isSavedReferencesPath(path: string): boolean { return path === "/api/v1/me/saved" || path === "/api/v1/me/saved/export"; }

/** Called only after product session authentication; no caller-chosen identity or external fetch. */
export async function handleSavedReferences(request: Request, db: SavedReferenceDatabase, session: SavedSession, resolveSource: SavedSourceResolver): Promise<Response> {
  if (!session) return response({ error: "auth_required" }, 401);
  if (session.banned) return response({ error: "account_unavailable" }, 403);
  const url = new URL(request.url);
  if (!["GET", "POST"].includes(request.method)) return response({ error: "method_not_allowed" }, 405);
  if (request.method === "POST" && (request.headers.get("origin") !== url.origin
    || ![null, "same-origin", "none"].includes(request.headers.get("sec-fetch-site")))) return response({ error: "same_origin_required" }, 403);
  const find = (key: string) => db.prepare(`SELECT ${columns} FROM user_saved_references WHERE user_id = ? AND target_key = ?`).bind(session.userId, key).first<Row>();
  const present = async (row: Row): Promise<SavedReference> => {
    const target = parseSavedTarget(row.target_path);
    const source = await resolveSource(target).catch(() => ({ availability: "unknown" as const, title: null }));
    return { ...target, saved: row.is_saved === 1, revision: row.revision, updatedAt: row.updated_at,
      availability: source.availability, title: source.availability === "available" ? source.title : null };
  };
  try {
    if (request.method === "GET") {
      if (url.pathname.endsWith("/export")) return response({ error: "selection_required" }, 405);
      const path = url.searchParams.get("target");
      if (path !== null) {
        const target = parseSavedTarget(path); const row = await find(target.key);
        return response({ item: row ? await present(row) : { ...target, saved: false, revision: 0, updatedAt: null, availability: "unknown", title: null } });
      }
      const before = url.searchParams.get("before") ?? "";
      let cursorTime = "", cursorKey = "";
      if (before) {
        const parts = before.split("|");
        if (parts.length !== 2 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(parts[0]!) || !/^[a-z]+:[A-Za-z0-9_-]{1,160}$/u.test(parts[1]!)) return response({ error: "invalid_cursor" }, 400);
        [cursorTime, cursorKey] = parts as [string,string];
      }
      const page = await db.prepare(`SELECT ${columns} FROM user_saved_references WHERE user_id = ? AND is_saved = 1
        AND (? = '' OR updated_at < ? OR (updated_at = ? AND target_key > ?)) ORDER BY updated_at DESC, target_key ASC LIMIT 21`)
        .bind(session.userId, cursorTime, cursorTime, cursorTime, cursorKey).all<Row>();
      const visible = page.results.slice(0,20), items: SavedReference[] = [];
      // Bound source reads and preserve order. Public eligibility is rechecked, never cached as rights.
      for (let i = 0; i < visible.length; i += 4) items.push(...await Promise.all(visible.slice(i,i+4).map(present)));
      const last = visible.at(-1);
      return response({ items, nextCursor: page.results.length > 20 && last ? `${last.updated_at}|${last.target_key}` : null,
        continuity: "not_linked", partial: items.some(x=>x.availability === "unknown") });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "json_required" }, 415);
    if (Number(request.headers.get("content-length") ?? "0") > 12000) return response({ error: "request_too_large" }, 413);
    const reader = request.body?.getReader(); let raw = "", bytes = 0;
    if (reader) { const decoder = new TextDecoder(); try {
      for (;;) { const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength; if (bytes > 12000) return response({ error: "request_too_large" }, 413);
        raw += decoder.decode(part.value, { stream: true });
      } raw += decoder.decode();
    } finally { await reader.cancel(); } }
    let body: unknown; try { body = JSON.parse(raw); } catch { return response({ error: "invalid_json" }, 400); }
    if (!object(body)) return response({ error: "invalid_request" }, 400);
    if (url.pathname.endsWith("/export")) {
      if (Object.keys(body).some(k=>k!=="targets") || !Array.isArray(body.targets) || body.targets.length < 1 || body.targets.length > 20) return response({ error: "selection_required" }, 400);
      const items: SavedReference[] = [];
      for (const path of body.targets) {
        const target = parseSavedTarget(path); const row = await find(target.key);
        if (!row || row.is_saved !== 1) return response({ error: "selection_changed" }, 409);
        const item = await present(row);
        if (item.availability !== "available") return response({ error: "source_not_available" }, 409);
        items.push(item);
      }
      const bundle = await savedSnapshotBundle(items);
      const result = response(bundle); result.headers.set("content-disposition", 'attachment; filename="zukan-saved-selection.json"'); return result;
    }
    if (Object.keys(body).some(k=>!["targetPath","saved","expectedRevision","mutationId"].includes(k))
      || typeof body.saved !== "boolean" || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0
      || typeof body.mutationId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/u.test(body.mutationId)) return response({ error: "invalid_request" }, 400);
    const target = parseSavedTarget(body.targetPath), prior = await find(target.key);
    const expected = Number(body.expectedRevision), desired = body.saved ? 1 : 0;
    if (prior && prior.last_mutation_id === body.mutationId && prior.revision === expected + 1 && prior.is_saved === desired) {
      return response({ item: await present(prior), replayed: true, continuity: "not_linked" });
    }
    if ((prior?.revision ?? 0) !== expected) return response({ error: "revision_conflict" }, 409);
    if (body.saved) {
      const source = await resolveSource(target).catch(() => ({ availability: "unknown" as const, title: null }));
      if (source.availability !== "available") return response({ error: "source_not_available" }, source.availability === "unknown" ? 503 : 404);
    }
    if (!prior && !body.saved) return response({ item: { ...target, saved:false,revision:0,updatedAt:null,availability:"unknown",title:null }, continuity:"not_linked" });
    const now = new Date().toISOString();
    const statement = prior
      ? db.prepare(`UPDATE user_saved_references SET is_saved = ?, revision = revision + 1, last_mutation_id = ?, updated_at = ?
        WHERE user_id = ? AND target_key = ? AND revision = ?`).bind(desired, body.mutationId, now, session.userId, target.key, expected)
      : db.prepare(`INSERT INTO user_saved_references (user_id,target_key,target_type,target_id,target_path,is_saved,revision,last_mutation_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,1,?,?,?) ON CONFLICT(user_id,target_key) DO NOTHING`).bind(session.userId,target.key,target.type,target.id,target.path,desired,body.mutationId,now,now);
    await statement.run();
    const current = await find(target.key);
    if (!current) return response({ error: "readback_unavailable" }, 503);
    if (current.revision !== expected + 1 || current.last_mutation_id !== body.mutationId || current.is_saved !== desired) return response({ error: "revision_conflict" }, 409);
    return response({ item: await present(current), continuity: "not_linked" });
  } catch (error) {
    if (error instanceof TypeError) return response({ error: "invalid_request" }, 400);
    // Missing schema/provider outage is not an empty personal library or successful save.
    return response({ error: "saved_references_unavailable", retryable: true }, 503);
  }
}
