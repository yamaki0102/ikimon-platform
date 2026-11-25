import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type EventRow = {
  session_id: string;
  title: string;
  started_at: string;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

export async function handleEventAlbumOrShareRoute(
  eventId: string,
  view: "gallery" | "share",
  origin: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const event = await db.prepare(
    "SELECT session_id, title, started_at FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<EventRow>();
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const shareUrl = `${origin}${prefix}/events/${encodeURIComponent(eventId)}/preview`;

  let bodyHtml = "";
  let pageTitle = event.title;

  if (view === "gallery") {
    pageTitle = isEn ? `Album — ${event.title}` : `アルバム — ${event.title}`;
    bodyHtml = `<section class="zt-hub-card" data-event-view="f9">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Event photo album" : "観察会のアルバム"} · <time>${escapeHtml(event.started_at)}</time></p>
      <div class="zt-lib-grid" data-event-album-grid="1"></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/share`)}">${isEn ? "Share event" : "この観察会を共有する"}</a>
        <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/day`)}">${isEn ? "Back to event day" : "当日ページへ戻る"}</a>
      </div>
    </section>`;
  } else {
    pageTitle = isEn ? `Share — ${event.title}` : `共有 — ${event.title}`;
    bodyHtml = `<section class="zt-hub-card" data-event-view="f10" data-event-share-sheet="1">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Share this observation event link with participants." : "この観察会の案内リンクを参加者に共有できます。"}</p>
      <input type="text" readonly value="${escapeHtml(shareUrl)}" id="event-share-url" style="width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <button type="button" class="zt-btn-capture" id="event-copy-share-btn">${isEn ? "Copy link" : "リンクをコピー"}</button>
        <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/gallery`)}">${isEn ? "Open album" : "アルバムを見る"}</a>
      </div>
      <p id="event-copy-status" aria-live="polite"></p>
      <script>
        (() => {
          const btn = document.getElementById("event-copy-share-btn");
          const input = document.getElementById("event-share-url");
          if (!btn || !input) return;
          btn.addEventListener("click", async () => {
            try {
              await navigator.clipboard.writeText(input.value);
              document.getElementById("event-copy-status").textContent = ${JSON.stringify(isEn ? "Link copied." : "リンクをコピーしました。")};
            } catch {
              input.select();
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
    bodyHtml,
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
