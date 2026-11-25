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

export function renderZukanWelcomeAndInvitePage(options: {
  mode: ZukanWelcomeInviteMode;
  lang?: "ja" | "en";
  fieldName?: string;
  targetTitle?: string;
  targetSubtitle?: string;
  targetHref?: string;
}): string {
  const lang = options.lang === "en" ? "en" : "ja";
  const prefix = `/${lang}`;
  const headingMap: Record<ZukanWelcomeInviteMode, string> = {
    registered: lang === "en" ? "Welcome to ZUKAN" : "登録が完了しました",
    onboarding: lang === "en" ? "Your first step" : "はじめの案内",
    place_invite: options.targetTitle
      ? (lang === "en" ? `Invited to ${options.targetTitle}` : `${options.targetTitle} への招待`)
      : (lang === "en" ? "Place invitation" : "場所からの招待"),
    event_invite: options.targetTitle
      ? (lang === "en" ? `Invited to ${options.targetTitle}` : `${options.targetTitle} への招待`)
      : (lang === "en" ? "Event invitation" : "観察会からの招待"),
  };
  const bodyMap: Record<ZukanWelcomeInviteMode, string> = {
    registered: `<p>${escapeHtml(options.fieldName ? `フィールドネーム「${options.fieldName}」で始められます。` : "フィールドネームで始められます。")}</p>
      <div class="zi-actions"><a class="zi-btn" href="${prefix}/record">${lang === "en" ? "Take your first photo" : "最初の1枚を撮る"}</a><a class="zi-btn secondary" href="${prefix}/library">${lang === "en" ? "Open library" : "ライブラリへ"}</a></div>`,
    onboarding: `<ol class="zi-steps">
        <li>${lang === "en" ? "Capture a photo — it stays private by default." : "1枚撮る（最初は自分だけの非公開で保存されます）"}</li>
        <li>${lang === "en" ? "Review and publish only what you choose." : "見返してから、公開したいものだけを選べます"}</li>
      </ol>
      <div class="zi-actions"><a class="zi-btn" href="${prefix}/record">${lang === "en" ? "Start capturing" : "撮ってみる"}</a></div>`,
    place_invite: `<p>${escapeHtml(options.targetSubtitle || "招待された場所の記録を見たり、そのまま1枚残せます。")}</p>
      <div class="zi-actions"><a class="zi-btn" href="${escapeHtml(options.targetHref || `${prefix}/map`)}">${lang === "en" ? "Open this place" : "この場所を開く"}</a><a class="zi-btn secondary" href="${prefix}/record">${lang === "en" ? "Record here" : "ここで記録する"}</a></div>`,
    event_invite: `<p>${escapeHtml(options.targetSubtitle || "招待された観察会へ参加し、当日の記録を残せます。")}</p>
      <div class="zi-actions"><a class="zi-btn" href="${escapeHtml(options.targetHref || `${prefix}/community/events`)}">${lang === "en" ? "Join this event" : "この観察会へ参加する"}</a></div>`,
  };

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(headingMap[options.mode])} — ZUKAN</title>
  <style>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.6}
    a,a:visited{color:var(--green)}
    .zi-wrap{max-width:520px;margin:0 auto;padding:28px 16px 64px}
    .zi-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px;display:grid;gap:14px}
    .zi-card h1{margin:0;font-size:22px}
    .zi-steps{margin:0;padding-left:20px;display:grid;gap:8px}
    .zi-actions{display:flex;flex-wrap:wrap;gap:10px}
    .zi-btn,.zi-btn:visited{min-height:44px;padding:0 18px;border-radius:10px;background:var(--green);color:#fff;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
    .zi-btn.secondary,.zi-btn.secondary:visited{background:#fff;color:var(--green);border:1px solid var(--green)}
    @media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <main class="zi-wrap" data-zukan-welcome-invite="${escapeHtml(options.mode)}">
    <section class="zi-card">
      <h1>${escapeHtml(headingMap[options.mode])}</h1>
      ${bodyMap[options.mode]}
    </section>
  </main>
</body>
</html>`;
}
