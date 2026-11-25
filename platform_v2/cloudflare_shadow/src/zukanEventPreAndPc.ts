import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
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

export async function handleEventPreAndPcRoute(
  eventId: string,
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

  const bodyHtml = `<style>
    .zf-pre-grid{display:grid;gap:16px}
    @media(min-width:960px){.zf-pre-grid{grid-template-columns:1.5fr 1fr;align-items:start}}
  </style>
  <div class="zf-pre-grid" data-event-view="f1-f2">
    <section class="zt-hub-card">
      <p style="margin:0;color:var(--muted);font-size:14px;">${isEn ? "Upcoming observation event" : "開催前の観察会"}</p>
      <h1 style="margin:0;">${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Starts" : "開始日時"}: <time>${escapeHtml(event.started_at)}</time></p>
      <p>${isEn ? "Bring comfortable shoes, water, and a charged phone." : "持ち物：動きやすい靴・飲み物・充電したスマートフォン。"}</p>
      <div><a class="zt-btn-outline" href="${escapeHtml(placeHref)}">${isEn ? "View venue place" : "開催場所を見る"}</a></div>
    </section>
    <aside class="zt-hub-card">
      <h2>${isEn ? "Join this event" : "参加の準備"}</h2>
      <p>${isEn ? "Only your field name is shared with the organizer." : "主催者に伝わるのはフィールドネームまでです。"}</p>
      <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/confirm`)}">${isEn ? "Confirm participation" : "参加を確認する"}</a>
      <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/details`)}">${isEn ? "Event details" : "詳しい案内を見る"}</a>
    </aside>
  </div>`;

  const html = renderZukanCommonShell({
    lang,
    title: event.title,
    activeNav: "events",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/events/${encodeURIComponent(eventId)}/preview`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
