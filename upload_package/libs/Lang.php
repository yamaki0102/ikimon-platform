<?php
class Lang {
    private static $translations = [];
    private static $current = 'ja';

    public static function init($lang = null) {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        // Priority: Argument > GET > Session > Default
        if ($lang) {
            self::$current = $lang;
        } elseif (isset($_GET['lang'])) {
            self::$current = $_GET['lang'];
            $_SESSION['lang'] = self::$current;
        } elseif (isset($_SESSION['lang'])) {
            self::$current = $_SESSION['lang'];
        } else {
            self::$current = 'ja';
        }

        // Security: Whitelist supported languages
        if (!in_array(self::$current, ['ja', 'en', 'es', 'pt'])) {
            self::$current = 'ja';
        }

        $path = __DIR__ . "/../lang/" . self::$current . ".php";
        if (file_exists($path)) {
            self::$translations = require $path;
        } else {
            // Fallback
             $path = __DIR__ . "/../lang/ja.php";
             if (file_exists($path)) self::$translations = require $path;
        }
    }

    public static function get($key, $default = null) {
        // Support dot notation 'category.key'
        $keys = explode('.', $key);
        $value = self::$translations;
        
        foreach ($keys as $k) {
            if (isset($value[$k])) {
                $value = $value[$k];
            } else {
                return $default ?? $key; // Return key if not found
            }
        }
        
        return $value;
    }
}

// Global helper
if (!function_exists('__')) {
    function __($key, $default = null) {
        return Lang::get($key, $default);
    }
}
?>
