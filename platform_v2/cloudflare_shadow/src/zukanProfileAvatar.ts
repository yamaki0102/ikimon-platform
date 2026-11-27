import type { Env } from "./core/env";
import { json } from "./core/http";

type SessionLike = { userId: string; displayName?: string | null; banned?: boolean } | null;
type StoredAvatar = { objectKey: string; mime: string; bytes: number; sha256: string } | null;

export async function handleProfileAvatarUpload(
  request: Request,
  session: SessionLike,
  coreDb: Env["CORE_DB"],
  store: (userId: string, input: unknown) => Promise<StoredAvatar>
): Promise<Response> {
  if (!session?.userId) return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
  if (session.banned) return json({ ok: false, error: "account_unavailable" }, 403, { "cache-control": "no-store" });
  const input = (await request.json().catch(() => null)) as { avatar?: unknown } | null;
  const avatar = await store(session.userId, input?.avatar);
  if (!avatar) return json({ ok: false, error: "avatar_required" }, 400, { "cache-control": "no-store" });
  await coreDb
    .prepare(
      `INSERT INTO user_profiles (user_id, display_name, avatar_object_key, avatar_mime, avatar_bytes, avatar_sha256, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         avatar_object_key = excluded.avatar_object_key,
         avatar_mime = excluded.avatar_mime,
         avatar_bytes = excluded.avatar_bytes,
         avatar_sha256 = excluded.avatar_sha256,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(session.userId, session.displayName || session.userId, avatar.objectKey, avatar.mime, avatar.bytes, avatar.sha256)
    .run();
  return json({ ok: true, saved: true }, 200, { "cache-control": "no-store" });
}

export async function handleProfileAvatarGet(
  request: Request,
  session: SessionLike,
  coreDb: Env["CORE_DB"],
  bucket: Pick<R2Bucket, "get">
): Promise<Response> {
  const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!session?.userId || session.banned) return notFound();
  const row = await coreDb
    .prepare("SELECT avatar_object_key, avatar_sha256 FROM user_profiles WHERE user_id = ?")
    .bind(session.userId)
    .first<{ avatar_object_key: string | null; avatar_sha256: string | null }>()
    .catch(() => null);
  if (!row?.avatar_object_key) return notFound();
  const etag = `"${row.avatar_sha256 ?? row.avatar_object_key}"`;
  const headers = { "cache-control": "private, no-cache", etag, "x-content-type-options": "nosniff" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const object = await bucket.get(row.avatar_object_key);
  if (!object) return notFound();
  return new Response(object.body, { status: 200, headers: { ...headers, "content-type": "image/png" } });
}
