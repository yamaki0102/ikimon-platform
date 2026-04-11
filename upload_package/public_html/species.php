<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/SpeciesNarrative.php';
require_once __DIR__ . '/../libs/AffiliateManager.php';

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

// 1. Fetch Bibliographic Data
$citations = LibraryService::getCitations($taxon);
$keys = LibraryService::searchKeys($taxon);
// Fallback: search by scientific name if Japanese name returned nothing
if (empty($citations) && !empty($scientificName)) {
    $citations = array_merge($citations, LibraryService::getCitations($scientificName));
}

// 2. Fetch Academic Papers (Tier 1)
$papers = LibraryService::getPapersForTaxon($taxon);
if (empty($papers) && !empty($scientificName)) {
    $papers = LibraryService::getPapersForTaxon($scientificName);
}

// 3. Fetch Distilled Knowledge (Phase 2)
$distilledKnowledge = LibraryService::getDistilledKnowledgeForTaxon($scientificName);

// 3.5. Fetch Specimen Records
$specimenRecords = LibraryService::getSpecimenRecords($scientificName);

// 3.6. Fetch BHL/Plazi/Research Network (single index pass, split by source)
$allIndexedPapers = !empty($scientificName) ? LibraryService::getIndexedPapers($scientificName) : [];
$bhlRecords = array_filter($allIndexedPapers, fn($p) => ($p['source'] ?? '') === 'BHL');
usort($bhlRecords, fn($a, $b) => ($a['published_date'] ?? '9999') <=> ($b['published_date'] ?? '9999'));
$bhlRecords = array_values($bhlRecords);
$originalDescription = !empty($bhlRecords) ? $bhlRecords[0] : null;
$plaziTreatments = array_values(array_filter($allIndexedPapers, fn($p) => ($p['source'] ?? '') === 'Plazi'));

$jglobalLinks = !empty($scientificName) ? LibraryService::getJGlobalLinks($scientificName) : [];
$jpInstitutions = !empty($scientificName) ? LibraryService::getJapaneseInstitutions($scientificName) : [];

// 4. Red List Lookup
$rlManager = new RedListManager();
$rlResult = $rlManager->lookup($taxon);

// 5. Gather all observation data for plotting + phenology
$allObs = DataStore::fetchAll('observations');
$obsLocations = [];
$firstPhoto = null;
$monthCounts = array_fill(1, 12, 0); // 1-12 for Jan-Dec
$observationCount = 0;
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
            // Phenology: count by month
            $obsDate = $obs['observed_at'] ?? '';
            if ($obsDate && preg_match('/^\d{4}-(\d{2})/', $obsDate, $m)) {
                $mo = (int)$m[1];
                if ($mo >= 1 && $mo <= 12) $monthCounts[$mo]++;
            }
            // Map locations
            $obsLat = $obs['lat'] ?? ($obs['location']['lat'] ?? null);
            $obsLng = $obs['lng'] ?? ($obs['location']['lng'] ?? null);
            if (!empty($obsLat) && !empty($obsLng)) {
                $obsLocations[] = [
                    'lat' => (float) $obsLat,
                    'lng' => (float) $obsLng,
                    'date' => $obsDate,
                    'observer' => $obs['user_name'] ?? ($obs['user']['name'] ?? '')
                ];
            }
        }
    }
}

// Add specimen collection months to phenology
if (!empty($specimenRecords)) {
    foreach ($specimenRecords as $spec) {
        $sd = $spec['event_date'] ?? '';
        if ($sd && preg_match('/(?:^|-)?(\d{2})(?:-|$)/', $sd, $sm)) {
            // Try YYYY-MM-DD or YYYY-MM format
            if (preg_match('/^\d{4}-(\d{2})/', $sd, $sm2)) {
                $smo = (int)$sm2[1];
                if ($smo >= 1 && $smo <= 12) $monthCounts[$smo]++;
            }
        }
    }
}
$phenologyMax = max($monthCounts);
$hasPhenologyData = $phenologyMax > 0;

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

// --- Taxonomy Timeline Extraction ---
$timelineData = [];

// Process citations
foreach ($citations as $cit) {
    if (!empty($cit['book_year']) && preg_match('/^[0-9]{4}/', $cit['book_year'], $matches)) {
        $nameUsage = $cit['darwin_core']['dwc:originalNameUsage'] ?? $cit['scientific_name'] ?? '';
        if ($nameUsage) {
            $timelineData[] = ['year' => (int)$matches[0], 'name' => $nameUsage];
        }
    }
}

// Process papers
foreach ($papers as $p) {
    if (!empty($p['year']) && preg_match('/^[0-9]{4}/', $p['year'], $matches)) {
        $nameUsage = $p['darwin_core']['dwc:originalNameUsage'] ?? $p['darwin_core']['dwc:scientificName'] ?? $p['link_scientific_name'] ?? '';
        if ($nameUsage) {
            $timelineData[] = ['year' => (int)$matches[0], 'name' => $nameUsage];
        }
    }
}

// Sort by year
usort($timelineData, fn($a, $b) => $a['year'] <=> $b['year']);

// Identify distinct shifts
$distinctTimeline = [];
$lastName = null;
foreach ($timelineData as $entry) {
    $y = $entry['year'];
    $n = $entry['name'];
    // For visual clarity, remove author years temporarily if we just want base name change, but author year might be part of originalNameUsage.
    // It's safer to keep exact string usage differences.
    if ($n !== $lastName) {
        $distinctTimeline[] = [
            'year' => $y,
            'name' => $n,
        ];
        $lastName = $n;
    }
}
$hasHistoricalShift = count($distinctTimeline) > 1;
// --- End Taxonomy Timeline Extraction ---

// Total data count
$dataCount = count($citations) + count($keys) + count($papers);
$speciesNarrative = SpeciesNarrative::build([
    'display_name' => $taxon ?: $scientificName,
    'rank' => $entry['rank'] ?? '',
    'observation_count' => $observationCount,
    'mapped_location_count' => count($obsLocations),
    'month_counts' => $monthCounts,
    'citation_count' => count($citations),
    'paper_count' => count($papers),
    'specimen_count' => count($specimenRecords),
    'has_redlist' => !empty($rlResult),
    'distilled' => $distilledKnowledge,
    'messages' => [
        'intro' => __('species.quick_facts_intro', '最初に、いま分かっていることを短くまとめています。'),
        'note_single' => __('species.quick_facts_note_single', 'このページの要約は、今ある材料だけで組み立てています。記録や文献が増えると内容も育ちます。'),
        'note_multi' => __('species.quick_facts_note_multi', 'この要約は、観察・文献・標本・整理メモのうち、ページ内にある材料だけで組み立てています。'),
        'label_observation' => __('species.quick_facts_observation', '観察から'),
        'label_literature' => __('species.quick_facts_literature', '文献・標本から'),
        'label_distilled' => __('species.quick_facts_distilled', '整理メモから'),
        'label_taxonomy' => __('species.quick_facts_taxonomy', '分類として'),
        'obs_count' => __('species.quick_facts_obs_count', '{count}件の観察があります。'),
        'obs_peak' => __('species.quick_facts_obs_peak', '{months}の記録が目立ちます。'),
        'obs_map' => __('species.quick_facts_obs_map', '地図には{count}地点の記録があります。'),
        'lit_citations' => __('species.quick_facts_lit_citations', '図鑑文献{count}件'),
        'lit_papers' => __('species.quick_facts_lit_papers', '論文{count}件'),
        'lit_specimens' => __('species.quick_facts_lit_specimens', '標本{count}件'),
        'lit_linked' => __('species.quick_facts_lit_linked', '{items}をひも付けています。'),
        'lit_redlist' => __('species.quick_facts_lit_redlist', '保全状況の情報も確認できます。'),
        'distilled_habitat' => __('species.quick_facts_distilled_habitat', '環境の手がかりは {items} です。'),
        'distilled_season' => __('species.quick_facts_distilled_season', '活動期の手がかりは {items} です。'),
        'taxonomy_text' => __('species.quick_facts_taxonomy_text', '{name} は {rank} レベルのまとまりです。このページでは、近い仲間の記録をまとめて見られます。'),
        'month_label' => __('species.quick_facts_month_label', '{month}月'),
        'list_separator' => __('species.quick_facts_list_separator', '・'),
        'item_separator' => __('species.quick_facts_item_separator', '、'),
        'rank_species' => __('zukan.card_summary.rank_species', '種'),
        'rank_genus' => __('zukan.card_summary.rank_genus', '属'),
        'rank_family' => __('zukan.card_summary.rank_family', '科'),
        'rank_order' => __('zukan.card_summary.rank_order', '目'),
        'rank_class' => __('zukan.card_summary.rank_class', '綱'),
        'rank_phylum' => __('zukan.card_summary.rank_phylum', '門'),
        'rank_kingdom' => __('zukan.card_summary.rank_kingdom', '界'),
        'rank_generic' => __('zukan.card_summary.rank_generic', '分類群'),
    ],
]);
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
        $meta_image = publicPhotoUrl($firstPhoto);
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
            $jsonLd['image'] = publicPhotoUrl($firstPhoto);
        }
        // Remove null values
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        ?>
    </script>
    <?php if (!empty($obsLocations)): ?>
        <?php include __DIR__ . '/components/map_config.php'; ?>
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

<body class="font-body min-h-screen" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>

    <!-- Header -->
    <header class="species-header px-5 pb-4 flex items-center justify-between">
        <a href="javascript:history.back()" class="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
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

            <?php if ($firstPhoto): ?>
                <div class="mb-4 overflow-hidden" style="border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);background:var(--md-surface-container);box-shadow:var(--elev-1);">
                    <img src="<?php echo htmlspecialchars(publicPhotoUrl($firstPhoto)); ?>"
                        alt="<?php echo htmlspecialchars($taxon ?: $scientificName); ?>"
                        class="w-full h-56 object-cover">
                </div>
            <?php endif; ?>

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
                <span class="inline-flex items-center gap-1 px-3 py-1.5 text-token-xs font-mono" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                    <i data-lucide="database" class="w-3 h-3"></i>
                    <?php echo $dataCount; ?> records
                </span>
                <?php if (!empty($obsLocations)): ?>
                    <span class="inline-flex items-center gap-1 px-3 py-1.5 text-token-xs font-mono" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                        <i data-lucide="map-pin" class="w-3 h-3"></i>
                        <?php echo count($obsLocations); ?> sightings
                    </span>
                <?php endif; ?>
                <?php if ($gbifKey): ?>
                    <a href="https://www.gbif.org/species/<?php echo urlencode($gbifKey); ?>" target="_blank" rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 px-3 py-1.5 text-token-xs font-mono transition" style="border-radius:var(--shape-full);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
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
                    target="_blank" rel="noopener noreferrer"
                    class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black hover:text-white hover:border-black transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                    title="Xでシェア">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                </a>
                <a href="https://social-plugins.line.me/lineit/share?url=<?php echo urlencode($shareUrl); ?>"
                    target="_blank" rel="noopener noreferrer"
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

        <?php if (!empty($speciesNarrative['blocks'])): ?>
            <section class="space-y-3">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="scroll-text" class="w-4 h-4 text-primary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-primary"><?php echo htmlspecialchars(__('species.quick_facts_title', 'このページでわかること')); ?></h2>
                </div>
                <div style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);" class="space-y-3">
                    <p class="text-sm leading-relaxed text-text-secondary"><?php echo htmlspecialchars($speciesNarrative['intro'] ?? ''); ?></p>
                    <div class="grid gap-3">
                        <?php foreach (($speciesNarrative['blocks'] ?? []) as $block): ?>
                            <div style="border-radius:var(--shape-xl);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);padding:.5rem 1rem;">
                                <div class="flex items-center gap-2 mb-1.5">
                                    <i data-lucide="<?php echo htmlspecialchars($block['icon'] ?? 'info'); ?>" class="w-4 h-4 text-primary"></i>
                                    <div class="text-xs font-bold tracking-wide text-primary"><?php echo htmlspecialchars($block['label'] ?? ''); ?></div>
                                </div>
                                <p class="text-sm leading-relaxed text-text-secondary"><?php echo htmlspecialchars($block['text'] ?? ''); ?></p>
                            </div>
                        <?php endforeach; ?>
                    </div>
                    <div class="text-xs leading-relaxed text-muted"><?php echo htmlspecialchars($speciesNarrative['note'] ?? ''); ?></div>
                </div>
            </section>
        <?php endif; ?>

        <!-- [NEW] Distilled Knowledge (Phase 2) -->
        <?php if (!empty($distilledKnowledge['ecological_constraints']) && (
            !empty($distilledKnowledge['ecological_constraints']['habitat']) ||
            !empty($distilledKnowledge['ecological_constraints']['altitude_range']) ||
            !empty($distilledKnowledge['ecological_constraints']['active_season']) ||
            !empty($distilledKnowledge['ecological_constraints']['notes'])
        )): ?>
            <section class="space-y-3">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="brain-circuit" class="w-4 h-4 text-primary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-primary">DISTILLED KNOWLEDGE</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted bg-primary/10 px-2 py-0.5 rounded-full text-primary border border-primary/20">AI EXTRACTED</span>
                </div>
                <div style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <?php $ec = $distilledKnowledge['ecological_constraints']; ?>

                    <?php if (!empty($ec['habitat'])): ?>
                        <div class="mb-4 last:mb-0">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-2">Habitat Constraints</h3>
                            <div class="flex flex-wrap gap-1.5">
                                <?php foreach ($ec['habitat'] as $hab): ?>
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                                        <i data-lucide="trees" class="w-3.5 h-3.5 text-secondary"></i>
                                        <?php echo htmlspecialchars($hab); ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($ec['altitude_range'])): ?>
                        <div class="mb-4 last:mb-0">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-2">Altitude Range</h3>
                            <div class="flex flex-wrap gap-1.5">
                                <?php foreach ($ec['altitude_range'] as $alt): ?>
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                                        <i data-lucide="mountain" class="w-3.5 h-3.5 text-accent"></i>
                                        <?php echo htmlspecialchars($alt); ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($ec['active_season'])): ?>
                        <div class="mb-4 last:mb-0">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-2">Active Period</h3>
                            <div class="flex flex-wrap gap-2">
                                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold" style="border-radius:var(--shape-sm);background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                                    <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-warning"></i>
                                    <?php echo htmlspecialchars($ec['active_season']); ?>
                                </span>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($ec['notes'])): ?>
                        <div class="mt-4 pt-3 border-t border-border/50">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-2">Ecological Notes</h3>
                            <ul class="space-y-2">
                                <?php foreach ($ec['notes'] as $note): ?>
                                    <li class="text-sm text-text-secondary leading-relaxed flex gap-2">
                                        <i data-lucide="info" class="w-4 h-4 text-muted shrink-0 mt-0.5"></i>
                                        <span><?php echo htmlspecialchars($note); ?></span>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- [NEW] Identification Keys (Phase 5) -->
        <?php if (!empty($distilledKnowledge['identification_keys']) && (
            !empty($distilledKnowledge['identification_keys']['morphological_traits']) ||
            !empty($distilledKnowledge['identification_keys']['similar_species']) ||
            !empty($distilledKnowledge['identification_keys']['key_differences'])
        )): ?>
            <section class="space-y-3">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="text-search" class="w-4 h-4 text-accent"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">IDENTIFICATION KEYS</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted bg-accent/10 px-2 py-0.5 rounded-full text-accent border border-accent/20">AI EXTRACTED</span>
                </div>
                <div style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <?php $ik = $distilledKnowledge['identification_keys']; ?>

                    <?php if (!empty($ik['morphological_traits'])): ?>
                        <div class="mb-5 last:mb-0">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <i data-lucide="microscope" class="w-3.5 h-3.5"></i> Morphological Traits
                            </h3>
                            <ul class="space-y-2">
                                <?php foreach ($ik['morphological_traits'] as $trait): ?>
                                    <li class="pl-4 relative text-sm text-text-secondary leading-relaxed">
                                        <span class="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-accent/40"></span>
                                        <?php echo htmlspecialchars($trait); ?>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($ik['similar_species'])): ?>
                        <div class="mb-5 last:mb-0">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Similar Species
                            </h3>
                            <div class="flex flex-wrap gap-2">
                                <?php foreach ($ik['similar_species'] as $similar): ?>
                                    <div class="inline-flex items-center gap-0 rounded-lg border border-accent/20 overflow-hidden shadow-sm">
                                        <a href="/species.php?jp=<?php echo urlencode($similar); ?>" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-white transition" style="background:var(--md-surface-container-low);">
                                            <i data-lucide="link-2" class="w-3.5 h-3.5"></i>
                                            <?php echo htmlspecialchars($similar); ?>
                                        </a>
                                        <a href="compare.php?a=<?php echo urlencode($taxon); ?>&b=<?php echo urlencode($similar); ?>"
                                            class="inline-flex items-center gap-1 px-2 py-1.5 bg-accent/10 text-xs font-bold text-accent hover:bg-accent hover:text-white transition border-l border-accent/20"
                                            title="Compare with <?php echo htmlspecialchars($similar); ?>">
                                            <i data-lucide="git-compare" class="w-3 h-3"></i>
                                        </a>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($ik['key_differences'])): ?>
                        <div class="mt-4 pt-4 border-t border-border/50">
                            <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <i data-lucide="split" class="w-3.5 h-3.5"></i> Key Differences
                            </h3>
                            <ul class="space-y-2">
                                <?php foreach ($ik['key_differences'] as $diff): ?>
                                    <li class="pl-4 relative text-sm text-text-secondary leading-relaxed">
                                        <span class="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-warning/40"></span>
                                        <?php echo htmlspecialchars($diff); ?>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- いきもの知恵袋 — Species Claims (OmoikaneDB) -->
        <?php $claimsApiParam = $scientific_name ? ('scientific_name=' . urlencode($scientific_name)) : ($taxon ? ('japanese_name=' . urlencode($taxon)) : ''); ?>
        <?php if ($claimsApiParam): ?>
        <div x-data="speciesClaimsSection('<?php echo htmlspecialchars($claimsApiParam, ENT_QUOTES); ?>')"
             x-init="load()" x-cloak>
            <template x-if="groups.length > 0">
                <section class="space-y-3">
                    <div class="flex items-center gap-2 mb-2">
                        <i data-lucide="book-open-text" class="w-4 h-4 text-secondary"></i>
                        <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">いきもの知恵袋</h2>
                        <span class="ml-auto text-token-xs font-mono text-muted bg-secondary/10 px-2 py-0.5 rounded-full text-secondary border border-secondary/20"
                              x-text="totalClaims + ' INSIGHTS'"></span>
                    </div>
                    <div style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);" class="space-y-5">
                        <template x-for="group in groups" :key="group.type">
                            <div>
                                <h3 class="text-xs font-bold text-muted-dark uppercase tracking-wider mb-3 flex items-center gap-1.5"
                                    :class="headingClass(group.type)">
                                    <span x-text="groupIcon(group.type)"></span>
                                    <span x-text="group.label"></span>
                                    <span class="font-normal normal-case ml-auto text-[10px]"
                                          :class="group.claims[0].source_tier === 'A' ? 'text-green-600' : 'text-amber-500'"
                                          x-text="group.claims[0].source_tier === 'A' ? '査読済' : '百科事典'"></span>
                                </h3>
                                <ul class="space-y-2">
                                    <template x-for="(claim, ci) in group.claims" :key="ci">
                                        <li class="flex items-start gap-2 text-sm text-text-secondary leading-relaxed">
                                            <span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                  :class="claim.source_tier === 'A' ? 'bg-green-400' : 'bg-amber-400'"></span>
                                            <span x-text="claim.text"></span>
                                        </li>
                                    </template>
                                </ul>
                            </div>
                        </template>
                        <p class="text-[10px] text-muted pt-2 border-t border-border/40">
                            <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-0.5 align-middle"></span>査読済文献
                            <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5 ml-2 align-middle"></span>百科事典・GBIF
                            — Omoikane Knowledge Graph
                        </p>
                    </div>
                </section>
            </template>
        </div>
        <?php endif; ?>

        <!-- Phenology Bar (Month Activity) -->
        <?php if ($hasPhenologyData): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="calendar-range" class="w-4 h-4 text-warning"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-warning">PHENOLOGY</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo array_sum($monthCounts); ?> records</span>
                </div>
                <div style="padding:1rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <div class="flex items-end gap-1 h-16">
                        <?php
                        $monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        $currentMonth = (int)date('n');
                        for ($i = 1; $i <= 12; $i++):
                            $count = $monthCounts[$i];
                            $pct = $phenologyMax > 0 ? ($count / $phenologyMax) * 100 : 0;
                            $minH = $count > 0 ? 12 : 4; // minimum bar height
                            $barH = max($minH, $pct * 0.56); // scale to fit 56px max
                            $opacity = $count > 0 ? max(0.3, $pct / 100) : 0.08;
                            $isCurrent = ($i === $currentMonth);
                        ?>
                            <div class="flex-1 flex flex-col items-center gap-1 group" title="<?php echo $monthLabels[$i - 1] . ': ' . $count . ' record' . ($count !== 1 ? 's' : ''); ?>">
                                <div class="w-full rounded-sm transition-all duration-300 group-hover:opacity-100 <?php echo $isCurrent ? 'ring-1 ring-warning/50' : ''; ?>"
                                    style="height: <?php echo $barH; ?>px; background: <?php echo $count > 0 ? 'var(--color-warning)' : 'var(--color-border)'; ?>; opacity: <?php echo $opacity; ?>;"></div>
                                <span class="text-[9px] font-mono <?php echo $isCurrent ? 'font-bold text-warning' : 'text-muted'; ?>"><?php echo $monthLabels[$i - 1]; ?></span>
                            </div>
                        <?php endfor; ?>
                    </div>
                    <?php if ($currentMonth): ?>
                        <div class="mt-2 text-center text-token-xs text-muted">
                            <?php
                            $curCount = $monthCounts[$currentMonth];
                            if ($curCount > 0) {
                                echo '<span class="text-warning font-bold">' . $monthLabels[$currentMonth - 1] . '</span> — ' . $curCount . ' record' . ($curCount !== 1 ? 's' : '') . ' this month';
                            } else {
                                // Find nearest active month
                                $nearest = null;
                                for ($d = 1; $d <= 6; $d++) {
                                    $ahead = (($currentMonth - 1 + $d) % 12) + 1;
                                    if ($monthCounts[$ahead] > 0) {
                                        $nearest = $ahead;
                                        break;
                                    }
                                }
                                if ($nearest) {
                                    echo 'Next active: <span class="text-warning font-bold">' . $monthLabels[$nearest - 1] . '</span>';
                                } else {
                                    echo 'No seasonal pattern detected yet';
                                }
                            }
                            ?>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
        <?php endif; ?>

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

        <!-- Museum Specimen Records -->
        <?php if (!empty($specimenRecords)): ?>
            <section class="space-y-2">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="archive" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">MUSEUM SPECIMENS</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($specimenRecords); ?> records</span>
                </div>
                <div class="space-y-2">
                    <?php foreach ($specimenRecords as $spec): ?>
                        <a href="https://www.gbif.org/occurrence/<?php echo urlencode($spec['gbif_occurrence_key']); ?>" target="_blank" rel="noopener noreferrer"
                            class="block p-4 rounded-xl border border-secondary/20 hover:border-secondary/40 transition group" style="background:var(--md-surface-container-low);">
                            <div class="flex items-start gap-3">
                                <div class="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i data-lucide="landmark" class="w-4 h-4 text-secondary"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-bold text-text leading-snug">
                                        <?php echo htmlspecialchars($spec['institution_code'] ?: 'Unknown Institution'); ?>
                                        <?php if (!empty($spec['catalog_number'])): ?>
                                            <span class="font-mono text-xs text-muted ml-1">#<?php echo htmlspecialchars($spec['catalog_number']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                        <?php if (!empty($spec['country'])): ?>
                                            <span class="inline-flex items-center gap-1 text-token-xs text-muted">
                                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                                <?php echo htmlspecialchars($spec['country']); ?>
                                                <?php if (!empty($spec['locality'])): ?>
                                                    · <?php echo htmlspecialchars(mb_strimwidth($spec['locality'], 0, 40, '…')); ?>
                                                <?php endif; ?>
                                            </span>
                                        <?php endif; ?>
                                        <?php if (!empty($spec['event_date'])): ?>
                                            <span class="inline-flex items-center gap-1 text-token-xs text-muted font-mono">
                                                <i data-lucide="calendar" class="w-3 h-3"></i>
                                                <?php echo htmlspecialchars($spec['event_date']); ?>
                                            </span>
                                        <?php endif; ?>
                                        <?php if (!empty($spec['recorded_by'])): ?>
                                            <span class="inline-flex items-center gap-1 text-token-xs text-muted">
                                                <i data-lucide="user" class="w-3 h-3"></i>
                                                <?php echo htmlspecialchars(mb_strimwidth($spec['recorded_by'], 0, 30, '…')); ?>
                                            </span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                                <i data-lucide="external-link" class="w-3.5 h-3.5 text-faint group-hover:text-secondary transition flex-shrink-0 mt-1"></i>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- 3. Observation + Specimen Map -->
        <?php
        // Build specimen location array for map overlay
        $specimenLocations = [];
        if (!empty($specimenRecords)) {
            foreach ($specimenRecords as $spec) {
                if (!empty($spec['decimal_latitude']) && !empty($spec['decimal_longitude'])) {
                    $specimenLocations[] = [
                        'lat' => (float)$spec['decimal_latitude'],
                        'lng' => (float)$spec['decimal_longitude'],
                        'institution' => $spec['institution_code'] ?: 'Unknown',
                        'catalog' => $spec['catalog_number'] ?? '',
                        'date' => $spec['event_date'] ?? '',
                        'country' => $spec['country'] ?? '',
                        'gbif_key' => $spec['gbif_occurrence_key'] ?? '',
                    ];
                }
            }
        }
        ?>
        <?php if (!empty($obsLocations) || !empty($specimenLocations)): ?>
            <section>
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="map" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">SIGHTINGS</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($obsLocations) + count($specimenLocations); ?> records</span>
                </div>
                <!-- Legend -->
                <div class="flex items-center gap-4 mb-2 text-token-xs text-muted">
                    <?php if (!empty($obsLocations)): ?>
                        <span class="inline-flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white shadow-sm"></span>
                            観察 (<?php echo count($obsLocations); ?>)
                        </span>
                    <?php endif; ?>
                    <?php if (!empty($specimenLocations)): ?>
                        <span class="inline-flex items-center gap-1.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-white shadow-sm"></span>
                            標本 (<?php echo count($specimenLocations); ?>)
                        </span>
                    <?php endif; ?>
                </div>
                <div id="species-map" class="w-full rounded-2xl overflow-hidden" style="border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);"></div>
                <script nonce="<?= CspNonce::attr() ?>">
                    document.addEventListener('DOMContentLoaded', () => {
                        const obsLocs = <?php echo json_encode($obsLocations); ?>;
                        const specLocs = <?php echo json_encode($specimenLocations); ?>;
                        const allPts = [...obsLocs, ...specLocs];
                        if (!allPts.length) return;

                        const map = new maplibregl.Map({
                            container: 'species-map',
                            style: IKIMON_MAP.style('light'),
                            center: [allPts[0].lng, allPts[0].lat],
                            zoom: 13,
                            interactive: true,
                            attributionControl: false
                        });
                        map.addControl(new maplibregl.NavigationControl(), 'top-right');

                        if (allPts.length > 1) {
                            const b = new maplibregl.LngLatBounds();
                            allPts.forEach(l => b.extend([l.lng, l.lat]));
                            map.fitBounds(b, {
                                padding: 40,
                                maxZoom: 15
                            });
                        }

                        map.on('load', () => {
                            // Green pins: observations
                            obsLocs.forEach(loc => {
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

                            // Orange pins: specimens
                            specLocs.forEach(spec => {
                                const el = document.createElement('div');
                                el.style.cssText = 'width:12px;height:12px;background:#f59e0b;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(245,158,11,.4);';
                                const catalogLabel = spec.catalog ? ` #${spec.catalog}` : '';
                                const dateLabel = spec.date || '日付不明';
                                const countryLabel = spec.country ? `<br>${spec.country}` : '';
                                const gbifLink = spec.gbif_key ? `<br><a href="https://www.gbif.org/occurrence/${spec.gbif_key}" target="_blank" rel="noopener noreferrer" style="color:#f59e0b;text-decoration:underline;font-size:10px;">GBIF →</a>` : '';
                                new maplibregl.Marker({
                                        element: el
                                    })
                                    .setLngLat([spec.lng, spec.lat])
                                    .setPopup(new maplibregl.Popup({
                                        offset: 12
                                    }).setHTML(
                                        `<div class="text-token-xs" style="color:#333;"><strong>🏛️ ${spec.institution}${catalogLabel}</strong><br>${dateLabel}${countryLabel}${gbifLink}</div>`
                                    ))
                                    .addTo(map);
                            });
                        });
                    });
                </script>
            </section>
        <?php endif; ?>

        <!-- Nomenclature Timeline -->
        <?php if ($hasHistoricalShift): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="history" class="w-4 h-4 text-primary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-primary">NOMENCLATURE TIMELINE</h2>
                </div>
                <div class="mb-6 relative overflow-hidden" style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <div class="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div class="relative pl-5 space-y-6 border-l-2 border-primary/20">
                        <?php foreach ($distinctTimeline as $idx => $tItem): ?>
                            <div class="relative">
                                <div class="absolute -left-[26px] top-1.5 w-[10px] h-[10px] rounded-full <?php echo ($idx === count($distinctTimeline) - 1) ? 'bg-primary shadow-[0_0_8px_rgba(0,0,0,0.2)] dark:shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'bg-surface border-2 border-primary/40'; ?>"></div>
                                <div class="text-[11px] font-bold font-mono text-muted-dark mb-0.5 leading-none"><?php echo $tItem['year']; ?></div>
                                <div class="text-sm font-semibold <?php echo ($tItem['name'] === $scientificName) ? 'text-primary' : 'text-text'; ?>"><?php echo htmlspecialchars($tItem['name']); ?></div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </section>
        <?php endif; ?>

        <!-- 4. Bibliographic DNA -->
        <section x-data="{ showAllBib: false }">
            <div class="flex items-center gap-2 mb-3">
                <i data-lucide="book-open" class="w-4 h-4 text-accent"></i>
                <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">BIBLIOGRAPHIC DNA</h2>
                <?php $totalBib = count($citations) + count($keys);
                if ($totalBib > 0): ?>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo $totalBib; ?> refs</span>
                <?php endif; ?>
            </div>

            <div class="space-y-3">
                <?php if (empty($citations) && empty($keys)): ?>
                    <div style="padding:1.5rem;border-radius:var(--shape-xl);text-align:center;background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                        <p class="text-sm text-muted">No digitized references found yet.</p>
                    </div>
                <?php endif; ?>

                <?php foreach ($citations as $cidx => $cit): ?>
                    <?php if ($cidx === 3 && count($citations) > 3): ?>
                        <button @click="showAllBib = !showAllBib"
                            class="w-full py-2.5 rounded-xl border border-dashed border-warning/30 text-sm font-semibold text-warning hover:bg-warning/5 transition flex items-center justify-center gap-2"
                            x-show="!showAllBib">
                            <i data-lucide="chevron-down" class="w-4 h-4"></i>
                            +<?php echo count($citations) - 3; ?> more citations
                        </button>
                    <?php endif; ?>
                    <?php if ($cidx >= 3): ?><div x-show="showAllBib" x-cloak><?php endif; ?>
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

                                        <?php if (!empty($cit['darwin_core']['dwc:originalNameUsage']) && $cit['darwin_core']['dwc:originalNameUsage'] !== $cit['scientific_name'] && $cit['darwin_core']['dwc:originalNameUsage'] !== $cit['taxon_name']): ?>
                                            <br>
                                            <span class="text-[10px] text-muted-dark" title="Name exactly as it appeared in the historical text">
                                                (Text verbatim: <span class="italic"><?php echo htmlspecialchars($cit['darwin_core']['dwc:originalNameUsage']); ?></span>)
                                            </span>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>

                            <?php if (!empty($cit['data_icons'])): ?>
                                <div class="flex flex-wrap gap-1.5 pl-11">
                                    <?php if (!empty($cit['data_icons']['size'])): ?>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs" style="background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                            <i data-lucide="ruler" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($cit['data_icons']['size']); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if (!empty($cit['data_icons']['season'])): ?>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs" style="background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                            <i data-lucide="calendar" class="w-2.5 h-2.5"></i> <?php echo htmlspecialchars($cit['data_icons']['season']); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if (!empty($cit['data_icons']['distribution'])): ?>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-token-xs" style="background:var(--md-surface-container-low);color:var(--md-on-surface-variant);border:1px solid var(--md-outline-variant);">
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
                                <div class="pl-11 mt-2">
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 border border-secondary/20 text-token-xs text-secondary">
                                        <i data-lucide="git-merge" class="w-2.5 h-2.5"></i> 現在は <?php echo htmlspecialchars($cit['gbif_accepted_name'] ?? ''); ?> に統合する見解もあります
                                    </span>
                                </div>
                            <?php endif; ?>

                            <!-- Darwin Core / Metadata Display -->
                            <?php if (!empty($cit['darwin_core']) || !empty($cit['dublin_core'])): ?>
                                <div class="mt-3 ml-11 flex flex-wrap gap-1.5 pt-2 border-t border-warning/20">
                                    <?php if (!empty($cit['dublin_core']['dc:type'])): ?>
                                        <span class="text-[10px] px-1.5 py-0.5 rounded-sm text-muted font-mono" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);" title="Dublin Core Document Type">
                                            DC: <?php echo htmlspecialchars($cit['dublin_core']['dc:type']); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if (!empty($cit['darwin_core']['dwc:taxonConceptID'])): ?>
                                        <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent/10 border border-accent/20 text-accent font-mono" title="Darwin Core Taxon Concept ID">
                                            DwC: <?php echo htmlspecialchars(str_replace('gbif:', 'GBIF ', $cit['darwin_core']['dwc:taxonConceptID'])); ?>
                                        </span>
                                    <?php endif; ?>
                                    <?php if (!empty($cit['darwin_core']['dwc:scientificName'])): ?>
                                        <span class="text-[10px] px-1.5 py-0.5 rounded-sm text-muted font-mono" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);" title="Darwin Core Scientific Name">
                                            DwC: <?php echo htmlspecialchars($cit['darwin_core']['dwc:scientificName']); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                        <?php if ($cidx >= 3): ?>
                        </div><?php endif; ?>
                <?php endforeach; ?>
                <?php if (count($citations) > 3): ?>
                    <button @click="showAllBib = false"
                        class="w-full py-2.5 rounded-xl border border-dashed border-warning/30 text-sm font-semibold text-warning hover:bg-warning/5 transition flex items-center justify-center gap-2"
                        x-show="showAllBib" x-cloak>
                        <i data-lucide="chevron-up" class="w-4 h-4"></i>
                        Show less
                    </button>
                <?php endif; ?>

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

        <!-- 4.5. Historical Reference (BHL) -->
        <?php if ($originalDescription): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="scroll-text" class="w-4 h-4 text-warning"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-warning">HISTORICAL REFERENCE</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);padding:2px 8px;border-radius:9999px;">BHL</span>
                </div>
                <a href="<?php echo htmlspecialchars($originalDescription['link'] ?? $originalDescription['bhl_page_url'] ?? '#'); ?>"
                    target="_blank" rel="noopener noreferrer"
                    class="block group" style="padding:1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background:linear-gradient(135deg, rgba(var(--md-warning-rgb, 183,134,11), 0.12), rgba(var(--md-warning-rgb, 183,134,11), 0.04));">
                            <span class="text-2xl" style="pointer-events:none;">&#128220;</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-semibold leading-snug text-text line-clamp-2 group-hover:text-warning transition">
                                <?php echo htmlspecialchars($originalDescription['title'] ?? ''); ?>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                <?php if (!empty($originalDescription['published_date'])): ?>
                                    <span class="text-token-xs font-mono font-bold text-warning"><?php echo htmlspecialchars($originalDescription['published_date']); ?></span>
                                <?php endif; ?>
                                <?php if (!empty($originalDescription['author'])): ?>
                                    <span class="text-token-xs text-muted truncate"><?php echo htmlspecialchars($originalDescription['author']); ?></span>
                                <?php endif; ?>
                            </div>
                            <?php if (!empty($originalDescription['abstract'])): ?>
                                <div class="text-xs text-muted mt-1.5 line-clamp-1"><?php echo htmlspecialchars($originalDescription['abstract']); ?></div>
                            <?php endif; ?>
                            <div class="flex items-center gap-1.5 mt-2 text-xs font-semibold text-warning opacity-70 group-hover:opacity-100 transition">
                                <?php if (!empty($originalDescription['bhl_page_url'])): ?>
                                    <i data-lucide="image" class="w-3.5 h-3.5" style="pointer-events:none;"></i>
                                    View scanned page
                                <?php else: ?>
                                    <i data-lucide="external-link" class="w-3.5 h-3.5" style="pointer-events:none;"></i>
                                    View on BHL
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </a>
                <?php if (count($bhlRecords) > 1): ?>
                    <div class="mt-2 text-xs text-muted text-center">
                        +<?php echo count($bhlRecords) - 1; ?> more historical references on BHL
                    </div>
                <?php endif; ?>
            </section>
        <?php endif; ?>

        <!-- 4.6. Taxonomic Treatment (Plazi) -->
        <?php if (!empty($plaziTreatments)): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="dna" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">TAXONOMIC TREATMENT</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);padding:2px 8px;border-radius:9999px;">Plazi</span>
                </div>
                <div class="space-y-2">
                    <?php foreach (array_slice($plaziTreatments, 0, 3) as $treatment): ?>
                        <a href="<?php echo htmlspecialchars($treatment['link'] ?? $treatment['plazi_uri'] ?? '#'); ?>"
                            target="_blank" rel="noopener noreferrer"
                            class="block p-4 rounded-xl border hover:border-secondary/40 transition group" style="background:var(--md-surface-container);border-color:var(--md-outline-variant);">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i data-lucide="book-open-check" class="w-4 h-4 text-secondary" style="pointer-events:none;"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-semibold leading-snug text-text line-clamp-2">
                                        <?php echo htmlspecialchars($treatment['title'] ?? ''); ?>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 mt-1.5">
                                        <?php if (!empty($treatment['author'])): ?>
                                            <span class="text-token-xs text-muted"><?php echo htmlspecialchars($treatment['author']); ?></span>
                                        <?php endif; ?>
                                        <?php if (!empty($treatment['published_date'])): ?>
                                            <span class="text-token-xs font-mono font-bold text-secondary"><?php echo htmlspecialchars($treatment['published_date']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <?php if (!empty($treatment['abstract'])): ?>
                                        <div class="flex flex-wrap gap-1.5 mt-2">
                                            <?php foreach (explode(' — ', $treatment['abstract']) as $tag): ?>
                                                <?php $trimmedTag = trim($tag); if ($trimmedTag && stripos($trimmedTag, 'LSID:') !== 0): ?>
                                                    <span class="text-[10px] px-2 py-0.5 rounded-sm font-mono text-muted" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                                                        <?php echo htmlspecialchars($trimmedTag); ?>
                                                    </span>
                                                <?php endif; ?>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                    <?php if (!empty($treatment['treatment_lsid'])): ?>
                                        <div class="text-[10px] font-mono text-muted mt-1.5 truncate">
                                            LSID: <?php echo htmlspecialchars($treatment['treatment_lsid']); ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endif; ?>

        <!-- 5. Academic References -->
        <?php if (!empty($papers)): ?>
            <section x-data="{ showAll: false }">
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="flask-conical" class="w-4 h-4 text-secondary"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">ACADEMIC REFERENCES</h2>
                    <span class="ml-auto text-token-xs font-mono text-muted"><?php echo count($papers); ?> papers</span>
                </div>
                <div class="space-y-2">
                    <?php foreach ($papers as $pidx => $paper): ?>
                        <?php if ($pidx === 2 && count($papers) > 2): ?>
                            <button @click="showAll = !showAll"
                                class="w-full py-2.5 rounded-xl border border-dashed border-secondary/30 text-sm font-semibold text-secondary hover:bg-secondary/5 transition flex items-center justify-center gap-2"
                                x-show="!showAll">
                                <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                +<?php echo count($papers) - 2; ?> more papers
                            </button>
                        <?php endif; ?>
                        <template x-if="<?php echo $pidx < 2 ? 'true' : 'showAll'; ?>">
                            <a href="<?php echo htmlspecialchars($paper['url'] ?? '#'); ?>" target="_blank" rel="noopener noreferrer"
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
                                            <?php if (!empty($paper['darwin_core']['dwc:originalNameUsage']) && $paper['darwin_core']['dwc:originalNameUsage'] !== $paper['darwin_core']['dwc:scientificName']): ?>
                                                <span class="text-token-xs text-muted-dark" title="Historical name used in this paper">
                                                    (Referred to as: <span class="italic"><?php echo htmlspecialchars($paper['darwin_core']['dwc:originalNameUsage']); ?></span>)
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                        <?php if (!empty($paper['doi'])): ?>
                                            <div class="flex items-center gap-1.5 mt-1">
                                                <span class="text-token-xs font-mono text-muted">DOI: <?php echo htmlspecialchars($paper['doi']); ?></span>
                                                <i data-lucide="external-link" class="w-3 h-3 transition text-faint"></i>
                                            </div>
                                        <?php endif; ?>

                                        <!-- Darwin Core / Metadata Display -->
                                        <?php if (!empty($paper['darwin_core']) || !empty($paper['dublin_core'])): ?>
                                            <div class="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
                                                <?php if (!empty($paper['dublin_core']['dc:type'])): ?>
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded-sm text-muted font-mono" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);" title="Dublin Core Document Type">
                                                        DC: <?php echo htmlspecialchars($paper['dublin_core']['dc:type']); ?>
                                                    </span>
                                                <?php endif; ?>
                                                <?php if (!empty($paper['darwin_core']['dwc:taxonConceptID'])): ?>
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent/10 border border-accent/20 text-accent font-mono" title="Darwin Core Taxon Concept ID">
                                                        DwC: <?php echo htmlspecialchars(str_replace('gbif:', 'GBIF ', $paper['darwin_core']['dwc:taxonConceptID'])); ?>
                                                    </span>
                                                <?php endif; ?>
                                                <?php if (!empty($paper['darwin_core']['dwc:scientificName'])): ?>
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded-sm text-muted font-mono" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);" title="Darwin Core Scientific Name">
                                                        DwC: <?php echo htmlspecialchars($paper['darwin_core']['dwc:scientificName']); ?>
                                                    </span>
                                                <?php endif; ?>
                                            </div>
                                        <?php endif; ?>

                                    </div>
                                </div>
                            </a>
                        </template>
                    <?php endforeach; ?>
                    <button @click="showAll = false"
                        class="w-full py-2.5 rounded-xl border border-dashed border-secondary/30 text-sm font-semibold text-secondary hover:bg-secondary/5 transition flex items-center justify-center gap-2"
                        x-show="showAll" x-cloak>
                        <i data-lucide="chevron-up" class="w-4 h-4"></i>
                        Show less
                    </button>
                </div>
            </section>
        <?php endif; ?>

        <!-- 5.5. Research Network -->
        <?php if (!empty($jglobalLinks) || !empty($jpInstitutions)): ?>
            <section>
                <div class="flex items-center gap-2 mb-3">
                    <i data-lucide="users" class="w-4 h-4 text-accent"></i>
                    <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">RESEARCH NETWORK</h2>
                </div>
                <div style="padding:1rem 1.25rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                    <?php if (!empty($jglobalLinks)): ?>
                        <div class="flex flex-wrap gap-2 mb-3">
                            <?php if (!empty($jglobalLinks['jglobal_article_url'])): ?>
                                <a href="<?php echo htmlspecialchars($jglobalLinks['jglobal_article_url']); ?>"
                                    target="_blank" rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-accent/20 text-accent hover:bg-accent hover:text-white transition">
                                    <i data-lucide="file-search" class="w-3.5 h-3.5" style="pointer-events:none;"></i>
                                    J-GLOBAL で論文を探す
                                </a>
                            <?php endif; ?>
                            <?php if (!empty($jglobalLinks['jglobal_researcher_url'])): ?>
                                <a href="<?php echo htmlspecialchars($jglobalLinks['jglobal_researcher_url']); ?>"
                                    target="_blank" rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-accent/20 text-accent hover:bg-accent hover:text-white transition">
                                    <i data-lucide="user-search" class="w-3.5 h-3.5" style="pointer-events:none;"></i>
                                    J-GLOBAL で研究者を探す
                                </a>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($jpInstitutions)): ?>
                        <div>
                            <span class="text-[10px] font-bold text-muted-dark uppercase tracking-wider">Japanese Institutions</span>
                            <div class="flex flex-wrap gap-1.5 mt-1.5">
                                <?php foreach (array_slice($jpInstitutions, 0, 8) as $inst): ?>
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface-variant);">
                                        <i data-lucide="building-2" class="w-3 h-3" style="pointer-events:none;"></i>
                                        <?php echo htmlspecialchars($inst); ?>
                                    </span>
                                <?php endforeach; ?>
                                <?php if (count($jpInstitutions) > 8): ?>
                                    <span class="text-xs text-muted px-2 py-1">+<?php echo count($jpInstitutions) - 8; ?> more</span>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
        <?php endif; ?>

        <?php
        // ── Affiliate Books ──
        $taxonForAffiliate = [
            'slug'            => $currentSlug ?? '',
            'scientific_name' => $scientificName ?? '',
            'lineage'         => [],
            'gbif_key'        => $gbifKey ?? null,
        ];
        $affiliateContext = 'encyclopedia';
        $affiliateBooks = AffiliateManager::getBooks($taxonForAffiliate, $affiliateContext);
        if (!empty($affiliateBooks)):
        ?>
            <?php include __DIR__ . '/components/affiliate_books.php'; ?>
        <?php endif; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        // Activate Lucide icons
        document.addEventListener('DOMContentLoaded', () => {
            if (window.lucide) lucide.createIcons();
        });
    </script>
    <script nonce="<?= CspNonce::attr() ?>">
    function speciesClaimsSection(apiParam) {
        return {
            groups: [],
            totalClaims: 0,
            load() {
                fetch('/api/v2/species_claims.php?' + apiParam)
                    .then(r => r.json())
                    .then(data => {
                        if (!data.success) return;
                        const show = ['identification_pitfall','photo_target','hybridization','ecology_trivia','cultural','taxonomy_note','regional_variation'];
                        this.groups = (data.groups || []).filter(g => show.includes(g.type));
                        this.totalClaims = this.groups.reduce((s, g) => s + g.claims.length, 0);
                        this.$nextTick(() => { if (window.lucide) lucide.createIcons(); });
                    })
                    .catch(() => {});
            },
            groupIcon(type) {
                const m = {
                    identification_pitfall: '⚠️', photo_target: '📷', hybridization: '🧬',
                    ecology_trivia: '🌿', cultural: '🎭', taxonomy_note: '📝', regional_variation: '🗺️'
                };
                return m[type] || '💡';
            },
            headingClass(type) {
                const m = {
                    identification_pitfall: 'text-red-600', photo_target: 'text-blue-600',
                    hybridization: 'text-orange-600', ecology_trivia: 'text-green-700',
                    cultural: 'text-purple-600', taxonomy_note: 'text-indigo-600', regional_variation: 'text-teal-600'
                };
                return m[type] || 'text-muted-dark';
            }
        };
    }
    </script>
</body>

</html>
