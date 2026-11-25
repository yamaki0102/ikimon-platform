import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type LinkedRow = {
  link_id: string;
  target_type: string;
  target_id: string;
  target_title: string;
  created_at: string;
};

type SavedRow = {
  save_id: string;
  item_type: string;
  item_id: string;
  title: string;
  created_at: string;
};

async function queryLinkedAndSaved(userId: string, db: Env["OBS_DB"]) {
  const [linked, saved] = await Promise.all([
    db
      .prepare(
        `SELECT link_id, target_type, target_id, target_title, created_at
           FROM observation_links
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50`
      )
      .bind(userId)
      .all<LinkedRow>()
      .then((r) => r.results)
      .catch(() => [] as LinkedRow[]),
    db
      .prepare(
        `SELECT save_id, item_type, item_id, title, created_at
           FROM user_saved_items
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 50`
      )
      .bind(userId)
      .all<SavedRow>()
      .then((r) => r.results)
      .catch(() => [] as SavedRow[]),
  ]);

  return {
    linked: linked.map((l) => ({
      linkId: l.link_id,
      targetType: l.target_type,
      targetId: l.target_id,
      targetTitle: l.target_title,
      createdAt: l.created_at,
    })),
    saved: saved.map((s) => ({
      saveId: s.save_id,
      itemType: s.item_type,
      itemId: s.item_id,
      title: s.title,
      createdAt: s.created_at,
    })),
  };
}

export async function handleLinkedAndSavedApi(
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const data = await queryLinkedAndSaved(session.userId, db);
  return json({ ok: true, ...data });
}

export async function handleLinkedAndSavedRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    const html = renderZukanCommonShell({
      title: "つないだ先と保存 | ikimon",
      lang,
      activeNav: "profile",
      authenticated: false,
      bodyHtml: `<section class="zt-hub-card" data-profile-view="i4-i5" data-linked-saved-auth-required="1">
        <h1>つないだ先と保存したもの</h1>
        <p>確認するにはログインしてください。</p>
        <a class="zt-btn-capture" href="/${lang}/login">ログイン</a>
      </section>`,
    });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const tab = url.searchParams.get("tab") === "saved" ? "saved" : "linked";
  const data = await queryLinkedAndSaved(session.userId, db);

  const linkedCards = data.linked
    .map(
      (l) => `<a class="zt-ls-card" href="/${lang}/places/${encodeURIComponent(l.targetId)}">
        <span class="zt-ls-badge">${escapeHtml(l.targetType === "event" ? "観察会" : "場所の図鑑")}</span>
        <strong>${escapeHtml(l.targetTitle)}</strong>
        <span class="zt-ls-date">${escapeHtml(l.createdAt.slice(0, 10))}</span>
      </a>`
    )
    .join("");

  const savedCards = data.saved
    .map(
      (s) => `<a class="zt-ls-card" href="/${lang}/places/${encodeURIComponent(s.itemId)}">
        <span class="zt-ls-badge">${escapeHtml(s.itemType)}</span>
        <strong>${escapeHtml(s.title)}</strong>
        <span class="zt-ls-date">${escapeHtml(s.createdAt.slice(0, 10))}</span>
      </a>`
    )
    .join("");

  const body = `<style>
    .zt-ls-wrap{display:grid;gap:14px;padding:16px 0}
    .zt-ls-tabs{display:flex;flex-wrap:wrap;gap:8px}
    .zt-ls-tab,.zt-ls-tab:visited{min-height:40px;padding:6px 16px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-size:14px;font-weight:700;display:inline-flex;align-items:center}
    .zt-ls-tab.is-active,.zt-ls-tab.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-ls-list{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))}
    .zt-ls-card,.zt-ls-card:visited{display:grid;gap:6px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none}
    .zt-ls-badge{width:fit-content;padding:2px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);color:var(--green);font-size:12px;font-weight:700}
    .zt-ls-date{font-size:12px;color:var(--muted)}
  </style>
  <section class="zt-ls-wrap" data-profile-view="i4-i5" data-tab="${tab}">
    <h1>つないだ先と保存したもの</h1>
    <nav class="zt-ls-tabs" aria-label="表示切り替え">
      <a class="zt-ls-tab${tab === "linked" ? " is-active" : ""}" href="/${lang}/profile/linked-saved?tab=linked"${tab === "linked" ? ' aria-current="page"' : ""}>つないだ先 (${data.linked.length})</a>
      <a class="zt-ls-tab${tab === "saved" ? " is-active" : ""}" href="/${lang}/profile/linked-saved?tab=saved"${tab === "saved" ? ' aria-current="page"' : ""}>保存したもの (${data.saved.length})</a>
    </nav>
    <div class="zt-ls-list">
      ${tab === "linked" ? linkedCards || "<p>つないだ先はまだありません。</p>" : savedCards || "<p>保存したものはまだありません。</p>"}
    </div>
  </section>`;

  const html = renderZukanCommonShell({
    title: "つないだ先と保存したもの | ikimon",
    lang,
    activeNav: "profile",
    authenticated: true,
    displayName: session.displayName ?? null,
    bodyHtml: body,
  });
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
