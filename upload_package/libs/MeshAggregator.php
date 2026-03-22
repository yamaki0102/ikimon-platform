<?php

/**
 * MeshAggregator — メッシュ単位の生物多様性集計キャッシュ管理
 *
 * 設計思想:
 * - 全observations を毎回スキャンしない（大量データで死なないため）
 * - 観察追加時に差分だけ更新する（O(1) per observation）
 * - マップ表示は集計ファイルだけ読めばよい（data/mesh_aggregates/current.json）
 * - メッシュコードが永続IDなので、公園・道路が変わっても安全
 *
 * 集計ファイル: data/mesh_aggregates/current.json
 * 構造:
 * {
 *   "52370536": {               // 3次メッシュコード（1km）
 *     "total": 45,
 *     "by_group": {"鳥類":12, "植物":28, "昆虫":5},
 *     "families": ["キク科","イネ科"],
 *     "genera": ["タンポポ属"],
 *     "bbox": [lat_sw, lng_sw, lat_ne, lng_ne],
 *     "first_obs": "2026-03-22",
 *     "last_obs": "2026-03-22"
 *   }
 * }
 */
class MeshAggregator
{
    private static string $cacheFile = 'mesh_aggregates/current';
    private static int $lockTimeout = 3; // seconds

    /**
     * 新しい観察をメッシュ集計に追加（差分更新）
     * passive_event.php / post_observation.php から呼ぶ
     */
    public static function addObservation(array $obs): void
    {
        $lat = (float)($obs['lat'] ?? $obs['location']['lat'] ?? 0);
        $lng = (float)($obs['lng'] ?? $obs['location']['lng'] ?? 0);
        if (!$lat || !$lng) return;

        require_once __DIR__ . '/MeshCode.php';
        $mesh = MeshCode::fromLatLng($lat, $lng);
        $mesh3 = $mesh['mesh3'];
        $bbox3 = $mesh['bbox3'];

        $higherGroup = $obs['higher_group'] ?? self::inferHigherGroup($obs);
        $family      = $obs['taxon']['family'] ?? null;
        $genus       = $obs['taxon']['genus'] ?? null;
        $speciesName = $obs['taxon']['name'] ?? $obs['species_name'] ?? null;
        $sciName     = $obs['taxon']['scientific_name'] ?? null;
        $date        = substr($obs['created_at'] ?? date('Y-m-d'), 0, 10);

        self::updateCell($mesh3, $bbox3, $higherGroup, $family, $genus, $speciesName, $sciName, $date);
    }

    /**
     * メッシュセルを差分更新（flock で並行書き込み保護）
     */
    private static function updateCell(
        string $mesh3,
        array  $bbox3,
        ?string $group,
        ?string $family,
        ?string $genus,
        ?string $speciesName,
        ?string $sciName,
        string  $date
    ): void {
        $path = DATA_DIR . '/' . self::$cacheFile . '.json';
        $dir  = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0777, true);

        $fp = fopen($path, 'c+');
        if (!$fp) return;

        if (!flock($fp, LOCK_EX | LOCK_NB)) {
            // ロック取得失敗は無視（次回の観察で補完される）
            fclose($fp);
            return;
        }

        clearstatcache(true, $path);
        rewind($fp);
        $content = stream_get_contents($fp);
        $agg = $content ? (json_decode($content, true) ?: []) : [];

        if (!isset($agg[$mesh3])) {
            $agg[$mesh3] = [
                'total'     => 0,
                'by_group'  => [],
                'families'  => [],
                'genera'    => [],
                'species'   => [],
                'bbox'      => $bbox3,
                'first_obs' => $date,
                'last_obs'  => $date,
            ];
        }

        $cell = &$agg[$mesh3];
        $cell['total']++;

        if ($group) {
            $cell['by_group'][$group] = ($cell['by_group'][$group] ?? 0) + 1;
        }
        if ($family && !in_array($family, $cell['families'], true)) {
            $cell['families'][] = $family;
            if (count($cell['families']) > 20) array_shift($cell['families']);
        }
        if ($genus && !in_array($genus, $cell['genera'], true)) {
            $cell['genera'][] = $genus;
            if (count($cell['genera']) > 30) array_shift($cell['genera']);
        }
        if ($speciesName && $speciesName !== 'Unknown') {
            if (!isset($cell['species'][$speciesName])) {
                $cell['species'][$speciesName] = [
                    'sci'   => $sciName ?? '',
                    'group' => $group ?? 'その他',
                    'count' => 0,
                ];
            }
            $cell['species'][$speciesName]['count']++;
            if (count($cell['species']) > 50) {
                uasort($cell['species'], fn($a, $b) => $b['count'] <=> $a['count']);
                $cell['species'] = array_slice($cell['species'], 0, 50, true);
            }
        }

        if ($date > $cell['last_obs']) $cell['last_obs'] = $date;

        $json = json_encode($agg, JSON_UNESCAPED_UNICODE);
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    /**
     * 集計データを取得（マップ表示用）
     * 大量observationsをスキャンせず、集計ファイルだけ読む
     */
    public static function getAll(): array
    {
        $path = DATA_DIR . '/' . self::$cacheFile . '.json';
        if (!file_exists($path)) return [];
        $content = file_get_contents($path);
        return $content ? (json_decode($content, true) ?: []) : [];
    }

    /**
     * 指定エリア内のメッシュセルだけ取得（マップ表示の最適化）
     */
    public static function getInBounds(float $latMin, float $lngMin, float $latMax, float $lngMax): array
    {
        $all = self::getAll();
        $result = [];
        foreach ($all as $code => $cell) {
            [$s, $w, $n, $e] = $cell['bbox'];
            if ($n < $latMin || $s > $latMax || $e < $lngMin || $w > $lngMax) continue;
            $result[$code] = $cell;
        }
        return $result;
    }

    /**
     * GeoJSON FeatureCollection としてエクスポート（マップ直接渡し用）
     */
    public static function toGeoJson(?array $bounds = null): array
    {
        require_once __DIR__ . '/MeshCode.php';
        $all = $bounds
            ? self::getInBounds($bounds[0], $bounds[1], $bounds[2], $bounds[3])
            : self::getAll();

        $features = [];
        foreach ($all as $code => $cell) {
            $topGroup = !empty($cell['by_group'])
                ? array_key_first(arsort_return($cell['by_group']))
                : null;

            $speciesList = [];
            $rawSpecies = $cell['species'] ?? [];
            uasort($rawSpecies, fn($a, $b) => $b['count'] <=> $a['count']);
            foreach (array_slice($rawSpecies, 0, 20, true) as $name => $sp) {
                $speciesList[] = [
                    'name'  => $name,
                    'sci'   => $sp['sci'] ?? '',
                    'group' => $sp['group'] ?? 'その他',
                    'count' => $sp['count'],
                ];
            }

            $features[] = MeshCode::toGeoJsonFeature($code, [
                'total'       => $cell['total'],
                'by_group'    => $cell['by_group'],
                'families'    => array_slice($cell['families'], 0, 5),
                'top_group'   => $topGroup,
                'last_obs'    => $cell['last_obs'],
                'group_count' => count($cell['by_group']),
                'species'     => $speciesList,
            ]);
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /**
     * 既存observationsから集計を全再構築（初回セットアップ・修復用）
     * 通常運用では使わない — スクリプトから手動実行
     */
    public static function rebuild(): int
    {
        require_once __DIR__ . '/DataStore.php';
        $path = DATA_DIR . '/mesh_aggregates/current.json';
        if (file_exists($path)) unlink($path);

        $count = 0;
        $allObs = DataStore::fetchAll('observations');
        foreach ($allObs as $obs) {
            self::addObservation($obs);
            $count++;
        }
        return $count;
    }

    /**
     * higher_group を taxon 情報から推定（Gemini が返せない場合のフォールバック）
     */
    public static function inferHigherGroup(array $obs): string
    {
        $src = $obs['observation_source'] ?? $obs['source'] ?? '';
        if (in_array($src, ['walk', 'walk-audio']) || ($obs['detection_type'] ?? '') === 'audio') {
            return '鳥類'; // BirdNET は鳥のみ
        }

        $sciName = strtolower($obs['taxon']['scientific_name'] ?? '');
        $jaName  = $obs['taxon']['name'] ?? '';

        // 学名プレフィックスで分類
        $birds    = ['aves', 'passeriformes', 'columbiformes', 'anseriformes', 'falconiformes', 'strigiformes'];
        $mammals  = ['mammalia', 'rodentia', 'carnivora', 'chiroptera'];
        $reptiles = ['reptilia', 'squamata', 'testudines'];
        $amphibia = ['amphibia', 'anura', 'caudata'];
        $fish     = ['actinopterygii', 'pisces', 'chondrichthyes'];
        $insects  = ['insecta', 'lepidoptera', 'coleoptera', 'diptera', 'hymenoptera', 'hemiptera', 'orthoptera'];
        $spiders  = ['arachnida', 'araneae'];
        $plants   = ['plantae', 'magnoliopsida', 'liliopsida', 'pinopsida', 'polypodiopsida', 'bryophyta'];
        $fungi    = ['fungi', 'basidiomycota', 'ascomycota'];

        foreach ($birds    as $k) if (str_contains($sciName, $k)) return '鳥類';
        foreach ($mammals  as $k) if (str_contains($sciName, $k)) return '哺乳類';
        foreach ($reptiles as $k) if (str_contains($sciName, $k)) return '爬虫類';
        foreach ($amphibia as $k) if (str_contains($sciName, $k)) return '両生類';
        foreach ($fish     as $k) if (str_contains($sciName, $k)) return '魚類';
        foreach ($insects  as $k) if (str_contains($sciName, $k)) return '昆虫';
        foreach ($spiders  as $k) if (str_contains($sciName, $k)) return 'クモ類';
        foreach ($fungi    as $k) if (str_contains($sciName, $k)) return '菌類';
        foreach ($plants   as $k) if (str_contains($sciName, $k)) return '植物';

        // 和名キーワード
        if (preg_match('/鳥|ウグイス|スズメ|ツバメ|カラス|ヒヨドリ|カワセミ|サギ|カモ|タカ|フクロウ|キツツキ/', $jaName)) return '鳥類';
        if (preg_match('/チョウ|ガ|トンボ|バッタ|カマキリ|テントウ|カブトムシ|クワガタ|アリ|ハチ|アブ|カ|ハエ|セミ|コオロギ/', $jaName)) return '昆虫';
        if (preg_match('/クモ|サソリ|ダニ/', $jaName)) return 'クモ類';
        if (preg_match('/カエル|サンショウウオ|イモリ/', $jaName)) return '両生類';
        if (preg_match('/ヘビ|トカゲ|カメ|ヤモリ/', $jaName)) return '爬虫類';
        if (preg_match('/タヌキ|キツネ|イノシシ|シカ|テン|ムササビ|コウモリ|ネコ|イヌ|ウサギ/', $jaName)) return '哺乳類';
        if (preg_match('/キノコ|菌|カビ|酵母/', $jaName)) return '菌類';
        if (preg_match('/コケ|地衣/', $jaName)) return 'コケ・地衣類';
        if (preg_match('/樹|草|花|葉|木|林|森|科|属|シダ|ソテツ|針葉|広葉/', $jaName)) return '植物';

        return 'その他';
    }
}

/**
 * arsort して最初のキーを返すヘルパー
 */
function arsort_return(array $arr): array
{
    arsort($arr);
    return $arr;
}
