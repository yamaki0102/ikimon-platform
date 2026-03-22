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
        .glass { backdrop-filter: blur(16px); background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.08); }

        /* ポップアップ */
        .maplibregl-popup-content {
            background: rgba(15,23,42,0.95) !important;
            backdrop-filter: blur(16px) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 16px !important;
            padding: 16px 20px !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
            min-width: 220px !important;
            color: #fff !important;
        }
        .maplibregl-popup-tip {
            border-top-color: rgba(15,23,42,0.95) !important;
        }
        .maplibregl-popup-close-button {
            color: rgba(255,255,255,0.5) !important;
            font-size: 20px !important;
            right: 8px !important;
            top: 8px !important;
        }

        /* フィルターボタン */
        .filter-chip {
            padding: 6px 14px;
            border-radius: 99px;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.15s;
            cursor: pointer;
            border: none;
            color: rgba(255,255,255,0.5);
            background: transparent;
        }
        .filter-chip:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .filter-chip.active { color: #fff; background: rgba(255,255,255,0.2); }
    </style>
</head>
<body class="bg-black text-white overflow-hidden" style="height:100vh">

<?php include __DIR__ . '/components/nav.php'; ?>

<!-- フルスクリーンマップ -->
<div id="map"></div>

<!-- 左上: 統計オーバーレイ -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 16px); left: 16px;">
    <div class="glass rounded-2xl px-5 py-4 space-y-3">
        <div class="text-[11px] text-gray-400 font-bold tracking-wider uppercase">生物デジタルツイン</div>
        <div class="flex items-end gap-5">
            <div>
                <div class="text-3xl font-black text-green-400 leading-none" id="stat-obs">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">観察</div>
            </div>
            <div>
                <div class="text-3xl font-black text-blue-400 leading-none" id="stat-species">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">種</div>
            </div>
            <div>
                <div class="text-3xl font-black text-purple-400 leading-none" id="stat-people">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">参加者</div>
            </div>
        </div>
        <div class="flex items-center gap-4 text-[11px] text-gray-500 pt-1 border-t border-white/5">
            <span><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:#10b981"></span>ウォーク</span>
            <span><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:#3b82f6"></span>スキャン</span>
            <span><span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style="background:#a855f7"></span>投稿</span>
        </div>
    </div>
</div>

<!-- 右上: フィルター -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 16px); right: 16px;">
    <div class="glass rounded-2xl px-2 py-1.5 flex items-center gap-1">
        <button class="filter-chip active" data-source="all" id="filter-all">すべて</button>
        <button class="filter-chip" data-source="post">📷 投稿</button>
        <button class="filter-chip" data-source="walk">🚶 ウォーク</button>
        <button class="filter-chip" data-source="live-scan">📡 スキャン</button>
        <span class="w-px h-5 bg-white/10 mx-1"></span>
        <button id="toggle-grid" class="filter-chip">🔲 網羅度</button>
        <button id="toggle-toilets" class="filter-chip">🚻</button>
    </div>
</div>

<!-- 右下: メッシュ集計ステータス -->
<div class="map-overlay" id="grid-stats" style="bottom: 100px; right: 16px; display:none">
    <div class="glass rounded-2xl px-4 py-3 text-sm space-y-1.5">
        <div class="text-gray-400 font-bold">🔲 生物多様性メッシュ</div>
        <div><span class="text-green-400 font-black text-lg" id="stat-cells">—</span> <span class="text-gray-400">メッシュ表示中</span></div>
        <div class="text-xs text-gray-500 pb-1">1km四方の永続メッシュ — 色は最多グループ</div>
        <div class="border-t border-white/5 pt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-400">
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#f59e0b"></span>鳥類</span>
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#10b981"></span>植物</span>
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#f97316"></span>昆虫</span>
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#8b5cf6"></span>哺乳類</span>
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#06b6d4"></span>両生類</span>
            <span><span class="inline-block w-2 h-2 rounded-sm mr-1" style="background:#3b82f6"></span>魚類</span>
        </div>
    </div>
</div>

<!-- 下部: CTA -->
<div class="map-overlay" style="bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 520px;">
    <div class="glass rounded-2xl px-6 py-4">
        <?php if ($currentUser): ?>
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-gray-400">あなたの貢献</span>
            <span class="text-sm text-green-400 font-bold" id="my-contrib">読み込み中...</span>
        </div>
        <div class="flex gap-3 justify-center">
            <a href="walk.php" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold transition text-center">🎧 ウォーク</a>
            <a href="field_scan.php" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition text-center">📡 スキャン</a>
            <a href="post.php" class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition text-center">📷 投稿</a>
        </div>
        <?php else: ?>
        <div class="text-center">
            <p class="text-xs text-gray-400 mb-3">この地図はみんなの観察で成長します</p>
            <a href="login.php" class="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold transition">参加して地図を育てる</a>
        </div>
        <?php endif; ?>
    </div>
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
    map.addSource('observations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    // ヒートマップレイヤー（ズーム 14 まで）
    map.addLayer({
        id: 'obs-heat',
        type: 'heatmap',
        source: 'observations',
        maxzoom: 14,
        paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'confidence'], 0, 0.3, 1, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 14, 3],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 14, 28],
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, 'rgba(16,185,129,0.3)',
                0.4, 'rgba(59,130,246,0.5)',
                0.6, 'rgba(168,85,247,0.6)',
                0.8, 'rgba(245,158,11,0.8)',
                1.0, 'rgba(239,68,68,0.9)'
            ],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.85, 15, 0]
        }
    });

    // メッシュ集計ソース（生物多様性グリッド）
    map.addSource('mesh', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({
        id: 'mesh-fill',
        type: 'fill',
        source: 'mesh',
        paint: {
            'fill-color': [
                'match', ['get', 'top_group'],
                '鳥類',     '#f59e0b',
                '植物',     '#10b981',
                '昆虫',     '#f97316',
                '哺乳類',   '#8b5cf6',
                '爬虫類',   '#84cc16',
                '両生類',   '#06b6d4',
                '魚類',     '#3b82f6',
                'クモ類',   '#ec4899',
                '菌類',     '#a78bfa',
                'コケ・地衣類', '#6b7280',
                '#9ca3af'
            ],
            'fill-opacity': [
                'interpolate', ['linear'], ['get', 'total'],
                1, 0.15, 10, 0.32, 30, 0.52, 100, 0.68
            ],
        },
        layout: { visibility: 'none' },
    });

    map.addLayer({
        id: 'mesh-outline',
        type: 'line',
        source: 'mesh',
        paint: {
            'line-color': [
                'match', ['get', 'top_group'],
                '鳥類',     '#f59e0b',
                '植物',     '#10b981',
                '昆虫',     '#f97316',
                '哺乳類',   '#8b5cf6',
                '爬虫類',   '#84cc16',
                '両生類',   '#06b6d4',
                '魚類',     '#3b82f6',
                'クモ類',   '#ec4899',
                '菌類',     '#a78bfa',
                'コケ・地衣類', '#6b7280',
                'rgba(255,255,255,0.3)'
            ],
            'line-width': 0.8,
            'line-opacity': 0.6,
        },
        layout: { visibility: 'none' },
    });

    map.addLayer({
        id: 'mesh-label',
        type: 'symbol',
        source: 'mesh',
        minzoom: 11,
        layout: {
            'text-field': ['to-string', ['get', 'total']],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 14, 12],
            'text-anchor': 'center',
            'visibility': 'none',
        },
        paint: {
            'text-color': '#fff',
            'text-halo-color': 'rgba(0,0,0,0.75)',
            'text-halo-width': 1.5,
        },
    });

    // メッシュクリックでポップアップ
    map.on('click', 'mesh-fill', function(e) {
        var f = e.features[0];
        var p = f.properties;
        var byGroup = p.by_group;
        if (typeof byGroup === 'string') { try { byGroup = JSON.parse(byGroup); } catch(ex) { byGroup = {}; } }
        var families = p.families;
        if (typeof families === 'string') { try { families = JSON.parse(families); } catch(ex) { families = []; } }

        var groupColors = {
            '鳥類':'#f59e0b','植物':'#10b981','昆虫':'#f97316','哺乳類':'#8b5cf6',
            '爬虫類':'#84cc16','両生類':'#06b6d4','魚類':'#3b82f6','クモ類':'#ec4899',
            '菌類':'#a78bfa','コケ・地衣類':'#6b7280','その他':'#9ca3af'
        };

        var groupRows = '';
        if (byGroup) {
            var sorted = Object.entries(byGroup).sort(function(a, b) { return b[1] - a[1]; });
            sorted.forEach(function(kv) {
                var color = groupColors[kv[0]] || '#9ca3af';
                var pct = p.total > 0 ? Math.round((kv[1] / p.total) * 100) : 0;
                groupRows += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
                    '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>' +
                    '<span style="font-size:12px;color:rgba(255,255,255,0.8);min-width:80px">' + kv[0] + '</span>' +
                    '<div style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px">' +
                      '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:2px"></div>' +
                    '</div>' +
                    '<span style="font-size:11px;color:rgba(255,255,255,0.45);min-width:20px;text-align:right">' + kv[1] + '</span>' +
                    '</div>';
            });
        }

        var famLine = (families && families.length > 0)
            ? '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:10px">科: ' + families.join('、') + '</div>'
            : '';
        var lastObs = p.last_obs
            ? '<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:5px">最終記録: ' + p.last_obs + '</div>'
            : '';

        var coords = f.geometry.coordinates[0];
        var lngSum = 0, latSum = 0;
        coords.forEach(function(c) { lngSum += c[0]; latSum += c[1]; });
        var center = [lngSum / coords.length, latSum / coords.length];

        new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: '300px' })
            .setLngLat(center)
            .setHTML(
                '<div style="font-size:14px">' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.08em;font-family:monospace;margin-bottom:6px">' + p.mesh_code + '</div>' +
                '<div style="font-size:22px;font-weight:900;line-height:1"><span style="color:#10b981">' + p.total + '</span> <span style="font-size:13px;color:rgba(255,255,255,0.55)">件の検出</span></div>' +
                '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">' + p.group_count + ' グループ検出</div>' +
                groupRows + famLine + lastObs +
                '</div>'
            )
            .addTo(map);
    });
    map.on('mouseenter', 'mesh-fill', function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'mesh-fill', function() { map.getCanvas().style.cursor = ''; });

    // サイト境界
    map.addSource('sites', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'site-borders', type: 'line', source: 'sites',
        paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
    });
    map.addLayer({
        id: 'site-fill', type: 'fill', source: 'sites',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.05 },
    });
    map.addLayer({
        id: 'site-labels', type: 'symbol', source: 'sites',
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-anchor': 'center' },
        paint: { 'text-color': '#f59e0b', 'text-halo-color': '#000', 'text-halo-width': 1 },
    });

    fetch('/api/v2/ecosystem_map.php?action=list_sites').then(function(r) { return r.json(); }).then(function(json) {
        if (json.success && json.data && json.data.features) map.getSource('sites').setData(json.data);
    }).catch(function(){});

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

        var s = json.data.stats;
        document.getElementById('stat-obs').textContent = s.total;
        document.getElementById('stat-species').textContent = s.species;
        document.getElementById('stat-people').textContent = s.contributors;

        var contrib = document.getElementById('my-contrib');
        if (contrib && s.total > 0) {
            contrib.textContent = s.total + '件の観察で ' + s.species + '種を記録中';
        }

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

function loadMesh() {
    var b = map.getBounds();
    var url = '/api/v2/mesh_aggregates.php' +
        '?lat_min=' + b.getSouth().toFixed(4) +
        '&lng_min=' + b.getWest().toFixed(4) +
        '&lat_max=' + b.getNorth().toFixed(4) +
        '&lng_max=' + b.getEast().toFixed(4);
    fetch(url).then(function(r) { return r.json(); }).then(function(gj) {
        if (!gj.features) return;
        map.getSource('mesh').setData(gj);
        var el = document.getElementById('stat-cells');
        if (el) el.textContent = gj.features.length;
    }).catch(function(e) { console.warn('Mesh load error:', e); });
}

// フィルターボタン
document.querySelectorAll('.filter-chip[data-source]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        currentSource = this.getAttribute('data-source');
        document.querySelectorAll('.filter-chip[data-source]').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        loadData();
    });
});

// 生物多様性メッシュトグル
document.getElementById('toggle-grid').addEventListener('click', function() {
    gridVisible = !gridVisible;
    var vis = gridVisible ? 'visible' : 'none';
    map.setLayoutProperty('mesh-fill',    'visibility', vis);
    map.setLayoutProperty('mesh-outline', 'visibility', vis);
    map.setLayoutProperty('mesh-label',   'visibility', vis);
    this.classList.toggle('active', gridVisible);
    document.getElementById('grid-stats').style.display = gridVisible ? '' : 'none';
    if (gridVisible) loadMesh();
});

// メッシュ: パン/ズーム後に再取得
map.on('moveend', function() {
    if (gridVisible) loadMesh();
});

// トイレトグル
var toiletsVisible = false;
var toiletMarkers = [];
document.getElementById('toggle-toilets').addEventListener('click', function() {
    toiletsVisible = !toiletsVisible;
    this.classList.toggle('active', toiletsVisible);
    if (toiletsVisible && toiletMarkers.length === 0) {
        var center = map.getCenter();
        var query = '[out:json][timeout:10];node["amenity"="toilets"](around:5000,' + center.lat + ',' + center.lng + ');out body;';
        fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.elements) return;
                data.elements.forEach(function(t) {
                    var el = document.createElement('div');
                    el.style.cssText = 'font-size:24px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
                    el.textContent = '🚻';
                    var name = t.tags.name || t.tags.description || '公衆トイレ';
                    var fee = t.tags.fee === 'yes' ? '有料' : '無料';
                    var wheelchair = t.tags.wheelchair === 'yes' ? ' ♿' : '';
                    var m = new maplibregl.Marker({element: el})
                        .setLngLat([t.lon, t.lat])
                        .setPopup(new maplibregl.Popup({offset: 15, closeButton: false, maxWidth: '220px'})
                            .setHTML('<div style="font-size:14px;font-weight:700">🚻 ' + name + '</div><div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">' + fee + wheelchair + '</div>'))
                        .addTo(map);
                    toiletMarkers.push(m);
                });
            }).catch(function(){});
    } else if (!toiletsVisible) {
        toiletMarkers.forEach(function(m) { m.remove(); });
        toiletMarkers = [];
    }
});
</script>
</body>
</html>
