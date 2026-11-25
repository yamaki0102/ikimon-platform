import { containsDiscoveryPersonalInformation } from "./eventDiscoveryPrivacy";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type ObservationCommentEntry = {
  commentId: string;
  observationId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

type ShareLinkRecord = {
  token: string;
  observationId: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string | null;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type EnvLike = {
  OBS_DB: {
    prepare(sql: string): {
      bind(...values: unknown[]): {
        first<T = Record<string, unknown>>(): Promise<T | null>;
      };
    };
  };
  ASSET_BUCKET?: {
    get(key: string): Promise<{ body: ReadableStream | null } | null>;
    put(key: string, value: string, options?: unknown): Promise<unknown>;
  };
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function commentsKey(observationId: string): string {
  return `observation-comments/${encodeURIComponent(observationId)}.json`;
}

function shareLinkKey(token: string): string {
  return `observation-share-links/${encodeURIComponent(token)}.json`;
}

export async function loadObservationComments(
  observationId: string,
  env: Pick<EnvLike, "ASSET_BUCKET">
): Promise<ObservationCommentEntry[]> {
  if (!env.ASSET_BUCKET) return [];
  const obj = await env.ASSET_BUCKET.get(commentsKey(observationId)).catch(() => null);
  if (!obj || !obj.body) return [];
  const parsed = await new Response(obj.body).json().catch(() => null);
  return Array.isArray(parsed) ? (parsed as ObservationCommentEntry[]) : [];
}

export const OBSERVATION_COMMENTS_CLOSED_MESSAGE_JA = "自由なコメントの受付は終了しました。名前や場所のようすは「提案する」から伝えられます。";

export function renderObservationCommentsHtml(_options: {
  observationId: string;
  lang: "ja" | "en" | "es" | "pt-br";
  prefix: string;
  authenticated: boolean;
  comments: ObservationCommentEntry[];
}): string {
  return "";
}

export async function handlePostObservationComment(
  _observationId: string,
  _request: Request,
  session: SessionLike,
  _env: EnvLike
): Promise<Response> {
  if (!session || session.banned) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }
  return jsonResponse({ ok: false, error: "comments_closed", messageJa: OBSERVATION_COMMENTS_CLOSED_MESSAGE_JA }, 410);
}

export async function handleGetObservationComments(
  observationId: string,
  session: SessionLike,
  env: EnvLike
): Promise<Response> {
  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, user_id, visibility FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{ observation_id: string; user_id: string; visibility: string }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.visibility !== "public") {
    if (!session || session.banned) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }
    if (obs.user_id !== session.userId) {
      return jsonResponse({ ok: false, error: "forbidden" }, 403);
    }
  }

  return jsonResponse({ ok: true, comments: [], closed: true }, 200);
}

export async function handleCreateObservationShareLink(
  observationId: string,
  session: SessionLike,
  env: EnvLike,
  options?: { expiresInDays?: number | null }
): Promise<Response> {
  if (!session || session.banned) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, owner_user_id AS user_id, visibility FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{ observation_id: string; user_id: string; visibility: string }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.user_id !== session.userId) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  const token = `share_${crypto.randomUUID().replace(/-/g, "")}`;
  const days = options?.expiresInDays && options.expiresInDays > 0 ? Math.min(Math.trunc(options.expiresInDays), 365) : null;
  const record: ShareLinkRecord = {
    token,
    observationId,
    createdBy: session.userId,
    createdAt: new Date().toISOString(),
    expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
  };

  if (env.ASSET_BUCKET) {
    await env.ASSET_BUCKET.put(shareLinkKey(token), JSON.stringify(record), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return jsonResponse({ ok: true, token, path: `/ja/share/${token}`, expiresAt: record.expiresAt ?? null }, 201);
}

export async function handleResolveShareLinkPage(
  token: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  env: EnvLike
): Promise<Response> {
  if (!env.ASSET_BUCKET) {
    return new Response("Share unavailable", { status: 404 });
  }
  const obj = await env.ASSET_BUCKET.get(shareLinkKey(token)).catch(() => null);
  if (!obj || !obj.body) {
    return new Response("Not found", { status: 404 });
  }
  const share = await new Response(obj.body).json().catch(() => null) as ShareLinkRecord | null;
  if (!share?.observationId) {
    return new Response("Not found", { status: 404 });
  }
  if (share.expiresAt && Date.parse(share.expiresAt) <= Date.now()) {
    return new Response("Not found", { status: 404 });
  }

  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, visibility, note, observed_at FROM observations WHERE observation_id = ?")
    .bind(share.observationId)
    .first<{ observation_id: string; visibility: string; note: string | null; observed_at: string | null }>();

  if (!obs || obs.visibility !== "public") {
    return new Response("Not found", { status: 404 });
  }

  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const comments = await loadObservationComments(obs.observation_id, env);
  const authenticated = Boolean(session && !session.banned);
  const defaultNote = lang === "en" ? "Field observation" : "生きものの観察記録";
  const firstLine = (obs.note ?? "").split(/\r?\n/)[0]?.trim() ?? "";
  const safeNote =
    firstLine && !containsDiscoveryPersonalInformation(obs.note ?? "") && !containsDiscoveryPersonalInformation(firstLine)
      ? firstLine.slice(0, 24)
      : defaultNote;
  const bodyHtml = `<section class="zt-hub-card" data-share-guest-view="d8">
    <h1>${escapeHtml(lang === "en" ? "Shared observation" : "共有された記録")}</h1>
    <p>${escapeHtml(safeNote)}</p>
    <p><small>${escapeHtml(obs.observed_at ?? "—")}</small></p>
    <p><a class="zt-btn-outline" href="${escapeHtml(`${prefix}/observations/${encodeURIComponent(obs.observation_id)}`)}">${
      lang === "en" ? "Open record details" : "記録の詳細を見る"
    }</a></p>
    ${renderObservationCommentsHtml({
      observationId: obs.observation_id,
      lang,
      prefix,
      authenticated,
      comments,
    })}
  </section>`;

  const pageHtml = renderZukanCommonShell({
    lang,
    title: lang === "en" ? "Shared observation" : "共有された記録",
    activeNav: "library",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/share/${token}`,
  });

  return new Response(pageHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
