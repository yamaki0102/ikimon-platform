<?php

/**
 * マイ図鑑 — Personal Species Collection
 * 自分が関わった生き物だけの図鑑。投稿・ウォーク・スキャン・同定。
 * 未ログイン時はプロモーション表示。
 *
 * @version 3.0.0
 * @since 2026-03-22
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/Services/ZukanService.php';

Auth::init();
Lang::init();

$user = Auth::user();
$userId = $user['id'] ?? null;
$isLoggedIn = Auth::isLoggedIn();
$searchQuery = $_GET['q'] ?? '';
$activeGroup = $_GET['group'] ?? '';

$species = [];
$totalSpecies = 0;
$hasMore = false;
$myStats = null;
$communityStats = null;
$mode = 'promo';

if ($isLoggedIn) {
    require_once __DIR__ . '/../libs/Services/MyZukanService.php';
    $mode = $_GET['mode'] ?? 'my';
    $sortBy = $_GET['sort'] ?? ($mode === 'my' ? 'latest' : 'obs_count');

    if ($mode === 'my') {
        $result = MyZukanService::getSpeciesList($userId, [
            'q'      => $searchQuery,
            'group'  => $activeGroup,
            'sort'   => $sortBy,
            'limit'  => 24,
            'offset' => 0,
        ]);
        $myStats = $result['stats'];
    } else {
        $result = ZukanService::getSpeciesList([
            'q'      => $searchQuery,
            'group'  => $activeGroup,
            'sort'   => $sortBy,
            'limit'  => 24,
            'offset' => 0,
        ]);
        $communityStats = $result['stats'];
    }

    $species = $result['data'];
    $totalSpecies = $result['total'];
    $hasMore = $result['has_more'];
}

$meta_title = "マイ図鑑";
$meta_description = "自分だけの生き物コレクション。出会いの記録を振り返ろう。";

function rlClass($rl)
{
    if (!$rl || !isset($rl['ranks'])) return '';
    foreach ($rl['ranks'] as $data) {
        $code = strtolower($data['code'] ?? '');
        if (in_array($code, ['cr', 'en', 'vu', 'nt'])) return $code;
    }
    return '';
}

function rlLabel($rl)
{
    if (!$rl || !isset($rl['ranks'])) return '';
    foreach ($rl['ranks'] as $scope => $data) {
        return strtoupper($data['code'] ?? '');
    }
    return '';
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/zukan.css?v=3.0">
</head>

<body class="app-body bg-base text-text font-body" x-data="zukanApp()" x-init="init()">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <?php if (!$isLoggedIn): ?>
        <!-- ═══ Promo: 未ログイン時のランディング ═══ -->
        <section class="zukan-promo">
            <div class="zukan-promo__inner">
                <div class="zukan-promo__header">
                    <h1 class="zukan-promo__title">📖 マイ図鑑</h1>
                    <p class="zukan-promo__lead">キミだけの、生き物コレクション</p>
                </div>

                <div class="zukan-promo__features">
                    <div class="zukan-promo__feature">
                        <div class="zukan-promo__feature-icon">
                            <i data-lucide="camera" style="width:28px;height:28px;"></i>
                        </div>
                        <div class="zukan-promo__feature-text">
                            <strong>出会いを写真で記録</strong>
                            <span>撮影した生き物が自動で図鑑に追加</span>
                        </div>
                    </div>
                    <div class="zukan-promo__feature">
                        <div class="zukan-promo__feature-icon">
                            <i data-lucide="footprints" style="width:28px;height:28px;"></i>
                        </div>
                        <div class="zukan-promo__feature-text">
                            <strong>お散歩で自動発見</strong>
                            <span>歩くだけでAIが周りの生き物を検出</span>
                        </div>
                    </div>
                    <div class="zukan-promo__feature">
                        <div class="zukan-promo__feature-icon">
                            <i data-lucide="music" style="width:28px;height:28px;"></i>
                        </div>
                        <div class="zukan-promo__feature-text">
                            <strong>鳴き声も図鑑に</strong>
                            <span>鳥の声をAIが聞き取り、音声ごと保存</span>
                        </div>
                    </div>
                    <div class="zukan-promo__feature">
                        <div class="zukan-promo__feature-icon">
                            <i data-lucide="microscope" style="width:28px;height:28px;"></i>
                        </div>
                        <div class="zukan-promo__feature-text">
                            <strong>同定した種も追加</strong>
                            <span>他の人の観察を同定すると図鑑に載る</span>
                        </div>
                    </div>
                    <div class="zukan-promo__feature">
                        <div class="zukan-promo__feature-icon">
                            <i data-lucide="clock" style="width:28px;height:28px;"></i>
                        </div>
                        <div class="zukan-promo__feature-text">
                            <strong>出会いタイムライン</strong>
                            <span>いつ・どこで・何度出会ったか振り返れる</span>
                        </div>
                    </div>
                </div>

                <div class="zukan-promo__cta">
                    <a href="login.php?tab=register" class="zukan-promo__btn zukan-promo__btn--primary">
                        <i data-lucide="user-plus" style="width:18px;height:18px;"></i>
                        アカウントを作る
                    </a>
                    <a href="login.php" class="zukan-promo__btn zukan-promo__btn--secondary">
                        <i data-lucide="log-in" style="width:18px;height:18px;"></i>
                        ログイン
                    </a>
                </div>
            </div>
        </section>

    <?php else: ?>
        <!-- ═══ Logged-in: マイ図鑑 ═══ -->

        <!-- Hero -->
        <section class="zukan-hero">
            <div class="zukan-hero__inner">
                <div class="zukan-hero__top">
                    <div>
                        <h1 class="zukan-hero__title" x-show="mode === 'my'">📖 マイ図鑑</h1>
                        <h1 class="zukan-hero__title" x-show="mode === 'community'" x-cloak>🌿 みんなの図鑑</h1>
                        <p class="zukan-hero__subtitle" x-show="mode === 'my'" x-text="stats.total_species + ' 種と出会いました'"></p>
                        <p class="zukan-hero__subtitle" x-show="mode === 'community'" x-cloak>みんなで見つけた地域の生き物カタログ</p>
                    </div>
                    <div class="zukan-mode-toggle">
                        <button class="zukan-mode-toggle__btn"
                            :class="{'zukan-mode-toggle__btn--active': mode === 'my'}"
                            @click="switchMode('my')">マイ図鑑</button>
                        <button class="zukan-mode-toggle__btn"
                            :class="{'zukan-mode-toggle__btn--active': mode === 'community'}"
                            @click="switchMode('community')">みんなの図鑑</button>
                    </div>
                </div>

                <!-- My Stats (マイ図鑑モード) -->
                <template x-if="mode === 'my' && stats">
                    <div>
                        <div class="zukan-stats">
                            <div class="zukan-stat">
                                <span class="zukan-stat__number" x-text="stats.total_species"></span>
                                <span class="zukan-stat__label">種</span>
                            </div>
                            <div class="zukan-stat">
                                <span class="zukan-stat__number zukan-stat__number--secondary" x-text="stats.total_encounters"></span>
                                <span class="zukan-stat__label">出会い</span>
                            </div>
                        </div>

                        <!-- Category Stats Bar -->
                        <div class="zukan-category-stats" x-show="stats.category_counts">
                            <template x-if="stats.category_counts.post > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="camera" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.post + '種'"></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.walk > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="footprints" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.walk + '種'"></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.scan > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="scan-line" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.scan + '種'"></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.identify > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="microscope" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.identify + '種'"></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.audio > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="music" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.audio + '種'"></span>
                                </span>
                            </template>
                        </div>

                        <template x-if="stats.first_date">
                            <p class="zukan-hero__first-date">
                                🌱 はじめての出会い: <span x-text="formatDate(stats.first_date)"></span>
                            </p>
                        </template>
                    </div>
                </template>

                <!-- Community Stats -->
                <template x-if="mode === 'community' && stats">
                    <div class="zukan-stats">
                        <div class="zukan-stat">
                            <span class="zukan-stat__number" x-text="stats.total_species"></span>
                            <span class="zukan-stat__label">確認種</span>
                        </div>
                        <div class="zukan-stat">
                            <span class="zukan-stat__number zukan-stat__number--secondary" x-text="formatNumber(stats.total_obs)"></span>
                            <span class="zukan-stat__label">観察記録</span>
                        </div>
                        <div class="zukan-stat">
                            <span class="zukan-stat__number zukan-stat__number--accent" x-text="stats.rg_rate + '%'"></span>
                            <span class="zukan-stat__label">RG率</span>
                        </div>
                    </div>
                </template>
            </div>
        </section>

        <!-- ═══ Toolbar ═══ -->
        <div class="zukan-toolbar">
            <div class="flex flex-wrap items-center gap-2" style="gap: var(--zukan-space-sm)">
                <div class="zukan-search" style="flex: 1; min-width: 200px;">
                    <i data-lucide="search" class="zukan-search__icon" style="width:18px; height:18px;"></i>
                    <input type="text"
                        class="zukan-search__input"
                        placeholder="種名で検索..."
                        x-model="searchQuery"
                        @input.debounce.400ms="fetchSpecies(true)">
                </div>

                <div class="zukan-sort">
                    <span class="zukan-sort__label">並び替え</span>
                    <select class="zukan-sort__select" x-model="sortBy" @change="fetchSpecies(true)">
                        <template x-if="mode === 'my'">
                            <option value="latest" selected>最近出会った順</option>
                        </template>
                        <template x-if="mode === 'my'">
                            <option value="first">はじめて出会った順</option>
                        </template>
                        <template x-if="mode === 'my'">
                            <option value="encounters">出会い回数順</option>
                        </template>
                        <option value="name">名前順</option>
                        <template x-if="mode === 'community'">
                            <option value="obs_count">観察件数順</option>
                        </template>
                    </select>
                </div>
            </div>

            <!-- Category Filters (My mode only) -->
            <div class="zukan-filters" x-show="mode === 'my'">
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === ''}"
                    @click="setCategory('')">
                    🌍 すべて
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'post'}"
                    @click="setCategory('post')">
                    📸 投稿
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'walk'}"
                    @click="setCategory('walk')">
                    🚶 ウォーク
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'scan'}"
                    @click="setCategory('scan')">
                    📷 スキャン
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'identify'}"
                    @click="setCategory('identify')">
                    🔬 同定
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'audio'}"
                    @click="setCategory('audio')">
                    🎵 音声あり
                </button>
            </div>

            <!-- Group Filters -->
            <div class="zukan-filters">
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === ''}"
                    @click="setGroup('')">
                    🌍 すべて
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'bird'}"
                    @click="setGroup('bird')">
                    🐦 鳥類
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'insect'}"
                    @click="setGroup('insect')">
                    🦋 昆虫
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'plant'}"
                    @click="setGroup('plant')">
                    🌿 植物
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'mammal'}"
                    @click="setGroup('mammal')">
                    🐾 哺乳類
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'fish'}"
                    @click="setGroup('fish')">
                    🐟 魚類
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeGroup === 'fungi'}"
                    @click="setGroup('fungi')">
                    🍄 菌類
                </button>
            </div>
        </div>

        <!-- ═══ Species Grid ═══ -->
        <div class="zukan-grid" id="zukan-grid">
            <template x-if="!loading && speciesList.length === 0">
                <div class="zukan-empty" style="grid-column: 1 / -1;">
                    <div class="zukan-empty__icon" x-text="mode === 'my' ? '📖' : '🔍'"></div>
                    <div class="zukan-empty__text" x-text="mode === 'my' ? 'まだ出会いがありません。散歩に出かけよう!' : '条件に一致する種が見つかりませんでした'"></div>
                    <template x-if="mode === 'my'">
                        <div style="margin-top: var(--zukan-space-md);">
                            <a href="walk.php" class="zukan-promo__btn zukan-promo__btn--primary" style="display:inline-flex;">
                                <i data-lucide="footprints" style="width:16px;height:16px;"></i>
                                ウォークに出かける
                            </a>
                        </div>
                    </template>
                </div>
            </template>

            <template x-for="(item, idx) in speciesList" :key="item.taxon_key || idx">
                <div class="zukan-card zukan-card--animated"
                    :style="'animation-delay: ' + (idx % 24) * 40 + 'ms'"
                    @click="mode === 'my' ? openDetail(item) : (window.location.href = 'species.php?name=' + encodeURIComponent(item.name))"
                    style="cursor:pointer;">
                    <!-- Photo -->
                    <div class="zukan-card__photo">
                        <template x-if="item.cover_photo || item.photo">
                            <img :src="item.cover_photo || item.photo"
                                :alt="item.name"
                                class="zukan-card__img"
                                loading="lazy">
                        </template>
                        <template x-if="!item.cover_photo && !item.photo">
                            <div class="zukan-card__placeholder">
                                <i data-lucide="camera-off" style="width:28px; height:28px; opacity:0.3;"></i>
                            </div>
                        </template>

                        <!-- Red List badge -->
                        <template x-if="item.red_list && item.red_list.ranks">
                            <div class="zukan-card__rl"
                                :class="'zukan-card__rl--' + getRlClass(item.red_list)"
                                x-text="getRlLabel(item.red_list)">
                            </div>
                        </template>

                        <!-- Audio badge -->
                        <template x-if="item.has_audio">
                            <div class="zukan-card__audio-badge" title="音声あり">🎵</div>
                        </template>

                        <!-- Encounter label (My mode) -->
                        <template x-if="mode === 'my' && item.encounter_label">
                            <div class="zukan-card__encounter-label" x-text="item.encounter_label"></div>
                        </template>
                    </div>

                    <!-- Text Body -->
                    <div class="zukan-card__body">
                        <div class="zukan-card__name" x-text="item.name"></div>
                        <div class="zukan-card__sci" x-text="item.scientific_name"></div>
                        <div class="zukan-card__meta">
                            <template x-if="mode === 'my'">
                                <span class="zukan-card__count">
                                    <span x-text="'×' + item.encounter_count"></span>
                                </span>
                            </template>
                            <template x-if="mode === 'community'">
                                <span class="zukan-card__count">
                                    <i data-lucide="eye" style="width:12px; height:12px;"></i>
                                    <span x-text="item.obs_count"></span>
                                </span>
                            </template>

                            <!-- Category icons (My mode) -->
                            <template x-if="mode === 'my' && item.categories">
                                <span class="zukan-card__categories">
                                    <template x-for="cat in item.categories" :key="cat">
                                        <span class="zukan-card__cat-icon"
                                            x-text="catIcon(cat)"></span>
                                    </template>
                                </span>
                            </template>

                            <template x-if="mode === 'community'">
                                <span class="zukan-card__observers">
                                    <i data-lucide="users" style="width:12px; height:12px;"></i>
                                    <span x-text="item.observer_count"></span>
                                </span>
                            </template>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- Loading Spinner -->
        <div class="zukan-loading" x-show="loading" x-cloak>
            <div class="zukan-spinner"></div>
        </div>

        <!-- Load More -->
        <div class="zukan-loadmore" x-show="hasMore && !loading" x-cloak>
            <button class="zukan-loadmore__btn" @click="loadMore()" :disabled="loadingMore">
                <span x-show="!loadingMore">もっと見る</span>
                <span x-show="loadingMore">読み込み中...</span>
            </button>
        </div>

        <!-- Result Count -->
        <div class="text-center pb-8" style="max-width: var(--content-max-width); margin: 0 auto;">
            <p class="text-xs text-muted" x-show="!loading">
                <span x-text="totalResults"></span> 種を表示中
            </p>
        </div>

        <!-- ═══ Species Detail Modal ═══ -->
        <div class="zukan-modal" x-show="showDetail" x-cloak
            x-transition:enter="transition ease-out duration-200"
            x-transition:enter-start="opacity-0"
            x-transition:enter-end="opacity-100"
            x-transition:leave="transition ease-in duration-150"
            x-transition:leave-start="opacity-100"
            x-transition:leave-end="opacity-0"
            @keydown.escape.window="closeDetail()">
            <div class="zukan-modal__backdrop" @click="closeDetail()"></div>
            <div class="zukan-modal__content" @click.stop>
                <template x-if="detailEntry">
                    <div>
                        <!-- Header -->
                        <div class="zukan-modal__header">
                            <button class="zukan-modal__back" @click="closeDetail()">
                                <i data-lucide="arrow-left" style="width:20px;height:20px;"></i>
                                戻る
                            </button>
                            <span class="zukan-modal__number" x-text="'No.' + detailIndex"></span>
                        </div>

                        <!-- Cover Photo -->
                        <template x-if="detailEntry.cover_photo">
                            <div class="zukan-modal__cover">
                                <img :src="detailEntry.cover_photo" :alt="detailEntry.name" loading="lazy">
                            </div>
                        </template>

                        <!-- Species Info -->
                        <div class="zukan-modal__info">
                            <h2 class="zukan-modal__name" x-text="detailEntry.name"></h2>
                            <p class="zukan-modal__sci" x-text="detailEntry.scientific_name"></p>

                            <div class="zukan-modal__tags">
                                <template x-if="detailEntry.group">
                                    <span class="zukan-modal__tag" x-text="detailEntry.group"></span>
                                </template>
                                <template x-if="detailEntry.rank && detailEntry.rank !== 'species'">
                                    <span class="zukan-modal__tag zukan-modal__tag--rank" x-text="detailEntry.rank"></span>
                                </template>
                                <template x-if="detailEntry.red_list && detailEntry.red_list.ranks">
                                    <span class="zukan-modal__tag zukan-modal__tag--rl"
                                        :class="'zukan-modal__tag--' + getRlClass(detailEntry.red_list)"
                                        x-text="getRlLabel(detailEntry.red_list)"></span>
                                </template>
                            </div>

                            <div class="zukan-modal__summary">
                                <template x-for="cat in detailEntry.categories" :key="cat">
                                    <span class="zukan-card__cat-icon" x-text="catIcon(cat)" style="font-size:1.2rem;"></span>
                                </template>
                                <span class="zukan-modal__label" x-text="detailEntry.encounter_label"></span>
                                <span class="zukan-modal__count" x-text="'(' + detailEntry.encounter_count + '回)'"></span>
                            </div>
                        </div>

                        <!-- Timeline -->
                        <div class="zukan-timeline">
                            <h3 class="zukan-timeline__title">出会いの記録</h3>

                            <template x-if="detailLoading">
                                <div class="zukan-loading"><div class="zukan-spinner"></div></div>
                            </template>

                            <div class="zukan-timeline__list">
                                <template x-for="(enc, i) in detailEntry.encounters" :key="enc.id + '-' + i">
                                    <div class="zukan-timeline__item">
                                        <div class="zukan-timeline__dot"
                                            :class="'zukan-timeline__dot--' + enc.type"></div>
                                        <div class="zukan-timeline__card">
                                            <!-- Header -->
                                            <div class="zukan-timeline__card-header">
                                                <span class="zukan-timeline__season" x-text="enc.season_icon"></span>
                                                <span class="zukan-timeline__date" x-text="formatDate(enc.date)"></span>
                                                <span class="zukan-timeline__location" x-text="enc.location_label"></span>
                                            </div>

                                            <!-- Type badge -->
                                            <div class="zukan-timeline__type">
                                                <span x-text="catIcon(enc.type)"></span>
                                                <span x-text="catLabel(enc.type)"></span>
                                                <template x-if="i === detailEntry.encounters.length - 1">
                                                    <span class="zukan-timeline__first">🌱 はじめての出会い!</span>
                                                </template>
                                            </div>

                                            <!-- Walk info -->
                                            <template x-if="enc.walk_info">
                                                <div class="zukan-timeline__walk">
                                                    <i data-lucide="map-pin" style="width:12px;height:12px;"></i>
                                                    <span x-text="(enc.walk_info.distance_m / 1000).toFixed(1) + 'km'"></span>
                                                    <template x-if="enc.walk_info.duration_min">
                                                        <span x-text="enc.walk_info.duration_min + '分'"></span>
                                                    </template>
                                                    <template x-if="enc.walk_info.field_name">
                                                        <span x-text="enc.walk_info.field_name"></span>
                                                    </template>
                                                </div>
                                            </template>

                                            <!-- Photos -->
                                            <template x-if="enc.photos && enc.photos.length > 0">
                                                <div class="zukan-timeline__photos">
                                                    <template x-for="photo in enc.photos.slice(0, 4)" :key="photo">
                                                        <img :src="photo" class="zukan-timeline__photo" loading="lazy"
                                                            @click.stop="window.open(photo, '_blank')">
                                                    </template>
                                                </div>
                                            </template>

                                            <!-- Audio -->
                                            <template x-if="enc.audio_url">
                                                <div class="zukan-audio">
                                                    <button class="zukan-audio__btn"
                                                        @click.stop="toggleAudio(enc.audio_url)">
                                                        <i data-lucide="play" style="width:14px;height:14px;" x-show="playingAudio !== enc.audio_url"></i>
                                                        <i data-lucide="pause" style="width:14px;height:14px;" x-show="playingAudio === enc.audio_url" x-cloak></i>
                                                        <span x-text="playingAudio === enc.audio_url ? '停止' : '鳴き声を聴く'"></span>
                                                    </button>
                                                </div>
                                            </template>

                                            <!-- Note -->
                                            <template x-if="enc.note">
                                                <p class="zukan-timeline__note" x-text="enc.note"></p>
                                            </template>

                                            <!-- Identify: observer name -->
                                            <template x-if="enc.type === 'identify' && enc.observer_name">
                                                <p class="zukan-timeline__observer">
                                                    <i data-lucide="user" style="width:12px;height:12px;"></i>
                                                    <span x-text="enc.observer_name + ' さんの観察'"></span>
                                                </p>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>

                        <!-- Link to species page -->
                        <div class="zukan-modal__footer">
                            <a :href="'species.php?name=' + encodeURIComponent(detailEntry.name)"
                                class="zukan-modal__species-link">
                                <i data-lucide="external-link" style="width:14px;height:14px;"></i>
                                種の詳細ページへ
                            </a>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <audio id="zukanAudioPlayer" style="display:none;" @ended="playingAudio = null"></audio>

    <?php endif; ?>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function zukanApp() {
            return {
                mode: '<?php echo $isLoggedIn ? htmlspecialchars($mode, ENT_QUOTES) : 'promo'; ?>',
                speciesList: <?php echo json_encode($species, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG); ?>,
                totalResults: <?php echo $totalSpecies; ?>,
                hasMore: <?php echo $hasMore ? 'true' : 'false'; ?>,
                stats: <?php echo json_encode($myStats ?? $communityStats ?? new \stdClass(), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG); ?>,

                searchQuery: '',
                activeGroup: '<?php echo htmlspecialchars($activeGroup, ENT_QUOTES); ?>',
                activeCategory: '',
                sortBy: '<?php echo $isLoggedIn ? htmlspecialchars($sortBy ?? 'latest', ENT_QUOTES) : 'obs_count'; ?>',
                loading: false,
                loadingMore: false,
                offset: <?php echo count($species); ?>,
                limit: 24,

                showDetail: false,
                detailEntry: null,
                detailIndex: 0,
                detailLoading: false,
                playingAudio: null,

                init() {
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                },

                async switchMode(newMode) {
                    if (this.mode === newMode) return;
                    this.mode = newMode;
                    this.activeCategory = '';
                    this.searchQuery = '';
                    this.sortBy = newMode === 'my' ? 'latest' : 'obs_count';
                    this.activeGroup = '';
                    await this.fetchSpecies(true);
                },

                async fetchSpecies(reset = false) {
                    if (reset) {
                        this.offset = 0;
                        this.loading = true;
                    }

                    const params = new URLSearchParams({
                        q: this.searchQuery,
                        group: this.activeGroup,
                        sort: this.sortBy,
                        limit: this.limit,
                        offset: this.offset,
                    });

                    if (this.mode === 'my') {
                        params.set('mode', 'my');
                        if (this.activeCategory) params.set('category', this.activeCategory);
                    }

                    try {
                        const res = await fetch('api/taxon_index.php?' + params.toString());
                        const data = await res.json();

                        if (reset) {
                            this.speciesList = data.data;
                        } else {
                            this.speciesList = [...this.speciesList, ...data.data];
                        }

                        this.totalResults = data.total;
                        this.hasMore = data.has_more;
                        this.stats = data.stats;
                        this.offset = this.speciesList.length;
                    } catch (err) {
                        console.error('Zukan fetch error:', err);
                    } finally {
                        this.loading = false;
                        this.loadingMore = false;
                        this.$nextTick(() => {
                            if (typeof lucide !== 'undefined') lucide.createIcons();
                        });
                    }
                },

                async loadMore() {
                    this.loadingMore = true;
                    await this.fetchSpecies(false);
                },

                setGroup(group) {
                    this.activeGroup = group;
                    this.fetchSpecies(true);
                },

                setCategory(cat) {
                    this.activeCategory = cat;
                    this.fetchSpecies(true);
                },

                async openDetail(item) {
                    this.detailIndex = this.speciesList.indexOf(item) + 1;
                    this.detailEntry = { ...item };
                    this.showDetail = true;
                    document.body.style.overflow = 'hidden';

                    if (item.encounters && item.encounters.length < item.encounter_count) {
                        this.detailLoading = true;
                        try {
                            const res = await fetch('api/taxon_index.php?mode=my&detail=1&taxon_key=' + encodeURIComponent(item.taxon_key));
                            const data = await res.json();
                            if (data.success && data.entry) {
                                this.detailEntry = data.entry;
                            }
                        } catch (err) {
                            console.error('Detail fetch error:', err);
                        } finally {
                            this.detailLoading = false;
                            this.$nextTick(() => {
                                if (typeof lucide !== 'undefined') lucide.createIcons();
                            });
                        }
                    }

                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                },

                closeDetail() {
                    this.showDetail = false;
                    document.body.style.overflow = '';
                    this.stopAudio();
                },

                toggleAudio(url) {
                    const player = document.getElementById('zukanAudioPlayer');
                    if (this.playingAudio === url) {
                        player.pause();
                        this.playingAudio = null;
                    } else {
                        player.src = url;
                        player.play().catch(() => {});
                        this.playingAudio = url;
                    }
                },

                stopAudio() {
                    const player = document.getElementById('zukanAudioPlayer');
                    if (player) { player.pause(); player.src = ''; }
                    this.playingAudio = null;
                },

                catIcon(type) {
                    const icons = { post: '📸', walk: '🚶', scan: '📷', identify: '🔬', audio: '🎵' };
                    return icons[type] || '';
                },

                catLabel(type) {
                    const labels = { post: '投稿', walk: 'ウォーク', scan: 'スキャン', identify: '同定', audio: '音声検出' };
                    return labels[type] || '';
                },

                getRlClass(rl) {
                    if (!rl || !rl.ranks) return '';
                    for (const scope in rl.ranks) {
                        const code = (rl.ranks[scope].code || '').toLowerCase();
                        if (['cr', 'en', 'vu', 'nt'].includes(code)) return code;
                    }
                    return '';
                },

                getRlLabel(rl) {
                    if (!rl || !rl.ranks) return '';
                    for (const scope in rl.ranks) {
                        return (rl.ranks[scope].code || '').toUpperCase();
                    }
                    return '';
                },

                formatNumber(n) {
                    return Number(n).toLocaleString();
                },

                formatDate(d) {
                    if (!d) return '';
                    const date = new Date(d);
                    if (isNaN(date.getTime())) return d;
                    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
                }
            };
        }
    </script>

    <script nonce="<?= CspNonce::attr() ?>">
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>

</body>

</html>
