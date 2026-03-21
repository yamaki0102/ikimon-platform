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

        <button id="btn-start"
                class="w-full py-5 rounded-2xl text-lg font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition">
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
    <div id="screen-walking" class="space-y-4" style="display:none">
        <div class="text-center">
            <div class="text-5xl mb-3">🟢</div>
            <h1 class="text-xl font-black">モニタリング中</h1>
            <p class="text-sm text-green-400 mt-1">周囲の音をAI分析しています...</p>
        </div>

        <button id="btn-stop"
                class="w-full py-5 rounded-2xl text-lg font-bold bg-red-600 hover:bg-red-700 active:scale-95 transition">
            🛑 ウォーク終了
        </button>

        <div class="grid grid-cols-3 gap-3 text-center">
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black" id="elapsed">0:00</div>
                <div class="text-xs text-gray-500">経過時間</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black text-green-400" id="det-count">0</div>
                <div class="text-xs text-gray-500">音声検出</div>
            </div>
            <div class="bg-white/5 rounded-xl p-3">
                <div class="text-2xl font-black text-blue-400" id="gps-count">0</div>
                <div class="text-xs text-gray-500">GPS点</div>
            </div>
        </div>

        <!-- 音声レベル -->
        <div class="bg-white/5 rounded-xl p-4">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-gray-500">🎤</span>
                <span class="text-xs text-gray-500">環境音レベル</span>
            </div>
            <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-green-500 transition-all duration-200 rounded-full" id="audio-bar" style="width:0%"></div>
            </div>
        </div>

        <!-- 検出リスト -->
        <div id="det-list"></div>
    </div>

    <!-- ===== 画面3: 完了 ===== -->
    <div id="screen-done" class="space-y-4" style="display:none">
        <div class="bg-white/5 rounded-2xl p-6 text-center space-y-4">
            <div class="text-4xl">🎉</div>
            <h2 class="text-lg font-bold">ウォーク完了!</h2>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-2xl font-black" id="sum-duration">0:00</div>
                    <div class="text-xs text-gray-500">時間</div>
                </div>
                <div>
                    <div class="text-2xl font-black text-green-400" id="sum-species">0</div>
                    <div class="text-xs text-gray-500">種検出</div>
                </div>
            </div>
            <div id="sum-list" class="flex flex-wrap gap-1.5 justify-center"></div>
            <button id="btn-upload"
                    class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition">
                ikimon.life に投稿
            </button>
            <button id="btn-close" class="text-sm text-gray-500 hover:text-white">閉じる</button>
        </div>
    </div>

</main>

<script nonce="<?= CspNonce::attr() ?>">
// ===== State =====
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
};

// ===== Screen switching (plain DOM, no framework) =====
function showScreen(name) {
    document.getElementById('screen-ready').style.display = name === 'ready' ? '' : 'none';
    document.getElementById('screen-walking').style.display = name === 'walking' ? '' : 'none';
    document.getElementById('screen-done').style.display = name === 'done' ? '' : 'none';
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

    // Timer
    W.timer = setInterval(function() {
        var sec = Math.floor((Date.now() - W.startTime) / 1000);
        document.getElementById('elapsed').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    }, 1000);

    // GPS
    if (navigator.geolocation) {
        W.watchId = navigator.geolocation.watchPosition(function(pos) {
            W.routePoints.push({lat:pos.coords.latitude, lng:pos.coords.longitude, timestamp:Date.now()});
            document.getElementById('gps-count').textContent = W.routePoints.length;
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
    if (W.recTimer) clearTimeout(W.recTimer);
    if (W.recorder && W.recorder.state === 'recording') try { W.recorder.stop(); } catch(e) {}
    if (W.watchId) navigator.geolocation.clearWatch(W.watchId);
    if (W.mediaStream) W.mediaStream.getTracks().forEach(function(t){t.stop()});
    if (W.audioCtx) W.audioCtx.close();

    // Summary
    var species = [];
    W.detections.forEach(function(d) { if (species.indexOf(d.name) === -1) species.push(d.name); });
    var sec = Math.floor((Date.now() - W.startTime) / 1000);
    document.getElementById('sum-duration').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    document.getElementById('sum-species').textContent = species.length;
    document.getElementById('sum-list').innerHTML = species.map(function(s) {
        return '<span class="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full">' + s + '</span>';
    }).join('');

    showScreen('done');
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
                var det = {
                    name: d.common_name || d.scientific_name,
                    scientific_name: d.scientific_name,
                    confidence: d.confidence,
                    time: now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0'),
                    timestamp: Date.now(),
                    lat: last ? last.lat : null,
                    lng: last ? last.lng : null,
                };
                W.detections.push(det);
                document.getElementById('det-count').textContent = W.detections.length;
                addDetectionCard(det);
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

function addDetectionCard(det) {
    var list = document.getElementById('det-list');
    var html = '<div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2">'
        + '<div class="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center text-green-400">🐦</div>'
        + '<div class="flex-1"><div class="text-sm font-medium">' + det.name + '</div>'
        + '<div class="text-xs text-gray-600">' + det.time + '</div></div>'
        + '<span class="text-xs text-gray-500">' + Math.round(det.confidence * 100) + '%</span></div>';
    list.insertAdjacentHTML('afterbegin', html);
}

// ===== Upload =====
async function uploadResults() {
    var btn = document.getElementById('btn-upload');
    btn.textContent = '送信中...';
    btn.disabled = true;
    try {
        var events = W.detections.map(function(d) {
            return {type:'audio', taxon_name:d.name, scientific_name:d.scientific_name,
                confidence:d.confidence, lat:d.lat, lng:d.lng,
                timestamp:new Date(d.timestamp).toISOString(), model:'birdnet-v2.4'};
        });
        var resp = await fetch('/api/v2/passive_event.php', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({events:events, session:{
                duration_sec: Math.floor((Date.now()-W.startTime)/1000),
                device: navigator.userAgent.indexOf('iPhone')>=0 ? 'iPhone' : 'Android',
                app_version:'web_1.0'
            }})
        });
        var json = await resp.json();
        if (json.success) alert((json.data && json.data.observations_created || 0) + '件の観察が投稿されました!');
    } catch(e) {
        alert('送信エラー: ' + e.message);
    } finally {
        btn.textContent = 'ikimon.life に投稿';
        btn.disabled = false;
    }
}

// ===== Event listeners =====
document.getElementById('btn-start').addEventListener('click', startWalk);
document.getElementById('btn-stop').addEventListener('click', stopWalk);
document.getElementById('btn-upload').addEventListener('click', uploadResults);
document.getElementById('btn-close').addEventListener('click', function() { showScreen('ready'); });
</script>
</body>
</html>
