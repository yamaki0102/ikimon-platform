<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>アップデート履歴 | ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>

<body class="js-loading pt-14 bg-base text-text font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-12">ikimonの最新の改善と機能追加をお知らせします</p>

            <!-- Updates Timeline -->
            <div class="space-y-8">

                <!-- v0.5.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.0</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セマンティック検索と写真検索</h2>
                    <p class="text-gray-500 text-sm mb-4">生き物の探し方が広がりました。種名がわからなくても、写真や自然な文章から似た記録を見つけられるようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>写真で探す</strong>: カメラで撮った写真やギャラリーから、見た目が似ている生き物の記録を検索。「みつける」ページの検索バー横のカメラアイコンから利用できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セマンティック検索</strong>: 「春の森の蝶」「夜に鳴く虫」のような自然な文章で検索できるように。種名がわからなくても、特徴や状況の説明から関連する記録を探せます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>似ている観察</strong>: 各観察記録の詳細ページに「似ている観察」セクションを追加。種名・分類・環境・季節・写真の特徴を総合的に分析し、関連する記録を自動表示します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>高精度ベクトル検索</strong>: 全観察データを3072次元のマルチモーダルベクトルで再構築。テキストと画像を同じ空間で扱うクロスモーダル検索に対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>非同期ジョブシステム</strong>: AI査定・ベクトル生成・データ再計算を並列処理する基盤を導入。投稿後のレスポンス速度が向上しました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>FAQ更新</strong>: 「検索・発見」カテゴリを追加。写真検索の仕組み・プライバシー保護・類似度の読み方など6問を収録</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ修正</strong>: XSS対策の強化、キュー処理の排他制御追加、エラーハンドリング改善</span></li>
                    </ul>
                </article>

                <!-- v0.4.5 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.5</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">プラットフォーム仕上げ</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>PWA刷新</strong>: アプリアイコン・マニフェストを更新。ホーム画面からの起動体験を改善</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ビジネスページ改善</strong>: 企業向けランディングページとサイトメッセージングを刷新</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>管理ダッシュボード</strong>: 管理者向け分析・レポートフローを整備</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>探索体験の改善</strong>: アプリ全体の発見フロー・ディスカバリー体験を強化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ウェルネス・ハビットループ</strong>: 自然観察を日常の習慣にするためのガイダンス機能</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ストリーク活動サマリー</strong>: 継続的な観察活動を可視化</span></li>
                    </ul>
                </article>

                <!-- v0.4.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.0</span>
                        <time class="text-sm text-gray-500">2026年3月6日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ゲーミフィケーション & ホームリデザイン</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ゲーミフィケーション & パーソナライゼーション</strong>: バッジ・ランク・デイリークエスト・ストリーク表示でモチベーションを継続</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザー分析ダッシュボード</strong>: 自分の活動データを振り返れるマイページを追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ホームページ全面リデザイン</strong>: マイルストーン型の種表示、ヒーローセクション刷新</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Omoikaneプロジェクト</strong>: 文献ベースの信頼スコア・スマート検索・AI相互検証機能</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>参考インデックスへのリブランド</strong>: BISスコアをより正確な「モニタリング参考インデックス」に改称</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>CSP nonce・CDNバージョン固定</strong>: Lucide 0.477.0、Alpine.js 3.14.9</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>SEO準備</strong>: robots.txt、sitemap.xml、GA4タグ整備</span></li>
                    </ul>
                </article>

                <!-- v0.3.5 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.5</span>
                        <time class="text-sm text-gray-500">2026年3月5日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定ワークベンチ & セキュリティ</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定ワークベンチ UX全面改善</strong>: 初見ユーザー向けオンボーディング、プリセットフィルター、モバイル対応を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>API品質修正</strong>: JSONフラグ混入バグ13件を一括修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ</strong>: target=_blank rel属性追加、開発用ファイル本番排除、JSON I/OにLOCK_EX付与、PHP9互換対応</span></li>
                    </ul>
                </article>

                <!-- v0.3.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.0</span>
                        <time class="text-sm text-gray-500">2026年3月4日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">大規模品質改善</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ダッシュボード刷新</strong>: HUD UIから標準デザインへ全面リニューアル。ランクカード、デイリークエスト、カテゴリ探索を搭載</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>UI全面改善</strong>: 英語テキスト日本語化、ランキング廃止、フッター追加、CSS変数化、全ページの視覚バランス統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ナビゲーション改善</strong>: Quick Navアイコン差別化、モバイルボトムナビ操作性向上（56px化）</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ヘッダーオーバーラップ修正</strong>: 全ページでコンテンツがヘッダーに隠れる問題を解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>アクセシビリティ強化</strong>: テキストコントラスト全修正、mainタグ追加、sr-only見出し、ボタンスタイル統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>観察詳細ページ改善</strong>: 同定後の反映バグ修正、画像クリックナビゲーション、TrustLevel致命的バグ修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>位置情報修正</strong>: 「読み込み中」「場所不明」で止まる問題を全ページで修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>探索フィルター修正</strong>: カテゴリフィルター（鳥類・昆虫・植物等）が正しく動作するよう修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Aboutページ刷新</strong>: チームセクション→創業者セクションに変更</span></li>
                    </ul>
                </article>

                <!-- v0.2.5 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.5</span>
                        <time class="text-sm text-gray-500">2026年2月27日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セキュリティ強化 & AI複数画像対応</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ強化</strong>: Cookie Secure属性、HTTPS強制、HSTS 1年、Mixed Content防止</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>AI推定の複数画像対応</strong>: 最大3枚の写真を同時にAIに送信して精度を向上</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Android写真保存ボタン</strong>: Android端末での写真ダウンロードに対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>APIキー保護</strong>: URLパラメータからHTTPヘッダーに移行し、ログ漏洩を防止</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>B2Bデザイン統一</strong>: ランディングページのバナーをダークテーマに統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>レッドリスト判定精緻化</strong>: LC/DD（低懸念/情報不足）を除外し、CR/EN/VU/NTのみを真の絶滅危惧種としてカウント</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザーデータ保護</strong>: import_sourceマーカー導入、data/ディレクトリをデプロイ対象から除外</span></li>
                    </ul>
                </article>

                <!-- v0.2.1 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.1</span>
                        <time class="text-sm text-gray-500">2026年2月21日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">100年アーカイブ & 図鑑エンジン</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>100年アーカイブ戦略</strong>: Darwin Core準拠のメタデータ、分類タイムライン、歴史的学名の表示に対応</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>図鑑デジタル化エンジン</strong>: 書籍からの情報抽出パイプライン構築、SQLite統合による高速検索</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>Omoikane AI文献検索</strong>: 875本の学術論文を統合した知識ベースとUIを搭載。自動修復キューシステム付き</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ナビゲーション全面改修</strong>: モバイルメニュードロワー、レスポンシブ対応の強化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>DwC-Aエクスポート拡張</strong>: 歴史的分類フィールド（originalNameUsage等）を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>サイトダッシュボード日本語化</strong>: ラベル・説明文の完全ローカライズ</span></li>
                    </ul>
                </article>

                <!-- v0.2.0 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2025年1月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">新年アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>PWA対応</strong>: ホーム画面に追加できるようになりました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>TNFD対応レポート</strong>: 企業向けの自然関連情報開示に使える参考レポートを自動生成</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ強化</strong>: セッション管理、レート制限を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>プライバシー保護</strong>: 写真のEXIF位置情報を自動削除、希少種の位置マスキング</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ペルソナ別ページ</strong>: 市民/企業/研究者それぞれに向けたランディングページを新設</span></li>
                    </ul>
                </article>

                <!-- v0.1.5 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.5</span>
                        <time class="text-sm text-gray-500">2024年12月15日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>企業ダッシュボード</strong>: サイト別の生物多様性可視化</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>参考インデックス</strong>: 観測の厚みと保全シグナルの自動要約</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span></li>
                    </ul>
                </article>

                <!-- v0.1.0 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2024年11月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ベータ版</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>観察投稿機能</strong>: 写真から生き物を記録</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>コミュニティ同定</strong>: みんなで種名を提案・合意する仕組み</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>地図探索</strong>: 周辺の生き物を地図で確認</span></li>
                        <li class="flex items-start gap-2"><span class="text-purple-400 shrink-0">✓</span><span><strong>ゲーミフィケーション</strong>: バッジとランク機能</span></li>
                    </ul>
                </article>

            </div>

            <!-- Newsletter signup -->
            <div class="mt-16 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能リリース時にメールでお知らせします</p>
                <div class="flex gap-2 max-w-md mx-auto">
                    <input type="email" placeholder="メールアドレス"
                        class="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]">
                    <button class="btn-primary whitespace-nowrap">登録</button>
                </div>
            </div>

        </div>
    </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
