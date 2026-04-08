<?php
/**
 * biodiversity_map.php — いきものマップ: みんなで育てる生物多様性の地図
 *
 * 1kmメッシュの BIS スコアで色分け。
 * 空白エリア = まだ誰も記録していない → 次の散歩の動機に。
 * 記録が増えるほどメッシュが成長（発見→芽吹き→成長中→豊か→充実）。
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
    $meta_title = "いきものマップ — みんなで育てる生物多様性の地図 | ikimon.life";
    $meta_description = "あなたの街の生きものが見える地図。みんなの記録で成長する生物多様性マップ。空白エリアを埋めて、地域の自然を可視化しよう。";
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

        .maplibregl-popup-content {
            background: rgba(15,23,42,0.95) !important;
            backdrop-filter: blur(16px) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            border-radius: 16px !important;
            padding: 16px 20px !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
            min-width: 260px !important;
            color: #fff !important;
        }
        .maplibregl-popup-tip { border-top-color: rgba(15,23,42,0.95) !important; }
        .maplibregl-popup-close-button {
            color: rgba(255,255,255,0.5) !important;
            font-size: 20px !important;
            right: 8px !important; top: 8px !important;
        }

        .filter-chip {
            padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
            transition: all 0.15s; cursor: pointer; border: none;
            color: rgba(255,255,255,0.5); background: transparent;
        }
        .filter-chip:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .filter-chip.active { color: #fff; background: rgba(255,255,255,0.2); }

        .stage-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }

        .bis-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); }
        .bis-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }
    </style>
</head>
<body class="bg-black text-white overflow-hidden" style="height:100vh">

<?php include __DIR__ . '/components/nav.php'; ?>

<div id="map"></div>

<!-- 左上: 統計 + 凡例 -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 16px); left: 16px;">
    <div class="glass rounded-2xl px-5 py-4 space-y-3" style="max-width:280px">
        <div class="text-[11px] text-gray-400 font-bold tracking-wider uppercase">いきものマップ</div>
        <div class="flex items-end gap-4">
            <div>
                <div class="text-2xl font-black text-emerald-400 leading-none" id="stat-meshes">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">調査エリア</div>
            </div>
            <div>
                <div class="text-2xl font-black text-blue-400 leading-none" id="stat-species">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">確認種</div>
            </div>
            <div>
                <div class="text-2xl font-black text-red-400 leading-none" id="stat-redlist">—</div>
                <div class="text-[10px] text-gray-500 font-bold mt-1">希少種</div>
            </div>
        </div>

        <!-- 成長段階の凡例 -->
        <div class="border-t border-white/5 pt-2 space-y-1">
            <div class="text-[10px] text-gray-500 font-bold tracking-wider mb-1">成長段階</div>
            <div class="flex items-center gap-2 text-[11px]">
                <span class="stage-dot" style="background:#ef4444"></span>
                <span class="text-gray-300">充実</span>
                <span class="text-gray-600 text-[9px] ml-auto">S</span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
                <span class="stage-dot" style="background:#f59e0b"></span>
                <span class="text-gray-300">豊か</span>
                <span class="text-gray-600 text-[9px] ml-auto">A</span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
                <span class="stage-dot" style="background:#10b981"></span>
                <span class="text-gray-300">成長中</span>
                <span class="text-gray-600 text-[9px] ml-auto">B</span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
                <span class="stage-dot" style="background:#3b82f6"></span>
                <span class="text-gray-300">芽吹き</span>
                <span class="text-gray-600 text-[9px] ml-auto">C</span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
                <span class="stage-dot" style="background:#94a3b8"></span>
                <span class="text-gray-300">発見</span>
                <span class="text-gray-600 text-[9px] ml-auto">D</span>
            </div>
        </div>

        <div class="text-[10px] text-gray-600 pt-1">記録が増えるとエリアが成長します</div>
    </div>
</div>

<!-- 右上: フィルタ -->
<div class="map-overlay" style="top: calc(var(--nav-height, 56px) + 16px); right: 16px;">
    <div class="glass rounded-2xl px-3 py-2 space-y-2" id="filters">
        <div class="flex flex-wrap gap-1">
            <button class="filter-chip active" data-stage="all">すべて</button>
            <button class="filter-chip" data-stage="S" style="border:1px solid #ef444444">充実</button>
            <button class="filter-chip" data-stage="A" style="border:1px solid #f59e0b44">豊か</button>
            <button class="filter-chip" data-stage="B" style="border:1px solid #10b98144">成長中</button>
            <button class="filter-chip" data-stage="C" style="border:1px solid #3b82f644">芽吹き</button>
            <button class="filter-chip" data-stage="D" style="border:1px solid #94a3b844">発見</button>
        </div>
        <div class="flex gap-1">
            <button class="filter-chip" id="filter-redlist">🔴 希少種あり</button>
        </div>
    </div>
</div>

<!-- 下部: CTA -->
<div class="map-overlay" style="bottom: 20px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 520px;">
    <div class="glass rounded-2xl px-6 py-4">
        <?php if ($currentUser): ?>
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-gray-400">あなたの街の生きものを記録しよう</span>
        </div>
        <div class="flex gap-3 justify-center">
            <a href="/field_research.php" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold transition text-center">🔍 フィールドへ</a>
            <a href="post.php" class="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold transition text-center">📷 記録する</a>
        </div>
        <?php else: ?>
        <div class="text-center">
            <p class="text-xs text-gray-400 mb-3">この地図はみんなの記録で成長します</p>
            <a href="login.php" class="inline-block px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold transition">参加して地図を育てる</a>
        </div>
        <?php endif; ?>
    </div>
</div>

<script nonce="<?= CspNonce::attr() ?>">
// ── 定数 ──
var STAGE_COLORS = {
    S: '#ef4444', A: '#f59e0b', B: '#10b981', C: '#3b82f6', D: '#94a3b8'
};
var STAGE_LABELS = {
    S: '充実', A: '豊か', B: '成長中', C: '芽吹き', D: '発見'
};
var GROUP_ICONS = {
    '鳥類':'🐦','植物':'🌿','昆虫':'🐛','哺乳類':'🦊',
    '爬虫類':'🦎','両生類':'🐸','魚類':'🐟','クモ類':'🕷',
    '菌類':'🍄','コケ・地衣類':'🌱','その他':'🔍'
};
var GROUP_COLORS = {
    '鳥類':'#f59e0b','植物':'#10b981','昆虫':'#f97316','哺乳類':'#8b5cf6',
    '爬虫類':'#84cc16','両生類':'#06b6d4','魚類':'#3b82f6','クモ類':'#ec4899',
    '菌類':'#a78bfa','コケ・地衣類':'#6b7280','その他':'#9ca3af'
};
var BIS_AXES = [
    { key: 'richness',     label: '種の多様性',     color: '#10b981' },
    { key: 'confidence',   label: 'データ信頼性',   color: '#3b82f6' },
    { key: 'conservation', label: '保全価値',       color: '#ef4444' },
    { key: 'coverage',     label: '分類群カバー率', color: '#f59e0b' },
    { key: 'effort',       label: '調査の継続性',   color: '#8b5cf6' }
];

var activeStageFilter = 'all';
var redlistOnly = false;
var allGeoJson = null;

// ── マップ初期化 ──
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

map.on('load', function() {

    // ── ヒートマップ（ズームアウト時） ──
    map.addSource('mesh-centroids', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'mesh-heat',
        type: 'heatmap',
        source: 'mesh-centroids',
        maxzoom: 12,
        paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'score'], 0, 0.1, 50, 0.5, 80, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 12, 2.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 8, 22, 12, 35],
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0,   'rgba(0,0,0,0)',
                0.15,'rgba(59,130,246,0.25)',
                0.35,'rgba(16,185,129,0.45)',
                0.55,'rgba(245,158,11,0.6)',
                0.75,'rgba(239,68,68,0.75)',
                1.0, 'rgba(255,255,255,0.9)'
            ],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.85, 12, 0]
        }
    });

    // ── メッシュポリゴン: BISスコアで色分け ──
    map.addSource('mesh', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({
        id: 'mesh-fill',
        type: 'fill',
        source: 'mesh',
        minzoom: 8,
        paint: {
            'fill-color': [
                'match', ['get', 'stage'],
                'S', STAGE_COLORS.S,
                'A', STAGE_COLORS.A,
                'B', STAGE_COLORS.B,
                'C', STAGE_COLORS.C,
                'D', STAGE_COLORS.D,
                '#94a3b8'
            ],
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                8, ['interpolate', ['linear'], ['get', 'score'], 0, 0.1, 40, 0.2, 80, 0.35],
                12, ['interpolate', ['linear'], ['get', 'score'], 0, 0.2, 40, 0.4, 80, 0.65]
            ],
        },
    });

    map.addLayer({
        id: 'mesh-outline',
        type: 'line',
        source: 'mesh',
        minzoom: 9,
        paint: {
            'line-color': [
                'match', ['get', 'stage'],
                'S', STAGE_COLORS.S,
                'A', STAGE_COLORS.A,
                'B', STAGE_COLORS.B,
                'C', STAGE_COLORS.C,
                'D', STAGE_COLORS.D,
                'rgba(255,255,255,0.15)'
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 1.5],
            'line-opacity': 0.7,
        },
    });

    // ラベル: 段階アイコン + 種数
    map.addLayer({
        id: 'mesh-label',
        type: 'symbol',
        source: 'mesh',
        minzoom: 11,
        layout: {
            'text-field': ['get', 'label_short'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 14, 12],
            'text-anchor': 'center',
        },
        paint: {
            'text-color': '#fff',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1.5,
        },
    });

    // ── 隣接メッシュ接続線（生態系ネットワーク） ──
    map.addSource('mesh-links', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
        id: 'mesh-links',
        type: 'line',
        source: 'mesh-links',
        minzoom: 10,
        paint: {
            'line-color': 'rgba(255,255,255,0.08)',
            'line-width': 1,
        },
    });

    // ── クリックイベント ──
    map.on('click', 'mesh-fill', function(e) {
        var f = e.features[0];
        var p = f.properties;

        var byGroup = p.by_group;
        if (typeof byGroup === 'string') try { byGroup = JSON.parse(byGroup); } catch(e) { byGroup = {}; }
        var species = p.species;
        if (typeof species === 'string') try { species = JSON.parse(species); } catch(e) { species = []; }
        if (!Array.isArray(species)) species = [];

        var stage = p.stage || 'D';
        var stageColor = STAGE_COLORS[stage] || '#94a3b8';
        var stageLabel = STAGE_LABELS[stage] || '発見';
        var score = p.score || 0;

        // BIS 5軸ミニバー
        var bisHtml = '<div style="margin-top:10px;space-y:4px">';
        BIS_AXES.forEach(function(ax) {
            var val = p[ax.key] || 0;
            bisHtml += '<div style="display:flex;align-items:center;gap:6px;margin-top:3px">' +
                '<span style="font-size:10px;color:rgba(255,255,255,0.5);min-width:80px">' + ax.label + '</span>' +
                '<div class="bis-bar" style="flex:1"><div class="bis-bar-fill" style="width:' + val + '%;background:' + ax.color + '"></div></div>' +
                '<span style="font-size:9px;color:rgba(255,255,255,0.3);min-width:20px;text-align:right">' + val + '</span></div>';
        });
        bisHtml += '</div>';

        // 種リスト
        var speciesHtml = '';
        if (species.length > 0) {
            speciesHtml += '<div style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px">' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.3);font-weight:700;margin-bottom:6px">確認されている生き物</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:4px">';
            species.forEach(function(sp) {
                var gc = GROUP_COLORS[sp.group] || '#9ca3af';
                var icon = GROUP_ICONS[sp.group] || '•';
                speciesHtml += '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,0.05);' +
                    'border:1px solid ' + gc + '33;border-radius:8px;padding:2px 8px;font-size:11px;color:rgba(255,255,255,0.85)">' +
                    '<span style="font-size:10px">' + icon + '</span>' + sp.name +
                    (sp.count > 1 ? '<span style="font-size:9px;color:rgba(255,255,255,0.3)">×' + sp.count + '</span>' : '') +
                    '</span>';
            });
            speciesHtml += '</div></div>';
        }

        // CTA
        var coords = f.geometry.coordinates[0];
        var cx = 0, cy = 0;
        coords.forEach(function(c) { cx += c[0]; cy += c[1]; });
        cx /= coords.length; cy /= coords.length;

        var ctaHtml = '<div style="margin-top:10px;text-align:center">' +
            '<a href="post.php?lat=' + cy.toFixed(5) + '&lng=' + cx.toFixed(5) + '" ' +
            'style="display:inline-block;padding:8px 20px;background:#059669;color:#fff;border-radius:12px;' +
            'font-size:12px;font-weight:700;text-decoration:none">このエリアの記録を増やす</a></div>';

        var rlBadge = (p.red_list_count > 0)
            ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;margin-left:6px">🔴 希少種 ' + p.red_list_count + '</span>'
            : '';

        new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: '360px' })
            .setLngLat([cx, cy])
            .setHTML(
                '<div style="font-size:14px;max-height:450px;overflow-y:auto">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
                    '<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:' + stageColor + '22;border:2px solid ' + stageColor + ';font-size:16px;font-weight:900;color:' + stageColor + '">' + stage + '</span>' +
                    '<div>' +
                        '<div style="font-size:16px;font-weight:900;color:' + stageColor + '">' + stageLabel + '</div>' +
                        '<div style="font-size:11px;color:rgba(255,255,255,0.4)">BIS スコア: ' + score + '/100</div>' +
                    '</div>' +
                    rlBadge +
                '</div>' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.3)">' + (p.evaluation || '') + '</div>' +
                '<div style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:4px">' + (p.species_count || 0) + '種 · ' + (p.total || 0) + '件の記録 · ' + (p.group_count || 0) + 'グループ</div>' +
                bisHtml + speciesHtml + ctaHtml +
                '<div style="font-size:9px;color:rgba(255,255,255,0.15);margin-top:8px;font-family:monospace">MESH ' + p.mesh_code + '</div>' +
                '</div>'
            )
            .addTo(map);
    });
    map.on('mouseenter', 'mesh-fill', function() { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'mesh-fill', function() { map.getCanvas().style.cursor = ''; });

    // ── データロード ──
    loadMeshImportance();
});

function loadMeshImportance() {
    fetch('/api/v2/mesh_importance.php').then(function(r) { return r.json(); }).then(function(gj) {
        if (!gj.features || gj.features.length === 0) return;
        allGeoJson = gj;

        // ラベル生成
        gj.features.forEach(function(f) {
            var p = f.properties;
            var stageIcon = {S:'🔥',A:'🌳',B:'🌱',C:'🌿',D:'📍'}[p.stage] || '📍';
            f.properties.label_short = stageIcon + ' ' + (p.species_count || 0) + '種';
        });

        applyFilter();

        // ヒートマップ用ポイント
        var centroids = gj.features.map(function(f) {
            var coords = f.geometry.coordinates[0];
            var cx = 0, cy = 0;
            coords.forEach(function(c) { cx += c[0]; cy += c[1]; });
            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [cx / coords.length, cy / coords.length] },
                properties: { score: f.properties.score || 0, total: f.properties.total || 0 }
            };
        });
        map.getSource('mesh-centroids').setData({ type: 'FeatureCollection', features: centroids });

        // 隣接リンク線生成
        buildLinks(gj.features);

        // 統計更新
        var summary = gj.summary || {};
        document.getElementById('stat-meshes').textContent = summary.total_meshes || gj.features.length;
        document.getElementById('stat-species').textContent = summary.total_species || '—';
        document.getElementById('stat-redlist').textContent = summary.red_list_total || '0';

        // fitBounds
        var bounds = new maplibregl.LngLatBounds();
        gj.features.forEach(function(f) {
            f.geometry.coordinates[0].forEach(function(c) { bounds.extend(c); });
        });
        map.fitBounds(bounds, { padding: 60, maxZoom: 13 });

    }).catch(function(e) { console.warn('Mesh importance load error:', e); });
}

// ── フィルタ適用 ──
function applyFilter() {
    if (!allGeoJson) return;
    var filtered = {
        type: 'FeatureCollection',
        features: allGeoJson.features.filter(function(f) {
            var p = f.properties;
            if (activeStageFilter !== 'all' && p.stage !== activeStageFilter) return false;
            if (redlistOnly && (p.red_list_count || 0) <= 0) return false;
            return true;
        })
    };
    map.getSource('mesh').setData(filtered);
}

// ── 隣接メッシュ間のリンク線を生成 ──
function buildLinks(features) {
    var meshSet = {};
    features.forEach(function(f) {
        var coords = f.geometry.coordinates[0];
        var cx = 0, cy = 0;
        coords.forEach(function(c) { cx += c[0]; cy += c[1]; });
        meshSet[f.properties.mesh_code] = [cx / coords.length, cy / coords.length];
    });

    var links = [];
    var seen = {};
    features.forEach(function(f) {
        var code = f.properties.mesh_code;
        var center = meshSet[code];
        if (!center) return;

        // 隣接メッシュコード（上下左右）を計算
        var p = parseInt(code.substring(0, 2));
        var u = parseInt(code.substring(2, 4));
        var q = parseInt(code.substring(4, 5));
        var v = parseInt(code.substring(5, 6));
        var r = parseInt(code.substring(6, 7));
        var w = parseInt(code.substring(7, 8));

        var neighbors = [];
        // 右
        var nr = w + 1, nq2 = q, nv2 = v, nu2 = u, np2 = p, nrr = r;
        if (nr > 9) { nr = 0; nv2 = v + 1; if (nv2 > 7) { nv2 = 0; nu2 = u + 1; } }
        neighbors.push('' + String(np2).padStart(2,'0') + String(nu2).padStart(2,'0') + nq2 + nv2 + nrr + nr);
        // 上
        var ur = r + 1, uq = q, up = p;
        if (ur > 9) { ur = 0; uq = q + 1; if (uq > 7) { uq = 0; up = p + 1; } }
        neighbors.push('' + String(up).padStart(2,'0') + String(u).padStart(2,'0') + uq + v + ur + w);

        neighbors.forEach(function(nc) {
            if (!meshSet[nc]) return;
            var key = [code, nc].sort().join('-');
            if (seen[key]) return;
            seen[key] = true;
            links.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [center, meshSet[nc]] },
                properties: {}
            });
        });
    });

    map.getSource('mesh-links').setData({ type: 'FeatureCollection', features: links });
}

// ── フィルタチップ ──
document.querySelectorAll('#filters [data-stage]').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('#filters [data-stage]').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        activeStageFilter = this.dataset.stage;
        applyFilter();
    });
});

document.getElementById('filter-redlist').addEventListener('click', function() {
    redlistOnly = !redlistOnly;
    this.classList.toggle('active', redlistOnly);
    applyFilter();
});
</script>
</body>
</html>
