<?php
declare(strict_types=1);

/**
 * InvasiveAlertManager — Phase 15B P1
 * 外来種マスタ照合・アラート生成クラス
 * 環境省「特定外来生物」「生態系被害防止外来種リスト」に基づく
 */
class InvasiveAlertManager
{
    private static ?array $cache = null;

    private static function dataPath(): string
    {
        return DATA_DIR . '/masters/invasive_species.json';
    }

    /**
     * 種名・学名で外来種マスタを照合し、アラートデータを返す。
     * 一致しない場合は null を返す。
     *
     * @param string $taxonName   和名または通称
     * @param string $scientificName 学名（省略可）
     * @return array{is_invasive:true,name:string,scientific_name:string,category:string,risk_level:string,description:string,action:string}|null
     */
    public static function check(string $taxonName, string $scientificName = ''): ?array
    {
        $list = self::load();
        $nameLower = mb_strtolower(trim($taxonName));
        $sciLower  = mb_strtolower(trim($scientificName));

        foreach ($list as $species) {
            $candidateName = mb_strtolower((string)($species['name'] ?? ''));
            $candidateSci  = mb_strtolower((string)($species['scientific_name'] ?? ''));

            if ($candidateName !== '' && $candidateName === $nameLower) {
                return self::buildAlert($species);
            }

            if ($sciLower !== '' && $candidateSci !== '' && $candidateSci === $sciLower) {
                return self::buildAlert($species);
            }
        }

        return null;
    }

    /**
     * 部分一致で複数候補を返す（将来の検索用途向け）
     *
     * @param string $query
     * @param int    $limit
     * @return array
     */
    public static function search(string $query, int $limit = 10): array
    {
        $list    = self::load();
        $q       = mb_strtolower(trim($query));
        $results = [];

        if ($q === '') {
            return [];
        }

        foreach ($list as $species) {
            $name = mb_strtolower((string)($species['name'] ?? ''));
            $sci  = mb_strtolower((string)($species['scientific_name'] ?? ''));

            if (str_contains($name, $q) || str_contains($sci, $q)) {
                $results[] = self::buildAlert($species);
                if (count($results) >= $limit) {
                    break;
                }
            }
        }

        return $results;
    }

    /**
     * 全件返す（管理用途）
     */
    public static function listAll(): array
    {
        return self::load();
    }

    private static function buildAlert(array $species): array
    {
        return [
            'is_invasive'     => true,
            'name'            => (string)($species['name'] ?? ''),
            'scientific_name' => (string)($species['scientific_name'] ?? ''),
            'category'        => (string)($species['category'] ?? ''),
            'risk_level'      => (string)($species['risk_level'] ?? 'Medium'),
            'description'     => (string)($species['description'] ?? ''),
            'action'          => (string)($species['action'] ?? ''),
        ];
    }

    private static function load(): array
    {
        if (self::$cache === null) {
            $path = self::dataPath();
            $raw  = @file_get_contents($path);
            if ($raw === false) {
                self::$cache = [];
                error_log('InvasiveAlertManager: data file not found: ' . $path);
                return self::$cache;
            }
            $decoded = json_decode($raw, true);
            self::$cache = is_array($decoded) ? $decoded : [];
        }

        return self::$cache;
    }
}
