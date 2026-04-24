<?php

class Indexer
{
    private static $indexDir;

    public static function Init()
    {
        self::$indexDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data') . '/indexes';
        if (!file_exists(self::$indexDir)) {
            mkdir(self::$indexDir, 0755, true);
        }
    }

    public static function addToIndex($indexName, $key, $value)
    {
        self::Init();
        $file = self::$indexDir . '/' . $indexName . '.json';

        $fp = fopen($file, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        $filesize = filesize($file);
        $content = $filesize > 0 ? fread($fp, $filesize) : '';
        $index = json_decode($content, true) ?: [];

        if (!isset($index[$key])) {
            $index[$key] = [];
        }

        if (!in_array($value, $index[$key])) {
            $index[$key][] = $value;
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($index));
            fflush($fp);
        }

        flock($fp, LOCK_UN);
        fclose($fp);
    }

    public static function getFromIndex($indexName, $key)
    {
        self::Init();
        $file = self::$indexDir . '/' . $indexName . '.json';
        if (!file_exists($file)) return [];

        $index = json_decode(file_get_contents($file), true) ?: [];
        return $index[$key] ?? [];
    }
}
