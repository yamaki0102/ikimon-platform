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

export function renderObservationCommentsHtml(options: {
  observationId: string;
  lang: "ja" | "en" | "es" | "pt-br";
  prefix: string;
  authenticated: boolean;
  comments: ObservationCommentEntry[];
}): string {
  const isEn = options.lang === "en";
  const listHtml =
    options.comments.length > 0
      ? options.comments
          .map(
            (c) =>
              `<li class="zt-comment-item"><strong>${escapeHtml(c.authorName)}</strong><p>${escapeHtml(c.body)}</p></li>`
          )
          .join("")
      : `<li class="zt-comment-empty">${isEn ? "No comments yet." : "コメントはまだありません。"}</li>`;

  const actionHtml = options.authenticated
    ? `<form id="obs-comment-form" class="zt-comment-form" data-observation-id="${escapeHtml(options.observationId)}">
        <textarea name="body" rows="2" maxlength="500" placeholder="${isEn ? "Write a comment" : "コメントを書く"}" aria-label="${isEn ? "Comment" : "コメント"}"></textarea>
        <button type="submit" class="zt-comment-submit">${isEn ? "Post comment" : "コメントを送る"}</button>
      </form>`
    : `<p class="zt-comment-login"><a href="${escapeHtml(`${options.prefix}/login`)}">${isEn ? "Sign in to comment" : "ログインしてコメントする"}</a></p>`;

  return `<section class="zt-comments-card" data-detail-comments="d5">
    <style>
      .zt-comments-card{margin:16px 0;padding:14px;border:1px solid #dce3dd;border-radius:12px;background:#fff;display:grid;gap:10px;min-width:0}
      .zt-comments-card h3{margin:0;font-size:15px;font-weight:900}
      .zt-comment-list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
      .zt-comment-item{padding:10px;border-radius:8px;background:#f6f7f6;display:grid;gap:4px}
      .zt-comment-item p{margin:0;overflow-wrap:anywhere}
      .zt-comment-form{display:grid;gap:8px}
      .zt-comment-form textarea{width:100%;min-height:44px;padding:8px 10px;border:1px solid #dce3dd;border-radius:8px;font:inherit}
      .zt-comment-submit{min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid #245c3a;background:#245c3a;color:#fff;font:inherit;font-weight:800;cursor:pointer}
      .zt-comment-login a,.zt-comment-login a:visited{display:inline-flex;align-items:center;min-height:44px;color:#245c3a;font-weight:800}
      @media (prefers-reduced-motion:reduce){.zt-comments-card,.zt-comments-card *{transition:none!important;animation:none!important}}
    </style>
    <h3>${escapeHtml(isEn ? "Comments" : "コメント")}</h3>
    <ul id="obs-comment-list" class="zt-comment-list">${listHtml}</ul>
    ${actionHtml}
  </section>`;
}

export async function handlePostObservationComment(
  observationId: string,
  request: Request,
  session: SessionLike,
  env: EnvLike
): Promise<Response> {
  if (!session || session.banned) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const payload = await request.json().catch(() => null) as { body?: unknown } | null;
  const body = typeof payload?.body === "string" ? payload.body.trim().slice(0, 500) : "";
  if (!body) {
    return jsonResponse({ ok: false, error: "invalid_comment_body" }, 400);
  }

  const obs = await env.OBS_DB
    .prepare("SELECT observation_id, user_id, visibility FROM observations WHERE observation_id = ?")
    .bind(observationId)
    .first<{ observation_id: string; user_id: string; visibility: string }>();

  if (!obs) {
    return jsonResponse({ ok: false, error: "observation_not_found" }, 404);
  }
  if (obs.visibility !== "public" && obs.user_id !== session.userId) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  const existing = await loadObservationComments(observationId, env);
  const comment: ObservationCommentEntry = {
    commentId: `cmt_${crypto.randomUUID()}`,
    observationId,
    authorUserId: session.userId,
    authorName: (session.displayName ?? "").trim() || "参加者",
    body,
    createdAt: new Date().toISOString(),
  };
  const comments = [...existing, comment];

  if (env.ASSET_BUCKET) {
    await env.ASSET_BUCKET.put(commentsKey(observationId), JSON.stringify(comments), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
  }

  return jsonResponse({ ok: true, comment, comments }, 201);
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

  const comments = await loadObservationComments(observationId, env);
  return jsonResponse({ ok: true, comments }, 200);
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
