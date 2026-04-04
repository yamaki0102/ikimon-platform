<?php
declare(strict_types=1);

/**
 * WeatherContext — 観測時刻の気象データ自動結合エンジン
 *
 * Open-Meteo Archive API (無料・商用OK・APIキー不要) を利用し、
 * 観測の緯度経度・日時から気象コンテキストを取得。
 * SQLite キャッシュで同一地点・同一日の再取得を防止。
 *
 * 生態デジタルツイン基盤: 「なぜこの種がここにいるか」の環境説明力を付与。
 */
class WeatherContext
{
    private static ?PDO $db = null;
    private const CACHE_TTL = 86400 * 30; // 30日キャッシュ（過去気象は不変）
    private const API_BASE = 'https://archive-api.open-meteo.com/v1/archive';
    private const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';
    private const HOURLY_PARAMS = 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover,weather_code';

    private static function db(): PDO
    {
        if (self::$db) return self::$db;
        $path = DATA_DIR . '/weather_cache.sqlite3';
        $isNew = !file_exists($path);
        self::$db = new PDO('sqlite:' . $path);
        self::$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if ($isNew) self::initDb();
        return self::$db;
    }

    private static function initDb(): void
    {
        self::$db->exec("
            CREATE TABLE IF NOT EXISTS weather_cache (
                cache_key TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_weather_cache_time ON weather_cache(created_at);
        ");
    }

    /**
     * 観測の気象コンテキストを取得
     *
     * @param float $lat 緯度
     * @param float $lng 経度
     * @param string $observedAt 観測日時 (Y-m-d H:i or Y-m-d H:i:s)
     * @return array{
     *   temperature_c: ?float,
     *   humidity_pct: ?int,
     *   precipitation_mm: ?float,
     *   wind_speed_ms: ?float,
     *   cloud_cover_pct: ?int,
     *   weather_code: ?int,
     *   weather_label: string,
     *   source: string,
     *   observed_hour: string
     * }|null
     */
    public static function getForObservation(float $lat, float $lng, string $observedAt): ?array
    {
        try {
            $dt = new DateTime($observedAt);
        } catch (\Exception $e) {
            return null;
        }

        $date = $dt->format('Y-m-d');
        $hour = (int)$dt->format('G');

        $gridKey = self::gridKey($lat, $lng, $date);
        $cached = self::getCache($gridKey);
        if ($cached !== null) {
            return self::extractHour($cached, $hour);
        }

        $hourlyData = self::fetchFromApi($lat, $lng, $date);
        if ($hourlyData === null) {
            return null;
        }

        self::setCache($gridKey, $hourlyData);
        return self::extractHour($hourlyData, $hour);
    }

    /**
     * API から日別の時間帯気象データを取得
     */
    private static function fetchFromApi(float $lat, float $lng, string $date): ?array
    {
        $today = date('Y-m-d');
        $isRecent = $date >= $today;

        if ($isRecent) {
            $url = self::FORECAST_BASE . '?' . http_build_query([
                'latitude' => round($lat, 4),
                'longitude' => round($lng, 4),
                'hourly' => self::HOURLY_PARAMS,
                'start_date' => $date,
                'end_date' => $date,
                'timezone' => 'Asia/Tokyo',
            ]);
        } else {
            $url = self::API_BASE . '?' . http_build_query([
                'latitude' => round($lat, 4),
                'longitude' => round($lng, 4),
                'hourly' => self::HOURLY_PARAMS,
                'start_date' => $date,
                'end_date' => $date,
                'timezone' => 'Asia/Tokyo',
            ]);
        }

        $ctx = stream_context_create([
            'http' => [
                'timeout' => 5,
                'header' => "User-Agent: ikimon.life/1.0 (citizen-science; contact@ikimon.life)\r\n",
            ],
        ]);

        $response = @file_get_contents($url, false, $ctx);
        if ($response === false) {
            error_log('WeatherContext: API request failed for ' . $date . ' at ' . $lat . ',' . $lng);
            return null;
        }

        $data = json_decode($response, true);
        if (!isset($data['hourly']['time'])) {
            error_log('WeatherContext: Unexpected API response structure');
            return null;
        }

        return $data['hourly'];
    }

    /**
     * 時間帯データから特定の時間のデータを抽出
     */
    private static function extractHour(array $hourlyData, int $hour): ?array
    {
        $times = $hourlyData['time'] ?? [];
        $idx = null;

        foreach ($times as $i => $t) {
            $h = (int)(new DateTime($t))->format('G');
            if ($h === $hour) {
                $idx = $i;
                break;
            }
        }

        if ($idx === null && !empty($times)) {
            $idx = min($hour, count($times) - 1);
        }

        if ($idx === null) {
            return null;
        }

        $weatherCode = $hourlyData['weather_code'][$idx] ?? null;

        return [
            'temperature_c' => $hourlyData['temperature_2m'][$idx] ?? null,
            'humidity_pct' => isset($hourlyData['relative_humidity_2m'][$idx])
                ? (int)$hourlyData['relative_humidity_2m'][$idx] : null,
            'precipitation_mm' => $hourlyData['precipitation'][$idx] ?? null,
            'wind_speed_ms' => isset($hourlyData['wind_speed_10m'][$idx])
                ? round((float)$hourlyData['wind_speed_10m'][$idx] / 3.6, 1) : null,
            'cloud_cover_pct' => isset($hourlyData['cloud_cover'][$idx])
                ? (int)$hourlyData['cloud_cover'][$idx] : null,
            'weather_code' => $weatherCode,
            'weather_label' => self::weatherCodeToLabel($weatherCode),
            'source' => 'open-meteo',
            'observed_hour' => sprintf('%02d:00', $hour),
        ];
    }

    /**
     * WMO Weather Code → 日本語ラベル
     * https://open-meteo.com/en/docs#weathervariables
     */
    public static function weatherCodeToLabel(?int $code): string
    {
        if ($code === null) return '不明';

        $labels = [
            0 => '快晴',
            1 => '晴れ', 2 => 'やや曇り', 3 => '曇り',
            45 => '霧', 48 => '着氷霧',
            51 => '弱い霧雨', 53 => '霧雨', 55 => '強い霧雨',
            56 => '弱い着氷霧雨', 57 => '強い着氷霧雨',
            61 => '弱い雨', 63 => '雨', 65 => '強い雨',
            66 => '弱い着氷雨', 67 => '強い着氷雨',
            71 => '弱い雪', 73 => '雪', 75 => '強い雪',
            77 => '霧雪',
            80 => '弱いにわか雨', 81 => 'にわか雨', 82 => '激しいにわか雨',
            85 => '弱いにわか雪', 86 => '激しいにわか雪',
            95 => '雷雨',
            96 => 'やや雹の雷雨', 99 => '激しい雹の雷雨',
        ];

        return $labels[$code] ?? '不明';
    }

    /**
     * グリッドキー: 緯度経度を0.1度グリッドに丸め + 日付
     * (~11km精度。気象データの空間解像度に適合)
     */
    private static function gridKey(float $lat, float $lng, string $date): string
    {
        $gridLat = round($lat, 1);
        $gridLng = round($lng, 1);
        return "weather:{$gridLat}:{$gridLng}:{$date}";
    }

    private static function getCache(string $key): ?array
    {
        try {
            $db = self::db();
            $stmt = $db->prepare('SELECT data, created_at FROM weather_cache WHERE cache_key = ?');
            $stmt->execute([$key]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) return null;
            if (time() - (int)$row['created_at'] > self::CACHE_TTL) {
                $db->prepare('DELETE FROM weather_cache WHERE cache_key = ?')->execute([$key]);
                return null;
            }

            return json_decode($row['data'], true);
        } catch (\Exception $e) {
            return null;
        }
    }

    private static function setCache(string $key, array $data): void
    {
        try {
            $db = self::db();
            $stmt = $db->prepare('INSERT OR REPLACE INTO weather_cache (cache_key, data, created_at) VALUES (?, ?, ?)');
            $stmt->execute([$key, json_encode($data), time()]);
        } catch (\Exception $e) {
            error_log('WeatherContext: Cache write failed: ' . $e->getMessage());
        }

        self::pruneCache();
    }

    private static function pruneCache(): void
    {
        if (mt_rand(1, 50) !== 1) return; // 2%の確率でクリーンアップ
        try {
            $db = self::db();
            $db->prepare('DELETE FROM weather_cache WHERE created_at < ?')
                ->execute([time() - self::CACHE_TTL]);
        } catch (\Exception $e) {
            // ignore
        }
    }

    /**
     * 気象コンテキストの要約（UI表示用）
     */
    public static function summarize(?array $weather): string
    {
        if (!$weather) return '';

        $parts = [];
        if ($weather['weather_label'] !== '不明') {
            $parts[] = $weather['weather_label'];
        }
        if ($weather['temperature_c'] !== null) {
            $parts[] = $weather['temperature_c'] . '°C';
        }
        if ($weather['humidity_pct'] !== null) {
            $parts[] = '湿度' . $weather['humidity_pct'] . '%';
        }
        if ($weather['wind_speed_ms'] !== null && $weather['wind_speed_ms'] > 0) {
            $parts[] = '風速' . $weather['wind_speed_ms'] . 'm/s';
        }

        return implode(' / ', $parts);
    }
}
