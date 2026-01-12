<?php
// Dashboard System Architecture & Logic View
?>
<div class="p-8 h-full overflow-y-auto custom-scrollbar pb-20">
    
    <!-- Hero Section -->
    <div class="mb-12 animate-fade-in-up">
        <div class="flex items-center gap-3 mb-4">
            <div class="p-3 bg-green-500/20 rounded-xl text-green-400">
                <i data-lucide="cpu" class="w-8 h-8"></i>
            </div>
            <div>
                <h1 class="text-3xl font-black text-white font-heading tracking-wide">デジタルツイン アーキテクチャ</h1>
                <p class="text-gray-400 font-mono text-sm">システム構成と環境価値算出ロジック</p>
            </div>
        </div>
        <p class="text-gray-300 max-w-3xl leading-relaxed">
            本システムは、市民参加型生物データプラットフォーム「ikimon」と、3D空間情報（オープンデータまたは実測点群）を統合し、
            環境価値（CO2吸収量・生物多様性）をリアルタイムに可視化するデジタルツイン基盤です。
        </p>
    </div>

    <!-- 1. System Integration Flow -->
    <div class="mb-16 animate-fade-in-up" style="animation-delay: 0.1s;">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-blue-500 pl-4">
            1. データ連携フロー
        </h2>
        
        <div class="glass-panel-premium p-8 rounded-2xl relative overflow-hidden">
            <!-- Background Grid -->
            <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            <div class="relative z-10 grid grid-cols-1 md:grid-cols-7 gap-4 items-stretch text-center">
                
                <!-- Input Column -->
                <div class="md:col-span-2 flex flex-col gap-4">
                    <div class="bg-gray-800/80 p-4 rounded-xl border border-white/10 flex flex-col items-center justify-center h-full">
                        <div class="text-green-500 mb-2"><i data-lucide="smartphone" class="w-8 h-8"></i></div>
                        <h3 class="font-bold text-white mb-1">ikimon プラットフォーム</h3>
                        <p class="text-xs text-gray-400">生物分布・植生種データ<br>(市民・専門家による同定)</p>
                    </div>
                </div>

                <!-- Plus Icon -->
                <div class="flex items-center justify-center text-gray-500 md:col-span-1">
                    <i data-lucide="plus" class="w-6 h-6"></i>
                </div>

                <!-- Input Column (3D) -->
                <div class="md:col-span-2 flex flex-col gap-4">
                    <!-- Standard -->
                    <div class="bg-blue-900/40 p-4 rounded-xl border border-blue-500/30 flex flex-col items-center justify-center flex-1">
                        <span class="text-[10px] text-blue-300 font-bold mb-1">標準 (Standard)</span>
                        <h3 class="font-bold text-white mb-1">オープンデータ</h3>
                        <p class="text-xs text-blue-200">PLATEAU / OSM<br>(地形・建物モデル)</p>
                    </div>
                    <!-- OR -->
                    <div class="text-[10px] text-gray-500 font-mono">- OR -</div>
                    <!-- Pro -->
                    <div class="bg-purple-900/40 p-4 rounded-xl border border-purple-500 flex flex-col items-center justify-center flex-1 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                        <span class="text-[10px] text-purple-300 font-bold mb-1 flex items-center gap-1"><i data-lucide="scan" class="w-3 h-3"></i> Pro プラン</span>
                        <h3 class="font-bold text-white mb-1">3Dスキャナ</h3>
                        <p class="text-xs text-purple-200">LiDAR / Photogrammetry<br>(高精度 点群データ)</p>
                    </div>
                </div>

                <!-- Arrow Icon -->
                <div class="flex items-center justify-center text-gray-500 md:col-span-1">
                    <i data-lucide="arrow-right" class="w-6 h-6"></i>
                </div>

                <!-- Output Engine -->
                <div class="md:col-span-1 flex flex-col">
                    <div class="bg-gradient-to-br from-green-900 to-gray-900 p-1 rounded-xl shadow-lg h-full p-[2px]">
                        <div class="bg-gray-900 h-full w-full rounded-[10px] flex flex-col items-center justify-center p-4 relative overflow-hidden">
                            <div class="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                            <div class="relative z-10">
                                <i data-lucide="cpu" class="w-8 h-8 text-green-500 mb-2 mx-auto"></i>
                                <h3 class="font-bold text-white text-sm leading-tight">解析エンジン</h3>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- 2. Calculation Logic -->
    <div class="mb-16 animate-fade-in-up" style="animation-delay: 0.2s;">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-green-500 pl-4">
            2. CO2吸収量 算出ロジック
        </h2>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Left: Formula -->
            <div class="glass-panel-premium p-8 rounded-2xl">
                <p class="text-sm text-gray-300 mb-6">
                    環境省・林野庁が公表する「森林の二酸化炭素吸収量の算定方法」に準拠し、以下の計算式を用いて算出しています。
                </p>
                
                <div class="bg-black/40 p-6 rounded-xl border border-white/10 mb-6">
                    <div class="font-mono text-center">
                        <div class="text-2xl font-black text-white mb-2">A <span class="text-gray-500 mx-2">×</span> C <span class="text-gray-500 mx-2">=</span> CO2</div>
                        <div class="flex justify-center gap-8 text-xs text-gray-400">
                            <div class="text-center"><span class="block text-green-400 font-bold text-sm">A (面積)</span>植栽面積 (ha)</div>
                            <div class="text-center"><span class="block text-blue-400 font-bold text-sm">C (係数)</span>吸収係数</div>
                            <div class="text-center"><span class="block text-white font-bold text-sm">CO2</span>吸収量 (t-CO2)</div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="flex gap-4 items-start">
                        <div class="w-8 h-8 rounded bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 font-bold">A</div>
                        <div>
                            <h4 class="font-bold text-white">植栽面積・体積の特定</h4>
                            <p class="text-xs text-gray-400 leading-relaxed mt-1">
                                <span class="text-blue-300">STANDARD:</span> 2D地図上の緑地ポリゴン面積を使用。<br>
                                <span class="text-purple-300">PRO:</span> 3D点群データから樹木ごとの「葉張り体積」を精密計測。
                            </p>
                        </div>
                    </div>
                    <div class="flex gap-4 items-start">
                        <div class="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 font-bold">C</div>
                        <div>
                            <h4 class="font-bold text-white">吸収係数の適用</h4>
                            <p class="text-xs text-gray-400 leading-relaxed mt-1">
                                ikimonで同定された種別情報に基づき、適切な係数を適用。<br>
                                (例: 広葉樹=8.5t, 針葉樹=吸収率低, 芝生=...等)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right: Reliability -->
            <div class="glass-panel-premium p-8 rounded-2xl flex flex-col justify-center">
                <h3 class="font-bold text-white mb-4">信頼性の担保</h3>
                <ul class="space-y-4">
                    <li class="flex items-start gap-3">
                        <i data-lucide="check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"></i>
                        <div>
                            <strong class="block text-white text-sm">公的係数の採用</strong>
                            <p class="text-xs text-gray-400">林野庁「森林吸収量算出の係数」およびIPCCガイドラインを参照値として使用し、恣意的な過大評価を防ぎます。</p>
                        </div>
                    </li>
                    <li class="flex items-start gap-3">
                        <i data-lucide="check-circle" class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"></i>
                        <div>
                            <strong class="block text-white text-sm">エビデンスの透明性</strong>
                            <p class="text-xs text-gray-400">算出の元となった「個々の観測データ（写真・日時・場所）」は全てikimon上に記録され、いつでも監査可能です。</p>
                        </div>
                    </li>
                </ul>
                <div class="mt-8 pt-6 border-t border-white/10">
                    <a href="https://www.rinya.maff.go.jp/" target="_blank" class="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition group">
                        <div class="flex items-center gap-3">
                            <i data-lucide="external-link" class="text-gray-400"></i>
                            <div>
                                <div class="text-xs text-gray-400">参考資料</div>
                                <div class="text-sm font-bold text-white">林野庁 公式サイト / Forestry Agency</div>
                            </div>
                        </div>
                        <i data-lucide="chevron-right" class="text-gray-500 group-hover:translate-x-1 transition"></i>
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- 3. Efficiency & Feasibility -->
    <div class="mb-16 animate-fade-in-up" style="animation-delay: 0.3s;">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-purple-500 pl-4">
            3. 実務負荷の軽減
        </h2>
        
        <div class="glass-panel-premium p-8 rounded-2xl relative overflow-hidden">
             <!-- Background Texture -->
             <div class="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-green-500/10 to-transparent pointer-events-none"></div>

             <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                     <h3 class="text-xl font-bold text-white mb-4">「サンプリング法」で効率化</h3>
                     <p class="text-sm text-gray-300 leading-relaxed mb-6">
                        全数調査は不要です。標準機能では「面積 × 係数」の簡易算定を使用。<br>
                        より精度を求めたい場合のみ、3Dデータの活用を選択できます。
                     </p>
                     
                     <div class="flex flex-col gap-4">
                         <!-- Unified Pro Workflow -->
                         <div class="p-6 rounded-xl bg-gradient-to-br from-purple-900/40 to-gray-900 border border-purple-500/30 shadow-lg relative overflow-hidden group">
                            <div class="flex items-start gap-4 mb-4">
                                <div class="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="scan-line" class="w-6 h-6"></i>
                                </div>
                                <div>
                                    <div class="text-base font-bold text-white mb-1 flex items-center gap-2">
                                        3Dサンプリング解析
                                        <span class="bg-purple-500 text-black text-[10px] px-2 py-0.5 rounded-full font-bold">推奨</span>
                                    </div>
                                    <p class="text-xs text-gray-400 leading-relaxed">
                                        ドローンやLiDARで取得した「点群データ」から、樹木ごとの体積を正確に計測。<br>
                                        AIが種別を判定し、エリア全体のCO2吸収量を高精度に算出します。
                                    </p>
                                </div>
                            </div>

                            <!-- Demo Button (Static) -->
                            <a href="?view=map_3d" class="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition shadow-lg group-hover:scale-[1.02]">
                                <i data-lucide="play-circle" class="w-4 h-4"></i>
                                デモ（シミュレータ）を試す
                            </a>
                         </div>

                         <div class="flex justify-center text-gray-500">
                             <i data-lucide="arrow-down" class="w-6 h-6 animate-bounce"></i>
                         </div>

                         <div class="p-4 rounded-xl bg-gradient-to-r from-green-900/50 to-blue-900/50 border border-white/20 flex items-center justify-center gap-3 shadow-lg">
                             <div class="bg-yellow-500/20 p-2 rounded-full text-yellow-500"><i data-lucide="sparkles" class="w-5 h-5"></i></div>
                             <div>
                                 <div class="text-sm font-bold text-white">AIによる自動推定・レポート化</div>
                                 <div class="text-[10px] text-gray-400">サンプリングデータから全体値を外挿</div>
                             </div>
                         </div>
                     </div>
                </div>
                
                <!-- Visual Metaphor -->
                <div class="relative h-64 bg-gray-900 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center group">
                    <!-- Grid -->
                    <div class="absolute inset-0" style="background-image: radial-gradient(#333 1px, transparent 1px); background-size: 20px 20px;"></div>
                    
                    <!-- 3D Volume Representation (Centered) -->
                    <div class="flex flex-col items-center gap-3 relative z-10 scale-125 transition duration-700 group-hover:scale-110">
                         <div class="relative w-32 h-32">
                             <!-- Cube/Volume -->
                             <div class="absolute inset-0 border-2 border-dashed border-purple-500 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400 font-bold backdrop-blur-sm shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                                 <i data-lucide="box" class="w-12 h-12 stroke-[1]"></i>
                             </div>
                             <!-- Scanning Effect -->
                             <div class="absolute inset-0 border-t-2 border-green-400 bg-green-500/20 h-1 animate-[scan_3s_ease-in-out_infinite]"></div>
                             
                             <!-- Data Points -->
                             <div class="absolute -top-4 -right-4 bg-gray-800 border border-white/20 text-[10px] text-white px-2 py-1 rounded shadow-lg flex items-center gap-1">
                                 <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> 12,405 m³
                             </div>
                         </div>
                         <div class="text-center">
                             <div class="text-sm font-bold text-purple-300">Point Cloud Data</div>
                             <div class="text-[10px] text-gray-500">点群データによる体積解析</div>
                         </div>
                    </div>
                </div>
             </div>
        </div>
    </div>

    <!-- 4. Getting Started -->
    <div class="mb-16 animate-fade-in-up" style="animation-delay: 0.4s;">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-yellow-500 pl-4">
            4. 導入・算出開始までのステップ
        </h2>
        
        <div class="glass-panel-premium p-8 rounded-2xl">
            <div class="flex flex-col md:flex-row gap-6">
                <!-- Step 1 -->
                <div class="flex-1 relative group">
                    <div class="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black z-10">1</div>
                    <div class="bg-gray-800 p-6 rounded-xl border border-white/10 h-full hover:border-yellow-500/50 transition">
                        <div class="text-yellow-500 mb-2"><i data-lucide="map" class="w-8 h-8"></i></div>
                        <h4 class="font-bold text-white mb-2">エリア登録</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            Web管理画面から、算出対象となる敷地範囲（ジオフェンス）を設定します。
                        </p>
                    </div>
                </div>
                <!-- Step 2 -->
                <div class="flex-1 relative group">
                    <div class="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-black font-black z-10">2</div>
                    <div class="bg-gray-800 p-6 rounded-xl border border-white/10 h-full hover:border-yellow-500/50 transition">
                         <div class="text-yellow-500 mb-2"><i data-lucide="smartphone" class="w-8 h-8"></i></div>
                        <h4 class="font-bold text-white mb-2">データ収集</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            スタッフやイベント参加者が「ikimonアプリ」で生き物を見つけ、投稿します。<br>
                            <span class="text-purple-400">Proの場合: 3Dスキャンも実施</span>
                        </p>
                    </div>
                </div>
                <!-- Step 3 -->
                <div class="flex-1 relative group">
                    <div class="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-black font-black z-10 text-white animate-pulse">3</div>
                    <div class="bg-gradient-to-br from-gray-800 to-green-900/20 p-6 rounded-xl border border-green-500/30 h-full hover:border-green-500 transition shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                         <div class="text-green-500 mb-2"><i data-lucide="bar-chart-3" class="w-8 h-8"></i></div>
                        <h4 class="font-bold text-white mb-2">自動解析 & レポート</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            集まったデータからCO2吸収・生物多様性を自動算出。<br>
                            TNFDレポートを即時出力できます。
                        </p>
                    </div>
                </div>
            </div>
            
            <div class="mt-8 text-center">
                <a href="mailto:info@antigravity.dev" class="inline-flex items-center gap-2 px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition shadow-lg hover:shadow-xl">
                    <i data-lucide="mail" class="w-4 h-4"></i> 導入・見積りのご相談はこちら
                </a>
            </div>
        </div>
    </div>

    <!-- 5. Plans & Pricing -->
    <div class="mb-16 animate-fade-in-up" style="animation-delay: 0.6s;">
        <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2 border-l-4 border-green-500 pl-4">
            5. プラン・料金体系
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <!-- Standard -->
            <div class="bg-gray-900/50 p-8 rounded-2xl border border-white/10 flex flex-col relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-10"><i data-lucide="leaf" class="w-16 h-16 text-white"></i></div>
                <h3 class="text-lg font-bold text-white mb-2">スタンダード (Standard)</h3>
                <div class="text-3xl font-black text-white mb-1">付属<span class="text-sm font-normal text-gray-400 ml-1">/ 年</span></div>
                 <p class="text-xs text-gray-500 mb-6">基本機能として全ての自治体様に提供</p>
                
                <ul class="space-y-4 mb-8 flex-1">
                    <li class="flex items-center gap-3 text-sm text-gray-300">
                        <i data-lucide="check" class="w-5 h-5 text-green-500"></i>
                        <span>エリア面積からの概算算出</span>
                    </li>
                    <li class="flex items-center gap-3 text-sm text-gray-300">
                        <i data-lucide="check" class="w-5 h-5 text-green-500"></i>
                         <span>生物投稿アプリ (ikimon) 利用</span>
                    </li>
                    <li class="flex items-center gap-3 text-sm text-gray-300">
                        <i data-lucide="check" class="w-5 h-5 text-green-500"></i>
                        <span>簡易レポート出力</span>
                    </li>
                </ul>
                
                <button class="w-full py-3 rounded-xl border border-white/20 text-gray-400 text-sm font-bold cursor-not-allowed bg-white/5">標準付帯</button>
            </div>
            
            <!-- Premium -->
            <div class="bg-gradient-to-b from-gray-800 to-purple-900/20 p-8 rounded-2xl border border-purple-500/50 flex flex-col relative shadow-xl transform scale-105 z-10">
                <div class="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl">RECOMMENDED</div>
                <h3 class="text-lg font-bold text-white mb-2 text-purple-400">プレミアム (Premium)</h3>
                <div class="text-3xl font-black text-white mb-1">¥500,000<span class="text-sm font-normal text-gray-400 ml-1">/ 年</span></div>
                <p class="text-xs text-gray-500 mb-6">TNFD対応・システム利用ライセンス</p>
                
                <ul class="space-y-4 mb-8 flex-1">
                    <li class="flex items-center gap-3 text-sm text-white font-bold">
                        <div class="p-1 bg-purple-500 rounded-full"><i data-lucide="check" class="w-3 h-3 text-white"></i></div>
                        <span>3D点群データ解析 (体積算出)</span>
                    </li>
                    <li class="flex items-center gap-3 text-sm text-white font-bold">
                        <div class="p-1 bg-purple-500 rounded-full"><i data-lucide="check" class="w-3 h-3 text-white"></i></div>
                        <span>AIによる高精度係数適用</span>
                    </li>
                    <li class="flex items-center gap-3 text-sm text-white font-bold">
                        <div class="p-1 bg-purple-500 rounded-full"><i data-lucide="check" class="w-3 h-3 text-white"></i></div>
                        <span>TNFD対応 詳細レポート作成</span>
                    </li>
                     <li class="flex items-center gap-3 text-sm text-gray-300">
                        <div class="p-1 bg-gray-700 rounded-full"><i data-lucide="check" class="w-3 h-3 text-gray-400"></i></div>
                        <span>3D計測代行: ¥500,000~ (愛管株式会社)</span>
                    </li>
                </ul>
                
                <button class="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] transition relative overflow-hidden group">
                    <span class="relative z-10">お問い合わせ</span>
                    <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
            </div>
        </div>
    </div>

</div>
