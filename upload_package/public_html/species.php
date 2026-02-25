<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataStore.php';

Auth::init();

// --- Taxon Resolver Routing ---
$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = file_exists($resolverFile) ? json_decode(file_get_contents($resolverFile), true) : null;
$taxa = $resolver['taxa'] ?? [];
$jpIndex = $resolver['jp_index'] ?? [];

$slug = $_GET['name'] ?? null;        // Primary: ?name=oryzias-latipes
$jpParam = $_GET['jp'] ?? null;       // Compat:  ?jp=メダカ
$taxonParam = $_GET['taxon'] ?? null;  // Legacy:  ?taxon=メダカ

// Route resolution
$taxon = null;           // ja_name for internal lookups
$scientificName = null;  // accepted scientific name
$currentSlug = null;     // current slug for canonical URL
$gbifKey = null;

if ($slug) {
    // Primary route: lookup by slug
    $slugNorm = strtolower(trim($slug));
    $slugNorm = preg_replace('/\s+/', '-', $slugNorm);
    $slugNorm = preg_replace('/[^a-z0-9\-]/', '', $slugNorm);

    if (isset($taxa[$slugNorm])) {
        $entry = $taxa[$slugNorm];
        // Handle synonym redirect
        if (!empty($entry['redirect_to']) && isset($taxa[$entry['redirect_to']])) {
            header('Location: species.php?name=' . urlencode($entry['redirect_to']), true, 301);
            exit;
        }
        $taxon = $entry['ja_name'] ?? null;
        $scientificName = $entry['accepted_name'] ?? null;
        $currentSlug = $slugNorm;
        $gbifKey = $entry['gbif_key'] ?? null;
    }
} elseif ($jpParam || $taxonParam) {
    // Compat route: lookup by Japanese name → redirect to canonical slug
    $jpName = $jpParam ?: $taxonParam;
    if (isset($jpIndex[$jpName])) {
        $mappedSlug = $jpIndex[$jpName];
        if (str_starts_with($mappedSlug, '__jp__')) {
            // No scientific name available, use Japanese name directly
            $taxon = $jpName;
        } else {
            header('Location: species.php?name=' . urlencode($mappedSlug), true, 301);
            exit;
        }
    } else {
        // Fallback: use Japanese name directly (not in resolver)
        $taxon = $jpName;
    }
}

if (!$taxon && !$scientificName) {
    header('Location: zukan.php');
    exit;
}

// 1. Fetch Bibliographic Data
$citations = LibraryService::getCitations($taxon);
$keys = LibraryService::searchKeys($taxon);

// 2. Fetch Academic Papers (Tier 1)
$papers = LibraryService::getPapersForTaxon($taxon);

// 3. Red List Lookup
$rlManager = new RedListManager();
$rlResult = $rlManager->lookup($taxon);

// 4. Observation locations + first photo for this taxon
$obsLocations = [];
$firstPhoto = null;
$allObs = DataStore::fetchAll('observations');
if ($allObs) {
    foreach ($allObs as $obs) {
        $obsName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '');
        if ($obsName === $taxon && !empty($obs['location']['lat']) && !empty($obs['location']['lng'])) {
            $obsLocations[] = [
                'lat' => (float) $obs['location']['lat'],
                'lng' => (float) $obs['location']['lng'],
                'date' => $obs['observed_at'] ?? '',
                'observer' => $obs['user']['name'] ?? ''
            ];
            // Grab first available photo for OGP
            if (!$firstPhoto && !empty($obs['photos'][0])) {
                $firstPhoto = $obs['photos'][0];
            }
        }
    }
}

// 5. Scientific name fallback (only if not already set by resolver)
if (!$scientificName) {
    if (!empty($citations)) {
        foreach ($citations as $c) {
            if (!empty($c['scientific_name'])) {
                $scientificName = $c['scientific_name'];
                break;
            }
        }
    }
    if (!$scientificName && !empty($papers)) {
        foreach ($papers as $p) {
            if (!empty($p['link_scientific_name'])) {
                $scientificName = $p['link_scientific_name'];
                break;
            }
        }
    }
}

// Total data count
$dataCount = count($citations) + count($keys) + count($papers);
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $displayName = $taxon ?: $scientificName;
    $meta_title = $scientificName ? htmlspecialchars($scientificName) . ($taxon ? ' (' . htmlspecialchars($taxon) . ')' : '') : htmlspecialchars($displayName);
    $descParts = [];
    if ($taxon) $descParts[] = $taxon;
    if ($scientificName) $descParts[] = $scientificName;
    $descParts[] = count($obsLocations) . '件の観察記録';
    if ($dataCount > 0) $descParts[] = $dataCount . '件の文献データ';
    if ($rlResult) {
        $firstRl = reset($rlResult);
        $descParts[] = 'レッドリスト: ' . ($firstRl['category_label'] ?? $firstRl['category']);
    }
    $meta_description = implode(' | ', $descParts) . ' — ikimon.life';
    // OGP image: use first observation photo if available
    if ($firstPhoto) {
        $meta_image = (strpos($firstPhoto, 'http') === 0) ? $firstPhoto : BASE_URL . '/uploads/photos/' . basename($firstPhoto);
    }
    // Canonical URL (Clean URL format)
    if ($currentSlug) {
        $meta_canonical = BASE_URL . '/species/' . urlencode($currentSlug);
    } elseif ($taxon) {
        $meta_canonical = BASE_URL . '/species.php?jp=' . urlencode($taxon);
    }
    include __DIR__ . '/components/meta.php';
    ?>

    <!-- JSON-LD Structured Data -->
    <script type="application/ld+json">
        <?php
        $jsonLd = [
            '@context' => 'https://schema.org',
            '@type' => 'Taxon',
            'name' => $scientificName ?: $displayName,
            'alternateName' => $taxon ?: null,
            'description' => $meta_description,
            'url' => $meta_canonical ?? (BASE_URL . '/species.php?jp=' . urlencode($displayName)),
        ];
        if ($gbifKey) {
            $jsonLd['sameAs'] = 'https://www.gbif.org/species/' . $gbifKey;
            $jsonLd['identifier'] = [
                '@type' => 'PropertyValue',
                'propertyID' => 'GBIF',
                'value' => $gbifKey
            ];
        }
        if ($rlResult) {
            $firstEntry = reset($rlResult);
            $jsonLd['additionalProperty'] = [
                '@type' => 'PropertyValue',
                'name' => 'conservationStatus',
                'value' => $firstEntry['category_label'] ?? $firstEntry['category']
            ];
        }
        if ($firstPhoto) {
            $jsonLd['image'] = BASE_URL . '/uploads/photos/' . basename($firstPhoto);
        }
        // Remove null values
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        ?>
    </script>
    <?php if (!empty($obsLocations)): ?>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css">
        <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <?php endif; ?>
    <style>
        body {
            padding-top: env(safe-area-inset-top);
            padding-bottom: calc(env(safe-area-inset-bottom) + 5rem);
        }

        .rl-badge {
            animation: rl-pulse 3s ease-in-out infinite;
        }

        @keyframes rl-pulse {

            0%,
            100% {
                opacity: 1
            }

            50% {
                opacity: .75
            }
        }

        .species-header {
            padding-top: calc(3.5rem + env(safe-area-inset-top) + 1rem);
        }

        #species-map {
            min-height: 200px;
        }
    </style>
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body min-h-screen">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <!-- Header -->
    <header class="species-header px-5 pb-4 flex items-center justify-between">
        <a href="javascript:history.back()" class="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 bg-surface border border-border text-muted">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
        </a>
        <div class="text-token-xs font-bold uppercase tracking-[.2em] font-mono" style="color: var(--color-text-faint);">SPECIMEN ARCHIVE</div>
        <div class="w-10"></div>
    </header>

    <main class="px-5 space-y-6 max-w-2xl mx-auto">

        <!-- 1. Specimen Identity -->
        <section>
            <div class="mb-4">
                <h1 class="text-3xl font-black leading-tight tracking-tight text-text"><?php echo htmlspecialchars($taxon ?: $scientificName); ?></h1>
                <?php if ($taxon && $scientificName): ?>
                    <p class="text-sm italic mt-0.5 text-muted"><?php echo htmlspecialchars($scientificName); ?></p>
                <?php endif; ?>
            </div>

            <!-- Stats Row -->
            <div class="flex items-center gap-3 mb-4">
                <?php if ($rlResult): ?>
                    <?php $firstRl = reset($rlResult); ?>
                    <span class="rl-badge inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                        style="background: <?php echo htmlspecialchars($firstRl['category_color']); ?>15; border-color: <?php echo htmlspecialchars($firstRl['category_color']); ?>40; color: <?php echo htmlspecialchars($firstRl['category_color']); ?>;">
                        <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
                        <?php echo htmlspecialchars($firstRl['category']); ?>
                    </span>
                <?php endif; ?>
                <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-token-xs font-mono bg-surface border border-border text-secondary">
                    <i data-lucide="database" class="w-3 h-3"></i>
                    <?php echo $dataCount; ?> records
                </span>
                <?php if (!empty($obsLocations)): ?>
                    <span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-token-xs font-mono bg-surface border border-border text-secondary">
                        <i data-lucide="map-pin" class="w-3 h-3"></i>
                        <?php echo count($obsLocations); ?> sightings
                    </span>
                <?php endif; ?>
                <?php if ($gbifKey): ?>
                    <a href="https://www.gbif.org/species/<?php echo urlencode($gbifKey); ?>" target="_blank" rel="noopener"
                        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-token-xs font-mono transition bg-surface border border-border text-secondary hover:border-secondary/40">
                        <i data-lucide="external-link" class="w-3 h-3"></i>
                        GBIF
                    </a>
                <?php endif; ?>
            </div>

            <!-- Share Buttons -->
            <div class="flex items-center gap-2 mt-3" x-data="{ copied: false }">
                <span class="text-token-xs text-faint font-bold uppercase tracking-wider mr-1">Share</span>
                <?php
                $shareUrl = $meta_canonical ?? (BASE_URL . '/species.php?jp=' . urlencode($displayName));
                $shareText = ($taxon ?: $scientificName) . ' — ikimon.life 種の情報';
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
                <button @click="navigator.clipboard.writeText('<?php echo htmlspecialchars($shareUrl, ENT_QUOTES); ?>').then(() => { copied = true; setTimeout(() => copied = false, 2000); })"
                    class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-primary hover:text-white hover:border-primary transition relative"
                    title="URLをコピー">
                    <i data-lucide="link" class="w-3.5 h-3.5" x-show="!copied"></i>
                    <i data-lucide="check" class="w-3.5 h-3.5" x-show="copied" x-cloak></i>
                </button>
                <template x-if="navigator.share">
                    <button @click="navigator.share({ title: '<?php echo htmlspecialchars($taxon ?: $scientificName, ENT_QUOTES); ?>', url: '<?php echo htmlspecialchars($shareUrl, ENT_QUOTES); ?>' })"
                        class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-accent hover:text-white hover:border-accent transition"
                        title="その他のシェア">
                        <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
                    </button>
                </template>
            </div>
        </section>

        <!-- 2. Red List Detail (if listed) -->
        <?php if ($rlResult): ?>
            <section class="space-y-2">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="shield-alert" class="w-4 h-4 text-danger"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-danger">CONSERVATION STATUS</h2>
                </div>
                <?php foreach ($rlResult as $listId => $entry): ?>
                    <div class="flex items-center gap-3 p-4 rounded-xl border bg-surface"
                        style="border-color: <?php echo htmlspecialchars($entry['category_color']); ?>30;">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm font-mono"
                            style="background: <?php echo htmlspecialchars($entry['category_color']); ?>18; color: <?php echo htmlspecialchars($entry['category_color']); ?>;">
                            <?php echo htmlspecialchars($entry['category'] ?? ''); ?>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-bold text-text"><?php echo htmlspecialchars($entry['category_label'] ?? $entry['category']); ?></div>
                            <div class="text-token-xs mt-0.5 text-muted">
                                <?php echo $listId === 'national' ? '環境省レッドリスト' : htmlspecialchars(ucfirst($listId)) . '県レッドリスト'; ?>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </section>
        <?php endif; ?>

        <!-- 3. Observation Minimap -->
        <?php if (!empty($obsLocations)): ?>
            <section>
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="map" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">SIGHTINGS</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($obsLocations); ?> records</span>
                </div>
                <div id="species-map" class="w-full rounded-2xl overflow-hidden shadow-sm border border-border"></div>
                <script nonce="<?= CspNonce::attr() ?>">
                    document.addEventListener('DOMContentLoaded', () => {
                        const locs = <?php echo json_encode($obsLocations); ?>;
                        if (!locs.length) return;
                        const map = new maplibregl.Map({
                            container: 'species-map',
                            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                            center: [locs[0].lng, locs[0].lat],
                            zoom: 13,
                            interactive: true,
                            attributionControl: false
                        });
                        map.addControl(new maplibregl.NavigationControl(), 'top-right');
                        if (locs.length > 1) {
                            const b = new maplibregl.LngLatBounds();
                            locs.forEach(l => b.extend([l.lng, l.lat]));
                            map.fitBounds(b, {
                                padding: 40,
                                maxZoom: 15
                            });
                        }
                        map.on('load', () => {
                            locs.forEach(loc => {
                                const el = document.createElement('div');
                                el.style.cssText = 'width:14px;height:14px;background:#10b981;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,.4);';
                                new maplibregl.Marker({
                                        element: el
                                    })
                                    .setLngLat([loc.lng, loc.lat])
                                    .setPopup(new maplibregl.Popup({
                                        offset: 12
                                    }).setHTML(
                                        `<div class="text-token-xs" style="color:#333;"><strong>${loc.observer}</strong><br>${loc.date}</div>`
                                    ))
                                    .addTo(map);
                            });
                        });
                    });
                </script>
            </section>
        <?php endif; ?>

        <!-- 4. Bibliographic DNA -->
        <section>
            <div class="flex items-center gap-2 mb-3">
                <i data-lucide="book-open" class="w-4 h-4 text-accent"></i>
                <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">BIBLIOGRAPHIC DNA</h2>
            </div>

            <div class="space-y-3">
                <?php if (empty($citations) && empty($keys)): ?>
                    <div class="p-6 rounded-xl text-center border border-border bg-surface">
                        <p class="text-sm text-muted">No digitized references found yet.</p>
                    </div>
                <?php endif; ?>

                <?php foreach ($citations as $cit): ?>
                    <div class="p-4 rounded-xl border border-warning/20 bg-warning-surface/50 space-y-2">
                        <div class="flex items-start gap-3">
                            <div class="mt-0.5 min-w-[32px] h-8 rounded bg-warning/10 flex items-center justify-center text-warning text-token-xs font-bold font-mono">
                                P.<?php echo $cit['page']; ?>
                            </div>
                            <div class="flex-1">
                                <div class="text-token-xs text-warning mb-0.5 font-bold uppercase truncate"><?php echo htmlspecialchars($cit['book_title']); ?></div>
                                <div class="text-sm text-text-secondary">
                                    <span class="font-mono text-accent-dark"><?php echo htmlspecialchars($cit['taxon_name']); ?></span>
                                    <?php if (!empty($cit['scientific_name'])): ?>
                                        <span class="italic text-xs ml-1 text-muted"><?php echo htmlspecialchars($cit['scientific_name']); ?></span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>

                        <?php if (!empty($cit['data_icons'])): ?>
                            <div class="flex flex-wrap gap-1.5 pl-11">
                                <?php if (!empty($cit['data_icons']['size'])): ?>
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs" style="background: var(--color-bg-surface); color: var(--color-text-secondary);">
                                        <i data-lucide="ruler" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($cit['data_icons']['size']); ?>
                                    </span>
                                <?php endif; ?>
                                <?php if (!empty($cit['data_icons']['season'])): ?>
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs" style="background: var(--color-bg-surface); color: var(--color-text-secondary);">
                                        <i data-lucide="calendar" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($cit['data_icons']['season']); ?>
                                    </span>
                                <?php endif; ?>
                                <?php if (!empty($cit['data_icons']['distribution'])): ?>
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs bg-surface text-text-secondary border border-border">
                                        <i data-lucide="globe" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($cit['data_icons']['distribution']); ?>
                                    </span>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>

                        <?php if (!empty($cit['photos'])): ?>
                            <div class="flex flex-wrap gap-1.5 pl-11">
                                <?php foreach ($cit['photos'] as $photo): ?>
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent-surface border border-accent/20 text-token-xs text-accent-dark">
                                        <i data-lucide="camera" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($photo); ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>

                        <?php if (!empty($cit['gbif_status']) && $cit['gbif_status'] === 'SYNONYM'): ?>
                            <div class="pl-11">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 border border-secondary/20 text-token-xs text-secondary">
                                    <i data-lucide="git-merge" class="w-2.5 h-2.5"></i> 現在は <?php echo htmlspecialchars($cit['gbif_accepted_name'] ?? ''); ?> に統合する見解もあります
                                </span>
                            </div>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>

                <?php foreach ($keys as $key): ?>
                    <div class="p-4 rounded-xl border border-primary/20 bg-primary-surface/50 relative overflow-hidden group hover:border-primary/40 transition">
                        <div class="absolute inset-0 bg-primary-surface/10 group-hover:bg-primary-surface/20 transition"></div>
                        <div class="relative z-10">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-token-xs text-primary font-bold tracking-[.15em] uppercase">IDENTIFICATION KEY</div>
                                <i data-lucide="key" class="w-4 h-4 text-primary/40"></i>
                            </div>
                            <h3 class="text-sm font-bold mb-1 text-text"><?php echo htmlspecialchars($key['title']); ?></h3>
                            <div class="text-xs font-mono mb-3 truncate text-muted">
                                <?php echo htmlspecialchars(mb_substr($key['content_raw'], 0, 60)); ?>...
                            </div>
                            <a href="id_wizard.php?step=book_key&taxon=<?php echo urlencode($key['target_taxon']); ?>" class="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition">
                                USE THIS KEY <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                            </a>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <!-- 5. Academic References -->
        <?php if (!empty($papers)): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="flask-conical" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">ACADEMIC REFERENCES</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($papers); ?> papers</span>
                </div>
                <div class="space-y-2">
                    <?php foreach ($papers as $paper): ?>
                        <a href="<?php echo htmlspecialchars($paper['url'] ?? '#'); ?>" target="_blank" rel="noopener"
                            class="block p-4 rounded-xl border border-accent/20 bg-accent-surface/30 hover:border-accent/40 transition group">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i data-lucide="file-text" class="w-4 h-4 text-accent"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-semibold leading-snug transition line-clamp-2 text-text">
                                        <?php echo htmlspecialchars($paper['title']); ?>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                        <?php if (!empty($paper['year'])): ?>
                                            <span class="text-token-xs text-accent font-mono font-bold"><?php echo $paper['year']; ?></span>
                                        <?php endif; ?>
                                        <?php if (!empty($paper['container_title'])): ?>
                                            <span class="text-token-xs italic truncate text-muted"><?php echo htmlspecialchars($paper['container_title']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <?php if (!empty($paper['doi'])): ?>
                                        <div class="flex items-center gap-1.5 mt-1">
                                            <span class="text-token-xs font-mono text-muted">DOI: <?php echo htmlspecialchars($paper['doi']); ?></span>
                                            <i data-lucide="external-link" class="w-3 h-3 transition text-faint"></i>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        // Activate Lucide icons
        document.addEventListener('DOMContentLoaded', () => {
            if (window.lucide) lucide.createIcons();
        });
    </script>
</body>

</html>