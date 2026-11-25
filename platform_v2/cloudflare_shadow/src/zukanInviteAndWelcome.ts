import type { Env } from "./core/env";

type D1Db = Env["OBS_DB"];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type ZukanWelcomeInviteMode = "registered" | "onboarding" | "place_invite" | "event_invite";

export type ResolvedInviteTarget =
  | {
      ok: true;
      kind: "event";
      id: string;
      code: string;
      title: string;
      subtitle: string;
      targetHref: string;
    }
  | {
      ok: true;
      kind: "place";
      id: string;
      code: string;
      title: string;
      subtitle: string;
      targetHref: string;
    }
  | {
      ok: false;
      error: "invalid_invite_code" | "invite_not_found";
    };

export function normalizeInviteCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(trimmed)) return "";
  return trimmed;
}

/**
 * Resolves an invite code to either an observation event (by event_code)
 * or a published place (by place_id). Fails closed for non-published places.
 */
export async function resolveInviteTarget(
  obsDb: D1Db,
  rawCode: unknown
): Promise<ResolvedInviteTarget> {
  const code = normalizeInviteCode(rawCode);
  if (!code) {
    return { ok: false, error: "invalid_invite_code" };
  }

  try {
    const eventRow = await obsDb.prepare(
      `SELECT session_id, event_code, title
         FROM observation_event_sessions
        WHERE UPPER(event_code) = UPPER(?)
        LIMIT 1`
    ).bind(code).first<{ session_id: string; event_code: string; title: string }>();
    if (eventRow) {
      return {
        ok: true,
        kind: "event",
        id: eventRow.session_id,
        code: eventRow.event_code,
        title: eventRow.title,
        subtitle: "観察会への招待",
        targetHref: `/ja/community/events/${encodeURIComponent(eventRow.event_code)}/join`,
      };
    }
  } catch {
    // Ignore when observation_event_sessions is absent in minimal fixtures
  }

  try {
    const placeRow = await obsDb.prepare(
      `SELECT place_id, canonical_name,
              COALESCE(NULLIF(COALESCE(prefecture, '') || COALESCE(municipality, ''), ''), locality_label) AS admin_area_label
         FROM places
        WHERE place_id = ?
          AND public_profile_status = 'published'
        LIMIT 1`
    ).bind(code).first<{ place_id: string; canonical_name: string; admin_area_label: string | null }>();
    if (placeRow) {
      return {
        ok: true,
        kind: "place",
        id: placeRow.place_id,
        code: placeRow.place_id,
        title: placeRow.canonical_name,
        subtitle: placeRow.admin_area_label ? `${placeRow.admin_area_label}の観察場所` : "公開場所への招待",
        targetHref: `/ja/places/${encodeURIComponent(placeRow.place_id)}`,
      };
    }
  } catch {
    // Ignore when places table is absent in minimal fixtures
  }

  return { ok: false, error: "invite_not_found" };
}

const WELCOME_STEPS = {
  ja: [
    { icon: "camera", title: "撮った写真は、\n場所と日付でたまります", body: "カメラで撮るだけ。あとから見返したり、その場所の図鑑に載せたりできます。" },
    { icon: "lock", title: "最初は、\n自分だけに見えます", body: "撮った写真は非公開で保存されます。公開するかどうかは、あとから自分で選べます。" },
    { icon: "book", title: "載せたいものだけ、\n図鑑に載せられます", body: "見返して、載せたい写真だけを選びます。観察会や場所の図鑑につなぐこともできます。" },
  ],
  en: [
    { icon: "camera", title: "Photos pile up\nby place and date", body: "Just take a photo. Look back later, or add it to the place's ZUKAN." },
    { icon: "lock", title: "At first, only\nyou can see them", body: "Photos are saved privately. You choose later whether to publish." },
    { icon: "book", title: "Add only what\nyou choose", body: "Review, then pick the photos to add. You can also link them to events and places." },
  ],
} as const;

const WI_ICONS: Record<string, string> = {
  camera: `<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  book: `<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>`,
  place: `<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
  event: `<svg viewBox="0 0 24 24" width="72" height="72" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`,
};

const WI_CSS = `
    :root{color-scheme:light;--bg:#fff;--surface:#f7f7f3;--surface-2:#e8efea;--ink:#17251b;--muted:#4f5d54;--green:#143f2e;--line:#dde2dc}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.7}
    a,a:visited{color:var(--green)}
    .zi-wrap{max-width:520px;margin:0 auto;padding:20px 16px 56px;display:grid;gap:20px}
    .zi-logo{display:flex;justify-content:center;padding:6px 0}
    .zi-logo img{height:34px;width:auto}
    .zi-art{display:flex;align-items:center;justify-content:center;aspect-ratio:1.15/1;border-radius:24px;border:1px solid var(--line);background:var(--surface-2);color:var(--green)}
    .zi-art.is-wide{aspect-ratio:1.5/1}
    .zi-wrap h1{margin:0;font-size:28px;line-height:1.45;white-space:pre-line}
    .zi-wrap h1.is-invite{font-size:26px}
    .zi-lead{margin:0;color:var(--muted);font-size:17px;line-height:1.8}
    .zi-dots{display:flex;gap:8px}
    .zi-dots span{width:10px;height:10px;border-radius:999px;background:var(--line)}
    .zi-dots span.is-on{width:36px;background:var(--green)}
    .zi-actions{display:grid;gap:12px}
    .zi-btn,.zi-btn:visited{min-height:56px;padding:0 18px;border-radius:18px;background:var(--green);color:#fff;font-size:18px;font-weight:700;text-decoration:none;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(20,63,46,.2)}
    .zi-btn.secondary,.zi-btn.secondary:visited{background:#fff;color:var(--green);border:1.5px solid var(--green);box-shadow:none}
    .zi-skip,.zi-skip:visited{min-height:48px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:var(--green);text-decoration:none}
    .zi-note{margin:0;color:var(--muted);font-size:15px;line-height:1.8}
    @media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
`;

export function renderZukanWelcomeAndInvitePage(options: {
  mode: ZukanWelcomeInviteMode;
  lang?: "ja" | "en";
  fieldName?: string;
  targetTitle?: string;
  targetSubtitle?: string;
  targetHref?: string;
  step?: number;
  authenticated?: boolean;
}): string {
  const lang = options.lang === "en" ? "en" : "ja";
  const isEn = lang === "en";
  const prefix = `/${lang}`;
  const logo = `<div class="zi-logo"><img src="/assets/brand/zukan-lockup.svg" alt="ZUKAN"></div>`;
  let title = "";
  let inner = "";

  if (options.mode === "onboarding") {
    const steps = WELCOME_STEPS[lang];
    const idx = Math.min(steps.length, Math.max(1, Math.trunc(options.step ?? 1))) - 1;
    const st = steps[idx]!;
    const last = idx === steps.length - 1;
    const skipHref = options.authenticated ? `${prefix}/library` : `${prefix}/`;
    const nextHref = last ? (options.authenticated ? `${prefix}/record` : `${prefix}/register`) : `${prefix}/welcome?step=${idx + 2}`;
    const nextLabel = last
      ? (options.authenticated ? (isEn ? "Take a first photo" : "最初の1枚を撮る") : (isEn ? "Sign up (free)" : "新規登録（無料）"))
      : (isEn ? "Next" : "次へ");
    title = st.title.replace("\n", "");
    inner = `<div class="zi-art" aria-hidden="true">${WI_ICONS[st.icon]}</div>
      <h1>${escapeHtml(st.title)}</h1>
      <p class="zi-lead">${escapeHtml(st.body)}</p>
      <div class="zi-dots" role="img" aria-label="${idx + 1} / ${steps.length}">${steps.map((_, i) => `<span${i === idx ? ' class="is-on"' : ""}></span>`).join("")}</div>
      <div class="zi-actions"><a class="zi-btn" href="${escapeHtml(nextHref)}" data-welcome-next="1">${escapeHtml(nextLabel)}</a>${last ? "" : `<a class="zi-skip" href="${escapeHtml(skipHref)}">${isEn ? "Skip" : "スキップ"}</a>`}</div>`;
  } else if (options.mode === "registered") {
    title = isEn ? "Welcome to ZUKAN" : "登録が完了しました";
    inner = `${logo}<h1>${escapeHtml(title)}</h1>
      <p class="zi-lead">${escapeHtml(options.fieldName ? (isEn ? `You can start as "${options.fieldName}".` : `フィールドネーム「${options.fieldName}」で始められます。`) : (isEn ? "You can start with your field name." : "フィールドネームで始められます。"))}</p>
      <div class="zi-actions"><a class="zi-btn" href="${prefix}/record">${isEn ? "Take your first photo" : "最初の1枚を撮る"}</a><a class="zi-btn secondary" href="${prefix}/library">${isEn ? "Open library" : "ライブラリを開く"}</a></div>`;
  } else {
    const isPlace = options.mode === "place_invite";
    const t = options.targetTitle ?? "";
    title = t
      ? (isEn ? `Invited to ${t}` : `${t} への招待`)
      : (isEn ? (isPlace ? "Place invitation" : "Event invitation") : isPlace ? "場所からの招待" : "観察会からの招待");
    const heading = t
      ? (isEn ? `You are invited to "${t}"` : isPlace ? `「${t}」の図鑑に\n招待されています` : `「${t}」の観察会に\n招待されています`)
      : title;
    const lead = options.targetSubtitle || (isPlace ? "この場所の記録を見たり、自分の写真を載せたりできます。" : "当日の写真をみんなで集められます。あなたの写真も加えられます。");
    const go = options.targetHref || (isPlace ? `${prefix}/map` : `${prefix}/community/events`);
    const loginHref = `${prefix}/login?redirect=${encodeURIComponent(go.startsWith(`${prefix}/`) ? go.slice(prefix.length) : go)}`;
    inner = `${logo}<div class="zi-art is-wide" aria-hidden="true">${WI_ICONS[isPlace ? "place" : "event"]}</div>
      <h1 class="is-invite">${escapeHtml(heading)}</h1>
      <p class="zi-lead">${escapeHtml(lead)}</p>
      <div class="zi-actions"><a class="zi-btn" href="${escapeHtml(go)}" data-invite-join="1">${isEn ? "Join" : "参加する"}</a>${options.authenticated ? "" : `<a class="zi-btn secondary" href="${escapeHtml(loginHref)}" data-invite-login="1">${isEn ? "Log in to join" : "ログインして参加"}</a>`}</div>
      <p class="zi-note">${isEn ? "Joining never makes your photos public on its own." : "参加しても、あなたの写真が勝手に公開されることはありません。"}</p>`;
  }

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} — ZUKAN</title>
  <style>${WI_CSS}</style>
</head>
<body>
  <main class="zi-wrap" data-zukan-welcome-invite="${escapeHtml(options.mode)}">
    ${inner}
  </main>
</body>
</html>`;
}

export function renderZukanInviteNotFoundPage(lang: "ja" | "en"): string {
  const isEn = lang === "en";
  const prefix = `/${lang}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isEn ? "Invitation not found" : "招待が見つかりません"} — ZUKAN</title>
  <style>${WI_CSS}</style>
</head>
<body>
  <main class="zi-wrap" data-zukan-welcome-invite="invalid">
    <div class="zi-logo"><img src="/assets/brand/zukan-lockup.svg" alt="ZUKAN"></div>
    <h1>${isEn ? "This invitation was not found" : "この招待は見つかりませんでした"}</h1>
    <p class="zi-lead">${isEn ? "The link may be wrong or no longer available. Please ask the person who invited you." : "リンクが違うか、すでに使えなくなっています。招待した人に確かめてください。"}</p>
    <div class="zi-actions"><a class="zi-btn" href="${prefix}/">${isEn ? "Open ZUKAN" : "ZUKANを開く"}</a></div>
  </main>
</body>
</html>`;
}
