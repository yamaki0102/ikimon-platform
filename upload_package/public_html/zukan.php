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
$mode = 'promo';

if ($isLoggedIn) {
    require_once __DIR__ . '/../libs/Services/MyZukanService.php';
    $mode = 'my';
    $sortBy = $_GET['sort'] ?? 'latest';

    $result = MyZukanService::getSpeciesList($userId, [
        'q'        => $searchQuery,
        'group'    => $activeGroup,
        'category' => 'post',
        'sort'     => $sortBy,
        'limit'    => 24,
        'offset'   => 0,
    ]);
    $myStats = $result['stats'];

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
    <link rel="stylesheet" href="assets/css/zukan.css?v=3.7">
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
                <h1 class="zukan-hero__title">📖 マイ図鑑</h1>
                <p class="zukan-hero__subtitle" x-text="stats.total_species + ' の生き物と出会いました'"></p>

                <template x-if="stats">
                    <div>
                        <div class="zukan-stats">
                            <div class="zukan-stat">
                                <span class="zukan-stat__number" x-text="stats.total_species"></span>
                                <span class="zukan-stat__label">いきもの</span>
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
                                    <span x-text="stats.category_counts.post "></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.walk > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="footprints" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.walk "></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.scan > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="scan-line" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.scan "></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.identify > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="microscope" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.identify "></span>
                                </span>
                            </template>
                            <template x-if="stats.category_counts.audio > 0">
                                <span class="zukan-category-stat">
                                    <i data-lucide="music" style="width:14px;height:14px;"></i>
                                    <span x-text="stats.category_counts.audio "></span>
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
                        <option value="latest" selected>最近出会った順</option>
                        <option value="first">はじめて出会った順</option>
                        <option value="encounters">出会い回数順</option>
                        <option value="name">名前順</option>
                    </select>
                </div>
            </div>

            <!-- Category Filters -->
            <div class="zukan-filters">
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === 'post'}"
                    @click="setCategory('post')">
                    📸 観察投稿
                </button>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': activeCategory === ''}"
                    @click="setCategory('')">
                    🌍 すべて
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
                    <div class="zukan-empty__icon">📖</div>
                    <div class="zukan-empty__text">まだ出会いがありません。散歩に出かけよう!</div>
                    <div style="margin-top: var(--zukan-space-md);">
                        <a href="/field_research.php" class="zukan-promo__btn zukan-promo__btn--primary" style="display:inline-flex;">
                            <i data-lucide="footprints" style="width:16px;height:16px;"></i>
                            さんぽに出かける
                        </a>
                    </div>
                </div>
            </template>

            <template x-for="(item, idx) in speciesList" :key="item.taxon_key || idx">
                <div class="zukan-card zukan-card--animated"
                    :style="'animation-delay: ' + (idx % 24) * 40 + 'ms'"
                    @click="openDetail(item)"
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
                            <span class="zukan-card__count">
                                <span x-text="'×' + item.encounter_count"></span>
                            </span>

                            <template x-if="item.categories">
                                <span class="zukan-card__categories">
                                    <template x-for="cat in item.categories" :key="cat">
                                        <span class="zukan-card__cat-icon"
                                            x-text="catIcon(cat)"></span>
                                    </template>
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
                <span x-text="totalResults"></span> 件を表示中
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
            @keydown.escape.window="closeDetail()"
            @keydown.left.window="showDetail && detailIndex > 1 && goToSpecies(detailIndex - 2)"
            @keydown.right.window="showDetail && detailIndex < speciesList.length && goToSpecies(detailIndex)">
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

                        <!-- Photo Gallery Carousel -->
                        <div class="zukan-gallery" x-show="allPhotos().length > 0"
                            x-data="{gx:0,gy:0}"
                            @touchstart="gx=$event.touches[0].clientX;gy=$event.touches[0].clientY"
                            @touchend="let dx=$event.changedTouches[0].clientX-gx,dy=$event.changedTouches[0].clientY-gy;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0&&galleryIndex<allPhotos().length-1)galleryIndex++;else if(dx>0&&galleryIndex>0)galleryIndex--}"
                            @click.stop>
                            <div class="zukan-gallery__track"
                                :style="'transform: translateX(-' + (galleryIndex * 100) + '%)'">
                                <template x-for="(photo, pi) in allPhotos()" :key="photo + pi">
                                    <div class="zukan-gallery__slide">
                                        <img :src="photo" :alt="detailEntry.name" loading="lazy"
                                            @click.stop="fullscreenPhoto = true">
                                    </div>
                                </template>
                            </div>

                            <!-- Arrow buttons -->
                            <button class="zukan-gallery__arrow zukan-gallery__arrow--left"
                                x-show="galleryIndex > 0"
                                @click.stop="galleryIndex--">
                                <i data-lucide="chevron-left" style="width:20px;height:20px;"></i>
                            </button>
                            <button class="zukan-gallery__arrow zukan-gallery__arrow--right"
                                x-show="galleryIndex < allPhotos().length - 1"
                                @click.stop="galleryIndex++">
                                <i data-lucide="chevron-right" style="width:20px;height:20px;"></i>
                            </button>

                            <!-- Dots -->
                            <div class="zukan-gallery__dots" x-show="allPhotos().length > 1">
                                <template x-for="(_, di) in allPhotos()" :key="'dot'+di">
                                    <button class="zukan-gallery__dot"
                                        :class="{'zukan-gallery__dot--active': di === galleryIndex}"
                                        @click.stop="galleryIndex = di"></button>
                                </template>
                            </div>

                            <!-- Expand hint -->
                            <div class="zukan-gallery__expand-hint">
                                <i data-lucide="maximize-2" style="width:16px;height:16px;"></i>
                            </div>

                            <!-- Counter -->
                            <div class="zukan-gallery__counter" x-show="allPhotos().length > 1">
                                <span x-text="(galleryIndex + 1) + ' / ' + allPhotos().length"></span>
                            </div>
                        </div>

                        <!-- Fallback: no photos -->
                        <template x-if="allPhotos().length === 0">
                            <div class="zukan-modal__cover zukan-modal__cover--empty">
                                <i data-lucide="camera-off" style="width:40px;height:40px;opacity:0.2;"></i>
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

                        <!-- AI Story -->
                        <div class="zukan-story" x-show="storyText || storyLoading">
                            <template x-if="storyLoading">
                                <div class="zukan-story__loading">
                                    <div class="zukan-spinner" style="width:20px;height:20px;border-width:2px;"></div>
                                    <span>解説を生成中...</span>
                                </div>
                            </template>
                            <template x-if="storyText">
                                <div>
                                    <p class="zukan-story__text" x-text="storyText"></p>
                                    <p class="zukan-story__disclaimer">
                                        <i data-lucide="info" style="width:12px;height:12px;"></i>
                                        AIによる解説です。正確でない場合があります
                                    </p>
                                </div>
                            </template>
                        </div>

                        <!-- Timeline -->
                        <div class="zukan-timeline">
                            <h3 class="zukan-timeline__title">
                                出会いの記録
                                <span class="zukan-timeline__count" x-text="'(' + (detailEntry.encounters ? detailEntry.encounters.length : 0) + '回)'"></span>
                            </h3>

                            <template x-if="detailLoading">
                                <div class="zukan-loading"><div class="zukan-spinner"></div></div>
                            </template>

                            <div class="zukan-timeline__list">
                                <template x-for="(enc, i) in visibleEncounters()" :key="enc.id + '-' + i">
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

                            <!-- Show more button -->
                            <template x-if="detailEntry.encounters && detailEntry.encounters.length > 5 && !timelineExpanded">
                                <button class="zukan-timeline__expand" @click="timelineExpanded = true">
                                    <i data-lucide="chevron-down" style="width:16px;height:16px;"></i>
                                    <span x-text="'残り ' + (detailEntry.encounters.length - 5) + ' 件を表示'"></span>
                                </button>
                            </template>
                            <template x-if="timelineExpanded && detailEntry.encounters && detailEntry.encounters.length > 5">
                                <button class="zukan-timeline__expand" @click="timelineExpanded = false">
                                    <i data-lucide="chevron-up" style="width:16px;height:16px;"></i>
                                    <span>折りたたむ</span>
                                </button>
                            </template>
                        </div>

                        <!-- ═══ Book-style Page Navigation ═══ -->
                        <div class="zukan-book-nav">
                            <div class="zukan-book-nav__bar">
                                <button class="zukan-book-nav__btn zukan-book-nav__btn--prev"
                                    :disabled="detailIndex <= 1"
                                    @click="goToSpecies(detailIndex - 2)">
                                    <i data-lucide="chevron-left" style="width:20px;height:20px;"></i>
                                    <span class="zukan-book-nav__btn-label">前の種</span>
                                </button>

                                <div class="zukan-book-nav__center">
                                    <div class="zukan-book-nav__page">
                                        <span class="zukan-book-nav__current" x-text="detailIndex"></span>
                                        <span class="zukan-book-nav__sep">/</span>
                                        <span class="zukan-book-nav__total" x-text="totalResults"></span>
                                    </div>
                                    <div class="zukan-book-nav__progress">
                                        <div class="zukan-book-nav__progress-fill"
                                            :style="'width: ' + (detailIndex / totalResults * 100) + '%'"></div>
                                    </div>
                                </div>

                                <button class="zukan-book-nav__btn zukan-book-nav__btn--next"
                                    :disabled="detailIndex >= speciesList.length"
                                    @click="goToSpecies(detailIndex)">
                                    <span class="zukan-book-nav__btn-label">次の種</span>
                                    <i data-lucide="chevron-right" style="width:20px;height:20px;"></i>
                                </button>
                            </div>

                            <!-- Peek: Next species preview -->
                            <template x-if="detailIndex < speciesList.length">
                                <div class="zukan-book-nav__peek" @click="goToSpecies(detailIndex)">
                                    <span class="zukan-book-nav__peek-label">次</span>
                                    <template x-if="speciesList[detailIndex]?.cover_photo || speciesList[detailIndex]?.photo">
                                        <img :src="speciesList[detailIndex].cover_photo || speciesList[detailIndex].photo"
                                            class="zukan-book-nav__peek-img" loading="lazy">
                                    </template>
                                    <template x-if="!speciesList[detailIndex]?.cover_photo && !speciesList[detailIndex]?.photo">
                                        <div class="zukan-book-nav__peek-placeholder">📖</div>
                                    </template>
                                    <span class="zukan-book-nav__peek-name" x-text="speciesList[detailIndex]?.name"></span>
                                    <i data-lucide="chevron-right" style="width:14px;height:14px;opacity:0.4;"></i>
                                </div>
                            </template>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- ═══ Fullscreen Photo Viewer ═══ -->
        <div class="zukan-lightbox" x-show="fullscreenPhoto" x-cloak
            x-transition:enter="transition ease-out duration-150"
            x-transition:enter-start="opacity-0"
            x-transition:enter-end="opacity-100"
            x-transition:leave="transition ease-in duration-100"
            x-transition:leave-start="opacity-100"
            x-transition:leave-end="opacity-0"
            @keydown.escape.window="fullscreenPhoto = false"
            @keydown.left.window="fullscreenPhoto && galleryIndex > 0 && galleryIndex--"
            @keydown.right.window="fullscreenPhoto && galleryIndex < allPhotos().length - 1 && galleryIndex++"
            x-data="{lx:0,ly:0}"
            @touchstart="lx=$event.touches[0].clientX;ly=$event.touches[0].clientY"
            @touchend="let dx=$event.changedTouches[0].clientX-lx,dy=$event.changedTouches[0].clientY-ly;if(Math.abs(dy)>100&&Math.abs(dy)>Math.abs(dx)){fullscreenPhoto=false}else if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){if(dx<0&&galleryIndex<allPhotos().length-1)galleryIndex++;else if(dx>0&&galleryIndex>0)galleryIndex--}">
            <div class="zukan-lightbox__bg" @click="fullscreenPhoto = false"></div>

            <!-- Close -->
            <button class="zukan-lightbox__close" @click="fullscreenPhoto = false">
                <i data-lucide="x" style="width:24px;height:24px;"></i>
            </button>

            <!-- Counter -->
            <div class="zukan-lightbox__counter" x-show="allPhotos().length > 1">
                <span x-text="(galleryIndex + 1) + ' / ' + allPhotos().length"></span>
            </div>

            <!-- Image -->
            <div class="zukan-lightbox__img-wrap">
                <img :src="allPhotos()[galleryIndex]" class="zukan-lightbox__img"
                    @click.stop>
            </div>

            <!-- Arrows -->
            <button class="zukan-lightbox__arrow zukan-lightbox__arrow--left"
                x-show="galleryIndex > 0"
                @click.stop="galleryIndex--">
                <i data-lucide="chevron-left" style="width:28px;height:28px;"></i>
            </button>
            <button class="zukan-lightbox__arrow zukan-lightbox__arrow--right"
                x-show="galleryIndex < allPhotos().length - 1"
                @click.stop="galleryIndex++">
                <i data-lucide="chevron-right" style="width:28px;height:28px;"></i>
            </button>

            <!-- Hint -->
            <div class="zukan-lightbox__hint">スワイプで次の写真 / 下スワイプで閉じる</div>
        </div>

        <audio id="zukanAudioPlayer" style="display:none;" @ended="playingAudio = null"></audio>

    <?php endif; ?>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function zukanApp() {
            return {
                speciesList: <?php echo json_encode($species, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG); ?>,
                totalResults: <?php echo $totalSpecies; ?>,
                hasMore: <?php echo $hasMore ? 'true' : 'false'; ?>,
                stats: <?php echo json_encode($myStats ?? new \stdClass(), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG); ?>,

                searchQuery: '',
                activeGroup: '<?php echo htmlspecialchars($activeGroup, ENT_QUOTES); ?>',
                activeCategory: 'post',
                sortBy: '<?php echo htmlspecialchars($sortBy ?? 'latest', ENT_QUOTES); ?>',
                loading: false,
                loadingMore: false,
                offset: <?php echo count($species); ?>,
                limit: 24,

                showDetail: false,
                detailEntry: null,
                detailIndex: 0,
                detailLoading: false,
                playingAudio: null,
                storyText: null,
                storyLoading: false,
                timelineExpanded: false,
                galleryIndex: 0,
                fullscreenPhoto: false,

                init() {
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
                    window.addEventListener('popstate', (e) => {
                        if (this.showDetail) {
                            this.showDetail = false;
                            document.body.style.overflow = '';
                            this.stopAudio();
                        }
                    });

                    let touchStartX = 0;
                    let touchStartY = 0;
                    this.$nextTick(() => {
                        const modal = this.$el.querySelector('.zukan-modal__content');
                        if (modal) {
                            modal.addEventListener('touchstart', (e) => {
                                touchStartX = e.touches[0].clientX;
                                touchStartY = e.touches[0].clientY;
                            }, { passive: true });
                            modal.addEventListener('touchend', (e) => {
                                if (!this.showDetail) return;
                                const dx = e.changedTouches[0].clientX - touchStartX;
                                const dy = e.changedTouches[0].clientY - touchStartY;
                                if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                                    if (dx < 0 && this.detailIndex < this.speciesList.length) {
                                        this.goToSpecies(this.detailIndex);
                                    } else if (dx > 0 && this.detailIndex > 1) {
                                        this.goToSpecies(this.detailIndex - 2);
                                    }
                                }
                            }, { passive: true });
                        }
                    });
                },

                async fetchSpecies(reset = false) {
                    if (reset) {
                        this.offset = 0;
                        this.loading = true;
                    }

                    const params = new URLSearchParams({
                        mode: 'my',
                        q: this.searchQuery,
                        group: this.activeGroup,
                        sort: this.sortBy,
                        limit: this.limit,
                        offset: this.offset,
                    });

                    if (this.activeCategory) params.set('category', this.activeCategory);

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

                allPhotos() {
                    if (!this.detailEntry) return [];
                    const photos = [];
                    const seen = new Set();
                    if (this.detailEntry.cover_photo) {
                        photos.push(this.detailEntry.cover_photo);
                        seen.add(this.detailEntry.cover_photo);
                    }
                    for (const enc of (this.detailEntry.encounters || [])) {
                        for (const p of (enc.photos || [])) {
                            if (!seen.has(p)) { photos.push(p); seen.add(p); }
                        }
                    }
                    return photos;
                },

                visibleEncounters() {
                    if (!this.detailEntry || !this.detailEntry.encounters) return [];
                    if (this.timelineExpanded || this.detailEntry.encounters.length <= 5) {
                        return this.detailEntry.encounters;
                    }
                    return this.detailEntry.encounters.slice(0, 5);
                },

                async openDetail(item) {
                    this.detailIndex = this.speciesList.indexOf(item) + 1;
                    this.detailEntry = { ...item };
                    this.showDetail = true;
                    this.storyText = null;
                    this.storyLoading = false;
                    this.timelineExpanded = false;
                    this.galleryIndex = 0;
                    document.body.style.overflow = 'hidden';
                    history.pushState({ zukanDetail: true }, '', '#detail');

                    this.fetchStory(item.taxon_key);

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

                async goToSpecies(index) {
                    if (index < 0 || index >= this.speciesList.length) return;
                    if (index >= this.speciesList.length - 3 && this.hasMore && !this.loadingMore) {
                        this.loadMore();
                    }
                    const item = this.speciesList[index];
                    this.stopAudio();

                    const content = this.$el.querySelector('.zukan-modal__content');
                    if (content) {
                        const dir = index >= (this.detailIndex - 1) ? 1 : -1;
                        content.style.transition = 'transform 0.15s ease-out, opacity 0.15s';
                        content.style.transform = `translateX(${-dir * 30}px)`;
                        content.style.opacity = '0.3';
                        await new Promise(r => setTimeout(r, 150));

                        this.detailIndex = index + 1;
                        this.detailEntry = { ...item };
                        this.storyText = null;
                        this.storyLoading = false;
                        this.timelineExpanded = false;
                        this.galleryIndex = 0;

                        content.style.transform = `translateX(${dir * 30}px)`;
                        await new Promise(r => setTimeout(r, 10));
                        content.style.transform = 'translateX(0)';
                        content.style.opacity = '1';
                    } else {
                        this.detailIndex = index + 1;
                        this.detailEntry = { ...item };
                        this.storyText = null;
                        this.storyLoading = false;
                        this.timelineExpanded = false;
                        this.galleryIndex = 0;
                    }

                    this.fetchStory(item.taxon_key);

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
                        }
                    }

                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                        const mc = this.$el.querySelector('.zukan-modal__content');
                        if (mc) mc.scrollTop = 0;
                    });
                },

                async fetchStory(taxonKey) {
                    this.storyLoading = true;
                    try {
                        const res = await fetch('api/v2/species_story.php?taxon_key=' + encodeURIComponent(taxonKey));
                        const data = await res.json();
                        if (data.success && data.story) {
                            this.storyText = data.story;
                        }
                    } catch (err) {
                        console.error('Story fetch error:', err);
                    } finally {
                        this.storyLoading = false;
                    }
                },

                closeDetail() {
                    if (!this.showDetail) return;
                    this.showDetail = false;
                    document.body.style.overflow = '';
                    this.stopAudio();
                    if (location.hash === '#detail') {
                        history.back();
                    }
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
