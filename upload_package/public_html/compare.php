<?php

/**
 * Species Comparison View
 * Side-by-side comparison of two species using Omoikane + observation data.
 *
 * URL: /compare.php?a=ナミアゲハ&b=キアゲハ
 *      /compare.php?a=oryzias-latipes&b=oryzias-sakaizumii
 *
 * @since 2026-02-23
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Services/LibraryService.php';
require_once __DIR__ . '/../libs/RedListManager.php';
require_once __DIR__ . '/../libs/DataStore.php';

Auth::init();

// --- Resolve two species ---
$resolverFile = DATA_DIR . '/taxon_resolver.json';
$resolver = file_exists($resolverFile) ? json_decode(file_get_contents($resolverFile), true) : null;
$taxa = $resolver['taxa'] ?? [];
$jpIndex = $resolver['jp_index'] ?? [];

function resolveSpecies($input, $taxa, $jpIndex)
{
    if (!$input) return null;
    $input = trim($input);

    // Try slug
    $slug = strtolower(preg_replace('/[^a-z0-9\-]/i', '', preg_replace('/\s+/', '-', $input)));
    if (isset($taxa[$slug])) {
        $entry = $taxa[$slug];
        return [
            'ja_name' => $entry['ja_name'] ?? $input,
            'scientific_name' => $entry['scientific_name'] ?? null,
            'slug' => $slug,
        ];
    }

    // Try Japanese name index
    if (isset($jpIndex[$input])) {
        $slug = $jpIndex[$input];
        $entry = $taxa[$slug] ?? [];
        return [
            'ja_name' => $input,
            'scientific_name' => $entry['scientific_name'] ?? null,
            'slug' => $slug,
        ];
    }

    // Fallback: use as-is
    return [
        'ja_name' => $input,
        'scientific_name' => null,
        'slug' => null,
    ];
}

$speciesA = resolveSpecies($_GET['a'] ?? null, $taxa, $jpIndex);
$speciesB = resolveSpecies($_GET['b'] ?? null, $taxa, $jpIndex);

// Load data for each species
function loadSpeciesData($species)
{
    if (!$species) return null;

    $name = $species['ja_name'];
    $sciName = $species['scientific_name'];

    // Observations
    $allObs = DataStore::fetchAll('observations');
    $obsCount = 0;
    $monthCounts = array_fill(1, 12, 0);
    $firstPhoto = null;
    if ($allObs) {
        foreach ($allObs as $obs) {
            $obsName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? '');
            if ($obsName === $name) {
                $obsCount++;
                $date = $obs['observed_at'] ?? '';
                if ($date && preg_match('/^\d{4}-(\d{2})/', $date, $m)) {
                    $mo = (int)$m[1];
                    if ($mo >= 1 && $mo <= 12) $monthCounts[$mo]++;
                }
                if (!$firstPhoto && !empty($obs['photos'][0])) {
                    $firstPhoto = $obs['photos'][0];
                }
            }
        }
    }

    // Omoikane knowledge
    $knowledge = LibraryService::getDistilledKnowledgeForTaxon($sciName);
    $ec = $knowledge['ecological_constraints'] ?? [];
    $ik = $knowledge['identification_keys'] ?? [];

    // Specimens
    $specimens = LibraryService::getSpecimenRecords($sciName);

    // Red List
    $rlManager = new RedListManager();
    $rl = $rlManager->lookup($name);

    // Citations
    $citations = LibraryService::getCitations($name);
    if (empty($citations) && $sciName) {
        $citations = LibraryService::getCitations($sciName);
    }

    return [
        'name' => $name,
        'scientific_name' => $sciName,
        'slug' => $species['slug'],
        'obs_count' => $obsCount,
        'month_counts' => $monthCounts,
        'photo' => $firstPhoto,
        'habitat' => $ec['habitat'] ?? [],
        'altitude' => $ec['altitude_range'] ?? [],
        'season' => $ec['active_season'] ?? '',
        'notes' => $ec['notes'] ?? [],
        'morphological_traits' => $ik['morphological_traits'] ?? [],
        'similar_species' => $ik['similar_species'] ?? [],
        'key_differences' => $ik['key_differences'] ?? [],
        'specimens' => $specimens,
        'specimen_count' => count($specimens ?? []),
        'redlist' => $rl,
        'citation_count' => count($citations),
    ];
}

$dataA = loadSpeciesData($speciesA);
$dataB = loadSpeciesData($speciesB);

$hasBothSpecies = $dataA && $dataB;

$meta_title = 'Species Comparison';
if ($hasBothSpecies) {
    $meta_title = ($dataA['name'] ?? '') . ' vs ' . ($dataB['name'] ?? '') . ' — ikimon';
}
$meta_description = 'Compare two species side-by-side: habitat, phenology, identification keys, and conservation status.';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .compare-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }

        @media (max-width: 640px) {
            .compare-grid {
                grid-template-columns: 1fr;
            }
        }

        .compare-card {
            border-radius: 16px;
            border: 1px solid var(--md-outline-variant);
            background: var(--md-surface-container);
            overflow: hidden;
        }

        .phenology-bar {
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: 40px;
        }

        .phenology-bar .bar {
            flex: 1;
            border-radius: 2px;
            min-height: 3px;
            transition: opacity 0.2s;
        }

        .phenology-bar .bar:hover {
            opacity: 1 !important;
        }

        .vs-badge {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
        }
    </style>
</head>

<body class="font-body min-h-screen" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include('components/nav.php'); ?>

    <main class="max-w-5xl mx-auto px-4 pt-20 pb-32">

        <!-- Header -->
        <header class="mb-8 text-center">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-widest mb-4">
                <i data-lucide="git-compare" class="w-3.5 h-3.5"></i>
                Species Comparison
            </div>
            <?php if ($hasBothSpecies): ?>
                <h1 class="text-2xl md:text-4xl font-black">
                    <?php echo htmlspecialchars($dataA['name']); ?>
                    <span class="text-muted font-normal mx-2">vs</span>
                    <?php echo htmlspecialchars($dataB['name']); ?>
                </h1>
                <?php if ($dataA['scientific_name'] || $dataB['scientific_name']): ?>
                    <p class="text-sm italic text-muted mt-1">
                        <?php echo htmlspecialchars($dataA['scientific_name'] ?? '—'); ?>
                        <span class="not-italic mx-2">vs</span>
                        <?php echo htmlspecialchars($dataB['scientific_name'] ?? '—'); ?>
                    </p>
                <?php endif; ?>
            <?php else: ?>
                <h1 class="text-2xl md:text-4xl font-black">Species Comparison</h1>
                <p class="text-muted mt-2">Select two species to compare side-by-side</p>
            <?php endif; ?>
        </header>

        <!-- Search Form -->
        <div class="mb-10" style="padding:1.25rem;border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);background:var(--md-surface-container);box-shadow:var(--elev-1);">
            <form method="get" class="flex flex-col sm:flex-row items-end gap-3">
                <div class="flex-1 w-full">
                    <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Species A</label>
                    <input type="text" name="a" value="<?php echo htmlspecialchars($_GET['a'] ?? ''); ?>"
                        placeholder="Japanese or scientific name..."
                        class="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                </div>
                <div class="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent font-black text-sm shrink-0 hidden sm:flex">
                    VS
                </div>
                <div class="flex-1 w-full">
                    <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Species B</label>
                    <input type="text" name="b" value="<?php echo htmlspecialchars($_GET['b'] ?? ''); ?>"
                        placeholder="Japanese or scientific name..."
                        class="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                </div>
                <button type="submit"
                    class="px-6 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:opacity-90 transition shrink-0">
                    Compare
                </button>
            </form>
        </div>

        <?php if ($hasBothSpecies): ?>

            <!-- Stats Overview -->
            <section class="mb-8">
                <div class="compare-grid">
                    <?php foreach ([$dataA, $dataB] as $d): ?>
                        <div class="compare-card p-4">
                            <div class="flex items-center gap-3 mb-3">
                                <?php if ($d['photo']): ?>
                                    <img src="<?php echo htmlspecialchars($d['photo']); ?>" alt="<?php echo htmlspecialchars($d['name'] ?? '観察写真'); ?>" class="w-12 h-12 rounded-xl object-cover" style="border:1px solid var(--md-outline-variant);">
                                <?php else: ?>
                                    <div class="w-12 h-12 rounded-xl bg-border/30 flex items-center justify-center text-muted">
                                        <i data-lucide="image-off" class="w-5 h-5"></i>
                                    </div>
                                <?php endif; ?>
                                <div>
                                    <a href="species.php?<?php echo $d['slug'] ? 'name=' . urlencode($d['slug']) : 'jp=' . urlencode($d['name']); ?>"
                                        class="font-bold text-text hover:text-accent transition">
                                        <?php echo htmlspecialchars($d['name']); ?>
                                    </a>
                                    <?php if ($d['scientific_name']): ?>
                                        <div class="text-xs italic text-muted"><?php echo htmlspecialchars($d['scientific_name']); ?></div>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center">
                                <div style="padding:.5rem;border-radius:var(--shape-sm);background:var(--md-surface-container-low);">
                                    <div class="text-lg font-black text-text"><?php echo $d['obs_count']; ?></div>
                                    <div class="text-[10px] text-muted uppercase font-mono">Observations</div>
                                </div>
                                <div style="padding:.5rem;border-radius:var(--shape-sm);background:var(--md-surface-container-low);">
                                    <div class="text-lg font-black text-text"><?php echo $d['specimen_count']; ?></div>
                                    <div class="text-[10px] text-muted uppercase font-mono">Specimens</div>
                                </div>
                                <div style="padding:.5rem;border-radius:var(--shape-sm);background:var(--md-surface-container-low);">
                                    <div class="text-lg font-black text-text"><?php echo $d['citation_count']; ?></div>
                                    <div class="text-[10px] text-muted uppercase font-mono">Citations</div>
                                </div>
                            </div>
                            <!-- Red List -->
                            <?php if ($d['redlist']): ?>
                                <div class="mt-3">
                                    <?php foreach ($d['redlist'] as $listId => $entry): ?>
                                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
                                            style="background: <?php echo htmlspecialchars($entry['category_color']); ?>18; color: <?php echo htmlspecialchars($entry['category_color']); ?>;">
                                            <i data-lucide="shield-alert" class="w-3 h-3"></i>
                                            <?php echo htmlspecialchars($entry['category'] ?? ''); ?>
                                        </span>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>

            <!-- Phenology Comparison -->
            <?php
            $phenoMaxA = max($dataA['month_counts']);
            $phenoMaxB = max($dataB['month_counts']);
            $phenoMax = max($phenoMaxA, $phenoMaxB, 1); // shared scale
            $monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            $currentMonth = (int)date('n');
            if ($phenoMaxA > 0 || $phenoMaxB > 0):
            ?>
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="calendar-range" class="w-4 h-4 text-warning"></i>
                        <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-warning">PHENOLOGY COMPARISON</h2>
                    </div>
                    <div class="compare-grid">
                        <?php foreach ([$dataA, $dataB] as $d): ?>
                            <div class="compare-card p-4">
                                <div class="text-xs font-bold text-muted mb-2"><?php echo htmlspecialchars($d['name']); ?></div>
                                <div class="phenology-bar">
                                    <?php for ($i = 1; $i <= 12; $i++):
                                        $count = $d['month_counts'][$i];
                                        $pct = $phenoMax > 0 ? ($count / $phenoMax) * 100 : 0;
                                        $barH = max($count > 0 ? 8 : 3, $pct * 0.37);
                                        $opacity = $count > 0 ? max(0.3, $pct / 100) : 0.08;
                                        $isCurr = ($i === $currentMonth);
                                    ?>
                                        <div class="bar <?php echo $isCurr ? 'ring-1 ring-warning/50' : ''; ?>"
                                            style="height:<?php echo $barH; ?>px;background:<?php echo $count > 0 ? 'var(--color-warning)' : 'var(--md-outline-variant)'; ?>;opacity:<?php echo $opacity; ?>;"
                                            title="<?php echo $monthLabels[$i - 1] . ': ' . $count; ?>"></div>
                                    <?php endfor; ?>
                                </div>
                                <div class="flex justify-between mt-1">
                                    <?php for ($i = 0; $i < 12; $i++): ?>
                                        <span class="text-[8px] font-mono <?php echo (($i + 1) === $currentMonth) ? 'font-bold text-warning' : 'text-muted'; ?> flex-1 text-center"><?php echo $monthLabels[$i]; ?></span>
                                    <?php endfor; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endif; ?>

            <!-- Habitat & Ecology -->
            <?php if (!empty($dataA['habitat']) || !empty($dataB['habitat']) || $dataA['season'] || $dataB['season']): ?>
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="trees" class="w-4 h-4 text-secondary"></i>
                        <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-secondary">ECOLOGY</h2>
                        <span class="ml-auto text-token-xs font-mono text-muted bg-primary/10 px-2 py-0.5 rounded-full text-primary border border-primary/20">AI EXTRACTED</span>
                    </div>
                    <div class="compare-grid">
                        <?php foreach ([$dataA, $dataB] as $d): ?>
                            <div class="compare-card p-4">
                                <div class="text-xs font-bold text-muted mb-3"><?php echo htmlspecialchars($d['name']); ?></div>
                                <?php if (!empty($d['habitat'])): ?>
                                    <div class="mb-3">
                                        <div class="text-[10px] uppercase font-mono text-muted mb-1">Habitat</div>
                                        <div class="flex flex-wrap gap-1">
                                            <?php foreach ($d['habitat'] as $h): ?>
                                                <span class="px-2 py-1 rounded-md bg-secondary/10 text-xs text-secondary font-medium"><?php echo htmlspecialchars($h); ?></span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($d['altitude'])): ?>
                                    <div class="mb-3">
                                        <div class="text-[10px] uppercase font-mono text-muted mb-1">Altitude</div>
                                        <?php foreach ($d['altitude'] as $a): ?>
                                            <span class="text-xs text-text font-medium"><?php echo htmlspecialchars($a); ?></span>
                                        <?php endforeach; ?>
                                    </div>
                                <?php endif; ?>
                                <?php if ($d['season']): ?>
                                    <div>
                                        <div class="text-[10px] uppercase font-mono text-muted mb-1">Active Period</div>
                                        <span class="text-xs text-text font-medium"><?php echo htmlspecialchars($d['season']); ?></span>
                                    </div>
                                <?php endif; ?>
                                <?php if (empty($d['habitat']) && empty($d['altitude']) && !$d['season']): ?>
                                    <div class="text-xs text-muted italic">No ecological data available yet</div>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endif; ?>

            <!-- Identification Keys (Key Differences) -->
            <?php if (
                !empty($dataA['morphological_traits']) || !empty($dataB['morphological_traits']) ||
                !empty($dataA['key_differences']) || !empty($dataB['key_differences'])
            ): ?>
                <section class="mb-8">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="text-search" class="w-4 h-4 text-accent"></i>
                        <h2 class="text-token-xs font-bold tracking-[.15em] uppercase text-accent">IDENTIFICATION KEYS</h2>
                        <span class="ml-auto text-token-xs font-mono text-muted bg-accent/10 px-2 py-0.5 rounded-full text-accent border border-accent/20">AI EXTRACTED</span>
                    </div>
                    <div class="compare-grid">
                        <?php foreach ([$dataA, $dataB] as $d): ?>
                            <div class="compare-card p-4">
                                <div class="text-xs font-bold text-muted mb-3"><?php echo htmlspecialchars($d['name']); ?></div>
                                <?php if (!empty($d['morphological_traits'])): ?>
                                    <div class="mb-3">
                                        <div class="text-[10px] uppercase font-mono text-muted mb-1.5">
                                            <i data-lucide="microscope" class="w-3 h-3 inline-block mr-0.5"></i> Traits
                                        </div>
                                        <ul class="space-y-1">
                                            <?php foreach ($d['morphological_traits'] as $trait): ?>
                                                <li class="text-xs text-text-secondary leading-relaxed flex gap-1.5">
                                                    <span class="w-1 h-1 rounded-full bg-accent/40 mt-1.5 shrink-0"></span>
                                                    <?php echo htmlspecialchars($trait); ?>
                                                </li>
                                            <?php endforeach; ?>
                                        </ul>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($d['key_differences'])): ?>
                                    <div>
                                        <div class="text-[10px] uppercase font-mono text-muted mb-1.5">
                                            <i data-lucide="split" class="w-3 h-3 inline-block mr-0.5"></i> Key Differences
                                        </div>
                                        <ul class="space-y-1">
                                            <?php foreach ($d['key_differences'] as $diff): ?>
                                                <li class="text-xs text-text-secondary leading-relaxed flex gap-1.5">
                                                    <span class="w-1 h-1 rounded-full bg-warning/40 mt-1.5 shrink-0"></span>
                                                    <?php echo htmlspecialchars($diff); ?>
                                                </li>
                                            <?php endforeach; ?>
                                        </ul>
                                    </div>
                                <?php endif; ?>
                                <?php if (empty($d['morphological_traits']) && empty($d['key_differences'])): ?>
                                    <div class="text-xs text-muted italic">No identification data available yet</div>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endif; ?>

            <!-- Deep Dive Links -->
            <section class="mb-8">
                <div class="compare-grid">
                    <?php foreach ([$dataA, $dataB] as $d): ?>
                        <a href="species.php?<?php echo $d['slug'] ? 'name=' . urlencode($d['slug']) : 'jp=' . urlencode($d['name']); ?>"
                            class="compare-card p-4 flex items-center justify-center gap-2 text-sm font-bold text-accent hover:bg-accent/5 transition text-center">
                            <i data-lucide="arrow-right" class="w-4 h-4"></i>
                            <?php echo htmlspecialchars($d['name']); ?> — Full Detail
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>

        <?php elseif ($_GET['a'] ?? $_GET['b'] ?? false): ?>
            <div class="text-center py-16">
                <div class="text-4xl mb-4">🔍</div>
                <h2 class="text-xl font-bold mb-2">Please enter both species</h2>
                <p class="text-muted text-sm">Enter two species names above to see a side-by-side comparison.</p>
            </div>
        <?php else: ?>
            <!-- Empty State: Suggestion -->
            <div class="text-center py-16">
                <div class="text-5xl mb-4">⚔️</div>
                <h2 class="text-xl font-bold mb-2">Compare Two Species</h2>
                <p class="text-muted text-sm mb-8 max-w-md mx-auto">
                    Enter Japanese or scientific names above. Useful for distinguishing similar species, comparing ecological niches, or tracking conservation status.
                </p>
                <div class="text-xs text-muted">
                    <span class="font-mono px-3 py-1.5 rounded-lg" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);">
                        Example: ?a=ナミアゲハ&b=キアゲハ
                    </span>
                </div>
            </div>
        <?php endif; ?>

    </main>

    <?php include('components/footer.php'); ?>
</body>

</html>
