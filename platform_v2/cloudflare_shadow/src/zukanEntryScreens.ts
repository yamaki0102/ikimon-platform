import type { Env } from "./core/env";

type D1Db = Env["CORE_DB"];

const WAITLIST_CREATE_SQL =
  "CREATE TABLE IF NOT EXISTS zukan_waitlist (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, locale TEXT NOT NULL, source_path TEXT NOT NULL, created_at INTEGER NOT NULL)";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type ZukanEntryMode = "login" | "register" | "waitlist";

export function normalizeFieldName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}

export function isValidFieldName(name: string): boolean {
  return name.length >= 1 && name.length <= 32 && !/[\u0000-\u001f\u007f]/.test(name);
}

export async function checkFieldNameAvailability(
  db: D1Db,
  rawName: unknown
): Promise<{ ok: true; available: boolean; normalizedName: string } | { ok: false; available: false; error: "invalid_field_name" }> {
  const normalizedName = normalizeFieldName(rawName);
  if (!isValidFieldName(normalizedName)) {
    return { ok: false, available: false, error: "invalid_field_name" };
  }
  try {
    const existingUser = await db.prepare(
      "SELECT user_id FROM users WHERE LOWER(TRIM(COALESCE(display_name, ''))) = LOWER(?) LIMIT 1"
    ).bind(normalizedName).first<{ user_id: string }>();
    if (existingUser) {
      return { ok: true, available: false, normalizedName };
    }
  } catch {
    // Ignore if users.display_name column is absent in minimal fixtures
  }
  return { ok: true, available: true, normalizedName };
}

export async function getWaitlistStatusForEmail(
  db: D1Db,
  rawEmail: unknown
): Promise<{ ok: true; registered: boolean; status: "waiting" | "not_registered"; registeredAt: number | null } | { ok: false; error: "invalid_email" }> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "invalid_email" };
  }
  try {
    await db.prepare(WAITLIST_CREATE_SQL).run();
    const row = await db.prepare(
      "SELECT id, created_at FROM zukan_waitlist WHERE email = ? LIMIT 1"
    ).bind(email).first<{ id: string; created_at: number }>();
    if (!row) {
      return { ok: true, registered: false, status: "not_registered", registeredAt: null };
    }
    return { ok: true, registered: true, status: "waiting", registeredAt: Number(row.created_at) || null };
  } catch {
    return { ok: true, registered: false, status: "not_registered", registeredAt: null };
  }
}

export function renderZukanEntryScreen(options: {
  mode: ZukanEntryMode;
  lang?: "ja" | "en";
  redirect?: string;
}): string {
  const lang = options.lang === "en" ? "en" : "ja";
  const prefix = `/${lang}`;
  const titleMap: Record<ZukanEntryMode, string> = {
    login: lang === "en" ? "Sign in" : "ログイン",
    register: lang === "en" ? "Choose your field name" : "フィールドネームを決める登録",
    waitlist: lang === "en" ? "Waitlist status" : "順番待ち",
  };
  const bodyByMode: Record<ZukanEntryMode, string> = {
    login: `<form class="ze-form" method="post" action="/api/v1/auth/login" data-entry-login-form>
        <label><span>${lang === "en" ? "Email" : "メールアドレス"}</span><input type="email" name="email" required autocomplete="email"></label>
        <label><span>${lang === "en" ? "Password" : "パスワード"}</span><input type="password" name="password" required autocomplete="current-password"></label>
        <button type="submit">${lang === "en" ? "Sign in" : "ログインする"}</button>
      </form>
      <p class="ze-links"><a href="${prefix}/register">${lang === "en" ? "Create account" : "新規登録"}</a> · <a href="${prefix}/waitlist">${lang === "en" ? "Waitlist" : "順番待ち"}</a></p>`,
    register: `<form class="ze-form" method="post" action="/api/v1/auth/register" data-entry-register-form>
        <label><span>${lang === "en" ? "Field name (public nickname)" : "フィールドネーム（公開名・ニックネーム）"}</span>
          <input type="text" name="fieldName" required maxlength="32" autocomplete="nickname" data-field-name-input>
        </label>
        <p class="ze-status" data-field-name-status role="status" aria-live="polite"></p>
        <label><span>${lang === "en" ? "Email" : "メールアドレス"}</span><input type="email" name="email" required autocomplete="email"></label>
        <label><span>${lang === "en" ? "Password" : "パスワード"}</span><input type="password" name="password" required autocomplete="new-password"></label>
        <button type="submit">${lang === "en" ? "Register" : "このフィールドネームで登録"}</button>
      </form>
      <p class="ze-links"><a href="${prefix}/login">${lang === "en" ? "Sign in" : "すでにアカウントをお持ちの方"}</a> · <a href="${prefix}/waitlist">${lang === "en" ? "Waitlist" : "順番待ち"}</a></p>`,
    waitlist: `<form class="ze-form" method="post" action="/api/v1/waitlist" data-entry-waitlist-form>
        <label><span>${lang === "en" ? "Email" : "メールアドレス"}</span><input type="email" name="email" required autocomplete="email"></label>
        <button type="submit">${lang === "en" ? "Join waitlist" : "順番待ちに登録する"}</button>
      </form>
      <p class="ze-links"><a href="${prefix}/login">${lang === "en" ? "Sign in" : "ログインへ"}</a></p>`,
  };

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(titleMap[options.mode])} — ZUKAN</title>
  <style>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.6}
    a,a:visited{color:var(--green)}
    .ze-wrap{max-width:460px;margin:0 auto;padding:28px 16px 64px}
    .ze-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;display:grid;gap:14px}
    .ze-card h1{margin:0;font-size:22px}
    .ze-form{display:grid;gap:12px}
    .ze-form label{display:grid;gap:4px;font-size:14px;font-weight:700}
    .ze-form input{width:100%;min-height:44px;padding:8px 12px;border:1px solid #c5d1c8;border-radius:8px;background:#fff;font:inherit}
    .ze-form button{min-height:44px;border:0;border-radius:8px;background:var(--green);color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .ze-status{margin:0;min-height:18px;font-size:13px;color:var(--muted)}
    .ze-links{margin:0;font-size:14px;color:var(--muted)}
    @media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <main class="ze-wrap" data-zukan-entry="${escapeHtml(options.mode)}">
    <section class="ze-card">
      <h1>${escapeHtml(titleMap[options.mode])}</h1>
      ${bodyByMode[options.mode]}
    </section>
  </main>
</body>
</html>`;
}
