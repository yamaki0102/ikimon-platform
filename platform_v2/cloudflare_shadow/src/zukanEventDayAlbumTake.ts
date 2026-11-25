import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type EventSessionRow = {
  session_id: string;
  title: string;
  organizer_user_id: string;
  place_id: string | null;
  started_at: string;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

async function ensureEventPlaceSavesTable(db: Env["OBS_DB"]): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS zukan_event_place_saves (
      save_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, place_id, user_id)
    )`
  ).run();
}

export async function handleEventDayAlbumTakeRoute(
  eventId: string,
  view: "day" | "album" | "take",
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const event = await db.prepare(
    "SELECT session_id, title, organizer_user_id, place_id, started_at FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<EventSessionRow>();
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const placeHref = event.place_id
    ? `${prefix}/places/${encodeURIComponent(event.place_id)}`
    : `${prefix}/map`;

  const navTabs = `<nav class="zt-hub-grid" aria-label="${isEn ? "Event views" : "観察会の表示"}">
    <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/day`)}"><strong>${isEn ? "Event Day" : "当日"}</strong><span>${isEn ? "Live schedule & capture" : "当日の進行と記録"}</span></a>
    <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/album`)}"><strong>${isEn ? "Album" : "終了後のアルバム"}</strong><span>${isEn ? "Photos & discoveries" : "みんなで見つけた写真"}</span></a>
    <a class="zt-hub-dest" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/take`)}"><strong>${isEn ? "Take-home" : "持ち帰り"}</strong><span>${isEn ? "Keep records at this place" : "場所へ記録を残す"}</span></a>
  </nav>`;

  let viewHtml = "";
  let pageTitle = event.title;

  if (view === "day") {
    pageTitle = isEn ? `${event.title} — Day` : `${event.title} — 当日`;
    viewHtml = `<section class="zt-hub-card" data-event-view="f3">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Event day check-in and live field capture." : "観察会当日のページです。見つけた生きものをそのまま記録できます。"}</p>
      <p><small>${escapeHtml(event.started_at)}</small></p>
      <div><a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record?eventSessionId=${encodeURIComponent(eventId)}`)}">${isEn ? "Capture now" : "撮る"}</a></div>
    </section>`;
  } else if (view === "album") {
    pageTitle = isEn ? `${event.title} — Album` : `${event.title} — アルバム`;
    viewHtml = `<section class="zt-hub-card" data-event-view="f4">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Post-event album of shared discoveries." : "観察会終了後のアルバムです。当日の記録をまとめて見返せます。"}</p>
      <div><a class="zt-btn-outline" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/take`)}">${isEn ? "Open take-home page" : "持ち帰りページへ"}</a></div>
    </section>`;
  } else {
    pageTitle = isEn ? `${event.title} — Take-home` : `${event.title} — 持ち帰り`;
    viewHtml = `<section class="zt-hub-card" data-event-view="take">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Carry today's discoveries back to this place." : "今日の観察会の記録を、この場所の記録として残して見返せます。"}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="zt-btn-capture" href="${escapeHtml(placeHref)}">${isEn ? "View records at this place" : "この場所の記録を見る"}</a>
        <button type="button" class="zt-btn-outline" data-save-to-place-btn="1" id="save-to-place-btn">${isEn ? "Save to this place" : "この場所の記録として残す"}</button>
      </div>
      <p id="save-to-place-status" aria-live="polite"></p>
      <script>
        (() => {
          const btn = document.getElementById("save-to-place-btn");
          if (!btn) return;
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            const res = await fetch(${JSON.stringify(`/api/v1/events/${encodeURIComponent(eventId)}/save-to-place`)}, { method: "POST" });
            const out = document.getElementById("save-to-place-status");
            if (res.ok) {
              out.textContent = ${JSON.stringify(isEn ? "Saved to this place." : "この場所へ保存しました。")};
            } else {
              out.textContent = ${JSON.stringify(isEn ? "Sign in as a participant to save." : "参加中のアカウントでログインすると保存できます。")};
              btn.disabled = false;
            }
          });
        })();
      </script>
    </section>`;
  }

  const html = renderZukanCommonShell({
    lang,
    title: pageTitle,
    activeNav: "events",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml: `${navTabs}${viewHtml}`,
    pathname: `${prefix}/events/${encodeURIComponent(eventId)}/${view}`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleSaveEventToPlace(
  eventId: string,
  _request: Request,
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session || session.banned) {
    return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
  }

  const event = await db.prepare(
    "SELECT session_id, organizer_user_id, place_id FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<{ session_id: string; organizer_user_id: string; place_id: string | null }>();
  if (!event) {
    return json({ ok: false, error: "event_not_found" }, 404, { "cache-control": "no-store" });
  }

  const isOrganizer = event.organizer_user_id === session.userId;
  if (!isOrganizer) {
    const part = await db.prepare(
      "SELECT 1 AS ok FROM observation_event_participants WHERE session_id = ? AND user_id = ? LIMIT 1"
    ).bind(eventId, session.userId).first();
    if (!part) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
  }

  if (!event.place_id) {
    return json({ ok: false, error: "event_place_not_linked" }, 400, { "cache-control": "no-store" });
  }

  await ensureEventPlaceSavesTable(db);
  await db.prepare(
    `INSERT OR IGNORE INTO zukan_event_place_saves (save_id, event_id, place_id, user_id)
     VALUES (?, ?, ?, ?)`
  ).bind(`eps_${crypto.randomUUID()}`, eventId, event.place_id, session.userId).run();

  return json({ ok: true, eventId, placeId: event.place_id }, 200, { "cache-control": "no-store" });
}
