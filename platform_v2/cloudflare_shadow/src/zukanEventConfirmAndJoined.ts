import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type EventRow = {
  session_id: string;
  title: string;
  organizer_user_id: string;
  started_at: string;
};

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

function resolveServerFieldName(session: SessionLike, lang: "ja" | "en" | "es" | "pt-br"): string {
  const raw = (session?.displayName ?? "").trim();
  if (raw) return raw.slice(0, 32);
  return lang === "en" ? "Participant" : "参加者";
}

export async function handleEventConfirmOrJoinedRoute(
  eventId: string,
  view: "confirm" | "joined",
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const event = await db.prepare(
    "SELECT session_id, title, organizer_user_id, started_at FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<EventRow>();
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const fieldName = resolveServerFieldName(session, lang);

  let bodyHtml = "";
  let pageTitle = event.title;

  if (view === "confirm") {
    pageTitle = isEn ? `Confirm participation — ${event.title}` : `参加確認 — ${event.title}`;
    bodyHtml = `<section class="zt-hub-card" data-event-view="f7">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "Starts" : "開始"}: <time>${escapeHtml(event.started_at)}</time></p>
      <p><strong>${
        isEn
          ? "Only your field name is shared with the organizer."
          : "主催者に伝わるのはフィールドネームまでです（メールアドレスや本名は伝わりません）。"
      }</strong></p>
      <p>${isEn ? "Field name" : "伝わる名前"}: <strong>${escapeHtml(fieldName)}</strong></p>
      <div>${
        authenticated
          ? `<button type="button" class="zt-btn-capture" id="event-confirm-btn">${isEn ? "Confirm and join" : "この内容で参加する"}</button>`
          : `<a class="zt-btn-capture" href="${escapeHtml(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/events/${eventId}/confirm`)}`)}">${isEn ? "Sign in to join" : "ログインして参加する"}</a>`
      }</div>
      <p id="event-confirm-status" aria-live="polite"></p>
      <script>
        (() => {
          const btn = document.getElementById("event-confirm-btn");
          if (!btn) return;
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            const res = await fetch(${JSON.stringify(`/api/v1/events/${encodeURIComponent(eventId)}/confirm`)}, { method: "POST" });
            if (res.ok) {
              location.href = ${JSON.stringify(`${prefix}/events/${encodeURIComponent(eventId)}/joined`)};
            } else {
              document.getElementById("event-confirm-status").textContent = ${JSON.stringify(isEn ? "Could not confirm." : "参加確定できませんでした。")};
              btn.disabled = false;
            }
          });
        })();
      </script>
    </section>`;
  } else {
    pageTitle = isEn ? `Joined — ${event.title}` : `参加済み — ${event.title}`;
    bodyHtml = `<section class="zt-hub-card" data-event-view="f8">
      <h1>${escapeHtml(event.title)}</h1>
      <p>${isEn ? "You have joined this event." : "参加の確認が完了しました。"}</p>
      <p>${isEn ? "Shared field name" : "主催者に伝わる名前"}: <strong>${escapeHtml(fieldName)}</strong></p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(eventId)}/day`)}">${isEn ? "Open event day page" : "当日のページを開く"}</a>
        <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/record?eventSessionId=${encodeURIComponent(eventId)}`)}">${isEn ? "Capture observation" : "観察を記録する"}</a>
      </div>
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

export async function handleConfirmEventParticipation(
  eventId: string,
  _request: Request,
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session || session.banned) {
    return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
  }

  const event = await db.prepare(
    "SELECT session_id FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<{ session_id: string }>();
  if (!event) {
    return json({ ok: false, error: "event_not_found" }, 404, { "cache-control": "no-store" });
  }

  const fieldName = resolveServerFieldName(session, "ja");
  await db.prepare(
    `INSERT INTO observation_event_participants (participant_id, session_id, user_id, display_name, status)
     VALUES (?, ?, ?, ?, 'checked_in')
     ON CONFLICT(session_id, user_id) DO UPDATE SET
       display_name = excluded.display_name,
       status = 'checked_in'`
  ).bind(`part_${crypto.randomUUID()}`, eventId, session.userId, fieldName).run();

  return json({ ok: true, eventId, fieldName, status: "checked_in" }, 200, { "cache-control": "no-store" });
}
