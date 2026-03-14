<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Taxon.php';

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 24;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$query = $_GET['q'] ?? '';
$minCreatedYear = isset($_GET['min_created_year']) ? (int)$_GET['min_created_year'] : null;
$minObservedYear = isset($_GET['min_observed_year']) ? (int)$_GET['min_observed_year'] : null;
$aiFilter = trim((string)($_GET['ai_filter'] ?? ''));
$includeImported = isset($_GET['include_imported']) && $_GET['include_imported'] === '1';

$observations = DataStore::fetchAll('observations');

if (!$includeImported) {
    $observations = array_filter($observations, function ($obs) {
        $sourceType = strtolower(trim((string)($obs['source_type'] ?? '')));
        $importSource = strtolower(trim((string)($obs['import_source'] ?? '')));
        return !($sourceType === 'import' || $sourceType === 'dummy' || in_array($importSource, ['seed', 'dummy'], true));
    });
}

if ($minCreatedYear !== null && $minCreatedYear > 0) {
    $observations = array_filter($observations, function ($obs) use ($minCreatedYear) {
        $createdAt = (string)($obs['created_at'] ?? '');
        if ($createdAt === '') {
            return false;
        }
        $year = (int)substr($createdAt, 0, 4);
        return $year >= $minCreatedYear;
    });
}

if ($minObservedYear !== null && $minObservedYear > 0) {
    $observations = array_filter($observations, function ($obs) use ($minObservedYear) {
        $observedAt = (string)($obs['observed_at'] ?? '');
        if ($observedAt === '') {
            return false;
        }
        $year = (int)substr($observedAt, 0, 4);
        return $year >= $minObservedYear;
    });
}

// Bounding Box (Viewport) Filter — for map performance
$sw_lat = isset($_GET['sw_lat']) ? (float)$_GET['sw_lat'] : null;
$sw_lng = isset($_GET['sw_lng']) ? (float)$_GET['sw_lng'] : null;
$ne_lat = isset($_GET['ne_lat']) ? (float)$_GET['ne_lat'] : null;
$ne_lng = isset($_GET['ne_lng']) ? (float)$_GET['ne_lng'] : null;

if ($sw_lat !== null && $sw_lng !== null && $ne_lat !== null && $ne_lng !== null) {
    $observations = array_filter($observations, function ($obs) use ($sw_lat, $sw_lng, $ne_lat, $ne_lng) {
        $lat = (float)($obs['lat'] ?? 0);
        $lng = (float)($obs['lng'] ?? 0);
        return $lat >= $sw_lat && $lat <= $ne_lat && $lng >= $sw_lng && $lng <= $ne_lng;
    });
}

// Status Filter (Special: unresolved)
$status = $_GET['status'] ?? '';
if ($status === 'unresolved') {
    $observations = array_filter($observations, function ($obs) {
        return in_array(($obs['status'] ?? ''), ['Needs ID', 'Suggested', '要同定', '未同定'], true);
    });
} elseif (!empty($status)) {
    $observations = array_filter($observations, function ($obs) use ($status) {
        return ($obs['status'] ?? '') === $status;
    });
}

// User Filter
$userId = $_GET['user_id'] ?? '';
if (!empty($userId)) {
    $observations = array_filter($observations, function ($obs) use ($userId) {
        return ($obs['user_id'] ?? '') === $userId;
    });
}

// Taxon Group Filter (for map filter chips)
$taxonGroup = $_GET['taxon_group'] ?? '';
if (!empty($taxonGroup)) {
    $observations = array_filter($observations, fn($obs) => observationMatchesTaxonGroup($obs, $taxonGroup));
}

if ($aiFilter !== '') {
    $observations = array_filter($observations, fn($obs) => observationMatchesAiFilter($obs, $aiFilter));
}

// Exclude test/E2E users and sample images from public feed
$observations = array_filter($observations, function ($obs) {
    $userName = $obs['user_name'] ?? '';
    if (strpos($userName, 'E2E_') === 0) return false;
    $photo = $obs['photos'][0] ?? '';
    if (strpos($photo, 'sample_') !== false) return false;
    return true;
});

// Reverse sort by date
usort($observations, function ($a, $b) {
    return strtotime($b['updated_at'] ?? $b['observed_at']) - strtotime($a['updated_at'] ?? $a['observed_at']);
});

// H003: Hybrid Search Logic (Keyword + Omoikane)
if (!empty($query)) {
    // Step 1: Omoikane structured query (non-fatal)
    // Only query Omoikane when parseSearchIntent extracts ecological dimensions.
    // Keyword-only queries (e.g. "カブトムシ") are handled by existing stripos match.
    $omoikaneMatches = [];
    try {
        $filters = parseSearchIntent($query);
        $hasEcoDimension = !empty($filters['habitat']) || !empty($filters['season']) || !empty($filters['altitude']);
        if ($hasEcoDimension) {
            require_once __DIR__ . '/../../libs/OmoikaneSearchEngine.php';
            $engine = new OmoikaneSearchEngine();
            $results = $engine->search($filters, 100, 0);
            foreach ($results as $r) {
                $omoikaneMatches[strtolower($r['scientific_name'])] = $r;
            }
        }
    } catch (\Exception $e) { /* fallback silently */ }

    // Step 2: Filter (existing 4-field match + Omoikane boost)
    $observations = array_filter($observations, function ($obs) use ($query, $omoikaneMatches) {
        $name = $obs['taxon']['name'] ?? '';
        $sName = $obs['taxon']['scientific_name'] ?? '';
        $note = $obs['note'] ?? '';
        $place = $obs['place_name'] ?? '';

        // Existing direct match (unchanged)
        $directMatch = stripos($name, $query) !== false
            || stripos($sName, $query) !== false
            || stripos($note, $query) !== false
            || stripos($place, $query) !== false;

        // Omoikane match: observation's scientific_name found in Omoikane results
        $sKey = strtolower($sName);
        $omoikaneMatch = !empty($sKey) && isset($omoikaneMatches[$sKey]);

        return $directMatch || $omoikaneMatch;
    });

    // Step 3: Boost Omoikane matches to top (new)
    if (!empty($omoikaneMatches)) {
        usort($observations, function ($a, $b) use ($omoikaneMatches) {
            $sA = strtolower($a['taxon']['scientific_name'] ?? '');
            $sB = strtolower($b['taxon']['scientific_name'] ?? '');
            $scoreA = isset($omoikaneMatches[$sA]) ? ($omoikaneMatches[$sA]['trust_score'] ?? 0.5) : 0;
            $scoreB = isset($omoikaneMatches[$sB]) ? ($omoikaneMatches[$sB]['trust_score'] ?? 0.5) : 0;
            if ($scoreA != $scoreB) return $scoreB <=> $scoreA;
            return strtotime($b['updated_at'] ?? $b['observed_at'] ?? '0')
                 - strtotime($a['updated_at'] ?? $a['observed_at'] ?? '0');
        });
    }
}

$total = count($observations);
$data = array_slice(array_values($observations), $offset, $limit);

// Apply Privacy / Obscuring
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/RedList.php';

foreach ($data as &$obs) {
    if (isset($obs['taxon']['name'])) {
        $rl = RedList::check($obs['taxon']['name']);
        if ($rl) {
            $obscured = BioUtils::getObscuredLocation($obs['lat'], $obs['lng'], $rl['category']);
            $obs['lat'] = $obscured['lat'];
            $obs['lng'] = $obscured['lng'];
            $obs['obscured_radius'] = $obscured['radius'];
            $obs['is_obscured'] = true;
            $obs['red_list'] = $rl;
        }
    }
    // Inject fresh user name
    if (isset($obs['user_id'])) {
        $obs['user_name'] = BioUtils::getUserName($obs['user_id']);
    }
    $obs['latest_ai_assessment'] = latestAiAssessmentSummary($obs);
}

echo json_encode([
    'total' => $total,
    'data' => $data,
    'has_more' => ($offset + $limit) < $total
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

function observationMatchesTaxonGroup(array $obs, string $taxonGroup): bool
{
    $target = strtolower(trim($taxonGroup));
    if ($target === '') {
        return true;
    }

    $aliases = [
        'insect' => ['昆虫', 'insect', 'insecta', 'hexapoda', 'arthropoda'],
        'bird' => ['鳥', 'bird', 'aves'],
        'plant' => ['植物', 'plant', 'plantae', 'tracheophyta', 'magnoliopsida', 'liliopsida'],
        'amphibian_reptile' => ['両生類', '爬虫類', 'amphibia', 'reptilia', 'amphibian', 'reptile'],
        'mammal' => ['哺乳類', 'mammal', 'mammalia'],
        'fish' => ['魚', 'fish', 'actinopterygii'],
        'fungi' => ['菌類', 'fungi', 'basidiomycota', 'ascomycota'],
    ];
    $needles = array_map('mb_strtolower', $aliases[$target] ?? []);
    if ($needles === []) {
        return false;
    }

    $haystacks = [];

    $taxon = is_array($obs['taxon'] ?? null) ? $obs['taxon'] : [];
    foreach (['group', 'kingdom', 'phylum', 'class', 'order', 'family', 'name', 'scientific_name'] as $field) {
        $value = trim((string)($taxon[$field] ?? ''));
        if ($value !== '') {
            $haystacks[] = mb_strtolower($value);
        }
    }
    if (is_array($taxon['lineage'] ?? null)) {
        foreach ($taxon['lineage'] as $value) {
            $value = trim((string)$value);
            if ($value !== '') {
                $haystacks[] = mb_strtolower($value);
            }
        }
    }

    foreach (($obs['identifications'] ?? []) as $identification) {
        foreach (['taxon_name', 'scientific_name', 'taxon_rank'] as $field) {
            $value = trim((string)($identification[$field] ?? ''));
            if ($value !== '') {
                $haystacks[] = mb_strtolower($value);
            }
        }
        if (is_array($identification['lineage'] ?? null)) {
            foreach ($identification['lineage'] as $value) {
                $value = trim((string)$value);
                if ($value !== '') {
                    $haystacks[] = mb_strtolower($value);
                }
            }
        }
    }

    foreach (($obs['ai_assessments'] ?? []) as $assessment) {
        $routingHint = trim((string)($assessment['routing_hint'] ?? ''));
        if ($routingHint !== '') {
            $haystacks[] = mb_strtolower($routingHint);
        }
        foreach (['recommended_taxon', 'best_specific_taxon', 'stable_taxon'] as $field) {
            $candidate = is_array($assessment[$field] ?? null) ? $assessment[$field] : [];
            foreach (['kingdom', 'phylum', 'class', 'order', 'family', 'name', 'scientific_name'] as $candidateField) {
                $value = trim((string)($candidate[$candidateField] ?? ''));
                if ($value !== '') {
                    $haystacks[] = mb_strtolower($value);
                }
            }
            if (is_array($candidate['lineage'] ?? null)) {
                foreach ($candidate['lineage'] as $value) {
                    $value = trim((string)$value);
                    if ($value !== '') {
                        $haystacks[] = mb_strtolower($value);
                    }
                }
            }
        }
    }

    foreach ($haystacks as $haystack) {
        foreach ($needles as $needle) {
            if ($needle !== '' && mb_strpos($haystack, $needle) !== false) {
                return true;
            }
        }
    }

    return false;
}

function latestAiAssessmentSummary(array $obs): ?array
{
    $assessments = array_values(array_filter($obs['ai_assessments'] ?? [], fn($item) => is_array($item)));
    if ($assessments === []) {
        return null;
    }

    usort($assessments, function ($a, $b) {
        return strcmp((string)($b['created_at'] ?? ''), (string)($a['created_at'] ?? ''));
    });
    $latest = $assessments[0];
    $recommended = is_array($latest['recommended_taxon'] ?? null) ? $latest['recommended_taxon'] : null;
    $bestSpecific = is_array($latest['best_specific_taxon'] ?? null) ? $latest['best_specific_taxon'] : null;

    return [
        'confidence_band' => $latest['confidence_band'] ?? null,
        'routing_hint' => $latest['routing_hint'] ?? null,
        'candidate_disagreement' => $latest['candidate_disagreement'] ?? null,
        'recommended_taxon' => $recommended ? [
            'name' => $recommended['name'] ?? '',
            'rank' => $recommended['rank'] ?? '',
        ] : null,
        'best_specific_taxon' => $bestSpecific ? [
            'name' => $bestSpecific['name'] ?? '',
            'rank' => $bestSpecific['rank'] ?? '',
        ] : null,
        'simple_summary' => $latest['simple_summary'] ?? '',
        'similar_taxa_to_compare' => array_values(array_slice(array_filter($latest['similar_taxa_to_compare'] ?? [], fn($value) => is_string($value) && $value !== ''), 0, 3)),
    ];
}

function observationMatchesAiFilter(array $obs, string $aiFilter): bool
{
    $summary = latestAiAssessmentSummary($obs);
    if ($summary === null) {
        return false;
    }

    $filter = strtolower(trim($aiFilter));
    return match ($filter) {
        'hint' => !empty($summary['recommended_taxon']['name']) || !empty($summary['best_specific_taxon']['name']) || !empty($summary['simple_summary']),
        'multi' => count($summary['similar_taxa_to_compare'] ?? []) >= 2
            || in_array(($summary['candidate_disagreement'] ?? ''), ['multiple_candidates', 'cross_rank_consensus', 'same_lineage_divergence'], true),
        default => true,
    };
}

// --- Helper: Lightweight search intent parser ---
function parseSearchIntent(string $query): array
{
    $filters = ['habitat' => '', 'season' => '', 'altitude' => '', 'keyword' => ''];
    $q = mb_strtolower(trim($query));
    $remaining = $q;

    // Habitat mapping (JP → EN)
    // Note: Single-char terms (森,山,川,林) can false-match names (森田,山本).
    // We skip single-char matches when followed by another kanji.
    $habitatMap = [
        '森林' => 'forest', '草原' => 'grassland', '草地' => 'grassland',
        '湿地' => 'wetland', '水辺' => 'wetland',
        '海岸' => 'coastal', '干潟' => 'coastal',
        '高山' => 'alpine', '河川' => 'riparian',
        '都市' => 'urban', '公園' => 'urban',
        '森' => 'forest', '林' => 'forest',
        '山' => 'mountain', '川' => 'riparian',
    ];
    foreach ($habitatMap as $term => $mapped) {
        $pos = mb_strpos($q, $term);
        if ($pos === false) continue;
        // For single-char terms, skip if adjacent to another kanji (likely a name/place)
        // e.g. 森田→skip, 金山→skip, 森の鳥→match, 山で見た→match
        if (mb_strlen($term) === 1) {
            $nextChar = mb_substr($q, $pos + 1, 1);
            if ($nextChar !== '' && preg_match('/\p{Han}/u', $nextChar)) continue;
            if ($pos > 0) {
                $prevChar = mb_substr($q, $pos - 1, 1);
                if (preg_match('/\p{Han}/u', $prevChar)) continue;
            }
        }
        $filters['habitat'] = $mapped;
        $remaining = str_replace($term, '', $remaining);
        break;
    }

    // Season mapping (skip if adjacent to kanji, e.g. 春日→skip, 初春→skip, 春の花→match)
    $seasonMap = ['春' => 'spring', '夏' => 'summer', '秋' => 'autumn', '冬' => 'winter'];
    foreach ($seasonMap as $term => $mapped) {
        $pos = mb_strpos($q, $term);
        if ($pos === false) continue;
        $nextChar = mb_substr($q, $pos + 1, 1);
        if ($nextChar !== '' && preg_match('/\p{Han}/u', $nextChar)) continue;
        if ($pos > 0) {
            $prevChar = mb_substr($q, $pos - 1, 1);
            if (preg_match('/\p{Han}/u', $prevChar)) continue;
        }
        $filters['season'] = $mapped;
        $remaining = str_replace($term, '', $remaining);
        break;
    }

    // Altitude pattern: digits + m
    if (preg_match('/(\d+)\s*m/', $q, $m)) {
        $filters['altitude'] = $m[1];
        $remaining = str_replace($m[0], '', $remaining);
    }

    $filters['keyword'] = trim($remaining);
    return $filters;
}
