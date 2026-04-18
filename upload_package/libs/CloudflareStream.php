<?php

require_once __DIR__ . '/../config/config.php';

class CloudflareStream
{
    private const API_BASE = 'https://api.cloudflare.com/client/v4/accounts/';
    private const DEFAULT_MAX_DURATION_SECONDS = 15;

    public static function isConfigured(): bool
    {
        return defined('CLOUDFLARE_ACCOUNT_ID')
            && defined('CLOUDFLARE_STREAM_API_TOKEN')
            && defined('CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN')
            && CLOUDFLARE_ACCOUNT_ID !== ''
            && CLOUDFLARE_STREAM_API_TOKEN !== ''
            && CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN !== '';
    }

    public static function createDirectUpload(array $options = []): array
    {
        self::ensureConfigured();

        $payload = [
            'maxDurationSeconds' => max(1, min(900, (int)($options['maxDurationSeconds'] ?? self::DEFAULT_MAX_DURATION_SECONDS))),
        ];

        $meta = [];
        if (!empty($options['meta']) && is_array($options['meta'])) {
            foreach ($options['meta'] as $key => $value) {
                if (!is_scalar($value) || $value === '') {
                    continue;
                }
                $meta[(string)$key] = mb_substr((string)$value, 0, 200);
            }
        }
        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return self::request('POST', 'stream/direct_upload', $payload);
    }

    public static function getVideo(string $uid): array
    {
        self::ensureConfigured();
        $uid = trim($uid);
        if ($uid === '') {
            throw new InvalidArgumentException('Cloudflare Stream video UID is required.');
        }

        return self::request('GET', 'stream/' . rawurlencode($uid));
    }

    public static function buildIframeUrl(string $uid): string
    {
        return 'https://' . CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN . '/' . rawurlencode($uid) . '/iframe';
    }

    public static function buildWatchUrl(string $uid): string
    {
        return 'https://' . CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN . '/' . rawurlencode($uid) . '/watch';
    }

    public static function buildThumbnailUrl(string $uid, string $time = '1s', int $height = 720): string
    {
        return 'https://' . CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN . '/' . rawurlencode($uid) . '/thumbnails/thumbnail.jpg?time='
            . rawurlencode($time) . '&height=' . max(120, min(1080, $height));
    }

    public static function normalizeVideoRecord(string $uid, array $video = [], array $overrides = []): array
    {
        $result = is_array($video['result'] ?? null) ? $video['result'] : $video;
        $thumbnail = (string)($result['thumbnail'] ?? '');
        if ($thumbnail === '') {
            $thumbnail = self::buildThumbnailUrl($uid);
        }

        $preview = (string)($result['preview'] ?? '');
        if ($preview === '') {
            $preview = self::buildWatchUrl($uid);
        }

        return array_merge([
            'provider' => 'cloudflare_stream',
            'provider_uid' => $uid,
            'media_type' => 'video',
            'asset_role' => 'observation_video',
            'upload_status' => self::resolveUploadStatus($result),
            'duration_ms' => self::normalizeDurationMs($result['duration'] ?? null, $overrides['duration_ms'] ?? null),
            'bytes' => isset($result['size']) ? (int)round((float)$result['size']) : (int)($overrides['bytes'] ?? 0),
            'thumbnail_url' => $thumbnail,
            'iframe_url' => self::buildIframeUrl($uid),
            'watch_url' => $preview,
            'ready_to_stream' => !empty($result['readyToStream']),
            'created_at' => $result['created'] ?? date('c'),
            'uploaded_at' => $result['uploaded'] ?? null,
            'meta' => is_array($result['meta'] ?? null) ? $result['meta'] : [],
        ], $overrides);
    }

    private static function ensureConfigured(): void
    {
        if (!self::isConfigured()) {
            throw new RuntimeException('Cloudflare Stream is not configured.');
        }
    }

    private static function request(string $method, string $path, ?array $payload = null): array
    {
        $ch = curl_init(self::API_BASE . rawurlencode(CLOUDFLARE_ACCOUNT_ID) . '/' . ltrim($path, '/'));
        if ($ch === false) {
            throw new RuntimeException('Failed to initialize Cloudflare request.');
        }

        $headers = [
            'Authorization: Bearer ' . CLOUDFLARE_STREAM_API_TOKEN,
            'Content-Type: application/json',
        ];

        $curlOptions = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 20,
        ];
        if (PHP_OS_FAMILY === 'Windows' && !ini_get('curl.cainfo')) {
            $curlOptions[CURLOPT_SSL_VERIFYPEER] = false;
        }
        curl_setopt_array($ch, $curlOptions);

        if ($payload !== null) {
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json === false ? '{}' : $json);
        }

        $body = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        if (PHP_VERSION_ID < 80500) {
            curl_close($ch);
        }

        if ($body === false || $error !== '') {
            throw new RuntimeException('Cloudflare Stream request failed: ' . $error);
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Cloudflare Stream returned a non-JSON response.');
        }

        if ($httpCode >= 400 || !($decoded['success'] ?? false)) {
            $message = 'Cloudflare Stream API request failed.';
            if (!empty($decoded['errors'][0]['message'])) {
                $message = (string)$decoded['errors'][0]['message'];
            }
            throw new RuntimeException($message);
        }

        return $decoded;
    }

    private static function resolveUploadStatus(array $result): string
    {
        $state = strtolower((string)($result['status']['state'] ?? ''));
        return match ($state) {
            'ready' => 'ready',
            'error' => 'error',
            'pendingupload' => 'pending_upload',
            'inprogress' => 'processing',
            default => (!empty($result['readyToStream']) ? 'ready' : 'uploaded'),
        };
    }

    private static function normalizeDurationMs($duration, $fallback): ?int
    {
        if (is_numeric($duration) && (float)$duration >= 0) {
            return (int)round((float)$duration * 1000);
        }
        if (is_numeric($fallback) && (float)$fallback >= 0) {
            return (int)round((float)$fallback);
        }
        return null;
    }
}
