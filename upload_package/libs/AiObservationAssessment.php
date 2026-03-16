<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/Taxonomy.php';

class AiObservationAssessment
{
    private const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';
    private const REPAIR_MODEL = 'gemini-3.1-flash-lite-preview';
    private const PROMPT_VERSION = 'observation_assessment_v3';
    private const PIPELINE_VERSION = 'memo_fusion_v1';
    private const RANK_ORDER = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
    private const RANK_LABELS = [
        'kingdom' => '界',
        'phylum' => '門',
        'class' => '綱',
        'order' => '目',
        'family' => '科',
        'genus' => '属',
        'species' => '種',
    ];
    private const LANE_PROFILES = [
        'fast' => [
            'max_images' => 1,
            'max_dim' => 512,
            'max_output_tokens' => 320,
            'timeout' => 10,
        ],
        'batch' => [
            'max_images' => 2,
            'max_dim' => 640,
            'max_output_tokens' => 480,
            'timeout' => 16,
        ],
        'deep' => [
            'max_images' => 3,
            'max_dim' => 768,
            'max_output_tokens' => 720,
            'timeout' => 20,
        ],
    ];

    public static function isConfigured(): bool
    {
        return defined('GEMINI_API_KEY') && GEMINI_API_KEY !== '';
    }

    public static function buildAssessmentForObservation(array $observation, array $options = []): ?array
    {
        if (!self::isConfigured()) {
            return null;
        }

        $profile = self::resolveProfile($options);

        $photoPaths = self::resolvePhotoPaths($observation, (int)$profile['max_images']);
        if ($photoPaths === []) {
            return null;
        }

        $images = [];
        foreach ($photoPaths as $photoPath) {
            $image = self::resizeAndEncode($photoPath, (int)$profile['max_dim']);
            if ($image !== null) {
                $images[] = $image;
            }
        }
        if ($images === []) {
            return null;
        }

        try {
            $payload = self::callModel($images, $observation, $profile);
        } catch (\Throwable $e) {
            $payload = null;
        }
        if ($payload === null) {
            $payload = self::attemptReliableRetry($observation, $options);
        }
        if ($payload === null) {
            return self::buildFallbackAssessment($observation, $profile, count($images));
        }

        $providerCandidates = self::buildProviderCandidates($payload['suggestions'] ?? [], (string)$profile['model']);
        $fusion = self::synthesizeCandidateFusion(array_values(array_filter(
            array_map(fn($candidate) => $candidate['resolved'] ?? null, $providerCandidates)
        )));
        $recommendedTaxon = $fusion['recommended_taxon'] ?? null;
        $bestSpecificTaxon = $fusion['best_specific_taxon'] ?? null;

        return [
            'id' => 'ai-' . substr(bin2hex(random_bytes(8)), 0, 12),
            'kind' => 'machine_assessment',
            'created_at' => date('Y-m-d H:i:s'),
            'visibility' => 'public',
            'model' => $profile['model'],
            'processing_lane' => $profile['lane'],
            'prompt_version' => self::PROMPT_VERSION,
            'pipeline_version' => self::PIPELINE_VERSION,
            'taxonomy_version' => $recommendedTaxon['taxonomy_version'] ?? ($observation['taxon']['taxonomy_version'] ?? null),
            'recommended_taxon' => $recommendedTaxon,
            'recommended_rank' => $payload['recommended_rank'] ?? ($recommendedTaxon['rank'] ?? null),
            'best_specific_taxon' => $bestSpecificTaxon,
            'stable_taxon' => $fusion['stable_taxon'] ?? $recommendedTaxon,
            'candidate_disagreement' => $fusion['disagreement'] ?? 'unresolved',
            'routing_hint' => $fusion['routing_hint'] ?? 'unknown',
            'provider_candidates' => array_map(fn($candidate) => self::storageCandidate($candidate), $providerCandidates),
            'confidence_band' => $payload['confidence_band'] ?? 'low',
            'summary' => self::clip($payload['summary'] ?? ''),
            'why_not_more_specific' => self::clip($payload['why_not_more_specific'] ?? ''),
            'diagnostic_features_seen' => self::sanitizeList($payload['diagnostic_features_seen'] ?? [], 4),
            'similar_taxa_to_compare' => self::sanitizeList($payload['similar_taxa_to_compare'] ?? [], 4),
            'missing_evidence' => self::sanitizeList($payload['missing_evidence'] ?? [], 4),
            'geographic_context' => self::clip($payload['geographic_context'] ?? ''),
            'seasonal_context' => self::clip($payload['seasonal_context'] ?? ''),
            'observer_boost' => self::clip($payload['observer_boost'] ?? ''),
            'next_step' => self::clip($payload['next_step'] ?? ''),
            'cautionary_note' => self::clip($payload['cautionary_note'] ?? ''),
            'references' => [],
            'photo_count_used' => count($images),
            'simple_summary' => self::buildSimpleSummary($recommendedTaxon, $bestSpecificTaxon, $payload),
            'text' => self::buildPublicText($payload, $recommendedTaxon, $bestSpecificTaxon),
            'display_ja' => self::buildDisplayJa($recommendedTaxon, $bestSpecificTaxon, $payload),
        ];
    }

    public static function synthesizeCandidateFusion(array $resolvedCandidates): array
    {
        $resolvedCandidates = array_values(array_filter($resolvedCandidates, fn($candidate) => is_array($candidate)));
        if ($resolvedCandidates === []) {
            return [
                'recommended_taxon' => null,
                'best_specific_taxon' => null,
                'stable_taxon' => null,
                'disagreement' => 'unresolved',
                'routing_hint' => 'unknown',
            ];
        }

        $bestSpecificTaxon = Taxonomy::toObservationTaxon($resolvedCandidates[0]);
        $stableTaxon = self::buildStableTaxon($resolvedCandidates) ?? $bestSpecificTaxon;
        $disagreement = self::deriveDisagreement($resolvedCandidates, $stableTaxon, $bestSpecificTaxon);

        return [
            'recommended_taxon' => $stableTaxon,
            'best_specific_taxon' => $bestSpecificTaxon,
            'stable_taxon' => $stableTaxon,
            'disagreement' => $disagreement,
            'routing_hint' => self::inferRoutingHint($bestSpecificTaxon ?? $stableTaxon),
        ];
    }

    public static function estimateCostUsd(array $observation, string $lane = 'fast'): float
    {
        $lane = self::normalizeLane($lane);
        $photoCount = min(count($observation['photos'] ?? []), (int)(self::LANE_PROFILES[$lane]['max_images'] ?? 2));
        $base = match ($lane) {
            'batch' => 0.00045,
            'deep' => 0.0011,
            default => 0.00022,
        };
        $perPhoto = match ($lane) {
            'batch' => 0.00012,
            'deep' => 0.0002,
            default => 0.00008,
        };
        return round($base + ($photoCount * $perPhoto), 6);
    }

    private static function resolvePhotoPaths(array $observation, int $limit = 3): array
    {
        $paths = [];
        foreach (array_slice($observation['photos'] ?? [], 0, max(1, $limit)) as $relativePath) {
            if (!is_string($relativePath) || $relativePath === '') {
                continue;
            }
            $relativePath = ltrim($relativePath, '/');
            $fullPath = PUBLIC_DIR . '/' . $relativePath;
            if (is_file($fullPath)) {
                $paths[] = $fullPath;
            }
        }
        return $paths;
    }

    private static function resizeAndEncode(string $path, int $maxDim): ?array
    {
        $mimeType = mime_content_type($path) ?: 'image/jpeg';
        $img = match ($mimeType) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            'image/gif' => @imagecreatefromgif($path),
            default => false,
        };

        if (!$img) {
            return null;
        }

        $width = imagesx($img);
        $height = imagesy($img);
        if ($width > $maxDim || $height > $maxDim) {
            $ratio = min($maxDim / $width, $maxDim / $height);
            $newWidth = max(1, (int)round($width * $ratio));
            $newHeight = max(1, (int)round($height * $ratio));
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($resized, $img, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($img);
            $img = $resized;
        }

        ob_start();
        imagejpeg($img, null, 82);
        $binary = ob_get_clean();
        imagedestroy($img);

        if (!is_string($binary) || $binary === '') {
            return null;
        }

        return [
            'data' => base64_encode($binary),
            'mime' => 'image/jpeg',
        ];
    }

    private static function callModel(array $images, array $observation, array $profile): ?array
    {
        $model = (string)$profile['model'];
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;
        $observedAt = (string)($observation['observed_at'] ?? '');
        $month = self::extractMonth($observedAt);
        $season = self::monthToSeason($month);
        $context = [
            'cultivation' => $observation['cultivation'] ?? 'wild',
            'organism_origin' => $observation['organism_origin'] ?? 'wild',
            'managed_context_type' => $observation['managed_context']['type'] ?? null,
            'managed_site_name' => $observation['managed_context']['site_name'] ?? null,
            'biome' => $observation['biome'] ?? 'unknown',
            'life_stage' => $observation['life_stage'] ?? 'unknown',
            'prefecture' => $observation['prefecture'] ?? '',
            'municipality' => $observation['municipality'] ?? '',
            'lat' => isset($observation['lat']) ? round((float)$observation['lat'], 2) : null,
            'lng' => isset($observation['lng']) ? round((float)$observation['lng'], 2) : null,
            'observed_at' => $observedAt,
            'month' => $month,
            'season' => $season,
            'photo_count' => count($images),
            'note' => self::clip($observation['note'] ?? '', 160),
        ];

        $prompt = <<<PROMPT
あなたは ikimon.life の公開用 AI考察エンジンです。役割は「種名を断定すること」ではなく、観察者と同定者に役立つ、やさしく具体的な根拠つきメモを作ることです。

観察コンテキスト:
{$context['cultivation']} / {$context['organism_origin']} / {$context['managed_context_type']} / {$context['managed_site_name']} / {$context['biome']} / {$context['life_stage']}
場所: {$context['municipality']} {$context['prefecture']} ({$context['lat']}, {$context['lng']})
日時: {$context['observed_at']} / {$context['month']}月 / {$context['season']}
写真枚数: {$context['photo_count']}
メモ: {$context['note']}

必須ルール:
1. 断定より保守性を優先してください。属や科で止めるのは正常です。
2. JSONのみ返してください。Markdown禁止。
3. 実在確認していない論文・URL・DOIを出してはいけません。references は必ず空配列にしてください。
4. 地理・季節は「弱い補助証拠」としてのみ使ってください。形態と矛盾する場合は採用しないでください。
5. 複数枚ある場合は、枚数差分で見えている形質の増減を反映してください。
6. summary / why_not_more_specific / geographic_context / seasonal_context / observer_boost / next_step は80文字以内、日本語。
7. diagnostic_features_seen / similar_taxa_to_compare / missing_evidence は各4件以内、短い日本語句。
8. species レベルを勧めるのは写真から識別形質が明瞭な場合だけです。迷うなら genus / family を選んでください。
9. 観察者を萎縮させる表現は禁止です。「不足」「弱い」より「次にこれが見えると絞りやすい」のように前向きに伝えてください。
10. observer_boost は、観察者の自己効力感を上げる短い一文にしてください。過度に褒めず、何が既に有効な観察かを伝えてください。
11. next_step は、次に何を撮れば精度が上がるかを具体的に1文で示してください。負担感ではなく「ここまでできれば十分役立つ」に寄せてください。
12. suggestions は1〜3件で、迷いがあるときは候補を複数返してください。候補同士で共通する階級があるなら、その共通範囲を意識して suggestions を組んでください。

出力形式:
{
  "confidence_band": "high|medium|low",
  "recommended_rank": "family|genus|species|order|class|phylum|kingdom|unknown",
  "summary": "...",
  "why_not_more_specific": "...",
  "geographic_context": "...",
  "seasonal_context": "...",
  "observer_boost": "...",
  "next_step": "...",
  "cautionary_note": "...",
  "diagnostic_features_seen": ["...", "..."],
  "similar_taxa_to_compare": ["...", "..."],
  "missing_evidence": ["...", "..."],
  "references": [],
  "suggestions": [
    {"label": "ツツジ科", "confidence": "high", "reason": "花形と葉のつき方が一致", "emoji": "🌺"}
  ]
}
PROMPT;

        $parts = [['text' => $prompt]];
        foreach ($images as $image) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $image['mime'],
                    'data' => $image['data'],
                ],
            ];
        }

        $request = [
            'contents' => [[
                'parts' => $parts,
            ]],
            'generationConfig' => [
                'temperature' => 0.1,
                'maxOutputTokens' => (int)$profile['max_output_tokens'],
                'responseMimeType' => 'application/json',
                'responseSchema' => self::responseSchema(false),
            ],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => (int)$profile['timeout'],
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if (!is_string($response) || $response === '' || $httpCode !== 200) {
            throw new RuntimeException('AI assessment API failed: HTTP ' . $httpCode . ' ' . $error);
        }

        $decoded = json_decode($response, true);
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
        if (!is_string($text) || trim($text) === '') {
            throw new RuntimeException('AI assessment returned empty payload');
        }

        $payload = self::decodeModelJsonPayload($text);
        if (!is_array($payload)) {
            $payload = self::requestRepairPayload($images, $observation, $profile);
        }
        if (!is_array($payload)) {
            throw new RuntimeException('AI assessment JSON parse failed');
        }

        $payload = self::normalizePayloadShape($payload);
        $payload['suggestions'] = self::sanitizeSuggestions($payload['suggestions'] ?? []);
        return $payload;
    }

    private static function sanitizeSuggestions(array $suggestions): array
    {
        $clean = [];
        foreach (array_slice($suggestions, 0, 3) as $suggestion) {
            if (!is_array($suggestion) || trim((string)($suggestion['label'] ?? '')) === '') {
                continue;
            }
            $clean[] = [
                'label' => self::clip($suggestion['label'] ?? '', 60),
                'confidence' => in_array(($suggestion['confidence'] ?? ''), ['high', 'medium', 'low'], true) ? $suggestion['confidence'] : 'low',
                'reason' => self::clip($suggestion['reason'] ?? '', 40),
                'emoji' => self::clip($suggestion['emoji'] ?? '🔬', 4),
            ];
        }
        return $clean;
    }

    private static function buildProviderCandidates(array $suggestions, string $model): array
    {
        $candidates = [];
        foreach (self::sanitizeSuggestions($suggestions) as $suggestion) {
            $resolved = Taxonomy::resolveSuggestion($suggestion);
            $candidates[] = [
                'provider' => 'gemini',
                'model' => $model,
                'label' => $suggestion['label'],
                'confidence' => $suggestion['confidence'],
                'reason' => $suggestion['reason'],
                'emoji' => $suggestion['emoji'],
                'resolved' => $resolved,
            ];
        }
        return $candidates;
    }

    private static function storageCandidate(array $candidate): array
    {
        return [
            'provider' => $candidate['provider'] ?? 'unknown',
            'model' => $candidate['model'] ?? null,
            'label' => $candidate['label'] ?? '',
            'confidence' => $candidate['confidence'] ?? 'low',
            'reason' => $candidate['reason'] ?? '',
            'emoji' => $candidate['emoji'] ?? '🔬',
            'resolved_taxon' => !empty($candidate['resolved']) ? Taxonomy::toObservationTaxon($candidate['resolved']) : null,
        ];
    }

    private static function sanitizeList(array $values, int $limit): array
    {
        $clean = [];
        foreach (array_slice($values, 0, $limit) as $value) {
            $text = self::clip((string)$value, 36);
            if ($text !== '') {
                $clean[] = $text;
            }
        }
        return array_values(array_unique($clean));
    }

    private static function sanitizePublicList(array $values, int $limit): array
    {
        $clean = [];
        foreach (array_slice($values, 0, $limit) as $value) {
            $text = self::normalizePublicText((string)$value, 36);
            if ($text !== '') {
                $clean[] = $text;
            }
        }
        return array_values(array_unique($clean));
    }

    private static function clip(string $value, int $limit = 80): string
    {
        return mb_substr(trim(strip_tags($value)), 0, $limit);
    }

    private static function normalizePublicText(string $value, int $limit = 80): string
    {
        $text = self::clip($value, $limit);
        if ($text === '') {
            return '';
        }
        if (preg_match('/[\p{Hiragana}\p{Katakana}\p{Han}]/u', $text) === 1) {
            return $text;
        }
        return preg_match('/[A-Za-z]/', $text) === 1 ? '' : $text;
    }

    private static function decodeModelJsonPayload(string $text): ?array
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        if (str_starts_with($text, '```')) {
            $text = preg_replace('/^```(?:json)?\s*/u', '', $text);
            $text = preg_replace('/\s*```$/u', '', $text);
            $text = trim((string)$text);
        }

        $payload = json_decode($text, true);
        if (is_array($payload)) {
            return $payload;
        }

        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $candidate = substr($text, $start, $end - $start + 1);
            $candidate = preg_replace('/,\s*([}\]])/u', '$1', (string)$candidate);
            $payload = json_decode((string)$candidate, true);
            if (is_array($payload)) {
                return $payload;
            }
        }

        return null;
    }

    private static function requestRepairPayload(array $images, array $observation, array $profile): ?array
    {
        $observedAt = (string)($observation['observed_at'] ?? '');
        $month = self::extractMonth($observedAt);
        $season = self::monthToSeason($month);
        $prompt = <<<PROMPT
JSONのみ返してください。Markdown禁止。短く返してください。
必要キーは5つだけです:
confidence_band,recommended_rank,summary,next_step,suggestions
suggestions は最大2件。各要素は label,confidence,reason,emoji を持たせてください。
わからない場合は recommended_rank を unknown、suggestions を空配列にしてください。
場所: {$observation['municipality']} {$observation['prefecture']}
日時: {$observedAt}
季節: {$month}月 / {$season}
PROMPT;

        $parts = [['text' => $prompt]];
        foreach ($images as $image) {
            $parts[] = [
                'inline_data' => [
                    'mime_type' => $image['mime'],
                    'data' => $image['data'],
                ],
            ];
        }

        $request = [
            'contents' => [[
                'parts' => $parts,
            ]],
            'generationConfig' => [
                'temperature' => 0.05,
                'maxOutputTokens' => 220,
                'responseMimeType' => 'application/json',
                'responseSchema' => self::responseSchema(true),
            ],
        ];

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . self::REPAIR_MODEL . ':generateContent?key=' . GEMINI_API_KEY;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(8, (int)$profile['timeout']),
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!is_string($response) || $response === '' || $httpCode !== 200) {
            return null;
        }

        $decoded = json_decode($response, true);
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
        return is_string($text) ? self::decodeModelJsonPayload($text) : null;
    }

    private static function attemptReliableRetry(array $observation, array $options): ?array
    {
        $retryProfile = self::resolveProfile(array_merge($options, [
            'lane' => 'batch',
            'model' => self::REPAIR_MODEL,
        ]));

        $retryPhotoPaths = self::resolvePhotoPaths($observation, max(2, (int)$retryProfile['max_images']));
        if ($retryPhotoPaths === []) {
            return null;
        }

        $retryImages = [];
        foreach ($retryPhotoPaths as $photoPath) {
            $image = self::resizeAndEncode($photoPath, max(640, (int)$retryProfile['max_dim']));
            if ($image !== null) {
                $retryImages[] = $image;
            }
        }
        if ($retryImages === []) {
            return null;
        }

        try {
            return self::callModel($retryImages, $observation, [
                'lane' => 'batch',
                'model' => self::REPAIR_MODEL,
                'max_images' => max(2, (int)$retryProfile['max_images']),
                'max_dim' => max(640, (int)$retryProfile['max_dim']),
                'max_output_tokens' => max(480, (int)$retryProfile['max_output_tokens']),
                'timeout' => max(16, (int)$retryProfile['timeout']),
            ]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function normalizeRecommendedRank(mixed $value): string
    {
        $rank = is_string($value) ? strtolower(trim($value)) : '';
        if (in_array($rank, self::RANK_ORDER, true) || $rank === 'unknown') {
            return $rank;
        }

        $numeric = is_numeric($value) ? (int)$value : null;
        return match ($numeric) {
            1 => 'kingdom',
            2 => 'phylum',
            3 => 'class',
            4 => 'order',
            5 => 'family',
            6 => 'genus',
            7 => 'species',
            default => 'unknown',
        };
    }

    private static function responseSchema(bool $compact): array
    {
        $base = [
            'type' => 'OBJECT',
            'properties' => [
                'confidence_band' => [
                    'type' => 'STRING',
                    'enum' => ['high', 'medium', 'low'],
                ],
                'recommended_rank' => [
                    'type' => 'STRING',
                    'enum' => ['family', 'genus', 'species', 'order', 'class', 'phylum', 'kingdom', 'unknown'],
                ],
                'summary' => ['type' => 'STRING'],
                'next_step' => ['type' => 'STRING'],
                'suggestions' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'label' => ['type' => 'STRING'],
                            'confidence' => [
                                'type' => 'STRING',
                                'enum' => ['high', 'medium', 'low'],
                            ],
                            'reason' => ['type' => 'STRING'],
                            'emoji' => ['type' => 'STRING'],
                        ],
                        'required' => ['label', 'confidence', 'reason', 'emoji'],
                    ],
                ],
            ],
            'required' => ['confidence_band', 'recommended_rank', 'summary', 'next_step', 'suggestions'],
        ];

        if ($compact) {
            return $base;
        }

        $base['properties'] += [
            'why_not_more_specific' => ['type' => 'STRING'],
            'geographic_context' => ['type' => 'STRING'],
            'seasonal_context' => ['type' => 'STRING'],
            'observer_boost' => ['type' => 'STRING'],
            'cautionary_note' => ['type' => 'STRING'],
            'diagnostic_features_seen' => [
                'type' => 'ARRAY',
                'items' => ['type' => 'STRING'],
            ],
            'similar_taxa_to_compare' => [
                'type' => 'ARRAY',
                'items' => ['type' => 'STRING'],
            ],
            'missing_evidence' => [
                'type' => 'ARRAY',
                'items' => ['type' => 'STRING'],
            ],
            'references' => [
                'type' => 'ARRAY',
                'items' => ['type' => 'STRING'],
            ],
        ];

        $base['required'] = array_merge($base['required'], [
            'why_not_more_specific',
            'geographic_context',
            'seasonal_context',
            'observer_boost',
            'cautionary_note',
            'diagnostic_features_seen',
            'similar_taxa_to_compare',
            'missing_evidence',
            'references',
        ]);

        return $base;
    }

    private static function normalizePayloadShape(array $payload): array
    {
        $payload['references'] = [];
        $payload['confidence_band'] = in_array(($payload['confidence_band'] ?? ''), ['high', 'medium', 'low'], true)
            ? $payload['confidence_band']
            : 'low';
        $payload['recommended_rank'] = self::normalizeRecommendedRank($payload['recommended_rank'] ?? null);
        $payload['summary'] = self::normalizePublicText((string)($payload['summary'] ?? ''), 80);
        $payload['why_not_more_specific'] = self::normalizePublicText((string)($payload['why_not_more_specific'] ?? ''), 80);
        $payload['geographic_context'] = self::normalizePublicText((string)($payload['geographic_context'] ?? ''), 80);
        $payload['seasonal_context'] = self::normalizePublicText((string)($payload['seasonal_context'] ?? ''), 80);
        $payload['observer_boost'] = self::normalizePublicText((string)($payload['observer_boost'] ?? ''), 80);
        $payload['next_step'] = self::normalizePublicText((string)($payload['next_step'] ?? ''), 80);
        $payload['cautionary_note'] = self::normalizePublicText((string)($payload['cautionary_note'] ?? ''), 80);
        $payload['diagnostic_features_seen'] = self::sanitizePublicList($payload['diagnostic_features_seen'] ?? [], 4);
        $payload['similar_taxa_to_compare'] = self::sanitizePublicList($payload['similar_taxa_to_compare'] ?? [], 4);
        $payload['missing_evidence'] = self::sanitizePublicList($payload['missing_evidence'] ?? [], 4);
        $payload['suggestions'] = is_array($payload['suggestions'] ?? null) ? $payload['suggestions'] : [];
        return $payload;
    }

    private static function buildFallbackAssessment(array $observation, array $profile, int $photoCountUsed): array
    {
        $taxon = $observation['taxon'] ?? [];
        $recommended = !empty($taxon) && is_array($taxon) ? $taxon : null;
        $recommendedName = (string)($recommended['name'] ?? '不明');
        $rank = (string)($recommended['rank'] ?? 'unknown');

        $summary = $recommended
            ? $recommendedName . ' として記録されています。写真からの再解析はまとまらなかったため、今は既存の同定を手がかりに見ます。'
            : '写真からの自動解析はまとまりませんでした。今は不明として扱い、次の写真で絞るのが安全です。';

        $nextStep = self::suggestNextStepFromObservation($observation);

        return [
            'id' => 'ai-fallback-' . substr(bin2hex(random_bytes(8)), 0, 12),
            'kind' => 'machine_assessment',
            'created_at' => date('Y-m-d H:i:s'),
            'visibility' => 'public',
            'model' => 'system-fallback',
            'processing_lane' => $profile['lane'],
            'fallback_stage' => $profile['lane'],
            'fallback_reason' => 'insufficient_confident_signal',
            'prompt_version' => self::PROMPT_VERSION,
            'pipeline_version' => self::PIPELINE_VERSION . '_fallback',
            'taxonomy_version' => $recommended['taxonomy_version'] ?? null,
            'recommended_taxon' => $recommended ? Taxonomy::toObservationTaxon($recommended) : null,
            'recommended_rank' => $rank !== '' ? $rank : 'unknown',
            'best_specific_taxon' => $recommended ? Taxonomy::toObservationTaxon($recommended) : null,
            'stable_taxon' => $recommended ? Taxonomy::toObservationTaxon($recommended) : null,
            'candidate_disagreement' => 'unresolved',
            'routing_hint' => $rank !== '' ? $rank : 'unknown',
            'provider_candidates' => [],
            'confidence_band' => 'low',
            'summary' => self::clip($summary, 80),
            'why_not_more_specific' => '見分けに効く部位がまだ足りず、ここでは保守的に止めています。',
            'diagnostic_features_seen' => [],
            'similar_taxa_to_compare' => [],
            'missing_evidence' => self::buildFallbackMissingEvidence($observation),
            'geographic_context' => '',
            'seasonal_context' => '',
            'observer_boost' => '記録としては十分残っています。次の一枚が入ると進めやすくなります。',
            'next_step' => $nextStep,
            'cautionary_note' => '',
            'references' => [],
            'photo_count_used' => $photoCountUsed,
            'simple_summary' => self::clip($summary, 120),
            'text' => implode("\n", array_filter([
                $recommended ? '推奨: ' . $recommendedName . '（' . $rank . '）' : '推奨: 不明',
                'いま見えていること: ' . self::clip($summary, 80),
                'ここで止める理由: 見分けに効く部位がまだ足りず、ここでは保守的に止めています。',
                '次に試すと良さそう: ' . $nextStep,
            ])),
            'display_ja' => self::buildDisplayJa(
                $recommended ? Taxonomy::toObservationTaxon($recommended) : null,
                $recommended ? Taxonomy::toObservationTaxon($recommended) : null,
                [
                    'summary' => $summary,
                    'why_not_more_specific' => '見分けに効く部位がまだ足りず、ここでは保守的に止めています。',
                    'diagnostic_features_seen' => [],
                    'similar_taxa_to_compare' => [],
                    'missing_evidence' => self::buildFallbackMissingEvidence($observation),
                    'observer_boost' => '記録としては十分残っています。次の一枚が入ると進めやすくなります。',
                    'next_step' => $nextStep,
                ]
            ),
        ];
    }

    private static function buildFallbackMissingEvidence(array $observation): array
    {
        $taxonName = (string)($observation['taxon']['name'] ?? '');
        if (str_contains($taxonName, '属') || str_contains($taxonName, '科')) {
            return ['花や実', '葉のつき方', '全体像'];
        }
        return ['全体像', '特徴が出る部位', '別角度の写真'];
    }

    private static function suggestNextStepFromObservation(array $observation): string
    {
        $taxonName = (string)($observation['taxon']['name'] ?? '');
        if ($taxonName !== '' && (str_contains($taxonName, '属') || str_contains($taxonName, '科'))) {
            return '花や実、葉のつき方が分かる写真が1枚あると、もう少し絞りやすくなります。';
        }
        return '全体像と、特徴が出る部位の寄りを1枚ずつ足すと、次の同定につながりやすいです。';
    }

    private static function buildSimpleSummary(?array $recommendedTaxon, ?array $bestSpecificTaxon, array $payload): string
    {
        $summary = self::clip($payload['summary'] ?? '');
        if ($recommendedTaxon && $bestSpecificTaxon && ($recommendedTaxon['id'] ?? null) !== ($bestSpecificTaxon['id'] ?? null)) {
            $base = ($recommendedTaxon['name'] ?? '未確定') . ' までは共通し、候補の中では ' . ($bestSpecificTaxon['name'] ?? '未確定') . ' が有力です。';
            return self::clip(trim($base . ' ' . $summary), 120);
        }
        if ($recommendedTaxon) {
            return self::clip(($recommendedTaxon['name'] ?? '未確定') . ' が有力です。' . ($summary !== '' ? ' ' . $summary : ''), 120);
        }
        return $summary;
    }

    private static function buildPublicText(array $payload, ?array $recommendedTaxon, ?array $bestSpecificTaxon): string
    {
        $lines = [];
        if ($recommendedTaxon) {
            $lines[] = '推奨: ' . ($recommendedTaxon['name'] ?? '未確定') . '（' . ($recommendedTaxon['rank'] ?? 'unknown') . '）';
        }
        if ($bestSpecificTaxon && $recommendedTaxon && ($bestSpecificTaxon['id'] ?? null) !== ($recommendedTaxon['id'] ?? null)) {
            $lines[] = '候補の中では: ' . ($bestSpecificTaxon['name'] ?? '未確定') . '（' . ($bestSpecificTaxon['rank'] ?? 'unknown') . '）';
        }
        if (!empty($payload['summary'])) {
            $lines[] = 'いま見えていること: ' . self::clip($payload['summary']);
        }
        if (!empty($payload['why_not_more_specific'])) {
            $lines[] = 'ここで止める理由: ' . self::clip($payload['why_not_more_specific']);
        }
        if (!empty($payload['geographic_context'])) {
            $lines[] = '場所から見るヒント: ' . self::clip($payload['geographic_context']);
        }
        if (!empty($payload['seasonal_context'])) {
            $lines[] = '季節から見るヒント: ' . self::clip($payload['seasonal_context']);
        }
        $diagnostic = self::sanitizeList($payload['diagnostic_features_seen'] ?? [], 3);
        if ($diagnostic !== []) {
            $lines[] = '見えている形質: ' . implode(' / ', $diagnostic);
        }
        $similar = self::sanitizeList($payload['similar_taxa_to_compare'] ?? [], 3);
        if ($similar !== []) {
            $lines[] = '見分け候補: ' . implode(' / ', $similar);
        }
        $missing = self::sanitizeList($payload['missing_evidence'] ?? [], 3);
        if ($missing !== []) {
            $lines[] = 'あるともっと絞りやすい情報: ' . implode(' / ', $missing);
        }
        if (!empty($payload['cautionary_note'])) {
            $lines[] = '注意: ' . self::clip($payload['cautionary_note']);
        }
        if (!empty($payload['observer_boost'])) {
            $lines[] = 'この観察の良いところ: ' . self::clip($payload['observer_boost']);
        }
        if (!empty($payload['next_step'])) {
            $lines[] = '次に試すと良さそう: ' . self::clip($payload['next_step']);
        }

        return implode("\n", $lines);
    }

    private static function buildDisplayJa(?array $recommendedTaxon, ?array $bestSpecificTaxon, array $payload): array
    {
        $features = self::sanitizeList($payload['diagnostic_features_seen'] ?? [], 3);
        $similar = self::sanitizeList($payload['similar_taxa_to_compare'] ?? [], 3);
        $missing = self::sanitizeList($payload['missing_evidence'] ?? [], 3);

        $narrativeParts = [];

        if ($recommendedTaxon) {
            $recommendedName = (string)($recommendedTaxon['name'] ?? '未確定');
            $recommendedRank = (string)($recommendedTaxon['rank'] ?? 'unknown');
            if ($bestSpecificTaxon && ($bestSpecificTaxon['id'] ?? null) !== ($recommendedTaxon['id'] ?? null)) {
                $narrativeParts[] = $recommendedName . ' まではかなり近く、候補の中では ' . (string)($bestSpecificTaxon['name'] ?? '未確定') . ' が有力です。';
            } else {
                $rankLabel = self::RANK_LABELS[$recommendedRank] ?? '';
                $rankText = $rankLabel !== '' ? $rankLabel . 'レベルで' : '';
                $narrativeParts[] = '写真から見ると、' . $rankText . $recommendedName . ' にかなり近そうです。';
            }
        }

        $summary = self::clip((string)($payload['summary'] ?? ''), 120);
        if ($summary !== '') {
            $narrativeParts[] = $summary;
        } elseif ($features !== []) {
            $narrativeParts[] = '見えている手がかりは ' . implode('、', $features) . ' です。';
        }

        if ($similar !== []) {
            $narrativeParts[] = '似た候補としては ' . implode('、', $similar) . ' があり、このあたりを見分ける観察になりそうです。';
        }

        $why = self::clip((string)($payload['why_not_more_specific'] ?? ''), 120);
        if ($why === '' && $missing !== []) {
            $why = '花や実、葉のつき方など、違いが出る部位がもう少し見えると次に進みやすいです。';
        }

        $next = self::clip((string)($payload['next_step'] ?? ''), 120);
        if ($next === '' && $missing !== []) {
            $next = implode(' / ', $missing) . ' が分かる写真があると、もう一段絞りやすくなります。';
        }

        $observerBoost = self::clip((string)($payload['observer_boost'] ?? ''), 120);

        return [
            'narrative' => self::clip(implode(' ', array_values(array_filter($narrativeParts))), 220),
            'reason_to_stop' => $why,
            'next_action' => $next,
            'observer_note' => $observerBoost,
        ];
    }

    private static function buildStableTaxon(array $resolvedCandidates): ?array
    {
        $first = $resolvedCandidates[0] ?? null;
        if (!is_array($first)) {
            return null;
        }

        $commonRank = null;
        $commonNode = null;
        foreach (self::RANK_ORDER as $rank) {
            $shared = null;
            foreach ($resolvedCandidates as $candidate) {
                $node = self::nodeForRank($candidate, $rank);
                if ($node === null) {
                    $shared = null;
                    break;
                }
                if ($shared === null) {
                    $shared = $node;
                    continue;
                }
                if (($shared['id'] ?? '') !== ($node['id'] ?? '') || ($shared['name'] ?? '') !== ($node['name'] ?? '')) {
                    $shared = null;
                    break;
                }
            }
            if ($shared !== null) {
                $commonRank = $rank;
                $commonNode = $shared;
            }
        }

        if ($commonRank === null || $commonNode === null) {
            return Taxonomy::toObservationTaxon($first);
        }

        return self::buildTaxonSnapshotAtRank($first, $commonRank, $commonNode);
    }

    private static function buildTaxonSnapshotAtRank(array $resolved, string $rank, array $node): array
    {
        $lineage = [];
        $lineageIds = [];
        $ancestryIds = [];
        $fullPathIds = [];

        foreach (self::RANK_ORDER as $lineageRank) {
            if ($lineageRank === $rank) {
                $fullPathIds[] = $node['id'];
                break;
            }

            $ancestor = self::nodeForRank($resolved, $lineageRank);
            if ($ancestor === null) {
                continue;
            }
            $lineage[$lineageRank] = $ancestor['name'];
            $lineageIds[$lineageRank] = $ancestor['id'];
            $ancestryIds[] = $ancestor['id'];
            $fullPathIds[] = $ancestor['id'];
        }

        $taxonId = (string)($node['id'] ?? '');
        $provider = str_contains($taxonId, ':') ? explode(':', $taxonId, 2)[0] : ($resolved['provider'] ?? 'unknown');
        $providerId = str_contains($taxonId, ':') ? explode(':', $taxonId, 2)[1] : ($resolved['provider_id'] ?? null);
        $gbifKey = ($provider === 'gbif' && is_numeric((string)$providerId)) ? (int)$providerId : null;

        $taxon = [
            'id' => $taxonId,
            'name' => $node['name'],
            'scientific_name' => $node['name'],
            'slug' => ($resolved['rank'] ?? '') === $rank ? ($resolved['slug'] ?? '') : '',
            'rank' => $rank,
            'provider' => $provider,
            'provider_id' => $providerId,
            'key' => $gbifKey,
            'gbif_key' => $gbifKey,
            'inat_taxon_id' => ($provider === 'inat' && is_numeric((string)$providerId)) ? (int)$providerId : null,
            'lineage' => $lineage,
            'lineage_ids' => $lineageIds,
            'ancestry' => implode('/', $ancestryIds),
            'ancestry_ids' => $ancestryIds,
            'full_path_ids' => $fullPathIds,
            'taxonomy_version' => $resolved['taxonomy_version'] ?? null,
            'source' => $provider,
            'thumbnail_url' => ($resolved['rank'] ?? '') === $rank ? ($resolved['thumbnail_url'] ?? null) : null,
            'canonical_name' => $node['name'],
        ];

        foreach ($lineage as $lineageRank => $lineageName) {
            $taxon[$lineageRank] = $lineageName;
        }

        return $taxon;
    }

    private static function nodeForRank(array $resolved, string $rank): ?array
    {
        $resolvedRank = strtolower((string)($resolved['rank'] ?? ''));
        if ($resolvedRank === $rank) {
            $name = trim((string)($resolved['name'] ?? ''));
            $id = trim((string)($resolved['taxon_id'] ?? ''));
            if ($name !== '' && $id !== '') {
                return ['id' => $id, 'name' => $name];
            }
        }

        $lineage = is_array($resolved['lineage'] ?? null) ? $resolved['lineage'] : [];
        $lineageIds = is_array($resolved['lineage_ids'] ?? null) ? $resolved['lineage_ids'] : [];
        $name = trim((string)($lineage[$rank] ?? ''));
        if ($name === '') {
            return null;
        }
        $id = trim((string)($lineageIds[$rank] ?? ''));
        if ($id === '') {
            $id = 'fallback:' . $rank . ':' . md5($name);
        }
        return ['id' => $id, 'name' => $name];
    }

    private static function deriveDisagreement(array $resolvedCandidates, ?array $stableTaxon, ?array $bestSpecificTaxon): string
    {
        if (count($resolvedCandidates) <= 1) {
            return 'single_candidate';
        }
        if (($stableTaxon['id'] ?? null) === ($bestSpecificTaxon['id'] ?? null)) {
            return 'same_taxon';
        }
        $stableRank = (string)($stableTaxon['rank'] ?? '');
        return in_array($stableRank, ['family', 'genus', 'species'], true) ? 'shared_lineage' : 'broad_lineage_only';
    }

    private static function inferRoutingHint(?array $taxon): string
    {
        if (!$taxon) {
            return 'unknown';
        }
        $kingdom = strtolower((string)($taxon['kingdom'] ?? ''));
        $class = strtolower((string)($taxon['class'] ?? ''));
        $phylum = strtolower((string)($taxon['phylum'] ?? ''));

        if ($kingdom === 'plantae') {
            return 'plant';
        }
        if ($kingdom === 'fungi') {
            return 'fungi';
        }
        if ($class === 'aves') {
            return 'bird';
        }
        if ($phylum === 'arthropoda') {
            return 'arthropod';
        }
        if ($kingdom === 'animalia') {
            return 'animal';
        }
        return 'unknown';
    }

    private static function resolveProfile(array $options): array
    {
        $lane = self::normalizeLane((string)($options['lane'] ?? 'fast'));
        $profile = self::LANE_PROFILES[$lane] ?? self::LANE_PROFILES['fast'];
        $profile['lane'] = $lane;
        $explicitModel = is_string($options['model'] ?? null) ? trim((string)$options['model']) : '';
        $profile['model'] = $explicitModel !== '' ? $explicitModel : self::resolveModelForLane($lane);
        foreach (['max_images', 'max_dim', 'max_output_tokens', 'timeout'] as $key) {
            if (isset($options[$key]) && is_numeric($options[$key])) {
                $profile[$key] = (int)$options[$key];
            }
        }
        return $profile;
    }

    private static function resolveModelForLane(string $lane): string
    {
        $envKey = 'GEMINI_' . strtoupper($lane) . '_MODEL';
        $value = getenv($envKey);
        if ($value === false || $value === '') {
            $value = $_SERVER[$envKey] ?? $_ENV[$envKey] ?? null;
        }
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
        return in_array($lane, ['batch', 'deep'], true) ? self::REPAIR_MODEL : self::DEFAULT_MODEL;
    }

    private static function normalizeLane(string $lane): string
    {
        return in_array($lane, ['fast', 'batch', 'deep'], true) ? $lane : 'fast';
    }

    private static function extractMonth(string $observedAt): ?int
    {
        if ($observedAt === '') {
            return null;
        }
        $ts = strtotime($observedAt);
        return $ts ? (int)date('n', $ts) : null;
    }

    private static function monthToSeason(?int $month): string
    {
        return match ($month) {
            3, 4, 5 => 'spring',
            6, 7, 8 => 'summer',
            9, 10, 11 => 'autumn',
            12, 1, 2 => 'winter',
            default => 'unknown',
        };
    }
}
