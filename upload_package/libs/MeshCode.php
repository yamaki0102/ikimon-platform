<?php

/**
 * MeshCode — JIS X 0410 国土基本図図郭コード計算
 *
 * 日本の生物多様性標準グリッド。行政境界・公園・道路に依存しない
 * 永続的なエリア識別子。環境省・GBIF・いきものログと互換。
 *
 * 3次メッシュ: 約1km × 1km  (8桁コード)
 * 4次メッシュ: 約500m × 500m (9桁コード)
 */
class MeshCode
{
    // 3次メッシュのセルサイズ（度）
    // 1次: lat=2/3°, lng=1° → 2次: /8 → 3次: /10
    const MESH3_LAT = 1.0 / 120.0;  // (2/3) / 8 / 10 = 1/120° ≈ 0.00833° ≈ 0.93km
    const MESH3_LNG = 1.0 / 80.0;   // 1 / 8 / 10 = 1/80° ≈ 0.0125° ≈ 1.14km

    /**
     * 緯度経度から 3次・4次メッシュコードを計算
     *
     * @param float $lat 緯度
     * @param float $lng 経度
     * @return array ['mesh3' => string, 'mesh4' => string, 'bbox3' => [...], 'bbox4' => [...]]
     */
    public static function fromLatLng(float $lat, float $lng): array
    {
        // 1次メッシュ (4桁)
        $p = (int)floor($lat * 1.5);
        $u = (int)floor($lng - 100.0);
        $mesh1 = sprintf('%02d%02d', $p, $u);

        // 2次メッシュ (6桁)
        $lat1 = $lat * 1.5 - $p;
        $lng1 = $lng - 100.0 - $u;
        $q = (int)floor($lat1 * 8.0);
        $v = (int)floor($lng1 * 8.0);
        $mesh2 = $mesh1 . $q . $v;

        // 3次メッシュ (8桁)
        $lat2 = $lat1 * 8.0 - $q;
        $lng2 = $lng1 * 8.0 - $v;
        $r = (int)floor($lat2 * 10.0);
        $w = (int)floor($lng2 * 10.0);
        $mesh3 = $mesh2 . $r . $w;

        // 4次メッシュ (9桁) — 3次を2×2に分割
        $lat3 = $lat2 * 10.0 - $r;
        $lng3 = $lng2 * 10.0 - $w;
        $lat_half = (int)floor($lat3 * 2.0);
        $lng_half = (int)floor($lng3 * 2.0);
        $code4 = $lat_half * 2 + $lng_half + 1; // 1〜4
        $mesh4 = $mesh3 . $code4;

        return [
            'mesh3' => $mesh3,
            'mesh4' => $mesh4,
            'bbox3' => self::bbox3($mesh3),
            'bbox4' => self::bbox4($mesh4),
        ];
    }

    /**
     * 3次メッシュコードから境界ボックスを計算
     * @return array [lat_sw, lng_sw, lat_ne, lng_ne]
     */
    public static function bbox3(string $mesh3): array
    {
        $p = (int)substr($mesh3, 0, 2);
        $u = (int)substr($mesh3, 2, 2);
        $q = (int)substr($mesh3, 4, 1);
        $v = (int)substr($mesh3, 5, 1);
        $r = (int)substr($mesh3, 6, 1);
        $w = (int)substr($mesh3, 7, 1);

        $lat_sw = ($p + $q / 8.0 + $r / 80.0) / 1.5;
        $lng_sw = 100.0 + $u + $v / 8.0 + $w / 80.0;
        $lat_ne = $lat_sw + self::MESH3_LAT;
        $lng_ne = $lng_sw + self::MESH3_LNG;

        return [$lat_sw, $lng_sw, $lat_ne, $lng_ne];
    }

    /**
     * 4次メッシュコードから境界ボックスを計算
     * @return array [lat_sw, lng_sw, lat_ne, lng_ne]
     */
    public static function bbox4(string $mesh4): array
    {
        $mesh3 = substr($mesh4, 0, 8);
        $code4 = (int)substr($mesh4, 8, 1);

        [$lat_sw3, $lng_sw3, $lat_ne3, $lng_ne3] = self::bbox3($mesh3);
        $lat_half = (int)(($code4 - 1) / 2);
        $lng_half = ($code4 - 1) % 2;

        $lat_size4 = ($lat_ne3 - $lat_sw3) / 2.0;
        $lng_size4 = ($lng_ne3 - $lng_sw3) / 2.0;

        $lat_sw = $lat_sw3 + $lat_half * $lat_size4;
        $lng_sw = $lng_sw3 + $lng_half * $lng_size4;

        return [$lat_sw, $lng_sw, $lat_sw + $lat_size4, $lng_sw + $lng_size4];
    }

    /**
     * メッシュコードの中心座標を返す
     */
    public static function center(string $meshCode): array
    {
        $len = strlen($meshCode);
        $bbox = $len === 8 ? self::bbox3($meshCode) : self::bbox4($meshCode);
        return [
            'lat' => ($bbox[0] + $bbox[2]) / 2.0,
            'lng' => ($bbox[1] + $bbox[3]) / 2.0,
        ];
    }

    /**
     * メッシュセルをGeoJSON Polygon featureとして返す
     */
    public static function toGeoJsonFeature(string $meshCode, array $properties = []): array
    {
        $len = strlen($meshCode);
        $bbox = $len === 8 ? self::bbox3($meshCode) : self::bbox4($meshCode);
        [$lat_sw, $lng_sw, $lat_ne, $lng_ne] = $bbox;

        return [
            'type' => 'Feature',
            'properties' => array_merge(['mesh_code' => $meshCode], $properties),
            'geometry' => [
                'type' => 'Polygon',
                'coordinates' => [[
                    [$lng_sw, $lat_sw],
                    [$lng_ne, $lat_sw],
                    [$lng_ne, $lat_ne],
                    [$lng_sw, $lat_ne],
                    [$lng_sw, $lat_sw],
                ]],
            ],
        ];
    }
}
