<?php
/**
 * field_scan.php — ライブスキャン
 * カメラ(Gemini AI) + 音声(BirdNET) + GPS — 全部 vanilla JS
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
$currentUser = Auth::user();
if (!$currentUser) { header('Location: login.php?redirect=field_scan.php'); exit; }
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $meta_title = "ライブスキャン | ikimon.life"; include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
    <style>
        #scan-active { position:fixed; inset:0; z-index:50; background:#000; display:flex; flex-direction:column; }
    </style>
</head>
<body class="bg-black text-white">

<!-- ===== 開始前 ===== -->
<div id="scan-ready" class="min-h-screen">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <div class="max-w-lg mx-auto px-4 py-8 space-y-6" style="padding-top:calc(var(--nav-height,56px) + 2rem)">
        <div class="text-center">
            <div class="text-5xl mb-3">🌍</div>
            <h1 class="text-2xl font-black">ライブスキャン</h1>
            <p class="text-gray-400 mt-1 text-sm">移動しながら周囲の生き物を自動検出</p>
        </div>

        <!-- モード選択 -->
        <div class="grid grid-cols-3 gap-2" id="mode-selector">
            <button class="scan-mode-btn active" data-mode="walk" style="background:rgba(16,185,129,0.15);border:2px solid #10b981;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚶</div>
                <div style="font-size:12px;font-weight:bold;color:#10b981;margin-top:4px">徒歩</div>
                <div style="font-size:10px;color:#888;margin-top:2px">📷🎤📍</div>
            </button>
            <button class="scan-mode-btn" data-mode="bike" style="background:rgba(255,255,255,0.05);border:2px solid transparent;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚲</div>
                <div style="font-size:12px;font-weight:bold;color:#888;margin-top:4px">自転車</div>
                <div style="font-size:10px;color:#666;margin-top:2px">📷🎤📍</div>
            </button>
            <button class="scan-mode-btn" data-mode="car" style="background:rgba(255,255,255,0.05);border:2px solid transparent;border-radius:16px;padding:16px 8px;text-align:center">
                <div style="font-size:28px">🚗</div>
                <div style="font-size:12px;font-weight:bold;color:#888;margin-top:4px">車</div>
                <div style="font-size:10px;color:#666;margin-top:2px">📷📍</div>
            </button>
        </div>

        <!-- 録画・録音同意 -->
        <div id="consent-banner" class="bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 space-y-3">
            <div class="flex items-start gap-2">
                <span class="text-amber-400 text-lg">📡</span>
                <div>
                    <div class="text-sm font-bold text-amber-300">カメラ・録音についての確認</div>
                    <div class="text-xs text-gray-300 mt-1 space-y-1">
                        <p>スキャン中、<strong class="text-white">カメラ映像</strong>を定期的にキャプチャし、Gemini AI で生物を同定します。</p>
                        <p>• 徒歩・自転車モードでは<strong class="text-white">環境音</strong>も録音し、BirdNET AI が鳥の声を判定します</p>
                        <p>• カメラフレームは種判定後に<strong class="text-white">自動削除</strong>されます</p>
                        <p>• 位置情報は高精度で記録されます</p>
                        <p>• データは<a href="methodology.php" class="text-blue-400 underline">ikimon.life の方針</a>に基づき管理されます</p>
                    </div>
                </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="consent-check" class="w-4 h-4 accent-green-500">
                <span class="text-sm text-gray-200">上記を確認しました</span>
            </label>
        </div>

        <button id="btn-start" class="w-full py-5 bg-green-600/50 text-green-300 cursor-not-allowed rounded-2xl text-lg font-bold transition" disabled>
            📡 スキャン開始
        </button>

        <!-- モード別の説明 -->
        <div class="bg-white/5 rounded-xl p-4 space-y-2 text-xs text-gray-400">
            <div id="mode-desc-walk">
                <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span>鳥の声をBirdNET AIが自動判定</span></div>
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラで植物・昆虫をGemini AIが種同定（2秒間隔）</span></div>
                <div class="flex items-start gap-2"><span class="text-purple-400">📸</span><span><strong class="text-white">撮影ボタンで即座に観察投稿</strong>も可能</span></div>
            </div>
            <div id="mode-desc-bike" style="display:none">
                <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span>走行中も鳥の声をBirdNET AIが判定</span></div>
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラで風景の生物を3秒間隔で種同定</span></div>
                <div class="flex items-start gap-2"><span class="text-amber-400">⚡</span><span>速度に応じてキャプチャ間隔を自動調整</span></div>
            </div>
            <div id="mode-desc-car" style="display:none">
                <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>車窓からカメラで植生を自動検出（5秒間隔）</span></div>
                <div class="flex items-start gap-2"><span class="text-red-400">🔇</span><span>音声OFF — 車内ノイズ・ラジオの誤検出を防止</span></div>
                <div class="flex items-start gap-2"><span class="text-purple-400">📍</span><span>GPSルート沿いの植生トランセクトデータを蓄積</span></div>
            </div>
        </div>
    </div>
</div>

<!-- ===== スキャン中 ===== -->
<div id="scan-active" style="display:none">
    <video id="cam" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:55%;object-fit:cover"></video>
    <canvas id="cap" style="display:none"></canvas>

    <!-- トップバー -->
    <div style="position:absolute;top:0;left:0;right:0;z-index:10;padding:8px 12px;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent);display:flex;align-items:center;justify-content:space-between;padding-top:max(env(safe-area-inset-top),8px)">
        <button id="btn-stop" style="padding:8px;border-radius:50%;background:rgba(255,0,0,0.6)">✕</button>
        <div style="display:flex;gap:6px">
            <span id="s-cam" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">📷</span>
            <span id="s-mic" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">🎤</span>
            <span id="s-gps" style="font-size:10px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666">📍</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px">
            <span id="timer" style="color:#999;font-family:monospace">0:00</span>
            <span style="padding:2px 8px;border-radius:999px;background:rgba(34,197,94,0.2);color:#4ade80;font-size:11px;font-weight:bold">
                🐦<span id="cnt-audio">0</span> 📷<span id="cnt-visual">0</span>
            </span>
        </div>
    </div>

    <!-- 環境コンテキスト（カメラ上部にオーバーレイ） -->
    <div id="env-panel" style="display:none;position:absolute;top:50px;left:8px;z-index:10;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);border-radius:12px;padding:8px 12px;max-width:200px;font-size:11px">
        <div style="color:#4ade80;font-weight:bold;margin-bottom:4px">🌳 環境</div>
        <div id="env-text" style="color:#ccc;line-height:1.4"></div>
    </div>

    <!-- アクティビティログ -->
    <div id="debug-status" style="position:absolute;top:50px;right:8px;z-index:20;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);border-radius:10px;padding:8px 10px;font-size:10px;color:#4ade80;max-width:180px;font-family:monospace;line-height:1.5"></div>

    <!-- スキャン回数カウンター -->
    <div id="scan-pulse" style="position:absolute;bottom:46%;right:12px;z-index:10;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);border-radius:10px;padding:6px 10px;font-size:11px;color:#999">
        📷 <span id="frame-count">0</span>回 · 🎤 <span id="audio-count">0</span>回
    </div>

    <!-- 撮影ボタン（徒歩モード時のみ） -->
    <div id="capture-btn-wrap" style="display:none;position:absolute;bottom:46%;left:50%;transform:translateX(-50%);z-index:10">
        <button id="btn-capture" style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.9);border:4px solid #fff;box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:24px;transition:transform 0.1s" onclick="this.style.transform='scale(0.9)';setTimeout(()=>this.style.transform='',100)">
            📸
        </button>
        <div style="text-align:center;font-size:10px;color:#ccc;margin-top:4px">タップで投稿</div>
    </div>

    <!-- 検出バナー -->
    <div id="det-banner" style="display:none;position:absolute;bottom:46%;left:50%;transform:translateX(-50%);z-index:10;background:rgba(0,0,0,0.7);backdrop-filter:blur(12px);border-radius:16px;padding:12px 20px;text-align:center;max-width:80%">
        <div id="det-name" style="font-size:18px;font-weight:900"></div>
        <div id="det-sci" style="font-size:11px;color:#ccc;font-style:italic"></div>
        <div id="det-meta" style="font-size:11px;color:#999;margin-top:4px"></div>
    </div>

    <!-- 下半分: 地図 -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:45%;background:#000">
        <div style="display:flex;gap:4px;padding:4px 8px;background:#000">
            <button class="tab-btn active" data-tab="map" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.15);color:#fff;border:none">🗺️ マップ</button>
            <button class="tab-btn" data-tab="species" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666;border:none">🌿 種リスト <span id="sp-count">0</span></button>
            <button class="tab-btn" data-tab="env" style="font-size:11px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,0.05);color:#666;border:none">🌳 環境</button>
        </div>
        <div id="tab-map" style="height:calc(100% - 32px);border-top:1px solid rgba(255,255,255,0.1)">
            <div id="minimap" style="width:100%;height:100%"></div>
        </div>
        <div id="tab-species" style="height:calc(100% - 32px);overflow-y:auto;padding:4px 8px;display:none">
            <div id="species-list" style="font-size:13px"></div>
            <div id="species-empty" style="text-align:center;color:#555;font-size:12px;padding:40px 0">まだ検出なし</div>
        </div>
        <div id="tab-env" style="height:calc(100% - 32px);overflow-y:auto;padding:8px;display:none">
            <div id="env-log" style="font-size:12px"></div>
            <div id="env-empty" style="text-align:center;color:#555;font-size:12px;padding:40px 0">環境スキャン待ち（10秒ごとに自動実行）</div>
        </div>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
var S = {
    active: false, startTime: null, timerInt: null,
    mode: 'walk', // walk | bike | car
    stream: null, captureInt: null, envInt: null, watchId: null, envHistory: [],
    frameScanCount: 0, audioScanCount: 0, capturedPhotos: [],
    routePoints: [], speciesMap: {}, totalDet: 0, audioDet: 0, visualDet: 0,
    minimap: null, posMarker: null,
    recorder: null, recTimer: null, analyzing: false, chunks: [], mime: '',
};

// ===== Screen =====
function showScreen(name) {
    document.getElementById('scan-ready').style.display = name === 'ready' ? '' : 'none';
    document.getElementById('scan-active').style.display = name === 'active' ? '' : 'none';
}

// ===== Start =====
function dbg(msg) {
    var el = document.getElementById('debug-status');
    if (el) el.innerHTML = msg + '<br>' + (el.innerHTML || '').split('<br>').slice(0, 8).join('<br>');
}

async function startScan() {
    showScreen('active');
    dbg('1. 画面切替OK');
    S.active = true;
    S.startTime = Date.now();
    S.speciesMap = {}; S.totalDet = 0; S.audioDet = 0; S.visualDet = 0;
    S.routePoints = []; S.envHistory = [];
    updateCounts();

    // Timer
    S.timerInt = setInterval(function() {
        var sec = Math.floor((Date.now() - S.startTime) / 1000);
        document.getElementById('timer').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    }, 1000);
    dbg('2. タイマー開始');

    // Camera + Audio
    try {
        dbg('3. カメラ要求中...');
        S.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } },
            audio: true
        });
        dbg('4. カメラ取得OK');
        document.getElementById('cam').srcObject = S.stream;
        setSensor('cam', true);
        setSensor('mic', true);

        var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        S.isWifi = !conn || conn.type === 'wifi' || conn.type === 'ethernet';

        // モード別キャプチャ間隔
        var captureMs = S.mode === 'car' ? 5000 : S.mode === 'bike' ? 3000 : 2000;
        S.captureInt = setInterval(captureFrame, captureMs);
        S.envInt = setInterval(envScan, S.isWifi ? 10000 : 30000);
        setTimeout(envScan, 3000);
        dbg('5. ' + S.mode + ' 映像 ' + (captureMs/1000) + '秒間隔');

        // 音声: 車モードはOFF（ノイズ・ラジオ誤検出防止）
        if (S.mode !== 'car') {
            setupAudioRecorder();
            dbg('6. 音声ON');
        } else {
            dbg('6. 音声OFF（車モード）');
        }

        // 撮影ボタン: 徒歩モードのみ表示
        if (S.mode === 'walk') {
            document.getElementById('capture-btn-wrap').style.display = '';
        }
    } catch(e) {
        dbg('ERR カメラ/音声: ' + e.message);
    }

    // GPS
    if (navigator.geolocation) {
        S.watchId = navigator.geolocation.watchPosition(function(pos) {
            setSensor('gps', true);
            S.routePoints.push({lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now()});
            if (S.routePoints.length === 1) {
                initMap(pos.coords.latitude, pos.coords.longitude);
                dbg('7. GPS+マップ初期化');
            }
            updateMapRoute();
        }, function(e) { dbg('GPS ERR: ' + e.message); }, {enableHighAccuracy: true, maximumAge: 3000});
    }
}

// ===== Stop =====
function stopScan() {
    S.active = false;
    clearInterval(S.timerInt);
    clearInterval(S.captureInt);
    clearInterval(S.envInt);
    if (S.recTimer) clearTimeout(S.recTimer);
    if (S.recorder && S.recorder.state === 'recording') try { S.recorder.stop(); } catch(e) {}
    if (S.watchId) navigator.geolocation.clearWatch(S.watchId);
    if (S.stream) S.stream.getTracks().forEach(function(t) { t.stop(); });
    if (S.minimap) { S.minimap.remove(); S.minimap = null; }

    var sp = Object.keys(S.speciesMap).length;
    var sec = Math.floor((Date.now() - S.startTime) / 1000);
    var min = Math.floor(sec / 60);

    // セッションサマリーをフィードに1件投稿
    postScanSummary(sp, min);

    // 蓄積した検出を一括で Canonical Schema に送信（1セッション=1 event）
    var pendingEvents = S.pendingEvents || [];
    if (pendingEvents.length > 0 || S.routePoints.length > 0) {
        fetch('/api/v2/passive_event.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                events: pendingEvents,
                session: {
                    duration_sec: sec,
                    distance_m: calcDistance(S.routePoints),
                    route_polyline: S.routePoints.map(function(p){return p.lat.toFixed(6)+','+p.lng.toFixed(6)}).join(';'),
                    device: navigator.userAgent.indexOf('iPhone') >= 0 ? 'iPhone' : 'Android',
                    app_version: 'web_1.0',
                    scan_mode: 'live-scan',
                }
            })
        }).catch(function() {});
    }

    alert('ライブスキャン完了! ' + sp + '種検出（' + min + '分間）');
    showScreen('ready');
}

// ===== Camera Capture =====
async function captureFrame() {
    if (!S.active) return;
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) { dbg('📷 待機中(videoWidth=0)'); return; }
        // Wi-Fi: 640px/q0.7、モバイル: 320px/q0.5（通信量半減）
        var maxW = S.isWifi ? 640 : 320;
        var quality = S.isWifi ? 0.7 : 0.5;
        c.width = Math.min(v.videoWidth, maxW);
        c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', quality); });
        var fd = new FormData();
        fd.append('photo', blob, 'scan.jpg');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

        S.frameScanCount++;
        document.getElementById('frame-count').textContent = S.frameScanCount;
        dbg('📷 #' + S.frameScanCount + ' 送信中...');
        var resp = await fetch('/api/v2/scan_classify.php', {method:'POST', body:fd});
        if (!resp.ok) { dbg('📷 HTTP ' + resp.status); return; }
        var json = await resp.json();
        if (json.success && json.data && json.data.suggestions && json.data.suggestions.length > 0) {
            json.data.suggestions.forEach(function(sug) {
                addDetection(sug.name, sug.scientific_name || '', sug.confidence || 0.5, 'visual');
            });
            dbg('📷 ' + json.data.suggestions.length + '件検出!');
        } else {
            dbg('📷 対象なし');
        }
    } catch(e) { dbg('📷 ERR: ' + e.message); }
}

// ===== Audio Recorder =====
function setupAudioRecorder() {
    if (!S.stream) return;
    var tracks = S.stream.getAudioTracks();
    if (tracks.length === 0) return;
    S.mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    if (!S.mime) return;

    var audioStream = new MediaStream(tracks);
    S.recorder = new MediaRecorder(audioStream, {mimeType: S.mime});
    S.chunks = [];
    S.recorder.ondataavailable = function(e) { if (e.data.size > 0) S.chunks.push(e.data); };
    S.recorder.onstop = function() {
        if (S.chunks.length === 0 || !S.active) return;
        var blob = new Blob(S.chunks, {type: S.mime});
        S.chunks = [];
        sendAudio(blob);
    };
    startAudioCycle();
}

function startAudioCycle() {
    if (!S.active || !S.recorder) return;
    if (S.analyzing) { S.recTimer = setTimeout(startAudioCycle, 1000); return; }
    try {
        S.chunks = [];
        S.recorder.start();
        S.recTimer = setTimeout(function() {
            if (S.recorder && S.recorder.state === 'recording') S.recorder.stop();
        }, 3000);
    } catch(e) { S.recTimer = setTimeout(startAudioCycle, 5000); }
}

async function sendAudio(blob) {
    if (!S.active) return;
    S.analyzing = true;
    try {
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        var fd = new FormData();
        fd.append('audio', blob, 'snippet' + (S.mime.indexOf('mp4') >= 0 ? '.mp4' : '.webm'));
        fd.append('lat', last ? last.lat : 35.0);
        fd.append('lng', last ? last.lng : 139.0);
        S.audioScanCount++;
        document.getElementById('audio-count').textContent = S.audioScanCount;
        dbg('🎤 #' + S.audioScanCount + ' 送信中...');
        var resp = await fetch('/api/v2/analyze_audio.php', {method:'POST', body:fd});
        if (!resp.ok) { dbg('🎤 HTTP ' + resp.status); return; }
        var json = await resp.json();
        if (json.success && json.data && json.data.detections && json.data.detections.length > 0) {
            json.data.detections.forEach(function(d) {
                addDetection(d.common_name || d.scientific_name, d.scientific_name, d.confidence, 'audio');
            });
            dbg('🎤 ' + json.data.detections.length + '件検出');
        } else {
            dbg('🎤 検出なし');
        }
    } catch(e) { dbg('🎤 ERR: ' + e.message); } finally {
        S.analyzing = false;
        if (S.active) startAudioCycle();
    }
}

// ===== Detection =====
function addDetection(name, sci, conf, source) {
    S.totalDet++;
    if (source === 'audio') S.audioDet++; else S.visualDet++;

    if (!S.speciesMap[name]) {
        S.speciesMap[name] = {count:0, confidence:0, source:source};
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }
    S.speciesMap[name].count++;
    S.speciesMap[name].confidence = Math.max(S.speciesMap[name].confidence, conf);

    updateCounts();
    showDetBanner(name, sci, conf, source);
    addMapMarker(name, source);
    updateSpeciesList();

    // リアルタイムでサーバーに送信（デジタルツインに蓄積）
    sendDetectionToServer(name, sci, conf, source);
}

function postScanSummary(speciesCount, durationMin) {
    if (speciesCount === 0 && S.routePoints.length === 0) return;

    var speciesList = Object.entries(S.speciesMap).map(function(e) {
        return { name: e[0], count: e[1].count, confidence: e[1].confidence, source: e[1].source };
    });

    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    var envSummary = S.envHistory.length > 0 ? S.envHistory[0] : null;

    fetch('/api/v2/scan_summary.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            type: 'live-scan-summary',
            duration_min: durationMin,
            species_count: speciesCount,
            total_detections: S.totalDet,
            audio_detections: S.audioDet,
            visual_detections: S.visualDet,
            gps_points: S.routePoints.length,
            species: speciesList,
            environment: envSummary,
            lat: last ? last.lat : null,
            lng: last ? last.lng : null,
        })
    }).catch(function() {});
}

// 個別検出 → live_detections に送信（リアルタイムマップ用、24h TTL）
function sendDetectionToServer(name, sci, conf, source) {
    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    fetch('/api/v2/live_detections.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            action: 'add',
            scientific_name: sci || null,
            common_name: name,
            detection_confidence: conf,
            detection_type: source === 'audio' ? 'audio' : 'visual',
            lat: last ? last.lat : null,
            lng: last ? last.lng : null,
        })
    }).catch(function() {});

    // ローカルに蓄積（セッション終了時に一括 passive_event 送信）
    if (!S.pendingEvents) S.pendingEvents = [];
    S.pendingEvents.push({
        type: source === 'audio' ? 'audio' : 'visual',
        taxon_name: name,
        scientific_name: sci,
        confidence: conf,
        lat: last ? last.lat : null,
        lng: last ? last.lng : null,
        timestamp: new Date().toISOString(),
        model: source === 'audio' ? 'birdnet-v2.4' : 'gemini-vision',
    });
}

// Haversine distance
function calcDistance(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
        var R = 6371000;
        var dLat = (points[i].lat - points[i-1].lat) * Math.PI / 180;
        var dLng = (points[i].lng - points[i-1].lng) * Math.PI / 180;
        var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
                Math.cos(points[i-1].lat*Math.PI/180)*Math.cos(points[i].lat*Math.PI/180)*
                Math.sin(dLng/2)*Math.sin(dLng/2);
        total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    return Math.round(total);
}

function updateCounts() {
    document.getElementById('cnt-audio').textContent = S.audioDet;
    document.getElementById('cnt-visual').textContent = S.visualDet;
    document.getElementById('sp-count').textContent = Object.keys(S.speciesMap).length;
}

function showDetBanner(name, sci, conf, source) {
    var b = document.getElementById('det-banner');
    document.getElementById('det-name').textContent = name;
    document.getElementById('det-sci').textContent = sci;
    document.getElementById('det-meta').textContent = (source === 'audio' ? '🎤 音声' : '📷 カメラ') + ' · ' + Math.round(conf * 100) + '%';
    b.style.display = '';
    clearTimeout(S._bannerTimer);
    S._bannerTimer = setTimeout(function() { b.style.display = 'none'; }, 4000);
}

function updateSpeciesList() {
    var entries = Object.entries(S.speciesMap);
    document.getElementById('species-empty').style.display = entries.length ? 'none' : '';
    document.getElementById('species-list').innerHTML = entries.map(function(e) {
        var name = e[0], d = e[1];
        var icon = d.source === 'audio' ? '🐦' : '🌿';
        var color = d.confidence >= 0.7 ? 'color:#4ade80' : 'color:#fbbf24';
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,0.05);border-radius:8px">'
            + '<span>' + icon + '</span><span style="flex:1">' + name + '</span>'
            + '<span style="font-size:11px;color:#888">×' + d.count + '</span>'
            + '<span style="font-size:11px;' + color + '">' + Math.round(d.confidence * 100) + '%</span></div>';
    }).join('');
}

function setSensor(id, on) {
    var el = document.getElementById('s-' + id);
    if (el) {
        el.style.background = on ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)';
        el.style.color = on ? '#4ade80' : '#666';
    }
}

// ===== Environment Scan =====
async function envScan() {
    if (!S.active) return;
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) return;
        c.width = Math.min(v.videoWidth, 512);
        c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.6); });
        var fd = new FormData();
        fd.append('photo', blob, 'env.jpg');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

        var resp = await fetch('/api/v2/env_scan.php', {method:'POST', body:fd});
        if (!resp.ok) return;
        var json = await resp.json();
        if (json.success && json.data && json.data.environment) {
            var env = json.data.environment;
            S.envHistory.unshift(env);
            if (S.envHistory.length > 20) S.envHistory.pop();

            // カメラ上の環境パネル更新
            var panel = document.getElementById('env-panel');
            var text = '';
            if (env.habitat) text += env.habitat;
            if (env.vegetation) text += '<br>' + env.vegetation;
            if (env.description) text = env.description;
            document.getElementById('env-text').innerHTML = text;
            panel.style.display = '';

            // 環境ログタブ更新
            updateEnvLog();

            // マップにハビタットマーカー追加
            if (S.minimap && last) {
                var el = document.createElement('div');
                el.style.cssText = 'font-size:14px;opacity:0.6';
                el.textContent = '🌳';
                el.title = env.description || env.habitat || '';
                new maplibregl.Marker({element:el}).setLngLat([last.lng, last.lat]).addTo(S.minimap);
            }
        }
    } catch(e) { console.warn('Env scan error:', e); }
}

function updateEnvLog() {
    document.getElementById('env-empty').style.display = S.envHistory.length ? 'none' : '';
    document.getElementById('env-log').innerHTML = S.envHistory.map(function(env) {
        var time = env.timestamp ? new Date(env.timestamp).toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'}) : '';
        var tags = [];
        if (env.habitat) tags.push('<span style="background:rgba(34,197,94,0.2);color:#4ade80;padding:1px 6px;border-radius:8px">' + env.habitat + '</span>');
        if (env.vegetation) tags.push('<span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:1px 6px;border-radius:8px">' + env.vegetation + '</span>');
        if (env.ground) tags.push('<span style="background:rgba(245,158,11,0.2);color:#fbbf24;padding:1px 6px;border-radius:8px">' + env.ground + '</span>');
        if (env.water && env.water !== 'なし') tags.push('<span style="background:rgba(59,130,246,0.3);color:#93c5fd;padding:1px 6px;border-radius:8px">💧' + env.water + '</span>');
        return '<div style="padding:8px;margin-bottom:6px;background:rgba(255,255,255,0.05);border-radius:8px">'
            + '<div style="color:#999;font-size:10px;margin-bottom:4px">' + time + '</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:4px">' + tags.join('') + '</div>'
            + (env.description ? '<div style="color:#aaa;font-size:11px;margin-top:4px">' + env.description + '</div>' : '')
            + '</div>';
    }).join('');
}

// ===== Map =====
function initMap(lat, lng) {
    if (S.minimap) return;
    S.minimap = new maplibregl.Map({
        container: 'minimap',
        style: { version:8, sources: { osm: { type:'raster', tiles:['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'], tileSize:256 } }, layers:[{id:'osm',type:'raster',source:'osm'}] },
        center: [lng, lat], zoom: 16,
    });
    S.minimap.on('load', function() {
        S.minimap.addSource('route', { type:'geojson', data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}} });
        S.minimap.addLayer({ id:'route', type:'line', source:'route', paint:{'line-color':'#4ade80','line-width':3} });
        var el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;background:#3b82f6;border:2px solid #fff;border-radius:50%';
        S.posMarker = new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(S.minimap);
    });
}

function updateMapRoute() {
    if (!S.minimap || !S.minimap.getSource('route')) return;
    var coords = S.routePoints.map(function(p) { return [p.lng, p.lat]; });
    if (coords.length > 1) S.minimap.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:coords}});
    var last = coords[coords.length - 1];
    if (S.posMarker) S.posMarker.setLngLat(last);
    S.minimap.easeTo({center:last, duration:500});
}

function addMapMarker(name, source) {
    if (!S.minimap || S.routePoints.length === 0) return;
    var last = S.routePoints[S.routePoints.length - 1];
    var el = document.createElement('div');
    el.style.cssText = 'font-size:18px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));transition:transform 0.3s';
    el.textContent = source === 'audio' ? '🐦' : '🌿';
    el.title = name;
    el.style.transform = 'scale(0)';
    setTimeout(function() { el.style.transform = 'scale(1)'; }, 50);
    new maplibregl.Marker({element:el}).setLngLat([last.lng, last.lat]).addTo(S.minimap);
}

// ===== Tabs =====
document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.style.background='rgba(255,255,255,0.05)'; b.style.color='#666'; b.classList.remove('active'); });
        this.style.background = 'rgba(255,255,255,0.15)'; this.style.color = '#fff'; this.classList.add('active');
        var tab = this.getAttribute('data-tab');
        document.getElementById('tab-map').style.display = tab === 'map' ? '' : 'none';
        document.getElementById('tab-species').style.display = tab === 'species' ? '' : 'none';
        document.getElementById('tab-env').style.display = tab === 'env' ? '' : 'none';
    });
});

// ===== Mode selection =====
document.querySelectorAll('.scan-mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        S.mode = this.getAttribute('data-mode');
        document.querySelectorAll('.scan-mode-btn').forEach(function(b) {
            b.style.background = 'rgba(255,255,255,0.05)';
            b.style.borderColor = 'transparent';
            b.querySelector('div:nth-child(2)').style.color = '#888';
        });
        this.style.background = 'rgba(16,185,129,0.15)';
        this.style.borderColor = '#10b981';
        this.querySelector('div:nth-child(2)').style.color = '#10b981';
        // 説明文切替
        document.getElementById('mode-desc-walk').style.display = S.mode === 'walk' ? '' : 'none';
        document.getElementById('mode-desc-bike').style.display = S.mode === 'bike' ? '' : 'none';
        document.getElementById('mode-desc-car').style.display = S.mode === 'car' ? '' : 'none';
    });
});

// ===== Capture button (walk mode: take photo → observation post) =====
document.getElementById('btn-capture').addEventListener('click', async function() {
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) return;
        // フル解像度で撮影
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.9); });
        S.capturedPhotos.push(blob);

        dbg('📸 撮影 #' + S.capturedPhotos.length);
        if (navigator.vibrate) navigator.vibrate(50);

        // 3枚溜まったら自動投稿、または1枚でも即送信
        if (S.capturedPhotos.length >= 3) {
            uploadCapturedPhotos();
        } else {
            // 5秒後に未送信分を送信
            clearTimeout(S._uploadTimer);
            S._uploadTimer = setTimeout(uploadCapturedPhotos, 5000);
        }
    } catch(e) { dbg('📸 ERR: ' + e.message); }
});

async function uploadCapturedPhotos() {
    if (S.capturedPhotos.length === 0) return;
    var photos = S.capturedPhotos.slice();
    S.capturedPhotos = [];

    var fd = new FormData();
    photos.forEach(function(blob, i) {
        fd.append('photos[]', blob, 'capture_' + i + '.jpg');
    });

    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }
    fd.append('source', 'live-scan-capture');

    try {
        var resp = await fetch('/api/v2/quick_post.php', {method: 'POST', body: fd});
        var json = await resp.json();
        dbg(json.success ? '📸 投稿完了!' : '📸 投稿失敗');
    } catch(e) { dbg('📸 送信ERR'); }
}

// ===== Consent toggle =====
document.getElementById('consent-check').addEventListener('change', function() {
    var btn = document.getElementById('btn-start');
    if (this.checked) {
        btn.disabled = false;
        btn.className = 'w-full py-5 bg-green-600 hover:bg-green-700 rounded-2xl text-lg font-bold active:scale-95 transition';
    } else {
        btn.disabled = true;
        btn.className = 'w-full py-5 bg-green-600/50 text-green-300 cursor-not-allowed rounded-2xl text-lg font-bold transition';
    }
});

// ===== Buttons =====
document.getElementById('btn-start').addEventListener('click', startScan);
document.getElementById('btn-stop').addEventListener('click', stopScan);
</script>
</body>
</html>
