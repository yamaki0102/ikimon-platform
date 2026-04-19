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
  privacyNotice: string;
  audioTitle: string;
  audioEmpty: string;
  audioSkipped: string;
  audioUnnamed: string;
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
    privacyNotice: "人の声が入った音声は保存しません",
    audioTitle: "今回の音の記録",
    audioEmpty: "自然音のまとまりはまだありません",
    audioSkipped: "一部の音声はプライバシー保護のため保存していません",
    audioUnnamed: "まだ名前が付いていない音",
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
    privacyNotice: "Clips with human voices are not stored",
    audioTitle: "Sounds From This Session",
    audioEmpty: "No natural sound bundles yet",
    audioSkipped: "Some clips were skipped for privacy",
    audioUnnamed: "Unnamed sound",
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
    privacyNotice: "No guardamos clips con voces humanas",
    audioTitle: "Sonidos de esta sesión",
    audioEmpty: "Todavía no hay grupos de sonidos naturales",
    audioSkipped: "Algunos clips se omitieron por privacidad",
    audioUnnamed: "Sonido sin nombre",
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
    privacyNotice: "Clipes com voz humana não são salvos",
    audioTitle: "Sons desta sessão",
    audioEmpty: "Ainda não há grupos de sons naturais",
    audioSkipped: "Alguns clipes foram ignorados por privacidade",
    audioUnnamed: "Som sem nome",
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
    <p class="guide-privacy-note">${escapeHtml(c.privacyNotice)}</p>
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
    audioEmpty: ${JSON.stringify(c.audioEmpty)},
    audioSkipped: ${JSON.stringify(c.audioSkipped)},
    audioUnnamed: ${JSON.stringify(c.audioUnnamed)}
  };
  const BASE = ${JSON.stringify(basePath)};

  let stream = null;
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
  let sceneAudioChunks = [];
  let analyserFrames = [];
  let clientPrivacySkippedCount = 0;
  const sessionId = 'guide-' + Math.random().toString(36).slice(2);
  const preferredMime = pickAudioMimeType();

  const video      = document.getElementById('guide-video');
  const startBtn   = document.getElementById('guide-start-btn');
  const stopBtn    = document.getElementById('guide-stop-btn');
  const recBtn     = document.getElementById('guide-record-btn');
  const camWrap    = document.getElementById('guide-camera-wrap');
  const permMsg    = document.getElementById('guide-permission-msg');
  const statusEl   = document.getElementById('guide-status');
  const listEl     = document.getElementById('guide-discovery-list');
  const noRec      = document.getElementById('guide-no-records');
  const audioList  = document.getElementById('guide-audio-list');
  const audioEmpty = document.getElementById('guide-audio-empty');
  const audioSkip  = document.getElementById('guide-audio-skipped');

  function getLang() { return document.getElementById('guide-lang-select').value; }
  function getCategory() { return document.getElementById('guide-category-select').value; }
  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
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
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
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
  function addDiscovery(summary, species) {
    if (noRec) noRec.remove();
    const li = document.createElement('li');
    li.className = 'guide-discovery-item';
    li.innerHTML = '<span class="gdi-icon">📍</span><div class="gdi-body">'
      + '<div class="gdi-summary">' + escapeInline(summary) + '</div>'
      + (species.length ? '<div class="gdi-species">' + species.map(escapeInline).join(' · ') + '</div>' : '')
      + '</div>';
    listEl.prepend(li);
  }
  function startAnalyser() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor || !stream) return;
    audioContext = new AudioCtor();
    const source = audioContext.createMediaStreamSource(stream);
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
      audioSkip.textContent = copy.audioSkipped + ' (' + skippedCount + ')';
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
  async function uploadAudioChunk(blob) {
    if (!blob || !blob.size || !preferredMime) return;
    const fingerprint = summarizeFrames();
    const vad = classifySpeech(fingerprint);
    if (vad.speechLikely) {
      clientPrivacySkippedCount += 1;
      scheduleRecapRefresh();
      return;
    }
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
  async function doAnalyse() {
    if (!running) return;
    setStatus(copy.analysing);
    try {
      lastKnownPosition = await getLocation();
      const frame = captureFrame();
      const audio = await captureAudioForScene();
      const lang = getLang();
      const cat = getCategory();
      const sceneRes = await fetch(BASE + '/api/v1/guide/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frame,
          audio,
          lat: lastKnownPosition.lat,
          lng: lastKnownPosition.lng,
          lang,
          sessionId
        })
      }).then((r) => r.json());
      lastScene = sceneRes;
      if (sceneRes.isNew) {
        recBtn.hidden = false;
        addDiscovery(sceneRes.summary, sceneRes.detectedSpecies || []);
        const ttsRes = await fetch(BASE + '/api/v1/guide/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneSummary: sceneRes.summary,
            category: cat,
            lang,
            lat: lastKnownPosition.lat,
            lng: lastKnownPosition.lng,
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
    scheduleRecapRefresh();
    if (running) analyseTimer = setTimeout(doAnalyse, 8000);
  }
  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false }
      });
      lastKnownPosition = await getLocation();
      video.srcObject = stream;
      if (window.MediaRecorder && preferredMime) {
        mediaRecorder = new MediaRecorder(stream, { mimeType: preferredMime, audioBitsPerSecond: 32000 });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            sceneAudioChunks.push(e.data);
            void uploadAudioChunk(e.data);
          }
        };
        mediaRecorder.start(2000);
      }
      startAnalyser();
      running = true;
      camWrap.hidden = false;
      startBtn.hidden = true;
      permMsg.hidden = true;
      analyseTimer = setTimeout(doAnalyse, 5000);
      scheduleRecapRefresh();
    } catch (err) {
      permMsg.hidden = false;
      console.error('Camera/mic denied', err);
    }
  });
  stopBtn.addEventListener('click', () => {
    running = false;
    clearTimeout(analyseTimer);
    clearTimeout(recapTimer);
    if (audioSampleTimer) clearInterval(audioSampleTimer);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => undefined);
    analyser = null;
    freqData = null;
    timeData = null;
    camWrap.hidden = true;
    startBtn.hidden = false;
    recBtn.hidden = true;
    setStatus('');
    scheduleRecapRefresh();
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
  .guide-privacy-note { margin: 0; font-size: 12px; color: #0f766e; background: rgba(13,148,136,.08); border: 1px solid rgba(13,148,136,.15); border-radius: 14px; padding: 10px 12px; }
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
  .guide-audio { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  .guide-audio-header { display: flex; flex-direction: column; gap: 6px; }
  .guide-audio-title { margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; }
  .guide-audio-note { margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; }
  .guide-audio-skipped { margin: 0; font-size: 12px; color: #b45309; background: rgba(245,158,11,.10); border: 1px solid rgba(245,158,11,.16); border-radius: 14px; padding: 10px 12px; }
  .guide-audio-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-item { margin: 0; }
  .guide-audio-card { background: linear-gradient(180deg, #f8fafc, #ffffff); border: 1px solid rgba(15,23,42,.08); border-radius: 18px; padding: 14px; box-shadow: 0 8px 20px rgba(15,23,42,.04); display: flex; flex-direction: column; gap: 10px; }
  .guide-audio-card-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
  .guide-audio-card-head strong { font-size: 14px; color: #0f172a; }
  .guide-audio-card-head span { font-size: 12px; color: #0f766e; font-weight: 700; }
  .guide-audio-meta { font-size: 12px; color: #64748b; }
  .guide-audio-player { width: 100%; }
`;
