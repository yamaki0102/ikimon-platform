<?php
class Invasive {
    private static $list = null;

    public static function check($name, $scientific = null) {
        if (self::$list === null) {
            $dataDir = defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data';
            $path = $dataDir . '/masters/invasive_species.json';
            if (file_exists($path)) {
                self::$list = json_decode(file_get_contents($path), true);
            } else {
                self::$list = [];
            }
        }

        foreach (self::$list as $item) {
            if ($item['name'] === $name) return $item;
            if ($scientific && $item['scientific_name'] === $scientific) return $item;
        }

        return null;
    }
}
