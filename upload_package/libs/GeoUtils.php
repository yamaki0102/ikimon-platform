<?php
class GeoUtils {
    /**
     * Check if a point is inside a polygon
     * Ray-casting algorithm
     * @param float $lat Point Latitude
     * @param float $lng Point Longitude
     * @param array $polygon Array of [lng, lat] (GeoJSON format)
     * @return bool
     */
    public static function isPointInPolygon($lat, $lng, $polygon) {
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
    public static function distance($lat1, $lng1, $lat2, $lng2) {
        $earthRadius = 6371000; // meters

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
        
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
