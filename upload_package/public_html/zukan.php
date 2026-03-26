<?php

/**
 * いきもん図鑑 — Species Index
 * Dynamic species catalog with golden-ratio UI.
 * 
 * @version 2.0.0
 * @since 2026-02-15
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
$sortBy = $_GET['sort'] ?? 'obs_count';

// Initial server-side render (first page of results)
$result = ZukanService::getSpeciesList([
    'q'      => $searchQuery,
    'group'  => $activeGroup,
    'sort'   => $sortBy,
    'limit'  => 24,
    'offset' => 0,
]);

$species = $result['data'];
$totalSpecies = $result['total'];
$hasMore = $result['has_more'];
$stats = $result['stats'];

// User collection stats (if logged in)
$userStats = null;
if ($isLoggedIn) {
    $userStats = ZukanService::getUserCollectionStats($userId);
}

// Meta
$meta_title = "いきもん図鑑";
$meta_description = "いきもんで確認された{$stats['total_species']}種の生き物。地域の生物多様性を探索しよう。";

// Species URL helper
function speciesUrl($item)
{
    $name = $item['name'] ?? '';
    return 'species.php?jp=' . urlencode($name);
}

// Red List badge CSS class
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
    <link rel="stylesheet" href="assets/css/zukan.css?v=2.0">
</head>

<body class="app-body bg-base text-text font-body" x-data="zukanApp()" x-init="init()">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <!-- ═══ Hero Stats Section ═══ -->
    <section class="zukan-hero">
        <div class="zukan-hero__inner">
            <h1 class="zukan-hero__title">🌿 いきもん図鑑</h1>
            <p class="zukan-hero__subtitle">地域で確認された種を、図鑑のように見渡す場所</p>

            <div class="zukan-stats">
                <div class="zukan-stat">
                    <span class="zukan-stat__number" x-text="stats.total_species"><?php echo $stats['total_species']; ?></span>
                    <span class="zukan-stat__label">確認種</span>
                </div>
                <div class="zukan-stat">
                    <span class="zukan-stat__number zukan-stat__number--secondary" x-text="formatNumber(stats.total_obs)"><?php echo number_format($stats['total_obs']); ?></span>
                    <span class="zukan-stat__label">観察記録</span>
                </div>
                <div class="zukan-stat">
                    <span class="zukan-stat__number zukan-stat__number--accent" x-text="stats.rg_rate + '%'"><?php echo $stats['rg_rate']; ?>%</span>
                    <span class="zukan-stat__label">RG率</span>
                </div>
            </div>

            <?php if ($isLoggedIn && $userStats): ?>
                <!-- My Collection Progress -->
                <div class="zukan-progress">
                    <div class="zukan-progress__header">
                        <span class="zukan-progress__label">📖 マイコレクション</span>
                        <span class="zukan-progress__count"><?php echo $userStats['found']; ?> / <?php echo $userStats['total']; ?> 種</span>
                    </div>
                    <div class="zukan-progress__bar">
                        <div class="zukan-progress__fill" style="width: <?php echo min($userStats['percentage'], 100); ?>%"></div>
                    </div>
                </div>
            <?php endif; ?>
        </div>
    </section>

    <?php if (!$isLoggedIn): ?>
        <!-- Guest Banner -->
        <div class="zukan-guest-banner">
            <div class="zukan-guest-banner__card">
                <div class="zukan-guest-banner__text">
                    <div class="zukan-guest-banner__heading">📖 マイ図鑑をはじめよう</div>
                    <div class="zukan-guest-banner__desc">ログインして、自分だけの生き物コレクションを記録しよう。</div>
                </div>
                <a href="login.php" class="btn-primary" style="flex-shrink:0;">ログイン</a>
            </div>
        </div>
    <?php endif; ?>

    <!-- ═══ Toolbar (Search + Filters) ═══ -->
    <div class="zukan-toolbar">
        <div class="flex flex-wrap items-center gap-2" style="gap: var(--zukan-space-sm)">
            <div class="zukan-search" style="flex: 1; min-width: 200px;">
                <i data-lucide="search" class="zukan-search__icon" style="width:18px; height:18px;"></i>
                <input type="text"
                    class="zukan-search__input"
                    placeholder="種名で検索..."
                    x-model="searchQuery"
                    @input.debounce.400ms="fetchSpecies(true)"
                    value="<?php echo htmlspecialchars($searchQuery); ?>">
            </div>

            <div class="zukan-sort">
                <span class="zukan-sort__label">並び替え</span>
                <select class="zukan-sort__select" x-model="sortBy" @change="fetchSpecies(true)">
                    <option value="obs_count">観察件数順</option>
                    <option value="name">名前順</option>
                    <option value="latest">最新順</option>
                </select>
            </div>
        </div>

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
            <?php if ($isLoggedIn): ?>
                <button class="zukan-filter-chip"
                    :class="{'zukan-filter-chip--active': myCollectionOnly}"
                    @click="toggleMyCollection()"
                    style="border-color: var(--color-accent); color: var(--color-accent);">
                    ⭐ マイコレクション
                </button>
            <?php endif; ?>
        </div>
    </div>

    <!-- ═══ Species Grid ═══ -->
    <div class="zukan-grid" id="zukan-grid">
        <template x-if="!loading && speciesList.length === 0">
            <div class="zukan-empty" style="grid-column: 1 / -1;">
                <div class="zukan-empty__icon">🔍</div>
                <div class="zukan-empty__text">条件に一致する種が見つかりませんでした</div>
            </div>
        </template>

        <template x-for="(item, idx) in speciesList" :key="item.taxon_key">
            <a :href="'species.php?jp=' + encodeURIComponent(item.name)"
                class="zukan-card zukan-card--animated"
                :style="'animation-delay: ' + (idx % 24) * 40 + 'ms'">
                <!-- Photo -->
                <div class="zukan-card__photo">
                    <template x-if="item.photo">
                        <img :src="item.photo"
                            :alt="item.name"
                            class="zukan-card__img"
                            loading="lazy">
                    </template>
                    <template x-if="!item.photo">
                        <div class="zukan-card__placeholder">
                            <i data-lucide="camera-off" style="width:28px; height:28px; opacity:0.3;"></i>
                        </div>
                    </template>

                    <!-- Research Grade star -->
                    <template x-if="item.rg_count > 0">
                        <div class="zukan-card__rg" title="Research Grade あり">⭐</div>
                    </template>

                    <!-- Red List badge -->
                    <template x-if="item.red_list && item.red_list.ranks">
                        <div class="zukan-card__rl"
                            :class="'zukan-card__rl--' + getRlClass(item.red_list)"
                            x-text="getRlLabel(item.red_list)">
                        </div>
                    </template>
                </div>

                <!-- Text Body -->
                <div class="zukan-card__body">
                    <div class="zukan-card__name" x-text="item.name"></div>
                    <div class="zukan-card__sci" x-text="item.scientific_name"></div>
                    <div class="text-xs leading-relaxed text-muted mt-1.5 min-h-[2.4rem]" x-text="item.summary || ''"></div>
                    <div class="zukan-card__meta">
                        <span class="zukan-card__count">
                            <i data-lucide="eye" style="width:12px; height:12px;"></i>
                            <span x-text="item.obs_count"></span>
                        </span>
                        <span class="zukan-card__observers">
                            <i data-lucide="users" style="width:12px; height:12px;"></i>
                            <span x-text="item.observer_count"></span>
                        </span>
                    </div>
                </div>
            </a>
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

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        function zukanApp() {
            return {
                // State
                speciesList: <?php echo json_encode($species, JSON_UNESCAPED_UNICODE); ?>,
                totalResults: <?php echo $totalSpecies; ?>,
                hasMore: <?php echo $hasMore ? 'true' : 'false'; ?>,
                stats: <?php echo json_encode($stats, JSON_UNESCAPED_UNICODE); ?>,

                // UI state
                searchQuery: '<?php echo htmlspecialchars($searchQuery, ENT_QUOTES); ?>',
                activeGroup: '<?php echo htmlspecialchars($activeGroup, ENT_QUOTES); ?>',
                sortBy: '<?php echo htmlspecialchars($sortBy, ENT_QUOTES); ?>',
                myCollectionOnly: false,
                loading: false,
                loadingMore: false,
                offset: <?php echo count($species); ?>,
                limit: 24,

                init() {
                    // Re-init Lucide icons after Alpine renders
                    this.$nextTick(() => {
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    });
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

                    if (this.myCollectionOnly) {
                        params.set('user_id', '<?php echo $userId ?? ''; ?>');
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
                    // Update URL without reload
                    const url = new URL(window.location);
                    if (group) url.searchParams.set('group', group);
                    else url.searchParams.delete('group');
                    history.replaceState(null, '', url);
                },

                toggleMyCollection() {
                    this.myCollectionOnly = !this.myCollectionOnly;
                    this.fetchSpecies(true);
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
                }
            };
        }
    </script>

    <script nonce="<?= CspNonce::attr() ?>">
        // Re-initialize Lucide when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>

</body>

</html>
