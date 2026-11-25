import type { Env } from "./core/env";
import { escapeHtml, finiteNumberOrNull, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type EventRow = {
  session_id: string;
  title: string;
  location_lat: number | null;
  location_lng: number | null;
  started_at: string;
  ended_at: string | null;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function queryNearbyEvents(url: URL, db: Env["OBS_DB"]) {
  const lat = finiteNumberOrNull(url.searchParams.get("lat"));
  const lng = finiteNumberOrNull(url.searchParams.get("lng"));
  const rows = (await db.prepare(
    `SELECT session_id, title, location_lat, location_lng, started_at, ended_at
       FROM observation_event_sessions
      ORDER BY started_at DESC
      LIMIT 50`
  ).all<EventRow>()).results;

  const mapped = rows.map((row) => ({
    sessionId: row.session_id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceKm:
      lat !== null && lng !== null && row.location_lat !== null && row.location_lng !== null
        ? Math.round(haversineKm(lat, lng, row.location_lat, row.location_lng) * 10) / 10
        : null,
  }));

  if (lat !== null && lng !== null) {
    mapped.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
  }
  return mapped;
}

export async function handleNearbyEventsApi(url: URL, db: Env["OBS_DB"]): Promise<Response> {
  const events = await queryNearbyEvents(url, db);
  return json({ ok: true, events }, 200, { "cache-control": "no-store" });
}

export async function handleNearbyEventsPageRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const events = await queryNearbyEvents(url, db);
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const listHtml = events.length > 0
    ? `<div class="zt-hub-grid">${events
        .map(
          (ev) => `<a class="zt-hub-dest" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(ev.sessionId)}/details`)}">
            <strong>${escapeHtml(ev.title)}</strong>
            <span>${escapeHtml(ev.startedAt)}${ev.distanceKm !== null ? ` · ${ev.distanceKm} km` : ""}</span>
          </a>`
        )
        .join("")}</div>`
    : `<p>${isEn ? "No nearby events found." : "近くで開催予定のイベントはまだありません。"}</p>`;

  const bodyHtml = `<section class="zt-hub-card" data-event-view="f5">
    <h1>${isEn ? "Nearby events" : "近くのイベント"}</h1>
    <p>${isEn ? "Find observation events near your current area." : "現在地の近くや最近の観察会を探せます。"}</p>
    ${listHtml}
  </section>`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Nearby events" : "近くのイベント",
    activeNav: "events",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/events/nearby`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleEventDetailsRoute(
  eventId: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const row = await db.prepare(
    "SELECT session_id, title, location_lat, location_lng, started_at, ended_at FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<EventRow>();
  if (!row) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);

  const bodyHtml = `<section class="zt-hub-card" data-event-view="f6">
    <h1>${escapeHtml(row.title)}</h1>
    <p>${isEn ? "Starts" : "開始"}: <time>${escapeHtml(row.started_at)}</time>${row.ended_at ? ` — <time>${escapeHtml(row.ended_at)}</time>` : ""}</p>
    <p>${isEn ? "Only your field name is shared with the organizer." : "主催者に共有されるのはフィールドネームのみです。"}</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/confirm`)}">${isEn ? "Join event" : "参加を確認する"}</a>
      <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/events/nearby`)}">${isEn ? "Back to nearby events" : "近くのイベント一覧へ"}</a>
    </div>
  </section>`;

  const html = renderZukanCommonShell({
    lang,
    title: row.title,
    activeNav: "events",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/events/${encodeURIComponent(eventId)}/details`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
