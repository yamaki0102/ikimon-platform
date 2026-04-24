<?php

class Cache
{
    private static $cacheDir;

    public static function Init()
    {
        self::$cacheDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data') . '/cache';
        if (!file_exists(self::$cacheDir)) {
            mkdir(self::$cacheDir, 0755, true);
        }
    }

    public static function get($key, $ttl = 3600)
    {
        self::Init();
        $file = self::$cacheDir . '/' . md5($key) . '.cache';

        if (!file_exists($file)) return null;

        $data = file_get_contents($file);
        $cache = json_decode($data, true);

        if (!$cache) return null;

        if (time() > $cache['expires']) {
            unlink($file);
            return null;
        }

        return $cache['data'];
    }

    public static function set($key, $data, $ttl = 3600)
    {
        self::Init();
        $file = self::$cacheDir . '/' . md5($key) . '.cache';
        $cache = [
            'expires' => time() + $ttl,
            'data' => $data
        ];
        file_put_contents($file, json_encode($cache), LOCK_EX);
    }

    public static function clear($key)
    {
        self::Init();
        $file = self::$cacheDir . '/' . md5($key) . '.cache';
        if (file_exists($file)) {
            unlink($file);
        }
    }
}
