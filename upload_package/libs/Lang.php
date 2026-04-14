<?php
require_once __DIR__ . '/Auth.php';

class Lang
{
    private static $translations = [];
    private static $fallbackTranslations = [];
    private static $current = 'ja';
    private const SUPPORTED_LANGUAGES = [
        'ja' => ['label' => '日本語', 'native' => '日本語', 'file' => 'ja.php'],
        'en' => ['label' => 'English', 'native' => 'English', 'file' => 'en.php'],
        'es' => ['label' => 'Spanish', 'native' => 'Español', 'file' => 'es.php'],
        'pt-BR' => ['label' => 'Portuguese (Brazil)', 'native' => 'Português (Brasil)', 'file' => 'pt-br.php'],
    ];

    public static function init($lang = null)
    {
        Auth::init();

        // Priority: Argument > GET > Session > Default
        if ($lang) {
            self::$current = self::normalize($lang);
        } elseif (isset($_GET['lang'])) {
            self::$current = self::normalize($_GET['lang']);
            $_SESSION['lang'] = self::$current;
        } elseif (isset($_SESSION['lang'])) {
            self::$current = self::normalize($_SESSION['lang']);
        } else {
            self::$current = 'ja';
        }

        // Security: Whitelist supported languages
        if (!array_key_exists(self::$current, self::SUPPORTED_LANGUAGES)) {
            self::$current = 'ja';
        }

        $path = __DIR__ . '/../lang/' . self::SUPPORTED_LANGUAGES[self::$current]['file'];
        if (file_exists($path)) {
            self::$translations = require $path;
        } else {
            // Fallback
            $path = __DIR__ . "/../lang/ja.php";
            if (file_exists($path)) self::$translations = require $path;
        }

        $fallbackPath = __DIR__ . '/../lang/en.php';
        if (file_exists($fallbackPath)) {
            self::$fallbackTranslations = require $fallbackPath;
        } else {
            self::$fallbackTranslations = [];
        }
    }

    public static function current()
    {
        return self::$current;
    }

    public static function supported()
    {
        return self::SUPPORTED_LANGUAGES;
    }

    public static function switchUrl($targetLang)
    {
        $targetLang = self::normalize($targetLang);
        if (!array_key_exists($targetLang, self::SUPPORTED_LANGUAGES)) {
            $targetLang = 'ja';
        }

        $params = $_GET;
        $params['lang'] = $targetLang;
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $query = http_build_query($params);
        return $path . ($query ? '?' . $query : '');
    }

    private static function normalize($lang)
    {
        $lang = trim((string) $lang);
        if ($lang === '') {
            return 'ja';
        }

        $normalized = strtolower(str_replace('_', '-', $lang));
        return match ($normalized) {
            'ja', 'ja-jp' => 'ja',
            'en', 'en-us', 'en-gb' => 'en',
            'es', 'es-es', 'es-419' => 'es',
            'pt', 'pt-br' => 'pt-BR',
            default => $lang,
        };
    }

    public static function get($key, $default = null)
    {
        $currentValue = self::resolveKey(self::$translations, $key);
        if ($currentValue !== null) {
            return $currentValue;
        }

        if (self::$current !== 'ja') {
            $fallbackValue = self::resolveKey(self::$fallbackTranslations, $key);
            if ($fallbackValue !== null) {
                return $fallbackValue;
            }

            return $key;
        }

        return $default ?? $key;
    }

    private static function resolveKey(array $source, string $key)
    {
        $keys = explode('.', $key);
        $value = $source;

        foreach ($keys as $k) {
            if (is_array($value) && array_key_exists($k, $value)) {
                $value = $value[$k];
            } else {
                return null;
            }
        }

        return $value;
    }
}

// Global helper
if (!function_exists('__')) {
    function __($key, $default = null)
    {
        return Lang::get($key, $default);
    }
}
