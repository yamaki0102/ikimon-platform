import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

type MentorStripCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  cta: string;
};

const copyByLang: Record<SiteLang, MentorStripCopy> = {
  ja: {
    eyebrow: "あとから読み返す人",
    heading: "あなたのページを、専門家が読み直すことがあります。",
    lead: "観察には、別の lane で同定をつけ直す専門家がいます。記録は、あなた1人で完結しなくて大丈夫。書いたあとから、誰かが受け取ります。",
    cta: "専門家 lane を見る",
  },
  en: {
    eyebrow: "Who rereads later",
    heading: "Your page may be reread by a specialist.",
    lead: "Observations have a separate lane where specialists revisit identifications. The record does not have to be complete by you alone — someone picks it up after you.",
    cta: "See the specialist lane",
  },
  es: {
    eyebrow: "Quienes vuelven a leer",
    heading: "Tu página puede ser releída por un especialista.",
    lead: "Las observaciones tienen otro carril donde especialistas revisan las identificaciones. El registro no necesita estar completo solo por ti — alguien lo recoge después.",
    cta: "Ver el carril de especialistas",
  },
  "pt-BR": {
    eyebrow: "Quem relê depois",
    heading: "Sua página pode ser relida por um especialista.",
    lead: "As observações têm outro carril onde especialistas revisam as identificações. O registro não precisa estar completo só por você — alguém o recebe depois.",
    cta: "Ver o carril de especialistas",
  },
};

export function renderMentorStrip(basePath: string, lang: SiteLang): string {
  const copy = copyByLang[lang];
  const href = appendLangToHref(withBasePath(basePath, "/specialist/id-workbench"), lang);

  return `<section class="section ms-section" aria-labelledby="ms-heading">
    <div class="ms-card">
      <div class="ms-copy">
        <span class="ms-eyebrow">${escapeHtml(copy.eyebrow)}</span>
        <h2 id="ms-heading" class="ms-heading">${escapeHtml(copy.heading)}</h2>
        <p class="ms-lead">${escapeHtml(copy.lead)}</p>
      </div>
      <div class="ms-actions">
        <a class="inline-link" href="${escapeHtml(href)}" data-kpi-action="mentorstrip:specialist-lane">${escapeHtml(copy.cta)}</a>
      </div>
    </div>
  </section>`;
}

export const MENTOR_STRIP_STYLES = `
  .ms-section { margin-top: 24px; }
  .ms-card {
    padding: 24px 28px 22px;
    border-radius: 24px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(15,23,42,.06);
    border-left: 3px solid rgba(99,102,241,.45);
    box-shadow: 0 12px 26px rgba(15,23,42,.04);
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
  }
  @media (min-width: 860px) {
    .ms-card { grid-template-columns: minmax(0, 1.4fr) auto; align-items: end; gap: 28px; }
    .ms-actions { justify-self: end; }
  }
  .ms-copy { display: flex; flex-direction: column; gap: 6px; max-width: 60ch; }
  .ms-eyebrow {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(99,102,241,.1);
    color: #4338ca;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .ms-heading {
    margin: 8px 0 0;
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.5;
    letter-spacing: -.01em;
    font-weight: 900;
    color: #0f172a;
  }
  .ms-lead { margin: 4px 0 0; color: #475569; font-size: 14px; line-height: 1.85; text-wrap: pretty; }
`;
