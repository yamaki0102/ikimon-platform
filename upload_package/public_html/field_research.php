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
        body, html { height: 100%; margin: 0; overflow: hidden; font-family: var(--font-body); }
        #map { width: 100%; height: 100%; }

        /* ── M3 Glass Panel ── */
        .glass {
            background: var(--glass-surface-heavy);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            border: none;
            border-radius: var(--md-sys-shape-corner-extra-large);
            box-shadow: var(--md-sys-elevation-1);
        }

        /* ── M3 Top App Bar ── */
        .top-bar {
            position: absolute; top: 0; left: 0; right: 0; z-index: 20;
            background: var(--glass-surface-heavy);
            backdrop-filter: blur(var(--glass-blur));
            -webkit-backdrop-filter: blur(var(--glass-blur));
            padding: var(--space-3) var(--space-5);
            padding-top: calc(var(--safe-top) + var(--space-3));
            display: flex; align-items: center; justify-content: space-between;
        }
        .top-bar a { color: var(--md-sys-color-on-surface); text-decoration: none; font-size: var(--md-sys-typescale-body-medium-size); font-weight: 500; display: flex; align-items: center; gap: var(--space-2); }
        .top-bar a i { color: var(--md-sys-color-primary); }
        .top-bar-title { font-size: var(--md-sys-typescale-title-medium-size); font-weight: 600; color: var(--md-sys-color-on-surface); letter-spacing: -0.02em; }

        /* ── M3 Stats Panel ── */
        .stats-panel {
            position: absolute; top: calc(var(--safe-top) + 56px); left: var(--space-3); z-index: 15;
            padding: var(--space-3) var(--space-4);
            display: flex; flex-direction: column; gap: var(--space-1);
            min-width: 130px;
        }
        .stats-panel .stat-row { display: flex; align-items: baseline; gap: 6px; }
        .stats-panel .stat-value { font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; color: var(--md-sys-color-on-surface); }
        .stats-panel .stat-label { font-size: var(--md-sys-typescale-label-small-size); color: var(--color-text-faint); font-weight: 500; letter-spacing: var(--tracking-wide); }
        .stats-panel .stat-value.highlight { color: var(--color-primary-dark); }

        /* ── M3 Period Filter ── */
        .period-bar {
            position: absolute; top: calc(var(--safe-top) + 56px); left: 164px; z-index: 15;
            padding: var(--space-1);
            display: flex; gap: var(--space-1);
        }
        .period-btn {
            border: none; background: none; padding: var(--space-2) var(--space-3); border-radius: var(--md-sys-shape-corner-full);
            font-size: var(--md-sys-typescale-body-medium-size); font-weight: 500; color: var(--md-sys-color-on-surface-variant); cursor: pointer;
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
        }
        .period-btn:hover { background: var(--color-primary-surface); }
        .period-btn.active { background: var(--color-primary-dark); color: var(--md-sys-color-on-primary); box-shadow: var(--shadow-primary-sm); }

        /* ── M3 Bottom Action Bar ── */
        .bottom-bar {
            position: absolute; bottom: max(var(--space-6), calc(var(--safe-bottom) + var(--space-4))); left: 50%; transform: translateX(-50%); z-index: 20;
            display: flex; gap: var(--space-3); align-items: center;
            padding: var(--space-2) var(--space-3);
        }
        .action-btn {
            width: var(--touch-fab); height: var(--touch-fab); border-radius: calc(var(--touch-fab) / 2); border: none;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: var(--md-sys-typescale-label-small-size); font-weight: 500; cursor: pointer;
            box-shadow: var(--md-sys-elevation-1);
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
            text-decoration: none;
        }
        .action-btn:active { transform: scale(0.92); }
        .action-btn i { margin-bottom: 2px; }
        .btn-observe { background: var(--md-sys-color-tertiary); color: var(--md-sys-color-on-tertiary); }
        .btn-locate { background: var(--md-sys-color-surface-bright); color: var(--color-primary-dark); width: var(--touch-comfortable); height: var(--touch-comfortable); border-radius: calc(var(--touch-comfortable) / 2); }

        /* ── GPS Status ── */
        .gps-dot { width: 8px; height: 8px; border-radius: 50%; animation: gps-pulse 2s ease-in-out infinite; }
        .gps-dot.good { background: var(--md-sys-color-primary); }
        .gps-dot.fair { background: var(--md-sys-color-tertiary); }
        .gps-dot.poor { background: var(--md-sys-color-error); }
        .gps-dot.off  { background: var(--md-sys-color-surface-dim); animation: none; }
        @keyframes gps-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── M3 Layer Toggle ── */
        .layer-btn {
            position: absolute; top: calc(var(--safe-top) + 56px); right: var(--space-3); z-index: 15;
            width: var(--touch-comfortable); height: var(--touch-comfortable);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
            border-radius: calc(var(--touch-comfortable) / 2);
        }
        .layer-sheet {
            position: absolute; top: calc(var(--safe-top) + 110px); right: var(--space-3); z-index: 15;
            padding: var(--space-4) var(--space-5); min-width: 220px;
        }
        .layer-sheet h4 { margin: 0 0 var(--space-3); font-size: var(--md-sys-typescale-label-medium-size); color: var(--color-text-faint); font-weight: 600; letter-spacing: var(--tracking-wide); text-transform: uppercase; }
        .layer-item {
            display: flex; align-items: center; gap: var(--space-3);
            padding: var(--space-3) 0; border-bottom: 1px solid var(--md-sys-color-outline-variant);
            font-size: var(--md-sys-typescale-body-medium-size); font-weight: 500; color: var(--md-sys-color-on-surface); cursor: pointer;
        }
        .layer-item:last-child { border-bottom: none; }
        .layer-toggle {
            width: 44px; height: 24px; border-radius: 12px; border: none;
            position: relative; cursor: pointer; transition: background var(--md-sys-motion-duration-medium1) var(--md-sys-motion-easing-standard);
        }
        .layer-toggle.on { background: var(--color-primary-dark); }
        .layer-toggle.off { background: var(--md-sys-color-surface-dim); }
        .layer-toggle::after {
            content: ''; position: absolute; top: 2px; width: 20px; height: 20px;
            border-radius: 50%; background: #fff; transition: left var(--md-sys-motion-duration-medium1) var(--md-sys-motion-easing-standard);
            box-shadow: var(--md-sys-elevation-1);
        }
        .layer-toggle.on::after { left: 22px; }
        .layer-toggle.off::after { left: 2px; }

        /* ── M3 Loading ── */
        .loading-bar {
            position: absolute; top: calc(var(--safe-top) + 48px); left: 0; right: 0; height: 3px; z-index: 30;
            background: linear-gradient(90deg, transparent, var(--color-primary-dark), transparent);
            animation: loading-slide 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* ── M3 Sensor Bottom Sheet ── */
        .sensor-sheet {
            position: absolute; bottom: max(var(--space-4), var(--safe-bottom)); left: 50%; transform: translateX(-50%); z-index: 25;
            width: calc(100% - var(--space-8)); max-width: 400px;
        }
        .sensor-sheet-inner {
            background: var(--glass-surface-heavy);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border-radius: var(--radius-2xl);
            box-shadow: var(--md-sys-elevation-2);
            overflow: hidden;
            transition: max-height var(--md-sys-motion-duration-medium4) var(--md-sys-motion-easing-emphasized-decelerate);
        }
        .sensor-sheet .drag-handle {
            width: 32px; height: 4px; border-radius: 2px; background: var(--md-sys-color-outline);
            margin: var(--space-2) auto var(--space-3);
        }
        .sheet-section { padding: 0 var(--space-5); margin-bottom: var(--space-4); }
        .sheet-section:last-child { margin-bottom: var(--space-5); }
        .sheet-label { font-size: var(--md-sys-typescale-label-medium-size); color: var(--md-sys-color-on-surface-variant); font-weight: 500; margin-bottom: var(--space-2); }

        /* ── M3 Segmented Button ── */
        .m3-segmented {
            display: flex; border-radius: var(--md-sys-shape-corner-full); background: var(--md-sys-color-surface-container); padding: var(--space-1); gap: var(--space-1);
        }
        .m3-segmented button {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 10px var(--space-1); border-radius: var(--md-sys-shape-corner-full); border: none;
            font-size: var(--md-sys-typescale-label-large-size); font-weight: 600; cursor: pointer;
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
            background: transparent; color: var(--md-sys-color-on-surface-variant);
        }
        .m3-segmented button.active {
            background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
            box-shadow: var(--md-sys-elevation-1);
        }
        .m3-segmented button span { pointer-events: none; }

        /* ── M3 Chip Group ── */
        .m3-chips { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
        .m3-chips::-webkit-scrollbar { display: none; }
        .m3-chip {
            padding: var(--space-2) var(--space-3); border-radius: var(--md-sys-shape-corner-full); border: 1.5px solid var(--md-sys-color-outline-variant);
            background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface-variant);
            font-size: var(--md-sys-typescale-label-medium-size); font-weight: 500; cursor: pointer; white-space: nowrap;
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
        }
        .m3-chip.active {
            background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
            border-color: var(--md-sys-color-primary);
        }

        /* ── M3 Switch ── */
        .m3-switch {
            width: 100%; padding: 10px var(--space-4); border-radius: var(--md-sys-shape-corner-full); border: 1.5px solid var(--md-sys-color-outline-variant);
            background: var(--md-sys-color-surface-container-low); color: var(--color-text-faint);
            font-size: var(--md-sys-typescale-body-medium-size); font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
        }
        .m3-switch.active {
            background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);
            border-color: var(--md-sys-color-primary);
        }

        /* ── M3 Extended FAB ── */
        .m3-fab-extended {
            width: 100%; padding: var(--space-4); border-radius: var(--md-sys-shape-corner-full); border: none;
            background: var(--color-primary-dark); color: var(--md-sys-color-on-primary);
            font-size: var(--md-sys-typescale-title-medium-size); font-weight: 600; cursor: pointer;
            display: flex; align-items: center; justify-content: center; gap: var(--space-2);
            box-shadow: var(--shadow-primary); letter-spacing: -0.01em;
            transition: all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
        }
        .m3-fab-extended:active { transform: scale(0.97); }

        /* ── Mobile ── */
        @media (max-width: 640px) {
            .top-bar { padding: var(--space-3) var(--space-4); padding-top: calc(var(--safe-top) + var(--space-3)); }
            .stats-panel { top: calc(var(--safe-top) + 52px); left: var(--space-2); padding: var(--space-3); min-width: 110px; }
            .stats-panel .stat-value { font-size: 0.95rem; }
            .period-bar { position: fixed; top: auto; bottom: max(88px, calc(var(--safe-bottom) + 72px)); left: 50%; transform: translateX(-50%); }
            .layer-btn { top: calc(var(--safe-top) + 52px); }
            .layer-sheet { top: calc(var(--safe-top) + 104px); }
            .sensor-sheet { width: calc(100% - var(--space-4)); max-width: none; }
            .bottom-bar { bottom: max(var(--space-4), calc(var(--safe-bottom) + var(--space-2))); }
        }
        @media (max-width: 380px) {
            .stats-panel { min-width: 90px; padding: var(--space-2); }
            .stats-panel .stat-value { font-size: 0.85rem; }
            .period-btn { padding: 6px 10px; font-size: var(--md-sys-typescale-label-small-size); }
        }

        /* ── Site Guide Toast ── */
        .site-guide-toast {
            position: absolute; bottom: max(100px, calc(var(--safe-bottom) + 88px));
            left: 50%; transform: translateX(-50%); z-index: 25;
            max-width: 360px; width: calc(100% - var(--space-8));
            animation: sgt-slide-up 0.4s var(--md-sys-motion-spring-bouncy);
        }
        .sgt-inner {
            background: var(--glass-surface-heavy); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
            border: 1px solid var(--color-primary-glow); border-radius: var(--md-sys-shape-corner-medium);
            box-shadow: var(--md-sys-elevation-2);
            padding: var(--space-3); display: flex; align-items: center; gap: 10px; cursor: pointer;
            transition: transform var(--duration-fast);
        }
        .sgt-inner:active { transform: scale(0.97); }
        .sgt-icon { width: 36px; height: 36px; border-radius: var(--md-sys-shape-corner-small); background: var(--color-primary-surface); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sgt-title { font-size: var(--md-sys-typescale-body-medium-size); font-weight: 700; color: var(--md-sys-color-on-surface); }
        .sgt-sub { font-size: var(--md-sys-typescale-label-small-size); color: var(--color-text-muted); margin-top: 1px; }
        .sgt-text { flex: 1; min-width: 0; }
        @keyframes sgt-slide-up { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        /* ── Site Guide Panel ── */
        .site-guide-panel {
            position: absolute; top: 0; right: 0; z-index: 30;
            width: min(400px, 100%); height: 100vh; height: 100dvh;
            background: var(--md-sys-color-surface-bright);
            box-shadow: var(--md-sys-elevation-3);
            transform: translateX(100%); transition: transform var(--duration-normal) var(--ease-default);
            flex-direction: column;
        }
        .site-guide-panel.open { transform: translateX(0); }
        .sgp-header {
            padding: var(--space-4) var(--space-4) var(--space-3); border-bottom: 1px solid var(--md-sys-color-outline-variant);
            display: flex; align-items: flex-start; gap: var(--space-3); flex-shrink: 0;
            background: linear-gradient(135deg, var(--color-primary-surface), var(--color-secondary-surface));
        }
        .sgp-close { position: absolute; top: var(--space-3); right: var(--space-3); background: none; border: none; cursor: pointer; padding: var(--space-1); border-radius: var(--md-sys-shape-corner-small); color: var(--color-text-faint); }
        .sgp-close:hover { background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface-variant); }
        .sgp-title { font-size: var(--md-sys-typescale-title-small-size); font-weight: 800; color: var(--md-sys-color-on-surface); margin: 0; padding-right: var(--space-8); }
        .sgp-subtitle { font-size: var(--md-sys-typescale-body-small-size); color: var(--color-text-muted); margin: var(--space-1) 0 0; }
        .sgp-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
        .sgp-section { padding: var(--space-4); border-bottom: 1px solid var(--md-sys-color-outline-variant); }
        .sgp-section-title { font-size: var(--md-sys-typescale-body-medium-size); font-weight: 700; color: var(--md-sys-color-on-surface); margin: 0 0 10px; display: flex; align-items: center; gap: 6px; }
        .sgp-welcome p { font-size: var(--md-sys-typescale-body-medium-size); line-height: 1.7; color: var(--md-sys-color-on-surface-variant); margin: 0; }
        .sgp-highlights { display: flex; flex-direction: column; gap: 6px; }
        .sgp-highlight-item { font-size: var(--md-sys-typescale-body-small-size); color: var(--md-sys-color-on-surface-variant); padding: 6px 10px; background: var(--color-primary-surface); border-radius: var(--md-sys-shape-corner-small); border-left: 3px solid var(--md-sys-color-primary); }
        .sgp-season { background: linear-gradient(135deg, var(--color-accent-surface), rgba(245,158,11,0.06)); }
        .sgp-season-desc { font-size: var(--md-sys-typescale-body-small-size); line-height: 1.6; color: var(--md-sys-color-on-surface-variant); margin: 0; }
        .sgp-routes { display: flex; flex-direction: column; gap: var(--space-2); }
        .sgp-route-card { padding: 10px var(--space-3); border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); }
        .sgp-route-name { font-size: var(--md-sys-typescale-body-medium-size); font-weight: 700; color: var(--md-sys-color-on-surface); }
        .sgp-route-meta { display: flex; gap: var(--space-2); margin-top: var(--space-1); font-size: var(--md-sys-typescale-label-small-size); color: var(--color-text-faint); }
        .sgp-route-diff { background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container); padding: 1px 6px; border-radius: var(--md-sys-shape-corner-extra-small); font-weight: 600; }
        .sgp-route-desc { font-size: var(--md-sys-typescale-body-small-size); color: var(--color-text-muted); margin: 6px 0 0; line-height: 1.5; }
        .sgp-pois { display: flex; flex-direction: column; gap: 6px; }
        .sgp-poi-card { border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); overflow: hidden; cursor: pointer; transition: border-color var(--duration-fast); }
        .sgp-poi-card:hover, .sgp-poi-card.expanded { border-color: var(--md-sys-color-primary); }
        .sgp-poi-header { display: flex; align-items: center; gap: 10px; padding: 10px var(--space-3); }
        .sgp-poi-emoji { font-size: 22px; flex-shrink: 0; }
        .sgp-poi-titles { flex: 1; min-width: 0; }
        .sgp-poi-name { font-size: var(--md-sys-typescale-body-medium-size); font-weight: 700; color: var(--md-sys-color-on-surface); display: flex; align-items: center; gap: 6px; }
        .sgp-poi-badge { font-size: var(--md-sys-typescale-label-small-size); font-weight: 700; background: var(--md-sys-color-tertiary-container); color: var(--md-sys-color-on-tertiary-container); padding: 1px 6px; border-radius: var(--md-sys-shape-corner-extra-small); }
        .sgp-poi-short { font-size: var(--md-sys-typescale-label-medium-size); color: var(--color-text-muted); margin-top: 2px; line-height: 1.4; }
        .sgp-poi-chevron { transition: transform var(--duration-fast); }
        .sgp-poi-card.expanded .sgp-poi-chevron { transform: rotate(180deg); }
        .sgp-poi-detail { max-height: 0; overflow: hidden; transition: max-height var(--duration-normal) var(--ease-default); }
        .sgp-poi-card.expanded .sgp-poi-detail { max-height: 800px; }
        .sgp-poi-long { padding: 0 var(--space-3) var(--space-2); }
        .sgp-poi-long p { font-size: var(--md-sys-typescale-body-small-size); line-height: 1.7; color: var(--md-sys-color-on-surface-variant); margin: 0 0 var(--space-2); }
        .sgp-poi-tips { padding: var(--space-2) var(--space-3); background: var(--color-secondary-surface); margin: 0 var(--space-2) var(--space-2); border-radius: var(--md-sys-shape-corner-small); }
        .sgp-poi-tips strong { font-size: var(--md-sys-typescale-body-small-size); color: var(--md-sys-color-on-surface); }
        .sgp-tip { font-size: var(--md-sys-typescale-label-medium-size); color: var(--color-text-muted); margin-top: var(--space-1); padding-left: var(--space-2); border-left: 2px solid var(--color-secondary-surface); }
        .sgp-poi-season { font-size: var(--md-sys-typescale-label-medium-size); color: var(--color-text-muted); padding: var(--space-1) var(--space-3) var(--space-2); }
        .sgp-poi-trivia { font-size: var(--md-sys-typescale-label-medium-size); color: #7c3aed; background: rgba(124,58,237,0.04); padding: var(--space-2) var(--space-3); margin: 0 var(--space-2) var(--space-3); border-radius: var(--md-sys-shape-corner-small); line-height: 1.5; }
        .sgp-poi-read { opacity: 0.65; }
        .sgp-poi-read:hover, .sgp-poi-read.expanded { opacity: 1; }
        .sgp-poi-new { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
        .sgp-poi-unread { border-left: 3px solid var(--md-sys-color-primary); }
        .sgp-story-body p { font-size: var(--md-sys-typescale-body-small-size); line-height: 1.7; color: var(--md-sys-color-on-surface-variant); margin: 0 0 10px; }
        .sgp-story { background: linear-gradient(135deg, var(--color-primary-surface), rgba(34,197,94,0.03)); }
        .sgp-link { display: inline-block; font-size: var(--md-sys-typescale-body-small-size); color: var(--md-sys-color-primary); font-weight: 600; text-decoration: none; margin-bottom: 6px; }
        .sgp-link:hover { text-decoration: underline; }
        .sgp-info-row { font-size: var(--md-sys-typescale-body-small-size); color: var(--color-text-muted); margin-bottom: var(--space-1); }
        .sgp-notes { margin: var(--space-2) 0 0; padding-left: 18px; }
        .sgp-notes li { font-size: var(--md-sys-typescale-label-medium-size); color: var(--color-text-muted); margin-bottom: 3px; line-height: 1.5; }
        .btn-guide { background: var(--md-sys-color-primary); color: var(--md-sys-color-on-primary); }
        .btn-guide.inactive { background: var(--md-sys-color-surface-bright); color: var(--color-text-muted); border: 1px solid var(--md-sys-color-outline-variant); }

        /* ── Scrollbar hide utility ── */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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

    <!-- Sensor Bottom Sheet (Progressive Disclosure) -->
    <div x-show="!sessionActive && showModeSelect" x-cloak class="sensor-sheet"
         @touchstart.passive="sheetTouchStart($event)" @touchmove.passive="sheetTouchMove($event)" @touchend="sheetTouchEnd($event)">
        <div class="sensor-sheet-inner" :style="'max-height:' + (sheetStage === 3 ? '90vh' : sheetStage === 2 ? '380px' : '180px')"
             style="overflow-y:auto;-webkit-overflow-scrolling:touch;">
            <!-- Drag Handle -->
            <div class="drag-handle" @click="sheetStage = sheetStage >= 3 ? 1 : sheetStage + 1" style="cursor:pointer;"></div>

            <!-- Stage 1: Transport + Start (always visible) -->
            <div class="sheet-section">
                <div class="m3-segmented">
                    <template x-for="tm in transportModes" :key="tm.id">
                        <button @click="manualTransportMode = tm.id; localStorage.setItem('ikimon_transport', tm.id)"
                                :class="manualTransportMode === tm.id ? 'active' : ''">
                            <span x-text="tm.emoji" class="text-lg"></span>
                            <span x-text="tm.label"></span>
                        </button>
                    </template>
                </div>
            </div>
            <div class="sheet-section" style="display:flex;align-items:center;gap:var(--space-3);">
                <button @click="startSensor()" class="m3-fab-extended" style="flex:1;">
                    <span class="text-lg">📡</span> センサーを開始
                </button>
                <button x-show="guideEnabled" x-cloak @click="sheetStage = 3; showSpeakerSelect = !showSpeakerSelect"
                        style="padding:var(--space-3);border-radius:var(--md-sys-shape-corner-large);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
                    <span class="text-lg" x-text="speakerEmoji"></span>
                    <span style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--color-primary-dark);"
                          x-text="speakers.find(s => s.id === selectedSpeaker)?.label || 'Auto'"></span>
                </button>
            </div>

            <!-- Stage 2: Destination + Voice Guide (expanded) -->
            <template x-if="sheetStage >= 2">
                <div>
                    <!-- Destination chips -->
                    <div class="sheet-section">
                        <div class="sheet-label">📍 どこへ行く？（任意）</div>
                        <div class="m3-chips no-scrollbar">
                            <button @click="destination = null; destinationName = ''"
                                    class="m3-chip" :class="!destination ? 'active' : ''">なし</button>
                            <template x-for="sp in savedPlaces" :key="sp.id">
                                <button @click="selectSavedPlace(sp)"
                                        class="m3-chip" :class="destination && destination.lat === sp.lat && destination.lng === sp.lng ? 'active' : ''">
                                    <span x-text="sp.icon" class="pointer-events-none"></span>
                                    <span x-text="sp.name" class="pointer-events-none"></span>
                                </button>
                            </template>
                        </div>
                        <!-- Selected destination display -->
                        <div x-show="destination" x-cloak style="margin-top:var(--space-2);display:flex;align-items:center;gap:6px;">
                            <span style="font-size:var(--md-sys-typescale-label-small-size);color:var(--color-primary-dark);font-weight:500;" x-text="'→ ' + destinationName"></span>
                            <button @click="destination = null; destinationName = ''" style="background:none;border:none;cursor:pointer;padding:2px;">
                                <i data-lucide="x" style="width:14px;height:14px;color:var(--color-text-faint);pointer-events:none;"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Voice guide toggle -->
                    <div class="sheet-section">
                        <button @click="toggleGuide()" class="m3-switch" :class="guideEnabled ? 'active' : ''">
                            <span x-text="guideEnabled ? '🔊' : '🔇'"></span>
                            <span x-text="guideEnabled ? '音声ガイド ON' : '音声ガイド OFF'"></span>
                        </button>
                    </div>
                </div>
            </template>

            <!-- Stage 3: Full options (destination input, mood, speakers, drive settings) -->
            <template x-if="sheetStage >= 3">
                <div>
                    <!-- Destination manual input -->
                    <div class="sheet-section">
                        <div style="display:flex;gap:6px;">
                            <div style="flex:1;position:relative;">
                                <input type="text" x-model="destinationName" @input.debounce.500ms="searchDestination()"
                                    placeholder="場所を入力..."
                                    style="width:100%;padding:10px var(--space-3);border-radius:var(--md-sys-shape-corner-medium);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);font-size:var(--md-sys-typescale-body-medium-size);outline:none;transition:border-color var(--md-sys-motion-duration-short4);"
                                    @focus="$el.style.borderColor='var(--color-primary-dark)'" @blur="$el.style.borderColor=''">
                                <div x-show="destSuggestions.length > 0" x-cloak @click.outside="destSuggestions = []"
                                    style="position:absolute;top:100%;left:0;right:0;margin-top:var(--space-1);background:var(--md-sys-color-surface-bright);border-radius:var(--md-sys-shape-corner-medium);box-shadow:var(--md-sys-elevation-2);z-index:50;max-height:200px;overflow-y:auto;">
                                    <template x-for="sug in destSuggestions" :key="sug.name">
                                        <button @click="setDestination(sug); destSuggestions = []"
                                            style="display:block;width:100%;padding:var(--space-3);text-align:left;border:none;background:none;cursor:pointer;font-size:var(--md-sys-typescale-body-medium-size);color:var(--md-sys-color-on-surface);border-bottom:1px solid var(--md-sys-color-outline-variant);">
                                            <span x-text="sug.icon + ' ' + sug.name"></span>
                                            <span x-show="sug.distance_km" style="font-size:var(--md-sys-typescale-label-small-size);color:var(--color-text-faint);margin-left:var(--space-2);" x-text="sug.distance_km.toFixed(1) + 'km'"></span>
                                        </button>
                                    </template>
                                </div>
                            </div>
                            <button @click="showPlaceManager = !showPlaceManager"
                                style="padding:10px;border-radius:var(--md-sys-shape-corner-medium);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low);cursor:pointer;display:flex;align-items:center;justify-content:center;"
                                title="場所を管理">
                                <i data-lucide="bookmark" style="width:18px;height:18px;color:var(--md-sys-color-on-surface-variant);pointer-events:none;"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Place manager -->
                    <div x-show="showPlaceManager" x-cloak class="sheet-section" style="background:var(--md-sys-color-surface-container-low);margin:0 var(--space-4) var(--space-4);border-radius:var(--md-sys-shape-corner-large);padding:var(--space-3);">
                        <div style="font-size:var(--md-sys-typescale-label-medium-size);font-weight:600;color:var(--md-sys-color-on-surface);margin-bottom:var(--space-2);display:flex;align-items:center;justify-content:space-between;">
                            <span>よく行く場所</span>
                            <button @click="showPlaceManager = false" style="background:none;border:none;cursor:pointer;padding:2px;">
                                <i data-lucide="x" style="width:16px;height:16px;color:var(--color-text-faint);pointer-events:none;"></i>
                            </button>
                        </div>
                        <div x-show="savedPlaces.length > 0" style="margin-bottom:var(--space-2);">
                            <template x-for="sp in savedPlaces" :key="sp.id">
                                <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-2) 0;border-bottom:1px solid var(--md-sys-color-outline-variant);">
                                    <span x-text="sp.icon" class="text-lg"></span>
                                    <div style="flex:1;min-width:0;">
                                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:500;color:var(--md-sys-color-on-surface);" x-text="sp.name"></div>
                                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:var(--color-text-faint);" x-text="sp.label || ''"></div>
                                    </div>
                                    <button @click="deleteSavedPlace(sp.id)"
                                        style="background:none;border:none;cursor:pointer;padding:var(--space-1);border-radius:var(--md-sys-shape-corner-small);">
                                        <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--color-text-faint);pointer-events:none;"></i>
                                    </button>
                                </div>
                            </template>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <select x-model="newPlaceIcon" style="padding:var(--space-2);border-radius:var(--md-sys-shape-corner-small);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-bright);font-size:16px;width:50px;">
                                <option value="🏠">🏠</option><option value="🏢">🏢</option><option value="🏫">🏫</option>
                                <option value="🏥">🏥</option><option value="🛒">🛒</option><option value="⛩️">⛩️</option>
                                <option value="🌳">🌳</option><option value="🏖️">🏖️</option><option value="📍">📍</option>
                            </select>
                            <input type="text" x-model="newPlaceName" placeholder="名前（自宅、会社…）"
                                style="flex:1;padding:var(--space-2) var(--space-3);border-radius:var(--md-sys-shape-corner-small);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-bright);font-size:var(--md-sys-typescale-body-medium-size);outline:none;">
                            <button @click="addCurrentLocationAsPlace()" :disabled="!newPlaceName.trim()"
                                :class="newPlaceName.trim() ? 'active' : ''" class="m3-chip" style="font-weight:600;">
                                現在地で登録
                            </button>
                        </div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:var(--color-text-faint);margin-top:6px;">今いる場所を登録します（最大20件）</div>
                    </div>

                    <!-- Guide mood -->
                    <div x-show="guideEnabled" x-cloak class="sheet-section">
                        <div class="sheet-label">🎭 ガイドの雰囲気</div>
                        <div class="m3-chips">
                            <template x-for="gm in [{id:'explore',label:'🌳 自然探索'},{id:'culture',label:'🏯 歴史文化'},{id:'relax',label:'🎧 おまかせ'}]" :key="gm.id">
                                <button @click="guideMood = gm.id; localStorage.setItem('ikimon_guide_mood', gm.id)"
                                        class="m3-chip" :class="guideMood === gm.id ? 'active' : ''"
                                        x-text="gm.label"></button>
                            </template>
                        </div>
                    </div>

                    <!-- Drive settings (car only) -->
                    <div x-show="manualTransportMode === 'car'" x-cloak class="sheet-section">
                        <div class="sheet-label">🚗 ドライブ時間</div>
                        <div class="m3-chips" style="margin-bottom:var(--space-3);">
                            <template x-for="dt in [{min:15,label:'15分'},{min:30,label:'30分'},{min:60,label:'1時間'},{min:0,label:'指定なし'}]" :key="dt.min">
                                <button @click="driveDurationMin = dt.min; localStorage.setItem('ikimon_drive_duration', dt.min)"
                                        class="m3-chip" :class="driveDurationMin === dt.min ? 'active' : ''"
                                        x-text="dt.label"></button>
                            </template>
                        </div>
                    </div>

                    <!-- Speaker selection -->
                    <div x-show="showSpeakerSelect && guideEnabled" x-cloak class="sheet-section">
                        <div class="sheet-label">🎧 一人で解説</div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:var(--space-2);margin-bottom:var(--space-3);">
                            <template x-for="sp in speakers.filter(s => !s.id.startsWith('duo-'))" :key="sp.id">
                                <button @click="selectedSpeaker = sp.id; showSpeakerSelect = false; localStorage.setItem('ikimon_speaker', sp.id); localStorage.setItem('ikimon_voice_speaker', sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                        class="m3-chip" :class="selectedSpeaker === sp.id ? 'active' : ''"
                                        style="display:flex;flex-direction:column;align-items:center;gap:var(--space-1);padding:var(--space-3) var(--space-2);">
                                    <span x-text="sp.emoji" class="text-xl"></span>
                                    <span x-text="sp.label" style="font-size:var(--md-sys-typescale-label-small-size);font-weight:500;"></span>
                                </button>
                            </template>
                        </div>
                        <div class="sheet-label">🎙️ 二人で掛け合い</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);">
                            <template x-for="sp in speakers.filter(s => s.id.startsWith('duo-'))" :key="sp.id">
                                <button @click="selectedSpeaker = sp.id; showSpeakerSelect = false; localStorage.setItem('ikimon_speaker', sp.id); localStorage.setItem('ikimon_voice_speaker', sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                        class="m3-chip" :class="selectedSpeaker === sp.id ? 'active' : ''"
                                        style="display:flex;align-items:center;justify-content:center;gap:var(--space-2);padding:var(--space-3);">
                                    <span x-text="sp.emoji" class="text-lg"></span>
                                    <span x-text="sp.label" style="font-weight:500;"></span>
                                </button>
                            </template>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="text-align:center;padding:0 var(--space-5) var(--space-4);">
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:var(--color-text-faint);line-height:1.5;">
                            BirdNET (CC BY-SA 4.0) · Perch v2 (Apache 2.0)
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>

    <!-- Drive Mode HUD — M3 Full-screen -->
    <div x-show="sessionActive && (currentMovementMode === 'drive' || manualTransportMode === 'car')" x-cloak
         style="position:fixed;inset:0;z-index:100;background:var(--md-sys-color-inverse-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:var(--safe-top) var(--space-4) var(--safe-bottom);">
        <div class="text-5xl mb-2">📡</div>
        <div style="color:var(--md-sys-color-primary);font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;margin-bottom:var(--space-5);">🚗 ドライブ記録中</div>

        <!-- Stats -->
        <div style="display:flex;gap:var(--space-8);margin-bottom:var(--space-6);">
            <div style="text-align:center;">
                <div style="color:var(--md-sys-color-inverse-on-surface);font-size:var(--text-2xl);font-weight:900;font-family:var(--font-heading);" x-text="sessionSpeciesCount">0</div>
                <div style="color:var(--md-sys-color-inverse-primary);font-size:var(--md-sys-typescale-label-small-size);font-weight:600;letter-spacing:var(--tracking-wide);">種</div>
            </div>
            <div style="text-align:center;">
                <div style="color:var(--md-sys-color-inverse-on-surface);font-size:var(--text-2xl);font-weight:900;font-family:var(--font-heading);" x-text="sessionFamilyCount">0</div>
                <div style="color:var(--md-sys-color-inverse-primary);font-size:var(--md-sys-typescale-label-small-size);font-weight:600;letter-spacing:var(--tracking-wide);">科</div>
            </div>
            <div style="text-align:center;">
                <div style="color:var(--md-sys-color-inverse-on-surface);font-size:var(--text-2xl);font-weight:900;font-family:var(--font-heading);" x-text="Object.keys(sessionHigherGroups).length">0</div>
                <div style="color:var(--md-sys-color-inverse-primary);font-size:var(--md-sys-typescale-label-small-size);font-weight:600;letter-spacing:var(--tracking-wide);">分類群</div>
            </div>
        </div>

        <!-- Data progress -->
        <div style="margin-bottom:var(--space-4);width:200px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-1);">
                <span style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:rgba(255,255,255,0.5);">データ蓄積</span>
                <span style="font-size:var(--md-sys-typescale-label-medium-size);font-weight:700;color:var(--md-sys-color-inverse-primary);" x-text="sessionDataScore + ' pt'"></span>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:var(--md-sys-shape-corner-full);overflow:hidden;">
                <div style="height:100%;border-radius:var(--md-sys-shape-corner-full);background:var(--md-sys-color-primary);transition:width var(--md-sys-motion-duration-long2) var(--md-sys-motion-easing-emphasized-decelerate);"
                     :style="'width:' + Math.min(100, sessionDataScore) + '%'"></div>
            </div>
        </div>
        <div style="color:rgba(255,255,255,0.4);font-size:var(--md-sys-typescale-body-medium-size);" x-text="(sessionDistance / 1000).toFixed(1) + 'km · ' + formatElapsed(sessionElapsed)"></div>

        <!-- Higher group chips -->
        <div x-show="Object.keys(sessionHigherGroups).length > 0" x-cloak style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--space-4);justify-content:center;max-width:300px;">
            <template x-for="[group, count] in Object.entries(sessionHigherGroups)" :key="group">
                <span style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;padding:var(--space-1) var(--space-3);border-radius:var(--md-sys-shape-corner-full);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);"
                      x-text="group + ' ' + count"></span>
            </template>
        </div>

        <!-- Guide + voice controls -->
        <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-5);">
            <button @click="toggleGuide()"
                    :style="guideEnabled ? 'border-color:var(--md-sys-color-tertiary);background:rgba(245,158,11,0.15);color:var(--md-sys-color-inverse-primary);' : 'border-color:rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);'"
                    style="padding:var(--space-2) var(--space-4);border-radius:var(--md-sys-shape-corner-full);border:1px solid;font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;cursor:pointer;min-height:var(--touch-min);transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
                <span x-text="guideEnabled ? '🔊 ON' : '🔇 OFF'"></span>
            </button>
        </div>
        <div style="position:relative;margin-top:var(--space-2);" x-show="guideEnabled">
            <button @click="showDriveVoiceSwitch = !showDriveVoiceSwitch"
                    style="padding:var(--space-2) var(--space-5);border-radius:var(--md-sys-shape-corner-full);border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;cursor:pointer;min-height:var(--touch-min);transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
                <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.emoji || '🤖'"></span> <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.label || '音声'"></span>
            </button>
            <div x-show="showDriveVoiceSwitch" x-cloak @click.outside="showDriveVoiceSwitch=false"
                 style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:var(--space-2);background:rgba(30,41,59,0.95);backdrop-filter:blur(var(--glass-blur));border-radius:var(--md-sys-shape-corner-large);padding:var(--space-2);border:1px solid rgba(255,255,255,0.1);min-width:160px;z-index:50;">
                <template x-for="sp in speakers" :key="sp.id">
                    <button @click="selectedSpeaker=sp.id; showDriveVoiceSwitch=false; localStorage.setItem('ikimon_voice_speaker',sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                            :style="selectedSpeaker===sp.id ? 'background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);' : 'background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);'"
                            style="display:block;width:100%;padding:var(--space-2) var(--space-3);border-radius:var(--md-sys-shape-corner-medium);border:none;font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;text-align:left;cursor:pointer;margin-bottom:var(--space-1);transition:all var(--duration-fast) var(--ease-default);">
                        <span x-text="sp.emoji + ' ' + sp.label"></span>
                    </button>
                </template>
            </div>
        </div>

        <!-- Transport mode switcher -->
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-5);">
            <template x-for="tm in transportModes" :key="tm.id">
                <button @click="setTransportMode(tm.id)"
                        :style="manualTransportMode === tm.id ? 'background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);border-color:var(--md-sys-color-primary);' : 'background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);'"
                        style="padding:var(--space-2) var(--space-4);border-radius:var(--md-sys-shape-corner-full);border:1.5px solid;cursor:pointer;display:flex;align-items:center;gap:var(--space-2);font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;min-height:var(--touch-min);transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
                    <span x-text="tm.emoji" class="pointer-events-none"></span>
                    <span x-text="tm.label" class="pointer-events-none"></span>
                </button>
            </template>
        </div>

        <!-- Stop button -->
        <button @click="stopSensor()"
                style="margin-top:var(--space-8);width:72px;height:72px;border-radius:var(--md-sys-shape-corner-full);background:var(--md-sys-color-error);border:none;color:var(--md-sys-color-on-error);font-size:28px;cursor:pointer;box-shadow:var(--md-sys-elevation-2);transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
            ■
        </button>
    </div>

    <!-- Session Active HUD — M3 Compact Dashboard -->
    <div x-show="sessionActive && currentMovementMode !== 'drive' && manualTransportMode !== 'car'" x-cloak
         class="sensor-sheet" style="z-index:25;">
        <div style="background:var(--md-sys-color-surface-container-lowest);border-radius:var(--md-sys-shape-corner-extra-large);box-shadow:var(--md-sys-elevation-2);overflow:hidden;">

            <!-- Status bar: mode + time + transport + stop -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3) var(--space-4) var(--space-2);border-bottom:1px solid var(--md-sys-color-outline-variant);">
                <div style="display:flex;align-items:center;gap:var(--space-2);">
                    <span class="gps-dot good"></span>
                    <span style="font-size:var(--md-sys-typescale-label-medium-size);font-weight:600;color:var(--md-sys-color-primary);"
                          x-text="modeLabels[currentMovementMode] || 'サーチ中'"></span>
                    <span style="font-size:var(--md-sys-typescale-label-small-size);color:var(--md-sys-color-on-surface-variant);" x-text="formatElapsed(sessionElapsed)"></span>
                </div>
                <div style="display:flex;align-items:center;gap:var(--space-1);">
                    <template x-for="tm in transportModes" :key="tm.id">
                        <button @click="setTransportMode(tm.id)" class="m3-chip"
                                :class="manualTransportMode === tm.id ? 'active' : ''"
                                style="width:var(--touch-min);height:var(--touch-min);padding:0;display:flex;align-items:center;justify-content:center;font-size:var(--md-sys-typescale-body-medium-size);">
                            <span x-text="tm.emoji" class="pointer-events-none"></span>
                        </button>
                    </template>
                    <button @click="stopSensor()" style="padding:var(--space-2) var(--space-3);border-radius:var(--md-sys-shape-corner-full);border:none;background:var(--md-sys-color-error);color:var(--md-sys-color-on-error);font-size:var(--md-sys-typescale-label-medium-size);font-weight:600;cursor:pointer;min-height:var(--touch-min);transition:all var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);">
                        終了
                    </button>
                </div>
            </div>

            <!-- Detection notification -->
            <div x-show="latestDetection" x-cloak x-transition
                 style="margin:var(--space-2) var(--space-3) 0;padding:var(--space-2) var(--space-3);border-radius:var(--md-sys-shape-corner-large);display:flex;align-items:center;gap:var(--space-3);"
                 :style="'background:' + (latestDetection?.source === 'audio' ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)')">
                <span class="text-2xl" x-text="latestDetection?.emoji || '🐦'"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:600;color:var(--md-sys-color-on-surface);" x-text="latestDetection?.label || ''"></div>
                    <div style="font-size:var(--md-sys-typescale-label-small-size);color:var(--md-sys-color-on-surface-variant);margin-top:1px;" x-text="latestDetection?.reason || ''"></div>
                </div>
                <span class="m3-chip" style="padding:2px var(--space-2);font-size:var(--md-sys-typescale-label-small-size);"
                    :class="latestDetection?.confidence === 'high' ? 'active' : ''"
                    :style="latestDetection?.confidence === 'medium' ? 'background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container);border-color:var(--md-sys-color-tertiary);' : ''"
                    x-text="latestDetection?.confidence === 'high' ? '高' : latestDetection?.confidence === 'medium' ? '中' : '低'"></span>
            </div>

            <!-- Accumulation Dashboard -->
            <div style="padding:var(--space-3) var(--space-4);">
                <!-- Environment chip -->
                <div x-show="envLabel" x-cloak class="m3-chip active" style="display:inline-flex;align-items:center;gap:var(--space-1);margin-bottom:var(--space-2);padding:var(--space-1) var(--space-3);">
                    <span>🌿</span> <span x-text="envLabel"></span>
                </div>

                <!-- Data progress -->
                <div style="margin-bottom:var(--space-2);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-1);">
                        <span style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);letter-spacing:var(--tracking-wide);">データ蓄積</span>
                        <span style="font-size:var(--md-sys-typescale-label-medium-size);font-weight:700;color:var(--md-sys-color-primary);" x-text="sessionDataScore + ' pt'"></span>
                    </div>
                    <div style="height:6px;background:var(--md-sys-color-surface-container-high);border-radius:var(--md-sys-shape-corner-full);overflow:hidden;">
                        <div style="height:100%;border-radius:var(--md-sys-shape-corner-full);background:linear-gradient(90deg,var(--md-sys-color-primary),var(--md-sys-color-secondary));transition:width var(--md-sys-motion-duration-long2) var(--md-sys-motion-easing-emphasized-decelerate);"
                             :style="'width:' + Math.min(100, sessionDataScore) + '%'"></div>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-2);text-align:center;">
                    <div style="padding:var(--space-1) 0;">
                        <div style="font-size:var(--text-md);font-weight:800;color:var(--md-sys-color-on-surface);font-family:var(--font-heading);" x-text="sessionSpeciesCount">0</div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);letter-spacing:var(--tracking-wide);">種</div>
                    </div>
                    <div style="padding:var(--space-1) 0;">
                        <div style="font-size:var(--text-md);font-weight:800;color:var(--md-sys-color-secondary);font-family:var(--font-heading);" x-text="sessionFamilyCount">0</div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);letter-spacing:var(--tracking-wide);">科</div>
                    </div>
                    <div style="padding:var(--space-1) 0;">
                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;color:var(--md-sys-color-on-surface);font-family:var(--font-heading);" x-text="formatDistance(sessionDistance)">0 m</div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);letter-spacing:var(--tracking-wide);">距離</div>
                    </div>
                    <div style="padding:var(--space-1) 0;">
                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;color:var(--md-sys-color-tertiary);font-family:var(--font-heading);" x-text="Object.keys(sessionHigherGroups).length">0</div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);font-weight:600;color:var(--md-sys-color-on-surface-variant);letter-spacing:var(--tracking-wide);">分類群</div>
                    </div>
                </div>

                <!-- Higher Group Chips -->
                <div x-show="Object.keys(sessionHigherGroups).length > 0" x-cloak class="m3-chips" style="flex-wrap:wrap;margin-top:var(--space-2);">
                    <template x-for="[group, count] in Object.entries(sessionHigherGroups)" :key="group">
                        <span class="m3-chip" style="font-size:var(--md-sys-typescale-label-small-size);padding:2px var(--space-2);"
                              x-text="group + ' ' + count"></span>
                    </template>
                </div>

                <!-- Voice + Guide controls -->
                <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:var(--space-2);position:relative;">
                    <button @click="toggleGuide()" class="m3-chip" :class="guideEnabled ? 'active' : ''"
                            style="display:flex;align-items:center;gap:3px;">
                        <span x-text="guideEnabled ? '🔊' : '🔇'"></span>
                        <span x-text="guideEnabled ? 'ガイドON' : 'ガイドOFF'"></span>
                    </button>
                    <button @click="showVoiceSwitch = !showVoiceSwitch" x-show="guideEnabled" class="m3-chip"
                            style="display:flex;align-items:center;gap:var(--space-1);">
                        <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.emoji || '🤖'"></span>
                        <span x-text="speakers.find(s=>s.id===selectedSpeaker)?.label || '音声'"></span>
                    </button>
                    <!-- Voice selector popup -->
                    <div x-show="showVoiceSwitch" x-cloak @click.outside="showVoiceSwitch=false"
                         style="position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:var(--space-2);background:var(--md-sys-color-surface-container-lowest);box-shadow:var(--md-sys-elevation-3);border-radius:var(--md-sys-shape-corner-large);padding:var(--space-2);min-width:160px;z-index:50;">
                        <template x-for="sp in speakers" :key="sp.id">
                            <button @click="selectedSpeaker=sp.id; showVoiceSwitch=false; localStorage.setItem('ikimon_voice_speaker',sp.id); if(window.VoiceGuide) VoiceGuide.setVoiceMode(sp.id)"
                                    class="m3-chip" :class="selectedSpeaker===sp.id ? 'active' : ''"
                                    style="display:block;width:100%;text-align:left;margin-bottom:2px;padding:var(--space-2) var(--space-3);">
                                <span x-text="sp.emoji + ' ' + sp.label"></span>
                            </button>
                        </template>
                    </div>
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
        <button class="action-btn" style="background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);width:auto;border-radius:calc(var(--touch-fab) / 2);padding:0 var(--space-5);height:var(--touch-fab);" @click="showModeSelect = true">
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

    <!-- ===== Session Report Overlay — M3 ===== -->
    <div x-show="showReport" x-cloak
         style="position:fixed;inset:0;z-index:50;background:linear-gradient(135deg,var(--md-sys-color-inverse-surface),#1e1b4b);color:#fff;overflow-y:auto;-webkit-overflow-scrolling:touch;">
        <div style="max-width:440px;margin:0 auto;padding:var(--space-6) var(--space-4) 100px;">
            <!-- Header -->
            <div style="text-align:center;margin-bottom:var(--space-6);">
                <div class="text-5xl mb-2">🌿</div>
                <h2 style="font-size:var(--md-sys-typescale-title-large-size);font-weight:900;margin:0;">今日のいきものサーチ</h2>
                <p style="font-size:var(--md-sys-typescale-body-medium-size);color:rgba(255,255,255,0.5);margin:var(--space-1) 0 0;" x-text="reportData?.locationName || ''"></p>
            </div>

            <!-- Main Stats Card -->
            <div style="background:rgba(255,255,255,0.08);border-radius:var(--md-sys-shape-corner-large);padding:var(--space-5);margin-bottom:var(--space-4);">
                <div style="display:flex;justify-content:space-around;text-align:center;">
                    <div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">🚶 時間</div>
                        <div style="font-size:var(--text-md);font-weight:900;" x-text="formatElapsed(reportData?.duration || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">📍 距離</div>
                        <div style="font-size:var(--text-md);font-weight:900;" x-text="formatDistance(reportData?.distance || 0)"></div>
                    </div>
                    <div>
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">🐦 種数</div>
                        <div style="font-size:var(--text-md);font-weight:900;" x-text="reportData?.speciesCount || 0"></div>
                    </div>
                </div>
            </div>

            <!-- Nature Score -->
            <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(34,197,94,0.08));border:1px solid rgba(16,185,129,0.2);border-radius:var(--md-sys-shape-corner-large);padding:var(--space-4);margin-bottom:var(--space-4);"
                 x-show="reportData?.natureScore">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);">
                    <span style="font-size:var(--md-sys-typescale-label-medium-size);font-weight:700;color:var(--md-sys-color-inverse-primary);">🌿 自然浴スコア</span>
                    <span style="font-size:var(--md-sys-typescale-headline-small-size);font-weight:900;color:var(--md-sys-color-primary-light);" x-text="reportData?.natureScore?.score || '-'"></span>
                    <span style="font-size:var(--md-sys-typescale-label-small-size);color:var(--md-sys-color-inverse-primary);">/10</span>
                </div>
                <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-2);">
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:var(--md-sys-shape-corner-small);">
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">多様性</div>
                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;" x-text="reportData?.natureScore?.breakdown?.diversity || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:var(--md-sys-shape-corner-small);">
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">音風景</div>
                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;" x-text="reportData?.natureScore?.breakdown?.soundscape || '-'"></div>
                    </div>
                    <div style="flex:1;text-align:center;padding:6px;background:rgba(255,255,255,0.05);border-radius:var(--md-sys-shape-corner-small);">
                        <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.5);">環境</div>
                        <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;" x-text="reportData?.natureScore?.breakdown?.environment || '-'"></div>
                    </div>
                </div>
                <div style="font-size:var(--md-sys-typescale-body-small-size);color:var(--md-sys-color-primary-container);text-align:center;" x-text="reportData?.natureScore?.message || ''"></div>
            </div>

            <!-- No species -->
            <div x-show="!reportData?.species?.length" style="background:rgba(255,255,255,0.06);border-radius:var(--md-sys-shape-corner-medium);padding:var(--space-5);margin-bottom:var(--space-4);text-align:center;">
                <div class="text-3xl mb-2">🌱</div>
                <div style="font-size:var(--md-sys-typescale-body-medium-size);color:rgba(255,255,255,0.7);font-weight:700;">今回は検出なし</div>
                <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.4);margin-top:var(--space-1);">でも、歩いた記録はたんけんマップに残っています。<br>GPS軌跡と環境データは100年アーカイブに保存されました。</div>
            </div>

            <!-- Species Gallery -->
            <div style="margin-bottom:var(--space-4);" x-show="reportData?.species?.length > 0">
                <h3 style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;color:rgba(255,255,255,0.7);margin:0 0 var(--space-2);">出会った生きもの</h3>
                <div class="no-scrollbar" style="display:flex;gap:var(--space-2);overflow-x:auto;padding-bottom:var(--space-2);-webkit-overflow-scrolling:touch;">
                    <template x-for="sp in (reportData?.species || [])" :key="sp.name">
                        <div style="min-width:140px;max-width:160px;background:rgba(255,255,255,0.06);border-radius:var(--md-sys-shape-corner-medium);padding:var(--space-2) var(--space-3);flex-shrink:0;">
                            <div style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:800;" :style="'color:' + (sp.confidence >= 0.7 ? 'var(--md-sys-color-primary-light)' : sp.confidence >= 0.4 ? '#fbbf24' : 'rgba(255,255,255,0.4)')" x-text="sp.name"></div>
                            <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.4);margin-top:2px;" x-text="sp.source === 'audio' ? '🎤 音声' : '📷 カメラ'"></div>
                            <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.3);margin-top:2px;" x-text="sp.note || sp.category || ''"></div>
                        </div>
                    </template>
                </div>
            </div>

            <!-- AI Narrative -->
            <div style="background:rgba(255,255,255,0.06);border-radius:var(--md-sys-shape-corner-medium);padding:var(--space-3);margin-bottom:var(--space-4);"
                 x-show="reportData?.recap?.narrative">
                <div style="font-size:var(--md-sys-typescale-body-small-size);line-height:1.7;color:rgba(255,255,255,0.7);" x-text="reportData?.recap?.narrative || ''"></div>
                <div style="font-size:var(--md-sys-typescale-label-small-size);color:rgba(255,255,255,0.3);margin-top:6px;">🤖 AI要約</div>
            </div>

            <!-- Contribution -->
            <div style="background:rgba(255,255,255,0.06);border-radius:var(--md-sys-shape-corner-medium);padding:var(--space-3);margin-bottom:var(--space-4);"
                 x-show="reportData?.recap?.contribution?.length > 0">
                <h3 style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;color:rgba(255,255,255,0.7);margin:0 0 var(--space-2);">あなたの貢献</h3>
                <template x-for="c in (reportData?.recap?.contribution || [])" :key="c.text">
                    <div style="display:flex;align-items:start;gap:6px;margin-bottom:var(--space-1);font-size:var(--md-sys-typescale-body-small-size);">
                        <span x-text="c.icon"></span>
                        <span style="color:var(--md-sys-color-secondary-container);" x-text="c.text"></span>
                    </div>
                </template>
            </div>

            <!-- Weekly Summary -->
            <div style="background:rgba(255,255,255,0.06);border-radius:var(--md-sys-shape-corner-medium);padding:var(--space-3);margin-bottom:var(--space-4);"
                 x-show="weeklyStats.sessions > 0">
                <h3 style="font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;color:rgba(255,255,255,0.7);margin:0 0 var(--space-2);">📊 今週の記録</h3>
                <div style="display:flex;gap:var(--space-4);font-size:var(--md-sys-typescale-body-medium-size);color:rgba(255,255,255,0.85);">
                    <span x-text="weeklyStats.sessions + '回'"></span>
                    <span x-text="weeklyStats.species + '種'"></span>
                    <span x-text="formatDistance(weeklyStats.distance)"></span>
                </div>
                <div style="font-size:var(--md-sys-typescale-label-small-size);color:var(--md-sys-color-tertiary);margin-top:var(--space-1);" x-show="weeklyStats.streak > 1"
                     x-text="'🔥 ' + weeklyStats.streak + '日連続サーチ中!'"></div>
            </div>

            <!-- Badges -->
            <div style="margin-bottom:var(--space-4);" x-show="reportData?.recap?.rank_progress?.badges_earned?.length > 0">
                <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
                    <template x-for="b in (reportData?.recap?.rank_progress?.badges_earned || [])" :key="b.name || b">
                        <span style="font-size:var(--md-sys-typescale-label-small-size);padding:var(--space-1) var(--space-2);background:rgba(245,158,11,0.15);color:var(--md-sys-color-tertiary);border-radius:var(--md-sys-shape-corner-small);font-weight:700;" x-text="b.name || b"></span>
                    </template>
                </div>
            </div>

            <!-- Data note -->
            <div style="display:flex;align-items:start;gap:6px;background:rgba(14,165,233,0.08);border-radius:var(--md-sys-shape-corner-small);padding:var(--space-2) var(--space-3);margin-bottom:var(--space-6);">
                <span style="font-size:var(--md-sys-typescale-body-small-size);">💾</span>
                <span style="font-size:var(--md-sys-typescale-label-small-size);color:var(--md-sys-color-secondary-container);">データは100年アーカイブに保存され、生物多様性レポートに活用されます</span>
            </div>

            <!-- Actions — M3 Button patterns -->
            <div style="display:flex;flex-direction:column;gap:var(--space-2);padding-bottom:var(--safe-bottom);">
                <a :href="'post.php?return=field_research.php&from=walk_report'"
                   style="display:block;text-align:center;padding:var(--space-3);border-radius:var(--md-sys-shape-corner-medium);border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.1);color:var(--md-sys-color-tertiary);font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;text-decoration:none;min-height:var(--touch-comfortable);">
                    📸 ベスト写真を投稿する
                </a>
                <div style="display:flex;gap:var(--space-2);">
                    <button @click="showReport=false" style="flex:1;padding:var(--space-3);border-radius:var(--md-sys-shape-corner-medium);border:none;background:rgba(255,255,255,0.1);color:#fff;font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;cursor:pointer;min-height:var(--touch-comfortable);">
                        🗺️ マップに戻る
                    </button>
                    <button @click="showReport=false;startSensor()" style="flex:1;padding:var(--space-3);border-radius:var(--md-sys-shape-corner-medium);border:none;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);font-size:var(--md-sys-typescale-body-medium-size);font-weight:700;cursor:pointer;min-height:var(--touch-comfortable);">
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
    <script src="js/LiveScanner.js?v=27c" nonce="<?= CspNonce::attr() ?>"></script>
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
                sheetStage: 2,
                _sheetTouchStartY: 0,
                _sheetTouchStartStage: 1,
                currentMovementMode: 'walk',
                sessionStartTime: null,
                sessionElapsed: 0,
                sessionDistance: 0,
                sessionSpeciesCount: 0,
                sessionFamilyCount: 0,
                sessionHigherGroups: {},
                sessionEnvTags: [],
                sessionDataScore: 0,
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
                guideEnabled: localStorage.getItem('ikimon_guide_enabled') !== 'false',
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

                sheetTouchStart(e) {
                    this._sheetTouchStartY = e.touches[0].clientY;
                    this._sheetTouchStartStage = this.sheetStage;
                },
                sheetTouchMove(e) {},
                sheetTouchEnd(e) {
                    const dy = this._sheetTouchStartY - e.changedTouches[0].clientY;
                    if (Math.abs(dy) < 30) return;
                    if (dy > 0) { this.sheetStage = Math.min(3, this._sheetTouchStartStage + 1); }
                    else { this.sheetStage = Math.max(1, this._sheetTouchStartStage - 1); }
                },

                toggleGuide() {
                    this.guideEnabled = !this.guideEnabled;
                    localStorage.setItem('ikimon_guide_enabled', this.guideEnabled);
                    if (window.VoiceGuide) {
                        if (this.guideEnabled) {
                            VoiceGuide.setVoiceMode(this.selectedSpeaker);
                            VoiceGuide.setEnabled(true);
                        } else {
                            VoiceGuide.stop();
                            VoiceGuide.setEnabled(false);
                        }
                    }
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
                    this.sessionFamilyCount = 0;
                    this.sessionHigherGroups = {};
                    this.sessionEnvTags = [];
                    this.sessionDataScore = 0;
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
                        if (!this.guideEnabled || !window.VoiceGuide || !VoiceGuide.isEnabled()) return;
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
                    }, ambientIntervalMs);

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
                            if (!this._quickStartDone && pos.accuracy <= 100 && this.guideEnabled && window.VoiceGuide && VoiceGuide.isEnabled()) {
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

                    // Enable VoiceGuide (respect user toggle)
                    if (window.VoiceGuide && this.guideEnabled) {
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
                    if (this.guideEnabled) {
                        const _vgm = VoiceGuide.getVoiceMode();
                        const _isVoxMode = ['zundamon','mochiko','ryusei','auto'].includes(_vgm) || _vgm.startsWith('duo-');
                        if (!_isVoxMode) {
                            const modeLabel = this.manualTransportMode === 'car' ? 'ドライブ' : this.manualTransportMode === 'bike' ? 'サイクリング' : 'フィールドサーチ';
                            VoiceGuide.announce(modeLabel + '、スタート！周りの生き物を探していくよ。');
                        }
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
                    console.log('[addDetection] IN:', detection.label, 'conf:', detection.confidence_raw, 'src:', detection.source);
                    this.sessionDetections = [...this.sessionDetections, detection];
                    const uniqueLabels = new Set(this.sessionDetections.map(d => d.label));
                    this.sessionSpeciesCount = uniqueLabels.size;
                    this.latestDetection = detection;
                    console.log('[addDetection] count:', this.sessionSpeciesCount, 'total:', this.sessionDetections.length);

                    // Accumulation tracking: families, higher groups, env tags
                    const families = new Set(this.sessionDetections.map(d => d.family).filter(Boolean));
                    this.sessionFamilyCount = families.size;
                    const groups = {};
                    this.sessionDetections.forEach(d => {
                        const g = d.higher_group || d.category || 'other';
                        groups[g] = (groups[g] || 0) + 1;
                    });
                    this.sessionHigherGroups = groups;
                    // Data score: species×3 + families×5 + env×2 + distance/100 + photos
                    const photoCount = this.sessionDetections.filter(d => d.photo_ref || d.frame_ref).length;
                    this.sessionDataScore = this.sessionSpeciesCount * 3 + this.sessionFamilyCount * 5 + this.sessionEnvTags.length * 2 + Math.floor(this.sessionDistance / 100) + photoCount;

                    // Add marker on map
                    if (this.liveScanner?.lastGpsPos && this.map) {
                        const pos = this.liveScanner.lastGpsPos;
                        new maplibregl.Marker({ color: detection.source === 'audio' ? '#fbbf24' : '#60a5fa', scale: 0.5 })
                            .setLngLat([pos.lng, pos.lat])
                            .addTo(this.map);
                    }

                    // Voice guide narration — smart pacing
                    if (this.guideEnabled && window.VoiceGuide && VoiceGuide.isEnabled()) {
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
    <script src="/assets/js/voice-assistant.js"></script>
    <?php include __DIR__ . '/components/voice_fab.php'; ?>
</body>

</html>
