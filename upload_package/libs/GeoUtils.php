<?php
class GeoUtils
{
    /**
     * Check if a point is inside a polygon
     * Ray-casting algorithm
     * @param float $lat Point Latitude
     * @param float $lng Point Longitude
     * @param array $polygon Array of [lng, lat] (GeoJSON format)
     * @return bool
     */
    public static function isPointInPolygon($lat, $lng, $polygon)
    {
        $lastPoint = $polygon[count($polygon) - 1];
        $isInside = false;
        $x = $lng;
        $y = $lat;

        foreach ($polygon as $point) {
            $x1 = $lastPoint[0];
            $y1 = $lastPoint[1];
            $x2 = $point[0];
            $y2 = $point[1];

            if ((($y1 < $y && $y2 >= $y) || ($y2 < $y && $y1 >= $y)) && ($x1 <= $x || $x2 <= $x)) {
                if ($x1 + ($y - $y1) / ($y2 - $y1) * ($x2 - $x1) < $x) {
                    $isInside = !$isInside;
                }
            }
            $lastPoint = $point;
        }

        return $isInside;
    }

    /**
     * Calculate Distance between two points (Haversine)
     */
    public static function distance($lat1, $lng1, $lat2, $lng2)
    {
        $earthRadius = 6371000; // meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    // =========================================================================
    // Ambient Presence — Position Anonymization (3-Layer Privacy)
    // =========================================================================

    /**
     * Grid size constants (meters → approximate degree offset)
     * Urban: 500m grid, Suburban: 1km grid, Rural: 2km grid
     */
    const GRID_URBAN_M   = 500;
    const GRID_SUBURBAN_M = 1000;
    const GRID_RURAL_M   = 2000;
    const GRID_PROTECTED_M = 5000; // endangered species: 5km blur

    /**
     * Round lat/lng to the nearest grid cell center.
     * Grid size is specified in meters and converted to degrees.
     *
     * @param float $lat   Latitude
     * @param float $lng   Longitude
     * @param int   $gridM Grid size in meters (default: 1000 = 1km)
     * @return array ['lat' => float, 'lng' => float] — grid cell center
     */
    public static function roundToGrid(float $lat, float $lng, int $gridM = 1000): array
    {
        // 1 degree latitude ≈ 111,320 meters
        $latDeg = $gridM / 111320.0;
        // 1 degree longitude varies by latitude
        $lngDeg = $gridM / (111320.0 * cos(deg2rad($lat)));

        // Snap to grid cell then offset to center
        $roundedLat = floor($lat / $latDeg) * $latDeg + ($latDeg / 2);
        $roundedLng = floor($lng / $lngDeg) * $lngDeg + ($lngDeg / 2);

        return [
            'lat' => round($roundedLat, 6),
            'lng' => round($roundedLng, 6),
        ];
    }

    /**
     * Get a deterministic, non-reversible grid cell ID for a given position.
     * Used for grouping observations without revealing exact location.
     *
     * @param float $lat   Latitude
     * @param float $lng   Longitude
     * @param int   $gridM Grid size in meters
     * @return string  8-char hex hash (e.g. "a3f1b2c4")
     */
    public static function getGridCellId(float $lat, float $lng, int $gridM = 1000): string
    {
        $cell = self::roundToGrid($lat, $lng, $gridM);
        $raw = sprintf("%.6f:%.6f:%d", $cell['lat'], $cell['lng'], $gridM);
        return substr(md5($raw), 0, 8);
    }

    /**
     * Smart anonymization: auto-select grid size based on context.
     * - Protected/endangered species → 5km blur (mandatory)
     * - Otherwise use the specified grid size
     *
     * Also applies minimum time delay (caller is responsible for
     * actual time-gating; this method returns the delay in seconds).
     *
     * @param float  $lat           Latitude
     * @param float  $lng           Longitude
     * @param bool   $isProtected   Whether the species is on a red/protection list
     * @param int    $gridM         Default grid size (fallback)
     * @return array [
     *   'lat'      => float,   // anonymized latitude
     *   'lng'      => float,   // anonymized longitude
     *   'cell_id'  => string,  // grid cell hash
     *   'grid_m'   => int,     // actual grid size used
     *   'delay_s'  => int,     // minimum publication delay in seconds
     * ]
     */
    public static function roundForAmbient(
        float $lat,
        float $lng,
        bool $isProtected = false,
        int $gridM = 1000
    ): array {
        // Protected species always get maximum blur
        $effectiveGrid = $isProtected ? self::GRID_PROTECTED_M : $gridM;
        // Minimum delay: 3 hours for normal, 24 hours for protected
        $delaySec = $isProtected ? 86400 : 10800;

        $cell = self::roundToGrid($lat, $lng, $effectiveGrid);
        $cellId = self::getGridCellId($lat, $lng, $effectiveGrid);

        return [
            'lat'     => $cell['lat'],
            'lng'     => $cell['lng'],
            'cell_id' => $cellId,
            'grid_m'  => $effectiveGrid,
            'delay_s' => $delaySec,
        ];
    }

    // =========================================================================
    // Reverse Geocoding — Nominatim Integration
    // =========================================================================

    /**
     * Reverse geocode lat/lng to get country, prefecture, municipality.
     * Uses Nominatim API (max 1 req/sec, User-Agent required).
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return array ['country' => 'JP', 'prefecture' => 'JP-22', 'municipality' => '静岡市']
     */
    public static function reverseGeocode(float $lat, float $lng): array
    {
        $result = [
            'country' => '',
            'prefecture' => '',
            'municipality' => '',
        ];

        $url = sprintf(
            'https://nominatim.openstreetmap.org/reverse?format=json&lat=%f&lon=%f&zoom=12&addressdetails=1&accept-language=ja',
            $lat,
            $lng
        );

        $ctx = stream_context_create([
            'http' => [
                'header' => "User-Agent: ikimon.life/1.0 (contact@ikimon.life)\r\n",
                'timeout' => 5,
            ]
        ]);

        $response = @file_get_contents($url, false, $ctx);
        if (!$response) {
            return $result;
        }

        $geo = json_decode($response, true);
        $address = $geo['address'] ?? [];

        // Country code (ISO 3166-1 alpha-2, uppercase)
        $result['country'] = strtoupper($address['country_code'] ?? '');

        // Municipality (city > town > village > county)
        $result['municipality'] = $address['city']
            ?? $address['town']
            ?? $address['village']
            ?? $address['county']
            ?? $address['municipality']
            ?? '';

        // Prefecture (JP only — map state name to ISO code)
        $state = $address['state'] ?? '';
        if ($result['country'] === 'JP' && $state) {
            $result['prefecture'] = self::japanStateToPrefCode($state);
        }

        return $result;
    }

    /**
     * Map Japanese state/prefecture name to ISO 3166-2:JP code.
     */
    private static function japanStateToPrefCode(string $state): string
    {
        static $map = [
            '北海道' => 'JP-01',
            '青森県' => 'JP-02',
            '岩手県' => 'JP-03',
            '宮城県' => 'JP-04',
            '秋田県' => 'JP-05',
            '山形県' => 'JP-06',
            '福島県' => 'JP-07',
            '茨城県' => 'JP-08',
            '栃木県' => 'JP-09',
            '群馬県' => 'JP-10',
            '埼玉県' => 'JP-11',
            '千葉県' => 'JP-12',
            '東京都' => 'JP-13',
            '神奈川県' => 'JP-14',
            '新潟県' => 'JP-15',
            '富山県' => 'JP-16',
            '石川県' => 'JP-17',
            '福井県' => 'JP-18',
            '山梨県' => 'JP-19',
            '長野県' => 'JP-20',
            '岐阜県' => 'JP-21',
            '静岡県' => 'JP-22',
            '愛知県' => 'JP-23',
            '三重県' => 'JP-24',
            '滋賀県' => 'JP-25',
            '京都府' => 'JP-26',
            '大阪府' => 'JP-27',
            '兵庫県' => 'JP-28',
            '奈良県' => 'JP-29',
            '和歌山県' => 'JP-30',
            '鳥取県' => 'JP-31',
            '島根県' => 'JP-32',
            '岡山県' => 'JP-33',
            '広島県' => 'JP-34',
            '山口県' => 'JP-35',
            '徳島県' => 'JP-36',
            '香川県' => 'JP-37',
            '愛媛県' => 'JP-38',
            '高知県' => 'JP-39',
            '福岡県' => 'JP-40',
            '佐賀県' => 'JP-41',
            '長崎県' => 'JP-42',
            '熊本県' => 'JP-43',
            '大分県' => 'JP-44',
            '宮崎県' => 'JP-45',
            '鹿児島県' => 'JP-46',
            '沖縄県' => 'JP-47',
        ];
        return $map[$state] ?? '';
    }

    // =========================================================================
    // Coordinate Validation
    // =========================================================================

    /**
     * Validate coordinates for plausibility.
     *
     * @param float $lat Latitude
     * @param float $lng Longitude
     * @return array ['valid' => bool, 'reason' => string]
     */
    public static function validateCoordinates(float $lat, float $lng): array
    {
        // Range check
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return ['valid' => false, 'reason' => 'out_of_range'];
        }

        // Null Island (0,0) — almost certainly GPS error
        if (abs($lat) < 0.01 && abs($lng) < 0.01) {
            return ['valid' => false, 'reason' => 'null_island'];
        }

        // Extreme polar regions (>85°) — unlikely for biodiversity obs
        if (abs($lat) > 85) {
            return ['valid' => false, 'reason' => 'polar_region'];
        }

        return ['valid' => true, 'reason' => ''];
    }
}
