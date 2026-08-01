import type { FastifyInstance, FastifyRequest } from "fastify";
import { getPool } from "../db.js";
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
export const KUBIAKA_MAX_PHOTOS = 6;

export type KubiakaDbQuery = <T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
) => Promise<{ rows: T[] }>;

export type OwnedKubiakaAcknowledgement = {
  recordId: string;
  visitId: string;
  photoCount: number;
};

type KubiakaCopy = {
  landingTitle: string;
  landingLead: string;
  landingAction: string;
  landingSecondary: string;
  recordTitle: string;
  recordLead: string;
  captureAction: string;
  receivedTitle: string;
  receivedLead: string;
  emptyTitle: string;
  emptyLead: string;
  privateLabel: string;
  safetyNote: string;
  locationNote: string;
  acknowledgementAction: string;
  savedNotice: string;
  restoreFailure: string;
};

const PAGE_STYLES = `
.kubiaka-page{display:grid;gap:22px;max-width:820px;margin:0 auto;padding:12px 0 72px;min-width:0}
.kubiaka-hero,.kubiaka-card{min-width:0;border:1px solid rgba(20,63,46,.12);border-radius:28px;background:#fff;padding:clamp(22px,5vw,42px);box-shadow:0 18px 50px rgba(20,63,46,.07)}
.kubiaka-hero{background:linear-gradient(145deg,#f6fbf6,#fff8f1)}
.kubiaka-eyebrow{font-size:12px;font-weight:900;letter-spacing:.12em;color:#8b3d31;text-transform:uppercase}
.kubiaka-page h1,.kubiaka-page h2{margin:8px 0 10px;line-height:1.25;color:#17211b;overflow-wrap:anywhere}
.kubiaka-page h1{font-size:clamp(30px,7vw,50px)}
.kubiaka-page h2{font-size:clamp(22px,5vw,31px)}
.kubiaka-page p{margin:0;color:#55615a;line-height:1.85;overflow-wrap:anywhere}
.kubiaka-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.kubiaka-primary,.kubiaka-secondary{min-height:52px;max-width:100%;padding:0 22px;border-radius:999px;font:inherit;font-weight:900;display:inline-flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;cursor:pointer}
.kubiaka-primary{border:0;background:#8b3d31;color:#fff}
.kubiaka-secondary{border:1px solid rgba(20,63,46,.18);background:#fff;color:#143f2e}
.kubiaka-primary:focus-visible,.kubiaka-secondary:focus-visible{outline:3px solid #143f2e;outline-offset:3px}
.kubiaka-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
.kubiaka-step{min-width:0;padding:18px;border-radius:20px;background:#f7f7f3}
.kubiaka-step strong{display:block;margin-bottom:6px;color:#17211b}
.kubiaka-note{padding:16px 18px;border-left:4px solid #8b3d31;background:#fff8f1;border-radius:12px;color:#5d504a;line-height:1.75}
.kubiaka-record-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere;background:#f7f7f3;border-radius:12px;padding:12px;margin-top:14px;color:#37423c}
.kubiaka-private{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;font-weight:800;color:#143f2e}
.global-record-launcher,.site-core-nav,[data-global-record-mode="video"]{display:none!important}
.global-record-camera-sheet{max-width:min(720px,calc(100vw - 20px))!important}
@media(max-width:680px){.kubiaka-steps{grid-template-columns:1fr}.kubiaka-hero,.kubiaka-card{border-radius:22px}.kubiaka-actions>*{width:100%}}
@media(prefers-reduced-motion:reduce){.kubiaka-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`;

function copyFor(lang: SiteLang): KubiakaCopy {
  const localized: Record<SiteLang, KubiakaCopy> = {
    ja: {
      landingTitle: "サクラの今を、写真で残そう。",
      landingLead: "虫を見つけていなくても大丈夫です。サクラの幹や根元を1〜6枚撮ると、まちの変化を見守る記録になります。",
      landingAction: "サクラを撮る",
      landingSecondary: "自分の受付を見る",
      recordTitle: "サクラの幹や根元を撮る",
      recordLead: "1枚だけでも大丈夫です。全体や気になる部分を最大6枚まで撮れます。虫の名前を決める必要はありません。",
      captureAction: "カメラ・写真を開く",
      receivedTitle: "写真を受け付けました",
      receivedLead: "写真はあなたの非公開記録として保存されています。この画面は通報・提出・永続証明ではありません。",
      emptyTitle: "まだ受付はありません",
      emptyLead: "サクラを撮って非公開保存すると、受付内容をここで確認できます。",
      privateLabel: "非公開・外部送信なし",
      safetyNote: "道路、立入禁止・私有地、足元が危険な場所には入らず、安全な場所から撮ってください。木や虫には触れません。",
      locationNote: "位置情報は記録場所の保存だけに使います。公開地図や外部機関には送りません。",
      acknowledgementAction: "受付内容を見る",
      savedNotice: "写真を非公開で保存しました。外部には送信していません。",
      restoreFailure: "写真の下書きを復元できませんでした。もう一度、カメラまたは写真を開いてください。",
    },
    en: {
      landingTitle: "Photograph a cherry tree today.",
      landingLead: "You do not need to find an insect. One to six photos of the trunk or base can become a useful local record.",
      landingAction: "Photograph a tree",
      landingSecondary: "My acknowledgements",
      recordTitle: "Photograph the trunk and base",
      recordLead: "One photo is enough. You may take up to six wider or close photos. You do not need to identify an insect.",
      captureAction: "Open camera or photos",
      receivedTitle: "Photos received",
      receivedLead: "The photos are saved as your private record. This is not a report, submission, or permanent receipt.",
      emptyTitle: "No acknowledgement yet",
      emptyLead: "Photograph a cherry tree and save it privately to see the acknowledgement here.",
      privateLabel: "Private; no external delivery",
      safetyNote: "Stay out of roads, restricted or private land, and unsafe areas. Photograph from a safe place and do not touch the tree or insects.",
      locationNote: "Location is used only to save the record. It is not sent to a public map or an external recipient.",
      acknowledgementAction: "View acknowledgement",
      savedNotice: "Photos were saved privately. Nothing was sent to an external recipient.",
      restoreFailure: "The photo draft could not be restored. Open the camera or photos again.",
    },
    es: {
      landingTitle: "Fotografia hoy un cerezo.",
      landingLead: "No necesitas encontrar un insecto. De una a seis fotos del tronco o la base pueden ser un registro local util.",
      landingAction: "Fotografiar un arbol",
      landingSecondary: "Mis registros",
      recordTitle: "Fotografia el tronco y la base",
      recordLead: "Una foto es suficiente. Puedes guardar hasta seis fotos. No necesitas identificar ningun insecto.",
      captureAction: "Abrir camara o fotos",
      receivedTitle: "Fotos recibidas",
      receivedLead: "Las fotos se guardaron como registro privado. Esto no es una denuncia, entrega ni recibo permanente.",
      emptyTitle: "Aun no hay registro",
      emptyLead: "Fotografia un cerezo y guardalo de forma privada para ver aqui la confirmacion.",
      privateLabel: "Privado; sin envio externo",
      safetyNote: "No entres en carreteras, zonas restringidas, propiedad privada ni lugares peligrosos. Toma fotos desde un lugar seguro y no toques el arbol ni los insectos.",
      locationNote: "La ubicacion se usa solo para guardar el registro. No se envia a un mapa publico ni a destinatarios externos.",
      acknowledgementAction: "Ver confirmacion",
      savedNotice: "Las fotos se guardaron de forma privada. No se enviaron a destinatarios externos.",
      restoreFailure: "No se pudo restaurar el borrador. Abre de nuevo la camara o las fotos.",
    },
    "pt-BR": {
      landingTitle: "Fotografe uma cerejeira hoje.",
      landingLead: "Voce nao precisa encontrar um inseto. De uma a seis fotos do tronco ou da base podem virar um registro local util.",
      landingAction: "Fotografar uma arvore",
      landingSecondary: "Meus registros",
      recordTitle: "Fotografe o tronco e a base",
      recordLead: "Uma foto basta. Voce pode guardar ate seis fotos. Nao precisa identificar nenhum inseto.",
      captureAction: "Abrir camera ou fotos",
      receivedTitle: "Fotos recebidas",
      receivedLead: "As fotos foram salvas como registro privado. Isto nao e denuncia, envio ou recibo permanente.",
      emptyTitle: "Ainda nao ha registro",
      emptyLead: "Fotografe uma cerejeira e salve de forma privada para ver a confirmacao aqui.",
      privateLabel: "Privado; sem envio externo",
      safetyNote: "Nao entre em ruas, areas restritas, propriedade privada ou locais perigosos. Fotografe de um lugar seguro e nao toque na arvore nem nos insetos.",
      locationNote: "A localizacao e usada somente para salvar o registro. Nao e enviada a mapa publico nem a destinatarios externos.",
      acknowledgementAction: "Ver confirmacao",
      savedNotice: "As fotos foram salvas de forma privada. Nada foi enviado a destinatarios externos.",
      restoreFailure: "Nao foi possivel restaurar o rascunho. Abra novamente a camera ou as fotos.",
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

export function resolveKubiakaCurrentPath(basePath: string, url: string): string {
  const normalizedUrl = String(url || "/");
  const normalizedBase = String(basePath || "").replace(/\/$/, "");
  if (!normalizedBase) return normalizedUrl;
  if (
    normalizedUrl === normalizedBase
    || normalizedUrl.startsWith(`${normalizedBase}/`)
    || normalizedUrl.startsWith(`${normalizedBase}?`)
  ) {
    return normalizedUrl;
  }
  return withBasePath(normalizedBase, normalizedUrl);
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

function safeOptionalText(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safePhotoHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 256))
    .filter(Boolean)
    .slice(0, KUBIAKA_MAX_PHOTOS);
}

function appDbQuery<T extends Record<string, unknown>>(
  text: string,
  values: unknown[],
): Promise<{ rows: T[] }> {
  return getPool().query<T>(text, values);
}

export function isKubiakaFocusedExperienceEnabled(rawValue = process.env.KUBIAKA_FOCUSED_EXPERIENCE_ENABLED): boolean {
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(normalized);
}

export function rewriteKubiakaUpsertUrl(url: string): string {
  return url.includes(KUBIAKA_GENERIC_UPSERT_PATH)
    ? url.replace(KUBIAKA_GENERIC_UPSERT_PATH, KUBIAKA_UPSERT_PATH)
    : url;
}

export function rewriteKubiakaRecordDocument(
  html: string,
  basePath: string,
  lang: SiteLang,
): string {
  const dedicatedTarget = localizedHref(basePath, `${KUBIAKA_RECORD_PATH}?start=photo`, lang);
  return ["photo", "video", "gallery"].reduce((result, kind) => {
    const genericTarget = localizedHref(basePath, `/record?start=${kind}`, lang);
    return result.split(JSON.stringify(genericTarget)).join(JSON.stringify(dedicatedTarget));
  }, html);
}

export function resolveKubiakaMediaCount(input: ObservationUpsertInput): number {
  const sourcePayload = objectRecord(input.sourcePayload);
  const inlineCount = Array.isArray(input.photos) ? input.photos.length : 0;
  const hasDeclaredCount = sourcePayload.media_count !== undefined && sourcePayload.media_count !== null;
  const declaredCount = hasDeclaredCount ? Number(sourcePayload.media_count) : inlineCount;
  if (!Number.isInteger(declaredCount) || declaredCount < 1) {
    throw new Error("kubiaka_photo_required");
  }
  if (declaredCount > KUBIAKA_MAX_PHOTOS || inlineCount > KUBIAKA_MAX_PHOTOS) {
    throw new Error("kubiaka_photo_limit_exceeded");
  }
  if (inlineCount > 0 && hasDeclaredCount && inlineCount !== declaredCount) {
    throw new Error("kubiaka_photo_count_mismatch");
  }
  return declaredCount;
}

export function buildKubiakaObservationInput(
  input: ObservationUpsertInput,
  userId: string,
): ObservationUpsertInput {
  const sourcePayload = objectRecord(input.sourcePayload);
  const mediaCount = resolveKubiakaMediaCount(input);
  const observationId = input.observationId === undefined ? null : safeRecordId(input.observationId);
  if (input.observationId !== undefined && !observationId) {
    throw new Error("kubiaka_observation_id_invalid");
  }
  const legacyObservationId = input.legacyObservationId == null
    ? input.legacyObservationId
    : safeRecordId(input.legacyObservationId);
  if (input.legacyObservationId != null && !legacyObservationId) {
    throw new Error("kubiaka_legacy_observation_id_invalid");
  }

  const result: ObservationUpsertInput = {
    userId,
    observedAt: String(input.observedAt ?? ""),
    latitude: typeof input.latitude === "number" ? input.latitude : null,
    longitude: typeof input.longitude === "number" ? input.longitude : null,
    country: safeOptionalText(input.country, 80),
    prefecture: safeOptionalText(input.prefecture, 120),
    municipality: safeOptionalText(input.municipality, 120),
    localityNote: safeOptionalText(input.localityNote, 300),
    note: safeOptionalText(input.note, 1000),
    visitMode: "manual",
    completeChecklistFlag: false,
    targetTaxaScope: null,
    taxon: null,
    subjects: [{ isPrimary: true, roleHint: "primary" }],
    aiAssessmentStatus: "not_requested",
    sourcePayload: {
      source: "kubiaka_private_entry",
      record_mode: "quick",
      quick_capture_state: "present",
      media_count: mediaCount,
      client_photo_sha256s: safePhotoHashes(sourcePayload.client_photo_sha256s),
      subject_inference: "disabled",
      experience_key: KUBIAKA_EXPERIENCE_KEY,
      experience_context_version: KUBIAKA_CONTEXT_VERSION,
      entrypoint: KUBIAKA_RECORD_PATH,
      protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
      manual_photo_record: true,
      private_record: true,
      survey_non_detection_allowed: false,
      automatic_taxon_confirmation_allowed: false,
      public_aggregation_allowed: false,
      research_use_allowed: false,
      enterprise_use_allowed: false,
      external_export_allowed: false,
      external_routing_allowed: false,
      automatic_recipient_delivery_allowed: false,
    },
    dataRights: {
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
        experience_key: KUBIAAKA_EXPERIENCE_KEY,
        protocol_profile: KUBIAKA_PROTOCOL_PROFILE,
        enforced_by: KUBIAKA_UPSERT_PATH,
      },
    },
  };
  if (observationId) result.observationId = observationId;
  if (legacyObservationId !== undefined) result.legacyObservationId = legacyObservationId;
  if (input.clientSubmissionId !== undefined) result.clientSubmissionId = input.clientSubmissionId;
  if (Array.isArray(input.photos) && input.photos.length > 0) {
    result.photos = input.photos.slice(0, KUBIAKA_MAX_PHOTOS);
  }
  return result;
}

export async function enforceKubiakaVisitPrivate(
  query: KubiakaDbQuery,
  visitId: string,
  userId: string,
): Promise<void> {
  const result = await query<{ visit_id: string }>(
    `update visits
        set public_visibility = 'hidden',
            source_payload = coalesce(source_payload, '{}'::jsonb) || jsonb_build_object(
              'experience_key', $3::text,
              'protocol_profile', $4::text,
              'private_record', true,
              'public_aggregation_allowed', false,
              'research_use_allowed', false,
              'enterprise_use_allowed', false,
              'external_export_allowed', false,
              'external_routing_allowed', false,
              'automatic_recipient_delivery_allowed', false
            ),
            updated_at = now()
      where visit_id = $1
        and user_id = $2
      returning visit_id::text`,
    [visitId, userId, KUBIAKA_EXPERIENCE_KEY, KUBIAKA_PROTOCOL_PROFILE],
  );
  if (result.rows.length !== 1) throw new Error("kubiaka_private_enforcement_failed");
}

export async function findOwnedKubiakaAcknowledgement(
  query: KubiakaDbQuery,
  recordId: string,
  userId: string,
): Promise<OwnedKubiakaAcknowledgement | null> {
  const result = await query<{ visit_id: string; photo_count: string | number }>(
    `select v.visit_id::text,
            count(distinct ea.asset_id)::int as photo_count
       from visits v
       left join occurrences o on o.visit_id = v.visit_id
       left join evidence_assets ea
         on ea.visit_id = v.visit_id
        and ea.asset_role = 'observation_photo'
      where (v.visit_id::text = $1 or o.occurrence_id::text = $1)
        and v.user_id = $2
        and v.public_visibility = 'hidden'
        and v.source_payload ->> 'experience_key' = $3
      group by v.visit_id
     having count(distinct ea.asset_id) between 1 and $4
      limit 1`,
    [recordId, userId, KUBIAKA_EXPERIENCE_KEY, KUBIAKA_MAX_PHOTOS],
  );
  const row = result.rows[0];
  if (!row) return null;
  const photoCount = Number(row.photo_count);
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > KUBIAKA_MAX_PHOTOS) return null;
  return { recordId, visitId: row.visit_id, photoCount };
}

function recordContextScript(basePath: string, lang: SiteLang): string {
  const memberPath = localizedHref(basePath, KUBIAKA_MEMBER_PATH, lang);
  const sessionPath = withBasePath(basePath, "/api/v1/auth/session");
  const copy = copyFor(lang);
  return `<script>
(function(){
  var nativeFetch = window.fetch.bind(window);
  var lastRecord = null;
  var genericSuffix = ${JSON.stringify(KUBIAKA_GENERIC_UPSERT_PATH)};
  var dedicatedSuffix = ${JSON.stringify(KUBIAKA_UPSERT_PATH)};
  var memberPath = ${JSON.stringify(memberPath)};
  var sessionPath = ${JSON.stringify(sessionPath)};
  var savedNotice = ${JSON.stringify(copy.savedNotice)};
  var acknowledgementAction = ${JSON.stringify(copy.acknowledgementAction)};
  var restoreFailure = ${JSON.stringify(copy.restoreFailure)};

  function rewrittenUrl(url){
    return url && url.indexOf(genericSuffix) >= 0 ? url.replace(genericSuffix, dedicatedSuffix) : url;
  }

  window.fetch = async function(input, init){
    var sourceUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var targetUrl = rewrittenUrl(sourceUrl);
    var targetInput = input;
    if (targetUrl && targetUrl !== sourceUrl) {
      targetInput = typeof input === 'string' ? targetUrl : new Request(targetUrl, input);
    }
    var response = await nativeFetch(targetInput, init);
    if (targetUrl && targetUrl.indexOf(dedicatedSuffix) >= 0) {
      response.clone().json().then(function(data){
        if (!data || !data.ok) return;
        lastRecord = String(data.occurrenceId || data.visitId || '');
        try { sessionStorage.setItem('kubiaka:last-record', lastRecord); } catch (_) {}
      }).catch(function(){});
    }
    return response;
  };

  function setRestoreFailure(){
    var status = document.querySelector('[data-global-record-camera-status]');
    if (status) status.textContent = restoreFailure;
  }

  function renderPrivateSavedState(){
    var status = document.querySelector('[data-global-record-camera-status]');
    if (!status || status.getAttribute('data-kubiaka-saved') === 'true') return;
    var text = String(status.textContent || '');
    if (text.indexOf('記録を保存しました。') < 0 && text.indexOf('Record saved') < 0) return;
    var id = lastRecord;
    try { id = id || sessionStorage.getItem('kubiaka:last-record') || ''; } catch (_) {}
    if (!id) return;
    status.setAttribute('data-kubiaka-saved', 'true');
    status.replaceChildren();
    var message = document.createElement('span');
    message.textContent = savedNotice;
    var link = document.createElement('a');
    link.setAttribute('data-kubiaka-acknowledgement-link', 'true');
    link.className = 'kubiaka-secondary';
    link.href = memberPath + (memberPath.indexOf('?') >= 0 ? '&' : '?') + 'record=' + encodeURIComponent(id);
    link.textContent = acknowledgementAction;
    status.append(message, link);
  }

  function openDraftDb(){
    return new Promise(function(resolve, reject){
      if (!('indexedDB' in window)) return reject(new Error('indexeddb_unavailable'));
      var request = indexedDB.open('ikimon-record-draft', 1);
      request.onerror = function(){ reject(request.error || new Error('indexeddb_open_failed')); };
      request.onsuccess = function(){ resolve(request.result); };
    });
  }

  async function currentUserId(){
    var response = await nativeFetch(sessionPath, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    var json = await response.json().catch(function(){ return null; });
    if (!response.ok || !json || !json.ok || !json.session || !json.session.userId) throw new Error('session_required');
    return String(json.session.userId);
  }

  async function restoreDraft(){
    var params = new URL(location.href).searchParams;
    if (params.get('draft') !== '1') return false;
    var userId = await currentUserId();
    var db = await openDraftDb();
    var draft = await new Promise(function(resolve, reject){
      var transaction = db.transaction('drafts', 'readonly');
      var request = transaction.objectStore('drafts').get('latest:user:' + userId);
      request.onerror = function(){ reject(request.error || new Error('indexeddb_read_failed')); };
      request.onsuccess = function(){ resolve(request.result || null); };
    });
    try { db.close(); } catch (_) {}
    var sourceFiles = draft && Array.isArray(draft.files) ? draft.files : (draft && draft.file ? [draft.file] : []);
    var files = sourceFiles.filter(function(file){ return file && typeof file.type === 'string' && file.type.indexOf('image/') === 0; }).slice(0, ${KUBIAKA_MAX_PHOTOS});
    if (!files.length || typeof DataTransfer === 'undefined') throw new Error('draft_empty');
    var input = document.querySelector('[data-global-record-input="gallery"]');
    if (!input) throw new Error('gallery_input_missing');
    var transfer = new DataTransfer();
    files.forEach(function(file){ transfer.items.add(file); });
    input.setAttribute('data-global-record-input', 'photo');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.setAttribute('data-global-record-input', 'gallery');
    return true;
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-global-record-mode="video"]').forEach(function(node){ node.remove(); });
    var status = document.querySelector('[data-global-record-camera-status]');
    if (status) new MutationObserver(renderPrivateSavedState).observe(status, { childList: true, subtree: true, characterData: true });
    var params = new URL(location.href).searchParams;
    if (params.get('draft') === '1') {
      restoreDraft().catch(setRestoreFailure);
      return;
    }
    if (params.get('start') === 'photo') {
      var start = document.querySelector('[data-kubiaka-capture-start]');
      if (start) start.click();
    }
  });
})();
</script>`;
}

function landingHtml(basePath: string, lang: SiteLang, signedIn: boolean): string {
  const copy = copyFor(lang);
  const recordHref = localizedHref(basePath, KUBIAKA_RECORD_PATH, lang);
  const memberTarget = signedIn
    ? localizedHref(basePath, KUBIAKA_MEMBER_PATH, lang)
    : localizedHref(basePath, `/login?redirect=${encodeURIComponent(localizedHref(basePath, KUBIAKA_MEMBER_PATH, lang))}`, lang);
  const steps = lang === "ja"
    ? [
        ["サクラを見る", "幹と根元を安全な場所から見ます。"],
        ["1〜6枚撮る", "1枚だけでも大丈夫です。"],
        ["非公開で保存", "虫の名前を決める必要はありません。"],
      ]
    : [
        ["Look at the tree", "Observe the trunk and base from a safe place."],
        ["Take 1–6 photos", "One photo is enough."],
        ["Save privately", "No identification is required."],
      ];
  return `<div class="kubiaka-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">ZUKAN / Kubiaka watch</div>
      <h1>${escapeHtml(copy.landingTitle)}</h1>
      <p>${escapeHtml(copy.landingLead)}</p>
      <div class="kubiaka-actions">
        <a class="kubiaka-primary" href="${escapeHtml(recordHref)}">${escapeHtml(copy.landingAction)}</a>
        <a class="kubiaka-secondary" href="${escapeHtml(memberTarget)}">${escapeHtml(copy.landingSecondary)}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
    <section class="kubiaka-card">
      <div class="kubiaka-eyebrow">3 steps</div>
      <h2>${escapeHtml(lang === "ja" ? "見つけなくても、記録になる" : "A useful record without an identification")}</h2>
      <div class="kubiaka-steps">${steps.map(([title, body], index) => `<div class="kubiaka-step"><strong>${index + 1}. ${escapeHtml(title ?? "")}</strong><p>${escapeHtml(body ?? "")}</p></div>`).join("")}</div>
    </section>
    <p class="kubiaka-note">${escapeHtml(copy.safetyNote)}</p>
  </div>`;
}

function recordHtml(basePath: string, lang: SiteLang): string {
  const copy = copyFor(lang);
  return `<div class="kubiaka-page kubiaka-record-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">Private photo record</div>
      <h1>${escapeHtml(copy.recordTitle)}</h1>
      <p>${escapeHtml(copy.recordLead)}</p>
      <div class="kubiaka-actions">
        <button class="kubiaka-primary" type="button" data-kubiaka-capture-start data-global-record-trigger="photo" aria-haspopup="dialog">${escapeHtml(copy.captureAction)}</button>
        <a class="kubiaka-secondary" href="${escapeHtml(localizedHref(basePath, KUBIAKA_ENTRY_PATH, lang))}">${escapeHtml(lang === "ja" ? "説明に戻る" : "Back")}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
    <p class="kubiaka-note">${escapeHtml(copy.locationNote)}</p>
  </div>${recordContextScript(basePath, lang)}`;
}

function memberHtml(
  basePath: string,
  lang: SiteLang,
  acknowledgement: OwnedKubiakaAcknowledgement | null,
): string {
  const copy = copyFor(lang);
  const title = acknowledgement ? copy.receivedTitle : copy.emptyTitle;
  const lead = acknowledgement ? copy.receivedLead : copy.emptyLead;
  return `<div class="kubiaka-page">
    <section class="kubiaka-hero">
      <div class="kubiaka-eyebrow">${escapeHtml(KUBIAKA_ACKNOWLEDGEMENT_LABEL)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(lead)}</p>
      ${acknowledgement ? `<div class="kubiaka-record-id">Record: ${escapeHtml(acknowledgement.recordId)} / Photos: ${acknowledgement.photoCount}</div>` : ""}
      <div class="kubiaka-actions">
        <a class="kubiaka-primary" href="${escapeHtml(localizedHref(basePath, `${KUBIAKA_RECORD_PATH}?start=photo`, lang))}">${escapeHtml(lang === "ja" ? "サクラを撮る" : "Photograph a tree")}</a>
        <a class="kubiaka-secondary" href="${escapeHtml(localizedHref(basePath, KUBIAKA_ENTRY_PATH, lang))}">${escapeHtml(lang === "ja" ? "説明を見る" : "View guide")}</a>
      </div>
      <span class="kubiaka-private">● ${escapeHtml(copy.privateLabel)}</span>
    </section>
  </div>`;
}

async function requireSession(request: FastifyRequest): Promise<{ userId: string } | null> {
  const session = await getSessionFromCookie(request.headers.cookie);
  return session ? { userId: session.userId } : null;
}

function signInRedirect(basePath: string, targetPath: string, lang: SiteLang): string {
  const target = localizedHref(basePath, targetPath, lang);
  return localizedHref(basePath, `/login?redirect=${encodeURIComponent(target)}`, lang);
}

export async function registerKubiakaFocusedExperienceRoutes(app: FastifyInstance): Promise<void> {
  if (!isKubiakaFocusedExperienceEnabled()) return;

  app.get(KUBIAKA_ENTRY_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = requestUrl(request);
    const lang = detectLangFromUrl(rawUrl);
    const session = await requireSession(request);
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: copyFor(lang).landingTitle,
      description: copyFor(lang).landingLead,
      lang,
      currentPath: resolveKubiakaCurrentPath(basePath, rawUrl),
      canonicalPath: KUBIAKA_ENTRY_PATH,
      shellClassName: "shell-layout-narrow kubiaka-experience",
      extraStyles: PAGE_STYLES,
      body: landingHtml(basePath, lang, Boolean(session)),
      footerNote: "ZUKAN / Kubiaka watch",
    });
  });

  app.get(KUBIAKA_RECORD_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = requestUrl(request);
    const lang = detectLangFromUrl(rawUrl);
    const session = await requireSession(request);
    if (!session) return reply.redirect(signInRedirect(basePath, KUBIAKA_RECORD_PATH, lang));
    reply.type("text/html; charset=utf-8").header("Cache-Control", "private, no-store").header("Vary", "Cookie");
    const document = renderSiteDocument({
      basePath,
      title: copyFor(lang).recordTitle,
      description: copyFor(lang).recordLead,
      lang,
      currentPath: resolveKubiakaCurrentPath(basePath, rawUrl),
      noindex: true,
      minimalChrome: true,
      shellClassName: "shell-layout-narrow kubiaka-record-page",
      extraStyles: PAGE_STYLES,
      body: recordHtml(basePath, lang),
      footerNote: "ZUKAN / Kubiaka watch",
    });
    return rewriteKubiakaRecordDocument(document, basePath, lang);
  });

  app.get<{ Querystring: { record?: string } }>(KUBIAKA_MEMBER_PATH, async (request, reply) => {
    const basePath = basePathFor(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = requestUrl(request);
    const lang = detectLangFromUrl(rawUrl);
    const session = await requireSession(request);
    if (!session) return reply.redirect(signInRedirect(basePath, KUBIAKA_MEMBER_PATH, lang));

    const suppliedRecordId = request.query.record === undefined ? null : safeRecordId(request.query.record);
    let acknowledgement: OwnedKubiakaAcknowledgement | null = null;
    if (request.query.record !== undefined && !suppliedRecordId) {
      reply.code(404);
    } else if (suppliedRecordId) {
      acknowledgement = await findOwnedKubiakaAcknowledgement(appDbQuery, suppliedRecordId, session.userId);
      if (!acknowledgement) reply.code(404);
    }

    reply.type("text/html; charset=utf-8").header("Cache-Control", "private, no-store").header("Vary", "Cookie");
    return renderSiteDocument({
      basePath,
      title: acknowledgement ? copyFor(lang).receivedTitle : copyFor(lang).emptyTitle,
      description: acknowledgement ? copyFor(lang).receivedLead : copyFor(lang).emptyLead,
      lang,
      currentPath: resolveKubiakaCurrentPath(basePath, rawUrl),
      noindex: true,
      minimalChrome: true,
      hideGlobalRecordLauncher: true,
      shellClassName: "shell-layout-narrow kubiaka-member-page",
      extraStyles: PAGE_STYLES,
      body: memberHtml(basePath, lang, acknowledgement),
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
      await enforceKubiakaVisitPrivate(appDbQuery, result.visitId, resolvedSession.userId);
      invalidateUserVisibleSnapshots();
      return {
        ok: true,
        ...result,
        experience: {
          key: KUBIAKA_EXPERIENCE_KEY,
          contextVersion: KUBIAKA_CONTEXT_VERSION,
          protocolProfile: KUBIAKA_PROTOCOL_PROFILE,
          privacy: "private",
          publicAggregation: "denied",
          researchUse: "denied",
          enterpriseUse: "denied",
          externalExport: "denied",
          externalRouting: "denied",
          automaticRecipientDelivery: "denied",
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
