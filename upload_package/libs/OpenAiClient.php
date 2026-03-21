<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';

/**
 * OpenAiClient — GPT-5.4 nano テキスト生成専用レーン
 *
 * 用途: パーソナルクエスト文生成、同定理由ドラフト
 * 用途外: 写真分類（Gemini に任せる）
 */
class OpenAiClient
{
    private const MODEL = 'gpt-5.4-nano';
    private const API_URL = 'https://api.openai.com/v1/chat/completions';
    private const DEFAULT_TIMEOUT = 15;
    private const DEFAULT_MAX_TOKENS = 500;

    public static function isConfigured(): bool
    {
        return defined('OPENAI_API_KEY') && OPENAI_API_KEY !== '';
    }

    /**
     * テキスト生成（Structured Output 対応）
     *
     * @param string $systemPrompt システムプロンプト
     * @param string $userMessage ユーザーメッセージ
     * @param array|null $jsonSchema JSON Schema（Structured Output 用）
     * @param array $options オプション {max_tokens, temperature, timeout}
     * @return array|null パース済みレスポンス or null
     */
    public static function generate(
        string $systemPrompt,
        string $userMessage,
        ?array $jsonSchema = null,
        array $options = []
    ): ?array {
        if (!self::isConfigured()) return null;

        $maxTokens = (int)($options['max_tokens'] ?? self::DEFAULT_MAX_TOKENS);
        $temperature = (float)($options['temperature'] ?? 0.7);
        $timeout = (int)($options['timeout'] ?? self::DEFAULT_TIMEOUT);

        $payload = [
            'model' => self::MODEL,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userMessage],
            ],
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
        ];

        if ($jsonSchema !== null) {
            $payload['response_format'] = [
                'type' => 'json_schema',
                'json_schema' => [
                    'name' => $jsonSchema['name'] ?? 'response',
                    'strict' => true,
                    'schema' => $jsonSchema['schema'],
                ],
            ];
        }

        $ch = curl_init(self::API_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . OPENAI_API_KEY,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode !== 200) {
            error_log("[OpenAiClient] API error: HTTP {$httpCode}, error: {$error}");
            return null;
        }

        $decoded = json_decode($response, true);
        if (!$decoded) {
            error_log("[OpenAiClient] Invalid JSON response");
            return null;
        }

        $content = $decoded['choices'][0]['message']['content'] ?? '';
        if (empty($content)) {
            error_log("[OpenAiClient] Empty content in response");
            return null;
        }

        $parsed = json_decode($content, true);
        if ($parsed !== null) {
            return [
                'data' => $parsed,
                'usage' => $decoded['usage'] ?? [],
                'model' => $decoded['model'] ?? self::MODEL,
            ];
        }

        return [
            'data' => ['text' => $content],
            'usage' => $decoded['usage'] ?? [],
            'model' => $decoded['model'] ?? self::MODEL,
        ];
    }

    /**
     * テキスト生成（プレーンテキスト返却）
     */
    public static function generateText(
        string $systemPrompt,
        string $userMessage,
        array $options = []
    ): ?string {
        if (!self::isConfigured()) return null;

        $maxTokens = (int)($options['max_tokens'] ?? self::DEFAULT_MAX_TOKENS);
        $temperature = (float)($options['temperature'] ?? 0.7);
        $timeout = (int)($options['timeout'] ?? self::DEFAULT_TIMEOUT);

        $payload = [
            'model' => self::MODEL,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userMessage],
            ],
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
        ];

        $ch = curl_init(self::API_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . OPENAI_API_KEY,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false || $httpCode !== 200) return null;

        $decoded = json_decode($response, true);
        return $decoded['choices'][0]['message']['content'] ?? null;
    }

    /**
     * コスト見積もり
     */
    public static function estimateCostUsd(int $inputTokens, int $outputTokens): float
    {
        return round(($inputTokens * 0.20 / 1_000_000) + ($outputTokens * 1.25 / 1_000_000), 6);
    }
}
