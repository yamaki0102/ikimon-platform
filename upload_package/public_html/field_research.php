<?php

/**
 * Exploration Map — たんけんマップ
 * Full-screen fog-of-war map showing explored areas, trails, and observations.
 * GPS recording with real-time fog reveal.
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
$currentUser = Auth::user();

$siteMode = false;
$siteData = null;
$siteGeoJSON = null;
$requestedSiteId = $_GET['site'] ?? '';
if ($requestedSiteId) {
    require_once ROOT_DIR . '/libs/SiteManager.php';
    $siteData = SiteManager::load($requestedSiteId);
    if ($siteData) {
        $siteMode = true;
        $siteGeoJSON = SiteManager::getGeoJSON($requestedSiteId);
        if (!$currentUser) {
            Auth::initGuest();
            $currentUser = Auth::user();
        }
    }
}

if (!$currentUser) {
    header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "いきものセンサー";
    include __DIR__ . '/components/meta.php';
    ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/idb@7/build/iife/index-min.js"></script>

    <style>
        *, *::before, *::after { box-sizing: border-box; }
        body, html { height: 100%; margin: 0; overflow: hidden; font-family: 'Google Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #map { width: 100%; height: 100%; }

        /* ── M3 Expressive Glass Panel ── */
        .glass {
            background: rgba(255,255,255,0.94);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: none;
            border-radius: 28px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 6px 20px rgba(0,0,0,0.04);
        }

        /* ── M3 Expressive Top App Bar ── */
        .top-bar {
            position: absolute; top: 0; left: 0; right: 0; z-index: 20;
            background: rgba(255,255,255,0.96);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-bottom: none;
            padding: 14px 20px;
            display: flex; align-items: center; justify-content: space-between;
        }
        .top-bar a { color: #1a1a1a; text-decoration: none; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
        .top-bar a i { color: #10b981; }
        .top-bar-title { font-size: 18px; font-weight: 600; color: #1a1a1a; letter-spacing: -0.02em; }

        /* ── M3 Expressive Stats Panel ── */
        .stats-panel {
            position: absolute; top: 60px; left: 12px; z-index: 15;
            padding: 14px 18px;
            display: flex; flex-direction: column; gap: 4px;
            min-width: 130px;
        }
        .stats-panel .stat-row { display: flex; align-items: baseline; gap: 6px; }
        .stats-panel .stat-value { font-family: 'Google Sans', system-ui, monospace; font-size: 1.1rem; font-weight: 600; color: #1a1a1a; }
        .stats-panel .stat-label { font-size: 0.65rem; color: #9ca3af; font-weight: 500; letter-spacing: 0.03em; }
        .stats-panel .stat-value.highlight { color: #059669; }

        /* ── M3 Expressive Period Filter ── */
        .period-bar {
            position: absolute; top: 60px; left: 164px; z-index: 15;
            padding: 4px;
            display: flex; gap: 4px;
        }
        .period-btn {
            border: none; background: none; padding: 8px 14px; border-radius: 9999px;
            font-size: 13px; font-weight: 500; color: #5f6368; cursor: pointer;
            transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
        }
        .period-btn:hover { background: rgba(16,185,129,0.08); }
        .period-btn.active { background: #059669; color: #fff; box-shadow: 0 2px 8px rgba(5,150,105,0.25); }

        /* ── M3 Expressive Bottom Action Bar ── */
        .bottom-bar {
            position: absolute; bottom: max(24px, env(safe-area-inset-bottom, 16px)); left: 50%; transform: translateX(-50%); z-index: 20;
            display: flex; gap: 12px; align-items: center;
            padding: 8px 12px;
        }
        .action-btn {
            width: 56px; height: 56px; border-radius: 28px; border: none;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: 0.7rem; font-weight: 500; cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 6px 20px rgba(0,0,0,0.06);
            transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
            text-decoration: none;
        }
        .action-btn:active { transform: scale(0.92); }
        .action-btn i { margin-bottom: 2px; }

        .btn-observe { background: #f59e0b; color: #fff; }
        .btn-locate { background: #fff; color: #059669; width: 48px; height: 48px; border-radius: 24px; }

        /* ── GPS Status ── */
        .gps-dot {
            width: 8px; height: 8px; border-radius: 50%;
            animation: gps-pulse 2s ease-in-out infinite;
        }
        .gps-dot.good { background: #22c55e; }
        .gps-dot.fair { background: #f59e0b; }
        .gps-dot.poor { background: #ef4444; }
        .gps-dot.off  { background: #d1d5db; animation: none; }
        @keyframes gps-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── M3 Expressive Layer Toggle ── */
        .layer-btn {
            position: absolute; top: 60px; right: 12px; z-index: 15;
            width: 48px; height: 48px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
            border-radius: 24px;
        }

        .layer-sheet {
            position: absolute; top: 114px; right: 12px; z-index: 15;
            padding: 16px 20px; min-width: 220px;
        }
        .layer-sheet h4 { margin: 0 0 12px; font-size: 12px; color: #9ca3af; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
        .layer-item {
            display: flex; align-items: center; gap: 14px;
            padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.04);
            font-size: 14px; font-weight: 500; color: #1a1a1a; cursor: pointer;
        }
        .layer-item:last-child { border-bottom: none; }
        .layer-toggle {
            width: 44px; height: 24px; border-radius: 12px; border: none;
            position: relative; cursor: pointer; transition: background 250ms cubic-bezier(0.2, 0, 0, 1);
        }
        .layer-toggle.on { background: #059669; }
        .layer-toggle.off { background: #d1d5db; }
        .layer-toggle::after {
            content: ''; position: absolute; top: 2px; width: 20px; height: 20px;
            border-radius: 50%; background: #fff; transition: left 250ms cubic-bezier(0.2, 0, 0, 1);
            box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .layer-toggle.on::after { left: 22px; }
        .layer-toggle.off::after { left: 2px; }

        /* M3 Expressive Loading indicator */
        .loading-bar {
            position: absolute; top: 52px; left: 0; right: 0; height: 3px; z-index: 30;
            background: linear-gradient(90deg, transparent, #059669, transparent);
            animation: loading-slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* Mobile adjustments */
        @media (max-width: 640px) {
            .period-bar { top: auto; bottom: max(90px, calc(env(safe-area-inset-bottom, 16px) + 72px)); left: 50%; transform: translateX(-50%); }
            .stats-panel { top: 56px; left: 8px; padding: 12px 14px; }
            .stats-panel .stat-value { font-size: 0.95rem; }
        }

        /* ── Site Guide Toast ── */
        .site-guide-toast {
            position: absolute; bottom: max(100px, calc(env(safe-area-inset-bottom, 16px) + 88px));
            left: 50%; transform: translateX(-50%); z-index: 25;
            max-width: 360px; width: calc(100% - 32px);
            animation: sgt-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .sgt-inner {
            background: rgba(255,255,255,0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(16,185,129,0.2); border-radius: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(16,185,129,0.08);
            padding: 12px 14px; display: flex; align-items: center; gap: 10px; cursor: pointer;
            transition: transform 0.15s;
        }
        .sgt-inner:active { transform: scale(0.97); }
        .sgt-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sgt-title { font-size: 13px; font-weight: 700; color: #1e293b; }
        .sgt-sub { font-size: 11px; color: #64748b; margin-top: 1px; }
        .sgt-text { flex: 1; min-width: 0; }
        @keyframes sgt-slide-up { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        /* ── Site Guide Panel ── */
        .site-guide-panel {
            position: absolute; top: 0; right: 0; z-index: 30;
            width: min(400px, 100%); height: 100vh; height: 100dvh;
            background: #fff;
            box-shadow: -4px 0 24px rgba(0,0,0,0.12);
            transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            flex-direction: column;
        }
        .site-guide-panel.open { transform: translateX(0); }

        .sgp-header {
            padding: 16px 16px 12px; border-bottom: 1px solid #f1f5f9;
            display: flex; align-items: flex-start; gap: 12px; flex-shrink: 0;
            background: linear-gradient(135deg, rgba(16,185,129,0.04), rgba(59,130,246,0.04));
        }
        .sgp-close { position: absolute; top: 12px; right: 12px; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 8px; color: #94a3b8; }
        .sgp-close:hover { background: #f1f5f9; color: #475569; }
        .sgp-title { font-size: 17px; font-weight: 800; color: #1e293b; margin: 0; padding-right: 32px; }
        .sgp-subtitle { font-size: 12px; color: #64748b; margin: 4px 0 0; }

        .sgp-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
        .sgp-section { padding: 16px; border-bottom: 1px solid #f1f5f9; }
        .sgp-section-title { font-size: 13px; font-weight: 700; color: #1e293b; margin: 0 0 10px; display: flex; align-items: center; gap: 6px; }

        .sgp-welcome p { font-size: 13px; line-height: 1.7; color: #475569; margin: 0; }

        .sgp-highlights { display: flex; flex-direction: column; gap: 6px; }
        .sgp-highlight-item { font-size: 12px; color: #475569; padding: 6px 10px; background: rgba(16,185,129,0.06); border-radius: 8px; border-left: 3px solid #10b981; }

        .sgp-season { background: linear-gradient(135deg, rgba(251,191,36,0.06), rgba(245,158,11,0.06)); }
        .sgp-season-desc { font-size: 12.5px; line-height: 1.6; color: #475569; margin: 0; }

        .sgp-routes { display: flex; flex-direction: column; gap: 8px; }
        .sgp-route-card { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; }
        .sgp-route-name { font-size: 13px; font-weight: 700; color: #1e293b; }
        .sgp-route-meta { display: flex; gap: 8px; margin-top: 4px; font-size: 11px; color: #94a3b8; }
        .sgp-route-diff { background: #dcfce7; color: #16a34a; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
        .sgp-route-desc { font-size: 12px; color: #64748b; margin: 6px 0 0; line-height: 1.5; }

        /* POI Cards */
        .sgp-pois { display: flex; flex-direction: column; gap: 6px; }
        .sgp-poi-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; cursor: pointer; transition: border-color 0.15s; }
        .sgp-poi-card:hover { border-color: #10b981; }
        .sgp-poi-card.expanded { border-color: #10b981; }
        .sgp-poi-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
        .sgp-poi-emoji { font-size: 22px; flex-shrink: 0; }
        .sgp-poi-titles { flex: 1; min-width: 0; }
        .sgp-poi-name { font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; }
        .sgp-poi-badge { font-size: 10px; font-weight: 700; background: #fef3c7; color: #d97706; padding: 1px 6px; border-radius: 4px; }
        .sgp-poi-short { font-size: 11.5px; color: #64748b; margin-top: 2px; line-height: 1.4; }
        .sgp-poi-chevron { transition: transform 0.2s; }
        .sgp-poi-card.expanded .sgp-poi-chevron { transform: rotate(180deg); }

        .sgp-poi-detail { max-height: 0; overflow: hidden; transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
        .sgp-poi-card.expanded .sgp-poi-detail { max-height: 800px; }
        .sgp-poi-long { padding: 0 12px 8px; }
        .sgp-poi-long p { font-size: 12.5px; line-height: 1.7; color: #475569; margin: 0 0 8px; }
        .sgp-poi-tips { padding: 8px 12px; background: rgba(59,130,246,0.04); margin: 0 8px 8px; border-radius: 8px; }
        .sgp-poi-tips strong { font-size: 12px; color: #1e293b; }
        .sgp-tip { font-size: 11.5px; color: #64748b; margin-top: 4px; padding-left: 8px; border-left: 2px solid rgba(59,130,246,0.2); }
        .sgp-poi-season { font-size: 11.5px; color: #64748b; padding: 4px 12px 8px; }
        .sgp-poi-trivia { font-size: 11.5px; color: #7c3aed; background: rgba(124,58,237,0.04); padding: 8px 12px; margin: 0 8px 12px; border-radius: 8px; line-height: 1.5; }

        /* Read/Unread state */
        .sgp-poi-read { opacity: 0.65; }
        .sgp-poi-read:hover, .sgp-poi-read.expanded { opacity: 1; }
        .sgp-poi-new { background: #dbeafe; color: #2563eb; }
        .sgp-poi-unread { border-left: 3px solid #10b981; }

        /* Story */
        .sgp-story-body p { font-size: 12.5px; line-height: 1.7; color: #475569; margin: 0 0 10px; }
        .sgp-story { background: linear-gradient(135deg, rgba(16,185,129,0.03), rgba(34,197,94,0.03)); }

        /* Practical Info */
        .sgp-link { display: inline-block; font-size: 12px; color: #10b981; font-weight: 600; text-decoration: none; margin-bottom: 6px; }
        .sgp-link:hover { text-decoration: underline; }
        .sgp-info-row { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .sgp-notes { margin: 8px 0 0; padding-left: 18px; }
        .sgp-notes li { font-size: 11.5px; color: #64748b; margin-bottom: 3px; line-height: 1.5; }

        /* Guide button in bottom bar */
        .btn-guide { background: #10b981; color: #fff; }
        .btn-guide.inactive { background: #fff; color: #64748b; border: 1px solid rgba(0,0,0,0.08); }
    </style>
    <?php if ($siteMode && $siteGeoJSON): ?>
    <script>
        window.__siteMode = true;
        window.__siteId = <?= json_encode($requestedSiteId, JSON_HEX_TAG) ?>;
        window.__siteName = <?= json_encode($siteData['name'] ?? '', JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>;
        window.__siteGeoJSON = <?= json_encode($siteGeoJSON, JSON_HEX_TAG | JSON_UNESCAPED_UNICODE) ?>;
        window.__siteCenter = <?= json_encode($siteData['center'] ?? null, JSON_HEX_TAG) ?>;
    </script>
    <?php endif; ?>
</head>

<body x-data="explorationApp()" x-init="init()">

    <!-- Loading Bar -->
    <div class="loading-bar" x-show="loading" x-cloak></div>

    <!-- Top Bar -->
    <div class="top-bar">
        <?php if ($siteMode): ?>
        <a href="/site_dashboard.php?site=<?= htmlspecialchars($requestedSiteId, ENT_QUOTES, 'UTF-8') ?>">
            <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
            <?= htmlspecialchars(mb_strimwidth($siteData['name'] ?? '', 0, 12, '…'), ENT_QUOTES, 'UTF-8') ?>
        </a>
        <?php else: ?>
        <a href="profile.php">
            <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
            プロフィール
        </a>
        <?php endif; ?>
        <span class="top-bar-title" x-text="sessionActive ? (modeLabels[currentMovementMode] || 'センサー ON') : (window.__siteName || 'いきものセンサー')"></span>
        <div style="width:60px;display:flex;justify-content:flex-end;">
            <span x-show="sessionActive" x-cloak class="text-xs font-mono font-bold" style="color:#10b981;" x-text="formatElapsed(sessionElapsed)"></span>
        </div>
    </div>

    <!-- Map -->
    <div id="map"></div>

    <!-- Stats Panel -->
    <div class="stats-panel glass">
        <div class="stat-row">
            <span class="stat-value highlight" x-text="formatArea(stats.explored_area_m2 || 0)"></span>
        </div>
        <div class="stat-label">探索面積</div>
        <div class="stat-row" style="margin-top:4px;">
            <span class="stat-value" x-text="(stats.explored_cells || 0).toLocaleString()"></span>
            <span class="stat-label">セル</span>
        </div>
        <div class="stat-row">
            <span class="stat-value" x-text="(stats.observation_count || 0).toLocaleString()"></span>
            <span class="stat-label">観察</span>
        </div>
        <div class="stat-row">
            <span class="stat-value" x-text="formatDistance(stats.total_distance_m || 0)"></span>
            <span class="stat-label">総距離</span>
        </div>
        <div class="stat-row" style="margin-top:2px;">
            <div class="gps-dot" :class="gpsAccuracy ? (gpsAccuracy <= 10 ? 'good' : gpsAccuracy <= 30 ? 'fair' : 'poor') : 'off'" style="margin-right:4px;"></div>
            <span class="stat-value" x-text="gpsAccuracy ? gpsAccuracy + ' m' : '--'" style="font-size:0.85rem;"></span>
            <span class="stat-label">GPS</span>
        </div>
        <div class="stat-row" style="margin-top:2px;">
            <div class="gps-dot" :class="isOnline ? 'good' : 'off'" style="margin-right:4px;"></div>
            <span class="stat-value" x-text="isOnline ? 'OK' : 'OFF'" style="font-size:0.85rem;" :style="isOnline ? '' : 'color:#ef4444'"></span>
            <span class="stat-label">通信</span>
        </div>
    </div>

    <!-- Period Filter (desktop: top, mobile: bottom) -->
    <div class="period-bar glass">
        <template x-for="p in periods" :key="p.value">
            <button class="period-btn"
                :class="{ active: period === p.value }"
                @click="setPeriod(p.value)"
                x-text="p.label"></button>
        </template>
    </div>

    <!-- Layer Toggle -->
    <button class="layer-btn glass" @click="showLayers = !showLayers">
        <i data-lucide="layers" style="width:18px;height:18px;opacity:0.7;"></i>
    </button>

    <!-- Layer Sheet -->
    <div class="layer-sheet glass" x-show="showLayers" x-cloak @click.outside="showLayers = false">
        <h4>レイヤー</h4>
        <div class="layer-item" @click="toggleLayer('fog')">
            <button class="layer-toggle" :class="layerFlags.fog ? 'on' : 'off'"></button>
            <span>霧（Fog of War）</span>
        </div>
        <div class="layer-item" @click="toggleLayer('trails')">
            <button class="layer-toggle" :class="layerFlags.trails ? 'on' : 'off'"></button>
            <span>移動軌跡</span>
        </div>
        <div class="layer-item" @click="toggleLayer('observations')">
            <button class="layer-toggle" :class="layerFlags.observations ? 'on' : 'off'"></button>
            <span>観察ポイント</span>
        </div>
    </div>

    <!-- Sensor Start Panel (single button) -->
    <div x-show="!sessionActive && showModeSelect" x-cloak
         style="position:absolute;bottom:max(24px,env(safe-area-inset-bottom,16px));left:50%;transform:translateX(-50%);z-index:25;width:calc(100% - 32px);max-width:400px;">
        <div style="background:rgba(255,255,255,0.97);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:22px;border-radius:32px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.08),0 12px 40px rgba(0,0,0,0.04);">
            <!-- 移動手段セレクター -->
            <div style="margin-bottom:18px;">
                <div style="font-size:12px;color:#5f6368;margin-bottom:10px;font-weight:500;">移動手段</div>
                <div style="display:flex;gap:8px;">
                    <template x-for="tm in transportModes" :key="tm.id">
                        <button @click="manualTransportMode = tm.id; localStorage.setItem('ikimon_transport', tm.id)"
                                :style="manualTransportMode === tm.id ? 'background:rgba(5,150,105,0.12);color:#065f46;border-color:#059669;box-shadow:0 0 0 1px rgba(5,150,105,0.2);' : 'background:#f0f4f2;color:#5f6368;border-color:transparent;'"
                                style="flex:1;padding:12px 4px;border-radius:20px;border:1.5px solid;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:5px;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                            <span x-text="tm.emoji" style="font-size:24px;pointer-events:none;"></span>
                            <span x-text="tm.label" style="font-size:12px;font-weight:500;pointer-events:none;"></span>
                        </button>
                    </template>
                </div>
            </div>
            <!-- 目的地（任意） -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;color:#5f6368;margin-bottom:8px;font-weight:500;">どこへ行く？（任意）</div>
                <!-- 登録済み場所のクイック選択 -->
                <div x-show="savedPlaces.length > 0" style="display:flex;gap:6px;overflow-x:auto;margin-bottom:8px;padding-bottom:2px;" class="no-scrollbar">
                    <button @click="destination = null; destinationName = ''"
                            :style="!destination ? 'background:rgba(5,150,105,0.12);color:#065f46;border-color:#059669;' : 'background:#f0f4f2;color:#5f6368;border-color:transparent;'"
                            style="padding:8px 14px;border-radius:9999px;border:1.5px solid;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                        なし
                    </button>
                    <template x-for="sp in savedPlaces" :key="sp.id">
                        <button @click="selectSavedPlace(sp)"
                                :style="destination && destination.lat === sp.lat && destination.lng === sp.lng ? 'background:rgba(5,150,105,0.12);color:#065f46;border-color:#059669;' : 'background:#f0f4f2;color:#5f6368;border-color:transparent;'"
                                style="padding:8px 14px;border-radius:9999px;border:1.5px solid;cursor:pointer;font-size:12px;font-weight:500;white-space:nowrap;transition:all 250ms cubic-bezier(0.2,0,0,1);display:flex;align-items:center;gap:4px;">
                            <span x-text="sp.icon" style="pointer-events:none;"></span>
                            <span x-text="sp.name" style="pointer-events:none;"></span>
                        </button>
                    </template>
                </div>
                <!-- 手動入力 or 場所登録 -->
                <div style="display:flex;gap:6px;">
                    <div style="flex:1;position:relative;">
                        <input type="text" x-model="destinationName" @input.debounce.500ms="searchDestination()"
                            placeholder="場所を入力..."
                            style="width:100%;padding:10px 14px;border-radius:14px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;outline:none;transition:border-color 200ms;"
                            @focus="$el.style.borderColor='#059669'" @blur="$el.style.borderColor='#e5e7eb'">
                        <!-- 検索候補（簡易：将来 Places API 連携） -->
                        <div x-show="destSuggestions.length > 0" x-cloak @click.outside="destSuggestions = []"
                            style="position:absolute;top:100%;left:0;right:0;margin-top:4px;background:#fff;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.1);z-index:50;max-height:200px;overflow-y:auto;">
                            <template x-for="sug in destSuggestions" :key="sug.name">
                                <button @click="setDestination(sug); destSuggestions = []"
                                    style="display:block;width:100%;padding:12px 14px;text-align:left;border:none;background:none;cursor:pointer;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f3f4f6;"
                                    @mouseenter="$el.style.background='#f0fdf4'" @mouseleave="$el.style.background='none'">
                                    <span x-text="sug.icon + ' ' + sug.name"></span>
                                    <span x-show="sug.distance_km" style="font-size:11px;color:#9ca3af;margin-left:8px;" x-text="sug.distance_km.toFixed(1) + 'km'"></span>
                                </button>
                            </template>
                        </div>
                    </div>
                    <button @click="showPlaceManager = !showPlaceManager"
                        style="padding:10px;border-radius:14px;border:1px solid #e5e7eb;background:#f9fafb;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 200ms;"
                        title="場所を管理">
                        <i data-lucide="bookmark" style="width:18px;height:18px;color:#5f6368;pointer-events:none;"></i>
                    </button>
                </div>
                <!-- 選択中の目的地表示 -->
                <div x-show="destination" x-cloak style="margin-top:8px;display:flex;align-items:center;gap:6px;">
                    <span style="font-size:11px;color:#059669;font-weight:500;" x-text="'→ ' + destinationName"></span>
                    <button @click="destination = null; destinationName = ''" style="background:none;border:none;cursor:pointer;padding:2px;">
                        <i data-lucide="x" style="width:14px;height:14px;color:#9ca3af;pointer-events:none;"></i>
                    </button>
                </div>
            </div>
            <!-- 場所管理パネル -->
            <div x-show="showPlaceManager" x-cloak style="margin-bottom:14px;background:#f9fafb;border-radius:16px;padding:14px;">
                <div style="font-size:12px;font-weight:600;color:#1a1a1a;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
                    <span>よく行く場所</span>
                    <button @click="showPlaceManager = false" style="background:none;border:none;cursor:pointer;padding:2px;">
                        <i data-lucide="x" style="width:16px;height:16px;color:#9ca3af;pointer-events:none;"></i>
                    </button>
                </div>
                <!-- 登録済みリスト -->
                <div x-show="savedPlaces.length > 0" style="margin-bottom:10px;">
                    <template x-for="sp in savedPlaces" :key="sp.id">
                        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0;">
                            <span x-text="sp.icon" style="font-size:18px;"></span>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:500;color:#1a1a1a;truncate;" x-text="sp.name"></div>
                                <div style="font-size:10px;color:#9ca3af;" x-text="sp.label || ''"></div>
                            </div>
                            <button @click="deleteSavedPlace(sp.id)"
                                style="background:none;border:none;cursor:pointer;padding:4px;border-radius:8px;"
                                @mouseenter="$el.style.background='#fee2e2'" @mouseleave="$el.style.background='none'">
                                <i data-lucide="trash-2" style="width:14px;height:14px;color:#9ca3af;pointer-events:none;"></i>
                            </button>
                        </div>
                    </template>
                </div>
                <!-- 新規登録 -->
                <div style="display:flex;gap:6px;align-items:center;">
                    <select x-model="newPlaceIcon" style="padding:8px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:16px;width:50px;">
                        <option value="🏠">🏠</option>
                        <option value="🏢">🏢</option>
                        <option value="🏫">🏫</option>
                        <option value="🏥">🏥</option>
                        <option value="🛒">🛒</option>
                        <option value="⛩️">⛩️</option>
                        <option value="🌳">🌳</option>
                        <option value="🏖️">🏖️</option>
                        <option value="📍">📍</option>
                    </select>
                    <input type="text" x-model="newPlaceName" placeholder="名前（自宅、会社…）"
                        style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font-size:13px;outline:none;">
                    <button @click="addCurrentLocationAsPlace()"
                        :disabled="!newPlaceName.trim()"
                        :style="newPlaceName.trim() ? 'background:#059669;color:#fff;' : 'background:#e5e7eb;color:#9ca3af;'"
                        style="padding:8px 14px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">
                        現在地で登録
                    </button>
                </div>
                <div style="font-size:10px;color:#9ca3af;margin-top:6px;">今いる場所を登録します（最大20件）</div>
            </div>
            <!-- ドライブ設定（車モード時） -->
            <div x-show="manualTransportMode === 'car'" x-cloak style="margin-bottom:14px;">
                <div style="font-size:11px;color:#5f6368;margin-bottom:8px;font-weight:500;">ドライブ時間</div>
                <div style="display:flex;gap:6px;margin-bottom:14px;">
                    <template x-for="dt in [{min:15,label:'15分'},{min:30,label:'30分'},{min:60,label:'1時間'},{min:0,label:'指定なし'}]" :key="dt.min">
                        <button @click="driveDurationMin = dt.min; localStorage.setItem('ikimon_drive_duration', dt.min)"
                                :style="driveDurationMin === dt.min ? 'background:rgba(16,185,129,0.1);color:#065f46;border-color:#10b981;' : 'background:#f3f6f4;color:#5f6368;border-color:transparent;'"
                                style="flex:1;padding:8px 4px;border-radius:9999px;border:1.5px solid;cursor:pointer;font-size:13px;font-weight:500;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                            <span x-text="dt.label"></span>
                        </button>
                    </template>
                </div>
                <div style="font-size:11px;color:#5f6368;margin-bottom:8px;font-weight:500;">ガイドの雰囲気</div>
                <div style="display:flex;gap:6px;">
                    <template x-for="gm in [{id:'explore',label:'🌳 自然探索',desc:'生き物・植物の話中心'},{id:'culture',label:'🏯 歴史文化',desc:'地域の歴史・文化・暮らし'},{id:'relax',label:'🎧 おまかせ',desc:'自然も文化もバランスよく'}]" :key="gm.id">
                        <button @click="guideMood = gm.id; localStorage.setItem('ikimon_guide_mood', gm.id)"
                                :style="guideMood === gm.id ? 'background:rgba(16,185,129,0.1);color:#065f46;border-color:#10b981;' : 'background:#f3f6f4;color:#5f6368;border-color:transparent;'"
                                style="flex:1;padding:8px 4px;border-radius:20px;border:1.5px solid;cursor:pointer;font-size:11px;font-weight:500;text-align:center;transition:all 150ms ease;">
                            <span x-text="gm.label" style="display:block;"></span>
                        </button>
                    </template>
                </div>
            </div>
            <!-- 徒歩/自転車用ガイド雰囲気 -->
            <div x-show="manualTransportMode !== 'car'" x-cloak style="margin-bottom:14px;">
                <div style="font-size:11px;color:#5f6368;margin-bottom:8px;font-weight:500;">ガイドの雰囲気</div>
                <div style="display:flex;gap:6px;">
                    <template x-for="gm in [{id:'explore',label:'🌳 自然探索'},{id:'culture',label:'🏯 歴史文化'},{id:'relax',label:'🎧 おまかせ'}]" :key="gm.id">
                        <button @click="guideMood = gm.id; localStorage.setItem('ikimon_guide_mood', gm.id)"
                                :style="guideMood === gm.id ? 'background:rgba(16,185,129,0.1);color:#065f46;border-color:#10b981;' : 'background:#f3f6f4;color:#5f6368;border-color:transparent;'"
                                style="flex:1;padding:8px 4px;border-radius:9999px;border:1.5px solid;cursor:pointer;font-size:12px;font-weight:500;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                            <span x-text="gm.label"></span>
                        </button>
                    </template>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px;">
                <button @click="startSensor()" style="flex:1;padding:18px;border-radius:9999px;border:none;background:#059669;color:#fff;font-size:16px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 2px 8px rgba(5,150,105,0.3),0 6px 20px rgba(5,150,105,0.15);transition:all 250ms cubic-bezier(0.2,0,0,1);letter-spacing:-0.01em;">
                    <span style="font-size:18px;">📡</span> センサーを開始
                </button>
                <button @click="showSpeakerSelect = !showSpeakerSelect"
                        style="padding:12px 16px;border-radius:24px;border:1px solid #e5e7eb;background:#f0f4f2;color:#5f6368;font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;white-space:nowrap;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                    <span style="font-size:18px;" x-text="speakerEmoji"></span>
                    <span x-text="selectedSpeaker.startsWith('duo-') ? '掛け合い' : '解説'" style="font-size:9px;font-weight:600;color:#059669;"></span>
                    <span x-text="speakers.find(s => s.id === selectedSpeaker)?.label || 'Auto'" style="font-size:9px;font-weight:500;"></span>
                </button>
            </div>
            <div x-show="showSpeakerSelect" x-cloak style="margin-bottom:12px;">
                <!-- 一人で解説 -->
                <div style="font-size:12px;color:#1a1a1a;margin-bottom:8px;font-weight:600;display:flex;align-items:center;gap:6px;">
                    <span style="font-size:14px;">🎧</span> 一人で解説
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
                    <template x-for="sp in speakers.filter(s => !s.id.startsWith('duo-'))" :key="sp.id">
                        <button @click="selectedSpeaker = sp.id; showSpeakerSelect = false; localStorage.setItem('ikimon_speaker', sp.id); localStorage.setItem('ikimon_voice_speaker', sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                :style="selectedSpeaker === sp.id ? 'background:rgba(5,150,105,0.12);color:#065f46;border-color:#059669;' : 'background:#f0f4f2;color:#5f6368;border-color:transparent;'"
                                style="padding:14px 8px;border-radius:20px;border:1.5px solid;font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                            <span x-text="sp.emoji" style="font-size:20px;"></span>
                            <span x-text="sp.label" style="font-weight:500;font-size:11px;"></span>
                        </button>
                    </template>
                </div>
                <!-- 二人で掛け合い -->
                <div style="font-size:12px;color:#1a1a1a;margin-bottom:8px;font-weight:600;display:flex;align-items:center;gap:6px;">
                    <span style="font-size:14px;">🎙️</span> 二人で掛け合い
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <template x-for="sp in speakers.filter(s => s.id.startsWith('duo-'))" :key="sp.id">
                        <button @click="selectedSpeaker = sp.id; showSpeakerSelect = false; localStorage.setItem('ikimon_speaker', sp.id); localStorage.setItem('ikimon_voice_speaker', sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                :style="selectedSpeaker === sp.id ? 'background:rgba(5,150,105,0.12);color:#065f46;border-color:#059669;' : 'background:#f0f4f2;color:#5f6368;border-color:transparent;'"
                                style="padding:14px 8px;border-radius:20px;border:1.5px solid;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 250ms cubic-bezier(0.2,0,0,1);">
                            <span x-text="sp.emoji" style="font-size:18px;"></span>
                            <span x-text="sp.label" style="font-weight:500;"></span>
                        </button>
                    </template>
                </div>
            </div>
            <div style="font-size:11px;color:#9ca3af;font-weight:400;">移動手段に合わせたガイドをお届け</div>
            <div style="font-size:10px;color:#bdc1c6;text-align:center;padding:4px 0 0;line-height:1.5;">
                BirdNET (CC BY-SA 4.0) · Perch v2 (Apache 2.0)
            </div>
        </div>
    </div>

    <!-- Drive Mode HUD (full screen overlay) -->
    <div x-show="sessionActive && (currentMovementMode === 'drive' || manualTransportMode === 'car')" x-cloak
         style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-size:48px;margin-bottom:8px;">📡</div>
        <div style="color:#10b981;font-size:13px;font-weight:600;margin-bottom:20px;">🚗 ドライブ記録中</div>
        <div style="color:#e2e8f0;font-size:32px;font-weight:900;" x-text="sessionSpeciesCount + '種'"></div>
        <div style="color:#94a3b8;font-size:14px;margin-top:8px;" x-text="(sessionDistance / 1000).toFixed(1) + 'km · ' + formatElapsed(sessionElapsed)"></div>
        <!-- 声変更（ドライブ中） -->
        <div style="position:relative;margin-top:16px;">
            <button @click="showDriveVoiceSwitch = !showDriveVoiceSwitch"
                    style="padding:8px 16px;border-radius:10px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.15);color:#c4b5fd;font-size:13px;cursor:pointer;">
                🔊 <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.label || '音声'"></span>
            </button>
            <div x-show="showDriveVoiceSwitch" x-cloak @click.outside="showDriveVoiceSwitch=false"
                 style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:8px;background:rgba(30,41,59,0.95);backdrop-filter:blur(12px);border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,0.1);min-width:160px;z-index:50;">
                <template x-for="sp in speakers" :key="sp.id">
                    <button @click="selectedSpeaker=sp.id; showDriveVoiceSwitch=false; localStorage.setItem('ikimon_voice_speaker',sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                            :style="selectedSpeaker===sp.id ? 'background:rgba(139,92,246,0.3);color:#c4b5fd;' : 'background:rgba(255,255,255,0.05);color:#94a3b8;'"
                            style="display:block;width:100%;padding:10px 14px;border-radius:8px;border:none;font-size:13px;font-weight:bold;text-align:left;cursor:pointer;margin-bottom:4px;">
                        <span x-text="sp.emoji + ' ' + sp.label"></span>
                    </button>
                </template>
            </div>
        </div>
        <!-- 移動手段切り替え（走行中でも変更可） -->
        <div style="display:flex;gap:8px;margin-top:16px;">
            <template x-for="tm in transportModes" :key="tm.id">
                <button @click="setTransportMode(tm.id)"
                        :style="manualTransportMode === tm.id ? 'background:rgba(16,185,129,0.3);border-color:#10b981;color:#10b981;' : 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.15);color:#94a3b8;'"
                        style="padding:8px 14px;border-radius:10px;border:1.5px solid;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;">
                    <span x-text="tm.emoji" style="pointer-events:none;"></span>
                    <span x-text="tm.label" style="pointer-events:none;"></span>
                </button>
            </template>
        </div>
        <button @click="stopSensor()"
                style="margin-top:32px;width:64px;height:64px;border-radius:50%;background:#ef4444;border:none;color:#fff;font-size:24px;cursor:pointer;">
            ■
        </button>
    </div>

    <!-- Session Active HUD (bottom, hidden in drive/car mode) -->
    <div x-show="sessionActive && currentMovementMode !== 'drive' && manualTransportMode !== 'car'" x-cloak
         style="position:absolute;bottom:max(24px,env(safe-area-inset-bottom,16px));left:50%;transform:translateX(-50%);z-index:25;width:calc(100% - 32px);max-width:400px;">
        <div class="glass" style="padding:10px 16px;border-radius:16px;">
            <!-- Movement mode + transport switcher -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:10px;font-weight:700;padding:2px 10px;border-radius:6px;background:rgba(16,185,129,0.12);color:#10b981;"
                      x-text="modeLabels[currentMovementMode] || 'サーチ中'"></span>
                <div style="display:flex;gap:4px;">
                    <template x-for="tm in transportModes" :key="tm.id">
                        <button @click="setTransportMode(tm.id)"
                                :style="manualTransportMode === tm.id ? 'background:rgba(16,185,129,0.2);color:#10b981;border-color:#10b981;' : 'background:rgba(255,255,255,0.04);color:#64748b;border-color:rgba(255,255,255,0.08);'"
                                style="padding:3px 7px;border-radius:6px;border:1px solid;cursor:pointer;font-size:12px;"
                                :title="tm.label">
                            <span x-text="tm.emoji" style="pointer-events:none;"></span>
                        </button>
                    </template>
                </div>
            </div>
            <!-- Detection notification card -->
            <div x-show="latestDetection" x-cloak x-transition
                 style="margin-bottom:8px;padding:8px 12px;border-radius:10px;display:flex;align-items:center;gap:10px;"
                 :style="'background:' + (latestDetection?.source === 'audio' ? 'rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2)' : 'rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2)')">
                <span style="font-size:20px;" x-text="latestDetection?.emoji || '🐦'"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:700;color:#1e293b;" x-text="latestDetection?.label || ''"></div>
                    <div style="font-size:10px;color:#94a3b8;" x-text="latestDetection?.reason || ''"></div>
                </div>
                <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;"
                    :style="'background:' + (latestDetection?.confidence === 'high' ? '#dcfce7;color:#16a34a' : latestDetection?.confidence === 'medium' ? '#fef9c3;color:#ca8a04' : '#f1f5f9;color:#64748b')"
                    x-text="latestDetection?.confidence === 'high' ? '高' : latestDetection?.confidence === 'medium' ? '中' : '低'"></span>
            </div>
            <!-- Environment label -->
            <div x-show="envLabel" x-cloak style="font-size:10px;color:#64748b;margin-bottom:6px;text-align:center;" x-text="'🌿 ' + envLabel"></div>
            <!-- Stats row -->
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="text-align:center;">
                        <div style="font-size:18px;font-weight:900;color:#1e293b;" x-text="sessionSpeciesCount">0</div>
                        <div style="font-size:9px;color:#94a3b8;">種</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:13px;font-weight:700;color:#1e293b;" x-text="formatDistance(sessionDistance)">0 m</div>
                        <div style="font-size:9px;color:#94a3b8;">距離</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:13px;font-weight:700;color:#1e293b;" x-text="formatElapsed(sessionElapsed)">00:00</div>
                        <div style="font-size:9px;color:#94a3b8;">時間</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <div style="position:relative;">
                        <button @click="showVoiceSwitch = !showVoiceSwitch"
                                style="padding:8px 10px;border-radius:10px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.15);color:#c4b5fd;font-size:11px;cursor:pointer;white-space:nowrap;">
                            🔊 <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.label || '音声'"></span>
                        </button>
                        <div x-show="showVoiceSwitch" x-cloak @click.outside="showVoiceSwitch=false"
                             style="position:absolute;bottom:100%;right:0;margin-bottom:8px;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,0.1);min-width:140px;z-index:50;">
                            <template x-for="sp in speakers" :key="sp.id">
                                <button @click="selectedSpeaker=sp.id; showVoiceSwitch=false; localStorage.setItem('ikimon_voice_speaker',sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                        :style="selectedSpeaker===sp.id ? 'background:rgba(139,92,246,0.3);color:#c4b5fd;' : 'background:rgba(255,255,255,0.05);color:#94a3b8;'"
                                        style="display:block;width:100%;padding:8px 12px;border-radius:8px;border:none;font-size:12px;font-weight:bold;text-align:left;cursor:pointer;margin-bottom:4px;">
                                    <span x-text="sp.emoji + ' ' + sp.label"></span>
                                </button>
                            </template>
                        </div>
                    </div>
                    <button @click="stopSensor()" style="padding:8px 16px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">
                        終了
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Bottom Action Bar (when no session and sensor panel hidden) -->
    <div class="bottom-bar glass" x-show="!sessionActive && !showModeSelect" x-cloak>
        <!-- Locate -->
        <button class="action-btn btn-locate" @click="flyToCurrentLocation()">
            <i data-lucide="locate" style="width:20px;height:20px;"></i>
        </button>

        <!-- Start Sensor -->
        <button class="action-btn" style="background:#10b981;color:#fff;width:auto;border-radius:28px;padding:0 20px;height:56px;" @click="showModeSelect = true">
            <i data-lucide="radio" style="width:20px;height:20px;"></i>
            <span>センサー</span>
        </button>

        <!-- Observe -->
        <a :href="'post.php?return=field_research.php&field_session=' + encodeURIComponent(recorder?.sessionId || '')"
           class="action-btn btn-observe">
            <i data-lucide="camera" style="width:20px;height:20px;"></i>
            <span>投稿</span>
        </a>

        <!-- Guide -->
        <button class="action-btn btn-guide" :class="{ inactive: !hasGuide }" @click="toggleGuide()" x-show="hasGuide" x-cloak>
            <i data-lucide="book-open" style="width:20px;height:20px;"></i>
            <span>ガイド</span>
        </button>
    </div>

    <!-- ===== 散歩レポート (Session Result Overlay) ===== -->
    <div x-show="showReport" x-cloak
         style="position:fixed;inset:0;z-index:50;background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#fff;overflow-y:auto;-webkit-overflow-scrolling:touch;">
        <div style="max-width:440px;margin:0 auto;padding:24px 16px 100px;">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:8px;">🌿</div>
                <h2 style="font-size:22px;font-weight:900;margin:0;">今日のいきものサーチ</h2>
                <p style="font-size:13px;color:#94a3b8;margin:4px 0 0;" x-text="reportData?.locationName || ''"></p>
            </div>

            <!-- Main Stats Card -->
            <div style="background:rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-around;text-align:center;">
                    <div>
                        <div style="font-size:11px;color:#94a3b8;">🚶 時間</div>
                        <div style="font-size:20px;font-weight:900;" x-text="formatElapsed(reportData?.duration || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#94a3b8;">📍 距離</div>
                        <div style="font-size:20px;font-weight:900;" x-text="formatDistance(reportData?.distance || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#94a3b8;">🐦 種数</div>
                        <div style="font-size:20px;font-weight:900;" x-text="reportData?.speciesCount || 0"></div>
                    </div>
                </div>
            </div>

            <!-- Nature Score -->
            <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(34,197,94,0.08));border:1px solid rgba(16,185,129,0.2);border-radius:16px;padding:16px;margin-bottom:16px;"
                 x-show="reportData?.natureScore">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:700;color:#6ee7b7;">🌿 自然浴スコア</span>
                    <span style="font-size:24px;font-weight:900;color:#4ade80;" x-text="reportData?.natureScore?.score || '-'"></span>
                    <span style="font-size:11px;color:#6ee7b7;">/10</span>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <div style="font-size:9px;color:#94a3b8;">多様性</div>
                        <div style="font-size:14px;font-weight:700;" x-text="reportData?.natureScore?.breakdown?.diversity || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <div style="font-size:9px;color:#94a3b8;">音風景</div>
                        <div style="font-size:14px;font-weight:700;" x-text="reportData?.natureScore?.breakdown?.soundscape || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:8px;">
                        <div style="font-size:9px;color:#94a3b8;">環境</div>
                        <div style="font-size:14px;font-weight:700;" x-text="reportData?.natureScore?.breakdown?.environment || '-'"></div>
                    </div>
                </div>
                <div style="font-size:12px;color:#a7f3d0;text-align:center;" x-text="reportData?.natureScore?.message || ''"></div>
            </div>

            <!-- No species message -->
            <div x-show="!reportData?.species?.length" style="background:rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">🌱</div>
                <div style="font-size:13px;color:#cbd5e1;font-weight:700;">今回は検出なし</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">でも、歩いた記録はたんけんマップに残っています。<br>GPS軌跡と環境データは100年アーカイブに保存されました。</div>
            </div>

            <!-- Species Gallery (horizontal scroll) -->
            <div style="margin-bottom:16px;" x-show="reportData?.species?.length > 0">
                <h3 style="font-size:13px;font-weight:700;color:#cbd5e1;margin:0 0 8px;">出会った生きもの</h3>
                <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;">
                    <template x-for="sp in (reportData?.species || [])" :key="sp.name">
                        <div style="min-width:140px;max-width:160px;background:rgba(255,255,255,0.06);border-radius:12px;padding:10px;flex-shrink:0;">
                            <div style="font-size:13px;font-weight:800;" :style="'color:' + (sp.confidence >= 0.7 ? '#4ade80' : sp.confidence >= 0.4 ? '#fbbf24' : '#9ca3af')" x-text="sp.name"></div>
                            <div style="font-size:10px;color:#64748b;margin-top:2px;" x-text="sp.source === 'audio' ? '🎤 音声' : '📷 カメラ'"></div>
                            <div style="font-size:10px;color:#94a3b8;margin-top:2px;" x-text="sp.note || sp.category || ''"></div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- AI Narrative -->
            <div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:16px;"
                 x-show="reportData?.recap?.narrative">
                <div style="font-size:12px;line-height:1.7;color:#d1d5db;" x-text="reportData?.recap?.narrative || ''"></div>
                <div style="font-size:9px;color:#4b5563;margin-top:6px;">🤖 AI要約</div>
            </div>

            <!-- Contribution -->
            <div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:16px;"
                 x-show="reportData?.recap?.contribution?.length > 0">
                <h3 style="font-size:13px;font-weight:700;color:#cbd5e1;margin:0 0 8px;">あなたの貢献</h3>
                <template x-for="c in (reportData?.recap?.contribution || [])" :key="c.text">
                    <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;font-size:12px;">
                        <span x-text="c.icon"></span>
                        <span style="color:#93c5fd;" x-text="c.text"></span>
                    </div>
                </template>
            </div>

            <!-- Weekly Summary -->
            <div style="background:rgba(255,255,255,0.06);border-radius:12px;padding:14px;margin-bottom:16px;"
                 x-show="weeklyStats.sessions > 0">
                <h3 style="font-size:13px;font-weight:700;color:#cbd5e1;margin:0 0 8px;">📊 今週の記録</h3>
                <div style="display:flex;gap:16px;font-size:13px;color:#e2e8f0;">
                    <span x-text="weeklyStats.sessions + '回'"></span>
                    <span x-text="weeklyStats.species + '種'"></span>
                    <span x-text="formatDistance(weeklyStats.distance)"></span>
                </div>
                <div style="font-size:11px;color:#f59e0b;margin-top:4px;" x-show="weeklyStats.streak > 1"
                     x-text="'🔥 ' + weeklyStats.streak + '日連続サーチ中!'"></div>
            </div>

            <!-- Badges -->
            <div style="margin-bottom:16px;" x-show="reportData?.recap?.rank_progress?.badges_earned?.length > 0">
                <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
                    <template x-for="b in (reportData?.recap?.rank_progress?.badges_earned || [])" :key="b.name || b">
                        <span style="font-size:11px;padding:4px 10px;background:rgba(251,191,36,0.15);color:#fbbf24;border-radius:8px;font-weight:700;" x-text="b.name || b"></span>
                    </template>
                </div>
            </div>

            <!-- Data note -->
            <div style="display:flex;align-items:start;gap:6px;background:rgba(59,130,246,0.08);border-radius:10px;padding:10px 12px;margin-bottom:24px;">
                <span style="font-size:12px;">💾</span>
                <span style="font-size:11px;color:#93c5fd;">データは100年アーカイブに保存され、生物多様性レポートに活用されます</span>
            </div>

            <!-- Actions -->
            <div style="display:flex;flex-direction:column;gap:8px;">
                <a :href="'post.php?return=field_research.php&from=walk_report'"
                   style="display:block;text-align:center;padding:14px;border-radius:12px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.1);color:#fbbf24;font-size:14px;font-weight:700;text-decoration:none;">
                    📸 ベスト写真を投稿する
                </a>
                <div style="display:flex;gap:8px;">
                    <button @click="showReport=false" style="flex:1;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">
                        🗺️ マップに戻る
                    </button>
                    <button @click="showReport=false;startSensor()" style="flex:1;padding:14px;border-radius:12px;border:none;background:#10b981;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">
                        🔄 もう一回
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Camera video (hidden, used by LiveScanner for frame capture) -->
    <video id="scan-cam" playsinline muted autoplay style="display:none;"></video>
    <canvas id="scan-canvas" style="display:none;"></canvas>

    <!-- Camera preview overlay (stationary mode with camera active) -->
    <div x-show="sessionActive && currentMovementMode === 'stationary'" x-cloak
         style="position:absolute;top:46px;left:0;right:0;bottom:160px;z-index:10;background:#000;">
        <video id="scan-preview" playsinline muted autoplay
               style="width:100%;height:100%;object-fit:cover;"></video>
    </div>

    <!-- Scripts -->
    <script src="js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/OfflineMapManager.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/FieldRecorder.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/ExplorationMap.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/SiteGuide.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/LiveScanner.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="assets/js/VoiceGuide.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        function explorationApp() {
            return {
                // State
                period: 'all',
                periods: [
                    { value: 'today', label: '今日' },
                    { value: 'week',  label: '今週' },
                    { value: 'month', label: '今月' },
                    { value: 'year',  label: '今年' },
                    { value: 'all',   label: 'すべて' },
                ],
                stats: {},
                showLayers: false,
                loading: false,
                layerFlags: { fog: true, trails: true, observations: true },
                gpsAccuracy: null,
                hasGuide: false,
                isOnline: navigator.onLine,

                // Report state
                showReport: false,
                reportData: null,
                weeklyStats: { sessions: 0, species: 0, distance: 0, streak: 0 },

                // Session state
                sessionActive: false,
                showModeSelect: true,
                currentMovementMode: 'walk',
                sessionStartTime: null,
                sessionElapsed: 0,
                sessionDistance: 0,
                sessionSpeciesCount: 0,
                sessionDetections: [],
                latestDetection: null,
                _sessionTimer: null,
                _detectionFadeTimer: null,
                envLabel: '',

                // Destination
                destination: null,
                destinationName: '',
                savedPlaces: [],
                destSuggestions: [],
                showPlaceManager: false,
                newPlaceName: '',
                newPlaceIcon: '📍',
                _currentLat: null,
                _currentLng: null,

                // Speaker selection
                showSpeakerSelect: true,
                showVoiceSwitch: false,
                showDriveVoiceSwitch: false,
                driveDurationMin: parseInt(localStorage.getItem('ikimon_drive_duration') || '0'),
                guideMood: localStorage.getItem('ikimon_guide_mood') || 'relax',
                selectedSpeaker: localStorage.getItem('ikimon_voice_speaker') || localStorage.getItem('ikimon_speaker') || 'gemini-bright',
                speakers: [
                    { id: 'gemini-random', label: 'おまかせ', emoji: '🎲' },
                    { id: 'zundamon', label: 'ずんだもん', emoji: '🟢' },
                    { id: 'duo-gemini', label: '男性×女性', emoji: '👫' },
                    { id: 'duo-zundamon-mochiko', label: 'ずんだ×もち子', emoji: '💚' },
                    { id: 'duo-zundamon-ryusei', label: 'ずんだ×龍星', emoji: '💙' },
                ],
                modeLabels: { stationary: '静止中', walk: 'サーチ中', bike: 'サーチ中（自転車）', drive: 'サーチ中（車）', car: 'サーチ中（車）' },

                // 移動手段: ユーザーが手動選択した場合はそちらを優先
                manualTransportMode: localStorage.getItem('ikimon_transport') || 'walk',
                transportModes: [
                    { id: 'walk',  label: '徒歩', emoji: '🚶' },
                    { id: 'bike',  label: '自転車', emoji: '🚲' },
                    { id: 'car',   label: '車', emoji: '🚗' },
                ],

                get speakerEmoji() {
                    const sp = this.speakers.find(s => s.id === this.selectedSpeaker);
                    return sp ? sp.emoji : '🤖';
                },

                // Refs
                map: null,
                explorationMap: null,
                recorder: null,
                siteGuide: null,
                liveScanner: null,
                wakeLock: null,
                _prevPosition: null,

                init() {
                    lucide.createIcons();
                    this.loadSavedPlaces();

                    // Connectivity monitoring
                    window.addEventListener('online', () => { this.isOnline = true; });
                    window.addEventListener('offline', () => { this.isOnline = false; });

                    // Init map
                    this.map = new maplibregl.Map({
                        container: 'map',
                        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                        center: [137.73, 34.71],
                        zoom: 14
                    });

                    // Site-limited mode: fit to site boundary
                    if (window.__siteMode && window.__siteGeoJSON) {
                        this.map.on('load', () => {
                            try {
                                this.map.addSource('site-boundary', {
                                    type: 'geojson',
                                    data: window.__siteGeoJSON
                                });
                                this.map.addLayer({
                                    id: 'site-boundary-fill',
                                    type: 'fill',
                                    source: 'site-boundary',
                                    paint: { 'fill-color': '#10b981', 'fill-opacity': 0.06 }
                                });
                                this.map.addLayer({
                                    id: 'site-boundary-line',
                                    type: 'line',
                                    source: 'site-boundary',
                                    paint: { 'line-color': '#10b981', 'line-width': 2, 'line-dasharray': [3, 2] }
                                });
                                const bounds = new maplibregl.LngLatBounds();
                                const addCoords = (coords) => {
                                    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                                        coords.forEach(c => addCoords(c));
                                    } else if (Array.isArray(coords[0])) {
                                        coords.forEach(c => bounds.extend(c));
                                    } else {
                                        bounds.extend(coords);
                                    }
                                };
                                const geom = window.__siteGeoJSON.geometry || window.__siteGeoJSON.features?.[0]?.geometry;
                                if (geom) addCoords(geom.coordinates);
                                this.map.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 1000 });
                            } catch(e) { console.warn('Site boundary error:', e); }
                        });
                    } else if (navigator.geolocation) {
                        // Fly to current location (default behavior)
                        navigator.geolocation.getCurrentPosition(pos => {
                            this._currentLat = pos.coords.latitude;
                            this._currentLng = pos.coords.longitude;
                            this.map.flyTo({
                                center: [pos.coords.longitude, pos.coords.latitude],
                                zoom: 15, duration: 1500
                            });
                        }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                    }

                    // Init ExplorationMap (fog overlay)
                    this.explorationMap = new ExplorationMap(this.map, {
                        gridM: 100,
                        period: this.period,
                        onStatsUpdate: (s) => { this.stats = s; },
                        onLoadStart: () => { this.loading = true; },
                        onLoadEnd: () => { this.loading = false; },
                    });

                    // Init FieldRecorder (GPS tracking)
                    this.recorder = new FieldRecorder(this.map, null);

                    // Step Counter
                    if (typeof StepCounter !== 'undefined' && StepCounter.isSupported()) {
                        window._stepCounter = new StepCounter();
                    }

                    // Init SiteGuide
                    this.siteGuide = new SiteGuide(this.map, {
                        onEnterSite: (siteId, guide) => { this.hasGuide = true; },
                        onLeaveSite: () => { this.hasGuide = false; },
                    });
                    window._siteGuide = this.siteGuide;

                    // Auto-start passive GPS tracking
                    this._startPassiveTracking();

                    // Wake Lock
                    document.addEventListener('click', () => this._requestWakeLock(), { once: true });
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible' && !this.wakeLock) {
                            this._requestWakeLock();
                        }
                    });

                    // Stop recording on page unload
                    window.addEventListener('beforeunload', () => {
                        if (this.recorder?.isRecording) {
                            this.recorder.stopRecording();
                        }
                    });
                },

                // ── Passive Tracking ──

                _startPassiveTracking() {
                    // Request motion permission for step counter
                    if (window._stepCounter) {
                        window._stepCounter.requestPermission().catch(() => {});
                    }

                    // Start recording if not already restored from previous session
                    if (!this.recorder.isRecording) {
                        this.recorder.startRecording();
                    }

                    // Hook into recorder for real-time fog updates with speed
                    const origProcess = this.recorder.processPosition.bind(this.recorder);
                    this.recorder.processPosition = (pos) => {
                        origProcess(pos);

                        // Update GPS accuracy display
                        this.gpsAccuracy = Math.round(pos.coords.accuracy);

                        if (pos.coords.accuracy > 50) return;

                        // Calculate speed (km/h)
                        let speedKmh = null;
                        if (pos.coords.speed != null && pos.coords.speed >= 0) {
                            speedKmh = pos.coords.speed * 3.6;
                        } else if (this._prevPosition) {
                            const d = this.recorder.calcDistance(
                                this._prevPosition.lat, this._prevPosition.lng,
                                pos.coords.latitude, pos.coords.longitude
                            );
                            const dt = (pos.timestamp - this._prevPosition.timestamp) / 1000;
                            if (dt > 0) speedKmh = (d / dt) * 3.6;
                        }

                        // Update fog with speed tier
                        if (this.explorationMap) {
                            this.explorationMap.addExploredPoint(
                                pos.coords.latitude, pos.coords.longitude, speedKmh
                            );
                        }

                        this._prevPosition = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            timestamp: pos.timestamp
                        };

                        // Check for site guide
                        if (this.siteGuide) {
                            this.siteGuide.checkPosition(pos.coords.latitude, pos.coords.longitude);
                        }
                    };
                },

                // ── Session Management ──

                setTransportMode(mode) {
                    this.manualTransportMode = mode;
                    localStorage.setItem('ikimon_transport', mode);
                    // 車モード切り替え時はLiveScannerにも伝達
                    if (this.liveScanner) {
                        this.currentMovementMode = mode === 'car' ? 'drive' : mode;
                    }
                },

                startSensor() {
                    this.sessionActive = true;
                    this.showModeSelect = false;
                    this.sessionStartTime = Date.now();
                    this.sessionElapsed = 0;
                    this.sessionDistance = 0;
                    this.sessionSpeciesCount = 0;
                    this.sessionDetections = [];
                    this.latestDetection = null;
                    this._quickStartDone = false;
                    // 手動選択した移動手段を初期モードとして設定
                    this.currentMovementMode = this.manualTransportMode === 'car' ? 'drive' : (this.manualTransportMode || 'walk');

                    // 目的地をセッションストレージに保存（voice_guide が参照）
                    if (this.destination) {
                        sessionStorage.setItem('ikimon_destination', JSON.stringify(this.destination));
                        sessionStorage.setItem('ikimon_destination_name', this.destinationName);
                        // 使用回数カウント
                        if (this.destination.id) {
                            fetch('api/v2/saved_places.php', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({action:'use', place_id: this.destination.id})
                            }).catch(() => {});
                        }
                    } else {
                        sessionStorage.removeItem('ikimon_destination');
                        sessionStorage.removeItem('ikimon_destination_name');
                    }

                    // Timer
                    this._sessionTimer = setInterval(() => {
                        if (!this.liveScanner) return;
                        this.sessionElapsed = this.liveScanner.getElapsed();
                        this.sessionDistance = this.liveScanner.getDistance();
                        this.sessionSpeciesCount = this.liveScanner.getSpeciesCount();
                    }, 1000);

                    // Ambient voice guide — periodic nature commentary
                    // ドライブ時間指定あり: 時間配分型ペーシング / なし: 45秒固定間隔
                    this._ambientGuideCount = 0;
                    this._driveTotalMin = this.driveDurationMin || 0;
                    const ambientIntervalMs = this._driveTotalMin > 0
                        ? Math.max(30000, Math.min(120000, (this._driveTotalMin * 60000) / Math.max(6, Math.ceil(this._driveTotalMin / 5))))
                        : 45000;
                    console.log(`[Ambient] interval: ${Math.round(ambientIntervalMs/1000)}s, driveDuration: ${this._driveTotalMin}min`);
                    this._ambientTimer = setInterval(async () => {
                        if (!window.VoiceGuide || !VoiceGuide.isEnabled()) return;
                        if (VoiceGuide.isSpeaking()) return;

                        // ドライブ時間超過 → 自動クロージング
                        if (this._driveTotalMin > 0) {
                            const elapsedMin = (this.sessionElapsed || 0) / 60;
                            if (elapsedMin >= this._driveTotalMin - 2 && !this._closingTriggered) {
                                this._closingTriggered = true;
                                console.log('[Ambient] Auto-closing triggered');
                                this.stopSensor();
                                return;
                            }
                        }

                        // First drain any queued landscape history
                        if (VoiceGuide.drainAmbientQueue) {
                            VoiceGuide.drainAmbientQueue();
                            if (VoiceGuide.isSpeaking()) return;
                        }

                        // Then fetch fresh ambient content
                        const gpsPos = this.liveScanner?.lastGpsPos;
                        if (!gpsPos) return;

                        const detected = this.sessionDetections.map(d => d.japanese_name || d.label).filter(Boolean);
                        const uniqueDetected = [...new Set(detected)].slice(0, 10).join(',');

                        // 移動手段: 手動設定 > GPS自動検出
                        const transportMode = this.manualTransportMode || (this.currentMovementMode === 'drive' ? 'car' : this.currentMovementMode) || 'walk';

                        try {
                            const params = new URLSearchParams({
                                mode: 'ambient',
                                lat: gpsPos.lat,
                                lng: gpsPos.lng,
                                detected_species: uniqueDetected,
                                voice_mode: VoiceGuide.getVoiceMode(),
                                transport_mode: transportMode,
                                elapsed_min: Math.round((this.sessionElapsed || 0) / 60),
                                session_count: this._ambientGuideCount,
                                drive_total_min: this._driveTotalMin || 0,
                                guide_mood: this.guideMood || 'relax',
                            });
                            this._appendDestParams(params);
                            const resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
                            if (!resp.ok) return;
                            const json = await resp.json();
                            if (json.success && json.data) {
                                // フェッチ後に再チェック（フェッチ中に他の音声が開始していれば追加しない）
                                if (VoiceGuide.isSpeaking()) return;
                                this._ambientGuideCount++;
                                if (json.data.audio_url) {
                                    VoiceGuide.announceAudio(json.data.audio_url);
                                } else if (json.data.guide_text) {
                                    const _vm = VoiceGuide.getVoiceMode();
                                    const _bt = ['zundamon','mochiko','ryusei','auto'].includes(_vm) || _vm.startsWith('duo-');
                                    if (!_bt) VoiceGuide.announce(json.data.guide_text);
                                }
                            }
                        } catch(e) {
                            console.log('[Ambient] Error:', e.message);
                        }
                    }, 45000);

                    // LiveScanner with speed-adaptive mode
                    const videoEl = document.getElementById('scan-cam');
                    const canvasEl = document.getElementById('scan-canvas');

                    this.liveScanner = new LiveScanner({
                        onDetection: (det) => this.addDetection(det),
                        onEnvUpdate: (env) => {
                            const parts = [env.habitat, env.vegetation, env.canopy_cover].filter(Boolean);
                            this.envLabel = parts.join(' · ') || '';
                        },
                        onMovementModeChange: (mode) => {
                            // 車を手動選択している場合はオート検出で上書きしない
                            if (this.manualTransportMode === 'car') return;
                            this.currentMovementMode = mode;
                            console.log('[Sensor] Movement mode auto:', mode);
                        },
                        onLog: (msg) => console.log('[LiveScanner]', msg),
                        onGpsUpdate: (pos) => {
                            this.gpsAccuracy = Math.round(pos.accuracy);
                            if (pos.accuracy <= 50 && this.explorationMap) {
                                this.explorationMap.addExploredPoint(pos.lat, pos.lng, null);
                            }
                            // GPS取得後すぐに場所のトリビアを読み上げ（初回1回だけ）
                            if (!this._quickStartDone && pos.accuracy <= 100 && window.VoiceGuide && VoiceGuide.isEnabled()) {
                                this._quickStartDone = true;
                                this._fetchOpeningGuide(pos.lat, pos.lng);
                            }
                        },
                        speaker: this.selectedSpeaker,
                    });

                    this.liveScanner.start({
                        enableCamera: true,
                        enableAudio: true,
                        videoElement: videoEl,
                        canvasElement: canvasEl,
                    });

                    // Enable VoiceGuide
                    if (window.VoiceGuide) {
                        VoiceGuide.setVoiceMode(this.selectedSpeaker);
                        VoiceGuide.setEnabled(true);
                        // Unlock audio on user gesture (mobile browsers)
                        if ('speechSynthesis' in window) {
                            const unlock = new SpeechSynthesisUtterance('');
                            unlock.volume = 0;
                            speechSynthesis.speak(unlock);
                        }
                        try {
                            const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=');
                            silentAudio.volume = 0.01;
                            silentAudio.play().catch(() => {});
                        } catch(e) {}
                    }

                    // Opening announcement (VOICEVOX/duo以外のみブラウザTTSで繋ぎ)
                    const _vgm = VoiceGuide.getVoiceMode();
                    const _isVoxMode = ['zundamon','mochiko','ryusei','auto'].includes(_vgm) || _vgm.startsWith('duo-');
                    if (!_isVoxMode) {
                        const modeLabel = this.manualTransportMode === 'car' ? 'ドライブ' : this.manualTransportMode === 'bike' ? 'サイクリング' : 'フィールドサーチ';
                        VoiceGuide.announce(modeLabel + '、スタート！周りの生き物を探していくよ。');
                    }

                    this._sendLog('🔊 ON mode=' + (window.VoiceGuide ? VoiceGuide.getVoiceMode() : 'none'));
                    console.log(`[Sensor] Started (speaker: ${this.selectedSpeaker})`);
                },

                async stopSensor() {
                    this.sessionActive = false;
                    if (this._sessionTimer) { clearInterval(this._sessionTimer); this._sessionTimer = null; }
                    if (this._ambientTimer) { clearInterval(this._ambientTimer); this._ambientTimer = null; }

                    if (window.VoiceGuide) {
                        VoiceGuide.stop();
                        VoiceGuide.setEnabled(false);
                    }

                    let result = null;
                    if (this.liveScanner) {
                        result = await this.liveScanner.stop();
                        this.liveScanner = null;
                    }

                    // Even if no result (e.g. scanner failed), show basic report
                    if (!result) {
                        result = {
                            duration: this.sessionElapsed,
                            distance: this.sessionDistance,
                            speciesCount: 0,
                            species: [],
                            recap: null,
                            envHistory: [],
                        };
                    }

                    {
                        // Fetch NatureScore
                        let natureScore = null;
                        try {
                            const nsResp = await fetch('/api/v2/nature_score.php', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    species_count: result.speciesCount,
                                    duration_sec: result.duration,
                                    distance_m: result.distance,
                                    area_type: result.envHistory?.[0]?.habitat || 'unknown',
                                })
                            });
                            if (nsResp.ok) {
                                const nsJson = await nsResp.json();
                                if (nsJson.success) natureScore = nsJson.data;
                            }
                        } catch (e) {}

                        // Build report data
                        this.reportData = {
                            ...result,
                            natureScore,
                            locationName: new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' }),
                        };

                        // Save weekly stats
                        this._saveWeeklySession(result);
                        this._loadWeeklyStats();

                        // Show report
                        this.showReport = true;
                    }
                },

                // Handle permission errors gracefully
                async _handlePermissionError(type) {
                    const messages = {
                        camera: 'カメラの使用が許可されていません。設定から許可してください。',
                        audio: '音声の使用が許可されていません。あるくモード（音声検出）を使うには許可が必要です。',
                        gps: '位置情報の使用が許可されていません。マップ機能が制限されます。',
                    };
                    console.warn('[Permission]', type, messages[type]);
                },

                addDetection(detection) {
                    this.sessionDetections.push(detection);
                    const uniqueLabels = new Set(this.sessionDetections.map(d => d.label));
                    this.sessionSpeciesCount = uniqueLabels.size;
                    this.latestDetection = detection;

                    // Add marker on map
                    if (this.liveScanner?.lastGpsPos && this.map) {
                        const pos = this.liveScanner.lastGpsPos;
                        new maplibregl.Marker({ color: detection.source === 'audio' ? '#fbbf24' : '#60a5fa', scale: 0.5 })
                            .setLngLat([pos.lng, pos.lat])
                            .addTo(this.map);
                    }

                    // Voice guide narration — smart pacing
                    if (window.VoiceGuide && VoiceGuide.isEnabled()) {
                        const jaName = detection.japanese_name || detection.label || '';
                        const key = detection.label || '';
                        this._detCountToday = this._detCountToday || {};
                        this._detCountToday[key] = (this._detCountToday[key] || 0) + 1;
                        const isFirst = this._detCountToday[key] === 1;

                        // Cooldown: skip voice if still speaking or last announcement was < 25s ago
                        const now = Date.now();
                        this._lastVoiceTime = this._lastVoiceTime || 0;
                        const elapsed = now - this._lastVoiceTime;
                        const isBusy = VoiceGuide.isSpeaking();

                        if (isBusy && !isFirst) {
                            console.log('[Voice] Skipped (busy):', jaName);
                        } else if (elapsed < 25000 && !isFirst) {
                            // Too soon & not a new species — skip voice, just log
                            console.log('[Voice] Skipped (cooldown):', jaName);
                        } else if (!isFirst && this._detCountToday[key] > 3) {
                            // Same species detected many times — skip voice
                            console.log('[Voice] Skipped (repeated):', jaName, this._detCountToday[key]);
                        } else {
                            this._lastVoiceTime = now;
                            this._fetchVoiceGuide(jaName, detection.scientific_name, detection.confidence_raw || 0.5, this._detCountToday[key], isFirst)
                                .then(res => {
                                    if (!res) return;
                                    // BT安全: audio_urlがある場合のみ再生。ない場合はブラウザTTS(スマホスピーカー)に行かず沈黙
                                    const _vgm = VoiceGuide.getVoiceMode();
                                    const _btMode = ['zundamon','mochiko','ryusei','auto'].includes(_vgm) || _vgm.startsWith('duo-');
                                    if (res.audio_url) {
                                        VoiceGuide.announceAudio(res.audio_url);
                                    } else if (res.guide_text && !_btMode) {
                                        VoiceGuide.announce(res.guide_text);
                                    }
                                });
                        }
                    }

                    // Auto-fade detection card after 5 seconds
                    if (this._detectionFadeTimer) clearTimeout(this._detectionFadeTimer);
                    this._detectionFadeTimer = setTimeout(() => { this.latestDetection = null; }, 5000);
                },

                // GPS取得後即時に場所のトリビアを取得（起動高速化）
                async _fetchOpeningGuide(lat, lng) {
                    if (!window.VoiceGuide || !VoiceGuide.isEnabled()) return;
                    try {
                        const transportMode = this.manualTransportMode || 'walk';
                        const params = new URLSearchParams({
                            mode: 'opening',
                            lat, lng,
                            voice_mode: VoiceGuide.getVoiceMode(),
                            transport_mode: transportMode,
                        });
                        this._appendDestParams(params);
                        const resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
                        if (!resp.ok) return;
                        const json = await resp.json();
                        if (json.success && json.data) {
                            if (json.data.audio_url) {
                                VoiceGuide.announceAudio(json.data.audio_url);
                            } else if (json.data.guide_text) {
                                const _vm = VoiceGuide.getVoiceMode();
                                const _bt = ['zundamon','mochiko','ryusei','auto'].includes(_vm) || _vm.startsWith('duo-');
                                if (!_bt) VoiceGuide.announce(json.data.guide_text);
                            }
                        }
                    } catch(e) {
                        console.log('[Opening] Error:', e.message);
                    }
                },

                async _fetchVoiceGuide(name, sciName, confidence, count, isFirst) {
                    const cacheKey = (name || '') + '|' + (sciName || '');

                    // Try IndexedDB cache first (for repeated detections / offline)
                    const cached = await this._getVoiceCache(cacheKey);
                    if (cached && !navigator.onLine) {
                        this._sendLog('🔊 cache-hit (offline): ' + name);
                        return cached;
                    }

                    if (!navigator.onLine) {
                        this._sendLog('🔊 offline-fallback TTS: ' + name);
                        return { guide_text: name + 'を検出しました', audio_url: null };
                    }

                    try {
                        const params = new URLSearchParams();
                        params.set('name', name || '');
                        params.set('scientific_name', sciName || '');
                        params.set('confidence', confidence);
                        params.set('detection_count', count || 1);
                        params.set('is_first_today', isFirst ? '1' : '0');
                        params.set('voice_mode', window.VoiceGuide ? VoiceGuide.getVoiceMode() : 'standard');
                        const transportMode = this.manualTransportMode || (this.currentMovementMode === 'drive' ? 'car' : this.currentMovementMode) || 'walk';
                        params.set('transport_mode', transportMode);
                        const gpsPos = this.liveScanner?.lastGpsPos || {};
                        if (gpsPos.lat) params.set('lat', gpsPos.lat);
                        if (gpsPos.lng) params.set('lng', gpsPos.lng);
                        params.set('guide_mood', this.guideMood || 'relax');
                        this._appendDestParams(params);
                        const resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
                        if (!resp.ok) {
                            this._sendLog('🔊 API ' + resp.status);
                            return cached || { guide_text: name + 'を検出しました', audio_url: null };
                        }
                        const json = await resp.json();
                        if (json.success && json.data) {
                            await this._putVoiceCache(cacheKey, json.data);
                            return json.data;
                        }
                        return null;
                    } catch (e) {
                        this._sendLog('🔊 fetch ERR: ' + (e.message || 'network'));
                        return cached || { guide_text: name + 'を検出しました', audio_url: null };
                    }
                },

                // --- IndexedDB voice guide cache ---
                _voiceCacheDb: null,
                async _openVoiceCacheDb() {
                    if (this._voiceCacheDb) return this._voiceCacheDb;
                    if (!window.idb) return null;
                    this._voiceCacheDb = await idb.openDB('ikimon-voice-cache', 1, {
                        upgrade(db) { db.createObjectStore('guides'); },
                    });
                    return this._voiceCacheDb;
                },
                async _getVoiceCache(key) {
                    try {
                        const db = await this._openVoiceCacheDb();
                        if (!db) return null;
                        return await db.get('guides', key);
                    } catch { return null; }
                },
                async _putVoiceCache(key, data) {
                    try {
                        const db = await this._openVoiceCacheDb();
                        if (!db) return;
                        await db.put('guides', data, key);
                    } catch {}
                },

                // --- Aggregated client logging ---
                _logBuffer: {},
                _logFlushTimer: null,
                _sendLog(msg) {
                    this._logBuffer[msg] = (this._logBuffer[msg] || 0) + 1;
                    if (!this._logFlushTimer) {
                        this._logFlushTimer = setTimeout(() => {
                            const entries = Object.entries(this._logBuffer);
                            this._logBuffer = {};
                            this._logFlushTimer = null;
                            const lines = entries.map(([m, c]) => c > 1 ? m + ' (x' + c + ')' : m);
                            try {
                                navigator.sendBeacon('/api/v2/client_log.php', JSON.stringify({
                                    msg: lines.join(' | '),
                                    ua: navigator.userAgent.substring(0, 80)
                                }));
                            } catch {}
                        }, 5000);
                    }
                },

                _appendDestParams(params) {
                    const dest = this.destination || JSON.parse(sessionStorage.getItem('ikimon_destination') || 'null');
                    const destName = this.destinationName || sessionStorage.getItem('ikimon_destination_name') || '';
                    if (dest && dest.lat && dest.lng && destName) {
                        params.set('dest_lat', dest.lat);
                        params.set('dest_lng', dest.lng);
                        params.set('dest_name', destName);
                    }
                },

                // ── Destination & Saved Places ──

                async loadSavedPlaces() {
                    try {
                        const res = await fetch('api/v2/saved_places.php');
                        const result = await res.json();
                        if (result.success) {
                            this.savedPlaces = (result.data || []).sort((a, b) => (b.use_count || 0) - (a.use_count || 0));
                        }
                    } catch (e) {}
                },

                selectSavedPlace(sp) {
                    this.destination = { lat: sp.lat, lng: sp.lng, id: sp.id };
                    this.destinationName = sp.icon + ' ' + sp.name;
                },

                setDestination(sug) {
                    this.destination = { lat: sug.lat, lng: sug.lng, id: sug.id || null };
                    this.destinationName = sug.name;
                },

                searchDestination() {
                    const q = this.destinationName.trim();
                    if (!q || q.length < 2) { this.destSuggestions = []; return; }
                    const results = this.savedPlaces
                        .filter(sp => sp.name.includes(q))
                        .map(sp => ({
                            name: sp.name, lat: sp.lat, lng: sp.lng, id: sp.id,
                            icon: sp.icon, distance_km: null,
                        }));
                    this.destSuggestions = results;
                },

                async addCurrentLocationAsPlace() {
                    const name = this.newPlaceName.trim();
                    if (!name) return;
                    const lat = this._currentLat;
                    const lng = this._currentLng;
                    if (!lat || !lng) { alert('GPS位置を取得中です。少し待ってから再試行してください。'); return; }
                    try {
                        const res = await fetch('api/v2/saved_places.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'add', name, lat, lng, icon: this.newPlaceIcon }),
                        });
                        const result = await res.json();
                        if (result.success) {
                            this.savedPlaces.push(result.place);
                            this.newPlaceName = '';
                            this.newPlaceIcon = '📍';
                        }
                    } catch (e) {}
                    this.$nextTick(() => lucide.createIcons());
                },

                async deleteSavedPlace(placeId) {
                    try {
                        await fetch('api/v2/saved_places.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'delete', place_id: placeId }),
                        });
                        this.savedPlaces = this.savedPlaces.filter(sp => sp.id !== placeId);
                        if (this.destination && this.destination.id === placeId) {
                            this.destination = null;
                            this.destinationName = '';
                        }
                    } catch (e) {}
                    this.$nextTick(() => lucide.createIcons());
                },

                formatElapsed(sec) {
                    const m = Math.floor(sec / 60);
                    const s = sec % 60;
                    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                },

                // ── Weekly Stats ──

                _saveWeeklySession(result) {
                    try {
                        const key = 'ikimon_weekly_sessions';
                        const sessions = JSON.parse(localStorage.getItem(key) || '[]');
                        sessions.push({
                            date: new Date().toISOString().slice(0, 10),
                            species: result.speciesCount,
                            distance: result.distance,
                            duration: result.duration,
                        });
                        // Keep only last 7 days
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - 7);
                        const cutoffStr = cutoff.toISOString().slice(0, 10);
                        const filtered = sessions.filter(s => s.date >= cutoffStr);
                        localStorage.setItem(key, JSON.stringify(filtered));
                    } catch (e) {}
                },

                _loadWeeklyStats() {
                    try {
                        const key = 'ikimon_weekly_sessions';
                        const sessions = JSON.parse(localStorage.getItem(key) || '[]');
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - 7);
                        const cutoffStr = cutoff.toISOString().slice(0, 10);
                        const recent = sessions.filter(s => s.date >= cutoffStr);

                        this.weeklyStats = {
                            sessions: recent.length,
                            species: recent.reduce((sum, s) => sum + (s.species || 0), 0),
                            distance: recent.reduce((sum, s) => sum + (s.distance || 0), 0),
                            streak: this._calcStreak(recent),
                        };
                    } catch (e) {
                        this.weeklyStats = { sessions: 0, species: 0, distance: 0, streak: 0 };
                    }
                },

                _calcStreak(sessions) {
                    const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
                    if (dates.length === 0) return 0;
                    let streak = 1;
                    const today = new Date().toISOString().slice(0, 10);
                    if (dates[0] !== today) return 0;
                    for (let i = 1; i < dates.length; i++) {
                        const prev = new Date(dates[i - 1]);
                        const curr = new Date(dates[i]);
                        const diff = (prev - curr) / 86400000;
                        if (diff === 1) streak++;
                        else break;
                    }
                    return streak;
                },

                // ── Actions ──

                setPeriod(p) {
                    this.period = p;
                    this.explorationMap.setPeriod(p);
                },

                toggleLayer(layer) {
                    this.layerFlags[layer] = !this.layerFlags[layer];
                    this.explorationMap.setLayer(layer, this.layerFlags[layer]);
                },

                toggleGuide() {
                    if (this.siteGuide) this.siteGuide.toggle();
                },

                flyToCurrentLocation() {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(pos => {
                        this.map.flyTo({
                            center: [pos.coords.longitude, pos.coords.latitude],
                            zoom: 16, duration: 1000
                        });
                    }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                },

                // ── Format Helpers ──

                formatArea(m2) {
                    if (m2 >= 1_000_000) return (m2 / 1_000_000).toFixed(1) + ' km\u00B2';
                    return m2.toLocaleString() + ' m\u00B2';
                },

                formatDistance(m) {
                    if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
                    return Math.round(m) + ' m';
                },

                // ── Wake Lock ──

                async _requestWakeLock() {
                    try {
                        this.wakeLock = await navigator.wakeLock.request('screen');
                        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
                    } catch (e) { /* not supported or denied */ }
                }
            };
        }
    </script>
</body>

</html>
