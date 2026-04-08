<?php
/**
 * ObservationSourceHelper — 3ソースの判別・メタデータ提供
 *
 * 観察データのソースを統一的に扱う。
 *
 * 3つのソース:
 *   post         → フィールドノート（ユーザーが能動的に写真撮影・投稿）
 *   ikimon_sensor → AIレンズ（ブラウザLiveScanner: Gemini Vision + Perch/BirdNET）
 *   fieldscan    → フィールドスキャン（Android APK: TFLite + BirdNET + 環境センサー）
 */
class ObservationSourceHelper
{
    /**
     * 観察レコードからソースを判別する。
     * record_source フィールドが優先。なければ旧データの推定。
     */
    public static function getSource(array $obs): string
    {
        // 新フィールド（2026-04以降）
        if (!empty($obs['record_source'])) {
            return $obs['record_source'];
        }

        // 旧データのフォールバック推定
        $importSource = $obs['import_source'] ?? '';
        $source       = $obs['source'] ?? '';
        $biomeMeta    = $obs['biome_meta'] ?? [];
        $obsSrc       = $obs['observation_source'] ?? '';

        if ($importSource === 'user_post' || in_array($source, ['manual', 'post_auto'])) {
            return 'post';
        }

        if ($source === 'passive' || $importSource === 'passive_observation') {
            // FieldScanとセンサーを区別するヒント
            $model = strtolower($obs['detection_model'] ?? '');
            if (str_contains($model, 'tflite') || str_contains($model, 'android')) {
                return 'fieldscan';
            }
            // scan_mode / device ヒント
            $device = strtolower($obs['device'] ?? '');
            if (str_contains($device, 'pixel') || str_contains($device, 'android')) {
                return 'fieldscan';
            }
            return 'ikimon_sensor';
        }

        return 'post'; // デフォルト
    }

    /**
     * ソースのメタデータ（UI表示用）を返す。
     *
     * @return array{
     *   label: string,
     *   short_label: string,
     *   icon: string,
     *   color_class: string,       // Tailwind bg class
     *   text_color_class: string,  // Tailwind text class
     *   border_color_class: string,
     *   emoji: string,
     *   description: string,       // ユーザー向け説明
     *   evidence_note: string,     // 証拠の根拠説明
     * }
     */
    public static function getMeta(string $source): array
    {
        return match ($source) {
            'post' => [
                'label'              => 'フィールドノート',
                'short_label'        => 'ノート',
                'icon'               => 'camera',
                'color_class'        => 'bg-blue-500/15',
                'text_color_class'   => 'text-blue-700',
                'border_color_class' => 'border-blue-400/30',
                'emoji'              => '📷',
                'description'        => 'あなたが現場で撮影した写真記録です。',
                'evidence_note'      => '写真による目視確認。同定センターでコミュニティレビュー可能。',
            ],
            'ikimon_sensor' => [
                'label'              => 'AIレンズ',
                'short_label'        => 'AIレンズ',
                'icon'               => 'radio',
                'color_class'        => 'bg-violet-500/15',
                'text_color_class'   => 'text-violet-700',
                'border_color_class' => 'border-violet-400/30',
                'emoji'              => '📡',
                'description'        => 'AIレンズ（ブラウザ）がAIで自動検出しました。',
                'evidence_note'      => 'Gemini Vision（視覚）またはBirdNET + Perch v2（音声）による機械検出。',
            ],
            'fieldscan' => [
                'label'              => 'フィールドスキャン',
                'short_label'        => 'スキャン',
                'icon'               => 'scan-line',
                'color_class'        => 'bg-emerald-500/15',
                'text_color_class'   => 'text-emerald-700',
                'border_color_class' => 'border-emerald-400/30',
                'emoji'              => '🔬',
                'description'        => 'フィールドスキャン（Android）が環境センサーと複数AIで記録しました。',
                'evidence_note'      => 'BirdNET v2.4 + Perch v2 デュアルエンジン音声解析。温度・気圧・照度・音響指数も同時記録。',
            ],
            default => [
                'label'              => 'フィールドノート',
                'short_label'        => '投稿',
                'icon'               => 'leaf',
                'color_class'        => 'bg-gray-500/15',
                'text_color_class'   => 'text-gray-600',
                'border_color_class' => 'border-gray-400/30',
                'emoji'              => '🌿',
                'description'        => '観察記録です。',
                'evidence_note'      => '',
            ],
        };
    }

    /**
     * 検出タイプのアイコン・ラベルを返す（パッシブ観察のみ）
     */
    public static function getDetectionMeta(array $obs): array
    {
        $type  = $obs['detection_type'] ?? 'visual';
        $model = $obs['detection_model'] ?? '';
        $conf  = (float)($obs['detection_confidence'] ?? $obs['batch_confidence'] ?? 0);
        $isBatch = !empty($obs['batch_evaluated']);
        $isDual  = ($obs['batch_engine'] ?? $obs['engine_source'] ?? '') === 'dual_agree';

        $base = match ($type) {
            'audio'  => ['icon' => 'mic', 'label' => '音声検出', 'emoji' => '🎤'],
            'visual' => ['icon' => 'eye', 'label' => '視覚検出', 'emoji' => '👁️'],
            'sensor' => ['icon' => 'activity', 'label' => 'センサー', 'emoji' => '📊'],
            default  => ['icon' => 'cpu', 'label' => 'AI検出', 'emoji' => '🤖'],
        };

        $engineLabel = '';
        if (str_contains(strtolower($model), 'birdnet') && str_contains(strtolower($model), 'perch')) {
            $engineLabel = 'デュアルエンジン';
        } elseif (str_contains(strtolower($model), 'birdnet')) {
            $engineLabel = 'BirdNET';
        } elseif (str_contains(strtolower($model), 'perch')) {
            $engineLabel = 'Perch v2';
        } elseif (str_contains(strtolower($model), 'gemini')) {
            $engineLabel = 'Gemini Vision';
        }

        if ($isBatch && $isDual) {
            $engineLabel = 'BirdNET + Perch v2';
        }

        $confLabel = match (true) {
            $conf >= 0.80 => ['text' => '高確信', 'class' => 'text-primary'],
            $conf >= 0.55 => ['text' => '中確信', 'class' => 'text-gray-600'],
            $conf >= 0.35 => ['text' => '低確信', 'class' => 'text-gray-500'],
            default       => ['text' => '参考', 'class' => 'text-gray-400'],
        };

        return array_merge($base, [
            'engine_label'   => $engineLabel,
            'confidence'     => $conf,
            'conf_label'     => $confLabel,
            'is_batch'       => $isBatch,
            'is_dual'        => $isDual,
            'is_tier_1_5'    => !empty($obs['batch_tier_1_5']),
        ]);
    }

    /**
     * ソースバッジ用のインラインHTML（コンポーネントinclude不要な箇所で使う）
     */
    public static function renderBadge(string $source, bool $withLabel = true): string
    {
        $m = self::getMeta($source);
        $label = $withLabel ? htmlspecialchars($m['short_label']) : '';
        $emoji = $m['emoji'];
        $colorClass  = $m['color_class'];
        $textClass   = $m['text_color_class'];
        $borderClass = $m['border_color_class'];

        if ($withLabel) {
            return "<span class=\"inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border {$colorClass} {$textClass} {$borderClass}\">"
                . "<span>{$emoji}</span><span>{$label}</span></span>";
        }
        return "<span class=\"inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] {$colorClass} border {$borderClass}\">{$emoji}</span>";
    }
}
