import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_EVENT_CSS, eventTiming, loadEventCore, phaseChip, renderEventHero, renderEventSubHead } from "./zukanEventUi";

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
  const event = await loadEventCore(db, eventId);
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const fieldName = resolveServerFieldName(session, lang);
  const encodedEvent = encodeURIComponent(eventId);
  const timing = eventTiming(event, lang);

  let bodyHtml = "";
  let pageTitle = event.title;

  if (view === "confirm") {
    pageTitle = isEn ? `Confirm participation — ${event.title}` : `参加確認 — ${event.title}`;
    bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f7" style="max-width:720px">
      ${renderEventSubHead(isEn ? "Confirm to join" : "参加の確認", `${prefix}/events/${encodedEvent}/preview`, isEn ? "Back to the event" : "イベントに戻る")}
      <div class="ze-summary"><span class="ze-summary-thumb" aria-hidden="true"></span><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(timing.whenLabel)}</small></div></div>
      <p class="ze-box">${
        isEn
          ? `When you join, the organizer sees your <strong>field name</strong> (${escapeHtml(fieldName)}). It is only for roll call and safety. Your real name is never shared.`
          : `申し込むと、主催の人には、あなたの<strong>フィールドネーム</strong>（${escapeHtml(fieldName)}）が伝わります。点呼と安全の確認のためです。本名は伝わりません。`
      }</p>
      <p class="ze-note">${isEn ? "Only your field name is shared with the organizer." : "主催者に伝わるのはフィールドネームまでです（メールアドレスや本名は伝わりません）。"} ${isEn ? "Once you join, you can add photos to the day's album." : "参加すると、当日のアルバムに写真を加えられます。"}</p>
      ${
        authenticated
          ? `<button type="button" class="ze-btn" id="event-confirm-btn">${isEn ? "Confirm and join" : "参加を確定する"}</button>`
          : `<a class="ze-btn" href="${escapeHtml(`${prefix}/login?redirect=${encodeURIComponent(`${prefix}/events/${eventId}/confirm`)}`)}">${isEn ? "Sign in to join" : "ログインして参加する"}</a>`
      }
      <p class="ze-note" id="event-confirm-status" aria-live="polite"></p>
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
    </div>`;
  } else {
    pageTitle = isEn ? `Joined — ${event.title}` : `参加済み — ${event.title}`;
    bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style><div class="ze" data-event-view="f8" style="max-width:720px">
      ${renderEventHero({
        title: event.title,
        chip: phaseChip(timing.phase, timing.dateLabel, isEn),
        backHref: `${prefix}/events/${encodedEvent}/preview`,
        backLabel: isEn ? "Back to the event" : "イベントに戻る",
        shareHref: `${prefix}/events/${encodedEvent}/share`,
        shareLabel: isEn ? "Share" : "共有する",
      })}
      <p class="ze-status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>${isEn ? "You have joined this event." : "参加の確認が完了しました。"}</p>
      <p class="ze-note">${isEn ? "Shared field name" : "主催者に伝わる名前"}: <strong>${escapeHtml(fieldName)}</strong></p>
      <p class="ze-note">${isEn ? "We will remind you the day before. On the day, add photos from the event page." : "近づいたら、前日にお知らせします。当日はこの画面から写真を加えられます。"}</p>
      <a class="ze-btn" href="${escapeHtml(`${prefix}/events/${encodedEvent}/day`)}">${isEn ? "Open event day page" : "当日のページを開く"}</a>
      <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/record?eventSessionId=${encodedEvent}`)}">${isEn ? "Capture observation" : "観察を記録する"}</a>
      <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/details`)}">${isEn ? "Event details" : "詳細情報を見る"}</a>
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
