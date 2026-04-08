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
<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-4xl mx-auto px-6 py-20 pb-32">

    <!-- Hero -->
    <header class="mb-20 text-center">
        <span class="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-6" style="border-radius:var(--shape-full);background:var(--md-primary-container);color:var(--md-on-primary-container);">
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
    <nav class="mb-16 p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
        <p class="text-xs font-bold uppercase tracking-widest text-faint mb-4">目次</p>
        <ol class="space-y-2 text-sm font-medium">
            <li><a href="#data-policy" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="shield" class="w-4 h-4"></i>データ取り扱い方針</a></li>
            <li><a href="#mri-overview" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="bar-chart-3" class="w-4 h-4"></i>モニタリング参考インデックスとは</a></li>
            <li><a href="#five-axes" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="pentagon" class="w-4 h-4"></i>5軸評価モデル</a></li>
            <li><a href="#formula-spec" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="function-square" class="w-4 h-4"></i>計算仕様と学術的根拠</a></li>
            <li><a href="#limitations" class="text-[var(--color-primary)] hover:underline flex items-center gap-2"><i data-lucide="info" class="w-4 h-4"></i>設計の透明性</a></li>
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
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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

            <div class="p-8 mb-8" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <p class="text-muted leading-relaxed mb-6">
                    モニタリング参考インデックス（MRI）は、ikimon が独自に開発した<strong class="text-[var(--color-text)]">市民科学データに基づく生物多様性の参考指標</strong>です。
                    サイト（観察地点）に集まった観察データを 5 つの軸で多角的に評価し、0〜100 のスコアとして算出します。
                </p>
                <div class="grid grid-cols-3 gap-4 text-center">
                    <div class="p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
                        <div class="text-2xl font-black text-[var(--color-primary)]">5</div>
                        <div class="text-xs text-muted mt-1">評価軸</div>
                    </div>
                    <div class="p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
                        <div class="text-2xl font-black text-[var(--color-primary)]">0–100</div>
                        <div class="text-xs text-muted mt-1">スコアレンジ</div>
                    </div>
                    <div class="p-4" style="background:var(--md-surface-container-low);border-radius:var(--shape-md);">
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
                <div class="axis-card p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                    <div class="w-full overflow-hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);">
                        <div class="weight-bar bg-emerald-500" style="width:30%"></div>
                    </div>
                </div>

                <!-- Axis 2: 保全価値 -->
                <div class="axis-card p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                    <div class="w-full overflow-hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);">
                        <div class="weight-bar bg-red-500" style="width:25%"></div>
                    </div>
                </div>

                <!-- Axis 3: データ信頼性 -->
                <div class="axis-card p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                    <div class="w-full overflow-hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);">
                        <div class="weight-bar bg-blue-500" style="width:20%"></div>
                    </div>
                </div>

                <!-- Axis 4: 分類群カバー率 -->
                <div class="axis-card p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                    <div class="w-full overflow-hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);">
                        <div class="weight-bar bg-amber-500" style="width:15%"></div>
                    </div>
                </div>

                <!-- Axis 5: 調査の継続性 -->
                <div class="axis-card p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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
                    <div class="w-full overflow-hidden" style="background:var(--md-surface-container-low);border-radius:var(--shape-full);">
                        <div class="weight-bar bg-violet-500" style="width:10%"></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ==============================
             4. 計算仕様と学術的根拠
        ============================== -->
        <section id="formula-spec" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
                    <i data-lucide="function-square" class="w-5 h-5 text-orange-400"></i>
                </div>
                <h2 class="text-2xl font-black">計算仕様と学術的根拠</h2>
            </div>

            <!-- 総合スコア式 -->
            <div class="p-6 mb-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2">
                    <i data-lucide="sigma" class="w-4 h-4 text-orange-400"></i>
                    総合スコア（MRI）算出式
                </h3>
                <div class="p-4 mb-4" style="background:var(--md-surface-container-high, #1e1e1e);border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);">
                    <code class="font-mono text-sm" style="color:var(--md-on-surface);line-height:2;">
                        MRI = (A1 × 0.30) + (A2 × 0.25) + (A3 × 0.20) + (A4 × 0.15) + (A5 × 0.10)
                    </code>
                </div>
                <p class="text-xs text-muted">各軸スコア A1〜A5 はそれぞれ 0〜100 に正規化されます。最終スコアも 0〜100 の範囲に収まります。</p>
            </div>

            <!-- 各軸の詳細計算式 -->
            <div class="space-y-5 mb-6">

                <!-- Axis 1 -->
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);border-left:4px solid rgb(16 185 129);">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-xs font-black text-emerald-400">1</span>
                            A1 — 種の多様性（重み 30%）
                        </h3>
                        <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full">Shannon-Wiener 1948</span>
                    </div>
                    <div class="p-4 mb-3 space-y-2" style="background:rgba(0,0,0,0.25);border-radius:var(--shape-md);">
                        <div><code class="font-mono text-xs" style="color:#a3e8b0;">H' = -Σ( p<sub style="font-size:0.7em">i</sub> × ln(p<sub style="font-size:0.7em">i</sub>) )</code></div>
                        <div><code class="font-mono text-xs" style="color:#a3e8b0;">p<sub style="font-size:0.7em">i</sub> = n<sub style="font-size:0.7em">i</sub> / N</code>
                            <span class="font-mono text-xs text-muted ml-2">// n<sub style="font-size:0.7em">i</sub>: 種 i の観察数、N: 全観察数</span>
                        </div>
                        <div><code class="font-mono text-xs" style="color:#a3e8b0;">A1 = min(100, (H' / 3.5) × 100)</code>
                            <span class="font-mono text-xs text-muted ml-2">// 3.5 = 温帯種多産サイトの参照値</span>
                        </div>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">基準値 H'=3.5 は Magurran (2004) に基づく温帯豊かな生態系での典型的な上限値です。CBD KM-GBF Target 4（生態系健全性）に対応する中核指標です。</p>
                </div>

                <!-- Axis 2 -->
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);border-left:4px solid rgb(239 68 68);">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-xs font-black text-red-400">2</span>
                            A2 — 保全価値（重み 25%）
                        </h3>
                        <span class="text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1 rounded-full">IUCN Red List 2012</span>
                    </div>
                    <div class="p-4 mb-3 space-y-2" style="background:rgba(0,0,0,0.25);border-radius:var(--shape-md);">
                        <div><code class="font-mono text-xs" style="color:#fca5a5;">CR=5, EN=4, VU=3, NT=2</code>
                            <span class="font-mono text-xs text-muted ml-2">// IUCN カテゴリ順位スコア</span>
                        </div>
                        <div><code class="font-mono text-xs" style="color:#fca5a5;">CV_raw = Σ score(category<sub style="font-size:0.7em">j</sub>)</code>
                            <span class="font-mono text-xs text-muted ml-2">// マッチした全レッドリスト種の合計</span>
                        </div>
                        <div><code class="font-mono text-xs" style="color:#fca5a5;">A2 = min(100, (CV_raw / 20) × 100)</code></div>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">IUCN レッドリストカテゴリと基準（IUCN 2012）に基づく順序スケールを採用。CBD KM-GBF Target 3（30×30）および TNFD LEAP Evaluate ステップに対応します。</p>
                </div>

                <!-- Axis 3 -->
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);border-left:4px solid rgb(59 130 246);">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-400">3</span>
                            A3 — データ信頼性（重み 20%）
                        </h3>
                        <span class="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">GBIF Darwin Core 2023</span>
                    </div>
                    <div class="p-4 mb-3 space-y-2" style="background:rgba(0,0,0,0.25);border-radius:var(--shape-md);">
                        <div><code class="font-mono text-xs" style="color:#93c5fd;">RG_ratio = count(community_verified) / count(total_obs)</code></div>
                        <div><code class="font-mono text-xs" style="color:#93c5fd;">density_norm = min(1.0, (obs_count / area_ha) / 10)</code></div>
                        <div><code class="font-mono text-xs" style="color:#93c5fd;">A3 = min(100, (RG_ratio × 0.6 + density_norm × 0.4) × 100)</code></div>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">市民科学データは観察バイアスを含むため、コミュニティ同定確認（Research Grade 相当）の割合を明示的に信頼性指標として組み込みます。GBIF Darwin Core 品質フラグ基準に準拠します。</p>
                </div>

                <!-- Axis 4 -->
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);border-left:4px solid rgb(245 158 11);">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-xs font-black text-amber-400">4</span>
                            A4 — 分類群カバー率（重み 15%）
                        </h3>
                        <span class="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">GEO BON EBV 2022</span>
                    </div>
                    <div class="p-4 mb-3 space-y-2" style="background:rgba(0,0,0,0.25);border-radius:var(--shape-md);">
                        <div><code class="font-mono text-xs" style="color:#fcd34d;">// 対象8分類群: Aves, Insecta, Mammalia, Reptilia,</code></div>
                        <div><code class="font-mono text-xs" style="color:#fcd34d;">//              Amphibia, Actinopterygii, Plantae, Fungi</code></div>
                        <div><code class="font-mono text-xs" style="color:#fcd34d;">groups_detected = count(distinct taxon_group in obs)</code></div>
                        <div><code class="font-mono text-xs" style="color:#fcd34d;">A4 = min(100, (groups_detected / 8) × 100)</code></div>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">GEO BON 必須生物多様性変数（EBV）の「コミュニティ組成」クラスに整合します。特定分類群の観察集中による偏りをペナルティとして機能します。</p>
                </div>

                <!-- Axis 5 -->
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);border-left:4px solid rgb(139 92 246);">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="text-base font-bold flex items-center gap-2">
                            <span class="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-400">5</span>
                            A5 — 調査の継続性（重み 10%）
                        </h3>
                        <span class="text-xs font-bold text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full">CBD KM-GBF Target 21</span>
                    </div>
                    <div class="p-4 mb-3 space-y-2" style="background:rgba(0,0,0,0.25);border-radius:var(--shape-md);">
                        <div><code class="font-mono text-xs" style="color:#c4b5fd;">m = count(distinct months observed)  // max 12</code></div>
                        <div><code class="font-mono text-xs" style="color:#c4b5fd;">year_factor: y=1 → 0.5, y=2 → 0.75, y≥3 → 1.0</code></div>
                        <div><code class="font-mono text-xs" style="color:#c4b5fd;">A5 = min(100, (m / 12) × year_factor × 100)</code></div>
                    </div>
                    <p class="text-xs text-muted leading-relaxed">季節的な物候完全性と長期モニタリングを評価します。Gotelli &amp; Colwell (2001) の標本化完全性の概念に基づき、CBD KM-GBF Target 21（情報収集の強化）に対応します。</p>
                </div>
            </div>

            <!-- 重み付け根拠 -->
            <div class="p-6 mb-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2">
                    <i data-lucide="scale" class="w-4 h-4 text-orange-400"></i>
                    重み付けの根拠
                </h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs" style="border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <th class="text-left py-2 pr-4 font-bold text-muted">軸</th>
                                <th class="text-left py-2 pr-4 font-bold text-muted">重み</th>
                                <th class="text-left py-2 font-bold text-muted">根拠</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y" style="--tw-divide-opacity:1;border-color:var(--md-outline-variant);">
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-emerald-400">A1 種の多様性</td>
                                <td class="py-3 pr-4 font-bold">30%</td>
                                <td class="py-3 text-muted leading-relaxed">種多様性は CBD KM-GBF Target 4（生態系完全性）の中核指標。H' は最も確立されたα多様性の尺度</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-red-400">A2 保全価値</td>
                                <td class="py-3 pr-4 font-bold">25%</td>
                                <td class="py-3 text-muted leading-relaxed">レッドリスト種は CBD KM-GBF Target 3（30×30）・TNFD LEAP Evaluate における最優先対象</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-blue-400">A3 データ信頼性</td>
                                <td class="py-3 pr-4 font-bold">20%</td>
                                <td class="py-3 text-muted leading-relaxed">市民科学データの品質不確実性を明示的に補正するため高重み。GBIF Darwin Core 品質基準準拠</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-amber-400">A4 分類群カバー率</td>
                                <td class="py-3 pr-4 font-bold">15%</td>
                                <td class="py-3 text-muted leading-relaxed">GEO BON EBV「コミュニティ組成」クラスに整合。単一分類群への偏りを是正する補助指標</td>
                            </tr>
                            <tr>
                                <td class="py-3 pr-4 font-medium text-violet-400">A5 調査継続性</td>
                                <td class="py-3 pr-4 font-bold">10%</td>
                                <td class="py-3 text-muted leading-relaxed">物候完全性・長期性は重要だが新規サイトへのペナルティを抑制するため最低重みに設定</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 国際標準マッピング -->
            <div class="p-6 mb-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2">
                    <i data-lucide="map" class="w-4 h-4 text-orange-400"></i>
                    国際標準マッピング
                </h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs" style="border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <th class="text-left py-2 pr-4 font-bold text-muted">評価軸</th>
                                <th class="text-left py-2 pr-4 font-bold text-muted">国際標準</th>
                                <th class="text-left py-2 font-bold text-muted">参照文献</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-emerald-400">種の多様性</td>
                                <td class="py-3 pr-4 text-muted">CBD KM-GBF Target 4; GEO BON EBV "Species populations"</td>
                                <td class="py-3 text-muted">Shannon &amp; Weaver 1949; Magurran 2004</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-red-400">保全価値</td>
                                <td class="py-3 pr-4 text-muted">IUCN Red List Categories &amp; Criteria; CBD KM-GBF Target 3</td>
                                <td class="py-3 text-muted">IUCN 2012</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-blue-400">データ信頼性</td>
                                <td class="py-3 pr-4 text-muted">GBIF Darwin Core quality flags; iNaturalist Research Grade</td>
                                <td class="py-3 text-muted">GBIF 2023</td>
                            </tr>
                            <tr style="border-bottom:1px solid var(--md-outline-variant);">
                                <td class="py-3 pr-4 font-medium text-amber-400">分類群カバー率</td>
                                <td class="py-3 pr-4 text-muted">GEO BON EBV Class "Community composition"</td>
                                <td class="py-3 text-muted">GEO BON 2022</td>
                            </tr>
                            <tr>
                                <td class="py-3 pr-4 font-medium text-violet-400">調査継続性</td>
                                <td class="py-3 pr-4 text-muted">CBD KM-GBF Target 21; phenological completeness</td>
                                <td class="py-3 text-muted">Gotelli &amp; Colwell 2001</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 参考文献 -->
            <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <h3 class="text-base font-bold mb-4 flex items-center gap-2">
                    <i data-lucide="book-marked" class="w-4 h-4 text-orange-400"></i>
                    参考文献
                </h3>
                <ol class="space-y-2 text-xs text-muted leading-relaxed list-decimal list-inside">
                    <li>Shannon, C.E. &amp; Weaver, W. (1949). <em>The Mathematical Theory of Communication.</em> University of Illinois Press.</li>
                    <li>Magurran, A.E. (2004). <em>Measuring Biological Diversity.</em> Blackwell Publishing, Oxford.</li>
                    <li>IUCN (2012). <em>IUCN Red List Categories and Criteria: Version 3.1.</em> 2nd ed. Gland, Switzerland and Cambridge, UK.</li>
                    <li>GEO BON (2022). <em>Essential Biodiversity Variables: Monitoring Biodiversity Change.</em> Group on Earth Observations Biodiversity Observation Network.</li>
                    <li>GBIF (2023). <em>GBIF Darwin Core occurrence download quality flags.</em> Global Biodiversity Information Facility, Copenhagen.</li>
                    <li>Gotelli, N.J. &amp; Colwell, R.K. (2001). Quantifying biodiversity: procedures and pitfalls in the measurement and comparison of species richness. <em>Ecology Letters</em>, 4(4), 379–391.</li>
                    <li>CBD (2022). <em>Kunming-Montreal Global Biodiversity Framework (KM-GBF).</em> Convention on Biological Diversity, COP15.</li>
                    <li>TNFD (2023). <em>TNFD LEAP Approach: Locate, Evaluate, Assess, Prepare.</em> Taskforce on Nature-related Financial Disclosures.</li>
                </ol>
            </div>
        </section>

        <!-- ==============================
             5. 限定事項
        ============================== -->
        <section id="limitations" class="scroll-target">
            <div class="flex items-center gap-3 mb-8">
                <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <i data-lucide="info" class="w-5 h-5 text-blue-400"></i>
                </div>
                <h2 class="text-2xl font-black">設計の透明性</h2>
            </div>

            <!-- 市民科学免責事項 -->
            <div class="p-5 mb-6 flex gap-4" style="background:rgba(251,191,36,0.08);border:1.5px solid rgba(251,191,36,0.35);border-radius:var(--shape-xl);">
                <div class="shrink-0 mt-0.5">
                    <i data-lucide="triangle-alert" class="w-5 h-5 text-amber-400"></i>
                </div>
                <div class="space-y-2 text-sm leading-relaxed" style="color:var(--md-on-surface);">
                    <p class="font-bold text-amber-400">市民科学データに基づく参考指標であることをご理解ください</p>
                    <ul class="space-y-1.5 text-muted">
                        <li class="flex items-start gap-2">
                            <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                            このインデックスは市民科学データの集積に基づく<strong style="color:var(--md-on-surface);">参考指標</strong>です。専門家による生態調査の代替ではありません。
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                            データ量・参加者数・調査手法の違いによりスコアは影響を受けます。特に観察数が少ないサイトでは不確実性が大きくなります。
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                            <strong style="color:var(--md-on-surface);">偽陰性問題</strong>：観察されていないことは、その生物が存在しないことを意味しません。観察圧力の低いエリアでは過小評価が生じます。
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                            法令適合判定・環境認証・政策立案への利用には、必ず専門家による調査・評価を併用してください。
                        </li>
                    </ul>
                </div>
            </div>

            <div class="p-8 rounded-2xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);">
                <p class="text-sm leading-relaxed mb-6" style="color:var(--md-on-surface);">
                    MRI は以下の用途に最適化された参考指標です。
                </p>
                <div class="grid md:grid-cols-3 gap-4 mb-6">
                    <div class="p-4 rounded-xl" style="background:var(--md-surface-container-low);">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="trending-up" class="w-4 h-4 text-[var(--color-primary)]"></i>
                            <strong class="text-sm">時系列変化の追跡</strong>
                        </div>
                        <p class="text-xs text-muted">同一地点のスコアを経年で比較し、生態系の変化傾向を捉えます。</p>
                    </div>
                    <div class="p-4 rounded-xl" style="background:var(--md-surface-container-low);">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="git-compare" class="w-4 h-4 text-[var(--color-primary)]"></i>
                            <strong class="text-sm">地域間の相対比較</strong>
                        </div>
                        <p class="text-xs text-muted">同じ手法で集めたデータ同士の比較に適しています。</p>
                    </div>
                    <div class="p-4 rounded-xl" style="background:var(--md-surface-container-low);">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="activity" class="w-4 h-4 text-[var(--color-primary)]"></i>
                            <strong class="text-sm">モニタリング進捗の可視化</strong>
                        </div>
                        <p class="text-xs text-muted">調査の充実度を定量化し、対話のきっかけを作ります。</p>
                    </div>
                </div>
                <div class="border-t pt-5" style="border-color:var(--md-outline-variant);">
                    <p class="text-xs font-bold uppercase tracking-widest text-muted mb-3">ご留意ください</p>
                    <ul class="space-y-2 text-sm text-muted">
                        <li class="flex items-start gap-2">
                            <span class="text-muted mt-0.5">·</span>
                            法令適合判定や環境認証には、本指標とは別に専門家評価を併用してください。
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-muted mt-0.5">·</span>
                            参加者数・調査頻度によってスコアが変動します。絶対値ではなく変化の方向を重視してください。
                        </li>
                        <li class="flex items-start gap-2">
                            <span class="text-muted mt-0.5">·</span>
                            存在記録ベースです。「観察されていない」は「存在しない」とは異なります。
                        </li>
                    </ul>
                </div>
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
                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="code-2" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">計算ロジックの公開</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        MRI のスコア計算アルゴリズムは GitHub で公開しています。
                        誰でも計算過程を検証し、改善提案を行うことができます。
                    </p>
                </div>

                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="refresh-cw" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">継続的な改善</h3>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        研究者・専門家のフィードバックを反映し、手法のバージョンアップを継続しています。
                        スコア変動が起きた場合は変更履歴とともに通知します。
                    </p>
                </div>

                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                    <div class="flex items-center gap-2 mb-3">
                        <i data-lucide="globe" class="w-5 h-5 text-[var(--color-primary)]"></i>
                        <h3 class="text-base font-bold">国際基準との整合</h3>
                    </div>
                        <p class="text-sm text-muted leading-relaxed">
                            TNFD LEAP フレームワークや 30by30 などの外部議論を参照しつつ、指標設計を改善しています。
                            ただし、本指標自体がそれらの公式基準や認証を直接満たすことを意味するものではありません。
                        </p>
                </div>

                <div class="p-6" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
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

    <!-- Next Read -->
    <div class="mt-20 grid md:grid-cols-2 gap-4">
        <a href="for-researcher.php" class="group p-6 flex items-start gap-4 hover:shadow-md transition-shadow" style="background:var(--md-surface-container);border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);">
            <div class="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <i data-lucide="database" class="w-5 h-5 text-violet-400"></i>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-widest text-muted mb-1">Next</p>
                <p class="font-bold text-sm group-hover:text-[var(--color-primary)] transition-colors">データを持ち帰りたい方へ</p>
                <p class="text-xs text-muted mt-1">Darwin Core 形式エクスポート、研究利用、共同実証について</p>
            </div>
        </a>
        <a href="century_archive.php" class="group p-6 flex items-start gap-4 hover:shadow-md transition-shadow" style="background:var(--md-surface-container);border-radius:var(--shape-xl);border:1px solid var(--md-outline-variant);">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <i data-lucide="archive" class="w-5 h-5 text-emerald-400"></i>
            </div>
            <div>
                <p class="text-xs font-bold uppercase tracking-widest text-muted mb-1">Next</p>
                <p class="font-bold text-sm group-hover:text-[var(--color-primary)] transition-colors">100年生態系アーカイブ</p>
                <p class="text-xs text-muted mt-1">2026年の観察が100年後の比較基準になる理由</p>
            </div>
        </a>
    </div>

    <!-- CTA -->
    <div class="mt-12 text-center space-y-4">
        <p class="text-muted text-sm">ご質問やフィードバックはお気軽にお寄せください</p>
        <div class="flex flex-wrap justify-center gap-3">
            <a href="mailto:contact@ikimon.life" class="inline-flex items-center gap-2 px-6 py-3 font-bold text-sm hover:opacity-90 transition" style="background:var(--md-primary);color:var(--md-on-primary);border-radius:var(--shape-full);">
                <i data-lucide="mail" class="w-4 h-4"></i>
                お問い合わせ
            </a>
            <a href="/" class="inline-flex items-center gap-2 px-6 py-3 font-bold text-sm transition" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:var(--shape-md);color:var(--md-on-surface);">
                <i data-lucide="home" class="w-4 h-4"></i>
                ホームに戻る
            </a>
        </div>
    </div>

</main>

<?php include __DIR__ . '/components/footer.php'; ?>
</body>
</html>
