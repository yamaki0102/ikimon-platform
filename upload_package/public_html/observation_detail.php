<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Lang.php';
Lang::init();
require_once __DIR__ . '/../libs/RedList.php';
require_once __DIR__ . '/../libs/Invasive.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataQuality.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';
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

// Check My Field
require_once __DIR__ . '/../libs/MyFieldManager.php';
$myFieldName = null;
if ($currentUser && !empty($obs['lat']) && !empty($obs['lng'])) {
    $myFields = MyFieldManager::listByUser($currentUser['id']);
    foreach ($myFields as $field) {
        if (MyFieldManager::contains($field, (float)$obs['lat'], (float)$obs['lng'])) {
            $myFieldName = $field['name'];
            break;
        }
    }
}

// --- Calculations ---
$taxon_key = $obs['taxon']['key'] ?? $obs['taxon']['id'] ?? null;
$species_name = $obs['taxon']['name'] ?? $obs['species_name'] ?? null;
$scientific_name = $obs['taxon']['scientific_name'] ?? $obs['scientific_name'] ?? null;
$taxon_slug = $obs['taxon']['slug'] ?? null;

$omoikaneTraits = null;
if ($scientific_name) {
    $omoikaneEngine = new OmoikaneSearchEngine();
    $omoikaneTraits = $omoikaneEngine->getTraitsByScientificName($scientific_name);
}

// Build species page link
$speciesLink = null;
if ($taxon_slug) {
    $speciesLink = 'species/' . urlencode($taxon_slug);
} elseif ($species_name) {
    $speciesLink = 'species.php?taxon=' . urlencode($species_name);
}

// Determine Status Badge Color (Mapping Legacy)
$status = $obs['quality_grade'] ?? ($obs['status'] ?? '未同定');
$statusMap = [
    '調査中' => '未同定',
    'ていあん' => '要同定',
    'はかせ認定' => '研究用',
    'Research Grade' => '研究用',
    'Needs ID' => '要同定',
];
$status = $statusMap[$status] ?? $status;
$statusColor = BioUtils::getStatusColor($status);

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

// --- OGP Meta ---
$meta_title = ($species_name ?? '同定提案待ち') . " の観察";
$meta_description = ($species_name ?? '生き物') . " — " . date('Y.m.d', strtotime($obs['observed_at'])) . " の観察記録 | ikimon.life";
if (!empty($obs['photos'])) {
    $meta_image = (strpos($obs['photos'][0], 'http') === 0) ? $obs['photos'][0] : BASE_URL . '/' . $obs['photos'][0];
}
$meta_canonical = 'https://ikimon.life/observation_detail.php?id=' . urlencode($id);
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
        <?php
        $jsonLd = [
            '@context' => 'https://schema.org',
            '@type' => 'Observation',
            'name' => ($species_name ?? '未同定') . ' の観察',
            'description' => $meta_description,
            'url' => $meta_canonical,
            'dateCreated' => $obs['observed_at'] ?? $obs['created_at'] ?? null,
            'about' => [
                '@type' => 'Taxon',
                'name' => $scientific_name ?: ($species_name ?? null),
                'alternateName' => $species_name ?? null,
            ],
        ];
        if (!empty($obs['location']['lat']) && !empty($obs['location']['lng'])) {
            $jsonLd['spatial'] = [
                '@type' => 'Place',
                'geo' => [
                    '@type' => 'GeoCoordinates',
                    'latitude' => (float) $obs['location']['lat'],
                    'longitude' => (float) $obs['location']['lng'],
                ]
            ];
        }
        if (!empty($obs['photos'][0])) {
            $photo = $obs['photos'][0];
            $jsonLd['image'] = (strpos($photo, 'http') === 0) ? $photo : 'https://ikimon.life/' . $photo;
        }
        if (!empty($obs['user']['name'])) {
            $jsonLd['creator'] = [
                '@type' => 'Person',
                'name' => $obs['user']['name'],
            ];
        }
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_HEX_TAG);
        ?>
    </script>

    <!-- MapLibre -->
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
</head>

<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body min-h-screen antialiased" x-data="{ idModalOpen: false, photoActive: 0, lightbox: false, touchStart: 0, touchEnd: 0, locationName: '読み込み中...' }" x-init="
    fetch('https://nominatim.openstreetmap.org/reverse?lat=<?php echo floatval($obs['lat']); ?>&lon=<?php echo floatval($obs['lng']); ?>&format=json&accept-language=ja&zoom=10')
        .then(r => r.json())
        .then(d => { locationName = d.address ? (d.address.city || d.address.town || d.address.village || d.address.county || '') + ', ' + (d.address.state || '') : '不明'; })
        .catch(() => { locationName = '位置情報あり'; });
    },
    async submitAgree(target) {
        if(!confirm('「' + target.name + '」に同意しますか？\n(あなたの同意はデータの信頼性に影響します)')) return;
        const _csrf = (document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/)||[])[1]||'';
        try {
            const res = await fetch('api/post_identification.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': _csrf },
                body: JSON.stringify({
                    observation_id: '<?php echo htmlspecialchars($id); ?>',
                    taxon_key: target.key,
                    taxon_name: target.name,
                    taxon_slug: target.slug,
                    scientific_name: target.sci,
                    confidence: 'sure',
                    note: '', 
                    evidence_type: 'visual'
                })
            });
            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('エラーが発生しました: ' + (data.message || 'Unknown error'));
            }
        } catch(e) { alert('通信エラー'); }
    }
">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <!-- Main Content -->
    <main class="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <!-- Breadcrumb & Status Header -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div class="flex items-center gap-2 text-sm text-muted">
                <a href="index.php" class="hover:text-primary transition">ホーム</a>
                <span>&rsaquo;</span>
                <span>観察詳細</span>
            </div>
            <!-- Status Badge -->
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border <?php echo $statusColor; ?>">
                <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                <?php echo htmlspecialchars($status); ?>
            </div>
        </div>

        <!-- 2-Column Grid Layout (Photo vs Info) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

            <!-- LEFT COLUMN: Visuals (LG: 7 cols - ~58%) -->
            <div class="lg:col-span-7 space-y-6">
                <!-- Main Photo Carousel -->
                <div class="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-border group aspect-[4/3] flex items-center justify-center"
                    @click="lightbox = true"
                    @touchstart="touchStart = $event.changedTouches[0].screenX"
                    @touchend="touchEnd = $event.changedTouches[0].screenX; let diff = touchStart - touchEnd; if(Math.abs(diff) > 50) { photoActive = diff > 0 ? (photoActive + 1) % <?php echo max(1, count($obs['photos'] ?? [])); ?> : (photoActive - 1 + <?php echo max(1, count($obs['photos'] ?? [])); ?>) % <?php echo max(1, count($obs['photos'] ?? [])); ?>; }">
                    <?php if (!empty($obs['photos'])): ?>
                        <?php foreach ($obs['photos'] as $idx => $photo): ?>
                            <img src="<?php echo htmlspecialchars($photo); ?>"
                                class="absolute inset-0 w-full h-full object-contain transition-all duration-500"
                                :class="photoActive === <?php echo $idx; ?> ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'"
                                alt="観察写真 <?php echo $idx + 1; ?>" loading="<?php echo $idx === 0 ? 'eager' : 'lazy'; ?>">
                        <?php endforeach; ?>

                        <!-- Navigation Arrows -->
                        <?php if (count($obs['photos']) > 1): ?>
                            <button @click.stop="photoActive = (photoActive - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>" class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
                                <i data-lucide="chevron-left" class="w-5 h-5"></i>
                            </button>
                            <button @click.stop="photoActive = (photoActive + 1) % <?php echo count($obs['photos']); ?>" class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
                                <i data-lucide="chevron-right" class="w-5 h-5"></i>
                            </button>
                            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full z-20">
                                <?php foreach ($obs['photos'] as $idx => $p): ?>
                                    <button @click.stop="photoActive = <?php echo $idx; ?>" class="w-2.5 h-2.5 rounded-full transition-all" :class="photoActive === <?php echo $idx; ?> ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'"></button>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <div class="text-muted flex flex-col items-center">
                            <i data-lucide="image-off" class="w-12 h-12 mb-2"></i>
                            <span class="text-xs">写真なし</span>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Lightbox -->
                <div x-show="lightbox" x-cloak x-transition.opacity class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2">
                    <button @click.stop="lightbox = false" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full z-[101] hover:bg-white/20 transition">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                    <?php if (!empty($obs['photos'])): ?>
                        <?php foreach ($obs['photos'] as $idx => $photo): ?>
                            <img src="<?php echo htmlspecialchars($photo); ?>" x-show="photoActive === <?php echo $idx; ?>" class="max-w-full max-h-full object-contain pointer-events-none select-none">
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <!-- Thumbnails -->
                <?php if (!empty($obs['photos']) && count($obs['photos']) > 1): ?>
                    <div class="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
                        <?php foreach ($obs['photos'] as $idx => $photo): ?>
                            <button @click.stop="photoActive = <?php echo $idx; ?>" type="button" class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition" :class="photoActive === <?php echo $idx; ?> ? 'border-primary scale-105' : 'border-transparent opacity-50'">
                                <img src="<?php echo $photo; ?>" class="w-full h-full object-cover" loading="lazy">
                            </button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <!-- Owner Narrative -->
                <div class="flex items-start gap-4 mt-6 px-2">
                    <img src="<?php echo $obs['user_avatar'] ?? 'https://i.pravatar.cc/150?u=' . $obs['user_id']; ?>"
                        class="w-12 h-12 rounded-full border-2 border-border shadow-lg">
                    <div class="flex-1">
                        <?php $observerName = $obs['user_display_name'] ?? $obs['user_name'] ?? $obs['user']['display_name'] ?? $obs['user']['name'] ?? BioUtils::getUserName($obs['user_id']); ?>
                        <div class="text-sm font-bold text-text mb-1"><?php echo htmlspecialchars($observerName); ?></div>
                        <div class="relative bg-surface border border-border rounded-2xl rounded-tl-sm p-4 shadow-sm">
                            <p class="text-sm text-text leading-relaxed">
                                <?php echo !empty($obs['note']) ? BioUtils::renderMarkdown($obs['note']) : '<span class="text-muted italic">メモなし</span>'; ?>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- License -->
                <div class="text-xs text-muted mt-4 px-2">
                    <div class="p-3 rounded-lg bg-surface border border-border flex items-center gap-3">
                        <i data-lucide="creative-commons" class="w-4 h-4 text-faint"></i>
                        <div>
                            <span class="font-bold text-faint">CC BY-NC 4.0</span>
                            <span class="ml-2">撮影者: <?php echo htmlspecialchars($observerName); ?></span>
                        </div>
                    </div>

                    <!-- Share Buttons -->
                    <div class="mt-3 flex items-center gap-2" x-data="{ copied: false }">
                        <span class="text-token-xs text-faint font-bold uppercase tracking-wider mr-1">Share</span>
                        <?php
                        $shareUrl = 'https://ikimon.life/observation_detail.php?id=' . urlencode($id);
                        $shareText = ($species_name ?? '生き物') . ' の観察記録 — ikimon.life';
                        ?>
                        <a href="https://twitter.com/intent/tweet?url=<?php echo urlencode($shareUrl); ?>&text=<?php echo urlencode($shareText); ?>"
                            target="_blank" rel="noopener"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-black hover:text-white hover:border-black transition"
                            title="Xでシェア">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </a>
                        <a href="https://social-plugins.line.me/lineit/share?url=<?php echo urlencode($shareUrl); ?>"
                            target="_blank" rel="noopener"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-[#06C755] hover:text-white hover:border-[#06C755] transition"
                            title="LINEでシェア">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                        </a>
                        <button @click="navigator.clipboard.writeText('<?php echo $shareUrl; ?>').then(() => { copied = true; setTimeout(() => copied = false, 2000); })"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-primary hover:text-white hover:border-primary transition relative"
                            title="URLをコピー">
                            <i data-lucide="link" class="w-3.5 h-3.5" x-show="!copied"></i>
                            <i data-lucide="check" class="w-3.5 h-3.5" x-show="copied" x-cloak></i>
                        </button>
                        <template x-if="navigator.share">
                            <button @click="navigator.share({ title: '<?php echo htmlspecialchars($species_name ?? '生き物', ENT_QUOTES); ?> の観察', url: '<?php echo $shareUrl; ?>' })"
                                class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-accent hover:text-white hover:border-accent transition"
                                title="その他のシェア">
                                <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Info & Activity (LG: 5 cols - ~42%) -->
            <div class="lg:col-span-5 flex flex-col gap-8">

                <!-- 1. Taxonomy & Identification Header -->
                <div class="bg-surface rounded-2xl p-6 border border-border shadow-lg relative overflow-hidden">
                    <div class="absolute top-0 right-0 p-4 opacity-10">
                        <i data-lucide="dna" class="w-32 h-32 text-primary"></i>
                    </div>

                    <!-- Lineage -->
                    <div class="mb-2 text-xs text-muted font-mono">
                        <?php echo BioUtils::renderLineage($obs['taxon']['lineage'] ?? []); ?>
                    </div>

                    <!-- Species Name -->
                    <h1 class="text-2xl md:text-3xl font-black text-text mb-1 leading-tight tracking-tight">
                        <?php if ($speciesLink && $species_name): ?>
                            <a href="<?php echo htmlspecialchars($speciesLink); ?>" class="hover:text-primary-dark transition underline decoration-faint underline-offset-4 hover:decoration-primary/50">
                                <?php echo htmlspecialchars($species_name); ?>
                            </a>
                        <?php else: ?>
                            <?php echo htmlspecialchars($species_name ?? '種名未定'); ?>
                        <?php endif; ?>
                    </h1>
                    <div class="text-sm text-muted font-serif italic mb-3">
                        <?php echo htmlspecialchars($scientific_name ?? ''); ?>
                        <?php if ($speciesLink): ?>
                            <a href="<?php echo htmlspecialchars($speciesLink); ?>" class="text-primary/70 hover:text-primary ml-2 text-token-xs font-sans not-italic font-bold">📖 図鑑</a>
                        <?php endif; ?>
                    </div>

                    <!-- Badges: Red List & Invasive -->
                    <div class="flex flex-wrap gap-2 mb-6">
                        <?php if ($redlist): ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-danger/10 text-danger border border-danger/20">
                                <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                レッドリスト: <?php echo htmlspecialchars($redlist['category'] ?? '該当'); ?>
                            </span>
                        <?php endif; ?>
                        <?php if ($invasive): ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-warning/10 text-warning border border-warning/20">
                                <i data-lucide="shield-alert" class="w-3 h-3"></i>
                                外来種
                            </span>
                        <?php endif; ?>
                        <?php if ($myFieldName): ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                My Field: <?php echo htmlspecialchars($myFieldName); ?>
                            </span>
                        <?php endif; ?>
                        <?php
                        $lifeStageLabels = [
                            'adult' => ['label' => '成体', 'icon' => 'crown', 'color' => 'primary'],
                            'juvenile' => ['label' => '幼体', 'icon' => 'sprout', 'color' => 'primary-light'],
                            'egg' => ['label' => '卵・種子', 'icon' => 'circle-dot', 'color' => 'accent'],
                            'trace' => ['label' => '痕跡', 'icon' => 'footprints', 'color' => 'secondary'],
                            'larva' => ['label' => '幼生', 'icon' => 'sprout', 'color' => 'primary-light'],
                            'pupa' => ['label' => 'サナギ', 'icon' => 'package', 'color' => 'accent'],
                            'exuviae' => ['label' => '痕跡', 'icon' => 'ghost', 'color' => 'secondary'],
                        ];
                        $ls = $obs['life_stage'] ?? 'unknown';
                        if ($ls !== 'unknown' && isset($lifeStageLabels[$ls])):
                            $lsInfo = $lifeStageLabels[$ls];
                        ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-<?php echo $lsInfo['color']; ?>/10 text-<?php echo $lsInfo['color']; ?> border border-<?php echo $lsInfo['color']; ?>/20">
                                <i data-lucide="<?php echo $lsInfo['icon']; ?>" class="w-3 h-3"></i>
                                <?php echo $lsInfo['label']; ?>
                            </span>
                        <?php endif; ?>
                        <?php
                        $cult = $obs['cultivation'] ?? null;
                        if ($cult === 'cultivated'):
                        ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-accent/10 text-accent border border-accent/20">
                                <i data-lucide="fence" class="w-3 h-3"></i>
                                植栽・飼育
                            </span>
                        <?php endif; ?>
                    </div>

                    <!-- Core Attributes -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-muted">
                                <i data-lucide="map-pin" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-token-xs text-muted uppercase tracking-wider">場所</div>
                                <div class="text-sm font-bold text-text" x-text="locationName">読み込み中...</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-muted">
                                <i data-lucide="calendar" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-token-xs text-muted uppercase tracking-wider">観察日</div>
                                <div class="text-sm font-bold text-text"><?php echo date('Y.m.d', strtotime($obs['observed_at'])); ?></div>
                            </div>
                        </div>
                    </div>

                    <!-- Consensus Progress (WE-Consensus) -->
                    <?php if (isset($obs['consensus'])): ?>
                        <div class="mb-6 bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-border/50">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-2">
                                    <i data-lucide="activity" class="w-4 h-4 text-primary"></i>
                                    <span class="text-xs font-bold text-muted uppercase tracking-wider">信頼性スコア (WE-Consensus)</span>
                                </div>
                                <span class="text-xs font-mono text-primary font-bold">
                                    <span class="text-lg"><?php echo number_format($obs['consensus']['total_score'] ?? 0, 1); ?></span> / 2.0
                                </span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 overflow-hidden relative shadow-inner">
                                <div class="bg-gradient-to-r from-primary/70 to-primary h-full rounded-full transition-all duration-1000 relative" style="width: <?php echo min(100, (($obs['consensus']['total_score'] ?? 0) / 2.0) * 100); ?>%">
                                    <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                                </div>
                                <!-- Threshold Marker -->
                                <div class="absolute top-0 bottom-0 w-0.5 bg-red-500/50 left-[100%] z-10" style="left: calc(100% * (2.0 / 3.0))"></div>
                            </div>
                            <div class="flex justify-between text-token-xs text-muted mt-1.5 font-mono">
                                <span>Needs ID</span>
                                <span>Research Grade (Guardian=2.0)</span>
                            </div>

                            <!-- DQA Chips -->
                            <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                                <span class="px-2 py-1 rounded bg-surface border border-border text-token-xs text-muted font-bold flex items-center gap-1.5">
                                    <i data-lucide="thumbs-up" class="w-3 h-3 text-primary"></i>
                                    同意率: <?php echo round(($obs['consensus']['agreement_rate'] ?? 0) * 100); ?>%
                                </span>
                                <?php if (BioUtils::isVerifiable($obs)): ?>
                                    <span class="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-token-xs text-green-600 font-bold flex items-center gap-1.5">
                                        <i data-lucide="check-circle-2" class="w-3 h-3"></i>
                                        検証可能 (Verifiable)
                                    </span>
                                <?php else: ?>
                                    <span class="px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-token-xs text-orange-600 font-bold flex items-center gap-1.5">
                                        <i data-lucide="alert-circle" class="w-3 h-3"></i>
                                        検証不足 (Casual)
                                    </span>
                                <?php endif; ?>
                                <?php
                                $dqGrade = DataQuality::calculate($obs);
                                $dqInfo = DataQuality::getGradeInfo($dqGrade);
                                ?>
                                <span class="px-2 py-1 rounded <?php echo $dqInfo['bg']; ?> border <?php echo $dqInfo['border']; ?> text-token-xs <?php echo $dqInfo['color']; ?> font-bold flex items-center gap-1.5">
                                    <i data-lucide="<?php echo $dqInfo['icon']; ?>" class="w-3 h-3"></i>
                                    Grade <?php echo $dqGrade; ?>: <?php echo $dqInfo['label']; ?>
                                </span>
                            </div>

                            <!-- Improvement Hints -->
                            <?php $hints = DataQuality::getImprovementHints($obs); ?>
                            <?php if (!empty($hints)): ?>
                                <div class="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                                    <?php foreach ($hints as $hint): ?>
                                        <div class="flex items-center gap-2 text-token-xs text-muted">
                                            <i data-lucide="<?php echo $hint['icon']; ?>" class="w-3 h-3 text-primary shrink-0"></i>
                                            <span><?php echo $hint['text']; ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <!-- Data Quality Badge (Outside Consensus) -->
                    <?php if (!isset($obs['consensus'])): ?>
                        <?php
                        $dqGrade = DataQuality::calculate($obs);
                        $dqInfo = DataQuality::getGradeInfo($dqGrade);
                        $hints = DataQuality::getImprovementHints($obs);
                        ?>
                        <div class="mb-6 <?php echo $dqInfo['bg']; ?> rounded-xl p-4 border <?php echo $dqInfo['border']; ?>">
                            <div class="flex items-center gap-2">
                                <i data-lucide="<?php echo $dqInfo['icon']; ?>" class="w-4 h-4 <?php echo $dqInfo['color']; ?>"></i>
                                <span class="text-xs font-bold <?php echo $dqInfo['color']; ?>">データ品質: Grade <?php echo $dqGrade; ?> — <?php echo $dqInfo['label']; ?></span>
                            </div>
                            <p class="text-token-xs text-muted mt-1"><?php echo $dqInfo['description']; ?></p>
                            <?php if (!empty($hints)): ?>
                                <div class="mt-2 pt-2 border-t border-border/30 space-y-1">
                                    <?php foreach ($hints as $hint): ?>
                                        <div class="flex items-center gap-2 text-token-xs text-muted">
                                            <i data-lucide="<?php echo $hint['icon']; ?>" class="w-3 h-3 text-primary shrink-0"></i>
                                            <span><?php echo $hint['text']; ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <!-- Map -->
                    <div id="reborn-map" class="w-full h-40 rounded-xl bg-surface border border-border overflow-hidden relative z-0"></div>

                    <!-- Omoikane Insights (New) -->
                    <?php if ($omoikaneTraits): ?>
                        <div class="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200 shadow-sm relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none">
                                <span class="material-symbols-outlined text-9xl text-indigo-900">psychiatry</span>
                            </div>
                            <div class="flex items-center gap-2 mb-3 relative z-10">
                                <span class="material-symbols-outlined text-indigo-600">psychiatry</span>
                                <h3 class="font-black text-indigo-900 text-sm tracking-wider">オモイカネ インサイト</h3>
                            </div>
                            <div class="space-y-3 relative z-10 text-sm text-indigo-900/80">
                                <?php if (!empty($omoikaneTraits['habitat'])): ?>
                                    <div class="flex items-start gap-2 bg-white/50 rounded-lg p-3">
                                        <span class="material-symbols-outlined text-indigo-400 text-base shrink-0 mt-0.5">landscape</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-indigo-500 mb-0.5 uppercase tracking-widest">文献上の環境</div>
                                            <div class="font-medium leading-tight mb-1 text-xs"><?php echo htmlspecialchars($omoikaneTraits['habitat']); ?></div>
                                            <div class="text-[10px] text-indigo-600 bg-indigo-100/50 inline-block px-1.5 py-0.5 rounded">
                                                ✨ あなたの報告が新しい生息地の発見につながるかも！
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <?php if (!empty($omoikaneTraits['season'])): ?>
                                    <div class="flex items-start gap-2 bg-white/50 rounded-lg p-3">
                                        <span class="material-symbols-outlined text-indigo-400 text-base shrink-0 mt-0.5">calendar_month</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-indigo-500 mb-0.5 uppercase tracking-widest">出現時期</div>
                                            <div class="font-medium leading-tight mb-1 text-xs"><?php echo htmlspecialchars($omoikaneTraits['season']); ?></div>
                                            <div class="text-[10px] text-indigo-600 bg-indigo-100/50 inline-block px-1.5 py-0.5 rounded">
                                                ⏱️ 季節外れの記録なら、とても貴重なデータになります。
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <?php if (!empty($omoikaneTraits['altitude'])): ?>
                                    <div class="flex items-start gap-2 bg-white/50 rounded-lg p-3">
                                        <span class="material-symbols-outlined text-indigo-400 text-base shrink-0 mt-0.5">terrain</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-indigo-500 mb-0.5 uppercase tracking-widest">標高</div>
                                            <div class="font-medium leading-tight text-xs"><?php echo htmlspecialchars($omoikaneTraits['altitude']); ?></div>
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <!-- Primary Action (Gentle Nudge) -->
                    <div class="mt-6">
                        <!-- Gentle Invitation -->
                        <div class="bg-gradient-to-b from-primary/20 to-transparent p-4 rounded-xl border border-primary/30">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="p-2 rounded-full bg-primary/20 text-primary-light">
                                    <i data-lucide="users" class="w-5 h-5"></i>
                                </div>
                                <div class="font-bold text-primary-dark text-sm">この生き物、なんだろう？</div>
                            </div>
                            <p class="text-xs text-muted mb-4 pl-1">
                                「色だけわかる」「鳥だと思う」といったヒントでも投稿者の助けになります。
                            </p>
                            <div class="flex gap-2">
                                <button @click="idModalOpen = true" class="flex-1 py-3.5 rounded-xl bg-primary-dark hover:bg-primary text-white font-bold text-sm tracking-wide shadow-lg shadow-primary-glow/20 transition flex items-center justify-center gap-2 border border-primary/30 group">
                                    <span class="text-lg">🤔</span>
                                    <span class="group-hover:underline decoration-white/50 underline-offset-4">一緒に考える</span>
                                </button>
                                <?php if (!$species_name): ?>
                                    <a href="id_wizard.php?from_observation=<?php echo urlencode($id); ?>" class="py-3.5 px-4 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-sm transition flex items-center justify-center gap-2 border border-secondary/20">
                                        <i data-lucide="compass" class="w-4 h-4"></i>
                                        <span>ウィザードで調べる</span>
                                    </a>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. Activity / Identification List -->
                <div class="space-y-4">
                    <div class="flex items-center justify-between border-b border-border pb-4">
                        <h3 class="font-bold text-lg text-text flex items-center gap-2">
                            <i data-lucide="book-open" class="w-5 h-5 text-muted"></i>
                            みんなの推測ノート
                        </h3>
                        <span class="text-xs text-muted font-mono"><?php echo count($obs['identifications'] ?? []); ?> posts</span>
                    </div>

                    <!-- Timeline Loop -->
                    <div id="id-list-container" class="space-y-6 pl-2">
                        <?php if (empty($obs['identifications'])): ?>
                            <div class="text-center py-8">
                                <div class="text-3xl mb-3">🌱</div>
                                <p class="text-sm font-bold text-muted mb-1">まだ推測コメントはありません</p>
                                <p class="text-xs text-faint">知っていることを気軽に書いてみよう。<br>小さなヒントも投稿者の助けになるよ！</p>
                            </div>
                        <?php else: ?>
                            <?php foreach (array_reverse($obs['identifications']) as $ident): ?>
                                <?php
                                $userId = $ident['user_id'] ?? '';
                                $isMyId = ($currentUser && $currentUser['id'] === $userId);

                                // Calculate Trust Level & Rank
                                $trustLevel = TrustLevel::calculate($userId);
                                $rankInfo = TrustLevel::getRankInfo($trustLevel);
                                ?>
                                <!-- Item -->
                                <div class="relative pl-6 border-l border-border pb-2"
                                    x-data="inlineTaxonSelector('<?php echo htmlspecialchars($id); ?>')">
                                    <!-- Dot -->
                                    <div class="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-surface border-2 border-border"></div>

                                    <!-- Header -->
                                    <div class="flex items-start justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <img src="<?php echo $ident['user_avatar'] ?? 'https://i.pravatar.cc/100?u=' . $ident['user_id']; ?>" class="w-8 h-8 rounded-full border border-border">
                                            <div>
                                                <div class="text-sm font-bold text-text leading-none flex items-center gap-1.5">
                                                    <?php echo htmlspecialchars($ident['user_name'] ?? 'Unknown'); ?>

                                                    <!-- Rank Badge -->
                                                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-token-xs font-bold border <?php echo $rankInfo['bg'] . ' ' . $rankInfo['color'] . ' ' . $rankInfo['border']; ?>">
                                                        <span><?php echo $rankInfo['icon']; ?></span>
                                                        <span><?php echo $rankInfo['name']; ?></span>
                                                    </span>

                                                    <?php if ($isMyId): ?>
                                                        <span class="text-token-xs bg-primary/20 text-primary px-1.5 rounded ml-1">YOU</span>
                                                    <?php endif; ?>
                                                </div>
                                                <div class="text-token-xs text-muted mt-0.5">
                                                    <?php echo BioUtils::timeAgo($ident['created_at']); ?>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- ID Chip -->
                                        <div class="text-right">
                                            <div class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary-glow hover:bg-primary/20 transition cursor-pointer">
                                                <i data-lucide="tag" class="w-3 h-3 text-primary"></i>
                                                <span class="text-xs font-bold text-primary"><?php echo htmlspecialchars($ident['taxon_name']); ?></span>
                                            </div>
                                            <div class="flex items-center gap-1.5">
                                                <div class="text-token-xs text-muted italic font-mono mt-0.5"><?php echo htmlspecialchars($ident['scientific_name']); ?></div>
                                                <?php if (!empty($ident['life_stage']) && $ident['life_stage'] !== 'unknown'): ?>
                                                    <span class="text-token-xs px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted font-bold">
                                                        <?php
                                                        $lsMap = ['adult' => '成体', 'juvenile' => '幼体', 'egg' => '卵等', 'trace' => '痕跡'];
                                                        echo htmlspecialchars($lsMap[$ident['life_stage']] ?? $ident['life_stage']);
                                                        ?>
                                                    </span>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Comment Body (Standardized & Collapsible) -->
                                    <?php if (!empty($ident['note'])): ?>
                                        <?php
                                        // Use strlen (bytes) because mb_strlen might be missing
                                        // 450 bytes ~= 150 Japanese chars (3 bytes each)
                                        $isLong = strlen($ident['note']) > 450;
                                        ?>
                                        <div class="mt-3 text-sm text-text bg-surface border border-gray-100 rounded-lg p-3 leading-relaxed"
                                            x-data="{ expanded: false }">
                                            <div :class="expanded ? '' : '<?php echo $isLong ? 'line-clamp-4' : ''; ?>'">
                                                <?php echo BioUtils::renderMarkdown($ident['note']); ?>
                                            </div>
                                            <?php if ($isLong): ?>
                                                <button @click="expanded = true" x-show="!expanded" class="text-xs font-bold text-primary-light mt-2 hover:underline">
                                                    もっと見る
                                                </button>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>

                                    <!-- Footer Actions (Gentle) -->
                                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pl-1">
                                        <?php if (!$isMyId): ?>
                                            <button @click="
                                                agreeTarget = { 
                                                    name: '<?php echo htmlspecialchars($ident['taxon_name']); ?>', 
                                                    key: '<?php echo htmlspecialchars($ident['taxon_key'] ?? ''); ?>',
                                                    slug: '<?php echo htmlspecialchars($ident['taxon_slug'] ?? ''); ?>',
                                                    sci: '<?php echo htmlspecialchars($ident['scientific_name'] ?? ''); ?>'
                                                }; 
                                                agreeModalOpen = true;"
                                                class="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition bg-surface px-3 py-1.5 rounded-full hover:bg-primary-surface border border-transparent hover:border-primary/20">
                                                <i data-lucide="sprout" class="w-3.5 h-3.5"></i>
                                                <span>そうかも！ (Agree)</span>
                                            </button>

                                            <!-- Structured One-Click Proposal Trigger -->
                                            <button @click="inlineDispute = !inlineDispute; if(inlineDispute) $nextTick(() => $refs.disputeInput.focus())"
                                                class="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger transition px-2 py-1.5 rounded-full hover:bg-danger/10 border border-transparent">
                                                <i data-lucide="git-merge" class="w-3.5 h-3.5"></i>
                                                <span>違うかも (Propose)</span>
                                            </button>
                                        <?php endif; ?>
                                        <button class="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-secondary transition px-2 py-1.5">
                                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                                            <span>返信</span>
                                        </button>
                                    </div>

                                    <!-- Inline Dispute UI (Structured Proposal) -->
                                    <div x-show="inlineDispute" x-collapse x-cloak>
                                        <div class="mt-3 p-3 bg-danger/5 border border-danger/20 rounded-xl shadow-sm relative">
                                            <div class="flex items-center gap-2">
                                                <input type="text" x-ref="disputeInput" x-model="taxonQuery" @input.debounce.300ms="search()" @keydown.escape="inlineDispute = false"
                                                    class="flex-1 bg-surface border border-border rounded-lg p-2.5 text-sm text-text focus:outline-none focus:border-danger placeholder-muted"
                                                    placeholder="正しい分類群（タクソン）を検索..." autocomplete="off">
                                                <button @click="submitDispute()" :disabled="!taxonSlug || submitting"
                                                    class="px-4 py-2 bg-danger hover:bg-danger/90 text-white text-sm font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <span x-text="submitting ? '送信中...' : '提案'"></span>
                                                </button>
                                            </div>
                                            <!-- Suggestions -->
                                            <div x-show="showSugg && suggestions.length > 0" x-transition @click.away="showSugg = false"
                                                class="absolute left-3 right-20 top-[4.5rem] mt-1 bg-surface border border-border rounded-xl overflow-hidden z-[60] shadow-xl max-h-48 overflow-y-auto">
                                                <template x-for="(s, i) in suggestions" :key="i">
                                                    <button type="button" @click="pick(s)" class="w-full text-left px-4 py-2.5 hover:bg-danger/10 transition border-b border-border last:border-b-0">
                                                        <span class="text-sm font-bold text-text" x-text="s.jp_name"></span>
                                                        <span class="text-xs text-muted italic ml-2" x-text="s.sci_name"></span>
                                                    </button>
                                                </template>
                                            </div>
                                            <div class="flex items-center justify-between mt-2.5 px-1">
                                                <div class="flex items-center gap-1.5 text-token-xs text-danger opacity-80">
                                                    <i data-lucide="info" class="w-3 h-3"></i>
                                                    <span>一覧から正しい分類を選択すると即座に提案が送信されます（Instant Gratification）</span>
                                                </div>
                                                <button @click="inlineDispute = false" class="text-xs font-medium text-muted hover:text-text">キャンセル</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </div>

            </div> <!-- End Right Column -->

        </div> <!-- End Grid -->
    </main>

    <!-- Inline ID Modal (Alpine.js Autocomplete + Ajax) -->
    <div x-show="idModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center px-4" style="display: none;"
        x-data="{
            taxonQuery: '',
            taxonSlug: '',
            taxonSciName: '',
            taxonGbifKey: null,
            suggestions: [],
            showSugg: false,
            note: '',
            selectedConfidence: 'sure',
            lifeStage: 'unknown',
            submitting: false,
            async search() {
                const q = this.taxonQuery.trim();
                if (q.length < 1) { this.suggestions = []; this.showSugg = false; return; }
                this.taxonSlug = '';
                this.taxonSciName = '';
                this.taxonGbifKey = null;
                try {
                    const res = await fetch('api/taxon_suggest.php?q=' + encodeURIComponent(q));
                    const data = await res.json();
                    this.suggestions = data.results || [];
                    this.showSugg = this.suggestions.length > 0;
                } catch(e) { this.suggestions = []; }
            },
            pick(s) {
                this.taxonQuery = s.jp_name || s.sci_name;
                this.taxonSlug = s.slug;
                this.taxonSciName = s.sci_name;
                this.showSugg = false;
                if (navigator.vibrate) navigator.vibrate(30);
            },
            async submit() {
                if (!this.taxonQuery.trim()) return;
                this.submitting = true;
                const _csrf = (document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/)||[])[1]||'';
                try {
                    const res = await fetch('api/post_identification.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': _csrf },
                        body: JSON.stringify({
                            observation_id: '<?php echo htmlspecialchars($id); ?>',
                            taxon_key: this.taxonGbifKey,
                            taxon_name: this.taxonQuery,
                            taxon_slug: this.taxonSlug,
                            scientific_name: this.taxonSciName,
                            confidence: this.selectedConfidence,
                            life_stage: this.lifeStage,
                            note: this.note
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert('ごめん、うまく送れなかった 🙇\n' + (data.message || '時間を空けてもう一度試してみてね'));
                    }
                } catch(e) { alert('通信がうまくいかなかったみたい 📡\n電波の良い場所で試してみてね'); }
                this.submitting = false;
            }
         }">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="idModalOpen = false"></div>
        <div class="bg-surface w-full max-w-2xl rounded-2xl border border-border shadow-2xl relative z-10 p-6">
            <h2 class="text-xl font-bold text-text mb-4">名前を提案する</h2>

            <!-- AI Navigator Shortcut (Everyone can help!) -->
            <?php if ($currentUser): ?>
                <div class="mb-6">
                    <button type="button" @click="$dispatch('open-navigator')" class="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black hover:bg-primary/20 transition group">
                        <i data-lucide="compass" class="w-4 h-4 group-hover:rotate-45 transition duration-500"></i>
                        AIナビゲーターで詳しく特定する (β版)
                    </button>
                </div>
            <?php endif; ?>

            <div class="space-y-4" @navigator-result.window="
                taxonQuery = $event.detail.query; 
                if($event.detail.life_stage !== 'unknown') lifeStage = $event.detail.life_stage;
                search(); 
            ">
                <div class="relative">
                    <label class="block text-xs font-bold text-muted mb-1">種名 (和名または学名)</label>
                    <div class="relative">
                        <input type="text" x-model="taxonQuery" @input.debounce.300ms="search()" @keydown.escape="showSugg = false"
                            class="w-full bg-surface border border-border rounded-lg p-3 text-text focus:outline-none focus:border-primary pr-20"
                            placeholder="例: ヤマシギ" autocomplete="off">
                        <div x-show="taxonSlug" class="absolute right-3 top-3">
                            <span class="text-token-xs font-bold bg-primary/20 text-primary-light px-2 py-1 rounded-full">✓ 確定</span>
                        </div>
                    </div>
                    <!-- Suggestions -->
                    <div x-show="showSugg && suggestions.length > 0" x-transition @click.away="showSugg = false"
                        class="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl overflow-hidden z-50 shadow-xl max-h-48 overflow-y-auto">
                        <template x-for="(s, i) in suggestions" :key="i">
                            <button type="button" @click="pick(s)" class="w-full text-left px-4 py-2.5 hover:bg-primary-surface transition border-b border-border last:border-b-0">
                                <span class="text-sm font-bold text-text" x-text="s.jp_name"></span>
                                <span class="text-xs text-muted italic ml-2" x-text="s.sci_name"></span>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- Life Stage Selector -->
            <div>
                <label class="block text-token-xs font-bold text-muted uppercase tracking-widest mb-2">ライフステージ</label>
                <div class="grid grid-cols-5 gap-1.5">
                    <template x-for="ls in [
                            {id: 'adult', label: '成体', emoji: '👑'},
                            {id: 'juvenile', label: '幼体', emoji: '🌱'},
                            {id: 'egg', label: '卵等', emoji: '🥚'},
                            {id: 'trace', label: '痕跡', emoji: '👣'},
                            {id: 'unknown', label: '不明', emoji: '❓'}
                        ]" :key="ls.id">
                        <button type="button" @click="lifeStage = ls.id"
                            :class="lifeStage === ls.id ? 'bg-primary text-black border-primary' : 'bg-surface border-border text-muted'"
                            class="flex flex-col items-center py-2 rounded-xl border transition group">
                            <span class="text-base" x-text="ls.emoji"></span>
                            <span class="text-token-xs font-bold mt-0.5" x-text="ls.label"></span>
                        </button>
                    </template>
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-muted mb-1">コメント</label>
                <textarea x-model="note" class="w-full bg-surface border border-border rounded-lg p-3 text-text focus:outline-none focus:border-primary h-24" placeholder="同定の根拠やコメントを入力..."></textarea>
            </div>
            <!-- 確信度 (Hidden) -->
            <button @click="submit()" :disabled="submitting || !taxonQuery.trim()"
                class="w-full py-3 rounded-lg bg-primary-dark hover:bg-primary text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <template x-if="submitting"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></template>
                <span x-text="submitting ? '送信中...' : '提案する'"></span>
            </button>
        </div>
        <button @click="idModalOpen = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
            <i data-lucide="x" class="w-6 h-6"></i>
        </button>
    </div>

    <!-- Scripts -->
    <?php include __DIR__ . '/components/navigator.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();

        // Inline Taxon Selector Logic (Wikipedia-style Frictionless ID adapted for Biology)
        document.addEventListener('alpine:init', () => {
            Alpine.data('inlineTaxonSelector', (obsId) => ({
                inlineDispute: false,
                taxonQuery: '',
                taxonSlug: '',
                taxonSciName: '',
                taxonGbifKey: null,
                suggestions: [],
                showSugg: false,
                submitting: false,
                async search() {
                    const q = this.taxonQuery.trim();
                    if (q.length < 1) {
                        this.suggestions = [];
                        this.showSugg = false;
                        return;
                    }
                    this.taxonSlug = '';
                    this.taxonSciName = '';
                    this.taxonGbifKey = null;
                    try {
                        const res = await fetch('api/taxon_suggest.php?q=' + encodeURIComponent(q));
                        const data = await res.json();
                        this.suggestions = data.results || [];
                        this.showSugg = this.suggestions.length > 0;
                    } catch (e) {
                        this.suggestions = [];
                    }
                },
                pick(s) {
                    this.taxonQuery = s.jp_name || s.sci_name;
                    this.taxonSlug = s.slug;
                    this.taxonSciName = s.sci_name;
                    this.showSugg = false;
                    if (navigator.vibrate) navigator.vibrate(30);
                    // Instant Gratification: Auto-submit upon accurate taxonomic selection
                    this.$nextTick(() => {
                        this.submitDispute();
                    });
                },
                async submitDispute() {
                    if (!this.taxonSlug) return;
                    this.submitting = true;
                    this.showSugg = false;
                    const _csrf = (document.cookie.match(/(?:^|;\s*)ikimon_csrf=([a-f0-9]{64})/) || [])[1] || '';
                    try {
                        const res = await fetch('api/post_identification.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Csrf-Token': _csrf
                            },
                            body: JSON.stringify({
                                observation_id: obsId,
                                taxon_key: this.taxonGbifKey,
                                taxon_name: this.taxonQuery,
                                taxon_slug: this.taxonSlug,
                                scientific_name: this.taxonSciName,
                                confidence: 'sure',
                                life_stage: 'unknown',
                                note: ''
                            })
                        });
                        const data = await res.json();
                        if (data.success) {
                            // Instant DOM replacement for Frictionless UX without full page reload
                            const htmlRes = await fetch(window.location.href);
                            const htmlText = await htmlRes.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(htmlText, 'text/html');
                            const newList = doc.querySelector('#id-list-container').innerHTML;
                            const container = document.querySelector('#id-list-container');
                            container.innerHTML = newList;

                            if (window.lucide) window.lucide.createIcons();

                            // Visual feedback
                            const firstItem = container.querySelector('div.relative.pl-6');
                            if (firstItem) {
                                firstItem.classList.add('bg-danger/10', 'transition-colors', 'duration-1000');
                                setTimeout(() => firstItem.classList.remove('bg-danger/10'), 1500);
                            }
                        } else {
                            alert('エラー: ' + (data.message || '送信できませんでした'));
                            this.submitting = false;
                        }
                    } catch (e) {
                        alert('通信エラー');
                        this.submitting = false;
                    }
                }
            }));
        });

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
                new maplibregl.Marker({
                    color: 'var(--color-primary)'
                }).setLngLat([lng, lat]).addTo(map);
            }
        });
    </script>
</body>

</html>