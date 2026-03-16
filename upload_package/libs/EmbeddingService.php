<?php

/**
 * EmbeddingService - Gemini Embedding 2 multimodal API wrapper for ikimon.life
 *
 * Generates 768-dimensional embedding vectors from text, images, or both.
 * Model: gemini-embedding-2-preview (first natively multimodal embedding model)
 *
 * Capabilities:
 * - Text embedding (species names, ecological descriptions, papers)
 * - Image embedding (observation photos)
 * - Multimodal embedding (text + photo → single unified vector)
 * - Batch embedding (multiple items per API call)
 */

require_once __DIR__ . '/../config/config.php';

class EmbeddingService
{
    private const MODEL = 'gemini-embedding-2-preview';
    private const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
    private const DIMENSIONS = 768;
    private const MAX_TEXT_LENGTH = 2000;
    private const PHOTO_MAX_DIM = 512; // resize photos to 512px max

    private string $apiKey;

    public function __construct(?string $apiKey = null)
    {
        $this->apiKey = $apiKey ?? GEMINI_API_KEY;
    }

    // ─── Core Embedding Methods ─────────────────────────────────

    /**
     * Embed text only.
     */
    public function embedText(string $text, string $taskType = 'RETRIEVAL_DOCUMENT'): ?array
    {
        $text = trim($text);
        if ($text === '' || !$this->apiKey) return null;

        if (mb_strlen($text) > self::MAX_TEXT_LENGTH) {
            $text = mb_substr($text, 0, self::MAX_TEXT_LENGTH);
        }

        $parts = [['text' => $text]];
        return $this->callEmbedContent($parts, $taskType);
    }

    /**
     * Embed image only (base64-encoded).
     */
    public function embedImage(string $base64, string $mimeType = 'image/jpeg'): ?array
    {
        if (!$base64 || !$this->apiKey) return null;

        $parts = [
            ['inline_data' => ['mime_type' => $mimeType, 'data' => $base64]],
        ];
        return $this->callEmbedContent($parts, 'RETRIEVAL_DOCUMENT');
    }

    /**
     * Embed text + image together into a single unified vector.
     * This is the key multimodal feature of Gemini Embedding 2.
     */
    public function embedMultimodal(string $text, string $base64, string $mimeType = 'image/jpeg', string $taskType = 'RETRIEVAL_DOCUMENT'): ?array
    {
        if (!$this->apiKey) return null;
        if (trim($text) === '' && !$base64) return null;

        $text = trim($text);
        if (mb_strlen($text) > self::MAX_TEXT_LENGTH) {
            $text = mb_substr($text, 0, self::MAX_TEXT_LENGTH);
        }

        $parts = [];
        if ($text !== '') {
            $parts[] = ['text' => $text];
        }
        if ($base64) {
            $parts[] = ['inline_data' => ['mime_type' => $mimeType, 'data' => $base64]];
        }

        return $this->callEmbedContent($parts, $taskType);
    }

    /**
     * Embed a search query (uses RETRIEVAL_QUERY task type for optimal search).
     */
    public function embedQuery(string $query): ?array
    {
        return $this->embedText($query, 'RETRIEVAL_QUERY');
    }

    /**
     * Batch embed multiple items in one API call.
     * Each request: ['parts' => [...], 'taskType' => '...']
     * Returns array of vectors (null for failed items).
     */
    public function batchEmbed(array $requests): array
    {
        if (!$this->apiKey || empty($requests)) return [];

        $url = self::API_BASE . self::MODEL . ':batchEmbedContents';

        $batchRequests = [];
        foreach ($requests as $req) {
            $batchRequests[] = [
                'model' => 'models/' . self::MODEL,
                'content' => ['parts' => $req['parts']],
                'taskType' => $req['taskType'] ?? 'RETRIEVAL_DOCUMENT',
                'outputDimensionality' => self::DIMENSIONS,
            ];
        }

        $payload = ['requests' => $batchRequests];

        $ch = curl_init($url);
        $curlOpts = [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-goog-api-key: ' . $this->apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 5,
        ];
        if (PHP_OS_FAMILY === 'Windows' && !ini_get('curl.cainfo')) {
            $curlOpts[CURLOPT_SSL_VERIFYPEER] = false;
        }
        curl_setopt_array($ch, $curlOpts);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode !== 200) {
            error_log("[embedding] Batch API error: HTTP {$httpCode}, error: {$error}");
            return array_fill(0, count($requests), null);
        }

        $data = json_decode($response, true);
        $embeddings = $data['embeddings'] ?? [];

        $results = [];
        foreach ($requests as $i => $req) {
            $values = $embeddings[$i]['values'] ?? null;
            $results[] = (is_array($values) && count($values) === self::DIMENSIONS) ? $values : null;
        }

        return $results;
    }

    // ─── Photo Preparation ──────────────────────────────────────

    /**
     * Prepare observation photo for embedding.
     * Reads photo file, resizes to 512px, strips EXIF, returns base64.
     * Returns ['data' => base64_string, 'mime' => 'image/jpeg'] or null.
     */
    public static function prepareObservationPhoto(array $obs): ?array
    {
        $photos = $obs['photos'] ?? [];
        if (empty($photos)) return null;

        $photoPath = $photos[0]; // first photo
        $absPath = (defined('PUBLIC_DIR') ? PUBLIC_DIR : '') . '/' . $photoPath;

        if (!file_exists($absPath)) {
            error_log("[embedding] Photo not found: {$absPath}");
            return null;
        }

        return self::resizePhoto($absPath);
    }

    /**
     * Resize and base64-encode a photo file for embedding API.
     * Mirrors the logic in ai_suggest.php's resizeAndStripExif().
     */
    public static function resizePhoto(string $path, int $maxDim = self::PHOTO_MAX_DIM): ?array
    {
        if (class_exists('finfo')) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->file($path);
        } else {
            // Fallback: detect by extension
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            $mimeType = match ($ext) {
                'jpg', 'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'webp' => 'image/webp',
                'gif' => 'image/gif',
                default => 'application/octet-stream',
            };
        }

        // GD not available: send raw file (larger but still works)
        if (!function_exists('imagecreatefromjpeg')) {
            $data = file_get_contents($path);
            if ($data === false) return null;
            return [
                'data' => base64_encode($data),
                'mime' => $mimeType,
            ];
        }

        $img = match ($mimeType) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png'  => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            default      => false,
        };

        if (!$img) return null;

        $w = imagesx($img);
        $h = imagesy($img);

        if ($w > $maxDim || $h > $maxDim) {
            $ratio = min($maxDim / $w, $maxDim / $h);
            $newW = (int)($w * $ratio);
            $newH = (int)($h * $ratio);

            $resized = imagecreatetruecolor($newW, $newH);
            imagecopyresampled($resized, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
            imagedestroy($img);
            $img = $resized;
        }

        // Output as JPEG (strips EXIF, compact size)
        ob_start();
        imagejpeg($img, null, 80);
        $data = ob_get_clean();
        imagedestroy($img);

        return [
            'data' => base64_encode($data),
            'mime' => 'image/jpeg',
        ];
    }

    // ─── Convenience: Full Observation Embedding ────────────────

    /**
     * Generate multimodal embedding for an observation (text + photo).
     * Falls back to text-only if no photo available.
     * Returns ['vector' => float[], 'mode' => 'multimodal'|'text_only'] or null.
     */
    public function embedObservation(array $obs): ?array
    {
        $text = self::prepareObservationText($obs);
        $photo = self::prepareObservationPhoto($obs);

        if ($photo) {
            $vector = $this->embedMultimodal($text, $photo['data'], $photo['mime']);
            if ($vector) {
                return ['vector' => $vector, 'mode' => 'multimodal'];
            }
        }

        // Fallback to text-only
        $vector = $this->embedText($text);
        if ($vector) {
            return ['vector' => $vector, 'mode' => 'text_only'];
        }

        return null;
    }

    /**
     * Generate photo-only embedding for visual similarity search.
     */
    public function embedObservationPhoto(array $obs): ?array
    {
        $photo = self::prepareObservationPhoto($obs);
        if (!$photo) return null;

        return $this->embedImage($photo['data'], $photo['mime']);
    }

    // ─── Text Preparation Methods ───────────────────────────────

    /**
     * Prepare embeddable text from an observation record.
     */
    public static function prepareObservationText(array $obs): string
    {
        $parts = [];

        // Taxon info
        $taxon = $obs['taxon'] ?? [];
        if (!empty($taxon['name'])) $parts[] = $taxon['name'];
        if (!empty($taxon['scientific_name'])) $parts[] = $taxon['scientific_name'];

        // Lineage path
        $lineage = $taxon['lineage'] ?? [];
        if ($lineage) {
            $lineageParts = [];
            foreach (['kingdom', 'phylum', 'class', 'order', 'family', 'genus'] as $rank) {
                if (!empty($lineage[$rank])) $lineageParts[] = $lineage[$rank];
            }
            if ($lineageParts) $parts[] = implode(' > ', $lineageParts);
        }

        // Location context
        if (!empty($obs['prefecture'])) $parts[] = $obs['prefecture'];
        if (!empty($obs['municipality'])) $parts[] = $obs['municipality'];

        // Ecological context
        if (!empty($obs['biome']) && $obs['biome'] !== 'unknown') $parts[] = 'biome:' . $obs['biome'];
        if (!empty($obs['cultivation'])) $parts[] = $obs['cultivation'];
        if (!empty($obs['life_stage']) && $obs['life_stage'] !== 'unknown') $parts[] = $obs['life_stage'];
        if (!empty($obs['substrate_tags'])) $parts[] = implode(' ', $obs['substrate_tags']);

        // User note
        if (!empty($obs['note'])) $parts[] = $obs['note'];

        // Season from observed_at
        if (!empty($obs['observed_at'])) {
            $month = (int) date('n', strtotime($obs['observed_at']));
            $season = match (true) {
                $month >= 3 && $month <= 5 => '春',
                $month >= 6 && $month <= 8 => '夏',
                $month >= 9 && $month <= 11 => '秋',
                default => '冬',
            };
            $parts[] = $season;
        }

        // Identification notes
        foreach ($obs['identifications'] ?? [] as $id) {
            if (!empty($id['note'])) $parts[] = $id['note'];
        }

        return implode(' ', $parts);
    }

    /**
     * Prepare embeddable text from a paper record.
     */
    public static function preparePaperText(array $paper): string
    {
        $parts = [];

        if (!empty($paper['title'])) $parts[] = $paper['title'];
        if (!empty($paper['container_title'])) $parts[] = $paper['container_title'];
        if (!empty($paper['abstract'])) $parts[] = $paper['abstract'];

        if (!empty($paper['taxa'])) {
            foreach ($paper['taxa'] as $t) {
                if (is_string($t)) {
                    $parts[] = $t;
                } elseif (is_array($t)) {
                    if (!empty($t['name'])) $parts[] = $t['name'];
                    if (!empty($t['scientific_name'])) $parts[] = $t['scientific_name'];
                }
            }
        }

        if (!empty($paper['keywords'])) {
            $parts[] = implode(' ', (array) $paper['keywords']);
        }

        return implode(' ', $parts);
    }

    /**
     * Prepare embeddable text from a taxon resolver entry.
     */
    public static function prepareTaxonText(array $taxon): string
    {
        $parts = [];

        if (!empty($taxon['ja_name'])) $parts[] = $taxon['ja_name'];
        if (!empty($taxon['accepted_name'])) $parts[] = $taxon['accepted_name'];
        if (!empty($taxon['name'])) $parts[] = $taxon['name'];
        if (!empty($taxon['scientific_name'])) $parts[] = $taxon['scientific_name'];

        $lineage = $taxon['lineage'] ?? [];
        foreach ($lineage as $name) {
            if ($name) $parts[] = $name;
        }

        if (!empty($taxon['synonyms'])) {
            $parts[] = implode(' ', (array) $taxon['synonyms']);
        }
        if (!empty($taxon['historical_names'])) {
            $parts[] = implode(' ', (array) $taxon['historical_names']);
        }

        return implode(' ', $parts);
    }

    /**
     * Prepare embeddable text from an Omoikane species record.
     */
    public static function prepareOmoikaneText(array $species): string
    {
        $parts = [];

        if (!empty($species['japanese_name'])) $parts[] = $species['japanese_name'];
        if (!empty($species['scientific_name'])) $parts[] = $species['scientific_name'];

        if (!empty($species['morphological_traits'])) $parts[] = $species['morphological_traits'];

        if (!empty($species['habitat'])) $parts[] = $species['habitat'];
        if (!empty($species['season'])) $parts[] = $species['season'];
        if (!empty($species['altitude'])) $parts[] = $species['altitude'];
        if (!empty($species['notes'])) $parts[] = $species['notes'];

        if (!empty($species['similar_species'])) $parts[] = $species['similar_species'];
        if (!empty($species['key_differences'])) $parts[] = $species['key_differences'];

        return implode(' ', $parts);
    }

    // ─── Internal ───────────────────────────────────────────────

    /**
     * Call the embedContent API endpoint.
     */
    private function callEmbedContent(array $parts, string $taskType): ?array
    {
        $url = self::API_BASE . self::MODEL . ':embedContent';

        $payload = [
            'model' => 'models/' . self::MODEL,
            'content' => ['parts' => $parts],
            'taskType' => $taskType,
            'outputDimensionality' => self::DIMENSIONS,
        ];

        $ch = curl_init($url);
        $curlOpts = [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-goog-api-key: ' . $this->apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
        ];
        // Local dev: skip SSL verify if cacert bundle is missing (Windows)
        if (PHP_OS_FAMILY === 'Windows' && !ini_get('curl.cainfo')) {
            $curlOpts[CURLOPT_SSL_VERIFYPEER] = false;
        }
        curl_setopt_array($ch, $curlOpts);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode !== 200) {
            error_log("[embedding] Gemini API error: HTTP {$httpCode}, error: {$error}");
            return null;
        }

        $data = json_decode($response, true);
        $values = $data['embedding']['values'] ?? null;

        if (!is_array($values) || count($values) !== self::DIMENSIONS) {
            error_log("[embedding] Unexpected response: " . substr($response, 0, 200));
            return null;
        }

        return $values;
    }

    public static function getDimensions(): int
    {
        return self::DIMENSIONS;
    }
}
