<?php

/**
 * Ecological Map Compass (生態地図コンパス)
 * 
 * Replaces competition-focused "ranking" with community-driven
 * regional biodiversity completion tracking.
 * 
 * Philosophy: "It's not who found the most — it's whether the map is complete."
 * 
 * @since Phase E (2026-02-10)
 */

require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/RegionalStats.php';

$currentUser = Auth::user();
$regionalStats = new RegionalStats();

// Detect user's prefecture from their most recent observation, or default to Shizuoka
$userPref = 'JP-22'; // Default: Shizuoka
if ($currentUser) {
    $latestPref = $regionalStats->getUserLatestPrefecture($currentUser['id'] ?? null);
    if ($latestPref) {
        $userPref = $latestPref;
    }
}

// Server-side initial data for SSR (fast first paint)
$overview = $regionalStats->getNationalOverview();
$prefList = $regionalStats->getPrefectureList();
$initialDetail = $regionalStats->getPrefectureStats($userPref);
$initialDetail['neighbors'] = $regionalStats->getNeighboringComparison($userPref);
$initialDetail['recent_discoveries'] = $regionalStats->getRecentDiscoveries($userPref, 30);
$initialDetail['taxon_groups'] = $regionalStats->getTaxonGroupDistribution($userPref);
$initialDetail['area_users'] = $regionalStats->getAreaUsers($userPref);

$pageTitle = '生態地図コンパス — ikimon.life';
$pageDescription = 'みんなの足あとで日本の生物地図を埋めよう。地域ごとの生物多様性の記録状況を可視化します。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <title><?= $pageTitle ?></title>
    <meta name="description" content="<?= $pageDescription ?>">
    <style>
        /* ===== Compass Page — Redesigned Layout ===== */
        /* Philosophy: 1-column flow + section-internal grids for balance */

        .compass-hero {
            background: linear-gradient(135deg, var(--color-bg-base) 0%, var(--color-bg-surface) 100%);
            padding: 2rem 1rem 1.5rem;
            text-align: center;
        }

        .compass-hero h1 {
            font-family: var(--font-heading);
            font-size: 1.5rem;
            font-weight: 900;
            color: var(--color-text);
            margin-bottom: 0.5rem;
        }

        .compass-hero p {
            font-size: 0.85rem;
            color: var(--color-text-muted);
            max-width: 480px;
            margin: 0 auto;
        }

        /* National stats banner */
        .national-banner {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
            padding: 1rem;
            max-width: 600px;
            margin: 1rem auto;
        }

        .national-stat {
            text-align: center;
            padding: 0.75rem 0.5rem;
            background: var(--color-bg-elevated);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
        }

        .national-stat .value {
            font-size: 1.5rem;
            font-weight: 900;
            color: var(--color-primary);
            font-family: var(--font-heading);
        }

        .national-stat .label {
            font-size: 0.65rem;
            color: var(--color-text-faint);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 0.25rem;
        }

        /* Prefecture selector container */
        .pref-selector {
            padding: 0 1rem;
            max-width: 900px;
            margin: 0 auto 1rem;
        }

        .pref-selector select {
            width: 100%;
            padding: 0.75rem 1rem;
            border-radius: var(--radius-md);
            border: 1.5px solid var(--color-border-strong);
            background: var(--color-bg-elevated);
            color: var(--color-text);
            font-size: 0.95rem;
            font-weight: 700;
            font-family: var(--font-heading);
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .pref-selector select:focus {
            outline: none;
            border-color: var(--color-primary);
        }

        /* ===== Main content — single column flow ===== */
        .compass-content {
            max-width: 900px;
            margin: 1rem auto 0;
            padding: 0 1rem;
        }

        .compass-section {
            margin-bottom: 1.5rem;
        }

        .section-title {
            font-family: var(--font-heading);
            font-size: 0.75rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--color-text-faint);
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--color-border);
        }

        /* Big completion meter */
        .completion-meter {
            background: var(--color-bg-elevated);
            border-radius: var(--radius-lg);
            border: 1px solid var(--color-border);
            padding: 1.5rem;
            margin-bottom: 1rem;
        }

        .meter-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.75rem;
        }

        .meter-header .pref-name {
            font-family: var(--font-heading);
            font-size: 1.25rem;
            font-weight: 900;
            color: var(--color-text);
        }

        .meter-header .species-count {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--color-primary);
        }

        .meter-bar-container {
            height: 12px;
            background: var(--color-bg-base);
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 0.75rem;
        }

        .meter-bar {
            height: 100%;
            border-radius: 6px;
            background: linear-gradient(90deg, var(--color-primary), var(--color-accent, #34d399));
            transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .meter-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }

        .meter-stat {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8rem;
            color: var(--color-text-muted);
        }

        .meter-stat .num {
            font-weight: 900;
            color: var(--color-text);
            font-family: var(--font-heading);
        }

        /* ===== Stats Cards — 3-column summary ===== */
        .stats-cards {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }

        .stat-card {
            background: var(--color-bg-elevated);
            border-radius: var(--radius-lg);
            border: 1px solid var(--color-border);
            padding: 1rem;
        }

        .stat-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }

        .stat-card-header h3 {
            font-family: var(--font-heading);
            font-size: 0.8rem;
            font-weight: 800;
            color: var(--color-text);
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }

        .stat-card-badge {
            padding: 0.2rem 0.6rem;
            border-radius: 999px;
            font-size: 0.65rem;
            font-weight: 800;
        }

        .stat-card-badge.green {
            background: rgba(16, 185, 129, 0.1);
            color: #059669;
        }

        .stat-card-badge.muted {
            background: var(--color-bg-base);
            color: var(--color-text-faint);
        }

        /* RedList mini meter */
        .redlist-meter-mini {
            height: 6px;
            background: var(--color-bg-base);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 0.5rem;
        }

        .redlist-meter-fill {
            height: 100%;
            border-radius: 3px;
            background: linear-gradient(90deg, #f59e0b, #ef4444);
            transition: width 1s ease;
        }

        .stat-card-detail {
            font-size: 0.72rem;
            color: var(--color-text-muted);
            line-height: 1.5;
        }

        .stat-card-detail strong {
            color: var(--color-text);
        }

        /* Taxon group chips */
        .taxon-groups {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
        }

        .taxon-chip {
            display: flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.35rem 0.65rem;
            background: var(--color-bg-elevated);
            border: 1px solid var(--color-border);
            border-radius: 999px;
            font-size: 0.7rem;
            font-weight: 700;
            color: var(--color-text-muted);
        }

        .taxon-chip .count {
            font-weight: 900;
            color: var(--color-primary);
        }

        /* ===== Activity Grid — neighbors + discoveries side by side ===== */
        .activity-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1.5rem;
        }

        .activity-panel {
            min-width: 0;
            /* prevent overflow */
        }

        /* Neighbors comparison */
        .neighbor-list {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
        }

        .neighbor-item {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.6rem 0.75rem;
            background: var(--color-bg-elevated);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
        }

        .neighbor-item.current {
            border-color: var(--color-primary);
            background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.05);
        }

        .neighbor-name {
            flex: 1;
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--color-text);
            white-space: nowrap;
        }

        .neighbor-bar-wrap {
            flex: 2;
            height: 8px;
            background: var(--color-bg-base);
            border-radius: 4px;
            overflow: hidden;
        }

        .neighbor-bar-fill {
            height: 100%;
            border-radius: 4px;
            background: var(--color-primary);
            opacity: 0.6;
            transition: width 0.8s ease;
        }

        .neighbor-item.current .neighbor-bar-fill {
            opacity: 1;
        }

        .neighbor-count {
            font-size: 0.72rem;
            font-weight: 800;
            color: var(--color-text-muted);
            min-width: 45px;
            text-align: right;
        }

        /* Rivalry nudge */
        .rivalry-nudge {
            margin-top: 0.6rem;
            padding: 0.5rem 0.7rem;
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.06));
            border: 1px solid rgba(245, 158, 11, 0.2);
            border-radius: var(--radius-md);
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--color-text);
            text-align: center;
        }

        .rivalry-nudge .fire {
            display: inline;
        }

        /* Recent discoveries */
        .discovery-timeline {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .discovery-item {
            display: flex;
            align-items: flex-start;
            gap: 0.6rem;
            padding: 0.6rem 0;
            border-bottom: 1px solid var(--color-border);
        }

        .discovery-item:last-child {
            border-bottom: none;
        }

        .discovery-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--color-primary);
            margin-top: 0.35rem;
            flex-shrink: 0;
        }

        .discovery-info {
            flex: 1;
        }

        .discovery-name {
            font-size: 0.8rem;
            font-weight: 700;
            color: var(--color-text);
        }

        .discovery-sci {
            font-size: 0.68rem;
            font-style: italic;
            color: var(--color-text-faint);
        }

        .discovery-meta {
            font-size: 0.62rem;
            color: var(--color-text-faint);
            margin-top: 0.1rem;
        }

        /* ===== Area Users — horizontal compact cards ===== */
        .area-users-list {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
        }

        .area-user-card {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.6rem;
            background: var(--color-bg-elevated);
            border-radius: var(--radius-md);
            border: 1px solid var(--color-border);
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        .area-user-card:hover {
            border-color: var(--color-primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .area-user-rank {
            font-size: 0.7rem;
            font-weight: 900;
            color: var(--color-text-faint);
            min-width: 1.2rem;
            text-align: center;
            font-family: var(--font-heading);
        }

        .area-user-rank.top-3 {
            color: var(--color-primary);
            font-size: 0.85rem;
        }

        .area-user-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--color-primary), #34d399);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 800;
            color: #fff;
            flex-shrink: 0;
            overflow: hidden;
        }

        .area-user-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .area-user-info {
            flex: 1;
            min-width: 0;
        }

        .area-user-name {
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--color-text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .area-user-meta {
            display: flex;
            gap: 0.6rem;
            font-size: 0.62rem;
            color: var(--color-text-faint);
            margin-top: 0.1rem;
        }

        .area-user-meta .stat {
            display: flex;
            align-items: center;
            gap: 0.2rem;
        }

        .area-user-meta .stat strong {
            font-weight: 800;
            color: var(--color-text-muted);
        }

        /* Not-yet-found silhouettes */
        .silhouette-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.4rem;
        }

        .silhouette-card {
            display: flex;
            align-items: center;
            gap: 0.35rem;
            background: var(--color-bg-elevated);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 0.45rem 0.5rem;
            transition: background 0.2s;
        }

        .silhouette-card:hover {
            background: var(--color-bg-base);
        }

        .silhouette-icon {
            font-size: 0.9rem;
            filter: grayscale(0.8) opacity(0.6);
            flex-shrink: 0;
            width: 1.2rem;
            text-align: center;
        }

        .silhouette-name {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--color-text-muted);
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .silhouette-category {
            font-size: 0.5rem;
            font-weight: 800;
            padding: 0.1rem 0.3rem;
            border-radius: 999px;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .cat-CR {
            background: rgba(239, 68, 68, 0.15);
            color: #dc2626;
        }

        .cat-EN {
            background: rgba(249, 115, 22, 0.15);
            color: #ea580c;
        }

        .cat-VU {
            background: rgba(245, 158, 11, 0.15);
            color: #d97706;
        }

        .cat-NT {
            background: rgba(59, 130, 246, 0.15);
            color: #2563eb;
        }

        /* CTA footer */
        .compass-cta {
            padding: 2rem 1rem;
            text-align: center;
            margin-top: 0.5rem;
        }

        .compass-cta a {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
            width: 100%;
            max-width: 360px;
            padding: 1rem 2rem;
            border-radius: 999px;
            font-weight: 900;
            font-size: 1rem;
            color: #fff;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35), 0 1px 3px rgba(0, 0, 0, 0.1);
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
            overflow: hidden;
        }

        .compass-cta a::after {
            content: '→';
            font-size: 1.1rem;
            transition: transform 0.2s;
        }

        .compass-cta a:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4), 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        .compass-cta a:hover::after {
            transform: translateX(4px);
        }

        .compass-cta a:active {
            transform: translateY(-1px);
        }

        /* Empty state */
        .empty-state {
            text-align: center;
            padding: 1.5rem 1rem;
            color: var(--color-text-faint);
        }

        .empty-state .emoji {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .empty-state p {
            font-size: 0.8rem;
        }

        /* ===== Prefecture Heatmap Grid ===== */
        .scope-tabs {
            display: flex;
            gap: 0;
            margin: 0 1rem;
            border-radius: var(--radius-md) var(--radius-md) 0 0;
            overflow: hidden;
            border: 1px solid var(--color-border);
            border-bottom: none;
        }

        .scope-tab {
            flex: 1;
            padding: 0.5rem 0.75rem;
            text-align: center;
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--color-text-faint);
            background: var(--color-bg-surface);
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }

        .scope-tab.active {
            background: var(--color-bg-base);
            color: var(--color-text);
            box-shadow: inset 0 -2px 0 var(--color-primary);
        }

        .pref-heatmap {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 3px;
            padding: 0.75rem;
            margin: 0 1rem;
            background: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: 0 0 var(--radius-md) var(--radius-md);
        }

        .pref-tile {
            aspect-ratio: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            font-size: 0.55rem;
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
            padding: 2px;
            color: var(--color-text);
            position: relative;
        }

        .pref-tile:hover {
            transform: scale(1.15);
            z-index: 2;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .pref-tile.is-selected {
            outline: 2px solid var(--color-primary);
            outline-offset: 1px;
            transform: scale(1.1);
            z-index: 1;
        }

        .pref-tile .tile-count {
            font-size: 0.5rem;
            opacity: 0.7;
        }

        .pref-heatmap-label {
            font-size: 0.65rem;
            color: var(--color-text-faint);
            text-align: center;
            margin: 0.5rem 0;
        }

        /* ===== Municipality Grid ===== */
        .muni-panel {
            margin: 0.75rem 1rem 0;
            background: var(--color-bg-surface);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            overflow: hidden;
        }

        .muni-panel-header {
            padding: 0.6rem 0.75rem;
            font-size: 0.75rem;
            font-weight: 700;
            border-bottom: 1px solid var(--color-border);
            display: flex;
            align-items: center;
            gap: 0.4rem;
        }

        .muni-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
            gap: 4px;
            padding: 0.5rem;
        }

        .muni-tile {
            padding: 0.5rem 0.4rem;
            border-radius: 6px;
            text-align: center;
            cursor: default;
            transition: transform 0.15s;
        }

        .muni-tile:hover {
            transform: scale(1.05);
        }

        .muni-tile .muni-name {
            font-size: 0.7rem;
            font-weight: 700;
            color: var(--color-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .muni-tile .muni-stats {
            font-size: 0.55rem;
            color: var(--color-text-faint);
            margin-top: 2px;
        }

        .muni-empty {
            padding: 1rem;
            text-align: center;
            font-size: 0.75rem;
            color: var(--color-text-faint);
        }

        /* ===== Desktop layout ===== */
        @media (min-width: 768px) {
            .compass-hero h1 {
                font-size: 2rem;
            }

            .pref-selector {
                max-width: 900px;
            }

            .scope-tabs,
            .pref-heatmap,
            .muni-panel {
                max-width: 900px;
                margin-left: auto;
                margin-right: auto;
            }

            /* Stats cards: 3 columns on desktop */
            .stats-cards {
                grid-template-columns: repeat(3, 1fr);
            }

            /* Activity grid: 2 columns on desktop */
            .activity-grid {
                grid-template-columns: 1fr 1fr;
            }

            /* Users: horizontal scroll → grid of cards */
            .area-users-list {
                flex-direction: row;
                flex-wrap: wrap;
                gap: 0.5rem;
            }

            .area-user-card {
                flex: 1 1 calc(50% - 0.5rem);
                min-width: 200px;
            }

            /* Silhouettes: 4 columns on desktop */
            .silhouette-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }

        /* ===== Animations ===== */
        @keyframes fadeSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeSlideDown {
            from {
                opacity: 0;
                transform: translateY(-15px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.92);
            }

            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes pulseGlow {

            0%,
            100% {
                box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb, 59, 130, 246), 0.2);
            }

            50% {
                box-shadow: 0 0 12px 4px rgba(var(--color-primary-rgb, 59, 130, 246), 0.08);
            }
        }

        .anim-fade-up {
            opacity: 0;
            transform: translateY(20px);
        }

        .anim-fade-up.is-visible {
            animation: fadeSlideUp 0.5s ease-out forwards;
        }

        .anim-scale {
            opacity: 0;
            transform: scale(0.92);
        }

        .anim-scale.is-visible {
            animation: scaleIn 0.45s ease-out forwards;
        }

        .compass-hero h1 {
            animation: fadeSlideDown 0.6s ease-out;
        }

        .compass-hero p {
            animation: fadeSlideDown 0.6s ease-out 0.15s both;
        }

        .national-banner {
            animation: fadeSlideUp 0.5s ease-out 0.25s both;
        }

        .silhouette-card {
            opacity: 0;
            transform: translateY(10px);
        }

        .silhouette-grid.is-visible .silhouette-card {
            animation: fadeSlideUp 0.3s ease-out forwards;
        }

        .compass-cta a {
            animation: pulseGlow 3s ease-in-out infinite;
        }

        .completion-meter .meter-bar {
            transition: width 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) 0.3s;
        }

        .redlist-meter-fill {
            transition: width 1s ease 0.5s;
        }

        .neighbor-bar-fill {
            transition: width 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
        }

        @media (prefers-reduced-motion: reduce) {

            .anim-fade-up,
            .anim-scale,
            .silhouette-card {
                opacity: 1;
                transform: none;
                animation: none !important;
            }

            .compass-cta a {
                animation: none !important;
            }
        }
    </style>
</head>

<body class="bg-base" style="padding-bottom: 80px; padding-top: var(--nav-height);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <!-- Hero -->
    <section class="compass-hero">
        <h1>🧭 生態地図コンパス</h1>
        <p>みんなの足あとで、日本の生物地図を埋めよう。あなたの地域の記録はどこまで進んでいる？</p>
    </section>

    <!-- National Stats Banner -->
    <div class="national-banner">
        <div class="national-stat">
            <div class="value"><?= number_format($overview['total_observations']) ?></div>
            <div class="label">観測記録</div>
        </div>
        <div class="national-stat">
            <div class="value"><?= number_format($overview['total_species']) ?></div>
            <div class="label">確認種数</div>
        </div>
        <div class="national-stat">
            <div class="value"><?= $overview['active_prefectures'] ?>/47</div>
            <div class="label">活動地域</div>
        </div>
    </div>

    <!-- Scope Tabs + Prefecture Heatmap -->
    <div class="pref-selector" x-data="compassApp()" x-init="init()">

        <!-- Heatmap Grid -->
        <div class="scope-tabs anim-fade-up">
            <button class="scope-tab" :class="{ active: scope === 'pref' }" @click="scope = 'pref'">🇯🇵 都道府県</button>
            <button class="scope-tab" :class="{ active: scope === 'muni' }" @click="switchToMuni()">🏘️ 市区町村</button>
        </div>
        <div class="pref-heatmap anim-fade-up">
            <template x-for="p in prefectures" :key="p.code">
                <div class="pref-tile"
                    :class="{ 'is-selected': selectedPref === p.code }"
                    :style="'background:' + heatColor(p.unique_species)"
                    @click="selectPref(p.code)"
                    :title="p.name + '：' + p.unique_species + '種'">
                    <span x-text="p.name.substring(0, 2)"></span>
                    <span class="tile-count" x-text="p.unique_species || ''"></span>
                </div>
            </template>
        </div>
        <div class="pref-heatmap-label" x-show="scope === 'pref'">▲ タップで地域を切り替え</div>

        <!-- Municipality Drilldown Panel -->
        <div class="muni-panel anim-fade-up" x-show="scope === 'muni'" x-cloak>
            <div class="muni-panel-header">
                <span>🏘️</span>
                <span x-text="selectedPrefName + 'の市区町村'"></span>
                <span x-show="muniLoading" style="margin-left:auto; font-size:0.65rem; color:var(--color-text-faint);">読込中...</span>
            </div>
            <template x-if="municipalities.length > 0">
                <div class="muni-grid">
                    <template x-for="m in municipalities" :key="m.name">
                        <div class="muni-tile" :style="'background:' + muniHeatColor(m.unique_species)">
                            <div class="muni-name" x-text="m.name"></div>
                            <div class="muni-stats" x-text="m.unique_species + '種 / ' + m.observation_count + '件'"></div>
                        </div>
                    </template>
                </div>
            </template>
            <template x-if="municipalities.length === 0 && !muniLoading">
                <div class="muni-empty">📭 この都道府県にはまだ市区町村データがありません</div>
            </template>
        </div>

        <!-- Hidden select for accessibility -->
        <select x-model="selectedPref" @change="loadPrefecture()" style="display:none">
            <?php foreach ($prefList as $pref): ?>
                <option value="<?= $pref['code'] ?>" <?= $pref['code'] === $userPref ? 'selected' : '' ?>>
                    <?= $pref['name'] ?>（<?= $pref['name_en'] ?>）
                </option>
            <?php endforeach; ?>
        </select>

        <!-- Dynamic content area -->
        <div class="compass-content" style="margin-top: 1rem;">

            <!-- ===== Section 1: Completion Meter (full width) ===== -->
            <div class="completion-section anim-scale">
                <div class="section-title">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
                    記録状況
                </div>
                <div class="completion-meter">
                    <div class="meter-header">
                        <span class="pref-name" x-text="detail.name || '読み込み中...'"></span>
                        <span class="species-count" x-text="detail.unique_species + ' 種確認'"></span>
                    </div>
                    <div class="meter-bar-container">
                        <div class="meter-bar" :style="'width: ' + Math.min(completionPct, 100) + '%'"></div>
                    </div>
                    <div class="meter-stats">
                        <div class="meter-stat">
                            <i data-lucide="eye" class="w-3.5 h-3.5" style="color: var(--color-primary);"></i>
                            <span><span class="num" x-text="detail.observation_count"></span> 観測</span>
                        </div>
                        <div class="meter-stat">
                            <i data-lucide="users" class="w-3.5 h-3.5" style="color: var(--color-primary);"></i>
                            <span><span class="num" x-text="detail.unique_species"></span> 種</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== Section 2: Stats Cards (3-col on desktop) ===== -->
            <div class="stats-cards">
                <!-- Card: RedList -->
                <div class="completion-section anim-fade-up" x-show="detail.redlist">
                    <div class="redlist-card">
                        <div class="redlist-header">
                            <h3>🔴 レッドリスト</h3>
                            <span class="redlist-badge"
                                :class="detail.redlist?.available ? 'available' : 'unavailable'"
                                x-text="detail.redlist?.available ? detail.redlist.observed + '/' + detail.redlist.total_listed + ' 種' : '準備中'">
                            </span>
                        </div>
                        <template x-if="detail.redlist?.available">
                            <div>
                                <div class="redlist-meter-mini">
                                    <div class="redlist-meter-fill"
                                        :style="'width: ' + (detail.redlist.coverage_pct || 0) + '%'"></div>
                                </div>
                                <div class="redlist-detail">
                                    <strong x-text="detail.redlist.source"></strong>掲載
                                    <strong x-text="detail.redlist.total_listed"></strong>種中
                                    <strong x-text="detail.redlist.observed"></strong>種確認
                                </div>
                            </div>
                        </template>
                        <template x-if="!detail.redlist?.available">
                            <div class="redlist-detail">データ準備中</div>
                        </template>
                    </div>
                </div>

                <!-- Card: Taxon Groups -->
                <div class="completion-section anim-fade-up" x-show="(detail.taxon_groups || []).length > 0">
                    <div class="section-title">
                        <i data-lucide="layers" class="w-3.5 h-3.5"></i>
                        分類群
                    </div>
                    <div class="taxon-groups">
                        <template x-for="tg in (detail.taxon_groups || [])" :key="tg.group">
                            <div class="taxon-chip">
                                <span x-text="groupEmoji(tg.group)"></span>
                                <span x-text="tg.group"></span>
                                <span class="count" x-text="tg.species_count + '種'"></span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Card: Area Users -->
                <div class="completion-section anim-fade-up">
                    <div class="section-title">
                        <i data-lucide="users" class="w-3.5 h-3.5"></i>
                        <span x-text="(detail.name || '') + 'の観察者'"></span>
                    </div>
                    <template x-if="(detail.area_users || []).length > 0">
                        <div class="area-users-list">
                            <template x-for="(u, idx) in (detail.area_users || []).slice(0, 5)" :key="u.user_id">
                                <div class="area-user-card">
                                    <div class="area-user-rank" :class="{ 'top-3': idx < 3 }" x-text="idx + 1"></div>
                                    <div class="area-user-avatar">
                                        <template x-if="u.avatar">
                                            <img :src="u.avatar" :alt="u.display_name" loading="lazy">
                                        </template>
                                        <template x-if="!u.avatar">
                                            <span x-text="(u.display_name || u.user_name || '?').charAt(0).toUpperCase()"></span>
                                        </template>
                                    </div>
                                    <div class="area-user-info">
                                        <div class="area-user-name" x-text="u.display_name || u.user_name"></div>
                                        <div class="area-user-meta">
                                            <span class="stat"><strong x-text="u.observation_count"></strong> 件</span>
                                            <span class="stat"><strong x-text="u.unique_species"></strong> 種</span>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                    <template x-if="(detail.area_users || []).length === 0">
                        <div class="empty-state">
                            <div class="emoji">👣</div>
                            <p>最初の記録者になろう！</p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- ===== Section 3: Activity Grid (2-col on desktop) ===== -->
            <div class="activity-grid">
                <!-- Left: Neighbor Comparison -->
                <div class="completion-section anim-fade-up">
                    <div class="section-title">
                        <i data-lucide="git-compare" class="w-3.5 h-3.5"></i>
                        近隣エリア比較
                    </div>
                    <div class="neighbor-list">
                        <div class="neighbor-item current">
                            <div class="neighbor-name" x-text="detail.name + '（ここ）'"></div>
                            <div class="neighbor-bar-wrap">
                                <div class="neighbor-bar-fill" :style="'width: ' + neighborPct(detail.unique_species) + '%'"></div>
                            </div>
                            <div class="neighbor-count" x-text="detail.unique_species + ' 種'"></div>
                        </div>
                        <template x-for="nb in (detail.neighbors || [])" :key="nb.code">
                            <div class="neighbor-item">
                                <div class="neighbor-name" x-text="nb.name"></div>
                                <div class="neighbor-bar-wrap">
                                    <div class="neighbor-bar-fill" :style="'width: ' + neighborPct(nb.unique_species) + '%'"></div>
                                </div>
                                <div class="neighbor-count" x-text="nb.unique_species + ' 種'"></div>
                            </div>
                        </template>
                    </div>
                    <div class="rivalry-nudge" x-show="rivalryMessage" x-cloak>
                        <span class="fire">🔥</span>
                        <span x-text="rivalryMessage"></span>
                    </div>
                </div>

                <!-- Right: Recent Discoveries -->
                <div class="completion-section anim-fade-up">
                    <div class="section-title">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                        最近の発見（30日間）
                    </div>
                    <template x-if="(detail.recent_discoveries || []).length > 0">
                        <div class="discovery-timeline">
                            <template x-for="d in (detail.recent_discoveries || []).slice(0, 8)" :key="d.name">
                                <div class="discovery-item">
                                    <div class="discovery-dot"></div>
                                    <div class="discovery-info">
                                        <div class="discovery-name" x-text="d.name"></div>
                                        <div class="discovery-sci" x-text="d.scientific_name" x-show="d.scientific_name"></div>
                                        <div class="discovery-meta" x-text="d.observer + ' · ' + formatDate(d.date)"></div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                    <template x-if="(detail.recent_discoveries || []).length === 0">
                        <div class="empty-state">
                            <div class="emoji">🌿</div>
                            <p>まだ記録がないよ。<br>最初の発見者になろう！</p>
                        </div>
                    </template>
                </div>
            </div>

            <!-- ===== Section 4: Not-yet-found species (full width) ===== -->
            <template x-if="detail.redlist?.available && (detail.redlist?.not_yet_found || []).length > 0">
                <div class="completion-section anim-fade-up">
                    <div class="section-title">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                        まだ見つかっていない種（レッドリスト）
                    </div>
                    <div class="silhouette-grid">
                        <template x-for="sp in (detail.redlist?.not_yet_found || []).slice(0, 20)" :key="sp.ja_name">
                            <div class="silhouette-card">
                                <span class="silhouette-icon" x-text="categoryEmoji(sp.taxon_group)"></span>
                                <span class="silhouette-name" x-text="sp.ja_name"></span>
                                <span class="silhouette-category"
                                    :class="'cat-' + sp.category"
                                    x-text="categoryLabel(sp.category)"></span>
                            </div>
                        </template>
                    </div>
                </div>
            </template>

        </div>

        <!-- CTA -->
        <div class="compass-cta anim-fade-up">
            <a href="post.php">
                <i data-lucide="camera" class="w-5 h-5"></i>
                この地域の足あとを残す
            </a>
            <p style="font-size: 0.7rem; color: var(--color-text-faint); margin-top: 0.75rem;">
                あなたの1件が、地図の空白を埋める
            </p>
        </div>
    </div>

    <?php include __DIR__ . '/components/bottom_nav.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        // Server-rendered initial data (prevents FOUC)
        const INITIAL_DETAIL = <?= json_encode($initialDetail, JSON_UNESCAPED_UNICODE) ?>;
        const OVERVIEW = <?= json_encode($overview, JSON_UNESCAPED_UNICODE) ?>;

        function compassApp() {
            return {
                selectedPref: '<?= $userPref ?>',
                scope: 'pref',
                detail: INITIAL_DETAIL,
                prefectures: OVERVIEW.prefectures || [],
                municipalities: [],
                muniLoading: false,
                loading: false,
                rivalryMessage: '',

                init() {
                    if (typeof lucide !== 'undefined') lucide.createIcons();

                    // Scroll-triggered animations
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                entry.target.classList.add('is-visible');
                                // Stagger silhouette cards
                                if (entry.target.classList.contains('silhouette-grid')) {
                                    entry.target.querySelectorAll('.silhouette-card').forEach((card, i) => {
                                        card.style.animationDelay = `${i * 0.04}s`;
                                    });
                                }
                                observer.unobserve(entry.target);
                            }
                        });
                    }, {
                        threshold: 0.15,
                        rootMargin: '0px 0px -30px 0px'
                    });

                    this.$nextTick(() => {
                        document.querySelectorAll('.anim-fade-up, .anim-scale, .silhouette-grid').forEach(el => {
                            observer.observe(el);
                        });
                    });
                    this.updateRivalry();
                },

                async loadPrefecture() {
                    this.loading = true;
                    try {
                        const res = await fetch(`api/get_regional_stats.php?action=detail&pref=${this.selectedPref}`);
                        if (res.ok) {
                            this.detail = await res.json();
                        }
                    } catch (e) {
                        console.error('Failed to load prefecture data:', e);
                    } finally {
                        this.loading = false;
                        this.$nextTick(() => {
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        });
                        this.updateRivalry();
                    }
                },

                updateRivalry() {
                    const me = this.detail?.unique_species || 0;
                    const neighbors = this.detail?.neighbors || [];
                    if (!neighbors.length) {
                        this.rivalryMessage = '';
                        return;
                    }

                    // Find the closest rival above us
                    const above = neighbors
                        .filter(n => n.unique_species > me)
                        .sort((a, b) => a.unique_species - b.unique_species);

                    // Find rivals we're beating
                    const below = neighbors
                        .filter(n => n.unique_species > 0 && n.unique_species <= me)
                        .sort((a, b) => b.unique_species - a.unique_species);

                    if (above.length > 0) {
                        const rival = above[0];
                        const gap = rival.unique_species - me;
                        if (gap <= 10) {
                            this.rivalryMessage = `あと ${gap} 種で ${rival.name} に追いつく！`;
                        } else {
                            this.rivalryMessage = `${rival.name} まであと ${gap} 種 — 記録を増やして差を縮めよう`;
                        }
                    } else if (below.length > 0) {
                        const chaser = below[0];
                        const lead = me - chaser.unique_species;
                        if (lead <= 5) {
                            this.rivalryMessage = `${chaser.name} が ${lead} 種差まで迫っている！リードを守ろう`;
                        } else {
                            this.rivalryMessage = `近隣トップ！${chaser.name} に ${lead} 種差をつけてリード中`;
                        }
                    } else {
                        this.rivalryMessage = '';
                    }
                },

                selectPref(code) {
                    this.selectedPref = code;
                    this.loadPrefecture();
                    // Also load municipalities if in muni scope
                    if (this.scope === 'muni') {
                        this.loadMunicipalities();
                    }
                    // Smooth scroll to detail
                    this.$nextTick(() => {
                        const detail = document.querySelector('.compass-content');
                        if (detail) detail.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    });
                },

                switchToMuni() {
                    this.scope = 'muni';
                    this.loadMunicipalities();
                },

                async loadMunicipalities() {
                    this.muniLoading = true;
                    try {
                        const res = await fetch(`api/get_regional_stats.php?action=municipalities&pref=${this.selectedPref}`);
                        if (res.ok) {
                            this.municipalities = await res.json();
                        }
                    } catch (e) {
                        console.error('Failed to load municipality data:', e);
                    } finally {
                        this.muniLoading = false;
                    }
                },

                get selectedPrefName() {
                    const p = this.prefectures.find(p => p.code === this.selectedPref);
                    return p ? p.name : '';
                },

                heatColor(count) {
                    if (!count || count === 0) return 'rgba(200, 200, 200, 0.3)';
                    const max = Math.max(...this.prefectures.map(p => p.unique_species || 0), 1);
                    const ratio = Math.min(count / max, 1);
                    // Green gradient: light → deep
                    const h = 152;
                    const s = 60 + ratio * 20;
                    const l = 85 - ratio * 45;
                    return `hsl(${h}, ${s}%, ${l}%)`;
                },

                muniHeatColor(count) {
                    if (!count || count === 0) return 'rgba(200, 200, 200, 0.3)';
                    const max = Math.max(...this.municipalities.map(m => m.unique_species || 0), 1);
                    const ratio = Math.min(count / max, 1);
                    // Blue gradient for municipality
                    const h = 210;
                    const s = 55 + ratio * 25;
                    const l = 88 - ratio * 40;
                    return `hsl(${h}, ${s}%, ${l}%)`;
                },

                get completionPct() {
                    // Use observation count as rough progress indicator
                    // More observations = more complete picture
                    const species = this.detail?.unique_species || 0;
                    // Rough estimate: typical prefecture biodiversity ~500-2000 species
                    const estimated = 800;
                    return Math.min(Math.round(species / estimated * 100), 100);
                },

                neighborPct(count) {
                    const allValues = [
                        this.detail?.unique_species || 0,
                        ...(this.detail?.neighbors || []).map(n => n.unique_species)
                    ];
                    const max = Math.max(...allValues, 1);
                    return Math.round(count / max * 100);
                },

                groupEmoji(group) {
                    const map = {
                        '昆虫': '🦗',
                        '昆虫類': '🦗',
                        '植物': '🌿',
                        '維管束植物': '🌿',
                        '鳥類': '🐦',
                        '鳥': '🐦',
                        '哺乳類': '🦊',
                        '哺乳': '🦊',
                        '爬虫類': '🦎',
                        '両生類': '🐸',
                        '魚類': '🐟',
                        '淡水魚': '🐟',
                        '菌類': '🍄',
                        'きのこ': '🍄',
                        '貝類': '🐚',
                        'クモ類': '🕷️',
                        '甲殻類': '🦀',
                    };
                    return map[group] || '🔬';
                },

                categoryEmoji(group) {
                    const map = {
                        '爬虫類': '🦎',
                        '両生類': '🐸',
                        '昆虫': '🦗',
                        '昆虫類': '🦗',
                        '植物': '🌱',
                        '維管束植物': '🌱',
                        '鳥類': '🐦',
                        '哺乳類': '🦊',
                        '魚類': '🐟',
                        '貝類': '🐚',
                        '菌類': '🍄',
                    };
                    return map[group] || '❓';
                },

                categoryLabel(cat) {
                    const labels = {
                        'CR': '危惧IA',
                        'EN': '危惧IB',
                        'VU': '危惧II',
                        'NT': '準絶滅',
                        'DD': '情報不足',
                        'LP': '危惧',
                    };
                    return labels[cat] || cat;
                },

                formatDate(dateStr) {
                    if (!dateStr) return '';
                    const d = new Date(dateStr);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                },
            };
        }
    </script>
</body>

</html>