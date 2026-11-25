import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

export type SettingsDetailSection = "edit" | "notifications" | "account";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type SettingsRow = {
  display_name: string;
  bio: string;
  notify_comments: number;
  notify_events: number;
};

async function ensureTable(db: Env["OBS_DB"]) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_account_settings (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        notify_comments INTEGER NOT NULL DEFAULT 1,
        notify_events INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )`
    )
    .run()
    .catch(() => null);
}

export async function handleSaveAccountSettingsDetail(
  request: Request,
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const payload = (await request.json().catch(() => null)) as {
    section?: unknown;
    displayName?: unknown;
    bio?: unknown;
    notifyComments?: unknown;
    notifyEvents?: unknown;
  } | null;

  const section =
    payload?.section === "profile" || payload?.section === "notifications"
      ? payload.section
      : "profile";

  await ensureTable(db);
  const existing = await db
    .prepare(
      `SELECT display_name, bio, notify_comments, notify_events
         FROM user_account_settings
        WHERE user_id = ?`
    )
    .bind(session.userId)
    .first<SettingsRow>()
    .catch(() => null);

  const displayName =
    typeof payload?.displayName === "string"
      ? payload.displayName.trim().slice(0, 80)
      : existing?.display_name ?? session.displayName ?? "";
  const bio =
    typeof payload?.bio === "string"
      ? payload.bio.trim().slice(0, 400)
      : existing?.bio ?? "";
  const notifyComments =
    typeof payload?.notifyComments === "boolean"
      ? payload.notifyComments
        ? 1
        : 0
      : existing?.notify_comments ?? 1;
  const notifyEvents =
    typeof payload?.notifyEvents === "boolean"
      ? payload.notifyEvents
        ? 1
        : 0
      : existing?.notify_events ?? 1;

  await db
    .prepare(
      `INSERT INTO user_account_settings (user_id, display_name, bio, notify_comments, notify_events, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         bio = excluded.bio,
         notify_comments = excluded.notify_comments,
         notify_events = excluded.notify_events,
         updated_at = excluded.updated_at`
    )
    .bind(session.userId, displayName, bio, notifyComments, notifyEvents, new Date().toISOString())
    .run();

  return json({ ok: true, section, saved: true });
}

export async function handleAccountSettingsDetailRoute(
  section: SettingsDetailSection,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    const html = renderZukanCommonShell({
      title: "設定 | ikimon",
      lang,
      activeNav: "profile",
      authenticated: false,
      bodyHtml: `<section class="zt-hub-card" data-profile-view="i8-i9-i11" data-settings-section="${section}" data-account-settings-auth-required="1">
        <h1>アカウント設定</h1>
        <p>設定を変更するにはログインしてください。</p>
        <a class="zt-btn-capture" href="/${lang}/login">ログイン</a>
      </section>`,
    });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const row = await db
    .prepare(
      `SELECT display_name, bio, notify_comments, notify_events
         FROM user_account_settings
        WHERE user_id = ?`
    )
    .bind(session.userId)
    .first<SettingsRow>()
    .catch(() => null);

  const displayName = row?.display_name || session.displayName || "";
  const bio = row?.bio || "";
  const notifyComments = (row?.notify_comments ?? 1) === 1;
  const notifyEvents = (row?.notify_events ?? 1) === 1;

  const navTabs = (
    [
      { key: "edit", label: "プロフィール (I8)" },
      { key: "notifications", label: "通知 (I9)" },
      { key: "account", label: "連携とアカウント (I11)" },
    ] as const
  )
    .map((t) => {
      const active = t.key === section;
      return `<a class="zt-as-tab${active ? " is-active" : ""}" href="/${lang}/profile/settings/${t.key}"${active ? ' aria-current="page"' : ""}>${t.label}</a>`;
    })
    .join("");

  let panelHtml = "";
  if (section === "edit") {
    panelHtml = `<form class="zt-as-form" data-settings-form="profile">
      <label class="zt-as-field">
        <span>表示名</span>
        <input type="text" name="displayName" maxlength="80" value="${escapeHtml(displayName)}" />
      </label>
      <label class="zt-as-field">
        <span>自己紹介</span>
        <textarea name="bio" rows="4" maxlength="400">${escapeHtml(bio)}</textarea>
      </label>
      <button class="zt-btn-capture" type="submit">保存する</button>
    </form>`;
  } else if (section === "notifications") {
    panelHtml = `<form class="zt-as-form" data-settings-form="notifications">
      <label class="zt-as-toggle">
        <input type="checkbox" name="notifyComments"${notifyComments ? " checked" : ""} />
        <span>コメントや同定のお知らせを受け取る</span>
      </label>
      <label class="zt-as-toggle">
        <input type="checkbox" name="notifyEvents"${notifyEvents ? " checked" : ""} />
        <span>参加中の観察会のお知らせを受け取る</span>
      </label>
      <button class="zt-btn-capture" type="submit">通知設定を保存</button>
    </form>`;
  } else {
    panelHtml = `<div class="zt-as-account">
      <div class="zt-as-row">
        <strong>公開範囲の設定</strong>
        <a class="zt-btn-outline" href="/${lang}/profile/public-settings">変更する</a>
      </div>
      <div class="zt-as-row">
        <strong>表示言語・退会</strong>
        <a class="zt-btn-outline" href="/${lang}/profile/settings">開く</a>
      </div>
      <div class="zt-as-row">
        <strong>つないだ先・保存したもの</strong>
        <a class="zt-btn-outline" href="/${lang}/profile/linked-saved">確認する</a>
      </div>
    </div>`;
  }

  const body = `<style>
    .zt-as-wrap{display:grid;gap:14px;padding:16px 0}
    .zt-as-tabs{display:flex;flex-wrap:wrap;gap:8px}
    .zt-as-tab,.zt-as-tab:visited{min-height:40px;padding:6px 14px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-size:14px;font-weight:700;display:inline-flex;align-items:center}
    .zt-as-tab.is-active,.zt-as-tab.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-as-card{padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:14px}
    .zt-as-form,.zt-as-account{display:grid;gap:12px}
    .zt-as-field{display:grid;gap:6px;font-weight:700;font-size:14px}
    .zt-as-field input,.zt-as-field textarea{padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:16px;background:#fff;color:var(--ink)}
    .zt-as-toggle{display:flex;align-items:center;gap:10px;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-weight:700}
    .zt-as-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:10px;background:#fff}
  </style>
  <section class="zt-as-wrap" data-profile-view="i8-i9-i11" data-settings-section="${section}">
    <h1>設定</h1>
    <nav class="zt-as-tabs" aria-label="設定メニュー">${navTabs}</nav>
    <div class="zt-as-card">${panelHtml}</div>
  </section>`;

  const html = renderZukanCommonShell({
    title: "設定 | ikimon",
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
