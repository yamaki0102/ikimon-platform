<?php
/**
 * livemap.php — 生物デジタルツイン公開マップ
 *
 * ログイン不要。誰でもアクセス可能。
 * Canonical Schema の全観察データをリアルタイムで地図表示。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
$currentUser = Auth::user();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php
    $meta_title = "ライブマップ — 生物デジタルツイン | ikimon.life";
    $meta_description = "みんなの観察データが1つの地図に。鳥の声、植物、昆虫 — 地球の生き物マップをリアルタイムで。";
    include __DIR__ . '/components/meta.php';
    ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
    <style>
        #map { position: absolute; inset: 0; top: var(--nav-height, 56px); }
        .map-overlay { position: absolute; z-index: 10; pointer-events: none; }
        .map-overlay > * { pointer-events: auto; }
        .stat-pill { backdrop-filter: blur(12px); background: rgba(0,0,0,0.7); }
    </style>
</head>
<body class="bg-black text-white overflow-hidden" style="height:100vh">

<?php include __DIR__ . '/components/nav.php'; ?>

<!-- フルスクリーンマップ -->
<div id="map"></div>

<!-- 左上: 統計オーバーレイ -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 12px); left: 12px;">
    <div class="stat-pill rounded-2xl px-4 py-3 space-y-1">
        <div class="text-xs text-gray-400 font-bold">🌍 生物デジタルツイン</div>
        <div class="flex items-center gap-4 text-sm">
            <div><span class="text-2xl font-black text-green-400" id="stat-obs">—</span> <span class="text-xs text-gray-400">観察</span></div>
            <div><span class="text-2xl font-black text-blue-400" id="stat-species">—</span> <span class="text-xs text-gray-400">種</span></div>
            <div><span class="text-2xl font-black text-purple-400" id="stat-people">—</span> <span class="text-xs text-gray-400">人</span></div>
        </div>
    </div>
</div>

<!-- 右上: フィルター -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 12px); right: 12px;">
    <div class="stat-pill rounded-xl px-3 py-2 flex gap-1.5">
        <button class="filter-btn text-xs px-2.5 py-1 rounded-full bg-white/20 text-white font-bold" data-source="all" id="filter-all">すべて</button>
        <button class="filter-btn text-xs px-2.5 py-1 rounded-full text-gray-400" data-source="post">📷</button>
        <button class="filter-btn text-xs px-2.5 py-1 rounded-full text-gray-400" data-source="walk">🚶</button>
        <button class="filter-btn text-xs px-2.5 py-1 rounded-full text-gray-400" data-source="live-scan">📡</button>
        <span class="w-px h-4 bg-white/20"></span>
        <button id="toggle-grid" class="text-xs px-2.5 py-1 rounded-full text-gray-400">🔲 網羅度</button>
    </div>
</div>

<!-- 右下: 網羅度ステータス -->
<div class="map-overlay" id="grid-stats" style="bottom: 90px; right: 12px; display:none">
    <div class="stat-pill rounded-xl px-3 py-2 text-xs space-y-1">
        <div class="text-gray-400 font-bold">🔲 網羅度</div>
        <div><span class="text-green-400 font-bold" id="stat-cells">—</span> セル調査済み</div>
        <div class="text-gray-500">まだ歩かれていない場所が多いほど、あなたの貢献が大きい</div>
    </div>
</div>

<!-- 下部: CTA + 効力感 -->
<div class="map-overlay" style="bottom: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 24px); max-width: 500px;">
    <div class="stat-pill rounded-2xl px-5 py-3">
        <div class="text-xs text-gray-400 mb-2 text-center">この地図はみんなの観察で成長します</div>
        <?php if ($currentUser): ?>
        <!-- ログイン済み: 自分の貢献 -->
        <div class="flex items-center justify-between mb-2 text-xs">
            <span class="text-gray-500">あなたの貢献</span>
            <span class="text-green-400 font-bold" id="my-contrib">読み込み中...</span>
        </div>
        <div class="flex gap-2 justify-center">
            <a href="walk.php" class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-full text-xs font-bold transition">🎧 ウォーク</a>
            <a href="field_scan.php" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-xs font-bold transition">📡 スキャン</a>
            <a href="post.php" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-full text-xs font-bold transition">📷 投稿</a>
        </div>
        <?php else: ?>
        <div class="text-center">
            <a href="login.php" class="inline-block px-6 py-2.5 bg-green-600 hover:bg-green-700 rounded-full text-sm font-bold transition">参加して地図を育てる</a>
        </div>
        <?php endif; ?>
    </div>
</div>

<!-- 種名ポップアップ用 -->
<div id="species-popup" class="stat-pill rounded-xl px-4 py-3 hidden" style="position:absolute; z-index:20; max-width:250px">
    <div class="text-sm font-bold" id="popup-name"></div>
    <div class="text-xs text-gray-400" id="popup-detail"></div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
var map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.jp/styles/osm-bright-ja/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center: [139.0, 36.0],
    zoom: 5,
});

var currentSource = 'all';

map.on('load', function() {
    // データソース追加
    map.addSource('observations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // ヒートマップレイヤー（ズームアウト時）
    map.addLayer({
        id: 'obs-heat',
        type: 'heatmap',
        source: 'observations',
        maxzoom: 12,
        paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'confidence'], 0, 0.3, 1, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 12, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 12, 20],
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, 'rgba(16,185,129,0.3)',
                0.4, 'rgba(59,130,246,0.5)',
                0.6, 'rgba(168,85,247,0.6)',
                0.8, 'rgba(245,158,11,0.8)',
                1.0, 'rgba(239,68,68,0.9)'
            ],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 0]
        }
    });

    // ポイントレイヤー（ズームイン時）
    map.addLayer({
        id: 'obs-points',
        type: 'circle',
        source: 'observations',
        minzoom: 10,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 8],
            'circle-color': [
                'match', ['get', 'source'],
                'post', '#a855f7',
                'walk', '#10b981',
                'live-scan', '#3b82f6',
                '#f59e0b'
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.85,
        }
    });

    // クリックでポップアップ
    map.on('click', 'obs-points', function(e) {
        var f = e.features[0];
        var p = f.properties;
        var tierLabels = {1:'AI判定',1.5:'AI+生態学的',2:'検証済み',3:'Research Grade',4:'外部監査'};
        new maplibregl.Popup({offset: 12, closeButton: false, maxWidth: '250px'})
            .setLngLat(f.geometry.coordinates)
            .setHTML(
                '<div style="color:#000;font-size:13px">' +
                '<strong>' + (p.name || '未同定') + '</strong><br>' +
                '<span style="color:#666">' +
                (tierLabels[p.tier] || 'Tier ' + p.tier) + ' · ' +
                ({'post':'📷 投稿','walk':'🚶 ウォーク','live-scan':'📡 ライブスキャン'}[p.source] || p.source) + ' · ' +
                (p.date || '') +
                '</span></div>'
            )
            .addTo(map);
    });
    map.on('mouseenter', 'obs-points', function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'obs-points', function() { map.getCanvas().style.cursor = ''; });

    // 網羅度グリッドソース
    map.addSource('grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'grid-cells',
        type: 'circle',
        source: 'grid',
        minzoom: 11,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 8, 16, 30],
            'circle-color': [
                'interpolate', ['linear'], ['get', 'species'],
                0, 'rgba(16,185,129,0.15)',
                3, 'rgba(16,185,129,0.3)',
                10, 'rgba(59,130,246,0.4)',
                20, 'rgba(168,85,247,0.5)'
            ],
            'circle-stroke-width': 1,
            'circle-stroke-color': 'rgba(255,255,255,0.1)',
            'circle-opacity': 0.6,
        },
        layout: { visibility: 'none' },
    });

    // サイト境界（SiteManager の GeoJSON）
    map.addSource('sites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'site-borders',
        type: 'line',
        source: 'sites',
        paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
    });
    map.addLayer({
        id: 'site-fill',
        type: 'fill',
        source: 'sites',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.05 },
    });
    map.addLayer({
        id: 'site-labels',
        type: 'symbol',
        source: 'sites',
        layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-anchor': 'center',
        },
        paint: { 'text-color': '#f59e0b', 'text-halo-color': '#000', 'text-halo-width': 1 },
    });

    // サイト境界をロード
    fetch('/api/v2/ecosystem_map.php?action=list_sites').then(function(r) { return r.json(); }).then(function(json) {
        if (json.success && json.data && json.data.features) {
            map.getSource('sites').setData(json.data);
        }
    }).catch(function(){});

    // データ読み込み
    loadData();
});

var gridVisible = false;

function loadData() {
    var url = '/api/v2/map_observations.php?source=' + currentSource + '&limit=5000';
    fetch(url).then(function(r) { return r.json(); }).then(function(json) {
        if (!json.success) return;
        map.getSource('observations').setData({
            type: 'FeatureCollection',
            features: json.data.features
        });

        // 網羅度グリッド
        if (json.data.grid) {
            map.getSource('grid').setData({
                type: 'FeatureCollection',
                features: json.data.grid
            });
            var el = document.getElementById('stat-cells');
            if (el) el.textContent = json.data.grid.length;
        }

        // 統計更新
        var s = json.data.stats;
        document.getElementById('stat-obs').textContent = s.total;
        document.getElementById('stat-species').textContent = s.species;
        document.getElementById('stat-people').textContent = s.contributors;

        // 効力感: ログインユーザーの貢献（簡易版: 全体の統計で表示）
        var contrib = document.getElementById('my-contrib');
        if (contrib && s.total > 0) {
            contrib.textContent = s.total + '件の観察で ' + s.species + '種を記録中';
        }

        // データがあればフィット
        if (json.data.features.length > 0) {
            var coords = json.data.features.map(function(f) { return f.geometry.coordinates; });
            var bounds = coords.reduce(function(b, c) {
                return [[Math.min(b[0][0], c[0]), Math.min(b[0][1], c[1])],
                        [Math.max(b[1][0], c[0]), Math.max(b[1][1], c[1])]];
            }, [[coords[0][0], coords[0][1]], [coords[0][0], coords[0][1]]]);
            map.fitBounds(bounds, {padding: 60, maxZoom: 14});
        }
    }).catch(function(e) { console.warn('Map data load error:', e); });
}

// フィルターボタン
document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        currentSource = this.getAttribute('data-source');
        document.querySelectorAll('.filter-btn').forEach(function(b) {
            b.className = 'filter-btn text-xs px-2.5 py-1 rounded-full text-gray-400';
        });
        this.className = 'filter-btn text-xs px-2.5 py-1 rounded-full bg-white/20 text-white font-bold';
        loadData();
    });
});

// 網羅度グリッドトグル
document.getElementById('toggle-grid').addEventListener('click', function() {
    gridVisible = !gridVisible;
    map.setLayoutProperty('grid-cells', 'visibility', gridVisible ? 'visible' : 'none');
    this.className = 'text-xs px-2.5 py-1 rounded-full ' + (gridVisible ? 'bg-white/20 text-white font-bold' : 'text-gray-400');
    document.getElementById('grid-stats').style.display = gridVisible ? '' : 'none';
});
</script>
</body>
</html>
