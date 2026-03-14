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
        .diff-card {
            transition: transform 0.2s;
        }
        .diff-card:hover {
            transform: translateY(-2px);
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
                8年前の挑戦、4年間の原体験、そして「散歩と観察で世界を変える」という確信
            </p>
        </div>
    </section>

    <!-- Founder Story Section -->
    <section class="py-12 px-6 story-section">
        <div class="max-w-3xl mx-auto">

            <!-- Story Content -->
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">

                <!-- Founder Photo -->
                <div class="flex items-center gap-6 mb-8 pb-8 border-b border-border">
                    <img src="assets/img/yamaki.jpg" alt="八巻 毅" class="w-20 h-20 rounded-full object-cover shadow-md">
                    <div>
                        <h2 class="text-xl font-bold text-text">八巻 毅</h2>
                        <p class="text-sm text-muted">ikimon 創業者 / CEO</p>
                    </div>
                </div>

                <article class="prose prose-lg max-w-none space-y-6 text-muted leading-relaxed">

                    <h3 class="text-2xl font-bold text-text">はじまり：「ZUKAN」という挑戦</h3>
                    <p>
                        8年前、東京で「生きものを絶滅させない世の中」を目指す
                        生物プラットフォーム——<strong class="text-text">ZUKAN</strong>を構想し、プロトタイプを開発していました。
                        図鑑のように美しくて、SNSのように気軽で、記録としても長く残せるもの。
                        日経新聞社×noteのコラボサロン「Nサロン」でプレゼンテーションを行い、
                        チームを組んで事業として動き始めていました。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">転機：浜松への移住</h3>
                    <p>
                        4年前、浜松に移住しました。<br>
                        天竜川の河畔林、佐鳴湖の水鳥、三方原台地の里山——
                        東京では意識すらしなかった自然が、ここでは日常のすぐそばにあった。
                        朝の散歩で聞こえるウグイスの声、庭に飛んできたアゲハチョウ。
                        小さな発見の連続が、ZUKANで目指していたことを呼び覚ましました。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">地方の現実と、浜松の挑戦</h3>
                    <p>
                        暮らしていくうちに、地方が抱える課題も見えてきました。
                        人口減少と高齢化が進む中、自然環境の記録を担う人材がいない。
                        「何がどこにいるのか」すら分からないまま、開発計画が進んでいく。
                    </p>
                    <p>
                        一方で、浜松市は面白い挑戦をしていました。<br>
                        <strong class="text-text">浜松ウエルネス推進協議会</strong>は、
                        「予防・健幸都市」を掲げ、市民の健康と産業振興を同時に進めようとしている。
                        <strong class="text-text">生物多様性はままつ戦略2024</strong>では、
                        ネイチャーポジティブや30by30目標という国際的な枠組みを地域に落とし込もうとしていた。
                        市は未来を向いている。でも、それを支える記録の土台が足りない。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">確信：愛管での経験</h3>
                    <p>
                        決定的だったのは、愛管株式会社で<strong class="text-text">自然共生サイト</strong>に
                        関わった経験です。
                        企業や地域が「この場所に、どんな生きものがいたか」を振り返ろうとしても、
                        過去から現在までの観察記録が残っていない。そこに大きな空白がありました。
                    </p>
                    <p>
                        企業も自治体も、自然との関わり方をこれまで以上に言葉にする場面が増えている。
                        でも、その前提になる日々の観察記録を集めて、見返せる仕組みが存在しない。
                    </p>
                    <p>
                        <strong class="text-text">「このサービスは、今すぐ必要だ」</strong>——
                        そう確信しました。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">ikimon：ZUKANを受け継いで</h3>
                    <p>
                        かつて自ら構想し、プロトタイプまで作ったZUKAN事業を買い取り、
                        ikimonとしてリニューアルしました。<br>
                        美しい図鑑ではなく、まず「使える」ものを。
                        完璧を目指すのではなく、今日からデータが溜まり始めるものを。
                        市民の「見つけた！」を、その場で終わらない記録に変え、
                        地域のアーカイブにも、組織の自然のふり返りにもつながるものを。
                    </p>
                    <p>
                        デザインも、コードも、データベース設計も、全部ひとりで。
                        浜松の自室から。急いで作りました。<br>
                        完璧じゃないことは分かっています。
                        でも、<strong class="text-text">自然は待ってくれない</strong>。
                        毎日どこかで生態系が変わり、記録されないまま失われていく。
                        だから、動き出すことにしました。
                    </p>

                    <blockquote class="border-l-4 border-[var(--color-primary)] pl-6 my-8 italic text-xl text-text">
                        「8年前に始めた挑戦を、浜松の自然が再び目覚めさせた。<br>
                        完璧を待たない。自然は待ってくれないから。」
                    </blockquote>

                    <h3 class="text-2xl font-bold text-text mt-8">少しずつ、認めてもらえるように</h3>
                    <p>
                        ありがたいことに、この取り組みは少しずつ評価をいただいています。<br>
                        浜松市のスタートアップ支援プログラム<strong class="text-text">「HSI」に採択</strong>され、
                        <strong class="text-text">静岡県SDGsビジネスアワード</strong>でも賞をいただきました。
                        ひとりで始めたプロジェクトが、地域の文脈の中で意味を持ち始めている。
                        それが、何よりの励みです。
                    </p>

                    <h3 class="text-2xl font-bold text-text mt-8">ビジョン：自然と共に生きる社会へ</h3>
                    <p>
                        散歩をすることが健康になり、観察をすることが記録になり、
                        記録が地域や組織の自然との付き合い方を少しずつ変えていく。
                        ウェルネスと生物多様性が一本の線でつながる——
                        浜松からその実験を始めます。
                    </p>

                </article>

                <!-- Call to Action -->
                <div class="mt-12 pt-8 border-t border-border flex flex-col md:flex-row gap-4">
                    <a href="post.php" class="btn-primary flex-1 flex items-center justify-center gap-2">
                        <i data-lucide="camera"></i>
                        観察を始める
                    </a>
                    <a href="for-business/" class="btn-secondary flex-1 flex items-center justify-center gap-2">
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
                                <p class="text-xs text-muted">JAMA Neurologyの大規模研究をやさしく紹介</p>
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

    <!-- Why ikimon? -->
    <section class="py-12 px-6">
        <div class="max-w-3xl mx-auto">
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">

                <div class="flex items-center gap-3 mb-8">
                    <div class="w-12 h-12 rounded-xl bg-primary-surface border border-primary/20 flex items-center justify-center">
                        <i data-lucide="layers" class="w-6 h-6 text-[var(--color-primary)]"></i>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold text-text">ikimonが生まれた理由</h2>
                        <p class="text-sm text-muted">Why ikimon?</p>
                    </div>
                </div>

                <div class="space-y-6 text-muted leading-relaxed">
                    <p>
                        市民科学の世界には、すでに素晴らしいプラットフォームがいくつも存在しています。
                        数億件の観察データを集めたグローバルサービス、
                        AI同定とゲーミフィケーションで市民参加を広げた国内アプリ、
                        鳥類に特化した専門的なコミュニティ——
                        どれも市民科学の発展に大きく貢献してきた先駆者たちです。
                    </p>
                    <p>
                        ikimonは、それらの偉大な取り組みに敬意を持ちながら、
                        <strong class="text-text">まだ誰も手をつけていない領域</strong>に挑みます。
                    </p>
                </div>

                <!-- ikimonの独自性 -->
                <div class="mt-8 space-y-4">
                    <h3 class="text-lg font-bold text-text mb-4 flex items-center gap-2">
                        <i data-lucide="sparkles" class="w-5 h-5 text-[var(--color-accent)]"></i>
                        ikimonが切り拓く領域
                    </h3>

                    <!-- 世界初: ウェルネス × 生物多様性 -->
                    <div class="diff-card p-5 rounded-xl border-2 border-[var(--color-primary)] bg-primary-surface/30">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-0.5">
                                <span class="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-[var(--color-primary)] text-white">世界初</span>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text mb-2">ウェルネス × 生物多様性の統合</p>
                                <p class="text-sm text-muted">
                                    散歩の歩数記録、自然の中での滞在時間、観察による認知的エンゲージメント——
                                    ikimonは「自然観察が健康活動になる」という概念を世界で初めてプラットフォーム化しました。
                                    1日9,800歩で認知症リスク51%減（JAMA Neurology）、
                                    週120分の自然接触で幸福度が有意に向上（White et al. 2019）——
                                    これらの科学的エビデンスを、実際のサービスに落とし込んでいます。
                                </p>
                                <p class="text-xs text-faint mt-2">
                                    既存の市民科学プラットフォームに、ウェルネス機能を持つものは確認されていません。
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- データ主権 -->
                    <div class="diff-card p-5 rounded-xl border border-border bg-surface">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-1">
                                <i data-lucide="shield-check" class="w-5 h-5 text-[var(--color-secondary)]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text mb-2">明示的なデータ主権宣言</p>
                                <p class="text-sm text-muted">
                                    ikimonは、ユーザーの観察データを外部のAI企業に提供・販売しないことを明確に宣言しています。
                                    robots.txtによるAIクローラーブロック、EXIF位置情報の自動除去、
                                    CC BY-NC 4.0ライセンスの適用など、技術的な保護措置も実装済みです。
                                    データの主権はユーザーとコミュニティにあります。
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- WE-Consensus -->
                    <div class="diff-card p-5 rounded-xl border border-border bg-surface">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-1">
                                <i data-lucide="scale" class="w-5 h-5 text-[var(--color-primary)]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text mb-2">WE-Consensus：分類系列ベースの加重合意</p>
                                <p class="text-sm text-muted">
                                    多数決やAI任せではない、独自の同定アルゴリズムです。
                                    同定者の専門性や過去の実績に応じて重みを付け、
                                    さらに各同定を国際分類体系（GBIF / iNaturalist）で正規化した上で
                                    分類系列（Lineage）の整合性を自動チェックします。
                                    系列が矛盾する同定が混在すると衝突として検出され、
                                    解消されるまで記録の確からしさは上がりません。
                                    LCA（最小共通祖先）ベースの合意判定により、
                                    少人数のコミュニティでも高精度な同定を実現しています。
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- 企業 × 市民の一体型 -->
                    <div class="diff-card p-5 rounded-xl border border-border bg-surface">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-1">
                                <i data-lucide="building-2" class="w-5 h-5 text-[var(--color-accent)]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-text mb-2">市民参加と企業レポーティングの一体化</p>
                                <p class="text-sm text-muted">
                                    市民がゲーミフィケーションを楽しみながら記録した観察が、
                                    そのまま地域の自然アーカイブや組織のふり返りにもつながる——
                                    「楽しむ人」と「残したい人」が同じプラットフォーム上でつながる設計です。
                                    Shannon-Wiener多様度指数、Chao1推定種数、季節フェノロジーなどの
                                    科学的指標をリアルタイムで算出します。
                                </p>
                            </div>
                        </div>
                    </div>

                    <p class="text-sm text-muted mt-6">
                        ikimonは既存サービスと競合するのではなく、
                        <strong class="text-text">「まだ誰も埋めていない領域」</strong>を担います。
                        市民科学のエコシステム全体が豊かになることが、生物多様性の保全につながると信じています。
                    </p>
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
                            ikimonの種同定は、<strong>WE-Consensus（分類系列ベースの加重合意）</strong>と呼ばれる
                            独自のアルゴリズムに基づいています。
                            各同定は国際分類体系（GBIF / iNaturalist）に照合して正規化（canonical taxon 化）され、
                            LCA（最小共通祖先）ベースで合意を判定します。
                            分類系列が矛盾する同定は自動検出され、データの品質を守ります。
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
                        <p class="font-bold text-text mb-1">技術的保護措置</p>
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

    <!-- Team Section -->
    <section class="py-12 px-6" id="team">
        <div class="max-w-3xl mx-auto">
            <div class="glass-card rounded-[2rem] p-8 md:p-12 border border-border">

                <!-- Label -->
                <div class="mb-8">
                    <span class="text-xs font-bold tracking-wider uppercase text-muted">FOUNDER</span>
                </div>

                <!-- Profile row -->
                <div class="flex flex-col gap-8">

                    <!-- Photo -->
                    <div class="flex flex-col items-center gap-4">
                        <img src="assets/img/yamaki.jpg" alt="八巻 毅" class="w-full max-w-sm rounded-2xl object-cover shadow-lg aspect-[4/5]">
                        <div class="text-center">
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
                <div class="mt-10 pt-8 border-t border-border">
                    <h3 class="text-sm font-bold text-text mb-2">一緒に作りませんか？</h3>
                    <p class="text-sm text-muted mb-5">
                        以下のポジションを募集しています。自然が好きな方ならどなたでも歓迎します。
                    </p>
                    <div class="grid md:grid-cols-2 gap-3 mb-6">
                        <div class="p-4 rounded-xl border border-border bg-surface">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                    <i data-lucide="graduation-cap" class="w-5 h-5 text-purple-500"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-text">生態学・環境科学</p>
                                    <p class="text-xs text-muted">アドバイザー募集中</p>
                                </div>
                            </div>
                        </div>
                        <div class="p-4 rounded-xl border border-border bg-surface">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                    <i data-lucide="building-2" class="w-5 h-5 text-blue-500"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-text">ビジネス・サステナビリティ</p>
                                    <p class="text-xs text-muted">アドバイザー募集中</p>
                                </div>
                            </div>
                        </div>
                        <div class="p-4 rounded-xl border border-border bg-surface">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                    <i data-lucide="code" class="w-5 h-5 text-green-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-text">エンジニア・デザイナー</p>
                                    <p class="text-xs text-muted">開発メンバー募集中</p>
                                </div>
                            </div>
                        </div>
                        <div class="p-4 rounded-xl border border-border bg-surface">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                    <i data-lucide="binoculars" class="w-5 h-5 text-amber-600"></i>
                                </div>
                                <div>
                                    <p class="text-sm font-bold text-text">自然観察指導員・市民科学者</p>
                                    <p class="text-xs text-muted">コミュニティ募集中</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <a href="mailto:team@ikimon.life" class="btn-primary inline-flex items-center justify-center gap-2">
                        <i data-lucide="mail" class="w-4 h-4"></i>
                        お問い合わせ
                    </a>
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
