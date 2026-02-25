<?php
// Prepend error display to profile.php temporarily
ini_set('display_errors', 1);
error_reporting(E_ALL);
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    echo "<pre>PHP Error [$errno]: $errstr in $errfile:$errline</pre>";
    return false;
});
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        echo "<pre>FATAL: {$e['message']} in {$e['file']}:{$e['line']}</pre>";
    }
});
include __DIR__ . '/profile.php';
