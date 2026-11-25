import type { Env } from "./core/env";
import { escapeHtml, finiteNumberOrNull, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { EVENT_ICON_SHARE, ZUKAN_EVENT_CSS, eventTiming, loadEventCore, renderEventFacts, renderEventSubHead } from "./zukanEventUi";

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
  const lat = url.searchParams.has("lat") ? finiteNumberOrNull(url.searchParams.get("lat")) : null;
  const lng = url.searchParams.has("lng") ? finiteNumberOrNull(url.searchParams.get("lng")) : null;
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

  const chev = '<svg class="ze-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const listHtml = events.length > 0
    ? `<ul class="ze-list">${events
        .map((ev) => {
          const timing = eventTiming({ startedAt: ev.startedAt, endedAt: ev.endedAt }, lang);
          const meta = [timing.phase === "today" ? (isEn ? "Today" : "本日") : "", timing.timeLabel, ev.distanceKm !== null ? `${ev.distanceKm} km` : ""].filter(Boolean).join(" ・ ");
          return `<li><a class="ze-row" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(ev.sessionId)}/preview`)}">
            <span class="ze-date" aria-hidden="true"><small>${escapeHtml(timing.shortMonth)}</small><b>${escapeHtml(timing.shortDay)}</b></span>
            <span class="ze-row-body"><strong>${escapeHtml(ev.title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>${chev}
          </a></li>`;
        })
        .join("")}</ul>`
    : `<p class="ze-empty">${isEn ? "No events are open for joining right now. Browse everyone's records in the meantime." : "いま参加できるイベントはまだありません。それまで、みんなの記録を見てみましょう。"}</p>
       <a class="ze-btn" href="${escapeHtml(`${prefix}/library`)}">${isEn ? "See everyone's records" : "みんなの記録を見る"}</a>`;

  const bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f5" style="max-width:720px">
    <h1 style="margin:0;font-size:1.5rem">${isEn ? "Nearby events" : "近くのイベント"}</h1>
    <p class="ze-note">${isEn ? "Find observation events near your current area." : "現在地の近くや最近の観察会を探せます。"}</p>
    ${listHtml}
  </div>`;

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
  const row = await loadEventCore(db, eventId);
  if (!row) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const encodedEvent = encodeURIComponent(eventId);
  const timing = eventTiming(row, lang);
  const facts: Array<[string, string]> = [[isEn ? "When" : "日時", timing.whenLabel]];
  if (row.placeLabel) facts.push([isEn ? "Place" : "場所", row.placeLabel]);
  if (row.organizerLabel) facts.push([isEn ? "Host" : "主催", row.organizerLabel]);
  if (row.participants !== null && row.participants > 0) facts.push([isEn ? "Joining" : "参加予定", isEn ? `${row.participants}` : `${row.participants}人`]);

  const bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f6" style="max-width:720px">
    ${renderEventSubHead(isEn ? "Details" : "詳細情報", `${prefix}/events/${encodedEvent}/preview`, isEn ? "Back to the event" : "イベントに戻る")}
    <h1 style="margin:0;font-size:1.5rem;line-height:1.4">${escapeHtml(row.title)}</h1>
    ${renderEventFacts(facts)}
    ${row.summary ? `<p class="ze-text">${escapeHtml(row.summary)}</p>` : ""}
    <p class="ze-note">${isEn ? "Only your field name is shared with the organizer." : "主催者に共有されるのはフィールドネームのみです。"}</p>
    <a class="ze-btn" href="${escapeHtml(`${prefix}/events/${encodedEvent}/confirm`)}">${isEn ? "Join event" : "参加を確認する"}</a>
    <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/nearby`)}">${isEn ? "Back to nearby events" : "近くのイベント一覧へ"}</a>
    <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/share`)}">${EVENT_ICON_SHARE}${isEn ? "Share" : "共有する"}</a>
  </div>`;

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
