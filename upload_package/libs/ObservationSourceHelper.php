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
                'label'              => __('source.post_label', 'Field note'),
                'short_label'        => __('source.post_short', 'Note'),
                'icon'               => 'camera',
                'color_class'        => 'bg-blue-500/15',
                'text_color_class'   => 'text-blue-700',
                'border_color_class' => 'border-blue-400/30',
                'emoji'              => '📷',
                'description'        => __('source.post_description', 'A photo record you captured in the field.'),
                'evidence_note'      => __('source.post_evidence', 'A visual record based on a photo. Community review is available later.'),
            ],
            'ikimon_sensor' => [
                'label'              => __('source.sensor_label', 'AI Lens'),
                'short_label'        => __('source.sensor_short', 'AI Lens'),
                'icon'               => 'radio',
                'color_class'        => 'bg-violet-500/15',
                'text_color_class'   => 'text-violet-700',
                'border_color_class' => 'border-violet-400/30',
                'emoji'              => '📡',
                'description'        => __('source.sensor_description', 'Detected automatically by the browser-based AI Lens.'),
                'evidence_note'      => __('source.sensor_evidence', 'Machine detection using Gemini Vision, BirdNET, or Perch v2.'),
            ],
            'fieldscan' => [
                'label'              => __('source.fieldscan_label', 'FieldScan'),
                'short_label'        => __('source.fieldscan_short', 'Scan'),
                'icon'               => 'scan-line',
                'color_class'        => 'bg-emerald-500/15',
                'text_color_class'   => 'text-emerald-700',
                'border_color_class' => 'border-emerald-400/30',
                'emoji'              => '🔬',
                'description'        => __('source.fieldscan_description', 'Recorded by FieldScan with environmental sensors and multiple AI models.'),
                'evidence_note'      => __('source.fieldscan_evidence', 'Dual-engine detection with supporting environment signals.'),
            ],
            default => [
                'label'              => __('source.default_label', 'Field note'),
                'short_label'        => __('source.default_short', 'Post'),
                'icon'               => 'leaf',
                'color_class'        => 'bg-gray-500/15',
                'text_color_class'   => 'text-gray-600',
                'border_color_class' => 'border-gray-400/30',
                'emoji'              => '🌿',
                'description'        => __('source.default_description', 'An observation record.'),
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
            'audio'  => ['icon' => 'mic', 'label' => __('source.detect_audio', 'Audio detection'), 'emoji' => '🎤'],
            'visual' => ['icon' => 'eye', 'label' => __('source.detect_visual', 'Visual detection'), 'emoji' => '👁️'],
            'sensor' => ['icon' => 'activity', 'label' => __('source.detect_sensor', 'Sensor'), 'emoji' => '📊'],
            default  => ['icon' => 'cpu', 'label' => __('source.detect_ai', 'AI detection'), 'emoji' => '🤖'],
        };

        $engineLabel = '';
        if (str_contains(strtolower($model), 'birdnet') && str_contains(strtolower($model), 'perch')) {
            $engineLabel = __('source.engine_dual', 'Dual engine');
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
            $conf >= 0.80 => ['text' => __('source.conf_high', 'High confidence'), 'class' => 'text-primary'],
            $conf >= 0.55 => ['text' => __('source.conf_medium', 'Medium confidence'), 'class' => 'text-gray-600'],
            $conf >= 0.35 => ['text' => __('source.conf_low', 'Low confidence'), 'class' => 'text-gray-500'],
            default       => ['text' => __('source.conf_reference', 'Reference'), 'class' => 'text-gray-400'],
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
