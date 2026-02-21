<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/DataQuality.php';
Auth::init();

if (!Auth::isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$currentUser = Auth::user();

// --- 統計データ取得 ---
$myIdCount = $currentUser['id_count'] ?? 0;
$myScore = $currentUser['score'] ?? 0;

// 全体の統計（observationsキャッシュから取得）
$allObs = DataStore::fetchAll('observations');
$totalUnidentified = 0;
$totalProposed = 0;
$totalResearchGrade = 0;
$todayIdCount = 0;
$today = date('Y-m-d');

foreach ($allObs as $obs) {
    $status = $obs['quality_grade'] ?? ($obs['status'] ?? '未同定');
    if (!isset($obs['taxon']) || empty($obs['taxon'])) {
        $totalUnidentified++;
    } elseif (in_array($status, ['Research Grade', '研究用'])) {
        $totalResearchGrade++;
    } else {
        $totalProposed++;
    }
    // 今日の同定数
    if (isset($obs['identifications'])) {
        foreach ($obs['identifications'] as $id) {
            if (($id['user_id'] ?? '') === $currentUser['id']) {
                if (isset($id['created_at']) && str_starts_with($id['created_at'], $today)) {
                    $todayIdCount++;
                }
            }
        }
    }
}
$totalAll = count($allObs);
$identifiedPercent = $totalAll > 0 ? round((($totalAll - $totalUnidentified) / $totalAll) * 100) : 0;

// User expertise for recommended filter
$userExpertise = DataQuality::getUserExpertise($currentUser['id']);
$topExpertOrders = array_keys(array_slice($userExpertise, 0, 5, true));
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "同定センター — みんなの力で名前をつけよう";
    $meta_description = "まだ名前のない生き物たちが待っています。あなたの知識で名前を教えてあげよう。";
    include __DIR__ . '/components/meta.php';
    ?>
    <style>
        [x-cloak] {
            display: none !important;
        }

        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }

        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        /* Hero gradient */
        .hero-gradient {
            background: linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%);
        }

        /* Stat card glass */
        .stat-glass {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        /* Progress bar animation */
        @keyframes progressFill {
            from {
                width: 0%;
            }
        }

        .progress-animate {
            animation: progressFill 1.2s ease-out forwards;
        }

        /* Card hover glow */
        .id-card:hover {
            box-shadow: 0 0 0 2px var(--color-primary), 0 8px 24px rgba(16, 185, 129, 0.15);
        }

        /* Photo count dot */
        .photo-dots {
            display: flex;
            gap: 2px;
        }

        .photo-dots span {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
        }

        .photo-dots span:first-child {
            background: white;
        }
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] overflow-y-scroll">
    <?php include('components/nav.php'); ?>

    <main class="max-w-[1800px] mx-auto pt-16 pb-32" x-data="idCenter()">

        <!-- ===== HERO SECTION ===== -->
        <section class="hero-gradient text-white px-4 md:px-8 py-8 md:py-12 relative overflow-hidden">
            <!-- Background decoration -->
            <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div class="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3"></div>

            <div class="relative z-10 max-w-5xl mx-auto">
                <!-- Title -->
                <div class="flex items-center gap-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                        <i data-lucide="microscope" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h1 class="text-xl md:text-2xl font-black tracking-tight">同定センター</h1>
                        <p class="text-xs text-white/60 font-bold">みんなの力で名前をつけよう</p>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <!-- 未同定 -->
                    <div class="stat-glass rounded-xl p-4">
                        <div class="text-token-xs font-bold uppercase tracking-widest text-white/50 mb-1">待ってる子</div>
                        <div class="text-2xl md:text-3xl font-black"><?php echo $totalUnidentified; ?></div>
                        <div class="text-token-xs text-red-300/80 font-bold mt-1">名前を知りたい</div>
                    </div>
                    <!-- 提案済み -->
                    <div class="stat-glass rounded-xl p-4">
                        <div class="text-token-xs font-bold uppercase tracking-widest text-white/50 mb-1">確認待ち</div>
                        <div class="text-2xl md:text-3xl font-black"><?php echo $totalProposed; ?></div>
                        <div class="text-token-xs text-purple-300/80 font-bold mt-1">名前の提案あり</div>
                    </div>
                    <!-- あなたの貢献 -->
                    <div class="stat-glass rounded-xl p-4 border-white/25">
                        <div class="text-token-xs font-bold uppercase tracking-widest text-emerald-300/80 mb-1">あなたの同定</div>
                        <div class="text-2xl md:text-3xl font-black text-emerald-300"><?php echo $myIdCount; ?></div>
                        <div class="text-token-xs text-white/50 font-bold mt-1">今日 +<?php echo $todayIdCount; ?></div>
                    </div>
                    <!-- 研究用 -->
                    <div class="stat-glass rounded-xl p-4">
                        <div class="text-token-xs font-bold uppercase tracking-widest text-white/50 mb-1">研究用</div>
                        <div class="text-2xl md:text-3xl font-black text-yellow-300"><?php echo $totalResearchGrade; ?></div>
                        <div class="text-token-xs text-yellow-300/60 font-bold mt-1">Research Grade</div>
                    </div>
                </div>

                <!-- Community Progress Bar -->
                <div class="stat-glass rounded-xl p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-token-xs font-bold uppercase tracking-widest text-white/50">コミュニティ同定進捗</span>
                        <span class="text-sm font-black"><?php echo $identifiedPercent; ?>%</span>
                    </div>
                    <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full progress-animate" style="width: <?php echo $identifiedPercent; ?>%"></div>
                    </div>
                    <div class="flex items-center justify-between mt-2 text-token-xs text-white/40">
                        <span><?php echo ($totalAll - $totalUnidentified); ?> / <?php echo $totalAll; ?> 件</span>
                        <span>あと <?php echo $totalUnidentified; ?> 件で全件クリア！</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- ===== FILTER BAR ===== -->
        <header class="flex flex-col gap-3 mb-4 sticky top-14 z-30 bg-white/95 backdrop-blur-xl py-2 px-4 md:px-8 border-b border-gray-200 shadow-sm">
            <!-- Row 1: Title + Status Counts + Search -->
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 text-token-xs font-mono">
                        <span class="text-gray-500">QUEUE: <span x-text="filteredQueue.length" class="text-gray-900 font-bold"></span></span>
                        <span class="text-gray-600">|</span>
                        <span class="text-red-400/60 hidden sm:inline">要ID: <span x-text="counts.unidentified" class="font-bold"></span></span>
                        <span class="text-purple-400/60 hidden sm:inline">確認: <span x-text="counts.check" class="font-bold"></span></span>
                    </div>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                    <!-- Sort -->
                    <select x-model="sortMode" @change="sortQueue()" class="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-token-xs font-bold focus:outline-none focus:border-[var(--color-primary)] transition">
                        <option value="newest">新しい順</option>
                        <option value="oldest">古い順</option>
                        <option value="photos">写真多い順</option>
                    </select>
                    <!-- Search -->
                    <div class="relative group">
                        <i data-lucide="search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"></i>
                        <input type="text" x-model="search" placeholder="Filter..." class="bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-8 py-1.5 text-token-xs font-bold focus:outline-none focus:border-[var(--color-primary)] transition w-28 md:w-36">
                        <button x-show="search.length > 0" @click="savePreset()" class="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-[var(--color-primary)] hover:scale-110 transition" title="Save as Favorite">
                            <i data-lucide="star" class="w-3 h-3"></i>
                        </button>
                    </div>

                </div>
            </div>

            <!-- Row 2: Taxonomy Filter Tabs -->
            <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
                <!-- Taxon Groups -->
                <div class="p-0.5 bg-gray-100 rounded-lg flex gap-0.5 shrink-0">
                    <template x-for="tab in taxonTabs" :key="tab.id">
                        <button @click="setTaxonFilter(tab.id)"
                            :class="taxonFilter === tab.id 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'"
                            class="px-2 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1 whitespace-nowrap">
                            <span x-text="tab.icon" class="text-xs"></span>
                            <span x-text="tab.label"></span>
                            <span x-show="taxonFilter === tab.id && taxonCounts[tab.id] !== undefined"
                                x-text="taxonCounts[tab.id]"
                                class="ml-0.5 text-token-xs bg-gray-200 px-1 rounded-full"></span>
                        </button>
                    </template>
                </div>

                <div class="h-4 w-px bg-gray-200 shrink-0"></div>

                <!-- Status Filters -->
                <div class="p-0.5 bg-gray-100 rounded-lg flex gap-0.5 shrink-0">
                    <button @click="filter = 'all'" :class="filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition">All</button>
                    <button @click="filter = 'unidentified'" :class="filter === 'unidentified' ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="help-circle" class="w-3 h-3"></i> <span class="hidden lg:inline">UnID</span>
                    </button>
                    <button @click="filter = 'check'" :class="filter === 'check' ? 'bg-purple-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i> Verify
                    </button>
                </div>

                <div class="h-4 w-px bg-gray-200 shrink-0"></div>

                <!-- Local Filters -->
                <div class="p-0.5 bg-gray-100 rounded-lg flex gap-0.5 shrink-0">
                    <button @click="filter = 'pinned'" :class="filter === 'pinned' ? 'bg-yellow-50 text-yellow-600 border border-yellow-300' : 'text-gray-500 hover:text-gray-700'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="bookmark" class="w-3 h-3"></i> <span class="hidden md:inline">Pin</span>
                    </button>
                    <button @click="filter = 'passed'" :class="filter === 'passed' ? 'bg-red-50 text-red-600 border border-red-300' : 'text-gray-500 hover:text-gray-700'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1">
                        <i data-lucide="x" class="w-3 h-3"></i> <span class="hidden md:inline">Pass</span>
                    </button>
                </div>

                <?php if (!empty($topExpertOrders)): ?>
                    <div class="h-4 w-px bg-gray-200 shrink-0"></div>
                    <button @click="filter = 'recommended'" :class="filter === 'recommended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-sm' : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'" class="px-2.5 py-1 rounded-md text-token-xs font-bold transition flex items-center gap-1 shrink-0 border border-transparent">
                        <i data-lucide="sparkles" class="w-3 h-3"></i>
                        <span class="hidden md:inline">得意分野</span>
                        <span x-show="recommendedCount > 0" x-text="recommendedCount" class="ml-0.5 px-1.5 py-0 rounded-full bg-emerald-100 text-emerald-700 text-token-xs font-black"></span>
                    </button>
                <?php endif; ?>

                <!-- Saved Presets -->
                <template x-if="presets.length > 0">
                    <div class="flex items-center gap-1 border-l border-gray-200 pl-2 ml-1 shrink-0">
                        <template x-for="(p, idx) in presets" :key="idx">
                            <div class="group/p relative">
                                <button @click="search = p.query" class="px-2.5 py-1 pl-2.5 pr-6 rounded-md text-token-xs font-bold transition flex items-center gap-1 border hover:bg-gray-100" :class="search === p.query ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30' : 'text-gray-500 border-gray-200 bg-white'">
                                    <i data-lucide="tag" class="w-2.5 h-2.5 opacity-50"></i>
                                    <span x-text="p.label"></span>
                                </button>
                                <button @click.stop="removePreset(idx)" class="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-red-500 rounded-full hover:bg-gray-100 transition">
                                    <i data-lucide="x" class="w-2.5 h-2.5"></i>
                                </button>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
        </header>

        <!-- ===== GRID ===== -->
        <div class="px-4 md:px-8">
            <!-- Loading -->
            <div x-show="loading" class="py-32 text-center">
                <div class="w-12 h-12 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto mb-6"></div>
                <p class="text-gray-500 text-xs font-bold uppercase tracking-widest animate-pulse">記録を探しています...</p>
            </div>

            <!-- Grid -->
            <div x-show="!loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3" x-transition.opacity>
                <template x-for="(item, itemIdx) in filteredQueue" :key="item.id">
                    <div class="id-card group relative aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 transition duration-300 cursor-pointer"
                        @click="openQuickID(item, itemIdx)">

                        <!-- Image -->
                        <img :src="item.photos && item.photos[0] ? item.photos[0] : 'assets/img/no-photo.svg'" loading="lazy" class="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition duration-500 scale-100 group-hover:scale-105">

                        <!-- Top Status -->
                        <div class="absolute top-0 left-0 w-full p-2 flex justify-between items-start z-10 pointer-events-none">
                            <span x-show="item.taxon" class="px-1.5 py-0.5 bg-black/60 text-white text-token-xs font-bold rounded border border-white/10 backdrop-blur-md flex items-center gap-1">
                                <i data-lucide="message-square" class="w-2.5 h-2.5 text-[var(--color-primary)]"></i> Prop
                            </span>
                            <span x-show="!item.taxon" class="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-token-xs font-bold rounded border border-red-500/30 backdrop-blur-md">
                                UnID
                            </span>
                            <!-- Taxon group badge -->
                            <span x-show="getTaxonGroup(item)"
                                class="px-1.5 py-0.5 bg-black/60 text-token-xs font-bold rounded border border-white/10 backdrop-blur-md"
                                :class="getTaxonGroupColor(item)"
                                x-text="getTaxonGroupLabel(item)"></span>
                        </div>

                        <!-- Photo count indicator -->
                        <div x-show="item.photos && item.photos.length > 1" class="absolute top-2 right-2 z-10 pointer-events-none">
                            <div class="px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-token-xs font-bold text-white/80 flex items-center gap-1 border border-white/10">
                                <i data-lucide="image" class="w-2.5 h-2.5"></i>
                                <span x-text="item.photos ? item.photos.length : 0"></span>
                            </div>
                        </div>

                        <!-- Overlay Info & Controls -->
                        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent p-3 flex flex-col justify-end">

                            <div class="mb-2">
                                <!-- Observer -->
                                <div class="flex items-center gap-1.5 mb-1.5">
                                    <img :src="item.user_avatar || 'assets/img/default-avatar.svg'" class="w-4 h-4 rounded-full object-cover border border-white/20" loading="lazy">
                                    <span class="text-token-xs text-white/50 font-bold truncate" x-text="item.user_name || 'observer'"></span>
                                    <span class="text-token-xs text-white/30 ml-auto" x-text="relativeTime(item.observed_at)"></span>
                                </div>
                                <!-- Location -->
                                <p x-show="item.location_name" class="text-token-xs text-white/40 mb-1 flex items-center gap-1 truncate">
                                    <i data-lucide="map-pin" class="w-2 h-2 shrink-0"></i>
                                    <span x-text="item.location_name"></span>
                                </p>
                                <!-- Date + Name -->
                                <p class="text-token-xs text-gray-400 mb-0.5 font-mono flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-2.5 h-2.5"></i> <span x-text="formatDate(item.observed_at)"></span>
                                </p>
                                <h3 class="font-bold text-xs leading-tight text-white line-clamp-2 min-h-[2.5em] group-hover:text-[var(--color-primary)] transition" x-text="item.taxon ? item.taxon.name : 'Unknown Species'"></h3>
                                <!-- ID count -->
                                <div x-show="item.identifications && item.identifications.length > 0" class="mt-1 flex items-center gap-1">
                                    <i data-lucide="users" class="w-2.5 h-2.5 text-purple-400/60"></i>
                                    <span class="text-token-xs text-purple-300/60 font-bold" x-text="(item.identifications ? item.identifications.length : 0) + '件の提案'"></span>
                                </div>
                            </div>

                            <!-- Quick Actions Toolbar -->
                            <div class="grid grid-cols-3 gap-1 pt-2 border-t border-white/10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200" @click.stop>
                                <!-- Quick ID Button -->
                                <button @click="openQuickID(item, itemIdx)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-[var(--color-primary)] hover:text-black text-gray-400 transition group/btn" title="クイック同定">
                                    <i data-lucide="zap" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                    <span class="text-token-xs font-bold uppercase">ID</span>
                                </button>
                                <!-- Pin -->
                                <button @click="markLater(item.id)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-yellow-500 hover:text-black text-gray-400 transition group/btn" title="あとで">
                                    <i data-lucide="bookmark" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                    <span class="text-token-xs font-bold uppercase">Pin</span>
                                </button>
                                <!-- Pass -->
                                <button @click="markPass(item.id)" class="flex flex-col items-center justify-center py-1.5 rounded bg-white/5 hover:bg-red-500 hover:text-white text-gray-400 transition group/btn" title="パス">
                                    <i data-lucide="x" class="w-3.5 h-3.5 mb-0.5 group-hover/btn:scale-110 transition"></i>
                                    <span class="text-token-xs font-bold uppercase">Pass</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <!-- Empty State -->
            <div x-show="!loading && filteredQueue.length === 0" class="py-40 text-center text-gray-600 flex flex-col items-center justify-center">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <i data-lucide="check-circle" class="w-10 h-10 text-green-500"></i>
                </div>
                <h2 class="text-2xl font-black text-gray-900 mb-2">今は静かです</h2>
                <p>名前を待っている記録はありません。</p>
                <button @click="filter = 'all'; taxonFilter = 'all'" class="mt-8 text-sm text-[var(--color-primary)] hover:underline">フィルターをリセット</button>
            </div>
        </div>

    </main>

    <?php include('components/quick_identify.php'); ?>


    <script nonce="<?= CspNonce::attr() ?>">
        function idCenter() {
            return {
                loading: true,
                queue: [],
                filter: 'all',
                taxonFilter: 'all',
                search: '',
                sortMode: 'newest',
                skipped: [],
                later: [],
                presets: [],
                expertOrders: <?php echo json_encode($topExpertOrders, JSON_HEX_TAG | JSON_UNESCAPED_UNICODE); ?>,

                // Taxonomy filter tabs
                taxonTabs: [{
                        id: 'all',
                        label: 'すべて',
                        icon: '🌍'
                    },
                    {
                        id: 'insecta',
                        label: '昆虫',
                        icon: '🦗'
                    },
                    {
                        id: 'plantae',
                        label: '植物',
                        icon: '🌿'
                    },
                    {
                        id: 'aves',
                        label: '鳥類',
                        icon: '🐦'
                    },
                    {
                        id: 'mammalia',
                        label: '哺乳類',
                        icon: '🐾'
                    },
                    {
                        id: 'fish',
                        label: '魚類',
                        icon: '🐟'
                    },
                    {
                        id: 'fungi',
                        label: 'きのこ',
                        icon: '🍄'
                    },
                    {
                        id: 'other',
                        label: 'その他',
                        icon: '❓'
                    },
                ],

                // Mapping: taxon group ID → lineage keys to check
                _taxonGroupMap: {
                    'insecta': {
                        class: 'Insecta'
                    },
                    'plantae': {
                        kingdom: 'Plantae'
                    },
                    'aves': {
                        class: 'Aves'
                    },
                    'mammalia': {
                        class: 'Mammalia'
                    },
                    'fish': {
                        class: ['Actinopterygii', 'Chondrichthyes']
                    },
                    'fungi': {
                        kingdom: 'Fungi'
                    },
                },

                init() {
                    this.loadLocal();
                    this.fetchQueue();

                    // Listen for quick ID events
                    this.$watch('taxonFilter', (val) => {
                        localStorage.setItem('ikimon_taxon_filter', val);
                    });
                },



                loadLocal() {
                    try {
                        const s = localStorage.getItem('ikimon_skipped_ids');
                        if (s) this.skipped = JSON.parse(s);
                        const l = localStorage.getItem('ikimon_later_ids');
                        if (l) this.later = JSON.parse(l);
                        const p = localStorage.getItem('ikimon_search_presets');
                        if (p) this.presets = JSON.parse(p);
                        const tf = localStorage.getItem('ikimon_taxon_filter');
                        if (tf) this.taxonFilter = tf;
                        const sm = localStorage.getItem('ikimon_sort_mode');
                        if (sm) this.sortMode = sm;
                    } catch (e) {}
                },

                async fetchQueue() {
                    this.loading = true;
                    try {
                        const res = await fetch('api/get_observations.php?status=unresolved&limit=200');
                        const data = await res.json();
                        this.queue = data.data || [];
                        this.sortQueue();
                    } catch (e) {
                        console.error('Fetch queue failed:', e);
                    } finally {
                        this.loading = false;
                        this.$nextTick(() => lucide.createIcons());
                    }
                },

                sortQueue() {
                    localStorage.setItem('ikimon_sort_mode', this.sortMode);
                    if (this.sortMode === 'oldest') {
                        this.queue.sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));
                    } else if (this.sortMode === 'photos') {
                        this.queue.sort((a, b) => (b.photos?.length || 0) - (a.photos?.length || 0));
                    } else {
                        // newest (default)
                        this.queue.sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at));
                    }
                },

                setTaxonFilter(id) {
                    this.taxonFilter = id;
                },

                // Get lineage-based taxon group for an item
                getTaxonGroup(item) {
                    if (!item || !item.taxon || !item.taxon.lineage) return null;
                    const lin = item.taxon.lineage;
                    for (const [groupId, checks] of Object.entries(this._taxonGroupMap)) {
                        for (const [rank, expected] of Object.entries(checks)) {
                            const val = lin[rank];
                            if (Array.isArray(expected)) {
                                if (expected.includes(val)) return groupId;
                            } else if (val === expected) {
                                return groupId;
                            }
                        }
                    }
                    return 'other';
                },

                getTaxonGroupLabel(item) {
                    const g = this.getTaxonGroup(item);
                    const tab = this.taxonTabs.find(t => t.id === g);
                    return tab ? tab.icon : '';
                },

                getTaxonGroupColor(item) {
                    const g = this.getTaxonGroup(item);
                    const colors = {
                        'insecta': 'text-amber-400',
                        'plantae': 'text-green-400',
                        'aves': 'text-sky-400',
                        'mammalia': 'text-orange-400',
                        'fish': 'text-blue-400',
                        'fungi': 'text-rose-400',
                        'other': 'text-gray-400'
                    };
                    return colors[g] || 'text-gray-400';
                },

                // Status counts
                get counts() {
                    const unid = this.queue.filter(i => !i.taxon && !this.skipped.includes(i.id)).length;
                    const check = this.queue.filter(i => !!i.taxon && !this.skipped.includes(i.id)).length;
                    return {
                        unidentified: unid,
                        check: check
                    };
                },

                // Taxon group counts
                get taxonCounts() {
                    const c = {};
                    this.taxonTabs.forEach(tab => {
                        if (tab.id === 'all') {
                            c[tab.id] = this.queue.filter(i => !this.skipped.includes(i.id)).length;
                        } else {
                            c[tab.id] = this.queue.filter(i => !this.skipped.includes(i.id) && this.getTaxonGroup(i) === tab.id).length;
                        }
                    });
                    return c;
                },

                get filteredQueue() {
                    return this.queue.filter(item => {
                        // Text search
                        if (this.search) {
                            const q = this.search.toLowerCase();
                            const name = item.taxon ? item.taxon.name : '';
                            const sname = item.taxon ? (item.taxon.scientific_name || '') : '';
                            if (!name.toLowerCase().includes(q) && !sname.toLowerCase().includes(q)) return false;
                        }

                        // Pinned/Passed views
                        if (this.filter === 'pinned') return this.later.includes(item.id);
                        if (this.filter === 'passed') return this.skipped.includes(item.id);

                        // Exclude skipped
                        if (this.skipped.includes(item.id)) return false;

                        // Status filter
                        if (this.filter === 'unidentified') {
                            if (item.taxon) return false;
                        }
                        if (this.filter === 'check') {
                            if (!item.taxon) return false;
                        }

                        // Taxon group filter
                        if (this.taxonFilter !== 'all') {
                            const group = this.getTaxonGroup(item);
                            if (group !== this.taxonFilter) return false;
                        }

                        // Recommended (expertise) filter
                        if (this.filter === 'recommended') {
                            if (item.taxon) return false; // already identified
                            const order = item.taxon_lineage?.order || item.lineage?.order || '';
                            if (!order || !this.expertOrders.includes(order)) return false;
                        }

                        return true;
                    });
                },

                get recommendedCount() {
                    if (!this.expertOrders || this.expertOrders.length === 0) return 0;
                    return this.queue.filter(item => {
                        if (this.skipped.includes(item.id)) return false;
                        if (item.taxon) return false;
                        const order = item.taxon_lineage?.order || item.lineage?.order || '';
                        return order && this.expertOrders.includes(order);
                    }).length;
                },

                openQuickID(item, index) {
                    this.$dispatch('open-quick-id', {
                        item: item,
                        queue: this.filteredQueue,
                        index: index
                    });
                },

                savePreset() {
                    if (!this.search) return;
                    if (this.presets.some(p => p.query === this.search)) return;
                    const label = this.search.length > 8 ? this.search.substring(0, 8) + '...' : this.search;
                    this.presets.push({
                        label,
                        query: this.search
                    });
                    localStorage.setItem('ikimon_search_presets', JSON.stringify(this.presets));
                    this.$nextTick(() => lucide.createIcons());
                },

                removePreset(index) {
                    this.presets.splice(index, 1);
                    localStorage.setItem('ikimon_search_presets', JSON.stringify(this.presets));
                },

                markPass(id) {
                    if (!this.skipped.includes(id)) {
                        this.skipped.push(id);
                        localStorage.setItem('ikimon_skipped_ids', JSON.stringify(this.skipped));
                    }
                },

                markLater(id) {
                    if (!this.later.includes(id)) {
                        this.later.push(id);
                        localStorage.setItem('ikimon_later_ids', JSON.stringify(this.later));
                    }
                },

                formatDate(d) {
                    return new Date(d).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                    });
                },

                relativeTime(d) {
                    if (!d) return '';
                    const now = new Date();
                    const then = new Date(d);
                    const diff = Math.floor((now - then) / 1000);
                    if (diff < 60) return 'たった今';
                    if (diff < 3600) return Math.floor(diff / 60) + '分前';
                    if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
                    if (diff < 604800) return Math.floor(diff / 86400) + '日前';
                    return then.toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric'
                    });
                }
            }
        }

        // Handle events from quick_identify component
        document.addEventListener('identification-submitted', function(e) {
            // Could refresh the queue here
            console.log('ID submitted for:', e.detail.observationId);
        });

        document.addEventListener('quick-id-action', function(e) {
            // Handle pass/later from quick identify panel
            const {
                action,
                observationId
            } = e.detail;
            const app = document.querySelector('[x-data]').__x;
            // Alpine will handle via its own reactivity
        });
    </script>
</body>

</html>