<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/AffiliateManager.php';
require_once __DIR__ . '/../libs/Services/MyZukanService.php';
require_once __DIR__ . '/../libs/Services/ZukanService.php';
require_once __DIR__ . '/../libs/Services/SpeciesChallengeEngine.php';

Auth::init();
Lang::init();

function publicPhotoUrl(?string $photoPath): ?string
{
    if (!$photoPath) {
        return null;
    }
    if (strpos($photoPath, 'http') === 0) {
        return $photoPath;
    }
    return BASE_URL . '/' . ltrim($photoPath, '/');
}

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
            header('Location: /species.php?name=' . urlencode($entry['redirect_to']), true, 301);
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
            header('Location: /species.php?name=' . urlencode($mappedSlug), true, 301);
            exit;
        }
    } else {
        // Fallback: use Japanese name directly (not in resolver)
        $taxon = $jpName;
    }
}

if (!$taxon && !$scientificName) {
    header('Location: /zukan.php');
    exit;
}

// ============================================================
// DATA PIPELINE
// ============================================================

// 1. Auth context
$user = Auth::user();
$userId = $user['id'] ?? '';
$isLoggedIn = Auth::isLoggedIn();

// 2. Red List
$rlManager = new RedListManager();
$rlResult = $rlManager->lookup($taxon);

// 3. Observation scan (single pass: phenology + map + 30-day pulse)
$allObs = DataStore::fetchAll('observations');
$obsLocations = [];
$firstPhoto = null;
$monthCounts = array_fill(1, 12, 0);
$observationCount = 0;
$last30DayCount = 0;
$uniqueObservers = [];
$uniqueObservers30d = [];
$thirtyDaysAgo = date('Y-m-d', strtotime('-30 days'));

if ($allObs) {
    foreach ($allObs as $obs) {
        $obsName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '');
        $obsScientificName = $obs['taxon']['scientific_name'] ?? '';
        $matchesTaxon = ($taxon && $obsName === $taxon)
            || ($scientificName && ($obsScientificName === $scientificName || $obsName === $scientificName));

        if ($matchesTaxon) {
            $observationCount++;
            if (!$firstPhoto && !empty($obs['photos'][0])) {
                $firstPhoto = $obs['photos'][0];
            }
            $obsDate = $obs['observed_at'] ?? '';
            if ($obsDate && preg_match('/^\d{4}-(\d{2})/', $obsDate, $m)) {
                $mo = (int)$m[1];
                if ($mo >= 1 && $mo <= 12) $monthCounts[$mo]++;
            }
            $obsLat = $obs['lat'] ?? ($obs['location']['lat'] ?? null);
            $obsLng = $obs['lng'] ?? ($obs['location']['lng'] ?? null);
            if (!empty($obsLat) && !empty($obsLng)) {
                $obsLocations[] = [
                    'lat' => (float)$obsLat,
                    'lng' => (float)$obsLng,
                    'date' => $obsDate,
                    'observer' => $obs['user_name'] ?? ($obs['user']['name'] ?? ''),
                ];
            }
            $uid = $obs['user_id'] ?? '';
            if ($uid) $uniqueObservers[$uid] = true;
            if ($obsDate >= $thirtyDaysAgo) {
                $last30DayCount++;
                if ($uid) $uniqueObservers30d[$uid] = true;
            }
        }
    }
}

$phenologyMax = max($monthCounts);
$hasPhenologyData = $phenologyMax > 0;

// 4. Community index (cached 1h)
$communityEntry = [
    'obs_count' => $observationCount,
    'observer_count' => count($uniqueObservers),
];

// 5. Personal data (logged in only)
$userEntry = null;
$pageMode = 'anonymous';
$encounterLabel = '';

if ($isLoggedIn && $userId) {
    $taxonKey = '';
    if ($currentSlug) {
        foreach ($allObs as $obs) {
            $on = $obs['taxon']['name'] ?? '';
            $osn = $obs['taxon']['scientific_name'] ?? '';
            if (($taxon && $on === $taxon) || ($scientificName && $osn === $scientificName)) {
                $taxonKey = $obs['taxon']['key'] ?? '';
                if ($taxonKey) break;
            }
        }
    }
    $userEntry = MyZukanService::getSpeciesDetail($userId, $taxonKey ?: 'none', $taxon);

    if ($userEntry) {
        $pageMode = 'my_species';
        $encounterLabels = [1 => 'はじめまして', 2 => '顔なじみ', 5 => 'おなじみ', 10 => '常連さん', 30 => 'ベストフレンド'];
        $ec = $userEntry['encounter_count'] ?? 0;
        $encounterLabel = 'はじめまして';
        foreach ($encounterLabels as $threshold => $label) {
            if ($ec >= $threshold) $encounterLabel = $label;
        }
    } else {
        $pageMode = 'new_species';
    }
}

// 6. Co-occurrence data
$coOccurrenceFile = DATA_DIR . '/ecology/co_occurrence.json';
$coOccurrence = file_exists($coOccurrenceFile)
    ? json_decode(file_get_contents($coOccurrenceFile), true) ?? []
    : [];

$coSpecies = [];
$coGroup = null;
$speciesNameForCo = $taxon ?: '';
foreach ($coOccurrence as $group) {
    if (in_array($speciesNameForCo, $group['species'] ?? [])) {
        $coSpecies = array_filter($group['species'] ?? [], fn($s) => $s !== $speciesNameForCo);
        $coSpecies = array_values($coSpecies);
        $coGroup = $group;
        break;
    }
}

// 7. Challenges (logged in only)
$challenges = [];
if ($isLoggedIn) {
    $userFoundNames = null;
    if ($userEntry !== null) {
        $fullIndex = MyZukanService::buildUserIndex($userId);
        $userFoundNames = array_map(fn($e) => $e['name'] ?? '', $fullIndex);
    }
    $challenges = SpeciesChallengeEngine::compute(
        $monthCounts, $rlResult, $userEntry, $coOccurrence, $communityEntry, $userFoundNames
    );
}

// 8. Affiliate books
$taxonForAffiliate = [
    'slug' => $currentSlug ?? '',
    'scientific_name' => $scientificName ?? '',
    'lineage' => [],
    'gbif_key' => $gbifKey ?? null,
];
$affiliateContext = 'encyclopedia';
$affiliateBooks = AffiliateManager::getBooks($taxonForAffiliate, $affiliateContext);

// 9. Display name and meta
$displayName = $taxon ?: ($scientificName ?: 'Unknown');
$meta_title = $displayName . ($scientificName && $taxon ? " ({$scientificName})" : '');
$descParts = [];
if ($taxon) $descParts[] = $taxon;
if ($scientificName) $descParts[] = $scientificName;
if ($observationCount > 0) $descParts[] = $observationCount . '件の観察記録';
if ($rlResult) {
    $firstRl = reset($rlResult);
    $descParts[] = 'レッドリスト: ' . ($firstRl['category_label'] ?? $firstRl['category']);
}
$meta_description = implode(' | ', $descParts) . ' — ikimon.life';
$meta_image = $firstPhoto ? publicPhotoUrl($firstPhoto) : null;
if ($userEntry && $userEntry['cover_photo']) {
    $meta_image = publicPhotoUrl($userEntry['cover_photo']);
}
$meta_canonical = null;
if ($currentSlug) {
    $meta_canonical = BASE_URL . '/species/' . urlencode($currentSlug);
} elseif ($taxon) {
    $meta_canonical = BASE_URL . '/species.php?jp=' . urlencode($taxon);
}

// User's photos for gallery
$userPhotos = [];
if ($userEntry) {
    foreach ($userEntry['encounters'] ?? [] as $enc) {
        foreach ($enc['photos'] ?? [] as $p) {
            if ($p) $userPhotos[] = $p;
        }
    }
    $userPhotos = array_slice($userPhotos, 0, 6);
}

// User's found species names (for co-occurrence checkmarks)
$userFoundSpeciesNames = [];
if ($isLoggedIn && $userId) {
    $fullIndex = MyZukanService::buildUserIndex($userId);
    $userFoundSpeciesNames = array_map(fn($e) => $e['name'] ?? '', $fullIndex);
}
?>
<!DOCTYPE html>
<html lang="<?php echo Lang::get('lang_code', 'ja'); ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>

    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
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
                'value' => $gbifKey,
            ];
        }
        if ($rlResult) {
            $firstEntry = reset($rlResult);
            $jsonLd['additionalProperty'] = [
                '@type' => 'PropertyValue',
                'name' => 'conservationStatus',
                'value' => $firstEntry['category_label'] ?? $firstEntry['category'],
            ];
        }
        if ($observationCount > 0) {
            $jsonLd['numberOfItems'] = $observationCount;
        }
        if ($meta_image) $jsonLd['image'] = $meta_image;
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        ?>
    </script>
    <?php if (!empty($obsLocations)): ?>
        <?php include __DIR__ . '/components/map_config.php'; ?>
    <?php endif; ?>
    <style>
        body { padding-top: env(safe-area-inset-top); padding-bottom: calc(env(safe-area-inset-bottom) + 5rem); }
        .rl-badge { animation: rl-pulse 3s ease-in-out infinite; }
        @keyframes rl-pulse { 0%,100% { opacity:1 } 50% { opacity:.75 } }
        .species-header { padding-top: calc(3.5rem + env(safe-area-inset-top) + 1rem); }
        #species-map { min-height: 200px; }
        .challenge-bar { background: var(--md-surface-container-low); border-radius: 999px; height: 6px; overflow: hidden; }
        .challenge-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
    </style>
</head>

<body class="font-body min-h-screen" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <header class="species-header px-5 pb-4 flex items-center justify-between">
        <a href="javascript:history.back()" class="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
        </a>
        <div class="text-token-xs font-bold uppercase tracking-[.2em] font-mono" style="color:var(--color-text-faint);">
            <?php echo $pageMode === 'my_species' ? 'MY FIELD GUIDE' : 'SPECIES'; ?>
        </div>
        <div class="w-10"></div>
    </header>

    <main class="px-5 space-y-6 max-w-2xl mx-auto">

        <!-- ═══ A. HERO / IDENTITY ═══ -->
        <section>
            <?php
            $heroPhoto = null;
            if ($pageMode === 'my_species' && $userEntry['cover_photo']) {
                $heroPhoto = publicPhotoUrl($userEntry['cover_photo']);
            } elseif ($firstPhoto) {
                $heroPhoto = publicPhotoUrl($firstPhoto);
            }
            ?>
            <?php if ($heroPhoto): ?>
                <div class="mb-4 overflow-hidden" style="border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);background:var(--md-surface-container);box-shadow:var(--elev-1);">
                    <img src="<?php echo htmlspecialchars($heroPhoto); ?>"
                         alt="<?php echo htmlspecialchars($displayName); ?>"
                         class="w-full h-56 object-cover" loading="lazy">
                </div>
            <?php endif; ?>

            <h1 class="text-3xl font-black leading-tight tracking-tight text-text"><?php echo htmlspecialchars($displayName); ?></h1>
            <?php if ($taxon && $scientificName): ?>
                <p class="text-sm italic mt-0.5 text-muted"><?php echo htmlspecialchars($scientificName); ?></p>
            <?php endif; ?>

            <div class="flex flex-wrap items-center gap-2 mt-3">
                <?php if ($rlResult): ?>
                    <?php $firstRl = reset($rlResult); ?>
                    <span class="rl-badge inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                          style="background:<?php echo htmlspecialchars($firstRl['category_color']); ?>15;border-color:<?php echo htmlspecialchars($firstRl['category_color']); ?>40;color:<?php echo htmlspecialchars($firstRl['category_color']); ?>;">
                        <i data-lucide="shield-alert" class="w-3.5 h-3.5" style="pointer-events:none;"></i>
                        <?php echo htmlspecialchars($firstRl['category']); ?>
                    </span>
                <?php endif; ?>
                <span class="inline-flex items-center gap-1 px-3 py-1.5 text-token-xs font-mono" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                    <i data-lucide="eye" class="w-3 h-3" style="pointer-events:none;"></i>
                    <?php echo $observationCount; ?> records
                </span>
                <?php if ($gbifKey): ?>
                    <a href="https://www.gbif.org/species/<?php echo urlencode($gbifKey); ?>" target="_blank" rel="noopener noreferrer"
                       class="inline-flex items-center gap-1 px-3 py-1.5 text-token-xs font-mono transition" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                        <i data-lucide="external-link" class="w-3 h-3" style="pointer-events:none;"></i>
                        GBIF
                    </a>
                <?php endif; ?>
            </div>

            <!-- Share -->
            <div class="flex items-center gap-2 mt-3" x-data="{ copied: false }">
                <span class="text-token-xs text-faint font-bold uppercase tracking-wider mr-1">Share</span>
                <?php
                $shareUrl = $meta_canonical ?? (BASE_URL . '/species.php?jp=' . urlencode($displayName));
                $shareText = ($taxon ?: $scientificName) . ' — ikimon.life';
                ?>
                <a href="https://twitter.com/intent/tweet?url=<?php echo urlencode($shareUrl); ?>&text=<?php echo urlencode($shareText); ?>"
                   target="_blank" rel="noopener noreferrer"
                   class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black hover:text-white transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                   title="X">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://social-plugins.line.me/lineit/share?url=<?php echo urlencode($shareUrl); ?>"
                   target="_blank" rel="noopener noreferrer"
                   class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#06C755] hover:text-white transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                   title="LINE">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                </a>
                <button type="button" @click="navigator.clipboard.writeText('<?php echo htmlspecialchars($shareUrl); ?>').then(() => { copied = true; setTimeout(() => copied = false, 2000); })"
                        class="w-8 h-8 flex items-center justify-center rounded-full transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                        title="URLをコピー">
                    <i data-lucide="link" class="w-3.5 h-3.5" style="pointer-events:none;" x-show="!copied"></i>
                    <i data-lucide="check" class="w-3.5 h-3.5 text-accent" style="pointer-events:none;" x-show="copied" x-cloak></i>
                </button>
            </div>
        </section>

        <!-- ═══ B. PERSONAL STORY (my_species only) ═══ -->
        <?php if ($pageMode === 'my_species' && $userEntry): ?>
            <section style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="heart" class="w-4 h-4 text-accent" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">あなたの記録</h2>
                    <span class="ml-auto text-sm font-bold text-accent"><?php echo htmlspecialchars($encounterLabel); ?></span>
                </div>

                <div class="grid grid-cols-3 gap-3 text-center mb-4">
                    <div>
                        <div class="text-2xl font-black text-text"><?php echo $userEntry['encounter_count']; ?></div>
                        <div class="text-token-xs text-muted">出会い</div>
                    </div>
                    <div>
                        <div class="text-sm font-bold text-text"><?php echo htmlspecialchars(date('Y/m/d', strtotime($userEntry['first_encounter']))); ?></div>
                        <div class="text-token-xs text-muted">初めての出会い</div>
                    </div>
                    <div>
                        <?php
                        $latestTs = strtotime($userEntry['latest_encounter']);
                        $daysAgo = max(0, (int)((time() - $latestTs) / 86400));
                        $latestLabel = $daysAgo === 0 ? '今日' : ($daysAgo === 1 ? '昨日' : $daysAgo . '日前');
                        ?>
                        <div class="text-sm font-bold text-text"><?php echo $latestLabel; ?></div>
                        <div class="text-token-xs text-muted">最後に会った日</div>
                    </div>
                </div>

                <?php if (!empty($userPhotos)): ?>
                    <div class="grid grid-cols-3 gap-1.5 mb-3">
                        <?php foreach ($userPhotos as $photo): ?>
                            <div class="aspect-square overflow-hidden rounded-lg">
                                <img src="<?php echo htmlspecialchars(publicPhotoUrl($photo)); ?>"
                                     alt="" class="w-full h-full object-cover" loading="lazy">
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <?php $storyTaxonKey = $userEntry['taxon_key'] ?? ''; ?>
                <?php if ($storyTaxonKey): ?>
                    <div x-data="{ story: null, loading: true }"
                         x-init="fetch('/api/v2/species_story.php?taxon_key=<?php echo urlencode($storyTaxonKey); ?>')
                            .then(r => r.json())
                            .then(d => { story = d.story; loading = false; })
                            .catch(() => { loading = false; })">
                        <template x-if="loading">
                            <div class="text-token-xs text-muted animate-pulse">ストーリーを生成中...</div>
                        </template>
                        <template x-if="!loading && story">
                            <div class="text-sm text-muted leading-relaxed" x-text="story"></div>
                        </template>
                    </div>
                <?php endif; ?>
            </section>
        <?php endif; ?>

        <!-- ═══ NEW_SPECIES CTA ═══ -->
        <?php if ($pageMode === 'new_species'): ?>
            <section class="text-center py-6" style="border-radius:var(--shape-xl);background:linear-gradient(135deg, var(--color-accent-surface), var(--md-surface-container));border:1px dashed var(--color-accent);box-shadow:var(--elev-1);">
                <i data-lucide="camera" class="w-8 h-8 text-accent mx-auto mb-2" style="pointer-events:none;"></i>
                <p class="text-lg font-bold text-text mb-1">この種を初めて記録しよう！</p>
                <p class="text-sm text-muted">ikimon.life であなたの図鑑に追加</p>
                <a href="/post.php" class="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-full text-sm font-bold text-white transition" style="background:var(--color-primary);">
                    <i data-lucide="plus" class="w-4 h-4" style="pointer-events:none;"></i>
                    記録する
                </a>
            </section>
        <?php endif; ?>

        <!-- ═══ C. COMMUNITY PULSE ═══ -->
        <section>
            <div class="flex items-center gap-2 mb-3">
                <i data-lucide="users" class="w-4 h-4 text-secondary" style="pointer-events:none;"></i>
                <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">みんなの記録</h2>
            </div>

            <?php if ($observationCount > 0): ?>
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <div class="text-center p-3 rounded-xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                        <div class="text-xl font-black text-text"><?php echo $observationCount; ?></div>
                        <div class="text-token-xs text-muted">全観察</div>
                    </div>
                    <div class="text-center p-3 rounded-xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                        <div class="text-xl font-black text-text"><?php echo count($uniqueObservers); ?></div>
                        <div class="text-token-xs text-muted">記録者</div>
                    </div>
                    <div class="text-center p-3 rounded-xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                        <div class="text-xl font-black text-text"><?php echo $last30DayCount; ?></div>
                        <div class="text-token-xs text-muted">直近30日</div>
                    </div>
                </div>
            <?php else: ?>
                <div class="text-center py-8 rounded-xl text-muted text-sm" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                    まだ観察記録がありません。<br>初めての記録者になりませんか？
                </div>
            <?php endif; ?>
        </section>

        <!-- Phenology -->
        <?php if ($hasPhenologyData): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="calendar-range" class="w-4 h-4 text-warning" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-warning">PHENOLOGY</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo array_sum($monthCounts); ?> records</span>
                </div>
                <div style="padding:1rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <div class="flex items-end gap-1 h-16">
                        <?php
                        $monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        $currentMonth = (int)date('n');
                        for ($i = 1; $i <= 12; $i++):
                            $count = $monthCounts[$i];
                            $pct = $phenologyMax > 0 ? ($count / $phenologyMax) * 100 : 0;
                            $minH = $count > 0 ? 12 : 4;
                            $barH = max($minH, $pct * 0.56);
                            $opacity = $count > 0 ? max(0.3, $pct / 100) : 0.08;
                            $isCurrent = ($i === $currentMonth);
                        ?>
                            <div class="flex-1 flex flex-col items-center gap-1 group" title="<?php echo $monthLabels[$i-1] . ': ' . $count; ?>">
                                <div class="w-full rounded-sm transition-all duration-300 group-hover:opacity-100 <?php echo $isCurrent ? 'ring-1 ring-warning/50' : ''; ?>"
                                     style="height:<?php echo $barH; ?>px;background:<?php echo $count > 0 ? 'var(--color-warning)' : 'var(--color-border)'; ?>;opacity:<?php echo $opacity; ?>;"></div>
                                <span class="text-[9px] font-mono <?php echo $isCurrent ? 'font-bold text-warning' : 'text-muted'; ?>"><?php echo $monthLabels[$i-1]; ?></span>
                            </div>
                        <?php endfor; ?>
                    </div>
                </div>
            </section>
        <?php endif; ?>

        <!-- Map -->
        <?php if (!empty($obsLocations)): ?>
            <section>
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="map" class="w-4 h-4 text-secondary" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">目撃マップ</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($obsLocations); ?> points</span>
                </div>
                <div id="species-map" class="w-full rounded-2xl overflow-hidden" style="border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);"></div>
                <script nonce="<?= CspNonce::attr() ?>">
                document.addEventListener('DOMContentLoaded', () => {
                    const locs = <?php echo json_encode($obsLocations); ?>;
                    if (!locs.length) return;
                    const map = new maplibregl.Map({
                        container: 'species-map',
                        style: IKIMON_MAP.style('light'),
                        center: [locs[0].lng, locs[0].lat],
                        zoom: 13, interactive: true, attributionControl: false
                    });
                    map.addControl(new maplibregl.NavigationControl(), 'top-right');
                    if (locs.length > 1) {
                        const b = new maplibregl.LngLatBounds();
                        locs.forEach(l => b.extend([l.lng, l.lat]));
                        map.fitBounds(b, { padding: 40, maxZoom: 15 });
                    }
                    map.on('load', () => {
                        locs.forEach(loc => {
                            const el = document.createElement('div');
                            el.style.cssText = 'width:14px;height:14px;background:#10b981;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(16,185,129,.4);';
                            new maplibregl.Marker({ element: el })
                                .setLngLat([loc.lng, loc.lat])
                                .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(
                                    `<div class="text-token-xs" style="color:#333;"><strong>${loc.observer}</strong><br>${loc.date}</div>`
                                ))
                                .addTo(map);
                        });
                    });
                });
                </script>
            </section>
        <?php endif; ?>

        <!-- ═══ D. CHALLENGES ═══ -->
        <?php if (!empty($challenges)): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="target" class="w-4 h-4 text-accent" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">チャレンジ</h2>
                </div>
                <div class="space-y-2">
                    <?php foreach ($challenges as $ch): ?>
                        <div class="flex items-center gap-3 p-3.5 rounded-xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                            <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:var(--color-accent-surface);">
                                <i data-lucide="<?php echo htmlspecialchars($ch['icon']); ?>" class="w-4 h-4 text-accent" style="pointer-events:none;"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-semibold text-text"><?php echo htmlspecialchars($ch['label']); ?></div>
                                <?php if (isset($ch['progress']) && $ch['progress'] > 0 && $ch['progress'] < 100): ?>
                                    <div class="challenge-bar mt-1.5">
                                        <div class="challenge-fill" style="width:<?php echo $ch['progress']; ?>%;background:var(--color-accent);"></div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- ═══ E. CO-OCCURRENCE ═══ -->
        <?php if (!empty($coSpecies)): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="git-branch" class="w-4 h-4 text-secondary" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">よく一緒に見られる種</h2>
                </div>
                <?php if ($coGroup): ?>
                    <p class="text-sm text-muted mb-3"><?php echo htmlspecialchars($coGroup['name'] ?? ''); ?> — <?php echo htmlspecialchars($coGroup['season'] ?? ''); ?></p>
                <?php endif; ?>
                <div class="flex flex-wrap gap-2">
                    <?php foreach ($coSpecies as $cs): ?>
                        <?php $isFound = in_array($cs, $userFoundSpeciesNames); ?>
                        <a href="/species.php?jp=<?php echo urlencode($cs); ?>"
                           class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition <?php echo $isFound ? 'font-bold' : ''; ?>"
                           style="background:<?php echo $isFound ? 'var(--color-accent-surface)' : 'var(--md-surface-container)'; ?>;border:1px solid <?php echo $isFound ? 'var(--color-accent)' : 'var(--md-outline-variant)'; ?>;color:<?php echo $isFound ? 'var(--color-accent)' : 'var(--md-on-surface)'; ?>;">
                            <?php if ($isFound): ?>
                                <i data-lucide="check" class="w-3 h-3" style="pointer-events:none;"></i>
                            <?php endif; ?>
                            <?php echo htmlspecialchars($cs); ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- ═══ F. CONSERVATION STATUS ═══ -->
        <?php if ($rlResult): ?>
            <section class="space-y-2">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="shield-alert" class="w-4 h-4 text-danger" style="pointer-events:none;"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-danger">CONSERVATION STATUS</h2>
                </div>
                <?php foreach ($rlResult as $listId => $entry): ?>
                    <div class="flex items-center gap-3 p-4 rounded-xl border bg-surface"
                         style="border-color:<?php echo htmlspecialchars($entry['category_color']); ?>30;">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm font-mono"
                             style="background:<?php echo htmlspecialchars($entry['category_color']); ?>18;color:<?php echo htmlspecialchars($entry['category_color']); ?>;">
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

        <!-- ═══ G. AFFILIATE BOOKS ═══ -->
        <?php if (!empty($affiliateBooks)): ?>
            <?php include __DIR__ . '/components/affiliate_books.php'; ?>
        <?php endif; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        document.addEventListener('DOMContentLoaded', () => {
            if (window.lucide) lucide.createIcons();
        });
    </script>
</body>

</html>
