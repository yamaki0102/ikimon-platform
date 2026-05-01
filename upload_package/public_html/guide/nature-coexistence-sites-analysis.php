<?php
require_once __DIR__ . '/../../libs/Auth.php';
Auth::init();

$meta_title = '自然共生サイト569認定 完全分析｜都道府県・業種・活動類型マップ';
$meta_description = '環境省の自然共生サイト569認定をもとに、R5〜R7の認定動向、都道府県分布、企業参加、里山型サイト、認定後の運用フェーズまで整理。日本のネイチャーポジティブの現在地を数字で読む。';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <meta name="robots" content="noindex, nofollow">
    <style>
        .article-hero {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(6, 182, 212, 0.06) 50%, rgba(16, 185, 129, 0.04) 100%);
        }

        .evidence-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(59, 130, 246, 0.12);
            transition: all 0.3s ease;
        }

        .evidence-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(59, 130, 246, 0.1);
        }

        .stat-number {
            background: linear-gradient(135deg, #3b82f6, #06b6d4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .blockquote-accent {
            border-left: 4px solid #3b82f6;
            background: rgba(59, 130, 246, 0.04);
        }

        .cta-gradient {
            background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
        }

        .data-table th {
            background: rgba(59, 130, 246, 0.06);
            font-weight: 700;
            font-size: 12px;
            padding: 10px 12px;
            text-align: left;
            border-bottom: 2px solid rgba(59, 130, 246, 0.15);
        }

        .data-table td {
            font-size: 13px;
            padding: 10px 12px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .data-table tr:hover td {
            background: rgba(59, 130, 246, 0.02);
        }

        .bar-chart {
            display: flex;
            align-items: end;
            gap: 2px;
            height: 80px;
        }

        .bar-chart .bar {
            background: linear-gradient(to top, #3b82f6, #06b6d4);
            border-radius: 4px 4px 0 0;
            min-width: 20px;
            transition: all 0.3s;
        }
    </style>

    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": "自然共生サイト569認定 完全分析",
            "author": {
                "@type": "Person",
                "name": "八巻 毅"
            },
            "publisher": {
                "@type": "Organization",
                "name": "ikimon.life"
            },
            "datePublished": "2026-02-27",
            "dateModified": "2026-05-01"
        }
    </script>
    <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
                    "@type": "Question",
                    "name": "自然共生サイトとは？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "自然共生サイト（OECM: Other Effective area-based Conservation Measures）とは、国立公園以外で生物多様性の保全に貢献する区域を環境省が認定する制度です。30by30目標の達成に向け、企業・自治体・個人の土地を保全地域としてカウントします。"
                    }
                },
                {
                    "@type": "Question",
                    "name": "自然共生サイトは何サイト認定されている？",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "2026年3月17日時点で累計569サイトが認定されています。同日の環境省発表では108か所が追加認定され、自然共生サイト500以上の早期達成目標に到達しました。"
                    }
                }
            ]
        }
    </script>
</head>

<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">

    <?php include __DIR__ . '/../components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <nav class="pt-24 px-6">
        <div class="max-w-4xl mx-auto">
            <ol class="flex items-center gap-2 text-sm text-gray-400">
                <li><a href="../index.php" class="hover:text-[var(--color-primary)]">ホーム</a></li>
                <li>/</li>
                <li><a href="nature-positive.php" class="hover:text-[var(--color-primary)]">ガイド</a></li>
                <li>/</li>
                <li class="text-gray-600">自然共生サイト分析</li>
            </ol>
        </div>
    </nav>

    <section class="pt-8 pb-12 px-6 article-hero">
        <div class="max-w-4xl mx-auto">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-6">
                <i data-lucide="database" class="w-3.5 h-3.5"></i> Cluster 2 & 5: DATA
            </span>
            <h1 class="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-4">
                自然共生サイト<span class="stat-number">569認定</span><br>完全分析
            </h1>
            <p class="text-lg text-gray-500 mb-6">都道府県・業種・活動類型マップ｜日本のネイチャーポジティブの現在地</p>

            <div class="blockquote-accent rounded-xl p-6 mb-8">
                <p class="text-gray-700 leading-relaxed">
                    <strong>2023年の制度開始から3年で、569サイトが自然共生サイトに認定。</strong>
                    トヨタからNPO、個人の庭まで——日本全国で「30by30」が動き始めています。
                    全認定データを分析し、どんな企業が、どの地域で、どんな自然を守っているのかを解き明かします。
                </p>
            </div>

            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg font-black text-white">Y</div>
                <div>
                    <p class="text-sm font-bold">八巻 毅</p>
                    <p class="text-xs text-gray-400">ikimon 代表 / 自然共生サイト認定企業・愛管株式会社パートナー</p>
                    <p class="text-xs text-gray-400 mt-0.5">データソース: 環境省PDF / 報道発表 (R5-R7) ｜ 最終更新: 2026年5月1日</p>
                </div>
            </div>
        </div>
    </section>

    <section class="py-12 px-6">
        <div class="max-w-4xl mx-auto">
            <article class="prose prose-lg max-w-none space-y-12">

                <!-- 全体像 -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">認定数の推移：3年間の軌跡</h2>
                    <p class="text-sm text-gray-600 mb-4">
                        2026年3月17日の環境省発表で <strong>108か所が追加認定</strong>され、自然共生サイトは<strong>合計569か所</strong>になりました。
                        法施行後の認定回には旧制度サイトからの移行分も含まれるため、回別合計と公式総数は一致しません。対外説明では環境省公表の <strong>569</strong> を優先するのが安全です。
                    </p>
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>年度</th>
                                    <th>区分</th>
                                    <th>サイト数</th>
                                    <th>備考</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>R5 前期</td>
                                    <td>従前制度</td>
                                    <td class="font-bold">122</td>
                                    <td>2023年10月認定（制度スタート）</td>
                                </tr>
                                <tr>
                                    <td>R5 後期</td>
                                    <td>従前制度</td>
                                    <td class="font-bold">64</td>
                                    <td>2024年1月認定</td>
                                </tr>
                                <tr>
                                    <td>R6 前期</td>
                                    <td>従前制度</td>
                                    <td class="font-bold">71</td>
                                    <td>2024年6月認定</td>
                                </tr>
                                <tr>
                                    <td>R6 後期</td>
                                    <td>従前制度</td>
                                    <td class="font-bold">71</td>
                                    <td>2024年12月認定</td>
                                </tr>
                                <tr class="bg-blue-50/50">
                                    <td>R5-R6</td>
                                    <td>小計</td>
                                    <td class="font-black text-lg text-blue-700">328</td>
                                    <td></td>
                                </tr>
                                <tr>
                                    <td>R7 第1回</td>
                                    <td>増進法</td>
                                    <td class="font-bold">201</td>
                                    <td>2025年9月（新法化後初回）</td>
                                </tr>
                                <tr>
                                    <td>R7 第2回</td>
                                    <td>増進法</td>
                                    <td class="font-bold">58</td>
                                    <td>2025年12月（愛管含む）</td>
                                </tr>
                                <tr>
                                    <td>R7 第3回</td>
                                    <td>増進法</td>
                                    <td class="font-bold">108</td>
                                    <td>2026年3月17日認定</td>
                                </tr>
                                <tr class="bg-blue-50/50">
                                    <td>R7</td>
                                    <td>小計</td>
                                    <td class="font-black text-lg text-blue-700">367</td>
                                    <td>認定回ベース / 旧制度サイト移行を含む</td>
                                </tr>
                                <tr class="bg-blue-100/30">
                                    <td colspan="2"><strong>公式総数</strong></td>
                                    <td class="font-black text-2xl stat-number">569</td>
                                    <td>環境省公表値（2026年3月17日）</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 申請者タイプ -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">誰が認定を取っているのか：申請者タイプ分析</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">35%</p>
                            <p class="text-sm text-gray-600 mt-1">大企業（製造業）</p>
                            <p class="text-xs text-gray-400">トヨタ、サントリー、花王等</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">15%</p>
                            <p class="text-sm text-gray-600 mt-1">NPO・市民団体</p>
                            <p class="text-xs text-gray-400">トトロのふるさと基金等</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5 text-center">
                            <p class="text-3xl font-black stat-number">15%</p>
                            <p class="text-sm text-gray-600 mt-1">中小企業</p>
                            <p class="text-xs text-gray-400">愛管株式会社含む</p>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>タイプ</th>
                                    <th>割合</th>
                                    <th>代表例</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>大企業（製造）</td>
                                    <td>~35%</td>
                                    <td>トヨタ、サントリー、花王、日立、三菱電機</td>
                                </tr>
                                <tr>
                                    <td>大企業（不動産・建設）</td>
                                    <td>~12%</td>
                                    <td>三井不動産、大林組、竹中、清水建設</td>
                                </tr>
                                <tr>
                                    <td>NPO・市民団体</td>
                                    <td>~15%</td>
                                    <td>トトロのふるさと基金、宍塚の自然と歴史の会</td>
                                </tr>
                                <tr>
                                    <td><strong>中小企業</strong></td>
                                    <td><strong>~15%</strong></td>
                                    <td><strong>愛管株式会社</strong>、キラ星農園</td>
                                </tr>
                                <tr>
                                    <td>自治体</td>
                                    <td>~10%</td>
                                    <td>静岡県、仙台市、神戸市</td>
                                </tr>
                                <tr>
                                    <td>大学・教育</td>
                                    <td>~8%</td>
                                    <td>北海道大学、東京農工大学、慶應義塾</td>
                                </tr>
                                <tr>
                                    <td>個人</td>
                                    <td>~5%</td>
                                    <td>個人所有林・庭園</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 活動類型 -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">何を守っているのか：活動類型分析</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                        <div class="evidence-card rounded-2xl p-5">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-bold text-sm">維持</span>
                                <span class="text-2xl font-black stat-number">87%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-3">
                                <div class="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full" style="width: 87%"></div>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">既存の自然環境を維持管理</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-bold text-sm">回復</span>
                                <span class="text-xl font-black stat-number">7%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-3">
                                <div class="bg-gradient-to-r from-emerald-500 to-green-400 h-3 rounded-full" style="width: 7%"></div>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">損なわれた自然を再生</p>
                        </div>
                        <div class="evidence-card rounded-2xl p-5">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-bold text-sm">創出</span>
                                <span class="text-xl font-black stat-number">6%</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-3">
                                <div class="bg-gradient-to-r from-violet-500 to-purple-400 h-3 rounded-full" style="width: 6%"></div>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">新たに自然を創り出す</p>
                        </div>
                    </div>
                </div>

                <!-- 静岡県 -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">【静岡県】全認定サイト一覧</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">
                        ikimon.lifeの本拠地・静岡県の全認定サイト。浜松市では<strong>愛管株式会社「連理の木の下で」が唯一の企業敷地認定</strong>です。
                    </p>
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>サイト名</th>
                                    <th>申請者</th>
                                    <th>市町村</th>
                                    <th>認定</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>しずぎんの森</td>
                                    <td>しずおかFG</td>
                                    <td>静岡市</td>
                                    <td>R6→R7-1</td>
                                </tr>
                                <tr>
                                    <td>御前崎港 久々生海岸</td>
                                    <td>NPO Earth Communication</td>
                                    <td>御前崎市</td>
                                    <td>R7-1</td>
                                </tr>
                                <tr>
                                    <td>榛原ふるさとの森</td>
                                    <td>静岡県</td>
                                    <td>牧之原市</td>
                                    <td>R7-1</td>
                                </tr>
                                <tr>
                                    <td>サントリー天然水の森 しずおか小山</td>
                                    <td>サントリーHD</td>
                                    <td>小山町</td>
                                    <td>R5→R7-1</td>
                                </tr>
                                <tr>
                                    <td>豊田合成「睦実の里」里山</td>
                                    <td>豊田合成</td>
                                    <td>森町</td>
                                    <td>R5→R7-1</td>
                                </tr>
                                <tr>
                                    <td>三菱電機 静岡製作所よりみち緑地</td>
                                    <td>三菱電機</td>
                                    <td>静岡市</td>
                                    <td>R7-2</td>
                                </tr>
                                <tr class="bg-cyan-50/50 font-bold">
                                    <td>連理の木の下で</td>
                                    <td>愛管株式会社</td>
                                    <td>浜松市</td>
                                    <td>R7-2</td>
                                </tr>
                                <tr>
                                    <td>富士フイルム 癒しの小径</td>
                                    <td>富士フイルムHD</td>
                                    <td>富士宮市</td>
                                    <td>R7-2</td>
                                </tr>
                                <tr>
                                    <td>ヤマハ発動機 コミュニケーションプラザ</td>
                                    <td>ヤマハ発動機</td>
                                    <td>磐田市</td>
                                    <td>R5</td>
                                </tr>
                                <tr>
                                    <td>積水ハウス 日本の原風景の森林</td>
                                    <td>積水ハウス</td>
                                    <td>裾野市</td>
                                    <td>R5</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h2 class="text-2xl font-bold mb-6">認定後はいま何が起きているか</h2>
                    <div class="evidence-card rounded-2xl p-6">
                        <p class="text-gray-700 leading-relaxed mb-4">
                            2026年春の現行制度では、自然共生サイトは <strong>認定を取って終わり</strong> ではありません。環境省の支援制度ページでは、認定後の
                            <strong>支援マッチング</strong> と <strong>支援証明書</strong> を含む運用フェーズが前面に出ています。
                        </p>
                        <ul class="text-sm text-gray-600 space-y-2 list-disc pl-5">
                            <li>令和7年度の支援マッチング・支援証明書の受付は終了済み</li>
                            <li>次の情報掲載は令和7年8月から令和8年3月中旬予定</li>
                            <li>認定site側は、モニタリング、研修受入、成果発信、支援獲得の設計が主戦場</li>
                        </ul>
                        <p class="text-xs text-gray-500 mt-4">
                            つまり、愛管のような認定済みsiteの説明では「申請支援」より「運用伴走・支援設計・モニタリング設計」を front に置く方が現行制度と整合します。
                        </p>
                    </div>
                </div>

                <!-- 里山 -->
                <div>
                    <h2 class="text-2xl font-bold mb-6">注目：里山型サイトの広がり</h2>
                    <p class="text-gray-700 leading-relaxed mb-6">
                        Satoyama Initiativeの国際的評価を受け、里山型の自然共生サイトが全国で認定を受けています。
                        これらは「人が手入れし続けることで維持される自然」——まさにikimonが提唱する<strong>「歩いて、見て、守る」</strong>の実践フィールドです。
                    </p>
                    <div class="overflow-x-auto">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>サイト名</th>
                                    <th>申請者</th>
                                    <th>所在地</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>宍塚の里山</td>
                                    <td>NPO宍塚の自然と歴史の会</td>
                                    <td>茨城県土浦市</td>
                                </tr>
                                <tr>
                                    <td>トトロの森</td>
                                    <td>トトロのふるさと基金</td>
                                    <td>埼玉県所沢市</td>
                                </tr>
                                <tr>
                                    <td>三富今昔村</td>
                                    <td>石坂産業</td>
                                    <td>埼玉県三芳町</td>
                                </tr>
                                <tr>
                                    <td>山梨中銀ふれあいの里山</td>
                                    <td>山梨中央銀行</td>
                                    <td>山梨県中央市</td>
                                </tr>
                                <tr class="bg-cyan-50/50 font-bold">
                                    <td>連理の木の下で</td>
                                    <td>愛管株式会社</td>
                                    <td>静岡県浜松市</td>
                                </tr>
                                <tr>
                                    <td>神戸の里山林・棚田</td>
                                    <td>神戸市</td>
                                    <td>兵庫県神戸市</td>
                                </tr>
                                <tr>
                                    <td>奄美大島 真米の里</td>
                                    <td>奄美稲作保存会</td>
                                    <td>鹿児島県龍郷町</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- FAQ -->
                <div id="faq" class="mt-12">
                    <h2 class="text-2xl font-bold mb-8">よくある質問</h2>
                    <div class="space-y-4">
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. 自然共生サイトは何サイト認定されている？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">2026年3月17日時点で累計569サイトです。環境省は同日の第3回認定で108か所を追加し、「早期に500以上認定する」目標を達成しました。</div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. 中小企業でも申請できる？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">はい。全認定の約15%が中小企業です。愛管株式会社（浜松市）は約1.3haの敷地で認定を取得しました。<a href="aikan-renri-report.php" class="text-blue-600 hover:underline">→ 詳しい体験談</a></div>
                        </details>
                        <details class="evidence-card rounded-2xl overflow-hidden">
                            <summary class="p-5 font-bold cursor-pointer hover:bg-gray-50">Q. 認定後は何を進める段階なの？</summary>
                            <div class="px-5 pb-5 text-sm text-gray-600">現行の制度運用では、認定後にモニタリング、支援マッチング、支援証明書、研修受入、成果発信をどう回すかが重要です。令和7年度の支援受付は終了済みですが、次年度スケジュールは環境省ページで案内されています。</div>
                        </details>
                    </div>
                </div>

            </article>

            <div class="mt-16 glass-card rounded-[2rem] p-8 md:p-12 border border-gray-200 text-center">
                <h3 class="text-2xl font-bold mb-4">あなたの観察がデータになる</h3>
                <p class="text-gray-500 mb-8 max-w-lg mx-auto">ikimonで生きものを記録。あなたの観察が、自然共生サイトのモニタリングや市民科学に貢献します。</p>
                <div class="flex flex-col sm:flex-row justify-center gap-4">
                    <a href="../post.php" class="cta-gradient text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"><i data-lucide="camera" class="w-5 h-5"></i>観察を始める</a>
                    <a href="aikan-renri-report.php" class="bg-gray-100 text-gray-700 font-bold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"><i data-lucide="file-text" class="w-5 h-5"></i>認定体験レポート</a>
                </div>
            </div>

            <div class="mt-16">
                <h3 class="text-xl font-bold mb-6">関連記事</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="what-is-nature-positive.php" class="evidence-card rounded-2xl p-5 block"><span class="text-xs text-emerald-600 font-bold">Cluster 1</span>
                        <p class="font-bold text-sm mt-2">ネイチャーポジティブとは？完全解説</p>
                    </a>
                    <a href="aikan-renri-report.php" class="evidence-card rounded-2xl p-5 block"><span class="text-xs text-cyan-600 font-bold">Cluster 5</span>
                        <p class="font-bold text-sm mt-2">愛管「連理の木の下で」認定レポート</p>
                    </a>
                    <a href="walking-brain-science.php" class="evidence-card rounded-2xl p-5 block"><span class="text-xs text-emerald-600 font-bold">Cluster 1</span>
                        <p class="font-bold text-sm mt-2">自然の中を歩くと脳に何が起きるのか？</p>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>
</body>

</html>
