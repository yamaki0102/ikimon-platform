<?php

/**
 * EnvSegmentStore — 環境区間データの永続化
 *
 * FieldScan v0.9.0 の SpatialSegmentBuilder が生成した環境セグメントを
 * DATA_DIR/env_segments/{YYYY-MM}.json にパーティション保存する。
 *
 * 「Google Earth では見えない地上環境レイヤー」の蓄積基盤。
 */
class EnvSegmentStore
{
    private const DIR = 'env_segments';

    /**
     * セグメントを保存する。segment_id でべき等（同一IDは上書き）。
     *
     * @param array $segment セグメントデータ
     * @return bool
     */
    public static function save(array $segment): bool
    {
        $segmentId = $segment['segment_id'] ?? '';
        if (empty($segmentId)) return false;

        $timestamp = $segment['start_timestamp'] ?? ($segment['timestamp'] ?? time() * 1000);
        $partition = date('Y-m', (int)($timestamp / 1000));

        $dir = DATA_DIR . self::DIR;
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filePath = $dir . '/' . $partition . '.json';
        $existing = [];

        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $decoded = json_decode($content, true);
            if (is_array($decoded)) {
                $existing = $decoded;
            }
        }

        // べき等: 同一 segment_id は上書き
        $found = false;
        foreach ($existing as $i => $item) {
            if (($item['segment_id'] ?? '') === $segmentId) {
                $existing[$i] = $segment;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $existing[] = $segment;
        }

        $json = json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT);
        return file_put_contents($filePath, $json, LOCK_EX) !== false;
    }

    /**
     * セッション内のセグメントを一括保存する。
     *
     * @param array $segments セグメント配列
     * @param string $sessionId セッションID
     * @return int 保存件数
     */
    public static function saveBatch(array $segments, string $sessionId): int
    {
        $saved = 0;
        foreach ($segments as $segment) {
            $segment['session_id'] = $sessionId;
            if (self::save($segment)) {
                $saved++;
            }
        }
        return $saved;
    }

    /**
     * 指定月のセグメントを全取得する。
     *
     * @param string $partition YYYY-MM
     * @return array
     */
    public static function fetchByMonth(string $partition): array
    {
        $filePath = DATA_DIR . self::DIR . '/' . $partition . '.json';
        if (!file_exists($filePath)) return [];

        $content = file_get_contents($filePath);
        $decoded = json_decode($content, true);
        return is_array($decoded) ? $decoded : [];
    }

    /**
     * セッションIDでセグメントを取得する。
     *
     * @param string $sessionId
     * @return array
     */
    public static function fetchBySession(string $sessionId): array
    {
        $dir = DATA_DIR . self::DIR;
        if (!is_dir($dir)) return [];

        $results = [];
        foreach (glob($dir . '/*.json') as $file) {
            $content = file_get_contents($file);
            $segments = json_decode($content, true);
            if (!is_array($segments)) continue;

            foreach ($segments as $seg) {
                if (($seg['session_id'] ?? '') === $sessionId) {
                    $results[] = $seg;
                }
            }
        }

        usort($results, fn($a, $b) => ($a['start_timestamp'] ?? 0) <=> ($b['start_timestamp'] ?? 0));
        return $results;
    }
}
