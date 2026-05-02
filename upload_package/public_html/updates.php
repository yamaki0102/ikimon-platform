<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/Lang.php';
Auth::init();
Lang::init();

$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
<?php
$meta_title = "What's new | ikimon.life";
$meta_description = 'ikimon の最近の変化。新機能・改善・修正をユーザー目線で記録します。';
include __DIR__ . '/components/meta.php';
?>
</head>

<body class="js-loading pt-14 font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main x-data="{f:'all'}">

        <!-- Hero -->
        <section class="pt-24 pb-12 px-6">
            <div class="max-w-3xl mx-auto">
                <p class="text-xs font-mono font-semibold tracking-widest uppercase mb-4" style="color:var(--md-primary)">Changelog</p>
                <h1 class="text-4xl font-black tracking-tight mb-4">ikimon に最近起きた変化</h1>
                <p class="text-base mb-8" style="color:var(--md-on-surface-variant)">使う人に関係する変化だけを記録します。内部の実装名ではなく、見える変化で書く方針です。</p>

                <div class="flex items-start gap-4 p-5 rounded-2xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant)">
                    <div class="w-2.5 h-2.5 mt-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></div>
                    <div>
                        <div class="flex items-center gap-3 mb-1.5">
                            <span class="text-xs font-mono font-semibold" style="color:var(--md-primary)">最新 — v0.11.4</span>
                            <span class="text-xs" style="color:var(--md-on-surface-variant)">2026年5月2日</span>
                        </div>
                        <p class="text-sm font-medium">観察後の体験ループを接続し、位置情報の修正と日本語ラベルの統一を行いました。</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Filters -->
        <div class="sticky top-14 z-30 px-6 py-3 border-b" style="background:var(--md-surface);border-color:var(--md-outline-variant)">
            <div class="max-w-3xl mx-auto flex gap-2 flex-wrap">
                <button @click="f='all'"
                    :class="f==='all' ? 'bg-gray-900 text-white !border-gray-900' : 'hover:bg-gray-50'"
                    class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                    style="border-color:var(--md-outline-variant);color:var(--md-on-surface-variant)">すべて</button>
                <button @click="f='feature'"
                    :class="f==='feature' ? '!bg-emerald-600 text-white !border-emerald-600' : 'text-emerald-700 hover:bg-emerald-50'"
                    class="px-3 py-1.5 rounded-full text-xs font-medium border border-emerald-200 transition-colors">新機能</button>
                <button @click="f='improvement'"
                    :class="f==='improvement' ? '!bg-sky-600 text-white !border-sky-600' : 'text-sky-700 hover:bg-sky-50'"
                    class="px-3 py-1.5 rounded-full text-xs font-medium border border-sky-200 transition-colors">改善</button>
                <button @click="f='fix'"
                    :class="f==='fix' ? '!bg-amber-500 text-white !border-amber-500' : 'text-amber-700 hover:bg-amber-50'"
                    class="px-3 py-1.5 rounded-full text-xs font-medium border border-amber-200 transition-colors">修正</button>
            </div>
        </div>

        <!-- Entries -->
        <section class="px-6 pb-24">
            <div class="max-w-3xl mx-auto">

                <!-- v0.11.4 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','fix']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-05-02</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.11.4</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">修正</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年5月2日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">観察後の体験ループを接続、位置情報とラベルを修正</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">観察後の体験ループ</strong> — ガイドセッション終了後に「今日の成果」を確認し、次の観察につながる流れを整えました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">日本語表示を統一</strong> — サイト全体の日本語ラベルをより自然に読めるよう揃え直しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">観察の位置情報を修正</strong> — 記録された場所のデータが正確に保存・表示されるよう直しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.11.3 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04-30</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.11.3</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月30日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">スマホで開きやすく、野外でも続けやすい土台を強化</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ホーム画面から使いやすく</strong> — 端末のホーム画面に追加した状態でも、記録・地図・読み物へ自然に進める動線に整えました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">野外での途中再開</strong> — 通信が途切れても途中まで入力した内容を続けられる仕組みの基盤を整えました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ページ間のつながりを改善</strong> — 更新履歴・地図・記録ページが互いに見つかりやすいよう、公開ページの構成を調整しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.11.2 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['improvement','fix']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04-29</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.11.2</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">修正</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月29日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">地域ガイドと写真まわりを、野外で使いやすく</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">今いる場所の文脈でガイドが話す</strong> — 地域の自然・歴史・環境の手がかりをもとに、ガイドがより文脈を持って語りかけるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">長いセッションでも記録が途切れない</strong> — 通信が切れたり、散歩が長くなっても記録が壊れにくくなりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ガイド中のおすすめと振り返り</strong> — セッション途中や終了後に「次に見るもの」と「今日の発見」が表示されるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">写真の顔写り込みへの配慮</strong> — 人が写り込む可能性がある写真でも安全に扱えるよう処理を強化しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">カメラが使えないときの代替</strong> — 端末の制約でカメラが起動しない場合でも、写真選択から記録できる流れを用意しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.11.1 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04-28</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.11.1</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月28日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">観察記録を「大きさ・珍しさ・外来種」の視点で読み解けるように</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">3つの視点で記録を読む</strong> — ひとつの観察を、発見の大きさ・地域での希少さ・外来種情報の3つの角度から確認できるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">外来種・管理対象種をすぐ確認</strong> — 記録した生きものが法令上注意が必要なものかどうか確認しやすくなりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">気になる種の通知準備</strong> — 特定の生きものやテーマを追いかけたい人向けの通知機能の基盤を整えました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.11.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','fix']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04-27</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.11.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">修正</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月27日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">観察会・音声記録・投稿の安全性をまとめて前進</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">観察会を作れる</strong> — 複数人で同じ場所・テーマを調べる「観察会」の作成・参加・振り返りができるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">鳴き声・環境音を独立した記録として残せる</strong> — 音声を写真とは別の発見として記録できるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">重複投稿を防止</strong> — 連打や通信の揺れで観察が重複しないよう修正しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">野外からの投稿を安定化</strong> — メディア処理と確認の流れを見直し、投稿に失敗しにくくなりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.10.1 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04-08</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.10.1</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月8日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">AI考察 全面強化 — 写真で即分析・見分け方まで表示</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AI自動提案が復活</strong> — 写真をアップロードするだけで、候補と考察がすぐ返ってくる流れを戻しました。複数枚も一度に扱えます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">見分け方を表示</strong> — 「この種をどう見分けるか」のポイントと、似た種との違いがAI考察に追加されました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">より踏み込んだ判定</strong> — 形質がはっきり写っている場合、属止まりでなく種レベルまで判定しやすくなりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">大きな写真でも止まらない</strong> — AI考察の安定性を改善し、失敗しにくくなりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">デザインを整理</strong> — サイト全体の配色を整理し、記録や考察が読みやすくなりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.10.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-04上旬</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.10.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年4月上旬</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">おすすめ調査エリア + 鳥の鳴き声AIを二重チェックに</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">「ここ行くと見つかるかも」を地図で表示</strong> — GBIFやiNaturalistのデータと比べて、発見チャンスが高いエリアを地図に出すようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">鳥の鳴き声を2つのAIで確認</strong> — 2つの音声AIが一致した検出だけを採用し、誤検出が大幅に減りました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">スキャン後の結果レビュー</strong> — 終了後に今日の検出種・確信度・音声クリップをまとめて確認できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">検出候補をより多く表示</strong> — 閾値と地理フィルターを調整し、見逃しと誤検出を同時に減らしました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.9.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-31</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.9.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月31日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">散歩しながらAIが語りかける — AIレンズ</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AIレンズ</strong> — 散歩・自転車・ドライブ中に、近くで検出した生きものの生態・保全の話をAIが音声で語りかけます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">散歩レポート</strong> — セッション後に「今日の検出種・ルート・自然浴スコア」を一画面で振り返れます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">観察詳細にAI豆知識</strong> — 生態・保全情報が観察詳細ページに自動表示されるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">投稿後に写真を追加できる</strong> — 投稿済みの観察に後から写真を足せるようになりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.8.1 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03下旬</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.8.1</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月下旬</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">サウンドアーカイブ — 聞いた鳴き声をみんなで同定</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">鳴き声をみんなで同定できる</strong> — 野外で録音した鳴き声を投稿し、コミュニティで種を確認できる機能を追加しました。写真がなくても記録できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ウォーク中の検出がマイ図鑑に連動</strong> — 散歩中の音声検出がマイ図鑑の種ページから再生できるようになりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.8.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03中旬</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.8.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月中旬</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">Androidアプリ公開 + 世界11,560種の鳴き声AI同定</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">Androidアプリ（ikimon Pocket）を公開</strong> — カメラ検出・音声同定・ウォークモードをネイティブアプリとして使えます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">世界11,560種の鳥を端末上で同定</strong> — BirdNET V3.0搭載。Pixelではハードウェア加速で高速処理できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">カメラ・音声・環境センサーを同時動作</strong> — 3つのAIを並列で動かし、検出精度を高めます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">音声ガイド話者を追加</strong> — ずんだもん・もち子さん・青山龍星から選べます。Bluetooth出力にも対応しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ガイドの雰囲気を選べる</strong> — 「自然探索」「歴史文化」「おまかせ」から選択できます。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.7.1 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03中旬</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.7.1</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月中旬</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">AI考察に環境文脈を注入 + データを100年耐久で保存</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AI考察に環境情報が反映される</strong> — 気温・湿度・バイオーム・過去の検出履歴も考察の材料になりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">撮影地の地形・植生・気候も考慮</strong> — 場所の文脈からより正確な候補を出せるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">スキャンデータを長期保存</strong> — 将来の研究に使える形で環境データを蓄積します。重要な瞬間だけを自動選別して保存します。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.7.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03中旬</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.7.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月中旬</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">ライブスキャン・ウォーク・ライブマップ・マイ図鑑・クエスト</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ライブスキャン</strong> — カメラで見るだけでAIがリアルタイムに種を検出します。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ウォークモード</strong> — 散歩のルートをGPSで記録しながら、マイクが鳴き声を自動検出します。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ライブマップ（ログイン不要）</strong> — アカウントなしで地域の生物多様性データを地図で見られます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">マイ図鑑</strong> — 自分が観察・スキャン・音声検出で関わった種だけのコレクションになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">クエスト</strong> — 「次に何を見るか」を動機づけるクエストシステムを再設計しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">写真をフルスクリーンで</strong> — スワイプ・ピンチズームに対応しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">4種類のリアクション</strong> — 「足あと」「いいね」「すてき」「学び」を付けられます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">和名で表示</strong> — AIやGBIFの学名・英名を自動で日本語の和名に変換します。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.6.1 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.6.1</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">「そうかも！」ワンタップ同定 + ナビゲーション整理</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AI考察から「そうかも！」でワンタップ同定</strong> — AI提案をそのまま自分の同定票として送れるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">自分の出会い方で種を解説</strong> — 場所・季節・見つけ方に応じたAI解説がマイ図鑑の種ページに生成されます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ナビゲーションをすっきり</strong> — よく使う場所へすばやくたどり着けるようメニューを整理しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.6.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-14</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.6.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月14日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">法人向け導線と図鑑をまとめて強化</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">法人プランに応じた表示切り替え</strong> — 記録ボードやレポートを契約プランに応じた表示に整理しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">関連書籍の導線を追加</strong> — 種や観察に応じた関連書籍が表示されるようになりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.5.9 〜 v0.5.1: 改善系まとめ -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-11</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.5.1 – v0.5.9</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月11日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">AIメモ・同定・料金・組織向けを一気に整理</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AIメモを読みやすく再構成</strong> — 「結論 → 手がかり → 次に確認すること」の順で読みやすくなりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">同定ステータスを2段階化</strong> — 「種まで確定」と「属・科レベルで安定」を区別して表示できるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">料金体系を3プランに整理</strong> — 個別見積りをやめ、公開価格から選べる3段構成にしました。月額39,800円のスタンダードプランを設定しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">組織向け申込みをスムーズに</strong> — 招待リンク方式に変更し、申込み後すぐワークスペースへ入れるようにしました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">AIの候補を同定作業につなげやすく</strong> — 候補名をタップすると近い記録を探せるリンクに変更しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">サイト全体の言葉を整理</strong> — ナビゲーション・フッター・Aboutページのトーンを統一しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.5.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-10</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.5.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月10日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">施設由来の記録に対応 + 投稿後にAI考察が自動生成</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">動物園・植物園の記録に対応</strong> — 施設で見た生きものを「施設由来」として投稿できます。野生記録とは区別して扱われます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">投稿後にAI考察が自動生成</strong> — 写真・位置・季節をもとにAIが考察を自動で付けます。「参考メモ」として機能します。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">場所・季節も考慮した考察</strong> — 撮影地の都道府県・季節も補助証拠として参照されます。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.4.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['improvement']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-09</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.4.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月9日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">みんなの同定をより賢く集計</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">属・種レベルが混在しても集計できる</strong> — 複数人の同定から共通の分類群を自動で導き出せるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">矛盾した同定を自動検知</strong> — 系統的に矛盾する同定が混在する場合、確定を自動で保留します。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.3.4 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-09</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.3.4</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月9日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">個体数・環境情報の記録に対応</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">個体数を記録できる</strong> — 周辺の個体数をざっくり選べます。長期的な個体数変動の追跡に使われます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">同定の根拠を記録できる</strong> — 体色・模様・形・行動・鳴き声などの根拠を残せます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">環境バイオームと地面の状態</strong> — 森林・草地・湿地・都市など生息環境を記録できます。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.3.3 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['fix']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-09</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.3.3</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">修正</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月9日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">ログイン復旧 & 表示バグ修正</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">Google・Xログインを復旧</strong> — ボタンが一時的に表示されない問題を修正しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">投稿の表示順を修正</strong> — 過去の日付の写真がフィードに表示されない問題を直しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.3.1 & v0.3.2 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-08</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.3.1 – v0.3.2</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月8日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">AI同定・環境自動推定・ネイチャーポジティブガイド公開</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">「AIにきいてみる」機能</strong> — 写真から生きものの分類候補を返します。種の断定ではなく、参考情報として提案します。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">環境情報の自動入力</strong> — 写真の背景からバイオーム・野生/植栽・ライフステージをAIが推定し、フォームに反映します。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ネイチャーポジティブガイドを公開</strong> — 散歩・生きもの観察・脳活性化の三位一体を科学的エビデンスで解説するページを新設しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.2.0 〜 v0.3.0 -->
                <article class="py-10 border-b" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature','improvement','fix']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2026-03-04</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.2.0 – v0.3.0</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">改善</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">修正</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2026年3月4〜7日</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">ダッシュボード刷新 + バッジ・スコア・ソーシャルログイン</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ダッシュボードを全面リニューアル</strong> — ランクカード・デイリークエスト・カテゴリ探索を搭載した新デザインに。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">バッジ・スコアシステムが本格稼働</strong> — 記録数・同定貢献・連続投稿などでバッジが取得できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">Google・Xログイン対応</strong> — ソーシャルログインでかんたんにアカウントを作れます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">地域達成度をマイルストーン制に</strong> — 遠すぎる目標をやめ、次の一歩が手の届く距離に見えるようになりました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">ヒートマップ・フィルターのバグ修正</strong> — 探索フィルターと地図表示の問題を修正しました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

                <!-- v0.1.0 〜 v0.1.2 -->
                <article class="py-10" style="border-color:var(--md-outline-variant)"
                    x-data="{tags:['feature']}" x-show="f==='all' || tags.includes(f)" x-transition>
                    <div class="sm:flex gap-8">
                        <div class="hidden sm:block w-24 shrink-0 text-right pt-0.5">
                            <time class="text-xs font-mono" style="color:var(--md-on-surface-variant)">2025-11-01</time>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-3 flex-wrap">
                                <span class="text-xs font-mono" style="color:var(--md-on-surface-variant)">v0.1.0 – v0.1.2</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">新機能</span>
                                <time class="text-xs sm:hidden" style="color:var(--md-on-surface-variant)">2025年11月 – 2026年1月</time>
                            </div>
                            <h2 class="text-lg font-bold mb-4">プロトタイプ版スタート</h2>
                            <ul class="space-y-2.5 text-sm" style="color:var(--md-on-surface-variant)">
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">フィールドノート</strong> — 写真から生きものを記録する入口を作りました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">コミュニティ同定</strong> — みんなで種の名前を提案・確認できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">地図探索</strong> — 周辺の生きものを地図で確認できます。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">企業向けレポート・地図埋め込み</strong> — 生物多様性レポートの自動生成と、自社サイトへの地図埋め込みに対応しました。</span></li>
                                <li class="flex items-start gap-2"><span class="shrink-0 mt-px">–</span><span><strong style="color:var(--md-on-surface)">PWA対応</strong> — ホーム画面に追加できるようになりました。</span></li>
                            </ul>
                        </div>
                    </div>
                </article>

            </div>
        </section>

        <!-- Newsletter CTA -->
        <section class="px-6 py-16 border-t" style="border-color:var(--md-outline-variant)">
            <div class="max-w-3xl mx-auto">
                <div class="p-8 rounded-2xl" style="background:var(--md-surface-container);border:1px solid var(--md-outline-variant)">
                    <h3 class="text-lg font-bold mb-2">更新をメールで受け取る</h3>
                    <p class="text-sm mb-5" style="color:var(--md-on-surface-variant)">次のアップデートをいち早くお知らせします。</p>
                    <div class="flex gap-2 max-w-md">
                        <input type="email" placeholder="メールアドレス"
                            class="flex-1 px-4 py-3 rounded-xl focus:outline-none text-sm"
                            style="background:var(--md-surface);border:1px solid var(--md-outline-variant);color:var(--md-on-surface);">
                        <button class="btn-primary px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap">登録</button>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>

</body>
</html>
