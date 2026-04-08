<?php

/**
 * MeshBiodiversityScorer — メッシュセル単位のBISスコア計算
 *
 * MeshAggregator の集計データに MonitoringReferenceScorer を適用し、
 * 各1kmメッシュの生物多様性スコアを算出する。
 *
 * 成長段階:
 *   S(充実/80+) → A(豊か/60+) → B(成長中/40+) → C(芽吹き/20+) → D(発見/0+)
 *
 * キャッシュ: data/mesh_scores/current.json
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/BiodiversityScorer.php';
require_once __DIR__ . '/MeshAggregator.php';

class MeshBiodiversityScorer
{
    private static string $cacheFile = 'mesh_scores/current.json';

    const STAGES = [
        'S' => ['min' => 80, 'label' => '充実',   'color' => '#ef4444'],
        'A' => ['min' => 60, 'label' => '豊か',   'color' => '#f59e0b'],
        'B' => ['min' => 40, 'label' => '成長中', 'color' => '#10b981'],
        'C' => ['min' => 20, 'label' => '芽吹き', 'color' => '#3b82f6'],
        'D' => ['min' => 0,  'label' => '発見',   'color' => '#94a3b8'],
    ];

    /**
     * メッシュセルのスコアを計算
     *
     * MeshAggregator のセルデータ（species, by_group, total 等）から
     * MonitoringReferenceScorer が受け付ける observations 配列を再構成して計算。
     */
    public static function scoreMesh(string $meshCode, array $cellData): array
    {
        $species = $cellData['species'] ?? [];
        if (empty($species)) {
            return self::emptyScore($meshCode);
        }

        // MeshAggregator の species データから observations を再構成
        // species: { "シジュウカラ": { "sci": "Parus minor", "group": "鳥類", "count": 3 }, ... }
        $observations = [];
        foreach ($species as $name => $sp) {
            $group = self::mapGroupToTaxon($sp['group'] ?? 'その他');
            for ($i = 0; $i < $sp['count']; $i++) {
                $observations[] = [
                    'taxon' => [
                        'id'              => null,
                        'name'            => $name,
                        'scientific_name' => $sp['sci'] ?? '',
                        'group'           => $group,
                    ],
                    'observed_at'  => $cellData['last_obs'] ?? date('Y-m-d'),
                    'data_quality' => 'B', // メッシュ集計では個別品質不明、中間値
                ];
            }
        }

        // 日付の分散を first_obs〜last_obs から推定（月数カウント用）
        $firstObs = $cellData['first_obs'] ?? null;
        $lastObs  = $cellData['last_obs'] ?? null;
        if ($firstObs && $lastObs && $firstObs !== $lastObs) {
            // 観察を日付的に分散させて MonitoringEffort を正しく評価
            $half = (int)floor(count($observations) / 2);
            for ($i = 0; $i < $half; $i++) {
                $observations[$i]['observed_at'] = $firstObs;
            }
        }

        // 1km メッシュの面積は約 1.06 km² = 106 ha
        $result = MonitoringReferenceScorer::calculate($observations, ['area_ha' => 106]);

        $score = $result['total_score'];
        $stage = self::scoreToStage($score);

        return [
            'score'          => $score,
            'stage'          => $stage,
            'label'          => self::STAGES[$stage]['label'],
            'richness'       => $result['breakdown']['richness']['score'] ?? 0,
            'conservation'   => $result['breakdown']['conservation_value']['score'] ?? 0,
            'coverage'       => $result['breakdown']['taxonomic_coverage']['score'] ?? 0,
            'confidence'     => $result['breakdown']['data_confidence']['score'] ?? 0,
            'effort'         => $result['breakdown']['monitoring_effort']['score'] ?? 0,
            'red_list_count' => $result['breakdown']['conservation_value']['raw'] ?? 0,
            'species_count'  => $result['species_count'],
            'evaluation'     => $result['evaluation'],
        ];
    }

    /**
     * 全メッシュの BIS スコアを一括計算してキャッシュ保存
     */
    public static function buildAndCache(): array
    {
        $meshData = MeshAggregator::getAll();
        $scores = [];

        foreach ($meshData as $meshCode => $cellData) {
            $scores[$meshCode] = self::scoreMesh($meshCode, $cellData);
        }

        self::saveCache($scores);
        return $scores;
    }

    /**
     * 単一メッシュセルのスコアを再計算してキャッシュを部分更新
     */
    public static function updateCell(string $meshCode, array $cellData): void
    {
        $score = self::scoreMesh($meshCode, $cellData);

        $path = DATA_DIR . '/' . self::$cacheFile;
        $dir  = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0777, true);

        $fp = fopen($path, 'c+');
        if (!$fp) return;

        if (!flock($fp, LOCK_EX | LOCK_NB)) {
            fclose($fp);
            return;
        }

        clearstatcache(true, $path);
        rewind($fp);
        $content = stream_get_contents($fp);
        $scores = $content ? (json_decode($content, true) ?: []) : [];

        $scores[$meshCode] = $score;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($scores, JSON_UNESCAPED_UNICODE));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    /**
     * キャッシュ済みスコアを全取得
     */
    public static function getAll(): array
    {
        $path = DATA_DIR . '/' . self::$cacheFile;
        if (!file_exists($path)) return [];
        $content = file_get_contents($path);
        return $content ? (json_decode($content, true) ?: []) : [];
    }

    /**
     * 指定エリア内のスコアを取得
     */
    public static function getInBounds(float $latMin, float $lngMin, float $latMax, float $lngMax): array
    {
        require_once __DIR__ . '/MeshCode.php';

        $all = self::getAll();
        $result = [];
        foreach ($all as $code => $score) {
            $bbox = MeshCode::bbox3($code);
            [$s, $w, $n, $e] = $bbox;
            if ($n < $latMin || $s > $latMax || $e < $lngMin || $w > $lngMax) continue;
            $result[$code] = $score;
        }
        return $result;
    }

    /**
     * 統計サマリーを取得
     */
    public static function getSummary(): array
    {
        $scores = self::getAll();
        if (empty($scores)) {
            return [
                'total_meshes'   => 0,
                'total_species'  => 0,
                'red_list_total' => 0,
                'by_stage'       => array_fill_keys(array_keys(self::STAGES), 0),
            ];
        }

        $byStage = array_fill_keys(array_keys(self::STAGES), 0);
        $totalSpecies = 0;
        $redListTotal = 0;

        foreach ($scores as $s) {
            $byStage[$s['stage']] = ($byStage[$s['stage']] ?? 0) + 1;
            $totalSpecies = max($totalSpecies, $s['species_count']);
            $redListTotal += $s['red_list_count'];
        }

        return [
            'total_meshes'   => count($scores),
            'total_species'  => $totalSpecies,
            'red_list_total' => $redListTotal,
            'by_stage'       => $byStage,
        ];
    }

    // ── Private helpers ──

    private static function scoreToStage(int $score): string
    {
        foreach (self::STAGES as $stage => $def) {
            if ($score >= $def['min']) return $stage;
        }
        return 'D';
    }

    private static function emptyScore(string $meshCode): array
    {
        return [
            'score'          => 0,
            'stage'          => 'D',
            'label'          => '発見',
            'richness'       => 0,
            'conservation'   => 0,
            'coverage'       => 0,
            'confidence'     => 0,
            'effort'         => 0,
            'red_list_count' => 0,
            'species_count'  => 0,
            'evaluation'     => '判断に十分なデータがまだ少ない状態',
        ];
    }

    /**
     * 日本語グループ名を MonitoringReferenceScorer が期待する英語分類名にマッピング
     */
    private static function mapGroupToTaxon(string $group): string
    {
        return match ($group) {
            '鳥類'         => 'Aves',
            '昆虫'         => 'Insecta',
            '植物'         => 'Plantae',
            '哺乳類'       => 'Mammalia',
            '爬虫類'       => 'Reptilia',
            '両生類'       => 'Amphibia',
            '魚類'         => 'Actinopterygii',
            'クモ類'       => 'Arachnida',
            '菌類'         => 'Fungi',
            'コケ・地衣類' => 'Bryophyta',
            default        => $group,
        };
    }

    private static function saveCache(array $scores): void
    {
        $path = DATA_DIR . '/' . self::$cacheFile;
        $dir  = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0777, true);

        file_put_contents(
            $path,
            json_encode($scores, JSON_UNESCAPED_UNICODE),
            LOCK_EX
        );
    }
}
