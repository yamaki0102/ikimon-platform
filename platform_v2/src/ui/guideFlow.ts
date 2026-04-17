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
  analysing: string;
  playing: string;
};

const COPY: Record<SiteLang, GuideCopy> = {
  ja: {
    title: "フィールドガイド",
    subtitle: "常時映像・音声を分析し、土地の物語をガイドします",
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
    permissionDenied: "カメラ・マイクへのアクセスが必要です",
    analysing: "解析中…",
    playing: "▶ ガイド音声を再生中",
  },
  en: {
    title: "Field Guide",
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
    permissionDenied: "Camera & microphone access required",
    analysing: "Analysing…",
    playing: "▶ Playing guide audio",
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
    permissionDenied: "Se requiere acceso a cámara y micrófono",
    analysing: "Analizando…",
    playing: "▶ Reproduciendo audio",
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
    permissionDenied: "Acesso à câmera e microfone necessário",
    analysing: "Analisando…",
    playing: "▶ Reproduzindo áudio",
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
  </div>

  <div class="guide-camera-wrap" id="guide-camera-wrap" hidden>
    <video class="guide-video" id="guide-video" autoplay playsinline muted></video>
    <div class="guide-status" id="guide-status"></div>
    <button class="guide-stop-btn" id="guide-stop-btn">${escapeHtml(c.stopBtn)}</button>
    <button class="guide-record-btn" id="guide-record-btn" hidden>${escapeHtml(c.recordBtn)}</button>
  </div>

  <div class="guide-permission-msg" id="guide-permission-msg" hidden>${escapeHtml(c.permissionDenied)}</div>

  <div class="guide-discoveries" id="guide-discoveries">
    <h2 class="guide-discoveries-title">${escapeHtml(c.reviewTitle)}</h2>
    <ul class="guide-discovery-list" id="guide-discovery-list">
      <li class="guide-no-records" id="guide-no-records">${escapeHtml(c.noRecords)}</li>
    </ul>
  </div>
</div>

<script>
(function () {
  const analysing = ${JSON.stringify(c.analysing)};
  const playing   = ${JSON.stringify(c.playing)};
  const BASE      = ${JSON.stringify(basePath)};

  let stream = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let analyseTimer = null;
  let running = false;
  let lastScene = null;
  const sessionId = 'guide-' + Math.random().toString(36).slice(2);

  const video    = document.getElementById('guide-video');
  const startBtn = document.getElementById('guide-start-btn');
  const stopBtn  = document.getElementById('guide-stop-btn');
  const recBtn   = document.getElementById('guide-record-btn');
  const camWrap  = document.getElementById('guide-camera-wrap');
  const permMsg  = document.getElementById('guide-permission-msg');
  const statusEl = document.getElementById('guide-status');
  const listEl   = document.getElementById('guide-discovery-list');
  const noRec    = document.getElementById('guide-no-records');

  function getLang()     { return document.getElementById('guide-lang-select').value; }
  function getCategory() { return document.getElementById('guide-category-select').value; }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  async function getLocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ lat: 35.68, lng: 139.76 }); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 35.68, lng: 139.76 }),
        { maximumAge: 60000, timeout: 8000 }
      );
    });
  }

  function captureFrame() {
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  }

  function captureAudio() {
    const chunks = audioChunks.splice(0);
    if (!chunks.length) return null;
    const blob = new Blob(chunks, { type: 'audio/webm' });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  async function playAudio(base64Pcm) {
    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      const raw = atob(base64Pcm);
      const buf = new Int16Array(raw.length / 2);
      for (let i = 0; i < buf.length; i++) {
        buf[i] = (raw.charCodeAt(i * 2)) | (raw.charCodeAt(i * 2 + 1) << 8);
      }
      const audioBuf = ctx.createBuffer(1, buf.length, 24000);
      const ch = audioBuf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) ch[i] = buf[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.start();
      setStatus(playing);
      src.onended = () => { setStatus(''); ctx.close(); };
    } catch (e) {
      console.error('TTS playback error', e);
    }
  }

  function addDiscovery(summary, species) {
    if (noRec) noRec.remove();
    const li = document.createElement('li');
    li.className = 'guide-discovery-item';
    li.innerHTML = '<span class="gdi-icon">📍</span><div class="gdi-body">'
      + '<div class="gdi-summary">' + summary + '</div>'
      + (species.length ? '<div class="gdi-species">' + species.join(' · ') + '</div>' : '')
      + '</div>';
    listEl.prepend(li);
  }

  async function doAnalyse() {
    if (!running) return;
    setStatus(analysing);
    try {
      const pos    = await getLocation();
      const frame  = captureFrame();
      const audio  = await captureAudio();
      const lang   = getLang();
      const cat    = getCategory();

      const sceneRes = await fetch(BASE + '/api/v1/guide/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame, audio, lat: pos.lat, lng: pos.lng, lang, sessionId
        })
      }).then((r) => r.json());

      lastScene = sceneRes;
      if (sceneRes.isNew) {
        recBtn.hidden = false;
        addDiscovery(sceneRes.summary, sceneRes.detectedSpecies || []);

        // Request TTS for new scenes
        const ttsRes = await fetch(BASE + '/api/v1/guide/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneSummary: sceneRes.summary,
            category: cat,
            lang,
            lat: pos.lat,
            lng: pos.lng,
            detectedSpecies: sceneRes.detectedSpecies || [],
          })
        }).then((r) => r.json());

        if (ttsRes.audioBase64) await playAudio(ttsRes.audioBase64);
      } else {
        setStatus('');
      }
    } catch (e) {
      console.error('Guide analyse error', e);
      setStatus('');
    }

    if (running) analyseTimer = setTimeout(doAnalyse, 8000);
  }

  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      video.srcObject = stream;

      if (window.MediaRecorder) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.start(2000);
      }

      running = true;
      camWrap.hidden = false;
      startBtn.hidden = true;
      permMsg.hidden = true;
      analyseTimer = setTimeout(doAnalyse, 5000);
    } catch (err) {
      permMsg.hidden = false;
      console.error('Camera/mic denied', err);
    }
  });

  stopBtn.addEventListener('click', () => {
    running = false;
    clearTimeout(analyseTimer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    camWrap.hidden = true;
    startBtn.hidden = false;
    recBtn.hidden = true;
    setStatus('');
  });

  recBtn.addEventListener('click', async () => {
    if (!lastScene) return;
    const pos = await getLocation();
    await fetch(BASE + '/api/v1/guide/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        lang: getLang(),
        lat: pos.lat,
        lng: pos.lng,
        sceneHash: lastScene.sceneHash,
        sceneSummary: lastScene.summary,
        detectedSpecies: lastScene.detectedSpecies || [],
      })
    });
    recBtn.textContent = '✓ 記録しました';
    setTimeout(() => { recBtn.textContent = ${JSON.stringify(c.recordBtn)}; }, 2000);
  });
})();
</script>`;
}

export const GUIDE_FLOW_STYLES = `
  .guide-root { max-width: 600px; margin: 0 auto; padding: 20px 16px 60px; }
  .guide-header { margin-bottom: 24px; }
  .guide-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -.02em; margin: 0 0 6px; }
  .guide-subtitle { font-size: 13px; color: #64748b; margin: 0; line-height: 1.6; }
  .guide-controls { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
  .guide-selects { display: flex; gap: 10px; flex-wrap: wrap; }
  .guide-select-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .06em; display: flex; flex-direction: column; gap: 4px; }
  .guide-select { padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(15,23,42,.12); background: #fff; font-size: 13px; font-weight: 700; color: #0f172a; cursor: pointer; }
  .guide-start-btn { padding: 14px 24px; border-radius: 22px; background: linear-gradient(135deg, #10b981, #0ea5e9); color: #fff; font-size: 15px; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 8px 20px rgba(16,185,129,.25); transition: transform .15s ease, box-shadow .15s ease; }
  .guide-start-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(16,185,129,.3); }
  .guide-camera-wrap { position: relative; background: #0f172a; border-radius: 20px; overflow: hidden; margin-bottom: 20px; }
  .guide-video { width: 100%; display: block; border-radius: 20px; max-height: 360px; object-fit: cover; }
  .guide-status { position: absolute; top: 12px; left: 12px; padding: 6px 14px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 12px; font-weight: 800; backdrop-filter: blur(6px); }
  .guide-stop-btn { position: absolute; bottom: 12px; right: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(239,68,68,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-record-btn { position: absolute; bottom: 12px; left: 12px; padding: 8px 16px; border-radius: 999px; background: rgba(16,185,129,.88); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; backdrop-filter: blur(6px); }
  .guide-permission-msg { padding: 16px; border-radius: 16px; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2); color: #b91c1c; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
  .guide-discoveries { margin-top: 24px; }
  .guide-discoveries-title { font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; margin: 0 0 12px; }
  .guide-discovery-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-no-records { font-size: 13px; color: #94a3b8; padding: 12px 0; }
  .guide-discovery-item { display: flex; gap: 10px; padding: 12px 14px; background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 16px; box-shadow: 0 4px 12px rgba(15,23,42,.04); }
  .gdi-icon { font-size: 18px; flex-shrink: 0; }
  .gdi-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .gdi-summary { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.5; }
  .gdi-species { font-size: 11px; color: #047857; font-weight: 700; }
`;
