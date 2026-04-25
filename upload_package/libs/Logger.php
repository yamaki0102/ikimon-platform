<?php
/**
 * FB-14: Structured Logger using Monolog-like patterns
 * Simple file-based logging with levels and JSON format
 */

class Logger {
    const DEBUG = 100;
    const INFO = 200;
    const WARNING = 300;
    const ERROR = 400;
    const CRITICAL = 500;
    
    private static $logDir = null;
    private static $minLevel = self::INFO;
    
    private static $levelNames = [
        self::DEBUG => 'DEBUG',
        self::INFO => 'INFO',
        self::WARNING => 'WARNING',
        self::ERROR => 'ERROR',
        self::CRITICAL => 'CRITICAL'
    ];
    
    /**
     * Initialize log directory
     */
    private static function init() {
        if (self::$logDir === null) {
            self::$logDir = dirname(__DIR__) . '/logs';
            if (!is_dir(self::$logDir)) {
                mkdir(self::$logDir, 0777, true);
            }
        }
    }
    
    /**
     * Set minimum log level
     */
    public static function setMinLevel($level) {
        self::$minLevel = $level;
    }
    
    /**
     * Write log entry
     */
    private static function log($level, $message, array $context = []) {
        if ($level < self::$minLevel) {
            return;
        }
        
        self::init();
        
        $entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'level' => self::$levelNames[$level] ?? 'UNKNOWN',
            'message' => $message,
            'context' => $context,
            'request' => [
                'method' => $_SERVER['REQUEST_METHOD'] ?? 'CLI',
                'uri' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? ''
            ]
        ];
        
        // Add user info if available
        if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user'])) {
            $entry['user_id'] = $_SESSION['user']['id'] ?? null;
        }
        
        $filename = self::$logDir . '/ikimon_' . date('Y-m-d') . '.log';
        $line = json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n";
        
        file_put_contents($filename, $line, FILE_APPEND | LOCK_EX);
    }
    
    /**
     * Debug level log
     */
    public static function debug($message, array $context = []) {
        self::log(self::DEBUG, $message, $context);
    }
    
    /**
     * Info level log
     */
    public static function info($message, array $context = []) {
        self::log(self::INFO, $message, $context);
    }
    
    /**
     * Warning level log
     */
    public static function warning($message, array $context = []) {
        self::log(self::WARNING, $message, $context);
    }
    
    /**
     * Error level log
     */
    public static function error($message, array $context = []) {
        self::log(self::ERROR, $message, $context);
    }
    
    /**
     * Critical level log
     */
    public static function critical($message, array $context = []) {
        self::log(self::CRITICAL, $message, $context);
    }
    
    /**
     * Log an exception
     */
    public static function exception(\Throwable $e, array $context = []) {
        $context['exception'] = [
            'class' => get_class($e),
            'message' => $e->getMessage(),
            'code' => $e->getCode(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ];
        self::error($e->getMessage(), $context);
    }
    
    /**
     * Clean up old log files (keep last 30 days)
     */
    public static function cleanup($keepDays = 30) {
        self::init();
        $cutoff = strtotime("-{$keepDays} days");
        
        $files = glob(self::$logDir . '/ikimon_*.log');
        foreach ($files as $file) {
            if (filemtime($file) < $cutoff) {
                unlink($file);
            }
        }
    }
    
    /**
     * Get recent log entries for admin dashboard
     */
    public static function getRecent($level = self::INFO, $limit = 100) {
        self::init();
        
        $today = self::$logDir . '/ikimon_' . date('Y-m-d') . '.log';
        if (!file_exists($today)) {
            return [];
        }
        
        $lines = file($today, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $entries = [];
        
        foreach (array_reverse($lines) as $line) {
            $entry = json_decode($line, true);
            if ($entry && isset($entry['level'])) {
                $entryLevel = array_search($entry['level'], self::$levelNames);
                if ($entryLevel >= $level) {
                    $entries[] = $entry;
                    if (count($entries) >= $limit) {
                        break;
                    }
                }
            }
        }
        
        return $entries;
    }
}
