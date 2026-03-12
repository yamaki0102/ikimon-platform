<?php

class Asset
{
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
}
