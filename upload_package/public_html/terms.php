<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "利用規約 — ikimon.life";
    $meta_description = "ikimon.life の利用規約。サービスの利用条件、データの取り扱い、クリエイティブ・コモンズライセンスについて。";
    include __DIR__ . '/components/meta.php';
    ?>
</head>

<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/header.php'; ?>

    <main class="max-w-3xl mx-auto px-4 pt-24 pb-20 md:pt-28">

        <h1 class="text-2xl md:text-3xl font-black tracking-tight text-text mb-2">📜 利用規約</h1>
        <p class="text-xs text-muted mb-8">最終更新日: 2026年3月11日</p>

        <div class="space-y-8 text-sm text-text leading-relaxed">

            <section>
                <h2 class="text-lg font-black text-text mb-3">第1条（適用）</h2>
                <p>本利用規約（以下「本規約」）は、ikimon.life（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本サービスを利用することにより、本規約に同意したものとみなします。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第2条（サービスの内容）</h2>
                <p>本サービスは、市民参加型の生物多様性観察プラットフォームです。ユーザーは野生生物の観察記録を投稿し、コミュニティによる同定プロセスに参加できます。</p>
                <ul class="list-disc list-inside mt-2 space-y-1 text-muted">
                    <li>生物の観察記録の投稿・閲覧</li>
                    <li>コミュニティによる種の同定</li>
                    <li>フィールドマップ・図鑑・ランキングの利用</li>
                    <li>API・まとめ出力（有料プラン）</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第3条（アカウント）</h2>
                <p>ユーザーはGoogle認証またはゲストモードでサービスを利用できます。アカウント情報の管理はユーザー自身の責任とします。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第4条（投稿データとライセンス）</h2>
                <div class="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-3">
                    <p class="font-bold text-text mb-2">📋 重要: クリエイティブ・コモンズライセンス</p>
                    <p class="text-muted">ユーザーが投稿する観察データには、投稿時に選択したクリエイティブ・コモンズライセンスが適用されます。</p>
                    <ul class="mt-3 space-y-2">
                        <li class="flex items-start gap-2"><span class="text-primary font-bold">CC0</span> パブリックドメイン — 著作権を放棄。誰でも自由に利用可能</li>
                        <li class="flex items-start gap-2"><span class="text-primary font-bold">CC BY</span> 表示 — クレジット表示のもと、誰でも利用可能（推奨）</li>
                        <li class="flex items-start gap-2"><span class="font-bold text-secondary">CC BY-NC</span> 表示-非営利 — 非営利目的でのみ利用可能</li>
                    </ul>
                </div>
                <p>選択されたライセンスは投稿後に変更できません。CC0 および CC BY で投稿されたデータは、GBIF（地球規模生物多様性情報機構）を通じて国際的に共有される場合があります。CC BY-NC のデータは GBIF への共有対象外です。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第5条（禁止事項）</h2>
                <ul class="list-disc list-inside space-y-1 text-muted">
                    <li>虚偽の観察データの投稿</li>
                    <li>他者の著作物（写真等）を無断で投稿する行為</li>
                    <li>絶滅危惧種の生息地を特定する情報の意図的な公開</li>
                    <li>本サービスの運営を妨害する行為</li>
                    <li>API の不正利用（レートリミットの回避等）</li>
                    <li>密猟・違法採集を助長する行為</li>
                </ul>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第6条（有料プラン）</h2>
                <p>本サービスの一部機能（API アクセス、DwC-A エクスポート、共有向けのまとめ出力等）は有料プランでのみ提供されます。料金は<a href="for-business/#pricing" class="text-primary underline">料金プランページ</a>に記載のとおりです。</p>
                <p class="mt-2">有料プランの解約は、メールにて承ります。解約月の末日までサービスをご利用いただけます。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第7条（絶滅危惧種の保護）</h2>
                <p>環境省レッドリストおよび都道府県レッドリストに掲載されている種の位置情報は、密猟防止のため自動的にランダム化（半径10km圏内）されます。この処理はシステムにより自動的に行われ、ユーザーが解除することはできません。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第8条（免責事項）</h2>
                <p>本サービスは「現状有姿」で提供されます。コミュニティによる同定結果の正確性について、運営者は保証しません。外部資料への利用や研究用途で用いる場合は、目的に応じて専門家による検証を推奨します。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第9条（規約の変更）</h2>
                <p>運営者は、必要と判断した場合に本規約を変更できるものとします。重要な変更を行う場合は、本ページでの掲載および登録メールアドレスへの通知により、事前にお知らせします。変更後の利用規約は、本ページに掲載した時点より効力を生じるものとします。</p>
            </section>

            <section>
                <h2 class="text-lg font-black text-text mb-3">第10条（準拠法・管轄）</h2>
                <p>本規約の解釈は日本法に準拠し、本サービスに関する紛争については静岡地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
            </section>

            <section class="border-t border-border pt-8">
                <h2 class="text-lg font-black text-text mb-3">特定商取引法に基づく表示</h2>
                <div class="bg-surface border border-border rounded-2xl overflow-hidden">
                    <table class="w-full text-sm">
                        <tbody>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface w-1/3">販売業者</td>
                                <td class="px-4 py-3">ikimon.life 運営事務局</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">所在地</td>
                                <td class="px-4 py-3">お問い合わせにより開示</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">連絡先</td>
                                <td class="px-4 py-3">contact@ikimon.life</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">販売価格</td>
                                <td class="px-4 py-3"><a href="for-business/#pricing" class="text-primary underline">料金プランページ</a>に記載</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">支払方法</td>
                                <td class="px-4 py-3">銀行振込（請求書払い）</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">引渡し時期</td>
                                <td class="px-4 py-3">お支払い確認後、即日〜3営業日以内にアカウント有効化</td>
                            </tr>
                            <tr class="border-b border-border">
                                <td class="px-4 py-3 font-bold text-muted bg-surface">返品・解約</td>
                                <td class="px-4 py-3">月末解約可。解約月は引き続きご利用いただけます。返金は原則不可</td>
                            </tr>
                            <tr>
                                <td class="px-4 py-3 font-bold text-muted bg-surface">動作環境</td>
                                <td class="px-4 py-3">最新のChrome, Safari, Firefox, Edge。インターネット接続必須</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

        </div>

    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>

</html>
