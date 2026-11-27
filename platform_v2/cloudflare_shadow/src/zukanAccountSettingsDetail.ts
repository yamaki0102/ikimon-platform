import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader, renderSubpageRow } from "./zukanSubpageUi";

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`;
}

async function loadLoginMethods(coreDb: Env["CORE_DB"] | null | undefined, userId: string): Promise<{ email: string; password: boolean; google: boolean } | null> {
  if (!coreDb) return null;
  try {
    const u = await coreDb
      .prepare(`SELECT email, password_hash FROM auth_users WHERE user_id = ?`)
      .bind(userId)
      .first<{ email: string | null; password_hash: string | null }>();
    const g = await coreDb
      .prepare(`SELECT 1 AS x FROM oauth_accounts WHERE user_id = ? AND provider = 'google' LIMIT 1`)
      .bind(userId)
      .first<{ x: number }>()
      .catch(() => null);
    return { email: u?.email ?? "", password: Boolean(u?.password_hash), google: Boolean(g) };
  } catch {
    return null;
  }
}

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
  db: Env["OBS_DB"],
  coreDb?: Env["CORE_DB"] | null
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

  if (coreDb && section === "profile" && typeof payload?.displayName === "string" && displayName) {
    await coreDb.batch([
      coreDb.prepare("UPDATE auth_users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(displayName, session.userId),
      coreDb.prepare("UPDATE auth_sessions SET display_name = ? WHERE user_id = ?").bind(displayName, session.userId),
      coreDb.prepare("UPDATE user_profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(displayName, session.userId),
    ]);
  }

  return json({ ok: true, section, saved: true });
}

export async function handleAccountSettingsDetailRoute(
  section: SettingsDetailSection,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"],
  coreDb?: Env["CORE_DB"] | null
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
      { key: "edit", label: "プロフィール" },
      { key: "notifications", label: "通知" },
      { key: "account", label: "アカウント" },
    ] as const
  )
    .map((t) => {
      const active = t.key === section;
      return `<a class="zt-as-tab${active ? " is-active" : ""}" href="/${lang}/profile/settings/${t.key}"${active ? ' aria-current="page"' : ""}>${t.label}</a>`;
    })
    .join("");

  const isEn = lang !== "ja";
  const initial = (displayName.trim() || "自分").slice(0, 1);
  const chevron = '<svg class="zt-sp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const linkRow = (href: string, title: string, meta: string) =>
    `<li><a class="zt-sp-row" href="${escapeHtml(href)}"><span class="zt-sp-body"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></span>${chevron}</a></li>`;

  let panelHtml = "";
  let heading = "プロフィール";
  if (section === "edit") {
    panelHtml = `<form class="zt-sp" data-settings-form="profile" style="gap:20px">
      <div style="display:flex;align-items:center;gap:16px"><span class="zt-sp-avatar" data-avatar-preview="1" aria-hidden="true">${escapeHtml(initial)}</span><button type="button" class="zt-sp-avatar-pick" data-avatar-pick="1">${isEn ? "Change icon" : "アイコンを変える"}</button><input type="file" accept="image/*" data-avatar-input="1" hidden /><span class="zt-sp-lead" data-avatar-status role="status" aria-live="polite"></span></div>
      <label class="zt-sp-field">
        <span>フィールドネーム</span>
        <input class="zt-sp-input" type="text" name="displayName" maxlength="80" value="${escapeHtml(displayName)}" />
        <small class="zt-sp-lead">ほかの人に見えるのは、この名前だけです。本名は登録しません。</small>
      </label>
      <label class="zt-sp-field">
        <span>自己紹介</span>
        <textarea class="zt-sp-input" name="bio" rows="4" maxlength="400">${escapeHtml(bio)}</textarea>
      </label>
      <ul class="zt-sp-list">${linkRow(`/${lang}/profile/public-settings`, "公開の範囲", "ほかの人に何が見えるかを決めます")}</ul>
      <button class="zt-sp-primary" type="submit">保存する</button>
      <p class="zt-sp-lead" data-settings-status role="status" aria-live="polite"></p>
    </form>`;
  } else if (section === "notifications") {
    heading = "通知";
    panelHtml = `<form class="zt-sp" data-settings-form="notifications" style="gap:12px">
      <label class="zt-sp-toggle">
        <span><strong>コメントや同定のお知らせ</strong><small>自分の記録に届いたら知らせます</small></span>
        <input type="checkbox" name="notifyComments"${notifyComments ? " checked" : ""} />
      </label>
      <label class="zt-sp-toggle">
        <span><strong>参加中の観察会のお知らせ</strong><small>前日と当日にお知らせします</small></span>
        <input type="checkbox" name="notifyEvents"${notifyEvents ? " checked" : ""} />
      </label>
      <button class="zt-sp-primary" type="submit">通知設定を保存</button>
      <p class="zt-sp-lead" data-settings-status role="status" aria-live="polite"></p>
    </form>`;
  } else {
    heading = "アカウント";
    const login = await loadLoginMethods(coreDb, session.userId);
    const methods = login ? [login.password ? "パスワード" : "", login.google ? "Google" : ""].filter(Boolean).join("・") : "";
    const infoRow = (label: string, value: string, attr: string) =>
      `<li><div class="zt-sp-row" ${attr}><span class="zt-sp-body"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(value)}</small></span></div></li>`;
    const emailMasked = login?.email ? maskEmail(login.email) : "";
    const accountRows = [
      emailMasked ? infoRow("メールアドレス", emailMasked, 'data-account-email="1"') : "",
      methods ? infoRow("ログイン方法", methods, 'data-account-login-methods="1"') : "",
    ].join("");
    panelHtml = `${accountRows ? `<ul class="zt-sp-list" data-account-info="1">${accountRows}</ul>` : ""}<ul class="zt-sp-list">
      ${linkRow(`/${lang}/profile/public-settings`, "公開範囲の設定", "プロフィールを公開するかどうか")}
      ${linkRow(`/${lang}/profile/linked-saved`, "つないだ先・保存したもの", "保存した場所やイベント")}
      ${linkRow(`/${lang}/profile/settings`, "表示言語・退会", "言語の切り替えと退会の確認")}
    </ul>
    <h2 class="zt-sp-title" style="font-size:1.125rem;margin:20px 0 0">そのほか</h2>
    <ul class="zt-sp-list">
      ${linkRow(`/${lang}/terms`, "利用規約", "ご利用にあたってのお約束")}
      ${linkRow(`/${lang}/privacy`, "プライバシーポリシー", "写真や位置の扱い")}
      ${linkRow(`/${lang}/profile/settings`, "退会する", "記録とアカウントを消します")}
    </ul>`;
  }

  const settingsScript = `<script>(()=>{document.querySelectorAll("[data-settings-form]").forEach((form)=>{form.addEventListener("submit",async(e)=>{e.preventDefault();const kind=form.getAttribute("data-settings-form");const status=form.querySelector("[data-settings-status]");const button=form.querySelector("button[type=submit]");const body=kind==="notifications"?{section:"notifications",notifyComments:form.elements.notifyComments.checked,notifyEvents:form.elements.notifyEvents.checked}:{section:"profile",displayName:form.elements.displayName.value,bio:form.elements.bio.value};if(button)button.disabled=true;try{const res=await fetch("/api/v1/profile/settings-detail",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});if(!res.ok)throw new Error("failed");if(status)status.textContent="保存しました。";}catch{if(status)status.textContent="保存できませんでした。もう一度試してください。";}finally{if(button)button.disabled=false;}});});})();</script>`;

  const avatarScript = section === "edit" ? `<script>(()=>{const pick=document.querySelector("[data-avatar-pick]");const input=document.querySelector("[data-avatar-input]");const status=document.querySelector("[data-avatar-status]");if(!pick||!input)return;const say=(m)=>{if(status)status.textContent=m;};pick.addEventListener("click",()=>input.click());input.addEventListener("change",()=>{const file=input.files&&input.files[0];if(!file)return;if(file.type.indexOf("image/")!==0){say(${JSON.stringify(isEn ? "Please choose an image." : "画像を選んでください。")});return;}if(file.size>5*1024*1024){say(${JSON.stringify(isEn ? "Choose an image under 5 MB." : "アイコンは5MB以下の画像にしてください。")});return;}const url=URL.createObjectURL(file);const img=new Image();img.onload=async()=>{try{const side=Math.min(img.naturalWidth,img.naturalHeight);const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d");ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);const dataUrl=canvas.toDataURL("image/png");const res=await fetch("/api/v1/profile/avatar",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({avatar:{mimeType:"image/png",base64Data:dataUrl.split(",")[1]}})});if(!res.ok)throw new Error("failed");const preview=document.querySelector("[data-avatar-preview]");if(preview){preview.style.backgroundImage="url("+dataUrl+")";preview.style.backgroundSize="cover";preview.style.backgroundPosition="center";preview.style.color="transparent";}say(${JSON.stringify(isEn ? "Icon updated." : "アイコンを変えました。")});}catch{say(${JSON.stringify(isEn ? "Could not update the icon." : "アイコンを変えられませんでした。")});}finally{URL.revokeObjectURL(url);input.value="";}};img.onerror=()=>{say(${JSON.stringify(isEn ? "Could not read the image." : "画像を読み込めませんでした。")});URL.revokeObjectURL(url);};img.src=url;});})();</script>` : "";

  const body = `<style>${ZUKAN_SUBPAGE_CSS}
    .zt-as-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;scrollbar-width:none}
    .zt-as-tab,.zt-as-tab:visited{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #dde2dc;background:#fff;color:#17251b;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
    .zt-as-tab.is-active,.zt-as-tab.is-active:visited{background:#143F2E;border-color:#143F2E;color:#fff}
    .zt-sp-avatar-pick{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #143F2E;background:#fff;color:#143F2E;font:inherit;font-weight:700;white-space:nowrap;cursor:pointer}
    .zt-sp-avatar{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#143F2E;color:#fff;font-size:1.75rem;font-weight:700}
    .zt-sp-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px;padding:14px 0;border-bottom:1px solid #dde2dc}
    .zt-sp-toggle span{display:grid;gap:2px}.zt-sp-toggle small{color:#55615a}
    .zt-sp-toggle input{width:28px;height:28px;accent-color:#143F2E;flex:none}
  </style>
  <section class="zt-sp" data-profile-view="i8-i9-i11" data-settings-section="${section}">
    ${renderSubpageHeader({ title: heading, backHref: `/${lang}/profile`, backLabel: "自分に戻る" })}
    <nav class="zt-as-tabs" aria-label="設定メニュー">${navTabs}</nav>
    ${panelHtml}
  </section>${settingsScript}${avatarScript}`;

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
