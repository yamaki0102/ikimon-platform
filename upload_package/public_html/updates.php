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

            <div class="space-y-8">

                <!-- v0.6.1 -->
                <article class="relative pl-8 border-l-2 border-emerald-500/30">
                    <div class="absolute left-0 top-0 w-4 h-4 -translate-x-[9px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                    <div class="flex items-center gap-3 mb-3">
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">v0.6.1</span>
                        <time class="text-sm text-gray-500">2026年3月30日</time>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">NEW</span>
                    </div>
                    <h2 class="text-xl font-bold mb-3 text-gray-900">メニューをすっきり整理しました</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ナビゲーションを簡素化</strong>: よく使う場所に素早くたどり着けるよう、メニュー構成を整理しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>マイページへのアクセスを改善</strong>: 自分のプロフィールや記録への導線を分かりやすくしました</span>
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
                    <h2 class="text-xl font-bold mb-3 text-gray-900">セキュリティ & 安定性強化</h2>
                    <ul class="space-y-2 text-gray-600 text-sm">
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>セキュリティ強化</strong>: 通信の安全性とログイン周りを改善しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>アクセシビリティ向上</strong>: スクリーンリーダー対応やキーボード操作を改善しました</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-emerald-400 shrink-0">✓</span>
                            <span><strong>ゲーミフィケーション & パーソナライゼーション</strong>: 体験の没入感と継続性を強化しました</span>
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
            <div class="mt-16 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
                <h3 class="text-lg font-bold mb-2">最新情報をお届けします</h3>
                <p class="text-sm text-gray-500 mb-4">新機能の追加時にメールでお知らせします</p>
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

</body>
</html>
