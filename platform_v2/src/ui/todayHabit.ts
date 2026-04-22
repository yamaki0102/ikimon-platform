import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingSnapshot } from "../services/readModels.js";
import { escapeHtml } from "./siteShell.js";

type TodayHabitCopy = {
  eyebrow: string;
  guestHeading: string;
  guestLead: string;
  guestCta: string;
  loggedInEyebrow: string;
  loggedInHeadingToday: (count: number) => string;
  loggedInHeadingNoToday: string;
  loggedInLeadFresh: (streak: number) => string;
  loggedInLeadResting: (lastDays: number) => string;
  loggedInLeadFirstTime: string;
  weekLabel: (count: number) => string;
  streakLabel: (days: number) => string;
  nudgeWriteToday: string;
  nudgeKeepStreak: (next: number) => string;
  nudgeReturn: (gap: number) => string;
  nudgeFirstPage: string;
  ctaContinue: string;
  ctaReturn: string;
  ctaStart: string;
};

const copyByLang: Record<SiteLang, TodayHabitCopy> = {
  ja: {
    eyebrow: "今日のあなた",
    guestHeading: "今日の記録を、1 件残す",
    guestLead: "ここには、今日書いた件数や最近の続き具合が出ます。まずは 1 件残すと、次に書く理由が見えやすくなります。",
    guestCta: "最初の 1 件を残す",
    loggedInEyebrow: "今日のあなた",
    loggedInHeadingToday: (count) => `今日は ${count} 件記録しました。`,
    loggedInHeadingNoToday: "今日はまだ記録していません。",
    loggedInLeadFresh: (streak) => `${streak} 日続けて記録しています。同じ場所の変化を見返しやすくなっています。`,
    loggedInLeadResting: (lastDays) => `前回の記録から ${lastDays} 日です。同じ場所でも季節が変わっているかもしれません。`,
    loggedInLeadFirstTime: "最初の 1 件を残すと、ここに今日と今週の積み上がりが出ます。",
    weekLabel: (count) => `今週 ${count} 件`,
    streakLabel: (days) => `${days} 日続けて`,
    nudgeWriteToday: "今日の 1 件を残す",
    nudgeKeepStreak: (next) => `もう 1 件で、${next} 日続けて`,
    nudgeReturn: (gap) => `${gap} 日ぶりに 1 件`,
    nudgeFirstPage: "最初の 1 件を残す",
    ctaContinue: "ノートを見る",
    ctaReturn: "また記録する",
    ctaStart: "始める",
  },
  en: {
    eyebrow: "Your today",
    guestHeading: "Your today, and what comes next",
    guestLead: "Once you start a notebook, this is where today, this week, and your next reason to write will live.",
    guestCta: "Start the notebook",
    loggedInEyebrow: "Your today",
    loggedInHeadingToday: (count) => `You wrote ${count} entr${count === 1 ? "y" : "ies"} today.`,
    loggedInHeadingNoToday: "Nothing in today's page yet.",
    loggedInLeadFresh: (streak) => `${streak} days in a row. The same trail is starting to look a bit different.`,
    loggedInLeadResting: (lastDays) => `${lastDays} days since your last page. The season may have moved while you were away.`,
    loggedInLeadFirstTime: "Write the first page and your continuation will start showing up here.",
    weekLabel: (count) => `${count} this week`,
    streakLabel: (days) => `${days}-day streak`,
    nudgeWriteToday: "Write 1 entry today",
    nudgeKeepStreak: (next) => `1 more for a ${next}-day streak`,
    nudgeReturn: (gap) => `Write again after ${gap} days`,
    nudgeFirstPage: "Write the first page",
    ctaContinue: "Keep writing",
    ctaReturn: "Write again",
    ctaStart: "Start",
  },
  es: {
    eyebrow: "Tu hoy",
    guestHeading: "Tu hoy, y lo que sigue",
    guestLead: "Cuando empieces el cuaderno, aquí aparecerán hoy, esta semana y tu próxima razón para escribir.",
    guestCta: "Comenzar el cuaderno",
    loggedInEyebrow: "Tu hoy",
    loggedInHeadingToday: (count) => `Hoy escribiste ${count} ${count === 1 ? "entrada" : "entradas"}.`,
    loggedInHeadingNoToday: "Hoy aún no has escrito.",
    loggedInLeadFresh: (streak) => `${streak} días seguidos. El mismo camino empieza a verse distinto.`,
    loggedInLeadResting: (lastDays) => `${lastDays} días desde tu última página. La estación pudo haberse movido mientras estabas fuera.`,
    loggedInLeadFirstTime: "Escribe la primera página y tu continuación empezará a aparecer aquí.",
    weekLabel: (count) => `${count} esta semana`,
    streakLabel: (days) => `Racha de ${days} días`,
    nudgeWriteToday: "Escribir 1 entrada hoy",
    nudgeKeepStreak: (next) => `1 más para una racha de ${next} días`,
    nudgeReturn: (gap) => `Escribir de nuevo tras ${gap} días`,
    nudgeFirstPage: "Escribir la primera página",
    ctaContinue: "Seguir escribiendo",
    ctaReturn: "Volver a escribir",
    ctaStart: "Comenzar",
  },
  "pt-BR": {
    eyebrow: "Seu hoje",
    guestHeading: "Seu hoje, e o que vem em seguida",
    guestLead: "Quando você começar o caderno, aqui aparecerão hoje, esta semana e o seu próximo motivo para escrever.",
    guestCta: "Começar o caderno",
    loggedInEyebrow: "Seu hoje",
    loggedInHeadingToday: (count) => `Hoje você escreveu ${count} ${count === 1 ? "entrada" : "entradas"}.`,
    loggedInHeadingNoToday: "Hoje ainda não escreveu nada.",
    loggedInLeadFresh: (streak) => `${streak} dias seguidos. O mesmo caminho começa a parecer diferente.`,
    loggedInLeadResting: (lastDays) => `${lastDays} dias desde a última página. A estação pode ter se movido enquanto você esteve fora.`,
    loggedInLeadFirstTime: "Escreva a primeira página e a sua continuação começará a aparecer aqui.",
    weekLabel: (count) => `${count} esta semana`,
    streakLabel: (days) => `Sequência de ${days} dias`,
    nudgeWriteToday: "Escrever 1 entrada hoje",
    nudgeKeepStreak: (next) => `Mais 1 para sequência de ${next} dias`,
    nudgeReturn: (gap) => `Escrever de novo depois de ${gap} dias`,
    nudgeFirstPage: "Escrever a primeira página",
    ctaContinue: "Continuar escrevendo",
    ctaReturn: "Escrever de novo",
    ctaStart: "Começar",
  },
};

export function renderTodayHabit(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
): string {
  const copy = copyByLang[lang];
  const isLoggedIn = Boolean(snapshot.viewerUserId);
  const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
  const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);

  if (!isLoggedIn) {
    return `<section class="section th-card th-guest" aria-labelledby="th-heading">
      <div class="th-head">
        <span class="th-eyebrow">${escapeHtml(copy.eyebrow)}</span>
        <h2 id="th-heading" class="th-heading">${escapeHtml(copy.guestHeading)}</h2>
        <p class="th-lead">${escapeHtml(copy.guestLead)}</p>
      </div>
      <div class="th-actions">
        <a class="btn btn-solid" href="${escapeHtml(recordHref)}" data-kpi-action="todayhabit:guest-start">${escapeHtml(copy.guestCta)}</a>
      </div>
    </section>`;
  }

  // habit is computed server-side from visits (not myFeed), so streak is
  // accurate beyond the feed page size. Fall back to zeros if the DB query
  // failed for this request.
  const habit = snapshot.habit ?? {
    todayCount: 0,
    thisWeekCount: 0,
    activeDaysLast60: 0,
    daysSinceLast: null,
    streak: 0,
  };
  const hasAnyHistory = habit.daysSinceLast !== null;

  let heading: string;
  let lead: string;
  let nudgeLabel: string;
  let nudgeHref: string;
  let kpiAction: string;

  if (!hasAnyHistory) {
    heading = copy.loggedInHeadingNoToday;
    lead = copy.loggedInLeadFirstTime;
    nudgeLabel = copy.nudgeFirstPage;
    nudgeHref = recordHref;
    kpiAction = "todayhabit:first-page";
  } else if (habit.todayCount > 0) {
    heading = copy.loggedInHeadingToday(habit.todayCount);
    lead = copy.loggedInLeadFresh(Math.max(habit.streak, 1));
    nudgeLabel = copy.ctaContinue;
    nudgeHref = notesHref;
    kpiAction = "todayhabit:continue";
  } else if (habit.daysSinceLast !== null && habit.daysSinceLast >= 7) {
    heading = copy.loggedInHeadingNoToday;
    lead = copy.loggedInLeadResting(habit.daysSinceLast);
    nudgeLabel = copy.nudgeReturn(habit.daysSinceLast);
    nudgeHref = recordHref;
    kpiAction = "todayhabit:return";
  } else if (habit.streak >= 1) {
    heading = copy.loggedInHeadingNoToday;
    lead = copy.loggedInLeadFresh(habit.streak);
    nudgeLabel = copy.nudgeKeepStreak(habit.streak + 1);
    nudgeHref = recordHref;
    kpiAction = "todayhabit:keep-streak";
  } else {
    heading = copy.loggedInHeadingNoToday;
    lead = habit.daysSinceLast !== null
      ? copy.loggedInLeadResting(habit.daysSinceLast)
      : copy.loggedInLeadFirstTime;
    nudgeLabel = copy.nudgeWriteToday;
    nudgeHref = recordHref;
    kpiAction = "todayhabit:write-today";
  }

  const stats: Array<{ value: number; label: string; key: string }> = [];
  if (habit.streak > 0) {
    stats.push({ value: habit.streak, label: copy.streakLabel(habit.streak), key: "streak" });
  }
  if (habit.thisWeekCount > 0) {
    stats.push({ value: habit.thisWeekCount, label: copy.weekLabel(habit.thisWeekCount), key: "week" });
  }

  const statsHtml = stats.length
    ? `<div class="th-stats">${stats
        .map(
          (s) => `<div class="th-stat" data-key="${s.key}">
            <strong>${s.value}</strong>
            <span>${escapeHtml(s.label)}</span>
          </div>`,
        )
        .join("")}</div>`
    : "";

  return `<section class="section th-card" aria-labelledby="th-heading">
    <div class="th-head">
      <span class="th-eyebrow">${escapeHtml(copy.loggedInEyebrow)}</span>
      <h2 id="th-heading" class="th-heading">${escapeHtml(heading)}</h2>
      <p class="th-lead">${escapeHtml(lead)}</p>
    </div>
    ${statsHtml}
    <div class="th-actions">
      <a class="btn btn-solid" href="${escapeHtml(nudgeHref)}" data-kpi-action="${kpiAction}">${escapeHtml(nudgeLabel)}</a>
    </div>
  </section>`;
}

export const TODAY_HABIT_STYLES = `
  .th-card {
    margin-top: 24px;
    padding: 26px 28px 24px;
    border-radius: 26px;
    background: linear-gradient(160deg, #ffffff 0%, #ecfdf5 100%);
    border: 1px solid rgba(16,185,129,.14);
    box-shadow: 0 18px 38px rgba(15,23,42,.06);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .th-card.th-guest {
    background: linear-gradient(160deg, #ffffff 0%, #f8fafc 100%);
    border-color: rgba(15,23,42,.06);
  }
  .th-head { display: flex; flex-direction: column; gap: 6px; max-width: 60ch; }
  .th-eyebrow {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(16,185,129,.12);
    color: #047857;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .th-heading {
    margin: 8px 0 0;
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(22px, 2.6vw, 28px);
    line-height: 1.42;
    letter-spacing: -.01em;
    font-weight: 900;
    color: #0f172a;
    text-wrap: balance;
  }
  .th-lead {
    margin: 6px 0 0;
    color: #475569;
    font-size: 15px;
    line-height: 1.85;
    text-wrap: pretty;
  }
  .th-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    align-items: baseline;
  }
  .th-stat {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 14px;
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(15,23,42,.05);
  }
  .th-stat strong {
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #047857;
    letter-spacing: -.02em;
  }
  .th-stat span { font-size: 12px; font-weight: 700; color: #475569; }
  .th-actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .th-actions .btn { padding: 12px 22px; }
  @media (max-width: 720px) {
    .th-card { padding: 22px 20px 20px; }
  }
`;
