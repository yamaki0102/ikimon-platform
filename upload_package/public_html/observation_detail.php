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
require_once __DIR__ . '/../libs/TrustLevel.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';
require_once __DIR__ . '/../libs/ObservationMeta.php';
require_once __DIR__ . '/../libs/AffiliateManager.php';
Auth::init();
$currentUser = Auth::user();

function containsJapaneseText(string $text): bool
{
    return preg_match('/[\p{Hiragana}\p{Katakana}\p{Han}]/u', $text) === 1;
}

function normalizeAiDisplayText($value, ?string $fallback = null): ?string
{
    if (!is_string($value)) {
        return $fallback;
    }

    $text = trim(preg_replace('/\s+/u', ' ', $value));
    if ($text === '') {
        return $fallback;
    }

    $parts = preg_split('/(?<=[。！？\n])/u', $text) ?: [];
    $japaneseParts = [];
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part !== '' && containsJapaneseText($part)) {
            $japaneseParts[] = $part;
        }
    }

    if (!empty($japaneseParts)) {
        return trim(implode(' ', $japaneseParts));
    }

    if (containsJapaneseText($text)) {
        return $text;
    }

    return $fallback;
}

function normalizeAiDisplayList($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $normalized = [];
    foreach ($value as $item) {
        $text = normalizeAiDisplayText($item);
        if ($text !== null) {
            $normalized[] = $text;
        }
    }

    return array_values(array_unique($normalized));
}

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
if ($species_name) {
    $speciesLink = '/species.php?jp=' . urlencode($species_name);
} elseif ($taxon_slug) {
    $speciesLink = '/species/' . urlencode($taxon_slug);
}

// Determine Status Badge Color (Mapping Legacy)
$status = $obs['status'] ?? ($obs['quality_grade'] ?? '未同定');
$statusMap = [
    '調査中' => '未同定',
    'ていあん' => '要同定',
    'はかせ認定' => '研究用',
    'Research Grade' => (($obs['quality_detail'] ?? '') === 'species_supported' ? '種レベル研究用' : '研究利用可'),
    'Needs ID' => '要同定',
    '研究用' => '種レベル研究用',
];
$status = $statusMap[$status] ?? $status;
$statusColor = BioUtils::getStatusColor($status);
$managedContext = is_array($obs['managed_context'] ?? null) ? $obs['managed_context'] : [];
$managedContextType = (string)($managedContext['type'] ?? '');
$managedContextLabelMap = [
    'botanical_garden' => '植物園',
    'zoo' => '動物園',
    'aquarium' => '水族館',
    'aviary' => '花鳥園・鳥類園',
    'conservation_center' => '保全施設・研究飼育',
    'park_planting' => '公園植栽',
    'school_biotope' => '学校ビオトープ',
    'private_collection' => '私設コレクション',
    'other' => 'その他の施設',
];
$organismOrigin = (string)($obs['organism_origin'] ?? ((($obs['cultivation'] ?? 'wild') === 'cultivated') ? 'cultivated' : 'wild'));
$organismOriginLabelMap = [
    'wild' => '野生',
    'cultivated' => '栽培個体',
    'captive' => '飼育個体',
    'released' => '放された個体',
    'escaped' => '逸出個体',
    'naturalized' => '野外定着',
    'uncertain' => '判断保留',
];
$aiConfidenceLabelMap = [
    'high' => 'かなり確信',
    'medium' => 'たぶん',
    'low' => '慎重',
];
$latestAiAssessment = null;
foreach (array_reverse($obs['ai_assessments'] ?? []) as $assessment) {
    if (($assessment['kind'] ?? '') === 'machine_assessment') {
        $latestAiAssessment = $assessment;
        break;
    }
}
$latestAiFallback = is_array($latestAiAssessment) && (($latestAiAssessment['model'] ?? '') === 'system-fallback');
if ($latestAiAssessment) {
    $latestAiAssessment['simple_summary'] = normalizeAiDisplayText(
        $latestAiAssessment['simple_summary'] ?? null,
        '写真から読み取れる範囲では、まだ安全に言えるところまでで止めています。'
    );
    $latestAiAssessment['summary'] = normalizeAiDisplayText($latestAiAssessment['summary'] ?? null);
    $latestAiAssessment['why_not_more_specific'] = normalizeAiDisplayText($latestAiAssessment['why_not_more_specific'] ?? null);
    $latestAiAssessment['geographic_context'] = normalizeAiDisplayText($latestAiAssessment['geographic_context'] ?? null);
    $latestAiAssessment['seasonal_context'] = normalizeAiDisplayText($latestAiAssessment['seasonal_context'] ?? null);
    $latestAiAssessment['cautionary_note'] = normalizeAiDisplayText($latestAiAssessment['cautionary_note'] ?? null);
    $latestAiAssessment['observer_boost'] = normalizeAiDisplayText($latestAiAssessment['observer_boost'] ?? null);
    $latestAiAssessment['next_step'] = normalizeAiDisplayText(
        $latestAiAssessment['next_step'] ?? null,
        '別角度の写真や、体色・模様がわかる写真があると次に絞りやすくなります。'
    );
    $latestAiAssessment['diagnostic_features_seen'] = normalizeAiDisplayList($latestAiAssessment['diagnostic_features_seen'] ?? []);
    $latestAiAssessment['missing_evidence'] = normalizeAiDisplayList($latestAiAssessment['missing_evidence'] ?? []);
}
$trustGuidance = BioUtils::buildTrustGuidance($obs);
$trustProgress = BioUtils::buildTrustProgress($obs);
$canEditObservation = ObservationMeta::canEditObservation($obs, $currentUser);
$canSuggestObservationMeta = $currentUser && !$canEditObservation;
$canReviewObservationMeta = ObservationMeta::canReviewMetadataProposals($obs, $currentUser);
$metadataProposals = array_values(array_filter($obs['metadata_proposals'] ?? [], fn($proposal) => is_array($proposal)));
$pendingMetadataProposals = array_values(array_filter($metadataProposals, fn($proposal) => ($proposal['status'] ?? 'pending') === 'pending'));
$pendingMetadataProposalSummaries = [];
foreach ($pendingMetadataProposals as $proposal) {
    $pendingMetadataProposalSummaries[(string)($proposal['id'] ?? '')] = ObservationMeta::getProposalSupportSummary($proposal, $obs);
}
$metadataHistory = array_values(array_filter(
    array_reverse(array_values(array_filter($obs['edit_log'] ?? [], fn($entry) => is_array($entry)))),
    fn($entry) => in_array((string)($entry['type'] ?? ''), ['direct_edit', 'metadata_proposal_accepted', 'metadata_proposal_rejected'], true)
));

// Obscure location
$location = BioUtils::getObscuredLocation($obs['lat'], $obs['lng'], null); // Ignoring RedList for simple MVP logic here or fetch logic

// Check Red List & Invasive
$redlist = $taxon_key ? RedList::check($taxon_key) : null;
$invasive = ($species_name || $scientific_name) ? Invasive::check($species_name, $scientific_name) : null;

// --- 和名解決 (SEO/LLMO用) ---
$jp_display_name = null;
$family_jp = null;
$lineage = $obs['taxon']['lineage'] ?? [];
$taxon_rank = $obs['taxon']['rank'] ?? null;

$family_jp_map = [
    'Rosaceae' => 'バラ科', 'Fagaceae' => 'ブナ科', 'Pinaceae' => 'マツ科',
    'Asteraceae' => 'キク科', 'Poaceae' => 'イネ科', 'Fabaceae' => 'マメ科',
    'Orchidaceae' => 'ラン科', 'Lamiaceae' => 'シソ科', 'Brassicaceae' => 'アブラナ科',
    'Apiaceae' => 'セリ科', 'Solanaceae' => 'ナス科', 'Ericaceae' => 'ツツジ科',
    'Ranunculaceae' => 'キンポウゲ科', 'Liliaceae' => 'ユリ科', 'Lauraceae' => 'クスノキ科',
    'Moraceae' => 'クワ科', 'Salicaceae' => 'ヤナギ科', 'Betulaceae' => 'カバノキ科',
    'Cupressaceae' => 'ヒノキ科', 'Magnoliaceae' => 'モクレン科',
    'Ardeidae' => 'サギ科', 'Accipitridae' => 'タカ科', 'Anatidae' => 'カモ科',
    'Corvidae' => 'カラス科', 'Muscicapidae' => 'ヒタキ科', 'Paridae' => 'シジュウカラ科',
    'Phasianidae' => 'キジ科', 'Picidae' => 'キツツキ科', 'Strigidae' => 'フクロウ科',
    'Columbidae' => 'ハト科', 'Motacillidae' => 'セキレイ科', 'Hirundinidae' => 'ツバメ科',
    'Passeridae' => 'スズメ科', 'Fringillidae' => 'アトリ科', 'Sylviidae' => 'ウグイス科',
    'Nymphalidae' => 'タテハチョウ科', 'Papilionidae' => 'アゲハチョウ科',
    'Pieridae' => 'シロチョウ科', 'Lycaenidae' => 'シジミチョウ科',
    'Cerambycidae' => 'カミキリムシ科', 'Scarabaeidae' => 'コガネムシ科',
    'Lucanidae' => 'クワガタムシ科', 'Coccinellidae' => 'テントウムシ科',
    'Libellulidae' => 'トンボ科', 'Acrididae' => 'バッタ科', 'Tettigoniidae' => 'キリギリス科',
    'Ranidae' => 'アカガエル科', 'Hylidae' => 'アマガエル科', 'Bufonidae' => 'ヒキガエル科',
    'Lacertidae' => 'カナヘビ科', 'Gekkonidae' => 'ヤモリ科', 'Colubridae' => 'ナミヘビ科',
    'Cyprinidae' => 'コイ科', 'Salmonidae' => 'サケ科',
];
$family_name = $lineage['family'] ?? null;
if ($family_name && isset($family_jp_map[$family_name])) {
    $family_jp = $family_jp_map[$family_name];
}

if ($species_name && preg_match('/[\p{Hiragana}\p{Katakana}\p{Han}]/u', $species_name)) {
    $jp_display_name = $species_name;
} elseif ($family_jp && $scientific_name) {
    $rank_label = match($taxon_rank) {
        'genus' => '属',
        'family' => '科',
        'order' => '目',
        'species' => '',
        default => '',
    };
    $jp_display_name = $family_jp . 'の' . ($rank_label ? $rank_label . '(' : '(') . $scientific_name . ')';
}

$seo_name = $jp_display_name ?: ($species_name ?? '同定提案待ち');
$obs_date = date('Y年n月j日', strtotime($obs['observed_at'] ?? $obs['created_at']));
$obs_place = $obs['municipality'] ?? ($obs['prefecture'] ?? '');
$taxonomy_breadcrumb = implode(' > ', array_filter([
    $lineage['kingdom'] ?? null,
    $lineage['phylum'] ?? null,
    $lineage['class'] ?? null,
    $lineage['order'] ?? null,
    $family_jp ? $family_jp . ' (' . $family_name . ')' : ($family_name ?? null),
]));

// --- OGP Meta ---
$meta_title = $seo_name . ($scientific_name && $scientific_name !== $seo_name ? " ($scientific_name)" : '') . " の観察記録" . ($obs_place ? " - $obs_place" : '');
$meta_description = $obs_date . ($obs_place ? "に{$obs_place}で" : 'に') . "観察された" . $seo_name
    . ($scientific_name && $scientific_name !== $seo_name ? " ($scientific_name)" : '')
    . "の記録。" . ($taxonomy_breadcrumb ? "分類: {$taxonomy_breadcrumb}。" : '')
    . "市民参加型生物多様性プラットフォーム ikimon.life";
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
    <script type="application/ld+json" nonce="<?= CspNonce::attr() ?>">
        <?php
        $taxonLd = [
            '@type' => 'Taxon',
            'name' => $scientific_name ?: ($species_name ?? null),
            'alternateName' => $jp_display_name ?: ($species_name !== $scientific_name ? $species_name : null),
            'taxonRank' => $taxon_rank ?: null,
        ];
        if ($family_name) $taxonLd['parentTaxon'] = ['@type' => 'Taxon', 'name' => $family_name, 'taxonRank' => 'family'];
        $taxonLd = array_filter($taxonLd, fn($v) => $v !== null);

        $jsonLd = [
            '@context' => 'https://schema.org',
            '@type' => 'Observation',
            'name' => $seo_name . ' の観察記録',
            'description' => $meta_description,
            'url' => $meta_canonical,
            'identifier' => $id,
            'dateCreated' => $obs['observed_at'] ?? $obs['created_at'] ?? null,
            'about' => $taxonLd,
        ];
        if (!empty($obs['lat']) && !empty($obs['lng'])) {
            $jsonLd['contentLocation'] = [
                '@type' => 'Place',
                'name' => $obs_place ?: null,
                'geo' => [
                    '@type' => 'GeoCoordinates',
                    'latitude' => round((float) $obs['lat'], 4),
                    'longitude' => round((float) $obs['lng'], 4),
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
        $jsonLd['isPartOf'] = [
            '@type' => 'WebSite',
            'name' => 'ikimon.life',
            'url' => 'https://ikimon.life',
            'description' => '市民参加型生物多様性プラットフォーム',
        ];
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_HEX_TAG);
        ?>
    </script>

    <!-- MapLibre -->
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
</head>

<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body min-h-screen antialiased" x-data="{ idModalOpen: false, photoActive: 0, lightbox: false, touchStart: 0, touchEnd: 0, locationName: '<?php echo htmlspecialchars($obs['municipality'] ?? ($obs['prefecture'] ?? ''), ENT_QUOTES); ?>' }" x-init="
    <?php if (!empty($obs['lat']) && !empty($obs['lng'])): ?>
    fetch('https://nominatim.openstreetmap.org/reverse?lat=<?php echo floatval($obs['lat']); ?>&lon=<?php echo floatval($obs['lng']); ?>&format=json&accept-language=ja&zoom=10')
        .then(r => r.json())
        .then(d => { if (d.address) { const city = d.address.city || d.address.town || d.address.village || d.address.county || ''; const state = d.address.state || ''; locationName = city ? city + (state ? ', ' + state : '') : (state || locationName); } })
        .catch(() => {});
    <?php endif; ?>
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
                window.location.href = window.location.pathname + window.location.search + '&_t=' + Date.now();
            } else {
                alert('エラーが発生しました: ' + (data.message || 'Unknown error'));
            }
        } catch(e) { alert('通信エラー'); }
    },
    async reviewMetadataProposal(proposalId, action) {
        const labels = { accept: '採用', reject: '却下' };
        if(!confirm('この提案を' + (labels[action] || action) + 'しますか？')) return;
        const _csrf = (document.cookie.match(/(?:^|;\\s*)ikimon_csrf=([a-f0-9]{64})/)||[])[1]||'';
        try {
            const res = await fetch('/api/review_observation_metadata.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': _csrf },
                body: JSON.stringify({
                    observation_id: '<?php echo htmlspecialchars($id, ENT_QUOTES); ?>',
                    proposal_id: proposalId,
                    action: action
                })
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = window.location.pathname + window.location.search + '&_t=' + Date.now();
            } else {
                alert('エラー: ' + (data.message || '処理できませんでした'));
            }
        } catch (e) {
            alert('通信エラー');
        }
    },
    async supportMetadataProposal(proposalId) {
        const _csrf = (document.cookie.match(/(?:^|;\\s*)ikimon_csrf=([a-f0-9]{64})/)||[])[1]||'';
        try {
            const res = await fetch('/api/support_observation_metadata.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': _csrf },
                body: JSON.stringify({
                    observation_id: '<?php echo htmlspecialchars($id, ENT_QUOTES); ?>',
                    proposal_id: proposalId
                })
            });
            const data = await res.json();
            if (data.success) {
                window.location.href = window.location.pathname + window.location.search + '&_t=' + Date.now();
            } else {
                alert('エラー: ' + (data.message || '処理できませんでした'));
            }
        } catch (e) {
            alert('通信エラー');
        }
    }
">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <!-- Main Content -->
    <main class="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <!-- Breadcrumb & Stats Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-2 text-sm text-muted">
                <a href="index.php" class="hover:text-primary transition flex items-center gap-1">
                    <i data-lucide="home" class="w-3.5 h-3.5"></i>
                    ホーム
                </a>
                <span class="text-faint">/</span>
                <span class="text-text font-medium">観察詳細</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                <!-- View count -->
                <span class="flex items-center gap-1 text-xs text-muted">
                    <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                    <?php echo (int)($obs['views'] ?? 0); ?>
                </span>
                <!-- ID count -->
                <span class="flex items-center gap-1 text-xs text-muted">
                    <i data-lucide="users" class="w-3.5 h-3.5"></i>
                    <?php echo count($obs['identifications'] ?? []); ?>
                </span>
                <!-- Status Badge -->
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border <?php echo $statusColor; ?>">
                    <span class="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    <?php echo htmlspecialchars($status); ?>
                </div>
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
                            <button @click.stop="photoActive = (photoActive - 1 + <?php echo count($obs['photos']); ?>) % <?php echo count($obs['photos']); ?>" aria-label="前の写真" class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
                                <i data-lucide="chevron-left" class="w-5 h-5"></i>
                            </button>
                            <button @click.stop="photoActive = (photoActive + 1) % <?php echo count($obs['photos']); ?>" aria-label="次の写真" class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
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
                <div x-show="lightbox" x-cloak x-transition.opacity class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2" role="dialog" aria-modal="true" aria-labelledby="obs-lightbox-title"
                    @keydown.window.left.prevent="photoActive = (photoActive - 1 + <?php echo max(1, count($obs['photos'] ?? [])); ?>) % <?php echo max(1, count($obs['photos'] ?? [])); ?>"
                    @keydown.window.right.prevent="photoActive = (photoActive + 1) % <?php echo max(1, count($obs['photos'] ?? [])); ?>"
                    @keydown.window.escape.prevent="lightbox = false">
                    <h2 id="obs-lightbox-title" class="sr-only">観察写真</h2>
                    <button @click.stop="lightbox = false" aria-label="閉じる" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full z-[101] hover:bg-white/20 transition">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                    <?php if (!empty($obs['photos'])): ?>
                        <?php foreach ($obs['photos'] as $idx => $photo): ?>
                            <img src="<?php echo htmlspecialchars($photo); ?>" x-show="photoActive === <?php echo $idx; ?>" alt="観察写真 <?php echo $idx + 1; ?>" class="max-w-full max-h-full object-contain pointer-events-none select-none">
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <!-- Thumbnails -->
                <?php if (!empty($obs['photos']) && count($obs['photos']) > 1): ?>
                    <div class="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
                        <?php foreach ($obs['photos'] as $idx => $photo): ?>
                            <button @click.stop="photoActive = <?php echo $idx; ?>" type="button" class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition" :class="photoActive === <?php echo $idx; ?> ? 'border-primary scale-105' : 'border-transparent opacity-50'">
                                <img src="<?php echo $photo; ?>" alt="観察写真 <?php echo $idx + 1; ?>" class="w-full h-full object-cover" loading="lazy">
                            </button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <!-- Owner Narrative -->
                <?php $observerName = $obs['user_display_name'] ?? $obs['user_name'] ?? $obs['user']['display_name'] ?? $obs['user']['name'] ?? BioUtils::getUserName($obs['user_id']); ?>
                <div class="mt-4 bg-surface rounded-2xl border border-border p-4 shadow-sm">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="<?php echo htmlspecialchars($obs['user_avatar'] ?? 'https://i.pravatar.cc/150?u=' . $obs['user_id']); ?>"
                            alt="<?php echo htmlspecialchars($observerName ?? 'ユーザー'); ?>のアバター"
                            class="w-10 h-10 rounded-full border-2 border-border shadow-sm object-cover flex-shrink-0">
                        <div>
                            <div class="text-sm font-bold text-text leading-none"><?php echo htmlspecialchars($observerName); ?></div>
                            <div class="text-token-xs text-muted mt-0.5">
                                <?php echo date('Y年m月d日', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now')); ?>
                                <?php if (!empty($obs['location']['name'])): ?>
                                    · <?php echo htmlspecialchars($obs['location']['name']); ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-text leading-relaxed">
                        <?php echo !empty($obs['note']) ? BioUtils::renderMarkdown($obs['note']) : '<span class="text-muted italic">観察メモなし</span>'; ?>
                    </p>
                </div>

                <?php if ($managedContextType !== '' || !empty($managedContext['site_name']) || $organismOrigin !== ''): ?>
                    <section class="bg-surface rounded-2xl border border-border p-4 shadow-sm">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest">記録文脈</p>
                                <h3 class="text-sm font-bold text-text mt-1">施設由来と野生性</h3>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-1 rounded-full <?php echo ($obs['archive_track'] ?? 'wild_occurrence') === 'managed_collection' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'; ?>">
                                <?php echo ($obs['archive_track'] ?? 'wild_occurrence') === 'managed_collection' ? '施設資料' : '野外記録'; ?>
                            </span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div class="rounded-xl bg-base/60 border border-border p-3">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">個体の由来</p>
                                <p class="font-bold text-text"><?php echo htmlspecialchars($organismOriginLabelMap[$organismOrigin] ?? $organismOrigin); ?></p>
                            </div>
                            <div class="rounded-xl bg-base/60 border border-border p-3">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">施設文脈</p>
                                <p class="font-bold text-text"><?php echo htmlspecialchars($managedContextLabelMap[$managedContextType] ?? ($managedContextType !== '' ? $managedContextType : 'なし')); ?></p>
                                <?php if (!empty($managedContext['site_name'])): ?>
                                    <p class="text-xs text-muted mt-1"><?php echo htmlspecialchars($managedContext['site_name']); ?></p>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php if (!empty($managedContext['note'])): ?>
                            <p class="mt-3 text-sm text-muted leading-relaxed"><?php echo htmlspecialchars($managedContext['note']); ?></p>
                        <?php endif; ?>
                        <p class="mt-3 text-[11px] text-faint">施設の中でも野生個体は野生として分けて保存します。100年後に来歴をたどれるよう、施設文脈は野外分布とは別に残します。</p>
                    </section>
                <?php endif; ?>

                <?php if ($latestAiAssessment || in_array(($obs['ai_assessment_status'] ?? ''), ['pending', 'queued'], true)): ?>
                    <section class="bg-surface rounded-2xl border border-border p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest">観察のヒント</p>
                                <h3 class="text-sm font-bold text-text mt-1">いっしょに絞るためのメモ</h3>
                            </div>
                            <?php if ($latestAiAssessment): ?>
                                <?php if ($latestAiFallback): ?>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning">まだ絞れていません</span>
                                <?php else: ?>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        <?php echo htmlspecialchars($aiConfidenceLabelMap[$latestAiAssessment['confidence_band'] ?? 'low'] ?? ($latestAiAssessment['confidence_band'] ?? 'low')); ?>
                                    </span>
                                <?php endif; ?>
                            <?php else: ?>
                                <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning">解析待ち</span>
                            <?php endif; ?>
                        </div>
                        <?php if ($latestAiAssessment): ?>
                            <?php if ($latestAiFallback): ?>
                                <div class="rounded-2xl bg-warning/5 border border-warning/20 p-4 mb-3">
                                    <p class="text-[10px] font-black text-warning uppercase tracking-widest mb-1">AIだけではまだ絞れていません</p>
                                    <p class="text-sm text-text leading-relaxed">
                                        <?php echo htmlspecialchars($latestAiAssessment['simple_summary'] ?? '写真だけではまだ方向を絞りきれていません。'); ?>
                                    </p>
                                    <p class="text-[11px] text-muted mt-2">別の人からの同定や、見分けに効く写真が入ると進みやすい状態です。</p>
                                </div>
                            <?php endif; ?>
                            <?php $recommended = $latestAiAssessment['recommended_taxon'] ?? null; ?>
                            <?php
                                $aiHints = array_values(array_filter([
                                    !empty($latestAiAssessment['geographic_context']) ? '場所: ' . $latestAiAssessment['geographic_context'] : null,
                                    !empty($latestAiAssessment['seasonal_context']) ? '季節: ' . $latestAiAssessment['seasonal_context'] : null,
                                ]));
                            ?>
                            <?php if ($recommended && !$latestAiFallback): ?>
                                <?php
                                    $rankLabelMap = [
                                        'kingdom' => '界',
                                        'phylum' => '門',
                                        'class' => '綱',
                                        'order' => '目',
                                        'family' => '科',
                                        'genus' => '属',
                                        'species' => '種',
                                    ];
                                    $rankSuffixMap = [
                                        'kingdom' => '界',
                                        'phylum' => '門',
                                        'class' => '綱',
                                        'order' => '目',
                                        'family' => '科',
                                        'genus' => '属',
                                        'species' => '',
                                        'subgenus' => '亜属',
                                    ];
                                    $recommendedRank = strtolower((string)($recommended['rank'] ?? 'unknown'));
                                    $recommendedRankLabel = $rankLabelMap[$recommendedRank] ?? ($recommended['rank'] ?? 'unknown');

                                    $bestSpecificForDisplay = is_array($latestAiAssessment['best_specific_taxon'] ?? null) ? $latestAiAssessment['best_specific_taxon'] : null;
                                    $recommendedDisplayName = $recommended['name'] ?? '未確定';
                                    $recommendedScientific = $recommended['scientific_name'] ?? '';

                                    $isLatinOnly = $recommendedDisplayName !== '' && preg_match('/^[A-Za-z\s\-\.]+$/', $recommendedDisplayName);
                                    if ($isLatinOnly) {
                                        if ($bestSpecificForDisplay && !empty($bestSpecificForDisplay['name']) && !preg_match('/^[A-Za-z\s\-\.]+$/', $bestSpecificForDisplay['name'])) {
                                            $recommendedDisplayName = $bestSpecificForDisplay['name'];
                                        } else {
                                            $familyJaMap = [
                                                'Rosaceae' => 'バラ', 'Fabaceae' => 'マメ', 'Asteraceae' => 'キク',
                                                'Poaceae' => 'イネ', 'Brassicaceae' => 'アブラナ', 'Lamiaceae' => 'シソ',
                                                'Apiaceae' => 'セリ', 'Fagaceae' => 'ブナ', 'Pinaceae' => 'マツ',
                                                'Cupressaceae' => 'ヒノキ', 'Lauraceae' => 'クスノキ', 'Ericaceae' => 'ツツジ',
                                                'Orchidaceae' => 'ラン', 'Liliaceae' => 'ユリ', 'Iridaceae' => 'アヤメ',
                                                'Salicaceae' => 'ヤナギ', 'Betulaceae' => 'カバノキ', 'Aceraceae' => 'カエデ',
                                                'Sapindaceae' => 'ムクロジ', 'Oleaceae' => 'モクセイ',
                                            ];
                                            $genusJaMap = [
                                                'Prunus' => 'サクラ', 'Quercus' => 'コナラ', 'Pinus' => 'マツ',
                                                'Acer' => 'カエデ', 'Salix' => 'ヤナギ', 'Rosa' => 'バラ',
                                                'Rhododendron' => 'ツツジ', 'Camellia' => 'ツバキ', 'Magnolia' => 'モクレン',
                                                'Cornus' => 'ミズキ', 'Viburnum' => 'ガマズミ', 'Hydrangea' => 'アジサイ',
                                                'Wisteria' => 'フジ', 'Iris' => 'アヤメ', 'Lilium' => 'ユリ',
                                                'Passer' => 'スズメ', 'Corvus' => 'カラス', 'Turdus' => 'ツグミ',
                                                'Motacilla' => 'セキレイ', 'Ardea' => 'サギ', 'Anas' => 'カモ',
                                                'Falco' => 'ハヤブサ', 'Buteo' => 'ノスリ', 'Columba' => 'ハト',
                                                'Papilio' => 'アゲハ', 'Pieris' => 'シロチョウ', 'Vanessa' => 'タテハ',
                                                'Lucanus' => 'クワガタ', 'Dynastes' => 'カブトムシ',
                                            ];

                                            $suffix = $rankSuffixMap[$recommendedRank] ?? '';
                                            if ($recommendedRank === 'genus' && isset($genusJaMap[$recommendedDisplayName])) {
                                                $recommendedDisplayName = $genusJaMap[$recommendedDisplayName] . $suffix;
                                            } elseif ($recommendedRank === 'family') {
                                                $familyName = $recommended['family'] ?? $recommendedDisplayName;
                                                if (isset($familyJaMap[$familyName])) {
                                                    $recommendedDisplayName = $familyJaMap[$familyName] . $suffix;
                                                }
                                            }
                                        }
                                    }
                                ?>
                                <div class="rounded-2xl bg-primary/5 border border-primary/20 p-4 mb-3">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <p class="text-[10px] font-black text-primary uppercase tracking-widest mb-1">いまはここまで絞れそう</p>
                                            <p class="text-lg font-black text-text leading-tight">
                                                <?php echo htmlspecialchars($recommendedDisplayName); ?>
                                            </p>
                                            <?php if ($isLatinOnly || ($recommendedScientific !== '' && $recommendedScientific !== $recommendedDisplayName)): ?>
                                                <p class="text-xs text-muted italic"><?php echo htmlspecialchars($recommendedScientific); ?></p>
                                            <?php endif; ?>
                                            <p class="text-sm text-muted mt-1"><?php echo htmlspecialchars($recommendedRankLabel); ?>まではかなり近そうです</p>
                                            <?php
                                                $bestSpecificTaxon = is_array($latestAiAssessment['best_specific_taxon'] ?? null) ? $latestAiAssessment['best_specific_taxon'] : null;
                                                $hasNarrowerHypothesis = $bestSpecificTaxon && (($bestSpecificTaxon['id'] ?? null) !== ($recommended['id'] ?? null));
                                            ?>
                                            <?php if ($hasNarrowerHypothesis): ?>
                                                <p class="text-[12px] text-muted mt-2">
                                                    候補の中では <?php echo htmlspecialchars(($bestSpecificTaxon['name'] ?? '未確定') . ' (' . ($bestSpecificTaxon['rank'] ?? 'unknown') . ')'); ?> がいちばん近そうです
                                                </p>
                                            <?php endif; ?>
                                        </div>
                                        <div class="shrink-0 flex flex-col items-end gap-2">
                                            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-primary/20 text-primary">
                                                <?php echo htmlspecialchars($recommendedRankLabel); ?>まで
                                            </span>
                                            <?php if (!empty($latestAiAssessment['photo_count_used'])): ?>
                                                <span class="text-[11px] font-bold px-2 py-1 rounded-full bg-white border border-border text-faint">
                                                    <?php echo (int)$latestAiAssessment['photo_count_used']; ?>枚参照
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                    <?php if (!empty($latestAiAssessment['simple_summary'])): ?>
                                        <p class="text-sm text-text leading-relaxed mt-3"><?php echo nl2br(htmlspecialchars($latestAiAssessment['simple_summary'])); ?></p>
                                    <?php elseif (!empty($latestAiAssessment['summary'])): ?>
                                        <p class="text-sm text-text leading-relaxed mt-3"><?php echo nl2br(htmlspecialchars($latestAiAssessment['summary'])); ?></p>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                            <div class="space-y-3 text-sm">
                                <div class="grid gap-3 sm:grid-cols-2">
                                    <?php if (!empty($latestAiAssessment['diagnostic_features_seen'])): ?>
                                        <div class="rounded-xl border border-border bg-base/40 p-3">
                                            <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">写真から拾えている手がかり</p>
                                            <p class="text-text leading-relaxed"><?php echo htmlspecialchars(implode(' / ', $latestAiAssessment['diagnostic_features_seen'])); ?></p>
                                        </div>
                                    <?php endif; ?>
                                    <?php if (!empty($latestAiAssessment['why_not_more_specific'])): ?>
                                        <div class="rounded-xl border border-border bg-base/40 p-3">
                                            <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">ここで止めておく理由</p>
                                            <p class="text-muted leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['why_not_more_specific']); ?></p>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                <?php if (!empty($aiHints)): ?>
                                    <div class="rounded-xl border border-border bg-primary/5 p-3">
                                        <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-2">場所と季節のヒント</p>
                                        <div class="flex flex-wrap gap-2">
                                            <?php foreach ($aiHints as $aiHint): ?>
                                                <span class="inline-flex items-center rounded-full bg-white border border-border px-3 py-1 text-xs text-muted">
                                                    <?php echo htmlspecialchars($aiHint); ?>
                                                </span>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['cautionary_note'])): ?>
                                    <p class="text-xs text-warning leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['cautionary_note']); ?></p>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['observer_boost'])): ?>
                                    <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                                        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">この観察ですでに助かるところ</p>
                                        <p class="text-emerald-800 leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['observer_boost']); ?></p>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['next_step'])): ?>
                                    <div class="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
                                        <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">次にあると絞りやすいもの</p>
                                        <p class="text-sky-800 leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['next_step']); ?></p>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['similar_taxa_to_compare']) || !empty($latestAiAssessment['missing_evidence'])): ?>
                                    <div class="rounded-xl border border-border bg-base/30 px-3 py-3 space-y-3">
                                        <?php if (!empty($latestAiAssessment['similar_taxa_to_compare'])): ?>
                                            <div>
                                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">見分け候補</p>
                                                <div class="flex flex-wrap gap-2">
                                                    <?php foreach ($latestAiAssessment['similar_taxa_to_compare'] as $candidateName): ?>
                                                        <?php $candidateUrl = 'explore.php?q=' . urlencode((string)$candidateName); ?>
                                                        <a href="<?php echo htmlspecialchars($candidateUrl); ?>" class="inline-flex items-center rounded-full bg-white border border-border px-3 py-1 text-xs text-text hover:border-primary/40 hover:text-primary transition">
                                                            <?php echo htmlspecialchars((string)$candidateName); ?>
                                                        </a>
                                                    <?php endforeach; ?>
                                                </div>
                                                <p class="text-[11px] text-muted mt-2">タップすると、その候補に近い記録を探せます。</p>
                                                <?php if (!empty($latestAiAssessment['missing_evidence'])): ?>
                                                    <p class="text-[11px] text-muted mt-1">
                                                        違いが出やすいポイント:
                                                        <?php echo htmlspecialchars(implode(' / ', array_slice($latestAiAssessment['missing_evidence'], 0, 2))); ?>
                                                    </p>
                                                <?php endif; ?>
                                            </div>
                                        <?php endif; ?>
                                        <?php if (!empty($latestAiAssessment['missing_evidence'])): ?>
                                            <div>
                                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1">あるともっと絞りやすい情報</p>
                                                <p class="text-text leading-relaxed"><?php echo htmlspecialchars(implode(' / ', $latestAiAssessment['missing_evidence'])); ?></p>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                <?php endif; ?>
                            </div>
                            <p class="mt-3 text-[11px] text-faint">このメモは、観察を次につなぐための参考情報です。コミュニティ同定の票には入りません。</p>
                        <?php else: ?>
                            <p class="text-sm text-muted leading-relaxed">投稿後の参考メモを準備中です。完了すると、写真から拾えている手がかりや、次にあると絞りやすい情報がここに表示されます。</p>
                        <?php endif; ?>
                    </section>
                <?php endif; ?>

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
                            target="_blank" rel="noopener noreferrer"
                            class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border hover:bg-black hover:text-white hover:border-black transition"
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

                <?php if (!empty($trustGuidance['steps']) && ($trustGuidance['status'] ?? '') !== '種レベル研究用'): ?>
                    <div class="rounded-2xl border border-primary/15 bg-primary/5 p-4 shadow-sm">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest">この記録を育てる</p>
                                <p class="text-sm font-bold text-text mt-1"><?php echo htmlspecialchars($trustGuidance['headline']); ?></p>
                            </div>
                            <span class="text-xl leading-none">🌱</span>
                        </div>
                        <div class="mt-3 flex flex-wrap gap-2">
                            <?php foreach (array_slice($trustGuidance['steps'], 0, 2) as $step): ?>
                                <span class="inline-flex items-center rounded-full bg-white border border-primary/15 px-3 py-1 text-xs text-text">
                                    <?php echo htmlspecialchars($step); ?>
                                </span>
                            <?php endforeach; ?>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            <button @click="idModalOpen = true"
                                class="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-primary-dark active:scale-95">
                                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                                名前を提案する
                            </button>
                            <a href="#id-list-container"
                                class="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-text border border-border transition hover:border-primary/30 hover:text-primary">
                                <i data-lucide="messages-square" class="w-3.5 h-3.5"></i>
                                みんなの推測を見る
                            </a>
                        </div>
                    </div>
                <?php endif; ?>

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
                        <?php
                        $iCount = $obs['individual_count'] ?? null;
                        if ($iCount !== null):
                            $countLabels = [1 => '1', 3 => '2〜5', 8 => '6〜10', 30 => '11〜50', 51 => '50+'];
                            $countLabel = $countLabels[$iCount] ?? $iCount;
                        ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20" title="周辺で確認された個体数（参考値）">
                                <i data-lucide="hash" class="w-3 h-3"></i>
                                <?php echo htmlspecialchars($countLabel); ?> 個体
                            </span>
                        <?php endif; ?>
                    </div>

                    <?php if ($canEditObservation || $canSuggestObservationMeta): ?>
                        <div class="mb-6 flex flex-wrap gap-2">
                            <a href="/edit_observation.php?id=<?php echo urlencode($id); ?>"
                                class="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-text transition hover:border-primary/30 hover:text-primary">
                                <i data-lucide="<?php echo $canEditObservation ? 'pencil' : 'sparkles'; ?>" class="w-3.5 h-3.5"></i>
                                <?php echo $canEditObservation ? '観察データを編集' : '環境や状態を提案'; ?>
                            </a>
                            <?php if (!empty($pendingMetadataProposals)): ?>
                                <span class="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary">
                                    <i data-lucide="messages-square" class="w-3.5 h-3.5"></i>
                                    構造化提案 <?php echo count($pendingMetadataProposals); ?>件
                                </span>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

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

                    <!-- Consensus Display (Simplified) -->
                    <?php $idCount = count($obs['identifications'] ?? []); ?>
                    <?php if ($idCount > 0): ?>
                        <?php $agreementRate = round(($obs['consensus']['agreement_rate'] ?? 0) * 100); ?>
                        <div class="mb-6 flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <span class="text-2xl flex-shrink-0">
                                <?php echo in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true) ? '🏆' : '🔍'; ?>
                            </span>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-bold text-text">
                                    <?php echo $idCount; ?>人が識別に参加
                                    <?php if ($species_name && $agreementRate >= 60): ?>
                                        · <?php echo $agreementRate; ?>% 一致
                                    <?php endif; ?>
                                </div>
                                <div class="text-xs text-muted mt-0.5">
                                    <?php if (in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true)): ?>
                                        コミュニティの合意が得られた記録です
                                    <?php else: ?>
                                        みんなの意見を聞いて、種名を特定しよう
                                    <?php endif; ?>
                                </div>
                            </div>
                            <span class="flex-shrink-0 <?php echo in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true) ? 'text-green-600 bg-green-500/10 border-green-500/20' : 'text-orange-500 bg-orange-500/10 border-orange-500/20'; ?> text-token-xs font-bold px-2 py-1 rounded-full border">
                                <?php echo htmlspecialchars($obs['status']); ?>
                            </span>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($trustGuidance['steps'])): ?>
                        <div class="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-2xl leading-none">🧭</span>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-sky-900"><?php echo htmlspecialchars($trustGuidance['headline']); ?></p>
                                    <p class="text-xs text-sky-800/80 mt-1 leading-relaxed"><?php echo htmlspecialchars($trustGuidance['body']); ?></p>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <?php foreach ($trustGuidance['steps'] as $step): ?>
                                            <span class="inline-flex items-center rounded-full bg-white border border-sky-200 px-3 py-1 text-xs text-sky-900">
                                                <?php echo htmlspecialchars($step); ?>
                                            </span>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($trustProgress)): ?>
                        <div class="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-violet-900"><?php echo htmlspecialchars((string)($trustProgress['headline'] ?? '信頼済みへの進み具合')); ?></p>
                                    <p class="text-xs text-violet-900/75 mt-1 leading-relaxed"><?php echo htmlspecialchars((string)($trustProgress['next_label'] ?? '')); ?></p>
                                </div>
                                <span class="inline-flex items-center rounded-full bg-white border border-violet-200 px-3 py-1 text-xs font-black text-violet-700">
                                    <?php echo (int)($trustProgress['progress'] ?? 0); ?>%
                                </span>
                            </div>
                            <div class="mt-3 h-2 rounded-full bg-white/80 overflow-hidden">
                                <div class="h-full rounded-full bg-gradient-to-r from-violet-500 via-primary to-emerald-500" style="width: <?php echo (int)($trustProgress['progress'] ?? 0); ?>%"></div>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-2">
                                <?php foreach (($trustProgress['checkpoints'] ?? []) as $checkpoint): ?>
                                    <div class="rounded-2xl border px-3 py-2 <?php echo !empty($checkpoint['complete']) ? 'border-emerald-200 bg-white text-emerald-900' : 'border-violet-100 bg-white/80 text-violet-900'; ?>">
                                        <div class="text-[11px] font-bold flex items-center gap-1.5">
                                            <span><?php echo !empty($checkpoint['complete']) ? '✓' : '・'; ?></span>
                                            <?php echo htmlspecialchars((string)($checkpoint['label'] ?? '')); ?>
                                        </div>
                                        <div class="mt-1 text-[10px] opacity-75"><?php echo htmlspecialchars((string)($checkpoint['detail'] ?? '')); ?></div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($pendingMetadataProposals)): ?>
                        <div class="mb-6 rounded-xl border border-primary/15 bg-primary/5 p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-2xl leading-none">🧩</span>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-text">構造化情報の提案があります</p>
                                    <p class="text-xs text-muted mt-1 leading-relaxed">環境やライフステージなどについて、ほかの人からの提案が入っています。原本は保ったまま、意味づけだけを育てるための仕組みです。</p>
                                    <div class="mt-3 space-y-2">
                                        <?php foreach (array_slice($pendingMetadataProposals, 0, 3) as $proposal): ?>
                                            <?php
                                            $fieldLabels = [
                                                'biome' => '環境',
                                                'organism_origin' => '由来',
                                                'life_stage' => '状態',
                                                'individual_count' => '個体数',
                                                'managed_context_type' => '施設区分',
                                                'managed_site_name' => '施設名',
                                                'managed_context_note' => '施設メモ',
                                            ];
                                            $proposalId = (string)($proposal['id'] ?? '');
                                            $supportSummary = $pendingMetadataProposalSummaries[$proposalId] ?? null;
                                            $canSupportProposal = $currentUser
                                                && (string)($proposal['actor_id'] ?? '') !== (string)($currentUser['id'] ?? '');
                                            ?>
                                            <div class="rounded-2xl border border-border bg-white px-3 py-2">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-bold text-text"><?php echo htmlspecialchars((string)($proposal['actor_name'] ?? '匿名')); ?></div>
                                                        <?php if (!empty($proposal['note'])): ?>
                                                            <div class="mt-1 text-[11px] text-muted leading-relaxed"><?php echo htmlspecialchars((string)$proposal['note']); ?></div>
                                                        <?php endif; ?>
                                                    </div>
                                                    <?php if ($canReviewObservationMeta): ?>
                                                        <div class="flex flex-wrap justify-end gap-1.5">
                                                            <button type="button"
                                                                @click="reviewMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>', 'accept')"
                                                                class="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-primary-dark">
                                                                採用
                                                            </button>
                                                            <button type="button"
                                                                @click="reviewMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>', 'reject')"
                                                                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-danger/30 hover:text-danger">
                                                                却下
                                                            </button>
                                                        </div>
                                                    <?php endif; ?>
                                                </div>
                                                <div class="mt-1 text-[11px] text-muted leading-relaxed">
                                                    <?php
                                                    $parts = [];
                                                    foreach (($proposal['changes'] ?? []) as $field => $change) {
                                                        $label = $fieldLabels[$field] ?? $field;
                                                        $parts[] = $label . ' → ' . (($change['to'] ?? '') === '' ? '未設定' : (string)($change['to'] ?? ''));
                                                    }
                                                    echo htmlspecialchars(implode(' / ', $parts));
                                                    ?>
                                                </div>
                                                <?php if ($supportSummary): ?>
                                                    <div class="mt-2 flex flex-wrap items-center gap-2">
                                                        <span class="inline-flex items-center rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary">
                                                            賛成 <?php echo (int)($supportSummary['support_count'] ?? 0); ?>件
                                                        </span>
                                                        <?php if (!empty($supportSummary['is_stale'])): ?>
                                                            <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                                                                放置観察のため、支持が集まると自動採用
                                                            </span>
                                                        <?php endif; ?>
                                                        <?php if (!empty($supportSummary['is_stale']) && empty($supportSummary['eligible_for_auto_accept'])): ?>
                                                            <span class="text-[11px] text-muted">
                                                                あと<?php echo max(1, (int)($supportSummary['needed_people'] ?? 0)); ?>人の支持で進みやすくなります
                                                            </span>
                                                        <?php endif; ?>
                                                        <?php if ($canSupportProposal): ?>
                                                            <button type="button"
                                                                @click="supportMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>')"
                                                                class="inline-flex items-center rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/5">
                                                                賛成する
                                                            </button>
                                                        <?php endif; ?>
                                                    </div>
                                                <?php endif; ?>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($metadataHistory)): ?>
                        <div class="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-2xl leading-none">🪴</span>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-emerald-900">この情報はこう育ちました</p>
                                    <p class="text-xs text-emerald-800/80 mt-1 leading-relaxed">環境や状態の情報は、投稿者とコミュニティの手で少しずつ育っていきます。最近の更新だけを表示しています。</p>
                                    <div class="mt-3 space-y-2">
                                        <?php foreach (array_slice($metadataHistory, 0, 3) as $history): ?>
                                            <?php
                                            $type = (string)($history['type'] ?? '');
                                            $label = match ($type) {
                                                'direct_edit' => '投稿者または管理側が更新',
                                                'metadata_proposal_accepted' => 'コミュニティ提案を採用',
                                                'metadata_proposal_rejected' => 'コミュニティ提案を見送り',
                                                default => '更新',
                                            };
                                            $reasonLabel = match ($type) {
                                                'metadata_proposal_accepted' => (($history['note'] ?? '') === 'community_support_auto_accept') ? '支持が集まったため採用' : '妥当と判断して採用',
                                                'metadata_proposal_rejected' => !empty($history['note']) ? '理由つきで見送り' : '写真だけでは判断保留',
                                                'direct_edit' => '投稿者または管理側が見直し',
                                                default => '更新理由あり',
                                            };
                                            $changes = [];
                                            foreach (($history['changes'] ?? []) as $field => $change) {
                                                $fieldMap = [
                                                    'biome' => '環境',
                                                    'organism_origin' => '由来',
                                                    'life_stage' => '状態',
                                                    'individual_count' => '個体数',
                                                    'managed_context_type' => '施設区分',
                                                    'managed_site_name' => '施設名',
                                                    'managed_context_note' => '施設メモ',
                                                ];
                                                $changes[] = ($fieldMap[$field] ?? $field) . ' → ' . (($change['to'] ?? '') === '' ? '未設定' : (string)($change['to'] ?? ''));
                                            }
                                            if ($changes === [] && !empty($history['after']) && !empty($history['before'])) {
                                                foreach (['biome' => '環境', 'organism_origin' => '由来', 'life_stage' => '状態', 'individual_count' => '個体数'] as $field => $fieldLabel) {
                                                    $before = $history['before'][$field] ?? null;
                                                    $after = $history['after'][$field] ?? null;
                                                    if ($before !== $after) {
                                                        $changes[] = $fieldLabel . ' → ' . (($after ?? '') === '' ? '未設定' : (string)$after);
                                                    }
                                                }
                                            }
                                            ?>
                                            <div class="rounded-2xl border border-emerald-200/70 bg-white px-3 py-2">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-bold text-emerald-900"><?php echo htmlspecialchars($label); ?></div>
                                                        <div class="mt-1 text-[11px] text-muted">
                                                            <?php echo htmlspecialchars((string)($history['actor_name'] ?? 'community')); ?>
                                                            ・
                                                            <?php echo htmlspecialchars(date('Y.m.d', strtotime((string)($history['at'] ?? 'now')))); ?>
                                                        </div>
                                                    </div>
                                                    <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100/70 px-2 py-1 text-[10px] font-bold text-emerald-800">
                                                        <?php echo htmlspecialchars($reasonLabel); ?>
                                                    </span>
                                                </div>
                                                <?php if (!empty($changes)): ?>
                                                    <div class="mt-1 text-[11px] text-muted leading-relaxed">
                                                        <?php echo htmlspecialchars(implode(' / ', $changes)); ?>
                                                    </div>
                                                <?php endif; ?>
                                                <?php if (!empty($history['note'])): ?>
                                                    <div class="mt-1 text-[11px] text-emerald-900/80 leading-relaxed">
                                                        <?php echo htmlspecialchars((string)$history['note']); ?>
                                                    </div>
                                                <?php endif; ?>
                                            </div>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <!-- Status badge when no consensus yet (unidentified) -->
                    <?php if (!isset($obs['consensus']) || empty($obs['identifications'])): ?>
                        <div class="mb-6 flex items-center gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/15">
                            <span class="text-2xl flex-shrink-0">🔍</span>
                            <div>
                                <div class="text-sm font-bold text-text">種名を特定中</div>
                                <div class="text-xs text-muted mt-0.5">あなたも名前の推測を投稿してみよう！</div>
                            </div>
                            <span class="ml-auto flex-shrink-0 text-orange-500 bg-orange-500/10 border-orange-500/20 text-token-xs font-bold px-2 py-1 rounded-full border">
                                未同定
                            </span>
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

                    <!-- Primary Action CTA -->
                    <div class="mt-6 flex gap-2">
                        <button @click="idModalOpen = true"
                            class="flex-1 py-3 rounded-xl bg-primary-dark hover:bg-primary text-white font-bold text-sm shadow-lg shadow-primary-glow/20 transition flex items-center justify-center gap-2 active:scale-[0.98]">
                            <span class="text-base">🤔</span>
                            名前を提案する
                        </button>
                    </div>
                </div>

                <!-- 2. Activity / Identification List -->
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h3 class="font-black text-base text-text flex items-center gap-2">
                            <span class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                                <i data-lucide="users" class="w-4 h-4 text-primary"></i>
                            </span>
                            みんなの推測ノート
                            <?php if (count($obs['identifications'] ?? []) > 0): ?>
                                <span class="text-token-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full"><?php echo count($obs['identifications']); ?></span>
                            <?php endif; ?>
                        </h3>
                        <button @click="idModalOpen = true"
                            class="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition border border-primary/20 active:scale-95">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            投稿する
                        </button>
                    </div>

                    <!-- Cards -->
                    <div id="id-list-container" class="space-y-3">
                        <?php if (empty($obs['identifications'])): ?>
                            <div class="text-center py-12 bg-surface rounded-2xl border border-border border-dashed">
                                <div class="text-5xl mb-4">🌱</div>
                                <p class="text-sm font-bold text-text mb-1">まだ推測コメントはありません</p>
                                <p class="text-xs text-muted mb-4">知っていることを気軽に書いてみよう。<br>小さなヒントも投稿者の助けになるよ！</p>
                                <button @click="idModalOpen = true"
                                    class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition border border-primary/20">
                                    <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                                    名前を提案してみる
                                </button>
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
                                <!-- Identification Card (Social Feed Style) -->
                                <div class="bg-surface rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
                                    x-data="inlineTaxonSelector('<?php echo htmlspecialchars($id); ?>')">

                                    <!-- Card Header: Avatar + User Info + Species Badge -->
                                    <div class="flex items-start gap-3">
                                        <img src="<?php echo htmlspecialchars($ident['user_avatar'] ?? 'https://i.pravatar.cc/100?u=' . $ident['user_id']); ?>"
                                            alt="<?php echo htmlspecialchars($ident['user_name'] ?? 'ユーザー'); ?>のアバター"
                                            class="w-10 h-10 rounded-full border-2 border-border shadow-sm flex-shrink-0 object-cover"
                                            loading="lazy">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="text-sm font-bold text-text"><?php echo htmlspecialchars($ident['user_name'] ?? 'Unknown'); ?></span>
                                                <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-token-xs font-bold border <?php echo $rankInfo['bg'] . ' ' . $rankInfo['color'] . ' ' . $rankInfo['border']; ?>">
                                                    <span><?php echo $rankInfo['icon']; ?></span>
                                                    <span><?php echo $rankInfo['name']; ?></span>
                                                </span>
                                                <?php if ($isMyId): ?>
                                                    <span class="text-token-xs bg-primary/20 text-primary-light px-2 py-0.5 rounded-full font-bold">あなた</span>
                                                <?php endif; ?>
                                            </div>
                                            <div class="text-token-xs text-muted mt-0.5"><?php echo BioUtils::timeAgo($ident['created_at']); ?></div>
                                        </div>
                                    </div>

                                    <!-- Species Identification Badge (Hero) -->
                                    <div class="mt-3 flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                                        <i data-lucide="tag" class="w-4 h-4 text-primary mt-0.5 flex-shrink-0"></i>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-base font-black text-primary-dark leading-tight"><?php echo htmlspecialchars($ident['taxon_name']); ?></div>
                                            <?php if (!empty($ident['scientific_name'])): ?>
                                                <div class="text-xs text-muted italic font-mono mt-0.5"><?php echo htmlspecialchars($ident['scientific_name']); ?></div>
                                            <?php endif; ?>
                                            <?php if (!empty($ident['life_stage']) && $ident['life_stage'] !== 'unknown'): ?>
                                                <?php $lsMap = ['adult' => '成体', 'juvenile' => '幼体', 'egg' => '卵等', 'trace' => '痕跡']; ?>
                                                <span class="inline-block mt-1 text-token-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-bold">
                                                    <?php echo htmlspecialchars($lsMap[$ident['life_stage']] ?? $ident['life_stage']); ?>
                                                </span>
                                            <?php endif; ?>
                                        </div>
                                    </div>

                                    <!-- Note (Comment Body) -->
                                    <?php if (!empty($ident['note'])): ?>
                                        <?php $isLong = strlen($ident['note']) > 450; ?>
                                        <div class="mt-3" x-data="{ expanded: false }">
                                            <div class="text-sm text-text leading-relaxed bg-elevated rounded-xl px-4 py-3 border border-border/50"
                                                :class="expanded ? '' : '<?php echo $isLong ? 'line-clamp-4' : ''; ?>'">
                                                <?php echo BioUtils::renderMarkdown($ident['note']); ?>
                                            </div>
                                            <?php if ($isLong): ?>
                                                <button @click="expanded = true" x-show="!expanded"
                                                    class="text-xs font-bold text-primary mt-1.5 ml-1 hover:underline">
                                                    もっと見る
                                                </button>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>

                                    <!-- Footer Actions -->
                                    <div class="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
                                        <?php if (!$isMyId): ?>
                                            <button @click="
                                                agreeTarget = {
                                                    name: '<?php echo htmlspecialchars($ident['taxon_name'], ENT_QUOTES); ?>',
                                                    key: '<?php echo htmlspecialchars($ident['taxon_key'] ?? '', ENT_QUOTES); ?>',
                                                    slug: '<?php echo htmlspecialchars($ident['taxon_slug'] ?? '', ENT_QUOTES); ?>',
                                                    sci: '<?php echo htmlspecialchars($ident['scientific_name'] ?? '', ENT_QUOTES); ?>'
                                                };
                                                agreeModalOpen = true;"
                                                class="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition px-3 py-1.5 rounded-full hover:bg-primary/10 border border-transparent hover:border-primary/20 active:scale-95">
                                                <i data-lucide="sprout" class="w-3.5 h-3.5"></i>
                                                <span>そうかも！</span>
                                            </button>
                                            <button @click="inlineDispute = !inlineDispute; if(inlineDispute) $nextTick(() => $refs.disputeInput && $refs.disputeInput.focus())"
                                                class="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger transition px-3 py-1.5 rounded-full hover:bg-danger/10 border border-transparent active:scale-95">
                                                <i data-lucide="git-merge" class="w-3.5 h-3.5"></i>
                                                <span>違うかも</span>
                                            </button>
                                        <?php endif; ?>
                                    </div>

                                    <!-- Inline Dispute Form -->
                                    <div x-show="inlineDispute" x-collapse x-cloak>
                                        <div class="mt-3 p-3 bg-danger/5 border border-danger/20 rounded-xl relative">
                                            <p class="text-token-xs text-danger font-bold mb-2 flex items-center gap-1">
                                                <i data-lucide="git-merge" class="w-3 h-3"></i>
                                                別の分類を提案する
                                            </p>
                                            <div class="flex items-center gap-2">
                                                <input type="text" x-ref="disputeInput" x-model="taxonQuery"
                                                    @input.debounce.300ms="search()"
                                                    @keydown.escape="inlineDispute = false"
                                                    class="flex-1 bg-surface border border-border rounded-lg p-2.5 text-sm text-text focus:outline-none focus:border-danger"
                                                    placeholder="種名を検索..." autocomplete="off">
                                                <button @click="submitDispute()" :disabled="!taxonSlug || submitting"
                                                    class="px-4 py-2 bg-danger text-white text-sm font-bold rounded-lg transition disabled:opacity-40 hover:bg-danger/90 active:scale-95">
                                                    <span x-text="submitting ? '送信中...' : '提案'"></span>
                                                </button>
                                            </div>
                                            <div x-show="showSugg && suggestions.length > 0" x-transition @click.away="showSugg = false"
                                                class="absolute left-3 right-3 top-[6.5rem] bg-surface border border-border rounded-xl overflow-hidden z-[60] shadow-xl max-h-48 overflow-y-auto">
                                                <template x-for="(s, i) in suggestions" :key="i">
                                                    <button type="button" @click="pick(s)"
                                                        class="w-full text-left px-4 py-2.5 hover:bg-danger/10 transition border-b border-border last:border-b-0">
                                                        <span class="text-sm font-bold text-text" x-text="s.jp_name"></span>
                                                        <span class="text-xs text-muted italic ml-2" x-text="s.sci_name"></span>
                                                    </button>
                                                </template>
                                            </div>
                                            <button @click="inlineDispute = false" class="mt-2 text-xs text-muted hover:text-text">キャンセル</button>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>

                    <?php
                    // ── Affiliate Books ──
                    $taxonForAffiliate = [
                        'slug'            => $obs['taxon']['slug'] ?? '',
                        'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                        'lineage'         => $obs['taxon']['lineage'] ?? [],
                    ];
                    $affiliateContext = 'observation';
                    $affiliateBooks = AffiliateManager::getBooks($taxonForAffiliate, $affiliateContext);
                    if (!empty($affiliateBooks)):
                    ?>
                        <?php include __DIR__ . '/components/affiliate_books.php'; ?>
                    <?php endif; ?>
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
            taxonLineage: {},
            taxonLineageIds: {},
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
                this.taxonGbifKey = s.gbif_key || s.key || null;
                this.taxonLineage = s.lineage || {};
                this.taxonLineageIds = s.lineage_ids || {};
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
                            lineage: this.taxonLineage || {},
                            lineage_ids: this.taxonLineageIds || {},
                            confidence: this.selectedConfidence,
                            life_stage: this.lifeStage,
                            note: this.note
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        // キャッシュを確実に回避してリロード
                        window.location.href = window.location.pathname + window.location.search + '&_t=' + Date.now();
                    } else {
                        alert('ごめん、うまく送れなかった 🙇\n' + (data.message || '時間を空けてもう一度試してみてね'));
                    }
                } catch(e) { alert('通信がうまくいかなかったみたい 📡\n電波の良い場所で試してみてね'); }
                this.submitting = false;
            }
         }">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="idModalOpen = false"></div>
        <div class="bg-surface w-full max-w-lg rounded-2xl border border-border shadow-2xl relative z-10 overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 pt-5 pb-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <i data-lucide="search" class="w-4 h-4 text-primary"></i>
                    </div>
                    <h2 class="text-lg font-black text-text">名前を提案する</h2>
                </div>
                <button @click="idModalOpen = false" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-surface-alt transition">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>

            <div class="px-6 pb-6 space-y-5">
                <!-- Taxon Search -->
                <div class="relative">
                    <label class="block text-xs font-bold text-muted mb-1.5">種名 (和名または学名)</label>
                    <div class="relative">
                        <input type="text" x-model="taxonQuery" @input.debounce.300ms="search()" @keydown.escape="showSugg = false"
                            class="w-full bg-surface border border-border rounded-xl p-3 pl-10 text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary pr-20 transition"
                            placeholder="例: ヤマシギ、Prunus" autocomplete="off">
                        <i data-lucide="search" class="w-4 h-4 text-muted absolute left-3 top-3.5 pointer-events-none"></i>
                        <div x-show="taxonSlug" class="absolute right-3 top-3">
                            <span class="text-[10px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i> 確定
                            </span>
                        </div>
                    </div>
                    <!-- Suggestions Dropdown -->
                    <div x-show="showSugg && suggestions.length > 0" x-transition @click.away="showSugg = false"
                        class="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl overflow-hidden z-50 shadow-xl max-h-52 overflow-y-auto">
                        <template x-for="(s, i) in suggestions" :key="i">
                            <button type="button" @click="pick(s)" class="w-full text-left px-4 py-2.5 hover:bg-primary/5 transition border-b border-border/50 last:border-b-0 flex items-baseline gap-2">
                                <span class="text-sm font-bold text-text" x-text="s.jp_name"></span>
                                <span class="text-xs text-muted italic" x-text="s.sci_name"></span>
                            </button>
                        </template>
                    </div>
                </div>

                <!-- Confidence -->
                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5">確信度</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button type="button" @click="selectedConfidence = 'sure'"
                            :class="selectedConfidence === 'sure' ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface border-border text-muted hover:border-border-hover'"
                            class="flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                            確信あり
                        </button>
                        <button type="button" @click="selectedConfidence = 'likely'"
                            :class="selectedConfidence === 'likely' ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface border-border text-muted hover:border-border-hover'"
                            class="flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition">
                            <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
                            たぶん
                        </button>
                        <button type="button" @click="selectedConfidence = 'unsure'"
                            :class="selectedConfidence === 'unsure' ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface border-border text-muted hover:border-border-hover'"
                            class="flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                            わからない
                        </button>
                    </div>
                </div>

                <!-- Life Stage -->
                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5">ライフステージ</label>
                    <div class="grid grid-cols-5 gap-1.5">
                        <template x-for="ls in [
                                {id: 'adult', label: '成体', emoji: '👑'},
                                {id: 'juvenile', label: '幼体', emoji: '🌱'},
                                {id: 'egg', label: '卵等', emoji: '🥚'},
                                {id: 'trace', label: '痕跡', emoji: '👣'},
                                {id: 'unknown', label: '不明', emoji: '❓'}
                            ]" :key="ls.id">
                            <button type="button" @click="lifeStage = ls.id"
                                :class="lifeStage === ls.id ? 'bg-primary/15 text-primary border-primary/40' : 'bg-surface border-border text-muted hover:border-border-hover'"
                                class="flex flex-col items-center py-2 rounded-xl border transition">
                                <span class="text-base" x-text="ls.emoji"></span>
                                <span class="text-[10px] font-bold mt-0.5" x-text="ls.label"></span>
                            </button>
                        </template>
                    </div>
                </div>

                <!-- Comment -->
                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5">コメント <span class="font-normal text-faint">(任意)</span></label>
                    <textarea x-model="note" rows="3" class="w-full bg-surface border border-border rounded-xl p-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition" placeholder="同定の根拠やコメント..."></textarea>
                </div>

                <!-- Submit -->
                <button @click="submit()" :disabled="submitting || !taxonQuery.trim()"
                    class="w-full py-3 rounded-xl bg-primary-dark hover:bg-primary text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]">
                    <template x-if="submitting"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></template>
                    <span x-text="submitting ? '送信中...' : '提案する'"></span>
                </button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
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
                taxonLineage: {},
                taxonLineageIds: {},
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
                    this.taxonGbifKey = s.gbif_key || s.key || null;
                    this.taxonLineage = s.lineage || {};
                    this.taxonLineageIds = s.lineage_ids || {};
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
                                lineage: this.taxonLineage || {},
                                lineage_ids: this.taxonLineageIds || {},
                                confidence: 'sure',
                                life_stage: 'unknown',
                                note: ''
                            })
                        });
                        const data = await res.json();
                        if (data.success) {
                            // キャッシュ回避で最新HTMLを取得してDOM部分更新
                            const freshUrl = window.location.pathname + window.location.search + '&_t=' + Date.now();
                            const htmlRes = await fetch(freshUrl, { credentials: 'include' });
                            const htmlText = await htmlRes.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(htmlText, 'text/html');
                            const newListEl = doc.querySelector('#id-list-container');
                            const container = document.querySelector('#id-list-container');
                            if (newListEl && container) {
                                container.innerHTML = newListEl.innerHTML;
                                if (window.lucide) window.lucide.createIcons();
                                // Alpine.js コンポーネントを再初期化
                                if (window.Alpine) Alpine.initTree(container);
                                // Visual feedback: 最新アイテムをハイライト
                                const firstItem = container.querySelector('div.relative.pl-6');
                                if (firstItem) {
                                    firstItem.classList.add('ring-1', 'ring-primary', 'bg-primary/5', 'transition-all', 'duration-1000');
                                    setTimeout(() => firstItem.classList.remove('ring-1', 'ring-primary', 'bg-primary/5'), 2000);
                                }
                            } else {
                                // フォールバック: フル再読み込み
                                window.location.href = freshUrl;
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
