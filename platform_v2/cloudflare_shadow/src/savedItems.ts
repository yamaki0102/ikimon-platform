/** Private, opt-in bookmarks. Public target identity never makes the saver public. */
export const SAVED_KINDS = ["record", "place", "event", "job", "offer", "article", "organization", "experience", "stay", "learning", "service"] as const;
export type SavedKind = typeof SAVED_KINDS[number];
export type SavedItem = {
  kind: SavedKind; objectId: string; path: string; title: string;
  state: "saved" | "removed"; revision: number; savedAt: string; updatedAt: string;
};
interface SavedStatement {
  bind(...values: unknown[]): SavedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface SavedDatabase { prepare(sql: string): SavedStatement; }
type Database = SavedDatabase;
type Session = { userId: string; banned: boolean };
type Row = { user_id: string; object_kind: SavedKind; object_id: string; canonical_path: string;
  display_title: string; state: "saved" | "removed"; revision: number; saved_at: string; updated_at: string;
  last_command_id: string; last_command_digest: string };
export class SavedItemError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
const fail = (code: string, status = 400): never => { throw new SavedItemError(code, status); };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const segments: Record<SavedKind, readonly string[]> = {
  record: ["observations", "records"], place: ["sites", "places"], event: ["events", "community/events"],
  job: ["jobs"], offer: ["offers"], article: ["articles", "read"], organization: ["organizations"],
  experience: ["experiences"], stay: ["stays"], learning: ["learning"], service: ["services"],
};
function cleanString(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) return fail(`saved_${name}_invalid`);
  return value.trim();
}
export function savedReference(value: unknown): Pick<SavedItem, "kind" | "objectId" | "path" | "title"> {
  if (!object(value) || Object.keys(value).some(k => !["kind", "objectId", "path", "title"].includes(k))) return fail("saved_reference_invalid");
  if (!(SAVED_KINDS as readonly unknown[]).includes(value.kind)) return fail("saved_kind_invalid");
  const kind = value.kind as SavedKind;
  const objectId = cleanString(value.objectId, "id", 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(objectId)) return fail("saved_id_invalid");
  const title = cleanString(value.title, "title", 240);
  const inputPath = cleanString(value.path, "path", 600);
  // Only existing product locators. No redirects, credentials, arbitrary hosts, queries or fragments.
  if (!inputPath.startsWith("/") || inputPath.startsWith("//") || /[\\?#%]/u.test(inputPath) || inputPath.includes("..")) return fail("saved_path_invalid");
  const path = inputPath.replace(/^\/(?:ja|en|es|pt-br)(?=\/)/u, "");
  const valid = segments[kind].some(prefix => {
    const start = `/${prefix}/`;
    if (!path.startsWith(start)) return false;
    const tail = path.slice(start.length);
    return /^[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(tail) && (tail === objectId || tail.endsWith(`-${objectId}`));
  });
  if (!valid) return fail("saved_path_invalid");
  return {kind, objectId, path, title};
}
function publicItem(row: Row): SavedItem {
  return {kind: row.object_kind, objectId: row.object_id, path: row.canonical_path,
    title: row.display_title, state: row.state, revision: Number(row.revision), savedAt: row.saved_at, updatedAt: row.updated_at};
}
const SQL_SELECT = `SELECT * FROM user_saved_items WHERE user_id = ? AND object_kind = ? AND object_id = ?`;
export async function listSavedItems(database: Database, userId: string, options: {limit?: number; cursor?: string; includeRemoved?: boolean} = {}) {
  const limit = options.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return fail("saved_limit_invalid");
  let cursor: [string, string, string] | null = null;
  if (options.cursor !== undefined) {
    try {
      if (options.cursor.length > 1000) return fail("saved_cursor_invalid");
      const parsed: unknown = JSON.parse(atob(options.cursor));
      if (!Array.isArray(parsed) || parsed.length !== 3 || parsed.some(x => typeof x !== "string" || x.length > 180)
        || !/^\d{4}-\d\d-\d\dT/u.test(parsed[0])) return fail("saved_cursor_invalid");
      cursor = parsed as [string,string,string];
    } catch { return fail("saved_cursor_invalid"); }
  }
  let sql = `SELECT * FROM user_saved_items WHERE user_id = ?`;
  const params: unknown[] = [userId];
  if (!options.includeRemoved) sql += ` AND state = 'saved'`;
  if (cursor) {
    sql += ` AND (updated_at < ? OR (updated_at = ? AND (object_kind > ? OR (object_kind = ? AND object_id > ?))))`;
    params.push(cursor[0], cursor[0], cursor[1], cursor[1], cursor[2]);
  }
  sql += ` ORDER BY updated_at DESC, object_kind ASC, object_id ASC LIMIT ?`; params.push(limit + 1);
  const result = await database.prepare(sql).bind(...params).all<Row>();
  const rows = result.results.slice(0,limit); const last = rows.at(-1);
  return {items: rows.map(publicItem), nextCursor: result.results.length > limit && last
    ? btoa(JSON.stringify([last.updated_at,last.object_kind,last.object_id])) : null};
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}
export async function changeSavedItem(database: Database, userId: string, input: unknown, at = new Date().toISOString()) {
  if (!object(input) || Object.keys(input).some(k => !["reference", "state", "expectedRevision", "commandId"].includes(k))) return fail("saved_command_invalid");
  const reference = savedReference(input.reference);
  if (input.state !== "saved" && input.state !== "removed") return fail("saved_state_invalid");
  if (!Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0) return fail("saved_revision_invalid");
  const commandId = cleanString(input.commandId, "command", 120);
  if (!/^[A-Za-z0-9_-]{12,120}$/u.test(commandId)) return fail("saved_command_invalid");
  if (!Number.isFinite(Date.parse(at))) return fail("saved_time_invalid");
  const fingerprint = await digest(JSON.stringify([reference,input.state,input.expectedRevision]));
  const key = [userId,reference.kind,reference.objectId];
  const before = await database.prepare(SQL_SELECT).bind(...key).first<Row>();
  if (before?.last_command_id === commandId) {
    if (before.last_command_digest !== fingerprint) return fail("saved_command_conflict",409);
    return {item:publicItem(before), replay:true};
  }
  if ((before?.revision ?? 0) !== input.expectedRevision) return fail("saved_revision_conflict",409);
  if (input.state === "removed" && !before) return fail("saved_not_found",404);
  // Desired-state mutation, never a toggle; retries cannot reverse an action.
  const nextRevision = Number(input.expectedRevision) + 1;
  const sql = `INSERT INTO user_saved_items
    (user_id,object_kind,object_id,canonical_path,display_title,state,revision,last_command_id,last_command_digest,saved_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ? = 0 OR EXISTS
      (SELECT 1 FROM user_saved_items WHERE user_id=? AND object_kind=? AND object_id=? AND revision=?)
    ON CONFLICT(user_id,object_kind,object_id) DO UPDATE SET
      canonical_path=excluded.canonical_path,display_title=excluded.display_title,state=excluded.state,
      revision=excluded.revision,last_command_id=excluded.last_command_id,last_command_digest=excluded.last_command_digest,
      saved_at=excluded.saved_at,updated_at=excluded.updated_at
    WHERE user_saved_items.revision = ?`;
  const savedAt = input.state === "saved" && before?.state !== "saved" ? at : before?.saved_at ?? at;
  await database.prepare(sql).bind(...key,reference.path,reference.title,input.state,nextRevision,commandId,fingerprint,savedAt,at,
    input.expectedRevision,...key,input.expectedRevision,input.expectedRevision).run();
  const after = await database.prepare(SQL_SELECT).bind(...key).first<Row>();
  if (!after || after.last_command_id !== commandId || after.last_command_digest !== fingerprint) return fail("saved_revision_conflict",409);
  return {item:publicItem(after),replay:false};
}
export function savedItemsJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {status,headers:{"content-type":"application/json; charset=utf-8",
    "cache-control":"private, no-store", "vary":"Cookie", "x-content-type-options":"nosniff"}});
}
export async function handleSavedItemsRequest(request: Request, database: Database, session: Session | null): Promise<Response> {
  if (!session || session.banned) return savedItemsJson({error:"session_required"},401);
  const url = new URL(request.url);
  try {
    if (request.method === "GET") {
      const singleId = url.searchParams.get("objectId"); const singleKind = url.searchParams.get("kind");
      if (singleId !== null || singleKind !== null) {
        if (!singleId || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u.test(singleId) || !(SAVED_KINDS as readonly string[]).includes(singleKind ?? "")) return fail("saved_reference_invalid");
        const row = await database.prepare(SQL_SELECT).bind(session.userId,singleKind,singleId).first<Row>();
        return savedItemsJson({item:row ? publicItem(row):null});
      }
      const page = await listSavedItems(database,session.userId,{limit:Number(url.searchParams.get("limit") ?? "20"),
        ...(url.searchParams.has("cursor") ? {cursor:url.searchParams.get("cursor")!}:{}),includeRemoved:url.searchParams.get("state") === "all"});
      return savedItemsJson({...page,nocosilConnection:"not_connected"});
    }
    if (request.method !== "POST") return savedItemsJson({error:"method_not_allowed"},405);
    // Cookie-authenticated writes require exact same-origin JSON, including in installed PWAs.
    if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return fail("saved_origin_denied",403);
    if (!/^application\/json(?:;|$)/iu.test(request.headers.get("content-type") ?? "")) return fail("saved_content_type_invalid",415);
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return fail("saved_payload_too_large",413);
    const reader = request.body?.getReader(); if (!reader) return fail("saved_command_invalid");
    const chunks: Uint8Array[] = []; let count=0;
    try {
      while (true) {const {done,value}=await reader.read(); if(done)break; count+=value.byteLength;
        if(count>4096){await reader.cancel();return fail("saved_payload_too_large",413);}chunks.push(value);}
    } finally {reader.releaseLock();}
    const data = new Uint8Array(count); let offset=0; for(const c of chunks){data.set(c,offset);offset+=c.length;}
    let input:unknown; try{input=JSON.parse(new TextDecoder().decode(data));}catch{return fail("saved_command_invalid");}
    return savedItemsJson(await changeSavedItem(database,session.userId,input));
  } catch(error) {
    if(error instanceof SavedItemError) return savedItemsJson({error:error.code},error.status);
    // Missing migration/storage outage never becomes an empty list or a successful save.
    return savedItemsJson({error:"saved_storage_unavailable"},503);
  }
}

/** Batch only the displayed records; this is not a user's whole activity history. */
export async function savedRecordStates(database: Database,userId: string,ids: string[]): Promise<Map<string,SavedItem>> {
 const result=new Map<string,SavedItem>(); const unique=[...new Set(ids)].slice(0,120);
 for(let i=0;i<unique.length;i+=40){const group=unique.slice(i,i+40);
  const rows=await database.prepare(`SELECT * FROM user_saved_items WHERE user_id=? AND object_kind='record' AND object_id IN (${group.map(()=>'?').join(',')})`).bind(userId,...group).all<Row>();
  for(const row of rows.results)result.set(row.object_id,publicItem(row));
 }
 return result;
}
