import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader, renderSubpageRow } from "./zukanSubpageUi";

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
  path?: string | null;
};

async function queryLinkedAndSaved(userId: string, db: Env["OBS_DB"], savedDb: Env["OBS_DB"] = db) {
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
    savedDb
      .prepare(
        `SELECT object_id AS save_id, object_kind AS item_type, object_id AS item_id, display_title AS title, saved_at AS created_at, canonical_path AS path
           FROM user_saved_items
          WHERE user_id = ? AND state = 'saved'
          ORDER BY saved_at DESC
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
      path: s.path ?? null,
    })),
  };
}

export async function handleLinkedAndSavedApi(
  session: SessionLike,
  db: Env["OBS_DB"],
  savedDb: Env["OBS_DB"] = db
): Promise<Response> {
  if (!session?.userId) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const data = await queryLinkedAndSaved(session.userId, db, savedDb);
  return json({ ok: true, ...data });
}

export async function handleLinkedAndSavedRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"],
  savedDb: Env["OBS_DB"] = db
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
  const data = await queryLinkedAndSaved(session.userId, db, savedDb);

  const kindLabel: Record<string, string> = { place: "場所", event: "イベント", record: "記録" };
  const linkedRows = data.linked
    .map((l) =>
      renderSubpageRow({
        href: `/${lang}/places/${encodeURIComponent(l.targetId)}`,
        title: l.targetTitle,
        meta: `${l.targetType === "event" ? "観察会" : "場所の図鑑"} ・ ${l.createdAt.slice(0, 10)}`,
      })
    )
    .join("");
  const savedRows = data.saved
    .map((s) => {
      const path = s.path && s.path.startsWith("/") && !s.path.startsWith("//") ? s.path : `/places/${encodeURIComponent(s.itemId)}`;
      return renderSubpageRow({
        href: `/${lang}${path}`,
        title: s.title,
        meta: `${kindLabel[s.itemType] ?? s.itemType} ・ ${s.createdAt.slice(0, 10)}`,
      });
    })
    .join("");
  const shownRows = tab === "linked" ? linkedRows : savedRows;

  const body = `<style>${ZUKAN_SUBPAGE_CSS}
    .zt-ls-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;scrollbar-width:none}
    .zt-ls-tab,.zt-ls-tab:visited{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #dde2dc;background:#fff;color:#17251b;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
    .zt-ls-tab.is-active,.zt-ls-tab.is-active:visited{background:#143F2E;border-color:#143F2E;color:#fff}
  </style>
  <section class="zt-sp" data-profile-view="i4-i5" data-tab="${tab}">
    ${renderSubpageHeader({ title: "保存した場所・イベント", backHref: `/${lang}/profile`, backLabel: "自分に戻る" })}
    <nav class="zt-ls-tabs" aria-label="表示切り替え">
      <a class="zt-ls-tab${tab === "linked" ? " is-active" : ""}" href="/${lang}/profile/linked-saved?tab=linked"${tab === "linked" ? ' aria-current="page"' : ""}>つないだ先 (${data.linked.length})</a>
      <a class="zt-ls-tab${tab === "saved" ? " is-active" : ""}" href="/${lang}/profile/linked-saved?tab=saved"${tab === "saved" ? ' aria-current="page"' : ""}>保存したもの (${data.saved.length})</a>
    </nav>
    ${shownRows ? `<ul class="zt-sp-list">${shownRows}</ul>` : `<p class="zt-sp-empty">${tab === "linked" ? "つないだ先はまだありません。" : "保存したものはまだありません。場所のページの保存ボタンから残せます。"}</p>`}
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
