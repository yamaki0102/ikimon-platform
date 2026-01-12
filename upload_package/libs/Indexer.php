<?php

class Indexer {
    private static $indexDir;

    public static function Init() {
        self::$indexDir = __DIR__ . '/../data/indexes';
        if (!file_exists(self::$indexDir)) {
            mkdir(self::$indexDir, 0777, true);
        }
    }

    public static function addToIndex($indexName, $key, $value) {
        self::Init();
        $file = self::$indexDir . '/' . $indexName . '.json';
        $index = [];
        if (file_exists($file)) {
            $index = json_decode(file_get_contents($file), true) ?: [];
        }
        
        if (!isset($index[$key])) {
            $index[$key] = [];
        }
        
        if (!in_array($value, $index[$key])) {
            $index[$key][] = $value;
            file_put_contents($file, json_encode($index));
        }
    }

    public static function getFromIndex($indexName, $key) {
        self::Init();
        $file = self::$indexDir . '/' . $indexName . '.json';
        if (!file_exists($file)) return [];
        
        $index = json_decode(file_get_contents($file), true) ?: [];
        return $index[$key] ?? [];
    }
}
