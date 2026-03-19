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
        <div class="max-w-3xl mx-auto" x-data="{ filter: 'all' }">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-6">ikimonの最新の改善と機能追加をお知らせします</p>

            <!-- Filter Tabs -->
            <div class="flex gap-2 mb-10 flex-wrap">
                <button @click="filter = 'all'"
                    :class="filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition">すべて</button>
                <button @click="filter = 'feature'"
                    :class="filter === 'feature' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> 新機能
                </button>
                <button @click="filter = 'fix'"
                    :class="filter === 'fix' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="wrench" class="w-3.5 h-3.5"></i> バグ修正・改善
                </button>
                <button @click="filter = 'security'"
                    :class="filter === 'security' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'"
                    class="px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-1.5">
                    <i data-lucide="shield" class="w-3.5 h-3.5"></i> セキュリティ
                </button>
            </div>

            <!-- Updates Timeline -->
            <div class="space-y-8">

                <!-- v0.6.1 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-amber-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">v0.6.1</span>
                        <time class="text-sm text-gray-500">2026年3月20日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">タッチ操作・ナビゲーション改善</h2>
                    <p class="text-gray-500 text-sm mb-4">モバイルでのボタン操作やフッターの反応に関する問題を修正しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>ボトムナビ「マイページ」ボタン修正</strong>: タップしても反応しなかった問題を修正。Alpine.jsスコープの設定漏れが原因でした</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>フッターリンクのタッチ領域拡大</strong>: 全フッターリンクのタップ領域を44px（推奨最小値）に拡大。押しにくかった問題を解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>閉じるボタンの操作性向上</strong>: PWAバナー、検索クリア、写真削除、各モーダルの閉じるボタンを44px以上に統一</span></li>
                        <li class="flex items-start gap-2"><span class="text-amber-400 shrink-0">✓</span><span><strong>アクセシビリティ向上</strong>: アイコンのみのボタンにaria-labelを追加。スクリーンリーダーでも操作内容が分かるように</span></li>
                    </ul>
                </article>

                <!-- v0.6.0 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.6.0</span>
                        <time class="text-sm text-gray-500">2026年3月20日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">Growth Learning Loop — 学びのループが回り始める</h2>
                    <p class="text-gray-500 text-sm mb-4">投稿→考察→成長実感→また投稿したくなる。ikimonの核心である「学習ループ」を強化する大型アップデートです。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>AI考察ティーザー</strong>: 投稿完了画面で「考察ミル」の第一印象をすぐに表示。投稿→考察の間の壁をなくしました</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>QRコード招待</strong>: プロフィールからQRコードを表示して、フィールドで出会った人にパッと招待できます。全画面表示モード付き</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>招待ランディングページ</strong>: 招待された人に考察ミルの価値を実際の観察例で見せる専用ページ。OGP対応でLINE/Twitterでもリッチに展開されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>学習ヒントカード</strong>: ホームフィードに「次にここを見ると深く分かるよ」カードを表示。前回の考察から次の観察への橋渡し</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>成長ログ</strong>: 分類精度・観察ポイント・分類群カバーの3指標で観察力の変化を可視化。「前より見えるようになった自分」が分かります</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>初回/最新観察の比較</strong>: プロフィールに最初の観察と最新の観察を並べて表示。見比べるだけで成長が実感できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>デイリークエストUI</strong>: プロフィールに今日の目標3つを表示。達成するとスコアとバッジが獲得できます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>考察ミルの質向上</strong>: 「次に出会った時にこう撮ると絞れる」という具体的な1アクションを提案。撮り直し要求ではなく、次の出会いに備える設計に</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>パーソナライズ考察</strong>: 過去の観察履歴を踏まえて、観察者のレベルに合わせた考察を生成するように</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>KPI計測基盤</strong>: AI考察展開率・招待経由登録数・学習ヒントクリック数など16種のイベントを新規追加</span></li>
                    </ul>
                </article>

                <!-- v0.5.3 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500 ring-4 ring-green-100"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.3</span>
                        <time class="text-sm text-gray-500">2026年3月19日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定フォーム修正</h2>
                    <p class="text-gray-500 text-sm mb-4">種名検索・同定送信が正常に動作するようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定フォーム送信修正</strong>: 種名検索結果のフィールド名ミスマッチにより同定が送信できないバグを修正。目・科レベルの同定も正常に動作します</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定センター修正</strong>: クイック同定パネルにも同様の修正を適用</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>APIエラーハンドリング強化</strong>: PHPエラーをJSON形式で返すように改善し、無応答500エラーを解消</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>コウモリ目カタカナ表記</strong>: ローカルリゾルバーに追加し、検索で「翼手目」ではなく「コウモリ目」が優先表示されるように</span></li>
                    </ul>
                </article>

                <!-- v0.5.2 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.2</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AI考察の専門用語かんたん解説</h2>
                    <p class="text-gray-500 text-sm mb-4">観察のヒントに出てくる専門用語に、小中学生でもわかるやさしい解説がつくようになりました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>用語ツールチップ</strong>: AI考察内の専門用語（形質・花序・同定など）にカーソルを合わせるかタップすると、やさしい日本語で解説が表示されます</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>150語以上の用語辞書</strong>: 分類階級・形態（翅・嘴・触角）・植物（花序・鋸歯・葉序）・生態（在来種・擬態・食物連鎖）など幅広くカバー</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>スマート検出</strong>: 「シジュウカラ科」の「科」など、生物名の一部として使われている場合は解説を出さない賢い判定</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>モバイル対応</strong>: スマートフォンでもタップで解説を表示。他の場所をタップすれば閉じます</span></li>
                    </ul>
                </article>

                <!-- v0.5.1 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.1</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ナビゲーション刷新 & 統合マイページ</h2>
                    <p class="text-gray-500 text-sm mb-4">ユーザーメニューを大幅に整理し、マイページに全ての個人情報を集約しました。</p>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>ユーザーメニュー刷新</strong>: 13項目あったドロップダウンを3項目（マイページ・ダッシュボード・ログアウト）に集約。迷わないナビゲーションに</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>統合マイページ</strong>: 「発見」「ウェルネス」タブを新設。デジタル標本箱とネイチャーウェルネスをマイページ内で直接閲覧可能に</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>モバイルメニュー統一</strong>: デスクトップ・モバイル共にパーソナル情報はマイページに集約。サイト情報系はフッターに移動</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>専門家向けページ刷新</strong>: 研究者・調査員・同定者の3つの役割を1ページに統合。調査プロジェクトへの導線を明確化</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>フッター整理</strong>: 料金プランを追加、重複リンク（チーム）を削除</span></li>
                    </ul>
                </article>

                <!-- v0.5.0 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.5.0</span>
                        <time class="text-sm text-gray-500">2026年3月17日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
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

                <!-- v0.4.5 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.5</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
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

                <!-- v0.4.0 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.4.0</span>
                        <time class="text-sm text-gray-500">2026年3月6日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
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

                <!-- v0.3.5 — FIX + SECURITY -->
                <article x-show="filter === 'all' || filter === 'fix' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.5</span>
                        <time class="text-sm text-gray-500">2026年3月5日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定ワークベンチ & セキュリティ</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>同定ワークベンチ UX全面改善</strong>: 初見ユーザー向けオンボーディング、プリセットフィルター、モバイル対応を追加</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>API品質修正</strong>: JSONフラグ混入バグ13件を一括修正</span></li>
                        <li class="flex items-start gap-2"><span class="text-green-400 shrink-0">✓</span><span><strong>セキュリティ</strong>: target=_blank rel属性追加、開発用ファイル本番排除、JSON I/OにLOCK_EX付与、PHP9互換対応</span></li>
                    </ul>
                </article>

                <!-- v0.3.0 — FIX -->
                <article x-show="filter === 'all' || filter === 'fix'" x-transition class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.3.0</span>
                        <time class="text-sm text-gray-500">2026年3月4日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">FIX</span>
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

                <!-- v0.2.5 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.5</span>
                        <time class="text-sm text-gray-500">2026年2月27日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
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

                <!-- v0.2.1 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.1</span>
                        <time class="text-sm text-gray-500">2026年2月21日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
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

                <!-- v0.2.0 — NEW + SECURITY -->
                <article x-show="filter === 'all' || filter === 'feature' || filter === 'security'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2026年1月1日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">SECURITY</span>
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

                <!-- v0.1.5 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.5</span>
                        <time class="text-sm text-gray-500">2025年12月15日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>企業ダッシュボード</strong>: サイト別の生物多様性可視化</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>参考インデックス</strong>: 観測の厚みと保全シグナルの自動要約</span></li>
                        <li class="flex items-start gap-2"><span class="text-blue-400 shrink-0">✓</span><span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span></li>
                    </ul>
                </article>

                <!-- v0.1.0 — NEW -->
                <article x-show="filter === 'all' || filter === 'feature'" x-transition class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 flex-wrap mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2025年11月1日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
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
