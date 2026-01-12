<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Lang.php';
Lang::init();
require_once __DIR__ . '/../libs/RedList.php';
require_once __DIR__ . '/../libs/Invasive.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
$currentUser = Auth::user();

// Get Observation
$id = $_GET['id'] ?? '';
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    http_response_code(404);
    echo "Observation not found";
    exit;
}

// Increment View Count
DataStore::increment('observations', $id, 'views');

// --- Calculations ---
$taxon_key = $obs['taxon']['key'] ?? null;
$species_name = $obs['taxon']['name'] ?? $obs['species_name'] ?? null;
$scientific_name = $obs['taxon']['scientific_name'] ?? $obs['scientific_name'] ?? null;

// Determine Status Badge Color
$statusColor = BioUtils::getStatusColor($obs['status']);

// Obscure location
$location = BioUtils::getObscuredLocation($obs['lat'], $obs['lng'], null); // Ignoring RedList for simple MVP logic here or fetch logic

// Check Red List & Invasive
$redlist = $taxon_key ? RedList::check($taxon_key) : null;
$invasive = ($species_name || $scientific_name) ? Invasive::check($species_name, $scientific_name) : null;

// JSON-LD
$json_ld = [
    "@context" => "https://schema.org",
    "@type" => "Observation",
    "image" => $obs['photos'][0] ?? '',
    "name" => $species_name ?? 'Unidentified'
];

?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($species_name ?? '同定提案待ち'); ?> - Ikimon</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.x.x/dist/cdn.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    
    <!-- MapLibre -->
    <script src="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.css" rel="stylesheet" />

    <style>
        body { background-color: #0d1117; color: #c9d1d9; font-family: 'Inter', sans-serif; }
        .font-heading { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="min-h-screen text-gray-300 antialiased" x-data="{ idModalOpen: false }">

    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/5">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <a href="index.php" class="flex items-center gap-2">
                <div class="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <i data-lucide="sprout" class="text-white w-5 h-5"></i>
                </div>
                <span class="font-bold text-white tracking-tight">ikimon</span>
            </a>
            
            <div class="flex items-center gap-4">
                <a href="index.php" class="text-sm font-bold text-gray-400 hover:text-white transition">さがす</a>
                <a href="showcase.php" class="text-sm font-bold text-gray-400 hover:text-white transition">みんなの活動</a>
                <?php if(Auth::isLoggedIn()): ?>
                <img src="<?php echo Auth::user()['avatar'] ?? 'https://i.pravatar.cc/150'; ?>" class="w-8 h-8 rounded-full border border-white/10">
                <?php else: ?>
                <a href="login.php" class="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold transition">ログイン</a>
                <?php endif; ?>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <!-- Breadcrumb & Status Header -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div class="flex items-center gap-2 text-sm text-gray-500">
                <a href="index.php" class="hover:text-green-400 transition">ホーム</a>
                <span>&rsaquo;</span>
                <span>観察詳細</span>
            </div>
            <!-- Status Badge -->
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border <?php echo $statusColor; ?>">
                <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                <?php echo htmlspecialchars($obs['status']); ?>
            </div>
        </div>

        <!-- 2-Column Grid Layout (Photo vs Info) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            <!-- LEFT COLUMN: Visuals (LG: 7 cols - ~58%) -->
            <div class="lg:col-span-7 space-y-6">
                <!-- Main Photo -->
                <div class="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 group aspect-[4/3] flex items-center justify-center">
                    <?php if(!empty($obs['photos'])): ?>
                        <img src="<?php echo htmlspecialchars($obs['photos'][0]); ?>" 
                             class="max-w-full max-h-full object-contain" 
                             alt="Observation Photo">
                        
                        <!-- Image Navigation Hints (if multiple) -->
                        <?php if(count($obs['photos']) > 1): ?>
                        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur rounded-full">
                            <?php foreach($obs['photos'] as $idx => $p): ?>
                                <div class="w-2 h-2 rounded-full <?php echo $idx === 0 ? 'bg-white' : 'bg-white/30'; ?>"></div>
                            <?php endforeach; ?>
                        </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <div class="text-gray-600 flex flex-col items-center">
                            <i data-lucide="image-off" class="w-12 h-12 mb-2"></i>
                            <span class="text-xs">No Image</span>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Owner Narrative (Psychological Connection) -->
                <div class="flex items-start gap-4 mt-6 px-2">
                    <img src="<?php echo Auth::user()['avatar'] ?? 'https://i.pravatar.cc/150?u='.$obs['user_id']; ?>" 
                         class="w-12 h-12 rounded-full border-2 border-white/10 shadow-lg">
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-300 mb-1"><?php echo BioUtils::getUserName($obs['user_id']); ?></div>
                        
                        <!-- Speech Bubble -->
                        <div class="relative bg-[#21262d] border border-white/10 rounded-2xl rounded-tl-sm p-4 shadow-sm">
                            <p class="text-sm text-gray-200 leading-relaxed">
                                <?php echo !empty($obs['note']) ? BioUtils::renderMarkdown($obs['note']) : 'この子の名前、わかる人いますか？<br>夜の公園で見つけました！'; ?>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Exif & License (Moved below Owner) -->
                <div class="grid grid-cols-2 gap-4 text-xs text-gray-500 mt-4 px-2">
                    <div class="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div class="font-bold text-gray-400">CC BY-NC 4.0</div>
                        <div>撮影者: <?php echo BioUtils::getUserName($obs['user_id']); ?></div>
                    </div>
                    <div class="p-3 rounded-lg bg-white/5 border border-white/5 space-y-1">
                        <div class="flex items-center gap-2">
                            <i data-lucide="camera" class="w-3 h-3"></i>
                            <span>iPhone 15 Pro</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <i data-lucide="aperture" class="w-3 h-3"></i>
                            <span>f/1.8 1/120s ISO80</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Info & Activity (LG: 5 cols - ~42%) -->
            <div class="lg:col-span-5 flex flex-col gap-8">
                
                <!-- 1. Taxonomy & Identification Header -->
                <div class="bg-[#161b22] rounded-2xl p-6 border border-white/10 shadow-lg relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10">
                        <i data-lucide="dna" class="w-32 h-32 text-green-500"></i>
                    </div>

                    <!-- Lineage -->
                    <div class="mb-2 text-xs text-gray-500 font-mono">
                        <?php echo BioUtils::renderLineage($obs['taxon']['lineage'] ?? []); ?>
                    </div>

                    <!-- Species Name -->
                    <h1 class="text-2xl md:text-3xl font-black text-white mb-1 leading-tight tracking-tight">
                        <?php echo htmlspecialchars($species_name ?? '種名未定'); ?>
                    </h1>
                    <div class="text-sm text-gray-400 font-serif italic mb-6">
                        <?php echo htmlspecialchars($scientific_name ?? ''); ?>
                    </div>

                    <!-- Core Attributes -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                                <i data-lucide="map-pin" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-[10px] text-gray-500 uppercase tracking-wider">場所</div>
                                <div class="text-sm font-bold text-gray-200">静岡県 浜松市</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
                                <i data-lucide="calendar" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-[10px] text-gray-500 uppercase tracking-wider">観察日</div>
                                <div class="text-sm font-bold text-gray-200"><?php echo date('Y.m.d', strtotime($obs['observed_at'])); ?></div>
                            </div>
                        </div>
                    </div>

                    <!-- Map -->
                    <div id="reborn-map" class="w-full h-40 rounded-xl bg-gray-800 border border-white/10 overflow-hidden relative z-0"></div>

                    <!-- Primary Action (Gentle Nudge) -->
                    <div class="mt-6">
                        <!-- Gentle Invitation -->
                        <div class="bg-gradient-to-b from-[#238636]/20 to-transparent p-4 rounded-xl border border-[#238636]/30">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="p-2 rounded-full bg-[#238636]/20 text-[#2eff71]">
                                    <i data-lucide="users" class="w-5 h-5"></i>
                                </div>
                                <div class="font-bold text-green-200 text-sm">この生き物、なんだろう？</div>
                            </div>
                            <p class="text-xs text-gray-400 mb-4 pl-1">
                                「色だけわかる」「鳥だと思う」といったヒントでも投稿者の助けになります。
                            </p>
                            <button @click="idModalOpen = true" class="w-full py-3.5 rounded-xl bg-[#238636] hover:bg-[#2ea043] text-white font-bold text-sm tracking-wide shadow-lg shadow-green-900/20 transition flex items-center justify-center gap-2 border border-white/10 group">
                                <span class="text-lg">🤔</span>
                                <span class="group-hover:underline decoration-white/50 underline-offset-4">一緒に考える</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. Activity / Identification List -->
                <div class="space-y-4">
                    <div class="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 class="font-bold text-lg text-white flex items-center gap-2">
                            <i data-lucide="book-open" class="w-5 h-5 text-gray-500"></i>
                            みんなの推測ノート
                        </h3>
                        <span class="text-xs text-gray-500 font-mono"><?php echo count($obs['identifications'] ?? []); ?> posts</span>
                    </div>

                    <!-- Timeline Loop -->
                    <div class="space-y-6 pl-2">
                        <?php if(empty($obs['identifications'])): ?>
                            <div class="text-center py-8 text-gray-600 italic">まだ推測コメントはありません。<br>知っていることを書いてみませんか？</div>
                        <?php else: ?>
                            <?php foreach(array_reverse($obs['identifications']) as $id): ?>
                            <!-- Item -->
                            <div class="relative pl-6 border-l border-white/10 pb-2">
                                <!-- Dot -->
                                <div class="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-[#161b22] border-2 border-white/20"></div>

                                <!-- Header -->
                                <div class="flex items-start justify-between mb-2">
                                    <div class="flex items-center gap-2">
                                        <img src="<?php echo $id['user_avatar'] ?? 'https://i.pravatar.cc/100?u='.$id['user_id']; ?>" class="w-8 h-8 rounded-full border border-white/10">
                                        <div>
                                            <div class="text-sm font-bold text-gray-200 leading-none">
                                                <?php echo htmlspecialchars($id['user_name'] ?? 'Unknown'); ?>
                                            </div>
                                            <div class="text-[10px] text-gray-500 mt-0.5">
                                                <?php echo BioUtils::timeAgo($id['created_at']); ?>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- ID Chip -->
                                    <div class="text-right">
                                        <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#22c55e]/10 border border-[#22c55e]/20 hover:bg-[#22c55e]/20 transition cursor-pointer">
                                            <i data-lucide="tag" class="w-3 h-3 text-[#22c55e]"></i>
                                            <span class="text-xs font-bold text-[#22c55e]"><?php echo htmlspecialchars($id['taxon_name']); ?></span>
                                        </div>
                                        <?php if(isset($id['scientific_name'])): ?>
                                        <div class="text-[10px] text-gray-500 italic font-mono mt-0.5"><?php echo htmlspecialchars($id['scientific_name']); ?></div>
                                        <?php endif; ?>
                                    </div>
                                </div>

                                <!-- Comment Body (Standardized & Collapsible) -->
                                <?php if(!empty($id['note'])): ?>
                                    <?php 
                                    // Use strlen (bytes) because mb_strlen might be missing
                                    // 450 bytes ~= 150 Japanese chars (3 bytes each)
                                    $isLong = strlen($id['note']) > 450; 
                                    ?>
                                    <div class="mt-3 text-sm text-gray-300 bg-white/5 border border-white/5 rounded-lg p-3 leading-relaxed" 
                                         x-data="{ expanded: false }">
                                        <div :class="expanded ? '' : '<?php echo $isLong ? 'line-clamp-4' : ''; ?>'">
                                            <?php echo BioUtils::renderMarkdown($id['note']); ?>
                                        </div>
                                        <?php if($isLong): ?>
                                        <button @click="expanded = true" x-show="!expanded" class="text-xs font-bold text-green-400 mt-2 hover:underline">
                                            もっと見る
                                        </button>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>

                                <!-- Footer Actions (Gentle) -->
                                <div class="flex items-center gap-4 mt-2 pl-1">
                                    <button class="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-green-400 transition bg-white/5 px-3 py-1.5 rounded-full hover:bg-green-500/10">
                                        <i data-lucide="sprout" class="w-3.5 h-3.5"></i>
                                        <span>そうかも！</span>
                                    </button>
                                    <button class="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-400 transition">
                                        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                                        <span>返信</span>
                                    </button>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>

            </div> <!-- End Right Column -->

        </div> <!-- End Grid -->
    </main>

    <!-- Inline ID Modal (Restored from previous implementation but simplified) -->
    <div x-show="idModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center px-4" style="display: none;">
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm" @click="idModalOpen = false"></div>
        <div class="bg-[#161b22] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl relative z-10 p-6">
            <h2 class="text-xl font-bold text-white mb-4">名前を提案する</h2>
            
            <!-- Simple Placeholder Form for now, as focus is UI Layout -->
            <form method="POST" action="api/post_identification.php">
                <input type="hidden" name="observation_id" value="<?php echo $id; ?>">
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">種名 (和名または学名)</label>
                        <input type="text" name="taxon_name" class="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500" placeholder="例: ヤマシギ">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">コメント</label>
                        <textarea name="note" class="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 h-32" placeholder="同定の根拠やコメントを入力..."></textarea>
                    </div>
                    <button type="submit" class="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition">提案する</button>
                </div>
            </form>
            <button @click="idModalOpen = false" class="absolute top-4 right-4 text-gray-500 hover:text-white">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
        </div>
    </div>

    <!-- Scripts -->
    <script>
        lucide.createIcons();

        // Map Initialization
        document.addEventListener('DOMContentLoaded', () => {
            const mapEl = document.getElementById('reborn-map');
            if (mapEl && typeof maplibregl !== 'undefined') {
                const lat = <?php echo floatval($obs['lat']); ?>;
                const lng = <?php echo floatval($obs['lng']); ?>;
                const map = new maplibregl.Map({
                    container: 'reborn-map',
                    style: 'https://tile.openstreetmap.jp/styles/osm-bright-ja/style.json',
                    center: [lng, lat],
                    zoom: 11,
                    interactive: false // Mini Map
                });
                new maplibregl.Marker({ color: '#22c55e' }).setLngLat([lng, lat]).addTo(map);
            }
        });
    </script>
</body>
</html>
