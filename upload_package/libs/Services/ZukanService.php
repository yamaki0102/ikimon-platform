<?php

/**
 * ZukanService - Species Index (図鑑) Service
 * 
 * Builds a dynamic species index from actual observation data.
 * Replaces the legacy fixed TARGET_SPECIES approach.
 * 
 * @version 2.0.0
 * @since 2026-02-15
 */

require_once __DIR__ . '/../DataStore.php';
require_once __DIR__ . '/../RedList.php';
require_once __DIR__ . '/../BioUtils.php';
require_once __DIR__ . '/../Lang.php';

class ZukanService
{
    /** Cache TTL for the taxon index (1 hour) */
    private const INDEX_TTL = 3600;
    private const INDEX_CACHE_KEY = 'zukan_taxon_index_v2026_posts_v2';
    private const USER_CACHE_PREFIX = 'zukan_user_v2026_v2_';

    /** Taxon group mapping for filtering (keys match filter chips, values match inferGroup output) */
    private const GROUP_MAP = [
        'bird'    => ['鳥類', 'Aves', 'bird'],
        'insect'  => ['昆虫', 'Insecta', 'insect'],
        'plant'   => ['植物', 'Plantae', 'plant'],
        'mammal'  => ['哺乳類', 'Mammalia', 'mammal'],
        'fish'    => ['魚類', 'Actinopterygii', 'fish'],
        'fungi'   => ['菌類', 'Fungi', 'fungi'],
        'amphibian_reptile' => ['両生爬虫類', '両生類', '爬虫類', 'Amphibia', 'Reptilia', 'amphibian', 'reptile'],
    ];

    /**
     * Build or retrieve cached Taxon Index.
     * Scans all observations and aggregates unique species.
     *
     * @return array<string, array> Keyed by taxon_key
     */
    public static function buildTaxonIndex(): array
    {
        return DataStore::getCached(self::INDEX_CACHE_KEY, self::INDEX_TTL, function () {
            $observations = DataStore::fetchAll('observations');
            $index = [];

            foreach ($observations as $obs) {
                if (!self::shouldIncludeObservation($obs)) {
                    continue;
                }

                $taxonKey = $obs['taxon']['key'] ?? null;
                $taxonName = $obs['taxon']['name'] ?? '';
                if (!$taxonKey || !$taxonName) continue;

                if (!isset($index[$taxonKey])) {
                    $index[$taxonKey] = [
                        'taxon_key'       => $taxonKey,
                        'name'            => $taxonName,
                        'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                        'group'           => $obs['taxon']['group'] ?? '',
                        '_class'          => $obs['taxon']['class'] ?? '',
                        'rank'            => $obs['taxon']['rank'] ?? 'species',
                        'obs_count'       => 0,
                        'rg_count'        => 0,
                        'photo'           => null,
                        'last_observed'   => null,
                        'observers'       => [],
                        'red_list'        => null,
                    ];
                }

                $entry = &$index[$taxonKey];
                $entry['obs_count']++;

                // Track Research Grade count
                if (BioUtils::isResearchGradeLike($obs['status'] ?? ($obs['quality_grade'] ?? ''))) {
                    $entry['rg_count']++;
                }

                // Keep most recent photo
                $obsDate = $obs['observed_at'] ?? $obs['created_at'] ?? '';
                if (!$entry['last_observed'] || $obsDate > $entry['last_observed']) {
                    $entry['last_observed'] = $obsDate;
                    // Prefer photo from latest observation
                    if (!empty($obs['photos'][0])) {
                        $entry['photo'] = $obs['photos'][0];
                    }
                }

                // If no photo yet, take any available
                if (!$entry['photo'] && !empty($obs['photos'][0])) {
                    $entry['photo'] = $obs['photos'][0];
                }

                // Track unique observers
                $userId = $obs['user_id'] ?? '';
                if ($userId && !in_array($userId, $entry['observers'])) {
                    $entry['observers'][] = $userId;
                }

                // Fill group/class from observation if missing
                if (empty($entry['group']) && !empty($obs['taxon']['group'])) {
                    $entry['group'] = $obs['taxon']['group'];
                }
                if (empty($entry['_class']) && !empty($obs['taxon']['class'])) {
                    $entry['_class'] = $obs['taxon']['class'];
                }
            }

            // Post-process: convert observers to count, check RedList, infer group
            foreach ($index as &$entry) {
                $entry['observer_count'] = count($entry['observers']);
                unset($entry['observers']);

                // Infer group if missing
                if (empty($entry['group'])) {
                    $entry['group'] = self::inferGroup(
                        $entry['name'],
                        $entry['scientific_name'],
                        $entry['_class'] ?? ''
                    );
                }

                // Check RedList status
                $rl = RedList::check($entry['name']);
                $entry['red_list'] = $rl;

                // Remove internal _class field from API output
                unset($entry['_class']);
            }
            unset($entry);

            return $index;
        });
    }

    /**
     * Get species list with filtering, sorting, and pagination.
     *
     * @param array $options [
     *   'q'      => string,  // Search query (name/scientific_name)
     *   'group'  => string,  // Taxon group filter key
     *   'sort'   => string,  // obs_count|name|latest (default: obs_count)
     *   'limit'  => int,     // Default 24
     *   'offset' => int,     // Default 0
     *   'user_id'=> string,  // Filter to user's found species only
     * ]
     * @return array ['total' => int, 'data' => array, 'has_more' => bool, 'stats' => array]
     */
    public static function getSpeciesList(array $options = []): array
    {
        $query   = $options['q'] ?? '';
        $group   = $options['group'] ?? '';
        $sort    = $options['sort'] ?? 'obs_count';
        $limit   = min((int)($options['limit'] ?? 24), 100);
        $offset  = max((int)($options['offset'] ?? 0), 0);
        $userId  = $options['user_id'] ?? '';

        $index = self::buildTaxonIndex();
        $species = array_values($index);

        // Filter by user's collection
        if (!empty($userId)) {
            $userSpecies = self::getUserFoundSpecies($userId);
            $species = array_filter($species, function ($s) use ($userSpecies) {
                return in_array($s['taxon_key'], $userSpecies);
            });
            $species = array_values($species);
        }

        // Filter by search query
        if (!empty($query)) {
            $species = array_filter($species, function ($s) use ($query) {
                return stripos($s['name'], $query) !== false
                    || stripos($s['scientific_name'], $query) !== false;
            });
            $species = array_values($species);
        }

        // Filter by taxon group
        if (!empty($group) && isset(self::GROUP_MAP[$group])) {
            $keywords = self::GROUP_MAP[$group];
            $species = array_filter($species, function ($s) use ($keywords) {
                $g = $s['group'] ?? '';
                foreach ($keywords as $kw) {
                    if (stripos($g, $kw) !== false) return true;
                }
                // Also check name for common group keywords
                foreach ($keywords as $kw) {
                    if (stripos($s['name'], $kw) !== false) return true;
                }
                return false;
            });
            $species = array_values($species);
        }

        // Sort
        switch ($sort) {
            case 'name':
                usort($species, fn($a, $b) => strcmp($a['name'], $b['name']));
                break;
            case 'latest':
                usort($species, fn($a, $b) =>
                strcmp($b['last_observed'] ?? '', $a['last_observed'] ?? ''));
                break;
            case 'obs_count':
            default:
                usort($species, fn($a, $b) => $b['obs_count'] - $a['obs_count']);
                break;
        }

        $total = count($species);
        $data = array_slice($species, $offset, $limit);

        // Knowledge nuggets: claims から知識サマリを取得
        $nuggets = [];
        try {
            $sciNames = array_filter(array_map(fn($s) => $s['scientific_name'] ?? '', $data));
            if (!empty($sciNames)) {
                require_once ROOT_DIR . '/libs/OmoikaneDB.php';
                $odb = new OmoikaneDB();
                $nuggets = $odb->getBatchNuggets(array_values(array_unique($sciNames)));
            }
        } catch (\Throwable $e) { /* non-fatal */ }

        $summaryMessages = self::summaryMessages();
        foreach ($data as &$item) {
            $sciName = $item['scientific_name'] ?? '';
            if (isset($nuggets[$sciName])) {
                $item['summary'] = $nuggets[$sciName]['text'];
            } else {
                $item['summary'] = self::buildSummary($item, $summaryMessages);
            }
        }
        unset($item);

        return [
            'total'    => $total,
            'data'     => $data,
            'has_more' => ($offset + $limit) < $total,
            'stats'    => self::getStats($index),
        ];
    }

    /**
     * Get user's found species (taxon keys).
     *
     * @param string $userId
     * @return array<string> List of taxon_keys the user has observed
     */
    public static function getUserFoundSpecies(string $userId): array
    {
        return DataStore::getCached(self::USER_CACHE_PREFIX . $userId, 600, function () use ($userId) {
            $observations = DataStore::fetchAll('observations');
            $found = [];

            foreach ($observations as $obs) {
                if (!self::shouldIncludeObservation($obs)) continue;
                if (($obs['user_id'] ?? '') !== $userId) continue;
                $key = $obs['taxon']['key'] ?? null;
                if ($key && !in_array($key, $found)) {
                    $found[] = $key;
                }
            }

            return $found;
        });
    }

    /**
     * Get user's collection stats for the progress display.
     *
     * @param string $userId
     * @return array ['found' => int, 'total' => int, 'percentage' => float]
     */
    public static function getUserCollectionStats(string $userId): array
    {
        $index = self::buildTaxonIndex();
        $totalSpecies = count($index);
        $userSpecies = self::getUserFoundSpecies($userId);
        $found = count($userSpecies);

        return [
            'found'      => $found,
            'total'      => $totalSpecies,
            'percentage' => $totalSpecies > 0 ? round(($found / $totalSpecies) * 100, 1) : 0,
        ];
    }

    /**
     * Compute aggregate stats from the index.
     *
     * @param array|null $index Pre-built index (optional)
     * @return array
     */
    public static function getStats(?array $index = null): array
    {
        if ($index === null) {
            $index = self::buildTaxonIndex();
        }

        $totalSpecies = count($index);
        $totalObs = 0;
        $totalRg = 0;
        $groupCounts = [];

        foreach ($index as $entry) {
            $totalObs += $entry['obs_count'];
            $totalRg += $entry['rg_count'];
            $group = $entry['group'] ?: '不明';
            $groupCounts[$group] = ($groupCounts[$group] ?? 0) + 1;
        }

        return [
            'total_species' => $totalSpecies,
            'total_obs'     => $totalObs,
            'rg_count'      => $totalRg,
            'rg_rate'       => $totalObs > 0 ? round(($totalRg / $totalObs) * 100, 1) : 0,
            'group_counts'  => $groupCounts,
        ];
    }

    private static function shouldIncludeObservation(array $obs): bool
    {
        $createdAt = trim((string)($obs['created_at'] ?? ''));
        if ($createdAt === '' || (int)substr($createdAt, 0, 4) < 2026) {
            return false;
        }

        $sourceType = strtolower(trim((string)($obs['source_type'] ?? '')));
        $importSource = strtolower(trim((string)($obs['import_source'] ?? '')));
        if ($sourceType === 'import' || $sourceType === 'dummy' || in_array($importSource, ['seed', 'dummy'], true)) {
            return false;
        }

        return true;
    }

    /**
     * Infer taxon group from name, scientific name, or class.
     * 3-tier: class → scientific name genus → Japanese name keywords.
     *
     * @param string $name      Japanese name
     * @param string $sciName   Scientific name
     * @param string $className Taxonomic class (e.g. 'Aves', 'Insecta')
     * @return string Inferred group or ''
     */
    private static function inferGroup(string $name, string $sciName, string $className): string
    {
        // Tier 1: Class name mapping (most reliable)
        $classMap = [
            'Aves'           => '鳥類',
            'Insecta'        => '昆虫',
            'Arachnida'      => '昆虫',
            'Mammalia'       => '哺乳類',
            'Actinopterygii' => '魚類',
            'Amphibia'       => '両生爬虫類',
            'Reptilia'       => '両生爬虫類',
            'Magnoliopsida'  => '植物',
            'Liliopsida'     => '植物',
            'Pinopsida'      => '植物',
            'Polypodiopsida' => '植物',
            'Agaricomycetes' => '菌類',
            'Gastropoda'     => 'その他',
            'Malacostraca'   => 'その他',
        ];

        if (!empty($className) && isset($classMap[$className])) {
            return $classMap[$className];
        }

        // Tier 2: Scientific name genus patterns
        $sciPatterns = [
            '/^(Hydrangea|Helianthus|Rosa|Prunus|Camellia|Quercus|Acer|Ginkgo|Pinus|Cryptomeria|Zelkova|Wisteria|Iris|Lilium|Taraxacum|Trifolium|Equisetum|Phragmites|Miscanthus|Oenothera|Solidago|Magnolia|Rhododendron|Ilex|Cornus|Clematis|Hosta|Nymphaea|Nelumbo|Persicaria|Fallopia|Plantago|Viola|Impatiens)\b/i' => '植物',
            '/^(Passer|Corvus|Columba|Hirundo|Parus|Cyanopica|Hypsipetes|Streptopelia|Motacilla|Phasianus|Accipiter|Buteo|Falco|Ardea|Egretta|Alcedo|Picus|Dendrocopos|Sturnus|Turdus|Zosterops|Emberiza|Carduelis|Phoenicurus|Cinclus|Anthus|Alauda|Cettia|Aegithalos|Sitta|Garrulus|Haliaeetus|Milvus|Podiceps|Gallinula|Fulica|Charadrius|Actitis|Scolopax|Cuculus|Otus|Strix|Apus|Delichon|Lanius|Oriolus|Bombycilla)\b/i' => '鳥類',
            '/^(Papilio|Pieris|Vanessa|Lycaena|Apis|Vespa|Coccinella|Lucanus|Cicada|Graptopsaltria|Hyalessa|Oncotympana|Meimuna|Terpnosia|Acrida|Oxya|Atractomorpha|Mantis|Tenodera|Libellula|Sympetrum|Orthetrum|Anax|Aeschna|Lampyris|Luciola|Chrysomela|Harmonia|Anomala|Protaetia|Trypoxylus|Allomyrina|Prosopocoilus|Dorcus|Formica|Camponotus|Bombus|Xylocopa|Polistes|Episyrphus)\b/i' => '昆虫',
            '/^(Cyprinus|Carassius|Plecoglossus|Oncorhynchus|Rhinogobius|Oryzias|Micropterus|Anguilla|Gnathopogon|Pseudogobio|Misgurnus|Cobitis|Tribolodon|Mugil|Seriola|Pagrus)\b/i' => '魚類',
            '/^(Canis|Felis|Vulpes|Nyctereutes|Mustela|Meles|Martes|Paguma|Cervus|Capricornis|Sus|Lepus|Sciurus|Apodemus|Rattus|Myotis|Pipistrellus|Rhinolophus|Macaca|Ursus|Lutra)\b/i' => '哺乳類',
            '/^(Rana|Hyla|Bufo|Cynops|Andrias|Hynobius|Rhacophorus|Takydromus|Elaphe|Gloydius|Rhabdophis|Mauremys|Gekko|Plestiodon)\b/i' => '両生爬虫類',
            '/^(Amanita|Boletus|Russula|Lactarius|Agaricus|Pleurotus|Lentinula|Trametes|Ganoderma|Auricularia|Lycoperdon|Pholiota)\b/i' => '菌類',
        ];

        if (!empty($sciName)) {
            foreach ($sciPatterns as $pattern => $group) {
                if (preg_match($pattern, $sciName)) {
                    return $group;
                }
            }
        }

        // Tier 3: Japanese name keywords (fallback)
        $namePatterns = [
            '鳥類'     => ['スズメ', 'カラス', 'ハト', 'ツバメ', 'シジュウカラ', 'メジロ', 'ウグイス', 'ヒヨドリ', 'ムクドリ', 'モズ', 'セキレイ', 'サギ', 'カモ', 'タカ', 'トビ', 'ワシ', 'フクロウ', 'カワセミ', 'キツツキ', 'ゲラ', 'ホオジロ', 'シロチドリ', 'エナガ', 'ヤマガラ', 'コゲラ', 'ガン', 'カイツブリ'],
            '昆虫'     => ['チョウ', 'トンボ', 'セミ', 'バッタ', 'カマキリ', 'テントウムシ', 'カブトムシ', 'クワガタ', 'ホタル', 'ハチ', 'アリ', 'アブ', 'ガ', 'カミキリ', 'タマムシ', 'コガネムシ', 'ゾウムシ', 'カメムシ', 'ゴキブリ', 'コオロギ', 'キリギリス', 'ミンミンゼミ', 'アブラゼミ', 'ツクツクボウシ', 'ヒグラシ', 'アゲハ', 'モンシロ', 'シジミ', 'タテハ', 'ヤンマ', 'イトトンボ', 'クモ', 'ダンゴムシ', 'ゲジ'],
            '植物'     => ['サクラ', 'ウメ', 'バラ', 'ツバキ', 'アジサイ', 'ヒマワリ', 'タンポポ', 'スミレ', 'ユリ', 'アサガオ', 'コスモス', 'ススキ', 'シダ', 'コケ', 'マツ', 'スギ', 'ケヤキ', 'イチョウ', 'モミジ', 'カエデ', 'フジ', 'アヤメ', 'ハス', 'スイレン', 'クローバー', 'シロツメクサ', 'オオバコ', 'ツツジ', 'サルスベリ', 'ハギ', 'キク', 'ヒガンバナ', 'ナデシコ', 'ヤマブキ'],
            '哺乳類'   => ['キツネ', 'タヌキ', 'イタチ', 'アナグマ', 'テン', 'シカ', 'カモシカ', 'イノシシ', 'ウサギ', 'リス', 'ネズミ', 'コウモリ', 'サル', 'クマ', 'カワウソ', 'ハクビシン'],
            '魚類'     => ['コイ', 'フナ', 'アユ', 'マス', 'ハゼ', 'メダカ', 'ブラックバス', 'ウナギ', 'ドジョウ', 'ナマズ', 'イワナ', 'ヤマメ', 'オイカワ', 'カワムツ', 'ウグイ'],
            '両生爬虫類' => ['カエル', 'イモリ', 'サンショウウオ', 'オオサンショウウオ', 'トカゲ', 'ヘビ', 'カメ', 'ヤモリ', 'スッポン'],
            '菌類'     => ['キノコ', 'タケ', 'シメジ', 'マツタケ', 'シイタケ', 'エノキタケ', 'ナメコ'],
        ];

        foreach ($namePatterns as $group => $keywords) {
            foreach ($keywords as $kw) {
                if (mb_strpos($name, $kw) !== false) {
                    return $group;
                }
            }
        }

        return '';
    }

    private static function buildSummary(array $entry, array $messages): string
    {
        $group = self::translateGroup(trim((string)($entry['group'] ?? '')), $messages);
        $rank = trim((string)($entry['rank'] ?? ''));
        $obsCount = (int)($entry['obs_count'] ?? 0);
        $observerCount = (int)($entry['observer_count'] ?? 0);
        $lastObserved = trim((string)($entry['last_observed'] ?? ''));

        $rankLabels = [
            'species' => $messages['rank_species'] ?? '種',
            'genus' => $messages['rank_genus'] ?? '属',
            'family' => $messages['rank_family'] ?? '科',
            'order' => $messages['rank_order'] ?? '目',
            'class' => $messages['rank_class'] ?? '綱',
            'phylum' => $messages['rank_phylum'] ?? '門',
            'kingdom' => $messages['rank_kingdom'] ?? '界',
        ];
        $rankLabel = $rankLabels[strtolower($rank)] ?? ($rank !== '' ? $rank : ($messages['rank_generic'] ?? '分類群'));

        $parts = [];
        if ($group !== '') {
            $parts[] = self::fill($messages['group_rank'] ?? '{group}の{rank}', [
                '{group}' => $group,
                '{rank}' => $rankLabel,
            ]);
        } else {
            $parts[] = self::fill($messages['rank_only'] ?? '{rank}として記録', [
                '{rank}' => $rankLabel,
            ]);
        }

        if ($obsCount > 0) {
            $parts[] = self::fill(($obsCount === 1 ? ($messages['obs_count_singular'] ?? '{count}件の観察') : ($messages['obs_count_plural'] ?? '{count}件の観察')), [
                '{count}' => (string)$obsCount,
            ]);
        }
        if ($observerCount > 1) {
            $parts[] = self::fill(($observerCount === 1 ? ($messages['observer_count_singular'] ?? '{count}人が記録') : ($messages['observer_count_plural'] ?? '{count}人が記録')), [
                '{count}' => (string)$observerCount,
            ]);
        }

        if ($lastObserved !== '' && preg_match('/^(\d{4})-(\d{2})/', $lastObserved, $m)) {
            $parts[] = self::fill($messages['last_observed'] ?? '{year}年{month}月まで記録', [
                '{year}' => $m[1],
                '{month}' => $m[2],
            ]);
        }

        return implode($messages['separator'] ?? '・', $parts);
    }

    private static function summaryMessages(): array
    {
        return [
            'group_rank' => __('zukan.card_summary.group_rank', '{group}の{rank}'),
            'rank_only' => __('zukan.card_summary.rank_only', '{rank}として記録'),
            'obs_count_singular' => __('zukan.card_summary.obs_count_singular', '{count}件の観察'),
            'obs_count_plural' => __('zukan.card_summary.obs_count_plural', '{count}件の観察'),
            'observer_count_singular' => __('zukan.card_summary.observer_count_singular', '{count}人が記録'),
            'observer_count_plural' => __('zukan.card_summary.observer_count_plural', '{count}人が記録'),
            'last_observed' => __('zukan.card_summary.last_observed', '{year}年{month}月まで記録'),
            'rank_species' => __('zukan.card_summary.rank_species', '種'),
            'rank_genus' => __('zukan.card_summary.rank_genus', '属'),
            'rank_family' => __('zukan.card_summary.rank_family', '科'),
            'rank_order' => __('zukan.card_summary.rank_order', '目'),
            'rank_class' => __('zukan.card_summary.rank_class', '綱'),
            'rank_phylum' => __('zukan.card_summary.rank_phylum', '門'),
            'rank_kingdom' => __('zukan.card_summary.rank_kingdom', '界'),
            'rank_generic' => __('zukan.card_summary.rank_generic', '分類群'),
            'separator' => __('zukan.card_summary.separator', '・'),
            'group_bird' => __('zukan.card_summary.group_bird', '鳥類'),
            'group_insect' => __('zukan.card_summary.group_insect', '昆虫'),
            'group_plant' => __('zukan.card_summary.group_plant', '植物'),
            'group_mammal' => __('zukan.card_summary.group_mammal', '哺乳類'),
            'group_fish' => __('zukan.card_summary.group_fish', '魚類'),
            'group_fungi' => __('zukan.card_summary.group_fungi', '菌類'),
            'group_amphibian_reptile' => __('zukan.card_summary.group_amphibian_reptile', '両生爬虫類'),
            'group_other' => __('zukan.card_summary.group_other', 'その他'),
        ];
    }

    private static function fill(string $template, array $replacements): string
    {
        return strtr($template, $replacements);
    }

    private static function translateGroup(string $group, array $messages): string
    {
        return match ($group) {
            '鳥類' => $messages['group_bird'] ?? $group,
            '昆虫' => $messages['group_insect'] ?? $group,
            '植物' => $messages['group_plant'] ?? $group,
            '哺乳類' => $messages['group_mammal'] ?? $group,
            '魚類' => $messages['group_fish'] ?? $group,
            '菌類' => $messages['group_fungi'] ?? $group,
            '両生爬虫類' => $messages['group_amphibian_reptile'] ?? $group,
            'その他' => $messages['group_other'] ?? $group,
            default => $group,
        };
    }
}
