<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

/**
 * AdminAlertManager — 重要観察の管理者通知
 *
 * critical 判定（significance_score >= 60）の観察を
 * system/admin_alerts に記録する。
 *
 * 管理者は /admin/ ダッシュボード等で未読アラートを確認できる。
 * 通知ロジック（メール等）は将来拡張予定。
 */
class AdminAlertManager
{
    private const ALERTS_FILE = 'system/admin_alerts';

    /**
     * critical 観察を管理者アラートとして記録する。
     * normal / important は記録しない。
     *
     * @param array $observation 観察データ
     * @param array $significance ObservationSignificanceScorer::score() の返り値
     */
    public static function notify(array $observation, array $significance): void
    {
        if (($significance['sensitivity_level'] ?? 'normal') !== 'critical') {
            return;
        }

        $observationId = (string)($observation['id'] ?? '');
        if ($observationId === '') {
            return;
        }

        $taxonName = (string)(
            $observation['taxon']['name'] ??
            $observation['taxon_name'] ??
            $observation['species_name'] ??
            '不明'
        );

        $alert = [
            'id'                => 'alert-' . substr(bin2hex(random_bytes(6)), 0, 12),
            'observation_id'    => $observationId,
            'taxon_name'        => $taxonName,
            'redlist_category'  => $significance['redlist_category'] ?? null,
            'distribution_rarity' => $significance['distribution_rarity'] ?? null,
            'is_invasive'       => $significance['is_invasive'] ?? false,
            'significance_score' => $significance['significance_score'] ?? 0,
            'reasons'           => $significance['reasons'] ?? [],
            'prefecture'        => (string)($observation['prefecture'] ?? ''),
            'municipality'      => (string)($observation['municipality'] ?? ''),
            'observed_at'       => (string)($observation['observed_at'] ?? ''),
            'created_at'        => date('c'),
            'status'            => 'unread',
        ];

        try {
            DataStore::append(self::ALERTS_FILE, $alert);
        } catch (\Throwable $e) {
            error_log('AdminAlertManager: failed to append alert — ' . $e->getMessage());
        }
    }

    /**
     * 全アラートを取得する（管理者ダッシュボード用）。
     *
     * @param array $options ['status' => 'unread'|'all', 'limit' => int]
     * @return array
     */
    public static function list(array $options = []): array
    {
        try {
            $all = DataStore::get(self::ALERTS_FILE, []);
            if (!is_array($all)) {
                return [];
            }

            $statusFilter = $options['status'] ?? 'all';
            if ($statusFilter !== 'all') {
                $all = array_filter($all, fn($a) => ($a['status'] ?? 'unread') === $statusFilter);
            }

            $all = array_values($all);
            usort($all, fn($a, $b) => strcmp((string)($b['created_at'] ?? ''), (string)($a['created_at'] ?? '')));

            $limit = (int)($options['limit'] ?? 200);
            return array_slice($all, 0, $limit);
        } catch (\Throwable $e) {
            return [];
        }
    }

    /**
     * アラートを既読にマークする。
     *
     * @param string $alertId
     */
    public static function markRead(string $alertId): bool
    {
        try {
            $all = DataStore::get(self::ALERTS_FILE, []);
            if (!is_array($all)) {
                return false;
            }

            $updated = false;
            foreach ($all as &$alert) {
                if (($alert['id'] ?? '') === $alertId) {
                    $alert['status'] = 'read';
                    $alert['read_at'] = date('c');
                    $updated = true;
                    break;
                }
            }
            unset($alert);

            if ($updated) {
                DataStore::save(self::ALERTS_FILE, $all);
            }

            return $updated;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * 未読アラート件数を返す（ヘッダーバッジ表示用）。
     */
    public static function unreadCount(): int
    {
        try {
            $all = DataStore::get(self::ALERTS_FILE, []);
            if (!is_array($all)) {
                return 0;
            }
            return count(array_filter($all, fn($a) => ($a['status'] ?? 'unread') === 'unread'));
        } catch (\Throwable $e) {
            return 0;
        }
    }
}
