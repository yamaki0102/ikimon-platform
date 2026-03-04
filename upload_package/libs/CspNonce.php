<?php

/**
 * CSP Nonce Generator
 * 
 * Generates a cryptographically secure nonce for Content-Security-Policy.
 * Include this file early in every page to enable nonce-based CSP.
 * 
 * Usage:
 *   require_once ROOT_DIR . '/libs/CspNonce.php';
 *   $nonce = CspNonce::get();
 *   // In HTML: <script nonce="<?= CspNonce::attr() ?>">
 */
class CspNonce
{
    private static ?string $nonce = null;
    private static bool $headerSent = false;

    /**
     * Get the current request's CSP nonce (generates once per request)
     */
    public static function get(): string
    {
        if (self::$nonce === null) {
            self::$nonce = bin2hex(random_bytes(16));
        }
        return self::$nonce;
    }

    /**
     * Convenience: get nonce as HTML-safe attribute value
     */
    public static function attr(): string
    {
        return htmlspecialchars(self::get(), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Send the CSP header with nonce included.
     * Idempotent: safe to call multiple times (only sends once).
     * Call this BEFORE any output.
     */
    public static function sendHeader(): void
    {
        if (self::$headerSent) {
            return;
        }
        self::$headerSent = true;

        // Don't send headers for CLI (tests, scripts)
        if (php_sapi_name() === 'cli') {
            return;
        }

        $nonce = self::get();

        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://unpkg.com https://www.gstatic.com https://cdnjs.cloudflare.com https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://unpkg.com https://cdn.tailwindcss.com https://cdnjs.cloudflare.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: blob: https://i.pravatar.cc https://*.tile.openstreetmap.jp https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://tile.openstreetmap.jp https://lh3.googleusercontent.com",
            "connect-src 'self' https://api.gbif.org https://tile.openstreetmap.jp https://*.tile.openstreetmap.jp https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://nominatim.openstreetmap.org https://unpkg.com",
            "worker-src 'self' blob:",
            "child-src 'self' blob:",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
            "report-uri /api/csp_report.php",
            "report-to csp-endpoint"
        ]);

        header("Content-Security-Policy: {$csp}");
        header('Reporting-Endpoints: csp-endpoint="/api/csp_report.php"');
    }
}
