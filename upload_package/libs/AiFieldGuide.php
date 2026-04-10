<?php

/**
 * AiFieldGuide.php — 観察会AIフィールドガイド
 *
 * Gemini Flash Lite 3.1 を使って、観察会参加者に
 * 「次に何を見てみようかな」と思えるヒントを提供する。
 *
 * 設計原則:
 * - 命令形は使わない（ジョブ・クラフティング）
 * - 特定の1種を名指しで「探して」と言わない
 * - 見つからなくても価値がある旨を必ず含める
 * - 集団効力感（みんなで）のメッセージを含める
 * - 探索自体を成功として扱う
 */

class AiFieldGuide
{
    private const MODEL = 'gemini-3.1-flash-lite-preview';
    private const CACHE_TTL = 300; // 5分キャッシュ（全員同じ提案を見る → 集団効力感）

    private const SYSTEM_PROMPT = <<<'PROMPT'
あなたは ikimon.life の観察会AIフィールドガイドです。

【あなたの役割】
参加者が「次に何を見てみようかな」と自発的に思えるヒントを出すこと。
命令や指示ではなく、好奇心を刺激する「気づき」を提供する。

【絶対ルール】
- 「撮影してください」「記録してください」は禁止。命令形を使わない
- 特定の1種だけを名指しで「探して」と言わない
- 「○○がいるはずです」と断言しない（自然は予測不能）
- 見つからなくても「それも価値ある情報」と必ず伝える
- 提案は場所や視点など2-3の選択肢を含める（ジョブ・クラフティング）
- 「みんなで」「この観察会で」というグループ意識を入れる

【トーン】
- タメ口、親しみやすい、ワクワクさせる
- 短く（80文字以内のメイン + 40文字以内の補足）
- 絵文字は1-2個まで

【応答フォーマット】
JSON で返してください:
{
  "suggestion": "メイン提案テキスト（80字以内）",
  "followup": "補足テキスト（40字以内）",
  "type": "viewpoint|taxon_gap|area|seasonal|target",
  "encouragement": "グループ進捗への言及（40字以内）",
  "absence_note": "見つからなかった場合のフォロー（40字以内）"
}
PROMPT;

    private const FALLBACK_SUGGESTIONS = [
        [
            'text' => '周りの音に耳を澄ませてみて。鳥の声、虫の音、何が聞こえる？',
            'followup' => '音も立派な自然の記録だよ',
            'type' => 'viewpoint',
            'encouragement' => 'みんなの観察が、この場所の記録を作ってるよ',
            'absence_note' => '静かな時間も、この場所の環境データになるよ',
        ],
        [
            'text' => '足元の地面をじっくり見てみて。落ち葉の下に小さな世界があるかも',
            'followup' => '小さな発見が一番ワクワクする',
            'type' => 'viewpoint',
            'encouragement' => '一人ひとりの視点が、チーム全体の発見を広げるよ',
            'absence_note' => '探した場所の記録は、次の観察会の手がかりになるよ',
        ],
        [
            'text' => '空を見上げてみて。雲と木の間を何かが横切るかも',
            'followup' => '上にも下にも、生きものはいるよ',
            'type' => 'viewpoint',
            'encouragement' => 'みんなで違う方向を見れば、見つかる種が増えるよ',
            'absence_note' => '空を見上げた時間も、この観察会の一部だよ',
        ],
        [
            'text' => '水辺があったら、水面の反射の下を覗いてみて。別世界が広がってるかも',
            'followup' => '水の中は陸とは違う生きものの宝庫',
            'type' => 'viewpoint',
            'encouragement' => 'みんなの記録が集まると、この場所の生態系が見えてくるよ',
            'absence_note' => '水辺を覗いた事実が、環境データとして残るよ',
        ],
        [
            'text' => '植物の花や葉に注目してみて。そこに何か小さなお客さんがいるかも',
            'followup' => '虫と植物の関係は観察の宝庫',
            'type' => 'taxon_gap',
            'encouragement' => '一つの発見が、チームの種リストを1つ増やすよ',
            'absence_note' => '「いなかった」も100年後に価値を持つデータだよ',
        ],
    ];

    /**
     * イベントの現在状況から AI 提案を生成
     */
    public static function suggest(array $eventContext): array
    {
        $cacheKey = 'ai_guide_' . ($eventContext['event_id'] ?? 'unknown');
        $cached = self::getCache($cacheKey);
        if ($cached !== null) {
            return $cached;
        }

        $prompt = self::buildPrompt($eventContext);
        $result = self::callGemini($prompt);

        if ($result === null) {
            $result = self::getFallback();
        }

        self::setCache($cacheKey, $result);
        return $result;
    }

    private static function buildPrompt(array $ctx): string
    {
        $title = $ctx['title'] ?? '観察会';
        $location = $ctx['location_name'] ?? '未設定';
        $date = $ctx['event_date'] ?? date('Y-m-d');
        $startTime = $ctx['start_time'] ?? '09:00';
        $endTime = $ctx['end_time'] ?? '12:00';
        $participantCount = (int)($ctx['participant_count'] ?? 0);
        $obsCount = (int)($ctx['observation_count'] ?? 0);
        $speciesCount = (int)($ctx['species_count'] ?? 0);
        $recentSpecies = $ctx['recent_species'] ?? '(なし)';
        $targetSpecies = $ctx['target_species'] ?? '(設定なし)';
        $targetProgress = $ctx['target_progress'] ?? '(なし)';
        $elapsedMin = (int)($ctx['elapsed_minutes'] ?? 0);
        $sinceLast = (int)($ctx['minutes_since_last'] ?? 0);

        $taxonBreakdown = '';
        if (!empty($ctx['taxon_counts'])) {
            $parts = [];
            foreach ($ctx['taxon_counts'] as $group => $count) {
                $parts[] = "{$group}{$count}件";
            }
            $taxonBreakdown = implode(', ', $parts);
        }

        $month = (int)date('n', strtotime($date));
        $season = match (true) {
            $month >= 3 && $month <= 5 => '春',
            $month >= 6 && $month <= 8 => '夏',
            $month >= 9 && $month <= 11 => '秋',
            default => '冬',
        };

        return <<<PROMPT
【観察会情報】
- タイトル: {$title}
- 場所: {$location}
- 日時: {$date} {$startTime}-{$endTime}
- 季節: {$season}

【現在の記録】
- 参加者: {$participantCount}人
- 記録数: {$obsCount}件
- 発見種数: {$speciesCount}種
- 分類群別: {$taxonBreakdown}
- 最近の記録: {$recentSpecies}

【目標種】{$targetSpecies}
【目標種の進捗】{$targetProgress}

【イベント経過】
- 開始から{$elapsedMin}分経過
- 最後の投稿から{$sinceLast}分経過

フィールドガイドとして、次の提案を1つ出してください。
PROMPT;
    }

    private static function callGemini(string $prompt): ?array
    {
        if (!defined('GEMINI_API_KEY') || !GEMINI_API_KEY) {
            return null;
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . self::MODEL . ':generateContent?key=' . GEMINI_API_KEY;

        $payload = [
            'contents' => [
                ['parts' => [['text' => $prompt]]],
            ],
            'systemInstruction' => [
                'parts' => [['text' => self::SYSTEM_PROMPT]],
            ],
            'generationConfig' => [
                'temperature' => 0.8,
                'maxOutputTokens' => 200,
                'responseMimeType' => 'application/json',
            ],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode !== 200) {
            error_log("[AiFieldGuide] Gemini API error: HTTP {$httpCode}, error: {$curlError}");
            return null;
        }

        $data = json_decode($response, true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$text) {
            error_log("[AiFieldGuide] Gemini returned empty content");
            return null;
        }

        $parsed = json_decode($text, true);
        if (!$parsed || empty($parsed['suggestion'])) {
            error_log("[AiFieldGuide] Failed to parse Gemini JSON: " . mb_substr($text, 0, 200));
            return null;
        }

        return [
            'text' => mb_substr($parsed['suggestion'] ?? '', 0, 120),
            'followup' => mb_substr($parsed['followup'] ?? '', 0, 80),
            'type' => $parsed['type'] ?? 'viewpoint',
            'encouragement' => mb_substr($parsed['encouragement'] ?? '', 0, 80),
            'absence_note' => mb_substr($parsed['absence_note'] ?? '', 0, 80),
        ];
    }

    private static function getFallback(): array
    {
        $idx = array_rand(self::FALLBACK_SUGGESTIONS);
        return self::FALLBACK_SUGGESTIONS[$idx];
    }

    private static function getCacheDir(): string
    {
        $dir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/') . 'cache/ai_guide/';
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        return $dir;
    }

    private static function getCache(string $key): ?array
    {
        $file = self::getCacheDir() . md5($key) . '.json';
        if (!file_exists($file)) {
            return null;
        }
        $data = json_decode(file_get_contents($file), true);
        if (!$data || (time() - ($data['_cached_at'] ?? 0)) > self::CACHE_TTL) {
            @unlink($file);
            return null;
        }
        unset($data['_cached_at']);
        return $data;
    }

    private static function setCache(string $key, array $value): void
    {
        $value['_cached_at'] = time();
        $file = self::getCacheDir() . md5($key) . '.json';
        file_put_contents($file, json_encode($value, JSON_UNESCAPED_UNICODE));
    }
}
