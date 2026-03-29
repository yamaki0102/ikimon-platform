<?php
/**
 * century_archive.php — 記録が保全に変わる理由
 *
 * ikimon.life の設計思想・学術的裏付け・100年アーカイブ哲学を伝える母艦ページ。
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/CspNonce.php';

Auth::init();
$currentUser = Auth::user();

$totalObs = 0;
try {
    $allObs = DataStore::fetchAll('observations');
    $totalObs = is_array($allObs) ? count($allObs) : 0;
} catch (Exception $e) {}

$meta_title = "100年アーカイブ — 今日の1枚が未来の答えになる | ikimon.life";
$meta_description = "散歩で撮った写真が、100年先の自然を守る科学データになる。ikimon.life の100年アーカイブの考え方と仕組み。";
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        .step-line { border-left: 2px dashed var(--color-border, #e5e7eb); margin-left: 19px; }
        .step-dot { width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0; }
        .scroll-target { scroll-margin-top: 80px; }
    </style>
</head>
<body class="bg-base text-text font-body">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="max-w-3xl mx-auto px-6 py-20 pb-32">

        <!-- Hero -->
        <header class="mb-20 text-center">
            <span class="inline-block px-4 py-1.5 rounded-full bg-surface border border-border text-emerald-500 text-xs font-bold uppercase tracking-widest mb-6">
                100年アーカイブ
            </span>
            <h1 class="text-3xl md:text-5xl font-black mb-6 leading-tight">
                今日の1枚が、<br>100年後の答えになる。
            </h1>
            <p class="text-lg text-muted max-w-xl mx-auto leading-relaxed">
                散歩で見つけた花、公園で聞いた鳥の声。<br class="hidden md:block">
                何気ない記録の積み重ねが、地域の自然を守る科学データになります。
            </p>
        </header>

        <div class="space-y-20">

            <!-- ==============================
                 1. 100年アーカイブとは
            ============================== -->
            <section id="century-archive" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <i data-lucide="archive" class="w-5 h-5 text-amber-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">100年アーカイブって何？</h2>
                </div>

                <div class="bg-surface rounded-2xl p-6 border border-border mb-6">
                    <div class="text-sm text-muted leading-relaxed space-y-4">
                        <p>
                            今年の春に聞こえた鳥の声。桜が咲いた日。池のそばで見つけたトンボの種類。
                        </p>
                        <p>
                            <strong class="text-text">今年記録しなかったら、来年「去年と比べてどう変わった？」を知ることはできません。</strong>
                            10年後も、100年後も同じです。
                        </p>
                        <p>
                            ikimon.life の100年アーカイブは、「100年後のために我慢して記録する」という話ではありません。
                        </p>
                        <p>
                            <strong class="text-text">今日の散歩を少しだけ楽しくする。</strong>
                            名前を知ると、同じ道が違って見える。記録すると、季節の移り変わりに気づく。
                            その積み重ねが、気づけば来年との比較データになり、10年後の変化を捉える証拠になり、
                            100年後の研究者が「2026年の日本の自然はこうだった」と知る手がかりになる。
                        </p>
                        <p>
                            楽しんだ結果が、科学になる。それが100年アーカイブの考え方です。
                        </p>
                    </div>
                </div>

                <!-- Archive message -->
                <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800">
                    <div class="flex items-center justify-center gap-3 mb-3">
                        <div class="text-3xl font-black text-emerald-500"><?= number_format($totalObs) ?></div>
                        <div class="text-sm text-muted">件の観察が<br>すでにアーカイブされています</div>
                    </div>
                    <p class="text-xs text-center text-muted">
                        2026年、記録は始まりました。<br>
                        SNSの投稿は流れて消えます。でも、科学データベースに刻まれた観察は残り続けます。
                    </p>
                </div>
            </section>

            <!-- ==============================
                 2. 記録がたくさんあるだけじゃダメな理由
            ============================== -->
            <section id="data-gap" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center">
                        <i data-lucide="alert-circle" class="w-5 h-5 text-rose-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">ただ記録するだけでは、<br class="sm:hidden">自然は守れない</h2>
                </div>

                <div class="bg-surface rounded-2xl p-6 border border-border space-y-4">
                    <p class="text-sm text-muted leading-relaxed">
                        「写真を撮ってアプリに投稿する」。それだけなら、すでに色々なサービスがあります。
                        世界中で毎年、数億件もの生き物の記録がデータベースに追加されています。
                    </p>
                    <p class="text-sm text-muted leading-relaxed">
                        でも、2026年に44名の研究者が指摘したのは、こういうことでした。
                    </p>
                    <div class="bg-rose-50 dark:bg-rose-950/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800/40">
                        <p class="text-sm font-bold text-text leading-relaxed">
                            「データがたくさんある」ことと「自然を守るために何をすべきかわかる」ことは、まったく別の話だ。
                        </p>
                    </div>
                    <p class="text-sm text-muted leading-relaxed">
                        バラバラの形式で散らばった記録、品質が不明なデータ、行政や企業の判断材料として使えない情報 ——
                        いくら量が増えても、<strong class="text-text">「何が起きているか」はわかっても「何をすべきか」にはたどり着けない</strong>。
                        それが現状の課題です。
                    </p>
                </div>
            </section>

            <!-- ==============================
                 3. ikimon が作っている仕組み
            ============================== -->
            <section id="how-it-works" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                        <i data-lucide="layers" class="w-5 h-5 text-emerald-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">だから ikimon は<br class="sm:hidden">こう作っている</h2>
                </div>

                <p class="text-sm text-muted leading-relaxed mb-6">
                    「使える科学データ」にするために、記録の裏側で4つの仕組みが動いています。
                </p>

                <div class="grid sm:grid-cols-2 gap-4">
                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="database" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">共通フォーマットで記録</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            写真・音声・位置情報・環境データを、世界共通の生物多様性データ形式（DarwinCore）で保存。
                            「誰が・いつ・どこで・何を」が統一された構造で残るので、後から比較・分析できます。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="shield-check" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">段階的に信頼度を上げる</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            まず AI が種名を推定。次にコミュニティのメンバーが確認し、さらに専門家がレビュー。
                            「このデータはどれくらい信頼できるか」が明示される仕組みです。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="users" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">みんなで検証する</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            初心者からベテラン、研究者まで、4段階の検証体制。
                            誰がいつ何を確認したかの記録が残るので、間違いがあっても後から追跡できます。
                        </p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <div class="flex items-center gap-2 mb-3">
                            <i data-lucide="globe" class="w-5 h-5 text-emerald-500"></i>
                            <h3 class="text-base font-bold">世界のデータベースに届ける</h3>
                        </div>
                        <p class="text-sm text-muted leading-relaxed">
                            検証されたデータは GBIF（世界最大の生物多様性データベース）に提供されます。
                            たとえ ikimon がなくなっても、あなたの記録は世界の科学データとして生き続けます。
                        </p>
                    </div>
                </div>
            </section>

            <!-- ==============================
                 4. あなたの記録が届くまでの流れ
            ============================== -->
            <section id="pipeline" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                        <i data-lucide="git-branch" class="w-5 h-5 text-blue-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">1枚の写真が<br class="sm:hidden">保全に届くまで</h2>
                </div>

                <div class="space-y-0">
                    <!-- Step 1 -->
                    <div class="flex items-start gap-4">
                        <div class="step-dot bg-blue-500/15 text-blue-500">1</div>
                        <div class="pb-6">
                            <h3 class="text-base font-bold mb-1">見つけて、撮る</h3>
                            <p class="text-sm text-muted">散歩中に気になった花、庭に来た鳥。スマホで撮るだけで、位置と時刻が自動で記録されます。</p>
                        </div>
                    </div>
                    <div class="step-line pl-8">
                        <!-- Step 2 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-purple-500/15 text-purple-500">2</div>
                            <div class="pb-6">
                                <h3 class="text-base font-bold mb-1">AI と仲間が名前を確認</h3>
                                <p class="text-sm text-muted">AI がまず種名を推定。その後、詳しいメンバーや専門家が「合ってるよ」と確認してくれます。</p>
                            </div>
                        </div>
                        <!-- Step 3 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-teal-500/15 text-teal-500">3</div>
                            <div class="pb-6">
                                <h3 class="text-base font-bold mb-1">地域のデータとして積み上がる</h3>
                                <p class="text-sm text-muted">同じ場所の記録が増えるほど、「この地域にはこんな生き物がいる」という時系列データが育ちます。</p>
                            </div>
                        </div>
                        <!-- Step 4 -->
                        <div class="flex items-start gap-4 -ml-[25px]">
                            <div class="step-dot bg-emerald-500/15 text-emerald-500">4</div>
                            <div>
                                <h3 class="text-base font-bold mb-1">自然を守る根拠になる</h3>
                                <p class="text-sm text-muted">自治体の保全計画、企業の環境レポート、研究者の論文。あなたの記録が、意思決定の根拠として使われます。</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ==============================
                 5. 社会の仕組みとのつながり
            ============================== -->
            <section id="policy-link" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                        <i data-lucide="landmark" class="w-5 h-5 text-indigo-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">あなたの記録が届く先</h2>
                </div>

                <p class="text-sm text-muted leading-relaxed mb-6">
                    いま、自然を守るための国際的な枠組みが動き始めています。
                    どれも「実際の観察データ」を必要としていて、市民の記録がその基盤になります。
                </p>

                <div class="grid sm:grid-cols-3 gap-4">
                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">30by30</h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            「2030年までに陸と海の30%を保全しよう」という国際目標です。
                        </p>
                        <p class="text-xs text-faint">どこを保全すべきかを判断するには、「そこにどんな生き物がいるか」のデータが不可欠です。</p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">自然共生サイト<span class="text-xs font-normal text-muted ml-1">(OECM)</span></h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            企業の敷地、里山、学校の裏山、近所の公園 —— 保護区でなくても、生き物を育む場所は認定を受けられます。
                        </p>
                        <p class="text-xs text-faint">認定には「継続的な生き物の記録」が必要。ikimon のサイト機能がその基盤になります。</p>
                    </div>

                    <div class="bg-surface rounded-2xl p-6 border border-border">
                        <h3 class="text-base font-bold mb-2 text-emerald-500">TNFD<span class="text-xs font-normal text-muted ml-1">(自然関連の情報開示)</span></h3>
                        <p class="text-sm text-muted leading-relaxed mb-3">
                            企業が「自分たちの事業が自然にどう影響しているか」を報告する国際ルールです。
                        </p>
                        <p class="text-xs text-faint">報告には「自社周辺にどんな生態系があるか」のエビデンスが必要。検証済みデータがその根拠になります。</p>
                    </div>
                </div>
            </section>

            <!-- ==============================
                 6. 学術的な裏付け
            ============================== -->
            <section id="evidence" class="scroll-target">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-10 h-10 rounded-xl bg-slate-500/15 flex items-center justify-center">
                        <i data-lucide="book-open" class="w-5 h-5 text-slate-400"></i>
                    </div>
                    <h2 class="text-2xl font-black">この考え方の根拠</h2>
                </div>

                <div class="bg-surface rounded-2xl p-6 border border-border space-y-4">
                    <p class="text-sm text-muted leading-relaxed">
                        ikimon.life の設計は、2026年3月にアメリカ科学アカデミー紀要（PNAS）に掲載された
                        <strong class="text-text">44名の研究者による共同提言</strong>に基づいています。
                    </p>
                    <p class="text-sm text-muted leading-relaxed">
                        この論文は「生物多様性データを保全の意思決定に活かすための9つの提言」をまとめたもので、
                        ikimon はデータの統合・標準化・品質管理・永続性など、主要な提言に対応する仕組みを実装しています。
                    </p>

                    <details class="group">
                        <summary class="text-xs font-bold text-emerald-500 cursor-pointer hover:text-emerald-400 transition">
                            提言との対応を詳しく見る
                        </summary>
                        <div class="mt-4 space-y-3 text-xs text-muted">
                            <div class="flex items-start gap-2">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-500 font-bold flex-shrink-0">1</span>
                                <span><strong class="text-text">データ統合</strong> — 写真・音声・GPS・環境データを1つの構造で記録</span>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-500 font-bold flex-shrink-0">2</span>
                                <span><strong class="text-text">標準化</strong> — DarwinCore 準拠の世界共通形式</span>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-500 font-bold flex-shrink-0">3</span>
                                <span><strong class="text-text">較正</strong> — AI + コミュニティ + 専門家の段階的検証</span>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-500 font-bold flex-shrink-0">5</span>
                                <span><strong class="text-text">信頼できるDB</strong> — 検証ログと監査証跡の保持</span>
                            </div>
                            <div class="flex items-start gap-2">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500/15 text-emerald-500 font-bold flex-shrink-0">9</span>
                                <span><strong class="text-text">耐性</strong> — GBIF 連携によるプラットフォーム非依存の永続性</span>
                            </div>
                            <div class="flex items-start gap-2 opacity-60">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/15 text-amber-500 font-bold flex-shrink-0">7</span>
                                <span><strong class="text-text">地域知識の統合</strong> — 地域住民の知見を活かす仕組み（今後の課題）</span>
                            </div>
                            <div class="flex items-start gap-2 opacity-60">
                                <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500/15 text-amber-500 font-bold flex-shrink-0">8</span>
                                <span><strong class="text-text">介入効果の定量化</strong> — 保全活動の効果測定（今後の課題）</span>
                            </div>
                        </div>
                    </details>

                    <p class="text-xs text-faint">
                        Sutherland, W.J. et al. (2026) PNAS — "Nine actions to use biodiversity data for conservation"
                    </p>
                </div>
            </section>

        </div>

        <!-- CTA -->
        <div class="mt-20 text-center space-y-4">
            <p class="text-base text-muted mb-2">
                特別な知識はいりません。スマホがあれば今日から始められます。
            </p>
            <a href="field_research.php" class="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-base bg-emerald-500 hover:bg-emerald-600 transition">
                <i data-lucide="search" class="w-5 h-5"></i>
                観察を始める
            </a>
            <div class="text-xs text-muted">写真1枚から参加できます</div>

            <div class="flex flex-wrap justify-center gap-4 mt-6 pt-6 border-t border-border">
                <a href="for-business/" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border font-bold text-sm hover:bg-elevated transition">
                    <i data-lucide="building-2" class="w-4 h-4"></i>
                    企業・自治体の方へ
                </a>
                <a href="for-researcher.php" class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface border border-border font-bold text-sm hover:bg-elevated transition">
                    <i data-lucide="flask-conical" class="w-4 h-4"></i>
                    研究者の方へ
                </a>
            </div>
        </div>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
</body>
</html>
