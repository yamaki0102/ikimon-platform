<?php

final class SitePulse
{
    private const ROOT_DIR = __DIR__ . '/..';

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function getAreas(): array
    {
        $areas = [];

        foreach (self::definitions() as $definition) {
            $signals = [];

            foreach ($definition['signals'] as $signal) {
                $absolutePath = self::ROOT_DIR . '/' . $signal['path'];
                if (!is_file($absolutePath)) {
                    continue;
                }

                $timestamp = filemtime($absolutePath);
                if ($timestamp === false) {
                    continue;
                }

                $signals[] = [
                    'label' => $signal['label'],
                    'path' => $signal['path'],
                    'updated_at' => $timestamp,
                ];
            }

            usort($signals, static fn(array $a, array $b): int => $b['updated_at'] <=> $a['updated_at']);
            $latestTimestamp = $signals[0]['updated_at'] ?? null;

            $areas[] = [
                'id' => $definition['id'],
                'icon' => $definition['icon'],
                'title' => $definition['title'],
                'description' => $definition['description'],
                'href' => $definition['href'],
                'updated_at' => $latestTimestamp,
                'active_signals' => array_map(
                    static fn(array $signal): string => $signal['label'],
                    array_slice($signals, 0, 3)
                ),
            ];
        }

        usort($areas, static fn(array $a, array $b): int => ($b['updated_at'] ?? 0) <=> ($a['updated_at'] ?? 0));

        return $areas;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function latestArea(): ?array
    {
        $areas = self::getAreas();
        return $areas[0] ?? null;
    }

    public static function formatJapaneseDate(?int $timestamp, bool $includeTime = false): string
    {
        if (!$timestamp) {
            return '確認中';
        }

        return date($includeTime ? 'Y年n月j日 H:i' : 'Y年n月j日', $timestamp);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function definitions(): array
    {
        return [
            [
                'id' => 'connection',
                'icon' => 'heart-handshake',
                'title' => 'ゆるいつながり',
                'description' => '反応しやすさと地域の見え方を整えています。',
                'href' => 'index.php',
                'signals' => [
                    ['path' => 'public_html/index.php', 'label' => '地域の集合知バナー'],
                    ['path' => 'public_html/observation_detail.php', 'label' => '観察詳細のリアクション'],
                    ['path' => 'public_html/api/toggle_like.php', 'label' => '足あとと反応の集計'],
                ],
            ],
            [
                'id' => 'recording',
                'icon' => 'camera',
                'title' => '投稿と観察の流れ',
                'description' => '撮って残して、あとから見返しやすい導線を磨いています。',
                'href' => 'post.php',
                'signals' => [
                    ['path' => 'public_html/post.php', 'label' => '投稿フォーム'],
                    ['path' => 'public_html/js/post-uploader.js', 'label' => 'アップロード体験'],
                    ['path' => 'public_html/api/post_observation.php', 'label' => '投稿保存'],
                    ['path' => 'public_html/observation_detail.php', 'label' => '観察詳細表示'],
                ],
            ],
            [
                'id' => 'search',
                'icon' => 'search',
                'title' => '検索と見つけやすさ',
                'description' => '欲しい記録や種に早くたどり着ける導線を更新しています。',
                'href' => 'explore.php',
                'signals' => [
                    ['path' => 'public_html/components/nav.php', 'label' => 'ヘッダー検索'],
                    ['path' => 'public_html/api/search.php', 'label' => '通常検索API'],
                    ['path' => 'public_html/api/semantic_search.php', 'label' => 'AI検索API'],
                    ['path' => 'libs/OmoikaneSearchEngine.php', 'label' => '検索エンジン'],
                    ['path' => 'libs/TaxonSearchService.php', 'label' => '種名検索'],
                ],
            ],
            [
                'id' => 'identification',
                'icon' => 'bot',
                'title' => '同定とAI補助',
                'description' => '観察後のヒントや同定作業を、今の運用に合わせて整理しています。',
                'href' => 'id_form.php',
                'signals' => [
                    ['path' => 'public_html/id_form.php', 'label' => '同定フォーム'],
                    ['path' => 'public_html/observation_detail.php', 'label' => 'AIメモ表示'],
                    ['path' => 'libs/OmoikaneInferenceEnhancer.php', 'label' => 'AI補助ロジック'],
                    ['path' => 'public_html/api/thank_identification.php', 'label' => '同定ありがとう導線'],
                ],
            ],
            [
                'id' => 'retention',
                'icon' => 'layout-dashboard',
                'title' => '再訪と継続利用',
                'description' => 'トップとダッシュボードで、次の行動が見えるようにしています。',
                'href' => 'dashboard.php',
                'signals' => [
                    ['path' => 'public_html/index.php', 'label' => 'トップ導線'],
                    ['path' => 'public_html/dashboard.php', 'label' => '個人ダッシュボード'],
                    ['path' => 'libs/HabitEngine.php', 'label' => '継続利用ロジック'],
                    ['path' => 'libs/QuestManager.php', 'label' => 'クエスト導線'],
                ],
            ],
            [
                'id' => 'organizations',
                'icon' => 'building-2',
                'title' => '組織利用と外部共有',
                'description' => '法人・自治体・研究用途の導線も現行機能に合わせています。',
                'href' => 'for-business/',
                'signals' => [
                    ['path' => 'public_html/for-business/index.php', 'label' => 'for Business'],
                    ['path' => 'public_html/for-researcher.php', 'label' => 'データ持ち帰りページ'],
                    ['path' => 'public_html/corporate_dashboard.php', 'label' => '組織ダッシュボード'],
                    ['path' => 'public_html/site_dashboard.php', 'label' => 'サイト記録ボード'],
                ],
            ],
        ];
    }
}
