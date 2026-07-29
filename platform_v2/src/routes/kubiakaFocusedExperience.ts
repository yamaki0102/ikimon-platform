import type { FastifyInstance, FastifyRequest } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertAuthRateLimit, assertSameOriginRequest } from "../services/authSecurity.js";
import { upsertObservation, type ObservationUpsertInput } from "../services/observationWrite.js";
import { invalidateUserVisibleSnapshots } from "../services/snapshotInvalidation.js";
import { assertSessionUser } from "../services/writeGuards.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

export const KUBIAKA_EXPERIENCE_KEY = "kubiaka-watch";
export const KUBIAKA_ENTRY_PATH = "/kubiaka";
export const KUBIAKA_RECORD_PATH = "/kubiaka/record";
export const KUBIAKA_MEMBER_PATH = "/kubiaka/me";
export const KUBIAKA_GENERIC_UPSERT_PATH = "/api/v1/observations/upsert";
export const KUBIAKA_UPSERT_PATH = "/api/v1/kubiaka/observations/upsert";
export const KUBIAKA_CONTEXT_VERSION = "kubiaka-private-entry-v1";
export const KUBIAKA_PROTOCOL_PROFILE = "casual-sakura-photo-v1";
export const KUBIAKA_ACKNOWLEDGEMENT_LABEL = "Private acknowledgement";

const PAGE_STYLES = `
.kubiaka-page{display:grid;gap:22px;max-width:820px;margin:0 auto;padding:12px 0 72px}
.kubiaka-hero,.kubiaka-card{border:1px solid rgba(20,63,46,.12);border-radius:28px;background:#fff;padding:clamp(22px,5vw,42px);box-shadow:0 18px 50px rgba(20,63,46,.07)}
.kubiaka-hero{background:linear-gradient(145deg,#f6fbf6,#fff8f1)}
.kubiaka-eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;color:#8b3d31;text-transform:uppercase}
.kubiaka-page h1,.kubiaka-page h2{margin:8px 0 10px;line-height:1.25;color:#17211b}
.kubiaka-page h1{font-size:clamp(30px,7vw,50px)}
.kubiaka-page h2{font-size:clamp(22px,5vw,31px)}
.kubiaka-page p{margin:0;color:#55615a;line-height:1.85}
.kubiaka-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.kubiaka-primary,.kubiaka-secondary{min-height:52px;padding:0 22px;border-radius:999px;font:inherit;font-weight:900;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer}
.kubiaka-primary{border:0;background:#8b3d31;color:#fff}
.kubiaka-secondary{border:1px solid rgba(20,63,46,.18);background:#fff;color:#143f2e}
.kubiaka-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
.kubiaka-step{padding:18px;border-radius:20px;background:#f7f7f3}
.kubiaka-step strong{display:block;margin-bottom:6px;color:#17211b}
.kubiaka-note{padding:16px 18px;border-left:4px solid #8b3d31;background:#fff8f1;border-radius:12px;color:#5d504a;line-height:1.75}
.kubiaka-record-page .global-record-launcher{display:none!important}
.kubiaka-record-page .site-core-nav .is-capture{display:none!important}
.kubiaka-record-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere;background:#f7f7f3;border-radius:12px;padding:12px;margin-top:14px;color:#37423c}
.kubiaka-private{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;font-weight:800;color:#143f2e}
@media(max-width:680px){.kubiaka-steps{grid-template-columns:1fr}.kubiaka-hero,.kubiaka-card{border-radius:22px}.kubiaka-actions>*{width:100%}}
`;

type KubiakaCopy = {
  landingTitle: string;
  landingLead: string;
  landingAction: string;
  landingSecondary: string;
  recordTitle: string;
  recordLead: string;
  captureAction: string;
  memberTitle: string;
  memberLead: string;
  privateLabel: string;
};

function copyFor(lang: SiteLang): KubiakaCopy {
  const localized: Record<SiteLang, KubiakaCopy> = {
    ja: {
      landingTitle: "サクラの今を、写真で残そう。",
      landingLead: "虫を見つけていなくても大丈夫です。サクラの幹や根元を1〜6枚撮ると、地域の変化を見守る記録になります。",
      landingAction: "サクラを撮る",
      landingSecondary: "自分の記録を見る",
      recordTitle: "サクラの幹や根元を撮る",
      recordLead: "全体が分かる写真と、気になった部分の近い写真があると役立ちます。クビアカツヤカミキリだと断定する必要はありません。",
      captureAction: "カメラを開く",
      memberTitle: "記録を受け付けました",
      memberLead: "写真は非公開の記録として保存されました。確認結果や追加撮影のお願いを出せる仕組みは、次の段階で接続します。",
      privateLabel: "初期状態は非公開・外部送信なし",
    },
    en: {
      landingTitle: "Photograph a cherry tree today.",
      landingLead: "You do not need to find an insect. One to six photos of the trunk or base can become a useful local record.",
      landingAction: "Photograph a tree",
      landingSecondary: "My records",
      recordTitle: "Photograph the trunk and base",
      recordLead: "A wider photo and a close photo of anything unusual are useful. You do not need to identify Aromia bungii yourself.",
      captureAction: "Open camera",
      memberTitle: "Record received",
      memberLead: "The photos were saved as a private record. Feedback and follow-up requests will be connected in a later release.",
      privateLabel: "Private by default; no external delivery",
    },
    es: {
      landingTitle: "Fotografia hoy un cerezo.",
      landingLead: "No necesitas encontrar un insecto. De una a seis fotos del tronco o la base pueden ser un registro util.",
      landingAction: "Fotografiar un arbol",
      landingSecondary: "Mis registros",
      recordTitle: "Fotografia el tronco y la base",
      recordLead: "Ayudan una foto general y otra cercana de cualquier detalle. No necesitas identificar la especie.",
      captureAction: "Abrir camara",
      memberTitle: "Registro recibido",
      memberLead: "Las fotos se guardaron como registro privado. La respuesta se conectara en una fase posterior.",
      privateLabel: "Privado por defecto; sin envio externo",
    },
    "pt-BR": {
      landingTitle: "Fotografe uma cerejeira hoje.",
      landingLead: "Voce nao precisa encontrar um inseto. De uma a seis fotos do tronco ou da base podem virar um registro util.",
      landingAction: "Fotografar uma arvore",
      landingSecondary: "Meus registros",
      recordTitle: "Fotografe o tronco e a base",
      recordLead: "Uma foto geral e outra aproximada ajudam. Voce nao precisa identificar a especie.",
      captureAction: "Abrir camera",
      memberTitle: "Registro recebido",
      memberLead: "As fotos foram salvas como registro privado. O retorno sera conectado em uma fase posterior.",
      privateLabel: "Privado por padrao; sem envio externo",
    },
  };
  return localized[lang] ?? localized.ja;
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function basePathFor(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function localizedHref(basePath: string, path: string, lang: SiteLang): string {
  return appendLangToHref(withBasePath(basePath, path), lang);
}

function safeRecordId(value: unknown): string | null {
  const recordId = String(value ?? "").trim();
  return /^[A-Za-z0-9:._-]{1,180}$/.test(recordId) ? recordId : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function rewriteKubiakaUpsertUrl(url: string): string {
  return url.includes(KUBIAKA_GENERIC_UPSERT_PATH)
    ? url.replace(KUBIAKA_GENERIC_UPSERT_PATH, KUBIAKA_UPSERT_PATH)
    : url;
}

export function buildKubiakaObservationInput(
  input: ObservationUpsertInput,
  userId: string,
): ObservationUpsertInput {
  const incomingSourcePayload = objectRecord(input.sourcePayload);
  const incomingRights = objectRecord(input.dataRights);
  return {
    ...input,
    userId,
    visitMode: "manual",
    completeChecklistFlag: false,
    sourcePayload: {
      ...incomingSourcePayload,
      source: "kubiaka_private_entry",
      experience_key: KUBIAKA_EXPERIENCE_KEY,
      experience_context_version: KUBIAKA_CONTEXT_VERSION,
      entrypoint: KUBIAKA_RECORD_PATH,
      protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
      survey_non_detection_allowed: false,
      external_routing_allowed: false,
    },
    dataRights: {
      ...incomingRights,
      recordConsent: "private",
      researchUseConsent: "none",
      enterpriseReportConsent: "none",
      datasetLicense: null,
      mediaLicense: "all_rights_reserved",
      externalExportAllowed: false,
      areaProfileUseConsent: "none",
      publicAggregationAllowed: false,
      publicProfileAttributionMode: "hidden",
      consentSource: "default",
      sourcePayload: {
        experience_key: KUBIAKA_EXPERIENCE_KEY,
        enforced_by: KUBIAKA_UPSERT_PATH,
      },
    },
  };
}

function recordContextScript(basePath: string, lang: SiteLang): string {
  const memberPath = localizedHref(basePath, KUBIAKA_MEMBER_PATH, lang);
  return `<script>
(function(){
  var nativeFetch = window.fetch.bind(window);
  var lastRecord = null;
  var genericSuffix = ${JSON.stringify(KUBIAKA_GENERIC_UPSERT_PATH)};
  var dedicatedSuffix = ${JSON.stringify(KUBIAKA_UPSERT_PATH)};
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var target = url && url.indexOf(genericSuffix) >= 0 ? url.replace(genericSuffix, dedicatedSuffix) : url;
    var response = await nativeFetch(target || input, init);
    if (target && target.indexOf(dedicatedSuffix) >= 0) {
      response.clone().json().then(function(data){
        if (!data || !data.ok) return;
        lastRecord = String(data.occurrenceId || data.visitId || '');
        try { sessionStorage.setItem('kubiaka:last-record', lastRecord); } catch (_) {}
      }).catch(function(){});
    }
    return response;
  };
  function addAcknowledgementLink(){
    var status = document.querySelector('[data-global-record-camera-status]');
    if (!status || status.querySelector('[data-kubiaka-acknowledgement-link]')) return;
    if (status.textContent.indexOf('保存しました') < 0 && status.textContent.indexOf('saved') < 0) return;
    var id = lastRecord;
    try { id = id || sessionStorage.getItem('kubiaka:last-record') || ''; } catch (_) {}
    var link = document.createElement('a');
    link.setAttribute('data-kubiaka-acknowledgement-link', 'true');
    link.className = 'kubiaka-secondary';
    link.href = ${JSON.stringify(memberPath)} + (id ? '?record=' + encodeURIComponent(id) : '');
    link.textContent = ${JSON.stringify(lang === "ja" ? "受付内容を見る" : "View acknowledgement")};
    status.appendChild(link);
  }
  document.addEventListener('DOMContentLoaded', function(){
    var start = document.querySelector('[data-kubiaka-capture-start]');
    if (start && new URL(location.href).searchParams.get('start') === 'photo') start.click();
    var status = document.querySelector('[data-global-record-camera-status]');
    if (status) new MutationObserver(addAcknowledgementLink).observe(status, {childList:true,subtree:true,characterData:true});
  });
})();
</script>`;
}

function landingHtml(basePath: string, lang: SiteLang, signedIn: boolean): string {
  const copy = copyFor(lang);
  const recordHref = localizedHref(basePath, KUBIAKA_RECORD_PATH, lang);
  const recordsHref = localizedHref(basePath, signedIn ? KUBIAKA_MEMBER_PATH : "/login?redirect=%2Fkubiaka%2Fme", lang);
  return `<div class="kubiaka-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">ZUKAN / Kubiaka watch</div>
      <h1>${escapeHtml(copy.landingTitle)}</h1>
      <p>${escapeHtml(copy.landingLead)}</p>
      <div class="kubiaka-actions">
        <a class="kubiaka-primary" href="${escapeHtml(recordHref)}">${escapeHtml(copy.landingAction)}</a>
        <a class="kubiaka-secondary" href="${escapeHtml(recordsHref)}">${escapeHtml(copy.landingSecondary)}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
    <section class="kubiaka-card">
      <div class="kubiaka-eyebrow">3 steps</div>
      <h2>${escapeHtml(lang === "ja" ? "見つけなくても、記録になる" : "A useful record without an identification")}</h2>
      <div class="kubiaka-steps">
        <div class="kubiaka-step"><strong>1. ${escapeHtml(lang === "ja" ? "サクラを見る" : "Look at the tree")}</strong><p>${escapeHtml(lang === "ja" ? "幹と根元を無理のない距離から見ます。" : "Observe the trunk and base safely.")}</p></div>
        <div class="kubiaka-step"><strong>2. ${escapeHtml(lang === "ja" ? "1〜6枚撮る" : "Take 1–6 photos")}</strong><p>${escapeHtml(lang === "ja" ? "全体と、気になる部分を撮ります。" : "Include a wider and a closer view.")}</p></div>
        <div class="kubiaka-step"><strong>3. ${escapeHtml(lang === "ja" ? "そのまま送る" : "Send as-is")}</strong><p>${escapeHtml(lang === "ja" ? "虫の名前を決める必要はありません。" : "No identification is required.")}</p></div>
      </div>
    </section>
    <p class="kubiaka-note">${escapeHtml(lang === "ja" ? "木を傷つけたり、虫や木くずを持ち帰ったりせず、土地の管理ルールに従ってください。" : "Do not damage the tree or remove insects or material; follow the site manager's rules.")}</p>
  </div>`;
}

function recordHtml(basePath: string, lang: SiteLang): string {
  const copy = copyFor(lang);
  return `<div class="kubiaka-page kubiaka-record-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">Private contribution</div>
      <h1>${escapeHtml(copy.recordTitle)}</h1>
      <p>${escapeHtml(copy.recordLead)}</p>
      <div class="kubiaka-actions">
        <button class="kubiaka-primary" type="button" data-kubiaka-capture-start data-global-record-trigger="photo" aria-haspopup="dialog">${escapeHtml(copy.captureAction)}</button>
        <a class="kubiaka-secondary" href="${escapeHtml(localizedHref(basePath, KUBIAKA_ENTRY_PATH, lang))}">${escapeHtml(lang === "ja" ? "説明に戻る" : "Back")}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
    <p class="kubiaka-note">${escapeHtml(lang === "ja" ? "位置情報は記録の場所を残すために使います。公開地図や外部機関への送信には使いません。" : "Location is used to save the record. It is not sent to a public map or an external recipient.")}</p>
  </div>${recordContextScript(basePath, lang)}`;
}

function memberHtml(basePath: string, lang: SiteLang, recordId: string | null): string {
  const copy = copyFor(lang);
  return `<div class="kubiaka-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">${escapeHtml(KUBIAKA_ACKNOWLEDGEMENT_LABEL)}</div>
      <h1>${escapeHtml(copy.memberTitle)}</h1>
      <p>${escapeHtml(copy.memberLead)}</p>
      ${recordId ? `<div class="kubiaka-record-id">Record: ${escapeHtml(recordId)}</div>` : ""}
      <div class="kubiaka-actions">
        <a class="kubiaka-primary" href="${escapeHtml(localizedHref(basePath, `${KUBIAKA_RECORD_PATH}?start=photo`, lang))}">${escapeHtml(lang === "ja" ? "もう一度撮る" : "Photograph another")}</a>
        <a class="kubiaka-secondary" href="${escapeHtml(localizedHref(basePath, "/records?view=mine", lang))}">${escapeHtml(lang === "ja" ? "自分の記録を見る" : "My records")}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
  </div>`;
}

async function requireSession(request: FastifyRequest): Promise<{ userId: string } | null> {
  const session = await getSessionFromCookie(request.headers.cookie);
  return session ? { userId: session.userId } : null;
}

export async function registerKubiakaFocusedExperienceRoutes(app: FastifyInstance): Promise<void> {
  app.get(KUBIAKA_ENTRY_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await requireSession(request);
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: copyFor(lang).landingTitle,
      description: copyFor(lang).landingLead,
      lang,
      currentPath: withBasePath(basePath, requestUrl(request)),
      canonicalPath: KUBIAKA_ENTRY_PATH,
      shellClassName: "shell-layout-narrow kubiaka-experience",
      extraStyles: PAGE_STYLES,
      body: landingHtml(basePath, lang, Boolean(session)),
      footerNote: "ZUKAN / Kubiaka watch",
    });
  });

  app.get(KUBIAKA_RECORD_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await requireSession(request);
    if (!session) {
      const redirectTarget = localizedHref(basePath, KUBIAKA_RECORD_PATH, lang);
      const loginPath = localizedHref(basePath, `/login?redirect=${encodeURIComponent(redirectTarget)}`, lang);
      return reply.redirect(loginPath);
    }
    reply.type("text/html; charset=utf-8").header("Cache-Control", "private, no-store").header("Vary", "Cookie");
    return renderSiteDocument({
      basePath,
      title: copyFor(lang).recordTitle,
      description: copyFor(lang).recordLead,
      lang,
      currentPath: withBasePath(basePath, requestUrl(request)),
      noindex: true,
      minimalChrome: true,
      shellClassName: "shell-layout-narrow kubiaka-record-page",
      extraStyles: PAGE_STYLES,
      body: recordHtml(basePath, lang),
      footerNote: "ZUKAN / Kubiaka watch",
    });
  });

  app.get<{ Querystring: { record?: string } }>(KUBIAKA_MEMBER_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    const session = await requireSession(request);
    if (!session) {
      const redirectTarget = localizedHref(basePath, KUBIAKA_MEMBER_PATH, lang);
      const loginPath = localizedHref(basePath, `/login?redirect=${encodeURIComponent(redirectTarget)}`, lang);
      return reply.redirect(loginPath);
    }
    reply.type("text/html; charset=utf-8").header("Cache-Control", "private, no-store").header("Vary", "Cookie");
    return renderSiteDocument({
      basePath,
      title: copyFor(lang).memberTitle,
      description: copyFor(lang).memberLead,
      lang,
      currentPath: withBasePath(basePath, requestUrl(request)),
      noindex: true,
      minimalChrome: true,
      shellClassName: "shell-layout-narrow kubiaka-member-page",
      extraStyles: PAGE_STYLES,
      body: memberHtml(basePath, lang, safeRecordId(request.query.record)),
      footerNote: "ZUKAN / Kubiaka watch",
    });
  });

  app.post<{ Body: ObservationUpsertInput }>(KUBIAKA_UPSERT_PATH, async (request, reply) => {
    try {
      assertSameOriginRequest(request);
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = assertSessionUser(session, request.body?.userId ?? "");
      await assertAuthRateLimit(["kubiaka-observation-upsert", resolvedSession.userId, request.ip], 20, 10 * 60 * 1000);
      const input = buildKubiakaObservationInput(request.body, resolvedSession.userId);
      const result = await upsertObservation(input);
      invalidateUserVisibleSnapshots();
      return {
        ok: true,
        ...result,
        experience: {
          key: KUBIAKA_EXPERIENCE_KEY,
          contextVersion: KUBIAKA_CONTEXT_VERSION,
          privacy: "private",
          externalRouting: "denied",
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "kubiaka_observation_upsert_failed";
      const status = message === "session_required" || message === "account_disabled"
        ? 401
        : message === "same_origin_required"
          ? 403
          : message === "rate_limited"
            ? 429
            : 400;
      reply.code(status);
      return { ok: false, error: message };
    }
  });
}
