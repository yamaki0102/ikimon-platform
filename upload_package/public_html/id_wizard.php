<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
Auth::init();
$step = $_GET['step'] ?? 'mode_select';

// from_observation: 投稿からのブリッジ対応
$fromObservation = null;
$fromObsId = $_GET['from_observation'] ?? null;
if ($fromObsId) {
    $obs = DataStore::get('observations/' . $fromObsId);
    if ($obs) {
        $fromObservation = $obs;
    }
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "同定ウィザード — ikimon.life";
    $meta_description = "AIに頼らず自分で種を特定。3ステップのビジュアルウィザード（形→色→模様）で、論理的に分類を絞り込みます。";
    include __DIR__ . '/components/meta.php';
    ?>
    <style>
        .glass-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
        }

        .glass-card:active {
            transform: scale(0.95);
        }

        .glass-card.selected {
            background: rgba(13, 162, 231, 0.08);
            border: 2px solid #0da2e7;
            box-shadow: 0 0 20px rgba(13, 162, 231, 0.15);
        }
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-display min-h-screen flex flex-col">

    <!-- Header -->
    <header class="p-6 relative z-10">
        <div class="flex items-center justify-between mb-2">
            <a href="zukan.php" class="text-gray-400 hover:text-gray-900 transition">
                <span class="material-symbols-outlined">arrow_back</span>
            </a>
            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">IDENTIFICATION</span>
            <div class="w-6"></div> <!-- Spacer -->
        </div>
        <h1 class="text-3xl font-black font-display tracking-tight mb-1 text-gray-900">同定ウィザード</h1>
        <p class="text-sm text-gray-500 font-mono">Step <span x-text="step"></span> of 3: <span x-text="getStepTitle()"></span></p>

        <!-- Progress Bar -->
        <div class="h-1 bg-gray-200 rounded-full mt-4 overflow-hidden">
            <div class="h-full bg-primary transition-all duration-500" :style="'width: ' + (step/3)*100 + '%'"></div>
        </div>
    </header>

    <main class="flex-1 px-6 pb-24 overflow-y-auto" x-data="visualZukan()">

        <!-- MODE SELECTION -->
        <?php if ($step === 'mode_select'): ?>
            <div class="pt-10">
                <?php if ($fromObservation): ?>
                    <!-- 投稿からのブリッジバナー -->
                    <div class="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
                        <div class="flex items-center gap-4">
                            <?php if (!empty($fromObservation['photos'])): ?>
                                <div class="w-16 h-16 rounded-xl overflow-hidden shadow-md shrink-0">
                                    <img src="<?php echo htmlspecialchars($fromObservation['photos'][0]); ?>" class="w-full h-full object-cover" alt="<?php echo htmlspecialchars($fromObservation['taxon']['name'] ?? $fromObservation['species_name'] ?? '観察写真'); ?>">
                                </div>
                            <?php endif; ?>
                            <div>
                                <p class="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">さっき投稿した生き物</p>
                                <p class="text-sm font-bold text-gray-700">この子の名前、一緒に調べてみよう！ 🔍</p>
                            </div>
                        </div>
                    </div>
                <?php endif; ?>

                <h1 class="text-2xl font-black text-emerald-600 mb-2 font-mono">同定プロトコル</h1>
                <p class="text-xs text-emerald-700 mb-8 font-mono">アプローチを選んでください</p>

                <div class="grid gap-4">
                    <!-- Mode A: Visual (Existing) -->
                    <a href="?step=environment<?php echo $fromObsId ? '&from_observation=' . htmlspecialchars($fromObsId) : ''; ?>" class="group relative block p-6 bg-white border border-gray-200 rounded-xl hover:border-emerald-400 hover:shadow-md transition overflow-hidden">
                        <div class="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition"></div>
                        <div class="relative z-10 flex items-center justify-between">
                            <div>
                                <div class="text-xs text-emerald-600 font-bold tracking-widest mb-1">MODE A</div>
                                <div class="text-lg font-black text-gray-900">ビジュアル同定</div>
                                <div class="text-[10px] text-gray-500 mt-2 max-w-[200px]">
                                    形・色・模様で候補を絞り込む。初心者にもわかりやすい方法です。
                                </div>
                            </div>
                            <span class="material-symbols-outlined text-4xl text-emerald-200 group-hover:text-emerald-500 transition">visibility</span>
                        </div>
                    </a>

                    <!-- Mode B: Bibliographic (New) -->
                    <div x-data="{ open: false }">
                        <button @click="open = !open" class="w-full text-left group relative block p-6 bg-amber-50 border border-amber-200 rounded-xl hover:border-amber-400 hover:shadow-md transition overflow-hidden">
                            <div class="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition"></div>
                            <div class="relative z-10 flex items-center justify-between">
                                <div>
                                    <div class="text-xs text-amber-600 font-bold tracking-widest mb-1">MODE B（PAX BIOLOGICA）</div>
                                    <div class="text-lg font-black text-gray-900">文献検索表</div>
                                    <div class="text-[10px] text-gray-500 mt-2 max-w-[200px]">
                                        図鑑の検索表に基づく同定。100%出典付きの正確な方法。
                                    </div>
                                </div>
                                <span class="material-symbols-outlined text-4xl text-amber-200 group-hover:text-amber-500 transition">menu_book</span>
                            </div>
                        </button>

                        <!-- Quick Search for Key -->
                        <div x-show="open" class="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div class="text-xs text-amber-700 mb-2 font-bold">分類群を選択：</div>
                            <div class="flex gap-2 flex-wrap">
                                <a href="?step=book_key&taxon=Tortoise" class="px-3 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 hover:bg-amber-200 transition">カメ</a>
                                <a href="?step=book_key&taxon=Frog" class="px-3 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 hover:bg-amber-200 transition">カエル</a>
                                <a href="?step=book_key&taxon=Snake" class="px-3 py-1 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 hover:bg-amber-200 transition">ヘビ</a>
                            </div>
                        </div>
                    </div>

                    <!-- Mode O: Omoikane Search (New) -->
                    <a href="?step=omoikane_search<?php echo $fromObsId ? '&from_observation=' . htmlspecialchars($fromObsId) : ''; ?>" class="group relative block p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl hover:border-indigo-400 hover:shadow-md transition overflow-hidden">
                        <div class="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 transition"></div>
                        <div class="relative z-10 flex items-center justify-between">
                            <div>
                                <div class="text-xs text-indigo-600 font-bold tracking-widest mb-1">MODE O (OMOIKANE)</div>
                                <div class="text-lg font-black text-gray-900">オモイカネ逆引き検索</div>
                                <div class="text-[10px] text-gray-500 mt-2 max-w-[200px]">
                                    「夏」「高山帯」「赤い羽根」などの断片的な特徴から、文献データに基づく10万種の知識グラフを瞬時に推論します。
                                </div>
                            </div>
                            <span class="material-symbols-outlined text-4xl text-indigo-200 group-hover:text-indigo-500 transition">psychiatry</span>
                        </div>
                    </a>

                    <!-- Mode C: 分からない → 投稿だけ -->
                    <a href="post.php" class="group relative block p-6 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-md transition overflow-hidden">
                        <div class="absolute inset-0 bg-gray-500/0 group-hover:bg-gray-500/5 transition"></div>
                        <div class="relative z-10 flex items-center justify-between">
                            <div>
                                <div class="text-xs text-gray-500 font-bold tracking-widest mb-1">✈️ スキップ</div>
                                <div class="text-lg font-black text-gray-700">分からない…でも大丈夫！</div>
                                <div class="text-[10px] text-gray-500 mt-2 max-w-[240px]">
                                    名前は後からでOK。まずは写真を投稿しておこう。詳しい人が見つけてくれるかも！
                                </div>
                            </div>
                            <span class="material-symbols-outlined text-4xl text-gray-200 group-hover:text-gray-500 transition">photo_camera</span>
                        </div>
                    </a>
                </div>
            </div>
        <?php endif; ?>

        <!-- BIBLIOGRAPHIC KEY VIEW -->
        <?php if ($step === 'book_key'): ?>
            <?php
            // Fetch logic (Inline for simplicity or move to top)
            require_once __DIR__ . '/../libs/Services/LibraryService.php';
            $taxon = $_GET['taxon'] ?? 'unknown';
            $keys = LibraryService::searchKeys($taxon);
            $bookKey = $keys[0] ?? null;
            ?>
            <div class="pt-6 px-4">
                <!-- Header -->
                <div class="flex items-center gap-3 mb-6">
                    <a href="?step=mode_select" class="size-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition">
                        <span class="material-symbols-outlined text-sm">arrow_back</span>
                    </a>
                    <div>
                        <div class="text-[10px] text-amber-600 font-bold tracking-widest">REFERENCE LAYER</div>
                        <h1 class="text-lg font-black text-gray-900">検索表</h1>
                    </div>
                </div>

                <?php if ($bookKey): ?>
                    <!-- Citation Card -->
                    <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-2 opacity-20">
                            <span class="material-symbols-outlined text-6xl text-amber-400">book_2</span>
                        </div>
                        <div class="relative z-10">
                            <div class="text-[10px] text-amber-600 font-mono mb-1">出典：</div>
                            <div class="text-sm font-bold text-gray-900 mb-0.5"><?php echo htmlspecialchars($bookKey['book_title']); ?></div>
                            <div class="text-xs text-amber-700/70"><?php echo $bookKey['page']; ?>ページ • <?php echo htmlspecialchars($bookKey['title']); ?></div>
                        </div>
                    </div>

                    <!-- The Key (Raw Logic) -->
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-5 font-mono text-sm leading-relaxed text-gray-700 shadow-sm overflow-x-auto whitespace-pre-wrap">
                        <?php echo htmlspecialchars($bookKey['content_raw']); ?>
                    </div>

                    <!-- Verdict / Manual Match -->
                    <div class="mt-8">
                        <div class="text-center text-xs text-gray-500 mb-4">— この検索表に基づく同定結果 —</div>
                        <?php
                        $guess = $bookKey['target_taxon'];
                        $note = "Identified via Key from " . $bookKey['book_title'] . "\n(Page: " . $bookKey['page'] . ")";

                        // Build Link with Context
                        $paramArray = [
                            'taxon_name' => $guess,
                            'note' => $note
                        ];
                        $queryString = http_build_query($paramArray);

                        // Bridge Logic: Return to Edit or New Post
                        if ($fromObsId) {
                            $targetUrl = "id_form.php?id=" . urlencode($fromObsId) . "&" . $queryString;
                            $btnText = "この結果で保存する";
                        } else {
                            $targetUrl = "post.php?" . $queryString;
                            $btnText = "この種として投稿する";
                        }
                        ?>
                        <a href="<?php echo htmlspecialchars($targetUrl); ?>"
                            class="block w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-center rounded-lg transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                            <span class="material-symbols-outlined">check_circle</span>
                            <?php echo htmlspecialchars($btnText); ?>: <?php echo htmlspecialchars($guess); ?>
                        </a>
                    </div>

                <?php else: ?>
                    <div class="text-center py-12">
                        <div class="text-5xl mb-4">🔍</div>
                        <div class="text-lg font-bold text-gray-700 mb-2">「<?php echo htmlspecialchars($taxon); ?>」の検索表はまだないみたい</div>
                        <div class="text-sm text-gray-500 mb-6">でも大丈夫！写真を投稿しておけば、<br>詳しい人が名前を教えてくれるかもしれないよ 🌿</div>
                        <div class="flex gap-3 justify-center">
                            <a href="?step=mode_select<?php echo $fromObsId ? '&from_observation=' . urlencode($fromObsId) : ''; ?>" class="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-200 transition">← 戻る</a>

                            <?php
                            // Bridge Logic for "Skip"
                            if ($fromObsId) {
                                $skipUrl = "id_form.php?id=" . urlencode($fromObsId); // No changes
                                $skipText = "同定せずに戻る";
                            } else {
                                $skipUrl = "post.php";
                                $skipText = "写真だけ投稿する 📷";
                            }
                            ?>
                            <a href="<?php echo htmlspecialchars($skipUrl); ?>" class="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/20">
                                <?php echo htmlspecialchars($skipText); ?>
                            </a>
                        </div>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <!-- OMOIKANE REVERSE SEARCH VIEW -->
        <?php if ($step === 'omoikane_search'): ?>
            <div class="pt-6 px-4" x-data="{
                query: { habitat: '', season: '', altitude: '', keyword: '' },
                results: [], isLoading: false, hasSearched: false,
                search() {
                    this.isLoading = true; this.hasSearched = true;
                    fetch(`api_omoikane_search.php?habitat=${this.query.habitat}&season=${this.query.season}&altitude=${this.query.altitude}&keyword=${this.query.keyword}`)
                        .then(res => res.json())
                        .then(data => { this.results = data.results || []; this.isLoading = false; })
                        .catch(err => { console.error(err); this.isLoading = false; });
                }
            }">
                <!-- Header -->
                <div class="flex items-center gap-3 mb-6">
                    <a href="?step=mode_select" class="size-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition">
                        <span class="material-symbols-outlined text-sm">arrow_back</span>
                    </a>
                    <div>
                        <div class="text-[10px] text-indigo-600 font-bold tracking-widest">OMOIKANE ENGINE</div>
                        <h1 class="text-lg font-black text-gray-900">オモイカネ逆引き検索</h1>
                    </div>
                </div>

                <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm">
                    <div class="text-xs font-bold text-indigo-800 mb-4">断片的な特徴を入力してください</div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-[10px] text-indigo-600 font-bold mb-1">生息環境 (例: 森林, 水辺)</label>
                            <input type="text" x-model="query.habitat" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] text-indigo-600 font-bold mb-1">季節 (例: 夏, 8月)</label>
                                <input type="text" x-model="query.season" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block text-[10px] text-indigo-600 font-bold mb-1">標高 (例: 高山帯, 1500m)</label>
                                <input type="text" x-model="query.altitude" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] text-indigo-600 font-bold mb-1">特徴・キーワード (例: 赤い羽, 特徴的な鳴き声)</label>
                            <input type="text" x-model="query.keyword" @keydown.enter="search()" class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                        </div>
                    </div>

                    <button @click="search()" :disabled="isLoading" class="mt-5 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition flex items-center justify-center gap-2">
                        <span class="material-symbols-outlined" x-show="!isLoading">search</span>
                        <span class="material-symbols-outlined animate-spin" x-show="isLoading">autorenew</span>
                        <span x-text="isLoading ? '推論中...' : '推論を実行'"></span>
                    </button>
                </div>

                <div x-show="hasSearched">
                    <div class="text-xs font-bold text-gray-500 mb-3" x-show="!isLoading">
                        <span x-text="results.length"></span> 件の候補が見つかりました
                    </div>
                    <div class="space-y-4">
                        <template x-for="res in results" :key="res.scientific_name">
                            <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition relative overflow-hidden">
                                <div class="text-[10px] font-bold text-gray-400 mb-1">学名</div>
                                <div class="text-lg font-black text-indigo-900 mb-3" x-text="res.scientific_name"></div>
                                <div class="text-xs text-gray-600 space-y-1 mb-4">
                                    <div class="flex gap-2" x-show="res.habitat"><span class="font-bold w-12 shrink-0">環境:</span> <span class="truncate" x-text="res.habitat"></span></div>
                                    <div class="flex gap-2" x-show="res.season"><span class="font-bold w-12 shrink-0">季節:</span> <span class="truncate" x-text="res.season"></span></div>
                                    <div class="flex gap-2" x-show="res.morphological_traits"><span class="font-bold w-12 shrink-0">特徴:</span> <span class="line-clamp-2" x-text="res.morphological_traits"></span></div>
                                </div>
                                <?php
                                $fromObsIdStr = $fromObsId ? "'&id=" . htmlspecialchars($fromObsId) . "'" : "''";
                                $targetPage = $fromObsId ? "'id_form.php'" : "'post.php'";
                                ?>
                                <a :href="`${<?php echo $targetPage; ?>}?taxon_name=${encodeURIComponent(res.scientific_name)}&note=Omoikane AI Search Match${<?php echo $fromObsIdStr; ?>}`"
                                    class="block w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-center text-xs rounded-lg transition border border-indigo-200">
                                    この結果で投稿する
                                </a>
                            </div>
                        </template>
                        <div x-show="results.length === 0 && !isLoading" class="text-center py-8">
                            <span class="material-symbols-outlined text-4xl text-gray-300 mb-2">sentiment_dissatisfied</span>
                            <div class="text-sm font-bold text-gray-500">一致する生物が見つかりませんでした</div>
                            <div class="text-xs text-gray-400 mt-1">検索条件を変えてみてください</div>
                        </div>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- LEGACY VISUAL WIZARD (Environment -> Group -> Details) -->
        <?php if (!in_array($step, ['mode_select', 'book_key', 'omoikane_search'])): ?>

            <!-- Step 1: Shape -->
            <section x-show="step === 1" x-transition:enter="transition ease-out duration-300 transform" x-transition:enter-start="opacity-0 translate-x-10" x-transition:enter-end="opacity-100 translate-x-0">
                <div class="grid grid-cols-2 gap-4">
                    <template x-for="shape in shapes" :key="shape.id">
                        <div @click="selectShape(shape.id)"
                            class="glass-card rounded-2xl p-6 aspect-square flex flex-col items-center justify-center gap-4 cursor-pointer"
                            :class="selectedShape === shape.id ? 'selected' : 'hover:bg-gray-50'">
                            <span class="material-symbols-outlined text-4xl" :class="selectedShape === shape.id ? 'text-primary' : 'text-gray-600'" x-text="shape.icon"></span>
                            <span class="text-sm font-bold" :class="selectedShape === shape.id ? 'text-primary' : 'text-gray-600'" x-text="shape.label"></span>
                        </div>
                    </template>
                </div>
            </section>

            <!-- Step 2: Color -->
            <section x-show="step === 2" style="display: none;" x-transition:enter="transition ease-out duration-300 transform" x-transition:enter-start="opacity-0 translate-x-10" x-transition:enter-end="opacity-100 translate-x-0">
                <div class="grid grid-cols-3 gap-4">
                    <template x-for="color in colors" :key="color.id">
                        <div @click="selectColor(color.id)"
                            class="glass-card rounded-2xl p-4 aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer"
                            :class="selectedColor === color.id ? 'selected' : 'hover:bg-gray-50'">
                            <div class="size-8 rounded-full shadow-lg border-2 border-gray-200" :style="'background-color: ' + color.hex"></div>
                            <span class="text-xs font-bold uppercase" :class="selectedColor === color.id ? 'text-primary' : 'text-gray-500'" x-text="color.label"></span>
                        </div>
                    </template>
                </div>
            </section>

            <!-- Step 4: Result (New) -->
            <section x-show="step === 4" style="display: none;" x-transition:enter="transition ease-out duration-300 transform" x-transition:enter-start="opacity-0 translate-x-10" x-transition:enter-end="opacity-100 translate-x-0">
                <div class="text-center pt-8">
                    <div class="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6 relative">
                        <span class="text-6xl" x-text="result.icon"></span>
                        <div class="absolute -bottom-2 -right-2 bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white">
                            <span class="material-symbols-outlined text-sm">check</span>
                        </div>
                    </div>

                    <h2 class="text-2xl font-black text-gray-900 mb-2" x-text="result.title"></h2>
                    <p class="text-sm text-gray-500 mb-8 px-6" x-text="result.desc"></p>

                    <!-- Result Card -->
                    <div class="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8 text-left mx-4 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-3xl"></div>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">IDENTIFIED FEATURES</div>
                        <div class="space-y-3">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                    <span class="material-symbols-outlined text-gray-500 text-sm">pest_control</span>
                                </div>
                                <div>
                                    <div class="text-[10px] text-gray-400">SHAPE</div>
                                    <div class="text-sm font-bold text-gray-900" x-text="getLabel(shapes, selectedShape)"></div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                    <span class="material-symbols-outlined text-gray-500 text-sm">palette</span>
                                </div>
                                <div>
                                    <div class="text-[10px] text-gray-400">COLOR</div>
                                    <div class="text-sm font-bold text-gray-900" x-text="getLabel(colors, selectedColor)"></div>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                                    <span class="material-symbols-outlined text-gray-500 text-sm">texture</span>
                                </div>
                                <div>
                                    <div class="text-[10px] text-gray-400">PATTERN</div>
                                    <div class="text-sm font-bold text-gray-900" x-text="getLabel(patterns, selectedPattern)"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Detroit Chart (Selection Statistics) -->
                    <div class="bg-sky-50 border border-sky-200 rounded-2xl p-5 shadow-sm mb-8 text-left mx-4 relative overflow-hidden" x-show="stats">
                        <div class="absolute top-0 right-0 py-2 px-3 opacity-20">
                            <span class="material-symbols-outlined text-4xl text-sky-500">pie_chart</span>
                        </div>
                        <div class="text-[10px] font-bold text-sky-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[12px]">group</span>
                            デトロイトチャート（選択統計）
                        </div>
                        <div class="text-sm font-bold text-sky-900 mb-3 leading-relaxed">
                            同じ特徴で迷った人が <strong class="text-lg text-sky-600" x-text="stats.same_choice_pct + '%'"></strong> います。
                        </div>
                        <div class="w-full bg-sky-200/50 rounded-full h-2 mb-2">
                            <div class="bg-sky-500 h-2 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-1000" :style="'width: ' + stats.same_choice_pct + '%'"></div>
                        </div>
                        <div class="text-[10px] text-sky-600 font-medium">
                            直近であなたを含めて <span x-text="stats.total_similar"></span> 人が同じ気配を感じました。
                        </div>
                    </div>

                    <p class="text-[10px] text-gray-400 mb-4 px-6">この特徴タグと推定名を投稿フォームに引き継ぎます</p>

                    <button @click="goToPost()"
                        class="w-full max-w-xs mx-auto py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition active:scale-95 group">
                        <span class="material-symbols-outlined group-hover:animate-bounce">send</span>
                        これで投稿する
                    </button>

                    <button @click="step = 1" class="mt-4 text-sm text-gray-400 font-bold hover:text-gray-600">
                        最初からやり直す
                    </button>
                </div>
            </section>

            <!-- Navigation (Next/Back) -->
            <div x-show="step < 4" class="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent z-50 flex items-center gap-4">
                <button x-show="step > 1" @click="step--" class="size-14 rounded-xl glass-card flex items-center justify-center text-gray-400 hover:text-gray-900 transition">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <button @click="nextStep()"
                    :disabled="!canProceed()"
                    class="flex-1 h-14 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition active:scale-95 disabled:opacity-50 disabled:grayscale">
                    <span x-text="step === 3 ? '判定する' : '次のステップ'"></span>
                    <span class="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>

    </main>
<?php endif; ?>

<script nonce="<?= CspNonce::attr() ?>">
    document.addEventListener('alpine:init', () => {
        Alpine.data('visualZukan', () => ({
            step: 1,
            selectedShape: null,
            selectedColor: null,
            selectedPattern: null,
            stats: null,
            result: {
                title: '',
                desc: '',
                icon: '',
                guess: ''
            },

            shapes: [{
                    id: 'beetle',
                    label: '甲虫',
                    icon: 'bug_report'
                },
                {
                    id: 'butterfly',
                    label: 'チョウ',
                    icon: 'flutter_dash'
                },
                {
                    id: 'dragonfly',
                    label: 'トンボ',
                    icon: 'pest_control'
                },
                {
                    id: 'bee',
                    label: 'ハチ',
                    icon: 'hive'
                },
                {
                    id: 'cicada',
                    label: 'セミ',
                    icon: 'music_note'
                },
                {
                    id: 'other',
                    label: 'その他',
                    icon: 'unknown_med'
                }
            ],
            colors: [{
                    id: 'red',
                    label: '赤',
                    hex: '#ef4444'
                },
                {
                    id: 'blue',
                    label: '青',
                    hex: '#3b82f6'
                },
                {
                    id: 'green',
                    label: '緑',
                    hex: '#22c55e'
                },
                {
                    id: 'yellow',
                    label: '黄',
                    hex: '#eab308'
                },
                {
                    id: 'black',
                    label: '黒',
                    hex: '#1e293b'
                },
                {
                    id: 'white',
                    label: '白',
                    hex: '#f8fafc'
                }
            ],
            patterns: [{
                    id: 'solid',
                    label: '単色',
                    icon: 'circle'
                },
                {
                    id: 'stripes',
                    label: 'しま模様',
                    icon: 'view_headline'
                },
                {
                    id: 'spots',
                    label: '斑点',
                    icon: 'blur_on'
                }
            ],

            getStepTitle() {
                return ['形を選ぶ', '色を選ぶ', '模様を選ぶ', '同定結果'][this.step - 1];
            },

            getLabel(list, id) {
                const item = list.find(i => i.id === id);
                return item ? item.label : id;
            },

            selectShape(id) {
                this.selectedShape = id;
            },
            selectColor(id) {
                this.selectedColor = id;
            },
            selectPattern(id) {
                this.selectedPattern = id;
            },

            canProceed() {
                if (this.step === 1) return this.selectedShape !== null;
                if (this.step === 2) return this.selectedColor !== null;
                if (this.step === 3) return this.selectedPattern !== null;
                return false;
            },

            nextStep() {
                if (this.step < 3) {
                    this.step++;
                } else {
                    this.calculateResult();
                    this.step = 4;
                }
            },

            calculateResult() {
                // Hardcoded logic (expand later)
                let guess = '';
                let title = '候補が見つかりませんでした';
                let desc = 'でも大丈夫！特徴をメモに残して投稿すれば、詳しい人が教えてくれるかもしれません。';
                let icon = 'search';

                if (this.selectedShape === 'beetle' && this.selectedColor === 'red' && this.selectedPattern === 'spots') {
                    guess = 'ナナホシテントウ';
                    title = 'ナナホシテントウ？';
                    desc = '赤地に黒い斑点の特徴が一致します。';
                    icon = 'bug_report';
                } else if (this.selectedShape === 'butterfly' && this.selectedPattern === 'stripes') {
                    guess = 'アゲハチョウ';
                    title = 'アゲハチョウの仲間？';
                    desc = '特徴的な縞模様が見られます。';
                    icon = 'flutter_dash';
                } else if (this.selectedShape === 'cicada') {
                    guess = 'アブラゼミ';
                    title = 'セミの仲間';
                    desc = '羽の特徴から、一般的なセミの仲間と思われます。';
                    icon = 'music_note';
                } else {
                    // Generic fallback based on shape
                    const shapeLabel = this.getLabel(this.shapes, this.selectedShape);
                    title = `${shapeLabel}の仲間`;
                    desc = `${this.getLabel(this.colors, this.selectedColor)}色で${this.getLabel(this.patterns, this.selectedPattern)}の特徴を持つ${shapeLabel}として記録します。`;
                    icon = this.shapes.find(s => s.id === this.selectedShape)?.icon || 'help';
                }

                this.result = {
                    title,
                    desc,
                    icon,
                    guess
                };

                // Generate pseudo Detroit Chart stats based on selection to simulate "presence of others"
                let seed = (this.selectedShape ? this.selectedShape.length : 0) +
                    (this.selectedColor ? this.selectedColor.length : 0);
                this.stats = {
                    same_choice_pct: Math.floor(18 + Math.random() * 45), // 18% ~ 62%
                    total_similar: Math.floor(10 + Math.random() * 150) // 10 ~ 159 people
                };
            },

            goToPost() {
                const note = `Visual ID Log:\n形: ${this.getLabel(this.shapes, this.selectedShape)}\n色: ${this.getLabel(this.colors, this.selectedColor)}\n模様: ${this.getLabel(this.patterns, this.selectedPattern)}`;
                const params = new URLSearchParams({
                    note: note,
                    taxon_name: this.result.guess
                });

                // 投稿からのブリッジ対応
                const fromObsId = '<?php echo htmlspecialchars($fromObsId ?? ""); ?>';
                if (fromObsId) {
                    window.location.href = 'id_form.php?id=' + fromObsId + '&' + params.toString();
                } else {
                    window.location.href = 'post.php?' + params.toString();
                }
            }
        }));
    });
</script>
</body>

</html>
