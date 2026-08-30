export type CloudflareRecordRecoverySource =
  | ""
  | "location_denied"
  | "login_required"
  | "draft_restore"
  | "media_retry"
  | "upload_failed"
  | "global_capture";

export type CloudflareRecordRecoveryState = {
  active: boolean;
  source: CloudflareRecordRecoverySource;
  start: "photo" | "video";
  draft: boolean;
  retryMedia: boolean;
};

export type CloudflareRecordRecoverySession = {
  userId: string;
  displayName?: string | null;
};

type PublicLang = "ja" | "en" | "es" | "pt-br";

const RECOVERY_SOURCES = new Set<CloudflareRecordRecoverySource>([
  "location_denied",
  "login_required",
  "draft_restore",
  "media_retry",
  "upload_failed",
  "global_capture",
]);

const COPY = {
  ja: {
    pageTitle: "下書きから記録を続ける",
    eyebrow: "記録の復旧",
    guestTitle: "写真・入力内容はこの端末に残っています",
    guestBody: "ログインすると、この端末に保存した下書きを開き、場所を確認して保存できます。別の端末には自動で移りません。",
    safeTitle: "いま閉じても下書きは消しません",
    safeBody: "保存が完了するか、明示的に破棄するまで端末内の下書きを維持します。",
    login: "ログインして続ける",
    register: "登録して続ける",
    records: "記録一覧へ戻る",
    map: "地図へ戻る",
    checking: "下書きを確認しています",
    checkingBody: "この端末に残っている写真と入力内容を読み込んでいます。",
    ready: "下書きを復元しました",
    readyBody: "写真と入力内容は保持されています。場所を確認して保存してください。",
    retry: "保存済みの記録へメディアを戻せます",
    retryBody: "記録本体は保存済みです。残っている写真・動画だけを同じ記録へ再送します。",
    empty: "復元できる下書きが見つかりませんでした",
    emptyBody: "写真・動画を選び直すか、記録一覧へ戻ってください。",
    error: "下書きを読み込めませんでした",
    errorBody: "写真・動画を選び直すか、ブラウザのサイトデータ設定を確認してください。",
    photo: "写真",
    video: "動画",
    photoHint: "カメラ・写真ライブラリ",
    videoHint: "端末の動画",
    note: "メモ",
    coord: "場所を確認・編集",
    lat: "緯度",
    lng: "経度",
    location: "現在地を使う",
    save: "保存する",
    pick: "写真・動画を選び直す",
    back: "戻る",
    discard: "下書きを破棄",
    discardConfirm: "この端末に残っている写真・動画・入力内容を削除します。元に戻せません。破棄しますか？",
    locationPending: "現在地を確認しています...",
    locationReady: "現在地を設定しました。内容を確認して保存してください。",
    locationFailed: "現在地を取得できませんでした。座標を直接入力するか、もう一度お試しください。",
    selected: "メディアを選択しました。場所を確認して保存してください。",
    missingMedia: "写真または動画を選択してください。",
    invalidCoordinates: "保存には場所が必要です。現在地を使うか、座標を入力してください。",
    saving: "保存中です...",
    saved: "記録を保存しました。端末内の下書きも削除しました。",
    retried: "メディアを同じ記録へ戻しました。端末内の下書きも削除しました。",
    failed: "まだ保存できていません。下書きは端末に残しているので、通信状態を確認してもう一度保存してください。",
    discarded: "下書きを破棄しました。",
  },
  en: {
    pageTitle: "Continue a saved draft",
    eyebrow: "Record recovery",
    guestTitle: "Your photos and entries remain on this device",
    guestBody: "Sign in to reopen the draft stored in this browser, check its place, and save it. Drafts do not move automatically to another device.",
    safeTitle: "Closing this page will not discard the draft",
    safeBody: "The device draft remains until saving succeeds or you explicitly discard it.",
    login: "Sign in and continue",
    register: "Create account and continue",
    records: "Back to records",
    map: "Back to map",
    checking: "Checking your draft",
    checkingBody: "Reading the photos and entries stored on this device.",
    ready: "Draft restored",
    readyBody: "Your photos and entries are retained. Check the place and save.",
    retry: "Return media to the saved record",
    retryBody: "The record is already saved. Only the remaining photos or video will be resent.",
    empty: "No restorable draft was found",
    emptyBody: "Select the media again or return to your records.",
    error: "The draft could not be read",
    errorBody: "Select the media again or check this browser's site-data settings.",
    photo: "Photo",
    video: "Video",
    photoHint: "Camera or photo library",
    videoHint: "Video on this device",
    note: "Note",
    coord: "Check or edit place",
    lat: "Latitude",
    lng: "Longitude",
    location: "Use current location",
    save: "Save",
    pick: "Select media again",
    back: "Back",
    discard: "Discard draft",
    discardConfirm: "Delete the photos, video, and entries stored on this device? This cannot be undone.",
    locationPending: "Checking your current location...",
    locationReady: "Current location set. Review and save.",
    locationFailed: "Current location could not be read. Enter coordinates or try again.",
    selected: "Media selected. Check the place and save.",
    missingMedia: "Choose a photo or video.",
    invalidCoordinates: "A place is required. Use current location or enter coordinates.",
    saving: "Saving...",
    saved: "Record saved. The device draft was removed.",
    retried: "Media returned to the same record. The device draft was removed.",
    failed: "Not saved yet. The draft remains on this device, so check the connection and try again.",
    discarded: "Draft discarded.",
  },
  es: {
    pageTitle: "Continuar un borrador",
    eyebrow: "Recuperación del registro",
    guestTitle: "Tus fotos y datos siguen en este dispositivo",
    guestBody: "Inicia sesión para abrir el borrador de este navegador, revisar el lugar y guardarlo. No pasa automáticamente a otro dispositivo.",
    safeTitle: "Cerrar esta página no elimina el borrador",
    safeBody: "El borrador permanece hasta guardar o descartarlo de forma explícita.",
    login: "Entrar y continuar",
    register: "Registrarse y continuar",
    records: "Volver a registros",
    map: "Volver al mapa",
    checking: "Comprobando el borrador",
    checkingBody: "Leyendo las fotos y datos guardados en este dispositivo.",
    ready: "Borrador recuperado",
    readyBody: "Las fotos y los datos siguen guardados. Revisa el lugar y guarda.",
    retry: "Devolver archivos al registro guardado",
    retryBody: "El registro ya está guardado. Solo se reenviarán las fotos o el video restantes.",
    empty: "No se encontró un borrador recuperable",
    emptyBody: "Selecciona los archivos otra vez o vuelve a tus registros.",
    error: "No se pudo leer el borrador",
    errorBody: "Selecciona los archivos otra vez o revisa los datos del sitio.",
    photo: "Foto",
    video: "Video",
    photoHint: "Cámara o galería",
    videoHint: "Vídeo del dispositivo",
    note: "Nota",
    coord: "Revisar o editar lugar",
    lat: "Latitud",
    lng: "Longitud",
    location: "Usar ubicación actual",
    save: "Guardar",
    pick: "Elegir archivos otra vez",
    back: "Volver",
    discard: "Descartar borrador",
    discardConfirm: "¿Eliminar las fotos, el video y los datos guardados en este dispositivo? No se puede deshacer.",
    locationPending: "Comprobando la ubicación actual...",
    locationReady: "Ubicación actual definida. Revisa y guarda.",
    locationFailed: "No se pudo leer la ubicación. Introduce coordenadas o inténtalo de nuevo.",
    selected: "Archivos seleccionados. Revisa el lugar y guarda.",
    missingMedia: "Elige una foto o un video.",
    invalidCoordinates: "Se necesita un lugar. Usa la ubicación actual o introduce coordenadas.",
    saving: "Guardando...",
    saved: "Registro guardado. Se eliminó el borrador del dispositivo.",
    retried: "Archivos devueltos al mismo registro. Se eliminó el borrador.",
    failed: "Todavía no se guardó. El borrador sigue en el dispositivo; revisa la conexión e inténtalo de nuevo.",
    discarded: "Borrador descartado.",
  },
  "pt-br": {
    pageTitle: "Continuar um rascunho",
    eyebrow: "Recuperação do registro",
    guestTitle: "Suas fotos e dados continuam neste dispositivo",
    guestBody: "Entre para abrir o rascunho deste navegador, revisar o local e salvar. Ele não passa automaticamente para outro dispositivo.",
    safeTitle: "Fechar esta página não apaga o rascunho",
    safeBody: "O rascunho permanece até salvar ou ser descartado explicitamente.",
    login: "Entrar e continuar",
    register: "Criar conta e continuar",
    records: "Voltar aos registros",
    map: "Voltar ao mapa",
    checking: "Verificando o rascunho",
    checkingBody: "Lendo as fotos e os dados salvos neste dispositivo.",
    ready: "Rascunho restaurado",
    readyBody: "As fotos e os dados estão preservados. Revise o local e salve.",
    retry: "Devolver mídia ao registro salvo",
    retryBody: "O registro já está salvo. Apenas as fotos ou o vídeo restantes serão reenviados.",
    empty: "Nenhum rascunho recuperável foi encontrado",
    emptyBody: "Selecione a mídia novamente ou volte aos seus registros.",
    error: "Não foi possível ler o rascunho",
    errorBody: "Selecione a mídia novamente ou verifique os dados do site.",
    photo: "Foto",
    video: "Vídeo",
    photoHint: "Câmera ou galeria",
    videoHint: "Vídeo do dispositivo",
    note: "Nota",
    coord: "Revisar ou editar local",
    lat: "Latitude",
    lng: "Longitude",
    location: "Usar localização atual",
    save: "Salvar",
    pick: "Selecionar mídia novamente",
    back: "Voltar",
    discard: "Descartar rascunho",
    discardConfirm: "Excluir as fotos, o vídeo e os dados salvos neste dispositivo? Não é possível desfazer.",
    locationPending: "Verificando a localização atual...",
    locationReady: "Localização atual definida. Revise e salve.",
    locationFailed: "Não foi possível ler a localização. Informe as coordenadas ou tente novamente.",
    selected: "Mídia selecionada. Revise o local e salve.",
    missingMedia: "Escolha uma foto ou um vídeo.",
    invalidCoordinates: "Um local é necessário. Use a localização atual ou informe as coordenadas.",
    saving: "Salvando...",
    saved: "Registro salvo. O rascunho do dispositivo foi removido.",
    retried: "Mídia devolvida ao mesmo registro. O rascunho foi removido.",
    failed: "Ainda não foi salvo. O rascunho continua no dispositivo; verifique a conexão e tente novamente.",
    discarded: "Rascunho descartado.",
  },
} as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function langFromUrl(url: URL): PublicLang {
  const segment = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (segment === "en" || segment === "es" || segment === "pt-br") return segment;
  return "ja";
}

function prefixForLang(lang: PublicLang): string {
  return lang === "ja" ? "/ja" : `/${lang}`;
}

function safeEventContextParam(url: URL, names: string[], maxLength = 128): string {
  for (const name of names) {
    const value = String(url.searchParams.get(name) ?? "").trim();
    if (value && value.length <= maxLength && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) return value;
  }
  return "";
}

export function resolveCloudflareRecordRecoveryState(url: URL): CloudflareRecordRecoveryState {
  const draft = url.searchParams.get("draft") === "1";
  const retryMedia = url.searchParams.get("retry") === "media";
  const rawSource = (url.searchParams.get("source") ?? "").trim() as CloudflareRecordRecoverySource;
  let source: CloudflareRecordRecoverySource = RECOVERY_SOURCES.has(rawSource) ? rawSource : "";
  if (retryMedia) source = "media_retry";
  if (draft && !source) source = "draft_restore";
  return {
    active: draft || retryMedia || Boolean(source),
    source,
    start: url.searchParams.get("start") === "video" ? "video" : "photo",
    draft,
    retryMedia,
  };
}

function recoveryStyles(): string {
  return `
    :root{color-scheme:light;--ink:#10251a;--muted:#52635d;--line:#d8eae4;--mint:#eefbf6;--teal:#058f82;--leaf:#54c86f;--paper:#fbfdfb;--danger:#b42318}
    *{box-sizing:border-box}
    body{margin:0;background:linear-gradient(180deg,#f5fbf8 0,#fff 72%);color:var(--ink);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5}
    .cf-recovery-header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}
    .cf-recovery-brand{min-width:44px;min-height:44px;display:inline-flex;align-items:center;font-weight:900;text-decoration:none;color:var(--ink);font-size:20px;letter-spacing:.02em}
    .cf-recovery-profile{color:var(--muted);font-size:13px;font-weight:800;overflow-wrap:anywhere;text-align:right}
    .cf-recovery-shell{width:min(760px,calc(100% - 24px));margin:22px auto 48px}
    .cf-recovery-card{padding:clamp(20px,5vw,36px);border:1px solid rgba(5,143,130,.22);border-radius:24px;background:linear-gradient(145deg,#fff,#effbf6);box-shadow:0 22px 60px rgba(16,37,26,.1)}
    .cf-recovery-eyebrow{display:inline-flex;padding:5px 10px;border-radius:999px;background:#dff7ee;color:#08665f;font-size:12px;font-weight:900}
    .cf-recovery-card h1,.cf-recovery-card h2{margin:10px 0 10px;line-height:1.18}
    .cf-recovery-card h1{font-size:clamp(27px,6vw,42px)}
    .cf-recovery-card h2{font-size:clamp(21px,4vw,30px)}
    .cf-recovery-card p{margin:0;color:var(--muted)}
    .cf-recovery-safe{margin-top:18px;padding:14px;border-radius:14px;background:#fff;border:1px solid var(--line)}
    .cf-recovery-safe strong{display:block;margin-bottom:4px}
    .cf-recovery-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
    .cf-recovery-actions a,.cf-recovery-actions button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);font:inherit;font-weight:900;text-decoration:none;cursor:pointer}
    .cf-recovery-actions .primary{border:0;background:linear-gradient(135deg,var(--teal),var(--leaf));color:#fff}
    .cf-recovery-actions .danger{color:var(--danger)}
    .cf-recovery-actions button:disabled{opacity:.48;cursor:not-allowed}
    .cf-recovery-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}
    .cf-recovery-pick{display:block;min-height:82px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff;font-weight:900;box-shadow:0 10px 26px rgba(16,37,26,.05)}
    .cf-recovery-pick span{display:block;margin-top:4px;color:var(--muted);font-size:12px;font-weight:800}
    .cf-recovery-pick input{position:absolute;inline-size:1px;block-size:1px;opacity:.01}
    .cf-recovery-form{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#fff}
    .cf-recovery-form[hidden]{display:none!important}
    .cf-recovery-field{display:block;margin-bottom:12px;font-weight:900}
    .cf-recovery-field span{display:block;margin-bottom:6px;color:var(--muted);font-size:12px}
    .cf-recovery-field textarea,.cf-recovery-field input{width:100%;min-height:44px;padding:10px 11px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);font:inherit}
    .cf-recovery-field textarea{min-height:82px;resize:vertical}
    .cf-recovery-coordinates{margin-bottom:12px;border:1px solid var(--line);border-radius:12px;background:var(--mint);overflow:hidden}
    .cf-recovery-coordinates summary{min-height:44px;display:flex;align-items:center;cursor:pointer;padding:10px 12px;font-weight:900}
    .cf-recovery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 12px 12px}
    .cf-recovery-status{min-height:28px;margin-top:12px;color:var(--teal);font-weight:900}
    .cf-recovery-brand:focus-visible,.cf-recovery-pick:has(input:focus-visible),.cf-recovery-field :is(input,textarea):focus-visible,.cf-recovery-coordinates summary:focus-visible,.cf-recovery-actions :is(a,button):focus-visible{outline:3px solid #0ea5e9;outline-offset:3px}
    @media(max-width:520px){.cf-recovery-shell{width:calc(100% - 16px);margin-top:14px}.cf-recovery-grid{grid-template-columns:1fr}.cf-recovery-actions>*{flex:1 1 100%}.cf-recovery-header{padding:11px 12px}.cf-recovery-profile{max-width:52%;font-size:12px}}
  `;
}

export function renderCloudflareRecordRecoveryGuestHtml(url: URL, cspNonce: string): string {
  const lang = langFromUrl(url);
  const copy = COPY[lang];
  const prefix = prefixForLang(lang);
  const redirect = encodeURIComponent(`${url.pathname}${url.search}`);
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(copy.pageTitle)} | ZUKAN</title>
  <style>${recoveryStyles()}</style>
</head>
<body>
  <header class="cf-recovery-header"><a class="cf-recovery-brand" href="${escapeHtml(prefix)}/" aria-label="ZUKAN Home">ZUKAN</a></header>
  <main class="cf-recovery-shell" data-record-recovery-start>
    <section class="cf-recovery-card">
      <span class="cf-recovery-eyebrow">${escapeHtml(copy.eyebrow)}</span>
      <h1>${escapeHtml(copy.guestTitle)}</h1>
      <p>${escapeHtml(copy.guestBody)}</p>
      <div class="cf-recovery-safe"><strong>${escapeHtml(copy.safeTitle)}</strong><span>${escapeHtml(copy.safeBody)}</span></div>
      <div class="cf-recovery-actions">
        <a class="primary" href="${escapeHtml(prefix)}/login?redirect=${redirect}">${escapeHtml(copy.login)}</a>
        <a href="${escapeHtml(prefix)}/register?redirect=${redirect}">${escapeHtml(copy.register)}</a>
        <a href="${escapeHtml(prefix)}/records?view=mine">${escapeHtml(copy.records)}</a>
        <a href="${escapeHtml(prefix)}/map">${escapeHtml(copy.map)}</a>
      </div>
    </section>
  </main>
  <script nonce="${escapeHtml(cspNonce)}">document.documentElement.dataset.recordRecovery="guest";</script>
</body>
</html>`;
}

export function renderCloudflareRecordRecoverySignedHtml(
  session: CloudflareRecordRecoverySession,
  url: URL,
  cspNonce: string,
  state: CloudflareRecordRecoveryState,
): string {
  const lang = langFromUrl(url);
  const copy = COPY[lang];
  const prefix = prefixForLang(lang);
  const initialTitle = state.retryMedia || state.source === "media_retry" ? copy.retry : copy.checking;
  const initialBody = state.retryMedia || state.source === "media_retry" ? copy.retryBody : copy.checkingBody;
  const eventCode = safeEventContextParam(url, ["event", "eventCode"], 32);
  const eventSessionId = safeEventContextParam(url, ["eventSessionId"], 128);
  const eventTeamId = safeEventContextParam(url, ["teamId"], 128);
  const eventParticipantRole = safeEventContextParam(url, ["participantRole"], 64);
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(copy.pageTitle)} | ZUKAN</title>
  <style>${recoveryStyles()}</style>
</head>
<body data-record-start="${escapeHtml(state.start)}" data-record-recovery-page="1" data-recovery-source="${escapeHtml(state.source)}" data-event-code="${escapeHtml(eventCode)}" data-event-session-id="${escapeHtml(eventSessionId)}" data-event-team-id="${escapeHtml(eventTeamId)}" data-event-participant-role="${escapeHtml(eventParticipantRole)}">
  <header class="cf-recovery-header">
    <a class="cf-recovery-brand" href="${escapeHtml(prefix)}/" aria-label="ZUKAN Home">ZUKAN</a>
    <div class="cf-recovery-profile">${escapeHtml(session.displayName || session.userId)}</div>
  </header>
  <main class="cf-recovery-shell">
    <section class="cf-recovery-card" data-record-recovery data-state="checking">
      <span class="cf-recovery-eyebrow">${escapeHtml(copy.eyebrow)}</span>
      <h1 id="record-recovery-title">${escapeHtml(initialTitle)}</h1>
      <p id="record-recovery-body">${escapeHtml(initialBody)}</p>
      <div class="cf-recovery-actions">
        <button type="button" data-record-recovery-location disabled>${escapeHtml(copy.location)}</button>
        <button type="button" class="primary" data-record-recovery-save disabled>${escapeHtml(copy.save)}</button>
        <button type="button" data-record-recovery-pick>${escapeHtml(copy.pick)}</button>
        <button type="button" data-record-recovery-back>${escapeHtml(copy.back)}</button>
        <button type="button" class="danger" data-record-recovery-discard>${escapeHtml(copy.discard)}</button>
      </div>
    </section>
    <div class="cf-recovery-picker" aria-label="${escapeHtml(copy.pageTitle)}">
      <label class="cf-recovery-pick">${escapeHtml(copy.photo)}<span>${escapeHtml(copy.photoHint)}</span><input id="record-media-photo" type="file" accept="image/*" multiple></label>
      <label class="cf-recovery-pick">${escapeHtml(copy.video)}<span>${escapeHtml(copy.videoHint)}</span><input id="record-media-video" type="file" accept="video/*"></label>
    </div>
    <form id="record-form" class="cf-recovery-form" data-user-id="${escapeHtml(session.userId)}" hidden>
      <label class="cf-recovery-field"><span>${escapeHtml(copy.note)}</span><textarea name="note" rows="3"></textarea></label>
      <details class="cf-recovery-coordinates" open>
        <summary>${escapeHtml(copy.coord)}</summary>
        <div class="cf-recovery-grid">
          <label class="cf-recovery-field"><span>${escapeHtml(copy.lat)}</span><input name="latitude" inputmode="decimal"></label>
          <label class="cf-recovery-field"><span>${escapeHtml(copy.lng)}</span><input name="longitude" inputmode="decimal"></label>
        </div>
      </details>
      <div id="record-status" class="cf-recovery-status" role="status" aria-live="polite"></div>
    </form>
  </main>
  <script nonce="${escapeHtml(cspNonce)}">
  (() => {
    const copy = ${JSON.stringify(copy)};
    const recordsHref = ${JSON.stringify(`${prefix}/records?view=mine`)};
    const form = document.getElementById("record-form");
    const status = document.getElementById("record-status");
    const panel = document.querySelector(".cf-recovery-card[data-record-recovery]");
    const title = document.getElementById("record-recovery-title");
    const body = document.getElementById("record-recovery-body");
    const locationButton = document.querySelector("[data-record-recovery-location]");
    const saveButton = document.querySelector("[data-record-recovery-save]");
    const pickButton = document.querySelector("[data-record-recovery-pick]");
    const backButton = document.querySelector("[data-record-recovery-back]");
    const discardButton = document.querySelector("[data-record-recovery-discard]");
    const photoInput = document.getElementById("record-media-photo");
    const videoInput = document.getElementById("record-media-video");
    const latitudeInput = form?.elements.namedItem("latitude");
    const longitudeInput = form?.elements.namedItem("longitude");
    const noteInput = form?.elements.namedItem("note");
    let eventContext = {
      eventCode: document.body.dataset.eventCode || "",
      eventSessionId: document.body.dataset.eventSessionId || "",
      teamId: document.body.dataset.eventTeamId || "",
      participantRole: document.body.dataset.eventParticipantRole || "",
    };
    let mediaKind = document.body.dataset.recordStart === "video" ? "video" : "photo";
    let recoveredFiles = [];
    let recoveryMetadata = {};
    let currentDraft = null;
    let pendingRetryTarget = "";
    let recoverySubmissionId = "";
    let recoveryObservedAt = "";
    let completedPhotoIndexes = new Set();
    let pendingVideoUid = "";
    let pendingVideoUploadUrl = "";
    let pendingVideoBodyUploaded = false;

    function setStatus(message, error) {
      if (!status) return;
      status.textContent = String(message || "");
      status.style.color = error ? "#b42318" : "";
    }
    function eventMetric(eventName, values = {}) {
      if (!eventContext.eventSessionId) return Promise.resolve();
      return fetch("/api/v1/observation-events/" + encodeURIComponent(eventContext.eventSessionId) + "/analytics", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_name: eventName,
          page: "record",
          auth_state: "signed_in",
          network_state: navigator.onLine === false ? "offline" : "online",
          ...values,
        }),
      }).then(() => undefined).catch(() => undefined);
    }
    function observationFailureReason(error) {
      const message = String(error instanceof Error ? error.message : "").toLowerCase();
      if (message.includes("timeout")) return "timeout";
      if (message.includes("forbidden") || message.includes("permission") || message.includes("session_required")) return "permission";
      if (message.includes("invalid") || message.includes("missing") || message.includes("required")) return "validation";
      if (/\\b5\\d\\d\\b/.test(message)) return "5xx";
      if (/\\b4\\d\\d\\b/.test(message)) return "4xx";
      return "unknown";
    }
    function setPanelState(nextState, heading, detail) {
      panel?.setAttribute("data-state", nextState);
      if (title) title.textContent = heading;
      if (body) body.textContent = detail;
      const ready = nextState === "ready" || nextState === "media_retry";
      if (locationButton) locationButton.disabled = !ready;
      if (saveButton) saveButton.disabled = !ready;
    }
    function inputFiles() {
      const input = mediaKind === "video" ? videoInput : photoInput;
      return input?.files ? Array.from(input.files).filter((file) => file instanceof File && file.size > 0) : [];
    }
    function selectedFiles() {
      const direct = inputFiles();
      return direct.length > 0 ? direct : recoveredFiles;
    }
    function normalizeDraftFiles(draft) {
      const values = Array.isArray(draft?.files) ? draft.files : draft?.file ? [draft.file] : [];
      return values.flatMap((value, index) => {
        if (value instanceof File && value.size > 0) return [value];
        if (value instanceof Blob && value.size > 0) {
          return [new File([value], "recovered-" + String(index + 1), { type: value.type || "application/octet-stream" })];
        }
        return [];
      });
    }
    function reveal(kind, message) {
      mediaKind = kind === "video" ? "video" : "photo";
      if (form) form.hidden = false;
      setPanelState(pendingRetryTarget ? "media_retry" : "ready", pendingRetryTarget ? copy.retry : copy.ready, pendingRetryTarget ? copy.retryBody : copy.readyBody);
      setStatus(message || copy.selected, false);
    }
    function openRecordDraftDb() {
      return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("indexeddb_unavailable"));
        const request = indexedDB.open("ikimon-record-draft", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
      });
    }
    async function readDraft() {
      const db = await openRecordDraftDb();
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction("drafts", "readonly");
          const request = tx.objectStore("drafts").get("latest");
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error("indexeddb_read_failed"));
        });
      } finally {
        db.close();
      }
    }
  async function writeDraft(draft) {
    const db = await openRecordDraftDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("drafts", "readwrite");
        tx.objectStore("drafts").put(draft, "latest");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("indexeddb_write_failed"));
      });
    } finally {
      db.close();
    }
  }
  async function persistDraftProgress(patch) {
    const previous = currentDraft && typeof currentDraft === "object" ? currentDraft : {};
    const previousMetadata = previous.metadata && typeof previous.metadata === "object" ? previous.metadata : {};
    const previousFormValues = previousMetadata.formValues && typeof previousMetadata.formValues === "object" ? previousMetadata.formValues : {};
    const patchValue = patch && typeof patch === "object" ? patch : {};
    const files = selectedFiles();
    recoveryMetadata = {
      ...previousMetadata,
      ...recoveryMetadata,
      ...patchValue,
      eventContext,
      formValues: {
        ...previousFormValues,
        ...(recoveryMetadata.formValues && typeof recoveryMetadata.formValues === "object" ? recoveryMetadata.formValues : {}),
        note: String(noteInput?.value || ""),
        latitude: String(latitudeInput?.value || ""),
        longitude: String(longitudeInput?.value || ""),
      },
    };
    currentDraft = {
      ...previous,
      file: files[0] || previous.file || null,
      files: files.length > 0 ? files : normalizeDraftFiles(previous),
      kind: mediaKind,
      savedAt: Date.now(),
      metadata: recoveryMetadata,
    };
    await writeDraft(currentDraft);
  }
  async function deleteOutboxDraft() {
      try {
        const request = indexedDB.open("ikimon-app-outbox-v1", 1);
        const db = await new Promise((resolve, reject) => {
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("items")) request.result.createObjectStore("items", { keyPath: "id" });
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("outbox_open_failed"));
        });
        try {
          await new Promise((resolve, reject) => {
            const tx = db.transaction("items", "readwrite");
            tx.objectStore("items").delete("record:latest");
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error("outbox_delete_failed"));
          });
        } finally {
          db.close();
        }
      } catch (_) {}
    }
    async function deleteDraft() {
      const db = await openRecordDraftDb();
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("drafts", "readwrite");
          tx.objectStore("drafts").delete("latest");
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error || new Error("indexeddb_delete_failed"));
        });
      } finally {
        db.close();
      }
      await deleteOutboxDraft();
    }
    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("file_read_failed"));
        reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.readAsDataURL(file);
      });
    }
    async function postJson(path, payload) {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false) throw new Error(json.error || "request_failed");
      return json;
    }
    function visitIdFromTarget(value) {
      const text = String(value || "").trim();
      if (text.startsWith("occ:")) return text.split(":")[1] || text;
      return text;
    }
    function applyDraftMetadata(metadata) {
      recoveryMetadata = metadata && typeof metadata === "object" ? metadata : {};
      const storedEventContext = recoveryMetadata.eventContext && typeof recoveryMetadata.eventContext === "object"
        ? recoveryMetadata.eventContext
        : {};
      eventContext = {
        eventCode: eventContext.eventCode || String(storedEventContext.eventCode || ""),
        eventSessionId: eventContext.eventSessionId || String(storedEventContext.eventSessionId || ""),
        teamId: eventContext.teamId || String(storedEventContext.teamId || ""),
        participantRole: eventContext.participantRole || String(storedEventContext.participantRole || ""),
      };
      const formValues = recoveryMetadata.formValues && typeof recoveryMetadata.formValues === "object" ? recoveryMetadata.formValues : {};
      const location = recoveryMetadata.location && typeof recoveryMetadata.location === "object" ? recoveryMetadata.location : {};
      const note = String(formValues.note || recoveryMetadata.note || "");
      const latitude = location.latitude ?? formValues.latitude ?? recoveryMetadata.latitude ?? "";
      const longitude = location.longitude ?? formValues.longitude ?? recoveryMetadata.longitude ?? "";
      if (noteInput) noteInput.value = note;
      if (latitudeInput && latitude !== "") latitudeInput.value = String(latitude);
      if (longitudeInput && longitude !== "") longitudeInput.value = String(longitude);
      pendingRetryTarget = String(
        recoveryMetadata.pendingMediaRetryVisitId ||
        recoveryMetadata.pendingMediaRetryObservationId ||
        recoveryMetadata.pendingMediaRetryDetailId ||
        ""
      ).trim();
    recoverySubmissionId = String(recoveryMetadata.recoverySubmissionId || "").trim();
    recoveryObservedAt = String(recoveryMetadata.recoveryObservedAt || "").trim();
    const completed = Array.isArray(recoveryMetadata.completedPhotoIndexes)
      ? recoveryMetadata.completedPhotoIndexes.filter((value) => Number.isInteger(value) && value >= 0)
      : [];
    completedPhotoIndexes = new Set(completed);
    pendingVideoUid = String(recoveryMetadata.pendingMediaRetryVideoUid || "").trim();
    pendingVideoUploadUrl = String(recoveryMetadata.pendingMediaRetryVideoUploadUrl || "").trim();
    pendingVideoBodyUploaded = recoveryMetadata.pendingMediaRetryVideoBodyUploaded === true;
  }
    async function restoreDraft() {
      setPanelState("checking", copy.checking, copy.checkingBody);
      try {
        const draft = await readDraft();
        if (!draft) {
          setPanelState("empty", copy.empty, copy.emptyBody);
          return;
        }
        currentDraft = draft;
      recoveredFiles = normalizeDraftFiles(draft);
        applyDraftMetadata(draft.metadata);
        const kind = draft.kind === "video" ? "video" : "photo";
        if (recoveredFiles.length === 0) {
          setPanelState(pendingRetryTarget ? "media_retry" : "empty", pendingRetryTarget ? copy.retry : copy.empty, pendingRetryTarget ? copy.retryBody : copy.emptyBody);
          return;
        }
        reveal(kind, pendingRetryTarget ? copy.retryBody : copy.readyBody);
      } catch (error) {
        console.error(error);
        setPanelState("error", copy.error, copy.errorBody);
      }
    }

  photoInput?.addEventListener("change", async () => {
    mediaKind = "photo";
    recoveredFiles = photoInput?.files ? Array.from(photoInput.files).filter((file) => file instanceof File && file.size > 0) : [];
    completedPhotoIndexes = new Set();
    pendingVideoUid = "";
    pendingVideoUploadUrl = "";
    pendingVideoBodyUploaded = false;
    reveal("photo", copy.selected);
    void eventMetric("event_photo_selected");
    try {
      await persistDraftProgress({
        completedPhotoIndexes: [],
        pendingMediaRetryVideoUid: "",
        pendingMediaRetryVideoUploadUrl: "",
        pendingMediaRetryVideoBodyUploaded: false,
      });
    } catch (error) {
      console.error(error);
      setStatus(copy.failed, true);
    }
  });
  videoInput?.addEventListener("change", async () => {
    mediaKind = "video";
    recoveredFiles = videoInput?.files ? Array.from(videoInput.files).filter((file) => file instanceof File && file.size > 0) : [];
    completedPhotoIndexes = new Set();
    pendingVideoUid = "";
    pendingVideoUploadUrl = "";
    pendingVideoBodyUploaded = false;
    reveal("video", copy.selected);
    try {
      await persistDraftProgress({
        completedPhotoIndexes: [],
        pendingMediaRetryVideoUid: "",
        pendingMediaRetryVideoUploadUrl: "",
        pendingMediaRetryVideoBodyUploaded: false,
      });
    } catch (error) {
      console.error(error);
      setStatus(copy.failed, true);
    }
  });
  pickButton?.addEventListener("click", () => {
      const input = mediaKind === "video" ? videoInput : photoInput;
      input?.click();
    });
    backButton?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.assign(recordsHref);
    });
    locationButton?.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        setStatus(copy.locationFailed, true);
        return;
      }
      setStatus(copy.locationPending, false);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (latitudeInput) latitudeInput.value = Number(position.coords.latitude).toFixed(6);
          if (longitudeInput) longitudeInput.value = Number(position.coords.longitude).toFixed(6);
          setStatus(copy.locationReady, false);
        },
        () => setStatus(copy.locationFailed, true),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
    saveButton?.addEventListener("click", () => form?.requestSubmit());
    discardButton?.addEventListener("click", async () => {
      if (!confirm(copy.discardConfirm)) return;
      discardButton.disabled = true;
      try {
        await deleteDraft();
        recoveredFiles = [];
        setPanelState("discarded", copy.discarded, copy.discarded);
        setStatus(copy.discarded, false);
        setTimeout(() => location.assign(recordsHref), 250);
      } catch (error) {
        console.error(error);
        discardButton.disabled = false;
        setStatus(copy.failed, true);
      }
    });

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = selectedFiles();
      if (files.length === 0) {
        setStatus(copy.missingMedia, true);
        return;
      }
      const data = new FormData(form);
      const latitudeText = String(data.get("latitude") || "").trim();
      const longitudeText = String(data.get("longitude") || "").trim();
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      const userId = form.dataset.userId || "";
      const isRetry = Boolean(pendingRetryTarget);
      let observationStored = isRetry;
      if (!isRetry && (!latitudeText || !longitudeText || !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
        setStatus(copy.invalidCoordinates, true);
        return;
      }
      setStatus(copy.saving, false);
      if (saveButton) saveButton.disabled = true;
      if (!isRetry) void eventMetric("event_observation_submit_started");
      try {
      if (!pendingRetryTarget && !recoverySubmissionId) {
        recoverySubmissionId = "record-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
        recoveryObservedAt = new Date().toISOString();
      }
      if (!recoveryObservedAt) recoveryObservedAt = new Date().toISOString();
      await persistDraftProgress({
        recoverySubmissionId,
        recoveryObservedAt,
        pendingMediaRetryVisitId: pendingRetryTarget,
        completedPhotoIndexes: Array.from(completedPhotoIndexes).sort((a, b) => a - b),
        pendingMediaRetryVideoUid: pendingVideoUid,
        pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
        pendingMediaRetryVideoBodyUploaded: pendingVideoBodyUploaded,
      });
      const observationId = recoverySubmissionId || ("record-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8));
        let visitId = visitIdFromTarget(pendingRetryTarget);
        if (!isRetry) {
          const observation = await postJson("/api/v1/observations/upsert", {
            observationId,
            clientSubmissionId: observationId + "-cloudflare-record-recovery",
            userId,
            observedAt: recoveryObservedAt,
            latitude,
            longitude,
            visibility: "private",
            note: String(data.get("note") || ""),
            taxon: { vernacularName: "未同定", rank: "unknown" },
            eventCode: eventContext.eventCode || null,
            eventSessionId: eventContext.eventSessionId || null,
            teamId: eventContext.teamId || null,
            participantRole: eventContext.participantRole || null,
            sourcePayload: {
              source: "cloudflare_record_recovery",
              mediaKind,
              eventCode: eventContext.eventCode || null,
              eventSessionId: eventContext.eventSessionId || null,
              teamId: eventContext.teamId || null,
              participantRole: eventContext.participantRole || null,
            },
          });
          observationStored = true;
          visitId = String(observation.visitId || observation.observationId || observationId);
        pendingRetryTarget = visitId;
        await persistDraftProgress({ recoverySubmissionId, pendingMediaRetryVisitId: visitId });
      }
      if (!visitId) throw new Error("media_retry_target_missing");

      if (mediaKind === "photo") {
        for (let index = 0; index < files.length; index += 1) {
          if (completedPhotoIndexes.has(index)) continue;
          const file = files[index];
          await postJson("/api/v1/observations/" + encodeURIComponent(visitId) + "/photos/upload", {
            filename: file.name || "record-photo-" + String(index + 1) + ".jpg",
            mimeType: file.type || "image/jpeg",
            base64Data: await fileToBase64(file),
            mediaRole: index === 0 ? "primary" : "context",
            facePrivacy: "no_faces",
          });
          completedPhotoIndexes.add(index);
          await persistDraftProgress({
            recoverySubmissionId,
            pendingMediaRetryVisitId: visitId,
            completedPhotoIndexes: Array.from(completedPhotoIndexes).sort((a, b) => a - b),
          });
        }
      } else {
        const file = files[0];
        if (!pendingVideoUid || (!pendingVideoBodyUploaded && !pendingVideoUploadUrl)) {
          const direct = await postJson("/api/v1/videos/direct-upload", {
            filename: file.name || "record-video.mp4",
            observationId: visitId,
            mediaRole: "observation_video",
            fileSizeBytes: file.size,
            uploadProtocol: "post",
            maxDurationSeconds: 60,
          });
          if (!direct.uploadUrl || !direct.uid) throw new Error("video_direct_upload_failed");
          pendingVideoUid = String(direct.uid);
          pendingVideoUploadUrl = String(direct.uploadUrl);
          pendingVideoBodyUploaded = false;
          await persistDraftProgress({
            recoverySubmissionId,
            pendingMediaRetryVisitId: visitId,
            pendingMediaRetryVideoUid: pendingVideoUid,
            pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
            pendingMediaRetryVideoBodyUploaded: false,
          });
        }
        if (!pendingVideoBodyUploaded) {
          const uploadResponse = await fetch(pendingVideoUploadUrl, {
            method: "PUT",
            headers: { "content-type": file.type || "video/mp4" },
            body: file,
          });
          if (!uploadResponse.ok) {
            pendingVideoUid = "";
            pendingVideoUploadUrl = "";
            await persistDraftProgress({
              recoverySubmissionId,
              pendingMediaRetryVisitId: visitId,
              pendingMediaRetryVideoUid: "",
              pendingMediaRetryVideoUploadUrl: "",
              pendingMediaRetryVideoBodyUploaded: false,
            });
            throw new Error("video_body_upload_failed");
          }
          pendingVideoBodyUploaded = true;
          await persistDraftProgress({
            recoverySubmissionId,
            pendingMediaRetryVisitId: visitId,
            pendingMediaRetryVideoUid: pendingVideoUid,
            pendingMediaRetryVideoUploadUrl: pendingVideoUploadUrl,
            pendingMediaRetryVideoBodyUploaded: true,
          });
        }
        await postJson("/api/v1/videos/" + encodeURIComponent(pendingVideoUid) + "/finalize", {
          observationId: visitId,
          durationMs: 1000,
          readyToStream: true,
        });
      }

      await deleteDraft();
        recoveredFiles = [];
        pendingRetryTarget = "";
        setPanelState("saved", isRetry ? copy.retry : copy.ready, isRetry ? copy.retried : copy.saved);
        setStatus(isRetry ? copy.retried : copy.saved, false);
        if (isRetry) void eventMetric("event_retry_succeeded", { retry_kind: "upload" });
      } catch (error) {
        console.error(error);
        if (!observationStored) {
          void eventMetric("event_observation_failed", { result_reason: observationFailureReason(error) });
        }
        if (saveButton) saveButton.disabled = false;
        setStatus(copy.failed, true);
      }
    });

    void restoreDraft();
  })();
  </script>
</body>
</html>`;
}
