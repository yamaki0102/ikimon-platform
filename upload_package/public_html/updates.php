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

<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>
    <section class="pt-32 pb-16 px-6">
        <div class="max-w-3xl mx-auto">
            <h1 class="text-3xl font-black mb-4">アップデート履歴</h1>
            <p class="text-gray-500 mb-12">ikimonの最新の改善と機能追加をお知らせします</p>

            <div class="space-y-8">

                <!-- v0.9.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.9.0</span>
                        <time class="text-sm text-gray-500">2026年3月31日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">いきものセンサー — 散歩しながらAIが語りかける</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>いきものセンサー</strong>: 散歩・自転車・ドライブ中にAIが音声でリアルタイムガイド。近くで検出した生き物の生態・保全の話を自動で語りかけます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>散歩レポート</strong>: セッション終了後に「今日の自然浴スコア」「検出した種のサマリー」「移動ルート」を一画面で振り返れるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>観察詳細にAI豆知識が自動表示</strong>: 生態・生物多様性・保全に関する豆知識をRAGで生成し、観察詳細ページに常時表示するようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>観察に写真を後から追加</strong>: 投稿済みの観察に、追加で写真をアップロードできるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Sutherland PNAS 2026 学術裏付けを統合</strong>: 最新の市民科学エビデンスをikimonのアプローチページ・観察詳細・100年アーカイブページに反映しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>セキュリティ・パフォーマンス・SEO 全体強化</strong>: 通信の安全性強化・ページ読み込み速度の改善・検索エンジン向け構造化データ(JSON-LD)の充実化を行いました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.8.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.8.1</span>
                        <time class="text-sm text-gray-500">2026年3月下旬</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">サウンドアーカイブ — 聞いた鳴き声をみんなで同定</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>サウンドアーカイブを公開</strong>: 野外で録音した鳴き声を投稿し、コミュニティが種を同定する新しいプラットフォームです。写真がなくても記録を残せます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ウォークモードの音声が図鑑と連携</strong>: 散歩中に録音・検出された鳴き声が、マイ図鑑の種ページから再生できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>トップページにサウンドアーカイブへの導線を追加</strong>: 未同定の鳴き声が届いていることをホームから確認できます</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.8.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.8.0</span>
                        <time class="text-sm text-gray-500">2026年3月中旬</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">Androidアプリ(ikimon Pocket) + 世界11,560種の音声AI同定</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ikimon Pocket Android版を公開</strong>: APKをダウンロードしてインストールできます。カメラ検出・音声同定・ウォークモードをネイティブアプリとして利用可能になりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>BirdNET V3.0 音声AI: 世界11,560種に対応</strong>: 鳥の鳴き声を端末内で即座に同定します。Pixel端末ではTensor G5 NPUを使ったハードウェア加速で高速処理できます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Triple AI Engine</strong>: BirdNET V3（音声）+ Gemini Nano（映像）+ 環境センサーの3エンジンを並列で動かし、検出精度を大幅に向上しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>リアルタイム検出フィード</strong>: アプリ内でスキャン中に検出された種が分類階層バッジ付きでリアルタイム表示されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>音声ガイド話者を追加 — ずんだもん・もち子さん・青山龍星</strong>: VOICEVOX対応の3話者から選べます。Bluetooth出力にも対応し、スピーカーやイヤホンで自然の中を歩きながら聴けます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ガイド雰囲気を選択</strong>: 「自然探索」「歴史文化」「おまかせ」から選べるようになりました。移動速度に応じてガイドのペーシングも自動調整されます</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.7.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.1</span>
                        <time class="text-sm text-gray-500">2026年3月中旬</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AI文脈解析 + 環境データを100年耐久で保存</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ライブスキャンのAI解析に文脈を注入</strong>: 環境情報（気温・湿度・バイオーム・地面の状態）と過去の検出履歴をAI解析時に参照し、より精度の高い考察を生成できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>環境観測データを完全保存</strong>: スキャン中の環境データを100年後も解析できる構造で永続保存します。将来のデジタルツイン・気候変動研究への提供を見越した設計です</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>キーフレーム選択的保存</strong>: スキャン中の全フレームは保存せず、「新種発見」「高信頼度検出」のフレームのみ自動選別して保存します。ストレージを節約しながら重要な瞬間を記録します</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>GeoContext 環境文脈エンジン</strong>: 撮影地点の地形・植生・気候帯から生物分布の可能性を推定し、AI考察の補助証拠として活用するエンジンを導入しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.7.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.7.0</span>
                        <time class="text-sm text-gray-500">2026年3月上旬</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ライブスキャン・ウォーク・ライブマップ・マイ図鑑・クエスト</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ライブスキャン</strong>: スマホカメラで映すだけでAIがリアルタイムに生き物を検出します。写真を撮って投稿しなくても、見た生き物を記録できます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ウォークモード</strong>: 散歩中のルートをGPSで記録しながら、マイクが鳥の鳴き声を自動検出します。リアルタイムマップに鳥の検出ポイントが表示されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ライブマップ（ログイン不要）</strong>: アカウント不要でikimonに集まっている観察データを地図で見られます。地域ごとの生物多様性の「今」をリアルタイムで確認できます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>マイ図鑑リニューアル</strong>: 自分が観察・スキャン・音声検出で関わった種だけを集めた個人コレクションになりました。スキャンで撮れたフレーム画像も表示されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>写真ギャラリー + ピンチズーム + スワイプ</strong>: 観察詳細ページで写真を全画面表示できるようになりました。複数枚の写真をスワイプで切り替え、ピンチで拡大できます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>クエスト専用ページ</strong>: 「どんな生き物を次に見るか」を動機付けるクエストシステムを大幅に再設計しました。ライブスキャンの検出結果からクエストが自動生成されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>複数リアクション</strong>: 観察に「👣足あと」「❤️いいね」「✨すてき」「🔬学び」の4種類のリアクションを付けられるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>和名優先表示</strong>: AI・GBIF・BirdNETからの学名・英名を自動で日本語の和名に変換して表示するようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>メソドロジーページを公開</strong>: ikimonのBIS（生物多様性影響スコア）の計算根拠とデータ方針を透明性のあるページで説明しています</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.6.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.6.1</span>
                        <time class="text-sm text-gray-500">2026年3月30日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ナビゲーション整理 + AI考察「そうかも！」ワンタップ同定</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>AI考察から「そうかも！」でワンタップ同定</strong>: 観察詳細ページのAI考察に「そうかも！」ボタンを追加。AIの提案をそのまま自分の同定票として送れるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>AIパーソナライズ種解説</strong>: マイ図鑑の種ページで、自分の出会いコンテキスト（場所・季節・出会い方）に基づいたAI解説が自動生成されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ナビゲーションを簡素化</strong>: よく使う場所に素早くたどり着けるよう、メニュー構成を整理。調査員向け機能を非公開にし、フォロー中タブを削除してシンプルにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>複数アカウントの重複防止</strong>: Google・X など複数のOAuth手段でログインしても同一ユーザーとして統合されるようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.6.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.6.0</span>
                        <time class="text-sm text-gray-500">2026年3月14日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">法人向け導線と図鑑をまとめて強化しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>法人プランごとの見え方を整理</strong>: 記録ボードやレポートで、契約プランに応じて表示内容を切り替えるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>図鑑と観察に関連書籍の導線を追加</strong>: 種や文脈に応じた関連書籍を表示し、より深く調べたい人が次の行動へ進みやすくしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>スマホでのホーム画面登録を更新</strong>: アプリアイコンとトップページまわりを見直し、使い始めや再訪がしやすくなりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.9 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.9</span>
                        <time class="text-sm text-gray-500">2026年3月12日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">組織利用の申込み後をスムーズに</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>申込み後すぐ使い始めやすく</strong>: 申込み後にそのままワークスペースへ入れる導線を追加し、運用開始までの流れを明確にしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>招待リンク方式へ変更</strong>: 管理メンバーを招待リンクで受け入れられるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>運営側の受付管理も強化</strong>: 契約団体の作成から招待リンク発行まで、一画面で進めやすくしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.8 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.8</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AIの候補を、次の同定につなげやすくなりました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>見分け候補をそのまま辿れるように</strong>: 観察詳細で候補名をタップすると、近い記録を探せるリンクに変えました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定ワークベンチにフィルタを追加</strong>: AIが複数の可能性を示している観察だけを絞り込んで確認できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>料金表を使い方ベースに整理</strong>: プランごとの説明を「どう使うか」で読める形に整え、Cookie通知もコンパクトにしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.7 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.7</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">投稿後のAIメモに一本化しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿前のAI機能を整理</strong>: 投稿後に自動でAIメモが付く仕組みに一本化し、流れをシンプルにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿画面の案内を更新</strong>: 「まず投稿して、あとから観察のヒントを見る」流れが分かるよう案内を整理しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.5 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.5</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">各所の言葉づかいとナビゲーションを整理しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ナビゲーションとフッターを整理</strong>: 組織利用やデータ持ち帰りにも開いた入口へ調整しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Aboutページの説明を調整</strong>: 認定・評価を前面に出すのではなく、自然の記録を残す土台として読みやすい内容へ整えました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>利用規約とプライバシー説明のトーンも整理</strong>: 機能名や免責表現を現状に合わせて更新しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.3 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.3</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">料金体系を3プランに整理しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>自治体にも入りやすい入口価格へ</strong>: 月額 39,800円のスタンダードプランを設定し、1サイト・5席の標準導入として公開しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>3プランに簡素化</strong>: 個別見積り前提をやめ、公開価格から選べる3段構成にまとめました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>追加オプションを明示</strong>: 追加サイト・席・AI解析・優先サポートを別立てにし、大規模運用へ伸ばしやすくしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.2 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.2</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">同定ステータスをわかりやすく2段階化しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>属・科レベルの同定も研究利用可に</strong>: 種まで特定できなくても、コミュニティ合意が安定している記録は研究・モニタリング用途で活用できるようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>精度と信頼を分けて表示</strong>: 「種まで確定した記録」と「属・科レベルで安定した記録」を別ステータスで区別して見られるようにしました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.1</span>
                        <time class="text-sm text-gray-500">2026年3月11日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AIメモをさらに読みやすく改善しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>観察者寄りの表示に整理</strong>: 「結論 → 手がかり → 次に探すとよいもの」の順で読みやすく再構成しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>候補が複数ある場合の表示を改善</strong>: 共通して言える安全な分類群と、最も有力な候補を分けて示すようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.5.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.5.0</span>
                        <time class="text-sm text-gray-500">2026年3月10日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">施設由来の記録対応 & AIメモの自動生成</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>植物園・動物園などの記録に正式対応</strong>: 施設で見た生き物を「施設由来」として投稿・管理できるようになりました。野生記録とは分けて扱われます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿後にAIメモが自動生成</strong>: 観察を投稿すると、写真・位置情報・季節をもとにAIが考察を自動生成し、観察詳細ページに公開表示されます。同定の票としてではなく「参考メモ」として機能します</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>場所・季節も考慮したAI考察</strong>: 形態だけでなく、撮影地の都道府県・季節も補助証拠として参照。「場所から見るヒント」「季節から見るヒント」が反映されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>複数枚写真の一括評価</strong>: 投稿された複数の写真をまとめて評価し、1枚だけでは分かりにくい特徴も補完できるようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.4.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.4.0</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">みんなの同定をより賢く集計できるようになりました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>属・種レベルが混在しても集計できるように</strong>: 「属レベルの同定」と「種レベルの同定」が共存していても、共通する分類群を自動で導き出してコミュニティ合意を決めるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>矛盾した同定を自動検知</strong>: 同じ観察に対して「アブラゼミ」と「ミンミンゼミ」など系統的に矛盾する同定が混在する場合、ステータス確定を自動で保留するようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>分類体系のバージョン管理に対応</strong>: 将来の名前変更にも対応できる堅牢なデータ構造に移行しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>既存データを一括移行</strong>: 過去の全観察データの同定を新しい仕組みに移行し、合意を再計算しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.4 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.4</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">個体数・環境情報の記録に対応しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>個体数の記録に対応</strong>: 投稿画面で周辺の個体数（1匹、2〜5匹、など）を選択できるようになりました。正確でなくてOK — 長期的な個体数変動の追跡に活用されます</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定の根拠を記録できるように</strong>: 名前を入力した際に「体色・模様」「全体的な形」「行動・鳴き声」などの根拠を選択できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>環境バイオームと地面の状態を記録</strong>: 森林・草地・湿地・海岸・都市・農地などの環境分類と、岩場・砂地・落ち葉など地面の状態を記録できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>個体数バッジの表示</strong>: ホーム・探索・観察詳細の各画面に個体数バッジを追加し、記録の情報量が一目で分かるようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.3 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.3</span>
                        <time class="text-sm text-gray-500">2026年3月9日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ログイン復旧 & 表示バグ修正</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ソーシャルログイン復旧</strong>: Google / Xでのログインボタンが一時的に表示されない問題を修正しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>投稿の表示順を改善</strong>: 過去の日付の写真を投稿した際にフィードに表示されない問題を修正しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>同定カウントの反映を修正</strong>: 同定を追加した際にトップページのカウントに正しく反映されるようになりました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.2 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.2</span>
                        <time class="text-sm text-gray-500">2026年3月8日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">ネイチャーポジティブガイドを公開しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ネイチャーポジティブ完全ガイド公開</strong>: お散歩×生きもの観察×脳活性化の三位一体を科学的エビデンスとともに解説するページを新設</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>トップページ・フッターに導線を追加</strong>: ネイチャーポジティブガイドへのリンクを各所に追加しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.1</span>
                        <time class="text-sm text-gray-500">2026年3月8日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">AI同定 & 環境自動推定</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>「AIにきいてみる」機能を追加</strong>: 写真から生き物の分類をAIが推定。種の断定はせず、参考情報として提案します</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>環境情報の自動入力</strong>: 写真の背景からバイオーム・野生/植栽・ライフステージをAIが推定し、ワンタップでフォームに反映</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>AIモデルをアップグレード</strong>: 応答速度と精度を改善しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.3.0 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.3.0</span>
                        <time class="text-sm text-gray-500">2026年3月7日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">達成感の見せ方と地図表示を改善しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>地域達成度メーターを刷新</strong>: 遠い目標値を一気に示すのをやめ、次の目標が常に手の届く距離に見えるマイルストーン制に変更しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ヒートマップのバグ修正</strong>: 観察データがない地点に色が広がるバグを修正しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>テストデータの除去</strong>: 実データのみの表示に整理しました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.2.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.2.1</span>
                        <time class="text-sm text-gray-500">2026年3月6日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">地域達成度マイルストーン + バッジ・スコア強化</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>バッジ・スコアシステムを本格稼働</strong>: 記録数・同定貢献・連続投稿などに応じてバッジを取得できます。プロフィールページで自分の活動履歴を確認できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>Googleログイン・Xログインに対応</strong>: ソーシャルログインでかんたんにアカウントを作れるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>セキュリティ全体強化</strong>: XSS・CSRF対策の徹底、EXIF情報の自動削除、レートリミット設定など基盤の安全性を高めました</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.2.0 -->
                <article class="relative pl-8 border-l-2 border-green-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-green-500"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">v0.2.0</span>
                        <time class="text-sm text-gray-500">2026年3月4日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">大規模品質改善アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ダッシュボード刷新</strong>: ランクカード、デイリークエスト、カテゴリ探索を搭載した新デザインに全面リニューアル</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ナビゲーション改善</strong>: アイコンの差別化とモバイルボトムナビの操作性向上</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ヘッダーオーバーラップ修正</strong>: 全ページでコンテンツがヘッダーに隠れる問題を解消</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>探索フィルター修正</strong>: カテゴリフィルター（鳥類・昆虫・植物等）が正しく動作するよう修正</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.2 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.2</span>
                        <time class="text-sm text-gray-500">2026年1月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">新年アップデート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>PWA対応</strong>: ホーム画面に追加できるようになりました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>企業向けレポート</strong>: 生物多様性レポートの自動生成に対応</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>プライバシー保護</strong>: 写真のEXIF位置情報を自動削除するようにしました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-green-400 shrink-0">✓</span>
                            <span><strong>ペルソナ別ページ</strong>: 市民・企業・研究者向けのランディングページを追加</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.1 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.1</span>
                        <time class="text-sm text-gray-500">2025年12月15日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">企業向け機能追加</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>企業ダッシュボード</strong>: サイト別の生物多様性を可視化</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>参考インデックス</strong>: 観測の厚みと保全シグナルを自動要約</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-blue-400 shrink-0">✓</span>
                            <span><strong>地図埋め込み</strong>: 自社サイトに地図を埋め込み可能に</span>
                        </li>
                    </ul>
                </article>

                <!-- v0.1.0 -->
                <article class="relative pl-8 border-l-2 border-gray-200">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-gray-600"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">v0.1.0</span>
                        <time class="text-sm text-gray-500">2025年11月1日</time>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">プロトタイプ版スタート</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>観察投稿機能</strong>: 写真から生き物を記録</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>コミュニティ同定</strong>: みんなで種の名前を提案・確定</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>地図探索</strong>: 周辺の生き物を地図で確認</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-purple-400 shrink-0">✓</span>
                            <span><strong>バッジとランク</strong>: 記録が増えるほど育つゲーミフィケーション</span>
                        </li>
                    </ul>
                </article>

            </div>

            <!-- Newsletter signup -->
            <div class="mt-16 text-center" style="padding:2rem;border-radius:var(--shape-xl);background:var(--md-surface-container);border:1px solid var(--md-outline-variant);box-shadow:var(--elev-1);">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能の追加時にメールでお知らせします</p>
                <div class="flex gap-2 max-w-md mx-auto">
                    <input type="email" placeholder="メールアドレス"
                        class="flex-1 px-4 py-3 rounded-xl focus:outline-none" style="background:var(--md-surface-container-low);border:1px solid var(--md-outline-variant);color:var(--md-on-surface);">
                    <button class="btn-primary whitespace-nowrap">登録</button>
                </div>
            </div>

        </div>
    </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

</body>
</html>
