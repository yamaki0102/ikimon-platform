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
        body, html { height: 100%; margin: 0; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        #map { width: 100%; height: 100%; }

        /* M3 tokens (--md-*, --shape-*, --type-*, --motion-*, --elev-*) loaded globally via assets/css/tokens.css */

        /* ═══════════════════════════════════════════════════════
           STATE LAYERS — M3 interactive state system
           Applied via ::before overlay on all interactive elements
        ═══════════════════════════════════════════════════════ */
        .md-interactive { position: relative; overflow: hidden; }
        .md-interactive::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0; border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .md-interactive:hover::before  { opacity: 0.08; }
        .md-interactive:active::before { opacity: 0.12; }
        .md-interactive:focus-visible  { outline: 3px solid var(--md-primary); outline-offset: 2px; }

        /* ═══════════════════════════════════════════════════════
           SURFACE — frosted glass (M3 compatible: tonal surface)
        ═══════════════════════════════════════════════════════ */
        .glass, .md-surface {
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border-radius: var(--shape-lg);
            box-shadow: var(--elev-2);
        }

        /* ═══════════════════════════════════════════════════════
           TOP BAR
        ═══════════════════════════════════════════════════════ */
        .top-bar {
            position: absolute; top: 0; left: 0; right: 0; z-index: 20;
            background: rgba(255,255,255,0.94);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--md-outline-variant);
            padding: 10px 16px;
            display: flex; align-items: center; justify-content: space-between;
        }
        .top-bar a {
            color: var(--md-primary); text-decoration: none;
            font-size: var(--type-label-lg); font-weight: 600;
            display: flex; align-items: center; gap: 4px;
            padding: 6px 8px; margin: -6px -8px;
            border-radius: var(--shape-sm);
            position: relative; overflow: hidden;
            transition: background var(--motion-short) var(--motion-std);
        }
        .top-bar a:hover { background: rgba(10,124,92,0.08); }
        .top-bar-title { font-size: var(--type-title-md); font-weight: 700; color: var(--md-on-surface); }

        /* ═══════════════════════════════════════════════════════
           STATS PANEL
        ═══════════════════════════════════════════════════════ */
        .stats-panel {
            position: absolute; top: 56px; left: 12px; z-index: 15;
            padding: 12px 16px;
            display: flex; flex-direction: column; gap: 2px;
            min-width: 130px;
        }
        .stats-panel .stat-row { display: flex; align-items: baseline; gap: 6px; }
        .stats-panel .stat-value {
            font-size: var(--type-body-lg); font-weight: 700; color: var(--md-on-surface);
        }
        .stats-panel .stat-label {
            font-size: var(--type-label-sm); color: var(--md-on-surface-variant);
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .stats-panel .stat-value.highlight { color: var(--md-primary); }

        /* ═══════════════════════════════════════════════════════
           PERIOD FILTER — M3 FilterChip
        ═══════════════════════════════════════════════════════ */
        .period-bar {
            position: absolute; top: 56px; left: 160px; z-index: 15;
            padding: 6px; display: flex; gap: 4px;
        }
        .period-btn {
            border: 1px solid var(--md-outline); background: transparent;
            padding: 0 12px; height: 32px; border-radius: var(--shape-sm);
            font-size: var(--type-label-md); font-weight: 500;
            color: var(--md-on-surface-variant); cursor: pointer;
            transition: background var(--motion-short) var(--motion-std),
                        border-color var(--motion-short) var(--motion-std),
                        color var(--motion-short) var(--motion-std);
            position: relative; overflow: hidden;
        }
        .period-btn::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .period-btn:hover::before  { opacity: 0.08; }
        .period-btn:active::before { opacity: 0.12; }
        .period-btn.active {
            background: var(--md-secondary-container);
            border-color: transparent;
            color: var(--md-on-secondary-container); font-weight: 700;
        }

        /* ═══════════════════════════════════════════════════════
           BOTTOM ACTION BAR — M3 FAB
        ═══════════════════════════════════════════════════════ */
        .bottom-bar {
            position: absolute; bottom: max(24px, env(safe-area-inset-bottom, 16px));
            left: 50%; transform: translateX(-50%); z-index: 20;
            display: flex; gap: 12px; align-items: center; padding: 8px 12px;
        }
        .action-btn {
            width: 56px; height: 56px; border-radius: var(--shape-lg); border: none;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: var(--type-label-sm); font-weight: 700; cursor: pointer;
            box-shadow: var(--elev-3);
            transition: box-shadow var(--motion-short) var(--motion-std);
            text-decoration: none; position: relative; overflow: hidden;
        }
        .action-btn::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0; border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .action-btn:hover { box-shadow: var(--elev-4); }
        .action-btn:hover::before  { opacity: 0.08; }
        .action-btn:active::before { opacity: 0.12; }
        .action-btn i { margin-bottom: 2px; }
        .btn-observe { background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); }
        .btn-locate  { background: var(--md-surface-container-low); color: var(--md-primary);
                       border: 1px solid var(--md-outline-variant); width: 44px; height: 44px; }

        /* ═══════════════════════════════════════════════════════
           GPS DOT
        ═══════════════════════════════════════════════════════ */
        .gps-dot {
            width: 8px; height: 8px; border-radius: var(--shape-full);
            animation: gps-pulse 2s ease-in-out infinite;
        }
        .gps-dot.good { background: #22c55e; }
        .gps-dot.fair { background: #f59e0b; }
        .gps-dot.poor { background: #ef4444; }
        .gps-dot.off  { background: var(--md-outline-variant); animation: none; }
        @keyframes gps-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ═══════════════════════════════════════════════════════
           LAYER PANEL
        ═══════════════════════════════════════════════════════ */
        .layer-btn {
            position: absolute; top: 56px; right: 12px; z-index: 15;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
        }
        .layer-sheet {
            position: absolute; top: 100px; right: 12px; z-index: 15;
            padding: 12px 16px; min-width: 200px;
        }
        .layer-sheet h4 {
            margin: 0 0 8px; font-size: var(--type-label-md);
            color: var(--md-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;
        }
        .layer-item {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 0; border-bottom: 1px solid var(--md-outline-variant);
            font-size: var(--type-body-md); font-weight: 500; color: var(--md-on-surface); cursor: pointer;
            position: relative; overflow: hidden;
        }
        .layer-item::before {
            content: ''; position: absolute; inset: 0;
            background: var(--md-on-surface); opacity: 0;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .layer-item:hover::before  { opacity: 0.08; }
        .layer-item:active::before { opacity: 0.12; }
        .layer-item:last-child { border-bottom: none; }
        .layer-toggle {
            width: 36px; height: 20px; border-radius: var(--shape-full); border: none;
            position: relative; cursor: pointer;
            transition: background var(--motion-short) var(--motion-std); flex-shrink: 0;
        }
        .layer-toggle.on  { background: var(--md-primary); }
        .layer-toggle.off { background: var(--md-outline); }
        .layer-toggle::after {
            content: ''; position: absolute; top: 2px; width: 16px; height: 16px;
            border-radius: var(--shape-full); background: #fff;
            transition: left var(--motion-short) var(--motion-std);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .layer-toggle.on::after  { left: 18px; }
        .layer-toggle.off::after { left: 2px; }

        /* Loading bar */
        .loading-bar {
            position: absolute; top: 46px; left: 0; right: 0; height: 3px; z-index: 30;
            background: linear-gradient(90deg, transparent, var(--md-primary), transparent);
            animation: loading-slide 1s ease-in-out infinite;
        }
        @keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* Mobile */
        @media (max-width: 640px) {
            .period-bar { top: auto; bottom: max(90px, calc(env(safe-area-inset-bottom, 16px) + 72px)); left: 50%; transform: translateX(-50%); }
            .stats-panel { top: 52px; left: 8px; padding: 8px 10px; }
            .stats-panel .stat-value { font-size: var(--type-body-md); }
        }

        /* ═══════════════════════════════════════════════════════
           SITE GUIDE TOAST
        ═══════════════════════════════════════════════════════ */
        .site-guide-toast {
            position: absolute; bottom: max(100px, calc(env(safe-area-inset-bottom, 16px) + 88px));
            left: 50%; transform: translateX(-50%); z-index: 25;
            max-width: 360px; width: calc(100% - 32px);
            animation: sgt-slide-up 0.4s var(--motion-decel) both;
        }
        .sgt-inner {
            background: rgba(255,255,255,0.97); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--md-outline-variant); border-radius: var(--shape-lg);
            box-shadow: var(--elev-3); padding: 12px 14px;
            display: flex; align-items: center; gap: 10px; cursor: pointer;
            transition: box-shadow var(--motion-short) var(--motion-std);
            position: relative; overflow: hidden;
        }
        .sgt-inner::before {
            content: ''; position: absolute; inset: 0;
            background: var(--md-on-surface); opacity: 0;
            transition: opacity var(--motion-short) var(--motion-std); pointer-events: none;
        }
        .sgt-inner:hover { box-shadow: var(--elev-4); }
        .sgt-inner:hover::before  { opacity: 0.04; }
        .sgt-inner:active::before { opacity: 0.08; }
        .sgt-icon { width: 36px; height: 36px; border-radius: var(--shape-md); background: var(--md-primary-container); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sgt-title { font-size: var(--type-body-md); font-weight: 700; color: var(--md-on-surface); }
        .sgt-sub   { font-size: var(--type-label-sm); color: var(--md-on-surface-variant); margin-top: 1px; }
        .sgt-text  { flex: 1; min-width: 0; }
        @keyframes sgt-slide-up { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        /* ═══════════════════════════════════════════════════════
           SITE GUIDE PANEL
        ═══════════════════════════════════════════════════════ */
        .site-guide-panel {
            position: absolute; top: 0; right: 0; z-index: 30;
            width: min(400px, 100%); height: 100vh; height: 100dvh;
            background: var(--md-surface);
            box-shadow: -4px 0 24px rgba(0,0,0,0.12);
            transform: translateX(100%);
            transition: transform var(--motion-medium) var(--motion-decel);
            flex-direction: column;
        }
        .site-guide-panel.open { transform: translateX(0); }
        .sgp-header {
            padding: 16px 16px 12px; border-bottom: 1px solid var(--md-surface-container-high);
            display: flex; align-items: flex-start; gap: 12px; flex-shrink: 0;
            background: var(--md-surface-container-low);
        }
        .sgp-close {
            position: absolute; top: 12px; right: 12px; background: none; border: none;
            cursor: pointer; padding: 4px; border-radius: var(--shape-sm); color: var(--md-on-surface-variant);
            transition: background var(--motion-short) var(--motion-std);
        }
        .sgp-close:hover { background: var(--md-surface-variant); color: var(--md-on-surface); }
        .sgp-title    { font-size: var(--type-title-lg); font-weight: 700; color: var(--md-on-surface); margin: 0; padding-right: 32px; }
        .sgp-subtitle { font-size: var(--type-label-md); color: var(--md-on-surface-variant); margin: 4px 0 0; }
        .sgp-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
        .sgp-section { padding: 16px; border-bottom: 1px solid var(--md-surface-container-high); }
        .sgp-section-title { font-size: var(--type-label-lg); font-weight: 700; color: var(--md-on-surface); margin: 0 0 10px; display: flex; align-items: center; gap: 6px; }
        .sgp-welcome p { font-size: var(--type-body-sm); line-height: 1.7; color: var(--md-on-surface-variant); margin: 0; }
        .sgp-highlights { display: flex; flex-direction: column; gap: 6px; }
        .sgp-highlight-item { font-size: var(--type-label-md); padding: 6px 10px; background: var(--md-primary-container); border-radius: var(--shape-sm); border-left: 3px solid var(--md-primary); color: var(--md-on-primary-container); }
        .sgp-season { background: var(--md-tertiary-container); }
        .sgp-season-desc { font-size: var(--type-body-sm); line-height: 1.6; color: var(--md-on-tertiary-container); margin: 0; }
        .sgp-routes { display: flex; flex-direction: column; gap: 8px; }
        .sgp-route-card { padding: 10px 12px; border: 1px solid var(--md-outline-variant); border-radius: var(--shape-md); }
        .sgp-route-name { font-size: var(--type-body-md); font-weight: 700; color: var(--md-on-surface); }
        .sgp-route-meta { display: flex; gap: 8px; margin-top: 4px; font-size: var(--type-label-sm); color: var(--md-on-surface-variant); }
        .sgp-route-diff { background: var(--md-primary-container); color: var(--md-on-primary-container); padding: 1px 6px; border-radius: var(--shape-xs); font-weight: 600; }
        .sgp-route-desc { font-size: var(--type-body-sm); color: var(--md-on-surface-variant); margin: 6px 0 0; line-height: 1.5; }
        .sgp-pois { display: flex; flex-direction: column; gap: 6px; }
        .sgp-poi-card { border: 1px solid var(--md-outline-variant); border-radius: var(--shape-md); overflow: hidden; cursor: pointer; transition: border-color var(--motion-short) var(--motion-std); }
        .sgp-poi-card:hover, .sgp-poi-card.expanded { border-color: var(--md-primary); }
        .sgp-poi-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
        .sgp-poi-emoji { font-size: 22px; flex-shrink: 0; }
        .sgp-poi-titles { flex: 1; min-width: 0; }
        .sgp-poi-name { font-size: var(--type-body-md); font-weight: 700; color: var(--md-on-surface); display: flex; align-items: center; gap: 6px; }
        .sgp-poi-badge { font-size: var(--type-label-sm); font-weight: 700; background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); padding: 1px 6px; border-radius: var(--shape-xs); }
        .sgp-poi-short { font-size: var(--type-label-md); color: var(--md-on-surface-variant); margin-top: 2px; line-height: 1.4; }
        .sgp-poi-chevron { transition: transform var(--motion-short) var(--motion-std); }
        .sgp-poi-card.expanded .sgp-poi-chevron { transform: rotate(180deg); }
        .sgp-poi-detail { max-height: 0; overflow: hidden; transition: max-height var(--motion-long) var(--motion-std); }
        .sgp-poi-card.expanded .sgp-poi-detail { max-height: 800px; }
        .sgp-poi-long { padding: 0 12px 8px; }
        .sgp-poi-long p { font-size: var(--type-body-sm); line-height: 1.7; color: var(--md-on-surface-variant); margin: 0 0 8px; }
        .sgp-poi-tips { padding: 8px 12px; background: var(--md-surface-container); margin: 0 8px 8px; border-radius: var(--shape-sm); }
        .sgp-poi-tips strong { font-size: var(--type-label-md); color: var(--md-on-surface); }
        .sgp-tip { font-size: var(--type-label-md); color: var(--md-on-surface-variant); margin-top: 4px; padding-left: 8px; border-left: 2px solid var(--md-outline-variant); }
        .sgp-poi-season  { font-size: var(--type-label-md); color: var(--md-on-surface-variant); padding: 4px 12px 8px; }
        .sgp-poi-trivia  { font-size: var(--type-label-md); color: #6750a4; background: rgba(103,80,164,0.06); padding: 8px 12px; margin: 0 8px 12px; border-radius: var(--shape-sm); line-height: 1.5; }
        .sgp-poi-read { opacity: 0.65; }
        .sgp-poi-read:hover, .sgp-poi-read.expanded { opacity: 1; }
        .sgp-poi-new    { background: #dbeafe; color: #2563eb; }
        .sgp-poi-unread { border-left: 3px solid var(--md-primary); }
        .sgp-story-body p { font-size: var(--type-body-sm); line-height: 1.7; color: var(--md-on-surface-variant); margin: 0 0 10px; }
        .sgp-story { background: var(--md-surface-container-low); }
        .sgp-link { display: inline-block; font-size: var(--type-body-sm); color: var(--md-primary); font-weight: 600; text-decoration: none; margin-bottom: 6px; }
        .sgp-link:hover { text-decoration: underline; }
        .sgp-info-row { font-size: var(--type-body-sm); color: var(--md-on-surface-variant); margin-bottom: 4px; }
        .sgp-notes { margin: 8px 0 0; padding-left: 18px; }
        .sgp-notes li { font-size: var(--type-label-md); color: var(--md-on-surface-variant); margin-bottom: 3px; line-height: 1.5; }
        .btn-guide { background: var(--md-primary); color: var(--md-on-primary); }
        .btn-guide.inactive { background: var(--md-surface-container-low); color: var(--md-on-surface-variant); border: 1px solid var(--md-outline-variant); }
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
            <span class="stat-value" x-text="gpsAccuracy ? gpsAccuracy + ' m' : '--'" style="font-size:var(--type-label-lg);"></span>
            <span class="stat-label">GPS</span>
        </div>
        <div class="stat-row" style="margin-top:2px;">
            <div class="gps-dot" :class="isOnline ? 'good' : 'off'" style="margin-right:4px;"></div>
            <span class="stat-value" x-text="isOnline ? 'OK' : 'OFF'" style="font-size:var(--type-label-lg);" :style="isOnline ? '' : 'color:var(--md-error)'"></span>
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

    <!-- センサー初回ガイド (M3 bottom sheet) -->
    <div x-show="!sessionActive && showSensorIntro" x-cloak
         style="position:absolute;bottom:0;left:0;right:0;z-index:26;">
        <div style="background:var(--md-surface);border-radius:var(--shape-xl) var(--shape-xl) 0 0;padding:12px 24px max(24px,env(safe-area-inset-bottom,24px));box-shadow:var(--elev-3);">
            <div style="width:32px;height:4px;background:var(--md-outline-variant);border-radius:var(--shape-full);margin:0 auto 20px;"></div>
            <!-- ステップ dots -->
            <div style="display:flex;justify-content:center;gap:6px;margin-bottom:20px;">
                <template x-for="i in [1,2,3]" :key="i">
                    <div :style="i === introStep ? 'width:20px;background:var(--md-primary);' : 'width:8px;background:var(--md-outline-variant);'"
                         style="height:8px;border-radius:var(--shape-full);transition:all 0.3s;"></div>
                </template>
            </div>
            <!-- ステップ内容 -->
            <div style="text-align:center;min-height:100px;margin-bottom:20px;">
                <template x-if="introStep === 1">
                    <div>
                        <div style="font-size:36px;margin-bottom:10px;">📡</div>
                        <div style="font-size:var(--type-title-sm);font-weight:800;color:var(--md-on-surface);margin-bottom:6px;">マイクが生きものを探す</div>
                        <div style="font-size:var(--type-body-sm);color:var(--md-on-surface-variant);line-height:1.6;">周囲の音声をリアルタイムで解析して<br>鳥・虫・自然音を自動で記録します</div>
                    </div>
                </template>
                <template x-if="introStep === 2">
                    <div>
                        <div style="font-size:36px;margin-bottom:10px;">🗺️</div>
                        <div style="font-size:var(--type-title-sm);font-weight:800;color:var(--md-on-surface);margin-bottom:6px;">歩いた道が地図に残る</div>
                        <div style="font-size:var(--type-body-sm);color:var(--md-on-surface-variant);line-height:1.6;">移動するほど霧が晴れて<br>あなただけの探索マップが育っていきます</div>
                    </div>
                </template>
                <template x-if="introStep === 3">
                    <div>
                        <div style="font-size:36px;margin-bottom:10px;">🔬</div>
                        <div style="font-size:var(--type-title-sm);font-weight:800;color:var(--md-on-surface);margin-bottom:6px;">データは自動で記録される</div>
                        <div style="font-size:var(--type-body-sm);color:var(--md-on-surface-variant);line-height:1.6;">検出した生きものは終了時に自動送信。<br>100年後のアーカイブに刻まれます</div>
                    </div>
                </template>
            </div>
            <!-- ボタン -->
            <button @click="nextIntroStep()" style="width:100%;height:52px;border-radius:var(--shape-lg);border:none;background:var(--md-primary);color:var(--md-on-primary);font-size:var(--type-body-lg);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:var(--elev-1);">
                <span x-text="introStep < 3 ? '次へ →' : '✨ はじめる'"></span>
            </button>
            <div style="text-align:center;margin-top:12px;">
                <button @click="skipIntro()" style="background:none;border:none;color:var(--md-on-surface-variant);font-size:var(--type-label-md);cursor:pointer;padding:4px 8px;">スキップ</button>
            </div>
        </div>
    </div>

    <!-- Sensor Start Panel (M3 bottom sheet) -->
    <div x-show="!sessionActive && showModeSelect && !showSensorIntro" x-cloak
         style="position:absolute;bottom:0;left:0;right:0;z-index:25;">
        <div style="background:var(--md-surface);border-radius:var(--shape-xl) var(--shape-xl) 0 0;padding:12px 24px max(24px,env(safe-area-inset-bottom,24px));box-shadow:var(--elev-3);">
            <!-- Handle bar -->
            <div style="width:32px;height:4px;background:var(--md-outline-variant);border-radius:var(--shape-full);margin:0 auto 20px;"></div>

            <!-- 移動手段 (M3 FilterChip) -->
            <div style="font-size:var(--type-label-md);color:var(--md-on-surface-variant);font-weight:500;margin-bottom:10px;">移動手段</div>
            <div style="display:flex;gap:8px;margin-bottom:16px;">
                <template x-for="tm in transportModes" :key="tm.id">
                    <button @click="manualTransportMode = tm.id; localStorage.setItem('ikimon_transport', tm.id)"
                            :style="manualTransportMode === tm.id ? 'background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent;' : 'background:transparent;color:var(--md-on-surface-variant);border-color:var(--md-outline);'"
                            style="height:40px;padding:0 16px;border-radius:var(--shape-sm);border:1px solid;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background var(--motion-short) var(--motion-std),border-color var(--motion-short) var(--motion-std);flex:1;justify-content:center;position:relative;overflow:hidden;">
                        <span x-text="tm.emoji" style="font-size:18px;pointer-events:none;"></span>
                        <span x-text="tm.label" style="font-size:var(--type-label-lg);font-weight:600;pointer-events:none;"></span>
                    </button>
                </template>
            </div>

            <!-- ドライブ設定 -->
            <div x-show="manualTransportMode === 'car'" x-cloak style="margin-bottom:16px;">
                <div style="font-size:var(--type-label-md);color:var(--md-on-surface-variant);font-weight:500;margin-bottom:10px;">ドライブ時間</div>
                <div style="display:flex;gap:8px;">
                    <template x-for="dt in [{min:15,label:'15分'},{min:30,label:'30分'},{min:60,label:'1h'},{min:0,label:'なし'}]" :key="dt.min">
                        <button @click="driveDurationMin = dt.min; localStorage.setItem('ikimon_drive_duration', dt.min)"
                                :style="driveDurationMin === dt.min ? 'background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent;' : 'background:transparent;color:var(--md-on-surface-variant);border-color:var(--md-outline);'"
                                style="height:40px;flex:1;border-radius:var(--shape-sm);border:1px solid;cursor:pointer;font-size:var(--type-label-lg);font-weight:600;transition:background var(--motion-short) var(--motion-std),border-color var(--motion-short) var(--motion-std);">
                            <span x-text="dt.label" style="pointer-events:none;"></span>
                        </button>
                    </template>
                </div>
            </div>

            <!-- START — M3 Filled Button (extra large) -->
            <button @click="startSensor()" style="width:100%;height:56px;border-radius:var(--shape-lg);border:none;background:var(--md-primary);color:var(--md-on-primary);font-size:var(--type-body-lg);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:var(--elev-1);transition:box-shadow var(--motion-short) var(--motion-std);"
                    onmouseover="this.style.boxShadow='var(--elev-2)'" onmouseout="this.style.boxShadow='var(--elev-1)'">
                📡 スタート
            </button>
        </div>
    </div>

    <!-- Drive Mode HUD (full screen — M3 dark theme, dashboard layout) -->
    <div x-show="sessionActive && (currentMovementMode === 'drive' || manualTransportMode === 'car')" x-cloak
         style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:100;background:#141218;display:flex;flex-direction:column;">
        <!-- Top bar: status badge -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:max(20px,calc(env(safe-area-inset-top,16px) + 8px)) 20px 16px;">
            <div style="background:rgba(141,212,179,0.15);border:1px solid rgba(141,212,179,0.25);border-radius:var(--shape-full);padding:5px 14px;">
                <span style="color:#8dd4b3;font-size:var(--type-label-sm);font-weight:700;letter-spacing:0.3px;">🚗 ドライブ記録中</span>
            </div>
        </div>

        <!-- Center: 3-stat dashboard -->
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;">
            <!-- Detection card -->
            <div x-show="latestDetection" x-cloak x-transition
                 style="background:rgba(141,212,179,0.1);border:1px solid rgba(141,212,179,0.2);border-radius:var(--shape-lg);padding:10px 16px;margin-bottom:24px;width:100%;max-width:320px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:24px;" x-text="latestDetection?.emoji || '🐦'"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:var(--type-title-sm);font-weight:700;color:#e6e1e5;" x-text="latestDetection?.label || ''"></div>
                    <div style="font-size:var(--type-label-sm);color:#938f99;" x-text="latestDetection?.reason || ''"></div>
                </div>
            </div>
            <!-- 3 stats — M3 Surface Containers (dark) -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;width:100%;max-width:340px;">
                <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:var(--shape-xl);padding:20px 8px;">
                    <div style="font-size:var(--type-headline-md);font-weight:900;color:#e6e1e5;line-height:1;" x-text="formatElapsed(sessionElapsed)"></div>
                    <div style="font-size:var(--type-label-sm);color:#938f99;font-weight:600;margin-top:6px;">時間</div>
                </div>
                <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:var(--shape-xl);padding:20px 8px;">
                    <div style="font-size:var(--type-headline-md);font-weight:900;color:#e6e1e5;line-height:1;" x-text="sessionSpeciesCount"></div>
                    <div style="font-size:var(--type-label-sm);color:#938f99;font-weight:600;margin-top:6px;">種</div>
                </div>
                <div style="text-align:center;background:rgba(255,255,255,0.06);border-radius:var(--shape-xl);padding:20px 8px;">
                    <div style="font-size:var(--type-headline-md);font-weight:900;color:#e6e1e5;line-height:1;" x-text="(sessionDistance / 1000).toFixed(1)"></div>
                    <div style="font-size:var(--type-label-sm);color:#938f99;font-weight:600;margin-top:6px;">km</div>
                </div>
            </div>
            <!-- Environment label -->
            <div x-show="envLabel" x-cloak style="font-size:var(--type-label-sm);color:#938f99;margin-top:16px;" x-text="'🌿 ' + envLabel"></div>
        </div>

        <!-- Bottom: transport switch + stop -->
        <div style="padding:0 20px max(20px,env(safe-area-inset-bottom,20px));display:flex;flex-direction:column;align-items:center;gap:16px;">
            <!-- Transport mode chips (dark) -->
            <div style="display:flex;gap:8px;">
                <template x-for="tm in transportModes" :key="tm.id">
                    <button @click="setTransportMode(tm.id)"
                            :style="manualTransportMode === tm.id ? 'background:rgba(141,212,179,0.2);border-color:rgba(141,212,179,0.5);color:#8dd4b3;' : 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#938f99;'"
                            style="padding:8px 16px;border-radius:var(--shape-md);border:1.5px solid;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:var(--type-label-lg);font-weight:700;transition:background var(--motion-short) var(--motion-std),border-color var(--motion-short) var(--motion-std);">
                        <span x-text="tm.emoji" style="pointer-events:none;"></span>
                        <span x-text="tm.label" style="pointer-events:none;"></span>
                    </button>
                </template>
            </div>
            <!-- Stop — M3 Filled Button (Error) -->
            <button @click="stopSensor()"
                    style="width:100%;max-width:280px;padding:16px;border-radius:var(--shape-full);background:var(--md-error);border:none;color:var(--md-on-error);font-size:var(--type-title-sm);font-weight:700;cursor:pointer;box-shadow:var(--elev-1);display:flex;align-items:center;justify-content:center;gap:8px;">
                ■ 終了する
            </button>
        </div>
    </div>

    <!-- Session Active HUD (bottom, hidden in drive/car mode) -->
    <div x-show="sessionActive && currentMovementMode !== 'drive' && manualTransportMode !== 'car'" x-cloak
         style="position:absolute;bottom:max(24px,env(safe-area-inset-bottom,16px));left:50%;transform:translateX(-50%);z-index:25;width:calc(100% - 32px);max-width:400px;">
        <div class="md-surface" style="padding:12px 16px;">
            <!-- Movement mode chip + transport switcher -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:var(--type-label-md);font-weight:700;padding:3px 10px;border-radius:var(--shape-sm);background:var(--md-primary-container);color:var(--md-on-primary-container);"
                      x-text="modeLabels[currentMovementMode] || 'サーチ中'"></span>
                <div style="display:flex;gap:4px;">
                    <template x-for="tm in transportModes" :key="tm.id">
                        <button @click="setTransportMode(tm.id)"
                                :style="manualTransportMode === tm.id ? 'background:var(--md-primary);color:var(--md-on-primary);border-color:var(--md-primary);' : 'background:var(--md-surface-container-low);color:var(--md-on-surface-variant);border-color:var(--md-outline-variant);'"
                                style="padding:4px 10px;border-radius:var(--shape-sm);border:1.5px solid;cursor:pointer;font-size:var(--type-label-md);transition:background var(--motion-short) var(--motion-std),border-color var(--motion-short) var(--motion-std);"
                                :title="tm.label">
                            <span x-text="tm.emoji" style="pointer-events:none;"></span>
                        </button>
                    </template>
                </div>
            </div>
            <!-- Detection card — M3 Surface Container -->
            <div x-show="latestDetection" x-cloak x-transition
                 style="margin-bottom:8px;padding:8px 12px;border-radius:var(--shape-md);display:flex;align-items:center;gap:10px;"
                 :style="'background:' + (latestDetection?.source === 'audio' ? 'rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2)' : 'rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2)')">
                <span style="font-size:20px;" x-text="latestDetection?.emoji || '🐦'"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:var(--type-body-md);font-weight:700;color:var(--md-on-surface);" x-text="latestDetection?.label || ''"></div>
                    <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);" x-text="latestDetection?.reason || ''"></div>
                </div>
            </div>
            <!-- Environment label -->
            <div x-show="envLabel" x-cloak style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);margin-bottom:6px;text-align:center;" x-text="'🌿 ' + envLabel"></div>
            <!-- Stats row -->
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:16px;">
                    <div style="text-align:center;">
                        <div style="font-size:var(--type-title-md);font-weight:900;color:var(--md-on-surface);" x-text="sessionSpeciesCount">0</div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">種</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:var(--type-title-md);font-weight:700;color:var(--md-on-surface);" x-text="formatDistance(sessionDistance)">0 m</div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">距離</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:var(--type-title-md);font-weight:700;color:var(--md-on-surface);" x-text="formatElapsed(sessionElapsed)">00:00</div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">時間</div>
                    </div>
                </div>
                <button @click="stopSensor()" style="padding:8px 20px;border-radius:var(--shape-full);border:none;background:var(--md-error);color:var(--md-on-error);font-size:var(--type-label-lg);font-weight:700;cursor:pointer;">
                    終了
                </button>
            </div>
        </div>
    </div>

    <!-- Bottom Action Bar (when no session and sensor panel hidden) -->
    <div class="bottom-bar glass" x-show="!sessionActive && !showModeSelect && !showSensorIntro" x-cloak>
        <!-- Locate -->
        <button class="action-btn btn-locate" @click="flyToCurrentLocation()">
            <i data-lucide="locate" style="width:20px;height:20px;"></i>
        </button>

        <!-- Start Sensor — M3 Extended FAB -->
        <button class="action-btn" style="background:var(--md-primary);color:var(--md-on-primary);width:auto;border-radius:var(--shape-lg);padding:0 20px;height:56px;" @click="showModeSelect = true">
            <i data-lucide="radio" style="width:20px;height:20px;"></i>
            <span>センサー</span>
        </button>

        <!-- Observe -->
        <a :href="'post.php?return=field_research.php&field_session=' + encodeURIComponent(recorder?.sessionId || '')"
           class="action-btn btn-observe">
            <i data-lucide="camera" style="width:20px;height:20px;"></i>
            <span>投稿</span>
        </a>

    </div>

    <!-- ===== 散歩レポート (Session Result Overlay — M3 Light Surface) ===== -->
    <div x-show="showReport" x-cloak
         style="position:fixed;inset:0;z-index:50;background:var(--md-surface);color:var(--md-on-surface);overflow-y:auto;-webkit-overflow-scrolling:touch;">
        <div style="max-width:440px;margin:0 auto;padding:0 0 100px;">
            <!-- Hero Header (emerald gradient) -->
            <div style="background:linear-gradient(135deg,#0a7c5c,#0f9b74,#3abf8e);padding:32px 16px 28px;text-align:center;border-radius:0 0 var(--shape-xl) var(--shape-xl);">
                <div style="font-size:52px;margin-bottom:8px;">🌿</div>
                <h2 style="font-size:var(--type-title-lg);font-weight:900;margin:0;color:#fff;">今日のいきものサーチ</h2>
                <p style="font-size:var(--type-label-lg);color:rgba(255,255,255,0.8);margin:4px 0 0;" x-text="reportData?.locationName || ''"></p>
            </div>

            <div style="padding:16px;">
            <!-- Main Stats Card — M3 Surface + Elevation 1 -->
            <div style="background:#fff;border-radius:var(--shape-lg);padding:20px;margin-top:-20px;margin-bottom:16px;box-shadow:var(--elev-2);">
                <div style="display:flex;justify-content:space-around;text-align:center;">
                    <div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);font-weight:500;">🚶 時間</div>
                        <div style="font-size:var(--type-headline-sm);font-weight:900;color:var(--md-on-surface);" x-text="formatElapsed(reportData?.duration || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);font-weight:500;">📍 距離</div>
                        <div style="font-size:var(--type-headline-sm);font-weight:900;color:var(--md-on-surface);" x-text="formatDistance(reportData?.distance || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);font-weight:500;">🐦 種数</div>
                        <div style="font-size:var(--type-headline-sm);font-weight:900;color:var(--md-on-surface);" x-text="reportData?.speciesCount || 0"></div>
                    </div>
                </div>
            </div>

            <!-- Loading indicator -->
            <div x-show="reportLoading" style="text-align:center;padding:20px 0;margin-bottom:16px;">
                <div style="display:inline-flex;align-items:center;gap:10px;background:var(--md-surface-container);border-radius:var(--shape-full);padding:12px 24px;">
                    <div style="width:20px;height:20px;border:2.5px solid var(--md-primary);border-top-color:transparent;border-radius:var(--shape-full);animation:spin 0.8s linear infinite;"></div>
                    <span style="font-size:var(--type-body-sm);font-weight:600;color:var(--md-on-surface-variant);">レポートを作成中...</span>
                </div>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            </div>

            <!-- Nature Score — M3 Primary Container -->
            <div style="background:var(--md-primary-container);border-radius:var(--shape-lg);padding:16px;margin-bottom:16px;"
                 x-show="reportData?.natureScore">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:var(--type-label-md);font-weight:700;color:var(--md-on-primary-container);">🌿 自然浴スコア</span>
                    <div style="display:flex;align-items:baseline;gap:2px;">
                        <span style="font-size:var(--type-headline-md);font-weight:900;color:var(--md-primary);" x-text="reportData?.natureScore?.score || '-'"></span>
                        <span style="font-size:var(--type-label-md);color:var(--md-on-primary-container);">/10</span>
                    </div>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px;">
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.6);border-radius:var(--shape-md);">
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">多様性</div>
                        <div style="font-size:var(--type-body-md);font-weight:800;color:var(--md-on-surface);" x-text="reportData?.natureScore?.breakdown?.diversity || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.6);border-radius:var(--shape-md);">
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">音風景</div>
                        <div style="font-size:var(--type-body-md);font-weight:800;color:var(--md-on-surface);" x-text="reportData?.natureScore?.breakdown?.soundscape || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.6);border-radius:var(--shape-md);">
                        <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);">環境</div>
                        <div style="font-size:var(--type-body-md);font-weight:800;color:var(--md-on-surface);" x-text="reportData?.natureScore?.breakdown?.environment || '-'"></div>
                    </div>
                </div>
                <div style="font-size:var(--type-label-md);color:var(--md-on-primary-container);text-align:center;" x-text="reportData?.natureScore?.message || ''"></div>
            </div>

            <!-- No species message — M3 Surface Container -->
            <div x-show="!reportData?.species?.length" style="background:var(--md-surface-container);border-radius:var(--shape-lg);padding:20px;margin-bottom:16px;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">🌱</div>
                <div style="font-size:var(--type-body-md);color:var(--md-on-surface);font-weight:700;">今回は検出なし</div>
                <div style="font-size:var(--type-label-md);color:var(--md-on-surface-variant);margin-top:4px;">でも、歩いた記録はたんけんマップに残っています。<br>GPS軌跡と環境データは、あとから見返せる形で保存されています。</div>
            </div>

            <!-- Species Gallery (horizontal scroll) -->
            <div style="margin-bottom:16px;" x-show="reportData?.species?.length > 0">
                <h3 style="font-size:var(--type-label-lg);font-weight:700;color:var(--md-on-surface);margin:0 0 10px;">出会った生きもの</h3>
                <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;margin:0 -16px;padding:0 16px 8px;">
                    <template x-for="sp in (reportData?.species || [])" :key="sp.name">
                        <div style="min-width:140px;max-width:160px;background:#fff;border:1px solid var(--md-outline-variant);border-radius:var(--shape-lg);padding:12px;flex-shrink:0;box-shadow:var(--elev-1);">
                            <div style="font-size:var(--type-body-md);font-weight:700;color:var(--md-on-surface);" x-text="sp.name"></div>
                            <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);margin-top:4px;" x-text="sp.source === 'audio' ? '🎤 音声' : '📷 カメラ'"></div>
                            <div style="font-size:var(--type-label-sm);color:var(--md-outline);margin-top:2px;" x-text="sp.note || sp.category || ''"></div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- AI Narrative — M3 Surface Container -->
            <div style="background:var(--md-surface-container);border-radius:var(--shape-lg);padding:16px;margin-bottom:16px;"
                 x-show="reportData?.recap?.narrative">
                <div style="font-size:var(--type-body-sm);line-height:1.7;color:var(--md-on-surface);" x-text="reportData?.recap?.narrative || ''"></div>
                <div style="font-size:var(--type-label-sm);color:var(--md-on-surface-variant);margin-top:6px;">🤖 AI要約</div>
            </div>

            <!-- Contribution — M3 Outlined Container -->
            <div style="background:#fff;border:1px solid var(--md-outline-variant);border-radius:var(--shape-lg);padding:16px;margin-bottom:16px;"
                 x-show="reportData?.recap?.contribution?.length > 0">
                <h3 style="font-size:var(--type-label-lg);font-weight:700;color:var(--md-on-surface);margin:0 0 8px;">あなたの貢献</h3>
                <template x-for="c in (reportData?.recap?.contribution || [])" :key="c.text">
                    <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;font-size:var(--type-body-sm);">
                        <span x-text="c.icon"></span>
                        <span style="color:var(--md-on-surface);" x-text="c.text"></span>
                    </div>
                </template>
            </div>

            <!-- Weekly Summary — M3 Outlined Container -->
            <div style="background:#fff;border:1px solid var(--md-outline-variant);border-radius:var(--shape-lg);padding:16px;margin-bottom:16px;"
                 x-show="weeklyStats.sessions > 0">
                <h3 style="font-size:var(--type-label-lg);font-weight:700;color:var(--md-on-surface);margin:0 0 8px;">📊 今週の記録</h3>
                <div style="display:flex;gap:16px;font-size:var(--type-body-sm);color:var(--md-on-surface);font-weight:600;">
                    <span x-text="weeklyStats.sessions + '回'"></span>
                    <span x-text="weeklyStats.species + '種'"></span>
                    <span x-text="formatDistance(weeklyStats.distance)"></span>
                </div>
                <div style="font-size:var(--type-label-md);color:var(--md-tertiary);font-weight:700;margin-top:6px;" x-show="weeklyStats.streak > 1"
                     x-text="'🔥 ' + weeklyStats.streak + '日連続サーチ中!'"></div>
            </div>

            <!-- Badges — M3 Assist Chips -->
            <div style="margin-bottom:16px;" x-show="reportData?.recap?.rank_progress?.badges_earned?.length > 0">
                <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
                    <template x-for="b in (reportData?.recap?.rank_progress?.badges_earned || [])" :key="b.name || b">
                        <span style="font-size:var(--type-label-md);padding:6px 12px;background:var(--md-tertiary-container);color:var(--md-on-tertiary-container);border-radius:var(--shape-full);font-weight:700;border:1px solid transparent;" x-text="b.name || b"></span>
                    </template>
                </div>
            </div>

            <!-- Data note — M3 Secondary Container -->
            <div style="display:flex;align-items:start;gap:8px;background:var(--md-secondary-container);border-radius:var(--shape-lg);padding:12px 14px;margin-bottom:24px;">
                <span style="font-size:var(--type-body-md);">💾</span>
                <span style="font-size:var(--type-label-md);color:var(--md-on-secondary-container);line-height:1.5;">データは長期的に見返せる形で保存され、地域の記録やレポート作成の参考に使えます</span>
            </div>

            <!-- Actions — M3 Buttons -->
            <div style="display:flex;flex-direction:column;gap:10px;">
                <a :href="'post.php?return=field_research.php&from=walk_report'"
                   style="display:block;text-align:center;padding:14px;border-radius:var(--shape-full);border:none;background:var(--md-tertiary-container);color:var(--md-on-tertiary-container);font-size:var(--type-label-lg);font-weight:700;text-decoration:none;box-shadow:var(--elev-1);">
                    📸 ベスト写真を投稿する
                </a>
                <div style="display:flex;gap:10px;">
                    <button @click="showReport=false" style="flex:1;padding:14px;border-radius:var(--shape-full);border:1.5px solid var(--md-outline);background:transparent;color:var(--md-on-surface);font-size:var(--type-label-lg);font-weight:700;cursor:pointer;">
                        🗺️ マップに戻る
                    </button>
                    <button @click="showReport=false;startSensor()" style="flex:1;padding:14px;border-radius:var(--shape-full);border:none;background:var(--md-primary);color:var(--md-on-primary);font-size:var(--type-label-lg);font-weight:700;cursor:pointer;box-shadow:var(--elev-1);">
                        🔄 もう一回
                    </button>
                </div>
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
    <?php $jsBust = filemtime(__FILE__); ?>
    <script src="js/StepCounter.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/OfflineMapManager.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/FieldRecorder.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/ExplorationMap.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/SiteGuide.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/LiveScanner.js?v=<?= $jsBust ?>" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="assets/js/VoiceGuide.js?v=<?= filemtime(PUBLIC_DIR . '/assets/js/VoiceGuide.js') ?>" nonce="<?= CspNonce::attr() ?>"></script>
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
                reportLoading: false,
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

                // Speaker selection
                showSensorIntro: !localStorage.getItem('ikimon_sensor_intro_v1'),
                introStep: 1,
                showSpeakerSelect: true,
                showVoiceSwitch: false,
                showDriveVoiceSwitch: false,
                driveDurationMin: parseInt(localStorage.getItem('ikimon_drive_duration') || '0'),
                guideMood: localStorage.getItem('ikimon_guide_mood') || 'relax',
                selectedSpeaker: localStorage.getItem('ikimon_voice_speaker') || localStorage.getItem('ikimon_speaker') || 'gemini-bright',
                speakers: [
                    { id: 'gemini-bright', label: '女性', emoji: '👩' },
                    { id: 'gemini-calm', label: '男性', emoji: '👨' },
                    { id: 'zundamon', label: 'ずんだもん', emoji: '🟢' },
                    { id: 'duo-zundamon-mochiko', label: 'ずんだ×もち子', emoji: '🎙️' },
                    { id: 'duo-zundamon-ryusei', label: 'ずんだ×龍星', emoji: '🎙️' },
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

                    // Migrate legacy speaker settings to gemini-bright
                    const _savedSpeaker = localStorage.getItem('ikimon_voice_speaker');
                    if (!_savedSpeaker || _savedSpeaker === 'auto' || _savedSpeaker === 'standard' || _savedSpeaker === 'bluetooth') {
                        localStorage.setItem('ikimon_voice_speaker', 'gemini-bright');
                        localStorage.setItem('ikimon_voice_output', 'bluetooth');
                        this.selectedSpeaker = 'gemini-bright';
                        if (window.VoiceGuide) {
                            VoiceGuide.setVoiceMode('gemini-bright');
                        }
                    }

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
                    // 初回は5秒後に発火（体験の早期スタート）、以降は通常間隔
                    this._ambientFirstFired = false;
                    setTimeout(() => {
                        if (this.sessionActive && !this._ambientFirstFired) {
                            this._ambientFirstFired = true;
                            this._fireAmbientGuide();
                        }
                    }, 5000);
                    this._ambientTimer = setInterval(() => this._fireAmbientGuide(), ambientIntervalMs);

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
                        },
                        onLog: () => {},
                        onGpsUpdate: (pos) => {
                            this.gpsAccuracy = Math.round(pos.accuracy);
                            if (pos.accuracy <= 50 && this.explorationMap) {
                                this.explorationMap.addExploredPoint(pos.lat, pos.lng, null);
                            }
                            // GPS取得後すぐに場所のトリビアを読み上げ（初回1回だけ）
                            // accuracy 500m以内なら起動（室内でも動作）、精度が低い場合は位置が大まかになるだけ
                            if (!this._quickStartDone && pos.accuracy <= 500 && window.VoiceGuide && VoiceGuide.isEnabled()) {
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

                    // Enable VoiceGuide + unlock audio (must happen in user gesture context)
                    if (window.VoiceGuide) {
                        window._vgDebug = VoiceGuide._debugToast;
                        VoiceGuide._debugToast('🚀 startSensor speaker=' + this.selectedSpeaker);
                        VoiceGuide.setVoiceMode(this.selectedSpeaker);
                        VoiceGuide.setEnabled(true);
                        VoiceGuide.unlockAudio();
                        if ('speechSynthesis' in window) {
                            const unlock = new SpeechSynthesisUtterance('');
                            unlock.volume = 0;
                            speechSynthesis.speak(unlock);
                        }
                    }

                    const modeLabel = this.manualTransportMode === 'car' ? 'ドライブ' : this.manualTransportMode === 'bike' ? 'サイクリング' : 'フィールドサーチ';
                    VoiceGuide.announce(modeLabel + '、スタート！周りの生き物を探していくよ。');

                    this._sendLog('🔊 ON mode=' + (window.VoiceGuide ? VoiceGuide.getVoiceMode() : 'none'));
                },

                async stopSensor() {
                    this.sessionActive = false;
                    if (this._sessionTimer) { clearInterval(this._sessionTimer); this._sessionTimer = null; }
                    if (this._ambientTimer) { clearInterval(this._ambientTimer); this._ambientTimer = null; }

                    if (window.VoiceGuide) {
                        VoiceGuide.stop();
                        VoiceGuide.setEnabled(false);
                    }

                    // 即座にレポート画面を表示（データはあとから埋まる）
                    this.reportData = {
                        duration: this.sessionElapsed,
                        distance: this.sessionDistance,
                        speciesCount: this.sessionSpeciesCount,
                        species: this.sessionDetections.map(d => ({
                            name: d.japanese_name || d.label, count: 1,
                            confidence: d.confidence_raw || 0.5,
                            source: d.source, category: d.category, note: d.note
                        })),
                        recap: null, natureScore: null,
                        locationName: new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' }),
                    };
                    this.reportLoading = true;
                    this.showReport = true;

                    // バックグラウンドで詳細データを取得
                    let result = null;
                    if (this.liveScanner) {
                        result = await this.liveScanner.stop();
                        this.liveScanner = null;
                    }

                    if (result) {
                        this.reportData = {
                            ...this.reportData,
                            ...result,
                            locationName: this.reportData.locationName,
                        };
                    }

                    // NatureScore + recap を並列取得
                    const [natureScore] = await Promise.all([
                        (async () => {
                            try {
                                const r = await fetch('/api/v2/nature_score.php', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        species_count: this.reportData.speciesCount,
                                        duration_sec: this.reportData.duration,
                                        distance_m: this.reportData.distance,
                                        area_type: result?.envHistory?.[0]?.habitat || 'unknown',
                                    })
                                });
                                if (r.ok) { const j = await r.json(); return j.success ? j.data : null; }
                            } catch (e) {}
                            return null;
                        })(),
                    ]);

                    this.reportData.natureScore = natureScore;
                    if (result?.recap) this.reportData.recap = result.recap;
                    this.reportLoading = false;

                    this._saveWeeklySession(this.reportData);
                    this._loadWeeklyStats();
                },

                async _fireAmbientGuide() {
                    if (!window.VoiceGuide || !VoiceGuide.isEnabled()) return;
                    if (VoiceGuide.isSpeaking()) return;

                    if (this._driveTotalMin > 0) {
                        const elapsedMin = (this.sessionElapsed || 0) / 60;
                        if (elapsedMin >= this._driveTotalMin - 2 && !this._closingTriggered) {
                            this._closingTriggered = true;
                            this.stopSensor();
                            return;
                        }
                    }

                    if (VoiceGuide.drainAmbientQueue) {
                        VoiceGuide.drainAmbientQueue();
                        if (VoiceGuide.isSpeaking()) return;
                    }

                    const gpsPos = this.liveScanner?.lastGpsPos;
                    if (!gpsPos) return;

                    const detected = this.sessionDetections.map(d => d.japanese_name || d.label).filter(Boolean);
                    const uniqueDetected = [...new Set(detected)].slice(0, 10).join(',');
                    const transportMode = this.manualTransportMode || (this.currentMovementMode === 'drive' ? 'car' : this.currentMovementMode) || 'walk';

                    try {
                        const params = new URLSearchParams({
                            mode: 'ambient',
                            lat: gpsPos.lat, lng: gpsPos.lng,
                            detected_species: uniqueDetected,
                            voice_mode: VoiceGuide.getVoiceMode(),
                            transport_mode: transportMode,
                            elapsed_min: Math.round((this.sessionElapsed || 0) / 60),
                            session_count: this._ambientGuideCount,
                            drive_total_min: this._driveTotalMin || 0,
                            guide_mood: this.guideMood || 'relax',
                        });
                        const resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
                        if (!resp.ok) return;
                        const json = await resp.json();
                        if (json.success && json.data) {
                            if (VoiceGuide.isSpeaking()) return;
                            this._ambientGuideCount++;
                            if (json.data.audio_url) {
                                VoiceGuide.announceAudio(json.data.audio_url, (json.data.guide_text || '').replace(/【[^】]+】\s*/g, '') || null);
                            } else if (json.data.guide_text) {
                                VoiceGuide.announce((json.data.guide_text || '').replace(/【[^】]+】\s*/g, ''));
                            }
                        }
                    } catch(e) { /* ignore */ }
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
                            // skip
                        } else if (elapsed < 25000 && !isFirst) {
                            // skip
                        } else if (!isFirst && this._detCountToday[key] > 3) {
                            // skip
                        } else {
                            this._lastVoiceTime = now;
                            this._fetchVoiceGuide(jaName, detection.scientific_name, detection.confidence_raw || 0.5, this._detCountToday[key], isFirst)
                                .then(res => {
                                    if (!res) return;
                                    if (res.audio_url) {
                                        VoiceGuide.announceAudio(res.audio_url, (res.guide_text || '').replace(/【[^】]+】\s*/g, '') || null);
                                    } else if (res.guide_text) {
                                        VoiceGuide.announce((res.guide_text || '').replace(/【[^】]+】\s*/g, ''));
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
                    if (!window.VoiceGuide) { if(VoiceGuide._debugToast) VoiceGuide._debugToast('⚠️ VG not loaded'); return; }
                    if (!VoiceGuide.isEnabled()) { if(VoiceGuide._debugToast) VoiceGuide._debugToast('⚠️ VG disabled'); return; }
                    try {
                        const vm = VoiceGuide.getVoiceMode();
                        if(window._vgDebug) window._vgDebug('🌅 Opening fetch vm=' + vm);
                        const transportMode = this.manualTransportMode || 'walk';
                        const params = new URLSearchParams({
                            mode: 'opening',
                            lat, lng,
                            voice_mode: vm,
                            transport_mode: transportMode,
                        });
                        const resp = await fetch('/api/v2/voice_guide.php?' + params.toString());
                        if (!resp.ok) { if(window._vgDebug) window._vgDebug('❌ Opening HTTP ' + resp.status); return; }
                        const json = await resp.json();
                        if (json.success && json.data) {
                            if(window._vgDebug) window._vgDebug('✅ Opening: audio=' + (json.data.audio_url ? 'YES' : 'NO') + ' text=' + (json.data.guide_text ? json.data.guide_text.length + 'chars' : 'NO'));
                            if (json.data.audio_url) {
                                VoiceGuide.announceAudio(json.data.audio_url, (json.data.guide_text || '').replace(/【[^】]+】\s*/g, '') || null);
                            } else if (json.data.guide_text) {
                                VoiceGuide.announce((json.data.guide_text || '').replace(/【[^】]+】\s*/g, ''));
                            }
                        }
                    } catch(e) {
                        if(window._vgDebug) window._vgDebug('❌ Opening err: ' + e.message);
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

                nextIntroStep() {
                    if (this.introStep < 3) {
                        this.introStep++;
                    } else {
                        localStorage.setItem('ikimon_sensor_intro_v1', '1');
                        this.showSensorIntro = false;
                    }
                },

                skipIntro() {
                    localStorage.setItem('ikimon_sensor_intro_v1', '1');
                    this.showSensorIntro = false;
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
