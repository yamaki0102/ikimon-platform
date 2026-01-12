<?php
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>企業・自治体の方へ - ikimon</title>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] overflow-x-hidden selection:bg-[var(--color-primary)] selection:text-black">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script>document.body.classList.remove('js-loading');</script>

    <!-- Background Effects -->
    <div class="fixed inset-0 pointer-events-none z-0">
        <div class="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-[var(--color-primary)]/10 rounded-full blur-3xl opacity-40 mix-blend-screen animate-pulse" style="animation-duration: 10s"></div>
        <div class="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl opacity-30 mix-blend-screen"></div>
        <div class="absolute top-[40%] left-[20%] w-[400px] h-[400px] bg-[var(--color-secondary)]/5 rounded-full blur-3xl opacity-20 mix-blend-screen"></div>
    </div>

    <!-- Hero Section -->
    <section class="relative pt-40 pb-32 px-6 z-10 min-h-screen flex flex-col justify-center items-center">
        <div class="text-center max-w-7xl mx-auto">
            <div class="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-12 animate-up opacity-0" style="animation-delay: 0.1s">
                <span class="relative flex h-3 w-3">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span class="text-sm font-bold tracking-widest uppercase text-emerald-400 font-brand">For Enterprise & CSR</span>
            </div>
            
            <h1 class="text-5xl md:text-8xl font-black mb-10 tracking-tight leading-[1.1] animate-up opacity-0" style="animation-delay: 0.3s">
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">自然資本を、</span><br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 text-glow-green">誇り</span>に変える。
            </h1>
            
            <p class="text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto mb-16 leading-relaxed font-bold animate-up opacity-0" style="animation-delay: 0.5s">
                TNFD対応から社有林の価値化まで。<br>
                「ikimon」は市民参加型データで、御社の環境アクションに<br>
                <span class="text-white border-b-2 border-emerald-500/50">確かな物語</span>と<span class="text-white border-b-2 border-cyan-500/50">科学的根拠</span>を与えます。
            </p>
            
            <div class="flex flex-col md:flex-row items-center justify-center gap-6 animate-up opacity-0" style="animation-delay: 0.7s">
                <a href="showcase.php" class="group relative px-10 py-5 bg-white text-black rounded-full font-black text-lg transition hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] flex items-center gap-3">
                    <div class="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition rounded-full blur-xl -z-10"></div>
                    <i data-lucide="play-circle" class="w-6 h-6"></i>
                    体験デモを見る
                </a>
                <a href="#contact" class="px-10 py-5 rounded-full border border-white/20 hover:bg-white/10 transition font-bold text-lg flex items-center gap-3 bg-black/20 backdrop-blur-md">
                    <i data-lucide="calendar" class="w-5 h-5"></i>
                    資料請求・相談
                </a>
            </div>
        </div>

        <!-- Scroll Indicator -->
        <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50 animate-bounce">
            <span class="text-[10px] uppercase tracking-widest">Scroll</span>
            <i data-lucide="chevron-down" class="w-5 h-5"></i>
        </div>
    </section>

    <!-- Value Proposition (Grid) -->
    <section class="relative py-32 px-6 z-10 bg-gradient-to-b from-transparent to-[#05070a]/80">
        <div class="max-w-6xl mx-auto">
            <div class="grid md:grid-cols-2 gap-16 items-center">
                <!-- Text -->
                <div class="space-y-12">
                    <h2 class="text-3xl md:text-5xl font-black leading-tight">
                        担当者様の<span class="text-emerald-400">「頑張り」</span>が、<br>
                        正しく評価される世界へ。
                    </h2>
                    <p class="text-lg text-gray-400 leading-relaxed font-bold">
                        環境活動は、もはや「コスト」ではありません。<br>
                        それは企業価値を高める最大の「資産」です。<br><br>
                        しかし、その成果は今まで見えにくいものでした。<br>
                        ikimonは、誰でもわかる直感的なビジュアルと、<br>
                        国際基準に耐えうるデータで、あなたの成果を証明します。
                    </p>
                    
                    <ul class="space-y-6">
                        <li class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
                                <i data-lucide="file-check" class="w-6 h-6 text-emerald-400"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold mb-1 text-white">TNFDレポート自動生成</h3>
                                <p class="text-sm text-gray-400">複雑な開示作業から解放されます。ワンクリックで投資家向け資料が完成。</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
                                <i data-lucide="users" class="w-6 h-6 text-blue-400"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold mb-1 text-white">地域とのエンゲージメント</h3>
                                <p class="text-sm text-gray-400">社員や地域住民が「楽しみながら」調査に参加。愛着と誇りが生まれます。</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-4">
                            <div class="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 border border-purple-500/30">
                                <i data-lucide="activity" class="w-6 h-6 text-purple-400"></i>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold mb-1 text-white">リアルタイム効果測定</h3>
                                <p class="text-sm text-gray-400">「生物多様性スコア」で、活動の進捗を毎月定量モニタリング。</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <!-- Visual -->
                <div class="relative">
                    <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-3xl blur-2xl -z-10"></div>
                    <div class="glass-card p-8 rounded-3xl border border-white/10 relative overflow-hidden">
                        <div class="flex justify-between items-center mb-8">
                            <div class="flex items-center gap-3">
                                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <div class="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <span class="text-xs font-mono text-gray-500">ikimon_dashboard_preview.exe</span>
                        </div>
                        
                        <!-- Mock Dashboard UI -->
                        <div class="space-y-6">
                            <div class="flex gap-4">
                                <div class="w-1/3 h-32 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex flex-col justify-center items-center p-4">
                                    <span class="text-emerald-400 text-xs font-bold uppercase mb-2">Score</span>
                                    <span class="text-4xl font-black text-white">A+</span>
                                </div>
                                <div class="w-2/3 h-32 rounded-xl bg-white/5 border border-white/10 p-4 relative overflow-hidden">
                                    <div class="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-blue-500/20 to-transparent"></div>
                                    <div class="flex items-end gap-2 h-full pb-2 px-2">
                                        <div class="w-1/5 bg-blue-500/50 h-[40%] rounded-t-sm"></div>
                                        <div class="w-1/5 bg-blue-500/50 h-[60%] rounded-t-sm"></div>
                                        <div class="w-1/5 bg-blue-500/50 h-[50%] rounded-t-sm"></div>
                                        <div class="w-1/5 bg-blue-500/50 h-[80%] rounded-t-sm"></div>
                                        <div class="w-1/5 bg-emerald-500 h-[95%] rounded-t-sm shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="h-48 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
                                <i data-lucide="map" class="w-12 h-12 opacity-20"></i>
                                <div class="absolute inset-0 bg-[url('https://api.mapbox.com/styles/v1/mapbox/dark-v10/static/137.7,34.7,12/600x400?access_token=pk.xxx')] bg-cover opacity-50 mix-blend-overlay"></div>
                                <!-- Particles -->
                                <div class="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]"></div>
                                <div class="absolute top-1/3 left-1/3 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Pricing (V3 Official Model) -->
    <section class="py-32 px-6 bg-gradient-to-b from-transparent to-blue-500/5">
        <div class="max-w-6xl mx-auto">
            <h2 class="text-4xl font-black text-center mb-6">シンプルで、力強い料金体系</h2>
            <p class="text-gray-400 text-center mb-16 text-lg">
                複雑なオプションはありません。<br>
                1つのプランで、全ての機能をお使いいただけます。
            </p>
            
            <div class="grid md:grid-cols-2 gap-8 items-stretch">
                <!-- Single Plan -->
                <div class="glass-card p-10 rounded-3xl border border-white/10 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition">
                        <i data-lucide="sprout" class="w-40 h-40"></i>
                    </div>
                    
                    <div class="relative z-10">
                        <h3 class="text-2xl font-bold mb-2 text-white">自然共生サイト認定プラン</h3>
                        <p class="text-sm text-gray-400 mb-8">企業・団体様向け (直接契約)</p>
                        
                        <div class="flex items-baseline gap-2 mb-10">
                            <span class="text-6xl font-black text-white">¥100,000</span>
                            <span class="text-xl text-gray-500">/年 (税別)</span>
                        </div>
                        
                        <div class="space-y-6">
                            <p class="font-bold text-white border-b border-white/10 pb-2">含まれるすべての機能:</p>
                            <ul class="grid grid-cols-1 gap-4 text-sm text-gray-300">
                                <li class="flex items-center gap-3"><i data-lucide="check-circle" class="text-emerald-400"></i> <span class="text-white font-bold">CSRショーケース (専用ページ)</span></li>
                                <li class="flex items-center gap-3"><i data-lucide="check-circle" class="text-emerald-400"></i> <span class="text-white font-bold">TNFD/OECM申請レポート生成</span></li>
                                <li class="flex items-center gap-3"><i data-lucide="check" class="text-emerald-500"></i> イベント作成・参加者管理機能</li>
                                <li class="flex items-center gap-3"><i data-lucide="check" class="text-emerald-500"></i> 担当者権限 (連絡先編集)</li>
                                <li class="flex items-center gap-3"><i data-lucide="check" class="text-emerald-500"></i> 公式サイトへの埋め込み (Embed)</li>
                            </ul>
                            <p class="text-xs text-gray-500 mt-4">* 2サイト目以降: ¥50,000/年</p>
                        </div>
                    </div>
                    
                    <a href="#contact" class="block w-full text-center py-4 rounded-xl bg-white text-black font-black mt-10 hover:bg-gray-200 transition">
                        導入を相談する
                    </a>
                </div>

                <!-- Agency Model (KEY) -->
                <div class="glass-card p-10 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-900/20 to-transparent relative overflow-hidden">
                    <div class="absolute -top-12 -right-12 w-40 h-40 bg-blue-500 rounded-full blur-[80px] opacity-30"></div>
                    
                    <div class="relative z-10 h-full flex flex-col">
                        <div class="flex items-center gap-3 mb-4">
                            <span class="px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-black uppercase tracking-wider">Partner</span>
                            <h3 class="text-2xl font-bold text-blue-400">パートナー・代理店制度</h3>
                        </div>
                        
                        <p class="text-2xl font-black text-white mb-6 leading-tight">
                            環境コンサル・自治体ご担当者様へ。<br>
                            「ikimon」を武器にしませんか？
                        </p>
                        
                        <p class="text-gray-400 mb-8 leading-relaxed">
                            複数のクライアントやサイトを管理される場合、<br>
                            パートナーアカウントでの一括管理が圧倒的に有利です。
                        </p>
                        
                        <div class="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20 mb-auto">
                            <h4 class="font-bold text-white mb-4 flex items-center gap-2">
                                <i data-lucide="briefcase" class="w-4 h-4 text-blue-400"></i>
                                パートナーメリット
                            </h4>
                            <ul class="space-y-4">
                                <li class="flex gap-3 text-sm text-gray-300">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0"></span>
                                    <span>
                                        <strong class="text-white block">2サイト目から半額適用</strong>
                                        複数顧客を抱える実質コストを大幅に削減
                                    </span>
                                </li>
                                <li class="flex gap-3 text-sm text-gray-300">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0"></span>
                                    <span>
                                        <strong class="text-white block">統合ダッシュボード</strong>
                                        全クライアントの状況を1画面でモニタリング
                                    </span>
                                </li>
                                <li class="flex gap-3 text-sm text-gray-300">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0"></span>
                                    <span>
                                        <strong class="text-white block">請求書の一括発行</strong>
                                        事務作業の煩雑さを解消
                                    </span>
                                </li>
                            </ul>
                        </div>
                        
                        <a href="mailto:partner@ikimon.life" class="block w-full text-center py-4 rounded-xl border border-blue-500 text-blue-400 font-black mt-8 hover:bg-blue-500 hover:text-white transition">
                            パートナー制度について聞く
                        </a>
                    </div>
                </div>
            </div>
            
            <p class="text-center text-xs text-gray-500 mt-12">
                ※ 価格はすべて税別表示です。最低契約期間は1年間となります。<br>
                ※ 大規模なカスタマイズが必要な場合は別途「エンタープライズ」としてご相談可能です。
            </p>
        </div>
    </section>

    <!-- CTA -->
    <section id="contact" class="py-32 px-6">
        <div class="max-w-4xl mx-auto glass-card rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden border border-emerald-500/30">
            <div class="absolute inset-0 bg-gradient-to-t from-emerald-900/40 to-transparent"></div>
            
            <div class="relative z-10">
                <h2 class="text-4xl md:text-5xl font-black mb-8">まずは、現場を見に行きませんか？</h2>
                <p class="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
                    御社の敷地に、どんな「宝物」が眠っているか。<br>
                    ikimonチームが無料で一次診断を行います。
                </p>
                <div class="flex flex-col md:flex-row gap-6 justify-center">
                    <a href="mailto:contact@ikimon.life" class="px-12 py-5 bg-white text-black rounded-full font-black text-lg hover:scale-105 transition flex items-center justify-center gap-2">
                        <i data-lucide="mail"></i> 無料診断を申し込む
                    </a>
                </div>
                <p class="mt-8 text-sm text-gray-500">※現在、浜松市・磐田市エリア限定キャンペーン中</p>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <?php include __DIR__ . '/components/footer.php'; ?>

    <script>
        lucide.createIcons();
    </script>
    <style>
        .text-glow-green { text-shadow: 0 0 30px rgba(16, 185, 129, 0.6); }
        .font-brand { font-family: 'Montserrat', sans-serif; }
    </style>
</body>
</html>
```
