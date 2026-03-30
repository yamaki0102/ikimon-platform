<?php
/**
 * methodology.php — BIS スコア透明性 & データ方針ページ
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
Auth::init();

$meta_title = "メソドロジー — データ方針と評価手法の透明性";
$meta_description = "ikimon のモニタリング参考インデックス（MRI）の計算手法、5軸評価モデル、データ取り扱い方針を公開しています。";
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        .axis-card { transition: transform 0.2s, box-shadow 0.2s; }
        .axis-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .weight-bar { height: 6px; border-radius: 9999px; transition: width 0.6s ease; }
        .scroll-target { scroll-margin-top: 80px; }
    </style>
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-4xl mx-auto px-6 py-20 pb-32">

    <!-- Hero -->
    <header class="mb-20 text-center">
        <span class="inline-block px-4 py-1.5 rounded-full bg-surface border border-border text-[var(--color-primary)] text-xs font-bold uppercase tracking-widest mb-6">
            Methodology &amp; Transparency
        </span>
        <h1 class="text-3xl md:text-5xl font-black mb-6 leading-tight">
            データ方針と評価手法
        </h1>
        <p class="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            ikimon が収集するデータの取り扱い方針と、<br class="hidden md:block">
            生物多様性を評価する「モニタリング参考インデックス」の仕組みを公開します。
        </p>
    </header>

    <!-- TOC -->
    <nav class="mb-16 p-6 rounded-2xl bg-surface border border-border">
        <p class="text-xs font-bold uppercase tracking-widest text-faint mb-4">目次</p>
        <ol class="space-y-2 text-sm font-medium">
            <li><a href="#data-policy" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="shield" class="w-4 h-4"></i>データ取り扱い方針</a></li>
            <li><a href="#mri-overview" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="bar-chart-3" class="w-4 h-4"></i>モニタリング参考インデックスとは</a></li>
            <li><a href="#five-axes" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="pentagon" class="w-4 h-4"></i>5軸評価モデル</a></li>
            <li><a href="#limitations" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="alert-triangle" class="w-4 h-4"></i>限定事項と免責</a></li>
            <li><a href="#open-science" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4"></i>オープンサイエンスへの取り組み</a></li>
        </ol>
    </nav>

    <div class="space-y-24">

        <!-- ==============================
             1. データ取り扱い方針
        ============================== -->
        <section id="data-policy" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <i data-lucide="shield" class="w-5 h-5 text-blue-400"></i>
                </div>
                <h2 class="text-2xl font-black">データ取り扱い方針</h2>
            </div>

            <div class="space-y-6">
                <!-- カメラ & 音声 -->
                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <h3 class="text-base font-bold mb-3 flex items-center gap-2">
                        <i data-lucide="camera" class="w-4 h-4 text-[var(--color-primary)]"></i>
                        カメラ映像・環境音
                    </h3>
                    <ul class="space-y-2 text-sm text-muted leading-relaxed">
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            ライブスキャン中のカメラフレームは AI 同定後に<strong class="text-[var(--color-text)]">自動削除</strong>されます
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            環境音は BirdNET AI による鳥類判定にのみ使用され、サーバーには保存されません
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            映像・音声データがマーケティングや第三者提供に使われることはありません
                        </li>
                    </ul>
                </div>

                <!-- 位置情報 -->
                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <h3 class="text-base font-bold mb-3 flex items-center gap-2">
                        <i data-lucide="map-pin" class="w-4 h-4 text-[var(--color-primary)]"></i>
                        位置情報
                    </h3>
                    <ul class="space-y-2 text-sm text-muted leading-relaxed">
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            GPS 座標は生態学的な精度を保つため、可能な限り<strong class="text-[var(--color-text)]">高精度で記録</strong>されます
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            環境省レッドリスト該当種など希少種の位置は自動的にマスク処理されます
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            一般公開時の位置精度は権限レベルに応じて制御されます
                        </li>
                    </ul>
                </div>

                <!-- 観察データ -->
                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <h3 class="text-base font-bold mb-3 flex items-center gap-2">
                        <i data-lucide="database" class="w-4 h-4 text-[var(--color-primary)]"></i>
                        観察データ
                    </h3>
                    <ul class="space-y-2 text-sm text-muted leading-relaxed">
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            投稿された観察記録は <strong class="text-[var(--color-text)]">CC BY-NC 4.0</strong> ライセンスで共有されます
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            データは GBIF（地球規模生物多様性情報機構）への将来的な提供を目指しています
                        </li>
                        <li class="flex items-start gap-2">
                            <i data-lucide="check" class="w-4 h-4 text-green-400 mt-0.5 shrink-0"></i>
                            個人を特定できる形での観察データの販売は行いません
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- ==============================
             2. MRI 概要
        ============================== -->
        <section id="mri-overview" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <i data-lucide="bar-chart-3" class="w-5 h-5 text-emerald-400"></i>
                </div>
                <h2 class="text-2xl font-black">モニタリング参考インデックス（MRI）</h2>
            </div>

            <div class="p-8 rounded-2xl bg-surface border border-border mb-8">
                <p class="text-muted leading-relaxed mb-6">
                    モニタリング参考インデックス（MRI）は、ikimon が独自に開発した<strong class="text-[var(--color-text)]">市民科学データに基づく生物多様性の参考指標</strong>です。
                    サイト（観察地点）に集まった観察データを 5 つの軸で多角的に評価し、0〜100 のスコアとして算出します。
                </p>
                <div class="grid grid-cols-3 gap-4 text-center">
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)]">
                        <div class="text-2xl font-black text-[var(--color-primary)]">5</div>
                        <div class="text-xs text-muted mt-1">評価軸</div>
                    </div>
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)]">
                        <div class="text-2xl font-black text-[var(--color-primary)]">0–100</div>
                        <div class="text-xs text-muted mt-1">スコアレンジ</div>
                    </div>
                    <div class="p-4 rounded-xl bg-[var(--color-bg-base)]">
                        <div class="text-2xl font-black text-[var(--color-primary)]">Beta</div>
                        <div class="text-xs text-muted mt-1">バージョン</div>
                    </div>
                </div>
            </div>

            <p class="text-sm text-muted leading-relaxed">
                スコアは環境の「良し悪し」を単一の数値で断定するものではなく、
                モニタリングの進捗を可視化し、経時変化を追跡するための<strong class="text-[var(--color-text)]">対話のきっかけ</strong>として設計されています。
            </p>
        </section>

        <!-- ==============================
             3. 5軸評価モデル
        ============================== -->
        <section id="five-axes" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
                    <i data-lucide="pentagon" class="w-5 h-5 text-purple-400"></i>
                </div>
                <h2 class="text-2xl font-black">5軸評価モデル</h2>
            </div>

            <div class="space-y-4">
                <!-- Axis 1: 種の多様性 -->
                <div class="axis-card p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-400">1</span>
                            種の多様性
                        </h3>
                        <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">30%</span>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-3">
                        確認された種数と、その分布の均等さを Shannon-Wiener 指数（H'）で評価します。
                        特定の種に偏らず、多様な種が観察されているサイトほど高評価になります。
                    </p>
                    <div class="w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div class="weight-bar bg-emerald-500" style="width:30%"></div>
                    </div>
                </div>

                <!-- Axis 2: 保全価値 -->
                <div class="axis-card p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-xs font-black text-red-400">2</span>
                            保全価値
                        </h3>
                        <span class="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full">25%</span>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-3">
                        環境省レッドリストおよび都道府県版レッドリストに掲載されている種の出現状況を評価します。
                        IUCN カテゴリに基づく重み付け（CR &gt; EN &gt; VU &gt; NT）を適用し、希少種が多いサイトを高く評価します。
                    </p>
                    <div class="w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div class="weight-bar bg-red-500" style="width:25%"></div>
                    </div>
                </div>

                <!-- Axis 3: データ信頼性 -->
                <div class="axis-card p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-400">3</span>
                            データ信頼性
                        </h3>
                        <span class="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">20%</span>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-3">
                        コミュニティによる同定確認（Research Grade）の割合と、面積あたりの観察密度を評価します。
                        多くの目で検証され、十分な観察数があるデータほど信頼できるスコアを生み出します。
                    </p>
                    <div class="w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div class="weight-bar bg-blue-500" style="width:20%"></div>
                    </div>
                </div>

                <!-- Axis 4: 分類群カバー率 -->
                <div class="axis-card p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-black text-amber-400">4</span>
                            分類群カバー率
                        </h3>
                        <span class="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">15%</span>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-3">
                        鳥類・昆虫・植物・哺乳類・爬虫類・両生類・魚類・菌類の 8 分類群のうち、
                        どれだけ広い範囲の生物が観察されているかを評価します。鳥だけでなく多様な分類群をカバーすることが重要です。
                    </p>
                    <div class="w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div class="weight-bar bg-amber-500" style="width:15%"></div>
                    </div>
                </div>

                <!-- Axis 5: 調査の継続性 -->
                <div class="axis-card p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-400">5</span>
                            調査の継続性
                        </h3>
                        <span class="text-xs font-bold text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full">10%</span>
                    </div>
                    <p class="text-sm text-muted leading-relaxed mb-3">
                        1 年間のうち何ヶ月にわたってデータが収集されているか（月カバー率）と、
                        複数年にわたる継続的な調査の実績を評価します。季節変動を捉えた長期モニタリングが高く評価されます。
                    </p>
                    <div class="w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div class="weight-bar bg-violet-500" style="width:10%"></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==============================
             4. 限定事項
        ============================== -->
        <section id="limitations" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-400"></i>
                </div>
                <h2 class="text-2xl font-black">限定事項と免責</h2>
            </div>

            <div class="p-8 rounded-2xl bg-amber-900/10 border border-amber-600/20">
                <p class="text-sm text-muted leading-relaxed mb-6">
                    MRI は市民科学データに基づく参考指標です。以下の点をご理解のうえご利用ください。
                </p>
                <ul class="space-y-4 text-sm">
                    <li class="flex items-start gap-3">
                        <span class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-amber-400"></i>
                        </span>
                        <div>
                            <strong class="text-[var(--color-text)]">認証スコアではありません</strong>
                            <p class="text-muted mt-1">法令適合や環境認証を直接示すものではなく、モニタリングの進捗を可視化する参考値です。</p>
                        </div>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-amber-400"></i>
                        </span>
                        <div>
                            <strong class="text-[var(--color-text)]">観測努力の影響を受けます</strong>
                            <p class="text-muted mt-1">参加者数や調査頻度によってスコアが変動します。環境の絶対的な価値を単独で決定するものではありません。</p>
                        </div>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-amber-400"></i>
                        </span>
                        <div>
                            <strong class="text-[var(--color-text)]">存在記録ベースです</strong>
                            <p class="text-muted mt-1">種の不在証明や個体数推定には対応していません。「観察されていない」は「存在しない」とは異なります。</p>
                        </div>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="info" class="w-3.5 h-3.5 text-amber-400"></i>
                        </span>
                        <div>
                            <strong class="text-[var(--color-text)]">クレジット価格に直結しません</strong>
                            <p class="text-muted mt-1">生物多様性クレジットの価格決定や取引の根拠として使用することはできません。</p>
                        </div>
                    </li>
                </ul>
            </div>
        </section>

        <!-- ==============================
             5. オープンサイエンス
        ============================== -->
        <section id="open-science" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                    <i data-lucide="book-open" class="w-5 h-5 text-cyan-400"></i>
                </div>
                <h2 class="text-2xl font-black">オープンサイエンスへの取り組み</h2>
            </div>

            <div class="grid md:grid-cols-2 gap-4">
                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="code-2" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">計算ロジックの公開</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        MRI のスコア計算アルゴリズムは GitHub で公開しています。
                        誰でも計算過程を検証し、改善提案を行うことができます。
                    </p>
                </div>

                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">継続的な改善</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        研究者・専門家のフィードバックを反映し、手法のバージョンアップを継続しています。
                        スコア変動が起きた場合は変更履歴とともに通知します。
                    </p>
                </div>

                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="globe" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">国際基準との整合</h3>
                    </div>
                        <p class="text-sm text-muted leading-relaxed">
                            TNFD LEAP フレームワークや 30by30 などの外部議論を参照しつつ、指標設計を改善しています。
                            ただし、本指標自体がそれらの公式基準や認証を直接満たすことを意味するものではありません。
                        </p>
                </div>

                <div class="p-6 rounded-2xl bg-surface border border-border">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="users" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">市民科学の力</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        専門家だけでなく、一般市民が日常的に記録する観察データが
                        生物多様性モニタリングの基盤になるという理念のもとに運営しています。
                    </p>
                </div>
            </div>
        </section>

    </div>

    <!-- CTA -->
    <div class="mt-20 text-center space-y-4">
        <p class="text-muted text-sm">ご質問やフィードバックはお気軽にお寄せください</p>
        <div class="flex flex-wrap justify-center gap-3">
            <a href="mailto:contact@ikimon.life" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm hover:opacity-90 transition">
                <i data-lucide="mail" class="w-4 h-4"></i>
                お問い合わせ
            </a>
            <a href="/" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border text-[var(--color-text)] font-bold text-sm hover:bg-elevated transition">
                <i data-lucide="home" class="w-4 h-4"></i>
                ホームに戻る
            </a>
        </div>
    </div>

</main>

<?php include __DIR__ . '/components/footer.php'; ?>
</body>
</html>
