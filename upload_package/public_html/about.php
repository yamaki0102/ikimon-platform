<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ikimonについて | ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .story-section {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%);
        }
    </style>
</head>

<body class="js-loading pt-14 bg-base text-text font-body">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main>
    <!-- Hero Section -->
    <section class="pt-20 pb-12 px-6">
        <div class="max-w-4xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-surface border border-primary/20 backdrop-blur-md mb-5">
                <span class="text-xs font-bold tracking-wider uppercase text-primary-dark">About ikimon</span>
            </div>
            <h1 class="text-4xl md:text-6xl font-black mb-4 tracking-tight">
                なぜ、<span class="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]">ikimon</span>を作ったのか
            </h1>
            <p class="text-base md:text-lg font-medium text-muted max-w-2xl mx-auto leading-relaxed">
                浜松から始まる、自然と人をつなぐ物語
            </p>
        </div>
    </section>

    <!-- Founder Story Section -->
    <section class="py-12 px-6 story-section">
        <div class="max-w-3xl mx-auto">

            <!-- Story Content -->
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">

                <!-- Photo placeholder -->
                <div class="flex items-center gap-6 mb-8 pb-8 border-b border-border">
                    <div class="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-3xl font-black text-[#05070a]">
                        Y
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-text">八巻 毅</h2>
                        <p class="text-sm text-muted">ikimon 創業者 / CEO</p>
                    </div>
                </div>

                <article class="prose prose-lg max-w-none space-y-6 text-muted leading-relaxed">

                    <h3 class="text-2xl font-bold text-text">きっかけ：浜松の自然との出会い</h3>
                    <p>
                        浜松の身近な公園で、小さな虫や草花の違いに気づいたことが原点でした。
                        その気づきが「この自然を未来に残したい」という思いにつながり、
                        発見を記録し、共有できる仕組みを作ろうと決めました。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">課題：見えない自然の価値</h3>
                    <p>
                        日本には豊かな自然がありますが、その価値は可視化されにくく、
                        「何が、どこに、どれだけいるのか」が分からないまま意思決定されることが多いのが現状です。
                        企業や自治体が自然を守ろうとしても、判断材料が不足しています。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">解決策：市民の力で自然を可視化する</h3>
                    <p>
                        ikimonは、市民の「見つけた！」という小さな発見を、
                        科学的に価値のあるデータへ変えるプラットフォームです。
                        専門家のネットワークが正確性を担保し、
                        企業や自治体はそのデータを使ってTNFD対応や自然資本の可視化を進められます。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">ビジョン：自然と共に生きる社会へ</h3>
                    <p>
                        2030年までに、浜松のすべての小中学校でikimonが使われ、
                        子どもたちが自分の街の自然を知る世界を作りたい。
                        その経験が大人になっても続き、
                        自然を守ることが当たり前の社会を実現することが目標です。
                    </p>

                    <blockquote class="border-l-4 border-[var(--color-primary)] pl-6 my-8 italic text-xl text-text">
                        「自然を守ることは、未来を守ること。<br>
                        一人ひとりの発見が、大きな変化を生む。」
                    </blockquote>

                </article>

                <!-- Call to Action -->
                <div class="mt-12 pt-8 border-t border-border flex flex-col md:flex-row gap-4">
                    <a href="post.php" class="btn-primary flex-1 flex items-center justify-center gap-2">
                        <i data-lucide="camera"></i>
                        観察を始める
                    </a>
                    <a href="showcase.php" class="btn-secondary flex-1 flex items-center justify-center gap-2">
                        <i data-lucide="building-2"></i>
                        企業・自治体の方へ
                    </a>
                </div>

                <!-- 関連ガイド -->
                <div class="mt-10 pt-8 border-t border-border">
                    <h4 class="text-sm font-bold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i data-lucide="book-open" class="w-4 h-4"></i> もっと知る
                    </h4>
                    <div class="space-y-2">
                        <a href="guide/walking-brain-science.php" class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition group">
                            <span class="text-2xl">🧠</span>
                            <div class="flex-1">
                                <p class="text-sm font-bold group-hover:text-[var(--color-primary)] text-text">自然の中を歩くと脳に何が起きるのか？</p>
                                <p class="text-xs text-muted">散歩×生きもの観察の科学的エビデンス</p>
                            </div>
                            <i data-lucide="arrow-right" class="w-4 h-4 text-faint group-hover:text-[var(--color-primary)] transition"></i>
                        </a>
                        <a href="guide/steps-dementia-prevention.php" class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition group">
                            <span class="text-2xl">👟</span>
                            <div class="flex-1">
                                <p class="text-sm font-bold group-hover:text-[var(--color-primary)] text-text">1日9,800歩で認知症リスク51%減</p>
                                <p class="text-xs text-muted">JAMA Neurology大規模研究の全データ</p>
                            </div>
                            <i data-lucide="arrow-right" class="w-4 h-4 text-faint group-hover:text-[var(--color-primary)] transition"></i>
                        </a>
                        <a href="guide/nature-positive.php" class="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition group">
                            <span class="text-2xl">🌿</span>
                            <div class="flex-1">
                                <p class="text-sm font-bold group-hover:text-[var(--color-primary)] text-text">ネイチャーポジティブ完全ガイド</p>
                                <p class="text-xs text-muted">お散歩×観察×健康の全体像</p>
                            </div>
                            <i data-lucide="arrow-right" class="w-4 h-4 text-faint group-hover:text-[var(--color-primary)] transition"></i>
                        </a>
                    </div>
                </div>

            </div>

        </div>
    </section>

    <!-- Data Ethics & Data Sovereignty Policy -->
    <section class="py-12 px-6 story-section">
        <div class="max-w-3xl mx-auto">
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">
                <div class="flex items-center gap-3 mb-8">
                    <div class="w-12 h-12 rounded-xl bg-secondary-surface border border-[var(--color-secondary-surface)] flex items-center justify-center">
                        <i data-lucide="shield-check" class="w-6 h-6 text-[var(--color-secondary)]"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-text">データ倫理 & データ主権方針</h2>
                        <p class="text-sm text-muted">Data Ethics & Data Sovereignty Policy</p>
                    </div>
                </div>

                <div class="space-y-8 text-muted leading-relaxed">
                    <div>
                        <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
                            <i data-lucide="shield-alert" class="w-5 h-5 text-[var(--color-secondary)]"></i>
                            第三者へのデータ提供拒否
                        </h3>
                        <p>
                            ikimonは、ユーザーが投稿した観察データ（写真・位置情報・テキスト）を、
                            <strong>外部のAI企業やその他の第三者に提供・販売・ライセンス供与することは一切行いません</strong>。
                            また、AIクローラーやスクレイパーによる無断収集に対して、
                            技術的な保護措置（robots.txt、rate limiting、HTTPヘッダーブロック）を実施しています。
                            <strong>データの主権はユーザーとikimonコミュニティにあります。</strong>
                        </p>
                    </div>

                    <div>
                        <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
                            <i data-lucide="sparkles" class="w-5 h-5 text-[var(--color-accent)]"></i>
                            ikimon自身によるAI活用の将来ビジョン
                        </h3>
                        <p>
                            ikimonでは将来的に、コミュニティが作り上げた高精度な同定データを活用して、
                            <strong>AI同定機能の開発</strong>を計画しています。
                            つまり、みなさんの同定の一つひとつが、将来のAI同定の精度を支える「教師データ」になります。
                        </p>
                        <ul class="mt-2 space-y-1 text-muted text-sm">
                            <li>• データはikimonのサービス内でのみ使用され、外部に流出することはありません</li>
                            <li>• AI同定が実現しても、最終的な種名確定は引き続きコミュニティ合意で行います</li>
                            <li>• AIはあくまで「提案」を行い、人間が「確定」する——この原則は変わりません</li>
                        </ul>
                    </div>

                    <div>
                        <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
                            <i data-lucide="users" class="w-5 h-5 text-[var(--color-primary)]"></i>
                            コミュニティ合意による同定
                        </h3>
                        <p>
                            ikimonの種同定は、<strong>WE-Consensus（加重エビデンス合意）</strong>と呼ばれる
                            独自のアルゴリズムに基づいています。
                            現在のAI画像認識では近縁種の識別や幼虫・冬芽などの同定に精度が足りないため、
                            <strong>今の段階ではコミュニティの目利きの方が信頼性が高い</strong>のです。
                            将来的にikimonのデータでAIを訓練し、コミュニティとAIが協力して同定を行う世界を目指しています。
                        </p>
                    </div>

                    <div>
                        <h3 class="text-lg font-bold text-text mb-3 flex items-center gap-2">
                            <i data-lucide="lock" class="w-5 h-5 text-[var(--color-secondary)]"></i>
                            希少種データの保護
                        </h3>
                        <p>
                            レッドリスト該当種の詳細な位置情報は、密猟や乱獲を防ぐため、
                            <strong>自動的にマスキング</strong>されます。
                            公開APIやレポートでは精度を落としたデータのみが出力され、
                            GBIF（地球規模生物多様性情報機構）の推奨プラクティスに準拠しています。
                        </p>
                    </div>

                    <div class="p-4 bg-surface rounded-xl border border-border text-sm">
                        <p class="font-bold text-text mb-1">📋 技術的保護措置</p>
                        <ul class="space-y-1 text-muted">
                            <li>• <code class="text-xs bg-border px-1 rounded">robots.txt</code> によるAIクローラーブロック（GPTBot, CCBot等）</li>
                            <li>• 写真メタデータ（EXIF位置情報）の自動除去</li>
                            <li>• APIレートリミット（大量取得防止）</li>
                            <li>• 観察データのCC BY-NC 4.0ライセンス適用（商用利用不可）</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Founder Section -->
    <section class="py-12 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">

                <!-- Label -->
                <div class="mb-8">
                    <span class="text-xs font-bold tracking-wider uppercase text-muted">FOUNDER</span>
                </div>

                <!-- Profile row -->
                <div class="flex flex-col md:flex-row md:items-start gap-8">

                    <!-- Avatar -->
                    <div class="shrink-0 flex flex-col items-center md:items-start gap-3">
                        <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-4xl font-black text-white shadow-lg">
                            Y
                        </div>
                        <div class="text-center md:text-left">
                            <p class="text-lg font-black text-text">八巻 毅</p>
                            <p class="text-sm text-muted">代表 / CEO</p>
                            <p class="text-xs text-faint mt-0.5">IKIMON株式会社</p>
                        </div>
                    </div>

                    <!-- Message -->
                    <div class="flex-1 space-y-4 text-muted leading-relaxed">
                        <p>
                            ikimonは今、<strong class="text-text">私ひとりで作っています。</strong><br>
                            デザインも、コードも、データ設計も。浜松の自室から。
                        </p>
                        <p>
                            大量絶滅の時代と言われる今、約100万種の動植物が数十年のうちに絶滅すると言われています。
                            その危機感と向き合い続け、「市民の観察が科学になる」仕組みを作ることを選びました。
                        </p>
                        <p>
                            小さく始めることを恥じていません。<br>
                            <strong class="text-text">すべての人が生き物観察を楽しめる社会</strong>を作るために、今日も一歩ずつ動いています。
                        </p>

                        <!-- Contact & info -->
                        <div class="pt-4 border-t border-border space-y-2 text-sm">
                            <div class="flex items-center gap-2 text-muted">
                                <i data-lucide="map-pin" class="w-4 h-4 shrink-0 text-faint"></i>
                                <span>静岡県浜松市</span>
                            </div>
                            <div class="flex items-center gap-2 text-muted">
                                <i data-lucide="mail" class="w-4 h-4 shrink-0 text-faint"></i>
                                <a href="mailto:contact@ikimon.life" class="text-primary hover:underline">contact@ikimon.life</a>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Join CTA -->
                <div class="mt-8 pt-6 border-t border-border">
                    <p class="text-sm font-bold text-text mb-1">一緒に作りませんか？</p>
                    <p class="text-sm text-muted">エンジニア・デザイナー・自然が好きな人、どなたでも歓迎します。まずはメールで。</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
