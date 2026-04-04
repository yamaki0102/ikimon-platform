<?php
declare(strict_types=1);

/**
 * BusinessTypeConfig — 業種別レポート設定マップ
 *
 * business_type 1つを変えるだけで
 * Geminiのペルソナ・注目指標・GSCキーワード分類・GBP重要指標が切り替わる
 *
 * 対応業種:
 *   restaurant  飲食店・カフェ・バー
 *   gym         フィットネス・ジム・スポーツ施設
 *   education   塾・スクール・アカデミー・習い事
 *   retail      小売・スーパー・EC・専門店
 *   consulting  コンサル・士業・BtoB
 *   design      デザイン・制作・クリエイティブ
 *   medical     クリニック・病院・整体・サロン
 *   realestate  不動産・建設・リフォーム
 *   other       汎用
 */
class BusinessTypeConfig
{
    private const CONFIGS = [

        'restaurant' => [
            'label'    => '飲食店',
            'icon'     => '🍽',
            'persona'  => '飲食店専門のWebマーケティングコンサルタント',
            'priorities' => [
                '予約・来店導線（メニュー・アクセス・予約ページの滞在時間と直帰率）',
                'Googleマップ経由の流入（GBP電話・経路案内クリック）',
                '「〇〇 ランチ」「カフェ 近く」など near intent キーワードのCTR',
                'モバイル比率（スマホで検索する顧客が多い）',
                '営業時間・定休日変更時のトラフィック変化',
            ],
            'kpi_focus' => ['bounceRate', 'averageSessionDuration', 'sessions'],
            'gsc_keyword_patterns' => ['ランチ', 'ディナー', 'ランチ', '予約', '近く', '営業', 'テイクアウト'],
            'gbp_important_metrics' => ['CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS'],
            'gbp_label' => 'マップからの電話・経路案内が来店の直接指標です',
            'action_hints' => 'メニューページとアクセスページの改善・Googleマップの写真更新',
        ],

        'gym' => [
            'label'    => 'フィットネス・ジム',
            'icon'     => '💪',
            'persona'  => 'フィットネス・スポーツ施設専門のデジタルマーケター',
            'priorities' => [
                '体験入会・無料体験申込ページのコンバージョン導線',
                '料金・プランページの滞在時間（検討度の高いユーザーがここを読む）',
                '「ジム 〇〇区」「パーソナルトレーニング」などのローカルキーワード順位',
                'リピーター率（会員継続の健全性）',
                'GBPの写真閲覧・施設確認（入会前の施設チェック行動）',
            ],
            'kpi_focus' => ['engagedSessions', 'newUsers', 'averageSessionDuration'],
            'gsc_keyword_patterns' => ['ジム', 'フィットネス', 'パーソナル', '体験', '料金', '入会'],
            'gbp_important_metrics' => ['WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_CONVERSATIONS'],
            'gbp_label' => '施設確認・問い合わせが入会検討の直接シグナルです',
            'action_hints' => '体験申込フォームの導線強化・施設写真のGBP更新',
        ],

        'education' => [
            'label'    => '教育・スクール',
            'icon'     => '🎓',
            'persona'  => '教育サービス・スクール専門のWebマーケティングアナリスト',
            'priorities' => [
                'カリキュラム・コース紹介ページの滞在時間（検討度が高い行動）',
                '資料請求・無料相談・入会申込ページへの遷移率',
                '「〇〇 スクール」「習い事」「個別指導」などの検索キーワード流入',
                '新規ユーザーの流入元（どのチャネルから検討者が来ているか）',
                '講師・実績・口コミページの閲覧（信頼形成の行動）',
            ],
            'kpi_focus' => ['newUsers', 'engagedSessions', 'screenPageViews'],
            'gsc_keyword_patterns' => ['スクール', '塾', '習い事', '資料請求', '体験', '個別', '講座'],
            'gbp_important_metrics' => ['WEBSITE_CLICKS', 'BUSINESS_CONVERSATIONS'],
            'gbp_label' => 'Web問い合わせが主なので、GBPはブランド信頼補完として機能します',
            'action_hints' => '資料請求・無料体験申込への導線強化・講師紹介ページの充実',
        ],

        'retail' => [
            'label'    => '小売・EC',
            'icon'     => '🛒',
            'persona'  => '小売・ECサイト専門のデジタルマーケティングコンサルタント',
            'priorities' => [
                '商品ページの直帰率と滞在時間（購買意欲のシグナル）',
                'カート・購入完了ページへの遷移（コンバージョンファネル）',
                '特売・新着商品ページへのアクセス集中日（販促タイミング）',
                '「〇〇 通販」「〇〇 激安」「送料無料」系キーワード',
                'リピーター率（リテンション・LTV）',
            ],
            'kpi_focus' => ['sessions', 'bounceRate', 'screenPageViews'],
            'gsc_keyword_patterns' => ['通販', '購入', '価格', '安い', '送料', '口コミ', 'レビュー'],
            'gbp_important_metrics' => ['WEBSITE_CLICKS', 'BUSINESS_DIRECTION_REQUESTS'],
            'gbp_label' => '実店舗への来店誘導と、オンライン購買への橋渡しが重要です',
            'action_hints' => '商品ページの改善・カート離脱対策・メルマガ・LINE誘導',
        ],

        'consulting' => [
            'label'    => 'コンサル・BtoB',
            'icon'     => '💼',
            'persona'  => 'BtoBサービス・コンサルティング専門のWebマーケティングアナリスト',
            'priorities' => [
                '事例・実績ページの滞在時間と深い回遊（検討度が高い行動）',
                'ブログ・コラム記事のオーガニック流入（専門性の証明）',
                '指名検索（会社名・サービス名での検索）の増加トレンド',
                'お問い合わせ・資料請求ページへの到達率',
                'リピーター率（既存クライアントのWeb利用）',
            ],
            'kpi_focus' => ['engagedSessions', 'averageSessionDuration', 'newUsers'],
            'gsc_keyword_patterns' => ['コンサル', '支援', '改善', '課題', '事例', '実績', '費用'],
            'gbp_important_metrics' => ['WEBSITE_CLICKS', 'BUSINESS_CONVERSATIONS'],
            'gbp_label' => 'BtoBでは指名検索・口コミがブランド信頼の主要指標です',
            'action_hints' => '事例ページの拡充・ブログSEO強化・問い合わせフォームの最適化',
        ],

        'design' => [
            'label'    => 'デザイン・制作',
            'icon'     => '🎨',
            'persona'  => 'クリエイティブ・デザイン制作会社専門のWebアナリスト',
            'priorities' => [
                'ポートフォリオページの滞在時間（作品への関心度）',
                '指名検索・ブランドキーワードの増加（認知拡大の指標）',
                'お問い合わせページへの到達率と直帰率',
                'ブログ・制作実績のSNS経由流入',
                'SNS・Dribbble・Behanceなどリファラル流入',
            ],
            'kpi_focus' => ['averageSessionDuration', 'engagedSessions', 'newUsers'],
            'gsc_keyword_patterns' => ['デザイン', '制作', 'ホームページ', 'ブランディング', '費用', '依頼'],
            'gbp_important_metrics' => ['WEBSITE_CLICKS'],
            'gbp_label' => 'ポートフォリオへの流入とブランド認知が成長の主指標です',
            'action_hints' => 'ポートフォリオ更新・SNS投稿からのサイト誘導・実績ページSEO',
        ],

        'medical' => [
            'label'    => 'クリニック・サロン',
            'icon'     => '🏥',
            'persona'  => '医療・美容・健康サービス専門のWebマーケティングコンサルタント',
            'priorities' => [
                '診療科・メニュー・症状別ページの直帰率（マッチング精度）',
                'WEB予約・電話予約ページへの誘導率',
                '「〇〇 クリニック 近く」「〇〇 専門医」系キーワード',
                'GBPの電話クリック（直接予約の主要経路）',
                'Googleマップの口コミ数・評価の推移',
            ],
            'kpi_focus' => ['sessions', 'newUsers', 'bounceRate'],
            'gsc_keyword_patterns' => ['クリニック', '治療', '症状', '予約', '口コミ', '専門', '近く'],
            'gbp_important_metrics' => ['CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'BUSINESS_CONVERSATIONS'],
            'gbp_label' => 'Googleマップからの電話予約が来院の最重要導線です',
            'action_hints' => '予約ページの導線強化・症状別LP作成・GBP口コミ返信',
        ],

        'realestate' => [
            'label'    => '不動産・建設',
            'icon'     => '🏠',
            'persona'  => '不動産・住宅・建設業専門のWebマーケティングアナリスト',
            'priorities' => [
                '物件詳細・施工事例ページの滞在時間（真剣な検討者の行動）',
                '「〇〇市 土地」「注文住宅 〇〇」などのエリアキーワード',
                '資料請求・来場予約ページへの遷移（リードの質）',
                '検索からの新規流入（エリアSEOの効果）',
                'GBPの経路案内・モデルルーム来場シグナル',
            ],
            'kpi_focus' => ['newUsers', 'averageSessionDuration', 'engagedSessions'],
            'gsc_keyword_patterns' => ['不動産', '土地', '物件', '注文住宅', 'リフォーム', 'エリア名', '価格'],
            'gbp_important_metrics' => ['BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS', 'CALL_CLICKS'],
            'gbp_label' => 'モデルルーム・現地への経路案内が来場予約の直接指標です',
            'action_hints' => '施工事例の追加・エリア別LP・来場予約フォームの改善',
        ],

        'other' => [
            'label'    => '汎用',
            'icon'     => '🌐',
            'persona'  => 'Webマーケティングアナリスト',
            'priorities' => [
                '訪問者数・セッション・PVの前週比成長',
                '直帰率とエンゲージメント率（コンテンツ品質の指標）',
                '流入チャネルの多様性（特定チャネル依存のリスク）',
                '新規ユーザーとリピーター比率のバランス',
                '最もよく見られているページと改善余地',
            ],
            'kpi_focus' => ['sessions', 'bounceRate', 'engagedSessions'],
            'gsc_keyword_patterns' => [],
            'gbp_important_metrics' => ['WEBSITE_CLICKS', 'CALL_CLICKS'],
            'gbp_label' => 'オンラインとオフラインの接点を把握することが重要です',
            'action_hints' => 'コンテンツ改善・導線最適化・チャネル多様化',
        ],
    ];

    public static function get(string $type): array
    {
        return self::CONFIGS[$type] ?? self::CONFIGS['other'];
    }

    public static function allTypes(): array
    {
        return array_map(fn($k, $v) => ['type' => $k, 'label' => $v['label'], 'icon' => $v['icon']],
            array_keys(self::CONFIGS), self::CONFIGS);
    }
}
