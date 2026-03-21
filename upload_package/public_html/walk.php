<?php
/**
 * walk.php — ブラウザ版ウォークモード
 *
 * GPS追跡 + 環境音モニタリング + BirdNET AI判定
 * 画面ON中限定。バックグラウンドでは停止する。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
Auth::init();

$currentUser = Auth::user();
if (!$currentUser) {
    header('Location: login.php?redirect=walk.php');
    exit;
}

$userId = $currentUser['id'] ?? '';
$allObs = DataStore::fetchAll('observations');
$userObs = array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId);
$totalUserObs = count($userObs);
$userSpecies = count(array_unique(array_filter(array_map(fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null, $userObs))));
$totalSpecies = count(array_unique(array_filter(array_map(fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null, $allObs))));
unset($allObs, $userObs);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "ウォークモード | ikimon.life";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
</head>
<body class="bg-[#050505] text-white min-h-screen">

<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-lg mx-auto px-4 py-6" style="padding-top: calc(var(--nav-height, 56px) + 1.5rem)">

    <!-- ===== 画面1: 開始前 ===== -->
    <div id="screen-ready" class="space-y-5">
        <div class="text-center">
            <div class="text-5xl mb-3">🌿</div>
            <h1 class="text-xl font-black">ウォークモード</h1>
            <p class="text-sm text-gray-400 mt-1">スマホを持って散歩するだけ。周囲の音をAIが自動で分析します。</p>
        </div>

        <!-- 録音同意 -->
        <div id="consent-banner" class="bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 space-y-3">
            <div class="flex items-start gap-2">
                <span class="text-amber-400 text-lg">🎤</span>
                <div>
                    <div class="text-sm font-bold text-amber-300">録音についての確認</div>
                    <div class="text-xs text-gray-300 mt-1 space-y-1">
                        <p>ウォーク中、周囲の環境音を<strong class="text-white">3秒間隔</strong>で録音し、BirdNET AI で鳥の声を分析します。</p>
                        <p>• 録音データは鳥判定後に<strong class="text-white">自動削除</strong>されます（検出時のみ証拠として保存）</p>
                        <p>• 位置情報は<strong class="text-white">高精度モード</strong>で記録されます</p>
                        <p>• データは<a href="methodology.php" class="text-blue-400 underline">ikimon.life の方針</a>に基づき管理されます</p>
                    </div>
                </div>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="consent-check" class="w-4 h-4 accent-green-500">
                <span class="text-sm text-gray-200">上記を確認しました</span>
            </label>
        </div>

        <button id="btn-start"
                class="w-full py-5 rounded-2xl text-lg font-bold bg-green-600/50 text-green-300 cursor-not-allowed transition"
                disabled>
            🎧 ウォーク開始
        </button>

        <div class="bg-white/5 rounded-xl p-4 space-y-3">
            <h3 class="text-sm font-bold text-gray-300">しくみ</h3>
            <div class="grid grid-cols-1 gap-2 text-xs text-gray-400">
                <div class="flex items-start gap-2">
                    <span class="text-green-400 mt-0.5">🎤</span>
                    <span>周囲の音を自動で拾い、<strong class="text-white">BirdNET AI（6,522種対応）</strong>が鳥の声を判定</span>
                </div>
                <div class="flex items-start gap-2">
                    <span class="text-blue-400 mt-0.5">📍</span>
                    <span>GPSで歩行ルートを記録。検出地点が自動マッピングされます</span>
                </div>
                <div class="flex items-start gap-2">
                    <span class="text-amber-400 mt-0.5">📊</span>
                    <span>終了後にまとめて ikimon.life に投稿。データが蓄積されるほど精度UP</span>
                </div>
            </div>
        </div>

        <!-- 天気 -->
        <div id="weather-panel" class="bg-white/5 rounded-xl p-4 hidden"></div>
        <div id="weather-loading" class="bg-white/5 rounded-xl p-4 text-center text-xs text-gray-500">
            📍 位置情報を取得中...
        </div>

        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-emerald-400"><?= number_format($totalUserObs) ?></div>
                <div class="text-[10px] text-gray-500">あなたの観察</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-blue-400"><?= number_format($userSpecies) ?></div>
                <div class="text-[10px] text-gray-500">確認種数</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-xl font-black text-amber-400"><?= number_format($totalSpecies) ?></div>
                <div class="text-[10px] text-gray-500">全体の種数</div>
            </div>
        </div>

        <div class="text-xs text-gray-500 text-center p-3 bg-white/5 rounded-xl leading-relaxed">
            💡 早朝（5〜8時）は鳥が最も活発。静かな場所ほど検出精度UP。<br>
            ⚠️ この画面を開いたまま歩いてください。
        </div>
    </div>

    <!-- ===== 画面2: ウォーク中 ===== -->
    <div id="screen-walking" class="space-y-3" style="display:none">

        <!-- ステータスバー（コンパクト） -->
        <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2">
            <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span class="text-sm font-bold" id="elapsed">0:00</span>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-400">
                <span>🐦 <strong class="text-green-400" id="det-count">0</strong></span>
                <span>📍 <strong class="text-blue-400" id="gps-count">0</strong></span>
            </div>
            <button id="btn-stop" class="px-4 py-1.5 rounded-full text-xs font-bold bg-red-600 hover:bg-red-700 active:scale-95 transition">
                🛑 終了
            </button>
        </div>

        <!-- リアルタイムマップ -->
        <div class="rounded-xl overflow-hidden border border-white/10" style="height: 300px">
            <div id="walk-map" style="width:100%; height:100%"></div>
        </div>

        <!-- 音声レベル（細いバー） -->
        <div class="flex items-center gap-2 px-1">
            <span class="text-xs text-gray-500">🎤</span>
            <div class="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-green-500 transition-all duration-200 rounded-full" id="audio-bar" style="width:0%"></div>
            </div>
        </div>

        <!-- 最新検出（1件だけ目立たせる） -->
        <div id="latest-det" class="hidden">
            <div class="flex items-center gap-3 p-3 bg-green-900/30 border border-green-700/30 rounded-xl animate-pulse">
                <span class="text-2xl">🐦</span>
                <div class="flex-1">
                    <div class="text-sm font-bold text-green-300" id="latest-name"></div>
                    <div class="text-xs text-gray-400" id="latest-sci"></div>
                </div>
                <span class="text-sm font-bold text-green-400" id="latest-conf"></span>
            </div>
        </div>

        <!-- 検出リスト（折りたたみ） -->
        <details class="bg-white/5 rounded-xl">
            <summary class="px-4 py-2 text-xs text-gray-400 cursor-pointer">検出履歴を表示</summary>
            <div id="det-list" class="px-2 pb-2"></div>
        </details>
    </div>

    <!-- ===== 画面3: 完了 ===== -->
    <div id="screen-done" class="space-y-4" style="display:none">
        <div class="bg-white/5 rounded-2xl p-6 text-center space-y-4">
            <div class="text-4xl">🎉</div>
            <h2 class="text-lg font-bold">ウォーク完了!</h2>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <div class="text-2xl font-black" id="sum-duration">0:00</div>
                    <div class="text-xs text-gray-500">時間</div>
                </div>
                <div>
                    <div class="text-2xl font-black text-green-400" id="sum-species">0</div>
                    <div class="text-xs text-gray-500">種検出</div>
                </div>
                <div>
                    <div class="text-2xl font-black text-blue-400" id="sum-gps">0点</div>
                    <div class="text-xs text-gray-500">GPS</div>
                </div>
            </div>
            <div id="sum-list" class="flex flex-wrap gap-1.5 justify-center"></div>

            <!-- 送信ステータス（自動更新） -->
            <div id="upload-status" class="text-sm text-center p-3 text-blue-400">📡 送信中...</div>

            <!-- 失敗時のみ再送信ボタン -->
            <button id="btn-upload"
                    class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition">
                🔄 再送信
            </button>
            <button id="btn-close" class="text-sm text-gray-500 hover:text-white">新しいウォーク</button>
        </div>
    </div>

</main>

<script nonce="<?= CspNonce::attr() ?>">
// ===== State =====
var STORAGE_KEY = 'ikimon_walk_session';
var PENDING_KEY = 'ikimon_walk_pending';
var W = {
    walking: false,
    startTime: null,
    timer: null,
    detections: [],
    routePoints: [],
    mediaStream: null,
    audioCtx: null,
    analyser: null,
    watchId: null,
    recorder: null,
    recTimer: null,
    analyzing: false,
    chunks: [],
    mimeType: '',
    saveTimer: null,
};

// ===== localStorage persistence =====
function saveSession() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            startTime: W.startTime,
            detections: W.detections,
            routePoints: W.routePoints,
            savedAt: Date.now(),
        }));
    } catch(e) {}
}

function loadSession() {
    try {
        var data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data && data.detections && data.detections.length > 0) return data;
    } catch(e) {}
    return null;
}

function clearSession() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
}

function savePending(events, session) {
    try {
        var pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        pending.push({ events: events, session: session, savedAt: Date.now() });
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch(e) {}
}

function getPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch(e) { return []; }
}

function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch(e) {}
}

// ===== Map =====
var walkMap = null;
var mapMarkers = [];

function initMap(lat, lng) {
    if (walkMap) return;
    walkMap = new maplibregl.Map({
        container: 'walk-map',
        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap contributors'
                }
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [lng, lat],
        zoom: 16,
    });

    // ルートラインのソース
    walkMap.on('load', function() {
        walkMap.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
        walkMap.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: { 'line-color': '#10b981', 'line-width': 3, 'line-opacity': 0.8 }
        });

        // 現在地マーカー
        var el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5)';
        W._posMarker = new maplibregl.Marker({element: el}).setLngLat([lng, lat]).addTo(walkMap);

        // 周辺トイレを取得
        loadNearbyToilets(lat, lng, walkMap);
    });
}

function updateMapRoute() {
    if (!walkMap || !walkMap.getSource('route')) return;
    var coords = W.routePoints.map(function(p) { return [p.lng, p.lat]; });
    if (coords.length < 2) return;
    walkMap.getSource('route').setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords }
    });
    // 現在地を追従
    var last = coords[coords.length - 1];
    if (W._posMarker) W._posMarker.setLngLat(last);
    walkMap.easeTo({ center: last, duration: 500 });
}

function addMapDetectionMarker(det) {
    if (!walkMap || !det.lat || !det.lng) return;
    var el = document.createElement('div');
    el.style.cssText = 'font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));transition:transform 0.3s';
    el.textContent = '🐦';
    el.title = det.name + ' (' + Math.round(det.confidence * 100) + '%)';
    // 出現アニメーション
    el.style.transform = 'scale(0)';
    setTimeout(function() { el.style.transform = 'scale(1)'; }, 50);

    var marker = new maplibregl.Marker({element: el})
        .setLngLat([det.lng, det.lat])
        .setPopup(new maplibregl.Popup({offset: 20, closeButton: false})
            .setHTML('<div style="font-size:12px;color:#000"><strong>' + det.name + '</strong><br>' + Math.round(det.confidence * 100) + '% — ' + det.time + '</div>'))
        .addTo(walkMap);
    mapMarkers.push(marker);
}

// ===== Screen switching (plain DOM, no framework) =====
function showScreen(name) {
    document.getElementById('screen-ready').style.display = name === 'ready' ? '' : 'none';
    document.getElementById('screen-walking').style.display = name === 'walking' ? '' : 'none';
    document.getElementById('screen-done').style.display = name === 'done' ? '' : 'none';
}

// ===== Distance calculation (Haversine) =====
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

// ===== Weather (fire-and-forget on load) =====
(function loadWeather() {
    if (!navigator.geolocation) { document.getElementById('weather-loading').textContent = ''; return; }
    navigator.geolocation.getCurrentPosition(function(pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Tokyo';
        fetch(url).then(function(r){return r.json()}).then(function(data) {
            var c = data.current;
            var codes = {0:'☀️ 快晴',1:'🌤️ 晴れ',2:'⛅ 薄曇り',3:'☁️ 曇り',45:'🌫️ 霧',51:'🌦️ 小雨',53:'🌧️ 雨',61:'🌧️ 小雨',63:'🌧️ 雨',65:'🌧️ 大雨',71:'🌨️ 雪',80:'🌦️ にわか雨',95:'⛈️ 雷雨'};
            var w = codes[c.weather_code] || '🌤️ 晴れ';
            var h = new Date().getHours();
            var bird = (h>=5&&h<=8) ? '🔥 鳥の活動ピーク帯' : (h>=16&&h<=18) ? '🌅 夕方の活動帯' : (h>=21||h<=4) ? '🌙 夜行性種のみ' : '☀️ 日中';
            var panel = document.getElementById('weather-panel');
            panel.innerHTML = '<div class="flex items-center gap-4"><div class="text-3xl">' + w.split(' ')[0] + '</div><div class="flex-1"><div class="text-sm font-bold">' + w.split(' ')[1] + '</div><div class="text-xs text-gray-400">' + Math.round(c.temperature_2m) + '°C / 湿度 ' + c.relative_humidity_2m + '% / 風速 ' + c.wind_speed_10m + 'm/s</div></div><div class="text-xs text-gray-500">' + bird + '</div></div>';
            panel.classList.remove('hidden');
            document.getElementById('weather-loading').style.display = 'none';
        }).catch(function(){});
    }, function() {
        document.getElementById('weather-loading').textContent = '📍 位置情報が取得できません';
    }, {enableHighAccuracy:false, timeout:10000});
})();

// ===== Start Walk =====
async function startWalk() {
    showScreen('walking');
    W.walking = true;
    W.startTime = Date.now();
    W.detections = [];
    W.routePoints = [];
    document.getElementById('det-count').textContent = '0';
    document.getElementById('gps-count').textContent = '0';
    document.getElementById('det-list').innerHTML = '';

    // 10秒ごとに自動保存（電波断・クラッシュ対策）
    W.saveTimer = setInterval(saveSession, 10000);

    // Timer
    W.timer = setInterval(function() {
        var sec = Math.floor((Date.now() - W.startTime) / 1000);
        document.getElementById('elapsed').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    }, 1000);

    // GPS + Map + 環境コンテキスト
    if (navigator.geolocation) {
        W.watchId = navigator.geolocation.watchPosition(function(pos) {
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            var point = {
                lat: lat, lng: lng, timestamp: Date.now(),
                accuracy: pos.coords.accuracy || null,
                speed: pos.coords.speed || null,
                altitude: pos.coords.altitude || null,
            };
            W.routePoints.push(point);
            document.getElementById('gps-count').textContent = W.routePoints.length;
            if (W.routePoints.length === 1) initMap(lat, lng);
            updateMapRoute();
        }, function(){}, {enableHighAccuracy:true, maximumAge:5000});
    }

    // Audio
    try {
        W.mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
        W.audioCtx = new AudioContext();
        var source = W.audioCtx.createMediaStreamSource(W.mediaStream);
        W.analyser = W.audioCtx.createAnalyser();
        W.analyser.fftSize = 256;
        source.connect(W.analyser);

        // Level meter
        (function updateLevel() {
            if (!W.walking) return;
            var data = new Uint8Array(W.analyser.frequencyBinCount);
            W.analyser.getByteFrequencyData(data);
            var avg = data.reduce(function(a,b){return a+b},0) / data.length;
            document.getElementById('audio-bar').style.width = Math.min(100, avg*1.5) + '%';
            requestAnimationFrame(updateLevel);
        })();

        // Recorder
        setupRecorder();
    } catch(e) {
        console.warn('Audio error:', e);
    }
}

// ===== Stop Walk =====
function stopWalk() {
    W.walking = false;
    clearInterval(W.timer);
    if (W.saveTimer) clearInterval(W.saveTimer);
    if (W.recTimer) clearTimeout(W.recTimer);
    if (W.recorder && W.recorder.state === 'recording') try { W.recorder.stop(); } catch(e) {}
    if (W.watchId) navigator.geolocation.clearWatch(W.watchId);
    if (W.mediaStream) W.mediaStream.getTracks().forEach(function(t){t.stop()});
    if (W.audioCtx) W.audioCtx.close();

    // マップクリーンアップ
    if (walkMap) { walkMap.remove(); walkMap = null; }
    mapMarkers = [];

    // 最終保存
    saveSession();

    // Summary
    var species = [];
    W.detections.forEach(function(d) { if (species.indexOf(d.name) === -1) species.push(d.name); });
    var sec = Math.floor((Date.now() - W.startTime) / 1000);
    document.getElementById('sum-duration').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    document.getElementById('sum-species').textContent = species.length;
    document.getElementById('sum-list').innerHTML = species.map(function(s) {
        return '<span class="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full">' + s + '</span>';
    }).join('');
    document.getElementById('sum-gps').textContent = W.routePoints.length + '点';

    showScreen('done');

    // 自動送信を試みる
    autoUpload();
}

// ===== Audio Recorder =====
function setupRecorder() {
    if (!W.mediaStream) return;
    W.mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
    if (!W.mimeType) { console.warn('No recording format'); return; }

    W.recorder = new MediaRecorder(W.mediaStream, {mimeType: W.mimeType});
    W.chunks = [];
    W.recorder.ondataavailable = function(e) { if (e.data.size > 0) W.chunks.push(e.data); };
    W.recorder.onstop = function() {
        if (W.chunks.length === 0 || !W.walking) return;
        var blob = new Blob(W.chunks, {type: W.mimeType});
        W.chunks = [];
        sendAudio(blob);
    };
    startCycle();
}

function startCycle() {
    if (!W.walking || !W.recorder) return;
    if (W.analyzing) { W.recTimer = setTimeout(startCycle, 1000); return; }
    try {
        W.chunks = [];
        W.recorder.start();
        W.recTimer = setTimeout(function() {
            if (W.recorder && W.recorder.state === 'recording') W.recorder.stop();
        }, 3000);
    } catch(e) {
        W.recTimer = setTimeout(startCycle, 5000);
    }
}

async function sendAudio(blob) {
    if (!W.walking) return;
    W.analyzing = true;
    try {
        var last = W.routePoints.length > 0 ? W.routePoints[W.routePoints.length-1] : null;
        var fd = new FormData();
        var ext = W.mimeType.indexOf('mp4') >= 0 ? '.mp4' : '.webm';
        fd.append('audio', blob, 'snippet' + ext);
        fd.append('lat', last ? last.lat : 35.0);
        fd.append('lng', last ? last.lng : 139.0);

        var resp = await fetch('/api/v2/analyze_audio.php', {method:'POST', body:fd});
        if (!resp.ok) { if (resp.status === 429) await new Promise(function(r){setTimeout(r,5000)}); return; }
        var json = await resp.json();
        if (json.success && json.data && json.data.detections) {
            var now = new Date();
            json.data.detections.forEach(function(d) {
                // 環境コンテキスト: GPS精度・速度・ノイズレベル
                var audioBar = document.getElementById('audio-bar');
                var noiseLevel = audioBar ? parseFloat(audioBar.style.width) || 0 : 0;
                var env = {
                    gps_accuracy: last ? last.accuracy : null,
                    gps_speed: last ? last.speed : null,
                    noise_level: Math.round(noiseLevel),
                    indoor_likely: last && last.accuracy > 50,
                };
                var det = {
                    name: d.common_name || d.scientific_name,
                    scientific_name: d.scientific_name,
                    confidence: d.confidence,
                    time: now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0'),
                    timestamp: Date.now(),
                    lat: last ? last.lat : null,
                    lng: last ? last.lng : null,
                    environment: env,
                };
                W.detections.push(det);
                document.getElementById('det-count').textContent = W.detections.length;
                addDetectionCard(det);
                addMapDetectionMarker(det);
                showLatestDetection(det);
                saveSession();
                if (navigator.vibrate) navigator.vibrate(30);
            });
        }
    } catch(e) {
        console.warn('Analysis error:', e);
    } finally {
        W.analyzing = false;
        if (W.walking) startCycle();
    }
}

function showLatestDetection(det) {
    var panel = document.getElementById('latest-det');
    if (!panel) return;
    panel.classList.remove('hidden');
    document.getElementById('latest-name').textContent = det.name;
    document.getElementById('latest-sci').textContent = det.scientific_name || '';
    document.getElementById('latest-conf').textContent = Math.round(det.confidence * 100) + '%';
    // 5秒後にフェードアウト
    if (W._latestTimer) clearTimeout(W._latestTimer);
    W._latestTimer = setTimeout(function() { panel.classList.add('hidden'); }, 5000);
}

function addDetectionCard(det) {
    var list = document.getElementById('det-list');
    var html = '<div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2">'
        + '<div class="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center text-green-400">🐦</div>'
        + '<div class="flex-1"><div class="text-sm font-medium">' + det.name + '</div>'
        + '<div class="text-xs text-gray-600">' + det.time + '</div></div>'
        + '<span class="text-xs text-gray-500">' + Math.round(det.confidence * 100) + '%</span></div>';
    list.insertAdjacentHTML('afterbegin', html);
}

// ===== Auto Upload (with offline fallback) =====
async function autoUpload() {
    if (W.detections.length === 0 && W.routePoints.length === 0) {
        updateUploadStatus('検出なし — データはありません', 'gray');
        clearSession();
        return;
    }

    var events = W.detections.map(function(d) {
        return {type:'audio', taxon_name:d.name, scientific_name:d.scientific_name,
            confidence:d.confidence, lat:d.lat, lng:d.lng,
            timestamp:new Date(d.timestamp).toISOString(), model:'birdnet-v2.4',
            environment: d.environment || null};
    });
    var session = {
        duration_sec: Math.floor((Date.now()-W.startTime)/1000),
        distance_m: calcDistance(W.routePoints),
        route_polyline: W.routePoints.map(function(p){return p.lat.toFixed(6)+','+p.lng.toFixed(6)}).join(';'),
        device: navigator.userAgent.indexOf('iPhone')>=0 ? 'iPhone' : 'Android',
        app_version:'web_1.0',
        scan_mode: 'walk',
        route_points: W.routePoints.length,
    };

    updateUploadStatus('📡 送信中...', 'blue');

    try {
        var resp = await fetch('/api/v2/passive_event.php', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({events:events, session:session})
        });
        var json = await resp.json();
        if (json.success) {
            var count = (json.data && json.data.observations_created) || events.length;
            updateUploadStatus('✅ ' + count + '件のデータを送信しました', 'green');
            clearSession();
        } else {
            throw new Error(json.error && json.error.message || 'Server error');
        }
    } catch(e) {
        // オフライン or サーバーエラー → localStorage に保存して後で送信
        savePending(events, session);
        updateUploadStatus('📱 オフライン保存しました（次回接続時に自動送信）', 'amber');
    }
}

function updateUploadStatus(msg, color) {
    var el = document.getElementById('upload-status');
    if (!el) return;
    var colors = {green:'text-green-400', blue:'text-blue-400', amber:'text-amber-400', gray:'text-gray-500'};
    el.className = 'text-sm text-center p-3 ' + (colors[color] || 'text-gray-400');
    el.textContent = msg;
}

// ===== Retry pending uploads (on page load) =====
async function retryPending() {
    var pending = getPending();
    if (pending.length === 0) return;
    for (var i = 0; i < pending.length; i++) {
        try {
            var resp = await fetch('/api/v2/passive_event.php', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({events:pending[i].events, session:pending[i].session})
            });
            var json = await resp.json();
            if (json.success) {
                console.log('Pending walk data uploaded:', pending[i].events.length, 'events');
            }
        } catch(e) {
            // まだオフライン — 残りはそのまま
            localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(i)));
            return;
        }
    }
    clearPending();
}

// ===== Manual retry button =====
async function manualUpload() {
    updateUploadStatus('📡 再送信中...', 'blue');
    await autoUpload();
}

// ページ読み込み時に未送信データを送信試行
retryPending();

// ===== Nearby Toilets (Overpass API) =====
function loadNearbyToilets(lat, lng, targetMap) {
    var radius = 2000; // 2km圏内
    var query = '[out:json][timeout:10];node["amenity"="toilets"](around:' + radius + ',' + lat + ',' + lng + ');out body;';
    var url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (!data.elements) return;
        data.elements.forEach(function(t) {
            var el = document.createElement('div');
            el.style.cssText = 'font-size:18px;cursor:pointer;opacity:0.7';
            el.textContent = '🚻';

            var name = t.tags.name || t.tags.description || '公衆トイレ';
            var access = t.tags.access || 'yes';
            var fee = t.tags.fee === 'yes' ? '有料' : '無料';
            var wheelchair = t.tags.wheelchair === 'yes' ? ' ♿' : '';

            new maplibregl.Marker({element: el})
                .setLngLat([t.lon, t.lat])
                .setPopup(new maplibregl.Popup({offset: 15, closeButton: false, maxWidth: '200px'})
                    .setHTML('<div style="color:#000;font-size:12px"><strong>🚻 ' + name + '</strong><br>' + fee + wheelchair + '</div>'))
                .addTo(targetMap);
        });
    }).catch(function(e) { console.warn('Toilet fetch error:', e); });
}

// ===== Consent toggle =====
document.getElementById('consent-check').addEventListener('change', function() {
    var btn = document.getElementById('btn-start');
    if (this.checked) {
        btn.disabled = false;
        btn.className = 'w-full py-5 rounded-2xl text-lg font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition';
    } else {
        btn.disabled = true;
        btn.className = 'w-full py-5 rounded-2xl text-lg font-bold bg-green-600/50 text-green-300 cursor-not-allowed transition';
    }
});

// ===== Event listeners =====
document.getElementById('btn-start').addEventListener('click', startWalk);
document.getElementById('btn-stop').addEventListener('click', stopWalk);
document.getElementById('btn-upload').addEventListener('click', manualUpload);
document.getElementById('btn-close').addEventListener('click', function() { clearSession(); showScreen('ready'); });

// ===== Restore unsaved session on page load =====
(function checkUnsaved() {
    var saved = loadSession();
    if (saved && saved.detections.length > 0) {
        var ago = Math.round((Date.now() - saved.savedAt) / 60000);
        if (ago < 120) { // 2時間以内なら復元提示
            var el = document.getElementById('weather-loading');
            if (el) {
                el.innerHTML = '⚠️ 前回のウォークデータ（' + saved.detections.length + '件検出、' + ago + '分前）が未送信です。 <button id="btn-restore" class="underline text-green-400">送信する</button>';
                setTimeout(function() {
                    var btn = document.getElementById('btn-restore');
                    if (btn) btn.addEventListener('click', function() {
                        W.detections = saved.detections;
                        W.routePoints = saved.routePoints || [];
                        W.startTime = saved.startTime;
                        showScreen('done');
                        autoUpload();
                    });
                }, 100);
            }
        }
    }
})();
</script>
</body>
</html>
