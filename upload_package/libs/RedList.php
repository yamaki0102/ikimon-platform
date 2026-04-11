<?php
/**
 * RedList — Legacy bridge → RedListManager v2
 *
 * 旧コードは RedList::check($taxon_key) / RedList::getCategory($taxon_key) を使用。
 * 新コードは RedListManager を直接使う。
 * このクラスは既存呼び出し箇所との後方互換を保ちつつ、実体を RedListManager に委譲する。
 *
 * 戻り値フォーマット (後方互換):
 *   ['ranks' => ['scope_key' => ['code' => 'CR', 'label' => '絶滅危惧IA類', 'authority' => '...']]]
 *   または null
 */

class RedList
{
    private static ?RedListManager $rlm = null;

    private static function getManager(): RedListManager
    {
        if (self::$rlm === null) {
            require_once __DIR__ . '/RedListManager.php';
            self::$rlm = new RedListManager();
        }
        return self::$rlm;
    }

    /**
     * @param string|int $taxon_key 和名 または GBIF taxon key
     * @return array|null ['ranks' => [...]] 形式、またはリスト未掲載なら null
     */
    public static function check($taxon_key): ?array
    {
        try {
            $rlm    = self::getManager();
            $isInt  = is_int($taxon_key) || (is_string($taxon_key) && ctype_digit((string)$taxon_key));
            $id     = $isInt ? (int)$taxon_key : null;
            $name   = $isInt ? null : (string)$taxon_key;
            $result = $rlm->lookupTaxon($id, $name);
            if ($result === null) return null;

            $ranks = [];
            foreach ($result as $scopeKey => $entries) {
                $entries = isset($entries[0]) ? $entries : [$entries];
                foreach ($entries as $entry) {
                    $cat = $entry['category'] ?? '';
                    if ($cat) {
                        $ranks[$scopeKey] = [
                            'code'      => $cat,
                            'label'     => RedListManager::getCategoryLabel($cat),
                            'color'     => RedListManager::getCategoryColor($cat),
                            'authority' => $entry['authority'] ?? '',
                            'scope'     => $scopeKey,
                        ];
                        break;
                    }
                }
            }
            return $ranks ? ['ranks' => $ranks] : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * @param string|int $taxon_key
     * @return string|null IUCN カテゴリコード (e.g. 'CR') または null
     */
    public static function getCategory($taxon_key): ?string
    {
        try {
            $rlm   = self::getManager();
            $isInt = is_int($taxon_key) || (is_string($taxon_key) && ctype_digit((string)$taxon_key));
            $id    = $isInt ? (int)$taxon_key : null;
            $name  = $isInt ? null : (string)$taxon_key;
            $row   = $rlm->getHighestSeverity($name ?? '', $name ? null : null);
            return $row ? ($row['category'] ?? null) : null;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
