import type { SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

type GuideCopy = {
  title: string;
  subtitle: string;
  startBtn: string;
  stopBtn: string;
  langLabel: string;
  categoryLabel: string;
  categories: { id: string; label: string }[];
  recordBtn: string;
  reviewTitle: string;
  noRecords: string;
  permissionDenied: string;
  photoFallbackHint: string;
  choosePhotoBtn: string;
  photoAnalysing: string;
  analysing: string;
  playing: string;
  privacyNotice: string;
  naturalSoundBadge: string;
  voiceExcludedNotice: string;
  audioUnavailableNotice: string;
  contextTitle: string;
  contextBody: string;
  audioTitle: string;
  audioEmpty: string;
  audioSkipped: string;
  audioUnnamed: string;
  nowTitle: string;
  nowHint: string;
  trailTitle: string;
  trailEmpty: string;
  trailPending: string;
  trailDeferred: string;
  playTrail: string;
  saveTrail: string;
};

const COPY: Record<SiteLang, GuideCopy> = {
  ja: {
    title: "ライブガイド",
    subtitle: "映像と音から、土地の物語を足跡に残します",
    startBtn: "ガイドを開始する",
    stopBtn: "停止する",
    langLabel: "言語",
    categoryLabel: "ガイドカテゴリ",
    categories: [
      { id: "biodiversity", label: "🌿 生物多様性" },
      { id: "land_history", label: "🗺️ 土地の歴史" },
      { id: "buildings", label: "🏛️ 建物・文化" },
      { id: "people_history", label: "👤 人の歴史" },
    ],
    recordBtn: "この発見を記録する",
    reviewTitle: "今日の気づき",
    noRecords: "まだ記録がありません",
    permissionDenied: "カメラを使えません。写真を選ぶと解析できます。",
    photoFallbackHint: "投稿用の写真を選ぶと、ライブ映像なしでガイド解析できます。",
    choosePhotoBtn: "投稿用写真を選ぶ",
    photoAnalysing: "写真を解析中…",
    analysing: "解析中…",
    playing: "▶ ガイド音声を再生中",
    privacyNotice: "人の声が入った音声は保存しません",
    naturalSoundBadge: "自然音だけを使っています",
    voiceExcludedNotice: "人声の可能性がある音を除外しました",
    audioUnavailableNotice: "マイクなしで開始しました。映像だけで解析します。",
    contextTitle: "主役と周囲を一緒に見る",
    contextBody: "ライブガイドは、目の前の主役だけでなく、周囲の生きもの・環境・音も手がかりとして読みます。記録するときは主役を1つ選べば十分です。",
    audioTitle: "今回の音の記録",
    audioEmpty: "自然音のまとまりはまだありません",
    audioSkipped: "一部の音声はプライバシー保護のため保存していません",
    audioUnnamed: "まだ名前が付いていない音",
    nowTitle: "Now",
    nowHint: "今の景色には短い状態だけを出します。AIの答えは少し前の足跡として下に残ります。",
    trailTitle: "Trail",
    trailEmpty: "さっきの発見はまだありません",
    trailPending: "さっきの景色を解析中",
    trailDeferred: "移動中なので足跡に残しました",
    playTrail: "聞く",
    saveTrail: "保存",
  },
  en: {
    title: "Live Guide",
    subtitle: "Continuous video & audio analysis — the land tells its story",
    startBtn: "Start Guide",
    stopBtn: "Stop",
    langLabel: "Language",
    categoryLabel: "Guide Category",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversity" },
      { id: "land_history", label: "🗺️ Land History" },
      { id: "buildings", label: "🏛️ Buildings & Culture" },
      { id: "people_history", label: "👤 Human History" },
    ],
    recordBtn: "Save this discovery",
    reviewTitle: "Today's Discoveries",
    noRecords: "No records yet",
    permissionDenied: "Camera is unavailable. Choose a photo to analyse instead.",
    photoFallbackHint: "Choose a post photo to run guide analysis without live video.",
    choosePhotoBtn: "Choose post photo",
    photoAnalysing: "Analysing photo…",
    analysing: "Analysing…",
    playing: "▶ Playing guide audio",
    privacyNotice: "Clips with human voices are not stored",
    naturalSoundBadge: "Using natural sounds only",
    voiceExcludedNotice: "Possible human voice was excluded",
    audioUnavailableNotice: "Started without microphone. Video analysis continues.",
    contextTitle: "Read the subject and its surroundings",
    contextBody: "Live Guide uses the main subject plus nearby organisms, habitat and sound as clues. When saving a record, choosing one subject is enough.",
    audioTitle: "Sounds From This Session",
    audioEmpty: "No natural sound bundles yet",
    audioSkipped: "Some clips were skipped for privacy",
    audioUnnamed: "Unnamed sound",
    nowTitle: "Now",
    nowHint: "The current view stays quiet. AI results appear below as earlier trail cards.",
    trailTitle: "Trail",
    trailEmpty: "No earlier discoveries yet",
    trailPending: "Analysing an earlier view",
    trailDeferred: "Saved to the trail while you keep moving",
    playTrail: "Play",
    saveTrail: "Save",
  },
  es: {
    title: "Guía de Campo",
    subtitle: "Análisis continuo de video y audio — la tierra cuenta su historia",
    startBtn: "Iniciar Guía",
    stopBtn: "Detener",
    langLabel: "Idioma",
    categoryLabel: "Categoría",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversidad" },
      { id: "land_history", label: "🗺️ Historia del lugar" },
      { id: "buildings", label: "🏛️ Edificios y cultura" },
      { id: "people_history", label: "👤 Historia humana" },
    ],
    recordBtn: "Guardar este hallazgo",
    reviewTitle: "Descubrimientos de hoy",
    noRecords: "Sin registros aún",
    permissionDenied: "La cámara no está disponible. Elige una foto para analizarla.",
    photoFallbackHint: "Elige una foto de publicación para usar la guía sin video en vivo.",
    choosePhotoBtn: "Elegir foto",
    photoAnalysing: "Analizando foto…",
    analysing: "Analizando…",
    playing: "▶ Reproduciendo audio",
    privacyNotice: "No guardamos clips con voces humanas",
    naturalSoundBadge: "Solo usamos sonidos naturales",
    voiceExcludedNotice: "Se excluyó audio con posible voz humana",
    audioUnavailableNotice: "Iniciado sin micrófono. El análisis de video continúa.",
    contextTitle: "Leer el sujeto y su entorno",
    contextBody: "La guía usa el sujeto principal, los organismos cercanos, el hábitat y el sonido como pistas. Al guardar, basta elegir un sujeto principal.",
    audioTitle: "Sonidos de esta sesión",
    audioEmpty: "Todavía no hay grupos de sonidos naturales",
    audioSkipped: "Algunos clips se omitieron por privacidad",
    audioUnnamed: "Sonido sin nombre",
    nowTitle: "Ahora",
    nowHint: "La vista actual se mantiene ligera. Los resultados aparecen abajo como tarjetas del recorrido.",
    trailTitle: "Recorrido",
    trailEmpty: "Todavía no hay descubrimientos anteriores",
    trailPending: "Analizando una vista anterior",
    trailDeferred: "Guardado en el recorrido mientras sigues avanzando",
    playTrail: "Escuchar",
    saveTrail: "Guardar",
  },
  "pt-BR": {
    title: "Guia de Campo",
    subtitle: "Análise contínua de vídeo e áudio — a terra conta sua história",
    startBtn: "Iniciar Guia",
    stopBtn: "Parar",
    langLabel: "Idioma",
    categoryLabel: "Categoria",
    categories: [
      { id: "biodiversity", label: "🌿 Biodiversidade" },
      { id: "land_history", label: "🗺️ História do lugar" },
      { id: "buildings", label: "🏛️ Edifícios e cultura" },
      { id: "people_history", label: "👤 História humana" },
    ],
    recordBtn: "Salvar esta descoberta",
    reviewTitle: "Descobertas de hoje",
    noRecords: "Nenhum registro ainda",
    permissionDenied: "A câmera não está disponível. Escolha uma foto para analisar.",
    photoFallbackHint: "Escolha uma foto de publicação para usar o guia sem vídeo ao vivo.",
    choosePhotoBtn: "Escolher foto",
    photoAnalysing: "Analisando foto…",
    analysing: "Analisando…",
    playing: "▶ Reproduzindo áudio",
    privacyNotice: "Clipes com voz humana não são salvos",
    naturalSoundBadge: "Usamos apenas sons naturais",
    voiceExcludedNotice: "Possível voz humana foi excluída",
    audioUnavailableNotice: "Iniciado sem microfone. A análise de vídeo continua.",
    contextTitle: "Ler o sujeito e o entorno",
    contextBody: "O guia usa o sujeito principal, organismos próximos, habitat e som como pistas. Ao salvar, basta escolher um sujeito principal.",
    audioTitle: "Sons desta sessão",
    audioEmpty: "Ainda não há grupos de sons naturais",
    audioSkipped: "Alguns clipes foram ignorados por privacidade",
    audioUnnamed: "Som sem nome",
    nowTitle: "Agora",
    nowHint: "A visão atual fica leve. Os resultados aparecem abaixo como cartões do trajeto.",
    trailTitle: "Trajeto",
    trailEmpty: "Ainda não há descobertas anteriores",
    trailPending: "Analisando uma visão anterior",
    trailDeferred: "Salvo no trajeto enquanto você continua andando",
    playTrail: "Ouvir",
    saveTrail: "Salvar",
  },
};

export function renderGuideFlow(basePath: string, lang: SiteLang): string {
  const c = COPY[lang];
  const cats = c.categories.map((cat) => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.label)}</option>`).join("");

  const langOptions = [
    { value: "ja", label: "🇯🇵 日本語" },
    { value: "en", label: "🇬🇧 English" },
    { value: "es", label: "🇪🇸 Español" },
    { value: "pt-BR", label: "🇧🇷 Português" },
    { value: "ko", label: "🇰🇷 한국어" },
    { value: "zh", label: "🇨🇳 中文" },
  ]
    .map((o) => `<option value="${escapeHtml(o.value)}"${o.value === lang ? " selected" : ""}>${escapeHtml(o.label)}</option>`)
    .join("");

  return `
<div class="guide-root" id="guide-root">
  <div class="guide-header">
    <h1 class="guide-title">${escapeHtml(c.title)}</h1>
    <p class="guide-subtitle">${escapeHtml(c.subtitle)}</p>
    <div class="guide-context-card">
      <strong>${escapeHtml(c.contextTitle)}</strong>
      <p>${escapeHtml(c.contextBody)}</p>
    </div>
  </div>

  <div class="guide-controls">
    <div class="guide-selects">
      <label class="guide-select-label">${escapeHtml(c.langLabel)}
        <select class="guide-select" id="guide-lang-select">${langOptions}</select>
      </label>
      <label class="guide-select-label">${escapeHtml(c.categoryLabel)}
        <select class="guide-select" id="guide-category-select">${cats}</select>
      </label>
    </div>
    <button class="guide-start-btn" id="guide-start-btn">${escapeHtml(c.startBtn)}</button>
    <div class="guide-privacy-row" aria-label="音声プライバシー">
      <span class="guide-privacy-badge">${escapeHtml(c.naturalSoundBadge)}</span>
      <p class="guide-privacy-note">${escapeHtml(c.privacyNotice)}</p>
    </div>
    <p class="guide-privacy-live" id="guide-privacy-live" hidden aria-live="polite"></p>
  </div>

  <div class="guide-now" id="guide-now" hidden>
    <div>
      <h2 class="guide-now-title">${escapeHtml(c.nowTitle)}</h2>
      <p class="guide-now-hint">${escapeHtml(c.nowHint)}</p>
    </div>
    <div class="guide-now-state" id="guide-now-state"></div>
  </div>

  <div class="guide-camera-wrap" id="guide-camera-wrap" hidden>
    <video class="guide-video" id="guide-video" autoplay playsinline muted></video>
    <div class="guide-status" id="guide-status"></div>
    <button class="guide-stop-btn" id="guide-stop-btn">${escapeHtml(c.stopBtn)}</button>
  </div>

  <div class="guide-permission-msg" id="guide-permission-msg" hidden>${escapeHtml(c.permissionDenied)}</div>
  <div class="guide-photo-fallback" id="guide-photo-fallback" hidden>
    <p>${escapeHtml(c.photoFallbackHint)}</p>
    <button class="guide-photo-btn" id="guide-photo-btn" type="button">${escapeHtml(c.choosePhotoBtn)}</button>
    <input class="guide-photo-input" id="guide-photo-input" type="file" accept="image/*" hidden>
  </div>

  <div class="guide-discoveries" id="guide-discoveries">
    <div class="guide-trail-header">
      <h2 class="guide-discoveries-title">${escapeHtml(c.trailTitle)}</h2>
      <span class="guide-trail-pill" id="guide-trail-pill" hidden></span>
    </div>
    <ul class="guide-discovery-list" id="guide-discovery-list">
      <li class="guide-no-records" id="guide-no-records">${escapeHtml(c.trailEmpty)}</li>
    </ul>
  </div>

  <div class="guide-audio" id="guide-audio">
    <div class="guide-audio-header">
      <h2 class="guide-audio-title">${escapeHtml(c.audioTitle)}</h2>
      <p class="guide-audio-note">${escapeHtml(c.privacyNotice)}</p>
    </div>
    <p class="guide-audio-skipped" id="guide-audio-skipped" hidden></p>
    <ul class="guide-audio-list" id="guide-audio-list">
      <li class="guide-no-records" id="guide-audio-empty">${escapeHtml(c.audioEmpty)}</li>
    </ul>
  </div>
</div>

<script>
(function () {
  const copy = {
    analysing: ${JSON.stringify(c.analysing)},
    playing: ${JSON.stringify(c.playing)},
    voiceExcludedNotice: ${JSON.stringify(c.voiceExcludedNotice)},
    audioUnavailableNotice: ${JSON.stringify(c.audioUnavailableNotice)},
    audioEmpty: ${JSON.stringify(c.audioEmpty)},
    audioSkipped: ${JSON.stringify(c.audioSkipped)},
    audioUnnamed: ${JSON.stringify(c.audioUnnamed)},
    photoAnalysing: ${JSON.stringify(c.photoAnalysing)},
    trailPending: ${JSON.stringify(c.trailPending)},
    trailDeferred: ${JSON.stringify(c.trailDeferred)},
    playTrail: ${JSON.stringify(c.playTrail)},
    saveTrail: ${JSON.stringify(c.saveTrail)}
  };
  const BASE = ${JSON.stringify(basePath)};

  let stream = null;
  let audioStream = null;
  let mediaRecorder = null;
  let audioContext = null;
  let analyser = null;
  let freqData = null;
  let timeData = null;
  let audioSampleTimer = null;
  let analyseTimer = null;
  let recapTimer = null;
  let running = false;
  let lastScene = null;
  let lastKnownPosition = { lat: 35.68, lng: 139.76 };
  let liveAssistToken = null;
  let sceneAudioChunks = [];
  let sceneAudioPrivacySkippedCount = 0;
  let analyserFrames = [];
  let clientPrivacySkippedCount = 0;
  const pendingScenes = new Map();
  const readyScenes = new Map();
  const sessionId = 'guide-' + Math.random().toString(36).slice(2);
  const preferredMime = pickAudioMimeType();

  const video      = document.getElementById('guide-video');
  const startBtn   = document.getElementById('guide-start-btn');
  const stopBtn    = document.getElementById('guide-stop-btn');
  const camWrap    = document.getElementById('guide-camera-wrap');
  const nowWrap    = document.getElementById('guide-now');
  const nowState   = document.getElementById('guide-now-state');
  const permMsg    = document.getElementById('guide-permission-msg');
  const photoFallback = document.getElementById('guide-photo-fallback');
  const photoBtn   = document.getElementById('guide-photo-btn');
  const photoInput = document.getElementById('guide-photo-input');
  const statusEl   = document.getElementById('guide-status');
  const listEl     = document.getElementById('guide-discovery-list');
  const noRec      = document.getElementById('guide-no-records');
  const trailPill  = document.getElementById('guide-trail-pill');
  const audioList  = document.getElementById('guide-audio-list');
  const audioEmpty = document.getElementById('guide-audio-empty');
  const audioSkip  = document.getElementById('guide-audio-skipped');
  const privacyLive = document.getElementById('guide-privacy-live');

  function getLang() { return document.getElementById('guide-lang-select').value; }
  function getCategory() { return document.getElementById('guide-category-select').value; }
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function setNowState(msg) { if (nowState) nowState.textContent = msg || ''; }
  function escapeInline(value) {
    return String(value || '').replace(/[&<>\"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char;
    });
  }
  function pickAudioMimeType() {
    if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== 'function') return null;
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const mime of candidates) {
      if (window.MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return null;
  }
  async function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 35.68, lng: 139.76 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 35.68, lng: 139.76 }),
        { maximumAge: 60000, timeout: 8000 }
      );
    });
  }
  function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }
  function captureFrameThumb() {
    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = 108;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.46);
  }
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
  }
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image_load_failed'));
      };
      image.src = url;
    });
  }
  function drawImageData(image, maxWidth, maxHeight, quality) {
    const ratio = Math.min(maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight), 1);
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }
  async function buildGuideFramesFromFile(file) {
    const image = await loadImageFromFile(file);
    const frameDataUrl = drawImageData(image, 1280, 1280, 0.78);
    return {
      frame: frameDataUrl.split(',')[1],
      frameThumb: drawImageData(image, 144, 108, 0.46)
    };
  }
  async function captureAudioForScene() {
    const chunks = sceneAudioChunks.splice(0);
    if (!chunks.length) return null;
    return blobToBase64(new Blob(chunks, { type: preferredMime || 'audio/webm' }));
  }
  async function playAudio(base64Pcm) {
    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const raw = atob(base64Pcm);
      const buf = new Int16Array(raw.length / 2);
      for (let i = 0; i < buf.length; i++) buf[i] = (raw.charCodeAt(i * 2)) | (raw.charCodeAt(i * 2 + 1) << 8);
      const audioBuf = ctx.createBuffer(1, buf.length, 24000);
      const ch = audioBuf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) ch[i] = buf[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.start();
      setStatus(copy.playing);
      src.onended = () => { setStatus(''); ctx.close(); };
    } catch (e) {
      console.error('TTS playback error', e);
    }
  }
  function updateTrailPill() {
    if (!trailPill) return;
    const pendingCount = pendingScenes.size;
    if (pendingCount > 0) {
      trailPill.hidden = false;
      trailPill.textContent = copy.trailPending + ' ' + pendingCount;
    } else {
      trailPill.hidden = true;
      trailPill.textContent = '';
    }
  }
  function addPendingDiscovery(scene) {
    if (noRec) noRec.remove();
    const li = document.createElement('li');
    li.className = 'guide-discovery-item guide-discovery-pending';
    li.id = 'scene-' + scene.sceneId;
    li.innerHTML = '<div class="gdi-thumb-wrap">' + (scene.frameThumb ? '<img class="gdi-thumb" src="' + escapeInline(scene.frameThumb) + '" alt="">' : '<span class="gdi-icon">📍</span>') + '</div>'
      + '<div class="gdi-body"><div class="gdi-kicker">' + escapeInline(copy.trailPending) + '</div>'
      + '<div class="gdi-summary">' + escapeInline(formatCaptured(scene.capturedAt)) + '</div></div>';
    listEl.prepend(li);
    updateTrailPill();
  }
  function formatCaptured(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function formatDistance(value) {
    if (typeof value !== 'number') return '';
    const lang = getLang();
    if (lang === 'ja') return ' · 現在地から' + value + 'm';
    return ' · ' + value + 'm from current';
  }
  function renderReadyDiscovery(scene) {
    const existing = document.getElementById('scene-' + scene.sceneId);
    const li = existing || document.createElement('li');
    li.className = 'guide-discovery-item';
    li.id = 'scene-' + scene.sceneId;
    const species = Array.isArray(scene.detectedSpecies) ? scene.detectedSpecies : [];
    const distance = formatDistance(scene.distanceFromCurrentM);
    li.innerHTML = '<div class="gdi-thumb-wrap">' + (scene.frameThumb ? '<img class="gdi-thumb" src="' + escapeInline(scene.frameThumb) + '" alt="">' : '<span class="gdi-icon">📍</span>') + '</div>'
      + '<div class="gdi-body">'
      + '<div class="gdi-kicker">' + escapeInline(formatCaptured(scene.capturedAt) + distance) + '</div>'
      + '<div class="gdi-summary">' + escapeInline(scene.delayedSummary || scene.summary || '') + '</div>'
      + (species.length ? '<div class="gdi-species">' + species.map(escapeInline).join(' · ') + '</div>' : '')
      + (scene.uncertaintyReason ? '<div class="gdi-note">' + escapeInline(scene.uncertaintyReason) + '</div>' : '')
      + '<div class="gdi-why">' + escapeInline(scene.whyInteresting || '') + '</div>'
      + '<div class="gdi-next">' + escapeInline(scene.nextLookTarget || '') + '</div>'
      + (scene.deliveryState === 'deferred' ? '<div class="gdi-deferred">' + escapeInline(copy.trailDeferred) + '</div>' : '')
      + '<div class="gdi-actions"><button type="button" class="gdi-play" data-scene-id="' + escapeInline(scene.sceneId) + '">' + escapeInline(copy.playTrail) + '</button>'
      + '<button type="button" class="gdi-save" data-scene-id="' + escapeInline(scene.sceneId) + '">' + escapeInline(copy.saveTrail) + '</button></div>'
      + '</div>';
    if (!existing) listEl.prepend(li);
    readyScenes.set(scene.sceneId, scene);
    updateTrailPill();
  }
  function startAnalyser() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || !audioStream || !audioStream.getAudioTracks().length) return;
    audioContext = new AudioCtor();
    const source = audioContext.createMediaStreamSource(audioStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);
    freqData = new Float32Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    audioSampleTimer = window.setInterval(sampleAudioFrame, 250);
  }
  function sampleAudioFrame() {
    if (!analyser || !freqData || !timeData) return;
    analyser.getFloatFrequencyData(freqData);
    analyser.getFloatTimeDomainData(timeData);
    analyserFrames.push({ ts: Date.now(), ...summarizeSpectrum(freqData, timeData, audioContext ? audioContext.sampleRate : 24000) });
    if (analyserFrames.length > 160) analyserFrames = analyserFrames.slice(-160);
  }
  function summarizeSpectrum(freqValues, timeValues, sampleRate) {
    const amplitudes = Array.from(freqValues, function (value) {
      return Number.isFinite(value) ? Math.pow(10, value / 20) : 0;
    });
    const total = amplitudes.reduce((sum, value) => sum + value, 0);
    const bandDefs = [
      [0, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000], [4000, 8000]
    ];
    if (!total) {
      return { peakHz: 0, centroidHz: 0, rolloffHz: 0, energy: 0, voiceBandRatio: 0, bandEnergies: bandDefs.map(() => 0) };
    }
    let peakIndex = 0;
    let centroidAcc = 0;
    const bandValues = bandDefs.map(() => 0);
    let voiceValue = 0;
    for (let index = 0; index < amplitudes.length; index += 1) {
      const value = amplitudes[index];
      if (value > amplitudes[peakIndex]) peakIndex = index;
      const hz = (index * sampleRate) / (2 * amplitudes.length);
      centroidAcc += hz * value;
      for (let bandIndex = 0; bandIndex < bandDefs.length; bandIndex += 1) {
        const band = bandDefs[bandIndex];
        if (hz >= band[0] && hz < band[1]) bandValues[bandIndex] += value;
      }
      if (hz >= 300 && hz <= 3400) voiceValue += value;
    }
    let cumulative = 0;
    let rolloffHz = 0;
    for (let index = 0; index < amplitudes.length; index += 1) {
      cumulative += amplitudes[index];
      if (cumulative >= total * 0.85) {
        rolloffHz = (index * sampleRate) / (2 * amplitudes.length);
        break;
      }
    }
    let rmsAcc = 0;
    for (let index = 0; index < timeValues.length; index += 1) {
      rmsAcc += timeValues[index] * timeValues[index];
    }
    const bandSum = bandValues.reduce((sum, value) => sum + value, 0) || 1;
    return {
      peakHz: (peakIndex * sampleRate) / (2 * amplitudes.length),
      centroidHz: centroidAcc / total,
      rolloffHz: rolloffHz,
      energy: Math.sqrt(rmsAcc / Math.max(1, timeValues.length)),
      voiceBandRatio: voiceValue / total,
      bandEnergies: bandValues.map((value) => value / bandSum)
    };
  }
  function summarizeFrames() {
    const cutoff = Date.now() - 3200;
    const frames = analyserFrames.filter((frame) => frame.ts >= cutoff);
    if (!frames.length) return null;
    const merged = { peakHz: 0, centroidHz: 0, rolloffHz: 0, energy: 0, voiceBandRatio: 0, bandEnergies: [] };
    for (const frame of frames) {
      merged.peakHz += frame.peakHz || 0;
      merged.centroidHz += frame.centroidHz || 0;
      merged.rolloffHz += frame.rolloffHz || 0;
      merged.energy += frame.energy || 0;
      merged.voiceBandRatio += frame.voiceBandRatio || 0;
      const bands = Array.isArray(frame.bandEnergies) ? frame.bandEnergies : [];
      for (let index = 0; index < bands.length; index += 1) {
        merged.bandEnergies[index] = (merged.bandEnergies[index] || 0) + (bands[index] || 0);
      }
    }
    return {
      version: 'v1',
      frameCount: frames.length,
      peakHz: merged.peakHz / frames.length,
      centroidHz: merged.centroidHz / frames.length,
      rolloffHz: merged.rolloffHz / frames.length,
      energy: merged.energy / frames.length,
      voiceBandRatio: merged.voiceBandRatio / frames.length,
      bandEnergies: merged.bandEnergies.map((value) => value / frames.length)
    };
  }
  function classifySpeech(fingerprint) {
    if (!fingerprint) return { speechLikely: true, confidence: 0.5, reason: 'missing_fingerprint' };
    const bands = Array.isArray(fingerprint.bandEnergies) ? fingerprint.bandEnergies : [];
    const highBandRatio = bands.length ? (bands[bands.length - 1] || 0) : 0;
    let speechScore = 0;
    if ((fingerprint.voiceBandRatio || 0) >= 0.68) speechScore += 0.45;
    if ((fingerprint.centroidHz || 0) >= 250 && (fingerprint.centroidHz || 0) <= 2200) speechScore += 0.2;
    if ((fingerprint.peakHz || 0) >= 90 && (fingerprint.peakHz || 0) <= 1200) speechScore += 0.15;
    if (highBandRatio <= 0.14) speechScore += 0.1;
    if ((fingerprint.energy || 0) >= 0.02) speechScore += 0.1;
    const speechLikely = speechScore >= 0.6;
    return {
      speechLikely: speechLikely,
      confidence: speechLikely ? Math.min(0.95, 0.55 + (speechScore * 0.35)) : Math.max(0.6, 0.82 - (speechScore * 0.25)),
      reason: speechLikely ? 'voice_band_detected' : 'natural_sound_likely',
      voiceBandRatio: fingerprint.voiceBandRatio || 0,
      energy: fingerprint.energy || 0
    };
  }
  function renderAudioBundles(recap) {
    const bundles = Array.isArray(recap && recap.soundBundles) ? recap.soundBundles : [];
    audioList.innerHTML = '';
    if (!bundles.length) {
      const empty = document.createElement('li');
      empty.className = 'guide-no-records';
      empty.id = 'guide-audio-empty';
      empty.textContent = copy.audioEmpty;
      audioList.appendChild(empty);
    } else {
      bundles.forEach(function (bundle) {
        const item = document.createElement('li');
        item.className = 'guide-audio-item';
        const first = bundle.firstRecordedAt ? new Date(bundle.firstRecordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const last = bundle.lastRecordedAt ? new Date(bundle.lastRecordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const note = bundle.note || copy.audioUnnamed;
        item.innerHTML = '<div class="guide-audio-card">'
          + '<div class="guide-audio-card-head"><strong>' + escapeInline(bundle.label || copy.audioUnnamed) + '</strong><span>' + escapeInline(note) + '</span></div>'
          + '<div class="guide-audio-meta">' + escapeInline(String(bundle.segmentCount || 0)) + ' clips · '
          + escapeInline(Number(bundle.totalDurationSec || 0).toFixed(1)) + ' sec · '
          + escapeInline(first + ' - ' + last) + '</div>'
          + (bundle.representativeAudioUrl ? '<audio class="guide-audio-player" controls preload="none" src="' + escapeInline(bundle.representativeAudioUrl) + '"></audio>' : '')
          + '</div>';
        audioList.appendChild(item);
      });
    }
    const skippedCount = Math.max(Number(recap && recap.privacySkippedCount || 0), clientPrivacySkippedCount);
    if (skippedCount > 0) {
      audioSkip.hidden = false;
      audioSkip.textContent = copy.voiceExcludedNotice + ' (' + skippedCount + ')';
    } else {
      audioSkip.hidden = true;
      audioSkip.textContent = '';
    }
  }
  async function refreshRecap() {
    try {
      const response = await fetch(BASE + '/api/v1/fieldscan/session/' + encodeURIComponent(sessionId) + '/recap');
      const payload = await response.json();
      if (payload && payload.ok && payload.recap) renderAudioBundles(payload.recap);
    } catch (error) {
      console.error('Guide recap error', error);
    }
  }
  function scheduleRecapRefresh() {
    clearTimeout(recapTimer);
    recapTimer = setTimeout(refreshRecap, 600);
  }
  async function uploadAudioChunk(blob, fingerprint, vad) {
    if (!blob || !blob.size || !preferredMime) return;
    try {
      const base64Data = await blobToBase64(blob);
      const payload = {
        sessionId: sessionId,
        recordedAt: new Date().toISOString(),
        durationSec: 2,
        lat: lastKnownPosition.lat,
        lng: lastKnownPosition.lng,
        filename: 'guide-audio.webm',
        mimeType: blob.type || preferredMime,
        base64Data: base64Data,
        meta: {
          captureProfile: 'opus_mono_24khz_32kbps_2s',
          audioFingerprint: fingerprint,
          clientVadResult: vad
        }
      };
      await fetch(BASE + '/api/v1/fieldscan/audio/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Audio upload error', error);
    }
    scheduleRecapRefresh();
  }
  function handleAudioChunk(blob) {
    if (!blob || !blob.size) return;
    const fingerprint = summarizeFrames();
    const vad = classifySpeech(fingerprint);
    if (vad.speechLikely) {
      clientPrivacySkippedCount += 1;
      sceneAudioPrivacySkippedCount += 1;
      if (privacyLive) {
        privacyLive.hidden = false;
        privacyLive.textContent = copy.voiceExcludedNotice;
      }
      scheduleRecapRefresh();
      return;
    }
    sceneAudioChunks.push(blob);
    void uploadAudioChunk(blob, fingerprint, vad);
  }
  async function doAnalyse() {
    if (!running) return;
    setStatus(copy.analysing);
    setNowState(copy.analysing);
    try {
      lastKnownPosition = await getLocation();
      const frame = captureFrame();
      const frameThumb = captureFrameThumb();
      const capturedAt = new Date().toISOString();
      const audio = await captureAudioForScene();
      const audioPrivacySkippedCount = sceneAudioPrivacySkippedCount;
      sceneAudioPrivacySkippedCount = 0;
      const lang = getLang();
      const sceneRes = await fetch(BASE + '/api/v1/guide/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame,
          frameThumb,
          audio,
          lat: lastKnownPosition.lat,
          lng: lastKnownPosition.lng,
          lang,
          sessionId,
          capturedAt,
          audioPrivacy: {
            clientSkippedCount: audioPrivacySkippedCount,
            policy: 'exclude_speech_likely_chunks'
          }
        })
      }).then((r) => r.json());
      if (sceneRes && sceneRes.sceneId) {
        pendingScenes.set(sceneRes.sceneId, sceneRes);
        addPendingDiscovery(sceneRes);
        void watchScene(sceneRes.sceneId);
      }
      setStatus('');
      setNowState('');
    } catch (e) {
      console.error('Guide analyse error', e);
      setStatus('');
      setNowState('');
    }
    scheduleRecapRefresh();
    if (running) analyseTimer = setTimeout(doAnalyse, 8000);
  }
  async function analyseSelectedPhoto(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    setNowState(copy.photoAnalysing);
    if (nowWrap) nowWrap.hidden = false;
    if (photoBtn) photoBtn.disabled = true;
    try {
      lastKnownPosition = await getLocation();
      const frames = await buildGuideFramesFromFile(file);
      const capturedAt = new Date().toISOString();
      const lang = getLang();
      const sceneRes = await fetch(BASE + '/api/v1/guide/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame: frames.frame,
          frameThumb: frames.frameThumb,
          audio: null,
          lat: lastKnownPosition.lat,
          lng: lastKnownPosition.lng,
          lang,
          sessionId,
          capturedAt,
          audioPrivacy: {
            clientSkippedCount: 0,
            policy: 'photo_fallback_no_audio'
          }
        })
      }).then((r) => r.json());
      if (sceneRes && sceneRes.sceneId) {
        pendingScenes.set(sceneRes.sceneId, sceneRes);
        addPendingDiscovery(sceneRes);
        void watchScene(sceneRes.sceneId);
      }
    } catch (error) {
      console.error('Guide photo fallback error', error);
    } finally {
      setNowState('');
      if (photoBtn) photoBtn.disabled = false;
    }
  }
  async function watchScene(sceneId) {
    if (!('EventSource' in window)) {
      void pollScene(sceneId, 0);
      return;
    }
    try {
      const pos = await getLocation();
      const params = new URLSearchParams({ currentLat: String(pos.lat), currentLng: String(pos.lng) });
      const source = new EventSource(BASE + '/api/v1/guide/scene/' + encodeURIComponent(sceneId) + '/events?' + params.toString());
      let closed = false;
      const close = function () {
        closed = true;
        source.close();
      };
      source.addEventListener('ready', function (event) {
        const scene = JSON.parse(event.data || '{}');
        pendingScenes.delete(sceneId);
        lastScene = scene;
        renderReadyDiscovery(scene);
        close();
      });
      source.addEventListener('scene-error', function () {
        pendingScenes.delete(sceneId);
        const item = document.getElementById('scene-' + sceneId);
        if (item) item.remove();
        updateTrailPill();
        close();
      });
      source.addEventListener('timeout', function () {
        close();
        void pollScene(sceneId, 0);
      });
      source.onerror = function () {
        if (closed || !pendingScenes.has(sceneId)) return;
        close();
        void pollScene(sceneId, 0);
      };
    } catch (error) {
      console.error('Guide scene stream error', error);
      void pollScene(sceneId, 0);
    }
  }
  async function pollScene(sceneId, attempt) {
    if (!pendingScenes.has(sceneId) || attempt > 24) {
      updateTrailPill();
      return;
    }
    const delay = attempt < 3 ? 1000 : 1800;
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const pos = await getLocation();
      const params = new URLSearchParams({ currentLat: String(pos.lat), currentLng: String(pos.lng) });
      const response = await fetch(BASE + '/api/v1/guide/scene/' + encodeURIComponent(sceneId) + '?' + params.toString());
      if (!response.ok) throw new Error('scene poll ' + response.status);
      const scene = await response.json();
      if (scene.status === 'ready') {
        pendingScenes.delete(sceneId);
        lastScene = scene;
        renderReadyDiscovery(scene);
        return;
      }
      if (scene.status === 'error') {
        pendingScenes.delete(sceneId);
        const item = document.getElementById('scene-' + sceneId);
        if (item) item.remove();
        updateTrailPill();
        return;
      }
    } catch (error) {
      console.error('Guide scene poll error', error);
    }
    void pollScene(sceneId, attempt + 1);
  }
  async function prepareLiveAssist() {
    try {
      const response = await fetch(BASE + '/api/v1/guide/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: getLang() })
      });
      if (!response.ok) return;
      liveAssistToken = await response.json();
    } catch (error) {
      liveAssistToken = null;
    }
  }
  function showPrivacyNotice(message) {
    if (!privacyLive) return;
    privacyLive.hidden = false;
    privacyLive.textContent = message;
  }
  async function startOptionalAudioCapture() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showPrivacyNotice(copy.audioUnavailableNotice);
      return;
    }
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      });
    } catch (error) {
      audioStream = null;
      showPrivacyNotice(copy.audioUnavailableNotice);
      console.info('Guide microphone unavailable; continuing video-only', error);
      return;
    }
    if (!running) {
      audioStream.getTracks().forEach((track) => track.stop());
      audioStream = null;
      return;
    }
    if (window.MediaRecorder && preferredMime && audioStream.getAudioTracks().length) {
      try {
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: preferredMime, audioBitsPerSecond: 32000 });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            handleAudioChunk(e.data);
          }
        };
        mediaRecorder.start(2000);
      } catch (error) {
        mediaRecorder = null;
        showPrivacyNotice(copy.audioUnavailableNotice);
        console.info('Guide audio recording unavailable; continuing video-only', error);
      }
    }
    startAnalyser();
  }
  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      lastKnownPosition = await getLocation();
      video.srcObject = stream;
      running = true;
      if (privacyLive) {
        privacyLive.hidden = true;
        privacyLive.textContent = '';
      }
      void startOptionalAudioCapture();
      void prepareLiveAssist();
      camWrap.hidden = false;
      if (nowWrap) nowWrap.hidden = false;
      startBtn.hidden = true;
      permMsg.hidden = true;
      if (photoFallback) photoFallback.hidden = true;
      analyseTimer = setTimeout(doAnalyse, 5000);
      scheduleRecapRefresh();
    } catch (err) {
      permMsg.hidden = false;
      if (photoFallback) photoFallback.hidden = false;
      console.error('Guide camera unavailable', err);
    }
  });
  if (photoBtn && photoInput) {
    photoBtn.addEventListener('click', () => {
      photoInput.click();
    });
    photoInput.addEventListener('change', () => {
      const file = photoInput.files && photoInput.files[0];
      if (file) void analyseSelectedPhoto(file);
      photoInput.value = '';
    });
  }
  stopBtn.addEventListener('click', () => {
    running = false;
    clearTimeout(analyseTimer);
    clearTimeout(recapTimer);
    if (audioSampleTimer) clearInterval(audioSampleTimer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => undefined);
    stream = null;
    audioStream = null;
    mediaRecorder = null;
    audioSampleTimer = null;
    analyser = null;
    freqData = null;
    timeData = null;
    camWrap.hidden = true;
    if (nowWrap) nowWrap.hidden = true;
    startBtn.hidden = false;
    setStatus('');
    setNowState('');
    scheduleRecapRefresh();
  });
  async function playTrailScene(scene) {
    if (!scene) return;
    const ttsRes = await fetch(BASE + '/api/v1/guide/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneSummary: [
          scene.delayedSummary || scene.summary || '',
          scene.whyInteresting || '',
          scene.nextLookTarget || ''
        ].filter(Boolean).join('\\n'),
        category: getCategory(),
        lang: getLang(),
        lat: scene.lat || lastKnownPosition.lat,
        lng: scene.lng || lastKnownPosition.lng,
        detectedSpecies: scene.detectedSpecies || [],
      })
    }).then((r) => r.json());
    if (ttsRes.audioBase64) await playAudio(ttsRes.audioBase64);
  }
  async function saveTrailScene(scene, button) {
    if (!scene) return;
    await fetch(BASE + '/api/v1/guide/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        lang: getLang(),
        lat: scene.lat || lastKnownPosition.lat,
        lng: scene.lng || lastKnownPosition.lng,
        capturedAt: scene.capturedAt,
        returnedAt: scene.returnedAt,
        currentDistanceM: scene.distanceFromCurrentM,
        frameThumb: scene.frameThumb,
        sceneHash: scene.sceneHash,
        sceneSummary: scene.delayedSummary || scene.summary || '',
        detectedSpecies: scene.detectedSpecies || [],
        ttsScript: null,
      })
    });
    if (button) {
      const old = button.textContent;
      button.textContent = '✓';
      setTimeout(() => { button.textContent = old; }, 1600);
    }
  }
  listEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const sceneId = target.getAttribute('data-scene-id');
    if (!sceneId) return;
    const scene = readyScenes.get(sceneId);
    if (target.classList.contains('gdi-play')) {
      void playTrailScene(scene);
    } else if (target.classList.contains('gdi-save')) {
      void saveTrailScene(scene, target);
    }
  });
})();
</script>`;
}

export const GUIDE_FLOW_STYLES = `
  .guide-root { max-width: 640px; min-height: calc(100vh - 80px); margin: 0 auto; padding: 30px 16px 64px; background-image: linear-gradient(rgba(16,185,129,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,.045) 1px, transparent 1px); background-size: 56px 56px; }
  .guide-header { margin-bottom: 24px; }
  .guide-title { font-size: 32px; font-weight: 950; color: #0f172a; letter-spacing: 0; line-height: 1.12; margin: 0 0 8px; }
  .guide-subtitle { font-size: 14px; color: #475569; margin: 0; line-height: 1.7; font-weight: 700; }
  .guide-context-card { margin-top: 14px; display: grid; gap: 5px; padding: 12px 13px; border-radius: 8px; background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.9)); border: 1px solid rgba(5,150,105,.18); box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-context-card strong { color: #064e3b; font-size: 13px; line-height: 1.35; font-weight: 950; }
  .guide-context-card p { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 800; }
  .guide-controls { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
  .guide-privacy-row { display: grid; gap: 8px; padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,.86); border: 1px solid rgba(5,150,105,.18); box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-privacy-badge { width: fit-content; display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 950; border: 1px solid rgba(5,150,105,.2); }
  .guide-privacy-note { margin: 0; font-size: 12px; color: #047857; line-height: 1.6; font-weight: 800; }
  .guide-privacy-live { margin: -4px 0 0; padding: 8px 10px; border-radius: 8px; background: rgba(254,249,195,.92); color: #854d0e; border: 1px solid rgba(202,138,4,.2); font-size: 12px; line-height: 1.55; font-weight: 850; }
  .guide-privacy-live[hidden] { display: none; }
  .guide-selects { display: flex; gap: 10px; flex-wrap: wrap; }
  .guide-select-label { font-size: 11px; font-weight: 900; color: #334155; text-transform: uppercase; letter-spacing: 0; display: flex; flex-direction: column; gap: 5px; }
  .guide-select { padding: 9px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.12); background: rgba(255,255,255,.92); font-size: 13px; font-weight: 800; color: #0f172a; cursor: pointer; box-shadow: 0 6px 16px rgba(15,23,42,.04); }
  .guide-start-btn { min-height: 56px; padding: 14px 24px; border-radius: 999px; background: #059669; color: #fff; font-size: 15px; font-weight: 950; border: none; cursor: pointer; box-shadow: 0 12px 26px rgba(5,150,105,.24); transition: transform .15s ease, box-shadow .15s ease, background .15s ease; }
  .guide-start-btn:hover { transform: translateY(-2px); background: #047857; box-shadow: 0 16px 30px rgba(5,150,105,.28); }
  .guide-now[hidden] { display: none; }
  .guide-now { margin-bottom: 14px; padding: 13px 14px; border-radius: 8px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.08); display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; box-shadow: 0 8px 20px rgba(15,23,42,.04); }
  .guide-now-title { margin: 0 0 4px; font-size: 13px; font-weight: 900; color: #0f172a; }
  .guide-now-hint { margin: 0; font-size: 12px; color: #64748b; line-height: 1.6; }
  .guide-now-state { min-width: 72px; text-align: right; font-size: 12px; color: #047857; font-weight: 900; }
  .guide-camera-wrap { position: relative; background: #0f172a; border-radius: 8px; overflow: hidden; margin-bottom: 20px; box-shadow: 0 14px 34px rgba(15,23,42,.18); }
  .guide-video { width: 100%; display: block; border-radius: 8px; max-height: 360px; object-fit: cover; }
  .guide-status { position: absolute; top: 12px; left: 12px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 12px; font-weight: 800; backdrop-filter: blur(6px); }
  .guide-stop-btn { position: absolute; bottom: 12px; right: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(239,68,68,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-record-btn { position: absolute; bottom: 12px; left: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(16,185,129,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-permission-msg { padding: 16px; border-radius: 8px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); color: #b91c1c; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  .guide-photo-fallback[hidden] { display: none; }
  .guide-photo-fallback { margin: -6px 0 20px; padding: 14px; border-radius: 8px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.1); box-shadow: 0 8px 20px rgba(15,23,42,.05); display: grid; gap: 10px; }
  .guide-photo-fallback p { margin: 0; color: #475569; font-size: 12px; line-height: 1.65; font-weight: 800; }
  .guide-photo-btn { min-height: 46px; padding: 10px 16px; border-radius: 999px; border: none; background: #0f172a; color: #fff; font-size: 13px; font-weight: 900; cursor: pointer; }
  .guide-photo-btn:disabled { opacity: .62; cursor: wait; }
  .guide-discoveries { margin-top: 24px; }
  .guide-trail-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .guide-discoveries-title { font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; margin: 0 0 12px; }
  .guide-trail-header .guide-discoveries-title { margin: 0; }
  .guide-trail-pill { flex: 0 0 auto; border-radius: 999px; padding: 4px 9px; background: rgba(5,150,105,.1); color: #047857; font-size: 11px; font-weight: 900; }
  .guide-discovery-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-no-records { font-size: 13px; color: #94a3b8; padding: 12px 0; }
  .guide-discovery-item { display: flex; gap: 12px; padding: 12px 14px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); border-radius: 8px; box-shadow: 0 8px 20px rgba(15,23,42,.05); }
  .guide-discovery-pending { background: rgba(248,250,252,.94); }
  .gdi-thumb-wrap { width: 62px; height: 52px; border-radius: 7px; overflow: hidden; background: #e2e8f0; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
  .gdi-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gdi-icon { font-size: 18px; flex-shrink: 0; }
  .gdi-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .gdi-kicker { font-size: 10px; color: #64748b; font-weight: 800; }
  .gdi-summary { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.5; }
  .gdi-species { font-size: 11px; color: #047857; font-weight: 700; }
  .gdi-note { font-size: 12px; color: #b45309; background: rgba(245,158,11,.1); border-radius: 7px; padding: 7px 8px; line-height: 1.45; }
  .gdi-why, .gdi-next { font-size: 12px; color: #475569; line-height: 1.55; }
  .gdi-next { color: #0f766e; font-weight: 700; }
  .gdi-deferred { font-size: 11px; color: #047857; font-weight: 900; }
  .gdi-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .gdi-actions button { border: 1px solid rgba(15,23,42,.12); background: #fff; color: #0f172a; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; cursor: pointer; min-height: 34px; }
  .gdi-actions .gdi-play { background: #0f172a; color: #fff; }
  .guide-audio { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  .guide-audio-header { display: flex; flex-direction: column; gap: 6px; }
  .guide-audio-title { margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; }
  .guide-audio-note { margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
  .guide-audio-skipped { margin: 0; font-size: 12px; color: #b45309; background: rgba(245,158,11,.10); border: 1px solid rgba(245,158,11,.16); border-radius: 8px; padding: 10px 12px; }
  .guide-audio-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-item { margin: 0; }
  .guide-audio-card { background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); border-radius: 8px; padding: 14px; box-shadow: 0 8px 20px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-card-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .guide-audio-card-head strong { font-size: 14px; color: #0f172a; }
  .guide-audio-card-head span { font-size: 12px; color: #0f766e; font-weight: 700; }
  .guide-audio-meta { font-size: 12px; color: #64748b; }
  .guide-audio-player { width: 100%; }
`;
