import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { EVENT_ICON_CAMERA, EVENT_ICON_SHARE, ZUKAN_EVENT_CSS, eventTiming, loadEventCore, renderEventSubHead } from "./zukanEventUi";

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
  const event = await loadEventCore(db, eventId);
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang !== "ja";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const encodedEvent = encodeURIComponent(eventId);
  const shareUrl = `${origin}${prefix}/events/${encodedEvent}/preview`;
  const timing = eventTiming(event, lang);

  let bodyHtml = "";
  let pageTitle = event.title;

  if (view === "gallery") {
    pageTitle = isEn ? `Album — ${event.title}` : `アルバム — ${event.title}`;
    bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f9" style="max-width:720px">
      ${renderEventSubHead(event.title, `${prefix}/events/${encodedEvent}/preview`, isEn ? "Back to the event" : "イベントに戻る")}
      <p class="ze-note">${escapeHtml(timing.dateLabel)}${event.participants ? ` ・ ${isEn ? `${event.participants} joined` : `参加 ${event.participants}人`}` : ""}</p>
      <div class="ze-grid" data-event-album-grid="1"></div>
      <p class="ze-empty">${isEn ? "No photos have been added yet." : "まだ写真はありません。参加した人が写真を加えるとここに並びます。"}</p>
      <p class="ze-dot">${isEn ? "Photos are everyone's records" : "写真は、参加したみんなの記録です"}</p>
      <a class="ze-btn" href="${escapeHtml(`${prefix}/record?eventSessionId=${encodedEvent}`)}">${EVENT_ICON_CAMERA}${isEn ? "Add photos" : "写真を加える"}</a>
      <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/share`)}">${EVENT_ICON_SHARE}${isEn ? "Share album" : "アルバムを共有"}</a>
      <a href="${escapeHtml(`${prefix}/events/${encodedEvent}/day`)}">${isEn ? "Back to event day" : "当日ページへ戻る"}</a>
    </div>`;
  } else {
    pageTitle = isEn ? `Share — ${event.title}` : `共有 — ${event.title}`;
    const mailHref = `mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(shareUrl)}`;
    bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f10" data-event-share-sheet="1" style="max-width:720px">
      ${renderEventSubHead(isEn ? "Share" : "共有する", `${prefix}/events/${encodedEvent}/preview`, isEn ? "Back to the event" : "イベントに戻る")}
      <div class="ze-summary"><span class="ze-summary-thumb" aria-hidden="true"></span><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(timing.whenLabel)}</small></div></div>
      <p class="ze-note">${isEn ? "Share this observation event link with participants." : "この観察会の案内リンクを参加者に共有できます。"}</p>
      <input type="text" readonly value="${escapeHtml(shareUrl)}" id="event-share-url" style="width:100%;min-height:52px;padding:12px 16px;border:1.5px solid #68746c;border-radius:16px;background:#fff;font:inherit;">
      <button type="button" class="ze-btn" id="event-copy-share-btn">${isEn ? "Copy link" : "リンクをコピーする"}</button>
      <a class="ze-btn is-outline" href="${escapeHtml(mailHref)}">${isEn ? "Send by email" : "メールで送る"}</a>
      <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/preview`)}">${isEn ? "Close" : "閉じる"}</a>
      <p class="ze-box">${isEn ? "Anyone with the link can see this page." : "リンクを知っている人は、このページを見られます。"}</p>
      <p class="ze-note" id="event-copy-status" aria-live="polite"></p>
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
    </div>`;
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

export type EventGalleryTile = { href: string; isVideo: boolean; statusLabel: string };

export function renderEventGalleryDocument(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  pathPrefix: string;
  event: { sessionId: string; title: string; startedAt: string; endedAt: string | null };
  tiles: EventGalleryTile[];
  organizerSectionHtml: string | null;
  authenticated: boolean;
  displayName?: string | null;
}): string {
  const { lang, pathPrefix: p, event } = options;
  const id = encodeURIComponent(event.sessionId);
  const timing = eventTiming(event, lang);
  const tiles = options.tiles
    .map((t) => `<div class="ze-tile" data-private-gallery-item>${t.isVideo
      ? `<video class="event-private-media" controls playsinline preload="metadata" src="${escapeHtml(t.href)}"></video>`
      : `<a href="${escapeHtml(t.href)}" rel="noreferrer"><img class="event-private-media" src="${escapeHtml(t.href)}" alt="保存した非公開写真" loading="lazy"></a>`}<span class="ze-tile-state">${escapeHtml(t.statusLabel)}</span></div>`)
    .join("");
  const empty = `<p class="ze-empty" data-gallery-empty>保存した写真・動画はありません。観察ラリーから記録できます。</p>`;
  const meta = [timing.dateLabel, options.organizerSectionHtml ? "" : `写真 ${options.tiles.length}枚`].filter(Boolean).join(" ・ ");
  const bodyHtml = `<style>${ZUKAN_EVENT_CSS}
.ze-grid .ze-tile{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;background:#eef1ed}
.ze-tile img,.ze-tile video{display:block;width:100%;height:100%;object-fit:cover}
.ze-tile-state{position:absolute;left:6px;right:6px;bottom:6px;padding:2px 8px;border-radius:999px;background:rgba(23,33,27,.72);color:#fff;font-size:.6875rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ze-dot{display:block;line-height:1.7}.ze-dot::before{display:inline-block;vertical-align:middle;margin-right:8px}
</style><div class="ze" data-event-view="f9" style="max-width:720px">
    ${renderEventSubHead(event.title, `${p}/events/${id}/preview`, lang !== "ja" ? "Back to the event" : "イベントに戻る")}
    <p class="ze-note">${escapeHtml(meta)}</p>
    ${options.organizerSectionHtml ?? (options.tiles.length ? `<div class="ze-grid" data-event-album-grid="1">${tiles}</div>` : empty)}
    <p class="ze-dot">ここにはご自身の写真・動画だけが表示されます。すべて非公開で、公開ページやみんなの振り返りには表示されません。</p>
    <a class="ze-btn" href="${escapeHtml(`${p}/events/${id}/rally`)}">${EVENT_ICON_CAMERA}写真を加える</a>
    <a class="ze-btn is-outline" href="${escapeHtml(`${p}/events/${id}/share`)}">${EVENT_ICON_SHARE}アルバムを共有</a>
  </div>`;
  return renderZukanCommonShell({
    lang,
    title: `アルバム — ${event.title}`,
    activeNav: "events",
    authenticated: options.authenticated,
    displayName: options.displayName ?? null,
    bodyHtml,
    pathname: `${p}/events/${id}/gallery`,
  });
}
