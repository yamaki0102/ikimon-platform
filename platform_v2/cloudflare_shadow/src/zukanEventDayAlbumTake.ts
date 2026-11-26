import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { EVENT_ICON_CAMERA, EVENT_ICON_SHARE, ZUKAN_EVENT_CSS, eventTiming, loadEventCore, phaseChip, renderEventHero, renderEventSubHead } from "./zukanEventUi";

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
  const event = await loadEventCore(db, eventId);
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const encodedEvent = encodeURIComponent(eventId);
  const placeHref = event.placeId ? `${prefix}/places/${encodeURIComponent(event.placeId)}` : `${prefix}/map`;
  const timing = eventTiming(event, lang);
  const peopleLabel = event.participants !== null && event.participants > 0 ? (isEn ? `${event.participants} joined` : `参加 ${event.participants}人`) : "";
  const viewLinks = `<nav class="ze-note" aria-label="${isEn ? "Event views" : "観察会の表示"}" style="display:flex;flex-wrap:wrap;gap:8px 20px">
    <a href="${escapeHtml(`${prefix}/events/${encodedEvent}/day`)}">${isEn ? "Event Day" : "当日"}</a>
    <a href="${escapeHtml(`${prefix}/events/${encodedEvent}/album`)}">${isEn ? "Album" : "終了後のアルバム"}</a>
    <a href="${escapeHtml(`${prefix}/events/${encodedEvent}/take`)}">${isEn ? "Take-home" : "持ち帰り"}</a>
  </nav>`;
  const hero = (chip: string) =>
    renderEventHero({
      title: event.title,
      chip,
      sub: peopleLabel,
      backHref: `${prefix}/events/${encodedEvent}/preview`,
      backLabel: isEn ? "Back to the event" : "イベントに戻る",
      shareHref: `${prefix}/events/${encodedEvent}/share`,
      shareLabel: isEn ? "Share" : "共有する",
    });
  const emptyAlbum = (text: string) => `<p class="ze-empty" data-event-album-empty="1">${escapeHtml(text)}</p>`;

  let viewHtml = "";
  let pageTitle = event.title;

  if (view === "day") {
    pageTitle = isEn ? `${event.title} — Day` : `${event.title} — 当日`;
    viewHtml = `<div class="ze" data-event-view="f3">
      <div class="ze-main">
        ${hero(phaseChip(timing.phase === "upcoming" ? "upcoming" : "today", timing.dateLabel, isEn))}
        <section class="ze-section">
          <p class="ze-text">${isEn ? "Event day check-in and live field capture." : "観察会当日のページです。見つけた生きものをそのまま記録できます。"}</p>
        </section>
        <section class="ze-section">
          <h2>${isEn ? "Today's album" : "今日のアルバム"}</h2>
          ${emptyAlbum(isEn ? "No photos yet. Be the first to add one." : "まだ写真はありません。最初の1枚を加えてみましょう。")}
        </section>
        <aside class="ze-cta">
          <a class="ze-btn" href="${escapeHtml(`${prefix}/record?eventSessionId=${encodedEvent}`)}">${EVENT_ICON_CAMERA}${isEn ? "Capture now" : "写真を加える"}</a>
          <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/share`)}">${EVENT_ICON_SHARE}${isEn ? "Share" : "共有する"}</a>
          ${viewLinks}
        </aside>
      </div>
    </div>`;
  } else if (view === "album") {
    pageTitle = isEn ? `${event.title} — Album` : `${event.title} — アルバム`;
    viewHtml = `<div class="ze" data-event-view="f4">
      <div class="ze-main">
        ${hero(phaseChip("past", timing.dateLabel, isEn))}
        <section class="ze-section">
          <h2>${isEn ? "Thank you all" : "おつかれさまでした"}</h2>
          <p class="ze-text">${isEn ? "Post-event album of shared discoveries." : "観察会終了後のアルバムです。当日の記録をまとめて見返せます。"}</p>
        </section>
        <section class="ze-section">
          ${emptyAlbum(isEn ? "No photos have been added yet." : "まだアルバムに写真はありません。参加した人が写真を加えるとここに並びます。")}
        </section>
        <aside class="ze-cta">
          <a class="ze-btn" href="${escapeHtml(`${prefix}/events/${encodedEvent}/take`)}">${isEn ? "Open take-home page" : "図鑑に載せる"}</a>
          <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/share`)}">${EVENT_ICON_SHARE}${isEn ? "Share album" : "アルバムを共有"}</a>
          ${viewLinks}
        </aside>
      </div>
    </div>`;
  } else {
    pageTitle = isEn ? `${event.title} — Take-home` : `${event.title} — 持ち帰り`;
    viewHtml = `<div class="ze" data-event-view="take" style="max-width:720px">
      ${renderEventSubHead(isEn ? "Take-home" : "持ち帰り", `${prefix}/events/${encodedEvent}/album`, isEn ? "Back to the album" : "アルバムに戻る")}
      <h1 class="ze-text" style="font-size:1.5rem;font-weight:700;margin:0">${escapeHtml(event.title)}</h1>
      <p class="ze-text">${isEn ? "Carry today's discoveries back to this place." : "今日の観察会の記録を、この場所の記録として残して見返せます。"}</p>
      <a class="ze-btn" href="${escapeHtml(placeHref)}">${isEn ? "View records at this place" : "この場所の記録を見る"}</a>
      <button type="button" class="ze-btn is-outline" data-save-to-place-btn="1" id="save-to-place-btn">${isEn ? "Save to this place" : "この場所の記録として残す"}</button>
      <p class="ze-note" id="save-to-place-status" aria-live="polite"></p>
      ${viewLinks}
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
    </div>`;
  }

  const html = renderZukanCommonShell({
    lang,
    title: pageTitle,
    activeNav: "events",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml: `<style>${ZUKAN_EVENT_CSS}</style>${viewHtml}`,
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
    "SELECT * FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
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
