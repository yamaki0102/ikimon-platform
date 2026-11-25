import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_EVENT_CSS, eventTiming, loadEventCore, phaseChip, renderEventFacts, renderEventHero, EVENT_ICON_SHARE } from "./zukanEventUi";

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
  const event = await loadEventCore(db, eventId);
  if (!event) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const encodedEvent = encodeURIComponent(eventId);
  const timing = eventTiming(event, lang);
  const placeHref = event.placeId ? `${prefix}/places/${encodeURIComponent(event.placeId)}` : null;
  const peopleLabel = event.participants !== null && event.participants > 0 ? (isEn ? `${event.participants} joining` : `参加予定 ${event.participants}人`) : "";
  const facts: Array<[string, string]> = [[isEn ? "When" : "日時", timing.whenLabel]];
  if (event.placeLabel) facts.push([isEn ? "Place" : "場所", event.placeLabel]);
  if (event.organizerLabel) facts.push([isEn ? "Host" : "主催", event.organizerLabel]);
  facts.push([isEn ? "Bring" : "持ち物", event.bring ?? (isEn ? "Comfortable shoes, water, a charged phone" : "動きやすい靴・飲み物・充電したスマートフォン")]);
  const primary =
    timing.phase === "today"
      ? { href: `${prefix}/events/${encodedEvent}/day`, label: isEn ? "Open today's page" : "当日のページを開く", note: isEn ? "Add photos to today's album." : "当日のアルバムに写真を加えられます。" }
      : timing.phase === "past"
        ? { href: `${prefix}/events/${encodedEvent}/album`, label: isEn ? "See the album" : "アルバムを見る", note: isEn ? "Photos from the day gather in this event's album." : "当日の写真は、このイベントのアルバムに集まります。" }
        : { href: `${prefix}/events/${encodedEvent}/confirm`, label: isEn ? "Join" : "参加する", note: isEn ? "Once you join, you can add photos to the day's album." : "参加すると、当日のアルバムに写真を加えられます。" };

  const bodyHtml = `<style>${ZUKAN_EVENT_CSS}</style>
  <div class="ze" data-event-view="f1-f2">
    <div class="ze-main">
      ${renderEventHero({
        title: event.title,
        chip: phaseChip(timing.phase, timing.dateLabel, isEn),
        sub: peopleLabel,
        backHref: `${prefix}/events/nearby`,
        backLabel: isEn ? "Back to events" : "イベント一覧へ",
        shareHref: `${prefix}/events/${encodedEvent}/share`,
        shareLabel: isEn ? "Share" : "共有する",
      })}
      <section>
        ${renderEventFacts(facts)}
        <p class="ze-text" style="margin-top:16px">${escapeHtml(event.summary ?? "")}${event.summary ? " " : ""}${isEn ? "Photos from the day gather in this event's album." : "当日の写真は、このイベントのアルバムに集まります。"}</p>
        ${placeHref ? `<p style="margin:12px 0 0"><a href="${escapeHtml(placeHref)}">${isEn ? "View venue place" : "開催場所を見る"}</a></p>` : ""}
      </section>
      <aside class="ze-cta">
        <h2>${isEn ? "Join this event" : "参加の申し込み"}</h2>
        <a class="ze-btn" href="${escapeHtml(primary.href)}">${escapeHtml(primary.label)}</a>
        <a class="ze-btn is-outline" href="${escapeHtml(`${prefix}/events/${encodedEvent}/share`)}">${EVENT_ICON_SHARE}${isEn ? "Share" : "共有する"}</a>
        <p class="ze-box">${escapeHtml(primary.note)} ${isEn ? "Only your field name is shared with the organizer." : "主催者に伝わるのはフィールドネームまでです。"}</p>
        <a href="${escapeHtml(`${prefix}/events/${encodedEvent}/details`)}">${isEn ? "Event details" : "詳しい案内を見る"}</a>
      </aside>
    </div>
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
