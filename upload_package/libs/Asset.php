<?php

class Asset
{
    private static ?string $pwaVersion = null;

    public static function versioned(string $webPath): string
    {
        $normalized = '/' . ltrim($webPath, '/');
        $filePath = PUBLIC_DIR . $normalized;

        if (!is_file($filePath)) {
            return $normalized;
        }

        $version = @filemtime($filePath);
        if (!$version) {
            return $normalized;
        }

        return $normalized . '?v=' . $version;
    }

    public static function pwaVersion(): string
    {
        if (self::$pwaVersion !== null) {
            return self::$pwaVersion;
        }

        $paths = [
            '/favicon.ico',
            '/manifest.php',
            '/sw.php',
            '/assets/img/favicon-32.png',
            '/assets/img/apple-touch-icon.png',
            '/assets/img/icon-192.png',
            '/assets/img/icon-512.png',
            '/assets/img/icon-192-maskable.png',
            '/assets/img/icon-512-maskable.png',
        ];

        $latest = 0;
        foreach ($paths as $path) {
            $filePath = PUBLIC_DIR . $path;
            if (!is_file($filePath)) {
                continue;
            }

            $mtime = @filemtime($filePath);
            if ($mtime && $mtime > $latest) {
                $latest = $mtime;
            }
        }

        self::$pwaVersion = (string) ($latest ?: time());
        return self::$pwaVersion;
    }
}
