<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/BioUtils.php';
require_once __DIR__ . '/../libs/Lang.php';
Lang::init();
require_once __DIR__ . '/../libs/RedList.php';
require_once __DIR__ . '/../libs/Invasive.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/PrivacyFilter.php';
require_once __DIR__ . '/../libs/DataQuality.php';
require_once __DIR__ . '/../libs/TrustLevel.php';
require_once __DIR__ . '/../libs/OmoikaneSearchEngine.php';
require_once __DIR__ . '/../libs/ObservationMeta.php';
require_once __DIR__ . '/../libs/AffiliateManager.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/ObservationSourceHelper.php';
require_once __DIR__ . '/../libs/CanonicalObservationView.php';
require_once __DIR__ . '/../libs/ObservationLearningGuidance.php';
require_once __DIR__ . '/../libs/IdentificationContributionFeedback.php';
Auth::init();
$currentUser = Auth::user();
$csrfToken = CSRF::generate();
$documentLang = Lang::current();

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

function resolveObservationMediaUrl(?string $path): ?string
{
    if (!is_string($path) || trim($path) === '') {
        return null;
    }

    if (strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0) {
        return $path;
    }

    return BASE_URL . '/' . ltrim($path, '/');
}

function buildObservationMediaItems(array $observation): array
{
    $items = [];
    $seen = [];
    $videoPosterPaths = [];
    $mediaAssets = array_values(array_filter($observation['media_assets'] ?? [], fn($asset) => is_array($asset)));

    foreach ($mediaAssets as $asset) {
        if (($asset['media_type'] ?? '') === 'video' && !empty($asset['poster_path'])) {
            $videoPosterPaths[(string)$asset['poster_path']] = true;
        }
        if (($asset['media_type'] ?? '') === 'video' && !empty($asset['thumbnail_url'])) {
            $videoPosterPaths[(string)$asset['thumbnail_url']] = true;
        }
    }

    foreach ($mediaAssets as $asset) {
        $type = (string)($asset['media_type'] ?? '');
        if ($type === 'video') {
            $uid = (string)($asset['provider_uid'] ?? '');
            if ($uid === '' || isset($seen['video:' . $uid])) {
                continue;
            }
            $seen['video:' . $uid] = true;
            $poster = resolveObservationMediaUrl($asset['poster_path'] ?? $asset['thumbnail_url'] ?? null);
            $items[] = [
                'type' => 'video',
                'uid' => $uid,
                'iframe_url' => $asset['iframe_url'] ?? null,
                'watch_url' => $asset['watch_url'] ?? null,
                'poster_url' => $poster,
                'duration_ms' => isset($asset['duration_ms']) ? (int)$asset['duration_ms'] : null,
                'label' => __('observation_page.video_label', 'Observation video'),
            ];
            continue;
        }

        if (!in_array($type, ['photo', 'image'], true)) {
            continue;
        }

        $path = (string)($asset['media_path'] ?? '');
        if ($path === '' || isset($videoPosterPaths[$path]) || isset($seen['photo:' . $path])) {
            continue;
        }
        $seen['photo:' . $path] = true;
        $items[] = [
            'type' => 'photo',
            'src' => resolveObservationMediaUrl($path),
            'label' => __('observation_page.photo_label', 'Observation photo'),
        ];
    }

    if ($items === []) {
        foreach (($observation['photos'] ?? []) as $photoPath) {
            if (!is_string($photoPath) || $photoPath === '' || isset($seen['photo:' . $photoPath])) {
                continue;
            }
            $seen['photo:' . $photoPath] = true;
            $items[] = [
                'type' => 'photo',
                'src' => resolveObservationMediaUrl($photoPath),
                'label' => __('observation_page.photo_label', 'Observation photo'),
            ];
        }
    }

    return $items;
}

// Get Observation
$id = $_GET['id'] ?? '';
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    http_response_code(404);
    echo "Observation not found";
    exit;
}

$obs = CanonicalObservationView::hydrate($obs);
$canonicalView = is_array($obs['canonical_view'] ?? null) ? $obs['canonical_view'] : ['enabled' => false];
$mediaItems = buildObservationMediaItems($obs);

// Increment View Count
DataStore::increment('observations', $id, 'views');

// Load Reactions
$_reactDir = DATA_DIR . '/reactions/' . $id;
$_reactTypes = ['footprint', 'like', 'suteki', 'manabi'];
$obsReactions = [];
$obsTotalReactions = 0;
foreach ($_reactTypes as $_rt) {
    $_rf = $_reactDir . '/' . $_rt . '.json';
    $_rl = file_exists($_rf) ? (json_decode(file_get_contents($_rf), true) ?: []) : [];
    $obsReactions[$_rt] = ['count' => count($_rl), 'reacted' => $currentUser && in_array($currentUser['id'], $_rl)];
    $obsTotalReactions += count($_rl);
}
if ($obsTotalReactions === 0) {
    $_legacyFile = DATA_DIR . '/likes/' . $id . '.json';
    if (file_exists($_legacyFile)) {
        $_ll = json_decode(file_get_contents($_legacyFile), true) ?: [];
        $obsReactions['footprint']['count'] = count($_ll);
        $obsReactions['footprint']['reacted'] = $currentUser && in_array($currentUser['id'], $_ll);
        $obsTotalReactions = count($_ll);
    }
}

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
    'high' => __('observation_page.ai_confidence_high', 'Quite confident'),
    'medium' => __('observation_page.ai_confidence_medium', 'Probably'),
    'low' => __('observation_page.ai_confidence_low', 'Cautious'),
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
        __('observation_page.ai_simple_summary_fallback', 'From what can be read in the photo, we have stopped at what can still be said safely.')
    );
    $latestAiAssessment['summary'] = normalizeAiDisplayText($latestAiAssessment['summary'] ?? null);
    $latestAiAssessment['why_not_more_specific'] = normalizeAiDisplayText($latestAiAssessment['why_not_more_specific'] ?? null);
    $latestAiAssessment['geographic_context'] = normalizeAiDisplayText($latestAiAssessment['geographic_context'] ?? null);
    $latestAiAssessment['seasonal_context'] = normalizeAiDisplayText($latestAiAssessment['seasonal_context'] ?? null);
    $latestAiAssessment['cautionary_note'] = normalizeAiDisplayText($latestAiAssessment['cautionary_note'] ?? null);
    $latestAiAssessment['observer_boost'] = normalizeAiDisplayText($latestAiAssessment['observer_boost'] ?? null);
    $latestAiAssessment['next_step'] = normalizeAiDisplayText(
        $latestAiAssessment['next_step'] ?? null,
        __('observation_page.ai_next_step_fallback', 'Additional angles or photos that show color and pattern will make the next narrowing easier.')
    );
    $latestAiAssessment['diagnostic_features_seen'] = normalizeAiDisplayList($latestAiAssessment['diagnostic_features_seen'] ?? []);
    $latestAiAssessment['missing_evidence'] = normalizeAiDisplayList($latestAiAssessment['missing_evidence'] ?? []);
}
$trustGuidance = BioUtils::buildTrustGuidance($obs);
$trustProgress = BioUtils::buildTrustProgress($obs);
$learningGuidance = ObservationLearningGuidance::build($obs, $latestAiAssessment);
$identificationFeedback = IdentificationContributionFeedback::buildForObservation($obs);
$identificationTimeline = IdentificationContributionFeedback::buildTimeline($obs, 4);
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

// Privacy-aware display coordinates
$isOwner = $currentUser && ($currentUser['id'] === ($obs['user_id'] ?? ''));
$filteredObs = PrivacyFilter::autoFilter($obs);
$displayLatRaw = $filteredObs['latitude'] ?? $filteredObs['lat'] ?? $obs['lat'] ?? null;
$displayLngRaw = $filteredObs['longitude'] ?? $filteredObs['lng'] ?? $obs['lng'] ?? null;
$displayLat = is_numeric($displayLatRaw) ? (float)$displayLatRaw : null;
$displayLng = is_numeric($displayLngRaw) ? (float)$displayLngRaw : null;
$hasDisplayCoordinates = $displayLat !== null && $displayLng !== null;
$privacyLayer = $filteredObs['privacy_layer'] ?? 'ambient';
$locationGranularity = (string)($obs['location_granularity'] ?? 'exact');
$privacyExplanationMap = [
    'exact' => __('observation_page.privacy_exact', 'Public-facing coordinates are rounded as an environmental layer. Only the owner and administrators can see the original precision.'),
    'municipality' => __('observation_page.privacy_municipality', 'Public coordinates are rounded to municipality level.'),
    'prefecture' => __('observation_page.privacy_prefecture', 'Public coordinates are rounded to prefecture level.'),
    'hidden' => __('observation_page.privacy_hidden', 'Public coordinates are hidden. Only the region name is shown.'),
];
$privacyExplanation = $privacyExplanationMap[$locationGranularity] ?? $privacyExplanationMap['exact'];
$returnToDetail = 'observation_detail.php?id=' . rawurlencode($id);
$revisitRecordUrl = 'post.php?' . http_build_query(['return' => $returnToDetail]);
$revisitCollectionUrl = $currentUser ? 'profile.php' : 'explore.php';
$revisitCollectionLabel = $currentUser
    ? __('observation_page.revisit_collection_profile', 'Review in My places')
    : __('observation_page.revisit_collection_explore', 'See nearby records');
$revisitBody = $myFieldName
    ? __('observation_page.revisit_body_my_field', 'This spot is inside your My Field "{field}". One more dated record here makes seasonal change easier to compare later.', ['field' => $myFieldName])
    : __('observation_page.revisit_body_default', 'One more dated record from the same place makes it easier to compare season, condition, and review progress later.');

// Obscure location
$location = $hasDisplayCoordinates
    ? BioUtils::getObscuredLocation($displayLat, $displayLng, null)
    : ($obs['municipality'] ?? ($obs['prefecture'] ?? __('observation_page.location_hidden', 'Location hidden')));

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
    $jp_display_name = match($taxon_rank) {
        'genus' => $family_jp . ' ' . $scientific_name . '属',
        'family' => $family_jp,
        'species' => $family_jp . 'の一種',
        default => $family_jp . 'の仲間',
    };
}

$seo_name = $jp_display_name ?: ($species_name ?? __('observation_page.unresolved_default', 'Unresolved'));
$seo_sci = ($scientific_name && $scientific_name !== $seo_name && !str_contains($seo_name, $scientific_name)) ? $scientific_name : null;
$obsTimestamp = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now');
$obsDateText = $documentLang === 'ja' ? date('Y年n月j日', $obsTimestamp) : date('F j, Y', $obsTimestamp);
$obs_place = $obs['municipality'] ?? ($obs['prefecture'] ?? '');
$taxonomy_breadcrumb = implode(' > ', array_filter([
    $lineage['kingdom'] ?? null,
    $lineage['phylum'] ?? null,
    $lineage['class'] ?? null,
    $lineage['order'] ?? null,
    $family_jp ? $family_jp . ' (' . $family_name . ')' : ($family_name ?? null),
]));

// --- OGP Meta ---
$metaSciPart = $seo_sci ? " ($seo_sci)" : '';
$metaPlacePart = $obs_place ? ' - ' . $obs_place : '';
$metaTitleTemplate = __('observation_page.meta_title', '{name}{sci_part} observation record{place_part}');
$meta_title = strtr($metaTitleTemplate, [
    '{name}' => $seo_name,
    '{sci_part}' => $metaSciPart,
    '{place_part}' => $metaPlacePart,
]);
$metaDescriptionTemplate = __('observation_page.meta_description', 'A record of {name}{sci_part} observed on {date}{place_clause}. {taxonomy_clause}Citizen science biodiversity platform ikimon.life.');
$metaTaxonomyClause = $taxonomy_breadcrumb
    ? strtr(__('observation_page.meta_taxonomy_clause', 'Classification: {taxonomy}. '), ['{taxonomy}' => $taxonomy_breadcrumb])
    : '';
$metaPlaceClause = $obs_place
    ? strtr(__('observation_page.meta_place_clause', ' in {place}'), ['{place}' => $obs_place])
    : '';
$meta_description = strtr($metaDescriptionTemplate, [
    '{name}' => $seo_name,
    '{sci_part}' => $metaSciPart,
    '{date}' => $obsDateText,
    '{place_clause}' => $metaPlaceClause,
    '{taxonomy_clause}' => $metaTaxonomyClause,
]);
if (!empty($mediaItems)) {
    $firstMedia = $mediaItems[0];
    $meta_image = $firstMedia['type'] === 'video'
        ? ($firstMedia['poster_url'] ?? null)
        : ($firstMedia['src'] ?? null);
}
$meta_canonical = 'https://ikimon.life/observation_detail.php?id=' . urlencode($id);
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
    /* M3 tokens loaded via tokens.css */
    .m3-chip{border:1px solid var(--md-outline);border-radius:var(--shape-full);color:var(--md-on-surface-variant);background:transparent;position:relative;overflow:hidden;}
    .m3-chip.selected{background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent;}
    </style>

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
            'name' => strtr(__('observation_page.jsonld_name', '{name} observation record'), [
                '{name}' => $seo_name,
            ]),
            'description' => $meta_description,
            'url' => $meta_canonical,
            'identifier' => $id,
            'dateCreated' => $obs['observed_at'] ?? $obs['created_at'] ?? null,
            'about' => $taxonLd,
        ];
        if ($hasDisplayCoordinates) {
            $jsonLd['contentLocation'] = [
                '@type' => 'Place',
                'name' => $obs_place ?: null,
                'geo' => [
                    '@type' => 'GeoCoordinates',
                    'latitude' => round($displayLat, 2),
                    'longitude' => round($displayLng, 2),
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
            'description' => __('meta.organization_description', 'Citizen science biodiversity platform. Build a long-term archive of nearby nature through observation records.'),
        ];
        $jsonLd = array_filter($jsonLd, fn($v) => $v !== null);
        echo json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_HEX_TAG);
        ?>
    </script>

    <!-- MapLibre -->
    <?php include __DIR__ . '/components/map_config.php'; ?>
</head>

<body class="js-loading font-body min-h-screen antialiased" style="background:var(--md-surface);color:var(--md-on-surface);" x-data="{ idModalOpen: false, photoActive: 0, lightbox: false, touchStart: 0, touchEnd: 0, locationName: '<?php echo htmlspecialchars($obs['municipality'] ?? ($obs['prefecture'] ?? ''), ENT_QUOTES); ?>' }" x-init="
    <?php if ($hasDisplayCoordinates): ?>
    fetch('https://nominatim.openstreetmap.org/reverse?lat=<?php echo round($displayLat, 2); ?>&lon=<?php echo round($displayLng, 2); ?>&format=json&accept-language=<?php echo rawurlencode($documentLang); ?>&zoom=10')
        .then(r => r.json())
        .then(d => { if (d.address) { const city = d.address.city || d.address.town || d.address.village || d.address.county || ''; const state = d.address.state || ''; locationName = city ? city + (state ? ', ' + state : '') : (state || locationName); } })
        .catch(() => {});
    <?php endif; ?>
    },
    async submitAgree(target) {
        if(!confirm('<?= addslashes(__('observation_page.agree_confirm_prefix', 'Agree with \"{name}\"?')) ?>'.replace('{name}', target.name) + '\n<?= addslashes(__('observation_page.agree_confirm_note', '(Your agreement affects the trust level of this record.)')) ?>')) return;
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
                alert('<?= addslashes(__('observation_page.error_prefix', 'An error occurred: ')) ?>' + (data.message || '<?= addslashes(__('observation_page.error_unknown', 'Unknown error')) ?>'));
            }
        } catch(e) { alert('<?= addslashes(__('observation_page.network_error_short', 'Network error')) ?>'); }
    },
    async reviewMetadataProposal(proposalId, action) {
        const labels = { accept: '<?= addslashes(__('observation_page.accept', 'Accept')) ?>', reject: '<?= addslashes(__('observation_page.reject', 'Reject')) ?>' };
        if(!confirm('<?= addslashes(__('observation_page.review_proposal_confirm', 'Apply this proposal as \"{action}\"?')) ?>'.replace('{action}', (labels[action] || action))) ) return;
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
                alert('<?= addslashes(__('observation_page.error_prefix_short', 'Error: ')) ?>' + (data.message || '<?= addslashes(__('observation_page.processing_failed', 'Could not process the request.')) ?>'));
            }
        } catch (e) {
            alert('<?= addslashes(__('observation_page.network_error_short', 'Network error')) ?>');
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
                alert('<?= addslashes(__('observation_page.error_prefix_short', 'Error: ')) ?>' + (data.message || '<?= addslashes(__('observation_page.processing_failed', 'Could not process the request.')) ?>'));
            }
        } catch (e) {
            alert('<?= addslashes(__('observation_page.network_error_short', 'Network error')) ?>');
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
                    <?= __('observation_page.home', 'Home') ?>
                </a>
                <span class="text-faint">/</span>
                <span class="text-text font-medium"><?= __('observation_page.detail', 'Observation details') ?></span>
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
                <!-- Main Media Carousel -->
                <div class="relative bg-black rounded-2xl overflow-hidden shadow-2xl border border-border group aspect-[4/3] flex items-center justify-center"
                    @click="lightbox = true"
                    @touchstart="touchStart = $event.changedTouches[0].screenX"
                    @touchend="touchEnd = $event.changedTouches[0].screenX; let diff = touchStart - touchEnd; if(Math.abs(diff) > 50) { photoActive = diff > 0 ? (photoActive + 1) % <?php echo max(1, count($mediaItems)); ?> : (photoActive - 1 + <?php echo max(1, count($mediaItems)); ?>) % <?php echo max(1, count($mediaItems)); ?>; }">
                    <?php if (!empty($mediaItems)): ?>
                        <?php foreach ($mediaItems as $idx => $media): ?>
                            <?php if (($media['type'] ?? '') === 'video'): ?>
                                <div class="absolute inset-0 transition-all duration-500"
                                    :class="photoActive === <?php echo $idx; ?> ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'">
                                    <iframe src="<?php echo htmlspecialchars((string)($media['iframe_url'] ?? '')); ?>"
                                        title="<?php echo htmlspecialchars(__('observation_page.video_alt', 'Observation video {index}', ['index' => $idx + 1])); ?>"
                                        class="w-full h-full"
                                        loading="<?php echo $idx === 0 ? 'eager' : 'lazy'; ?>"
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowfullscreen></iframe>
                                </div>
                            <?php else: ?>
                                <img src="<?php echo htmlspecialchars((string)($media['src'] ?? '')); ?>"
                                    class="absolute inset-0 w-full h-full object-contain transition-all duration-500"
                                    :class="photoActive === <?php echo $idx; ?> ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'"
                                    alt="<?php echo htmlspecialchars(__('observation_page.photo_alt', 'Observation photo {index}', ['index' => $idx + 1])); ?>" loading="<?php echo $idx === 0 ? 'eager' : 'lazy'; ?>">
                            <?php endif; ?>
                        <?php endforeach; ?>

                        <!-- Navigation Arrows -->
                        <?php if (count($mediaItems) > 1): ?>
                    <button @click.stop="photoActive = (photoActive - 1 + <?php echo count($mediaItems); ?>) % <?php echo count($mediaItems); ?>" aria-label="<?= __('observation_page.prev_photo', 'Previous media') ?>" class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
                                <i data-lucide="chevron-left" class="w-5 h-5"></i>
                            </button>
                    <button @click.stop="photoActive = (photoActive + 1) % <?php echo count($mediaItems); ?>" aria-label="<?= __('observation_page.next_photo', 'Next media') ?>" class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition z-20 opacity-0 group-hover:opacity-100">
                                <i data-lucide="chevron-right" class="w-5 h-5"></i>
                            </button>
                            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full z-20">
                                <?php foreach ($mediaItems as $idx => $p): ?>
                                    <button @click.stop="photoActive = <?php echo $idx; ?>" class="w-2.5 h-2.5 rounded-full transition-all" :class="photoActive === <?php echo $idx; ?> ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'"></button>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <div class="text-muted flex flex-col items-center">
                            <i data-lucide="image-off" class="w-12 h-12 mb-2"></i>
                            <span class="text-xs"><?= __('observation_page.no_photo', 'No media') ?></span>
                        </div>
                    <?php endif; ?>
                </div>

                <!-- Lightbox -->
                <div x-show="lightbox" x-cloak x-transition.opacity class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2" role="dialog" aria-modal="true" aria-labelledby="obs-lightbox-title"
                    @keydown.window.left.prevent="photoActive = (photoActive - 1 + <?php echo max(1, count($mediaItems)); ?>) % <?php echo max(1, count($mediaItems)); ?>"
                    @keydown.window.right.prevent="photoActive = (photoActive + 1) % <?php echo max(1, count($mediaItems)); ?>"
                    @keydown.window.escape.prevent="lightbox = false">
                    <h2 id="obs-lightbox-title" class="sr-only"><?= __('observation_page.photo_gallery', 'Observation media') ?></h2>
                    <button @click.stop="lightbox = false" aria-label="<?= __('observation_page.close', 'Close') ?>" class="absolute top-4 right-4 text-white p-2 bg-white/10 rounded-full z-[101] hover:bg-white/20 transition">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                    <?php if (!empty($mediaItems)): ?>
                        <?php foreach ($mediaItems as $idx => $media): ?>
                            <?php if (($media['type'] ?? '') === 'video'): ?>
                                <div x-show="photoActive === <?php echo $idx; ?>" class="w-full h-full max-w-5xl max-h-[85vh]">
                                    <iframe src="<?php echo htmlspecialchars((string)($media['iframe_url'] ?? '')); ?>"
                                        title="<?php echo htmlspecialchars(__('observation_page.video_alt', 'Observation video {index}', ['index' => $idx + 1])); ?>"
                                        class="w-full h-full"
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowfullscreen></iframe>
                                </div>
                            <?php else: ?>
                                <img src="<?php echo htmlspecialchars((string)($media['src'] ?? '')); ?>" x-show="photoActive === <?php echo $idx; ?>" alt="<?php echo htmlspecialchars(__('observation_page.photo_alt', 'Observation photo {index}', ['index' => $idx + 1])); ?>" class="max-w-full max-h-full object-contain pointer-events-none select-none">
                            <?php endif; ?>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>

                <!-- Thumbnails -->
                <?php if (!empty($mediaItems) && count($mediaItems) > 1): ?>
                    <div class="flex gap-2 overflow-x-auto scrollbar-hide mt-3">
                        <?php foreach ($mediaItems as $idx => $media): ?>
                            <button @click.stop="photoActive = <?php echo $idx; ?>" type="button" class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition" :class="photoActive === <?php echo $idx; ?> ? 'border-primary scale-105' : 'border-transparent opacity-50'">
                            <?php if (($media['type'] ?? '') === 'video'): ?>
                                <div class="relative w-full h-full">
                                    <img src="<?php echo htmlspecialchars((string)($media['poster_url'] ?? '')); ?>" alt="<?php echo htmlspecialchars(__('observation_page.video_alt', 'Observation video {index}', ['index' => $idx + 1])); ?>" class="w-full h-full object-cover" loading="lazy">
                                    <span class="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                                        <i data-lucide="play" class="w-4 h-4"></i>
                                    </span>
                                </div>
                            <?php else: ?>
                                <img src="<?php echo htmlspecialchars((string)($media['src'] ?? '')); ?>" alt="<?php echo htmlspecialchars(__('observation_page.photo_alt', 'Observation photo {index}', ['index' => $idx + 1])); ?>" class="w-full h-full object-cover" loading="lazy">
                            <?php endif; ?>
                            </button>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <!-- Owner Narrative -->
                <?php $observerName = $obs['user_display_name'] ?? $obs['user_name'] ?? $obs['user']['display_name'] ?? $obs['user']['name'] ?? BioUtils::getUserName($obs['user_id']); ?>
                <div class="mt-4" style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="<?php echo htmlspecialchars($obs['user_avatar'] ?? '/assets/img/default-avatar.svg'); ?>"
                            alt="<?php echo htmlspecialchars(__('observation_page.user_avatar_alt', '{name} avatar', ['name' => $observerName ?? ''])); ?>"
                            class="w-10 h-10 rounded-full border-2 border-border shadow-sm object-cover flex-shrink-0"
                            onerror="this.src='/assets/img/default-avatar.svg'">
                        <div>
                            <div class="text-sm font-bold text-text leading-none"><?php echo htmlspecialchars($observerName); ?></div>
                            <div class="text-token-xs text-muted mt-0.5">
                                <?php echo date('Y年m月d日 H:i', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now')); ?>
                                <?php if (!empty($obs['location']['name'])): ?>
                                    · <?php echo htmlspecialchars($obs['location']['name']); ?>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-text leading-relaxed">
                        <?php echo !empty($obs['note']) ? BioUtils::renderMarkdown($obs['note']) : '<span class="text-muted italic">' . htmlspecialchars(__('observation_page.no_note', 'No observation note')) . '</span>'; ?>
                    </p>
                </div>

                <?php if ($managedContextType !== '' || !empty($managedContext['site_name']) || $organismOrigin !== ''): ?>
                    <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);">
                        <div class="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest"><?= __('observation_page.context_title', 'Record context') ?></p>
                                <h3 class="text-sm font-bold text-text mt-1"><?= __('observation_page.context_heading', 'Facility origin and wildness') ?></h3>
                            </div>
                            <span class="text-[10px] font-bold px-2 py-1 rounded-full <?php echo ($obs['archive_track'] ?? 'wild_occurrence') === 'managed_collection' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'; ?>">
                                <?php echo ($obs['archive_track'] ?? 'wild_occurrence') === 'managed_collection' ? __('observation_page.context_managed', 'Managed collection') : __('observation_page.context_wild', 'Field record'); ?>
                            </span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.origin', 'Origin') ?></p>
                                <p class="font-bold text-text"><?php echo htmlspecialchars($organismOriginLabelMap[$organismOrigin] ?? $organismOrigin); ?></p>
                            </div>
                            <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.facility_context', 'Facility context') ?></p>
                                <p class="font-bold text-text"><?php echo htmlspecialchars($managedContextLabelMap[$managedContextType] ?? ($managedContextType !== '' ? $managedContextType : __('observation_page.none', 'None'))); ?></p>
                                <?php if (!empty($managedContext['site_name'])): ?>
                                    <p class="text-xs text-muted mt-1"><?php echo htmlspecialchars($managedContext['site_name']); ?></p>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php if (!empty($managedContext['note'])): ?>
                            <p class="mt-3 text-sm text-muted leading-relaxed"><?php echo htmlspecialchars($managedContext['note']); ?></p>
                        <?php endif; ?>
                        <p class="mt-3 text-[11px] text-faint"><?= __('observation_page.context_note', 'Even inside facilities, wild individuals are stored as wild. Facility context is preserved separately from field distribution so provenance can be traced 100 years from now.') ?></p>
                    </section>
                <?php endif; ?>

                <?php if ($latestAiAssessment || in_array(($obs['ai_assessment_status'] ?? ''), ['pending', 'queued'], true)): ?>
                    <section style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest"><?= __('observation_page.hint_title', 'Observation hints') ?></p>
                                <h3 class="text-sm font-bold text-text mt-1"><?= __('observation_page.hint_heading', 'Notes for narrowing it down together') ?></h3>
                            </div>
                            <?php if ($latestAiAssessment): ?>
                                <?php if ($latestAiFallback): ?>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning"><?= __('observation_page.hint_unresolved', 'Not narrowed down yet') ?></span>
                                <?php else: ?>
                                    <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">
                                        <?php echo htmlspecialchars($aiConfidenceLabelMap[$latestAiAssessment['confidence_band'] ?? 'low'] ?? ($latestAiAssessment['confidence_band'] ?? 'low')); ?>
                                    </span>
                                <?php endif; ?>
                            <?php else: ?>
                                <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-warning/10 text-warning"><?= __('observation_page.hint_pending', 'Pending analysis') ?></span>
                            <?php endif; ?>
                        </div>
                        <?php if ($latestAiAssessment): ?>
                            <?php if ($latestAiFallback): ?>
                                <div style="background:var(--md-tertiary-container);border-radius:var(--shape-xl);padding:1rem;margin-bottom:0.75rem;">
                                    <p class="text-[10px] font-black text-warning uppercase tracking-widest mb-1"><?= __('observation_page.hint_ai_unresolved', 'AI alone has not narrowed it down yet') ?></p>
                                    <p class="text-sm text-text leading-relaxed">
                                        <?php echo htmlspecialchars($latestAiAssessment['simple_summary'] ?? '写真だけではまだ方向を絞りきれていません。'); ?>
                                    </p>
                                    <p class="text-[11px] text-muted mt-2"><?= __('observation_page.hint_ai_unresolved_body', 'Additional identifications from others or better diagnostic photos will move it forward.') ?></p>
                                </div>
                            <?php endif; ?>
                            <?php $recommended = $latestAiAssessment['recommended_taxon'] ?? null; ?>
                            <?php
                                $aiHints = array_values(array_filter([
                                    !empty($latestAiAssessment['geographic_context']) ? __('observation_page.label_place', 'Place') . ': ' . $latestAiAssessment['geographic_context'] : null,
                                    !empty($latestAiAssessment['seasonal_context']) ? __('observation_page.label_season', 'Season') . ': ' . $latestAiAssessment['seasonal_context'] : null,
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
                                    $recommendedDisplayName = $recommended['name'] ?? __('observation_page.unresolved', 'Unresolved');
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
                                <div style="background:var(--md-primary-container);border-radius:var(--shape-xl);padding:1rem;margin-bottom:0.75rem;">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <p class="text-[10px] font-black text-primary uppercase tracking-widest mb-1"><?= __('observation_page.ai_narrowed_title', 'This is as narrow as we can get for now') ?></p>
                                            <p class="text-lg font-black text-text leading-tight">
                                                <?php echo htmlspecialchars($recommendedDisplayName); ?>
                                            </p>
                                            <?php if ($isLatinOnly || ($recommendedScientific !== '' && $recommendedScientific !== $recommendedDisplayName)): ?>
                                                <p class="text-xs text-muted italic"><?php echo htmlspecialchars($recommendedScientific); ?></p>
                                            <?php endif; ?>
                                            <p class="text-sm text-muted mt-1"><?php echo htmlspecialchars($recommendedRankLabel); ?><?= __('observation_page.ai_rank_suffix', 'is probably close enough') ?></p>
                                            <?php
                                                $bestSpecificTaxon = is_array($latestAiAssessment['best_specific_taxon'] ?? null) ? $latestAiAssessment['best_specific_taxon'] : null;
                                                $hasNarrowerHypothesis = $bestSpecificTaxon && (($bestSpecificTaxon['id'] ?? null) !== ($recommended['id'] ?? null));
                                            ?>
                                            <?php if ($hasNarrowerHypothesis): ?>
                                                <p class="text-[12px] text-muted mt-2">
                                                    <?= __('observation_page.ai_best_candidate_prefix', 'Among the candidates') ?> <?php echo htmlspecialchars(($bestSpecificTaxon['name'] ?? __('observation_page.unresolved', 'Unresolved')) . ' (' . ($bestSpecificTaxon['rank'] ?? 'unknown') . ')'); ?> <?= __('observation_page.ai_best_candidate_suffix', 'looks closest') ?>
                                                </p>
                                            <?php endif; ?>
                                        </div>
                                        <div class="shrink-0 flex flex-col items-end gap-2">
                                            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-primary/20 text-primary">
                                            <?php echo htmlspecialchars($recommendedRankLabel); ?><?= __('observation_page.ai_until_rank', 'level') ?>
                                            </span>
                                            <?php if (!empty($latestAiAssessment['photo_count_used'])): ?>
                                                <span class="text-[11px] font-bold px-2 py-1 rounded-full bg-white border border-border text-faint">
                                            <?php echo (int)$latestAiAssessment['photo_count_used']; ?><?= __('observation_page.ai_photo_count_suffix', 'photos used') ?>
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
                                <?php
                                $hasSimilar = !empty($latestAiAssessment['similar_taxa_to_compare']);
                                $hasTips    = !empty($latestAiAssessment['distinguishing_tips']);
                                $hasMissing = !empty($latestAiAssessment['missing_evidence']);
                                if ($hasSimilar || $hasTips || $hasMissing):
                                ?>
                                    <div class="space-y-3" style="background:var(--md-tertiary-container);border-radius:var(--shape-md);padding:0.75rem;border-left:4px solid var(--color-primary);">
                                        <p class="text-[10px] font-black text-primary uppercase tracking-widest"><?= __('observation_page.identify_priority', 'Identification keys') ?></p>
                                        <?php if ($hasTips): ?>
                                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.ai_distinguishing_tips', 'How to tell them apart') ?></p>
                                                <ul class="mt-1 space-y-1">
                                                    <?php foreach ($latestAiAssessment['distinguishing_tips'] as $tip): ?>
                                                        <li class="flex items-start gap-1.5 text-xs text-text leading-snug">
                                                            <span class="mt-0.5 text-faint shrink-0">·</span>
                                                            <span><?php echo htmlspecialchars($tip); ?></span>
                                                        </li>
                                                    <?php endforeach; ?>
                                                </ul>
                                            </div>
                                        <?php endif; ?>
                                        <?php if ($hasSimilar): ?>
                                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.ai_similar_species', 'Confusingly similar species') ?> <span class="font-normal normal-case">（<?= __('observation_page.ai_reference', 'AI reference') ?>）</span></p>
                                                <div class="flex flex-wrap gap-2">
                                                    <?php foreach ($latestAiAssessment['similar_taxa_to_compare'] as $candidateName): ?>
                                                        <span class="inline-flex items-center rounded-full bg-white border border-border px-3 py-1 text-xs text-text">
                                                            <?php echo htmlspecialchars((string)$candidateName); ?>
                                                        </span>
                                                    <?php endforeach; ?>
                                                </div>
                                            </div>
                                        <?php endif; ?>
                                        <?php if ($hasMissing): ?>
                                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?php echo $hasTips ? __('observation_page.ai_confirm_more', 'If you want to confirm more') : __('observation_page.ai_missing_evidence', 'Missing evidence to check'); ?></p>
                                                <div class="flex flex-wrap gap-1.5 mt-1">
                                                    <?php foreach ($latestAiAssessment['missing_evidence'] as $point): ?>
                                                        <span class="inline-flex items-center rounded-md bg-white border border-border px-2 py-0.5 text-xs text-text">
                                                            <?php echo htmlspecialchars($point); ?>
                                                        </span>
                                                    <?php endforeach; ?>
                                                </div>
                                            </div>
                                        <?php endif; ?>
                            <p class="text-[10px] text-muted">※ <?= __('observation_page.ai_reference_note', 'This is AI reference information. For confirmation, we recommend detailed observation of the real specimen and checking field guides.') ?></p>
                                    </div>
                                <?php endif; ?>
                                <div class="grid gap-3 sm:grid-cols-2">
                                    <?php if (!empty($latestAiAssessment['diagnostic_features_seen'])): ?>
                                        <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.ai_seen_features', 'Clues visible in the photo') ?></p>
                                            <p class="text-text leading-relaxed"><?php echo htmlspecialchars(implode(' / ', $latestAiAssessment['diagnostic_features_seen'])); ?></p>
                                        </div>
                                    <?php endif; ?>
                                    <?php if (!empty($latestAiAssessment['why_not_more_specific'])): ?>
                                        <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-1"><?= __('observation_page.ai_stop_reason', 'Why we stop here') ?></p>
                                            <p class="text-muted leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['why_not_more_specific']); ?></p>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                <?php if (!empty($aiHints)): ?>
                                    <div style="background:var(--md-primary-container);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-2"><?= __('observation_page.ai_place_season_hints', 'Place and season hints') ?></p>
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
                                    <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.5rem 0.75rem;border-left:3px solid var(--color-primary);">
                                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1"><?= __('observation_page.ai_observer_boost', 'What this observation already helps with') ?></p>
                                        <p class="text-primary leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['observer_boost']); ?></p>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['next_step'])): ?>
                                    <div style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:0.5rem 0.75rem;">
                                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1"><?= __('observation_page.ai_next_step', 'What would help narrow it next') ?></p>
                                        <p class="text-gray-700 leading-relaxed"><?php echo htmlspecialchars($latestAiAssessment['next_step']); ?></p>
                                    </div>
                                <?php endif; ?>
                                <?php if (!empty($latestAiAssessment['fun_fact']['body'])): ?>
                                    <div style="background:var(--md-tertiary-container);border-radius:var(--shape-md);padding:0.75rem;">
                                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1"><?= __('observation_page.ai_fun_fact', 'Fun fact') ?></p>
                                        <p class="text-gray-700 leading-relaxed text-sm"><?php echo htmlspecialchars($latestAiAssessment['fun_fact']['body']); ?></p>
                                        <?php if (!empty($latestAiAssessment['fun_fact']['search_keyword'])): ?>
                                            <a href="https://www.google.com/search?q=<?php echo urlencode($latestAiAssessment['fun_fact']['search_keyword']); ?>" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                                                <i data-lucide="search" class="w-3 h-3" style="pointer-events:none"></i>
                                <?php echo htmlspecialchars($latestAiAssessment['fun_fact']['search_keyword']); ?> <?= __('observation_page.ai_search_keyword', 'Search for it') ?>
                                            </a>
                                        <?php endif; ?>
                                <p class="text-[10px] text-gray-400 mt-2">※ <?php echo !empty($latestAiAssessment['fun_fact_grounded']) ? __('observation_page.ai_grounded_prefix', 'Based on field guide data') : ''; ?><?= __('observation_page.ai_generated_note', 'This information was generated by AI. Please verify accuracy yourself.') ?></p>
                                    </div>
                                <?php endif; ?>

                                <?php if ($scientific_name): ?>
                                <div x-data="speciesInsights('<?php echo htmlspecialchars($scientific_name, ENT_QUOTES); ?>')"
                                     x-show="hasInsights" x-cloak class="space-y-2">
                                    <template x-for="group in priorityGroups" :key="group.type">
                                        <div :style="'background:' + groupStyle(group.type).bg + ';border-radius:var(--shape-md);padding:0.75rem;'">
                                            <p class="text-[10px] font-black uppercase tracking-widest mb-1"
                                               :style="'color:' + groupStyle(group.type).label">
                                                <span x-text="groupStyle(group.type).icon" class="mr-0.5"></span>
                                                <span x-text="group.label"></span>
                                            </p>
                                            <ul class="space-y-1">
                                                <template x-for="(claim, ci) in group.claims.slice(0, 3)" :key="ci">
                                                    <li class="flex items-start gap-1.5 text-xs text-text leading-snug">
                                                        <span class="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                              :class="claim.source_tier === 'A' ? 'bg-green-400' : 'bg-amber-400'"></span>
                                                        <span x-text="claim.text"></span>
                                                    </li>
                                                </template>
                                            </ul>
                                            <template x-if="group.claims.length > 3">
                                                <p class="text-[10px] text-gray-400 mt-1" x-text="'+ ' + (group.claims.length - 3) + '件'"></p>
                                            </template>
                                        </div>
                                    </template>
                                    <p class="text-[10px] text-gray-400">
                                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-0.5 align-middle"></span>査読済
                                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-0.5 ml-2 align-middle"></span>百科事典
                                        — いきもの知恵袋
                                    </p>
                                </div>
                                <?php endif; ?>

                            </div>
                        <p class="mt-3 text-[11px] text-faint"><?= __('observation_page.ai_footer_note', 'This note is reference information to help move the observation forward. It does not count as a community identification vote.') ?></p>
                        <?php else: ?>
                        <p class="text-sm text-muted leading-relaxed"><?= __('observation_page.ai_pending_body', 'We are preparing the reference note after posting. When it is ready, clues seen in the photo and information that will help narrow it further will appear here.') ?></p>
                        <?php endif; ?>
                    </section>
                <?php endif; ?>

                <?php if (!empty($learningGuidance['cards'])): ?>
                    <section class="mt-4" style="background:var(--md-primary-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-[10px] font-black text-faint uppercase tracking-widest"><?= htmlspecialchars((string)($learningGuidance['section_title'] ?? __('observation_page.learning_section_title', 'Turn this observation into learning'))) ?></p>
                                <p class="text-sm text-text leading-relaxed mt-1"><?= htmlspecialchars((string)($learningGuidance['section_body'] ?? '')) ?></p>
                            </div>
                            <span class="text-xl leading-none">🧠</span>
                        </div>
                        <div class="mt-4 grid gap-3 md:grid-cols-3">
                            <?php foreach ($learningGuidance['cards'] as $card): ?>
                                <div class="rounded-2xl bg-white/90 border border-white/80 px-4 py-3">
                                    <div class="flex items-start gap-2">
                                        <span class="text-lg leading-none"><?php echo htmlspecialchars((string)($card['icon'] ?? '')); ?></span>
                                        <div class="min-w-0">
                                            <p class="text-xs font-black text-faint uppercase tracking-widest"><?php echo htmlspecialchars((string)($card['title'] ?? '')); ?></p>
                                            <p class="mt-2 text-sm text-text leading-relaxed"><?php echo htmlspecialchars((string)($card['body'] ?? '')); ?></p>
                                            <?php if (!empty($card['note'])): ?>
                                                <p class="mt-2 text-xs text-muted leading-relaxed"><?php echo htmlspecialchars((string)$card['note']); ?></p>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </section>
                <?php endif; ?>

                <!-- License -->
                <div class="text-xs text-muted mt-4 px-2">
                    <div class="p-3 flex items-center gap-3" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
                        <i data-lucide="creative-commons" class="w-4 h-4 text-faint"></i>
                        <div>
                            <span class="font-bold text-faint">CC BY-NC 4.0</span>
                            <span class="ml-2"><?= __('observation_page.photographer', 'Photographer') ?>: <?php echo htmlspecialchars($observerName); ?></span>
                        </div>
                    </div>

                    <!-- Reactions -->
                    <div class="mt-3" x-data="{
                        reactions: <?php echo json_encode($obsReactions, JSON_HEX_TAG | JSON_HEX_AMP); ?>,
                        total: <?php echo (int)$obsTotalReactions; ?>,
                        emojis: {footprint:'👣', like:'❤️', suteki:'✨', manabi:'🔬'},
                        labels: {
                            footprint:'<?= addslashes(__('observation_page.reaction_footprint', 'Footprint')) ?>',
                            like:'<?= addslashes(__('observation_page.reaction_like', 'Like')) ?>',
                            suteki:'<?= addslashes(__('observation_page.reaction_suteki', 'Lovely')) ?>',
                            manabi:'<?= addslashes(__('observation_page.reaction_manabi', 'Learned')) ?>'
                        },
                        async react(type) {
                            const prev = this.reactions[type].reacted;
                            this.reactions[type].reacted = !prev;
                            this.reactions[type].count += prev ? -1 : 1;
                            this.total += prev ? -1 : 1;
                            if (!prev && window.SoundManager) SoundManager.play('light-click');
                            try {
                                const res = await fetch('/api/toggle_like.php', {
                                    method: 'POST',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({id: '<?php echo htmlspecialchars($id, ENT_QUOTES); ?>', type})
                                });
                                const data = await res.json();
                                if (data.success) { this.reactions = data.reactions; this.total = data.total; }
                            } catch (err) {}
                        }
                    }">
                        <div class="flex items-center gap-1 p-1" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
                            <template x-for="[type, emoji] in Object.entries(emojis)" :key="type">
                                <button @click="react(type)"
                                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all hover:bg-elevated active:scale-90"
                                    :class="reactions[type].reacted ? 'bg-primary/10' : ''">
                                    <span class="text-lg" x-text="emoji"></span>
                                    <span class="text-xs font-bold"
                                        :class="reactions[type].reacted ? 'text-primary' : 'text-muted'"
                                        x-text="labels[type]"></span>
                                    <span class="text-xs font-bold ml-0.5"
                                        :class="reactions[type].reacted ? 'text-primary' : 'text-faint'"
                                        x-show="reactions[type].count > 0"
                                        x-text="reactions[type].count"></span>
                                </button>
                            </template>
                        </div>
                    </div>

                    <!-- Share Buttons -->
                    <div class="mt-3 flex items-center gap-2" x-data="{ copied: false }">
                        <span class="text-token-xs text-faint font-bold uppercase tracking-wider mr-1"><?= __('observation_page.share', 'Share') ?></span>
                        <?php
                        $shareUrl = 'https://ikimon.life/observation_detail.php?id=' . urlencode($id);
                        $shareText = ($species_name ?? __('observation_page.living_thing', 'Living thing')) . ' ' . __('observation_page.share_record_suffix', 'observation record') . ' — ikimon.life';
                        ?>
                        <a href="https://twitter.com/intent/tweet?url=<?php echo urlencode($shareUrl); ?>&text=<?php echo urlencode($shareText); ?>"
                            target="_blank" rel="noopener noreferrer"
                            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black hover:text-white hover:border-black transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                            title="<?= __('observation_page.share_x', 'Share on X') ?>">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </a>
                        <a href="https://social-plugins.line.me/lineit/share?url=<?php echo urlencode($shareUrl); ?>"
                            target="_blank" rel="noopener noreferrer"
                            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#06C755] hover:text-white hover:border-[#06C755] transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                            title="<?= __('observation_page.share_line', 'Share on LINE') ?>">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                        </a>
                        <button @click="navigator.clipboard.writeText('<?php echo $shareUrl; ?>').then(() => { copied = true; setTimeout(() => copied = false, 2000); })"
                            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary hover:text-white hover:border-primary transition relative" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                            title="<?= __('observation_page.share_copy', 'Copy URL') ?>">
                            <i data-lucide="link" class="w-3.5 h-3.5" x-show="!copied"></i>
                            <i data-lucide="check" class="w-3.5 h-3.5" x-show="copied" x-cloak></i>
                        </button>
                        <template x-if="navigator.share">
                            <button @click="navigator.share({ title: '<?php echo htmlspecialchars(($species_name ?? __('observation_page.living_thing', 'Living thing')) . ' ' . __('observation_page.share_observation_suffix', 'observation'), ENT_QUOTES); ?>', url: '<?php echo $shareUrl; ?>' })"
                                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent hover:text-white hover:border-accent transition" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);"
                                title="<?= __('observation_page.share_more', 'More share options') ?>">
                                <i data-lucide="share-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Info & Activity (LG: 5 cols - ~42%) -->
            <div class="lg:col-span-5 flex flex-col gap-8">

                <?php
                // ── ソース別情報セクション ──
                $_detailSrc     = ObservationSourceHelper::getSource($obs);
                $_detailSrcMeta = ObservationSourceHelper::getMeta($_detailSrc);
                $_detailDetMeta = ObservationSourceHelper::getDetectionMeta($obs);
                ?>

                <?php if ($_detailSrc === 'ikimon_sensor' || $_detailSrc === 'fieldscan'): ?>
                <!-- AIセンサー記録の詳細情報 -->
                <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);overflow:hidden;box-shadow:var(--elev-1);">

                    <!-- ヘッダー -->
                    <div class="px-5 py-4 flex items-center gap-3 border-b" style="border-color:rgba(0,0,0,0.06);">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center <?php echo $_detailSrcMeta['color_class']; ?> border <?php echo $_detailSrcMeta['border_color_class']; ?>">
                            <i data-lucide="<?php echo $_detailSrcMeta['icon']; ?>" class="w-4 h-4 <?php echo $_detailSrcMeta['text_color_class']; ?>"></i>
                        </div>
                        <div>
                            <p class="text-xs font-black uppercase tracking-widest text-faint">記録方法</p>
                            <p class="text-sm font-bold text-text"><?php echo htmlspecialchars($_detailSrcMeta['label']); ?></p>
                        </div>
                        <div class="ml-auto">
                            <?php echo ObservationSourceHelper::renderBadge($_detailSrc, true); ?>
                        </div>
                    </div>

                    <!-- 説明 -->
                    <div class="px-5 py-4">
                        <p class="text-xs text-muted leading-relaxed"><?php echo htmlspecialchars($_detailSrcMeta['description']); ?></p>
                        <?php if ($_detailSrcMeta['evidence_note']): ?>
                            <p class="text-xs text-faint mt-1.5 leading-relaxed">📋 <?php echo htmlspecialchars($_detailSrcMeta['evidence_note']); ?></p>
                        <?php endif; ?>
                    </div>

                    <!-- AI検出の詳細 -->
                    <?php if ($_detailDetMeta['confidence'] > 0 || $_detailDetMeta['engine_label']): ?>
                    <div class="px-5 pb-4 grid grid-cols-2 gap-3">

                        <?php if ($_detailDetMeta['confidence'] > 0): ?>
                        <div class="rounded-xl p-3" style="background:var(--md-surface-container-low);">
                            <p class="text-[10px] font-bold text-faint uppercase tracking-wider mb-2">AI確信度</p>
                            <div class="flex items-center gap-2">
                                <div class="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                                    <div class="h-full rounded-full"
                                        style="width:<?php echo round($_detailDetMeta['confidence'] * 100); ?>%;background:<?php echo $_detailDetMeta['confidence'] >= 0.7 ? '#10b981' : ($_detailDetMeta['confidence'] >= 0.4 ? '#f59e0b' : '#ef4444'); ?>;">
                                    </div>
                                </div>
                                <span class="text-sm font-black <?php echo $_detailDetMeta['conf_label']['class']; ?>">
                                    <?php echo round($_detailDetMeta['confidence'] * 100); ?>%
                                </span>
                            </div>
                            <p class="text-[10px] <?php echo $_detailDetMeta['conf_label']['class']; ?> font-bold mt-1"><?php echo htmlspecialchars($_detailDetMeta['conf_label']['text']); ?></p>
                        </div>
                        <?php endif; ?>

                        <?php if ($_detailDetMeta['engine_label']): ?>
                        <div class="rounded-xl p-3" style="background:var(--md-surface-container-low);">
                            <p class="text-[10px] font-bold text-faint uppercase tracking-wider mb-2">推論エンジン</p>
                            <p class="text-sm font-bold text-text"><?php echo htmlspecialchars($_detailDetMeta['engine_label']); ?></p>
                            <p class="text-[10px] text-faint mt-1">
                                <?php echo $_detailDetMeta['emoji']; ?> <?php echo htmlspecialchars($_detailDetMeta['label']); ?>
                                <?php if ($_detailDetMeta['is_batch']): ?>· バッチ評価済<?php endif; ?>
                            </p>
                        </div>
                        <?php endif; ?>

                        <?php if ($_detailDetMeta['is_tier_1_5']): ?>
                        <div class="col-span-2 rounded-xl p-3 border border-emerald-400/30" style="background:rgba(16,185,129,0.06);">
                            <div class="flex items-center gap-2">
                                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
                                <p class="text-xs font-bold text-emerald-700">Evidence Tier 1.5 — 機械合意による自動昇格</p>
                            </div>
                            <p class="text-[10px] text-muted mt-1">BirdNET v2.4 と Perch v2 の両エンジンが同一種を独立して確認しました。</p>
                        </div>
                        <?php endif; ?>

                    </div>
                    <?php endif; ?>

                    <?php if ($_detailSrc === 'fieldscan'): ?>
                    <!-- フィールドスキャン固有: 環境センサーデータ -->
                    <?php
                    $envSnap = $obs['environment_snapshot'] ?? $obs['env_snapshot'] ?? [];
                    $hasSensorData = !empty($envSnap) || isset($obs['ndsi']) || isset($obs['temp_celsius']);
                    ?>
                    <?php if ($hasSensorData): ?>
                    <div class="px-5 pb-4">
                        <p class="text-[10px] font-bold text-faint uppercase tracking-wider mb-2">環境センサーデータ</p>
                        <div class="grid grid-cols-2 gap-2">
                            <?php if (!empty($envSnap['habitat'])): ?>
                                <div class="rounded-lg px-3 py-2" style="background:var(--md-surface-container-low);">
                                    <p class="text-[10px] text-muted">生息環境</p>
                                    <p class="text-xs font-bold text-text"><?php echo htmlspecialchars($envSnap['habitat']); ?></p>
                                </div>
                            <?php endif; ?>
                            <?php if (isset($envSnap['canopy_cover'])): ?>
                                <div class="rounded-lg px-3 py-2" style="background:var(--md-surface-container-low);">
                                    <p class="text-[10px] text-muted">林冠被覆率</p>
                                    <p class="text-xs font-bold text-text"><?php echo (int)$envSnap['canopy_cover']; ?>%</p>
                                </div>
                            <?php endif; ?>
                            <?php if (isset($obs['ndsi'])): ?>
                                <div class="rounded-lg px-3 py-2" style="background:var(--md-surface-container-low);">
                                    <p class="text-[10px] text-muted">音響指数 (NDSI)</p>
                                    <p class="text-xs font-bold text-text"><?php echo round((float)$obs['ndsi'], 3); ?></p>
                                </div>
                            <?php endif; ?>
                            <?php if (isset($obs['temp_celsius'])): ?>
                                <div class="rounded-lg px-3 py-2" style="background:var(--md-surface-container-low);">
                                    <p class="text-[10px] text-muted">気温</p>
                                    <p class="text-xs font-bold text-text"><?php echo round((float)$obs['temp_celsius'], 1); ?>°C</p>
                                </div>
                            <?php endif; ?>
                            <?php if (!empty($envSnap['disturbance'])): ?>
                                <div class="rounded-lg px-3 py-2" style="background:var(--md-surface-container-low);">
                                    <p class="text-[10px] text-muted">撹乱レベル</p>
                                    <p class="text-xs font-bold text-text"><?php echo htmlspecialchars($envSnap['disturbance']); ?></p>
                                </div>
                            <?php endif; ?>
                        </div>
                        <p class="text-[10px] text-faint mt-2">🌍 このデータは100年アーカイブとして永続保存されます</p>
                    </div>
                    <?php endif; ?>
                    <?php endif; ?>

                </div>

                <?php elseif ($_detailSrc === 'post'): ?>
                <!-- フィールドノート: 証拠・信頼性バッジ -->
                <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);overflow:hidden;box-shadow:var(--elev-1);">
                    <div class="px-5 py-4 flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full flex items-center justify-center bg-blue-500/15 border border-blue-400/30">
                            <i data-lucide="camera" class="w-4 h-4 text-blue-700"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs font-black uppercase tracking-widest text-faint">記録方法</p>
                            <p class="text-sm font-bold text-text">フィールドノート</p>
                            <p class="text-xs text-muted mt-0.5">あなたが現場で撮影した写真による観察記録です。</p>
                        </div>
                        <?php echo ObservationSourceHelper::renderBadge($_detailSrc, true); ?>
                    </div>
                    <?php if (!empty($obs['quality_flags'])): ?>
                    <div class="px-5 pb-4">
                        <p class="text-[10px] font-bold text-faint uppercase tracking-wider mb-2">データ品質フラグ</p>
                        <div class="flex flex-wrap gap-1.5">
                            <?php
                            $qfLabels = [
                                'has_media'    => ['📷', '写真あり'],
                                'has_location' => ['📍', '位置情報あり'],
                                'has_date'     => ['📅', '日時あり'],
                                'is_wild'      => ['🌿', '野生個体'],
                            ];
                            foreach ($qfLabels as $flag => [$emoji, $label]):
                                if (!empty($obs['quality_flags'][$flag])):
                            ?>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 text-green-700 border border-green-400/20 font-bold">
                                    <?php echo $emoji; ?> <?php echo $label; ?>
                                </span>
                            <?php
                                endif;
                            endforeach;
                            ?>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>

                <?php if (!empty($trustGuidance['steps']) && ($trustGuidance['status'] ?? '') !== '種レベル研究用'): ?>
                    <div style="background:var(--md-primary-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);">
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
                <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1.5rem;box-shadow:var(--elev-2);" class="relative overflow-hidden">
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
                            <?php echo htmlspecialchars($species_name ?? __('observation_page.species_pending', 'Species pending')); ?>
                        <?php endif; ?>
                    </h1>
                    <div class="text-sm text-muted font-serif italic mb-3">
                        <?php echo htmlspecialchars($scientific_name ?? ''); ?>
                        <?php if ($speciesLink): ?>
                            <a href="<?php echo htmlspecialchars($speciesLink); ?>" class="text-primary/70 hover:text-primary ml-2 text-token-xs font-sans not-italic font-bold">📖 <?= __('observation_page.guide', 'Guide') ?></a>
                        <?php endif; ?>
                    </div>

                    <!-- Badges: Red List & Invasive -->
                    <div class="flex flex-wrap gap-2 mb-6">
                        <?php if ($redlist): ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-danger/10 text-danger border border-danger/20">
                                <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                                <?= __('observation_page.red_list', 'Red list') ?>: <?php echo htmlspecialchars($redlist['category'] ?? __('observation_page.red_list_matched', 'Matched')); ?>
                            </span>
                        <?php endif; ?>
                        <?php if ($invasive): ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-warning/10 text-warning border border-warning/20">
                                <i data-lucide="shield-alert" class="w-3 h-3"></i>
                                <?= __('observation_page.invasive', 'Invasive species') ?>
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
                            'adult' => ['label' => __('observation_page.life_stage_adult', 'Adult'), 'icon' => 'crown', 'color' => 'primary'],
                            'juvenile' => ['label' => __('observation_page.life_stage_juvenile', 'Juvenile'), 'icon' => 'sprout', 'color' => 'primary-light'],
                            'egg' => ['label' => __('observation_page.life_stage_egg', 'Egg / seed'), 'icon' => 'circle-dot', 'color' => 'accent'],
                            'trace' => ['label' => __('observation_page.life_stage_trace', 'Trace'), 'icon' => 'footprints', 'color' => 'secondary'],
                            'larva' => ['label' => __('observation_page.life_stage_larva', 'Larva'), 'icon' => 'sprout', 'color' => 'primary-light'],
                            'pupa' => ['label' => __('observation_page.life_stage_pupa', 'Pupa'), 'icon' => 'package', 'color' => 'accent'],
                            'exuviae' => ['label' => __('observation_page.life_stage_exuviae', 'Exuviae'), 'icon' => 'ghost', 'color' => 'secondary'],
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
                                <?= __('observation_page.state_cultivated', 'Cultivated / captive') ?>
                            </span>
                        <?php endif; ?>
                        <?php
                        $iCount = $obs['individual_count'] ?? null;
                        if ($iCount !== null):
                            $countLabels = [1 => '1', 3 => '2〜5', 8 => '6〜10', 30 => '11〜50', 51 => '50+'];
                            $countLabel = $countLabels[$iCount] ?? $iCount;
                        ?>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-token-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20" title="<?= __('observation_page.individual_count_title', 'Number of individuals confirmed nearby (reference value)') ?>">
                                <i data-lucide="hash" class="w-3 h-3"></i>
                                <?php echo htmlspecialchars($countLabel); ?> <?= __('observation_page.individual_count_unit', 'individuals') ?>
                            </span>
                        <?php endif; ?>
                    </div>

                    <?php if (!empty($canonicalView['enabled'])): ?>
                        <div class="mb-4">
                            <span class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
                                <i data-lucide="database" class="w-3.5 h-3.5"></i>
                                Canonical read pilot
                                <span class="text-emerald-600/70">occurrence <?php echo htmlspecialchars((string)($canonicalView['occurrence_id'] ?? ''), ENT_QUOTES); ?></span>
                            </span>
                        </div>
                    <?php endif; ?>

                    <?php if ($canEditObservation || $canSuggestObservationMeta): ?>
                        <div class="mb-6 flex flex-wrap gap-2">
                            <a href="/edit_observation.php?id=<?php echo urlencode($id); ?>"
                                class="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-text transition hover:border-primary/30 hover:text-primary">
                                <i data-lucide="<?php echo $canEditObservation ? 'pencil' : 'sparkles'; ?>" class="w-3.5 h-3.5"></i>
                                <?php echo $canEditObservation ? __('observation_page.edit_observation', 'Edit observation data') : __('observation_page.suggest_metadata', 'Suggest environment or condition'); ?>
                            </a>
                            <?php if ($canEditObservation): ?>
                            <button type="button" @click="$dispatch('open-add-photo')"
                                class="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-bold text-text transition hover:border-primary/30 hover:text-primary">
                                <i data-lucide="image-plus" class="w-3.5 h-3.5"></i>
                                <?= __('observation_page.add_photo', 'Add photo') ?>
                            </button>
                            <?php endif; ?>
                            <?php if (!empty($pendingMetadataProposals)): ?>
                                <span class="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-bold text-primary">
                                    <i data-lucide="messages-square" class="w-3.5 h-3.5"></i>
                                    <?= __('observation_page.structured_proposals', 'Structured proposals') ?> <?php echo count($pendingMetadataProposals); ?><?= __('observation_page.items_suffix', 'items') ?>
                                </span>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <!-- Core Attributes -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                <i data-lucide="map-pin" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-token-xs text-muted uppercase tracking-wider"><?= __('observation_page.label_place', 'Place') ?></div>
                                <div class="text-sm font-bold text-text" x-text="locationName"><?= __('observation_page.loading', 'Loading...') ?></div>
                                <?php if ($isOwner && $privacyLayer === 'private'): ?>
                                    <div class="text-[9px] text-primary flex items-center gap-1 mt-0.5"><i data-lucide="eye" class="w-2.5 h-2.5"></i> <?= __('observation_page.owner_exact_location', 'Only you can see the exact location') ?></div>
                                <?php endif; ?>
                                <div class="text-[9px] text-faint mt-1 leading-relaxed"><?php echo htmlspecialchars($privacyExplanation, ENT_QUOTES); ?></div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:var(--md-surface-container-low);color:var(--md-on-surface-variant);">
                                <i data-lucide="calendar" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <div class="text-token-xs text-muted uppercase tracking-wider"><?= __('observation_page.observed_at', 'Observed at') ?></div>
                                <div class="text-sm font-bold text-text"><?php echo date('Y.m.d H:i', strtotime($obs['observed_at'])); ?></div>
                            </div>
                        </div>
                    </div>

                    <!-- Consensus Display (Simplified) -->
                    <?php $idCount = count($obs['identifications'] ?? []); ?>
                    <?php if ($idCount > 0): ?>
                        <?php $agreementRate = round(($obs['consensus']['agreement_rate'] ?? 0) * 100); ?>
                        <div class="mb-6 flex items-center gap-3 p-3" style="background:var(--md-primary-container);border-radius:var(--shape-md);">
                            <span class="text-2xl flex-shrink-0">
                                <?php echo in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true) ? '🏆' : '🔍'; ?>
                            </span>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-bold text-text">
                                    <?php echo $idCount; ?><?= __('observation_page.identification_people_suffix', 'people joined the identification') ?>
                                    <?php if ($species_name && $agreementRate >= 60): ?>
                                        · <?php echo $agreementRate; ?>% <?= __('observation_page.agreement', 'agreement') ?>
                                    <?php endif; ?>
                                </div>
                                <div class="text-xs text-muted mt-0.5">
                                    <?php if (in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true)): ?>
                                        <?= __('observation_page.consensus_ready', 'This record has community consensus') ?>
                                    <?php else: ?>
                                        <?= __('observation_page.consensus_pending', 'Listen to everyone and identify the species name together') ?>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <span class="flex-shrink-0 <?php echo in_array(($obs['status'] ?? ''), ['研究用', '種レベル研究用', '研究利用可'], true) ? 'text-primary bg-primary/10 border-primary/20' : 'text-gray-500 bg-gray-100 border-gray-200'; ?> text-token-xs font-bold px-2 py-1 rounded-full border">
                                <?php echo htmlspecialchars($obs['status']); ?>
                            </span>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($trustGuidance['steps'])): ?>
                        <div class="mb-6" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:1rem;">
                            <div class="flex items-start gap-3">
                                <span class="text-2xl leading-none">🧭</span>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-gray-900"><?php echo htmlspecialchars($trustGuidance['headline']); ?></p>
                                    <p class="text-xs text-gray-600 mt-1 leading-relaxed"><?php echo htmlspecialchars($trustGuidance['body']); ?></p>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <?php foreach ($trustGuidance['steps'] as $step): ?>
                                            <span class="inline-flex items-center rounded-full bg-white border border-emerald-100 px-3 py-1 text-xs text-gray-700">
                                                <?php echo htmlspecialchars($step); ?>
                                            </span>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($trustProgress)): ?>
                        <div class="mb-6" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);padding:1rem;">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                        <p class="text-sm font-bold text-gray-900"><?php echo htmlspecialchars((string)($trustProgress['headline'] ?? __('observation_page.trust_progress_headline', 'Progress toward trusted status'))); ?></p>
                                    <p class="text-xs text-gray-500 mt-1 leading-relaxed"><?php echo htmlspecialchars((string)($trustProgress['next_label'] ?? '')); ?></p>
                                </div>
                                <span class="inline-flex items-center rounded-full bg-white border border-emerald-100 px-3 py-1 text-xs font-black text-primary">
                                    <?php echo (int)($trustProgress['progress'] ?? 0); ?>%
                                </span>
                            </div>
                            <div class="mt-3 h-2 rounded-full bg-white/80 overflow-hidden">
                                <div class="h-full rounded-full bg-primary" style="width: <?php echo (int)($trustProgress['progress'] ?? 0); ?>%"></div>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-2">
                                <?php foreach (($trustProgress['checkpoints'] ?? []) as $checkpoint): ?>
                                    <div class="rounded-2xl border px-3 py-2 <?php echo !empty($checkpoint['complete']) ? 'border-emerald-100 bg-white text-gray-800' : 'border-gray-100 bg-white/80 text-gray-600'; ?>">
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
                <p class="text-sm font-bold text-text"><?= __('observation_page.community_structured', 'Structured information has been suggested') ?></p>
                <p class="text-xs text-muted mt-1 leading-relaxed"><?= __('observation_page.community_structured_body', 'Other people have suggested updates about environment and life stage. The original record is kept intact while only the interpretation grows.') ?></p>
                                    <div class="mt-3 space-y-2">
                                        <?php foreach (array_slice($pendingMetadataProposals, 0, 3) as $proposal): ?>
                                            <?php
                                            $fieldLabels = [
                            'biome' => __('observation_page.field_biome', 'Biome'),
                            'organism_origin' => __('observation_page.field_origin', 'Origin'),
                            'life_stage' => __('observation_page.field_state', 'Condition'),
                            'individual_count' => __('observation_page.field_count', 'Count'),
                            'managed_context_type' => __('observation_page.field_facility_type', 'Facility type'),
                            'managed_site_name' => __('observation_page.field_facility_name', 'Facility name'),
                            'managed_context_note' => __('observation_page.field_facility_note', 'Facility note'),
                                            ];
                                            $proposalId = (string)($proposal['id'] ?? '');
                                            $supportSummary = $pendingMetadataProposalSummaries[$proposalId] ?? null;
                                            $canSupportProposal = $currentUser
                                                && (string)($proposal['actor_id'] ?? '') !== (string)($currentUser['id'] ?? '');
                                            ?>
                                            <div class="rounded-2xl border border-border bg-white px-3 py-2">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-bold text-text"><?php echo htmlspecialchars((string)($proposal['actor_name'] ?? __('observation_page.anonymous', 'Anonymous'))); ?></div>
                                                        <?php if (!empty($proposal['note'])): ?>
                                                            <div class="mt-1 text-[11px] text-muted leading-relaxed"><?php echo htmlspecialchars((string)$proposal['note']); ?></div>
                                                        <?php endif; ?>
                                                    </div>
                                                    <?php if ($canReviewObservationMeta): ?>
                                                        <div class="flex flex-wrap justify-end gap-1.5">
                                                            <button type="button"
                                                                @click="reviewMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>', 'accept')"
                                                                class="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-primary-dark">
                                                                <?= __('observation_page.accept', 'Accept') ?>
                                                            </button>
                                                            <button type="button"
                                                                @click="reviewMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>', 'reject')"
                                                                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-danger/30 hover:text-danger">
                                                                <?= __('observation_page.reject', 'Reject') ?>
                                                            </button>
                                                        </div>
                                                    <?php endif; ?>
                                                </div>
                                                <div class="mt-1 text-[11px] text-muted leading-relaxed">
                                                    <?php
                                                    $parts = [];
                                                    foreach (($proposal['changes'] ?? []) as $field => $change) {
                                                        $label = $fieldLabels[$field] ?? $field;
                                                        $parts[] = $label . ' → ' . (($change['to'] ?? '') === '' ? __('observation_page.unset', 'Unset') : (string)($change['to'] ?? ''));
                                                    }
                                                    echo htmlspecialchars(implode(' / ', $parts));
                                                    ?>
                                                </div>
                                                <?php if ($supportSummary): ?>
                                                    <div class="mt-2 flex flex-wrap items-center gap-2">
                                                        <span class="inline-flex items-center rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary">
                                                            <?= __('observation_page.support', 'Support') ?> <?php echo (int)($supportSummary['support_count'] ?? 0); ?><?= __('observation_page.items_suffix', 'items') ?>
                                                        </span>
                                                        <?php if (!empty($supportSummary['is_stale'])): ?>
                                                            <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                                                                <?= __('observation_page.auto_accept_stale', 'For older observations, it is auto-accepted when enough support gathers') ?>
                                                            </span>
                                                        <?php endif; ?>
                                                        <?php if (!empty($supportSummary['is_stale']) && empty($supportSummary['eligible_for_auto_accept'])): ?>
                                                            <span class="text-[11px] text-muted">
                                                                <?= __('observation_page.more_support_prefix', 'Need ') ?><?php echo max(1, (int)($supportSummary['needed_people'] ?? 0)); ?><?= __('observation_page.more_support_suffix', ' more supporters to move forward') ?>
                                                            </span>
                                                        <?php endif; ?>
                                                        <?php if ($canSupportProposal): ?>
                                                            <button type="button"
                                                                @click="supportMetadataProposal('<?php echo htmlspecialchars($proposalId, ENT_QUOTES); ?>')"
                                                                class="inline-flex items-center rounded-full border border-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/5">
                                                                <?= __('observation_page.support_action', 'Support') ?>
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
                <p class="text-sm font-bold text-emerald-900"><?= __('observation_page.history_title', 'How this information grew') ?></p>
                <p class="text-xs text-emerald-800/80 mt-1 leading-relaxed"><?= __('observation_page.history_body', 'Environment and condition information grows little by little through the poster and the community. Only the latest updates are shown here.') ?></p>
                                    <div class="mt-3 space-y-2">
                                        <?php foreach (array_slice($metadataHistory, 0, 3) as $history): ?>
                                            <?php
                                            $type = (string)($history['type'] ?? '');
                                            $label = match ($type) {
                                                'direct_edit' => __('observation_page.history_direct_edit', 'Updated by poster or admin'),
                                                'metadata_proposal_accepted' => __('observation_page.history_accepted', 'Community proposal accepted'),
                                                'metadata_proposal_rejected' => __('observation_page.history_rejected', 'Community proposal declined'),
                                                default => __('observation_page.history_updated', 'Updated'),
                                            };
                                            $reasonLabel = match ($type) {
                                                'metadata_proposal_accepted' => (($history['note'] ?? '') === 'community_support_auto_accept') ? __('observation_page.history_reason_auto_accept', 'Accepted because enough support gathered') : __('observation_page.history_reason_accepted', 'Accepted as reasonable'),
                                                'metadata_proposal_rejected' => !empty($history['note']) ? __('observation_page.history_reason_rejected', 'Declined with a reason') : __('observation_page.history_reason_hold', 'Still on hold from photo evidence alone'),
                                                'direct_edit' => __('observation_page.history_reason_reviewed', 'Reviewed by poster or admin'),
                                                default => __('observation_page.history_reason_updated', 'Has an update reason'),
                                            };
                                            $changes = [];
                                            foreach (($history['changes'] ?? []) as $field => $change) {
                                                $fieldMap = [
                                                    'biome' => __('observation_page.field_biome', 'Biome'),
                                                    'organism_origin' => __('observation_page.field_origin', 'Origin'),
                                                    'life_stage' => __('observation_page.field_state', 'Condition'),
                                                    'individual_count' => __('observation_page.field_count', 'Count'),
                                                    'managed_context_type' => __('observation_page.field_facility_type', 'Facility type'),
                                                    'managed_site_name' => __('observation_page.field_facility_name', 'Facility name'),
                                                    'managed_context_note' => __('observation_page.field_facility_note', 'Facility note'),
                                                ];
                                                $changes[] = ($fieldMap[$field] ?? $field) . ' → ' . (($change['to'] ?? '') === '' ? __('observation_page.unset', 'Unset') : (string)($change['to'] ?? ''));
                                            }
                                            if ($changes === [] && !empty($history['after']) && !empty($history['before'])) {
                                                foreach ([
                                                    'biome' => __('observation_page.field_biome', 'Biome'),
                                                    'organism_origin' => __('observation_page.field_origin', 'Origin'),
                                                    'life_stage' => __('observation_page.field_state', 'Condition'),
                                                    'individual_count' => __('observation_page.field_count', 'Count')
                                                ] as $field => $fieldLabel) {
                                                    $before = $history['before'][$field] ?? null;
                                                    $after = $history['after'][$field] ?? null;
                                                    if ($before !== $after) {
                                                        $changes[] = $fieldLabel . ' → ' . (($after ?? '') === '' ? __('observation_page.unset', 'Unset') : (string)$after);
                                                    }
                                                }
                                            }
                                            ?>
                                            <div class="rounded-2xl border border-emerald-200/70 bg-white px-3 py-2">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-bold text-emerald-900"><?php echo htmlspecialchars($label); ?></div>
                                                        <div class="mt-1 text-[11px] text-muted">
                                                            <?php echo htmlspecialchars((string)($history['actor_name'] ?? __('observation_page.community', 'community'))); ?>
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

                    <?php if (!empty($identificationTimeline)): ?>
                        <?php
                        $timelineClassMap = [
                            'sky' => 'border-sky-200 bg-sky-50 text-sky-900',
                            'emerald' => 'border-emerald-200 bg-emerald-50 text-emerald-900',
                            'amber' => 'border-amber-200 bg-amber-50 text-amber-900',
                            'violet' => 'border-violet-200 bg-violet-50 text-violet-900',
                        ];
                        ?>
                        <div class="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-4">
                            <div class="flex items-start gap-3">
                                <span class="text-2xl leading-none">🧭</span>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-sky-900"><?= __('observation_page.review_history_title', 'How community review moved') ?></p>
                                    <p class="text-xs text-sky-800/80 mt-1 leading-relaxed"><?= __('observation_page.review_history_body', 'Each suggestion can move the record in a different way. The latest shifts are shown here so you can see what changed, not just the latest name.') ?></p>
                                    <div class="mt-3 space-y-2">
                                        <?php foreach ($identificationTimeline as $timelineItem): ?>
                                            <?php $timelineTone = (string)($timelineItem['tone'] ?? 'sky'); ?>
                                            <div class="rounded-2xl border bg-white px-3 py-2">
                                                <div class="flex items-start justify-between gap-3">
                                                    <div class="min-w-0">
                                                        <div class="text-xs font-bold text-text"><?php echo htmlspecialchars((string)($timelineItem['title'] ?? '')); ?></div>
                                                        <div class="mt-1 text-[11px] text-muted">
                                                            <?php echo htmlspecialchars((string)($timelineItem['actor_name'] ?? __('observation_page.community', 'community'))); ?>
                                                            <?php if (!empty($timelineItem['taxon_name'])): ?>
                                                                ・<?php echo htmlspecialchars((string)$timelineItem['taxon_name']); ?>
                                                            <?php endif; ?>
                                                            <?php if (!empty($timelineItem['at'])): ?>
                                                                ・<?php echo htmlspecialchars(date('Y.m.d', strtotime((string)$timelineItem['at']))); ?>
                                                            <?php endif; ?>
                                                        </div>
                                                    </div>
                                                    <span class="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold <?php echo $timelineClassMap[$timelineTone] ?? $timelineClassMap['sky']; ?>">
                                                        <?= __('observation_page.id_feedback_label', 'Contribution feedback') ?>
                                                    </span>
                                                </div>
                                                <div class="mt-1 text-[11px] leading-relaxed text-text/80">
                                                    <?php echo htmlspecialchars((string)($timelineItem['body'] ?? '')); ?>
                                                </div>
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
                            <div class="text-sm font-bold text-text"><?= __('observation_page.identifying_title', 'Identifying the species') ?></div>
                            <div class="text-xs text-muted mt-0.5"><?= __('observation_page.identifying_body', 'Try posting your own guess too!') ?></div>
                            </div>
                            <span class="ml-auto flex-shrink-0 text-orange-500 bg-orange-500/10 border-orange-500/20 text-token-xs font-bold px-2 py-1 rounded-full border">
                                <?= __('observation_page.unidentified', 'Unidentified') ?>
                            </span>
                        </div>
                    <?php endif; ?>

                    <!-- Map -->
                    <?php if ($hasDisplayCoordinates): ?>
                    <div id="reborn-map" class="w-full h-40 overflow-hidden relative z-0" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);"></div>
                    <?php else: ?>
                    <div class="w-full h-40 flex items-center justify-center text-center px-6" style="border-radius:var(--shape-md);background:var(--md-surface-container-low);">
                        <div>
                        <p class="text-sm font-black text-text"><?= __('observation_page.map_hidden_title', 'Location is not public') ?></p>
                        <p class="text-xs text-muted mt-1"><?= __('observation_page.map_hidden_body', 'This record shows only the region name and hides map coordinates.') ?></p>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- Nearby Timeline -->
                    <?php if ($hasDisplayCoordinates): ?>
                    <div x-data="nearbyTimeline()" x-init="load()" class="mt-4">
                        <div x-show="records.length > 0" x-transition>
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-[10px] font-black text-faint uppercase tracking-widest flex items-center gap-1">
                                    <i data-lucide="clock" class="w-3 h-3"></i> <?= __('observation_page.place_records', 'Records from this place') ?>
                                </h3>
                                <span class="text-[9px] text-faint" x-text="records.length + '<?= addslashes(__('observation_page.items_suffix', 'items')) ?>'"></span>
                            </div>
                            <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                                <template x-for="r in records.slice(0, 8)" :key="r.id">
                                    <a :href="'observation_detail.php?id=' + r.id" class="flex-shrink-0 w-20">
                                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-surface border border-border">
                                            <img x-show="r.photo" :src="r.photo" :alt="r.species_name || '<?= addslashes(__('observation_page.observation_fallback', 'Observation')) ?>'" class="w-full h-full object-cover" loading="lazy">
                                            <div x-show="!r.photo" class="w-full h-full flex items-center justify-center text-faint text-xs">📝</div>
                                        </div>
                                        <p class="text-[9px] font-bold text-text truncate mt-1" x-text="r.species_name || '<?= addslashes(__('observation_page.unidentified', 'Unidentified')) ?>'"></p>
                                        <p class="text-[8px] text-faint" x-text="r.observed_at ? r.observed_at.slice(0,10) : ''"></p>
                                    </a>
                                </template>
                            </div>
                        </div>
                    </div>
                    <script nonce="<?= CspNonce::attr() ?>">
                        function nearbyTimeline() {
                            return {
                                records: [],
                                async load() {
                                    try {
                                        const res = await fetch('api/get_nearby_timeline.php?lat=<?php echo round($displayLat, 4); ?>&lng=<?php echo round($displayLng, 4); ?>&radius=1000&limit=8');
                                        const json = await res.json();
                                        if (json.success) {
                                            this.records = json.observations.filter(o => o.id !== '<?php echo htmlspecialchars($id); ?>');
                                        }
                                    } catch (e) {}
                                }
                            };
                        }
                    </script>
                    <?php endif; ?>

                    <div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div class="flex items-start gap-3">
                            <span class="text-2xl leading-none">🌿</span>
                            <div class="min-w-0 flex-1">
                                <p class="text-[10px] font-black uppercase tracking-widest text-emerald-700"><?= __('observation_page.revisit_eyebrow', 'REVISIT THIS PLACE') ?></p>
                                <p class="mt-1 text-sm font-bold text-emerald-950"><?= __('observation_page.revisit_title', 'Come back here and leave one more dated trace') ?></p>
                                <p class="mt-1 text-xs leading-relaxed text-emerald-900/80"><?php echo htmlspecialchars($revisitBody); ?></p>
                                <?php if ($myFieldName): ?>
                                    <div class="mt-2">
                                        <span class="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                            <?= __('observation_page.revisit_my_field_badge', 'My Field') ?>: <?php echo htmlspecialchars($myFieldName); ?>
                                        </span>
                                    </div>
                                <?php endif; ?>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <a href="<?php echo htmlspecialchars($revisitRecordUrl); ?>" class="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600">
                                        <?= __('observation_page.revisit_record_cta', 'Record another visit') ?>
                                    </a>
                                    <a href="<?php echo htmlspecialchars($revisitCollectionUrl); ?>" class="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100">
                                        <?php echo htmlspecialchars($revisitCollectionLabel); ?>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Omoikane Insights (New) -->
                    <?php if ($omoikaneTraits): ?>
                        <div class="mt-6 bg-white rounded-xl p-5 border border-emerald-100 shadow-sm relative overflow-hidden">
                            <div class="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none">
                                <span class="material-symbols-outlined text-9xl text-primary">psychiatry</span>
                            </div>
                            <div class="flex items-center gap-2 mb-3 relative z-10">
                                <span class="material-symbols-outlined text-primary">psychiatry</span>
                                <h3 class="font-black text-gray-900 text-sm tracking-wider"><?= __('observation_page.omoikane_title', 'Omoikane insights') ?></h3>
                            </div>
                            <div class="space-y-3 relative z-10 text-sm text-gray-700">
                                <?php if (!empty($omoikaneTraits['habitat'])): ?>
                                    <div class="flex items-start gap-2 rounded-lg p-3" style="background:rgba(16,185,129,0.04)">
                                        <span class="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">landscape</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-widest"><?= __('observation_page.omoikane_habitat', 'Habitat in references') ?></div>
                                            <div class="font-medium leading-tight mb-1 text-xs"><?php echo htmlspecialchars($omoikaneTraits['habitat']); ?></div>
                                            <div class="text-[10px] text-gray-500 bg-white/80 border border-emerald-100 inline-block px-1.5 py-0.5 rounded">
                                                <?= __('observation_page.omoikane_habitat_note', '✨ Your report may help reveal a new habitat!') ?>
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <?php if (!empty($omoikaneTraits['season'])): ?>
                                    <div class="flex items-start gap-2 rounded-lg p-3" style="background:rgba(16,185,129,0.04)">
                                        <span class="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">calendar_month</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-widest"><?= __('observation_page.omoikane_season', 'Seasonality') ?></div>
                                            <div class="font-medium leading-tight mb-1 text-xs"><?php echo htmlspecialchars($omoikaneTraits['season']); ?></div>
                                            <div class="text-[10px] text-gray-500 bg-white/80 border border-emerald-100 inline-block px-1.5 py-0.5 rounded">
                                                <?= __('observation_page.omoikane_season_note', '⏱️ Off-season records can be especially valuable.') ?>
                                            </div>
                                        </div>
                                    </div>
                                <?php endif; ?>

                                <?php if (!empty($omoikaneTraits['altitude'])): ?>
                                    <div class="flex items-start gap-2 rounded-lg p-3" style="background:rgba(16,185,129,0.04)">
                                        <span class="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">terrain</span>
                                        <div>
                                            <div class="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-widest"><?= __('observation_page.omoikane_altitude', 'Elevation') ?></div>
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
                <?= __('observation_page.suggest_name_title', 'Suggest a name') ?>
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
                            <?= __('observation_page.id_notes', 'Everyone’s guess notes') ?>
                            <?php if (count($obs['identifications'] ?? []) > 0): ?>
                                <span class="text-token-xs bg-primary/15 text-primary font-bold px-2 py-0.5 rounded-full"><?php echo count($obs['identifications']); ?></span>
                            <?php endif; ?>
                        </h3>
                        <button @click="idModalOpen = true"
                            class="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition border border-primary/20 active:scale-95">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            <?= __('observation_page.post_action', 'Post') ?>
                        </button>
                    </div>

                    <!-- Cards -->
                    <?php
                    $strongClaimCount = 0;
                    $cautiousClaimCount = 0;
                    $expertLaneCount = 0;
                    foreach (($obs['identifications'] ?? []) as $summaryIdent) {
                        $summaryRank = strtolower((string)($summaryIdent['taxon_rank'] ?? ''));
                        $summaryConfidence = (string)($summaryIdent['confidence'] ?? 'likely');
                        $summarySpeciesOrBelow = in_array($summaryRank, ['species', 'subspecies', 'variety', 'form'], true);
                        if ($summarySpeciesOrBelow && in_array($summaryConfidence, ['sure', 'literature'], true)) {
                            $strongClaimCount++;
                        } else {
                            $cautiousClaimCount++;
                        }
                        $summaryTrust = TrustLevel::calculate((string)($summaryIdent['user_id'] ?? ''));
                        if ($summaryTrust >= TrustLevel::LEVEL_EXPERT) {
                            $expertLaneCount++;
                        }
                    }
                    ?>
                    <?php if (!empty($obs['identifications'])): ?>
                        <div class="rounded-2xl border border-border bg-surface-container-low px-4 py-3">
                            <div class="flex items-start gap-3">
                                <span class="text-xl leading-none">🧭</span>
                                <div class="min-w-0">
                                    <p class="text-[10px] font-black text-faint uppercase tracking-widest"><?= __('observation_page.review_queue_title', 'Review lanes') ?></p>
                                    <p class="mt-1 text-xs text-muted leading-relaxed"><?= __('observation_page.review_queue_body', 'Strong public claims need cleaner reasons and careful review. Cautious suggestions keep the record moving without forcing certainty.') ?></p>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <span class="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-800">
                                            <?= __('observation_page.review_queue_strong', 'Strong claims') ?> · <?php echo $strongClaimCount; ?>
                                        </span>
                                        <span class="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-[11px] font-bold text-sky-800">
                                            <?= __('observation_page.review_queue_cautious', 'Cautious lane') ?> · <?php echo $cautiousClaimCount; ?>
                                        </span>
                                        <?php if ($expertLaneCount > 0): ?>
                                            <span class="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-800">
                                                <?= __('observation_page.review_queue_expert', 'Expert lane present') ?> · <?php echo $expertLaneCount; ?>
                                            </span>
                                        <?php endif; ?>
                                    </div>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <a href="id_workbench.php?lane=public-claim"
                                            class="inline-flex items-center rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100">
                                            <?= __('observation_page.review_queue_open_public_claim', 'Open public claim queue') ?>
                                        </a>
                                        <?php if ($expertLaneCount > 0): ?>
                                            <a href="id_workbench.php?lane=expert-lane"
                                                class="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-100">
                                                <?= __('observation_page.review_queue_open_expert_lane', 'Open expert lane queue') ?>
                                            </a>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <div id="id-list-container" class="space-y-3">
                        <?php if (empty($obs['identifications'])): ?>
                            <div class="text-center py-12" style="background:var(--md-surface-container);border-radius:var(--shape-xl);border:1.5px dashed var(--md-outline-variant);">
                                <div class="text-5xl mb-4">🌱</div>
                                <p class="text-sm font-bold text-text mb-1"><?= __('observation_page.no_guesses_title', 'No guesses yet') ?></p>
                                <p class="text-xs text-muted mb-4"><?= __('observation_page.no_guesses_body', 'Share what you know. Even a small hint can help the poster.') ?></p>
                                <button @click="idModalOpen = true"
                                    class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition border border-primary/20">
                                    <i data-lucide="zap" class="w-3.5 h-3.5"></i>
                                    <?= __('observation_page.suggest_name_action', 'Suggest a name') ?>
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
                                $feedback = $identificationFeedback[(string)($ident['id'] ?? '')] ?? null;
                                $feedbackTone = (string)($feedback['tone'] ?? 'sky');
                                $feedbackClassMap = [
                                    'sky' => 'border-sky-200 bg-sky-50 text-sky-900',
                                    'emerald' => 'border-emerald-200 bg-emerald-50 text-emerald-900',
                                    'amber' => 'border-amber-200 bg-amber-50 text-amber-900',
                                    'violet' => 'border-violet-200 bg-violet-50 text-violet-900',
                                ];
                                $confidenceValue = (string)($ident['confidence'] ?? 'likely');
                                $confidenceMap = [
                                    'sure' => ['label' => __('observation_page.confidence_sure', 'Sure'), 'class' => 'bg-amber-50 text-amber-800 border-amber-200'],
                                    'likely' => ['label' => __('observation_page.confidence_likely', 'Likely'), 'class' => 'bg-sky-50 text-sky-800 border-sky-200'],
                                    'unsure' => ['label' => __('observation_page.confidence_unsure', 'Unsure'), 'class' => 'bg-gray-100 text-gray-700 border-gray-200'],
                                    'literature' => ['label' => __('observation_page.confidence_reference', 'Reference'), 'class' => 'bg-emerald-50 text-emerald-800 border-emerald-200'],
                                ];
                                $confidenceMeta = $confidenceMap[$confidenceValue] ?? $confidenceMap['likely'];
                                $evidenceType = (string)($ident['evidence']['type'] ?? 'visual');
                                $evidenceLabelMap = [
                                    'visual' => __('ambient.id_evidence_morphology', 'Morphological features'),
                                    'habitat' => __('ambient.id_evidence_habitat', 'Habitat'),
                                    'behavior' => __('ambient.id_evidence_season', 'Seasonality'),
                                    'reference' => __('ambient.id_evidence_reference', 'Reference / Field Guide'),
                                    'sound' => __('ambient.id_evidence_sound', 'Sound / Call'),
                                ];
                                $identRank = strtolower((string)($ident['taxon_rank'] ?? ''));
                                $speciesOrBelowClaim = in_array($identRank, ['species', 'subspecies', 'variety', 'form'], true);
                                $isStrongClaim = $speciesOrBelowClaim && in_array($confidenceValue, ['sure', 'literature'], true);
                                ?>
                                <!-- Identification Card (Social Feed Style) -->
                                <div style="background:var(--md-surface-container);border-radius:var(--shape-xl);padding:1rem;box-shadow:var(--elev-1);transition:box-shadow var(--motion-short) var(--motion-std);"
                                    x-data="inlineTaxonSelector('<?php echo htmlspecialchars($id); ?>')">

                                    <!-- Card Header: Avatar + User Info + Species Badge -->
                                    <div class="flex items-start gap-3">
                                        <img src="<?php echo htmlspecialchars($ident['user_avatar'] ?? '/assets/img/default-avatar.svg'); ?>"
                                            alt="<?php echo htmlspecialchars(__('observation_page.user_avatar_alt', '{name} avatar', ['name' => $ident['user_name'] ?? __('observation_page.user', 'User')])); ?>"
                                            class="w-10 h-10 rounded-full border-2 border-border shadow-sm flex-shrink-0 object-cover"
                                            loading="lazy"
                                            onerror="this.src='/assets/img/default-avatar.svg'">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-1.5 flex-wrap">
                                                <span class="text-sm font-bold text-text"><?php echo htmlspecialchars($ident['user_name'] ?? 'Unknown'); ?></span>
                                                <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-token-xs font-bold border <?php echo $rankInfo['bg'] . ' ' . $rankInfo['color'] . ' ' . $rankInfo['border']; ?>">
                                                    <span><?php echo $rankInfo['icon']; ?></span>
                                                    <span><?php echo $rankInfo['name']; ?></span>
                                                </span>
                                                <?php if ($isMyId): ?>
                                                    <span class="text-token-xs bg-primary/20 text-primary-light px-2 py-0.5 rounded-full font-bold"><?= __('observation_page.you', 'You') ?></span>
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
                                                <?php $lsMap = ['adult' => __('observation_page.life_stage_adult', 'Adult'), 'juvenile' => __('observation_page.life_stage_juvenile', 'Juvenile'), 'egg' => __('observation_page.life_stage_egg_short', 'Eggs'), 'trace' => __('observation_page.life_stage_trace', 'Trace')]; ?>
                                                <span class="inline-block mt-1 text-token-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-bold">
                                                    <?php echo htmlspecialchars($lsMap[$ident['life_stage']] ?? $ident['life_stage']); ?>
                                                </span>
                                            <?php endif; ?>
                                            <div class="mt-2 flex flex-wrap gap-1.5">
                                                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold <?php echo $confidenceMeta['class']; ?>">
                                                    <?php echo htmlspecialchars($confidenceMeta['label']); ?>
                                                </span>
                                                <span class="inline-flex items-center rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-bold text-muted">
                                                    <?= __('observation_page.evidence_type_label', 'Evidence') ?>: <?php echo htmlspecialchars($evidenceLabelMap[$evidenceType] ?? $evidenceType); ?>
                                                </span>
                                                <?php if ($trustLevel >= TrustLevel::LEVEL_EXPERT): ?>
                                                    <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                                                        <?= __('observation_page.expert_lane_badge', 'Expert lane') ?>
                                                    </span>
                                                <?php endif; ?>
                                            </div>
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
                                                    <?= __('observation_page.show_more', 'Show more') ?>
                                                </button>
                                            <?php endif; ?>
                                        </div>
                                    <?php endif; ?>

                                    <?php if ($isStrongClaim && empty($ident['note'])): ?>
                                        <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
                                            <?= __('observation_page.strong_claim_needs_reason', 'This is a strong public claim. A short reason or comparison note would make review easier.') ?>
                                        </div>
                                    <?php elseif ($isStrongClaim): ?>
                                        <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
                                            <?= __('observation_page.strong_claim_hint', 'This is a strong public claim, so later reviewers will mainly check whether the evidence stays consistent.') ?>
                                        </div>
                                    <?php else: ?>
                                        <div class="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900 leading-relaxed">
                                            <?= __('observation_page.cautious_claim_hint', 'This suggestion leaves room for uncertainty and keeps the record moving without forcing a species claim.') ?>
                                        </div>
                                    <?php endif; ?>

                                    <?php if ($feedback): ?>
                                        <div class="mt-3 rounded-xl border px-3 py-2 <?php echo $feedbackClassMap[$feedbackTone] ?? $feedbackClassMap['sky']; ?>">
                                            <p class="text-[10px] font-black uppercase tracking-widest"><?= __('observation_page.id_feedback_label', 'Contribution feedback') ?></p>
                                            <p class="mt-1 text-[11px] font-bold leading-relaxed"><?php echo htmlspecialchars((string)($feedback['title'] ?? '')); ?></p>
                                            <p class="mt-1 text-[11px] leading-relaxed"><?php echo htmlspecialchars((string)($feedback['body'] ?? '')); ?></p>
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
                <span><?= __('observation_page.agree_action', 'Could be!') ?></span>
                                            </button>
                                            <button @click="inlineDispute = !inlineDispute; if(inlineDispute) $nextTick(() => $refs.disputeInput && $refs.disputeInput.focus())"
                                                class="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-danger transition px-3 py-1.5 rounded-full hover:bg-danger/10 border border-transparent active:scale-95">
                                                <i data-lucide="git-merge" class="w-3.5 h-3.5"></i>
                <span><?= __('observation_page.disagree_action', 'Maybe not') ?></span>
                                            </button>
                                        <?php endif; ?>
                                    </div>

                                    <!-- Inline Dispute Form -->
                                    <div x-show="inlineDispute" x-collapse x-cloak>
                                        <div class="mt-3 p-3 bg-danger/5 border border-danger/20 rounded-xl relative">
                                            <p class="text-token-xs text-danger font-bold mb-2 flex items-center gap-1">
                                                <i data-lucide="git-merge" class="w-3 h-3"></i>
                <?= __('observation_page.propose_other_taxon', 'Suggest a different taxon') ?>
                                            </p>
                                            <div class="flex items-center gap-2">
                                                <input type="text" x-ref="disputeInput" x-model="taxonQuery"
                                                    @input.debounce.300ms="search()"
                                                    @keydown.escape="inlineDispute = false"
                                                    class="flex-1 bg-surface border border-border rounded-lg p-2.5 text-sm text-text focus:outline-none focus:border-danger"
                placeholder="<?= __('observation_page.search_taxon_placeholder', 'Search species name...') ?>" autocomplete="off">
                                                <button @click="submitDispute()" :disabled="!taxonSlug || submitting"
                                                    class="px-4 py-2 bg-danger text-white text-sm font-bold rounded-lg transition disabled:opacity-40 hover:bg-danger/90 active:scale-95">
                <span x-text="submitting ? '<?= addslashes(__('observation_page.submitting', 'Submitting...')) ?>' : '<?= addslashes(__('observation_page.propose', 'Propose')) ?>'"></span>
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
                <button @click="inlineDispute = false" class="mt-2 text-xs text-muted hover:text-text"><?= __('observation_page.cancel', 'Cancel') ?></button>
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
            taxonRank: '',
            taxonGbifKey: null,
            taxonLineage: {},
            taxonLineageIds: {},
            suggestions: [],
            showSugg: false,
            note: '',
            selectedConfidence: 'sure',
            selectedEvidenceType: 'visual',
            lifeStage: 'unknown',
            submitting: false,
            get isStrongClaim() {
                return ['species', 'subspecies', 'variety', 'form'].includes(String(this.taxonRank || '').toLowerCase()) && ['sure', 'literature'].includes(this.selectedConfidence);
            },
            get claimHint() {
                if (this.selectedConfidence === 'literature') {
                    return '<?= addslashes(__('observation_page.reference_claim_hint', 'Reference-based claims are strongest when you leave the source or comparison point in the note.')) ?>';
                }
                if (this.isStrongClaim && !this.note.trim()) {
                    return '<?= addslashes(__('observation_page.strong_claim_needs_reason', 'This is a strong public claim. A short reason or comparison note would make review easier.')) ?>';
                }
                if (this.isStrongClaim) {
                    return '<?= addslashes(__('observation_page.strong_claim_hint', 'This is a strong public claim, so later reviewers will mainly check whether the evidence stays consistent.')) ?>';
                }
                return '<?= addslashes(__('observation_page.cautious_claim_hint', 'This suggestion leaves room for uncertainty and keeps the record moving without forcing a species claim.')) ?>';
            },
            async search() {
                const q = this.taxonQuery.trim();
                if (q.length < 1) { this.suggestions = []; this.showSugg = false; return; }
                this.taxonSlug = '';
                this.taxonSciName = '';
                this.taxonRank = '';
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
                this.taxonRank = s.rank || '';
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
                            taxon_rank: this.taxonRank,
                            lineage: this.taxonLineage || {},
                            lineage_ids: this.taxonLineageIds || {},
                            confidence: this.selectedConfidence,
                            evidence_type: this.selectedEvidenceType,
                            life_stage: this.lifeStage,
                            note: this.note
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        window.location.href = window.location.pathname + window.location.search + '&_t=' + Date.now();
                    } else {
                        alert('<?= addslashes(__('observation_page.submit_failed_prefix', 'Sorry, it did not send correctly 🙇')) ?>\n' + (data.message || '<?= addslashes(__('observation_page.submit_failed_suffix', 'Please try again after a little while')) ?>'));
                    }
                } catch(e) { alert('<?= addslashes(__('observation_page.network_failed', 'The network seems to have failed 📡\nPlease try again where the signal is better')) ?>'); }
                this.submitting = false;
            }
         }">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="idModalOpen = false"></div>
        <div class="w-full max-w-lg relative z-10 overflow-hidden" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-4);">
            <!-- Header -->
            <div class="flex items-center justify-between px-6 pt-5 pb-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <i data-lucide="search" class="w-4 h-4 text-primary"></i>
                    </div>
                <h2 class="text-lg font-black text-text"><?= __('observation_page.suggest_name_title', 'Suggest a name') ?></h2>
                </div>
                <button @click="idModalOpen = false" class="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-surface-alt transition">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>

            <div class="px-6 pb-6 space-y-5">
                <!-- Taxon Search -->
                <div class="relative">
                    <label class="block text-xs font-bold text-muted mb-1.5"><?= __('observation_page.taxon_name_label', 'Taxon name (common or scientific)') ?></label>
                    <div class="relative">
                        <input type="text" x-model="taxonQuery" @input.debounce.300ms="search()" @keydown.escape="showSugg = false"
                            class="w-full p-3 pl-10 pr-20 transition focus:outline-none" style="background:var(--md-surface-variant);border:none;border-bottom:2px solid var(--md-outline);border-radius:var(--shape-xs) var(--shape-xs) 0 0;color:var(--md-on-surface);"
                            placeholder="<?= __('observation_page.taxon_name_placeholder', 'e.g. Yamashigi, Prunus') ?>" autocomplete="off">
                        <i data-lucide="search" class="w-4 h-4 text-muted absolute left-3 top-3.5 pointer-events-none"></i>
                        <div x-show="taxonSlug" class="absolute right-3 top-3">
                            <span class="text-[10px] font-bold bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i> <?= __('observation_page.confirmed', 'Confirmed') ?>
                            </span>
                        </div>
                    </div>
                    <!-- Suggestions Dropdown -->
                    <div x-show="showSugg && suggestions.length > 0" x-transition @click.away="showSugg = false"
                        class="absolute left-0 right-0 top-full mt-1 overflow-hidden z-50 max-h-52 overflow-y-auto" style="background:var(--md-surface-container-high);border-radius:var(--shape-md);box-shadow:var(--elev-3);">
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
                    <label class="block text-xs font-bold text-muted mb-1.5"><?= __('observation_page.confidence_label', 'Confidence') ?></label>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <button type="button" @click="selectedConfidence = 'sure'"
                            :class="selectedConfidence === 'sure' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                            <?= __('observation_page.confidence_sure', 'Sure') ?>
                        </button>
                        <button type="button" @click="selectedConfidence = 'likely'"
                            :class="selectedConfidence === 'likely' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
                            <?= __('observation_page.confidence_likely', 'Likely') ?>
                        </button>
                        <button type="button" @click="selectedConfidence = 'unsure'"
                            :class="selectedConfidence === 'unsure' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                            <?= __('observation_page.confidence_unsure', 'Unsure') ?>
                        </button>
                        <button type="button" @click="selectedConfidence = 'literature'"
                            :class="selectedConfidence === 'literature' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                            <?= __('observation_page.confidence_reference', 'Reference') ?>
                        </button>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5"><?= __('observation_page.evidence_type_label', 'Evidence') ?></label>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <button type="button" @click="selectedEvidenceType = 'visual'"
                            :class="selectedEvidenceType === 'visual' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <?= __('ambient.id_evidence_morphology', 'Morphological features') ?>
                        </button>
                        <button type="button" @click="selectedEvidenceType = 'habitat'"
                            :class="selectedEvidenceType === 'habitat' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <?= __('ambient.id_evidence_habitat', 'Habitat') ?>
                        </button>
                        <button type="button" @click="selectedEvidenceType = 'behavior'"
                            :class="selectedEvidenceType === 'behavior' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <?= __('ambient.id_evidence_season', 'Seasonality') ?>
                        </button>
                        <button type="button" @click="selectedEvidenceType = 'sound'"
                            :class="selectedEvidenceType === 'sound' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="py-2 text-xs font-bold transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <?= __('ambient.id_evidence_sound', 'Sound / Call') ?>
                        </button>
                        <button type="button" @click="selectedEvidenceType = 'reference'"
                            :class="selectedEvidenceType === 'reference' ? 'bg-primary/15 border-primary/40 text-primary' : 'text-muted'"
                            class="py-2 text-xs font-bold transition sm:col-span-2" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                            <?= __('ambient.id_evidence_reference', 'Reference / Field Guide') ?>
                        </button>
                    </div>
                </div>

                <div class="rounded-xl border px-3 py-2 text-[11px] leading-relaxed"
                    :class="isStrongClaim ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'">
                    <p class="font-bold mb-1"><?= __('observation_page.review_signal_label', 'Review signal') ?></p>
                    <p x-text="claimHint"></p>
                </div>

                <!-- Life Stage -->
                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5"><?= __('observation_page.life_stage_label', 'Life stage') ?></label>
                    <div class="grid grid-cols-5 gap-1.5">
                        <template x-for="ls in [
                                {id: 'adult', label: '<?= addslashes(__('observation_page.life_stage_adult', 'Adult')) ?>', emoji: '👑'},
                                {id: 'juvenile', label: '<?= addslashes(__('observation_page.life_stage_juvenile', 'Juvenile')) ?>', emoji: '🌱'},
                                {id: 'egg', label: '<?= addslashes(__('observation_page.life_stage_egg_short', 'Eggs')) ?>', emoji: '🥚'},
                                {id: 'trace', label: '<?= addslashes(__('observation_page.life_stage_trace', 'Trace')) ?>', emoji: '👣'},
                                {id: 'unknown', label: '<?= addslashes(__('observation_page.life_stage_unknown', 'Unknown')) ?>', emoji: '❓'}
                            ]" :key="ls.id">
                            <button type="button" @click="lifeStage = ls.id"
                                :class="lifeStage === ls.id ? 'bg-primary/15 text-primary border-primary/40' : 'text-muted'"
                                class="flex flex-col items-center py-2 transition" style="border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);">
                                <span class="text-base" x-text="ls.emoji"></span>
                                <span class="text-[10px] font-bold mt-0.5" x-text="ls.label"></span>
                            </button>
                        </template>
                    </div>
                </div>

                <!-- Comment -->
                <div>
                    <label class="block text-xs font-bold text-muted mb-1.5"><?= __('observation_page.comment_label', 'Comment') ?> <span class="font-normal text-faint">(<?= __('observation_page.optional', 'Optional') ?>)</span></label>
                    <textarea x-model="note" rows="3" class="w-full p-3 text-sm resize-none transition focus:outline-none" style="background:var(--md-surface-variant);border:none;border-bottom:2px solid var(--md-outline);border-radius:var(--shape-xs) var(--shape-xs) 0 0;color:var(--md-on-surface);" placeholder="<?= __('observation_page.comment_placeholder', 'Reasoning or comments...') ?>"></textarea>
                </div>

                <!-- Submit -->
                <button @click="submit()" :disabled="submitting || !taxonQuery.trim()"
                    class="w-full py-3 font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]" style="background:var(--md-primary);color:var(--md-on-primary);border-radius:var(--shape-full);">
                    <template x-if="submitting"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i></template>
                <span x-text="submitting ? '<?= addslashes(__('observation_page.submitting', 'Submitting...')) ?>' : '<?= addslashes(__('observation_page.propose_action', 'Propose')) ?>'"></span>
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
                                confidence: 'likely',
                                evidence_type: 'visual',
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
                const lat = <?php echo round($displayLat, 4); ?>;
                const lng = <?php echo round($displayLng, 4); ?>;
                const map = new maplibregl.Map({
                    container: 'reborn-map',
                    style: IKIMON_MAP.style('light'),
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

<?php if ($canEditObservation): ?>
<!-- 写真追加モーダル -->
<div x-data="addPhotoModal()" @open-add-photo.window="open()" x-show="isOpen" x-cloak
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    style="display:none">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close()"></div>
    <div class="relative w-full max-w-md rounded-3xl bg-surface border border-border shadow-2xl p-6 sm:p-8" @click.stop>
        <button @click="close()" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-base text-muted hover:text-text transition">
            <i data-lucide="x" class="w-4 h-4" style="pointer-events:none"></i>
        </button>
        <p class="text-[10px] font-black uppercase tracking-[0.18em] text-faint"><?= __('observation_page.add_photos_eyebrow', 'ADD PHOTOS') ?></p>
        <h2 class="mt-1 text-xl font-black text-text"><?= __('observation_page.add_photos_title', 'Add photos') ?></h2>
        <p class="mt-2 text-sm text-muted"><?= __('observation_page.add_photos_body', 'You can add just one photo. Up to 10. JPEG, PNG, and WebP are supported.') ?></p>

        <div class="mt-5">
            <label class="block w-full cursor-pointer rounded-2xl border-2 border-dashed border-border bg-base hover:border-primary/40 transition p-6 text-center"
                :class="previews.length > 0 ? 'border-primary/40' : ''">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden"
                    @change="onFileChange($event)">
                <template x-if="previews.length === 0">
                    <div>
                        <i data-lucide="image-plus" class="w-8 h-8 mx-auto text-muted mb-2" style="pointer-events:none"></i>
                        <p class="text-sm font-bold text-muted"><?= __('observation_page.add_photos_pick', 'Tap to choose photos') ?></p>
                        <p class="text-xs text-faint mt-1"><?= __('observation_page.add_photos_limit', 'Up to 10 MB each') ?></p>
                    </div>
                </template>
                <template x-if="previews.length > 0">
                    <div class="grid grid-cols-3 gap-2">
                        <template x-for="(src, i) in previews" :key="i">
                            <img :src="src" class="aspect-square rounded-xl object-cover w-full border border-border">
                        </template>
                    </div>
                </template>
            </label>
        </div>

        <div x-show="error" class="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-bold" x-text="error"></div>
        <div x-show="successMsg" class="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-bold" x-text="successMsg"></div>

        <button @click="upload()" :disabled="files.length === 0 || uploading"
            class="mt-5 w-full rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white transition hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <i data-lucide="upload" class="w-4 h-4" style="pointer-events:none" x-show="!uploading"></i>
            <span x-text="uploading ? '<?= addslashes(__('observation_page.uploading', 'Uploading...')) ?>' : '<?= addslashes(__('observation_page.add_action', 'Add')) ?>'"></span>
        </button>
    </div>
</div>

<script>
function addPhotoModal() {
    return {
        isOpen: false,
        files: [],
        previews: [],
        uploading: false,
        error: '',
        successMsg: '',
        open() {
            this.isOpen = true;
            this.files = [];
            this.previews = [];
            this.error = '';
            this.successMsg = '';
            this.$nextTick(() => { if (window.lucide) window.lucide.createIcons(); });
        },
        close() {
            if (this.successMsg) { location.reload(); return; }
            this.isOpen = false;
        },
        onFileChange(e) {
            this.files = Array.from(e.target.files);
            this.previews = [];
            this.error = '';
            this.files.forEach(f => {
                const reader = new FileReader();
                reader.onload = ev => this.previews.push(ev.target.result);
                reader.readAsDataURL(f);
            });
        },
        async upload() {
            if (this.files.length === 0 || this.uploading) return;
            this.uploading = true;
            this.error = '';
            this.successMsg = '';
            const fd = new FormData();
            fd.append('obs_id', '<?php echo htmlspecialchars($id, ENT_QUOTES); ?>');
            fd.append('csrf_token', '<?php echo htmlspecialchars($csrfToken, ENT_QUOTES); ?>');
            this.files.forEach(f => fd.append('photos[]', f));
            try {
                const res = await fetch('/api/add_observation_photo.php', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) {
            this.successMsg = data.message + ' <?= addslashes(__('observation_page.refreshing_page', 'Refreshing the page...')) ?>';
                    setTimeout(() => location.reload(), 1500);
                } else {
            this.error = data.message || '<?= addslashes(__('observation_page.upload_failed', 'Upload failed.')) ?>';
                    this.uploading = false;
                }
            } catch {
            this.error = '<?= addslashes(__('observation_page.upload_network_failed', 'A network error occurred.')) ?>';
                this.uploading = false;
            }
        }
    };
}
</script>
<?php endif; ?>
<script>
function speciesInsights(scientificName) {
    return {
        groups: [],
        hasInsights: false,
        priorityGroups: [],
        init() {
            if (!scientificName) return;
            fetch('/api/v2/species_claims.php?scientific_name=' + encodeURIComponent(scientificName))
                .then(r => r.json())
                .then(data => {
                    if (!data.success || !data.groups || data.groups.length === 0) return;
                    const show = ['identification_pitfall','photo_target','hybridization','ecology_trivia','cultural','taxonomy_note','regional_variation'];
                    this.priorityGroups = data.groups.filter(g => show.includes(g.type));
                    this.hasInsights = this.priorityGroups.length > 0;
                })
                .catch(() => {});
        },
        groupStyle(type) {
            const styles = {
                identification_pitfall: { bg: 'var(--md-error-container, #fce4ec)', label: 'var(--md-on-error-container, #b71c1c)', icon: '\u26a0\ufe0f' },
                photo_target:          { bg: 'var(--md-primary-container, #e3f2fd)', label: 'var(--md-on-primary-container, #1565c0)', icon: '\ud83d\udcf7' },
                hybridization:         { bg: 'var(--md-tertiary-container, #fff3e0)', label: 'var(--md-on-tertiary-container, #e65100)', icon: '\ud83e\uddec' },
                ecology_trivia:        { bg: 'var(--md-surface-container-low, #f1f8e9)', label: 'var(--md-on-surface, #33691e)', icon: '\ud83c\udf3f' },
                cultural:              { bg: 'var(--md-surface-container, #f3e5f5)', label: 'var(--md-on-surface, #6a1b9a)', icon: '\ud83c\udfad' },
                taxonomy_note:         { bg: 'var(--md-surface-container-low, #e8eaf6)', label: 'var(--md-on-surface, #283593)', icon: '\ud83d\udcdd' },
                regional_variation:    { bg: 'var(--md-surface-container-low, #e0f2f1)', label: 'var(--md-on-surface, #00695c)', icon: '\ud83d\uddfa\ufe0f' },
            };
            return styles[type] || { bg: 'var(--md-surface-container-low)', label: 'var(--md-on-surface)', icon: '\ud83d\udca1' };
        }
    };
}
</script>
</body>

</html>
