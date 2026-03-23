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
$userSpeciesList = array_values(array_unique(array_filter(array_map(fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null, $userObs))));
$userSpecies = count($userSpeciesList);
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
    <style>
        @keyframes fadeInOut { 0%{opacity:0;transform:translateY(-10px)} 10%{opacity:1;transform:translateY(0)} 80%{opacity:1} 100%{opacity:0;transform:translateY(-10px)} }
    </style>
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

        <!-- モード選択 -->
        <div class="flex gap-2" id="mode-selector">
            <button type="button" class="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition mode-btn active"
                    data-mode="walk" style="border-color:#22c55e;background:rgba(34,197,94,0.1);color:#86efac"
                    onclick="selectMode('walk')">
                🚶 ウォーク
            </button>
            <button type="button" class="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition mode-btn"
                    data-mode="cycle" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af"
                    onclick="selectMode('cycle')">
                🚲 自転車/バイク
            </button>
            <button type="button" class="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition mode-btn"
                    data-mode="drive" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af"
                    onclick="selectMode('drive')">
                🚗 ドライブ
            </button>
        </div>

        <!-- 感度モード -->
        <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <div class="flex items-center gap-2">
                <span class="text-lg">🎤</span>
                <div>
                    <div class="text-sm font-bold text-gray-200">高感度モード</div>
                    <div class="text-[10px] text-gray-500">小さな鳥の声も拾いやすくなります</div>
                </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="sensitivity-toggle" class="sr-only peer" checked>
                <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
        </div>

        <!-- 音声ガイド設定 -->
        <div id="voice-settings" class="space-y-2">
            <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                <div class="flex items-center gap-2">
                    <span class="text-lg">🔊</span>
                    <div>
                        <div class="text-sm font-bold text-gray-200">音声ガイド</div>
                        <div class="text-[10px] text-gray-500">検出時に音声で案内します</div>
                    </div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="voice-toggle" class="sr-only peer" onchange="VoiceGuide.setEnabled(this.checked)">
                    <div class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
            </div>
            <div id="voice-mode-selector" class="flex gap-2 px-1" style="display:none">
                <button type="button" class="flex-1 py-2 rounded-lg text-xs font-bold border transition voice-mode-btn active"
                        data-vmode="standard" style="border-color:#3b82f6;background:rgba(59,130,246,0.1);color:#93c5fd"
                        onclick="selectVoiceMode('standard')">
                    📱 スマホ標準
                </button>
                <button type="button" class="flex-1 py-2 rounded-lg text-xs font-bold border transition voice-mode-btn"
                        data-vmode="zundamon" style="border-color:transparent;background:rgba(255,255,255,0.05);color:#9ca3af"
                        onclick="selectVoiceMode('zundamon')">
                    🟢 ずんだもん
                </button>
            </div>
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
                <span id="listen-indicator" class="text-base transition-all duration-300" title="音声モニタリング中">🎤</span>
                <span>🐦 <strong class="text-green-400" id="det-count">0</strong></span>
                <span>📍 <strong class="text-blue-400" id="gps-count">0</strong></span>
                <span class="text-green-400 font-bold" id="walk-points" style="display:none">🌱 +<span id="walk-pts-val">0</span>pt</span>
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

        <!-- 最新検出（リッチカード） -->
        <div id="latest-det" class="hidden">
            <div class="p-3 rounded-xl border transition-all duration-300" id="latest-det-card" style="background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3)">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">🐦</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <div class="text-base font-bold text-green-300 truncate" id="latest-name"></div>
                            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" id="latest-conf-badge"></span>
                        </div>
                        <div class="text-xs text-gray-400 italic" id="latest-sci"></div>
                    </div>
                    <span class="text-sm font-bold text-green-400" id="latest-conf"></span>
                </div>
                <!-- 種カード情報（API応答後に表示） -->
                <div id="latest-card-info" class="mt-2 pt-2 border-t border-white/10 hidden">
                    <div class="text-xs text-gray-300 leading-relaxed" id="latest-card-trait"></div>
                    <div class="flex items-center justify-between mt-1.5">
                        <span class="text-[10px] text-gray-500" id="latest-card-habitat"></span>
                        <a id="latest-card-link" href="#" class="text-[10px] text-blue-400 hover:text-blue-300">もっと知る</a>
                    </div>
                    <div class="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                        <span>🤖</span> AI生成・誤りの可能性あり
                    </div>
                </div>
            </div>
        </div>

        <!-- 検出リスト（折りたたみ） -->
        <details class="bg-white/5 rounded-xl">
            <summary class="px-4 py-2 text-xs text-gray-400 cursor-pointer">検出履歴を表示</summary>
            <div id="det-list" class="px-2 pb-2"></div>
        </details>
    </div>

    <!-- ===== 画面2D: ドライブ中（超シンプル） ===== -->
    <div id="screen-drive" class="flex flex-col items-center justify-center" style="display:none;min-height:70vh">
        <div class="text-center space-y-6 w-full">
            <div class="text-6xl">🚗</div>
            <h2 class="text-xl font-black">ドライブ中</h2>

            <!-- システムステータス -->
            <div class="flex items-center justify-center gap-2">
                <span class="w-3 h-3 rounded-full animate-pulse" id="drive-status-dot" style="background:#22c55e"></span>
                <span class="text-sm font-bold" id="drive-status-text" style="color:#86efac">システム正常</span>
            </div>

            <!-- 音声レベル（自転車/バイクモードのみ表示） -->
            <div class="w-48 mx-auto" id="drive-audio-section" style="display:none">
                <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-green-500 transition-all duration-200 rounded-full" id="drive-audio-bar" style="width:0%"></div>
                </div>
                <div class="text-[10px] text-gray-600 mt-1">🎤 音声検出中</div>
            </div>

            <!-- カウンター -->
            <div class="flex items-center justify-center gap-8">
                <div class="text-center">
                    <div class="text-3xl font-black text-green-400" id="drive-det-count">0</div>
                    <div class="text-xs text-gray-500">種 検出</div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-black text-gray-400" id="drive-elapsed">0:00</div>
                    <div class="text-xs text-gray-500">経過</div>
                </div>
            </div>

            <!-- 終了ボタン -->
            <button id="btn-drive-stop" class="w-40 mx-auto py-4 rounded-2xl text-base font-bold bg-red-600 hover:bg-red-700 active:scale-95 transition block">
                ■ 終了
            </button>
        </div>
    </div>

    <!-- ===== 画面R: レポート作成中 ===== -->
    <div id="screen-report-loading" class="flex flex-col items-center justify-center" style="display:none;min-height:70vh">
        <div class="text-center space-y-6">
            <div class="w-12 h-12 mx-auto border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin"></div>
            <h2 class="text-lg font-bold text-gray-200">レポート作成中...</h2>
            <div class="text-sm text-gray-400">
                <span id="report-summary-text">データを集計しています</span>
            </div>
        </div>
    </div>

    <!-- ===== 画面3: 完了 ===== -->
    <div id="screen-done" class="space-y-4" style="display:none">
        <!-- 基本統計 -->
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
        </div>

        <!-- AIストーリー -->
        <div id="recap-narrative" class="bg-white/5 rounded-2xl p-5 hidden">
            <div id="recap-narrative-text" class="text-sm text-gray-200 leading-relaxed"></div>
            <div class="text-[9px] text-gray-600 mt-2 flex items-center gap-1">🤖 AIによる要約です。事実と異なる場合があります</div>
        </div>

        <!-- 出会った生物ギャラリー -->
        <div id="recap-gallery" class="hidden">
            <h3 class="text-sm font-bold text-gray-300 mb-2 px-1">出会った生物</h3>
            <div id="recap-gallery-scroll" class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style="-webkit-overflow-scrolling:touch"></div>
        </div>

        <!-- あなたの貢献 -->
        <div id="recap-contribution" class="bg-white/5 rounded-2xl p-5 hidden">
            <h3 class="text-sm font-bold text-gray-300 mb-3">あなたの貢献</h3>
            <div id="recap-contrib-list" class="space-y-2"></div>
        </div>

        <!-- バッジ・ランク -->
        <div id="recap-badges" class="bg-gradient-to-r from-amber-900/30 to-purple-900/30 rounded-2xl p-5 hidden">
            <div id="recap-badges-content"></div>
        </div>

        <!-- 送信ステータス -->
        <div id="upload-status" class="text-sm text-center p-3 text-blue-400">📡 送信中...</div>
        <button id="btn-upload" class="w-full py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold transition">🔄 再送信</button>

        <!-- アクション -->
        <div class="flex gap-3">
            <button id="btn-close" class="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-sm transition">🚶 もう一度歩く</button>
            <a href="zukan.php" class="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-sm text-center transition">📖 図鑑で復習</a>
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
    highSensitivity: true,
    speciesCardCache: {},
    totalPoints: 0,
    driveMode: false,
    errorCount: 0,
    successCount: 0,
    detCountToday: {},
};

// ユーザーの既知種リスト
var userLifeList = <?= json_encode($userSpeciesList, JSON_HEX_TAG) ?>;

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
    document.getElementById('screen-drive').style.display = name === 'drive' ? '' : 'none';
    document.getElementById('screen-report-loading').style.display = name === 'report-loading' ? '' : 'none';
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
    var selectedMode = document.querySelector('.mode-btn.active')?.dataset?.mode || 'walk';
    W.driveMode = (selectedMode === 'drive' || selectedMode === 'cycle');
    W.selectedMode = selectedMode;
    showScreen(W.driveMode ? 'drive' : 'walking');
    W.walking = true;
    W.startTime = Date.now();
    W.detections = [];
    W.routePoints = [];
    W.errorCount = 0;
    W.successCount = 0;
    W.detCountToday = {};

    if (!W.driveMode) {
        document.getElementById('det-count').textContent = '0';
        document.getElementById('gps-count').textContent = '0';
        document.getElementById('det-list').innerHTML = '';
    }

    if (W.driveMode) {
        VoiceGuide.setEnabled(true);
        document.getElementById('sensitivity-toggle').checked = true;
        W.highSensitivity = true;
        var modeIcons = {drive:'🚗', cycle:'🚲'};
        var modeLabels = {drive:'ドライブ中', cycle:'ライド中'};
        var driveIcon = document.querySelector('#screen-drive .text-6xl');
        var driveTitle = document.querySelector('#screen-drive h2');
        if (driveIcon) driveIcon.textContent = modeIcons[selectedMode] || '🚗';
        if (driveTitle) driveTitle.textContent = modeLabels[selectedMode] || 'ドライブ中';
        var audioSection = document.getElementById('drive-audio-section');
        if (audioSection) audioSection.style.display = (selectedMode === 'cycle') ? '' : 'none';
        W.lastCommentaryTime = Date.now();
    }

    // 10秒ごとに自動保存（電波断・クラッシュ対策）
    W.saveTimer = setInterval(saveSession, 10000);

    // Timer
    W.timer = setInterval(function() {
        var sec = Math.floor((Date.now() - W.startTime) / 1000);
        var timeStr = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
        var elNorm = document.getElementById('elapsed');
        var elDrive = document.getElementById('drive-elapsed');
        if (elNorm) elNorm.textContent = timeStr;
        if (elDrive && W.driveMode) elDrive.textContent = timeStr;
    }, 1000);

    // GPS（ドライブモードは省電力: enableHighAccuracy=false, maximumAge長め）
    if (navigator.geolocation) {
        var gpsOpts = W.driveMode
            ? {enableHighAccuracy:false, maximumAge:10000, timeout:15000}
            : {enableHighAccuracy:true, maximumAge:3000, timeout:10000};
        W.watchId = navigator.geolocation.watchPosition(function(pos) {
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            var acc = pos.coords.accuracy || 999;
            var point = {
                lat: lat, lng: lng, timestamp: Date.now(),
                accuracy: acc,
                speed: pos.coords.speed || null,
                altitude: pos.coords.altitude || null,
            };
            var maxAcc = W.driveMode ? 200 : 50;
            if (acc <= maxAcc) {
                W.routePoints.push(point);
                if (!W.driveMode) {
                    document.getElementById('gps-count').textContent = W.routePoints.length;
                    if (W.routePoints.length === 1) initMap(lat, lng);
                    updateMapRoute();
                }
            }
            W.lastGpsPos = {lat: lat, lng: lng, accuracy: acc};
        }, function(){}, gpsOpts);
    }

    // Audio（ドライブモードはマイク不要 — GPSガイドのみ）
    if (W.selectedMode !== 'drive') {
        try {
            W.mediaStream = await navigator.mediaDevices.getUserMedia({audio:true});
            W.audioCtx = new AudioContext();
            var source = W.audioCtx.createMediaStreamSource(W.mediaStream);
            W.analyser = W.audioCtx.createAnalyser();
            W.analyser.fftSize = 2048;
            source.connect(W.analyser);

            // Level meter (2-8kHz band for bioacoustics relevance)
            (function updateLevel() {
                if (!W.walking) return;
                var data = new Uint8Array(W.analyser.frequencyBinCount);
                W.analyser.getByteFrequencyData(data);
                var sr = W.audioCtx.sampleRate;
                var binSize = sr / 2048;
                var lo = Math.floor(500 / binSize);
                var hi = Math.min(Math.ceil(8000 / binSize), data.length - 1);
                var sum = 0;
                for (var i = lo; i <= hi; i++) sum += data[i];
                var avg = sum / (hi - lo + 1);
                var pct = Math.min(100, avg * 1.2) + '%';
                document.getElementById('audio-bar').style.width = pct;
                var driveBar = document.getElementById('drive-audio-bar');
                if (driveBar && W.driveMode) driveBar.style.width = pct;
                requestAnimationFrame(updateLevel);
            })();

            // Recorder
            setupRecorder();
        } catch(e) {
            console.warn('Audio error:', e);
        }
    }

    // ドライブ/自転車モード: 定期コメンタリー開始
    if (W.driveMode) startAmbientCommentary();

    // ドライブモード: マイクなしなので初回コメンタリーを即座に開始
    if (W.selectedMode === 'drive') {
        setTimeout(function() {
            VoiceGuide.announce('ドライブモードを開始します。周辺の自然について音声でご案内します。');
            setTimeout(fetchAmbientCommentary, 8000);
        }, 2000);
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
    var speciesMap = {};
    W.detections.forEach(function(d) {
        var key = d.scientific_name || d.name;
        if (!speciesMap[key]) speciesMap[key] = {name: d.name, scientific_name: d.scientific_name, confidence: d.confidence, count: 0};
        speciesMap[key].count++;
        speciesMap[key].confidence = Math.max(speciesMap[key].confidence, d.confidence);
    });
    var speciesList = Object.values(speciesMap);
    var sec = Math.floor((Date.now() - W.startTime) / 1000);
    W.speciesList = speciesList;
    W.sessionDuration = sec;
    document.getElementById('sum-duration').textContent = Math.floor(sec/60) + ':' + String(sec%60).padStart(2,'0');
    document.getElementById('sum-species').textContent = speciesList.length;
    document.getElementById('sum-gps').textContent = W.routePoints.length + '点';

    VoiceGuide.stop();
    if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; }

    // レポート画面表示（ドライブモードのみ中間画面）
    if (W.driveMode) {
        var rptText = document.getElementById('report-summary-text');
        if (rptText) rptText.textContent = speciesList.length + '種を検出 / ' + Math.floor(sec/60) + '分間';
        showScreen('report-loading');
    } else {
        showScreen('done');
    }

    // 自動送信を試みる
    autoUpload();

    // リッチ振り返り取得（完了後に done 画面へ遷移）
    fetchRecap(speciesList, sec);
}

// ===== Bioacoustic Frequency Filter =====
function hasBirdFrequencyEnergy() {
    if (!W.analyser) return true;
    var data = new Uint8Array(W.analyser.frequencyBinCount);
    W.analyser.getByteFrequencyData(data);
    var sr = W.audioCtx.sampleRate;
    var binSize = sr / W.analyser.fftSize;

    // 2-8kHz: bird/insect/frog vocalization range
    var birdLo = Math.floor(2000 / binSize);
    var birdHi = Math.min(Math.ceil(8000 / binSize), data.length - 1);
    var birdE = 0;
    for (var i = birdLo; i <= birdHi; i++) birdE += data[i];
    birdE /= (birdHi - birdLo + 1);

    // 0-1kHz: human voice dominant range
    var lowHi = Math.min(Math.ceil(1000 / binSize), data.length - 1);
    var lowE = 0;
    for (var i = 0; i <= lowHi; i++) lowE += data[i];
    lowE /= (lowHi + 1);

    return birdE > 15 && lowE < birdE * 1.5;
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
        var passedFilter = hasBirdFrequencyEnergy();
        sendAudio(blob, passedFilter);
    };
    startCycle();
}

function startCycle() {
    if (!W.walking || !W.recorder) return;
    if (W.analyzing) { W.recTimer = setTimeout(startCycle, 1000); return; }
    setListenState('listening');
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

async function sendAudio(blob, passedFreqFilter) {
    if (!W.walking) return;
    W.analyzing = true;
    setListenState('analyzing');
    try {
        var last = W.routePoints.length > 0 ? W.routePoints[W.routePoints.length-1] : null;
        var fd = new FormData();
        var ext = W.mimeType.indexOf('mp4') >= 0 ? '.mp4' : '.webm';
        fd.append('audio', blob, 'snippet' + ext);
        fd.append('lat', last ? last.lat : 35.0);
        fd.append('lng', last ? last.lng : 139.0);
        if (W.highSensitivity) fd.append('min_conf', '0.05');
        if (passedFreqFilter) {
            fd.append('archive_mode', '1');
            fd.append('source_mode', 'walk');
            if (last && last.accuracy) fd.append('gps_accuracy', last.accuracy);
        }

        var displayThreshold = W.highSensitivity ? 0.25 : 0.40;

        var resp = await fetch('/api/v2/analyze_audio.php', {method:'POST', body:fd});
        if (!resp.ok) { if (resp.status === 429) await new Promise(function(r){setTimeout(r,5000)}); return; }
        var json = await resp.json();
        if (json.success && json.data && json.data.detections) {
            var now = new Date();
            var filtered = json.data.detections.filter(function(d) { return d.confidence >= displayThreshold; });
            filtered.forEach(function(d) {
                var audioBar = document.getElementById('audio-bar');
                var noiseLevel = audioBar ? parseFloat(audioBar.style.width) || 0 : 0;
                var env = {
                    gps_accuracy: last ? last.accuracy : null,
                    gps_speed: last ? last.speed : null,
                    noise_level: Math.round(noiseLevel),
                    indoor_likely: last && last.accuracy > 50,
                };
                var displayName = d.japanese_name || d.common_name || d.scientific_name;
                var det = {
                    name: displayName,
                    japanese_name: d.japanese_name || null,
                    scientific_name: d.scientific_name,
                    confidence: d.confidence,
                    time: now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0'),
                    timestamp: Date.now(),
                    lat: last ? last.lat : null,
                    lng: last ? last.lng : null,
                    environment: env,
                    audio_evidence_path: json.data.audio_evidence_path || null,
                    audio_hash: json.data.audio_hash || null,
                };
                W.detections.push(det);
                document.getElementById('det-count').textContent = W.detections.length;
                addDetectionCard(det);
                addMapDetectionMarker(det);
                showLatestDetection(det);
                saveSession();

                // 貢献ポイント
                W.totalPoints += 10;
                var ptEl = document.getElementById('walk-points');
                var ptVal = document.getElementById('walk-pts-val');
                if (ptEl && ptVal) { ptEl.style.display = ''; ptVal.textContent = W.totalPoints; }

                // 実績トースト
                var isNewToUser = d.scientific_name && userLifeList.indexOf(d.scientific_name) === -1;
                if (!W.driveMode) {
                    if (W.detections.length === 1) showToast('初検出!');
                    else if (isNewToUser) showToast('新しい出会い!');
                }

                setListenState('detected');
                setTimeout(function() { setListenState('listening'); }, 2000);
                if (navigator.vibrate) navigator.vibrate(d.confidence >= 0.7 ? [30, 20, 30] : [20]);

                // ドライブモード: 検出カウント更新
                if (W.driveMode) {
                    var speciesSet = {};
                    W.detections.forEach(function(dd) { speciesSet[dd.scientific_name || dd.name] = true; });
                    var el = document.getElementById('drive-det-count');
                    if (el) el.textContent = Object.keys(speciesSet).length;
                }

                // 音声ガイド
                if (VoiceGuide.isEnabled()) {
                    var jaName = det.japanese_name || det.name;
                    var verb = det.confidence >= 0.7 ? 'です' : det.confidence >= 0.4 ? 'かもしれません' : 'の可能性があります';
                    var key = det.scientific_name || det.name;
                    W.detCountToday[key] = (W.detCountToday[key] || 0) + 1;
                    var isFirst = W.detCountToday[key] === 1;

                    if (VoiceGuide.getVoiceMode() === 'standard') {
                        VoiceGuide.announce(jaName + verb);
                    }

                    fetchVoiceGuide(jaName, det.scientific_name, det.confidence, W.detCountToday[key], isFirst)
                        .then(function(res) {
                            if (!res) return;
                            if (res.audio_url) {
                                VoiceGuide.announceAudio(res.audio_url);
                            } else if (res.guide_text) {
                                VoiceGuide.announce(res.guide_text);
                            }
                        });
                }
            });
            if (filtered.length === 0) setListenState('listening');
            W.successCount++;
            updateDriveStatus();
        } else {
            setListenState('listening');
            W.successCount++;
            updateDriveStatus();
        }
    } catch(e) {
        console.warn('Analysis error:', e);
        setListenState('listening');
        W.errorCount++;
        updateDriveStatus();
    } finally {
        W.analyzing = false;
        if (W.walking) startCycle();
    }
}

// リスニング状態インジケーター
function setListenState(state) {
    var el = document.getElementById('listen-indicator');
    if (!el) return;
    switch(state) {
        case 'listening': el.textContent = '🎤'; el.style.opacity = '1'; el.className = 'text-base transition-all duration-300 animate-pulse'; break;
        case 'analyzing': el.textContent = '🔍'; el.style.opacity = '0.7'; el.className = 'text-base transition-all duration-300'; break;
        case 'detected':  el.textContent = '🐦'; el.style.opacity = '1'; el.className = 'text-base transition-all duration-300'; break;
        default: el.textContent = '🎤'; el.style.opacity = '0.5'; el.className = 'text-base transition-all duration-300'; break;
    }
}

// トースト通知
function showToast(msg) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:80px;right:16px;z-index:100;padding:8px 16px;border-radius:12px;background:rgba(16,185,129,0.9);color:white;font-size:13px;font-weight:700;animation:fadeInOut 3s ease forwards;pointer-events:none';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}

// 種カード取得（非同期）
async function fetchSpeciesCard(name, sciName) {
    var key = sciName || name;
    if (W.speciesCardCache[key]) return W.speciesCardCache[key];
    try {
        var params = new URLSearchParams();
        if (name) params.set('name', name);
        if (sciName) params.set('scientific_name', sciName);
        var resp = await fetch('/api/v2/species_card.php?' + params.toString());
        if (!resp.ok) return null;
        var data = await resp.json();
        if (data.success && data.data) {
            W.speciesCardCache[key] = data.data;
            return data.data;
        }
    } catch(e) {}
    return null;
}

function showLatestDetection(det) {
    var panel = document.getElementById('latest-det');
    if (!panel) return;
    panel.classList.remove('hidden');

    // 信頼度バッジ
    var confBadge = document.getElementById('latest-conf-badge');
    var confPct = Math.round(det.confidence * 100);
    if (det.confidence >= 0.70) {
        confBadge.textContent = '確定';
        confBadge.style.cssText = 'background:rgba(34,197,94,0.3);color:#4ade80';
        document.getElementById('latest-det-card').style.borderColor = 'rgba(34,197,94,0.4)';
        document.getElementById('latest-det-card').style.background = 'rgba(16,185,129,0.12)';
    } else if (det.confidence >= 0.40) {
        confBadge.textContent = '推定';
        confBadge.style.cssText = 'background:rgba(251,191,36,0.3);color:#fbbf24';
        document.getElementById('latest-det-card').style.borderColor = 'rgba(251,191,36,0.3)';
        document.getElementById('latest-det-card').style.background = 'rgba(251,191,36,0.08)';
    } else {
        confBadge.textContent = '候補';
        confBadge.style.cssText = 'background:rgba(255,255,255,0.1);color:#999';
        document.getElementById('latest-det-card').style.borderColor = 'rgba(255,255,255,0.15)';
        document.getElementById('latest-det-card').style.background = 'rgba(255,255,255,0.04)';
    }

    document.getElementById('latest-name').textContent = det.name;
    document.getElementById('latest-sci').textContent = det.scientific_name || '';
    document.getElementById('latest-conf').textContent = confPct + '%';

    // 種カード情報を非同期で取得・表示（ページ遷移なし）
    var cardInfo = document.getElementById('latest-card-info');
    cardInfo.classList.add('hidden');
    fetchSpeciesCard(det.name, det.scientific_name).then(function(card) {
        if (!card) return;
        var trait = card.morphological_traits || card.notes || '';
        if (trait.length > 80) trait = trait.substring(0, 80) + '...';
        document.getElementById('latest-card-trait').textContent = trait;
        document.getElementById('latest-card-habitat').textContent = card.habitat ? '🌿 ' + card.habitat : '';
        // 種ページリンク（同画面内のモーダル風ではなく参考リンクのみ、target=_blankで裏側で開く）
        var link = document.getElementById('latest-card-link');
        if (card.scientific_name) {
            link.href = 'species.php?name=' + encodeURIComponent(card.scientific_name);
            link.target = '_blank';
            link.style.display = '';
        } else {
            link.style.display = 'none';
        }
        cardInfo.classList.remove('hidden');
    });

    // 消さない — 次の検出が来るまで表示し続ける
    if (W._latestTimer) clearTimeout(W._latestTimer);
}

function addDetectionCard(det) {
    var list = document.getElementById('det-list');
    var confPct = Math.round(det.confidence * 100);
    var confColor = det.confidence >= 0.7 ? 'color:#4ade80' : det.confidence >= 0.4 ? 'color:#fbbf24' : 'color:#999';
    var confLabel = det.confidence >= 0.7 ? '確定' : det.confidence >= 0.4 ? '推定' : '候補';
    var html = '<div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-2 det-history-card" data-sci="' + (det.scientific_name || '') + '">'
        + '<div class="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center text-green-400">🐦</div>'
        + '<div class="flex-1">'
        + '<div class="text-sm font-medium">' + det.name + '</div>'
        + (det.scientific_name ? '<div class="text-[10px] text-gray-500 italic">' + det.scientific_name + '</div>' : '')
        + '<div class="text-xs text-gray-600">' + det.time + '</div>'
        + '<div class="det-card-info text-[11px] text-gray-400 mt-1 hidden"></div>'
        + '</div>'
        + '<div class="text-right shrink-0">'
        + '<span class="text-xs font-bold" style="' + confColor + '">' + confPct + '%</span>'
        + '<div class="text-[9px]" style="' + confColor + '">' + confLabel + '</div>'
        + '</div></div>';
    list.insertAdjacentHTML('afterbegin', html);

    // 検出カードに種情報を非同期追加
    var cardEl = list.firstElementChild;
    fetchSpeciesCard(det.name, det.scientific_name).then(function(card) {
        if (!card) return;
        var infoEl = cardEl.querySelector('.det-card-info');
        if (infoEl) {
            var text = card.morphological_traits || card.notes || '';
            if (text.length > 60) text = text.substring(0, 60) + '...';
            infoEl.textContent = text;
            infoEl.classList.remove('hidden');
        }
    });
}

// ===== Rich Recap =====
async function fetchRecap(speciesList, durationSec) {
    if (speciesList.length === 0) return;
    try {
        var last = W.routePoints.length > 0 ? W.routePoints[W.routePoints.length - 1] : null;
        var resp = await fetch('/api/v2/session_recap.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                species: speciesList,
                duration_sec: durationSec,
                distance_m: calcDistance(W.routePoints),
                lat: last ? last.lat : 0,
                lng: last ? last.lng : 0,
                scan_mode: 'walk',
                hour: new Date().getHours(),
                session_id: W.sessionId || null,
            })
        });
        if (!resp.ok) return;
        var json = await resp.json();
        if (!json.success || !json.data) return;
        var data = json.data;

        // ナラティブ
        if (data.narrative) {
            var narEl = document.getElementById('recap-narrative');
            document.getElementById('recap-narrative-text').textContent = data.narrative;
            narEl.classList.remove('hidden');
        }

        // 種ギャラリー
        if (data.species_cards && data.species_cards.length > 0) {
            var gallery = document.getElementById('recap-gallery');
            var scroll = document.getElementById('recap-gallery-scroll');
            scroll.innerHTML = data.species_cards.map(function(card) {
                var confColor = card.confidence >= 0.7 ? '#4ade80' : card.confidence >= 0.4 ? '#fbbf24' : '#999';
                var trait = card.morphological_traits || card.notes || '';
                if (trait.length > 60) trait = trait.substring(0, 60) + '...';
                return '<div style="min-width:180px;max-width:200px;background:rgba(255,255,255,0.05);border-radius:16px;padding:12px;flex-shrink:0">'
                    + '<div style="font-size:15px;font-weight:800;color:' + confColor + '">' + (card.name || '') + '</div>'
                    + (card.scientific_name ? '<div style="font-size:10px;color:#999;font-style:italic">' + card.scientific_name + '</div>' : '')
                    + '<div style="font-size:11px;color:#d1d5db;margin-top:6px;line-height:1.3">' + trait + '</div>'
                    + (card.habitat ? '<div style="font-size:10px;color:#6b7280;margin-top:4px">🌿 ' + card.habitat + '</div>' : '')
                    + '<div style="font-size:10px;color:#4b5563;margin-top:4px">' + Math.round(card.confidence * 100) + '% · ' + card.count + '回検出</div>'
                    + '</div>';
            }).join('');
            gallery.classList.remove('hidden');
        }

        // 貢献
        if (data.contribution && data.contribution.length > 0) {
            var contribEl = document.getElementById('recap-contribution');
            document.getElementById('recap-contrib-list').innerHTML = data.contribution.map(function(c) {
                if (c.highlight) {
                    return '<div style="background:linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08));border:1px solid rgba(251,191,36,0.3);border-radius:10px;padding:8px 10px;margin-bottom:4px" class="flex items-start gap-2 text-sm"><span>' + c.icon + '</span><span style="color:#fde68a;font-weight:600">' + c.text + '</span></div>';
                }
                return '<div class="flex items-start gap-2 text-sm" style="margin-bottom:2px"><span>' + c.icon + '</span><span class="text-gray-300">' + c.text + '</span></div>';
            }).join('');
            contribEl.classList.remove('hidden');
        }

        // バッジ・ランク
        if (data.rank_progress) {
            var bp = data.rank_progress;
            var badgeEl = document.getElementById('recap-badges');
            var html = '';
            if (bp.rank_up) {
                html += '<div class="text-center mb-2"><span class="text-2xl">🎊</span><div class="text-sm font-bold text-amber-300">ランクアップ!</div><div class="text-lg font-black text-white">' + (bp.current_rank || '') + '</div></div>';
            }
            if (bp.badges_earned && bp.badges_earned.length > 0) {
                html += '<div class="flex flex-wrap gap-2 justify-center">' + bp.badges_earned.map(function(b) {
                    return '<span class="text-xs px-3 py-1 bg-amber-600/30 text-amber-300 rounded-full font-bold">' + (b.name || b) + '</span>';
                }).join('') + '</div>';
            }
            if (html) {
                document.getElementById('recap-badges-content').innerHTML = html;
                badgeEl.classList.remove('hidden');
            }
        }
    } catch(e) {
        console.warn('Recap error:', e);
    } finally {
        if (W.driveMode) showScreen('done');
    }
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
            environment: d.environment || null,
            audio_evidence_path: d.audio_evidence_path || null,
            audio_snippet_hash: d.audio_hash || null};
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
            method:'POST',
            headers:{'Content-Type':'application/json'},
            credentials:'same-origin',
            body: JSON.stringify({events:events, session:session})
        });

        if (resp.status === 401) {
            updateUploadStatus('⚠️ ログインが切れました。再ログインしてください', 'amber');
            savePending(events, session);
            setTimeout(function(){ window.location.href = '/login.php?redirect=' + encodeURIComponent(location.pathname); }, 2000);
            return;
        }
        if (resp.status === 429) {
            updateUploadStatus('⏳ 送信制限中です。少し待ってから再試行します', 'amber');
            savePending(events, session);
            setTimeout(function(){ retryPending(); }, 10000);
            return;
        }

        var json = await resp.json();
        if (json.success) {
            var count = (json.data && json.data.observations_created) || events.length;
            updateUploadStatus('✅ ' + count + '件のデータを送信しました', 'green');
            W.sessionId = json.data?.session_id || null;
            clearSession();
            postWalkSummary();
        } else {
            var errMsg = (json.error && json.error.message) || 'サーバーエラー';
            savePending(events, session);
            updateUploadStatus('❌ 送信エラー: ' + errMsg + '（データは保存済み）', 'amber');
        }
    } catch(e) {
        savePending(events, session);
        if (navigator.onLine) {
            updateUploadStatus('❌ サーバー接続エラー（データは保存済み、自動リトライします）', 'amber');
        } else {
            updateUploadStatus('📱 オフライン保存しました（接続回復時に自動送信）', 'amber');
        }
    }
}

function updateUploadStatus(msg, color) {
    var el = document.getElementById('upload-status');
    if (!el) return;
    var colors = {green:'text-green-400', blue:'text-blue-400', amber:'text-amber-400', gray:'text-gray-500'};
    el.className = 'text-sm text-center p-3 ' + (colors[color] || 'text-gray-400');
    el.textContent = msg;
}

// ===== Post Walk Summary to Feed =====
async function postWalkSummary() {
    if (!W.speciesList || W.speciesList.length === 0) return;
    try {
        var last = W.routePoints.length > 0 ? W.routePoints[W.routePoints.length - 1] : null;
        var summaryPayload = {
            scan_mode: 'walk',
            duration_min: Math.floor((W.sessionDuration || 0) / 60),
            species_count: W.speciesList.length,
            total_detections: W.detections.length,
            audio_detections: W.detections.length,
            visual_detections: 0,
            gps_points: W.routePoints.length,
            species: W.speciesList,
            distance_m: calcDistance(W.routePoints),
            session_id: W.sessionId || null,
            lat: last ? last.lat : null,
            lng: last ? last.lng : null,
        };
        var resp = await fetch('/api/v2/scan_summary.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(summaryPayload)
        });
        if (resp.status === 401) {
            localStorage.setItem('ikimon_pending_summary', JSON.stringify(summaryPayload));
            console.warn('Walk summary: auth expired, saved for retry');
        }
    } catch(e) {
        console.warn('Walk summary error:', e);
    }
}

// ===== Retry pending uploads (on page load) =====
async function retryPending() {
    var pending = getPending();
    if (pending.length === 0) return;
    var remaining = [];
    for (var i = 0; i < pending.length; i++) {
        try {
            var resp = await fetch('/api/v2/passive_event.php', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                credentials:'same-origin',
                body: JSON.stringify({events:pending[i].events, session:pending[i].session})
            });
            if (resp.status === 401) {
                console.warn('Walk retry: auth expired, keeping pending data');
                remaining = pending.slice(i);
                break;
            }
            var json = await resp.json();
            if (json.success) {
                console.log('✅ Pending walk data uploaded:', pending[i].events.length, 'events');
                updateUploadStatus('✅ 保留データを送信しました', 'green');
            } else {
                console.warn('Walk retry: server rejected:', json.error);
                remaining.push(pending[i]);
            }
        } catch(e) {
            console.warn('Walk retry: network error, keeping remaining');
            remaining = remaining.concat(pending.slice(i));
            break;
        }
    }
    if (remaining.length > 0) {
        localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    } else {
        clearPending();
    }
}

// ===== Manual retry button =====
async function manualUpload() {
    updateUploadStatus('📡 再送信中...', 'blue');
    await autoUpload();
}

// ページ読み込み時に未送信データを送信試行
retryPending();

// 未送信サマリーのリトライ
(function retryPendingSummary() {
    var raw = localStorage.getItem('ikimon_pending_summary');
    if (!raw) return;
    try {
        var payload = JSON.parse(raw);
        fetch('/api/v2/scan_summary.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        }).then(function(r) {
            if (r.ok) {
                localStorage.removeItem('ikimon_pending_summary');
                console.log('✅ Pending summary retried successfully');
            }
        }).catch(function() {});
    } catch(e) {}
})();

// オンライン復帰時に自動リトライ
window.addEventListener('online', function() {
    console.log('🔄 Walk: Online detected, retrying pending...');
    setTimeout(retryPending, 1500);
});

// タブ復帰時にもリトライ
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && navigator.onLine) {
        var pending = getPending();
        if (pending.length > 0) {
            console.log('🔄 Walk: Tab visible, retrying pending...');
            retryPending();
        }
    }
});

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

// ===== Consent toggle (localStorage で記憶) =====
(function() {
    var cb = document.getElementById('consent-check');
    var btn = document.getElementById('btn-start');
    function updateBtn(checked) {
        if (checked) {
            btn.disabled = false;
            btn.className = 'w-full py-5 rounded-2xl text-lg font-bold bg-green-600 hover:bg-green-700 active:scale-95 transition';
        } else {
            btn.disabled = true;
            btn.className = 'w-full py-5 rounded-2xl text-lg font-bold bg-green-600/50 text-green-300 cursor-not-allowed transition';
        }
    }
    // 前回の同意を復元
    if (localStorage.getItem('ikimon_walk_consent') === '1') {
        cb.checked = true;
        updateBtn(true);
    }
    cb.addEventListener('change', function() {
        localStorage.setItem('ikimon_walk_consent', this.checked ? '1' : '0');
        updateBtn(this.checked);
    });
})();

// ===== Sensitivity toggle =====
var sensToggle = document.getElementById('sensitivity-toggle');
if (sensToggle) sensToggle.addEventListener('change', function() { W.highSensitivity = this.checked; });

// ===== Mode selection =====
function selectMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(function(b) {
        var isActive = b.dataset.mode === mode;
        b.classList.toggle('active', isActive);
        b.style.borderColor = isActive ? '#22c55e' : 'transparent';
        b.style.background = isActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)';
        b.style.color = isActive ? '#86efac' : '#9ca3af';
    });
    var btn = document.getElementById('btn-start');
    var modeLabels = {walk:'🎧 ウォーク開始', drive:'🚗 ドライブ開始', cycle:'🚲 ライド開始'};
    btn.textContent = modeLabels[mode] || '🎧 開始';
    if (mode === 'drive' || mode === 'cycle') {
        document.getElementById('voice-toggle').checked = true;
        VoiceGuide.setEnabled(true);
        var sel = document.getElementById('voice-mode-selector');
        if (sel) sel.style.display = 'flex';
    }
}

function selectVoiceMode(mode) {
    VoiceGuide.setVoiceMode(mode);
    document.querySelectorAll('.voice-mode-btn').forEach(function(b) {
        var isActive = b.dataset.vmode === mode;
        b.classList.toggle('active', isActive);
        b.style.borderColor = isActive ? '#3b82f6' : 'transparent';
        b.style.background = isActive ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)';
        b.style.color = isActive ? '#93c5fd' : '#9ca3af';
    });
}

// 音声ガイドトグル連動
document.getElementById('voice-toggle').addEventListener('change', function() {
    var sel = document.getElementById('voice-mode-selector');
    if (sel) sel.style.display = this.checked ? 'flex' : 'none';
});

// 音声ガイド設定の復元
(function restoreVoiceSettings() {
    if (VoiceGuide.isEnabled()) {
        var vt = document.getElementById('voice-toggle');
        if (vt) vt.checked = true;
        var sel = document.getElementById('voice-mode-selector');
        if (sel) sel.style.display = 'flex';
        selectVoiceMode(VoiceGuide.getVoiceMode());
    }
})();

// ドライブステータス更新
function updateDriveStatus() {
    if (!W.driveMode) return;
    var dot = document.getElementById('drive-status-dot');
    var txt = document.getElementById('drive-status-text');
    if (!dot || !txt) return;
    var total = W.successCount + W.errorCount;
    if (total < 3) return;
    var errorRate = W.errorCount / total;
    if (errorRate > 0.5) {
        dot.style.background = '#ef4444';
        txt.style.color = '#fca5a5';
        txt.textContent = '接続不安定';
    } else if (errorRate > 0.2) {
        dot.style.background = '#f59e0b';
        txt.style.color = '#fde68a';
        txt.textContent = 'やや不安定';
    } else {
        dot.style.background = '#22c55e';
        txt.style.color = '#86efac';
        txt.textContent = 'システム正常';
    }
}

// 音声ガイド解説取得
async function fetchVoiceGuide(name, sciName, confidence, count, isFirst) {
    try {
        var params = new URLSearchParams();
        params.set('name', name || '');
        params.set('scientific_name', sciName || '');
        params.set('confidence', confidence);
        params.set('detection_count', count || 1);
        params.set('is_first_today', isFirst ? '1' : '0');
        params.set('voice_mode', VoiceGuide.getVoiceMode());
        var resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
        if (!resp.ok) return null;
        var json = await resp.json();
        return json.success ? json.data : null;
    } catch(e) { return null; }
}

// ===== Ambient Commentary (定期トーク) =====
var ambientTimer = null;
function startAmbientCommentary() {
    if (!W.driveMode || !VoiceGuide.isEnabled()) return;
    VoiceGuide.onFinish(function() { W.lastCommentaryTime = Date.now(); });
    var INTERVAL = 10 * 1000; // 10秒ごとにチェック
    ambientTimer = setInterval(function() {
        if (VoiceGuide.isSpeaking()) return; // 発話中はスキップ
        var sinceLast = Date.now() - (W.lastCommentaryTime || W.startTime);
        if (sinceLast < 15000) return; // 最後の発話終了から15秒の沈黙を確保
        fetchAmbientCommentary();
    }, INTERVAL);
}

async function fetchAmbientCommentary() {
    try {
        var last = W.routePoints.length > 0 ? W.routePoints[W.routePoints.length-1] : null;
        var speciesNames = [];
        var seen = {};
        W.detections.forEach(function(d) {
            var n = d.japanese_name || d.name;
            if (!seen[n]) { speciesNames.push(n); seen[n] = true; }
        });
        var elapsedMin = Math.floor((Date.now() - W.startTime) / 60000);
        var params = new URLSearchParams();
        params.set('mode', 'ambient');
        params.set('lat', last ? last.lat : 35);
        params.set('lng', last ? last.lng : 139);
        params.set('detected_species', speciesNames.slice(0, 5).join(','));
        params.set('elapsed_min', elapsedMin);
        params.set('voice_mode', VoiceGuide.getVoiceMode());

        var resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
        if (!resp.ok) return;
        var json = await resp.json();
        if (json.success && json.data) {
            W.lastCommentaryTime = Date.now();
            if (json.data.audio_url) {
                VoiceGuide.announceAudio(json.data.audio_url);
            } else if (json.data.guide_text) {
                VoiceGuide.announce(json.data.guide_text);
            }
        }
    } catch(e) {}
}

// ===== Event listeners =====
document.getElementById('btn-start').addEventListener('click', startWalk);
document.getElementById('btn-stop').addEventListener('click', stopWalk);
document.getElementById('btn-drive-stop').addEventListener('click', stopWalk);
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
