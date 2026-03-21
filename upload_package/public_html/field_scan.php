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
            <div class="text-6xl mb-4">🌍</div>
            <h1 class="text-2xl font-black">ライブスキャン</h1>
            <p class="text-gray-500 mt-2">歩くだけで周囲の生き物を自動検出。</p>
        </div>
        <button id="btn-start" class="w-full py-5 bg-green-600 hover:bg-green-700 rounded-2xl text-lg font-bold active:scale-95 transition">
            📡 ライブスキャン開始
        </button>
        <div class="bg-white/5 rounded-xl p-4 space-y-2 text-xs text-gray-400">
            <div class="flex items-start gap-2"><span class="text-green-400">🎤</span><span><strong class="text-white">BirdNET AI（6,522種）</strong>が鳥の声を自動判定</span></div>
            <div class="flex items-start gap-2"><span class="text-blue-400">📷</span><span>カメラ映像から植物・昆虫を <strong class="text-white">Gemini AI</strong> が2秒ごとに種同定</span></div>
            <div class="flex items-start gap-2"><span class="text-purple-400">📍</span><span>GPS座標を紐づけ。地球規模のデジタルツインに蓄積</span></div>
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

    <!-- デバッグステータス -->
    <div id="debug-status" style="position:absolute;top:50px;right:8px;z-index:20;background:rgba(0,0,0,0.8);border-radius:8px;padding:6px 10px;font-size:10px;color:#4ade80;max-width:180px;font-family:monospace"></div>

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
    stream: null, captureInt: null, envInt: null, watchId: null, envHistory: [],
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

        // Camera capture every 2 seconds
        S.captureInt = setInterval(captureFrame, 2000);
        dbg('5. 映像キャプチャ 2秒間隔');

        // Environment scan every 10 seconds
        S.envInt = setInterval(envScan, 10000);
        setTimeout(envScan, 3000);

        // Audio recorder
        setupAudioRecorder();
        dbg('6. 音声レコーダー開始');
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
    alert('ライブスキャン完了! ' + sp + '種検出、' + S.totalDet + '件記録');
    showScreen('ready');
}

// ===== Camera Capture =====
async function captureFrame() {
    if (!S.active) return;
    try {
        var v = document.getElementById('cam');
        var c = document.getElementById('cap');
        if (!v.videoWidth) { dbg('📷 待機中(videoWidth=0)'); return; }
        c.width = Math.min(v.videoWidth, 640);
        c.height = Math.round(c.width * v.videoHeight / v.videoWidth);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);

        var blob = await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.7); });
        var fd = new FormData();
        fd.append('photo', blob, 'scan.jpg');
        var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
        if (last) { fd.append('lat', last.lat); fd.append('lng', last.lng); }

        dbg('📷 送信中...');
        var resp = await fetch('/api/v2/ai_classify.php', {method:'POST', body:fd});
        if (!resp.ok) { dbg('📷 HTTP ' + resp.status); return; }
        var json = await resp.json();
        if (json.success && json.data && json.data.suggestions && json.data.suggestions.length > 0) {
            json.data.suggestions.forEach(function(sug) {
                addDetection(sug.name, sug.scientific_name || '', sug.confidence, 'visual');
            });
            dbg('📷 ' + json.data.suggestions.length + '件検出');
        } else {
            dbg('📷 検出なし');
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
        dbg('🎤 送信中...');
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

function sendDetectionToServer(name, sci, conf, source) {
    var last = S.routePoints.length > 0 ? S.routePoints[S.routePoints.length - 1] : null;
    var event = {
        type: source === 'audio' ? 'audio' : 'visual',
        taxon_name: name,
        scientific_name: sci,
        confidence: conf,
        lat: last ? last.lat : null,
        lng: last ? last.lng : null,
        timestamp: new Date().toISOString(),
        model: source === 'audio' ? 'birdnet-v2.4' : 'gemini-vision',
    };
    // 非同期で送信（失敗してもUIをブロックしない）
    fetch('/api/v2/passive_event.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            events: [event],
            session: {
                duration_sec: Math.floor((Date.now() - S.startTime) / 1000),
                device: navigator.userAgent.indexOf('iPhone') >= 0 ? 'iPhone' : 'Android',
                app_version: 'web_1.0',
                scan_mode: 'live-scan',
            }
        })
    }).catch(function() {});
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

// ===== Buttons =====
document.getElementById('btn-start').addEventListener('click', startScan);
document.getElementById('btn-stop').addEventListener('click', stopScan);
</script>
</body>
</html>
